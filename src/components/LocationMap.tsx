'use client';

import { useEffect, useRef } from 'react';
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet';
import { VenueInput } from '@/types';

type Props = {
  venue: VenueInput | null;
  onPick: (lat: number, lng: number) => void;
  onLocate: () => void;
  locating: boolean;
};

export default function LocationMap({ venue, onPick, onLocate, locating }: Props) {
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<LeafletMarker | null>(null);
  const onPickRef = useRef(onPick);

  useEffect(() => { onPickRef.current = onPick; }, [onPick]);

  useEffect(() => {
    let disposed = false;
    async function init() {
      if (!node.current || map.current) return;
      const L = await import('leaflet');
      if (disposed || !node.current) return;
      const initial: [number, number] = typeof venue?.lat === 'number' && typeof venue?.lng === 'number' ? [venue.lat, venue.lng] : [38.72, -9.14];
      const instance = L.map(node.current, { zoomControl: false, attributionControl: true }).setView(initial, venue ? 13 : 3);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(instance);
      L.control.zoom({ position: 'bottomright' }).addTo(instance);
      const icon = L.divIcon({ className: 'bt-marker-wrap', html: '<span class="bt-map-marker"><i></i></span>', iconSize: [28, 34], iconAnchor: [14, 30] });
      if (venue && typeof venue.lat === 'number' && typeof venue.lng === 'number') {
        marker.current = L.marker([venue.lat, venue.lng], { icon, draggable: true }).addTo(instance);
        marker.current.on('dragend', () => {
          const ll = marker.current?.getLatLng();
          if (ll) onPickRef.current(ll.lat, ll.lng);
        });
      }
      instance.on('click', (event) => onPickRef.current(event.latlng.lat, event.latlng.lng));
      map.current = instance;
    }
    void init();
    return () => {
      disposed = true;
      if (map.current) { map.current.remove(); map.current = null; marker.current = null; }
    };
  // only initialize once
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function sync() {
      if (!map.current || typeof venue?.lat !== 'number' || typeof venue?.lng !== 'number') return;
      const L = await import('leaflet');
      const icon = L.divIcon({ className: 'bt-marker-wrap', html: '<span class="bt-map-marker"><i></i></span>', iconSize: [28, 34], iconAnchor: [14, 30] });
      const point: [number, number] = [venue.lat, venue.lng];
      if (!marker.current) {
        marker.current = L.marker(point, { icon, draggable: true }).addTo(map.current);
        marker.current.on('dragend', () => {
          const ll = marker.current?.getLatLng();
          if (ll) onPickRef.current(ll.lat, ll.lng);
        });
      } else {
        marker.current.setLatLng(point);
      }
      map.current.flyTo(point, Math.max(map.current.getZoom(), 14), { duration: 0.45 });
    }
    void sync();
  }, [venue?.lat, venue?.lng]);

  return (
    <div className="map-shell">
      <div ref={node} className="location-map" aria-label="Location map" />
      <button className="map-locate" type="button" onClick={onLocate} disabled={locating}>{locating ? 'Locating…' : 'Use my location'}</button>
      <div className="map-note">Click the map or drag the pin.</div>
    </div>
  );
}
