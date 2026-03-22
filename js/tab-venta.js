/* ═══════════════════════════════════════════════════
   tab-venta.js  — Pestaña Venta
   Plano arquitectónico interactivo + simulador
═══════════════════════════════════════════════════ */

var MAX_MO = 54;

/* ══════════════════════════════════════════════════
   PLANO SVG — Fiel al plano arquitectónico
   Layout:  [Rotonda]
            [Via Principal]
   [MzA 19 lotes] [via] [MzB 18] [via] [MzC 18] [via] [MzD 3]
            [Via Interna]
══════════════════════════════════════════════════ */

/* Colores por estado */
function lotColor(l) {
  if (!l) return '#B0BEC5';
  if (l.status === 'sold')     return '#1B5E20';
  if (l.status === 'apartado') return '#BF360C';
  if (l.type   === 'internal') return '#455A64';
  if (l.type   === 'premium')  return '#880E4F';
  if (l.type   === 'plus')     return '#1A237E';
  return '#2E7D32';
}

function rLotMap() {
  var el = G('saleMapSvg');
  if (!el) return;

  /* ── Dimensiones globales ──────────────────── */
  var W = 860;

  /* Calles */
  var ST = 38;  /* Via principal (top) */
  var SB = 24;  /* Via secundaria (bottom) */
  var SL = 12;  /* Via lateral izquierda */
  var SR = 10;  /* Via lateral derecha */
  var VI = 20;  /* Via interna horizontal */
  var VC = 14;  /* Via transversal (entre manzanas) */
  var RT = 52;  /* Rotonda (height) */

  /* Manzanas: altura fila */
  var LH = 26;  /* altura por lote */
  var LW_A = 74, LW_B = 70, LW_C = 70, LW_D = 76; /* anchos de columna */

  /* Manzana A: 9 lotes columna izq + 10 lotes columna der (dentro de A) */
  var aRows = 10; /* max filas */
  var aH    = aRows * LH;

  /* Manzana B y C: 9 filas */
  var bRows = 9;
  var bH    = bRows * LH;

  /* Posiciones X de cada manzana */
  var aX = SL;
  var bX = aX + LW_A * 2 + VC;
  var cX = bX + LW_B * 2 + VC;
  var dX = cX + LW_C * 2 + VC;

  /* Posición Y de las manzanas (debajo de via principal + rotonda) */
  var mzY  = ST + RT + 4;
  var viY  = mzY + aH + 4;   /* Via interna Y */
  var H    = viY + VI + SB + 4;

  var s = [];
  function add(t) { s.push(t); }

  /* ── Fondo cuadriculado ──────────────────── */
  add('<defs>');
  add('<pattern id="pg" width="20" height="20" patternUnits="userSpaceOnUse">');
  add('<path d="M20 0L0 0 0 20" fill="none" stroke="#C8E6C9" stroke-width="0.4"/>');
  add('</pattern>');
  add('<filter id="sh"><feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="rgba(0,0,0,.2)"/></filter>');
  add('<clipPath id="rotClip"><rect x="0" y="0" width="' + W + '" height="' + H + '"/></clipPath>');
  add('</defs>');
  add('<rect width="' + W + '" height="' + H + '" fill="#DFF0D8"/>');
  add('<rect width="' + W + '" height="' + H + '" fill="url(#pg)"/>');

  /* ── Calles ────────────────────────────── */
  /* Via principal */
  add('<rect x="0" y="' + RT + '" width="' + W + '" height="' + ST + '" fill="#546E7A"/>');
  add('<line x1="0" y1="' + (RT + ST - 2) + '" x2="' + W + '" y2="' + (RT + ST - 2) + '" stroke="#B0BEC5" stroke-width="1" stroke-dasharray="16,8"/>');
  add('<text x="' + (W / 2 + 60) + '" y="' + (RT + ST / 2 + 4) + '" text-anchor="middle" font-size="10" font-weight="800" fill="#ECEFF1" letter-spacing="3" font-family="Arial,sans-serif">VÍA PRINCIPAL</text>');

  /* Rotonda */
  var rotX = W * 0.22, rotY = RT / 2 + 2;
  add('<ellipse cx="' + rotX + '" cy="' + rotY + '" rx="36" ry="' + (RT / 2 - 2) + '" fill="#607D8B" stroke="#90A4AE" stroke-width="1.5"/>');
  add('<ellipse cx="' + rotX + '" cy="' + rotY + '" rx="22" ry="' + (RT / 2 - 12) + '" fill="#78909C" stroke="#90A4AE" stroke-width="1"/>');
  add('<circle cx="' + rotX + '" cy="' + rotY + '" r="6" fill="#90A4AE"/>');
  /* Señal de rotonda */
  add('<text x="' + (rotX - 56) + '" y="' + (rotY + 4) + '" font-size="8" fill="#ECEFF1" font-family="Arial,sans-serif" font-weight="700">◉</text>');
  add('<text x="' + (rotX - 56) + '" y="' + (rotY + 13) + '" font-size="7" fill="#B0BEC5" font-family="Arial,sans-serif">Rotonda</text>');

  /* Via lateral izquierda */
  add('<rect x="0" y="' + (RT + ST) + '" width="' + SL + '" height="' + (H - RT - ST) + '" fill="#607D8B"/>');
  /* Via lateral derecha */
  add('<rect x="' + (W - SR) + '" y="' + (RT + ST) + '" width="' + SR + '" height="' + (H - RT - ST) + '" fill="#607D8B"/>');
  /* Vias transversales entre manzanas */
  [bX - VC, cX - VC, dX - VC].forEach(function(vx) {
    add('<rect x="' + vx + '" y="' + (RT + ST) + '" width="' + VC + '" height="' + (viY - mzY + 2) + '" fill="#607D8B"/>');
    add('<line x1="' + (vx + VC / 2) + '" y1="' + (RT + ST + 4) + '" x2="' + (vx + VC / 2) + '" y2="' + (viY - 2) + '" stroke="#90A4AE" stroke-width="0.8" stroke-dasharray="8,5"/>');
  });
  /* Via interna */
  add('<rect x="0" y="' + viY + '" width="' + W + '" height="' + VI + '" fill="#546E7A"/>');
  add('<line x1="0" y1="' + (viY + VI - 2) + '" x2="' + W + '" y2="' + (viY + VI - 2) + '" stroke="#90A4AE" stroke-width="0.8" stroke-dasharray="14,7"/>');
  add('<text x="' + (W / 2) + '" y="' + (viY + VI / 2 + 4) + '" text-anchor="middle" font-size="8" font-weight="700" fill="#ECEFF1" letter-spacing="2" font-family="Arial,sans-serif">VÍA INTERNA</text>');
  /* Via secundaria */
  add('<rect x="0" y="' + (viY + VI) + '" width="' + W + '" height="' + (SB + 4) + '" fill="#455A64"/>');
  add('<text x="' + (W / 2) + '" y="' + (viY + VI + SB / 2 + 8) + '" text-anchor="middle" font-size="8" font-weight="700" fill="#ECEFF1" letter-spacing="2" font-family="Arial,sans-serif">VÍA SECUNDARIA</text>');

  /* Área verde junto a MzD */
  var gx = dX + LW_D + 2, gw = W - SR - gx;
  if (gw > 10) {
    add('<rect x="' + gx + '" y="' + mzY + '" width="' + gw + '" height="' + (bH) + '" fill="#81C784" rx="4" opacity="0.6"/>');
    add('<text x="' + (gx + gw / 2) + '" y="' + (mzY + bH / 2 - 5) + '" text-anchor="middle" font-size="10" font-weight="700" fill="#2E7D32" font-family="Arial,sans-serif">ÁREA</text>');
    add('<text x="' + (gx + gw / 2) + '" y="' + (mzY + bH / 2 + 8) + '" text-anchor="middle" font-size="10" font-weight="700" fill="#2E7D32" font-family="Arial,sans-serif">VERDE</text>');
    add('<text x="' + (gx + gw / 2) + '" y="' + (mzY + bH / 2 + 22) + '" text-anchor="middle" font-size="13" fill="#2E7D32" font-family="Arial,sans-serif">🌳</text>');
  }

  /* ── Función para dibujar un lote ──────── */
  function drawLot(lid, lx, ly, lw, lh) {
    var l   = S.lots.find(function(x) { return x.id === lid; });
    var fill = lotColor(l);
    var isSel = (S.cl.lid === lid);
    var isInt = l && l.type === 'internal';
    var canClick = !!l;

    add('<g class="lot-g" data-id="' + lid + '" style="cursor:' + (canClick ? 'pointer' : 'default') + '">');
    add('<rect x="' + (lx + 1) + '" y="' + (ly + 1) + '" width="' + (lw - 2) + '" height="' + (lh - 2) + '"'
      + ' fill="' + fill + '"'
      + ' stroke="' + (isSel ? '#F9A825' : 'rgba(255,255,255,0.4)') + '"'
      + ' stroke-width="' + (isSel ? '3' : '1.2') + '" rx="2"'
      + ' opacity="' + (l && (l.status === 'sold' || l.status === 'apartado') ? '0.75' : '1') + '"/>');

    /* Halo seleccionado */
    if (isSel) {
      add('<rect x="' + lx + '" y="' + ly + '" width="' + lw + '" height="' + lh + '"'
        + ' fill="none" stroke="#FDD835" stroke-width="2" rx="2" opacity="0.8"/>');
    }

    /* Fondo oscuro si vendido */
    if (l && l.status === 'sold') {
      add('<line x1="' + (lx + 3) + '" y1="' + (ly + 3) + '" x2="' + (lx + lw - 3) + '" y2="' + (ly + lh - 3) + '"'
        + ' stroke="rgba(255,255,255,.2)" stroke-width="1.2"/>');
      add('<line x1="' + (lx + lw - 3) + '" y1="' + (ly + 3) + '" x2="' + (lx + 3) + '" y2="' + (ly + lh - 3) + '"'
        + ' stroke="rgba(255,255,255,.2)" stroke-width="1.2"/>');
    }

    var fs = Math.max(7, Math.min(lw / 4.2, 10));
    /* Número del lote */
    add('<text x="' + (lx + lw / 2) + '" y="' + (ly + lh / 2 + fs * 0.38) + '"'
      + ' text-anchor="middle" font-size="' + fs + '" font-weight="900"'
      + ' fill="#fff" font-family="Arial,sans-serif">' + lid + '</text>');

    /* Precio o estado */
    var sub = l
      ? (l.status === 'sold'     ? 'VENDIDO'
        : l.status === 'apartado' ? 'APART.'
        : isInt ? 'INT.' : fM(lp(l)))
      : '';
    if (sub && lh > 20) {
      add('<text x="' + (lx + lw / 2) + '" y="' + (ly + lh - 4) + '"'
        + ' text-anchor="middle" font-size="' + Math.max(6, fs - 2) + '"'
        + ' fill="rgba(255,255,255,.82)" font-family="Arial,sans-serif">' + sub + '</text>');
    }

    add('<title>' + lid + (l ? ' | ' + l.type.toUpperCase() + (isInt ? '' : ' | ' + fCOP(lp(l)))
      + (l.buyer ? ' | ' + l.buyer : '') : '') + '</title>');
    add('</g>');
  }

  /* ── Dibuja cada manzana ───────────────── */

  /* MANZANA A — 9 izquierda (A01-A09) + 10 derecha (A10-A19) */
  var aLotsL = ['A01','A02','A03','A04','A05','A06','A07','A08','A09'];
  var aLotsR = ['A10','A11','A12','A13','A14','A15','A16','A17','A18','A19'];
  add('<text x="' + (aX + LW_A - 2) + '" y="' + (mzY - 5) + '" text-anchor="middle"'
    + ' font-size="9" font-weight="800" fill="#1B5E20" letter-spacing="2" font-family="Arial,sans-serif">MANZANA A</text>');
  aLotsL.forEach(function(lid, i) {
    drawLot(lid, aX, mzY + i * LH, LW_A, LH);
  });
  aLotsR.forEach(function(lid, i) {
    drawLot(lid, aX + LW_A, mzY + i * LH, LW_A, LH);
  });

  /* MANZANA B — 9+9 */
  var bLotsL = ['B01','B02','B03','B04','B05','B06','B07','B08','B09'];
  var bLotsR = ['B10','B11','B12','B13','B14','B15','B16','B17','B18'];
  add('<text x="' + (bX + LW_B - 2) + '" y="' + (mzY - 5) + '" text-anchor="middle"'
    + ' font-size="9" font-weight="800" fill="#1B5E20" letter-spacing="2" font-family="Arial,sans-serif">MANZANA B</text>');
  bLotsL.forEach(function(lid, i) {
    drawLot(lid, bX, mzY + i * LH, LW_B, LH);
  });
  bLotsR.forEach(function(lid, i) {
    drawLot(lid, bX + LW_B, mzY + i * LH, LW_B, LH);
  });

  /* MANZANA C — 9+9 */
  var cLotsL = ['C01','C02','C03','C04','C05','C06','C07','C08','C09'];
  var cLotsR = ['C10','C11','C12','C13','C14','C15','C16','C17','C18'];
  add('<text x="' + (cX + LW_C - 2) + '" y="' + (mzY - 5) + '" text-anchor="middle"'
    + ' font-size="9" font-weight="800" fill="#1B5E20" letter-spacing="2" font-family="Arial,sans-serif">MANZANA C</text>');
  cLotsL.forEach(function(lid, i) {
    drawLot(lid, cX, mzY + i * LH, LW_C, LH);
  });
  cLotsR.forEach(function(lid, i) {
    drawLot(lid, cX + LW_C, mzY + i * LH, LW_C, LH);
  });

  /* MANZANA D — 3 lotes verticales */
  var dLots = ['D01','D02','D03'];
  add('<text x="' + (dX + LW_D / 2) + '" y="' + (mzY - 5) + '" text-anchor="middle"'
    + ' font-size="9" font-weight="800" fill="#1B5E20" letter-spacing="2" font-family="Arial,sans-serif">MZ D</text>');
  dLots.forEach(function(lid, i) {
    drawLot(lid, dX, mzY + i * (bH / 3), LW_D, bH / 3);
  });

  /* Rosa de los vientos */
  var cpX = W - 30, cpY = mzY + 20;
  add('<circle cx="' + cpX + '" cy="' + cpY + '" r="16" fill="rgba(255,255,255,.9)" stroke="#546E7A" stroke-width="1.5"/>');
  add('<text x="' + cpX + '" y="' + (cpY - 4) + '" text-anchor="middle" font-size="7" font-weight="900" fill="#1B5E20" font-family="Arial,sans-serif">N</text>');
  add('<polygon points="' + cpX + ',' + (cpY - 1) + ' ' + (cpX - 3.5) + ',' + (cpY + 8) + ' ' + cpX + ',' + (cpY + 5.5) + ' ' + (cpX + 3.5) + ',' + (cpY + 8) + '" fill="#1B5E20"/>');
  add('<polygon points="' + cpX + ',' + (cpY + 1) + ' ' + (cpX - 3.5) + ',' + (cpY - 8) + ' ' + cpX + ',' + (cpY - 5.5) + ' ' + (cpX + 3.5) + ',' + (cpY - 8) + '" fill="#B0BEC5"/>');

  el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;display:block" xmlns="http://www.w3.org/2000/svg">' + s.join('') + '</svg>';

  /* ── Eventos ───────────────────────────── */
  el.querySelectorAll('.lot-g').forEach(function(g) {
    var lid = g.getAttribute('data-id');
    var l   = S.lots.find(function(x) { return x.id === lid; });

    g.addEventListener('click', function() {
      if (!l || l.status === 'sold' || l.status === 'apartado') return;
      sLot(lid);
    });

    g.addEventListener('mouseenter', function() {
      var tip = G('mapTooltip'); if (!tip || !l) return;
      var stHtml = l.status === 'sold'     ? '<span style="color:#A5D6A7;font-weight:700">✓ Vendido</span>'
        : l.status === 'apartado' ? '<span style="color:#FFCC80;font-weight:700">⬤ Apartado</span>'
        : l.type === 'internal'   ? '<span style="color:#90CAF9;font-weight:700">🔒 Uso interno</span>'
        : '<span style="color:#69F0AE;font-weight:700">● Disponible</span>';
      tip.innerHTML = '<b style="font-size:13px">Lote ' + lid + '</b>'
        + '<span style="opacity:.7;margin-left:6px;font-size:10px">' + l.type.toUpperCase() + '</span>'
        + '<br>' + stHtml
        + (l.type !== 'internal' ? '<br><b>' + fCOP(lp(l)) + '</b><span style="opacity:.7;font-size:10px;margin-left:6px">' + l.area + 'm²</span>' : '<br><span style="opacity:.8;font-size:10px">Sin precio · Uso empresa</span>')
        + (l.buyer ? '<br><span style="opacity:.75;font-size:10px">' + l.buyer + '</span>' : '');
      tip.style.display = 'block';
    });

    g.addEventListener('mousemove', function(e) {
      var tip = G('mapTooltip'); if (!tip) return;
      var wrap = G('lotMapWrap'); if (!wrap) return;
      var r = wrap.getBoundingClientRect();
      var tx = e.clientX - r.left, ty = e.clientY - r.top;
      tip.style.left  = (tx + 14) + 'px';
      tip.style.top   = (ty < 90 ? (ty + 18) : (ty - 85)) + 'px';
    });

    g.addEventListener('mouseleave', function() {
      var tip = G('mapTooltip'); if (tip) tip.style.display = 'none';
    });
  });
}

/* ══════════════════════════════════════════════════
   CONTROL DE PAGO
══════════════════════════════════════════════════ */

function setPay(t) {
  S.cl.pay = t;
  G('cashSec').style.display = (t === 'cash') ? 'block' : 'none';
  G('finSec').style.display  = (t === 'fin')  ? 'block' : 'none';
  G('btnC').className = 'tgb' + (t === 'cash' ? ' on' : '');
  G('btnF').className = 'tgb' + (t === 'fin'  ? ' on' : '');
  rVenta();
}

function sPlazo(m, btn) {
  S.cl.mo    = m;
  S.cl.cmAmt = 0;
  document.querySelectorAll('.rb').forEach(function(b) { b.className = 'rb'; });
  btn.className = 'rb on';
  var cm = G('cm_manual'); if (cm) { cm.value = ''; }
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

/* Input moneda: solo pesos completos */
function onCiManual() {
  var el = G('ci_manual'); if (!el) return;
  var v  = formatCopField(el); /* formatea y devuelve millones */
  S.cl.dnAmt = v > 0 ? v : 0;
  S.cl.cmAmt = 0;
  var cm = G('cm_manual'); if (cm && v > 0) cm.value = '';
  rVenta();
}

function onCmManual() {
  var el = G('cm_manual'); if (!el) return;
  var v  = formatCopField(el);
  S.cl.cmAmt = v > 0 ? v : 0;
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

/* ══════════════════════════════════════════════════
   RENDER PRINCIPAL
══════════════════════════════════════════════════ */

function rVenta() {
  S.cl.dn = parseInt(G('r_ci').value) || 20;

  var av  = S.lots.filter(function(l) { return l.type !== 'internal' && l.status === 'available'; });
  var sel = null;
  if (S.cl.lid) sel = S.lots.find(function(l) { return l.id === S.cl.lid; });
  /* Si el lote seleccionado no es disponible para venta, buscar el primero disponible */
  var selIsInternal = sel && sel.type === 'internal';
  if (!sel || (!selIsInternal && sel.status !== 'available')) {
    sel = av[0] || null;
    S.cl.lid = sel ? sel.id : null;
  }

  /* Precio */
  var isInt = sel && sel.type === 'internal';
  var baseP = (!sel || isInt) ? S.cfg.std : lp(sel);
  var isPV  = (S.cl.pay === 'cash' && pvOk() && sel != null && !isInt);
  var fP    = isPV ? parseFloat((baseP * (1 - S.cfg.pv / 100)).toFixed(1)) : baseP;

  G('cPBig').textContent = isInt ? 'Uso Interno' : fCOP(fP);
  G('cPSub').textContent = (isInt ? 'Lote de uso interno · Sin precio comercial'
    : (isPV ? 'PREVENTA — Descuento ' + S.cfg.pv + '% aplicado' : 'Precio del lote'))
    + (sel ? ' — ' + sel.id : '');

  G('v_ci').textContent = S.cl.dn + '% = ' + (isInt ? 'N/A' : fCOP(fP * S.cl.dn / 100));

  /* Render del plano */
  rLotMap();

  /* Info del lote seleccionado */
  if (sel) {
    var lpHtml = isInt
      ? '<div style="background:linear-gradient(135deg,#37474F,#546E7A);border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:12px;margin-top:4px">'
        + '<div style="font-size:22px;font-weight:900;color:#90CAF9">' + sel.id + '</div>'
        + '<div><div style="color:#fff;font-size:12px;font-weight:700">🔒 USO INTERNO · ' + sel.area + 'm²</div>'
        + '<div style="color:rgba(255,255,255,.65);font-size:11px">Para registrar propietario → ve a pestaña Lotes y haz clic en el lote</div></div></div>'
      : '<div style="background:linear-gradient(135deg,var(--g1),var(--g2));border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:12px;margin-top:4px">'
        + '<div style="font-size:22px;font-weight:900;color:var(--gold2)">' + sel.id + '</div>'
        + '<div><div style="color:#fff;font-size:12px;font-weight:700">' + sel.type.toUpperCase() + ' · ' + sel.area + 'm²</div>'
        + '<div style="color:rgba(255,255,255,.65);font-size:11px">' + fCOP(fP) + ' · Haz clic en otro lote para cambiar</div></div></div>';
    G('lpGrid').innerHTML = lpHtml;
  } else {
    G('lpGrid').innerHTML = '<div class="al al-i" style="margin-top:6px;font-size:12px">↑ Haz clic en un lote disponible en el plano para seleccionarlo.</div>';
  }

  /* Ocultar simulador si no hay lote válido o es interno */
  if (!sel || isInt) {
    G('sumCard').style.display = 'none';
    var fa0 = G('finAlert'); if (fa0) fa0.innerHTML = '';
    return;
  }
  G('sumCard').style.display = 'block';

  /* ─── Cuota inicial ─── */
  var ciEl    = G('ci_manual');
  var manualCi = ciEl ? (parseCopPesos(ciEl.value)) : 0;
  var dnAmt   = manualCi > 0 ? manualCi : (S.cl.dnAmt > 0 ? S.cl.dnAmt : fP * S.cl.dn / 100);

  /* ─── CONTADO ─── */
  if (S.cl.pay === 'cash') {
    G('pvBadge').innerHTML = isPV
      ? '<div class="pvbadge">PREVENTA — Precio: ' + fCOP(fP) + ' (' + pvUsed() + '/10 preventas · ' + S.cfg.pv + '% descuento)</div>'
      : '<div class="al al-i"><b>Precio contado:</b> ' + fCOP(fP) + '</div>';
    G('cashSum').innerHTML = [
      { v: fCOP(fP),                       l: 'Precio' + (isPV ? ' preventa' : '') + ' contado' },
      { v: fCOP(fP),                       l: 'En pesos colombianos' },
      { v: isPV ? fCOP(baseP - fP) + ' ahorrado' : 'Pago único', l: isPV ? 'Ahorro preventa' : 'Sin cuotas' },
    ].map(function(b) {
      return '<div class="pbox"><div class="pbv">' + b.v + '</div><div class="pbl">' + b.l + '</div></div>';
    }).join('');
    G('pmtSum').innerHTML = '';
    G('pmtTbl').innerHTML = '';
    var fa1 = G('finAlert'); if (fa1) fa1.innerHTML = '';

  } else {
    /* ─── FINANCIADO ─── */
    G('pvBadge').innerHTML = '';
    G('cashSum').innerHTML = '';
    var fin = fP - dnAmt;

    var cmEl     = G('cm_manual');
    var manualCm = cmEl ? parseCopPesos(cmEl.value) : 0;
    var mPmt     = manualCm > 0 ? manualCm
      : (S.cl.cmAmt > 0 ? S.cl.cmAmt : (S.cl.mo > 0 ? fin / S.cl.mo : 0));
    var calcMo   = (mPmt > 0 && fin > 0) ? Math.ceil(fin / mPmt) : S.cl.mo;

    /* Validación 54 meses */
    var faEl = G('finAlert');
    if (calcMo > MAX_MO) {
      if (faEl) faEl.innerHTML = '<div class="al al-r" style="margin-top:8px">'
        + '⚠️ <b>Plazo calculado: ' + calcMo + ' meses.</b> El máximo de financiación es <b>' + MAX_MO + ' meses</b>. '
        + 'Aumenta la cuota inicial o la cuota mensual para reducir el plazo.</div>';
      calcMo = MAX_MO;
    } else {
      if (faEl) faEl.innerHTML = '';
    }

    G('pmtSum').innerHTML = [
      { v: fCOP(fP),    l: 'Precio del lote' },
      { v: fCOP(dnAmt), l: 'Cuota inicial' },
      { v: fCOP(mPmt),  l: calcMo + ' cuotas de' },
    ].map(function(b) {
      return '<div class="pbox"><div class="pbv">' + b.v + '</div><div class="pbl">' + b.l + '</div></div>';
    }).join('');

    var rows = '<thead><tr><th>#</th><th>Fecha</th><th>Cuota mensual</th><th>Saldo</th></tr></thead><tbody>';
    var now2 = new Date();
    for (var i = 1; i <= calcMo; i++) {
      var d = new Date(now2.getFullYear(), now2.getMonth() + i, 15);
      var saldo = fin - mPmt * i;
      rows += '<tr' + (i === calcMo ? ' class="last"' : '') + '>'
        + '<td>' + i + '</td>'
        + '<td>' + d.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }) + '</td>'
        + '<td>' + fCOP(mPmt) + '</td>'
        + '<td>' + fCOP(Math.max(0, saldo)) + '</td></tr>';
    }
    G('pmtTbl').innerHTML = '<table>' + rows + '</tbody></table>';
  }
}

/* ── Registrar venta ─────────────────────────── */
function oSale() {
  var lid = S.cl.lid;
  var l   = S.lots.find(function(x) { return x.id === lid; });
  if (!l) { alert('Selecciona un lote primero.'); return; }
  if (l.type === 'internal') { alert('Los lotes de uso interno se editan desde la pestaña Lotes.'); return; }

  var isPV2  = (S.cl.pay === 'cash' && pvOk());
  var fP2    = isPV2 ? parseFloat((lp(l) * (1 - S.cfg.pv / 100)).toFixed(1)) : lp(l);
  var ciEl2  = G('ci_manual');
  var manCI2 = ciEl2 ? parseCopPesos(ciEl2.value) : 0;
  var dnAmt2 = manCI2 > 0 ? manCI2 : (S.cl.dnAmt > 0 ? S.cl.dnAmt : fP2 * S.cl.dn / 100);
  var cmEl2  = G('cm_manual');
  var manCM2 = cmEl2 ? parseCopPesos(cmEl2.value) : 0;
  var fin2   = fP2 - dnAmt2;
  var mPmt2  = manCM2 > 0 ? manCM2 : (S.cl.cmAmt > 0 ? S.cl.cmAmt : (S.cl.mo > 0 ? fin2 / S.cl.mo : 0));
  var calcMo2 = (mPmt2 > 0 && fin2 > 0) ? Math.ceil(fin2 / mPmt2) : S.cl.mo;
  var overLimit2 = calcMo2 > MAX_MO;
  var payDesc = S.cl.pay === 'cash' ? (isPV2 ? 'Contado Preventa' : 'Contado') : 'Financiado ' + S.cl.mo + 'm';

  G('smB').innerHTML =
    '<div class="al al-i" style="margin-bottom:12px"><b>Lote ' + lid + '</b> — ' + fCOP(fP2) + ' — ' + payDesc + '</div>'
    + (overLimit2 ? '<div class="al al-r" style="margin-bottom:10px">⚠️ El plazo calculado supera ' + MAX_MO + ' meses. Verifica cuotas antes de registrar.</div>' : '')
    + '<label class="fl">Nombre completo *</label><input type="text" id="sm_b">'
    + '<label class="fl">Cédula / NIT *</label><input type="text" id="sm_cc">'
    + '<label class="fl">Teléfono *</label><input type="tel" id="sm_ph">'
    + '<label class="fl">Correo electrónico</label><input type="email" id="sm_em">'
    + '<label class="fl">Dirección</label><input type="text" id="sm_ad">'
    + '<label class="fl">Estado</label>'
    + '<select id="sm_st"><option value="apartado">Apartado</option><option value="sold">Vendido</option></select>'
    + '<label class="fl">Mes del proyecto en que se vende (0 = ahora)</label>'
    + '<input type="number" id="sm_mo" value="0" min="0" max="60">'
    + '<label class="fl">Observaciones</label><input type="text" id="sm_ob">';
  G('saleMod').style.display = 'flex';
}

function savSale() {
  var b  = G('sm_b').value.trim(), cc = G('sm_cc').value.trim(), ph = G('sm_ph').value.trim();
  if (!b || !cc || !ph) { alert('Nombre, cédula y teléfono son obligatorios.'); return; }

  var l = S.lots.find(function(x) { return x.id === S.cl.lid; }); if (!l) return;
  var isPV3  = (S.cl.pay === 'cash' && pvOk());
  var fP3    = isPV3 ? parseFloat((lp(l) * (1 - S.cfg.pv / 100)).toFixed(1)) : lp(l);
  var ciEl3  = G('ci_manual');
  var manCI3 = ciEl3 ? parseCopPesos(ciEl3.value) : 0;
  var dnAmt3 = manCI3 > 0 ? manCI3 : (S.cl.dnAmt > 0 ? S.cl.dnAmt : fP3 * S.cl.dn / 100);
  var cmEl3  = G('cm_manual');
  var cmAmt3 = cmEl3 ? parseCopPesos(cmEl3.value) : (S.cl.cmAmt > 0 ? S.cl.cmAmt : 0);

  l.buyer  = b; l.cc    = cc; l.phone = ph;
  l.email  = G('sm_em').value; l.addr  = G('sm_ad').value;
  l.status = G('sm_st').value; l.payType = S.cl.pay; l.pv = isPV3;
  l.dn = S.cl.dn; l.mo = S.cl.mo; l.dnAmt = dnAmt3; l.cmAmt = cmAmt3;
  l.saleDate     = new Date().toISOString().slice(0, 10);
  l.saleMonthIdx = parseInt(G('sm_mo').value) || 0;
  l.obs   = G('sm_ob').value; l.salePrice = fP3;

  syncLot(l); saveS(); cSaleM(); rAll();
  var lid2 = l.id;
  setTimeout(function() { if (confirm('Venta registrada. ¿Generar minuta ahora?')) oMin(lid2); }, 350);
}

function cSaleM(e) {
  if (e && e.target !== G('saleMod')) return;
  G('saleMod').style.display = 'none';
}

/* ── Imprimir plan ─────────────────────────────── */
function pPlan() {
  var sel    = S.lots.find(function(l) { return l.id === S.cl.lid; });
  var bP2    = sel ? lp(sel) : S.cfg.std;
  var isPV4  = (S.cl.pay === 'cash' && pvOk() && sel != null);
  var price2 = isPV4 ? parseFloat((bP2 * (1 - S.cfg.pv / 100)).toFixed(1)) : bP2;
  var ciEl4  = G('ci_manual');
  var manCI4 = ciEl4 ? parseCopPesos(ciEl4.value) : 0;
  var dnAmt5 = manCI4 > 0 ? manCI4 : (S.cl.dnAmt > 0 ? S.cl.dnAmt : price2 * S.cl.dn / 100);
  var fin3   = price2 - dnAmt5;
  var cmEl4  = G('cm_manual');
  var manCM4 = cmEl4 ? parseCopPesos(cmEl4.value) : 0;
  var mPmt4  = manCM4 > 0 ? manCM4 : (S.cl.cmAmt > 0 ? S.cl.cmAmt : (S.cl.mo > 0 ? fin3 / S.cl.mo : 0));
  var calcMo3 = (mPmt4 > 0 && fin3 > 0) ? Math.ceil(fin3 / mPmt4) : S.cl.mo;
  if (calcMo3 > MAX_MO) calcMo3 = MAX_MO;

  var now3 = new Date(), rows3 = '';
  if (S.cl.pay === 'fin') {
    for (var i2 = 1; i2 <= calcMo3; i2++) {
      var d2 = new Date(now3.getFullYear(), now3.getMonth() + i2, 15);
      rows3 += '<tr><td>' + i2 + '</td><td>' + d2.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }) + '</td>'
        + '<td>' + fCOP(mPmt4) + '</td><td>' + fCOP(Math.max(0, fin3 - mPmt4 * i2)) + '</td></tr>';
    }
  }
  var w2 = window.open('', '_blank');
  w2.document.write('<html><head><title>Plan Pagos Araguatos</title>'
    + '<style>body{font-family:Arial,sans-serif;font-size:12px;max-width:620px;margin:20px auto}'
    + 'h1{font-size:18px;color:#1B5E20}table{width:100%;border-collapse:collapse;margin-top:12px}'
    + 'th{background:#1B5E20;color:#fff;padding:7px}td{padding:6px;border-bottom:1px solid #ddd;text-align:center}'
    + '.last td{background:#FFF8E1;font-weight:bold}hr{border-color:#C8DFC4}'
    + '@media print{@page{margin:1.5cm}}</style></head><body>');
  w2.document.write('<h1>Proyecto Araguatos — Plan de Pagos</h1>'
    + '<p>ING3DRECO SAS · NIT 901580047-1 · Florencia, Caquetá<br>Fecha: ' + now3.toLocaleDateString('es-CO') + '</p><hr>');
  w2.document.write('<p><b>Lote: ' + (sel ? sel.id : '-') + '</b> | Manzana ' + (sel ? sel.m : '-') + ' | ' + (sel ? sel.area : 98) + 'm²' + (isPV4 ? ' | *** PREVENTA ***' : '') + '</p>');
  w2.document.write('<table><tr><td><b>Precio del lote</b></td><td>' + fCOP(price2) + '</td></tr>');
  if (S.cl.pay === 'fin') {
    w2.document.write('<tr><td><b>Cuota inicial</b></td><td>' + fCOP(dnAmt5) + '</td></tr>'
      + '<tr><td><b>Valor financiado</b></td><td>' + fCOP(fin3) + '</td></tr>'
      + '<tr><td><b>Plazo</b></td><td>' + calcMo3 + ' meses (máx. ' + MAX_MO + ')</td></tr>'
      + '<tr style="background:#FFF8E1"><td><b>Cuota mensual</b></td><td><b>' + fCOP(mPmt4) + '</b></td></tr></table>'
      + '<table><thead><tr><th>#</th><th>Fecha</th><th>Cuota</th><th>Saldo</th></tr></thead><tbody>' + rows3 + '</tbody></table>');
  } else {
    w2.document.write('<tr><td><b>Modalidad</b></td><td>CONTADO' + (isPV4 ? ' (PREVENTA)' : '') + '</td></tr></table>');
  }
  w2.document.write('<hr style="margin-top:20px"><p style="font-size:10px;color:#666">Generado por ING3DRECO SAS — Proyecto Araguatos</p></body></html>');
  w2.document.close(); w2.focus();
  setTimeout(function() { w2.print(); }, 500);
}

function cpPlan() {
  var sel = S.lots.find(function(l) { return l.id === S.cl.lid; }); if (!sel) return;
  var t2  = 'PLAN DE PAGOS — PROYECTO ARAGUATOS\nING3DRECO SAS\nLote: ' + sel.id + ' | ' + sel.area + 'm²\nPrecio: ' + fCOP(sel.salePrice || lp(sel));
  if (navigator.clipboard) navigator.clipboard.writeText(t2).then(function() { alert('Copiado.'); });
}
