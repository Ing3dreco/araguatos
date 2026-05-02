/* ═══════════════════════════════════════════════════════════════
   tab-seguimiento.js  —  Araguatos · ING3DRECO SAS
   Pestaña de seguimiento: Agenda · Pagos · Prospectos
   Requiere: data.js (S, SB_URL, SB_TOKEN, sbH)
   ═══════════════════════════════════════════════════════════════ */

(function () {

  /* ── Estado local ─────────────────────────────────────────── */
  var _pagos      = [];
  var _prospectos = [];
  var _eventos    = [];
  var _vistaActiva = 'agenda';   // 'agenda' | 'pagos' | 'prospectos'
  var _mesActual  = new Date();  // mes mostrado en el calendario
  var _realtimeSubs = [];

  /* ── Helpers de fecha ─────────────────────────────────────── */
  var MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var DIAS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

  function hoy()       { return new Date().toISOString().slice(0,10); }
  function isoFecha(d) { return d instanceof Date ? d.toISOString().slice(0,10) : (d||'').slice(0,10); }

  function diffDias(fechaIso) {
    var hoyMs = new Date(hoy()).getTime();
    var fMs   = new Date(fechaIso).getTime();
    return Math.round((fMs - hoyMs) / 86400000);
  }

  function fmtFecha(iso) {
    if (!iso) return '—';
    var d = new Date(iso + 'T12:00:00');
    return d.getDate() + ' ' + MESES[d.getMonth()].slice(0,3) + ' ' + d.getFullYear();
  }

  function fmtMonto(m) {
    if (!m && m !== 0) return '—';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', maximumFractionDigits: 0
    }).format(Math.round(Number(m) * 1e6));
  }

  /* ── Acceso a Supabase ────────────────────────────────────── */
  function sbUrl()  { return typeof SB_URL   !== 'undefined' ? SB_URL   : ''; }
  function sbHead() { return typeof sbH === 'function' ? sbH() : {}; }

  function sbFetch(table, query) {
    var url = sbUrl() + '/rest/v1/' + table + '?' + (query || 'select=*');
    return fetch(url, { headers: sbHead() }).then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' en ' + table);
      return r.json();
    });
  }

  function sbInsert(table, data) {
    return fetch(sbUrl() + '/rest/v1/' + table, {
      method: 'POST',
      headers: Object.assign({}, sbHead(), {
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }),
      body: JSON.stringify(data)
    }).then(function(r) {
      if (!r.ok) return r.text().then(function(t){ throw new Error(t); });
      return r.json();
    });
  }

  function sbUpdate(table, id, data) {
    return fetch(sbUrl() + '/rest/v1/' + table + '?id=eq.' + id, {
      method: 'PATCH',
      headers: Object.assign({}, sbHead(), {
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }),
      body: JSON.stringify(data)
    }).then(function(r) {
      if (!r.ok) return r.text().then(function(t){ throw new Error(t); });
      return r.json();
    });
  }

  function sbDelete(table, id) {
    return fetch(sbUrl() + '/rest/v1/' + table + '?id=eq.' + id, {
      method: 'DELETE',
      headers: sbHead()
    });
  }

  /* ── Carga de datos ───────────────────────────────────────── */
  function cargarTodo() {
    var url = sbUrl();
    if (!url) { _renderVista(); return; }

    Promise.all([
      sbFetch('pagos',      'select=*&order=fecha_vence.asc'),
      sbFetch('prospectos', 'select=*&order=created_at.desc'),
      sbFetch('eventos',    'select=*&order=fecha.asc')
    ]).then(function(res) {
      _pagos      = res[0] || [];
      _prospectos = res[1] || [];
      _eventos    = res[2] || [];
      _renderVista();
      _iniciarRealtime();
    }).catch(function(e) {
      console.error('[Seguimiento] Error cargando datos:', e);
      _renderVista();
    });
  }

  /* ── Realtime Supabase ────────────────────────────────────── */
  function _iniciarRealtime() {
    // Solo si supabase-js está disponible globalmente
    if (typeof window.supabase === 'undefined') return;
    _realtimeSubs.forEach(function(s) { try { s.unsubscribe(); } catch(e){} });
    _realtimeSubs = [];

    ['pagos','prospectos','eventos'].forEach(function(tabla) {
      var sub = window.supabase
        .channel('seg-' + tabla)
        .on('postgres_changes', { event: '*', schema: 'public', table: tabla },
          function() { cargarTodo(); })
        .subscribe();
      _realtimeSubs.push(sub);
    });
  }

  /* ── Generación automática de cuotas desde ventas ─────────── */
  function generarCuotasDeLote(lote) {
    // Solo financiado
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
        monto       : cuotaMes,
        pagado      : false,
        nota        : ''
      });
    }
    return cuotas;
  }

  function sincronizarCuotas(lote) {
    // Verifica si ya hay cuotas registradas para este lote
    var existentes = _pagos.filter(function(p) { return p.lot_id === lote.id; });
    if (existentes.length > 0) return Promise.resolve(); // ya están

    var cuotas = generarCuotasDeLote(lote);
    if (!cuotas.length) return Promise.resolve();

    return sbInsert('pagos', cuotas).then(function(nuevas) {
      _pagos = _pagos.concat(nuevas || []);
    }).catch(function(e) {
      console.error('[Seguimiento] Error creando cuotas para', lote.id, e);
    });
  }

  /* ── Semáforo de cuotas ──────────────────────────────────── */
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
      /* Tabs internos */
      '<div style="display:flex;gap:0;margin-bottom:16px;border-bottom:2px solid #e0e0e0">' +
      _tabBtn('agenda',     '📅 Agenda',     _vistaActiva) +
      _tabBtn('pagos',      '💳 Pagos',      _vistaActiva) +
      _tabBtn('prospectos', '👥 Prospectos', _vistaActiva) +
      '</div>' +
      '<div id="seg-contenido"></div>';

    /* Eventos de tabs */
    panel.querySelectorAll('[data-segtab]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        _vistaActiva = this.dataset.segtab;
        _renderPanel();
      });
    });

    _renderVista();
  }

  function _tabBtn(id, label, activa) {
    var on = id === activa;
    return '<button data-segtab="' + id + '" style="' +
      'padding:10px 20px;border:none;background:none;cursor:pointer;' +
      'font-size:13px;font-weight:' + (on ? '800' : '500') + ';' +
      'color:' + (on ? '#1565C0' : '#666') + ';' +
      'border-bottom:' + (on ? '3px solid #1565C0' : '3px solid transparent') + ';' +
      'margin-bottom:-2px;transition:.15s">' + label + '</button>';
  }

  function _renderVista() {
    var c = document.getElementById('seg-contenido');
    if (!c) return;
    if (_vistaActiva === 'agenda')     _renderAgenda(c);
    else if (_vistaActiva === 'pagos') _renderPagos(c);
    else                               _renderProspectos(c);
  }

  /* ══════════════════════════════════════════════════════════
     VISTA 1 — AGENDA
  ══════════════════════════════════════════════════════════ */
  function _renderAgenda(c) {
    var hoyIso = hoy();

    /* KPIs de eventos */
    var evHoy     = _eventos.filter(function(e) { return isoFecha(e.fecha) === hoyIso && !e.completado; });
    var evProx    = _eventos.filter(function(e) {
      var d = diffDias(isoFecha(e.fecha));
      return d >= 0 && d <= 7 && !e.completado;
    });
    var evVencidos = _eventos.filter(function(e) {
      return diffDias(isoFecha(e.fecha)) < 0 && !e.completado;
    });

    /* Calendario */
    var cal = _buildCalendario();

    /* Lista próximos 14 días */
    var proximos = _eventos.filter(function(e) {
      var d = diffDias(isoFecha(e.fecha));
      return d >= -1 && d <= 14;
    }).sort(function(a,b) { return a.fecha > b.fecha ? 1 : -1; });

    c.innerHTML =
      /* KPIs */
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">' +
      _kpiBox('🔴 Vencidos', evVencidos.length, '#ffebee', '#c62828') +
      _kpiBox('🟡 Hoy', evHoy.length, '#fff3e0', '#e65100') +
      _kpiBox('🔵 Próx. 7d', evProx.length, '#e3f2fd', '#1565c0') +
      '</div>' +

      /* Layout: calendario + lista */
      '<div style="display:grid;grid-template-columns:1fr 340px;gap:14px;align-items:start">' +
      '<div class="card" style="padding:16px">' + cal + '</div>' +
      '<div>' +
      '<div class="card" style="padding:14px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
      '<div style="font-size:13px;font-weight:800;color:#1a237e">Próximos eventos</div>' +
      '<button class="btn bg bsm" onclick="window._segNuevoEvento()">+ Nuevo</button>' +
      '</div>' +
      (proximos.length === 0
        ? '<div style="font-size:12px;color:#999;text-align:center;padding:20px 0">Sin eventos próximos</div>'
        : proximos.map(_cardEvento).join('')
      ) +
      '</div></div></div>';

    /* Volver a attachar eventos del calendario */
    var prevBtn = document.getElementById('calPrev');
    var nextBtn = document.getElementById('calNext');
    if (prevBtn) prevBtn.onclick = function() {
      _mesActual = new Date(_mesActual.getFullYear(), _mesActual.getMonth() - 1, 1);
      _renderVista();
    };
    if (nextBtn) nextBtn.onclick = function() {
      _mesActual = new Date(_mesActual.getFullYear(), _mesActual.getMonth() + 1, 1);
      _renderVista();
    };

    _pedirPermisoNotificacion();
  }

  function _buildCalendario() {
    var anio = _mesActual.getFullYear();
    var mes  = _mesActual.getMonth();
    var hoyIso = hoy();

    var primerDia = new Date(anio, mes, 1).getDay();
    var diasMes   = new Date(anio, mes + 1, 0).getDate();

    /* Eventos de este mes */
    var evMes = {};
    _eventos.forEach(function(e) {
      var eIso = isoFecha(e.fecha);
      if (eIso.slice(0,7) === (anio + '-' + String(mes+1).padStart(2,'0'))) {
        var dia = parseInt(eIso.slice(8,10));
        if (!evMes[dia]) evMes[dia] = [];
        evMes[dia].push(e);
      }
    });
    /* Cuotas vencidas/próximas de este mes */
    _pagos.filter(function(p) {
      return !p.pagado && p.fecha_vence && p.fecha_vence.slice(0,7) === (anio + '-' + String(mes+1).padStart(2,'0'));
    }).forEach(function(p) {
      var dia = parseInt(p.fecha_vence.slice(8,10));
      if (!evMes[dia]) evMes[dia] = [];
      evMes[dia].push({ tipo: 'pago', titulo: 'Cuota ' + p.lot_id, fecha: p.fecha_vence });
    });

    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
      '<button id="calPrev" style="background:none;border:none;font-size:18px;cursor:pointer;color:#1565c0">‹</button>' +
      '<div style="font-size:14px;font-weight:800;color:#1a237e">' + MESES[mes] + ' ' + anio + '</div>' +
      '<button id="calNext" style="background:none;border:none;font-size:18px;cursor:pointer;color:#1565c0">›</button>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:6px">' +
      DIAS.map(function(d) {
        return '<div style="text-align:center;font-size:10px;font-weight:700;color:#888;padding:4px 0">' + d + '</div>';
      }).join('') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">';

    /* Espacios vacíos antes del día 1 */
    for (var i = 0; i < primerDia; i++) {
      html += '<div></div>';
    }

    for (var d = 1; d <= diasMes; d++) {
      var iso   = anio + '-' + String(mes+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
      var esHoy = iso === hoyIso;
      var evs   = evMes[d] || [];
      var tieneEv = evs.length > 0;

      /* Color del punto según tipo más urgente */
      var puntoCOlor = '#1565c0';
      evs.forEach(function(e) {
        if (e.tipo === 'pago') { var df = diffDias(iso); if (df < 0) puntoCOlor = '#c62828'; else if (df <= 3) puntoCOlor = '#e65100'; }
      });

      html += '<div style="' +
        'text-align:center;padding:6px 2px;border-radius:8px;font-size:12px;' +
        'background:' + (esHoy ? '#1565C0' : 'transparent') + ';' +
        'color:' + (esHoy ? '#fff' : '#333') + ';' +
        'font-weight:' + (esHoy ? '800' : '400') + ';' +
        'cursor:' + (tieneEv ? 'pointer' : 'default') + ';' +
        'position:relative">' +
        d +
        (tieneEv ? '<div style="width:5px;height:5px;border-radius:50%;background:' + (esHoy ? '#fff' : puntoCOlor) + ';margin:2px auto 0"></div>' : '<div style="height:7px"></div>') +
        '</div>';
    }

    html += '</div>';
    return html;
  }

  function _cardEvento(e) {
    var tipos = {
      reunion      : { icono: '🤝', color: '#1565c0', bg: '#e3f2fd' },
      llamada      : { icono: '📞', color: '#6a1b9a', bg: '#f3e5f5' },
      presentacion : { icono: '📋', color: '#2e7d32', bg: '#e8f5e9' },
      seguimiento  : { icono: '🔔', color: '#e65100', bg: '#fff3e0' },
      pago         : { icono: '💳', color: '#c62828', bg: '#ffebee' },
    };
    var t   = tipos[e.tipo] || tipos.reunion;
    var d   = diffDias(isoFecha(e.fecha));
    var dLabel = d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : d < 0 ? 'Hace ' + Math.abs(d) + 'd' : 'En ' + d + 'd';

    return '<div style="display:flex;gap:10px;align-items:flex-start;padding:9px;' +
      'border-radius:9px;margin-bottom:7px;background:' + t.bg + ';' +
      'opacity:' + (e.completado ? '.5' : '1') + '">' +
      '<div style="font-size:18px;line-height:1">' + t.icono + '</div>' +
      '<div style="flex:1;min-width:0">' +
      '<div style="font-size:12px;font-weight:700;color:' + t.color + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + e.titulo + '</div>' +
      '<div style="font-size:11px;color:#666;margin-top:2px">' + fmtFecha(isoFecha(e.fecha)) + ' · ' + dLabel + '</div>' +
      (e.descripcion ? '<div style="font-size:11px;color:#888;margin-top:2px">' + e.descripcion + '</div>' : '') +
      '</div>' +
      (!e.completado
        ? '<button onclick="window._segCompletarEvento(\'' + e.id + '\')" title="Marcar completado" ' +
          'style="background:none;border:none;cursor:pointer;font-size:16px;flex-shrink:0">✓</button>'
        : '') +
      '</div>';
  }

  /* ══════════════════════════════════════════════════════════
     VISTA 2 — PAGOS
  ══════════════════════════════════════════════════════════ */
  function _renderPagos(c) {
    var lotesVendidos = (window.S && window.S.lots
      ? window.S.lots.filter(function(l) {
          return (l.status === 'sold' || l.status === 'apartado') && l.payType !== 'cash';
        })
      : []);

    /* KPIs globales */
    var totalRecaudado = _pagos.filter(function(p){ return p.pagado; })
      .reduce(function(s,p){ return s + Number(p.monto); }, 0);
    var totalPendiente = _pagos.filter(function(p){ return !p.pagado; })
      .reduce(function(s,p){ return s + Number(p.monto); }, 0);
    var enMora = _pagos.filter(function(p){ return !p.pagado && diffDias(p.fecha_vence) < 0; }).length;

    c.innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">' +
      _kpiBox('✅ Recaudado', fmtMonto(totalRecaudado / 1e6), '#e8f5e9', '#2e7d32') +
      _kpiBox('⏳ Pendiente', fmtMonto(totalPendiente / 1e6), '#e3f2fd', '#1565c0') +
      _kpiBox('🔴 En mora', enMora + ' cuotas', '#ffebee', '#c62828') +
      '</div>' +
      (lotesVendidos.length === 0
        ? '<div class="al al-i">No hay ventas financiadas registradas.</div>'
        : lotesVendidos.map(function(l) { return _seccionLote(l); }).join('')
      );

    /* Sincronizar cuotas que no existan aún */
    lotesVendidos.forEach(function(l) {
      sincronizarCuotas(l);
    });
  }

  function _seccionLote(lote) {
    var cuotas = _pagos.filter(function(p){ return p.lot_id === lote.id; })
      .sort(function(a,b){ return a.num_cuota - b.num_cuota; });

    var pagadas   = cuotas.filter(function(p){ return p.pagado; }).length;
    var totalC    = cuotas.length || lote.mo || 0;
    var pct       = totalC > 0 ? Math.round(pagadas / totalC * 100) : 0;

    return '<div class="card" style="margin-bottom:12px">' +
      /* Header del lote */
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">' +
      '<div>' +
      '<div style="font-size:14px;font-weight:800;color:#1a237e">Lote ' + lote.id + ' — ' + (lote.buyer || '—') + '</div>' +
      '<div style="font-size:11px;color:#666;margin-top:2px">' +
      'C.C. ' + (lote.cc || '—') + ' · ' + (lote.phone || '—') + ' · ' +
      (lote.payType === 'fin' ? lote.mo + ' meses' : 'Contado') +
      '</div>' +
      '</div>' +
      '<div style="text-align:right">' +
      '<div style="font-size:13px;font-weight:700;color:#2e7d32">' + pagadas + '/' + totalC + ' cuotas</div>' +
      '<div style="font-size:11px;color:#888">' + pct + '% pagado</div>' +
      '</div>' +
      '</div>' +
      /* Barra de progreso */
      '<div style="height:6px;background:#e0e0e0;border-radius:3px;margin-bottom:12px">' +
      '<div style="height:6px;background:linear-gradient(90deg,#2e7d32,#66bb6a);border-radius:3px;width:' + pct + '%"></div>' +
      '</div>' +
      /* Tabla de cuotas */
      (cuotas.length === 0
        ? '<div style="font-size:12px;color:#999;text-align:center;padding:10px">Generando cuotas…</div>'
        : '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">' +
          '<thead><tr style="background:#f5f5f5">' +
          '<th style="padding:7px 10px;text-align:left;font-weight:700">#</th>' +
          '<th style="padding:7px 10px;text-align:left;font-weight:700">Vence</th>' +
          '<th style="padding:7px 10px;text-align:right;font-weight:700">Monto</th>' +
          '<th style="padding:7px 10px;text-align:center;font-weight:700">Estado</th>' +
          '<th style="padding:7px 10px;text-align:left;font-weight:700">Pagado el</th>' +
          '<th style="padding:7px 10px;text-align:left;font-weight:700">Nota</th>' +
          '<th style="padding:7px 10px;text-align:center;font-weight:700">Acción</th>' +
          '</tr></thead><tbody>' +
          cuotas.map(function(p) {
            var s = semaforo(p);
            return '<tr style="border-top:1px solid #f0f0f0;background:' + (p.pagado ? '#fafafa' : 'transparent') + '">' +
              '<td style="padding:7px 10px;font-weight:700;color:#1a237e">' + p.num_cuota + '</td>' +
              '<td style="padding:7px 10px">' + fmtFecha(p.fecha_vence) + '</td>' +
              '<td style="padding:7px 10px;text-align:right;font-weight:600">' + fmtMonto(p.monto / 1e6) + '</td>' +
              '<td style="padding:7px 10px;text-align:center">' +
              '<span style="background:' + s.bg + ';color:' + s.color + ';padding:3px 8px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap">' +
              s.icono + ' ' + s.label + '</span></td>' +
              '<td style="padding:7px 10px;color:#888">' + (p.fecha_pago ? fmtFecha(p.fecha_pago) : '—') + '</td>' +
              '<td style="padding:7px 10px;color:#888;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (p.nota || '—') + '</td>' +
              '<td style="padding:7px 10px;text-align:center">' +
              (!p.pagado
                ? '<button class="btn bg bsm" onclick="window._segRegistrarPago(\'' + p.id + '\')" style="font-size:11px;padding:4px 10px">✓ Pagar</button>'
                : '<button class="btn bout bsm" onclick="window._segDesmarcarPago(\'' + p.id + '\')" style="font-size:11px;padding:4px 10px;color:#888">↩</button>'
              ) +
              '</td></tr>';
          }).join('') +
          '</tbody></table></div>'
      ) +
      '</div>';
  }

  /* ══════════════════════════════════════════════════════════
     VISTA 3 — PROSPECTOS (Kanban)
  ══════════════════════════════════════════════════════════ */
  var ESTADOS = [
    { id: 'interesado',  label: '🙋 Interesado',  color: '#1565c0', bg: '#e3f2fd' },
    { id: 'presentacion',label: '📋 Presentación', color: '#6a1b9a', bg: '#f3e5f5' },
    { id: 'negociacion', label: '🤝 Negociación',  color: '#e65100', bg: '#fff3e0' },
    { id: 'cerrado',     label: '✅ Cerrado',       color: '#2e7d32', bg: '#e8f5e9' },
    { id: 'perdido',     label: '❌ Perdido',        color: '#757575', bg: '#f5f5f5' },
  ];

  function _renderProspectos(c) {
    c.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">' +
      '<div style="font-size:13px;font-weight:800;color:#1a237e">Pipeline de prospectos (' + _prospectos.length + ')</div>' +
      '<button class="btn bg bsm" onclick="window._segNuevoProspecto()">+ Nuevo prospecto</button>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;align-items:start;overflow-x:auto">' +
      ESTADOS.map(function(est) {
        var grupo = _prospectos.filter(function(p){ return p.estado === est.id; });
        return '<div style="background:' + est.bg + ';border-radius:10px;padding:10px;min-width:160px">' +
          '<div style="font-size:11px;font-weight:800;color:' + est.color + ';margin-bottom:8px;text-align:center">' +
          est.label + ' (' + grupo.length + ')</div>' +
          grupo.map(function(p) { return _cardProspecto(p, est); }).join('') +
          '</div>';
      }).join('') +
      '</div>';
  }

  function _cardProspecto(p, est) {
    var diffSeg = p.next_follow ? diffDias(p.next_follow) : null;
    var alertaSeg = diffSeg !== null && diffSeg <= 1 && p.estado !== 'cerrado' && p.estado !== 'perdido';

    return '<div style="background:#fff;border-radius:8px;padding:10px;margin-bottom:8px;' +
      'box-shadow:0 1px 4px rgba(0,0,0,.08);border-left:3px solid ' + est.color + '">' +
      '<div style="font-size:12px;font-weight:700;color:#1a237e;margin-bottom:4px">' + p.nombre + '</div>' +
      (p.telefono ? '<div style="font-size:11px;color:#666">📞 ' + p.telefono + '</div>' : '') +
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
     MODALES
  ══════════════════════════════════════════════════════════ */

  /* ── Modal genérico ──────────────────────────────────────── */
  function _abrirModal(titulo, bodyHtml, onGuardar) {
    var overlay = document.getElementById('segModal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'segModal';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9500;display:flex;align-items:center;justify-content:center';
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) _cerrarModal();
      });
      document.body.appendChild(overlay);
    }

    overlay.innerHTML =
      '<div style="background:#fff;border-radius:14px;padding:24px;width:460px;max-width:94vw;max-height:88vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<div style="font-size:15px;font-weight:800;color:#1a237e">' + titulo + '</div>' +
      '<button onclick="window._segCerrarModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#888">✕</button>' +
      '</div>' +
      bodyHtml +
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

  /* ── Registrar pago ───────────────────────────────────────── */
  window._segRegistrarPago = function(pagoId) {
    var pago = _pagos.find(function(p){ return p.id === pagoId; });
    if (!pago) return;

    var inp = function(id, label, type, val, placeholder) {
      return '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">' + label + '</label>' +
        '<input id="' + id + '" type="' + type + '" value="' + (val||'') + '" placeholder="' + (placeholder||'') + '" ' +
        'style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">';
    };

    var montoMillones = (Number(pago.monto) / 1e6).toFixed(4);

    _abrirModal('✓ Registrar pago — Cuota #' + pago.num_cuota,
      inp('segPagoFecha', 'Fecha de pago', 'date', hoy(), '') +
      inp('segPagoMonto', 'Monto ($ pesos)', 'number', Math.round(Number(pago.monto)), 'Ej: 1500000') +
      inp('segPagoNota', 'Nota / Comprobante', 'text', '', 'Ej: Transferencia #12345'),
      function() {
        var fechaPago = document.getElementById('segPagoFecha').value;
        var montoPesos = parseFloat(document.getElementById('segPagoMonto').value) || Number(pago.monto);
        var nota = document.getElementById('segPagoNota').value.trim();

        sbUpdate('pagos', pagoId, {
          pagado: true,
          fecha_pago: fechaPago || hoy(),
          monto: montoPesos,
          nota: nota
        }).then(function() {
          var idx = _pagos.findIndex(function(p){ return p.id === pagoId; });
          if (idx >= 0) {
            _pagos[idx].pagado     = true;
            _pagos[idx].fecha_pago = fechaPago || hoy();
            _pagos[idx].monto      = montoPesos;
            _pagos[idx].nota       = nota;
          }
          _cerrarModal();
          _renderVista();
        }).catch(function(e) { alert('Error: ' + e.message); });
      }
    );
  };

  /* ── Desmarcar pago ──────────────────────────────────────── */
  window._segDesmarcarPago = function(pagoId) {
    if (!confirm('¿Desmarcar este pago como no realizado?')) return;
    sbUpdate('pagos', pagoId, { pagado: false, fecha_pago: null, nota: '' })
      .then(function() {
        var idx = _pagos.findIndex(function(p){ return p.id === pagoId; });
        if (idx >= 0) { _pagos[idx].pagado = false; _pagos[idx].fecha_pago = null; }
        _renderVista();
      });
  };

  /* ── Nuevo evento ─────────────────────────────────────────── */
  window._segNuevoEvento = function() {
    var tipos = ['reunion','llamada','presentacion','seguimiento','pago'];
    var body =
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Tipo</label>' +
      '<select id="segEvTipo" style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
      tipos.map(function(t){ return '<option value="' + t + '">' + t.charAt(0).toUpperCase() + t.slice(1) + '</option>'; }).join('') +
      '</select>' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Título *</label>' +
      '<input id="segEvTitulo" type="text" placeholder="Ej: Reunión con Juan Pérez" style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Fecha y hora *</label>' +
      '<input id="segEvFecha" type="datetime-local" value="' + new Date().toISOString().slice(0,16) + '" style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Descripción</label>' +
      '<textarea id="segEvDesc" rows="2" placeholder="Detalles adicionales…" style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box;resize:vertical"></textarea>' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Relacionado (lote ID o nombre)</label>' +
      '<input id="segEvRel" type="text" placeholder="Ej: B02 o Juan Pérez" style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:0;box-sizing:border-box">';

    _abrirModal('📅 Nuevo evento', body, function() {
      var titulo = (document.getElementById('segEvTitulo').value || '').trim();
      if (!titulo) { alert('El título es obligatorio.'); return; }
      var datos = {
        tipo        : document.getElementById('segEvTipo').value,
        titulo      : titulo,
        fecha       : document.getElementById('segEvFecha').value,
        descripcion : document.getElementById('segEvDesc').value.trim(),
        relacionado : document.getElementById('segEvRel').value.trim(),
        completado  : false,
        notificado  : false
      };
      sbInsert('eventos', datos).then(function(nuevos) {
        if (Array.isArray(nuevos)) _eventos = _eventos.concat(nuevos);
        _cerrarModal();
        _renderVista();
      }).catch(function(e) { alert('Error: ' + e.message); });
    });
  };

  /* ── Completar evento ─────────────────────────────────────── */
  window._segCompletarEvento = function(id) {
    sbUpdate('eventos', id, { completado: true }).then(function() {
      var idx = _eventos.findIndex(function(e){ return e.id === id; });
      if (idx >= 0) _eventos[idx].completado = true;
      _renderVista();
    });
  };

  /* ── Nuevo prospecto ──────────────────────────────────────── */
  window._segNuevoProspecto = function(datos) {
    var d = datos || {};
    var body =
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Nombre completo *</label>' +
      '<input id="segPrNombre" type="text" value="' + (d.nombre||'') + '" placeholder="Ej: Carlos Ramírez" style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Teléfono</label>' +
      '<input id="segPrTel" type="tel" value="' + (d.telefono||'') + '" placeholder="Ej: 3001234567" style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Estado</label>' +
      '<select id="segPrEstado" style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
      ESTADOS.map(function(e){ return '<option value="' + e.id + '"' + (d.estado === e.id ? ' selected' : '') + '>' + e.label + '</option>'; }).join('') +
      '</select>' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Próximo seguimiento</label>' +
      '<input id="segPrFollow" type="date" value="' + (d.next_follow||'') + '" style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Notas</label>' +
      '<textarea id="segPrNotas" rows="3" placeholder="Observaciones, intereses, referencias…" style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:0;box-sizing:border-box;resize:vertical">' + (d.notas||'') + '</textarea>';

    _abrirModal((d.id ? '✏️ Editar prospecto' : '👥 Nuevo prospecto'), body, function() {
      var nombre = (document.getElementById('segPrNombre').value || '').trim();
      if (!nombre) { alert('El nombre es obligatorio.'); return; }
      var payload = {
        nombre      : nombre,
        telefono    : document.getElementById('segPrTel').value.trim(),
        estado      : document.getElementById('segPrEstado').value,
        next_follow : document.getElementById('segPrFollow').value || null,
        notas       : document.getElementById('segPrNotas').value.trim(),
        updated_at  : new Date().toISOString()
      };
      var op = d.id
        ? sbUpdate('prospectos', d.id, payload)
        : sbInsert('prospectos', payload);

      op.then(function(res) {
        if (d.id) {
          var idx = _prospectos.findIndex(function(p){ return p.id === d.id; });
          if (idx >= 0) _prospectos[idx] = Object.assign(_prospectos[idx], payload);
        } else {
          if (Array.isArray(res)) _prospectos = res.concat(_prospectos);
        }
        _cerrarModal();
        _renderVista();
      }).catch(function(e) { alert('Error: ' + e.message); });
    });
  };

  /* ── Editar prospecto ─────────────────────────────────────── */
  window._segEditarProspecto = function(id) {
    var p = _prospectos.find(function(x){ return x.id === id; });
    if (p) window._segNuevoProspecto(p);
  };

  /* ── Mover estado de prospecto ────────────────────────────── */
  window._segMoverProspecto = function(id) {
    var p = _prospectos.find(function(x){ return x.id === id; });
    if (!p) return;
    var idxActual = ESTADOS.findIndex(function(e){ return e.id === p.estado; });
    var body = '<div style="font-size:13px;margin-bottom:14px;color:#555">Mover <b>' + p.nombre + '</b> a:</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px">' +
      ESTADOS.map(function(est, i) {
        var esActual = est.id === p.estado;
        return '<button onclick="window._segCambiarEstado(\'' + id + '\',\'' + est.id + '\')" ' +
          'style="padding:10px 14px;border-radius:8px;border:2px solid ' + (esActual ? est.color : '#ddd') + ';' +
          'background:' + (esActual ? est.bg : '#fff') + ';color:' + (esActual ? est.color : '#555') + ';' +
          'font-weight:' + (esActual ? '800' : '500') + ';font-size:13px;cursor:pointer;text-align:left">' +
          est.label + (esActual ? ' ← actual' : '') + '</button>';
      }).join('') + '</div>';

    /* Modal sin botón guardar */
    var overlay = document.getElementById('segModal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'segModal';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9500;display:flex;align-items:center;justify-content:center';
      overlay.addEventListener('click', function(e){ if(e.target===overlay)_cerrarModal(); });
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
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  function _chequearNotificaciones() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    var hoyIso = hoy();

    /* Eventos de hoy no notificados */
    _eventos.forEach(function(e) {
      if (e.completado || e.notificado) return;
      if (isoFecha(e.fecha) !== hoyIso) return;
      new Notification('📅 Araguatos — ' + e.titulo, {
        body: e.descripcion || ('Evento programado para hoy: ' + e.titulo),
        icon: 'logo.png'
      });
      sbUpdate('eventos', e.id, { notificado: true });
      e.notificado = true;
    });

    /* Cuotas vencidas hoy */
    _pagos.forEach(function(p) {
      if (p.pagado || p.notificado) return;
      if (p.fecha_vence !== hoyIso) return;
      var lote = window.S && window.S.lots
        ? window.S.lots.find(function(l){ return l.id === p.lot_id; })
        : null;
      new Notification('💳 Araguatos — Cuota vence hoy', {
        body: 'Lote ' + p.lot_id + (lote ? ' · ' + lote.buyer : '') + ' · Cuota #' + p.num_cuota,
        icon: 'logo.png'
      });
    });
  }

  /* Revisar notificaciones cada 5 minutos */
  setInterval(_chequearNotificaciones, 5 * 60 * 1000);

  /* ── Helper KPI box ───────────────────────────────────────── */
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
