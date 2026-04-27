with open('passenger-webapp/dist/admin.html', 'r', encoding='utf-8') as f:
    text = f.read()

timer_code = """
  // Auto-refresh QR every 30s while not connected
  setInterval(async () => {
    const s = document.getElementById('status-dot');
    if(s && !s.className.includes('open') && document.getElementById('page-whatsapp').classList.contains('active')) {
      await checkState();
    }
  }, 30000);
}
"""

text = text.replace('  loadRecentRides();\n  \n  // WhatsApp Init', timer_code + '  \n  // WhatsApp Init')

with open('passenger-webapp/dist/admin.html', 'w', encoding='utf-8') as f:
    f.write(text)
