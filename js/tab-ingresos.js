/* ═══════════════════════════════════════════════════
   tab-ingresos.js  — Pestaña Ingresos Reales
   Muestra flujo real basado en ventas registradas,
   mes a mes hasta el final del plazo mas largo.
═══════════════════════════════════════════════════ */

function rIngresos() {
  var sold = S.lots.filter(function(l){
    return (l.status === 'sold' || l.status === 'apartado') && l.salePrice > 0;
  });

  if (!sold.length) {
    G('ingresosChart').innerHTML = '<div class="al al-i">No hay ventas registradas aun. Registra ventas en la pestana Venta.</div>';
    G('ingresosKPIs').innerHTML  = '';
    G('ingresosTbl').innerHTML   = '';
    return;
  }

  /* Calcular mes final maxima */
  var maxMo = 0;
  sold.forEach(function(l){
    var dn2   = l.dnAmt > 0 ? l.dnAmt : l.salePrice * (l.dn || 20) / 100;
    var fin   = l.salePrice - dn2;
    var cm2   = l.cmAmt > 0 ? l.cmAmt : ((l.mo || 36) > 0 ? fin / (l.mo || 36) : 0);
    var plazo = cm2 > 0 ? Math.ceil(fin / cm2) : (l.mo || 36);
    var end   = (l.saleMonthIdx || 0) + plazo;
    if (end > maxMo) maxMo = end;
  });
  if (maxMo < 1) maxMo = 60;

  var ciArr = [], cuArr = [], accArr = [], labels = [];
  var cumTotal = 0, totalCI = 0, totalCuotas = 0;

  for (var m = 0; m <= maxMo; m++) {
    var ci = 0, cu = 0;
    sold.forEach(function(l) {
      var sm   = l.saleMonthIdx || 0;
      var dn2  = l.dnAmt > 0 ? l.dnAmt : l.salePrice * (l.dn || 20) / 100;
      var fin  = l.salePrice - dn2;
      var mo2  = l.mo || 36;
      var cm2  = l.cmAmt > 0 ? l.cmAmt : (mo2 > 0 ? fin / mo2 : 0);
      var plazo = cm2 > 0 ? Math.ceil(fin / cm2) : mo2;
      if (m === sm)              { ci += dn2;  totalCI += dn2; }
      else if (m > sm && m <= sm + plazo) { cu += cm2; totalCuotas += cm2; }
    });
    cumTotal += ci + cu;
    ciArr.push(parseFloat(ci.toFixed(2)));
    cuArr.push(parseFloat(cu.toFixed(2)));
    accArr.push(parseFloat(cumTotal.toFixed(2)));
    labels.push('M' + m);
  }

  drawC(G('ingresosChart'), labels, [
    {data:ciArr,  color:'#C8860A', bar:true},
    {data:cuArr,  color:'#2E7D32', fill:true},
    {data:accArr, color:'#1565C0', w:2.5, dash:'5,3'},
  ], 180);

  var totalIngresos = totalCI + totalCuotas;
  G('ingresosKPIs').innerHTML = [
    {l:'Total cuotas iniciales',  v:fCOP(totalCI),       c:'#C8860A'},
    {l:'Total cuotas mensuales',  v:fCOP(totalCuotas),   c:'#2E7D32'},
    {l:'Total ingresos reales',   v:fCOP(totalIngresos), c:'#1565C0'},
  ].map(function(k){
    return '<div class="card" style="border-left:3px solid '+k.c+';margin:0;text-align:center">'
      + '<div style="font-size:17px;font-weight:900;color:'+k.c+'">'+k.v+'</div>'
      + '<div style="font-size:10px;color:var(--muted);margin-top:3px">'+k.l+'</div></div>';
  }).join('');

  var rows = '<thead><tr><th>Mes</th><th>Cuotas Iniciales</th><th>Cuotas Mensuales</th><th>Total Mes</th><th>Acumulado</th></tr></thead><tbody>';
  for (var m2 = 0; m2 <= maxMo; m2++) {
    var ci2 = ciArr[m2]||0, cu2 = cuArr[m2]||0, tot = ci2+cu2, ac = accArr[m2]||0;
    rows += '<tr><td>M'+m2+'</td>'
      + '<td>'+(ci2>0?fCOP(ci2):'-')+'</td>'
      + '<td>'+(cu2>0?fCOP(cu2):'-')+'</td>'
      + '<td>'+fCOP(tot)+'</td>'
      + '<td style="font-weight:700;color:#1565C0">'+fCOP(ac)+'</td></tr>';
  }
  rows += '<tr class="tot"><td>TOTAL</td><td>'+fCOP(totalCI)+'</td><td>'+fCOP(totalCuotas)+'</td><td>'+fCOP(totalIngresos)+'</td><td>'+fCOP(totalIngresos)+'</td></tr>';
  G('ingresosTbl').innerHTML = '<table>' + rows + '</tbody></table>';
}
