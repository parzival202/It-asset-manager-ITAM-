import { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/router";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("itam_token");
    const saved  = localStorage.getItem("itam_user");
    if (token && saved) { try { setUser(JSON.parse(saved)); } catch {} }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading && !user && router.pathname !== "/login") router.replace("/login");
  }, [user, loading, router.pathname]);

  const login = (token, userData) => {
    localStorage.setItem("itam_token", token);
    localStorage.setItem("itam_user", JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("itam_token");
    localStorage.removeItem("itam_user");
    setUser(null);
    router.push("/login");
  };

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#0f1117"}}>
      <div style={{width:24,height:24,border:"2px solid #2a3147",borderTopColor:"#4f8ef7",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!user && router.pathname !== "/login") return null;

  return <AuthCtx.Provider value={{ user, login, logout }}>{children}</AuthCtx.Provider>;
}
