import { useEffect, useState } from "react";
import { api } from "./api";

function fmtDuration(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}
function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" }) : "";
}

export default function Metadata() {
  const [channels, setChannels] = useState([]);
  const [channelId, setChannelId] = useState("");
  const [videos, setVideos] = useState(null);
  const [video, setVideo] = useState(null);
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState(null);
  const [quota, setQuota] = useState(null);

  useEffect(() => {
    api("/own-channels").then((c) => {
      setChannels(c);
      if (c.length === 1) setChannelId(String(c[0].id));
    }).catch((e) => setNote({ type: "error", text: e.message }));
  }, []);

  useEffect(() => {
    if (!channelId) return;
    setVideos(null); setVideo(null); setResult(null); setNote(null);
    api(`/metadata/videos/${channelId}`)
      .then((r) => { setVideos(r.videos); setQuota(r.quota); })
      .catch((e) => { setNote({ type: "error", text: e.message }); setVideos([]); });
  }, [channelId]);

  async function generate() {
    setBusy("generate"); setNote(null); setResult(null);
    try {
      const r = await api("/metadata/generate", {
        method: "POST", body: { own_channel_id: Number(channelId), video_id: video.video_id, notes },
      });
      setResult(r); setQuota(r.quota);
      setNote({
        type: r.transcript_source === "oficial" ? "ok" : "warn",
        text: r.transcript_source === "oficial"
          ? `Metadata generada a partir de los subtítulos del video (${r.transcript_chars.toLocaleString()} caracteres). Revisa y aplica.`
          : `Generada con la vía de respaldo para subtítulos (no oficial). Revisa y aplica.`,
      });
    } catch (e) { setNote({ type: "error", text: e.message }); }
    finally { setBusy(""); }
  }

  async function applyToVideo() {
    if (!confirm(`Esto reemplaza título, descripción y etiquetas del video "${video.title}" en YouTube. ¿Continuar?`)) return;
    setBusy("apply"); setNote(null);
    try {
      const r = await api("/metadata/apply", {
        method: "POST",
        body: {
          own_channel_id: Number(channelId), video_id: video.video_id, history_id: result.history_id,
          title: result.title, description: result.description, tags: result.tags,
        },
      });
      setQuota(r.quota);
      setNote({ type: "ok", text: "Aplicado en YouTube. Puede tardar un minuto en verse en Studio." });
      setVideos((list) => list.map((v) => (v.video_id === video.video_id ? { ...v, title: result.title, applied_by_app: true } : v)));
    } catch (e) { setNote({ type: "error", text: e.message }); }
    finally { setBusy(""); }
  }

  const set = (k) => (e) => setResult({ ...result, [k]: e.target.value });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Metadata de un clic</h1>
          <p>Elige un video de tu canal, genera título, descripción con capítulos, etiquetas y hashtags, revisa y aplica.</p>
        </div>
        {quota && <div className="mono">Cuota hoy: {quota.units_used.toLocaleString()} / {quota.units_limit.toLocaleString()}</div>}
      </div>

      {note && <div className={`note note-${note.type}`}>{note.text}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="field" style={{ maxWidth: 420, marginBottom: 0 }}>
          <label>Canal</label>
          <select className="select" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
            <option value="">— Elige un canal —</option>
            {channels.map((c) => <option key={c.id} value={c.id}>{c.title}{c.niche ? ` · ${c.niche}` : ""}</option>)}
          </select>
        </div>
      </div>

      {channelId && videos === null && <div className="empty">Cargando videos del canal…</div>}
      {videos && videos.length === 0 && <div className="empty"><strong>Este canal no tiene videos</strong>Sube uno y vuelve.</div>}

      {videos && videos.length > 0 && !video && (
        <div className="video-grid">
          {videos.map((v) => (
            <button key={v.video_id} className="video-card" onClick={() => { setVideo(v); setResult(null); setNote(null); }}>
              <img src={v.thumbnail_url} alt="" />
              <div className="video-meta">
                <div className="video-title">{v.title}</div>
                <div className="mono">
                  {fmtDuration(v.duration_seconds)} · {fmtDate(v.published_at)} · {v.privacy}
                  {v.applied_by_app && " · ✓ app"}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {video && (
        <div className="stack">
          <div className="card channel" style={{ gridTemplateColumns: "120px 1fr auto" }}>
            <img src={video.thumbnail_url} alt="" style={{ width: 120, borderRadius: 8 }} />
            <div>
              <h3>{video.title}</h3>
              <div className="mono">{fmtDuration(video.duration_seconds)} · {fmtDate(video.published_at)} · {video.views.toLocaleString()} vistas</div>
              <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
                <label>Indicaciones extra para la IA (opcional)</label>
                <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)}
                       placeholder="Ej.: enfocar el título en la ansiedad; mencionar que es parte 2" />
              </div>
            </div>
            <div className="channel-actions">
              <button className="btn btn-red" onClick={generate} disabled={busy !== ""}>
                {busy === "generate" ? "Generando… (30-60 s)" : result ? "Generar de nuevo" : "Generar metadata"}
              </button>
              <button className="btn btn-sm" onClick={() => { setVideo(null); setResult(null); setNote(null); }} disabled={busy !== ""}>
                Elegir otro video
              </button>
              <div className="mono" style={{ textAlign: "center" }}>≈252 unidades por generación</div>
            </div>
          </div>

          {result && (
            <div className="card">
              <div className="field">
                <label>Título ({result.title.length}/100) · palabra clave: <strong>{result.keyword}</strong></label>
                <input className="input" value={result.title} onChange={set("title")} maxLength={100} />
              </div>
              {result.title_alternatives?.length > 0 && (
                <div className="alt-titles">
                  {result.title_alternatives.map((t) => (
                    <button key={t} className="btn btn-sm" onClick={() => setResult({ ...result, title: t })}>{t}</button>
                  ))}
                </div>
              )}
              <div className="field">
                <label>Descripción ({result.description.length}/5000)</label>
                <textarea className="textarea" style={{ minHeight: 320, fontFamily: "var(--font-mono)", fontSize: 13 }}
                          value={result.description} onChange={set("description")} maxLength={5000} />
              </div>
              <div className="field">
                <label>Etiquetas ({result.tags.length}) — separadas por coma</label>
                <textarea className="textarea" style={{ minHeight: 70 }} value={result.tags.join(", ")}
                          onChange={(e) => setResult({ ...result, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} />
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="mono">Hashtags: {result.hashtags.join(" ")}</div>
                <button className="btn btn-primary" onClick={applyToVideo} disabled={busy !== ""}>
                  {busy === "apply" ? "Aplicando…" : "Aplicar al video en YouTube"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
