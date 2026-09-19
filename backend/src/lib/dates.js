// IST is UTC+5:30, no DST. This is the single source of truth for "what date is it".
export const toISTDateString = (isoTimestamp) => {
  const d = new Date(isoTimestamp);
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10); // "YYYY-MM-DD"
};

export const nowIST = () => new Date().toISOString();
