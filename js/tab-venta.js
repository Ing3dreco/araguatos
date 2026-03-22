/* ═══════════════════════════════════════════════════
   tab-venta.js  — Pestaña Venta (uso con cliente)
   Modifica rVenta() para cambiar la presentacion
   del plan de pagos al cliente.
═══════════════════════════════════════════════════ */

function setPay(t) {
  S.cl.pay = t;
  G('cashSec').style.display = (t === 'cash') ? 'block' : 'none';
  G('finSec').style.display  = (t === 'fin')  ? 'block' : 'none';
  G('btnC').className = 'tgb' + (t === 'cash' ? ' on' : '');
  G('btnF').className = 'tgb' + (t === 'fin'  ? ' on' : '');
  rVenta();
}

function sPlazo(m, btn) {
  S.cl.mo = m;
  S.cl.cmAmt = 0;
  var btns = document.querySelectorAll('.rb');
  for (var i = 0; i < btns.length; i++) btns[i].className = 'rb';
  btn.className = 'rb on';
  var cm = G('cm_manual'); if (cm) cm.value = '';
  rVenta();
}

function onCiSlider() {
  S.cl.dn    = parseInt(G('r_ci').value);
  S.cl.dnAmt = 0;
  S.cl.cmAmt = 0;
  var ci = G('ci_manual'); if (ci) ci.value = '';
  var cm = G('cm_manual'); if (cm) cm.value = '';
  rVenta();
}

function onCiManual() {
  var el = G('ci_manual'); if (!el) return;
  var v = parseFloat(el.value);
  if (v > 0) {
    S.cl.dnAmt = v;
    S.cl.cmAmt = 0;
    var cm = G('cm_manual'); if (cm) cm.value = '';
  } else {
    S.cl.dnAmt = 0;
  }
  rVenta();
}

function onCmManual() {
  var el = G('cm_manual'); if (!el) return;
  var v = parseFloat(el.value);
  S.cl.cmAmt = (v > 0) ? v : 0;
  rVenta();
}

function sLot(id) {
  S.cl.lid   = id;
  S.cl.dnAmt = 0;
  S.cl.cmAmt = 0;
  var ci = G('ci_manual'); if (ci) ci.value = '';
  var cm = G('cm_manual'); if (cm) cm.value = '';
  rVenta();
}

function rVenta() {
  S.cl.dn = parseInt(G('r_ci').value) || 20;

  var av  = S.lots.filter(function(l){return l.type !== 'reserved' && l.status === 'available';});
  var sel = null;
  if (S.cl.lid) sel = S.lots.find(function(l){return l.id === S.cl.lid;});
  if (!sel || sel.status !== 'available') { sel = av[0] || null; S.cl.lid = sel ? sel.id : null; }

  var baseP = sel ? lp(sel) : S.cfg.std;
  var isPV  = (S.cl.pay === 'cash' && pvOk() && sel != null);
  var fP    = isPV ? parseFloat((baseP * (1 - S.cfg.pv / 100)).toFixed(1)) : baseP;

  G('cPBig').textContent = fCOP(fP);
  G('cPSub').textContent = (isPV ? 'PREVENTA - Descuento ' + S.cfg.pv + '% aplicado' : 'Precio del lote') + (sel ? ' - ' + sel.id : '');

  /* Cuota inicial: manual tiene prioridad sobre slider */
  var ciEl    = G('ci_manual');
  var manualCi = ciEl ? (parseFloat(ciEl.value) || 0) : 0;
  var dnAmt   = manualCi > 0 ? manualCi : (S.cl.dnAmt > 0 ? S.cl.dnAmt : fP * S.cl.dn / 100);
  G('v_ci').textContent = S.cl.dn + '% = ' + fCOP(dnAmt);

  /* Lot picker */
  var types = [
    {type:'premium',  l:'PREMIUM',  c:'pp'},
    {type:'plus',     l:'PLUS',     c:'pl'},
    {type:'standard', l:'ESTANDAR', c:''}
  ];
  var html = '';
  types.forEach(function(t) {
    var tl = av.filter(function(l){return l.type === t.type;}); if (!tl.length) return;
    html += '<div style="grid-column:1/-1;font-size:10px;font-weight:800;color:var(--muted);margin-top:6px">' + t.l + '</div>';
    tl.forEach(function(l) {
      html += '<div class="lpb ' + t.c + (l.id === S.cl.lid ? ' on' : '') + '" onclick="sLot(\'' + l.id + '\')">'
        + '<div style="font-weight:900">' + l.id + '</div>'
        + '<div style="font-size:10px;opacity:.85">' + fCOP(lp(l)) + '</div>'
        + '<div style="font-size:9px;opacity:.65">' + l.area + 'm2</div></div>';
    });
  });
  G('lpGrid').innerHTML = '<div class="lpkr">' + html + '</div>';

  if (!sel) { G('sumCard').style.display = 'none'; return; }
  G('sumCard').style.display = 'block';

  if (S.cl.pay === 'cash') {
    G('pvBadge').innerHTML = isPV
      ? '<div class="pvbadge">PREVENTA - Eres uno de los primeros 10 compradores de contado. Precio: ' + fCOP(fP) + '<br><small>' + pvUsed() + '/10 preventas usadas - ' + S.cfg.pv + '% descuento</small></div>'
      : '<div class="al al-i"><b>Precio contado:</b> ' + fCOP(fP) + '</div>';
    G('cashSum').innerHTML = [
      {v:fCOP(fP),                l:'Precio'+(isPV?' preventa':'')+' contado'},
      {v:fCOP(fP),                l:'En pesos colombianos'},
      {v:isPV?fCOP(baseP-fP)+' ahorrado':'Pago unico', l:isPV?'Ahorro preventa':'Sin cuotas'},
    ].map(function(b){return '<div class="pbox"><div class="pbv">'+b.v+'</div><div class="pbl">'+b.l+'</div></div>';}).join('');
    G('pmtSum').innerHTML = ''; G('pmtTbl').innerHTML = '';

  } else {
    G('pvBadge').innerHTML = ''; G('cashSum').innerHTML = '';
    var fin    = fP - dnAmt;

    /* Cuota mensual: manual tiene prioridad sobre plazo */
    var cmEl     = G('cm_manual');
    var manualCm = cmEl ? (parseFloat(cmEl.value) || 0) : 0;
    var mPmt     = manualCm > 0 ? manualCm : (S.cl.cmAmt > 0 ? S.cl.cmAmt : (S.cl.mo > 0 ? fin / S.cl.mo : 0));
    var calcMo   = (mPmt > 0 && fin > 0) ? Math.ceil(fin / mPmt) : S.cl.mo;

    G('pmtSum').innerHTML = [
      {v:fCOP(fP),     l:'Precio del lote'},
      {v:fCOP(dnAmt),  l:'Cuota inicial'},
      {v:fCOP(mPmt),   l:calcMo + ' cuotas de'},
    ].map(function(b){return '<div class="pbox"><div class="pbv">'+b.v+'</div><div class="pbl">'+b.l+'</div></div>';}).join('');

    var rows = '<thead><tr><th>#</th><th>Fecha</th><th>Cuota mensual</th><th>Saldo</th></tr></thead><tbody>';
    var now2 = new Date();
    for (var i = 1; i <= calcMo; i++) {
      var d      = new Date(now2.getFullYear(), now2.getMonth() + i, 15);
      var saldo  = fin - mPmt * i;
      rows += '<tr' + (i === calcMo ? ' class="last"' : '') + '>'
        + '<td>' + i + '</td>'
        + '<td>' + d.toLocaleDateString('es-CO', {month:'short', year:'numeric'}) + '</td>'
        + '<td>' + fCOP(mPmt) + '</td>'
        + '<td>' + fCOP(Math.max(0, saldo)) + '</td></tr>';
    }
    G('pmtTbl').innerHTML = '<table>' + rows + '</tbody></table>';
  }
}

/* ── Registro de venta ─────────────────────────── */
function oSale() {
  var lid = S.cl.lid;
  var l   = S.lots.find(function(x){return x.id === lid;});
  if (!l) { alert('Selecciona un lote primero.'); return; }

  var isPV2 = (S.cl.pay === 'cash' && pvOk());
  var fP2   = isPV2 ? parseFloat((lp(l) * (1 - S.cfg.pv / 100)).toFixed(1)) : lp(l);
  var ciEl2 = G('ci_manual');
  var manCI2 = ciEl2 ? (parseFloat(ciEl2.value) || 0) : 0;
  var dnAmt2 = manCI2 > 0 ? manCI2 : (S.cl.dnAmt > 0 ? S.cl.dnAmt : fP2 * S.cl.dn / 100);
  var cmEl2  = G('cm_manual');
  var manCM2 = cmEl2 ? (parseFloat(cmEl2.value) || 0) : 0;

  var payDesc = S.cl.pay === 'cash' ? (isPV2 ? 'Contado Preventa' : 'Contado') : 'Financiado ' + S.cl.mo + 'm';

  G('smB').innerHTML =
    '<div class="al al-i" style="margin-bottom:12px"><b>Lote ' + lid + '</b> - ' + fCOP(fP2) + ' - ' + payDesc + '</div>'
    + '<label class="fl">Nombre completo *</label><input type="text" id="sm_b">'
    + '<label class="fl">Cedula / NIT *</label><input type="text" id="sm_cc">'
    + '<label class="fl">Telefono *</label><input type="tel" id="sm_ph">'
    + '<label class="fl">Correo electronico</label><input type="email" id="sm_em">'
    + '<label class="fl">Direccion</label><input type="text" id="sm_ad">'
    + '<label class="fl">Estado</label>'
    + '<select id="sm_st"><option value="apartado">Apartado</option><option value="sold">Vendido</option></select>'
    + '<label class="fl">Mes del proyecto en que se vende (0 = ahora)</label>'
    + '<input type="number" id="sm_mo" value="0" min="0" max="60">'
    + '<label class="fl">Observaciones</label><input type="text" id="sm_ob">';
  G('saleMod').style.display = 'flex';
}

function savSale() {
  var b  = G('sm_b').value.trim(), cc = G('sm_cc').value.trim(), ph = G('sm_ph').value.trim();
  if (!b || !cc || !ph) { alert('Nombre, cedula y telefono son obligatorios.'); return; }

  var l = S.lots.find(function(x){return x.id === S.cl.lid;}); if (!l) return;
  var isPV3 = (S.cl.pay === 'cash' && pvOk());
  var fP3   = isPV3 ? parseFloat((lp(l) * (1 - S.cfg.pv / 100)).toFixed(1)) : lp(l);

  var ciEl3 = G('ci_manual');
  var manCI3 = ciEl3 ? (parseFloat(ciEl3.value) || 0) : 0;
  var dnAmt3 = manCI3 > 0 ? manCI3 : (S.cl.dnAmt > 0 ? S.cl.dnAmt : fP3 * S.cl.dn / 100);

  var cmEl3  = G('cm_manual');
  var cmAmt3 = cmEl3 ? (parseFloat(cmEl3.value) || 0) : (S.cl.cmAmt > 0 ? S.cl.cmAmt : 0);

  l.buyer = b; l.cc = cc; l.phone = ph;
  l.email = G('sm_em').value; l.addr  = G('sm_ad').value;
  l.status   = G('sm_st').value; l.payType = S.cl.pay; l.pv = isPV3;
  l.dn = S.cl.dn; l.mo = S.cl.mo; l.dnAmt = dnAmt3; l.cmAmt = cmAmt3;
  l.saleDate     = new Date().toISOString().slice(0, 10);
  l.saleMonthIdx = parseInt(G('sm_mo').value) || 0;
  l.obs        = G('sm_ob').value; l.salePrice = fP3;

  syncLot(l); saveS(); cSaleM(); rAll();
  var lid2 = l.id;
  setTimeout(function(){ if (confirm('Venta registrada. Generar minuta ahora?')) oMin(lid2); }, 350);
}

function cSaleM(e) {
  if (e && e.target !== G('saleMod')) return;
  G('saleMod').style.display = 'none';
}

/* ── Imprimir plan de pagos ────────────────────── */
function pPlan() {
  var sel  = S.lots.find(function(l){return l.id === S.cl.lid;});
  var bP2  = sel ? lp(sel) : S.cfg.std;
  var isPV4 = (S.cl.pay === 'cash' && pvOk() && sel != null);
  var price2 = isPV4 ? parseFloat((bP2 * (1 - S.cfg.pv / 100)).toFixed(1)) : bP2;

  var ciEl4  = G('ci_manual');
  var manCI4 = ciEl4 ? (parseFloat(ciEl4.value) || 0) : 0;
  var dnAmt5 = manCI4 > 0 ? manCI4 : (S.cl.dnAmt > 0 ? S.cl.dnAmt : price2 * S.cl.dn / 100);
  var fin3   = price2 - dnAmt5;

  var cmEl4  = G('cm_manual');
  var manCM4 = cmEl4 ? (parseFloat(cmEl4.value) || 0) : 0;
  var mPmt4  = manCM4 > 0 ? manCM4 : (S.cl.cmAmt > 0 ? S.cl.cmAmt : (S.cl.mo > 0 ? fin3 / S.cl.mo : 0));
  var calcMo3 = (mPmt4 > 0 && fin3 > 0) ? Math.ceil(fin3 / mPmt4) : S.cl.mo;

  var now3 = new Date(), rows3 = '';
  if (S.cl.pay === 'fin') {
    for (var i2 = 1; i2 <= calcMo3; i2++) {
      var d2 = new Date(now3.getFullYear(), now3.getMonth() + i2, 15);
      rows3 += '<tr><td>' + i2 + '</td><td>' + d2.toLocaleDateString('es-CO', {month:'short', year:'numeric'}) + '</td><td>' + fCOP(mPmt4) + '</td><td>' + fCOP(Math.max(0, fin3 - mPmt4 * i2)) + '</td></tr>';
    }
  }

  var w2 = window.open('', '_blank');
  w2.document.write('<html><head><title>Plan Pagos Araguatos</title>'
    + '<style>body{font-family:Arial,sans-serif;font-size:12px;max-width:620px;margin:20px auto}'
    + 'h1{font-size:18px;color:#1B5E20}table{width:100%;border-collapse:collapse;margin-top:12px}'
    + 'th{background:#1B5E20;color:#fff;padding:7px}td{padding:6px;border-bottom:1px solid #ddd;text-align:center}'
    + '.last td{background:#FFF8E1;font-weight:bold}hr{border-color:#C8DFC4}'
    + '@media print{@page{margin:1.5cm}}</style></head><body>');
  w2.document.write('<h1>Proyecto Araguatos - Plan de Pagos</h1>'
    + '<p>ING3DRECO SAS - NIT 901580047-1 - Florencia, Caqueta<br>Fecha: ' + now3.toLocaleDateString('es-CO') + '</p><hr>');
  w2.document.write('<p><b>Lote: ' + (sel?sel.id:'-') + '</b> | Manzana ' + (sel?sel.m:'-') + ' | ' + (sel?sel.area:98) + 'm2' + (isPV4?' | *** PREVENTA ***':'') + '</p>');
  w2.document.write('<table><tr><td><b>Precio del lote</b></td><td>' + fCOP(price2) + '</td></tr>');
  if (S.cl.pay === 'fin') {
    w2.document.write('<tr><td><b>Cuota inicial</b></td><td>' + fCOP(dnAmt5) + '</td></tr>'
      + '<tr><td><b>Valor financiado</b></td><td>' + fCOP(fin3) + '</td></tr>'
      + '<tr><td><b>Plazo</b></td><td>' + calcMo3 + ' meses</td></tr>'
      + '<tr style="background:#FFF8E1"><td><b>Cuota mensual</b></td><td><b>' + fCOP(mPmt4) + '</b></td></tr></table>'
      + '<table><thead><tr><th>#</th><th>Fecha</th><th>Cuota</th><th>Saldo</th></tr></thead><tbody>' + rows3 + '</tbody></table>');
  } else {
    w2.document.write('<tr><td><b>Modalidad</b></td><td>CONTADO' + (isPV4?' (PREVENTA)':'') + '</td></tr></table>');
  }
  w2.document.write('<hr style="margin-top:20px"><p style="font-size:10px;color:#666">Generado por ING3DRECO SAS - Proyecto Araguatos - ' + now3.toLocaleDateString('es-CO') + '</p></body></html>');
  w2.document.close(); w2.focus();
  setTimeout(function(){ w2.print(); }, 500);
}

function cpPlan() {
  var sel = S.lots.find(function(l){return l.id === S.cl.lid;}); if (!sel) return;
  var price3 = sel.salePrice || lp(sel);
  var t2 = 'PLAN DE PAGOS - PROYECTO ARAGUATOS\nIng3dreco SAS\nLote: ' + sel.id + ' | ' + sel.area + 'm2\nPrecio: ' + fCOP(price3) + '\nModalidad: ' + (S.cl.pay === 'cash' ? 'CONTADO' : 'FINANCIADO ' + S.cl.mo + ' meses');
  if (navigator.clipboard) navigator.clipboard.writeText(t2).then(function(){ alert('Copiado.'); });
}
