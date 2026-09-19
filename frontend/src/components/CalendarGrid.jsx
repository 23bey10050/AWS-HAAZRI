import React from "react";

// records: attendance API records for the shown month. monthDate: any Date within the
// month. onDayClick(dateStr): called when any day cell is tapped, present or not —
// the caller decides what "no record" vs "present" looks like in the detail view.
export default function CalendarGrid({ monthDate, records, onDayClick, selectedDate }) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth(); // 0-indexed
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();

  const presentDates = new Set(
    records.filter((r) => r.status === "present").map((r) => r.record_date)
  );

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  const pad = (n) => String(n).padStart(2, "0");
  const dateStrFor = (day) => `${year}-${pad(month + 1)}-${pad(day)}`;

  return (
    <div className="grid grid-cols-7 gap-2 w-full">
      {cells.map((day, i) =>
        day == null ? (
          <div key={`empty-${i}`} />
        ) : (
          <button
            key={day}
            onClick={() => onDayClick?.(dateStrFor(day))}
            className={`flex flex-col items-center gap-1 py-1 rounded-lg ${
              selectedDate === dateStrFor(day) ? "bg-white/10 ring-1 ring-primaryGreen" : ""
            }`}
          >
            <span className="text-sm text-textPrimary/70">{day}</span>
            <span
              className={`w-3 h-3 rounded-full ${
                presentDates.has(dateStrFor(day)) ? "bg-primaryGreen" : "bg-white/10"
              }`}
            />
          </button>
        )
      )}
    </div>
  );
}
