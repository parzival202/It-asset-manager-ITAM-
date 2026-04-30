import Layout from "../../components/Layout";
import { useAlerts } from "../../hooks/useAlerts";
import { PLANNING_2025, MONTHS, MONTH_NAMES, getCurrentMonth, getCurrentWeek } from "../../lib/planningData";
import { useState } from "react";

const STATUS_COLORS = {
  done:    { bg: "rgba(52,211,153,0.15)",  border: "var(--success)", text: "var(--success)" },
  current: { bg: "rgba(79,142,247,0.25)",  border: "var(--accent)",  text: "var(--accent)"  },
  next:    { bg: "rgba(251,191,36,0.15)",  border: "var(--warning)", text: "var(--warning)"  },
  planned: { bg: "rgba(96,165,250,0.08)",  border: "transparent",    text: "var(--text3)"   },
};

function getCellStatus(planMonth, planWeek, planDuration, currentMonth, currentWeek) {
  const startAbs = (planMonth - 1) * 4 + planWeek;
  const endAbs   = startAbs + planDuration - 1;
  const nowAbs   = (currentMonth - 1) * 4 + currentWeek;

  if (endAbs < nowAbs)   return "done";
  if (startAbs > nowAbs + 8) return "planned";
  if (startAbs <= nowAbs && endAbs >= nowAbs) return "current";
  return "next";
}

function StatusLegend() {
  return (
    <div style={{ display:"flex", gap:16, flexWrap:"wrap", alignItems:"center" }}>
      {[
        { key:"done",    label:"Effectuée" },
        { key:"current", label:"En cours" },
        { key:"next",    label:"À venir (2 mois)" },
        { key:"planned", label:"Planifiée" },
      ].map(({ key, label }) => (
        <div key={key} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"var(--text2)" }}>
          <div style={{
            width:14, height:14, borderRadius:3,
            background: STATUS_COLORS[key].bg,
            border: `1.5px solid ${STATUS_COLORS[key].border || "var(--border)"}`,
          }}/>
          {label}
        </div>
      ))}
    </div>
  );
}

export default function Planning() {
  const { alertCount }      = useAlerts();
  const [year, setYear]     = useState(2025);
  const currentMonth        = getCurrentMonth();
  const currentWeek         = getCurrentWeek();

  // Colonnes : 12 mois × 4 semaines = 48 colonnes
  const WEEKS = [1,2,3,4];

  // Services en cours ce mois
  const activeNow = PLANNING_2025.filter(p => {
    const startAbs = (p.month-1)*4 + p.week;
    const endAbs   = startAbs + p.duration - 1;
    const nowAbs   = (currentMonth-1)*4 + currentWeek;
    return nowAbs >= startAbs && nowAbs <= endAbs;
  });

  const upcomingNext = PLANNING_2025.filter(p => {
    const startAbs = (p.month-1)*4 + p.week;
    const nowAbs   = (currentMonth-1)*4 + currentWeek;
    return startAbs > nowAbs && startAbs <= nowAbs + 8;
  });

  return (
    <Layout title="Planning maintenances préventives" alertCount={alertCount} actions={
      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        <span style={{ fontSize:12, color:"var(--text3)" }}>Année</span>
        <select className="form-input form-select" style={{ width:90 }} value={year} onChange={e => setYear(Number(e.target.value))}>
          <option value={2025}>2025</option>
          <option value={2026}>2026</option>
        </select>
      </div>
    }>

      {/* Résumé rapide */}
      <div className="grid2 mb-20" style={{ gap:14 }}>
        <div className="card" style={{ borderLeft:"3px solid var(--accent)" }}>
          <div className="section-title">En cours ce mois</div>
          {activeNow.length === 0
            ? <p style={{ fontSize:13, color:"var(--text3)" }}>Aucune maintenance en cours</p>
            : activeNow.map(p => (
              <div key={p.service} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid var(--border)" }}>
                <span style={{ fontSize:13, fontWeight:500 }}>{p.service}</span>
                <span className="badge badge-info">{MONTH_NAMES[p.month-1]} S{p.week}–S{p.week+p.duration-1}</span>
              </div>
            ))
          }
        </div>
        <div className="card" style={{ borderLeft:"3px solid var(--warning)" }}>
          <div className="section-title">À venir (2 mois)</div>
          {upcomingNext.length === 0
            ? <p style={{ fontSize:13, color:"var(--text3)" }}>Aucune maintenance imminente</p>
            : upcomingNext.map(p => (
              <div key={p.service} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid var(--border)" }}>
                <span style={{ fontSize:13, fontWeight:500 }}>{p.service}</span>
                <span className="badge badge-warning">{MONTH_NAMES[p.month-1]} S{p.week}</span>
              </div>
            ))
          }
        </div>
      </div>

      {/* Légende */}
      <div className="card mb-16" style={{ padding:"12px 16px" }}>
        <StatusLegend />
      </div>

      {/* Grille calendrier */}
      <div className="card" style={{ padding:0, overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:900, tableLayout:"fixed" }}>
          <colgroup>
            <col style={{ width:110 }}/>
            {MONTHS.map((_, mi) => WEEKS.map((_, wi) => (
              <col key={`${mi}-${wi}`} style={{ width:18 }}/>
            )))}
          </colgroup>
          <thead>
            {/* Ligne mois */}
            <tr>
              <th style={{ padding:"8px 12px", background:"var(--bg3)", fontSize:11, fontWeight:600, color:"var(--text3)", textTransform:"uppercase", letterSpacing:".04em", borderBottom:"1px solid var(--border)", textAlign:"left" }}>
                Services
              </th>
              {MONTHS.map((m, mi) => (
                <th key={mi} colSpan={4} style={{
                  padding:"6px 2px", background: mi+1 === currentMonth ? "rgba(79,142,247,0.08)" : "var(--bg3)",
                  fontSize:11, fontWeight:600, color: mi+1 === currentMonth ? "var(--accent)" : "var(--text3)",
                  textTransform:"uppercase", letterSpacing:".04em",
                  borderBottom:"1px solid var(--border)", borderLeft:"1px solid var(--border)",
                  textAlign:"center",
                }}>
                  {m}
                </th>
              ))}
            </tr>
            {/* Ligne semaines */}
            <tr>
              <th style={{ background:"var(--bg3)", borderBottom:"1px solid var(--border)" }}/>
              {MONTHS.map((_, mi) => WEEKS.map(w => (
                <th key={`${mi}-${w}`} style={{
                  padding:"3px 0", background: mi+1 === currentMonth ? "rgba(79,142,247,0.05)" : "var(--bg3)",
                  fontSize:9, fontWeight:400, color:"var(--text3)",
                  borderBottom:"1px solid var(--border)",
                  borderLeft: w===1 ? "1px solid var(--border)" : "none",
                  textAlign:"center",
                }}>
                  {w===1||w===3 ? `S${w}` : ""}
                </th>
              )))}
            </tr>
          </thead>
          <tbody>
            {PLANNING_2025.map((entry, ri) => (
              <tr key={entry.service} style={{ background: ri%2===0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                <td style={{
                  padding:"5px 12px", fontSize:12, fontWeight:500, color:"var(--text2)",
                  borderBottom:"1px solid var(--border)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                }}>
                  {entry.service}
                </td>
                {MONTHS.map((_, mi) => WEEKS.map(w => {
                  const month   = mi + 1;
                  const cellAbs = (mi)*4 + w;
                  const startAbs= (entry.month-1)*4 + entry.week;
                  const endAbs  = startAbs + entry.duration - 1;
                  const isInRange = cellAbs >= startAbs && cellAbs <= endAbs;
                  const status  = getCellStatus(entry.month, entry.week, entry.duration, currentMonth, currentWeek);
                  const isMonthBorder = w === 1;
                  const nowAbs  = (currentMonth-1)*4 + currentWeek;
                  const isNow   = cellAbs === nowAbs;

                  return (
                    <td key={`${mi}-${w}`} style={{
                      padding:0, height:28,
                      borderBottom:"1px solid var(--border)",
                      borderLeft: isMonthBorder ? "1px solid var(--border)" : "1px solid rgba(255,255,255,0.03)",
                      background: isInRange
                        ? STATUS_COLORS[status].bg
                        : isNow ? "rgba(79,142,247,0.04)" : "transparent",
                      position:"relative",
                    }}>
                      {isInRange && w === entry.week && (
                        <div style={{
                          position:"absolute", top:4, left:2, right:2, bottom:4,
                          borderRadius:3,
                          background: STATUS_COLORS[status].bg,
                          border: `1.5px solid ${STATUS_COLORS[status].border}`,
                        }}/>
                      )}
                      {isNow && (
                        <div style={{
                          position:"absolute", top:0, bottom:0, left:"50%",
                          width:2, background:"rgba(79,142,247,0.4)",
                          transform:"translateX(-50%)",
                        }}/>
                      )}
                    </td>
                  );
                }))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer signataires */}
        <div style={{
          display:"grid", gridTemplateColumns:"1fr 1fr 1fr",
          gap:0, borderTop:"1px solid var(--border)", padding:"12px 16px",
        }}>
          {[
            { role:"Réalisé par",  name:"Mr. KOUADIO K. Olivier", title:"Administrateur Système" },
            { role:"Vérifié par",  name:"Mr. AMER RAHEB",         title:"Directeur Audit et Informatique" },
            { role:"Approuvé par", name:"Mr. KARIM HOJEIJ",       title:"Directeur Général Adjoint" },
          ].map(s => (
            <div key={s.role} style={{ padding:"0 12px", borderRight:"1px solid var(--border)" }}>
              <div style={{ fontSize:11, fontWeight:600, color:"var(--text3)", marginBottom:4 }}>{s.role}</div>
              <div style={{ fontSize:12, fontWeight:500 }}>{s.name}</div>
              <div style={{ fontSize:11, color:"var(--text3)" }}>{s.title}</div>
              <div style={{ fontSize:11, color:"var(--text3)", marginTop:2 }}>Date : 07/01/2025</div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
