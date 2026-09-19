import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
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

  return (
    <div className="min-h-screen bg-background flex flex-col items-center gap-8 px-6 pt-10 pb-24">
      <h1 className="text-2xl font-bold text-textPrimary">{t("profile_title", language)}</h1>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <label className="text-textPrimary text-lg">{t("profile_name", language)}</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="min-h-[56px] rounded-xl bg-card text-textPrimary text-lg px-4 border border-white/10"
        />

        <label className="text-textPrimary text-lg">{t("profile_phone", language)}</label>
        <input
          value={phoneNumber}
          disabled
          className="min-h-[56px] rounded-xl bg-card text-textPrimary/60 text-lg px-4 border border-white/10"
        />

        <label className="text-textPrimary text-lg">{t("profile_language", language)}</label>
        <div className="flex gap-2">
          {["hi", "en"].map((l) => (
            <button
              key={l}
              onClick={() => setLanguage(l)}
              className={`flex-1 min-h-[56px] rounded-xl text-lg font-semibold border ${
                language === l ? "bg-primaryGreen text-textPrimary border-primaryGreen" : "bg-card text-textPrimary border-white/10"
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

        <button
          onClick={handleSaveProfile}
          disabled={saving}
          className="min-h-[64px] rounded-xl bg-primaryGreen text-textPrimary text-xl font-bold disabled:opacity-50"
        >
          {t("profile_save", language)}
        </button>

        <button
          onClick={logout}
          className="min-h-[56px] rounded-xl bg-transparent text-deepRed text-lg font-semibold border border-deepRed"
        >
          {t("profile_logout", language)}
        </button>
      </div>
    </div>
  );
}
