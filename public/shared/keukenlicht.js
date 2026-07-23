/* keukenlicht.js - de keuken-/werkplekschermen kleuren van licht naar donker
   mee met de dag, los van het gekozen ROS-thema. Overdag (fel omgevingslicht
   in de keuken) een licht, functioneel scherm; 's nachts een donker scherm dat
   de ogen niet verblindt; met een zachte overgang bij dageraad en schemer. Zo
   heeft het personeel op elk moment het rustigste beeld voor de ogen.

   Werkt alleen op het schermvullende werkplekscherm (#station.on). Het zet de
   tokens (--bg, --card, --txt, ...) rechtstreeks op #station, dus het wint van
   het paginathema maar raakt de rest van de app niet aan. De grens tussen dag
   en nacht schuift licht mee met het seizoen (in de zomer langer licht). */
(function(){
  var SEL = '#station';

  // nacht = de donkere basis; dag = een licht, functioneel palet (champagne-familie)
  var NACHT = {
    bg:'#0C0C0B', card:'#151312', card2:'#1B1817', line:'rgba(255,255,255,0.09)',
    txt:'#F4F1EC', muted:'rgba(244,241,236,0.70)', soft:'rgba(244,241,236,0.62)',
    gold:'#A98F1C', green:'#4C9A75', amber:'#C99A2E'
  };
  var DAG = {
    bg:'#ECE6DD', card:'#F7F3EC', card2:'#FCFAF5', line:'rgba(30,20,24,0.12)',
    txt:'#241A1E', muted:'rgba(36,26,30,0.68)', soft:'rgba(36,26,30,0.52)',
    gold:'#7C6A0C', green:'#2F7256', amber:'#9C6C14'
  };

  function parse(c){
    c = String(c).trim();
    if (c.charAt(0) === '#'){
      var h = c.slice(1);
      if (h.length === 3) h = h.replace(/./g, function(x){ return x + x; });
      return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16), 1];
    }
    var m = c.match(/rgba?\(([^)]+)\)/);
    if (m){ var p = m[1].split(',').map(function(s){ return parseFloat(s); });
      return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
    return [0,0,0,1];
  }
  // meng twee kleuren in sRGB (incl. doorzichtigheid) met factor t (0..1)
  function meng(a, b, t){
    var A = parse(a), B = parse(b);
    var r = Math.round(A[0] + (B[0]-A[0])*t);
    var g = Math.round(A[1] + (B[1]-A[1])*t);
    var bl = Math.round(A[2] + (B[2]-A[2])*t);
    var al = +(A[3] + (B[3]-A[3])*t).toFixed(3);
    return 'rgba('+r+','+g+','+bl+','+al+')';
  }
  // zachte S-curve tussen a en b (smoothstep), zodat de overgang niet schokt
  function zacht(x, a, b){
    if (x <= a) return 0;
    if (x >= b) return 1;
    var t = (x - a) / (b - a);
    return t * t * (3 - 2*t);
  }
  function dagVanJaar(d){
    var start = new Date(d.getFullYear(), 0, 0);
    return Math.floor((d - start) / 86400000);
  }
  /* daglichtfactor 0..1: 0 = diepe nacht, 1 = volle dag. De op- en neergang
     schuiven mee met het seizoen (rond de zomerzonnewende, dag ~172, langer
     licht; in de winter korter). */
  function daglicht(nu){
    nu = nu || new Date();
    var h = nu.getHours() + nu.getMinutes()/60;
    var seiz = Math.cos((dagVanJaar(nu) - 172) / 365 * 2 * Math.PI); // +1 zomer, -1 winter
    var op = zacht(h, 6 - seiz*1.2, 8.5 - seiz*1.0);     // dageraad
    var neer = 1 - zacht(h, 17.5 + seiz*1.2, 20 + seiz*1.0); // schemer
    var L = Math.min(op, neer);
    return L < 0 ? 0 : L > 1 ? 1 : L;
  }

  function grond(L){
    var bg = meng(NACHT.bg, DAG.bg, L);
    // de warme goud- en bordeauxgloed dimt weg naarmate het scherm lichter wordt
    var goud = (0.05 + 0.03*(1-L)).toFixed(3);
    var bord = (0.06 * (1-L)).toFixed(3);
    return 'radial-gradient(120% 45% at 50% -8%, rgba(169,143,28,'+goud+'), transparent 60%),'+
           'radial-gradient(130% 55% at 50% 110%, rgba(127,23,52,'+bord+'), transparent 62%),'+ bg;
  }

  function wis(st){
    ['bg','card','card2','line','txt','muted','soft','gold','green','amber'].forEach(function(k){
      st.style.removeProperty('--'+k);
    });
    st.style.removeProperty('background');
    st.style.removeProperty('color-scheme');
    delete st.dataset.keukenLicht;
  }

  function verf(){
    var st = document.querySelector(SEL);
    if (!st) return;
    if (!st.classList.contains('on')){ if (st.dataset.keukenLicht) wis(st); return; }
    var L = daglicht(new Date());
    Object.keys(NACHT).forEach(function(k){ st.style.setProperty('--'+k, meng(NACHT[k], DAG[k], L)); });
    st.style.background = grond(L);
    st.style.color = 'var(--txt)';
    st.style.colorScheme = L > 0.5 ? 'light' : 'dark';
    st.style.transition = 'background 1.2s linear, color 1.2s linear';
    st.dataset.keukenLicht = L > 0.66 ? 'licht' : L > 0.33 ? 'schemer' : 'donker';
  }

  function boot(){
    var st = document.querySelector(SEL);
    if (st){
      // meteen omkleuren zodra de werkplek open of dicht gaat
      try { new MutationObserver(verf).observe(st, { attributes:true, attributeFilter:['class'] }); } catch(e){}
    }
    verf();
    setInterval(verf, 60000); // elke minuut mee met de dag
  }

  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);

  window.RTGKeukenLicht = { verf:verf, daglicht:daglicht };
})();
