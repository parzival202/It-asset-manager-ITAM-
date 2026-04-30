import { useState } from "react";
import { useMeta } from "../hooks/useMeta";

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day:"2-digit", month:"short", year:"numeric" });
}

function duration(start, end) {
  if (!start) return null;
  const ms   = (end ? new Date(end) : new Date()) - new Date(start);
  const days = Math.floor(ms / 86400000);
  if (days < 1)   return "Moins d'un jour";
  if (days < 30)  return `${days} jour${days > 1 ? "s" : ""}`;
  if (days < 365) return `${Math.floor(days / 30)} mois`;
  const y = Math.floor(days / 365);
  const m = Math.floor((days % 365) / 30);
  return m > 0 ? `${y} an${y > 1 ? "s" : ""} ${m} mois` : `${y} an${y > 1 ? "s" : ""}`;
}

function initials(name) {
  return (name || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

// ─── Modal nouvelle affectation ──────────────────────────────────────
function AssignModal({ assetId, current, onClose, onSave }) {
  const meta  = useMeta();
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm]   = useState({
    user_name: "", user_title: "",
    site_id: "", department_id: "",
    started_at: today, reason: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const set   = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const depts = meta.deptsBySite(form.site_id);

  async function submit(e) {
    e.preventDefault();
    if (!form.user_name.trim()) { setError("Le nom est requis"); return; }
    setLoading(true); setError("");
    try {
      await onSave({ ...form, asset_id: assetId });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <h3>Nouvelle affectation</h3>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"var(--text2)",cursor:"pointer",fontSize:20 }}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {error && <div className="error-msg">{error}</div>}
            {current && (
              <div style={{ background:"rgba(251,191,36,0.08)", border:"1px solid rgba(251,191,36,0.25)", borderRadius:6, padding:"10px 14px", marginBottom:16, fontSize:12, color:"var(--warning)" }}>
                ⚠ L'affectation de <strong>{current.user_name}</strong> sera automatiquement clôturée à la date de début saisie.
              </div>
            )}
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Nom complet *</label>
                <input className="form-input" required value={form.user_name} onChange={e => set("user_name", e.target.value)} placeholder="Kouamé Diabaté" />
              </div>
              <div className="form-group">
                <label className="form-label">Titre / Poste</label>
                <input className="form-input" value={form.user_title} onChange={e => set("user_title", e.target.value)} placeholder="Responsable qualité" />
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Site</label>
                <select className="form-input form-select" value={form.site_id} onChange={e => { set("site_id", e.target.value); set("department_id", ""); }}>
                  <option value="">— Choisir —</option>
                  {meta.sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Service</label>
                <select className="form-input form-select" value={form.department_id} onChange={e => set("department_id", e.target.value)}>
                  <option value="">— Choisir —</option>
                  {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Date de début *</label>
              <input className="form-input" type="date" required value={form.started_at} onChange={e => set("started_at", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Motif</label>
              <input className="form-input" value={form.reason} onChange={e => set("reason", e.target.value)} placeholder="Nouveau poste, remplacement, mutation..." />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Enregistrement..." : "Affecter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal clôture ────────────────────────────────────────────────────
function CloseModal({ assignment, onClose, onSave }) {
  const today              = new Date().toISOString().split("T")[0];
  const [ended_at, setEnd] = useState(today);
  const [reason, setReason]= useState("");
  const [loading, setLoad] = useState(false);

  async function submit(e) {
    e.preventDefault(); setLoad(true);
    try { await onSave(assignment.id, { ended_at, reason }); onClose(); }
    catch (err) { alert(err.message); }
    finally { setLoad(false); }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h3>Clôturer l'affectation</h3>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"var(--text2)",cursor:"pointer",fontSize:20 }}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <p style={{ fontSize:13, color:"var(--text2)", marginBottom:16, lineHeight:1.6 }}>
              Fin de l'affectation de <strong style={{ color:"var(--text)" }}>{assignment.user_name}</strong>.<br/>
              <span style={{ fontSize:11, color:"var(--text3)" }}>Affecté depuis le {fmtDate(assignment.started_at)} · {duration(assignment.started_at, null)}</span>
            </p>
            <div className="form-group">
              <label className="form-label">Date de fin *</label>
              <input className="form-input" type="date" required value={ended_at} onChange={e => setEnd(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Motif</label>
              <input className="form-input" value={reason} onChange={e => setReason(e.target.value)} placeholder="Départ, mutation, remplacement..." />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Enregistrement..." : "Clôturer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────
export default function AssignmentTimeline({
  assetId, assignments, current, history,
  loading, onCreate, onClose: onCloseAssign
}) {
  const [showAssign, setShowAssign] = useState(false);
  const [showClose,  setShowClose]  = useState(false);

  if (loading) {
    return (
      <div className="card">
        <div style={{ display:"flex", justifyContent:"center", padding:20 }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {/* En-tête */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <div className="section-title" style={{ margin:0 }}>
          Historique des affectations
          {assignments.length > 0 && (
            <span style={{ marginLeft:8, fontSize:11, fontWeight:400, color:"var(--text3)" }}>
              {assignments.length} au total
            </span>
          )}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {current && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowClose(true)}>
              Clôturer
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => setShowAssign(true)}>
            + Affecter
          </button>
        </div>
      </div>

      {/* Affectation active */}
      {current ? (
        <div style={{
          background:"rgba(79,142,247,0.06)", border:"1px solid rgba(79,142,247,0.2)",
          borderRadius:8, padding:"14px 16px", marginBottom:history.length ? 20 : 0
        }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{
                width:38, height:38, borderRadius:"50%", flexShrink:0,
                background:"var(--accent)", color:"#fff",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:13, fontWeight:600
              }}>
                {initials(current.user_name)}
              </div>
              <div>
                <div style={{ fontSize:14, fontWeight:500 }}>{current.user_name}</div>
                {current.user_title && (
                  <div style={{ fontSize:11, color:"var(--text3)" }}>{current.user_title}</div>
                )}
              </div>
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
              {current.site_name       && <span className="badge badge-info">{current.site_name}</span>}
              {current.department_name && <span className="badge badge-neutral">{current.department_name}</span>}
              <span className="badge badge-success">En cours</span>
            </div>
          </div>
          <div style={{ marginTop:10, fontSize:12, color:"var(--text2)", display:"flex", gap:16, flexWrap:"wrap" }}>
            <span>📅 Depuis le {fmtDate(current.started_at)}</span>
            <span>⏱ {duration(current.started_at, null)}</span>
            {current.reason      && <span>📌 {current.reason}</span>}
            {current.assigned_by && <span>👤 Par : {current.assigned_by}</span>}
          </div>
        </div>
      ) : (
        <div style={{ padding:"10px 0", marginBottom: history.length ? 16 : 0, fontSize:13, color:"var(--text3)" }}>
          Aucune affectation active.
        </div>
      )}

      {/* Historique */}
      {history.length > 0 && (
        <>
          <div className="section-title" style={{ marginBottom:10 }}>
            Historique
          </div>
          <div className="timeline">
            {history.map((a, i) => (
              <div key={a.id} className="tl-item">
                <div className="tl-dot tl-dot-blue" style={{ marginTop:5, flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:6 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{
                        width:26, height:26, borderRadius:"50%", flexShrink:0,
                        background:"var(--bg3)", color:"var(--text2)",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:10, fontWeight:600
                      }}>
                        {initials(a.user_name)}
                      </div>
                      <span style={{ fontSize:13, fontWeight:500 }}>{a.user_name}</span>
                      {a.user_title && (
                        <span style={{ fontSize:11, color:"var(--text3)" }}>{a.user_title}</span>
                      )}
                    </div>
                    <span className="badge badge-neutral" style={{ fontSize:10 }}>
                      {duration(a.started_at, a.ended_at)}
                    </span>
                  </div>
                  <div className="tl-meta" style={{ marginTop:4 }}>
                    {fmtDate(a.started_at)} → {fmtDate(a.ended_at)}
                    {a.site_name       && ` · ${a.site_name}`}
                    {a.department_name && ` / ${a.department_name}`}
                  </div>
                  {a.reason      && <div style={{ fontSize:11, color:"var(--text2)", marginTop:2 }}>📌 {a.reason}</div>}
                  {a.assigned_by && <div style={{ fontSize:11, color:"var(--text3)", marginTop:1 }}>Par : {a.assigned_by}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Aucune affectation du tout */}
      {assignments.length === 0 && (
        <div className="empty-state" style={{ padding:"20px 0" }}>
          <p>Aucune affectation enregistrée pour cet équipement</p>
        </div>
      )}

      {showAssign && (
        <AssignModal
          assetId={assetId}
          current={current}
          onClose={() => setShowAssign(false)}
          onSave={onCreate}
        />
      )}
      {showClose && current && (
        <CloseModal
          assignment={current}
          onClose={() => setShowClose(false)}
          onSave={onCloseAssign}
        />
      )}
    </div>
  );
}
