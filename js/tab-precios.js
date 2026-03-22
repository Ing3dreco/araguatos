/* ═══════════════════════════════════════════════════
   tab-precios.js  — Pestaña Precios
═══════════════════════════════════════════════════ */

function rPrecios() {
  G('v_std').textContent = fCOP(S.cfg.std); G('r_std').value = S.cfg.std;
  G('v_plu').textContent = fCOP(S.cfg.plu); G('r_plu').value = S.cfg.plu;
  G('v_pv').textContent  = S.cfg.pv + '%';  G('r_pv').value  = S.cfg.pv;
  G('pvCnt').textContent = pvUsed() + '/10';

  var sale = S.lots.filter(function(l){return l.type !== 'reserved';});
  var prem = sale.filter(function(l){return l.type === 'premium';});
  var plus = sale.filter(function(l){return l.type === 'plus';});
  var std  = sale.filter(function(l){return l.type === 'standard';});
  var pvStd = S.cfg.std * (1 - S.cfg.pv / 100);/* ═══════════════════════════════════════════════════
   tab-precios.js  — Pestaña Precios
═══════════════════════════════════════════════════ */

function rPrecios() {/* ═══════════════════════════════════════════════════
   tab-precios.js  — Pestaña Precios
═══════════════════════════════════════════════════ */

function rPrecios() {
  G('v_std').textContent = fCOP(S.cfg.std); G('r_std').value = S.cfg.std;
  G('v_plu').textContent = fCOP(S.cfg.plu); G('r_plu').value = S.cfg.plu;
  G('v_pv').textContent  = S.cfg.pv + '%';  G('r_pv').value  = S.cfg.pv;
  G('pvCnt').textContent = pvUsed() + '/10';

  var sale = S.lots.filter(function(l){return l.type !== 'reserved';});
  var prem = sale.filter(function(l){return l.type === 'premium';});
  var plus = sale.filter(function(l){return l.type === 'plus';});
  var std  = sale.filter(function(l){return l.type === 'standard';});
  var pvStd = S.cfg.std * (1 - S.cfg.pv / 100);
  var cupos = 10 - pvUsed();

  G('prTbl').innerHTML = [
    {t:'Premium',                n:prem.length, p:'$70M - $90M',  d:'Precio fijo por ubicacion', c:'#B71C1C'},
    {t:'Plus - via principal',   n:plus.length, p:fCOP(S.cfg.plu),d:'Frente a via principal',    c:'#1A237E'},
    {t:'Estandar - interior',    n:std.length,  p:fCOP(S.cfg.std),d:'98m2 interior de manzana',  c:'#1B5E20'},
    {t:'Preventa contado ('+S.cfg.pv+'% desc)', n:cupos+' cupos', p:fCOP(pvStd), d:'Primeros 10 compradores de contado', c:'#C8860A'},
  ].map(function(t){
    return '<div style="border:2px solid '+t.c+';border-radius:9px;padding:10px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">'
      + '<div><div style="font-weight:900;color:'+t.c+';font-size:13px">'+t.t+'</div>'
      + '<div style="font-size:11px;color:var(--muted)">'+t.d+' - '+t.n+' lotes</div></div>'
      + '<div style="font-size:18px;font-weight:900;color:'+t.c+'">'+t.p+'</div></div>';
  }).join('');

  var gRev = 0; sale.forEach(function(l){gRev += lp(l);});
  var comm = gRev * CM, cS = sale.length * CPL, nP = gRev - comm - cS;

  G('revProj').innerHTML = [
    ['Ingresos brutos',  fCOP(gRev),       'vg'],
    ['Comisiones 3%',    fCOP(-comm),      'vr'],
    ['Ingresos netos',   fCOP(gRev-comm),  'vb'],
    ['Costo vendibles',  fCOP(-cS),        'vr'],
    ['Utilidad neta',   '<b>'+fCOP(nP)+'</b>', 'va'],
    ['ROI',             '<b>'+Math.round(nP/cS*100)+'%</b>', 'va'],
  ].map(function(r){return drow(r[0],r[1],r[2]);}).join('');

  G('premList').innerHTML = '<div class="tw"><table>'
    + '<thead><tr><th>Lote</th><th>Manzana</th><th>Area</th><th>Precio</th><th>Estado</th><th></th></tr></thead><tbody>'
    + prem.sort(function(a,b){return b.fp-a.fp;}).map(function(l){
        return '<tr><td><b>'+l.id+'</b></td><td>'+l.m+'</td><td>'+l.area+'m2</td>'
          + '<td style="color:#B71C1C;font-weight:800">'+fCOP(l.fp)+'</td>'
          + '<td>'+l.status+'</td>'
          + '<td><button class="btn bout bsm" onclick="oLot(\''+l.id+'\')">Editar</button></td></tr>';
      }).join('')
    + '</tbody></table></div>';
}

  G('v_std').textContent = fCOP(S.cfg.std); G('r_std').value = S.cfg.std;
  G('v_plu').textContent = fCOP(S.cfg.plu); G('r_plu').value = S.cfg.plu;
  G('v_pv').textContent  = S.cfg.pv + '%';  G('r_pv').value  = S.cfg.pv;
  G('pvCnt').textContent = pvUsed() + '/10';

  var sale = S.lots.filter(function(l){return l.type !== 'internal';});
  var prem = sale.filter(function(l){return l.type === 'premium';});
  var plus = sale.filter(function(l){return l.type === 'plus';});
  var std  = sale.filter(function(l){return l.type === 'standard';});
  var pvStd = S.cfg.std * (1 - S.cfg.pv / 100);
  var cupos = 10 - pvUsed();

  G('prTbl').innerHTML = [
    {t:'Premium',                n:prem.length, p:'$70M - $90M',  d:'Precio fijo por ubicacion', c:'#B71C1C'},
    {t:'Plus - via principal',   n:plus.length, p:fCOP(S.cfg.plu),d:'Frente a via principal',    c:'#1A237E'},
    {t:'Estandar - interior',    n:std.length,  p:fCOP(S.cfg.std),d:'98m2 interior de manzana',  c:'#1B5E20'},
    {t:'Preventa contado ('+S.cfg.pv+'% desc)', n:cupos+' cupos', p:fCOP(pvStd), d:'Primeros 10 compradores de contado', c:'#C8860A'},
  ].map(function(t){
    return '<div style="border:2px solid '+t.c+';border-radius:9px;padding:10px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">'
      + '<div><div style="font-weight:900;color:'+t.c+';font-size:13px">'+t.t+'</div>'
      + '<div style="font-size:11px;color:var(--muted)">'+t.d+' - '+t.n+' lotes</div></div>'
      + '<div style="font-size:18px;font-weight:900;color:'+t.c+'">'+t.p+'</div></div>';
  }).join('');

  var gRev = 0; sale.forEach(function(l){gRev += lp(l);});
  var comm = gRev * CM, cS = sale.length * CPL, nP = gRev - comm - cS;

  G('revProj').innerHTML = [
    ['Ingresos brutos',  fCOP(gRev),       'vg'],
    ['Comisiones 3%',    fCOP(-comm),      'vr'],
    ['Ingresos netos',   fCOP(gRev-comm),  'vb'],
    ['Costo vendibles',  fCOP(-cS),        'vr'],
    ['Utilidad neta',   '<b>'+fCOP(nP)+'</b>', 'va'],
    ['ROI',             '<b>'+Math.round(nP/cS*100)+'%</b>', 'va'],
  ].map(function(r){return drow(r[0],r[1],r[2]);}).join('');

  G('premList').innerHTML = '<div class="tw"><table>'
    + '<thead><tr><th>Lote</th><th>Manzana</th><th>Area</th><th>Precio</th><th>Estado</th><th></th></tr></thead><tbody>'
    + prem.sort(function(a,b){return b.fp-a.fp;}).map(function(l){
        return '<tr><td><b>'+l.id+'</b></td><td>'+l.m+'</td><td>'+l.area+'m2</td>'
          + '<td style="color:#B71C1C;font-weight:800">'+fCOP(l.fp)+'</td>'
          + '<td>'+l.status+'</td>'
          + '<td><button class="btn bout bsm" onclick="oLot(\''+l.id+'\')">Editar</button></td></tr>';
      }).join('')
    + '</tbody></table></div>';
}

  var cupos = 10 - pvUsed();

  G('prTbl').innerHTML = [
    {t:'Premium',                n:prem.length, p:'$70M - $90M',  d:'Precio fijo por ubicacion', c:'#B71C1C'},
    {t:'Plus - via principal',   n:plus.length, p:fCOP(S.cfg.plu),d:'Frente a via principal',    c:'#1A237E'},
    {t:'Estandar - interior',    n:std.length,  p:fCOP(S.cfg.std),d:'98m2 interior de manzana',  c:'#1B5E20'},
    {t:'Preventa contado ('+S.cfg.pv+'% desc)', n:cupos+' cupos', p:fCOP(pvStd), d:'Primeros 10 compradores de contado', c:'#C8860A'},
  ].map(function(t){
    return '<div style="border:2px solid '+t.c+';border-radius:9px;padding:10px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">'
      + '<div><div style="font-weight:900;color:'+t.c+';font-size:13px">'+t.t+'</div>'
      + '<div style="font-size:11px;color:var(--muted)">'+t.d+' - '+t.n+' lotes</div></div>'
      + '<div style="font-size:18px;font-weight:900;color:'+t.c+'">'+t.p+'</div></div>';
  }).join('');

  var gRev = 0; sale.forEach(function(l){gRev += lp(l);});
  var comm = gRev * CM, cS = sale.length * CPL, nP = gRev - comm - cS;

  G('revProj').innerHTML = [
    ['Ingresos brutos',  fCOP(gRev),       'vg'],
    ['Comisiones 3%',    fCOP(-comm),      'vr'],
    ['Ingresos netos',   fCOP(gRev-comm),  'vb'],
    ['Costo vendibles',  fCOP(-cS),        'vr'],
    ['Utilidad neta',   '<b>'+fCOP(nP)+'</b>', 'va'],
    ['ROI',             '<b>'+Math.round(nP/cS*100)+'%</b>', 'va'],
  ].map(function(r){return drow(r[0],r[1],r[2]);}).join('');

  G('premList').innerHTML = '<div class="tw"><table>'
    + '<thead><tr><th>Lote</th><th>Manzana</th><th>Area</th><th>Precio</th><th>Estado</th><th></th></tr></thead><tbody>'
    + prem.sort(function(a,b){return b.fp-a.fp;}).map(function(l){
        return '<tr><td><b>'+l.id+'</b></td><td>'+l.m+'</td><td>'+l.area+'m2</td>'
          + '<td style="color:#B71C1C;font-weight:800">'+fCOP(l.fp)+'</td>'
          + '<td>'+l.status+'</td>'
          + '<td><button class="btn bout bsm" onclick="oLot(\''+l.id+'\')">Editar</button></td></tr>';
      }).join('')
    + '</tbody></table></div>';
}
