const express = require("express");
const router = express.Router();

const controller = require("../controllers/citizenComplaintController");
const upload = require("../middleware/uploadMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const validate = require("../middleware/validateMiddleware");
const { createComplaintSchema } = require("../validators/citizenComplaintValidator");

// public / shared lookup
router.get("/departments", controller.getDepartments);
router.get("/departments/:departmentId/types", controller.getDepartmentComplaintTypes);

// citizen complaint create — CITIZEN only
router.post(
  "/",
  authMiddleware,
  roleMiddleware(["CITIZEN"]),
  validate(createComplaintSchema),
  controller.createComplaint
);

// upload complaint attachment — CITIZEN only
router.post(
  "/:complaintId/attachments",
  authMiddleware,
  roleMiddleware(["CITIZEN"]),
  upload.single("file"),
  controller.uploadComplaintAttachment
);

// track by complaint ID — CITIZEN only
router.get("/track/:complaintId", authMiddleware, roleMiddleware(["CITIZEN"]), controller.trackComplaintByReference);

module.exports = router;
