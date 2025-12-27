// LeetCode Mentor - Injected Script (invoked by content.js)
// Accesses the page's global 'monaco' object to get full code text.

(function () {
    try {
        // 1. Check if Monaco exists
        if (typeof window.monaco !== 'undefined' && window.monaco.editor) {

            // 2. Get all models
            const models = window.monaco.editor.getModels();

            if (models.length > 0) {
                // 3. Find the most relevant model
                // Heuristic: The largest model is usually the solution. 
                // We can also check uri.path to exclude 'console' or inputs.

                let mainModel = models[0];
                let maxSize = 0;

                models.forEach(m => {
                    const val = m.getValue();
                    if (val.length > maxSize) {
                        maxSize = val.length;
                        mainModel = m;
                    }
                });

                // 4. Send back to Content Script
                window.postMessage({
                    type: 'LEETMENTOR_FROM_PAGE',
                    payload: {
                        code: mainModel.getValue(),
                        language: mainModel.getLanguageId()
                    }
                }, '*');
            }
        } else {
            console.warn("[LeetMentor] Monaco global not found.");
        }
    } catch (e) {
        console.error("[LeetMentor] Injection Read Error:", e);
    }
})();
