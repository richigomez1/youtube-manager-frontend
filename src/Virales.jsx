import { useEffect, useState } from "react";
import { api } from "./api";
import { NicheSelect, useNiches, fmtNum } from "./Monitor";

const FIRE = ["", "🔥", "🔥🔥"];
const STATUS_LABEL = { "": "", elegido: "Elegido", en_produccion: "En producción", terminado: "Terminado", descartado: "Descartado" };

export default function Virales() {
  const { niches, nicheId, setNicheId } = useNiches();
  const [data, setData] = useState(null);
  const [smallOnly, setSmallOnly] = useState(false);
  const [includeDone, setIncludeDone] = useState(false);
  const [note, setNote] = useState(null);
  const [open, setOpen] = useState(null);
  const [rising, setRising] = useState([]);

  async function load() {
    if (!nicheId) return;
    setData(null);
    try {
      const [r, rs] = await Promise.all([
        api(`/monitor/ranking?niche_id=${nicheId}&limit=15&small_only=${smallOnly}&include_done=${includeDone}`),
        api(`/monitor/rising?niche_id=${nicheId}`),
      ]);
      setData(r); setRising(rs);
    } catch (e) { setNote({ type: "error", text: e.message }); setData({ items: [], total: 0 }); }
  }
  useEffect(() => { load(); }, [nicheId, smallOnly, includeDone]);

  async function setStatus(item, status) {
    try {
      await api(`/monitor/videos/${item.id}/status`, { method: "PUT", body: { status } });
      setData((d) => ({ ...d, items: d.items.map((x) => (x.id === item.id ? { ...x, status } : x)) }));
      if (status === "terminado" || status === "descartado") setTimeout(load, 300);
    } catch (e) { setNote({ type: "error", text: e.message }); }
  }

  const smallRising = rising.filter((c) => c.small && c.fire_videos > 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Virales de hoy</h1>
          <p>Ranking del nicho. El #1 es el recomendado para producir. Se quedan mientras sigan virales o hasta marcarlos terminados.</p>
        </div>
        {data?.quota && <div className="mono">Cuota hoy: {data.quota.units_used.toLocaleString()} / {data.quota.units_limit.toLocaleString()}</div>}
      </div>

      {note && <div className={`note note-${note.type}`}>{note.text}</div>}

      <div className="card row" style={{ marginBottom: 16, flexWrap: "wrap", gap: 16 }}>
        <NicheSelect value={nicheId} onChange={setNicheId} niches={niches} />
        <label className="check"><input type="checkbox" checked={smallOnly} onChange={(e) => setSmallOnly(e.target.checked)} /> Solo canales pequeños</label>
        <label className="check"><input type="checkbox" checked={includeDone} onChange={(e) => setIncludeDone(e.target.checked)} /> Ver terminados/descartados</label>
      </div>

      {data && !data.has_velocity && data.items.length > 0 && (
        <div className="note note-warn">Primer día de datos: el orden usa la atipicidad (vistas ÷ mediana del canal). A partir del segundo snapshot entra la velocidad (vistas ganadas por día).</div>
      )}

      {smallRising.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderColor: "var(--red)" }}>
          <strong>Canales con potencial</strong>
          <div className="mono" style={{ marginBottom: 8 }}>Canales pequeños con videos por encima de su umbral: el tema tira solo.</div>
          <div className="chips">
            {smallRising.map((c) => (
              <a key={c.id} className="chip" href={c.url} target="_blank" rel="noreferrer">
                <img src={c.thumbnail_url} alt="" /> {c.title} · {fmtNum(c.subscriber_count)} subs · {c.fire_videos} 🔥
                {c.channel_age_days != null && c.channel_age_days < 365 && <span className="tag-new">nuevo</span>}
              </a>
            ))}
          </div>
        </div>
      )}

      {data === null && nicheId && <div className="empty">Cargando ranking…</div>}
      {data && data.items.length === 0 && (
        <div className="empty">
          <strong>Sin virales todavía en este nicho</strong>
          Agrega canales en el Monitor y haz un snapshot. Un video entra aquí cuando cruza el umbral 🔥 de su tamaño de canal.
        </div>
      )}

      <div className="stack">
        {data && data.items.map((it) => (
          <div key={it.id} className={`card viral ${it.status ? "st-" + it.status : ""}`}>
            <div className="rank">#{it.rank}</div>
            <a href={it.url} target="_blank" rel="noreferrer"><img className="viral-thumb" src={it.thumbnail_url} alt="" /></a>
            <div className="viral-body">
              <div className="viral-title">
                <span className="fire">{FIRE[it.fire_level]}</span>
                <a href={it.url} target="_blank" rel="noreferrer">{it.title}</a>
              </div>
              <div className="mono">
                {it.channel.title} · {fmtNum(it.channel.subscriber_count)} subs · {(it.channel.language || "").toUpperCase()}
                {it.age_days != null && ` · hace ${Math.round(it.age_days)} d`} · {Math.floor(it.duration_seconds / 60)} min
              </div>
              <div className="stats">
                <span><b>{fmtNum(it.views)}</b> vistas</span>
                <span><b>{it.outlier_score}×</b> su mediana</span>
                <span><b>{it.velocity_per_day ? `+${fmtNum(it.velocity_per_day)}` : "—"}</b> / día</span>
                {it.views_at_7d != null && <span><b>{fmtNum(it.views_at_7d)}</b> a 7 días</span>}
              </div>
              {it.keyword && <div className="keyword">🔑 {it.keyword}</div>}
              <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                <button className="btn btn-sm" onClick={() => setOpen(open === it.id ? null : it.id)}>{open === it.id ? "Cerrar" : "Ver datos"}</button>
                {!it.status && <button className="btn btn-sm btn-primary" onClick={() => setStatus(it, "elegido")}>Elegir este</button>}
                {it.status === "elegido" && <button className="btn btn-sm btn-primary" onClick={() => setStatus(it, "en_produccion")}>Pasar a producción</button>}
                {it.status === "en_produccion" && <button className="btn btn-sm btn-primary" onClick={() => setStatus(it, "terminado")}>Marcar publicado</button>}
                {it.status && it.status !== "terminado" && it.status !== "descartado" && <button className="btn btn-sm" onClick={() => setStatus(it, "")}>Quitar estado</button>}
                {!it.status && <button className="btn btn-sm btn-danger" onClick={() => setStatus(it, "descartado")}>Descartar</button>}
                {it.status && <span className={`pill st-${it.status}`}>{STATUS_LABEL[it.status]}</span>}
              </div>
              {open === it.id && <VideoData id={it.id} />}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function VideoData({ id }) {
  const [v, setV] = useState(null);
  useEffect(() => { api(`/monitor/videos/${id}`).then(setV).catch(() => {}); }, [id]);
  if (!v) return <div className="mono" style={{ marginTop: 10 }}>Cargando…</div>;
  return (
    <div className="video-data">
      <div className="field">
        <label>Etiquetas ({v.tags.length}) — copiables tal cual</label>
        <textarea className="textarea" readOnly value={v.tags.join(", ")} style={{ minHeight: 60 }} onFocus={(e) => e.target.select()} />
      </div>
      <div className="field">
        <label>Descripción original (solo lectura; el análisis para re-escribirla llega en la siguiente función)</label>
        <textarea className="textarea" readOnly value={v.description} style={{ minHeight: 140, fontFamily: "var(--font-mono)", fontSize: 12 }} />
      </div>
      {v.history.length > 1 && (
        <div className="mono">Vistas por día: {v.history.map((h) => `${h.day.slice(5)}: ${fmtNum(h.views)}`).join(" · ")}</div>
      )}
    </div>
  );
}

export function Miniaturas() {
  const { niches, nicheId, setNicheId } = useNiches();
  const [items, setItems] = useState(null);
  useEffect(() => {
    if (!nicheId) return;
    setItems(null);
    api(`/monitor/thumbnails?niche_id=${nicheId}`).then(setItems).catch(() => setItems([]));
  }, [nicheId]);
  return (
    <>
      <div className="page-head">
        <div><h1>Miniaturas del nicho</h1><p>Las portadas de los videos que mejor rinden, para estudiar patrones antes de diseñar la tuya.</p></div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}><NicheSelect value={nicheId} onChange={setNicheId} niches={niches} /></div>
      {items === null && nicheId && <div className="empty">Cargando…</div>}
      {items && items.length === 0 && <div className="empty"><strong>Nada todavía</strong>Agrega canales al monitor y haz un snapshot.</div>}
      {items && items.length > 0 && (
        <div className="thumb-grid">
          {items.map((it) => (
            <a key={it.id} className="thumb-card" href={it.url} target="_blank" rel="noreferrer">
              <img src={it.thumbnail_url} alt="" />
              <div className="thumb-meta"><span className="fire">{FIRE[it.fire_level]}</span> {fmtNum(it.views)} · {it.outlier_score}× · {it.channel.title}</div>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
