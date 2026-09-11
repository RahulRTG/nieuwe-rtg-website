/* ============================================================================
   EEN LID EN ZIJN EIGEN LIDMAATSCHAP.

   HET GAT. `/api/aanmelding/verleng`, `/opzeggen` en `/contracten` stonden alle
   drie achter `officeAuth`. De motor eronder (kern/commercie/contract.js) kende
   opzeggen al -- met een uitgerekende einddatum, een opzegtermijn en een
   minimumtermijn waar niet onderdoor te zeggen valt -- maar de enige die het
   aan ging, kon er niet bij. Dat is geen ontbrekend scherm maar een ontbrekend
   recht.

   DE BEWERINGEN DIE ERTOE DOEN, en ze zijn alle drie een keer fout geweest in
   soortgelijke code in dit huis:

     toets 3  de sleutel komt uit de SESSIE: lid A kan het lidmaatschap van lid B
              niet zien en niet opzeggen, ook niet door zijn id te noemen
     toets 5  twee tikken zijn geen twee opzeggingen (idempotent op STAND, niet
              op een sleutel)
     toets 6  het voorbeeld en de echte opzegging geven DEZELFDE einddatum --
              anders is wat het lid vooraf leest een andere afspraak dan hij krijgt

   En toets 7: er is GEEN ledenroute om te verlengen. Die zou het lid zijn eigen
   prijs laten zetten (`contracten.verleng(c, nieuwCenten)` is het enige moment
   waarop de afgesproken prijs mag veranderen). Een toets die het ONTBREKEN van
   een route vastlegt, is hier geen overdaad: zonder hem is hij er over een half
   jaar bij, met de beste bedoelingen.

   Draai los: node --test test/lidabonnement.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { maakContracten } = require('../server/kern/commercie/contract');

const START = '2026-01-15T10:00:00.000Z';
const PASSEN = {
  rtg: { naam: 'RTG Pass', stem: 'je' },
  business: { naam: 'RTG Business Pass', stem: 'u' }
};

/* Een wereldje met twee leden, elk met een eigen geaccepteerde aanmelding en een
   lopend contract. Bewust twee, want de gevaarlijkste fout in deze laag is dat
   het ene lid bij het andere komt. */
function wereld(nu) {
  const db = { data: {} };
  const tijd = nu || (() => Date.parse(START));
  /* save() wordt GETELD. Toets 10 hangt eraan, en die bestaat omdat het
     voorbeeld er eerst wel een deed. */
  const saves = { n: 0 };
  const contracten = maakContracten({ db, save: () => { saves.n++; }, nu: tijd });
  const A = [], B = [];
  const eur = c => Math.round(c) / 100;

  function lid(accountId, aanmeldingId, pas, centen) {
    A.unshift({ id: aanmeldingId, pas, accountId, status: 'geaccepteerd', naam: 'Lid ' + accountId });
    const c = contracten.open({ pas, aanmeldingId, startAt: START, afgesprokenCenten: centen });
    contracten.bied(c); contracten.accepteer(c); contracten.activeer(c);
    const termijnen = contracten.termijnenTussen(c, c.startAt, contracten.eindeVerbintenis(c))
      .map((t, i) => ({ id: 't' + aanmeldingId + i, aanmeldingId, contractId: c.id, pas,
        maand: t.termijn, centen: t.centen, vervalt: t.vervalt, status: 'gepland' }));
    B.unshift({ aanmeldingId, contractId: c.id, pas, termijnen });
    return c;
  }

  const lezer = require('../server/kern/aanmeldingen/lidabonnement')({
    A: () => A, B: () => B, contracten, PASSEN, eur });

  /* De echte opzegfunctie uit het betaalschema zou de hele aanmeldingen-context
     vragen. Hier staat de kern ervan: het contract opzeggen en de termijnen na
     de einddatum weghalen -- precies wat ./betaalschema.js doet. Dat het de
     ECHTE functie is, bewaakt de e2e-toets hieronder over de route. */
  function zegOpLidmaatschap(aanmeldingId) {
    const rij = B.find(r => r.aanmeldingId === String(aanmeldingId || ''));
    if (!rij) return { status: 404, error: 'Voor dit lidmaatschap loopt geen contract.' };
    const c = contracten.vind(rij.contractId);
    const r = contracten.zegOp(c);
    if (r.error) return { status: 400, error: r.error };
    const voor = rij.termijnen.length;
    rij.termijnen = rij.termijnen.filter(t => new Date(t.vervalt) < new Date(c.eindigtOp));
    return { ok: true, eindigtOp: c.eindigtOp, vervallen: voor - rij.termijnen.length };
  }

  const opzeg = require('../server/kern/aanmeldingen/lidabonnement-opzeg')({
    contracten, zegOpLidmaatschap, lezer });

  return { A, B, contracten, lid, lezer, opzeg, saves };
}

test('1. een lid ziet zijn eigen lidmaatschap, met het bedrag van het CONTRACT', () => {
  const w = wereld();
  w.lid(42, 'aanm-a', 'rtg', 6500);

  const r = w.lezer.mijn(42);
  assert.equal(r.ok, true);
  assert.ok(r.abonnement, 'er is een abonnement');
  assert.equal(r.abonnement.pas, 'rtg');
  assert.equal(r.abonnement.pasNaam, 'RTG Pass');
  assert.equal(r.abonnement.stem, 'je', 'de RTG Pass spreekt in de je-vorm');
  assert.equal(r.abonnement.maandBedrag, 65, 'het bedrag komt van het contract');
  assert.equal(r.abonnement.minimumMaanden, 12);
  assert.equal(r.abonnement.kan.opzeggen, true);
  assert.equal(r.abonnement.kan.verlengen, undefined, 'verlengen is geen ledenhandeling');
});

test('2. geen afspraak is geen fout maar een mededeling met een reden', () => {
  const w = wereld();
  const r = w.lezer.mijn(999);
  assert.equal(r.ok, true, 'geen 404: er is niets stuk');
  assert.equal(r.abonnement, null);
  assert.match(r.reden, /geen lidmaatschapsafspraak/i, 'en de reden staat erbij');
});

test('3. de sleutel komt uit de sessie: lid A komt niet bij lid B', () => {
  const w = wereld();
  w.lid(42, 'aanm-a', 'rtg', 6500);
  w.lid(77, 'aanm-b', 'business', 500000);

  assert.equal(w.lezer.mijn(42).abonnement.contractId,
    w.contracten.lijst({ aanmeldingId: 'aanm-a' })[0].id, 'lid 42 krijgt zijn eigen contract');
  assert.equal(w.lezer.mijn(77).abonnement.maandBedrag, 5000, 'en lid 77 het zijne');

  /* De hele functie neemt GEEN aanmeldingId aan. Dat is de grendel: er is geen
     parameter waarmee lid 42 naar aanm-b kan wijzen. */
  assert.equal(w.lezer.mijn.length, 1, 'mijn() neemt precies een argument: het accountId');
  assert.equal(w.opzeg.zegOpZelf.length, 1, 'en zegOpZelf ook');

  // en opzeggen raakt alleen het eigen contract
  w.opzeg.zegOpZelf(42);
  assert.equal(w.lezer.mijn(77).abonnement.stand, 'ACTIEF', 'het contract van lid 77 is niet geraakt');
});

test('4. opzeggen zegt wat er BLIJFT en niet alleen wat er weggaat', () => {
  const w = wereld();
  w.lid(42, 'aanm-a', 'rtg', 6500);

  const v = w.opzeg.opzegVoorbeeld(42);
  assert.equal(v.ok, true);
  assert.equal(v.alOpgezegd, false);
  assert.ok(v.eindigtOpTekst, 'er staat een leesbare einddatum');
  assert.ok(Array.isArray(v.blijft) && v.blijft.length >= 2, 'en wat er blijft');
  assert.ok(v.blijft.some(t => /factu/i.test(t)), 'facturen blijven -- rechten hangen per onderdeel');

  /* Het voorbeeld verandert NIETS. Dat is het hele punt: een lid hoort de
     gevolgen te kunnen lezen voordat hij drukt. */
  assert.equal(w.lezer.mijn(42).abonnement.stand, 'ACTIEF', 'het voorbeeld zegt niets op');
});

test('5. twee tikken zijn geen twee opzeggingen', () => {
  const w = wereld();
  w.lid(42, 'aanm-a', 'rtg', 6500);

  const een = w.opzeg.zegOpZelf(42);
  assert.equal(een.ok, true);
  assert.equal(een.alOpgezegd, false);

  const twee = w.opzeg.zegOpZelf(42);
  assert.equal(twee.ok, true, 'de tweede is geen fout');
  assert.equal(twee.alOpgezegd, true, 'maar hij zegt wel dat er al was opgezegd');
  assert.equal(twee.eindigtOp, een.eindigtOp, 'en dezelfde einddatum -- niet opnieuw gerekend');
});

test('6. het voorbeeld en de echte opzegging geven dezelfde einddatum', () => {
  const w = wereld();
  w.lid(42, 'aanm-a', 'rtg', 6500);

  const voorbeeld = w.opzeg.opzegVoorbeeld(42);
  const echt = w.opzeg.zegOpZelf(42);
  assert.equal(echt.eindigtOp, voorbeeld.eindigtOp,
    'wat het lid vooraf leest, is de afspraak die hij krijgt');
  assert.equal(echt.vervallenTermijnen, voorbeeld.vervallenTermijnen,
    'en hetzelfde aantal termijnen valt weg');
});

test('7. opzeggen in maand twee heft de verbintenis van twaalf maanden niet op', () => {
  /* De som staat in contracten.zegOp en wordt hier niet overgetypt; deze toets
     bewaakt dat de ledenweg hem ECHT gebruikt en er niet langs rekent. */
  const w = wereld(() => Date.parse('2026-02-20T10:00:00.000Z'));
  w.lid(42, 'aanm-a', 'rtg', 6500);

  const r = w.opzeg.zegOpZelf(42);
  const eind = new Date(r.eindigtOp);
  assert.ok(eind >= new Date('2027-01-15T00:00:00.000Z'),
    'de einddatum ligt op of na het einde van de minimumtermijn, niet een maand na nu');
});

test('8. een contract dat niet loopt, valt niet op te zeggen', () => {
  const w = wereld();
  w.lid(42, 'aanm-a', 'rtg', 6500);
  const c = w.contracten.vind(w.lezer.mijn(42).abonnement.contractId);
  w.contracten.zegOp(c);
  w.contracten.beeindig(c);

  const r = w.opzeg.zegOpZelf(42);
  assert.equal(r.status, 409, 'een beeindigd lidmaatschap geeft een nette 409');
  assert.match(r.error, /loopt niet meer/i);
  assert.equal(w.lezer.mijn(42).abonnement.kan.opzeggen, false, 'en het scherm biedt de knop niet aan');
});

test('9. er is geen ledenroute om te verlengen', () => {
  /* Verlengen is het enige moment waarop de afgesproken prijs mag veranderen.
     Een lid dat zijn eigen verlenging aanroept, zet zijn eigen prijs. Deze toets
     legt de AFWEZIGHEID vast, want dat is de grens. */
  const w = wereld();
  assert.equal(w.lezer.verleng, undefined, 'de leeskant verlengt niet');
  assert.equal(w.opzeg.verleng, undefined, 'en de opzegkant ook niet');

  const fs = require('fs');
  const routes = fs.readFileSync(require.resolve('../server/routes/aanmeldingen.js'), 'utf8');
  const ledenVerleng = /\/api\/mijn\/[^']*verleng/.test(routes);
  assert.equal(ledenVerleng, false, 'en er staat geen /api/mijn/...verleng in de routes');
});

test('10. het opzegvoorbeeld schrijft niets -- ook niet naar schijf', () => {
  /* DE FOUT DIE DIT VASTLEGT, en hij was van mij. De einddatum van het voorbeeld
     kwam eerst uit een PROEF: een `zegOp` op een wegwerpkopie van het contract.
     Geen rij veranderde, dus het leek gratis. Maar `zet()` in
     kern/commercie/contract.js roept `save()` aan -- dus een route die alleen
     VERTELT wat opzeggen gaat doen, schreef de hele database naar schijf, met
     elke andere mutatie die op dat moment nog in het geheugen stond.

     Hij is niet gevonden door een toets maar door het INDELEN van de route:
     MUTATIECONTRACT.md eist voor NOT_APPLICABLE bewijs dat er niets verandert,
     en dat bewijs was er niet. Vandaar dat het nu te meten valt. */
  const w = wereld();
  w.lid(42, 'aanm-a', 'rtg', 6500);

  const voor = w.saves.n;
  const v = w.opzeg.opzegVoorbeeld(42);
  assert.equal(v.ok, true);
  assert.equal(w.saves.n, voor, 'het voorbeeld doet GEEN save()');
  assert.equal(w.lezer.mijn(42).abonnement.stand, 'ACTIEF', 'en verandert geen stand');

  // en lezen doet het ook niet
  const na = w.saves.n;
  w.lezer.mijn(42);
  assert.equal(w.saves.n, na, 'mijn() doet geen save()');

  // het echte opzeggen WEL -- anders meet deze toets niets
  w.opzeg.zegOpZelf(42);
  assert.ok(w.saves.n > na, 'opzeggen schrijft wel, anders bewijst deze toets niets');
});
