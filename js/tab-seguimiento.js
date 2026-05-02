/* ═══════════════════════════════════════════════════════════════
   tab-seguimiento.js  —  Araguatos · ING3DRECO SAS  v2
   Cambios v2:
     AGENDA  : Clic en día del calendario → ver/crear eventos del día
               Fix timezone: fechas en hora local (no UTC)
               Editar eventos
     PAGOS   : Editar fecha de vencimiento y monto de cada cuota
               Fix monto: se guarda en millones COP → mostrar correcto
     PROSPECTOS: Vendedores registrables, filtro por vendedor,
                 badge de vendedor en cada card
   ═══════════════════════════════════════════════════════════════ */

(function () {

  /* ── Estado local ─────────────────────────────────────────── */
  var _pagos       = [];
  var _prospectos  = [];
  var _eventos     = [];
  var _vendedores  = [];
  var _vendedorActivo = null;   // id del vendedor seleccionado en sesión
  var _vistaActiva = 'agenda';
  var _mesActual   = new Date();
  var _diaSeleccionado = null;  // iso string del día clickeado
  var _realtimeSubs = [];

  /* ── Helpers de fecha — FIX TIMEZONE ─────────────────────────
     Problema: new Date().toISOString() devuelve UTC, que en Colombia
     (UTC-5) hace que una fecha local aparezca como el día anterior.
     Solución: construir siempre las fechas en hora local.
  ───────────────────────────────────────────────────────────── */
  var MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var DIAS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

  /* Fecha de hoy en formato YYYY-MM-DD usando hora LOCAL */
  function hoy() {
    var d = new Date();
    return _padFecha(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  /* Hora local actual para datetime-local input: YYYY-MM-DDTHH:MM */
  function ahoraLocal() {
    var d = new Date();
    return _padFecha(d.getFullYear(), d.getMonth() + 1, d.getDate()) +
           'T' + _pad(d.getHours()) + ':' + _pad(d.getMinutes());
  }

  function _pad(n) { return n < 10 ? '0' + n : '' + n; }
  function _padFecha(y, m, d) { return y + '-' + _pad(m) + '-' + _pad(d); }

  /* Extrae YYYY-MM-DD de cualquier string ISO o Date, en hora local */
  function isoFecha(d) {
    if (!d) return '';
    if (d instanceof Date) {
      return _padFecha(d.getFullYear(), d.getMonth() + 1, d.getDate());
    }
    // Si viene con T (datetime), tomar solo la parte de fecha
    return String(d).slice(0, 10);
  }

  function diffDias(fechaIso) {
    if (!fechaIso) return 0;
    // Comparar solo fechas (sin hora) para evitar drift de timezone
    var hoyParts = hoy().split('-').map(Number);
    var fParts   = fechaIso.slice(0,10).split('-').map(Number);
    var hoyMs = Date.UTC(hoyParts[0], hoyParts[1]-1, hoyParts[2]);
    var fMs   = Date.UTC(fParts[0],   fParts[1]-1,   fParts[2]);
    return Math.round((fMs - hoyMs) / 86400000);
  }

  function fmtFecha(iso) {
    if (!iso) return '—';
    var p = iso.slice(0,10).split('-');
    return parseInt(p[2]) + ' ' + MESES[parseInt(p[1])-1].slice(0,3) + ' ' + p[0];
  }

  /* Formatea hora desde string datetime: "2025-06-15T17:30" → "5:30 PM" */
  function fmtHora(datetimeStr) {
    if (!datetimeStr || !datetimeStr.includes('T')) return '';
    var partes = datetimeStr.split('T');
    if (partes.length < 2) return '';
    var hm = partes[1].slice(0,5).split(':');
    var h  = parseInt(hm[0]), m = hm[1];
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return h + ':' + m + ' ' + ampm;
  }

  function fmtMonto(millones) {
    if (millones === null || millones === undefined || millones === '') return '—';
    var val = Number(millones);
    if (isNaN(val)) return '—';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', maximumFractionDigits: 0
    }).format(Math.round(val * 1e6));
  }

  /* ── Acceso a Supabase ────────────────────────────────────── */
  function sbUrl()  { return typeof SB_URL !== 'undefined' ? SB_URL : ''; }
  function sbHead() { return typeof sbH === 'function' ? sbH() : {}; }

  function sbFetch(table, query) {
    return fetch(sbUrl() + '/rest/v1/' + table + '?' + (query || 'select=*'), {
      headers: sbHead()
    }).then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' en ' + table);
      return r.json();
    });
  }

  function sbInsert(table, data) {
    return fetch(sbUrl() + '/rest/v1/' + table, {
      method: 'POST',
      headers: Object.assign({}, sbHead(), { 'Content-Type': 'application/json', 'Prefer': 'return=representation' }),
      body: JSON.stringify(data)
    }).then(function(r) {
      if (!r.ok) return r.text().then(function(t){ throw new Error(t); });
      return r.json();
    });
  }

  function sbUpdate(table, id, data) {
    return fetch(sbUrl() + '/rest/v1/' + table + '?id=eq.' + id, {
      method: 'PATCH',
      headers: Object.assign({}, sbHead(), { 'Content-Type': 'application/json', 'Prefer': 'return=representation' }),
      body: JSON.stringify(data)
    }).then(function(r) {
      if (!r.ok) return r.text().then(function(t){ throw new Error(t); });
      return r.json();
    });
  }

  function sbDelete(table, id) {
    return fetch(sbUrl() + '/rest/v1/' + table + '?id=eq.' + id, {
      method: 'DELETE', headers: sbHead()
    });
  }

  /* ── Carga de datos ───────────────────────────────────────── */
  function cargarTodo() {
    var url = sbUrl();
    if (!url) { _renderVista(); return; }

    Promise.all([
      sbFetch('pagos',       'select=*&order=fecha_vence.asc'),
      sbFetch('prospectos',  'select=*&order=created_at.desc'),
      sbFetch('eventos',     'select=*&order=fecha.asc'),
      sbFetch('vendedores',  'select=*&order=nombre.asc')
    ]).then(function(res) {
      _pagos      = res[0] || [];
      _prospectos = res[1] || [];
      _eventos    = res[2] || [];
      _vendedores = res[3] || [];
      _renderVista();
      _iniciarRealtime();
    }).catch(function(e) {
      console.error('[Seguimiento] Error cargando datos:', e);
      _renderVista();
    });
  }

  /* ── Realtime ─────────────────────────────────────────────── */
  function _iniciarRealtime() {
    if (typeof window.supabase === 'undefined') return;
    _realtimeSubs.forEach(function(s) { try { s.unsubscribe(); } catch(e){} });
    _realtimeSubs = [];
    ['pagos','prospectos','eventos','vendedores'].forEach(function(tabla) {
      var sub = window.supabase.channel('seg-' + tabla)
        .on('postgres_changes', { event: '*', schema: 'public', table: tabla }, cargarTodo)
        .subscribe();
      _realtimeSubs.push(sub);
    });
  }

  /* ── Cuotas automáticas ───────────────────────────────────── */
  function generarCuotasDeLote(lote) {
    if (lote.payType === 'cash' || !lote.mo || lote.mo <= 0) return [];
    var precio   = Number(lote.salePrice) || 0;
    var dn       = Number(lote.dnAmt) || precio * (lote.dn || 20) / 100;
    var saldo    = Math.max(0, precio - dn);
    var cuotaMes = Number(lote.cmAmt) || (saldo / lote.mo);
    var base     = lote.saleDate ? new Date(lote.saleDate + 'T12:00:00') : new Date();
    var cuotas   = [];
    for (var i = 1; i <= lote.mo; i++) {
      var f = new Date(base.getFullYear(), base.getMonth() + i, base.getDate());
      cuotas.push({
        lot_id      : lote.id,
        num_cuota   : i,
        fecha_vence : isoFecha(f),
        monto       : cuotaMes,   // en MILLONES COP
        pagado      : false,
        nota        : ''
      });
    }
    return cuotas;
  }

  function sincronizarCuotas(lote) {
    var existentes = _pagos.filter(function(p) { return p.lot_id === lote.id; });
    if (existentes.length > 0) return Promise.resolve();
    var cuotas = generarCuotasDeLote(lote);
    if (!cuotas.length) return Promise.resolve();
    return sbInsert('pagos', cuotas).then(function(nuevas) {
      _pagos = _pagos.concat(nuevas || []);
    }).catch(function(e) { console.error('[Seguimiento] Error cuotas', lote.id, e); });
  }

  /* ── Semáforo ─────────────────────────────────────────────── */
  function semaforo(pago) {
    if (pago.pagado) return { color: '#2e7d32', bg: '#e8f5e9', icono: '✅', label: 'Pagado' };
    var d = diffDias(pago.fecha_vence);
    if (d < 0)  return { color: '#c62828', bg: '#ffebee', icono: '🔴', label: 'Vencida ' + Math.abs(d) + 'd' };
    if (d <= 7) return { color: '#e65100', bg: '#fff3e0', icono: '🟡', label: 'Vence en ' + d + 'd' };
    return { color: '#1565c0', bg: '#e3f2fd', icono: '🔵', label: 'Pendiente' };
  }

  /* ══════════════════════════════════════════════════════════
     RENDER PRINCIPAL
  ══════════════════════════════════════════════════════════ */
  function _renderPanel() {
    var panel = document.getElementById('tab-seguimiento');
    if (!panel) return;
    panel.innerHTML =
      '<div style="display:flex;gap:0;margin-bottom:16px;border-bottom:2px solid #e0e0e0">' +
      _tabBtn('agenda',     '📅 Agenda',     _vistaActiva) +
      _tabBtn('pagos',      '💳 Pagos',      _vistaActiva) +
      _tabBtn('prospectos', '👥 Prospectos', _vistaActiva) +
      '</div><div id="seg-contenido"></div>';

    panel.querySelectorAll('[data-segtab]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        _vistaActiva = this.dataset.segtab;
        _diaSeleccionado = null;
        _renderPanel();
      });
    });
    _renderVista();
  }

  function _tabBtn(id, label, activa) {
    var on = id === activa;
    return '<button data-segtab="' + id + '" style="padding:10px 20px;border:none;background:none;cursor:pointer;' +
      'font-size:13px;font-weight:' + (on?'800':'500') + ';color:' + (on?'#1565C0':'#666') + ';' +
      'border-bottom:' + (on?'3px solid #1565C0':'3px solid transparent') + ';margin-bottom:-2px;transition:.15s">' + label + '</button>';
  }

  function _renderVista() {
    var c = document.getElementById('seg-contenido');
    if (!c) return;
    if (_vistaActiva === 'agenda')          _renderAgenda(c);
    else if (_vistaActiva === 'pagos')      _renderPagos(c);
    else                                    _renderProspectos(c);
  }

  /* ══════════════════════════════════════════════════════════
     VISTA 1 — AGENDA
  ══════════════════════════════════════════════════════════ */
  function _renderAgenda(c) {
    var hoyIso     = hoy();
    var evHoy      = _eventos.filter(function(e) { return isoFecha(e.fecha) === hoyIso && !e.completado; });
    var evProx     = _eventos.filter(function(e) { var d = diffDias(isoFecha(e.fecha)); return d >= 0 && d <= 7 && !e.completado; });
    var evVencidos = _eventos.filter(function(e) { return diffDias(isoFecha(e.fecha)) < 0 && !e.completado; });

    /* Panel lateral: si hay día seleccionado muestra sus eventos, si no los próximos */
    var panelLateral = _diaSeleccionado
      ? _panelDia(_diaSeleccionado)
      : _panelProximos();

    c.innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">' +
      _kpiBox('🔴 Vencidos', evVencidos.length, '#ffebee', '#c62828') +
      _kpiBox('🟡 Hoy', evHoy.length, '#fff3e0', '#e65100') +
      _kpiBox('🔵 Próx. 7d', evProx.length, '#e3f2fd', '#1565c0') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 340px;gap:14px;align-items:start">' +
      '<div class="card" style="padding:16px">' + _buildCalendario() + '</div>' +
      '<div>' + panelLateral + '</div>' +
      '</div>';

    /* Navegación calendario */
    var prev = document.getElementById('calPrev');
    var next = document.getElementById('calNext');
    if (prev) prev.onclick = function() {
      _mesActual = new Date(_mesActual.getFullYear(), _mesActual.getMonth() - 1, 1);
      _renderVista();
    };
    if (next) next.onclick = function() {
      _mesActual = new Date(_mesActual.getFullYear(), _mesActual.getMonth() + 1, 1);
      _renderVista();
    };

    /* Clics en días del calendario */
    c.querySelectorAll('[data-caldia]').forEach(function(cel) {
      cel.addEventListener('click', function() {
        _diaSeleccionado = this.dataset.caldia;
        _renderVista();
      });
    });

    _pedirPermisoNotificacion();
  }

  /* Panel lateral: eventos de un día específico */
  function _panelDia(isoD) {
    var evsDia = _eventos.filter(function(e) { return isoFecha(e.fecha) === isoD; })
      .sort(function(a,b) { return (a.fecha||'') > (b.fecha||'') ? 1 : -1; });

    var label = isoD === hoy() ? 'Hoy' : fmtFecha(isoD);

    return '<div class="card" style="padding:14px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
      '<div style="font-size:13px;font-weight:800;color:#1a237e">📅 ' + label + '</div>' +
      '<div style="display:flex;gap:6px">' +
      '<button class="btn bg bsm" onclick="window._segNuevoEvento(\'' + isoD + '\')">+ Evento</button>' +
      '<button onclick="window._segCerrarDia()" style="background:none;border:none;cursor:pointer;font-size:18px;color:#888;line-height:1">✕</button>' +
      '</div></div>' +
      (evsDia.length === 0
        ? '<div style="font-size:12px;color:#999;text-align:center;padding:20px 0">Sin eventos para este día</div>'
        : evsDia.map(_cardEvento).join('')
      ) + '</div>';
  }

  /* Panel lateral: próximos 14 días */
  function _panelProximos() {
    var proximos = _eventos.filter(function(e) {
      var d = diffDias(isoFecha(e.fecha));
      return d >= -1 && d <= 14;
    }).sort(function(a,b) { return (a.fecha||'') > (b.fecha||'') ? 1 : -1; });

    return '<div class="card" style="padding:14px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
      '<div style="font-size:13px;font-weight:800;color:#1a237e">Próximos eventos</div>' +
      '<button class="btn bg bsm" onclick="window._segNuevoEvento(null)">+ Nuevo</button>' +
      '</div>' +
      (proximos.length === 0
        ? '<div style="font-size:12px;color:#999;text-align:center;padding:20px 0">Sin eventos próximos</div>'
        : proximos.map(_cardEvento).join('')
      ) + '</div>';
  }

  /* ── Calendario ───────────────────────────────────────────── */
  function _buildCalendario() {
    var anio = _mesActual.getFullYear();
    var mes  = _mesActual.getMonth();
    var hoyIso = hoy();

    var primerDia = new Date(anio, mes, 1).getDay();
    var diasMes   = new Date(anio, mes + 1, 0).getDate();

    /* Índice de eventos y pagos por día */
    var evMes = {};
    _eventos.forEach(function(e) {
      var eIso = isoFecha(e.fecha);
      var prefijo = anio + '-' + _pad(mes + 1);
      if (eIso.slice(0, 7) === prefijo) {
        var dia = parseInt(eIso.slice(8, 10));
        if (!evMes[dia]) evMes[dia] = [];
        evMes[dia].push(e);
      }
    });
    _pagos.filter(function(p) {
      return !p.pagado && p.fecha_vence &&
             p.fecha_vence.slice(0,7) === (anio + '-' + _pad(mes + 1));
    }).forEach(function(p) {
      var dia = parseInt(p.fecha_vence.slice(8, 10));
      if (!evMes[dia]) evMes[dia] = [];
      evMes[dia].push({ tipo: 'pago', titulo: 'Cuota ' + p.lot_id, fecha: p.fecha_vence });
    });

    var html =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
      '<button id="calPrev" style="background:none;border:none;font-size:18px;cursor:pointer;color:#1565c0">‹</button>' +
      '<div style="font-size:14px;font-weight:800;color:#1a237e">' + MESES[mes] + ' ' + anio + '</div>' +
      '<button id="calNext" style="background:none;border:none;font-size:18px;cursor:pointer;color:#1565c0">›</button>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:6px">' +
      DIAS.map(function(d) {
        return '<div style="text-align:center;font-size:10px;font-weight:700;color:#888;padding:4px 0">' + d + '</div>';
      }).join('') + '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">';

    for (var i = 0; i < primerDia; i++) html += '<div></div>';

    for (var d = 1; d <= diasMes; d++) {
      var iso     = anio + '-' + _pad(mes + 1) + '-' + _pad(d);
      var esHoy   = iso === hoyIso;
      var esSel   = iso === _diaSeleccionado;
      var evs     = evMes[d] || [];
      var tieneEv = evs.length > 0;

      var puntoColor = '#1565c0';
      evs.forEach(function(e) {
        if (e.tipo === 'pago') {
          var df = diffDias(iso);
          if (df < 0) puntoColor = '#c62828';
          else if (df <= 3) puntoColor = '#e65100';
        }
        if (!e.completado && diffDias(isoFecha(e.fecha)) < 0) puntoColor = '#c62828';
      });

      var bg    = esSel ? '#0d47a1' : esHoy ? '#1565C0' : 'transparent';
      var color = (esHoy || esSel) ? '#fff' : '#333';
      var borde = esSel ? '2px solid #0d47a1' : '2px solid transparent';

      html += '<div data-caldia="' + iso + '" style="' +
        'text-align:center;padding:6px 2px;border-radius:8px;font-size:12px;cursor:pointer;' +
        'background:' + bg + ';color:' + color + ';font-weight:' + (esHoy || esSel ? '800' : '400') + ';' +
        'border:' + borde + ';position:relative;transition:.1s" ' +
        'title="' + (tieneEv ? evs.length + ' evento(s)' : 'Sin eventos') + '">' +
        d +
        (tieneEv
          ? '<div style="width:5px;height:5px;border-radius:50%;background:' + ((esHoy||esSel)?'#fff':puntoColor) + ';margin:2px auto 0"></div>'
          : '<div style="height:7px"></div>') +
        '</div>';
    }

    html += '</div>';
    if (_diaSeleccionado) {
      html += '<div style="margin-top:8px;font-size:11px;color:#888;text-align:center">Clic en otro día para ver sus eventos · <a href="#" onclick="window._segCerrarDia();return false" style="color:#1565c0">Ver próximos</a></div>';
    }
    return html;
  }

  /* ── Card de evento ───────────────────────────────────────── */
  function _cardEvento(e) {
    var tipos = {
      reunion      : { icono: '🤝', color: '#1565c0', bg: '#e3f2fd' },
      llamada      : { icono: '📞', color: '#6a1b9a', bg: '#f3e5f5' },
      presentacion : { icono: '📋', color: '#2e7d32', bg: '#e8f5e9' },
      seguimiento  : { icono: '🔔', color: '#e65100', bg: '#fff3e0' },
      pago         : { icono: '💳', color: '#c62828', bg: '#ffebee' },
    };
    var t = tipos[e.tipo] || tipos.reunion;
    var d = diffDias(isoFecha(e.fecha));
    var dLabel = d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : d < 0 ? 'Hace ' + Math.abs(d) + 'd' : 'En ' + d + 'd';
    var hora   = fmtHora(e.fecha);

    return '<div style="display:flex;gap:10px;align-items:flex-start;padding:9px;border-radius:9px;margin-bottom:7px;' +
      'background:' + t.bg + ';opacity:' + (e.completado ? '.5' : '1') + '">' +
      '<div style="font-size:18px;line-height:1">' + t.icono + '</div>' +
      '<div style="flex:1;min-width:0">' +
      '<div style="font-size:12px;font-weight:700;color:' + t.color + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + e.titulo + '</div>' +
      '<div style="font-size:11px;color:#666;margin-top:2px">' + fmtFecha(isoFecha(e.fecha)) + (hora ? ' · ' + hora : '') + ' · ' + dLabel + '</div>' +
      (e.descripcion ? '<div style="font-size:11px;color:#888;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + e.descripcion + '</div>' : '') +
      '</div>' +
      '<div style="display:flex;gap:4px;flex-shrink:0">' +
      // EDITAR evento
      '<button onclick="window._segEditarEvento(\'' + e.id + '\')" title="Editar" ' +
      'style="background:none;border:none;cursor:pointer;font-size:14px;opacity:.6">✏️</button>' +
      // COMPLETAR
      (!e.completado
        ? '<button onclick="window._segCompletarEvento(\'' + e.id + '\')" title="Completar" ' +
          'style="background:none;border:none;cursor:pointer;font-size:14px">✓</button>'
        : '') +
      '</div></div>';
  }

  /* ══════════════════════════════════════════════════════════
     VISTA 2 — PAGOS  (FIX: monto en millones COP)
  ══════════════════════════════════════════════════════════ */
  function _renderPagos(c) {
    var lotesVendidos = (window.S && window.S.lots
      ? window.S.lots.filter(function(l) {
          return (l.status === 'sold' || l.status === 'apartado') && l.payType !== 'cash';
        })
      : []);

    var totalRecaudado = _pagos.filter(function(p){ return p.pagado; })
      .reduce(function(s,p){ return s + Number(p.monto); }, 0);
    var totalPendiente = _pagos.filter(function(p){ return !p.pagado; })
      .reduce(function(s,p){ return s + Number(p.monto); }, 0);
    var enMora = _pagos.filter(function(p){ return !p.pagado && diffDias(p.fecha_vence) < 0; }).length;

    c.innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">' +
      _kpiBox('✅ Recaudado', fmtMonto(totalRecaudado), '#e8f5e9', '#2e7d32') +
      _kpiBox('⏳ Pendiente', fmtMonto(totalPendiente), '#e3f2fd', '#1565c0') +
      _kpiBox('🔴 En mora', enMora + ' cuotas', '#ffebee', '#c62828') +
      '</div>' +
      (lotesVendidos.length === 0
        ? '<div class="al al-i">No hay ventas financiadas registradas.</div>'
        : lotesVendidos.map(function(l) { return _seccionLote(l); }).join('')
      );

    lotesVendidos.forEach(function(l) { sincronizarCuotas(l); });
  }

  function _seccionLote(lote) {
    var cuotas  = _pagos.filter(function(p){ return p.lot_id === lote.id; })
      .sort(function(a,b){ return a.num_cuota - b.num_cuota; });
    var pagadas = cuotas.filter(function(p){ return p.pagado; }).length;
    var totalC  = cuotas.length || lote.mo || 0;
    var pct     = totalC > 0 ? Math.round(pagadas / totalC * 100) : 0;

    return '<div class="card" style="margin-bottom:12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">' +
      '<div>' +
      '<div style="font-size:14px;font-weight:800;color:#1a237e">Lote ' + lote.id + ' — ' + (lote.buyer || '—') + '</div>' +
      '<div style="font-size:11px;color:#666;margin-top:2px">C.C. ' + (lote.cc||'—') + ' · ' + (lote.phone||'—') + ' · ' + (lote.mo||'—') + ' meses</div>' +
      '</div>' +
      '<div style="text-align:right">' +
      '<div style="font-size:13px;font-weight:700;color:#2e7d32">' + pagadas + '/' + totalC + ' cuotas</div>' +
      '<div style="font-size:11px;color:#888">' + pct + '% pagado</div>' +
      '</div></div>' +
      '<div style="height:6px;background:#e0e0e0;border-radius:3px;margin-bottom:12px">' +
      '<div style="height:6px;background:linear-gradient(90deg,#2e7d32,#66bb6a);border-radius:3px;width:' + pct + '%"></div></div>' +
      (cuotas.length === 0
        ? '<div style="font-size:12px;color:#999;text-align:center;padding:10px">Generando cuotas…</div>'
        : '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead>' +
          '<tr style="background:#f5f5f5">' +
          '<th style="padding:7px 10px;text-align:left">#</th>' +
          '<th style="padding:7px 10px;text-align:left">Vence</th>' +
          '<th style="padding:7px 10px;text-align:right">Monto</th>' +
          '<th style="padding:7px 10px;text-align:center">Estado</th>' +
          '<th style="padding:7px 10px;text-align:left">Pagado el</th>' +
          '<th style="padding:7px 10px;text-align:left">Nota</th>' +
          '<th style="padding:7px 10px;text-align:center">Acción</th>' +
          '</tr></thead><tbody>' +
          cuotas.map(function(p) {
            var s = semaforo(p);
            return '<tr style="border-top:1px solid #f0f0f0">' +
              '<td style="padding:7px 10px;font-weight:700;color:#1a237e">' + p.num_cuota + '</td>' +
              '<td style="padding:7px 10px">' + fmtFecha(p.fecha_vence) + '</td>' +
              '<td style="padding:7px 10px;text-align:right;font-weight:600">' + fmtMonto(p.monto) + '</td>' +
              '<td style="padding:7px 10px;text-align:center"><span style="background:' + s.bg + ';color:' + s.color + ';padding:3px 8px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap">' + s.icono + ' ' + s.label + '</span></td>' +
              '<td style="padding:7px 10px;color:#888">' + (p.fecha_pago ? fmtFecha(p.fecha_pago) : '—') + '</td>' +
              '<td style="padding:7px 10px;color:#888;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (p.nota||'—') + '</td>' +
              '<td style="padding:7px 10px;text-align:center;white-space:nowrap">' +
              // Editar cuota (fecha + monto)
              '<button class="btn bout bsm" onclick="window._segEditarCuota(\'' + p.id + '\')" style="font-size:11px;padding:4px 8px;margin-right:4px" title="Editar fecha y monto">✏️</button>' +
              (!p.pagado
                ? '<button class="btn bg bsm" onclick="window._segRegistrarPago(\'' + p.id + '\')" style="font-size:11px;padding:4px 10px">✓ Pagar</button>'
                : '<button class="btn bout bsm" onclick="window._segDesmarcarPago(\'' + p.id + '\')" style="font-size:11px;padding:4px 10px;color:#888">↩</button>'
              ) + '</td></tr>';
          }).join('') +
          '</tbody></table></div>'
      ) + '</div>';
  }

  /* ══════════════════════════════════════════════════════════
     VISTA 3 — PROSPECTOS  (con vendedores)
  ══════════════════════════════════════════════════════════ */
  var ESTADOS = [
    { id: 'interesado',   label: '🙋 Interesado',   color: '#1565c0', bg: '#e3f2fd' },
    { id: 'presentacion', label: '📋 Presentación',  color: '#6a1b9a', bg: '#f3e5f5' },
    { id: 'negociacion',  label: '🤝 Negociación',   color: '#e65100', bg: '#fff3e0' },
    { id: 'cerrado',      label: '✅ Cerrado',        color: '#2e7d32', bg: '#e8f5e9' },
    { id: 'perdido',      label: '❌ Perdido',         color: '#757575', bg: '#f5f5f5' },
  ];

  function _renderProspectos(c) {
    /* Prospectos filtrados por vendedor activo */
    var prosFiltrados = _vendedorActivo
      ? _prospectos.filter(function(p) { return p.vendedor_id === _vendedorActivo; })
      : _prospectos;

    var vendedorActualNombre = '';
    if (_vendedorActivo) {
      var vAct = _vendedores.find(function(v) { return v.id === _vendedorActivo; });
      vendedorActualNombre = vAct ? vAct.nombre : '';
    }

    /* Opciones del selector de vendedor */
    var optsVendedor = '<option value="">👥 Todos los vendedores</option>' +
      _vendedores.map(function(v) {
        return '<option value="' + v.id + '"' + (_vendedorActivo === v.id ? ' selected' : '') + '>' + v.nombre + '</option>';
      }).join('');

    c.innerHTML =
      /* Barra superior: filtro vendedor + botones */
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
      '<select id="segFiltroVendedor" onchange="window._segCambiarVendedor(this.value)" ' +
      'style="padding:8px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;background:#fff">' +
      optsVendedor + '</select>' +
      '<div style="font-size:13px;font-weight:800;color:#1a237e">' +
      (vendedorActualNombre ? '👤 ' + vendedorActualNombre + ' — ' : '') +
      'Pipeline (' + prosFiltrados.length + ')</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px">' +
      '<button class="btn bout bsm" onclick="window._segGestionarVendedores()">⚙️ Vendedores</button>' +
      '<button class="btn bg bsm" onclick="window._segNuevoProspecto()">+ Nuevo prospecto</button>' +
      '</div></div>' +

      /* Kanban */
      '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;align-items:start;overflow-x:auto">' +
      ESTADOS.map(function(est) {
        var grupo = prosFiltrados.filter(function(p){ return p.estado === est.id; });
        return '<div style="background:' + est.bg + ';border-radius:10px;padding:10px;min-width:160px">' +
          '<div style="font-size:11px;font-weight:800;color:' + est.color + ';margin-bottom:8px;text-align:center">' +
          est.label + ' (' + grupo.length + ')</div>' +
          grupo.map(function(p) { return _cardProspecto(p, est); }).join('') +
          '</div>';
      }).join('') + '</div>';
  }

  function _cardProspecto(p, est) {
    var diffSeg    = p.next_follow ? diffDias(p.next_follow) : null;
    var alertaSeg  = diffSeg !== null && diffSeg <= 1 && p.estado !== 'cerrado' && p.estado !== 'perdido';
    var vend       = _vendedores.find(function(v){ return v.id === p.vendedor_id; });
    var vendNombre = vend ? vend.nombre : '';

    return '<div style="background:#fff;border-radius:8px;padding:10px;margin-bottom:8px;' +
      'box-shadow:0 1px 4px rgba(0,0,0,.08);border-left:3px solid ' + est.color + '">' +
      '<div style="font-size:12px;font-weight:700;color:#1a237e;margin-bottom:4px">' + p.nombre + '</div>' +
      (p.telefono ? '<div style="font-size:11px;color:#666">📞 ' + p.telefono + '</div>' : '') +
      /* Badge vendedor */
      (vendNombre ? '<div style="display:inline-block;font-size:10px;padding:2px 7px;border-radius:10px;' +
        'background:#e8eaf6;color:#3949ab;font-weight:700;margin-top:4px">👤 ' + vendNombre + '</div>' : '') +
      (p.next_follow
        ? '<div style="font-size:10px;margin-top:4px;color:' + (alertaSeg ? '#c62828' : '#888') + '">' +
          (alertaSeg ? '🔔 ' : '📅 ') + 'Seguimiento: ' + fmtFecha(p.next_follow) + '</div>'
        : '') +
      (p.notas ? '<div style="font-size:10px;color:#999;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + p.notas + '</div>' : '') +
      '<div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap">' +
      '<button onclick="window._segEditarProspecto(\'' + p.id + '\')" ' +
      'style="flex:1;font-size:10px;padding:3px 6px;background:' + est.bg + ';color:' + est.color + ';border:1px solid ' + est.color + ';border-radius:5px;cursor:pointer">✏️ Editar</button>' +
      '<button onclick="window._segMoverProspecto(\'' + p.id + '\')" ' +
      'style="flex:1;font-size:10px;padding:3px 6px;background:#f5f5f5;color:#555;border:1px solid #ddd;border-radius:5px;cursor:pointer">→ Mover</button>' +
      '</div></div>';
  }

  /* ══════════════════════════════════════════════════════════
     MODAL GENÉRICO
  ══════════════════════════════════════════════════════════ */
  function _inp(id, label, type, val, placeholder, extra) {
    return '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">' + label + '</label>' +
      '<input id="' + id + '" type="' + type + '" value="' + (val||'') + '" placeholder="' + (placeholder||'') + '" ' +
      (extra||'') + ' style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">';
  }

  function _abrirModal(titulo, bodyHtml, onGuardar) {
    var overlay = document.getElementById('segModal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'segModal';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9500;display:flex;align-items:center;justify-content:center';
      overlay.addEventListener('click', function(e){ if(e.target===overlay) _cerrarModal(); });
      document.body.appendChild(overlay);
    }
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:14px;padding:24px;width:460px;max-width:94vw;max-height:88vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<div style="font-size:15px;font-weight:800;color:#1a237e">' + titulo + '</div>' +
      '<button onclick="window._segCerrarModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#888">✕</button>' +
      '</div>' + bodyHtml +
      '<div style="display:flex;gap:10px;margin-top:18px">' +
      '<button id="segModalGuardar" class="btn bg" style="flex:1;padding:11px">✅ Guardar</button>' +
      '<button onclick="window._segCerrarModal()" class="btn bout" style="flex:1;padding:11px">Cancelar</button>' +
      '</div></div>';
    overlay.style.display = 'flex';
    document.getElementById('segModalGuardar').onclick = onGuardar;
  }

  function _cerrarModal() {
    var m = document.getElementById('segModal');
    if (m) m.style.display = 'none';
  }
  window._segCerrarModal = _cerrarModal;

  /* ══════════════════════════════════════════════════════════
     ACCIONES — AGENDA
  ══════════════════════════════════════════════════════════ */

  /* Cerrar panel de día seleccionado */
  window._segCerrarDia = function() {
    _diaSeleccionado = null;
    _renderVista();
  };

  /* Nuevo evento — recibe fecha ISO preseleccionada (opcional) */
  window._segNuevoEvento = function(fechaPresel) {
    _abrirModalEvento(null, fechaPresel);
  };

  /* Editar evento existente */
  window._segEditarEvento = function(id) {
    var e = _eventos.find(function(x){ return x.id === id; });
    if (e) _abrirModalEvento(e, null);
  };

  function _abrirModalEvento(e, fechaPresel) {
    var esEdicion = !!e;
    var tipos = ['reunion','llamada','presentacion','seguimiento','pago'];

    /* FIX TIMEZONE: si no hay fecha preseleccionada, usar hora local actual */
    var fechaDefecto = fechaPresel
      ? (fechaPresel + 'T08:00')
      : ahoraLocal();
    var fechaVal = e ? (e.fecha || fechaDefecto) : fechaDefecto;

    var body =
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Tipo</label>' +
      '<select id="segEvTipo" style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
      tipos.map(function(t){
        return '<option value="' + t + '"' + (e && e.tipo === t ? ' selected' : '') + '>' + t.charAt(0).toUpperCase() + t.slice(1) + '</option>';
      }).join('') + '</select>' +
      _inp('segEvTitulo', 'Título *', 'text', e ? e.titulo : '', 'Ej: Reunión con Juan Pérez') +
      /* FIX TIMEZONE: datetime-local usa hora local, no UTC */
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Fecha y hora *</label>' +
      '<input id="segEvFecha" type="datetime-local" value="' + fechaVal + '" ' +
      'style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Descripción</label>' +
      '<textarea id="segEvDesc" rows="2" style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box;resize:vertical">' + (e ? (e.descripcion||'') : '') + '</textarea>' +
      _inp('segEvRel', 'Relacionado (lote ID o nombre)', 'text', e ? (e.relacionado||'') : '', 'Ej: B02 o Juan Pérez');

    _abrirModal((esEdicion ? '✏️ Editar evento' : '📅 Nuevo evento'), body, function() {
      var titulo = (document.getElementById('segEvTitulo').value || '').trim();
      if (!titulo) { alert('El título es obligatorio.'); return; }
      /* FIX TIMEZONE: guardar el valor tal como viene de datetime-local (hora local) */
      var fechaInput = document.getElementById('segEvFecha').value;
      var datos = {
        tipo        : document.getElementById('segEvTipo').value,
        titulo      : titulo,
        fecha       : fechaInput,   // YYYY-MM-DDTHH:MM en hora local
        descripcion : document.getElementById('segEvDesc').value.trim(),
        relacionado : document.getElementById('segEvRel').value.trim(),
      };
      if (!esEdicion) {
        datos.completado = false;
        datos.notificado = false;
      }

      var op = esEdicion
        ? sbUpdate('eventos', e.id, datos)
        : sbInsert('eventos', datos);

      op.then(function(res) {
        if (esEdicion) {
          var idx = _eventos.findIndex(function(x){ return x.id === e.id; });
          if (idx >= 0) _eventos[idx] = Object.assign(_eventos[idx], datos);
        } else {
          if (Array.isArray(res)) _eventos = _eventos.concat(res);
        }
        _cerrarModal();
        _renderVista();
      }).catch(function(err) { alert('Error: ' + err.message); });
    });
  }

  window._segCompletarEvento = function(id) {
    sbUpdate('eventos', id, { completado: true }).then(function() {
      var idx = _eventos.findIndex(function(e){ return e.id === id; });
      if (idx >= 0) _eventos[idx].completado = true;
      _renderVista();
    });
  };

  /* ══════════════════════════════════════════════════════════
     ACCIONES — PAGOS
  ══════════════════════════════════════════════════════════ */

  /* Editar cuota: fecha de vencimiento + monto */
  window._segEditarCuota = function(pagoId) {
    var pago = _pagos.find(function(p){ return p.id === pagoId; });
    if (!pago) return;

    var body =
      _inp('segCuotaFecha', 'Fecha de vencimiento', 'date', pago.fecha_vence || '', '') +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Monto (en MILLONES COP — ej: 1.5 = $1.500.000)</label>' +
      '<input id="segCuotaMonto" type="number" step="0.0001" value="' + (pago.monto||'') + '" ' +
      'style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:4px;box-sizing:border-box">' +
      '<div style="font-size:11px;color:#888;margin-bottom:12px" id="segCuotaMontoPreview"></div>';

    _abrirModal('✏️ Editar cuota #' + pago.num_cuota + ' — Lote ' + pago.lot_id, body, function() {
      var nuevaFecha = document.getElementById('segCuotaFecha').value;
      var nuevoMonto = parseFloat(document.getElementById('segCuotaMonto').value);
      if (!nuevaFecha) { alert('La fecha es obligatoria.'); return; }
      if (isNaN(nuevoMonto) || nuevoMonto <= 0) { alert('Ingresa un monto válido.'); return; }

      sbUpdate('pagos', pagoId, { fecha_vence: nuevaFecha, monto: nuevoMonto })
        .then(function() {
          var idx = _pagos.findIndex(function(p){ return p.id === pagoId; });
          if (idx >= 0) {
            _pagos[idx].fecha_vence = nuevaFecha;
            _pagos[idx].monto       = nuevoMonto;
          }
          _cerrarModal();
          _renderVista();
        }).catch(function(e){ alert('Error: ' + e.message); });
    });

    /* Preview en tiempo real del monto */
    setTimeout(function() {
      var inp = document.getElementById('segCuotaMonto');
      var prev = document.getElementById('segCuotaMontoPreview');
      if (!inp || !prev) return;
      function actualizarPreview() {
        var v = parseFloat(inp.value);
        prev.textContent = isNaN(v) ? '' : '→ ' + fmtMonto(v);
      }
      inp.addEventListener('input', actualizarPreview);
      actualizarPreview();
    }, 100);
  };

  /* Registrar pago */
  window._segRegistrarPago = function(pagoId) {
    var pago = _pagos.find(function(p){ return p.id === pagoId; });
    if (!pago) return;

    var body =
      _inp('segPagoFecha', 'Fecha de pago', 'date', hoy(), '') +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Monto (en millones COP)</label>' +
      '<input id="segPagoMonto" type="number" step="0.0001" value="' + (pago.monto||'') + '" ' +
      'style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:4px;box-sizing:border-box">' +
      '<div style="font-size:11px;color:#888;margin-bottom:12px" id="segPagoMontoPreview"></div>' +
      _inp('segPagoNota', 'Nota / Comprobante', 'text', '', 'Ej: Transferencia #12345');

    _abrirModal('✓ Registrar pago — Cuota #' + pago.num_cuota, body, function() {
      var fechaPago  = document.getElementById('segPagoFecha').value;
      var montoVal   = parseFloat(document.getElementById('segPagoMonto').value) || pago.monto;
      var nota       = document.getElementById('segPagoNota').value.trim();

      sbUpdate('pagos', pagoId, { pagado: true, fecha_pago: fechaPago || hoy(), monto: montoVal, nota: nota })
        .then(function() {
          var idx = _pagos.findIndex(function(p){ return p.id === pagoId; });
          if (idx >= 0) {
            _pagos[idx].pagado     = true;
            _pagos[idx].fecha_pago = fechaPago || hoy();
            _pagos[idx].monto      = montoVal;
            _pagos[idx].nota       = nota;
          }
          _cerrarModal();
          _renderVista();
        }).catch(function(e){ alert('Error: ' + e.message); });
    });

    setTimeout(function() {
      var inp = document.getElementById('segPagoMonto');
      var prev = document.getElementById('segPagoMontoPreview');
      if (!inp || !prev) return;
      function act() { var v = parseFloat(inp.value); prev.textContent = isNaN(v) ? '' : '→ ' + fmtMonto(v); }
      inp.addEventListener('input', act); act();
    }, 100);
  };

  window._segDesmarcarPago = function(pagoId) {
    if (!confirm('¿Desmarcar este pago como no realizado?')) return;
    sbUpdate('pagos', pagoId, { pagado: false, fecha_pago: null, nota: '' }).then(function() {
      var idx = _pagos.findIndex(function(p){ return p.id === pagoId; });
      if (idx >= 0) { _pagos[idx].pagado = false; _pagos[idx].fecha_pago = null; }
      _renderVista();
    });
  };

  /* ══════════════════════════════════════════════════════════
     ACCIONES — PROSPECTOS
  ══════════════════════════════════════════════════════════ */

  window._segCambiarVendedor = function(id) {
    _vendedorActivo = id || null;
    _renderVista();
  };

  /* Gestión de vendedores */
  window._segGestionarVendedores = function() {
    var lista = _vendedores.map(function(v) {
      return '<div style="display:flex;align-items:center;justify-content:space-between;' +
        'padding:8px 10px;border-radius:8px;background:#f5f5f5;margin-bottom:6px">' +
        '<span style="font-size:13px;font-weight:600">👤 ' + v.nombre + '</span>' +
        '<button onclick="window._segEliminarVendedor(\'' + v.id + '\')" ' +
        'style="background:none;border:none;cursor:pointer;color:#c62828;font-size:13px" title="Eliminar">🗑</button>' +
        '</div>';
    }).join('') || '<div style="font-size:12px;color:#999;text-align:center;padding:10px">Sin vendedores registrados</div>';

    var body =
      '<div style="margin-bottom:14px">' + lista + '</div>' +
      '<div style="border-top:1px solid #eee;padding-top:12px">' +
      '<div style="font-size:12px;font-weight:700;color:#444;margin-bottom:8px">Registrar nuevo vendedor</div>' +
      _inp('segVendNombre', 'Nombre completo', 'text', '', 'Ej: Carlos Ramírez') +
      _inp('segVendTel', 'Teléfono (opcional)', 'tel', '', 'Ej: 3001234567') +
      '<button id="segBtnAddVend" class="btn bg bsm" style="width:100%">+ Agregar vendedor</button>' +
      '</div>';

    _abrirModal('⚙️ Gestión de vendedores', body, function() { _cerrarModal(); });

    setTimeout(function() {
      var btn = document.getElementById('segBtnAddVend');
      if (!btn) return;
      btn.onclick = function() {
        var nombre = (document.getElementById('segVendNombre').value || '').trim();
        var tel    = (document.getElementById('segVendTel').value || '').trim();
        if (!nombre) { alert('El nombre es obligatorio.'); return; }
        sbInsert('vendedores', { nombre: nombre, telefono: tel })
          .then(function(res) {
            if (Array.isArray(res)) _vendedores = _vendedores.concat(res);
            window._segGestionarVendedores(); // refrescar modal
            _renderVista();
          }).catch(function(e){ alert('Error: ' + e.message); });
      };
    }, 100);
  };

  window._segEliminarVendedor = function(id) {
    var v = _vendedores.find(function(x){ return x.id === id; });
    if (!confirm('¿Eliminar al vendedor "' + (v ? v.nombre : '') + '"?')) return;
    sbDelete('vendedores', id).then(function() {
      _vendedores = _vendedores.filter(function(x){ return x.id !== id; });
      if (_vendedorActivo === id) _vendedorActivo = null;
      window._segGestionarVendedores();
      _renderVista();
    });
  };

  /* Nuevo / editar prospecto */
  window._segNuevoProspecto = function(datos) {
    var d = datos || {};
    var optsVend = '<option value="">— Sin vendedor asignado —</option>' +
      _vendedores.map(function(v) {
        return '<option value="' + v.id + '"' + (d.vendedor_id === v.id ? ' selected' : '') + '>' + v.nombre + '</option>';
      }).join('');

    var body =
      _inp('segPrNombre', 'Nombre completo *', 'text', d.nombre||'', 'Ej: Carlos Ramírez') +
      _inp('segPrTel', 'Teléfono', 'tel', d.telefono||'', 'Ej: 3001234567') +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Estado</label>' +
      '<select id="segPrEstado" style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
      ESTADOS.map(function(e){ return '<option value="' + e.id + '"' + (d.estado === e.id ? ' selected' : '') + '>' + e.label + '</option>'; }).join('') +
      '</select>' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Vendedor asignado</label>' +
      '<select id="segPrVendedor" style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
      optsVend + '</select>' +
      _inp('segPrFollow', 'Próximo seguimiento', 'date', d.next_follow||'', '') +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Notas</label>' +
      '<textarea id="segPrNotas" rows="3" style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:0;box-sizing:border-box;resize:vertical">' + (d.notas||'') + '</textarea>';

    _abrirModal((d.id ? '✏️ Editar prospecto' : '👥 Nuevo prospecto'), body, function() {
      var nombre = (document.getElementById('segPrNombre').value || '').trim();
      if (!nombre) { alert('El nombre es obligatorio.'); return; }
      var payload = {
        nombre      : nombre,
        telefono    : document.getElementById('segPrTel').value.trim(),
        estado      : document.getElementById('segPrEstado').value,
        vendedor_id : document.getElementById('segPrVendedor').value || null,
        next_follow : document.getElementById('segPrFollow').value || null,
        notas       : document.getElementById('segPrNotas').value.trim(),
        updated_at  : new Date().toISOString()
      };
      var op = d.id ? sbUpdate('prospectos', d.id, payload) : sbInsert('prospectos', payload);
      op.then(function(res) {
        if (d.id) {
          var idx = _prospectos.findIndex(function(p){ return p.id === d.id; });
          if (idx >= 0) _prospectos[idx] = Object.assign(_prospectos[idx], payload);
        } else {
          if (Array.isArray(res)) _prospectos = res.concat(_prospectos);
        }
        _cerrarModal();
        _renderVista();
      }).catch(function(e){ alert('Error: ' + e.message); });
    });
  };

  window._segEditarProspecto = function(id) {
    var p = _prospectos.find(function(x){ return x.id === id; });
    if (p) window._segNuevoProspecto(p);
  };

  window._segMoverProspecto = function(id) {
    var p = _prospectos.find(function(x){ return x.id === id; });
    if (!p) return;
    var body = '<div style="font-size:13px;margin-bottom:14px;color:#555">Mover <b>' + p.nombre + '</b> a:</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px">' +
      ESTADOS.map(function(est) {
        var esActual = est.id === p.estado;
        return '<button onclick="window._segCambiarEstado(\'' + id + '\',\'' + est.id + '\')" ' +
          'style="padding:10px 14px;border-radius:8px;border:2px solid ' + (esActual?est.color:'#ddd') + ';' +
          'background:' + (esActual?est.bg:'#fff') + ';color:' + (esActual?est.color:'#555') + ';' +
          'font-weight:' + (esActual?'800':'500') + ';font-size:13px;cursor:pointer;text-align:left">' +
          est.label + (esActual ? ' ← actual' : '') + '</button>';
      }).join('') + '</div>';

    var overlay = document.getElementById('segModal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'segModal';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9500;display:flex;align-items:center;justify-content:center';
      overlay.addEventListener('click', function(e){ if(e.target===overlay) _cerrarModal(); });
      document.body.appendChild(overlay);
    }
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:14px;padding:24px;width:380px;max-width:94vw;box-shadow:0 20px 60px rgba(0,0,0,.3)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<div style="font-size:15px;font-weight:800;color:#1a237e">Cambiar estado</div>' +
      '<button onclick="window._segCerrarModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#888">✕</button>' +
      '</div>' + body + '</div>';
    overlay.style.display = 'flex';
  };

  window._segCambiarEstado = function(id, nuevoEstado) {
    sbUpdate('prospectos', id, { estado: nuevoEstado, updated_at: new Date().toISOString() })
      .then(function() {
        var idx = _prospectos.findIndex(function(p){ return p.id === id; });
        if (idx >= 0) _prospectos[idx].estado = nuevoEstado;
        _cerrarModal();
        _renderVista();
      });
  };

  /* ══════════════════════════════════════════════════════════
     NOTIFICACIONES
  ══════════════════════════════════════════════════════════ */
  function _pedirPermisoNotificacion() {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  }

  function _chequearNotificaciones() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    var hoyIso = hoy();
    _eventos.forEach(function(e) {
      if (e.completado || e.notificado) return;
      if (isoFecha(e.fecha) !== hoyIso) return;
      new Notification('📅 Araguatos — ' + e.titulo, {
        body: e.descripcion || 'Evento programado para hoy',
        icon: 'logo.png'
      });
      sbUpdate('eventos', e.id, { notificado: true });
      e.notificado = true;
    });
    _pagos.forEach(function(p) {
      if (p.pagado || p.notificado || p.fecha_vence !== hoyIso) return;
      var lote = window.S && window.S.lots ? window.S.lots.find(function(l){ return l.id === p.lot_id; }) : null;
      new Notification('💳 Araguatos — Cuota vence hoy', {
        body: 'Lote ' + p.lot_id + (lote ? ' · ' + lote.buyer : '') + ' · Cuota #' + p.num_cuota,
        icon: 'logo.png'
      });
    });
  }

  setInterval(_chequearNotificaciones, 5 * 60 * 1000);

  /* ── Helper KPI ───────────────────────────────────────────── */
  function _kpiBox(label, valor, bg, color) {
    return '<div style="background:' + bg + ';border-radius:10px;padding:14px;text-align:center">' +
      '<div style="font-size:18px;font-weight:900;color:' + color + '">' + valor + '</div>' +
      '<div style="font-size:11px;color:' + color + ';margin-top:3px;opacity:.8">' + label + '</div>' +
      '</div>';
  }

  /* ══════════════════════════════════════════════════════════
     ENTRADA PÚBLICA
  ══════════════════════════════════════════════════════════ */
  window.initSeguimiento = function() {
    _renderPanel();
    cargarTodo();
    _chequearNotificaciones();
  };

})();
