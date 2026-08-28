/* DE SALON: de acties die aan een post hangen (shared/gebaar.js).

   VIERDE DOMEIN, EN HET EERSTE WAAR NIET ELKE ACTIE DE REGEL WEGHAALT. Dat
   verschil bepaalt hier alles.

   Archiveren, verbergen en verwijderen halen een post uit je tijdlijn, dus die
   lopen via KLAAR.server: de regel klapt meteen in, de server volgt, en gaat het
   mis dan komt hij terug met de reden. Bewaren doet dat NIET -- een bewaarde post
   blijft gewoon staan -- dus die zou met KLAAR.server een regel laten inklappen
   die daarna weer opduikt. Daarvoor is KLAAR.eigenKnop: de veeg drukt de knop in
   die op de regel zelf al staat. Zo blijft er EEN waarheid over wat bewaren doet,
   en die staat in salon.html en niet hier.

   WAT JE MAG, HANGT AF VAN WIENS POST HET IS. Op je eigen post kun je
   archiveren en verwijderen; op die van iemand anders kun je verbergen -- dat is
   iets anders en het heet hier ook anders. Verbergen en archiveren zijn allebei
   een schakelaar met `aan`, dus allebei echt omkeerbaar. Verwijderen is dat niet
   (salon.verwijder haalt de post echt weg), dus die krijgt geen `terug` en wordt
   vanzelf een borg: alleen op vasthouden.

   DE FEED IS EEN BLADERENDE LIJST, en dat maakt de waarnemer van RTGGebaar.lijst
   hier belangrijker dan elders: er komen voortdurend posts bij. De laag merkt ze
   zelf; dit bestand hoeft alleen te zeggen WAT er onder een post ligt. */
(function () {
  'use strict';

  function start() {
    var S = window.RTGSalon, G = window.RTGGebaar;
    if (!S || !G) return;
    var K = G.klaar;

    /* De api van dit scherm WERPT al bij een fout (hij leest {error} en gooit),
       dus hier hoeft niets vertaald te worden -- anders dan bij de kluis en het
       notitiebord. Dat staat hier zodat de volgende lezer niet gaat zoeken naar
       een vertaling die er niet is. */
    function roep(pad, body) { return S.api('/api/salon/' + pad, body); }
    function naam(p) {
      var t = (p.text || '').trim().replace(/\s+/g, ' ');
      if (t) return t.length > 40 ? t.slice(0, 39) + '…' : t;
      return 'Post van ' + (p.author || 'De Salon');
    }
    /* Een schakelaar heen en terug over dezelfde route. */
    function schakel(p, pad, naarAan, opschrift, gedaan, teken, sig) {
      return K.server({
        naam: opschrift, teken: teken, sig: sig || null,
        doe: function () { return roep(pad, { id: p.id, aan: naarAan }); },
        terug: function () { return roep(pad, { id: p.id, aan: !naarAan }); },
        melding: gedaan + ' · ' + naam(p), na: S.herlaad
      });
    }

    G.lijst(document.getElementById('main'), 'article.post[data-post]', function (rij) {
      var p = S.post(rij.getAttribute('data-post'));
      if (!p) return null;

      /* Bewaren laat de post staan, dus dit drukt de knop in die er al is --
         inclusief zijn aria-pressed, zodat de veeg en de knop nooit uiteen
         kunnen lopen. */
      var links = [
        K.eigenKnop(p.bewaard ? 'Niet meer bewaren' : 'Bewaren', 'rahul', '[data-bewaar]'),
        K.eigenKnop('Reacties', 'openen', '[data-reacties]')
      ];

      var rechts = [];
      if (p.vanMij) {
        rechts.push(p.gearchiveerd
          ? schakel(p, 'archiveer', false, 'Terugzetten', 'Terug in je tijdlijn', 'gereed')
          : schakel(p, 'archiveer', true, 'Archiveren', 'Gearchiveerd', 'archief'));
        /* Geen `terug`, dus de laag maakt er vanzelf een vasthouden van. */
        rechts.push(K.server({
          naam: 'Verwijderen', teken: 'ingrijp', sig: 'incident',
          doe: function () { return roep('weg', { id: p.id }); },
          melding: 'Verwijderd · ' + naam(p), na: S.herlaad
        }));
      } else {
        rechts.push(schakel(p, 'verberg', true, 'Verbergen', 'Verborgen', 'archief'));
      }

      return { titel: naam(p), links: links, rechts: rechts };
    });
  }

  if (window.RTGGebaar) start();
  else document.addEventListener('rtg-gebaar', start, { once: true });
})();
