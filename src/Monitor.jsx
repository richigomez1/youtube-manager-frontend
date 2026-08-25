import { useEffect, useState } from "react";
import { api, session } from "./api";

export const fmtNum = (n) => (n == null ? "—" : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k` : String(n));
export const fmtDateShort = (iso) => (iso ? new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short" }) : "—");

export function NicheSelect({ value, onChange, niches }) {
  return (
    <select className="select" style={{ maxWidth: 320 }} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Elige un nicho —</option>
      {niches.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
    </select>
  );
}

export function useNiches() {
  const [niches, setNiches] = useState([]);
  const [nicheId, setNicheId] = useState(() => sessionStorage.getItem("ym_niche") || "");
  useEffect(() => {
    api("/niches").then((n) => {
      setNiches(n);
      if (!nicheId && n.length) { setNicheId(String(n[0].id)); sessionStorage.setItem("ym_niche", String(n[0].id)); }
    }).catch(() => {});
  }, []);
  const set = (v) => { setNicheId(v); sessionStorage.setItem("ym_niche", v); };
  return { niches, nicheId, setNicheId: set };
}

export default function Monitor() {
  const { niches, nicheId, setNicheId } = useNiches();
  const [channels, setChannels] = useState(null);
  const [ref, setRef] = useState("");
  const [lang, setLang] = useState("es");
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState("");
  const [showTh, setShowTh] = useState(false);
  const isAdmin = session.isAdmin;

  async function load() {
    if (!nicheId) return;
    setChannels(null);
    try { setChannels(await api(`/monitor/channels?niche_id=${nicheId}`)); }
    catch (e) { setNote({ type: "error", text: e.message }); setChannels([]); }
  }
  useEffect(() => { load(); }, [nicheId]);

  async function add(e) {
    e.preventDefault();
    setBusy("add"); setNote(null);
    try {
      const c = await api("/monitor/channels", { method: "POST", body: { niche_id: Number(nicheId), ref: ref.trim(), language: lang } });
      setRef(""); setNote({ type: "ok", text: `Agregado: ${c.title} (${fmtNum(c.subscriber_count)} suscriptores). Ya tiene su primer snapshot.` });
      load();
    } catch (err) { setNote({ type: "error", text: err.message }); }
    finally { setBusy(""); }
  }

  async function remove(c) {
    if (!confirm(`¿Quitar “${c.title}” del monitor? Se borra su historial.`)) return;
    try { await api(`/monitor/channels/${c.id}`, { method: "DELETE" }); load(); }
    catch (err) { setNote({ type: "error", text: err.message }); }
  }

  async function setLangFor(c, language) {
    try { await api(`/monitor/channels/${c.id}`, { method: "PUT", body: { language } }); load(); }
    catch (err) { setNote({ type: "error", text: err.message }); }
  }

  async function runSnapshot() {
    setBusy("snap"); setNote(null);
    try {
      const r = await api("/monitor/snapshot/run", { method: "POST" });
      setNote({ type: "ok", text: `Snapshot hecho: ${r.channels} canales, ${r.keywords_added} palabras clave nuevas. Cuota hoy: ${r.quota.units_used}/${r.quota.units_limit}.` + (r.errors.length ? ` Errores: ${r.errors.map((x) => x.channel).join(", ")}` : "") });
      load();
    } catch (err) { setNote({ type: "error", text: err.message }); }
    finally { setBusy(""); }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Monitor por nicho</h1>
          <p>Los canales de la competencia que seguimos. Cada día se guarda un snapshot de sus videos y vistas.</p>
        </div>
        {isAdmin && (
          <div className="row">
            <button className="btn btn-sm" onClick={() => setShowTh(!showTh)}>Umbrales 🔥</button>
            <button className="btn btn-primary" onClick={runSnapshot} disabled={busy !== ""}>
              {busy === "snap" ? "Leyendo YouTube…" : "Snapshot ahora"}
            </button>
          </div>
        )}
      </div>

      {note && <div className={`note note-${note.type}`}>{note.text}</div>}
      {showTh && <Thresholds onClose={() => setShowTh(false)} />}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ flexWrap: "wrap", gap: 12 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Nicho</label>
            <NicheSelect value={nicheId} onChange={setNicheId} niches={niches} />
          </div>
          {isAdmin && nicheId && (
            <form className="row grow" onSubmit={add} style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
              <div className="field grow" style={{ marginBottom: 0, minWidth: 260 }}>
                <label>Agregar canal (URL, @handle o id)</label>
                <input className="input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="https://www.youtube.com/@canal" />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Idioma</label>
                <select className="select" value={lang} onChange={(e) => setLang(e.target.value)}>
                  <option value="es">ES</option><option value="en">EN</option><option value="pt">PT</option>
                </select>
              </div>
              <button className="btn btn-red" disabled={!ref.trim() || busy !== ""}>{busy === "add" ? "Agregando…" : "Agregar"}</button>
            </form>
          )}
        </div>
      </div>

      {channels === null && nicheId && <div className="empty">Cargando…</div>}
      {channels && channels.length === 0 && (
        <div className="empty"><strong>Este nicho no tiene canales todavía</strong>Pega arriba la URL de un canal de la competencia. Con 5-10 por nicho el ranking empieza a hablar.</div>
      )}

      {channels && channels.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Canal</th><th>Subs</th><th>+7d</th><th>Mediana vistas</th><th>Videos/sem</th><th>Idioma</th><th>Último snapshot</th><th></th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="row">
                      <img src={c.thumbnail_url} alt="" className="avatar-sm" />
                      <div>
                        <a href={c.url} target="_blank" rel="noreferrer" className="strong">{c.title}</a>
                        <div className="mono">{c.handle}{c.channel_created_at ? ` · desde ${new Date(c.channel_created_at).getFullYear()}` : ""}</div>
                      </div>
                    </div>
                  </td>
                  <td className="mono">{fmtNum(c.subscriber_count)}</td>
                  <td className={`mono ${c.subs_gained_7d > 0 ? "up" : ""}`}>{c.subs_gained_7d ? `+${fmtNum(c.subs_gained_7d)}` : "—"}</td>
                  <td className="mono">{fmtNum(c.avg_views_recent)}</td>
                  <td className="mono">{c.videos_per_week}</td>
                  <td>
                    {isAdmin ? (
                      <select className="select select-sm" value={c.language || ""} onChange={(e) => setLangFor(c, e.target.value)}>
                        <option value="">—</option><option value="es">ES</option><option value="en">EN</option><option value="pt">PT</option>
                      </select>
                    ) : (c.language || "—").toUpperCase()}
                  </td>
                  <td className="mono">{fmtDateShort(c.last_snapshot_at)}</td>
                  <td>{isAdmin && <button className="btn btn-sm btn-danger" onClick={() => remove(c)}>Quitar</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Thresholds({ onClose }) {
  const [th, setTh] = useState(null);
  const [note, setNote] = useState(null);
  useEffect(() => { api("/monitor/thresholds").then(setTh).catch((e) => setNote(e.message)); }, []);
  if (!th) return null;
  const setTier = (i, k, val) => setTh({ ...th, tiers: th.tiers.map((t, j) => (j === i ? { ...t, [k]: Number(val) } : t)) });
  async function save() {
    try { await api("/monitor/thresholds", { method: "PUT", body: th }); setNote("Guardado."); }
    catch (e) { setNote(e.message); }
  }
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <strong>Umbrales de viral por tamaño de canal</strong>
        <button className="link-btn dark" onClick={onClose}>Cerrar</button>
      </div>
      <table className="table compact">
        <thead><tr><th>Canal hasta (subs)</th><th>🔥 viral desde (vistas)</th><th>🔥🔥 muy viral desde</th></tr></thead>
        <tbody>
          {th.tiers.map((t, i) => (
            <tr key={i}>
              <td><input className="input" type="number" value={t.max_subs} onChange={(e) => setTier(i, "max_subs", e.target.value)} /></td>
              <td><input className="input" type="number" value={t.fire} onChange={(e) => setTier(i, "fire", e.target.value)} /></td>
              <td><input className="input" type="number" value={t.fire2} onChange={(e) => setTier(i, "fire2", e.target.value)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row" style={{ flexWrap: "wrap", gap: 16, marginTop: 12 }}>
        <label className="mono">Canales grandes: viral si ≥ <input className="input inline" type="number" step="0.5" value={th.big_channel_multiplier} onChange={(e) => setTh({ ...th, big_channel_multiplier: Number(e.target.value) })} /> × su mediana</label>
        <label className="mono">"Canal pequeño" hasta <input className="input inline" type="number" value={th.small_channel_max_subs} onChange={(e) => setTh({ ...th, small_channel_max_subs: Number(e.target.value) })} /> subs</label>
        <label className="mono">Un viral vive en el ranking <input className="input inline" type="number" value={th.ranking_window_days} onChange={(e) => setTh({ ...th, ranking_window_days: Number(e.target.value) })} /> días</label>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={save}>Guardar umbrales</button>
        {note && <span className="mono">{note}</span>}
      </div>
    </div>
  );
}
