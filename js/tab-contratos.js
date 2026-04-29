/* ══════════════════════════════════════════════════════════════════
   tab-contratos.js  —  Araguatos · ING3DRECO SAS
   v2 — mapeado a los nombres REALES del objeto lote (data.js)
   
   Campos del lote (tal como vienen de Supabase/localStorage):
     l.buyer        → Nombre completo
     l.cc           → Cédula
     l.ccCity       → Ciudad de expedición (row.cc_city en SB)
     l.marital      → Estado civil
     l.nationality  → Nacionalidad
     l.city         → Ciudad de domicilio
     l.addr         → Dirección de correspondencia
     l.phone        → Teléfono
     l.email        → Correo
     l.id           → ID del lote (ej: "B03")
     l.m            → Manzana ("B")
     l.n            → Número de lote (3)
     l.area         → Área en m²
     l.salePrice    → Precio en millones COP (float)
     l.payType      → "cash" o "fin"
     l.dnAmt        → Cuota inicial en millones COP
     l.mo           → Plazo en meses
     l.cmAmt        → Cuota mensual en millones COP
     l.pv           → Preventa (bool)
   
   Dependencias (agregar en index.html ANTES de este script):
     <script src="https://cdnjs.cloudflare.com/ajax/libs/pizzip/3.1.4/pizzip.min.js"></script>
     <script src="https://cdnjs.cloudflare.com/ajax/libs/docxtemplater/3.47.4/docxtemplater.js"></script>
══════════════════════════════════════════════════════════════════ */

(function () {

  var TEMPLATE_PATH = 'contrato_template.docx';
  var CDN_PIZZIP    = 'https://cdnjs.cloudflare.com/ajax/libs/pizzip/3.1.4/pizzip.min.js';
  var CDN_TEMPLATER = 'https://cdnjs.cloudflare.com/ajax/libs/docxtemplater/3.47.4/docxtemplater.js';

  // ─── Líneas en blanco para modo manual ───────────────────────────
  var BLANK = {
    NOMBRE_COMPLETO : '________________________________________________',
    NACIONALIDAD    : 'colombiana',
    CEDULA          : '_______________________',
    CIUDAD_EXP      : '________________',
    ESTADO_CIVIL    : '________________',
    DOMICILIO       : '___________________',
    LOTE_NUM        : '___',
    MANZANA         : '___',
    AREA_TEXTO      : '_________________ metros cuadrados',
    AREA_M2         : '_______',
    NORTE_DIST: '_______', NORTE_DESC: '___________________',
    SUR_DIST  : '_______', SUR_DESC  : '___________________',
    ESTE_DIST : '_______', ESTE_DESC : '___________________',
    OESTE_DIST: '_______', OESTE_DESC: '___________________',
    PRECIO_TEXTO    : '_______________________________________________________',
    PRECIO_NUM      : '_________________',
    PAGO_TIPO       : '___',
    PAGO_TIPO_FIN   : '___',
    CUOTA_INICIAL_T : '____________________________________________________',
    CUOTA_INICIAL_N : '__________________',
    SALDO_T         : '_________________________________________',
    SALDO_N         : '___________________',
    NUM_CUOTAS      : '____',
    VALOR_CUOTA_T   : '__________________________________________',
    VALOR_CUOTA_N   : '__________________',
    CUOTA_FINAL_T   : '______________________________________',
    CUOTA_FINAL_N   : '_________________',
    FECHA_INICIO_P  : '_________________',
    DIRECCION_COMP  : '___________________________________',
    CORREO_COMP     : '______________________________',
    TELEFONO_COMP   : '__________________',
    FECHA_FIRMA     : '__________________________',
    CC_COMPRADOR    : '___________________________',
    CEL_COMPRADOR   : '__________________',
  };

  // ─── Utilidades ───────────────────────────────────────────────────
  // Los precios en el sistema están en MILLONES de COP (ej: 60 = $60.000.000)
  function monedaM(millones) {
    if (!millones || isNaN(millones)) return '';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', maximumFractionDigits: 0
    }).format(Math.round(millones * 1e6));
  }

  function numFmtM(millones) {
    if (!millones || isNaN(millones)) return '';
    return new Intl.NumberFormat('es-CO').format(Math.round(millones * 1e6));
  }

  // Fecha de hoy en español para mostrar en tabla
  function hoyStr() {
    return new Date().toLocaleDateString('es-CO', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  // ─── Construir datos para el template ────────────────────────────
  // En el .docx los marcadores van: {{NOMBRE_CAMPO}}
  // El parágrafo condicional:       {#INCLUIR_PARRAFO}...{/INCLUIR_PARRAFO}
  function buildData(lote, modoManual, incluirParrafo) {

    // ── Campos de género ────────────────────────────────────────────
    // Se calculan igual en ambos modos (manual usa género si está disponible,
    // de lo contrario usa la forma neutra "EL/LA PROMITENTE COMPRADOR/A")
    var esMujer = (lote.gender === 'F') ||
                  (lote.buyer && /\b(a|ita)\b/i.test(lote.buyer.split(' ')[0]));
    // Si es modo manual, siempre usar forma neutra
    if (modoManual) esMujer = null;

    var tituloComprador = esMujer === true
      ? 'LA PROMITENTE COMPRADORA'
      : esMujer === false
        ? 'EL PROMITENTE COMPRADOR'
        : 'EL/LA PROMITENTE COMPRADOR/A';

    var generoId = esMujer === true
      ? 'cédula de ciudadanía No.'
      : esMujer === false
        ? 'cédula de ciudadanía No.'
        : 'cédula de ciudadanía No.';

    var esteA = esMujer === true ? 'esta' : esMujer === false ? 'este' : 'este/a';

    if (modoManual) {
      return Object.assign({}, BLANK, {
        INCLUIR_PARRAFO   : incluirParrafo,
        TITULO_COMPRADOR  : 'EL/LA PROMITENTE COMPRADOR/A',
        GENERO_ID         : 'cédula de ciudadanía No.',
        ESTE_A            : 'este/a',
      });
    }

    // ── Modo B: datos reales del lote ──
    var esContado = lote.payType === 'cash';
    var precio    = Number(lote.salePrice) || 0;        // millones COP
    var cuotaIni  = Number(lote.dnAmt)     || 0;
    var saldo     = precio - cuotaIni;
    var cuotaMes  = Number(lote.cmAmt)     || (lote.mo > 0 ? saldo / lote.mo : 0);

    // Linderos: vienen de la tabla linderos si está disponible,
    // de lo contrario se dejan en blanco para rellenar a mano.
    // Cuando implementes la pestaña linderos, reemplaza estas líneas.
    var linderos = getLinderos(lote.id);

    return {
      // ── Comprador ──
      NOMBRE_COMPLETO : lote.buyer        || BLANK.NOMBRE_COMPLETO,
      NACIONALIDAD    : lote.nationality  || 'colombiana',
      CEDULA          : lote.cc           || BLANK.CEDULA,
      CIUDAD_EXP      : lote.ccCity       || BLANK.CIUDAD_EXP,
      ESTADO_CIVIL    : lote.marital      || BLANK.ESTADO_CIVIL,
      DOMICILIO       : lote.city         || BLANK.DOMICILIO,

      // ── Lote ──
      LOTE_NUM        : String(lote.n     || BLANK.LOTE_NUM),
      MANZANA         : String(lote.m     || BLANK.MANZANA),
      AREA_TEXTO      : numFmtM(lote.area / 1e6) || String(lote.area || BLANK.AREA_M2) + ' metros cuadrados',
      AREA_M2         : String(lote.area  || BLANK.AREA_M2),

      // ── Linderos ──
      NORTE_DIST: linderos.norte_dist || BLANK.NORTE_DIST,
      NORTE_DESC: linderos.norte_desc || BLANK.NORTE_DESC,
      SUR_DIST  : linderos.sur_dist   || BLANK.SUR_DIST,
      SUR_DESC  : linderos.sur_desc   || BLANK.SUR_DESC,
      ESTE_DIST : linderos.este_dist  || BLANK.ESTE_DIST,
      ESTE_DESC : linderos.este_desc  || BLANK.ESTE_DESC,
      OESTE_DIST: linderos.oeste_dist || BLANK.OESTE_DIST,
      OESTE_DESC: linderos.oeste_desc || BLANK.OESTE_DESC,

      // ── Precio ──
      PRECIO_TEXTO    : monedaM(precio)  || BLANK.PRECIO_TEXTO,
      PRECIO_NUM      : numFmtM(precio)  || BLANK.PRECIO_NUM,

      // ── Forma de pago ──
      PAGO_TIPO     : esContado ? 'X' : '   ',
      PAGO_TIPO_FIN : esContado ? '   ' : 'X',

      CUOTA_INICIAL_T : monedaM(cuotaIni)  || BLANK.CUOTA_INICIAL_T,
      CUOTA_INICIAL_N : numFmtM(cuotaIni)  || BLANK.CUOTA_INICIAL_N,
      SALDO_T         : monedaM(saldo)      || BLANK.SALDO_T,
      SALDO_N         : numFmtM(saldo)      || BLANK.SALDO_N,
      NUM_CUOTAS      : String(lote.mo      || BLANK.NUM_CUOTAS),
      VALOR_CUOTA_T   : monedaM(cuotaMes)   || BLANK.VALOR_CUOTA_T,
      VALOR_CUOTA_N   : numFmtM(cuotaMes)   || BLANK.VALOR_CUOTA_N,
      CUOTA_FINAL_T   : BLANK.CUOTA_FINAL_T,
      CUOTA_FINAL_N   : BLANK.CUOTA_FINAL_N,
      FECHA_INICIO_P  : BLANK.FECHA_INICIO_P,

      // ── Contacto ──
      DIRECCION_COMP  : lote.addr   || BLANK.DIRECCION_COMP,
      CORREO_COMP     : lote.email  || BLANK.CORREO_COMP,
      TELEFONO_COMP   : lote.phone  || BLANK.TELEFONO_COMP,
      FECHA_FIRMA     : BLANK.FECHA_FIRMA,
      CC_COMPRADOR    : lote.cc     || BLANK.CC_COMPRADOR,
      CEL_COMPRADOR   : lote.phone  || BLANK.CEL_COMPRADOR,

      // ── Género y título del comprador ──
      TITULO_COMPRADOR  : tituloComprador,
      GENERO_ID         : generoId,
      ESTE_A            : esteA,

      // ── Condicional ──
      INCLUIR_PARRAFO : incluirParrafo,
    };
  }

  // ─── Obtener linderos del lote (si existe la tabla) ───────────────
  // Compatible con la implementación actual de tab-lotes / linderos
  function getLinderos(loteId) {
    try {
      // Intentar desde S.linderos si existe
      if (window.S && window.S.linderos && window.S.linderos[loteId]) {
        return window.S.linderos[loteId];
      }
      // Intentar desde localStorage (clave usada en tab-lotes)
      var raw = localStorage.getItem('araguatos_linderos');
      if (raw) {
        var obj = JSON.parse(raw);
        return obj[loteId] || {};
      }
    } catch(e) {}
    return {};
  }

  // ─── Obtener lotes vendidos/apartados desde S.lots ───────────────
  function getLotesConVenta() {
    try {
      if (window.S && Array.isArray(window.S.lots)) {
        return window.S.lots.filter(function(l) {
          return l.status === 'sold' || l.status === 'apartado';
        });
      }
    } catch(e) {}
    return [];
  }

  // ─── Carga dinámica de scripts ────────────────────────────────────
  function loadScript(src) {
    return new Promise(function(res, rej) {
      if (document.querySelector('script[src="' + src + '"]')) { res(); return; }
      var s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = function() { rej(new Error('No se pudo cargar: ' + src)); };
      document.head.appendChild(s);
    });
  }

  // ─── Generar y descargar el DOCX ─────────────────────────────────
  function generarContrato(lote, modoManual, incluirParrafo) {
    var btn = document.getElementById('btnGenerar');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Generando…'; }

    Promise.resolve()
      .then(function() {
        if (typeof PizZip === 'undefined')        return loadScript(CDN_PIZZIP);
      })
      .then(function() {
        if (typeof Docxtemplater === 'undefined') return loadScript(CDN_TEMPLATER);
      })
      .then(function() {
        return fetch(TEMPLATE_PATH);
      })
      .then(function(resp) {
        if (!resp.ok) throw new Error(
          'No se encontró la plantilla "' + TEMPLATE_PATH + '" (HTTP ' + resp.status + ').\n' +
          'Sube el archivo contrato_template.docx a la raíz del repositorio.'
        );
        return resp.arrayBuffer();
      })
      .then(function(arrayBuffer) {
        var zip = new PizZip(arrayBuffer);
        var doc = new Docxtemplater(zip, {
          paragraphLoop : true,
          linebreaks    : true,
          nullGetter    : function() { return ''; },
        });

        doc.render(buildData(lote, modoManual, incluirParrafo));

        var blob = doc.getZip().generate({
          type        : 'blob',
          mimeType    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          compression : 'DEFLATE',
        });

        var nombre = modoManual
          ? 'Contrato_Araguatos_MANUAL.docx'
          : ('Contrato_Lote' + (lote.id || '') + '_' +
             (lote.buyer || 'Cliente').replace(/\s+/g, '_') + '.docx');

        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = nombre;
        a.click();
        setTimeout(function() { URL.revokeObjectURL(a.href); }, 15000);
      })
      .catch(function(err) {
        console.error('Error generando contrato:', err);
        alert('❌ Error al generar el contrato:\n\n' + err.message);
      })
      .then(function() {
        if (btn) { btn.disabled = false; btn.textContent = '📥 Descargar Contrato'; }
      });
  }

  // ─── Renderizar panel de contratos ───────────────────────────────
  function renderContratos() {
    var panel = document.getElementById('tab-contratos');
    if (!panel) return;

    var lotes = getLotesConVenta();

    panel.innerHTML =
      '<div class="card">' +
      '<div class="ct">📄 Generador de Contratos — Promesa de Compraventa</div>' +
      '<p style="font-size:13px;color:var(--muted);margin-bottom:20px">' +
      'Configura las opciones y descarga el contrato en formato Word (.docx).</p>' +

      // ── PASO 1 ──
      '<div style="margin-bottom:22px">' +
      '<div style="font-size:11px;font-weight:700;color:#1a237e;margin-bottom:10px;' +
      'text-transform:uppercase;letter-spacing:.8px">Paso 1 · Tipo de contrato</div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +

      '<label id="lbl-manual" style="cursor:pointer;flex:1;min-width:200px;' +
      'display:flex;align-items:flex-start;gap:10px;padding:12px 14px;' +
      'border:2px solid #1565C0;border-radius:10px;background:#e8f0fe;transition:.2s">' +
      '<input type="radio" name="tipoContrato" value="manual" checked style="margin-top:2px;accent-color:#1565C0">' +
      '<div><div style="font-size:13px;font-weight:700">📝 Para diligenciar manualmente</div>' +
      '<div style="font-size:11px;color:#555;margin-top:3px">Campos con líneas en blanco</div></div></label>' +

      '<label id="lbl-datos" style="cursor:pointer;flex:1;min-width:200px;' +
      'display:flex;align-items:flex-start;gap:10px;padding:12px 14px;' +
      'border:2px solid #ccc;border-radius:10px;background:#fff;transition:.2s">' +
      '<input type="radio" name="tipoContrato" value="datos" style="margin-top:2px;accent-color:#1565C0">' +
      '<div><div style="font-size:13px;font-weight:700">✅ Con datos de una venta</div>' +
      '<div style="font-size:11px;color:#555;margin-top:3px">Completa automáticamente desde VENTAS</div></div></label>' +

      '</div></div>' +

      // ── PASO 2: selección de lote (oculto inicialmente) ──
      '<div id="selectLoteWrap" style="display:none;margin-bottom:22px">' +
      '<div style="font-size:11px;font-weight:700;color:#1a237e;margin-bottom:10px;' +
      'text-transform:uppercase;letter-spacing:.8px">Paso 2 · Seleccionar venta registrada</div>' +
      (lotes.length === 0
        ? '<div style="font-size:13px;color:#c62828;padding:12px 14px;background:#fff3e0;' +
          'border-radius:8px;border-left:4px solid #e65100">' +
          '⚠️ No hay ventas registradas. Ve a la pestaña <strong>VENTA</strong> y registra una primero.</div>'
        : '<select id="selectLote" style="width:100%;padding:11px 12px;border:1.5px solid #ccc;' +
          'border-radius:8px;font-size:13px;outline:none;background:#fff">' +
          '<option value="">— Selecciona un lote vendido —</option>' +
          lotes.map(function(l, i) {
            return '<option value="' + i + '">' +
              'Lote ' + l.id + ' · ' + (l.buyer || 'Sin nombre') +
              ' · C.C. ' + (l.cc || '-') +
              (l.marital ? ' · ' + l.marital : '') +
              '</option>';
          }).join('') +
          '</select>'
      ) +
      '</div>' +

      // ── PASO parágrafo ──
      '<div style="margin-bottom:26px">' +
      '<div style="font-size:11px;font-weight:700;color:#1a237e;margin-bottom:10px;' +
      'text-transform:uppercase;letter-spacing:.8px">' +
      '<span id="labelPasoP">Paso 2</span> · Cláusula Tercera — Parágrafo de urbanismo</div>' +
      '<label style="cursor:pointer;display:flex;align-items:flex-start;gap:12px;padding:14px;' +
      'border:2px solid #ccc;border-radius:10px;background:#fff;transition:.2s" id="lbl-parrafo">' +
      '<input type="checkbox" id="chkParrafo" style="margin-top:2px;accent-color:#1565C0;width:17px;height:17px;flex-shrink:0">' +
      '<div>' +
      '<div style="font-size:13px;font-weight:700;margin-bottom:4px">Incluir parágrafo sobre obras y plazos de urbanización</div>' +
      '<div style="font-size:11px;color:#555;line-height:1.6;font-style:italic">' +
      '"LA PROMITENTE VENDEDORA se obliga a adelantar… obras de urbanismo del proyecto ARAGUATOS… ' +
      'dentro de un plazo máximo de cinco (5) años…"</div>' +
      '</div></label></div>' +

      // ── Botón ──
      '<button id="btnGenerar" class="btn bg" ' +
      'style="font-size:14px;padding:13px 32px;letter-spacing:.3px;border-radius:9px" ' +
      'onclick="window._ctGenerar()">📥 Descargar Contrato (.docx)</button>' +

      '<div style="margin-top:16px;padding:12px 14px;background:#f5f5f5;border-radius:8px;' +
      'font-size:11px;color:#666;line-height:1.7">' +
      '<strong>ℹ️ Cómo funciona:</strong> El contrato se genera en el navegador usando la plantilla ' +
      '<code>contrato_template.docx</code> del repositorio. Para modificar el formato o texto del ' +
      'contrato, edita ese archivo Word y vuelve a subirlo. No hay que tocar el código JS.' +
      '</div></div>' +

      // ── Tabla de lotes con venta ──
      (lotes.length > 0
        ? '<div class="card" style="margin-top:12px">' +
          '<div class="ct">Ventas registradas</div>' +
          '<div class="tw" style="margin-top:10px">' +
          '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead>' +
          '<tr style="background:#f0f4ff">' +
          '<th style="padding:7px 10px;text-align:left">Lote</th>' +
          '<th style="padding:7px 10px;text-align:left">Comprador</th>' +
          '<th style="padding:7px 10px;text-align:left">Cédula</th>' +
          '<th style="padding:7px 10px;text-align:left">E. Civil</th>' +
          '<th style="padding:7px 10px;text-align:left">Ciudad</th>' +
          '<th style="padding:7px 10px;text-align:left">Teléfono</th>' +
          '<th style="padding:7px 10px;text-align:left">Precio</th>' +
          '<th style="padding:7px 10px;text-align:left">Pago</th>' +
          '<th style="padding:7px 10px;text-align:center">Contrato</th>' +
          '</tr></thead><tbody>' +
          lotes.map(function(l, i) {
            return '<tr style="border-top:1px solid #eee">' +
              '<td style="padding:7px 10px;font-weight:700">' + l.id + '</td>' +
              '<td style="padding:7px 10px">' + (l.buyer || '—') + '</td>' +
              '<td style="padding:7px 10px">' + (l.cc || '—') + '</td>' +
              '<td style="padding:7px 10px">' + (l.marital || '—') + '</td>' +
              '<td style="padding:7px 10px">' + (l.city || '—') + '</td>' +
              '<td style="padding:7px 10px">' + (l.phone || '—') + '</td>' +
              '<td style="padding:7px 10px">' + (monedaM(l.salePrice) || '—') + '</td>' +
              '<td style="padding:7px 10px">' + (l.payType === 'cash' ? '💵 Contado' : '📅 Financiado') + '</td>' +
              '<td style="padding:7px 10px;text-align:center">' +
              '<button class="btn bsm bg" onclick="window._ctGenerarIdx(' + i + ')">📥</button>' +
              '</td></tr>';
          }).join('') +
          '</tbody></table></div></div>'
        : ''
      );

    // Guardar referencia a lotes
    window._ctLotes = lotes;

    // Listeners radio buttons
    panel.querySelectorAll('input[name="tipoContrato"]').forEach(function(r) {
      r.addEventListener('change', actualizarUI);
    });

    // Listener checkbox párrafo
    var chk = document.getElementById('chkParrafo');
    if (chk) {
      chk.addEventListener('change', function() {
        var lbl = document.getElementById('lbl-parrafo');
        if (lbl) {
          lbl.style.borderColor = chk.checked ? '#1565C0' : '#ccc';
          lbl.style.background  = chk.checked ? '#e8f0fe' : '#fff';
        }
      });
    }
  }

  // ─── Actualizar UI según tipo seleccionado ────────────────────────
  function actualizarUI() {
    var tipo    = (document.querySelector('input[name="tipoContrato"]:checked') || {}).value || 'manual';
    var esDatos = tipo === 'datos';

    var wrap    = document.getElementById('selectLoteWrap');
    var lblPaso = document.getElementById('labelPasoP');
    var lblMan  = document.getElementById('lbl-manual');
    var lblDat  = document.getElementById('lbl-datos');

    if (wrap)    wrap.style.display       = esDatos ? 'block' : 'none';
    if (lblPaso) lblPaso.textContent      = esDatos ? 'Paso 3' : 'Paso 2';
    if (lblMan)  {
      lblMan.style.borderColor = esDatos ? '#ccc'    : '#1565C0';
      lblMan.style.background  = esDatos ? '#fff'    : '#e8f0fe';
    }
    if (lblDat)  {
      lblDat.style.borderColor = esDatos ? '#1565C0' : '#ccc';
      lblDat.style.background  = esDatos ? '#e8f0fe' : '#fff';
    }
  }

  // ─── Handlers globales ────────────────────────────────────────────
  window._ctGenerar = function() {
    var tipo       = (document.querySelector('input[name="tipoContrato"]:checked') || {}).value || 'manual';
    var modoManual = tipo === 'manual';
    var incluirPar = (document.getElementById('chkParrafo') || {}).checked || false;

    if (!modoManual) {
      var sel = document.getElementById('selectLote');
      var idx = sel ? parseInt(sel.value) : NaN;
      if (isNaN(idx) || !sel || sel.value === '') {
        alert('Por favor selecciona un lote de la lista.');
        return;
      }
      generarContrato(window._ctLotes[idx], false, incluirPar);
    } else {
      generarContrato({}, true, incluirPar);
    }
  };

  window._ctGenerarIdx = function(idx) {
    var lote = (window._ctLotes || [])[idx];
    if (!lote) return;
    var incluirPar = (document.getElementById('chkParrafo') || {}).checked || false;
    generarContrato(lote, false, incluirPar);
  };

  // ─── Exponer para el sistema de tabs ─────────────────────────────
  window.initContratos = renderContratos;

})();
