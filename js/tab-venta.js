/* ═══════════════════════════════════════════════════
   tab-venta.js  — Pestaña VENTA
   Listado interactivo de lotes + simulador de pago
═══════════════════════════════════════════════════ */

var MAX_MO = 54;

/* ── Helpers de pago ────────────────────────────── */
function pvOk() { return pvUsed() < 10; }

function formatCopField(input) {
  var raw = input.value.replace(/[^0-9]/g, '');
  if (!raw) { input.value = ''; return 0; }
  var n = parseInt(raw, 10) || 0;
  input.value = new Intl.NumberFormat('es-CO').format(n);
  return n / 1e6;
}

function setPay(t) {
  S.cl.pay = t;
  var cs = G('cashSec'), fs = G('finSec');
  if (cs) cs.style.display = (t==='cash') ? 'block' : 'none';
  if (fs) fs.style.display = (t==='fin')  ? 'block' : 'none';
  var bc = G('btnC'), bf = G('btnF');
  if (bc) bc.className = 'tgb'+(t==='cash'?' on':'');
  if (bf) bf.className = 'tgb'+(t==='fin' ?' on':'');
  rVenta();
}

function sPlazo(m, btn) {
  S.cl.mo    = m;
  S.cl.cmAmt = 0;
  document.querySelectorAll('.rb').forEach(function(b){ b.className='rb'; });
  btn.className = 'rb on';
  var cm = G('cm_manual'); if (cm) cm.value = '';
  rVenta();
}

function onCiSlider() {
  S.cl.dn    = parseInt(G('r_ci').value);
  S.cl.dnAmt = 0; S.cl.cmAmt = 0;
  var ci = G('ci_manual'); if (ci) ci.value = '';
  var cm = G('cm_manual'); if (cm) cm.value = '';
  rVenta();
}

function onCiManual() {
  var el = G('ci_manual'); if (!el) return;
  var v  = formatCopField(el);
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
  S.cl.dnAmt = 0; S.cl.cmAmt = 0;
  var ci = G('ci_manual'); if (ci) ci.value = '';
  var cm = G('cm_manual'); if (cm) cm.value = '';
  rVenta();
}

/* ══════════════════════════════════════════════════
   LISTADO INTERACTIVO DE LOTES (reemplaza el plano SVG)
══════════════════════════════════════════════════ */
function rLotList() {
  var el = G('saleMapSvg');
  if (!el) return;
  var manzanas = ['A','B','C','D'];
  var html = '';
  manzanas.forEach(function(mz) {
    var lots = S.lots.filter(function(l){ return l.m===mz; })
                     .sort(function(a,b){ return a.n-b.n; });
    html += '<div style="margin-bottom:14px">'
          + '<div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;'
          + 'letter-spacing:1px;margin-bottom:6px;padding-bottom:4px;border-bottom:2px solid var(--border)">'
          + 'Manzana '+mz+' — '+lots.length+' lotes</div>'
          + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:6px">';
    lots.forEach(function(l) {
      var isInt  = l.type === 'internal';
      var isSel  = l.id === S.cl.lid;
      var isAvail= !isInt && l.status === 'available';
      /* Color de fondo según tipo/estado */
      var bg, border, txtClr;
      if (isSel) {
        bg='#F9A825'; border='#E65100'; txtClr='#1a1a1a';
      } else if (isInt) {
        bg='#E8F5E9'; border='#2E7D32'; txtClr='#2E7D32';
      } else if (l.status==='sold') {
        bg='#1B5E20'; border='#1B5E20'; txtClr='#fff';
      } else if (l.status==='apartado') {
        bg='#FFF3E0'; border='#E65100'; txtClr='#E65100';
      } else if (l.type==='plus') {
        bg='#FFFDE7'; border='#C8860A'; txtClr='#5D4037';
      } else {
        bg='#F5F5F5'; border='#9E9E9E'; txtClr='#424242';
      }
      var cursor = isAvail ? 'pointer' : 'default';
      var opacity = (!isAvail && !isSel) ? '0.65' : '1';
      var badge = isInt
        ? '<span style="font-size:8px;background:#2E7D32;color:#fff;padding:1px 3px;border-radius:2px">INT</span>'
        : (l.status==='sold'?'<span style="font-size:8px">✓</span>'
          : l.status==='apartado'?'<span style="font-size:8px">⏳</span>':'');
      html += '<div onclick="'+(isAvail?'sLot(\''+l.id+'\')':'')
            + '" style="background:'+bg+';border:2px solid '+border+';border-radius:8px;'
            + 'padding:7px 8px;cursor:'+cursor+';opacity:'+opacity+';transition:all .12s;'
            + (isSel?'box-shadow:0 0 0 3px #E65100;transform:scale(1.05);':'')
            + '">'
            + '<div style="font-weight:900;font-size:12px;color:'+txtClr+'">'+l.id+' '+badge+'</div>'
            + '<div style="font-size:10px;color:'+(l.status==='sold'?'#A5D6A7':txtClr)+';opacity:.8">'+l.area+'m²</div>'
            + (isInt?'':
               l.status==='sold'?'<div style="font-size:9px;color:#A5D6A7">'+l.buyer+'</div>':
               l.status==='apartado'?'<div style="font-size:9px;color:#E65100">'+l.buyer+'</div>':
               '<div style="font-size:10px;font-weight:700;color:'+txtClr+'">'+fCOP(lp(l))+'</div>')
            + '</div>';
    });
    html += '</div></div>';
  });
  el.innerHTML = html;
}

/* ══════════════════════════════════════════════════
   RENDER PRINCIPAL
══════════════════════════════════════════════════ */
function rVenta() {
  S.cl.dn = parseInt(G('r_ci') ? G('r_ci').value : 20) || 20;

  var av  = S.lots.filter(function(l){ return l.type!=='internal' && l.status==='available'; });
  var sel = S.cl.lid ? S.lots.find(function(l){ return l.id===S.cl.lid; }) : null;
  if (!sel || (sel.type!=='internal' && sel.status!=='available')) {
    sel = av[0] || null;
    S.cl.lid = sel ? sel.id : null;
  }

  var isInt = sel && sel.type === 'internal';
  var baseP = (!sel||isInt) ? S.cfg.std : lp(sel);
  var isPV  = (S.cl.pay==='cash' && pvOk() && sel && !isInt);
  var fP    = isPV ? parseFloat((baseP*(1-S.cfg.pv/100)).toFixed(1)) : baseP;

  var cPBig = G('cPBig'), cPSub = G('cPSub'), vCi = G('v_ci');
  if (cPBig) cPBig.textContent = isInt ? 'Uso Interno' : (sel ? fCOP(fP) : '— Selecciona un lote —');
  if (cPSub) cPSub.textContent = isInt
    ? 'Lote de uso interno — sin precio comercial'
    : (sel ? (isPV?'PREVENTA — '+S.cfg.pv+'% descuento':'Tipo: '+(sel?sel.type:'')+' · Lote '+sel.id) : '');
  if (vCi)  vCi.textContent = S.cl.dn+'%'+(sel&&!isInt?' = '+fCOP(fP*S.cl.dn/100):'');

  /* Listado interactivo */
  rLotList();

  /* Info lote seleccionado */
  var lpGrid = G('lpGrid');
  if (lpGrid) {
    if (sel && !isInt) {
      lpGrid.innerHTML = '<div style="background:linear-gradient(135deg,var(--g1),var(--g2));'
        + 'border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:12px;margin-top:4px">'
        + '<div style="font-size:24px;font-weight:900;color:var(--gold2)">'+sel.id+'</div>'
        + '<div><div style="color:#fff;font-size:12px;font-weight:700">'
        + sel.type.toUpperCase()+' · '+sel.area+'m² · '+fCOP(fP)+'</div>'
        + '<div style="color:rgba(255,255,255,.65);font-size:11px">'+(isPV?'✨ Precio preventa aplicado':'Clic en otro lote disponible para cambiar')+'</div>'
        + '</div></div>';
    } else if (sel && isInt) {
      lpGrid.innerHTML = '<div class="al al-i" style="margin-top:4px;font-size:11px">🔒 Lote interno seleccionado. Para registrar datos, ve a la pestaña Lotes.</div>';
    } else {
      lpGrid.innerHTML = '<div class="al al-i" style="margin-top:4px;font-size:12px">👆 Haz clic en un lote <b>disponible</b> para seleccionarlo y simular el pago.</div>';
    }
  }

  /* Ocultar simulador si no hay lote o es interno */
  var sc = G('sumCard');
  if (!sel || isInt) { if(sc) sc.style.display='none'; return; }
  if (sc) sc.style.display='block';

  /* Cuota inicial */
  var ciEl     = G('ci_manual');
  var manualCi = ciEl ? parseCopPesos(ciEl.value) : 0;
  var dnAmt    = manualCi>0 ? manualCi : (S.cl.dnAmt>0 ? S.cl.dnAmt : fP*S.cl.dn/100);

  if (S.cl.pay === 'cash') {
    /* CONTADO */
    var pvB = G('pvBadge'), csm = G('cashSum');
    if(pvB) pvB.innerHTML = isPV
      ? '<div class="pvbadge">PREVENTA — '+fCOP(fP)+' ('+pvUsed()+'/10 · '+S.cfg.pv+'% desc)</div>'
      : '<div class="al al-i"><b>Precio contado:</b> '+fCOP(fP)+'</div>';
    if(csm) csm.innerHTML=[
      {v:fCOP(fP), l:'Precio contado'},
      {v:fCOP(fP), l:'En pesos colombianos'},
      {v:isPV?fCOP(baseP-fP)+' ahorrado':'Pago único', l:isPV?'Ahorro preventa':'Sin cuotas'},
    ].map(function(b){return '<div class="pbox"><div class="pbv">'+b.v+'</div><div class="pbl">'+b.l+'</div></div>';}).join('');
    var ps=G('pmtSum'); if(ps) ps.innerHTML='';
    var pt=G('pmtTbl'); if(pt) pt.innerHTML='';
    var fa=G('finAlert'); if(fa) fa.innerHTML='';
  } else {
    /* FINANCIADO */
    var pvB2=G('pvBadge'); if(pvB2) pvB2.innerHTML='';
    var cs2=G('cashSum');  if(cs2)  cs2.innerHTML='';
    var fin = fP - dnAmt;
    var cmEl     = G('cm_manual');
    var manualCm = cmEl ? parseCopPesos(cmEl.value) : 0;
    var mPmt     = manualCm>0 ? manualCm : (S.cl.cmAmt>0 ? S.cl.cmAmt : (S.cl.mo>0 ? fin/S.cl.mo : 0));
    var calcMo   = (mPmt>0&&fin>0) ? Math.ceil(fin/mPmt) : S.cl.mo;
    var faEl     = G('finAlert');
    if (calcMo > MAX_MO) {
      if(faEl) faEl.innerHTML='<div class="al al-r" style="margin-top:8px">⚠️ <b>Plazo '+calcMo+' meses.</b> Máximo '+MAX_MO+'m. Aumenta cuota inicial o mensual.</div>';
      calcMo = MAX_MO;
    } else { if(faEl) faEl.innerHTML=''; }

    var ps2=G('pmtSum');
    if(ps2) ps2.innerHTML=[
      {v:fCOP(fP),    l:'Precio del lote'},
      {v:fCOP(dnAmt), l:'Cuota inicial'},
      {v:fCOP(mPmt),  l:calcMo+' cuotas de'},
    ].map(function(b){return '<div class="pbox"><div class="pbv">'+b.v+'</div><div class="pbl">'+b.l+'</div></div>';}).join('');

    var rows='<thead><tr><th>#</th><th>Fecha</th><th>Cuota mensual</th><th>Saldo</th></tr></thead><tbody>';
    var now2=new Date();
    for(var i=1;i<=calcMo;i++){
      var d=new Date(now2.getFullYear(),now2.getMonth()+i,15);
      var saldo=fin-mPmt*i;
      rows+='<tr'+(i===calcMo?' class="last"':'')+'>'
        +'<td>'+i+'</td>'
        +'<td>'+d.toLocaleDateString('es-CO',{month:'short',year:'numeric'})+'</td>'
        +'<td>'+fCOP(mPmt)+'</td>'
        +'<td>'+fCOP(Math.max(0,saldo))+'</td></tr>';
    }
    var pt2=G('pmtTbl'); if(pt2) pt2.innerHTML='<table>'+rows+'</tbody></table>';
  }
}

/* ── Registrar venta ──────────────────────────── */
function oSale() {
  var l = S.lots.find(function(x){ return x.id===S.cl.lid; });
  if (!l) { alert('Selecciona un lote primero.'); return; }
  if (l.type==='internal') { alert('Los lotes internos se gestionan en la pestaña Lotes.'); return; }
 
  var isPV2  = S.cl.pay==='cash' && pvOk();
  var fP2    = isPV2 ? parseFloat((lp(l)*(1-S.cfg.pv/100)).toFixed(1)) : lp(l);
  var manCI2 = parseCopPesos(G('ci_manual')?G('ci_manual').value:'');
  var dnAmt2 = manCI2>0?manCI2:(S.cl.dnAmt>0?S.cl.dnAmt:fP2*S.cl.dn/100);
  var manCM2 = parseCopPesos(G('cm_manual')?G('cm_manual').value:'');
  var fin2   = fP2-dnAmt2;
  var mPmt2  = manCM2>0?manCM2:(S.cl.cmAmt>0?S.cl.cmAmt:(S.cl.mo>0?fin2/S.cl.mo:0));
  var calcMo2= (mPmt2>0&&fin2>0)?Math.ceil(fin2/mPmt2):S.cl.mo;
  var payDesc= S.cl.pay==='cash'?(isPV2?'Contado Preventa':'Contado'):'Financiado '+S.cl.mo+'m';
 
  G('smB').innerHTML=
    '<div class="al al-i" style="margin-bottom:12px"><b>Lote '+l.id+'</b> — '+fCOP(fP2)+' — '+payDesc+'</div>'
    +(calcMo2>MAX_MO?'<div class="al al-r" style="margin-bottom:10px">⚠️ Plazo supera '+MAX_MO+'m.</div>':'')
 
    // ── Campos existentes ──
    +'<label class="fl">Género *</label>'
    +'<select id="sm_gen">'
    +'<option value=""'+(!l.gender?'selected':'')+'>— Seleccionar —</option>'
    +'<option value="M"'+(l.gender==='M'?'selected':'')+'>Masculino — EL PROMITENTE COMPRADOR</option>'
    +'<option value="F"'+(l.gender==='F'?'selected':'')+'>Femenino — LA PROMITENTE COMPRADORA</option>'
    +'</select>'
    +'<label class="fl">Nombre completo *</label><input type="text" id="sm_b" value="'+(l.buyer||'')+'">'
    +'<label class="fl">Cédula / NIT *</label><input type="text" id="sm_cc" value="'+(l.cc||'')+'">'
 
    // ── NUEVO: Ciudad de expedición de la cédula ──
    +'<label class="fl">Ciudad de expedición de la cédula *</label>'
    +'<input type="text" id="sm_ccity" placeholder="Ej: Bogotá" value="'+(l.ccCity||'')+'">'
 
    +'<label class="fl">Teléfono / Celular *</label><input type="tel" id="sm_ph" value="'+(l.phone||'')+'">'
    +'<label class="fl">Correo electrónico</label><input type="email" id="sm_em" value="'+(l.email||'')+'">'
 
    // ── NUEVO: Estado civil ──
    +'<label class="fl">Estado civil</label>'
    +'<select id="sm_mc">'
    +'<option value=""'+((!l.marital)?'selected':'')+'>— Seleccionar —</option>'
    +'<option value="soltero/a"'+(l.marital==='soltero/a'?'selected':'')+'>Soltero/a</option>'
    +'<option value="casado/a"'+(l.marital==='casado/a'?'selected':'')+'>Casado/a</option>'
    +'<option value="unión libre"'+(l.marital==='unión libre'?'selected':'')+'>Unión libre</option>'
    +'<option value="divorciado/a"'+(l.marital==='divorciado/a'?'selected':'')+'>Divorciado/a</option>'
    +'<option value="viudo/a"'+(l.marital==='viudo/a'?'selected':'')+'>Viudo/a</option>'
    +'</select>'
 
    // ── NUEVO: Ciudad de domicilio ──
    +'<label class="fl">Ciudad de domicilio</label>'
    +'<input type="text" id="sm_city" placeholder="Ej: Florencia" value="'+(l.city||'')+'">'
 
    +'<label class="fl">Dirección</label><input type="text" id="sm_ad" value="'+(l.addr||'')+'">'
 
    // ── NUEVO: Nacionalidad ──
    +'<label class="fl">Nacionalidad</label>'
    +'<select id="sm_nat">'
    +'<option value="colombiana"'+((!l.nationality||l.nationality==='colombiana')?'selected':'')+'>Colombiana</option>'
    +'<option value="venezolana"'+(l.nationality==='venezolana'?'selected':'')+'>Venezolana</option>'
    +'<option value="ecuatoriana"'+(l.nationality==='ecuatoriana'?'selected':'')+'>Ecuatoriana</option>'
    +'<option value="peruana"'+(l.nationality==='peruana'?'selected':'')+'>Peruana</option>'
    +'<option value="estadounidense"'+(l.nationality==='estadounidense'?'selected':'')+'>Estadounidense</option>'
    +'<option value="otra">Otra</option>'
    +'</select>'
 
    // ── Campos existentes ──
    +'<label class="fl">Estado</label>'
    +'<select id="sm_st"><option value="apartado"'+(l.status==='apartado'?'selected':'')+'>Apartado</option>'
    +'<option value="sold"'+(l.status==='sold'?'selected':'')+'>Vendido</option></select>'
    +'<label class="fl">Mes del proyecto (0 = ahora)</label>'
    +'<input type="number" id="sm_mo" value="'+(l.saleMonthIdx||0)+'" min="0" max="60">'
    +'<label class="fl">Observaciones</label><input type="text" id="sm_ob" value="'+(l.obs||'')+'">';
 
  G('saleMod').style.display='flex';
}

function savSale() {
  var b   = G('sm_b').value.trim();
  var cc  = G('sm_cc').value.trim();
  var ph  = G('sm_ph').value.trim();
  if(!b||!cc||!ph){ alert('Nombre, cédula y teléfono son obligatorios.'); return; }
 
  var l = S.lots.find(function(x){ return x.id===S.cl.lid; });
  if(!l) return;
 
  var isPV3  = S.cl.pay==='cash'&&pvOk();
  var fP3    = isPV3?parseFloat((lp(l)*(1-S.cfg.pv/100)).toFixed(1)):lp(l);
  var manCI3 = parseCopPesos(G('ci_manual')?G('ci_manual').value:'');
  var dnAmt3 = manCI3>0?manCI3:(S.cl.dnAmt>0?S.cl.dnAmt:fP3*S.cl.dn/100);
  var cmAmt3 = parseCopPesos(G('cm_manual')?G('cm_manual').value:'');
  if (!cmAmt3 && S.cl.cmAmt>0) cmAmt3=S.cl.cmAmt;
 
  // ── Guardar todos los campos (existentes + nuevos) ──
  l.buyer   = b;
  l.cc      = cc;
  l.phone   = ph;
  l.email   = G('sm_em').value;
  l.addr    = G('sm_ad').value;
 
  // NUEVOS
  l.gender      = G('sm_gen')   ? G('sm_gen').value              : '';
  l.ccCity      = G('sm_ccity') ? G('sm_ccity').value.trim()     : '';
  l.marital     = G('sm_mc')    ? G('sm_mc').value           : '';
  l.city        = G('sm_city')  ? G('sm_city').value.trim()  : '';
  l.nationality = G('sm_nat')   ? G('sm_nat').value          : 'colombiana';
 
  l.status        = G('sm_st').value;
  l.payType       = S.cl.pay;
  l.pv            = isPV3;
  l.dn            = S.cl.dn;
  l.mo            = S.cl.mo;
  l.dnAmt         = dnAmt3;
  l.cmAmt         = cmAmt3;
  l.saleDate      = new Date().toISOString().slice(0,10);
  l.saleMonthIdx  = parseInt(G('sm_mo').value)||0;
  l.obs           = G('sm_ob').value;
  l.salePrice     = fP3;
 
  syncLot(l);
  saveS();
  cSaleM();
  rAll();
}
function cSaleM(e) {
  if(e&&e.target!==G('saleMod')) return;
  G('saleMod').style.display='none';
}

/* ── Imprimir plan de pagos ───────────────────── */
function pPlan() {
  var sel=S.lots.find(function(l){ return l.id===S.cl.lid; });
  var bP2=sel?lp(sel):S.cfg.std;
  var isPV4=S.cl.pay==='cash'&&pvOk()&&!!sel;
  var price2=isPV4?parseFloat((bP2*(1-S.cfg.pv/100)).toFixed(1)):bP2;
  var manCI4=parseCopPesos(G('ci_manual')?G('ci_manual').value:'');
  var dnAmt5=manCI4>0?manCI4:(S.cl.dnAmt>0?S.cl.dnAmt:price2*S.cl.dn/100);
  var fin3=price2-dnAmt5;
  var manCM4=parseCopPesos(G('cm_manual')?G('cm_manual').value:'');
  var mPmt4=manCM4>0?manCM4:(S.cl.cmAmt>0?S.cl.cmAmt:(S.cl.mo>0?fin3/S.cl.mo:0));
  var calcMo3=(mPmt4>0&&fin3>0)?Math.ceil(fin3/mPmt4):S.cl.mo;
  if(calcMo3>MAX_MO)calcMo3=MAX_MO;
  var now3=new Date(), rows3='';
  if(S.cl.pay==='fin'){
    for(var i2=1;i2<=calcMo3;i2++){
      var d2=new Date(now3.getFullYear(),now3.getMonth()+i2,15);
      rows3+='<tr><td>'+i2+'</td><td>'+d2.toLocaleDateString('es-CO',{month:'short',year:'numeric'})+'</td>'
        +'<td>'+fCOP(mPmt4)+'</td><td>'+fCOP(Math.max(0,fin3-mPmt4*i2))+'</td></tr>';
    }
  }
  var w2=window.open('','_blank');
  w2.document.write('<html><head><title>Plan Pagos Araguatos</title>'
    +'<style>body{font-family:Arial;font-size:12px;max-width:620px;margin:20px auto}'
    +'h1{color:#1B5E20}table{width:100%;border-collapse:collapse;margin-top:12px}'
    +'th{background:#1B5E20;color:#fff;padding:7px}td{padding:6px;border-bottom:1px solid #ddd;text-align:center}'
    +'.last td{background:#FFF8E1;font-weight:bold}@media print{@page{margin:1.5cm}}'
    +'</style></head><body>');
  w2.document.write('<h1>Proyecto Araguatos — Plan de Pagos</h1>'
    +'<p>ING3DRECO SAS · NIT 901580047-1 · Florencia, Caquetá<br>Fecha: '+now3.toLocaleDateString('es-CO')+'</p><hr>');
  w2.document.write('<p><b>Lote: '+(sel?sel.id:'-')+'</b> | Mz '+(sel?sel.m:'-')+' | '+(sel?sel.area:98)+'m²'+(isPV4?' | PREVENTA':'')+' | '+S.cl.pay.toUpperCase()+'</p>');
  w2.document.write('<table><tr><td><b>Precio</b></td><td>'+fCOP(price2)+'</td></tr>');
  if(S.cl.pay==='fin'){
    w2.document.write('<tr><td><b>Cuota inicial</b></td><td>'+fCOP(dnAmt5)+'</td></tr>'
      +'<tr><td><b>Financiado</b></td><td>'+fCOP(fin3)+'</td></tr>'
      +'<tr><td><b>Plazo</b></td><td>'+calcMo3+' meses</td></tr>'
      +'<tr style="background:#FFF8E1"><td><b>Cuota mensual</b></td><td><b>'+fCOP(mPmt4)+'</b></td></tr></table>'
      +'<table><thead><tr><th>#</th><th>Fecha</th><th>Cuota</th><th>Saldo</th></tr></thead><tbody>'+rows3+'</tbody></table>');
  } else {
    w2.document.write('<tr><td><b>Modalidad</b></td><td>CONTADO'+(isPV4?' PREVENTA':'')+' </td></tr></table>');
  }
  w2.document.write('<hr><p style="font-size:10px;color:#666">ING3DRECO SAS — Proyecto Araguatos</p></body></html>');
  w2.document.close(); w2.focus();
  setTimeout(function(){ w2.print(); },500);
}

function cpPlan() {
  var sel=S.lots.find(function(l){ return l.id===S.cl.lid; }); if(!sel) return;
  var t2='PLAN DE PAGOS — PROYECTO ARAGUATOS\nING3DRECO SAS\nLote: '+sel.id+' | '+sel.area+'m²\nPrecio: '+fCOP(sel.salePrice||lp(sel));
  if(navigator.clipboard) navigator.clipboard.writeText(t2).then(function(){ alert('Copiado al portapapeles.'); });
}
