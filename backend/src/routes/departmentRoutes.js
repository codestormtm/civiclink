const express = require("express");
const router = express.Router();

const controller = require("../controllers/departmentController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.post(
  "/",
  authMiddleware,
  roleMiddleware(["SYSTEM_ADMIN"]),
  controller.createDepartment
);

router.get(
  "/",
  authMiddleware,
  controller.getDepartments
);

router.get(
  "/:departmentId/issue-types",
  authMiddleware,
  controller.getDepartmentIssueTypes
);

router.post(
  "/:departmentId/issue-types",
  authMiddleware,
  roleMiddleware(["SYSTEM_ADMIN"]),
  controller.createDepartmentIssueType
);

router.patch(
  "/:departmentId",
  authMiddleware,
  roleMiddleware(["SYSTEM_ADMIN"]),
  controller.updateDepartment
);

module.exports = router;
