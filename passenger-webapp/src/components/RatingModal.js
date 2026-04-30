import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * RatingModal — post-ride star rating with optional comment.
 *
 * Usage (passenger):
 *   <RatingModal rideId={id} target="driver" onDone={() => setRated(true)} />
 * Usage (driver):
 *   <RatingModal rideId={id} target="passenger" onDone={() => setRated(true)} />
 */
import { useState } from 'react';
import { api } from '../services/api';
export default function RatingModal({ rideId, target, onDone }) {
    const [score, setScore] = useState(0);
    const [hover, setHover] = useState(0);
    const [comment, setComment] = useState('');
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);
    const label = target === 'driver' ? 'הנהג' : 'הנוסע';
    async function submit() {
        if (score === 0)
            return;
        setBusy(true);
        try {
            if (target === 'driver') {
                await api.rides.rateDriver(rideId, { score, comment: comment.trim() || undefined });
            }
            else {
                await api.rides.ratePassenger(rideId, { score, comment: comment.trim() || undefined });
            }
            setDone(true);
            setTimeout(onDone, 1200);
        }
        catch {
            // swallow — don't block the user
            onDone();
        }
        finally {
            setBusy(false);
        }
    }
    return (_jsx("div", { style: {
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }, children: _jsxs("div", { style: {
                width: '100%', maxWidth: 500,
                background: 'linear-gradient(180deg,#1e2535 0%,#141a27 100%)',
                border: '1px solid rgba(255,215,0,.2)',
                borderRadius: '24px 24px 0 0',
                padding: '1.5rem 1.5rem 2rem',
                boxShadow: '0 -12px 40px rgba(0,0,0,.6)',
            }, children: [_jsx("div", { style: { width: 40, height: 4, background: 'rgba(255,255,255,.15)', borderRadius: 2, margin: '0 auto 1.25rem' } }), done ? (_jsxs("div", { style: { textAlign: 'center', padding: '1.5rem 0' }, children: [_jsx("div", { style: { fontSize: '2.5rem', marginBottom: '.5rem' }, children: "\u2705" }), _jsx("div", { style: { fontWeight: 700, color: '#22c55e', fontSize: '1.1rem' }, children: "\u05EA\u05D5\u05D3\u05D4 \u05E2\u05DC \u05D4\u05D3\u05D9\u05E8\u05D5\u05D2!" })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { style: { textAlign: 'center', marginBottom: '1.5rem' }, children: [_jsx("div", { style: { fontSize: '1.75rem', marginBottom: '.5rem' }, children: "\uD83C\uDFC1" }), _jsx("div", { style: { fontWeight: 800, fontSize: '1.1rem', color: '#F1F5F9' }, children: "\u05D4\u05E0\u05E1\u05D9\u05E2\u05D4 \u05D4\u05E1\u05EA\u05D9\u05D9\u05DE\u05D4!" }), _jsxs("div", { style: { color: '#94A3B8', fontSize: '.875rem', marginTop: '.25rem' }, children: ["\u05DB\u05D9\u05E6\u05D3 \u05D4\u05D9\u05D4 ", label, "?"] })] }), _jsx("div", { style: { display: 'flex', justifyContent: 'center', gap: '.5rem', marginBottom: '1.25rem' }, children: [1, 2, 3, 4, 5].map(n => (_jsx("button", { onClick: () => setScore(n), onMouseEnter: () => setHover(n), onMouseLeave: () => setHover(0), style: {
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    fontSize: '2.2rem', lineHeight: 1,
                                    filter: n <= (hover || score)
                                        ? 'drop-shadow(0 0 6px rgba(255,215,0,.8))'
                                        : 'grayscale(1) opacity(0.4)',
                                    transform: n <= (hover || score) ? 'scale(1.15)' : 'scale(1)',
                                    transition: 'all .15s',
                                }, children: "\u2B50" }, n))) }), (hover || score) > 0 && (_jsx("div", { style: { textAlign: 'center', fontSize: '.8rem', color: '#F59E0B', marginBottom: '1rem', fontWeight: 600 }, children: ['', 'גרוע', 'לא טוב', 'בסדר', 'טוב מאוד', 'מעולה!'][hover || score] })), _jsx("textarea", { value: comment, onChange: e => setComment(e.target.value), placeholder: "\u05D4\u05E2\u05E8\u05D4 (\u05D0\u05D5\u05E4\u05E6\u05D9\u05D5\u05E0\u05DC\u05D9)\u2026", rows: 2, style: {
                                width: '100%', background: 'rgba(255,255,255,.06)',
                                border: '1px solid rgba(255,255,255,.1)',
                                borderRadius: 12, color: '#F1F5F9', fontSize: '.875rem',
                                padding: '.6rem .75rem', resize: 'none', marginBottom: '1rem',
                                direction: 'rtl', boxSizing: 'border-box',
                            } }), _jsxs("div", { style: { display: 'flex', gap: '.75rem' }, children: [_jsx("button", { onClick: onDone, style: {
                                        flex: 1, padding: '.75rem', borderRadius: 12,
                                        background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)',
                                        color: '#94A3B8', cursor: 'pointer', fontSize: '.9rem',
                                    }, children: "\u05D3\u05DC\u05D2" }), _jsx("button", { onClick: submit, disabled: score === 0 || busy, style: {
                                        flex: 2, padding: '.75rem', borderRadius: 12,
                                        background: score > 0 ? 'linear-gradient(135deg,#F59E0B,#D97706)' : 'rgba(255,215,0,.15)',
                                        border: 'none', color: score > 0 ? '#0F172A' : '#64748B',
                                        fontWeight: 800, fontSize: '1rem', cursor: score > 0 ? 'pointer' : 'default',
                                        transition: 'all .2s',
                                    }, children: busy ? '…' : 'שלח דירוג' })] })] }))] }) }));
}
