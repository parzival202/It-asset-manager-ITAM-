import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import Layout from "../../components/Layout";
import DataTable from "../../components/DataTable";
import { useInterventions } from "../../hooks/useInterventions";
import { useAlerts } from "../../hooks/useAlerts";
import { useMeta } from "../../hooks/useMeta";
import { useAssets } from "../../hooks/useAssets";

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day:"2-digit", month:"short", year:"numeric" });
}
function fmtDuration(min) {
  if (!min) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min/60), m = min%60;
  return m > 0 ? `${h}h${String(m).padStart(2,"0")}` : `${h}h`;
}
function n(v) { return (v === undefined || v === "") ? null : v; }

const STATUS_LABELS = { done:"Terminée", in_progress:"En cours", planned:"Planifiée" };
const STATUS_COLORS = { done:"success", in_progress:"warning", planned:"info" };

function InterventionModal({ intervention, meta, assets, consumables, onClose, onSave }) {
  const isEdit = !!intervention;
  const today  = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState(intervention ? {...intervention, consumables: intervention.consumables_json ? JSON.parse(intervention.consumables_json) : []} : { status:"done", date: today, consumables:[] });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const set = (k,v) => setForm(f => ({...f, [k]: v}));
  const depts = meta.deptsBySite(form.site_id);
  const addConsumable=()=>set("consumables",[...(form.consumables||[]),{consumable_id:"",quantity:1}]);
  const changeConsumable=(i,k,v)=>set("consumables",form.consumables.map((x,n)=>n===i?{...x,[k]:v}:x));

  async function submit(e) {
    e.preventDefault();
    if (!form.title?.trim()) { setError("Le titre est requis"); return; }
    if (!form.date)           { setError("La date est requise"); return; }
    setLoading(true); setError("");
    try { await onSave(form); onClose(); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:560 }}>
        <div className="modal-header">
          <h3>{isEdit ? "Modifier l'intervention" : "Nouvelle intervention"}</h3>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--text2)",cursor:"pointer",fontSize:20}}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {error && <div className="error-msg">{error}</div>}

            <div className="form-group">
              <label className="form-label">Titre *</label>
              <input className="form-input" value={form.title||""} onChange={e=>set("title",e.target.value)}
                placeholder="Ex: Changement cartouche — Service Comptabilité"/>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-input" rows={3} value={form.description||""} onChange={e=>set("description",e.target.value)}
                placeholder="Détails de l'intervention, observations, actions réalisées..."/>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Site</label>
                <select className="form-input form-select" value={form.site_id||""} onChange={e=>{set("site_id",e.target.value);set("department_id","");}}>
                  <option value="">— Choisir —</option>
                  {meta.sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Service concerné</label>
                <select className="form-input form-select" value={form.department_id||""} onChange={e=>set("department_id",e.target.value)}>
                  <option value="">— Choisir —</option>
                  {depts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group" style={{borderTop:"1px solid var(--border)",paddingTop:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><label className="form-label" style={{margin:0}}>Consommables utilisés</label><button type="button" className="btn btn-ghost btn-sm" onClick={addConsumable}>+ Ajouter</button></div>
              <div style={{fontSize:11,color:"var(--text3)",marginBottom:8}}>Les quantités sont déduites seulement lorsque l’intervention est terminée.</div>
              {(form.consumables||[]).map((line,i)=><div key={i} style={{display:"flex",gap:8,marginBottom:7}}>
                <select className="form-input form-select" style={{flex:1}} value={line.consumable_id} onChange={e=>changeConsumable(i,"consumable_id",e.target.value)}><option value="">— Consommable —</option>{consumables.map(c=><option key={c.id} value={c.id}>{c.name} · stock: {c.stock_qty}</option>)}</select>
                <input className="form-input" style={{width:72}} type="number" min="1" value={line.quantity} onChange={e=>changeConsumable(i,"quantity",e.target.value)}/><button type="button" className="btn btn-ghost btn-sm" onClick={()=>set("consumables",form.consumables.filter((_,n)=>n!==i))}>×</button>
              </div>)}
            </div>

            <div className="form-group">
              <label className="form-label">Equipement concerné <span style={{color:"var(--text3)",fontSize:11}}>(optionnel)</span></label>
              <select className="form-input form-select" value={form.asset_id||""} onChange={e=>set("asset_id",e.target.value)}>
                <option value="">— Aucun / Non identifié —</option>
                {assets.map(a=><option key={a.id} value={a.id}>{a.name} ({a.asset_tag})</option>)}
              </select>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input className="form-input" type="date" value={form.date||""} onChange={e=>set("date",e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">Durée (minutes)</label>
                <input className="form-input" type="number" min="1" value={form.duration_min||""} onChange={e=>set("duration_min",e.target.value)} placeholder="30"/>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Technicien</label>
                <input className="form-input" value={form.performed_by||""} onChange={e=>set("performed_by",e.target.value)} placeholder="Nom du technicien"/>
              </div>
              <div className="form-group">
                <label className="form-label">Statut</label>
                <select className="form-input form-select" value={form.status||"done"} onChange={e=>set("status",e.target.value)}>
                  {Object.entries(STATUS_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Enregistrement..." : isEdit ? "Modifier" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DetailModal({ item, onClose }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:500 }}>
        <div className="modal-header">
          <h3>{item.title}</h3>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--text2)",cursor:"pointer",fontSize:20}}>×</button>
        </div>
        <div className="modal-body">
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
            <span className={`badge badge-${STATUS_COLORS[item.status]||"neutral"}`}>{STATUS_LABELS[item.status]||item.status}</span>
            {item.site_name       && <span className="badge badge-info">{item.site_name}</span>}
            {item.department_name && <span className="badge badge-neutral">{item.department_name}</span>}
          </div>

          <div className="kv"><span className="kv-label">Date</span><span className="kv-val">{fmtDate(item.date)}</span></div>
          <div className="kv"><span className="kv-label">Durée</span><span className="kv-val">{fmtDuration(item.duration_min)}</span></div>
          <div className="kv"><span className="kv-label">Technicien</span><span className="kv-val">{item.performed_by||"—"}</span></div>
          {item.asset_name && <div className="kv"><span className="kv-label">Equipement</span><span className="kv-val">{item.asset_name} <span className="mono" style={{fontSize:11}}>({item.asset_tag})</span></span></div>}

          {item.description && (
            <div style={{marginTop:16}}>
              <div className="section-title" style={{marginBottom:8}}>Description</div>
              <div style={{fontSize:13,color:"var(--text2)",lineHeight:1.7,borderLeft:"3px solid var(--border2)",paddingLeft:12}}>
                {item.description}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

export default function Interventions() {
  const [filters, setFilters] = useState({ site_id:"", department_id:"" });
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail]   = useState(null);
  const { interventions, loading, create, update, remove } = useInterventions(filters);
  const { alertCount } = useAlerts();
  const meta           = useMeta();
  const { assets }     = useAssets({});
  const [consumables,setConsumables]=useState([]);
  useEffect(()=>{api.consumables.list().then(setConsumables).catch(()=>{});},[]);
  const depts          = meta.deptsBySite(filters.site_id);

  async function handleSave(form) {
    if (editing) await update(editing.id, form);
    else await create(form);
  }

  const COLUMNS = [
    {
      label:"Titre", accessor:"title", sortable:true,
      render: r => (
        <div>
          <div style={{fontWeight:500}}>{r.title}</div>
          {r.description && <div style={{fontSize:11,color:"var(--text3)",marginTop:2,maxWidth:280,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.description}</div>}
        </div>
      )
    },
    {
      label:"Service", accessor:"department_name", sortable:true,
      render: r => (
        <div>
          <div style={{fontSize:13}}>{r.department_name||"—"}</div>
          {r.site_name && <div style={{fontSize:11,color:"var(--text3)"}}>{r.site_name}</div>}
        </div>
      )
    },
    { label:"Equipement",  accessor:"asset_name",    sortable:true, render: r => r.asset_name ? <div><div style={{fontSize:13}}>{r.asset_name}</div><div className="mono" style={{fontSize:11}}>{r.asset_tag}</div></div> : <span className="text-faint">—</span> },
    { label:"Technicien",  accessor:"performed_by",  sortable:true, render: r => r.performed_by || <span className="text-faint">—</span> },
    { label:"Date",        accessor:"date",          sortable:true, render: r => fmtDate(r.date) },
    { label:"Durée",       accessor:"duration_min",  sortable:true, render: r => fmtDuration(r.duration_min) },
    { label:"Statut",      accessor:"status",        sortable:true, render: r => <span className={`badge badge-${STATUS_COLORS[r.status]||"neutral"}`}>{STATUS_LABELS[r.status]||r.status}</span> },
    {
      label:"", key:"actions",
      render: r => (
        <div style={{display:"flex",gap:6}}>
          <button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();setDetail(r);}}>Voir</button>
          <button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();setEditing(r);setModal(true);}}>Modifier</button>
        </div>
      )
    },
  ];

  const totalDuration = interventions.reduce((s, i) => s + (i.duration_min || 0), 0);

  return (
    <Layout title="Interventions" alertCount={alertCount} actions={
      <button className="btn btn-primary" onClick={() => { setEditing(null); setModal(true); }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
        Nouvelle intervention
      </button>
    }>
      {/* Stats */}
      <div className="stats-grid mb-20">
        <div className="stat-card">
          <div className="stat-label">Total</div>
          <div className="stat-value">{interventions.length}</div>
          <div className="stat-sub">interventions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Terminées</div>
          <div className="stat-value" style={{color:"var(--success)"}}>{interventions.filter(i=>i.status==="done").length}</div>
          <div className="stat-sub">réalisées</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">En cours</div>
          <div className="stat-value" style={{color:"var(--warning)"}}>{interventions.filter(i=>i.status==="in_progress").length}</div>
          <div className="stat-sub">en attente</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Temps total</div>
          <div className="stat-value" style={{fontSize:22}}>{fmtDuration(totalDuration)}</div>
          <div className="stat-sub">interventions filtrées</div>
        </div>
      </div>

      {/* Filtres */}
      <DataTable
        columns={COLUMNS}
        data={interventions}
        loading={loading}
        emptyMessage="Aucune intervention enregistrée"
        onRowClick={row => setDetail(row)}
        searchable
        searchPlaceholder="Titre, service, technicien..."
        pageSize={25}
        filters={
          <>
            <select className="form-input form-select" style={{width:150}} value={filters.site_id} onChange={e=>setFilters(f=>({...f,site_id:e.target.value,department_id:""}))}>
              <option value="">Tous les sites</option>
              {meta.sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select className="form-input form-select" style={{width:200}} value={filters.department_id} onChange={e=>setFilters(f=>({...f,department_id:e.target.value}))}>
              <option value="">Tous les services</option>
              {depts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {(filters.site_id||filters.department_id) && <button className="btn btn-ghost btn-sm" onClick={()=>setFilters({site_id:"",department_id:""})}>Effacer</button>}
          </>
        }
      />

      {modal && <InterventionModal intervention={editing} meta={meta} assets={assets} consumables={consumables} onClose={()=>{setModal(false);setEditing(null);}} onSave={handleSave}/>}
      {detail && <DetailModal item={detail} onClose={()=>setDetail(null)}/>}
    </Layout>
  );
}
