import { useRouter } from "next/router";
import { PLANNING_2025, MONTH_NAMES, getCurrentMonth, getCurrentWeek } from "../lib/planningData";

export default function PlanningWidget() {
  const router       = useRouter();
  const currentMonth = getCurrentMonth();
  const currentWeek  = getCurrentWeek();
  const nowAbs       = (currentMonth-1)*4 + currentWeek;

  // En cours
  const active = PLANNING_2025.filter(p => {
    const s = (p.month-1)*4 + p.week;
    const e = s + p.duration - 1;
    return nowAbs >= s && nowAbs <= e;
  });

  // À venir dans les 8 semaines
  const upcoming = PLANNING_2025.filter(p => {
    const s = (p.month-1)*4 + p.week;
    return s > nowAbs && s <= nowAbs + 8;
  }).slice(0, 4);

  return (
    <div className="card">
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <div className="section-title" style={{ margin:0 }}>Planning préventif</div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => router.push("/planning")}
        >
          Voir tout →
        </button>
      </div>

      {active.length > 0 && (
        <>
          <div style={{ fontSize:11, fontWeight:600, color:"var(--accent)", textTransform:"uppercase", letterSpacing:".05em", marginBottom:8 }}>
            En cours ce mois
          </div>
          {active.map(p => (
            <div key={p.service} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid var(--border)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"var(--accent)", flexShrink:0 }}/>
                <span style={{ fontSize:13, fontWeight:500 }}>{p.service}</span>
              </div>
              <span style={{ fontSize:11, color:"var(--text3)" }}>
                {MONTH_NAMES[p.month-1]} S{p.week}–S{p.week+p.duration-1}
              </span>
            </div>
          ))}
        </>
      )}

      {upcoming.length > 0 && (
        <>
          <div style={{ fontSize:11, fontWeight:600, color:"var(--warning)", textTransform:"uppercase", letterSpacing:".05em", margin:"12px 0 8px" }}>
            À venir
          </div>
          {upcoming.map(p => (
            <div key={p.service} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid var(--border)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"var(--warning)", flexShrink:0 }}/>
                <span style={{ fontSize:13, color:"var(--text2)" }}>{p.service}</span>
              </div>
              <span style={{ fontSize:11, color:"var(--text3)" }}>
                {MONTH_NAMES[p.month-1]} S{p.week}
              </span>
            </div>
          ))}
        </>
      )}

      {active.length === 0 && upcoming.length === 0 && (
        <p style={{ fontSize:13, color:"var(--text3)", textAlign:"center", padding:"12px 0" }}>
          Aucune maintenance préventive imminente
        </p>
      )}
    </div>
  );
}
