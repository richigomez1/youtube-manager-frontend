import { useEffect, useState } from "react";
import { api, session } from "./api";
import examples from "./exampleTemplate";

const EMPTY = { own_channel_id: "", name: "", language: "en", date_offset_days: 1, title_template: "", description_template: "", tags_template: "" };

export default function Plantillas() {
  const [templates, setTemplates] = useState(null);
  const [channels, setChannels] = useState([]);
  const [meta, setMeta] = useState(null);
  const [editing, setEditing] = useState(null);   // null | {...form}
  const [note, setNote] = useState(null);
  const isAdmin = session.isAdmin;

  async function load() {
    try {
      const [t, c, m] = await Promise.all([api("/templates"), api("/own-channels"), api("/templates/meta")]);
      setTemplates(t); setChannels(c); setMeta(m);
    } catch (e) { setNote({ type: "error", text: e.message }); setTemplates([]); }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    const body = { ...editing, own_channel_id: editing.own_channel_id ? Number(editing.own_channel_id) : null, date_offset_days: Number(editing.date_offset_days) };
    try {
      if (editing.id) await api(`/templates/${editing.id}`, { method: "PUT", body });
      else await api("/templates", { method: "POST", body });
      setNote({ type: "ok", text: `Guardada: ${editing.name}` }); setEditing(null); load();
    } catch (e) { setNote({ type: "error", text: e.message }); }
  }

  async function remove(t) {
    if (!confirm(`¿Borrar la plantilla "${t.name}"?`)) return;
    try { await api(`/templates/${t.id}`, { method: "DELETE" }); load(); }
    catch (e) { setNote({ type: "error", text: e.message }); }
  }

  const f = (k) => (e) => setEditing({ ...editing, [k]: e.target.value });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Descripciones rotativas</h1>
          <p>Plantillas con variables (fecha, signo…). La extensión de Chrome las rellena dentro de YouTube Studio; aquí se crean y se prueban.</p>
        </div>
        {isAdmin && !editing && (
          <div className="row">
            {examples.map((ex) => (
              <button key={ex.name} className="btn" onClick={() => setEditing({ ...EMPTY, ...ex, own_channel_id: "" })}>Cargar: {ex.name}</button>
            ))}
            <button className="btn btn-red" onClick={() => setEditing({ ...EMPTY })}>Nueva plantilla</button>
          </div>
        )}
      </div>

      {note && <div className={`note note-${note.type}`}>{note.text}</div>}

      {editing && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="row" style={{ flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
            <div className="field grow" style={{ marginBottom: 0, minWidth: 220 }}>
              <label>Nombre</label>
              <input className="input" value={editing.name} onChange={f("name")} placeholder="Horóscopo PT" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Canal</label>
              <select className="select" value={editing.own_channel_id ?? ""} onChange={f("own_channel_id")}>
                <option value="">— cualquiera —</option>
                {channels.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Idioma (fechas y signos)</label>
              <select className="select" value={editing.language} onChange={f("language")}>
                <option value="es">Español</option><option value="en">English</option><option value="pt">Português</option>
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Fecha a usar</label>
              <select className="select" value={editing.date_offset_days} onChange={f("date_offset_days")}>
                <option value={0}>Hoy</option><option value={1}>Mañana</option><option value={2}>Pasado mañana</option>
              </select>
            </div>
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label>Título (opcional; si lo dejas vacío, el título lo pones tú)</label>
            <input className="input" value={editing.title_template} onChange={f("title_template")} placeholder="{signo} horoscope today {fecha} {emoji}" />
          </div>
          <div className="field">
            <label>Descripción</label>
            <textarea className="textarea" style={{ minHeight: 260, fontFamily: "var(--font-mono)", fontSize: 12 }} value={editing.description_template} onChange={f("description_template")} />
          </div>
          <div className="field">
            <label>Etiquetas (separadas por coma; admiten variables)</label>
            <textarea className="textarea" style={{ minHeight: 70, fontFamily: "var(--font-mono)", fontSize: 12 }} value={editing.tags_template} onChange={f("tags_template")} />
          </div>
          {meta && (
            <div className="vars">
              {meta.variables.map(([k, ex]) => <span key={k} className="var" title={ex} onClick={() => navigator.clipboard.writeText(k)}>{k}</span>)}
              <span className="mono">· clic para copiar</span>
            </div>
          )}
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={save} disabled={!editing.name.trim()}>Guardar plantilla</button>
            <button className="btn" onClick={() => setEditing(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {templates === null && <div className="empty">Cargando…</div>}
      {templates && templates.length === 0 && !editing && (
        <div className="empty"><strong>Sin plantillas todavía</strong>Crea una nueva o carga el ejemplo de Zodiac Attraction para empezar.</div>
      )}

      <div className="stack">
        {templates && templates.map((t) => (
          <TemplateCard key={t.id} t={t} meta={meta} channels={channels} isAdmin={isAdmin}
                        onEdit={() => setEditing({ ...t, own_channel_id: t.own_channel_id ?? "" })} onRemove={() => remove(t)} setNote={setNote} />
        ))}
      </div>
    </>
  );
}

function TemplateCard({ t, meta, channels, isAdmin, onEdit, onRemove, setNote }) {
  const [sign, setSign] = useState(6);
  const [out, setOut] = useState(null);
  const [videoId, setVideoId] = useState("");
  const [writeTitle, setWriteTitle] = useState(!!t.title_template);
  const [busy, setBusy] = useState(false);
  const signs = meta?.signs?.[t.language] || [];

  async function preview() {
    try { setOut(await api(`/templates/${t.id}/render`, { method: "POST", body: { sign_index: t.uses_sign ? sign : null } })); }
    catch (e) { setNote({ type: "error", text: e.message }); }
  }
  useEffect(() => { preview(); }, [sign, t.id]);

  async function applyTo() {
    const id = videoId.trim().match(/([\w-]{11})(?:[?&]|$)/)?.[1] || videoId.trim();
    if (!confirm(`Esto reemplaza la descripción${writeTitle ? ", el título" : ""} y las etiquetas del video ${id}. ¿Continuar?`)) return;
    setBusy(true);
    try {
      const r = await api(`/templates/${t.id}/apply`, { method: "POST", body: { sign_index: t.uses_sign ? sign : null, video_id: id, write_title: writeTitle } });
      setNote({ type: "ok", text: `Aplicado al video ${id} con fecha ${r.date_used}.` });
    } catch (e) { setNote({ type: "error", text: e.message }); }
    finally { setBusy(false); }
  }

  const copy = (txt, label) => { navigator.clipboard.writeText(txt); setNote({ type: "ok", text: `${label} copiado al portapapeles.` }); };

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h3 style={{ margin: 0 }}>{t.name}</h3>
          <div className="mono">{t.language.toUpperCase()} · fecha: {["hoy", "mañana", "pasado mañana"][t.date_offset_days] || `+${t.date_offset_days} d`} · {t.channel_title || "cualquier canal"}</div>
        </div>
        {isAdmin && <div className="row"><button className="btn btn-sm" onClick={onEdit}>Editar</button><button className="btn btn-sm btn-danger" onClick={onRemove}>Borrar</button></div>}
      </div>

      <div className="row" style={{ marginTop: 12, flexWrap: "wrap", gap: 10 }}>
        {t.uses_sign && (
          <select className="select" style={{ maxWidth: 200 }} value={sign} onChange={(e) => setSign(Number(e.target.value))}>
            {signs.map((s, i) => <option key={s} value={i}>{meta.emojis[i]} {s}</option>)}
          </select>
        )}
        {out && <span className="mono">Fecha usada: {out.date_used}</span>}
        <span className="grow" />
        {out && <>
          {out.title && <button className="btn btn-sm" onClick={() => copy(out.title, "Título")}>Copiar título</button>}
          <button className="btn btn-sm" onClick={() => copy(out.description, "Descripción")}>Copiar descripción</button>
          {out.tags.length > 0 && <button className="btn btn-sm" onClick={() => copy(out.tags.join(","), "Etiquetas")}>Copiar etiquetas</button>}
        </>}
      </div>

      {out && (
        <>
          {out.title && <div className="preview-title">{out.title}</div>}
          <pre className="preview">{out.description}</pre>
          {out.tags.length > 0 && <div className="mono" style={{ marginTop: 6 }}>Etiquetas ({out.tags.length}): {out.tags.join(", ")}</div>}
        </>
      )}

      {t.own_channel_id && (
        <div className="row" style={{ marginTop: 12, flexWrap: "wrap", gap: 10 }}>
          <input className="input" style={{ maxWidth: 360 }} placeholder="Aplicar a un video ya subido: pega URL o id" value={videoId} onChange={(e) => setVideoId(e.target.value)} />
          {t.title_template && <label className="check"><input type="checkbox" checked={writeTitle} onChange={(e) => setWriteTitle(e.target.checked)} /> también el título</label>}
          <button className="btn btn-primary btn-sm" disabled={!videoId.trim() || busy} onClick={applyTo}>{busy ? "Aplicando…" : "Aplicar al video"}</button>
        </div>
      )}
    </div>
  );
}
