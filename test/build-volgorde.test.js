'use strict';

/* De echte buildbesturing, zonder bestanden, generatoren of browsers te starten.
   De modules en het bestandssysteem worden in dezelfde VM-stijl vervangen als
   bij bundelherkomst-ratel; stempelen en de async buildvolgorde blijven echt. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');

const BUILD = require.resolve('../scripts/build');
const BRON = fs.readFileSync(BUILD, 'utf8');
const ROOT = '/rtg-build-proef', PUB = ROOT + '/public';
const sha = tekst => crypto.createHash('sha256').update(tekst).digest('hex');
const verklein = tekst => '/* geminificeerd */\n' + tekst;

function proef() {
  const bestanden = new Map([
    ['apps/app.html', '<meta name="rtg-bouw" content="oud"><script src="/apps/app-main.js"></script>'],
    ['apps/app-main.js', "var RTG_BOUW = 'oud';\nwindow.oud = true;"],
    ['apps/app-main/app-main-01.js', "var RTG_BOUW = 'oud';\nwindow.nieuw = true;"],
    ['apps/util.js', 'window.util = true;'],
    ['sw.js', "const CACHE = 'rtg-app-oud';"]
  ].map(([p, inhoud]) => [PUB + '/' + p, inhoud]));
  const lees = p => {
    if (!bestanden.has(p)) throw new Error('onverwacht bestand: ' + p);
    return bestanden.get(p);
  };
  const mappen = new Set([PUB]);
  function map(p) {
    while (p.startsWith(ROOT)) { mappen.add(p); p = path.dirname(p); }
  }
  for (const p of bestanden.keys()) map(path.dirname(p));
  const fakeFs = {
    existsSync: p => bestanden.has(p) || mappen.has(p),
    readFileSync: (p, encoding) => encoding ? lees(p) : Buffer.from(lees(p)),
    writeFileSync: (p, inhoud) => { bestanden.set(p, String(inhoud)); },
    mkdirSync: p => map(p),
    readdirSync: p => [...new Set([...mappen, ...bestanden.keys()]
      .filter(k => k !== p && path.dirname(k) === p).map(k => path.basename(k)))].sort(),
    statSync: p => ({ isDirectory: () => mappen.has(p), isFile: () => bestanden.has(p) }),
    rmSync: p => {
      for (const k of bestanden.keys()) if (k === p || k.startsWith(p + '/')) bestanden.delete(k);
      for (const k of mappen) if (k === p || k.startsWith(p + '/')) mappen.delete(k);
    }
  };
  let bewijsHash = 'bewijs-van-vorige-bron';
  const bronHash = () => sha(lees(PUB + '/apps/app.html') + '\n' + lees(PUB + '/apps/app-main.js'));
  const bewijsFout = new Error('appbeeld loopt achter op de schermbron');
  async function bouw() {
    const stappen = [], fouten = [], controles = [], logs = [];
    let exitCode = 0;
    const modules = {
      fs: fakeFs, path, crypto,
      './lib/swvingerafdruk': { cachenaamVoor: () => ({ nieuw: 'rtg-app-' + bronHash().slice(0, 8) }) },
      './ast/minify': { minify: async code => { await Promise.resolve(); return { code: verklein(code) }; } },
      './workspace-worlds': { schrijf: () => { stappen.push('werelden'); bestanden.set(PUB + '/wereld.json', '{}'); } },
      './world-widgets': { schrijf: () => { stappen.push('widgets'); bestanden.set(PUB + '/widgets.json', '{}'); } },
      './bundel': {
        bundels: { 'apps/app-main.js': 'apps/app-main' },
        schrijfBundels: () => {
          stappen.push('bundels');
          bestanden.set(PUB + '/apps/app-main.js', lees(PUB + '/apps/app-main/app-main-01.js'));
          return ['apps/app-main.js'];
        }
      },
      './websitewaarheid': { schrijf: () => {
        stappen.push('websitewaarheid');
        controles.push(new Map(bestanden));
        if (bewijsHash !== bronHash()) throw bewijsFout;
        bestanden.set(PUB + '/site/website-truth.json', JSON.stringify({ sourceHash: bewijsHash }));
      } }
    };
    await vm.runInNewContext(BRON, {
      __dirname: ROOT + '/scripts', Buffer,
      require: naam => {
        if (!Object.hasOwn(modules, naam)) throw new Error('onverwachte module: ' + naam);
        return modules[naam];
      },
      console: { log: s => logs.push(s), warn: s => logs.push(s), error: (_, e) => fouten.push(e) },
      process: { exit: code => { exitCode = code; } }
    }, { filename: BUILD });
    return { stappen, fouten, controles, logs, exitCode };
  }
  return { bouw, bestanden, bewijsFout, bronHash,
    meetBewijs: () => { bewijsHash = bronHash(); }, bewijs: () => bewijsHash };
}

test('verouderd beeldbewijs faalt pas nadat bundel, bouwstempel, minify en SW definitief zijn', async () => {
  const p = proef(), uit = await p.bouw();
  assert.deepEqual(uit.stappen, ['werelden', 'widgets', 'bundels', 'websitewaarheid']);
  assert.equal(uit.controles.length, 1);
  const bron = uit.controles[0].get(PUB + '/apps/app-main.js');
  assert.match(bron, /window\.nieuw = true/);
  assert.match(bron, /var RTG_BOUW = '[0-9a-f]{8}';/);
  assert.equal(uit.controles[0].get(PUB + '/dist/min/apps/app-main.js'), verklein(bron),
    'de serveerbare minify moet al dezelfde definitieve bouwstempel dragen');
  assert.match(uit.controles[0].get(PUB + '/sw.js'), /rtg-app-[0-9a-f]{8}/);
  assert.equal(uit.exitCode, 1, 'stale bewijs blijft een harde buildfout');
  assert.deepEqual(uit.fouten, [p.bewijsFout], 'de bewijsfout blijft ongewijzigd zichtbaar');
  assert.equal(uit.logs.includes('[build] klaar.'), false);
  assert.equal(p.bestanden.has(PUB + '/site/website-truth.json'), false);
  assert.equal(p.bewijs(), 'bewijs-van-vorige-bron', 'de build vervaardigt zelf geen beeldbewijs');
});

test('na eenmaal nieuw gemeten bewijs veranderen twee herbuilds geen bron- of artefactbytes', async () => {
  const p = proef();
  assert.equal((await p.bouw()).exitCode, 1);
  const bronVoorBeeld = p.bronHash();
  const voorBeeld = new Map(p.bestanden);
  p.meetBewijs(); // Alleen de proef stelt een nieuw extern meetresultaat beschikbaar.
  const eerste = await p.bouw();
  assert.equal(eerste.exitCode, 0);
  assert.deepEqual(eerste.fouten, []);
  assert.equal(p.bronHash(), bronVoorBeeld, 'een nieuwe build maakt het zojuist gemeten beeld niet stale');
  for (const [bestand, bytes] of voorBeeld) assert.equal(p.bestanden.get(bestand), bytes, bestand);
  const naEerste = new Map(p.bestanden);
  const tweede = await p.bouw();
  assert.equal(tweede.exitCode, 0);
  assert.deepEqual(tweede.fouten, []);
  assert.deepEqual(p.bestanden, naEerste);
  assert.equal(tweede.logs.at(-1), '[build] klaar.');
});

test('een volgende bronwijziging maakt bestaand beeldbewijs opnieuw hard stale', async () => {
  const p = proef();
  await p.bouw(); p.meetBewijs(); await p.bouw();
  const bewijs = p.bewijs();
  p.bestanden.set(PUB + '/apps/app-main/app-main-01.js', "var RTG_BOUW = 'oud';\nwindow.volgend = true;");
  const uit = await p.bouw();
  assert.equal(uit.exitCode, 1);
  assert.deepEqual(uit.fouten, [p.bewijsFout]);
  assert.match(p.bestanden.get(PUB + '/apps/app-main.js'), /window\.volgend = true/);
  assert.notEqual(p.bronHash(), bewijs);
  assert.equal(p.bewijs(), bewijs, 'geen bijwerken of negeren van oude bewijs-hashes');
});
