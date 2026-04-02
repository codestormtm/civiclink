const { bucketName } = require("../config/minio");

const ATTACHMENT_ROLE_VALUES = new Set(["BEFORE", "AFTER", "GENERAL"]);

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

function normalizeAttachmentRole(role) {
  const normalizedRole = String(role || "").trim().toUpperCase();
  return ATTACHMENT_ROLE_VALUES.has(normalizedRole) ? normalizedRole : null;
}

function isImageMimeType(fileType) {
  return /^image\//i.test(String(fileType || "").trim());
}

function resolveAttachmentRole({ requestedRole, fileType, defaultImageRole = "GENERAL" } = {}) {
  if (!isImageMimeType(fileType)) {
    return "GENERAL";
  }

  const normalizedRequestedRole = normalizeAttachmentRole(requestedRole);
  if (normalizedRequestedRole) {
    return normalizedRequestedRole;
  }

  return normalizeAttachmentRole(defaultImageRole) || "GENERAL";
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").replace(/\/+$/, "");
}

function buildAttachmentViewUrl(attachmentId, { baseUrl = "", access = "protected" } = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const routePrefix = access === "public" ? "/api/public/attachments" : "/api/media/attachments";
  const relativeUrl = `${routePrefix}/${attachmentId}/view`;

  if (!normalizedBaseUrl) {
    return relativeUrl;
  }

  return `${normalizedBaseUrl}${relativeUrl}`;
}

function mapAttachmentForResponse(attachment, options = {}) {
  const objectName = extractObjectName(attachment?.file_url);

  return {
    ...attachment,
    file_url: buildAttachmentViewUrl(attachment?.id, options),
    file_object_key: objectName || null,
    attachment_role: normalizeAttachmentRole(attachment?.attachment_role) || "GENERAL",
    is_image: isImageMimeType(attachment?.file_type),
  };
}

function mapAttachmentsForResponse(attachments, options = {}) {
  return (attachments || []).map((attachment) => mapAttachmentForResponse(attachment, options));
}

module.exports = {
  ATTACHMENT_ROLE_VALUES,
  buildStoredObjectReference,
  buildAttachmentViewUrl,
  extractObjectName,
  isImageMimeType,
  mapAttachmentForResponse,
  mapAttachmentsForResponse,
  normalizeAttachmentRole,
  resolveAttachmentRole,
};
