/* ═══════════════════════════════════════════════════
   tab-config.js  — Supabase + Auth
   Credenciales hardcodeadas — login obligatorio
═══════════════════════════════════════════════════ */
 
/* ── Credenciales ──────────────────────────────── */
var SB_URL = 'https://ninaxwddpqqgaflacdfm.supabase.co';
var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pbmF4d2RkcHFxZ2FmbGFjZGZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNTU3MjMsImV4cCI6MjA4OTczMTcyM30.mBmOXS8fi-WYuw0FeRcMBUpruKsW9JnKZHcGLd1zrkQ';
var SB_CONNECTED = false;
var SB_TOKEN = '';   /* JWT del usuario autenticado */
var _refreshTimer = null;
 
/* ── Helper de headers ─────────────────────────── */
function sbH(extra) {
  var h = {
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + (SB_TOKEN || SB_KEY)
  };
  if (extra) { for (var k in extra) h[k] = extra[k]; }
  return h;
}
 
/* ════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════ */
 
/* Arranque: revisa sesion guardada */
function initAuth() {
  var raw = localStorage.getItem('araguatos_session');
  if (!raw) { showLogin(); return; }
  try {
    var sess = JSON.parse(raw);
    if (sess && sess.access_token) {
      var now = Math.floor(Date.now() / 1000);
      if (sess.expires_at && sess.expires_at > now + 60) {
        SB_TOKEN = sess.access_token;
        scheduleRefresh(sess.expires_at - now);
        onAuthSuccess();
      } else {
        sbRefresh(sess.refresh_token);
      }
    } else { showLogin(); }
  } catch (e) { showLogin(); }
}
 
/* Renovar token */
function sbRefresh(rt) {
  if (!rt) { showLogin(); return; }
  fetch(SB_URL + '/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SB_KEY },
    body: JSON.stringify({ refresh_token: rt })
  }).then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.access_token) {
      SB_TOKEN = d.access_token;
      var expiresIn = d.expires_in || 3600;
      localStorage.setItem('araguatos_session', JSON.stringify({
        access_token: d.access_token,
        refresh_token: d.refresh_token || rt,
        expires_at: Math.floor(Date.now() / 1000) + expiresIn
      }));
      scheduleRefresh(expiresIn);
      onAuthSuccess();
    } else { showLogin(); }
  }).catch(function() { showLogin(); });
}
 
/* Renovación automática 60s antes de expirar */
function scheduleRefresh(expiresInSeconds) {
  clearTimeout(_refreshTimer);
  var delay = Math.max((expiresInSeconds - 60) * 1000, 10000);
  _refreshTimer = setTimeout(function() {
    var raw = localStorage.getItem('araguatos_session');
    if (!raw) return;
    try {
      var sess = JSON.parse(raw);
      if (sess && sess.refresh_token) sbRefresh(sess.refresh_token);
    } catch(e) {}
  }, delay);
}
 
/* Boton Ingresar */
function doLogin() {
  var emailEl = G('loginEmail'), passEl = G('loginPass');
  var errEl = G('loginErr'), btnEl = G('loginBtn');
  var email = (emailEl ? emailEl.value : '').trim();
  var pass  = passEl ? passEl.value : '';
  if (!email || !pass) {
    if (errEl) errEl.textContent = 'Ingresa tu correo y contrasena.';
    return;
  }
  if (btnEl) { btnEl.textContent = 'Ingresando...'; btnEl.disabled = true; }
  if (errEl) errEl.textContent = '';
 
  fetch(SB_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SB_KEY },
    body: JSON.stringify({ email: email, password: pass })
  }).then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.access_token) {
      SB_TOKEN = d.access_token;
      localStorage.setItem('araguatos_session', JSON.stringify({
        access_token: d.access_token,
        refresh_token: d.refresh_token || '',
        expires_at: Math.floor(Date.now() / 1000) + (d.expires_in || 3600)
      }));
      onAuthSuccess();
    } else {
      var msg = d.error_description || d.msg || 'Correo o contrasena incorrectos.';
      if (errEl) errEl.textContent = msg;
      if (btnEl) { btnEl.textContent = 'Ingresar'; btnEl.disabled = false; }
    }
  }).catch(function() {
    if (errEl) errEl.textContent = 'Error de conexion. Verifica tu internet.';
    if (btnEl) { btnEl.textContent = 'Ingresar'; btnEl.disabled = false; }
  });
}
 
/* Login exitoso */
function onAuthSuccess() {
  var ov = G('loginOverlay');
  if (ov) ov.style.display = 'none';
  SB_CONNECTED = true;
  updateConnUI();
  pullFromSupabase();
}
 
function showLogin() {
  var ov = G('loginOverlay');
  if (ov) ov.style.display = 'flex';
}
 
function doLogout() {
  if (!confirm('Cerrar sesion?')) return;
  if (SB_TOKEN) {
    fetch(SB_URL + '/auth/v1/logout', { method: 'POST', headers: sbH() }).catch(function() {});
  }
  localStorage.removeItem('araguatos_session');
  SB_TOKEN = ''; SB_CONNECTED = false;
  location.reload();
}
 
function initConfigPanel() {}
 
/* ════════════════════════════════════════════════
   SUPABASE - DATOS
═══════════════════════════════════════════════════ */
 
function connectSupabase() {
  setConnStatus('info', 'Verificando conexion...');
  fetch(SB_URL + '/rest/v1/lots?limit=1', { headers: sbH() })
  .then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status + '. Existe la tabla lots?');
    pushToSupabase();
  }).catch(function(e) { setConnStatus('error', 'Error: ' + e.message); });
}
 
function pushToSupabase() {
  if (!SB_URL || !SB_KEY) return;
  var payload = S.lots.map(function(l) {
    return {
      id: l.id, m: l.m, n: l.n, type: l.type, area: l.area, fp: l.fp,
      status: l.status, buyer: l.buyer || '', cc: l.cc || '',
      phone: l.phone || '', email: l.email || '', addr: l.addr || '',
      pay_type: l.payType || 'fin', dn: l.dn || 20, mo: l.mo || 36,
      dn_amt: l.dnAmt || 0, cm_amt: l.cmAmt || 0, pv: l.pv || false,
      sale_date: l.saleDate || null, sale_price: l.salePrice || null,
      sale_month_idx: l.saleMonthIdx || 0, obs: l.obs || ''
    };
  });
  fetch(SB_URL + '/rest/v1/lots', {
    method: 'POST',
    headers: sbH({ 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' }),
    body: JSON.stringify(payload)
  }).then(function(r) {
    if (r.ok) {
      SB_CONNECTED = true; updateConnUI();
      if (typeof pushLinderos === 'function') pushLinderos();
      setConnStatus('ok', 'OK: ' + S.lots.length + ' lotes sincronizados.');
    } else {
      r.text().then(function(t) { setConnStatus('error', 'Error: ' + t); });
    }
  }).catch(function(e) { setConnStatus('error', 'Red: ' + e.message); });
}
 
function pullFromSupabase() {
  if (!SB_URL || !SB_KEY) return;
  fetch(SB_URL + '/rest/v1/lots?select=*&order=m,n', { headers: sbH() })
  .then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function(data) {
    if (!Array.isArray(data) || !data.length) {
      pushToSupabase(); return;
    }
// Supabase manda — reemplazar S.lots completamente
var base = buildLots(); // solo para valores por defecto si faltan campos
S.lots = data.map(function(row) {
  var def = base.find(function(x){ return x.m===row.m && x.n===row.n; }) || {};
  return {
    id:           row.id,
    m:            row.m,
    n:            row.n,
    type:         row.type         || def.type    || 'standard',
    area:         row.area         || def.area    || 98,
    fp:           row.fp           || null,
    status:       row.status       || 'available',
    buyer:        row.buyer        || '',
    cc:           row.cc           || '',
    phone:        row.phone        || '',
    email:        row.email        || '',
    addr:         row.addr         || '',
    payType:      row.pay_type     || 'fin',
    dn:           row.dn           || 20,
    mo:           row.mo           || 36,
    dnAmt:        row.dn_amt       || 0,
    cmAmt:        row.cm_amt       || 0,
    pv:           row.pv           || false,
    saleDate:     row.sale_date    || null,
    salePrice:    row.sale_price   || null,
    saleMonthIdx: row.sale_month_idx || 0,
    obs:          row.obs          || ''
  };
   });
    saveS();
    if (typeof pullLinderos === 'function') pullLinderos();
    rAll();
    setConnStatus('ok', 'OK: ' + data.length + ' lotes cargados desde Supabase.');
  }).catch(function(e) { setConnStatus('error', 'Error: ' + e.message); });
}
function syncLot(l) {
  if (!SB_CONNECTED || !SB_URL || !SB_KEY) return;
  fetch(SB_URL + '/rest/v1/lots', {
    method: 'POST',
    headers: sbH({ 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' }),
    body: JSON.stringify([{
      id: l.id, m: l.m, n: l.n, type: l.type, area: l.area, fp: l.fp,
      status: l.status, buyer: l.buyer || '', cc: l.cc || '',
      phone: l.phone || '', email: l.email || '', addr: l.addr || '',
      pay_type: l.payType || 'fin', dn: l.dn || 20, mo: l.mo || 36,
      dn_amt: l.dnAmt || 0, cm_amt: l.cmAmt || 0, pv: l.pv || false,
      sale_date: l.saleDate || null, sale_price: l.salePrice || null,
      sale_month_idx: l.saleMonthIdx || 0, obs: l.obs || ''
    }])
  }).catch(function() {});
}
 
/* ════════════════════════════════════════════════
   UI
═══════════════════════════════════════════════════ */
function setConnStatus(type, msg) {
  var el = G('connStatus'); if (!el) return;
  var cls = { ok: 'al-ok', warn: 'al-w', info: 'al-i', error: 'al-r' }[type] || 'al-i';
  el.innerHTML = '<div class="al ' + cls + '">' + msg + '</div>';
}
 
function updateConnUI() {
  var el = G('hConn'); if (!el) return;
  if (SB_CONNECTED) { el.textContent = 'Supabase'; el.className = 'hconn ok'; }
  else              { el.textContent = 'Local';    el.className = 'hconn loc'; }
}
 
function exportJSON() {
  var blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'araguatos_backup_' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
}
 
function exportExcel() {
  var sold = S.lots.filter(function(l) { return l.status === 'sold' || l.status === 'apartado'; });
  var hdr = 'Lote,Manzana,Area m2,Tipo,Estado,Comprador,Cedula,Telefono,Precio M,Modalidad,CI M,CM M,Plazo,Fecha\n';
  var rows = sold.map(function(l) {
    var pr = l.salePrice || lp(l);
    var dn = l.dnAmt > 0 ? l.dnAmt : pr * (l.dn || 20) / 100;
    var fin = pr - dn, mo = l.mo || 36;
    var cm = l.cmAmt > 0 ? l.cmAmt : fin / mo;
    return [l.id, l.m, l.area, l.type, l.status, '"' + l.buyer + '"', l.cc, l.phone,
            pr.toFixed(2), l.payType, dn.toFixed(2), cm.toFixed(2), mo, l.saleDate || ''].join(',');
  }).join('\n');
  var blob = new Blob(['\ufeff' + hdr + rows], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'araguatos_ventas_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
}
 
function clearLocal() {
  if (!confirm('Borrar TODOS los datos locales? (Supabase no se modifica)')) return;
  localStorage.removeItem('araguatos_v6');
  localStorage.removeItem('araguatos_v5');
  localStorage.removeItem('araguatos_linderos');
  S = defS(); saveS(); rAll();
  setConnStatus('ok', 'OK: Datos locales borrados y restaurados por defecto.');
}
 
/* ── Arrancar auth al cargar ───────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  initAuth();
});
