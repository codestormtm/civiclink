const DB_NAME = "civiclink_communication_v1";
const DB_VERSION = 1;
const MESSAGE_STORE = "messages";
const KEY_STORE = "keys";

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MESSAGE_STORE)) {
        const store = db.createObjectStore(MESSAGE_STORE, { keyPath: "client_message_id" });
        store.createIndex("conversation_id", "conversation_id", { unique: false });
      }
      if (!db.objectStoreNames.contains(KEY_STORE)) {
        db.createObjectStore(KEY_STORE, { keyPath: "conversation_id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txStore(db, storeName, mode) {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function decodeJwtUserId(token) {
  try {
    return JSON.parse(atob(String(token || "").split(".")[1]))?.id || "";
  } catch {
    return "";
  }
}

export function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

export function base64ToBytes(base64) {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

export async function saveMessage(message) {
  const db = await openDb();
  await requestToPromise(txStore(db, MESSAGE_STORE, "readwrite").put(message));
  db.close();
}

export async function updateMessageStatus(clientMessageId, status) {
  const db = await openDb();
  const store = txStore(db, MESSAGE_STORE, "readwrite");
  const row = await requestToPromise(store.get(clientMessageId));

  if (row) {
    await requestToPromise(store.put({ ...row, status }));
  }

  db.close();
}

export async function getMessages(conversationId) {
  const db = await openDb();
  const index = txStore(db, MESSAGE_STORE, "readonly").index("conversation_id");
  const rows = await requestToPromise(index.getAll(conversationId));
  db.close();
  return rows.sort((left, right) => new Date(left.sent_at) - new Date(right.sent_at));
}

export async function saveConversationKey(conversationId, key) {
  const raw = await crypto.subtle.exportKey("raw", key);
  const db = await openDb();
  await requestToPromise(txStore(db, KEY_STORE, "readwrite").put({
    conversation_id: conversationId,
    raw_key: bytesToBase64(raw),
    saved_at: new Date().toISOString(),
  }));
  db.close();
}

export async function getConversationKey(conversationId) {
  const db = await openDb();
  const row = await requestToPromise(txStore(db, KEY_STORE, "readonly").get(conversationId));
  db.close();

  if (!row?.raw_key) {
    return null;
  }

  return crypto.subtle.importKey(
    "raw",
    base64ToBytes(row.raw_key),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function deriveLocalConversationKey(conversation) {
  const seed = [
    "civiclink-conversation-v1",
    conversation?.id || "",
    conversation?.assignment_id || "",
    conversation?.complaint_id || "",
    conversation?.admin_user_id || "",
    conversation?.worker_user_id || "",
    conversation?.conversation_type || "",
    conversation?.local_call_number || "",
  ].join("|");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));

  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"],
  );
}

export async function encryptText(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return {
    ciphertext: bytesToBase64(ciphertext),
    iv: bytesToBase64(iv),
  };
}

export async function decryptText(key, ciphertext, iv) {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(iv) },
    key,
    base64ToBytes(ciphertext),
  );
  return new TextDecoder().decode(decrypted);
}

export async function createKeyPair() {
  return crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey"],
  );
}

export async function exportPublicKey(keyPair) {
  const raw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  return bytesToBase64(raw);
}

export async function deriveConversationKey(privateKey, remotePublicKeyBase64) {
  const remotePublicKey = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(remotePublicKeyBase64),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  return crypto.subtle.deriveKey(
    { name: "ECDH", public: remotePublicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

async function deriveBackupKey(passphrase, salt) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function exportEncryptedBackup(passphrase) {
  const db = await openDb();
  const messages = await requestToPromise(txStore(db, MESSAGE_STORE, "readonly").getAll());
  const keys = await requestToPromise(txStore(db, KEY_STORE, "readonly").getAll());
  db.close();

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const backupKey = await deriveBackupKey(passphrase, salt);
  const payload = new TextEncoder().encode(JSON.stringify({ messages, keys }));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, backupKey, payload);

  return JSON.stringify({
    version: 1,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(encrypted),
  }, null, 2);
}

export async function importEncryptedBackup(passphrase, backupText) {
  const backup = JSON.parse(backupText);
  const salt = base64ToBytes(backup.salt);
  const iv = base64ToBytes(backup.iv);
  const backupKey = await deriveBackupKey(passphrase, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    backupKey,
    base64ToBytes(backup.ciphertext),
  );
  const payload = JSON.parse(new TextDecoder().decode(decrypted));
  const db = await openDb();
  const messageStore = txStore(db, MESSAGE_STORE, "readwrite");
  const keyStore = txStore(db, KEY_STORE, "readwrite");

  await Promise.all((payload.messages || []).map((message) => requestToPromise(messageStore.put(message))));
  await Promise.all((payload.keys || []).map((key) => requestToPromise(keyStore.put(key))));
  db.close();
}
