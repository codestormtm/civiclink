# CivicLink Testing Report

Date: 2026-04-27

## Scope

This test pass covered:

- `backend`
- `web-public`
- `web-admin`
- `web-worker`
- `mobile/citizen`
- `mobile/worker`

The repository did not contain an existing automated unit, integration, or end-to-end test suite at the time of testing, so this report combines:

- static verification (`lint`, `build`, dependency audit)
- runtime smoke checks (backend health endpoints)
- targeted regression checks for the recent notification and authentication changes
- manual code review for accessibility, compatibility, and usability risks

## Fixes Applied During Testing

1. Added missing `socket.io-client` dependency to `web-public` so Vite can resolve the citizen notification socket client.
2. Fixed React Hook dependency issues in `web-public/src/pages/GuidedReportPage.jsx` and `web-public/src/pages/Login.jsx`.
3. Improved citizen login error precedence so Firebase auth errors are no longer masked behind generic backend session errors.
4. Prevented duplicate Enter-key submissions in the login/register form while an auth request is already in flight.
5. Updated frontend `axios` dependencies to `^1.15.0` across `web-public`, `web-admin`, and `web-worker` to reduce known audit findings.

## Functional Testing

### 1. Unit Testing

Status: Not available in the current repository.

Findings:

- No Jest, Vitest, Playwright, Cypress, or Node test runner scripts were defined.
- No checked-in `*.test.*` or `*.spec.*` files were found in the web or backend projects.
- No `test/` directory exists in either Flutter app.

Result:

- Unit testing coverage is currently missing and should be added in a future pass.

### 2. Integration Testing

Status: Partially validated with live backend health checks and cross-layer regression review.

Executed checks:

- Started backend locally with current `.env`
- Requested:
  - `GET /api/health/app`
  - `GET /api/health/db`
  - `GET /api/health/storage`

Observed result:

- Application health: passed
- Database health: passed
- Storage health: passed

Notes:

- This confirms backend integration with PostgreSQL and MinIO in the local environment.
- Notification integration was verified at code level across backend socket emission and public/admin frontend listeners, but not with a live multi-user event replay session in this pass.

### 3. System Testing

Status: Passed for browser build/runtime baseline; partially blocked for mobile.

Executed checks:

- `npm run lint` for `web-public`, `web-admin`, `web-worker`
- `npm run build` for `web-public`, `web-admin`, `web-worker`
- backend startup smoke test and health endpoint verification

Observed result:

- `web-public`: lint passed, build passed
- `web-admin`: lint passed, build passed
- `web-worker`: lint passed, build passed
- `backend`: startup and health checks passed

Mobile system test status:

- `flutter analyze` for both apps timed out repeatedly
- `flutter test` for both apps timed out repeatedly

Interpretation:

- Browser system flow is in a healthy state.
- Flutter verification could not be completed from this environment, so Android system testing remains incomplete.

### 4. Acceptance Testing (UAT)

Status: Manual UAT not fully executed in this pass.

Suggested UAT scenarios:

- Citizen registers, verifies email, signs in, submits complaint, tracks complaint
- Admin receives realtime notification for new complaint or monitoring event
- Worker receives assignment and task status updates
- Browser notification permission flow works from citizen settings
- Android WebView app receives push notifications after Firebase device registration is configured

Current blocker:

- Full Android push UAT still depends on missing Firebase configuration files and service-account values.

### 5. Regression Testing

Status: Passed for tested browser-side regressions.

Regression areas checked:

- `web-public` build after notification feature changes
- citizen socket import resolution
- login form behavior after error-handling updates
- lint re-run after hook dependency fixes

Observed result:

- No browser build regressions introduced by the recent notification work
- No remaining lint warnings in `web-public`

## Non-Functional Testing

### Performance Testing

Status: Basic build-time indicators reviewed; no load test suite executed.

Findings:

- All three web apps build successfully.
- `web-public` main bundle is about `637 kB` minified.
- `web-admin` main bundle is about `530 kB` minified.
- `web-worker` main bundle is about `353 kB` minified.
- Vite warns that `web-public` and `web-admin` exceed the 500 kB chunk warning threshold.

Risk:

- Initial load performance may degrade on slower networks or lower-end mobile devices.

Recommendation:

- Add route-level code splitting for the citizen and admin portals.

### Security Testing

Status: Dependency audit and configuration review completed.

Executed checks:

- `npm audit --omit=dev --json` for `backend`
- `npm audit --omit=dev --json` for `web-public`
- `npm audit --omit=dev --json` for `web-admin`
- `npm audit --omit=dev --json` for `web-worker`

Resolved during this pass:

- Upgraded frontend `axios` dependency to reduce direct portal-side advisories.

Remaining findings:

- `web-public`: 1 moderate + 1 critical advisory remain, mainly from transitive `follow-redirects` and `protobufjs` in the Firebase dependency chain.
- `web-admin`: 1 moderate advisory remains from `follow-redirects`.
- `web-worker`: 1 moderate advisory remains from `follow-redirects`.
- `backend`: 14 advisories remain in the current dependency tree, including 1 critical and 2 high severity items, largely in transitive dependencies under `firebase-admin` and other libraries.

Configuration risks observed:

- Development secrets are stored directly in `backend/.env`.
- Mobile push notifications still require Firebase Admin service-account fields and Android `google-services.json` files.

### Usability Testing

Status: Basic manual review completed.

Positive findings:

- Citizen notification settings now expose browser notification permission state clearly.
- Citizen toast notifications provide both dismiss and open-complaint actions.
- Preventing duplicate Enter submissions reduces confusing repeated auth requests.

Open usability gap:

- End-to-end manual task walkthroughs for citizen, admin, and worker roles should still be performed with live users or scripted UAT.

### Compatibility Testing

Status: Partially validated.

Validated:

- All three browser portals compile successfully in production mode.
- Socket client dependency issue in the public portal was fixed.

Not fully validated:

- Cross-browser matrix testing was not executed.
- Android runtime verification was blocked by Flutter tooling timeouts in this environment.

### Accessibility Testing

Status: Basic code review completed, but no dedicated audit tool was run.

Positive findings:

- Notification dismiss button in `CitizenToast` includes `aria-label`.
- Buttons in settings and auth flows use semantic button elements.

Remaining gap:

- No automated accessibility scan with Lighthouse, axe, or Playwright accessibility checks was executed in this pass.

## Final Status Summary

Passed:

- Frontend linting for all three web apps
- Frontend production builds for all three web apps
- Backend application, database, and storage health checks
- Browser-side regression verification for the notification setup and login fixes

Fixed during testing:

- Missing public portal socket dependency
- React Hook dependency issues
- Misleading Firebase error handling precedence
- Duplicate auth submission on Enter
- Outdated direct frontend `axios` version

Still incomplete or blocked:

- Automated unit test coverage
- Automated integration/end-to-end test suite
- Flutter analyze/test execution
- Full Android notification UAT
- Remaining dependency advisories, especially backend/Firebase transitive issues

## Recommended Next Steps

1. Add an automated test baseline:
   - backend smoke tests with Node test runner or Supertest
   - component tests for the public portal
   - role-based end-to-end flows with Playwright
2. Resolve remaining dependency advisories, starting with Firebase-related transitive packages and `follow-redirects`.
3. Complete Android notification setup by adding:
   - backend Firebase Admin service-account variables
   - `google-services.json` for both Flutter apps
4. Run manual UAT across citizen, admin, and worker roles with two browsers and at least one Android device.
