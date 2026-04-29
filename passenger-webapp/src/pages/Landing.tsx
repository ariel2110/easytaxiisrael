import { useEffect, useState } from 'react'

/* ─── Self-contained styles (injected once, removed on unmount) ──────────── */
const CSS = `
.lp *, .lp *::before, .lp *::after { box-sizing: border-box; margin: 0; padding: 0; }
.lp {
  --bg:    #070B14;
  --bg2:   #0D1526;
  --blue:  #2563EB;
  --blue2: #1D4ED8;
  --bluel: #60A5FA;
  --blueg: rgba(37,99,235,.28);
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
}
.lp-nav {
  position:fixed;top:0;left:0;right:0;z-index:200;
  display:flex;align-items:center;justify-content:space-between;
  padding:18px 32px;
  background:rgba(7,11,20,.7);
  backdrop-filter:blur(20px);
  border-bottom:1px solid rgba(255,255,255,.06);
  transition:padding .3s,background .3s;
}
.lp-nav.sc{padding:12px 32px;background:rgba(7,11,20,.96);}
.lp-logo{font-size:1.2rem;font-weight:800;letter-spacing:-.02em;}
.lp-logo .ac{color:var(--bluel);}
.lp-navr{display:flex;align-items:center;gap:10px;}
.lp-ng{padding:8px 18px;border-radius:9px;border:1px solid rgba(96,165,250,.35);color:var(--bluel);background:transparent;font:600 .9rem 'Heebo',sans-serif;cursor:pointer;text-decoration:none;transition:all .2s;}
.lp-ng:hover{background:rgba(96,165,250,.1);border-color:var(--bluel);}
.lp-ns{padding:8px 20px;border-radius:9px;background:var(--blue);color:#fff;border:none;font:700 .9rem 'Heebo',sans-serif;cursor:pointer;text-decoration:none;transition:all .2s;}
.lp-ns:hover{background:var(--blue2);transform:translateY(-1px);box-shadow:0 6px 20px var(--blueg);}
/* Hero */
.lp-hero{min-height:100vh;display:flex;align-items:center;position:relative;padding:130px 24px 90px;overflow:hidden;}
.lp-hbg{position:absolute;inset:0;z-index:0;background:radial-gradient(ellipse 90% 70% at 50% -10%,rgba(37,99,235,.22) 0%,transparent 65%),radial-gradient(ellipse 50% 50% at 80% 90%,rgba(29,78,216,.14) 0%,transparent 55%),linear-gradient(180deg,#070B14 0%,#0C1322 100%);}
.lp-hgrid{position:absolute;inset:0;z-index:0;background-image:linear-gradient(rgba(37,99,235,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(37,99,235,.04) 1px,transparent 1px);background-size:64px 64px;-webkit-mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 0%,transparent 70%);mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 0%,transparent 70%);}
.lp-hi{position:relative;z-index:1;max-width:720px;margin:0 auto;text-align:center;}
.lp-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(37,99,235,.14);border:1px solid rgba(96,165,250,.28);border-radius:100px;padding:6px 18px;font-size:.8rem;color:var(--bluel);margin-bottom:28px;font-weight:600;}
.lp-bdot{width:7px;height:7px;border-radius:50%;background:#22C55E;box-shadow:0 0 8px #22C55E;animation:lpPl 2s ease-in-out infinite;}
@keyframes lpPl{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.7;transform:scale(1.3)}}
.lp-h1{font-size:clamp(2.6rem,6.5vw,4.8rem);font-weight:900;line-height:1.08;letter-spacing:-.03em;margin-bottom:22px;}
.lp-h1 .gr{background:linear-gradient(135deg,#93C5FD 0%,#3B82F6 50%,#2563EB 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.lp-hs{font-size:clamp(1rem,2.5vw,1.2rem);color:var(--muted);margin-bottom:44px;line-height:1.7;}
.lp-hb{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;}
.lp-btx{padding:17px 34px;border-radius:13px;font:700 1.05rem 'Heebo',sans-serif;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:9px;transition:all .25s;}
.lp-btx.p{background:linear-gradient(135deg,var(--blue),var(--blue2));color:#fff;border:none;box-shadow:0 4px 24px rgba(37,99,235,.4);}
.lp-btx.p:hover{transform:translateY(-3px);box-shadow:0 10px 36px rgba(37,99,235,.5);}
.lp-btx.g{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:var(--white);backdrop-filter:blur(8px);}
.lp-btx.g:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.22);transform:translateY(-3px);}
.lp-sh{position:absolute;bottom:36px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px;color:var(--muted);font-size:.75rem;}
.lp-mouse{width:22px;height:36px;border:2px solid rgba(255,255,255,.2);border-radius:100px;position:relative;}
.lp-mouse::after{content:'';position:absolute;top:5px;left:50%;transform:translateX(-50%);width:3px;height:7px;border-radius:100px;background:var(--bluel);animation:lpM 2s ease-in-out infinite;}
@keyframes lpM{0%{top:5px;opacity:1}100%{top:20px;opacity:0}}
/* Stats */
.lp-sb{border-top:1px solid rgba(37,99,235,.15);border-bottom:1px solid rgba(37,99,235,.15);background:rgba(37,99,235,.07);padding:28px 24px;}
.lp-si{max-width:900px;margin:0 auto;display:flex;justify-content:space-around;align-items:center;flex-wrap:wrap;gap:20px;}
.lp-st{text-align:center;}
.lp-stn{font-size:1.9rem;font-weight:900;color:var(--bluel);line-height:1;}
.lp-stl{font-size:.82rem;color:var(--muted);margin-top:4px;}
.lp-sep{width:1px;height:44px;background:rgba(255,255,255,.08);}
/* Section */
.lp-sec{padding:84px 24px;max-width:1080px;margin:0 auto;}
.lp-stripe{padding:84px 0;background:rgba(255,255,255,.02);border-top:1px solid rgba(255,255,255,.05);border-bottom:1px solid rgba(255,255,255,.05);}
.lp-stripe .lp-sec{padding-top:0;padding-bottom:0;}
.lp-ey{font-size:.72rem;text-transform:uppercase;letter-spacing:3px;color:var(--bluel);text-align:center;margin-bottom:10px;font-weight:700;}
.lp-t2{font-size:clamp(1.9rem,4vw,2.9rem);font-weight:800;text-align:center;margin-bottom:12px;line-height:1.15;}
.lp-sub{text-align:center;color:var(--muted);font-size:.98rem;max-width:500px;margin:0 auto 52px;line-height:1.65;}
/* Feature cards */
.lp-g4{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px;}
.lp-fc{background:var(--card);border:1px solid var(--cb);border-radius:var(--r);padding:28px 24px;position:relative;overflow:hidden;transition:transform .3s,background .3s,border-color .3s;}
.lp-fc::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--blue),var(--bluel));opacity:0;transition:opacity .3s;}
.lp-fc:hover{transform:translateY(-5px);background:rgba(37,99,235,.08);border-color:rgba(96,165,250,.22);}
.lp-fc:hover::before{opacity:1;}
.lp-fi{font-size:2rem;margin-bottom:14px;}
.lp-ft{font-size:1rem;font-weight:700;margin-bottom:8px;}
.lp-fd{font-size:.875rem;color:var(--muted);line-height:1.6;}
/* Steps */
.lp-steps{display:flex;justify-content:center;flex-wrap:wrap;max-width:880px;margin:0 auto;}
.lp-step{flex:1;min-width:160px;text-align:center;padding:0 16px;position:relative;}
.lp-step:not(:last-child)::after{content:'';position:absolute;top:26px;left:0;width:100%;height:2px;background:linear-gradient(90deg,rgba(37,99,235,.6),rgba(37,99,235,.1));z-index:0;}
.lp-sc2{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,var(--blue),var(--blue2));color:#fff;font-size:1.2rem;font-weight:800;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;position:relative;z-index:1;box-shadow:0 0 22px rgba(37,99,235,.4);}
.lp-sico{font-size:1.7rem;margin-bottom:9px;}
.lp-stit{font-size:.95rem;font-weight:700;margin-bottom:5px;}
.lp-sdesc{font-size:.83rem;color:var(--muted);line-height:1.55;}
/* Driver */
.lp-dw{background:linear-gradient(135deg,#0B1222 0%,#0F1A2E 100%);border-top:1px solid rgba(37,99,235,.15);border-bottom:1px solid rgba(37,99,235,.15);}
.lp-di{max-width:1000px;margin:0 auto;padding:84px 24px;display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center;}
.lp-bl{display:flex;flex-direction:column;gap:20px;}
.lp-ben{display:flex;gap:14px;align-items:flex-start;}
.lp-bico{width:44px;height:44px;flex-shrink:0;border-radius:11px;background:rgba(37,99,235,.14);border:1px solid rgba(96,165,250,.2);display:flex;align-items:center;justify-content:center;font-size:1.2rem;}
.lp-bt h4{font-weight:700;font-size:.95rem;margin-bottom:3px;}
.lp-bt p{font-size:.85rem;color:var(--muted);line-height:1.5;}
.lp-ecard{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:22px;padding:30px;text-align:center;animation:lpFl 5s ease-in-out infinite;}
@keyframes lpFl{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
.lp-ebox{background:linear-gradient(135deg,rgba(37,99,235,.22),rgba(29,78,216,.1));border:1px solid rgba(96,165,250,.2);border-radius:14px;padding:24px;margin-bottom:18px;}
.lp-el{font-size:.78rem;color:var(--muted);margin-bottom:6px;}
.lp-en{font-size:3.2rem;font-weight:900;color:var(--bluel);line-height:1;}
.lp-ep{font-size:.82rem;color:var(--muted);margin-top:4px;}
.lp-mg{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;}
.lp-mi{background:rgba(255,255,255,.04);border-radius:10px;padding:13px;}
.lp-mn{font-size:1.35rem;font-weight:800;}
.lp-ml{font-size:.72rem;color:var(--muted);margin-top:2px;}
/* Trust */
.lp-tg{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px;max-width:880px;margin:0 auto;}
.lp-tc{background:var(--card);border:1px solid var(--cb);border-radius:var(--r);padding:26px 22px;display:flex;gap:16px;align-items:flex-start;transition:transform .3s,border-color .3s;}
.lp-tc:hover{transform:translateY(-3px);border-color:rgba(96,165,250,.2);}
.lp-tcico{font-size:1.8rem;flex-shrink:0;}
.lp-tct h3{font-size:.98rem;font-weight:700;margin-bottom:6px;}
.lp-tct p{font-size:.85rem;color:var(--muted);line-height:1.55;}
/* CTA */
.lp-ctaw{text-align:center;padding:110px 24px;position:relative;overflow:hidden;}
.lp-ctag{position:absolute;inset:0;background:radial-gradient(ellipse 70% 60% at 50% 50%,rgba(37,99,235,.18) 0%,transparent 65%);}
.lp-ctat{font-size:clamp(2rem,5vw,3.6rem);font-weight:900;margin-bottom:16px;position:relative;z-index:1;}
.lp-ctas{color:var(--muted);font-size:1.05rem;margin-bottom:42px;position:relative;z-index:1;}
.lp-ctab{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;position:relative;z-index:1;}
/* Footer */
.lp-ft2{padding:30px 24px;border-top:1px solid rgba(255,255,255,.06);text-align:center;color:var(--muted);font-size:.85rem;}
.lp-ftl{margin-top:8px;}
.lp-ftl a{color:var(--bluel);text-decoration:none;margin:0 12px;}
.lp-ftl a:hover{text-decoration:underline;}
/* Animate in */
.lp-in{opacity:0;transform:translateY(26px);transition:opacity .65s ease,transform .65s ease;}
.lp-in.v{opacity:1;transform:translateY(0);}
.lp-d1{transition-delay:.08s;}.lp-d2{transition-delay:.17s;}.lp-d3{transition-delay:.26s;}.lp-d4{transition-delay:.35s;}
/* Mobile */
@media(max-width:760px){
  .lp-nav{padding:14px 18px;}
  .lp-ng{display:none;}
  .lp-hero{padding:100px 18px 60px;}
  .lp-di{grid-template-columns:1fr;gap:40px;}
  .lp-sep{display:none;}
  .lp-step{min-width:130px;}
  .lp-step:not(:last-child)::after{display:none;}
  .lp-steps{gap:20px;}
  .lp-btx{padding:14px 24px;font-size:.95rem;}
}
/* WhatsApp */
.lp-btx.w{background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;border:none;box-shadow:0 4px 20px rgba(37,211,102,.35);}
.lp-btx.w:hover{transform:translateY(-3px);box-shadow:0 10px 32px rgba(37,211,102,.5);}
.lp-wa{position:fixed;bottom:26px;left:22px;z-index:300;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#25D366,#128C7E);box-shadow:0 4px 18px rgba(37,211,102,.5);display:flex;align-items:center;justify-content:center;font-size:1.7rem;text-decoration:none;animation:lpWa 3s ease-in-out infinite;}
@keyframes lpWa{0%,100%{box-shadow:0 4px 18px rgba(37,211,102,.5),0 0 0 0 rgba(37,211,102,.3)}50%{box-shadow:0 4px 18px rgba(37,211,102,.5),0 0 0 14px rgba(37,211,102,0)}}
`

export default function Landing() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const el = document.createElement('style')
    el.id = '__lp'
    el.textContent = CSS
    document.head.appendChild(el)
    const prevBg = document.body.style.background
    document.body.style.background = '#070B14'

    const tick = () => {
      setScrolled(window.scrollY > 44)
      document.querySelectorAll<HTMLElement>('.lp-in').forEach(n => {
        if (n.getBoundingClientRect().top < window.innerHeight - 72) n.classList.add('v')
      })
    }
    window.addEventListener('scroll', tick, { passive: true })
    setTimeout(tick, 60)

    return () => {
      window.removeEventListener('scroll', tick)
      document.getElementById('__lp')?.remove()
      document.body.style.background = prevBg
    }
  }, [])

  return (
    <div className="lp">

      {/* NAV */}
      <nav className={`lp-nav${scrolled ? ' sc' : ''}`}>
        <div className="lp-logo">🚕 Easy<span className="ac">Taxi</span> Israel</div>
        <div className="lp-navr">
          <a href="/faq" className="lp-ng">שאלות ותשובות</a>
          <a href="/login" className="lp-ng">כניסה</a>
          <a href="/app" className="lp-ns">הזמן נסיעה</a>
        </div>
      </nav>

      {/* HERO */}
      <section className="lp-hero">
        <div className="lp-hbg" />
        <div className="lp-hgrid" />
        <div className="lp-hi">
          <div className="lp-badge">
            <span className="lp-bdot" />
            פעיל עכשיו בכל הארץ
          </div>
          <h1 className="lp-h1">
            הדרך החכמה<br />
            <span className="gr">להזמין נסיעה</span>
          </h1>
          <p className="lp-hs">
            EasyTaxi Israel — AI מוצא לך נהג תוך שניות.<br />
            מחיר שקוף לפני העלייה. מעקב בזמן אמת. ללא הפתעות.
          </p>
          <div className="lp-hb">
            <a href="/app" className="lp-btx p">🚕 הזמן נסיעה עכשיו</a>
            <a href="/driver" className="lp-btx g">🚗 הצטרף כנהג</a>
            <a href="https://wa.me/447474775344?text=%D7%A9%D7%9C%D7%95%D7%9D%2C%20%D7%90%D7%A0%D7%99%20%D7%A8%D7%95%D7%A6%D7%94%20%D7%9C%D7%94%D7%96%D7%9E%D7%99%D7%9F%20%D7%A0%D7%A1%D7%99%D7%A2%D7%94%20%F0%9F%9A%95" target="_blank" rel="noopener noreferrer" className="lp-btx w">💬 WhatsApp</a>
          </div>
        </div>
        <div className="lp-sh">
          <div className="lp-mouse" />
          <span>גלול למטה</span>
        </div>
      </section>

      {/* STATS */}
      <div className="lp-sb">
        <div className="lp-si">
          <div className="lp-st"><div className="lp-stn">~3 דק'</div><div className="lp-stl">זמן הגעה ממוצע</div></div>
          <div className="lp-sep" />
          <div className="lp-st"><div className="lp-stn">AI 100%</div><div className="lp-stl">התאמת נהגים חכמה</div></div>
          <div className="lp-sep" />
          <div className="lp-st"><div className="lp-stn">0 ₪</div><div className="lp-stl">עמלת הצטרפות לנהגים</div></div>
          <div className="lp-sep" />
          <div className="lp-st"><div className="lp-stn">24/7</div><div className="lp-stl">זמינות מלאה</div></div>
        </div>
      </div>

      {/* FEATURES */}
      <div className="lp-sec">
        <p className="lp-ey lp-in">למה EasyTaxi</p>
        <h2 className="lp-t2 lp-in">שונה מכל מה שהכרת</h2>
        <p className="lp-sub lp-in">טכנולוגיה מתקדמת, שקיפות מלאה ותמיכה 24/7</p>
        <div className="lp-g4">
          {[
            { ico: '🤖', t: 'AI מוצא נהג טוב יותר', d: 'אלגוריתם חכם מתאים נהג לפי מיקום, דירוג ומהירות תגובה — תוך שניות.' },
            { ico: '💰', t: 'מחיר שקוף בזמן אמת', d: 'אתה יודע כמה תשלם לפני שאתה עולה לרכב. לא עוד הפתעות בסוף הנסיעה.' },
            { ico: '⚖️', t: 'מערכת חוקית מלאה', d: 'כל נהג מאומת — רישיון בתוקף, ביטוח ובדיקת גיל רכב. אנחנו מטפלים בהכל.' },
            { ico: '📍', t: 'מעקב בזמן אמת', d: 'עקוב אחרי הנהג על המפה בזמן אמת. שתף קישור מעקב עם המשפחה.' },
          ].map((f, i) => (
            <div key={i} className={`lp-fc lp-in lp-d${i + 1}`}>
              <div className="lp-fi">{f.ico}</div>
              <div className="lp-ft">{f.t}</div>
              <div className="lp-fd">{f.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className="lp-stripe">
        <div className="lp-sec">
          <p className="lp-ey lp-in">פשוט וברור</p>
          <h2 className="lp-t2 lp-in">איך זה עובד?</h2>
          <p className="lp-sub lp-in">4 שלבים. הכל אוטומטי.</p>
          <div className="lp-steps">
            {[
              { n: '1', ico: '📱', t: 'מזמינים', d: 'מזינים מוצא ויעד — המערכת מחשבת מחיר מיד' },
              { n: '2', ico: '🚗', t: 'נהג בדרך', d: 'AI בוחר נהג קרוב ומאומת. הוא כבר בדרך' },
              { n: '3', ico: '🗺️', t: 'נוסעים', d: 'נסיעה בטוחה עם מעקב GPS בזמן אמת' },
              { n: '4', ico: '✅', t: 'משלמים', d: "תשלום אוטומטי. וואוצ'ר ישירות לנהג" },
            ].map((s, i) => (
              <div key={i} className={`lp-step lp-in lp-d${i + 1}`}>
                <div className="lp-sc2">{s.n}</div>
                <div className="lp-sico">{s.ico}</div>
                <div className="lp-stit">{s.t}</div>
                <div className="lp-sdesc">{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DRIVER */}
      <div className="lp-dw">
        <div className="lp-di">
          <div>
            <p className="lp-ey" style={{ textAlign: 'right' }}>לנהגים</p>
            <h2 className="lp-t2 lp-in" style={{ textAlign: 'right', fontSize: 'clamp(1.8rem,4vw,2.6rem)' }}>
              הרווח יותר.<br />תעבד פחות.
            </h2>
            <p className="lp-in" style={{ color: 'var(--muted)', fontSize: '.98rem', lineHeight: '1.65', textAlign: 'right', margin: '0 0 32px' }}>
              המערכת שולחת אליך נסיעות לפי האזור שלך — אתה רק נוהג.
            </p>
            <div className="lp-bl">
              {[
                { ico: '💎', t: 'יותר נסיעות, פחות המתנה', d: 'AI מנתב אליך נוסעים מהאזור שלך בזמן אמת' },
                { ico: '🔥', t: 'התראות על אזורים חמים', d: 'קבל Push בזמן שיש ביקוש גבוה ומחירים גבוהים יותר' },
                { ico: '💰', t: 'שליטה מלאה על הרווח', d: 'ראה כמה הרווחת היום, השבוע, החודש — הכל שקוף' },
                { ico: '⚡', t: 'הצטרפות תוך דקות', d: 'תיעוד דיגיטלי, אין ניירת, מתחילים לעבוד מהר' },
              ].map((b, i) => (
                <div key={i} className="lp-ben lp-in">
                  <div className="lp-bico">{b.ico}</div>
                  <div className="lp-bt"><h4>{b.t}</h4><p>{b.d}</p></div>
                </div>
              ))}
            </div>
            <a href="/driver" className="lp-btx p" style={{ marginTop: '32px', display: 'inline-flex' }}>
              🚗 הצטרף כנהג היום
            </a>
          </div>
          <div className="lp-ecard">
            <div className="lp-ebox">
              <div className="lp-el">הכנסה יומית ממוצעת</div>
              <div className="lp-en">₪480</div>
              <div className="lp-ep">8 שעות עבודה</div>
            </div>
            <div className="lp-mg">
              <div className="lp-mi"><div className="lp-mn">12</div><div className="lp-ml">נסיעות ביום</div></div>
              <div className="lp-mi"><div className="lp-mn">4.9 ⭐</div><div className="lp-ml">דירוג ממוצע</div></div>
              <div className="lp-mi"><div className="lp-mn">8 דק'</div><div className="lp-ml">המתנה ממוצעת</div></div>
              <div className="lp-mi"><div className="lp-mn">0 ₪</div><div className="lp-ml">דמי הצטרפות</div></div>
            </div>
            <div style={{ fontSize: '.77rem', color: 'var(--muted)' }}>* נתוני ממוצע של נהגים פעילים</div>
          </div>
        </div>
      </div>

      {/* TRUST */}
      <div className="lp-sec">
        <p className="lp-ey lp-in">בטיחות ואמינות</p>
        <h2 className="lp-t2 lp-in">המערכת שמגנה עליך</h2>
        <p className="lp-sub lp-in">בנויה עם שקיפות מלאה משני הצדדים</p>
        <div className="lp-tg">
          {[
            { ico: '🔐', t: 'אבטחה מלאה', d: 'כל המידע שלך מוצפן. מספר הטלפון שלך לא נחשף לנהג, ולא לנו.' },
            { ico: '✅', t: 'נהגים מאומתים', d: 'כל נהג עובר אימות זהות, בדיקת רישיון, ביטוח וגיל רכב — לפני שאפשר לעבוד.' },
            { ico: '💳', t: 'תשלום שקוף', d: 'רואים מחיר מדויק לפני הנסיעה. אין תוספות מפתיעות. חשבונית דיגיטלית אוטומטית.' },
          ].map((t, i) => (
            <div key={i} className={`lp-tc lp-in lp-d${i + 1}`}>
              <div className="lp-tcico">{t.ico}</div>
              <div className="lp-tct"><h3>{t.t}</h3><p>{t.d}</p></div>
            </div>
          ))}
        </div>
      </div>

      {/* FINAL CTA */}
      <section className="lp-ctaw">
        <div className="lp-ctag" />
        <h2 className="lp-ctat lp-in">מוכן להזמין נסיעה?</h2>
        <p className="lp-ctas lp-in">הצטרף לאלפי משתמשים שכבר נוסעים עם EasyTaxi Israel</p>
        <div className="lp-ctab">
          <a href="/app" className="lp-btx p" style={{ fontSize: '1.1rem', padding: '18px 38px' }}>🚕 הזמן נסיעה עכשיו</a>
          <a href="/driver" className="lp-btx g" style={{ fontSize: '1.1rem', padding: '18px 38px' }}>🚗 הצטרף כנהג</a>
          <a href="https://wa.me/447474775344?text=%D7%A9%D7%9C%D7%95%D7%9D%2C%20%D7%90%D7%A0%D7%99%20%D7%A8%D7%95%D7%A6%D7%94%20%D7%9C%D7%94%D7%96%D7%9E%D7%99%D7%9F%20%D7%A0%D7%A1%D7%99%D7%A2%D7%94%20%F0%9F%9A%95" target="_blank" rel="noopener noreferrer" className="lp-btx w" style={{ fontSize: '1.1rem', padding: '18px 38px' }}>💬 WhatsApp</a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-ft2">
        <div>🚕 EasyTaxi Israel © {new Date().getFullYear()}</div>
        <div className="lp-ftl">
          <a href="/login">כניסה</a>
          <a href="/guest">מחירים</a>
          <a href="/faq">שאלות ותשובות</a>
          <a href="/app">הזמן נסיעה</a>
          <a href="https://wa.me/447474775344" target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a href="/whatsapp-setup.html" style={{ opacity: 0.35, fontSize: '0.72rem', letterSpacing: '0.5px' }}>⚙ אדמין</a>
        </div>
      </footer>

      {/* FLOATING WHATSAPP */}
      <a href="https://wa.me/447474775344" target="_blank" rel="noopener noreferrer" className="lp-wa" title="שלח הודעה בוואטסאפ">💬</a>

    </div>
  )
}
