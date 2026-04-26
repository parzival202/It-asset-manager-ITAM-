import Layout from "../../components/Layout";
import DataTable from "../../components/DataTable";
import { useMaintenances } from "../../hooks/useMaintenances";
import { useAlerts } from "../../hooks/useAlerts";
import { useState } from "react";

const MAINT_TYPES   = { preventive:"Préventive", corrective:"Corrective", replacement:"Remplacement", deployment:"Déploiement" };
const STATUS_COLORS = { planned:"info", in_progress:"warning", completed:"success", cancelled:"neutral" };
const STATUS_LABELS = { planned:"Planifiée", in_progress:"En cours", completed:"Terminée", cancelled:"Annulée" };

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day:"2-digit", month:"short", year:"numeric" });
}

export default function Maintenances() {
  const [filters, setFilters] = useState({ status:"", type:"" });
  const { maintenances, loading, markDone } = useMaintenances(filters);
  const { alertCount } = useAlerts();

  const COLUMNS = [
    { label:"Titre",      accessor:"title",          sortable:true, render: r => <span style={{fontWeight:500}}>{r.title}</span> },
    { label:"Type",       accessor:"type",           sortable:true, render: r => <span className="badge badge-neutral">{MAINT_TYPES[r.type]||r.type}</span> },
    { label:"Equipement", accessor:"asset_name",     sortable:true, render: r => (
      <div>
        <div>{r.asset_name||"—"}</div>
        {r.asset_tag && <div className="mono" style={{fontSize:11}}>{r.asset_tag}</div>}
      </div>
    )},
    { label:"Technicien",  accessor:"tech_name",     sortable:true, render: r => r.tech_name || r.performed_by_name || <span className="text-faint">—</span> },
    { label:"Planifiée",   accessor:"scheduled_date", sortable:true, render: r => fmtDate(r.scheduled_date) },
    { label:"Terminée",    accessor:"completed_at",   sortable:true, render: r => fmtDate(r.completed_at) },
    { label:"Statut",      accessor:"status",         sortable:true, render: r => <span className={`badge badge-${STATUS_COLORS[r.status]||"neutral"}`}>{STATUS_LABELS[r.status]||r.status}</span> },
    { label:"", key:"actions", render: r => (
      (r.status === "planned" || r.status === "in_progress") &&
      <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); markDone(r.id); }}>✓ Terminer</button>
    )},
  ];

  return (
    <Layout title="Maintenances" alertCount={alertCount}>
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
            {(filters.status||filters.type) && <button className="btn btn-ghost btn-sm" onClick={()=>setFilters({status:"",type:""})}>Effacer</button>}
          </>
        }
      />
    </Layout>
  );
}
