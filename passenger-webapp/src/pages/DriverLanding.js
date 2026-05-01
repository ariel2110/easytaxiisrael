import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
const WA = 'https://wa.me/972552858732?text=%D7%A9%D7%9C%D7%95%D7%9D%2C%20%D7%90%D7%A0%D7%99%20%D7%A8%D7%95%D7%A6%D7%94%20%D7%9C%D7%94%D7%A6%D7%98%D7%A3%20%D7%9B%D7%A0%D7%94%D7%92%20%F0%9F%9A%97';
const CSS = `
.dp *, .dp *::before, .dp *::after { box-sizing: border-box; margin: 0; padding: 0; }
.dp {
  --bg:    #04080D;
  --green: #22C55E;
  --grn2:  #16A34A;
  --greeng: rgba(34,197,94,.25);
  --white: #F1F5F9;
  --muted: #94A3B8;
  --card:  rgba(255,255,255,.04);
  --cb:    rgba(255,255,255,.08);
  --r:     16px;
  background: var(--bg);
  color: var(--white);
  font-family: 'Heebo','Segoe UI',Arial,sans-serif;
  direction: rtl;
  overflow-x: hidden;
  line-height: 1.5;
  padding-bottom: 80px;
}
/* NAV */
.dp-nav{position:fixed;top:0;left:0;right:0;z-index:200;display:flex;align-items:center;justify-content:space-between;padding:16px 32px;background:rgba(4,8,13,.75);backdrop-filter:blur(20px);border-bottom:1px solid rgba(34,197,94,.07);transition:padding .3s,background .3s;}
.dp-nav.sc{padding:11px 32px;background:rgba(4,8,13,.97);}
.dp-logo{font-size:1.15rem;font-weight:800;letter-spacing:-.02em;}
.dp-logo .ac{color:var(--green);}
.dp-nr{display:flex;align-items:center;gap:10px;}
.dp-nl{padding:8px 18px;border-radius:9px;border:1px solid rgba(34,197,94,.28);color:var(--green);background:transparent;font:600 .9rem 'Heebo',sans-serif;cursor:pointer;text-decoration:none;transition:all .2s;}
.dp-nl:hover{background:rgba(34,197,94,.08);}
/* HERO */
.dp-hero{min-height:100vh;display:flex;align-items:center;justify-content:center;position:relative;padding:120px 24px 80px;overflow:hidden;text-align:center;}
.dp-hbg{position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 50% 15%,rgba(34,197,94,.18) 0%,transparent 60%),radial-gradient(ellipse 50% 40% at 80% 85%,rgba(22,163,74,.1) 0%,transparent 50%),linear-gradient(180deg,#04080D 0%,#040D06 100%);}
.dp-hgrid{position:absolute;inset:0;background-image:linear-gradient(rgba(34,197,94,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(34,197,94,.03) 1px,transparent 1px);background-size:60px 60px;-webkit-mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 0%,transparent 70%);mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 0%,transparent 70%);}
.dp-hi{position:relative;z-index:1;max-width:700px;margin:0 auto;}
.dp-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);border-radius:100px;padding:6px 18px;font-size:.8rem;color:var(--green);margin-bottom:24px;font-weight:700;}
.dp-fire{animation:dpFi .9s ease-in-out infinite;}
@keyframes dpFi{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}
.dp-h1{font-size:clamp(2.4rem,6vw,4.6rem);font-weight:900;line-height:1.08;letter-spacing:-.03em;margin-bottom:18px;}
.dp-h1 .gr{background:linear-gradient(135deg,#86EFAC 0%,#22C55E 50%,#16A34A 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.dp-hs{font-size:clamp(.95rem,2.5vw,1.15rem);color:var(--muted);margin-bottom:14px;line-height:1.65;}
.dp-urg{font-size:.82rem;color:var(--green);font-weight:600;margin-bottom:36px;display:flex;align-items:center;justify-content:center;gap:7px;}
.dp-udot{width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green);animation:dpPl 2s ease-in-out infinite;}
@keyframes dpPl{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.3)}}
/* Buttons */
.dp-btx{padding:17px 34px;border-radius:13px;font:700 1.05rem 'Heebo',sans-serif;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:9px;transition:all .25s;border:none;}
.dp-btx.g{background:linear-gradient(135deg,var(--green),var(--grn2));color:#fff;box-shadow:0 4px 24px rgba(34,197,94,.4);}
.dp-btx.g:hover{transform:translateY(-3px);box-shadow:0 10px 36px rgba(34,197,94,.55);}
.dp-btx.gh{background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.28);color:var(--green);}
.dp-btx.gh:hover{background:rgba(34,197,94,.18);transform:translateY(-3px);}
.dp-hb{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;}
/* INCOME */
.dp-income{background:linear-gradient(135deg,#050F08 0%,#071410 100%);border-top:1px solid rgba(34,197,94,.12);border-bottom:1px solid rgba(34,197,94,.12);padding:56px 24px;}
.dp-ic{max-width:920px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:52px;align-items:center;}
.dp-itext h2{font-size:clamp(1.8rem,4vw,2.8rem);font-weight:900;margin-bottom:14px;line-height:1.15;}
.dp-itext p{color:var(--muted);font-size:.98rem;line-height:1.65;margin-bottom:28px;}
.dp-istat{display:flex;gap:12px;flex-wrap:wrap;}
.dp-is{text-align:center;padding:13px 18px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.15);border-radius:12px;min-width:82px;}
.dp-isn{font-size:1.4rem;font-weight:900;color:var(--green);}
.dp-isl{font-size:.72rem;color:var(--muted);margin-top:3px;}
.dp-icard{background:rgba(255,255,255,.04);border:1px solid rgba(34,197,94,.14);border-radius:22px;padding:28px;text-align:center;animation:dpFl 5s ease-in-out infinite;}
@keyframes dpFl{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.dp-ib{background:linear-gradient(135deg,rgba(34,197,94,.18),rgba(22,163,74,.07));border:1px solid rgba(34,197,94,.24);border-radius:14px;padding:22px;margin-bottom:14px;}
.dp-il{font-size:.76rem;color:var(--muted);margin-bottom:5px;}
.dp-imain{font-size:3.4rem;font-weight:900;color:var(--green);line-height:1;}
.dp-ip{font-size:.8rem;color:var(--muted);margin-top:4px;}
.dp-ig{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:14px;}
.dp-im{background:rgba(255,255,255,.04);border-radius:10px;padding:12px;}
.dp-imn{font-size:1.2rem;font-weight:800;color:var(--green);}
.dp-iml{font-size:.7rem;color:var(--muted);margin-top:2px;}
/* SECTION */
.dp-sec{padding:72px 24px;max-width:1060px;margin:0 auto;}
.dp-stripe{background:rgba(255,255,255,.02);border-top:1px solid rgba(255,255,255,.05);border-bottom:1px solid rgba(255,255,255,.05);padding:72px 0;}
.dp-stripe .dp-sec{padding-top:0;padding-bottom:0;}
.dp-ey{font-size:.72rem;text-transform:uppercase;letter-spacing:3px;color:var(--green);text-align:center;margin-bottom:10px;font-weight:700;}
.dp-t2{font-size:clamp(1.9rem,4vw,2.8rem);font-weight:800;text-align:center;margin-bottom:12px;line-height:1.15;}
.dp-sub{text-align:center;color:var(--muted);font-size:.97rem;max-width:480px;margin:0 auto 48px;line-height:1.65;}
/* Benefits */
.dp-g4{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:15px;}
.dp-fc{background:var(--card);border:1px solid var(--cb);border-radius:var(--r);padding:26px 22px;position:relative;overflow:hidden;transition:transform .3s,background .3s,border-color .3s;}
.dp-fc::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--green),#86EFAC);opacity:0;transition:opacity .3s;}
.dp-fc:hover{transform:translateY(-5px);background:rgba(34,197,94,.06);border-color:rgba(34,197,94,.2);}
.dp-fc:hover::before{opacity:1;}
.dp-fi{font-size:1.9rem;margin-bottom:12px;}
.dp-ftt{font-size:.97rem;font-weight:700;margin-bottom:7px;}
.dp-fd{font-size:.85rem;color:var(--muted);line-height:1.6;}
/* Steps */
.dp-steps{display:flex;justify-content:center;flex-wrap:wrap;max-width:820px;margin:0 auto;gap:8px;}
.dp-step{flex:1;min-width:150px;text-align:center;padding:0 14px;position:relative;}
.dp-step:not(:last-child)::after{content:'';position:absolute;top:24px;left:0;width:100%;height:2px;background:linear-gradient(90deg,rgba(34,197,94,.5),rgba(34,197,94,.05));z-index:0;}
.dp-sc{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,var(--green),var(--grn2));color:#fff;font-size:1.1rem;font-weight:800;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;position:relative;z-index:1;box-shadow:0 0 20px rgba(34,197,94,.35);}
.dp-sico{font-size:1.6rem;margin-bottom:8px;}
.dp-stit{font-size:.92rem;font-weight:700;margin-bottom:4px;}
.dp-sdesc{font-size:.8rem;color:var(--muted);line-height:1.55;}
/* Testimonials */
.dp-tg{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;max-width:880px;margin:0 auto;}
.dp-tc{background:var(--card);border:1px solid var(--cb);border-radius:var(--r);padding:24px 22px;transition:transform .3s,border-color .3s;}
.dp-tc:hover{transform:translateY(-3px);border-color:rgba(34,197,94,.2);}
.dp-tq{font-size:.9rem;line-height:1.68;margin-bottom:16px;color:#CBD5E1;}
.dp-ta{display:flex;align-items:center;gap:10px;}
.dp-tav{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--green),var(--grn2));display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;}
.dp-tan{font-size:.84rem;font-weight:700;}
.dp-tar{font-size:.74rem;color:var(--green);}
/* FAQ */
.dp-faq{max-width:680px;margin:0 auto;display:flex;flex-direction:column;gap:10px;}
.dp-fq{background:var(--card);border:1px solid var(--cb);border-radius:12px;overflow:hidden;cursor:pointer;}
.dp-fqh{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;font-weight:600;font-size:.95rem;user-select:none;gap:12px;transition:background .2s;}
.dp-fqh:hover{background:rgba(34,197,94,.05);}
.dp-fqarr{color:var(--green);font-size:1.1rem;transition:transform .25s;flex-shrink:0;}
.dp-fq.open .dp-fqarr{transform:rotate(180deg);}
.dp-fqb{display:none;padding:0 22px 18px;color:var(--muted);font-size:.88rem;line-height:1.65;}
.dp-fq.open .dp-fqb{display:block;}
/* CTA */
.dp-ctaw{text-align:center;padding:96px 24px;position:relative;overflow:hidden;}
.dp-ctag{position:absolute;inset:0;background:radial-gradient(ellipse 70% 55% at 50% 50%,rgba(34,197,94,.15) 0%,transparent 65%);}
.dp-ctat{font-size:clamp(2rem,5vw,3.4rem);font-weight:900;margin-bottom:14px;position:relative;z-index:1;}
.dp-ctas{color:var(--muted);font-size:1rem;margin-bottom:38px;position:relative;z-index:1;}
.dp-ctab{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;position:relative;z-index:1;}
/* Footer */
.dp-ftr{padding:28px 24px;border-top:1px solid rgba(255,255,255,.06);text-align:center;color:var(--muted);font-size:.83rem;}
.dp-ftr a{color:rgba(34,197,94,.8);text-decoration:none;margin:0 10px;}
.dp-ftr a:hover{color:var(--green);}
/* Floating WA */
.dp-wa{position:fixed;bottom:96px;left:22px;z-index:300;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#25D366,#128C7E);box-shadow:0 4px 18px rgba(37,211,102,.5);display:flex;align-items:center;justify-content:center;font-size:1.7rem;text-decoration:none;animation:dpWp 3s ease-in-out infinite;}
@keyframes dpWp{0%,100%{box-shadow:0 4px 18px rgba(37,211,102,.5),0 0 0 0 rgba(37,211,102,.3)}50%{box-shadow:0 4px 18px rgba(37,211,102,.5),0 0 0 14px rgba(37,211,102,0)}}
/* Sticky bar */
.dp-sticky{position:fixed;bottom:0;left:0;right:0;z-index:250;background:rgba(4,8,13,.97);border-top:1px solid rgba(34,197,94,.2);backdrop-filter:blur(16px);padding:12px 24px;display:flex;align-items:center;justify-content:space-between;gap:14px;transform:translateY(100%);transition:transform .4s ease;}
.dp-sticky.show{transform:translateY(0);}
.dp-stxt{font-size:.88rem;color:var(--muted);}
.dp-stxt strong{color:var(--white);}
/* Animate in */
.dp-in{opacity:0;transform:translateY(24px);transition:opacity .6s ease,transform .6s ease;}
.dp-in.v{opacity:1;transform:translateY(0);}
.dp-d1{transition-delay:.07s;}.dp-d2{transition-delay:.15s;}.dp-d3{transition-delay:.23s;}.dp-d4{transition-delay:.31s;}
/* Mobile */
@media(max-width:760px){
  .dp-nav{padding:13px 18px;}
  .dp-ic{grid-template-columns:1fr;gap:32px;}
  .dp-step{min-width:120px;}
  .dp-step:not(:last-child)::after{display:none;}
  .dp-steps{gap:16px;}
  .dp-btx{padding:14px 22px;font-size:.95rem;}
  .dp-stxt{display:none;}
}
`;
export default function DriverLanding() {
    const [scrolled, setScrolled] = useState(false);
    const [sticky, setSticky] = useState(false);
    const [openFaq, setOpenFaq] = useState(null);
    useEffect(() => {
        const el = document.createElement('style');
        el.id = '__dp';
        el.textContent = CSS;
        document.head.appendChild(el);
        const prevBg = document.body.style.background;
        document.body.style.background = '#04080D';
        const tick = () => {
            const y = window.scrollY;
            setScrolled(y > 44);
            setSticky(y > 500);
            document.querySelectorAll('.dp-in').forEach(n => {
                if (n.getBoundingClientRect().top < window.innerHeight - 60)
                    n.classList.add('v');
            });
        };
        window.addEventListener('scroll', tick, { passive: true });
        setTimeout(tick, 60);
        return () => {
            window.removeEventListener('scroll', tick);
            document.getElementById('__dp')?.remove();
            document.body.style.background = prevBg;
        };
    }, []);
    const faqs = [
        { q: 'כמה עולה להצטרף?', a: 'אפס שקל. ההצטרפות חינמית לחלוטין. אין דמי רישום, אין עמלות חבילה, אין הפתעות.' },
        { q: 'מה הדרישות?', a: 'רישיון נהיגה בתוקף, ביטוח מסחרי ורכב לא ישן מ-2015. הבדיקה מהירה ודיגיטלית.' },
        { q: 'מתי מקבלים תשלום?', a: 'כל נסיעה מועברת ישירות לחשבון. אין המתנה של שבוע — שקיפות מלאה בזמן אמת.' },
        { q: 'באיזה אזורים פועלת המערכת?', a: 'פעיל בכל הארץ — תל אביב, ירושלים, חיפה, באר שבע ועוד. מתרחבים כל הזמן.' },
    ];
    return (_jsxs("div", { className: "dp", children: [_jsxs("nav", { className: `dp-nav${scrolled ? ' sc' : ''}`, children: [_jsxs("div", { className: "dp-logo", children: ["\uD83D\uDE95 Easy", _jsx("span", { className: "ac", children: "Taxi" }), " Israel"] }), _jsxs("div", { className: "dp-nr", children: [_jsx("a", { href: "/", className: "dp-nl", children: "\u05D3\u05E3 \u05E8\u05D0\u05E9\u05D9" }), _jsx("a", { href: WA, target: "_blank", rel: "noopener noreferrer", className: "dp-btx g", style: { padding: '8px 18px', fontSize: '.88rem' }, children: "\uD83D\uDCAC \u05D4\u05E6\u05D8\u05E8\u05E3" })] })] }), _jsxs("section", { className: "dp-hero", children: [_jsx("div", { className: "dp-hbg" }), _jsx("div", { className: "dp-hgrid" }), _jsxs("div", { className: "dp-hi", children: [_jsxs("div", { className: "dp-badge", children: [_jsx("span", { className: "dp-fire", children: "\uD83D\uDD25" }), "\u05DE\u05D2\u05D9\u05D9\u05E1\u05D9\u05DD \u05E0\u05D4\u05D2\u05D9\u05DD \u05E2\u05DB\u05E9\u05D9\u05D5 \u05D1\u05DB\u05DC \u05D4\u05D0\u05E8\u05E5"] }), _jsxs("h1", { className: "dp-h1", children: [_jsx("span", { className: "gr", children: "\u05E8\u05D5\u05E6\u05D4 \u05DC\u05D4\u05E8\u05D5\u05D5\u05D9\u05D7" }), _jsx("br", {}), "\u05D9\u05D5\u05EA\u05E8 \u05DB\u05E0\u05D4\u05D2?"] }), _jsx("p", { className: "dp-hs", children: "\u05D9\u05D5\u05EA\u05E8 \u05E0\u05E1\u05D9\u05E2\u05D5\u05EA \u2022 \u05E4\u05D7\u05D5\u05EA \u05D6\u05DE\u05DF \u05D4\u05DE\u05EA\u05E0\u05D4 \u2022 \u05E9\u05DC\u05D9\u05D8\u05D4 \u05DE\u05DC\u05D0\u05D4 \u05E2\u05DC \u05D4\u05DC\u05D5\"\u05D6" }), _jsxs("div", { className: "dp-urg", children: [_jsx("span", { className: "dp-udot" }), "47 \u05E0\u05D4\u05D2\u05D9\u05DD \u05D4\u05E6\u05D8\u05E8\u05E4\u05D5 \u05D4\u05E9\u05D1\u05D5\u05E2 \u05D4\u05D0\u05D7\u05E8\u05D5\u05DF"] }), _jsxs("div", { className: "dp-hb", children: [_jsx("a", { href: WA, target: "_blank", rel: "noopener noreferrer", className: "dp-btx g", children: "\uD83D\uDCAC \u05D4\u05E6\u05D8\u05E8\u05E3 \u05E2\u05DB\u05E9\u05D9\u05D5 \u05D1\u05D5\u05D5\u05D0\u05D8\u05E1\u05D0\u05E4" }), _jsx("a", { href: "/driver/onboarding", className: "dp-btx gh", children: "\uD83D\uDCCB \u05D8\u05D5\u05E4\u05E1 \u05D4\u05E6\u05D8\u05E8\u05E4\u05D5\u05EA" })] })] })] }), _jsx("div", { className: "dp-income", children: _jsxs("div", { className: "dp-ic", children: [_jsxs("div", { className: "dp-itext", children: [_jsxs("h2", { children: ["\u05E0\u05D4\u05D2\u05D9\u05DD \u05E9\u05DC\u05E0\u05D5", _jsx("br", {}), _jsx("span", { style: { color: 'var(--green)' }, children: "\u05DE\u05E8\u05D5\u05D5\u05D9\u05D7\u05D9\u05DD \u05D9\u05D5\u05EA\u05E8" })] }), _jsx("p", { children: "AI \u05DE\u05E0\u05EA\u05D1 \u05D0\u05DC\u05D9\u05DA \u05E0\u05E1\u05D9\u05E2\u05D5\u05EA \u05DE\u05D4\u05D0\u05D6\u05D5\u05E8 \u05E9\u05DC\u05DA. \u05D0\u05EA\u05D4 \u05DC\u05D0 \u05DE\u05D7\u05E4\u05E9 \u05E0\u05D5\u05E1\u05E2\u05D9\u05DD \u2014 \u05D4\u05DD \u05DE\u05D5\u05E6\u05D0\u05D9\u05DD \u05D0\u05D5\u05EA\u05DA." }), _jsx("div", { className: "dp-istat", children: [['₪480', 'ממוצע יומי'], ['12', 'נסיעות/יום'], ['0 ₪', 'עמלת כניסה'], ['4.9 ⭐', 'דירוג']].map(([n, l], i) => (_jsxs("div", { className: "dp-is", children: [_jsx("div", { className: "dp-isn", children: n }), _jsx("div", { className: "dp-isl", children: l })] }, i))) })] }), _jsxs("div", { className: "dp-icard", children: [_jsxs("div", { className: "dp-ib", children: [_jsx("div", { className: "dp-il", children: "\u05D4\u05DB\u05E0\u05E1\u05D4 \u05D9\u05D5\u05DE\u05D9\u05EA \u05DE\u05DE\u05D5\u05E6\u05E2\u05EA" }), _jsx("div", { className: "dp-imain", children: "\u20AA480" }), _jsx("div", { className: "dp-ip", children: "8 \u05E9\u05E2\u05D5\u05EA \u05E2\u05D1\u05D5\u05D3\u05D4" })] }), _jsxs("div", { className: "dp-ig", children: [_jsxs("div", { className: "dp-im", children: [_jsx("div", { className: "dp-imn", children: "\u20AA2,400" }), _jsx("div", { className: "dp-iml", children: "\u05E9\u05D1\u05D5\u05E2\u05D9" })] }), _jsxs("div", { className: "dp-im", children: [_jsx("div", { className: "dp-imn", children: "\u20AA9,600" }), _jsx("div", { className: "dp-iml", children: "\u05D7\u05D5\u05D3\u05E9\u05D9" })] }), _jsxs("div", { className: "dp-im", children: [_jsx("div", { className: "dp-imn", children: "8 \u05D3\u05E7'" }), _jsx("div", { className: "dp-iml", children: "\u05D4\u05DE\u05EA\u05E0\u05D4 \u05DE\u05DE\u05D5\u05E6\u05E2\u05EA" })] }), _jsxs("div", { className: "dp-im", children: [_jsx("div", { className: "dp-imn", children: "100%" }), _jsx("div", { className: "dp-iml", children: "\u05E9\u05E7\u05D9\u05E4\u05D5\u05EA" })] })] }), _jsx("div", { style: { fontSize: '.73rem', color: 'var(--muted)' }, children: "* \u05DE\u05DE\u05D5\u05E6\u05E2 \u05E0\u05D4\u05D2\u05D9\u05DD \u05E4\u05E2\u05D9\u05DC\u05D9\u05DD" })] })] }) }), _jsxs("div", { className: "dp-sec", children: [_jsx("p", { className: "dp-ey dp-in", children: "\u05DC\u05DE\u05D4 EasyTaxi" }), _jsx("h2", { className: "dp-t2 dp-in", children: "\u05D9\u05EA\u05E8\u05D5\u05E0\u05D5\u05EA \u05E9\u05EA\u05E8\u05D2\u05D9\u05E9 \u05D1\u05DB\u05D9\u05E1" }), _jsx("p", { className: "dp-sub dp-in", children: "\u05DC\u05D0 \u05E2\u05D5\u05D3 \u05E9\u05E2\u05D5\u05EA \u05D4\u05DE\u05EA\u05E0\u05D4 \u05E8\u05D9\u05E7\u05D5\u05EA \u2014 \u05D4\u05DE\u05E2\u05E8\u05DB\u05EA \u05E2\u05D5\u05D1\u05D3\u05EA \u05D1\u05E9\u05D1\u05D9\u05DC\u05DA" }), _jsx("div", { className: "dp-g4", children: [
                            { ico: '💰', t: 'יותר כסף', d: 'אלגוריתם חכם מנתב אליך נוסעים מהאזור שלך. פחות נסיעות ריקות, יותר הכנסה.' },
                            { ico: '🔥', t: 'התראות אזורים חמים', d: 'Push בזמן אמת על פיקי ביקוש. תהיה שם לפני כולם, תרוויח יותר.' },
                            { ico: '🤖', t: 'AI שעובד בשבילך', d: 'המערכת לומדת את הרגלי הנסיעה שלך ומתאימה את ההצעות אוטומטית.' },
                            { ico: '⏱️', t: 'פחות זמן המתנה', d: 'ממוצע 8 דקות בין נסיעות. לא 30. הנהגים שלנו עסוקים יותר.' },
                        ].map((f, i) => (_jsxs("div", { className: `dp-fc dp-in dp-d${i + 1}`, children: [_jsx("div", { className: "dp-fi", children: f.ico }), _jsx("div", { className: "dp-ftt", children: f.t }), _jsx("div", { className: "dp-fd", children: f.d })] }, i))) })] }), _jsx("div", { className: "dp-stripe", children: _jsxs("div", { className: "dp-sec", children: [_jsx("p", { className: "dp-ey dp-in", children: "\u05E4\u05E9\u05D5\u05D8 \u05DE\u05D0\u05D5\u05D3" }), _jsx("h2", { className: "dp-t2 dp-in", children: "\u05DE\u05E6\u05D8\u05E8\u05E4\u05D9\u05DD \u05EA\u05D5\u05DA 10 \u05D3\u05E7\u05D5\u05EA" }), _jsx("p", { className: "dp-sub dp-in", children: "\u05EA\u05D4\u05DC\u05D9\u05DA \u05D3\u05D9\u05D2\u05D9\u05D8\u05DC\u05D9 \u05DE\u05DC\u05D0 \u2014 \u05D1\u05DC\u05D9 \u05EA\u05D5\u05E8\u05D9\u05DD, \u05D1\u05DC\u05D9 \u05E0\u05D9\u05D9\u05E8\u05EA" }), _jsx("div", { className: "dp-steps", children: [
                                { n: '1', ico: '💬', t: 'שולחים הודעה', d: 'לוחצים "הצטרף בוואטסאפ" — נציג עונה תוך דקות' },
                                { n: '2', ico: '📄', t: 'מעלים מסמכים', d: 'רישיון, ביטוח, תעודת זהות — הכל דיגיטלי' },
                                { n: '3', ico: '✅', t: 'אישור מהיר', d: 'בדיקה אוטומטית + אנושית — ב-24 שעות' },
                                { n: '4', ico: '🚗', t: 'מתחילים לנסוע', d: 'האפליקציה פעילה ונסיעות מתחילות לזרום' },
                            ].map((s, i) => (_jsxs("div", { className: `dp-step dp-in dp-d${i + 1}`, children: [_jsx("div", { className: "dp-sc", children: s.n }), _jsx("div", { className: "dp-sico", children: s.ico }), _jsx("div", { className: "dp-stit", children: s.t }), _jsx("div", { className: "dp-sdesc", children: s.d })] }, i))) })] }) }), _jsxs("div", { className: "dp-sec", children: [_jsx("p", { className: "dp-ey dp-in", children: "\u05E0\u05D4\u05D2\u05D9\u05DD \u05DE\u05E1\u05E4\u05E8\u05D9\u05DD" }), _jsx("h2", { className: "dp-t2 dp-in", children: "\u05D4\u05DD \u05DB\u05D1\u05E8 \u05DE\u05E8\u05D5\u05D5\u05D9\u05D7\u05D9\u05DD \u05D9\u05D5\u05EA\u05E8" }), _jsx("p", { className: "dp-sub dp-in", children: "\u05E0\u05D4\u05D2\u05D9\u05DD \u05D0\u05DE\u05D9\u05EA\u05D9\u05D9\u05DD. \u05EA\u05D5\u05E6\u05D0\u05D5\u05EA \u05D0\u05DE\u05D9\u05EA\u05D9\u05D5\u05EA." }), _jsx("div", { className: "dp-tg", children: [
                            { q: '"הצטרפתי לפני חודשיים ועברתי מ-₪280 ביום ל-₪460. ההתראות על אזורים חמים שינו לי את התמונה לגמרי."', name: 'דוד כ.', city: 'תל אביב', stars: '★★★★★' },
                            { q: '"לא האמנתי שאפשר להצטרף בלי לשלם שקל. אפס עמלות כניסה, ובתוך 24 שעות כבר נסעתי."', name: 'מוחמד א.', city: 'חיפה', stars: '★★★★★' },
                            { q: '"המערכת פשוט שולחת אלי נסיעות. לא צריך לחפש. הערב הרווחתי ₪520 ב-9 שעות."', name: 'יוסי ל.', city: 'ירושלים', stars: '★★★★★' },
                        ].map((t, i) => (_jsxs("div", { className: `dp-tc dp-in dp-d${i + 1}`, children: [_jsx("p", { className: "dp-tq", children: t.q }), _jsxs("div", { className: "dp-ta", children: [_jsx("div", { className: "dp-tav", children: "\uD83D\uDE97" }), _jsxs("div", { children: [_jsxs("div", { className: "dp-tan", children: [t.name, " \u00B7 ", t.city] }), _jsx("div", { className: "dp-tar", children: t.stars })] })] })] }, i))) })] }), _jsx("div", { className: "dp-stripe", children: _jsxs("div", { className: "dp-sec", children: [_jsx("p", { className: "dp-ey dp-in", children: "\u05E9\u05D0\u05DC\u05D5\u05EA \u05E0\u05E4\u05D5\u05E6\u05D5\u05EA" }), _jsx("h2", { className: "dp-t2 dp-in", children: "\u05D9\u05E9 \u05DC\u05DA \u05E9\u05D0\u05DC\u05D5\u05EA?" }), _jsx("p", { className: "dp-sub dp-in", children: "\u05D4\u05DB\u05D9 \u05E0\u05E4\u05D5\u05E6\u05D5\u05EA \u2014 \u05D5\u05D0\u05DD \u05DC\u05D0 \u05DE\u05E6\u05D0\u05EA, \u05E9\u05DC\u05D7 \u05D4\u05D5\u05D3\u05E2\u05D4" }), _jsx("div", { className: "dp-faq", children: faqs.map((f, i) => (_jsxs("div", { className: `dp-fq dp-in${openFaq === i ? ' open' : ''}`, onClick: () => setOpenFaq(openFaq === i ? null : i), children: [_jsxs("div", { className: "dp-fqh", children: [_jsx("span", { children: f.q }), _jsx("span", { className: "dp-fqarr", children: "\u25BE" })] }), _jsx("div", { className: "dp-fqb", children: f.a })] }, i))) })] }) }), _jsxs("section", { className: "dp-ctaw", children: [_jsx("div", { className: "dp-ctag" }), _jsxs("h2", { className: "dp-ctat dp-in", children: ["\u05DE\u05D5\u05DB\u05DF \u05DC\u05D4\u05EA\u05D7\u05D9\u05DC", _jsx("br", {}), "\u05DC\u05D4\u05E8\u05D5\u05D5\u05D9\u05D7 \u05D9\u05D5\u05EA\u05E8?"] }), _jsx("p", { className: "dp-ctas dp-in", children: "\u05D4\u05D4\u05E6\u05D8\u05E8\u05E4\u05D5\u05EA \u05D7\u05D9\u05E0\u05DE\u05D9\u05EA. \u05D4\u05EA\u05D2\u05D5\u05D1\u05D4 \u05DE\u05D4\u05D9\u05E8\u05D4. \u05D4\u05E8\u05D5\u05D5\u05D7 \u2014 \u05DE\u05D9\u05D3\u05D9." }), _jsxs("div", { className: "dp-ctab", children: [_jsx("a", { href: WA, target: "_blank", rel: "noopener noreferrer", className: "dp-btx g", style: { fontSize: '1.1rem', padding: '18px 38px' }, children: "\uD83D\uDCAC \u05E9\u05DC\u05D7 \u05D4\u05D5\u05D3\u05E2\u05D4 \u05D1\u05D5\u05D5\u05D0\u05D8\u05E1\u05D0\u05E4" }), _jsx("a", { href: "/driver/onboarding", className: "dp-btx gh", style: { fontSize: '1.1rem', padding: '18px 38px' }, children: "\uD83D\uDCCB \u05D8\u05D5\u05E4\u05E1 \u05D4\u05E8\u05E9\u05DE\u05D4" })] })] }), _jsxs("footer", { className: "dp-ftr", children: [_jsxs("div", { children: ["\uD83D\uDE95 EasyTaxi Israel \u00A9 ", new Date().getFullYear()] }), _jsxs("div", { style: { marginTop: '8px' }, children: [_jsx("a", { href: "/", children: "\u05D3\u05E3 \u05E8\u05D0\u05E9\u05D9" }), _jsx("a", { href: "/app", children: "\u05D4\u05D6\u05DE\u05DF \u05E0\u05E1\u05D9\u05E2\u05D4" }), _jsx("a", { href: WA, target: "_blank", rel: "noopener noreferrer", children: "WhatsApp" })] })] }), _jsx("a", { href: WA, target: "_blank", rel: "noopener noreferrer", className: "dp-wa", title: "\u05E9\u05DC\u05D7 \u05D4\u05D5\u05D3\u05E2\u05D4 \u05D1\u05D5\u05D5\u05D0\u05D8\u05E1\u05D0\u05E4", children: "\uD83D\uDCAC" }), _jsxs("div", { className: `dp-sticky${sticky ? ' show' : ''}`, children: [_jsxs("div", { className: "dp-stxt", children: [_jsx("strong", { children: "\u05DE\u05E6\u05D8\u05E8\u05E4\u05D9\u05DD \u05E2\u05DB\u05E9\u05D9\u05D5 \u2014" }), " 47 \u05E0\u05D4\u05D2\u05D9\u05DD \u05D4\u05E6\u05D8\u05E8\u05E4\u05D5 \u05D4\u05E9\u05D1\u05D5\u05E2"] }), _jsx("a", { href: WA, target: "_blank", rel: "noopener noreferrer", className: "dp-btx g", style: { padding: '11px 24px', fontSize: '.95rem' }, children: "\uD83D\uDCAC \u05D4\u05E6\u05D8\u05E8\u05E3 \u05D1\u05D5\u05D5\u05D0\u05D8\u05E1\u05D0\u05E4" })] })] }));
}
