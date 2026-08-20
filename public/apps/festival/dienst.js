/* RTG Festival, het scherm: HET BLAD "MIJN DIENST".

   DIT IS HET EERSTE BLAD, en dat is een besluit. De meeste mensen die dit
   scherm openen zijn geen directie en geen kassamedewerker: ze komen werken en
   willen weten waar ze heen moeten. Wie daarvoor eerst een menu door moet, is
   de zero-search-belofte uit FESTIVAL.md fase 4 al kwijt voor hij begint.

   WAT ER STAAT IS WAT IEMAND NODIG HEEFT VOOR HIJ BEGINT: waar, tot hoe laat,
   hoe hij er komt, wie er nog meer staat, wanneer zijn pauze is, en wat hij
   moet weten. Meer niet.

   WAT ER NIET STAAT: een inklokknop (die hoort bij kern/personeel.js en een
   tweede klok geeft een tweede urenstaat), een stiptheidscijfer, en een
   aanmoediging. Een medewerker is geen gebruiker die geactiveerd moet worden. */
(function () {
  'use strict';
  var F = window.RTGFestival;
  if (!F) return;

  var $ = function (s) { return document.querySelector(s); };
  var kop = $('#dienstKop'), weg = $('#dienstWeg'), lijst = $('#dienstLijst'), straks = $('#dienstStraks');

  function regel(tekst, rechts) {
    var d = document.createElement('div');
    d.className = 'fp-regel';
    var a = document.createElement('span');
    a.textContent = tekst;
    d.appendChild(a);
    if (rechts) {
      var b = document.createElement('span');
      b.className = 'rek';
      b.textContent = rechts;
      d.appendChild(b);
    }
    lijst.appendChild(d);
  }

  F.opBlad('dienst', function () {
    lijst.textContent = '';
    weg.textContent = '';
    straks.textContent = '';

    F.api('/api/festival/dienst/mijn', { festival: F.staat.fid, editie: F.staat.eid })
      .then(function (r) {
        var b = r.body || {};
        if (b.error) { kop.textContent = b.error; return; }
        if (b.geenDag) {
          kop.textContent = 'Er loopt nu geen festivaldag.';
          straks.textContent = 'Zodra de poorten opengaan, staat hier waar u heen moet.';
          return;
        }
        if (!b.nu && !b.straks) {
          /* GEEN DIENST IS EEN ANTWOORD. Er wordt niets verzonnen en er wordt
             ook niet gevraagd of u niet toch even wilt komen. */
          kop.textContent = 'U staat vandaag niet ingeroosterd.';
          return;
        }

        var d = b.nu;
        if (!d) {
          kop.textContent = 'Straks: ' + b.straks.plek;
          weg.textContent = 'Van ' + b.straks.van + ' tot ' + b.straks.tot
            + (b.straks.rol ? ' · ' + b.straks.rol : '');
          if (b.straks.weg.length) straks.textContent = b.straks.weg.join(' › ');
          return;
        }

        kop.textContent = d.plek + (d.rol ? ' · ' + d.rol : '');
        weg.textContent = 'Tot ' + d.tot + (d.weg.length ? ' · ' + d.weg.join(' › ') : '');
        if (d.briefing) regel(d.briefing, '');
        if (d.pauze) regel('Pauze', d.pauze);
        (d.collegas || []).forEach(function (c) {
          regel('Met u: ' + c.wie + (c.rol ? ' (' + c.rol + ')' : ''), c.van + '-' + c.tot);
        });
        if (b.straks) {
          straks.textContent = 'Daarna: ' + b.straks.plek + ' van ' + b.straks.van + ' tot ' + b.straks.tot + '.';
        }
      })
      .catch(function () { kop.textContent = 'Geen verbinding.'; });
  });
})();
