const express = require("express");
const mobileController = require("../controllers/mobileController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/device-tokens", authMiddleware, mobileController.registerDeviceToken);
router.delete("/device-tokens", authMiddleware, mobileController.revokeDeviceToken);

module.exports = router;
