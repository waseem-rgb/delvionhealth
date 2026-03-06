"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export interface TerritoryCity {
  city: string;
  lat: number;
  lng: number;
  referralCount: number;
  revenue: number;
  doctorCount: number;
}

interface TerritoryMapProps {
  cities: TerritoryCity[];
}

function getRevenueColor(revenue: number): string {
  if (revenue >= 500000) return "#10B981"; // green
  if (revenue >= 100000) return "#F59E0B"; // amber
  return "#3B82F6"; // blue
}

export default function TerritoryMap({ cities }: TerritoryMapProps) {
  return (
    <div>
      <MapContainer
        center={[20.5937, 78.9629]}
        zoom={5}
        style={{ height: "500px", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {cities.map((city) => {
          const radius = Math.max(8, Math.log(city.referralCount + 1) * 8);
          const color = getRevenueColor(city.revenue);
          return (
            <CircleMarker
              key={city.city}
              center={[city.lat, city.lng]}
              radius={radius}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.7,
                weight: 2,
              }}
            >
              <Tooltip>
                <div className="text-sm">
                  <strong>{city.city}</strong>
                  <br />
                  {city.referralCount} referrals
                  <br />
                  {city.doctorCount} doctors
                  <br />
                  ₹{city.revenue.toLocaleString()}
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 px-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Revenue:</p>
        {[
          { color: "#3B82F6", label: "Low (< ₹1L)" },
          { color: "#F59E0B", label: "Medium (₹1L – ₹5L)" },
          { color: "#10B981", label: "High (≥ ₹5L)" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <circle cx="7" cy="7" r="6" fill={color} opacity="0.8" />
            </svg>
            <span className="text-xs text-slate-600">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
