import { useEffect, useMemo, useState } from 'react';

export const PAGE_SIZES = [15, 30, 50] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export function usePagination<T>(rows: T[], deps: unknown[] = []) {
  const [pageSize, setPageSize] = useState<PageSize>(15);
  const [page, setPage] = useState(1);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const start = (pageSafe - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageRows = useMemo(() => rows.slice(start, end), [rows, start, end]);
  // Deps yoki pageSize o'zgarsa — 1-sahifaga qayt.
  useEffect(() => { setPage(1); }, [pageSize, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (page > totalPages) setPage(1); }, [page, totalPages]);
  return {
    pageSize, setPageSize,
    page: pageSafe, setPage,
    total, totalPages, start, end, pageRows,
  };
}

export function TablePagination({
  page, totalPages, total, start, end, pageSize, setPage, setPageSize,
}: {
  page: number;
  totalPages: number;
  total: number;
  start: number;
  end: number;
  pageSize: PageSize;
  setPage: (n: number) => void;
  setPageSize: (n: PageSize) => void;
}) {
  if (total === 0) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, padding: '10px 4px', flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569' }}>
        <span>Qatorlar:</span>
        {PAGE_SIZES.map((n) => (
          <button
            key={n}
            type="button"
            className={`admin-btn ${pageSize === n ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
            style={{ padding: '4px 10px' }}
            onClick={() => setPageSize(n)}
          >{n}</button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569' }}>
        <span>{start + 1}–{end} / {total}</span>
        <button type="button" className="admin-btn admin-btn-ghost" style={{ padding: '4px 10px' }}
          disabled={page <= 1}
          onClick={() => setPage(Math.max(1, page - 1))}>‹</button>
        <span>{page} / {totalPages}</span>
        <button type="button" className="admin-btn admin-btn-ghost" style={{ padding: '4px 10px' }}
          disabled={page >= totalPages}
          onClick={() => setPage(Math.min(totalPages, page + 1))}>›</button>
      </div>
    </div>
  );
}
