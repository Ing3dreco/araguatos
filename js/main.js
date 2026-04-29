/* ═══════════════════════════════════════════════════
   main.js  — Navegación e inicialización
═══════════════════════════════════════════════════ */

/* ── Lotes internos de reserva ─────────────────────
   Se SUMAN al contador visual del header (id="hSold")
   SOLO si están marcados como 'sold'.
   NO afectan flujos de caja proyectados ni reales.
   ⚠ Reemplaza los IDs con los 10 lotes reales de
     uso interno de tu proyecto.
─────────────────────────────────────────────────── */
var LOTES_INTERNOS = [
  'A1','A2','A3',
  'B1','B2',
  'C1','C2','C3',
  'D1','D2'
];
 
function updateVendidosUI() {
  var el = document.getElementById('hSold');
  if (!el) return;
  var vendidosReales = S.lots.filter(function(l) {
    return l.status === 'sold' && LOTES_INTERNOS.indexOf(l.id) === -1;
  }).length;
  var internosVendidos = S.lots.filter(function(l) {
    return l.status === 'sold' && LOTES_INTERNOS.indexOf(l.id) !== -1;
  }).length;
  el.textContent = (vendidosReales + internosVendidos) + ' vendidos';
}
 
var activeT = 'resumen';
 
function sw(id, btn) {
  var tabs   = document.querySelectorAll('.tb');
  var panels = document.querySelectorAll('.panel');
  for (var i=0; i<tabs.length;   i++) tabs[i].className   = 'tb';
  for (var j=0; j<panels.length; j++) panels[j].className = 'panel';
  btn.className = 'tb on';
  var p = document.getElementById('tab-'+id);
  if (p) p.className = 'panel on';
  activeT = id;
  rTab(id);
}
 
function rTab(id) {
  if      (id==='resumen')   rResumen();
  else if (id==='lotes')     rLotes();
  else if (id==='precios')   rPrecios();
  else if (id==='flujo')     rFlujo();
  else if (id==='venta')     rVenta();
  else if (id==='vendedor')  rVend();
  else if (id==='ingresos')  rIngresos();
  // ── FIX: llamar initContratos (definida en tab-contratos.js) ──
  else if (id==='contratos') initContratos();
  else if (id==='config')    initConfigPanel();
}
 
function rAll() { saveS(); rTab(activeT); updateVendidosUI(); }
 
/* ── Arrancar ───────────────────────────────── */
window.addEventListener('DOMContentLoaded', function() {
  var hd = document.getElementById('hDate');
  if (hd) hd.textContent = new Date().toLocaleDateString('es-CO', {day:'2-digit', month:'short'});
 
  var u = localStorage.getItem('araguatos_sb_url');
  var k = localStorage.getItem('araguatos_sb_key');
  if (u && k) {
    SB_URL = u;
    SB_KEY = k;
    fetch(u + '/rest/v1/lots?select=*&order=m,n', {
      headers: { 'apikey': k, 'Authorization': 'Bearer '+k }
    }).then(function(r){ return r.json(); })
    .then(function(data){
      if (!Array.isArray(data) || data.length===0) return;
      var base = buildLots();
      S.lots = data.map(function(row) {
        var def = base.find(function(x){ return x.m===row.m && x.n===row.n; }) || {};
        return {
          id:           row.id,
          m:            row.m,
          n:            row.n,
          type:         row.type            || def.type  || 'standard',
          area:         row.area            || def.area  || 98,
          fp:           row.fp              || null,
          status:       row.status          || 'available',
          // ── Comprador ──
          buyer:        row.buyer           || '',
          cc:           row.cc              || '',
          phone:        row.phone           || '',
          email:        row.email           || '',
          addr:         row.addr            || '',
          // ── Campos nuevos del comprador ──
          gender:       row.gender          || '',
          nationality:  row.nationality     || 'colombiana',
          ccCity:       row.cc_city         || '',
          marital:      row.marital         || '',
          city:         row.city            || '',
          // ── Pago ──
          payType:      row.pay_type        || 'fin',
          dn:           row.dn              || 20,
          mo:           row.mo              || 36,
          dnAmt:        row.dn_amt          || 0,
          cmAmt:        row.cm_amt          || 0,
          pv:           row.pv              || false,
          saleDate:     row.sale_date       || null,
          salePrice:    row.sale_price      || null,
          saleMonthIdx: row.sale_month_idx  || 0,
          obs:          row.obs             || ''
        };
      });
      SB_CONNECTED = true;
      updateConnUI();
      saveS();
      rTab(activeT);
      updateVendidosUI();
    }).catch(function(){ /* silencioso */ });
  }
 
  setPay('fin');
  rResumen();
  updateVendidosUI();
 
  setInterval(function() {
    if (typeof SB_CONNECTED !== 'undefined' && SB_CONNECTED &&
        typeof pullFromSupabase === 'function') {
      pullFromSupabase();
    }
  }, 20000);
});
