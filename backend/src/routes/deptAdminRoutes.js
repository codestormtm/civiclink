const express = require("express");
const router = express.Router();
const controller = require("../controllers/deptAdminController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware, roleMiddleware(["DEPT_ADMIN"]));

router.post("/change-password", controller.changePassword);
router.get("/summary",     controller.getSummary);
router.get("/complaints",  controller.getFilteredComplaints);
router.get("/workload",    controller.getWorkerWorkload);
router.get("/performance", controller.getPerformanceReport);

module.exports = router;
