import { useEffect, useState } from "react";
import { api, session, wakeUp } from "./api";
import Metadata from "./Metadata";
import Privacidad from "./Privacidad";

/* ─────────────────────────── Secciones (letras = funciones del documento) ─────────────────────────── */
const SECTIONS = [
  { key: "A", path: "/metadata", label: "Metadata de un clic", roles: ["admin", "editor"] },
  { key: "B", path: "/plantillas", label: "Descripciones rotativas", roles: ["admin", "editor"], soon: true },
  { key: "C", path: "/monitor", label: "Monitor por nicho", roles: ["admin"], soon: true },
  { key: "D", path: "/virales", label: "Virales", roles: ["admin"], soon: true },
  { key: "G", path: "/miniaturas", label: "Miniaturas", roles: ["admin"], soon: true },
  { key: "CH", path: "/canales", label: "Canales propios", roles: ["admin", "editor"], group: "Configuración" },
  { key: "N", path: "/nichos", label: "Nichos", roles: ["admin"], group: "Configuración" },
];

function useRoute() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const go = (p) => { window.history.pushState({}, "", p); setPath(p); };
  return [path, go];
}

/* ─────────────────────────── Login ─────────────────────────── */
function Login({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { wakeUp(); }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const { token, role } = await api("/auth/login", { method: "POST", body: { password } });
      session.set(token, role);
      onLogin(role);
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="brand"><span className="brand-mark" />YouTube Manager</div>
        <p>Herramienta interna de canales</p>
        {error && <div className="note note-error">{error}</div>}
        <div className="field">
          <label htmlFor="pw">Contraseña</label>
          <input id="pw" className="input" type="password" autoFocus value={password}
                 onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-block" disabled={busy || !password}>
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}

/* ─────────────────────────── Canales propios ─────────────────────────── */
function Canales() {
  const [channels, setChannels] = useState(null);
  const [niches, setNiches] = useState([]);
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(false);
  const isAdmin = session.isAdmin;

  async function load() {
    try {
      const [c, n] = await Promise.all([api("/own-channels"), api("/niches")]);
      setChannels(c); setNiches(n);
    } catch (err) { setNote({ type: "error", text: err.message }); setChannels([]); }
  }

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("connected")) setNote({ type: "ok", text: "Canal conectado. Los tokens quedaron guardados en el servidor." });
    if (q.get("error")) setNote({ type: "error", text: `Google no completó la conexión (${q.get("error")}). Intenta de nuevo.` });
    if (q.toString()) window.history.replaceState({}, "", "/canales");
    load();
  }, []);

  async function connect() {
    setBusy(true); setNote(null);
    try {
      const { url } = await api("/own-channels/oauth/start");
      window.location.href = url;
    } catch (err) { setNote({ type: "error", text: err.message }); setBusy(false); }
  }

  async function save(ch, patch) {
    try {
      const updated = await api(`/own-channels/${ch.id}`, { method: "PUT", body: patch });
      setChannels((list) => list.map((x) => (x.id === ch.id ? updated : x)));
      setNote({ type: "ok", text: `Guardado: ${updated.title}` });
    } catch (err) { setNote({ type: "error", text: err.message }); }
  }

  async function test(ch) {
    setNote(null);
    try {
      const r = await api(`/own-channels/${ch.id}/test`);
      setNote({ type: "ok", text: `Conexión viva con "${r.channel}". Cuota usada hoy: ${r.quota.units_used} / ${r.quota.units_limit}.` });
    } catch (err) { setNote({ type: "error", text: err.message }); }
  }

  async function disconnect(ch) {
    if (!confirm(`¿Desconectar "${ch.title}"? Podrás volver a conectarlo cuando quieras.`)) return;
    try {
      await api(`/own-channels/${ch.id}`, { method: "DELETE" });
      setChannels((list) => list.filter((x) => x.id !== ch.id));
      setNote({ type: "ok", text: `Desconectado: ${ch.title}` });
    } catch (err) { setNote({ type: "error", text: err.message }); }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Canales propios</h1>
          <p>Los canales conectados por OAuth. La cuenta de YouTube nunca sale del servidor.</p>
        </div>
        {isAdmin && (
          <button className="btn btn-red" onClick={connect} disabled={busy}>
            {busy ? "Abriendo Google…" : "Conectar canal de YouTube"}
          </button>
        )}
      </div>

      {note && <div className={`note note-${note.type}`}>{note.text}</div>}

      {channels === null && <div className="empty">Cargando…</div>}

      {channels && channels.length === 0 && (
        <div className="empty">
          <strong>Todavía no hay canales conectados</strong>
          {isAdmin ? "Pulsa “Conectar canal de YouTube” y autoriza con la cuenta dueña del canal." : "Pide al administrador que conecte los canales."}
        </div>
      )}

      <div className="stack">
        {channels && channels.map((ch) => (
          <ChannelCard key={ch.id} ch={ch} niches={niches} isAdmin={isAdmin}
                       onSave={save} onTest={test} onDisconnect={disconnect} />
        ))}
      </div>
    </>
  );
}

function ChannelCard({ ch, niches, isAdmin, onSave, onTest, onDisconnect }) {
  const [nicheId, setNicheId] = useState(ch.niche_id ?? "");
  const [links, setLinks] = useState(ch.channel_links || "");
  const dirty = String(nicheId) !== String(ch.niche_id ?? "") || links !== (ch.channel_links || "");

  return (
    <div className="card channel">
      {ch.thumbnail_url ? <img className="avatar" src={ch.thumbnail_url} alt="" /> : <div className="avatar" />}
      <div>
        <h3>{ch.title}</h3>
        <div className="mono">{ch.channel_id} · {ch.niche || "sin nicho"}</div>
        {isAdmin && (
          <div className="channel-form">
            <div className="field">
              <label>Nicho</label>
              <select className="select" value={nicheId} onChange={(e) => setNicheId(e.target.value)}>
                <option value="">— Sin nicho —</option>
                {niches.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Redes y enlaces propios (la IA los usa en las descripciones)</label>
              <textarea className="textarea" value={links} onChange={(e) => setLinks(e.target.value)}
                        placeholder={"Instagram: https://…\nTelegram: https://…"} />
            </div>
          </div>
        )}
      </div>
      {isAdmin && (
        <div className="channel-actions">
          <button className="btn btn-primary btn-sm" disabled={!dirty}
                  onClick={() => onSave(ch, { niche_id: nicheId === "" ? null : Number(nicheId), channel_links: links })}>
            Guardar
          </button>
          <button className="btn btn-sm" onClick={() => onTest(ch)}>Probar conexión</button>
          <button className="btn btn-sm btn-danger" onClick={() => onDisconnect(ch)}>Desconectar</button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Nichos ─────────────────────────── */
function Nichos() {
  const [niches, setNiches] = useState(null);
  const [name, setName] = useState("");
  const [note, setNote] = useState(null);

  async function load() {
    try { setNiches(await api("/niches")); }
    catch (err) { setNote({ type: "error", text: err.message }); setNiches([]); }
  }
  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    try {
      await api("/niches", { method: "POST", body: { name: name.trim(), ai_profile: "" } });
      setName(""); setNote({ type: "ok", text: `Nicho creado: ${name.trim()}` }); load();
    } catch (err) { setNote({ type: "error", text: err.message }); }
  }

  async function saveNiche(n, name, ai_profile) {
    try {
      await api(`/niches/${n.id}`, { method: "PUT", body: { name, ai_profile } });
      setNote({ type: "ok", text: `Guardado: ${name}` }); load();
    } catch (err) { setNote({ type: "error", text: err.message }); }
  }

  async function removeNiche(n) {
    if (!confirm(`¿Borrar el nicho "${n.name}"? Los canales que lo tengan quedarán sin nicho.`)) return;
    try {
      await api(`/niches/${n.id}`, { method: "DELETE" });
      setNote({ type: "ok", text: `Borrado: ${n.name}` }); load();
    } catch (err) { setNote({ type: "error", text: err.message }); }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Nichos</h1>
          <p>Cada nicho agrupa canales propios y canales monitoreados, y calibra cómo escribe la IA.</p>
        </div>
      </div>
      {note && <div className={`note note-${note.type}`}>{note.text}</div>}

      <form className="card row" onSubmit={create} style={{ marginBottom: 16 }}>
        <input className="input grow" placeholder="Nuevo nicho, ej. Psicología oscura" value={name}
               onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-primary" disabled={!name.trim()}>Crear nicho</button>
      </form>

      {niches === null && <div className="empty">Cargando…</div>}
      {niches && niches.length === 0 && (
        <div className="empty"><strong>Sin nichos todavía</strong>Crea el primero arriba: psicología oscura, dinero, meditación, horóscopo…</div>
      )}
      <div className="stack">
        {niches && niches.map((n) => <NicheCard key={n.id} n={n} onSave={saveNiche} onRemove={removeNiche} />)}
      </div>
    </>
  );
}

function NicheCard({ n, onSave, onRemove }) {
  const [profile, setProfile] = useState(n.ai_profile || "");
  const [name, setName] = useState(n.name);
  const dirty = profile !== (n.ai_profile || "") || name.trim() !== n.name;
  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 10 }}>
        <input className="input" style={{ maxWidth: 360, fontWeight: 600 }} value={name} onChange={(e) => setName(e.target.value)} />
        <span className="grow" />
        <button className="btn btn-sm btn-danger" onClick={() => onRemove(n)}>Borrar</button>
      </div>
      <div className="field">
        <label>Perfil para la IA (tono, público, estilo de título y descripción)</label>
        <textarea className="textarea" value={profile} onChange={(e) => setProfile(e.target.value)}
                  placeholder="Ej.: Público 30-55 años hispanohablante. Tono documental, serio, sin clickbait vacío. Títulos con una promesa concreta…" />
      </div>
      <button className="btn btn-primary btn-sm" disabled={!dirty || !name.trim()} onClick={() => onSave(n, name.trim(), profile)}>
        Guardar
      </button>
    </div>
  );
}

/* ─────────────────────────── Placeholder de secciones futuras ─────────────────────────── */
function Soon({ section }) {
  return (
    <div className="card soon-box">
      <div className="k">Función {section.key}</div>
      <h2>{section.label}</h2>
      <p>En construcción. Esta sección se activa cuando su parte del backend esté lista; la app ya está preparada para recibirla.</p>
    </div>
  );
}

/* ─────────────────────────── Shell ─────────────────────────── */
export default function App() {
  const [role, setRole] = useState(session.role);
  const [path, go] = useRoute();

  if (path === "/privacidad") return <Privacidad />;
  if (!role) return <Login onLogin={setRole} />;

  const visible = SECTIONS.filter((s) => s.roles.includes(role));
  const current = visible.find((s) => s.path === path) || visible.find((s) => s.path === "/metadata") || visible[0];
  if (current.path !== path) window.history.replaceState({}, "", current.path);

  function logout() { session.clear(); setRole(null); go("/"); }

  const groups = [...new Set(visible.map((s) => s.group || "Trabajo"))];

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand"><span className="brand-mark" />YouTube Manager</div>
        {groups.map((g) => (
          <div key={g}>
            <div className="rail-group">{g}</div>
            {visible.filter((s) => (s.group || "Trabajo") === g).map((s) => (
              <button key={s.path} className={`nav-item ${current.path === s.path ? "active" : ""} ${s.soon ? "soon" : ""}`}
                      onClick={() => go(s.path)}>
                <span className="nav-key">{s.key}</span>{s.label}
                {s.soon && <span className="tag">pronto</span>}
              </button>
            ))}
          </div>
        ))}
        <div className="rail-footer">
          <span className={`role-pill ${role}`}>{role}</span>
          <button className="link-btn" onClick={logout}>Salir</button>
        </div>
      </aside>
      <main className="main">
        {current.path === "/metadata" && <Metadata />}
        {current.path === "/canales" && <Canales />}
        {current.path === "/nichos" && <Nichos />}
        {current.soon && <Soon section={current} />}
      </main>
    </div>
  );
}
