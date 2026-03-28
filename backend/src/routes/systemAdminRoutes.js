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
