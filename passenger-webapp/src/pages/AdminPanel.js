import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
// ── CSS ────────────────────────────────────────────────────────────────────
const CSS = `
.ap,
.ap *, .ap *::before, .ap *::after { box-sizing: border-box; margin: 0; padding: 0; }
.ap {
  --bg: #070B14; --blue: #2563EB; --bluel: #60A5FA;
  --white: #F1F5F9; --muted: #94A3B8; --card: rgba(255,255,255,.05); --cb: rgba(255,255,255,.08);
  --green: #22C55E; --red: #EF4444; --yellow: #F59E0B;
  min-height: 100vh; background: var(--bg); color: var(--white);
  font-family: 'Heebo', 'Segoe UI', Arial, sans-serif; direction: rtl;
}
.ap-hdr {
  position: sticky; top: 0; z-index: 100; display: flex; align-items: center;
  justify-content: space-between; padding: 14px 20px;
  background: rgba(7,11,20,.95); backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255,255,255,.07);
}
.ap-logo { font-weight: 900; font-size: 1.1rem; }
.ap-logout { padding: 7px 14px; border-radius: 9px; border: 1px solid rgba(255,255,255,.1);
  background: rgba(255,255,255,.04); color: var(--muted); font: .85rem 'Heebo',sans-serif;
  cursor: pointer; transition: all .2s; }
.ap-logout:hover { color: var(--white); background: rgba(255,255,255,.08); }
.ap-body { max-width: 900px; margin: 0 auto; padding: 24px 16px 80px; }
.ap-section-title { font-size: .72rem; font-weight: 700; color: var(--muted);
  text-transform: uppercase; letter-spacing: .7px; margin-bottom: 14px; }
/* Tabs */
.ap-tabs { display: flex; gap: 4px; background: rgba(255,255,255,.04);
  border-radius: 12px; padding: 4px; margin-bottom: 20px; width: fit-content; }
.ap-tab { padding: 9px 18px; border-radius: 9px; border: none; background: transparent;
  color: var(--muted); font: 600 .88rem 'Heebo',sans-serif; cursor: pointer; transition: all .2s; }
.ap-tab.on { background: var(--blue); color: #fff; box-shadow: 0 2px 12px rgba(37,99,235,.4); }
/* Driver list */
.ap-driver-card {
  background: var(--card); border: 1px solid var(--cb); border-radius: 14px;
  padding: 16px; margin-bottom: 10px; cursor: pointer; transition: border-color .2s;
}
.ap-driver-card:hover { border-color: rgba(96,165,250,.3); }
.ap-driver-card.open { border-color: rgba(96,165,250,.4); background: rgba(37,99,235,.05); }
.ap-driver-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.ap-driver-left { display: flex; align-items: center; gap: 12px; }
.ap-driver-avatar { width: 42px; height: 42px; border-radius: 50%; background: rgba(37,99,235,.2);
  display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
.ap-driver-name { font-weight: 700; font-size: .95rem; }
.ap-driver-phone { font-size: .8rem; color: var(--muted); margin-top: 2px; }
.ap-driver-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.ap-chip { font-size: .72rem; font-weight: 700; padding: 3px 10px; border-radius: 100px; white-space: nowrap; }
.ap-pending-badge { background: rgba(239,68,68,.15); border: 1px solid rgba(239,68,68,.3);
  color: #FCA5A5; font-size: .72rem; font-weight: 700; padding: 2px 8px; border-radius: 100px; }
/* Driver detail */
.ap-detail { padding-top: 16px; border-top: 1px solid rgba(255,255,255,.07); margin-top: 16px; }
.ap-detail-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(200px,1fr)); gap: 10px; margin-bottom: 14px; }
.ap-detail-box { background: rgba(255,255,255,.04); border-radius: 10px; padding: 12px; }
.ap-detail-label { font-size: .72rem; color: var(--muted); margin-bottom: 4px; }
.ap-detail-value { font-weight: 700; font-size: .9rem; }
/* Doc review */
.ap-doc { border: 1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 14px; margin-bottom: 10px; }
.ap-doc.ok { border-color: rgba(34,197,94,.3); }
.ap-doc.pend { border-color: rgba(245,158,11,.25); }
.ap-doc.rej { border-color: rgba(239,68,68,.25); }
.ap-doc-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.ap-doc-name { font-weight: 700; font-size: .9rem; }
.ap-doc-meta { font-size: .78rem; color: var(--muted); margin-top: 2px; }
.ap-doc-actions { display: flex; gap: 8px; align-items: center; margin-top: 10px; }
.ap-btn { padding: 8px 16px; border-radius: 9px; border: none; font: 700 .83rem 'Heebo',sans-serif;
  cursor: pointer; transition: all .2s; }
.ap-btn-green { background: rgba(34,197,94,.12); border: 1px solid rgba(34,197,94,.3); color: #4ADE80; }
.ap-btn-green:hover:not(:disabled) { background: rgba(34,197,94,.2); }
.ap-btn-red { background: rgba(239,68,68,.12); border: 1px solid rgba(239,68,68,.3); color: #FCA5A5; }
.ap-btn-red:hover:not(:disabled) { background: rgba(239,68,68,.2); }
.ap-btn-blue { background: var(--blue); color: #fff; }
.ap-btn-blue:hover:not(:disabled) { background: #1D4ED8; }
.ap-btn:disabled { opacity: .45; cursor: not-allowed; }
.ap-reject-input { flex: 1; padding: 8px 12px; border-radius: 9px;
  border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.06);
  color: var(--white); font: .83rem 'Heebo',sans-serif; }
.ap-reject-input:focus { outline: none; border-color: var(--bluel); }
.ap-view-link { color: var(--bluel); font-size: .78rem; text-decoration: none; }
.ap-view-link:hover { text-decoration: underline; }
/* Approve driver button */
.ap-approve-driver { width: 100%; padding: 13px; border-radius: 12px; border: none;
  background: linear-gradient(135deg, #16A34A, #15803D); color: #fff;
  font: 700 .95rem 'Heebo',sans-serif; cursor: pointer; transition: all .25s; margin-top: 14px; }
.ap-approve-driver:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(22,163,74,.4); }
.ap-approve-driver:disabled { opacity: .45; cursor: not-allowed; }
.ap-score-bar-bg { height: 6px; background: rgba(255,255,255,.08); border-radius: 100px; overflow: hidden; margin-top: 6px; }
.ap-score-bar { height: 100%; border-radius: 100px; background: linear-gradient(90deg,#2563EB,#60A5FA); }
.ap-empty { text-align: center; padding: 48px; color: var(--muted); font-size: .95rem; }
@keyframes apIn { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:none } }
.ap-ain { animation: apIn .35s ease both; }
`;
// ── Helpers ────────────────────────────────────────────────────────────────
const DOC_LABELS = {
    drivers_license: 'רישיון נהיגה',
    vehicle_registration: 'רישיון רכב',
    vehicle_insurance: 'ביטוח רכב',
    background_check: 'אישור יושרה',
    vehicle_inspection: 'טסט רכב',
    profile_photo: 'תמונת פרופיל',
};
function authChip(s) {
    const m = {
        pending: { c: '#F59E0B', bg: 'rgba(245,158,11,.12)' },
        whatsapp_verified: { c: '#60A5FA', bg: 'rgba(96,165,250,.1)' },
        persona_in_progress: { c: '#A78BFA', bg: 'rgba(167,139,250,.1)' },
        persona_completed: { c: '#FB923C', bg: 'rgba(251,146,60,.1)' },
        approved: { c: '#22C55E', bg: 'rgba(34,197,94,.12)' },
    };
    return m[s] ?? { c: '#94A3B8', bg: 'rgba(148,163,184,.1)' };
}
function docStatusChip(s) {
    const m = {
        pending: { label: 'ממתין לבדיקה', color: '#F59E0B', bg: 'rgba(245,158,11,.12)' },
        approved: { label: 'אושר ✓', color: '#22C55E', bg: 'rgba(34,197,94,.12)' },
        rejected: { label: 'נדחה ✗', color: '#EF4444', bg: 'rgba(239,68,68,.12)' },
        expired: { label: 'פג תוקף', color: '#94A3B8', bg: 'rgba(148,163,184,.1)' },
    };
    return m[s] ?? { label: s, color: '#94A3B8', bg: 'rgba(148,163,184,.1)' };
}
// ── DocReviewRow ─────────────────────────────────────────────────────────
function DocReviewRow({ doc, onRefresh }) {
    const chip = docStatusChip(doc.status);
    const [rejectReason, setRejectReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [showReject, setShowReject] = useState(false);
    const cardCls = doc.status === 'approved' ? 'ap-doc ok' : doc.status === 'pending' ? 'ap-doc pend' : 'ap-doc rej';
    async function approve() {
        setBusy(true);
        try {
            await api.admin.reviewDoc(doc.id, 'approved');
            onRefresh();
        }
        catch { /* ignore */ }
        finally {
            setBusy(false);
        }
    }
    async function reject() {
        if (!rejectReason.trim())
            return;
        setBusy(true);
        try {
            await api.admin.reviewDoc(doc.id, 'rejected', rejectReason.trim());
            setShowReject(false);
            onRefresh();
        }
        catch { /* ignore */ }
        finally {
            setBusy(false);
        }
    }
    return (_jsxs("div", { className: cardCls, children: [_jsxs("div", { className: "ap-doc-hdr", children: [_jsxs("div", { children: [_jsx("div", { className: "ap-doc-name", children: DOC_LABELS[doc.document_type] ?? doc.document_type }), _jsxs("div", { className: "ap-doc-meta", children: ["\u05D4\u05D5\u05E2\u05DC\u05D4: ", new Date(doc.uploaded_at).toLocaleDateString('he-IL'), doc.expiry_date && ` · תפוגה: ${new Date(doc.expiry_date).toLocaleDateString('he-IL')}`, doc.rejection_reason && ` · סיבת דחייה: ${doc.rejection_reason}`] })] }), _jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx("a", { href: api.compliance.fileUrl(doc.file_key), target: "_blank", rel: "noopener noreferrer", className: "ap-view-link", children: "\uD83D\uDC41 \u05D4\u05E6\u05D2 \u05E7\u05D5\u05D1\u05E5" }), _jsx("span", { className: "ap-chip", style: { color: chip.color, background: chip.bg }, children: chip.label })] })] }), doc.status === 'pending' && (_jsxs("div", { className: "ap-doc-actions", children: [_jsx("button", { className: "ap-btn ap-btn-green", onClick: approve, disabled: busy, children: "\u2713 \u05D0\u05E9\u05E8" }), _jsx("button", { className: "ap-btn ap-btn-red", onClick: () => setShowReject(s => !s), disabled: busy, children: "\u2717 \u05D3\u05D7\u05D4" }), showReject && (_jsxs(_Fragment, { children: [_jsx("input", { className: "ap-reject-input", placeholder: "\u05E1\u05D9\u05D1\u05EA \u05D3\u05D7\u05D9\u05D9\u05D4\u2026", value: rejectReason, onChange: e => setRejectReason(e.target.value) }), _jsx("button", { className: "ap-btn ap-btn-red", onClick: reject, disabled: busy || !rejectReason.trim(), children: "\u05E9\u05DC\u05D7" })] }))] }))] }));
}
// ── DriverDetail ──────────────────────────────────────────────────────────
function DriverDetail({ driver }) {
    const [docs, setDocs] = useState(null);
    const [profile, setProfile] = useState(null);
    const [approving, setApproving] = useState(false);
    const [approved, setApproved] = useState(driver.auth_status === 'approved');
    const load = useCallback(async () => {
        const [d, p] = await Promise.all([
            api.admin.getDriverDocs(driver.driver_id),
            api.admin.getDriverProfile(driver.driver_id),
        ]);
        setDocs(d);
        setProfile(p);
    }, [driver.driver_id]);
    useEffect(() => { load(); }, [load]);
    async function handleApprove() {
        setApproving(true);
        try {
            await api.admin.approveDriver(driver.driver_id);
            setApproved(true);
        }
        catch { /* ignore */ }
        finally {
            setApproving(false);
        }
    }
    return (_jsxs("div", { className: "ap-detail ap-ain", children: [profile && (_jsx("div", { className: "ap-detail-grid", children: [
                    ['ציון ציות', `${profile.compliance_score}/100`],
                    ['סטטוס ציות', profile.compliance_status],
                    ['מסמכים חסרים', String(profile.missing_required.length)],
                    ['סיבת חסימה', profile.block_reason ?? '—'],
                ].map(([label, value]) => (_jsxs("div", { className: "ap-detail-box", children: [_jsx("div", { className: "ap-detail-label", children: label }), _jsx("div", { className: "ap-detail-value", children: value }), label === 'ציון ציות' && (_jsx("div", { className: "ap-score-bar-bg", children: _jsx("div", { className: "ap-score-bar", style: { width: `${profile.compliance_score}%` } }) }))] }, label))) })), docs === null ? (_jsx("div", { style: { color: 'var(--muted)', fontSize: '.85rem', textAlign: 'center', padding: '20px 0' }, children: "\u23F3 \u05D8\u05D5\u05E2\u05DF \u05DE\u05E1\u05DE\u05DB\u05D9\u05DD\u2026" })) : docs.length === 0 ? (_jsx("div", { className: "ap-empty", children: "\uD83D\uDCC4 \u05D4\u05E0\u05D4\u05D2 \u05DC\u05D0 \u05D4\u05E2\u05DC\u05D4 \u05DE\u05E1\u05DE\u05DB\u05D9\u05DD \u05E2\u05D3\u05D9\u05D9\u05DF" })) : (docs.map(doc => _jsx(DocReviewRow, { doc: doc, onRefresh: load }, doc.id))), !approved ? (_jsx("button", { className: "ap-approve-driver", onClick: handleApprove, disabled: approving, children: approving ? '⏳ מאשר…' : '✅ אשר נהג — אפשר קבלת נסיעות' })) : (_jsx("div", { style: { display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.25)', borderRadius: 12, fontWeight: 700, color: '#22C55E', marginTop: 14 }, children: "\uD83C\uDFC6 \u05D4\u05E0\u05D4\u05D2 \u05D0\u05D5\u05E9\u05E8 \u2014 \u05D9\u05DB\u05D5\u05DC \u05DC\u05E7\u05D1\u05DC \u05E0\u05E1\u05D9\u05E2\u05D5\u05EA" }))] }));
}
// ── WhatsApp Tab ──────────────────────────────────────────────────────────
function WhatsAppTab() {
    const [status, setStatus] = useState(null);
    const [qr, setQr] = useState(null);
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [qrLoading, setQrLoading] = useState(false);
    const [msg, setMsg] = useState(null);
    const [testPhone, setTestPhone] = useState('');
    const [autoRefresh, setAutoRefresh] = useState(false);
    const loadStatus = useCallback(async () => {
        try {
            const s = await api.whatsapp.status();
            setStatus(s);
            return s;
        }
        catch {
            return null;
        }
    }, []);
    useEffect(() => {
        loadStatus().then(s => {
            if (s?.state !== 'open') {
                api.whatsapp.qr().then((d) => {
                    setQr(d?.base64 || d?.qr?.base64 || null);
                }).catch(() => { });
            }
            setLoadingStatus(false);
        });
    }, [loadStatus]);
    useEffect(() => {
        if (!autoRefresh)
            return;
        const id = setInterval(async () => {
            const s = await loadStatus();
            if (s?.state === 'open') {
                setAutoRefresh(false);
                setQr(null);
                setMsg({ text: '✅ WhatsApp מחובר!', ok: true });
            }
        }, 5000);
        return () => clearInterval(id);
    }, [autoRefresh, loadStatus]);
    async function refreshQr() {
        setQrLoading(true);
        try {
            const d = await api.whatsapp.qr();
            setQr(d?.base64 || d?.qr?.base64 || null);
            setAutoRefresh(true);
        }
        finally {
            setQrLoading(false);
        }
    }
    async function reconnect() {
        setQrLoading(true);
        setMsg(null);
        try {
            const res = await api.whatsapp.reconnect();
            setQr(res?.qr?.base64 || res?.base64 || null);
            setStatus(prev => prev ? { ...prev, state: 'close' } : prev);
            setAutoRefresh(true);
            setMsg({ text: '🔄 התנתק — סרוק QR חדש', ok: true });
        }
        catch (e) {
            setMsg({ text: `שגיאה: ${e.message}`, ok: false });
        }
        finally {
            setQrLoading(false);
        }
    }
    async function fixWebhook() {
        setMsg(null);
        try {
            const res = await api.whatsapp.fixWebhook();
            setMsg({ text: res.status === 'ok' ? `✅ Webhook עודכן` : '❌ עדכון נכשל', ok: res.status === 'ok' });
        }
        catch (e) {
            setMsg({ text: `שגיאה: ${e.message}`, ok: false });
        }
    }
    async function testSend() {
        if (!testPhone.trim())
            return;
        setMsg(null);
        try {
            const res = await api.whatsapp.testSend(testPhone.trim());
            setMsg({ text: res.status === 'ok' ? `✅ נשלח ל-${testPhone}` : `❌ שליחה נכשלה`, ok: res.status === 'ok' });
        }
        catch (e) {
            setMsg({ text: `שגיאה: ${e.message}`, ok: false });
        }
    }
    const isConnected = status?.state === 'open';
    const webhookOk = status?.configured_webhook === status?.correct_webhook;
    if (loadingStatus)
        return _jsx("div", { className: "ap-empty", children: "\u23F3 \u05D8\u05D5\u05E2\u05DF\u2026" });
    return (_jsxs("div", { children: [_jsxs("div", { style: { background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 16, marginBottom: 12 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }, children: [_jsx("div", { style: { fontWeight: 700 }, children: "\u05E1\u05D8\u05D8\u05D5\u05E1 \u05D7\u05D9\u05D1\u05D5\u05E8" }), _jsx("button", { className: "ap-btn", style: { background: 'rgba(255,255,255,.06)', color: '#94A3B8', border: '1px solid rgba(255,255,255,.1)', fontSize: '.8rem' }, onClick: loadStatus, children: "\u21BB \u05E8\u05E2\u05E0\u05DF" })] }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }, children: [
                            ['מצב', _jsx("span", { style: { color: isConnected ? '#22C55E' : '#EF4444', fontWeight: 700 }, children: isConnected ? '🟢 מחובר' : '🔴 מנותק' })],
                            ['מספר מחובר', status?.owner_phone ? `+${status.owner_phone}` : '—'],
                            ['שם פרופיל', status?.profile_name || '—'],
                            ['Webhook', webhookOk ? _jsx("span", { style: { color: '#22C55E', fontSize: '.8rem' }, children: "\u2705 \u05EA\u05E7\u05D9\u05DF" }) : _jsx("span", { style: { color: '#F59E0B', fontSize: '.8rem' }, children: "\u26A0\uFE0F \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF" })],
                        ].map(([label, value], i) => (_jsxs("div", { style: { background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: '10px 12px' }, children: [_jsx("div", { style: { fontSize: '.72rem', color: '#94A3B8', marginBottom: 4 }, children: label }), _jsx("div", { style: { fontWeight: 600, fontSize: '.9rem' }, children: value })] }, i))) })] }), !isConnected && (_jsxs("div", { style: { background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 16, marginBottom: 12, textAlign: 'center' }, children: [_jsx("div", { style: { fontWeight: 700, marginBottom: 6 }, children: "\u05E1\u05E8\u05D9\u05E7\u05EA QR \u05DC\u05D7\u05D9\u05D1\u05D5\u05E8" }), _jsx("div", { style: { color: '#94A3B8', fontSize: '.82rem', marginBottom: 16 }, children: "\u05E4\u05EA\u05D7 WhatsApp \u2192 \u22EE \u2192 \u05DE\u05DB\u05E9\u05D9\u05E8\u05D9\u05DD \u05DE\u05E7\u05D5\u05E9\u05E8\u05D9\u05DD \u2192 \u05E7\u05E9\u05E8 \u05DE\u05DB\u05E9\u05D9\u05E8 \u2192 \u05E1\u05E8\u05D5\u05E7" }), qrLoading ? (_jsx("div", { style: { height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }, children: "\u23F3 \u05D8\u05D5\u05E2\u05DF QR\u2026" })) : qr ? (_jsx("div", { style: { display: 'inline-block', background: '#fff', padding: 12, borderRadius: 12, marginBottom: 14 }, children: _jsx("img", { src: qr, alt: "QR", style: { display: 'block', width: 220, height: 220 } }) })) : (_jsx("div", { style: { height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '.88rem' }, children: "\u05DC\u05D7\u05E5 \"QR \u05D7\u05D3\u05E9\"" })), autoRefresh && _jsx("div", { style: { color: '#94A3B8', fontSize: '.8rem', marginBottom: 10 }, children: "\u23F3 \u05DE\u05D7\u05DB\u05D4 \u05DC\u05E1\u05E8\u05D9\u05E7\u05D4\u2026" }), _jsxs("div", { style: { display: 'flex', gap: 8, justifyContent: 'center' }, children: [_jsx("button", { className: "ap-btn ap-btn-blue", onClick: refreshQr, disabled: qrLoading, children: "\uD83D\uDCF7 QR \u05D7\u05D3\u05E9" }), _jsx("button", { className: "ap-btn ap-btn-red", onClick: reconnect, disabled: qrLoading, children: "\uD83D\uDD04 \u05D4\u05EA\u05E0\u05EA\u05E7 \u05DE\u05D7\u05D3\u05E9" })] })] })), _jsxs("div", { style: { background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 16, marginBottom: 12 }, children: [_jsx("div", { style: { fontWeight: 700, marginBottom: 12 }, children: "\u2699\uFE0F \u05E4\u05E2\u05D5\u05DC\u05D5\u05EA" }), _jsxs("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 8 }, children: [_jsx("button", { className: "ap-btn", style: { background: 'rgba(255,255,255,.06)', color: '#94A3B8', border: '1px solid rgba(255,255,255,.1)', fontSize: '.85rem' }, onClick: fixWebhook, children: "\uD83D\uDD27 \u05EA\u05E7\u05DF Webhook" }), isConnected && _jsx("button", { className: "ap-btn ap-btn-red", onClick: reconnect, style: { fontSize: '.85rem' }, children: "\uD83D\uDD04 \u05E0\u05EA\u05E7 (QR \u05D7\u05D3\u05E9)" })] })] }), _jsxs("div", { style: { background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 16, marginBottom: 12 }, children: [_jsx("div", { style: { fontWeight: 700, marginBottom: 12 }, children: "\uD83D\uDCE4 \u05E9\u05DC\u05D7 \u05D4\u05D5\u05D3\u05E2\u05EA \u05D1\u05D3\u05D9\u05E7\u05D4" }), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsx("input", { type: "tel", placeholder: "972501234567", value: testPhone, onChange: e => setTestPhone(e.target.value), className: "ap-reject-input", style: { direction: 'ltr' } }), _jsx("button", { className: "ap-btn ap-btn-blue", onClick: testSend, disabled: !testPhone.trim() || !isConnected, style: { fontSize: '.85rem' }, children: "\u05E9\u05DC\u05D7" })] }), !isConnected && _jsx("div", { style: { color: '#EF4444', fontSize: '.78rem', marginTop: 8 }, children: "\u26A0\uFE0F \u05DC\u05D0 \u05DE\u05D7\u05D5\u05D1\u05E8 \u2014 \u05DC\u05D0 \u05E0\u05D9\u05EA\u05DF \u05DC\u05E9\u05DC\u05D5\u05D7" })] }), msg && (_jsx("div", { style: { padding: '10px 14px', borderRadius: 10, fontSize: '.88rem', background: msg.ok ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)', border: `1px solid ${msg.ok ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)'}`, color: msg.ok ? '#22C55E' : '#EF4444' }, children: msg.text }))] }));
}
// ── Main ──────────────────────────────────────────────────────────────────
export default function AdminPanel() {
    const [drivers, setDrivers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openId, setOpenId] = useState(null);
    const [filter, setFilter] = useState('all');
    const [mainTab, setMainTab] = useState('drivers');
    useEffect(() => {
        const el = document.createElement('style');
        el.id = 'ap-css';
        el.textContent = CSS;
        document.head.appendChild(el);
        return () => { document.getElementById('ap-css')?.remove(); };
    }, []);
    useEffect(() => {
        api.admin.listDrivers().then(d => { setDrivers(d); setLoading(false); }).catch(() => setLoading(false));
    }, []);
    const filtered = drivers.filter(d => filter === 'all' ? true
        : filter === 'pending' ? d.auth_status !== 'approved'
            : d.auth_status === 'approved');
    const pendingCount = drivers.filter(d => d.pending_docs > 0).length;
    return (_jsxs("div", { className: "ap", children: [_jsxs("div", { className: "ap-hdr", children: [_jsxs("div", { className: "ap-logo", children: ["\uD83D\uDEE0\uFE0F EasyTaxi \u2014 ", _jsx("span", { style: { color: '#FDE047' }, children: "\u05E0\u05D9\u05D4\u05D5\u05DC" })] }), pendingCount > 0 && (_jsxs("span", { className: "ap-pending-badge", children: ["\u26A0\uFE0F ", pendingCount, " \u05E0\u05D4\u05D2\u05D9\u05DD \u05E2\u05DD \u05DE\u05E1\u05DE\u05DB\u05D9\u05DD \u05DE\u05DE\u05EA\u05D9\u05E0\u05D9\u05DD"] }))] }), _jsxs("div", { className: "ap-body", children: [_jsxs("div", { className: "ap-tabs", style: { marginBottom: 20 }, children: [_jsx("button", { className: `ap-tab${mainTab === 'drivers' ? ' on' : ''}`, onClick: () => setMainTab('drivers'), children: "\uD83D\uDE97 \u05E0\u05D4\u05D2\u05D9\u05DD" }), _jsx("button", { className: `ap-tab${mainTab === 'whatsapp' ? ' on' : ''}`, onClick: () => setMainTab('whatsapp'), children: "\uD83D\uDCAC WhatsApp" })] }), mainTab === 'whatsapp' ? _jsx(WhatsAppTab, {}) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "ap-section-title", children: ["\u05E0\u05D9\u05D4\u05D5\u05DC \u05E0\u05D4\u05D2\u05D9\u05DD \u2014 ", drivers.length, " \u05E0\u05D4\u05D2\u05D9\u05DD \u05E8\u05E9\u05D5\u05DE\u05D9\u05DD"] }), _jsx("div", { className: "ap-tabs", children: [['all', 'כולם'], ['pending', 'ממתינים לאישור'], ['approved', 'מאושרים']].map(([v, l]) => (_jsx("button", { className: `ap-tab${filter === v ? ' on' : ''}`, onClick: () => setFilter(v), children: l }, v))) }), loading ? (_jsx("div", { className: "ap-empty", children: "\u23F3 \u05D8\u05D5\u05E2\u05DF \u05E0\u05D4\u05D2\u05D9\u05DD\u2026" })) : filtered.length === 0 ? (_jsx("div", { className: "ap-empty", children: "\u05D0\u05D9\u05DF \u05E0\u05D4\u05D2\u05D9\u05DD \u05D1\u05E7\u05D8\u05D2\u05D5\u05E8\u05D9\u05D4 \u05D6\u05D5" })) : (filtered.map(driver => {
                                const ac = authChip(driver.auth_status);
                                const isOpen = openId === driver.driver_id;
                                return (_jsxs("div", { className: `ap-driver-card${isOpen ? ' open' : ''}`, children: [_jsxs("div", { className: "ap-driver-row", onClick: () => setOpenId(isOpen ? null : driver.driver_id), children: [_jsxs("div", { className: "ap-driver-left", children: [_jsx("div", { className: "ap-driver-avatar", children: "\uD83D\uDE97" }), _jsxs("div", { children: [_jsx("div", { className: "ap-driver-name", children: driver.full_name ?? 'לא הוזן שם' }), _jsx("div", { className: "ap-driver-phone", children: driver.phone })] })] }), _jsxs("div", { className: "ap-driver-right", children: [_jsx("span", { className: "ap-chip", style: { color: ac.c, background: ac.bg }, children: driver.auth_status }), _jsxs("div", { style: { display: 'flex', gap: 6 }, children: [_jsxs("span", { style: { fontSize: '.75rem', color: 'var(--muted)' }, children: ["\u05E6\u05D9\u05D5\u05DF: ", driver.compliance_score] }), driver.pending_docs > 0 && (_jsxs("span", { className: "ap-pending-badge", children: [driver.pending_docs, " \u05DE\u05DE\u05EA\u05D9\u05E0\u05D9\u05DD"] }))] })] })] }), isOpen && _jsx(DriverDetail, { driver: driver })] }, driver.driver_id));
                            }))] }))] })] }));
}
