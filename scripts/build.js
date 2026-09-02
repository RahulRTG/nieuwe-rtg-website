/* Frontend-build (npm run build):
   1. minify de gedeelde JS naar public/dist met een content-hash in de naam,
      en schrijf een manifest + een groottrapport;
   2. stempel de service-worker CACHE-namen op een content-hash van hun shell,
      zodat de cache automatisch verandert als er iets wijzigt (geen handmatige
      versie-bumps meer, en nooit meer een verouderde cache).
   Idempotent: verandert er niets aan de bron, dan verandert er niets. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const swAfdruk = require('./lib/swvingerafdruk');
const { minify } = require('./ast/minify');
const { bundels, schrijfBundels } = require('./bundel');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');

// De mappen met losse delen van de grote app-scripts: die worden gebundeld en
// niet zelf uitgeserveerd, dus overslaan bij het minificeren.
const DEEL_MAPPEN = new Set(Object.values(bundels).map((m) => path.join(PUB, m)));
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// Loop public/ af en verzamel alle serveerbare .js-bestanden. De service-workers
// en de dist-map slaan we over: een SW laten we bewust ongemoeid, en dist is de
// uitvoer zelf.
function verzamelJs(dir, uit) {
  for (const naam of fs.readdirSync(dir)) {
    const p = path.join(dir, naam);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (naam === 'dist' || DEEL_MAPPEN.has(p)) continue;
      verzamelJs(p, uit);
    } else if (naam.endsWith('.js') && naam !== 'sw.js') {
      uit.push(p);
    }
  }
  return uit;
}

// Minify elke serveerbare .js naar public/dist/min/<zelfde-pad>. De server
// serveert dit bestand transparant op de originele URL zolang het verser is dan
// de bron (mtime-controle), en valt anders terug op de bron. Geen hash in de
// naam: de service-worker en de cache-headers regelen de versiebeheersing al.
async function minifyServe() {
  const bronnen = verzamelJs(PUB, []);
  const minRoot = path.join(PUB, 'dist', 'min');
  fs.rmSync(minRoot, { recursive: true, force: true }); // stale entries opruimen
  let voor = 0, na = 0, aantal = 0;
  for (const f of bronnen) {
    const code = fs.readFileSync(f, 'utf8');
    let min;
    try {
      const res = await minify(code, { compress: true, mangle: true });
      min = res.code || code;
    } catch (e) { min = code; } // kan het niet gecomprimeerd worden, dan de bron
    const doel = path.join(minRoot, path.relative(PUB, f));
    fs.mkdirSync(path.dirname(doel), { recursive: true });
    fs.writeFileSync(doel, min);
    voor += Buffer.byteLength(code); na += Buffer.byteLength(min); aantal++;
  }
  console.log(`[build] serveerbaar geminificeerd: ${aantal} bestanden, ${voor} -> ${na} bytes (${Math.round((1 - na / voor) * 100)}% kleiner)`);
}

async function minifyGedeeld() {
  const bronnen = ['apps/util.js', 'apps/translate.js', 'apps/geo.js', 'shared/realtime.js', 'apps/foundation/sessie.js']
    .map((p) => path.join(PUB, p)).filter((f) => fs.existsSync(f));
  const dist = path.join(PUB, 'dist');
  fs.mkdirSync(dist, { recursive: true });
  const manifest = {};
  let voor = 0, na = 0;
  for (const f of bronnen) {
    const code = fs.readFileSync(f, 'utf8');
    const res = await minify(code, { compress: true, mangle: true });
    const min = res.code || code;
    const naam = path.basename(f).replace(/\.js$/, '') + '.' + sha(min).slice(0, 10) + '.min.js';
    fs.writeFileSync(path.join(dist, naam), min);
    manifest[path.relative(PUB, f).replace(/\\/g, '/')] = 'dist/' + naam;
    voor += Buffer.byteLength(code); na += Buffer.byteLength(min);
  }
  fs.writeFileSync(path.join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`[build] geminificeerd: ${bronnen.length} bestanden, ${voor} -> ${na} bytes (${Math.round((1 - na / voor) * 100)}% kleiner)`);
}

/* De bouwstempel: app.html en app-main.js krijgen hetzelfde getal.

   Waarom dit bestaat: een browser, CDN of service worker kan de pagina vers
   hebben en het script nog uren oud. Die mix bouwt het beginscherm niet meer op
   en levert een zwart scherm zonder foutmelding. Met een gedeelde stempel ziet
   het script zelf dat het niet bij deze pagina hoort, en haalt het zich eenmalig
   vers op (zie app-main-01.js). De stempel is de inhoud van de bundel, dus hij
   verandert precies wanneer het script verandert en niet vaker. */
function stempelBouw() {
  const html = path.join(PUB, 'apps', 'app.html');
  const js = path.join(PUB, 'apps', 'app-main.js');
  const sandbox = path.join(PUB, 'apps', 'magnaat-sandbox.js');
  const magnaatData = path.join(PUB, 'apps', 'magnaat-data.js');
  const interfaceDelen = [];
  (function verzamelInterface(dir) {
    if (!fs.existsSync(dir)) return;
    for (const naam of fs.readdirSync(dir)) {
      const p = path.join(dir, naam), st = fs.statSync(p);
      if (st.isDirectory()) verzamelInterface(p);
      else if (/\.(?:js|css)$/.test(naam)) interfaceDelen.push(p);
    }
  })(path.join(PUB, 'shared', 'interface'));
  const commandDelen = ['shared/command.js', 'shared/command/catalog.js', 'shared/command/console.js',
    'shared/command/verdeler.js', 'shared/command/bank.js', 'shared/command/praat.js',
    'shared/command/inlogpoort.js', 'shared/command/bladhaak.js', 'shared/command/romp.js',
    'shared/command/geheugen.js', 'shared/command/werktafel.js', 'shared/command.css', 'shared/rtg-schil.js']
    .map(p => path.join(PUB, p)).concat(interfaceDelen.sort());
  if (!fs.existsSync(html) || !fs.existsSync(js)) return;
  let s = fs.readFileSync(js, 'utf8');
  const proeflaag = Buffer.concat([sandbox, magnaatData].filter(fs.existsSync).map(p => fs.readFileSync(p)));
  const hash = crypto.createHash('sha256')
    .update(s.replace(/var RTG_BOUW = '[^']*';/, ''))
    .update(proeflaag)
    .update(Buffer.concat(commandDelen.filter(fs.existsSync).map(p => fs.readFileSync(p))))
    .digest('hex').slice(0, 8);
  let h = fs.readFileSync(html, 'utf8');
  const nieuwJs = s.replace(/var RTG_BOUW = '[^']*';/, "var RTG_BOUW = '" + hash + "';");
  const nieuwH = h.replace(/<meta name="rtg-bouw" content="[^"]*">/, '<meta name="rtg-bouw" content="' + hash + '">')
    /* De Magnaat-sandbox draait vóór app-main en bepaalt of synthetische data
       überhaupt mag bestaan. Een oude browsercache van juist dit bestand liet
       de nieuwe app-code zonder testdata starten. Koppel hem daarom aan exact
       dezelfde bouwstempel als HTML en app-main. */
    .replace(/\/apps\/magnaat-sandbox\.js(?:\?v=[^"]*)?/, '/apps/magnaat-sandbox.js?v=' + hash);
  const nieuwHMetTestdata = nieuwH.replace(
    /\/apps\/magnaat-data\.js(?:\?v=[^"]*)?/,
    '/apps/magnaat-data.js?v=' + hash
  );
  const nieuwHMetCommand = nieuwHMetTestdata.replace(
    /(\/shared\/command(?:\/[^"?]+)?\.js)(?:\?v=[^"]*)?/g,
    '$1?v=' + hash
  );
  /* De twee scripts krijgen dezelfde immutable bouwstempel als Command. Het
     stylesheet blijft bewust kaal: zo blijft het onderdeel van de bestaande
     stijlbundel, die zelf alle bron-mtimes in zijn ETag draagt. Een ?v= op juist
     dit ene blad breekt de cascade-rij in twee extra blokkerende bundels. */
  const nieuwHMetInterface = nieuwHMetCommand.replace(
    /(\/shared\/interface\/[^"?]+\.js)(?:\?v=[^"]*)?/g,
    '$1?v=' + hash
  );
  if (nieuwJs !== s) fs.writeFileSync(js, nieuwJs);
  if (nieuwHMetInterface !== h) fs.writeFileSync(html, nieuwHMetInterface);
  const werkruimte = path.join(PUB, 'apps', 'werkruimte.html');
  if (fs.existsSync(werkruimte)) {
    const wr = fs.readFileSync(werkruimte, 'utf8');
    const nwr = wr.replace(/\/shared\/rtg-schil\.js(?:\?v=[^"]*)?/, '/shared/rtg-schil.js?v=' + hash);
    if (nwr !== wr) fs.writeFileSync(werkruimte, nwr);
  }
  // ook het deel bijwerken, anders draait de volgende build de bundel terug
  const deel = path.join(PUB, 'apps', 'app-main', 'app-main-01.js');
  if (fs.existsSync(deel)) {
    const d = fs.readFileSync(deel, 'utf8');
    const nd = d.replace(/var RTG_BOUW = '[^']*';/, "var RTG_BOUW = '" + hash + "';");
    if (nd !== d) fs.writeFileSync(deel, nd);
  }
  console.log('[build] bouwstempel: ' + hash);
}

function stempelServiceWorkers() {
  for (const sw of ['sw.js', 'apps/foundation/sw.js']) {
    const p = path.join(PUB, sw);
    if (!fs.existsSync(p)) continue;
    let s = fs.readFileSync(p, 'utf8');
    const m = s.match(/const CACHE = '([^']*)';/);
    if (!m) { console.warn('[build] geen CACHE in', sw); continue; }
    /* EEN BRON VOOR DE AFDRUK. Dit rekende hier ooit zelf, en anders dan
       scripts/swcache.js -- zie de kop van ./lib/swvingerafdruk.js voor wat
       dat kostte. */
    const uit = swAfdruk.cachenaamVoor(s, PUB);
    if (!uit) { console.warn('[build] geen SHELL in', sw); continue; }
    const nieuw = uit.nieuw;
    if (m[1] !== nieuw) { s = s.replace(/const CACHE = '[^']*';/, `const CACHE = '${nieuw}';`); fs.writeFileSync(p, s); }
    console.log(`[build] service-worker ${sw}: CACHE = ${nieuw}`);
  }
}

(async () => {
  require('./workspace-worlds').schrijf();
  const gebundeld = schrijfBundels();
  console.log('[build] gebundeld: ' + (gebundeld.length ? gebundeld.join(', ') : 'bundels al actueel'));
  await minifyGedeeld();
  await minifyServe();
  stempelBouw();
  stempelServiceWorkers();
  console.log('[build] klaar.');
})().catch((e) => { console.error('[build] mislukt:', e); process.exit(1); });
