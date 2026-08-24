// Cliente del backend. La URL se puede cambiar en Vercel con la variable VITE_API_URL.
export const API_URL =
  import.meta.env.VITE_API_URL || "https://youtube-manager-backend-n91y.onrender.com";

const KEY_TOKEN = "ym_token";
const KEY_ROLE = "ym_role";

export const session = {
  get token() { return localStorage.getItem(KEY_TOKEN); },
  get role() { return localStorage.getItem(KEY_ROLE); },
  set(token, role) { localStorage.setItem(KEY_TOKEN, token); localStorage.setItem(KEY_ROLE, role); },
  clear() { localStorage.removeItem(KEY_TOKEN); localStorage.removeItem(KEY_ROLE); },
  get isAdmin() { return this.role === "admin"; },
};

export async function api(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("No se pudo contactar el servidor. Si estaba dormido, espera 30 segundos y reintenta.");
  }
  if (res.status === 401) {
    session.clear();
    window.location.href = "/";
    throw new Error("Sesión expirada");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Error ${res.status}`);
  return data;
}

export async function wakeUp() {
  try { await fetch(`${API_URL}/health`); } catch { /* el servicio se está despertando */ }
}
