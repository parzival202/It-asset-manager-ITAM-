import { getDb } from "../../../lib/db";
import { useState, useMemo } from "react";
import Layout from "../../../components/Layout";
import DataTable from "../../../components/DataTable";
import { useMaintenances } from "../../../hooks/useMaintenances";
import { useAlerts } from "../../../hooks/useAlerts";
import { useMeta } from "../../../hooks/useMeta";
import { useAssets } from "../../../hooks/useAssets";
import { PLANNING_2025, MONTH_NAMES, MONTHS, getCurrentMonth, getCurrentWeek } from "../../../lib/planningData";

// ── Constantes ────────────────────────────────────────────────────────
const MAINT_TYPES   = { preventive:"Préventive", corrective:"Corrective", replacement:"Remplacement", deployment:"Déploiement" };
const STATUS_COLORS = { planned:"info", in_progress:"warning", completed:"success", cancelled:"neutral" };
const STATUS_LABELS = { planned:"Planifiée", in_progress:"En cours", completed:"Terminée", cancelled:"Annulée" };
const ALERT_LEVELS  = { critical:"Critique", warning:"Attention", info:"Info" };
const ALERT_COLORS  = { critical:"var(--danger)", warning:"var(--warning)", info:"var(--info)" };

function fmtDate(d) { if (!d) return "—"; return new Date(d).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"}); }
function n(v) { return (v===undefined||v==="") ? null : v; }

// ── Calcul alertes planning ───────────────────────────────────────────
function getPlanningAlerts() {
  const cm = getCurrentMonth();
  const cw = getCurrentWeek();
  const nowAbs = (cm-1)*4 + cw;
  return PLANNING_2025.map(p => {
    const startAbs = (p.month-1)*4 + p.week;
    const endAbs   = startAbs + p.duration - 1;
    const diff     = startAbs - nowAbs;
    if (endAbs < nowAbs) return { ...p, level:"done" };
    if (diff <= 0 && endAbs >= nowAbs) return { ...p, level:"critical", label:"En cours cette semaine" };
    if (diff > 0 && diff <= 4)  return { ...p, level:"warning",  label:`Dans ${diff} semaine${diff>1?"s":""}` };
    if (diff > 4 && diff <= 8)  return { ...p, level:"info",     label:`Dans ${Math.ceil(diff/4)} mois` };
    return null;
  }).filter(Boolean).filter(p => p.level !== "done");
}

// ── Modal ajout maintenance ───────────────────────────────────────────
function MaintModal({ onClose, onSave, assets, meta }) {
  const [form, setForm] = useState({ type:"preventive", status:"planned" });
  const [loading, setLoad] = useState(false);
  const [error, setError]  = useState("");
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  async function submit(e) {
    e.preventDefault();
    if (!form.asset_id) { setError("Choisir un équipement"); return; }
    if (!form.title)    { setError("Titre requis"); return; }
    setLoad(true); setError("");
    try {
      await onSave({
        asset_id: Number(form.asset_id), type: form.type, status: form.status||"planned",
        title: n(form.title), description: n(form.description), scheduled_date: n(form.scheduled_date),
        performed_by_user_id: n(form.performed_by_user_id)?Number(form.performed_by_user_id):null,
        replacement_part: n(form.replacement_part), resolution_notes: n(form.resolution_notes),
        cost: n(form.cost)?Number(form.cost):null,
      });
      onClose();
    } catch(err) { setError(err.message); }
    finally { setLoad(false); }
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
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
                <option value="">— Choisir —</option>
                {assets.map(a=><option key={a.id} value={a.id}>{a.name} ({a.asset_tag})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Titre *</label>
              <input className="form-input" value={form.title||""} onChange={e=>set("title",e.target.value)} placeholder="Ex: Maintenance préventive trimestrielle"/>
            </div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Type</label>
                <select className="form-input form-select" value={form.type} onChange={e=>set("type",e.target.value)}>
                  {Object.entries(MAINT_TYPES).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Statut</label>
                <select className="form-input form-select" value={form.status} onChange={e=>set("status",e.target.value)}>
                  {Object.entries(STATUS_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Date planifiée</label>
                <input className="form-input" type="date" value={form.scheduled_date||""} onChange={e=>set("scheduled_date",e.target.value)}/>
              </div>
              <div className="form-group"><label className="form-label">Technicien</label>
                <select className="form-input form-select" value={form.performed_by_user_id||""} onChange={e=>set("performed_by_user_id",e.target.value)}>
                  <option value="">— Assigner —</option>
                  {(meta?.users||[]).map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Description</label>
              <textarea className="form-input" value={form.description||""} onChange={e=>set("description",e.target.value)}/>
            </div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Pièce remplacée</label>
                <input className="form-input" value={form.replacement_part||""} onChange={e=>set("replacement_part",e.target.value)}/>
              </div>
              <div className="form-group"><label className="form-label">Coût (FCFA)</label>
                <input className="form-input" type="number" value={form.cost||""} onChange={e=>set("cost",e.target.value)}/>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Notes de résolution</label>
              <textarea className="form-input" value={form.resolution_notes||""} onChange={e=>set("resolution_notes",e.target.value)}/>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading?"Enregistrement...":"Créer"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Vue calendrier ────────────────────────────────────────────────────
function CalendarView({ maintenances }) {
  const cm = getCurrentMonth();
  const cw = getCurrentWeek();
  const alerts = getPlanningAlerts();
  const WEEKS = [1,2,3,4];

  return (
    <div>
      {/* Alertes planning */}
      {alerts.filter(a => a.level !== "done").slice(0, 5).map(a => (
        <div key={a.service} style={{
          display:"flex", alignItems:"center", gap:12, padding:"10px 14px",
          background:`${ALERT_COLORS[a.level]}10`, border:`1px solid ${ALERT_COLORS[a.level]}30`,
          borderRadius:6, marginBottom:8, fontSize:13,
        }}>
          <div style={{width:8,height:8,borderRadius:"50%",background:ALERT_COLORS[a.level],flexShrink:0}}/>
          <span style={{fontWeight:500}}>{a.service}</span>
          <span style={{color:"var(--text2)",flex:1}}>— Maintenance préventive planifiée</span>
          <span className={`badge badge-${a.level==="critical"?"danger":a.level==="warning"?"warning":"info"}`} style={{fontSize:11}}>
            {a.label}
          </span>
        </div>
      ))}

      {/* Grille calendrier */}
      <div className="card" style={{padding:0,overflowX:"auto",marginTop:16}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:860,tableLayout:"fixed"}}>
          <colgroup>
            <col style={{width:120}}/>
            {MONTHS.map((_,mi)=>WEEKS.map((_,wi)=>(
              <col key={`${mi}-${wi}`} style={{width:16}}/>
            )))}
          </colgroup>
          <thead>
            <tr>
              <th style={{padding:"8px 12px",background:"var(--bg3)",fontSize:11,fontWeight:600,color:"var(--text3)",textTransform:"uppercase",borderBottom:"1px solid var(--border)",textAlign:"left"}}>Service</th>
              {MONTHS.map((m,mi)=>(
                <th key={mi} colSpan={4} style={{
                  padding:"6px 2px", textAlign:"center",
                  background: mi+1===cm ? "rgba(79,142,247,0.08)" : "var(--bg3)",
                  fontSize:10, fontWeight:600,
                  color: mi+1===cm ? "var(--accent)" : "var(--text3)",
                  textTransform:"uppercase", borderBottom:"1px solid var(--border)",
                  borderLeft:"1px solid var(--border)",
                }}>{m}</th>
              ))}
            </tr>
            <tr>
              <th style={{background:"var(--bg3)",borderBottom:"1px solid var(--border)"}}/>
              {MONTHS.map((_,mi)=>WEEKS.map(w=>(
                <th key={`${mi}-${w}`} style={{
                  padding:"2px 0",fontSize:8,fontWeight:400,color:"var(--text3)",
                  background: mi+1===cm ? "rgba(79,142,247,0.04)" : "var(--bg3)",
                  borderBottom:"1px solid var(--border)",
                  borderLeft: w===1?"1px solid var(--border)":"none",
                  textAlign:"center",
                }}>{w===1||w===3?`S${w}`:""}</th>
              )))}
            </tr>
          </thead>
          <tbody>
            {PLANNING_2025.map((entry, ri) => {
              const startAbs = (entry.month-1)*4 + entry.week;
              const endAbs   = startAbs + entry.duration - 1;
              const nowAbs   = (cm-1)*4 + cw;
              const isDone   = endAbs < nowAbs;
              const isCurrent= startAbs <= nowAbs && endAbs >= nowAbs;
              const isNext   = startAbs > nowAbs && startAbs <= nowAbs+8;

              // Maintenances réelles pour ce service
              const relatedMaints = maintenances.filter(m =>
                m.title?.toLowerCase().includes(entry.service.toLowerCase()) ||
                m.description?.toLowerCase().includes(entry.service.toLowerCase())
              );

              return (
                <tr key={entry.service} style={{background:ri%2===0?"transparent":"rgba(255,255,255,0.01)"}}>
                  <td style={{padding:"4px 12px",fontSize:11,fontWeight:500,color:"var(--text2)",borderBottom:"1px solid var(--border)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      {isCurrent && <div style={{width:5,height:5,borderRadius:"50%",background:"var(--accent)",flexShrink:0}}/>}
                      {entry.service}
                      {relatedMaints.filter(m=>m.status==="completed").length > 0 && (
                        <span style={{fontSize:9,background:"rgba(52,211,153,0.15)",color:"var(--success)",padding:"1px 4px",borderRadius:3,flexShrink:0}}>✓</span>
                      )}
                    </div>
                  </td>
                  {MONTHS.map((_,mi)=>WEEKS.map(w=>{
                    const cellAbs = mi*4+w;
                    const inRange = cellAbs >= startAbs && cellAbs <= endAbs;
                    const isNowCol = cellAbs === nowAbs;
                    let bg = "transparent";
                    let borderColor = "transparent";
                    if (inRange) {
                      if (isDone)    { bg="rgba(52,211,153,0.12)"; borderColor="var(--success)"; }
                      else if (isCurrent) { bg="rgba(79,142,247,0.2)"; borderColor="var(--accent)"; }
                      else if (isNext)    { bg="rgba(251,191,36,0.15)"; borderColor="var(--warning)"; }
                      else               { bg="rgba(96,165,250,0.06)"; borderColor="transparent"; }
                    }
                    return (
                      <td key={`${mi}-${w}`} style={{
                        padding:0, height:26,
                        borderBottom:"1px solid var(--border)",
                        borderLeft: w===1?"1px solid var(--border)":"1px solid rgba(255,255,255,0.02)",
                        background: inRange ? bg : isNowCol ? "rgba(79,142,247,0.04)" : "transparent",
                        position:"relative",
                      }}>
                        {inRange && w===entry.week && (
                          <div style={{position:"absolute",top:3,left:2,right:2,bottom:3,borderRadius:2,border:`1.5px solid ${borderColor}`,background:bg}}/>
                        )}
                        {isNowCol && (
                          <div style={{position:"absolute",top:0,bottom:0,left:"50%",width:1.5,background:"rgba(79,142,247,0.35)",transform:"translateX(-50%)"}}/>
                        )}
                      </td>
                    );
                  }))}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Légende */}
        <div style={{display:"flex",gap:16,flexWrap:"wrap",padding:"10px 16px",borderTop:"1px solid var(--border)"}}>
          {[
            {bg:"rgba(52,211,153,0.12)",border:"var(--success)",label:"Effectuée"},
            {bg:"rgba(79,142,247,0.2)", border:"var(--accent)", label:"En cours"},
            {bg:"rgba(251,191,36,0.15)",border:"var(--warning)",label:"À venir (2 mois)"},
            {bg:"rgba(96,165,250,0.06)",border:"var(--border)", label:"Planifiée"},
          ].map(l=>(
            <div key={l.label} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"var(--text2)"}}>
              <div style={{width:12,height:12,borderRadius:2,background:l.bg,border:`1.5px solid ${l.border}`}}/>
              {l.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────
export default function Maintenances() {
  const [tab, setTab]             = useState("list"); // "list" | "calendar"
  const [filters, setFilters]     = useState({ status:"", type:"" });
  const [modal, setModal]         = useState(false);
  const { maintenances, loading, create, markDone } = useMaintenances(filters);
  const { alertCount }            = useAlerts();
  const meta                      = useMeta();
  const { assets }                = useAssets({});

  const COLUMNS = [
    { label:"Titre", accessor:"title", sortable:true, render: r => <div><div style={{fontWeight:500}}>{r.title}</div>{r.description&&<div style={{fontSize:11,color:"var(--text3)",marginTop:2,maxWidth:260,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.description}</div>}</div> },
    { label:"Type",       accessor:"type",          sortable:true, render: r => <span className="badge badge-neutral">{MAINT_TYPES[r.type]||r.type}</span> },
    { label:"Equipement", accessor:"asset_name",    sortable:true, render: r => <div><div style={{fontSize:13}}>{r.asset_name||"—"}</div>{r.asset_tag&&<div className="mono" style={{fontSize:11}}>{r.asset_tag}</div>}</div> },
    { label:"Technicien", accessor:"tech_name",     sortable:true, render: r => r.tech_name||r.performed_by_name||<span className="text-faint">—</span> },
    { label:"Planifiée",  accessor:"scheduled_date",sortable:true, render: r => fmtDate(r.scheduled_date) },
    { label:"Terminée",   accessor:"completed_at",  sortable:true, render: r => fmtDate(r.completed_at) },
    { label:"Statut",     accessor:"status",        sortable:true, render: r => <span className={`badge badge-${STATUS_COLORS[r.status]||"neutral"}`}>{STATUS_LABELS[r.status]||r.status}</span> },
    { label:"", key:"actions", render: r => (r.status==="planned"||r.status==="in_progress")&&<button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();markDone(r.id);}}>✓ Terminer</button> },
  ];

  // Compteurs alertes planning
  const planningAlerts = getPlanningAlerts();
  const criticalCount  = planningAlerts.filter(a=>a.level==="critical").length;
  const warningCount   = planningAlerts.filter(a=>a.level==="warning").length;

  return (
    <Layout title="Maintenances" alertCount={alertCount} actions={
      <button className="btn btn-primary" onClick={() => setModal(true)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
        Ajouter
      </button>
    }>
      {/* Indicateurs alertes planning */}
      {(criticalCount > 0 || warningCount > 0) && (
        <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
          {criticalCount > 0 && (
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.25)",borderRadius:8,cursor:"pointer"}} onClick={()=>setTab("calendar")}>
              <div style={{width:8,height:8,borderRadius:"50%",background:"var(--danger)"}}/>
              <span style={{fontSize:13,fontWeight:500,color:"var(--danger)"}}>{criticalCount} maintenance{criticalCount>1?"s":""} en cours cette semaine</span>
            </div>
          )}
          {warningCount > 0 && (
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.25)",borderRadius:8,cursor:"pointer"}} onClick={()=>setTab("calendar")}>
              <div style={{width:8,height:8,borderRadius:"50%",background:"var(--warning)"}}/>
              <span style={{fontSize:13,fontWeight:500,color:"var(--warning)"}}>{warningCount} à venir dans moins de 2 semaines</span>
            </div>
          )}
        </div>
      )}

      {/* Onglets liste / calendrier */}
      <div style={{display:"flex",gap:6,marginBottom:20}}>
        {[["list","📋 Liste"],["calendar","📅 Calendrier planning"]].map(([key,label])=>(
          <button key={key} onClick={()=>setTab(key)}
            className={`btn ${tab===key?"btn-primary":"btn-ghost"}`}
            style={{fontSize:13}}>
            {label}
          </button>
        ))}
      </div>

      {/* Vue liste */}
      {tab === "list" && (
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
              {(filters.status||filters.type)&&<button className="btn btn-ghost btn-sm" onClick={()=>setFilters({status:"",type:""})}>Effacer</button>}
            </>
          }
        />
      )}

      {/* Vue calendrier */}
      {tab === "calendar" && <CalendarView maintenances={maintenances}/>}

      {modal && <MaintModal assets={assets} meta={meta} onClose={()=>setModal(false)} onSave={create}/>}
    </Layout>
  );
}
