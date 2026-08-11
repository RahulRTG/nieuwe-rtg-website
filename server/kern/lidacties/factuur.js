/* Lidacties (deelmodule): EEN LIDTRANSACTIE WORDT EEN FACTUUR.

   ELKE BETAALDE TRANSACTIE HOORT EEN FACTUUR TE HEBBEN, en die van het lid
   hadden er geen.

   De facturatiemotor (kern/facturatie/) belooft in zijn eigen kop dat er bij
   ELKE transactie een tweezijdige factuur komt, en de kassa, de retail, de
   verhuur en het vastgoed hielden zich daaraan. De transacties van het LID --
   een bestelling, een rekening, een boeking, een rit -- deden dat niet, en de
   twee kassawegen waarlangs zo'n bestelling alsnog wordt afgerekend evenmin.
   Dat viel niet op omdat niemand ernaar keek, tot de btw-aangifte kwam: die
   telt het FACTUURREGISTER, en omzet zonder factuur staat er dus niet in. De
   aangifte zei dat eerlijk ("omzet zonder factuur staat er niet in"), maar dat
   is een pleister op deze oorzaak (LAT.md regel 1). Dit is de oorzaak.

   HET STAAT HIER EN NIET ZES KEER, want zes plekken die elk zelf bedenken hoe
   een bon een factuur wordt, is zes keer een andere factuur (LAT.md regel 4).
   De aanroepers:
     ./bestellen.js         het lid betaalt zijn bestelling in de app
     ./rekening.js          het lid rekent aan het eind zijn hele rekening af
     ./ritten.js            het lid betaalt zijn rit of vlucht
     ../lidacties.js        het lid betaalt zijn boeking (een dienst)
     routes/.../verkoop.js  de zaak int de bon aan de balie op de ophaalcode
     routes/.../afrekenen.js  de zaak rekent een heel tafelticket af

   Een factuur wordt geboekt op het moment dat er ECHT is betaald -- niet bij
   het plaatsen, niet bij het bevestigen -- en precies EEN keer: elke aanroeper
   staat binnen zijn eigen "was nog niet betaald"-tak.

   STIL BIJ EEN FOUT, MAAR NIET ONGEZIEN. Een factuur die niet lukt mag een
   betaling die al gedaan is nooit terugdraaien -- de klant heeft betaald, dat
   staat. Maar hij gaat wel naar de fout-aggregatie (server/log.js), dus naar
   het techniekbord: een factuur die stilletjes wegvalt is precies het gat dat
   dit repareert, en dat gat een tweede keer graven zou de reparatie opheffen.
   console.error zou hier NIET voldoen -- dat schrijft alleen naar de stroom en
   wordt nergens geteld.

   Twee manieren waarop het misgaat en ze worden allebei gemeld: de motor kan
   ONTPLOFFEN (een afgewezen belofte) en hij kan NEE ZEGGEN ({ error: ... },
   bijvoorbeeld bij een bon van nul euro). Dat tweede is geen uitzondering, dus
   er wordt er een van gemaakt -- anders valt juist de nette weigering weg. */
'use strict';
const { log } = require('../../log');

/* De regels van een bon, in de vorm die de facturatiemotor verwacht. Dezelfde
   optelling als de maandboekhouding (kern/fiscaal/index.js) over dezelfde bon:
   prijs maal aantal, inclusief btw. Wijkt dit af, dan wijkt de aangifte af van
   de boekhouding en is er geen kant waarvan je weet dat hij klopt. */
function regelsVanItems(items, naamloos) {
  return (Array.isArray(items) ? items : []).map(i => ({
    omschrijving: i.name || i.naam || naamloos || 'Artikel',
    aantal: i.qty || 1, stuk: i.price || i.prijs || 0
  }));
}

function maakFactuurVoorLid(facturatie) {
  function melden(ref, bericht) {
    try { log.uitzondering(new Error('factuur voor lid mislukt: ' + bericht), { bron: 'factuurVoorLid', ref }); }
    catch (e) { /* de melder zelf mag een betaling nooit omver trekken */ }
  }
  return function factuurVoorLid({ supplierCode, supplierNaam, codenaam, regels, methode, ref, soort }) {
    if (!facturatie || !supplierCode) return;
    try {
      const p = facturatie.boekMetCodenaam({
        soort: soort || 'verkoop', verkoperCode: supplierCode, verkoperNaam: supplierNaam,
        koper: { codenaam }, regels, methode: methode || 'rtg', ref
      }, codenaam);
      if (p && typeof p.then === 'function')
        p.then(r => { if (r && r.error) melden(ref, r.error); },
          e => melden(ref, (e && e.message) || String(e)));
    } catch (e) { melden(ref, (e && e.message) || String(e)); }
  };
}

module.exports = { maakFactuurVoorLid, regelsVanItems };
