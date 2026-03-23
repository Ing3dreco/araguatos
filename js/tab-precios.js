/* ═══════════════════════════════════════════════════
   tab-precios.js  — Precios
   rPrecios()   → abre tab, inicializa sliders desde S.cfg
   _updPrecios() → oninput slider, lee valor y actualiza
═══════════════════════════════════════════════════ */

function rPrecios() {
  /* Inicializar sliders desde S.cfg al abrir la pestaña */
  var rStd=G('r_std'), rPlu=G('r_plu'), rPv=G('r_pv');
  if(rStd) rStd.value = S.cfg.std;
  if(rPlu) rPlu.value = S.cfg.plu;
  if(rPv)  rPv.value  = S.cfg.pv;
  _updPrecios();
}

function _updPrecios() {
  /* Leer sliders → S.cfg */
  var rStd=G('r_std'), rPlu=G('r_plu'), rPv=G('r_pv');
  if(rStd) S.cfg.std = +rStd.value;
  if(rPlu) S.cfg.plu = +rPlu.value;
  if(rPv)  S.cfg.pv  = +rPv.value;
  saveS();

  if(G('v_std')) G('v_std').textContent='$'+S.cfg.std+'M';
  if(G('v_plu')) G('v_plu').textContent='$'+S.cfg.plu+'M';
  if(G('v_pv'))  G('v_pv').textContent =S.cfg.pv+'%';
  if(G('pvCnt')) G('pvCnt').textContent=pvUsed()+'/10';

  var sale  = S.lots.filter(function(l){return l.type!=='internal';});
  var plus  = sale.filter(function(l){return l.type==='plus';});
  var std   = sale.filter(function(l){return l.type==='standard';});
  var pvStd = parseFloat((S.cfg.std*(1-S.cfg.pv/100)).toFixed(1));
  var cupos = 10-pvUsed();

  /* Tabla de tipos */
  var p = G('prTbl');
  if(p) p.innerHTML=[
    {t:'Plus — con precio especial',    n:plus.length,  v:'$'+S.cfg.plu+'M base + fp propio', c:'#C8860A'},
    {t:'Estándar — interior manzana',   n:std.length,   v:fCOP(S.cfg.std),                    c:'#757575'},
    {t:'Preventa contado ('+S.cfg.pv+'% dto)', n:cupos+' cupos', v:fCOP(pvStd),               c:'#1565C0'},
  ].map(function(t){
    return '<div style="border:2px solid '+t.c+';border-radius:9px;padding:11px;margin-bottom:8px;'
      +'display:flex;justify-content:space-between;align-items:center">'
      +'<div><div style="font-weight:900;color:'+t.c+';font-size:13px">'+t.t+'</div>'
      +'<div style="font-size:11px;color:var(--muted)">'+t.n+' lotes</div></div>'
      +'<div style="font-size:18px;font-weight:900;color:'+t.c+'">'+t.v+'</div></div>';
  }).join('');

  /* Proyección */
  var gRev=0; sale.forEach(function(l){gRev+=lp(l);});
  var comm=gRev*CM, cS=sale.length*CPL, nP=gRev-comm-cS;
  var rp=G('revProj');
  if(rp) rp.innerHTML=[
    ['Ingresos brutos', fCOP(gRev),'vg'],
    ['Comisiones 3%',   fCOP(-comm),'vr'],
    ['Ingresos netos',  fCOP(gRev-comm),'vb'],
    ['Costo vendibles', fCOP(-cS),'vr'],
    ['Utilidad neta',  '<b>'+fCOP(nP)+'</b>','va'],
    ['ROI',            '<b>'+Math.round(nP/cS*100)+'%</b>','va'],
  ].map(function(r){return drow(r[0],r[1],r[2]);}).join('');

  /* Lotes Plus con precio individual editable */
  var pl=G('premList');
  if(pl){
    if(!plus.length){pl.innerHTML='<div class="al al-i">No hay lotes Plus.</div>';return;}
    pl.innerHTML='<div class="tw"><table>'
      +'<thead><tr><th>Lote</th><th>Mz</th><th>Área</th><th>Base Plus</th><th>Precio fijo (fp)</th><th>Precio final</th><th></th></tr></thead><tbody>'
      +plus.sort(function(a,b){return a.m<b.m?-1:a.m>b.m?1:a.n-b.n;}).map(function(l){
        return '<tr>'
          +'<td><b>'+l.id+'</b></td><td>'+l.m+'</td><td>'+l.area+'m²</td>'
          +'<td style="color:#aaa">$'+S.cfg.plu+'M</td>'
          +'<td><input type="number" value="'+(l.fp||0)+'" min="0" max="500" step="0.5" '
          +'style="width:75px;padding:4px;border:1.5px solid var(--border);border-radius:5px;font-size:12px;margin:0" '
          +'onchange="updLotFp(\''+l.id+'\',+this.value)"></td>'
          +'<td style="color:#C8860A;font-weight:800">'+fCOP(lp(l))+'</td>'
          +'<td><button class="btn bout bsm" onclick="oLot(\''+l.id+'\')">✏️</button></td>'
          +'</tr>';
      }).join('')
      +'</tbody></table></div>'
      +'<div style="font-size:11px;color:var(--muted);margin-top:5px">fp=0 usa precio base Plus ($'+S.cfg.plu+'M). Pon un valor para un precio fijo propio.</div>';
  }
}

function updLotFp(id,val){
  var l=S.lots.find(function(x){return x.id===id;});
  if(!l)return;
  l.fp=val>0?val:null;
  syncLot(l); saveS(); _updPrecios();
}
