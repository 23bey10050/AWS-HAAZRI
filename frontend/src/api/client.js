const API_URL = process.env.REACT_APP_API_URL;

let currentToken = null;
export const setAuthToken = (idToken) => {
  currentToken = idToken;
};

async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { status: res.status, data });
  return data;
}

export const postAttendance = (record) => request("/attendance", { method: "POST", body: record });
export const getAttendance = (query) => request(`/attendance?${new URLSearchParams(query)}`);
export const getWorkerProfile = () => request("/worker/profile");
export const putWorkerProfile = (profile) => request("/worker/profile", { method: "PUT", body: profile });
export const structureVoice = (transcript) => request("/voice/structure", { method: "POST", body: { transcript } });
export const getUploadUrl = (payload) => request("/media/upload-url", { method: "POST", body: payload });
export const getMediaViewUrl = (key) => request(`/media/view-url?${new URLSearchParams({ key })}`);
