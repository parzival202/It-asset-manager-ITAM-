import { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import DataTable from "../../components/DataTable";
import { api } from "../../lib/api";
import { useAlerts } from "../../hooks/useAlerts";
import { useMeta } from "../../hooks/useMeta";
import { useAssets } from "../../hooks/useAssets";

const CATS = { toner: "Toner / cartouche", drum: "Tambour", ribbon: "Ruban", ssd: "Disque SSD", power_supply: "Boîtier d’alimentation" };
const CARTRIDGE_TYPES = { monochrome: "Monochrome", color: "Couleur" };
const COLOR_KEYS = ["black", "cyan", "magenta", "yellow"];
const COLORS = { black: "Noir", cyan: "Cyan", magenta: "Magenta", yellow: "Jaune" };

function parseStock(value) {
  try { return typeof value === "string" ? JSON.parse(value || "{}") : value || {}; } catch { return {}; }
}

function StockColors({ row }) {
  if (row.category !== "toner") return null;
  if (row.cartridge_type === "monochrome") return <span style={{ color: "var(--text2)" }}><i style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: "#20242b", marginRight: 5 }} />Noir : {row.stock_qty || 0}</span>;
  const stock = parseStock(row.color_stock);
  const available = COLOR_KEYS.filter(key => Number(stock[key]) > 0);
  const swatches = { black: "#20242b", cyan: "#19b9d1", magenta: "#d946a0", yellow: "#eab308" };
  return available.length ? <span style={{ color: "var(--text2)", display: "inline-flex", gap: 9, flexWrap: "wrap" }}>{available.map(key => <span key={key} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><i style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: swatches[key], border: key === "yellow" ? "1px solid #a16207" : "none" }} />{COLORS[key]} : {stock[key]}</span>)}</span> : <span style={{ color: "var(--danger)" }}>Aucune couleur disponible</span>;
}

function Bar({ rows }) {
  const max = Math.max(...rows.map(row => Number(row.quantity) || 0), 1);
  return rows.length ? rows.map((row, index) => <div key={index} style={{ display: "flex", gap: 8, alignItems: "center", margin: "9px 0" }}><span style={{ width: 125, fontSize: 12 }}>{row.name}</span><div style={{ height: 15, background: "var(--bg3)", flex: 1 }}><div style={{ height: "100%", width: `${Number(row.quantity) / max * 100}%`, background: "var(--accent)" }} /></div><b>{row.quantity}</b></div>) : <div className="text-faint">Aucune sortie enregistrée</div>;
}

function MovementHistory({ rows }) {
  return <div className="card mb-20">
    <div className="section-title">Historique des mouvements</div>
    {!rows.length ? <div className="empty-state"><p>Aucun mouvement enregistré</p></div> : <div style={{ overflowX: "auto" }}><table className="data-table"><thead><tr><th>Date</th><th>Type</th><th>Consommable</th><th>Quantité</th><th>Consommateur</th><th>Équipement</th><th>Service</th><th>Détail</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.date}-${row.reference}-${index}`}><td>{new Date(row.date).toLocaleDateString("fr-FR")}</td><td><span className={`badge ${row.movement_type === "in" ? "badge-success" : "badge-warning"}`}>{row.movement_type === "in" ? "Entrée" : "Sortie"}</span></td><td><b>{row.name}</b><div className="text-faint text-xs">{row.reference}</div></td><td>{row.movement_type === "out" ? "−" : "+"}{row.quantity}</td><td>{row.consumer_name || "—"}</td><td>{row.asset_name || "—"}</td><td>{row.department_name || "—"}</td><td>{row.note || "—"}</td></tr>)}</tbody></table></div>}
  </div>;
}

function Modal({ item, onClose, onSave }) {
  const [form, setForm] = useState({ ...item, category: item?.category || "toner", cartridge_type: item?.cartridge_type || "monochrome", minimum_qty: item?.minimum_qty || 0, initial_qty: item?.initial_qty ?? item?.stock_qty ?? 0, color_stock: parseStock(item?.color_stock) });
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const setColor = (key, value) => setForm(current => ({ ...current, color_stock: { ...(current.color_stock || {}), [key]: value } }));
  const isCartridge = form.category === "toner";
  return <div className="modal-overlay" onClick={event => event.target === event.currentTarget && onClose()}><div className="modal" style={{ maxWidth: 600 }}><div className="modal-header"><h3>{item ? "Modifier le consommable" : "Nouveau consommable"}</h3><button onClick={onClose}>×</button></div><form onSubmit={async event => { event.preventDefault(); await onSave(form); onClose(); }}><div className="modal-body"><div className="form-grid"><div className="form-group"><label className="form-label">Référence *</label><input required className="form-input" value={form.reference || ""} onChange={event => set("reference", event.target.value)} /></div><div className="form-group"><label className="form-label">Désignation *</label><input required className="form-input" value={form.name || ""} onChange={event => set("name", event.target.value)} /></div></div><div className="form-grid"><div className="form-group"><label className="form-label">Catégorie</label><select className="form-input form-select" value={form.category} onChange={event => set("category", event.target.value)}>{Object.entries(CATS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>{isCartridge && <div className="form-group"><label className="form-label">Type de cartouche</label><select className="form-input form-select" value={form.cartridge_type} onChange={event => set("cartridge_type", event.target.value)}>{Object.entries(CARTRIDGE_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>}</div>{isCartridge && form.cartridge_type === "color" ? <div className="form-group"><label className="form-label">Stock par couleur</label><div className="form-grid">{COLOR_KEYS.map(key => <div className="form-group" key={key}><label className="form-label">{COLORS[key]}</label><input type="number" min="0" className="form-input" value={form.color_stock?.[key] || ""} onChange={event => setColor(key, event.target.value)} /></div>)}</div></div> : <div className="form-group"><label className="form-label">Quantité disponible</label><input type="number" min="0" className="form-input" value={form.initial_qty ?? ""} onChange={event => set("initial_qty", event.target.value)} /></div>}<div className="form-grid"><div className="form-group"><label className="form-label">Imprimantes compatibles</label><input className="form-input" value={form.compatible_printer || ""} onChange={event => set("compatible_printer", event.target.value)} /></div><div className="form-group"><label className="form-label">Seuil d’alerte</label><input type="number" min="0" className="form-input" value={form.minimum_qty || 0} onChange={event => set("minimum_qty", event.target.value)} /></div></div><div className="form-group"><label className="form-label">Fournisseur</label><input className="form-input" value={form.supplier || ""} onChange={event => set("supplier", event.target.value)} /></div></div><div className="modal-footer"><button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button><button className="btn btn-primary">Enregistrer</button></div></form></div></div>;
}

export default function Consumables() {
  const { alertCount } = useAlerts();
  const meta = useMeta();
  const { assets } = useAssets({});
  const [tab, setTab] = useState("stock");
  const [items, setItems] = useState([]);
  const [report, setReport] = useState({ byService: [], topItems: [], recent: [] });
  const [modal, setModal] = useState(null);
  const [entry, setEntry] = useState(null);
  const load = () => { api.consumables.list().then(setItems); api.consumables.report().then(setReport); };
  useEffect(load, []);
  const remove = async item => { if (!window.confirm(`Supprimer le consommable « ${item.name} » ?`)) return; try { await api.consumables.delete(item.id); load(); } catch (error) { window.alert(error.message); } };
  const columns = [{ label: "Référence", accessor: "reference", render: row => <span className="mono">{row.reference}</span> }, { label: "Consommable", accessor: "name", render: row => <div><b>{row.name}</b><div className="text-faint text-xs">{CATS[row.category]} {row.cartridge_type && `· ${CARTRIDGE_TYPES[row.cartridge_type] || row.cartridge_type}`}</div><div className="text-faint text-xs"><StockColors row={row} /></div></div> }, { label: "Stock", accessor: "stock_qty", render: row => <span className={`badge ${Number(row.stock_qty) <= Number(row.minimum_qty) ? "badge-danger" : "badge-success"}`}>{row.stock_qty}</span> }, { label: "Seuil", accessor: "minimum_qty" }, { label: "Compatibilité", accessor: "compatible_printer", render: row => row.compatible_printer || "—" }, { label: "", key: "actions", render: row => <div style={{ display: "flex", gap: 6 }}><button className="btn btn-ghost btn-sm" onClick={() => setEntry(row)}>Entrée</button><button className="btn btn-ghost btn-sm" onClick={() => setModal(row)}>Modifier</button><button className="btn btn-ghost btn-sm" onClick={() => remove(row)}>Supprimer</button></div> }];
  return <Layout title="Consommables" alertCount={alertCount} actions={<button className="btn btn-primary" onClick={() => setModal({})}>+ Ajouter</button>}>
    <div style={{display:"flex",gap:6,marginBottom:20}}>
      {[['stock','Stock'],['history','Historique']].map(([key,label]) => <button key={key} type="button" onClick={() => setTab(key)} className={`btn ${tab===key ? "btn-primary" : "btn-ghost"}`} style={{fontSize:13}}>{label}</button>)}
    </div>
    {tab === "stock" && <>
      <div className="stats-grid mb-20">
        <div className="stat-card"><div className="stat-label">Références</div><div className="stat-value">{items.length}</div></div>
        <div className="stat-card"><div className="stat-label">Alertes stock</div><div className="stat-value">{items.filter(item => Number(item.stock_qty) <= Number(item.minimum_qty)).length}</div></div>
        <div className="stat-card"><div className="stat-label">Mouvements suivis</div><div className="stat-value">{report.recent.length}</div></div>
      </div>
      <DataTable columns={columns} data={items} searchable searchPlaceholder="Référence, nom, compatibilité..." emptyMessage="Aucun consommable enregistré" />
    </>}
    {tab === "history" && <>
      <div className="grid2 mb-20"><div className="card"><div className="section-title">Services les plus consommateurs</div><Bar rows={report.byService} /></div><div className="card"><div className="section-title">Consommables les plus sollicités</div><Bar rows={report.topItems} /></div></div>
      <MovementHistory rows={report.recent} />
    </>}
    {modal !== null && <Modal item={modal.id ? modal : null} onClose={() => setModal(null)} onSave={async form => { modal.id ? await api.consumables.update(modal.id, form) : await api.consumables.create(form); load(); }} />}
    {entry && <div className="modal-overlay"><div className="modal" style={{ maxWidth: 420 }}><div className="modal-header"><h3>Entrée en stock — {entry.name}</h3></div><form onSubmit={async event => { event.preventDefault(); const data = new FormData(event.currentTarget); await api.consumables.entry(entry.id, { quantity: data.get("quantity"), note: data.get("note"), asset_id: data.get("asset_id"), department_id: data.get("department_id") }); setEntry(null); load(); }}><div className="modal-body"><div className="form-group"><label className="form-label">Quantité reçue *</label><input className="form-input" required name="quantity" type="number" min="1" /></div><div className="form-group"><label className="form-label">Équipement concerné</label><select className="form-input form-select" name="asset_id"><option value="">— Aucun —</option>{assets.map(asset => <option key={asset.id} value={asset.id}>{asset.name} ({asset.asset_tag})</option>)}</select></div><div className="form-group"><label className="form-label">Service concerné</label><select className="form-input form-select" name="department_id"><option value="">— Aucun —</option>{meta.departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}</select></div><div className="form-group"><label className="form-label">Note</label><input className="form-input" name="note" /></div></div><div className="modal-footer"><button type="button" className="btn btn-ghost" onClick={() => setEntry(null)}>Annuler</button><button className="btn btn-primary">Ajouter au stock</button></div></form></div></div>}
  </Layout>;
}