document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('open-settings').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });
});
