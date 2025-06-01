import { generateUploadSignedUrl } from '../utils/s3.js';

export const getUploadUrl = async (req, res) => {
  try {
    const { filename, contentType } = req.body;

    if (!filename || !contentType) {
      return res.status(400).json({
        success: false,
        message: 'filename and contentType are required'
      });
    }

    const fileDetails = {
      originalname: filename,
      mimetype: contentType
    };

    const uploadData = await generateUploadSignedUrl(fileDetails);

    res.status(200).json({
      success: true,
      data: {
        signedUrl: uploadData.signedUrl,
        fileUrl: uploadData.fileUrl,
        fileName: uploadData.fileName,
        fileType: uploadData.fileType
      }
    });
  } catch (error) {
    console.error('Error in getUploadUrl:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating upload URL',
      error: error.message
    });
  }
}; 