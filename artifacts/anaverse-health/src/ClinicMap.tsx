import { useState } from 'react';
import { MapPin, ExternalLink, Navigation, Map as MapIcon, Satellite } from 'lucide-react';
import { clinicLocations } from './clinicLocations';

const loc = clinicLocations[0];
const [lat, lng] = loc.position;
const googleUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
const googleNaviUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
const yandexUrl = `https://yandex.uz/maps/?pt=${lng},${lat}&z=17&l=map`;

type MapLayer = 'map' | 'sat';
// Google Maps embed — !5e0 = ko'cha (roadmap), !5e1 = sputnik (satellite)
const embedUrl = (layer: MapLayer) =>
  `https://www.google.com/maps/embed?pb=!1m13!1m8!1m3!1d745.2633842624621!2d60.29050917116395!3d41.654585275322674!3m2!1i1024!2i768!4f13.1!3m2!1m1!2zNDHCsDM5JzE2LjEiTiA2MMKwMTcnMjcuNiJF!5e${layer === 'sat' ? '1' : '0'}!3m2!1suz!2s!4v1794017667934!5m2!1suz!2s`;

export function ClinicMap() {
  const [layer, setLayer] = useState<MapLayer>('map');
  return (
    <div className="cm-wrap" data-testid="map-google">
      <style>{css}</style>
      <div className="cm-info">
        <div className="cm-ico"><MapPin size={22} /></div>
        <div className="cm-copy">
          <strong>{loc.name}</strong>
          <span>{loc.address}</span>
          <span className="cm-coord">{lat.toFixed(6)}, {lng.toFixed(6)}</span>
        </div>
      </div>

      <div className="cm-map-box">
        <div className="cm-layer-switch" role="tablist" aria-label="Xarita turi">
          <button
            type="button"
            role="tab"
            aria-selected={layer === 'map'}
            className={`cm-layer-btn ${layer === 'map' ? 'is-active' : ''}`}
            onClick={() => setLayer('map')}
          >
            <MapIcon size={14} /> Ko‘cha
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={layer === 'sat'}
            className={`cm-layer-btn ${layer === 'sat' ? 'is-active' : ''}`}
            onClick={() => setLayer('sat')}
          >
            <Satellite size={14} /> Sputnik
          </button>
        </div>
        <iframe
          key={layer}
          src={embedUrl(layer)}
          title="Klinika joylashuvi — Google Maps"
          className="cm-iframe"
          loading="lazy"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>

      <div className="cm-actions">
        <a className="cm-btn cm-btn-google" href={googleUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={14} /> Google Maps
        </a>
        <a className="cm-btn cm-btn-yandex" href={yandexUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={14} /> Yandex Maps
        </a>
        <a className="cm-btn cm-btn-navi" href={googleNaviUrl} target="_blank" rel="noreferrer">
          <Navigation size={14} /> Yo‘nalish
        </a>
      </div>
    </div>
  );
}

const css = `
.cm-wrap {
  width: 100%;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 20px 60px -20px rgba(15,23,42,.12);
}
.cm-info {
  display: flex; gap: 14px; align-items: flex-start;
  padding: 18px 22px;
  background: linear-gradient(135deg,#fff7ed,#fff);
  border-bottom: 1px solid #fde4d1;
}
.cm-ico {
  width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
  background: linear-gradient(135deg,#ff5a2e,#ff3c00); color: #fff;
  display: grid; place-items: center;
  box-shadow: 0 8px 20px -8px rgba(255,90,46,.55);
}
.cm-copy { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.cm-copy strong { font-size: 15px; color: #0f172a; line-height: 1.3; }
.cm-copy span { font-size: 13px; color: #475569; }
.cm-coord { font-size: 11.5px !important; color: #94a3b8 !important; font-family: ui-monospace, monospace; }
.cm-map-box { width: 100%; height: 380px; background: #f1f5f9; position: relative; }
.cm-iframe { width: 100%; height: 100%; border: 0; display: block; }
.cm-layer-switch {
  position: absolute; top: 12px; left: 12px; z-index: 5;
  display: inline-flex; gap: 2px; padding: 4px;
  background: rgba(255,255,255,.96); border-radius: 10px;
  box-shadow: 0 6px 20px -8px rgba(15,23,42,.35);
  backdrop-filter: blur(8px);
}
.cm-layer-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 12px; border: 0; background: transparent;
  font-size: 12.5px; font-weight: 600; color: #475569;
  border-radius: 7px; cursor: pointer; transition: all .15s;
}
.cm-layer-btn:hover { background: #f1f5f9; color: #0f172a; }
.cm-layer-btn.is-active {
  background: linear-gradient(135deg,#ff5a2e,#ff3c00); color: #fff;
  box-shadow: 0 4px 12px -4px rgba(255,90,46,.55);
}
.cm-actions {
  display: flex; gap: 10px; padding: 14px 22px;
  background: #f8fafc; border-top: 1px solid #eef2f7;
  flex-wrap: wrap;
}
.cm-btn {
  flex: 1 1 140px;
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  padding: 11px 16px; border-radius: 10px; font-size: 13px; font-weight: 600;
  text-decoration: none; transition: all .18s; border: 1px solid transparent;
}
.cm-btn-yandex { background: #ffcc00; color: #0f172a; }
.cm-btn-yandex:hover { background: #f5b800; transform: translateY(-1px); box-shadow: 0 8px 20px -8px rgba(245,184,0,.55); }
.cm-btn-google { background: #fff; color: #1a73e8; border-color: #dadce0; }
.cm-btn-google:hover { background: #1a73e8; color: #fff; border-color: #1a73e8; transform: translateY(-1px); }
.cm-btn-navi { background: linear-gradient(135deg,#ff5a2e,#ff3c00); color: #fff; }
.cm-btn-navi:hover { filter: brightness(1.08); transform: translateY(-1px); box-shadow: 0 8px 20px -8px rgba(255,90,46,.55); }
@media (max-width: 640px) {
  .cm-map-box { height: 300px; }
  .cm-actions { padding: 12px 16px; }
  .cm-info { padding: 14px 16px; }
}
`;
