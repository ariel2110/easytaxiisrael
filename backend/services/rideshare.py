"""
Rideshare driver service.

Business logic for non-licensed (Uber-style) rideshare drivers in Israel.
The "חוק אובר" (2026) passed first reading in March 2026 — secondary
legislation is still pending.  Until it comes into full effect:
  • No payments may be accepted.
  • No fares may be charged through the platform.
  • Drivers may register and submit documents in preparation.
"""

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.rideshare import (
    RideshareDocument,
    RideshareDocStatus,
    RideshareDocType,
    RideshareProfile,
    RideshareStatus,
)
from models.user import DriverType, User

# ---------------------------------------------------------------------------
# Legislation status
# ---------------------------------------------------------------------------

LEGISLATION_STATUS = {
    "law_name": "חוק שירותי הסעה שיתופית (תיקון פקודת התעבורה), תשפ\"ו-2026",
    "common_name": "\"חוק אובר\"",
    "current_stage": "קריאה ראשונה עברה — מרץ 2026",
    "next_steps": [
        "קריאה שנייה ושלישית בכנסת",
        "תקנות ביצוע ממשרד התחבורה",
        "הקמת קרן הפיצוי לנהגי מוניות",
        "הסמכת גופי הכשרה לנהגים",
    ],
    "estimated_active": "סוף 2026 / תחילת 2027 (תלוי קצב חקיקה)",
    "official_links": [
        {
            "title": "משרד התחבורה — ידיעות ועדכונים",
            "url": "https://www.gov.il/he/pages/news-26",
        },
        {
            "title": "אתר הכנסת — מעקב הצעות חוק",
            "url": "https://m.knesset.gov.il/Laws/Pages/PdfLawBill.aspx",
        },
        {
            "title": "רשות הרישוי — תחבורה שיתופית",
            "url": "https://www.gov.il/he/departments/ministry_of_transport",
        },
    ],
    "why_no_payment_yet": (
        "החוק עבר רק קריאה ראשונה. עד שהתקנות הסופיות יפורסמו ברשומות ומשרד "
        "התחבורה יסיים להכין את מערכת הרישוי, הפעלה מסחרית של שירותי הסעה "
        "שיתופית בתשלום — אסורה מכוח פקודת התעבורה הקיימת (סעיף 33). "
        "הפרה עלולה לגרור קנסות, שלילת רישיון ואף הליך פלילי."
    ),
}

# ---------------------------------------------------------------------------
# Document requirements — what drivers need to prepare
# ---------------------------------------------------------------------------

REQUIRED_DOCUMENTS = [
    {
        "id": RideshareDocType.drivers_license,
        "name_he": "רישיון נהיגה בתוקף (4+ שנות ותק)",
        "name_en": "Valid Driving Licence (4+ years experience)",
        "required": True,
        "why": "חוק אובר דורש ותק נהיגה מינימלי של 4 שנים",
        "accepted_formats": ["PDF", "תמונה ברורה — שני הצדדים"],
        "where_to_get": "רשות הרישוי — כל לשכת רישוי רכב",
        "notes": "חייב להיות בתוקף ורישיון B לפחות. רישיון D — יתרון.",
        "legal_basis": "חוק שירותי הסעה שיתופית, תשפ\"ו-2026, סעיף 5",
    },
    {
        "id": RideshareDocType.identity_document,
        "name_he": "תעודת זהות / דרכון",
        "name_en": "Identity Document",
        "required": True,
        "why": "אימות זהות מלא לפני כניסה לפלטפורמה",
        "accepted_formats": ["PDF", "תמונה ברורה — שני הצדדים"],
        "where_to_get": "משרד הפנים",
        "notes": "תעודת זהות עם ספח, דרכון ישראלי בתוקף, או תעודת עולה",
        "legal_basis": "חוק הגנת הפרטיות ותקנות KYC",
    },
    {
        "id": RideshareDocType.background_check,
        "name_he": "אישור יושר / תדפיס פלילי",
        "name_en": "Criminal Background Check",
        "required": True,
        "why": "נהג המסיע נוסעים חייב להיות ללא עבר פלילי רלוונטי",
        "accepted_formats": ["PDF רשמי בלבד — ממשטרת ישראל"],
        "where_to_get": "מרכז שירות אזרחי משטרת ישראל — ניתן להגיש אונליין",
        "how_to_apply": "https://www.gov.il/he/service/request_for_criminal_record",
        "notes": "תדפיס לא ישן מ-3 חודשים",
        "legal_basis": "חוק שירותי הסעה שיתופית, תשפ\"ו-2026, סעיף 6",
    },
    {
        "id": RideshareDocType.profile_photo,
        "name_he": "תמונת פרופיל",
        "name_en": "Profile Photo",
        "required": True,
        "why": "מוצגת לנוסע לפני הנסיעה — גורם בטיחות",
        "accepted_formats": ["JPEG", "PNG — רקע בהיר, פנים ברורות, ללא משקפי שמש"],
        "where_to_get": "צילום עצמי — לפי הנחיות",
        "notes": "רק פנים — לא כולל כלי רכב. תמונה עדכנית.",
        "legal_basis": "דרישה פנימית EasyTaxi לאמון נוסעים",
    },
    {
        "id": RideshareDocType.vehicle_registration,
        "name_he": "רישיון רכב",
        "name_en": "Vehicle Registration",
        "required": True,
        "why": "אימות שהרכב רשום על שם הנהג ותקין",
        "accepted_formats": ["PDF", "תמונה ברורה"],
        "where_to_get": "רשות הרישוי",
        "notes": "הרכב חייב להיות בגיל עד 7 שנים",
        "legal_basis": "פקודת התעבורה [נוסח חדש], תשכ\"א-1961",
    },
    {
        "id": RideshareDocType.insurance_mandatory,
        "name_he": "ביטוח חובה תקף",
        "name_en": "Mandatory Vehicle Insurance",
        "required": True,
        "why": "דרישת חוק בסיסית לכל רכב על הכביש",
        "accepted_formats": ["PDF", "תמונה ברורה"],
        "where_to_get": "כל חברת ביטוח",
        "notes": "חייב להיות בתוקף — לא פג תוקף",
        "legal_basis": "חוק פיצויים לנפגעי תאונות דרכים, תשל\"ה-1975",
    },
    {
        "id": RideshareDocType.insurance_commercial,
        "name_he": "ביטוח מסחרי / צד ג' לשימוש מסחרי",
        "name_en": "Commercial Insurance (rideshare use)",
        "required": True,
        "why": "ביטוח רגיל אינו מכסה נסיעות בתשלום — דרוש כיסוי מסחרי",
        "accepted_formats": ["PDF", "תמונה ברורה"],
        "where_to_get": "חברת ביטוח — ציין שמדובר בשימוש לשירות הסעה",
        "notes": "חלק מחברות הביטוח עדיין לא מציעות זאת — בדוק עם סוכן ביטוח",
        "legal_basis": "חוק שירותי הסעה שיתופית, תשפ\"ו-2026, סעיף 9",
    },
    {
        "id": RideshareDocType.vehicle_inspection,
        "name_he": "תעודת טסט תקפה",
        "name_en": "Vehicle Roadworthiness Certificate",
        "required": True,
        "why": "הרכב חייב לעבור בדיקה שנתית",
        "accepted_formats": ["PDF", "תמונת מדבקת טסט + אישור מכון הרישוי"],
        "where_to_get": "מכון רישוי מורשה",
        "notes": "טסט שנתי בתוקף",
        "legal_basis": "תקנות התעבורה, תשכ\"א-1961, תקנה 312",
    },
    {
        "id": RideshareDocType.training_certificate,
        "name_he": "תעודת הכשרה (כשתינתן על ידי משרד התחבורה)",
        "name_en": "Driver Training Certificate (when available)",
        "required": False,
        "why": "חוק אובר יחייב הכשרה ייעודית — מסלול עדיין לא הוכן",
        "accepted_formats": ["PDF"],
        "where_to_get": "גופי הכשרה מורשים ממשרד התחבורה (עתידי)",
        "notes": "אינו נדרש כרגע — ההכשרה תיקבע בתקנות",
        "legal_basis": "חוק שירותי הסעה שיתופית, תשפ\"ו-2026, סעיף 7",
    },
]

# ---------------------------------------------------------------------------
# FAQ
# ---------------------------------------------------------------------------

RIDESHARE_FAQ = [
    {
        "q": "מה זה 'נהג שיתופי' (הובר/אובר) לעומת נהג מונית מורשה?",
        "a": (
            "נהג מונית מורשה מחזיק ברישיון D ורכב המאושר לשירות מונית. "
            "נהג שיתופי הוא אזרח פרטי המסיע נוסעים דרך אפליקציה ברכב פרטי שלו, "
            "ללא רישיון מונית. חוק אובר (2026) יאפשר זאת בישראל תחת רגולציה מחמירה."
        ),
    },
    {
        "q": "האם אני יכול לקבל כסף כבר עכשיו?",
        "a": (
            "לא. החוק עבר רק קריאה ראשונה. כל עוד התקנות הסופיות לא פורסמו, "
            "קבלת תשלום עבור נסיעות אסורה מכוח פקודת התעבורה הקיימת. "
            "EasyTaxi לא מעבירה ולא תעביר כסף לנהגי 'הובר' עד לאישור החוק המלא."
        ),
    },
    {
        "q": "למה להירשם עכשיו אם אסור לפעול?",
        "a": (
            "ההרשמה מאפשרת לך להגיש מסמכים ולהיות מוכן לרגע שהחוק נכנס לתוקף. "
            "נהגים שיסיימו את כל הדרישות מראש יהיו ראשונים לקבל אישור פעילות."
        ),
    },
    {
        "q": "מה יקרה אם אנסה לקחת כסף בניגוד לתנאים?",
        "a": (
            "חשבונך יושעה מיידית. נהיגה מסחרית ללא רישיון מהווה עבירה פלילית "
            "לפי פקודת התעבורה — עונש: קנס עד 30,000 ₪ ו/או שלילת רישיון."
        ),
    },
    {
        "q": "כמה שנות ותק נהיגה דרושות?",
        "a": (
            "חוק אובר דורש ותק נהיגה של לפחות 4 שנים ברישיון B בתוקף. "
            "עברות חמורות בשלוש השנים האחרונות עלולות לפסול."
        ),
    },
    {
        "q": "האם צריך רכב מיוחד?",
        "a": (
            "לא רכב מיוחד, אבל: גיל מקסימלי 7 שנים, עבר טסט בתוקף, "
            "ביטוח חובה + ביטוח מסחרי, ותקינות מלאה. "
            "4 תמונות חיצוניות + 2 תמונות פנים נדרשות."
        ),
    },
    {
        "q": "מה ההבדל לגבי ביטוח?",
        "a": (
            "ביטוח חובה רגיל אינו מספיק. כשהחוק נכנס לתוקף, תצטרך ביטוח מסחרי "
            "המכסה הסעת נוסעים. חלק מחברות הביטוח עדיין לא מציעות זאת — "
            "מומלץ לפנות לסוכן ביטוח כבר עכשיו."
        ),
    },
    {
        "q": "האם EasyTaxi תעדכן אותי כשהחוק נכנס לתוקף?",
        "a": (
            "כן. כל נהג שנרשם כ'שיתופי' יקבל התראה בוואטסאפ ברגע שהחוק מאושר "
            "ומשרד התחבורה מפרסם את התקנות הסופיות."
        ),
    },
    {
        "q": "מה קרן הפיצוי לנהגי מוניות?",
        "a": (
            "החוק קובע הקמת קרן שתפצה נהגי מוניות ותיקים על ירידה בהכנסות "
            "עקב תחרות שיתופית. מימון: 'מס מוניות' של כמה אגורות לכל ק\"מ "
            "בנסיעה שיתופית."
        ),
    },
    {
        "q": "איפה אני יכול לעקוב אחר קידמת החקיקה?",
        "a": (
            "אתר הכנסת: https://www.knesset.gov.il | "
            "אתר משרד התחבורה: https://www.gov.il/he/departments/ministry_of_transport | "
            "ידיעות ממשרד התחבורה: https://www.gov.il/he/pages/news-26"
        ),
    },
]

# ---------------------------------------------------------------------------
# Service functions
# ---------------------------------------------------------------------------

async def get_or_create_profile(
    db: AsyncSession, driver_id: uuid.UUID
) -> RideshareProfile:
    result = await db.execute(
        select(RideshareProfile).where(RideshareProfile.driver_id == driver_id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        profile = RideshareProfile(driver_id=driver_id)
        db.add(profile)
        await db.flush()
    return profile


async def register_as_rideshare(
    db: AsyncSession, driver: User
) -> RideshareProfile:
    """
    Mark a driver as rideshare type (non-licensed taxi).
    Creates their RideshareProfile if it doesn't exist yet.
    """
    if driver.driver_type == DriverType.rideshare:
        # Already registered — just return existing profile
        return await get_or_create_profile(db, driver.id)

    driver.driver_type = DriverType.rideshare
    profile = await get_or_create_profile(db, driver.id)
    await db.commit()
    await db.refresh(profile)
    return profile


async def acknowledge_no_payment(
    db: AsyncSession,
    driver_id: uuid.UUID,
    client_ip: str | None,
) -> RideshareProfile:
    """
    Driver explicitly acknowledges they will NOT accept any payment until
    the legislation comes into full effect.
    """
    profile = await get_or_create_profile(db, driver_id)
    if profile.acknowledged_no_payment:
        # Already acknowledged — idempotent
        return profile

    profile.acknowledged_no_payment = True
    profile.acknowledged_at = datetime.now(timezone.utc)
    profile.acknowledged_ip = client_ip
    # Move status forward
    if profile.status == RideshareStatus.pending_legislation:
        profile.status = RideshareStatus.documents_pending
    await db.commit()
    await db.refresh(profile)
    return profile


async def upload_document(
    db: AsyncSession,
    driver_id: uuid.UUID,
    doc_type: RideshareDocType,
    file_key: str,
) -> RideshareDocument:
    """Upload or replace a rideshare document."""
    profile = await get_or_create_profile(db, driver_id)
    if not profile.acknowledged_no_payment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="יש לאשר את תנאי 'אי קבלת תשלום' לפני העלאת מסמכים",
        )

    # Replace existing doc of same type
    existing = await db.execute(
        select(RideshareDocument).where(
            RideshareDocument.driver_id == driver_id,
            RideshareDocument.doc_type == doc_type,
        )
    )
    doc = existing.scalar_one_or_none()
    if doc:
        doc.file_key = file_key
        doc.status = RideshareDocStatus.pending
        doc.rejection_reason = None
        doc.reviewed_at = None
        doc.reviewed_by = None
    else:
        doc = RideshareDocument(
            driver_id=driver_id, doc_type=doc_type, file_key=file_key
        )
        db.add(doc)

    # Update profile status
    if profile.status == RideshareStatus.documents_pending:
        profile.status = RideshareStatus.documents_submitted

    await db.commit()
    await db.refresh(doc)
    return doc


async def list_documents(
    db: AsyncSession, driver_id: uuid.UUID
) -> list[RideshareDocument]:
    result = await db.execute(
        select(RideshareDocument)
        .where(RideshareDocument.driver_id == driver_id)
        .order_by(RideshareDocument.doc_type)
    )
    return list(result.scalars().all())


async def review_document(
    db: AsyncSession,
    doc_id: uuid.UUID,
    approved: bool,
    reviewer_id: uuid.UUID,
    rejection_reason: str | None = None,
) -> RideshareDocument:
    doc = await db.get(RideshareDocument, doc_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    doc.status = RideshareDocStatus.approved if approved else RideshareDocStatus.rejected
    doc.rejection_reason = rejection_reason if not approved else None
    doc.reviewed_at = datetime.now(timezone.utc)
    doc.reviewed_by = reviewer_id

    # Flush the status change so _reevaluate_readiness sees it in the query
    await db.flush()
    # Re-evaluate profile readiness
    await _reevaluate_readiness(db, doc.driver_id)
    await db.commit()
    await db.refresh(doc)
    return doc


async def _reevaluate_readiness(
    db: AsyncSession, driver_id: uuid.UUID
) -> None:
    """Mark profile as 'ready' when all required documents are approved."""
    result = await db.execute(
        select(RideshareDocument).where(
            RideshareDocument.driver_id == driver_id,
            RideshareDocument.status == RideshareDocStatus.approved,
        )
    )
    approved_types = {d.doc_type for d in result.scalars().all()}
    required = {r["id"] for r in REQUIRED_DOCUMENTS if r["required"]}
    profile = await get_or_create_profile(db, driver_id)
    if required.issubset(approved_types):
        profile.status = RideshareStatus.ready
    await db.commit()
