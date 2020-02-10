const multer = require("multer");
const uuid = require("uuid/v1");

const MIME_TYPE_MAP = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpg"
};

const fileUpload = multer({
  limits: 500000,
  storage: multer.diskStorage({
    //where to store the uploads
    destination: (req, file, cb) => {
      cb(null, "uploads/images");
    },
    //naming the file
    filename: (req, file, cb) => {
      const ext = MIME_TYPE_MAP[file.mimetype]; // finds the extension/file type
      cb(null, uuid() + "." + ext); // creates a filename
    }
  }),
  //which files to accept
  fileFilter: (req, file, cb) => {
    const isValid = !!MIME_TYPE_MAP[file.mimetype]; // !! converts undefined to false and if it finds the data then true
    let error = isValid ? null : new Error("Invalid mime type!");
    cb(error, isValid);
  }
});

module.exports = fileUpload;
