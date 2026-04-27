import re

with open('passenger-webapp/dist/admin.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Strip out ALL text between `async function logout()` and `// ── NAVIGATION ──` EXCEPT what we strictly need

# Find the point where `async function logout()` starts
start_idx = text.find('async function logout()')
end_idx = text.find('// ── NAVIGATION ──')

if start_idx != -1 and end_idx != -1:
    pre = text[:start_idx]
    post = text[end_idx:]
    
    clean_middle = """async function logout() {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_phone');
  location.reload();
}

function enterApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('header-user').style.display = 'flex';
  document.getElementById('header-phone').textContent = phone || '';
  
  try { loadStats(); } catch(e){}
  try { loadRecentRides(); } catch(e){}

  // WhatsApp Init
  fetch('/api/whatsapp/config', { headers: { Authorization: 'Bearer ' + token } })
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(cfg => {
      EVOLUTION_KEY = cfg.api_key;
      EVOLUTION_URL = cfg.evolution_url;
      INSTANCE = cfg.instance;
      if(document.getElementById('inst-name')) document.getElementById('inst-name').textContent = INSTANCE;
      checkState();
    }).catch(()=>{});

  setInterval(async () => {
    const s = document.getElementById('status-dot');
    if(s && !s.className.includes('open') && document.getElementById('page-whatsapp').classList.contains('active')) {
      await checkState();
    }
  }, 30000);
}

// ── WHATSAPP GLOBALS ──
let EVOLUTION_KEY = '';
let EVOLUTION_URL = '/evolution';
let INSTANCE = 'easytaxi';

// ── EVOLUTION API calls (via nginx proxy /evolution/) ─────────────────────
async function evoGet(path) {
  const r = await fetch(`${EVOLUTION_URL}${path}`, { headers: { apikey: EVOLUTION_KEY } });
  if(!r.ok) throw new Error(r.status);
  return r.json();
}
async function evoPost(path, body={}) {
  const r = await fetch(`${EVOLUTION_URL}${path}`, {
    method: 'POST', body: JSON.stringify(body),
    headers: { apikey: EVOLUTION_KEY, 'Content-Type': 'application/json' }
  });
  return r.json();
}

async function checkState() {
  const dot = document.getElementById('status-dot');
  const lbl = document.getElementById('status-label');
  if(!dot || !lbl) return;
  dot.className = 'dot connecting';
  lbl.textContent = 'בודק...';
  try {
    const data = await evoGet(`/instance/connectionState/${INSTANCE}`);
    const state = data?.instance?.state || 'unknown';
    setStatus(state);
    if(state === 'open') {
      document.getElementById('qr-section').style.display = 'none';
      document.getElementById('connected-section').style.display = 'block';
    } else {
      document.getElementById('connected-section').style.display = 'none';
      document.getElementById('qr-section').style.display = 'block';
      await loadQR();
    }
  } catch(_) {
    try { await createInstance(); } catch(__) {}
    setStatus('close');
    document.getElementById('qr-section').style.display = 'block';
    document.getElementById('connected-section').style.display = 'none';
    await loadQR();
  }
}

function setStatus(state) {
  const dot = document.getElementById('status-dot');
  const lbl = document.getElementById('status-label');
  const sub = document.getElementById('status-sub');
  if(!dot || !lbl || !sub) return;
  dot.className = 'dot ' + state;
  if(state === 'open') { lbl.textContent = '✅ מחובר'; sub.textContent = 'WhatsApp מחובר ופעיל'; }
  else if(state === 'connecting') { lbl.textContent = '⏳ מתחבר...'; sub.textContent = 'ממתין לסריקת QR'; }
  else { lbl.textContent = '❌ לא מחובר'; sub.textContent = 'יש לסרוק QR לחיבור'; }
}

async function createInstance() {
  return evoPost('/instance/create', { instanceName: INSTANCE, qrcode: true, integration: 'WHATSAPP-BAILEYS' });
}

async function loadQR() {
  const c = document.getElementById('qr-container');
  if(!c) return;
  c.innerHTML = '<div class="spinner"></div><div style="margin-top:10px;color:var(--text-muted);font-size:.84rem">טוען QR...</div>';
  try {
    const data = await evoGet(`/instance/connect/${INSTANCE}`);
    if(data?.base64) {
      c.innerHTML = `<img id="qr-img" src="${data.base64}" alt="QR Code" width="220"><div style="margin-top:10px;color:var(--text-muted);font-size:.76rem">סרוק עם WhatsApp ← מכשירים מקושרים</div>`;
    } else {
      c.innerHTML = '<div style="color:var(--text-muted)">לא ניתן לטעון QR (המתן)</div>';
    }
  } catch(_) {
    c.innerHTML = '<div style="color:var(--text-muted)">שגיאה בטעינת QR</div>';
  }
}

async function refreshQR() { await loadQR(); }

async function disconnectWA() {
  if(!confirm('לנתק את WhatsApp מהפלטפורמה?')) return;
  try {
    await evoPost(`/instance/logout/${INSTANCE}`);
    await checkState();
  } catch(e) { alert('שגיאה: ' + e.message); }
}

async function sendTest() {
  const ph = prompt('מספר טלפון לבדיקה (+972...)');
  if(!ph) return;
  const msgDiv = document.getElementById('test-msg');
  if(msgDiv) msgDiv.innerHTML = '<div class="msg success">שולח...</div>';
  try {
    await evoPost(`/message/sendText/${INSTANCE}`, {
      number: ph.replace(/\D/g,'').replace(/^0/,'972'),
      text: '🚕 *EasyTaxi Israel* — בדיקת חיבור WhatsApp!\n\nהמערכת מחוברת ופועלת ✅'
    });
    if(msgDiv) msgDiv.innerHTML = '<div class="msg success">✅ הודעה נשלחה!</div>';
  } catch(e) { 
    if(msgDiv) msgDiv.innerHTML = '<div class="msg error">שגיאה: ' + e.message + '</div>';
  }
}

"""

    with open('passenger-webapp/dist/admin.html', 'w', encoding='utf-8') as f:
        f.write(pre + clean_middle + post)
    print("Fixed!")
else:
    print("Could not find markers")
