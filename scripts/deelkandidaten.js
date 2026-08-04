#!/usr/bin/env node
/* ============================================================================
   WELKE APPS ZOUDEN VANDAAG EEN DEELMENU KRIJGEN?

   WAAROM DIT SCRIPT ER IS

   TAKEN 5.4: bij de uitrol van het deelmenu (5.2) bleven vijfendertig apps als
   "kandidaat vervolg" staan, omdat ze hun scherm pas NA een fetch bouwen. Het
   component kon dat toen niet; sinds de wacht op `subtree` kijkt wel
   (shared/deelmenu.js, vastgelegd in test/deelmenuwacht.e2e.js).

   Alleen: die vijfendertig zijn nergens bij naam opgeschreven. Er staat een
   GETAL in de takenlijst en verder niets. Dat is precies de vorm van werk waar
   dit huis zich al een paar keer op heeft gebrand -- een lijst in iemands
   hoofd. Dus wordt hij hier opnieuw gemaakt, en niet uit de bron gegokt maar
   in de browser gemeten.

   HOE

   Elk app-scherm dat `shared/deelmenu.js` NIET laadt gaat open met een gewone
   ledensessie. Als de pagina klaar is met opbouwen, wordt het component alsnog
   ingeladen -- het echte bestand, geen nabootsing van zijn regels -- en daarna
   gekeken of er een balk verschijnt en met welke koppen.

   Zo meet dit script niet "hoeveel kaarten staan er in de bron" maar "wat zou
   het deelmenu hier doen". Dat is dezelfde keuze als in scripts/appdiepte.js:
   vraag het aan de browser, niet aan de tekst.

   WAT DIT NIET ZEGT. Dat een app een menu ZOU krijgen, betekent niet dat hij er
   een MOET krijgen. Spellen, camera's, feeds en chats staan bewust zonder (zie
   TAKEN 5.2), en die staan hier gewoon in de uitvoer -- met hun koppen erbij,
   zodat de keuze per app met de hand te maken is. Een script dat die keuze zelf
   maakt, zou de reden ervoor wegpoetsen.

   DRAAIEN

     node --experimental-sqlite scripts/deelkandidaten.js
     node --experimental-sqlite scripts/deelkandidaten.js --json
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const jsonUit = process.argv.includes('--json');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  return null;
}

/* De app-schermen zonder deelmenu. De inventaris komt van de schijf en niet uit
   een lijst: een app die er morgen bijkomt valt vanzelf in deze meting. */
function zonderMenu() {
  const uit = [];
  (function ga(map, prefix) {
    for (const e of fs.readdirSync(map, { withFileTypes: true })) {
      const p = path.join(map, e.name);
      if (e.isDirectory()) { ga(p, prefix + e.name + '/'); continue; }
      if (!e.name.endsWith('.html')) continue;
      const bron = fs.readFileSync(p, 'utf8');
      if (bron.includes('shared/deelmenu.js')) continue;
      uit.push(prefix + e.name);
    }
  })(path.join(WORTEL, 'public', 'apps'), '');
  return uit.sort();
}

async function meet() {
  const pw = laadBrowser();
  if (!pw) { console.error('Geen browser beschikbaar; dit script meet in een echte browser.'); process.exit(2); }
  const { startServer } = require(path.join(WORTEL, 'test', 'helper.js'));

  const schermen = zonderMenu();
  /* Een lege lijst is geen "alles heeft al een menu" maar een kapotte meting
     (LAT.md regel 3). Zonder deze regel zou een verplaatste map netjes nul
     kandidaten vinden en een geruststellend rapport geven. */
  if (schermen.length < 20) {
    console.error('Maar ' + schermen.length + ' schermen zonder deelmenu gevonden; dat is geen meting maar een kapotte opstelling.');
    process.exit(2);
  }

  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-deelkand-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const uit = [];
  let browser;
  try {
    const u = Date.now().toString().slice(-8);
    const lid = await fetch(base + '/api/auth/register', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Meetlid', email: 'dk' + u + '@x.nl', phone: '06' + u,
        password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg' }) }).then(r => r.json());
    if (!lid || !lid.token) throw new Error('geen ledensessie: ' + JSON.stringify(lid).slice(0, 160));

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    /* De service worker uit: die haalt schermen vooruit op die deze meting niet
       zelf opent, en dat vervuilt elke telling die eraan hangt. */
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    await page.addInitScript((tok) => {
      try { localStorage.setItem('rtg_member_token', tok); localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {}
    }, lid.token);

    for (const scherm of schermen) {
      const url = base + '/apps/' + scherm;
      let r = { koppen: [], fout: null };
      try {
        await page.goto(url, { waitUntil: 'load', timeout: 30000 });
        await new Promise(z => setTimeout(z, 1400));   // de app zijn eerste lading laten ophalen
        r = await page.evaluate(async () => {
          if (document.querySelector('.rtgdeel-balk')) return { koppen: ['(had er al een)'], fout: null };
          await new Promise((klaar, mis) => {
            const s = document.createElement('script');
            s.src = '/shared/deelmenu.js';
            s.onload = klaar; s.onerror = () => mis(new Error('deelmenu.js laadt niet'));
            document.body.appendChild(s);
          });
          await new Promise(z => setTimeout(z, 400));
          const balk = document.querySelector('.rtgdeel-balk');
          return { koppen: balk ? Array.from(balk.querySelectorAll('button')).map(b => b.textContent.trim()) : [],
            fout: null };
        });
      } catch (e) { r = { koppen: [], fout: String(e.message || e).slice(0, 90) }; }
      uit.push({ scherm, koppen: r.koppen, fout: r.fout });
    }
  } finally {
    if (browser) await browser.close();
    try { child.kill(); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
  return uit;
}

meet().then((rijen) => {
  if (jsonUit) { process.stdout.write(JSON.stringify({ aantal: rijen.length, rijen }, null, 2) + '\n'); return; }

  const kandidaten = rijen.filter(r => r.koppen.length >= 3);
  const niets = rijen.filter(r => !r.koppen.length && !r.fout);
  const stuk = rijen.filter(r => r.fout);

  console.log('\n\x1b[1mDEELMENU-KANDIDATEN\x1b[0m \x1b[2m-- apps zonder menu, gemeten met het component erbij\x1b[0m\n');
  console.log('  gemeten                 ' + String(rijen.length).padStart(4));
  console.log('  \x1b[32mzou een menu krijgen\x1b[0m    ' + String(kandidaten.length).padStart(4));
  console.log('  blijft een gewone rol   ' + String(niets.length).padStart(4) + '  \x1b[2m(minder dan drie delen)\x1b[0m');
  if (stuk.length) console.log('  \x1b[33mniet te meten\x1b[0m           ' + String(stuk.length).padStart(4));

  console.log('\n\x1b[2m  Per kandidaat de koppen die het menu zou tonen. Of hij er ook EEN hoort te');
  console.log('  krijgen is een keuze per app -- spellen, camera\'s, feeds en chats staan');
  console.log('  bewust zonder (TAKEN 5.2).\x1b[0m\n');
  for (const k of kandidaten) {
    console.log('  \x1b[1m' + k.scherm + '\x1b[0m \x1b[2m(' + k.koppen.length + ')\x1b[0m');
    console.log('    \x1b[2m' + k.koppen.join(' · ').slice(0, 150) + '\x1b[0m');
  }
  for (const s of stuk) console.log('  \x1b[33m?\x1b[0m ' + s.scherm + ' \x1b[2m' + s.fout + '\x1b[0m');
  console.log('');
}).catch(e => { console.error('\n  De meting viel om: ' + (e && e.message) + '\n'); process.exit(2); });
