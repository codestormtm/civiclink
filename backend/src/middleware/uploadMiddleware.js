const multer = require("multer");
const AppError = require("../utils/appError");

const storage = multer.memoryStorage();
const MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024;

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/svg+xml",
  "image/avif",
]);

const PDF_MIME_TYPES = new Set(["application/pdf"]);
const DOCUMENT_MIME_TYPES = new Set([
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function createMimeValidator({ defaultAllowedMimeTypes = [], allowedMimeTypesByField = {} } = {}) {
  const fallbackMimeTypes = new Set(defaultAllowedMimeTypes);
  const fieldMimeTypeMap = Object.fromEntries(
    Object.entries(allowedMimeTypesByField).map(([field, mimeTypes]) => [field, new Set(mimeTypes)])
  );

  return (req, file, callback) => {
    const allowedMimeTypes = fieldMimeTypeMap[file.fieldname] || fallbackMimeTypes;

    if (!allowedMimeTypes.size || allowedMimeTypes.has(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new AppError(`Unsupported file type for ${file.fieldname}`, 415));
  };
}

function createUpload(options = {}) {
  const {
    maxFileSizeBytes = MAX_UPLOAD_SIZE_BYTES,
    maxFiles,
    maxFields = 20,
    defaultAllowedMimeTypes = [...IMAGE_MIME_TYPES, ...PDF_MIME_TYPES, ...DOCUMENT_MIME_TYPES],
    allowedMimeTypesByField = {},
  } = options;

  return multer({
    storage,
    limits: {
      fileSize: maxFileSizeBytes,
      files: maxFiles,
      fields: maxFields,
    },
    fileFilter: createMimeValidator({
      defaultAllowedMimeTypes,
      allowedMimeTypesByField,
    }),
  });
}

const upload = createUpload();

module.exports = upload;
module.exports.createUpload = createUpload;
module.exports.DOCUMENT_MIME_TYPES = DOCUMENT_MIME_TYPES;
module.exports.IMAGE_MIME_TYPES = IMAGE_MIME_TYPES;
module.exports.PDF_MIME_TYPES = PDF_MIME_TYPES;
module.exports.MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_BYTES;
