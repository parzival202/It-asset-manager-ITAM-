import { useState } from "react";
import Layout from "../../components/Layout";
import DataTable from "../../components/DataTable";
import { useUsers } from "../../hooks/useUsers";
import { useAlerts } from "../../hooks/useAlerts";
import { useAuth } from "../../context/AuthContext";

const ROLE_LABELS = { admin: "Administrateur", technician: "Technicien" };
const ROLE_COLORS = { admin: "badge-danger", technician: "badge-info" };

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function initials(name) {
  return (name || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function UserModal({ user, onClose, onSave, currentUserId }) {
  const isEdit = !!user;
  const [form, setForm] = useState(
    user
      ? { full_name: user.full_name, email: user.email, role: user.role, is_active: user.is_active, password: "" }
      : { full_name: "", email: "", role: "technician", password: "" }
  );
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState({});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function validate() {
    const e = {};
    if (!form.full_name.trim()) e.full_name = "Nom requis";
    if (!form.email.trim()) e.email = "Email requis";
    if (!isEdit && !form.password) e.password = "Mot de passe requis";
    if (form.password && form.password.length < 6) e.password = "6 caractères minimum";
    return e;
  }

  async function submit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      await onSave(payload);
      onClose();
    } catch (err) { setErrors({ global: err.message }); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h3>{isEdit ? "Modifier l'utilisateur" : "Ajouter un utilisateur"}</h3>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"var(--text2)",cursor:"pointer",fontSize:20 }}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {errors.global && <div className="error-msg">{errors.global}</div>}

            <div className="form-group">
              <label className="form-label">Nom complet *</label>
              <input className="form-input" value={form.full_name} onChange={e => set("full_name", e.target.value)} placeholder="Moussa Bamba"/>
              {errors.full_name && <div style={{ fontSize:11, color:"var(--danger)", marginTop:4 }}>{errors.full_name}</div>}
            </div>

            <div className="form-group">
              <label className="form-label">Email *</label>
              <input className="form-input" type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="moussa@local.test"/>
              {errors.email && <div style={{ fontSize:11, color:"var(--danger)", marginTop:4 }}>{errors.email}</div>}
            </div>

            <div className="form-group">
              <label className="form-label">Rôle</label>
              <select className="form-input form-select" value={form.role} onChange={e => set("role", e.target.value)}>
                <option value="technician">Technicien</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{isEdit ? "Nouveau mot de passe" : "Mot de passe *"} {isEdit && <span style={{ fontSize:11, color:"var(--text3)" }}>(laisser vide pour ne pas changer)</span>}</label>
              <input className="form-input" type="password" value={form.password} onChange={e => set("password", e.target.value)} placeholder={isEdit ? "••••••••" : "Min. 6 caractères"}/>
              {errors.password && <div style={{ fontSize:11, color:"var(--danger)", marginTop:4 }}>{errors.password}</div>}
            </div>

            {isEdit && user.id !== currentUserId && (
              <div className="form-group">
                <label className="form-label">Statut du compte</label>
                <select className="form-input form-select" value={form.is_active} onChange={e => set("is_active", Number(e.target.value))}>
                  <option value={1}>Actif</option>
                  <option value={0}>Désactivé</option>
                </select>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Enregistrement..." : isEdit ? "Modifier" : "Ajouter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Users() {
  const { user: currentUser } = useAuth();
  const { users, loading, create, update, deactivate } = useUsers();
  const { alertCount } = useAlerts();
  const [modal, setModal]   = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);

  if (currentUser?.role !== "admin") {
    return (
      <Layout title="Utilisateurs" alertCount={alertCount}>
        <div className="card">
          <div className="empty-state">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color:"var(--danger)" }}>
              <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
            </svg>
            <p>Cette page est réservée aux administrateurs.</p>
          </div>
        </div>
      </Layout>
    );
  }

  const COLUMNS = [
    {
      label: "Utilisateur", accessor: "full_name", sortable: true,
      render: r => (
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{
            width:32, height:32, borderRadius:"50%", flexShrink:0,
            background: r.role === "admin" ? "rgba(248,113,113,0.15)" : "rgba(96,165,250,0.15)",
            color: r.role === "admin" ? "var(--danger)" : "var(--info)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:11, fontWeight:600,
          }}>
            {initials(r.full_name)}
          </div>
          <div>
            <div style={{ fontWeight:500 }}>{r.full_name}</div>
            <div style={{ fontSize:11, color:"var(--text3)" }}>{r.email}</div>
          </div>
        </div>
      )
    },
    {
      label: "Rôle", accessor: "role", sortable: true,
      render: r => <span className={`badge ${ROLE_COLORS[r.role] || "badge-neutral"}`}>{ROLE_LABELS[r.role] || r.role}</span>
    },
    {
      label: "Statut", accessor: "is_active", sortable: true,
      render: r => r.is_active
        ? <span className="badge badge-success">Actif</span>
        : <span className="badge badge-neutral">Désactivé</span>
    },
    {
      label: "Créé le", accessor: "created_at", sortable: true,
      render: r => <span style={{ fontSize:12, color:"var(--text2)" }}>{fmtDate(r.created_at)}</span>
    },
    {
      label: "", key: "actions",
      render: r => (
        <div style={{ display:"flex", gap:6 }}>
          <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setEditing(r); setModal(true); }}>
            Modifier
          </button>
          {r.id !== currentUser.id && r.is_active === 1 && (
            <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); setConfirm(r); }}>
              Désactiver
            </button>
          )}
        </div>
      )
    },
  ];

  const active   = users.filter(u => u.is_active === 1);
  const inactive = users.filter(u => u.is_active === 0);

  return (
    <Layout title="Utilisateurs" alertCount={alertCount} actions={
      <button className="btn btn-primary" onClick={() => { setEditing(null); setModal(true); }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
        Ajouter
      </button>
    }>
      {/* Stats rapides */}
      <div className="stats-grid" style={{ marginBottom:24 }}>
        <div className="stat-card">
          <div className="stat-label">Total</div>
          <div className="stat-value">{users.length}</div>
          <div className="stat-sub">utilisateurs</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Actifs</div>
          <div className="stat-value" style={{ color:"var(--success)" }}>{active.length}</div>
          <div className="stat-sub">comptes actifs</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Admins</div>
          <div className="stat-value">{users.filter(u => u.role === "admin").length}</div>
          <div className="stat-sub">administrateurs</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Techniciens</div>
          <div className="stat-value">{users.filter(u => u.role === "technician").length}</div>
          <div className="stat-sub">techniciens</div>
        </div>
      </div>

      {/* Table principale */}
      <DataTable
        columns={COLUMNS}
        data={active}
        loading={loading}
        emptyMessage="Aucun utilisateur actif"
        searchable
        searchPlaceholder="Nom, email..."
        pageSize={20}
      />

      {/* Comptes désactivés */}
      {inactive.length > 0 && (
        <div style={{ marginTop:24 }}>
          <div className="section-title" style={{ marginBottom:12 }}>Comptes désactivés ({inactive.length})</div>
          <div className="card" style={{ padding:0 }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <tbody>
                {inactive.map(u => (
                  <tr key={u.id}>
                    <td style={{ padding:"10px 14px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, opacity:0.5 }}>
                        <div style={{ width:28, height:28, borderRadius:"50%", background:"var(--bg3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:600, color:"var(--text3)" }}>
                          {initials(u.full_name)}
                        </div>
                        <div>
                          <div style={{ fontSize:13 }}>{u.full_name}</div>
                          <div style={{ fontSize:11, color:"var(--text3)" }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding:"10px 14px" }}>
                      <span className={`badge ${ROLE_COLORS[u.role] || "badge-neutral"}`} style={{ opacity:0.5 }}>{ROLE_LABELS[u.role]}</span>
                    </td>
                    <td style={{ padding:"10px 14px", textAlign:"right" }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => update(u.id, { full_name:u.full_name, email:u.email, role:u.role, is_active:1 })}>
                        Réactiver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal ajout/modif */}
      {modal && (
        <UserModal
          user={editing}
          currentUserId={currentUser.id}
          onClose={() => { setModal(false); setEditing(null); }}
          onSave={editing ? (data) => update(editing.id, data) : create}
        />
      )}

      {/* Confirmation désactivation */}
      {confirm && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal" style={{ maxWidth:400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Désactiver ce compte ?</h3>
              <button onClick={() => setConfirm(null)} style={{ background:"none",border:"none",color:"var(--text2)",cursor:"pointer",fontSize:20 }}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize:13, color:"var(--text2)", lineHeight:1.6 }}>
                Le compte de <strong style={{ color:"var(--text)" }}>{confirm.full_name}</strong> sera désactivé. Il ne pourra plus se connecter mais son historique d'interventions sera conservé.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirm(null)}>Annuler</button>
              <button className="btn btn-danger" onClick={() => { deactivate(confirm.id); setConfirm(null); }}>Désactiver</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
