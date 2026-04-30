import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

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
`

type FaqEntry = { q: string; a: string | JSX.Element }
type Section = {
  id: string
  label: string
  ico: string
  badge: string
  badgeClass: string
  items: FaqEntry[]
}

const SECTIONS: Section[] = [
  {
    id: 'general',
    label: 'כללי',
    ico: '🚕',
    badge: 'לכולם',
    badgeClass: 'all',
    items: [
      {
        q: 'מה זה EasyTaxi Israel ואיך זה עובד?',
        a: (
          <>
            EasyTaxi Israel היא פלטפורמת הסעות ישראלית שמחברת בין <strong>נוסעים</strong> ל<strong>נהגים מאומתים</strong> — בזמן אמת, ללא סיסמאות, ללא אפליקציה להורדה.
            <ul>
              <li><strong>נוסע</strong> מזין מספר טלפון → מאמת ב-WhatsApp → מזמין נסיעה מיד.</li>
              <li><strong>נהג</strong> נרשם, עובר אימות זהות מלא, ומתחיל לקבל נסיעות.</li>
              <li>הכל מתבצע דרך הדפדפן — אין צורך בהורדת אפליקציה.</li>
            </ul>
          </>
        ),
      },
      {
        q: 'האם השירות פועל בכל הארץ?',
        a: 'כרגע אנחנו פעילים ומתרחבים. לפרטים על אזורי הכיסוי שלנו פנו לתמיכה דרך WhatsApp.',
      },
      {
        q: 'איך מתבצע האימות דרך WhatsApp?',
        a: (
          <>
            תהליך האימות מבוסס על <strong>Magic Link</strong> — ללא סיסמא וללא קוד SMS:
            <ul>
              <li>מכניסים מספר טלפון ובוחרים תפקיד (נוסע / נהג).</li>
              <li>לוחצים על הקישור שנפתח ב-WhatsApp — ההודעה כבר מוכנה.</li>
              <li>שולחים את ההודעה → המערכת מזהה אתכם ומכניסה אוטומטית.</li>
              <li>תהליך שלם של ~15 שניות. ללא קוד. ללא סיסמא.</li>
            </ul>
          </>
        ),
      },
      {
        q: 'האם המידע שלי מוצפן ומאובטח?',
        a: (
          <>
            כן. <strong>כל התקשורת מוצפנת ב-HTTPS/TLS</strong>. מספר הטלפון שלך לא נחשף לנהג. הטוקנים נשמרים ב-LocalStorage ולא בקוקיז. תוקף הכניסה פג אוטומטית. <strong>לא שומרים סיסמאות — פשוט כי אין סיסמאות.</strong>
          </>
        ),
      },
      {
        q: 'מה קורה אם יש בעיה טכנית?',
        a: (
          <>
            ניתן לפנות לתמיכה ב-<strong>WhatsApp: +44 7474 775344</strong> — 24/7. בנוסף, אפשר לשלוח מייל דרך דף התמיכה.
          </>
        ),
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
        a: (
          <>
            <ul>
              <li>כנסו לאתר ובחרו "נוסע".</li>
              <li>הכניסו מספר WhatsApp ואמתו את הזהות (15 שניות).</li>
              <li>לאחר הכניסה — הכניסו כתובת מוצא ויעד, ואשרו את המחיר.</li>
              <li>הנהג הקרוב ביותר מקבל את ההזמנה ומגיע אליכם.</li>
            </ul>
          </>
        ),
      },
      {
        q: 'כמה עולה נסיעה?',
        a: (
          <>
            המחיר מחושב <strong>לפני</strong> שמאשרים את הנסיעה — אין הפתעות. המחיר כולל:
            <ul>
              <li>מחיר בסיס + מחיר לק"מ + מחיר להמתנה.</li>
              <li>אין תוספת על שעות לילה או עומס (flat rate).</li>
              <li>חשבונית דיגיטלית נשלחת אוטומטית בסיום.</li>
            </ul>
          </>
        ),
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
        a: (
          <>
            אם הנהג לא מגיע תוך 10 דקות לאחר קבלת האישור:
            <ul>
              <li>ניתן לבטל את ההזמנה ללא חיוב.</li>
              <li>המערכת תחפש נהג חלופי אוטומטית.</li>
              <li>לכל תקלה — WhatsApp תמיכה: +44 7474 775344.</li>
            </ul>
          </>
        ),
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
    badge: 'בקרוב',
    badgeClass: 'drv',
    items: [
      {
        q: 'מה זה "נהג עצמאי" (לא מורשה) — מתי זה יהיה זמין?',
        a: (
          <>
            <span className="tag y">ממתין לאישור חוק</span> EasyTaxi מתכוננת לאפשר לנהגים פרטיים לספק הסעות <strong>ללא רישיון מונית</strong>, בהתאם לתיקון חקיקה מתוכנן:
            <ul>
              <li>אימות זהות מלא (תעודת זהות + סרט פנים — Persona KYC).</li>
              <li>ביטוח מיוחד לנסיעות שיתוף (מינימום כיסוי 3 מיליון ₪).</li>
              <li>רכב עד 12 שנה ורישיון נהיגה תקף מינימום 3 שנים.</li>
              <li>הגבלה של עד 30 נסיעות בחודש.</li>
            </ul>
            <strong>עד לאישור החוק — ההרשמה אינה פתוחה.</strong> ניתן להירשם לרשימת ההמתנה דרך WhatsApp.
          </>
        ),
      },
      {
        q: 'איך נרשמים לרשימת ההמתנה לנהג עצמאי?',
        a: (
          <>
            <ul>
              <li>שלחו "נהג עצמאי" ל-WhatsApp שלנו: <strong>+44 7474 775344</strong>.</li>
              <li>תקבלו עדכון ברגע שהחוק יאושר והפלטפורמה תפתח הרשמות.</li>
              <li>נרשמים בטרום-השקה יקבלו <span className="tag g">עמלה מופחתת 10%</span> לחודשיים הראשונים.</li>
            </ul>
          </>
        ),
      },
      {
        q: 'מה זה Persona KYC ולמה צריך?',
        a: (
          <>
            <strong>Persona</strong> היא חברת אימות זהות מאושרת (SOC 2). התהליך:
            <ul>
              <li>צילום תעודת זהות (פנים ואחור).</li>
              <li>סרטון סלפי קצר לאימות שאתה מחזיק את התעודה.</li>
              <li>כל הנתונים מוצפנים ולא נשמרים אצלנו — רק תוצאת האישור.</li>
            </ul>
            זה נדרש על פי החוק ומגן גם עליך: <span className="tag g">מונע זיופים</span> <span className="tag b">אחריות משפטית</span>
          </>
        ),
      },
      {
        q: 'כמה אפשר להרוויח כנהג עצמאי?',
        a: (
          <>
            נהגים פעילים מרוויחים ממוצע <strong>₪480 לשמונה שעות עבודה</strong>.
            <ul>
              <li>12 נסיעות ממוצע ביום.</li>
              <li>דמי תיווך: <strong>15%</strong> לפלטפורמה (ללא דמי הצטרפות).</li>
              <li>תשלום מיידי בסיום כל נסיעה — אין המתנה.</li>
            </ul>
          </>
        ),
      },
      {
        q: 'האם צריך ביטוח מיוחד?',
        a: (
          <>
            כן — <strong>ביטוח שיתוף נסיעות</strong> הוא חובה חוקית. ניתן לרכוש דרכנו ב-₪89/חודש (הפחות יקר בשוק). הביטוח מכסה:
            <ul>
              <li>נסיעות בלבד (לא 24/7).</li>
              <li>כיסוי נוסע ונהג עד 3 מיליון ₪.</li>
              <li>הסדר ישיר מול חברת הביטוח — ללא ביורוקרטיה.</li>
            </ul>
          </>
        ),
      },
      {
        q: 'מה קורה אם האימות נדחה?',
        a: (
          <>
            אם Persona דחתה את הבקשה:
            <ul>
              <li>תקבלו הודעת WhatsApp עם הסיבה.</li>
              <li>ניתן לפנות לתמיכה לבירור תוך 24 שעות.</li>
              <li>ניתן להגיש בקשה חוזרת לאחר תיקון הבעיה (תעודה פגת תוקף, תמונה לא ברורה וכו').</li>
            </ul>
          </>
        ),
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
        a: (
          <>
            נהגי מונית מורשים נהנים מ:
            <ul>
              <li><span className="tag y">עדיפות</span> בהקצאת נסיעות על פני נהגים עצמאיים.</li>
              <li>דמי תיווך <strong>12%</strong> (במקום 15% לנהג עצמאי).</li>
              <li>ללא הגבלת 30 נסיעות/חודש.</li>
              <li>תג "מונית מורשה" על הפרופיל — מגדיל אמון נוסעים.</li>
            </ul>
          </>
        ),
      },
      {
        q: 'מה צריך להגיש להצטרפות?',
        a: (
          <>
            <ul>
              <li>רישיון נהיגה תקף לרכב מסחרי / מונית.</li>
              <li>רישיון מונית תקף (חפץ מוניות / עצמאי).</li>
              <li>ביטוח מונית תקף (הביטוח שלך — לא צריך ביטוח נוסף).</li>
              <li>אימות זהות Persona (כמו כל נהג).</li>
              <li>תמונת הרכב + לוחית רישוי.</li>
            </ul>
          </>
        ),
      },
      {
        q: 'האם ניתן לשלב עבודה עם מונית מורשה אחרת?',
        a: 'כן — ניתן לעבוד עם מספר פלטפורמות במקביל. אין בלעדיות. הפעלת/כיבוי זמינות בלחיצה אחת.',
      },
      {
        q: 'האם יש תוכנית הפניות לנהגים?',
        a: (
          <>
            כן! כל נהג שמפנה נהג חדש (שמשלים 10 נסיעות) מקבל <strong>₪150 בונוס</strong> ישירות לחשבון. <span className="tag y">ללא הגבלה</span>
          </>
        ),
      },
      {
        q: 'כיצד מתנהל תהליך ההרשמה?',
        a: (
          <>
            <ul>
              <li><strong>שלב 1:</strong> כנסו ל-<a href="/login?role=taxi" style={{ color: 'var(--bluel)' }}>הרשמת נהג מונית</a>.</li>
              <li><strong>שלב 2:</strong> אימות WhatsApp (15 שניות).</li>
              <li><strong>שלב 3:</strong> אימות Persona (2 דקות).</li>
              <li><strong>שלב 4:</strong> העלאת מסמכי מונית — נציג שלנו מאשר תוך 24 שעות בשעות העסקים.</li>
            </ul>
          </>
        ),
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
        a: (
          <>
            <strong>לא.</strong> כל המחירים שקופים:
            <ul>
              <li>נוסע: רואה מחיר מדויק לפני אישור. אין תוספות.</li>
              <li>נהג: 15% עמלה (12% למונית מורשית). אין דמי הצטרפות, אין דמי חבר.</li>
              <li>חשבונית דיגיטלית בסיום כל נסיעה — אוטומטית.</li>
            </ul>
          </>
        ),
      },
      {
        q: 'איך מתבצע תשלום הנהג?',
        a: 'כרגע: תשלום ישיר מהנוסע לנהג (מזומן / Bit / PayBox). תשלום דיגיטלי מובנה עם הסדר ישיר יושק ב-Q3 2026.',
      },
      {
        q: 'מה המדיניות ביטול נסיעה?',
        a: (
          <>
            <ul>
              <li>ביטול עד 2 דקות מהאישור — <span className="tag g">ללא חיוב</span>.</li>
              <li>ביטול אחרי 2 דקות (לאחר שהנהג התנע) — <span className="tag y">₪10 דמי ביטול</span>.</li>
              <li>אי-הופעה (no-show) — <span className="tag r">₪20 חיוב</span>.</li>
            </ul>
          </>
        ),
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
        a: (
          <>
            <ul>
              <li><strong>נוסע:</strong> מספר טלפון, מיקום (בזמן נסיעה בלבד), היסטוריית נסיעות.</li>
              <li><strong>נהג:</strong> מספר טלפון, פרטי זהות (דרך Persona — מוצפן), פרטי רכב.</li>
              <li>לא מוכרים מידע לצד שלישי. לא מציגים פרסומות.</li>
            </ul>
          </>
        ),
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
]

export default function FAQ() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('general')
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'faq-css'
    el.textContent = CSS
    document.head.appendChild(el)
    return () => { document.getElementById('faq-css')?.remove() }
  }, [])

  // Reset open item when tab changes
  useEffect(() => { setOpenIdx(null) }, [activeTab])

  const section = SECTIONS.find(s => s.id === activeTab) ?? SECTIONS[0]

  return (
    <div className="faq">
      {/* Nav */}
      <nav className="faq-nav">
        <a href="/" className="faq-logo" onClick={e => { e.preventDefault(); navigate('/') }}>
          <span className="ac">Easy</span>Taxi ישראל
        </a>
        <button className="faq-nav-back" onClick={() => navigate(-1)}>← חזור</button>
      </nav>

      {/* Hero */}
      <div className="faq-hero">
        <div className="faq-badge">❓ שאלות ותשובות</div>
        <h1 className="faq-h1">כל מה שרצית<br /><span className="gr">לדעת על EasyTaxi</span></h1>
        <p className="faq-sub">
          מדריך מפורט לנוסעים, נהגים עצמאיים (חוק 2026) ונהגי מונית מורשים.<br />
          לא מצאת תשובה? פנה לתמיכה ב-WhatsApp.
        </p>

        {/* Tab pills */}
        <div className="faq-tabs">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              className={`faq-tab${activeTab === s.id ? ' active' : ''}`}
              onClick={() => setActiveTab(s.id)}
            >
              {s.ico} {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="faq-body">
        {/* Section header */}
        <div className="faq-sec-head">
          <span className="faq-sec-ico">{section.ico}</span>
          <span className="faq-sec-title">{section.label}</span>
          <span className={`faq-sec-badge ${section.badgeClass}`}>{section.badge}</span>
        </div>

        {/* Items */}
        {section.items.map((item, i) => (
          <div
            key={i}
            className={`faq-item${openIdx === i ? ' open' : ''}`}
          >
            <button className="faq-q" onClick={() => setOpenIdx(openIdx === i ? null : i)}>
              <span>{item.q}</span>
              <span className="faq-q-arrow">▼</span>
            </button>
            <div className="faq-a">
              {typeof item.a === 'string' ? item.a : item.a}
            </div>
          </div>
        ))}

        <div className="faq-divider" />

        {/* CTA */}
        <div className="faq-cta">
          <h3>עדיין יש שאלות?</h3>
          <p>צוות התמיכה שלנו זמין 24/7 — ב-WhatsApp, תוך דקות.</p>
          <div className="faq-cta-btns">
            <a
              href="https://wa.me/447474775344?text=%D7%A9%D7%9C%D7%95%D7%9D%2C%20%D7%99%D7%A9%20%D7%9C%D7%99%20%D7%A9%D7%90%D7%9C%D7%94%20%D7%9C%D7%92%D7%91%D7%99%20EasyTaxi"
              target="_blank"
              rel="noopener noreferrer"
              className="faq-btn w"
            >
              💬 WhatsApp תמיכה
            </a>
            <a href="/login" className="faq-btn p">🚕 התחל עכשיו</a>
            <a href="/driver" className="faq-btn g">🚗 הצטרף כנהג</a>
          </div>
        </div>
      </div>

      {/* Floating WA */}
      <a
        href="https://wa.me/447474775344"
        target="_blank"
        rel="noopener noreferrer"
        className="faq-wa"
        title="תמיכה ב-WhatsApp"
      >💬</a>
    </div>
  )
}
