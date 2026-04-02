const express = require("express");
const router = express.Router();

const mediaController = require("../controllers/mediaController");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");
const mediaUpload = upload.createUpload({ maxFiles: 1 });

// citizen + worker can upload
router.post(
  "/upload",
  authMiddleware,
  mediaUpload.single("file"),
  mediaController.uploadMedia
);

router.get(
  "/attachments/:attachmentId/view",
  authMiddleware,
  mediaController.viewAttachment
);

module.exports = router;
