/* Magnaat V5 RELEASE HARDENING: wat er na elke handeling waar moet zijn, en
   wat er gebeurt als het niet waar is.

   - een fuzz-speler met willekeurige en kwaadaardige invoer, en na elke stap de
     geldinvarianten (./server/kern/magnaat-leven/bewaking.js);
   - een handeling zonder lichaam of met rommel is een weigering, geen crash;
   - een herhaald verzoek (dezelfde `verzoek`-sleutel na een verbroken
     verbinding) wordt niet twee keer uitgevoerd;
   - een handeling die halverwege breekt: terug naar hoe het was als er nog
     niets geboekt was, en anders bevriezen -- het journaal gaat niet terug;
   - een save van voor V2 laadt en speelt door. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { maakLeven } = require('../server/kern/magnaat-leven');
const { ACTIES } = require('../server/kern/magnaat-leven/acties');
const { boekVan } = require('../server/kern/magnaat-leven/boek');
const { controleer } = require('../server/kern/magnaat-leven/bewaking');

function leven(db = { data: {} }) {
  let t = 1e12;
  const L = maakLeven({ db, nu: () => t });
  const st = (k = 'lid') => db.data.magnaatLeven[k];
  return { db, L, st, tijd: (ms) => { t += ms; } };
}
const schoon = (v, k = 'lid') => controleer(v.st(k), boekVan(v.st(k)));

/* Een vaste pseudotoeval, zodat een gezakte ronde te herhalen is. */
function prng(s) { return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }
const HANDELINGEN = ['kies', 'onderneming', 'ontslag', 'plan', 'schrap', 'gesprek', 'voorstel', 'neem', 'weiger', 'lever', 'factuur',
  'herinnering', 'korting', 'voorfinancier', 'uitstel', 'lenen', 'werf', 'ontsla', 'bestel', 'prijs', 'teken', 'wijsaf', 'zegop', 'vestig',
  'slaap', 'tempo', 'doorspoelen', 'opnieuw', 'moeilijkheid', 'bestaatniet', '__proto__', 'constructor', 'toString', 'hasOwnProperty'];
const RAAR = [undefined, null, '', 'x', -1, 0, 1, 1.5, 1e308, -1e308, NaN, Infinity, '1e9', [], {}, true, '__proto__', 'd1', 'c1', 'kim',
  'websites', 'centrum', 999999, 30, 60, 240];
const VELDEN = ['deal', 'bedrag', 'voorschot', 'dagen', 'wat', 'dag', 'minuten', 'procent', 'naam', 'post', 'aanbod', 'kandidaat',
  'medewerker', 'aantal', 'contract', 'wijk', 'stand', 'zeker', 'index', 'wie', 'moeilijkheid', 'verzoek'];

test('fuzz: duizenden willekeurige en kwaadaardige handelingen, en na elke stap kloppen de boeken', () => {
  let stappen = 0;
  for (let seed = 1; seed <= 16; seed++) {
    const r = prng(seed), kies = (l) => l[Math.floor(r() * l.length)], v = leven();
    let s = v.L.staat('lid');
    for (let i = 0; i < 200; i++) {
      if (i === 3 && seed % 2 === 0) {
        /* De helft van de levens speelt als onderneming met kapitaal, zodat ook V2-V4 onder vuur liggen. */
        if (!v.st().aanbod) v.L.actie('lid', { actie: 'kies', aanbod: ['websites', 'foto', 'administratie'][seed % 3] });
        v.st().ondernemingVraag = v.st().dag;
        boekVan(v.st()).boekOver(v.st(), { soort: 'OPENING', van: ['begin'], naar: ['kas'], bedrag: 400000, omschrijving: 'fuzz', sleutel: 'fuzz' });
        v.L.actie('lid', { actie: 'onderneming', naam: 'Fuzz ' + seed });
      }
      let body;
      if (r() < 0.55 && s.vandaag.volgende.length) {       // een leven dat voorbij is, heeft geen handelingen meer
        const a = kies(s.vandaag.volgende);
        body = Object.assign({ actie: a.actie }, a.invoer || {});
        for (const k of Object.keys(body)) {
          const x = body[k];
          body[k] = x === 'euro' ? Math.floor(r() * 2000) : x === 'minuten' ? 30 * Math.ceil(r() * 8) : x === 'getal' ? Math.floor(r() * 60)
            : x === 'tekst' ? 'Bedrijf ' + seed : Array.isArray(x) ? ((y) => (y && typeof y === 'object' ? y.id : y))(kies(x)) : x;
        }
        if (body.actie === 'opnieuw') body.zeker = r() < 0.5;
      } else {
        body = { actie: kies(HANDELINGEN) };
        for (const k of VELDEN) if (r() < 0.3) body[k] = kies(RAAR);
      }
      if (r() < 0.1) v.tijd(180000 * Math.floor(r() * 5));
      const res = v.L.actie('lid', body);
      stappen++;
      if (res.error) {
        assert.equal(typeof res.error, 'string', 'een weigering zegt waarom');
        assert.ok([400, 409].includes(res.status || 400), 'een weigering is 400 of 409, nooit een crash: ' + JSON.stringify(body) + ' -> ' + res.error);
        continue;
      }
      s = res;
      assert.deepEqual(schoon(v), [], 'seed ' + seed + ' stap ' + i + ': ' + JSON.stringify(body));
      assert.equal(v.st().bevroren, undefined);
    }
  }
  assert.equal(stappen, 16 * 200);
});

test('een handeling zonder lichaam of met rommel is een weigering, geen crash', () => {
  const v = leven();
  v.L.staat('lid');
  for (const b of [null, undefined, 'slaap', 42, [], ['slaap'], { actie: { toString: 1 } }]) {
    const r = v.L.actie('lid', b);
    assert.equal(r.status, 400, JSON.stringify(b));
    assert.match(r.error, /bestaat niet/);
  }
  assert.equal(v.st().dag, 1);
});

test('een herhaald verzoek na een verbroken verbinding wordt niet twee keer uitgevoerd', () => {
  const v = leven();
  v.L.staat('lid');
  const a = v.L.actie('lid', { actie: 'slaap', verzoek: 'tik-1' });
  assert.equal(a.dag, 2);
  const b = v.L.actie('lid', { actie: 'slaap', verzoek: 'tik-1' });
  assert.equal(b.dag, 2, 'dezelfde sleutel: de dag is al afgesloten');
  assert.equal(b.herhaald, true);
  assert.equal(v.L.actie('lid', { actie: 'slaap', verzoek: 'tik-2' }).dag, 3);
  assert.equal(v.L.actie('lid', { actie: 'slaap', verzoek: 'x'.repeat(65) }).dag, 4, 'een te lange sleutel telt niet als sleutel');
  assert.equal(v.L.actie('lid', { actie: 'slaap', verzoek: 'x'.repeat(65) }).dag, 5);
  const fout = v.L.actie('lid', { actie: 'plan', wat: 'project', dag: 5, minuten: 30, verzoek: 'tik-3' });
  assert.ok(fout.error, 'zonder aanbod kan dat niet');
  v.L.actie('lid', { actie: 'kies', aanbod: 'foto' });
  assert.ok(!v.L.actie('lid', { actie: 'plan', wat: 'project', dag: 5, minuten: 30, verzoek: 'tik-3' }).error, 'een geweigerd verzoek mag opnieuw');
});

test('breekt een handeling voordat er geboekt is, dan is er niets veranderd', (t) => {
  const v = leven();
  v.L.staat('lid');
  const echt = ACTIES.kies;
  t.after(() => { ACTIES.kies = echt; });
  ACTIES.kies = (st) => { st.aanbod = 'foto'; st.meldingen.length = 0; throw new Error('proef'); };
  const r = v.L.actie('lid', { actie: 'kies', aanbod: 'foto' });
  assert.equal(r.status, 500);
  assert.match(r.error, /niets veranderd/);
  assert.equal(v.st().aanbod, null, 'terug naar hoe het was');
  assert.ok(v.st().meldingen.length > 0);
  assert.equal(v.st().bevroren, undefined);
  ACTIES.kies = echt;
  assert.ok(!v.L.actie('lid', { actie: 'kies', aanbod: 'foto' }).error, 'en daarna gewoon verder');
  assert.deepEqual(schoon(v), []);
});

test('breekt een handeling nadat er geboekt is, dan bevriest het leven, en opnieuw beginnen kan', (t) => {
  const v = leven();
  v.L.staat('lid');
  const echt = ACTIES.lenen;
  t.after(() => { ACTIES.lenen = echt; });
  ACTIES.lenen = (st, z) => { echt(st, z); throw new Error('proef'); };
  const r = v.L.actie('lid', { actie: 'lenen', bedrag: 100 });
  assert.equal(r.status, 500);
  assert.match(r.error, /bevroren/);
  assert.match(v.st().bevroren.reden, /al geboekt/);
  ACTIES.lenen = echt;
  const daarna = v.L.actie('lid', { actie: 'slaap' });
  assert.equal(daarna.status, 409, 'op een bevroren leven wordt niets meer gedaan');
  assert.ok(v.L.staat('lid').vandaag, 'kijken kan wel');
  const nieuw = v.L.actie('lid', { actie: 'opnieuw', zeker: true });
  assert.ok(!nieuw.error);
  assert.equal(v.st().bevroren, undefined, 'een nieuw leven is niet bevroren');
  assert.deepEqual(schoon(v), []);
});

test('kloppen de boeken na een handeling niet meer, dan bevriest het leven met de reden', () => {
  const v = leven();
  v.L.staat('lid');
  v.st().kas += 1;                              // iemand schreef buiten het grootboek om in het saldo
  const r = v.L.actie('lid', { actie: 'slaap' });
  assert.equal(r.status, 409);
  assert.match(r.error, /wijkt af van je rekening in het grootboek/);
  assert.ok(v.st().bevroren);
});

test('een save van voor V2 laadt, krijgt een leeg bedrijf en een markt, en speelt door', () => {
  const oud = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'magnaat-leven-v1.json'), 'utf8'));
  assert.equal(oud.data.magnaatLeven.oud.team, undefined, 'de fixture is echt van voor V2');
  const v = leven({ data: structuredClone(oud.data) });
  const s = v.L.staat('oud');
  assert.equal(s.dag, 5);
  assert.deepEqual(s.bedrijf, null);
  assert.equal(s.wereld.moeilijkheid, 'normaal');
  assert.equal(s.wereld.markt.wijk, 'thuis');
  assert.deepEqual(schoon(v, 'oud'), []);
  for (let i = 0; i < 10; i++) assert.ok(!v.L.actie('oud', { actie: 'slaap' }).error);
  assert.equal(v.L.verifieer('oud').ok, true);
  assert.deepEqual(schoon(v, 'oud'), []);
});

test('de bewaking ziet het als de voorraad op de plank niet meer klopt met de boeken', () => {
  const v = leven();
  v.L.staat('lid');
  v.L.actie('lid', { actie: 'kies', aanbod: 'foto' });
  v.st().ondernemingVraag = v.st().dag;
  boekVan(v.st()).boekOver(v.st(), { soort: 'OPENING', van: ['begin'], naar: ['kas'], bedrag: 400000, omschrijving: 'proef', sleutel: 'proef' });
  assert.ok(!v.L.actie('lid', { actie: 'onderneming', naam: 'Plank Oudwijk' }).error);
  assert.ok(!v.L.actie('lid', { actie: 'bestel', aantal: 10 }).error);
  for (let i = 0; i < 3; i++) v.L.actie('lid', { actie: 'slaap' });
  assert.deepEqual(schoon(v), []);
  v.st().handel.voorraad += 1;                  // een stuk dat nooit is ingekocht
  assert.ok(schoon(v).some(x => /voorraad in de boeken/.test(x)));
  assert.equal(v.L.actie('lid', { actie: 'slaap' }).status, 409);
});
