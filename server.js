const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased limit to safely handle large codebase transmissions

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// An incredibly detailed, world-class developer personality injected directly into Gemini's cognitive layer
const ULTIMATE_SYSTEM_INSTRUCTION = `You are the Lead Roblox Luau Architect & Game Director inside a professional game studio. Your job is to return ONLY raw, executable Luau code that will run inside a Roblox Studio plugin via loadstring() to build, edit, or debug.

CRITICAL INSTRUCTIONS ON BEHAVIOR AND INTELLIGENCE:

1. DECIPHERING VAGUE PROMPTS (THE INTUITION PROTOCOL):
- Do not make the user describe trivial details. If they ask for a "Pet Simulator X style stage wall", "zone door", "obby stage", or "upgrade terminal", you must automatically design it to industry-grade standards.
- Automatic UI Standards: All ScreenGuis must look clean, modern, and high-fidelity. ALWAYS use UICorner (CornerRadius 8 to 12) for rounded edges. Always use premium dark themes (Color3.fromRGB(30,30,35)) with subtle, professional accent colors (like emerald green Color3.fromRGB(0, 180, 110) or gold highlights). Use modern fonts like GothamBold or Arial. Add smooth opening animations using TweenService (e.g., bouncing scale transitions).
- Automatic Game Component Standards: If a user asks for something interactive, automatically include the interaction mechanics (like a ProximityPrompt with high-quality CustomText or a ClickDetector) and relative, duplication-safe scripting.

2. TROUBLESHOOTING & DIRECT DEBUGGING (THE SELF-HEALING PROTOCOL):
- If the user says "fix it", "it is not working", "the GUI does nothing", or "debug this", you must look at the provided [Selected Context] and [Global Workspace Context] sections.
- Identify syntax errors, logical errors (e.g., missing RemoteEvents, hardcoded paths that break when duplicated, scripts that do not listen to clicks, or LocalScripts running where ServerScripts are required), and correct them.
- Output the fully repaired, updated executable Luau script with precise modifications to existing objects or scripts rather than rebuilding everything from scratch.

3. DUPLICATION SAFETY & MODULAR DESIGN:
- NEVER write absolute hardcoded workspace paths (like game.Workspace.GiantWall) unless specifically commanded.
- Always write relative, self-contained scripts using 'script.Parent' so that if the user duplicates the stage wall or object 100 times, every single copy operates independently without breaking.

4. MULTI-DISCIPLINARY EXCELLENCE (BUILDING, DESIGN, EFFECTS, CODE):
- If building: Apply beautiful material designs (like Glass, Neon, SmoothPlastic, or Wood), add custom lighting elements (PointLight, SurfaceLight), and set professional properties (Anchored, CanCollide, CastShadow).
- Visual Effects (VFX): Add rich visual feedback like ParticleEmitters (shimmering stars, sparks, or smoke) when players unlock zones or touch objects.
- Client/Server Security: Structure UI logic safely. Local interactions should trigger server modifications, or local-only GUI effects depending on the gameplay context.

5. OUTPUT FORMAT MANDATE:
- You must ONLY return raw, executable Luau code.
- Absolutely NO conversational text, explanations, warnings, or markdown code blocks (such as \`\`\`lua or \`\`\`).
- Start directly with the executable Luau code. Use the local variable 'this' as the user's primary selection context.`;

let chatHistory = [
    {
        role: "user",
        parts: [{ text: ULTIMATE_SYSTEM_INSTRUCTION }]
    },
    {
        role: "model",
        parts: [{ text: "-- Luau Compiler Online. Ready to receive advanced development and troubleshooting commands." }]
    }
];

// Robust exponential backoff retry system to combat 503 Service Unavailable bottlenecks on high demand periods
async function fetchWithRetry(url, data, config, retries = 5, delay = 1000) {
    try {
        return await axios.post(url, data, config);
    } catch (error) {
        const isUnavailable = error.response && (error.response.status === 503 || error.response.status === 429);
        if (retries > 0 && isUnavailable) {
            console.log(`Gemini API busy (503/429). Retrying in ${delay}ms... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(url, data, config, retries - 1, delay * 2);
        }
        throw error;
    }
}

app.post('/generate', async (req, res) => {
    const userPrompt = req.body.prompt;
    const context = req.body.context;
    const globalContext = req.body.globalContext;

    if (!userPrompt) {
        return res.status(400).json({ error: "No prompt provided" });
    }

    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key is missing on the server" });
    }

    try {
        // Keep the cognitive memory loop lean while retaining context
        if (chatHistory.length > 15) {
            chatHistory = [chatHistory[0], chatHistory[1], ...chatHistory.slice(-4)];
        }

        // Construct a highly detailed telemetry packet to give Gemini perfect spatial and logical awareness
        let contextualPrompt = `USER REQUEST: "${userPrompt}"`;
        
        if (context && context.length > 0) {
            contextualPrompt += `\n\n[Selected Object Context]:\n${JSON.stringify(context, null, 2)}`;
        }
        
        if (globalContext && globalContext.length > 0) {
            // Keep workspace summary concise to prevent exceeding token thresholds
            const limitedGlobalContext = globalContext.slice(0, 50); 
            contextualPrompt += `\n\n[Active Workspace Telemetry Summary]:\n${JSON.stringify(limitedGlobalContext, null, 2)}`;
        }

        chatHistory.push({
            role: "user",
            parts: [{ text: contextualPrompt }]
        });

        // Query the Gemini 2.5 Flash gateway with automated retry fallbacks
        const response = await fetchWithRetry(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            { contents: chatHistory },
            { headers: { 'Content-Type': 'application/json' } }
        );

        if (response.data && response.data.candidates && response.data.candidates[0].content) {
            let aiReply = response.data.candidates[0].content.parts[0].text;

            console.log("--- RAW GEMINI REPLY START ---");
            console.log(aiReply);
            console.log("--- RAW GEMINI REPLY END ---");

            // Bulletproof code block cleaning
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

            chatHistory.push({
                role: "model",
                parts: [{ text: aiReply }]
            });

            return res.json({ code: aiReply });
        } else {
            throw new Error("Unexpected response structure from Gemini API");
        }

    } catch (error) {
        console.error("Error communicating with Gemini API:", error.response ? JSON.stringify(error.response.data) : error.message);
        res.status(500).json({ error: "Failed to generate code from Gemini" });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running securely on port ${PORT}`);
});