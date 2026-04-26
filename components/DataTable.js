import { useState, useMemo } from "react";

export default function DataTable({
  columns,
  data = [],
  loading = false,
  emptyMessage = "Aucun résultat",
  onRowClick,
  pageSize = 20,
  searchable = false,
  searchPlaceholder = "Rechercher...",
  actions,
  filters,
}) {
  const [sortKey, setSortKey]       = useState(null);
  const [sortDir, setSortDir]       = useState("asc");
  const [page, setPage]             = useState(1);
  const [internalSearch, setSearch] = useState("");

  const search = searchable ? internalSearch : null;

  const sorted = useMemo(() => {
    let rows = [...data];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(row =>
        columns.some(col => {
          const v = col.accessor ? row[col.accessor] : null;
          return v && String(v).toLowerCase().includes(q);
        })
      );
    }
    if (sortKey) {
      rows.sort((a, b) => {
        const va = a[sortKey] ?? "";
        const vb = b[sortKey] ?? "";
        const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return rows;
  }, [data, sortKey, sortDir, search, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageData   = sorted.slice((page - 1) * pageSize, page * pageSize);

  function toggleSort(key) {
    if (!key) return;
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  }

  function SortIcon({ col }) {
    if (!col.sortable) return null;
    const active = sortKey === col.accessor;
    return (
      <span style={{ marginLeft: 4, opacity: active ? 1 : 0.3, fontSize: 10 }}>
        {active && sortDir === "desc" ? "▼" : "▲"}
      </span>
    );
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div>
      {(searchable || filters || actions) && (
        <div className="filters">
          {searchable && (
            <div className="search-input">
              <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                className="form-input"
                placeholder={searchPlaceholder}
                value={internalSearch}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                style={{ paddingLeft: 34, width: 240 }}
              />
            </div>
          )}
          {filters}
          <div style={{ marginLeft: "auto" }}>{actions}</div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--text3)" }}>
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <p>{emptyMessage}</p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {columns.map(col => (
                    <th
                      key={col.key || col.accessor}
                      onClick={() => col.sortable && toggleSort(col.accessor)}
                      style={{ cursor: col.sortable ? "pointer" : "default", userSelect: "none", whiteSpace: "nowrap" }}
                    >
                      {col.label}<SortIcon col={col} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageData.map((row, i) => (
                  <tr
                    key={row.id ?? i}
                    onClick={() => onRowClick?.(row)}
                    style={{ cursor: onRowClick ? "pointer" : "default" }}
                  >
                    {columns.map(col => (
                      <td key={col.key || col.accessor}>
                        {col.render ? col.render(row) : (row[col.accessor] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
              <span style={{ fontSize: 12, color: "var(--text3)" }}>
                {sorted.length} résultat{sorted.length > 1 ? "s" : ""} · page {page}/{totalPages}
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>←</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = totalPages <= 5 ? i + 1 : Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                  return (
                    <button key={p} className={`btn btn-sm ${page === p ? "btn-primary" : "btn-ghost"}`} onClick={() => setPage(p)}>{p}</button>
                  );
                })}
                <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>→</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
