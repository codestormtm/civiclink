const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const upload = require("../middleware/uploadMiddleware");

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/forgot-password/lookup", authController.lookupForgotPassword);
router.post(
  "/forgot-password/dept-admin-request",
  upload.single("request_letter"),
  authController.createDeptAdminPasswordResetRequest
);

module.exports = router;
