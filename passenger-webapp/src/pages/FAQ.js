import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
const CSS = `
.faq*,.faq*::before,.faq*::after{box-sizing:border-box;margin:0;padding:0;}
.faq{
  --bg:#070B14;--bg2:#0D1526;--blue:#2563EB;--blue2:#1D4ED8;
  --bluel:#60A5FA;--white:#F1F5F9;--muted:#94A3B8;
  --card:rgba(255,255,255,.035);--cb:rgba(255,255,255,.08);
  --green:#22C55E;--amber:#FBBF24;--red:#EF4444;
  min-height:100vh;background:var(--bg);color:var(--white);
  font-family:'Heebo','Segoe UI',Arial,sans-serif;direction:rtl;
  padding:0 0 80px;overflow-x:hidden;
}
/* Nav */
.faq-nav{
  position:sticky;top:0;z-index:100;
  display:flex;align-items:center;justify-content:space-between;
  padding:16px 32px;
  background:rgba(7,11,20,.88);backdrop-filter:blur(20px);
  border-bottom:1px solid rgba(255,255,255,.07);
}
.faq-logo{font-size:1.15rem;font-weight:800;text-decoration:none;color:var(--white);}
.faq-logo .ac{color:var(--bluel);}
.faq-nav-back{
  display:inline-flex;align-items:center;gap:6px;
  padding:8px 18px;border-radius:9px;border:1px solid rgba(255,255,255,.1);
  background:rgba(255,255,255,.04);color:var(--muted);
  font:600 .85rem 'Heebo',sans-serif;cursor:pointer;
  text-decoration:none;transition:all .2s;
}
.faq-nav-back:hover{color:var(--bluel);border-color:rgba(96,165,250,.3);}
/* Hero */
.faq-hero{
  text-align:center;padding:72px 24px 56px;
  background:radial-gradient(ellipse 80% 60% at 50% 0%,rgba(37,99,235,.18) 0%,transparent 65%);
}
.faq-badge{
  display:inline-flex;align-items:center;gap:7px;
  background:rgba(37,99,235,.12);border:1px solid rgba(96,165,250,.22);
  border-radius:100px;padding:5px 16px;font-size:.78rem;
  color:var(--bluel);margin-bottom:24px;font-weight:700;
}
.faq-h1{font-size:clamp(2rem,5vw,3.2rem);font-weight:900;letter-spacing:-.03em;margin-bottom:16px;}
.faq-h1 .gr{background:linear-gradient(135deg,#93C5FD,#3B82F6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.faq-sub{font-size:1.05rem;color:var(--muted);max-width:540px;margin:0 auto 40px;line-height:1.7;}
/* Tab pills */
.faq-tabs{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:0;}
.faq-tab{
  padding:9px 20px;border-radius:100px;font:700 .88rem 'Heebo',sans-serif;
  border:1.5px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);
  color:var(--muted);cursor:pointer;transition:all .2s;
}
.faq-tab.active,.faq-tab:hover{color:#fff;border-color:var(--blue);background:rgba(37,99,235,.18);}
.faq-tab.active{background:var(--blue);border-color:var(--blue);color:#fff;box-shadow:0 4px 16px rgba(37,99,235,.35);}
/* Body */
.faq-body{max-width:780px;margin:0 auto;padding:48px 20px 0;}
/* Section header */
.faq-sec-head{display:flex;align-items:center;gap:12px;margin:0 0 20px;}
.faq-sec-ico{font-size:1.8rem;}
.faq-sec-title{font-size:1.3rem;font-weight:900;}
.faq-sec-badge{
  font-size:.72rem;font-weight:800;padding:3px 10px;border-radius:100px;
  text-transform:uppercase;letter-spacing:.6px;
}
.faq-sec-badge.pass{background:rgba(37,99,235,.15);color:var(--bluel);border:1px solid rgba(96,165,250,.25);}
.faq-sec-badge.drv{background:rgba(34,197,94,.12);color:var(--green);border:1px solid rgba(34,197,94,.25);}
.faq-sec-badge.taxi{background:rgba(251,191,36,.1);color:var(--amber);border:1px solid rgba(251,191,36,.25);}
.faq-sec-badge.all{background:rgba(148,163,184,.1);color:var(--muted);border:1px solid rgba(148,163,184,.2);}
/* Divider */
.faq-divider{height:1px;background:rgba(255,255,255,.06);margin:36px 0;}
/* Item */
.faq-item{
  border:1px solid rgba(255,255,255,.07);border-radius:14px;
  background:var(--card);margin-bottom:10px;overflow:hidden;
  transition:border-color .2s;
}
.faq-item:hover{border-color:rgba(96,165,250,.2);}
.faq-item.open{border-color:rgba(37,99,235,.35);background:rgba(37,99,235,.04);}
.faq-q{
  width:100%;text-align:right;padding:18px 20px;
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  background:none;border:none;color:var(--white);
  font:700 .97rem 'Heebo',sans-serif;cursor:pointer;line-height:1.45;
}
.faq-q-arrow{
  flex-shrink:0;width:22px;height:22px;border-radius:50%;
  background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);
  display:flex;align-items:center;justify-content:center;
  font-size:.75rem;transition:transform .3s,background .2s;color:var(--muted);
}
.faq-item.open .faq-q-arrow{transform:rotate(180deg);background:rgba(37,99,235,.25);color:var(--bluel);border-color:rgba(96,165,250,.3);}
.faq-a{
  padding:0 20px;max-height:0;overflow:hidden;
  transition:max-height .35s cubic-bezier(.4,0,.2,1),padding .35s;
  color:var(--muted);font-size:.9rem;line-height:1.75;
}
.faq-item.open .faq-a{max-height:600px;padding:0 20px 18px;}
.faq-a ul{padding-right:18px;margin-top:8px;}
.faq-a ul li{margin-bottom:6px;}
.faq-a strong{color:var(--white);}
.faq-a .tag{
  display:inline-block;padding:2px 9px;border-radius:6px;font-size:.78rem;
  font-weight:700;margin-left:4px;vertical-align:middle;
}
.faq-a .tag.g{background:rgba(34,197,94,.15);color:var(--green);}
.faq-a .tag.b{background:rgba(37,99,235,.15);color:var(--bluel);}
.faq-a .tag.y{background:rgba(251,191,36,.12);color:var(--amber);}
.faq-a .tag.r{background:rgba(239,68,68,.12);color:#FCA5A5;}
/* CTA banner */
.faq-cta{
  margin:48px 20px 0;max-width:780px;margin-left:auto;margin-right:auto;
  border-radius:20px;padding:36px 32px;text-align:center;
  background:linear-gradient(135deg,rgba(37,99,235,.18),rgba(29,78,216,.1));
  border:1px solid rgba(96,165,250,.2);position:relative;overflow:hidden;
}
.faq-cta::before{content:'';position:absolute;inset:0;
  background:radial-gradient(ellipse 60% 60% at 50% 0%,rgba(37,99,235,.15),transparent);
  pointer-events:none;}
.faq-cta h3{font-size:1.4rem;font-weight:900;margin-bottom:10px;}
.faq-cta p{color:var(--muted);font-size:.92rem;margin-bottom:24px;line-height:1.65;}
.faq-cta-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;}
.faq-btn{
  padding:13px 26px;border-radius:11px;font:700 .95rem 'Heebo',sans-serif;
  cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:7px;
  transition:all .22s;border:none;
}
.faq-btn.p{background:linear-gradient(135deg,var(--blue),var(--blue2));color:#fff;box-shadow:0 4px 20px rgba(37,99,235,.35);}
.faq-btn.p:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(37,99,235,.5);}
.faq-btn.w{background:linear-gradient(135deg,#25D366,#1ebe5d);color:#fff;box-shadow:0 4px 20px rgba(37,211,102,.3);}
.faq-btn.w:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(37,211,102,.45);}
.faq-btn.g{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:var(--white);}
.faq-btn.g:hover{background:rgba(255,255,255,.12);transform:translateY(-2px);}
/* Floating WA */
.faq-wa{
  position:fixed;bottom:28px;left:28px;z-index:200;
  width:52px;height:52px;border-radius:50%;
  background:linear-gradient(135deg,#25D366,#1ebe5d);
  display:flex;align-items:center;justify-content:center;
  font-size:1.5rem;box-shadow:0 6px 24px rgba(37,211,102,.4);
  text-decoration:none;transition:transform .2s;
}
.faq-wa:hover{transform:scale(1.1);}
@media(max-width:600px){
  .faq-nav{padding:14px 18px;}
  .faq-hero{padding:60px 16px 44px;}
  .faq-body{padding:36px 14px 0;}
  .faq-cta{margin:36px 14px 0;padding:28px 18px;}
}
`;
const SECTIONS = [
    {
        id: 'general',
        label: 'כללי',
        ico: '🚕',
        badge: 'לכולם',
        badgeClass: 'all',
        items: [
            {
                q: 'מה זה EasyTaxi Israel ואיך זה עובד?',
                a: (_jsxs(_Fragment, { children: ["EasyTaxi Israel \u05D4\u05D9\u05D0 \u05E4\u05DC\u05D8\u05E4\u05D5\u05E8\u05DE\u05EA \u05D4\u05E1\u05E2\u05D5\u05EA \u05D9\u05E9\u05E8\u05D0\u05DC\u05D9\u05EA \u05E9\u05DE\u05D7\u05D1\u05E8\u05EA \u05D1\u05D9\u05DF ", _jsx("strong", { children: "\u05E0\u05D5\u05E1\u05E2\u05D9\u05DD" }), " \u05DC", _jsx("strong", { children: "\u05E0\u05D4\u05D2\u05D9\u05DD \u05DE\u05D0\u05D5\u05DE\u05EA\u05D9\u05DD" }), " \u2014 \u05D1\u05D6\u05DE\u05DF \u05D0\u05DE\u05EA, \u05DC\u05DC\u05D0 \u05E1\u05D9\u05E1\u05DE\u05D0\u05D5\u05EA, \u05DC\u05DC\u05D0 \u05D0\u05E4\u05DC\u05D9\u05E7\u05E6\u05D9\u05D4 \u05DC\u05D4\u05D5\u05E8\u05D3\u05D4.", _jsxs("ul", { children: [_jsxs("li", { children: [_jsx("strong", { children: "\u05E0\u05D5\u05E1\u05E2" }), " \u05DE\u05D6\u05D9\u05DF \u05DE\u05E1\u05E4\u05E8 \u05D8\u05DC\u05E4\u05D5\u05DF \u2192 \u05DE\u05D0\u05DE\u05EA \u05D1-WhatsApp \u2192 \u05DE\u05D6\u05DE\u05D9\u05DF \u05E0\u05E1\u05D9\u05E2\u05D4 \u05DE\u05D9\u05D3."] }), _jsxs("li", { children: [_jsx("strong", { children: "\u05E0\u05D4\u05D2" }), " \u05E0\u05E8\u05E9\u05DD, \u05E2\u05D5\u05D1\u05E8 \u05D0\u05D9\u05DE\u05D5\u05EA \u05D6\u05D4\u05D5\u05EA \u05DE\u05DC\u05D0, \u05D5\u05DE\u05EA\u05D7\u05D9\u05DC \u05DC\u05E7\u05D1\u05DC \u05E0\u05E1\u05D9\u05E2\u05D5\u05EA."] }), _jsx("li", { children: "\u05D4\u05DB\u05DC \u05DE\u05EA\u05D1\u05E6\u05E2 \u05D3\u05E8\u05DA \u05D4\u05D3\u05E4\u05D3\u05E4\u05DF \u2014 \u05D0\u05D9\u05DF \u05E6\u05D5\u05E8\u05DA \u05D1\u05D4\u05D5\u05E8\u05D3\u05EA \u05D0\u05E4\u05DC\u05D9\u05E7\u05E6\u05D9\u05D4." })] })] })),
            },
            {
                q: 'האם השירות פועל בכל הארץ?',
                a: 'כרגע אנחנו פעילים ומתרחבים. לפרטים על אזורי הכיסוי שלנו פנו לתמיכה דרך WhatsApp.',
            },
            {
                q: 'איך מתבצע האימות דרך WhatsApp?',
                a: (_jsxs(_Fragment, { children: ["\u05EA\u05D4\u05DC\u05D9\u05DA \u05D4\u05D0\u05D9\u05DE\u05D5\u05EA \u05DE\u05D1\u05D5\u05E1\u05E1 \u05E2\u05DC ", _jsx("strong", { children: "Magic Link" }), " \u2014 \u05DC\u05DC\u05D0 \u05E1\u05D9\u05E1\u05DE\u05D0 \u05D5\u05DC\u05DC\u05D0 \u05E7\u05D5\u05D3 SMS:", _jsxs("ul", { children: [_jsx("li", { children: "\u05DE\u05DB\u05E0\u05D9\u05E1\u05D9\u05DD \u05DE\u05E1\u05E4\u05E8 \u05D8\u05DC\u05E4\u05D5\u05DF \u05D5\u05D1\u05D5\u05D7\u05E8\u05D9\u05DD \u05EA\u05E4\u05E7\u05D9\u05D3 (\u05E0\u05D5\u05E1\u05E2 / \u05E0\u05D4\u05D2)." }), _jsx("li", { children: "\u05DC\u05D5\u05D7\u05E6\u05D9\u05DD \u05E2\u05DC \u05D4\u05E7\u05D9\u05E9\u05D5\u05E8 \u05E9\u05E0\u05E4\u05EA\u05D7 \u05D1-WhatsApp \u2014 \u05D4\u05D4\u05D5\u05D3\u05E2\u05D4 \u05DB\u05D1\u05E8 \u05DE\u05D5\u05DB\u05E0\u05D4." }), _jsx("li", { children: "\u05E9\u05D5\u05DC\u05D7\u05D9\u05DD \u05D0\u05EA \u05D4\u05D4\u05D5\u05D3\u05E2\u05D4 \u2192 \u05D4\u05DE\u05E2\u05E8\u05DB\u05EA \u05DE\u05D6\u05D4\u05D4 \u05D0\u05EA\u05DB\u05DD \u05D5\u05DE\u05DB\u05E0\u05D9\u05E1\u05D4 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA." }), _jsx("li", { children: "\u05EA\u05D4\u05DC\u05D9\u05DA \u05E9\u05DC\u05DD \u05E9\u05DC ~15 \u05E9\u05E0\u05D9\u05D5\u05EA. \u05DC\u05DC\u05D0 \u05E7\u05D5\u05D3. \u05DC\u05DC\u05D0 \u05E1\u05D9\u05E1\u05DE\u05D0." })] })] })),
            },
            {
                q: 'האם המידע שלי מוצפן ומאובטח?',
                a: (_jsxs(_Fragment, { children: ["\u05DB\u05DF. ", _jsx("strong", { children: "\u05DB\u05DC \u05D4\u05EA\u05E7\u05E9\u05D5\u05E8\u05EA \u05DE\u05D5\u05E6\u05E4\u05E0\u05EA \u05D1-HTTPS/TLS" }), ". \u05DE\u05E1\u05E4\u05E8 \u05D4\u05D8\u05DC\u05E4\u05D5\u05DF \u05E9\u05DC\u05DA \u05DC\u05D0 \u05E0\u05D7\u05E9\u05E3 \u05DC\u05E0\u05D4\u05D2. \u05D4\u05D8\u05D5\u05E7\u05E0\u05D9\u05DD \u05E0\u05E9\u05DE\u05E8\u05D9\u05DD \u05D1-LocalStorage \u05D5\u05DC\u05D0 \u05D1\u05E7\u05D5\u05E7\u05D9\u05D6. \u05EA\u05D5\u05E7\u05E3 \u05D4\u05DB\u05E0\u05D9\u05E1\u05D4 \u05E4\u05D2 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA. ", _jsx("strong", { children: "\u05DC\u05D0 \u05E9\u05D5\u05DE\u05E8\u05D9\u05DD \u05E1\u05D9\u05E1\u05DE\u05D0\u05D5\u05EA \u2014 \u05E4\u05E9\u05D5\u05D8 \u05DB\u05D9 \u05D0\u05D9\u05DF \u05E1\u05D9\u05E1\u05DE\u05D0\u05D5\u05EA." })] })),
            },
            {
                q: 'מה קורה אם יש בעיה טכנית?',
                a: (_jsxs(_Fragment, { children: ["\u05E0\u05D9\u05EA\u05DF \u05DC\u05E4\u05E0\u05D5\u05EA \u05DC\u05EA\u05DE\u05D9\u05DB\u05D4 \u05D1-", _jsx("strong", { children: "WhatsApp: +44 7474 775344" }), " \u2014 24/7. \u05D1\u05E0\u05D5\u05E1\u05E3, \u05D0\u05E4\u05E9\u05E8 \u05DC\u05E9\u05DC\u05D5\u05D7 \u05DE\u05D9\u05D9\u05DC \u05D3\u05E8\u05DA \u05D3\u05E3 \u05D4\u05EA\u05DE\u05D9\u05DB\u05D4."] })),
            },
        ],
    },
    {
        id: 'passenger',
        label: 'נוסעים',
        ico: '🧑‍💼',
        badge: 'נוסע',
        badgeClass: 'pass',
        items: [
            {
                q: 'איך מזמינים נסיעה?',
                a: (_jsx(_Fragment, { children: _jsxs("ul", { children: [_jsx("li", { children: "\u05DB\u05E0\u05E1\u05D5 \u05DC\u05D0\u05EA\u05E8 \u05D5\u05D1\u05D7\u05E8\u05D5 \"\u05E0\u05D5\u05E1\u05E2\"." }), _jsx("li", { children: "\u05D4\u05DB\u05E0\u05D9\u05E1\u05D5 \u05DE\u05E1\u05E4\u05E8 WhatsApp \u05D5\u05D0\u05DE\u05EA\u05D5 \u05D0\u05EA \u05D4\u05D6\u05D4\u05D5\u05EA (15 \u05E9\u05E0\u05D9\u05D5\u05EA)." }), _jsx("li", { children: "\u05DC\u05D0\u05D7\u05E8 \u05D4\u05DB\u05E0\u05D9\u05E1\u05D4 \u2014 \u05D4\u05DB\u05E0\u05D9\u05E1\u05D5 \u05DB\u05EA\u05D5\u05D1\u05EA \u05DE\u05D5\u05E6\u05D0 \u05D5\u05D9\u05E2\u05D3, \u05D5\u05D0\u05E9\u05E8\u05D5 \u05D0\u05EA \u05D4\u05DE\u05D7\u05D9\u05E8." }), _jsx("li", { children: "\u05D4\u05E0\u05D4\u05D2 \u05D4\u05E7\u05E8\u05D5\u05D1 \u05D1\u05D9\u05D5\u05EA\u05E8 \u05DE\u05E7\u05D1\u05DC \u05D0\u05EA \u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 \u05D5\u05DE\u05D2\u05D9\u05E2 \u05D0\u05DC\u05D9\u05DB\u05DD." })] }) })),
            },
            {
                q: 'כמה עולה נסיעה?',
                a: (_jsxs(_Fragment, { children: ["\u05D4\u05DE\u05D7\u05D9\u05E8 \u05DE\u05D7\u05D5\u05E9\u05D1 ", _jsx("strong", { children: "\u05DC\u05E4\u05E0\u05D9" }), " \u05E9\u05DE\u05D0\u05E9\u05E8\u05D9\u05DD \u05D0\u05EA \u05D4\u05E0\u05E1\u05D9\u05E2\u05D4 \u2014 \u05D0\u05D9\u05DF \u05D4\u05E4\u05EA\u05E2\u05D5\u05EA. \u05D4\u05DE\u05D7\u05D9\u05E8 \u05DB\u05D5\u05DC\u05DC:", _jsxs("ul", { children: [_jsx("li", { children: "\u05DE\u05D7\u05D9\u05E8 \u05D1\u05E1\u05D9\u05E1 + \u05DE\u05D7\u05D9\u05E8 \u05DC\u05E7\"\u05DE + \u05DE\u05D7\u05D9\u05E8 \u05DC\u05D4\u05DE\u05EA\u05E0\u05D4." }), _jsx("li", { children: "\u05D0\u05D9\u05DF \u05EA\u05D5\u05E1\u05E4\u05EA \u05E2\u05DC \u05E9\u05E2\u05D5\u05EA \u05DC\u05D9\u05DC\u05D4 \u05D0\u05D5 \u05E2\u05D5\u05DE\u05E1 (flat rate)." }), _jsx("li", { children: "\u05D7\u05E9\u05D1\u05D5\u05E0\u05D9\u05EA \u05D3\u05D9\u05D2\u05D9\u05D8\u05DC\u05D9\u05EA \u05E0\u05E9\u05DC\u05D7\u05EA \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA \u05D1\u05E1\u05D9\u05D5\u05DD." })] })] })),
            },
            {
                q: 'באילו אמצעי תשלום ניתן לשלם?',
                a: 'כרגע התשלום מתבצע ישירות לנהג (מזומן / Bit / PayBox). תשלום דיגיטלי מובנה יושק בקרוב.',
            },
            {
                q: 'האם אני יכול לראות את פרטי הנהג לפני הנסיעה?',
                a: 'כן — לפני שהנסיעה מתחילה תראו את שם הנהג, דירוג, סוג הרכב ולוחית הרישוי.',
            },
            {
                q: 'מה עושים אם הנהג לא הגיע?',
                a: (_jsxs(_Fragment, { children: ["\u05D0\u05DD \u05D4\u05E0\u05D4\u05D2 \u05DC\u05D0 \u05DE\u05D2\u05D9\u05E2 \u05EA\u05D5\u05DA 10 \u05D3\u05E7\u05D5\u05EA \u05DC\u05D0\u05D7\u05E8 \u05E7\u05D1\u05DC\u05EA \u05D4\u05D0\u05D9\u05E9\u05D5\u05E8:", _jsxs("ul", { children: [_jsx("li", { children: "\u05E0\u05D9\u05EA\u05DF \u05DC\u05D1\u05D8\u05DC \u05D0\u05EA \u05D4\u05D4\u05D6\u05DE\u05E0\u05D4 \u05DC\u05DC\u05D0 \u05D7\u05D9\u05D5\u05D1." }), _jsx("li", { children: "\u05D4\u05DE\u05E2\u05E8\u05DB\u05EA \u05EA\u05D7\u05E4\u05E9 \u05E0\u05D4\u05D2 \u05D7\u05DC\u05D5\u05E4\u05D9 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA." }), _jsx("li", { children: "\u05DC\u05DB\u05DC \u05EA\u05E7\u05DC\u05D4 \u2014 WhatsApp \u05EA\u05DE\u05D9\u05DB\u05D4: +44 7474 775344." })] })] })),
            },
            {
                q: 'האם אפשר לדרג את הנהג?',
                a: 'כן. לאחר סיום הנסיעה תופיע בקשת דירוג. הדירוגים מצטברים ונוהגים עם ציון נמוך מ-4.0 מושעים אוטומטית.',
            },
        ],
    },
    {
        id: 'driver',
        label: 'נהג עצמאי',
        ico: '🚗',
        badge: 'נהג לא מורשה',
        badgeClass: 'drv',
        items: [
            {
                q: 'מה זה "נהג עצמאי" (לא מורשה) ואיך זה חוקי?',
                a: (_jsxs(_Fragment, { children: ["\u05D1\u05E2\u05E7\u05D1\u05D5\u05EA ", _jsx("strong", { children: "\u05D7\u05D5\u05E7 \u05E9\u05D9\u05E8\u05D5\u05EA \u05D4\u05E0\u05E1\u05D9\u05E2\u05D5\u05EA 2026" }), " (\u05EA\u05D9\u05E7\u05D5\u05DF 47), \u05DE\u05D5\u05EA\u05E8 \u05DC\u05E0\u05D4\u05D2\u05D9\u05DD \u05E4\u05E8\u05D8\u05D9\u05D9\u05DD \u05DC\u05E1\u05E4\u05E7 \u05E9\u05D9\u05E8\u05D5\u05EA\u05D9 \u05D4\u05E1\u05E2\u05D4 \u05D1\u05EA\u05E9\u05DC\u05D5\u05DD ", _jsx("strong", { children: "\u05D1\u05DC\u05D9 \u05E8\u05D9\u05E9\u05D9\u05D5\u05DF \u05DE\u05D5\u05E0\u05D9\u05EA" }), ", \u05D1\u05EA\u05E0\u05D0\u05D9\u05DD \u05E1\u05E4\u05E6\u05D9\u05E4\u05D9\u05D9\u05DD:", _jsxs("ul", { children: [_jsx("li", { children: "\u05D0\u05D9\u05DE\u05D5\u05EA \u05D6\u05D4\u05D5\u05EA \u05DE\u05DC\u05D0 (\u05EA\u05E2\u05D5\u05D3\u05EA \u05D6\u05D4\u05D5\u05EA + \u05E1\u05E8\u05D8 \u05E4\u05E0\u05D9\u05DD \u2014 Persona KYC)." }), _jsx("li", { children: "\u05D1\u05D9\u05D8\u05D5\u05D7 \u05DE\u05D9\u05D5\u05D7\u05D3 \u05DC\u05E0\u05E1\u05D9\u05E2\u05D5\u05EA \u05E9\u05D9\u05EA\u05D5\u05E3 (\u05DE\u05D9\u05E0\u05D9\u05DE\u05D5\u05DD \u05DB\u05D9\u05E1\u05D5\u05D9 3 \u05DE\u05D9\u05DC\u05D9\u05D5\u05DF \u20AA)." }), _jsx("li", { children: "\u05E8\u05DB\u05D1 \u05E2\u05D3 12 \u05E9\u05E0\u05D4 \u05D5\u05E8\u05D9\u05E9\u05D9\u05D5\u05DF \u05E0\u05D4\u05D9\u05D2\u05D4 \u05EA\u05E7\u05E3 \u05DE\u05D9\u05E0\u05D9\u05DE\u05D5\u05DD 3 \u05E9\u05E0\u05D9\u05DD." }), _jsx("li", { children: "\u05D4\u05D2\u05D1\u05DC\u05D4 \u05E9\u05DC \u05E2\u05D3 30 \u05E0\u05E1\u05D9\u05E2\u05D5\u05EA \u05D1\u05D7\u05D5\u05D3\u05E9 (\u05DC\u05D0 \u05DE\u05E9\u05E8\u05D4 \u05DE\u05DC\u05D0\u05D4)." })] }), _jsx("span", { className: "tag g", children: "\u05D7\u05D3\u05E9 2026" }), " EasyTaxi \u05DE\u05E0\u05D4\u05DC\u05EA \u05D0\u05EA \u05DB\u05DC \u05EA\u05D4\u05DC\u05D9\u05DA \u05E6\u05D9\u05D5\u05EA \u05D4\u05D7\u05D5\u05E7 \u05D1\u05E9\u05D1\u05D9\u05DC\u05DA."] })),
            },
            {
                q: 'איך נרשמים כנהג עצמאי?',
                a: (_jsxs(_Fragment, { children: [_jsxs("ul", { children: [_jsxs("li", { children: [_jsx("strong", { children: "\u05E9\u05DC\u05D1 1:" }), " \u05DB\u05E0\u05E1\u05D5 \u05DC-", _jsx("a", { href: "/driver", style: { color: 'var(--bluel)' }, children: "/driver" }), " \u05D5\u05D1\u05D7\u05E8\u05D5 \"\u05E0\u05D4\u05D2 \u05E2\u05E6\u05DE\u05D0\u05D9\"."] }), _jsxs("li", { children: [_jsx("strong", { children: "\u05E9\u05DC\u05D1 2:" }), " \u05D0\u05DE\u05EA\u05D5 \u05D0\u05EA \u05DE\u05E1\u05E4\u05E8 \u05D4\u05D8\u05DC\u05E4\u05D5\u05DF \u05D1-WhatsApp (15 \u05E9\u05E0\u05D9\u05D5\u05EA)."] }), _jsxs("li", { children: [_jsx("strong", { children: "\u05E9\u05DC\u05D1 3:" }), " \u05EA\u05E7\u05D1\u05DC\u05D5 \u05D1-WhatsApp \u05E7\u05D9\u05E9\u05D5\u05E8 \u05DC\u05D0\u05D9\u05DE\u05D5\u05EA \u05E4\u05E0\u05D9\u05DD \u05D5\u05EA\u05E2\u05D5\u05D3\u05EA \u05D6\u05D4\u05D5\u05EA (Persona \u2014 ~2 \u05D3\u05E7\u05D5\u05EA)."] }), _jsxs("li", { children: [_jsx("strong", { children: "\u05E9\u05DC\u05D1 4:" }), " \u05DC\u05D0\u05D7\u05E8 \u05D0\u05D9\u05E9\u05D5\u05E8 \u2014 \u05EA\u05D5\u05DB\u05DC\u05D5 \u05DC\u05D4\u05EA\u05D7\u05D9\u05DC \u05DC\u05E7\u05D1\u05DC \u05E0\u05E1\u05D9\u05E2\u05D5\u05EA."] })] }), "\u05D4\u05EA\u05D4\u05DC\u05D9\u05DA \u05DB\u05D5\u05DC\u05DC \u05DC\u05D5\u05E7\u05D7 ", _jsx("strong", { children: "5-7 \u05D3\u05E7\u05D5\u05EA" }), ". \u05D4\u05D0\u05D9\u05E9\u05D5\u05E8 \u05DE\u05D2\u05D9\u05E2 \u05EA\u05D5\u05DA 24 \u05E9\u05E2\u05D5\u05EA \u05D1\u05E9\u05E2\u05D5\u05EA \u05D4\u05E2\u05E1\u05E7\u05D9\u05DD."] })),
            },
            {
                q: 'מה זה Persona KYC ולמה צריך?',
                a: (_jsxs(_Fragment, { children: [_jsx("strong", { children: "Persona" }), " \u05D4\u05D9\u05D0 \u05D7\u05D1\u05E8\u05EA \u05D0\u05D9\u05DE\u05D5\u05EA \u05D6\u05D4\u05D5\u05EA \u05DE\u05D0\u05D5\u05E9\u05E8\u05EA (SOC 2). \u05D4\u05EA\u05D4\u05DC\u05D9\u05DA:", _jsxs("ul", { children: [_jsx("li", { children: "\u05E6\u05D9\u05DC\u05D5\u05DD \u05EA\u05E2\u05D5\u05D3\u05EA \u05D6\u05D4\u05D5\u05EA (\u05E4\u05E0\u05D9\u05DD \u05D5\u05D0\u05D7\u05D5\u05E8)." }), _jsx("li", { children: "\u05E1\u05E8\u05D8\u05D5\u05DF \u05E1\u05DC\u05E4\u05D9 \u05E7\u05E6\u05E8 \u05DC\u05D0\u05D9\u05DE\u05D5\u05EA \u05E9\u05D0\u05EA\u05D4 \u05DE\u05D7\u05D6\u05D9\u05E7 \u05D0\u05EA \u05D4\u05EA\u05E2\u05D5\u05D3\u05D4." }), _jsx("li", { children: "\u05DB\u05DC \u05D4\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05DE\u05D5\u05E6\u05E4\u05E0\u05D9\u05DD \u05D5\u05DC\u05D0 \u05E0\u05E9\u05DE\u05E8\u05D9\u05DD \u05D0\u05E6\u05DC\u05E0\u05D5 \u2014 \u05E8\u05E7 \u05EA\u05D5\u05E6\u05D0\u05EA \u05D4\u05D0\u05D9\u05E9\u05D5\u05E8." })] }), "\u05D6\u05D4 \u05E0\u05D3\u05E8\u05E9 \u05E2\u05DC \u05E4\u05D9 \u05D4\u05D7\u05D5\u05E7 \u05D5\u05DE\u05D2\u05DF \u05D2\u05DD \u05E2\u05DC\u05D9\u05DA: ", _jsx("span", { className: "tag g", children: "\u05DE\u05D5\u05E0\u05E2 \u05D6\u05D9\u05D5\u05E4\u05D9\u05DD" }), " ", _jsx("span", { className: "tag b", children: "\u05D0\u05D7\u05E8\u05D9\u05D5\u05EA \u05DE\u05E9\u05E4\u05D8\u05D9\u05EA" })] })),
            },
            {
                q: 'כמה אפשר להרוויח כנהג עצמאי?',
                a: (_jsxs(_Fragment, { children: ["\u05E0\u05D4\u05D2\u05D9\u05DD \u05E4\u05E2\u05D9\u05DC\u05D9\u05DD \u05DE\u05E8\u05D5\u05D5\u05D9\u05D7\u05D9\u05DD \u05DE\u05DE\u05D5\u05E6\u05E2 ", _jsx("strong", { children: "\u20AA480 \u05DC\u05E9\u05DE\u05D5\u05E0\u05D4 \u05E9\u05E2\u05D5\u05EA \u05E2\u05D1\u05D5\u05D3\u05D4" }), ".", _jsxs("ul", { children: [_jsx("li", { children: "12 \u05E0\u05E1\u05D9\u05E2\u05D5\u05EA \u05DE\u05DE\u05D5\u05E6\u05E2 \u05D1\u05D9\u05D5\u05DD." }), _jsxs("li", { children: ["\u05D3\u05DE\u05D9 \u05EA\u05D9\u05D5\u05D5\u05DA: ", _jsx("strong", { children: "15%" }), " \u05DC\u05E4\u05DC\u05D8\u05E4\u05D5\u05E8\u05DE\u05D4 (\u05DC\u05DC\u05D0 \u05D3\u05DE\u05D9 \u05D4\u05E6\u05D8\u05E8\u05E4\u05D5\u05EA)."] }), _jsx("li", { children: "\u05EA\u05E9\u05DC\u05D5\u05DD \u05DE\u05D9\u05D9\u05D3\u05D9 \u05D1\u05E1\u05D9\u05D5\u05DD \u05DB\u05DC \u05E0\u05E1\u05D9\u05E2\u05D4 \u2014 \u05D0\u05D9\u05DF \u05D4\u05DE\u05EA\u05E0\u05D4." })] })] })),
            },
            {
                q: 'האם צריך ביטוח מיוחד?',
                a: (_jsxs(_Fragment, { children: ["\u05DB\u05DF \u2014 ", _jsx("strong", { children: "\u05D1\u05D9\u05D8\u05D5\u05D7 \u05E9\u05D9\u05EA\u05D5\u05E3 \u05E0\u05E1\u05D9\u05E2\u05D5\u05EA" }), " \u05D4\u05D5\u05D0 \u05D7\u05D5\u05D1\u05D4 \u05D7\u05D5\u05E7\u05D9\u05EA. \u05E0\u05D9\u05EA\u05DF \u05DC\u05E8\u05DB\u05D5\u05E9 \u05D3\u05E8\u05DB\u05E0\u05D5 \u05D1-\u20AA89/\u05D7\u05D5\u05D3\u05E9 (\u05D4\u05E4\u05D7\u05D5\u05EA \u05D9\u05E7\u05E8 \u05D1\u05E9\u05D5\u05E7). \u05D4\u05D1\u05D9\u05D8\u05D5\u05D7 \u05DE\u05DB\u05E1\u05D4:", _jsxs("ul", { children: [_jsx("li", { children: "\u05E0\u05E1\u05D9\u05E2\u05D5\u05EA \u05D1\u05DC\u05D1\u05D3 (\u05DC\u05D0 24/7)." }), _jsx("li", { children: "\u05DB\u05D9\u05E1\u05D5\u05D9 \u05E0\u05D5\u05E1\u05E2 \u05D5\u05E0\u05D4\u05D2 \u05E2\u05D3 3 \u05DE\u05D9\u05DC\u05D9\u05D5\u05DF \u20AA." }), _jsx("li", { children: "\u05D4\u05E1\u05D3\u05E8 \u05D9\u05E9\u05D9\u05E8 \u05DE\u05D5\u05DC \u05D7\u05D1\u05E8\u05EA \u05D4\u05D1\u05D9\u05D8\u05D5\u05D7 \u2014 \u05DC\u05DC\u05D0 \u05D1\u05D9\u05D5\u05E8\u05D5\u05E7\u05E8\u05D8\u05D9\u05D4." })] })] })),
            },
            {
                q: 'מה קורה אם האימות נדחה?',
                a: (_jsxs(_Fragment, { children: ["\u05D0\u05DD Persona \u05D3\u05D7\u05EA\u05D4 \u05D0\u05EA \u05D4\u05D1\u05E7\u05E9\u05D4:", _jsxs("ul", { children: [_jsx("li", { children: "\u05EA\u05E7\u05D1\u05DC\u05D5 \u05D4\u05D5\u05D3\u05E2\u05EA WhatsApp \u05E2\u05DD \u05D4\u05E1\u05D9\u05D1\u05D4." }), _jsx("li", { children: "\u05E0\u05D9\u05EA\u05DF \u05DC\u05E4\u05E0\u05D5\u05EA \u05DC\u05EA\u05DE\u05D9\u05DB\u05D4 \u05DC\u05D1\u05D9\u05E8\u05D5\u05E8 \u05EA\u05D5\u05DA 24 \u05E9\u05E2\u05D5\u05EA." }), _jsx("li", { children: "\u05E0\u05D9\u05EA\u05DF \u05DC\u05D4\u05D2\u05D9\u05E9 \u05D1\u05E7\u05E9\u05D4 \u05D7\u05D5\u05D6\u05E8\u05EA \u05DC\u05D0\u05D7\u05E8 \u05EA\u05D9\u05E7\u05D5\u05DF \u05D4\u05D1\u05E2\u05D9\u05D4 (\u05EA\u05E2\u05D5\u05D3\u05D4 \u05E4\u05D2\u05EA \u05EA\u05D5\u05E7\u05E3, \u05EA\u05DE\u05D5\u05E0\u05D4 \u05DC\u05D0 \u05D1\u05E8\u05D5\u05E8\u05D4 \u05D5\u05DB\u05D5')." })] })] })),
            },
            {
                q: 'האם אפשר לעבוד בשעות חלקיות?',
                a: 'בהחלט — זה יתרון המערכת. ניתן להפעיל/לכבות זמינות בלחיצה אחת. אין מינימום שעות ואין קנסות על חוסר פעילות.',
            },
        ],
    },
    {
        id: 'taxi',
        label: 'מונית מורשה',
        ico: '🚕',
        badge: 'נהג מורשה',
        badgeClass: 'taxi',
        items: [
            {
                q: 'מה היתרון להצטרף כנהג מונית מורשה?',
                a: (_jsxs(_Fragment, { children: ["\u05E0\u05D4\u05D2\u05D9 \u05DE\u05D5\u05E0\u05D9\u05EA \u05DE\u05D5\u05E8\u05E9\u05D9\u05DD \u05E0\u05D4\u05E0\u05D9\u05DD \u05DE:", _jsxs("ul", { children: [_jsxs("li", { children: [_jsx("span", { className: "tag y", children: "\u05E2\u05D3\u05D9\u05E4\u05D5\u05EA" }), " \u05D1\u05D4\u05E7\u05E6\u05D0\u05EA \u05E0\u05E1\u05D9\u05E2\u05D5\u05EA \u05E2\u05DC \u05E4\u05E0\u05D9 \u05E0\u05D4\u05D2\u05D9\u05DD \u05E2\u05E6\u05DE\u05D0\u05D9\u05D9\u05DD."] }), _jsxs("li", { children: ["\u05D3\u05DE\u05D9 \u05EA\u05D9\u05D5\u05D5\u05DA ", _jsx("strong", { children: "12%" }), " (\u05D1\u05DE\u05E7\u05D5\u05DD 15% \u05DC\u05E0\u05D4\u05D2 \u05E2\u05E6\u05DE\u05D0\u05D9)."] }), _jsx("li", { children: "\u05DC\u05DC\u05D0 \u05D4\u05D2\u05D1\u05DC\u05EA 30 \u05E0\u05E1\u05D9\u05E2\u05D5\u05EA/\u05D7\u05D5\u05D3\u05E9." }), _jsx("li", { children: "\u05EA\u05D2 \"\u05DE\u05D5\u05E0\u05D9\u05EA \u05DE\u05D5\u05E8\u05E9\u05D4\" \u05E2\u05DC \u05D4\u05E4\u05E8\u05D5\u05E4\u05D9\u05DC \u2014 \u05DE\u05D2\u05D3\u05D9\u05DC \u05D0\u05DE\u05D5\u05DF \u05E0\u05D5\u05E1\u05E2\u05D9\u05DD." })] })] })),
            },
            {
                q: 'מה צריך להגיש להצטרפות?',
                a: (_jsx(_Fragment, { children: _jsxs("ul", { children: [_jsx("li", { children: "\u05E8\u05D9\u05E9\u05D9\u05D5\u05DF \u05E0\u05D4\u05D9\u05D2\u05D4 \u05EA\u05E7\u05E3 \u05DC\u05E8\u05DB\u05D1 \u05DE\u05E1\u05D7\u05E8\u05D9 / \u05DE\u05D5\u05E0\u05D9\u05EA." }), _jsx("li", { children: "\u05E8\u05D9\u05E9\u05D9\u05D5\u05DF \u05DE\u05D5\u05E0\u05D9\u05EA \u05EA\u05E7\u05E3 (\u05D7\u05E4\u05E5 \u05DE\u05D5\u05E0\u05D9\u05D5\u05EA / \u05E2\u05E6\u05DE\u05D0\u05D9)." }), _jsx("li", { children: "\u05D1\u05D9\u05D8\u05D5\u05D7 \u05DE\u05D5\u05E0\u05D9\u05EA \u05EA\u05E7\u05E3 (\u05D4\u05D1\u05D9\u05D8\u05D5\u05D7 \u05E9\u05DC\u05DA \u2014 \u05DC\u05D0 \u05E6\u05E8\u05D9\u05DA \u05D1\u05D9\u05D8\u05D5\u05D7 \u05E0\u05D5\u05E1\u05E3)." }), _jsx("li", { children: "\u05D0\u05D9\u05DE\u05D5\u05EA \u05D6\u05D4\u05D5\u05EA Persona (\u05DB\u05DE\u05D5 \u05DB\u05DC \u05E0\u05D4\u05D2)." }), _jsx("li", { children: "\u05EA\u05DE\u05D5\u05E0\u05EA \u05D4\u05E8\u05DB\u05D1 + \u05DC\u05D5\u05D7\u05D9\u05EA \u05E8\u05D9\u05E9\u05D5\u05D9." })] }) })),
            },
            {
                q: 'האם ניתן לשלב עבודה עם מונית מורשה אחרת?',
                a: 'כן — ניתן לעבוד עם מספר פלטפורמות במקביל. אין בלעדיות. הפעלת/כיבוי זמינות בלחיצה אחת.',
            },
            {
                q: 'האם יש תוכנית הפניות לנהגים?',
                a: (_jsxs(_Fragment, { children: ["\u05DB\u05DF! \u05DB\u05DC \u05E0\u05D4\u05D2 \u05E9\u05DE\u05E4\u05E0\u05D4 \u05E0\u05D4\u05D2 \u05D7\u05D3\u05E9 (\u05E9\u05DE\u05E9\u05DC\u05D9\u05DD 10 \u05E0\u05E1\u05D9\u05E2\u05D5\u05EA) \u05DE\u05E7\u05D1\u05DC ", _jsx("strong", { children: "\u20AA150 \u05D1\u05D5\u05E0\u05D5\u05E1" }), " \u05D9\u05E9\u05D9\u05E8\u05D5\u05EA \u05DC\u05D7\u05E9\u05D1\u05D5\u05DF. ", _jsx("span", { className: "tag y", children: "\u05DC\u05DC\u05D0 \u05D4\u05D2\u05D1\u05DC\u05D4" })] })),
            },
            {
                q: 'כיצד מתנהל תהליך ההרשמה?',
                a: (_jsx(_Fragment, { children: _jsxs("ul", { children: [_jsxs("li", { children: [_jsx("strong", { children: "\u05E9\u05DC\u05D1 1:" }), " \u05DB\u05E0\u05E1\u05D5 \u05DC-", _jsx("a", { href: "/login?role=taxi", style: { color: 'var(--bluel)' }, children: "\u05D4\u05E8\u05E9\u05DE\u05EA \u05E0\u05D4\u05D2 \u05DE\u05D5\u05E0\u05D9\u05EA" }), "."] }), _jsxs("li", { children: [_jsx("strong", { children: "\u05E9\u05DC\u05D1 2:" }), " \u05D0\u05D9\u05DE\u05D5\u05EA WhatsApp (15 \u05E9\u05E0\u05D9\u05D5\u05EA)."] }), _jsxs("li", { children: [_jsx("strong", { children: "\u05E9\u05DC\u05D1 3:" }), " \u05D0\u05D9\u05DE\u05D5\u05EA Persona (2 \u05D3\u05E7\u05D5\u05EA)."] }), _jsxs("li", { children: [_jsx("strong", { children: "\u05E9\u05DC\u05D1 4:" }), " \u05D4\u05E2\u05DC\u05D0\u05EA \u05DE\u05E1\u05DE\u05DB\u05D9 \u05DE\u05D5\u05E0\u05D9\u05EA \u2014 \u05E0\u05E6\u05D9\u05D2 \u05E9\u05DC\u05E0\u05D5 \u05DE\u05D0\u05E9\u05E8 \u05EA\u05D5\u05DA 24 \u05E9\u05E2\u05D5\u05EA \u05D1\u05E9\u05E2\u05D5\u05EA \u05D4\u05E2\u05E1\u05E7\u05D9\u05DD."] })] }) })),
            },
        ],
    },
    {
        id: 'billing',
        label: 'תשלומים',
        ico: '💳',
        badge: 'לכולם',
        badgeClass: 'all',
        items: [
            {
                q: 'האם יש עמלות נסתרות?',
                a: (_jsxs(_Fragment, { children: [_jsx("strong", { children: "\u05DC\u05D0." }), " \u05DB\u05DC \u05D4\u05DE\u05D7\u05D9\u05E8\u05D9\u05DD \u05E9\u05E7\u05D5\u05E4\u05D9\u05DD:", _jsxs("ul", { children: [_jsx("li", { children: "\u05E0\u05D5\u05E1\u05E2: \u05E8\u05D5\u05D0\u05D4 \u05DE\u05D7\u05D9\u05E8 \u05DE\u05D3\u05D5\u05D9\u05E7 \u05DC\u05E4\u05E0\u05D9 \u05D0\u05D9\u05E9\u05D5\u05E8. \u05D0\u05D9\u05DF \u05EA\u05D5\u05E1\u05E4\u05D5\u05EA." }), _jsx("li", { children: "\u05E0\u05D4\u05D2: 15% \u05E2\u05DE\u05DC\u05D4 (12% \u05DC\u05DE\u05D5\u05E0\u05D9\u05EA \u05DE\u05D5\u05E8\u05E9\u05D9\u05EA). \u05D0\u05D9\u05DF \u05D3\u05DE\u05D9 \u05D4\u05E6\u05D8\u05E8\u05E4\u05D5\u05EA, \u05D0\u05D9\u05DF \u05D3\u05DE\u05D9 \u05D7\u05D1\u05E8." }), _jsx("li", { children: "\u05D7\u05E9\u05D1\u05D5\u05E0\u05D9\u05EA \u05D3\u05D9\u05D2\u05D9\u05D8\u05DC\u05D9\u05EA \u05D1\u05E1\u05D9\u05D5\u05DD \u05DB\u05DC \u05E0\u05E1\u05D9\u05E2\u05D4 \u2014 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA." })] })] })),
            },
            {
                q: 'איך מתבצע תשלום הנהג?',
                a: 'כרגע: תשלום ישיר מהנוסע לנהג (מזומן / Bit / PayBox). תשלום דיגיטלי מובנה עם הסדר ישיר יושק ב-Q3 2026.',
            },
            {
                q: 'מה המדיניות ביטול נסיעה?',
                a: (_jsx(_Fragment, { children: _jsxs("ul", { children: [_jsxs("li", { children: ["\u05D1\u05D9\u05D8\u05D5\u05DC \u05E2\u05D3 2 \u05D3\u05E7\u05D5\u05EA \u05DE\u05D4\u05D0\u05D9\u05E9\u05D5\u05E8 \u2014 ", _jsx("span", { className: "tag g", children: "\u05DC\u05DC\u05D0 \u05D7\u05D9\u05D5\u05D1" }), "."] }), _jsxs("li", { children: ["\u05D1\u05D9\u05D8\u05D5\u05DC \u05D0\u05D7\u05E8\u05D9 2 \u05D3\u05E7\u05D5\u05EA (\u05DC\u05D0\u05D7\u05E8 \u05E9\u05D4\u05E0\u05D4\u05D2 \u05D4\u05EA\u05E0\u05E2) \u2014 ", _jsx("span", { className: "tag y", children: "\u20AA10 \u05D3\u05DE\u05D9 \u05D1\u05D9\u05D8\u05D5\u05DC" }), "."] }), _jsxs("li", { children: ["\u05D0\u05D9-\u05D4\u05D5\u05E4\u05E2\u05D4 (no-show) \u2014 ", _jsx("span", { className: "tag r", children: "\u20AA20 \u05D7\u05D9\u05D5\u05D1" }), "."] })] }) })),
            },
        ],
    },
    {
        id: 'privacy',
        label: 'פרטיות ואבטחה',
        ico: '🔐',
        badge: 'לכולם',
        badgeClass: 'all',
        items: [
            {
                q: 'איזה מידע נאסף עלי?',
                a: (_jsx(_Fragment, { children: _jsxs("ul", { children: [_jsxs("li", { children: [_jsx("strong", { children: "\u05E0\u05D5\u05E1\u05E2:" }), " \u05DE\u05E1\u05E4\u05E8 \u05D8\u05DC\u05E4\u05D5\u05DF, \u05DE\u05D9\u05E7\u05D5\u05DD (\u05D1\u05D6\u05DE\u05DF \u05E0\u05E1\u05D9\u05E2\u05D4 \u05D1\u05DC\u05D1\u05D3), \u05D4\u05D9\u05E1\u05D8\u05D5\u05E8\u05D9\u05D9\u05EA \u05E0\u05E1\u05D9\u05E2\u05D5\u05EA."] }), _jsxs("li", { children: [_jsx("strong", { children: "\u05E0\u05D4\u05D2:" }), " \u05DE\u05E1\u05E4\u05E8 \u05D8\u05DC\u05E4\u05D5\u05DF, \u05E4\u05E8\u05D8\u05D9 \u05D6\u05D4\u05D5\u05EA (\u05D3\u05E8\u05DA Persona \u2014 \u05DE\u05D5\u05E6\u05E4\u05DF), \u05E4\u05E8\u05D8\u05D9 \u05E8\u05DB\u05D1."] }), _jsx("li", { children: "\u05DC\u05D0 \u05DE\u05D5\u05DB\u05E8\u05D9\u05DD \u05DE\u05D9\u05D3\u05E2 \u05DC\u05E6\u05D3 \u05E9\u05DC\u05D9\u05E9\u05D9. \u05DC\u05D0 \u05DE\u05E6\u05D9\u05D2\u05D9\u05DD \u05E4\u05E8\u05E1\u05D5\u05DE\u05D5\u05EA." })] }) })),
            },
            {
                q: 'האם מספר הטלפון שלי נחשף לנהג?',
                a: 'לא. הנהג לא רואה את מספר הטלפון שלך. כל התקשורת מתבצעת דרך הפלטפורמה. בסיום הנסיעה ניתן לתקשר עם הנהג דרך צ\'אט מובנה.',
            },
            {
                q: 'כיצד ניתן למחוק את החשבון?',
                a: 'שלחו "מחק חשבון" ל-WhatsApp שלנו (+44 7474 775344). מחיקה תושלם תוך 7 ימי עסקים. כל הנתונים נמחקים לצמיתות.',
            },
            {
                q: 'האם האתר עומד ב-GDPR ודיני הגנת הפרטיות בישראל?',
                a: 'כן. אנחנו עומדים בחוק הגנת הפרטיות הישראלי (תשמ"א-1981) ובתקנות GDPR של האיחוד האירופי. כל עיבוד נתונים מתועד ב-Privacy Policy.',
            },
        ],
    },
];
export default function FAQ() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('general');
    const [openIdx, setOpenIdx] = useState(null);
    useEffect(() => {
        const el = document.createElement('style');
        el.id = 'faq-css';
        el.textContent = CSS;
        document.head.appendChild(el);
        return () => { document.getElementById('faq-css')?.remove(); };
    }, []);
    // Reset open item when tab changes
    useEffect(() => { setOpenIdx(null); }, [activeTab]);
    const section = SECTIONS.find(s => s.id === activeTab) ?? SECTIONS[0];
    return (_jsxs("div", { className: "faq", children: [_jsxs("nav", { className: "faq-nav", children: [_jsxs("a", { href: "/", className: "faq-logo", onClick: e => { e.preventDefault(); navigate('/'); }, children: [_jsx("span", { className: "ac", children: "Easy" }), "Taxi \u05D9\u05E9\u05E8\u05D0\u05DC"] }), _jsx("button", { className: "faq-nav-back", onClick: () => navigate(-1), children: "\u2190 \u05D7\u05D6\u05D5\u05E8" })] }), _jsxs("div", { className: "faq-hero", children: [_jsx("div", { className: "faq-badge", children: "\u2753 \u05E9\u05D0\u05DC\u05D5\u05EA \u05D5\u05EA\u05E9\u05D5\u05D1\u05D5\u05EA" }), _jsxs("h1", { className: "faq-h1", children: ["\u05DB\u05DC \u05DE\u05D4 \u05E9\u05E8\u05E6\u05D9\u05EA", _jsx("br", {}), _jsx("span", { className: "gr", children: "\u05DC\u05D3\u05E2\u05EA \u05E2\u05DC EasyTaxi" })] }), _jsxs("p", { className: "faq-sub", children: ["\u05DE\u05D3\u05E8\u05D9\u05DA \u05DE\u05E4\u05D5\u05E8\u05D8 \u05DC\u05E0\u05D5\u05E1\u05E2\u05D9\u05DD, \u05E0\u05D4\u05D2\u05D9\u05DD \u05E2\u05E6\u05DE\u05D0\u05D9\u05D9\u05DD (\u05D7\u05D5\u05E7 2026) \u05D5\u05E0\u05D4\u05D2\u05D9 \u05DE\u05D5\u05E0\u05D9\u05EA \u05DE\u05D5\u05E8\u05E9\u05D9\u05DD.", _jsx("br", {}), "\u05DC\u05D0 \u05DE\u05E6\u05D0\u05EA \u05EA\u05E9\u05D5\u05D1\u05D4? \u05E4\u05E0\u05D4 \u05DC\u05EA\u05DE\u05D9\u05DB\u05D4 \u05D1-WhatsApp."] }), _jsx("div", { className: "faq-tabs", children: SECTIONS.map(s => (_jsxs("button", { className: `faq-tab${activeTab === s.id ? ' active' : ''}`, onClick: () => setActiveTab(s.id), children: [s.ico, " ", s.label] }, s.id))) })] }), _jsxs("div", { className: "faq-body", children: [_jsxs("div", { className: "faq-sec-head", children: [_jsx("span", { className: "faq-sec-ico", children: section.ico }), _jsx("span", { className: "faq-sec-title", children: section.label }), _jsx("span", { className: `faq-sec-badge ${section.badgeClass}`, children: section.badge })] }), section.items.map((item, i) => (_jsxs("div", { className: `faq-item${openIdx === i ? ' open' : ''}`, children: [_jsxs("button", { className: "faq-q", onClick: () => setOpenIdx(openIdx === i ? null : i), children: [_jsx("span", { children: item.q }), _jsx("span", { className: "faq-q-arrow", children: "\u25BC" })] }), _jsx("div", { className: "faq-a", children: typeof item.a === 'string' ? item.a : item.a })] }, i))), _jsx("div", { className: "faq-divider" }), _jsxs("div", { className: "faq-cta", children: [_jsx("h3", { children: "\u05E2\u05D3\u05D9\u05D9\u05DF \u05D9\u05E9 \u05E9\u05D0\u05DC\u05D5\u05EA?" }), _jsx("p", { children: "\u05E6\u05D5\u05D5\u05EA \u05D4\u05EA\u05DE\u05D9\u05DB\u05D4 \u05E9\u05DC\u05E0\u05D5 \u05D6\u05DE\u05D9\u05DF 24/7 \u2014 \u05D1-WhatsApp, \u05EA\u05D5\u05DA \u05D3\u05E7\u05D5\u05EA." }), _jsxs("div", { className: "faq-cta-btns", children: [_jsx("a", { href: "https://wa.me/447474775344?text=%D7%A9%D7%9C%D7%95%D7%9D%2C%20%D7%99%D7%A9%20%D7%9C%D7%99%20%D7%A9%D7%90%D7%9C%D7%94%20%D7%9C%D7%92%D7%91%D7%99%20EasyTaxi", target: "_blank", rel: "noopener noreferrer", className: "faq-btn w", children: "\uD83D\uDCAC WhatsApp \u05EA\u05DE\u05D9\u05DB\u05D4" }), _jsx("a", { href: "/login", className: "faq-btn p", children: "\uD83D\uDE95 \u05D4\u05EA\u05D7\u05DC \u05E2\u05DB\u05E9\u05D9\u05D5" }), _jsx("a", { href: "/driver", className: "faq-btn g", children: "\uD83D\uDE97 \u05D4\u05E6\u05D8\u05E8\u05E3 \u05DB\u05E0\u05D4\u05D2" })] })] })] }), _jsx("a", { href: "https://wa.me/447474775344", target: "_blank", rel: "noopener noreferrer", className: "faq-wa", title: "\u05EA\u05DE\u05D9\u05DB\u05D4 \u05D1-WhatsApp", children: "\uD83D\uDCAC" })] }));
}
