const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: 'flashchat',
    resource_type: 'auto',   // handles images, videos, files
    public_id: Date.now() + '-' + file.originalname.replace(/\s/g, '_'),
  }),
});

const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

module.exports = { upload, cloudinary };