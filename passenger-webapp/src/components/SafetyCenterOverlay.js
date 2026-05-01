import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * SafetyCenterOverlay — RideCheck safety panel for ActiveRide.
 *
 * Features:
 *  - Floating shield button that opens a bottom-sheet panel
 *  - AI Agent status ("Gemini Safety Agent Active")
 *  - Share live location via WhatsApp
 *  - Emergency button (calls 100 / opens WhatsApp emergency)
 *  - RideCheck: tracks time since last movement. If >5min → alert state
 *
 * Usage: render inside ActiveRide.tsx, passing lastMovedAt (Date | null)
 */
import { useState, useEffect } from 'react';
const CSS = `
.sc-fab{
  position:fixed;bottom:140px;left:16px;z-index:50;
  width:48px;height:48px;border-radius:50%;
  background:linear-gradient(135deg,#1e40af,#1d4ed8);
  border:2px solid rgba(96,165,250,.4);box-shadow:0 4px 16px rgba(29,78,216,.4);
  display:flex;align-items:center;justify-content:center;
  font-size:1.3rem;cursor:pointer;transition:transform .15s,box-shadow .15s;
}
.sc-fab:hover{transform:scale(1.08);box-shadow:0 6px 20px rgba(29,78,216,.5);}
.sc-fab.alert{
  background:linear-gradient(135deg,#991b1b,#dc2626);
  border-color:rgba(239,68,68,.5);box-shadow:0 4px 16px rgba(220,38,38,.5);
  animation:sc-pulse 1.5s ease-in-out infinite;
}
@keyframes sc-pulse{0%,100%{box-shadow:0 4px 16px rgba(220,38,38,.4);}50%{box-shadow:0 4px 24px rgba(220,38,38,.7);}}

.sc-overlay{
  position:fixed;inset:0;z-index:100;
  background:rgba(0,0,0,.6);backdrop-filter:blur(4px);
  display:flex;align-items:flex-end;justify-content:center;
}
.sc-sheet{
  width:100%;max-width:480px;
  background:#0d1b3e;
  border:1px solid rgba(96,165,250,.2);
  border-radius:24px 24px 0 0;
  padding:24px 20px 40px;
  font-family:'Heebo','Segoe UI',Arial,sans-serif;
  direction:rtl;color:#e2e8f0;
}
.sc-handle{width:40px;height:4px;background:rgba(255,255,255,.15);border-radius:2px;margin:0 auto 20px;}
.sc-header{display:flex;align-items:center;gap:10px;margin-bottom:20px;}
.sc-shield{font-size:1.8rem;}
.sc-header-text h2{font-size:1rem;font-weight:700;color:#fff;}
.sc-header-text p{font-size:.75rem;color:#60a5fa;}
.sc-agent-badge{
  display:inline-flex;align-items:center;gap:6px;
  background:rgba(96,165,250,.1);border:1px solid rgba(96,165,250,.2);
  border-radius:20px;padding:5px 14px;font-size:.75rem;color:#93c5fd;
  margin-bottom:20px;
}
.sc-agent-dot{width:7px;height:7px;border-radius:50%;background:#22d3ee;
  animation:sc-dot-blink 2s ease-in-out infinite;}
@keyframes sc-dot-blink{0%,100%{opacity:1;}50%{opacity:.3;}}

.sc-ridecheck{
  border-radius:14px;padding:14px;margin-bottom:16px;
}
.sc-ridecheck.ok{background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);}
.sc-ridecheck.alert{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);}
.sc-ridecheck-title{font-size:.85rem;font-weight:700;margin-bottom:4px;}
.sc-ridecheck.ok .sc-ridecheck-title{color:#4ade80;}
.sc-ridecheck.alert .sc-ridecheck-title{color:#f87171;}
.sc-ridecheck p{font-size:.75rem;color:#94a3b8;}

.sc-actions{display:flex;flex-direction:column;gap:10px;}
.sc-action-btn{
  width:100%;padding:13px 16px;border-radius:14px;border:none;
  font-family:inherit;font-size:.9rem;font-weight:700;cursor:pointer;
  display:flex;align-items:center;justify-content:center;gap:8px;
  transition:opacity .15s;
}
.sc-action-btn.share{background:rgba(37,99,235,.15);border:1px solid rgba(37,99,235,.3);color:#93c5fd;}
.sc-action-btn.emergency{background:rgba(220,38,38,.15);border:1px solid rgba(220,38,38,.4);color:#fca5a5;}
.sc-action-btn:hover{opacity:.85;}

.sc-footer{margin-top:16px;text-align:center;font-size:.7rem;color:#475569;}
`;
function minutesSince(d) {
    return Math.floor((Date.now() - d.getTime()) / 60000);
}
export default function SafetyCenterOverlay({ rideId, driverName, lastMovedAt }) {
    const [open, setOpen] = useState(false);
    const [minutesStopped, setMinutesStopped] = useState(0);
    useEffect(() => {
        if (!lastMovedAt)
            return;
        const t = setInterval(() => {
            setMinutesStopped(minutesSince(lastMovedAt));
        }, 30000);
        setMinutesStopped(minutesSince(lastMovedAt));
        return () => clearInterval(t);
    }, [lastMovedAt]);
    const isAlert = lastMovedAt !== null && lastMovedAt !== undefined && minutesStopped >= 5;
    function handleShareLocation() {
        const msg = encodeURIComponent(`🚕 אני בנסיעה עם EasyTaxi (נסיעה #${rideId.slice(0, 8)}). מיקומי כרגע: https://easytaxiisrael.com/track/${rideId}`);
        window.open(`https://wa.me/?text=${msg}`, '_blank');
    }
    function handleEmergency() {
        // Show confirm then dial 100
        if (confirm('📞 להתקשר למשטרה / מוקד חירום?')) {
            window.location.href = 'tel:100';
        }
    }
    return (_jsxs(_Fragment, { children: [_jsx("style", { children: CSS }), _jsx("button", { className: `sc-fab${isAlert ? ' alert' : ''}`, onClick: () => setOpen(true), title: "\u05DE\u05E8\u05DB\u05D6 \u05D1\u05D8\u05D9\u05D7\u05D5\u05EA", "aria-label": "\u05DE\u05E8\u05DB\u05D6 \u05D1\u05D8\u05D9\u05D7\u05D5\u05EA", children: isAlert ? '🚨' : '🛡️' }), open && (_jsx("div", { className: "sc-overlay", onClick: e => { if (e.target === e.currentTarget)
                    setOpen(false); }, children: _jsxs("div", { className: "sc-sheet", children: [_jsx("div", { className: "sc-handle" }), _jsxs("div", { className: "sc-header", children: [_jsx("span", { className: "sc-shield", children: "\uD83D\uDEE1\uFE0F" }), _jsxs("div", { className: "sc-header-text", children: [_jsx("h2", { children: "\u05DE\u05E8\u05DB\u05D6 \u05D4\u05D1\u05D8\u05D9\u05D7\u05D5\u05EA" }), _jsx("p", { children: "\u05D0\u05E0\u05D7\u05E0\u05D5 \u05E9\u05D5\u05DE\u05E8\u05D9\u05DD \u05E2\u05DC\u05D9\u05DA \u05D1\u05DB\u05DC \u05E0\u05E1\u05D9\u05E2\u05D4" })] })] }), _jsxs("div", { className: "sc-agent-badge", children: [_jsx("span", { className: "sc-agent-dot" }), "\u05E1\u05D5\u05DB\u05DF AI \u05D1\u05D8\u05D9\u05D7\u05D5\u05EA \u05E4\u05E2\u05D9\u05DC \u2014 \u05E0\u05D9\u05D8\u05D5\u05E8 \u05E8\u05E6\u05D9\u05E3"] }), _jsxs("div", { className: `sc-ridecheck ${isAlert ? 'alert' : 'ok'}`, children: [_jsx("p", { className: "sc-ridecheck-title", children: isAlert ? `⚠️ עצירה חריגה — ${minutesStopped} דקות` : '✅ הנסיעה מתנהלת כרגיל' }), _jsx("p", { children: isAlert
                                        ? `הרכב עמד במקום ${minutesStopped} דקות. הכל בסדר?`
                                        : 'לא זוהתה עצירה חריגה. הנסיעה בתנועה.' })] }), _jsxs("div", { className: "sc-actions", children: [_jsx("button", { className: "sc-action-btn share", onClick: handleShareLocation, children: "\uD83D\uDCAC \u05E9\u05EA\u05E3 \u05DE\u05D9\u05E7\u05D5\u05DD \u05D7\u05D9 \u05D1\u05D5\u05D5\u05D0\u05D8\u05E1\u05D0\u05E4" }), _jsx("button", { className: "sc-action-btn emergency", onClick: handleEmergency, children: "\uD83C\uDD98 \u05D7\u05D9\u05E8\u05D5\u05DD \u2014 \u05D4\u05EA\u05E7\u05E9\u05E8 100" })] }), _jsxs("p", { className: "sc-footer", children: ["\u05E0\u05E1\u05D9\u05E2\u05D4 #", rideId.slice(0, 8), driverName ? ` · נהג: ${driverName}` : ''] })] }) }))] }));
}
