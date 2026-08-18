#!/usr/bin/env node
/* ============================================================================
   HOE VOL IS EEN APP -- gemeten aan wat hij DOET, niet aan wat er staat.

   WAAROM DIT SCRIPT ER IS

   docs/apps-volwaardig.md was gebouwd op een telling die letterlijke
   `/api/`-paden in de bron zocht. Dat is dezelfde fout die scripts/keuring.js
   twee keer heeft gemaakt en die in server/routelog.js met naam staat: een
   meter die TEKST leest in plaats van waarnemingen. Hij liegt twee kanten op.

   Te laag, want vrijwel elke app in dit huis roept zijn server aan via een
   hulpje: `api('cellier')` of `rh('cercle/club')`, met het voorvoegsel ergens
   anders. Dat pad staat nergens voluit, dus die app telde als nul endpoints en
   heette een "schil".

   Te hoog, want een pad in een commentaarregel telt gewoon mee. Het cijfer was
   dus met een zoek-en-vervang op te poetsen zonder ook maar een regel te
   bouwen.

   Daardoor stonden er 35 "schillen" in dat document waar er volgens de tellende
   ogen 4 waren, en 1 volwaardige app waar er 20 waren.

   HOE HET WEL MOET

   Vraag het niet aan de tekst maar aan de browser. Dit script opent elk
   app-scherm met een gewone ledensessie en telt wat de pagina ECHT doet:

     - hoeveel verschillende /api/-endpoints hij aanroept (unieke paden, en de
       parameters eruit gefilterd zodat /api/x/12 en /api/x/13 een zijn);
     - hoeveel knoppen en velden er staan als de pagina klaar is met opbouwen
       (dus inclusief wat de JS erbij zet, en dat is het halve verhaal);
     - hoeveel tekst er staat.

   Wat er niet in zit en waarom: de service worker wordt geblokkeerd, want die
   haalt schermen vooruit op die deze app niet zelf gebruikt.

   DRAAIEN

     node scripts/appdiepte.js
     node scripts/appdiepte.js --json
     node scripts/appdiepte.js --md > docs/apps-volwaardig.md
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const jsonUit = process.argv.includes('--json');
const mdUit = process.argv.includes('--md');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  return null;
}

/* WAT DIT CIJFER WEL EN NIET IS. Het telt wat een app doet bij het OPENEN, en
   dat is met opzet: dat is de enige stand die je van alle eenentachtig apps op
   dezelfde manier kunt meten. Maar het is niet hetzelfde als "hoe vol is deze
   app". De meeste schermen halen hun tweede en derde lading pas op als je een
   tabblad aantikt, en dat doet dit script niet -- daarvoor zijn de
   schermtoetsen in test/*.e2e.js, die per app de echte weg aflopen.

   De verdeling laat dat ook zien: vier apps op een endpoint, dertig op twee,
   tweeenveertig op drie, vijf op vier of meer. Zo'n smalle spreiding is geen
   ranglijst maar een ondergrens. Daarom kent dit script maar EEN grens, en die
   is uitlegbaar: een app die na aftrek van de gedeelde schil hooguit EEN
   endpoint aanroept, haalt iets op en toont het. Meer niet.

   De rest krijgt geen etiket. Een cijfer dat niet discrimineert hoort geen
   oordeel te dragen -- precies de fout die de vorige versie van
   docs/apps-volwaardig.md maakte, alleen dan andersom. */
const SCHIL = 1;

async function meet() {
  const pw = laadBrowser();
  if (!pw) { console.error('Geen browser beschikbaar; dit script meet in een echte browser.'); process.exit(2); }
  const { startServer } = require(path.join(WORTEL, 'test', 'helper.js'));
  const rijen = [].concat(require(path.join(WORTEL, 'server/kern/appcatalogus-rijen/deel1')),
                          require(path.join(WORTEL, 'server/kern/appcatalogus-rijen/deel2')));

  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-appdiepte-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const uit = [];
  let browser;
  try {
    const u = Date.now().toString().slice(-8);
    const lid = await fetch(base + '/api/auth/register', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Meetlid', email: 'md' + u + '@x.nl', phone: '06' + u,
        password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg' }) }).then(r => r.json());
    if (!lid || !lid.token) throw new Error('geen ledensessie: ' + JSON.stringify(lid).slice(0, 160));

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    await page.addInitScript((tok) => {
      try { localStorage.setItem('rtg_member_token', tok); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
    }, lid.token);

    for (const rij of rijen) {
      const [id, naam, cat, url] = rij;
      const paden = new Set();
      const tel = r => {
        try {
          const p = new URL(r.url()).pathname;
          // parameters eruit: /api/gezin/AB12/agenda telt als /api/gezin/:x/agenda
          if (p.startsWith('/api/')) paden.add(p.replace(/\/[0-9a-f]{6,}|\/\d+/gi, '/:x'));
        } catch (e) { /* geen url */ }
      };
      page.on('request', tel);
      let dom = { knoppen: 0, velden: 0, tekens: 0 };
      try {
        await page.goto(base + url, { waitUntil: 'load', timeout: 30000 });
        await new Promise(r => setTimeout(r, 1200));
        dom = await page.evaluate(() => ({
          knoppen: document.querySelectorAll('button, a[href]').length,
          velden: document.querySelectorAll('input:not([type=hidden]), textarea, select').length,
          tekens: document.body.innerText.replace(/\s+/g, ' ').trim().length
        }));
      } catch (e) { /* een scherm dat niet laadt telt als nul */ }
      page.off('request', tel);
      const eps = paden.size;
      uit.push({ id, naam, cat, url, paden: [...paden].sort(), knoppen: dom.knoppen, velden: dom.velden, tekens: dom.tekens });
    }
  } finally {
    if (browser) await browser.close();
    try { child.kill(); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
  /* DE GEDEELDE SCHIL ERAF. Elke pagina in dit huis laadt hetzelfde OS-menu,
     dezelfde gids en dezelfde metgezel, en die doen hun eigen aanroepen. Die
     meetellen zou precies de fout zijn die dit script komt repareren: dan meet
     je de schil en niet de app, en heet een leeg scherm "halfvol".

     Wat op ELKE gemeten pagina voorkomt is per definitie niet van deze app.
     Het aftrekken gebeurt dus niet met een lijst die iemand bijhoudt, maar met
     wat de meting zelf laat zien -- dan kan hij ook niet verouderen. */
  const overal = uit.length ? uit[0].paden.filter(p => uit.every(r => r.paden.includes(p))) : [];
  for (const r of uit) {
    r.gedeeld = overal.length;
    r.endpoints = r.paden.filter(p => !overal.includes(p)).length;
    r.soort = r.endpoints <= SCHIL ? 'schil' : 'werkend';
    delete r.paden;
  }
  uit.schil = overal;
  return uit;
}

function alsMd(rijen) {
  const tel = s => rijen.filter(r => r.soort === s).length;
  const nu = new Date().toISOString().slice(0, 10);
  const verdeling = {};
  for (const r of rijen) verdeling[r.endpoints] = (verdeling[r.endpoints] || 0) + 1;

  let m = '# Hoe vol is elke OS-app\n\n';
  m += 'Een inventarisatie, gemeten en niet geschat. Per app staat wat hij bij het\n';
  m += 'openen ECHT doet: hoeveel verschillende server-endpoints hij aanroept, en\n';
  m += 'hoeveel knoppen en velden er staan als de pagina klaar is met opbouwen.\n\n';
  m += '**Gemeten op ' + nu + ' met `node scripts/appdiepte.js`.**\n\n';

  m += '## Waarom dit opnieuw gemeten is\n\n';
  m += 'De vorige versie telde letterlijke `/api/`-paden in de bron. Dat is een\n';
  m += 'tekstzoektocht, en die liegt twee kanten op: te laag, want vrijwel elke app\n';
  m += 'roept zijn server aan via een hulpje (`api(\'cellier\')`) waardoor het pad\n';
  m += 'nergens voluit staat; en te hoog, want een pad in een commentaarregel telt\n';
  m += 'gewoon mee. Zo stonden er 35 "schillen" in dit document. Het zijn er ' + tel('schil') + '.\n\n';
  m += 'Deze meting vraagt het aan de browser: elk scherm gaat open met een gewone\n';
  m += 'ledensessie, en wat de pagina dan aanroept is wat er geteld wordt. De\n';
  m += 'gedeelde schil (het OS-menu en de metgezel, die op ELKE pagina hetzelfde\n';
  m += 'aanroepen) wordt eraf getrokken -- niet met een lijst die iemand bijhoudt,\n';
  m += 'maar met wat op alle eenentachtig pagina\'s tegelijk voorkomt. Zo kan die\n';
  m += 'aftrek niet verouderen.\n\n';

  m += '## Wat dit cijfer NIET is\n\n';
  m += 'Het is geen ranglijst. Het telt wat een app doet bij het OPENEN, want dat\n';
  m += 'is de enige stand die je van alle apps op dezelfde manier kunt meten. De\n';
  m += 'meeste schermen halen hun tweede en derde lading pas op als je een tabblad\n';
  m += 'aantikt. De verdeling laat dat zien:\n\n';
  m += '| endpoints bij het openen | apps |\n|---|---|\n';
  for (const k of Object.keys(verdeling).sort((a, b) => a - b)) {
    m += '| ' + k + ' | ' + verdeling[k] + ' |\n';
  }
  m += '\nZo\'n smalle spreiding is een ondergrens, geen oordeel. Daarom kent dit\n';
  m += 'document maar EEN grens: een app die na aftrek van de schil hooguit een\n';
  m += 'endpoint aanroept, haalt iets op en toont het. De rest krijgt geen etiket --\n';
  m += 'een cijfer dat niet discrimineert hoort er geen te dragen.\n\n';
  m += 'Wat er wel per app is nagelopen staat in `test/*.e2e.js`: die lopen de weg\n';
  m += 'van een scherm werkelijk af, inclusief de tabbladen. `scripts/schermen.js`\n';
  m += 'houdt bij hoeveel apps zo\'n toets nog missen.\n\n';

  const schillen = rijen.filter(r => r.soort === 'schil').sort((a, b) => a.naam.localeCompare(b.naam));
  m += '## De ' + schillen.length + ' schillen\n\n';
  m += 'Deze halen bij het openen hooguit een ding op. Dat hoeft geen gebrek te\n';
  m += 'zijn: een scherm dat bewust een ding doet is af met nul aanroepen. Het is\n';
  m += 'de lijst om NAAR TE KIJKEN, niet de lijst van wat stuk is.\n\n';
  m += '| app | endpoints | knoppen | velden | tekens |\n|---|---|---|---|---|\n';
  for (const r of schillen) {
    m += '| ' + r.naam + ' | ' + r.endpoints + ' | ' + r.knoppen + ' | ' + r.velden + ' | ' + r.tekens + ' |\n';
  }
  m += '\n## Alle apps\n\n';
  m += '| app | endpoints | knoppen | velden | tekens |\n|---|---|---|---|---|\n';
  for (const r of rijen.slice().sort((a, b) => b.endpoints - a.endpoints || a.naam.localeCompare(b.naam))) {
    m += '| ' + r.naam + ' | ' + r.endpoints + ' | ' + r.knoppen + ' | ' + r.velden + ' | ' + r.tekens + ' |\n';
  }
  return m;
}

meet().then(rijen => {
  if (jsonUit) { process.stdout.write(JSON.stringify(rijen, null, 1) + '\n'); return; }
  if (mdUit) { process.stdout.write(alsMd(rijen)); return; }
  const tel = s => rijen.filter(r => r.soort === s).length;
  console.log('\n\x1b[1mHOE VOL IS ELKE OS-APP\x1b[0m \x1b[2m(gemeten in de browser, niet in de tekst)\x1b[0m\n');
  console.log('  apps gemeten     ' + String(rijen.length).padStart(4));
  console.log('  gedeelde schil   ' + String((rijen.schil || []).length).padStart(4) +
    '   (op elke pagina, dus niet van de app: ' + (rijen.schil || []).join(', ') + ')');
  console.log('  werkend          ' + String(tel('werkend')).padStart(4) + '   (twee of meer eigen endpoints)');
  console.log('  schil            ' + String(tel('schil')).padStart(4) + '   (een of geen)\n');
  const schillen = rijen.filter(r => r.soort === 'schil').sort((a, b) => a.naam.localeCompare(b.naam));
  if (schillen.length) {
    console.log('  De schillen:');
    for (const r of schillen) console.log('    ' + r.naam.padEnd(24) + r.endpoints + ' endpoints, ' + r.knoppen + ' knoppen');
  }
  console.log('');
}).catch(e => { console.error('Meten mislukt: ' + (e && e.message)); process.exit(1); });
