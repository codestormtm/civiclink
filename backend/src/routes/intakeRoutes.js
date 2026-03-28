const express = require("express");
const router = express.Router();
const controller = require("../controllers/intakeController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.post("/start", controller.startSession);
router.post("/:sessionToken/message", controller.sendMessage);
router.get("/:sessionToken", controller.getSession);
router.post("/:sessionToken/submit", controller.submitSession);

module.exports = router;
