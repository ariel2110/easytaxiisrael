import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import SurgeIndicator from '../components/SurgeIndicator';
// Default to Tel Aviv center
const DEFAULT_COORDS = { lat: 32.0853, lng: 34.7818 };
const TOS_KEY = 'easytaxi_tos_v1';
// ─── Terms of Service Modal ─────────────────────────────────────────────────
function TosModal({ onAccept, onClose }) {
    const [scrolled, setScrolled] = useState(false);
    const [accepted, setAccepted] = useState(false);
    const bodyRef = useRef(null);
    function handleScroll() {
        const el = bodyRef.current;
        if (!el)
            return;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20)
            setScrolled(true);
    }
    function handleAccept() {
        setAccepted(true);
        setTimeout(onAccept, 650);
    }
    return (_jsxs("div", { style: {
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,.82)', backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            animation: 'tosIn .35s cubic-bezier(.22,1,.36,1)',
        }, children: [_jsx("style", { children: `
        @keyframes tosIn { from { opacity:0; transform:translateY(60px) } to { opacity:1; transform:none } }
        @keyframes checkPop { 0%{transform:scale(0) rotate(-20deg)} 60%{transform:scale(1.2) rotate(5deg)} 100%{transform:scale(1) rotate(0)} }
        .tos-scroll::-webkit-scrollbar { width: 4px }
        .tos-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,.04) }
        .tos-scroll::-webkit-scrollbar-thumb { background: rgba(255,215,0,.25); border-radius:2px }
      ` }), _jsxs("div", { style: {
                    width: '100%', maxWidth: 540,
                    background: 'linear-gradient(180deg,#111827 0%,#0f172a 100%)',
                    border: '1px solid rgba(255,215,0,.18)',
                    borderRadius: '24px 24px 0 0',
                    maxHeight: '88dvh',
                    display: 'flex', flexDirection: 'column',
                    boxShadow: '0 -20px 60px rgba(0,0,0,.7), 0 0 0 1px rgba(255,215,0,.08)',
                    overflow: 'hidden',
                }, children: [_jsxs("div", { style: {
                            padding: '20px 24px 16px',
                            background: 'linear-gradient(135deg,rgba(255,215,0,.1),rgba(255,215,0,.03))',
                            borderBottom: '1px solid rgba(255,215,0,.1)',
                            flexShrink: 0,
                        }, children: [_jsx("div", { style: { width: 40, height: 4, background: 'rgba(255,255,255,.15)', borderRadius: 2, margin: '0 auto 14px' } }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12, direction: 'rtl' }, children: [_jsx("div", { style: {
                                            width: 44, height: 44, borderRadius: 12,
                                            background: 'linear-gradient(135deg,#F59E0B,#D97706)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1.3rem', flexShrink: 0,
                                            boxShadow: '0 4px 12px rgba(245,158,11,.4)',
                                        }, children: "\uD83D\uDCCB" }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: '1.15rem', fontWeight: 900, color: '#F1F5F9' }, children: "\u05EA\u05E0\u05D0\u05D9 \u05E9\u05D9\u05DE\u05D5\u05E9" }), _jsx("div", { style: { fontSize: '.75rem', color: '#94A3B8', marginTop: 2 }, children: "Terms of Service \u00B7 EasyTaxi Israel" })] })] })] }), _jsxs("div", { ref: bodyRef, className: "tos-scroll", onScroll: handleScroll, style: { flex: 1, overflowY: 'auto', padding: '20px 24px', direction: 'rtl', lineHeight: 1.7, color: '#CBD5E1', fontSize: '.88rem' }, children: [_jsx(Section, { title: "1. \u05E7\u05D1\u05DC\u05EA \u05D4\u05EA\u05E0\u05D0\u05D9\u05DD", children: "\u05D4\u05E9\u05D9\u05DE\u05D5\u05E9 \u05D1\u05E9\u05D9\u05E8\u05D5\u05EA EasyTaxi Israel (\"\u05D4\u05D0\u05E4\u05DC\u05D9\u05E7\u05E6\u05D9\u05D4\") \u05DE\u05D4\u05D5\u05D5\u05D4 \u05D4\u05E1\u05DB\u05DE\u05D4 \u05DE\u05DC\u05D0\u05D4 \u05DC\u05EA\u05E0\u05D0\u05D9 \u05E9\u05D9\u05DE\u05D5\u05E9 \u05D0\u05DC\u05D5. \u05D0\u05DD \u05D0\u05D9\u05E0\u05DA \u05DE\u05E1\u05DB\u05D9\u05DD, \u05D0\u05E0\u05D0 \u05D4\u05E4\u05E1\u05E7 \u05D0\u05EA \u05D4\u05E9\u05D9\u05DE\u05D5\u05E9 \u05DE\u05D9\u05D9\u05D3\u05D9\u05EA." }), _jsx(Section, { title: "2. \u05D4\u05D2\u05D3\u05E8\u05EA \u05D4\u05E9\u05D9\u05E8\u05D5\u05EA", children: "EasyTaxi Israel \u05DE\u05E1\u05E4\u05E7\u05EA \u05E4\u05DC\u05D8\u05E4\u05D5\u05E8\u05DE\u05D4 \u05DC\u05D7\u05D9\u05D1\u05D5\u05E8 \u05D1\u05D9\u05DF \u05E0\u05D5\u05E1\u05E2\u05D9\u05DD \u05DC\u05E0\u05D4\u05D2\u05D9 \u05DE\u05D5\u05E0\u05D9\u05EA \u05DE\u05D5\u05E8\u05E9\u05D9\u05DD. \u05D0\u05E0\u05D5 \u05D0\u05D9\u05E0\u05D5 \u05E1\u05E4\u05E7\u05D9 \u05EA\u05D7\u05D1\u05D5\u05E8\u05D4 \u05D9\u05E9\u05D9\u05E8\u05D9\u05DD. \u05D4\u05E0\u05E1\u05D9\u05E2\u05D5\u05EA \u05DE\u05EA\u05D1\u05E6\u05E2\u05D5\u05EA \u05E2\u05DC \u05D9\u05D3\u05D9 \u05E0\u05D4\u05D2\u05D9\u05DD \u05E2\u05E6\u05DE\u05D0\u05D9\u05D9\u05DD \u05D1\u05E2\u05DC\u05D9 \u05E8\u05D9\u05E9\u05D9\u05D5\u05DF \u05EA\u05E7\u05E3." }), _jsx(Section, { title: "3. \u05DB\u05E9\u05D9\u05E8\u05D5\u05EA \u05DE\u05E9\u05EA\u05DE\u05E9", children: "\u05E2\u05DC\u05D9\u05DA \u05DC\u05D4\u05D9\u05D5\u05EA \u05D1\u05DF 18 \u05D5\u05DE\u05E2\u05DC\u05D4. \u05D0\u05D7\u05E8\u05D9\u05D5\u05EA\u05DA \u05DC\u05E1\u05E4\u05E7 \u05DE\u05D9\u05D3\u05E2 \u05DE\u05D3\u05D5\u05D9\u05E7 \u05D5\u05E2\u05D3\u05DB\u05E0\u05D9. \u05D7\u05DC \u05D0\u05D9\u05E1\u05D5\u05E8 \u05DE\u05D5\u05D7\u05DC\u05D8 \u05E2\u05DC \u05E9\u05D9\u05DE\u05D5\u05E9 \u05DC\u05E8\u05E2\u05D4, \u05D4\u05D5\u05E0\u05D0\u05D4, \u05D0\u05D5 \u05E4\u05D2\u05D9\u05E2\u05D4 \u05D1\u05E0\u05D4\u05D2\u05D9\u05DD \u05D5\u05DE\u05E9\u05EA\u05DE\u05E9\u05D9\u05DD \u05D0\u05D7\u05E8\u05D9\u05DD." }), _jsx(Section, { title: "4. \u05EA\u05E9\u05DC\u05D5\u05DE\u05D9\u05DD \u05D5\u05D7\u05D9\u05D5\u05D1", children: "\u05D4\u05DE\u05D7\u05D9\u05E8 \u05DE\u05D7\u05D5\u05E9\u05D1 \u05DC\u05E4\u05D9 \u05DE\u05D5\u05E0\u05D4 \u05D3\u05D9\u05D2\u05D9\u05D8\u05DC\u05D9 + \u05DE\u05E8\u05D7\u05E7. \u05EA\u05EA\u05DB\u05DF \u05EA\u05D5\u05E1\u05E4\u05EA \u05E2\u05D1\u05D5\u05E8 \u05D1\u05D9\u05E7\u05D5\u05E9 \u05D2\u05D1\u05D5\u05D4 (Surge). \u05D4\u05D7\u05D9\u05D5\u05D1 \u05DE\u05EA\u05D1\u05E6\u05E2 \u05D1\u05E1\u05D9\u05D5\u05DD \u05D4\u05E0\u05E1\u05D9\u05E2\u05D4. \u05D0\u05D9\u05DF \u05E2\u05DE\u05DC\u05D4 \u05E0\u05E1\u05EA\u05E8\u05EA \u2014 \u05D4\u05DE\u05D7\u05D9\u05E8 \u05E9\u05E1\u05D5\u05DB\u05DD \u05D4\u05D5\u05D0 \u05D4\u05E1\u05D5\u05E4\u05D9." }), _jsx(Section, { title: "5. \u05D1\u05D9\u05D8\u05D5\u05DC \u05D5\u05D0\u05D9-\u05D4\u05D2\u05E2\u05D4", children: "\u05D1\u05D9\u05D8\u05D5\u05DC \u05E2\u05D3 2 \u05D3\u05E7\u05D5\u05EA \u05DE\u05DE\u05D5\u05E2\u05D3 \u05D4\u05D0\u05D9\u05E9\u05D5\u05E8 \u2014 \u05DC\u05DC\u05D0 \u05D7\u05D9\u05D5\u05D1. \u05DC\u05D0\u05D7\u05E8 \u05DE\u05DB\u05DF \u05E2\u05E9\u05D5\u05D9 \u05DC\u05D7\u05D5\u05DC \u05D3\u05DE\u05D9 \u05D1\u05D9\u05D8\u05D5\u05DC. \u05D0\u05D9-\u05D4\u05D2\u05E2\u05D4 \u05E9\u05DC \u05D4\u05E0\u05D5\u05E1\u05E2 \u05EA\u05D2\u05E8\u05D5\u05E8 \u05E7\u05E0\u05E1 \u05D1\u05D4\u05EA\u05D0\u05DD \u05DC\u05DE\u05D3\u05D9\u05E0\u05D9\u05D5\u05EA." }), _jsx(Section, { title: "6. \u05E4\u05E8\u05D8\u05D9\u05D5\u05EA \u05D5\u05DE\u05D9\u05E7\u05D5\u05DD", children: "\u05D0\u05E0\u05D5 \u05D0\u05D5\u05E1\u05E4\u05D9\u05DD \u05E0\u05EA\u05D5\u05E0\u05D9 \u05DE\u05D9\u05E7\u05D5\u05DD \u05D1\u05D6\u05DE\u05DF \u05D4\u05E0\u05E1\u05D9\u05E2\u05D4 \u05DC\u05E6\u05D5\u05E8\u05DA \u05DE\u05E2\u05E7\u05D1 \u05D5\u05D1\u05D8\u05D9\u05D7\u05D5\u05EA. \u05DC\u05D0 \u05E0\u05E9\u05EA\u05E3 \u05E0\u05EA\u05D5\u05E0\u05D9\u05DA \u05E2\u05DD \u05E6\u05D3 \u05E9\u05DC\u05D9\u05E9\u05D9 \u05DC\u05DC\u05D0 \u05D4\u05E1\u05DB\u05DE\u05EA\u05DA, \u05DC\u05DE\u05E2\u05D8 \u05D2\u05D5\u05E8\u05DE\u05D9 \u05D7\u05D5\u05E7. \u05DC\u05E2\u05D9\u05D5\u05DF \u05D1\u05DE\u05D3\u05D9\u05E0\u05D9\u05D5\u05EA \u05E4\u05E8\u05D8\u05D9\u05D5\u05EA \u05DE\u05DC\u05D0\u05D4: easytaxiisrael.com/privacy" }), _jsx(Section, { title: "7. \u05D4\u05D2\u05D1\u05DC\u05EA \u05D0\u05D7\u05E8\u05D9\u05D5\u05EA", children: "EasyTaxi Israel \u05D0\u05D9\u05E0\u05D4 \u05D0\u05D7\u05E8\u05D0\u05D9\u05EA \u05DC\u05E0\u05D6\u05E7\u05D9\u05DD \u05E2\u05E7\u05D9\u05E4\u05D9\u05DD, \u05E2\u05D9\u05DB\u05D5\u05D1\u05D9\u05DD \u05D0\u05D5 \u05EA\u05D0\u05D5\u05E0\u05D5\u05EA \u05E9\u05D0\u05D9\u05E8\u05E2\u05D5 \u05D1\u05DE\u05D4\u05DC\u05DA \u05D4\u05E0\u05E1\u05D9\u05E2\u05D4. \u05D4\u05E0\u05D4\u05D2 \u05D4\u05D5\u05D0 \u05D4\u05E6\u05D3 \u05D4\u05D0\u05D7\u05E8\u05D0\u05D9 \u05DC\u05E0\u05E1\u05D9\u05E2\u05D4 \u05D1\u05D8\u05D5\u05D7\u05D4 \u05D5\u05D1\u05D4\u05EA\u05D0\u05DD \u05DC\u05D7\u05D5\u05E7." }), _jsx(Section, { title: "8. \u05E9\u05D9\u05E0\u05D5\u05D9\u05D9\u05DD \u05D1\u05EA\u05E0\u05D0\u05D9\u05DD", children: "\u05D0\u05E0\u05D5 \u05E9\u05D5\u05DE\u05E8\u05D9\u05DD \u05DC\u05E2\u05E6\u05DE\u05E0\u05D5 \u05D0\u05EA \u05D4\u05D6\u05DB\u05D5\u05EA \u05DC\u05E2\u05D3\u05DB\u05DF \u05EA\u05E0\u05D0\u05D9\u05DD \u05D0\u05DC\u05D5 \u05D1\u05DB\u05DC \u05E2\u05EA. \u05D4\u05DE\u05E9\u05DA \u05E9\u05D9\u05DE\u05D5\u05E9 \u05DC\u05D0\u05D7\u05E8 \u05E2\u05D3\u05DB\u05D5\u05DF \u05DE\u05D4\u05D5\u05D5\u05D4 \u05D4\u05E1\u05DB\u05DE\u05D4 \u05DC\u05EA\u05E0\u05D0\u05D9\u05DD \u05D4\u05D7\u05D3\u05E9\u05D9\u05DD. \u05E2\u05D3\u05DB\u05D5\u05E0\u05D9\u05DD \u05DE\u05D4\u05D5\u05EA\u05D9\u05D9\u05DD \u05D9\u05D9\u05DE\u05E1\u05E8\u05D5 \u05D1\u05D4\u05D5\u05D3\u05E2\u05D4 \u05DE\u05D5\u05E7\u05D3\u05DE\u05EA." }), _jsxs("div", { style: {
                                    marginTop: 20, padding: '14px 16px',
                                    background: 'rgba(255,215,0,.05)', border: '1px solid rgba(255,215,0,.12)',
                                    borderRadius: 10, direction: 'ltr', fontSize: '.78rem', color: '#94A3B8',
                                }, children: [_jsx("div", { style: { fontWeight: 700, color: '#F59E0B', marginBottom: 6, fontSize: '.82rem' }, children: "Summary (English)" }), "By accepting, you agree to use EasyTaxi Israel responsibly, pay for completed rides, provide accurate information, and acknowledge that EasyTaxi connects passengers with independent licensed drivers. Your location data is used solely for the ride experience."] }), !scrolled && (_jsxs("div", { style: { textAlign: 'center', marginTop: 16, color: '#94A3B8', fontSize: '.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }, children: [_jsx("span", { style: { animation: 'tosIn 1s ease infinite alternate' }, children: "\u2193" }), " \u05D2\u05DC\u05D5\u05DC \u05DC\u05E7\u05E8\u05D5\u05D0 \u05D4\u05DB\u05DC"] })), _jsx("div", { style: { height: 8 } })] }), _jsx("div", { style: {
                            padding: '16px 24px 20px',
                            borderTop: '1px solid rgba(255,255,255,.07)',
                            background: 'rgba(0,0,0,.3)',
                            flexShrink: 0,
                        }, children: accepted ? (_jsxs("div", { style: {
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                padding: '14px', borderRadius: 14,
                                background: 'linear-gradient(135deg,rgba(34,197,94,.15),rgba(34,197,94,.05))',
                                border: '1px solid rgba(34,197,94,.3)',
                                color: '#22C55E', fontWeight: 800, fontSize: '1rem',
                            }, children: [_jsx("span", { style: { fontSize: '1.4rem', animation: 'checkPop .5s ease' }, children: "\u2705" }), "\u05D0\u05D9\u05E9\u05E8\u05EA \u05D0\u05EA \u05EA\u05E0\u05D0\u05D9 \u05D4\u05E9\u05D9\u05DE\u05D5\u05E9 \u2014 \u05EA\u05D5\u05D3\u05D4!"] })) : (_jsxs(_Fragment, { children: [_jsx("button", { onClick: handleAccept, style: {
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
                                    }, children: scrolled ? '✅ אני מסכים/ה לתנאי השימוש' : '⟵ קרא את התנאים עד הסוף' }), _jsx("button", { onClick: onClose, style: {
                                        width: '100%', padding: '11px',
                                        background: 'transparent', border: '1px solid rgba(255,255,255,.08)',
                                        borderRadius: 12, color: '#64748B', fontWeight: 600, fontSize: '.88rem',
                                        cursor: 'pointer',
                                    }, children: "\u05E1\u05D2\u05D5\u05E8 \u2014 \u05D0\u05D7\u05E8 \u05DB\u05DA" })] })) })] })] }));
}
function Section({ title, children }) {
    return (_jsxs("div", { style: { marginBottom: 16 }, children: [_jsx("div", { style: { fontWeight: 700, color: '#F59E0B', marginBottom: 4, fontSize: '.85rem' }, children: title }), _jsx("div", { children: children })] }));
}
function shortAddress(displayName) {
    const parts = displayName.split(', ');
    return parts.slice(0, 3).join(', ');
}
export default function RequestRide() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [tosAccepted, setTosAccepted] = useState(() => localStorage.getItem(TOS_KEY) === '1');
    const [showTos, setShowTos] = useState(() => localStorage.getItem(TOS_KEY) !== '1');
    function acceptTos() {
        localStorage.setItem(TOS_KEY, '1');
        setTosAccepted(true);
        setShowTos(false);
    }
    const [pickup, setPickup] = useState({ lat: DEFAULT_COORDS.lat, lng: DEFAULT_COORDS.lng });
    const [dropoff, setDropoff] = useState({ lat: 32.0700, lng: 34.7900 });
    const [pickupAddress, setPickupAddress] = useState('');
    const [dropoffAddress, setDropoffAddress] = useState('');
    const [pickupSuggestions, setPickupSuggestions] = useState([]);
    const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
    const [activeField, setActiveField] = useState(null);
    const searchTimeout = useRef(null);
    const fare = null;
    const [surge, setSurge] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [locating, setLocating] = useState(false);
    // Detect user location + reverse geocode for pickup address
    useEffect(() => {
        if (!navigator.geolocation)
            return;
        setLocating(true);
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const { latitude: lat, longitude: lng } = pos.coords;
            setPickup({ lat, lng });
            setLocating(false);
            try {
                const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=he`, { headers: { 'User-Agent': 'EasyTaxiIsrael/1.0' } });
                const data = await r.json();
                if (data.display_name)
                    setPickupAddress(shortAddress(data.display_name));
            }
            catch { /* keep empty */ }
        }, () => setLocating(false));
    }, []);
    // Load surge info
    useEffect(() => {
        api.ai.intelligence().then(setSurge).catch(() => { });
    }, []);
    const searchAddress = useCallback(async (q, field) => {
        if (q.length < 2) {
            if (field === 'pickup')
                setPickupSuggestions([]);
            else
                setDropoffSuggestions([]);
            return;
        }
        try {
            const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=il&limit=5&accept-language=he`, { headers: { 'User-Agent': 'EasyTaxiIsrael/1.0' } });
            const data = await r.json();
            if (field === 'pickup')
                setPickupSuggestions(data);
            else
                setDropoffSuggestions(data);
        }
        catch { /* ignore */ }
    }, []);
    function handleAddressChange(q, field) {
        if (field === 'pickup')
            setPickupAddress(q);
        else
            setDropoffAddress(q);
        if (searchTimeout.current)
            clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => searchAddress(q, field), 400);
    }
    function selectAddress(r, field) {
        const lat = parseFloat(r.lat);
        const lng = parseFloat(r.lon);
        const name = shortAddress(r.display_name);
        if (field === 'pickup') {
            setPickup({ lat, lng });
            setPickupAddress(name);
            setPickupSuggestions([]);
        }
        else {
            setDropoff({ lat, lng });
            setDropoffAddress(name);
            setDropoffSuggestions([]);
        }
        setActiveField(null);
    }
    async function requestRide() {
        const req = { pickup_lat: pickup.lat, pickup_lng: pickup.lng, dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng };
        setBusy(true);
        setError(null);
        try {
            const ride = await api.rides.request(req);
            navigate(`/ride/${ride.id}`);
        }
        catch (e) {
            setError(e.message);
        }
        finally {
            setBusy(false);
        }
    }
    return (_jsxs("div", { style: { direction: 'rtl', display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg-primary)', overflow: 'hidden' }, children: [showTos && (_jsx(TosModal, { onAccept: acceptTos, onClose: () => setShowTos(false) })), _jsxs("div", { style: {
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '.75rem 1rem', borderBottom: '1px solid var(--border)',
                    background: 'var(--bg-surface)', flexShrink: 0, zIndex: 10,
                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: '.5rem', fontWeight: 900, fontSize: '1.1rem' }, children: [_jsx("span", { children: "\uD83D\uDE95" }), _jsx("span", { style: { color: 'var(--accent)' }, children: "Easy" }), "Taxi"] }), _jsxs("div", { style: { display: 'flex', gap: '.75rem', alignItems: 'center' }, children: [_jsx("span", { style: { fontSize: '.75rem', color: 'var(--text-secondary)' }, children: user?.phone }), _jsxs("button", { onClick: () => !tosAccepted && setShowTos(true), title: tosAccepted ? 'תנאי שימוש אושרו' : 'לחץ לאישור תנאי שימוש', style: {
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    padding: '3px 8px', borderRadius: 20,
                                    background: tosAccepted ? 'rgba(34,197,94,.12)' : 'rgba(245,158,11,.15)',
                                    border: `1px solid ${tosAccepted ? 'rgba(34,197,94,.3)' : 'rgba(245,158,11,.4)'}`,
                                    color: tosAccepted ? '#22C55E' : '#F59E0B',
                                    fontSize: '.68rem', fontWeight: 700, cursor: tosAccepted ? 'default' : 'pointer',
                                    transition: 'all .2s',
                                }, children: [tosAccepted ? '✅' : '⚠️', _jsx("span", { style: { display: window.innerWidth > 360 ? 'inline' : 'none' }, children: tosAccepted ? 'תנאים אושרו' : 'ללא אישור' })] }), _jsx("button", { style: { fontSize: '.75rem', color: 'var(--text-secondary)', padding: '.25rem .5rem', border: '1px solid var(--border)', borderRadius: 6 }, onClick: () => navigate('/app/profile'), children: "\uD83D\uDC64" }), _jsx("button", { style: { fontSize: '.75rem', color: 'var(--text-secondary)', padding: '.25rem .5rem', border: '1px solid var(--border)', borderRadius: 6 }, onClick: () => { logout(); navigate('/login'); }, children: "\u05D9\u05E6\u05D9\u05D0\u05D4" })] })] }), _jsxs("div", { className: "map-fullscreen", style: { flex: '0 0 65vh', position: 'relative' }, children: [_jsx("div", { style: {
                            position: 'absolute', inset: 0,
                            background: `
            linear-gradient(rgba(255,215,0,.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,215,0,.03) 1px, transparent 1px),
            linear-gradient(180deg, #1a2a1a 0%, #1e2e1e 100%)
          `,
                            backgroundSize: '40px 40px, 40px 40px, 100% 100%',
                        } }), _jsx("div", { style: {
                            position: 'absolute', top: '38%', left: '50%',
                            transform: 'translate(-50%, -50%)',
                            textAlign: 'center',
                        }, children: _jsx("div", { style: { fontSize: '2.5rem', filter: 'drop-shadow(0 0 12px rgba(255,215,0,.6))' }, className: "taxi-bounce", children: "\uD83D\uDE95" }) }), _jsx("div", { style: {
                            position: 'absolute', bottom: '30%', left: '55%',
                            transform: 'translate(-50%, 0)',
                            fontSize: '1.75rem',
                            filter: 'drop-shadow(0 2px 8px rgba(0,0,0,.8))',
                        }, children: "\uD83D\uDCCD" }), surge && (_jsx("div", { style: { position: 'absolute', top: '1rem', right: '1rem' }, children: _jsx(SurgeIndicator, { surge: surge }) })), locating && (_jsxs("div", { style: {
                            position: 'absolute', bottom: '1rem', left: '50%', transform: 'translateX(-50%)',
                            background: 'rgba(26,26,26,.85)', color: 'var(--accent)',
                            padding: '.4rem .9rem', borderRadius: 20, fontSize: '.8rem', fontWeight: 600,
                            backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: '.5rem',
                        }, children: [_jsx("span", { className: "spinner", style: { width: 12, height: 12, border: '2px solid var(--accent)', borderTopColor: 'transparent' } }), "\u05DE\u05D0\u05EA\u05E8 \u05DE\u05D9\u05E7\u05D5\u05DD\u2026"] })), _jsxs("div", { style: {
                            position: 'absolute', bottom: '1rem', right: '1rem',
                            fontSize: '.7rem', color: 'rgba(255,255,255,.3)',
                        }, children: [pickup.lat.toFixed(4), ", ", pickup.lng.toFixed(4)] })] }), _jsxs("div", { style: {
                    flex: 1, background: 'var(--bg-surface)',
                    borderTop: '1px solid var(--border)',
                    borderRadius: '20px 20px 0 0',
                    padding: '1rem',
                    overflowY: 'auto',
                    marginTop: -16,
                    boxShadow: '0 -4px 20px rgba(0,0,0,.4)',
                    zIndex: 10,
                }, onClick: () => setActiveField(null), children: [_jsx("div", { style: { width: 40, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto .75rem' } }), _jsxs("div", { style: { position: 'relative', marginBottom: '.65rem' }, onClick: e => e.stopPropagation(), children: [_jsxs("div", { style: { fontSize: '.7rem', color: 'var(--text-secondary)', marginBottom: '.25rem', display: 'flex', alignItems: 'center', gap: '.4rem' }, children: ["\uD83D\uDCCD ", _jsx("span", { children: "\u05DE\u05D0\u05D9\u05E4\u05D4?" }), locating && _jsx("span", { style: { color: 'var(--accent)', fontSize: '.65rem' }, children: "(\u05DE\u05D0\u05EA\u05E8\u2026)" })] }), _jsx("input", { className: "input", type: "text", value: pickupAddress, onChange: e => handleAddressChange(e.target.value, 'pickup'), onFocus: () => setActiveField('pickup'), placeholder: "\u05DB\u05EA\u05D5\u05D1\u05EA \u05D0\u05D9\u05E1\u05D5\u05E3\u2026", style: { width: '100%', fontSize: '.9rem', padding: '.6rem .75rem' } }), activeField === 'pickup' && pickupSuggestions.length > 0 && (_jsx("div", { style: {
                                    position: 'absolute', top: '100%', right: 0, left: 0, zIndex: 50,
                                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,.5)',
                                    overflow: 'hidden', maxHeight: 220, overflowY: 'auto',
                                }, children: pickupSuggestions.map(s => (_jsxs("div", { onClick: () => selectAddress(s, 'pickup'), style: {
                                        padding: '.65rem .85rem', cursor: 'pointer', fontSize: '.82rem',
                                        color: 'var(--text-primary)', borderBottom: '1px solid var(--border)',
                                        lineHeight: 1.4,
                                    }, onMouseEnter: e => (e.currentTarget.style.background = 'rgba(255,215,0,.07)'), onMouseLeave: e => (e.currentTarget.style.background = 'transparent'), children: ["\uD83D\uDCCD ", shortAddress(s.display_name)] }, s.place_id))) }))] }), _jsxs("div", { style: { position: 'relative', marginBottom: '.75rem' }, onClick: e => e.stopPropagation(), children: [_jsx("div", { style: { fontSize: '.7rem', color: 'var(--text-secondary)', marginBottom: '.25rem' }, children: "\uD83C\uDFC1 \u05DC\u05D0\u05DF?" }), _jsx("input", { className: "input", type: "text", value: dropoffAddress, onChange: e => handleAddressChange(e.target.value, 'dropoff'), onFocus: () => setActiveField('dropoff'), placeholder: "\u05D4\u05E7\u05DC\u05D3 \u05D9\u05E2\u05D3 \u2014 \u05E2\u05D9\u05E8, \u05E8\u05D7\u05D5\u05D1, \u05DE\u05E7\u05D5\u05DD\u2026", style: { width: '100%', fontSize: '.9rem', padding: '.6rem .75rem' }, autoComplete: "off" }), activeField === 'dropoff' && dropoffSuggestions.length > 0 && (_jsx("div", { style: {
                                    position: 'absolute', top: '100%', right: 0, left: 0, zIndex: 50,
                                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,.5)',
                                    overflow: 'hidden', maxHeight: 220, overflowY: 'auto',
                                }, children: dropoffSuggestions.map(s => (_jsxs("div", { onClick: () => selectAddress(s, 'dropoff'), style: {
                                        padding: '.65rem .85rem', cursor: 'pointer', fontSize: '.82rem',
                                        color: 'var(--text-primary)', borderBottom: '1px solid var(--border)',
                                        lineHeight: 1.4,
                                    }, onMouseEnter: e => (e.currentTarget.style.background = 'rgba(255,215,0,.07)'), onMouseLeave: e => (e.currentTarget.style.background = 'transparent'), children: ["\uD83C\uDFC1 ", shortAddress(s.display_name)] }, s.place_id))) }))] }), fare && (_jsx("div", { className: "price-trust fade-in", style: { marginBottom: '.75rem' }, children: _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: '.75rem', color: 'var(--text-secondary)', marginBottom: '.25rem' }, children: "\u05DE\u05D7\u05D9\u05E8 \u05E1\u05D5\u05E4\u05D9 \u2014 \u05DC\u05DC\u05D0 \u05D4\u05E4\u05EA\u05E2\u05D5\u05EA" }), _jsxs("div", { className: "price-trust-total", children: ["\u20AA", fare.total.toFixed(2)] })] }), _jsxs("div", { style: { textAlign: 'left', fontSize: '.8rem', color: 'var(--text-secondary)' }, children: [_jsxs("div", { children: [fare.distance_km.toFixed(1), " \u05E7\"\u05DE"] }), surge && parseFloat(surge.surge_multiplier) > 1 && (_jsxs("div", { style: { color: 'var(--accent)', fontWeight: 700 }, children: ["\u26A1 Surge \u00D7", surge.surge_multiplier] }))] })] }) })), error && (_jsx("div", { style: { color: 'var(--danger)', marginBottom: '.75rem', fontSize: '.875rem', padding: '.5rem .75rem', background: 'rgba(239,68,68,.1)', borderRadius: 8 }, children: error })), !tosAccepted && (_jsxs("div", { style: {
                            marginBottom: '.85rem', padding: '14px 16px',
                            background: 'linear-gradient(135deg,rgba(245,158,11,.12),rgba(245,158,11,.06))',
                            border: '1.5px solid rgba(245,158,11,.35)',
                            borderRadius: 14,
                            direction: 'rtl',
                        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }, children: [_jsx("span", { style: { fontSize: '1.25rem', flexShrink: 0, marginTop: 1 }, children: "\u26A0\uFE0F" }), _jsxs("div", { children: [_jsx("div", { style: { fontWeight: 800, color: '#F59E0B', fontSize: '.9rem', marginBottom: 3 }, children: "You must accept the Terms of Service before requesting a ride" }), _jsx("div", { style: { fontSize: '.78rem', color: '#94A3B8', lineHeight: 1.5 }, children: "\u05E0\u05D3\u05E8\u05E9\u05EA \u05D4\u05E1\u05DB\u05DE\u05D4 \u05DC\u05EA\u05E0\u05D0\u05D9 \u05D4\u05E9\u05D9\u05DE\u05D5\u05E9 \u05DC\u05E4\u05E0\u05D9 \u05D4\u05D6\u05DE\u05E0\u05EA \u05E0\u05E1\u05D9\u05E2\u05D4. \u05E7\u05E8\u05D0 \u05D5\u05D0\u05E9\u05E8 \u05DB\u05D3\u05D9 \u05DC\u05D1\u05D8\u05DC \u05E0\u05E2\u05D9\u05DC\u05D4 \u05D6\u05D5." })] })] }), _jsx("button", { onClick: () => setShowTos(true), style: {
                                    width: '100%', padding: '11px',
                                    background: 'linear-gradient(135deg,#F59E0B,#D97706)',
                                    border: 'none', borderRadius: 11,
                                    color: '#0F172A', fontWeight: 800, fontSize: '.9rem',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                                    boxShadow: '0 4px 14px rgba(245,158,11,.35)',
                                    transition: 'transform .15s, box-shadow .15s',
                                }, onMouseEnter: e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(245,158,11,.5)'; }, onMouseLeave: e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(245,158,11,.35)'; }, children: "\uD83D\uDCCB \u05E7\u05E8\u05D0 \u05D5\u05D4\u05E1\u05DB\u05DD \u05DC\u05EA\u05E0\u05D0\u05D9 \u05D4\u05E9\u05D9\u05DE\u05D5\u05E9" })] })), _jsx("button", { className: "btn btn-primary", style: {
                            width: '100%', padding: '1rem', fontSize: '1.1rem', fontWeight: 800,
                            borderRadius: 'var(--radius-lg)',
                            opacity: tosAccepted ? 1 : 0.35,
                            cursor: tosAccepted ? 'pointer' : 'not-allowed',
                            filter: tosAccepted ? 'none' : 'grayscale(0.4)',
                            transition: 'opacity .3s, filter .3s',
                        }, disabled: busy || !tosAccepted, onClick: tosAccepted ? requestRide : () => setShowTos(true), children: busy
                            ? _jsxs(_Fragment, { children: [_jsx("span", { className: "spinner", style: { width: 18, height: 18, border: '2px solid #1A1A1A', borderTopColor: 'transparent', marginLeft: '.5rem' } }), "\u05DE\u05D7\u05E4\u05E9 \u05E0\u05D4\u05D2\u2026"] })
                            : tosAccepted ? '🚕 הזמן נסיעה עכשיו' : '🔒 נדרש אישור תנאי שימוש' }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.5rem', marginTop: '.75rem' }, children: [
                            { icon: '🚕', label: 'מונית', sublabel: 'מורשה' },
                            { icon: '🚗', label: 'XL', sublabel: 'עד 6 נוסעים' },
                            { icon: '♻️', label: 'ירוק', sublabel: 'חסכוני' },
                        ].map((type, i) => (_jsxs("button", { style: {
                                padding: '.6rem .5rem', borderRadius: 'var(--radius-md)',
                                background: i === 0 ? 'rgba(255,215,0,.12)' : 'var(--bg-elevated)',
                                border: `1px solid ${i === 0 ? 'var(--accent)' : 'var(--border)'}`,
                                color: i === 0 ? 'var(--accent)' : 'var(--text-secondary)',
                                textAlign: 'center',
                            }, children: [_jsx("div", { style: { fontSize: '1.25rem' }, children: type.icon }), _jsx("div", { style: { fontSize: '.75rem', fontWeight: 700, marginTop: '.2rem' }, children: type.label }), _jsx("div", { style: { fontSize: '.65rem', color: 'var(--text-secondary)' }, children: type.sublabel })] }, i))) })] })] }));
}
