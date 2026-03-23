/* ═══════════════════════════════════════════════════
   tab-config.js  — Configuración + Supabase
   Auto-sync: saveS() en data.js dispara pushToSupabase()
   Linderos: pushLinderos() / pullLinderos() en tab-contratos.js
═══════════════════════════════════════════════════ */

var SB_URL='', SB_KEY='', SB_CONNECTED=false;

function initConfigPanel(){
  var u=localStorage.getItem('araguatos_sb_url')||'';
  var k=localStorage.getItem('araguatos_sb_key')||'';
  var eu=G('cfg_url'), ek=G('cfg_key');
  if(eu) eu.value=u;
  if(ek) ek.value=k;
  if(u&&k){SB_URL=u;SB_KEY=k;}
}

/* ── Conectar ──────────────────────────────────── */
function connectSupabase(){
  var eu=G('cfg_url'), ek=G('cfg_key');
  SB_URL=(eu?eu.value:'').trim();
  SB_KEY=(ek?ek.value:'').trim();
  if(!SB_URL||!SB_KEY){setConnStatus('error','⚠️ Ingresa la URL y la API Key.');return;}
  localStorage.setItem('araguatos_sb_url',SB_URL);
  localStorage.setItem('araguatos_sb_key',SB_KEY);
  setConnStatus('info','🔄 Conectando con Supabase...');
  /* Verificar que la tabla existe, luego subir */
  fetch(SB_URL+'/rest/v1/lots?limit=1',{
    headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY}
  }).then(function(r){
    if(!r.ok)throw new Error('HTTP '+r.status+'. ¿Creaste la tabla lots con SUPABASE_SETUP.sql?');
    pushToSupabase();
  }).catch(function(e){
    setConnStatus('error','❌ '+e.message);
  });
}

/* ── Subir lotes (upsert) ──────────────────────── */
function pushToSupabase(){
  if(!SB_URL||!SB_KEY) return;
  var payload=S.lots.map(function(l){
    return{id:l.id,m:l.m,n:l.n,type:l.type,area:l.area,fp:l.fp,
      status:l.status,buyer:l.buyer||'',cc:l.cc||'',phone:l.phone||'',
      email:l.email||'',addr:l.addr||'',pay_type:l.payType||'fin',
      dn:l.dn||20,mo:l.mo||36,dn_amt:l.dnAmt||0,cm_amt:l.cmAmt||0,
      pv:l.pv||false,sale_date:l.saleDate||null,sale_price:l.salePrice||null,
      sale_month_idx:l.saleMonthIdx||0,obs:l.obs||''};
  });
  fetch(SB_URL+'/rest/v1/lots',{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Prefer':'resolution=merge-duplicates'},
    body:JSON.stringify(payload)
  }).then(function(r){
    if(r.ok){
      SB_CONNECTED=true; updateConnUI();
      /* También subir linderos si hay */
      if(typeof pushLinderos==='function') pushLinderos();
      var cs=G('connStatus');
      if(cs) setConnStatus('ok','✅ '+S.lots.length+' lotes sincronizados con Supabase.');
    } else {
      r.text().then(function(t){setConnStatus('error','❌ Error: '+t);});
    }
  }).catch(function(e){setConnStatus('error','❌ Red: '+e.message);});
}

/* ── Descargar lotes ───────────────────────────── */
function pullFromSupabase(){
  if(!SB_URL||!SB_KEY){setConnStatus('error','Configura la conexión primero.');return;}
  setConnStatus('info','🔄 Descargando datos...');
  fetch(SB_URL+'/rest/v1/lots?select=*&order=m,n',{
    headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY}
  }).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
  .then(function(data){
    if(!Array.isArray(data)||!data.length){
      setConnStatus('warn','⚠️ Sin datos en Supabase. Usa "Conectar y subir" primero.'); return;
    }
    var base=buildLots();
    data.forEach(function(row){
      var l=base.find(function(x){return x.id===row.id;}); if(!l)return;
      l.type=row.type||l.type; l.area=row.area||l.area; l.fp=row.fp||null;
      l.status=row.status||l.status; l.buyer=row.buyer||''; l.cc=row.cc||'';
      l.phone=row.phone||''; l.email=row.email||''; l.addr=row.addr||'';
      l.payType=row.pay_type||'fin'; l.dn=row.dn||20; l.mo=row.mo||36;
      l.dnAmt=row.dn_amt||0; l.cmAmt=row.cm_amt||0; l.pv=row.pv||false;
      l.saleDate=row.sale_date||null; l.salePrice=row.sale_price||null;
      l.saleMonthIdx=row.sale_month_idx||0; l.obs=row.obs||'';
    });
    S.lots=base; SB_CONNECTED=true; updateConnUI();
    localStorage.setItem('araguatos_v6',JSON.stringify(S));
    /* También descargar linderos */
    if(typeof pullLinderos==='function') pullLinderos();
    rAll();
    setConnStatus('ok','✅ '+data.length+' lotes cargados desde Supabase.');
  }).catch(function(e){setConnStatus('error','❌ '+e.message+'. ¿Existe la tabla lots?');});
}

/* ── Sincronizar un lote individual (auto) ─────── */
function syncLot(l){
  if(!SB_CONNECTED||!SB_URL||!SB_KEY) return;
  fetch(SB_URL+'/rest/v1/lots',{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Prefer':'resolution=merge-duplicates'},
    body:JSON.stringify([{id:l.id,m:l.m,n:l.n,type:l.type,area:l.area,fp:l.fp,
      status:l.status,buyer:l.buyer||'',cc:l.cc||'',phone:l.phone||'',
      email:l.email||'',addr:l.addr||'',pay_type:l.payType||'fin',
      dn:l.dn||20,mo:l.mo||36,dn_amt:l.dnAmt||0,cm_amt:l.cmAmt||0,
      pv:l.pv||false,sale_date:l.saleDate||null,sale_price:l.salePrice||null,
      sale_month_idx:l.saleMonthIdx||0,obs:l.obs||''}])
  }).catch(function(){});
}

/* ── UI ────────────────────────────────────────── */
function setConnStatus(type,msg){
  var el=G('connStatus'); if(!el) return;
  var cls={ok:'al-ok',warn:'al-w',info:'al-i',error:'al-r'}[type]||'al-i';
  el.innerHTML='<div class="al '+cls+'">'+msg+'</div>';
}

function updateConnUI(){
  var el=G('hConn'); if(!el) return;
  if(SB_CONNECTED){el.textContent='☁ Supabase ✓';el.className='hconn ok';}
  else{el.textContent='Local';el.className='hconn loc';}
}

/* ── Exportar ──────────────────────────────────── */
function exportJSON(){
  var blob=new Blob([JSON.stringify(S,null,2)],{type:'application/json'});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='araguatos_backup_'+new Date().toISOString().slice(0,10)+'.json';
  a.click();
}

function exportExcel(){
  var sold=S.lots.filter(function(l){return l.status==='sold'||l.status==='apartado';});
  var hdr='Lote,Manzana,Area m2,Tipo,Estado,Comprador,Cedula,Telefono,Precio M,Modalidad,CI M,CM M,Plazo,Fecha\n';
  var rows=sold.map(function(l){
    var pr=l.salePrice||lp(l);
    var dn=l.dnAmt>0?l.dnAmt:pr*(l.dn||20)/100;
    var fin=pr-dn, mo=l.mo||36;
    var cm=l.cmAmt>0?l.cmAmt:fin/mo;
    return[l.id,l.m,l.area,l.type,l.status,'"'+l.buyer+'"',l.cc,l.phone,
           pr.toFixed(2),l.payType,dn.toFixed(2),cm.toFixed(2),mo,l.saleDate||''].join(',');
  }).join('\n');
  var blob=new Blob(['\ufeff'+hdr+rows],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='araguatos_ventas_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
}

function clearLocal(){
  if(!confirm('¿Borrar TODOS los datos locales? (Supabase no se modifica)')) return;
  localStorage.removeItem('araguatos_v6');
  localStorage.removeItem('araguatos_v5');
  localStorage.removeItem('araguatos_linderos');
  S=defS(); saveS(); rAll();
  setConnStatus('ok','✅ Datos locales borrados y restaurados por defecto.');
}
