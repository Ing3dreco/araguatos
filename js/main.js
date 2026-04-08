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
]; /* ← ajusta con los IDs exactos de tus 10 lotes */

/* Actualiza SOLO el contador del header.
   No toca ningún cálculo de flujo ni ingreso. */
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
  /* Desactivar todos */
  var tabs   = document.querySelectorAll('.tb');
  var panels = document.querySelectorAll('.panel');
  for (var i=0; i<tabs.length;   i++) tabs[i].className   = 'tb';
  for (var j=0; j<panels.length; j++) panels[j].className = 'panel';
  /* Activar el seleccionado */
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
  else if (id==='contratos') rContratos();
  else if (id==='config')    initConfigPanel();
}

/* rAll: guarda, re-renderiza la pestaña activa y actualiza el contador */
function rAll() { saveS(); rTab(activeT); updateVendidosUI(); }

/* ── Arrancar ───────────────────────────────── */
window.addEventListener('DOMContentLoaded', function() {
  /* Fecha en header */
  var hd = document.getElementById('hDate');
  if (hd) hd.textContent = new Date().toLocaleDateString('es-CO', {day:'2-digit', month:'short'});

  /* Auto-conectar Supabase si hay credenciales guardadas */
  var u = localStorage.getItem('araguatos_sb_url');
  var k = localStorage.getItem('araguatos_sb_key');
  if (u && k) {
    SB_URL = u;
    SB_KEY = k;
    /* Intentar pull silencioso desde Supabase */
fetch(u + '/rest/v1/lots?select=*&order=m,n', {
  headers: { 'apikey': k, 'Authorization': 'Bearer '+k }
}).then(function(r){ return r.json(); })
.then(function(data){
  if (!Array.isArray(data) || data.length===0) return;
  /* ── FIX: igual que pullFromSupabase, usar S.lots como base ── */
  data.forEach(function(row){
    var l = S.lots.find(function(x){ return x.id===row.id; });
    if (!l) return;
    l.type=row.type||l.type; l.area=row.area||l.area; l.fp=row.fp||null;
    l.status=row.status||l.status; l.buyer=row.buyer||''; l.cc=row.cc||'';
    l.phone=row.phone||''; l.email=row.email||''; l.addr=row.addr||'';
    l.payType=row.pay_type||'fin'; l.dn=row.dn||20; l.mo=row.mo||36;
    l.dnAmt=row.dn_amt||0; l.cmAmt=row.cm_amt||0; l.pv=row.pv||false;
    l.saleDate=row.sale_date||null; l.salePrice=row.sale_price||null;
    l.saleMonthIdx=row.sale_month_idx||0; l.obs=row.obs||'';
  });
  SB_CONNECTED = true;
  updateConnUI();
  saveS();
  rTab(activeT);
  updateVendidosUI();
}).catch(function(){ /* silencioso */ });
  }

  /* Render inicial */
  setPay('fin');
  rResumen();
  updateVendidosUI();
});
