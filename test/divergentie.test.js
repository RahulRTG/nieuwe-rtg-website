/* DE EERSTE DIVERGENTIE (scripts/lib/divergentie.js, BEWIJSLUS.md par. 4).

   Wat hier bewezen wordt, is dat het INSTRUMENT werkt:

   1. HET ZWIJGT OP GEZONDE CODE. Veertig willekeurige reeksen op de echte
      kern/pay geven geen enkele afwijking. Zonder deze toets is een ijkpunt dat
      altijd `wijkt` niet van een werkend ijkpunt te onderscheiden -- en de eerste
      versie deed precies dat: 27 van de 40 schone reeksen "weken af", omdat een
      herhaling met een sleutel die al slaagde een ok-antwoord krijgt zonder
      effect, en omdat het spoor van de zoeker een verzoek twee keer kan dragen.
   2. HET WIJST HET JUISTE IJKPUNT AAN. Drie sabotages, elk op een ander punt:
      een betaling door de verkeerde (E1), een geslaagd antwoord op een verzoek
      dat al betaald werd (E3), en een saldo zonder boeking (E4). Het punt ervoor
      staat erbij en klopt.
   3. HET SPRINGT HARDOP OVER WAT NIET WAARGENOMEN IS. E6 staat voor RTG Pay op
      `niet-waargenomen` met de reden, en een divergentie erachter noemt hem.
   4. WAT NIET INGERICHT IS, IS NIET GROEN. Voor laad en verzoek komt er geen rij
      maar een reden.

   OP DE ECHTE FOUT GEDRAAID (24 september 2026, BEWIJSLUS.md par. 3a): met de
   twee regels uit verzoekBetaal() weggehaald die de race dichtzetten, vindt de
   zoeker zaad 1 opnieuw en wijst de divergentie E2 -> E3 aan ("hooguit 1
   toegestaan besluit, 2 toegestaan") -- het BESLUIT, precies waar de reparatie
   zit, en een stap voor de opslag waar de wet het pas zag. Die run is met de
   hand gedaan en niet vastgelegd, want een toets die de productiecode muteert
   hoort in de mutatiemotor en niet hier.

   MUTATIES die zijn gedraaid (LAT.md regel 2):
   - in rijBetaal() het verbod van E1 weghalen            -> toets 2a zakt
   - in rijBetaal() `effecten` weer als ok-antwoorden tellen -> toets 1 zakt
   - in eersteDivergentie() `overgeslagen` niet vullen     -> toets 3 zakt

   Draai los: node --test test/divergentie.test.js */
'use strict';
process.env.RTG_SIMULATIEBANK = '1';
delete process.env.STRIPE_SECRET_KEY;
delete process.env.MOLLIE_API_KEY;
delete process.env.ADYEN_API_KEY;
const test = require('node:test');
const assert = require('node:assert/strict');
const m = require('../scripts/lib/tegenvoorbeeld');
const dv = require('../scripts/lib/divergentie');
const { maakTeller } = require('../scripts/lib/rommel');

const SPELERS = m.maakWereld().spelers;

/* Zoek over zaden tot de ijkpunten iets zien. De sabotages hieronder breken
   niet allemaal een WET -- dat de ijkpunten dan toch afwijken is juist het punt. */
async function vind(sabotage, zaden = 60) {
  for (let z = 1; z <= zaden; z++) {
    const o = await dv.ontleed(m.genereer(maakTeller(z), 12, SPELERS), () => m.maakWereld({ sabotage }));
    if (o.gevonden) return o;
  }
  return null;
}

test('1. op gezonde code wijkt er in veertig reeksen niets af', async () => {
  let ingericht = 0;
  for (let z = 1; z <= 40; z++) {
    const stappen = m.genereer(maakTeller(z), 12, SPELERS);
    ingericht += stappen.reduce((n, s) => n + s.ops.filter(o => o.soort === 'stuur' || o.soort === 'betaal').length, 0);
    const o = await dv.ontleed(stappen, () => m.maakWereld());
    assert.equal(o.gevonden, false, 'zaad ' + z + ': ' + JSON.stringify(o.divergentie));
    assert.ok(!o.teGrof, 'zaad ' + z + ' brak een wet op gezonde code: ' + o.teGrof);
  }
  assert.ok(ingericht > 100, 'er zijn genoeg handelingen langs de ijkpunten gegaan (' + ingericht + ')');
});

test('2a. een betaling door een ander dan aan wie het verzoek staat: E1', async () => {
  const deVerkeerde = (pay, db) => {
    const echt = pay.verzoekBetaal;
    pay.verzoekBetaal = (a) => {
      const v = (db.data.payVerzoeken || []).find(x => x.id === a.verzoekId);
      return echt(Object.assign({}, a, { codenaam: v ? v.aan : a.codenaam }));
    };
  };
  const o = await vind(deVerkeerde);
  assert.ok(o, 'de ijkpunten horen dit te zien, ook al breekt het geen wet');
  assert.equal(o.divergentie.naar, 'E1 bevoegdheid');
  assert.equal(o.divergentie.van, 'E0 intentie');
});

test('2b. een geslaagd antwoord op een verzoek dat al betaald was: E3', async () => {
  const jaZeggen = (pay) => {
    const echt = pay.verzoekBetaal;
    pay.verzoekBetaal = async (a) => {
      const r = await echt(a);
      return r && r.status === 409 ? { ok: true } : r;
    };
  };
  const o = await vind(jaZeggen);
  assert.ok(o);
  assert.equal(o.divergentie.naar, 'E3 effectbesluit');
  assert.equal(o.divergentie.van, 'E2 ingangstoestand');
});

test('2c. een saldo zonder boeking: E4, en het besluit ervoor klopt', async () => {
  const centErbij = (pay, db) => {
    const echt = pay.stuur;
    pay.stuur = async (a) => {
      const r = await echt(a);
      if (r && r.ok) db.data.paySaldi[pay.rekLid(a.aanCodenaam)] += 1;
      return r;
    };
  };
  const o = await vind(centErbij);
  assert.ok(o);
  assert.equal(o.divergentie.naar, 'E4 opslag');
  assert.equal(o.divergentie.van, 'E3 effectbesluit');
  assert.match(o.divergentie.ijkpunt.waargenomen, /sluit niet/);
});

test('3. E6 is niet waargenomen, met de reden, en een divergentie erachter noemt hem', () => {
  const p = (naam, stand) => ({ punt: naam, stand });
  const rij = dv.PUNTEN.map((naam, i) => p(naam, i === 6 ? 'niet-waargenomen' : i === 7 ? 'wijkt' : 'klopt'));
  const d = dv.eersteDivergentie(rij);
  assert.equal(d.van, 'E5 extern effect');
  assert.equal(d.naar, 'E7 projectie');
  assert.deepEqual(d.overgeslagen, ['E6 gebeurtenis']);
  assert.match(dv.GEEN_GEBEURTENIS, /kern\/envelop\.js/);
});

test('4. laad en verzoek zijn niet ingericht, en dat zegt de rij', () => {
  const r = dv.rij(m.maakWereld(), {}, { soort: 'laad' }, { ok: true });
  assert.ok(!r.punten);
  assert.match(r.nietIngericht, /stuur en betaal/);
});
