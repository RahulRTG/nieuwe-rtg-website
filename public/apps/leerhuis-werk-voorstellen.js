/* Leerhuis: aan het werk -- voorstellen uit de praktijk behandelen, voor de
   kenniseigenaar (ACADEMY.md, fase B-UI; grondwet 11).

   HIJ BESLIST NIETS. Welke stappen er zijn, komt uit de overgangstabel via
   kennisWerk (kern/leerhuis/werk.js); of een stap mag, zegt voorstelStand. Wie
   een voorstel indiende, beslist er niet zelf over, en wie indiende staat er
   niet bij: alleen of u het zelf was.

   EEN VOORSTEL VERANDERT GEEN KENNIS. Na goedkeuren schrijft een kenniseigenaar
   een nieuwe versie die naar het voorstel verwijst; die wordt langs de gewone
   weg officieel, en pas dan kan het voorstel op uitgevoerd. */
'use strict';
window.RTGLeerhuisVoorstellen = function (h) {
  var maak = h.maak, knop = h.knop, kaart = h.kaart, zet = h.zet, doe = h.doe, dag = h.dag;
  var STAP = { TRIAGED: 'Oppakken', REVIEW: 'In review nemen', EXPERIMENT: 'Eerst proberen', APPROVED: 'Goedkeuren',
    REJECTED: 'Afwijzen', IMPLEMENTED: 'Uitgevoerd', MEASURED: 'Meting vastleggen' };
  var STAND = { SUBMITTED: 'ingediend', TRIAGED: 'opgepakt', REVIEW: 'in review', EXPERIMENT: 'wordt geprobeerd', APPROVED: 'goedgekeurd',
    IMPLEMENTED: 'uitgevoerd' };
  function veld(label, groot) { var v = maak(groot ? 'textarea' : 'input', 'veld'); v.setAttribute('aria-label', label); v.placeholder = label; return v; }
  function rij(knoppen) { var r = maak('div', 'rij'); knoppen.forEach(function (k) { r.appendChild(k); }); return r; }

  /* Na goedkeuren: de nieuwe versie van het kennisitem, met het voorstel erbij. */
  function versie(k, v) {
    if (!v.kennis) { k.appendChild(maak('p', 'meta', 'Dit voorstel gaat niet over een bestaand kennisitem; uitgevoerd kan pas als een officiële versie ernaar verwijst.')); return; }
    if (v.versieGeschreven) { k.appendChild(maak('p', 'meta', 'De nieuwe versie is geschreven. Zodra een andere kenniseigenaar hem activeert, zet u dit voorstel op uitgevoerd.')); return; }
    if (v.conceptLoopt) { k.appendChild(maak('p', 'meta', 'Er ligt al een concept van ' + v.kennisTitel + '; werk dat eerst af.')); return; }
    var t = veld('Nieuwe tekst van ' + v.kennisTitel, true), b = veld('Bron van de nieuwe versie');
    k.appendChild(t); k.appendChild(b);
    k.appendChild(rij([knop('Nieuwe versie schrijven', false, function () {
      doe('vv:' + v.id, 'kennisSchrijf', { id: v.kennis, titel: v.kennisTitel, tekst: t.value.trim(), bron: b.value.trim(), voorstel: v.id,
        reden: 'voorstel: ' + v.probleem }, 'Nieuwe versie geschreven van ' + v.kennisTitel + '. Zet hem ter review; een ander activeert hem.');
    })]));
  }

  return function (w) {
    zet('voorstellen', (w.VOORSTELLEN || []).map(function (v) {
      var k = kaart('Voorstel: ' + (v.kennisTitel || 'algemeen'), STAND[v.stand] || v.stand, ['Probleem: ' + v.probleem,
        v.huidigeRegel ? 'Nu staat er: ' + v.huidigeRegel : null, 'Voorstel: ' + v.voorstel, 'Waarom: ' + v.reden, 'Ingediend op ' + dag(v.sinds) + '.']);
      if (v.stand === 'APPROVED') versie(k, v);
      var naar = (v.naar || []).filter(function (n) { return !(v.eigen && (n === 'APPROVED' || n === 'REJECTED')); });
      if (v.eigen && naar.length < (v.naar || []).length) k.appendChild(maak('p', 'meta', 'U diende dit voorstel in; over goedkeuren of afwijzen beslist een andere kenniseigenaar.'));
      if (!naar.length) return k;
      var meting = naar.indexOf('MEASURED') >= 0 ? veld('Wat de meting liet zien', true) : null;
      var notitie = meting ? null : veld('Toelichting voor de indiener');
      k.appendChild(meting || notitie);
      k.appendChild(rij(naar.map(function (n) {
        return knop(STAP[n] || n, n === 'REJECTED' || n === 'EXPERIMENT', function () {
          var invoer = { id: v.id, naar: n };
          if (notitie) invoer.notitie = notitie.value.trim();
          if (meting) invoer.meting = meting.value.trim();
          doe('vs:' + v.id + ':' + n, 'voorstelStand', invoer, (STAP[n] || n) + ': voorstel over ' + (v.kennisTitel || 'algemeen') + '.');
        });
      })));
      return k;
    }), 'Er loopt geen voorstel uit de praktijk.');
  };
};
