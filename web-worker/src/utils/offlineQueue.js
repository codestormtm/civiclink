import api from "../api/api";

const QUEUE_KEY = "civiclink_worker_offline_queue_v1";

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `queued-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function dataUrlToFile(dataUrl, fileName, fileType) {
  const [meta, payload] = dataUrl.split(",");
  const mime = fileType || meta.match(/data:(.*);base64/)?.[1] || "application/octet-stream";
  const binary = atob(payload || "");
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], fileName || "queued-evidence", { type: mime });
}

export function getWorkerQueueSnapshot() {
  const queue = readQueue();
  return {
    pending: queue.length,
    hasPending: queue.length > 0,
    isOnline: isOnline(),
    items: queue,
  };
}

export function queueStatusUpdate({ taskId, status, note }) {
  const queue = readQueue();
  queue.push({
    id: makeId(),
    type: "status",
    taskId,
    status,
    note: note || "",
    createdAt: new Date().toISOString(),
  });
  writeQueue(queue);
  return getWorkerQueueSnapshot();
}

export async function queueEvidenceUpload({ taskId, file, attachmentRole }) {
  const queue = readQueue();
  const dataUrl = await fileToDataUrl(file);

  queue.push({
    id: makeId(),
    type: "evidence",
    taskId,
    attachmentRole,
    fileName: file.name,
    fileType: file.type,
    dataUrl,
    createdAt: new Date().toISOString(),
  });

  writeQueue(queue);
  return getWorkerQueueSnapshot();
}

async function replayItem(item) {
  if (item.type === "status") {
    await api.patch(`/worker/assignments/${item.taskId}/status`, {
      status: item.status,
      note: item.note,
    });
    return;
  }

  if (item.type === "evidence") {
    const formData = new FormData();
    formData.append("file", dataUrlToFile(item.dataUrl, item.fileName, item.fileType));
    formData.append("attachment_role", item.attachmentRole || "AFTER");
    await api.post(`/worker/assignments/${item.taskId}/attachments`, formData);
  }
}

export async function flushWorkerQueue() {
  if (!isOnline()) {
    return getWorkerQueueSnapshot();
  }

  const queue = readQueue();
  const remaining = [];

  for (const item of queue) {
    try {
      await replayItem(item);
    } catch {
      remaining.push(item);
    }
  }

  writeQueue(remaining);
  return getWorkerQueueSnapshot();
}
