const express = require("express");
const router = express.Router();

const controller = require("../controllers/workerAssignmentController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const upload = require("../middleware/uploadMiddleware");

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
  upload.single("file"),
  controller.uploadAssignmentAttachment
);

module.exports = router;