import { lazy, Suspense, useEffect, useState } from 'react';
import { Monitor, X } from 'lucide-react';
import { useQueue } from '../store';

const SkeletonFocused = lazy(() =>
  import('../../SkeletonFocused').then((m) => ({ default: m.SkeletonFocused })),
);

type Organ = {
  id: string;
  label: string;
  image: string;
  detail: string;
  note: string;
  facts: string[];
  targetY: number;
  distance: number;
};

const tvOrgans: Organ[] = [
  {
    id: 'miya', label: 'Miya', image: '/assets/organ-brain.jpg',
    detail: 'Miya va asab tizimi',
    note: 'Nevrologik ko‘rik, MRT va asab tizimi salomatligi diagnostikasi.',
    facts: ['86 milliard neyron', 'Kuniga ~20% energiya iste\'mol qiladi', 'Xotira, fikr va his-tuyg\'u markazi'],
    targetY: 0.95, distance: 1.7,
  },
  {
    id: 'tomoq', label: 'Tomoq va LOR', image: '/assets/organ-throat.jpg',
    detail: 'Quloq, burun, tomoq',
    note: 'LOR mutaxassisi ko‘rigi — quloq, burun va tomoq kasalliklari diagnostikasi.',
    facts: ['Nafas va ovqat yo\'li', 'Ovoz paychalari joylashgan', 'Mavsumiy angina — eng keng tarqalgan'],
    targetY: 0.88, distance: 1.7,
  },
  {
    id: 'yurak', label: 'Yurak', image: '/assets/organ-heart.jpg',
    detail: 'Yurak-qon tomir tizimi',
    note: 'Yurak faoliyati va qon aylanishi salomatligi — kardiolog ko‘rigi va EKG tekshiruvi.',
    facts: ['Kuniga ~100 000 marta uradi', '5 litr qonni daqiqasiga haydaydi', 'Jismoniy faollik — asosiy himoya'],
    targetY: 0.75, distance: 1.9,
  },
  {
    id: 'opka', label: 'O‘pka', image: '/assets/organ-lungs.jpg',
    detail: 'Nafas tizimi',
    note: 'Nafas yo‘llari va o‘pka salomatligi — pulmonolog ko‘rigi, rentgen va spirometriya.',
    facts: ['Kuniga ~20 000 marta nafas olasiz', '300 million alveola mavjud', 'Toza havo va chekmaslik muhim'],
    targetY: 0.78, distance: 1.9,
  },
  {
    id: 'jigar', label: 'Jigar', image: '/assets/organ-liver.jpg',
    detail: 'Jigar va hazm',
    note: 'Jigar funksiyasi, oshqozon-ichak salomatligi va biokimyoviy tahlillar.',
    facts: ['500+ dan ortiq vazifa bajaradi', 'Zaharlarni tanadan chiqaradi', 'Alkogol va yog\'li ovqat — xavf'],
    targetY: 0.5, distance: 1.9,
  },
  {
    id: 'umurtqa', label: 'Umurtqa', image: '/assets/organ-spine.jpg',
    detail: 'Umurtqa pog‘onasi',
    note: 'Umurtqa va bo‘g‘imlar salomatligi — travmatolog va ortoped ko‘rigi.',
    facts: ['33 ta umurtqa suyagi', 'Orqa miyani himoya qiladi', 'To\'g\'ri o\'tirish — bel sog‘lig‘i'],
    targetY: 0.55, distance: 2.1,
  },
  {
    id: 'qol', label: 'Qo‘l va bilak', image: '/assets/organ-hand.jpg',
    detail: 'Qo‘l, bilak va paylar',
    note: 'Qo‘l, bilak va paylar salomatligi, travmalar va reabilitatsiya.',
    facts: ['Bir qo‘lda 27 ta suyak', '34 ta mushak harakatga javob beradi', 'Mayda motorika — miya rivoji'],
    targetY: 0.65, distance: 2.2,
  },
  {
    id: 'oyoq', label: 'Oyoq va bo‘g‘imlar', image: '/assets/organ-leg.jpg',
    detail: 'Harakat tizimi',
    note: 'Oyoq va bo‘g‘imlar salomatligi, ortoped-travmatolog maslahati.',
    facts: ['Tizza — eng katta bo‘g‘im', 'Yurish — qon aylanishini oshiradi', 'Kuniga 8000+ qadam tavsiya etiladi'],
    targetY: 0.2, distance: 2.3,
  },
];

export function TvScreen({ title, doctorFilter, onClose }: { title?: string; doctorFilter?: string; onClose: () => void }) {
  const all = useQueue();
  const queue = doctorFilter ? all.filter((q) => q.doctor === doctorFilter) : all;
  const inRoom = queue.filter((q) => q.status === 'kabinetda');
  const waiting = queue.filter((q) => q.status === 'navbatda');

  // Sequence: each organ photo 5s, then at the end a single 3D skeleton slot (15s — full rotation).
  const slotCount = tvOrgans.length + 1;
  const [step, setStep] = useState(0);
  const is3dSlot = step === tvOrgans.length;
  useEffect(() => {
    const id = window.setTimeout(() => setStep((s) => (s + 1) % slotCount), is3dSlot ? 15000 : 5000);
    return () => window.clearTimeout(id);
  }, [step, is3dSlot, slotCount]);
  const organIdx = is3dSlot ? tvOrgans.length - 1 : step;
  const mode: '3d' | 'photo' = is3dSlot ? '3d' : 'photo';
  const organ = tvOrgans[organIdx];
  const setOrganIdx = (i: number) => setStep(i);

  const brandTitle = title ?? 'SSD KLINIKA — Navbat ekrani';

  return (
    <div className="tv-backdrop" onClick={onClose}>
      <div className="tv-screen" onClick={(e) => e.stopPropagation()}>
        <div className="tv-head">
          <div className="tv-brand">
            <Monitor size={20} /> {brandTitle}
          </div>
          <button type="button" className="tv-close" onClick={onClose} aria-label="Yopish">
            <X size={18} />
          </button>
        </div>

        <div className="tv-body">
          <div className="tv-main">
            <div className="tv-section-title">Hozir kabinetda / chaqirilmoqda</div>
            <div className="tv-call-grid">
              {inRoom.length === 0 && waiting.length === 0 ? (
                <div className="tv-empty">Kabinetda va navbatda bemor yo‘q</div>
              ) : (
                <>
                  {inRoom.map((q) => (
                    <div key={q.id} className="tv-call-card is-in-room">
                      <div className="tv-call-num">{q.number}</div>
                      <div className="tv-call-body">
                        <strong>{q.patient}</strong>
                        <span>{q.doctor}</span>
                        <small>kabinetda</small>
                      </div>
                    </div>
                  ))}
                  {waiting.slice(0, 1).map((q) => (
                    <div key={q.id} className="tv-call-card is-next">
                      <div className="tv-call-num">{q.number}</div>
                      <div className="tv-call-body">
                        <strong>{q.patient}</strong>
                        <span>{q.doctor}</span>
                        <small>🟢 KEYINGI — kabinetga kiring</small>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            <div className="tv-health-card" aria-live="polite">
              <div className="tv-health-head">
                <span className="tv-organ-kicker">Sizning salomatligingiz</span>
                <strong>{is3dSlot ? 'Inson anatomiyasi' : organ.label}</strong>
                <em>{is3dSlot ? 'Butun skelet — 3D ko‘rinish' : organ.detail}</em>
              </div>

              <div className="tv-health-stage tv-health-stage-solo">
                {mode === '3d' ? (
                  <div key="3d-full" className="tv-health-photo tv-health-slide">
                    <div className="tv-health-photo-frame tv-health-3d-frame">
                      <Suspense fallback={<div className="tv-skeleton-loading">3D yuklanmoqda…</div>}>
                        <SkeletonFocused targetY={0.5} distance={3.4} />
                      </Suspense>
                    </div>
                    <ul className="tv-health-facts">
                      {[
                        'Inson skeleti 206 ta suyakdan iborat',
                        '650+ dan ortiq mushak harakatga javob beradi',
                        'Yurak-qon tomir tizimi 100 000 km uzunlikda',
                        'Interaktiv 3D — aylantiring va yaqinlashtiring',
                      ].map((f, i) => (
                        <li key={i} style={{ animationDelay: `${0.15 + i * 0.12}s` }}>
                          <span className="tv-fact-dot" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div key={`photo-${organ.id}`} className="tv-health-photo tv-health-slide">
                    <div className="tv-health-photo-frame">
                      <img
                        src={organ.image}
                        alt={organ.label}
                        onError={(e) => ((e.currentTarget.style.display = 'none'))}
                      />
                    </div>
                    <ul className="tv-health-facts">
                      {organ.facts.map((f, i) => (
                        <li key={i} style={{ animationDelay: `${0.15 + i * 0.12}s` }}>
                          <span className="tv-fact-dot" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <p className="tv-health-note">
                {is3dSlot ? 'Inson tanasi — 360° interaktiv skelet modeli. Sichqoncha bilan aylantiring va yaqinlashtiring.' : organ.note}
              </p>

              <div className="tv-organ-dots">
                {tvOrgans.map((o, i) => (
                  <button
                    key={o.id}
                    type="button"
                    className={`tv-organ-dot${i === step ? ' is-on' : ''}`}
                    onClick={() => setOrganIdx(i)}
                    aria-label={o.label}
                    title={o.label}
                  />
                ))}
                <button
                  type="button"
                  className={`tv-organ-dot tv-organ-dot-3d${is3dSlot ? ' is-on' : ''}`}
                  onClick={() => setStep(tvOrgans.length)}
                  aria-label="3D skelet"
                  title="3D skelet"
                />
              </div>
            </div>
          </div>

          <div className="tv-side">
            <div className="tv-section-title">Navbatda ({waiting.length})</div>
            <div className="tv-queue-list">
              {waiting.length === 0 ? (
                <div className="tv-empty">Navbatda bemor yo‘q</div>
              ) : (
                waiting.map((q, i) => (
                  <div key={q.id} className={`tv-queue-row${i === 0 ? ' is-head' : ''}`}>
                    <span className="tv-queue-num">{q.number}</span>
                    <span className="tv-queue-patient">{q.patient}</span>
                    <span className="tv-queue-doctor">{q.doctor}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="tv-foot">
          <span>Jami: <strong>{queue.length}</strong></span>
          <span>Navbatda: <strong>{waiting.length}</strong></span>
          <span>Kabinetda: <strong>{inRoom.length}</strong></span>
          <span className="tv-time">{new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    </div>
  );
}
