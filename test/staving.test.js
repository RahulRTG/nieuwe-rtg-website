/* ============================================================================
   DE STAVING -- staat wat Rahul zegt ook in wat hij heeft opgezocht?

   server/kern/stuur/staving.js legt het antwoord van de registerblik
   naast de uitkomsten van de gereedschappen uit DIE beurt. Wat hier vastligt:

     1. een getal uit een register krijgt de graad van dat register;
     2. een getal dat nergens staat heet `onbekend`, en het antwoord als geheel
        is nooit harder dan zijn zachtste anker;
     3. staat een anker in meer dan een uitkomst, dan telt de hardste;
     4. Nederlandse getallen (4.180, 4,5) worden als getal gelezen;
     5. het nummer van een opsomming en de cijfers in een route zijn geen
        losse getallen, en een route wordt niet gevonden via een langere;
     6. een antwoord zonder ankers wordt niet goedgekeurd maar is `onbekend`;
     7. geen nieuwe woorden: alleen de vier graden van het huis;
     8. de boardroom zet onder het antwoord wat niet is teruggevonden;
     9. in de stuurlus is een geslaagde aanroep `gemeten` en een weigering,
        voorstel of plan `vermoed`;
    10. een meegegeven graad kan door de uitkomst alleen verlaagd worden;
    11. de stuurlus geeft de staving mee, en een getal uit de vraag van de mens
        is geen bewijs maar ook geen verzinsel.

   Nagetrokken met mutaties (elk zakt minstens een toets):
     a. een anker zonder treffer krijgt `vermoed` in plaats van `onbekend` -> 2
     b. het geheel neemt de HOOGSTE graad in plaats van de laagste         -> 2
     c. `getal` leest 4.180 als 4,18                                        -> 4
     d. het opsommingsnummer blijft een anker                               -> 5
     e. een antwoord zonder ankers krijgt `gemeten`                         -> 6
     f. de boardroom laat de voetnoot weg                                   -> 8
     g. uitStuur noemt elke `doe` gemeten, ook een 403                      -> 9
     h. een meegegeven graad wint van een zachtere graad in de uitkomst     -> 10
     i. de stuurlus laat de vraag weg als bron                              -> 11

   Draai los: node --test test/staving.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { staaf, voetnoot, uitStuur, getal } = require('../server/kern/stuur/staving');
const { GRADEN } = require('../server/kern/stuur/gevolgcontract/woorden');

const register = (naam, graad, extra) => Object.assign({ bron: { register: naam, graad, dagenOud: 1 } }, extra);
const u = (gereedschap, uit) => ({ gereedschap, invoer: {}, uit });

test('1. een getal uit een register krijgt de graad van dat register', () => {
  const s = staaf('Er staan 4716 routes op verzwakt.', [u('vraagVertrouwenOp', register('VERTROUWEN.json', 'gemeten', { telling: { verzwakt: 4716 } }))]);
  const a = s.ankers.find(x => x.waarde === '4716');
  assert.equal(a.graad, 'gemeten');
  assert.equal(a.bron, 'VERTROUWEN.json');
  assert.deepEqual(s.nietGevonden, []);
  assert.equal(s.graad, 'gemeten');
});

test('2. een getal dat nergens staat is onbekend, en het geheel is nooit harder dan zijn zachtste anker', () => {
  const s = staaf('VERTROUWEN.json telt 4716 verzwakt, dus 99,5% is onbewezen.',
    [u('vraagVertrouwenOp', register('VERTROUWEN.json', 'gemeten', { telling: { verzwakt: 4716 } }))]);
  const pct = s.ankers.find(x => x.waarde === '99,5');
  assert.equal(pct.graad, 'onbekend', 'een zelf uitgerekend getal draagt geen register');
  assert.equal(pct.bron, null);
  assert.deepEqual(s.nietGevonden, ['99,5']);
  assert.equal(s.graad, 'onbekend', 'een conclusie is nooit harder dan haar zachtste premisse');

  const t = staaf('Het document noemt 12 en het register 4716.', [
    u('zoekKennis', { graad: 'vermoed', vondsten: [{ tekst: 'twaalf is 12' }] }),
    u('vraagVertrouwenOp', register('VERTROUWEN.json', 'gemeten', { telling: { verzwakt: 4716 } }))]);
  assert.equal(t.graad, 'vermoed');
});

test('3. staat een anker in meer dan een uitkomst, dan telt de hardste', () => {
  const s = staaf('Het zijn er 2418.', [
    u('zoekKennis', { graad: 'vermoed', vondsten: [{ tekst: 'de schuld was 2418 posten' }] }),
    u('vraagBewijsOp', register('BEWIJSSCHULD.json', 'gemeten', { achterstand: 2418 }))]);
  assert.equal(s.ankers[0].graad, 'gemeten');
  assert.equal(s.ankers[0].bron, 'BEWIJSSCHULD.json');
});

test('4. Nederlandse getallen worden als getal gelezen', () => {
  assert.equal(getal('4.180'), 4180);
  assert.equal(getal('4,5'), 4.5);
  assert.equal(getal('12'), 12);
  const s = staaf('Er zijn 4.180 routes verzwakt.', [u('x', register('VERTROUWEN.json', 'gemeten', { telling: { verzwakt: 4180 } }))]);
  assert.equal(s.ankers[0].graad, 'gemeten');
});

test('5. een opsommingsnummer en de cijfers in een route zijn geen ankers, en een route wordt niet gevonden via een langere', () => {
  const s = staaf('1. /api/v2/bank staat op verzwakt.\n2) Verder niets.', [u('inspecteerRoute', register('ROUTEBRON.json', 'gemeten', { pad: '/api/v2/bank/pas' }))]);
  assert.deepEqual(s.ankers.map(a => a.waarde), ['/api/v2/bank']);
  assert.equal(s.ankers[0].graad, 'onbekend', '/api/v2/bank is niet /api/v2/bank/pas');
  assert.equal(s.ongetoetst, 1);

  const t = staaf('/api/v2/bank/pas is verzwakt.', [u('inspecteerRoute', register('ROUTEBRON.json', 'gemeten', { pad: '/api/v2/bank/pas' }))]);
  assert.equal(t.ankers[0].graad, 'gemeten');
});

test('6. een antwoord zonder ankers wordt niet goedgekeurd', () => {
  const s = staaf('Het gaat goed. Er is weinig aan de hand.', [u('x', register('VERTROUWEN.json', 'gemeten'))]);
  assert.equal(s.graad, 'onbekend');
  assert.equal(s.ankers.length, 0);
  assert.equal(s.ongetoetst, 2);
  assert.match(s.reden, /geen getal, route of register/);
  assert.equal(voetnoot(s), '', 'geen anker, dus ook niets om als niet-gevonden te melden');
});

test('7. geen nieuwe woorden: alleen de vier graden van het huis', () => {
  const s = staaf('Er zijn 7 en 8 en VERTROUWEN.json.', [u('x', register('VERTROUWEN.json', 'bewezen', { n: 7 }))]);
  for (const a of s.ankers) assert.ok(GRADEN.includes(a.graad), a.graad);
  assert.ok(GRADEN.includes(s.graad));
  const bron = fs.readFileSync(path.join(__dirname, '../server/kern/stuur/staving.js'), 'utf8');
  assert.doesNotMatch(bron, /\[\s*'onbekend'\s*,/, 'de graden komen uit gevolgcontract/woorden.js, niet uit een eigen lijst');
  assert.doesNotMatch(bron, /'(ondersteund|tegengesproken|SUPPORTED|CONTRADICTED)'/);
});

test('8. de boardroom zet onder het antwoord wat niet is teruggevonden', async () => {
  const vorige = process.env.RTG_REGISTERWORTEL;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'staving-'));
  fs.writeFileSync(path.join(dir, 'VERTROUWEN.json'), JSON.stringify({ stempel: { op: new Date().toISOString() },
    telling: { verzwakt: 2, bewezen: 1 }, routes: 3,
    perRoute: { 'POST /api/a': { staat: 'verzwakt' }, 'POST /api/b': { staat: 'verzwakt' }, 'POST /api/c': { staat: 'bewezen' } } }));
  process.env.RTG_REGISTERWORTEL = dir;
  try {
    const beurten = [{ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'vraagVertrouwenOp', input: {} }] },
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'VERTROUWEN.json telt 3 routes, waarvan 777777 bewezen.' }] }];
    let i = 0;
    const anthropic = { messages: { create: async () => beurten[i++] } };
    const kamer = require('../server/kern/afdelingen/kameradvies')({ anthropic,
      AFDELINGEN: { a: { naam: 'Techniek' } }, kamer: () => ({}), taken: () => [], voorstellen: () => ({ voorstellen: [] }) });
    const r = await kamer.boardroomAdvies('Hoe staat het bewijs ervoor?');
    assert.match(r.antwoord, /^VERTROUWEN\.json telt 3 routes/);
    assert.match(r.antwoord, /Niet teruggevonden in wat hiervoor is opgezocht: 777777/);
    assert.deepEqual(r.staving.nietGevonden, ['777777']);
    assert.equal(r.staving.ankers.find(a => a.waarde === '3').graad, 'gemeten');
  } finally {
    if (vorige === undefined) delete process.env.RTG_REGISTERWORTEL; else process.env.RTG_REGISTERWORTEL = vorige;
  }
});

test('9. in de stuurlus is alleen een geslaagde aanroep of de kaart gemeten', () => {
  const doe = (status, extra) => uitStuur({ name: 'doe', input: { pad: '/api/x' } }, Object.assign({ status }, extra));
  assert.equal(doe(200).graad, 'gemeten', 'een geslaagde aanroep is een live antwoord uit deze beurt');
  assert.equal(doe(403).graad, 'vermoed', 'een weigering zegt niets over de stand van zaken');
  assert.equal(doe(428, { bevestigNodig: true }).graad, 'vermoed', 'een voorstel is nog niet gebeurd');
  assert.equal(doe(200, { bevestigNodig: true }).graad, 'vermoed');
  assert.equal(uitStuur({ name: 'kaart' }, { paden: [] }).graad, 'gemeten');
  assert.equal(uitStuur({ name: 'plan' }, { stappen: [] }).graad, 'vermoed', 'een plan is een voornemen');
  assert.equal(uitStuur({ name: 'doe' }, null).graad, 'vermoed', 'zonder status geen bewering');
});

test('10. een meegegeven graad kan alleen omlaag', () => {
  const zacht = staaf('Het zijn er 42.', [{ gereedschap: 'doe', graad: 'gemeten', uit: { n: 42, bron: { graad: 'vermoed' } } }]);
  assert.equal(zacht.ankers[0].graad, 'vermoed', 'wat de uitkomst zelf zachter noemt, telt');
  const hard = staaf('Het zijn er 42.', [{ gereedschap: 'doe', graad: 'vermoed', uit: { n: 42, bron: { graad: 'bewezen' } } }]);
  assert.equal(hard.ankers[0].graad, 'vermoed', 'een uitkomst kan zichzelf niet ophogen boven wat de aanroeper weet');
});

test('11. de stuurlus geeft de staving mee; een getal uit de vraag is geen bewijs en geen verzinsel', async () => {
  const { toegestanePaden } = require('../server/kern/stuur/beleid');
  const { classificeer, parseSubs } = require('../server/kern/stuur/classificatie');
  const alle = toegestanePaden(['/api/agenda/mijn'], 'member');
  const beurten = [
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'd1', name: 'doe',
      input: { pad: '/api/agenda/mijn', zeker: true, begrepen: 'de agenda van dit lid lezen' } }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Je hebt 3 afspraken op de 14e, en 99 herinneringen.' }] }];
  let i = 0;
  const anthropic = { messages: { create: async () => beurten[i++] } };
  const stuurRoep = async () => ({ status: 200, antwoord: { afspraken: 3 } });
  const stuurLus = require('../server/kern/stuur/lus')({ anthropic, app: {}, log: null, stuurRoep,
    stuurPaden: () => alle, classificeer, parseSubs, isolatie: null });
  const r = await stuurLus({ socket: { localPort: 0 }, get: () => null, session: {} },
    { vraag: 'Wat staat er op de 14e?', wereld: 'member' });
  assert.ok(r && r.staving, 'de stuurlus geeft de staving mee');
  const a = (w) => r.staving.ankers.find(x => x.waarde === w);
  assert.equal(a('3').graad, 'gemeten', 'uit het live antwoord van de route');
  assert.equal(a('14').graad, 'onbekend', 'de mens noemde het zelf: geen bewijs');
  assert.equal(a('14').bron, 'vraag');
  assert.deepEqual(r.staving.nietGevonden, ['99'], 'alleen wat nergens staat, is niet teruggevonden');
  assert.equal(r.staving.graad, 'onbekend');
});
