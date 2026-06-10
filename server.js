const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.post("/generate", async (req, res) => {
  const { prompt } = req.body;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: {
          parts: [{
            text: `You are an expert Roblox developer. When given a request, respond ONLY with a valid JSON object (no markdown, no backticks, no explanation) in this exact format:
{
  "instances": [
    {
      "type": "ClassName",
      "name": "ObjectName", 
      "parent": "Workspace or Script name",
      "properties": {
        "PropertyName": value
      },
      "children": []
    }
  ],
  "scripts": [
    {
      "type": "Script or LocalScript",
      "name": "ScriptName",
      "parent": "ObjectName",
      "source": "lua code here"
    }
  ]
}`
          }]
        }
      }
    );

    const text = response.data.candidates[0].content.parts[0].text;
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    res.json(parsed);

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});