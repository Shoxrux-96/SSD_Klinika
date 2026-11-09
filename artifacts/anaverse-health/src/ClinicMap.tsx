import { useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, ExternalLink, Navigation, Map as MapIcon, Satellite } from 'lucide-react';
import { clinicLocations } from './clinicLocations';

const loc = clinicLocations[0];
const [lat, lng] = loc.position;
const googleUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
const googleNaviUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
const yandexUrl = `https://yandex.uz/maps/?pt=${lng},${lat}&z=17&l=map`;
const osmUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;

type MapLayer = 'map' | 'sat';

// Leaflet'ning standart marker rasmi bundler'da sinmasligi uchun
// SVG marker iconini inline qilamiz.
const CLINIC_ICON = L.divIcon({
  className: 'cm-leaflet-marker',
  html: `<div class="cm-pin"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s-7-7.5-7-12a7 7 0 0 1 14 0c0 4.5-7 12-7 12z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 34],
  popupAnchor: [0, -30],
});

// Tile provaytorlari — bepul, API key kerakmas
const TILES = {
  // OpenStreetMap — rasmiy, bepul, cheklanmagan
  map: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> hissadorlari',
  },
  // ESRI World Imagery — bepul sputnik qatlami, API key kerakmas
  sat: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics',
  },
};

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
        <MapContainer
          key={layer}
          center={[lat, lng]}
          zoom={17}
          scrollWheelZoom
          className="cm-leaflet"
          attributionControl={false}
        >
          <TileLayer
            url={TILES[layer].url}
            attribution={TILES[layer].attribution}
            maxZoom={19}
          />
          <Marker position={[lat, lng]} icon={CLINIC_ICON}>
            <Popup>
              <strong>{loc.name}</strong><br />
              {loc.address}
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      <div className="cm-actions">
        <a className="cm-btn cm-btn-osm" href={osmUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={14} /> OpenStreetMap
        </a>
        <a className="cm-btn cm-btn-yandex" href={yandexUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={14} /> Yandex Maps
        </a>
        <a className="cm-btn cm-btn-navi" href={googleNaviUrl} target="_blank" rel="noreferrer">
          <Navigation size={14} /> Yo'nalish (Google)
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
.cm-leaflet { width: 100%; height: 100%; border: 0; display: block; z-index: 1; }
.cm-leaflet-marker { background: transparent; border: 0; }
.cm-pin { color: #ff3c00; filter: drop-shadow(0 4px 10px rgba(255, 60, 0, 0.45)); }
.cm-pin svg { stroke: #ff3c00; fill: #fff; }
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
.cm-btn-osm { background: #7bb33e; color: #fff; }
.cm-btn-osm:hover { background: #6aa02e; transform: translateY(-1px); box-shadow: 0 8px 20px -8px rgba(123,179,62,.55); }
.cm-btn-navi { background: linear-gradient(135deg,#ff5a2e,#ff3c00); color: #fff; }
.cm-btn-navi:hover { filter: brightness(1.08); transform: translateY(-1px); box-shadow: 0 8px 20px -8px rgba(255,90,46,.55); }
@media (max-width: 640px) {
  .cm-map-box { height: 300px; }
  .cm-actions { padding: 12px 16px; }
  .cm-info { padding: 14px 16px; }
}
`;
