import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

export function useAssets(filters = {}) {
  const [assets, setAssets]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async () => {
    if (!mounted) return;
    setLoading(true); setError(null);
    try {
      const q = new URLSearchParams();
      if (filters.search)  q.set("search",  filters.search);
      if (filters.type)    q.set("type",     filters.type);
      if (filters.status)  q.set("status",   filters.status);
      if (filters.site_id) q.set("site_id",  filters.site_id);
      setAssets(await api.assets.list(q.toString() ? `?${q}` : ""));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [mounted, filters.search, filters.type, filters.status, filters.site_id]);

  useEffect(() => { load(); }, [load]);

  const create = async (data) => { await api.assets.create(data); await load(); };
  const update = async (id, data) => { await api.assets.update(id, data); await load(); };
  const remove = async (id) => { await api.assets.delete(id); await load(); };

  return { assets, loading, error, reload: load, create, update, remove };
}
