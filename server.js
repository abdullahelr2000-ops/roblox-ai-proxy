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

// Strict system prompt forcing pure executable code output
let chatHistory = [
    {
        role: "user",
        parts: [{ text: "You are an expert Roblox Luau script writer working inside a Studio plugin context. Your job is to return ONLY executable Luau code that can run directly in Roblox Studio to perform operations. CRITICAL: Do NOT include any conversational text, explanations, introductions, greetings, or markdown wrapper blocks. Start directly with the Luau code. If the user asks to create an object (like a part), write the code to instantiate it, configure its properties, and set its Parent to workspace." }]
    },
    {
        role: "model",
        parts: [{ text: "local part = Instance.new('Part')\npart.Parent = workspace" }]
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
        // Prevent history memory from growing too large and carrying old formatting errors
        if (chatHistory.length > 15) {
            chatHistory = [chatHistory[0], chatHistory[1], ...chatHistory.slice(-4)];
        }

        // 1. Add the user's latest request to the ongoing conversation memory
        chatHistory.push({
            role: "user",
            parts: [{ text: userPrompt }]
        });

        // 2. Send the conversation history to Gemini 2.5 Flash
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            { contents: chatHistory },
            { headers: { 'Content-Type': 'application/json' } }
        );

        // 3. Extract and clean the AI's reply safely
        if (response.data && response.data.candidates && response.data.candidates[0].content) {
            let aiReply = response.data.candidates[0].content.parts[0].text;

            console.log("--- RAW GEMINI REPLY START ---");
            console.log(aiReply);
            console.log("--- RAW GEMINI REPLY END ---");

            // Bulletproof block cleaning using simple text parsing instead of complex regex
            if (aiReply.includes("```")) {
                const lines = aiReply.split("\n");
                const codeLines = [];
                let insideBlock = false;

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    if (line.trim().startsWith("```")) {
                        insideBlock = !insideBlock;
                    } else if (insideBlock) {
                        codeLines.push(line);
                    }
                }

                if (codeLines.length > 0) {
                    aiReply = codeLines.join("\n");
                } else {
                    // Fallback to strip backticks and common headers if they weren't matched perfectly
                    aiReply = aiReply.replace(/```/g, "").replace(/luau/gi, "").replace(/lua/gi, "");
                }
            }

            aiReply = aiReply.trim();

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