/**
 * k6 load test — RideOS Platform pre-launch gate
 *
 * Targets: 50 VUs × 30 s  (run with: k6 run --vus 50 --duration 30s load_test.js)
 *
 * Pass criteria (checked via thresholds):
 *   - p95 latency < 500 ms
 *   - error rate < 1 %
 *   - /health must always return 200
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = __ENV.BASE_URL || "http://localhost:8000";

export const options = {
  vus: 50,
  duration: "30s",
  thresholds: {
    // p95 response time under 500 ms
    http_req_duration: ["p(95)<500"],
    // Error rate below 1 %
    http_req_failed: ["rate<0.01"],
    // Health endpoint never fails
    "checks{endpoint:health}": ["rate==1"],
  },
};

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------

const authErrors = new Rate("auth_errors");
const healthLatency = new Trend("health_latency_ms");

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function headers(token) {
  const h = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

// ---------------------------------------------------------------------------
// Main scenario
// ---------------------------------------------------------------------------

export default function () {
  // 1. Health check — MUST always return 200
  const healthRes = http.get(`${BASE_URL}/health`);
  healthLatency.add(healthRes.timings.duration);
  check(healthRes, { "health 200": (r) => r.status === 200 }, { endpoint: "health" });

  // 2. OTP request — expect 200 (phone number flow)
  const otpRes = http.post(
    `${BASE_URL}/auth/otp/request`,
    JSON.stringify({ phone: `+97250${Math.floor(1000000 + Math.random() * 9000000)}` }),
    { headers: headers() }
  );
  check(otpRes, {
    "otp request 200": (r) => r.status === 200,
  });
  authErrors.add(otpRes.status >= 500);

  // 3. Fare estimate (unauthenticated — expect 401, which is correct behaviour)
  const fareRes = http.get(`${BASE_URL}/payments/estimate`, { headers: headers() });
  check(fareRes, {
    "fare estimate auth required": (r) => r.status === 401 || r.status === 422,
  });

  // 4. Ride list (unauthenticated — expect 401)
  const ridesRes = http.get(`${BASE_URL}/rides`, { headers: headers() });
  check(ridesRes, { "rides auth guard": (r) => r.status === 401 });

  sleep(0.2);
}

// ---------------------------------------------------------------------------
// Summary override — print pass/fail per threshold
// ---------------------------------------------------------------------------

export function handleSummary(data) {
  const passed = Object.entries(data.metrics)
    .filter(([, v]) => v.thresholds)
    .every(([, v]) => Object.values(v.thresholds).every((t) => !t.ok === false));

  console.log(passed ? "\n✅ LOAD TEST PASSED" : "\n❌ LOAD TEST FAILED — review thresholds above");
  return { stdout: JSON.stringify(data, null, 2) };
}
