/* RTG Bestanden: de acties die aan een regel hangen (shared/gebaar.js).

   DIT IS HET EERSTE SCHERM WAAR EEN VEEG DE SERVER RAAKT. Tot hier deed elke
   veeg iets in de browser -- openen, delen, kopieren. Hier gaat een bestand
   echt naar de prullenbak.

   WAAROM UITGEREKEND HIER. De kluis heeft als enige domein in dit huis een
   volledig omkeerbaar paar dat al bestaat: /weg zet een bestand in de
   prullenbak en /herstel haalt het eruit. Er hoefde dus niets aan de serverkant
   verzonnen te worden om de belofte "optimistisch, met een weg terug" waar te
   maken -- en een belofte die je alleen kunt nakomen door eerst een route te
   bouwen, is geen goede eerste.

   EN DE PRULLENBAK ZELF IS DE UITZONDERING DIE DE REGEL DRAAGT. Een tweede /weg
   op iets dat al in de prullenbak staat, wist het bestand met inhoud en versies
   (server/kern/bestanden-delen.js). Daar is geen terugweg, dus die actie krijgt
   er ook geen: hij gaat alleen op VASTHOUDEN. Dat komt niet uit een keuze hier
   maar uit de laag zelf -- een actie zonder `terug` wordt automatisch een borg,
   en dat is precies de bedoeling. Een knop 'Terugdraaien' die niets terugdraait
   is erger dan geen knop.

   Apart bestand en niet in app.js: dat blad staat op 9997 bytes en de maat is
   10240 (check.js regel 13). Zelfde reden als paneel.js ernaast. */
(function () {
  'use strict';

  function start() {
    var B = window.RTGBestanden, G = window.RTGGebaar;
    if (!B || !G) return;

    /* De api van dit scherm WERPT NIET: hij geeft {status, body} terug, ook bij
       een fout. De laag verwacht een Promise die afwijst, want daar hangt het
       terugzetten van de regel aan. Hier wordt dat vertaald, op EEN plek. */
    function roep(pad, body) {
      return B.api(pad, body).then(function (r) {
        var f = r.body && r.body.error;
        if (f || r.status >= 400) throw new Error(f || 'Dat lukte niet.');
        return r.body;
      });
    }

    var K = G.klaar;
    G.lijst(document.getElementById('lijst'), '.item[data-open]', function (rij) {
      var id = rij.getAttribute('data-open');
      var naam = (rij.querySelector('b') || {}).textContent || '';
      var inBak = B.bak();
      var ster = !!(rij.textContent || '').match(/\bster\b/);

      if (inBak) {
        return {
          titel: naam,
          rechts: [K.server({
            naam: 'Herstellen', teken: 'gereed',
            doe: function () { return roep('herstel', { id: id }); },
            terug: function () { return roep('weg', { id: id }); },
            melding: naam + ' staat weer in de kluis', na: B.laad
          })],
          /* Geen `terug`, dus de laag maakt er vanzelf een vasthouden van. */
          links: [K.server({
            naam: 'Voorgoed weg', teken: 'ingrijp', sig: 'incident',
            doe: function () { return roep('weg', { id: id }); }, na: B.laad
          }), K.overnemen(naam)]
        };
      }
      return {
        titel: naam,
        rechts: [K.server({
          naam: 'Prullenbak', teken: 'archief',
          doe: function () { return roep('weg', { id: id }); },
          terug: function () { return roep('herstel', { id: id }); },
          melding: naam + ' ligt in de prullenbak', na: B.laad
        })],
        links: [
          K.server({
            naam: ster ? 'Ster eraf' : 'Ster', teken: 'rahul', sig: ster ? null : 'aandacht',
            doe: function () { return roep('wijzig', { id: id, ster: !ster }); },
            terug: function () { return roep('wijzig', { id: id, ster: ster }); },
            melding: ster ? 'De ster is eraf' : naam + ' heeft een ster', na: B.laad
          }),
          K.overnemen(naam)
        ]
      };
    });
  }

  if (window.RTGGebaar) start();
  else document.addEventListener('rtg-gebaar', start, { once: true });
})();
