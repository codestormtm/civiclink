import { getDepartment, getName, getRole, getToken } from "./auth";

function postToFlutter(payload) {
  const bridge = window.CivicLinkMobile;

  if (!bridge || typeof bridge.postMessage !== "function") {
    return;
  }

  bridge.postMessage(JSON.stringify(payload));
}

export function postWorkerMobileSession(extra = {}) {
  postToFlutter({
    type: "session",
    app: "worker",
    token: getToken(),
    role: getRole(),
    name: getName(),
    department_name: getDepartment(),
    ...extra,
  });
}

export function postWorkerMobileLogout() {
  postToFlutter({
    type: "logout",
    app: "worker",
  });
}
