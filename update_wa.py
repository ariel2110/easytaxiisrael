import re

with open('passenger-webapp/dist/whatsapp-setup.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the HTML block
auth_screen_old = """<div id="auth-screen">
  <div class="card" id="step-phone">
    <div style="font-size:2.5rem;margin-bottom:14px">💬</div>
    <h2>חיבור WhatsApp</h2>
    <p>כניסת אדמין נדרשת</p>
    <div class="form-group"><label>טלפון</label><input type="tel" id="phone-input" placeholder="+972501234567" dir="ltr"></div>
    <button class="btn btn-wa" style="width:100%;padding:12px;font-size:.95rem" onclick="reqOTP()">שלח קוד</button>
    <div id="ph-msg"></div>
  </div>
  <div class="card" id="step-otp" style="display:none">
    <div style="font-size:2.5rem;margin-bottom:14px">🔑</div>
    <h2>קוד SMS</h2>
    <p>נשלח ל-<span id="show-phone" style="color:var(--wa)"></span></p>
    <div class="form-group"><label>קוד (6 ספרות)</label><input type="text" id="otp-input" placeholder="123456" dir="ltr" maxlength="6" inputmode="numeric"></div>
    <button class="btn btn-yellow" style="width:100%;padding:12px;font-size:.95rem;margin-bottom:8px" onclick="verOTP()">המשך</button>
    <button class="btn btn-outline" style="width:100%;padding:10px" onclick="backPhone()">חזרה</button>
    <div id="otp-msg"></div>
  </div>
  <div class="card" id="step-code" style="display:none">
    <div style="font-size:2.5rem;margin-bottom:14px">🛡️</div>
    <h2>קוד אדמין</h2>
    <p>הזן את קוד הגישה הסודי</p>
    <div class="form-group"><label>קוד גישה</label><input type="password" id="code-input" placeholder="XXXX-XXXX" dir="ltr" maxlength="9"></div>
    <button class="btn btn-yellow" style="width:100%;padding:12px;font-size:.95rem;margin-bottom:8px" onclick="verCode()">כניסה</button>
    <button class="btn btn-outline" style="width:100%;padding:10px" onclick="backOTP()">חזרה</button>
    <div id="code-msg"></div>
  </div>
</div>"""

auth_screen_new = """<div id="auth-screen">
  <div class="card" id="step-login">
    <div style="font-size:2.5rem;margin-bottom:16px">🛡️</div>
    <h2>חיבור WhatsApp</h2>
    <p>כניסת אדמין נדרשת</p>
    <div class="form-group">
      <label>שם משתמש</label>
      <input type="text" id="username-input" placeholder="972546363350" dir="ltr" autocomplete="username">
    </div>
    <div class="form-group">
      <label>סיסמא</label>
      <input type="password" id="password-input" placeholder="••••••••" dir="ltr" autocomplete="current-password" onkeydown="if(event.key==='Enter')adminLogin()">
    </div>
    <button class="btn btn-yellow" style="width:100%;padding:12px;font-size:.95rem" onclick="adminLogin()">כניסה</button>
    <div id="login-msg"></div>
  </div>
</div>"""

content = content.replace(auth_screen_old, auth_screen_new)

# Replace JS logic
js_old = """async function reqOTP() {
  const p = document.getElementById('phone-input').value.trim();
  if(!p) return showMsg('ph-msg','נא להכניס טלפון');
  try {
    await apiAuth('/auth/otp/request', {method:'POST', body: JSON.stringify({phone:p})});
    phone = p;
    document.getElementById('show-phone').textContent = p;
    document.getElementById('step-phone').style.display = 'none';
    document.getElementById('step-otp').style.display = 'block';
  } catch(e) { showMsg('ph-msg', e.message); }
}
async function verOTP() {
  const otp = document.getElementById('otp-input').value.trim();
  if(!otp) return showMsg('otp-msg','נא להכניס קוד');
  try {
    const res = await apiAuth('/auth/otp/verify', {method:'POST', body: JSON.stringify({phone, otp})});
    if(res.role !== 'admin') { showMsg('otp-msg','אין הרשאות אדמין'); return; }
    _pendingToken = res.access_token;
    document.getElementById('step-otp').style.display = 'none';
    document.getElementById('step-code').style.display = 'block';
  } catch(e) { showMsg('otp-msg', e.message); }
}
function verCode() {
  const code = document.getElementById('code-input').value.trim();
  if(!code) return showMsg('code-msg','נא להכניס קוד');
  if(code !== ADMIN_CODE) { showMsg('code-msg','קוד שגוי'); return; }
  token = _pendingToken;
  localStorage.setItem('admin_token', token);
  localStorage.setItem('admin_phone', phone);
  enterApp();
}
function backPhone() { document.getElementById('step-otp').style.display='none'; document.getElementById('step-phone').style.display='block'; }
function backOTP() { document.getElementById('step-code').style.display='none'; document.getElementById('step-otp').style.display='block'; }"""

js_new = """async function adminLogin() {
  const username = document.getElementById('username-input').value.trim();
  const password = document.getElementById('password-input').value.trim();
  if (!username || !password) return showMsg('login-msg','נא למלא חסרים');
  try {
    const res = await apiAuth('/auth/admin/login', { method:'POST', body: JSON.stringify({ username, password }) });
    token = res.access_token;
    phone = username;
    localStorage.setItem('admin_token', token);
    localStorage.setItem('admin_phone', phone);
    enterApp();
  } catch(e) { showMsg('login-msg', e.message); }
}"""

content = content.replace(js_old, js_new)

with open('passenger-webapp/dist/whatsapp-setup.html', 'w', encoding='utf-8') as f:
    f.write(content)
