const { minioPublicClient, bucketName } = require("../config/minio");

const PRESIGNED_URL_EXPIRY_SECONDS = 60 * 60;

function buildStoredObjectReference(objectName) {
  return String(objectName || "").trim();
}

function extractObjectName(fileReference) {
  const normalizedReference = String(fileReference || "").trim();

  if (!normalizedReference) {
    return "";
  }

  if (/^https?:\/\//i.test(normalizedReference)) {
    try {
      const parsedUrl = new URL(normalizedReference);
      const pathnameParts = parsedUrl.pathname.split("/").filter(Boolean);
      const bucketIndex = pathnameParts.indexOf(bucketName);

      if (bucketIndex === -1 || bucketIndex === pathnameParts.length - 1) {
        return "";
      }

      return pathnameParts.slice(bucketIndex + 1).join("/");
    } catch {
      return "";
    }
  }

  if (normalizedReference.startsWith(`${bucketName}/`)) {
    return normalizedReference.slice(bucketName.length + 1);
  }

  return normalizedReference;
}

async function createAttachmentDownloadUrl(fileReference) {
  const objectName = extractObjectName(fileReference);

  if (!objectName) {
    return String(fileReference || "");
  }

  try {
    return await minioPublicClient.presignedGetObject(
      bucketName,
      objectName,
      PRESIGNED_URL_EXPIRY_SECONDS
    );
  } catch {
    return String(fileReference || "");
  }
}

async function mapAttachmentForResponse(attachment) {
  const objectName = extractObjectName(attachment?.file_url);
  const downloadUrl = await createAttachmentDownloadUrl(attachment?.file_url);

  return {
    ...attachment,
    file_url: downloadUrl,
    file_object_key: objectName || null,
  };
}

async function mapAttachmentsForResponse(attachments) {
  return Promise.all((attachments || []).map(mapAttachmentForResponse));
}

module.exports = {
  buildStoredObjectReference,
  createAttachmentDownloadUrl,
  extractObjectName,
  mapAttachmentForResponse,
  mapAttachmentsForResponse,
};
