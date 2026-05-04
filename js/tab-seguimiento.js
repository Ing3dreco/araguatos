/* ═══════════════════════════════════════════════════════════════
   tab-seguimiento.js  —  Araguatos · ING3DRECO SAS  v3
   Cambios v3:
     EVENTOS : Completar, Revertir completado, Editar, Eliminar
               Recordatorio configurable por evento (1h–24h antes)
     CAMPANITA: Badge 🔔 en pestaña Seguimiento con novedades
                separadas por Agenda / Pagos / Prospectos
     PROSPECTOS: Botón eliminar en cada card
     TELEGRAM : Notificaciones en tiempo real al grupo del equipo
   ═══════════════════════════════════════════════════════════════ */
(function () { 
var TG_CHAT_ID = '-5030514648';

function tgEnviar(mensaje) {
  var url = sbUrl();
  if (!url) return;
 
  // URL de la Edge Function — misma base que Supabase
  var fnUrl = url.replace('/rest/v1', '') + '/functions/v1/send-telegram';
  // Resultado: https://TU_REF.supabase.co/functions/v1/send-telegram
 
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
  var _vendedorActivo = null;
  var _vistaActiva    = 'agenda';
  var _mesActual      = new Date();
  var _diaSeleccionado = null;
  var _realtimeSubs   = [];
  var _notifVistas    = {};   // id → true, para no repetir novedades en campanita

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

  /* ── Carga de datos ───────────────────────────────────────── */
  function cargarTodo() {
    var url = sbUrl();
    if (!url) { _renderVista(); return; }
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
      _renderVista();
      _actualizarCampanita();
      _iniciarRealtime();
    }).catch(function(e) {
      console.error('[Seguimiento] Error:', e);
      _renderVista();
    });
  }

  /* ── Realtime ─────────────────────────────────────────────── */
  function _iniciarRealtime() {
    if (typeof window.supabase === 'undefined') return;
    _realtimeSubs.forEach(function(s){ try{ s.unsubscribe(); }catch(e){} });
    _realtimeSubs = [];
    ['pagos','prospectos','eventos','vendedores'].forEach(function(tabla) {
      var sub = window.supabase.channel('seg-' + tabla)
        .on('postgres_changes', { event: '*', schema: 'public', table: tabla }, function() {
          cargarTodo();
        }).subscribe();
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
        lot_id: lote.id, num_cuota: i,
        fecha_vence: isoFecha(f), monto: cuotaMes,
        pagado: false, nota: ''
      });
    }
    return cuotas;
  }
  function sincronizarCuotas(lote) {
    var existentes = _pagos.filter(function(p){ return p.lot_id === lote.id; });
    if (existentes.length > 0) return Promise.resolve();
    var cuotas = generarCuotasDeLote(lote);
    if (!cuotas.length) return Promise.resolve();
    return sbInsert('pagos', cuotas).then(function(nuevas) {
      _pagos = _pagos.concat(nuevas || []);
    }).catch(function(e){ console.error('[Seguimiento] Error cuotas', lote.id, e); });
  }

  /* ── Semáforo ─────────────────────────────────────────────── */
  function semaforo(pago) {
    if (pago.pagado) return { color:'#2e7d32', bg:'#e8f5e9', icono:'✅', label:'Pagado' };
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

    // AGENDA: eventos vencidos o próximos 2 días no completados
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

    // PAGOS: cuotas vencidas o que vencen en ≤3 días
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

    // PROSPECTOS: seguimientos atrasados o para hoy/mañana
    _prospectos.forEach(function(p) {
      if (p.estado==='cerrado'||p.estado==='perdido'||!p.next_follow) return;
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
    // Cerrar al hacer clic fuera
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
    var hoyIso     = hoy();
    var evHoy      = _eventos.filter(function(e){ return isoFecha(e.fecha)===hoyIso && !e.completado; });
    var evProx     = _eventos.filter(function(e){ var d=diffDias(isoFecha(e.fecha)); return d>=0&&d<=7&&!e.completado; });
    var evVencidos = _eventos.filter(function(e){ return diffDias(isoFecha(e.fecha))<0&&!e.completado; });

    var panelLateral = _diaSeleccionado ? _panelDia(_diaSeleccionado) : _panelProximos();

    c.innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">' +
      _kpiBox('🔴 Vencidos', evVencidos.length, '#ffebee','#c62828') +
      _kpiBox('🟡 Hoy',      evHoy.length,      '#fff3e0','#e65100') +
      _kpiBox('🔵 Próx. 7d', evProx.length,     '#e3f2fd','#1565c0') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 340px;gap:14px;align-items:start">' +
      '<div class="card" style="padding:16px">'+_buildCalendario()+'</div>' +
      '<div>'+panelLateral+'</div>' +
      '</div>';

    var prev = document.getElementById('calPrev');
    var next = document.getElementById('calNext');
    if (prev) prev.onclick = function() { _mesActual=new Date(_mesActual.getFullYear(),_mesActual.getMonth()-1,1); _renderVista(); };
    if (next) next.onclick = function() { _mesActual=new Date(_mesActual.getFullYear(),_mesActual.getMonth()+1,1); _renderVista(); };

    c.querySelectorAll('[data-caldia]').forEach(function(cel) {
      cel.addEventListener('click', function() { _diaSeleccionado=this.dataset.caldia; _renderVista(); });
    });
    _pedirPermisoNotificacion();
  }

  function _panelDia(isoD) {
    var evsDia = _eventos.filter(function(e){ return isoFecha(e.fecha)===isoD; })
      .sort(function(a,b){ return (a.fecha||'')>(b.fecha||'')?1:-1; });
    var label = isoD===hoy()?'Hoy':fmtFecha(isoD);
    return '<div class="card" style="padding:14px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
      '<div style="font-size:13px;font-weight:800;color:#1a237e">📅 '+label+'</div>' +
      '<div style="display:flex;gap:6px">' +
      '<button class="btn bg bsm" onclick="window._segNuevoEvento(\''+isoD+'\')">+ Evento</button>' +
      '<button onclick="window._segCerrarDia()" style="background:none;border:none;cursor:pointer;font-size:18px;color:#888;line-height:1">✕</button>' +
      '</div></div>' +
      (evsDia.length===0
        ? '<div style="font-size:12px;color:#999;text-align:center;padding:20px 0">Sin eventos para este día</div>'
        : evsDia.map(_cardEvento).join('')
      )+'</div>';
  }

  function _panelProximos() {
    var proximos = _eventos.filter(function(e){
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

  /* ── Calendario ───────────────────────────────────────────── */
  function _buildCalendario() {
    var anio=_mesActual.getFullYear(), mes=_mesActual.getMonth(), hoyIso=hoy();
    var primerDia=new Date(anio,mes,1).getDay(), diasMes=new Date(anio,mes+1,0).getDate();
    var evMes={};
    _eventos.forEach(function(e){
      var eIso=isoFecha(e.fecha);
      if(eIso.slice(0,7)===anio+'-'+_pad(mes+1)){
        var d=parseInt(eIso.slice(8,10));
        if(!evMes[d]) evMes[d]=[];
        evMes[d].push(e);
      }
    });
    _pagos.filter(function(p){ return !p.pagado&&p.fecha_vence&&p.fecha_vence.slice(0,7)===(anio+'-'+_pad(mes+1)); })
      .forEach(function(p){
        var d=parseInt(p.fecha_vence.slice(8,10));
        if(!evMes[d]) evMes[d]=[];
        evMes[d].push({tipo:'pago',titulo:'Cuota '+p.lot_id,fecha:p.fecha_vence});
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
      html+='<div data-caldia="'+iso+'" style="text-align:center;padding:6px 2px;border-radius:8px;font-size:12px;cursor:pointer;background:'+bg+';color:'+color+';font-weight:'+(esHoy||esSel?'800':'400')+';border:2px solid '+(esSel?'#0d47a1':'transparent')+';position:relative;transition:.1s" title="'+(tieneEv?evs.length+' evento(s)':'Sin eventos')+'">'+d+
        (tieneEv?'<div style="width:5px;height:5px;border-radius:50%;background:'+((esHoy||esSel)?'#fff':puntoColor)+';margin:2px auto 0"></div>':'<div style="height:7px"></div>')+
        '</div>';
    }
    html+='</div>';
    if(_diaSeleccionado) html+='<div style="margin-top:8px;font-size:11px;color:#888;text-align:center">Clic en otro día para ver sus eventos · <a href="#" onclick="window._segCerrarDia();return false" style="color:#1565c0">Ver próximos</a></div>';
    return html;
  }

  /* ── Card de evento — v3: Completar, Revertir, Editar, Eliminar ── */
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
    // Recordatorio: si tiene reminder_min, mostrarlo
    var recLabel = e.reminder_min
      ? ' · ⏰ '+(e.reminder_min>=60?(e.reminder_min/60)+'h':''+e.reminder_min+'min')+' antes'
      : '';

    return '<div style="display:flex;gap:10px;align-items:flex-start;padding:9px;border-radius:9px;margin-bottom:7px;'+
      'background:'+(e.completado?'#f5f5f5':t.bg)+';opacity:'+(e.completado?.6:1)+';border-left:3px solid '+(e.completado?'#bbb':t.color)+'">' +
      '<div style="font-size:18px;line-height:1">'+(e.completado?'✅':t.icono)+'</div>' +
      '<div style="flex:1;min-width:0">' +
      '<div style="font-size:12px;font-weight:700;color:'+(e.completado?'#888':t.color)+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(e.completado?'<s>':'')+e.titulo+(e.completado?'</s>':'')+'</div>' +
      '<div style="font-size:11px;color:#666;margin-top:2px">'+fmtFecha(isoFecha(e.fecha))+(hora?' · '+hora:'')+' · '+dLabel+recLabel+'</div>' +
      (e.vendedor_id ? (function(){ var v=_vendedores.find(function(x){return x.id===e.vendedor_id;}); return v?'<div style="display:inline-block;font-size:10px;padding:2px 7px;border-radius:10px;background:#e8eaf6;color:#3949ab;font-weight:700;margin-top:3px">👤 '+v.nombre+'</div>':''; })() : '') +
      (e.descripcion?'<div style="font-size:11px;color:#888;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+e.descripcion+'</div>':'') +
      '</div>' +
      '<div style="display:flex;gap:2px;flex-shrink:0;flex-direction:column;align-items:flex-end">' +
      // Editar
      '<button onclick="window._segEditarEvento(\''+e.id+'\')" title="Editar" style="background:none;border:none;cursor:pointer;font-size:13px;padding:2px 4px">✏️</button>' +
      // Completar / Revertir
      (!e.completado
        ? '<button onclick="window._segCompletarEvento(\''+e.id+'\')" title="Marcar como completado" style="background:none;border:none;cursor:pointer;font-size:13px;padding:2px 4px">✅</button>'
        : '<button onclick="window._segRevertirEvento(\''+e.id+'\')" title="Marcar como pendiente" style="background:none;border:none;cursor:pointer;font-size:13px;padding:2px 4px">↩️</button>'
      ) +
      // Eliminar
      '<button onclick="window._segEliminarEvento(\''+e.id+'\')" title="Eliminar evento" style="background:none;border:none;cursor:pointer;font-size:13px;padding:2px 4px">🗑️</button>' +
      '</div></div>';
  }

  /* ══════════════════════════════════════════════════════════
     VISTA 2 — PAGOS
  ══════════════════════════════════════════════════════════ */
  function _renderPagos(c) {
    var lotesVendidos=(window.S&&window.S.lots
      ?window.S.lots.filter(function(l){ return (l.status==='sold'||l.status==='apartado')&&l.payType!=='cash'; })
      :[]);
    var totalRecaudado=_pagos.filter(function(p){return p.pagado;}).reduce(function(s,p){return s+Number(p.monto);},0);
    var totalPendiente=_pagos.filter(function(p){return !p.pagado;}).reduce(function(s,p){return s+Number(p.monto);},0);
    var enMora=_pagos.filter(function(p){return !p.pagado&&diffDias(p.fecha_vence)<0;}).length;
    c.innerHTML=
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">' +
      _kpiBox('✅ Recaudado',fmtMonto(totalRecaudado),'#e8f5e9','#2e7d32') +
      _kpiBox('⏳ Pendiente',fmtMonto(totalPendiente),'#e3f2fd','#1565c0') +
      _kpiBox('🔴 En mora',enMora+' cuotas','#ffebee','#c62828') +
      '</div>' +
      (lotesVendidos.length===0
        ?'<div class="al al-i">No hay ventas financiadas registradas.</div>'
        :lotesVendidos.map(function(l){return _seccionLote(l);}).join('')
      );
    lotesVendidos.forEach(function(l){sincronizarCuotas(l);});
  }

  function _seccionLote(lote) {
    var cuotas=_pagos.filter(function(p){return p.lot_id===lote.id;}).sort(function(a,b){return a.num_cuota-b.num_cuota;});
    var pagadas=cuotas.filter(function(p){return p.pagado;}).length;
    var totalC=cuotas.length||lote.mo||0;
    var pct=totalC>0?Math.round(pagadas/totalC*100):0;
    return '<div class="card" style="margin-bottom:12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">' +
      '<div><div style="font-size:14px;font-weight:800;color:#1a237e">Lote '+lote.id+' — '+(lote.buyer||'—')+'</div>' +
      '<div style="font-size:11px;color:#666;margin-top:2px">C.C. '+(lote.cc||'—')+' · '+(lote.phone||'—')+' · '+(lote.mo||'—')+' meses</div></div>' +
      '<div style="text-align:right"><div style="font-size:13px;font-weight:700;color:#2e7d32">'+pagadas+'/'+totalC+' cuotas</div>' +
      '<div style="font-size:11px;color:#888">'+pct+'% pagado</div></div></div>' +
      '<div style="height:6px;background:#e0e0e0;border-radius:3px;margin-bottom:12px">' +
      '<div style="height:6px;background:linear-gradient(90deg,#2e7d32,#66bb6a);border-radius:3px;width:'+pct+'%"></div></div>' +
      (cuotas.length===0
        ?'<div style="font-size:12px;color:#999;text-align:center;padding:10px">Generando cuotas…</div>'
        :'<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead>' +
        '<tr style="background:#f5f5f5">' +
        '<th style="padding:7px 10px;text-align:left">#</th>' +
        '<th style="padding:7px 10px;text-align:left">Vence</th>' +
        '<th style="padding:7px 10px;text-align:right">Monto</th>' +
        '<th style="padding:7px 10px;text-align:center">Estado</th>' +
        '<th style="padding:7px 10px;text-align:left">Pagado el</th>' +
        '<th style="padding:7px 10px;text-align:left">Nota</th>' +
        '<th style="padding:7px 10px;text-align:center">Acción</th>' +
        '</tr></thead><tbody>' +
        cuotas.map(function(p){
          var s=semaforo(p);
          return '<tr style="border-top:1px solid #f0f0f0">' +
            '<td style="padding:7px 10px;font-weight:700;color:#1a237e">'+p.num_cuota+'</td>' +
            '<td style="padding:7px 10px">'+fmtFecha(p.fecha_vence)+'</td>' +
            '<td style="padding:7px 10px;text-align:right;font-weight:600">'+fmtMonto(p.monto)+'</td>' +
            '<td style="padding:7px 10px;text-align:center"><span style="background:'+s.bg+';color:'+s.color+';padding:3px 8px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap">'+s.icono+' '+s.label+'</span></td>' +
            '<td style="padding:7px 10px;color:#888">'+(p.fecha_pago?fmtFecha(p.fecha_pago):'—')+'</td>' +
            '<td style="padding:7px 10px;color:#888;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(p.nota||'—')+'</td>' +
            '<td style="padding:7px 10px;text-align:center;white-space:nowrap">' +
            '<button class="btn bout bsm" onclick="window._segEditarCuota(\''+p.id+'\')" style="font-size:11px;padding:4px 8px;margin-right:4px">✏️</button>' +
            (!p.pagado
              ?'<button class="btn bg bsm" onclick="window._segRegistrarPago(\''+p.id+'\')" style="font-size:11px;padding:4px 10px">✓ Pagar</button>'
              :'<button class="btn bout bsm" onclick="window._segDesmarcarPago(\''+p.id+'\')" style="font-size:11px;padding:4px 10px;color:#888">↩</button>'
            )+'</td></tr>';
        }).join('')+
        '</tbody></table></div>'
      )+'</div>';
  }

  /* ══════════════════════════════════════════════════════════
     VISTA 3 — PROSPECTOS
  ══════════════════════════════════════════════════════════ */
  var ESTADOS=[
    {id:'interesado',  label:'🙋 Interesado',  color:'#1565c0',bg:'#e3f2fd'},
    {id:'presentacion',label:'📋 Presentación', color:'#6a1b9a',bg:'#f3e5f5'},
    {id:'negociacion', label:'🤝 Negociación',  color:'#e65100',bg:'#fff3e0'},
    {id:'cerrado',     label:'✅ Cerrado',       color:'#2e7d32',bg:'#e8f5e9'},
    {id:'perdido',     label:'❌ Perdido',        color:'#757575',bg:'#f5f5f5'},
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
      '<div style="font-size:12px;font-weight:700;color:#1a237e;margin-bottom:4px">'+p.nombre+'</div>' +
      (p.telefono?'<div style="font-size:11px;color:#666">📞 '+p.telefono+'</div>':'') +
      (vendNombre?'<div style="display:inline-block;font-size:10px;padding:2px 7px;border-radius:10px;background:#e8eaf6;color:#3949ab;font-weight:700;margin-top:4px">👤 '+vendNombre+'</div>':'') +
      (p.next_follow?'<div style="font-size:10px;margin-top:4px;color:'+(alertaSeg?'#c62828':'#888')+'">'+(alertaSeg?'🔔 ':'📅 ')+'Seguimiento: '+fmtFecha(p.next_follow)+'</div>':'') +
      (p.notas?'<div style="font-size:10px;color:#999;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+p.notas+'</div>':'') +
      '<div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap">' +
      '<button onclick="window._segEditarProspecto(\''+p.id+'\')" style="flex:1;font-size:10px;padding:3px 6px;background:'+est.bg+';color:'+est.color+';border:1px solid '+est.color+';border-radius:5px;cursor:pointer">✏️ Editar</button>' +
      '<button onclick="window._segMoverProspecto(\''+p.id+'\')" style="flex:1;font-size:10px;padding:3px 6px;background:#f5f5f5;color:#555;border:1px solid #ddd;border-radius:5px;cursor:pointer">→ Mover</button>' +
      // NUEVO: botón eliminar
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
      '<div style="background:#fff;border-radius:14px;padding:24px;width:460px;max-width:94vw;max-height:88vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)">' +
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

  /* Opciones de recordatorio: 1h, 2h, 4h, 8h, 24h */
  var REMINDER_OPTS = [];

  /* ── Reemplaza la función _abrirModalEvento completa ── */
function _abrirModalEvento(e, fechaPresel) {
  var esEdicion = !!e;
  var tipos = ['reunion', 'llamada', 'presentacion', 'seguimiento', 'pago'];
  var fechaDefecto = fechaPresel ? (fechaPresel + 'T08:00') : ahoraLocal();
  var fechaVal = e ? (e.fecha || fechaDefecto) : fechaDefecto;
  var reminderVal = e ? (e.reminder_min || 60) : 60;
 
  /* Convertir reminder_min guardado → unidad + cantidad para el picker */
  var _pu = 'h', _pv = 1;
  if (reminderVal < 60)        { _pu = 'min'; _pv = reminderVal; }
  else if (reminderVal < 1440) { _pu = 'h';   _pv = Math.round(reminderVal / 60); }
  else                         { _pu = 'd';   _pv = Math.round(reminderVal / 1440); }
 
  /* ── Estilos del picker (inline para no tocar el CSS global) ── */
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
 
  /* ── Accesos rápidos ── */
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
 
    /* Tipo */
    '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Tipo</label>' +
    '<select id="segEvTipo" style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
    tipos.map(function(t) {
      return '<option value="' + t + '"' + (e && e.tipo === t ? ' selected' : '') + '>' +
        t.charAt(0).toUpperCase() + t.slice(1) + '</option>';
    }).join('') +
    '</select>' +
 
    /* Título */
    '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Título *</label>' +
    '<input id="segEvTitulo" type="text" value="' + (e ? (e.titulo || '') : '') + '" placeholder="Ej: Reunión con Juan Pérez"' +
    ' style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
 
    /* Fecha y hora */
    '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Fecha y hora *</label>' +
    '<input id="segEvFecha" type="datetime-local" value="' + fechaVal + '"' +
    ' style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
 
    /* ── Picker de recordatorio ── */
    '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:8px">⏰ Recordatorio — ¿cuánto antes avisar?</label>' +
 
    /* Accesos rápidos */
    '<div class="rp-chips">' +
    chips.map(function(c) {
      return '<button type="button" class="rp-chip" data-min="' + c.min + '">' + c.label + '</button>';
    }).join('') +
    '</div>' +
 
    /* Input libre */
    '<div class="rp-wrap">' +
    '<input id="rpNum" type="number" min="1" max="999" value="' + _pv + '" class="rp-num">' +
    '<div class="rp-units">' +
    '<button type="button" class="rp-u' + (_pu === 'min' ? ' on' : '') + '" data-u="min">min</button>' +
    '<button type="button" class="rp-u' + (_pu === 'h'   ? ' on' : '') + '" data-u="h">horas</button>' +
    '<button type="button" class="rp-u' + (_pu === 'd'   ? ' on' : '') + '" data-u="d">días</button>' +
    '</div></div>' +
    '<div class="rp-preview" id="rpPreview"></div>' +
 
    /* Vendedor */
    '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Vendedor responsable</label>' +
    '<select id="segEvVendedor" style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box">' +
    '<option value="">— Sin asignar —</option>' +
    _vendedores.map(function(v) {
      return '<option value="' + v.id + '"' + (e && e.vendedor_id === v.id ? ' selected' : '') + '>' + v.nombre + '</option>';
    }).join('') +
    '</select>' +
 
    /* Descripción */
    '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Descripción</label>' +
    '<textarea id="segEvDesc" rows="2" style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:12px;box-sizing:border-box;resize:vertical">' +
    (e ? (e.descripcion || '') : '') + '</textarea>' +
 
    /* Relacionado */
    '<label style="display:block;font-size:12px;font-weight:600;color:#444;margin-bottom:4px">Relacionado (lote ID o nombre)</label>' +
    '<input id="segEvRel" type="text" value="' + (e ? (e.relacionado || '') : '') + '" placeholder="Ej: B02 o Juan Pérez"' +
    ' style="width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;margin-bottom:0;box-sizing:border-box">';
 
  _abrirModal((esEdicion ? '✏️ Editar evento' : '📅 Nuevo evento'), body, function () {
 
    /* Leer reminder_min del picker */
    var rpNum = document.getElementById('rpNum');
    var rpUon = document.querySelector('.rp-u.on');
    var rpVal = parseInt((rpNum ? rpNum.value : '') || '1') || 1;
    var rpU   = rpUon ? rpUon.dataset.u : 'h';
    var reminderMin = rpU === 'min' ? rpVal
                    : rpU === 'h'   ? rpVal * 60
                    : rpVal * 1440;
 
    var titulo = (document.getElementById('segEvTitulo').value || '').trim();
    if (!titulo) { alert('El título es obligatorio.'); return; }
 
    var fechaInput = document.getElementById('segEvFecha').value;
    var datos = {
      tipo         : document.getElementById('segEvTipo').value,
      titulo       : titulo,
      fecha        : fechaInput,
      reminder_min : reminderMin,
      vendedor_id  : document.getElementById('segEvVendedor').value || null,
      descripcion  : document.getElementById('segEvDesc').value.trim(),
      relacionado  : document.getElementById('segEvRel').value.trim(),
    };
    if (!esEdicion) { datos.completado = false; datos.notificado = false; }
 
    var op = esEdicion ? sbUpdate('eventos', e.id, datos) : sbInsert('eventos', datos);
    op.then(function (res) {
      if (esEdicion) {
        var idx = _eventos.findIndex(function(x) { return x.id === e.id; });
        if (idx >= 0) _eventos[idx] = Object.assign(_eventos[idx], datos);
      } else {
        if (Array.isArray(res)) _eventos = _eventos.concat(res);
      }
      _cerrarModal(); _renderVista(); _actualizarCampanita();
    }).catch(function (err) { alert('Error: ' + err.message); });
  });
 
  /* ── Lógica del picker (después de insertar en DOM) ── */
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
      if (min < 1440) {
        var h = Math.round(min / 60);
        return h + ' hora' + (h === 1 ? '' : 's') + ' antes';
      }
      var d = Math.round(min / 1440);
      return d + ' día' + (d === 1 ? '' : 's') + ' antes';
    }
 
    function updatePreview() {
      var min = calcMin();
      if (rpPreview) rpPreview.textContent = '→ Recordatorio ' + labelMin(min);
    }
 
    /* Botones de unidad */
    uBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        uBtns.forEach(function(b) { b.classList.remove('on'); });
        this.classList.add('on');
        updatePreview();
      });
    });
 
    /* Input numérico */
    if (rpNum) rpNum.addEventListener('input', updatePreview);
 
    /* Chips de acceso rápido */
    chipBtns.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var min = parseInt(this.dataset.min);
        /* Ajustar unidad automáticamente */
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
     NOTIFICACIONES DEL NAVEGADOR + RECORDATORIOS DE EVENTOS
  ══════════════════════════════════════════════════════════ */
  function _pedirPermisoNotificacion(){
    if('Notification' in window && Notification.permission==='default') Notification.requestPermission();
  }

  /* Tracks what we already notified to avoid duplicates */
  var _tgNotificado = {};  // key → true

  function _nombreVendedorEvento(e) {
    if (!e.vendedor_id) return '';
    var v = _vendedores.find(function(x){ return x.id === e.vendedor_id; });
    return v ? v.nombre.toUpperCase() : '';
  }

 function _chequearNotificaciones() {
  // Solo notificaciones del navegador — Telegram va por el cron
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
 
  var ahora   = new Date();
  var hoyIso  = hoy();
 
  // ── EVENTOS: notificación del navegador cuando empieza ────
  _eventos.forEach(function(e) {
    if (e.completado || !e.fecha || !e.fecha.includes('T')) return;
 
    var fechaEv = new Date(e.fecha);
    var diffMin = Math.round((fechaEv - ahora) / 60000);
    var tipoLabel = e.tipo
      ? e.tipo.charAt(0).toUpperCase() + e.tipo.slice(1)
      : 'Evento';
 
    // Notificación del navegador según el recordatorio configurado
    var reminder = e.reminder_min || 60;
    var keyMin   = 'nav-ev-min-' + e.id;
    if (Math.abs(diffMin - reminder) <= 2 && !_tgNotificado[keyMin]) {
      _tgNotificado[keyMin] = true;
      var cuandoStr = reminder >= 1440 ? 'en 1 día'
        : reminder >= 60 ? 'en ' + Math.round(reminder / 60) + 'h'
        : 'en ' + reminder + 'min';
      new Notification('⏰ Araguatos — ' + cuandoStr + ': ' + e.titulo, {
        body: tipoLabel + (fmtHora(e.fecha) ? ' a las ' + fmtHora(e.fecha) : ''),
        icon: 'logo.png'
      });
    }
 
    // Notificación cuando el evento empieza (±2 min)
    var keyAhora = 'nav-ev-ahora-' + e.id;
    if (diffMin >= -2 && diffMin <= 2 && !_tgNotificado[keyAhora]) {
      _tgNotificado[keyAhora] = true;
      new Notification('🔔 ¡Ahora! ' + e.titulo, {
        body: (e.descripcion || tipoLabel),
        icon: 'logo.png'
      });
      // Marcar como notificado en Supabase para no repetir
      sbUpdate('eventos', e.id, { notificado: true });
      e.notificado = true;
    }
  });
 
  // ── PAGOS: notificación del navegador el día del vencimiento ─
  _pagos.forEach(function(p) {
    if (p.pagado) return;
    var dVence   = diffDias(p.fecha_vence);
    var keyHoy   = 'nav-pago-hoy-' + p.id;
    var ahoraH   = ahora.getHours();
    var ahoraM   = ahora.getMinutes();
 
    // Solo una vez al día, a las 8 AM ±2 min
    if (dVence === 0 && ahoraH === 8 && ahoraM <= 2 && !_tgNotificado[keyHoy]) {
      _tgNotificado[keyHoy] = true;
      var lote = window.S && window.S.lots
        ? window.S.lots.find(function(l) { return l.id === p.lot_id; })
        : null;
      var comprador = lote && lote.buyer ? lote.buyer : 'Lote ' + p.lot_id;
      new Notification('💳 Araguatos — Cuota vence HOY', {
        body: comprador + ' · Cuota #' + p.num_cuota + ' · ' + fmtMonto(p.monto),
        icon: 'logo.png'
      });
    }
  });
}

  // Chequear cada minuto
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
  window.initSeguimiento=function(){
    _renderPanel();
    cargarTodo();
    _chequearNotificaciones();
  };

})();
