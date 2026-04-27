import urllib.request
import json

BASE = "http://localhost:8000"

# Test 1: surge cap — 3.0x exceeds 2.5x maximum
req = urllib.request.Request(
    f"{BASE}/agents/compliance/check-surge?multiplier=3.0",
    headers={"Authorization": "Bearer test"},
)
try:
    r = urllib.request.urlopen(req)
    print("SURGE 3.0x:", r.status, r.read().decode()[:250])
except urllib.error.HTTPError as e:
    print("SURGE 3.0x:", e.code, e.read().decode()[:250])

# Test 2: valid surge — 1.5x under cap
req2 = urllib.request.Request(
    f"{BASE}/agents/compliance/check-surge?multiplier=1.5",
    headers={"Authorization": "Bearer test"},
)
try:
    r2 = urllib.request.urlopen(req2)
    print("SURGE 1.5x:", r2.status, r2.read().decode()[:250])
except urllib.error.HTTPError as e:
    print("SURGE 1.5x:", e.code, e.read().decode()[:250])

# Test 3: support message in Hebrew
data = json.dumps({"message": "הנהג לא הגיע", "language": "he"}).encode()
req3 = urllib.request.Request(
    f"{BASE}/agents/support/message",
    data=data,
    headers={"Content-Type": "application/json", "Authorization": "Bearer test"},
)
try:
    r3 = urllib.request.urlopen(req3)
    print("SUPPORT:", r3.status, r3.read().decode()[:400])
except urllib.error.HTTPError as e:
    print("SUPPORT:", e.code, e.read().decode()[:400])
