/* DE KWALITEITSMETING -- en vooral wat zij NIET meet.

   Een callcenter meet afhandeltijd en tickets per medewerker, en beloont
   daarmee precies het verkeerde: wie een zaak snel sluit scoort beter dan wie
   hem oplost. De maat die hier telt is een andere -- hoeveel problemen zijn
   opgelost zonder dat de melder zijn verhaal opnieuw hoefde te vertellen.

   Deze toetsen leggen vast:

   1. Die maat wordt echt uit de tijdlijn gerekend, en streng: hij kijkt of de
      STRUCTUUR de melder dwong, niet of hij woorden herhaalde.
   2. Er staat geen getal waar er geen is. Onder de drempel: `nietTeZeggen` met
      een reden, geen nul en geen percentage.
   3. Elke verhouding draagt zijn noemer -- 100% van twee zaken is geen 100%.
   4. Er is geen tevredenheidscijfer, geen afhandeltijd per medewerker en geen
      samengesteld rapportcijfer, en dat staat met de reden IN het antwoord. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

function laag() {
  const db = { data: {} };
  const save = () => {};
  const zaken = require('../server/kern/service/zaak')({ db, save, crypto });
  const loop = require('../server/kern/service/loop')({ zaken, save });
  const kwaliteit = require('../server/kern/service/kwaliteit')({ zaken });
  return { db, zaken, loop, kwaliteit };
}
const nieuw = (l, i) => l.zaken.open({ melder: 'user-' + i, onderwerp: 'app', titel: 'Melding ' + i }).zaak.id;

test('"zonder opnieuw uitleggen" kijkt of RTG als eerste iets zei', () => {
  const l = laag();
  /* GOED: het lid vraagt om een mens, en die mens reageert als eerste. */
  const a = nieuw(l, 1);
  l.loop.mensVraag(a, { tier: 'rtg' });
  l.loop.bericht(a, { van: 'mens', tekst: 'Nadia hier, ik zoek het uit.', wie: 'nadia' });
  assert.equal(l.kwaliteit.opnieuwUitleggen(l.zaken.vind(a)), false);

  /* FOUT: het lid vraagt om een mens en moet daarna zelf weer beginnen. */
  const b = nieuw(l, 2);
  l.loop.mensVraag(b, { tier: 'rtg' });
  l.loop.bericht(b, { van: 'melder', tekst: 'Hallo? Is daar iemand?' });
  assert.equal(l.kwaliteit.opnieuwUitleggen(l.zaken.vind(b)), true);

  /* GEEN OORDEEL: er was geen overdracht, dus er valt niets te vinden. Null en
     niet `false` -- anders telt elke zaak zonder mens mee als een succes. */
  assert.equal(l.kwaliteit.opnieuwUitleggen(l.zaken.vind(nieuw(l, 3))), null);
});

test('onder de drempel staat er geen percentage maar een reden', () => {
  const l = laag();
  for (let i = 0; i < 3; i++) {
    const id = nieuw(l, i);
    l.loop.mensVraag(id, { tier: 'rtg' });
    l.loop.bericht(id, { van: 'mens', tekst: 'wij kijken ernaar', wie: 'nadia' });
  }
  const m = l.kwaliteit.meting();
  assert.equal(m.zonderOpnieuwUitleggen.nietTeZeggen, true,
    'er staat een verhouding over drie zaken: ' + JSON.stringify(m.zonderOpnieuwUitleggen));
  assert.equal(m.zonderOpnieuwUitleggen.procent, undefined, 'er staat toch een percentage');
  assert.match(m.zonderOpnieuwUitleggen.waarom, /zegt niets|nog niets/i);
});

test('boven de drempel draagt elke verhouding zijn noemer', () => {
  const l = laag();
  for (let i = 0; i < 12; i++) {
    const id = nieuw(l, i);
    l.loop.mensVraag(id, { tier: 'rtg' });
    /* Drie van de twaalf moeten het zelf opnieuw beginnen. */
    if (i < 3) l.loop.bericht(id, { van: 'melder', tekst: 'is daar iemand?' });
    else l.loop.bericht(id, { van: 'mens', tekst: 'wij kijken ernaar', wie: 'nadia' });
  }
  const m = l.kwaliteit.meting();
  assert.equal(m.zonderOpnieuwUitleggen.van, 12, 'de noemer ontbreekt of klopt niet');
  assert.equal(m.zonderOpnieuwUitleggen.deel, 9);
  assert.equal(m.zonderOpnieuwUitleggen.procent, 75);
  assert.ok(m.zonderOpnieuwUitleggen.wat, 'het getal legt zichzelf niet uit');
});

test('een heropende zaak was niet opgelost, en dat wordt uit de tijdlijn gelezen', () => {
  const l = laag();
  const id = nieuw(l, 1);
  l.loop.stand(id, 'opgelost', { door: 'nadia' });
  assert.equal(l.kwaliteit.heropend(l.zaken.vind(id)), false);
  /* Het lid meldt zich weer; de zaak gaat opnieuw lopen. */
  l.loop.stand(id, 'inBehandeling', { door: 'nadia', notitie: 'werkt bij het lid nog niet' });
  assert.equal(l.kwaliteit.heropend(l.zaken.vind(id)), true,
    'een zaak die na een eindstand weer ging lopen telt niet als heropend');
});

test('een ongemeten hersteltijd telt niet als nul mee', () => {
  const l = laag();
  /* Twaalf opgeloste zaken; geen ervan heeft ooit een bericht gehad, dus de
     hersteltijd IS gemeten (de klok rekent vanaf het openen). Wat hier telt is
     dat de mediaan zijn eigen noemer draagt. */
  for (let i = 0; i < 12; i++) l.loop.stand(nieuw(l, i), 'opgelost', { door: 'nadia' });
  const m = l.kwaliteit.meting();
  assert.equal(m.herstelMediaanMinuten.van, 12, JSON.stringify(m.herstelMediaanMinuten));
  assert.match(m.herstelMediaanMinuten.wat, /MEDIAAN/,
    'er staat een gemiddelde, waarin een enkele zaak van drie weken het beeld bepaalt');

  /* En zonder opgeloste zaak staat er geen nul. */
  const leeg = laag().kwaliteit.meting();
  assert.equal(leeg.herstelMediaanMinuten.nietTeZeggen, true);
  assert.ok(leeg.herstelMediaanMinuten.waarom);
});

test('de meting zegt zelf wat zij niet meet', () => {
  const m = laag().kwaliteit.meting();
  assert.ok(m.nietGemeten.tevredenheid, 'er wordt niets over tevredenheid gezegd, ook niet dat het ontbreekt');
  assert.ok(m.nietGemeten.afhandeltijdPerMedewerker, 'de afwezigheid van een ranglijst op mensen is niet uitgelegd');
  assert.ok(m.nietGemeten.rapportcijfer);
  /* GEEN SAMENGESTELD CIJFER. Zes eerlijke getallen bij elkaar optellen geeft
     een zekerheid die geen van de zes draagt. */
  for (const sleutel of ['score', 'cijfer', 'rapport', 'totaal', 'index']) {
    assert.equal(m[sleutel], undefined, 'er staat een samengesteld cijfer: ' + sleutel);
  }
});
