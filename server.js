const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const AI_PROVIDER = process.env.AI_PROVIDER || "gemini";

const SYSTEM_PROMPT = `You are an advanced, context-aware AI compiler and Debugger for Roblox Studio. Your job is to analyze the user's workspace context and generate an exact sequence of structural mutations.
You must return ONLY a valid JSON object. No conversational text, no explanations, no markdown formatting blocks.

RESPONSE JSON FORMAT:
{
  "actions": [
    {
      "action": "create" or "update" or "delete",
      "targetType": "Instance" or "Script" or "LocalScript",
      "className": "Part" or "ProximityPrompt" or "Sound" etc.,
      "name": "TargetObjectName",
      "parentName": "Workspace", 
      "properties": {
        "Size": [10, 5, 10],
        "Position": [0, 50, -12],
        "Color": [255, 165, 0],
        "Material": "Neon",
        "Anchored": true
      },
      "source": "-- lua script source code here"
    }
  ]
}

DEBUGGING & MODIFICATION RULES:
1. You are provided with existing script text inside the "source" property of the context objects.
2. If the user asks to "fix", "adjust", or "modify" a script, READ the provided "source" code line-by-line. 
3. Identify the logical errors, broken paths, or broken tweens, and rewrite the corrected code.
4. Output an "update" action targeting that script's exact name, and pass the fixed code into the "source" field. Maintain the core functionality while fixing the requested bugs.`;

app.post("/generate", async (req, res) => {
  const { prompt, context, globalContext } = req.body;

  if (!GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY environment variable.");
    return res.status(500).json({ error: "Server misconfiguration: Missing API Key." });
  }

  let contextSnippet = "";
  if (context && context.length > 0) {
    contextSnippet += `\n\n[Selected Context] Highlighting data with active script source lines:\n${JSON.stringify(context, null, 2)}`;
  }
  if (globalContext && globalContext.length > 0) {
    contextSnippet += `\n\n[Global Workspace Context] Game manifest map with script code lines:\n${JSON.stringify(globalContext, null, 2)}`;
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
        generationConfig: { responseMimeType: "application/json" }
      },
      { headers: { "Content-Type": "application/json" } }
    );

    const text = response.data.candidates[0].content.parts[0].text;
    
    try {
      const parsed = JSON.parse(text.trim());
      res.json(parsed);
    } catch (parseErr) {
      console.error("Malformed payload from AI engine. Raw text:", text);
      res.status(500).json({ error: "AI response failed structure validation." });
    }

  } catch (err) {
    console.error("API Gateway Exception:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log(`Ultimate Debugger Proxy operational on port 3000 [Backend: ${AI_PROVIDER}]`);
});