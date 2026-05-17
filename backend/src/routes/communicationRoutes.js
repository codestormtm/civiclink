const express = require("express");
const router = express.Router();

const controller = require("../controllers/communicationController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(authMiddleware, roleMiddleware(["SYSTEM_ADMIN", "DEPT_ADMIN", "WORKER"]));

router.get("/conversations", controller.listConversations);
router.post("/conversations", controller.upsertConversation);
router.post("/direct-conversations", controller.upsertDirectConversation);

module.exports = router;
