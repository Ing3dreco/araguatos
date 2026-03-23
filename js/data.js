/* ═══════════════════════════════════════════════════
   data.js  — Lotes, estado global, helpers
═══════════════════════════════════════════════════ */

var TP = {};
TP[0] = 20; TP[6] = 80;
for (var _i = 0; _i < 30; _i++) TP[7 + _i] = 36;
TP[37] = 20;

var CPL = 40, TL = 58, CM = 0.03;

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
  /* MANZANA A — 19 lotes
     Internos: A01,A16,A17,A18 | Plus fp: A02-A08($66M), A09($72M), A10($90M), A19($70M) | Std: A11-A15 */
  [1,16,17,18].forEach(function(n){ L.push(mkLot('A',n,'internal',98,null)); });
  [2,3,4,5,6,7,8].forEach(function(n){ L.push(mkLot('A',n,'plus',98,66)); });
  L.push(mkLot('A', 9,'plus',112,72));
  L.push(mkLot('A',10,'plus',130,90));
  [11,12,13,14,15].forEach(function(n){ L.push(mkLot('A',n,'standard',98,null)); });
  L.push(mkLot('A',19,'plus',118,70));
  /* MANZANA B — 18 lotes. Internos: B01,B09,B18 | Plus fp: B10($72M) | Std: resto */
  [1,9,18].forEach(function(n){ L.push(mkLot('B',n,'internal',98,null)); });
  [2,3,4,5,6,7,8].forEach(function(n){ L.push(mkLot('B',n,'standard',98,null)); });
  L.push(mkLot('B',10,'plus',125,72));
  [11,12,13,14,15,16,17].forEach(function(n){ L.push(mkLot('B',n,'standard',98,null)); });
  /* MANZANA C — 18 lotes. Internos: C01,C09,C18 | Plus fp: C10($75M) | Std: resto */
  [1,9,18].forEach(function(n){ L.push(mkLot('C',n,'internal',98,null)); });
  [2,3,4,5,6,7,8].forEach(function(n){ L.push(mkLot('C',n,'standard',98,null)); });
  L.push(mkLot('C',10,'plus',120,75));
  [11,12,13,14,15,16,17].forEach(function(n){ L.push(mkLot('C',n,'standard',98,null)); });
  /* MANZANA D — 3 lotes. Plus fp: D01($85M) | Std: D02,D03 */
  L.push(mkLot('D',1,'plus',135,85));
  L.push(mkLot('D',2,'standard',98,null));
  L.push(mkLot('D',3,'standard',98,null));
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
    var s6 = JSON.parse(localStorage.getItem('araguatos_v6'));
    if (s6 && s6.lots) {
      s6.lots.forEach(function(l){
        if (l.type === 'premium') l.type = 'plus'; // migración
      });
      return s6;
    }
    var s5 = JSON.parse(localStorage.getItem('araguatos_v5'));
    if (s5 && s5.lots) {
      s5.lots.forEach(function(l){
        if (l.type === 'reserved' || l.type === 'premium')
          l.type = (l.type === 'premium') ? 'plus' : 'internal';
        if (l.status === 'reserved') l.status = 'available';
      });
      return s5;
    }
    return defS();
  } catch(e) { return defS(); }
}

/* ── Guardar + auto-sync Supabase (debounced 2s) ─ */
var _syncT = null;
function saveS() {
  localStorage.setItem('araguatos_v6', JSON.stringify(S));
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
