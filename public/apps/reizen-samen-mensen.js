/* HET BLAD SAMEN, deel drie: DE MENSEN.

   Deel een (./reizen-samen.js) laadt en kiest de reis; deel twee
   (./reizen-samen-delen.js) tekent wat er gedeeld wordt. Dit bestand tekent de
   MENSEN: wie in het gezelschap zit, met welke rol, en welke uitnodiging er nog
   op u ligt.

   Weghalen staat hier ook, en met een reden die het scherm hardop zegt: wie u
   weghaalt ziet niets meer van deze reis -- ook de beelden niet, want de server
   trekt die toegang bij dezelfde handeling in. */
(function (w, d) {
  'use strict';
  var R = w.RTGReizen; if (!R) return;
  var $ = R.$, maak = R.maak;
  function leeg(vak, tekst) { vak.textContent = ''; vak.appendChild(maak('li', 'ds-meta', tekst)); }

  function tekenLeden(uit) {
    var vak = $('#samenLeden'); if (!vak) return;
    /* UITNODIGEN DOET DE EIGENAAR. De server weigert het al voor een ander
       (404), maar een formulier dat zichtbaar is en dan afketst, is een
       verhindering zonder reden -- GRAMMATICA.md par. 4. Wie niet mag, ziet
       hier waarom in plaats van een knop. */
    var vorm = $('#samenNodig');
    if (vorm) {
      var eigenaar = uit.rol === 'eigenaar';
      vorm.hidden = !eigenaar;
      var noot = $('#samenNodigNoot');
      if (noot) noot.hidden = eigenaar;
    }
    vak.textContent = '';
    var rij = uit.leden || [];
    if (!rij.length) { leeg(vak, 'Nog niemand. Nodig uw reisgenoot of familie uit.'); return; }
    rij.forEach(function (l) {
      var regel = maak('li', 'ds-lijst__rij');
      regel.appendChild(maak('span', 'ds-gesprek__monogram', (l.codenaam || '?').slice(0, 2).toUpperCase()));
      var midden = maak('span');
      midden.appendChild(maak('span', 'ds-lijst__titel', l.codenaam));
      midden.appendChild(maak('span', 'ds-lijst__tekst', (l.stand === 'gevraagd' ? 'uitnodiging staat open' : 'in het gezelschap') + ' · ' + l.rol.toUpperCase()));
      regel.appendChild(midden);
      if (uit.rol === 'eigenaar') {
        var weg = maak('button', 'ds-knop ds-knop--stil ds-knop--klein', 'HAAL WEG');
        weg.type = 'button';
        weg.addEventListener('click', function () {
          R.api('/api/reis/gezelschap/weg', { id: l.id })
            .then(function () { R.toast('Weggehaald. Deze persoon ziet niets meer van deze reis.'); laad(); })
            .catch(function (e) { R.toast(e.message); });
        });
        regel.appendChild(weg);
      }
      vak.appendChild(regel);
    });
  }

  function tekenKring(uit) {
    var vak = $('#samenKring'); if (!vak) return;
    vak.textContent = '';
    var rij = (uit.gevraagd || []);
    if (!rij.length) { leeg(vak, 'Geen openstaande uitnodigingen.'); return; }
    rij.forEach(function (v) {
      var regel = maak('li', 'ds-lijst__rij');
      regel.appendChild(maak('span', 'ds-gesprek__monogram', (v.van || '?').slice(0, 2).toUpperCase()));
      var midden = maak('span');
      midden.appendChild(maak('span', 'ds-lijst__titel', v.van || 'Een lid'));
      midden.appendChild(maak('span', 'ds-lijst__tekst', 'vraagt u mee als ' + v.rol));
      regel.appendChild(midden);
      var knoppen = maak('span', 'ds-chips');
      regel.appendChild(knoppen);
      ['Aanvaarden', 'Nee'].forEach(function (woord, i) {
        var knop = maak('button', i ? 'ds-knop ds-knop--stil ds-knop--klein' : 'ds-knop ds-knop--primair ds-knop--klein', woord);
        knop.type = 'button';
        knop.addEventListener('click', function () {
          R.api('/api/reis/gezelschap/antwoord', { id: v.id, ja: i === 0 })
            .then(function () { R.toast(i === 0 ? 'U hoort nu bij deze reis.' : 'Afgewezen.'); laad(); })
            .catch(function (e) { R.toast(e.message); });
        });
        knoppen.appendChild(knop);
      });
      vak.appendChild(regel);
    });
  }

  w.RTGSamenMensen = { tekenLeden: tekenLeden, tekenKring: tekenKring };
})(window, document);
