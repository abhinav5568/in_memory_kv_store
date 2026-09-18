const BASE = "/api/auth";

async function handle(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

export const signup = (email, password) =>
  fetch(`${BASE}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  }).then(handle);

export const login = (email, password) =>
  fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  }).then(handle);

export const logout = () =>
  fetch(`${BASE}/logout`, { method: "POST", credentials: "include" }).then(handle);

export const fetchMe = () =>
  fetch("/api/user/me", { credentials: "include" }).then(handle);
