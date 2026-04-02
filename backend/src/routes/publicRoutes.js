const express = require("express");
const router = express.Router();

const controller = require("../controllers/publicController");

router.get("/stats", controller.getPublicStats);
router.get("/recent-resolved", controller.getRecentResolvedComplaints);
router.get("/department-summary", controller.getDepartmentSummary);
router.get("/departments/:id/summary", controller.getPublicDepartmentSummary);
router.get("/complaints/map", controller.getPublicMapPoints);
router.get("/comparisons", controller.getPublicComparisons);
router.get("/attachments/:attachmentId/view", controller.viewPublicAttachment);

module.exports = router;
