import { useState, useEffect } from "react";
import { api } from "../lib/api";

export function useMeta() {
  const [meta, setMeta]       = useState({ sites: [], departments: [], users: [] });
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    api.meta()
      .then(setMeta)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [mounted]);

  const deptsBySite = (siteId) =>
    meta.departments.filter(d => !siteId || String(d.site_id) === String(siteId));

  return { ...meta, loading, deptsBySite };
}
