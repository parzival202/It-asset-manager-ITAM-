import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import { api } from "../lib/api";
import { PLANNING_2025, MONTH_NAMES, getCurrentMonth, getCurrentWeek } from "../lib/planningData";

const TYPE_LABELS   = { laptop:"Laptop", screen:"Ecran", uc:"UC", printer:"Imprimante" };
const STATUS_COLORS = { in_service:"success", maintenance:"warning", retired:"neutral", storage:"info" };
const STATUS_LABELS = { in_service:"En service", maintenance:"En maintenance", retired:"Retiré", storage:"En stock" };
const MAINT_TYPES   = { preventive:"Préventive", corrective:"Corrective", replacement:"Remplacement", deployment:"Déploiement" };

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day:"2-digit", month:"short", year:"numeric" });
}
function daysFrom(d) {
  if (!d) return null;
  const n = Math.round((new Date(d) - Date.now()) / 86400000);
  if (n === 0) return "aujourd'hui";
  if (n === 1) return "demain";
  return `dans ${n} j`;
}

export default function Dashboard() {
  const router = useRouter();
  const [data, setData]       = useState(null);
  const [stats, setStats]     = useState(null);
  const [alerts, setAlerts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    Promise.all([api.dashboard(), api.alerts.list(), api.stats()])
      .then(([d, a, s]) => { setData(d); setAlerts(a); setStats(s); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [mounted]);

  // Planning widget
  const cm = getCurrentMonth();
  const cw = getCurrentWeek();
  const nowAbs = (cm-1)*4 + cw;
  const planningNow = PLANNING_2025.filter(p => {
    const s=(p.month-1)*4+p.week, e=s+p.duration-1;
    return nowAbs>=s && nowAbs<=e;
  });
  const planningNext = PLANNING_2025.filter(p => {
    const s=(p.month-1)*4+p.week;
    return s>nowAbs && s<=nowAbs+8;
  }).slice(0,3);

  const { upcoming_maintenances, recent_maintenances } = data || {};
  const totals = stats?.totals || {};

  return (
    <Layout title="Dashboard" alertCount={alerts.length}>
      {loading ? (
        <div style={{display:"flex",justifyContent:"center",padding:60}}><div className="spinner"/></div>
      ) : (
        <>
          {/* KPIs enrichis */}
          <div className="stats-grid mb-20">
            <div className="stat-card">
              <div className="stat-label">Total équipements</div>
              <div className="stat-value">{totals.total_assets ?? data?.stats?.total_assets ?? 0}</div>
              <div className="stat-sub">dans le parc</div>
            </div>
            <div className="stat-card" style={{cursor:"pointer",borderLeft:`3px solid ${Number(totals.maint_pending)>0?"var(--warning)":"var(--border)"}`}}
                 onClick={()=>router.push("/maintenances")}>
              <div className="stat-label">Maintenances en cours</div>
              <div className="stat-value" style={{color:Number(totals.maint_pending)>0?"var(--warning)":"var(--text)"}}>{totals.maint_pending ?? 0}</div>
              <div className="stat-sub">non terminées</div>
            </div>
            <div className="stat-card" style={{cursor:"pointer",borderLeft:`3px solid ${Number(totals.maint_upcoming)>0?"var(--info)":"var(--border)"}`}}
                 onClick={()=>router.push("/maintenances")}>
              <div className="stat-label">Maintenances à venir</div>
              <div className="stat-value" style={{color:Number(totals.maint_upcoming)>0?"var(--info)":"var(--text)"}}>{totals.maint_upcoming ?? 0}</div>
              <div className="stat-sub">dans 14 jours</div>
            </div>
            <div className="stat-card" style={{cursor:"pointer",borderLeft:`3px solid ${Number(totals.interv_pending)>0?"var(--warning)":"var(--border)"}`}}
                 onClick={()=>router.push("/interventions")}>
              <div className="stat-label">Interventions ouvertes</div>
              <div className="stat-value" style={{color:Number(totals.interv_pending)>0?"var(--warning)":"var(--text)"}}>{totals.interv_pending ?? 0}</div>
              <div className="stat-sub">en attente</div>
            </div>
            <div className="stat-card" style={{cursor:"pointer"}} onClick={()=>router.push("/alerts")}>
              <div className="stat-label">Alertes actives</div>
              <div className="stat-value" style={{color:alerts.length>0?"var(--danger)":"var(--success)"}}>{alerts.length}</div>
              <div className="stat-sub">à traiter</div>
            </div>
          </div>

          <div className="grid2" style={{gap:20,marginBottom:20}}>
            {/* Colonne gauche */}
            <div style={{display:"flex",flexDirection:"column",gap:16}}>

              {/* Alertes actives */}
              <div className="card">
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                  <div className="section-title" style={{margin:0}}>Alertes actives</div>
                  {alerts.length>0&&<button className="btn btn-ghost btn-sm" onClick={()=>router.push("/alerts")}>Voir tout →</button>}
                </div>
                {alerts.length===0
                  ? <div className="empty-state" style={{padding:"16px 0"}}><p>Aucune alerte active</p></div>
                  : alerts.slice(0,4).map(a=>(
                    <div key={a.id} className="alert-item" style={{marginBottom:8,padding:"10px 12px"}}>
                      <div className={`alert-dot alert-dot-${a.severity}`}/>
                      <div>
                        <div style={{fontSize:13,fontWeight:500}}>{a.title}</div>
                        <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>{a.asset_name}</div>
                      </div>
                    </div>
                  ))
                }
              </div>

              {/* Maintenances à venir */}
              <div className="card">
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                  <div className="section-title" style={{margin:0}}>Maintenances à venir</div>
                  <button className="btn btn-ghost btn-sm" onClick={()=>router.push("/maintenances")}>Voir tout →</button>
                </div>
                {!upcoming_maintenances?.length
                  ? <div className="empty-state" style={{padding:"16px 0"}}><p>Aucune maintenance planifiée</p></div>
                  : upcoming_maintenances.map(m=>(
                    <div key={m.id} className="tl-item">
                      <div className="tl-dot tl-dot-blue" style={{marginTop:4}}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:500}}>{m.title}</div>
                        <div className="tl-meta">{m.asset_name} · {fmtDate(m.scheduled_date)}</div>
                      </div>
                      <span className="badge badge-info" style={{fontSize:11}}>{MAINT_TYPES[m.type]||m.type}</span>
                    </div>
                  ))
                }
              </div>
            </div>

            {/* Colonne droite */}
            <div style={{display:"flex",flexDirection:"column",gap:16}}>

              {/* Planning préventif */}
              <div className="card">
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                  <div className="section-title" style={{margin:0}}>Planning préventif</div>
                  <button className="btn btn-ghost btn-sm" onClick={()=>router.push("/maintenances")}>Calendrier →</button>
                </div>
                {planningNow.length>0&&(
                  <>
                    <div style={{fontSize:11,fontWeight:600,color:"var(--accent)",textTransform:"uppercase",letterSpacing:".04em",marginBottom:8}}>En cours ce mois</div>
                    {planningNow.map(p=>(
                      <div key={p.service} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid var(--border)"}}>
                        <div style={{display:"flex",alignItems:"center",gap:7}}>
                          <div style={{width:6,height:6,borderRadius:"50%",background:"var(--accent)",flexShrink:0}}/>
                          <span style={{fontSize:13,fontWeight:500}}>{p.service}</span>
                        </div>
                        <span style={{fontSize:11,color:"var(--text3)"}}>{MONTH_NAMES[p.month-1]} S{p.week}–S{p.week+p.duration-1}</span>
                      </div>
                    ))}
                  </>
                )}
                {planningNext.length>0&&(
                  <>
                    <div style={{fontSize:11,fontWeight:600,color:"var(--warning)",textTransform:"uppercase",letterSpacing:".04em",margin:"12px 0 8px"}}>À venir</div>
                    {planningNext.map(p=>(
                      <div key={p.service} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid var(--border)"}}>
                        <div style={{display:"flex",alignItems:"center",gap:7}}>
                          <div style={{width:6,height:6,borderRadius:"50%",background:"var(--warning)",flexShrink:0}}/>
                          <span style={{fontSize:13,color:"var(--text2)"}}>{p.service}</span>
                        </div>
                        <span style={{fontSize:11,color:"var(--text3)"}}>{MONTH_NAMES[p.month-1]} S{p.week}</span>
                      </div>
                    ))}
                  </>
                )}
                {planningNow.length===0&&planningNext.length===0&&(
                  <p style={{fontSize:13,color:"var(--text3)"}}>Aucune maintenance préventive imminente</p>
                )}
              </div>

              {/* Dernières interventions */}
              <div className="card">
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                  <div className="section-title" style={{margin:0}}>Dernières interventions</div>
                  <button className="btn btn-ghost btn-sm" onClick={()=>router.push("/interventions")}>Voir tout →</button>
                </div>
                {(recent_maintenances||[]).length===0
                  ? <div className="empty-state" style={{padding:"16px 0"}}><p>Aucune intervention récente</p></div>
                  : (recent_maintenances||[]).map(m=>(
                    <div key={m.id} className="tl-item">
                      <div className="tl-dot tl-dot-green" style={{marginTop:4}}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:500}}>{m.title}</div>
                        <div className="tl-meta">{m.asset_name} · {fmtDate(m.completed_at)}</div>
                      </div>
                    </div>
                  ))
                }
              </div>

              {/* Lien stats */}
              <button className="btn btn-ghost" style={{justifyContent:"center",width:"100%"}} onClick={()=>router.push("/stats")}>
                📊 Voir les statistiques avancées →
              </button>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
