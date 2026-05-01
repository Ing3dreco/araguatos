/* ══════════════════════════════════════════════════════════════════
   tab-contratos.js  —  Araguatos · ING3DRECO SAS
   v6 — bug raíz resuelto:

   PROBLEMA REAL: cargarLinderos() se ejecuta en background al abrir
   el panel, cuando SB_TOKEN todavía puede estar vacío. El fetch
   devuelve [] (tabla vacía por RLS sin JWT) y se guarda {} en caché.
   Todas las llamadas posteriores — incluso con token válido — devuelven
   {} sin ir a Supabase porque el caché no es null.

   SOLUCIÓN:
   · _linderosCache = null → nunca cargado
   · _linderosCache = null → cargó pero vino vacío (NO cachear vacío)
   · _linderosCache = {...} → tiene datos reales (sí cachear)
   · pullLinderos() (llamado por tab-config.js tras auth) fuerza fetch
     con el JWT ya activo y actualiza el badge del panel si está abierto
   · generarContrato() siempre llama cargarLinderos(true) para ignorar
     caché y garantizar datos frescos con token válido

   Otros fixes incluidos:
   · {GENERO_ID}: "cédula de ciudadanía No." o "NIT No."
   · {FECHA_INICIO_P}: hoy + 30 días
   · {CUOTA_INICIAL_N}, {PRECIO_NUM}, {SALDO_N}, {VALOR_CUOTA_N}:
     corregidos en el .docx (tenían $ espúreo)
   · Badge de estado de linderos visible en el panel
══════════════════════════════════════════════════════════════════ */

(function () {

  var TEMPLATE_PATH = 'contrato_template.docx';
  var CDN_PIZZIP    = 'js/libs/pizzip.min.js';
  var CDN_TEMPLATER = 'js/libs/docxtemplater.js';

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
    GENERO_ID       : 'cédula de ciudadanía No.',
  };

  // ═══════════════════════════════════════════════════════════════
  // UTILIDADES
  // ═══════════════════════════════════════════════════════════════

  function monedaM(m) {
    if (!m || isNaN(m)) return '';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', maximumFractionDigits: 0
    }).format(Math.round(m * 1e6));
  }

  function numFmtM(m) {
    if (!m || isNaN(m)) return '';
    return new Intl.NumberFormat('es-CO').format(Math.round(m * 1e6));
  }

  function numALetras(millones) {
    if (!millones || isNaN(millones)) return '';
    var pesos = Math.round(Number(millones) * 1e6);
    if (pesos === 0) return 'CERO PESOS MONEDA CORRIENTE';
    var U = ['','UN','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE','DIEZ','ONCE',
             'DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS','DIECISIETE','DIECIOCHO','DIECINUEVE'];
    var D = ['','','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA'];
    var C = ['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS',
             'SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS'];
    function dec(n) { return n < 20 ? U[n] : D[Math.floor(n/10)] + (n%10 ? ' Y '+U[n%10] : ''); }
    function cien(n) {
      if (!n) return ''; if (n === 100) return 'CIEN';
      var c = Math.floor(n/100), r = n%100;
      return (c ? C[c] : '') + (r ? (c ? ' ' : '') + dec(r) : '');
    }
    var mm=Math.floor(pesos/1e9), m2=Math.floor((pesos%1e9)/1e6),
        k=Math.floor((pesos%1e6)/1e3), r=pesos%1e3, p=[];
    if (mm) p.push(cien(mm)+' MIL MILLONES');
    if (m2) p.push(m2===1 ? 'UN MILLÓN' : cien(m2)+' MILLONES');
    if (k)  p.push(k===1  ? 'MIL'       : cien(k)+' MIL');
    if (r)  p.push(cien(r));
    return p.join(' ') + ' PESOS MONEDA CORRIENTE';
  }

  var MESES = ['enero','febrero','marzo','abril','mayo','junio',
               'julio','agosto','septiembre','octubre','noviembre','diciembre'];

  function fechaFormato(d) {
    return d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear();
  }
  function fechaHoy()         { return fechaFormato(new Date()); }
  function fechaInicioPago()  { var d=new Date(); d.setDate(d.getDate()+30); return fechaFormato(d); }

  function numALetrasEntero(n) {
    var U=['','UN','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE','DIEZ','ONCE',
           'DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS','DIECISIETE','DIECIOCHO','DIECINUEVE'];
    var D=['','','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA'];
    var C=['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS',
           'SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS'];
    function grupo(x) {
      if (!x) return ''; if (x===100) return 'CIEN';
      var c=Math.floor(x/100), r=x%100, t=c ? C[c] : '';
      if (r<20) t+=(t?' ':'')+U[r];
      else { var dv=Math.floor(r/10),uv=r%10; t+=(t?' ':'')+D[dv]+(uv?' Y '+U[uv]:''); }
      return t;
    }
    var k=Math.floor(n/1000), r=n%1000, p=[];
    if (k) p.push(grupo(k)+' MIL');
    if (r) p.push(grupo(r));
    return p.join(' ') || 'CERO';
  }

  function areaTexto(m2) {
    if (!m2) return BLANK.AREA_TEXTO;
    var n = Math.round(Number(m2));
    return numALetrasEntero(n) + ' (' + n + ') METROS CUADRADOS';
  }

  function generoId(lote) {
    return (!lote || lote.docType === 'nit') ? 'NIT No.' : 'cédula de ciudadanía No.';
  }

  function conjugar(gender) {
    var M=gender==='M', F=gender==='F';
    return {
      TITULO_COMPRADOR: F?'LA PROMITENTE COMPRADORA':M?'EL PROMITENTE COMPRADOR':'EL/LA PROMITENTE COMPRADOR/A',
      IDENTIFICADO    : F?'identificada'  :M?'identificado'  :'identificado/a',
      ESTE_A          : F?'esta'          :M?'este'          :'este/a',
      EL_LA           : F?'la'            :M?'el'            :'el/la',
    };
  }

  function conjugarEstadoCivil(marital, gender) {
    if (!marital) return BLANK.ESTADO_CIVIL;
    var m=marital.toLowerCase().trim(), F=gender==='F', M=gender==='M';
    var mapa = {
      'soltero':['soltero/a','soltero','soltera'],
      'soltera':['soltero/a','soltero','soltera'],
      'soltero/a':['soltero/a','soltero','soltera'],
      'casado':['casado/a','casado','casada'],
      'casada':['casado/a','casado','casada'],
      'casado/a':['casado/a','casado','casada'],
      'divorciado':['divorciado/a','divorciado','divorciada'],
      'divorciada':['divorciado/a','divorciado','divorciada'],
      'divorciado/a':['divorciado/a','divorciado','divorciada'],
      'viudo':['viudo/a','viudo','viuda'],
      'viuda':['viudo/a','viudo','viuda'],
      'viudo/a':['viudo/a','viudo','viuda'],
      'unión libre':['unión libre','unión libre','unión libre'],
      'union libre':['unión libre','unión libre','unión libre'],
      'compañero permanente':['compañero/a permanente','compañero permanente','compañera permanente'],
      'compañera permanente':['compañero/a permanente','compañero permanente','compañera permanente'],
    };
    var f=mapa[m]; if (!f) return marital;
    return F?f[2]:M?f[1]:f[0];
  }

  // ═══════════════════════════════════════════════════════════════
  // LINDEROS — BUG RAÍZ RESUELTO
  // ═══════════════════════════════════════════════════════════════

  // null = nunca intentado (o falló)
  // {}   = intentó pero Supabase devolvió [] (NO se guarda en caché)
  // {A01:{...}} = datos reales → SÍ se cachea
  var _linderosCache = null;

  /* Construye los headers usando sbH() de tab-config.js si ya está
     disponible (tiene el JWT real), o cae al anon key como fallback. */
  function _headers() {
    if (typeof sbH === 'function') return sbH();
    var key = typeof SB_KEY   !== 'undefined' ? SB_KEY   : '';
    var tok = typeof SB_TOKEN !== 'undefined' && SB_TOKEN ? SB_TOKEN : key;
    return { 'apikey': key, 'Authorization': 'Bearer ' + tok };
  }

  function _baseUrl() {
    return typeof SB_URL !== 'undefined' ? SB_URL : '';
  }

  /* Actualiza el badge visual del panel si está montado */
  function _actualizarBadge(mapa) {
    var badge = document.getElementById('lindStatusBadge');
    if (!badge) return;
    var n = Object.keys(mapa).length;
    if (n > 0) {
      badge.textContent  = '✅ Linderos listos: ' + n + ' lotes';
      badge.style.color  = '#2e7d32';
    } else {
      badge.textContent  = '⚠️ Sin linderos — tabla lot_linderos vacía o sin permisos';
      badge.style.color  = '#e65100';
    }
  }

  /**
   * cargarLinderos(forzar)
   *   forzar = true  → siempre va a Supabase (ignora caché y localStorage)
   *   forzar = false → usa caché en memoria → localStorage → Supabase
   *
   * REGLA CLAVE: solo se cachea cuando hay datos reales (length > 0).
   * Si Supabase devuelve [], _linderosCache queda en null para que el
   * próximo intento (ya con token) vuelva a intentarlo.
   */
  function cargarLinderos(forzar) {
    return new Promise(function(resolve) {

      // ── 1. Caché en memoria con datos reales ──────────────────
      if (!forzar && _linderosCache && Object.keys(_linderosCache).length > 0) {
        console.log('[linderos] ✓ Desde caché memoria (' + Object.keys(_linderosCache).length + ' lotes)');
        resolve(_linderosCache);
        return;
      }

      // ── 2. localStorage con datos reales ─────────────────────
      if (!forzar) {
        try {
          var raw = localStorage.getItem('araguatos_linderos');
          if (raw) {
            var cached = JSON.parse(raw);
            if (cached && Object.keys(cached).length > 0) {
              _linderosCache = cached;
              console.log('[linderos] ✓ Desde localStorage (' + Object.keys(cached).length + ' lotes)');
              resolve(_linderosCache);
              return;
            }
          }
        } catch(e) {}
      }

      // ── 3. Fetch a Supabase ───────────────────────────────────
      var url = _baseUrl();
      if (!url) {
        console.warn('[linderos] Sin SB_URL — omitiendo');
        resolve({});
        return;
      }

      var token = typeof SB_TOKEN !== 'undefined' ? SB_TOKEN : '';
      console.log('[linderos] Fetching Supabase... (token ' + (token ? 'presente' : 'VACÍO — RLS puede bloquear') + ')');

      fetch(url + '/rest/v1/lot_linderos?select=*', { headers: _headers() })
        .then(function(r) {
          console.log('[linderos] HTTP', r.status);
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function(data) {
          console.log('[linderos] Filas recibidas:', Array.isArray(data) ? data.length : typeof data);

          if (!Array.isArray(data) || data.length === 0) {
            // ⚠ NO cachear vacío — próximo intento reintentará con token
            console.warn('[linderos] ⚠ Respuesta vacía. Posibles causas:\n' +
              '  1) La tabla lot_linderos no tiene filas\n' +
              '  2) RLS bloquea lectura sin JWT (intenta de nuevo post-auth)\n' +
              '  3) El nombre de la tabla es distinto');
            _linderosCache = null;   // ← clave: no cachear el vacío
            resolve({});
            return;
          }

          // Mapear filas → { lot_id: { norte_dist, norte_desc, ... } }
          // Columnas reales en Supabase: n_dist, n_desc, s_dist, s_desc,
          //   e_dist, e_desc, o_dist, o_desc
          var mapa = {};
          data.forEach(function(row) {
            mapa[row.lot_id] = {
              norte_dist: row.n_dist || '',
              norte_desc: row.n_desc || '',
              sur_dist  : row.s_dist || '',
              sur_desc  : row.s_desc || '',
              este_dist : row.e_dist || '',
              este_desc : row.e_desc || '',
              oeste_dist: row.o_dist || '',
              oeste_desc: row.o_desc || '',
            };
          });

          _linderosCache = mapa;
          try { localStorage.setItem('araguatos_linderos', JSON.stringify(mapa)); } catch(e) {}

          console.log('[linderos] ✅ Cargados', Object.keys(mapa).length, 'lotes:',
            Object.keys(mapa).slice(0,10).join(', '));

          _actualizarBadge(mapa);
          resolve(mapa);
        })
        .catch(function(err) {
          console.error('[linderos] ❌ Error:', err.message);
          _linderosCache = null;   // no cachear errores — permitir reintentos
          resolve({});
        });
    });
  }

  /* Lectura puntual desde caché ya cargada */
  function getLinderos(loteId) {
    if (_linderosCache && _linderosCache[loteId]) return _linderosCache[loteId];
    try {
      var raw = localStorage.getItem('araguatos_linderos');
      if (raw) { var o = JSON.parse(raw); if (o && o[loteId]) return o[loteId]; }
    } catch(e) {}
    return {};
  }

  // ── Exportados a window para que tab-config.js los invoque ───
  window.pushLinderos = function() { /* linderos se editan directo en Supabase */ };

  window.pullLinderos = function() {
    // Llamado por pullFromSupabase() en tab-config.js, ya con JWT activo
    console.log('[linderos] pullLinderos() — forzando recarga con JWT activo');
    _linderosCache = null;
    try { localStorage.removeItem('araguatos_linderos'); } catch(e) {}
    cargarLinderos(true).then(function(mapa) {
      _actualizarBadge(mapa);
      var n = Object.keys(mapa).length;
      if (n > 0) console.log('[linderos] pullLinderos OK:', n, 'lotes');
      else console.warn('[linderos] pullLinderos: 0 filas — revisa la tabla y RLS en Supabase');
    });
  };

  // ═══════════════════════════════════════════════════════════════
  // BUILD DATA PARA EL TEMPLATE
  // ═══════════════════════════════════════════════════════════════
  function buildData(lote, modoManual, incluirParrafo, linderosMap) {
    var gender = modoManual ? '' : (lote.gender || '');
    var conj   = conjugar(gender);

    if (modoManual) {
      return Object.assign({}, BLANK, {
        FECHA_FIRMA     : fechaHoy(),
        FECHA_INICIO_P  : fechaInicioPago(),
        GENERO_ID       : BLANK.GENERO_ID,
        TITULO_COMPRADOR: conj.TITULO_COMPRADOR,
        IDENTIFICADO    : conj.IDENTIFICADO,
        ESTE_A          : conj.ESTE_A,
        EL_LA           : conj.EL_LA,
        INCLUIR_PARRAFO : incluirParrafo,
      });
    }

    var esContado = lote.payType === 'cash';
    var precio    = Number(lote.salePrice) || 0;
    var cuotaIni  = Number(lote.dnAmt)     || 0;
    var saldo     = Math.max(0, precio - cuotaIni);
    var cuotaMes  = Number(lote.cmAmt) || (lote.mo > 0 ? saldo / lote.mo : 0);

    // Linderos: primero del mapa recién cargado, luego del caché
    var lind = (linderosMap && linderosMap[lote.id])
               ? linderosMap[lote.id]
               : getLinderos(lote.id);

    console.log('[contratos] Linderos para', lote.id, '→', JSON.stringify(lind));

    return {
      NOMBRE_COMPLETO  : lote.buyer       || BLANK.NOMBRE_COMPLETO,
      NACIONALIDAD     : lote.nationality || 'colombiana',
      CEDULA           : lote.cc          || BLANK.CEDULA,
      CIUDAD_EXP       : lote.ccCity      || BLANK.CIUDAD_EXP,
      ESTADO_CIVIL     : conjugarEstadoCivil(lote.marital, gender),
      DOMICILIO        : lote.city        || BLANK.DOMICILIO,
      GENERO_ID        : generoId(lote),
      TITULO_COMPRADOR : conj.TITULO_COMPRADOR,
      IDENTIFICADO     : conj.IDENTIFICADO,
      ESTE_A           : conj.ESTE_A,
      EL_LA            : conj.EL_LA,
      LOTE_NUM         : String(lote.n    || BLANK.LOTE_NUM),
      MANZANA          : String(lote.m    || BLANK.MANZANA),
      AREA_TEXTO       : areaTexto(lote.area),
      AREA_M2          : String(lote.area || BLANK.AREA_M2),
      NORTE_DIST: lind.norte_dist || BLANK.NORTE_DIST,
      NORTE_DESC: lind.norte_desc || BLANK.NORTE_DESC,
      SUR_DIST  : lind.sur_dist   || BLANK.SUR_DIST,
      SUR_DESC  : lind.sur_desc   || BLANK.SUR_DESC,
      ESTE_DIST : lind.este_dist  || BLANK.ESTE_DIST,
      ESTE_DESC : lind.este_desc  || BLANK.ESTE_DESC,
      OESTE_DIST: lind.oeste_dist || BLANK.OESTE_DIST,
      OESTE_DESC: lind.oeste_desc || BLANK.OESTE_DESC,
      PRECIO_TEXTO    : precio   > 0 ? numALetras(precio)   : BLANK.PRECIO_TEXTO,
      PRECIO_NUM      : precio   > 0 ? numFmtM(precio)      : BLANK.PRECIO_NUM,
      CUOTA_INICIAL_T : cuotaIni > 0 ? numALetras(cuotaIni) : BLANK.CUOTA_INICIAL_T,
      CUOTA_INICIAL_N : cuotaIni > 0 ? numFmtM(cuotaIni)   : BLANK.CUOTA_INICIAL_N,
      SALDO_T         : saldo    > 0 ? numALetras(saldo)    : BLANK.SALDO_T,
      SALDO_N         : saldo    > 0 ? numFmtM(saldo)       : BLANK.SALDO_N,
      VALOR_CUOTA_T   : cuotaMes > 0 ? numALetras(cuotaMes) : BLANK.VALOR_CUOTA_T,
      VALOR_CUOTA_N   : cuotaMes > 0 ? numFmtM(cuotaMes)   : BLANK.VALOR_CUOTA_N,
      PAGO_TIPO       : esContado ? 'X' : '   ',
      PAGO_TIPO_FIN   : esContado ? '   ' : 'X',
      NUM_CUOTAS      : String(lote.mo || BLANK.NUM_CUOTAS),
      CUOTA_FINAL_T   : BLANK.CUOTA_FINAL_T,
      CUOTA_FINAL_N   : BLANK.CUOTA_FINAL_N,
      FECHA_INICIO_P  : fechaInicioPago(),
      DIRECCION_COMP  : lote.addr  || BLANK.DIRECCION_COMP,
      CORREO_COMP     : lote.email || BLANK.CORREO_COMP,
      TELEFONO_COMP   : lote.phone || BLANK.TELEFONO_COMP,
      CC_COMPRADOR    : lote.cc    || BLANK.CC_COMPRADOR,
      CEL_COMPRADOR   : lote.phone || BLANK.CEL_COMPRADOR,
      FECHA_FIRMA     : fechaHoy(),
      INCLUIR_PARRAFO : incluirParrafo,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // LOTES CON VENTA
  // ═══════════════════════════════════════════════════════════════
  function getLotesConVenta() {
    try {
      if (window.S && Array.isArray(window.S.lots))
        return window.S.lots.filter(function(l) {
          return l.status === 'sold' || l.status === 'apartado';
        });
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
        var s2 = document.createElement('script');
        s2.src = CDN_TEMPLATER;
        s2.onerror = function() { reject(new Error('No se pudo cargar Docxtemplater.')); };
        s2.onload = function() {
          if (typeof Docxtemplater === 'undefined' && typeof window.docxtemplater !== 'undefined')
            window.Docxtemplater = window.docxtemplater;
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

    if (typeof Docxtemplater === 'undefined' && typeof window.docxtemplater !== 'undefined')
      window.Docxtemplater = window.docxtemplater;

    // Siempre forzar fetch de linderos al generar:
    // en este punto el JWT ya está activo y RLS permite la lectura
    Promise.all([cargarLibrerias(), cargarLinderos(true)])
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
          paragraphLoop: true, linebreaks: true, nullGetter: function() { return ''; },
        });
        doc.render(buildData(lote, modoManual, incluirParrafo, obj.lind));
        var blob = doc.getZip().generate({
          type: 'blob',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
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

      // Paso 1
      '<div style="margin-bottom:22px">' +
      '<div style="font-size:11px;font-weight:700;color:#1a237e;margin-bottom:10px;' +
      'text-transform:uppercase;letter-spacing:.8px">Paso 1 · Tipo de contrato</div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
      '<label id="lbl-manual" style="cursor:pointer;flex:1;min-width:200px;display:flex;' +
      'align-items:flex-start;gap:10px;padding:12px 14px;border:2px solid #1565C0;' +
      'border-radius:10px;background:#e8f0fe;transition:.2s">' +
      '<input type="radio" name="tipoContrato" value="manual" checked style="margin-top:2px;accent-color:#1565C0">' +
      '<div><div style="font-size:13px;font-weight:700">📝 Para diligenciar manualmente</div>' +
      '<div style="font-size:11px;color:#555;margin-top:3px">Campos con líneas en blanco</div></div></label>' +
      '<label id="lbl-datos" style="cursor:pointer;flex:1;min-width:200px;display:flex;' +
      'align-items:flex-start;gap:10px;padding:12px 14px;border:2px solid #ccc;' +
      'border-radius:10px;background:#fff;transition:.2s">' +
      '<input type="radio" name="tipoContrato" value="datos" style="margin-top:2px;accent-color:#1565C0">' +
      '<div><div style="font-size:13px;font-weight:700">✅ Con datos de una venta</div>' +
      '<div style="font-size:11px;color:#555;margin-top:3px">Completa automáticamente desde VENTAS</div></div></label>' +
      '</div></div>' +

      // Paso 2 selector de lote
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

      // Parágrafo
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

      // Botón + badge de linderos
      '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:14px">' +
      '<button id="btnGenerar" class="btn bg" ' +
      'style="font-size:14px;padding:13px 32px;letter-spacing:.3px;border-radius:9px" ' +
      'onclick="window._ctGenerar()">📥 Descargar Contrato (.docx)</button>' +
      '<span id="lindStatusBadge" style="font-size:12px;color:#888">⏳ Verificando linderos…</span>' +
      '</div>' +

      '<div style="padding:12px 14px;background:#f5f5f5;border-radius:8px;font-size:11px;color:#666;line-height:1.7">' +
      '<strong>ℹ️ Cómo funciona:</strong> El contrato se genera en el navegador usando la plantilla ' +
      '<code>contrato_template.docx</code> del repositorio. Los linderos se leen de la tabla ' +
      '<code>lot_linderos</code> en Supabase.' +
      '</div></div>' +

      // Tabla de ventas
      (lotes.length > 0
        ? '<div class="card" style="margin-top:12px"><div class="ct">Ventas registradas</div>' +
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
          '<th style="padding:7px 10px;text-align:center">Contrato</th></tr></thead><tbody>' +
          lotes.map(function(l, i) {
            return '<tr style="border-top:1px solid #eee">' +
              '<td style="padding:7px 10px;font-weight:700">' + l.id + '</td>' +
              '<td style="padding:7px 10px">' + (l.buyer || '—') + '</td>' +
              '<td style="padding:7px 10px">' + (l.cc    || '—') + '</td>' +
              '<td style="padding:7px 10px">' + (conjugarEstadoCivil(l.marital, l.gender) || '—') + '</td>' +
              '<td style="padding:7px 10px">' + (l.city  || '—') + '</td>' +
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

    document.getElementById('chkParrafo').addEventListener('change', function() {
      var lbl = document.getElementById('lbl-parrafo');
      if (lbl) {
        lbl.style.borderColor = this.checked ? '#1565C0' : '#ccc';
        lbl.style.background  = this.checked ? '#e8f0fe' : '#fff';
      }
    });

    // Cargar linderos: si ya hay caché con datos, muestra el badge de inmediato.
    // Si el caché está vacío o null, intenta fetch (puede estar sin token aún;
    // en ese caso pullLinderos() lo completará cuando llegue onAuthSuccess).
    cargarLinderos(false).then(_actualizarBadge);
  }

  function actualizarUI() {
    var tipo    = (document.querySelector('input[name="tipoContrato"]:checked') || {}).value || 'manual';
    var esDatos = tipo === 'datos';
    var wrap    = document.getElementById('selectLoteWrap');
    var lblPaso = document.getElementById('labelPasoP');
    var lblMan  = document.getElementById('lbl-manual');
    var lblDat  = document.getElementById('lbl-datos');
    if (wrap)    wrap.style.display  = esDatos ? 'block'  : 'none';
    if (lblPaso) lblPaso.textContent = esDatos ? 'Paso 3' : 'Paso 2';
    if (lblMan)  { lblMan.style.borderColor = esDatos?'#ccc':'#1565C0'; lblMan.style.background = esDatos?'#fff':'#e8f0fe'; }
    if (lblDat)  { lblDat.style.borderColor = esDatos?'#1565C0':'#ccc'; lblDat.style.background = esDatos?'#e8f0fe':'#fff'; }
  }

  window._ctGenerar = function() {
    var tipo       = (document.querySelector('input[name="tipoContrato"]:checked') || {}).value || 'manual';
    var modoManual = tipo === 'manual';
    var incluirPar = !!(document.getElementById('chkParrafo') || {}).checked;
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
    var incluirPar = !!(document.getElementById('chkParrafo') || {}).checked;
    generarContrato(lote, false, incluirPar);
  };

  window.initContratos = renderContratos;

})();
