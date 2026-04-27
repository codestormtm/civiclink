import { getName, getRole, getToken } from "./auth";

function postToFlutter(payload) {
  const bridge = window.CivicLinkMobile;

  if (!bridge || typeof bridge.postMessage !== "function") {
    return false;
  }

  bridge.postMessage(JSON.stringify(payload));
  return true;
}

export function hasCitizenMobileBridge() {
  return Boolean(window.CivicLinkMobile && typeof window.CivicLinkMobile.postMessage === "function");
}

export function postCitizenMobileSession(extra = {}) {
  return postToFlutter({
    type: "session",
    app: "citizen",
    token: getToken(),
    role: getRole(),
    name: getName(),
    ...extra,
  });
}

export function postCitizenMobileLogout() {
  return postToFlutter({
    type: "logout",
    app: "citizen",
  });
}

export function requestCitizenMobileGoogleSignIn(extra = {}) {
  return postToFlutter({
    type: "googleSignIn",
    app: "citizen",
    ...extra,
  });
}
