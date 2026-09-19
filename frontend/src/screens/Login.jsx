import React, { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import Spinner from "../components/Spinner";
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
    <div className="min-h-full bg-background flex flex-col items-center justify-center gap-8 px-6">
      <div className="flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-b from-primaryGreen to-emerald-600 shadow-[0_10px_28px_rgba(34,197,94,0.35)] flex items-center justify-center text-4xl font-black text-background">
          ह
        </div>
        <h1 className="text-3xl font-bold text-textPrimary text-center">{t("login_title")}</h1>
      </div>

      {step === "phone" && (
        <div className="w-full max-w-sm flex flex-col gap-4 animate-fade-in">
          <label className="text-lg text-textPrimary/80">{t("login_phone_label")}</label>
          <div className="flex items-center gap-2 rounded-xl bg-card border border-white/10 focus-within:border-primaryGreen/60 transition-colors px-4">
            <span className="text-xl text-textPrimary/70">+91</span>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={digits}
              onChange={(e) => setDigits(e.target.value.replace(/\D/g, ""))}
              className="flex-1 min-h-[56px] bg-transparent text-textPrimary text-xl outline-none"
              autoFocus
            />
          </div>
          <button
            onClick={handleSendOtp}
            disabled={digits.length !== 10 || busy}
            className="min-h-[64px] rounded-xl bg-gradient-to-b from-primaryGreen to-emerald-600 text-textPrimary text-xl font-bold shadow-[0_8px_20px_rgba(34,197,94,0.3)] active:scale-[0.98] transition-transform disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
          >
            {busy && <Spinner size={22} />}
            {t("login_send_otp")}
          </button>
        </div>
      )}

      {step === "otp" && (
        <div className="w-full max-w-sm flex flex-col gap-4 animate-fade-in">
          <label className="text-lg text-textPrimary/80">{t("login_otp_label")}</label>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            className="min-h-[56px] rounded-xl bg-card text-textPrimary text-xl px-4 border border-white/10 focus:border-primaryGreen/60 outline-none tracking-[0.5em] text-center transition-colors"
            autoFocus
          />
          <button
            onClick={handleVerify}
            disabled={otp.length !== 6 || busy}
            className="min-h-[64px] rounded-xl bg-gradient-to-b from-primaryGreen to-emerald-600 text-textPrimary text-xl font-bold shadow-[0_8px_20px_rgba(34,197,94,0.3)] active:scale-[0.98] transition-transform disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
          >
            {busy && <Spinner size={22} />}
            {t("login_verify")}
          </button>
        </div>
      )}

      {error && <p className="text-deepRed text-lg animate-fade-in">{error}</p>}
    </div>
  );
}
