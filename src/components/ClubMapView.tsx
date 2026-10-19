"use client";

// The map in court discovery.
//
// Markers are price bubbles, not pins. A pin only says "something is
// here"; a bubble with the price answers the question people actually have
// before they click. The active bubble turns court-blue and sits on top.
// Tiles are muted with a CSS filter (see .leaflet-tile-pane) so the
// bubbles stay the loudest thing on the map.
//
// Plain Leaflet rather than react-leaflet: the map is created in one
// effect and removed in its cleanup, which keeps React 18 strict mode and
// fast refresh from initialising the same container twice.

import { formatMoney } from "../lib/international";
import type { Locale } from "../lib/sports";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapClub } from "./clubTypes";

type Props = {
  clubs: MapClub[];
  locale?: Locale;
  activeId: string | null;
  onSelect: (id: string | null) => void;
  /** Where the visitor searched from, drawn as a soft ring. */
  origin?: { latitude: number; longitude: number; label: string } | null;
};

const US_CENTER: [number, number] = [39.5, -98];

function pill(club: MapClub, active: boolean, locale: Locale) {
  const bg = active ? "#1B62C4" : "#0F2138";
  const scale = active ? 1.12 : 1;
  return L.divIcon({
    className: "tm-pill-wrap",
    html: `<span class="tm-pill" role="button" tabindex="0" aria-label="${club.name.replace(/"/g, "&quot;")}" style="background:${bg};transform:scale(${scale});">${formatMoney(club.priceHour, club.currency, locale)}</span>`,
    iconSize: [96, 30],
    iconAnchor: [48, 30],
  });
}

const originIcon = () =>
  L.divIcon({
    className: "tm-pill-wrap",
    html: `<span style="display:block;width:18px;height:18px;border-radius:999px;background:#1B62C4;border:3px solid #fff;box-shadow:0 0 0 6px rgba(27,98,196,.2)"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

export default function ClubMapView({ clubs, activeId, onSelect, locale = "en-US", origin = null }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const originMarker = useRef<L.Marker | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;

  // Create and destroy the map with the component.
  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, { center: US_CENTER, zoom: 4, zoomControl: false, scrollWheelZoom: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(instance);
    map.current = instance;
    return () => {
      instance.remove();
      map.current = null;
      markers.current.clear();
      originMarker.current = null;
    };
  }, []);

  // Markers follow the club list; the viewport keeps everything in frame.
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    for (const marker of markers.current.values()) marker.remove();
    markers.current.clear();
    for (const club of clubs) {
      if (club.latitude == null || club.longitude == null) continue;
      const marker = L.marker([club.latitude, club.longitude], { icon: pill(club, club.id === activeId, locale), zIndexOffset: club.id === activeId ? 1000 : 0 })
        .on("click", () => select.current(club.id))
        .on("keypress", () => select.current(club.id))
        .addTo(instance);
      markers.current.set(club.id, marker);
    }
    originMarker.current?.remove();
    originMarker.current = origin ? L.marker([origin.latitude, origin.longitude], { icon: originIcon(), interactive: false }).addTo(instance) : null;

    const points = clubs.filter((c) => c.latitude != null && c.longitude != null).map((c) => [c.latitude as number, c.longitude as number] as [number, number]);
    if (origin) points.push([origin.latitude, origin.longitude]);
    if (points.length === 0) instance.setView(US_CENTER, 4);
    else if (points.length === 1) instance.setView(points[0], 12);
    else instance.fitBounds(L.latLngBounds(points), { padding: [56, 56], maxZoom: 13 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubs, origin, locale]);

  // Highlight and pan to the active club without rebuilding every marker.
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    for (const club of clubs) {
      const marker = markers.current.get(club.id);
      if (!marker) continue;
      marker.setIcon(pill(club, club.id === activeId, locale));
      marker.setZIndexOffset(club.id === activeId ? 1000 : 0);
    }
    const active = clubs.find((c) => c.id === activeId);
    if (active && active.latitude != null && active.longitude != null) {
      instance.panTo([active.latitude, active.longitude], { animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches });
    }
  }, [activeId, clubs, locale]);

  return <div ref={container} role="region" aria-label="Map of clubs" style={{ height: "100%", width: "100%", background: "#EDEBE5" }} />;
}
