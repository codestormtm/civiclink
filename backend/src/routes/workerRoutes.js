const express = require("express");
const router = express.Router();

const controller = require("../controllers/workerController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const upload = require("../middleware/uploadMiddleware");
const workerDocumentUpload = upload.createUpload({
  maxFiles: 2,
  allowedMimeTypesByField: {
    profile_picture: [...upload.IMAGE_MIME_TYPES],
    nic_copy: [...upload.IMAGE_MIME_TYPES, ...upload.PDF_MIME_TYPES],
  },
});

router.get(
  "/",
  authMiddleware,
  roleMiddleware(["SYSTEM_ADMIN", "DEPT_ADMIN"]),
  controller.getWorkers
);

router.post(
  "/",
  authMiddleware,
  roleMiddleware(["DEPT_ADMIN"]),
  workerDocumentUpload.fields([
    { name: "profile_picture", maxCount: 1 },
    { name: "nic_copy", maxCount: 1 },
  ]),
  controller.createWorker
);

router.patch(
  "/:id",
  authMiddleware,
  roleMiddleware(["DEPT_ADMIN"]),
  controller.updateWorker
);

router.post(
  "/:id/remove",
  authMiddleware,
  roleMiddleware(["DEPT_ADMIN"]),
  controller.removeWorker
);

module.exports = router;
