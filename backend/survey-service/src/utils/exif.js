import { exiftool } from 'exiftool-vendored';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

/**
 * Add geolocation data to image or video file
 * @param {Buffer} fileBuffer - The file buffer containing image or video data
 * @param {Object} geoData - The geolocation data to add to the file
 * @param {number} geoData.latitude - Latitude value (-90 to 90)
 * @param {number} geoData.longitude - Longitude value (-180 to 180)
 * @param {string} geoData.deviceName - Name of the device that captured the media
 * @param {number} geoData.accuracy - Accuracy of the location data in meters
 * @param {string} [geoData.place] - Optional place name
 * @returns {Promise<Buffer>} - The file buffer with added EXIF metadata
 */
export const addGeoTagToMedia = async (fileBuffer, geoData) => {
  try {
    console.log('\n=== Starting EXIF Geotagging Process ===');
    
    // Validate required geoData
    if (!geoData.latitude || !geoData.longitude || !geoData.deviceName || !geoData.accuracy) {
      throw new Error('Missing required geolocation data');
    }
    
    // Create a temp file to work with
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'exif-'));
    const randomFileName = crypto.randomBytes(16).toString('hex');
    const tempFilePath = path.join(tempDir, randomFileName);
    
    // Write the buffer to a temp file
    await fs.writeFile(tempFilePath, fileBuffer);
    
    console.log('Temporary file created at:', tempFilePath);
    console.log('Adding geolocation data:');
    console.log('- Latitude:', geoData.latitude);
    console.log('- Longitude:', geoData.longitude);
    console.log('- Device:', geoData.deviceName);
    console.log('- Accuracy:', geoData.accuracy);
    console.log('- Place:', geoData.place || 'Not provided');
    
    // Convert decimal latitude/longitude to EXIF format (degrees, minutes, seconds)
    const latRef = geoData.latitude >= 0 ? 'N' : 'S';
    const lonRef = geoData.longitude >= 0 ? 'E' : 'W';
    const latValue = Math.abs(geoData.latitude);
    const lonValue = Math.abs(geoData.longitude);
    
    // Write EXIF metadata to the file
    await exiftool.write(tempFilePath, {
      GPSLatitude: latValue,
      GPSLatitudeRef: latRef,
      GPSLongitude: lonValue,
      GPSLongitudeRef: lonRef,
      GPSAltitude: 0, // Default to sea level if not provided
      GPSAltitudeRef: 0, // Above sea level
      UserComment: `Device: ${geoData.deviceName}, Accuracy: ${geoData.accuracy}m${geoData.place ? `, Place: ${geoData.place}` : ''}`,
      Software: 'Survey and Route System', // Add your application name here
    });
    
    console.log('EXIF data written successfully');
    
    // Read the file back into a buffer
    const updatedFileBuffer = await fs.readFile(tempFilePath);
    
    // Clean up temp files
    await fs.unlink(tempFilePath);
    await fs.rmdir(tempDir);
    
    console.log('Temporary files cleaned up');
    console.log('=== EXIF Geotagging Completed ===\n');
    
    return updatedFileBuffer;
  } catch (error) {
    console.error('\n❌ EXIF Geotagging Error:');
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    throw error;
  } finally {
    // Ensure exiftool process is closed
    try {
      await exiftool.end();
    } catch (err) {
      // Ignore errors during cleanup
    }
  }
};

/**
 * Read geolocation data from image or video file
 * @param {Buffer} fileBuffer - The file buffer containing image or video data
 * @returns {Promise<Object>} - The extracted geolocation data
 */
export const readGeoTagFromMedia = async (fileBuffer) => {
  try {
    console.log('\n=== Starting EXIF Metadata Reading ===');
    
    // Create a temp file to work with
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'exif-'));
    const randomFileName = crypto.randomBytes(16).toString('hex');
    const tempFilePath = path.join(tempDir, randomFileName);
    
    // Write the buffer to a temp file
    await fs.writeFile(tempFilePath, fileBuffer);
    
    console.log('Temporary file created at:', tempFilePath);
    
    // Read EXIF metadata from the file
    const metadata = await exiftool.read(tempFilePath);
    
    console.log('EXIF data read successfully');
    
    // Clean up temp files
    await fs.unlink(tempFilePath);
    await fs.rmdir(tempDir);
    
    console.log('Temporary files cleaned up');
    console.log('=== EXIF Metadata Reading Completed ===\n');
    
    // Extract and return geolocation data
    let latitude = null;
    let longitude = null;
    
    if (metadata.GPSLatitude !== undefined && metadata.GPSLatitudeRef !== undefined) {
      latitude = metadata.GPSLatitude * (metadata.GPSLatitudeRef === 'N' ? 1 : -1);
    }
    
    if (metadata.GPSLongitude !== undefined && metadata.GPSLongitudeRef !== undefined) {
      longitude = metadata.GPSLongitude * (metadata.GPSLongitudeRef === 'E' ? 1 : -1);
    }
    
    // Parse device name, accuracy, and place from UserComment if available
    let deviceName = null;
    let accuracy = null;
    let place = null;
    
    if (metadata.UserComment) {
      const deviceMatch = metadata.UserComment.match(/Device: ([^,]+)/);
      const accuracyMatch = metadata.UserComment.match(/Accuracy: ([0-9.]+)m/);
      const placeMatch = metadata.UserComment.match(/Place: ([^,]+)/);
      
      deviceName = deviceMatch ? deviceMatch[1] : null;
      accuracy = accuracyMatch ? parseFloat(accuracyMatch[1]) : null;
      place = placeMatch ? placeMatch[1] : null;
    }
    
    return {
      latitude,
      longitude,
      deviceName,
      accuracy,
      place,
      allMetadata: metadata // Include all metadata for debugging or advanced usage
    };
  } catch (error) {
    console.error('\n❌ EXIF Metadata Reading Error:');
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    throw error;
  } finally {
    // Ensure exiftool process is closed
    try {
      await exiftool.end();
    } catch (err) {
      // Ignore errors during cleanup
    }
  }
}; 