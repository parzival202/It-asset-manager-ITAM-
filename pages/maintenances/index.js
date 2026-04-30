import { useState } from "react";
import Layout from "../../components/Layout";
import DataTable from "../../components/DataTable";
import { useMaintenances } from "../../hooks/useMaintenances";
import { useAlerts } from "../../hooks/useAlerts";
import { useMeta } from "../../hooks/useMeta";
import { useAssets } from "../../hooks/useAssets";

const MAINT_TYPES   = { preventive:"Préventive", corrective:"Corrective", replacement:"Remplacement", deployment:"Déploiement" };
const STATUS_COLORS = { planned:"info", in_progress:"warning", completed:"success", cancelled:"neutral" };
const STATUS_LABELS = { planned:"Planifiée", in_progress:"En cours", completed:"Terminée", cancelled:"Annulée" };

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day:"2-digit", month:"short", year:"numeric" });
}

function n(v) { return (v === undefined || v === "") ? null : v; }

function MaintModal({ onClose, onSave, assets, meta }) {
  const [form, setForm] = useState({ type:"preventive", status:"planned" });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const set = (k,v) => setForm(f => ({...f, [k]: v}));

  async function submit(e) {
    e.preventDefault();
    if (!form.asset_id) { setError("Veuillez choisir un équipement"); return; }
    if (!form.title)    { setError("Le titre est requis"); return; }
    setLoading(true); setError("");
    try {
      await onSave({
        asset_id:             Number(form.asset_id),
        type:                 form.type,
        status:               form.status || "planned",
        title:                n(form.title),
        description:          n(form.description),
        scheduled_date:       n(form.scheduled_date),
        performed_by_user_id: n(form.performed_by_user_id) ? Number(form.performed_by_user_id) : null,
        replacement_part:     n(form.replacement_part),
        resolution_notes:     n(form.resolution_notes),
        cost:                 n(form.cost) ? Number(form.cost) : null,
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>Nouvelle maintenance</h3>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--text2)",cursor:"pointer",fontSize:20}}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {error && <div className="error-msg">{error}</div>}

            <div className="form-group">
              <label className="form-label">Equipement *</label>
              <select className="form-input form-select" value={form.asset_id||""} onChange={e=>set("asset_id",e.target.value)}>
                <option value="">— Choisir un équipement —</option>
                {assets.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.asset_tag})</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Titre *</label>
              <input className="form-input" value={form.title||""} onChange={e=>set("title",e.target.value)} placeholder="Ex: Maintenance préventive trimestrielle"/>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-input form-select" value={form.type} onChange={e=>set("type",e.target.value)}>
                  {Object.entries(MAINT_TYPES).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Statut</label>
                <select className="form-input form-select" value={form.status} onChange={e=>set("status",e.target.value)}>
                  {Object.entries(STATUS_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Date planifiée</label>
                <input className="form-input" type="date" value={form.scheduled_date||""} onChange={e=>set("scheduled_date",e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">Technicien</label>
                <select className="form-input form-select" value={form.performed_by_user_id||""} onChange={e=>set("performed_by_user_id",e.target.value)}>
                  <option value="">— Assigner —</option>
                  {(meta?.users||[]).map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-input" value={form.description||""} onChange={e=>set("description",e.target.value)} placeholder="Détails de l'intervention..."/>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Pièce remplacée</label>
                <input className="form-input" value={form.replacement_part||""} onChange={e=>set("replacement_part",e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">Coût (FCFA)</label>
                <input className="form-input" type="number" value={form.cost||""} onChange={e=>set("cost",e.target.value)}/>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes de résolution</label>
              <textarea className="form-input" value={form.resolution_notes||""} onChange={e=>set("resolution_notes",e.target.value)}/>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Enregistrement..." : "Créer la maintenance"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Maintenances() {
  const [filters, setFilters]     = useState({ status:"", type:"" });
  const [modal, setModal]         = useState(false);
  const { maintenances, loading, create, markDone } = useMaintenances(filters);
  const { alertCount }            = useAlerts();
  const meta                      = useMeta();
  const { assets }                = useAssets({});

  const COLUMNS = [
    {
      label:"Titre", accessor:"title", sortable:true,
      render: r => (
        <div>
          <div style={{fontWeight:500}}>{r.title}</div>
          {r.description && <div style={{fontSize:11,color:"var(--text3)",marginTop:2,maxWidth:260,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.description}</div>}
        </div>
      )
    },
    { label:"Type", accessor:"type", sortable:true, render: r => <span className="badge badge-neutral">{MAINT_TYPES[r.type]||r.type}</span> },
    {
      label:"Equipement", accessor:"asset_name", sortable:true,
      render: r => (
        <div>
          <div style={{fontSize:13}}>{r.asset_name||"—"}</div>
          {r.asset_tag && <div className="mono" style={{fontSize:11}}>{r.asset_tag}</div>}
        </div>
      )
    },
    {
      label:"Technicien", accessor:"tech_name", sortable:true,
      render: r => r.tech_name || r.performed_by_name || <span className="text-faint">—</span>
    },
    { label:"Planifiée",  accessor:"scheduled_date", sortable:true, render: r => fmtDate(r.scheduled_date) },
    { label:"Terminée",   accessor:"completed_at",   sortable:true, render: r => fmtDate(r.completed_at) },
    {
      label:"Statut", accessor:"status", sortable:true,
      render: r => <span className={`badge badge-${STATUS_COLORS[r.status]||"neutral"}`}>{STATUS_LABELS[r.status]||r.status}</span>
    },
    {
      label:"", key:"actions",
      render: r => (r.status==="planned"||r.status==="in_progress") && (
        <button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();markDone(r.id);}}>✓ Terminer</button>
      )
    },
  ];

  return (
    <Layout title="Maintenances" alertCount={alertCount} actions={
      <button className="btn btn-primary" onClick={() => setModal(true)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
        Ajouter
      </button>
    }>
      <DataTable
        columns={COLUMNS}
        data={maintenances}
        loading={loading}
        emptyMessage="Aucune maintenance trouvée"
        searchable
        searchPlaceholder="Titre, équipement, technicien..."
        pageSize={25}
        filters={
          <>
            <select className="form-input form-select" style={{width:170}} value={filters.status} onChange={e=>setFilters(f=>({...f,status:e.target.value}))}>
              <option value="">Tous les statuts</option>
              {Object.entries(STATUS_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
            <select className="form-input form-select" style={{width:160}} value={filters.type} onChange={e=>setFilters(f=>({...f,type:e.target.value}))}>
              <option value="">Tous les types</option>
              {Object.entries(MAINT_TYPES).map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
            {(filters.status||filters.type) && (
              <button className="btn btn-ghost btn-sm" onClick={()=>setFilters({status:"",type:""})}>Effacer</button>
            )}
          </>
        }
      />

      {modal && (
        <MaintModal
          assets={assets}
          meta={meta}
          onClose={() => setModal(false)}
          onSave={create}
        />
      )}
    </Layout>
  );
}
