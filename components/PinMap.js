"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

// Small map with a draggable pin. Tap the map or drag the pin to fix a weak GPS reading.
// Tiles need internet; offline the map stays grey but the GPS position is still saved.
export default function PinMap({ lat, lng, onMove, zoom = 17 }) {
  const el = useRef(null);
  const parts = useRef({});
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    let dead = false;
    (async () => {
      const mod = await import("leaflet");
      const L = mod.default || mod;
      if (dead || !el.current) return;
      const map = L.map(el.current).setView([lat, lng], zoom);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
      const icon = L.divIcon({ className: "pin", html: "<span></span>", iconSize: [28, 28], iconAnchor: [14, 28] });
      const marker = L.marker([lat, lng], { draggable: true, icon, keyboard: false }).addTo(map);
      marker.on("dragend", () => { const p = marker.getLatLng(); onMoveRef.current(p.lat, p.lng); });
      map.on("click", (e) => { marker.setLatLng(e.latlng); onMoveRef.current(e.latlng.lat, e.latlng.lng); });
      parts.current = { map, marker };
    })();
    return () => { dead = true; if (parts.current.map) parts.current.map.remove(); parts.current = {}; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const { map, marker } = parts.current;
    if (!marker) return;
    marker.setLatLng([lat, lng]);
    if (!map.getBounds().contains([lat, lng])) map.panTo([lat, lng]);
  }, [lat, lng]);

  return <div ref={el} className="mapbox" role="application" aria-label="Map. Drag the pin to where the pollution is." />;
}