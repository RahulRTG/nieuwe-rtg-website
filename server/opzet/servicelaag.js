/* ============================================================================
   RTG SERVICE OPHANGEN -- en waarom dat een eigen bestand is.

   Dezelfde reden als ./theater.js en ./weefseldraden.js: het is een eigen
   onderwerp, en ./kernlaag7.js ging er met 13,6 KB mee over de omvangsgrens van
   keuringsregel 13. De naad ligt hier bovendien op een echte grens -- dit blok
   raakt niets van de gegevenspoort, Rahul of het Foundation OS eromheen; het
   hangt een laag op en legt er twee draden naartoe.

   DRIE DINGEN GEBEUREN HIER, EN ALLE DRIE ZIJN HET DRADEN NAAR IETS DAT ER AL
   WAS. Dat is de hele gedachte achter deze laag: RTG had vier hulplijnen die
   elk werkten, en geen gedeelde envelop eromheen (zie kern/service/klassen.js).

     1. de laag zelf, met een melding die naar een LID gaat en niet naar een pas;
     2. de haak naar de chat van Rahul, laat gebonden;
     3. de envelop om een klacht van de ledenbalie.
   ========================================================================== */
'use strict';

const { idVanKey } = require('../lib/lidsleutel');

/* De laag ophangen. `melden` gaat naar het LID: notify() uit ./meldingen.js
   stuurt naar een hele pas, en een servicebericht is persoonlijk -- alleen
   sendPushToUser wijst een account aan. Ontbreekt hij, dan meldt deze laag
   niets en valt er niets om: de levering van een melding gaat nooit voor het
   bestaan van de zaak (kern/envelop.js, dezelfde afweging). */
function hangOp(kern, hulp) {
  const accounts = hulp.accounts;
  const { db, save, crypto } = hulp;
  Object.assign(kern, require('../kern/service')({
    db, save, crypto,
    inzagelog: require('../inzagelog'),
    /* DE KLUIS GAAT MEE, EN MAAR VOOR EEN DING: de mailingang moet een adres
       kunnen terugvoeren op een codenaam (kern/service/post.js). Dat is het
       besluit van de eigenaar en niet een gemak -- de prijs ervan, een leesweg
       naar de kluis met reden en journaalregel, staat in die module
       uitgeschreven. Geen enkele andere module in deze laag krijgt hem. */
    accounts,
    /* De twee live-kanalen voor het bellen. Deze laag legt zelf geen verbinding
       aan: zij geeft WebRTC-signalen door en kijkt niet in het pakket. */
    sseToCustomer: hulp.sseToCustomer, sseToOffice: hulp.sseToOffice,
    notify: (melderKey, bericht) => {
      const id = idVanKey(melderKey);
      if (id == null || typeof hulp.sendPushToUser !== 'function') return;
      hulp.sendPushToUser(id, { title: bericht.titel, body: bericht.tekst, tag: 'service-' + bericht.zaak });
    }
  }));

  /* DE MAILINGANG AANZETTEN. kern/mailaanname.js is opgezet voordat deze laag
     bestond en kent `hulp@` daarom pas vanaf hier. Zonder deze regel valt de
     mailkant terug op "dit adres bestaat hier niet" -- geweigerd met een reden,
     en dat is de juiste terugval. */
  if (kern.mailAanname && typeof kern.mailAanname.zetServicePost === 'function') {
    kern.mailAanname.zetServicePost(kern.servicePost);
  }

  /* DE HAAK TERUG NAAR DE CHAT. kern/ai.js zette voor de RTG Pass hard
     `needsConcierge = false` en had daarmee geen enkele uitweg naar een mens.
     Die regel klopt nog steeds -- de RTG Pass krijgt De Rechterhand niet -- maar
     een lid dat om een MENS vraagt hoort ergens uit te komen. Vanaf hier doet
     hij dat: het verzoek wordt een servicezaak bij het team Leden, en de
     concierge-inbox van Lifestyle en Business blijft onaangeroerd.

     De zetter zit in `hulp` en niet in `kern`: de AI-laag hoort niet vanuit een
     router aan te zetten te zijn. Laat gebonden omdat maakAi() in server.js
     draait voordat deze laag bestaat -- zonder deze regel valt de chat terug op
     het oude gedrag, en kern/ai.js schrijft dan een fout in het logboek in
     plaats van te zwijgen (test/servicemens.test.js). */
  if (typeof hulp.zetServiceOverdracht === 'function') {
    hulp.zetServiceOverdracht((user, tekst) => {
      const melderKey = 'user-' + user.id;
      /* Een LOPENDE zaak hergebruiken. Wie drie keer om een mens vraagt, hoort
         drie regels in een tijdlijn te krijgen en geen drie zaken: dan staat
         dezelfde vraag drie keer in de wachtrij en denkt elk van de drie
         medewerkers dat een ander hem al oppakt. */
      const lopend = kern.serviceZaken.lijst({ melder: melderKey, alleenOpen: true, max: 1 })[0];
      const zaak = lopend || (kern.serviceZaken.open({
        melder: melderKey, doelgroep: 'lid', soort: 'ondersteuning', kanaal: 'app',
        titel: String(tekst).slice(0, 110) || 'Vraag uit de chat',
        tekst: String(tekst), bron: 'chat'
      }).zaak);
      if (zaak) kern.serviceLoop.mensVraag(zaak.id, { tier: user.tier, tekst: String(tekst) });
    });
  }
}

/* DE ENVELOP OM EEN KLACHT. Een functie en geen verwijzing, want de ledenbalie
   wordt opgehangen VOOR deze laag bestaat. De klacht blijft van de balie: een
   servicezaak kan opgelost worden terwijl de klacht nog onderzoek, oordeel en
   maatregel voor zich heeft (kern/ledenbalie-zaken.js legt uit waarom dat twee
   objecten zijn en geen twee statussen). */
function envelopVoorBalie(kern) {
  const ONDERWERP = { reis: 'reis', betaling: 'betaling', app: 'app', partner: 'zaak' };
  return (klacht) => {
    if (!kern.serviceZaken || !kern.serviceLoop) return null;
    const r = kern.serviceZaken.open({
      melder: 'user-' + klacht.lidId, doelgroep: 'lid', soort: 'klacht', kanaal: 'balie',
      onderwerp: ONDERWERP[klacht.soort] || 'anders',
      titel: String(klacht.tekst).slice(0, 110), tekst: klacht.tekst, bron: 'balie'
    });
    if (!r || !r.zaak) return null;
    kern.serviceLoop.koppel(r.zaak.id, { soort: 'klacht', code: klacht.id, door: klacht.door });
    return r.zaak.id;
  };
}

module.exports = { hangOp, envelopVoorBalie };
