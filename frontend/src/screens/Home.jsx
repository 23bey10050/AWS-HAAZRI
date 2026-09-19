import React, { useEffect, useState, useCallback } from "react";
import HaazriButton from "../components/HaazriButton";
import StatusBanner from "../components/StatusBanner";
import { CameraIcon, MicIcon } from "../components/icons";
import { getWorkerProfile, postAttendance, getUploadUrl, structureVoice } from "../api/client";
import { enqueue, removeFromQueue } from "../hooks/useOfflineQueue";
import { captureLocation } from "../hooks/useGeolocation";
import { isSpeechSupported, listenOnce } from "../hooks/useSpeechToText";
import { compressImage } from "../utils/imageCompression";
import { t } from "../i18n/strings";

const todayIST = () => {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
};

export default function Home() {
  const [lang, setLang] = useState("hi");
  const [wageRate, setWageRate] = useState(0);
  const [recording, setRecording] = useState(false);
  const [savedRecord, setSavedRecord] = useState(null); // today's record base fields, for follow-up calls
  const [status, setStatus] = useState(null); // { type, message } — the tap/sync status
  const [photoStatus, setPhotoStatus] = useState(null); // separate banner so it doesn't clobber the tap status
  const [voiceStatus, setVoiceStatus] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [speechBusy, setSpeechBusy] = useState(false);

  useEffect(() => {
    getWorkerProfile()
      .then((profile) => {
        if (profile?.preferred_language) setLang(profile.preferred_language);
        if (profile?.default_wage_rate) setWageRate(profile.default_wage_rate);
      })
      .catch(() => {});
  }, []);

  const speak = (text) => {
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang === "hi" ? "hi-IN" : "en-IN";
      window.speechSynthesis?.speak(utter);
    } catch {
      // speech synthesis is a nice-to-have confirmation, never block on it
    }
  };

  const handleTap = async () => {
    setRecording(true);
    setStatus(null);
    setPhotoStatus(null);
    setVoiceStatus(null);
    try {
      const gps = await captureLocation();
      const record = {
        timestamp: new Date().toISOString(),
        record_date: todayIST(),
        ...gps,
        // Only included when the worker has actually set a rate in Profile — omitting
        // it (rather than sending 0) leaves it unset server-side so it can still be
        // filled in correctly later, instead of permanently locking in a wrong ₹0.
        ...(wageRate > 0 ? { wage_rate: wageRate } : {}),
      };

      // Optimistic UI first — the tap must never wait on the network (spec 12.5).
      // This is "pending" (amber), not "success" (green) yet — we flip it to green
      // once the server actually confirms the write, so a real sync failure is
      // visible instead of looking identical to success.
      setSavedRecord(record);
      speak(t("home_recorded_today", lang));
      const gpsWeak = gps.gps_accuracy > 500;
      setStatus({
        type: "pending",
        message: gpsWeak ? t("home_gps_weak", lang) : t("home_syncing", lang),
      });

      const queueId = await enqueue(record);
      setRecording(false);

      try {
        await postAttendance(record);
        await removeFromQueue(queueId);
        setStatus({ type: "success", message: t("home_synced", lang) });
      } catch {
        // Stays queued — App.jsx's background sync (30s interval + online event)
        // will retry automatically. The amber banner honestly reflects that it
        // hasn't reached the server yet, instead of silently claiming success.
        setStatus({ type: "pending", message: t("home_saved_offline", lang) });
      }
    } catch (e) {
      // GPS itself failed (permission denied, timeout, etc.) — this is the one
      // real failure case, shown as an error.
      setStatus({ type: "error", message: t("error_generic", lang) });
      setRecording(false);
    }
  };

  const syncFollowUp = useCallback(
    async (extraFields) => {
      if (!savedRecord) return false;
      const record = { ...savedRecord, ...extraFields };
      try {
        await postAttendance(record);
        return true;
      } catch {
        await enqueue(record); // offline — background sync will retry
        return false;
      }
    },
    [savedRecord]
  );

  const handleAddPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoStatus({ type: "pending", message: t("home_photo_uploading", lang) });
    try {
      const blob = await compressImage(file);
      const { upload_url, s3_key } = await getUploadUrl({
        media_type: "selfie",
        file_type: "image/jpeg",
        file_size_bytes: blob.size,
      });
      const putRes = await fetch(upload_url, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": "image/jpeg" },
      });
      if (!putRes.ok) throw new Error("upload failed");
      const synced = await syncFollowUp({ selfie_s3_key: s3_key });
      setPhotoStatus({
        type: synced ? "success" : "pending",
        message: synced ? t("home_photo_added", lang) : t("home_saved_offline", lang),
      });
    } catch {
      setPhotoStatus({ type: "error", message: t("home_photo_failed", lang) });
    }
  };

  const handleAddVoice = async () => {
    setSpeechBusy(true);
    setVoiceStatus({ type: "pending", message: t("home_voice_listening", lang) });
    try {
      const transcript = await listenOnce({ lang: lang === "hi" ? "hi-IN" : "en-IN" });
      const structured = await structureVoice(transcript).catch(() => null);
      const synced = await syncFollowUp({
        voice_transcript: transcript,
        ...(structured ?? {}),
      });
      setVoiceStatus({
        type: synced ? "success" : "pending",
        message: synced ? t("home_voice_added", lang) : t("home_saved_offline", lang),
      });
    } catch {
      // unsupported, denied, or no speech detected — GPS-only record is already saved
      setVoiceStatus({ type: "error", message: t("home_voice_failed", lang) });
    } finally {
      setSpeechBusy(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    const synced = await syncFollowUp({ voice_transcript: noteText.trim() });
    setVoiceStatus({
      type: synced ? "success" : "pending",
      message: synced ? t("home_voice_added", lang) : t("home_saved_offline", lang),
    });
    setNoteText("");
  };

  return (
    <div className="min-h-full bg-background flex flex-col items-center justify-center gap-6 px-6 safe-bottom">
      <HaazriButton label={t("home_tap_button", lang)} onPress={handleTap} disabled={recording} />

      <StatusBanner status={status?.type}>{status?.message}</StatusBanner>

      {savedRecord && (
        <div className="w-full max-w-sm flex flex-col gap-3 animate-fade-in">
          <label className="min-h-[64px] rounded-lg bg-card text-textPrimary text-lg font-bold flex items-center justify-center gap-2 border-2 border-textPrimary/30 shadow-hard-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-[transform,box-shadow] duration-100">
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleAddPhoto} />
            <CameraIcon />
            {t("home_add_photo", lang)}
          </label>
          <StatusBanner status={photoStatus?.type}>{photoStatus?.message}</StatusBanner>

          {isSpeechSupported() ? (
            <button
              onClick={handleAddVoice}
              disabled={speechBusy}
              className="min-h-[64px] rounded-lg bg-card text-textPrimary text-lg font-bold border-2 border-textPrimary/30 shadow-hard-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-[transform,box-shadow] duration-100 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <MicIcon />
              {t("home_add_voice", lang)}
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder={t("home_add_note", lang)}
                className="flex-1 min-h-[56px] rounded-lg bg-card text-textPrimary text-lg px-4 border-2 border-textPrimary/30"
              />
              <button
                onClick={handleAddNote}
                className="px-4 rounded-lg bg-primaryGreen text-background font-bold border-2 border-textPrimary shadow-hard-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-[transform,box-shadow] duration-100"
              >
                {t("profile_save", lang)}
              </button>
            </div>
          )}
          <StatusBanner status={voiceStatus?.type}>{voiceStatus?.message}</StatusBanner>
        </div>
      )}
    </div>
  );
}
