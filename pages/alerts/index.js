import Layout from "../../components/Layout";
import { useAlerts } from "../../hooks/useAlerts";

const SEV_LABELS = { critical:"Critique", warning:"Attention", info:"Info" };
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"});
}

export default function Alerts() {
  const { alerts, alertCount, loading, markRead, markAllRead } = useAlerts();

  return (
    <Layout title="Alertes" alertCount={alertCount} actions={
      alertCount > 0 && <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Tout marquer lu</button>
    }>
      {loading ? (
        <div style={{display:"flex",justifyContent:"center",padding:60}}><div className="spinner"/></div>
      ) : alerts.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{color:"var(--success)"}}><path d="M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3"/></svg>
            <p>Aucune alerte active — tout est en ordre !</p>
          </div>
        </div>
      ) : (
        ["critical","warning","info"].map(sev => {
          const group = alerts.filter(a => a.severity === sev);
          if (!group.length) return null;
          return (
            <div key={sev} style={{marginBottom:24}}>
              <div className="section-title" style={{marginBottom:12,color:sev==="critical"?"var(--danger)":sev==="warning"?"var(--warning)":"var(--info)"}}>
                {SEV_LABELS[sev]} ({group.length})
              </div>
              {group.map(a => (
                <div key={a.id} className="alert-item" style={{marginBottom:8}}>
                  <div className={`alert-dot alert-dot-${sev}`}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:500}}>{a.title}</div>
                    {a.message && <div style={{fontSize:12,color:"var(--text2)",marginTop:2}}>{a.message}</div>}
                    <div style={{fontSize:11,color:"var(--text3)",marginTop:4}}>
                      {a.asset_name && <span>{a.asset_name} · </span>}
                      {a.due_date && <span>Echéance : {fmtDate(a.due_date)}</span>}
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => markRead(a.id)}>Marquer lu</button>
                </div>
              ))}
            </div>
          );
        })
      )}
    </Layout>
  );
}
