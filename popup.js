// Popup Logic - LeetCode Mentor
// Delegates API calls to Background Script to avoid redundant calls or CORS issues.

document.addEventListener('DOMContentLoaded', async () => {
    const loadingScreen = document.getElementById('loading-screen');
    const responseContent = document.getElementById('response-content');
    const errorDiv = document.getElementById('error-message');
    const loadingText = document.getElementById('loading-text');

    let isProcessing = false; // Guard against multiple calls

    // UI Helpers
    const showLoading = (text) => {
        loadingScreen.style.display = 'flex';
        responseContent.style.display = 'none';
        errorDiv.style.display = 'none';
        if (text) loadingText.textContent = text;
    };

    const showResponse = (text) => {
        loadingScreen.style.display = 'none';
        responseContent.style.display = 'block';
        errorDiv.style.display = 'none';

        const html = renderMarkdown(text);
        responseContent.innerHTML = html;
        return html;
    };

    const showError = (text) => {
        loadingScreen.style.display = 'none';
        responseContent.style.display = 'none';
        errorDiv.style.display = 'block';

        // Improve error readability
        const cleanText = text.replace(/Error: /g, '').trim();
        errorDiv.textContent = cleanText;
    };

    const renderMarkdown = (text) => {
        return text
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`([^`]+)`/g, '<code style="background:#f0f0f0; padding:2px 4px; border-radius:4px;">$1</code>');
    };

    // API Delegate
    const askBackgroundToCallGemini = (prompt) => {
        if (isProcessing) return; // Prevent double submission
        isProcessing = true;

        console.log("[Popup] Sending prompt to Background Service Worker...");

        chrome.runtime.sendMessage({ type: 'CALL_GEMINI', prompt: prompt }, (response) => {
            isProcessing = false;

            if (chrome.runtime.lastError) {
                showError("Background Error: " + chrome.runtime.lastError.message);
                return;
            }

            if (response && response.success) {
                const html = showResponse(response.payload);

                // Store result in Content Script for Floating UI
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0] && tabs[0].id) {
                        chrome.tabs.sendMessage(tabs[0].id, {
                            type: 'STORE_RESPONSE',
                            html: html
                        });
                    }
                });
            } else {
                showError("API Error: " + (response?.error || "Unknown"));
            }
        });
    };

    // Init Logic
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab?.url?.includes("leetcode.com/problems")) {
            showError("Please open a LeetCode problem page.");
            return;
        }

        showLoading("Analyzing Code...");

        // Start Extraction
        chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_TOON' }, async (response) => {
            // Handle Connection/Injection Issues
            if (chrome.runtime.lastError) {
                showLoading("Connecting...");
                try {
                    // Inject Scripts if missing
                    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
                    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['styles.css'] });

                    // Retry Extraction
                    setTimeout(() => {
                        chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_TOON' }, (retryRes) => {
                            if (retryRes && retryRes.success) {
                                showLoading("Thinking...");
                                askBackgroundToCallGemini(retryRes.payload);
                            } else {
                                showError("Extraction Failed (Retry). Reload Page.");
                            }
                        });
                    }, 500);
                } catch (e) {
                    showError("Start Failed: " + e.message);
                }
            }
            // Handle Success
            else if (response && response.success) {
                showLoading("Thinking...");
                askBackgroundToCallGemini(response.payload);
            }
            // Handle App Error
            else {
                showError("Extraction Failed: " + (response?.error || "Unknown"));
            }
        });

    } catch (err) {
        showError("Init Error: " + err.message);
    }
});

// Clipboard
document.getElementById('copy-btn')?.addEventListener('click', () => {
    const text = document.getElementById('response-content').innerText || document.getElementById('error-message').innerText;
    navigator.clipboard.writeText(text);
    const btn = document.getElementById('copy-btn');
    btn.textContent = "Copied!";
    setTimeout(() => btn.textContent = "Copy Response", 1500);
});
