const express = require("express");
const router = express.Router();

const controller = require("../controllers/assignmentController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// ADMIN → assign task
router.post(
  "/assign",
  authMiddleware,
  roleMiddleware(["SYSTEM_ADMIN", "DEPT_ADMIN"]),
  controller.assignTask
);

// WORKER → get my tasks
router.get(
  "/my-tasks",
  authMiddleware,
  roleMiddleware(["WORKER"]),
  controller.getMyTasks
);

// WORKER → update task
router.patch(
  "/:id",
  authMiddleware,
  roleMiddleware(["WORKER"]),
  controller.updateTaskStatus
);

module.exports = router;
