/* ═══════════════════════════════════════════════════
   tab-lotes.js  — Pestaña Lotes
   Colores: PLUS=dorado, STANDARD=gris, INTERNAL=verde
            VENDIDO=verde oscuro, APARTADO=naranja
═══════════════════════════════════════════════════ */

function lHTML(l) {
  var isInt = l.type === 'internal';
  var cls   = 'lc ' + l.type + (isInt ? '' : ' ' + l.status);
  var dotClr = isInt                    ? '#2E7D32'
             : l.status==='sold'        ? '#1B5E20'
             : l.status==='apartado'    ? '#E65100'
             : l.type==='plus'          ? '#C8860A'
             :                            '#9E9E9E';
  var intB = isInt
    ? '<span style="position:absolute;top:3px;right:5px;font-size:8px;background:#2E7D32;color:#fff;padding:1px 4px;border-radius:3px">INT</span>' : '';
  var pvs  = (!isInt && l.pv)
    ? '<span style="position:absolute;bottom:4px;right:5px;color:var(--gold);font-size:9px">PV</span>' : '';
  return '<div class="'+cls+'" onclick="oLot(\''+l.id+'\')">'
    + '<div class="ldot" style="background:'+dotClr+'"></div>'
    + '<div class="lid">'+l.id+'</div>'
    + '<div class="lpr">'+(isInt ? 'Uso interno' : fCOP(lp(l)))+'</div>'
    + '<div class="lar">'+l.area+'m²</div>'
    + (l.buyer ? '<div class="lbuy">'+l.buyer+'</div>' : '')
    + pvs + intB + '</div>';
}

function rLotes() {
  /* A=19 cedida, B=18, C=18, D=18, E=5 */
  var mz   = ['A','B','C','D','E'];
  var html = '';

  mz.forEach(function(m) {
    var lots = S.lots.filter(function(l){ return l.m===m; })
                     .sort(function(a,b){ return a.n-b.n; });

    /* Manzana A: etiqueta especial "Cedida" */
    var mzLabel = m === 'A'
      ? 'Manzana A <span style="font-size:10px;background:#b71c1c;color:#fff;padding:1px 7px;border-radius:4px;margin-left:6px;vertical-align:middle">Cedida</span>'
      : 'Manzana ' + m;

    /* Grid: E usa lotg3 (pocos lotes), resto lotg (2 columnas) */
    var gridCls = m === 'E' ? 'lotg3' : 'lotg';

    html += '<div class="mz"><div class="mzl"><span>' + mzLabel + '</span>'
          + '<span style="font-size:11px;color:var(--muted)">' + lots.length + ' lotes</span></div>'
          + '<div class="' + gridCls + '">';

    if (m === 'E') {
      /* E: mostrar en fila simple */
      lots.forEach(function(l){ html += lHTML(l); });
    } else {
      /* 2 columnas enfrentadas */
      var mid = Math.ceil(lots.length / 2);
      var Lc  = lots.slice(0, mid), Rc = lots.slice(mid);
      var max = Math.max(Lc.length, Rc.length);
      for (var ii = 0; ii < max; ii++) {
        html += (Lc[ii] ? lHTML(Lc[ii]) : '<div></div>');
        html += (Rc[ii] ? lHTML(Rc[ii]) : '<div></div>');
      }
    }
    html += '</div></div>';
  });

  G('lotGrid').innerHTML = html;

  /* Estadísticas — excluir internos del conteo comercial */
  var sale = S.lots.filter(function(l){ return l.type !== 'internal'; });
  var intL = S.lots.filter(function(l){ return l.type === 'internal'; });
  var sold = sale.filter(function(l){ return l.status === 'sold'; });
  var apt  = sale.filter(function(l){ return l.status === 'apartado'; });
  var av   = sale.filter(function(l){ return l.status === 'available'; });
  var sRev = 0; sold.forEach(function(l){ sRev += lp(l); });
  var aptR = 0; apt.forEach(function(l){  aptR += lp(l); });

  G('lotSt').textContent = av.length+' disponibles · '+apt.length+' apartados · '+sold.length+' vendidos · '+intL.length+' uso interno';

  G('stAvail').innerHTML = '<div style="font-size:28px;font-weight:900;color:#1565C0">'+av.length+'</div>'
    + '<div style="font-size:11px;color:var(--muted);margin-top:4px">'
    + av.filter(function(l){ return l.type==='plus';     }).length+' plus · '
    + av.filter(function(l){ return l.type==='standard'; }).length+' std</div>';
  G('stApt').innerHTML  = '<div style="font-size:28px;font-weight:900;color:#E65100">'+apt.length+'</div>'
    + '<div style="font-size:11px;color:var(--muted);margin-top:4px">'+fCOP(aptR)+' en proceso</div>';
  G('stSold').innerHTML = '<div style="font-size:28px;font-weight:900;color:#1B5E20">'+sold.length+'</div>'
    + '<div style="font-size:11px;color:var(--muted);margin-top:4px">'+fCOP(sRev)+' recaudado</div>';
}

/* ── Modal editar lote ─────────────────────────── */
var eLotId = null;

function oLot(id) {
  var l = S.lots.find(function(x){ return x.id===id; });
  if (!l) return;
  eLotId = id;
  G('lmT').textContent = 'Editar — Lote '+id+(l.type==='internal'?' (Uso Interno)':'');

  var tOpts = ['plus','standard','internal'].map(function(v){
    return '<option value="'+v+'"'+(l.type===v?' selected':'')+'>'+v+'</option>';
  }).join('');

  var sOpts = ['available','apartado','sold'].map(function(v){
    return '<option value="'+v+'"'+(l.status===v?' selected':'')+'>'+v+'</option>';
  }).join('');

  var isInt   = l.type === 'internal';
  var intNote = isInt
    ? '<div class="al al-i" style="margin-bottom:10px;font-size:11px">🏢 Lote de uso interno — puede tener estado, precio y datos de propietario.</div>' : '';

  G('lmB').innerHTML = intNote
    + '<label class="fl">Número de lote</label>'
    + '<input type="number" id="m_n" value="'+l.n+'" min="1" max="99" step="1">'
    + '<label class="fl">Tipo</label><select id="m_t">'+tOpts+'</select>'
    + '<label class="fl">Área (m²) — acepta decimales</label>'
    + '<input type="number" id="m_a" value="'+l.area+'" min="50" max="500" step="0.01">'
    + '<label class="fl">Precio fijo M COP (0 = precio base automático)</label>'
    + '<input type="number" id="m_p" value="'+(l.fp||0)+'" min="0" max="500" step="0.5">'
    + '<label class="fl">Estado</label><select id="m_s">'+sOpts+'</select>'
    + '<label class="fl">'+(isInt?'Propietario / Responsable':'Comprador')+'</label>'
    + '<input type="text" id="m_b" value="'+(l.buyer||'')+'">'
    + '<label class="fl">Cédula / NIT</label><input type="text" id="m_cc" value="'+(l.cc||'')+'">'
    + '<label class="fl">Teléfono</label><input type="tel" id="m_ph" value="'+(l.phone||'')+'">'
    + '<label class="fl">Correo</label><input type="email" id="m_em" value="'+(l.email||'')+'">'
    + '<label class="fl">Dirección</label><input type="text" id="m_ad" value="'+(l.addr||'')+'">'
    + '<label class="fl">Observaciones</label><input type="text" id="m_ob" value="'+(l.obs||'')+'">';
  G('lotMod').style.display = 'flex';
}

function savLot() {
  var l = S.lots.find(function(x){ return x.id===eLotId; });
  if (!l) return;

  var newN  = parseInt(G('m_n').value) || l.n;
  var pad   = newN < 10 ? '0'+newN : ''+newN;
  var newId = l.m + pad;

  var dup = S.lots.find(function(x){ return x.id===newId && x.id!==eLotId; });
  if (dup) { alert('Ya existe el lote '+newId+'. Elige otro número.'); return; }

  if (newId !== eLotId) {
    if (S.payments) S.payments.forEach(function(p){ if(p.lotId===eLotId) p.lotId=newId; });
    if (S.reservas) S.reservas.forEach(function(r){ if(r.lotId===eLotId) r.lotId=newId; });

    /* ── Migrar linderos al nuevo id ─────────────────────── */
    if (typeof cLinderos !== 'undefined') {
      if (cLinderos[eLotId]) {
        cLinderos[newId] = cLinderos[eLotId];
        delete cLinderos[eLotId];
        saveLinderos(); /* guarda localStorage + dispara push a Supabase */
      }
    }
    /* ── Actualizar lote activo en contratos si coincide ─── */
    if (typeof cActiveLotId !== 'undefined' && cActiveLotId === eLotId) {
      cActiveLotId = newId;
    }
    /* ───────────────────────────────────────────────────── */
  }

  l.n      = newN;
  l.id     = newId;
  l.type   = G('m_t').value;
  l.area   = parseFloat(G('m_a').value) || 98;
  var fp2  = parseFloat(G('m_p').value);
  l.fp     = fp2 > 0 ? fp2 : null;
  l.status = G('m_s').value;
  l.buyer  = G('m_b').value;
  l.cc     = G('m_cc').value;
  l.phone  = G('m_ph').value;
  l.email  = G('m_em').value;
  l.addr   = G('m_ad').value;
  l.obs    = G('m_ob') ? G('m_ob').value : l.obs;
  syncLot(l); saveS(); cLotM(); rAll();
}

function cLotM(e) {
  if (e && e.target !== G('lotMod')) return;
  G('lotMod').style.display = 'none';
  eLotId = null;
}
