import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

function parseJwt(token) {
  try { return JSON.parse(atob(token.split(".")[1])); }
  catch { return null; }
}

function isTokenValid(token) {
  if (!token) return false;
  const payload = parseJwt(token);
  if (!payload) return false;
  return payload.exp * 1000 > Date.now();
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const logout = useCallback(() => {
    localStorage.removeItem("itam_token");
    localStorage.removeItem("itam_user");
    setUser(null);
    router.push("/login");
  }, [router]);

  useEffect(() => {
    const token = localStorage.getItem("itam_token");
    const saved = localStorage.getItem("itam_user");
    if (token && saved && isTokenValid(token)) {
      try { setUser(JSON.parse(saved)); } catch { logout(); }
    } else if (token) {
      localStorage.removeItem("itam_token");
      localStorage.removeItem("itam_user");
    }
    setLoading(false);
  }, []);

  // Vérification toutes les 5 min
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => {
      if (!isTokenValid(localStorage.getItem("itam_token"))) logout();
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [user, logout]);

  useEffect(() => {
    if (!loading && !user && router.pathname !== "/login") router.replace("/login");
  }, [user, loading, router.pathname]);

  const login = (token, userData) => {
    localStorage.setItem("itam_token", token);
    localStorage.setItem("itam_user", JSON.stringify(userData));
    setUser(userData);
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
