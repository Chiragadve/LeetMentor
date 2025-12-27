// LeetCode Mentor - Background Service (Hybrid: Sponsored + BYOK + Onboarding)
// Version: 3.8 - Clone Resilient
// CONFIG: Dynamic Import used to ensure startup even if secrets.js is missing.

const MODELS = {
    GEMINI: "gemini-2.5-flash",
    GROQ: "llama-3.3-70b-versatile",
    OPENROUTER: "allenai/olmo-3.1-32b-think:free"
};

// Priority: Gemini -> Groq -> OpenRouter
const MODEL_PRIORITY = ["GEMINI", "GROQ", "OPENROUTER"];

// --- ONBOARDING ---
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.tabs.create({ url: "onboarding.html" });
    }
});

// --- KEY MANAGEMENT ---
let cachedSecrets = null;

async function getSecrets() {
    if (cachedSecrets) return cachedSecrets;
    try {
        // Dynamic import logic: Try to load secrets.js, fail gracefully if missing
        const module = await import('./secrets.js');
        cachedSecrets = module.API_KEYS || {};
        console.log("[Config] Loaded keys from secrets.js");
    } catch (e) {
        console.log("[Config] secrets.js not found (Fresh Clone). Using empty defaults.");
        cachedSecrets = {};
    }
    return cachedSecrets;
}

async function getApiKey(service) {
    // Ensure secrets are loaded (or defaulted to empty)
    const secrets = await getSecrets();

    return new Promise((resolve) => {
        const keyMap = {
            'GEMINI': 'geminiKey',
            'GROQ': 'groqKey',
            'OPENROUTER': 'openRouterKey'
        };
        const storageKey = keyMap[service];

        chrome.storage.sync.get([storageKey], (items) => {
            const userKey = items[storageKey];

            console.log(`[KeyCheck] Checking ${service}...`);

            if (userKey && typeof userKey === 'string' && userKey.trim() !== "") {
                // User provided their own key (Options Page)
                console.log(`[KeyCheck] FOUND User Key for ${service} (Length: ${userKey.trim().length})`);
                resolve(userKey.trim());
            } else {
                // FALLBACK: Use Developer/Sponsor Keys (from secrets.js)
                const secretKey = secrets[service];
                const isPlaceholder = secretKey && secretKey.includes("YOUR_");

                console.log(`[KeyCheck] User Key Empty. Using Secrets for ${service}. Placeholder? ${isPlaceholder}`);

                if (isPlaceholder) {
                    resolve(null);
                } else {
                    resolve(secretKey || null);
                }
            }
        });
    });
}

// --- API CLIENTS ---

async function callGemini(prompt) {
    const key = await getApiKey('GEMINI');
    if (!key) throw new Error("Missing Gemini Key.");

    console.log("[Background] Calling Gemini...");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.GEMINI}:generateContent?key=${key}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!response.ok) throw new Error(`Gemini Error ${response.status}: ${await response.text()}`);

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned empty response");

    return text + "\n\n*(Powered by Gemini 2.5)*";
}

async function callGroq(prompt) {
    const key = await getApiKey('GROQ');
    if (!key) throw new Error("Missing Groq Key.");

    console.log("[Background] Calling Groq...");
    const url = "https://api.groq.com/openai/v1/chat/completions";

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            messages: [{ role: "user", content: prompt }],
            model: MODELS.GROQ,
            temperature: 0.7
        })
    });

    if (!response.ok) throw new Error(`Groq Error ${response.status}: ${await response.text()}`);

    const data = await response.json();
    return data.choices?.[0]?.message?.content + "\n\n*(Powered by Llama 3)*";
}

async function callOpenRouter(prompt) {
    const key = await getApiKey('OPENROUTER');
    if (!key) throw new Error("Missing OpenRouter Key.");

    console.log("[Background] Calling OpenRouter (Olmo)...");
    const url = "https://openrouter.ai/api/v1/chat/completions";

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://leetcodementor.extension",
            "X-Title": "LeetCode Mentor"
        },
        body: JSON.stringify({
            model: MODELS.OPENROUTER,
            messages: [{ role: "user", content: prompt }]
        })
    });

    if (!response.ok) throw new Error(`OpenRouter Error ${response.status}: ${await response.text()}`);

    const data = await response.json();
    return data.choices?.[0]?.message?.content + "\n\n*(Powered by Olmo 7B)*";
}

const PROVIDERS = {
    "OPENROUTER": callOpenRouter,
    "GEMINI": callGemini,
    "GROQ": callGroq
};

// --- ORCHESTRATOR ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    if (message.type === 'OPEN_OPTIONS_PAGE') {
        chrome.runtime.openOptionsPage();
        return;
    }

    if (message.type === 'CALL_GEMINI') {
        (async () => {
            let errors = [];
            let success = false;

            for (const providerName of MODEL_PRIORITY) {
                try {
                    const providerFunc = PROVIDERS[providerName];
                    const reply = await providerFunc(message.prompt);
                    sendResponse({ success: true, payload: reply });
                    success = true;
                    return;
                } catch (err) {
                    console.warn(`[Orchestrator] ${providerName} Failed:`, err);
                    errors.push(`${providerName}: ${err.message}`);
                }
            }

            if (!success) {
                sendResponse({
                    success: false,
                    error: `All Providers Failed:\n${errors.join('\n')}\n\nCheck your keys in Settings.`
                });
            }
        })();
        return true;
    }
});
