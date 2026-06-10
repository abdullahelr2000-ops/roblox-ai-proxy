const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROK_API_KEY = process.env.GROK_API_KEY;

// Change this to "grok" or "gemini" to switch!
const AI_PROVIDER = process.env.AI_PROVIDER || "grok";

const SYSTEM_PROMPT = `You are an expert Roblox developer. When given a request, respond ONLY with a valid JSON object (no markdown, no backticks, no explanation) in this exact format:
{
  "instances": [
    {
      "type": "ClassName",
      "name": "ObjectName",
      "parent": "Workspace",
      "properties": {
        "PropertyName": value
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
}`;

app.post("/generate", async (req, res) => {
  const { prompt } = req.body;

  try {
    let text;

    if (AI_PROVIDER === "grok") {
      const response = await axios.post(
        "https://api.x.ai/v1/chat/completions",
        {
          model: "grok-3-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt }
          ]
        },
        {
          headers: {
            "Authorization": `Bearer ${GROK_API_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );
      text = response.data.choices[0].message.content;

    } else {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          contents: [{ parts: [{ text: prompt }] }]
        }
      );
      text = response.data.candidates[0].content.parts[0].text;
    }

    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    res.json(parsed);

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log(`Server running on port 3000 using ${AI_PROVIDER}`);
});