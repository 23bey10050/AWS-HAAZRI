import React, { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { t } from "../i18n/strings";

export default function Login() {
  const { requestOtp, verifyOtp } = useAuth();
  const [step, setStep] = useState("phone"); // "phone" | "otp"
  const [digits, setDigits] = useState("");
  const [otp, setOtp] = useState("");
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const phoneE164 = `+91${digits}`;

  const handleSendOtp = async () => {
    setError(null);
    setBusy(true);
    try {
      const s = await requestOtp(phoneE164);
      setSession(s);
      setStep("otp");
    } catch (e) {
      setError(t("error_generic"));
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    setError(null);
    setBusy(true);
    try {
      await verifyOtp(otp, session);
    } catch (e) {
      setError(t("login_error_invalid_otp"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-6">
      <h1 className="text-3xl font-bold text-textPrimary">{t("login_title")}</h1>

      {step === "phone" && (
        <div className="w-full max-w-sm flex flex-col gap-4">
          <label className="text-lg text-textPrimary">{t("login_phone_label")}</label>
          <div className="flex items-center gap-2">
            <span className="text-xl text-textPrimary">+91</span>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={digits}
              onChange={(e) => setDigits(e.target.value.replace(/\D/g, ""))}
              className="flex-1 min-h-[56px] rounded-xl bg-card text-textPrimary text-xl px-4 border border-white/10"
            />
          </div>
          <button
            onClick={handleSendOtp}
            disabled={digits.length !== 10 || busy}
            className="min-h-[64px] rounded-xl bg-primaryGreen text-textPrimary text-xl font-bold disabled:opacity-50"
          >
            {t("login_send_otp")}
          </button>
        </div>
      )}

      {step === "otp" && (
        <div className="w-full max-w-sm flex flex-col gap-4">
          <label className="text-lg text-textPrimary">{t("login_otp_label")}</label>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            className="min-h-[56px] rounded-xl bg-card text-textPrimary text-xl px-4 border border-white/10 tracking-widest text-center"
          />
          <button
            onClick={handleVerify}
            disabled={otp.length !== 6 || busy}
            className="min-h-[64px] rounded-xl bg-primaryGreen text-textPrimary text-xl font-bold disabled:opacity-50"
          >
            {t("login_verify")}
          </button>
        </div>
      )}

      {error && <p className="text-deepRed text-lg">{error}</p>}
    </div>
  );
}
