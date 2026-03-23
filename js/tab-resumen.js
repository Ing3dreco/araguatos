/* ═══════════════════════════════════════════════════
   tab-resumen.js  — Pestaña Resumen
═══════════════════════════════════════════════════ */

function rResumen() {
  var sale = S.lots.filter(function(l){ return l.type !== 'internal'; });
  var sold = sale.filter(function(l){ return l.status === 'sold'; });
  var apt  = sale.filter(function(l){ return l.status === 'apartado'; });
  var av   = sale.filter(function(l){ return l.status === 'available'; });
  var gRev = 0; sale.forEach(function(l){ gRev += lp(l); });
  var comm = gRev * CM;
  var cS   = sale.length * CPL;
  var nRev = gRev - comm;
  var nP   = nRev - cS;
  var roi  = cS > 0 ? nP / cS * 100 : 0;
  var sRev = 0; sold.forEach(function(l){ sRev += (l.salePrice || lp(l)); });
  var be   = Math.ceil((cS + comm) / S.cfg.std);

  /* ── KPIs ── */
  var kEl = document.getElementById('kpiGrid');
  if (kEl) kEl.innerHTML = [
    { l:'Inversión total',  v: fM(TL*CPL), s: TL+' lotes × $'+CPL+'M/u', c:'kr' },
    { l:'Ingresos brutos',  v: fM(gRev),   s: sale.length+' lotes vendibles', c:'kg' },
    { l:'Costo operativo',  v: fM(cS+comm),s: 'Vendibles + comisiones 3%', c:'kr' },
    { l:'Utilidad neta',    v: fM(nP),     s: 'Margen '+(nRev>0?(nP/nRev*100).toFixed(1):0)+'%', c:'kgr' },
  ].map(function(k){
    return '<div class="kpi '+k.c+'"><div class="kl">'+k.l+'</div>'
         + '<div class="kv">'+k.v+'</div><div class="ks">'+k.s+'</div></div>';
  }).join('');

  /* ── Costos ── */
  var prem = sale.filter(function(l){ return l.type==='premium'; });
  var plus = sale.filter(function(l){ return l.type==='plus'; });
  var std  = sale.filter(function(l){ return l.type==='standard'; });
  var premR= 0; prem.forEach(function(l){ premR += lp(l); });

  var cEl = document.getElementById('costRows');
  if (cEl) cEl.innerHTML = [
    ['Terreno (contrato)',         fM(1200),            'vr'],
    ['Urbanización + obras',       fM(TL*CPL-1200),     'vr'],
    ['Total 58 lotes',             '<b>'+fM(TL*CPL)+'</b>', 'vr'],
    ['48 lotes vendibles',         fM(cS),              ''],
    ['10 lotes uso interno',       fM(10*CPL),          'vb'],
    ['Comisiones 3%',              fM(comm),            'vr'],
    ['Costo operativo total',      '<b>'+fM(cS+comm)+'</b>', 'vr'],
  ].map(function(r){ return drow(r[0],r[1],r[2]); }).join('');

  /* ── Ingresos ── */
  var rEl = document.getElementById('revRows');
  if (rEl) rEl.innerHTML = [
    [prem.length+' lotes premium',    fM(premR),                  'vg'],
    [plus.length+' lotes plus',       fM(plus.length*S.cfg.plu),  'vg'],
    [std.length+' lotes estándar',    fM(std.length*S.cfg.std),   'vg'],
    ['Ingresos brutos',               '<b>'+fM(gRev)+'</b>',      'vg'],
    ['— Comisiones',                  fM(-comm),                  'vr'],
    ['Ingresos netos',                '<b>'+fM(nRev)+'</b>',      'vb'],
    ['Utilidad neta',                 '<b>'+fM(nP)+'</b>',        'va'],
  ].map(function(r){ return drow(r[0],r[1],r[2]); }).join('');

  /* ── Punto de equilibrio ── */
  var bEl = document.getElementById('beBox');
  if (bEl) bEl.innerHTML =
    '<div class="ct">Punto de equilibrio</div>'
    + '<div class="g3" style="text-align:center;margin-top:6px">'
    + [
        { v: be,                                          l: 'Lotes mínimos' },
        { v: Math.round(be/sale.length*100)+'%',          l: 'Del vendible' },
        { v: fM(cS/sale.length),                          l: 'Costo/lote' },
      ].map(function(b){
        return '<div><div style="font-size:22px;font-weight:900;color:var(--gold)">'+b.v+'</div>'
             + '<div style="font-size:10px;color:var(--muted)">'+b.l+'</div></div>';
      }).join('')
    + '</div>';

  /* ── Estado de ventas ── */
  var sEl = document.getElementById('salesSt');
  if (sEl) sEl.innerHTML = [
    ['Disponibles',          av.length,               'vb'],
    ['Apartados',            apt.length,              'va'],
    ['Vendidos',             sold.length,             'vg'],
    ['% vendido',            Math.round(gRev>0?sRev/gRev*100:0)+'%', 'vg'],
    ['Ingresos realizados',  fCOP(sRev),              'vg'],
    ['Preventas usadas',     pvUsed()+'/10',           'va'],
  ].map(function(r){ return drow(r[0],r[1],r[2]); }).join('');

  /* Header */
  var hs = document.getElementById('hSold');
  if (hs) hs.textContent = sold.length + ' vendidos';
}
