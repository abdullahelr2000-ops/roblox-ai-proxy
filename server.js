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

GLOBAL SEARCH RULES:
1. You are provided with a [Global Workspace Context] listing existing items in the game.
2. If the user explicitly mentions an object name to change (e.g., "make the 'Big part' yellow" or "add a sound to 'MyDoor'"), scan the global list for an exact name match.
3. If a match is found in the global list, you MUST use the "update" action targeting that object's exact name. DO NOT use "create" to avoid making duplicates.
4. You can update any aspect: Size, Position, Color, Material, Transparency, or add new scripts/sounds inside it by setting "parentName" to that object's name.`;

app.post("/generate", async (req, res) => {
  const { prompt, context, globalContext } = req.body;

  if (!GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY environment variable.");
    return res.status(500).json({ error: "Server misconfiguration: Missing API Key." });
  }

  let contextSnippet = "";
  if (context && context.length > 0) {
    contextSnippet += `\n\n[Selected Context] Currently highlighted elements:\n${JSON.stringify(context, null, 2)}`;
  }
  if (globalContext && globalContext.length > 0) {
    contextSnippet += `\n\n[Global Workspace Context] All named items currently inside the game:\n${JSON.stringify(globalContext, null, 2)}`;
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
  console.log(`Ultimate Proxy operational on port 3000 [Backend: ${AI_PROVIDER}]`);
});