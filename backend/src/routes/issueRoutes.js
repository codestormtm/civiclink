const express = require("express");
const router = express.Router();

const issueController = require("../controllers/issueController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const validate = require("../middleware/validateMiddleware");
const { createIssueSchema } = require("../validators/issueValidator");

// Citizen → create issue
router.post(
  "/",
  authMiddleware,
  roleMiddleware(["CITIZEN"]),
  validate(createIssueSchema),
  issueController.createIssue
);

// Admin / Worker → view issues
router.get(
  "/",
  authMiddleware,
  roleMiddleware(["SYSTEM_ADMIN", "DEPT_ADMIN", "WORKER", "CITIZEN"]),
  issueController.getIssues
);

// Admin → map points
router.get(
  "/map",
  authMiddleware,
  roleMiddleware(["SYSTEM_ADMIN", "DEPT_ADMIN"]),
  issueController.getMapPoints
);

// Admin → update status
router.patch(
  "/:id/status",
  authMiddleware,
  roleMiddleware(["SYSTEM_ADMIN", "DEPT_ADMIN"]),
  issueController.updateStatus
);

// Admin → update priority
router.patch(
  "/:id/priority",
  authMiddleware,
  roleMiddleware(["SYSTEM_ADMIN", "DEPT_ADMIN"]),
  issueController.updatePriority
);

module.exports = router;
