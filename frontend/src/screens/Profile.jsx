import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import Spinner from "../components/Spinner";
import { LogoutIcon } from "../components/icons";
import { getWorkerProfile, putWorkerProfile } from "../api/client";
import { t } from "../i18n/strings";

export default function Profile() {
  const { phone, logout } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [language, setLanguage] = useState("hi");
  const [wageRate, setWageRate] = useState(0);
  const [phoneNumber, setPhoneNumber] = useState(phone ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getWorkerProfile()
      .then((profile) => {
        if (profile.profile_incomplete) return;
        setDisplayName(profile.display_name ?? "");
        setLanguage(profile.preferred_language ?? "hi");
        setWageRate(profile.default_wage_rate ?? 0);
        setPhoneNumber(profile.phone_number ?? phone ?? "");
      })
      .catch(() => {});
  }, [phone]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await putWorkerProfile({
        display_name: displayName || null,
        preferred_language: language,
        default_wage_rate: Number(wageRate) || 0,
      });
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "min-h-[56px] rounded-xl bg-card text-textPrimary text-lg px-4 border border-white/10 focus:border-primaryGreen/60 outline-none transition-colors";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center gap-8 px-6 safe-top safe-bottom">
      <div className="w-20 h-20 rounded-full bg-gradient-to-b from-primaryGreen to-emerald-600 shadow-[0_8px_20px_rgba(34,197,94,0.3)] flex items-center justify-center text-3xl font-bold text-background">
        {(displayName || "?").charAt(0).toUpperCase()}
      </div>
      <h1 className="text-2xl font-bold text-textPrimary -mt-4">{t("profile_title", language)}</h1>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <label className="text-textPrimary/80 text-lg">{t("profile_name", language)}</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} />

        <label className="text-textPrimary/80 text-lg">{t("profile_phone", language)}</label>
        <input value={phoneNumber} disabled className={`${inputClass} text-textPrimary/50`} />

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

        <button
          onClick={handleSaveProfile}
          disabled={saving}
          className="min-h-[64px] rounded-xl bg-gradient-to-b from-primaryGreen to-emerald-600 text-textPrimary text-xl font-bold shadow-[0_8px_20px_rgba(34,197,94,0.3)] active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <Spinner size={22} />}
          {t("profile_save", language)}
        </button>

        <button
          onClick={logout}
          className="min-h-[56px] rounded-xl bg-transparent text-deepRed text-lg font-semibold border border-deepRed/60 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <LogoutIcon />
          {t("profile_logout", language)}
        </button>
      </div>
    </div>
  );
}
