/* DE SAMENSTELLING VAN DE VRIJGAVEPOORT (server/kern/vrijgave/index.js) en het
   baselineoordeel (server/kern/vrijgave/baseline.js), langs de zijpaden: de
   standaard openbaar-, lokaal- en sandboxvragen uit de omgeving, het overzicht
   met zijn oordeel per provider, de late koppeling, de opstartkeuring met een
   log dat ontbreekt of gooit, `weigering` die alleen poortfouten vertaalt, en
   per soort baselinefout een eigen melding. Standbestanden in een tijdelijke
   map; process.env wordt niet gelezen (iedere poort krijgt een eigen env). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { maakVrijgave, keurBijStart, weigering, standaard } = require('../server/kern/vrijgave');
const { maakStand, FORMAAT } = require('../server/kern/vrijgave/stand');
const B = require('../server/kern/vrijgave/baseline');
const reg = require('../server/kern/vrijgave/register');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vrijgave-index-takken-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));
let n = 0;
const bestand = () => { const d = path.join(TMP, 'm' + (++n)); fs.mkdirSync(d); return path.join(d, 'vrijgave-stand.json'); };
const BEWEZEN = { oordeel: () => ({ geverifieerd: true, reden: 'proefbewijs' }) };
const MAG = { mag: () => ({ mag: true, via: 'proef' }) };
const ZET = { wie: 'user-1', reden: 'proef van de samenstelling', stapOmhoog: true };
const BESLUIT = { wie: 'user-1', bron: 'proefdossier-1', sha256: 'a'.repeat(64), reden: 'proef van een besluit', stapOmhoog: true };

test('zonder openbaar/lokaal/sandbox-functies leest de poort de eigen env: productie is niet lokaal en kent geen sandbox', () => {
  const v = maakVrijgave({ env: { NODE_ENV: 'production', APP_URL: 'https://rahultravel.nl' },
    stand: maakStand({ bestand: bestand() }), bewijs: BEWEZEN, bevoegd: MAG, providerGezond: () => ({ gezond: true }) });
  assert.equal(v.overzicht().lokaleInstallatie, false);
  assert.equal(v.valideer().openbaar, true);
  assert.equal(v.zet('geld.intern_saldo', 'sandbox', ZET).status, 409, 'openbaar kent geen sandbox');
  /* Een testinstallatie zonder adres is lokaal: daar begint een capability
     zonder vastgelegde stand op sandbox. */
  const t = maakVrijgave({ env: { NODE_ENV: 'test' }, stand: maakStand({ bestand: bestand() }), bewijs: BEWEZEN, bevoegd: MAG,
    providerGezond: () => ({ gezond: true }) });
  const o = t.overzicht();
  assert.equal(o.lokaleInstallatie, true);
  assert.equal(o.capabilities.find(c => c.id === 'geld.intern_saldo').standBron, 'lokale-standaard');
  assert.equal(t.beoordeel('geld.intern_saldo', { recht: true, rail: 'intern' }).beschikbaar, true);
});

test('een lokaal-functie die gooit, maakt het overzicht niet lokaal', () => {
  const v = maakVrijgave({ stand: maakStand({ bestand: bestand() }), openbaar: () => false,
    lokaal: () => { throw new Error('stuk'); }, bewijs: BEWEZEN });
  assert.equal(v.overzicht().lokaleInstallatie, false);
});

test('het overzicht: per-verzoek-capabilities per echte provider, besluiten met hun stand, en een configuratiefout', () => {
  const b = bestand();
  const v = maakVrijgave({ stand: maakStand({ bestand: b }), openbaar: () => false, lokaal: () => false, bewijs: BEWEZEN,
    bevoegd: MAG, providerGezond: () => ({ gezond: true }) });
  assert.ok(v.besluitVastleggen('inkomend.handelaar', BESLUIT).ok);
  assert.ok(v.besluitVastleggen('provider.stripe', BESLUIT).ok);
  assert.ok(v.zet('geld.inkomend', 'enabled', ZET).ok);
  assert.ok(v.zet('geld.provider.stripe', 'enabled', ZET).ok);
  const o = v.overzicht();
  assert.equal(o.versie, 4);
  assert.equal(o.configuratiefout, null);
  assert.deepEqual(o.baseline, { naam: B.NAAM, vastgesteld: B.VASTGESTELD, bron: B.BRON });
  assert.equal(o.besluiten.find(x => x.besluit === 'provider.stripe').vastgelegd, true);
  assert.equal(o.besluiten.find(x => x.besluit === 'emoney.b3').vastgelegd, false);
  const inkomend = o.capabilities.find(c => c.id === 'geld.inkomend');
  assert.deepEqual(Object.keys(inkomend.perProvider), ['stripe', 'mollie', 'adyen']);
  assert.equal(inkomend.beschikbaar, false, 'zonder provider dicht');
  assert.equal(inkomend.perProvider.stripe.beschikbaarVoorRechthebbende, true, inkomend.perProvider.stripe.intern);
  assert.equal(inkomend.perProvider.stripe.code, null);
  assert.equal(inkomend.perProvider.mollie.code, 'provider-niet-beschikbaar');
  assert.equal(inkomend.baseline, 'in-baseline');
  assert.equal(o.capabilities.find(c => c.id === 'geld.intern_saldo').perProvider, null);
  /* Het standbestand kapot: het overzicht noemt de fout en heeft geen versie. */
  fs.writeFileSync(b, JSON.stringify({ formaat: FORMAAT, versie: 9, standen: { x: { stand: 'aan' } }, besluiten: {}, geschiedenis: [] }));
  const v2 = maakVrijgave({ stand: maakStand({ bestand: b }), openbaar: () => false, lokaal: () => false, bewijs: BEWEZEN });
  const k = v2.overzicht();
  assert.equal(k.versie, null);
  assert.match(k.configuratiefout, /onbekende stand "aan"/);
  assert.match(v2.valideer().fouten.join(' '), /^standbestand: /);
});

test('schaduwtelling en standbestand zijn uitleesbaar; koppel zet alleen wat is meegegeven', () => {
  const b = bestand();
  const log = [];
  const v = maakVrijgave({ stand: maakStand({ bestand: b }), openbaar: () => false, lokaal: () => false, bewijs: BEWEZEN });
  assert.equal(v.standbestand, b);
  v.koppel({ audit: (wie, zin) => log.push(zin) });
  assert.ok(v.zet('geld.intern_saldo', 'shadow', ZET).ok);
  assert.equal(log.length, 1, 'de gekoppelde audit schrijft');
  assert.equal(v.beoordeel('geld.intern_saldo', { recht: true }).code, 'tijdelijk-uit');
  assert.deepEqual(v.schaduwTelling(), { 'geld.intern_saldo': { zouDoor: 0, zouDicht: 1 } }, 'zonder bevoegdheidslaag zou hij dicht');
  v.koppel({ bevoegd: MAG });
  v.beoordeel('geld.intern_saldo', { recht: true });
  assert.deepEqual(v.schaduwTelling()['geld.intern_saldo'], { zouDoor: 1, zouDicht: 1 });
  v.koppel({});
  v.beoordeel('geld.intern_saldo', { recht: true });
  assert.deepEqual(v.schaduwTelling()['geld.intern_saldo'], { zouDoor: 2, zouDicht: 1 }, 'een lege koppeling haalt niets weg');
  v.koppel({ gezondheid: () => ({ door: false, error: 'proef' }) });
  assert.match(v.beoordeel('geld.intern_saldo', { recht: true }).intern, /quarantaine:proef/);
});

test('keurBijStart: goed geeft het verslag, fout buiten openbaar waarschuwt (ook via log.log of een gooiend log), openbaar gooit', () => {
  const goed = { valideer: () => ({ ok: true, fouten: [], openbaar: true }) };
  assert.deepEqual(keurBijStart(goed, null), { ok: true, fouten: [], openbaar: true });
  const fout = { valideer: () => ({ ok: false, fouten: ['a', 'b'], openbaar: false }) };
  const w = [];
  assert.equal(keurBijStart(fout, { warn: z => w.push(z) }).ok, false);
  assert.deepEqual(w, ['Vrijgavepoort: configuratiefout -- a; b (alles staat dicht)']);
  const l = [];
  keurBijStart(fout, { log: z => l.push(z) });
  assert.equal(l.length, 1, 'zonder warn via log');
  assert.equal(keurBijStart(fout, { warn: () => { throw new Error('log stuk'); } }).ok, false, 'een gooiend log breekt de start niet');
  const openbaar = { valideer: () => ({ ok: false, fouten: ['kapot'], openbaar: true }) };
  assert.throws(() => keurBijStart(openbaar, { warn: () => {} }),
    e => e.code === 'VRIJGAVE_CONFIGURATIEFOUT' && /kapot/.test(e.message));
});

test('weigering: null als het mag, het antwoord als het dicht is, en andere fouten gaan door', () => {
  const b = bestand();
  const v = maakVrijgave({ stand: maakStand({ bestand: b }), openbaar: () => false, lokaal: () => false, bewijs: BEWEZEN,
    bevoegd: MAG });
  assert.ok(v.zet('geld.intern_saldo', 'enabled', ZET).ok);
  assert.equal(weigering('geld.intern_saldo', { recht: true }, v), null);
  assert.deepEqual(weigering('geld.intern_saldo', {}, v), { status: 403, error: require('../server/kern/vrijgave').ZIN['geen-recht'],
    code: 'geen-recht', capability: 'geld.intern_saldo' });
  const stuk = { eis: () => { throw new TypeError('iets anders'); } };
  assert.throws(() => weigering('geld.intern_saldo', {}, stuk), TypeError);
});

test('standaard() geeft per proces een en hetzelfde exemplaar', () => {
  assert.equal(standaard(), standaard());
});

/* --- het baselineoordeel, puur op een overzicht --- */
const rij = (id, open, x = {}) => Object.assign({ id, beschikbaarVoorRechthebbende: open, geimplementeerd: true, geverifieerd: open,
  geautoriseerd: true, ingeschakeld: true, afhankelijkhedenGezond: true, perProvider: null }, x);
const per = (open, x = {}) => Object.assign({ beschikbaarVoorRechthebbende: open, geimplementeerd: true, geverifieerd: true,
  geautoriseerd: true, ingeschakeld: open, afhankelijkhedenGezond: true, code: open ? null : 'tijdelijk-uit', intern: open ? 'beschikbaar' : 'stand:disabled' }, x);
function goedOverzicht() {
  return { capabilities: Object.entries(B.BASELINE).map(([id, b]) => {
    const inB = b.soort === 'in-baseline';
    if (b.via) return rij(id, false, { perProvider: { stripe: per(true), mollie: per(false), adyen: per(false) } });
    return rij(id, inB);
  }) };
}

test('baseline: een goed overzicht haalt hem, en zonder overzicht is er niets te beoordelen', () => {
  const r = B.beoordeel(goedOverzicht());
  assert.deepEqual(r.fouten, []);
  assert.equal(r.ok, true);
  assert.equal(r.baseline, 'V1');
  assert.equal(r.regels.find(x => x.id === 'geld.inkomend').via, 'stripe');
  for (const o of [null, {}, { capabilities: 'x' }])
    assert.deepEqual(B.beoordeel(o), { ok: false, fouten: ['er is geen vrijgaveoverzicht om te beoordelen'], regels: [] });
  assert.equal(B.vanCapability('geld.verzonnen'), null);
});

test('baseline: iedere soort fout heeft zijn eigen melding', () => {
  const o = goedOverzicht();
  o.configuratiefout = 'kapot bestand';
  const vind = id => o.capabilities.find(c => c.id === id);
  /* in-baseline maar dicht, met en zonder interne reden en met een ontbrekende as */
  Object.assign(vind('geld.provider.stripe'), { beschikbaarVoorRechthebbende: false, ingeschakeld: false, intern: 'stand:disabled', code: 'tijdelijk-uit' });
  Object.assign(vind('geld.partnerafrekening'), { beschikbaarVoorRechthebbende: false, geverifieerd: false });
  /* via-provider ontbreekt in perProvider, en een die geen object is */
  vind('geld.inkomend').perProvider = { mollie: per(false) };
  vind('geld.terugbetaling').perProvider = 'stripe';
  /* buiten de baseline open, rechtstreeks en via een provider */
  vind('geld.provider.mollie').beschikbaarVoorRechthebbende = true;
  vind('geld.opwaarderen').perProvider = { stripe: null, adyen: per(true) };
  /* een capability die niet in de baseline staat, en een die er wel staat maar ontbreekt */
  o.capabilities.push(rij('geld.nieuw', false));
  o.capabilities = o.capabilities.filter(c => c.id !== 'geld.provider.adyen');
  const r = B.beoordeel(o);
  assert.equal(r.ok, false);
  const f = r.fouten;
  assert.ok(f.includes('configuratiefout in de vrijgavestand: kapot bestand'), f.join('\n'));
  assert.ok(f.includes('geld.provider.stripe: hoort in de V1-baseline beschikbaar te zijn, maar niet: ingeschakeld (stand:disabled)'), f.join('\n'));
  assert.ok(f.includes('geld.partnerafrekening: hoort in de V1-baseline beschikbaar te zijn, maar niet: geverifieerd'), f.join('\n'));
  assert.ok(f.some(x => x.startsWith('geld.inkomend: hoort in de V1-baseline beschikbaar te zijn, maar niet: ') && x.includes('[via stripe]')), f.join('\n'));
  assert.ok(f.some(x => x.startsWith('geld.terugbetaling: hoort in de V1-baseline')), f.join('\n'));
  assert.ok(f.includes('geld.provider.mollie: staat buiten de V1-baseline maar is BESCHIKBAAR; dat hoort aantoonbaar dicht te zijn'));
  assert.ok(f.includes('geld.opwaarderen: staat nog als besluit-open buiten de V1-baseline maar is BESCHIKBAAR; dat hoort aantoonbaar dicht te zijn'));
  assert.ok(f.includes('geld.nieuw: staat niet in de V1-baseline (een vergeten besluit, geen "niet")'));
  assert.ok(f.includes('geld.provider.adyen: staat in de baseline maar niet in het register'));
  const regel = r.regels.find(x => x.id === 'geld.provider.stripe');
  assert.deepEqual(regel, { id: 'geld.provider.stripe', baseline: 'in-baseline', via: null, beschikbaar: false,
    ontbrekendeAssen: ['ingeschakeld'], code: 'tijdelijk-uit', intern: 'stand:disabled' });
});

test('baseline: een in-baseline-capability die dicht is zonder ontbrekende as noemt "onbekend"', () => {
  const o = goedOverzicht();
  Object.assign(o.capabilities.find(c => c.id === 'geld.provider.stripe_connect'), { beschikbaarVoorRechthebbende: false, geverifieerd: true });
  const f = B.beoordeel(o).fouten;
  assert.deepEqual(f, ['geld.provider.stripe_connect: hoort in de V1-baseline beschikbaar te zijn, maar niet: onbekend']);
});

test('baseline en register lopen gelijk: iedere capability heeft precies een soort', () => {
  assert.deepEqual(Object.keys(B.BASELINE).sort(), reg.REGISTER.map(c => c.id).sort());
  for (const b of Object.values(B.BASELINE)) assert.ok(B.SOORTEN.includes(b.soort));
});
