/* ═══════════════════════════════════════════════════
   tab-config.js  — Pestaña Configuracion
   Supabase, editor de minuta, exportar datos.
═══════════════════════════════════════════════════ */

var SB_URL = '', SB_KEY = '', SB_CONNECTED = false;

function initConfigPanel() {
  var u = localStorage.getItem('araguatos_sb_url') || '';
  var k = localStorage.getItem('araguatos_sb_key') || '';
  if (u) G('cfg_url').value = u;
  if (k) G('cfg_key').value = k;
  if (u && k) { SB_URL = u; SB_KEY = k; }
  initMinutaEditor();
}
/* ═══════════════════════════════════════════════════
   tab-config.js  — Pestaña Configuracion
   Supabase, editor de minuta, exportar datos.
═══════════════════════════════════════════════════ */

var SB_URL = '', SB_KEY = '', SB_CONNECTED = false;

function initConfigPanel() {/* ═══════════════════════════════════════════════════
   tab-config.js  — Pestaña Configuracion
   Supabase, editor de minuta, exportar datos.
═══════════════════════════════════════════════════ */

var SB_URL = '', SB_KEY = '', SB_CONNECTED = false;

function initConfigPanel() {
  var u = localStorage.getItem('araguatos_sb_url') || '';
  var k = localStorage.getItem('araguatos_sb_key') || '';
  if (u) G('cfg_url').value = u;
  if (k) G('cfg_key').value = k;
  if (u && k) { SB_URL = u; SB_KEY = k; }
  initMinutaEditor();
}

/* ── Supabase ──────────────────────────────────── */
function connectSupabase() {
  SB_URL = G('cfg_url').value.trim();
  SB_KEY = G('cfg_key').value.trim();
  if (!SB_URL || !SB_KEY) {
    G('connStatus').innerHTML = '<div class="al al-r">Ingresa la URL y la API Key.</div>'; return;
  }
  localStorage.setItem('araguatos_sb_url', SB_URL);
  localStorage.setItem('araguatos_sb_key', SB_KEY);
  G('connStatus').innerHTML = '<div class="al al-i">Conectando y sincronizando...</div>';
  pushToSupabase();
}

function pushToSupabase() {
  if (!SB_URL || !SB_KEY) {
    G('connStatus').innerHTML = '<div class="al al-r">Configura la conexion primero.</div>'; return;
  }
  var body = JSON.stringify(S.lots.map(function(l){
    return{id:l.id,m:l.m,n:l.n,type:l.type,area:l.area,fp:l.fp,
      status:l.status,buyer:l.buyer,cc:l.cc,phone:l.phone,email:l.email,addr:l.addr,
      pay_type:l.payType,dn:l.dn,mo:l.mo,dn_amt:l.dnAmt,cm_amt:l.cmAmt,
      pv:l.pv,sale_date:l.saleDate,sale_price:l.salePrice,
      sale_month_idx:l.saleMonthIdx,obs:l.obs};
  }));
  fetch(SB_URL + '/rest/v1/lots', {
    method: 'POST',
    headers: {'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Prefer':'resolution=merge-duplicates'},
    body: body
  }).then(function(r){
    if (r.ok) {
      SB_CONNECTED = true; updateConnUI(); rAll();
      G('connStatus').innerHTML = '<div class="al al-ok">Datos subidos correctamente a Supabase.</div>';
    } else {
      r.text().then(function(t){ G('connStatus').innerHTML = '<div class="al al-r">Error: '+t+'</div>'; });
    }
  }).catch(function(e){
    G('connStatus').innerHTML = '<div class="al al-r">Error de red: '+e.message+'</div>';
  });
}

function pullFromSupabase() {
  if (!SB_URL || !SB_KEY) {
    G('connStatus').innerHTML = '<div class="al al-r">Configura la conexion primero.</div>'; return;
  }
  G('connStatus').innerHTML = '<div class="al al-i">Descargando datos...</div>';
  fetch(SB_URL + '/rest/v1/lots?select=*', {
    headers: {'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY}
  }).then(function(r){ return r.json(); })
  .then(function(data){
    if (!data || !data.length) {
      G('connStatus').innerHTML = '<div class="al al-w">No hay datos en Supabase. Sube primero los datos locales.</div>'; return;
    }
    var dbLots = buildLots();
    data.forEach(function(row){
      var l = dbLots.find(function(x){return x.id === row.id;});
      if (l) {
        l.type=row.type||l.type; l.area=row.area||l.area; l.fp=row.fp;
        l.status=row.status||l.status; l.buyer=row.buyer||''; l.cc=row.cc||'';
        l.phone=row.phone||''; l.email=row.email||''; l.addr=row.addr||'';
        l.payType=row.pay_type||'fin'; l.dn=row.dn||20; l.mo=row.mo||36;
        l.dnAmt=row.dn_amt||0; l.cmAmt=row.cm_amt||0; l.pv=row.pv||false;
        l.saleDate=row.sale_date; l.salePrice=row.sale_price;
        l.saleMonthIdx=row.sale_month_idx||0; l.obs=row.obs||'';
      }
    });
    S.lots = dbLots; SB_CONNECTED = true; updateConnUI(); saveS(); rAll();
    G('connStatus').innerHTML = '<div class="al al-ok">' + data.length + ' lotes cargados desde Supabase.</div>';
  }).catch(function(e){
    G('connStatus').innerHTML = '<div class="al al-r">Error: '+e.message+'</div>';
  });
}

function syncLot(l) {
  if (!SB_CONNECTED || !SB_URL || !SB_KEY) return;
  fetch(SB_URL + '/rest/v1/lots', {
    method: 'POST',
    headers: {'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Prefer':'resolution=merge-duplicates'},
    body: JSON.stringify([{id:l.id,m:l.m,n:l.n,type:l.type,area:l.area,fp:l.fp,
      status:l.status,buyer:l.buyer,cc:l.cc,phone:l.phone,email:l.email,addr:l.addr,
      pay_type:l.payType,dn:l.dn,mo:l.mo,dn_amt:l.dnAmt,cm_amt:l.cmAmt,
      pv:l.pv,sale_date:l.saleDate,sale_price:l.salePrice,
      sale_month_idx:l.saleMonthIdx,obs:l.obs}])
  }).catch(function(){});
}

function updateConnUI() {
  var el = G('hConn');
  if (!el) return;
  if (SB_CONNECTED) { el.textContent = 'Supabase OK'; el.className = 'hconn ok'; }
  else { el.textContent = 'Local'; el.className = 'hconn loc'; }
}

function clearLocal() {
  if (confirm('Borrar todos los datos locales? (Los datos en Supabase no se borran)')) {
    localStorage.removeItem('araguatos_v5'); S = defS(); saveS(); rAll();
    G('connStatus').innerHTML = '<div class="al al-ok">Datos locales borrados.</div>';
  }
}

/* ── Editor de minuta ──────────────────────────── */
function initMinutaEditor() {
  var tpl = localStorage.getItem('araguatos_minuta_tpl') || MINUTA_DEFAULT;
  var ed  = G('minutaEditor');
  if (ed) ed.value = tpl;
}

function saveMinuta() {
  var v = G('minutaEditor').value;
  localStorage.setItem('araguatos_minuta_tpl', v);
  G('minutaMsg').textContent = 'Formato guardado correctamente.';
  setTimeout(function(){ G('minutaMsg').textContent = ''; }, 3000);
}

function resetMinuta() {
  if (confirm('Restaurar el formato original? Se perderan los cambios personalizados.')) {
    localStorage.removeItem('araguatos_minuta_tpl');
    G('minutaEditor').value = MINUTA_DEFAULT;
    G('minutaMsg').textContent = 'Formato restaurado al original.';
    setTimeout(function(){ G('minutaMsg').textContent = ''; }, 3000);
  }
}

/* ── Exportar ──────────────────────────────────── */
function exportJSON() {
  var blob = new Blob([JSON.stringify(S, null, 2)], {type:'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'araguatos_backup_' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
}

function exportExcel() {
  var sold = S.lots.filter(function(l){return l.status==='sold'||l.status==='apartado';});
  var hdr  = 'Lote,Manzana,Area,Tipo,Estado,Comprador,Cedula,Telefono,Precio,Pago,Cuota Inicial,Cuota Mensual,Plazo,Fecha Venta\n';
  var rows = sold.map(function(l){
    var pr  = l.salePrice || lp(l);
    var dn2 = l.dnAmt > 0 ? l.dnAmt : pr * (l.dn||20) / 100;
    var fin = pr - dn2;
    var mo2 = l.mo || 36;
    var cm  = l.cmAmt > 0 ? l.cmAmt : fin / mo2;
    return [l.id,l.m,l.area,l.type,l.status,'"'+l.buyer+'"',l.cc,l.phone,pr,l.payType,dn2,cm,mo2,l.saleDate||''].join(',');
  }).join('\n');
  var blob = new Blob(['\ufeff' + hdr + rows], {type:'text/csv;charset=utf-8'});
  var a2   = document.createElement('a');
  a2.href  = URL.createObjectURL(blob);
  a2.download = 'araguatos_ventas_' + new Date().toISOString().slice(0,10) + '.csv';
  a2.click();
}

  var u = localStorage.getItem('araguatos_sb_url') || '';
  var k = localStorage.getItem('araguatos_sb_key') || '';
  if (u) G('cfg_url').value = u;
  if (k) G('cfg_key').value = k;
  if (u && k) { SB_URL = u; SB_KEY = k; }
  initMinutaEditor();
}

/* ── Supabase ──────────────────────────────────── */
function connectSupabase() {
  SB_URL = G('cfg_url').value.trim();
  SB_KEY = G('cfg_key').value.trim();
  if (!SB_URL || !SB_KEY) {
    G('connStatus').innerHTML = '<div class="al al-r">Ingresa la URL y la API Key.</div>'; return;
  }
  localStorage.setItem('araguatos_sb_url', SB_URL);
  localStorage.setItem('araguatos_sb_key', SB_KEY);
  G('connStatus').innerHTML = '<div class="al al-i">Conectando y sincronizando...</div>';
  pushToSupabase();
}

function pushToSupabase() {
  if (!SB_URL || !SB_KEY) {
    G('connStatus').innerHTML = '<div class="al al-r">Configura la conexion primero.</div>'; return;
  }
  var body = JSON.stringify(S.lots.map(function(l){
    return{id:l.id,m:l.m,n:l.n,type:l.type,area:l.area,fp:l.fp,
      status:l.status,buyer:l.buyer,cc:l.cc,phone:l.phone,email:l.email,addr:l.addr,
      pay_type:l.payType,dn:l.dn,mo:l.mo,dn_amt:l.dnAmt,cm_amt:l.cmAmt,
      pv:l.pv,sale_date:l.saleDate,sale_price:l.salePrice,
      sale_month_idx:l.saleMonthIdx,obs:l.obs};
  }));
  fetch(SB_URL + '/rest/v1/lots', {
    method: 'POST',
    headers: {'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Prefer':'resolution=merge-duplicates'},
    body: body
  }).then(function(r){
    if (r.ok) {
      SB_CONNECTED = true; updateConnUI(); rAll();
      G('connStatus').innerHTML = '<div class="al al-ok">Datos subidos correctamente a Supabase.</div>';
    } else {
      r.text().then(function(t){ G('connStatus').innerHTML = '<div class="al al-r">Error: '+t+'</div>'; });
    }
  }).catch(function(e){
    G('connStatus').innerHTML = '<div class="al al-r">Error de red: '+e.message+'</div>';
  });
}

function pullFromSupabase() {
  if (!SB_URL || !SB_KEY) {
    G('connStatus').innerHTML = '<div class="al al-r">Configura la conexion primero.</div>'; return;
  }
  G('connStatus').innerHTML = '<div class="al al-i">Descargando datos...</div>';
  fetch(SB_URL + '/rest/v1/lots?select=*', {
    headers: {'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY}
  }).then(function(r){ return r.json(); })
  .then(function(data){
    if (!data || !data.length) {
      G('connStatus').innerHTML = '<div class="al al-w">No hay datos en Supabase. Sube primero los datos locales.</div>'; return;
    }
    var dbLots = buildLots();
    data.forEach(function(row){
      var l = dbLots.find(function(x){return x.id === row.id;});
      if (l) {
        l.type=row.type||l.type; l.area=row.area||l.area; l.fp=row.fp;
        l.status=row.status||l.status; l.buyer=row.buyer||''; l.cc=row.cc||'';
        l.phone=row.phone||''; l.email=row.email||''; l.addr=row.addr||'';
        l.payType=row.pay_type||'fin'; l.dn=row.dn||20; l.mo=row.mo||36;
        l.dnAmt=row.dn_amt||0; l.cmAmt=row.cm_amt||0; l.pv=row.pv||false;
        l.saleDate=row.sale_date; l.salePrice=row.sale_price;
        l.saleMonthIdx=row.sale_month_idx||0; l.obs=row.obs||'';
      }
    });
    S.lots = dbLots; SB_CONNECTED = true; updateConnUI(); saveS(); rAll();
    G('connStatus').innerHTML = '<div class="al al-ok">' + data.length + ' lotes cargados desde Supabase.</div>';
  }).catch(function(e){
    G('connStatus').innerHTML = '<div class="al al-r">Error: '+e.message+'</div>';
  });
}

function syncLot(l) {
  if (!SB_CONNECTED || !SB_URL || !SB_KEY) return;
  fetch(SB_URL + '/rest/v1/lots', {
    method: 'POST',
    headers: {'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Prefer':'resolution=merge-duplicates'},
    body: JSON.stringify([{id:l.id,m:l.m,n:l.n,type:l.type,area:l.area,fp:l.fp,
      status:l.status,buyer:l.buyer,cc:l.cc,phone:l.phone,email:l.email,addr:l.addr,
      pay_type:l.payType,dn:l.dn,mo:l.mo,dn_amt:l.dnAmt,cm_amt:l.cmAmt,
      pv:l.pv,sale_date:l.saleDate,sale_price:l.salePrice,
      sale_month_idx:l.saleMonthIdx,obs:l.obs}])
  }).catch(function(){});
}

function updateConnUI() {
  var el = G('hConn');
  if (!el) return;
  if (SB_CONNECTED) { el.textContent = 'Supabase OK'; el.className = 'hconn ok'; }
  else { el.textContent = 'Local'; el.className = 'hconn loc'; }
}

function clearLocal() {
  if (confirm('Borrar todos los datos locales? (Los datos en Supabase no se borran)')) {
    localStorage.removeItem('araguatos_v5'); S = defS(); saveS(); rAll();
    G('connStatus').innerHTML = '<div class="al al-ok">Datos locales borrados.</div>';
  }
}

/* ── Editor de minuta ──────────────────────────── */
function initMinutaEditor() {
  var tpl = localStorage.getItem('araguatos_minuta_tpl') || MINUTA_DEFAULT;
  var ed  = G('minutaEditor');
  if (ed) ed.value = tpl;
}

function saveMinuta() {
  var v = G('minutaEditor').value;
  localStorage.setItem('araguatos_minuta_tpl', v);
  G('minutaMsg').textContent = 'Formato guardado correctamente.';
  setTimeout(function(){ G('minutaMsg').textContent = ''; }, 3000);
}

function resetMinuta() {
  if (confirm('Restaurar el formato original? Se perderan los cambios personalizados.')) {
    localStorage.removeItem('araguatos_minuta_tpl');
    G('minutaEditor').value = MINUTA_DEFAULT;
    G('minutaMsg').textContent = 'Formato restaurado al original.';
    setTimeout(function(){ G('minutaMsg').textContent = ''; }, 3000);
  }
}

/* ── Exportar ──────────────────────────────────── */
function exportJSON() {
  var blob = new Blob([JSON.stringify(S, null, 2)], {type:'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'araguatos_backup_' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
}

function exportExcel() {
  var sold = S.lots.filter(function(l){return l.status==='sold'||l.status==='apartado';});
  var hdr  = 'Lote,Manzana,Area,Tipo,Estado,Comprador,Cedula,Telefono,Precio,Pago,Cuota Inicial,Cuota Mensual,Plazo,Fecha Venta\n';
  var rows = sold.map(function(l){
    var pr  = l.salePrice || lp(l);
    var dn2 = l.dnAmt > 0 ? l.dnAmt : pr * (l.dn||20) / 100;
    var fin = pr - dn2;
    var mo2 = l.mo || 36;
    var cm  = l.cmAmt > 0 ? l.cmAmt : fin / mo2;
    return [l.id,l.m,l.area,l.type,l.status,'"'+l.buyer+'"',l.cc,l.phone,pr,l.payType,dn2,cm,mo2,l.saleDate||''].join(',');
  }).join('\n');
  var blob = new Blob(['\ufeff' + hdr + rows], {type:'text/csv;charset=utf-8'});
  var a2   = document.createElement('a');
  a2.href  = URL.createObjectURL(blob);
  a2.download = 'araguatos_ventas_' + new Date().toISOString().slice(0,10) + '.csv';
  a2.click();
}

/* ── Supabase ──────────────────────────────────── */
function connectSupabase() {
  SB_URL = G('cfg_url').value.trim();
  SB_KEY = G('cfg_key').value.trim();
  if (!SB_URL || !SB_KEY) {
    G('connStatus').innerHTML = '<div class="al al-r">Ingresa la URL y la API Key.</div>'; return;
  }
  localStorage.setItem('araguatos_sb_url', SB_URL);
  localStorage.setItem('araguatos_sb_key', SB_KEY);
  G('connStatus').innerHTML = '<div class="al al-i">Conectando y sincronizando...</div>';
  pushToSupabase();
}

function pushToSupabase() {
  if (!SB_URL || !SB_KEY) {
    G('connStatus').innerHTML = '<div class="al al-r">Configura la conexion primero.</div>'; return;
  }
  var body = JSON.stringify(S.lots.map(function(l){
    return{id:l.id,m:l.m,n:l.n,type:l.type,area:l.area,fp:l.fp,
      status:l.status,buyer:l.buyer,cc:l.cc,phone:l.phone,email:l.email,addr:l.addr,
      pay_type:l.payType,dn:l.dn,mo:l.mo,dn_amt:l.dnAmt,cm_amt:l.cmAmt,
      pv:l.pv,sale_date:l.saleDate,sale_price:l.salePrice,
      sale_month_idx:l.saleMonthIdx,obs:l.obs};
  }));
  fetch(SB_URL + '/rest/v1/lots', {
    method: 'POST',
    headers: {'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Prefer':'resolution=merge-duplicates'},
    body: body
  }).then(function(r){
    if (r.ok) {
      SB_CONNECTED = true; updateConnUI(); rAll();
      G('connStatus').innerHTML = '<div class="al al-ok">Datos subidos correctamente a Supabase.</div>';
    } else {
      r.text().then(function(t){ G('connStatus').innerHTML = '<div class="al al-r">Error: '+t+'</div>'; });
    }
  }).catch(function(e){
    G('connStatus').innerHTML = '<div class="al al-r">Error de red: '+e.message+'</div>';
  });
}

function pullFromSupabase() {
  if (!SB_URL || !SB_KEY) {
    G('connStatus').innerHTML = '<div class="al al-r">Configura la conexion primero.</div>'; return;
  }
  G('connStatus').innerHTML = '<div class="al al-i">Descargando datos...</div>';
  fetch(SB_URL + '/rest/v1/lots?select=*', {
    headers: {'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY}
  }).then(function(r){ return r.json(); })
  .then(function(data){
    if (!data || !data.length) {
      G('connStatus').innerHTML = '<div class="al al-w">No hay datos en Supabase. Sube primero los datos locales.</div>'; return;
    }
    var dbLots = buildLots();
    data.forEach(function(row){
      var l = dbLots.find(function(x){return x.id === row.id;});
      if (l) {
        l.type=row.type||l.type; l.area=row.area||l.area; l.fp=row.fp;
        l.status=row.status||l.status; l.buyer=row.buyer||''; l.cc=row.cc||'';
        l.phone=row.phone||''; l.email=row.email||''; l.addr=row.addr||'';
        l.payType=row.pay_type||'fin'; l.dn=row.dn||20; l.mo=row.mo||36;
        l.dnAmt=row.dn_amt||0; l.cmAmt=row.cm_amt||0; l.pv=row.pv||false;
        l.saleDate=row.sale_date; l.salePrice=row.sale_price;
        l.saleMonthIdx=row.sale_month_idx||0; l.obs=row.obs||'';
      }
    });
    S.lots = dbLots; SB_CONNECTED = true; updateConnUI(); saveS(); rAll();
    G('connStatus').innerHTML = '<div class="al al-ok">' + data.length + ' lotes cargados desde Supabase.</div>';
  }).catch(function(e){
    G('connStatus').innerHTML = '<div class="al al-r">Error: '+e.message+'</div>';
  });
}

function syncLot(l) {
  if (!SB_CONNECTED || !SB_URL || !SB_KEY) return;
  fetch(SB_URL + '/rest/v1/lots', {
    method: 'POST',
    headers: {'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Prefer':'resolution=merge-duplicates'},
    body: JSON.stringify([{id:l.id,m:l.m,n:l.n,type:l.type,area:l.area,fp:l.fp,
      status:l.status,buyer:l.buyer,cc:l.cc,phone:l.phone,email:l.email,addr:l.addr,
      pay_type:l.payType,dn:l.dn,mo:l.mo,dn_amt:l.dnAmt,cm_amt:l.cmAmt,
      pv:l.pv,sale_date:l.saleDate,sale_price:l.salePrice,
      sale_month_idx:l.saleMonthIdx,obs:l.obs}])
  }).catch(function(){});
}

function updateConnUI() {
  var el = G('hConn');
  if (!el) return;
  if (SB_CONNECTED) { el.textContent = 'Supabase OK'; el.className = 'hconn ok'; }
  else { el.textContent = 'Local'; el.className = 'hconn loc'; }
}

function clearLocal() {
  if (confirm('Borrar todos los datos locales? (Los datos en Supabase no se borran)')) {
    localStorage.removeItem('araguatos_v5'); S = defS(); saveS(); rAll();
    G('connStatus').innerHTML = '<div class="al al-ok">Datos locales borrados.</div>';
  }
}

/* ── Editor de minuta ──────────────────────────── */
function initMinutaEditor() {
  var tpl = localStorage.getItem('araguatos_minuta_tpl') || MINUTA_DEFAULT;
  var ed  = G('minutaEditor');
  if (ed) ed.value = tpl;
}

function saveMinuta() {
  var v = G('minutaEditor').value;
  localStorage.setItem('araguatos_minuta_tpl', v);
  G('minutaMsg').textContent = 'Formato guardado correctamente.';
  setTimeout(function(){ G('minutaMsg').textContent = ''; }, 3000);
}

function resetMinuta() {
  if (confirm('Restaurar el formato original? Se perderan los cambios personalizados.')) {
    localStorage.removeItem('araguatos_minuta_tpl');
    G('minutaEditor').value = MINUTA_DEFAULT;
    G('minutaMsg').textContent = 'Formato restaurado al original.';
    setTimeout(function(){ G('minutaMsg').textContent = ''; }, 3000);
  }
}

/* ── Exportar ──────────────────────────────────── */
function exportJSON() {
  var blob = new Blob([JSON.stringify(S, null, 2)], {type:'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'araguatos_backup_' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
}

function exportExcel() {
  var sold = S.lots.filter(function(l){return l.status==='sold'||l.status==='apartado';});
  var hdr  = 'Lote,Manzana,Area,Tipo,Estado,Comprador,Cedula,Telefono,Precio,Pago,Cuota Inicial,Cuota Mensual,Plazo,Fecha Venta\n';
  var rows = sold.map(function(l){
    var pr  = l.salePrice || lp(l);
    var dn2 = l.dnAmt > 0 ? l.dnAmt : pr * (l.dn||20) / 100;
    var fin = pr - dn2;
    var mo2 = l.mo || 36;
    var cm  = l.cmAmt > 0 ? l.cmAmt : fin / mo2;
    return [l.id,l.m,l.area,l.type,l.status,'"'+l.buyer+'"',l.cc,l.phone,pr,l.payType,dn2,cm,mo2,l.saleDate||''].join(',');
  }).join('\n');
  var blob = new Blob(['\ufeff' + hdr + rows], {type:'text/csv;charset=utf-8'});
  var a2   = document.createElement('a');
  a2.href  = URL.createObjectURL(blob);
  a2.download = 'araguatos_ventas_' + new Date().toISOString().slice(0,10) + '.csv';
  a2.click();
}
