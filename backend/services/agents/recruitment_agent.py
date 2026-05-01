"""
Recruitment Agent — generates personalized Hebrew WhatsApp recruitment messages
for taxi/rideshare drivers to join the EasyTaxi platform.

Uses Anthropic Claude for high-quality, persuasive Hebrew copy.
Falls back to a quality hardcoded template when API is unavailable.
"""
from __future__ import annotations

import logging
import random

import httpx

from core.config import settings

log = logging.getLogger(__name__)

_DRIVER_LINK = "https://driver.easytaxiisrael.com"

# ── Fallback templates ────────────────────────────────────────────────────────
# Multiple variants to avoid repetition when Claude is unavailable

_FALLBACK_TEMPLATES = [
    """שלום {name} 👋

*EasyTaxi ישראל* — פלטפורמת הנסיעות החדשה שמחפשת נהגים מוכשרים כמוך!

✅ *למה להצטרף אלינו?*
• 💰 85% מכל נסיעה ישירות לכיסך (הגבוה בשוק!)
• 📱 אפליקציה פשוטה ונוחה — מוכן תוך 48 שעות
• 🕐 שעות גמישות לחלוטין — עובד לפי הזמן שלך
• 🛡️ ביטוח מקצועי + תמיכה 24/7
• 🚀 לידים ישירים — אתה לא מחפש נוסעים, הם מחפשים אותך

📍 אזור הפעילות: {area}

הצטרף עכשיו — בחינם ← {link}

לשאלות: השב להודעה זו 💬""",

    """היי {name}! 

מחפש להגדיל את ההכנסה מהנהיגה? 🚗💨

*EasyTaxi ישראל* מגיעה ל{area} ואנחנו מחפשים נהגים מקצועיים.

🏆 *מה מייחד אותנו:*
→ 85% עמלה — הכי גבוה בישראל
→ אין עלות הצטרפות / אין מינימום נסיעות
→ תשלום ישיר לנהג — שקוף ומיידי
→ אפליקציה בעברית מלאה

⚡ ההרשמה לוקחת 5 דקות: {link}

*{name}*, אנחנו רוצים אותך בצוות! 💪""",
]


async def generate_message(
    name: str | None,
    area: str | None = None,
    business_type: str | None = None,
) -> str:
    """
    Generate a personalized Hebrew recruitment message for a driver lead.

    Tries Claude first, falls back to template on failure.
    """
    display_name = name or "שלום"
    display_area = area or "אזורך"
    display_business = business_type or "מונית"

    # Try Claude
    claude_msg = await _generate_with_claude(display_name, display_area, display_business)
    if claude_msg:
        return claude_msg

    # Fallback template
    template = random.choice(_FALLBACK_TEMPLATES)
    return template.format(name=display_name, area=display_area, link=_DRIVER_LINK)


async def _generate_with_claude(name: str, area: str, business_type: str) -> str | None:
    """Call Anthropic Claude to generate a personalized recruitment message."""
    key = settings.ANTHROPIC_API_KEY
    if not key:
        return None

    system = """אתה מומחה שיווק דיגיטלי שכותב הודעות גיוס לנהגים בעברית.
הכתיבה שלך: ישירה, חמה, מקצועית. משתמש ב-WhatsApp formatting (*bold*, _italic_).
הודעות קצרות (מקסימום 200 מילים), מפרגנות לנהג, עם קריאה לפעולה ברורה.
אל תגזים בהבטחות. כתוב בגוף שני, פנה ישירות לנהג."""

    user = f"""כתוב הודעת וואטסאפ לגיוס נהג ל-EasyTaxi ישראל.

פרטי הנהג:
- שם: {name}
- עיר/אזור: {area}
- סוג: {business_type}

מידע על הפלטפורמה:
- 85% מכל נסיעה לנהג (הגבוה בשוק)
- אפליקציה בעברית, פשוטה לשימוש
- שעות גמישות, אין מינימום
- תמיכה 24/7
- הצטרפות חינמית תוך 48 שעות
- קישור הרשמה: {_DRIVER_LINK}

הכלל: הודעה אחת בלבד בעברית. אל תוסיף הסברים מחוץ לתוכן ההודעה."""

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            r = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "claude-3-5-sonnet-20241022",
                    "max_tokens": 512,
                    "system": system,
                    "messages": [{"role": "user", "content": user}],
                },
            )
            r.raise_for_status()
            return r.json()["content"][0]["text"].strip()
    except Exception as exc:
        log.warning("[recruitment_agent] Claude call failed: %s", exc)
        return None
