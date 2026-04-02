const KEYS = {
  ACTIVE_TAB: "citizenPortal.activeTab",
  RECENT_REFS: "citizenPortal.recentComplaintRefs",
  LAST_TRACKED_ID: "citizenPortal.lastTrackedComplaintId",
};

const VALID_TABS = new Set(["submit", "guide", "track"]);
const MAX_RECENT_REFS = 5;

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readJson(key, fallback) {
  const storage = getStorage();
  if (!storage) {
    return fallback;
  }

  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore local storage failures so the portal remains usable.
  }
}

export function getActiveCitizenTab() {
  const storage = getStorage();
  if (!storage) {
    return "submit";
  }

  const value = storage.getItem(KEYS.ACTIVE_TAB);
  return VALID_TABS.has(value) ? value : "submit";
}

export function setActiveCitizenTab(tab) {
  const storage = getStorage();
  if (!storage || !VALID_TABS.has(tab)) {
    return;
  }

  storage.setItem(KEYS.ACTIVE_TAB, tab);
}

export function getRecentComplaintRefs() {
  const storedRefs = readJson(KEYS.RECENT_REFS, []);
  if (!Array.isArray(storedRefs)) {
    return [];
  }

  return storedRefs
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .slice(0, MAX_RECENT_REFS);
}

export function addRecentComplaintRef(complaintId) {
  const normalizedId = String(complaintId || "").trim();
  if (!normalizedId) {
    return;
  }

  const nextRefs = [
    normalizedId,
    ...getRecentComplaintRefs().filter((value) => value !== normalizedId),
  ].slice(0, MAX_RECENT_REFS);

  writeJson(KEYS.RECENT_REFS, nextRefs);
}

export function removeRecentComplaintRef(complaintId) {
  const normalizedId = String(complaintId || "").trim();
  if (!normalizedId) {
    return;
  }

  const nextRefs = getRecentComplaintRefs().filter((value) => value !== normalizedId);
  writeJson(KEYS.RECENT_REFS, nextRefs);
}

export function getLastTrackedComplaintId() {
  const storage = getStorage();
  if (!storage) {
    return "";
  }

  return String(storage.getItem(KEYS.LAST_TRACKED_ID) || "").trim();
}

export function setLastTrackedComplaintId(complaintId) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const normalizedId = String(complaintId || "").trim();

  if (!normalizedId) {
    storage.removeItem(KEYS.LAST_TRACKED_ID);
    return;
  }

  storage.setItem(KEYS.LAST_TRACKED_ID, normalizedId);
}

export function rememberTrackedComplaint(complaintId) {
  const normalizedId = String(complaintId || "").trim();
  if (!normalizedId) {
    return;
  }

  addRecentComplaintRef(normalizedId);
  setLastTrackedComplaintId(normalizedId);
}

export function clearCitizenPortalState() {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  Object.values(KEYS).forEach((key) => storage.removeItem(key));
}
