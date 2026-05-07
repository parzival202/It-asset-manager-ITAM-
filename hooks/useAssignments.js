import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

export function useAssignments(assetId = null) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [mounted, setMounted]         = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async () => {
    if (!mounted) return;
    setLoading(true); setError(null);
    try {
      const q = assetId ? `?asset_id=${assetId}` : "";
      setAssignments(await api.assignments.list(q));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [mounted, assetId]);

  useEffect(() => { load(); }, [load]);

  const create = async (data) => { const r = await api.assignments.create(data); await load(); return r; };
  const update = async (id, data) => { const r = await api.assignments.update(id, data); await load(); return r; };
  const remove = async (id) => { await api.assignments.delete(id); await load(); };

  const current = assignments.find(a => !a.ended_at) || null;
  const history = assignments.filter(a => !!a.ended_at);

  return { assignments, current, history, loading, error, reload: load, create, update, remove };
}
