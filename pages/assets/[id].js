import { useRouter } from "next/router";
import Layout from "../../components/Layout";
import { useAsset } from "../../hooks/useAsset";
import { useMaintenances } from "../../hooks/useMaintenances";
import { useAssignments } from "../../hooks/useAssignments";
import { useAlerts } from "../../hooks/useAlerts";
import { useMeta } from "../../hooks/useMeta";
import { useState } from "react";
import AssignmentTimeline from "../../components/AssignmentTimeline";

const TYPE_LABELS         = { laptop:"Laptop", screen:"Ecran", uc:"UC", printer:"Imprimante" };
const STATUS_COLORS       = { in_service:"success", maintenance:"warning", retired:"neutral", storage:"info" };
const STATUS_LABELS       = { in_service:"En service", maintenance:"En maintenance", retired:"Retiré", storage:"En stock" };
const MAINT_TYPES         = { preventive:"Préventive", corrective:"Corrective", replacement:"Remplacement", deployment:"Déploiement" };
const MAINT_STATUS_COLORS = { planned:"info", in_progress:"warning", completed:"success", cancelled:"neutral" };
const MAINT_STATUS_LABELS = { planned:"Planifiée", in_progress:"En cours", completed:"Terminée", cancelled:"Annulée" };
const TL_COLORS           = { preventive:"tl-dot-green", corrective:"tl-dot-red", replacement:"tl-dot-amber", deployment:"tl-dot-blue" };

function fmtDate(d) { if (!d) return "—"; return new Date(d).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"}); }
function daysAgo(d) { if (!d) return null; const n=Math.round((Date.now()-new Date(d))/86400000); return n===0?"aujourd'hui":n===1?"hier":`il y a ${n} jours`; }
function daysFrom(d) { if (!d) return null; const n=Math.round((new Date(d)-Date.now())/86400000); if(n<0)return`expiré il y a ${-n} j`; if(n===0)return"aujourd'hui"; return`dans ${n} jours`; }
function lifePercent(p,e){if(!p||!e)return null;return Math.min(100,Math.max(0,Math.round((Date.now()-new Date(p))/(new Date(e)-new Date(p))*100)));}
function initials(name){return(name||"?").split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase();}

function MaintModal({assetId,meta,maint,onClose,onSave}){
  const [form,setForm]=useState(maint||{asset_id:assetId,type:"preventive",status:"planned"});
  const [loading,setLoad]=useState(false);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  async function submit(e){e.preventDefault();setLoad(true);try{await onSave(form);onClose();}catch(err){alert(err.message);}finally{setLoad(false);}}
  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header"><h3>{maint?"Modifier l'intervention":"Nouvelle intervention"}</h3><button onClick={onClose} style={{background:"none",border:"none",color:"var(--text2)",cursor:"pointer",fontSize:20}}>×</button></div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="form-group"><label className="form-label">Titre *</label><input className="form-input" required value={form.title||""} onChange={e=>set("title",e.target.value)}/></div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Type</label>
                <select className="form-input form-select" value={form.type||"preventive"} onChange={e=>set("type",e.target.value)}>
                  {Object.entries(MAINT_TYPES).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Statut</label>
                <select className="form-input form-select" value={form.status||"planned"} onChange={e=>set("status",e.target.value)}>
                  {Object.entries(MAINT_STATUS_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Date planifiée</label><input className="form-input" type="date" value={form.scheduled_date||""} onChange={e=>set("scheduled_date",e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Technicien</label>
                <select className="form-input form-select" value={form.performed_by_user_id||""} onChange={e=>set("performed_by_user_id",e.target.value)}>
                  <option value="">— Assigner —</option>
                  {(meta?.users||[]).map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select></div>
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

function KV({label,value,children}){return(<div className="kv"><span className="kv-label">{label}</span><span className="kv-val">{children??value??"—"}</span></div>);}

export default function AssetDetail(){
  const router=useRouter();
  const {id}=router.query;
  const {asset,loading,reload}=useAsset(id);
  const {maintenances,create:createMaint,update:updateMaint}=useMaintenances({asset_id:id});
  const {assignments,current,history,loading:assignLoading,create:createAssign,close:closeAssign}=useAssignments(id);
  const {alertCount}=useAlerts();
  const meta=useMeta();
  const [modal,setModal]=useState(false);
  const [editingMaint,setEditingMaint]=useState(null);

  async function handleMaintSave(form){
    if(editingMaint) await updateMaint(editingMaint.id,form);
    else await createMaint({...form,asset_id:id});
    reload();
  }

  if(loading) return(<Layout title="Chargement..." alertCount={alertCount}><div style={{display:"flex",justifyContent:"center",padding:60}}><div className="spinner"/></div></Layout>);
  if(!asset)  return(<Layout title="Erreur" alertCount={alertCount}><div className="card"><p className="text-muted">Equipement introuvable.</p></div></Layout>);

  const warrantyDays=asset.warranty_end_date?Math.round((new Date(asset.warranty_end_date)-Date.now())/86400000):null;
  const lifeP=lifePercent(asset.purchase_date,asset.planned_end_of_life);
  const allMaint=asset.maintenances||maintenances;
  const lastMaint=allMaint.find(m=>m.status==="completed"&&m.completed_at);
  const nextMaint=allMaint.filter(m=>m.status==="planned"&&m.scheduled_date).sort((a,b)=>new Date(a.scheduled_date)-new Date(b.scheduled_date))[0];
  const activeAlerts=(asset.alerts||[]).filter(a=>a.status==="active");

  return(
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
              <div style={{fontSize:17,fontWeight:600}}>{asset.name}</div>
              <div style={{fontSize:12,color:"var(--text2)"}}>{TYPE_LABELS[asset.type]||asset.type} · <span className="mono">{asset.serial_number||asset.asset_tag}</span></div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <span className={`badge badge-${STATUS_COLORS[asset.status]||"neutral"}`}>{STATUS_LABELS[asset.status]||asset.status}</span>
            {asset.site_name&&<span className="badge badge-info">{asset.site_name}</span>}
            {asset.department_name&&<span className="badge badge-neutral">{asset.department_name}</span>}
          </div>
        </div>
      </div>

      {/* Identité + Affectation */}
      <div className="grid2 mb-16">
        <div className="card">
          <div className="section-title">Identité</div>
          <KV label="Tag"><span className="mono" style={{fontSize:12}}>{asset.asset_tag}</span></KV>
          <KV label="Marque / Modèle">{asset.brand&&asset.model?`${asset.brand} ${asset.model}`:asset.brand||asset.model||"—"}</KV>
          <KV label="N° de série">{asset.serial_number?<span className="mono" style={{fontSize:12}}>{asset.serial_number}</span>:"—"}</KV>
          <KV label="OS" value={asset.operating_system}/>
          <KV label="RAM / Stockage">{asset.ram&&asset.storage?`${asset.ram} · ${asset.storage}`:asset.ram||asset.storage||"—"}</KV>
        </div>
        <div className="card">
          <div className="section-title">Affectation actuelle</div>
          {current ? (
  <div style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid var(--border)",marginBottom:4}}>
    <div style={{width:32,height:32,borderRadius:"50%",background:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,color:"#fff",flexShrink:0}}>
      {initials(current.user_name)}
    </div>
    <div>
      <div style={{fontSize:13,fontWeight:500}}>{current.user_name}</div>
      {current.user_title && <div style={{fontSize:11,color:"var(--text3)"}}>{current.user_title}</div>}
    </div>
  </div>
) : asset.assigned_user_name ? (
  <div style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid var(--border)",marginBottom:4}}>
    <div style={{width:32,height:32,borderRadius:"50%",background:"var(--bg3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,color:"var(--text2)",flexShrink:0}}>
      {initials(asset.assigned_user_name)}
    </div>
    <div>
      <div style={{fontSize:13,fontWeight:500}}>{asset.assigned_user_name}</div>
      {asset.assigned_user_title && <div style={{fontSize:11,color:"var(--text3)"}}>{asset.assigned_user_title}</div>}
    </div>
  </div>
) : (
  <div className="kv"><span className="kv-label">Utilisateur</span><span style={{fontSize:12,color:"var(--text3)"}}>Non assigné</span></div>
)}
          <KV label="Site" value={asset.site_name}/>
          <KV label="Service" value={asset.department_name}/>
          <KV label="Déployé le" value={fmtDate(asset.deployment_date)}/>
          {asset.deployment_date&&<KV label="Durée en service">{daysAgo(asset.deployment_date)}</KV>}
          <KV label="Nb affectations">{assignments.length} au total</KV>
        </div>
      </div>

      {/* Cycle de vie + Santé */}
      <div className="grid2 mb-16">
        <div className="card">
          <div className="section-title">Cycle de vie</div>
          <KV label="Date d'achat" value={fmtDate(asset.purchase_date)}/>
          <KV label="Prix d'achat">{asset.purchase_price?`${Number(asset.purchase_price).toLocaleString("fr-FR")} FCFA`:"—"}</KV>
          <KV label="Fournisseur" value={asset.supplier}/>
          <KV label="Fin de garantie">{asset.warranty_end_date?<span className={`badge ${warrantyDays<0?"badge-danger":warrantyDays<30?"badge-warning":"badge-success"}`}>{fmtDate(asset.warranty_end_date)} ({daysFrom(asset.warranty_end_date)})</span>:"—"}</KV>
          <KV label="Fin de vie prévue" value={fmtDate(asset.planned_end_of_life)}/>
          {lifeP!==null&&(<div style={{marginTop:10}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--text2)"}}><span>Vie utile</span><span>{lifeP}%</span></div><div className="health-bar"><div className="health-fill" style={{width:`${lifeP}%`,background:lifeP>80?"var(--danger)":lifeP>60?"var(--warning)":"var(--accent)"}}/></div></div>)}
        </div>
        <div className="card">
          <div className="section-title">Statut de santé</div>
          <KV label="Dernière maintenance">{lastMaint?`${fmtDate(lastMaint.completed_at)} (${daysAgo(lastMaint.completed_at)})`:"—"}</KV>
          <KV label="Prochaine maintenance">{nextMaint?<span className={`badge ${(new Date(nextMaint.scheduled_date)-Date.now())/86400000<7?"badge-warning":"badge-info"}`}>{fmtDate(nextMaint.scheduled_date)} ({daysFrom(nextMaint.scheduled_date)})</span>:"—"}</KV>
          <KV label="Nb maintenances">{allMaint.length} au total</KV>
          <KV label="Pannes">{allMaint.filter(m=>m.type==="corrective").length}</KV>
          <KV label="Pièces remplacées">{allMaint.filter(m=>m.replacement_part).length}</KV>
          <KV label="Alertes actives">{activeAlerts.length>0?<span className="badge badge-warning">{activeAlerts.length} alerte(s)</span>:<span className="badge badge-success">Aucune</span>}</KV>
        </div>
      </div>

      {/* Timeline maintenances */}
      <div className="card mb-16">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div className="section-title" style={{margin:0}}>Historique des interventions</div>
          <button className="btn btn-ghost btn-sm" onClick={()=>{setEditingMaint(null);setModal(true);}}>+ Ajouter</button>
        </div>
        {allMaint.length===0?<div className="empty-state"><p>Aucune intervention enregistrée</p></div>:
        <div className="timeline">
          {allMaint.map(m=>(
            <div key={m.id} className="tl-item">
              <div className={`tl-dot ${TL_COLORS[m.type]||"tl-dot-blue"}`}/>
              <div style={{flex:1}}>
                <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                  <span style={{fontSize:13,fontWeight:500}}>{m.title}</span>
                  <div style={{display:"flex",gap:6}}>
                    <span className="badge badge-neutral" style={{fontSize:10}}>{MAINT_TYPES[m.type]||m.type}</span>
                    <span className={`badge badge-${MAINT_STATUS_COLORS[m.status]||"neutral"}`} style={{fontSize:10}}>{MAINT_STATUS_LABELS[m.status]||m.status}</span>
                  </div>
                </div>
                <div className="tl-meta">{m.scheduled_date&&`Planifiée : ${fmtDate(m.scheduled_date)}`}{m.completed_at&&` · Terminée : ${fmtDate(m.completed_at)}`}</div>
                {(m.tech_name||m.performed_by_name)&&<div className="tl-by">👤 {m.tech_name||m.performed_by_name}</div>}
                {m.description&&<div style={{fontSize:12,color:"var(--text2)",marginTop:4}}>{m.description}</div>}
                {m.replacement_part&&<div style={{fontSize:12,color:"var(--warning)",marginTop:3}}>🔧 Pièce : {m.replacement_part}</div>}
                {m.resolution_notes&&<div style={{fontSize:12,color:"var(--success)",marginTop:3}}>✓ {m.resolution_notes}</div>}
                {m.cost&&<div style={{fontSize:12,color:"var(--text3)",marginTop:3}}>Coût : {Number(m.cost).toLocaleString("fr-FR")} FCFA</div>}
              </div>
              <button className="btn btn-ghost btn-sm" style={{flexShrink:0}} onClick={()=>{setEditingMaint(m);setModal(true);}}>Modifier</button>
            </div>
          ))}
        </div>}
      </div>

      {/* Historique affectations */}
      <div className="mb-16">
        <AssignmentTimeline assetId={id} assignments={assignments} current={current} history={history} loading={assignLoading} onCreate={createAssign} onClose={closeAssign}/>
      </div>

      {/* Notes */}
      {asset.notes&&(<div className="card"><div className="section-title">Notes techniques</div><div style={{fontSize:13,color:"var(--text2)",lineHeight:1.7,borderLeft:"3px solid var(--border2)",paddingLeft:14}}>{asset.notes}</div></div>)}

      {modal&&<MaintModal assetId={id} meta={meta} maint={editingMaint} onClose={()=>{setModal(false);setEditingMaint(null);}} onSave={handleMaintSave}/>}
    </Layout>
  );
}
