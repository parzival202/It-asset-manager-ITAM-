import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const NAV = [
  { href:"/",              label:"Dashboard",     icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  { href:"/assets",        label:"Equipements",   icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> },
  { href:"/maintenances",  label:"Maintenances",  icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg> },
  { href:"/interventions", label:"Interventions", icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg> },
  { href:"/stats",         label:"Statistiques",  icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg> },
  { href:"/alerts",        label:"Alertes",       icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>, badge:true },
  { href:"/users",         label:"Utilisateurs",  icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg> },
];

export default function Layout({ children, title, actions, alertCount = 0 }) {
  const auth   = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || !auth) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#0f1117"}}>
      <div style={{width:24,height:24,border:"2px solid #2a3147",borderTopColor:"#4f8ef7",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  const { user, logout } = auth;
  const initials = user?.name?.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase()||"?";
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo"><h1>IT Asset Manager</h1><span>Gestion du parc</span></div>
        <nav className="sidebar-nav">
          {NAV.map(item=>(
            <button key={item.href} className={`nav-item${router.pathname===item.href||(item.href!=="/"&&router.pathname.startsWith(item.href))?" active":""}`} onClick={()=>router.push(item.href)}>
              {item.icon}{item.label}
              {item.badge&&alertCount>0&&<span className="nav-badge">{alertCount}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="user-avatar">{initials}</div>
          <div className="user-info" style={{flex:1,minWidth:0}}>
            <p style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.name}</p>
            <span>{user?.role==="admin"?"Administrateur":"Technicien"}</span>
          </div>
          <button onClick={logout} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",padding:"4px",display:"flex",alignItems:"center"}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          </button>
        </div>
      </aside>
      <main className="main">
        <div className="topbar"><h2>{title}</h2><div className="topbar-actions">{actions}</div></div>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
