/* ═══════════════════════════════════════════════════
   tab-resumen.js  — Pestaña Resumen
   Modifica rResumen() para cambiar los KPIs
   o las filas de costos/ingresos del resumen.
═══════════════════════════════════════════════════ */

function rResumen() {
  var sale  = S.lots.filter(function(l){return l.type !== 'reserved';});
  var sold  = sale.filter(function(l){return l.status === 'sold';});
  var apt   = sale.filter(function(l){return l.status === 'apartado';});
  var av    = sale.filter(function(l){return l.status === 'available';});
  var gRev  = 0; sale.forEach(function(l){gRev += lp(l);});
  var comm  = gRev * CM, cS = sale.length * CPL;
  var nRev  = gRev - comm, nP = nRev - cS;
  var roi   = cS > 0 ? nP / cS * 100 : 0;/* ═══════════════════════════════════════════════════
   tab-resumen.js  — Pestaña Resumen
   Modifica rResumen() para cambiar los KPIs
   o las filas de costos/ingresos del resumen.
═══════════════════════════════════════════════════ */

function rResumen() {
  var sale  = S.lots.filter(function(l){return l.type !== 'reserved';});
  var sold  = sale.filter(function(l){return l.status === 'sold';});
  var apt   = sale.filter(function(l){return l.status === 'apartado';});
  var av    = sale.filter(function(l){return l.status === 'available';});
  var gRev  = 0; sale.forEach(function(l){gRev += lp(l);});
  var comm  = gRev * CM, cS = sale.length * CPL;
  var nRev  = gRev - comm, nP = nRev - cS;
  var roi   = cS > 0 ? nP / cS * 100 : 0;
  var sRev  = 0; sold.forEach(function(l){sRev += lp(l);});
  var be    = Math.ceil((cS + comm) / S.cfg.std);

  G('kpiGrid').innerHTML = [
    {l:'Inversion total',  v:fM(TL*CPL),  s:TL+' lotes x $'+CPL+'M', c:'kr'},
    {l:'Ingresos brutos',  v:fM(gRev),    s:sale.length+' lotes vendibles', c:'kg'},
    {l:'Utilidad neta',    v:fM(nP),      s:'Margen '+((nRev>0?(nP/nRev*100):0).toFixed(1))+'%', c:'kgr'},
    {l:'ROI del proyecto', v:Math.round(roi)+'%', s:'Sobre costo vendibles', c:''},
  ].map(function(k){
    return '<div class="kpi '+k.c+'"><div class="kl">'+k.l+'</div><div class="kv">'+k.v+'</div><div class="ks">'+k.s+'</div></div>';
  }).join('');

  var prem = sale.filter(function(l){return l.type==='premium';});
  var plus = sale.filter(function(l){return l.type==='plus';});
  var std  = sale.filter(function(l){return l.type==='standard';});
  var premR = 0; prem.forEach(function(l){premR += lp(l);});

  G('costRows').innerHTML = [
    ['Terreno (contrato)',      fM(1200),             'vr'],
    ['Urbanizacion + obras',   fM(TL*CPL-1200),       'vr'],
    ['Total 58 lotes',        '<b>'+fM(TL*CPL)+'</b>','vr'],
    ['48 lotes vendibles',     fM(cS),                ''],
    ['10 lotes reserva',       fM(10*CPL),            'vb'],
    ['Comisiones 3%',          fM(comm),              'vr'],
    ['Costo operativo total', '<b>'+fM(cS+comm)+'</b>','vr'],
  ].map(function(r){return drow(r[0],r[1],r[2]);}).join('');

  G('revRows').innerHTML = [
    [prem.length+' lotes premium',         fM(premR),                    'vg'],
    [plus.length+' lotes plus',            fM(plus.length*S.cfg.plu),    'vg'],
    [std.length+' lotes estandar',         fM(std.length*S.cfg.std),     'vg'],
    ['Ingresos brutos', '<b>'+fM(gRev)+'</b>', 'vg'],
    ['- Comisiones',                       fM(-comm),                    'vr'],
    ['Ingresos netos',  '<b>'+fM(nRev)+'</b>', 'vb'],
    ['Utilidad neta',   '<b>'+fM(nP)+'</b>',   'va'],
  ].map(function(r){return drow(r[0],r[1],r[2]);}).join('');

  G('beBox').innerHTML = '<div class="g3" style="text-align:center">'
    + [{v:be,l:'Lotes minimos'},{v:Math.round(be/sale.length*100)+'%',l:'Del vendible'},{v:fM(cS/sale.length),l:'Costo/lote'}]
      .map(function(b){return '<div><div style="font-size:20px;font-weight:900;color:var(--gold)">'+b.v+'</div><div style="font-size:10px;color:var(--muted)">'+b.l+'</div></div>';})
      .join('') + '</div>';

  G('salesSt').innerHTML = [
    ['Disponibles',        av.length,   'vb'],
    ['Apartados',          apt.length,  'va'],
    ['Vendidos',           sold.length, 'vg'],
    ['% vendido',         Math.round(gRev>0?sRev/gRev*100:0)+'%', 'vg'],
    ['Ingresos realizados', fCOP(sRev), 'vg'],
    ['Preventas usadas',   pvUsed()+'/10', 'va'],
  ].map(function(r){return drow(r[0],r[1],r[2]);}).join('');

  G('hSold').textContent = sold.length + ' vendidos';
}

  var sRev  = 0; sold.forEach(function(l){sRev += lp(l);});/* ═══════════════════════════════════════════════════
   tab-resumen.js  — Pestaña Resumen
   Modifica rResumen() para cambiar los KPIs
   o las filas de costos/ingresos del resumen.
═══════════════════════════════════════════════════ */

function rResumen() {
  var sale  = S.lots.filter(function(l){return l.type !== 'internal';});
  var sold  = sale.filter(function(l){return l.status === 'sold';});
  var apt   = sale.filter(function(l){return l.status === 'apartado';});
  var av    = sale.filter(function(l){return l.status === 'available';});
  var gRev  = 0; sale.forEach(function(l){gRev += lp(l);});
  var comm  = gRev * CM, cS = sale.length * CPL;
  var nRev  = gRev - comm, nP = nRev - cS;
  var roi   = cS > 0 ? nP / cS * 100 : 0;
  var sRev  = 0; sold.forEach(function(l){sRev += lp(l);});
  var be    = Math.ceil((cS + comm) / S.cfg.std);

  G('kpiGrid').innerHTML = [
    {l:'Inversion total',  v:fM(TL*CPL),  s:TL+' lotes x $'+CPL+'M', c:'kr'},
    {l:'Ingresos brutos',  v:fM(gRev),    s:sale.length+' lotes vendibles', c:'kg'},
    {l:'Utilidad neta',    v:fM(nP),      s:'Margen '+((nRev>0?(nP/nRev*100):0).toFixed(1))+'%', c:'kgr'},
    {l:'ROI del proyecto', v:Math.round(roi)+'%', s:'Sobre costo vendibles', c:''},
  ].map(function(k){
    return '<div class="kpi '+k.c+'"><div class="kl">'+k.l+'</div><div class="kv">'+k.v+'</div><div class="ks">'+k.s+'</div></div>';
  }).join('');

  var prem = sale.filter(function(l){return l.type==='premium';});
  var plus = sale.filter(function(l){return l.type==='plus';});
  var std  = sale.filter(function(l){return l.type==='standard';});
  var premR = 0; prem.forEach(function(l){premR += lp(l);});

  G('costRows').innerHTML = [
    ['Terreno (contrato)',      fM(1200),             'vr'],
    ['Urbanizacion + obras',   fM(TL*CPL-1200),       'vr'],
    ['Total 58 lotes',        '<b>'+fM(TL*CPL)+'</b>','vr'],
    ['48 lotes vendibles',     fM(cS),                ''],
    ['10 lotes reserva',       fM(10*CPL),            'vb'],
    ['Comisiones 3%',          fM(comm),              'vr'],
    ['Costo operativo total', '<b>'+fM(cS+comm)+'</b>','vr'],
  ].map(function(r){return drow(r[0],r[1],r[2]);}).join('');

  G('revRows').innerHTML = [
    [prem.length+' lotes premium',         fM(premR),                    'vg'],
    [plus.length+' lotes plus',            fM(plus.length*S.cfg.plu),    'vg'],
    [std.length+' lotes estandar',         fM(std.length*S.cfg.std),     'vg'],
    ['Ingresos brutos', '<b>'+fM(gRev)+'</b>', 'vg'],
    ['- Comisiones',                       fM(-comm),                    'vr'],
    ['Ingresos netos',  '<b>'+fM(nRev)+'</b>', 'vb'],
    ['Utilidad neta',   '<b>'+fM(nP)+'</b>',   'va'],
  ].map(function(r){return drow(r[0],r[1],r[2]);}).join('');

  G('beBox').innerHTML = '<div class="g3" style="text-align:center">'
    + [{v:be,l:'Lotes minimos'},{v:Math.round(be/sale.length*100)+'%',l:'Del vendible'},{v:fM(cS/sale.length),l:'Costo/lote'}]
      .map(function(b){return '<div><div style="font-size:20px;font-weight:900;color:var(--gold)">'+b.v+'</div><div style="font-size:10px;color:var(--muted)">'+b.l+'</div></div>';})
      .join('') + '</div>';

  G('salesSt').innerHTML = [
    ['Disponibles',        av.length,   'vb'],
    ['Apartados',          apt.length,  'va'],
    ['Vendidos',           sold.length, 'vg'],
    ['% vendido',         Math.round(gRev>0?sRev/gRev*100:0)+'%', 'vg'],
    ['Ingresos realizados', fCOP(sRev), 'vg'],
    ['Preventas usadas',   pvUsed()+'/10', 'va'],
  ].map(function(r){return drow(r[0],r[1],r[2]);}).join('');

  G('hSold').textContent = sold.length + ' vendidos';
}

  var be    = Math.ceil((cS + comm) / S.cfg.std);

  G('kpiGrid').innerHTML = [
    {l:'Inversion total',  v:fM(TL*CPL),  s:TL+' lotes x $'+CPL+'M', c:'kr'},
    {l:'Ingresos brutos',  v:fM(gRev),    s:sale.length+' lotes vendibles', c:'kg'},
    {l:'Utilidad neta',    v:fM(nP),      s:'Margen '+((nRev>0?(nP/nRev*100):0).toFixed(1))+'%', c:'kgr'},
    {l:'ROI del proyecto', v:Math.round(roi)+'%', s:'Sobre costo vendibles', c:''},
  ].map(function(k){
    return '<div class="kpi '+k.c+'"><div class="kl">'+k.l+'</div><div class="kv">'+k.v+'</div><div class="ks">'+k.s+'</div></div>';
  }).join('');

  var prem = sale.filter(function(l){return l.type==='premium';});
  var plus = sale.filter(function(l){return l.type==='plus';});
  var std  = sale.filter(function(l){return l.type==='standard';});
  var premR = 0; prem.forEach(function(l){premR += lp(l);});

  G('costRows').innerHTML = [
    ['Terreno (contrato)',      fM(1200),             'vr'],
    ['Urbanizacion + obras',   fM(TL*CPL-1200),       'vr'],
    ['Total 58 lotes',        '<b>'+fM(TL*CPL)+'</b>','vr'],
    ['48 lotes vendibles',     fM(cS),                ''],
    ['10 lotes reserva',       fM(10*CPL),            'vb'],
    ['Comisiones 3%',          fM(comm),              'vr'],
    ['Costo operativo total', '<b>'+fM(cS+comm)+'</b>','vr'],
  ].map(function(r){return drow(r[0],r[1],r[2]);}).join('');

  G('revRows').innerHTML = [
    [prem.length+' lotes premium',         fM(premR),                    'vg'],
    [plus.length+' lotes plus',            fM(plus.length*S.cfg.plu),    'vg'],
    [std.length+' lotes estandar',         fM(std.length*S.cfg.std),     'vg'],
    ['Ingresos brutos', '<b>'+fM(gRev)+'</b>', 'vg'],
    ['- Comisiones',                       fM(-comm),                    'vr'],
    ['Ingresos netos',  '<b>'+fM(nRev)+'</b>', 'vb'],
    ['Utilidad neta',   '<b>'+fM(nP)+'</b>',   'va'],
  ].map(function(r){return drow(r[0],r[1],r[2]);}).join('');

  G('beBox').innerHTML = '<div class="g3" style="text-align:center">'
    + [{v:be,l:'Lotes minimos'},{v:Math.round(be/sale.length*100)+'%',l:'Del vendible'},{v:fM(cS/sale.length),l:'Costo/lote'}]
      .map(function(b){return '<div><div style="font-size:20px;font-weight:900;color:var(--gold)">'+b.v+'</div><div style="font-size:10px;color:var(--muted)">'+b.l+'</div></div>';})
      .join('') + '</div>';

  G('salesSt').innerHTML = [
    ['Disponibles',        av.length,   'vb'],
    ['Apartados',          apt.length,  'va'],
    ['Vendidos',           sold.length, 'vg'],
    ['% vendido',         Math.round(gRev>0?sRev/gRev*100:0)+'%', 'vg'],
    ['Ingresos realizados', fCOP(sRev), 'vg'],
    ['Preventas usadas',   pvUsed()+'/10', 'va'],
  ].map(function(r){return drow(r[0],r[1],r[2]);}).join('');

  G('hSold').textContent = sold.length + ' vendidos';
}
