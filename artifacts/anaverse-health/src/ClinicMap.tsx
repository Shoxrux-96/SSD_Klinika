import { useEffect, useState } from 'react';
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import { LocateFixed, Minus, Plus } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { clinicLocations } from './clinicLocations';

type UserLocation = {
  position: [number, number];
  accuracy: number;
};

type LocationStatus = {
  kind: 'idle' | 'loading' | 'success' | 'error';
  message: string;
};

const DEFAULT_TASHKENT_VIEW: [number, number] = [41.3111, 69.2797];

function ClinicMarkers() {
  const map = useMap();

  useEffect(() => {
    if (clinicLocations.length === 1) {
      map.setView(clinicLocations[0].position, 14);
    } else if (clinicLocations.length > 1) {
      map.fitBounds(clinicLocations.map((clinic) => clinic.position), { padding: [48, 48], maxZoom: 14 });
    }
  }, [map]);

  return (
    <>
      {clinicLocations.map((clinic) => (
        <CircleMarker
          key={clinic.id}
          center={clinic.position}
          radius={11}
          pathOptions={{ color: '#ffffff', weight: 4, fillColor: '#4d61cf', fillOpacity: 1 }}
        >
          <Popup>
            <strong>{clinic.name}</strong>
            <br />
            {clinic.address}
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}

function CurrentLocationMarker({ location }: { location: UserLocation }) {
  return (
    <>
      <Circle
        center={location.position}
        radius={Math.max(location.accuracy, 35)}
        pathOptions={{ color: '#5268d8', weight: 1, fillColor: '#7185ee', fillOpacity: 0.12 }}
      />
      <CircleMarker
        center={location.position}
        radius={9}
        pathOptions={{ color: '#ffffff', weight: 4, fillColor: '#5268d8', fillOpacity: 1 }}
      >
        <Popup>Sizning joriy joylashuvingiz</Popup>
      </CircleMarker>
    </>
  );
}

function MapControls({
  onLocationFound,
  onLocationError,
  onLocationLoading,
  locationLoading,
}: {
  onLocationFound: (location: UserLocation) => void;
  onLocationError: (message: string) => void;
  onLocationLoading: () => void;
  locationLoading: boolean;
}) {
  const map = useMap();

  const locateUser = () => {
    if (!navigator.geolocation) {
      onLocationError('Brauzeringiz joriy joylashuvni aniqlashni qo‘llab-quvvatlamaydi.');
      return;
    }

    onLocationLoading();
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const location = {
          position: [coords.latitude, coords.longitude] as [number, number],
          accuracy: coords.accuracy,
        };
        onLocationFound(location);
        map.flyTo(location.position, 15, { duration: 0.8 });
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? 'Joylashuvni ko‘rsatish uchun brauzer ruxsatini bering.'
            : error.code === error.TIMEOUT
              ? 'Joylashuv aniqlanmadi. Yana bir bor urinib ko‘ring.'
              : 'Joriy joylashuvni aniqlab bo‘lmadi.';
        onLocationError(message);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  };

  return (
    <div className="clinic-map-controls" aria-label="Xarita boshqaruvlari">
      <div className="clinic-map-zoom">
        <button type="button" onClick={() => map.zoomIn()} aria-label="Xaritani kattalashtirish" title="Kattalashtirish">
          <Plus size={19} />
        </button>
        <button type="button" onClick={() => map.zoomOut()} aria-label="Xaritani kichraytirish" title="Kichraytirish">
          <Minus size={19} />
        </button>
      </div>
      <button
        className="clinic-map-locate"
        type="button"
        onClick={locateUser}
        disabled={locationLoading}
        aria-label="Joriy joylashuvimni ko‘rsatish"
        title="Joriy joylashuvimni ko‘rsatish"
      >
        <LocateFixed size={18} />
        <span>{locationLoading ? 'Aniqlanmoqda…' : 'Joylashuvim'}</span>
      </button>
    </div>
  );
}

export function ClinicMap() {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [status, setStatus] = useState<LocationStatus>({
    kind: 'idle',
    message:
      clinicLocations.length > 0
        ? 'Klinika filiallari xaritada belgilangan.'
        : 'Klinika manzillari kiritilgach, xaritada belgilanadi.',
  });

  const handleLocationFound = (location: UserLocation) => {
    setUserLocation(location);
    setStatus({ kind: 'success', message: 'Joriy joylashuvingiz xaritada ko‘rsatildi.' });
  };

  const handleLocationError = (message: string) => {
    setStatus({ kind: 'error', message });
  };

  return (
    <div className="map-panel" data-testid="map-openstreetmap">
      <div className="map-card">
        <MapContainer
          center={clinicLocations[0]?.position ?? DEFAULT_TASHKENT_VIEW}
          zoom={clinicLocations.length > 0 ? 13 : 12}
          scrollWheelZoom
          zoomControl={false}
          attributionControl={false}
          className="clinic-leaflet-map"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          />
          <ClinicMarkers />
          {userLocation && <CurrentLocationMarker location={userLocation} />}
          <MapControls
            onLocationFound={handleLocationFound}
            onLocationError={handleLocationError}
            onLocationLoading={() => setStatus({ kind: 'loading', message: 'Joriy joylashuv aniqlanmoqda…' })}
            locationLoading={status.kind === 'loading'}
          />
        </MapContainer>
      </div>
      <div className={`map-footer map-footer-${status.kind}`}>
        <span role="status" aria-live="polite">{status.message}</span>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          © OpenStreetMap
        </a>
      </div>
    </div>
  );
}
