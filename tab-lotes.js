/* ═══════════════════════════════════════════════════
   tab-lotes.js  — Pestaña Lotes
═══════════════════════════════════════════════════ */

function lHTML(l) {
  var dots = { available: '#2196F3', sold: '#4CAF50', apartado: '#FF9800', internal: '#78909C' };
  var cls  = 'lc ' + l.type + (l.type === 'internal' ? ' internal' : ' ' + l.status);
  var pvs  = l.pv ? '<span style="position:absolute;bottom:4px;right:5px;color:var(--gold);font-size:9px">PV</span>' : '';
  var intB = l.type === 'internal'
    ? '<span style="position:absolute;top:3px;right:5px;font-size:8px;background:#546E7A;color:#fff;padding:1px 4px;border-radius:3px">INT</span>' : '';
  return '<div class="' + cls + '" onclick="oLot(\'' + l.id + '\')">'
    + '<div class="ldot" style="background:' + (dots[l.type === 'internal' ? 'internal' : l.status] || '#90A4AE') + '"></div>'
    + '<div class="lid">' + l.id + '</div>'
    + '<div class="lpr">' + (l.type === 'internal' ? 'Uso interno' : fCOP(lp(l))) + '</div>'
    + '<div class="lar">' + l.area + 'm²</div>'
    + (l.buyer ? '<div class="lbuy">' + l.buyer + '</div>' : '')
    + pvs + intB + '</div>';
}

function rLotes() {
  var mz   = ['A', 'B', 'C', 'D'];
  var html = '';
  mz.forEach(function(m) {
    var lots = S.lots.filter(function(l) { return l.m === m; })
                     .sort(function(a, b) { return a.n - b.n; });
    var isD  = (m === 'D');
    html += '<div class="mz">'
      + '<div class="mzl"><span>Manzana ' + m + '</span>'
      + '<span style="font-size:11px;color:var(--muted)">' + lots.length + ' lotes</span></div>'
      + '<div class="' + (isD ? 'lotg3' : 'lotg') + '">';
    if (isD) {
      lots.forEach(function(l) { html += lHTML(l); });
    } else {
      var mid   = Math.ceil(lots.length / 2);
      var left  = lots.slice(0, mid), right = lots.slice(mid);
      var maxI  = Math.max(left.length, right.length);
      for (var ii = 0; ii < maxI; ii++) {
        html += (left[ii]  ? lHTML(left[ii])  : '<div></div>');
        html += (right[ii] ? lHTML(right[ii]) : '<div></div>');
      }
    }
    html += '</div></div>';
  });
  G('lotGrid').innerHTML = html;

  var sale   = S.lots.filter(function(l) { return l.type !== 'internal'; });
  var intL   = S.lots.filter(function(l) { return l.type === 'internal'; });
  var sold   = sale.filter(function(l) { return l.status === 'sold'; });
  var apt    = sale.filter(function(l) { return l.status === 'apartado'; });
  var av     = sale.filter(function(l) { return l.status === 'available'; });
  var sRev   = 0; sold.forEach(function(l) { sRev += lp(l); });
  var aptR   = 0; apt.forEach(function(l)  { aptR += lp(l); });

  G('lotSt').textContent = av.length + ' disponibles · ' + apt.length + ' apartados · '
    + sold.length + ' vendidos · ' + intL.length + ' uso interno';

  G('stAvail').innerHTML = '<div style="font-size:28px;font-weight:900;color:#1565C0">' + av.length + '</div>'
    + '<div style="font-size:11px;color:var(--muted);margin-top:4px">'
    + av.filter(function(l) { return l.type === 'premium';  }).length + ' prem · '
    + av.filter(function(l) { return l.type === 'plus';     }).length + ' plus · '
    + av.filter(function(l) { return l.type === 'standard'; }).length + ' std</div>';
  G('stApt').innerHTML  = '<div style="font-size:28px;font-weight:900;color:#E65100">' + apt.length + '</div>'
    + '<div style="font-size:11px;color:var(--muted);margin-top:4px">' + fCOP(aptR) + ' en proceso</div>';
  G('stSold').innerHTML = '<div style="font-size:28px;font-weight:900;color:#1B5E20">' + sold.length + '</div>'
    + '<div style="font-size:11px;color:var(--muted);margin-top:4px">' + fCOP(sRev) + ' recaudado</div>';
}

/* ── Modal editar lote ─────────────────────────── */
var eLotId = null;

function oLot(id) {
  var l = S.lots.find(function(x) { return x.id === id; });
  if (!l) return;
  eLotId = id;
  G('lmT').textContent = 'Editar — Lote ' + id + (l.type === 'internal' ? ' (Uso Interno)' : '');

  var tOpts = ['premium', 'plus', 'standard', 'internal'].map(function(v) {
    return '<option value="' + v + '"' + (l.type === v ? ' selected' : '') + '>' + v + '</option>';
  }).join('');

  var sOpts = (l.type === 'internal'
    ? ['available']
    : ['available', 'apartado', 'sold']
  ).map(function(v) {
    return '<option value="' + v + '"' + (l.status === v ? ' selected' : '') + '>' + v + '</option>';
  }).join('');

  var intNote = l.type === 'internal'
    ? '<div class="al al-i" style="margin-bottom:10px;font-size:11px">🔒 Lote de uso interno. Registra el propietario/responsable en los campos de abajo. Sin precio de venta.</div>' : '';

  G('lmB').innerHTML = intNote
    + '<label class="fl">Tipo</label><select id="m_t">' + tOpts + '</select>'
    + '<label class="fl">Area (m²)</label><input type="number" id="m_a" value="' + l.area + '" min="50" max="350">'
    + (l.type !== 'internal' ? '<label class="fl">Precio fijo M COP (0 = automático)</label><input type="number" id="m_p" value="' + (l.fp || 0) + '" min="0" max="500" step="0.5">' : '<input type="hidden" id="m_p" value="0">')
    + (l.type !== 'internal' ? '<label class="fl">Estado</label><select id="m_s">' + sOpts + '</select>' : '<input type="hidden" id="m_s" value="available">')
    + '<label class="fl">' + (l.type === 'internal' ? 'Propietario / Responsable' : 'Comprador') + '</label><input type="text" id="m_b" value="' + (l.buyer || '') + '">'
    + '<label class="fl">Cédula / NIT</label><input type="text" id="m_cc" value="' + (l.cc || '') + '">'
    + '<label class="fl">Teléfono</label><input type="tel" id="m_ph" value="' + (l.phone || '') + '">'
    + '<label class="fl">Correo</label><input type="email" id="m_em" value="' + (l.email || '') + '">'
    + '<label class="fl">Dirección</label><input type="text" id="m_ad" value="' + (l.addr || '') + '">'
    + '<label class="fl">Observaciones</label><input type="text" id="m_ob" value="' + (l.obs || '') + '">';
  G('lotMod').style.display = 'flex';
}

function savLot() {
  var l = S.lots.find(function(x) { return x.id === eLotId; });
  if (!l) return;
  l.type   = G('m_t').value;
  l.area   = parseInt(G('m_a').value) || 98;
  var fp2  = parseFloat(G('m_p').value); l.fp = fp2 > 0 ? fp2 : null;
  l.status = G('m_s').value;
  l.buyer  = G('m_b').value;
  l.cc     = G('m_cc').value;
  l.phone  = G('m_ph').value;
  l.email  = G('m_em').value;
  l.addr   = G('m_ad').value;
  l.obs    = G('m_ob') ? G('m_ob').value : l.obs;
  syncLot(l); saveS(); cLotM(); rAll();
}

function cLotM(e) {
  if (e && e.target !== G('lotMod')) return;
  G('lotMod').style.display = 'none';
  eLotId = null;
}
