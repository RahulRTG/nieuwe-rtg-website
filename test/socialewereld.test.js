/* RTG Sociaal, de samenhanglaag. Zelfde belofte als de twee andere werelden:
   hij bezit niets, hij verzint niets, en hij doet nooit alsof hij compleet is
   terwijl een bron zweeg. Wat er hier bovenop komt is een regel die met dit
   genre te maken heeft: dit scherm hoort alleen te tonen wat OP U WACHT, want
   anders is het een tweede inbox. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakSocialeWereld } = require('../server/kern/socialewereld');

const VANDAAG = new Date().toISOString().slice(0, 10);
const dagen = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

function kernMet(over) {
  const k = {
    comm: { inbox: () => ({ gesprekken: [] }) },
    bijeenkomst: { mijnAgenda: () => ({ komt: [] }) },
    pulseFeed: () => ({ feed: [] })
  };
  Object.assign(k, over || {});
  return k;
}
const wereld = (over) => maakSocialeWereld({ kern: kernMet(over) }).socialewereld;

test('bezit niets: er is geen enkele manier om iets te schrijven', () => {
  /* DE MUTATIE DIE HEM HOORT TE LATEN ZAKKEN: voeg `plaats` toe aan het
     teruggegeven object. Dat is het begin van een tweede sociaal netwerk
     naast de zeven die er al zijn. */
  assert.deepEqual(Object.keys(wereld()), ['kring'],
    'de sociale wereld hoort ALLEEN te kunnen lezen');
});

test('alleen gesprekken die op antwoord wachten, niet de hele inbox', () => {
  /* Zou dit scherm elk gesprek tonen, dan is het een tweede Berichten en geen
     beeld. Een stilgezet gesprek telt ook niet mee: dat is precies iemand die
     GEZEGD heeft er niet aan herinnerd te willen worden. */
  const w = wereld({ comm: { inbox: () => ({ gesprekken: [
    { id: 'g1', titel: 'Sam', ongelezen: 2, at: VANDAAG },
    { id: 'g2', titel: 'Gelezen', ongelezen: 0, at: VANDAAG },
    { id: 'g3', titel: 'Stilgezet', ongelezen: 5, at: VANDAAG, stil: true }
  ] }) } });
  const r = w.kring('k');
  assert.deepEqual(r.regels.map(x => x.kenmerk), ['g1']);
  assert.equal(r.regels[0].open, 2, 'het aantal ongelezen berichten hoort mee te komen');
  assert.equal(r.regels[0].link, '/apps/comm.html');
});

test('een bijeenkomst van vandaag vraagt aandacht, een van later niet', () => {
  const w = wereld({ bijeenkomst: { mijnAgenda: () => ({ komt: [
    { id: 'b1', wat: 'Borrel', datum: VANDAAG, tijd: '20:00', groep: 'De Kring' },
    { id: 'b2', wat: 'Lezing', datum: dagen(9), groep: 'De Kring' }
  ] }) } });
  const r = w.kring('k');
  const nu = r.regels.find(x => x.kenmerk === 'b1');
  assert.equal(nu.sig, 'aandacht');
  assert.equal(nu.teken, '!', 'kleur alleen is niet genoeg');
  assert.equal(nu.door, 'De Kring', 'de groep hoort erbij te staan');
  assert.equal(r.regels.find(x => x.kenmerk === 'b2').sig, 'actief');

  /* DE NAAM, en die was er niet. Deze laag las `x.titel`, en een bijeenkomst
     heet `wat` (kern/genootschap/bijeenkomst.js, publiek()) -- dus kwam elke
     bijeenkomst naamloos binnen en viel het scherm terug op het woord
     "Bijeenkomst". De toets zag het niet omdat de fixtures hier `titel` mee
     gaven: een proefopstelling die iets anders levert dan het echte domein
     bewijst niets (LAT.md regel 9). De fixtures zeggen nu `wat`, net als de
     bron zelf.

     DE MUTATIE: zet in socialewereld.js `titel: x.wat` terug naar `x.titel`. */
  assert.equal(nu.titel, 'Borrel', 'een bijeenkomst hoort met haar eigen naam door te komen');
  assert.equal(nu.tijd, '20:00', 'en met haar uur, want daarop draait laag 3 van het Canvas');
});

/* DE BELANGRIJKSTE TOETS VAN DEZE LAAG.

   DE MUTATIE: haal stil.push(naam) uit bron(). Het scherm toont dan twee van
   de drie bronnen, ziet er volkomen normaal uit, en iemand blijft onbeantwoord. */
test('een bron die stukgaat wordt gemeld en neemt de andere niet mee', () => {
  const w = wereld({
    comm: { inbox: () => { throw new Error('comm stuk'); } },
    bijeenkomst: { mijnAgenda: () => ({ komt: [
      { id: 'b1', wat: 'Borrel', datum: dagen(2), groep: 'De Kring' }] }) }
  });
  const r = w.kring('k');
  assert.deepEqual(r.stil, ['gesprekken']);
  assert.equal(r.regels.length, 1, 'de andere bronnen horen door te lopen');
});

test('wat op u wacht staat boven wat alleen maar gebeurd is', () => {
  const w = wereld({
    comm: { inbox: () => ({ gesprekken: [{ id: 'g1', titel: 'Sam', ongelezen: 1, at: dagen(-1) }] }) },
    bijeenkomst: { mijnAgenda: () => ({ komt: [
      { id: 'b1', wat: 'Vanavond', datum: VANDAAG, groep: 'K' }] }) },
    pulseFeed: () => ({ feed: [{ id: 'p1', tekst: 'Mooie dag', at: VANDAAG, naam: 'Ux' }] })
  });
  assert.deepEqual(w.kring('k').regels.map(x => x.sig),
    ['aandacht', 'actief', 'gezond'],
    'de rangorde hoort op dringendheid te staan en niet op tijd');
});

test('elke toestand die deze laag kan maken, kent hij ook', () => {
  const w = wereld({
    comm: { inbox: () => ({ gesprekken: [{ id: 'g1', titel: 'Sam', ongelezen: 1, at: VANDAAG }] }) },
    bijeenkomst: { mijnAgenda: () => ({ komt: [
      { id: 'b1', wat: 'Nu', datum: VANDAAG, groep: 'K' },
      { id: 'b2', wat: 'Straks', datum: dagen(3), groep: 'K' }] }) },
    pulseFeed: () => ({ feed: [{ id: 'p1', tekst: 'Hallo', at: VANDAAG }] })
  });
  const r = w.kring('k');
  assert.equal(r.regels.length, 4);
  assert.deepEqual(r.regels.filter(x => !x.sig).map(x => x.status), []);
  assert.equal(r.telling.onbekend, 0);
});

test('elke regel wijst naar de app waar het echte werk gebeurt', () => {
  const w = wereld({
    comm: { inbox: () => ({ gesprekken: [{ id: 'g1', titel: 'S', ongelezen: 1, at: VANDAAG }] }) },
    bijeenkomst: { mijnAgenda: () => ({ komt: [{ id: 'b1', wat: 'B', datum: VANDAAG, groep: 'K' }] }) },
    pulseFeed: () => ({ feed: [{ id: 'p1', tekst: 'T', at: VANDAAG }] })
  });
  for (const r of w.kring('k').regels) {
    assert.match(r.link, /^\/apps\/[a-z]+\.html$/);
    assert.ok(r.app);
  }
});

test('de drie werelden spreken dezelfde taal', () => {
  /* Reizen, Kantoor en Sociaal zijn drie samenhanglagen. Zouden ze elk hun
     eigen woorden voor dezelfde toestand verzinnen, dan zijn het drie
     producten die op elkaar lijken (LAT.md regel 4). Deze toets bewaakt dat de
     VORM gelijk blijft; de inhoud mag per genre verschillen. */
  const r = wereld().kring('k');
  assert.deepEqual(Object.keys(r).sort(), ['bronnen', 'ok', 'regels', 'stand', 'stil', 'telling']);
  assert.deepEqual(Object.keys(r.telling).sort(),
    ['aandacht', 'onbekend', 'regels', 'vandaag', 'wachtend']);
  /* En sinds het Command Canvas dragen ze ook alle drie een stand (CANVAS.md,
     laag 0). Dat de WOORDEN verschillen is de bedoeling -- Sociaal is
     'Levendig' waar Kantoor 'Druk' is; dat de vorm gelijk is, is de regel. */
  assert.deepEqual(Object.keys(r.stand).sort(),
    ['aandacht', 'incident', 'niveau', 'ongemeten', 'reden', 'woord']);
});
