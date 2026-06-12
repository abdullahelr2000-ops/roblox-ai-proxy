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

// This object acts as the continuous "Memory" storage for your chat history
let chatHistory = [
    {
        role: "user",
        parts: [{ text: "You are an expert Roblox Luau script writer. You are working continuously with the user inside Roblox Studio. Remember previous code you generated in this session. When the user says things like 'change it', 'make it rotate on the left side', or references 'this part', look back at the code you just generated and apply edits seamlessly instead of rewriting a brand new unrelated script." }]
    },
    {
        role: "model",
        parts: [{ text: "Understood. I will act as a continuous assistant, remembering all previous scripts and applying relative changes directly to them based on your instructions." }]
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
        // 1. Add the user's latest request to the ongoing conversation memory
        chatHistory.push({
            role: "user",
            parts: [{ text: userPrompt }]
        });

        // 2. Send the entire conversation history to Gemini so it has full context
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            { contents: chatHistory },
            { headers: { 'Content-Type': 'application/json' } }
        );

        // 3. Extract the AI's reply
        const aiReply = response.data.candidates[0].content.parts[0].text;

        // 4. Add the AI's reply to the memory loop so it remembers its own code next time
        chatHistory.push({
            role: "model",
            parts: [{ text: aiReply }]
        });

        // 5. Send the code back to Roblox Studio
        res.json({ code: aiReply });

    } catch (error) {
        console.error("Error communicating with Gemini API:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Failed to generate code from Gemini" });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running securely on port ${PORT}`);
});