const express = require("express");
const router = express.Router();

const controller = require("../controllers/systemAdminController");
const monitoringController = require("../controllers/systemMonitoringController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.post(
  "/create-admin",
  authMiddleware,
  roleMiddleware(["SYSTEM_ADMIN"]),
  controller.createDeptAdmin
);

router.get(
  "/password-reset-requests",
  authMiddleware,
  roleMiddleware(["SYSTEM_ADMIN"]),
  controller.listPasswordResetRequests
);

router.get(
  "/password-reset-requests/unread-count",
  authMiddleware,
  roleMiddleware(["SYSTEM_ADMIN"]),
  controller.getPasswordResetUnreadCount
);

router.get(
  "/password-reset-requests/:id",
  authMiddleware,
  roleMiddleware(["SYSTEM_ADMIN"]),
  controller.getPasswordResetRequest
);

router.patch(
  "/password-reset-requests/:id/view",
  authMiddleware,
  roleMiddleware(["SYSTEM_ADMIN"]),
  controller.markPasswordResetRequestViewed
);

router.post(
  "/password-reset-requests/:id/reset-password",
  authMiddleware,
  roleMiddleware(["SYSTEM_ADMIN"]),
  controller.resetPasswordFromRequest
);

router.get(
  "/monitoring/summary",
  authMiddleware,
  roleMiddleware(["SYSTEM_ADMIN"]),
  monitoringController.getMonitoringSummary
);

router.get(
  "/monitoring/incidents",
  authMiddleware,
  roleMiddleware(["SYSTEM_ADMIN"]),
  monitoringController.getMonitoringIncidents
);

router.get(
  "/monitoring/logs/download",
  authMiddleware,
  roleMiddleware(["SYSTEM_ADMIN"]),
  monitoringController.downloadMonitoringLogs
);

router.get(
  "/monitoring/logs",
  authMiddleware,
  roleMiddleware(["SYSTEM_ADMIN"]),
  monitoringController.getMonitoringLogs
);

router.get(
  "/monitoring/department-activity",
  authMiddleware,
  roleMiddleware(["SYSTEM_ADMIN"]),
  monitoringController.getDepartmentActivity
);

router.get(
  "/monitoring/worker-activity",
  authMiddleware,
  roleMiddleware(["SYSTEM_ADMIN"]),
  monitoringController.getWorkerActivity
);

router.get(
  "/monitoring/alerts",
  authMiddleware,
  roleMiddleware(["SYSTEM_ADMIN"]),
  monitoringController.getMonitoringAlerts
);

module.exports = router;
