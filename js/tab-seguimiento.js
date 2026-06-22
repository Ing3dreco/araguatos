/* ═══════════════════════════════════════════════════════════════
   tab-seguimiento.js  —  Araguatos · ING3DRECO SAS  v8
   FIX v8 (definitivo anti-bucle):
     1. SEMÁFORO _sincronizando: cargarTodo() es no-reentrable.
        Si llega una nueva llamada mientras hay una sincronización
        en curso, se ignora. Esto corta el ciclo
        Realtime → cargarTodo → sync → DELETE/INSERT → Realtime.
     2. REALTIME TARDÍO: _iniciarRealtime() solo se activa DESPUÉS
        de que terminen todos los sincronizarCuotas(). Antes solo
        escuchaba sin que los cambios causados por el propio sync
        disparen una nueva carga.
     3. FIX CONTEO CUOTAS: sincronizarCuotas() excluye num_cuota===0
        (cuota inicial) del conteo de existentes, evitando
        regeneraciones falsas cuando existe solo la CI.
   ═══════════════════════════════════════════════════════════════ */
(function () {
var TG_CHAT_ID = '-5030514648';

function tgEnviar(mensaje) {
  var url = sbUrl();
  if (!url) return;
  var fnUrl = url.replace('/rest/v1', '') + '/functions/v1/send-telegram';
  fetch(fnUrl, {
    method: 'POST',
    headers: Object.assign({}, sbHead(), { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ chat_id: TG_CHAT_ID, text: mensaje })
  }).then(function(r) {
    if (!r.ok) r.text().then(function(t) { console.warn('[Telegram] Edge Function error:', t); });
  }).catch(function(e) {
    console.warn('[Telegram] Error de red:', e.message);
  });
}

  /* ── Estado local ─────────────────────────────────────────── */
  var _pagos          = [];
  var _prospectos     = [];
  var _eventos        = [];
  var _vendedores     = [];
  var _vendedorActivo  = null;
  var _vendedorAgenda  = null;
  var _vistaActiva    = 'agenda';
  var _mesActual      = new Date();
  var _diaSeleccionado = null;
  var _realtimeSubs   = [];
  var _notifVistas    = {};

  /* ── FIX v8: semáforo para evitar re-entrada en cargarTodo ── */
  var _sincronizando  = false;

  /* ── v5: estado del buscador de eventos ──────────────────── */
  var _busquedaEvento  = '';
  var _resultadosBusq  = null;

  /* ── v6: estado UI de Pagos ──────────────────────────────── */
  var _busquedaPagos   = '';
  var _acordeonesAbiertos = {};

  /* ── Helpers de fecha ─────────────────────────────────────── */
  var MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var DIAS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

  function hoy() {
    var d = new Date();
    return _padFecha(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  function ahoraLocal() {
    var d = new Date();
    return _padFecha(d.getFullYear(), d.getMonth() + 1, d.getDate()) +
           'T' + _pad(d.getHours()) + ':' + _pad(d.getMinutes());
  }
  function _pad(n)  { return n < 10 ? '0' + n : '' + n; }
  function _normalizar(str) {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
  function _padFecha(y, m, d) { return y + '-' + _pad(m) + '-' + _pad(d); }

  function isoFecha(d) {
    if (!d) return '';
    if (d instanceof Date) return _padFecha(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return String(d).slice(0, 10);
  }
  function diffDias(fechaIso) {
    if (!fechaIso) return 0;
    var hP = hoy().split('-').map(Number);
    var fP = fechaIso.slice(0,10).split('-').map(Number);
    return Math.round((Date.UTC(fP[0],fP[1]-1,fP[2]) - Date.UTC(hP[0],hP[1]-1,hP[2])) / 86400000);
  }
  function fmtFecha(iso) {
    if (!iso) return '—';
    var p = iso.slice(0,10).split('-');
    return parseInt(p[2]) + ' ' + MESES[parseInt(p[1])-1].slice(0,3) + ' ' + p[0];
  }
  function fmtHora(datetimeStr) {
    if (!datetimeStr || !datetimeStr.includes('T')) return '';
    var hm = datetimeStr.split('T')[1].slice(0,5).split(':');
    var h = parseInt(hm[0]), m = hm[1];
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

  function sumarMes(isoFechaStr, meses) {
    var p = isoFechaStr.slice(0,10).split('-').map(Number);
    var d = new Date(p[0], p[1] - 1 + meses, p[2]);
    if (d.getMonth() !== ((p[1] - 1 + meses) % 12 + 12) % 12) {
      d = new Date(d.getFullYear(), d.getMonth(), 0);
    }
    return _padFecha(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  /* ── Supabase ─────────────────────────────────────────────── */
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

  /* ══════════════════════════════════════════════════════════
     CARGA DE DATOS — FIX v8
     cargarTodo() es no-reentrable gracias al semáforo _sincronizando.
     _iniciarRealtime() se llama SOLO después de que todas las
     sincronizaciones terminan, para que los propios DELETE/INSERT
     del sync no disparen nuevas cargas.
  ══════════════════════════════════════════════════════════ */
  function cargarTodo() {
    /* FIX v8 — semáforo: si ya hay una sincronización en curso, salir */
    if (_sincronizando) {
      console.log('[Seguimiento] cargarTodo() ignorado — sync en curso');
      return;
    }
    _sincronizando = true;

    var url = sbUrl();
    if (!url) {
      _sincronizando = false;
      _renderVista();
      return;
    }

    /* FIX v8 — pausar realtime ANTES de cargar para que los cambios
       producidos por sincronizarCuotas() no disparen nuevas cargas */
    _pausarRealtime();

    Promise.all([
      sbFetch('pagos',      'select=*&order=fecha_vence.asc'),
      sbFetch('prospectos', 'select=*&order=created_at.desc'),
      sbFetch('eventos',    'select=*&order=fecha.asc'),
      sbFetch('vendedores', 'select=*&order=nombre.asc')
    ]).then(function(res) {
      _pagos      = res[0] || [];
      _prospectos = res[1] || [];
      _eventos    = res[2] || [];
      _vendedores = res[3] || [];

      var lotesParaSync = (window.S && window.S.lots
        ? window.S.lots.filter(function(l){
            return (l.status === 'sold' || l.status === 'apartado') && l.payType !== 'cash';
          })
        : []);

      var promesasSync = lotesParaSync.map(function(l){ return sincronizarCuotas(l); });

      return Promise.all(promesasSync);

    }).then(function(){
      _sincronizando = false;   /* liberar semáforo */
      _renderVista();
      _actualizarCampanita();
      /* FIX v8 — iniciar realtime DESPUÉS del sync, no antes */
      _iniciarRealtime();

    }).catch(function(e) {
      console.error('[Seguimiento] Error:', e);
      _sincronizando = false;   /* liberar semáforo incluso en error */
      _renderVista();
      _iniciarRealtime();
    });
  }

  /* ── Pausar / reanudar realtime ───────────────────────────── */
  function _pausarRealtime() {
    _realtimeSubs.forEach(function(s){ try{ s.unsubscribe(); }catch(e){} });
    _realtimeSubs = [];
  }

  /* ── Realtime ─────────────────────────────────────────────── */
  function _iniciarRealtime() {
    if (typeof window.supabase === 'undefined') return;
    /* Limpiar suscripciones anteriores antes de crear nuevas */
    _pausarRealtime();
    ['pagos','prospectos','eventos','vendedores'].forEach(function(tabla) {
      var sub = window.supabase.channel('seg-' + tabla)
        .on('postgres_changes', { event: '*', schema: 'public', table: tabla }, function() {
          /* FIX v8 — el semáforo en cargarTodo() evita que los propios
             cambios del sync disparen re-cargas en cascada */
          cargarTodo();
        }).subscribe();
      _realtimeSubs.push(sub);
    });
  }

  /* ══════════════════════════════════════════════════════════
     CUOTAS AUTOMÁTICAS
  ══════════════════════════════════════════════════════════ */
  function generarCuotasDeLote(lote) {
    if (lote.payType === 'cash') return [];
    var mo = parseInt(lote.mo) || 0;
    if (mo <= 0) return [];

    var precio = Number(lote.salePrice) || 0;
    if (precio <= 0) return [];

    var dnPct = Number(lote.dn) || 20;
    var dn    = Number(lote.dnAmt) > 0
                  ? Number(lote.dnAmt)
                  : precio * dnPct / 100;

    var saldo = Math.max(0, precio - dn);

    var cuotaMes = Number(lote.cmAmt) > 0
                     ? Number(lote.cmAmt)
                     : (saldo / mo);

    if (cuotaMes <= 0) return [];

    var base = lote.saleDate
                 ? new Date(lote.saleDate + 'T12:00:00')
                 : new Date();
    var cuotas = [];
    for (var i = 1; i <= mo; i++) {
      var f = new Date(base.getFullYear(), base.getMonth() + i, base.getDate());
      cuotas.push({
        lot_id: lote.id, num_cuota: i,
        fecha_vence: isoFecha(f), monto: cuotaMes,
        pagado: false, abonado: 0, nota: ''
      });
    }
    return cuotas;
  }

  /* FIX v8 — sincronizarCuotas excluye num_cuota===0 (cuota inicial)
     del conteo para evitar regeneraciones falsas */
  function sincronizarCuotas(lote) {
    /* Solo cuotas mensuales (num_cuota > 0) — excluir la CI */
    var existentes = _pagos.filter(function(p){
      return p.lot_id === lote.id && p.num_cuota > 0;
    });

    var todasCero = existentes.length > 0 && existentes.every(function(p){
      return Number(p.monto) === 0;
    });
    var cantidadIncorrecta = existentes.length > 0 && parseInt(lote.mo) > 0 &&
                             existentes.length !== parseInt(lote.mo);

    if (existentes.length > 0 && !todasCero && !cantidadIncorrecta) {
      return Promise.resolve();
    }

    var cuotas = generarCuotasDeLote(lote);
    if (!cuotas.length) return Promise.resolve();

    var promesaBorrado = Promise.resolve();
    if (existentes.length > 0) {
      promesaBorrado = Promise.all(existentes.map(function(p){
        return sbDelete('pagos', p.id);
      })).then(function(){
        _pagos = _pagos.filter(function(p){
          return !(p.lot_id === lote.id && p.num_cuota > 0);
        });
      });
    }

    return promesaBorrado.then(function(){
      return sbInsert('pagos', cuotas);
    }).then(function(nuevas) {
      _pagos = _pagos.concat(nuevas || []);
    }).catch(function(e){ console.error('[Seguimiento] Error cuotas', lote.id, e); });
  }

  /* ── Cascada de fechas ────────────────────────────────────── */
  function _aplicarCascadaFechas(lotId, numCuotaEditada, nuevaFechaEditada) {
    var cuotasLote = _pagos
      .filter(function(p){ return p.lot_id === lotId && p.num_cuota > 0; })
      .sort(function(a,b){ return a.num_cuota - b.num_cuota; });

    if (cuotasLote.length === 0) return Promise.resolve();

    var mapaFechas = {};
    cuotasLote.forEach(function(p){ mapaFechas[p.num_cuota] = p.fecha_vence; });
    mapaFechas[numCuotaEditada] = nuevaFechaEditada;

    var promesas = [];
    for (var i = 0; i < cuotasLote.length; i++) {
      var cuota = cuotasLote[i];
      if (cuota.num_cuota <= numCuotaEditada) continue;
      if (cuota.pagado) {
        mapaFechas[cuota.num_cuota] = cuota.fecha_vence;
        continue;
      }
      var fechaAnterior = mapaFechas[cuota.num_cuota - 1];
      if (!fechaAnterior) continue;
      var nuevaFecha = sumarMes(fechaAnterior, 1);
      mapaFechas[cuota.num_cuota] = nuevaFecha;
      cuota.fecha_vence = nuevaFecha;
      cuota.notificado  = false;
      promesas.push(
        sbUpdate('pagos', cuota.id, { fecha_vence: nuevaFecha, notificado: false })
      );
    }

    return Promise.all(promesas).catch(function(e){
      console.error('[Seguimiento] Error cascada fechas:', e);
    });
  }

  /* ── Semáforo ─────────────────────────────────────────────── */
  function semaforo(pago) {
    if (pago.pagado) return { color:'#2e7d32', bg:'#e8f5e9', icono:'✅', label:'Pagado' };
    var abonado = Number(pago.abonado) || 0;
    var monto   = Number(pago.monto)   || 0;
    if (abonado > 0 && monto > 0) {
      var pct = Math.min(99, Math.round(abonado / monto * 100));
      return { color:'#6a1b9a', bg:'#f3e5f5', icono:'💜', label:'Abono ' + pct + '%' };
    }
    var d = diffDias(pago.fecha_vence);
    if (d < 0)  return { color:'#c62828', bg:'#ffebee', icono:'🔴', label:'Vencida '+Math.abs(d)+'d' };
    if (d <= 7) return { color:'#e65100', bg:'#fff3e0', icono:'🟡', label:'Vence en '+d+'d' };
    return { color:'#1565c0', bg:'#e3f2fd', icono:'🔵', label:'Pendiente' };
  }

  /* ══════════════════════════════════════════════════════════
     CAMPANITA DE NOVEDADES 🔔
  ══════════════════════════════════════════════════════════ */
  function _calcularNovedades() {
    var novedades = { agenda: [], pagos: [], prospectos: [] };

    _eventos.forEach(function(e) {
      if (e.completado) return;
      var d = diffDias(isoFecha(e.fecha));
      if (d < 0) {
        novedades.agenda.push({ id:'ev-'+e.id, texto:'🔴 Evento vencido: "'+e.titulo+'" ('+fmtFecha(isoFecha(e.fecha))+')', tipo:'agenda' });
      } else if (d <= 2) {
        var cuando = d===0?'hoy':d===1?'mañana':'en '+d+' días';
        novedades.agenda.push({ id:'ev-'+e.id, texto:'📅 "'+e.titulo+'" '+cuando+(fmtHora(e.fecha)?' a las '+fmtHora(e.fecha):''), tipo:'agenda' });
      }
    });

    _pagos.forEach(function(p) {
      if (p.pagado) return;
      var d = diffDias(p.fecha_vence);
      var lote = window.S && window.S.lots ? window.S.lots.find(function(l){ return l.id===p.lot_id; }) : null;
      var comprador = lote ? (' · '+(lote.buyer||'')) : '';
      if (d < 0) {
        novedades.pagos.push({ id:'pago-'+p.id, texto:'🔴 Cuota #'+p.num_cuota+' Lote '+p.lot_id+comprador+' vencida hace '+Math.abs(d)+' día(s)', tipo:'pagos' });
      } else if (d <= 3) {
        var cuando = d===0?'HOY':d===1?'mañana':'en '+d+' días';
        novedades.pagos.push({ id:'pago-'+p.id, texto:'💳 Cuota #'+p.num_cuota+' Lote '+p.lot_id+comprador+' vence '+cuando+' ('+fmtMonto(p.monto)+')', tipo:'pagos' });
      }
    });

    _prospectos.forEach(function(p) {
      if (p.estado==='cerrado'||p.estado==='perdido'||p.estado==='referidos'||!p.next_follow) return;
      var d = diffDias(p.next_follow);
      if (d <= 1) {
        var cuando = d<0?'atrasado '+Math.abs(d)+' día(s)':d===0?'HOY':'mañana';
        var vend = _vendedores.find(function(v){ return v.id===p.vendedor_id; });
        novedades.prospectos.push({ id:'pros-'+p.id, texto:'👥 Seguimiento '+cuando+': '+p.nombre+(vend?' ('+vend.nombre+')':''), tipo:'prospectos' });
      }
    });

    return novedades;
  }

  function _actualizarCampanita() {
    var bell = document.getElementById('segCampanita');
    if (!bell) return;
    var nov = _calcularNovedades();
    var total = nov.agenda.length + nov.pagos.length + nov.prospectos.length;
    var badge = bell.querySelector('.seg-bell-badge');
    if (badge) badge.textContent = total > 0 ? (total > 99 ? '99+' : total) : '';
    badge.style.display = total > 0 ? 'flex' : 'none';
  }

  function _renderCampanita() {
    var nov = _calcularNovedades();
    var total = nov.agenda.length + nov.pagos.length + nov.prospectos.length;

    var html = '<div style="position:relative;display:inline-block">' +
      '<button id="segBellBtn" onclick="window._segToggleBell()" ' +
      'style="background:none;border:none;font-size:22px;cursor:pointer;position:relative;line-height:1;padding:4px">🔔' +
      '<span class="seg-bell-badge" style="position:absolute;top:-2px;right:-4px;' +
      'background:#c62828;color:#fff;border-radius:50%;font-size:10px;font-weight:800;' +
      'min-width:17px;height:17px;display:'+(total>0?'flex':'none')+';align-items:center;' +
      'justify-content:center;padding:0 3px">' + (total>99?'99+':total) + '</span>' +
      '</button>' +

      '<div id="segBellDropdown" style="display:none;position:absolute;right:0;top:36px;' +
      'width:340px;max-height:420px;overflow-y:auto;background:#fff;border-radius:12px;' +
      'box-shadow:0 8px 32px rgba(0,0,0,.18);z-index:9999;border:1px solid #e0e0e0">' +

      '<div style="padding:12px 14px;border-bottom:1px solid #eee;font-size:13px;font-weight:800;color:#1a237e">🔔 Novedades</div>' +

      (total === 0
        ? '<div style="padding:20px;text-align:center;font-size:13px;color:#888">¡Todo al día! Sin novedades pendientes.</div>'
        : '') +

      (nov.agenda.length > 0
        ? '<div style="padding:8px 14px;background:#e3f2fd;font-size:11px;font-weight:800;color:#1565c0;text-transform:uppercase;letter-spacing:.5px">📅 Agenda ('+nov.agenda.length+')</div>' +
          nov.agenda.map(function(n) {
            return '<div style="padding:9px 14px;border-bottom:1px solid #f5f5f5;font-size:12px;color:#333;line-height:1.4">'+n.texto+'</div>';
          }).join('')
        : '') +

      (nov.pagos.length > 0
        ? '<div style="padding:8px 14px;background:#fff3e0;font-size:11px;font-weight:800;color:#e65100;text-transform:uppercase;letter-spacing:.5px">💳 Pagos ('+nov.pagos.length+')</div>' +
          nov.pagos.map(function(n) {
            return '<div style="padding:9px 14px;border-bottom:1px solid #f5f5f5;font-size:12px;color:#333;line-height:1.4">'+n.texto+'</div>';
          }).join('')
        : '') +

      (nov.prospectos.length > 0
        ? '<div style="padding:8px 14px;background:#e8f5e9;font-size:11px;font-weight:800;color:#2e7d32;text-transform:uppercase;letter-spacing:.5px">👥 Prospectos ('+nov.prospectos.length+')</div>' +
          nov.prospectos.map(function(n) {
            return '<div style="padding:9px 14px;border-bottom:1px solid #f5f5f5;font-size:12px;color:#333;line-height:1.4">'+n.texto+'</div>';
          }).join('')
        : '') +

      '</div></div>';

    return html;
  }

  window._segToggleBell = function() {
    var dd = document.getElementById('segBellDropdown');
    if (!dd) return;
    var visible = dd.style.display !== 'none';
    dd.style.display = visible ? 'none' : 'block';
    if (!visible) {
      setTimeout(function() {
        document.addEventListener('click', function cerrar(e) {
          if (!document.getElementById('segBellDropdown')) return;
          if (!document.getElementById('segBellDropdown').contains(e.target) &&
              e.target.id !== 'segBellBtn') {
            document.getElementById('segBellDropdown').style.display = 'none';
            document.removeEventListener('click', cerrar);
          }
        });
      }, 100);
    }
  };

  /* ══════════════════════════════════════════════════════════
     RENDER PRINCIPAL
  ══════════════════════════════════════════════════════════ */
  function _renderPanel() {
    var panel = document.getElementById('tab-seguimiento');
    if (!panel) return;
    panel.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:2px solid #e0e0e0;padding-bottom:0">' +
      '<div style="display:flex;gap:0">' +
      _tabBtn('agenda',     '📅 Agenda',     _vistaActiva) +
      _tabBtn('pagos',      '💳 Pagos',      _vistaActiva) +
      _tabBtn('prospectos', '👥 Prospectos', _vistaActiva) +
      '</div>' +
      '<div style="padding-bottom:6px" id="segCampanita">' + _renderCampanita() + '</div>' +
      '</div>' +
      '<div id="seg-contenido"></div>';

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
    return '<button data-segtab="'+id+'" style="padding:10px 20px;border:none;background:none;cursor:pointer;' +
      'font-size:13px;font-weight:'+(on?'800':'500')+';color:'+(on?'#1565C0':'#666')+';' +
      'border-bottom:'+(on?'3px solid #1565C0':'3px solid transparent')+';margin-bottom:-2px;transition:.15s">'+label+'</button>';
  }

  function _renderVista() {
    var c = document.getElementById('seg-contenido');
    if (!c) return;
    if      (_vistaActiva === 'agenda')     _renderAgenda(c);
    else if (_vistaActiva === 'pagos')      _renderPagos(c);
    else                                    _renderProspectos(c);
  }

  /* ══════════════════════════════════════════════════════════
     VISTA 1 — AGENDA
  ══════════════════════════════════════════════════════════ */
  function _renderAgenda(c) {
    var hoyIso = hoy();
    var evsFiltrados = _vendedorAgenda
      ? _eventos.filter(function(e){ return e.vendedor_id === _vendedorAgenda; })
      : _eventos;

    var evHoy      = evsFiltrados.filter(function(e){ return isoFecha(e.fecha)===hoyIso && !e.completado; });
    var evProx     = evsFiltrados.filter(function(e){ var d=diffDias(isoFecha(e.fecha)); return d>=0&&d<=7&&!e.completado; });
    var evVencidos = evsFiltrados.filter(function(e){ return diffDias(isoFecha(e.fecha))<0&&!e.completado; });

    var panelLateral = _diaSeleccionado ? _panelDia(_diaSeleccionado, evsFiltrados) : _panelProximos(evsFiltrados);

    var optsAgenda = '<option value="">👥 Todos los vendedores</option>' +
      _vendedores.map(function(v){
        return '<option value="'+v.id+'"'+(_vendedorAgenda===v.id?' selected':'')+'>'+v.nombre+'</option>';
      }).join('');
    var vendAgendaNombre = '';
    if (_vendedorAgenda) {
      var va = _vendedores.find(function(v){ return v.id===_vendedorAgenda; });
      vendAgendaNombre = va ? ' — 👤 ' + va.nombre : '';
    }

    var busqVal = _busquedaEvento || '';
    var busqHTML =
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;' +
      'background:#fff;border:1.5px solid #ddd;border-radius:10px;padding:6px 12px;' +
      'box-shadow:0 1px 4px rgba(0,0,0,.06)">' +
      '<span style="font-size:15px;color:#888">🔍</span>' +
      '<input id="segBusqEvento" type="text" value="'+_escapeHtml(busqVal)+'" ' +
      'placeholder="Buscar evento por título…" ' +
      'style="flex:1;border:none;outline:none;font-size:13px;background:transparent;color:#333" ' +
      'oninput="window._segBuscarEvento(this.value)">' +
      (busqVal
        ? '<button onclick="window._segLimpiarBusqueda()" title="Limpiar búsqueda" ' +
          'style="background:none;border:none;cursor:pointer;font-size:16px;color:#888;line-height:1;padding:0 2px">✕</button>'
        : '') +
      '</div>';

    var cuerpoAgenda;
    if (_resultadosBusq !== null) {
      cuerpoAgenda = _renderResultadosBusqueda(_resultadosBusq, busqVal);
    } else {
      cuerpoAgenda =
        '<div style="display:grid;grid-template-columns:1fr 340px;gap:14px;align-items:start">' +
        '<div class="card" style="padding:16px">'+_buildCalendario(evsFiltrados)+'</div>' +
        '<div>'+panelLateral+'</div>' +
        '</div>';
    }

    c.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">' +
      '<select id="segFiltroAgendaVend" onchange="window._segCambiarVendedorAgenda(this.value)" ' +
      'style="padding:8px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;background:#fff">' +
      optsAgenda + '</select>' +
      '<div style="font-size:13px;font-weight:700;color:#1a237e">Agenda' + vendAgendaNombre + '</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">' +
      _kpiBox('🔴 Vencidos', evVencidos.length, '#ffebee','#c62828') +
      _kpiBox('🟡 Hoy',      evHoy.length,      '#fff3e0','#e65100') +
      _kpiBox('🔵 Próx. 7d', evProx.length,     '#e3f2fd','#1565c0') +
      '</div>' +
      busqHTML +
      cuerpoAgenda;

    var prev = document.getElementById('calPrev');
    var next = document.getElementById('calNext');
    if (prev) prev.onclick = function() { _mesActual=new Date(_mesActual.getFullYear(),_mesActual.getMonth()-1,1); _renderVista(); };
    if (next) next.onclick = function() { _mesActual=new Date(_mesActual.getFullYear(),_mesActual.getMonth()+1,1); _renderVista(); };

    c.querySelectorAll('[data-caldia]').forEach(function(cel) {
      cel.addEventListener('click', function() { _diaSeleccionado=this.dataset.caldia; _renderVista(); });
    });

    if (busqVal) {
      var inp = document.getElementById('segBusqEvento');
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }

    _pedirPermisoNotificacion();
  }

  function _escapeHtml(str) {
    return String(str || '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  window._segBuscarEvento = function(valor) {
    _busquedaEvento = valor;
    if (!valor || valor.trim() === '') {
      _resultadosBusq = null;
      _renderVista();
      return;
    }
    var termino = valor.trim();
    var terminoNorm = _normalizar(termino);
    var resultados = _eventos.filter(function(e) {
      return _normalizar(e.titulo).indexOf(terminoNorm) !== -1;
    });
    _resultadosBusq = resultados;
    _renderVista();
  };

  window._segLimpiarBusqueda = function() {
    _busquedaEvento  = '';
    _resultadosBusq  = null;
    _renderVista();
  };

  function _renderResultadosBusqueda(resultados, termino) {
    var encabezado =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
      '<div style="font-size:13px;font-weight:800;color:#1a237e">' +
      '🔍 Resultados para <span style="color:#1565c0;font-style:italic">"'+_escapeHtml(termino)+'"</span>' +
      ' <span style="font-weight:500;color:#666">('+resultados.length+' encontrado'+(resultados.length!==1?'s':'')+')</span></div>' +
      '<div style="font-size:11px;color:#888;font-style:italic">⚠️ Sensible a Mayúsculas/minúsculas</div>' +
      '</div>';

    if (resultados.length === 0) {
      return '<div class="card" style="padding:20px;text-align:center">' +
        encabezado +
        '<div style="font-size:13px;color:#999;padding:24px 0">No se encontraron eventos con ese título exacto.</div>' +
        '</div>';
    }

    var ordenados = resultados.slice().sort(function(a,b){ return (a.fecha||'')>(b.fecha||'')?1:-1; });

    return '<div class="card" style="padding:16px">' +
      encabezado +
      ordenados.map(function(e) { return _cardEventoBusqueda(e, termino); }).join('') +
      '</div>';
  }

  function _cardEventoBusqueda(e, termino) {
    var tipos = {
      reunion:      { icono:'🤝', color:'#1565c0', bg:'#e3f2fd' },
      llamada:      { icono:'📞', color:'#6a1b9a', bg:'#f3e5f5' },
      presentacion: { icono:'📋', color:'#2e7d32', bg:'#e8f5e9' },
      seguimiento:  { icono:'🔔', color:'#e65100', bg:'#fff3e0' },
      pago:         { icono:'💳', color:'#c62828', bg:'#ffebee' },
    };
    var t = tipos[e.tipo] || tipos.reunion;
    var d = diffDias(isoFecha(e.fecha));
    var dLabel = d===0?'Hoy':d===1?'Mañana':d<0?'Hace '+Math.abs(d)+'d':'En '+d+'d';
    var hora = fmtHora(e.fecha);
    var tituloResaltado = _resaltarTermino(e.titulo || '', termino);
    var vend = _vendedores.find(function(v){ return v.id===e.vendedor_id; });

    return '<div style="display:flex;gap:10px;align-items:flex-start;padding:10px;border-radius:9px;margin-bottom:8px;' +
      'background:'+(e.completado?'#f5f5f5':t.bg)+';opacity:'+(e.completado?.6:1)+';border-left:3px solid '+(e.completado?'#bbb':t.color)+'">' +
      '<div style="font-size:18px;line-height:1">'+(e.completado?'✅':t.icono)+'</div>' +
      '<div style="flex:1;min-width:0">' +
      '<div style="font-size:12px;font-weight:700;color:'+(e.completado?'#888':t.color)+'">'+(e.completado?'<s>':'')+tituloResaltado+(e.completado?'</s>':'')+'</div>' +
      '<div style="font-size:11px;color:#666;margin-top:2px">'+fmtFecha(isoFecha(e.fecha))+(hora?' · '+hora:'')+' · '+dLabel+'</div>' +
      (vend?'<div style="display:inline-block;font-size:10px;padding:2px 7px;border-radius:10px;background:#e8eaf6;color:#3949ab;font-weight:700;margin-top:3px">👤 '+vend.nombre+'</div>':'') +
      (e.descripcion?'<div style="font-size:11px;color:#888;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_escapeHtml(e.descripcion)+'</div>':'') +
      '</div>' +
      '<div style="display:flex;gap:2px;flex-shrink:0;flex-direction:column;align-items:flex-end">' +
      '<button onclick="window._segEditarEvento(\''+e.id+'\')" title="Editar" style="background:none;border:none;cursor:pointer;font-size:13px;padding:2px 4px">✏️</button>' +
      (!e.completado
        ? '<button onclick="window._segCompletarEvento(\''+e.id+'\')" title="Completado" style="background:none;border:none;cursor:pointer;font-size:13px;padding:2px 4px">✅</button>'
        : '<button onclick="window._segRevertirEvento(\''+e.id+'\')" title="Pendiente" style="background:none;border:none;cursor:pointer;font-size:13px;padding:2px 4px">↩️</button>'
      ) +
      '<button onclick="window._segEliminarEvento(\''+e.id+'\')" title="Eliminar" style="background:none;border:none;cursor:pointer;font-size:13px;padding:2px 4px">🗑️</button>' +
      '</div></div>';
  }

  function _resaltarTermino(texto, termino) {
    if (!termino) return _escapeHtml(texto);
    var resultado = '';
    var idx = 0;
    var pos;
    while ((pos = texto.indexOf(termino, idx)) !== -1) {
      resultado += _escapeHtml(texto.slice(idx, pos));
      resultado += '<mark style="background:#fff176;color:#333;border-radius:2px;padding:0 1px">'+_escapeHtml(texto.slice(pos, pos + termino.length))+'</mark>';
      idx = pos + termino.length;
    }
    resultado += _escapeHtml(texto.slice(idx));
    return resultado;
  }

  function _panelDia(isoD, evsFiltrados) {
    evsFiltrados = evsFiltrados || _eventos;
    var evsDia = evsFiltrados
      .filter(function(e){ return isoFecha(e.fecha) === isoD; })
      .sort(function(a,b){ return (a.fecha||'') > (b.fecha||'') ? 1 : -1; });

    var cuotasDia = _pagos.filter(function(p){
      return p.fecha_vence && isoFecha(p.fecha_vence) === isoD;
    });

    var label = isoD === hoy() ? 'Hoy' : fmtFecha(isoD);

    var htmlCuotas = '';
    if (cuotasDia.length > 0) {
      htmlCuotas =
        '<div style="font-size:11px;font-weight:800;color:#e65100;text-transform:uppercase;' +
        'letter-spacing:.5px;margin:10px 0 6px">💳 Cuotas que vencen este día</div>' +
        cuotasDia.map(function(p) {
          var s = semaforo(p);
          var lote = window.S && window.S.lots
            ? window.S.lots.find(function(l){ return l.id === p.lot_id; })
            : null;
          var comprador = lote && lote.buyer ? lote.buyer : 'Lote ' + p.lot_id;
          var esCI = p.num_cuota === 0;
          return '<div style="display:flex;justify-content:space-between;align-items:center;' +
            'padding:8px 10px;border-radius:8px;margin-bottom:5px;' +
            'background:'+s.bg+';border-left:3px solid '+s.color+'">' +
            '<div>' +
            '<div style="font-size:12px;font-weight:700;color:'+s.color+'">'+
              s.icono+' '+(esCI?'Cuota Inicial':'Cuota #'+p.num_cuota)+' — '+comprador+'</div>' +
            '<div style="font-size:11px;color:#666;margin-top:1px">'+fmtMonto(p.monto)+'</div>' +
            '</div>' +
            '<span style="background:'+s.bg+';color:'+s.color+';padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;border:1px solid '+s.color+';white-space:nowrap">'+s.label+'</span>' +
            '</div>';
        }).join('');
    }

    return '<div class="card" style="padding:14px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
      '<div style="font-size:13px;font-weight:800;color:#1a237e">📅 '+label+'</div>' +
      '<div style="display:flex;gap:6px">' +
      '<button class="btn bg bsm" onclick="window._segNuevoEvento(\''+isoD+'\')">+ Evento</button>' +
      '<button onclick="window._segCerrarDia()" style="background:none;border:none;cursor:pointer;font-size:18px;color:#888;line-height:1">✕</button>' +
      '</div></div>' +
      (evsDia.length === 0 && cuotasDia.length === 0
        ? '<div style="font-size:12px;color:#999;text-align:center;padding:20px 0">Sin eventos ni cuotas para este día</div>'
        : '') +
      (evsDia.length > 0
        ? '<div style="font-size:11px;font-weight:800;color:#1565c0;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">📅 Eventos</div>' +
          evsDia.map(_cardEvento).join('')
        : '') +
      htmlCuotas +
      '</div>';
  }

  function _panelProximos(evsFiltrados) {
    evsFiltrados = evsFiltrados || _eventos;
    var proximos = evsFiltrados.filter(function(e){
      var d=diffDias(isoFecha(e.fecha)); return d>=-1&&d<=14;
    }).sort(function(a,b){ return (a.fecha||'')>(b.fecha||'')?1:-1; });
    return '<div class="card" style="padding:14px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
      '<div style="font-size:13px;font-weight:800;color:#1a237e">Próximos eventos</div>' +
      '<button class="btn bg bsm" onclick="window._segNuevoEvento(null)">+ Nuevo</button>' +
      '</div>' +
      (proximos.length===0
        ? '<div style="font-size:12px;color:#999;text-align:center;padding:20px 0">Sin eventos próximos</div>'
        : proximos.map(_cardEvento).join('')
      )+'</div>';
  }

  function _buildCalendario(evsFiltrados) {
    evsFiltrados = evsFiltrados || _eventos;
    var anio=_mesActual.getFullYear(), mes=_mesActual.getMonth(), hoyIso=hoy();
    var primerDia=new Date(anio,mes,1).getDay(), diasMes=new Date(anio,mes+1,0).getDate();
    var evMes={};
    evsFiltrados.forEach(function(e){
      var eIso=isoFecha(e.fecha);
      if(eIso.slice(0,7)===anio+'-'+_pad(mes+1)){
        var d=parseInt(eIso.slice(8,10));
        if(!evMes[d]) evMes[d]=[];
        evMes[d].push(e);
      }
    });
    _pagos.filter(function(p){
      return !p.pagado && p.fecha_vence &&
             p.fecha_vence.slice(0,7) === (anio+'-'+_pad(mes+1));
    }).forEach(function(p){
      var d = parseInt(p.fecha_vence.slice(8,10));
      if (!evMes[d]) evMes[d] = [];
      evMes[d].push({ tipo:'pago', titulo:'Cuota '+p.lot_id, fecha:p.fecha_vence });
    });

    var html='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
      '<button id="calPrev" style="background:none;border:none;font-size:18px;cursor:pointer;color:#1565c0">‹</button>' +
      '<div style="font-size:14px;font-weight:800;color:#1a237e">'+MESES[mes]+' '+anio+'</div>' +
      '<button id="calNext" style="background:none;border:none;font-size:18px;cursor:pointer;color:#1565c0">›</button>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:6px">' +
      DIAS.map(function(d){ return '<div style="text-align:center;font-size:10px;font-weight:700;color:#888;padding:4px 0">'+d+'</div>'; }).join('')+
      '</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">';

    for(var i=0;i<primerDia;i++) html+='<div></div>';
    for(var d=1;d<=diasMes;d++){
      var iso=anio+'-'+_pad(mes+1)+'-'+_pad(d);
      var esHoy=iso===hoyIso, esSel=iso===_diaSeleccionado;
      var evs=evMes[d]||[], tieneEv=evs.length>0;
      var puntoColor='#1565c0';
      evs.forEach(function(e){
        if(e.tipo==='pago'){ var df=diffDias(iso); if(df<0) puntoColor='#c62828'; else if(df<=3) puntoColor='#e65100'; }
        if(!e.completado&&diffDias(isoFecha(e.fecha))<0) puntoColor='#c62828';
      });
      var bg=esSel?'#0d47a1':esHoy?'#1565C0':'transparent';
      var color=(esHoy||esSel)?'#fff':'#333';
      html+='<div data-caldia="'+iso+'" style="text-align:center;padding:6px 2px;border-radius:8px;font-size:12px;cursor:pointer;background:'+bg+';color:'+color+';font-weight:'+(esHoy||esSel?'800':'400')+';border:2px solid '+(esSel?'#0d47a1':'transparent')+';position:relative;transition:.1s" title="'+(tieneEv?evs.length+' evento(s)/cuota(s)':'Sin eventos')+'">'+d+
        (tieneEv?'<div style="width:5px;height:5px;border-radius:50%;background:'+((esHoy||esSel)?'#fff':puntoColor)+';margin:2px auto 0"></div>':'<div style="height:7px"></div>')+
        '</div>';
    }
    html+='</div>';
    if(_diaSeleccionado) html+='<div style="margin-top:8px;font-size:11px;color:#888;text-align:center">Clic en otro día para ver sus eventos · <a href="#" onclick="window._segCerrarDia();return false" style="color:#1565c0">Ver próximos</a></div>';
    return html;
  }

  function _cardEvento(e) {
    var tipos = {
      reunion:      { icono:'🤝', color:'#1565c0', bg:'#e3f2fd' },
      llamada:      { icono:'📞', color:'#6a1b9a', bg:'#f3e5f5' },
      presentacion: { icono:'📋', color:'#2e7d32', bg:'#e8f5e9' },
      seguimiento:  { icono:'🔔', color:'#e65100', bg:'#fff3e0' },
      pago:         { icono:'💳', color:'#c62828', bg:'#ffebee' },
    };
    var t=tipos[e.tipo]||tipos.reunion;
    var d=diffDias(isoFecha(e.fecha));
    var dLabel=d===0?'Hoy':d===1?'Mañana':d<0?'Hace '+Math.abs(d)+'d':'En '+d+'d';
    var hora=fmtHora(e.fecha);
    var recLabel = e.reminder_min
      ? ' · ⏰ '+(e.reminder_min>=60?(e.reminder_min/60)+'h':''+e.reminder_min+'min')+' antes'
      : '';

    return '<div style="display:flex;gap:10px;align-items:flex-start;padding:9px;border-radius:9px;margin-bottom:7px;'+
      'background:'+(e.completado?'#f5f5f5':t.bg)+';opacity:'+(e.completado?.6:1)+';border-left:3px solid '+(e.completado?'#bbb':t.color)+'">' +
      '<div style="font-size:18px;line-height:1">'+(e.completado?'✅':t.icono)+'</div>' +
      '<div style="flex:1;min-width:0">' +
      '<div style="font-size:12px;font-weight:700;color:'+(e.completado?'#888':t.color)+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(e.completado?'<s>':'')+_escapeHtml(e.titulo||'')+(e.completado?'</s>':'')+'</div>' +
      '<div style="font-size:11px;color:#666;margin-top:2px">'+fmtFecha(isoFecha(e.fecha))+(hora?' · '+hora:'')+' · '+dLabel+recLabel+'</div>' +
      (e.vendedor_id ? (function(){ var v=_vendedores.find(function(x){return x.id===e.vendedor_id;}); return v?'<div style="display:inline-block;font-size:10px;padding:2px 7px;border-radius:10px;background:#e8eaf6;color:#3949ab;font-weight:700;margin-top:3px">👤 '+v.nombre+'</div>':''; })() : '') +
      (e.descripcion?'<div style="font-size:11px;color:#888;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_escapeHtml(e.descripcion)+'</div>':'') +
      '</div>' +
      '<div style="display:flex;gap:2px;flex-shrink:0;flex-direction:column;align-items:flex-end">' +
      '<button onclick="window._segEditarEvento(\''+e.id+'\')" title="Editar" style="background:none;border:none;cursor:pointer;font-size:13px;padding:2px 4px">✏️</button>' +
      (!e.completado
        ? '<button onclick="window._segCompletarEvento(\''+e.id+'\')" title="Marcar como completado" style="background:none;border:none;cursor:pointer;font-size:13px;padding:2px 4px">✅</button>'
        : '<button onclick="window._segRevertirEvento(\''+e.id+'\')" title="Marcar como pendiente" style="background:none;border:none;cursor:pointer;font-size:13px;padding:2px 4px">↩️</button>'
      ) +
      '<button onclick="window._segEliminarEvento(\''+e.id+'\')" title="Eliminar evento" style="background:none;border:none;cursor:pointer;font-size:13px;padding:2px 4px">🗑️</button>' +
      '</div></div>';
  }

  /* ══════════════════════════════════════════════════════════
     VISTA 2 — PAGOS
  ══════════════════════════════════════════════════════════ */
  function _renderPagos(c) {
    var lotesVendidos = (window.S && window.S.lots
      ? window.S.lots.filter(function(l){ return (l.status==='sold'||l.status==='apartado') && l.payType!=='cash'; })
      : []);

    var totalRecaudado = _pagos.reduce(function(s, p) {
      if (p.pagado) {
        return s + (Number(p.monto) || 0);
      } else {
        return s + (Number(p.abonado) || 0);
      }
    }, 0);

    var totalPendiente = _pagos.reduce(function(s,p){
      if (p.pagado) return s;
      var abonado = Number(p.abonado) || 0;
      return s + Math.max(0, Number(p.monto) - abonado);
    }, 0);

    var enMora = _pagos.filter(function(p){ return !p.pagado && diffDias(p.fecha_vence) < 0; }).length;

    var busq = (_busquedaPagos || '').toLowerCase().trim();
    var lotesFiltrados = busq
      ? lotesVendidos.filter(function(l){
          return (String(l.id||'').toLowerCase().indexOf(busq) !== -1) ||
                 (String(l.buyer||'').toLowerCase().indexOf(busq) !== -1) ||
                 (String(l.cc||'').toLowerCase().indexOf(busq) !== -1) ||
                 (String(l.phone||'').toLowerCase().indexOf(busq) !== -1);
        })
      : lotesVendidos;

    var busqPagosHTML =
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;' +
      'background:#fff;border:1.5px solid #ddd;border-radius:10px;padding:7px 13px;' +
      'box-shadow:0 1px 4px rgba(0,0,0,.06)">' +
      '<span style="font-size:15px;color:#888">🔍</span>' +
      '<input id="segBusqPagos" type="text" value="'+_escapeHtml(_busquedaPagos)+'" ' +
      'placeholder="Buscar por lote, comprador, C.C. o teléfono…" ' +
      'style="flex:1;border:none;outline:none;font-size:13px;background:transparent;color:#333" ' +
      'oninput="window._segBuscarPagos(this.value)">' +
      (_busquedaPagos
        ? '<button onclick="window._segLimpiarBusqPagos()" title="Limpiar" ' +
          'style="background:none;border:none;cursor:pointer;font-size:16px;color:#888;line-height:1;padding:0 2px">✕</button>'
        : '') +
      (busq && lotesFiltrados.length > 0
        ? '<span style="font-size:11px;color:#1565c0;font-weight:700;white-space:nowrap">'+lotesFiltrados.length+' resultado'+(lotesFiltrados.length>1?'s':'')+'</span>'
        : '') +
      '</div>';

    c.innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">' +
      _kpiBox('✅ Recaudado', fmtMonto(totalRecaudado), '#e8f5e9','#2e7d32') +
      _kpiBox('⏳ Pendiente', fmtMonto(totalPendiente), '#e3f2fd','#1565c0') +
      _kpiBox('🔴 En mora',   enMora+' cuotas',         '#ffebee','#c62828') +
      '</div>' +
      busqPagosHTML +
      (lotesFiltrados.length === 0
        ? '<div class="al al-i" style="text-align:center;padding:32px;color:#999;font-size:13px">' +
          (busq ? '🔍 Sin resultados para "'+_escapeHtml(_busquedaPagos)+'"' : 'No hay ventas financiadas registradas.') +
          '</div>'
        : lotesFiltrados.map(function(l){ return _acordeonLote(l); }).join('')
      );

    if (_busquedaPagos) {
      var inp = document.getElementById('segBusqPagos');
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }
  }

  window._segBuscarPagos = function(valor) {
    _busquedaPagos = valor;
    _renderVista();
  };
  window._segLimpiarBusqPagos = function() {
    _busquedaPagos = '';
    _renderVista();
  };

  function _acordeonLote(lote) {
    var abierto = !!_acordeonesAbiertos[lote.id];
    var cuotas  = _pagos.filter(function(p){ return p.lot_id === lote.id && p.num_cuota !== 0; })
                        .sort(function(a,b){ return a.num_cuota - b.num_cuota; });
    var pagadas  = cuotas.filter(function(p){ return p.pagado; }).length;
    var totalC   = cuotas.length || parseInt(lote.mo) || 0;
    var pct      = totalC > 0 ? Math.round(pagadas / totalC * 100) : 0;

    var precio  = Number(lote.salePrice) || 0;
    var dnPct   = Number(lote.dn) || 20;
    var dnAmt   = Number(lote.dnAmt) > 0 ? Number(lote.dnAmt) : precio * dnPct / 100;
    var ciRow   = _pagos.find(function(p){ return p.lot_id === lote.id && p.num_cuota === 0; });
    var dnPagado = ciRow ? ciRow.pagado : (lote.dnPagado || false);

    var enMoraLote   = cuotas.filter(function(p){ return !p.pagado && diffDias(p.fecha_vence) < 0; }).length;
    var proxVenceLote = cuotas.filter(function(p){ return !p.pagado && diffDias(p.fecha_vence) >= 0 && diffDias(p.fecha_vence) <= 7; }).length;
    var colorLote = enMoraLote > 0 ? '#c62828' : proxVenceLote > 0 ? '#e65100' : pct >= 100 ? '#2e7d32' : '#1565c0';
    var bgLote    = enMoraLote > 0 ? '#ffebee' : proxVenceLote > 0 ? '#fff3e0' : pct >= 100 ? '#e8f5e9' : '#e3f2fd';
    var iconoLote = enMoraLote > 0 ? '🔴' : proxVenceLote > 0 ? '🟡' : pct >= 100 ? '✅' : '🔵';

    var cuerpo = abierto ? _cuerpoLote(lote, cuotas, ciRow, dnAmt, dnPagado, pagadas, totalC, pct) : '';

    return '<div class="card" style="margin-bottom:10px;overflow:hidden" id="acord-'+lote.id+'">' +
      '<div onclick="window._segToggleAcordeon(\''+lote.id+'\')" ' +
      'style="display:flex;align-items:center;gap:10px;padding:14px 16px;cursor:pointer;' +
      'background:'+(abierto?'#f8f9ff':'#fff')+';' +
      'border-bottom:'+(abierto?'1px solid #e8eaf6':'none')+';' +
      'transition:background .15s;user-select:none" ' +
      'onmouseover="this.style.background=\'#f0f4ff\'" ' +
      'onmouseout="this.style.background=\''+(abierto?'#f8f9ff':'#fff')+'\'">' +
      '<div style="font-size:14px;color:#1565c0;transition:transform .2s;transform:'+(abierto?'rotate(90deg)':'rotate(0deg)')+'">' +
      '▶</div>' +
      '<div style="font-size:18px;flex-shrink:0">'+iconoLote+'</div>' +
      '<div style="flex:1;min-width:0">' +
      '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">' +
      '<span style="font-size:14px;font-weight:800;color:#1a237e">Lote '+_escapeHtml(String(lote.id))+'</span>' +
      '<span style="font-size:13px;font-weight:700;color:#333">'+_escapeHtml(lote.buyer||'—')+'</span>' +
      (lote.cc ? '<span style="font-size:11px;color:#888">C.C. '+_escapeHtml(lote.cc)+'</span>' : '') +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap">' +
      '<div style="height:5px;width:100px;background:#e0e0e0;border-radius:3px;flex-shrink:0">' +
      '<div style="height:5px;background:'+colorLote+';border-radius:3px;width:'+pct+'%"></div></div>' +
      '<span style="font-size:11px;color:'+colorLote+';font-weight:700">'+pagadas+'/'+totalC+' cuotas · '+pct+'%</span>' +
      (enMoraLote > 0 ? '<span style="font-size:10px;background:#ffebee;color:#c62828;padding:2px 7px;border-radius:10px;font-weight:700">'+enMoraLote+' en mora</span>' : '') +
      (proxVenceLote > 0 ? '<span style="font-size:10px;background:#fff3e0;color:#e65100;padding:2px 7px;border-radius:10px;font-weight:700">'+proxVenceLote+' vencen pronto</span>' : '') +
      '</div>' +
      '</div>' +
      '<div style="display:flex;gap:6px;flex-shrink:0" onclick="event.stopPropagation()">' +
      '<button onclick="window._segEditarVenta(\''+lote.id+'\')" title="Ver/Editar datos de la venta" ' +
      'style="padding:5px 10px;border:1.5px solid #1565c0;border-radius:7px;background:#e3f2fd;' +
      'color:#1565c0;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">✏️ Editar venta</button>' +
      '</div>' +
      '</div>' +
      '<div id="acord-body-'+lote.id+'" style="display:'+(abierto?'block':'none')+'">' +
      cuerpo +
      '</div>' +
      '</div>';
  }

  window._segToggleAcordeon = function(loteId) {
    var estaAbierto = !!_acordeonesAbiertos[loteId];
    _acordeonesAbiertos[loteId] = !estaAbierto;

    var body = document.getElementById('acord-body-' + loteId);
    var card = document.getElementById('acord-' + loteId);
    if (!body || !card) { _renderVista(); return; }

    if (!estaAbierto) {
      if (!body.innerHTML.trim()) {
        var lote = window.S && window.S.lots
          ? window.S.lots.find(function(l){ return l.id === loteId; })
          : null;
        if (!lote) { _renderVista(); return; }
        var cuotas  = _pagos.filter(function(p){ return p.lot_id === lote.id && p.num_cuota !== 0; })
                            .sort(function(a,b){ return a.num_cuota - b.num_cuota; });
        var pagadas  = cuotas.filter(function(p){ return p.pagado; }).length;
        var totalC   = cuotas.length || parseInt(lote.mo) || 0;
        var pct      = totalC > 0 ? Math.round(pagadas / totalC * 100) : 0;
        var precio   = Number(lote.salePrice) || 0;
        var dnPct    = Number(lote.dn) || 20;
        var dnAmt    = Number(lote.dnAmt) > 0 ? Number(lote.dnAmt) : precio * dnPct / 100;
        var ciRow    = _pagos.find(function(p){ return p.lot_id === lote.id && p.num_cuota === 0; });
        var dnPagado = ciRow ? ciRow.pagado : (lote.dnPagado || false);
        body.innerHTML = _cuerpoLote(lote, cuotas, ciRow, dnAmt, dnPagado, pagadas, totalC, pct);
      }
      body.style.display = 'block';
      var cabFl = card.querySelector('div[onclick] > div:first-child');
      if (cabFl) cabFl.style.transform = 'rotate(90deg)';
      var cabBg = card.querySelector('div[onclick]');
      if (cabBg) {
        cabBg.style.background = '#f8f9ff';
        cabBg.style.borderBottom = '1px solid #e8eaf6';
        cabBg.setAttribute('onmouseout', "this.style.background='#f8f9ff'");
      }
    } else {
      body.style.display = 'none';
      var cabFl2 = card.querySelector('div[onclick] > div:first-child');
      if (cabFl2) cabFl2.style.transform = 'rotate(0deg)';
      var cabBg2 = card.querySelector('div[onclick]');
      if (cabBg2) {
        cabBg2.style.background = '#fff';
        cabBg2.style.borderBottom = 'none';
        cabBg2.setAttribute('onmouseout', "this.style.background='#fff'");
      }
    }
  };

  function _cuerpoLote(lote, cuotas, ciRow, dnAmt, dnPagado, pagadas, totalC, pct) {
    var dnFecha = ciRow ? ciRow.fecha_pago : (lote.dnFecha || lote.saleDate || null);
    var dnNota  = ciRow ? ciRow.nota       : (lote.dnNota  || '');
    var precio  = Number(lote.salePrice) || 0;

    var sDn = dnPagado
      ? { color:'#2e7d32', bg:'#e8f5e9', icono:'✅', label:'Pagado' }
      : { color:'#1565c0', bg:'#e3f2fd', icono:'🔵', label:'Pendiente' };

    var filaCuotaInicial =
      '<tr style="border-top:2px solid #1565c0;background:#f0f4ff">' +
      '<td style="padding:7px 10px;font-weight:800;color:#1565c0">CI</td>' +
      '<td style="padding:7px 10px;color:#1565c0;font-weight:600">' + (dnFecha ? fmtFecha(dnFecha) : '— (ingreso)') + '</td>' +
      '<td style="padding:7px 10px;text-align:right;font-weight:800;color:#1565c0">' + fmtMonto(dnAmt) + '</td>' +
      '<td style="padding:7px 10px;text-align:center"><span style="background:'+sDn.bg+';color:'+sDn.color+';padding:3px 8px;border-radius:20px;font-size:10px;font-weight:700">'+sDn.icono+' '+sDn.label+'</span></td>' +
      '<td style="padding:7px 10px;color:#888">' + (dnPagado && dnFecha ? fmtFecha(dnFecha) : '—') + '</td>' +
      '<td style="padding:7px 10px;color:#888;text-align:right">—</td>' +
      '<td style="padding:7px 10px;color:#888;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escapeHtml(dnNota || '—') + '</td>' +
      '<td style="padding:7px 10px;text-align:center;white-space:nowrap">' +
      '<button class="btn bout bsm" onclick="window._segEditarCuotaInicial(\''+lote.id+'\')" style="font-size:11px;padding:4px 8px;margin-right:4px">✏️</button>' +
      (!dnPagado
        ? '<button class="btn bg bsm" onclick="window._segPagarCuotaInicial(\''+lote.id+'\')" style="font-size:11px;padding:4px 10px">✓ Pagar</button>'
        : '<button class="btn bout bsm" onclick="window._segDesmarcarCI(\''+lote.id+'\')" style="font-size:11px;padding:4px 10px;color:#888">↩</button>'
      ) + '</td></tr>';

    var resumen =
      '<div style="padding:12px 16px;background:#f8f9ff;border-bottom:1px solid #e8eaf6;display:flex;gap:16px;flex-wrap:wrap;align-items:center">' +
      '<div style="font-size:11px;color:#555">📋 <b>'+parseInt(lote.mo||0)+'</b> meses · ' +
      'Precio: <b>'+fmtMonto(precio)+'</b> · ' +
      'CI: <b>'+fmtMonto(dnAmt)+'</b> · ' +
      'C.C.: <b>'+(lote.cc||'—')+'</b> · ' +
      '📞 <b>'+(lote.phone||'—')+'</b>' +
      (lote.saleDate ? ' · Inicio: <b>'+fmtFecha(lote.saleDate)+'</b>' : '') +
      '</div>' +
      '<div style="margin-left:auto;display:flex;gap:6px">' +
      '<div style="font-size:11px;font-weight:700;color:#2e7d32">'+pagadas+'/'+totalC+' pagadas</div>' +
      '</div>' +
      '</div>';

    if (cuotas.length === 0) {
      return resumen +
        '<div style="padding:24px;text-align:center;font-size:12px;color:#999">⏳ Generando cuotas…</div>';
    }

    return resumen +
      '<div style="overflow-x:auto;padding:0 0 4px 0">' +
      '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead>' +
      '<tr style="background:#f5f5f5">' +
      '<th style="padding:7px 10px;text-align:left">#</th>' +
      '<th style="padding:7px 10px;text-align:left">Vence</th>' +
      '<th style="padding:7px 10px;text-align:right">Monto</th>' +
      '<th style="padding:7px 10px;text-align:center">Estado</th>' +
      '<th style="padding:7px 10px;text-align:left">Pagado el</th>' +
      '<th style="padding:7px 10px;text-align:right">Abonado</th>' +
      '<th style="padding:7px 10px;text-align:left">Nota</th>' +
      '<th style="padding:7px 10px;text-align:center">Acción</th>' +
      '</tr></thead><tbody>' +
      filaCuotaInicial +
      cuotas.map(function(p){
        var s       = semaforo(p);
        var abonado = Number(p.abonado) || 0;
        var monto   = Number(p.monto)   || 0;
        var pctA    = monto > 0 && abonado > 0 ? Math.min(100, Math.round(abonado / monto * 100)) : 0;
        var abonadoCell = abonado > 0
          ? '<div style="white-space:nowrap">' + fmtMonto(abonado) +
            '<div style="height:3px;background:#e0e0e0;border-radius:2px;margin-top:2px;width:60px">' +
            '<div style="height:3px;background:#9c27b0;border-radius:2px;width:'+pctA+'%"></div></div></div>'
          : '—';
        return '<tr style="border-top:1px solid #f0f0f0">' +
          '<td style="padding:7px 10px;font-weight:700;color:#1a237e">'+p.num_cuota+'</td>' +
          '<td style="padding:7px 10px">'+fmtFecha(p.fecha_vence)+'</td>' +
          '<td style="padding:7px 10px;text-align:right;font-weight:600">'+fmtMonto(p.monto)+'</td>' +
          '<td style="padding:7px 10px;text-align:center"><span style="background:'+s.bg+';color:'+s.color+';padding:3px 8px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap">'+s.icono+' '+s.label+'</span></td>' +
          '<td style="padding:7px 10px;color:#888">'+(p.fecha_pago?fmtFecha(p.fecha_pago):'—')+'</td>' +
          '<td style="padding:7px 10px;color:#888;text-align:right">'+abonadoCell+'</td>' +
          '<td style="padding:7px 10px;color:#888;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_escapeHtml(p.nota||'—')+'</td>' +
          '<td style="padding:7px 10px;text-align:center;white-space:nowrap">' +
          '<button class="btn bout bsm" onclick="window._segEditarCuota(\''+p.id+'\')" style="font-size:11px;padding:4px 8px;margin-right:4px">✏️</button>' +
          (!p.pagado
            ?'<button class="btn bg bsm" onclick="window._segRegistrarPago(\''+p.id+'\')" style="font-size:11px;padding:4px 10px">+ Pago</button>'
            :'<button class="btn bout bsm" onclick="window._segDesmarcarPago(\''+p.id+'\')" style="font-size:11px;padding:4px 10px;color:#888">↩</button>'
          )+'</td></tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  /* ══════════════════════════════════════════════════════════
     MODAL "EDITAR VENTA"
  ══════════════════════════════════════════════════════════ */
  window._segEditarVenta = function(loteId) {
    var lote = window.S && window.S.lots
      ? window.S.lots.find(function(l){ return l.id === loteId; })
      : null;
    if (!lote) { alert('No se encontró el lote.'); return; }

    var precio  = Number(lote.salePrice) || 0;
    var dnPct   = Number(lote.dn) || 20;
    var dnAmt   = Number(lote.dnAmt) > 0 ? Number(lote.dnAmt) : precio * dnPct / 100;
    var cmAmt   = Number(lote.cmAmt) || 0;
    var mo      = parseInt(lote.mo) || 0;

    var body =
      '<div style="background:#e3f2fd;border-radius:9px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:#1565c0">' +
      '📋 Lote <b>' + _escapeHtml(String(lote.id)) + '</b> — Edición de datos de la venta' +
      '</div>' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Comprador *</label>' +
      '<input id="evLoteBuyer" type="text" value="'+_escapeHtml(lote.buyer||'')+'" placeholder="Nombre completo" ' +
      'style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Cédula (C.C.)</label>' +
      '<input id="evLoteCC" type="text" value="'+_escapeHtml(lote.cc||'')+'" placeholder="Ej: 1234567890" ' +
      'style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Teléfono</label>' +
      '<input id="evLotePhone" type="tel" value="'+_escapeHtml(lote.phone||'')+'" placeholder="Ej: 3001234567" ' +
      'style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Precio de venta (millones COP) *</label>' +
      '<input id="evLotePrecio" type="number" step="0.0001" value="'+precio+'" ' +
      'style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:4px;box-sizing:border-box" ' +
      'oninput="window._segEVActualizar()">' +
      '<div id="evLotePrecioPreview" style="font-size:11px;color:#888;margin-bottom:12px"></div>' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Número de cuotas (meses) *</label>' +
      '<input id="evLoteMo" type="number" min="1" max="360" value="'+mo+'" ' +
      'style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box" ' +
      'oninput="window._segEVActualizar()">' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Cuota inicial / Enganche (millones COP)</label>' +
      '<input id="evLoteDN" type="number" step="0.0001" value="'+dnAmt+'" ' +
      'style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:4px;box-sizing:border-box" ' +
      'oninput="window._segEVActualizar()">' +
      '<div id="evLoteDNPreview" style="font-size:11px;color:#888;margin-bottom:12px"></div>' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Cuota mensual (millones COP) — dejar en 0 para calcular automático</label>' +
      '<input id="evLoteCM" type="number" step="0.0001" value="'+cmAmt+'" ' +
      'style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:4px;box-sizing:border-box" ' +
      'oninput="window._segEVActualizar()">' +
      '<div id="evLoteCMPreview" style="font-size:11px;color:#1565c0;font-weight:600;margin-bottom:12px"></div>' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Fecha de inicio de cuotas</label>' +
      '<input id="evLoteFecha" type="date" value="'+(lote.saleDate||'')+'" ' +
      'style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
      '<div style="background:#fff3e0;border-radius:8px;padding:10px 12px;font-size:11px;color:#e65100;line-height:1.5">' +
      '⚠️ Si cambias el precio, cuotas o meses, las cuotas existentes se <b>eliminarán y regenerarán</b> automáticamente.' +
      '</div>';

    _abrirModal('✏️ Editar venta — Lote ' + _escapeHtml(String(lote.id)), body, function() {
      var buyer   = (document.getElementById('evLoteBuyer').value || '').trim();
      var cc      = (document.getElementById('evLoteCC').value || '').trim();
      var phone   = (document.getElementById('evLotePhone').value || '').trim();
      var precioN = parseFloat(document.getElementById('evLotePrecio').value) || 0;
      var moN     = parseInt(document.getElementById('evLoteMo').value)       || 0;
      var dnN     = parseFloat(document.getElementById('evLoteDN').value)     || 0;
      var cmN     = parseFloat(document.getElementById('evLoteCM').value)     || 0;
      var fecha   = document.getElementById('evLoteFecha').value || '';

      if (!buyer)    { alert('El nombre del comprador es obligatorio.'); return; }
      if (precioN <= 0) { alert('El precio debe ser mayor a 0.'); return; }
      if (moN <= 0)  { alert('El número de cuotas debe ser mayor a 0.'); return; }

      var cambioFinanciero = (precioN !== (Number(lote.salePrice)||0)) ||
                             (moN    !== (parseInt(lote.mo)||0))       ||
                             (dnN    !== (Number(lote.dnAmt)||0))      ||
                             (cmN    !== (Number(lote.cmAmt)||0))      ||
                             (fecha  !== (lote.saleDate||''));

      lote.buyer     = buyer;
      lote.cc        = cc;
      lote.phone     = phone;
      lote.salePrice = precioN;
      lote.mo        = moN;
      lote.dnAmt     = dnN;
      lote.dn        = dnN > 0 && precioN > 0 ? Math.round(dnN / precioN * 100) : (Number(lote.dn)||20);
      lote.cmAmt     = cmN;
      lote.saleDate  = fecha;

      if (typeof saveS === 'function') saveS();
      if (typeof syncLot === 'function') syncLot(lote);

      if (cambioFinanciero) {
        var existentes = _pagos.filter(function(p){ return p.lot_id === lote.id && p.num_cuota > 0; });
        Promise.all(existentes.map(function(p){ return sbDelete('pagos', p.id); }))
          .then(function(){
            _pagos = _pagos.filter(function(p){ return !(p.lot_id === lote.id && p.num_cuota > 0); });
            _acordeonesAbiertos[lote.id] = true;
            return sincronizarCuotas(lote);
          })
          .then(function(){
            _cerrarModal();
            _renderVista();
          })
          .catch(function(e){ alert('Error al regenerar cuotas: ' + e.message); });
      } else {
        _acordeonesAbiertos[lote.id] = true;
        _cerrarModal();
        _renderVista();
      }
    });

    setTimeout(function() {
      window._segEVActualizar = function() {
        var p  = parseFloat(document.getElementById('evLotePrecio').value) || 0;
        var m  = parseInt(document.getElementById('evLoteMo').value)        || 0;
        var dn = parseFloat(document.getElementById('evLoteDN').value)      || 0;
        var cm = parseFloat(document.getElementById('evLoteCM').value)      || 0;
        var el = document.getElementById('evLotePrecioPreview');
        if (el) el.textContent = p > 0 ? '→ ' + fmtMonto(p) : '';
        var el2 = document.getElementById('evLoteDNPreview');
        if (el2) el2.textContent = dn > 0 ? '→ ' + fmtMonto(dn) : '';
        var el3 = document.getElementById('evLoteCMPreview');
        if (el3) {
          var saldo = Math.max(0, p - dn);
          var cuotaCalc = (cm > 0) ? cm : (m > 0 ? saldo / m : 0);
          el3.textContent = cuotaCalc > 0
            ? '→ Cuota mensual: ' + fmtMonto(cuotaCalc) + (cm <= 0 ? ' (calculada)' : '')
            : '';
        }
      };
      window._segEVActualizar();
    }, 80);
  };

  /* ══════════════════════════════════════════════════════════
     VISTA 3 — PROSPECTOS
  ══════════════════════════════════════════════════════════ */
  var ESTADOS=[
    {id:'interesado',  label:'🙋 Interesado',  color:'#1565c0',bg:'#e3f2fd'},
    {id:'presentacion',label:'📋 Presentación', color:'#6a1b9a',bg:'#f3e5f5'},
    {id:'negociacion', label:'🤝 Negociación',  color:'#e65100',bg:'#fff3e0'},
    {id:'cerrado',     label:'✅ Cerrado',       color:'#2e7d32',bg:'#e8f5e9'},
    {id:'perdido',     label:'❌ Dame Referidos',color:'#757575',bg:'#f5f5f5'},
  ];

  function _renderProspectos(c) {
    var prosFiltrados=_vendedorActivo
      ?_prospectos.filter(function(p){return p.vendedor_id===_vendedorActivo;})
      :_prospectos;
    var vendedorActualNombre='';
    if(_vendedorActivo){
      var vAct=_vendedores.find(function(v){return v.id===_vendedorActivo;});
      vendedorActualNombre=vAct?vAct.nombre:'';
    }
    var optsVendedor='<option value="">👥 Todos los vendedores</option>'+
      _vendedores.map(function(v){return '<option value="'+v.id+'"'+(_vendedorActivo===v.id?' selected':'')+'>'+v.nombre+'</option>';}).join('');

    c.innerHTML=
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
      '<select id="segFiltroVendedor" onchange="window._segCambiarVendedor(this.value)" ' +
      'style="padding:8px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;background:#fff">'+optsVendedor+'</select>' +
      '<div style="font-size:13px;font-weight:800;color:#1a237e">'+(vendedorActualNombre?'👤 '+vendedorActualNombre+' — ':'')+'Pipeline ('+prosFiltrados.length+')</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px">' +
      '<button class="btn bout bsm" onclick="window._segGestionarVendedores()">⚙️ Vendedores</button>' +
      '<button class="btn bg bsm" onclick="window._segNuevoProspecto()">+ Nuevo prospecto</button>' +
      '</div></div>' +
      '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;align-items:start;overflow-x:auto">' +
      ESTADOS.map(function(est){
        var grupo=prosFiltrados.filter(function(p){return p.estado===est.id;});
        return '<div style="background:'+est.bg+';border-radius:10px;padding:10px;min-width:160px">' +
          '<div style="font-size:11px;font-weight:800;color:'+est.color+';margin-bottom:8px;text-align:center">'+est.label+' ('+grupo.length+')</div>' +
          grupo.map(function(p){return _cardProspecto(p,est);}).join('')+
          '</div>';
      }).join('')+'</div>';
  }

  function _cardProspecto(p, est) {
    var diffSeg=p.next_follow?diffDias(p.next_follow):null;
    var alertaSeg=diffSeg!==null&&diffSeg<=1&&p.estado!=='cerrado'&&p.estado!=='perdido';
    var vend=_vendedores.find(function(v){return v.id===p.vendedor_id;});
    var vendNombre=vend?vend.nombre:'';
    return '<div style="background:#fff;border-radius:8px;padding:10px;margin-bottom:8px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-left:3px solid '+est.color+'">' +
      '<div style="font-size:12px;font-weight:700;color:#1a237e;margin-bottom:4px">'+_escapeHtml(p.nombre)+'</div>' +
      (p.telefono?'<div style="font-size:11px;color:#666">📞 '+p.telefono+'</div>':'') +
      (vendNombre?'<div style="display:inline-block;font-size:10px;padding:2px 7px;border-radius:10px;background:#e8eaf6;color:#3949ab;font-weight:700;margin-top:4px">👤 '+vendNombre+'</div>':'') +
      (p.next_follow?'<div style="font-size:10px;margin-top:4px;color:'+(alertaSeg?'#c62828':'#888')+'">'+(alertaSeg?'🔔 ':'📅 ')+'Seguimiento: '+fmtFecha(p.next_follow)+'</div>':'') +
      (p.notas?'<div style="font-size:10px;color:#999;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_escapeHtml(p.notas)+'</div>':'') +
      '<div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap">' +
      '<button onclick="window._segEditarProspecto(\''+p.id+'\')" style="flex:1;font-size:10px;padding:3px 6px;background:'+est.bg+';color:'+est.color+';border:1px solid '+est.color+';border-radius:5px;cursor:pointer">✏️ Editar</button>' +
      '<button onclick="window._segMoverProspecto(\''+p.id+'\')" style="flex:1;font-size:10px;padding:3px 6px;background:#f5f5f5;color:#555;border:1px solid #ddd;border-radius:5px;cursor:pointer">→ Mover</button>' +
      '<button onclick="window._segEliminarProspecto(\''+p.id+'\')" style="font-size:10px;padding:3px 6px;background:#ffebee;color:#c62828;border:1px solid #ef9a9a;border-radius:5px;cursor:pointer" title="Eliminar prospecto">🗑️</button>' +
      '</div></div>';
  }

  /* ══════════════════════════════════════════════════════════
     MODAL GENÉRICO
  ══════════════════════════════════════════════════════════ */
  function _inp(id, label, type, val, placeholder, extra) {
    return '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">'+label+'</label>' +
      '<input id="'+id+'" type="'+type+'" value="'+(val||'')+'" placeholder="'+(placeholder||'')+'" '+(extra||'')+
      ' style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">';
  }

  function _abrirModal(titulo, bodyHtml, onGuardar) {
    var overlay=document.getElementById('segModal');
    if(!overlay){
      overlay=document.createElement('div');
      overlay.id='segModal';
      overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9500;display:flex;align-items:center;justify-content:center';
      overlay.addEventListener('click',function(e){if(e.target===overlay) _cerrarModal();});
      document.body.appendChild(overlay);
    }
    overlay.innerHTML=
      '<div style="background:#fff;border-radius:14px;padding:24px;width:480px;max-width:94vw;max-height:88vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<div style="font-size:15px;font-weight:800;color:#1a237e">'+titulo+'</div>' +
      '<button onclick="window._segCerrarModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#888">✕</button>' +
      '</div>'+bodyHtml+
      '<div style="display:flex;gap:10px;margin-top:18px">' +
      '<button id="segModalGuardar" class="btn bg" style="flex:1;padding:11px">✅ Guardar</button>' +
      '<button onclick="window._segCerrarModal()" class="btn bout" style="flex:1;padding:11px">Cancelar</button>' +
      '</div></div>';
    overlay.style.display='flex';
    document.getElementById('segModalGuardar').onclick=onGuardar;
  }

  function _cerrarModal() {
    var m=document.getElementById('segModal'); if(m) m.style.display='none';
  }
  window._segCerrarModal=_cerrarModal;

  /* ══════════════════════════════════════════════════════════
     ACCIONES — AGENDA
  ══════════════════════════════════════════════════════════ */
  window._segCerrarDia=function(){ _diaSeleccionado=null; _renderVista(); };
  window._segNuevoEvento=function(fechaPresel){ _abrirModalEvento(null, fechaPresel); };
  window._segEditarEvento=function(id){
    var e=_eventos.find(function(x){return x.id===id;}); if(e) _abrirModalEvento(e,null);
  };

  function _abrirModalEvento(e, fechaPresel) {
    var esEdicion = !!e;
    var tipos = ['reunion', 'llamada', 'presentacion', 'seguimiento', 'pago'];
    var fechaDefecto = fechaPresel ? (fechaPresel + 'T08:00') : ahoraLocal();
    var fechaVal = e ? (e.fecha || fechaDefecto) : fechaDefecto;
    var reminderVal = e ? (e.reminder_min || 60) : 60;
    var _pu = 'h', _pv = 1;
    if (reminderVal < 60)        { _pu = 'min'; _pv = reminderVal; }
    else if (reminderVal < 1440) { _pu = 'h';   _pv = Math.round(reminderVal / 60); }
    else                         { _pu = 'd';   _pv = Math.round(reminderVal / 1440); }

    var pickerStyle =
      '<style>' +
      '.rp-wrap{display:flex;gap:8px;align-items:stretch;margin-bottom:14px}' +
      '.rp-num{flex:1;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:15px;font-weight:700;color:#1a237e;text-align:center;outline:none;min-width:0;box-sizing:border-box}' +
      '.rp-num:focus{border-color:#1565C0;box-shadow:0 0 0 3px rgba(21,101,192,.12)}' +
      '.rp-units{display:flex;gap:4px;flex-shrink:0}' +
      '.rp-u{padding:8px 13px;border:1.5px solid #ddd;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;background:#fff;color:#666;transition:.15s;white-space:nowrap}' +
      '.rp-u.on{background:#1565C0;color:#fff;border-color:#1565C0}' +
      '.rp-preview{font-size:11px;color:#1565c0;font-weight:600;margin-top:-10px;margin-bottom:12px;min-height:16px;padding-left:2px}' +
      '.rp-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}' +
      '.rp-chip{padding:5px 11px;border-radius:20px;border:1.5px solid #ddd;font-size:11px;font-weight:700;cursor:pointer;background:#fff;color:#666;transition:.15s}' +
      '.rp-chip:hover{border-color:#1565C0;color:#1565C0}' +
      '</style>';

    var chips = [
      { label: '15 min', min: 15 },
      { label: '30 min', min: 30 },
      { label: '1 hora', min: 60 },
      { label: '2 horas', min: 120 },
      { label: '4 horas', min: 240 },
      { label: '1 día',  min: 1440 },
      { label: '2 días', min: 2880 },
    ];

    var body =
      pickerStyle +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Tipo</label>' +
      '<select id="segEvTipo" style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
      tipos.map(function(t) {
        return '<option value="' + t + '"' + (e && e.tipo === t ? ' selected' : '') + '>' +
          t.charAt(0).toUpperCase() + t.slice(1) + '</option>';
      }).join('') + '</select>' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Título *</label>' +
      '<input id="segEvTitulo" type="text" value="' + (e ? _escapeHtml(e.titulo || '') : '') + '" placeholder="Ej: Reunión con Juan Pérez"' +
      ' style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Fecha y hora *</label>' +
      '<input id="segEvFecha" type="datetime-local" value="' + fechaVal + '"' +
      ' style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:8px">⏰ Recordatorio — ¿cuánto antes avisar?</label>' +
      '<div class="rp-chips">' +
      chips.map(function(c) {
        return '<button type="button" class="rp-chip" data-min="' + c.min + '">' + c.label + '</button>';
      }).join('') + '</div>' +
      '<div class="rp-wrap">' +
      '<input id="rpNum" type="number" min="1" max="999" value="' + _pv + '" class="rp-num">' +
      '<div class="rp-units">' +
      '<button type="button" class="rp-u' + (_pu === 'min' ? ' on' : '') + '" data-u="min">min</button>' +
      '<button type="button" class="rp-u' + (_pu === 'h'   ? ' on' : '') + '" data-u="h">horas</button>' +
      '<button type="button" class="rp-u' + (_pu === 'd'   ? ' on' : '') + '" data-u="d">días</button>' +
      '</div></div>' +
      '<div class="rp-preview" id="rpPreview"></div>' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Vendedor responsable</label>' +
      '<select id="segEvVendedor" style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
      '<option value="">— Sin asignar —</option>' +
      _vendedores.map(function(v) {
        return '<option value="' + v.id + '"' + (e && e.vendedor_id === v.id ? ' selected' : '') + '>' + v.nombre + '</option>';
      }).join('') + '</select>' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Descripción</label>' +
      '<textarea id="segEvDesc" rows="2" style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box;resize:vertical">' +
      (e ? _escapeHtml(e.descripcion || '') : '') + '</textarea>' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Relacionado (lote ID o nombre)</label>' +
      '<input id="segEvRel" type="text" value="' + (e ? _escapeHtml(e.relacionado || '') : '') + '" placeholder="Ej: B02 o Juan Pérez"' +
      ' style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:0;box-sizing:border-box">';

    _abrirModal((esEdicion ? '✏️ Editar evento' : '📅 Nuevo evento'), body, function () {
      var rpNum = document.getElementById('rpNum');
      var rpUon = document.querySelector('.rp-u.on');
      var rpVal = parseInt((rpNum ? rpNum.value : '') || '1') || 1;
      var rpU   = rpUon ? rpUon.dataset.u : 'h';
      var reminderMin = rpU === 'min' ? rpVal : rpU === 'h' ? rpVal * 60 : rpVal * 1440;
      var titulo = (document.getElementById('segEvTitulo').value || '').trim();
      if (!titulo) { alert('El título es obligatorio.'); return; }
      var fechaInput = document.getElementById('segEvFecha').value;
      var datos = {
        tipo         : document.getElementById('segEvTipo').value,
        titulo       : titulo,
        fecha        : fechaInput || null,
        reminder_min : reminderMin,
        vendedor_id  : document.getElementById('segEvVendedor').value || null,
        descripcion  : document.getElementById('segEvDesc').value.trim(),
        relacionado  : document.getElementById('segEvRel').value.trim(),
      };
      if (!esEdicion) {
        datos.completado = false;
        datos.notificado = false;
      } else {
        datos.notificado = false;
        var keyAnterior = 'nav-ev-ahora-' + e.id;
        var keyMinAnt   = 'nav-ev-min-'   + e.id;
        delete _tgNotificado[keyAnterior];
        delete _tgNotificado[keyMinAnt];
      }
      var op = esEdicion ? sbUpdate('eventos', e.id, datos) : sbInsert('eventos', datos);
      op.then(function (res) {
        if (esEdicion) {
          var idx = _eventos.findIndex(function(x) { return x.id === e.id; });
          if (idx >= 0) _eventos[idx] = Object.assign(_eventos[idx], datos);
          if (_resultadosBusq !== null) {
            var idxB = _resultadosBusq.findIndex(function(x){ return x.id === e.id; });
            if (idxB >= 0) _resultadosBusq[idxB] = Object.assign(_resultadosBusq[idxB], datos);
          }
        } else {
          if (Array.isArray(res)) _eventos = _eventos.concat(res);
        }
        _cerrarModal(); _renderVista(); _actualizarCampanita();
      }).catch(function (err) { alert('Error: ' + err.message); });
    });

    setTimeout(function () {
      var rpNum    = document.getElementById('rpNum');
      var rpPreview = document.getElementById('rpPreview');
      var uBtns    = document.querySelectorAll('.rp-u');
      var chipBtns = document.querySelectorAll('.rp-chip');
      function calcMin() {
        var v  = parseInt(rpNum.value || '1') || 1;
        var on = document.querySelector('.rp-u.on');
        var u  = on ? on.dataset.u : 'h';
        return u === 'min' ? v : u === 'h' ? v * 60 : v * 1440;
      }
      function labelMin(min) {
        if (min < 60)   return min + ' minuto' + (min === 1 ? '' : 's') + ' antes';
        if (min < 1440) { var h = Math.round(min / 60); return h + ' hora' + (h === 1 ? '' : 's') + ' antes'; }
        var d = Math.round(min / 1440); return d + ' día' + (d === 1 ? '' : 's') + ' antes';
      }
      function updatePreview() {
        var min = calcMin();
        if (rpPreview) rpPreview.textContent = '→ Recordatorio ' + labelMin(min);
      }
      uBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          uBtns.forEach(function(b) { b.classList.remove('on'); });
          this.classList.add('on');
          updatePreview();
        });
      });
      if (rpNum) rpNum.addEventListener('input', updatePreview);
      chipBtns.forEach(function (chip) {
        chip.addEventListener('click', function () {
          var min = parseInt(this.dataset.min);
          uBtns.forEach(function(b) { b.classList.remove('on'); });
          if (min < 60) {
            rpNum.value = min;
            document.querySelector('.rp-u[data-u="min"]').classList.add('on');
          } else if (min < 1440) {
            rpNum.value = Math.round(min / 60);
            document.querySelector('.rp-u[data-u="h"]').classList.add('on');
          } else {
            rpNum.value = Math.round(min / 1440);
            document.querySelector('.rp-u[data-u="d"]').classList.add('on');
          }
          updatePreview();
        });
      });
      updatePreview();
    }, 80);
  }

  /* ══════════════════════════════════════════════════════════
     ACCIONES — PAGOS
  ══════════════════════════════════════════════════════════ */
  window._segRegistrarPago = function(pagoId) {
    var pago = _pagos.find(function(p){ return p.id === pagoId; });
    if (!pago) return;
    var abonado  = Number(pago.abonado)  || 0;
    var monto    = Number(pago.monto)    || 0;
    var restante = Math.max(0, monto - abonado);

    var body =
      (abonado > 0
        ? '<div style="background:#f3e5f5;border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:12px;color:#6a1b9a">' +
          '💜 Ya abonado: <b>' + fmtMonto(abonado) + '</b> de ' + fmtMonto(monto) +
          ' &nbsp;·&nbsp; Restante: <b>' + fmtMonto(restante) + '</b></div>'
        : '') +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Monto a pagar ahora *</label>' +
      '<input id="segPagoMonto" type="number" step="0.0001" value="' + restante + '" ' +
      'style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:4px;box-sizing:border-box">' +
      '<div id="segPagoMontoPreview" style="font-size:11px;color:#888;margin-bottom:12px"></div>' +
      '<div id="segPagoTipoLabel" style="font-size:12px;font-weight:700;padding:8px 12px;border-radius:8px;margin-bottom:12px;background:#e3f2fd;color:#1565c0">🔵 Cargando…</div>' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Fecha de pago</label>' +
      '<input id="segPagoFecha" type="date" value="' + hoy() + '" ' +
      'style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Nota / Comprobante</label>' +
      '<input id="segPagoNota" type="text" value="" placeholder="Ej: Transferencia #12345" ' +
      'style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:0;box-sizing:border-box">';

    _abrirModal('+ Registrar pago — Cuota #' + pago.num_cuota + ' · ' + fmtMonto(monto), body, function() {
      var valorIngresado = parseFloat(document.getElementById('segPagoMonto').value);
      var fechaPago      = document.getElementById('segPagoFecha').value || hoy();
      var nota           = document.getElementById('segPagoNota').value.trim();

      if (isNaN(valorIngresado) || valorIngresado <= 0) {
        alert('Ingresa un monto válido mayor a 0.');
        return;
      }

      var nuevoAbonado = abonado + valorIngresado;
      var esPagoTotal  = nuevoAbonado >= monto;

      var datosUpdate = {
        abonado    : nuevoAbonado,
        nota       : nota,
        notificado : false
      };
      if (esPagoTotal) {
        datosUpdate.pagado     = true;
        datosUpdate.fecha_pago = fechaPago;
        datosUpdate.abonado    = monto;
      }

      sbUpdate('pagos', pagoId, datosUpdate).then(function() {
        var idx = _pagos.findIndex(function(p){ return p.id === pagoId; });
        if (idx >= 0) Object.assign(_pagos[idx], datosUpdate);
        _cerrarModal();
        _acordeonesAbiertos[pago.lot_id] = true;
        _renderVista(); _actualizarCampanita();

        if (esPagoTotal) {
          if ('Notification' in window && Notification.permission === 'granted') {
            var lote = window.S && window.S.lots
              ? window.S.lots.find(function(l){ return l.id === pago.lot_id; })
              : null;
            new Notification('✅ Cuota pagada', {
              body: (lote ? lote.buyer : 'Lote ' + pago.lot_id) + ' · Cuota #' + pago.num_cuota,
              icon: 'logo.png'
            });
          }
        }
      }).catch(function(e){ alert('Error: ' + e.message); });
    });

    setTimeout(function() {
      var inp   = document.getElementById('segPagoMonto');
      var prev  = document.getElementById('segPagoMontoPreview');
      var label = document.getElementById('segPagoTipoLabel');
      if (!inp) return;

      function actualizarIndicador() {
        var v = parseFloat(inp.value) || 0;
        if (prev) prev.textContent = v > 0 ? '→ ' + fmtMonto(v) : '';
        if (!label) return;
        var total = abonado + v;
        if (v <= 0) {
          label.style.background = '#f5f5f5'; label.style.color = '#888';
          label.textContent = '— Ingresa un monto';
        } else if (total >= monto) {
          label.style.background = '#e8f5e9'; label.style.color = '#2e7d32';
          label.textContent = '✅ Pago completo — la cuota quedará pagada';
        } else {
          var pct = Math.min(99, Math.round(total / monto * 100));
          label.style.background = '#f3e5f5'; label.style.color = '#6a1b9a';
          label.textContent = '💜 Abono parcial — ' + pct + '% completado (' + fmtMonto(total) + ' de ' + fmtMonto(monto) + ')';
        }
      }
      inp.addEventListener('input', actualizarIndicador);
      actualizarIndicador();
    }, 100);
  };

  window._segDesmarcarPago = function(pagoId) {
    var pago = _pagos.find(function(p){ return p.id === pagoId; });
    if (!confirm('¿Desmarcar este pago? También se reiniciarán los abonos.')) return;
    sbUpdate('pagos', pagoId, { pagado: false, fecha_pago: null, nota: '', abonado: 0, notificado: false }).then(function() {
      var idx = _pagos.findIndex(function(p){ return p.id === pagoId; });
      if (idx >= 0) {
        _pagos[idx].pagado     = false;
        _pagos[idx].fecha_pago = null;
        _pagos[idx].abonado    = 0;
        _pagos[idx].notificado = false;
      }
      if (pago) _acordeonesAbiertos[pago.lot_id] = true;
      _renderVista(); _actualizarCampanita();
    });
  };

  /* ══════════════════════════════════════════════════════════
     MODAL EDITAR CUOTA
  ══════════════════════════════════════════════════════════ */
  window._segEditarCuota = function(pagoId) {
    var pago = _pagos.find(function(p){ return p.id === pagoId; });
    if (!pago) return;

    var cuotasLote = _pagos.filter(function(p){
      return p.lot_id === pago.lot_id && p.num_cuota > pago.num_cuota && !p.pagado;
    });
    var hayFuturas = cuotasLote.length > 0;
    var abonadoActual = Number(pago.abonado) || 0;
    var montoActual   = Number(pago.monto)   || 0;

    var body =
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Fecha de vencimiento</label>' +
      '<input id="segCuotaFecha" type="date" value="' + (pago.fecha_vence || '') + '" ' +
      'style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Monto (en millones COP)</label>' +
      '<input id="segCuotaMonto" type="number" step="0.0001" value="' + (pago.monto || '') + '" ' +
      'style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:4px;box-sizing:border-box">' +
      '<div style="font-size:11px;color:#888;margin-bottom:12px" id="segCuotaMontoPreview"></div>' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Abonado actual (en millones COP)</label>' +
      '<input id="segCuotaAbonado" type="number" step="0.0001" min="0" value="' + abonadoActual + '" ' +
      'style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:4px;box-sizing:border-box">' +
      '<div style="font-size:11px;color:#888;margin-bottom:4px" id="segCuotaAbonadoPreview"></div>' +
      '<div style="font-size:11px;color:#555;background:#f3e5f5;border-radius:7px;padding:8px 11px;margin-bottom:12px;line-height:1.5">' +
      '💜 Editar este campo corrige directamente el abono registrado. ' +
      'Si el abono iguala o supera el monto, la cuota se marcará como <b>pagada</b>.' +
      '</div>' +
      (hayFuturas
        ? '<div style="background:#e3f2fd;border-radius:8px;padding:10px 12px;margin-bottom:4px">' +
          '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:600;color:#1565c0">' +
          '<input type="checkbox" id="segCuotaCascada" checked style="width:16px;height:16px;cursor:pointer"> ' +
          'Ajustar automáticamente las fechas de las cuotas siguientes</label>' +
          '<div style="font-size:11px;color:#555;margin-top:4px;padding-left:24px">' +
          'Cada cuota pendiente posterior se recalculará +1 mes respecto a la anterior.' +
          '</div></div>'
        : '<div style="font-size:11px;color:#999;margin-bottom:4px">No hay cuotas pendientes posteriores para ajustar.</div>'
      );

    _abrirModal('✏️ Editar cuota #' + pago.num_cuota + ' — Lote ' + pago.lot_id, body, function() {
      var nuevaFecha   = document.getElementById('segCuotaFecha').value;
      var nuevoMonto   = parseFloat(document.getElementById('segCuotaMonto').value);
      var nuevoAbonado = parseFloat(document.getElementById('segCuotaAbonado').value);
      var aplicarCasc  = hayFuturas && document.getElementById('segCuotaCascada')
        ? document.getElementById('segCuotaCascada').checked
        : false;

      if (!nuevaFecha) { alert('La fecha es obligatoria.'); return; }
      if (isNaN(nuevoMonto) || nuevoMonto <= 0) { alert('Ingresa un monto válido.'); return; }
      if (isNaN(nuevoAbonado) || nuevoAbonado < 0) { alert('El abono no puede ser negativo.'); return; }

      var quedaPagada = nuevoAbonado >= nuevoMonto;
      var datosUpdate = {
        fecha_vence : nuevaFecha,
        monto       : nuevoMonto,
        abonado     : quedaPagada ? nuevoMonto : nuevoAbonado,
        notificado  : false
      };
      if (quedaPagada && !pago.pagado) {
        datosUpdate.pagado     = true;
        datosUpdate.fecha_pago = pago.fecha_pago || hoy();
      } else if (!quedaPagada && pago.pagado) {
        datosUpdate.pagado     = false;
        datosUpdate.fecha_pago = null;
      }

      sbUpdate('pagos', pagoId, datosUpdate)
        .then(function() {
          var idx = _pagos.findIndex(function(p){ return p.id === pagoId; });
          if (idx >= 0) Object.assign(_pagos[idx], datosUpdate);
          if (aplicarCasc) {
            return _aplicarCascadaFechas(pago.lot_id, pago.num_cuota, nuevaFecha);
          }
        })
        .then(function() {
          _acordeonesAbiertos[pago.lot_id] = true;
          _cerrarModal(); _renderVista(); _actualizarCampanita();
        })
        .catch(function(e){ alert('Error: ' + e.message); });
    });

    setTimeout(function() {
      var inpMonto   = document.getElementById('segCuotaMonto');
      var inpAbonado = document.getElementById('segCuotaAbonado');
      var prevMonto  = document.getElementById('segCuotaMontoPreview');
      var prevAbon   = document.getElementById('segCuotaAbonadoPreview');

      function actMonto() {
        var v = parseFloat(inpMonto.value);
        if (prevMonto) prevMonto.textContent = isNaN(v) ? '' : '→ ' + fmtMonto(v);
        actAbonado();
      }
      function actAbonado() {
        var a = parseFloat(inpAbonado ? inpAbonado.value : 0) || 0;
        var m = parseFloat(inpMonto   ? inpMonto.value   : 0) || 0;
        if (!prevAbon) return;
        if (a <= 0) {
          prevAbon.textContent = '';
        } else if (m > 0 && a >= m) {
          prevAbon.textContent = '→ ' + fmtMonto(a) + ' — ✅ cubrirá el monto completo (se marcará pagada)';
          prevAbon.style.color = '#2e7d32';
        } else {
          var pct = m > 0 ? Math.min(99, Math.round(a / m * 100)) : 0;
          prevAbon.textContent = '→ ' + fmtMonto(a) + ' — 💜 ' + pct + '% del monto';
          prevAbon.style.color = '#6a1b9a';
        }
      }

      if (inpMonto)   inpMonto.addEventListener('input', actMonto);
      if (inpAbonado) inpAbonado.addEventListener('input', actAbonado);
      actMonto();
    }, 100);
  };

  /* ══════════════════════════════════════════════════════════
     ACCIONES — CUOTA INICIAL
  ══════════════════════════════════════════════════════════ */
  window._segEditarCuotaInicial = function(loteId) {
    var lote = window.S && window.S.lots ? window.S.lots.find(function(l){ return l.id===loteId; }) : null;
    if (!lote) return;
    var dnAmt = Number(lote.dnAmt) || 0;
    var body =
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Fecha de pago / ingreso</label>' +
      '<input id="segCIFecha" type="date" value="'+(lote.dnFecha||lote.saleDate||'')+'" style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Monto cuota inicial (en millones COP)</label>' +
      '<input id="segCIMonto" type="number" step="0.0001" value="'+dnAmt+'" style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:4px;box-sizing:border-box">' +
      '<div style="font-size:11px;color:#888;margin-bottom:12px" id="segCIMontoPreview"></div>' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Nota / Comprobante</label>' +
      '<input id="segCINota" type="text" value="'+_escapeHtml(lote.dnNota||'')+'" placeholder="Ej: Transferencia #12345" style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:0;box-sizing:border-box">';
    _abrirModal('✏️ Editar cuota inicial — Lote '+loteId, body, function() {
      var nuevoMonto = parseFloat(document.getElementById('segCIMonto').value);
      var nuevaFecha = document.getElementById('segCIFecha').value;
      var nuevaNota  = document.getElementById('segCINota').value.trim();
      if (isNaN(nuevoMonto) || nuevoMonto < 0) { alert('Ingresa un monto válido.'); return; }
      lote.dnAmt  = nuevoMonto;
      lote.dnFecha = nuevaFecha;
      lote.dnNota  = nuevaNota;
      if (typeof saveS === 'function') saveS();
      if (typeof syncLot === 'function') syncLot(lote);
      _acordeonesAbiertos[loteId] = true;
      _cerrarModal(); _renderVista();
    });
    setTimeout(function() {
      var inp = document.getElementById('segCIMonto');
      var prev = document.getElementById('segCIMontoPreview');
      if (!inp || !prev) return;
      function act() { var v = parseFloat(inp.value); prev.textContent = isNaN(v) ? '' : '→ ' + fmtMonto(v); }
      inp.addEventListener('input', act); act();
    }, 100);
  };

  window._segPagarCuotaInicial = function(loteId) {
    var lote = window.S && window.S.lots ? window.S.lots.find(function(l){ return l.id===loteId; }) : null;
    if (!lote) return;
    var dnAmt = Number(lote.dnAmt) || 0;
    var body =
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Fecha de pago</label>' +
      '<input id="segCIPFecha" type="date" value="'+hoy()+'" style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Monto recibido (en millones COP)</label>' +
      '<input id="segCIPMonto" type="number" step="0.0001" value="'+dnAmt+'" style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:4px;box-sizing:border-box">' +
      '<div style="font-size:11px;color:#888;margin-bottom:12px" id="segCIPMontoPreview"></div>' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Nota / Comprobante</label>' +
      '<input id="segCIPNota" type="text" value="" placeholder="Ej: Transferencia #12345" style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:0;box-sizing:border-box">';
    _abrirModal('✓ Registrar pago — Cuota Inicial Lote '+loteId, body, function() {
      var monto = parseFloat(document.getElementById('segCIPMonto').value) || dnAmt;
      var fecha = document.getElementById('segCIPFecha').value || hoy();
      var nota  = document.getElementById('segCIPNota').value.trim();
      lote.dnPagado = true; lote.dnAmt = monto; lote.dnFecha = fecha; lote.dnNota = nota;
      if (typeof saveS === 'function') saveS();
      if (typeof syncLot === 'function') syncLot(lote);
      var ciExistente = _pagos.find(function(p){ return p.lot_id === loteId && p.num_cuota === 0; });
      if (ciExistente) {
        sbUpdate('pagos', ciExistente.id, { pagado: true, fecha_pago: fecha, monto: monto, nota: nota }).then(function() {
          ciExistente.pagado = true; ciExistente.fecha_pago = fecha; ciExistente.monto = monto; ciExistente.nota = nota;
          _acordeonesAbiertos[loteId] = true;
          _cerrarModal(); _renderVista();
        }).catch(function(e){ alert('Error: ' + e.message); });
      } else {
        sbInsert('pagos', { lot_id: loteId, num_cuota: 0, fecha_vence: lote.dnFecha || lote.saleDate || hoy(), monto: monto, pagado: true, fecha_pago: fecha, nota: nota, abonado: 0 })
          .then(function(res) {
            if (Array.isArray(res)) _pagos = _pagos.concat(res);
            _acordeonesAbiertos[loteId] = true;
            _cerrarModal(); _renderVista();
          }).catch(function(e){ alert('Error: ' + e.message); });
      }
    });
    setTimeout(function() {
      var inp = document.getElementById('segCIPMonto');
      var prev = document.getElementById('segCIPMontoPreview');
      if (!inp || !prev) return;
      function act() { var v = parseFloat(inp.value); prev.textContent = isNaN(v) ? '' : '→ ' + fmtMonto(v); }
      inp.addEventListener('input', act); act();
    }, 100);
  };

  window._segDesmarcarCI = function(loteId) {
    if (!confirm('¿Desmarcar la cuota inicial como no pagada?')) return;
    var lote = window.S && window.S.lots ? window.S.lots.find(function(l){ return l.id===loteId; }) : null;
    if (!lote) return;
    lote.dnPagado = false;
    if (typeof saveS === 'function') saveS();
    if (typeof syncLot === 'function') syncLot(lote);
    var ciExistente = _pagos.find(function(p){ return p.lot_id === loteId && p.num_cuota === 0; });
    if (ciExistente) {
      sbUpdate('pagos', ciExistente.id, { pagado: false, fecha_pago: null, nota: '' }).then(function() {
        ciExistente.pagado = false; ciExistente.fecha_pago = null; ciExistente.nota = '';
        _acordeonesAbiertos[loteId] = true;
        _renderVista();
      }).catch(function(e){ alert('Error: ' + e.message); });
    } else {
      _acordeonesAbiertos[loteId] = true;
      _renderVista();
    }
  };

  /* ══════════════════════════════════════════════════════════
     ACCIONES — PROSPECTOS
  ══════════════════════════════════════════════════════════ */
  window._segNuevoProspecto = function(datos) {
    var d = datos || {};
    var optsVend = '<option value="">— Sin vendedor asignado —</option>' +
      _vendedores.map(function(v){ return '<option value="' + v.id + '"' + (d.vendedor_id === v.id ? ' selected' : '') + '>' + v.nombre + '</option>'; }).join('');
    var body =
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Nombre completo *</label>' +
      '<input id="segPrNombre" type="text" value="' + _escapeHtml(d.nombre || '') + '" placeholder="Ej: Carlos Ramírez" style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Teléfono</label>' +
      '<input id="segPrTel" type="tel" value="' + (d.telefono || '') + '" placeholder="Ej: 3001234567" style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Estado</label>' +
      '<select id="segPrEstado" style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
      ESTADOS.map(function(e){ return '<option value="' + e.id + '"' + (d.estado === e.id ? ' selected' : '') + '>' + e.label + '</option>'; }).join('') + '</select>' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Vendedor asignado</label>' +
      '<select id="segPrVendedor" style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' + optsVend + '</select>' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Próximo seguimiento</label>' +
      '<input id="segPrFollow" type="date" value="' + (d.next_follow || '') + '" style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Notas</label>' +
      '<textarea id="segPrNotas" rows="3" style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:0;box-sizing:border-box;resize:vertical">' + _escapeHtml(d.notas || '') + '</textarea>';
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
        updated_at  : new Date().toISOString(),
        notificado  : false
      };
      var op = d.id ? sbUpdate('prospectos', d.id, payload) : sbInsert('prospectos', payload);
      op.then(function(res) {
        if (d.id) {
          var idx = _prospectos.findIndex(function(p){ return p.id === d.id; });
          if (idx >= 0) _prospectos[idx] = Object.assign(_prospectos[idx], payload);
        } else {
          if (Array.isArray(res)) _prospectos = res.concat(_prospectos);
        }
        _cerrarModal(); _renderVista(); _actualizarCampanita();
      }).catch(function(e){ alert('Error: ' + e.message); });
    });
  };

  window._segEditarProspecto = function(id) {
    var p = _prospectos.find(function(x){ return x.id === id; });
    if (p) window._segNuevoProspecto(p);
  };

  window._segEliminarProspecto = function(id) {
    var p = _prospectos.find(function(x){ return x.id === id; });
    if (!confirm('¿Eliminar el prospecto "' + (p ? p.nombre : '') + '"? Esta acción no se puede deshacer.')) return;
    sbDelete('prospectos', id).then(function() {
      _prospectos = _prospectos.filter(function(x){ return x.id !== id; });
      _renderVista(); _actualizarCampanita();
    }).catch(function(e){ alert('Error al eliminar: ' + e.message); });
  };

  window._segMoverProspecto = function(id) {
    var p = _prospectos.find(function(x){ return x.id === id; });
    if (!p) return;
    var body = '<div style="font-size:13px;margin-bottom:14px;color:#555">Mover <b>' + _escapeHtml(p.nombre) + '</b> a:</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px">' +
      ESTADOS.map(function(est) {
        var esActual = est.id === p.estado;
        return '<button onclick="window._segCambiarEstado(\'' + id + '\',\'' + est.id + '\')" ' +
          'style="padding:10px 14px;border-radius:8px;border:2px solid ' + (esActual ? est.color : '#ddd') + ';' +
          'background:' + (esActual ? est.bg : '#fff') + ';color:' + (esActual ? est.color : '#555') + ';' +
          'font-weight:' + (esActual ? '800' : '500') + ';font-size:13px;cursor:pointer;text-align:left">' +
          est.label + (esActual ? ' ← actual' : '') + '</button>';
      }).join('') + '</div>';
    var overlay = document.getElementById('segModal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'segModal';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9500;display:flex;align-items:center;justify-content:center';
      overlay.addEventListener('click', function(e){ if (e.target === overlay) _cerrarModal(); });
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = '<div style="background:#fff;border-radius:14px;padding:24px;width:380px;max-width:94vw;box-shadow:0 20px 60px rgba(0,0,0,.3)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<div style="font-size:15px;font-weight:800;color:#1a237e">Cambiar estado</div>' +
      '<button onclick="window._segCerrarModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#888">✕</button>' +
      '</div>' + body + '</div>';
    overlay.style.display = 'flex';
  };

  window._segCambiarEstado = function(id, nuevoEstado) {
    sbUpdate('prospectos', id, { estado: nuevoEstado, updated_at: new Date().toISOString() }).then(function() {
      var idx = _prospectos.findIndex(function(p){ return p.id === id; });
      if (idx >= 0) _prospectos[idx].estado = nuevoEstado;
      _cerrarModal(); _renderVista(); _actualizarCampanita();
    });
  };

  window._segCambiarVendedorAgenda = function(id) {
    _vendedorAgenda = id || null; _diaSeleccionado = null; _renderVista();
  };
  window._segCambiarVendedor = function(id) { _vendedorActivo = id || null; _renderVista(); };

  window._segGestionarVendedores = function() {
    var lista = _vendedores.map(function(v) {
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:8px;background:#f5f5f5;margin-bottom:6px">' +
        '<span style="font-size:13px;font-weight:600">👤 ' + _escapeHtml(v.nombre) + '</span>' +
        '<button onclick="window._segEliminarVendedor(\'' + v.id + '\')" style="background:none;border:none;cursor:pointer;color:#c62828;font-size:13px">🗑</button>' +
        '</div>';
    }).join('') || '<div style="font-size:12px;color:#999;text-align:center;padding:10px">Sin vendedores registrados</div>';
    var body = '<div style="margin-bottom:14px">' + lista + '</div>' +
      '<div style="border-top:1px solid #eee;padding-top:12px">' +
      '<div style="font-size:12px;font-weight:700;color:#444;margin-bottom:8px">Registrar nuevo vendedor</div>' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Nombre completo</label>' +
      '<input id="segVendNombre" type="text" placeholder="Ej: Carlos Ramírez" style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
      '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Teléfono (opcional)</label>' +
      '<input id="segVendTel" type="tel" placeholder="Ej: 3001234567" style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
      '<button id="segBtnAddVend" class="btn bg bsm" style="width:100%">+ Agregar vendedor</button>' +
      '</div>';
    _abrirModal('⚙️ Gestión de vendedores', body, function(){ _cerrarModal(); });
    setTimeout(function() {
      var btn = document.getElementById('segBtnAddVend');
      if (!btn) return;
      btn.onclick = function() {
        var nombre = (document.getElementById('segVendNombre').value || '').trim();
        var tel    = (document.getElementById('segVendTel').value || '').trim();
        if (!nombre) { alert('El nombre es obligatorio.'); return; }
        sbInsert('vendedores', { nombre: nombre, telefono: tel }).then(function(res) {
          if (Array.isArray(res)) _vendedores = _vendedores.concat(res);
          window._segGestionarVendedores(); _renderVista();
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
      window._segGestionarVendedores(); _renderVista();
    });
  };

  window._segCompletarEvento = function(id) {
    sbUpdate('eventos', id, { completado: true }).then(function() {
      var idx = _eventos.findIndex(function(e) { return e.id === id; });
      if (idx >= 0) _eventos[idx].completado = true;
      if (_resultadosBusq !== null) {
        var idxB = _resultadosBusq.findIndex(function(e){ return e.id === id; });
        if (idxB >= 0) _resultadosBusq[idxB].completado = true;
      }
      _renderVista(); _actualizarCampanita();
    }).catch(function(e) { alert('Error: ' + e.message); });
  };

  window._segRevertirEvento = function(id) {
    sbUpdate('eventos', id, { completado: false }).then(function() {
      var idx = _eventos.findIndex(function(e) { return e.id === id; });
      if (idx >= 0) _eventos[idx].completado = false;
      if (_resultadosBusq !== null) {
        var idxB = _resultadosBusq.findIndex(function(e){ return e.id === id; });
        if (idxB >= 0) _resultadosBusq[idxB].completado = false;
      }
      _renderVista(); _actualizarCampanita();
    }).catch(function(e) { alert('Error: ' + e.message); });
  };

  window._segEliminarEvento = function(id) {
    var ev = _eventos.find(function(e) { return e.id === id; });
    if (!confirm('\u00BFEliminar el evento "' + (ev ? ev.titulo : '') + '"? Esta acci\u00F3n no se puede deshacer.')) return;
    sbDelete('eventos', id).then(function() {
      _eventos = _eventos.filter(function(e) { return e.id !== id; });
      if (_resultadosBusq !== null) {
        _resultadosBusq = _resultadosBusq.filter(function(e){ return e.id !== id; });
      }
      _renderVista(); _actualizarCampanita();
    }).catch(function(e) { alert('Error al eliminar: ' + e.message); });
  };

  /* ══════════════════════════════════════════════════════════
     NOTIFICACIONES DEL NAVEGADOR
  ══════════════════════════════════════════════════════════ */
  function _pedirPermisoNotificacion(){
    if('Notification' in window && Notification.permission==='default') Notification.requestPermission();
  }

  var _tgNotificado = {};

  function _chequearNotificaciones() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    var ahora  = new Date();
    var hoyIso = hoy();

    _eventos.forEach(function(e) {
      if (e.completado || !e.fecha || !e.fecha.includes('T')) return;
      var fechaEv = new Date(e.fecha);
      var diffMin = Math.round((fechaEv - ahora) / 60000);
      var tipoLabel = e.tipo ? e.tipo.charAt(0).toUpperCase() + e.tipo.slice(1) : 'Evento';
      var reminder  = e.reminder_min || 60;
      var keyMin    = 'nav-ev-min-' + e.id;
      if (Math.abs(diffMin - reminder) <= 2 && !_tgNotificado[keyMin]) {
        _tgNotificado[keyMin] = true;
        var cuandoStr = reminder >= 1440 ? 'en 1 día' : reminder >= 60 ? 'en ' + Math.round(reminder / 60) + 'h' : 'en ' + reminder + 'min';
        new Notification('⏰ Araguatos — ' + cuandoStr + ': ' + e.titulo, { body: tipoLabel + (fmtHora(e.fecha) ? ' a las ' + fmtHora(e.fecha) : ''), icon: 'logo.png' });
      }
      var keyAhora = 'nav-ev-ahora-' + e.id;
      if (diffMin >= -2 && diffMin <= 2 && !_tgNotificado[keyAhora]) {
        _tgNotificado[keyAhora] = true;
        new Notification('🔔 ¡Ahora! ' + e.titulo, { body: (e.descripcion || tipoLabel), icon: 'logo.png' });
        sbUpdate('eventos', e.id, { notificado: true });
        e.notificado = true;
      }
    });

    _pagos.forEach(function(p) {
      if (p.pagado || p.notificado) return;
      var dVence = diffDias(p.fecha_vence);
      var ahoraH = ahora.getHours(), ahoraM = ahora.getMinutes();
      if (ahoraH !== 8 || ahoraM !== 0) return;
      if (dVence === 0 || dVence === 1) {
        p.notificado = true;
        var lote = window.S && window.S.lots ? window.S.lots.find(function(l){ return l.id === p.lot_id; }) : null;
        var comprador = lote && lote.buyer ? lote.buyer : 'Lote ' + p.lot_id;
        var cuando = dVence === 0 ? 'HOY' : 'MAÑANA';
        var titulo = '💳 Araguatos — Cuota vence ' + cuando;
        var cuerpo = comprador + ' · Cuota #' + p.num_cuota + ' · ' + fmtMonto(p.monto);
        sbUpdate('pagos', p.id, { notificado: true }).then(function() {
          new Notification(titulo, { body: cuerpo, icon: 'logo.png' });
          tgEnviar(titulo + '\n' + cuerpo + '\nVence: ' + fmtFecha(p.fecha_vence));
        });
      }
      if (dVence < 0) {
        p.notificado = true;
        var lote2 = window.S && window.S.lots ? window.S.lots.find(function(l){ return l.id === p.lot_id; }) : null;
        var comprador2 = lote2 && lote2.buyer ? lote2.buyer : 'Lote ' + p.lot_id;
        var titulo2 = '🔴 Araguatos — Cuota en MORA';
        var cuerpo2 = comprador2 + ' · Cuota #' + p.num_cuota + ' · Vencida hace ' + Math.abs(dVence) + ' día(s) · ' + fmtMonto(p.monto);
        sbUpdate('pagos', p.id, { notificado: true }).then(function() {
          new Notification(titulo2, { body: cuerpo2, icon: 'logo.png' });
          tgEnviar(titulo2 + '\n' + cuerpo2);
        });
      }
    });

    _prospectos.forEach(function(p) {
      if (p.estado === 'cerrado' || p.estado === 'perdido' || !p.next_follow || p.notificado) return;
      var dSeg = diffDias(p.next_follow);
      var ahoraH = ahora.getHours(), ahoraM = ahora.getMinutes();
      if (ahoraH !== 8 || ahoraM !== 0) return;
      if (dSeg === 1 || dSeg === 0) {
        p.notificado = true;
        var vend = _vendedores.find(function(v){ return v.id === p.vendedor_id; });
        var vendNombre = vend ? ' (' + vend.nombre + ')' : '';
        var cuando = dSeg === 0 ? 'HOY' : 'MAÑANA';
        var titulo = '👥 Araguatos — Seguimiento ' + cuando + ': ' + p.nombre;
        var cuerpo = (p.telefono ? '📞 ' + p.telefono : '') + vendNombre + (p.notas ? '\n' + p.notas : '');
        sbUpdate('prospectos', p.id, { notificado: true }).then(function() {
          new Notification(titulo, { body: cuerpo || p.nombre, icon: 'logo.png' });
          tgEnviar(titulo + (cuerpo ? '\n' + cuerpo : ''));
        });
      }
    });
  }

  setInterval(function(){ _chequearNotificaciones(); _actualizarCampanita(); }, 60000);

  /* ── Helper KPI ───────────────────────────────────────────── */
  function _kpiBox(label,valor,bg,color){
    return '<div style="background:'+bg+';border-radius:10px;padding:14px;text-align:center">' +
      '<div style="font-size:18px;font-weight:900;color:'+color+'">'+valor+'</div>' +
      '<div style="font-size:11px;color:'+color+';margin-top:3px;opacity:.8">'+label+'</div>' +
      '</div>';
  }

  /* ══════════════════════════════════════════════════════════
     ENTRADA PÚBLICA
  ══════════════════════════════════════════════════════════ */
  window.initSeguimiento = function(){
    _renderPanel();
    cargarTodo();
    _chequearNotificaciones();
  };

})();
