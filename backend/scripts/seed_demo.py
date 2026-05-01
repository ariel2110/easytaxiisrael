"""
Demo data seed for EasyTaxi Israel.

Creates 10 verified drivers (numbered 1-10), 10 passengers (11-20),
and 10 diverse ride scenarios with payments, ratings, and full audit trails.

Usage via API: POST /admin/seed-demo
               POST /admin/seed-demo?force=true  (re-seed)
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from models.user import User, UserRole, AuthStatus, DriverType
from models.ride import Ride, RideStatus
from models.payment import RidePayment, PaymentStatus, DriverWallet, WalletEntry, WalletEntryType
from models.rating import Rating, RatingDirection
from models.audit import AuditLog, AuditAction


# ── Sentinel phone prefix to identify demo data ───────────────────────────────
_DRIVER_PHONES    = [f"9725010000{i:02d}" for i in range(1, 11)]   # 972501000001..10
_PASSENGER_PHONES = [f"9725010000{i:02d}" for i in range(11, 21)]  # 972501000011..20


# ── Static driver data ────────────────────────────────────────────────────────
_DRIVERS = [
    {
        "phone": "972501000001", "full_name": "דוד כהן", "city": "פתח תקווה",
        "lat": 32.0875, "lng": 34.8878,
        "driver_type": DriverType.licensed_taxi, "vehicle_number": "52-483-27",
        "docs": [
            ("תעודת זהות", "ID-DK-293847561", "2030-03-15", "תז"),
            ("רישיון נהיגה", "DL-4728391-IL", "2028-07-22", "רישיון נהיגה"),
            ("ביטוח מגדל", "POL-MGL-2024-88471", "2026-01-10", "ביטוח"),
            ("רישיון מונית", "TAXI-PT-0041", "2027-05-30", "רישיון מונית"),
            ("טסט שנתי", "MOT-2025-52483", "2026-02-28", "טסט"),
        ],
    },
    {
        "phone": "972501000002", "full_name": "יוסי לוי", "city": "ראשון לציון",
        "lat": 31.9657, "lng": 34.7991,
        "driver_type": DriverType.rideshare, "vehicle_number": "24-917-63",
        "docs": [
            ("תעודת זהות", "ID-YL-187364920", "2031-09-04", "תז"),
            ("רישיון נהיגה", "DL-9182736-IL", "2029-12-15", "רישיון נהיגה"),
            ("ביטוח הפניקס", "POL-PHX-2025-33219", "2026-03-20", "ביטוח"),
            ("טסט שנתי", "MOT-2025-24917", "2026-04-12", "טסט"),
        ],
    },
    {
        "phone": "972501000003", "full_name": "משה אברהם", "city": "תל אביב",
        "lat": 32.0853, "lng": 34.7818,
        "driver_type": DriverType.licensed_taxi, "vehicle_number": "73-562-18",
        "docs": [
            ("תעודת זהות", "ID-MA-374829105", "2029-06-20", "תז"),
            ("רישיון נהיגה", "DL-3748291-IL", "2030-03-08", "רישיון נהיגה"),
            ("ביטוח מנורה", "POL-MNR-2025-55873", "2026-02-15", "ביטוח"),
            ("רישיון מונית", "TAXI-TA-0117", "2027-11-25", "רישיון מונית"),
            ("טסט שנתי", "MOT-2025-73562", "2026-01-30", "טסט"),
        ],
    },
    {
        "phone": "972501000004", "full_name": "אבי שמעון", "city": "חולון",
        "lat": 32.0118, "lng": 34.7799,
        "driver_type": DriverType.rideshare, "vehicle_number": "18-234-55",
        "docs": [
            ("תעודת זהות", "ID-AS-928374651", "2032-01-18", "תז"),
            ("רישיון נהיגה", "DL-8273645-IL", "2028-08-30", "רישיון נהיגה"),
            ("ביטוח איילון", "POL-AYL-2025-71102", "2026-05-07", "ביטוח"),
            ("טסט שנתי", "MOT-2025-18234", "2026-06-15", "טסט"),
        ],
    },
    {
        "phone": "972501000005", "full_name": "רוני בן דוד", "city": "רמת גן",
        "lat": 32.0684, "lng": 34.8248,
        "driver_type": DriverType.licensed_taxi, "vehicle_number": "61-789-42",
        "docs": [
            ("תעודת זהות", "ID-RB-563728491", "2028-12-05", "תז"),
            ("רישיון נהיגה", "DL-5637284-IL", "2027-06-14", "רישיון נהיגה"),
            ("ביטוח כלל", "POL-KLL-2025-44891", "2026-07-20", "ביטוח"),
            ("רישיון מונית", "TAXI-RG-0058", "2028-03-10", "רישיון מונית"),
            ("טסט שנתי", "MOT-2025-61789", "2026-03-22", "טסט"),
        ],
    },
    {
        "phone": "972501000006", "full_name": "שלמה גולן", "city": "באר שבע",
        "lat": 31.2518, "lng": 34.7913,
        "driver_type": DriverType.rideshare, "vehicle_number": "35-110-79",
        "docs": [
            ("תעודת זהות", "ID-SG-748291635", "2030-04-25", "תז"),
            ("רישיון נהיגה", "DL-7482916-IL", "2031-10-02", "רישיון נהיגה"),
            ("ביטוח שירה", "POL-SHR-2024-99201", "2026-08-30", "ביטוח"),
            ("טסט שנתי", "MOT-2025-35110", "2026-09-08", "טסט"),
        ],
    },
    {
        "phone": "972501000007", "full_name": "אלי פרץ", "city": "נתניה",
        "lat": 32.3226, "lng": 34.8532,
        "driver_type": DriverType.licensed_taxi, "vehicle_number": "82-345-61",
        "docs": [
            ("תעודת זהות", "ID-EP-192837465", "2027-08-14", "תז"),
            ("רישיון נהיגה", "DL-1928374-IL", "2026-11-28", "רישיון נהיגה"),
            ("ביטוח הראל", "POL-HRL-2025-22734", "2026-10-15", "ביטוח"),
            ("רישיון מונית", "TAXI-NT-0029", "2027-09-05", "רישיון מונית"),
            ("טסט שנתי", "MOT-2025-82345", "2026-11-12", "טסט"),
        ],
    },
    {
        "phone": "972501000008", "full_name": "נחום עמר", "city": "חיפה",
        "lat": 32.7940, "lng": 34.9896,
        "driver_type": DriverType.rideshare, "vehicle_number": "54-678-33",
        "docs": [
            ("תעודת זהות", "ID-NA-836472910", "2033-03-30", "תז"),
            ("רישיון נהיגה", "DL-8364729-IL", "2029-05-18", "רישיון נהיגה"),
            ("ביטוח דירקט", "POL-DRT-2025-67450", "2026-12-01", "ביטוח"),
            ("טסט שנתי", "MOT-2025-54678", "2026-07-25", "טסט"),
        ],
    },
    {
        "phone": "972501000009", "full_name": "גדי ישראלי", "city": "ירושלים",
        "lat": 31.7683, "lng": 35.2137,
        "driver_type": DriverType.licensed_taxi, "vehicle_number": "92-001-14",
        "docs": [
            ("תעודת זהות", "ID-GY-274918365", "2028-07-11", "תז"),
            ("רישיון נהיגה", "DL-2749183-IL", "2032-02-20", "רישיון נהיגה"),
            ("ביטוח מנורה", "POL-MNR-2025-80192", "2026-04-25", "ביטוח"),
            ("רישיון מונית", "TAXI-JM-0073", "2027-06-18", "רישיון מונית"),
            ("טסט שנתי", "MOT-2025-92001", "2026-08-14", "טסט"),
        ],
    },
    {
        "phone": "972501000010", "full_name": "בני ניסן", "city": "אשדוד",
        "lat": 31.8044, "lng": 34.6553,
        "driver_type": DriverType.rideshare, "vehicle_number": "47-523-88",
        "docs": [
            ("תעודת זהות", "ID-BN-593847261", "2029-10-09", "תז"),
            ("רישיון נהיגה", "DL-5938472-IL", "2027-04-03", "רישיון נהיגה"),
            ("ביטוח שומרה", "POL-SHM-2025-31874", "2026-06-28", "ביטוח"),
            ("טסט שנתי", "MOT-2025-47523", "2026-05-19", "טסט"),
        ],
    },
]

_PASSENGERS = [
    {"phone": "972501000011", "full_name": "שרה מזרחי"},
    {"phone": "972501000012", "full_name": "חנה כץ"},
    {"phone": "972501000013", "full_name": "רחל שמיר"},
    {"phone": "972501000014", "full_name": "תמר דמארי"},
    {"phone": "972501000015", "full_name": "מיכל ברקוביץ"},
    {"phone": "972501000016", "full_name": "ליאור אזולאי"},
    {"phone": "972501000017", "full_name": "יעל גרינברג"},
    {"phone": "972501000018", "full_name": "נועה פרידמן"},
    {"phone": "972501000019", "full_name": "אורית חיימוביץ"},
    {"phone": "972501000020", "full_name": "מיה שטרן"},
]

# ── Ride scenarios ────────────────────────────────────────────────────────────
#  driver_index = 0-based index into _DRIVERS list
#  passenger_index = 0-based index into _PASSENGERS list
#  days_ago = how many days ago this ride happened
_SCENARIOS: list[dict] = [
    # 1 — Tel Aviv → Airport, straight shot
    {
        "id": 1,
        "passenger_idx": 0, "driver_idx": 2,
        "pickup_lat": 32.0853, "pickup_lng": 34.7818,
        "dropoff_lat": 32.0055, "dropoff_lng": 34.8854,
        "pickup_address": "שדרות רוטשילד 22, תל אביב",
        "dropoff_address": "נמל תעופה בן גוריון, טרמינל 3",
        "distance_km": 16.0,
        "wait_minutes": 0, "traffic_minutes": 0,
        "multiplier": 1.0, "special": "—",
        "special_code": "normal",
        "total_fare": 66.00,
        "ride_minutes": 22, "days_ago": 3, "hour": 10,
        "cancellation_reason": None,
        "address_change": None,
        "passenger_score": 5, "driver_score": 5,
        "passenger_comment": "נהג מצוין, הגיע מהר!",
        "driver_comment": "נוסע נחמד מאוד",
    },
    # 2 — Petah Tikva → Bnei Brak, with 8-min wait
    {
        "id": 2,
        "passenger_idx": 1, "driver_idx": 0,
        "pickup_lat": 32.0875, "pickup_lng": 34.8878,
        "dropoff_lat": 32.0843, "dropoff_lng": 34.8337,
        "pickup_address": "שדרות ז'בוטינסקי 10, פתח תקווה",
        "dropoff_address": "רחוב רבי עקיבא 44, בני ברק",
        "distance_km": 4.0,
        "wait_minutes": 8, "traffic_minutes": 0,
        "multiplier": 1.0, "special": "⏳ המתנה 8 דקות",
        "special_code": "wait",
        "total_fare": 30.40,
        "ride_minutes": 12, "days_ago": 7, "hour": 14,
        "cancellation_reason": None,
        "address_change": None,
        "passenger_score": 4, "driver_score": 5,
        "passenger_comment": "הנהג חיכה בסבלנות",
        "driver_comment": "בסדר גמור",
    },
    # 3 — Rishon → Holon with ADDRESS CHANGE mid-ride (7km→9km)
    {
        "id": 3,
        "passenger_idx": 2, "driver_idx": 1,
        "pickup_lat": 31.9657, "pickup_lng": 34.7991,
        "dropoff_lat": 32.0118, "dropoff_lng": 34.7799,
        "pickup_address": "רחוב הרצל 12, ראשון לציון",
        "dropoff_address": "רחוב סוקולוב 45, חולון",
        "distance_km": 9.0,  # updated after address change
        "wait_minutes": 0, "traffic_minutes": 0,
        "multiplier": 1.0, "special": "🔄 שינוי יעד (7→9 ק״מ)",
        "special_code": "address_change",
        "total_fare": 41.50,
        "ride_minutes": 18, "days_ago": 12, "hour": 11,
        "cancellation_reason": None,
        "address_change": {
            "original_dropoff": "כיכר העצמאות, חולון",
            "new_dropoff": "רחוב סוקולוב 45, חולון",
            "original_km": 7.0,
            "new_km": 9.0,
        },
        "passenger_score": 4, "driver_score": 4,
        "passenger_comment": "גמיש לשינוי יעד, תודה",
        "driver_comment": "שינה יעד אבל הכל בסדר",
    },
    # 4 — Tel Aviv → Ramat Gan, NIGHT RATE ×1.2
    {
        "id": 4,
        "passenger_idx": 3, "driver_idx": 4,
        "pickup_lat": 32.0748, "pickup_lng": 34.7896,
        "dropoff_lat": 32.0684, "dropoff_lng": 34.8248,
        "pickup_address": "דיזנגוף 50, תל אביב",
        "dropoff_address": "ביאליק 8, רמת גן",
        "distance_km": 5.0,
        "wait_minutes": 0, "traffic_minutes": 0,
        "multiplier": 1.2, "special": "🌙 תעריף לילה ×1.2",
        "special_code": "night",
        "total_fare": 33.00,
        "ride_minutes": 14, "days_ago": 5, "hour": 23,
        "cancellation_reason": None,
        "address_change": None,
        "passenger_score": 5, "driver_score": 5,
        "passenger_comment": "ברגע הגיע, מקצועי",
        "driver_comment": "נוסע נחמד",
    },
    # 5 — Petah Tikva → Tel Aviv, standard
    {
        "id": 5,
        "passenger_idx": 4, "driver_idx": 3,
        "pickup_lat": 32.0875, "pickup_lng": 34.8878,
        "dropoff_lat": 32.0853, "dropoff_lng": 34.7818,
        "pickup_address": "הבנים 18, פתח תקווה",
        "dropoff_address": "שוק הכרמל, תל אביב",
        "distance_km": 13.0,
        "wait_minutes": 0, "traffic_minutes": 0,
        "multiplier": 1.0, "special": "—",
        "special_code": "normal",
        "total_fare": 55.50,
        "ride_minutes": 25, "days_ago": 9, "hour": 9,
        "cancellation_reason": None,
        "address_change": None,
        "passenger_score": 5, "driver_score": 5,
        "passenger_comment": "נסיעה חלקה ומהירה",
        "driver_comment": "נוסעת נחמדה מאוד",
    },
    # 6 — Tel Aviv → Herzliya, TRAFFIC +15min wait
    {
        "id": 6,
        "passenger_idx": 5, "driver_idx": 2,
        "pickup_lat": 32.0853, "pickup_lng": 34.7818,
        "dropoff_lat": 32.1663, "dropoff_lng": 34.8447,
        "pickup_address": "דרך מנחם בגין 121, תל אביב",
        "dropoff_address": "הבורסה לניירות ערך, הרצליה פיתוח",
        "distance_km": 18.0,
        "wait_minutes": 0, "traffic_minutes": 15,
        "multiplier": 1.0, "special": "🚦 פקק תנועה +15 דק׳",
        "special_code": "traffic",
        "total_fare": 85.00,
        "ride_minutes": 40, "days_ago": 2, "hour": 8,
        "cancellation_reason": None,
        "address_change": None,
        "passenger_score": 4, "driver_score": 4,
        "passenger_comment": "פקק אבל הנהג הגיע בבטחה",
        "driver_comment": "פקק נורא בבוקר",
    },
    # 7 — CANCELLED after acceptance, ₪5 fee
    {
        "id": 7,
        "passenger_idx": 6, "driver_idx": 1,
        "pickup_lat": 31.9657, "pickup_lng": 34.7991,
        "dropoff_lat": 32.0853, "dropoff_lng": 34.7818,
        "pickup_address": "שדרות הרצל 75, ראשון לציון",
        "dropoff_address": "תחנת רכבת ת״א מרכז",
        "distance_km": 0.0,
        "wait_minutes": 0, "traffic_minutes": 0,
        "multiplier": 1.0, "special": "❌ בוטל אחרי קבלה",
        "special_code": "cancelled",
        "total_fare": 5.00,
        "ride_minutes": 0, "days_ago": 4, "hour": 16,
        "cancellation_reason": "הנוסעת ביטלה לאחר 4 דקות",
        "address_change": None,
        "passenger_score": None, "driver_score": None,
        "passenger_comment": None, "driver_comment": None,
    },
    # 8 — Ramat Gan → Tel Aviv, MINIMUM FARE
    {
        "id": 8,
        "passenger_idx": 7, "driver_idx": 4,
        "pickup_lat": 32.0684, "pickup_lng": 34.8248,
        "dropoff_lat": 32.0853, "dropoff_lng": 34.7818,
        "pickup_address": "בן גוריון 5, רמת גן",
        "dropoff_address": "קניון עזריאלי, תל אביב",
        "distance_km": 3.0,
        "wait_minutes": 0, "traffic_minutes": 0,
        "multiplier": 1.0, "special": "💰 מינימום טריף",
        "special_code": "minimum",
        "total_fare": 20.50,
        "ride_minutes": 10, "days_ago": 1, "hour": 13,
        "cancellation_reason": None,
        "address_change": None,
        "passenger_score": 5, "driver_score": 4,
        "passenger_comment": "מהיר ונעים",
        "driver_comment": None,
    },
    # 9 — Petah Tikva → Airport, SHABBAT RATE ×1.25
    {
        "id": 9,
        "passenger_idx": 8, "driver_idx": 0,
        "pickup_lat": 32.0875, "pickup_lng": 34.8878,
        "dropoff_lat": 32.0055, "dropoff_lng": 34.8854,
        "pickup_address": "הגדוד העברי 3, פתח תקווה",
        "dropoff_address": "נמל תעופה בן גוריון, טרמינל 1",
        "distance_km": 22.0,
        "wait_minutes": 0, "traffic_minutes": 0,
        "multiplier": 1.25, "special": "✡️ תעריף שבת ×1.25",
        "special_code": "shabbat",
        "total_fare": 108.75,
        "ride_minutes": 30, "days_ago": 8, "hour": 20,
        "cancellation_reason": None,
        "address_change": None,
        "passenger_score": 5, "driver_score": 5,
        "passenger_comment": "תוך 5 דקות הגיע, שבת שלום!",
        "driver_comment": "נוסעת מקסימה, טיסה טובה",
    },
    # 10 — Tel Aviv → Jerusalem, INTERCITY
    {
        "id": 10,
        "passenger_idx": 9, "driver_idx": 8,
        "pickup_lat": 32.0853, "pickup_lng": 34.7818,
        "dropoff_lat": 31.7683, "dropoff_lng": 35.2137,
        "pickup_address": "דיזנגוף סנטר, תל אביב",
        "dropoff_address": "כיכר ספרא, ירושלים",
        "distance_km": 65.0,
        "wait_minutes": 0, "traffic_minutes": 0,
        "multiplier": 1.0, "special": "🛣️ נסיעה בין-עירונית",
        "special_code": "intercity",
        "total_fare": 237.50,
        "ride_minutes": 55, "days_ago": 15, "hour": 7,
        "cancellation_reason": None,
        "address_change": None,
        "passenger_score": 5, "driver_score": 5,
        "passenger_comment": "נסיעה ארוכה ונוחה, המלצה!",
        "driver_comment": "נוסעת נעימה לנסיעה ארוכה",
    },
]


def _now_minus(days: int, hour: int = 12) -> datetime:
    """Return timezone-aware datetime X days ago at given hour."""
    base = datetime.now(timezone.utc).replace(hour=hour, minute=0, second=0, microsecond=0)
    return base - timedelta(days=days)


def _calc_payment(total: float) -> dict:
    """Breakdown: platform 15%, tax 10% of platform, driver gets rest."""
    total_d = Decimal(str(total))
    platform_fee = (total_d * Decimal("0.15")).quantize(Decimal("0.01"))
    tax_amount = (platform_fee * Decimal("0.10")).quantize(Decimal("0.01"))
    driver_earnings = (total_d - platform_fee).quantize(Decimal("0.01"))
    return {
        "total_amount": total_d,
        "platform_fee": platform_fee,
        "tax_amount": tax_amount,
        "driver_earnings": driver_earnings,
    }


async def _user_exists(db: AsyncSession, phone: str) -> bool:
    result = await db.execute(select(User).where(User.phone == phone))
    return result.scalar_one_or_none() is not None


async def seed_demo(db: AsyncSession, force: bool = False) -> dict:
    """
    Seed demo data. Returns a structured report of everything created.
    If force=False and demo data already exists, returns {already_seeded: True}.
    """
    # ── Check for existing demo data ──────────────────────────────────────────
    if not force:
        existing = await db.execute(
            select(User).where(User.phone == _DRIVER_PHONES[0])
        )
        if existing.scalar_one_or_none() is not None:
            return {"already_seeded": True, "message": "דמו כבר הורץ. השתמש ב-force=true להרצה מחדש."}

    # ── If force, wipe existing demo users (cascades rides/payments etc) ──────
    if force:
        all_demo_phones = _DRIVER_PHONES + _PASSENGER_PHONES
        # Delete rides for demo users first (FK constraints)
        for phone in all_demo_phones:
            existing_user = (await db.execute(select(User).where(User.phone == phone))).scalar_one_or_none()
            if existing_user:
                # Delete ratings
                await db.execute(delete(Rating).where(
                    (Rating.rater_id == existing_user.id) | (Rating.ratee_id == existing_user.id)
                ))
                # Delete audit logs
                await db.execute(delete(AuditLog).where(AuditLog.actor_id == existing_user.id))
                # Delete wallet entries and wallets
                wallet = (await db.execute(select(DriverWallet).where(DriverWallet.driver_id == existing_user.id))).scalar_one_or_none()
                if wallet:
                    await db.execute(delete(WalletEntry).where(WalletEntry.wallet_id == wallet.id))
                    await db.execute(delete(DriverWallet).where(DriverWallet.id == wallet.id))
        # Delete ride payments and rides for demo passengers
        for phone in _PASSENGER_PHONES:
            pax = (await db.execute(select(User).where(User.phone == phone))).scalar_one_or_none()
            if pax:
                rides = (await db.execute(select(Ride).where(Ride.passenger_id == pax.id))).scalars().all()
                for r in rides:
                    await db.execute(delete(RidePayment).where(RidePayment.ride_id == r.id))
                    await db.execute(delete(AuditLog).where(
                        (AuditLog.resource_type == "ride") & (AuditLog.resource_id == str(r.id))
                    ))
                    await db.execute(delete(Ride).where(Ride.id == r.id))
                await db.execute(delete(User).where(User.id == pax.id))
        for phone in _DRIVER_PHONES:
            drv = (await db.execute(select(User).where(User.phone == phone))).scalar_one_or_none()
            if drv:
                await db.execute(delete(User).where(User.id == drv.id))
        await db.flush()

    # ── 1. Create Drivers ─────────────────────────────────────────────────────
    driver_users: list[User] = []
    driver_audit_counts: list[int] = []

    for i, d in enumerate(_DRIVERS):
        created_at = _now_minus(30 + i * 3, hour=9)
        user = User(
            id=uuid.uuid4(),
            phone=d["phone"],
            full_name=d["full_name"],
            role=UserRole.driver,
            driver_type=d["driver_type"],
            is_active=True,
            auth_status=AuthStatus.approved,
            vehicle_number=d["vehicle_number"],
            tos_accepted_at=created_at + timedelta(hours=1),
            created_at=created_at,
            updated_at=created_at,
        )
        db.add(user)
        driver_users.append(user)

        # Audit chain: WA verify → per-doc review → KYC eval → approval → login
        logs_created = 0
        t = created_at

        db.add(AuditLog(
            id=uuid.uuid4(), actor_id=user.id,
            action=AuditAction.otp_verified,
            resource_type="user", resource_id=str(user.id),
            ip_address="185.100.65.42",
            detail=f"אומת בוואטסאפ OTP | טלפון: {d['phone']} | שם: {d['full_name']}",
            created_at=t,
        ))
        logs_created += 1
        t += timedelta(minutes=30)

        for doc_name, doc_num, expiry, doc_type in d["docs"]:
            db.add(AuditLog(
                id=uuid.uuid4(), actor_id=None,
                action=AuditAction.admin_review_document,
                resource_type="user", resource_id=str(user.id),
                detail=(
                    f"מסמך אומת ✅ | נהג: {d['full_name']} | "
                    f"סוג: {doc_type} | מסמך: {doc_name} | "
                    f"מס׳: {doc_num} | תוקף עד: {expiry} | "
                    f"סטטוס: תקין ומאומת"
                ),
                created_at=t,
            ))
            logs_created += 1
            t += timedelta(minutes=15)

        db.add(AuditLog(
            id=uuid.uuid4(), actor_id=None,
            action=AuditAction.admin_evaluate_driver,
            resource_type="user", resource_id=str(user.id),
            detail=(
                f"KYC AI הערכה ✅ | נהג: {d['full_name']} | "
                f"רכב: {d['vehicle_number']} | עיר: {d['city']} | "
                f"סוג: {d['driver_type'].value} | "
                f"כל {len(d['docs'])} מסמכים נבדקו ואומתו בהצלחה | "
                f"רישיון נהיגה בתוקף | ביטוח בתוקף | הרכב עבר טסט"
            ),
            created_at=t,
        ))
        logs_created += 1
        t += timedelta(minutes=10)

        db.add(AuditLog(
            id=uuid.uuid4(), actor_id=None,
            action=AuditAction.admin_flag_update,
            resource_type="user", resource_id=str(user.id),
            detail=(
                f"סטטוס עודכן ✅ | נהג: {d['full_name']} | "
                f"pending → approved | אושר לפעילות מלאה בפלטפורמה"
            ),
            created_at=t,
        ))
        logs_created += 1
        t += timedelta(minutes=5)

        db.add(AuditLog(
            id=uuid.uuid4(), actor_id=user.id,
            action=AuditAction.login,
            resource_type="user", resource_id=str(user.id),
            ip_address="185.100.65.42",
            detail=f"כניסה ראשונה לאפליקציית הנהגים | {d['full_name']} | {d['city']}",
            created_at=t + timedelta(hours=2),
        ))
        logs_created += 1
        driver_audit_counts.append(logs_created)

    # ── 2. Create Passengers ──────────────────────────────────────────────────
    passenger_users: list[User] = []
    for i, p in enumerate(_PASSENGERS):
        created_at = _now_minus(20 + i * 2, hour=11)
        user = User(
            id=uuid.uuid4(),
            phone=p["phone"],
            full_name=p["full_name"],
            role=UserRole.passenger,
            is_active=True,
            auth_status=AuthStatus.whatsapp_verified,
            tos_accepted_at=created_at + timedelta(minutes=5),
            created_at=created_at,
            updated_at=created_at,
        )
        db.add(user)
        passenger_users.append(user)

        db.add(AuditLog(
            id=uuid.uuid4(), actor_id=user.id,
            action=AuditAction.otp_verified,
            resource_type="user", resource_id=str(user.id),
            ip_address="176.12.88.55",
            detail=f"נוסע אומת בוואטסאפ | {p['full_name']} | {p['phone']}",
            created_at=created_at,
        ))
        db.add(AuditLog(
            id=uuid.uuid4(), actor_id=user.id,
            action=AuditAction.login,
            resource_type="user", resource_id=str(user.id),
            ip_address="176.12.88.55",
            detail=f"כניסה ראשונה לאפליקציית נוסעים | {p['full_name']}",
            created_at=created_at + timedelta(minutes=10),
        ))

    await db.flush()

    # ── 3. Create Rides + Payments + Ratings ─────────────────────────────────
    ride_reports: list[dict] = []
    total_revenue = Decimal("0")
    rides_completed = 0

    for sc in _SCENARIOS:
        pax = passenger_users[sc["passenger_idx"]]
        drv = driver_users[sc["driver_idx"]]
        pax_info = _PASSENGERS[sc["passenger_idx"]]
        drv_info = _DRIVERS[sc["driver_idx"]]

        base_time = _now_minus(sc["days_ago"], hour=sc["hour"])
        is_cancelled = sc["special_code"] == "cancelled"

        ride_id = uuid.uuid4()
        ride_status = RideStatus.cancelled if is_cancelled else RideStatus.completed

        # Timestamps
        created_at   = base_time
        assigned_at  = base_time + timedelta(minutes=2)
        accepted_at  = base_time + timedelta(minutes=3)
        started_at   = base_time + timedelta(minutes=4 + sc["wait_minutes"])
        completed_at = None if is_cancelled else (
            base_time + timedelta(minutes=4 + sc["wait_minutes"] + sc["ride_minutes"] + sc["traffic_minutes"])
        )
        cancelled_at = (base_time + timedelta(minutes=7)) if is_cancelled else None

        ride = Ride(
            id=ride_id,
            passenger_id=pax.id,
            driver_id=drv.id,
            status=ride_status,
            cancellation_reason=sc["cancellation_reason"],
            pickup_lat=sc["pickup_lat"],
            pickup_lng=sc["pickup_lng"],
            dropoff_lat=sc["dropoff_lat"],
            dropoff_lng=sc["dropoff_lng"],
            pickup_address=sc["pickup_address"],
            dropoff_address=sc["dropoff_address"],
            fare_ils=sc["total_fare"],
            created_at=created_at,
            assigned_at=assigned_at,
            accepted_at=accepted_at,
            started_at=None if is_cancelled else started_at,
            completed_at=completed_at,
            cancelled_at=cancelled_at,
        )
        db.add(ride)
        await db.flush()  # ensure ride_id exists before payment FK

        # Payment
        pay_breakdown = _calc_payment(sc["total_fare"])
        payment = RidePayment(
            id=uuid.uuid4(),
            ride_id=ride_id,
            passenger_id=pax.id,
            driver_id=drv.id,
            distance_km=Decimal(str(sc["distance_km"])),
            total_amount=pay_breakdown["total_amount"],
            platform_fee=pay_breakdown["platform_fee"],
            tax_amount=pay_breakdown["tax_amount"],
            driver_earnings=pay_breakdown["driver_earnings"],
            status=PaymentStatus.completed,
            created_at=completed_at or cancelled_at,
            completed_at=completed_at or cancelled_at,
        )
        db.add(payment)

        if not is_cancelled:
            total_revenue += pay_breakdown["total_amount"]
            rides_completed += 1

        # Driver wallet
        wallet = (await db.execute(
            select(DriverWallet).where(DriverWallet.driver_id == drv.id)
        )).scalar_one_or_none()

        if wallet is None:
            wallet = DriverWallet(
                id=uuid.uuid4(),
                driver_id=drv.id,
                balance=Decimal("0"),
                updated_at=completed_at or cancelled_at,
            )
            db.add(wallet)
            await db.flush()

        new_balance = wallet.balance + pay_breakdown["driver_earnings"]
        wallet.balance = new_balance
        wallet.updated_at = completed_at or cancelled_at

        entry = WalletEntry(
            id=uuid.uuid4(),
            wallet_id=wallet.id,
            entry_type=WalletEntryType.credit,
            amount=pay_breakdown["driver_earnings"],
            balance_after=new_balance,
            reference_id=payment.id,
            description=(
                f"{'דמי ביטול' if is_cancelled else 'הכנסה מנסיעה'} — "
                f"{pax_info['full_name']} | "
                f"{sc['pickup_address']} → {sc['dropoff_address']} | "
                f"₪{sc['total_fare']:.2f}"
            ),
            created_at=completed_at or cancelled_at,
        )
        db.add(entry)

        # Ratings (only for completed rides)
        if not is_cancelled and sc["passenger_score"] is not None:
            db.add(Rating(
                id=uuid.uuid4(),
                ride_id=ride_id,
                rater_id=pax.id,
                ratee_id=drv.id,
                direction=RatingDirection.passenger_to_driver,
                score=sc["passenger_score"],
                comment=sc["passenger_comment"],
                created_at=completed_at + timedelta(minutes=2),
            ))
            db.add(Rating(
                id=uuid.uuid4(),
                ride_id=ride_id,
                rater_id=drv.id,
                ratee_id=pax.id,
                direction=RatingDirection.driver_to_passenger,
                score=sc["driver_score"],
                comment=sc["driver_comment"],
                created_at=completed_at + timedelta(minutes=3),
            ))

        # Audit trail for ride
        ride_audit_base = {
            "resource_type": "ride",
            "resource_id": str(ride_id),
        }

        db.add(AuditLog(
            id=uuid.uuid4(), actor_id=pax.id,
            action=AuditAction.ride_requested,
            detail=(
                f"נסיעה הוזמנה | נוסע: {pax_info['full_name']} | "
                f"מ: {sc['pickup_address']} | "
                f"ל: {sc['dropoff_address']}{' (יעד מקורי: כיכר העצמאות, חולון)' if sc['address_change'] else ''} | "
                f"מרחק משוער: {sc['distance_km']:.1f} ק״מ | {sc['special']}"
            ),
            created_at=created_at, **ride_audit_base,
        ))

        # Extra audit log for address change scenario
        if sc["address_change"]:
            ac = sc["address_change"]
            db.add(AuditLog(
                id=uuid.uuid4(), actor_id=pax.id,
                action=AuditAction.ride_requested,
                detail=(
                    f"🔄 שינוי כתובת יעד באמצע ההזמנה | "
                    f"נוסע: {pax_info['full_name']} | "
                    f"יעד מקורי: {ac['original_dropoff']} ({ac['original_km']}km) → "
                    f"יעד חדש: {ac['new_dropoff']} ({ac['new_km']}km) | "
                    f"מרחק עודכן: {ac['original_km']}→{ac['new_km']} ק״מ | תעריף עודכן בהתאם"
                ),
                created_at=created_at + timedelta(minutes=8), **ride_audit_base,
            ))

        db.add(AuditLog(
            id=uuid.uuid4(), actor_id=drv.id,
            action=AuditAction.ride_accepted,
            detail=(
                f"נסיעה שויכה ואושרה | נהג: {drv_info['full_name']} | {drv_info['city']} | "
                f"רכב: {drv_info['vehicle_number']} | "
                f"מרחק לאיסוף: ~1.2 ק״מ | ETA: 3 דקות"
            ),
            created_at=accepted_at, **ride_audit_base,
        ))

        if is_cancelled:
            db.add(AuditLog(
                id=uuid.uuid4(), actor_id=pax.id,
                action=AuditAction.ride_cancelled,
                detail=(
                    f"נסיעה בוטלה על-ידי נוסע | {pax_info['full_name']} | "
                    f"4 דקות לאחר קבלה | דמי ביטול: ₪5.00 | "
                    f"סיבה: {sc['cancellation_reason']}"
                ),
                created_at=cancelled_at, **ride_audit_base,
            ))
            db.add(AuditLog(
                id=uuid.uuid4(), actor_id=None,
                action=AuditAction.payment_processed,
                detail=(
                    f"דמי ביטול עובדו | נוסע: {pax_info['full_name']} | "
                    f"נהג: {drv_info['full_name']} | סכום: ₪5.00"
                ),
                created_at=cancelled_at + timedelta(seconds=30), **ride_audit_base,
            ))
        else:
            wait_note = f" | המתנה: {sc['wait_minutes']} דקות" if sc["wait_minutes"] > 0 else ""
            traffic_note = f" | פקק: {sc['traffic_minutes']} דקות נוספות" if sc["traffic_minutes"] > 0 else ""
            db.add(AuditLog(
                id=uuid.uuid4(), actor_id=drv.id,
                action=AuditAction.ride_started,
                detail=(
                    f"נסיעה החלה | נהג: {drv_info['full_name']} | "
                    f"נוסע: {pax_info['full_name']}{wait_note} | "
                    f"תעריף: {sc['multiplier']}× | {sc['special']}"
                ),
                created_at=started_at, **ride_audit_base,
            ))

            fare_detail = pay_breakdown
            db.add(AuditLog(
                id=uuid.uuid4(), actor_id=drv.id,
                action=AuditAction.ride_ended,
                detail=(
                    f"נסיעה הושלמה ✅ | נהג: {drv_info['full_name']} | "
                    f"נוסע: {pax_info['full_name']} | "
                    f"מסלול: {sc['pickup_address']} → {sc['dropoff_address']} | "
                    f"מרחק: {sc['distance_km']} ק״מ{traffic_note} | "
                    f"זמן נסיעה: {sc['ride_minutes'] + sc['traffic_minutes']} דקות | "
                    f"תעריף כולל: ₪{sc['total_fare']:.2f} | {sc['special']}"
                ),
                created_at=completed_at, **ride_audit_base,
            ))

            db.add(AuditLog(
                id=uuid.uuid4(), actor_id=None,
                action=AuditAction.payment_processed,
                detail=(
                    f"תשלום עובד ✅ | נוסע: {pax_info['full_name']} | "
                    f"נהג: {drv_info['full_name']} | "
                    f"סה״כ: ₪{sc['total_fare']:.2f} | "
                    f"דמי פלטפורמה: ₪{fare_detail['platform_fee']} | "
                    f"הכנסת נהג: ₪{fare_detail['driver_earnings']} | "
                    f"תשלום ישיר לנהג"
                ),
                created_at=completed_at + timedelta(seconds=10), **ride_audit_base,
            ))

        # Build ride report
        ride_report = {
            "scenario_id": sc["id"],
            "status": "cancelled" if is_cancelled else "completed",
            "special": sc["special"],
            "special_code": sc["special_code"],
            "passenger": pax_info["full_name"],
            "driver": drv_info["full_name"],
            "driver_city": drv_info["city"],
            "driver_vehicle": drv_info["vehicle_number"],
            "pickup": sc["pickup_address"],
            "dropoff": sc["dropoff_address"],
            "distance_km": sc["distance_km"],
            "ride_minutes": sc["ride_minutes"],
            "wait_minutes": sc["wait_minutes"],
            "traffic_minutes": sc["traffic_minutes"],
            "multiplier": sc["multiplier"],
            "total_fare": sc["total_fare"],
            "platform_fee": float(pay_breakdown["platform_fee"]),
            "driver_earnings": float(pay_breakdown["driver_earnings"]),
            "passenger_rating": sc["passenger_score"],
            "driver_rating": sc["driver_score"],
            "passenger_comment": sc["passenger_comment"],
            "driver_comment": sc["driver_comment"],
            "address_change": sc["address_change"],
            "timeline": {
                "requested": created_at.isoformat(),
                "assigned": assigned_at.isoformat(),
                "accepted": accepted_at.isoformat(),
                "started": None if is_cancelled else started_at.isoformat(),
                "completed": completed_at.isoformat() if completed_at else None,
                "cancelled": cancelled_at.isoformat() if cancelled_at else None,
            },
        }
        ride_reports.append(ride_report)

    await db.commit()

    # Build driver reports
    driver_reports = []
    for i, (drv_user, drv_info) in enumerate(zip(driver_users, _DRIVERS)):
        driver_reports.append({
            "number": i + 1,
            "name": drv_info["full_name"],
            "phone": drv_info["phone"],
            "city": drv_info["city"],
            "vehicle_number": drv_info["vehicle_number"],
            "driver_type": drv_info["driver_type"].value,
            "docs": [
                {"name": doc[0], "doc_number": doc[1], "expiry": doc[2], "type": doc[3]}
                for doc in drv_info["docs"]
            ],
            "doc_count": len(drv_info["docs"]),
            "audit_logs_created": driver_audit_counts[i],
        })

    passenger_reports = [
        {"number": i + 11, "name": p["full_name"], "phone": p["phone"]}
        for i, p in enumerate(_PASSENGERS)
    ]

    summary = {
        "drivers_created": len(driver_users),
        "passengers_created": len(passenger_users),
        "rides_created": len(ride_reports),
        "rides_completed": rides_completed,
        "rides_cancelled": len(ride_reports) - rides_completed,
        "total_revenue_ils": float(total_revenue),
        "total_platform_fee_ils": float(total_revenue * Decimal("0.15")),
        "audit_logs_created": sum(driver_audit_counts) + len(_PASSENGERS) * 2 + sum(
            5 + (2 if sc["address_change"] else 0) + (1 if sc["special_code"] == "cancelled" else 2)
            for sc in _SCENARIOS
        ),
    }

    return {
        "seeded": True,
        "summary": summary,
        "drivers": driver_reports,
        "passengers": passenger_reports,
        "rides": ride_reports,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
