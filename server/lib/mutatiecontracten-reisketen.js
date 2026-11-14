/* Contracten van de lokale federatieve reisketen, in het bestaande register.
   PROTECTED betreft alleen herhaling, niet operationele/productievrijgave.
   Externe acceptatie, settlement en Deep Green blijven NO-GO. */
'use strict';
const OP = '2026-11-11';
const AF = { door: 'Codex, bronreview en gerichte ketenkernproeven; geen menselijke of externe aftekening', op: OP };
const eigen = { klasse: 'OBJECT_SCOPED', objectVeld: 'ref' };
const lees = (id, wat) => ({ mutatieId: id, herkomst: 'mens', semantiek: { klasse: 'idempotent' },
  toegang: eigen, stand: 'NOT_APPLICABLE', bewijs: { gemeten: 'test/reisbureau-keten.test.js: ' + wat, op: OP },
  nagekeken: 'Codex: routes lezen positieve projecties via ketenopslag.lees; die callback wijzigt geen collectie, roept geen provider en verplaatst geen geld.', afgetekend: AF });
const beschermd = (id, wat) => ({ mutatieId: id, herkomst: 'mens', semantiek: { klasse: 'idempotent' },
  toegang: eigen, stand: 'PROTECTED', bewijs: { gemeten: 'test/reisbureau-keten.test.js: ' + wat, op: OP }, afgetekend: AF });
const nazorg = (id, wat) => ({ ...beschermd(id, wat), bewijs: {
  gemeten: 'test/reisketen-nazorg.test.js: echte lokale HTTP/SQLite, ' + wat, op: OP } });
const CONTRACTEN = {
  'POST /api/reisbureau/keten': lees('reisketen.mijn', 'twee leden krijgen uitsluitend eigen reisprojecties'),
  'POST /api/reisbureau/keten/start': { ...beschermd('reisketen.start', 'twee gelijktijdige starts met dezelfde sleutel bewaren één aanvraag; andere inhoud geeft 409'), toegang: { klasse: 'AUTHENTICATED', deur: 'auth + persoonlijke bediening + gegevensStop' } },
  'POST /api/reisbureau/keten/akkoord': beschermd('reisketen.akkoord', 'exacte versie, offertehash en termijn; geaccepteerde offerte kan niet worden overschreven'),
  'POST /api/reisbureau/keten/betaal': beschermd('reisketen.betaal', 'parallelle retries en crash vóór/na ledger houden één economische sleutel en één betaalgebeurtenis'),
  'POST /api/reisbureau/keten/nazorg': nazorg('reisketen.nazorg', 'eigen reiziger en exacte offerte; replay/herstart bewaren één vraag, afwijkende inhoud en overlap weigeren; reis en geld blijven staan'),
  'POST /api/office/reisbureau/keten': lees('reisketen.kantoor', 'RTG ziet geen reis van het onafhankelijke bureau'),
  'POST /api/office/reisbureau/keten/offerte': beschermd('reisketen.kantoor.offerte', 'exacte versie en opgeslagen ontvangstsleutel voorkomen lost update en dubbele gebeurtenis'),
  'POST /api/office/reisbureau/keten/nazorg/antwoord': nazorg('reisketen.kantoor.nazorg', 'alleen eigen RTG-vraag; antwoordreplay is onveranderlijk en verleent geen uitvoerings- of financieel recht'),
  'POST /api/office/reisbureau/keten/afronden': beschermd('reisketen.kantoor.afronden', 'afsluiten weigert zonder settlementbewijs en verandert geen rij; dit bewijst uitsluitend de blokkade'),
  'POST /api/supplier/reisbureau/keten': lees('reisketen.partner', 'eigen org en zaakcode zijn beide vereist'),
  'POST /api/supplier/reisbureau/keten/offerte': beschermd('reisketen.partner.offerte', 'dezelfde ketenproef voor de onafhankelijke verkoper; RTG kan diens offerte niet muteren'),
  'POST /api/supplier/reisbureau/keten/nazorg/antwoord': nazorg('reisketen.partner.nazorg', 'alleen eigen bureau; stale versie en idemconflict weigeren, antwoord niet overschrijfbaar, geen juridische goedkeuring of geldhandeling'),
  'POST /api/supplier/reisbureau/keten/afronden': beschermd('reisketen.partner.afronden', 'levering wordt nooit fictief financiële afsluiting; herhaalde weigering verandert geen rij'),
  'POST /api/supplier/reisbureau/opdrachten': lees('reisketen.opdrachten', 'aanbieder ziet uitsluitend eigen opdrachten, geen klantkey of marges'),
  'POST /api/supplier/reisbureau/opdracht/besluit': beschermd('reisketen.opdracht.besluit', 'een tweede besluit wijzigt geen geaccepteerde opdracht; weigering blokkeert inning')
};
module.exports = { CONTRACTEN };
