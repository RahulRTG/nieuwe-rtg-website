/* HET OORDEEL VAN DE VRIJGAVEPOORT (server/kern/vrijgave/oordeel.js), los van
   bestand en bewijsketen: een nagebootst register, een stand in geheugen en
   een bewijs dat we zelf kiezen. Wat hier wordt nagetrokken zijn de zijpaden
   die de bredere toetsen niet raken: standaarden als `lokaal`/`sandboxMag`
   ontbreken, een lezing die gooit, een te diep register, een stand die de
   capability niet kent, een provider- of gezondheidsvraag die faalt, en de
   handhavers `eis` en `eisHttp` met hun veilige foutvorm. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const maakOordeel = require('../server/kern/vrijgave/oordeel');
const { ZIN } = require('../server/kern/vrijgave/antwoord');

const ALLE = ['disabled', 'shadow', 'sandbox', 'enabled', 'suspended', 'emergency_disabled'];
const cap = (id, x = {}) => Object.assign({ id, geimplementeerd: true, standen: ALLE, veiligeStand: 'disabled',
  afhankelijk: [], provider: null, bewijs: { controles: ['reconciliation'] }, bevoegdheid: { besluit: 'emoney.b3' } }, x);

/* Een opstelling waarin alles open staat, met per toets een as om te breken. */
function opstelling(o = {}) {
  const caps = new Map((o.caps || [cap('geld.a')]).map(c => [c.id, c]));
  const standen = o.standen || {};
  const besluiten = o.besluiten || { 'emoney.b3': { wie: 'user-1' } };
  const st = o.st || {
    standVan: id => standen[id] || { stand: 'enabled', versie: 3 },
    besluit: n => besluiten[n] || null
  };
  const schaduw = new Map();
  const deps = {
    st, schaduw,
    bw: o.bw || { oordeel: () => ({ geverifieerd: true, reden: 'proef', commit: 'c1', inhoudSha256: 'h1' }) },
    pg: o.pg || (() => ({ gezond: true })),
    isOpenbaar: o.isOpenbaar || (() => false),
    k: o.k || {},
    register: { vind: id => caps.get(id) || null },
    lokaal: o.lokaal,
    sandboxMag: o.sandboxMag
  };
  return Object.assign(maakOordeel(deps), { schaduw });
}

test('alles open met recht: beschikbaar, en de bewijsherkomst gaat mee in het oordeel', () => {
  const p = opstelling();
  const o = p.beoordeel('geld.a', { recht: true });
  assert.equal(o.beschikbaar, true);
  assert.equal(o.standBron, 'vastgelegd');
  assert.equal(o.standVersie, 3);
  assert.deepEqual(o.bewijs, { reden: 'proef', commit: 'c1', inhoudSha256: 'h1' });
  assert.equal(o.intern, 'beschikbaar (besluit:emoney.b3)');
  assert.equal(o.code, undefined);
});

test('een autorisatie zonder reden levert "beschikbaar" zonder haakjes, en zonder versie staat standVersie op null', () => {
  const p = opstelling({ caps: [cap('geld.a', { bevoegdheid: {} })], standen: { 'geld.a': { stand: 'enabled' } },
    bw: { oordeel: () => ({ geverifieerd: true, reden: 'proef' }) } });
  const o = p.beoordeel('geld.a', { recht: true });
  assert.equal(o.beschikbaar, true);
  assert.equal(o.intern, 'beschikbaar');
  assert.equal(o.standVersie, null);
  assert.deepEqual(o.bewijs, { reden: 'proef', commit: null, inhoudSha256: null });
});

test('een onbekende id bestaat niet, en een register dat dieper gaat dan acht lagen valt tijdelijk uit', () => {
  const p = opstelling();
  const o = p.beoordeel('geld.bestaatniet', { recht: true });
  assert.equal(o.code, 'bestaat-niet-voor-dit-product');
  assert.equal(o.intern, 'onbekende-capability');
  assert.equal(o.beschikbaar, false);
  /* Een kring die het register-keurwerk ontglipte: a -> a. Het oordeel moet
     eindigen, en dicht. */
  const kring = opstelling({ caps: [cap('geld.a', { afhankelijk: ['geld.a'] })] });
  const k = kring.beoordeel('geld.a', { recht: true });
  assert.equal(k.beschikbaar, false);
  assert.equal(k.code, 'tijdelijk-uit');
  assert.match(k.intern, /afhankelijk:geld\.a:tijdelijk-uit/);
  assert.equal(kring.beoordeel('geld.a', { recht: true }, 9).intern, 'afhankelijkheden-te-diep');
});

test('een stand die de capability zelf niet kent, is een configuratiefout en nooit een variant van aan', () => {
  const p = opstelling({ caps: [cap('geld.a', { standen: ['disabled', 'emergency_disabled'] })] });
  const o = p.beoordeel('geld.a', { recht: true });
  assert.equal(o.ingeschakeld, false);
  assert.equal(o.code, 'tijdelijk-uit');
  assert.match(o.intern, /^configuratiefout: stand enabled is voor deze capability niet toegestaan/);
});

test('een standbestand met een fout: geen stand, geen bron, dicht met de fout als reden', () => {
  const p = opstelling({ st: { standVan: () => ({ fout: 'kapot' }), besluit: () => ({}) } });
  const o = p.beoordeel('geld.a', { recht: true });
  assert.equal(o.stand, null);
  assert.equal(o.standBron, null);
  assert.equal(o.code, 'tijdelijk-uit');
  assert.match(o.intern, /configuratiefout: kapot/);
});

test('uitgezet is "bestaat niet", stilgezet is "tijdelijk uit", en de interne reden noemt ook de andere ontbrekende assen', () => {
  const dicht = { oordeel: () => ({ geverifieerd: false, reden: 'geen-dossier' }) };
  const p = opstelling({ standen: { 'geld.a': { stand: 'disabled', versie: 1 } }, bw: dicht, besluiten: {} });
  const o = p.beoordeel('geld.a', { recht: true });
  assert.equal(o.code, 'bestaat-niet-voor-dit-product');
  assert.match(o.intern, /^stand:disabled/);
  assert.match(o.intern, /bewijs:geen-dossier/);
  assert.match(o.intern, /autorisatie:besluit-ontbreekt:emoney\.b3/);
  const q = opstelling({ standen: { 'geld.a': { stand: 'suspended', versie: 1 } } });
  assert.equal(q.beoordeel('geld.a', { recht: true }).code, 'tijdelijk-uit');
});

test('zonder lokaal-functie geldt niets als lokaal, en zonder sandboxMag beslist "niet openbaar"', () => {
  /* Een standaardstand (niets vastgelegd) blijft dan de veilige stand. */
  const p = opstelling({ standen: { 'geld.a': { stand: 'disabled', standaard: true, versie: 0 } } });
  const o = p.beoordeel('geld.a', { recht: true, rail: 'simulatie' });
  assert.equal(o.standBron, 'veilige-standaard');
  assert.equal(o.stand, 'disabled');
  /* Een vastgelegde sandbox op een neprail werkt via de standaard sandboxMag
     zolang de installatie niet openbaar is ... */
  const sb = { 'geld.a': { stand: 'sandbox', versie: 1 } };
  const open = opstelling({ standen: sb });
  const ja = open.beoordeel('geld.a', { recht: true, rail: 'simulatie' });
  assert.equal(ja.beschikbaar, true, ja.intern);
  assert.equal(ja.bewijs.reden, 'sandbox-zonder-echt-geld');
  /* ... en niet zodra hij openbaar is. */
  const openbaar = opstelling({ standen: sb, isOpenbaar: () => true });
  const nee = openbaar.beoordeel('geld.a', { recht: true, rail: 'simulatie' });
  assert.equal(nee.beschikbaar, false);
  assert.match(nee.intern, /sandbox-niet-toegestaan-in-deze-installatie/);
});

test('een lokaal-functie die gooit, telt als niet lokaal; een sandboxMag die gooit als "mag niet"', () => {
  const p = opstelling({ standen: { 'geld.a': { stand: 'disabled', standaard: true, versie: 0 } },
    lokaal: () => { throw new Error('stuk'); } });
  assert.equal(p.beoordeel('geld.a', { recht: true, rail: 'simulatie' }).standBron, 'veilige-standaard');
  const q = opstelling({ standen: { 'geld.a': { stand: 'sandbox', versie: 1 } },
    sandboxMag: () => { throw new Error('stuk'); } });
  const o = q.beoordeel('geld.a', { recht: true, rail: 'simulatie' });
  assert.equal(o.beschikbaar, false);
  assert.match(o.intern, /sandbox-niet-toegestaan/);
});

test('de lokale standaard begint op sandbox, en het interne grootboek is alleen lokaal een neprail', () => {
  const st = { 'geld.a': { stand: 'disabled', standaard: true, versie: 0 } };
  const lok = opstelling({ standen: st, lokaal: () => true, sandboxMag: () => true });
  const o = lok.beoordeel('geld.a', { recht: true, rail: 'intern' });
  assert.equal(o.standBron, 'lokale-standaard');
  assert.equal(o.stand, 'sandbox');
  assert.equal(o.beschikbaar, true, o.intern);
  /* Een echte provider is nooit een neprail. */
  const echt = lok.beoordeel('geld.a', { recht: true, rail: 'stripe' });
  assert.equal(echt.beschikbaar, false);
  assert.match(echt.intern, /sandbox-alleen-op-neprail/);
  /* Zonder rail ook niet. */
  assert.match(lok.beoordeel('geld.a', { recht: true }).intern, /sandbox-alleen-op-neprail/);
  /* Niet lokaal, wel een vastgelegde sandbox: `intern` is dan GEEN neprail. */
  const nietLok = opstelling({ standen: { 'geld.a': { stand: 'sandbox', versie: 1 } }, lokaal: () => false, sandboxMag: () => true });
  assert.match(nietLok.beoordeel('geld.a', { recht: true, rail: 'intern' }).intern, /sandbox-alleen-op-neprail/);
});

test('een vaste provider wordt op een actieve sandbox niet gevraagd, en elders wel -- ook als de vraag gooit', () => {
  const c = cap('geld.p', { provider: 'stripe' });
  const sb = opstelling({ caps: [c], standen: { 'geld.p': { stand: 'sandbox', versie: 1 } }, sandboxMag: () => true,
    pg: () => { throw new Error('mag niet gevraagd worden'); } });
  const o = sb.beoordeel('geld.p', { recht: true, rail: 'magnaat-test' });
  assert.equal(o.beschikbaar, true, o.intern);
  const aan = opstelling({ caps: [c], pg: () => { throw new Error('stuk'); } });
  const x = aan.beoordeel('geld.p', { recht: true });
  assert.equal(x.code, 'provider-niet-beschikbaar');
  assert.match(x.intern, /provider-ongezond:onbekend/);
  const ziek = opstelling({ caps: [c], pg: () => ({ gezond: false, reden: 'sleutel weg' }) });
  assert.match(ziek.beoordeel('geld.p', { recht: true }).intern, /provider-ongezond:sleutel weg/);
  const leeg = opstelling({ caps: [c], pg: () => null });
  assert.match(leeg.beoordeel('geld.p', { recht: true }).intern, /provider-ongezond:onbekend/);
});

test('per-verzoek-provider: zonder provider, met een onbekende, en met een die dicht staat', () => {
  const caps = [cap('geld.in', { provider: 'per-verzoek' }), cap('geld.provider.stripe')];
  const p = opstelling({ caps, standen: { 'geld.provider.stripe': { stand: 'suspended', versie: 1 } } });
  const zonder = p.beoordeel('geld.in', { recht: true });
  assert.equal(zonder.code, 'provider-niet-beschikbaar');
  assert.match(zonder.intern, /provider-onbekend/);
  assert.match(p.beoordeel('geld.in', { recht: true, provider: 'mollie' }).intern, /provider-niet-in-register:mollie/);
  /* De rail telt als provider als er geen provider is opgegeven. */
  const via = p.beoordeel('geld.in', { recht: true, rail: 'stripe' });
  assert.equal(via.code, 'provider-niet-beschikbaar');
  assert.match(via.intern, /afhankelijk:geld\.provider\.stripe:tijdelijk-uit/);
});

test('een afhankelijkheid zonder autorisatie of bewijs geeft die code door; een die uit staat maakt hem tijdelijk uit', () => {
  const caps = [cap('geld.a', { afhankelijk: ['geld.b'] }), cap('geld.b', { bevoegdheid: { vermogen: 'X' } })];
  const zonderLaag = opstelling({ caps });
  assert.equal(zonderLaag.beoordeel('geld.a', { recht: true }).code, 'niet-geautoriseerd');
  const caps2 = [cap('geld.a', { afhankelijk: ['geld.b'] }), cap('geld.b', { bevoegdheid: { besluit: 'provider.mollie' } })];
  assert.equal(opstelling({ caps: caps2 }).beoordeel('geld.a', { recht: true }).code, 'compliance-ontbreekt');
});

test('de gezondheidsvraag: een quarantaine sluit, een gooiende vraag ook, en "door" sluit niets', () => {
  const q = opstelling({ k: { gezondheid: () => ({ door: false, error: 'te veel fouten' }) } });
  const o = q.beoordeel('geld.a', { recht: true });
  assert.equal(o.code, 'tijdelijk-uit');
  assert.match(o.intern, /quarantaine:te veel fouten/);
  const g = opstelling({ k: { gezondheid: () => { throw new Error('x'); } } });
  assert.match(g.beoordeel('geld.a', { recht: true }).intern, /quarantaine:gezondheid onleesbaar/);
  const zonderFout = opstelling({ k: { gezondheid: () => ({ door: false }) } });
  assert.match(zonderFout.beoordeel('geld.a', { recht: true }).intern, /quarantaine:$/);
  assert.equal(opstelling({ k: { gezondheid: () => ({ door: true }) } }).beoordeel('geld.a', { recht: true }).beschikbaar, true);
  assert.equal(opstelling({ k: { gezondheid: () => null } }).beoordeel('geld.a', { recht: true }).beschikbaar, true);
});

test('het recht van de actor: systeem telt, een waarheidsachtige waarde niet', () => {
  const p = opstelling();
  assert.equal(p.beoordeel('geld.a', { actor: { soort: 'systeem' } }).beschikbaar, true);
  const o = p.beoordeel('geld.a', { recht: 1, actor: { soort: 'lid' } });
  assert.equal(o.code, 'geen-recht');
  assert.equal(o.beschikbaarVoorRechthebbende, true);
  assert.match(o.intern, /actor-zonder-vastgesteld-recht/);
  assert.equal(p.beoordeel('geld.a').code, 'geen-recht', 'zonder ctx');
});

test('niet geimplementeerd gaat voor alles, en de schaduw telt alleen op het bovenste niveau', () => {
  const caps = [cap('geld.n', { geimplementeerd: false }), cap('geld.s', { afhankelijk: ['geld.t'] }), cap('geld.t')];
  const standen = { 'geld.s': { stand: 'shadow', versie: 1 }, 'geld.t': { stand: 'shadow', versie: 1 } };
  const p = opstelling({ caps, standen });
  const n = p.beoordeel('geld.n', { recht: true });
  assert.equal(n.code, 'bestaat-niet-voor-dit-product');
  assert.match(n.intern, /^niet-geimplementeerd/);
  p.beoordeel('geld.t', { recht: true });   // alle assen behalve de stand: zou door
  p.beoordeel('geld.t', {});                // zonder recht: zou dicht
  assert.deepEqual(p.schaduw.get('geld.t'), { zouDoor: 1, zouDicht: 1 });
  /* geld.s hangt aan geld.t (schaduw: niet beschikbaar): zou dicht. De
     onderliggende vraag (diepte 1) telt niet bij geld.t. */
  p.beoordeel('geld.s', { recht: true });
  assert.deepEqual(p.schaduw.get('geld.s'), { zouDoor: 0, zouDicht: 1 });
  assert.deepEqual(p.schaduw.get('geld.t'), { zouDoor: 1, zouDicht: 1 });
});

test('eis: open geeft het oordeel terug, dicht gooit VRIJGAVE_DICHT met de juiste status en zin', () => {
  const p = opstelling();
  assert.equal(p.eis('geld.a', { recht: true }).beschikbaar, true);
  assert.throws(() => p.eis('geld.a', {}), e => e.code === 'VRIJGAVE_DICHT' && e.status === 403 &&
    e.vrijgaveCode === 'geen-recht' && e.message === ZIN['geen-recht'] && e.nietVerstuurd === true && e.capability === 'geld.a');
  const q = opstelling({ besluiten: {} });
  assert.throws(() => q.eis('geld.a', { recht: true }), e => e.status === 503 && e.vrijgaveCode === 'compliance-ontbreekt' &&
    /besluit-ontbreekt/.test(e.intern));
  assert.throws(() => q.eis('geld.bestaatniet'), e => e.vrijgaveCode === 'bestaat-niet-voor-dit-product' && e.status === 503);
});

test('eisHttp: true als het mag, anders een 403/503-antwoord zonder interne reden; vreemde fouten gaan door', () => {
  const p = opstelling();
  const res = () => { const r = { s: null, j: null, status(x) { r.s = x; return r; }, json(x) { r.j = x; return r; } }; return r; };
  const a = res();
  assert.equal(p.eisHttp(a, 'geld.a', { recht: true }), true);
  assert.equal(a.s, null);
  const b = res();
  assert.equal(p.eisHttp(b, 'geld.a', {}), false);
  assert.equal(b.s, 403);
  assert.deepEqual(b.j, { error: ZIN['geen-recht'], code: 'geen-recht', capability: 'geld.a' });
  assert.equal('intern' in b.j, false);
  const kapot = opstelling({ st: { standVan: () => { throw new Error('schijf weg'); }, besluit: () => null } });
  assert.throws(() => kapot.eisHttp(res(), 'geld.a', { recht: true }), /schijf weg/);
});
