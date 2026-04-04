import { createContext, createElement, useContext, useMemo } from "react";

export const CITIZEN_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "si", label: "සිංහල" },
  { code: "ta", label: "தமிழ்" },
];

const DEFAULT_LANGUAGE = "en";

const LOCALE_BY_LANGUAGE = {
  en: "en-LK",
  si: "si-LK",
  ta: "ta-LK",
};

const translations = {
  en: {
    "language.english": "English",
    "language.sinhala": "සිංහල",
    "language.tamil": "தமிழ்",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.close": "Close",
    "common.loading": "Loading...",
    "common.optional": "optional",
    "common.notProvided": "Not provided",
    "common.copy": "Copy",
    "common.copied": "Copied",
    "common.searching": "Searching...",
    "common.download": "Download",
    "common.downloading": "Downloading...",
    "portal.brand": "CivicLink",
    "portal.citizen": "Citizen Portal",
    "auth.signIn": "Sign In",
    "auth.createAccount": "Create Account",
    "auth.govTitle": "Government of Sri Lanka - CivicLink",
    "auth.email": "Email address",
    "auth.password": "Password",
    "auth.fullName": "Full name",
    "auth.createPassword": "Create a password",
    "auth.preferredLanguage": "Preferred language",
    "auth.forgotPassword": "Forgot password?",
    "auth.continueGoogle": "Continue with Google",
    "auth.googleHelp": "Google users can continue immediately. Email/password users must verify their email first.",
    "auth.registerHelp": "We will send a verification email before your complaint portal access is activated.",
    "auth.verificationRequired": "Email verification required",
    "auth.verificationCopy": "Verify {email} before CivicLink creates your citizen session.",
    "auth.resendVerification": "Resend verification email",
    "auth.sendingVerification": "Sending verification...",
    "auth.error.loginRequired": "Enter your email and password.",
    "auth.error.registerRequired": "Enter your full name, email, password, and preferred language.",
    "auth.error.firebase": "Firebase login is not configured.",
    "auth.error.backend": "Unable to create a CivicLink session. Check that the backend is running and Firebase Admin is configured.",
    "auth.error.backendOffline": "CivicLink backend is not reachable at {url}. Start the backend service and try again.",
    "auth.error.google": "Unable to sign in with Google.",
    "auth.error.emailPassword": "Unable to sign in with email and password.",
    "auth.error.register": "Unable to create your account.",
    "auth.error.reset": "Unable to send the password reset email.",
    "auth.error.verification": "Unable to resend the verification email.",
    "auth.error.resetEmail": "Enter your email address first.",
    "auth.error.reauth": "Sign in again with your email and password to resend verification.",
    "auth.success.reset": "Password reset email sent. Check your inbox for the reset link.",
    "auth.success.verifySent": "Verification email sent. Verify your address, then sign in to continue.",
    "auth.success.verifyResent": "Verification email sent again. Check your inbox and spam folder.",
    "auth.success.google": "Connecting Google...",
    "auth.success.registering": "Creating account...",
    "auth.success.signedIn": "Signed in successfully. You can now submit and track complaints.",
    "auth.success.signingIn": "Signing in...",
    "auth.terms": "By continuing you agree to the Terms of Service",
    "layout.submit": "Submit Complaint",
    "layout.guide": "AI Assistant",
    "layout.track": "Track Complaint",
    "layout.settings": "Settings",
    "layout.logout": "Logout",
    "layout.loggingOut": "Logging out...",
    "layout.openMenu": "Open navigation menu",
    "layout.closeMenu": "Close navigation menu",
    "setup.title": "Choose your app language",
    "setup.subtitle": "Save your preferred language once. CivicLink will open in this language whenever you sign in.",
    "setup.continue": "Continue",
    "setup.error": "Choose a language to continue.",
    "settings.title": "Language settings",
    "settings.subtitle": "Your preferred language is saved to your CivicLink account.",
    "settings.save": "Save preference",
    "settings.saved": "Language preference saved.",
    "settings.error": "Unable to save your language preference.",
    "settings.saving": "Saving...",
    "complaint.heading": "Submit a Complaint",
    "complaint.subtitle": "Report a public issue to the relevant government department.",
    "complaint.aiTitle": "Prefer guided reporting?",
    "complaint.aiCopy": "Open the AI assistant if you want help turning your description into a ready-to-submit complaint.",
    "complaint.aiButton": "Report with AI",
    "complaint.department": "Department",
    "complaint.type": "Complaint Type",
    "complaint.title": "Title",
    "complaint.description": "Description",
    "complaint.selectDepartment": "Select Department",
    "complaint.selectType": "Select Complaint Type",
    "complaint.titlePlaceholder": "Brief title of your complaint",
    "complaint.descriptionPlaceholder": "Describe the complaint in detail",
    "complaint.location": "Location",
    "complaint.useLocation": "Use My Location",
    "complaint.pinMap": "Pin on Map",
    "complaint.hideMap": "Hide Map",
    "complaint.clear": "Clear",
    "complaint.selected": "Selected",
    "complaint.mapHint": "Click anywhere on the map to set the complaint location",
    "complaint.supporting": "Supporting Document / Photo",
    "complaint.submit": "Submit Complaint",
    "complaint.submitting": "Submitting...",
    "complaint.error.departments": "Failed to load departments",
    "complaint.error.types": "Failed to load complaint types",
    "complaint.error.submit": "Failed to submit complaint",
    "complaint.error.geolocation": "Geolocation is not supported by your browser",
    "complaint.error.location": "Unable to get your location. Please pin it on the map.",
    "complaint.warning.attachment": "Your complaint was submitted, but the attachment could not be uploaded. Please keep the tracking ID and retry with a fresh report if the image is important.",
    "guided.title": "AI Complaint Assistant",
    "guided.subtitle": "Tell me what happened. I will help prepare the complaint and collect the right location.",
    "guided.starting": "Starting AI assistant...",
    "guided.progress.department": "department",
    "guided.progress.type": "complaint type",
    "guided.progress.description": "description",
    "guided.progress.location": "location",
    "guided.review": "Review and Submit",
    "guided.error.start": "Failed to start session. Please try again.",
    "guided.error.reply": "Sorry, I encountered an error. Please try again.",
    "guided.error.submit": "Submission failed. Please try again.",
    "guided.warning.attachment": "Your complaint was submitted, but the evidence image could not be uploaded. Please keep the tracking ID and retry with a fresh report if the photo is essential.",
    "guided.successTitle": "AI complaint submitted",
    "guided.successDescription": "Your complaint has been received and will be reviewed by the relevant department.",
    "chat.input": "Type your message... (Enter to send)",
    "chat.send": "Send message",
    "chat.locationHint": "The assistant is waiting for you to confirm the complaint location on the map above.",
    "location.title": "Drop a pin where the complaint happened",
    "location.kicker": "Location needed",
    "location.copy": "Use your current GPS location or tap directly on the map. The selected address stays visible until you confirm it.",
    "location.useLocation": "Use My Location",
    "location.clear": "Clear",
    "location.helper": "Tap or click the map to place the marker.",
    "location.status": "Getting address...",
    "location.empty": "No location selected yet. Pick a point on the map or use your current location.",
    "location.selected": "Selected location",
    "location.confirm": "Confirm Location",
    "location.error.unsupported": "Geolocation not supported",
    "location.error.failed": "Unable to get location. Please pin it on the map.",
    "preview.title": "Complaint Summary",
    "preview.subtitle": "Review before submitting",
    "preview.edit": "Edit Details",
    "preview.cancelEdit": "Cancel Edit",
    "preview.titleField": "Title",
    "preview.descriptionField": "Description",
    "preview.locationField": "Location",
    "preview.evidence": "Optional evidence image",
    "preview.choosePhoto": "Choose photo",
    "preview.replacePhoto": "Replace photo",
    "preview.photoCopy": "Attach one optional photo to send along with this AI-generated complaint.",
    "preview.selectedFile": "Selected: {name}",
    "preview.continueChat": "Continue Chat",
    "success.title": "Complaint submitted",
    "success.description": "Your complaint has been recorded and sent to the relevant department.",
    "success.trackingId": "Tracking ID",
    "success.copyId": "Copy ID",
    "success.track": "Track Status",
    "success.submittedAs": "Submitted as",
    "success.reset": "Report Another Complaint",
    "track.heading": "Track Your Complaint",
    "track.subtitle": "Enter your complaint ID to view its current status and history.",
    "track.placeholder": "Paste your complaint ID here",
    "track.button": "Track",
    "track.recent": "Recent complaint IDs",
    "track.status": "Complaint status",
    "track.summaryId": "Complaint ID",
    "track.summaryDepartment": "Department",
    "track.summaryType": "Type",
    "track.summaryDescription": "Description",
    "track.summarySubmitted": "Submitted",
    "track.summaryResolved": "Resolved",
    "track.summaryRejection": "Rejection Reason",
    "track.timeline": "Complaint Timeline",
    "track.imageGallery": "Image Gallery",
    "track.otherAttachments": "Other Attachments",
    "track.imageEmpty": "No image attachments uploaded.",
    "track.fileEmpty": "No non-image attachments uploaded.",
    "track.notFound": "Complaint not found. Please check your ID.",
    "track.downloadFailed": "Failed to download attachment.",
    "status.submitted": "Submitted",
    "status.assigned": "Assigned",
    "status.inProgress": "In Progress",
    "status.resolved": "Resolved",
    "status.closed": "Closed",
    "status.rejected": "Rejected",
    "status.desc.submitted": "Your complaint has been received and is awaiting review.",
    "status.desc.assigned": "A field worker has been assigned to your complaint.",
    "status.desc.inProgress": "Work is currently underway on your complaint.",
    "status.desc.resolved": "Your complaint has been resolved. Thank you.",
    "status.desc.closed": "This complaint has been closed.",
    "status.desc.rejected": "This complaint was redirected or rejected. See timeline for details.",
    "attachment.before": "Before",
    "attachment.after": "After",
    "attachment.general": "General",
    "attachment.unknownType": "Unknown file type",
  },
  si: {
    "language.sinhala": "සිංහල",
    "language.tamil": "தமிழ்",
    "auth.signIn": "පිවිසෙන්න",
    "auth.createAccount": "ගිණුම සාදන්න",
    "auth.preferredLanguage": "කැමති භාෂාව",
    "auth.success.signedIn": "පිවිසීම සාර්ථකයි. දැන් ඔබට පැමිණිලි යොමු කර තත්ත්වය බලන්න පුළුවන්.",
    "layout.submit": "පැමිණිල්ල යොමු කරන්න",
    "layout.guide": "AI සහායකයා",
    "layout.track": "පැමිණිල්ල සොයන්න",
    "layout.settings": "සැකසුම්",
    "layout.logout": "ඉවත් වන්න",
    "setup.title": "යෙදුම් භාෂාව තෝරන්න",
    "setup.subtitle": "ඔබගේ කැමති භාෂාව එක් වරක් සුරකින්න. සෑම පිවිසුමකදීම එය භාවිතා වේ.",
    "settings.title": "භාෂා සැකසුම්",
    "complaint.heading": "පැමිණිල්ලක් යොමු කරන්න",
    "complaint.subtitle": "අදාළ රජයේ දෙපාර්තමේන්තුවට පොදු ගැටළුවක් දන්වන්න.",
    "guided.title": "AI පැමිණිලි සහායකයා",
    "track.heading": "ඔබගේ පැමිණිල්ල සොයන්න",
    "track.subtitle": "වත්මන් තත්ත්වය සහ ඉතිහාසය බැලීමට පැමිණිලි අංකය ඇතුළත් කරන්න.",
    "success.title": "පැමිණිල්ල යොමු කරන ලදී",
    "success.track": "තත්ත්වය බලන්න",
    "success.reset": "නව පැමිණිල්ලක් යොමු කරන්න",
    "status.submitted": "යොමු කරන ලදී",
    "status.assigned": "පවරා ඇත",
    "status.inProgress": "ක්‍රියාත්මකයි",
    "status.resolved": "විසඳා ඇත",
    "status.closed": "වසා ඇත",
    "status.rejected": "ප්‍රතික්ෂේපිතයි",
  },
  ta: {
    "language.sinhala": "සිංහල",
    "language.tamil": "தமிழ்",
    "auth.signIn": "உள்நுழை",
    "auth.createAccount": "கணக்கு உருவாக்கு",
    "auth.preferredLanguage": "விருப்ப மொழி",
    "auth.success.signedIn": "உள்நுழைவு வெற்றிகரமாக முடிந்தது. இப்போது புகார்களைச் சமர்ப்பித்து கண்காணிக்கலாம்.",
    "layout.submit": "புகார் சமர்ப்பி",
    "layout.guide": "AI உதவியாளர்",
    "layout.track": "புகாரை கண்காணி",
    "layout.settings": "அமைப்புகள்",
    "layout.logout": "வெளியேறு",
    "setup.title": "பயன்பாட்டு மொழியைத் தேர்வுசெய்க",
    "setup.subtitle": "உங்கள் விருப்ப மொழியை ஒருமுறை சேமிக்கவும். ஒவ்வொரு உள்நுழைவிலும் அது பயன்படுத்தப்படும்.",
    "settings.title": "மொழி அமைப்புகள்",
    "complaint.heading": "ஒரு புகாரை சமர்ப்பிக்கவும்",
    "complaint.subtitle": "தொடர்புடைய அரசுத் துறைக்கு பொது பிரச்சினையை தெரிவிக்கவும்.",
    "guided.title": "AI புகார் உதவியாளர்",
    "track.heading": "உங்கள் புகாரை கண்காணிக்கவும்",
    "track.subtitle": "தற்போதைய நிலையும் வரலாறும் பார்க்க உங்கள் புகார் எண்ணை உள்ளிடவும்.",
    "success.title": "புகார் சமர்ப்பிக்கப்பட்டது",
    "success.track": "நிலையை கண்காணி",
    "success.reset": "மற்றொரு புகார் சமர்ப்பி",
    "status.submitted": "சமர்ப்பிக்கப்பட்டது",
    "status.assigned": "ஒதுக்கப்பட்டது",
    "status.inProgress": "செயல்பாட்டில்",
    "status.resolved": "தீர்க்கப்பட்டது",
    "status.closed": "மூடப்பட்டது",
    "status.rejected": "நிராகரிக்கப்பட்டது",
  },
};

function normalizeLanguage(language) {
  return CITIZEN_LANGUAGES.some((item) => item.code === language) ? language : DEFAULT_LANGUAGE;
}

function interpolate(template, params) {
  return template.replace(/\{(\w+)\}/g, (_match, key) => String(params?.[key] ?? ""));
}

export function translate(language, key, params) {
  const normalizedLanguage = normalizeLanguage(language);
  const catalog = translations[normalizedLanguage] || translations.en;
  const value = catalog[key] ?? translations.en[key] ?? key;
  return interpolate(String(value), params);
}

export function formatDateTime(language, value, options = {}) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(LOCALE_BY_LANGUAGE[normalizeLanguage(language)], {
    dateStyle: "medium",
    timeStyle: "short",
    ...options,
  }).format(new Date(value));
}

export function formatStatusLabel(language, status) {
  switch (status) {
    case "SUBMITTED":
      return translate(language, "status.submitted");
    case "ASSIGNED":
      return translate(language, "status.assigned");
    case "IN_PROGRESS":
      return translate(language, "status.inProgress");
    case "RESOLVED":
      return translate(language, "status.resolved");
    case "CLOSED":
      return translate(language, "status.closed");
    case "REJECTED_WRONG_DEPARTMENT":
      return translate(language, "status.rejected");
    default:
      return status ? status.replace(/_/g, " ") : translate(language, "common.notProvided");
  }
}

const CitizenI18nContext = createContext({
  language: DEFAULT_LANGUAGE,
  t: (key, params) => translate(DEFAULT_LANGUAGE, key, params),
  formatDateTime: (value, options) => formatDateTime(DEFAULT_LANGUAGE, value, options),
  formatStatusLabel: (status) => formatStatusLabel(DEFAULT_LANGUAGE, status),
});

export function CitizenI18nProvider({ language, children }) {
  const normalizedLanguage = normalizeLanguage(language);

  const value = useMemo(() => ({
    language: normalizedLanguage,
    t: (key, params) => translate(normalizedLanguage, key, params),
    formatDateTime: (dateValue, options) => formatDateTime(normalizedLanguage, dateValue, options),
    formatStatusLabel: (status) => formatStatusLabel(normalizedLanguage, status),
  }), [normalizedLanguage]);

  return createElement(CitizenI18nContext.Provider, { value }, children);
}

export function useCitizenI18n() {
  return useContext(CitizenI18nContext);
}
