const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/worker/login", authController.workerLogin);
router.get("/me", authMiddleware, authController.getCurrentSession);
router.post("/firebase/session", authController.createFirebaseSession);
router.post("/forgot-password/lookup", authController.lookupForgotPassword);
router.post(
  "/forgot-password/dept-admin-request",
  upload.single("request_letter"),
  authController.createDeptAdminPasswordResetRequest
);

module.exports = router;
