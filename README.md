# LeetMentor 🚀

**Your AI-Powered Algorithmic Companion for LeetCode.**

LeetMentor is a Chrome Extension that integrates directly into the LeetCode interface to provide "Pedagogical Hints" rather than giving away the answer. It acts as a private tutor, analyzing your code logic and specific runtime errors to unblock you without spoiling the learning opportunity.

![LeetMentor Logo](logo.png)

## 🌟 Key Features

*   **🚫 No Spoilers**: AI is instructed to give progressive hints (Concept -> Logic -> Pseudo-code) but NEVER the full solution.
*   **🧠 Context-Aware**: Reads the problem description, your current code, and the language you are using.
*   **🛠️ Runtime Error Analysis**: Parses the LeetCode console output (Red text) to explain *why* your code failed (e.g., "Index -1 out of bounds").
*   **🕵️ Virtualization Bypass**: Uses advanced script injection (`injected_extractor.js`) to read code from the Monaco Editor even when lines are hidden/virtualized.
*   **🎨 Shadow DOM UI**: Floating UI that never conflicts with LeetCode's styles.
*   **🔑 Bring Your Own Key**: Supports Gemini (Google), Llama 3 (Groq), and Olmo (OpenRouter) via your own API keys for privacy and speed.

## 📦 Installation

1.  **Clone the Repo**:
    ```bash
    git clone https://github.com/Chiragadve/LeetMentor.git
    ```
2.  Open Chrome and navigate to `chrome://extensions`.
3.  Enable **Developer Mode** (top right toggle).
4.  Click **Load unpacked**.
5.  Select the `LeetMentor` folder.
6.  Go to any LeetCode problem (e.g., [Two Sum](https://leetcode.com/problems/two-sum/)) to see it in action!

## ⚙️ Configuration

1.  Click the **Settings Icon (⚙️)** in the LeetMentor panel.
2.  Enter your free API Key from [Google Gemini](https://aistudio.google.com/app/apikey) or [Groq](https://console.groq.com/keys).
3.  Save.

## 🛠️ Technical Highlights (For Judges/Devs)

*   **Architecture**: Manifest V3, Signal-Based State Machine.
*   **Security**: Content Security Policy (CSP) compliant, no remote code execution.
*   **Isolation**: Full Shadow DOM encapsulation.
*   **Performance**: Lightweight execution, only injects on demand (or via specific triggers).

## 📄 License

MIT License.
