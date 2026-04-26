import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

export function useAsset(id) {
  const [asset, setAsset]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async () => {
    if (!mounted || !id) return;
    setLoading(true); setError(null);
    try { setAsset(await api.assets.get(id)); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [mounted, id]);

  useEffect(() => { load(); }, [load]);

  return { asset, loading, error, reload: load };
}
