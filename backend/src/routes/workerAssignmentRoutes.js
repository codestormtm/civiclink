const express = require("express");
const router = express.Router();

const controller = require("../controllers/workerAssignmentController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const upload = require("../middleware/uploadMiddleware");
const attachmentUpload = upload.createUpload({ maxFiles: 1 });

router.get(
  "/assignments",
  authMiddleware,
  roleMiddleware(["WORKER"]),
  controller.getMyAssignments
);

router.get(
  "/assignments/:id",
  authMiddleware,
  roleMiddleware(["WORKER"]),
  controller.getMyAssignmentById
);

router.patch(
  "/assignments/:id/status",
  authMiddleware,
  roleMiddleware(["WORKER"]),
  controller.updateMyAssignmentStatus
);

router.post(
  "/assignments/:id/attachments",
  authMiddleware,
  roleMiddleware(["WORKER"]),
  attachmentUpload.single("file"),
  controller.uploadAssignmentAttachment
);

module.exports = router;
