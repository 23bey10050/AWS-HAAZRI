import React, { useState } from "react";
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

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-6">
      <h1 className="text-2xl font-bold text-textPrimary text-center">
        {t("profile_complete_title", language)}
      </h1>
      <p className="text-textPrimary/60 text-center">{t("profile_complete_subtitle", language)}</p>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <label className="text-textPrimary text-lg">{t("profile_name", language)}</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          autoFocus
          className="min-h-[56px] rounded-xl bg-card text-textPrimary text-lg px-4 border border-white/10"
        />

        <label className="text-textPrimary text-lg">{t("profile_language", language)}</label>
        <div className="flex gap-2">
          {["hi", "en"].map((l) => (
            <button
              key={l}
              onClick={() => setLanguage(l)}
              className={`flex-1 min-h-[56px] rounded-xl text-lg font-semibold border ${
                language === l
                  ? "bg-primaryGreen text-textPrimary border-primaryGreen"
                  : "bg-card text-textPrimary border-white/10"
              }`}
            >
              {l === "hi" ? "हिन्दी" : "English"}
            </button>
          ))}
        </div>

        <label className="text-textPrimary text-lg">{t("profile_wage_rate", language)}</label>
        <input
          type="number"
          value={wageRate}
          onChange={(e) => setWageRate(e.target.value)}
          className="min-h-[56px] rounded-xl bg-card text-textPrimary text-lg px-4 border border-white/10"
        />

        {error && <p className="text-deepRed text-lg text-center">{error}</p>}

        <button
          onClick={handleContinue}
          disabled={saving}
          className="min-h-[64px] rounded-xl bg-primaryGreen text-textPrimary text-xl font-bold disabled:opacity-50"
        >
          {t("profile_continue", language)}
        </button>
      </div>
    </div>
  );
}
