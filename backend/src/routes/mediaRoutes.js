const express = require("express");
const router = express.Router();

const mediaController = require("../controllers/mediaController");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

// citizen + worker can upload
router.post(
  "/upload",
  authMiddleware,
  upload.single("file"),
  mediaController.uploadMedia
);

module.exports = router;