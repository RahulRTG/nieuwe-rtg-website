/* RTG Festival, het scherm: HET BLAD "GEREED".

   Dit blad toont het enige getal in deze wereld waar een terrein op opengaat, en
   het is daarom het blad met de strengste regels (FESTIVAL.md par. 5.5):

   1. DE STAND IS EEN WOORD, GEEN KLEUR. "GEREED" of "NIET GEREED", met een
      teken erachter (ONTWERP.md par. 5). Het percentage staat ernaast en niet
      in de plaats ervan: 98,7% met een open evenementenvergunning is nog steeds
      niet gereed, en dan hoort het cijfer niet het grootste ding op het scherm
      te zijn.

   2. WAT ONTBREEKT STAAT VOORAAN, en het dringendste eerst -- kritiek boven
      gewoon, en een VERLOPEN stuk boven een stuk dat er nooit was. Dat laatste
      is geen detail: verlopen betekent dat iemand dacht dat het geregeld was.

   3. AFZWAKKEN WORDT GENOEMD. Wie een kritieke control naar gewoon zet, is de
      enige die groen kan halen zonder bewijs. Dat mag (RTG is hier geen
      juridische autoriteit), maar het staat erbij.

   ER WORDT HIER NIETS AFGETEKEND. Indienen en aftekenen zijn handelingen met
   een naam eraan; die horen in het beheerscherm van de zaak en niet in een
   cockpit waar iemand langsloopt. Dit blad LEEST. */
(function () {
  'use strict';
  var F = window.RTGFestival;
  if (!F) return;

  var WOORD = {
    'gereed':      { woord: 'GEREED',      teken: '✓', sig: 'gezond' },
    'niet-gereed': { woord: 'NIET GEREED', teken: '×', sig: 'incident' }
  };
  var STAND_TEKST = { ontbreekt: 'niets ingediend', ingediend: 'ingediend, nog niet afgetekend',
    verlopen: 'afgetekend, maar verlopen' };

  F.opBlad('gereed', function () {
    var kop = document.getElementById('gereedZin');
    var lijst = document.getElementById('gereedLijst');
    var groepen = document.getElementById('gereedGroepen');
    lijst.textContent = '';
    groepen.textContent = '';

    F.api('/api/festival/gereed', { festival: F.staat.fid, editie: F.staat.eid })
      .then(function (r) {
        var b = r.body || {};
        if (b.error) { kop.textContent = b.error; return; }

        kop.textContent = '';
        var w = WOORD[b.stand] || WOORD['niet-gereed'];
        var stand = document.createElement('span');
        stand.className = 'fp-stand';
        stand.setAttribute('data-sig', w.sig);
        stand.setAttribute('data-teken', w.teken);
        stand.textContent = w.woord;
        kop.appendChild(stand);

        /* Het percentage staat ERNAAST en niet in de plaats van het woord, en
           NAAST het teken en niet ertussen: het teken hoort bij het woord. Een
           Nederlands getal in een Nederlandse zin: 91,7 en niet 91.7. */
        var cijfer = document.createElement('small');
        cijfer.className = 'fp-cijfer';
        cijfer.textContent = String(b.deel).replace('.', ',') + '% \u00b7 '
          + b.gezien + ' van ' + b.totaal + ' afgetekend en geldig';
        kop.appendChild(cijfer);

        (b.open || []).forEach(function (o) {
          var d = document.createElement('div');
          d.className = 'fp-regel';
          if (o.kritiek) d.setAttribute('data-sig', 'kritiek');
          var s = document.createElement('span');
          s.textContent = (o.kritiek ? 'KRITIEK · ' : '') + o.naam + ': ' + o.eis;
          d.appendChild(s);
          var rechts = document.createElement('span');
          rechts.className = 'rek';
          rechts.textContent = STAND_TEKST[o.stand] || o.stand;
          d.appendChild(rechts);
          lijst.appendChild(d);
        });

        var regels = [];
        Object.keys(b.groepen || {}).forEach(function (g) {
          var x = b.groepen[g];
          regels.push(g + ' ' + x.gezien + '/' + x.totaal);
        });
        if ((b.afgezwakt || []).length) {
          /* De enige weg naar groen zonder bewijs, dus die staat er voluit. */
          regels.push('afgezwakt van kritiek naar gewoon: ' + b.afgezwakt.map(function (a) {
            return a.control + ' (' + a.reden + ')';
          }).join(' · '));
        }
        groepen.textContent = regels.join(' · ');
      })
      .catch(function () { kop.textContent = 'Geen verbinding.'; });
  });
})();
