/* ══════════════════════════════════════════════════════════════════
   tab-contratos.js  —  Araguatos · ING3DRECO SAS
   v4 — correcciones aplicadas:
     · {GENERO_ID}: "cédula de ciudadanía No." o "NIT No."
       (definido en BLANK y en buildData; el template ya lo tiene)
     · {CUOTA_INICIAL_N}, {PRECIO_NUM}, {SALDO_N}, {VALOR_CUOTA_N}:
       corregidos en contrato_template.docx (tenían $ espúreo)
     · {FECHA_INICIO_P}: fecha hoy + 30 días en formato "DD de mes de YYYY"
     · Linderos: cargarLinderos() robustecido; pushLinderos/pullLinderos
       exportados a window para que tab-config.js los invoque
══════════════════════════════════════════════════════════════════ */

(function () {

  var TEMPLATE_PATH = 'contrato_template.docx';
  var CDN_PIZZIP    = 'js/libs/pizzip.min.js';
  var CDN_TEMPLATER = 'js/libs/docxtemplater.js';

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
    // ── CORREGIDO: valor real del marcador {GENERO_ID} ──
    GENERO_ID       : 'cédula de ciudadanía No.',
  };

  // ═══════════════════════════════════════════════════════════════
  // UTILIDADES
  // ═══════════════════════════════════════════════════════════════

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

  // Número en letras (recibe millones COP)
  function numALetras(millones) {
    if (!millones || isNaN(millones)) return '';
    var pesos = Math.round(Number(millones) * 1e6);
    if (pesos === 0) return 'CERO PESOS MONEDA CORRIENTE';

    var UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS',
                    'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE',
                    'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE',
                    'DIECIOCHO', 'DIECINUEVE'];
    var DECENAS  = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA',
                    'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    var CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS',
                    'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    function cientos(n) {
      if (n === 0) return '';
      if (n === 100) return 'CIEN';
      var c = Math.floor(n / 100), r = n % 100;
      var txt = c > 0 ? CENTENAS[c] : '';
      if (r > 0) txt += (txt ? ' ' : '') + decenas(r);
      return txt;
    }
    function decenas(n) {
      if (n < 20) return UNIDADES[n];
      var d = Math.floor(n / 10), u = n % 10;
      return u === 0 ? DECENAS[d] : DECENAS[d] + ' Y ' + UNIDADES[u];
    }

    var mil_mill = Math.floor(pesos / 1e9);
    var mill     = Math.floor((pesos % 1e9) / 1e6);
    var mil      = Math.floor((pesos % 1e6) / 1e3);
    var resto    = pesos % 1e3;

    var partes = [];
    if (mil_mill > 0) partes.push(cientos(mil_mill) + ' MIL MILLONES');
    if (mill > 0) partes.push(mill === 1 ? 'UN MILLÓN' : cientos(mill) + ' MILLONES');
    if (mil  > 0) partes.push(mil  === 1 ? 'MIL'       : cientos(mil)  + ' MIL');
    if (resto > 0) partes.push(cientos(resto));

    return partes.join(' ') + ' PESOS MONEDA CORRIENTE';
  }

  // Fecha en formato "DD de mes de YYYY"
  var MESES = ['enero','febrero','marzo','abril','mayo','junio',
               'julio','agosto','septiembre','octubre','noviembre','diciembre'];

  function fechaFormato(d) {
    return d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear();
  }

  function fechaHoy() {
    return fechaFormato(new Date());
  }

  // ── CORREGIDO: {FECHA_INICIO_P} = hoy + 30 días ──────────────
  function fechaInicioPago() {
    var d = new Date();
    d.setDate(d.getDate() + 30);
    return fechaFormato(d);
  }

  // Área en texto para el contrato
  function numALetrasEntero(n) {
    if (n === 0) return 'CERO';
    var UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS',
                    'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE',
                    'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE',
                    'DIECIOCHO', 'DIECINUEVE'];
    var DECENAS  = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA',
                    'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    var CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS',
                    'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
    function grupo(x) {
      if (x === 0) return '';
      if (x === 100) return 'CIEN';
      var c = Math.floor(x / 100), r = x % 100;
      var txt = c > 0 ? CENTENAS[c] : '';
      if (r > 0) {
        if (r < 20) txt += (txt ? ' ' : '') + UNIDADES[r];
        else {
          var d = Math.floor(r / 10), u = r % 10;
          txt += (txt ? ' ' : '') + DECENAS[d] + (u ? ' Y ' + UNIDADES[u] : '');
        }
      }
      return txt;
    }
    var miles = Math.floor(n / 1000), resto = n % 1000;
    var partes = [];
    if (miles > 0) partes.push(grupo(miles) + ' MIL');
    if (resto > 0) partes.push(grupo(resto));
    return partes.join(' ');
  }

  function areaTexto(m2) {
    if (!m2) return BLANK.AREA_TEXTO;
    var n = Math.round(Number(m2));
    return numALetrasEntero(n) + ' (' + n + ') METROS CUADRADOS';
  }

  // ── CORREGIDO: {GENERO_ID} según tipo de documento ───────────
  // Por ahora todos son personas naturales con cédula.
  // Si en el futuro hay personas jurídicas, agrega campo docType al lote.
  function generoId(lote) {
    if (!lote || lote.docType === 'nit') return 'NIT No.';
    return 'cédula de ciudadanía No.';
  }

  // Conjugaciones por género
  function conjugar(gender) {
    var esM = gender === 'M';
    var esF = gender === 'F';
    return {
      TITULO_COMPRADOR: esF ? 'LA PROMITENTE COMPRADORA'
                       : esM ? 'EL PROMITENTE COMPRADOR'
                       :       'EL/LA PROMITENTE COMPRADOR/A',
      IDENTIFICADO    : esF ? 'identificada'
                       : esM ? 'identificado'
                       :       'identificado/a',
      ESTE_A          : esF ? 'esta'  : esM ? 'este'  : 'este/a',
      EL_LA           : esF ? 'la'    : esM ? 'el'    : 'el/la',
    };
  }

  // Estado civil conjugado por género
  function conjugarEstadoCivil(marital, gender) {
    if (!marital) return BLANK.ESTADO_CIVIL;
    var m = marital.toLowerCase().trim();
    var esF = gender === 'F';
    var esM = gender === 'M';
    var mapa = {
      'soltero':              ['soltero/a',             'soltero',              'soltera'],
      'soltera':              ['soltero/a',             'soltero',              'soltera'],
      'soltero/a':            ['soltero/a',             'soltero',              'soltera'],
      'casado':               ['casado/a',              'casado',               'casada'],
      'casada':               ['casado/a',              'casado',               'casada'],
      'casado/a':             ['casado/a',              'casado',               'casada'],
      'divorciado':           ['divorciado/a',          'divorciado',           'divorciada'],
      'divorciada':           ['divorciado/a',          'divorciado',           'divorciada'],
      'divorciado/a':         ['divorciado/a',          'divorciado',           'divorciada'],
      'viudo':                ['viudo/a',               'viudo',                'viuda'],
      'viuda':                ['viudo/a',               'viudo',                'viuda'],
      'viudo/a':              ['viudo/a',               'viudo',                'viuda'],
      'unión libre':          ['unión libre',           'unión libre',          'unión libre'],
      'union libre':          ['unión libre',           'unión libre',          'unión libre'],
      'compañero permanente': ['compañero/a permanente','compañero permanente', 'compañera permanente'],
      'compañera permanente': ['compañero/a permanente','compañero permanente', 'compañera permanente'],
    };
    var formas = mapa[m];
    if (!formas) return marital;
    if (esF) return formas[2];
    if (esM) return formas[1];
    return formas[0];
  }

  // ═══════════════════════════════════════════════════════════════
  // LINDEROS — CORREGIDO: carga robusta + exportación global
  // ═══════════════════════════════════════════════════════════════
  var _linderosCache = null;

  function getLinderos(loteId) {
    if (_linderosCache && _linderosCache[loteId]) return _linderosCache[loteId];
    if (window.S && window.S.linderos && window.S.linderos[loteId]) return window.S.linderos[loteId];
    try {
      var raw = localStorage.getItem('araguatos_linderos');
      if (raw) {
        var obj = JSON.parse(raw);
        if (obj[loteId]) return obj[loteId];
      }
    } catch(e) {}
    return {};
  }

  function cargarLinderos() {
    return new Promise(function(resolve) {
      // Si ya tenemos caché en memoria, usarla
      if (_linderosCache && Object.keys(_linderosCache).length > 0) {
        resolve(_linderosCache);
        return;
      }

      // Intentar desde localStorage
      try {
        var raw = localStorage.getItem('araguatos_linderos');
        if (raw) {
          var cached = JSON.parse(raw);
          if (cached && Object.keys(cached).length > 0) {
            _linderosCache = cached;
            resolve(_linderosCache);
            return;
          }
        }
      } catch(e) {}

      // Cargar desde Supabase
      var url = (typeof SB_URL !== 'undefined' ? SB_URL : '');
      var key = (typeof SB_KEY !== 'undefined' ? SB_KEY : '');
      var tok = (typeof SB_TOKEN !== 'undefined' && SB_TOKEN) ? SB_TOKEN : key;

      if (!url || !key) {
        console.warn('[contratos] Sin credenciales Supabase — linderos no disponibles.');
        resolve({});
        return;
      }

      fetch(url + '/rest/v1/lot_linderos?select=*', {
        headers: {
          'apikey': key,
          'Authorization': 'Bearer ' + tok,
          'Content-Type': 'application/json'
        }
      })
      .then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' al cargar lot_linderos');
        return r.json();
      })
      .then(function(data) {
        if (!Array.isArray(data)) { resolve({}); return; }
        var mapa = {};
        data.forEach(function(row) {
          mapa[row.lot_id] = {
            norte_dist: row.norte_dist || '',
            norte_desc: row.norte_desc || '',
            sur_dist:   row.sur_dist   || '',
            sur_desc:   row.sur_desc   || '',
            este_dist:  row.este_dist  || '',
            este_desc:  row.este_desc  || '',
            oeste_dist: row.oeste_dist || '',
            oeste_desc: row.oeste_desc || '',
          };
        });
        _linderosCache = mapa;
        try {
          localStorage.setItem('araguatos_linderos', JSON.stringify(mapa));
        } catch(e) {}
        console.log('[contratos] Linderos cargados:', Object.keys(mapa).length, 'lotes');
        resolve(mapa);
      })
      .catch(function(err) {
        console.error('[contratos] Error cargando linderos:', err.message);
        resolve({});
      });
    });
  }

  // ── Exportar para que tab-config.js pueda invocarlos ─────────
  window.pushLinderos = function() {
    // No-op: los linderos se editan directamente en Supabase
  };

  window.pullLinderos = function() {
    _linderosCache = null; // Forzar recarga
    try { localStorage.removeItem('araguatos_linderos'); } catch(e) {}
    cargarLinderos().then(function() {
      console.log('[contratos] Linderos actualizados desde Supabase.');
    });
  };

  // ═══════════════════════════════════════════════════════════════
  // CONSTRUCCIÓN DE DATOS PARA EL TEMPLATE
  // ═══════════════════════════════════════════════════════════════
  function buildData(lote, modoManual, incluirParrafo, linderosMap) {
    var gender = modoManual ? '' : (lote.gender || '');
    var conj   = conjugar(gender);

    if (modoManual) {
      return Object.assign({}, BLANK, {
        FECHA_FIRMA      : fechaHoy(),
        FECHA_INICIO_P   : fechaInicioPago(),   // ← CORREGIDO
        INCLUIR_PARRAFO  : incluirParrafo,
        TITULO_COMPRADOR : conj.TITULO_COMPRADOR,
        IDENTIFICADO     : conj.IDENTIFICADO,
        ESTE_A           : conj.ESTE_A,
        EL_LA            : conj.EL_LA,
      });
    }

    var esContado = lote.payType === 'cash';
    var precio    = Number(lote.salePrice) || 0;
    var cuotaIni  = Number(lote.dnAmt)     || 0;
    var saldo     = Math.max(0, precio - cuotaIni);
    var cuotaMes  = Number(lote.cmAmt) || (lote.mo > 0 ? saldo / lote.mo : 0);

    // Linderos: primero el mapa recién cargado, luego caché local
    var lind = {};
    if (linderosMap && linderosMap[lote.id]) {
      lind = linderosMap[lote.id];
    } else {
      lind = getLinderos(lote.id);
    }

    return {
      // ── Comprador ──
      NOMBRE_COMPLETO  : lote.buyer       || BLANK.NOMBRE_COMPLETO,
      NACIONALIDAD     : lote.nationality || 'colombiana',
      CEDULA           : lote.cc          || BLANK.CEDULA,
      CIUDAD_EXP       : lote.ccCity      || BLANK.CIUDAD_EXP,
      ESTADO_CIVIL     : conjugarEstadoCivil(lote.marital, gender),
      DOMICILIO        : lote.city        || BLANK.DOMICILIO,

      // ── CORREGIDO: {GENERO_ID} siempre definido ──
      GENERO_ID        : generoId(lote),

      // ── Formas gramaticales ──
      TITULO_COMPRADOR : conj.TITULO_COMPRADOR,
      IDENTIFICADO     : conj.IDENTIFICADO,
      ESTE_A           : conj.ESTE_A,
      EL_LA            : conj.EL_LA,

      // ── Lote ──
      LOTE_NUM  : String(lote.n  || BLANK.LOTE_NUM),
      MANZANA   : String(lote.m  || BLANK.MANZANA),
      AREA_TEXTO: areaTexto(lote.area),
      AREA_M2   : String(lote.area || BLANK.AREA_M2),

      // ── Linderos ──
      NORTE_DIST: lind.norte_dist || BLANK.NORTE_DIST,
      NORTE_DESC: lind.norte_desc || BLANK.NORTE_DESC,
      SUR_DIST  : lind.sur_dist   || BLANK.SUR_DIST,
      SUR_DESC  : lind.sur_desc   || BLANK.SUR_DESC,
      ESTE_DIST : lind.este_dist  || BLANK.ESTE_DIST,
      ESTE_DESC : lind.este_desc  || BLANK.ESTE_DESC,
      OESTE_DIST: lind.oeste_dist || BLANK.OESTE_DIST,
      OESTE_DESC: lind.oeste_desc || BLANK.OESTE_DESC,

      // ── Valores en letras y números ──
      PRECIO_TEXTO    : precio   > 0 ? numALetras(precio)   : BLANK.PRECIO_TEXTO,
      PRECIO_NUM      : precio   > 0 ? numFmtM(precio)      : BLANK.PRECIO_NUM,
      CUOTA_INICIAL_T : cuotaIni > 0 ? numALetras(cuotaIni) : BLANK.CUOTA_INICIAL_T,
      CUOTA_INICIAL_N : cuotaIni > 0 ? numFmtM(cuotaIni)   : BLANK.CUOTA_INICIAL_N,
      SALDO_T         : saldo    > 0 ? numALetras(saldo)    : BLANK.SALDO_T,
      SALDO_N         : saldo    > 0 ? numFmtM(saldo)       : BLANK.SALDO_N,
      VALOR_CUOTA_T   : cuotaMes > 0 ? numALetras(cuotaMes) : BLANK.VALOR_CUOTA_T,
      VALOR_CUOTA_N   : cuotaMes > 0 ? numFmtM(cuotaMes)   : BLANK.VALOR_CUOTA_N,

      // ── Forma de pago ──
      PAGO_TIPO       : esContado ? 'X' : '   ',
      PAGO_TIPO_FIN   : esContado ? '   ' : 'X',
      NUM_CUOTAS      : String(lote.mo || BLANK.NUM_CUOTAS),
      CUOTA_FINAL_T   : BLANK.CUOTA_FINAL_T,
      CUOTA_FINAL_N   : BLANK.CUOTA_FINAL_N,

      // ── CORREGIDO: fecha inicio de pago = hoy + 30 días ──
      FECHA_INICIO_P  : fechaInicioPago(),

      // ── Contacto ──
      DIRECCION_COMP  : lote.addr  || BLANK.DIRECCION_COMP,
      CORREO_COMP     : lote.email || BLANK.CORREO_COMP,
      TELEFONO_COMP   : lote.phone || BLANK.TELEFONO_COMP,
      CC_COMPRADOR    : lote.cc    || BLANK.CC_COMPRADOR,
      CEL_COMPRADOR   : lote.phone || BLANK.CEL_COMPRADOR,

      // ── Fechas ──
      FECHA_FIRMA     : fechaHoy(),

      // ── Condicional parágrafo ──
      INCLUIR_PARRAFO : incluirParrafo,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // LOTES CON VENTA
  // ═══════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════
  // CARGA DE LIBRERÍAS
  // ═══════════════════════════════════════════════════════════════
  function cargarLibrerias() {
    return new Promise(function(resolve, reject) {
      if (typeof PizZip !== 'undefined' &&
          (typeof Docxtemplater !== 'undefined' || typeof window.docxtemplater !== 'undefined')) {
        resolve(); return;
      }
      var s1 = document.createElement('script');
      s1.src = CDN_PIZZIP;
      s1.onerror = function() { reject(new Error('No se pudo cargar PizZip.')); };
      s1.onload = function() {
        if (typeof PizZip === 'undefined') { reject(new Error('PizZip no disponible.')); return; }
        var s2 = document.createElement('script');
        s2.src = CDN_TEMPLATER;
        s2.onerror = function() { reject(new Error('No se pudo cargar Docxtemplater.')); };
        s2.onload = function() {
          if (typeof window.docxtemplater === 'undefined' && typeof Docxtemplater === 'undefined') {
            reject(new Error('Docxtemplater no disponible.')); return;
          }
          if (typeof Docxtemplater === 'undefined' && typeof window.docxtemplater !== 'undefined') {
            window.Docxtemplater = window.docxtemplater;
          }
          resolve();
        };
        document.head.appendChild(s2);
      };
      document.head.appendChild(s1);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // GENERACIÓN DEL DOCX
  // ═══════════════════════════════════════════════════════════════
  function generarContrato(lote, modoManual, incluirParrafo) {
    var btn = document.getElementById('btnGenerar');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Generando…'; }

    if (typeof Docxtemplater === 'undefined' && typeof window.docxtemplater !== 'undefined') {
      window.Docxtemplater = window.docxtemplater;
    }

    Promise.all([cargarLibrerias(), cargarLinderos()])
      .then(function(results) {
        var linderosMap = results[1] || {};
        return fetch(TEMPLATE_PATH)
          .then(function(resp) {
            if (!resp.ok) throw new Error(
              'No se encontró "' + TEMPLATE_PATH + '" (HTTP ' + resp.status + ').\n' +
              'Sube contrato_template.docx a la raíz del repositorio.'
            );
            return resp.arrayBuffer();
          })
          .then(function(ab) { return { ab: ab, lind: linderosMap }; });
      })
      .then(function(obj) {
        var zip = new PizZip(obj.ab);
        var doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks:    true,
          nullGetter:    function() { return ''; },
        });
        var data = buildData(lote, modoManual, incluirParrafo, obj.lind);
        console.log('[contratos] Data a renderizar:', data);
        doc.render(data);
        var blob = doc.getZip().generate({
          type:        'blob',
          mimeType:    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          compression: 'DEFLATE',
        });
        var nombre = modoManual
          ? 'Contrato_Araguatos_MANUAL.docx'
          : 'Contrato_Lote' + (lote.id || '') + '_' +
            (lote.buyer || 'Cliente').replace(/\s+/g, '_') + '.docx';
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

  // ═══════════════════════════════════════════════════════════════
  // RENDER DEL PANEL
  // ═══════════════════════════════════════════════════════════════
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

      // ── PASO 2: lote ──
      '<div id="selectLoteWrap" style="display:none;margin-bottom:22px">' +
      '<div style="font-size:11px;font-weight:700;color:#1a237e;margin-bottom:10px;' +
      'text-transform:uppercase;letter-spacing:.8px">Paso 2 · Seleccionar venta registrada</div>' +
      (lotes.length === 0
        ? '<div style="font-size:13px;color:#c62828;padding:12px 14px;background:#fff3e0;' +
          'border-radius:8px;border-left:4px solid #e65100">' +
          '⚠️ No hay ventas registradas. Ve a la pestaña <strong>VENTA</strong> y registra una primero.</div>'
        : '<select id="selectLote" style="width:100%;padding:11px 12px;border:1.5px solid #ccc;' +
          'border-radius:8px;font-size:13px;background:#fff">' +
          '<option value="">— Selecciona un lote vendido —</option>' +
          lotes.map(function(l, i) {
            return '<option value="' + i + '">Lote ' + l.id +
              ' · ' + (l.buyer || 'Sin nombre') +
              ' · C.C. ' + (l.cc || '-') +
              (l.marital ? ' · ' + conjugarEstadoCivil(l.marital, l.gender) : '') +
              '</option>';
          }).join('') + '</select>'
      ) + '</div>' +

      // ── Parágrafo ──
      '<div style="margin-bottom:26px">' +
      '<div style="font-size:11px;font-weight:700;color:#1a237e;margin-bottom:10px;' +
      'text-transform:uppercase;letter-spacing:.8px">' +
      '<span id="labelPasoP">Paso 2</span> · Cláusula Tercera — Parágrafo de urbanismo</div>' +
      '<label style="cursor:pointer;display:flex;align-items:flex-start;gap:12px;padding:14px;' +
      'border:2px solid #ccc;border-radius:10px;background:#fff;transition:.2s" id="lbl-parrafo">' +
      '<input type="checkbox" id="chkParrafo" style="margin-top:2px;accent-color:#1565C0;width:17px;height:17px;flex-shrink:0">' +
      '<div><div style="font-size:13px;font-weight:700;margin-bottom:4px">Incluir parágrafo sobre obras y plazos de urbanización</div>' +
      '<div style="font-size:11px;color:#555;line-height:1.6;font-style:italic">' +
      '"LA PROMITENTE VENDEDORA se obliga a adelantar… obras de urbanismo del proyecto ARAGUATOS… ' +
      'dentro de un plazo máximo de cinco (5) años…"</div></div></label></div>' +

      // ── Botón ──
      '<button id="btnGenerar" class="btn bg" ' +
      'style="font-size:14px;padding:13px 32px;letter-spacing:.3px;border-radius:9px" ' +
      'onclick="window._ctGenerar()">📥 Descargar Contrato (.docx)</button>' +
      '<div style="margin-top:16px;padding:12px 14px;background:#f5f5f5;border-radius:8px;' +
      'font-size:11px;color:#666;line-height:1.7">' +
      '<strong>ℹ️ Cómo funciona:</strong> El contrato se genera en el navegador usando la plantilla ' +
      '<code>contrato_template.docx</code> del repositorio.' +
      '</div></div>' +

      // ── Tabla ventas ──
      (lotes.length > 0
        ? '<div class="card" style="margin-top:12px"><div class="ct">Ventas registradas</div>' +
          '<div class="tw" style="margin-top:10px"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead>' +
          '<tr style="background:#f0f4ff">' +
          '<th style="padding:7px 10px;text-align:left">Lote</th>' +
          '<th style="padding:7px 10px;text-align:left">Comprador</th>' +
          '<th style="padding:7px 10px;text-align:left">Cédula</th>' +
          '<th style="padding:7px 10px;text-align:left">E. Civil</th>' +
          '<th style="padding:7px 10px;text-align:left">Ciudad</th>' +
          '<th style="padding:7px 10px;text-align:left">Teléfono</th>' +
          '<th style="padding:7px 10px;text-align:left">Precio</th>' +
          '<th style="padding:7px 10px;text-align:left">Pago</th>' +
          '<th style="padding:7px 10px;text-align:center">Contrato</th></tr></thead><tbody>' +
          lotes.map(function(l, i) {
            return '<tr style="border-top:1px solid #eee">' +
              '<td style="padding:7px 10px;font-weight:700">' + l.id + '</td>' +
              '<td style="padding:7px 10px">' + (l.buyer || '—') + '</td>' +
              '<td style="padding:7px 10px">' + (l.cc || '—') + '</td>' +
              '<td style="padding:7px 10px">' + (conjugarEstadoCivil(l.marital, l.gender) || '—') + '</td>' +
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

    window._ctLotes = lotes;

    panel.querySelectorAll('input[name="tipoContrato"]').forEach(function(r) {
      r.addEventListener('change', actualizarUI);
    });

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

    // Precargar linderos en background al abrir el panel
    cargarLinderos().then(function(mapa) {
      var n = Object.keys(mapa).length;
      if (n > 0) console.log('[contratos] Linderos listos: ' + n + ' lotes.');
      else console.warn('[contratos] Sin linderos. Verifica la tabla lot_linderos en Supabase.');
    });
  }

  function actualizarUI() {
    var tipo    = (document.querySelector('input[name="tipoContrato"]:checked') || {}).value || 'manual';
    var esDatos = tipo === 'datos';
    var wrap    = document.getElementById('selectLoteWrap');
    var lblPaso = document.getElementById('labelPasoP');
    var lblMan  = document.getElementById('lbl-manual');
    var lblDat  = document.getElementById('lbl-datos');
    if (wrap)    wrap.style.display  = esDatos ? 'block'   : 'none';
    if (lblPaso) lblPaso.textContent = esDatos ? 'Paso 3'  : 'Paso 2';
    if (lblMan)  { lblMan.style.borderColor = esDatos ? '#ccc' : '#1565C0'; lblMan.style.background = esDatos ? '#fff' : '#e8f0fe'; }
    if (lblDat)  { lblDat.style.borderColor = esDatos ? '#1565C0' : '#ccc'; lblDat.style.background = esDatos ? '#e8f0fe' : '#fff'; }
  }

  window._ctGenerar = function() {
    var tipo       = (document.querySelector('input[name="tipoContrato"]:checked') || {}).value || 'manual';
    var modoManual = tipo === 'manual';
    var incluirPar = !!(document.getElementById('chkParrafo') || {}).checked;
    if (!modoManual) {
      var sel = document.getElementById('selectLote');
      var idx = sel ? parseInt(sel.value) : NaN;
      if (isNaN(idx) || !sel || sel.value === '') { alert('Por favor selecciona un lote de la lista.'); return; }
      generarContrato(window._ctLotes[idx], false, incluirPar);
    } else {
      generarContrato({}, true, incluirPar);
    }
  };

  window._ctGenerarIdx = function(idx) {
    var lote = (window._ctLotes || [])[idx];
    if (!lote) return;
    var incluirPar = !!(document.getElementById('chkParrafo') || {}).checked;
    generarContrato(lote, false, incluirPar);
  };

  window.initContratos = renderContratos;

})();
