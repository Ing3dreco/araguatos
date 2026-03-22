/* ═══════════════════════════════════════════════════
   main.js  — Navegacion, inicializacion, rAll()
═══════════════════════════════════════════════════ */

var activeT = 'resumen';

function sw(id, btn) {
  var tabs   = document.querySelectorAll('.tb');
  var panels = document.querySelectorAll('.panel');
  for (var i = 0; i < tabs.length;   i++) tabs[i].className   = 'tb';
  for (var j = 0; j < panels.length; j++) panels[j].className = 'panel';
  btn.className = 'tb on';
  document.getElementById('tab-' + id).className = 'panel on';
  activeT = id;
  rTab(id);
}
/* ═══════════════════════════════════════════════════
   main.js  — Navegacion, inicializacion, rAll()
═══════════════════════════════════════════════════ */

var activeT = 'resumen';

function sw(id, btn) {
  var tabs   = document.querySelectorAll('.tb');
  var panels = document.querySelectorAll('.panel');
  for (var i = 0; i < tabs.length;   i++) tabs[i].className   = 'tb';
  for (var j = 0; j < panels.length; j++) panels[j].className = 'panel';
  btn.className = 'tb on';
  document.getElementById('tab-' + id).className = 'panel on';
  activeT = id;
  rTab(id);
}

function rTab(id) {
  if      (id === 'resumen')   rResumen();
  else if (id === 'lotes')     rLotes();
  else if (id === 'precios')   rPrecios();
  else if (id === 'flujo')     rFlujo();
  else if (id === 'venta')     rVenta();
  else if (id === 'vendedor')  rVend();
  else if (id === 'ingresos')  rIngresos();
  else if (id === 'config')    initConfigPanel();
}

function rAll() { saveS(); rTab(activeT); }

window.addEventListener('DOMContentLoaded', function() {
  /* Auto-conectar Supabase si hay credenciales guardadas */
  var u = localStorage.getItem('araguatos_sb_url');
  var k = localStorage.getItem('araguatos_sb_key');
  if (u && k) { SB_URL = u; SB_KEY = k; pullFromSupabase(); }

  /* Estado inicial pestaña venta */
  setPay('fin');
  rResumen();
  G('hDate') && (G('hDate').textContent = new Date().toLocaleDateString('es-CO', {day:'2-digit', month:'short'}));
});

function rTab(id) {
  if      (id === 'resumen')   rResumen();
  else if (id === 'lotes')     rLotes();
  else if (id === 'precios')   rPrecios();
  else if (id === 'flujo')     rFlujo();
  else if (id === 'venta')     rVenta();
  else if (id === 'vendedor')  rVend();
  else if (id === 'ingresos')  rIngresos();
  else if (id === 'config')    initConfigPanel();
}

function rAll() { saveS(); rTab(activeT); }

window.addEventListener('DOMContentLoaded', function() {
  /* Auto-conectar Supabase si hay credenciales guardadas */
  var u = localStorage.getItem('araguatos_sb_url');
  var k = localStorage.getItem('araguatos_sb_key');
  if (u && k) { SB_URL = u; SB_KEY = k; pullFromSupabase(); }

  /* Estado inicial pestaña venta */
  setPay('fin');
  rResumen();
  G('hDate') && (G('hDate').textContent = new Date().toLocaleDateString('es-CO', {day:'2-digit', month:'short'}));
});
