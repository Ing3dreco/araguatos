/* ═══════════════════════════════════════════════════
   tab-vendedor.js  — Vendedor + gestión de ventas
═══════════════════════════════════════════════════ */

function rVend() {
  var rVv  = G('r_vv'),  rVci = G('r_vci'), rVpl = G('r_vpl');
  var vel  = rVv  ? parseInt(rVv.value)  : S.cfg.vel || 2;
  var dnP  = rVci ? parseInt(rVci.value) : 20;
  var moP  = rVpl ? parseInt(rVpl.value) : 36;
  if(rVv)  { rVv.value=vel;  G('v_vv').textContent=vel+' lote(s)/mes'; }
  if(rVci) { rVci.value=dnP; G('v_vci').textContent=dnP+'%'; }
  if(rVpl) { rVpl.value=moP; G('v_vpl').textContent=moP+' meses'; }

  var sale = S.lots.filter(function(l){ return l.type!=='internal'; });
  var sumP = 0; sale.forEach(function(l){ sumP+=lp(l); });
  var avgP = sumP/sale.length;
  var dn=avgP*dnP/100, mPmt=(avgP-dn)/moP, comm=avgP*CM;

  var vk=G('vKPIs');
  if(vk) vk.innerHTML=[
    {l:'Precio promedio',    v:fCOP(avgP)},
    {l:'Cuota inicial prom', v:fCOP(dn)},
    {l:'Cuota mensual',      v:fCOP(mPmt)},
    {l:'Comisión/lote',      v:fCOP(comm)},
  ].map(function(k){
    return '<div style="background:var(--cream);border-radius:10px;padding:12px;text-align:center;border:1px solid var(--border)">'
      +'<div style="font-size:15px;font-weight:900;color:var(--g1)">'+k.v+'</div>'
      +'<div style="font-size:10px;color:var(--muted);margin-top:3px">'+k.l+'</div></div>';
  }).join('');

  /* Proyección de flujo */
  var sm=[],cnt=0;
  for(var mi=0;cnt<sale.length&&mi<=60;mi++){
    var ni=Math.min(vel,sale.length-cnt);
    for(var ji=0;ji<ni;ji++) sm.push(mi);
    cnt+=ni;
  }
  var labels=[],ci=[],cu=[],ter=[];
  var rows='<thead><tr><th>Mes</th><th>Lotes</th><th>CI</th><th>Cuotas</th><th>Total</th><th>Terreno</th><th>Flujo</th></tr></thead><tbody>';
  for(var m=0;m<=60;m++){
    var ns=0; sm.forEach(function(x){ if(x===m)ns++; });
    var ciV=ns*dn, cuV=0;
    sm.forEach(function(s){ if(m>s&&m<=s+moP)cuV+=mPmt; });
    var tp=TP[m]||0, tot=ciV+cuV, net=tot-tp-tot*CM;
    ci.push(parseFloat(ciV.toFixed(1)));
    cu.push(parseFloat(cuV.toFixed(1)));
    ter.push(parseFloat((-tp).toFixed(1)));
    labels.push('M'+m);
    rows+='<tr><td>M'+m+'</td><td>'+(ns||'-')+'</td>'
      +'<td>'+(ciV>0?fCOP(ciV):'-')+'</td>'
      +'<td>'+(cuV>0?fCOP(cuV):'-')+'</td>'
      +'<td>'+fCOP(tot)+'</td>'
      +'<td>'+(tp>0?fCOP(tp):'-')+'</td>'
      +'<td style="font-weight:700;color:'+(net>=0?'#2E7D32':'#C62828')+'">'+fCOP(net)+'</td></tr>';
  }
  var vt=G('vendTbl'); if(vt) vt.innerHTML='<table>'+rows+'</tbody></table>';
  var vc=G('vendC');   if(vc) drawC(vc,labels,[{data:ci,color:'#C8860A',bar:true},{data:cu,color:'#2E7D32',fill:true},{data:ter,color:'#C62828'}]);

  /* Ventas registradas */
  rSalesReg();
}

/* ══════════════════════════════════════════════════
   VENTAS REGISTRADAS — con gestión/edición
══════════════════════════════════════════════════ */
function rSalesReg() {
  var el=G('salesReg'); if(!el) return;
  var soldL=S.lots.filter(function(l){ return l.status==='sold'||l.status==='apartado'; });
  if(!soldL.length){
    el.innerHTML='<div class="al al-i">No hay ventas registradas aún.</div>'; return;
  }
  var totalV=0; soldL.forEach(function(l){ totalV+=(l.salePrice||lp(l)); });
  el.innerHTML=
    '<div class="al al-ok" style="margin-bottom:10px;font-size:12px">'
    +'<b>'+soldL.length+' venta(s)</b> registrada(s) — Total: <b>'+fCOP(totalV)+'</b>'
    +'</div>'
    +'<div class="tw"><table>'
    +'<thead><tr><th>Lote</th><th>Comprador</th><th>Tel / CC</th><th>Precio</th><th>Modalidad</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>'
    +soldL.map(function(l){
      var pt=l.payType==='cash'?(l.pv?'Contado PV':'Contado'):'Fin.'+l.mo+'m';
      var stBg=l.status==='sold'?'#E8F5E9':'#FFF3E0';
      var stCl=l.status==='sold'?'#1B5E20':'#E65100';
      return '<tr>'
        +'<td><b>'+l.id+'</b><br><small style="color:var(--muted)">Mz '+l.m+' · '+l.area+'m²</small></td>'
        +'<td><b>'+l.buyer+'</b><br><small style="color:var(--muted)">'+l.email+'</small></td>'
        +'<td>'+l.phone+'<br><small style="color:var(--muted)">CC: '+l.cc+'</small></td>'
        +'<td style="font-weight:800;color:var(--g1)">'+fCOP(l.salePrice||lp(l))+'</td>'
        +'<td style="font-size:11px">'+pt+'<br>'+(l.dnAmt>0?'CI: '+fCOP(l.dnAmt):'')+'</td>'
        +'<td style="font-size:11px">'+(l.saleDate||'—')+'</td>'
        +'<td><span style="font-size:10px;padding:3px 8px;border-radius:10px;background:'+stBg+';color:'+stCl+';font-weight:700">'+l.status+'</span></td>'
        +'<td style="white-space:nowrap">'
        +'<button class="btn bout bsm" style="margin-bottom:3px" onclick="editSale(\''+l.id+'\')">✏️ Editar</button><br>'
        +'<button class="btn bred bsm" onclick="cancelSale(\''+l.id+'\')">✕ Anular</button>'
        +'</td>'
        +'</tr>';
    }).join('')
    +'</tbody></table></div>';
}

/* ── Modal editar venta ─────────────────────────── */
var _editSaleId = null;

function editSale(id) {
  var l=S.lots.find(function(x){ return x.id===id; }); if(!l) return;
  _editSaleId = id;
  /* Reutilizamos saleMod */
  G('smB').innerHTML=
    '<div class="al al-i" style="margin-bottom:12px">✏️ Editando venta — <b>Lote '+l.id+'</b> · '+fCOP(l.salePrice||lp(l))+'</div>'
    +'<label class="fl">Nombre completo *</label><input type="text" id="sm_b" value="'+(l.buyer||'')+'">'
    +'<label class="fl">Cédula / NIT *</label><input type="text" id="sm_cc" value="'+(l.cc||'')+'">'
    +'<label class="fl">Teléfono *</label><input type="tel" id="sm_ph" value="'+(l.phone||'')+'">'
    +'<label class="fl">Correo electrónico</label><input type="email" id="sm_em" value="'+(l.email||'')+'">'
    +'<label class="fl">Dirección</label><input type="text" id="sm_ad" value="'+(l.addr||'')+'">'
    +'<label class="fl">Estado</label>'
    +'<select id="sm_st">'
    +'<option value="apartado"'+(l.status==='apartado'?' selected':'')+'>Apartado</option>'
    +'<option value="sold"'+(l.status==='sold'?' selected':'')+'>Vendido</option>'
    +'</select>'
    +'<label class="fl">Precio de venta (M COP)</label>'
    +'<input type="number" id="sm_pr" value="'+(l.salePrice||lp(l))+'" min="0" max="500" step="0.5">'
    +'<label class="fl">Cuota inicial (M COP — 0 = sin cambio)</label>'
    +'<input type="number" id="sm_dn" value="'+(l.dnAmt||0)+'" min="0" max="500" step="0.1">'
    +'<label class="fl">Cuota mensual (M COP — 0 = sin cambio)</label>'
    +'<input type="number" id="sm_cm" value="'+(l.cmAmt||0)+'" min="0" max="100" step="0.1">'
    +'<label class="fl">Plazo (meses)</label>'
    +'<input type="number" id="sm_mo" value="'+(l.mo||36)+'" min="1" max="60">'
    +'<label class="fl">Observaciones</label>'
    +'<input type="text" id="sm_ob" value="'+(l.obs||'')+'">';
  /* Cambiar botón confirm para que llame savEditSale */
  var confirmBtn=G('saleMod').querySelector('button.bg');
  if(confirmBtn) confirmBtn.setAttribute('onclick','savEditSale()');
  G('saleMod').style.display='flex';
}

function savEditSale() {
  var b=G('sm_b').value.trim(), cc=G('sm_cc').value.trim(), ph=G('sm_ph').value.trim();
  if(!b||!cc||!ph){ alert('Nombre, cédula y teléfono son obligatorios.'); return; }
  var l=S.lots.find(function(x){ return x.id===_editSaleId; }); if(!l) return;
  l.buyer  = b;       l.cc     = cc;   l.phone = ph;
  l.email  = G('sm_em').value;
  l.addr   = G('sm_ad').value;
  l.status = G('sm_st').value;
  var pr=parseFloat(G('sm_pr').value); if(pr>0) l.salePrice=pr;
  var dn=parseFloat(G('sm_dn').value); if(dn>0) l.dnAmt=dn;
  var cm=parseFloat(G('sm_cm').value); if(cm>0) l.cmAmt=cm;
  l.mo     = parseInt(G('sm_mo').value)||l.mo;
  l.obs    = G('sm_ob').value;
  _editSaleId=null;
  /* Restaurar botón confirm original */
  var confirmBtn=G('saleMod').querySelector('button.bg');
  if(confirmBtn) confirmBtn.setAttribute('onclick','savSale()');
  syncLot(l); saveS(); cSaleM(); rAll();
}

function cancelSale(id) {
  if(!confirm('¿Anular esta venta? El lote volverá a estar disponible.')) return;
  var l=S.lots.find(function(x){ return x.id===id; }); if(!l) return;
  l.status='available'; l.buyer=''; l.cc=''; l.phone=''; l.email='';
  l.addr=''; l.pv=false; l.saleDate=null; l.salePrice=null;
  l.dnAmt=0; l.cmAmt=0; l.obs='';
  syncLot(l); saveS(); rAll();
}
