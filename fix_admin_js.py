with open('passenger-webapp/dist/admin.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re

old_chunk = """function enterApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('header-user').style.display = 'flex';
  document.getElementById('header-phone').textContent = phone || '';
  loadStats();

  // Auto-refresh QR every 30s while not connected
  setInterval(async () => {
    const s = document.getElementById('status-dot');
    if(s && !s.className.includes('open') && document.getElementById('page-whatsapp').classList.contains('active')) {
      await checkState();
    }
  }, 30000);
}
  
  // WhatsApp Init
  fetch('/api/whatsapp/config', { headers: { Authorization: 'Bearer ' + token } })
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(cfg => {
      EVOLUTION_KEY = cfg.api_key;
      EVOLUTION_URL = cfg.evolution_url;
      INSTANCE = cfg.instance;
      if(document.getElementById('inst-name')) document.getElementById('inst-name').textContent = INSTANCE;
    }).catch(()=>{});
}"""

new_chunk = """function enterApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('header-user').style.display = 'flex';
  document.getElementById('header-phone').textContent = phone || '';
  loadStats();
  try { loadRecentRides(); } catch(e){}

  // WhatsApp Init
  fetch('/api/whatsapp/config', { headers: { Authorization: 'Bearer ' + token } })
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(cfg => {
      EVOLUTION_KEY = cfg.api_key;
      EVOLUTION_URL = cfg.evolution_url;
      INSTANCE = cfg.instance;
      if(document.getElementById('inst-name')) document.getElementById('inst-name').textContent = INSTANCE;
      checkState(); // Check immediately after grabbing key
    }).catch(()=>{});

  // Auto-refresh QR every 30s while not connected
  setInterval(async () => {
    const s = document.getElementById('status-dot');
    if(s && !s.className.includes('open') && document.getElementById('page-whatsapp').classList.contains('active')) {
      await checkState();
    }
  }, 30000);
}"""

text = text.replace(old_chunk, new_chunk)

with open('passenger-webapp/dist/admin.html', 'w', encoding='utf-8') as f:
    f.write(text)
