import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../services/api'
import type { FareEstimate, RideRequest } from '../types'
import SurgeIndicator from '../components/SurgeIndicator'

// Default to Tel Aviv center
const DEFAULT_COORDS = { lat: 32.0853, lng: 34.7818 }

const TOS_KEY = 'easytaxi_tos_v1'

// ─── Terms of Service Modal ─────────────────────────────────────────────────
function TosModal({ onAccept }: { onAccept: () => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  function handleScroll() {
    const el = bodyRef.current
    if (!el) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) setScrolled(true)
  }

  function handleAccept() {
    setAccepted(true)
    setTimeout(onAccept, 650)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,.82)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      animation: 'tosIn .35s cubic-bezier(.22,1,.36,1)',
    }}>
      <style>{`
        @keyframes tosIn { from { opacity:0; transform:translateY(60px) } to { opacity:1; transform:none } }
        @keyframes checkPop { 0%{transform:scale(0) rotate(-20deg)} 60%{transform:scale(1.2) rotate(5deg)} 100%{transform:scale(1) rotate(0)} }
        .tos-scroll::-webkit-scrollbar { width: 4px }
        .tos-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,.04) }
        .tos-scroll::-webkit-scrollbar-thumb { background: rgba(255,215,0,.25); border-radius:2px }
      `}</style>

      <div style={{
        width: '100%', maxWidth: 540,
        background: 'linear-gradient(180deg,#111827 0%,#0f172a 100%)',
        border: '1px solid rgba(255,215,0,.18)',
        borderRadius: '24px 24px 0 0',
        maxHeight: '88dvh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 -20px 60px rgba(0,0,0,.7), 0 0 0 1px rgba(255,215,0,.08)',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          background: 'linear-gradient(135deg,rgba(255,215,0,.1),rgba(255,215,0,.03))',
          borderBottom: '1px solid rgba(255,215,0,.1)',
          flexShrink: 0,
        }}>
          <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,.15)', borderRadius: 2, margin: '0 auto 14px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, direction: 'rtl' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg,#F59E0B,#D97706)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.3rem', flexShrink: 0,
              boxShadow: '0 4px 12px rgba(245,158,11,.4)',
            }}>📋</div>
            <div>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#F1F5F9' }}>תנאי שימוש</div>
              <div style={{ fontSize: '.75rem', color: '#94A3B8', marginTop: 2 }}>Terms of Service · EasyTaxi Israel</div>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div
          ref={bodyRef}
          className="tos-scroll"
          onScroll={handleScroll}
          style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', direction: 'rtl', lineHeight: 1.7, color: '#CBD5E1', fontSize: '.88rem' }}
        >
          <Section title="1. קבלת התנאים">
            השימוש בשירות EasyTaxi Israel ("האפליקציה") מהווה הסכמה מלאה לתנאי שימוש אלו. אם אינך מסכים, אנא הפסק את השימוש מיידית.
          </Section>
          <Section title="2. הגדרת השירות">
            EasyTaxi Israel מספקת פלטפורמה לחיבור בין נוסעים לנהגי מונית מורשים. אנו אינו ספקי תחבורה ישירים. הנסיעות מתבצעות על ידי נהגים עצמאיים בעלי רישיון תקף.
          </Section>
          <Section title="3. כשירות משתמש">
            עליך להיות בן 18 ומעלה. אחריותך לספק מידע מדויק ועדכני. חל איסור מוחלט על שימוש לרעה, הונאה, או פגיעה בנהגים ומשתמשים אחרים.
          </Section>
          <Section title="4. תשלומים וחיוב">
            המחיר מחושב לפי מונה דיגיטלי + מרחק. תתכן תוספת עבור ביקוש גבוה (Surge). החיוב מתבצע בסיום הנסיעה. אין עמלה נסתרת — המחיר שסוכם הוא הסופי.
          </Section>
          <Section title="5. ביטול ואי-הגעה">
            ביטול עד 2 דקות ממועד האישור — ללא חיוב. לאחר מכן עשוי לחול דמי ביטול. אי-הגעה של הנוסע תגרור קנס בהתאם למדיניות.
          </Section>
          <Section title="6. פרטיות ומיקום">
            אנו אוספים נתוני מיקום בזמן הנסיעה לצורך מעקב ובטיחות. לא נשתף נתוניך עם צד שלישי ללא הסכמתך, למעט גורמי חוק. לעיון במדיניות פרטיות מלאה: easytaxiisrael.com/privacy
          </Section>
          <Section title="7. הגבלת אחריות">
            EasyTaxi Israel אינה אחראית לנזקים עקיפים, עיכובים או תאונות שאירעו במהלך הנסיעה. הנהג הוא הצד האחראי לנסיעה בטוחה ובהתאם לחוק.
          </Section>
          <Section title="8. שינויים בתנאים">
            אנו שומרים לעצמנו את הזכות לעדכן תנאים אלו בכל עת. המשך שימוש לאחר עדכון מהווה הסכמה לתנאים החדשים. עדכונים מהותיים יימסרו בהודעה מוקדמת.
          </Section>

          {/* English summary */}
          <div style={{
            marginTop: 20, padding: '14px 16px',
            background: 'rgba(255,215,0,.05)', border: '1px solid rgba(255,215,0,.12)',
            borderRadius: 10, direction: 'ltr', fontSize: '.78rem', color: '#94A3B8',
          }}>
            <div style={{ fontWeight: 700, color: '#F59E0B', marginBottom: 6, fontSize: '.82rem' }}>Summary (English)</div>
            By accepting, you agree to use EasyTaxi Israel responsibly, pay for completed rides, provide accurate information, and acknowledge that EasyTaxi connects passengers with independent licensed drivers. Your location data is used solely for the ride experience.
          </div>

          {/* Scroll hint */}
          {!scrolled && (
            <div style={{ textAlign: 'center', marginTop: 16, color: '#94A3B8', fontSize: '.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span style={{ animation: 'tosIn 1s ease infinite alternate' }}>↓</span> גלול לקרוא הכל
            </div>
          )}

          <div style={{ height: 8 }} />
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px 20px',
          borderTop: '1px solid rgba(255,255,255,.07)',
          background: 'rgba(0,0,0,.3)',
          flexShrink: 0,
        }}>
          {accepted ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '14px', borderRadius: 14,
              background: 'linear-gradient(135deg,rgba(34,197,94,.15),rgba(34,197,94,.05))',
              border: '1px solid rgba(34,197,94,.3)',
              color: '#22C55E', fontWeight: 800, fontSize: '1rem',
            }}>
              <span style={{ fontSize: '1.4rem', animation: 'checkPop .5s ease' }}>✅</span>
              אישרת את תנאי השימוש — תודה!
            </div>
          ) : (
            <>
              <button
                onClick={handleAccept}
                style={{
                  width: '100%', padding: '15px', marginBottom: 10,
                  background: scrolled
                    ? 'linear-gradient(135deg,#F59E0B,#D97706)'
                    : 'rgba(255,215,0,.15)',
                  border: scrolled ? 'none' : '1px solid rgba(255,215,0,.2)',
                  borderRadius: 14, color: scrolled ? '#0F172A' : '#94A3B8',
                  fontWeight: 800, fontSize: '1rem',
                  cursor: scrolled ? 'pointer' : 'default',
                  transition: 'all .3s',
                  boxShadow: scrolled ? '0 4px 20px rgba(245,158,11,.4)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {scrolled ? '✅ אני מסכים/ה לתנאי השימוש' : '⟵ קרא את התנאים עד הסוף'}
              </button>
              <div style={{ textAlign: 'center', fontSize: '.72rem', color: '#475569', marginTop: 4 }}>
                לא ניתן להזמין נסיעה ללא אישור תנאי השימוש
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 700, color: '#F59E0B', marginBottom: 4, fontSize: '.85rem' }}>{title}</div>
      <div>{children}</div>
    </div>
  )
}

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
}

function shortAddress(displayName: string) {
  const parts = displayName.split(', ')
  return parts.slice(0, 3).join(', ')
}

export default function RequestRide() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [tosAccepted, setTosAccepted] = useState(() => localStorage.getItem(TOS_KEY) === '1')
  // Modal always shows on load if not accepted, and whenever user tries to book
  const [showTos, setShowTos] = useState(() => localStorage.getItem(TOS_KEY) !== '1')

  function acceptTos() {
    localStorage.setItem(TOS_KEY, '1')
    setTosAccepted(true)
    setShowTos(false)
  }

  const [pickup, setPickup] = useState({ lat: DEFAULT_COORDS.lat, lng: DEFAULT_COORDS.lng })
  const [dropoff, setDropoff] = useState({ lat: 32.0700, lng: 34.7900 })
  const [pickupAddress, setPickupAddress] = useState('')
  const [dropoffAddress, setDropoffAddress] = useState('')
  const [pickupSuggestions, setPickupSuggestions] = useState<NominatimResult[]>([])
  const [dropoffSuggestions, setDropoffSuggestions] = useState<NominatimResult[]>([])
  const [activeField, setActiveField] = useState<'pickup' | 'dropoff' | null>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fare = null as FareEstimate | null
  const [surge, setSurge] = useState<{ surge_multiplier: string; demand_level: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)

  // Detect user location + reverse geocode for pickup address
  useEffect(() => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setPickup({ lat, lng })
        setLocating(false)
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=he`,
            { headers: { 'User-Agent': 'EasyTaxiIsrael/1.0' } }
          )
          const data = await r.json()
          if (data.display_name) setPickupAddress(shortAddress(data.display_name))
        } catch { /* keep empty */ }
      },
      () => setLocating(false)
    )
  }, [])

  // Load surge info
  useEffect(() => {
    api.ai.intelligence().then(setSurge).catch(() => {})
  }, [])

  const searchAddress = useCallback(async (q: string, field: 'pickup' | 'dropoff') => {
    if (q.length < 2) {
      if (field === 'pickup') setPickupSuggestions([])
      else setDropoffSuggestions([])
      return
    }
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=il&limit=5&accept-language=he`,
        { headers: { 'User-Agent': 'EasyTaxiIsrael/1.0' } }
      )
      const data: NominatimResult[] = await r.json()
      if (field === 'pickup') setPickupSuggestions(data)
      else setDropoffSuggestions(data)
    } catch { /* ignore */ }
  }, [])

  function handleAddressChange(q: string, field: 'pickup' | 'dropoff') {
    if (field === 'pickup') setPickupAddress(q)
    else setDropoffAddress(q)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => searchAddress(q, field), 400)
  }

  function selectAddress(r: NominatimResult, field: 'pickup' | 'dropoff') {
    const lat = parseFloat(r.lat)
    const lng = parseFloat(r.lon)
    const name = shortAddress(r.display_name)
    if (field === 'pickup') {
      setPickup({ lat, lng }); setPickupAddress(name); setPickupSuggestions([])
    } else {
      setDropoff({ lat, lng }); setDropoffAddress(name); setDropoffSuggestions([])
    }
    setActiveField(null)
  }

  async function requestRide() {
    const req: RideRequest = { pickup_lat: pickup.lat, pickup_lng: pickup.lng, dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng }
    setBusy(true); setError(null)
    try {
      const ride = await api.rides.request(req)
      navigate(`/ride/${ride.id}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ direction: 'rtl', display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg-primary)', overflow: 'hidden' }}>

      {/* ToS Modal */}
      {showTos && (
        <TosModal
          onAccept={acceptTos}
        />
      )}

      {/* ── Topbar ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '.75rem 1rem', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)', flexShrink: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontWeight: 900, fontSize: '1.1rem' }}>
          <span>🚕</span>
          <span style={{ color: 'var(--accent)' }}>Easy</span>Taxi
        </div>
        <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center' }}>
          <span style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>{user?.phone}</span>
          {/* ToS status chip */}
          <button
            onClick={() => !tosAccepted && setShowTos(true)}
            title={tosAccepted ? 'תנאי שימוש אושרו' : 'לחץ לאישור תנאי שימוש'}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 20,
              background: tosAccepted ? 'rgba(34,197,94,.12)' : 'rgba(245,158,11,.15)',
              border: `1px solid ${tosAccepted ? 'rgba(34,197,94,.3)' : 'rgba(245,158,11,.4)'}`,
              color: tosAccepted ? '#22C55E' : '#F59E0B',
              fontSize: '.68rem', fontWeight: 700, cursor: tosAccepted ? 'default' : 'pointer',
              transition: 'all .2s',
            }}
          >
            {tosAccepted ? '✅' : '⚠️'}
            <span style={{ display: window.innerWidth > 360 ? 'inline' : 'none' }}>
              {tosAccepted ? 'תנאים אושרו' : 'ללא אישור'}
            </span>
          </button>
          <button
            style={{ fontSize: '.75rem', color: 'var(--text-secondary)', padding: '.25rem .5rem', border: '1px solid var(--border)', borderRadius: 6 }}
            onClick={() => navigate('/app/profile')}
          >
            👤
          </button>
          <button
            style={{ fontSize: '.75rem', color: 'var(--text-secondary)', padding: '.25rem .5rem', border: '1px solid var(--border)', borderRadius: 6 }}
            onClick={() => { logout(); navigate('/login') }}
          >
            יציאה
          </button>
        </div>
      </div>

      {/* ── Map (70% of remaining height) ── */}
      <div
        className="map-fullscreen"
        style={{ flex: '0 0 38vh', minHeight: 180, position: 'relative' }}
      >
        {/* Map background grid pattern */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `
            linear-gradient(rgba(255,215,0,.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,215,0,.03) 1px, transparent 1px),
            linear-gradient(180deg, #1a2a1a 0%, #1e2e1e 100%)
          `,
          backgroundSize: '40px 40px, 40px 40px, 100% 100%',
        }} />
        {/* Searching ripple animation */}
        <div style={{
          position: 'absolute', top: '45%', left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}>
          {/* Ripple rings */}
          {[0, 0.5, 1].map(delay => (
            <div key={delay} style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 60, height: 60,
              borderRadius: '50%',
              border: '2px solid rgba(255,215,0,0.5)',
              animation: `ripple 2s ease-out ${delay}s infinite`,
            }} />
          ))}
          <div style={{ position: 'relative', fontSize: '2.5rem', filter: 'drop-shadow(0 0 12px rgba(255,215,0,.6))' }} className="taxi-bounce">🚕</div>
        </div>
        {/* Location pin */}
        <div style={{
          position: 'absolute', bottom: '30%', left: '55%',
          transform: 'translate(-50%, 0)',
          fontSize: '1.75rem',
          filter: 'drop-shadow(0 2px 8px rgba(0,0,0,.8))',
        }}>📍</div>
        {/* Surge badge overlay — only show when multiplier is a valid number > 1 */}
        {surge && !isNaN(parseFloat(surge.surge_multiplier)) && parseFloat(surge.surge_multiplier) > 1 && (
          <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
            <SurgeIndicator surge={surge} />
          </div>
        )}
        {/* Locating indicator */}
        {locating && (
          <div style={{
            position: 'absolute', bottom: '1rem', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(26,26,26,.85)', color: 'var(--accent)',
            padding: '.4rem .9rem', borderRadius: 20, fontSize: '.8rem', fontWeight: 600,
            backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: '.5rem',
          }}>
            <span className="spinner" style={{ width: 12, height: 12, border: '2px solid var(--accent)', borderTopColor: 'transparent' }} />
            מאתר מיקום…
          </div>
        )}
        {/* Map label */}
        <div style={{
          position: 'absolute', bottom: '1rem', right: '1rem',
          fontSize: '.7rem', color: 'rgba(255,255,255,.3)',
        }}>
          {pickup.lat.toFixed(4)}, {pickup.lng.toFixed(4)}
        </div>
      </div>

      {/* ── Bottom sheet (booking panel) ── */}
      <div
        style={{
          flex: 1, background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border)',
          borderRadius: '20px 20px 0 0',
          padding: '1rem',
          overflowY: 'auto',
          marginTop: -16,
          boxShadow: '0 -4px 20px rgba(0,0,0,.4)',
          zIndex: 10,
        }}
        onClick={() => setActiveField(null)}
      >
        {/* Drag handle */}
        <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto .75rem' }} />

        {/* Pickup address */}
        <div style={{ position: 'relative', marginBottom: '.65rem' }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: '.7rem', color: 'var(--text-secondary)', marginBottom: '.25rem', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
            📍 <span>מאיפה?</span>
            {locating && <span style={{ color: 'var(--accent)', fontSize: '.65rem' }}>(מאתר…)</span>}
          </div>
          <input
            className="input"
            type="text"
            value={pickupAddress}
            onChange={e => handleAddressChange(e.target.value, 'pickup')}
            onFocus={() => setActiveField('pickup')}
            placeholder="כתובת איסוף…"
            style={{ width: '100%', fontSize: '.9rem', padding: '.6rem .75rem' }}
          />
          {activeField === 'pickup' && pickupSuggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, left: 0, zIndex: 50,
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,.5)',
              overflow: 'hidden', maxHeight: 220, overflowY: 'auto',
            }}>
              {pickupSuggestions.map(s => (
                <div
                  key={s.place_id}
                  onClick={() => selectAddress(s, 'pickup')}
                  style={{
                    padding: '.65rem .85rem', cursor: 'pointer', fontSize: '.82rem',
                    color: 'var(--text-primary)', borderBottom: '1px solid var(--border)',
                    lineHeight: 1.4,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,215,0,.07)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  📍 {shortAddress(s.display_name)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dropoff address */}
        <div style={{ position: 'relative', marginBottom: '.75rem' }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: '.7rem', color: 'var(--text-secondary)', marginBottom: '.25rem' }}>🏁 לאן?</div>
          <input
            className="input"
            type="text"
            value={dropoffAddress}
            onChange={e => handleAddressChange(e.target.value, 'dropoff')}
            onFocus={() => setActiveField('dropoff')}
            placeholder="הקלד יעד — עיר, רחוב, מקום…"
            style={{ width: '100%', fontSize: '.9rem', padding: '.6rem .75rem' }}
            autoComplete="off"
          />
          {activeField === 'dropoff' && dropoffSuggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, left: 0, zIndex: 50,
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,.5)',
              overflow: 'hidden', maxHeight: 220, overflowY: 'auto',
            }}>
              {dropoffSuggestions.map(s => (
                <div
                  key={s.place_id}
                  onClick={() => selectAddress(s, 'dropoff')}
                  style={{
                    padding: '.65rem .85rem', cursor: 'pointer', fontSize: '.82rem',
                    color: 'var(--text-primary)', borderBottom: '1px solid var(--border)',
                    lineHeight: 1.4,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,215,0,.07)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  🏁 {shortAddress(s.display_name)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Price Trust card */}
        {fare && (
          <div className="price-trust fade-in" style={{ marginBottom: '.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)', marginBottom: '.25rem' }}>מחיר סופי — ללא הפתעות</div>
                <div className="price-trust-total">₪{fare.total.toFixed(2)}</div>
              </div>
              <div style={{ textAlign: 'left', fontSize: '.8rem', color: 'var(--text-secondary)' }}>
                <div>{fare.distance_km.toFixed(1)} ק"מ</div>
                {surge && parseFloat(surge.surge_multiplier) > 1 && (
                  <div style={{ color: 'var(--accent)', fontWeight: 700 }}>⚡ Surge ×{surge.surge_multiplier}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div style={{ color: 'var(--danger)', marginBottom: '.75rem', fontSize: '.875rem', padding: '.5rem .75rem', background: 'rgba(239,68,68,.1)', borderRadius: 8 }}>{error}</div>
        )}

        {/* ToS warning banner — shown when not accepted */}
        {!tosAccepted && (
          <div style={{
            marginBottom: '.85rem', padding: '14px 16px',
            background: 'linear-gradient(135deg,rgba(245,158,11,.12),rgba(245,158,11,.06))',
            border: '1.5px solid rgba(245,158,11,.35)',
            borderRadius: 14,
            direction: 'rtl',
          }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                onChange={e => { if (e.target.checked) acceptTos() }}
                style={{ marginTop: 3, width: 18, height: 18, accentColor: '#F59E0B', flexShrink: 0 }}
              />
              <div>
                <div style={{ fontWeight: 700, color: '#F59E0B', fontSize: '.88rem', marginBottom: 2 }}>
                  קראתי ומסכים לתנאי השימוש
                </div>
                <div style={{ fontSize: '.75rem', color: '#94A3B8', lineHeight: 1.5 }}>
                  נדרשת הסכמה לפני הזמנת נסיעה.{' '}
                  <span
                    style={{ textDecoration: 'underline', cursor: 'pointer' }}
                    onClick={e => { e.preventDefault(); setShowTos(true) }}
                  >
                    קרא את התנאים
                  </span>
                </div>
              </div>
            </label>
          </div>
        )}

        {/* Main CTA */}
        <button
          className="btn btn-primary"
          style={{
            width: '100%', padding: '1rem', fontSize: '1.1rem', fontWeight: 800,
            borderRadius: 'var(--radius-lg)',
            opacity: tosAccepted ? 1 : 0.35,
            cursor: tosAccepted ? 'pointer' : 'not-allowed',
            filter: tosAccepted ? 'none' : 'grayscale(0.4)',
            transition: 'opacity .3s, filter .3s',
          }}
          disabled={busy}
          onClick={tosAccepted ? requestRide : () => setShowTos(true)}
        >
          {busy
            ? <><span className="spinner" style={{ width: 18, height: 18, border: '2px solid #1A1A1A', borderTopColor: 'transparent', marginLeft: '.5rem' }} />מחפש נהג…</>
            : tosAccepted ? '🚕 הזמן נסיעה עכשיו' : '🔒 נדרש אישור תנאי שימוש'}
        </button>

        {/* Ride type selector */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.5rem', marginTop: '.75rem' }}>
          {[
            { icon: '🚕', label: 'מונית', sublabel: 'מורשה' },
            { icon: '🚗', label: 'XL', sublabel: 'עד 6 נוסעים' },
            { icon: '♻️', label: 'ירוק', sublabel: 'חסכוני' },
          ].map((type, i) => (
            <button key={i} style={{
              padding: '.6rem .5rem', borderRadius: 'var(--radius-md)',
              background: i === 0 ? 'rgba(255,215,0,.12)' : 'var(--bg-elevated)',
              border: `1px solid ${i === 0 ? 'var(--accent)' : 'var(--border)'}`,
              color: i === 0 ? 'var(--accent)' : 'var(--text-secondary)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.25rem' }}>{type.icon}</div>
              <div style={{ fontSize: '.75rem', fontWeight: 700, marginTop: '.2rem' }}>{type.label}</div>
              <div style={{ fontSize: '.65rem', color: 'var(--text-secondary)' }}>{type.sublabel}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
