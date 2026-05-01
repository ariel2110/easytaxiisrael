import { useState } from 'react'

interface Section {
  id: string
  icon: string
  title: string
  content: React.ReactNode
}

const SECTIONS: Section[] = [
  {
    id: 'overview',
    icon: '🚕',
    title: 'סקירת המערכת',
    content: (
      <div>
        <p><strong>EasyTaxi Israel</strong> — פלטפורמת הסעות חכמה בישראל, מבוססת AI.</p>
        <h4 style={{ marginTop: '1rem' }}>ארכיטקטורה</h4>
        <ul>
          <li><strong>Backend</strong>: FastAPI (Python 3.12) — 20+ API routers, 8 AI agents</li>
          <li><strong>Frontend</strong>: React 18 + TypeScript — 3 אפליקציות נפרדות</li>
          <li><strong>Database</strong>: PostgreSQL 16 עם SQLAlchemy ORM אסינכרוני</li>
          <li><strong>Cache / Queues</strong>: Redis 7</li>
          <li><strong>Infrastructure</strong>: Docker Compose + nginx 1.27</li>
        </ul>
        <h4>דומיינים</h4>
        <ul>
          <li><code>easytaxiisrael.com</code> — אפליקציית נוסעים + פאנל אדמין (<code>/admin/</code>)</li>
          <li><code>driver.easytaxiisrael.com</code> — אפליקציית נהגים</li>
        </ul>
        <h4>שרת</h4>
        <p><code>srv1621719.cloudvps.regruhosting.ru</code> — VPS לינוקס</p>
        <p>פרויקט: <code>/root/rideos-platform/</code></p>
      </div>
    ),
  },
  {
    id: 'pricing',
    icon: '💰',
    title: 'מדיניות מחירים',
    content: (
      <div>
        <h4>תעריפים בסיסיים</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'right', padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>פריט</th>
              <th style={{ textAlign: 'left', padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>מחיר</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['דמי בסיס', '₪10'],
              ['תעריף ק"מ', '₪3.50/ק"מ'],
              ['תעריף דקה (המתנה)', '₪0.80/דקה'],
              ['מחיר מינימום', '₪15'],
              ['תוספת לילה (22:00–06:00)', '+20%'],
              ['תוספת שישי/שבת', '+25%'],
              ['ביטול (אחרי 3 דק׳)', '₪5'],
            ].map(([label, price]) => (
              <tr key={label}>
                <td style={{ padding: '0.35rem 0.6rem', borderBottom: '1px solid var(--border)' }}>{label}</td>
                <td style={{ padding: '0.35rem 0.6rem', borderBottom: '1px solid var(--border)', fontWeight: 700, color: 'var(--accent)' }}>{price}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h4 style={{ marginTop: '1rem' }}>עמלת פלטפורמה</h4>
        <p>הפלטפורמה גובה <strong>15%</strong> מכל נסיעה (מקבוע ב-<code>RidePayment.platform_fee</code>).</p>
      </div>
    ),
  },
  {
    id: 'drivers',
    icon: '🚗',
    title: 'נהגים — דרישות ואישור',
    content: (
      <div>
        <h4>דרישות בסיסיות</h4>
        <ul>
          <li>גיל מינימלי: 21</li>
          <li>רישיון נהיגה ישראלי — לפחות 3 שנות ניסיון</li>
          <li>רישיון BI (רישיון עסק תחבורה)</li>
          <li>ביטוח נסיעות מסחרי בתוקף</li>
          <li>טסט שנתי עדכני</li>
          <li>ניקיון פלילי (אישור משטרה)</li>
        </ul>
        <h4>סוגי נהגים</h4>
        <ul>
          <li><code>regular</code> — נהג רגיל (מונית)</li>
          <li><code>premium</code> — שירות פרימיום (רכב יוקרה)</li>
          <li><code>pool</code> — נסיעות שיתופיות</li>
          <li><code>accessible</code> — נסיעות נגישות</li>
        </ul>
        <h4>תהליך אישור</h4>
        <ol>
          <li>הרשמה ואימות OTP</li>
          <li>העלאת מסמכים (KYC Agent)</li>
          <li>בדיקת תוקפי מסמכים (Compliance Agent)</li>
          <li>אישור ידני על-ידי אדמין (<code>PATCH /admin/users/{'{id}'}/approve</code>)</li>
          <li>הפעלת חשבון (<code>PATCH /admin/users/{'{id}'}/activate</code>)</li>
        </ol>
        <h4>ציון נהג</h4>
        <p>מחושב אוטומטית מכלל הדירוגים שנתנו נוסעים. ניתן לראות ב-<code>GET /admin/drivers</code>.</p>
      </div>
    ),
  },
  {
    id: 'rides',
    icon: '🛣️',
    title: 'מחזור חיי נסיעה',
    content: (
      <div>
        <h4>סטטוסים</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
          {[
            { status: 'pending', color: '#f59e0b', label: 'ממתין', desc: 'הנוסע הזמין — ממתין לשיבוץ נהג' },
            { status: 'searching', color: '#3b82f6', label: 'מחפש', desc: 'Dispatch Agent מחפש נהגים' },
            { status: 'accepted', color: '#8b5cf6', label: 'מאושר', desc: 'נהג קיבל — בדרכו לנוסע' },
            { status: 'arrived', color: '#06b6d4', label: 'הגיע', desc: 'הנהג הגיע לנקודת האיסוף' },
            { status: 'in_progress', color: '#f59e0b', label: 'בנסיעה', desc: 'הנסיעה בעיצומה' },
            { status: 'completed', color: '#22c55e', label: 'הושלם', desc: 'הנסיעה הסתיימה בהצלחה' },
            { status: 'cancelled', color: '#ef4444', label: 'בוטל', desc: 'בוטל על-ידי נוסע, נהג או מערכת' },
          ].map(r => (
            <div key={r.status} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <code style={{ minWidth: '90px', fontSize: '0.72rem', background: `${r.color}20`, color: r.color, padding: '0.15rem 0.5rem', borderRadius: '4px', border: `1px solid ${r.color}30` }}>
                {r.status}
              </code>
              <span style={{ fontWeight: 700, minWidth: '60px', fontSize: '0.82rem' }}>{r.label}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.desc}</span>
            </div>
          ))}
        </div>
        <h4>Dispatch Agent — אלגוריתם שיבוץ</h4>
        <ol>
          <li>מוצא נהגים פעילים בטווח של 10 ק"מ</li>
          <li>מחשב ציון לכל נהג: מרחק + דירוג + שיעור קבלה + שעות היום</li>
          <li>שולח הצעה לנהג הטוב ביותר — ממתין 30 שניות</li>
          <li>אם לא קיבל — עובר לנהג הבא</li>
          <li>אחרי 5 ניסיונות — מסמן נסיעה כ-<code>no_drivers</code></li>
        </ol>
      </div>
    ),
  },
  {
    id: 'agents',
    icon: '🤖',
    title: 'סוכני AI',
    content: (
      <div>
        {[
          { icon: '🚗', name: 'Dispatch Agent', model: 'Llama 3.1 70B (Groq)', desc: 'שיבוץ נהגים בזמן אמת. מחשב ציון לכל נהג ושולח הצעות.' },
          { icon: '⚖️', name: 'Compliance Agent', model: 'Claude 3.5 Sonnet', desc: 'בדיקת תוקף מסמכי נהגים. מסמן תוקפי תפוגה ומפיק התראות.' },
          { icon: '📄', name: 'Onboarding Agent', model: 'GPT-4o Vision', desc: 'מדריך נהגים חדשים בתהליך ההרשמה. מזהה מסמכים חסרים.' },
          { icon: '🪪', name: 'KYC Primary Agent', model: 'GPT-4o Vision', desc: 'אימות זהות ראשוני — קורא תעודת זהות, רישיון, ביטוח.' },
          { icon: '🔍', name: 'KYC Reviewer Agent', model: 'Claude 3.5 Sonnet', desc: 'ביקורת שכבה שנייה על החלטות KYC. מוסיף ביאורים.' },
          { icon: '💬', name: 'Support Agent', model: 'GPT-4o mini', desc: 'בוט תמיכה ב-WhatsApp. עונה לנוסעים ונהגים עם זיכרון שיחה.' },
          { icon: '🎯', name: 'Orchestrator Agent', model: 'Gemini 1.5 Pro', desc: 'מנהל מצב מכונת הנסיעות. מתאם בין שירותים ומתריע על חריגות.' },
          { icon: '📈', name: 'Strategic Architect', model: 'Claude Sonnet 4.5', desc: 'מנתח את הפלטפורמה מ-3 זוויות ומייצר דוח אסטרטגי יומי.' },
        ].map(a => (
          <div key={a.name} style={{ display: 'flex', gap: '0.85rem', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{a.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{a.name}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--accent)', marginBottom: '0.2rem' }}>{a.model}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{a.desc}</div>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'whatsapp',
    icon: '💬',
    title: 'WhatsApp — הגדרה וניהול',
    content: (
      <div>
        <h4>הגדרת חיבור</h4>
        <ul>
          <li><strong>ספק</strong>: Meta Cloud API</li>
          <li><strong>מספר</strong>: +972 55-285-8732</li>
          <li><strong>Phone ID</strong>: <code>1036357722901695</code></li>
          <li><strong>WABA ID</strong>: <code>835677552916022</code></li>
          <li><strong>Webhook</strong>: <code>https://easytaxiisrael.com/api/whatsapp/webhook</code></li>
        </ul>
        <h4>ניהול בפאנל</h4>
        <ul>
          <li><strong>שלח הודעת בדיקה</strong>: <code>POST /api/whatsapp/send</code> עם <code>{"{ phone, message }"}</code></li>
          <li><strong>בדוק סטטוס</strong>: <code>GET /api/whatsapp/status</code></li>
          <li><strong>עדכן Webhook</strong>: <code>POST /api/whatsapp/fix-webhook</code></li>
        </ul>
        <h4>Support Bot</h4>
        <p>כל הודעה נכנסת מנותבת ל-Support Agent. לאגנט יש זיכרון שיחה ב-Redis (30 דקות TTL, 10 תורות).</p>
        <h4>תבניות הודעות</h4>
        <p>הודעות יזומות (מחוץ לחלון 24h) חייבות להשתמש ב-Templates מאושרי Meta.</p>
      </div>
    ),
  },
  {
    id: 'admin',
    icon: '⚙️',
    title: 'ניהול — פעולות אדמין',
    content: (
      <div>
        <h4>כניסה לפאנל</h4>
        <ul>
          <li><strong>URL</strong>: <code>https://easytaxiisrael.com/admin/</code></li>
          <li><strong>שם משתמש</strong>: מספר טלפון (ישראלי, ללא +)</li>
          <li><strong>Admin Key</strong>: מוגדר ב-<code>infra/.env</code> כ-<code>ADMIN_KEY</code></li>
        </ul>
        <h4>מבנה API — Endpoints</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', marginBottom: '1rem' }}>
          <thead>
            <tr>
              {['Method', 'Path', 'פעולה'].map(h => (
                <th key={h} style={{ textAlign: 'right', padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ['GET', '/admin/users', 'רשימת כל המשתמשים'],
              ['GET', '/admin/drivers', 'נהגים + ציון + ארנק'],
              ['GET', '/admin/stats', 'סטטיסטיקות הפלטפורמה'],
              ['GET', '/admin/rides', 'כל הנסיעות (עם פילטר)'],
              ['GET', '/admin/audit-logs', 'יומן פעולות'],
              ['GET', '/admin/system-health', 'בריאות המערכת'],
              ['GET', '/admin/daily-report', 'דוח AI שמור'],
              ['POST', '/admin/daily-report/generate', 'ייצור דוח AI חדש'],
              ['PATCH', '/admin/users/{id}/activate', 'הפעלת משתמש'],
              ['PATCH', '/admin/users/{id}/deactivate', 'השבתת משתמש'],
              ['PATCH', '/admin/users/{id}/approve', 'אישור נהג'],
            ].map(([m, p, d]) => (
              <tr key={p}>
                <td style={{ padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--border)' }}>
                  <code style={{ fontSize: '0.7rem', color: m === 'GET' ? '#22c55e' : m === 'POST' ? '#3b82f6' : '#f59e0b' }}>{m}</code>
                </td>
                <td style={{ padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--border)' }}><code style={{ fontSize: '0.72rem' }}>{p}</code></td>
                <td style={{ padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h4>Header נדרש</h4>
        <code style={{ display: 'block', background: 'var(--background)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', overflowX: 'auto' }}>
          X-Admin-Key: {'<YOUR_ADMIN_KEY>'}
        </code>
      </div>
    ),
  },
  {
    id: 'monitoring',
    icon: '📊',
    title: 'ניטור ותחזוקה',
    content: (
      <div>
        <h4>לוגים</h4>
        <pre style={{ background: 'var(--background)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.75rem', overflowX: 'auto', lineHeight: 1.6 }}>{`# לוגי backend בזמן אמת
docker logs -f infra-backend-1 --tail=100

# לוגי nginx
docker logs -f infra-nginx-1 --tail=50

# לוגי postgres
docker logs -f infra-db-1 --tail=50

# כניסה לקונסולת DB
docker exec -it infra-db-1 psql -U postgres easytaxi`}</pre>
        <h4>בדיקות</h4>
        <pre style={{ background: 'var(--background)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.75rem', overflowX: 'auto', lineHeight: 1.6 }}>{`# Unit tests (~287)
cd /root/rideos-platform
docker exec infra-backend-1 python -m pytest backend/tests/ -q

# API בדיקה ידנית
curl -sk -H "X-Admin-Key: KEY" \\
  https://easytaxiisrael.com/api/admin/system-health | python3 -m json.tool`}</pre>
        <h4>עדכון קוד</h4>
        <pre style={{ background: 'var(--background)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.75rem', overflowX: 'auto', lineHeight: 1.6 }}>{`cd /root/rideos-platform

# Backend בלבד (ללא downtime)
docker compose -f infra/docker-compose.yml up -d --build backend

# Frontend rebuild
cd admin-webapp && npm run build
docker exec infra-nginx-1 nginx -s reload

# כל השירותים
docker compose -f infra/docker-compose.yml up -d --build`}</pre>
        <h4>Redis — ניהול Cache</h4>
        <pre style={{ background: 'var(--background)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.75rem', overflowX: 'auto', lineHeight: 1.6 }}>{`# כניסה ל-Redis CLI
docker exec -it infra-redis-1 redis-cli

# מפתחות פעילים
KEYS *

# מחיקת דוח AI (כדי לאלץ ייצור חדש)
DEL admin:daily_report

# מחיקת כל cache שיחות WhatsApp
KEYS wa_chat_history:* | xargs redis-cli DEL`}</pre>
      </div>
    ),
  },
  {
    id: 'env',
    icon: '🔐',
    title: 'משתני סביבה — infra/.env',
    content: (
      <div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          קובץ הסביבה הראשי הוא <code>/root/rideos-platform/infra/.env</code>. זהו הקובץ הנטען בפועל ע"י docker-compose.
          <strong> לא</strong> לבלבל עם <code>/root/rideos-platform/.env</code>.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead>
            <tr>
              {['משתנה', 'תיאור'].map(h => (
                <th key={h} style={{ textAlign: 'right', padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ['DATABASE_URL', 'PostgreSQL connection string'],
              ['REDIS_URL', 'Redis connection string'],
              ['SECRET_KEY', 'JWT signing key'],
              ['ADMIN_KEY', 'מפתח אדמין לכל ה-admin endpoints'],
              ['OPENAI_API_KEY', 'OpenAI — GPT-4o, GPT-4o-mini'],
              ['ANTHROPIC_API_KEY', 'Anthropic — Claude Sonnet'],
              ['GROQ_API_KEY', 'Groq — Llama 3.1 (Dispatch Agent)'],
              ['GOOGLE_AI_API_KEY', 'Google AI — Gemini 1.5 Pro'],
              ['WHATSAPP_PHONE_NUMBER_ID', 'Meta Cloud API Phone ID'],
              ['WHATSAPP_WABA_ID', 'WhatsApp Business Account ID'],
              ['WHATSAPP_ACCESS_TOKEN', 'System User Token (לא פג תוקף)'],
              ['WHATSAPP_WEBHOOK_VERIFY_TOKEN', 'סיסמת אימות Webhook'],
              ['WHATSAPP_PLATFORM_PHONE', 'מספר הפלטפורמה (ללא +)'],
            ].map(([k, v]) => (
              <tr key={k}>
                <td style={{ padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--border)' }}><code style={{ fontSize: '0.72rem', color: 'var(--accent)' }}>{k}</code></td>
                <td style={{ padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  },
]

export default function Handbook() {
  const [open, setOpen] = useState<string | null>('overview')

  function toggle(id: string) {
    setOpen(prev => prev === id ? null : id)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>📖 מדריך המערכת</h1>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>EasyTaxi Israel — System Handbook</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {SECTIONS.map(sec => (
          <div key={sec.id} style={{
            background: 'var(--surface)',
            border: `1px solid ${open === sec.id ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: '10px',
            overflow: 'hidden',
            transition: 'border-color 0.2s',
          }}>
            <button
              onClick={() => toggle(sec.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.9rem 1rem', background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-primary)', textAlign: 'right',
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>{sec.icon}</span>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', flex: 1 }}>{sec.title}</span>
              <span style={{
                fontSize: '0.75rem', color: open === sec.id ? 'var(--accent)' : 'var(--text-secondary)',
                transform: open === sec.id ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s',
              }}>▼</span>
            </button>
            {open === sec.id && (
              <div style={{
                padding: '0 1rem 1rem',
                fontSize: '0.85rem',
                lineHeight: 1.7,
                color: 'var(--text-primary)',
                borderTop: '1px solid var(--border)',
              }}>
                <div style={{ paddingTop: '0.75rem' }}>{sec.content}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
