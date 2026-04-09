var CTMPL='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';

/* ── Helpers numérico → texto ─────────────────── */
function cn2w(n){
  n=Math.round(n);if(!n)return'CERO';
  var u=['','UN','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE','DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISEIS','DIECISIETE','DIECIOCHO','DIECINUEVE'];
  var d=['','','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA'];
  var c=['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS','SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS'];
  function g(x){if(!x)return'';var s='';if(x>=100){s+=(x===100?'CIEN':c[Math.floor(x/100)])+' ';x%=100;}if(x>=20){s+=d[Math.floor(x/10)]+(x%10?' Y '+u[x%10]:'');}else if(x>0){s+=u[x];}return s.trim();}
  var r='';
  if(n>=1e6){var m=Math.floor(n/1e6);r+=(m===1?'UN MILLON':g(m)+' MILLONES')+' ';n%=1e6;}
  if(n>=1000){var k=Math.floor(n/1000);r+=(k===1?'MIL':g(k)+' MIL')+' ';n%=1000;}
  if(n>0)r+=g(n);return r.trim();
}
function cpText(n){return n?cn2w(n)+' DE PESOS M/CTE':'';}
function caText(m){if(!m)return'';var e=Math.floor(m),dec=Math.round((m-e)*100);return cn2w(e)+' METROS CUADRADOS'+(dec?' CON '+cn2w(dec)+' DECÍMETROS CUADRADOS':'');}
function cfNum(n){return Number(n).toLocaleString('es-CO');}

/* ── Linderos: caché local + Supabase ─────────── */
var cLinderos={};
function loadLinderos(){try{cLinderos=JSON.parse(localStorage.getItem('araguatos_linderos'))||{};}catch(e){cLinderos={};}}
function saveLinderos(){
  localStorage.setItem('araguatos_linderos',JSON.stringify(cLinderos));
  clearTimeout(_lindT);_lindT=setTimeout(pushLinderos,1500);
}
var _lindT=null;
function pushLinderos(){
  if(typeof SB_CONNECTED==='undefined'||!SB_CONNECTED||!SB_URL||!SB_KEY)return;
  var rows=Object.keys(cLinderos).map(function(id){var ln=cLinderos[id];return{lot_id:id,n_dist:ln.nD||'',n_desc:ln.nX||'',s_dist:ln.sD||'',s_desc:ln.sX||'',e_dist:ln.eD||'',e_desc:ln.eX||'',o_dist:ln.oD||'',o_desc:ln.oX||''};});
  if(!rows.length)return;
  fetch(SB_URL+'/rest/v1/lot_linderos',{method:'POST',headers:sbH({'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'}),body:JSON.stringify(rows)}).catch(function(){});
}
function pullLinderos(){
  if(typeof SB_CONNECTED==='undefined'||!SB_CONNECTED||!SB_URL||!SB_KEY)return;
  fetch(SB_URL+'/rest/v1/lot_linderos?select=*',{headers:sbH()}).then(function(r){return r.json();}).then(function(data){if(!Array.isArray(data))return;data.forEach(function(row){cLinderos[row.lot_id]={nD:row.n_dist,nX:row.n_desc,sD:row.s_dist,sX:row.s_desc,eD:row.e_dist,eX:row.e_desc,oD:row.o_dist,oX:row.o_desc};});localStorage.setItem('araguatos_linderos',JSON.stringify(cLinderos));ctRenderList();}).catch(function(){});/* FIX BUG-1: era rContratos() → bucle infinito */
}
function getLind(id){return cLinderos[id]||{nD:'',nX:'',sD:'',sX:'',eD:'',eX:'',oD:'',oX:''};}
var cActiveLotId=null;

function rContratos(){
  loadLinderos();
  if(typeof SB_CONNECTED!=='undefined'&&SB_CONNECTED)pullLinderos();
  var el=document.getElementById('tab-contratos');if(!el)return;
  el.innerHTML='<div style="display:flex;gap:0;min-height:520px">'
    +'<div style="width:230px;min-width:180px;background:#fff;border-right:1px solid var(--border);border-radius:12px 0 0 12px;display:flex;flex-direction:column">'
      +'<div style="padding:10px 12px;background:var(--g1);color:#fff;font-weight:700;font-size:12px;border-radius:12px 0 0 0">58 Lotes — Selecciona</div>'
      +'<div style="padding:7px 9px;border-bottom:1px solid var(--border)"><input type="text" id="ctSearch" placeholder="Buscar lote..." oninput="ctRenderList()" style="width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:5px;font-size:11px;margin:0"></div>'
      +'<div style="height:4px;background:#e0e0e0"><div id="ctFill" style="height:100%;background:var(--g2);width:0%;transition:width .3s"></div></div>'
      +'<div id="ctProgress" style="font-size:10px;text-align:center;color:var(--muted);padding:3px;border-bottom:1px solid var(--border)">0 de 58</div>'
      +'<div id="ctList" style="overflow-y:auto;flex:1;max-height:600px"></div>'
    +'</div>'
    +'<div id="ctContent" style="flex:1;padding:16px;background:#f8f9f8;border-radius:0 12px 12px 0;border:1px solid var(--border);border-left:none">'
      +'<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:300px;color:#999;gap:12px">'
        +'<div style="font-size:48px">📄</div>'
        +'<strong style="color:#666;font-size:14px">Selecciona un lote del panel izquierdo</strong>'
        +'<p style="font-size:12px;text-align:center;max-width:280px">Ingresa los linderos y genera el contrato Word</p>'
      +'</div>'
    +'</div>'
    +'</div>';
  ctRenderList();
}

function ctRenderList(){
  var q=(document.getElementById('ctSearch')?document.getElementById('ctSearch').value:'').toLowerCase();
  var listEl=document.getElementById('ctList');if(!listEl)return;listEl.innerHTML='';
  var mzs=['A','B','C','D','E'],total=0,done=0;
  mzs.forEach(function(mz){
    var mzLots=S.lots.filter(function(l){return l.m===mz;}).sort(function(a,b){return a.n-b.n;});
    var fil=mzLots.filter(function(l){return !q||l.id.toLowerCase().includes(q);});
    if(!fil.length)return;
    total+=mzLots.length;
    var dc=mzLots.filter(function(l){return ctIsOk(l);}).length;done+=dc;
    var hdr=document.createElement('div');
    hdr.style.cssText='padding:5px 10px;background:#f0f4f0;font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:1';
    hdr.innerHTML='Mz. '+mz+' <span style="background:var(--g2);color:#fff;border-radius:10px;padding:1px 6px;font-size:9px">'+dc+'/'+mzLots.length+'</span>';
    listEl.appendChild(hdr);
    fil.forEach(function(l){
      var ok=ctIsOk(l);
      var item=document.createElement('div');
      item.style.cssText='padding:8px 10px;cursor:pointer;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;gap:8px;font-size:11px;transition:background .12s'+(cActiveLotId===l.id?';background:#E8F5E9;border-left:3px solid var(--g2)':'');
      item.onclick=function(){ctSelect(l.id);};
      item.innerHTML='<div style="width:8px;height:8px;border-radius:50%;background:'+(ok?'var(--g2)':'#ccc')+';flex-shrink:0"></div>'
        +'<div><div style="font-weight:800">Lote '+l.id+'</div>'
        +'<div style="font-size:10px;color:var(--muted)">'+l.area+'m² · '+fCOP(lp(l))+(ok?' ✓':'')+'</div></div>';
      listEl.appendChild(item);
    });
  });
  var pct=total>0?Math.round(done/total*100):0;
  var pf=document.getElementById('ctFill');if(pf)pf.style.width=pct+'%';
  var pp=document.getElementById('ctProgress');if(pp)pp.textContent=done+' de '+total+' con linderos';
}
function ctIsOk(l){var ln=getLind(l.id);return !!(ln.nD&&ln.sD&&ln.eD&&ln.oD);}
function ctSelect(id){cActiveLotId=id;var l=S.lots.find(function(x){return x.id===id;});if(!l)return;ctRenderList();ctRenderForm(l);}

function ctRenderForm(l){
  var lind=getLind(l.id),precio=Math.round((l.salePrice||lp(l))*1e6);
  var el=document.getElementById('ctContent');if(!el)return;
  el.innerHTML='<div class="al al-i" style="margin-bottom:12px;font-size:11px">📝 <b>Automático en Word:</b> N° lote, manzana, área, linderos, precio.<br>Resto se completa a mano: comprador, cédula, cuotas, fechas.</div>'
    +'<div class="card" style="margin-bottom:12px"><div class="ct">Datos del Lote</div>'
    +'<div class="g3" style="margin-bottom:12px">'
    +'<div><div class="fl">N° Lote</div><input type="text" value="'+l.n+'" disabled style="background:#f5f5f5"></div>'
    +'<div><div class="fl">Manzana</div><input type="text" value="'+l.m+'" disabled style="background:#f5f5f5"></div>'
    +'<div><div class="fl">Área (m²)</div><input type="text" value="'+l.area+'" disabled style="background:#f5f5f5"></div>'
    +'</div>'
    +'<div style="font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Linderos — distancia y descripción</div>'
    +'<div id="ctLindWrap" style="overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:8px;border:1px solid var(--border);background:#fafafa;padding:8px 6px">'
    +'<div style="display:flex;flex-direction:column;gap:7px;min-width:460px">'
    +ctLindRow('NORTE','nD','nX',lind)+ctLindRow('SUR','sD','sX',lind)
    +ctLindRow('ESTE','eD','eX',lind)+ctLindRow('OESTE','oD','oX',lind)
    +'</div></div>'
    +'</div>'
    +'<div style="background:var(--cream);border:2px solid var(--g2);border-radius:10px;padding:12px;margin-bottom:14px">'
    +'<div class="fl">Precio total del lote</div>'
    +'<div style="font-size:22px;font-weight:900;color:var(--g1);margin:4px 0">'+fCOP(l.salePrice||lp(l))+'</div>'
    +'<div style="font-size:11px;color:var(--muted)">'+cpText(precio)+'</div></div>'
    +'<div style="display:flex;gap:10px;flex-wrap:wrap">'
    +'<button class="btn bg" onclick="ctGenDoc()">📄 Generar Contrato Word (.docx)</button>'
    +'<button class="btn bout bsm" onclick="pushLinderos();ctToast(\'✅ Linderos guardados en Supabase\',\'ok\')">☁️ Guardar linderos ahora</button>'
    +'</div><div id="ctToastEl"></div>';
}
function ctLindRow(label,kD,kX,lind){
  return '<div style="display:grid;grid-template-columns:70px 180px 1fr;gap:7px;align-items:center">'
    +'<div style="font-weight:800;font-size:11px;color:var(--g1);text-align:right;padding-right:4px">'+label+'</div>'
    +'<input type="text" id="ct_'+kD+'" placeholder="Ej: 14.00 metros" value="'+((lind[kD])||'')+'" style="padding:6px 8px;border:1.5px solid var(--border);border-radius:5px;font-size:11px;margin:0" oninput="ctUpd(\''+kD+'\',this.value)">'
    +'<input type="text" id="ct_'+kX+'" placeholder="con lote N° X / vía" value="'+((lind[kX])||'')+'" style="padding:6px 8px;border:1.5px solid var(--border);border-radius:5px;font-size:11px;margin:0" oninput="ctUpd(\''+kX+'\',this.value)">'
    +'</div>';
}
function ctUpd(field,val){
  if(!cActiveLotId)return;
  if(!cLinderos[cActiveLotId])cLinderos[cActiveLotId]={};
  cLinderos[cActiveLotId][field]=val;
  saveLinderos();ctRenderList();
}

/* FIX BUG-2: fusiona runs XML consecutivos sin cambio de formato para que
   los marcadores {{PLACEHOLDER}} que Word haya partido queden en un solo nodo
   de texto y el split/join pueda encontrarlos. */
function ctMergeSimpleRuns(xml){
  /* Itera hasta que no haya más fusiones posibles (handles chains de 3+ runs) */
  var prev;
  do{
    prev=xml;
    /* Patrón: </w:t></w:r> · proofErr opcionales · <w:r><w:t[attrs]>
       → eliminar la unión, dejando el texto unido dentro del primer run */
    xml=xml.replace(/<\/w:t><\/w:r>(?:<w:proofErr[^>]*\/>)*<w:r><w:t(?:\s[^>]*)?>/g,'');
  }while(xml!==prev);
  return xml;
}
async function ctGenDoc(){
  var l=S.lots.find(function(x){return x.id===cActiveLotId;});
  if(!l){alert('Selecciona un lote primero.');return;}
  if(typeof JSZip==='undefined'){alert('JSZip no disponible. Recarga la página.');return;}
  try{
    var lind=getLind(l.id),precio=Math.round((l.salePrice||lp(l))*1e6),area=parseFloat(l.area)||0;
    var bin=atob(CTMPL),bytes=new Uint8Array(bin.length);
    for(var i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    var zip=new JSZip();await zip.loadAsync(bytes);
    /* FIX BUG-3: verificar existencia antes de .async() */
    var docFile=zip.file('word/document.xml');
    if(!docFile)throw new Error('Plantilla inválida: word/document.xml no encontrado.');
    var xml=await docFile.async('string');
    /* FIX BUG-2: Word fragmenta {{MARKER}} en varios runs XML; los fusionamos primero */
    xml=ctMergeSimpleRuns(xml);
    var rep={
      '{{LOTE_NUM}}':String(l.n),'{{MANZANA}}':l.m,
      '{{AREA_TEXTO}}':area?caText(area):'___________________________','{{AREA_M2}}':area?area.toFixed(2):'___',
      '{{NORTE_DIST}}':lind.nD||'___________','{{NORTE_DESC}}':lind.nX||'___________',
      '{{SUR_DIST}}':lind.sD||'___________','{{SUR_DESC}}':lind.sX||'___________',
      '{{ESTE_DIST}}':lind.eD||'___________','{{ESTE_DESC}}':lind.eX||'___________',
      '{{OESTE_DIST}}':lind.oD||'___________','{{OESTE_DESC}}':lind.oX||'___________',
      '{{PRECIO_TEXTO}}':precio?cpText(precio):'___________________________','{{PRECIO_NUM}}':precio?cfNum(precio):'_______________',
      '{{DIR_COMPRADOR}}':'_______________________________','{{CORREO_COMPRADOR}}':'_______________________________','{{TEL_COMPRADOR}}':'_______________',
    };
    for(var k in rep)xml=xml.split(k).join(rep[k]);
    zip.file('word/document.xml',xml);
    var blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE'
    });
    /* Nombre del archivo */
    var fileName = 'COMPRAVENTA Lote No. '+l.n+', Mnz '+l.m+'.docx';
    /* Blob con MIME correcto para Word */
    var wordBlob = new Blob([blob], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
    /* --- MÓVIL: Web Share API (iOS Safari, Android Chrome) --- */
    var isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    if(isMobile && navigator.share && navigator.canShare) {
      var file = new File([wordBlob], fileName, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      if(navigator.canShare({files:[file]})) {
        try {
          await navigator.share({files:[file], title:'Contrato Lote '+l.id});
          return; /* Sale aquí si el share funcionó */
        } catch(shareErr) {
          if(shareErr.name!=='AbortError') console.warn('Share falló, usando descarga:', shareErr);
          /* Si el usuario canceló o falló, cae al fallback de descarga */
        }
      }
    }
    /* --- ESCRITORIO / fallback: descarga clásica --- */
    var url = URL.createObjectURL(wordBlob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  }catch(e){alert('Error al generar: '+e.message);console.error(e);}
}
function ctToast(msg,tipo){
  var el=document.getElementById('ctToastEl');if(!el)return;
  var c=tipo==='ok'?'al-ok':tipo==='err'?'al-r':'al-i';
  el.innerHTML='<div class="al '+c+'" style="margin-top:10px;font-size:12px">'+msg+'</div>';
  setTimeout(function(){el.innerHTML='';},3000);
}
