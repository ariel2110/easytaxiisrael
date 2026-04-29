import { useEffect } from 'react'


const CSS = `
.gd,.gd *,.gd *::before,.gd *::after{box-sizing:border-box;margin:0;padding:0;}
.gd{
  --bg:#070B14;--bg2:#0D1526;--blue:#2563EB;--blue2:#1D4ED8;
  --bluel:#60A5FA;--white:#F1F5F9;--muted:#94A3B8;
  --card:rgba(255,255,255,.04);--cb:rgba(255,255,255,.09);
  --green:#22C55E;--gold:#FDE047;
  min-height:100vh;background:var(--bg);color:var(--white);
  font-family:'Heebo','Segoe UI',Arial,sans-serif;direction:rtl;overflow-x:hidden;
}
.gd-bg{position:fixed;inset:0;z-index:0;pointer-events:none;
  background:radial-gradient(ellipse 80% 50% at 50% 0%,rgba(37,99,235,.16) 0%,transparent 60%),linear-gradient(180deg,#070B14 0%,#0C1322 100%);}
.gd-nav{position:sticky;top:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:14px 28px;background:rgba(7,11,20,.88);backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,.07);}
.gd-logo{font-size:1.1rem;font-weight:900;letter-spacing:-.02em;text-decoration:none;color:var(--white);}
.gd-logo .ac{color:var(--bluel);}
.gd-ncta{padding:9px 20px;border-radius:10px;background:linear-gradient(135deg,var(--blue),var(--blue2));color:#fff;border:none;font:700 .9rem 'Heebo',sans-serif;cursor:pointer;text-decoration:none;box-shadow:0 3px 14px rgba(37,99,235,.35);transition:all .2s;display:inline-flex;align-items:center;gap:6px;}
.gd-ncta:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(37,99,235,.5);}
.gd-main{position:relative;z-index:1;max-width:760px;margin:0 auto;padding:48px 20px 88px;}
.gd-hero{text-align:center;margin-bottom:48px;}
.gd-icon{font-size:3rem;margin-bottom:14px;display:inline-block;animation:gdBounce 2s ease-in-out infinite;}
@keyframes gdBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.gd-h1{font-size:clamp(1.9rem,4.5vw,2.7rem);font-weight:900;line-height:1.1;letter-spacing:-.03em;margin-bottom:12px;}
.gd-h1 .ac{background:linear-gradient(135deg,#93C5FD,#3B82F6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.gd-sub{color:var(--muted);font-size:1rem;line-height:1.7;max-width:520px;margin:0 auto;}
.gd-ey{font-size:.7rem;text-transform:uppercase;letter-spacing:3px;color:var(--bluel);font-weight:700;margin-bottom:8px;}
.gd-t2{font-size:1.25rem;font-weight:800;margin-bottom:18px;}
.gd-roles{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:40px;}
.gd-rc{padding:24px 20px;border-radius:18px;cursor:pointer;border:1.5px solid var(--cb);background:var(--card);text-align:center;text-decoration:none;color:var(--white);transition:all .25s;display:block;}
.gd-rc:hover{transform:translateY(-3px);}
.gd-rc.pass{border-color:rgba(37,99,235,.3);}
.gd-rc.pass:hover{background:rgba(37,99,235,.1);border-color:var(--blue);box-shadow:0 8px 30px rgba(37,99,235,.2);}
.gd-rc.drv{border-color:rgba(34,197,94,.25);}
.gd-rc.drv:hover{background:rgba(34,197,94,.08);border-color:var(--green);box-shadow:0 8px 30px rgba(34,197,94,.15);}
.gd-rc.taxi{border-color:rgba(253,224,71,.22);}
.gd-rc.taxi:hover{background:rgba(253,224,71,.06);border-color:var(--gold);box-shadow:0 8px 30px rgba(253,224,71,.1);}
.gd-rcico{font-size:2.4rem;margin-bottom:10px;}
.gd-rct{font-size:1rem;font-weight:800;margin-bottom:5px;}
.gd-rcd{font-size:.8rem;color:var(--muted);line-height:1.55;}
.gd-rcarr{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;margin-top:12px;font-size:.85rem;}
.gd-rc.pass .gd-rcarr{background:rgba(37,99,235,.2);color:var(--bluel);}
.gd-rc.drv  .gd-rcarr{background:rgba(34,197,94,.2);color:var(--green);}
.gd-rc.taxi .gd-rcarr{background:rgba(253,224,71,.15);color:var(--gold);}
.gd-card{background:var(--card);border:1px solid var(--cb);border-radius:20px;padding:28px;margin-bottom:20px;}
.gd-prow{display:flex;justify-content:space-between;align-items:center;padding:11px 13px;background:rgba(255,255,255,.04);border-radius:10px;margin-bottom:8px;}
.gd-plbl{font-size:.88rem;font-weight:600;}
.gd-pnote{font-size:.74rem;color:var(--muted);margin-top:2px;}
.gd-pval{font-size:1.05rem;font-weight:900;color:var(--bluel);}
.gd-info{margin-top:14px;padding:12px 14px;border-radius:10px;background:rgba(37,99,235,.09);border:1px solid rgba(96,165,250,.15);font-size:.82rem;color:var(--muted);line-height:1.65;}
.gd-info strong{color:var(--white);}
.gd-g2{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:10px;}
.gd-area{padding:11px 14px;background:rgba(255,255,255,.04);border:1px solid var(--cb);border-radius:10px;font-size:.88rem;font-weight:600;display:flex;align-items:center;gap:7px;}
.gd-sg{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;}
.gd-si{padding:16px;background:rgba(255,255,255,.04);border:1px solid var(--cb);border-radius:12px;transition:border-color .2s,background .2s;}
.gd-si:hover{background:rgba(37,99,235,.07);border-color:rgba(96,165,250,.2);}
.gd-siico{font-size:1.6rem;margin-bottom:8px;}
.gd-sit{font-size:.88rem;font-weight:800;margin-bottom:4px;}
.gd-sid{font-size:.78rem;color:var(--muted);line-height:1.5;}
.gd-ctasec{text-align:center;padding:36px 28px;border-radius:22px;background:linear-gradient(135deg,rgba(37,99,235,.12),rgba(29,78,216,.06));border:1px solid rgba(37,99,235,.2);}
.gd-ctas{font-size:1.4rem;font-weight:900;margin-bottom:8px;}
.gd-ctasub{color:var(--muted);font-size:.9rem;margin-bottom:24px;line-height:1.6;}
.gd-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;}
.gd-btn-p{padding:13px 28px;border-radius:12px;font:700 .95rem 'Heebo',sans-serif;background:linear-gradient(135deg,var(--blue),var(--blue2));color:#fff;border:none;cursor:pointer;text-decoration:none;box-shadow:0 4px 18px rgba(37,99,235,.35);transition:all .25s;display:inline-flex;align-items:center;gap:7px;}
.gd-btn-p:hover{transform:translateY(-2px);box-shadow:0 7px 24px rgba(37,99,235,.5);}
.gd-btn-g{padding:13px 28px;border-radius:12px;font:700 .95rem 'Heebo',sans-serif;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:var(--white);cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:7px;transition:all .25s;}
.gd-btn-g:hover{background:rgba(255,255,255,.1);transform:translateY(-2px);}
.gd-div{height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.08),transparent);margin:36px 0;}
.gd-wa{position:fixed;bottom:24px;left:24px;z-index:999;width:56px;height:56px;border-radius:50%;background:#25D366;color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.5rem;box-shadow:0 4px 20px rgba(37,211,102,.5);text-decoration:none;transition:all .2s;}
.gd-wa:hover{transform:scale(1.1);box-shadow:0 6px 28px rgba(37,211,102,.7);}
@keyframes gdIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
.gd-ain{animation:gdIn .5s ease both;}
.gd-d1{animation-delay:.05s}.gd-d2{animation-delay:.12s}.gd-d3{animation-delay:.2s}.gd-d4{animation-delay:.28s}
`

const PRICING_ROWS = [
  { label: 'עלות התחלה', value: '₪2.50', note: 'בסיס לכל נסיעה' },
  { label: 'מחיר לק"מ', value: '₪1.20', note: 'קילומטרים מדידים' },
  { label: 'עמלת פלטפורמה', value: '15%', note: 'מהתעריף הכולל' },
  { label: 'מכפיל עומס (Surge)', value: '×1.0–×2.5', note: 'לפי ביקוש בזמן אמת' },
  { label: 'היטל פיצוי (תיקון 142)', value: '₪2.00', note: 'לנהגים עצמאיים בלבד' },
]

const AREAS = [
  '📍 תל אביב-יפו', '📍 ירושלים', '📍 חיפה', '📍 באר שבע',
  '📍 ראשון לציון', '📍 פתח תקוה', '📍 נתניה', '📍 אשדוד',
]

const SAFETY = [
  { ico: '🪪', t: 'Persona KYC', d: 'כל נהג עובר אימות זהות + מסמכים + תמונה' },
  { ico: '📍', t: 'מעקב GPS', d: 'כל נסיעה מוקלטת. שתף מסלול עם משפחה' },
  { ico: '⭐', t: 'דירוגים דו-כיווניים', d: 'נוסעים ונהגים מדרגים זה את זה' },
  { ico: '🤖', t: 'ניטור AI', d: 'בינה מלאכותית עוקבת אחרי כל נסיעה' },
]

export default function GuestDashboard() {
  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'gd-css'
    el.textContent = CSS
    document.head.appendChild(el)
    return () => { document.getElementById('gd-css')?.remove() }
  }, [])

  return (
    <div className="gd">
      <div className="gd-bg" />

      <nav className="gd-nav">
        <a href="/" className="gd-logo"><span className="ac">Easy</span>Taxi ישראל</a>
        <a href="/login" className="gd-ncta">🚕 כניסה / הרשמה</a>
      </nav>

      <div className="gd-main">

        {/* Hero */}
        <div className="gd-hero gd-ain">
          <div className="gd-icon">🚕</div>
          <h1 className="gd-h1">ברוך הבא ל<span className="ac">EasyTaxi</span> ישראל</h1>
          <p className="gd-sub">סיור חופשי — ראה תעריפים, אזורי שירות ומידע לפני ההרשמה. ללא הורדת אפליקציה.</p>
        </div>

        {/* Role selector */}
        <div className="gd-ey gd-ain gd-d1" style={{ textAlign: 'center', marginBottom: '14px' }}>בחר את התפקיד שלך</div>
        <div className="gd-roles gd-ain gd-d1">
          <a href="/login?role=passenger" className="gd-rc pass">
            <div className="gd-rcico">🧑‍💼</div>
            <div className="gd-rct">נוסע</div>
            <div className="gd-rcd">הזמן נסיעה תוך שניות. מחיר שקוף לפני האישור.</div>
            <div className="gd-rcarr">→</div>
          </a>
          <a href="/login?role=driver" className="gd-rc drv">
            <div className="gd-rcico">🚗</div>
            <div className="gd-rct">נהג עצמאי</div>
            <div className="gd-rcd">חוק הסעות 2026. ללא רישיון מונית. הכנסה גמישה.</div>
            <div className="gd-rcarr">→</div>
          </a>
          <a href="/login?role=taxi" className="gd-rc taxi">
            <div className="gd-rcico">🚕</div>
            <div className="gd-rct">נהג מונית מורשה</div>
            <div className="gd-rcd">עם רישיון מונית. תעריף מוסדר + עמלה נמוכה.</div>
            <div className="gd-rcarr">→</div>
          </a>
        </div>

        <div className="gd-div" />

        {/* Pricing */}
        <div className="gd-card gd-ain gd-d2">
          <div className="gd-ey">שקיפות</div>
          <div className="gd-t2">💸 תעריפים מלאים</div>
          {PRICING_ROWS.map(row => (
            <div className="gd-prow" key={row.label}>
              <div>
                <div className="gd-plbl">{row.label}</div>
                <div className="gd-pnote">{row.note}</div>
              </div>
              <div className="gd-pval">{row.value}</div>
            </div>
          ))}
          <div className="gd-info">💡 המחיר הסופי מוצג <strong>לפני האישור</strong> — ללא הפתעות. אם הנהג ביטל, לא מחויבים.</div>
        </div>

        {/* Areas */}
        <div className="gd-card gd-ain gd-d3">
          <div className="gd-ey">כיסוי</div>
          <div className="gd-t2">🗺️ אזורי שירות פעילים</div>
          <div className="gd-g2">
            {AREAS.map(a => <div className="gd-area" key={a}>{a}</div>)}
          </div>
          <div className="gd-info">מרחיבים בהתמדה · שירות פעיל 24/7 בכל הערים.</div>
        </div>

        {/* Safety */}
        <div className="gd-card gd-ain gd-d4">
          <div className="gd-ey">בטיחות</div>
          <div className="gd-t2">🛡️ אימות ואבטחה</div>
          <div className="gd-sg">
            {SAFETY.map(s => (
              <div className="gd-si" key={s.t}>
                <div className="gd-siico">{s.ico}</div>
                <div className="gd-sit">{s.t}</div>
                <div className="gd-sid">{s.d}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="gd-div" />

        {/* CTA */}
        <div className="gd-ctasec gd-ain">
          <div className="gd-ctas">מוכנים להתחיל?</div>
          <div className="gd-ctasub">הרשמה ב-3 לחיצות. ללא אפליקציה. ללא סיסמא.</div>
          <div className="gd-btns">
            <a href="/login" className="gd-btn-p">🧑‍💼 אני נוסע</a>
            <a href="/driver" className="gd-btn-g">🚕 אני נהג</a>
          </div>
        </div>

      </div>

      <a href="https://wa.me/447474775344?text=%D7%A9%D7%9C%D7%95%D7%9D%2C%20%D7%90%D7%A0%D7%99%20%D7%A8%D7%95%D7%A6%D7%94%20%D7%9C%D7%93%D7%A2%D7%AA%20%D7%A2%D7%95%D7%93" target="_blank" rel="noopener noreferrer" className="gd-wa" title="שאל בוואטסאפ">💬</a>
    </div>
  )
}
