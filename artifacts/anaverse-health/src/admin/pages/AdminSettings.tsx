import { useState } from 'react';
import { MapContainer, CircleMarker, Marker, TileLayer, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Building2, MapPin, Pencil, Phone as PhoneIcon, Plus, Share2, Ticket, Trash2, X,
} from 'lucide-react';
import {
  addPhone, addSocial, removePhone, removeSocial,
  updateContactSettings, updatePhone, updateSocial,
  useContactSettings, type ContactPhone, type ContactSocial, type SocialPlatform,
} from '../../contactSettings';
import {
  updatePromoSettings, usePromoSettings, usePromoCodes, removePromoCode,
} from '../../promoSettings';
import { useClinicInfo, updateClinicInfo } from '../../clinicSettings';

const PLATFORMS: { value: SocialPlatform; label: string }[] = [
  { value: 'telegram',  label: 'Telegram' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook',  label: 'Facebook' },
  { value: 'youtube',   label: 'YouTube' },
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'website',   label: 'Vebsayt' },
  { value: 'other',     label: 'Boshqa' },
];

type SettingsTab = 'clinic' | 'promo';

export function AdminSettings() {
  const contact = useContactSettings();
  const [editPhone, setEditPhone] = useState<ContactPhone | 'new' | null>(null);
  const [editSocial, setEditSocial] = useState<ContactSocial | 'new' | null>(null);
  const [tab, setTab] = useState<SettingsTab>('clinic');

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Sozlamalar</h1>
          <p>Klinika va tizim sozlamalari.</p>
        </div>
      </div>

      <div className="settings-tabs">
        <button className={`settings-tab ${tab === 'clinic' ? 'is-active' : ''}`} onClick={() => setTab('clinic')}>
          <Building2 size={14} /> Klinika
        </button>
        <button className={`settings-tab ${tab === 'promo' ? 'is-active' : ''}`} onClick={() => setTab('promo')}>
          <Ticket size={14} /> Promo kod
        </button>
      </div>

      {tab === 'promo' && <PromoSettingsPanel />}

      {tab === 'clinic' && (
      <div>
      <ClinicInfoPanel />

      <ClinicLogoPanel />

      <section className="admin-card">
        <div className="admin-card-head">
          <div><h2>Biz bilan bogʻlaning — telefon raqamlari</h2><small>Saytda koʻrsatiladigan raqamlar</small></div>
          <button className="admin-btn admin-btn-primary" onClick={() => setEditPhone('new')}>
            <Plus size={14} /> Yangi raqam
          </button>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Nomi</th><th>Raqam</th><th>Qoʻngʻiroq (tel)</th><th>Izoh</th><th style={{ width: 110 }}>Amallar</th></tr>
            </thead>
            <tbody>
              {contact.phones.length === 0 && (
                <tr><td colSpan={5} className="admin-cell-muted" style={{ textAlign: 'center', padding: 20 }}>
                  Raqam qoʻshilmagan — "Yangi raqam" bosing
                </td></tr>
              )}
              {contact.phones.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.label}</strong></td>
                  <td>{p.number}</td>
                  <td className="admin-cell-muted">{p.tel}</td>
                  <td className="admin-cell-muted">{p.note || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="admin-icon-btn" title="Tahrirlash" onClick={() => setEditPhone(p)}>
                        <Pencil size={14} />
                      </button>
                      <button className="admin-icon-btn danger" title="Oʻchirish"
                        onClick={() => { if (confirm(`"${p.label}" raqami oʻchirilsinmi?`)) removePhone(p.id); }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-card-head">
          <div><h2>Ijtimoiy tarmoqlar</h2><small>Telegram, Instagram va boshqa havolalar</small></div>
          <button className="admin-btn admin-btn-primary" onClick={() => setEditSocial('new')}>
            <Plus size={14} /> Yangi havola
          </button>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Platforma</th><th>Nomi</th><th>Nick / Handle</th><th>URL</th><th>Izoh</th><th style={{ width: 110 }}>Amallar</th></tr>
            </thead>
            <tbody>
              {contact.socials.length === 0 && (
                <tr><td colSpan={6} className="admin-cell-muted" style={{ textAlign: 'center', padding: 20 }}>
                  Havola qoʻshilmagan
                </td></tr>
              )}
              {contact.socials.map((s) => (
                <tr key={s.id}>
                  <td><span className="admin-chip">{PLATFORMS.find((p) => p.value === s.platform)?.label ?? s.platform}</span></td>
                  <td><strong>{s.label}</strong></td>
                  <td>{s.handle}</td>
                  <td className="admin-cell-muted" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <a href={s.url} target="_blank" rel="noreferrer">{s.url}</a>
                  </td>
                  <td className="admin-cell-muted">{s.note || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="admin-icon-btn" title="Tahrirlash" onClick={() => setEditSocial(s)}>
                        <Pencil size={14} />
                      </button>
                      <button className="admin-icon-btn danger" title="Oʻchirish"
                        onClick={() => { if (confirm(`"${s.label}" havolasi oʻchirilsinmi?`)) removeSocial(s.id); }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-card-head"><div><h2>Manzil va joylashuv</h2><small>Xaritaga bosib markerni qoʻying yoki surib joylashtiring</small></div></div>
        <div className="admin-form-grid">
          <label className="admin-field admin-field-full">
            <span>Manzil (asosiy)</span>
            <input type="text" value={contact.address}
              onChange={(e) => updateContactSettings({ address: e.target.value })} />
          </label>
          <label className="admin-field admin-field-full">
            <span>Manzil izohi</span>
            <input type="text" value={contact.addressNote}
              onChange={(e) => updateContactSettings({ addressNote: e.target.value })} />
          </label>
          <label className="admin-field">
            <span>Ish vaqti / Mavjudlik</span>
            <input type="text" value={contact.availability}
              onChange={(e) => updateContactSettings({ availability: e.target.value })} />
          </label>
          <label className="admin-field">
            <span>Xarita yaqinligi (zoom 10-19)</span>
            <input type="number" min={10} max={19} value={contact.mapZoom}
              onChange={(e) => updateContactSettings({ mapZoom: Number(e.target.value) || 15 })} />
          </label>
          <label className="admin-field">
            <span>Kenglik (latitude)</span>
            <input type="number" step="0.00001" value={contact.mapPosition[0]}
              onChange={(e) => updateContactSettings({
                mapPosition: [Number(e.target.value) || 0, contact.mapPosition[1]],
              })} />
          </label>
          <label className="admin-field">
            <span>Uzunlik (longitude)</span>
            <input type="number" step="0.00001" value={contact.mapPosition[1]}
              onChange={(e) => updateContactSettings({
                mapPosition: [contact.mapPosition[0], Number(e.target.value) || 0],
              })} />
          </label>
        </div>
        <div style={{ marginTop: 12 }}>
          <AdminMapPicker
            position={contact.mapPosition}
            zoom={contact.mapZoom || 15}
            onChange={(pos) => updateContactSettings({ mapPosition: pos })}
          />
          <small className="admin-cell-muted" style={{ display: 'block', marginTop: 6 }}>
            <MapPin size={11} /> Xaritaning istalgan joyiga bosing yoki markerni suring — joylashuv saqlanadi.
          </small>
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-card-head"><div><h2>Ish vaqti</h2><small>Qabul va dam olish kunlari</small></div></div>
        <div className="admin-form-grid">
          <label className="admin-field"><span>Dushanba — Juma</span><input type="text" defaultValue="08:00 — 20:00" /></label>
          <label className="admin-field"><span>Shanba</span><input type="text" defaultValue="09:00 — 18:00" /></label>
          <label className="admin-field"><span>Yakshanba</span><input type="text" defaultValue="Dam olish kuni" /></label>
          <label className="admin-field"><span>Shoshilinch chaqiruv</span><input type="text" defaultValue="24/7" /></label>
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-card-head"><div><h2>Xavfsizlik</h2><small>Parol va kirish siyosati</small></div></div>
        <div className="admin-form-grid">
          <label className="admin-field"><span>Minimal parol uzunligi</span><input type="number" defaultValue={8} /></label>
          <label className="admin-field"><span>Sessiya muddati (daq)</span><input type="number" defaultValue={60} /></label>
          <label className="admin-field admin-field-check"><input type="checkbox" defaultChecked /><span>Ikki bosqichli autentifikatsiya (admin uchun majburiy)</span></label>
          <label className="admin-field admin-field-check"><input type="checkbox" defaultChecked /><span>Notoʻgʻri kirish urinishlarini log qilish</span></label>
        </div>
      </section>

      </div>
      )}

      <style>{settingsTabsCss}</style>

      {editPhone && (
        <PhoneModal
          phone={editPhone === 'new' ? null : editPhone}
          onClose={() => setEditPhone(null)}
          onSave={(data) => {
            if (editPhone === 'new') addPhone(data);
            else updatePhone(editPhone.id, data);
            setEditPhone(null);
          }}
        />
      )}

      {editSocial && (
        <SocialModal
          social={editSocial === 'new' ? null : editSocial}
          onClose={() => setEditSocial(null)}
          onSave={(data) => {
            if (editSocial === 'new') addSocial(data);
            else updateSocial(editSocial.id, data);
            setEditSocial(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------- Map picker ---------- */
const PICKER_ICON = L.divIcon({
  className: 'admin-map-pin',
  html: '<div class="admin-map-pin-inner"><div></div></div>',
  iconSize: [28, 36],
  iconAnchor: [14, 32],
});

function AdminMapClicker({ onPick }: { onPick: (pos: [number, number]) => void }) {
  useMapEvents({
    click(e) { onPick([e.latlng.lat, e.latlng.lng]); },
  });
  return null;
}

function AdminMapFlyTo({ position }: { position: [number, number] }) {
  const map = useMap();
  if (map.getCenter().lat !== position[0] || map.getCenter().lng !== position[1]) {
    map.setView(position, map.getZoom());
  }
  return null;
}

function AdminMapPicker({
  position, zoom, onChange,
}: {
  position: [number, number];
  zoom: number;
  onChange: (pos: [number, number]) => void;
}) {
  return (
    <div className="admin-map-picker">
      <MapContainer
        center={position}
        zoom={zoom}
        scrollWheelZoom
        className="admin-map-picker-map"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap'
        />
        <AdminMapClicker onPick={onChange} />
        <AdminMapFlyTo position={position} />
        <Marker
          position={position}
          draggable
          icon={PICKER_ICON}
          eventHandlers={{
            dragend: (e) => {
              const latlng = (e.target as L.Marker).getLatLng();
              onChange([latlng.lat, latlng.lng]);
            },
          }}
        />
        <CircleMarker
          center={position}
          radius={10}
          pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#ef4444', fillOpacity: 0.9 }}
        />
      </MapContainer>
    </div>
  );
}

/* ---------- Phone modal ---------- */
function PhoneModal({
  phone, onClose, onSave,
}: {
  phone: ContactPhone | null;
  onClose: () => void;
  onSave: (data: Omit<ContactPhone, 'id'>) => void;
}) {
  const [label, setLabel] = useState(phone?.label ?? '');
  const [number, setNumber] = useState(phone?.number ?? '');
  const [tel, setTel] = useState(phone?.tel ?? '');
  const [note, setNote] = useState(phone?.note ?? '');

  const canSave = label.trim() && number.trim();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    onSave({
      label: label.trim(),
      number: number.trim(),
      tel: (tel || number).replace(/[^\d+]/g, ''),
      note: note.trim() || undefined,
    });
  };

  return (
    <div className="appt-modal-backdrop" onClick={onClose}>
      <form className="appt-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="appt-modal-head">
          <h3><PhoneIcon size={18} /> {phone ? 'Raqamni tahrirlash' : 'Yangi telefon raqami'}</h3>
          <button type="button" className="admin-icon-btn sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="appt-modal-body">
          <label>
            <span>Nomi</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Masalan: Asosiy raqam" autoFocus required />
          </label>
          <label>
            <span>Raqam (koʻrinadigan)</span>
            <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="+998 91 ..." required />
          </label>
          <label>
            <span>tel: havolasi (ixtiyoriy, boʻsh qoldirilsa raqamdan olinadi)</span>
            <input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="+998914343735" />
          </label>
          <label>
            <span>Izoh</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Qoʻngʻiroq uchun bosing" />
          </label>
        </div>
        <div className="appt-modal-foot">
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}>Bekor qilish</button>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={!canSave}>Saqlash</button>
        </div>
      </form>
    </div>
  );
}

/* ---------- Social modal ---------- */
function SocialModal({
  social, onClose, onSave,
}: {
  social: ContactSocial | null;
  onClose: () => void;
  onSave: (data: Omit<ContactSocial, 'id'>) => void;
}) {
  const [platform, setPlatform] = useState<SocialPlatform>(social?.platform ?? 'telegram');
  const [label, setLabel] = useState(social?.label ?? '');
  const [handle, setHandle] = useState(social?.handle ?? '');
  const [url, setUrl] = useState(social?.url ?? '');
  const [note, setNote] = useState(social?.note ?? '');

  const canSave = label.trim() && handle.trim() && url.trim();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    onSave({
      platform,
      label: label.trim(),
      handle: handle.trim(),
      url: url.trim(),
      note: note.trim() || undefined,
    });
  };

  return (
    <div className="appt-modal-backdrop" onClick={onClose}>
      <form className="appt-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="appt-modal-head">
          <h3><Share2 size={18} /> {social ? 'Havolani tahrirlash' : 'Yangi ijtimoiy tarmoq'}</h3>
          <button type="button" className="admin-icon-btn sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="appt-modal-body">
          <label>
            <span>Platforma</span>
            <select value={platform} onChange={(e) => {
              const v = e.target.value as SocialPlatform;
              setPlatform(v);
              if (!label) setLabel(PLATFORMS.find((p) => p.value === v)?.label ?? '');
            }}>
              {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </label>
          <label>
            <span>Nomi (saytda koʻrsatiladi)</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Telegram" required />
          </label>
          <label>
            <span>Nick / Handle</span>
            <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@ssd_klinika" required />
          </label>
          <label>
            <span>URL</span>
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://t.me/ssd_klinika" required />
          </label>
          <label>
            <span>Izoh</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Rasmiy kanalga oʻtish" />
          </label>
        </div>
        <div className="appt-modal-foot">
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}>Bekor qilish</button>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={!canSave}>Saqlash</button>
        </div>
      </form>
    </div>
  );
}

/* ---------- Promo kod settings ---------- */
function PromoSettingsPanel() {
  const promo = usePromoSettings();
  const codes = usePromoCodes();

  const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU');
  const sample = (payment: number) => {
    if (!promo.enabled) return '— tizim o‘chirilgan';
    if (payment < promo.minAmount) return '— promo berilmaydi (min ostida)';
    const amt = Math.round((payment * promo.percent) / 100);
    return `${fmt(amt)} so‘m promo kod`;
  };

  return (
    <>
      <div className="admin-card" style={{ background: '#eef2ff', border: '1px solid #c7d2fe', padding: 14, borderRadius: 10 }}>
        <strong style={{ color: '#4338ca' }}>Promo kod qanday ishlaydi?</strong>
        <p style={{ margin: '6px 0 0', color: '#3730a3', fontSize: 13 }}>
          Har bir to‘lovdan keyin bemor promo kod oladi ({promo.prefix}-A7K3 formatida). Promo kodni egasi
          yoki boshqa bemor keyingi to‘lovda ishlatishi mumkin.
        </p>
      </div>

      <section className="admin-card">
        <div className="admin-card-head">
          <div><h2>Promo kod tizimi</h2><small>To‘lovdan keyin avtomatik promo kod yaratish</small></div>
          <label className="promo-toggle">
            <input type="checkbox" checked={promo.enabled}
              onChange={(e) => updatePromoSettings({ enabled: e.target.checked })} />
            <span />
          </label>
        </div>

        <div className="admin-form-grid">
          <label className="admin-field">
            <span>Klinika prefiksi</span>
            <input type="text" value={promo.prefix}
              maxLength={12}
              onChange={(e) => updatePromoSettings({
                prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12),
              })}
              placeholder="SIRIUS" />
            <small style={{ color: '#64748b', marginTop: 4 }}>
              2–12 belgi, faqat lotin harf va raqam. Masalan: SMILE, WHITE
            </small>
          </label>

          <label className="admin-field">
            <span>Promo kod foizi (%)</span>
            <input type="number" min={0} max={100} step="0.01" value={promo.percent}
              onChange={(e) => updatePromoSettings({ percent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
            <small style={{ color: '#64748b', marginTop: 4 }}>
              Masalan: 5% qo‘yilsa, 100 000 so‘mlik to‘lovdan 5 000 so‘mlik promo kod beriladi
            </small>
          </label>

          <label className="admin-field">
            <span>Amal qilish muddati (oy)</span>
            <input type="number" min={1} max={24} value={promo.validMonths}
              onChange={(e) => updatePromoSettings({ validMonths: Math.max(1, Math.min(24, Number(e.target.value) || 6)) })} />
            <small style={{ color: '#64748b', marginTop: 4 }}>1–24 oy oraliq. Default: 6 oy</small>
          </label>

          <label className="admin-field">
            <span>Minimal to‘lov summasi</span>
            <input type="number" min={0} step="1000" value={promo.minAmount}
              onChange={(e) => updatePromoSettings({ minAmount: Math.max(0, Number(e.target.value) || 0) })} />
            <small style={{ color: '#64748b', marginTop: 4 }}>
              Shu summadan kichik to‘lovlarda promo kod berilmaydi. 0 = har to‘lovda.
            </small>
          </label>
        </div>

        <div style={{ marginTop: 14, padding: 12, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <strong style={{ fontSize: 12, color: '#475569', letterSpacing: '.08em' }}>NAMUNA</strong>
          <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13 }}>
            <span>100 000 so‘m to‘lov</span>  <em style={{ color: '#64748b' }}>— {sample(100000)}</em>
            <span>250 000 so‘m to‘lov</span>  <em style={{ color: '#64748b' }}>— {sample(250000)}</em>
            <span>500 000 so‘m to‘lov</span>  <em style={{ color: '#64748b' }}>— {sample(500000)}</em>
            <span>1 000 000 so‘m to‘lov</span><em style={{ color: '#64748b' }}>— {sample(1000000)}</em>
          </div>
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-card-head">
          <div><h2>Yaratilgan promo kodlar</h2><small>{codes.length} ta</small></div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Kod</th><th>Egasi</th><th className="cash-num">Summa</th>
                <th>Yaratilgan</th><th>Amal qiladi</th><th>Holati</th><th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {codes.length === 0 && (
                <tr><td colSpan={7} className="admin-cell-muted" style={{ textAlign: 'center', padding: 20 }}>
                  Hali promo kod yaratilmagan
                </td></tr>
              )}
              {codes.map((c) => {
                const expired = c.expiresAt < Date.now();
                const status = c.usedAt ? 'used' : expired ? 'expired' : 'active';
                return (
                  <tr key={c.id}>
                    <td><strong style={{ fontFamily: 'ui-monospace, Menlo, monospace', letterSpacing: '0.08em', color: '#1e40af' }}>{c.code}</strong></td>
                    <td>{c.patientName || '—'}</td>
                    <td className="cash-num">{fmt(c.amount)} so‘m</td>
                    <td className="admin-cell-muted">{new Date(c.createdAt).toLocaleDateString('ru-RU')}</td>
                    <td className="admin-cell-muted">{new Date(c.expiresAt).toLocaleDateString('ru-RU')} gacha</td>
                    <td>
                      <span className="admin-chip" style={{
                        background: status === 'active' ? '#ecfdf5' : status === 'used' ? '#f1f5f9' : '#fef2f2',
                        color: status === 'active' ? '#047857' : status === 'used' ? '#475569' : '#b91c1c',
                      }}>
                        {status === 'active' ? 'Faol' : status === 'used' ? 'Ishlatilgan' : 'Muddati o‘tgan'}
                      </span>
                    </td>
                    <td>
                      <button className="admin-icon-btn danger" title="O‘chirish"
                        onClick={() => { if (confirm(`"${c.code}" promo kodi o‘chirilsinmi?`)) removePromoCode(c.id); }}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

const settingsTabsCss = `
.settings-tabs { display: flex; gap: 6px; border-bottom: 1px solid #e2e8f0; margin: 6px 0 16px; }
.settings-tab {
  background: transparent; border: none; cursor: pointer;
  padding: 10px 14px; font-size: 13.5px; font-weight: 600; color: #64748b;
  display: inline-flex; align-items: center; gap: 6px;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.settings-tab:hover { color: #0f172a; }
.settings-tab.is-active { color: #2563eb; border-bottom-color: #2563eb; }

.promo-toggle { position: relative; display: inline-block; width: 44px; height: 24px; cursor: pointer; }
.promo-toggle input { opacity: 0; width: 0; height: 0; }
.promo-toggle span {
  position: absolute; inset: 0; background: #cbd5e1; border-radius: 999px;
  transition: background .2s;
}
.promo-toggle span::before {
  content: ''; position: absolute; top: 3px; left: 3px;
  width: 18px; height: 18px; background: #fff; border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0,0,0,.2); transition: transform .2s;
}
.promo-toggle input:checked + span { background: #2563eb; }
.promo-toggle input:checked + span::before { transform: translateX(20px); }
`;

/* ---------- Clinic logo ---------- */
function ClinicLogoPanel() {
  const contact = useContactSettings();
  const enabled = contact.logoEnabled !== false;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      alert('Rasm hajmi 500 KB dan oshmasligi kerak');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateContactSettings({ logoDataUrl: String(reader.result) });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  return (
    <section className="admin-card">
      <div className="admin-card-head">
        <div><h2>Klinika logosi (chek uchun)</h2><small>Chekning yuqori qismida ko‘rinadi</small></div>
        <label className="promo-toggle" title={enabled ? 'Yoqilgan' : 'O‘chirilgan'}>
          <input type="checkbox" checked={enabled}
            onChange={(e) => updateContactSettings({ logoEnabled: e.target.checked })} />
          <span />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', padding: '4px 4px 8px', flexWrap: 'wrap' }}>
        <div style={{
          width: 140, height: 140, borderRadius: 10, border: '1px dashed #cbd5e1',
          background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', flexShrink: 0,
        }}>
          {contact.logoDataUrl ? (
            <img src={contact.logoDataUrl} alt="logo"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', opacity: enabled ? 1 : .4 }} />
          ) : (
            <small style={{ color: '#94a3b8' }}>Logo yo‘q</small>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label className="admin-btn admin-btn-primary" style={{ cursor: 'pointer' }}>
            <Plus size={14} /> Rasm yuklash
            <input type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
          </label>
          {contact.logoDataUrl && (
            <button className="admin-btn admin-btn-ghost" style={{ color: '#dc2626', borderColor: '#fecaca' }}
              onClick={() => { if (confirm('Logo o‘chirilsinmi?')) updateContactSettings({ logoDataUrl: undefined }); }}>
              <Trash2 size={14} /> Logoni o‘chirish
            </button>
          )}
          <small style={{ color: '#64748b', maxWidth: 320 }}>
            PNG/SVG/JPG (max 500 KB). Toggle bilan chekda ko‘rsatish yoqib-o‘chiriladi,
            butunlay o‘chirish uchun "Logoni o‘chirish".
          </small>
        </div>
      </div>
    </section>
  );
}

function ClinicInfoPanel() {
  const info = useClinicInfo();
  return (
    <section className="admin-card">
      <div className="admin-card-head">
        <div>
          <h2>Klinika maʼlumotlari</h2>
          <small>Rasmiy nom va asosiy email — avtomatik saqlanadi</small>
        </div>
      </div>
      <div className="admin-form-grid">
        <label className="admin-field">
          <span>Klinika nomi</span>
          <input
            type="text"
            value={info.name}
            onChange={(e) => updateClinicInfo({ name: e.target.value })}
            placeholder="SSD Klinika — Sirius Stoma Dent Diagnostika markazi"
          />
        </label>
        <label className="admin-field">
          <span>Email</span>
          <input
            type="email"
            value={info.email}
            onChange={(e) => updateClinicInfo({ email: e.target.value })}
            placeholder="info@ssdclinic.uz"
          />
        </label>
      </div>
    </section>
  );
}
