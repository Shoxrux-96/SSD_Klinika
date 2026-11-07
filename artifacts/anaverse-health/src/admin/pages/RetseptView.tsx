import { useEffect } from 'react';
import { Printer, X } from 'lucide-react';
import type { Prescription } from '../clinicalData';

type Props = { prescription: Prescription; onClose: () => void };

type Row = { name: string; qty: string; usage: string };

function printRetsept() {
  const src = document.getElementById('retsept-print');
  if (!src) return;
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  const headCss = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((n) => n.outerHTML).join('\n');
  doc.open();
  doc.write(`<!doctype html><html><head>
    <meta charset="utf-8" />
    <title>Retsept — Dorilar</title>
    ${headCss}
    <style>
      /* Har sahifa tepa/pastida 20mm (2 sm) bo'sh joy */
      @page { size: A5 portrait; margin: 20mm 0; }
      html, body { margin: 0; padding: 0; background: #fff; }
      #retsept-print { display: block; width: 148mm; margin: 0; padding: 0; }
      .retsept-page {
        width: 148mm; box-sizing: border-box;
        padding: 0 9mm; margin: 0; background: #fff;
        min-height: 170mm; /* 210 − 2×20 */
      }
    </style>
  </head><body>${src.outerHTML}</body></html>`);
  doc.close();
  const run = () => {
    try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); }
    finally { setTimeout(() => iframe.remove(), 1000); }
  };
  if (doc.readyState === 'complete') setTimeout(run, 200);
  else iframe.onload = () => setTimeout(run, 200);
}

function parseMeds(meds: string): Row[] {
  const items = (meds || '').split(/\s*,\s*/).filter(Boolean);
  return items.slice(0, 10).map((raw) => {
    // Qo'llab-quvvatlanadigan format: "Dori nomi | miqdori | qo'llanilishi"
    // yoki oddiy matn — faqat nomi
    const parts = raw.split('|').map((s) => s.trim());
    return {
      name: parts[0] || '',
      qty: parts[1] || '',
      usage: parts[2] || '',
    };
  });
}

export function RetseptView({ prescription: p, onClose }: Props) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const filled = parseMeds(p.meds);
  const rows: Row[] = Array.from({ length: 10 }, (_, i) =>
    filled[i] || { name: '', qty: '', usage: '' },
  );

  return (
    <div className="appt-modal-backdrop" onClick={onClose}>
      <div className="retsept-modal" onClick={(e) => e.stopPropagation()}>
        <div className="retsept-head">
          <h2>Retsept (DORILAR RETSEPTI)</h2>
          <div className="retsept-head-actions">
            <button className="admin-btn admin-btn-ghost" onClick={() => printRetsept()}>
              <Printer size={14} /> Chop etish
            </button>
            <button className="admin-icon-btn sm" onClick={onClose} aria-label="Yopish"><X size={16} /></button>
          </div>
        </div>

        <div className="retsept-body" id="retsept-print">
          <div className="retsept-page">
            <h1 className="retsept-title">
              <span className="retsept-brand-ssd">SSD</span>{' '}
              <span className="retsept-brand-rest">DIAGNOSTIKA MARKAZI</span>
            </h1>
            <h2 className="retsept-subtitle">DORILAR RETSEPTI</h2>

            <div className="retsept-meta">
              <div><b>Bemor:</b> {p.patient}</div>
              <div><b>Shifokor:</b> {p.doctor}</div>
              <div><b>Sana:</b> {p.date}</div>
            </div>

            <table className="retsept-table">
              <thead>
                <tr>
                  <th className="retsept-col-num">#</th>
                  <th className="retsept-col-name">Dori nomi</th>
                  <th className="retsept-col-qty">Miqdori</th>
                  <th className="retsept-col-usage">Qo&rsquo;llanilishi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="retsept-col-num"><b>{i + 1}</b></td>
                    <td>{r.name || ' '}</td>
                    <td>{r.qty || ' '}</td>
                    <td>{r.usage || ' '}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="retsept-sign">
              <div>Shifokor imzosi: <u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u></div>
              <div>{p.doctor}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
