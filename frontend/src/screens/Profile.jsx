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
    "min-h-[56px] rounded-lg bg-card text-textPrimary text-lg px-4 border-2 border-textPrimary/30 focus:border-primaryGreen outline-none";
  const labelClass = "text-textPrimary/80 text-lg font-bold uppercase tracking-wide";

  return (
    <div className="min-h-full bg-background flex flex-col items-center gap-8 px-6 safe-top safe-bottom">
      <div className="w-20 h-20 bg-primaryGreen border-[3px] border-textPrimary shadow-hard flex items-center justify-center text-3xl font-display font-bold text-background">
        {(displayName || "?").charAt(0).toUpperCase()}
      </div>
      <h1 className="text-2xl font-display font-bold text-textPrimary uppercase">{t("profile_title", language)}</h1>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <label className={labelClass}>{t("profile_name", language)}</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} />

        <label className={labelClass}>{t("profile_phone", language)}</label>
        <input value={phoneNumber} disabled className={`${inputClass} text-textPrimary/50`} />

        <label className={labelClass}>{t("profile_language", language)}</label>
        <div className="flex gap-2">
          {["hi", "en"].map((l) => (
            <button
              key={l}
              onClick={() => setLanguage(l)}
              className={`flex-1 min-h-[56px] rounded-lg text-lg font-bold border-2 ${
                language === l
                  ? "bg-primaryGreen text-background border-textPrimary shadow-hard-sm"
                  : "bg-card text-textPrimary border-textPrimary/30"
              }`}
            >
              {l === "hi" ? "हिन्दी" : "English"}
            </button>
          ))}
        </div>

        <label className={labelClass}>{t("profile_wage_rate", language)}</label>
        <input
          type="number"
          value={wageRate}
          onChange={(e) => setWageRate(e.target.value)}
          className={inputClass}
        />

        <button
          onClick={handleSaveProfile}
          disabled={saving}
          className="min-h-[64px] rounded-lg bg-primaryGreen text-background text-xl font-display font-bold uppercase border-2 border-textPrimary shadow-hard active:translate-x-[3px] active:translate-y-[3px] active:shadow-hard-sm transition-[transform,box-shadow] duration-100 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <Spinner size={22} />}
          {t("profile_save", language)}
        </button>

        <button
          onClick={logout}
          className="min-h-[56px] rounded-lg bg-transparent text-deepRed text-lg font-bold uppercase border-2 border-deepRed flex items-center justify-center gap-2"
        >
          <LogoutIcon />
          {t("profile_logout", language)}
        </button>
      </div>
    </div>
  );
}
