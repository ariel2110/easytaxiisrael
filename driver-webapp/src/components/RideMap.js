import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * RideMap — interactive Leaflet map for ride tracking.
 *
 * Props:
 *   pickupLat / pickupLng  — pickup pin (green)
 *   dropoffLat / dropoffLng — dropoff pin (red)
 *   driverLat / driverLng  — optional live driver pin (yellow taxi, updates in real-time)
 *   height                  — CSS height string (default "260px")
 */
import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// Fix webpack/vite default icon path issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});
// Custom colored circle icons
function makeIcon(color) {
    return L.divIcon({
        className: '',
        html: `<div style="
      width:22px;height:22px;border-radius:50%;
      background:${color};border:3px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,.45);
    "></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
    });
}
const PICKUP_ICON = makeIcon('#22c55e'); // green
const DROPOFF_ICON = makeIcon('#ef4444'); // red
const DRIVER_ICON = makeIcon('#FFD700'); // taxi yellow
// ── sub-component: recenter + move driver marker without remounting ──────────
function LiveDriver({ lat, lng, }) {
    const markerRef = useRef(null);
    useEffect(() => {
        if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
        }
    }, [lat, lng]);
    return (_jsx(Marker, { position: [lat, lng], icon: DRIVER_ICON, ref: markerRef, children: _jsx(Popup, { children: "\uD83D\uDE96 Driver" }) }));
}
// ── sub-component: fit map bounds to all visible pins ────────────────────────
function FitBounds({ points, }) {
    const map = useMap();
    useEffect(() => {
        if (points.length === 0)
            return;
        if (points.length === 1) {
            map.setView(points[0], 14);
            return;
        }
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [40, 40] });
    }, [map, JSON.stringify(points)]); // eslint-disable-line react-hooks/exhaustive-deps
    return null;
}
export default function RideMap({ pickupLat, pickupLng, dropoffLat, dropoffLng, driverLat, driverLng, height = '260px', }) {
    const center = [pickupLat, pickupLng];
    const fitPoints = [
        [pickupLat, pickupLng],
        [dropoffLat, dropoffLng],
    ];
    if (driverLat != null && driverLng != null) {
        fitPoints.push([driverLat, driverLng]);
    }
    return (_jsx("div", { style: {
            height,
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            border: '1px solid var(--border)',
            marginBottom: '1rem',
        }, children: _jsxs(MapContainer, { center: center, zoom: 13, style: { height: '100%', width: '100%' }, zoomControl: true, attributionControl: false, children: [_jsx(TileLayer, { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: '\u00A9 <a href="https://osm.org/copyright">OpenStreetMap</a>' }), _jsx(FitBounds, { points: fitPoints }), _jsx(Marker, { position: [pickupLat, pickupLng], icon: PICKUP_ICON, children: _jsx(Popup, { children: "\uD83D\uDCCD Pickup" }) }), _jsx(Marker, { position: [dropoffLat, dropoffLng], icon: DROPOFF_ICON, children: _jsx(Popup, { children: "\uD83C\uDFC1 Dropoff" }) }), driverLat != null && driverLng != null && (_jsx(LiveDriver, { lat: driverLat, lng: driverLng }))] }) }));
}
