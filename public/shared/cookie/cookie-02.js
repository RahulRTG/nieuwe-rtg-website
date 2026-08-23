  /* De lagen MENGEN in plaats van op de eerste dekkende te wachten. Een half
     doorzichtig vlak zegt iets over de kleur eronder, niet niets. */
  function grondOnder(node) {
    var r = 0, g = 0, b = 0, over = 1;
    for (var n = node; n && n.nodeType === 1 && over > 0.02; n = n.parentElement) {
      var m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(getComputedStyle(n).backgroundColor || '');
      if (!m) continue;
      var a = m[4] === undefined ? 1 : parseFloat(m[4]);
      if (!a) continue;
      r += over * a * +m[1]; g += over * a * +m[2]; b += over * a * +m[3];
      over *= (1 - a);
    }
    if (over > 0.5) return null;                 // vrijwel niets geschilderd
    return [r / (1 - over), g / (1 - over), b / (1 - over)];
  }
  /* Niets geschilderd? De pagina-inkt weet het: lichte tekst = donkere grond. */
  /* De stapel achter de melding zelf; haarzelf en haar kinderen overslaan. */
  function stapelAchter() {
    if (!document.elementsFromPoint) return [];
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return [];
    var alles = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2) || [];
    return alles.filter(function (n) { return n !== el && !el.contains(n); });
  }
  function grondAchter() {
    var st = stapelAchter();
    return st.length ? grondOnder(st[0]) : null;
  }
  /* Een vaste balk achter haar dekt zij niet af: dan gaat zij erboven staan. Dat
     was ook waarom haar grond niet klopte -- op salon lag er een lichte balk
     achter een bijna zwarte pagina. */
  function tilBovenBalk() {
    /* Klimmen, want het eerste element achter haar is meestal een KNOP in de
       balk en niet de balk zelf. */
    for (var n = stapelAchter()[0]; n && n.nodeType === 1; n = n.parentElement) {
      var b = n.getBoundingClientRect();
      if (getComputedStyle(n).position !== 'fixed') continue;
      if (b.bottom >= innerHeight - 2 && b.height > 24 && b.height < innerHeight / 2) {
        el.style.bottom = 'calc(' + Math.ceil(b.height) + 'px + max(0.6rem, env(safe-area-inset-bottom,0px)))';
        return;
      }
    }
  }
  function grondIsDonker() {
    var achter = grondAchter();
    if (achter) return helderheid(achter) < 0.35;
    var g = grondOnder(el.parentElement || document.body);
    if (g) return helderheid(g) < 0.35;
    var m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(document.body).color || '');
    return m ? helderheid([+m[1], +m[2], +m[3]]) > 0.5 : false;
  }
  function kiesInkt() {
    var donker = grondIsDonker();
    el.style.setProperty('--rtg-cookie-zacht', donker ? '#B4AFA6' : '#5C5952');
    el.style.setProperty('--rtg-cookie-inkt',  donker ? '#EDE9E1' : '#3A3733');
  }
  var plaats = function () {
    document.body.appendChild(el);
    tilBovenBalk(); kiesInkt();
    meetRuimte();
    if (window.requestAnimationFrame) window.requestAnimationFrame(function () { tilBovenBalk(); kiesInkt(); meetRuimte(); });
    /* En hij blijft kijken: de grond komt soms van een script, na haar. */
    if (window.MutationObserver) {
      var kijker = new MutationObserver(kiesInkt);
      kijker.observe(document.documentElement, { attributes: true, attributeFilter: ['data-rtg-thema', 'class', 'style'] });
      kijker.observe(document.body, { attributes: true, attributeFilter: ['data-rtg-eigenvlak', 'data-rtg-vlak', 'class', 'style'] });
    }
    window.addEventListener('resize', meetRuimte);
  };
  if (document.body) plaats(); else document.addEventListener('DOMContentLoaded', plaats);
})();
