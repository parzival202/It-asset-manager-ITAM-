const BASE = "/api";
function token() { if (typeof window==="undefined") return ""; return localStorage.getItem("itam_token")||""; }
async function req(method, path, body) {
  const t = token();
  if (!t && path!=="/auth/login") throw new Error("Non authentifié");
  const opts = { method, headers:{"Content-Type":"application/json",...(t?{"Authorization":`Bearer ${t}`}:{})} };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  if (!r.ok) { const e = await r.json().catch(()=>({error:r.statusText})); throw new Error(e.error||r.statusText); }
  return r.json();
}
export const api = {
  login:     (email,password) => req("POST","/auth/login",{email,password}),
  dashboard: ()               => req("GET", "/dashboard"),
  meta:      ()               => req("GET", "/meta"),
  stats:     ()               => req("GET", "/stats"),
  assets:        { list:(q="")=>req("GET",`/assets${q}`), get:(id)=>req("GET",`/assets/${id}`), create:(d)=>req("POST","/assets",d), update:(id,d)=>req("PUT",`/assets/${id}`,d), delete:(id)=>req("DELETE",`/assets/${id}`) },
  maintenances:  { list:(q="")=>req("GET",`/maintenances${q}`), create:(d)=>req("POST","/maintenances",d), update:(id,d)=>req("PUT",`/maintenances/${id}`,d), delete:(id)=>req("DELETE",`/maintenances/${id}`) },
  alerts:        { list:()=>req("GET","/alerts"), read:(id)=>req("PUT",`/alerts/${id}/read`) },
  users:         { list:()=>req("GET","/users"), create:(d)=>req("POST","/users",d), update:(id,d)=>req("PUT",`/users/${id}`,d), delete:(id)=>req("DELETE",`/users/${id}`) },
  assignments: {
  list:   (q = "") => req("GET",    `/assignments${q}`),
  create: (d)      => req("POST",   "/assignments", d),
  update: (id, d)  => req("PUT",    `/assignments/${id}`, d),
  delete: (id)     => req("DELETE", `/assignments/${id}`),
},
  interventions: { list:(q="")=>req("GET",`/interventions${q}`), create:(d)=>req("POST","/interventions",d), update:(id,d)=>req("PUT",`/interventions/${id}`,d), delete:(id)=>req("DELETE",`/interventions/${id}`) },
  schedule: {
    list:        (year="")  => req("GET",  `/schedule${year?`?year=${year}`:""}`),
    generate:    ()         => req("POST", "/schedule/generate"),
    checkAlerts: ()         => req("POST", "/schedule/check-alerts"),
  },
};
