import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "./Layout";
import { useAlerts } from "../hooks/useAlerts";
import { api } from "../lib/api";

// ── Helpers ───────────────────────────────────────────────────────────
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
function daysFrom(d) {
  if (!d) return null;
  const n = Math.round((new Date(d) - Date.now()) / 86400000);
  if (n === 0) return "aujourd'hui";
  if (n === 1) return "demain";
  return `dans ${n} jours`;
}

const TYPE_LABELS   = { laptop:"Laptop", screen:"Ecran", uc:"UC", printer:"Imprimante", all_in_one:"All-in-one" };
const STATUS_LABELS = { in_service:"En service", maintenance:"En maintenance", retired:"Retiré", storage:"En stock" };
const STATUS_COLORS = { in_service:"var(--success)", maintenance:"var(--warning)", retired:"var(--text3)", storage:"var(--info)" };
const MAINT_STATUS_COLORS = { planned:"var(--info)", in_progress:"var(--warning)", overdue:"var(--danger)", completed:"var(--success)" };
const MAINT_STATUS_LABELS = { planned:"Planifiée", in_progress:"En cours", overdue:"En retard", completed:"Terminée" };

// ── Composants graphiques purs CSS/SVG ────────────────────────────────

function StatCard({ label, value, sub, color, onClick }) {
  return (
    <div className="stat-card" style={{ cursor: onClick ? "pointer" : "default", borderLeft: color ? `3px solid ${color}` : undefined }}
         onClick={onClick}>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: color || "var(--text)" }}>{value ?? 0}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function HBarChart({ data, valueKey = "count", labelKey = "name", color = "var(--accent)", maxItems = 8 }) {
  const items  = (data || []).slice(0, maxItems);
  const maxVal = Math.max(...items.map(d => Number(d[valueKey]) || 0), 1);
  if (!items.length) return <div className="empty-state" style={{padding:"20px 0"}}><p>Aucune donnée</p></div>;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {items.map((item, i) => {
        const val = Number(item[valueKey]) || 0;
        const pct = Math.round(val / maxVal * 100);
        return (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:140, fontSize:12, color:"var(--text2)", textAlign:"right", flexShrink:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {item[labelKey] || "—"}
            </div>
            <div style={{ flex:1, height:20, background:"var(--bg3)", borderRadius:4, overflow:"hidden", position:"relative" }}>
              <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:4, transition:"width 0.5s ease", minWidth: val > 0 ? 4 : 0 }}/>
            </div>
            <div style={{ width:30, fontSize:12, fontWeight:500, color:"var(--text)", textAlign:"right", flexShrink:0 }}>{val}</div>
          </div>
        );
      })}
    </div>
  );
}

function DonutChart({ segments, size = 120 }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return <div className="empty-state" style={{padding:"20px 0"}}><p>Aucune donnée</p></div>;
  const r = 40, cx = 60, cy = 60, stroke = 16;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const arcs = segments.map(seg => {
    const pct  = seg.value / total;
    const dash = pct * circ;
    const arc  = { ...seg, dash, offset, pct };
    offset += dash;
    return arc;
  });

  return (
    <div style={{ display:"flex", alignItems:"center", gap:20 }}>
      <svg width={size} height={size} viewBox="0 0 120 120">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg3)" strokeWidth={stroke}/>
        {arcs.map((arc, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={arc.color} strokeWidth={stroke}
            strokeDasharray={`${arc.dash} ${circ - arc.dash}`}
            strokeDashoffset={-(arc.offset - circ / 4)}
            style={{ transition:"stroke-dasharray 0.5s ease" }}
          />
        ))}
        <text x={cx} y={cy-6} textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--text)">{total}</text>
        <text x={cx} y={cy+10} textAnchor="middle" fontSize="9" fill="var(--text3)">total</text>
      </svg>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12 }}>
            <div style={{ width:10, height:10, borderRadius:2, background:seg.color, flexShrink:0 }}/>
            <span style={{ color:"var(--text2)" }}>{seg.label}</span>
            <span style={{ fontWeight:500, color:"var(--text)", marginLeft:"auto" }}>{seg.value}</span>
            <span style={{ color:"var(--text3)", fontSize:11 }}>({Math.round(seg.value/total*100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarGroupChart({ data, months }) {
  const maxVal = Math.max(...data.map(d => Math.max(d.preventive||0, d.corrective||0)), 1);
  if (!months.length) return <div className="empty-state" style={{padding:"20px 0"}}><p>Aucune donnée</p></div>;
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:120, paddingBottom:20, position:"relative" }}>
      {months.map(m => {
        const entry   = data.find(d => d.month === m) || {};
        const prev    = entry.preventive || 0;
        const corr    = entry.corrective || 0;
        const prevH   = Math.round(prev / maxVal * 90);
        const corrH   = Math.round(corr / maxVal * 90);
        const label   = m.slice(5); // MM
        return (
          <div key={m} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
            <div style={{ display:"flex", gap:2, alignItems:"flex-end", height:95 }}>
              <div title={`Préventive: ${prev}`} style={{ width:10, height:prevH||2, background:"var(--success)", borderRadius:"2px 2px 0 0", opacity:0.85 }}/>
              <div title={`Corrective: ${corr}`} style={{ width:10, height:corrH||2, background:"var(--danger)", borderRadius:"2px 2px 0 0", opacity:0.85 }}/>
            </div>
            <div style={{ fontSize:9, color:"var(--text3)", marginTop:2 }}>{label}</div>
          </div>
        );
      })}
      <div style={{ position:"absolute", bottom:0, left:0, right:0, display:"flex", gap:16, justifyContent:"center" }}>
        {[["var(--success)","Préventive"],["var(--danger)","Corrective"]].map(([c,l])=>(
          <div key={l} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"var(--text2)" }}>
            <div style={{ width:8, height:8, background:c, borderRadius:2 }}/>{l}
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChart({ data, months }) {
  const maxVal = Math.max(...data.map(d => d.count||0), 1);
  const W = 100, H = 80, pad = 4;
  if (!months.length) return <div className="empty-state" style={{padding:"20px 0"}}><p>Aucune donnée</p></div>;
  const pts = months.map((m, i) => {
    const entry = data.find(d => d.month === m) || {};
    const x = pad + (i / Math.max(months.length-1,1)) * (W - pad*2);
    const y = H - pad - ((entry.count||0) / maxVal) * (H - pad*2);
    return { x, y, count: entry.count||0, month: m };
  });
  const pathD = pts.map((p, i) => `${i===0?"M":"L"}${p.x},${p.y}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:100, overflow:"visible" }}>
        <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round"/>
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="2.5" fill="var(--accent)"/>
            <title>{p.month}: {p.count}</title>
          </g>
        ))}
      </svg>
      <div style={{ display:"flex", justifyContent:"space-between" }}>
        {months.map(m => (
          <div key={m} style={{ fontSize:9, color:"var(--text3)" }}>{m.slice(5)}</div>
        ))}
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────
export default function DashboardStats({ title = "Dashboard" }) {
  const router = useRouter();
  const { alertCount } = useAlerts();
  const [data, setData]     = useState(null);
  const [loading, setLoad]  = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted) return;
    api.stats().then(setData).catch(console.error).finally(() => setLoad(false));
  }, [mounted]);

  if (loading) return (
    <Layout title={title} alertCount={alertCount}>
      <div style={{ display:"flex", justifyContent:"center", padding:80 }}><div className="spinner"/></div>
    </Layout>
  );

  if (!data) return (
    <Layout title={title} alertCount={alertCount}>
      <div className="card"><div className="empty-state"><p>Impossible de charger les statistiques</p></div></div>
    </Layout>
  );

  const { parc, maintenances, interventions, totals } = data;

  // Prépare les mois pour les graphiques
  const last6months = Array.from({ length:6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - 5 + i);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  });

  // Agréger maintenances par mois+type
  const maintMonthData = last6months.map(m => {
    const rows = (maintenances.byMonth || []).filter(r => r.month === m);
    return {
      month: m,
      preventive: Number(rows.find(r => r.type==="preventive")?.count || 0),
      corrective: Number(rows.find(r => r.type==="corrective")?.count || 0),
    };
  });

  // Ratio préventif / correctif
  const prevTotal = Number(totals.prev_done || 0);
  const corrTotal = Number(totals.corr_done || 0);
  const ratio     = prevTotal + corrTotal > 0
    ? Math.round(prevTotal / (prevTotal + corrTotal) * 100)
    : null;

  return (
    <Layout title={title} alertCount={alertCount}>

      {/* ── KPIs rapides ─────────────────────────────────────── */}
      <div className="stats-grid mb-20">
        <StatCard label="Equipements"          value={totals.total_assets}    sub="dans le parc" />
        <StatCard label="Maintenances en cours" value={totals.maint_pending}   sub="non terminées"      color={Number(totals.maint_pending)>0?"var(--warning)":undefined} onClick={()=>router.push("/maintenances")} />
        <StatCard label="Maintenances à venir"  value={totals.maint_upcoming}  sub="dans 14 jours"      color={Number(totals.maint_upcoming)>0?"var(--info)":undefined}    onClick={()=>router.push("/maintenances")} />
        <StatCard label="Interventions ouvertes"value={totals.interv_pending}  sub="en cours / planifiées" color={Number(totals.interv_pending)>0?"var(--warning)":undefined} onClick={()=>router.push("/interventions")} />
        <StatCard label="Ratio préventif"       value={ratio !== null ? `${ratio}%` : "—"} sub={ratio !== null ? `${prevTotal} prév. / ${corrTotal} corr.` : "Pas encore de données"} color={ratio >= 60 ? "var(--success)" : ratio !== null ? "var(--warning)" : undefined} />
      </div>

      {/* ── Alertes & En cours ───────────────────────────────── */}
      <div className="grid2 mb-20" style={{gap:16}}>

        {/* Maintenances non terminées */}
        <div className="card">
          <div className="section-title" style={{marginBottom:12}}>
            Maintenances non terminées
            {maintenances.pending.length > 0 && <span style={{marginLeft:8,fontSize:11,fontWeight:400,color:"var(--text3)"}}>{maintenances.pending.length}</span>}
          </div>
          {maintenances.pending.length === 0
            ? <div className="empty-state" style={{padding:"16px 0"}}><p>Toutes les maintenances sont terminées ✓</p></div>
            : maintenances.pending.slice(0,6).map(m => (
              <div key={m.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid var(--border)"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:500}}>{m.title}</div>
                  <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>{m.asset_name} {m.asset_tag && `· ${m.asset_tag}`}</div>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                  {m.scheduled_date && <span style={{fontSize:11,color:"var(--text3)"}}>{fmtDate(m.scheduled_date)}</span>}
                  <span style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:`${MAINT_STATUS_COLORS[m.status]}15`,color:MAINT_STATUS_COLORS[m.status]}}>{MAINT_STATUS_LABELS[m.status]||m.status}</span>
                </div>
              </div>
            ))
          }
          {maintenances.pending.length > 6 && (
            <button className="btn btn-ghost btn-sm" style={{marginTop:8,width:"100%",justifyContent:"center"}} onClick={()=>router.push("/maintenances")}>
              Voir les {maintenances.pending.length - 6} autres →
            </button>
          )}
        </div>

        {/* Interventions ouvertes + maintenances à venir */}
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div className="card">
            <div className="section-title" style={{marginBottom:12}}>
              Maintenances à venir <span style={{fontSize:11,fontWeight:400,color:"var(--text3)"}}>— 14 jours</span>
            </div>
            {maintenances.upcoming.length === 0
              ? <div style={{fontSize:13,color:"var(--text3)",padding:"8px 0"}}>Aucune maintenance planifiée dans les 14 jours</div>
              : maintenances.upcoming.map(m => (
                <div key={m.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid var(--border)"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:500}}>{m.title}</div>
                    <div style={{fontSize:11,color:"var(--text3)",marginTop:1}}>{m.asset_name}</div>
                  </div>
                  <span style={{fontSize:12,color:"var(--warning)",fontWeight:500,flexShrink:0}}>{daysFrom(m.scheduled_date)}</span>
                </div>
              ))
            }
          </div>

          <div className="card">
            <div className="section-title" style={{marginBottom:12}}>
              Interventions ouvertes
              {interventions.pending.length > 0 && <span style={{marginLeft:8,fontSize:11,fontWeight:400,color:"var(--text3)"}}>{interventions.pending.length}</span>}
            </div>
            {interventions.pending.length === 0
              ? <div style={{fontSize:13,color:"var(--text3)",padding:"8px 0"}}>Aucune intervention en attente ✓</div>
              : interventions.pending.slice(0,4).map(i => (
                <div key={i.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid var(--border)"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:500}}>{i.title}</div>
                    <div style={{fontSize:11,color:"var(--text3)",marginTop:1}}>{i.dept_name||"—"} {i.site_name&&`· ${i.site_name}`}</div>
                  </div>
                  <span style={{fontSize:11,color:"var(--text3)",flexShrink:0}}>{fmtDate(i.date)}</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* ── Parc ─────────────────────────────────────────────── */}
      <div style={{marginBottom:8}}>
        <div style={{fontSize:13,fontWeight:600,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:14}}>Parc informatique</div>
      </div>
      <div className="grid2 mb-20" style={{gap:16}}>
        <div className="card">
          <div className="section-title" style={{marginBottom:14}}>Equipements par site</div>
          <HBarChart
            data={parc.bysite.map(r=>({name:r.site_name||"Non assigné",count:Number(r.count)}))}
            labelKey="name" valueKey="count"
            color="var(--accent)"
          />
        </div>
        <div className="card">
          <div className="section-title" style={{marginBottom:14}}>Répartition par type et statut</div>
          <div style={{marginBottom:20}}>
            <div style={{fontSize:11,color:"var(--text3)",marginBottom:10}}>Par type</div>
            <DonutChart segments={
              parc.bytype.map(r => ({
                label: TYPE_LABELS[r.type] || r.type,
                value: Number(r.count),
                color: r.type==="laptop"?"var(--accent)":r.type==="screen"?"var(--info)":r.type==="printer"?"var(--warning)":r.type==="all_in_one"?"var(--accent2)":"var(--success)",
              }))
            }/>
          </div>
          <div style={{marginTop:16}}>
            <div style={{fontSize:11,color:"var(--text3)",marginBottom:10}}>Par statut</div>
            <DonutChart segments={
              parc.bystatus.map(r => ({
                label: STATUS_LABELS[r.status] || r.status,
                value: Number(r.count),
                color: STATUS_COLORS[r.status] || "var(--text3)",
              }))
            }/>
          </div>
        </div>
      </div>

      {/* ── Maintenances ─────────────────────────────────────── */}
      <div style={{marginBottom:8}}>
        <div style={{fontSize:13,fontWeight:600,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:14}}>Maintenances</div>
      </div>
      <div className="grid2 mb-20" style={{gap:16}}>
        <div className="card">
          <div className="section-title" style={{marginBottom:14}}>Préventives vs correctives — 6 mois</div>
          <BarGroupChart data={maintMonthData} months={last6months}/>
        </div>
        <div className="card">
          <div className="section-title" style={{marginBottom:14}}>Répartition globale</div>
          <DonutChart segments={
            (maintenances.byType||[]).map(r => ({
              label: r.type==="preventive"?"Préventive":r.type==="corrective"?"Corrective":r.type==="replacement"?"Remplacement":"Autre",
              value: Number(r.count),
              color: r.type==="preventive"?"var(--success)":r.type==="corrective"?"var(--danger)":r.type==="replacement"?"var(--warning)":"var(--info)",
            }))
          }/>
          {ratio !== null && (
            <div style={{marginTop:16,padding:"10px 14px",background:"var(--bg3)",borderRadius:8,fontSize:13}}>
              <span style={{color:"var(--text2)"}}>Ratio préventif / total : </span>
              <span style={{fontWeight:600,color:ratio>=60?"var(--success)":"var(--warning)"}}>{ratio}%</span>
              <span style={{fontSize:11,color:"var(--text3)",marginLeft:6}}>
                {ratio >= 60 ? "— Bon équilibre ✓" : "— À améliorer"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Interventions ────────────────────────────────────── */}
      <div style={{marginBottom:8}}>
        <div style={{fontSize:13,fontWeight:600,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:14}}>Interventions</div>
      </div>
      <div className="grid2 mb-20" style={{gap:16}}>
        <div className="card">
          <div className="section-title" style={{marginBottom:14}}>Par service (top 10)</div>
          <HBarChart
            data={(interventions.byDept||[]).map(r=>({name:r.dept_name||"Non assigné",count:Number(r.count)}))}
            labelKey="name" valueKey="count"
            color="var(--info)"
          />
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div className="card">
            <div className="section-title" style={{marginBottom:14}}>Activité mensuelle — 6 mois</div>
            <LineChart data={(interventions.byMonth||[]).map(r=>({month:r.month,count:Number(r.count)}))} months={last6months}/>
          </div>
          <div className="card">
            <div className="section-title" style={{marginBottom:14}}>Par technicien</div>
            {(interventions.byTech||[]).length === 0
              ? <div className="empty-state" style={{padding:"12px 0"}}><p>Aucune donnée</p></div>
              : (interventions.byTech||[]).map((t,i) => (
                <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid var(--border)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:26,height:26,borderRadius:"50%",background:"var(--bg3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:600,color:"var(--text2)",flexShrink:0}}>
                      {(t.tech||"?").split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase()}
                    </div>
                    <span style={{fontSize:13}}>{t.tech}</span>
                  </div>
                  <div style={{display:"flex",gap:12,alignItems:"center"}}>
                    <span style={{fontSize:12,color:"var(--text2)"}}>{fmtDuration(Number(t.total_min))}</span>
                    <span style={{fontSize:13,fontWeight:500,color:"var(--accent)"}}>{t.count}</span>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      </div>

    </Layout>
  );
}
