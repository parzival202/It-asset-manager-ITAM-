import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { api } from "../lib/api";

const TYPE_LABELS = { laptop:"Laptop", screen:"Ecran", uc:"UC", printer:"Imprimante" };
const STATUS_COLORS = { in_service:"success", maintenance:"warning", retired:"neutral", storage:"info" };
const STATUS_LABELS = { in_service:"En service", maintenance:"En maintenance", retired:"Retiré", storage:"En stock" };
const MAINT_TYPES = { preventive:"Préventive", corrective:"Corrective", replacement:"Remplacement", deployment:"Déploiement" };

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day:"2-digit", month:"short", year:"numeric" });
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    Promise.all([api.dashboard(), api.alerts.list()])
      .then(([d, a]) => { setData(d); setAlerts(a); })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [mounted]);

  const { stats, upcoming_maintenances, recent_maintenances } = data || {};

  return (
    <Layout title="Dashboard" alertCount={alerts.length}>
      {loading ? (
        <div style={{display:"flex",justifyContent:"center",padding:60}}>
          <div className="spinner"/>
        </div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total équipements</div>
              <div className="stat-value">{stats?.total_assets ?? 0}</div>
              <div className="stat-sub">dans le parc</div>
            </div>
            {(stats?.by_type || []).map(t => (
              <div className="stat-card" key={t.type}>
                <div className="stat-label">{TYPE_LABELS[t.type] || t.type}</div>
                <div className="stat-value">{t.count}</div>
                <div className="stat-sub">équipements</div>
              </div>
            ))}
            <div className="stat-card">
              <div className="stat-label">Alertes actives</div>
              <div className="stat-value" style={{color: alerts.length > 0 ? "var(--danger)" : "var(--success)"}}>
                {alerts.length}
              </div>
              <div className="stat-sub">à traiter</div>
            </div>
          </div>

          <div className="grid2" style={{gap:20}}>
            <div>
              <div className="card mb-20">
                <div className="section-title">Statut du parc</div>
                {(stats?.by_status || []).map(s => (
                  <div key={s.status} className="flex-between" style={{padding:"6px 0",borderBottom:"1px solid var(--border)"}}>
                    <span className={`badge badge-${STATUS_COLORS[s.status]||"neutral"}`}>{STATUS_LABELS[s.status]||s.status}</span>
                    <span style={{fontWeight:500}}>{s.count}</span>
                  </div>
                ))}
              </div>

              <div className="card">
                <div className="section-title">Alertes actives</div>
                {alerts.length === 0
                  ? <div className="empty-state" style={{padding:"20px 0"}}><p>Aucune alerte active</p></div>
                  : alerts.slice(0,5).map(a => (
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
            </div>

            <div>
              <div className="card mb-20">
                <div className="section-title">Maintenances à venir</div>
                {!upcoming_maintenances?.length
                  ? <div className="empty-state" style={{padding:"20px 0"}}><p>Aucune maintenance planifiée</p></div>
                  : upcoming_maintenances.map(m => (
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

              <div className="card">
                <div className="section-title">Dernières interventions</div>
                {(recent_maintenances||[]).map(m => (
                  <div key={m.id} className="tl-item">
                    <div className="tl-dot tl-dot-green" style={{marginTop:4}}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:500}}>{m.title}</div>
                      <div className="tl-meta">{m.asset_name} · {fmtDate(m.completed_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
