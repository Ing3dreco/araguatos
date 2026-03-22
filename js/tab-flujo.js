/* ═══════════════════════════════════════════════════
   tab-flujo.js  — Pestaña Flujo de Caja (proyeccion)
═══════════════════════════════════════════════════ */

function rFlujo() {
  var vel = S.cfg.vel, adn = S.cfg.adn;
  G('v_vel').textContent = vel + ' lote(s)/mes'; G('r_vel').value = vel;
  G('v_dnf').textContent = adn + '%';            G('r_dnf').value = adn;

  var sale = S.lots.filter(function(l){return l.type !== 'reserved';});
  var sumP = 0; sale.forEach(function(l){sumP += lp(l);});
  var avgP = sumP / sale.length;
  var dn   = avgP * adn / 100, mP = (avgP - dn) / 48;

  var sm = [], cnt = 0;/* ═══════════════════════════════════════════════════
   tab-flujo.js  — Pestaña Flujo de Caja (proyeccion)
═══════════════════════════════════════════════════ */

function rFlujo() {
  /* ── Lee los sliders y actualiza S.cfg ── */
  var rVel = G('r_vel'), rDnf = G('r_dnf');
  var vel  = rVel ? (parseInt(rVel.value) || S.cfg.vel) : S.cfg.vel;
  var adn  = rDnf ? (parseInt(rDnf.value) || S.cfg.adn) : S.cfg.adn;
  S.cfg.vel = vel; S.cfg.adn = adn;

  if (G('v_vel')) { G('v_vel').textContent = vel + ' lote(s)/mes'; }
  if (G('v_dnf')) { G('v_dnf').textContent = adn + '%'; }
  if (rVel) rVel.value = vel;
  if (rDnf) rDnf.value = adn;

  var sale = S.lots.filter(function(l) { return l.type !== 'internal'; });
  var sumP = 0; sale.forEach(function(l) { sumP += lp(l); });
  var avgP = sumP / sale.length;
  var dn   = avgP * adn / 100;
  var mP   = (avgP - dn) / 48;

  /* Simula cuándo se vende cada lote */
  var sm = [], cnt = 0;
  for (var mi = 0; cnt < sale.length && mi <= 60; mi++) {
    var ni = Math.min(vel, sale.length - cnt);
    for (var ji = 0; ji < ni; ji++) sm.push(mi);
    cnt += ni;
  }

  var labels = [], cob = [], pag = [], acc = [], cum = 0;
  for (var m = 0; m <= 60; m++) {
    var tpm = TP[m] || 0, co = 0;
    sm.forEach(function(s) {
      if (s === m) co += dn;
      else if (m > s && m <= s + 48) co += mP;
    });
    cum += co - tpm;
    labels.push('M' + m);
    cob.push(parseFloat(co.toFixed(2)));
    pag.push(parseFloat((-tpm).toFixed(2)));
    acc.push(parseFloat(cum.toFixed(2)));
  }

  drawC(G('flujoC'), labels, [
    { data: cob, color: '#2E7D32', fill: true, w: 1.5 },
    { data: pag, color: '#C62828', w: 1.5 },
    { data: acc, color: '#1565C0', w: 2.5, dash: '6,3' }
  ]);

  var minAcc = Math.min.apply(null, acc);
  var minM   = acc.indexOf(minAcc);
  var beM    = -1;
  for (var bi = 1; bi < acc.length; bi++) {
    if (acc[bi] >= 0) { beM = bi; break; }
  }

  G('flujoCards').innerHTML = [
    { l: 'Deficit maximo',  v: fCOP(minAcc),          s: 'Mes ' + minM,       c: '#C62828' },
    { l: 'Flujo positivo',  v: (beM >= 0 ? 'Mes ' + beM : 'Revisar'), s: 'Punto quiebre', c: '#C8860A' },
    { l: 'Precio promedio', v: fCOP(avgP),             s: 'CI: ' + fCOP(dn),  c: '#1565C0' },
  ].map(function(c) {
    return '<div class="card" style="border-left:3px solid ' + c.c + ';margin:0">'
      + '<div style="font-size:18px;font-weight:900;color:' + c.c + '">' + c.v + '</div>'
      + '<div style="font-size:10px;color:var(--muted);margin-top:2px">' + c.l + '</div>'
      + '<div style="font-size:10px;color:var(--muted)">' + c.s + '</div></div>';
  }).join('');

  var minL = Math.ceil(80 / (avgP * adn / 100)), lok = (minL <= vel * 6);
  G('flujoAl').innerHTML =
    '<div class="al al-i"><b>Mes 0:</b> Arras $20M — capital propio.</div>'
    + '<div class="al ' + (lok ? 'al-ok' : 'al-w') + '"><b>Mes 6:</b> Pago $80M. '
    + (lok
      ? 'Con ' + vel + ' lotes/mes los cobros cubren el pago.'
      : 'Insuficiente — ajustar velocidad o cuota inicial.') + '</div>';

  var rows = '<thead><tr><th>Mes</th><th>Cobros</th><th>Pago terreno</th><th>Flujo mes</th><th>Acumulado</th></tr></thead><tbody>';
  for (var m2 = 0; m2 <= 60; m2++) {
    var tp2 = Math.abs(pag[m2] || 0), ci2 = cob[m2] || 0, net = ci2 - tp2, ac = acc[m2] || 0;
    rows += '<tr><td>M' + m2 + '</td>'
      + '<td>' + fCOP(ci2) + '</td>'
      + '<td>' + (tp2 > 0 ? fCOP(tp2) : '-') + '</td>'
      + '<td style="color:' + (net >= 0 ? '#2E7D32' : '#C62828') + '">' + fCOP(net) + '</td>'
      + '<td style="font-weight:700;color:' + (ac >= 0 ? '#2E7D32' : '#C62828') + '">' + fCOP(ac) + '</td></tr>';
  }
  G('flujoTbl').innerHTML = '<table>' + rows + '</tbody></table>';
}

  for (var mi = 0; cnt < sale.length && /* ═══════════════════════════════════════════════════
   tab-flujo.js  — Pestaña Flujo de Caja (proyeccion)
═══════════════════════════════════════════════════ */

function rFlujo() {
  var vel = S.cfg.vel, adn = S.cfg.adn;
  G('v_vel').textContent = vel + ' lote(s)/mes'; G('r_vel').value = vel;
  G('v_dnf').textContent = adn + '%';            G('r_dnf').value = adn;

  var sale = S.lots.filter(function(l){return l.type !== 'internal';});
  var sumP = 0; sale.forEach(function(l){sumP += lp(l);});
  var avgP = sumP / sale.length;
  var dn   = avgP * adn / 100, mP = (avgP - dn) / 48;

  var sm = [], cnt = 0;
  for (var mi = 0; cnt < sale.length && mi <= 60; mi++) {
    var ni = Math.min(vel, sale.length - cnt);
    for (var ji = 0; ji < ni; ji++) sm.push(mi);
    cnt += ni;
  }

  var labels = [], cob = [], pag = [], acc = [], cum = 0;
  for (var m = 0; m <= 60; m++) {
    var tpm = TP[m] || 0, co = 0;
    sm.forEach(function(s){ if(s===m) co+=dn; else if(m>s&&m<=s+48) co+=mP; });
    cum += co - tpm;
    labels.push('M'+m);
    cob.push(parseFloat(co.toFixed(2)));
    pag.push(parseFloat((-tpm).toFixed(2)));
    acc.push(parseFloat(cum.toFixed(2)));
  }

  drawC(G('flujoC'), labels, [
    {data:cob, color:'#2E7D32', fill:true, w:1.5},
    {data:pag, color:'#C62828', w:1.5},
    {data:acc, color:'#1565C0', w:2.5, dash:'6,3'}
  ]);

  var minAcc = Math.min.apply(null, acc), minM = acc.indexOf(minAcc);
  var beM = -1;
  for (var bi = 1; bi < acc.length; bi++) { if (acc[bi] >= 0) { beM = bi; break; } }

  G('flujoCards').innerHTML = [
    {l:'Deficit maximo',   v:fCOP(minAcc), s:'Mes '+minM,               c:'#C62828'},
    {l:'Flujo positivo',   v:(beM>=0?'Mes '+beM:'Revisar'), s:'Punto quiebre', c:'#C8860A'},
    {l:'Precio promedio',  v:fCOP(avgP),   s:'CI: '+fCOP(dn),           c:'#1565C0'},
  ].map(function(c){
    return '<div class="card" style="border-left:3px solid '+c.c+';margin:0">'
      + '<div style="font-size:18px;font-weight:900;color:'+c.c+'">'+c.v+'</div>'
      + '<div style="font-size:10px;color:var(--muted);margin-top:2px">'+c.l+'</div>'
      + '<div style="font-size:10px;color:var(--muted)">'+c.s+'</div></div>';
  }).join('');

  var minL = Math.ceil(80 / (avgP * adn / 100)), lok = (minL <= vel * 6);
  G('flujoAl').innerHTML =
    '<div class="al al-i"><b>Mes 0:</b> Arras $20M - capital propio.</div>'
    + '<div class="al ' + (lok?'al-ok':'al-w') + '"><b>Mes 6:</b> Pago $80M. '
    + (lok ? 'Con '+vel+' lotes/mes los cobros cubren el pago.' : 'Insuficiente - ajustar velocidad o cuota inicial.') + '</div>';

  var rows = '<thead><tr><th>Mes</th><th>Cobros</th><th>Pago terreno</th><th>Flujo mes</th><th>Acumulado</th></tr></thead><tbody>';
  for (var m2 = 0; m2 <= 60; m2++) {
    var tp2 = Math.abs(pag[m2]||0), ci2 = cob[m2]||0, net = ci2-tp2, ac = acc[m2]||0;
    rows += '<tr><td>M'+m2+'</td><td>'+fCOP(ci2)+'</td><td>'+(tp2>0?fCOP(tp2):'-')+'</td>'
      + '<td style="color:'+(net>=0?'#2E7D32':'#C62828')+'">'+fCOP(net)+'</td>'
      + '<td style="font-weight:700;color:'+(ac>=0?'#2E7D32':'#C62828')+'">'+fCOP(ac)+'</td></tr>';
  }
  G('flujoTbl').innerHTML = '<table>' + rows + '</tbody></table>';
}
mi <= 60; mi++) {
    var ni = Math.min(vel, sale.length - cnt);
    for (var ji = 0; ji < ni; ji++) sm.push(mi);
    cnt += ni;
  }

  var labels = [], cob = [], pag = [], acc = [], cum = 0;
  for (var m = 0; m <= 60; m++) {
    var tpm = TP[m] || 0, co = 0;
    sm.forEach(function(s){ if(s===m) co+=dn; else if(m>s&&m<=s+48) co+=mP; });
    cum += co - tpm;
    labels.push('M'+m);
    cob.push(parseFloat(co.toFixed(2)));
    pag.push(parseFloat((-tpm).toFixed(2)));
    acc.push(parseFloat(cum.toFixed(2)));
  }

  drawC(G('flujoC'), labels, [
    {data:cob, color:'#2E7D32', fill:true, w:1.5},
    {data:pag, color:'#C62828', w:1.5},
    {data:acc, color:'#1565C0', w:2.5, dash:'6,3'}
  ]);

  var minAcc = Math.min.apply(null, acc), minM = acc.indexOf(minAcc);
  var beM = -1;
  for (var bi = 1; bi < acc.length; bi++) { if (acc[bi] >= 0) { beM = bi; break; } }

  G('flujoCards').innerHTML = [
    {l:'Deficit maximo',   v:fCOP(minAcc), s:'Mes '+minM,               c:'#C62828'},
    {l:'Flujo positivo',   v:(beM>=0?'Mes '+beM:'Revisar'), s:'Punto quiebre', c:'#C8860A'},
    {l:'Precio promedio',  v:fCOP(avgP),   s:'CI: '+fCOP(dn),           c:'#1565C0'},
  ].map(function(c){
    return '<div class="card" style="border-left:3px solid '+c.c+';margin:0">'
      + '<div style="font-size:18px;font-weight:900;color:'+c.c+'">'+c.v+'</div>'
      + '<div style="font-size:10px;color:var(--muted);margin-top:2px">'+c.l+'</div>'
      + '<div style="font-size:10px;color:var(--muted)">'+c.s+'</div></div>';
  }).join('');

  var minL = Math.ceil(80 / (avgP * adn / 100)), lok = (minL <= vel * 6);
  G('flujoAl').innerHTML =
    '<div class="al al-i"><b>Mes 0:</b> Arras $20M - capital propio.</div>'
    + '<div class="al ' + (lok?'al-ok':'al-w') + '"><b>Mes 6:</b> Pago $80M. '
    + (lok ? 'Con '+vel+' lotes/mes los cobros cubren el pago.' : 'Insuficiente - ajustar velocidad o cuota inicial.') + '</div>';

  var rows = '<thead><tr><th>Mes</th><th>Cobros</th><th>Pago terreno</th><th>Flujo mes</th><th>Acumulado</th></tr></thead><tbody>';
  for (var m2 = 0; m2 <= 60; m2++) {
    var tp2 = Math.abs(pag[m2]||0), ci2 = cob[m2]||0, net = ci2-tp2, ac = acc[m2]||0;
    rows += '<tr><td>M'+m2+'</td><td>'+fCOP(ci2)+'</td><td>'+(tp2>0?fCOP(tp2):'-')+'</td>'
      + '<td style="color:'+(net>=0?'#2E7D32':'#C62828')+'">'+fCOP(net)+'</td>'
      + '<td style="font-weight:700;color:'+(ac>=0?'#2E7D32':'#C62828')+'">'+fCOP(ac)+'</td></tr>';
  }
  G('flujoTbl').innerHTML = '<table>' + rows + '</tbody></table>';
}
