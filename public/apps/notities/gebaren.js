/* RTG Notities: de acties die aan een kaart hangen (shared/gebaar.js).

   HET DERDE DOMEIN MET EEN VEEG DIE DE SERVER RAAKT, en het eerste waar de twee
   soorten actie naast elkaar liggen: een omkeerbare en een die dat niet is.

   Archiveren is de la. `bewaar {archief:true}` legt hem erin en `{archief:false}`
   haalt hem eruit -- dezelfde route, andere stand, dus een echte weg terug. Het
   scherm zegt bij die knop al met zoveel woorden "Gearchiveerd; niets is weg",
   en de veeg belooft niets anders.

   Weggooien is dat NIET. server/kern/notities.js gooit de notitie echt uit het
   bord (en neemt een gekoppelde agenda-afspraak mee), dus er is geen tegenactie
   om aan te roepen. Die actie krijgt hier dan ook geen `terug` -- en daarmee
   maakt de laag er vanzelf een borg van: vasthouden in plaats van vegen. Dat
   komt niet uit een keuze hier maar uit het ontwerp, en het is de enige eerlijke
   uitkomst: een knop "Terugdraaien" die niets terugdraait is erger dan geen knop.

   ALLEEN HET EIGEN BORD. Vastpinnen en archiveren horen bij de EIGENAAR (zie de
   kern), en een gedeelde notitie "weggooien" betekent iets anders: jezelf van de
   lijst halen. Dat is een ander besluit met een andere weg terug -- de eigenaar
   moet je opnieuw uitnodigen -- en dat hoort niet onder dezelfde veeg als
   opruimen. Het gedeelde bord houdt dus zijn knoppen.

   Apart bestand: zelfde reden als bij apps/bestanden/gebaren.js en
   apps/rtmail/gebaren.js. */
(function () {
  'use strict';

  function start() {
    var N = window.RTGNotities, G = window.RTGGebaar;
    if (!N || !G) return;
    var K = G.klaar;

    /* De api van dit scherm WERPT NIET: hij geeft {status, body} terug, ook bij
       een fout. De laag verwacht een Promise die afwijst, want daar hangt het
       terugzetten van de kaart aan. Hier wordt dat vertaald, op EEN plek. */
    function roep(pad, body) {
      return N.api(pad, body).then(function (r) {
        var f = r.body && r.body.error;
        if (f || r.status >= 400) throw new Error(f || 'Dat lukte niet.');
        return r.body;
      });
    }
    function naam(n) { return (n && n.titel) || 'Deze notitie'; }
    function alsTekst(n) {
      var stuk = [naam(n)];
      if (n.tekst) stuk.push(n.tekst);
      if (n.items && n.items.length) {
        stuk.push(n.items.map(function (x) { return (x.af ? '[x] ' : '[ ] ') + x.t; }).join('\n'));
      }
      return stuk.join('\n');
    }
    /* Een stand heen en terug via dezelfde route. `van` is de stand waar de
       notitie NU in staat, zodat terugdraaien echt terugdraait en niet een
       aanname over waar hij vandaan kwam. */
    function stand(n, veld, naarStand, opschrift, gedaan, teken, sig) {
      var was = !!n[veld];
      var heen = {}; heen.id = n.id; heen[veld] = naarStand;
      var terug = {}; terug.id = n.id; terug[veld] = was;
      return K.server({
        naam: opschrift, teken: teken, sig: sig || null,
        doe: function () { return roep('bewaar', heen); },
        terug: function () { return roep('bewaar', terug); },
        melding: gedaan + ' · ' + naam(n), na: N.laad
      });
    }

    G.lijst(document.getElementById('bord'), '.nkaart[data-open]', function (rij) {
      var n = N.notitie(rij.getAttribute('data-open'));
      if (!n) return null;

      /* Geen `terug`, dus de laag maakt er vanzelf een vasthouden van. */
      var weggooien = K.server({
        naam: 'Weggooien', teken: 'ingrijp', sig: 'incident',
        doe: function () { return roep('weg', { id: n.id }); },
        melding: 'Weggegooid · ' + naam(n), na: N.laad
      });

      if (N.archief()) {
        return {
          titel: naam(n),
          rechts: [stand(n, 'archief', false, 'Terug op het bord', 'Terug op het bord', 'gereed'), weggooien],
          links: [K.overnemen(alsTekst(n))]
        };
      }
      return {
        titel: naam(n),
        rechts: [stand(n, 'archief', true, 'Archiveren', 'Gearchiveerd', 'archief'), weggooien],
        links: [
          stand(n, 'vast', !n.vast, n.vast ? 'Losmaken' : 'Vastpinnen',
            n.vast ? 'Losgemaakt' : 'Vastgepind', 'rahul', n.vast ? null : 'aandacht'),
          K.overnemen(alsTekst(n))
        ]
      };
    });
  }

  if (window.RTGGebaar) start();
  else document.addEventListener('rtg-gebaar', start, { once: true });
})();
