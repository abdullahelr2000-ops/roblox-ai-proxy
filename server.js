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

// Strict system prompt forcing pure executable Luau code output
let chatHistory = [
    {
        role: "user",
        parts: [{ text: "You are an expert Roblox Luau script compiler. Your job is to return ONLY raw, executable Luau code that will run inside a Roblox Studio plugin via loadstring() to manipulate the workspace. CRITICAL: Do NOT wrap your code in markdown blocks like ```lua or ```. Do NOT include any conversational text, explanations, or warnings. Start directly with the code. You have access to a pre-defined local variable 'this' which represents the user's currently selected object, and 'selected' which is an array of all selected items. If the user asks to create an object, create it, set its properties, and parent it to workspace or 'this'." }]
    },
    {
        role: "model",
        parts: [{ text: "local part = Instance.new('Part')\npart.Size = Vector3.new(4, 4, 4)\npart.Color = Color3.fromRGB(255, 0, 0)\npart.Parent = workspace" }]
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

            // Clean code blocks (lua, luau, or blank)
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