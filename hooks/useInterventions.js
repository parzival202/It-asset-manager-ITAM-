import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

export function useInterventions(filters = {}) {
  const [interventions, setInterventions] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [mounted, setMounted]             = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async () => {
    if (!mounted) return;
    setLoading(true); setError(null);
    try {
      const q = new URLSearchParams();
      if (filters.site_id)       q.set("site_id",       filters.site_id);
      if (filters.department_id) q.set("department_id", filters.department_id);
      if (filters.from)          q.set("from",          filters.from);
      if (filters.to)            q.set("to",            filters.to);
      setInterventions(await api.interventions.list(q.toString() ? `?${q}` : ""));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [mounted, filters.site_id, filters.department_id, filters.from, filters.to]);

  useEffect(() => { load(); }, [load]);

  const create = async (data) => { const r = await api.interventions.create(data); await load(); return r; };
  const update = async (id, data) => { const r = await api.interventions.update(id, data); await load(); return r; };
  const remove = async (id) => { await api.interventions.delete(id); await load(); };

  return { interventions, loading, error, reload: load, create, update, remove };
}
