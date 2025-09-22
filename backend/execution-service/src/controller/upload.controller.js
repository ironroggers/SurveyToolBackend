import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import Tesseract from 'tesseract.js';

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined,
});

export const createPresignUrl = async (req, res) => {
  try {
    console.log('[uploads] presign request body:', req.body);
    const { filename, contentType = 'image/jpeg' } = req.body || {};
    const key = `${process.env.S3_PREFIX || 'uploads'}/${uuidv4()}-${filename || 'image.jpg'}`;
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ContentType: contentType,
      // Do not set ACL here; many buckets have ACLs disabled. Use bucket policy instead.
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 5 });
    const publicUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    console.log('[uploads] presign success key:', key);
    res.json({ uploadUrl, publicUrl, contentType });
  } catch (error) {
    console.error('[uploads] presign error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Simple placeholder extraction - in real use call an OCR/LLM provider
export const extractDigits = async (req, res) => {
  try {
    console.log('[ai] extract-digits file:', req.file?.originalname, 'size:', req.file?.size);
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'image is required' });
    }

    // Preprocess full image (autorotate)
    const img = sharp(req.file.buffer).rotate();
    const meta = await img.metadata();
    const width = meta.width || 1000;
    const height = meta.height || 1000;

    // Define ROIs as relative boxes based on the DigiTrack layout (tuned for the sample UI):
    const roi = {
      temp: { left: 0.04, top: 0.82, w: 0.22, h: 0.15 },
      angle: { left: 0.34, top: 0.82, w: 0.22, h: 0.15 },
      depth: { left: 0.12, top: 0.40, w: 0.28, h: 0.18 },
    };

    const crop = async ({ left, top, w, h }) => {
      const lx = Math.max(0, Math.floor(width * left));
      const ty = Math.max(0, Math.floor(height * top));
      const rw = Math.min(width - lx, Math.floor(width * w));
      const rh = Math.min(height - ty, Math.floor(height * h));
      // ROI preprocess: grayscale, normalize, resize for OCR, hard threshold to reduce background noise
      const roiBuf = await img
        .clone()
        .extract({ left: lx, top: ty, width: rw, height: rh })
        .grayscale()
        .normalise()
        .resize({ width: Math.max(400, Math.floor(rw * 1.2) || 400), withoutEnlargement: false })
        .toBuffer();
      return roiBuf;
    };

    const [bufTemp, bufAngle, bufDepth] = await Promise.all([
      crop(roi.temp),
      crop(roi.angle),
      crop(roi.depth),
    ]);

    // Try multiple rotations for each ROI because some fields are printed vertically on the device
    const orientAndOcr = async (buffer, rotations = [0, 90, 270]) => {
      const results = [];
      for (const r of rotations) {
        const prep = await sharp(buffer)
          .rotate(r)
          .threshold(170) // binarize to improve contrast
          .toBuffer();
        const { data } = await Tesseract.recognize(prep, 'eng', {
          tessedit_char_whitelist: '0123456789.+-%mC°',
          psm: 7, // single text line
          preserve_interword_spaces: 1,
        });
        const text = (data?.text || '').replace(/\s+/g, ' ').trim();
        results.push({ r, text });
      }
      // return the longest non-empty text
      results.sort((a, b) => (b.text?.length || 0) - (a.text?.length || 0));
      return results[0]?.text || '';
    };

    const [txtTemp, txtAngle, txtDepth] = await Promise.all([
      orientAndOcr(bufTemp),
      orientAndOcr(bufAngle),
      orientAndOcr(bufDepth),
    ]);

    // Fallback: OCR the full image in multiple rotations and attempt to parse from the combined text
    const fullTexts = [];
    for (const r of [0, 90, 180, 270]) {
      const fullBuf = await sharp(req.file.buffer).rotate(r).grayscale().normalise().resize({ width: 1400, withoutEnlargement: false }).threshold(170).toBuffer();
      const { data } = await Tesseract.recognize(fullBuf, 'eng', {
        tessedit_char_whitelist: '0123456789.+-%mC°',
        psm: 6,
      });
      fullTexts.push((data?.text || '').replace(/\s+/g, ' ').trim());
    }
    const fullText = fullTexts.sort((a, b) => (b?.length || 0) - (a?.length || 0))[0] || '';

    const parseNum = (re, txt) => {
      const m = txt && re.exec(txt);
      return m ? parseFloat(m[1]) : undefined;
    };

    // Clean typical misreads before parsing
    const clean = (t) => t
      .replace(/O/g, '0')
      .replace(/l/g, '1')
      .replace(/I/g, '1')
      .replace(/S/g, '5')
      .replace(/[|]/g, '1')
      .trim();

    const cTemp = clean(txtTemp);
    const cAngle = clean(txtAngle);
    const cDepth = clean(txtDepth);

    let temp = parseNum(/([+-]?\d+(?:\.\d+)?)\s*°?\s*C/i, cTemp);
    let angleVal = parseNum(/([+-]?\d+(?:\.\d+)?)\s*(?:%|°)/i, cAngle);
    let depth = parseNum(/([+-]?\d+(?:\.\d+)?)\s*m/i, cDepth);

    // Heuristics for stubborn readings
    const onlyDigits = (t) => (t || '').replace(/[^0-9]/g, '');
    const hasMinus = (t) => /[-–—−_]/.test(t || '');

    // Temperature: prefer 2-digit integer 10..50 in temp ROI
    if (temp === undefined) {
      const d = onlyDigits(cTemp);
      if (d.length >= 2) {
        const cand = parseInt(d.slice(0, 2), 10);
        if (cand >= 10 && cand <= 50) temp = cand;
      }
    }

    // Angle: typical small percentage like 0.0 .. 5.0
    if (angleVal === undefined) {
      const d = onlyDigits(cAngle);
      if (d.length === 2) {
        angleVal = parseFloat(`${d[0]}.${d[1]}`);
      } else if (d.length === 1) {
        angleVal = parseFloat(`0.${d}`);
      }
      // clamp to reasonable range
      if (angleVal !== undefined && (angleVal < -10 || angleVal > 10)) angleVal = undefined;
    }

    // Depth: pattern like 1.17 where OCR may miss the dot -> '117'
    if (depth === undefined) {
      const d = onlyDigits(cDepth);
      if (d.length === 3) {
        depth = parseFloat(`${d[0]}.${d.slice(1)}`);
      } else if (d.length >= 4) {
        // pick first 3 digits
        depth = parseFloat(`${d[0]}.${d.slice(1, 3)}`);
      }
      if (depth !== undefined && depth > 30) depth = undefined;
      if (depth !== undefined && (hasMinus(cDepth) || /-\s*\d/.test(fullText))) depth = -Math.abs(depth);
    }

    // If any field missing, try from full image text
    if (temp === undefined) temp = parseNum(/([+-]?\d+(?:\.\d+)?)\s*°?\s*C/i, fullText);
    if (angleVal === undefined) angleVal = parseNum(/([+-]?\d+(?:\.\d+)?)\s*(?:%|°)/i, fullText) ?? (() => {
      const d = onlyDigits(fullText);
      if (d.length >= 2) return parseFloat(`${d[0]}.${d[1]}`);
      return undefined;
    })();
    if (depth === undefined) {
      // Depth might appear with or without space before m
      depth = parseNum(/([+-]?\d+(?:\.\d+)?)\s*m/i, fullText) ?? parseNum(/([+-]?\d+(?:\.\d+)?)(?=m)/i, fullText);
      if (depth === undefined) {
        const d = onlyDigits(fullText);
        if (d.length >= 3) depth = parseFloat(`${d[0]}.${d.slice(1, 3)}`);
      }
      if (depth !== undefined && /[-–—−]/.test(fullText)) depth = -Math.abs(depth);
    }

    // Final pass: smarter regexes scanning full combined text (ROIs + fullText)
    if (temp === undefined) {
      const text = `${cTemp} ${fullText}`;
      // Prefer two consecutive digits followed by optional spaces and C
      const m = text.match(/\b(\d{2})\s*°?\s*C\b/i);
      if (m) {
        const v = parseInt(m[1], 10);
        if (v >= 10 && v <= 60) temp = v;
      }
    }

    if (angleVal === undefined) {
      const text = `${cAngle} ${fullText}`.replace(/O/g, '0');
      // Accept +0.2%, 0.2%, 0.2° etc.
      let m = text.match(/([+-]?\d(?:[.,]\d)?)\s*(%|°)/);
      if (m) {
        angleVal = parseFloat(m[1].replace(',', '.'));
      } else {
        // Handle patterns like +0 2 or 02 interpreted as 0.2
        const d = onlyDigits(text);
        if (d.length >= 2) angleVal = parseFloat(`${d[0]}.${d[1]}`);
      }
      if (angleVal !== undefined && (angleVal < -15 || angleVal > 15)) angleVal = undefined;
    }

    if (depth === undefined) {
      const text = `${cDepth} ${fullText}`;
      // Look for a minus sign near a number + 'm'
      let m = text.match(/([-–—−]?)\s*(\d)\s*[.,]?\s*(\d{1,2})\s*m/i);
      if (m) {
        const sign = m[1] ? -1 : 1;
        depth = sign * parseFloat(`${m[2]}.${m[3]}`);
      }
      if (depth !== undefined && Math.abs(depth) > 30) depth = undefined;
    }

    console.log('[ai] OCR raw:', { txtTemp, txtAngle, txtDepth });
    console.log('[ai] OCR cleaned:', { cTemp, cAngle, cDepth });
    console.log('[ai] OCR parsed:', { depth, temperature: temp, angle: angleVal });

    return res.json({ depth, temperature: temp, angle: angleVal, raw: { txtTemp, txtAngle, txtDepth, fullText } });
  } catch (error) {
    console.error('[ai] extract-digits error:', error);
    res.status(500).json({ message: error.message });
  }
};


