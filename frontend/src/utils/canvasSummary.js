export function drawCalendarSummary({ monthLabel, records, workerName, wageRate, totalDays, totalWages }) {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 900;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0F172A";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#F8FAFC";
  ctx.font = "bold 36px sans-serif";
  ctx.fillText("हाज़िरी Summary", 40, 60);
  ctx.font = "24px sans-serif";
  ctx.fillText(`${workerName || ""} — ${monthLabel}`, 40, 100);

  // 7-column grid of dots, one per attended day present in `records`
  const presentDates = new Set(records.filter((r) => r.status === "present").map((r) => r.record_date));
  let x = 40, y = 160;
  const dotRadius = 12, colWidth = 90, rowHeight = 60;
  const [year, month] = monthLabel.split("-").map(Number); // expects "YYYY-MM"
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${monthLabel}-${String(day).padStart(2, "0")}`;
    const col = (day - 1) % 7;
    const row = Math.floor((day - 1) / 7);
    ctx.beginPath();
    ctx.arc(x + col * colWidth + 20, y + row * rowHeight, dotRadius, 0, 2 * Math.PI);
    ctx.fillStyle = presentDates.has(dateStr) ? "#22C55E" : "#334155";
    ctx.fill();
  }

  ctx.font = "28px sans-serif";
  ctx.fillStyle = "#F8FAFC";
  const summaryY = y + (Math.ceil(daysInMonth / 7) + 1) * rowHeight + 20;
  ctx.fillText(`Total Days: ${totalDays}`, 40, summaryY);
  ctx.fillText(`Rate: ₹${wageRate}/day`, 40, summaryY + 40);
  ctx.fillText(`Total: ₹${totalWages}`, 40, summaryY + 80);
  ctx.font = "18px sans-serif";
  ctx.fillText("✅ Verified via Haazri — GPS + Timestamp", 40, summaryY + 130);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
