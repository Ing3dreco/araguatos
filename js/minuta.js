/* ═══════════════════════════════════════════════════
   minuta.js — Template de la minuta de compraventa
   Editar la variable MINUTA_DEFAULT para modificar
   el texto del contrato. Las variables entre {{}}
   se reemplazan automáticamente con datos del comprador.
   VARIABLES DISPONIBLES:
     {{FECHA}} {{COMPRADOR}} {{CC_COMPRADOR}}
     {{TEL_COMPRADOR}} {{EMAIL_COMPRADOR}} {{DIR_COMPRADOR}}
     {{LOTE_ID}} {{MANZANA}} {{AREA}}
     {{PRECIO}} {{PRECIO_LETRAS}}
     {{CUOTA_INICIAL}} {{SALDO_FINANCIADO}}
     {{CUOTA_MENSUAL}} {{PLAZO}}
     {{TIPO_PAGO}} {{PREVENTA}} {{OBSERVACIONES_SECCION}}
═══════════════════════════════════════════════════ *//* ═══════════════════════════════════════════════════
   minuta.js — Template de la minuta de compraventa
   Editar la variable MINUTA_DEFAULT para modificar
   el texto del contrato. Las variables entre {{}}
   se reemplazan automáticamente con datos del comprador.
   VARIABLES DISPONIBLES:
     {{FECHA}} {{COMPRADOR}} {{CC_COMPRADOR}}
     {{TEL_COMPRADOR}} {{EMAIL_COMPRADOR}} {{DIR_COMPRADOR}}
     {{LOTE_ID}} {{MANZANA}} {{AREA}}
     {{PRECIO}} {{PRECIO_LETRAS}}
     {{CUOTA_INICIAL}} {{SALDO_FINANCIADO}}
     {{CUOTA_MENSUAL}} {{PLAZO}}/* ═══════════════════════════════════════════════════
   minuta.js — Template de la minuta de compraventa
   Editar la variable MINUTA_DEFAULT para modificar
   el texto del contrato. Las variables entre {{}}
   se reemplazan automáticamente con datos del comprador.
   VARIABLES DISPONIBLES:
     {{FECHA}} {{COMPRADOR}} {{CC_COMPRADOR}}
     {{TEL_COMPRADOR}} {{EMAIL_COMPRADOR}} {{DIR_COMPRADOR}}
     {{LOTE_ID}} {{MANZANA}} {{AREA}}
     {{PRECIO}} {{PRECIO_LETRAS}}
     {{CUOTA_INICIAL}} {{SALDO_FINANCIADO}}
     {{CUOTA_MENSUAL}} {{PLAZO}}
     {{TIPO_PAGO}} {{PREVENTA}} {{OBSERVACIONES_SECCION}}
═══════════════════════════════════════════════════ */

var MINUTA_DEFAULT = [
  '<h1>PROMESA DE COMPRAVENTA DE LOTE<br>PROYECTO URBANISTICO ARAGUATOS</h1>',
  '<p style="text-align:center;font-size:12px;color:#666">Plan Parcial Mesitas &middot; UAU 6 &middot; Florencia, Caqueta<br>NIT 901580047-1</p>',
  '<p>En la ciudad de Florencia, departamento de Caqueta, el dia {{FECHA}}, comparecen:</p>',
  '<h2>PRIMERA. PARTES</h2>',
  '<p><strong>VENDEDOR:</strong> ING3DRECO SAS, sociedad comercial identificada con NIT 901580047-1, con domicilio en Florencia, Caqueta, representada legalmente por ANDREA LIZETH CABRERA SUESCUN, identificada con C.C. No. 1.127.388.759, en adelante EL VENDEDOR.</p>',
  '<p><strong>COMPRADOR:</strong> {{COMPRADOR}}, identificado(a) con C.C. No. {{CC_COMPRADOR}}{{TEL_COMPRADOR}}{{EMAIL_COMPRADOR}}{{DIR_COMPRADOR}}, en adelante EL COMPRADOR.</p>',
  '<h2>SEGUNDA. OBJETO</h2>',
  '<p>EL VENDEDOR promete vender y EL COMPRADOR promete comprar el <strong>Lote {{LOTE_ID}}</strong>, Manzana {{MANZANA}}, con un area de <strong>{{AREA}} m&sup2;</strong>, ubicado dentro de la Unidad de Actuacion Urbanistica No. 6 (UAU 6) del Plan Parcial Mesitas, adoptado mediante Decreto N&deg;00180 del 16 de abril de 2021 de la Secretaria de Planeacion Municipal de Florencia, el cual se desprende del inmueble de mayor extension identificado con Matricula Inmobiliaria No. 420-133218 de la Oficina de Registro de Instrumentos Publicos de Florencia.</p>',
  '<h2>TERCERA. PRECIO Y FORMA DE PAGO</h2>',
  '<p>El precio total acordado es <strong>{{PRECIO}}</strong> ({{PRECIO_LETRAS}}). {{PREVENTA}}</p>',
  '<p>{{TIPO_PAGO}}</p>',
  '<h2>CUARTA. CLAUSULA PENAL</h2>',
  '<p>En caso de incumplimiento imputable a EL COMPRADOR, EL VENDEDOR podra retener el veinte por ciento (20%) del valor total del contrato a titulo de clausula penal compensatoria. En caso de incumplimiento imputable a EL VENDEDOR, este debera restituir a EL COMPRADOR la totalidad de las sumas recibidas, mas un veinte por ciento (20%) adicional a titulo de pena civil.</p>',
  '<h2>QUINTA. ESCRITURACION</h2>',
  '<p>EL VENDEDOR se obliga a suscribir la escritura publica de compraventa definitiva a favor de EL COMPRADOR una vez este haya cancelado la totalidad del precio pactado y se haya surtido el proceso de subdivision catastral y apertura de matricula inmobiliaria independiente.</p>',
  '<h2>SEXTA. REGIMEN URBANISTICO Y CARGAS</h2>',
  '<p>EL COMPRADOR declara conocer y aceptar que el lote objeto del presente contrato se encuentra dentro del Plan Parcial Mesitas (Decreto N&deg;00180/2021) y que el desarrollo constructivo estara sujeto a las determinantes urbanisticas vigentes, asumiendo las cargas locales proporcionales a su area conforme a los articulos 36 y 37 de la Ley 388 de 1997.</p>',
  '<h2>SEPTIMA. MERITO EJECUTIVO</h2>',
  '<p>Las partes reconocen expresamente que el presente instrumento constituye titulo ejecutivo conforme al Articulo 422 del Codigo General del Proceso, prestando merito ejecutivo para exigir el pago del precio, la firma de la escritura publica, y el cumplimiento de las demas obligaciones aqui pactadas.</p>',
  '{{OBSERVACIONES_SECCION}}',
  '<p style="margin-top:24px">Para constancia, se firma en Florencia, Caqueta, el {{FECHA}}.</p>'
].join('\n');

function buildMinuta(l) {
  var price  = l.salePrice || lp(l);
  var today  = new Date().toLocaleDateString('es-CO', {day:'numeric', month:'long', year:'numeric'});
  var dnAmt  = l.dnAmt > 0 ? l.dnAmt : (l.payType === 'cash' ? price : price * (l.dn || 20) / 100);
  var fin    = price - dnAmt;
  var mo     = l.mo || 36;
  var cmAmt  = l.cmAmt > 0 ? l.cmAmt : (mo > 0 ? fin / mo : 0);
  var calcMo = cmAmt > 0 ? Math.ceil(fin / cmAmt) : mo;

  var tipoPagoTxt = '';
  if (l.payType === 'cash') {
    tipoPagoTxt = 'EL COMPRADOR pagara la totalidad del precio de <strong>' + fCOP(price) + '</strong> de contado a la firma del presente documento.';
  } else {
    tipoPagoTxt = 'EL COMPRADOR pagara: 1) Cuota inicial (' + l.dn + '%): <strong>' + fCOP(dnAmt) + '</strong>, a la firma. '
      + '2) Saldo financiado: <strong>' + fCOP(fin) + '</strong>, en ' + calcMo
      + ' cuotas mensuales de <strong>' + fCOP(cmAmt) + '</strong> pagaderas los dias quince (15) de cada mes.';
  }

  var prevTxt = l.pv
    ? 'EL COMPRADOR recibe el descuento especial de preventa del ' + S.cfg.pv + '%, en calidad de comprador No. ' + pvUsed() + ' de contado, conforme a la politica comercial de ING3DRECO SAS.'
    : '';

  var obsSeccion = l.obs ? '<h2>OBSERVACIONES</h2><p>' + l.obs + '</p>' : '';

  var telStr = l.phone  ? ', celular ' + l.phone  : '';
  var emStr  = l.email  ? ', correo '  + l.email  : '';
  var adStr  = l.addr   ? ', domiciliado en ' + l.addr : '';

  var tpl = localStorage.getItem('araguatos_minuta_tpl') || MINUTA_DEFAULT;
  tpl = tpl.replace(/{{FECHA}}/g,               today);
  tpl = tpl.replace(/{{COMPRADOR}}/g,           l.buyer);
  tpl = tpl.replace(/{{CC_COMPRADOR}}/g,        l.cc);
  tpl = tpl.replace(/{{TEL_COMPRADOR}}/g,       telStr);
  tpl = tpl.replace(/{{EMAIL_COMPRADOR}}/g,     emStr);
  tpl = tpl.replace(/{{DIR_COMPRADOR}}/g,       adStr);
  tpl = tpl.replace(/{{LOTE_ID}}/g,             l.id);
  tpl = tpl.replace(/{{MANZANA}}/g,             l.m);
  tpl = tpl.replace(/{{AREA}}/g,                l.area);
  tpl = tpl.replace(/{{PRECIO}}/g,              fCOP(price));
  tpl = tpl.replace(/{{PRECIO_LETRAS}}/g,       numLetras(price));
  tpl = tpl.replace(/{{CUOTA_INICIAL}}/g,       fCOP(dnAmt));
  tpl = tpl.replace(/{{SALDO_FINANCIADO}}/g,    fCOP(fin));
  tpl = tpl.replace(/{{CUOTA_MENSUAL}}/g,       fCOP(cmAmt));
  tpl = tpl.replace(/{{PLAZO}}/g,               calcMo);
  tpl = tpl.replace(/{{TIPO_PAGO}}/g,           tipoPagoTxt);
  tpl = tpl.replace(/{{PREVENTA}}/g,            prevTxt);
  tpl = tpl.replace(/{{OBSERVACIONES_SECCION}}/g, obsSeccion);
  tpl = tpl.replace(/{{OBSERVACIONES}}/g,       l.obs || '');
  return tpl;
}

function oMin(lid) {
  var l = S.lots.find(function(x){return x.id === lid;});
  if (!l || !l.buyer) { alert('No hay datos de comprador para este lote.'); return; }
  G('minModTitle').textContent = 'Minuta - Lote ' + lid + ' - ' + l.buyer;
  G('minB').innerHTML = '<div class="mnb">' + buildMinuta(l)
    + '<div class="sigb">'
    + '<div class="sigl"><strong>ING3DRECO SAS</strong><br>NIT 901580047-1<br>ANDREA LIZETH CABRERA SUESCUN<br>C.C. 1.127.388.759<br>EL VENDEDOR</div>'
    + '<div class="sigl"><strong>' + l.buyer + '</strong><br>C.C. ' + l.cc + '<br>EL COMPRADOR</div>'
    + '</div></div>';
  G('minMod').style.display = 'flex';
}

function cMinM(e) {
  if (e && e.target !== G('minMod')) return;
  G('minMod').style.display = 'none';
}

function pMin() {
  var c = G('minB').innerHTML;
  var w = window.open('', '_blank');
  w.document.write('<html><head><title>Minuta Araguatos</title>'
    + '<style>body{font-family:Georgia,serif;font-size:13px;line-height:1.8;max-width:720px;margin:30px auto;color:#1a1a1a}'
    + 'h1{font-size:16px;text-align:center;margin-bottom:14px}'
    + 'h2{font-size:13px;font-weight:bold;margin:14px 0 6px;text-decoration:underline}'
    + 'p{margin-bottom:10px;text-align:justify}'
    + '.sigb{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:40px}'
    + '.sigl{border-top:1px solid #333;padding-top:8px;text-align:center;font-size:11px;line-height:1.7}'
    + '@media print{@page{margin:2cm size:letter}}</style></head><body>' + c + '</body></html>');
  w.document.close(); w.focus();
  setTimeout(function(){ w.print(); }, 500);
}

     {{TIPO_PAGO}} {{PREVENTA}} {{OBSERVACIONES_SECCION}}
═══════════════════════════════════════════════════ */

var MINUTA_DEFAULT = [
  '<h1>PROMESA DE COMPRAVENTA DE LOTE<br>PROYECTO URBANISTICO ARAGUATOS</h1>',
  '<p style="text-align:center;font-size:12px;color:#666">Plan Parcial Mesitas &middot; UAU 6 &middot; Florencia, Caqueta<br>NIT 901580047-1</p>',
  '<p>En la ciudad de Florencia, departamento de Caqueta, el dia {{FECHA}}, comparecen:</p>',
  '<h2>PRIMERA. PARTES</h2>',
  '<p><strong>VENDEDOR:</strong> ING3DRECO SAS, sociedad comercial identificada con NIT 901580047-1, con domicilio en Florencia, Caqueta, representada legalmente por ANDREA LIZETH CABRERA SUESCUN, identificada con C.C. No. 1.127.388.759, en adelante EL VENDEDOR.</p>',
  '<p><strong>COMPRADOR:</strong> {{COMPRADOR}}, identificado(a) con C.C. No. {{CC_COMPRADOR}}{{TEL_COMPRADOR}}{{EMAIL_COMPRADOR}}{{DIR_COMPRADOR}}, en adelante EL COMPRADOR.</p>',
  '<h2>SEGUNDA. OBJETO</h2>',
  '<p>EL VENDEDOR promete vender y EL COMPRADOR promete comprar el <strong>Lote {{LOTE_ID}}</strong>, Manzana {{MANZANA}}, con un area de <strong>{{AREA}} m&sup2;</strong>, ubicado dentro de la Unidad de Actuacion Urbanistica No. 6 (UAU 6) del Plan Parcial Mesitas, adoptado mediante Decreto N&deg;00180 del 16 de abril de 2021 de la Secretaria de Planeacion Municipal de Florencia, el cual se desprende del inmueble de mayor extension identificado con Matricula Inmobiliaria No. 420-133218 de la Oficina de Registro de Instrumentos Publicos de Florencia.</p>',
  '<h2>TERCERA. PRECIO Y FORMA DE PAGO</h2>',
  '<p>El precio total acordado es <strong>{{PRECIO}}</strong> ({{PRECIO_LETRAS}}). {{PREVENTA}}</p>',
  '<p>{{TIPO_PAGO}}</p>',
  '<h2>CUARTA. CLAUSULA PENAL</h2>',
  '<p>En caso de incumplimiento imputable a EL COMPRADOR, EL VENDEDOR podra retener el veinte por ciento (20%) del valor total del contrato a titulo de clausula penal compensatoria. En caso de incumplimiento imputable a EL VENDEDOR, este debera restituir a EL COMPRADOR la totalidad de las sumas recibidas, mas un veinte por ciento (20%) adicional a titulo de pena civil.</p>',
  '<h2>QUINTA. ESCRITURACION</h2>',
  '<p>EL VENDEDOR se obliga a suscribir la escritura publica de compraventa definitiva a favor de EL COMPRADOR una vez este haya cancelado la totalidad del precio pactado y se haya surtido el proceso de subdivision catastral y apertura de matricula inmobiliaria independiente.</p>',
  '<h2>SEXTA. REGIMEN URBANISTICO Y CARGAS</h2>',
  '<p>EL COMPRADOR declara conocer y aceptar que el lote objeto del presente contrato se encuentra dentro del Plan Parcial Mesitas (Decreto N&deg;00180/2021) y que el desarrollo constructivo estara sujeto a las determinantes urbanisticas vigentes, asumiendo las cargas locales proporcionales a su area conforme a los articulos 36 y 37 de la Ley 388 de 1997.</p>',
  '<h2>SEPTIMA. MERITO EJECUTIVO</h2>',
  '<p>Las partes reconocen expresamente que el presente instrumento constituye titulo ejecutivo conforme al Articulo 422 del Codigo General del Proceso, prestando merito ejecutivo para exigir el pago del precio, la firma de la escritura publica, y el cumplimiento de las demas obligaciones aqui pactadas.</p>',
  '{{OBSERVACIONES_SECCION}}',
  '<p style="margin-top:24px">Para constancia, se firma en Florencia, Caqueta, el {{FECHA}}.</p>'
].join('\n');

function buildMinuta(l) {
  var price  = l.salePrice || lp(l);
  var today  = new Date().toLocaleDateString('es-CO', {day:'numeric', month:'long', year:'numeric'});
  var dnAmt  = l.dnAmt > 0 ? l.dnAmt : (l.payType === 'cash' ? price : price * (l.dn || 20) / 100);
  var fin    = price - dnAmt;
  var mo     = l.mo || 36;
  var cmAmt  = l.cmAmt > 0 ? l.cmAmt : (mo > 0 ? fin / mo : 0);
  var calcMo = cmAmt > 0 ? Math.ceil(fin / cmAmt) : mo;

  var tipoPagoTxt = '';
  if (l.payType === 'cash') {
    tipoPagoTxt = 'EL COMPRADOR pagara la totalidad del precio de <strong>' + fCOP(price) + '</strong> de contado a la firma del presente documento.';
  } else {
    tipoPagoTxt = 'EL COMPRADOR pagara: 1) Cuota inicial (' + l.dn + '%): <strong>' + fCOP(dnAmt) + '</strong>, a la firma. '
      + '2) Saldo financiado: <strong>' + fCOP(fin) + '</strong>, en ' + calcMo
      + ' cuotas mensuales de <strong>' + fCOP(cmAmt) + '</strong> pagaderas los dias quince (15) de cada mes.';
  }

  var prevTxt = l.pv
    ? 'EL COMPRADOR recibe el descuento especial de preventa del ' + S.cfg.pv + '%, en calidad de comprador No. ' + pvUsed() + ' de contado, conforme a la politica comercial de ING3DRECO SAS.'
    : '';

  var obsSeccion = l.obs ? '<h2>OBSERVACIONES</h2><p>' + l.obs + '</p>' : '';

  var telStr = l.phone  ? ', celular ' + l.phone  : '';
  var emStr  = l.email  ? ', correo '  + l.email  : '';
  var adStr  = l.addr   ? ', domiciliado en ' + l.addr : '';

  var tpl = localStorage.getItem('araguatos_minuta_tpl') || MINUTA_DEFAULT;
  tpl = tpl.replace(/{{FECHA}}/g,               today);
  tpl = tpl.replace(/{{COMPRADOR}}/g,           l.buyer);
  tpl = tpl.replace(/{{CC_COMPRADOR}}/g,        l.cc);
  tpl = tpl.replace(/{{TEL_COMPRADOR}}/g,       telStr);
  tpl = tpl.replace(/{{EMAIL_COMPRADOR}}/g,     emStr);
  tpl = tpl.replace(/{{DIR_COMPRADOR}}/g,       adStr);
  tpl = tpl.replace(/{{LOTE_ID}}/g,             l.id);
  tpl = tpl.replace(/{{MANZANA}}/g,             l.m);
  tpl = tpl.replace(/{{AREA}}/g,                l.area);
  tpl = tpl.replace(/{{PRECIO}}/g,              fCOP(price));
  tpl = tpl.replace(/{{PRECIO_LETRAS}}/g,       numLetras(price));
  tpl = tpl.replace(/{{CUOTA_INICIAL}}/g,       fCOP(dnAmt));
  tpl = tpl.replace(/{{SALDO_FINANCIADO}}/g,    fCOP(fin));
  tpl = tpl.replace(/{{CUOTA_MENSUAL}}/g,       fCOP(cmAmt));
  tpl = tpl.replace(/{{PLAZO}}/g,               calcMo);
  tpl = tpl.replace(/{{TIPO_PAGO}}/g,           tipoPagoTxt);
  tpl = tpl.replace(/{{PREVENTA}}/g,            prevTxt);
  tpl = tpl.replace(/{{OBSERVACIONES_SECCION}}/g, obsSeccion);
  tpl = tpl.replace(/{{OBSERVACIONES}}/g,       l.obs || '');
  return tpl;
}

function oMin(lid) {
  var l = S.lots.find(function(x){return x.id === lid;});
  if (!l || !l.buyer) { alert('No hay datos de comprador para este lote.'); return; }
  G('minModTitle').textContent = 'Minuta - Lote ' + lid + ' - ' + l.buyer;
  G('minB').innerHTML = '<div class="mnb">' + buildMinuta(l)
    + '<div class="sigb">'
    + '<div class="sigl"><strong>ING3DRECO SAS</strong><br>NIT 901580047-1<br>ANDREA LIZETH CABRERA SUESCUN<br>C.C. 1.127.388.759<br>EL VENDEDOR</div>'
    + '<div class="sigl"><strong>' + l.buyer + '</strong><br>C.C. ' + l.cc + '<br>EL COMPRADOR</div>'
    + '</div></div>';
  G('minMod').style.display = 'flex';
}

function cMinM(e) {
  if (e && e.target !== G('minMod')) return;
  G('minMod').style.display = 'none';
}

function pMin() {
  var c = G('minB').innerHTML;
  var w = window.open('', '_blank');
  w.document.write('<html><head><title>Minuta Araguatos</title>'
    + '<style>body{font-family:Georgia,serif;font-size:13px;line-height:1.8;max-width:720px;margin:30px auto;color:#1a1a1a}'
    + 'h1{font-size:16px;text-align:center;margin-bottom:14px}'
    + 'h2{font-size:13px;font-weight:bold;margin:14px 0 6px;text-decoration:underline}'
    + 'p{margin-bottom:10px;text-align:justify}'
    + '.sigb{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:40px}'
    + '.sigl{border-top:1px solid #333;padding-top:8px;text-align:center;font-size:11px;line-height:1.7}'
    + '@media print{@page{margin:2cm size:letter}}</style></head><body>' + c + '</body></html>');
  w.document.close(); w.focus();
  setTimeout(function(){ w.print(); }, 500);
}


var MINUTA_DEFAULT = [
  '<h1>PROMESA DE COMPRAVENTA DE LOTE<br>PROYECTO URBANISTICO ARAGUATOS</h1>',
  '<p style="text-align:center;font-size:12px;color:#666">Plan Parcial Mesitas &middot; UAU 6 &middot; Florencia, Caqueta<br>NIT 901580047-1</p>',
  '<p>En la ciudad de Florencia, departamento de Caqueta, el dia {{FECHA}}, comparecen:</p>',
  '<h2>PRIMERA. PARTES</h2>',
  '<p><strong>VENDEDOR:</strong> ING3DRECO SAS, sociedad comercial identificada con NIT 901580047-1, con domicilio en Florencia, Caqueta, representada legalmente por ANDREA LIZETH CABRERA SUESCUN, identificada con C.C. No. 1.127.388.759, en adelante EL VENDEDOR.</p>',
  '<p><strong>COMPRADOR:</strong> {{COMPRADOR}}, identificado(a) con C.C. No. {{CC_COMPRADOR}}{{TEL_COMPRADOR}}{{EMAIL_COMPRADOR}}{{DIR_COMPRADOR}}, en adelante EL COMPRADOR.</p>',
  '<h2>SEGUNDA. OBJETO</h2>',
  '<p>EL VENDEDOR promete vender y EL COMPRADOR promete comprar el <strong>Lote {{LOTE_ID}}</strong>, Manzana {{MANZANA}}, con un area de <strong>{{AREA}} m&sup2;</strong>, ubicado dentro de la Unidad de Actuacion Urbanistica No. 6 (UAU 6) del Plan Parcial Mesitas, adoptado mediante Decreto N&deg;00180 del 16 de abril de 2021 de la Secretaria de Planeacion Municipal de Florencia, el cual se desprende del inmueble de mayor extension identificado con Matricula Inmobiliaria No. 420-133218 de la Oficina de Registro de Instrumentos Publicos de Florencia.</p>',
  '<h2>TERCERA. PRECIO Y FORMA DE PAGO</h2>',
  '<p>El precio total acordado es <strong>{{PRECIO}}</strong> ({{PRECIO_LETRAS}}). {{PREVENTA}}</p>',
  '<p>{{TIPO_PAGO}}</p>',
  '<h2>CUARTA. CLAUSULA PENAL</h2>',
  '<p>En caso de incumplimiento imputable a EL COMPRADOR, EL VENDEDOR podra retener el veinte por ciento (20%) del valor total del contrato a titulo de clausula penal compensatoria. En caso de incumplimiento imputable a EL VENDEDOR, este debera restituir a EL COMPRADOR la totalidad de las sumas recibidas, mas un veinte por ciento (20%) adicional a titulo de pena civil.</p>',
  '<h2>QUINTA. ESCRITURACION</h2>',
  '<p>EL VENDEDOR se obliga a suscribir la escritura publica de compraventa definitiva a favor de EL COMPRADOR una vez este haya cancelado la totalidad del precio pactado y se haya surtido el proceso de subdivision catastral y apertura de matricula inmobiliaria independiente.</p>',
  '<h2>SEXTA. REGIMEN URBANISTICO Y CARGAS</h2>',
  '<p>EL COMPRADOR declara conocer y aceptar que el lote objeto del presente contrato se encuentra dentro del Plan Parcial Mesitas (Decreto N&deg;00180/2021) y que el desarrollo constructivo estara sujeto a las determinantes urbanisticas vigentes, asumiendo las cargas locales proporcionales a su area conforme a los articulos 36 y 37 de la Ley 388 de 1997.</p>',
  '<h2>SEPTIMA. MERITO EJECUTIVO</h2>',
  '<p>Las partes reconocen expresamente que el presente instrumento constituye titulo ejecutivo conforme al Articulo 422 del Codigo General del Proceso, prestando merito ejecutivo para exigir el pago del precio, la firma de la escritura publica, y el cumplimiento de las demas obligaciones aqui pactadas.</p>',
  '{{OBSERVACIONES_SECCION}}',
  '<p style="margin-top:24px">Para constancia, se firma en Florencia, Caqueta, el {{FECHA}}.</p>'
].join('\n');

function buildMinuta(l) {
  var price  = l.salePrice || lp(l);
  var today  = new Date().toLocaleDateString('es-CO', {day:'numeric', month:'long', year:'numeric'});
  var dnAmt  = l.dnAmt > 0 ? l.dnAmt : (l.payType === 'cash' ? price : price * (l.dn || 20) / 100);
  var fin    = price - dnAmt;
  var mo     = l.mo || 36;
  var cmAmt  = l.cmAmt > 0 ? l.cmAmt : (mo > 0 ? fin / mo : 0);
  var calcMo = cmAmt > 0 ? Math.ceil(fin / cmAmt) : mo;

  var tipoPagoTxt = '';
  if (l.payType === 'cash') {
    tipoPagoTxt = 'EL COMPRADOR pagara la totalidad del precio de <strong>' + fCOP(price) + '</strong> de contado a la firma del presente documento.';
  } else {
    tipoPagoTxt = 'EL COMPRADOR pagara: 1) Cuota inicial (' + l.dn + '%): <strong>' + fCOP(dnAmt) + '</strong>, a la firma. '
      + '2) Saldo financiado: <strong>' + fCOP(fin) + '</strong>, en ' + calcMo
      + ' cuotas mensuales de <strong>' + fCOP(cmAmt) + '</strong> pagaderas los dias quince (15) de cada mes.';
  }

  var prevTxt = l.pv
    ? 'EL COMPRADOR recibe el descuento especial de preventa del ' + S.cfg.pv + '%, en calidad de comprador No. ' + pvUsed() + ' de contado, conforme a la politica comercial de ING3DRECO SAS.'
    : '';

  var obsSeccion = l.obs ? '<h2>OBSERVACIONES</h2><p>' + l.obs + '</p>' : '';

  var telStr = l.phone  ? ', celular ' + l.phone  : '';
  var emStr  = l.email  ? ', correo '  + l.email  : '';
  var adStr  = l.addr   ? ', domiciliado en ' + l.addr : '';

  var tpl = localStorage.getItem('araguatos_minuta_tpl') || MINUTA_DEFAULT;
  tpl = tpl.replace(/{{FECHA}}/g,               today);
  tpl = tpl.replace(/{{COMPRADOR}}/g,           l.buyer);
  tpl = tpl.replace(/{{CC_COMPRADOR}}/g,        l.cc);
  tpl = tpl.replace(/{{TEL_COMPRADOR}}/g,       telStr);
  tpl = tpl.replace(/{{EMAIL_COMPRADOR}}/g,     emStr);
  tpl = tpl.replace(/{{DIR_COMPRADOR}}/g,       adStr);
  tpl = tpl.replace(/{{LOTE_ID}}/g,             l.id);
  tpl = tpl.replace(/{{MANZANA}}/g,             l.m);
  tpl = tpl.replace(/{{AREA}}/g,                l.area);
  tpl = tpl.replace(/{{PRECIO}}/g,              fCOP(price));
  tpl = tpl.replace(/{{PRECIO_LETRAS}}/g,       numLetras(price));
  tpl = tpl.replace(/{{CUOTA_INICIAL}}/g,       fCOP(dnAmt));
  tpl = tpl.replace(/{{SALDO_FINANCIADO}}/g,    fCOP(fin));
  tpl = tpl.replace(/{{CUOTA_MENSUAL}}/g,       fCOP(cmAmt));
  tpl = tpl.replace(/{{PLAZO}}/g,               calcMo);
  tpl = tpl.replace(/{{TIPO_PAGO}}/g,           tipoPagoTxt);
  tpl = tpl.replace(/{{PREVENTA}}/g,            prevTxt);
  tpl = tpl.replace(/{{OBSERVACIONES_SECCION}}/g, obsSeccion);
  tpl = tpl.replace(/{{OBSERVACIONES}}/g,       l.obs || '');
  return tpl;
}

function oMin(lid) {
  var l = S.lots.find(function(x){return x.id === lid;});
  if (!l || !l.buyer) { alert('No hay datos de comprador para este lote.'); return; }
  G('minModTitle').textContent = 'Minuta - Lote ' + lid + ' - ' + l.buyer;
  G('minB').innerHTML = '<div class="mnb">' + buildMinuta(l)
    + '<div class="sigb">'
    + '<div class="sigl"><strong>ING3DRECO SAS</strong><br>NIT 901580047-1<br>ANDREA LIZETH CABRERA SUESCUN<br>C.C. 1.127.388.759<br>EL VENDEDOR</div>'
    + '<div class="sigl"><strong>' + l.buyer + '</strong><br>C.C. ' + l.cc + '<br>EL COMPRADOR</div>'
    + '</div></div>';
  G('minMod').style.display = 'flex';
}

function cMinM(e) {
  if (e && e.target !== G('minMod')) return;
  G('minMod').style.display = 'none';
}

function pMin() {
  var c = G('minB').innerHTML;
  var w = window.open('', '_blank');
  w.document.write('<html><head><title>Minuta Araguatos</title>'
    + '<style>body{font-family:Georgia,serif;font-size:13px;line-height:1.8;max-width:720px;margin:30px auto;color:#1a1a1a}'
    + 'h1{font-size:16px;text-align:center;margin-bottom:14px}'
    + 'h2{font-size:13px;font-weight:bold;margin:14px 0 6px;text-decoration:underline}'
    + 'p{margin-bottom:10px;text-align:justify}'
    + '.sigb{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:40px}'
    + '.sigl{border-top:1px solid #333;padding-top:8px;text-align:center;font-size:11px;line-height:1.7}'
    + '@media print{@page{margin:2cm size:letter}}</style></head><body>' + c + '</body></html>');
  w.document.close(); w.focus();
  setTimeout(function(){ w.print(); }, 500);
}
