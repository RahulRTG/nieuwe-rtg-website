/* DE SCHADUWMETING VAN DE KANTOORDEUR (server/kern/kantoor/mensdeur.js).

   Waarom deze toetsen bestaan: de anonieme tak is end-to-end bewezen tegen een
   draaiende server (vier kantoorverzoeken met de gedeelde code gaven exact
   3x /api/office/state en 1x /api/office/verifications in de opslag). De tak
   die WEL een mens ziet loopt in de testomgeving door een inlogketen die daar
   geen echt account heeft, en "het is dezelfde regel met een andere boolean" is
   precies het soort aanname dat stil fout gaat. Vandaar hier, op unit-niveau.

   De vier eigenschappen die niet mogen sneuvelen:

     1 hij TELT BEIDE KANTEN. Een meter die alleen anoniem kan tellen, meet niet
       of het beter wordt -- en dan lijkt elke verbetering op stilstand.
     2 hij HOUDT NIETS TEGEN. Er is geen tak in dat bestand die een verzoek
       weigert; dat is de hele reden dat een schaduwmeting mag draaien op 460
       routes waar het dagelijkse werk op loopt.
     3 hij is een TELLER EN GEEN JOURNAAL. Geen wie, geen wanneer, geen
       volgorde. KOSTEN.md trekt die grens voor leden en KANTOOR.md par. 11.3
       zet hem voor personeel strenger. Deze toets bewaakt hem machinaal, want
       een grens die alleen in een kop staat, sneuvelt bij de eerste "even".
     4 de QUERYSTRING gaat eraf. /api/office/doc?token=... is een echt pad in
       dit huis (public/apps/backoffice/backoffice-01.js); een meting die de
       query meeneemt, bewaart tokens.
     5 een GEWEIGERD verzoek telt niet. Gevonden in de proef tegen een echte
       server: officeAuth draait VOOR de strengere poorten, dus een anonieme
       sessie komt langs de teller op een route die daarna alsnog 403 geeft.
       /api/office/mensdeur belandde daardoor op de werklijst "wordt anoniem
       gebruikt" terwijl hij juist al dicht zit -- en aan het getal zie je dat
       niet, want het ziet er precies zo uit als een echte uitvoering. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { maakMensdeur, MAX_PADEN } = require('../server/kern/kantoor/mensdeur');

function opzet(opties) {
  const db = { data: {} };
  let bewaard = 0;
  const m = maakMensdeur(Object.assign({ db, save: () => { bewaard += 1; } }, opties || {}));
  return { db, m, saves: () => bewaard };
}
/* Een nep-response die `finish` meteen vuurt: de teller hangt daaraan, want er
   wordt pas geteld als het verzoek werkelijk is uitgevoerd (zie mensdeur.js).
   `status` laat een toets een geweigerd verzoek naspelen. */
function antwoord(status) {
  const luisteraars = [];
  return {
    statusCode: status || 200,
    on(gebeurtenis, fn) { if (gebeurtenis === 'finish') luisteraars.push(fn); },
    klaar() { for (const fn of luisteraars) fn(); }
  };
}
const verzoek = (url) => ({ originalUrl: url });
/* tel + afronden in een: elke toets hieronder meet een UITGEVOERD verzoek. */
function doe(m, url, heeftMens, status) {
  const res = antwoord(status);
  m.tel(verzoek(url), res, heeftMens);
  res.klaar();
}

test('1. telt beide kanten apart', () => {
  const { m } = opzet();
  doe(m, '/api/office/state', false);
  doe(m, '/api/office/state', false);
  doe(m, '/api/office/state', true);
  const s = m.stand();
  assert.equal(s.verzoeken, 3);
  assert.equal(s.beide, 1, 'een route die beide ziet hoort in de bak `beide`');
  assert.equal(s.alleenAnoniem, 0);
  const rij = Object.values(s.werklijst).concat(s.kanNuAlDicht);
  assert.equal(rij.length, 0, 'een route met beide soorten staat op geen van beide werklijsten');
});

test('2. scheidt alleen-anoniem van alleen-op-naam', () => {
  const { m } = opzet();
  doe(m, '/api/office/anoniem-pad', false);
  doe(m, '/api/office/op-naam-pad', true);
  const s = m.stand();
  assert.equal(s.alleenAnoniem, 1);
  assert.equal(s.alleenOpNaam, 1);
  assert.equal(s.werklijst[0].pad, '/api/office/anoniem-pad',
    'de werklijst is wat er nog anoniem gebeurt');
  assert.equal(s.kanNuAlDicht[0].pad, '/api/office/op-naam-pad',
    'een route die alleen op naam wordt gebruikt, kan vandaag al dicht');
});

test('3. de querystring gaat eraf -- een meting bewaart geen tokens', () => {
  const { m } = opzet();
  doe(m, '/api/office/doc?token=geheim123&file=paspoort.jpg', false);
  const s = m.stand();
  assert.equal(s.werklijst[0].pad, '/api/office/doc');
  const alles = JSON.stringify(s);
  assert.ok(!alles.includes('geheim123'), 'het token staat in de uitslag');
  assert.ok(!alles.includes('paspoort'), 'de bestandsnaam staat in de uitslag');
});

test('4. een teller en geen journaal: geen wie, geen wanneer, geen volgorde', () => {
  const { db, m } = opzet();
  doe(m, '/api/office/state', false);
  m.spoel();   // tikken staan tot dan in de RAM-buffer; zie de kop van mensdeur.js
  const rij = Object.values(db.data.kantoorMensdeur)[0];
  assert.deepEqual(Object.keys(rij).sort(), ['metMens', 'pad', 'zonderMens'],
    'er staat een veld in de opslag dat er niet hoort: een tijdstempel of een sleutel per ' +
    'waarneming maakt hier een gedragslogboek van (KANTOOR.md par. 11.3)');
});

test('5. het plafond houdt de opslag begrensd bij verzonnen paden', () => {
  const { db, m } = opzet();
  for (let i = 0; i < MAX_PADEN + 25; i++) doe(m, '/api/office/verzin-' + i, false);
  m.spoel();
  const sleutels = Object.keys(db.data.kantoorMensdeur);
  assert.ok(sleutels.length <= MAX_PADEN + 1,
    'boven het plafond hoort alles in `overig` te landen, anders laat een vreemde de opslag groeien');
  assert.ok(sleutels.includes('overig'), 'de restbak ontbreekt');
});

test('6. niet-api-paden worden niet geteld', () => {
  const { m } = opzet();
  doe(m, '/apps/backoffice.html', false);
  assert.equal(m.stand().verzoeken, 0);
});

test('7. de uitslag draagt haar eigen grens', () => {
  const { m } = opzet();
  const s = m.stand();
  assert.ok(/teller en geen journaal/i.test(s.grens),
    'de uitslag hoort te zeggen wat zij NIET bewaart');
  assert.ok(/niet aangeroepen/i.test(s.grens),
    'een route die ontbreekt is niet gemeten, en dat is iets anders dan "nooit anoniem gebruikt"');
  assert.ok(!('percentage' in s) && !('score' in s),
    'geen samengesteld cijfer: drie bakken die verschillend werk betekenen (BEWIJSMACHINE.md)');
});

test('8. een geweigerd verzoek telt niet -- de deur deed zijn werk', () => {
  const { m } = opzet();
  doe(m, '/api/office/alleen-boardroom', false, 403);
  doe(m, '/api/office/bestaat-niet', false, 404);
  doe(m, '/api/office/geen-sessie', false, 401);
  assert.equal(m.stand().verzoeken, 0,
    'een 401/403/404 is een deur die zijn werk deed, geen anoniem uitgevoerde handeling');
  doe(m, '/api/office/state', false, 200);
  doe(m, '/api/office/omgeleid', false, 302);
  assert.equal(m.stand().verzoeken, 2, '2xx en 3xx tellen wel');
});

test('9. de meting houdt nooit een antwoord tegen', () => {
  const { m } = opzet();
  /* Een res die bij het opslaan ontploft: de telling zit in een try, dus het
     antwoord van de gebruiker mag er niet aan kapotgaan. */
  const stuk = maakMensdeur({ db: { data: {} }, save: () => { throw new Error('opslag stuk'); } });
  const res = antwoord(200);
  stuk.tel(verzoek('/api/office/state'), res, false);
  assert.doesNotThrow(() => res.klaar(), 'een kapotte meting mag het verzoek niet meeslepen');
  /* en zonder res doet hij niets in plaats van te klappen */
  assert.doesNotThrow(() => m.tel(verzoek('/api/office/state'), null, false));
});

test('10. lezen schept niets -- stand() legt de collectie niet aan', () => {
  const { db, m } = opzet();
  const s = m.stand();
  assert.equal(s.verzoeken, 0, 'een lege meting is nul verzoeken');
  assert.ok(!('kantoorMensdeur' in db.data),
    'stand() heeft de collectie aangelegd. De kop van kern/eigencollectie.js verbiedt dat: ' +
    'een leesweg achter bak() schrijft leeg meubilair weg bij een verzoek dat op 403 eindigt, ' +
    'en dan zegt de statuscode iets anders dan de opslag. Opzoeken doet kijk().');
});

/* ============================================================================
   DE SCHRIJFWEG. Deze vier bestaan omdat de eerste versie in res.on('finish')
   db.data muteerde en save() riep -- de PostgreSQL-opstelling werd daarvan
   onherstelbaar niet-ready (writeHealthy: false, elk verzoek 503), en 11
   geslaagde integratietoetsen werden er 1. De reden staat in kern/kosten/
   meter.js: een moment zonder requestcommit mag nooit eerst de levende db.data
   muteren en daarna save() roepen. */

test('11. tellen doet geen I/O -- pas het spoelen schrijft', () => {
  const { db, m, saves } = opzet();
  doe(m, '/api/office/state', false);
  assert.equal(saves(), 0, 'er is geschreven in het pad van een verzoek');
  assert.ok(!('kantoorMensdeur' in db.data), 'de opslag is aangeraakt voor het spoelen');
  m.spoel();
  assert.equal(saves(), 1);
});

test('12. het spoelen gaat door het collectieslot als dat er is', () => {
  let viaSlot = null;
  const { m, saves } = opzet({
    bewerkCollectie: (sleutel, werk) => { viaSlot = sleutel; werk({}); }
  });
  doe(m, '/api/office/state', false);
  m.spoel();
  assert.equal(viaSlot, 'kantoorMensdeur',
    'het spoelen omzeilde bewerkCollectie -- dat is precies de weg die PostgreSQL sluit');
  assert.equal(saves(), 0, 'naast het collectieslot is ook nog save() geroepen');
});

test('13. een mislukte spoeling verliest geen tikken', () => {
  const { m } = opzet({
    bewerkCollectie: () => { throw new Error('opslag even weg'); }
  });
  doe(m, '/api/office/state', false);
  doe(m, '/api/office/state', true);
  assert.equal(m.spoel(), false, 'een mislukte spoeling hoort false te geven');
  /* De tikken staan nog in de buffer, dus de uitslag kent ze nog steeds. Een
     teller die stilletjes tikken weggooit, meet iets anders dan hij zegt. */
  assert.equal(m.stand().verzoeken, 2, 'tikken verdwenen bij een mislukte spoeling');
});

test('14. lezen projecteert de buffer, maar schrijft hem niet weg', () => {
  const { db, m, saves } = opzet();
  doe(m, '/api/office/state', false);
  const s = m.stand();
  assert.equal(s.verzoeken, 1, 'de nog niet gespoelde tik hoort al zichtbaar te zijn');
  assert.equal(saves(), 0, 'lezen werd een verborgen schrijfactie');
  assert.ok(!('kantoorMensdeur' in db.data), 'lezen heeft de collectie aangelegd');
});
