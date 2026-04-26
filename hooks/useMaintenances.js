import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

export function useMaintenances(filters = {}) {
  const [maintenances, setMaintenances] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [mounted, setMounted]           = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async () => {
    if (!mounted) return;
    setLoading(true); setError(null);
    try {
      const q = new URLSearchParams();
      if (filters.asset_id) q.set("asset_id", filters.asset_id);
      if (filters.status)   q.set("status",   filters.status);
      if (filters.type)     q.set("type",      filters.type);
      setMaintenances(await api.maintenances.list(q.toString() ? `?${q}` : ""));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [mounted, filters.asset_id, filters.status, filters.type]);

  useEffect(() => { load(); }, [load]);

  const create = async (data) => { const r = await api.maintenances.create(data); await load(); return r; };
  const update = async (id, data) => { const r = await api.maintenances.update(id, data); await load(); return r; };
  const remove = async (id) => { await api.maintenances.delete(id); await load(); };
  const markDone = async (id) => {
    await api.maintenances.update(id, { status: "completed", completed_at: new Date().toISOString() });
    await load();
  };

  return { maintenances, loading, error, reload: load, create, update, remove, markDone };
}
