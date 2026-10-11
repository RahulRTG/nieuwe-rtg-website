/* DE DRIE CONTROLES VAN DE EIGENAAR OP DE VRIJGAVEPOORT, als tegenstander.

   (a) BESCHIKBAAR WORDT NOOIT OPGESLAGEN EN IS NIET TE ZETTEN. Het is een
       uitkomst, per verzoek uitgerekend (server/kern/vrijgave/oordeel.js), en
       staat nergens als veld: niet in het standbestand, niet in wat schakelen
       wegschrijft, niet in wat een route uit een lichaam leest. Een standbestand
       dat zo'n veld toch draagt, is ongeldig -- en dan is alles dicht.
   (b) GEVERIFIEERD IS GEEN KNOP. Geen route of handeling kan hem zetten; hij
       komt uit het release-gebonden bewijs (server/kern/vrijgave/bewijs.js), en
       bewijs van een andere commit of inhoud, bewijs dat verdwijnt of wordt
       veranderd, en OUT_OF_SCOPE (het bewijs van een release ZONDER rail) zijn
       allemaal niet geverifieerd.
   (c) DE RANGORDE IS MONOTOON: noodstop > autorisatie > kwalificatie >
       providergereedheid > inschakeling > recht > actor. Over ALLE combinaties:
       een lagere laag (recht, actor, of wat een verzoek er verder bij verzint --
       tenant, gebruiker, contract, `beschikbaar: true`, een neprail) kan een nee
       van een hogere laag nooit in een ja veranderen. Het oordeel is een EN.

   Over "verlopen": het externe dossier (server/config/external-release.js) kent
   GEEN vervaldatum -- een PASS van een release blijft voor die release een PASS.
   Wat hier als verlopen wordt beproefd, is bewijs dat na de controle verdwijnt
   of verandert: dat telt bij het eerstvolgende oordeel niet meer, ook niet uit
   de cache. Een maximale ouderdom op het dossier zelf is een besluit dat nog niet
   genomen is. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { maakVrijgave } = require('../server/kern/vrijgave');
const { maakStand, FORMAAT, VELDEN } = require('../server/kern/vrijgave/stand');
const { maakBewijs } = require('../server/kern/vrijgave/bewijs');
const reg = require('../server/kern/vrijgave/register');
const { maakGetekendeVrijgave } = require('./foundation-vrijgave-fixture');

const ROOT = path.join(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vrijgave-rangorde-'));
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }));
let n = 0;
const map = () => { const d = path.join(TMP, 'm' + (++n)); fs.mkdirSync(d, { recursive: true }); return d; };
const zonderCommentaar = (bron) => bron.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
const VERBODEN = /\b(beschikbaar|beschikbaarVoorRechthebbende|available|geverifieerd|verified)\b/;

/* --------------------------------------------------------------------- (a) */
test('(a) beschikbaar en geverifieerd staan in geen enkel veld dat de poort OPSLAAT of uit een verzoek LEEST', () => {
  for (const soort of Object.keys(VELDEN)) for (const veld of VELDEN[soort])
    assert.doesNotMatch(veld, VERBODEN, 'het standbestand mag het veld ' + veld + ' dragen');
  /* De schrijvers: stand, standkeur en schakelen. In CODE (niet in uitleg) komt
     geen van de woorden voor -- er is dus niets dat zo'n veld kan wegschrijven. */
  for (const rel of ['server/kern/vrijgave/stand.js', 'server/kern/vrijgave/standkeur.js', 'server/kern/vrijgave/schakelen.js']) {
    const bron = zonderCommentaar(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    assert.doesNotMatch(bron, VERBODEN, rel + ' noemt een uitkomst in code');
  }
  /* De deur: de schakelroutes lezen uit het lichaam precies id, stand, reden,
     versie, besluit, bron, sha256 en intrekken -- en verder niets. */
  const route = zonderCommentaar(fs.readFileSync(path.join(ROOT, 'server/routes/kantoren/vrijgave.js'), 'utf8'));
  /* Alleen binnen de handlers die het lichaam als `b` nemen (`const b = req.body`). */
  const handlers = route.split('const b = req.body').slice(1).map(h => h.split('app.post(')[0]);
  assert.equal(handlers.length, 2, 'de twee schakelhandlers zijn gevonden');
  const gelezen = new Set(handlers.flatMap(h => [...h.matchAll(/\bb\.([A-Za-z0-9_]+)/g)].map(m => m[1])));
  assert.deepEqual([...gelezen].sort(), ['besluit', 'bron', 'id', 'intrekken', 'reden', 'sha256', 'stand', 'versie'],
    'de schakelroute leest een veld uit het lichaam dat er niet hoort');
  assert.doesNotMatch(route.replace(/oordeel: vrijgave\.beoordeel\([^)]*\)/, ''), /\.(beschikbaar|geverifieerd)\s*=/,
    'de route zet een uitkomst');
});

test('(a) een schakeling met beschikbaar/geverifieerd erbij schrijft ze niet weg', () => {
  const bestand = path.join(map(), 'vrijgave-stand.json');
  const v = maakVrijgave({ stand: maakStand({ bestand }), openbaar: () => false, lokaal: () => false, bewijs: maakBewijs({ root: map() }),
    bevoegd: { mag: () => ({ mag: true }) }, providerGezond: () => ({ gezond: true }) });
  const r = v.zet('geld.provider.stripe', 'enabled', { wie: 'user-1', reden: 'aan met extra velden', stapOmhoog: true,
    beschikbaar: true, geverifieerd: true, available: true, verified: true });
  assert.equal(r.ok, true);
  const staat = JSON.parse(fs.readFileSync(bestand, 'utf8'));
  assert.deepEqual(Object.keys(staat.standen['geld.provider.stripe']).sort(), ['reden', 'sinds', 'stand', 'wie']);
  assert.doesNotMatch(JSON.stringify(staat), VERBODEN, 'een uitkomst kwam in het standbestand');
  assert.equal(v.beoordeel('geld.provider.stripe', { recht: true }).beschikbaar, false, 'zonder bewijs is aan nog geen beschikbaar');
});

test('(a) mutatie: een standbestand dat beschikbaar of geverifieerd draagt, opent niets -- het hele bestand is ongeldig', () => {
  const vergiftigd = [
    ['in een stand', s => { s.standen['geld.provider.stripe'].beschikbaar = true; }],
    ['in een stand, geverifieerd', s => { s.standen['geld.provider.stripe'].geverifieerd = true; }],
    ['bovenin', s => { s.beschikbaar = { 'geld.provider.stripe': true }; }],
    ['bovenin, geverifieerd', s => { s.geverifieerd = ['geld.provider.stripe']; }],
    ['in een besluit', s => { s.besluiten['provider.stripe'].geverifieerd = true; }],
    ['Engels', s => { s.standen['geld.provider.stripe'].available = true; s.standen['geld.provider.stripe'].verified = true; }]
  ];
  for (const [naam, gif] of vergiftigd) {
    const bestand = path.join(map(), 'vrijgave-stand.json');
    const staat = { formaat: FORMAAT, versie: 3, geschiedenis: [],
      standen: { 'geld.provider.stripe': { stand: 'enabled', wie: 'user-1', sinds: 'nu', reden: 'aan' } },
      besluiten: { 'provider.stripe': { wie: 'user-1', op: 'nu', bron: 'contract', sha256: 'a'.repeat(64), reden: 'getekend' } } };
    gif(staat);
    fs.writeFileSync(bestand, JSON.stringify(staat));
    /* Het bewijs ONTBREEKT (een lege releasemap), alle andere assen staan open. */
    const v = maakVrijgave({ stand: maakStand({ bestand }), openbaar: () => false, lokaal: () => false, bewijs: maakBewijs({ root: map() }),
      bevoegd: { mag: () => ({ mag: true }) }, providerGezond: () => ({ gezond: true }) });
    const o = v.beoordeel('geld.provider.stripe', { recht: true });
    assert.equal(o.beschikbaar, false, naam + ': het veld opende de capability');
    assert.equal(o.geverifieerd, false, naam + ': het veld maakte bewijs');
    assert.match(o.intern, /configuratiefout/, naam + ': het bestand gold als geldig');
    assert.equal(v.valideer().ok, false, naam + ': de opstartcontrole zag het niet');
  }
});

/* --------------------------------------------------------------------- (b) */
test('(b) geverifieerd is geen knop: de vrijgave kent drie routes en geen van drie raakt het bewijs', () => {
  const { alleRoutes } = require('../scripts/lib/routes');
  const routes = alleRoutes().filter(r => /vrijgave/.test(r.pad)).map(r => r.methode + ' ' + r.pad).sort();
  assert.deepEqual(routes, ['POST /api/office/vrijgave', 'POST /api/office/vrijgave/besluit', 'POST /api/office/vrijgave/stand']);
  const v = maakVrijgave({ stand: maakStand({ bestand: path.join(map(), 's.json') }), openbaar: () => false });
  for (const naam of Object.keys(v)) assert.doesNotMatch(naam, /bewijs|verifi|beschikbaar|forceer|override/i, 'een knop: ' + naam);
  /* Alleen de bewijslaag (een geverifieerd dossier) en de sandbox op een neprail
     zeggen ooit `geverifieerd: true` -- en die tweede alleen buiten productie. */
  for (const f of fs.readdirSync(path.join(ROOT, 'server/kern/vrijgave'))) {
    const bron = zonderCommentaar(fs.readFileSync(path.join(ROOT, 'server/kern/vrijgave', f), 'utf8'));
    if (/geverifieerd:\s*true/.test(bron)) assert.ok(['bewijs.js', 'oordeel.js'].includes(f), f + ' maakt bewijs');
  }
});

test('(b) ander commit, andere inhoud, verdwenen of veranderd bewijs, en OUT_OF_SCOPE: niet geverifieerd', () => {
  const stripe = reg.vind('geld.provider.stripe');
  const root = map();
  maakGetekendeVrijgave(root);
  let klok = 1000;
  const b = maakBewijs({ root, nu: () => klok });
  assert.equal(b.oordeel(stripe).geverifieerd, true, 'het proefdossier zelf is geldig');
  // een dossier van een andere commit dan de draaiende code
  const ander = map(); maakGetekendeVrijgave(ander, { runtimeCommit: 'f'.repeat(40) });
  assert.equal(maakBewijs({ root: ander }).oordeel(stripe).geverifieerd, false, 'bewijs van een andere commit');
  // andere inhoud: de inhoudshash van de draaiende release klopt niet meer
  const inhoud = map(); maakGetekendeVrijgave(inhoud);
  const rbPad = path.join(inhoud, 'release-bewijs.json');
  const rb = JSON.parse(fs.readFileSync(rbPad, 'utf8')); rb.inhoudSha256 = 'd'.repeat(64);
  fs.writeFileSync(rbPad, JSON.stringify(rb, null, 2) + '\n');
  assert.equal(maakBewijs({ root: inhoud }).oordeel(stripe).geverifieerd, false, 'bewijs over andere inhoud');
  // een gewijzigd bestand van de draaiende code (de inhoud is niet meer die van het bewijs)
  const code = map(); maakGetekendeVrijgave(code);
  fs.appendFileSync(path.join(code, 'server', 'app.js'), '// later aangepast\n');
  assert.equal(maakBewijs({ root: code }).oordeel(stripe).geverifieerd, false, 'bewijs over code die niet meer draait');
  // OUT_OF_SCOPE: het geldige verslag van een release ZONDER rail
  const zonder = map(); maakGetekendeVrijgave(zonder, { moneyDisabled: true });
  for (const c of reg.REGISTER.filter(x => x.geld))
    assert.equal(maakBewijs({ root: zonder }).oordeel(c).geverifieerd, false, c.id + ' werd door OUT_OF_SCOPE vrijgegeven');
  // verdwenen na de controle: het volgende oordeel ziet het, ook binnen de cachetijd
  fs.rmSync(path.join(root, '.release', 'external-release.sig'));
  klok += 1;
  assert.equal(b.oordeel(stripe).geverifieerd, false, 'verdwenen bewijs telde uit de cache');
});

/* --------------------------------------------------------------------- (c) */
test('(c) de rangorde over alle combinaties: een lagere laag maakt van een hoger nee nooit een ja', () => {
  const STANDEN = ['emergency_disabled', 'suspended', 'disabled', 'enabled'];
  const ACTOREN = [undefined, { soort: 'kantoor', wie: 'user-1' }, { soort: 'lid' }, { soort: 'systeem' }];
  /* Wat een verzoek er verder bij kan zetten. Geen van deze mag een uitkomst
     veranderen: het oordeel leest ze niet, of -- voor de rail -- alleen binnen
     een actieve sandbox, en die bestaat hier niet (`lokaal: () => false`). */
  const VERZONNEN = [{}, { tenant: 'rtg', gebruiker: 'user-1', contract: 'actief' }, { beschikbaar: true, geverifieerd: true,
    ingeschakeld: true, geautoriseerd: true, stand: 'enabled' }, { rail: 'simulatie' }, { rail: 'intern' },
    { forceer: true, override: true, noodstop: false }];
  let gevallen = 0, open = 0;
  for (const stand of STANDEN) for (const besluit of [false, true]) for (const bewijs of [false, true])
    for (const gezond of [false, true]) {
      const bestand = path.join(map(), 'vrijgave-stand.json');
      const v = maakVrijgave({ stand: maakStand({ bestand }), openbaar: () => false, lokaal: () => false,
        bewijs: { oordeel: () => ({ geverifieerd: bewijs, reden: bewijs ? 'proef' : 'geen' }) },
        bevoegd: { mag: () => ({ mag: true }) }, providerGezond: () => ({ gezond }) });
      if (besluit) assert.ok(v.besluitVastleggen('provider.stripe', { wie: 'user-1', bron: 'contract-1', sha256: 'a'.repeat(64),
        reden: 'getekend in de proef', stapOmhoog: true }).ok);
      if (stand !== 'disabled') assert.ok(v.zet('geld.provider.stripe', stand, { wie: 'user-1', reden: 'stand in de proef', stapOmhoog: true }).ok);
      for (const recht of [undefined, false, 'ja', true]) for (const actor of ACTOREN) {
        const gerechtigd = recht === true || !!(actor && actor.soort === 'systeem');
        const verwacht = stand === 'enabled' && besluit && bewijs && gezond && gerechtigd;
        let eerste = null;
        for (const extra of VERZONNEN) {
          const ctx = Object.assign({}, extra, recht === undefined ? {} : { recht }, actor ? { actor } : {});
          const o = v.beoordeel('geld.provider.stripe', ctx);
          gevallen++;
          assert.equal(o.beschikbaar, verwacht, JSON.stringify({ stand, besluit, bewijs, gezond, recht, actor, extra }) + ' -> ' + o.intern);
          if (o.beschikbaar) open++;
          if (!eerste) eerste = o;
          else assert.equal(o.code, eerste.code, 'een verzonnen veld veranderde de code: ' + JSON.stringify(extra));
        }
      }
    }
  assert.ok(gevallen >= 1500 && open > 0 && open < gevallen, 'de tabel liep echt (' + gevallen + ' gevallen, ' + open + ' open)');
});

test('(c) de voorbeelden van de eigenaar, met naam', () => {
  const bestand = path.join(map(), 'vrijgave-stand.json');
  const MAG = { mag: () => ({ mag: true }) };
  const v = maakVrijgave({ stand: maakStand({ bestand }), openbaar: () => false, lokaal: () => false,
    bewijs: { oordeel: () => ({ geverifieerd: true, reden: 'proef' }) }, bevoegd: MAG, providerGezond: () => ({ gezond: true }) });
  assert.ok(v.besluitVastleggen('provider.stripe', { wie: 'user-1', bron: 'contract-1', sha256: 'a'.repeat(64), reden: 'getekend in de proef', stapOmhoog: true }).ok);
  assert.ok(v.zet('geld.provider.stripe', 'emergency_disabled', { wie: 'user-1', reden: 'noodstop in de proef' }).ok);
  const nood = v.beoordeel('geld.provider.stripe', { recht: true, actor: { soort: 'systeem' }, tenant: 'rtg', beschikbaar: true });
  assert.equal(nood.beschikbaar, false, 'emergency_disabled en al het andere waar: toch dicht');
  /* Ingeschakeld, recht waar, en de AUTORISATIE ontbreekt (een vermogen dat de
     bevoegdheidslaag weigert): dicht. */
  const w = maakVrijgave({ stand: maakStand({ bestand: path.join(map(), 's.json') }), openbaar: () => false, lokaal: () => false,
    bewijs: { oordeel: () => ({ geverifieerd: true, reden: 'proef' }) }, bevoegd: { mag: () => ({ mag: false, reden: 'geen-vergunning' }) },
    providerGezond: () => ({ gezond: true }) });
  assert.ok(w.zet('geld.intern_saldo', 'enabled', { wie: 'user-1', reden: 'aan in de proef', stapOmhoog: true }).ok);
  const aut = w.beoordeel('geld.intern_saldo', { recht: true, actor: { soort: 'kantoor', wie: 'user-1' }, contract: 'actief' });
  assert.equal(aut.beschikbaar, false); assert.equal(aut.code, 'niet-geautoriseerd');
  /* En een `rail` uit het verzoek slaat op `enabled` de providervraag niet over. */
  const x = maakVrijgave({ stand: maakStand({ bestand: path.join(map(), 's2.json') }), openbaar: () => false, lokaal: () => false,
    bewijs: { oordeel: () => ({ geverifieerd: true, reden: 'proef' }) }, bevoegd: MAG, providerGezond: () => ({ gezond: true }) });
  x.besluitVastleggen('inkomend.handelaar', { wie: 'user-1', bron: 'contract-2', sha256: 'a'.repeat(64), reden: 'getekend in de proef', stapOmhoog: true });
  assert.ok(x.zet('geld.inkomend', 'enabled', { wie: 'user-1', reden: 'aan in de proef', stapOmhoog: true }).ok);
  const r = x.beoordeel('geld.inkomend', { recht: true, rail: 'simulatie' });
  assert.equal(r.beschikbaar, false, 'een neprail in het verzoek sloeg de provider over');
  assert.equal(r.code, 'provider-niet-beschikbaar');
});
