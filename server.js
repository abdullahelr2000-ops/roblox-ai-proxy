const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const AI_PROVIDER = process.env.AI_PROVIDER || "gemini";

const SYSTEM_PROMPT = `You are an expert Roblox developer. When given a request, respond ONLY with a valid JSON object (no markdown, no backticks, no explanation) in this exact format:
{
  "instances": [
    {
      "type": "ClassName",
      "name": "ObjectName",
      "parent": "Workspace",
      "properties": {
        "PropertyName": "value"
      }
    }
  ],
  "scripts": [
    {
      "type": "Script or LocalScript",
      "name": "ScriptName",
      "parent": "Workspace",
      "source": "lua code here"
    }
  ]
}

CRITICAL RULES:
1. If the user provides "Selected Context" and asks to modify or add behavior to an existing object, match its "name" exactly in your response. Do not create a duplicate instance if it already exists; just target its name and specify the modified properties or parent the new script inside it.
2. Ensure scripts use proper Luau programming syntax for Roblox Studio.`;

app.post("/generate", async (req, res) => {
  const { prompt, context } = req.body;

  if (!GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY environment variable.");
    return res.status(500).json({ error: "Server misconfiguration: Missing API Key." });
  }

  // Inject the selection context into the AI prompt
  let contextSnippet = "";
  if (context && context.length > 0) {
    contextSnippet = `\n\n[Selected Context] The user currently has these objects SELECTED in Roblox Studio:\n${JSON.stringify(context, null, 2)}\nUse this context to modify these items or attach scripts inside them if requested.`;
  }

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          { 
            role: "user", 
            parts: [{ text: `${SYSTEM_PROMPT}${contextSnippet}\n\nUser Request: ${prompt}` }] 
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      },
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    const text = response.data.candidates[0].content.parts[0].text;
    
    try {
      const parsed = JSON.parse(text.trim());
      res.json(parsed);
    } catch (parseErr) {
      console.error("Failed to parse AI response as JSON. Raw text:", text);
      res.status(500).json({ error: "AI output was not valid JSON structure." });
    }

  } catch (err) {
    console.error("API Error:", err.message);
    if (err.response && err.response.data) {
       console.error("Details:", JSON.stringify(err.response.data));
    }
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log(`Server running on port 3000 using ${AI_PROVIDER}`);
});