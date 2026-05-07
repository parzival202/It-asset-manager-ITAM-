import { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import DataTable from "../../components/DataTable";
import { useMaintenances } from "../../hooks/useMaintenances";
import { useAlerts } from "../../hooks/useAlerts";
import { useMeta } from "../../hooks/useMeta";
import { useAssets } from "../../hooks/useAssets";
import { api } from "../../lib/api";
import { PLANNING_2025, MONTHS, MONTH_NAMES, getCurrentMonth, getCurrentWeek } from "../../lib/planningData";

const MAINT_TYPES   = { preventive:"Préventive", corrective:"Corrective", replacement:"Remplacement", deployment:"Déploiement" };
const STATUS_COLORS = { planned:"info", in_progress:"warning", completed:"success", cancelled:"neutral", overdue:"danger" };
const STATUS_LABELS = { planned:"Planifiée", in_progress:"En cours", completed:"Terminée", cancelled:"Annulée", overdue:"En retard" };

function fmtDate(d) { if (!d) return "—"; return new Date(d).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"}); }
function n(v) { return (v===undefined||v==="") ? null : v; }

// ── Modal ajout maintenance manuelle ──────────────────────────────────
function MaintModal({ onClose, onSave, assets, meta }) {
  const [form, setForm] = useState({ type:"preventive", status:"planned" });
  const [loading, setLoad] = useState(false);
  const [error, setError]  = useState("");
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  async function submit(e) {
    e.preventDefault();
    if (!form.title) { setError("Titre requis"); return; }
    setLoad(true); setError("");
    try {
      await onSave({
        asset_id: n(form.asset_id)?Number(form.asset_id):null,
        type: form.type, status: form.status||"planned",
        title: n(form.title), description: n(form.description),
        scheduled_date: n(form.scheduled_date), end_date: n(form.end_date),
        performed_by_user_id: n(form.performed_by_user_id)?Number(form.performed_by_user_id):null,
        department_id: n(form.department_id)?Number(form.department_id):null,
        replacement_part: n(form.replacement_part),
        resolution_notes: n(form.resolution_notes),
        cost: n(form.cost)?Number(form.cost):null,
        source: "manual",
      });
      onClose();
    } catch(err) { setError(err.message); }
    finally { setLoad(false); }
  }

  const depts = meta.deptsBySite(form.site_filter);

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>Nouvelle maintenance</h3>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--text2)",cursor:"pointer",fontSize:20}}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {error&&<div className="error-msg">{error}</div>}
            <div className="form-group">
              <label className="form-label">Titre *</label>
              <input className="form-input" value={form.title||""} onChange={e=>set("title",e.target.value)} placeholder="Ex: Maintenance préventive — Comptabilité"/>
            </div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Type</label>
                <select className="form-input form-select" value={form.type} onChange={e=>set("type",e.target.value)}>
                  {Object.entries(MAINT_TYPES).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Statut</label>
                <select className="form-input form-select" value={form.status} onChange={e=>set("status",e.target.value)}>
                  {Object.entries(STATUS_LABELS).filter(([v])=>v!=="overdue").map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Site (filtre)</label>
                <select className="form-input form-select" value={form.site_filter||""} onChange={e=>{set("site_filter",e.target.value);set("department_id","");}}>
                  <option value="">— Tous les sites —</option>
                  {meta.sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Service concerné</label>
                <select className="form-input form-select" value={form.department_id||""} onChange={e=>set("department_id",e.target.value)}>
                  <option value="">— Aucun —</option>
                  {depts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Equipement concerné <span style={{fontSize:11,color:"var(--text3)"}}>(optionnel)</span></label>
              <select className="form-input form-select" value={form.asset_id||""} onChange={e=>set("asset_id",e.target.value)}>
                <option value="">— Aucun / service entier —</option>
                {assets.map(a=><option key={a.id} value={a.id}>{a.name} ({a.asset_tag})</option>)}
              </select>
            </div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Date de début</label>
                <input className="form-input" type="date" value={form.scheduled_date||""} onChange={e=>set("scheduled_date",e.target.value)}/>
              </div>
              <div className="form-group"><label className="form-label">Date de fin prévue</label>
                <input className="form-input" type="date" value={form.end_date||""} onChange={e=>set("end_date",e.target.value)}/>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Technicien</label>
                <select className="form-input form-select" value={form.performed_by_user_id||""} onChange={e=>set("performed_by_user_id",e.target.value)}>
                  <option value="">— Assigner —</option>
                  {(meta?.users||[]).map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Coût (FCFA)</label>
                <input className="form-input" type="number" value={form.cost||""} onChange={e=>set("cost",e.target.value)}/>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Description</label>
              <textarea className="form-input" value={form.description||""} onChange={e=>set("description",e.target.value)}/>
            </div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Pièce remplacée</label>
                <input className="form-input" value={form.replacement_part||""} onChange={e=>set("replacement_part",e.target.value)}/>
              </div>
              <div className="form-group"><label className="form-label">Notes de résolution</label>
                <input className="form-input" value={form.resolution_notes||""} onChange={e=>set("resolution_notes",e.target.value)}/>
              </div>
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

// ── Vue calendrier avec alertes planning ───────────────────────────────
function CalendarView({ scheduleTickets, onGenerate, generating }) {
  const cm = getCurrentMonth();
  const cw = getCurrentWeek();
  const nowAbs = (cm-1)*4+cw;
  const WEEKS = [1,2,3,4];

  // Indexer les tickets par dept_name
  const ticketByDept = {};
  (scheduleTickets||[]).forEach(t => { ticketByDept[t.dept_name] = t; });

  return (
    <div>
      {/* Bouton générer */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div>
          <div style={{fontSize:13,color:"var(--text2)"}}>
            Planification automatique des maintenances préventives 2025.
            Chaque service génère un ticket lié au département.
          </div>
        </div>
        <button className="btn btn-primary" onClick={onGenerate} disabled={generating}>
          {generating ? "Génération..." : "⚡ Générer les tickets 2025"}
        </button>
      </div>

      {/* Alertes imminentes */}
      {PLANNING_2025.filter(p => {
        const s=(p.month-1)*4+p.week_start, e=s+p.duration-1;
        const diff = s - nowAbs;
        return diff >= 0 && diff <= 14;
      }).map(p => {
        const s=(p.month-1)*4+p.week_start;
        const diff = s - nowAbs;
        const ticket = ticketByDept[p.dept_name];
        const isDone = ticket?.status === "completed";
        if (isDone) return null;
        return (
          <div key={p.dept_name} style={{
            display:"flex",alignItems:"center",gap:12,padding:"10px 14px",marginBottom:8,borderRadius:6,
            background: diff<=3?"rgba(248,113,113,0.08)":diff<=7?"rgba(251,191,36,0.08)":"rgba(96,165,250,0.08)",
            border: `1px solid ${diff<=3?"rgba(248,113,113,0.25)":diff<=7?"rgba(251,191,36,0.25)":"rgba(96,165,250,0.25)"}`,
          }}>
            <div style={{width:8,height:8,borderRadius:"50%",flexShrink:0,
              background:diff<=3?"var(--danger)":diff<=7?"var(--warning)":"var(--info)"}}/>
            <span style={{fontSize:13,fontWeight:500}}>{p.dept_name}</span>
            <span style={{fontSize:12,color:"var(--text2)",flex:1}}>
              — {MONTH_NAMES[p.month-1]} S{p.week_start}
            </span>
            <span className={`badge badge-${diff<=3?"danger":diff<=7?"warning":"info"}`} style={{fontSize:11}}>
              {diff===0?"Cette semaine":diff<=3?`Dans ${diff} sem.`:diff<=7?"Dans 1 sem.":"Dans 2 sem."}
            </span>
            {ticket && <span className={`badge badge-${STATUS_COLORS[ticket.status]||"neutral"}`} style={{fontSize:10}}>{STATUS_LABELS[ticket.status]}</span>}
          </div>
        );
      }).filter(Boolean)}

      {/* Grille Gantt */}
      <div className="card" style={{padding:0,overflowX:"auto",marginTop:16}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:860,tableLayout:"fixed"}}>
          <colgroup>
            <col style={{width:200}}/>
            {MONTHS.map((_,mi)=>WEEKS.map((_,wi)=>(
              <col key={`${mi}-${wi}`} style={{width:16}}/>
            )))}
          </colgroup>
          <thead>
            <tr>
              <th style={{padding:"8px 12px",background:"var(--bg3)",fontSize:11,fontWeight:600,color:"var(--text3)",textTransform:"uppercase",borderBottom:"1px solid var(--border)",textAlign:"left"}}>Service</th>
              {MONTHS.map((m,mi)=>(
                <th key={mi} colSpan={4} style={{
                  padding:"6px 2px",textAlign:"center",
                  background:mi+1===cm?"rgba(79,142,247,0.08)":"var(--bg3)",
                  fontSize:10,fontWeight:600,
                  color:mi+1===cm?"var(--accent)":"var(--text3)",
                  textTransform:"uppercase",borderBottom:"1px solid var(--border)",
                  borderLeft:"1px solid var(--border)",
                }}>{m}</th>
              ))}
            </tr>
            <tr>
              <th style={{background:"var(--bg3)",borderBottom:"1px solid var(--border)"}}/>
              {MONTHS.map((_,mi)=>WEEKS.map(w=>(
                <th key={`${mi}-${w}`} style={{
                  padding:"2px 0",fontSize:8,fontWeight:400,color:"var(--text3)",
                  background:mi+1===cm?"rgba(79,142,247,0.04)":"var(--bg3)",
                  borderBottom:"1px solid var(--border)",
                  borderLeft:w===1?"1px solid var(--border)":"none",textAlign:"center",
                }}>{w===1||w===3?`S${w}`:""}</th>
              )))}
            </tr>
          </thead>
          <tbody>
            {PLANNING_2025.map((entry,ri)=>{
              const startAbs=(entry.month-1)*4+entry.week_start;
              const endAbs=startAbs+entry.duration-1;
              const isDone=nowAbs>endAbs;
              const isCurrent=startAbs<=nowAbs&&endAbs>=nowAbs;
              const isNext=startAbs>nowAbs&&startAbs<=nowAbs+8;
              const ticket=ticketByDept[entry.dept_name];
              const ticketStatus=ticket?.status;

              let color = "rgba(96,165,250,0.06)";
              let border = "transparent";
              if (ticketStatus==="completed") { color="rgba(52,211,153,0.15)"; border="var(--success)"; }
              else if (ticketStatus==="overdue") { color="rgba(248,113,113,0.15)"; border="var(--danger)"; }
              else if (isCurrent) { color="rgba(79,142,247,0.2)"; border="var(--accent)"; }
              else if (isDone&&!ticket) { color="rgba(52,211,153,0.08)"; border="var(--success)"; }
              else if (isNext) { color="rgba(251,191,36,0.12)"; border="var(--warning)"; }

              return (
                <tr key={`${entry.dept_name}-${entry.month}`} style={{background:ri%2===0?"transparent":"rgba(255,255,255,0.01)"}}>
                  <td style={{padding:"4px 12px",fontSize:11,fontWeight:500,color:"var(--text2)",borderBottom:"1px solid var(--border)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      {isCurrent&&<div style={{width:5,height:5,borderRadius:"50%",background:"var(--accent)",flexShrink:0}}/>}
                      {entry.dept_name}
                      {ticketStatus==="completed"&&<span style={{fontSize:9,background:"rgba(52,211,153,0.15)",color:"var(--success)",padding:"1px 4px",borderRadius:3}}>✓</span>}
                      {ticketStatus==="overdue"&&<span style={{fontSize:9,background:"rgba(248,113,113,0.15)",color:"var(--danger)",padding:"1px 4px",borderRadius:3}}>!</span>}
                    </div>
                  </td>
                  {MONTHS.map((_,mi)=>WEEKS.map(w=>{
                    const cellAbs=mi*4+w;
                    const inRange=cellAbs>=startAbs&&cellAbs<=endAbs;
                    const isNowCol=cellAbs===nowAbs;
                    return (
                      <td key={`${mi}-${w}`} style={{
                        padding:0,height:26,
                        borderBottom:"1px solid var(--border)",
                        borderLeft:w===1?"1px solid var(--border)":"1px solid rgba(255,255,255,0.02)",
                        background:inRange?color:isNowCol?"rgba(79,142,247,0.04)":"transparent",
                        position:"relative",
                      }}>
                        {inRange&&w===entry.week_start&&(
                          <div style={{position:"absolute",top:3,left:2,right:2,bottom:3,borderRadius:2,border:`1.5px solid ${border}`,background:color}}/>
                        )}
                        {isNowCol&&(
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
        <div style={{display:"flex",gap:16,flexWrap:"wrap",padding:"10px 16px",borderTop:"1px solid var(--border)"}}>
          {[
            {bg:"rgba(52,211,153,0.15)",border:"var(--success)",label:"Terminée"},
            {bg:"rgba(79,142,247,0.2)", border:"var(--accent)", label:"En cours"},
            {bg:"rgba(251,191,36,0.12)",border:"var(--warning)",label:"À venir (2 sem.)"},
            {bg:"rgba(248,113,113,0.15)",border:"var(--danger)", label:"En retard"},
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

// ── Page principale ────────────────────────────────────────────────────
export default function Maintenances() {
  const [tab, setTab]         = useState("list");
  const [filters, setFilters] = useState({ status:"", type:"" });
  const [modal, setModal]     = useState(false);
  const [generating, setGen]  = useState(false);
  const [scheduleTickets, setScheduleTickets] = useState([]);
  const [mounted, setMounted] = useState(false);
  const { maintenances, loading, create, markDone } = useMaintenances(filters);
  const { alertCount }        = useAlerts();
  const meta                  = useMeta();
  const { assets }            = useAssets({});

  useEffect(()=>{ setMounted(true); },[]);
  useEffect(()=>{
    if (!mounted) return;
    api.schedule.list().then(setScheduleTickets).catch(()=>{});
  },[mounted]);

  async function handleGenerate() {
    setGen(true);
    try {
      await api.schedule.generate();
      await api.schedule.checkAlerts();
      const tickets = await api.schedule.list();
      setScheduleTickets(tickets);
      alert("Tickets générés avec succès ! Les alertes ont été mises à jour.");
    } catch(err) { alert(err.message); }
    finally { setGen(false); }
  }

  // Compter les maintenances en cours (planifiées + générées par planning + overdue)
  const activeCount = maintenances.filter(m => ["planned","in_progress","overdue"].includes(m.status)).length;

  const COLUMNS = [
    {
      label:"Titre", accessor:"title", sortable:true,
      render: r => (
        <div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontWeight:500}}>{r.title}</span>
            {r.source==="schedule" && <span style={{fontSize:9,background:"rgba(79,142,247,0.15)",color:"var(--accent)",padding:"1px 5px",borderRadius:3,flexShrink:0}}>Planning</span>}
          </div>
          {r.dept_name && <div style={{fontSize:11,color:"var(--text3)",marginTop:1}}>Service : {r.dept_name}</div>}
          {r.description&&<div style={{fontSize:11,color:"var(--text3)",marginTop:1,maxWidth:260,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.description}</div>}
        </div>
      )
    },
    { label:"Type",       accessor:"type",           sortable:true, render: r=><span className="badge badge-neutral">{MAINT_TYPES[r.type]||r.type}</span> },
    { label:"Equipement", accessor:"asset_name",     sortable:true, render: r=><div><div style={{fontSize:13}}>{r.asset_name||<span style={{color:"var(--text3)"}}>Service entier</span>}</div>{r.asset_tag&&<div className="mono" style={{fontSize:11}}>{r.asset_tag}</div>}</div> },
    { label:"Technicien", accessor:"tech_name",      sortable:true, render: r=>r.tech_name||r.performed_by_name||<span className="text-faint">—</span> },
    { label:"Début",      accessor:"scheduled_date", sortable:true, render: r=>fmtDate(r.scheduled_date) },
    { label:"Fin prévue", accessor:"end_date",       sortable:true, render: r=>fmtDate(r.end_date) },
    { label:"Statut",     accessor:"status",         sortable:true, render: r=><span className={`badge badge-${STATUS_COLORS[r.status]||"neutral"}`}>{STATUS_LABELS[r.status]||r.status}</span> },
    { label:"", key:"actions", render: r=>(["planned","in_progress"].includes(r.status))&&<button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();markDone(r.id);}}>✓ Terminer</button> },
  ];

  return (
    <Layout title="Maintenances" alertCount={alertCount} actions={
      <button className="btn btn-primary" onClick={()=>setModal(true)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
        Ajouter
      </button>
    }>
      {/* Compteur rapide */}
      {activeCount > 0 && (
        <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
          <div style={{padding:"8px 14px",background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.25)",borderRadius:8,fontSize:13,fontWeight:500,color:"var(--warning)"}}>
            {activeCount} maintenance{activeCount>1?"s":""} en cours ou planifiée{activeCount>1?"s":""}
          </div>
        </div>
      )}

      {/* Onglets */}
      <div style={{display:"flex",gap:6,marginBottom:20}}>
        {[["list","📋 Liste"],["calendar","📅 Calendrier planning"]].map(([key,label])=>(
          <button key={key} onClick={()=>setTab(key)} className={`btn ${tab===key?"btn-primary":"btn-ghost"}`} style={{fontSize:13}}>
            {label}
          </button>
        ))}
      </div>

      {tab==="list" && (
        <DataTable
          columns={COLUMNS}
          data={maintenances}
          loading={loading}
          emptyMessage="Aucune maintenance trouvée"
          searchable
          searchPlaceholder="Titre, service, technicien..."
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

      {tab==="calendar" && (
        <CalendarView
          scheduleTickets={scheduleTickets}
          onGenerate={handleGenerate}
          generating={generating}
        />
      )}

      {modal && <MaintModal assets={assets} meta={meta} onClose={()=>setModal(false)} onSave={create}/>}
    </Layout>
  );
}
