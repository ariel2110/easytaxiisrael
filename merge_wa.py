import re

with open('passenger-webapp/dist/whatsapp-setup.html', 'r', encoding='utf-8') as f:
    wa_html = f.read()

with open('passenger-webapp/dist/admin.html', 'r', encoding='utf-8') as f:
    admin_html = f.read()

# 1. Add Sidebar Button
wa_btn = """<button class="nav-item" data-page="whatsapp" onclick="goPage('whatsapp',this)"><span class="icon">💬</span>WhatsApp</button>\n    </aside>"""
admin_html = admin_html.replace('</aside>', wa_btn)

# 2. Extract WhatsApp App Container
m = re.search(r'<div id="app">(.+?)</div>\s*<script>', wa_html, re.DOTALL)
if m:
    wa_app_inner = m.group(1)
    
    # We only want the status-bar, qr-section, connected-section, etc.
    # Clean it up to wrap in our page div
    page_wa = f"""
      <!-- WHATSAPP -->
      <div class="page" id="page-whatsapp">
        <div class="page-title">💬 חיבור WhatsApp</div>
        {wa_app_inner}
      </div>
"""
    # Insert before the closing of content div
    admin_html = admin_html.replace('    </div>\n  </div>\n</div>\n\n<script>', page_wa + '    </div>\n  </div>\n</div>\n\n<script>')

# 3. Extract CSS from whatsapp
m_css = re.search(r'<style>(.+?)</style>', wa_html, re.DOTALL)
if m_css:
    wa_styles = m_css.group(1)
    # Extract only specific classes needed like dot, status-bar, qr-img, steps, spinner
    lines = wa_styles.split('\n')
    wa_specific_css = []
    for line in lines:
        if any(cls in line for cls in ['.status-bar', '.dot', '@keyframes pulse', '.status-label', '.status-sub', '.section', '.section-title', '#qr-container', '#qr-img', '#qr-code-text', '.steps', '.step', '.step-num', '.step-text', '.info-grid', '.info-item', '.spinner', '@keyframes spin', '.actions']):
            wa_specific_css.append(line)
            
    admin_html = admin_html.replace('</style>', '\n    /* WhatsApp Styles */\n    ' + '\n    '.join(wa_specific_css) + '\n  </style>')

# 4. Extract JS logic
wa_js_lines = []
capture = False
for line in wa_html.split('\n'):
    if '// ── EVOLUTION API calls' in line:
        capture = True
    if line.strip() == '// INIT':
        capture = False
    if capture:
        wa_js_lines.append(line)

# Add globals
wa_globals = """
// ── WHATSAPP GLOBALS ──
let EVOLUTION_KEY = '';
let EVOLUTION_URL = '/evolution';
let INSTANCE = 'easytaxi';
"""

admin_html = admin_html.replace('// ── NAVIGATION ──', wa_globals + '\n' + '\n'.join(wa_js_lines) + '\n\n// ── NAVIGATION ──')

# Also, hook the config loader into enterApp()
enter_app_mod = """function enterApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('header-user').style.display = 'flex';
  document.getElementById('header-phone').textContent = phone || '';
  loadStats();
  loadRecentRides();
  
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

admin_html = re.sub(r'function enterApp\(\) \{.*?\n\}', enter_app_mod, admin_html, flags=re.DOTALL)

# Add the setInterval to the goPage if whatsapp is open
go_page_mod = """function goPage(name, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  btn.classList.add('active');
  const loaders = { rides: loadAllRides, drivers: loadDrivers, users: loadUsers, audit: loadAudit, whatsapp: checkState };
  if (loaders[name]) loaders[name]();
}"""

admin_html = re.sub(r'function goPage\(name, btn\) \{.*?\n\}', go_page_mod, admin_html, flags=re.DOTALL)

with open('passenger-webapp/dist/admin.html', 'w', encoding='utf-8') as f:
    f.write(admin_html)

print("done")
