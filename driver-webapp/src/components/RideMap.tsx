/**
 * RideMap — interactive Leaflet map for ride tracking.
 *
 * Props:
 *   pickupLat / pickupLng  — pickup pin (green)
 *   dropoffLat / dropoffLng — dropoff pin (red)
 *   driverLat / driverLng  — optional live driver pin (yellow taxi, updates in real-time)
 *   height                  — CSS height string (default "260px")
 */
import { useEffect, useRef } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix webpack/vite default icon path issue
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Custom colored circle icons
function makeIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:22px;height:22px;border-radius:50%;
      background:${color};border:3px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,.45);
    "></div>`,
    iconSize:   [22, 22],
    iconAnchor: [11, 11],
  })
}

const PICKUP_ICON  = makeIcon('#22c55e')  // green
const DROPOFF_ICON = makeIcon('#ef4444')  // red
const DRIVER_ICON  = makeIcon('#FFD700')  // taxi yellow

// ── sub-component: recenter + move driver marker without remounting ──────────
function LiveDriver({
  lat,
  lng,
}: {
  lat: number
  lng: number
}) {
  const markerRef = useRef<L.Marker | null>(null)

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng])
    }
  }, [lat, lng])

  return (
    <Marker
      position={[lat, lng]}
      icon={DRIVER_ICON}
      ref={markerRef}
    >
      <Popup>🚖 Driver</Popup>
    </Marker>
  )
}

// ── sub-component: fit map bounds to all visible pins ────────────────────────
function FitBounds({
  points,
}: {
  points: [number, number][]
}) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 14)
      return
    }
    const bounds = L.latLngBounds(points)
    map.fitBounds(bounds, { padding: [40, 40] })
  }, [map, JSON.stringify(points)]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

// ── Main component ───────────────────────────────────────────────────────────
interface RideMapProps {
  pickupLat:  number
  pickupLng:  number
  dropoffLat: number
  dropoffLng: number
  driverLat?: number | null
  driverLng?: number | null
  height?:    string
}

export default function RideMap({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  driverLat,
  driverLng,
  height = '260px',
}: RideMapProps) {
  const center: [number, number] = [pickupLat, pickupLng]

  const fitPoints: [number, number][] = [
    [pickupLat,  pickupLng],
    [dropoffLat, dropoffLng],
  ]
  if (driverLat != null && driverLng != null) {
    fitPoints.push([driverLat, driverLng])
  }

  return (
    <div
      style={{
        height,
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        border: '1px solid var(--border)',
        marginBottom: '1rem',
      }}
    >
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© <a href="https://osm.org/copyright">OpenStreetMap</a>'
        />

        <FitBounds points={fitPoints} />

        {/* Pickup */}
        <Marker position={[pickupLat, pickupLng]} icon={PICKUP_ICON}>
          <Popup>📍 Pickup</Popup>
        </Marker>

        {/* Dropoff */}
        <Marker position={[dropoffLat, dropoffLng]} icon={DROPOFF_ICON}>
          <Popup>🏁 Dropoff</Popup>
        </Marker>

        {/* Driver (live) */}
        {driverLat != null && driverLng != null && (
          <LiveDriver lat={driverLat} lng={driverLng} />
        )}
      </MapContainer>
    </div>
  )
}
