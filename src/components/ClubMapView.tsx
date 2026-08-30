"use client";

// Kortet i klub-udforskeren.
//
// To designvalg der er værd at kende:
//
// 1. Markørerne er prisbobler, ikke nåle. En nål fortæller kun "her ligger
//    noget"; en boble med prisen svarer på det spørgsmål, folk faktisk har,
//    før de klikker. Boblen er formet som en scoretavle-brik — mørkegrøn
//    som vindskærmen, og lergrus-rød når den er valgt.
//
// 2. Flisene er dæmpede (CARTO Positron). Standardfliserne fra
//    OpenStreetMap er fulde af farve og tekst, og så forsvinder boblerne i
//    støjen. Et roligt underlag lader indholdet træde frem.

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapClub } from "./clubTypes";

type Props = {
  clubs: MapClub[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
};

function pill(club: MapClub, active: boolean) {
  const bg = active ? "#B4491E" : "#1E3D2F";
  const scale = active ? 1.12 : 1;
  return L.divIcon({
    className: "tm-pill-wrap",
    html: `
      <span class="tm-pill" style="
        background:${bg};
        transform:scale(${scale});
      ">${club.priceHour} kr</span>
    `,
    iconSize: [64, 30],
    iconAnchor: [32, 30],
  });
}

/** Holder alle klubber i billedet, og zoomer ind på den valgte. */
function Viewport({ clubs, activeId }: { clubs: MapClub[]; activeId: string | null }) {
  const map = useMap();

  useEffect(() => {
    if (clubs.length === 0) return;
    map.fitBounds(
      L.latLngBounds(
        clubs.map((c) => [c.latitude as number, c.longitude as number] as [number, number])
      ),
      { padding: [56, 56], maxZoom: 14 }
    );
  }, [clubs, map]);

  useEffect(() => {
    if (!activeId) return;
    const club = clubs.find((c) => c.id === activeId);
    if (!club) return;
    map.panTo([club.latitude as number, club.longitude as number], {
      animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
  }, [activeId, clubs, map]);

  return null;
}

export default function ClubMapView({ clubs, activeId, onSelect }: Props) {
  const center = useMemo<[number, number]>(() => {
    if (clubs.length === 0) return [56.0, 10.6];
    return [clubs[0].latitude as number, clubs[0].longitude as number];
  }, [clubs]);

  return (
    <MapContainer
      center={center}
      zoom={11}
      scrollWheelZoom
      zoomControl={false}
      style={{ height: "100%", width: "100%", background: "#EDEBE5" }}
    >
      <TileLayer
        // CARTOs dæmpede fliser krævede indtil for nylig ingen nøgle, men
        // CARTO indførte i slutningen af august 2026 et krav om API-nøgle
        // for netop den flisetype. Almindelige OpenStreetMap-fliser er
        // stadig gratis uden nøgle; det dæmpede udseende laves i stedet
        // med et CSS-filter (se .leaflet-tile-pane i globals.css).
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Viewport clubs={clubs} activeId={activeId} />

      {clubs.map((club) => (
        <Marker
          key={club.id}
          position={[club.latitude as number, club.longitude as number]}
          icon={pill(club, club.id === activeId)}
          zIndexOffset={club.id === activeId ? 1000 : 0}
          eventHandlers={{
            click: () => onSelect(club.id),
            keypress: () => onSelect(club.id),
          }}
        />
      ))}
    </MapContainer>
  );
}
