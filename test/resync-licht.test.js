/* ============================================================================
   EEN BEDOELDE SLUITING HOEFT NIET DE HELE KAST OPNIEUW TE LEZEN.

   De schrijfpoort sluit fail-closed, en dat blijft. Maar elke sluiting deed
   daarna `laadAlles()`: alle rijen uit kv, elke collectie ontsleuteld en
   geparsed. Gemeten op 9 september 2026 met 100M leden: 70 van de 77 sluitingen
   hadden als oorzaak "achtergrond: mutatie buiten requestcontext" -- geen
   storing, maar de BEDOELDE sluiting waarmee een mutatie buiten een
   requestcontext atomair landt. Zolang die herlaadronde loopt staat de poort
   dicht, dus de prijs van een correcte sluiting was een platformbrede
   503-periode. HERSTEL zakte daar als eerste op: de gewone aanroep kreeg tijdens
   het herstelvenster 19x een 503.

   Na onze eigen achtergrondmutatie klopt ons beeld nog: herstelNu committeert
   die mutatie eerst zelf, en daarna hoeven we alleen op te halen wat een ANDER
   proces intussen schreef. Dat is `haalNieuwer()` -- dezelfde weg die
   LISTEN/NOTIFY en de poll van twee seconden al continu gebruiken.

   DEZE TOETS BEWAAKT DRIE DINGEN, en de laatste twee zijn er zodat de
   optimalisatie de veiligheid niet stiekem uitholt:

     1. een achtergrondsluiting leest LICHT (haalNieuwer), niet zwaar;
     2. elke andere oorzaak leest ZWAAR (laadAlles) -- twijfel valt naar zwaar;
     3. de poort blijft dicht tot de resync klaar is, licht of zwaar.

   Draai los: node --test test/resync-licht.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const state = require('../server/db/state');
const maakGrens = require('../server/db/postgres-verzoeken');

/* Een motor die bijhoudt WELKE weg er gelopen is. laadAlles = zwaar,
   haalNieuwer = licht. */
function maakMotor() {
  const geteld = { laadAlles: 0, haalNieuwer: 0 };
  return {
    geteld,
    motor: {
      pool: { query: async () => ({ rows: [{ ok: 1 }] }) },
      laadAlles: async () => { geteld.laadAlles++; return { bewijs: [] }; },
      haalNieuwer: async () => { geteld.haalNieuwer++; return 0; },
      commitVerzoek: async () => ({ geschreven: 0 }),
      openstaandeWijzigingen: () => []
    }
  };
}

function grensMaken(m) {
  state.setRuweData({ bewijs: [] });
  return maakGrens({ store: 'postgres', db: state.db, state, motor: () => m.motor,
    slot: fn => fn(), basisKlaar: () => true });
}

test('de eerste resync na het opstarten is ZWAAR -- we hebben nog niets', async () => {
  const m = maakMotor();
  const grens = grensMaken(m);
  await grens.herstelNu();
  assert.equal(m.geteld.laadAlles, 1, 'de koude start hoort alles te lezen');
  assert.equal(m.geteld.haalNieuwer, 0);
});

test('een achtergrondsluiting leest LICHT en niet de hele kast', async () => {
  const m = maakMotor();
  const grens = grensMaken(m);
  await grens.herstelNu();                 // koude start: zwaar
  const zwaarVoor = m.geteld.laadAlles;

  grens.achtergrondSave();                 // de bedoelde sluiting
  assert.equal(grens.stand().writeHealthy, false, 'de poort hoort dicht te gaan -- fail-closed');

  await grens.herstelNu();
  assert.equal(m.geteld.laadAlles, zwaarVoor, 'een achtergrondsluiting las tóch de hele kast opnieuw');
  assert.equal(m.geteld.haalNieuwer, 1, 'de lichte weg is niet gebruikt');
  assert.equal(grens.stand().writeHealthy, true, 'de poort hoort daarna weer open te staan');
  assert.equal(grens.stand().lichteResyncs, 1);
});

test('elke ANDERE oorzaak leest zwaar -- twijfel valt naar zwaar', async () => {
  const m = maakMotor();
  const grens = grensMaken(m);
  await grens.herstelNu();
  const zwaarVoor = m.geteld.laadAlles;

  grens.ongezond(new Error('connection terminated unexpectedly'), 'flush');
  await grens.herstelNu();

  assert.equal(m.geteld.laadAlles, zwaarVoor + 1, 'een echte storing hoort alles opnieuw te lezen');
  assert.equal(m.geteld.haalNieuwer, 0, 'en zeker niet de lichte weg te nemen');
});

test('na een MISLUKTE resync is de volgende ronde weer zwaar', async () => {
  const m = maakMotor();
  const grens = grensMaken(m);
  await grens.herstelNu();

  grens.achtergrondSave();
  m.motor.haalNieuwer = async () => { throw new Error('verbinding weg halverwege'); };
  await assert.rejects(() => grens.herstelNu());

  const zwaarVoor = m.geteld.laadAlles;
  m.motor.haalNieuwer = async () => { m.geteld.haalNieuwer++; return 0; };
  await grens.herstelNu();
  assert.equal(m.geteld.laadAlles, zwaarVoor + 1,
    'een half toegepaste lichte resync mag niet gevolgd worden door nog een lichte');
});

test('de poort blijft dicht tot de resync klaar is', { timeout: 5000 }, async () => {
  const m = maakMotor();
  const grens = grensMaken(m);
  await grens.herstelNu();

  /* WACHTEN OP EEN TOESTAND EN NIET OP DE KLOK. Hier stond `setTimeout(20)`,
     en dat is precies wat scripts/klokwacht.js telt: op een rustige machine te
     lang, onder belasting te kort, en dan zakt de toets zonder dat er iets stuk
     is. De toestand waar het hier om gaat is "de resync is BEGONNEN maar nog
     niet klaar" -- en dat weet de nep-haalNieuwer zelf, want hij ís dat moment.
     Hij meldt het, de toets wacht daarop, en er komt geen tijd aan te pas. */
  let laatLos, meldBinnen;
  const binnen = new Promise(r => { meldBinnen = r; });
  m.motor.haalNieuwer = () => new Promise(r => {
    laatLos = () => { m.geteld.haalNieuwer++; r(0); };
    meldBinnen();
  });
  grens.achtergrondSave();
  const bezig = grens.herstelNu();
  await binnen;
  assert.equal(grens.stand().writeHealthy, false, 'de poort ging open terwijl de resync nog liep');
  laatLos();
  await bezig;
  assert.equal(grens.stand().writeHealthy, true);
});
