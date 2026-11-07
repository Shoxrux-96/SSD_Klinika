import { useEffect } from 'react';
import { Printer, X } from 'lucide-react';
import type { Treatment } from '../clinicalData';
import { usePatients } from '../store';

function formatSom(n?: number): string {
  if (!n) return '—';
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " soʻm";
}

// Bo'sh chiziqli joy belgisi
const UND = (n = 40) => ' '.repeat(Math.max(6, Math.round(n / 2)));

// Chop etish uchun maxsus iframe — barcha 4 sahifani to'liq chiqaradi
function printF003() {
  const src = document.getElementById('f003-print');
  if (!src) return;
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><html lang="uz"><head>
    <meta charset="utf-8" />
    <title>003 — Бемор тиббий баённомаси</title>
    <style>
      @page { size: A4 portrait; margin: 14mm 12mm; }
      *, *::before, *::after { box-sizing: border-box; }
      html, body {
        margin: 0; padding: 0; background: #fff; color: #000;
        font-family: 'Times New Roman', 'Liberation Serif', serif;
        font-size: 11.5pt; line-height: 1.32;
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
      }
      #f003-print { display: block; width: 100%; margin: 0; padding: 0; }
      .f003-page {
        width: 100%;
        padding: 0;
        margin: 0 0 6px 0;
        background: #fff;
        page-break-after: auto;
        break-after: auto;
        page-break-inside: auto;
      }
      .f003-page:last-child { margin-bottom: 0; }
      .f003-page + .f003-page::before { content: none !important; display: none !important; }
      .f003-page + .f003-page { border-top: 0 !important; margin-top: 0 !important; padding-top: 0 !important; }

      .f003-top { font-size: 10pt; margin-bottom: 4px; }
      .f003-head-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 6px; }
      .f003-head-cell { text-align: center; font-size: 11pt; line-height: 1.3; }
      .f003-caption { font-size: 9.5pt; color: #000; font-style: italic; }
      .f003-line-fill { border-bottom: 1px solid #000; padding: 1px 0; margin: 3px 12px; font-weight: 600; }
      .f003-title { text-align: center; font-size: 13pt; margin: 6px 0; font-weight: 700; text-transform: uppercase; }
      .f003-row, .f003-item { margin: 2px 0; }
      .f003-indent { margin-left: 18px; }

      u { text-decoration: none; border-bottom: 1px solid #000; padding: 0 3px; display: inline-block; min-width: 50px; line-height: 1.25; vertical-align: baseline; }
      .f003-grow { display: inline-block; min-width: 220px; }

      .f003-table { width: 100%; border-collapse: collapse; margin: 4px 0 6px; }
      .f003-table th, .f003-table td { border: 1px solid #000; padding: 3px 5px; font-size: 10.5pt; vertical-align: top; text-align: left; }
      .f003-table th { font-weight: 700; background: #f3f4f6; text-align: center; }
      .f003-table-med th, .f003-table-med td { font-size: 9pt; padding: 2px 2px; text-align: center; vertical-align: middle; }
      .f003-table-med tbody td { height: 18px; }

      .f003-lined { border-top: 1px solid #000; margin: 4px 0; }
      .f003-lined > div { border-bottom: 1px solid #000; min-height: 18px; padding: 1px 3px; }

      .f003-sign { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 14px 0 4px; }
      .f003-sign u { min-width: 160px; }
      .f003-check { font-size: 12pt; margin: 0 2px; }
      .f003-footer { display: none !important; }

      /* Bo'linmasligi kerak bo'lgan qismlar */
      .f003-table, .f003-table-med { page-break-inside: avoid; break-inside: avoid; }
      .f003-table tr { page-break-inside: avoid; break-inside: avoid; }
      .f003-sign { page-break-inside: avoid; break-inside: avoid; }
      h3.f003-title { page-break-after: avoid; break-after: avoid; }
    </style>
  </head><body>${src.outerHTML}</body></html>`);
  doc.close();
  const run = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => iframe.remove(), 1500);
    }
  };
  // Shrift va stillar yuklanishini kutamiz
  if (doc.readyState === 'complete') setTimeout(run, 350);
  else iframe.onload = () => setTimeout(run, 350);
}

type Props = { treatment: Treatment; onClose: () => void };

const BLANK = 5; // bo'sh qator soni — minimal, ochiq maydon qoldirmaslik uchun
const MED_ROWS = 6;
const MED_DATE_COLS = 10;

export function Form003View({ treatment: t, onClose }: Props) {
  const patients = usePatients();
  const patient = patients.find((p) => p.fullName === t.patient);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const [yy, mm, dd] = t.date.split('-');
  const bYY = patient?.birthDate?.slice(0, 4) ?? '';
  const bMM = patient?.birthDate?.slice(5, 7) ?? '';
  const bDD = patient?.birthDate?.slice(8, 10) ?? '';
  const gender = patient?.gender === 'erkak' ? 'эркак' : patient?.gender === 'ayol' ? 'аёл' : UND(8);
  const addr = [patient?.region, patient?.district, patient?.address].filter(Boolean).join(', ');

  const Lines = ({ n = BLANK }: { n?: number }) => (
    <div className="f003-lined">
      {Array.from({ length: n }).map((_, i) => <div key={i}>&nbsp;</div>)}
    </div>
  );

  // chiziqning tanlangan variantini osti chizilgan qilib ko'rsatish
  const pick = (chosen: boolean) =>
    chosen ? <b style={{ borderBottom: '1px solid #000' }}>&nbsp;</b> : null;

  return (
    <div className="appt-modal-backdrop" onClick={onClose}>
      <div className="f003-modal" onClick={(e) => e.stopPropagation()}>
        <div className="f003-head">
          <h2>003 — Бемор тиббий баённомаси</h2>
          <div className="f003-head-actions">
            <button className="admin-btn admin-btn-ghost" onClick={() => printF003()}>
              <Printer size={14} /> Chop etish
            </button>
            <button className="admin-icon-btn sm" onClick={onClose} aria-label="Yopish"><X size={16} /></button>
          </div>
        </div>

        <div className="f003-body" id="f003-print">

          {/* ============ SAHIFA 1: Bosh qism va 1-10 bandlar ============ */}
          <div className="f003-page">
            <div className="f003-top">Формат А–4</div>
            <div className="f003-head-grid">
              <div className="f003-head-cell">
                <div><b>Ўзбекистон Республикаси</b></div>
                <div><b>Соғлиқни сақлаш вазирлиги</b></div>
                <div className="f003-line-fill">Sirius Stoma Dent diagnostika markazi</div>
                <div className="f003-caption">Муассаса номи</div>
              </div>
              <div className="f003-head-cell">
                <div><b>Ўзбекистон Республикаси</b></div>
                <div><b>Соғлиқни сақлаш вазирининг</b></div>
                <div><b>2017 йил 25 декабрдаги № 777-сонли</b></div>
                <div><b>буйруғи билан тасдиқланган</b></div>
                <div><b>003- рақамли тиббий ҳужжат шакли</b></div>
              </div>
            </div>

            <h3 className="f003-title">БЕМОРНИНГ ТИББИЙ БАЁННОМАСИ № <u>{t.id}</u></h3>

            <div className="f003-row">Касалхонага ётқизилган кун <u>{t.date}</u> &nbsp; вақти <u>{t.admissionTime || UND(10)}</u></div>
            <div className="f003-row">Касалхонадан чиқарилган кун <u>{t.dischargeDate || (t.status === 'yakunlandi' ? t.date : UND(14))}</u> &nbsp; вақти <u>{t.dischargeTime || UND(10)}</u></div>
            <div className="f003-row"><u>{t.department || 'Стоматология'}</u> бўлими, хона № <u>{t.roomNo || UND(6)}</u></div>
            <div className="f003-row">Бўлимга <u className="f003-grow">{t.doctor}</u> ўтказилган</div>
            <div className="f003-row"><u>{t.stayDays || UND(4)}</u> кун ётиб даволанган</div>
            <div className="f003-row">Беморни олиб юриш турлари: аравачада, замбилда, <b style={{ borderBottom: '1px solid #000' }}>ўзи юра олади</b> (чизинг)</div>
            <div className="f003-row">Қон гуруҳи <u>{t.bloodGroup || UND(10)}</u> &nbsp; резус мансублиги <u>{t.rh || UND(10)}</u></div>
            <div className="f003-row">Дориларнинг ножўя таъсири <u className="f003-grow">{t.drugAllergy || UND(50)}</u></div>
            <div className="f003-row" style={{ textAlign: 'center' }}><span className="f003-caption">(дорининг номи, ножўя таъсирнинг кўриниши)</span></div>

            <div className="f003-item"><b>1.</b> Фамилияси, исми, отасининг исми <u className="f003-grow">{t.patient}</u></div>
            <div className="f003-item"><b>2.</b> Жинси <u>{gender}</u></div>
            <div className="f003-item"><b>3.</b> Туғилган сана: кун <u>{bDD || UND(4)}</u> ой <u>{bMM || UND(6)}</u> йил <u>{bYY || UND(6)}</u></div>
            <div className="f003-item"><b>4.</b> Бўйи <u>{t.height || UND(6)}</u>, вазни <u>{t.weight || UND(6)}</u>, тана ҳарорати <u>{t.temperature || UND(6)}</u></div>
            <div className="f003-item"><b>5.</b> Доимий яшаш жойи: <b style={{ borderBottom: '1px solid #000' }}>шаҳар</b>, қишлоқ (чизинг)</div>
            <div className="f003-item f003-indent"><u className="f003-grow">{addr || UND(60)}</u></div>
            <div className="f003-item f003-indent" style={{ textAlign: 'center' }}>
              <span className="f003-caption">(яшаш жойи кўрсатилсин, вилоят ва туманлардан келганлар учун манзили ва яқин қариндошларининг яшаш жойи ва телефон рақамлари кўрсатилсин)</span>
            </div>
            <div className="f003-item"><b>6.</b> Иш жойи, касби, лавозими <u className="f003-grow">{t.workplace || UND(60)}</u></div>
            <div className="f003-item f003-indent" style={{ textAlign: 'center' }}>
              <span className="f003-caption">(ўқувчилар учун — ўқиш жойи; болалар учун — болалар муассасасининг номи; ногиронлар учун — ногиронликнинг тури ва гуруҳи; уруш ногирони — ҳа, йўқ)</span>
            </div>
            <div className="f003-item"><b>7.</b> Бемор қаердан юборилган <u className="f003-grow">Sirius Stoma Dent qabulxonasi</u></div>
            <div className="f003-item f003-indent" style={{ textAlign: 'center' }}>
              <span className="f003-caption">(даволаш муассасасининг номи)</span>
            </div>
            <div className="f003-item"><b>8.</b> Касалхонага шошилинч равишда келтирилган: ҳа, <b style={{ borderBottom: '1px solid #000' }}>йўқ</b> <u>{UND(20)}</u></div>
            <div className="f003-item">Қандай транспортда <u className="f003-grow">{t.transport || UND(40)}</u></div>
            <div className="f003-item">Касаллик бошлангандан сўнг ўтган вақт <u>{t.timeSinceOnset || UND(16)}</u>, жароҳатдан сўнг, <b style={{ borderBottom: '1px solid #000' }}>режали равишда</b> (чизинг)</div>
            <div className="f003-item"><b>9.</b> Бемор йўлланмасидаги ташҳис <u className="f003-grow">{t.diagnosis}</u></div>
            <div className="f003-item"><u className="f003-grow">{UND(60)}</u></div>
            <div className="f003-item"><b>10.</b> Қабулхонада қўйилган ташҳис <u className="f003-grow">{t.diagnosis}</u></div>
          </div>

          {/* ============ SAHIFA 2: 11-21 bandlar, operatsiya, imzolar ============ */}
          <div className="f003-page">
            <table className="f003-table">
              <thead>
                <tr>
                  <th style={{ width: '62%' }}><b>11.</b> Касалхонада қўйилган ташҳис</th>
                  <th style={{ width: '20%' }}>Касаллик аниқланган сана</th>
                  <th style={{ width: '18%' }}>Шифокор имзоси</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>{t.diagnosis}</td><td style={{ textAlign: 'center' }}>{t.date}</td><td style={{ textAlign: 'center' }}>{t.doctor}</td></tr>
                <tr><td>&nbsp;</td><td /><td /></tr>
                <tr><td>&nbsp;</td><td /><td /></tr>
                <tr><td>&nbsp;</td><td /><td /></tr>
              </tbody>
            </table>

            <div className="f003-item"><b>12.</b> Касалхонада қўйилган якуний ташҳис</div>
            <div className="f003-item f003-indent">а) асосий <u className="f003-grow">{t.diagnosis}</u></div>
            <div className="f003-item f003-indent"><u className="f003-grow">{UND(60)}</u></div>
            <div className="f003-item f003-indent">б) асосий касалликнинг асорати <u className="f003-grow">{t.complication || UND(50)}</u></div>
            <div className="f003-item f003-indent"><u className="f003-grow">{UND(60)}</u></div>
            <div className="f003-item f003-indent">в) аниқланган ҳамроҳ касалликлар <u className="f003-grow">{t.comorbidity || UND(50)}</u></div>
            <div className="f003-item f003-indent"><u className="f003-grow">{UND(60)}</u></div>

            <div className="f003-item">
              <b>13.</b> Мазкур йил давомида шу касаллик бўйича касалхонага ётиши:{' '}
              <b style={{ borderBottom: t.admissionCount === 'first' ? '1px solid #000' : 'none' }}>биринчи марта</b>,{' '}
              <b style={{ borderBottom: t.admissionCount === 'repeat' ? '1px solid #000' : 'none' }}>қайта</b> (чизинг).
              Ҳаммаси бўлиб <u>{t.totalAdmissions || '1'}</u> марта
            </div>

            <div className="f003-item"><b>14.</b> Жарроҳлик операциялари, оғриқсизлантириш усуллари ва операциядан кейинги асоратлар</div>
            <table className="f003-table">
              <thead>
                <tr>
                  <th style={{ width: '42%' }}>Операция номи</th>
                  <th style={{ width: '14%' }}>Вақти, соати</th>
                  <th style={{ width: '24%' }}>Оғриқсизлантириш усули</th>
                  <th style={{ width: '20%' }}>Асоратлари</th>
                </tr>
              </thead>
              <tbody>
                {(t.services && t.services.length > 0 ? t.services : t.service ? [t.service] : []).map((s, i) => (
                  <tr key={s + i}>
                    <td>{i + 1}. {s}</td>
                    <td style={{ textAlign: 'center' }}>{t.date}</td>
                    <td>{t.anesthesia || '—'}</td>
                    <td>{i === 0 ? formatSom(t.amount) : '—'}</td>
                  </tr>
                ))}
                {Array.from({ length: Math.max(0, 3 - ((t.services?.length ?? 0) || (t.service ? 1 : 0))) }).map((_, i) => (
                  <tr key={`e${i}`}><td>&nbsp;</td><td /><td /><td /></tr>
                ))}
              </tbody>
            </table>
            <div className="f003-item" style={{ textAlign: 'center' }}>Операция қилувчи <u className="f003-grow">{t.doctor}</u></div>

            <div className="f003-item"><b>15.</b> Даволашнинг бошқа турлари (кўрсатинг) <u className="f003-grow">{t.treatmentPlan || t.methods || UND(40)}</u></div>
            <div className="f003-item"><u className="f003-grow">{UND(60)}</u></div>
            <div className="f003-item"><b>16.</b> Меҳнатга яроқсизлик варағи ёки маълумотнома: № <u>{t.sickLeave || UND(10)}</u> дан <u>{UND(10)}</u> гача № <u>{UND(10)}</u> дан <u>{UND(10)}</u> гача</div>
            <div className="f003-item">
              <b>17.</b> Даволаш натижаси: касалхонадан жавоб берилди:{' '}
              <b style={{ borderBottom: (t.treatmentResult === 'тузалди' || t.status === 'yakunlandi') ? '1px solid #000' : 'none' }}>тузалди</b>,{' '}
              <b style={{ borderBottom: t.treatmentResult === 'bir oz yaxshilandi' || t.status === 'davolanmoqda' ? '1px solid #000' : 'none' }}>бир оз яхшиланди</b>,{' '}
              ўзгаришсиз, оғирлашган ҳолда, ўлди, бошқа муассасага ўтказилди
            </div>
            <div className="f003-item" style={{ textAlign: 'center' }}><span className="f003-caption">(даволаш муассасасининг номи)</span></div>
            <div className="f003-item f003-caption">
              Қабулхонада вафот этди, ҳомиладорликнинг 28-ҳафтасигача вафот этди, ҳомиладорликнинг
              28-ҳафтасидан кейин вафот этди, туғиш олдидан вафот этди, туққандан сўнг вафот этди.
            </div>
            <div className="f003-item">
              <b>18.</b> Меҳнат қобилияти{' '}
              <b style={{ borderBottom: !t.workCapacity || t.workCapacity === 'тикланди' ? '1px solid #000' : 'none' }}>тикланди</b>,{' '}
              сустлашди, вақтинча йўқолди, мазкур касаллик сабабли бутунлай йўқолди, бошқа сабабларга кўра (чизинг).
            </div>
            <div className="f003-item"><b>19.</b> Экспертизага юбориш учун хулоса <u className="f003-grow">{t.expertiseConclusion || t.doctorNote || UND(40)}</u></div>
            <div className="f003-item"><u className="f003-grow">{UND(60)}</u></div>
            <div className="f003-item"><b>20.</b> Алоҳида белгилар <u className="f003-grow">{t.specialMarks || t.advice || UND(40)}</u></div>
            <div className="f003-item"><b>21.</b> Қабул қилинганда текширилди: <b>а)</b> Қон (RW, ОИТС ва бошқа) <span className="f003-check">{t.admissionTests?.rw ? '☑' : '☐'}</span>, <b>б)</b> ахлат посеви <span className="f003-check">{t.admissionTests?.feces ? '☑' : '☐'}</span>, <b>в)</b> педикулёз <span className="f003-check">{t.admissionTests?.pediculosis ? '☑' : '☐'}</span>, <b>г)</b> мавҳум касалликлар <span className="f003-check">{t.admissionTests?.oits ? '☑' : '☐'}</span> <u className="f003-grow">{UND(20)}</u></div>

            <div className="f003-sign">
              <div>
                Даволаш шифокори <u>{t.doctor}</u>
                <div className="f003-caption" style={{ textAlign: 'center', marginTop: 2 }}>Ф.И.О., имзо</div>
              </div>
              <div>
                Бўлим мудири <u>{t.headOfDepartment || UND(20)}</u>
                <div className="f003-caption" style={{ textAlign: 'center', marginTop: 2 }}>Ф.И.О., имзо</div>
              </div>
            </div>
          </div>

          {/* ============ SAHIFA 3: Qabulxona yozuvi + Dori varaqi + Shikoyatlar ============ */}
          <div className="f003-page">
            <h3 className="f003-title">ҚАБУЛХОНА ШИФОКОРИНИНГ ЁЗУВИ</h3>
            <Lines />

            <div className="f003-row" style={{ marginTop: 8 }}>
              КБ № <u>{t.id}</u>&nbsp;&nbsp; беморнинг Ф.И.Ш. <u className="f003-grow">{t.patient}</u>
            </div>
            <div className="f003-row">
              даволовчи шифокорнинг Ф.И.Ш. <u className="f003-grow">{t.doctor}</u> врач томонидан буюрилган дори-воситалари варағи
            </div>

            <table className="f003-table f003-table-med" style={{ marginTop: 6 }}>
              <thead>
                <tr>
                  <th style={{ width: 28 }}>№</th>
                  <th style={{ width: 70 }}>Дата</th>
                  <th style={{ width: 170 }}>Шифокор томонидан буюрилган дори воситалари (номи, дозаси)</th>
                  <th style={{ width: 60 }}>Муолажани бажариш вақти</th>
                  <th style={{ width: 80 }}>Дори дармон ва тиббий буюм манбаси</th>
                  <th colSpan={MED_DATE_COLS}>Бажарилиш санаси</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: MED_ROWS }).map((_, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: 'center' }}>{i + 1}</td>
                    <td />
                    <td />
                    <td />
                    <td />
                    {Array.from({ length: MED_DATE_COLS }).map((_, j) => (
                      <td key={j} style={{ minWidth: 20 }} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className="f003-title" style={{ marginTop: 10 }}>
              ШИКОЯТЛАР КАСАЛЛИК ТАРИХИ, АҲВОЛИДАГИ ЎЗГАРИШЛАР, ТАХМИНИЙ ТАШҲИС, ТЕКШИРИШ РЕЖАСИ
            </h3>
            <div className="f003-lined">
              <div>{t.complaints ? <><em>Шикоят:</em> {t.complaints}</> : <>&nbsp;</>}</div>
              <div>{t.diagnosis ? <><em>Тахминий ташҳис:</em> {t.diagnosis}</> : <>&nbsp;</>}</div>
              <div>{t.examPlan ? <><em>Текшириш режаси:</em> {t.examPlan}</> : <>&nbsp;</>}</div>
              {Array.from({ length: Math.max(0, BLANK - 3) }).map((_, i) => <div key={i}>&nbsp;</div>)}
            </div>
          </div>

          {/* ============ SAHIFA 4: Xotima + Patologoanatom xulosasi ============ */}
          <div className="f003-page">
            <h3 className="f003-title">ХОТИМА</h3>
            <div className="f003-lined">
              <div>{t.treatmentResult ? <><em>Натижа:</em> {t.treatmentResult}</> : <>&nbsp;</>}</div>
              <div>{t.treatmentPlan ? <><em>Даволаш режаси:</em> {t.treatmentPlan}</> : <>&nbsp;</>}</div>
              <div>{t.methods ? <><em>Усуллар:</em> {t.methods}</> : <>&nbsp;</>}</div>
              <div>{t.advice ? <><em>Маслаҳатлар:</em> {t.advice}</> : <>&nbsp;</>}</div>
              <div>{t.doctorNote ? <><em>Шифокор изоҳи:</em> {t.doctorNote}</> : <>&nbsp;</>}</div>
              {Array.from({ length: Math.max(0, BLANK - 5) }).map((_, i) => <div key={i}>&nbsp;</div>)}
            </div>

            <h3 className="f003-title" style={{ marginTop: 14 }}>ПАТОЛОГОАНАТОМ ХУЛОСАСИ</h3>
            <div className="f003-lined">
              <div>{t.pathologyConclusion ? t.pathologyConclusion : <>&nbsp;</>}</div>
              {Array.from({ length: BLANK - 1 }).map((_, i) => <div key={i}>&nbsp;</div>)}
            </div>

            <div className="f003-item" style={{ marginTop: 10 }}><b>Патоморфологик хулоса (ташҳис)</b></div>
            <div className="f003-item f003-indent">а) Асосий <u className="f003-grow">{t.pathDxMain || UND(60)}</u></div>
            <div className="f003-item f003-indent"><u className="f003-grow">{UND(60)}</u></div>
            <div className="f003-item f003-indent">б) Асосий касаллик асорати <u className="f003-grow">{t.pathDxComplication || UND(50)}</u></div>
            <div className="f003-item f003-indent"><u className="f003-grow">{UND(60)}</u></div>
            <div className="f003-item f003-indent">в) Йўлдош касалликлар <u className="f003-grow">{t.pathDxComorbid || UND(50)}</u></div>

            <div className="f003-sign" style={{ marginTop: 28, gridTemplateColumns: '1fr 1fr' }}>
              <div />
              <div style={{ textAlign: 'right' }}>
                Шифокор Ф.И.О., имзоси <u>{t.pathologistName || UND(26)}</u>
              </div>
            </div>
          </div>

          <div className="f003-footer">
            <small>003 — рақамли тиббий ҳужжат шакли · № {t.id} · Сана: {dd}.{mm}.{yy}</small>
          </div>
        </div>
      </div>
    </div>
  );
}
