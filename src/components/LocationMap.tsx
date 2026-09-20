'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap, Marker, LatLng } from 'leaflet';

interface LocationMapProps {
  lat?: number;
  lng?: number;
  onPlace: (lat: number, lng: number) => void;
}

const DEFAULT = { lat: 51.5074, lng: -0.1278 };

export default function LocationMap({ lat, lng, onPlace }: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const posRef = useRef<{ lat?: number; lng?: number }>({ lat, lng });
  const onPlaceRef = useRef(onPlace);

  posRef.current = { lat, lng };
  onPlaceRef.current = onPlace;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = await import('leaflet');
      if (cancelled || !containerRef.current) return;

      const start = posRef.current;
      const map = L.map(containerRef.current, {
        center: [start.lat ?? DEFAULT.lat, start.lng ?? DEFAULT.lng],
        zoom: start.lat && start.lng ? 16 : 12,
        scrollWheelZoom: false,
      });
      mapRef.current = map;
      leafletRef.current = L;

      L.tileLayer('/api/tiles/{z}/{x}/{y}', {
        maxZoom: 19,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · <a href="https://www.geoapify.com">Geoapify</a>',
      }).addTo(map);

      const buildPin = (lt: number, lg: number): Marker => {
        const icon = L.divIcon({
          className: '',
          html: '<div class="map-pin"></div>',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
        const marker = L.marker([lt, lg], { draggable: true, icon }).addTo(map);
        marker.on('dragend', () => {
          const ll: LatLng = marker.getLatLng();
          onPlaceRef.current(ll.lat, ll.lng);
        });
        return marker;
      };

      if (typeof start.lat === 'number' && typeof start.lng === 'number') {
        markerRef.current = buildPin(start.lat, start.lng);
      }

      map.on('click', (e) => {
        if (!markerRef.current) {
          markerRef.current = buildPin(e.latlng.lat, e.latlng.lng);
        } else {
          markerRef.current.setLatLng(e.latlng);
        }
        onPlaceRef.current(e.latlng.lat, e.latlng.lng);
      });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      leafletRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    if (!map) return;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;

    if (!markerRef.current) {
      if (!leaflet) return;
      const icon = leaflet.divIcon({
        className: '',
        html: '<div class="map-pin"></div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      markerRef.current = leaflet.marker([lat, lng], { draggable: true, icon }).addTo(map);
      markerRef.current.on('dragend', () => {
        const ll = markerRef.current?.getLatLng();
        if (ll) onPlaceRef.current(ll.lat, ll.lng);
      });
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }
    map.setView([lat, lng], Math.max(map.getZoom(), 15), { animate: true });
  }, [lat, lng]);

  return <div ref={containerRef} className="w-full location-map" style={{ height: '240px', borderRadius: '2px' }} />;
}