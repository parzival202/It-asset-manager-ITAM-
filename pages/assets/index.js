import { useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../components/Layout";
import DataTable from "../../components/DataTable";
import { useAssets } from "../../hooks/useAssets";
import { useAlerts } from "../../hooks/useAlerts";
import { useMeta } from "../../hooks/useMeta";
import { api } from "../../lib/api";
import { downloadExcel, printReport } from "../../lib/reportExport";

const TYPE_LABELS   = { laptop:"Laptop", screen:"Ecran", uc:"UC", printer:"Imprimante", all_in_one:"All-in-one", scanner:"Scanner" };
const STATUS_COLORS = { in_service:"success", maintenance:"warning", retired:"neutral", storage:"info" };
const STATUS_LABELS = { in_service:"En service", maintenance:"En maintenance", retired:"Retiré", storage:"En stock" };

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day:"2-digit", month:"short", year:"numeric" });
}

function warrantyBadge(d) {
  if (!d) return <span className="text-faint text-xs">—</span>;
  const days = (new Date(d) - Date.now()) / 86400000;
  const cls = days < 0 ? "badge-danger" : days < 30 ? "badge-warning" : "badge-success";
  return <span className={`badge ${cls}`}>{fmtDate(d)}</span>;
}

function AssetModal({ asset, meta, onClose, onSave }) {
  const [form, setForm] = useState(asset || { type:"laptop", status:"in_service", maintenance_interval_days:180 });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const filteredDepts = meta.deptsBySite(form.site_id);

  async function submit(e) {
    e.preventDefault(); setLoading(true);
    try { await onSave(form); onClose(); }
    catch (err) { alert(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{asset ? "Modifier l'équipement" : "Ajouter un équipement"}</h3>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--text2)",cursor:"pointer",fontSize:20}}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Tag *</label><input className="form-input" required value={form.asset_tag||""} onChange={e=>set("asset_tag",e.target.value)} placeholder="AST-LAP-001"/></div>
              <div className="form-group"><label className="form-label">Nom *</label><input className="form-input" required value={form.name||""} onChange={e=>set("name",e.target.value)}/></div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Type *</label>
                <select className="form-input form-select" value={form.type} onChange={e=>set("type",e.target.value)}>
                  {Object.entries(TYPE_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Statut</label>
                <select className="form-input form-select" value={form.status} onChange={e=>set("status",e.target.value)}>
                  {Object.entries(STATUS_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Marque</label><input className="form-input" value={form.brand||""} onChange={e=>set("brand",e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Modèle</label><input className="form-input" value={form.model||""} onChange={e=>set("model",e.target.value)}/></div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">N° de série</label><input className="form-input" value={form.serial_number||""} onChange={e=>set("serial_number",e.target.value)}/></div>
              <div className="form-group"><label className="form-label">OS</label><input className="form-input" value={form.operating_system||""} onChange={e=>set("operating_system",e.target.value)}/></div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">RAM</label><input className="form-input" value={form.ram||""} onChange={e=>set("ram",e.target.value)} placeholder="16 Go"/></div>
              <div className="form-group"><label className="form-label">Stockage</label><input className="form-input" value={form.storage||""} onChange={e=>set("storage",e.target.value)} placeholder="512 Go SSD"/></div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Site</label>
                <select className="form-input form-select" value={form.site_id||""} onChange={e=>{set("site_id",e.target.value);set("department_id","");}}>
                  <option value="">— Choisir —</option>
                  {meta.sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Service</label>
                <select className="form-input form-select" value={form.department_id||""} onChange={e=>set("department_id",e.target.value)}>
                  <option value="">— Choisir —</option>
                  {filteredDepts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Utilisateur assigné</label><input className="form-input" value={form.assigned_user_name||""} onChange={e=>set("assigned_user_name",e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Titre / Poste</label><input className="form-input" value={form.assigned_user_title||""} onChange={e=>set("assigned_user_title",e.target.value)}/></div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Date déploiement</label><input className="form-input" type="date" value={form.deployment_date||""} onChange={e=>set("deployment_date",e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Date d'achat</label><input className="form-input" type="date" value={form.purchase_date||""} onChange={e=>set("purchase_date",e.target.value)}/></div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Prix d'achat (FCFA)</label><input className="form-input" type="number" value={form.purchase_price||""} onChange={e=>set("purchase_price",e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Fournisseur</label><input className="form-input" value={form.supplier||""} onChange={e=>set("supplier",e.target.value)}/></div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label className="form-label">Fin de garantie</label><input className="form-input" type="date" value={form.warranty_end_date||""} onChange={e=>set("warranty_end_date",e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Fin de vie prévue</label><input className="form-input" type="date" value={form.planned_end_of_life||""} onChange={e=>set("planned_end_of_life",e.target.value)}/></div>
            </div>
            <div className="form-group"><label className="form-label">Intervalle maintenance (jours)</label><input className="form-input" type="number" value={form.maintenance_interval_days||180} onChange={e=>set("maintenance_interval_days",e.target.value)}/></div>
            <div className="form-group"><label className="form-label">Notes techniques</label><textarea className="form-input" value={form.notes||""} onChange={e=>set("notes",e.target.value)}/></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Enregistrement..." : asset ? "Modifier" : "Ajouter"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReportModal({ assets, meta, onClose }) {
  const [form, setForm] = useState({ type:"", site_id:"", department_id:"", status:"", format:"excel" });
  const set = (key, value) => setForm(current => ({ ...current, [key]: value, ...(key === "site_id" ? { department_id:"" } : {}) }));
  const departments = meta.deptsBySite(form.site_id);
  const filteredAssets = assets.filter(asset =>
    (!form.type || asset.type === form.type) &&
    (!form.site_id || String(asset.site_id) === String(form.site_id)) &&
    (!form.department_id || String(asset.department_id) === String(form.department_id)) &&
    (!form.status || asset.status === form.status)
  );

  function submit(event) {
    event.preventDefault();
    if (!filteredAssets.length) {
      window.alert("Aucun équipement ne correspond aux critères sélectionnés.");
      return;
    }
    const rows = filteredAssets.map(asset => [
      asset.asset_tag,
      asset.name,
      TYPE_LABELS[asset.type] || asset.type,
      STATUS_LABELS[asset.status] || asset.status,
      asset.site_name || "—",
      asset.department_name || "—",
      asset.assigned_user_name || "—",
      asset.brand || "—",
      asset.model || "—",
      asset.serial_number || "—",
    ]);
    const headers = ["Tag", "Équipement", "Type", "Statut", "Site", "Service", "Utilisateur", "Marque", "Modèle", "N° de série"];
    const criteria = [
      form.type ? `Type : ${TYPE_LABELS[form.type]}` : null,
      form.site_id ? `Site : ${meta.sites.find(site => String(site.id) === String(form.site_id))?.name}` : null,
      form.department_id ? `Service : ${departments.find(department => String(department.id) === String(form.department_id))?.name}` : null,
      form.status ? `Statut : ${STATUS_LABELS[form.status]}` : null,
    ].filter(Boolean);
    const subtitle = `${filteredAssets.length} équipement(s) · ${criteria.length ? criteria.join(" · ") : "Tous les équipements"}`;
    if (form.format === "excel") downloadExcel("rapport-equipements", headers, rows);
    else printReport("Rapport des équipements", headers, rows, subtitle);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={event => event.target === event.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3>Générer un rapport</h3>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--text2)",cursor:"pointer",fontSize:20}}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <p style={{ marginTop:0, color:"var(--text2)", fontSize:13 }}>Sélectionnez les équipements à extraire.</p>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Type d'équipement</label>
                <select className="form-input form-select" value={form.type} onChange={event => set("type", event.target.value)}>
                  <option value="">Tous les types</option>
                  {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Statut</label>
                <select className="form-input form-select" value={form.status} onChange={event => set("status", event.target.value)}>
                  <option value="">Tous les statuts</option>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}{value === "maintenance" ? " / panne" : ""}</option>)}
                </select>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Site</label>
                <select className="form-input form-select" value={form.site_id} onChange={event => set("site_id", event.target.value)}>
                  <option value="">Tous les sites</option>
                  {meta.sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Service</label>
                <select className="form-input form-select" value={form.department_id} onChange={event => set("department_id", event.target.value)}>
                  <option value="">Tous les services</option>
                  {departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Format d'extraction</label>
              <select className="form-input form-select" value={form.format} onChange={event => set("format", event.target.value)}>
                <option value="excel">Excel (CSV)</option>
                <option value="pdf">PDF (impression)</option>
              </select>
            </div>
            <div style={{ fontSize:12, color:"var(--text3)" }}>{filteredAssets.length} équipement(s) correspondent aux critères.</div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary">Générer le rapport</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Assets() {
  const router = useRouter();
  const [filters, setFilters] = useState({ search:"", type:"", status:"" });
  const [modal, setModal]     = useState(false);
  const [reportModal, setReportModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const { assets, loading, create, update, remove } = useAssets(filters);
  const { assets: reportAssets, reload: reportReload } = useAssets({});
  const { alertCount }  = useAlerts();
  const meta = useMeta();

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const COLUMNS = [
    { label:"Tag",     accessor:"asset_tag",  sortable:true, render: r => <span className="mono">{r.asset_tag}</span> },
    { label:"Nom",     accessor:"name",       sortable:true, render: r => (
      <div>
        <span style={{fontWeight:500}}>{r.name}</span>
        {r.brand && <div style={{fontSize:11,color:"var(--text3)"}}>{r.brand} · {r.model}</div>}
      </div>
    )},
    { label:"Type",    accessor:"type",       sortable:true, render: r => <span className="badge badge-neutral">{TYPE_LABELS[r.type]||r.type}</span> },
    { label:"Statut",  accessor:"status",     sortable:true, render: r => <span className={`badge badge-${STATUS_COLORS[r.status]||"neutral"}`}>{STATUS_LABELS[r.status]||r.status}</span> },
    { label:"Site / Service", accessor:"site_name", sortable:true, render: r => (
      <div>
        <div>{r.site_name||"—"}</div>
        {r.department_name && <div style={{fontSize:11,color:"var(--text3)"}}>{r.department_name}</div>}
      </div>
    )},
    { label:"Utilisateur", accessor:"assigned_user_name", sortable:true, render: r => (
      <div>
        <div>{r.assigned_user_name||"—"}</div>
        {r.assigned_user_title && <div style={{fontSize:11,color:"var(--text3)"}}>{r.assigned_user_title}</div>}
      </div>
    )},
    { label:"Mise en service", accessor:"deployment_date", sortable:true, render: r => (
  r.deployment_date
    ? <span style={{fontSize:13,color:"var(--text2)"}}>{fmtDate(r.deployment_date)}</span>
    : <span className="text-faint text-xs">—</span>
)},
    { label:"", key:"actions", render: r => (
      <div style={{display:"flex",gap:6}}>
        <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setEditing(r); setModal(true); }}>Modifier</button>
        <button className="btn btn-ghost btn-sm" onClick={async e => {
          e.stopPropagation();
          if (!window.confirm(`Supprimer l’équipement « ${r.name} » ? Cette action est irréversible.`)) return;
          try { await remove(r.id); await reportReload(); }
          catch (err) { window.alert(err.message); }
        }}>Supprimer</button>
      </div>
    )},
  ];

  async function handleSave(form) {
    if (editing) await update(editing.id, form);
    else await create(form);
    await reportReload();
  }
  return (
    <Layout title="Equipements" alertCount={alertCount} actions={<div style={{display:"flex",gap:8}}>
      <button className="btn btn-ghost" onClick={()=>setReportModal(true)}>Rapport</button>
      <button className="btn btn-primary" onClick={() => { setEditing(null); setModal(true); }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
        Ajouter
      </button></div>}>
      <DataTable
        columns={COLUMNS}
        data={assets}
        loading={loading}
        emptyMessage="Aucun équipement trouvé"
        onRowClick={row => router.push(`/assets/${row.id}`)}
        searchable
        searchPlaceholder="Nom, tag, série, utilisateur..."
        searchAccessors={["serial_number"]}
        pageSize={25}
        filters={
          <>
            <select className="form-input form-select" style={{width:150}} value={filters.type} onChange={e=>setFilter("type",e.target.value)}>
              <option value="">Tous les types</option>
              {Object.entries(TYPE_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
            <select className="form-input form-select" style={{width:170}} value={filters.status} onChange={e=>setFilter("status",e.target.value)}>
              <option value="">Tous les statuts</option>
              {Object.entries(STATUS_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
            {(filters.type||filters.status) && <button className="btn btn-ghost btn-sm" onClick={()=>setFilters(f=>({...f,type:"",status:""}))}>Effacer</button>}
          </>
        }
      />
      {modal && (
        <AssetModal
          asset={editing}
          meta={meta}
          onClose={() => { setModal(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
      {reportModal && <ReportModal assets={reportAssets} meta={meta} onClose={() => setReportModal(false)} />}
    </Layout>
  );
}
