import React, { useEffect, useState, useCallback, useMemo } from "react";
import CalendarGrid from "../components/CalendarGrid";
import StatusBanner from "../components/StatusBanner";
import DayDetail from "../components/DayDetail";
import Spinner from "../components/Spinner";
import { getAttendance, getWorkerProfile } from "../api/client";
import { drawCalendarSummary } from "../utils/canvasSummary";
import { shareSummaryBlob } from "../utils/whatsappShare";
import { t } from "../i18n/strings";

export default function Calendar() {
  const [profile, setProfile] = useState(null);
  const lang = profile?.preferred_language ?? "hi";
  const wageRate = profile?.default_wage_rate ?? 0;
  const workerName = profile?.display_name ?? "";

  const [monthDate] = useState(new Date());
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({ total_days: 0, total_wages: 0 });
  const [sharing, setSharing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);

  const monthLabel = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
  const recordsByDate = useMemo(() => {
    const map = {};
    for (const r of records) map[r.record_date] = r;
    return map;
  }, [records]);

  useEffect(() => {
    getWorkerProfile().then(setProfile).catch(() => {});
  }, []);

  const loadAttendance = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    getAttendance({ month: monthLabel })
      .then((data) => {
        setRecords(data.records || []);
        setSummary(data.summary || { total_days: 0, total_wages: 0 });
      })
      .catch(() => {
        // Surfaced instead of swallowed — a silent failure here looked identical
        // to "no attendance yet," which is what made this bug invisible before.
        setLoadError(t("error_generic", lang));
      })
      .finally(() => setLoading(false));
  }, [monthLabel, lang]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const handleShare = async () => {
    setSharing(true);
    try {
      const blob = await drawCalendarSummary({
        monthLabel,
        records,
        workerName,
        wageRate,
        totalDays: summary.total_days,
        totalWages: summary.total_wages,
      });
      await shareSummaryBlob(
        blob,
        `हाज़िरी ${monthLabel}: ${summary.total_days} दिन, ₹${summary.total_wages}`
      );
    } catch {
      // share failure is non-fatal — the summary is already visible on screen
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center gap-6 px-6 safe-top safe-bottom">
      <h1 className="text-2xl font-bold text-textPrimary">{monthLabel}</h1>

      {loadError && (
        <div className="w-full max-w-sm flex flex-col gap-2">
          <StatusBanner status="error">{loadError}</StatusBanner>
          <button
            onClick={loadAttendance}
            className="min-h-[48px] rounded-xl bg-card text-textPrimary border border-white/10 font-semibold"
          >
            {t("retry", lang)}
          </button>
        </div>
      )}

      {loading && !loadError && <Spinner />}

      <div className="w-full max-w-sm bg-card rounded-xl p-4 shadow-sm border border-white/5">
        <CalendarGrid
          monthDate={monthDate}
          records={records}
          selectedDate={selectedDate}
          onDayClick={(dateStr) => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
        />
      </div>

      {selectedDate && (
        <DayDetail
          dateStr={selectedDate}
          record={recordsByDate[selectedDate]}
          onClose={() => setSelectedDate(null)}
          lang={lang}
        />
      )}

      <div className="w-full max-w-sm bg-card rounded-xl p-4 flex justify-between text-lg text-textPrimary shadow-sm border border-white/5">
        <div>
          <p className="text-textPrimary/60">{t("calendar_total_days", lang)}</p>
          <p className="font-bold text-2xl">{summary.total_days}</p>
        </div>
        <div>
          <p className="text-textPrimary/60">{t("calendar_total_wages", lang)}</p>
          <p className="font-bold text-2xl">₹{summary.total_wages}</p>
        </div>
      </div>

      <button
        onClick={handleShare}
        disabled={sharing}
        className="w-full max-w-sm min-h-[64px] rounded-xl bg-gradient-to-b from-primaryGreen to-emerald-600 text-textPrimary text-xl font-bold shadow-[0_8px_20px_rgba(34,197,94,0.3)] active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {sharing && <Spinner size={22} />}
        {t("calendar_share_whatsapp", lang)}
      </button>
    </div>
  );
}
