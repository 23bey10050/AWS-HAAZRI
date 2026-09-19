import React, { useEffect, useState } from "react";
import { getMediaViewUrl } from "../api/client";
import { t } from "../i18n/strings";

const GPS_QUALITY_KEY = { high: "day_detail_gps_high", medium: "day_detail_gps_medium", low: "day_detail_gps_low" };
const GPS_QUALITY_COLOR = { high: "text-primaryGreen", medium: "text-amber", low: "text-deepRed" };

function Field({ label, children }) {
  return (
    <div className="flex justify-between gap-4 text-lg">
      <span className="text-textPrimary/60">{label}</span>
      <span className="text-textPrimary text-right">{children}</span>
    </div>
  );
}

// Full proof for one calendar day — date, time, GPS (with a map link), whatever Bedrock
// structured from a voice note, and the selfie itself (fetched lazily via a short-lived
// presigned GET URL, since the S3 bucket storing it is private).
export default function DayDetail({ dateStr, record, onClose, lang = "hi" }) {
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoState, setPhotoState] = useState(record?.selfie_s3_key ? "loading" : "none");

  useEffect(() => {
    setPhotoUrl(null);
    if (!record?.selfie_s3_key) {
      setPhotoState("none");
      return;
    }
    setPhotoState("loading");
    getMediaViewUrl(record.selfie_s3_key)
      .then(({ view_url }) => {
        setPhotoUrl(view_url);
        setPhotoState("ready");
      })
      .catch(() => setPhotoState("error"));
  }, [record?.selfie_s3_key]);

  const time = record
    ? new Date(record.timestamp).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      })
    : null;

  return (
    <div className="w-full max-w-sm bg-card rounded-xl p-5 flex flex-col gap-3 border border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.25)] animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-textPrimary">{dateStr}</h2>
        <button onClick={onClose} className="text-textPrimary/60 text-lg">
          {t("day_detail_close", lang)} ✕
        </button>
      </div>

      {!record ? (
        <p className="text-textPrimary/60 text-lg">{t("day_detail_no_record", lang)}</p>
      ) : (
        <>
          <Field label={t("day_detail_time", lang)}>{time}</Field>

          {record.gps_lat != null && (
            <Field label={t("day_detail_gps_quality", lang)}>
              <span className={GPS_QUALITY_COLOR[record.gps_quality] ?? ""}>
                {t(GPS_QUALITY_KEY[record.gps_quality] ?? "day_detail_gps_unknown", lang)}
                {record.gps_accuracy != null ? ` (±${Math.round(record.gps_accuracy)}m)` : ""}
              </span>{" "}
              <a
                href={`https://www.google.com/maps?q=${record.gps_lat},${record.gps_lng}`}
                target="_blank"
                rel="noreferrer"
                className="text-primaryGreen underline"
              >
                {t("day_detail_view_map", lang)}
              </a>
            </Field>
          )}

          {record.worksite_name && <Field label={t("day_detail_worksite", lang)}>{record.worksite_name}</Field>}
          {record.task_type && <Field label={t("day_detail_task", lang)}>{record.task_type}</Field>}
          {record.contractor_name && (
            <Field label={t("day_detail_contractor", lang)}>{record.contractor_name}</Field>
          )}
          {record.shift_type && record.shift_type !== "unknown" && (
            <Field label={t("day_detail_shift", lang)}>{record.shift_type}</Field>
          )}
          {record.wage_rate != null && (
            <Field label={t("day_detail_wage", lang)}>₹{record.wage_rate}</Field>
          )}
          {record.voice_transcript && (
            <div className="flex flex-col gap-1">
              <span className="text-textPrimary/60 text-lg">{t("day_detail_voice_note", lang)}</span>
              <p className="text-textPrimary text-base bg-background rounded-lg p-3">
                {record.voice_transcript}
              </p>
            </div>
          )}

          {photoState !== "none" && (
            <div className="flex flex-col gap-1">
              <span className="text-textPrimary/60 text-lg">{t("day_detail_photo", lang)}</span>
              {photoState === "loading" && (
                <p className="text-textPrimary/60">{t("day_detail_photo_loading", lang)}</p>
              )}
              {photoState === "error" && <p className="text-deepRed">{t("day_detail_photo_failed", lang)}</p>}
              {photoState === "ready" && (
                <img src={photoUrl} alt="" className="w-full rounded-lg object-cover max-h-64" />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
