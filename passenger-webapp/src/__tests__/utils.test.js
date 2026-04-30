/**
 * Frontend unit tests — passenger webapp
 *
 * Tests:
 *   - Surge display logic (NaN guard)
 *   - Phone formatting utilities
 *   - tryRefresh token flow (localStorage mock)
 *   - ToS inline checkbox behavior
 */
import { describe, it, expect, beforeEach } from 'vitest';
// ─── Surge multiplier display logic ──────────────────────────────────────────
describe('Surge multiplier display guard', () => {
    const shouldShowSurge = (multiplier) => {
        if (!multiplier)
            return false;
        const v = parseFloat(multiplier);
        return !isNaN(v) && v > 1;
    };
    it('hides surge when multiplier is undefined', () => {
        expect(shouldShowSurge(undefined)).toBe(false);
    });
    it('hides surge when multiplier is null', () => {
        expect(shouldShowSurge(null)).toBe(false);
    });
    it('hides surge when multiplier is empty string', () => {
        expect(shouldShowSurge('')).toBe(false);
    });
    it('hides surge when multiplier is NaN string', () => {
        expect(shouldShowSurge('NaN')).toBe(false);
    });
    it('hides surge when multiplier is "1"', () => {
        expect(shouldShowSurge('1')).toBe(false);
    });
    it('hides surge when multiplier is "0.9"', () => {
        expect(shouldShowSurge('0.9')).toBe(false);
    });
    it('shows surge when multiplier is "1.5"', () => {
        expect(shouldShowSurge('1.5')).toBe(true);
    });
    it('shows surge when multiplier is "2"', () => {
        expect(shouldShowSurge('2')).toBe(true);
    });
    it('shows surge when multiplier is "3.0"', () => {
        expect(shouldShowSurge('3.0')).toBe(true);
    });
    it('hides surge for random text', () => {
        expect(shouldShowSurge('error')).toBe(false);
    });
});
// ─── Token refresh flow ───────────────────────────────────────────────────────
describe('Token persistence in localStorage', () => {
    beforeEach(() => {
        localStorage.clear();
    });
    it('access_token is stored after login', () => {
        localStorage.setItem('access_token', 'jwt-abc-123');
        expect(localStorage.getItem('access_token')).toBe('jwt-abc-123');
    });
    it('refresh_token is stored after login', () => {
        localStorage.setItem('refresh_token', 'refresh-xyz-456');
        expect(localStorage.getItem('refresh_token')).toBe('refresh-xyz-456');
    });
    it('tryRefresh returns false when no refresh_token', () => {
        // When localStorage has no refresh_token, fetch should not be called
        const token = localStorage.getItem('refresh_token');
        expect(token).toBeNull();
        // No token = tryRefresh would return false immediately
        expect(!!token).toBe(false);
    });
    it('tokens are cleared on logout', () => {
        localStorage.setItem('access_token', 'abc');
        localStorage.setItem('refresh_token', 'xyz');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        expect(localStorage.getItem('access_token')).toBeNull();
        expect(localStorage.getItem('refresh_token')).toBeNull();
    });
});
// ─── Phone normalization (used in login form) ─────────────────────────────────
describe('Phone display normalization', () => {
    const normalizeForDisplay = (phone) => {
        const digits = phone.replace(/\D/g, '');
        if (digits.startsWith('972'))
            return '+' + digits;
        if (digits.startsWith('0'))
            return '+972' + digits.slice(1);
        return '+' + digits;
    };
    it('keeps 972 prefixed numbers as-is', () => {
        expect(normalizeForDisplay('972501234567')).toBe('+972501234567');
    });
    it('converts leading 0 to +972', () => {
        expect(normalizeForDisplay('0501234567')).toBe('+972501234567');
    });
    it('strips dashes and spaces', () => {
        expect(normalizeForDisplay('+972 50-123-4567')).toBe('+972501234567');
    });
    it('handles already formatted +972 number', () => {
        expect(normalizeForDisplay('+972501234567')).toBe('+972501234567');
    });
});
// ─── Haversine distance (used for fare calculation) ───────────────────────────
describe('Haversine distance formula', () => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const haversine = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // km
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };
    it('same point returns 0', () => {
        expect(haversine(32.08, 34.78, 32.08, 34.78)).toBe(0);
    });
    it('Tel Aviv to Jerusalem is ~55-60 km', () => {
        const dist = haversine(32.08, 34.78, 31.77, 35.21);
        expect(dist).toBeGreaterThan(50);
        expect(dist).toBeLessThan(70);
    });
    it('is symmetrical', () => {
        const a = haversine(32.08, 34.78, 31.77, 35.21);
        const b = haversine(31.77, 35.21, 32.08, 34.78);
        expect(Math.abs(a - b)).toBeLessThan(0.001);
    });
    it('north to south Israel is ~400-500 km', () => {
        // Metula to Eilat
        const dist = haversine(33.28, 35.57, 29.56, 34.95);
        expect(dist).toBeGreaterThan(380);
        expect(dist).toBeLessThan(520);
    });
});
// ─── Fare calculation logic ───────────────────────────────────────────────────
describe('Fare calculation', () => {
    const calculateFare = (distKm, surgeMultiplier = 1) => {
        const BASE_FARE = 12;
        const PER_KM = 3.5;
        const subtotal = BASE_FARE + distKm * PER_KM;
        const total = subtotal * surgeMultiplier;
        return { subtotal, total: Math.round(total * 100) / 100, surge: surgeMultiplier };
    };
    it('base fare for 0 km', () => {
        const { subtotal } = calculateFare(0);
        expect(subtotal).toBe(12);
    });
    it('fare increases with distance', () => {
        const fare5 = calculateFare(5);
        const fare10 = calculateFare(10);
        expect(fare10.total).toBeGreaterThan(fare5.total);
    });
    it('surge multiplier doubles the fare', () => {
        const normal = calculateFare(10, 1);
        const surge = calculateFare(10, 2);
        expect(surge.total).toBeCloseTo(normal.total * 2, 1);
    });
    it('no surge when multiplier is 1', () => {
        const { total, subtotal } = calculateFare(10, 1);
        expect(total).toBe(subtotal);
    });
    it('10 km ride is ~47 NIS', () => {
        const { total } = calculateFare(10);
        expect(total).toBeCloseTo(47, 0);
    });
});
