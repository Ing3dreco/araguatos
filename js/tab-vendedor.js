/* ═══════════════════════════════════════════════════
   tab-vendedor.js  — Pestaña Vendedor
   Simulacion de ventas y registro de ventas.
═══════════════════════════════════════════════════ */

function rVend() {
  var vel = parseInt(G('r_vv').value);
  var dnP = parseInt(G('r_vci').value);
  var moP = parseInt(G('r_vpl').value);
  G('v_vv').textContent  = vel + ' lote(s)/mes';
  G('v_vci').textContent = dnP + '%';
  G('v_vpl').textContent = moP + ' meses';

  var sale = S.lots.filter(function(l){return l.type !== 'reserved';});
  var sumP = 0; sale.forEach(function(l){sumP += lp(l);});
  var avgP = sumP / sale.length;
  var dn   = avgP * dnP / 100, mPmt = (avgP - dn) / moP, comm = avgP * CM;

  G('vKPIs').innerHTML = [
    {l:'Precio promedio',    v:fCOP(avgP)},
    {l:'Cuota inicial prom', v:fCOP(dn)},
    {l:'Cuota mensual',      v:fCOP(mPmt)},
    {l:'Comision/lote',      v:fCOP(comm)},
  ].map(function(k){
    return '<div style="background:var(--cream);border-radius:10px;padding:12px;text-align:center;border:1px solid var(--border)">'
      + '<div style="font-size:15px;font-weight:900;color:var(--g1)">' + k.v + '</div>'
      + '<div style="font-size:10px;color:var(--muted);margin-top:3px">' + k.l + '</div></div>';
  }).join('');

  var sm = [], cnt = 0;
  for (var mi = 0; cnt < sale.length && mi <= 60; mi++) {
    var ni = Math.min(vel, sale.length - cnt);
    for (var ji = 0; ji < ni; ji++) sm.push(mi);
    cnt += ni;
  }

  var labels = [], ci = [], cu = [], ter = [];
  var rows = '<thead><tr><th>Mes</th><th>Lotes</th><th>CI</th><th>Cuotas</th><th>Total</th><th>Terreno</th><th>Flujo</th></tr></thead><tbody>';
  for (var m = 0; m <= 60; m++) {
    var ns = 0; sm.forEach(function(x){if(x===m)ns++;});
    var ciV = ns * dn, cuV = 0;
    sm.forEach(function(s){ if(m>s && m<=s+moP) cuV+=mPmt; });
    var tp = TP[m] || 0, tot = ciV + cuV, net = tot - tp - tot * CM;
    ci.push(parseFloat(ciV.toFixed(1)));
    cu.push(parseFloat(cuV.toFixed(1)));
    ter.push(parseFloat((-tp).toFixed(1)));
    labels.push('M' + m);
    rows += '<tr><td>M'+m+'</td><td>'+(ns||'-')+'</td>'
      + '<td>'+(ciV>0?fCOP(ciV):'-')+'</td>'
      + '<td>'+(cuV>0?fCOP(cuV):'-')+'</td>'
      + '<td>'+fCOP(tot)+'</td>'
      + '<td>'+(tp>0?fCOP(tp):'-')+'</td>'
      + '<td style="font-weight:700;color:'+(net>=0?'#2E7D32':'#C62828')+'">'+fCOP(net)+'</td></tr>';
  }
  G('vendTbl').innerHTML = '<table>' + rows + '</tbody></table>';
  drawC(G('vendC'), labels, [
    {data:ci,  color:'#C8860A', bar:true},
    {data:cu,  color:'#2E7D32', fill:true},
    {data:ter, color:'#C62828'},
  ]);

  /* Registro de ventas */
  var soldL = S.lots.filter(function(l){return l.status==='sold' || l.status==='apartado';});
  if (soldL.length) {
    G('salesReg').innerHTML = '<div class="tw"><table>'
      + '<thead><tr><th>Lote</th><th>Comprador</th><th>Precio</th><th>Tipo</th><th>Estado</th><th></th></tr></thead><tbody>'
      + soldL.map(function(l){
          var pt = l.payType==='cash' ? (l.pv?'Contado PV':'Contado') : 'Fin.'+l.mo+'m';
          return '<tr><td><b>'+l.id+'</b></td>'
            + '<td>'+l.buyer+'<br><small style="color:var(--muted)">'+l.cc+'</small></td>'
            + '<td>'+fCOP(l.salePrice||lp(l))+'</td>'
            + '<td style="font-size:10px">'+pt+'</td>'
            + '<td><span style="font-size:10px;padding:2px 7px;border-radius:10px;background:'+(l.status==='sold'?'#E8F5E9':'#FFF3E0')+';font-weight:700">'+l.status+'</span></td>'
            + '<td><button class="btn bout bsm" onclick="oMin(\''+l.id+'\')">Minuta</button></td></tr>';
        }).join('')
      + '</tbody></table></div>';
  } else {
    G('salesReg').innerHTML = '<div class="al al-i">No hay ventas registradas aun.</div>';
  }
}
