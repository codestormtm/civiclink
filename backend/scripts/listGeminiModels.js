require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

(async () => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
  );
  const data = await response.json();
  if (data.models) {
    data.models
      .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
      .forEach(m => console.log(m.name));
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
})();
