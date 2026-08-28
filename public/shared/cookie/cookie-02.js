  /* De stapel achter de melding zelf; haarzelf en haar kinderen overslaan. */
  function stapelAchter() {
    if (!document.elementsFromPoint) return [];
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return [];
    var alles = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2) || [];
    return alles.filter(function (n) { return n !== el && !el.contains(n); });
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
  function kiesInkt() {
    /* HET VLAK IS ALTIJD ONYX, EN DAT IS MET OPZET NIET GEMETEN. Zodra deze
       melding haar eigen dekkende vlak draagt, is de vraag "hoe donker is het
       eronder" niet meer relevant voor haar leesbaarheid -- alleen nog voor haar
       uiterlijk. En juist daar was de meting wisselvallig: op een lichte pagina
       koos zij soms toch de donkere stand, omdat wat er achter haar ligt per
       scherm en per moment verschilt. Een mededeling die de wet vraagt hoort er
       overal hetzelfde uit te zien, dus staat zij vast: een onyx strook met
       ivoren inkt, 8,97:1 en 16,16:1. Dat volgt ook het stark zwart/wit ritme uit
       CLAUDE.md, en het maakt deze melding onafhankelijk van elk thema.
       De meting hieronder blijft wel bestaan: zij bepaalt of de melding boven een
       vaste balk moet staan, en dat is een plaatsvraag en geen kleurvraag. */
    el.style.setProperty('--rtg-cookie-vlak', '#0C0C0B');
    el.style.setProperty('--rtg-cookie-lijn', '#2A2724');
    el.style.setProperty('--rtg-cookie-zacht', '#B4AFA6');
    el.style.setProperty('--rtg-cookie-inkt', '#EDE9E1');
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
