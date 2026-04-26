import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../components/Layout";
import { api } from "../../lib/api";

const TYPE_LABELS = { laptop:"Laptop", screen:"Ecran", uc:"UC", printer:"Imprimante" };
const STATUS_COLORS = { in_service:"success", maintenance:"warning", retired:"neutral", storage:"info" };
const STATUS_LABELS = { in_service:"En service", maintenance:"En maintenance", retired:"Retiré", storage:"En stock" };
const MAINT_TYPES = { preventive:"Preventive", corrective:"Corrective", replacement:"Remplacement", deployment:"Deploiement" };
const MAINT_STATUS_COLORS = { planned:"info", in_progress:"warning", completed:"success", cancelled:"neutral" };
const MAINT_STATUS_LABELS = { planned:"Planifiée", in_progress:"En cours", completed:"Terminée", cancelled:"Annulée" };

function fmtDate(d) { if (!d) return "—"; return new Date(d).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"}); }
function fmtDateTime(d) { if (!d) return "—"; return new Date(d).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"}); }
function daysAgo(d) { if (!d) return null; const n=Math.round((Date.now()-new Date(d))/86400000); return n===0?"aujourd'hui":n===1?"hier":`il y a ${n} jours`; }
function daysFrom(d) { if (!d) return null; const n=Math.round((new Date(d)-Date.now())/86400000); if (n<0) return `expiré il y a ${-n} j`; if (n===0) return "aujourd'hui"; return `dans ${n} jours`; }
function lifePercent(purchase, endOfLife) {
  if (!purchase||!endOfLife) return null;
  const total=new Date(endOfLife)-new Date(purchase); const elapsed=Date.now()-new Date(purchase);
  return Math.min(100,Math.max(0,Math.round(elapsed/total*100)));
}

function MaintModal({ assetId, meta, maint, onClose, onSave }) {
  const [form, setForm] = useState(maint||{asset_id:assetId,type:"preventive",status:"planned"});
  const [loading, setLoading] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  async function submit(e) {
    e.preventDefault(); setLoading(true);
    try { await onSave(form); onClose(); } catch(err){alert(err.message);} finally{setLoading(false);}
  }
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{maint?"Modifier la maintenance":"Nouvelle intervention"}</h3>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--text2)",cursor:"pointer",fontSize:20}}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="form-group"><label className="form-label">Titre *</label><input className="form-input" required value={form.title||""} onChange={e=>set("title",e.target.value)}/></div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Type</label>
                <select className="form-input form-select" value={form.type||"preventive"} onChange={e=>set("type",e.target.value)}>
                  {Object.entries(MAINT_TYPES).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Statut</label>
                <select className="form-input form-select" value={form.status||"planned"} onChange={e=>set("status",e.target.value)}>
                  {Object.entries(MAINT_STATUS_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Date planifiée</label><input className="form-input" type="date" value={form.scheduled_date||""} onChange={e=>set("scheduled_date",e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Technicien</label>
                <select className="form-input form-select" value={form.performed_by_user_id||""} onChange={e=>set("performed_by_user_id",e.target.value)}>
                  <option value="">— Assigner —</option>
                  {(meta?.users||[]).map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Description</label><textarea className="form-input" value={form.description||""} onChange={e=>set("description",e.target.value)}/></div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Pièce remplacée</label><input className="form-input" value={form.replacement_part||""} onChange={e=>set("replacement_part",e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Coût (FCFA)</label><input className="form-input" type="number" value={form.cost||""} onChange={e=>set("cost",e.target.value)}/></div>
            </div>
            <div className="form-group"><label className="form-label">Notes de résolution</label><textarea className="form-input" value={form.resolution_notes||""} onChange={e=>set("resolution_notes",e.target.value)}/></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading?"Enregistrement...":"Enregistrer"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function KV({ label, value, children }) {
  return (
    <div className="kv">
      <span className="kv-label">{label}</span>
      <span className="kv-val">{children || value || "—"}</span>
    </div>
  );
}

const TL_COLORS = { preventive:"tl-dot-green", corrective:"tl-dot-red", replacement:"tl-dot-amber", deployment:"tl-dot-blue", default:"tl-dot-blue" };

export default function AssetDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editingMaint, setEditingMaint] = useState(null);
  const [alertCount, setAlertCount] = useState(0);

  async function load() {
    if (!id) return;
    const [asset, m, al] = await Promise.all([api.assets.get(id), api.meta(), api.alerts.list()]);
    setData(asset); setMeta(m); setAlertCount(al.length);
  }
  useEffect(()=>{ load().finally(()=>setLoading(false)); },[id]);

  async function handleMaintSave(form) {
    if (editingMaint) await api.maintenances.update(editingMaint.id, form);
    else await api.maintenances.create({...form, asset_id:id});
    await load();
  }

  const warrantyDays = data?.warranty_end_date ? Math.round((new Date(data.warranty_end_date)-Date.now())/86400000) : null;
  const lifeP = data ? lifePercent(data.purchase_date, data.planned_end_of_life) : null;
  const maintenanceCount = data?.maintenances?.length || 0;
  const panneCount = (data?.maintenances||[]).filter(m=>m.type==="corrective").length;
  const pieceCount = (data?.maintenances||[]).filter(m=>m.replacement_part).length;
  const lastMaint = (data?.maintenances||[]).find(m=>m.status==="completed"&&m.completed_at);
  const nextMaint = (data?.maintenances||[]).filter(m=>m.status==="planned"&&m.scheduled_date).sort((a,b)=>new Date(a.scheduled_date)-new Date(b.scheduled_date))[0];

  if (loading) return <Layout title="Chargement..."><div style={{display:"flex",justifyContent:"center",padding:60}}><div className="spinner"/></div></Layout>;
  if (!data) return <Layout title="Erreur"><div className="card"><p className="text-muted">Equipement introuvable.</p></div></Layout>;

  return (
    <Layout title="Carnet de santé" alertCount={alertCount} actions={
      <div style={{display:"flex",gap:10}}>
        <button className="btn btn-ghost" onClick={()=>router.push("/assets")}>← Retour</button>
        <button className="btn btn-primary" onClick={()=>{setEditingMaint(null);setModal(true);}}>+ Intervention</button>
      </div>
    }>
      {/* En-tête */}
      <div className="card mb-16" style={{padding:"16px 20px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:44,height:44,background:"rgba(79,142,247,0.12)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            </div>
            <div>
              <div style={{fontSize:17,fontWeight:600}}>{data.name}</div>
              <div style={{fontSize:12,color:"var(--text2)"}}>{TYPE_LABELS[data.type]||data.type} · <span className="mono">{data.serial_number||data.asset_tag}</span></div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <span className={`badge badge-${STATUS_COLORS[data.status]||"neutral"}`}>{STATUS_LABELS[data.status]||data.status}</span>
            {data.site_name && <span className="badge badge-info">{data.site_name}</span>}
            {data.department_name && <span className="badge badge-neutral">{data.department_name}</span>}
          </div>
        </div>
      </div>

      <div className="grid2 mb-16">
        {/* Identité */}
        <div className="card">
          <div className="section-title">Identité</div>
          <KV label="Tag">{<span className="mono" style={{fontSize:12}}>{data.asset_tag}</span>}</KV>
          <KV label="Marque / Modèle">{data.brand&&data.model?`${data.brand} ${data.model}`:data.brand||data.model||"—"}</KV>
          <KV label="N° de série">{data.serial_number?<span className="mono" style={{fontSize:12}}>{data.serial_number}</span>:"—"}</KV>
          <KV label="OS / Version" value={data.operating_system}/>
          <KV label="RAM / Stockage">{data.ram&&data.storage?`${data.ram} · ${data.storage}`:data.ram||data.storage||"—"}</KV>
        </div>
        {/* Affectation */}
        <div className="card">
          <div className="section-title">Affectation</div>
          {data.assigned_user_name ? (
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid var(--border)"}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,color:"#fff",flexShrink:0}}>
                {data.assigned_user_name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase()}
              </div>
              <div>
                <div style={{fontSize:13,fontWeight:500}}>{data.assigned_user_name}</div>
                {data.assigned_user_title&&<div style={{fontSize:11,color:"var(--text3)"}}>{data.assigned_user_title}</div>}
              </div>
            </div>
          ) : <div className="kv"><span className="kv-label">Utilisateur</span><span className="text-faint text-xs">Non assigné</span></div>}
          <KV label="Site" value={data.site_name}/>
          <KV label="Service" value={data.department_name}/>
          <KV label="Déployé le" value={fmtDate(data.deployment_date)}/>
          {data.deployment_date && <KV label="Durée en service">{daysAgo(data.deployment_date)}</KV>}
        </div>
      </div>

      <div className="grid2 mb-16">
        {/* Cycle de vie */}
        <div className="card">
          <div className="section-title">Cycle de vie</div>
          <KV label="Date d'achat" value={fmtDate(data.purchase_date)}/>
          <KV label="Prix d'achat">{data.purchase_price?`${Number(data.purchase_price).toLocaleString("fr-FR")} FCFA`:"—"}</KV>
          <KV label="Fournisseur" value={data.supplier}/>
          <KV label="Fin de garantie">
            {data.warranty_end_date
              ? <span className={`badge ${warrantyDays<0?"badge-danger":warrantyDays<30?"badge-warning":"badge-success"}`}>{fmtDate(data.warranty_end_date)} ({daysFrom(data.warranty_end_date)})</span>
              : "—"}
          </KV>
          <KV label="Fin de vie prévue" value={fmtDate(data.planned_end_of_life)}/>
          {lifeP !== null && (
            <div style={{marginTop:10}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--text2)"}}><span>Vie utile</span><span>{lifeP}%</span></div>
              <div className="health-bar"><div className="health-fill" style={{width:`${lifeP}%`,background:lifeP>80?"var(--danger)":lifeP>60?"var(--warning)":"var(--accent)"}}/></div>
            </div>
          )}
        </div>
        {/* Santé */}
        <div className="card">
          <div className="section-title">Statut de santé</div>
          <KV label="Dernière maintenance">{lastMaint?`${fmtDate(lastMaint.completed_at)} (${daysAgo(lastMaint.completed_at)})`:"—"}</KV>
          <KV label="Prochaine maintenance">
            {nextMaint
              ? <span className={`badge ${(new Date(nextMaint.scheduled_date)-Date.now())/86400000<7?"badge-warning":"badge-info"}`}>{fmtDate(nextMaint.scheduled_date)} ({daysFrom(nextMaint.scheduled_date)})</span>
              : "—"}
          </KV>
          <KV label="Nb maintenances">{maintenanceCount} au total</KV>
          <KV label="Pannes historiques">{panneCount}</KV>
          <KV label="Pièces remplacées">{pieceCount}</KV>
          <KV label="Alertes actives">
            {(data.alerts||[]).filter(a=>a.status==="active").length > 0
              ? <span className="badge badge-warning">{(data.alerts||[]).filter(a=>a.status==="active").length} alerte(s)</span>
              : <span className="badge badge-success">Aucune</span>}
          </KV>
        </div>
      </div>

      {/* Timeline maintenances */}
      <div className="card mb-16">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div className="section-title" style={{margin:0}}>Historique des interventions</div>
          <button className="btn btn-ghost btn-sm" onClick={()=>{setEditingMaint(null);setModal(true);}}>+ Ajouter</button>
        </div>
        {(data.maintenances||[]).length === 0 && <div className="empty-state"><p>Aucune intervention enregistrée</p></div>}
        <div className="timeline">
          {(data.maintenances||[]).map(m => (
            <div key={m.id} className="tl-item">
              <div className={`tl-dot ${TL_COLORS[m.type]||TL_COLORS.default}`}/>
              <div style={{flex:1}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                  <span style={{fontSize:13,fontWeight:500}}>{m.title}</span>
                  <div style={{display:"flex",gap:6}}>
                    <span className="badge badge-neutral" style={{fontSize:10}}>{MAINT_TYPES[m.type]||m.type}</span>
                    <span className={`badge badge-${MAINT_STATUS_COLORS[m.status]||"neutral"}`} style={{fontSize:10}}>{MAINT_STATUS_LABELS[m.status]||m.status}</span>
                  </div>
                </div>
                <div className="tl-meta">
                  {m.scheduled_date&&`Planifiée: ${fmtDate(m.scheduled_date)}`}
                  {m.completed_at&&` · Terminée: ${fmtDate(m.completed_at)}`}
                </div>
                {(m.tech_name||m.performed_by_name)&&<div className="tl-by">👤 {m.tech_name||m.performed_by_name}</div>}
                {m.description&&<div style={{fontSize:12,color:"var(--text2)",marginTop:4}}>{m.description}</div>}
                {m.replacement_part&&<div style={{fontSize:12,color:"var(--warning)",marginTop:3}}>🔧 Pièce: {m.replacement_part}</div>}
                {m.resolution_notes&&<div style={{fontSize:12,color:"var(--success)",marginTop:3}}>✓ {m.resolution_notes}</div>}
                {m.cost&&<div style={{fontSize:12,color:"var(--text3)",marginTop:3}}>Coût: {Number(m.cost).toLocaleString("fr-FR")} FCFA</div>}
              </div>
              <button className="btn btn-ghost btn-sm" style={{flexShrink:0}} onClick={()=>{setEditingMaint(m);setModal(true);}}>Modifier</button>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      {data.notes && (
        <div className="card">
          <div className="section-title">Notes techniques</div>
          <div style={{fontSize:13,color:"var(--text2)",lineHeight:1.7,borderLeft:"3px solid var(--border2)",paddingLeft:14}}>{data.notes}</div>
        </div>
      )}

      {modal && <MaintModal assetId={id} meta={meta} maint={editingMaint} onClose={()=>{setModal(false);setEditingMaint(null);}} onSave={handleMaintSave}/>}
    </Layout>
  );
}
