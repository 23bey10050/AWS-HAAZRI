export function isSpeechSupported() {
  return "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
}

export function listenOnce({ lang = "hi-IN" } = {}) {
  return new Promise((resolve, reject) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return reject(new Error("unsupported")); // caller must fall back to manual text input
    const recognizer = new SR();
    recognizer.lang = lang;
    recognizer.continuous = false;
    recognizer.interimResults = false;
    recognizer.onresult = (e) => resolve(e.results[0][0].transcript);
    recognizer.onerror = (e) => reject(e.error);
    recognizer.start();
  });
}
