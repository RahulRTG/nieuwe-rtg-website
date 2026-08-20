/* RTMAIL: de acties die aan een bericht hangen (shared/gebaar.js).

   DIT IS HET GEBAAR DAT IEDEREEN AL KENT. Vegen over post is de enige veeg
   waarvan een lid de betekenis meebrengt van buiten dit huis -- opzij is weg,
   de andere kant is markeren. Precies daarom moet hij hier kloppen: een veeg
   die op post iets anders doet dan overal, is verwarrender dan geen veeg.

   WAT DE POST BIJZONDER MAAKT: alles is omkeerbaar. Opbergen, weggooien en
   terugzetten zijn alle drie DEZELFDE route (`verplaats`) met een andere map,
   en de map waar het bericht vandaan komt weten we op het moment van vegen. Er
   is dus geen actie die zichzelf niet kan terugdraaien -- geen enkele veeg
   hier hoeft een borg, en dat is niet toevallig maar de reden dat dit domein
   het tweede is en niet het tiende.

   `prullenbak` is hier trouwens GEEN vernietiging: server/kern/rtmail-vak.js
   kent drie mappen en verplaatst alleen. Wat er echt weggaat, gaat via het
   bewaarbeleid en laat een spoor na. Het scherm zegt dat zelf al bij zijn
   knoppen; de veeg belooft dus niets anders dan de knop ernaast.

   SLUIMEREN IS DE UITZONDERING DIE ER GEEN IS. `sluimer` zet een tijdstip en
   `verplaats` naar `in` haalt het weer weg (v.sluimert = null), dus ook dat
   heeft een echte terugweg. We bieden hem alleen aan IN het postvak in, want
   alleen daar is `verplaats in` ook echt de omgekeerde stand: sluimeren vanuit
   het archief zet het bericht in de inbox, en dan zou terugdraaien iets anders
   doen dan ongedaan maken.

   Apart bestand: rtmail.html loopt tegen de maat van check.js regel 13 aan, en
   dezelfde reden als bij apps/bestanden/gebaren.js -- de bediening van een
   scherm hoort niet door het scherm zelf heen te lopen. */
(function () {
  'use strict';

  var MORGEN = 86400000;

  function start() {
    var M = window.RTGMail, G = window.RTGGebaar;
    if (!M || !G) return;
    var K = G.klaar;

    /* De api van dit scherm WERPT al bij een fout (hij leest {error} en gooit),
       dus hier hoeft niets vertaald te worden. Dat is anders dan bij de kluis,
       en het staat hier zodat de volgende lezer niet gaat zoeken naar de
       vertaling die er niet is. */
    function verplaats(id, map) { return M.api('verplaats', { id: id, map: map }); }

    function naam(bericht) {
      return (bericht && bericht.onderwerp) || 'Dit bericht';
    }

    /* Een verplaatsing heen en terug. `van` is de map waar het bericht NU in
       ligt -- niet 'in' als aanname, want vanuit het archief is de weg terug
       het archief en niet het postvak.

       DE HANDELING STAAT VOORAAN IN DE MELDING, en dat is met kijken geleerd.
       Eerst stond het onderwerp voorop en werd de melding op een telefoon
       afgekapt tot "Welkom bij Rahul Travel Gro..." -- je zag WELK bericht er
       weg was en niet WAT ermee gebeurd was, terwijl daar net een knop
       Terugdraaien naast staat. Nu leest de eerste helft altijd. */
    function zet(bericht, van, naarMap, opschrift, gedaan, teken, sig) {
      return K.server({
        naam: opschrift, teken: teken, sig: sig || null,
        doe: function () { return verplaats(bericht.id, naarMap); },
        terug: function () { return verplaats(bericht.id, van); },
        melding: gedaan + ' \u00b7 ' + naam(bericht),
        na: M.laad
      });
    }

    G.lijst(document.getElementById('main'), '.rij[data-i]', function (rij) {
      var bericht = M.bericht(+rij.getAttribute('data-i'));
      if (!bericht) return null;
      var map = M.map();
      var ster = !!bericht.favoriet;

      /* De sterveeg staat in ELKE map: een bericht markeren heeft niets met
         opbergen te maken, en hem alleen in het postvak aanbieden zou betekenen
         dat je iets in het archief eerst terug moet halen om hem te kunnen
         markeren. */
      var sterActie = K.server({
        naam: ster ? 'Ster eraf' : 'Ster', teken: 'rahul', sig: ster ? null : 'aandacht',
        doe: function () { return M.api('ster', { id: bericht.id, aan: !ster }); },
        terug: function () { return M.api('ster', { id: bericht.id, aan: ster }); },
        melding: (ster ? 'Ster eraf' : 'Ster erop') + ' \u00b7 ' + naam(bericht),
        na: M.laad
      });

      var links = [sterActie];
      if (map === 'in') {
        links.push(K.server({
          naam: 'Sluimeren tot morgen', teken: 'uitstel',
          doe: function () {
            return M.api('sluimer', { id: bericht.id, tot: new Date(Date.now() + MORGEN).toISOString() });
          },
          terug: function () { return verplaats(bericht.id, 'in'); },
          melding: 'Sluimert tot morgen \u00b7 ' + naam(bericht), na: M.laad
        }));
      }
      links.push(K.overnemen([bericht.van, naam(bericht), bericht.tekst].filter(Boolean).join(' · ')));

      /* De rechterlade -- die je opent door naar LINKS te vegen -- is de kant
         van "van mijn bureau af". De eerste actie is ook de actie die een volle
         veeg uitvoert, dus die hoort de rustigste te zijn: opbergen en niet
         weggooien. Wie echt wil weggooien, tikt de tweede aan. */
      var rechts = [];
      if (map === 'in') {
        rechts.push(zet(bericht, 'in', 'archief', 'Opbergen', 'Opgeborgen', 'archief'));
        rechts.push(zet(bericht, 'in', 'prullenbak', 'Weggooien', 'In de prullenbak', 'ingrijp', 'incident'));
      } else if (map === 'archief') {
        rechts.push(zet(bericht, 'archief', 'in', 'Terug naar postvak in', 'Terug in je postvak', 'gereed'));
        rechts.push(zet(bericht, 'archief', 'prullenbak', 'Weggooien', 'In de prullenbak', 'ingrijp', 'incident'));
      } else if (map === 'prullenbak') {
        rechts.push(zet(bericht, 'prullenbak', 'in', 'Terug naar postvak in', 'Terug in je postvak', 'gereed'));
      }
      /* Verzonden post kent geen map: server/kern/rtmail-vak.js verplaatst
         alleen binnen in/archief/prullenbak. Een veeg die daar iets belooft,
         zou een route aanroepen die 'Deze map bestaat niet' teruggeeft. Dus
         blijft die kant hier leeg, en de laag opent geen lege lade. */

      return { titel: naam(bericht), links: links, rechts: rechts };
    });
  }

  if (window.RTGGebaar) start();
  else document.addEventListener('rtg-gebaar', start, { once: true });
})();
