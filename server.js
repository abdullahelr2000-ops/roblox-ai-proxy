const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const AI_PROVIDER = process.env.AI_PROVIDER || "gemini";

const SYSTEM_PROMPT = `You are an advanced, context-aware AI compiler for Roblox Studio. Your job is to analyze the user's workspace context and generate an exact sequence of structural mutations.
You must return ONLY a valid JSON object. No conversational text, no explanations, no markdown formatting blocks.

RESPONSE JSON FORMAT:
{
  "actions": [
    {
      "action": "create" or "update" or "delete",
      "targetType": "Instance" or "Script" or "LocalScript",
      "className": "Part",
      "name": "TargetObjectName",
      "parentName": "Workspace",
      "properties": {
        "Size": [10, 5, 10],
        "Position": [0, 50, -12],
        "Color": [255, 165, 0],
        "Material": "Neon",
        "Anchored": true,
        "Transparency": 0.5
      },
      "source": "-- lua script source code here (only if targetType is Script or LocalScript)"
    }
  ]
}

DATA TRANSFORMATION RULES:
1. Vector3 properties (Size, Position, or Orientation) MUST be specified as a 3-element numeric array: [X, Y, Z].
2. Color3 properties (Color) MUST be specified as a 3-element integer array from 0 to 255: [R, G, B].
3. Enums (Material, Shape, etc.) MUST be a string name matching the Roblox Enum value (e.g., "Neon", "Glass", "SmoothPlastic").
4. If modifying an existing object passed in the [Selected Context], use action "update", match its target name precisely, and ONLY include properties that need changing. Do not re-create it.
5. If changing a script or functionality of an object, you can "delete" an old script name, or "create" a new script with the updated source code parented to that object. Make scripts clean, professional, and performance-optimized.`;

app.post("/generate", async (req, res) => {
  const { prompt, context } = req.body;

  if (!GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY environment variable.");
    return res.status(500).json({ error: "Server misconfiguration: Missing API Key." });
  }

  let contextSnippet = "";
  if (context && context.length > 0) {
    contextSnippet = `\n\n[Selected Context] The user has highlighted the following elements in Roblox Studio:\n${JSON.stringify(context, null, 2)}\nModify or interact with these objects directly based on their current property vectors.`;
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
        headers: { "Content-Type": "application/json" }
      }
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
    if (err.response && err.response.data) {
       console.error("Payload Details:", JSON.stringify(err.response.data));
    }
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log(`Ultimate Proxy operational on port 3000 [Backend: ${AI_PROVIDER}]`);
});