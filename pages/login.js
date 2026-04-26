import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/router";
import { api } from "../lib/api";

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("admin@local.test");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const data = await api.login(email, password);
      login(data.token, data.user);
      router.push("/");
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div style={{width:40,height:40,background:"var(--accent)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg>
        </div>
        <h1>IT Asset Manager</h1>
        <p>Gestion du parc informatique</p>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Mot de passe</label>
            <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-primary" style={{width:"100%",justifyContent:"center",marginTop:8}} disabled={loading}>
            {loading ? <span className="spinner" style={{width:16,height:16}}/> : "Se connecter"}
          </button>
        </form>
        <p style={{marginTop:20,fontSize:11,color:"var(--text3)",textAlign:"center"}}>
          admin@local.test / admin123 · ange@local.test / tech123
        </p>
      </div>
    </div>
  );
}
