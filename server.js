const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS so your Roblox game can talk to this server
app.use(cors());
// Allow the server to read JSON data sent by Roblox
app.use(express.json());

// Get your API key from Render's environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Strict system prompt forcing the AI to strictly output raw code only
let chatHistory = [
    {
        role: "user",
        parts: [{ text: "You are an expert Roblox Luau script writer working inside a Studio plugin context. Remember previous code from this session. CRITICAL REQUIREMENT: You must ONLY output raw, pure, executable Luau code. Do NOT wrap your response in markdown code blocks like ```lua and ```. Do NOT include any conversational text, explanations, greetings, or introductions. Your entire response must be 100% raw Luau code so the plugin can perform workspace operations successfully." }]
    },
    {
        role: "model",
        parts: [{ text: "-- Understood. Returning raw executable Luau code only. No markdown formatting, no text explanations." }]
    }
];

// The main endpoint your Roblox plugin sends requests to
app.post('/generate', async (req, res) => {
    const userPrompt = req.body.prompt;

    if (!userPrompt) {
        return res.status(400).json({ error: "No prompt provided" });
    }

    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key is missing on the server" });
    }

    try {
        // Prevent history memory from growing too large and crashing
        if (chatHistory.length > 20) {
            chatHistory = [chatHistory[0], chatHistory[1], ...chatHistory.slice(-6)];
        }

        // 1. Add the user's latest request to the ongoing conversation memory
        chatHistory.push({
            role: "user",
            parts: [{ text: userPrompt }]
        });

        // 2. Send the conversation history using the active gemini-2.5-flash model
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            { contents: chatHistory },
            { headers: { 'Content-Type': 'application/json' } }
        );

        // 3. Extract the AI's reply safely
        if (response.data && response.data.candidates && response.data.candidates[0].content) {
            let aiReply = response.data.candidates[0].content.parts[0].text;

            // FAILSAFE: Automatically strip out markdown boxes if Gemini accidentally includes them
            aiReply = aiReply.replace(/```lua/gi, '').replace(/```/g, '').trim();

            // 4. Add the cleaned reply to the memory loop
            chatHistory.push({
                role: "model",
                parts: [{ text: aiReply }]
            });

            // 5. Send the clean code back to Roblox Studio
            return res.json({ code: aiReply });
        } else {
            throw new Error("Unexpected response structure from Gemini API");
        }

    } catch (error) {
        console.error("Error communicating with Gemini API:", error.response ? JSON.stringify(error.response.data) : error.message);
        res.status(500).json({ error: "Failed to generate code from Gemini" });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running securely on port ${PORT}`);
});