import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../lib/api";

export function useAlerts({ pollInterval = 30000 } = {}) {
  const [alerts, setAlerts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [mounted, setMounted] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async (silent = false) => {
    if (!mounted) return;
    if (!silent) setLoading(true);
    setError(null);
    try { setAlerts(await api.alerts.list()); }
    catch (err) { setError(err.message); }
    finally { if (!silent) setLoading(false); }
  }, [mounted]);

  useEffect(() => {
    load();
    if (pollInterval > 0) {
      timerRef.current = setInterval(() => load(true), pollInterval);
    }
    return () => clearInterval(timerRef.current);
  }, [load, pollInterval]);

  const markRead = async (id) => {
    await api.alerts.read(id);
    setAlerts(a => a.filter(x => x.id !== id));
  };

  const markAllRead = async () => {
    await Promise.all(alerts.map(a => api.alerts.read(a.id)));
    setAlerts([]);
  };

  return {
    alerts,
    alertCount: alerts.length,
    loading,
    error,
    reload: load,
    markRead,
    markAllRead,
  };
}
