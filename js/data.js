/* ═══════════════════════════════════════════════════
   data.js  — Lotes, estado global, helpers
═══════════════════════════════════════════════════ */

var TP = {};
TP[0] = 20; TP[6] = 80;
for (var _i = 0; _i < 30; _i++) TP[7 + _i] = 36;
TP[37] = 20;

var CPL = 40, TL = 78, CM = 0.03;

function mkLot(m, n, type, area, fp) {
  var id = m + (n < 10 ? '0' + n : '' + n);
  return {
    id: id, m: m, n: n, type: type, area: area || 98, fp: fp || null,
    status: 'available', buyer: '', cc: '', phone: '', email: '', addr: '',
    payType: 'fin', dn: 20, mo: 36, dnAmt: 0, cmAmt: 0, pv: false,
    saleDate: null, saleMonthIdx: 0, salePrice: null, obs: ''
  };
}

function buildLots() {
  var L = [];

  /* MANZANA A — 19 lotes (cedidos — todos uso interno) */
  [1,16,17,18].forEach(function(n){ L.push(mkLot('A',n,'internal',98,null)); });
  [2,3,4,5,6,7,8].forEach(function(n){ L.push(mkLot('A',n,'internal',98,null)); });
  L.push(mkLot('A', 9,'internal',112,null));
  L.push(mkLot('A',10,'internal',130,null));
  [11,12,13,14,15].forEach(function(n){ L.push(mkLot('A',n,'internal',98,null)); });
  L.push(mkLot('A',19,'internal',118,null));

  /* MANZANA B — 18 lotes
     Internos: B1(156.35m²), B8, B9, B10, B11
     Plus: B2(125.19m²) | Std: B3-B7, B12-B18 */
  L.push(mkLot('B', 1,'internal',156.35,null));
  L.push(mkLot('B', 2,'plus',   125.19,null));
  [3,4,5,6,7].forEach(function(n){ L.push(mkLot('B',n,'standard',98,null)); });
  [8,9,10,11].forEach(function(n){ L.push(mkLot('B',n,'internal',98,null)); });
  [12,13,14,15,16,17,18].forEach(function(n){ L.push(mkLot('B',n,'standard',98,null)); });

  /* MANZANA C — 18 lotes
     Internos: C1(121.41m²), C10, C11
     Plus: C2(129.27m²) | Std: C3-C9, C12-C18 */
  L.push(mkLot('C', 1,'internal',121.41,null));
  L.push(mkLot('C', 2,'plus',   129.27,null));
  [3,4,5,6,7,8,9].forEach(function(n){ L.push(mkLot('C',n,'standard',98,null)); });
  [10,11].forEach(function(n){ L.push(mkLot('C',n,'internal',98,null)); });
  [12,13,14,15,16,17,18].forEach(function(n){ L.push(mkLot('C',n,'standard',98,null)); });

  /* MANZANA D — 18 lotes
     Internos: D1(142.81m²), D10, D11
     Plus: D2(152.16m²) | Std: D3-D9, D12-D18 */
  L.push(mkLot('D', 1,'internal',142.81,null));
  L.push(mkLot('D', 2,'plus',   152.16,null));
  [3,4,5,6,7,8,9].forEach(function(n){ L.push(mkLot('D',n,'standard',98,null)); });
  [10,11].forEach(function(n){ L.push(mkLot('D',n,'internal',98,null)); });
  [12,13,14,15,16,17,18].forEach(function(n){ L.push(mkLot('D',n,'standard',98,null)); });

  /* MANZANA E — 5 lotes
     Plus: E1(168.04m²) | Std: E2-E5 */
  L.push(mkLot('E', 1,'plus',168.04,null));
  [2,3,4,5].forEach(function(n){ L.push(mkLot('E',n,'standard',98,null)); });

  return L.sort(function(a,b){ return a.m<b.m?-1:a.m>b.m?1:a.n-b.n; });
}

function defS() {
  return {
    lots: buildLots(),
    cfg:  { std:60, plu:66, pv:10, vel:2, adn:20 },
    cl:   { lid:null, pay:'fin', dn:20, mo:36, dnAmt:0, cmAmt:0 }
  };
}

var S = loadS();

function loadS() {
  try {
    /* v7 — estructura actual */
    var s7 = JSON.parse(localStorage.getItem('araguatos_v7'));
    if (s7 && s7.lots) return s7;

    /* Migración desde v6 — preservar datos de ventas ya registradas */
    var prev = JSON.parse(localStorage.getItem('araguatos_v6'))
            || JSON.parse(localStorage.getItem('araguatos_v5'));
    var base = defS();
    if (prev && prev.lots) {
      prev.lots.forEach(function(old) {
        var l = base.lots.find(function(x){ return x.id === old.id; });
        if (!l) return;
        /* Preservar datos de venta/comprador si los había */
        if (old.status && old.status !== 'available') l.status = old.status;
        if (old.buyer)     l.buyer     = old.buyer;
        if (old.cc)        l.cc        = old.cc;
        if (old.phone)     l.phone     = old.phone;
        if (old.email)     l.email     = old.email;
        if (old.addr)      l.addr      = old.addr;
        if (old.salePrice) l.salePrice = old.salePrice;
        if (old.saleDate)  l.saleDate  = old.saleDate;
        if (old.saleMonthIdx) l.saleMonthIdx = old.saleMonthIdx;
        if (old.dnAmt)     l.dnAmt     = old.dnAmt;
        if (old.cmAmt)     l.cmAmt     = old.cmAmt;
        if (old.payType)   l.payType   = old.payType;
        if (old.dn)        l.dn        = old.dn;
        if (old.mo)        l.mo        = old.mo;
        if (old.obs)       l.obs       = old.obs;
        if (old.pv)        l.pv        = old.pv;
      });
      if (prev.cfg) base.cfg = prev.cfg;
    }
    return base;
  } catch(e) { return defS(); }
}

/* ── Guardar + auto-sync Supabase (debounced 2s) ─ */
var _syncT = null;
function saveS() {
  localStorage.setItem('araguatos_v7', JSON.stringify(S));
  clearTimeout(_syncT);
  _syncT = setTimeout(function(){
    if (typeof SB_CONNECTED !== 'undefined' && SB_CONNECTED &&
        typeof pushToSupabase === 'function') {
      pushToSupabase();
    }
  }, 2000);
}

function lp(l) {
  if (l.fp)              return l.fp;
  if (l.type === 'plus') return S.cfg.plu;
  return S.cfg.std;
}

function pvUsed() { return S.lots.filter(function(l){ return l.pv; }).length; }

function fM(n) { return '$'+(Math.round(n*10)/10).toLocaleString('es-CO')+'M'; }

function fCOP(m) {
  return new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0})
    .format(Math.round(m*1e6));
}

function parseCopPesos(rawStr) {
  if (!rawStr) return 0;
  var clean = String(rawStr).replace(/[$\s\.]/g,'').replace(/,/g,'.');
  return (parseFloat(clean)||0)/1e6;
}

function G(id) { return document.getElementById(id); }

function drow(l,v,c) {
  return '<div class="dr"><span class="dl">'+l+'</span><span class="dv '+(c||'')+'">'+v+'</span></div>';
}

function drawC(el, labels, series, H) {
  if (!H) H = 160;
  var W=580,pl=54,pr=10,pt=12,pb=28,cw=W-pl-pr,ch=H-pt-pb,n=labels.length;
  var all=[]; series.forEach(function(s){s.data.forEach(function(v){all.push(v);});});
  var mn=Math.min.apply(null,[0].concat(all)), mx=Math.max.apply(null,all.concat([0.1]));
  var pad=(mx-mn)*0.08; if(!pad)pad=2; mn-=pad; mx+=pad; var rng=mx-mn; if(!rng)rng=1;
  function xs(i){return pl+(i/((n-1)||1))*cw;}
  function ys(v){return pt+ch-((v-mn)/rng)*ch;}
  var svg='<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:'+H+'px">';
  [0,.25,.5,.75,1].forEach(function(f){
    var v=mn+rng*f,y=ys(v);
    svg+='<line x1="'+pl+'" y1="'+y+'" x2="'+(W-pr)+'" y2="'+y+'" stroke="#e5e7eb" stroke-width="0.5"/>';
    svg+='<text x="'+(pl-3)+'" y="'+(y+3)+'" text-anchor="end" font-size="8" fill="#9ca3af">'+fM(v)+'</text>';
  });
  if(mn<0&&mx>0){var z0=ys(0);svg+='<line x1="'+pl+'" y1="'+z0+'" x2="'+(W-pr)+'" y2="'+z0+'" stroke="#9ca3af" stroke-width="1" stroke-dasharray="4,2"/>';}
  var step=Math.max(1,Math.floor(n/10));
  labels.forEach(function(lb,i){if(i%step===0||i===n-1)svg+='<text x="'+xs(i)+'" y="'+(H-4)+'" text-anchor="middle" font-size="8" fill="#9ca3af">'+lb+'</text>';});
  series.forEach(function(s){
    if(s.bar){
      s.data.forEach(function(v,i){var bw=Math.max(3,cw/n-2),y0=ys(0),y1=ys(v),bh=Math.abs(y1-y0);
        svg+='<rect x="'+(xs(i)-bw/2)+'" y="'+Math.min(y0,y1)+'" width="'+bw+'" height="'+Math.max(1,bh)+'" fill="'+s.color+'" opacity=".8"/>';});
    } else {
      var pts=s.data.map(function(v,i){return xs(i)+','+ys(v);}).join(' ');
      var da=s.dash?'stroke-dasharray="'+s.dash+'"':'';
      svg+='<polyline points="'+pts+'" fill="none" stroke="'+s.color+'" stroke-width="'+(s.w||2)+'" stroke-linejoin="round" '+da+'/>';
      if(s.fill){var zz=ys(0);var ap=xs(0)+','+zz+' '+s.data.map(function(v,i){return xs(i)+','+ys(v);}).join(' ')+' '+xs(s.data.length-1)+','+zz;
        svg+='<polygon points="'+ap+'" fill="'+s.color+'" opacity=".1"/>';}
    }
  });
  svg+='</svg>'; el.innerHTML=svg;
}
