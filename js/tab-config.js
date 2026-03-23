/* ═══════════════════════════════════════════════════
   tab-config.js  — Configuración + Supabase completo
═══════════════════════════════════════════════════ */

var SB_URL = '', SB_KEY = '', SB_CONNECTED = false;

/* ──────────────────────────────────────────────────
   INICIALIZAR PANEL CONFIG
────────────────────────────────────────────────── */
function initConfigPanel() {
  var u = localStorage.getItem('araguatos_sb_url') || '';
  var k = localStorage.getItem('araguatos_sb_key') || '';
  var eu = document.getElementById('cfg_url');
  var ek = document.getElementById('cfg_key');
  if (eu) eu.value = u;
  if (ek) ek.value = k;
  if (u && k) { SB_URL = u; SB_KEY = k; }
  initMinutaEditor();
}

/* ──────────────────────────────────────────────────
   SUPABASE — CONECTAR
────────────────────────────────────────────────── */
function connectSupabase() {
  var eu = document.getElementById('cfg_url');
  var ek = document.getElementById('cfg_key');
  SB_URL = eu ? eu.value.trim() : '';
  SB_KEY = ek ? ek.value.trim() : '';
  if (!SB_URL || !SB_KEY) {
    setConnStatus('error', '⚠️ Ingresa la URL y la API Key del proyecto Supabase.');
    return;
  }
  localStorage.setItem('araguatos_sb_url', SB_URL);
  localStorage.setItem('araguatos_sb_key', SB_KEY);
  setConnStatus('info', '🔄 Conectando con Supabase...');
  /* Primero intenta crear la tabla (si no existe), luego sube datos */
  ensureTable().then(function() {
    pushToSupabase();
  }).catch(function() {
    /* Si falla crear tabla (ya existe), igual intenta subir */
    pushToSupabase();
  });
}

/* ──────────────────────────────────────────────────
   SUPABASE — CREAR TABLA SI NO EXISTE
   (usa RPC o ejecuta el SQL via REST)
────────────────────────────────────────────────── */
function ensureTable() {
  /* Intentar un SELECT simple — si la tabla no existe dará error */
  return fetch(SB_URL + '/rest/v1/lots?limit=1', {
    headers: {
      'apikey': SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
    }
  }).then(function(r) {
    if (r.status === 404 || r.status === 400) {
      setConnStatus('warn', '⚠️ Tabla "lots" no encontrada. Créala con el SQL de la guía y vuelve a intentar.');
      throw new Error('tabla no existe');
    }
    return r;
  });
}

/* ──────────────────────────────────────────────────
   SUPABASE — SUBIR DATOS (upsert)
────────────────────────────────────────────────── */
function pushToSupabase() {
  if (!SB_URL || !SB_KEY) {
    setConnStatus('error', 'Configura la conexión primero.');
    return;
  }
  setConnStatus('info', '🔄 Subiendo datos a Supabase...');
  var payload = S.lots.map(function(l) {
    return {
      id:             l.id,
      m:              l.m,
      n:              l.n,
      type:           l.type,
      area:           l.area,
      fp:             l.fp,
      status:         l.status,
      buyer:          l.buyer   || '',
      cc:             l.cc      || '',
      phone:          l.phone   || '',
      email:          l.email   || '',
      addr:           l.addr    || '',
      pay_type:       l.payType || 'fin',
      dn:             l.dn      || 20,
      mo:             l.mo      || 36,
      dn_amt:         l.dnAmt   || 0,
      cm_amt:         l.cmAmt   || 0,
      pv:             l.pv      || false,
      sale_date:      l.saleDate      || null,
      sale_price:     l.salePrice     || null,
      sale_month_idx: l.saleMonthIdx  || 0,
      obs:            l.obs     || '',
    };
  });
  fetch(SB_URL + '/rest/v1/lots', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
      'Prefer':        'resolution=merge-duplicates',
    },
    body: JSON.stringify(payload),
  }).then(function(r) {
    if (r.ok) {
      SB_CONNECTED = true;
      updateConnUI();
      rAll();
      setConnStatus('ok', '✅ ' + S.lots.length + ' lotes subidos correctamente a Supabase.');
    } else {
      r.text().then(function(t) {
        setConnStatus('error', '❌ Error al subir datos: ' + t);
      });
    }
  }).catch(function(e) {
    setConnStatus('error', '❌ Error de red: ' + e.message);
  });
}

/* ──────────────────────────────────────────────────
   SUPABASE — DESCARGAR DATOS
────────────────────────────────────────────────── */
function pullFromSupabase() {
  if (!SB_URL || !SB_KEY) {
    setConnStatus('error', 'Configura la conexión primero.');
    return;
  }
  setConnStatus('info', '🔄 Descargando datos desde Supabase...');
  fetch(SB_URL + '/rest/v1/lots?select=*&order=m,n', {
    headers: {
      'apikey':        SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
    }
  }).then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function(data) {
    if (!Array.isArray(data) || data.length === 0) {
      setConnStatus('warn', '⚠️ No hay datos en Supabase. Usa "Subir datos" primero.');
      return;
    }
    /* Reconstruir lots desde la base fresca y aplicar datos de Supabase */
    var base = buildLots();
    data.forEach(function(row) {
      var l = base.find(function(x) { return x.id === row.id; });
      if (!l) return;
      l.type           = row.type           || l.type;
      l.area           = row.area           || l.area;
      l.fp             = row.fp             || null;
      l.status         = row.status         || l.status;
      l.buyer          = row.buyer          || '';
      l.cc             = row.cc             || '';
      l.phone          = row.phone          || '';
      l.email          = row.email          || '';
      l.addr           = row.addr           || '';
      l.payType        = row.pay_type       || 'fin';
      l.dn             = row.dn             || 20;
      l.mo             = row.mo             || 36;
      l.dnAmt          = row.dn_amt         || 0;
      l.cmAmt          = row.cm_amt         || 0;
      l.pv             = row.pv             || false;
      l.saleDate       = row.sale_date      || null;
      l.salePrice      = row.sale_price     || null;
      l.saleMonthIdx   = row.sale_month_idx || 0;
      l.obs            = row.obs            || '';
    });
    S.lots = base;
    /* También restaurar configuración si está guardada en Supabase */
    SB_CONNECTED = true;
    updateConnUI();
    saveS();
    rAll();
    setConnStatus('ok', '✅ ' + data.length + ' lotes descargados desde Supabase.');
  }).catch(function(e) {
    setConnStatus('error', '❌ Error: ' + e.message + '. Verifica que la tabla "lots" existe.');
  });
}

/* ──────────────────────────────────────────────────
   SUPABASE — SINCRONIZAR UN LOTE (auto)
────────────────────────────────────────────────── */
function syncLot(l) {
  if (!SB_CONNECTED || !SB_URL || !SB_KEY) return;
  fetch(SB_URL + '/rest/v1/lots', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
      'Prefer':        'resolution=merge-duplicates',
    },
    body: JSON.stringify([{
      id:             l.id,
      m:              l.m,
      n:              l.n,
      type:           l.type,
      area:           l.area,
      fp:             l.fp,
      status:         l.status,
      buyer:          l.buyer   || '',
      cc:             l.cc      || '',
      phone:          l.phone   || '',
      email:          l.email   || '',
      addr:           l.addr    || '',
      pay_type:       l.payType || 'fin',
      dn:             l.dn      || 20,
      mo:             l.mo      || 36,
      dn_amt:         l.dnAmt   || 0,
      cm_amt:         l.cmAmt   || 0,
      pv:             l.pv      || false,
      sale_date:      l.saleDate      || null,
      sale_price:     l.salePrice     || null,
      sale_month_idx: l.saleMonthIdx  || 0,
      obs:            l.obs     || '',
    }]),
  }).catch(function() { /* silencioso */ });
}

/* ──────────────────────────────────────────────────
   UI HELPERS
────────────────────────────────────────────────── */
function setConnStatus(type, msg) {
  var el = document.getElementById('connStatus');
  if (!el) return;
  var cls = { ok:'al-ok', warn:'al-w', info:'al-i', error:'al-r' }[type] || 'al-i';
  el.innerHTML = '<div class="al '+cls+'">'+msg+'</div>';
}

function updateConnUI() {
  var el = document.getElementById('hConn');
  if (!el) return;
  if (SB_CONNECTED) {
    el.textContent = '☁ Supabase ✓';
    el.className   = 'hconn ok';
  } else {
    el.textContent = 'Local';
    el.className   = 'hconn loc';
  }
}

/* ──────────────────────────────────────────────────
   EDITOR DE MINUTA
────────────────────────────────────────────────── */
function initMinutaEditor() {
  var tpl = localStorage.getItem('araguatos_minuta_tpl') || (typeof MINUTA_DEFAULT !== 'undefined' ? MINUTA_DEFAULT : '');
  var ed  = document.getElementById('minutaEditor');
  if (ed) ed.value = tpl;
}

function saveMinuta() {
  var ed = document.getElementById('minutaEditor');
  if (!ed) return;
  localStorage.setItem('araguatos_minuta_tpl', ed.value);
  var msg = document.getElementById('minutaMsg');
  if (msg) {
    msg.textContent = '✅ Formato guardado.';
    setTimeout(function(){ msg.textContent = ''; }, 3000);
  }
}

function resetMinuta() {
  if (!confirm('¿Restaurar el formato original de minuta? Se perderán los cambios.')) return;
  localStorage.removeItem('araguatos_minuta_tpl');
  var ed = document.getElementById('minutaEditor');
  if (ed) ed.value = (typeof MINUTA_DEFAULT !== 'undefined' ? MINUTA_DEFAULT : '');
  var msg = document.getElementById('minutaMsg');
  if (msg) {
    msg.textContent = '↺ Formato restaurado.';
    setTimeout(function(){ msg.textContent = ''; }, 3000);
  }
}

/* ──────────────────────────────────────────────────
   EXPORTAR / IMPORTAR
────────────────────────────────────────────────── */
function exportJSON() {
  var blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  var a    = document.createElement('a');
  a.href   = URL.createObjectURL(blob);
  a.download = 'araguatos_backup_' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
}

function exportExcel() {
  var sold = S.lots.filter(function(l){ return l.status==='sold'||l.status==='apartado'; });
  var hdr  = 'Lote,Manzana,Area m2,Tipo,Estado,Comprador,Cedula,Telefono,Precio M,Modalidad,Cuota Inicial M,Cuota Mensual M,Plazo meses,Fecha Venta\n';
  var rows = sold.map(function(l){
    var pr   = l.salePrice || lp(l);
    var dnA  = l.dnAmt  > 0 ? l.dnAmt  : pr * (l.dn||20)/100;
    var fin  = pr - dnA;
    var mo2  = l.mo || 36;
    var cmA  = l.cmAmt > 0 ? l.cmAmt  : fin / mo2;
    return [l.id, l.m, l.area, l.type, l.status,
            '"'+l.buyer+'"', l.cc, l.phone,
            pr.toFixed(2), l.payType,
            dnA.toFixed(2), cmA.toFixed(2), mo2,
            l.saleDate||''].join(',');
  }).join('\n');
  var blob = new Blob(['\ufeff'+hdr+rows], {type:'text/csv;charset=utf-8'});
  var a2   = document.createElement('a');
  a2.href  = URL.createObjectURL(blob);
  a2.download = 'araguatos_ventas_'+new Date().toISOString().slice(0,10)+'.csv';
  a2.click();
}

function clearLocal() {
  if (!confirm('¿Borrar TODOS los datos locales? Los datos en Supabase no se borran.')) return;
  localStorage.removeItem('araguatos_v6');
  localStorage.removeItem('araguatos_v5');
  S = defS();
  saveS();
  rAll();
  setConnStatus('ok', '✅ Datos locales borrados. Se restauraron los valores por defecto.');
}
