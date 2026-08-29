"use client";

// Kort over klubber. Leaflet med OpenStreetMap-fliser — ingen API-nøgle,
// ingen betalingsgrænse. Kortet indlæses kun i browseren (dynamisk import
// i ClubMap.tsx), fordi Leaflet kræver adgang til window.

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapClub = {
  slug: string;
  name: string;
  city: string;
  address: string | null;
  latitude: number;
  longitude: number;
  priceHour: number;
  courtCount: number;
  color: string;
  rating: { average: number; count: number };
};

/** Markør i klubbens egen farve, så kortet ikke bare er blå dråber. */
function marker(color: string) {
  return L.divIcon({
    className: "",
    html: `<span style="
      display:block;width:22px;height:22px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);background:${color};
      border:2px solid #FAF7F0;box-shadow:0 1px 4px rgba(0,0,0,.4);
    "></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -20],
  });
}

/** Zoomer ud, så alle klubber er synlige. */
function FitBounds({ clubs }: { clubs: MapClub[] }) {
  const map = useMap();
  useEffect(() => {
    if (clubs.length === 0) return;
    if (clubs.length === 1) {
      map.setView([clubs[0].latitude, clubs[0].longitude], 13);
      return;
    }
    map.fitBounds(
      L.latLngBounds(clubs.map((c) => [c.latitude, c.longitude] as [number, number])),
      { padding: [40, 40] }
    );
  }, [clubs, map]);
  return null;
}

export default function ClubMapView({ clubs }: { clubs: MapClub[] }) {
  const center = useMemo<[number, number]>(() => {
    if (clubs.length === 0) return [56.0, 10.6]; // Danmark
    return [clubs[0].latitude, clubs[0].longitude];
  }, [clubs]);

  return (
    <MapContainer
      center={center}
      zoom={11}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds clubs={clubs} />

      {clubs.map((club) => (
        <Marker
          key={club.slug}
          position={[club.latitude, club.longitude]}
          icon={marker(club.color)}
        >
          <Popup>
            <strong style={{ fontSize: 14 }}>{club.name}</strong>
            <br />
            {club.address ? `${club.address}, ` : ""}
            {club.city}
            <br />
            {club.courtCount} baner · fra {club.priceHour} kr/time
            {club.rating.count > 0 && (
              <>
                <br />
                <span style={{ color: "#B4491E" }}>
                  {"★".repeat(Math.round(club.rating.average))}
                </span>{" "}
                {club.rating.average.toFixed(1)} ({club.rating.count})
              </>
            )}
            <br />
            <a
              href={`/klub/${club.slug}`}
              style={{ color: "#B4491E", fontWeight: 700 }}
            >
              Se ledige tider →
            </a>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
