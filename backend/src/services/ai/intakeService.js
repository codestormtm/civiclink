const Groq = require("groq-sdk");
const { pool } = require("../../config/db");
const AppError = require("../../utils/appError");
const logger = require("../../utils/logger");

let groqClient = null;
let groqInitFailed = false;

const GREETINGS = {
  en: "Hello! I'm your CivicLink AI assistant \uD83D\uDC4B I'm here to help you report a civic complaint to the right government department - no forms, just tell me what's happening. What problem would you like to report today?",
  ta: "\u0BB5\u0BA3\u0B95\u0BCD\u0B95\u0BAE\u0BCD! \u0BA8\u0BBE\u0BA9\u0BCD \u0B89\u0B99\u0BCD\u0B95\u0BB3\u0BCD CivicLink AI \u0B89\u0BA4\u0BB5\u0BBF\u0BAF\u0BBE\u0BB3\u0BB0\u0BCD \uD83D\uDC4B \u0B9A\u0BB0\u0BBF\u0BAF\u0BBE\u0BA9 \u0B85\u0BB0\u0B9A\u0BC1 \u0BA4\u0BC1\u0BB1\u0BC8\u0B95\u0BCD\u0B95\u0BC1 \u0B95\u0BC1\u0B9F\u0BBF\u0BAE\u0B95\u0BCD\u0B95\u0BB3\u0BCD \u0BAA\u0BC1\u0B95\u0BBE\u0BB0\u0BC8 \u0BAA\u0BA4\u0BBF\u0BB5\u0BC1 \u0B9A\u0BC6\u0BAF\u0BCD\u0BAF \u0B89\u0B99\u0BCD\u0B95\u0BB3\u0BC1\u0B95\u0BCD\u0B95\u0BC1 \u0B89\u0BA4\u0BB5 \u0B87\u0B99\u0BCD\u0B95\u0BC7 \u0B87\u0BB0\u0BC1\u0B95\u0BCD\u0B95\u0BBF\u0BB1\u0BC7\u0BA9\u0BCD - \u0BAA\u0B9F\u0BBF\u0BB5\u0B99\u0BCD\u0B95\u0BB3\u0BCD \u0B87\u0BB2\u0BCD\u0BB2\u0BC8, \u0B8E\u0BA9\u0BCD\u0BA9 \u0BA8\u0B9F\u0B95\u0BCD\u0B95\u0BBF\u0BB1\u0BA4\u0BC1 \u0B8E\u0BA9\u0BCD\u0BB1\u0BC1 \u0B9A\u0BCA\u0BB2\u0BCD\u0BB2\u0BC1\u0B99\u0BCD\u0B95\u0BB3\u0BCD. \u0B87\u0BA9\u0BCD\u0BB1\u0BC1 \u0BA8\u0BC0\u0B99\u0BCD\u0B95\u0BB3\u0BCD \u0B8E\u0BA9\u0BCD\u0BA9 \u0BAA\u0BBF\u0BB0\u0B9A\u0BCD\u0B9A\u0BA9\u0BC8\u0BAF\u0BC8 \u0BA4\u0BC6\u0BB0\u0BBF\u0BB5\u0BBF\u0B95\u0BCD\u0B95 \u0BB5\u0BBF\u0BB0\u0BC1\u0BAE\u0BCD\u0BAA\u0BC1\u0B95\u0BBF\u0BB1\u0BC0\u0BB0\u0BCD\u0B95\u0BB3\u0BCD?",
  si: "\u0D86\u0DBA\u0DD4\u0DB6\u0DDD\u0DC0\u0DB1\u0DCA! \u0DB8\u0DB8 \u0D94\u0DB6\u0D9C\u0DDA CivicLink AI \u0DC3\u0DC4\u0D9A\u0DCF\u0DBB\u0DD2\u0DBA \uD83D\uDC4B \u0D94\u0DB6\u0D9C\u0DDA \u0DB4\u0DD0\u0DB8\u0DD2\u0DAB\u0DD2\u0DBD\u0DCA\u0DBD \u0DB1\u0DD2\u0DC0\u0DD0\u0DBB\u0DAF\u0DD2 \u0DBB\u0DA2\u0DBA\u0DDA \u0DAF\u0DD9\u0DB4\u0DCF\u0DBB\u0DCA\u0DAD\u0DB8\u0DDA\u0DB1\u0DCA\u0DAD\u0DD4\u0DC0\u0DA7 \u0D89\u0DAF\u0DD2\u0DBB\u0DD2\u0DB4\u0DAD\u0DCA \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8\u0DA7 \u0D94\u0DB6\u0DA7 \u0D8B\u0DAF\u0DC0\u0DCA \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8\u0DA7 \u0DB8\u0DD9\u0DC4\u0DD2 \u0DC3\u0DD2\u0DA7\u0DD2\u0DB8\u0DD2 - \u0D9A\u0DD2\u0DC3\u0DD2\u0DAF\u0DD4 \u0DC6\u0DDD\u0DB8\u0DBA\u0D9A\u0DCA \u0DB1\u0DD0\u0DAD, \u0D9A\u0DD4\u0DB8\u0D9A\u0DCA \u0DC3\u0DD2\u0DAF\u0DD4 \u0DC0\u0DD9\u0DB1\u0DC0\u0DCF\u0DAF \u0D9A\u0DD2\u0DBA\u0DCF \u0DB4\u0DB8\u0DAB\u0D9A\u0DCA \u0DB4\u0DC0\u0DC3\u0DB1\u0DCA\u0DB1. \u0D94\u0DB6 \u0D85\u0DAF \u0D9A\u0DD4\u0DB8\u0DB1 \u0D9C\u0DD0\u0DA7\u0DBD\u0DD4\u0DC0 \u0DC0\u0DCF\u0DBB\u0DCA\u0DAD\u0DCF \u0D9A\u0DD2\u0DBB\u0DD3\u0DB8\u0DA7 \u0D9A\u0DD0\u0DB8\u0DAD\u0DD2\u0DAF?",
};

const LANGUAGE_NAMES = {
  en: "English",
  ta: "Tamil (\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD)",
  si: "Sinhala (\u0DC3\u0DD2\u0D82\u0DC4\u0DBD)",
};

function isAiConfigured() {
  return Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim());
}

function getGroqClient() {
  if (!isAiConfigured()) {
    throw new AppError(
      "AI intake is unavailable because GROQ_API_KEY is not configured.",
      503,
      "AI_NOT_CONFIGURED"
    );
  }

  if (groqClient) {
    return groqClient;
  }

  if (groqInitFailed) {
    throw new AppError(
      "AI intake is temporarily unavailable. Please try again shortly.",
      503,
      "AI_INIT_FAILED"
    );
  }

  try {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    return groqClient;
  } catch (err) {
    groqInitFailed = true;
    logger.error("Failed to initialize Groq client", err);
    throw new AppError(
      "AI intake is temporarily unavailable. Please try again shortly.",
      503,
      "AI_INIT_FAILED"
    );
  }
}

async function getAvailableDepartmentsAndTypes() {
  const result = await pool.query(`
    SELECT
      d.id   AS dept_id,
      d.name AS dept_name,
      dit.id   AS type_id,
      dit.name AS type_name
    FROM departments d
    JOIN department_issue_types dit ON dit.department_id = d.id
    WHERE d.is_active = TRUE AND dit.is_active = TRUE
    ORDER BY d.name, dit.name
  `);

  const map = {};
  for (const row of result.rows) {
    if (!map[row.dept_id]) {
      map[row.dept_id] = { id: row.dept_id, name: row.dept_name, types: [] };
    }
    map[row.dept_id].types.push({ id: row.type_id, name: row.type_name });
  }
  return Object.values(map);
}

function getGreeting(language) {
  return GREETINGS[language] || GREETINGS.en;
}

async function processMessage({ language, chatHistory, structuredDraft, userMessage, departments }) {
  const groq = getGroqClient();
  const langName = LANGUAGE_NAMES[language] || "English";

  const systemPrompt = `You are CivicLink, a friendly AI civic complaint assistant for the Government of Sri Lanka.
Your job is to guide citizens in reporting civic complaints conversationally.

LANGUAGE: Always respond in ${langName}. Do NOT mix languages.

AVAILABLE DEPARTMENTS AND COMPLAINT TYPES (use EXACT UUIDs from this list):
${JSON.stringify(departments, null, 2)}

FIELDS YOU MUST COLLECT:
1. department_id - match to a department from the list above
2. issue_type_id - match to a type WITHIN the chosen department
3. title - short professional title (8-15 words) you generate from the citizen's description
4. description - detailed professional description (3-5 sentences) you write from what the citizen told you
5. address_text - location or address where the problem is (ask if not provided)

RULES:
- Ask ONE question at a time. Never ask multiple questions in one message.
- When the citizen describes a problem in plain language, automatically identify the department and type.
- Generate the title and description YOURSELF - do not ask the citizen to write them.
- When you need the location, set "needs_location": true - the app will show a map picker automatically. Do NOT ask for a typed address.
- Once address_text is already in the collected data, do NOT ask for location again.
- Once you have all 5 fields filled, set is_complete to true.
- Be warm, empathetic, and brief (2-4 sentences per reply).

CURRENTLY COLLECTED DATA (keep these in your draft response):
${JSON.stringify(structuredDraft, null, 2)}

CRITICAL: Respond ONLY with a single valid JSON object - no extra text, no markdown fences:
{
  "reply": "Your conversational response in ${langName}",
  "draft": {
    "department_id": "uuid string or null",
    "issue_type_id": "uuid string or null",
    "title": "string or null",
    "description": "string or null",
    "address_text": "string or null"
  },
  "is_complete": false,
  "needs_location": false
}`;

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      ...chatHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userMessage },
    ],
    max_tokens: 1024,
    temperature: 0.3,
  });

  const raw = response.choices[0].message.content.trim();

  try {
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) throw new Error("No JSON found");
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));

    const mergedDraft = { ...structuredDraft };
    if (parsed.draft && typeof parsed.draft === "object") {
      for (const [key, val] of Object.entries(parsed.draft)) {
        if (val !== null && val !== undefined && val !== "") {
          mergedDraft[key] = val;
        }
      }
    }

    return {
      reply: parsed.reply || "Thank you. Can you tell me more?",
      draft: mergedDraft,
      is_complete: parsed.is_complete === true,
      needs_location: parsed.needs_location === true && !structuredDraft.address_text,
    };
  } catch {
    return {
      reply: raw || "Sorry, I had trouble understanding that. Could you rephrase?",
      draft: structuredDraft,
      is_complete: false,
    };
  }
}

module.exports = { getGreeting, processMessage, getAvailableDepartmentsAndTypes, isAiConfigured };
