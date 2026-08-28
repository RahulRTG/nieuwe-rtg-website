/* ============================================================================
   DE BESLISVRAAG: een vraag, een antwoord, een vorm.

   Dit huis stelt "mag dit gebeuren" op tientallen plekken en beantwoordt hem
   elke keer anders. Zo ontstaan acht autorisatiesystemen die elk net iets anders
   denken -- precies hoe kern/thuis/zakelijk.js aan een eigen commissie van 10
   procent kwam terwijl de rest 12 gebruikte.

   DE BEWERINGEN DIE ERTOE DOEN:

     toets 2   delegatie kan alleen VERSMALLEN, structureel en niet als vuistregel
     toets 3   een vergeten grens verruimt niets
     toets 8   ONBEKEND is geen synoniem van WEIGEREN -- en voor geld valt het dicht
     toets 5   "te veel" is geen plat nee: tot de grens mag het wel

   Draai los: node --experimental-sqlite --test test/besluit.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const bev = require('../server/kern/commercie/bevoegdheid');
const { maakBesluit, UITKOMST, veiligeUitkomst } = require('../server/kern/commercie/besluit');

const NU = () => 1000;
const maak = (grenzen, scope) => bev.maakBevoegdheid({
  capability: 'money.refund', scope: scope || '*', grenzen, door: 'directeur', nu: NU });

/* ------------------------------------------------------------ bevoegdheid */

test('1. een bevoegdheid heeft vier dimensies, niet een boolean', () => {
  const b = maak({ maxCenten: 25000, alleenEigenVestiging: true }, 'zaak:KIKUNOI');
  assert.equal(b.capability, 'money.refund');       // WAT
  assert.equal(b.scope, 'zaak:KIKUNOI');            // WAAR
  assert.equal(b.grenzen.maxCenten, 25000);         // HOEVEEL
  assert.equal(b.grenzen.alleenEigenVestiging, true); // WANNEER
});

/* DE BEWERING. Structureel afgedwongen: er is geen pad waarlangs een delegatie
   kan verruimen. */
test('2. delegeren kan alleen versmallen, hoe je het ook probeert', () => {
  const directeur = maak({ maxCenten: 10000000 });          // 100.000 euro
  const manager = bev.delegeer(directeur, { grenzen: { maxCenten: 2000000 }, door: 'manager', nu: NU }).bevoegdheid;
  assert.equal(manager.grenzen.maxCenten, 2000000);

  // meer weggeven dan je hebt levert op wat je hebt
  const teVeel = bev.delegeer(manager, { grenzen: { maxCenten: 99999999 }, door: 'agent', nu: NU }).bevoegdheid;
  assert.equal(teVeel.grenzen.maxCenten, 2000000,
    'wie meer probeert weg te geven dan hij heeft, geeft weg wat hij heeft');

  // en over een hele keten blijft dat gelden
  const agent = bev.delegeer(manager, { grenzen: { maxCenten: 200000 }, door: 'ai-agent', nu: NU }).bevoegdheid;
  const deelproces = bev.delegeer(agent, { grenzen: { maxCenten: 9999999 }, door: 'deelproces', nu: NU }).bevoegdheid;
  assert.equal(deelproces.grenzen.maxCenten, 200000,
    'een keten van vier kan nooit meer opleveren dan de engste schakel');
  assert.equal(deelproces.diepte, 3);
});

/* DE TWEEDE BEWERING. Een grens die de delegatie NIET noemt, mag hem niet
   opheffen -- dat zou de makkelijkste escalatie zijn die er is. */
test('3. een vergeten grens verruimt niets', () => {
  const manager = maak({ maxCenten: 2000000, alleenEigenVestiging: true, apparaatVertrouwd: true });
  const agent = bev.delegeer(manager, { grenzen: { maxCenten: 200000 }, door: 'agent', nu: NU }).bevoegdheid;

  assert.equal(agent.grenzen.alleenEigenVestiging, true, 'niet genoemd betekent niet opgeheven');
  assert.equal(agent.grenzen.apparaatVertrouwd, true);

  // en een onbekende grens verruimt ook niets
  const raar = bev.delegeer(manager, { grenzen: { maxCenten: 999, verzonnenGrens: 'alles mag' }, door: 'x', nu: NU }).bevoegdheid;
  assert.equal(raar.grenzen.verzonnenGrens, undefined);
  assert.equal(raar.grenzen.maxCenten, 999);
});

test('4. de scope kan alleen smaller, en een andere scope is geen versmalling', () => {
  const overal = maak({ maxCenten: 10000 }, '*');
  const opEen = bev.delegeer(overal, { scope: 'zaak:A', door: 'x', nu: NU }).bevoegdheid;
  assert.equal(opEen.scope, 'zaak:A');

  const uitbreiding = bev.delegeer(opEen, { scope: 'zaak:B', door: 'x', nu: NU });
  assert.ok(uitbreiding.error, 'van zaak A naar zaak B is geen versmalling maar een verhuizing');
  assert.match(uitbreiding.error, /valt daarbuiten/);

  // en een andere capability kan een delegatie al helemaal niet opleveren
  assert.ok(bev.delegeer(overal, { capability: 'money.payout', door: 'x', nu: NU }).error);
});

/* --------------------------------------------------------------- besluit */

function motor(b, opties) {
  return maakBesluit({ zoekBevoegdheid: () => b, nu: NU, ...(opties || {}) });
}

/* DE DERDE BEWERING. "Te veel" is geen plat nee: het scheelt de aanvrager een
   tweede poging als het antwoord zegt tot hoever het wel kan. */
test('5. te veel gevraagd levert BEPERKT op, met de grens erbij', () => {
  const m = motor(maak({ maxCenten: 25000 }));
  const r = m.beslis({ actor: 'medewerker', handeling: 'money.refund', waardeCenten: 37000 });
  assert.equal(r.uitkomst, UITKOMST.BEPERKT);
  assert.equal(r.totCenten, 25000);
  assert.match(r.reden, /hoger dan de bevoegdheid/);
});

test('6. een harde voorwaarde is geen kwestie van minder vragen', () => {
  const m = motor(maak({ maxCenten: 100000, apparaatVertrouwd: true }));
  const r = m.beslis({ actor: 'x', handeling: 'money.refund', waardeCenten: 1000,
    context: { apparaatVertrouwd: false } });
  assert.equal(r.uitkomst, UITKOMST.WEIGEREN,
    'een apparaat wordt niet vertrouwd door een lager bedrag te vragen');
  assert.match(r.reden, /vertrouwd apparaat/);
});

test('7. het beleid komt bovenop de bevoegdheid, en hangt aan het bedrag', () => {
  const ruim = motor(maak({ maxCenten: 100000000 }));

  const groot = ruim.beslis({ actor: 'directeur', handeling: 'money.refund', waardeCenten: 150000 });
  assert.equal(groot.uitkomst, UITKOMST.GOEDKEURING,
    'ook wie ruim bevoegd is, tekent bij een groot bedrag niet alleen');

  const middel = ruim.beslis({ actor: 'directeur', handeling: 'money.refund', waardeCenten: 60000 });
  assert.equal(middel.uitkomst, UITKOMST.EXTRA_BEWIJS);

  const klein = ruim.beslis({ actor: 'directeur', handeling: 'money.refund', waardeCenten: 1000 });
  assert.equal(klein.uitkomst, UITKOMST.TOESTAAN);

  // met de goedkeuring erbij gaat het grote bedrag wel door
  const na = ruim.beslis({ actor: 'directeur', handeling: 'money.refund', waardeCenten: 150000,
    context: { goedgekeurdDoor: 'tweede-persoon', omkeerbaar: true, bevestigingVers: true } });
  assert.equal(na.uitkomst, UITKOMST.TOESTAAN);
});

/* DE VIERDE BEWERING. "We weten het niet" en "het mag niet" zijn verschillende
   dingen; wie ze samenvoegt bouwt een systeem dat bij een storing klinkt als bij
   een overtreding. */
test('8. ONBEKEND is geen WEIGEREN -- en voor geld valt het dicht', () => {
  const stuk = maakBesluit({ zoekBevoegdheid: () => { throw new Error('rechtenbron onbereikbaar'); }, nu: NU });
  const r = stuk.beslis({ actor: 'x', handeling: 'money.refund', waardeCenten: 5000 });
  assert.equal(r.uitkomst, UITKOMST.ONBEKEND);
  assert.match(r.reden, /kon niet worden nagekeken/);
  assert.notEqual(r.uitkomst, UITKOMST.WEIGEREN);

  // wat een aanroeper ermee doet, staat op EEN plek en niet bij elke aanroeper
  assert.equal(veiligeUitkomst(UITKOMST.ONBEKEND, { raaktWaarde: true }), UITKOMST.WEIGEREN,
    'alles wat waarde verplaatst, valt dicht');
  assert.equal(veiligeUitkomst(UITKOMST.ONBEKEND, { raaktWaarde: false }), UITKOMST.TOESTAAN,
    'een leesvraag mag open blijven; fail useful waar het kan');

  // en een actor zonder enige bevoegdheid is WEL een weigering
  const geen = maakBesluit({ zoekBevoegdheid: () => null, nu: NU });
  assert.equal(geen.beslis({ actor: 'x', handeling: 'money.refund', waardeCenten: 1 }).uitkomst,
    UITKOMST.WEIGEREN);
});

test('9. een vol dagtotaal is UITSTELLEN en geen weigering', () => {
  const m = motor(maak({ maxCenten: 100000, maxPerDagCenten: 50000 }),
    { dagverbruik: () => ({ vandaagCenten: 48000, vandaagAantal: 3 }) });
  const r = m.beslis({ actor: 'x', handeling: 'money.refund', waardeCenten: 5000 });
  assert.equal(r.uitkomst, UITKOMST.UITSTELLEN,
    'morgen mag het wel, en dat hoort de aanvrager te horen');
  assert.match(r.reden, /dagtotaal/);
});

/* Elk antwoord draagt zijn bewijs: waar de bevoegdheid vandaan komt en welke
   keten eronder ligt. Dat is het antwoord op "waarom mocht deze agent dit". */
test('10. elk antwoord draagt de keten terug naar de oorsprong', () => {
  const directeur = maak({ maxCenten: 10000000 });
  const manager = bev.delegeer(directeur, { grenzen: { maxCenten: 2000000 }, door: 'manager', nu: NU }).bevoegdheid;
  const agent = bev.delegeer(manager, { grenzen: { maxCenten: 200000 }, door: 'ai-agent', nu: NU }).bevoegdheid;

  const m = motor(agent);
  const r = m.beslis({ actor: 'ai-agent', handeling: 'money.refund', waardeCenten: 8240 });
  assert.equal(r.uitkomst, UITKOMST.TOESTAAN);
  assert.deepEqual(r.bewijs.keten.map(k => k.door), ['ai-agent', 'manager', 'directeur'],
    'waarom mocht deze agent 82,40 uitgeven? De keten staat er.');
  assert.equal(r.beleid, 'v1-2026', 'en onder welke beleidsversie het besloten is');
});

test('11. zonder handeling is er geen besluit, en dat zegt het ook', () => {
  const m = motor(maak({ maxCenten: 1000 }));
  assert.equal(m.beslis({ actor: 'x' }).uitkomst, UITKOMST.ONBEKEND);
});
