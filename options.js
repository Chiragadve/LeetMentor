// options.js - Debugging Enhanced
document.addEventListener('DOMContentLoaded', () => {
    const status = document.getElementById('status');
    const geminiInput = document.getElementById('geminiKey');
    const groqInput = document.getElementById('groqKey');
    const openRouterInput = document.getElementById('openRouterKey');

    // Load saved keys
    chrome.storage.sync.get(['geminiKey', 'groqKey', 'openRouterKey'], (items) => {
        console.log("[Options] Loading keys...", items);
        if (items.geminiKey) geminiInput.value = items.geminiKey;
        if (items.groqKey) groqInput.value = items.groqKey;
        if (items.openRouterKey) openRouterInput.value = items.openRouterKey;
    });

    // Save keys
    document.getElementById('save').addEventListener('click', () => {
        const geminiVal = geminiInput.value.trim();
        const groqVal = groqInput.value.trim();
        const openRouterVal = openRouterInput.value.trim();

        console.log("[Options] Saving keys...", { geminiVal: geminiVal.slice(0, 5) + "..." });

        chrome.storage.sync.set({
            geminiKey: geminiVal,
            groqKey: groqVal,
            openRouterKey: openRouterVal
        }, () => {
            if (chrome.runtime.lastError) {
                console.error("[Options] Save Failed:", chrome.runtime.lastError);
                status.textContent = "Error Saving: " + chrome.runtime.lastError.message;
                status.style.color = "red";
                status.style.display = 'block';
            } else {
                console.log("[Options] Save Success!");
                status.textContent = "Settings Saved Successfully!";
                status.style.color = "green";
                status.style.display = 'block';

                // Read back immediately to verify
                chrome.storage.sync.get(['geminiKey'], (i) => {
                    console.log("[Options] Verification Read:", i);
                });

                setTimeout(() => {
                    status.style.display = 'none';
                }, 2000);
            }
        });
    });
});
