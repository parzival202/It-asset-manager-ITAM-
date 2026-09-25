import { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import DataTable from "../../components/DataTable";
import { useMaintenances } from "../../hooks/useMaintenances";
import { useAlerts } from "../../hooks/useAlerts";
import { useMeta } from "../../hooks/useMeta";
import { useAssets } from "../../hooks/useAssets";
import { api } from "../../lib/api";
import { PLANNING_2025, MONTH_NAMES } from "../../lib/planningData";
import { downloadExcel, printReport } from "../../lib/reportExport";

const MAINT_TYPES   = { preventive:"Préventive", corrective:"Corrective", replacement:"Remplacement", deployment:"Déploiement" };
const STATUS_COLORS = { planned:"info", in_progress:"warning", completed:"success", cancelled:"neutral", overdue:"danger" };
const STATUS_LABELS = { planned:"Planifiée", in_progress:"En cours", completed:"Terminée", cancelled:"Annulée", overdue:"En retard" };

function fmtDate(d) { if (!d) return "—"; return new Date(d).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"}); }
function n(v) { return (v===undefined||v==="") ? null : v; }
function dateInput(d) { return d ? String(d).slice(0, 10) : ""; }

// ── Modal ajout / modification maintenance ────────────────────────────
function MaintModal({ maintenance, onClose, onSave, assets, meta }) {
  const isEdit = !!maintenance;
  const [form, setForm] = useState(maintenance ? {
    ...maintenance,
    scheduled_date: dateInput(maintenance.scheduled_date),
    end_date: dateInput(maintenance.end_date),
  } : { type:"preventive", status:"planned" });
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
        completed_at: form.status === "completed" ? n(form.completed_at) : null,
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
          <h3>{isEdit ? "Modifier la maintenance" : "Nouvelle maintenance"}</h3>
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
              <div className="form-group"><label className="form-label">Département (filtre)</label>
                <select className="form-input form-select" value={form.site_filter||""} onChange={e=>{set("site_filter",e.target.value);set("department_id","");}}>
                  <option value="">— Tous les départements —</option>
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
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading?"Enregistrement...":isEdit?"Modifier":"Créer"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function monthDayCount(year, month) {
  return new Date(year, month, 0).getDate();
}

function planRange(year, entry) {
  const startDay = (entry.week_start - 1) * 7 + 1;
  const endDay = Math.min(monthDayCount(year, entry.month), startDay + entry.duration * 7 - 1);
  return {
    start: startOfDay(new Date(year, entry.month - 1, startDay)),
    end: startOfDay(new Date(year, entry.month - 1, endDay)),
    startDay,
    endDay,
  };
}

function entriesForDay(date, ticketByDept) {
  const day = startOfDay(date);
  return PLANNING_2025
    .filter(entry => entry.month === day.getMonth() + 1)
    .map(entry => ({ entry, range: planRange(day.getFullYear(), entry), ticket: ticketByDept[entry.dept_name] }))
    .filter(item => day >= item.range.start && day <= item.range.end);
}

function statusInfo(item, today) {
  const status = item.ticket?.status;
  if (status === "completed") return { label: "Terminée", badge: "success", bg: "rgba(52,211,153,0.14)", border: "rgba(52,211,153,0.35)" };
  if (status === "overdue") return { label: "En retard", badge: "danger", bg: "rgba(248,113,113,0.14)", border: "rgba(248,113,113,0.35)" };
  if (status === "in_progress") return { label: "En cours", badge: "warning", bg: "rgba(251,191,36,0.14)", border: "rgba(251,191,36,0.35)" };
  if (today >= item.range.start && today <= item.range.end) return { label: "Cette période", badge: "info", bg: "rgba(79,142,247,0.16)", border: "rgba(79,142,247,0.42)" };
  if (today > item.range.end) return { label: "Passée", badge: "neutral", bg: "rgba(148,163,184,0.10)", border: "rgba(148,163,184,0.24)" };
  return { label: "Planifiée", badge: "info", bg: "rgba(96,165,250,0.10)", border: "rgba(96,165,250,0.30)" };
}

// ── Vue agenda réel avec alertes planning ──────────────────────────────
function CalendarView({ scheduleTickets, onGenerate, generating }) {
  const today = startOfDay(new Date());
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth() + 1;
  const daysInView = monthDayCount(year, month);
  const firstDay = new Date(year, month - 1, 1);
  const leadingBlankDays = (firstDay.getDay() + 6) % 7;
  const totalCells = Math.ceil((leadingBlankDays + daysInView) / 7) * 7;

  const ticketByDept = {};
  (scheduleTickets || []).forEach(t => { ticketByDept[t.dept_name] = t; });

  const cells = Array.from({ length: totalCells }, (_, index) => {
    const dayNumber = index - leadingBlankDays + 1;
    if (dayNumber < 1 || dayNumber > daysInView) return null;
    return new Date(year, month - 1, dayNumber);
  });

  const monthPlans = PLANNING_2025
    .filter(entry => entry.month === month)
    .map(entry => ({ entry, range: planRange(year, entry), ticket: ticketByDept[entry.dept_name] }));

  const goMonth = offset => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + offset, 1));
  const goToday = () => setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,marginBottom:16,flexWrap:"wrap"}}>
        <div>
          <div style={{fontSize:13,color:"var(--text2)"}}>
            Agenda réel des maintenances préventives {year}. Les services sont placés sur les jours couverts par leur semaine de planning.
          </div>
        </div>
        <button className="btn btn-primary" onClick={onGenerate} disabled={generating}>
          {generating ? "Génération..." : `⚡ Générer les tickets ${today.getFullYear()}`}
        </button>
      </div>

      <div className="card" style={{padding:0,overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"14px 16px",borderBottom:"1px solid var(--border)",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:18,fontWeight:700}}>{MONTH_NAMES[month - 1]} {year}</div>
            <div style={{fontSize:12,color:"var(--text3)",marginTop:2}}>
              {monthPlans.length} service{monthPlans.length>1?"s":""} programmé{monthPlans.length>1?"s":""} ce mois-ci
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button className="btn btn-ghost btn-sm" onClick={() => goMonth(-1)} aria-label="Mois précédent">‹</button>
            <button className="btn btn-ghost btn-sm" onClick={goToday}>Aujourd'hui</button>
            <button className="btn btn-ghost btn-sm" onClick={() => goMonth(1)} aria-label="Mois suivant">›</button>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(7, minmax(120px, 1fr))",borderBottom:"1px solid var(--border)",overflowX:"auto"}}>
          {WEEKDAY_LABELS.map(day => (
            <div key={day} style={{padding:"8px 10px",background:"var(--bg3)",fontSize:11,fontWeight:700,color:"var(--text3)",textTransform:"uppercase",textAlign:"center",borderRight:"1px solid var(--border)"}}>
              {day}
            </div>
          ))}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(7, minmax(120px, 1fr))",overflowX:"auto"}}>
          {cells.map((date, index) => {
            const items = date ? entriesForDay(date, ticketByDept) : [];
            const isToday = date && sameDay(date, today);
            return (
              <div key={index} style={{minHeight:108,padding:8,borderRight:"1px solid var(--border)",borderBottom:"1px solid var(--border)",background:isToday?"rgba(79,142,247,0.06)":"transparent"}}>
                {date && (
                  <>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <span style={{fontSize:12,fontWeight:700,color:isToday?"var(--accent)":"var(--text2)"}}>
                        {String(date.getDate()).padStart(2, "0")}
                      </span>
                      {isToday && <span className="badge badge-info" style={{fontSize:9}}>Aujourd'hui</span>}
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:5}}>
                      {items.map(item => {
                        const info = statusInfo(item, today);
                        return (
                          <div key={`${item.entry.dept_name}-${item.entry.week_start}`} style={{padding:"5px 7px",borderRadius:6,background:info.bg,border:`1px solid ${info.border}`,minWidth:0}} title={`${item.entry.dept_name} · du ${String(item.range.startDay).padStart(2, "0")} au ${String(item.range.endDay).padStart(2, "0")} ${MONTH_NAMES[item.entry.month - 1]}`}>
                            <div style={{fontSize:11,fontWeight:700,color:"var(--text2)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.entry.dept_name}</div>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:6,marginTop:3}}>
                              <span style={{fontSize:10,color:"var(--text3)"}}>S{item.entry.week_start} à S{item.entry.week_start + item.entry.duration - 1}</span>
                              <span className={`badge badge-${info.badge}`} style={{fontSize:9}}>{info.label}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{marginTop:16,padding:14}}>
        <div className="section-title" style={{marginBottom:10}}>Services du mois</div>
        {monthPlans.length === 0 ? (
          <div style={{fontSize:13,color:"var(--text3)"}}>Aucune maintenance préventive programmée ce mois-ci.</div>
        ) : (
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))",gap:10}}>
            {monthPlans.map(item => {
              const info = statusInfo(item, today);
              return (
                <div key={`${item.entry.dept_name}-${item.entry.week_start}`} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"10px 12px",border:"1px solid var(--border)",borderRadius:8,background:"var(--bg2)"}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.entry.dept_name}</div>
                    <div style={{fontSize:12,color:"var(--text3)",marginTop:2}}>Du {String(item.range.startDay).padStart(2, "0")} au {String(item.range.endDay).padStart(2, "0")} {MONTH_NAMES[month - 1]}</div>
                  </div>
                  <span className={`badge badge-${info.badge}`} style={{flexShrink:0}}>{info.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
// ── Page principale ────────────────────────────────────────────────────
export default function Maintenances() {
  const [tab, setTab]         = useState("list");
  const [filters, setFilters] = useState({ status:"", type:"" });
  const [modal, setModal]     = useState(false);
  const [editing, setEditing] = useState(null);
  const [generating, setGen]  = useState(false);
  const [scheduleTickets, setScheduleTickets] = useState([]);
  const [mounted, setMounted] = useState(false);
  const { maintenances, loading, create, update, markDone, remove } = useMaintenances(filters);
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

  async function handleSave(form) {
    if (editing) await update(editing.id, form);
    else await create(form);
  }

  // Compter les maintenances en cours (planifiées + générées par planning + overdue)
  const activeCount = maintenances.filter(m => ["planned","in_progress","overdue"].includes(m.status)).length;
  const reportHeaders=["Titre","Type","Statut","Équipement","Service","Technicien","Début","Fin prévue","Coût","Pièce remplacée"];
  const reportRows=maintenances.map(m=>[m.title,MAINT_TYPES[m.type]||m.type,STATUS_LABELS[m.status]||m.status,m.asset_name||"Service entier",m.dept_name||"—",m.tech_name||m.performed_by_name||"—",fmtDate(m.scheduled_date),fmtDate(m.end_date),m.cost||"—",m.replacement_part||"—"]);

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
    {
      label:"", key:"actions",
      render: r => (
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();setEditing(r);setModal(true);}}>Modifier</button>
          {['planned','in_progress','overdue'].includes(r.status) && (
            <button className="btn btn-ghost btn-sm" onClick={e=>{e.stopPropagation();markDone(r.id);}}>✓ Terminer</button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={async e => {
            e.stopPropagation();
            if (!window.confirm(`Supprimer la maintenance « ${r.title} » ?`)) return;
            try { await remove(r.id); }
            catch (err) { window.alert(err.message); }
          }}>Supprimer</button>
        </div>
      )
    },
  ];

  return (
    <Layout title="Maintenances" alertCount={alertCount} actions={<div style={{display:"flex",gap:8}}>
      <button className="btn btn-ghost" onClick={()=>downloadExcel("rapport-maintenances",reportHeaders,reportRows)}>Exporter Excel</button>
      <button className="btn btn-ghost" onClick={()=>printReport("Rapport des maintenances",reportHeaders,reportRows,`${maintenances.length} maintenance(s) — filtres actifs inclus`)}>Imprimer / PDF</button>
      <button className="btn btn-primary" onClick={()=>{setEditing(null);setModal(true);}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
        Ajouter
      </button></div>}>
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
        {[["list","📋 Liste"],["calendar","📅 Agenda planning"]].map(([key,label])=>(
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

      {modal && <MaintModal maintenance={editing} assets={assets} meta={meta} onClose={()=>{setModal(false);setEditing(null);}} onSave={handleSave}/>}
    </Layout>
  );
}
