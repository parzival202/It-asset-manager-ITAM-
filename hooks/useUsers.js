import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

export function useUsers() {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async () => {
    if (!mounted) return;
    setLoading(true); setError(null);
    try { setUsers(await api.users.list()); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [mounted]);

  useEffect(() => { load(); }, [load]);

  const create = async (data) => { const r = await api.users.create(data); await load(); return r; };
  const update = async (id, data) => { const r = await api.users.update(id, data); await load(); return r; };
  const deactivate = async (id) => { await api.users.delete(id); await load(); };

  return { users, loading, error, reload: load, create, update, deactivate };
}
