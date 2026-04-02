const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");
const createRateLimit = require("../middleware/rateLimitMiddleware");

const loginRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: "auth-login",
});

const recoveryRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyPrefix: "auth-recovery",
});

const requestLetterUpload = upload.createUpload({
  maxFiles: 1,
  allowedMimeTypesByField: {
    request_letter: [...upload.IMAGE_MIME_TYPES, ...upload.PDF_MIME_TYPES],
  },
});

router.post("/register", loginRateLimit, authController.register);
router.post("/login", loginRateLimit, authController.login);
router.post("/worker/login", loginRateLimit, authController.workerLogin);
router.get("/me", authMiddleware, authController.getCurrentSession);
router.post("/firebase/session", loginRateLimit, authController.createFirebaseSession);
router.post("/forgot-password/lookup", recoveryRateLimit, authController.lookupForgotPassword);
router.post(
  "/forgot-password/dept-admin-request",
  recoveryRateLimit,
  requestLetterUpload.single("request_letter"),
  authController.createDeptAdminPasswordResetRequest
);

module.exports = router;
