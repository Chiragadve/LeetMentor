// LeetCode Mentor Extension - Content Script (Rebranded)
// version: 3.4

// --- CONFIGURATION ---
// Styles are now loaded via styles.css injected into Shadow DOM

// --- STATE VARIABLES ---
var lastCode = "";
var lastChangeTime = Date.now();
var STUCK_THRESHOLD_MS = 60000;
var START_THRESHOLD_CHARS = 50;

// Track clicks
var currentState = "NOT_STARTED";
var stateClickCounts = {
    "NOT_STARTED": 0,
    "STARTED": 0,
    "STUCK": 0,
    "BUGGY": 0,
    "SUCCESS": 0
};

// --- PROMPT TEMPLATES ---
var TEMPLATES = {
    "NOT_STARTED": [
        `Task: Break down the problem into 3 logical steps.`,
        `Task: explicit_ds_guide. Name the best Data Structure.`,
        `Task: Write the Pseudo-code for the initialization step.`,
        `Task: Provide a numbered list of the entire algorithm logic.`
    ],
    "STARTED": [
        `Task: Code Review. Check logic against requirements.`,
        `Task: Identify the Missing Piece. Key variable or condition?`,
        `Task: Refine the Loop/Recursion logic.`,
        `Task: Name the Algorithm pattern.`
    ],
    "STUCK": [
        `Task: Immediate Unblocker. Suggest exactly what comes next.`,
        `Task: Concrete Debug Question. Force check of specific line.`,
        `Task: Simplification. Solve for smaller input.`,
        `Task: The "Aha!" Moment.`
    ],
    "BUGGY": [
        `User Error: {error_type}. Task: Explain specifically what this error means. Show the CORRECT syntax/usage pattern for this specific error handling.`,
        `Task: Trace the Input with the user's code. Show exactly where it breaks.`,
        `Task: Edge Case Check. Empty input? MaxINT?`,
        `Task: Fix Checklist. API usage? Logic bounds?`
    ],
    "SUCCESS": [
        `Task: Complexity Analysis O(?).`,
        `Task: Optimization Challenge.`,
        `Task: Code Quality refactor.`,
        `Task: Validating Edge Cases.`
    ]
};

var SELECTORS = {
    title: 'div[data-cy="question-title"], a[href^="/problems/"]',
    difficulty: '.text-difficulty-easy, .text-difficulty-medium, .text-difficulty-hard',
    description: 'div[data-track-load="description_content"]',
    errorCandidates: [
        '[data-e2e-locator="submission-result"] .text-red-s',
        '.text-red-600',
        '.ant-alert-error',
        'span[class*="text-red-"]'
    ],
    successCandidates: [
        '[data-e2e-locator="submission-result"] .text-green-s',
        '.text-green-600',
        '.text-green-s'
    ]
};

// --- CORE FUNCTIONS (Shadow DOM) ---
var shadowRoot = null;

function injectUI() {
    if (document.getElementById('leetmentor-host')) return;

    // 1. Host
    var host = document.createElement('div');
    host.id = 'leetmentor-host';
    document.body.appendChild(host);

    // 2. Shadow Root
    shadowRoot = host.attachShadow({ mode: 'open' });

    // 3. Styles (Link to external CSS)
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('styles.css');
    shadowRoot.appendChild(link);

    // 4. HTML
    var wrapper = document.createElement('div');
    var logoUrl = chrome.runtime.getURL('logo.png');

    wrapper.innerHTML = `
        <div id="leetmentor-toggle" title="Open Mentor"><img src="${logoUrl}"></div>
        <div id="leetmentor-panel">
          <div id="leetmentor-header">
            <div style="display: flex; align-items: center; gap: 8px;">
                <img src="${logoUrl}" style="width: 20px; height: 20px;">
                <h2>LeetMentor</h2>
            </div>
            <div style="display: flex; gap: 12px; align-items: center;">
                <div id="leetmentor-settings" title="Settings" style="cursor: pointer; font-size: 16px;">⚙️</div>
                <div id="leetmentor-close" title="Close" style="cursor: pointer; font-size: 24px; color: #d73a49; font-weight: bold;">×</div>
            </div>
          </div>
          <div id="leetmentor-content">
            <div id="mentor-text">Click the extension icon to analyze.</div>
          </div>
        </div>
    `;
    shadowRoot.appendChild(wrapper);

    // 5. Events (Bind to Shadow Root elements)
    var toggleBtn = shadowRoot.getElementById('leetmentor-toggle');
    var closeBtn = shadowRoot.getElementById('leetmentor-close');
    var settingsBtn = shadowRoot.getElementById('leetmentor-settings');

    if (toggleBtn) toggleBtn.addEventListener('click', function () { toggleVisibility(); });
    if (closeBtn) closeBtn.addEventListener('click', function () { toggleVisibility(false); });

    // Open Options Page
    if (settingsBtn) settingsBtn.addEventListener('click', function () {
        chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' });
    });

    if (window.leetMentorInterval) clearInterval(window.leetMentorInterval);
}

function toggleVisibility(forceState) {
    if (!shadowRoot) return;
    var panel = shadowRoot.getElementById('leetmentor-panel');
    var toggle = shadowRoot.getElementById('leetmentor-toggle');
    if (!panel) return;

    var isVisible = panel.style.display === 'flex';
    var newState = (forceState !== undefined && forceState !== null) ? forceState : !isVisible;

    panel.style.display = newState ? 'flex' : 'none';
    if (toggle) toggle.style.display = newState ? 'none' : 'flex';
}

function getPageMetadata() {
    var data = {
        title: document.title.split('-')[0].trim(),
        difficulty: "Unknown",
        description: "",
        submission_status: null,
        error_type: null
    };

    var diffEl = document.querySelector(SELECTORS.difficulty);
    if (diffEl) data.difficulty = diffEl.innerText;

    var descEl = document.querySelector(SELECTORS.description);
    if (descEl) data.description = descEl.innerText.trim();

    for (var i = 0; i < SELECTORS.successCandidates.length; i++) {
        var el = document.querySelector(SELECTORS.successCandidates[i]);
        if (el && el.innerText.includes("Accepted")) {
            data.submission_status = "Accepted";
            break;
        }
    }
    if (!data.submission_status) {
        for (var i = 0; i < SELECTORS.errorCandidates.length; i++) {
            var el = document.querySelector(SELECTORS.errorCandidates[i]);
            if (el && (el.innerText.includes("Error") || el.innerText.includes("Wrong") || el.innerText.includes("Failed"))) {
                data.submission_status = el.innerText.split('\n')[0];
                data.error_type = el.innerText.substring(0, 200);
                break;
            }
        }
    }
    return data;
}

function fetchCodeFromPage() {
    return new Promise((resolve, reject) => {
        var script = document.createElement('script');
        script.src = chrome.runtime.getURL('injected_extractor.js');
        script.onload = function () { this.remove(); };
        (document.head || document.documentElement).appendChild(script);

        var listener = function (event) {
            if (event.source !== window || !event.data || event.data.type !== 'LEETMENTOR_FROM_PAGE') return;
            window.removeEventListener('message', listener);
            resolve(event.data.payload);
        };

        window.addEventListener('message', listener);
        setTimeout(() => {
            window.removeEventListener('message', listener);
            resolve(null);
        }, 1000);
    });
}

function determineState(data, codeLen) {
    var isSuccess = data.submission_status === "Accepted";
    var isError = data.submission_status && (data.submission_status.includes("Error") || data.submission_status.includes("Wrong"));

    if (isSuccess) return "SUCCESS";
    if (isError) return "BUGGY";
    if (codeLen < START_THRESHOLD_CHARS * 1.5) return "NOT_STARTED";

    return "STARTED";
}

function constructLLMPrompt(data, code) {
    var newState = determineState(data, code.length);

    if (newState !== currentState) {
        currentState = newState;
        stateClickCounts[newState] = 0;
    } else {
        stateClickCounts[currentState]++;
    }

    var levelIdx = Math.min(stateClickCounts[currentState], 3);
    var tArray = TEMPLATES[currentState] || TEMPLATES["STARTED"];
    var template = tArray[levelIdx];
    if (!template) template = tArray[tArray.length - 1];

    template = template.replace('{short_problem_summary}', data.title || "Problem");
    template = template.replace('{difficulty}', data.difficulty || "Medium");
    template = template.replace('{error_type}', data.error_type || "Unknown Error");

    var codeLines = code.split('\n');
    var numberedCode = codeLines.map((line, idx) => (idx + 1) + ": " + line).join('\n');

    return `
=== LEETCODE MENTOR REQUEST ===
[SYSTEM RULES - STRICT]
1. **Analyze User Code FIRST**: Address errors/misconceptions before hints.
2. **Word Count**: Max 120 words. Concise.
3. **No Solution**: Never write the full code. 
4. **Natural Tone**: Do not mention "I see you haven't started". Just provide the guidance directly.
5. **Hallucination Check**: Verify line numbers before claiming variables are missing.
6. **Syntax/Type Errors**: If finding a syntax or type error, YOU MUST show the correct syntax pattern immediately (e.g. "Use vector<int> name;" not just "Fix declaration").

[CURRENT TASK - STATE: ${currentState} LEVEL: E${levelIdx}]
${template}

[PROBLEM CONTEXT]
Title: ${data.title}
Diff: ${data.difficulty}
Desc: ${data.description ? data.description.substring(0, 500) : "N/A"}

[USER CODE WITH LINE NUMBERS]
${numberedCode}
=== END REQUEST ===
    `.trim();
}

// --- LISTENERS ---
if (window.leetMentorListener) {
    chrome.runtime.onMessage.removeListener(window.leetMentorListener);
}

window.leetMentorListener = function (message, sender, sendResponse) {
    if (message.type === 'EXTRACT_TOON') {
        injectUI();

        (async function () {
            try {
                var metaData = getPageMetadata();
                var codePayload = await fetchCodeFromPage();
                var code = codePayload ? codePayload.code : "";

                if (!code) throw new Error("Could not retrieve code from editor.");

                var prompt = constructLLMPrompt(metaData, code);
                sendResponse({ success: true, payload: prompt });
            } catch (err) {
                console.error("[LeetMentor] Error:", err);
                sendResponse({ success: false, error: err.message });
            }
        })();

        return true;
    }

    if (message.type === 'STORE_RESPONSE') {
        injectUI();
        toggleVisibility(true);
        var textDiv = shadowRoot.getElementById('mentor-text'); // Shadow Access
        if (textDiv) textDiv.innerHTML = message.html;
        sendResponse({ success: true });
    }
};

chrome.runtime.onMessage.addListener(window.leetMentorListener);
