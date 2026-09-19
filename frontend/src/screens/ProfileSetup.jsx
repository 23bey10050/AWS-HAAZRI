import React, { useState } from "react";
import Spinner from "../components/Spinner";
import { putWorkerProfile } from "../api/client";
import { t } from "../i18n/strings";

// Shown once, blocking, for a brand-new phone number before Home/Calendar/Profile
// become reachable — the user asked that a new number must complete their profile
// (at minimum, a name) before using the app.
export default function ProfileSetup({ onDone }) {
  const [displayName, setDisplayName] = useState("");
  const [language, setLanguage] = useState("hi");
  const [wageRate, setWageRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleContinue = async () => {
    if (!displayName.trim()) {
      setError(t("profile_name_required", language));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await putWorkerProfile({
        display_name: displayName.trim(),
        preferred_language: language,
        default_wage_rate: Number(wageRate) || 0,
      });
      onDone();
    } catch {
      setError(t("error_generic", language));
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "min-h-[56px] rounded-xl bg-card text-textPrimary text-lg px-4 border border-white/10 focus:border-primaryGreen/60 outline-none transition-colors";

  return (
    <div className="min-h-full bg-background flex flex-col items-center justify-center gap-6 px-6">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-primaryGreen to-emerald-600 shadow-[0_8px_20px_rgba(34,197,94,0.3)] flex items-center justify-center text-3xl font-black text-background">
        ह
      </div>
      <h1 className="text-2xl font-bold text-textPrimary text-center">
        {t("profile_complete_title", language)}
      </h1>
      <p className="text-textPrimary/60 text-center">{t("profile_complete_subtitle", language)}</p>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <label className="text-textPrimary/80 text-lg">{t("profile_name", language)}</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoFocus className={inputClass} />

        <label className="text-textPrimary/80 text-lg">{t("profile_language", language)}</label>
        <div className="flex gap-2">
          {["hi", "en"].map((l) => (
            <button
              key={l}
              onClick={() => setLanguage(l)}
              className={`flex-1 min-h-[56px] rounded-xl text-lg font-semibold border transition-colors ${
                language === l
                  ? "bg-primaryGreen text-textPrimary border-primaryGreen shadow-[0_4px_14px_rgba(34,197,94,0.3)]"
                  : "bg-card text-textPrimary border-white/10"
              }`}
            >
              {l === "hi" ? "हिन्दी" : "English"}
            </button>
          ))}
        </div>

        <label className="text-textPrimary/80 text-lg">{t("profile_wage_rate", language)}</label>
        <input
          type="number"
          value={wageRate}
          onChange={(e) => setWageRate(e.target.value)}
          className={inputClass}
        />

        {error && <p className="text-deepRed text-lg text-center animate-fade-in">{error}</p>}

        <button
          onClick={handleContinue}
          disabled={saving}
          className="min-h-[64px] rounded-xl bg-gradient-to-b from-primaryGreen to-emerald-600 text-textPrimary text-xl font-bold shadow-[0_8px_20px_rgba(34,197,94,0.3)] active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <Spinner size={22} />}
          {t("profile_continue", language)}
        </button>
      </div>
    </div>
  );
}
