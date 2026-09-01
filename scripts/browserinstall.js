#!/usr/bin/env node
/* ============================================================================
   DE BROWSER KOMT UIT DE LOCKFILE, EN DE FASEN WORDEN APART GEKLOKT.

   WAAR DIT UIT KOMT. In acht CI-jobs stond dit:

       npm ci
       npm i --no-save playwright@^1.49.0
       npx playwright install --with-deps chromium

   Die tweede regel is geen installatie maar een omleiding. `npm ci` zet
   playwright neer op de versie uit package-lock.json, met de integrity-hash
   erbij; de regel erna haalt datzelfde pakket opnieuw op BUITEN de lockfile om
   -- geen integriteitscontrole, en een bereik (^1.49.0) dat al lang niet meer
   klopte met wat de repo pint. De schermtoetsen en de a11y-scan draaiden dus
   op een versie die niemand had vastgelegd, en een wijziging in de lockfile
   veranderde daar niets aan. Dat is precies de vorm waar LAT.md regel 4 over
   gaat: twee plekken die hetzelfde heten en uiteenlopen.

   Dit script installeert daarom NIETS uit een registry. Het controleert dat de
   playwright die `npm ci` heeft neergezet dezelfde is als die in de lockfile
   staat, en haalt daarna alleen de browserbinary op.

   EN HET KLOKT PER FASE, want dat is de openstaande vraag. Gemeten op
   31 augustus 2026 (run 33404735353) deed de oude stap 23-33 seconden in zes
   van de acht browserjobs, en 313 en 434 seconden in de andere twee. Dat is
   VARIANTIE en geen vaste kost, en een cache op een stap van 25 seconden lost
   dat niet op. `--with-deps` doet twee dingen tegelijk (apt-pakketten en de
   browserdownload) en dus was niet te zien welke van de twee uitliep. Hier
   staan ze los, met een tijd per fase. Pas met die getallen is een cache of
   een voorgebakken image een besluit in plaats van een gok.

   DRAAIEN

     node scripts/browserinstall.js
     node scripts/browserinstall.js --meting=browsermeting/deel-1.json
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');

/* De versie zoals de lockfile hem pint. Niet package.json: daar staat een
   BEREIK (^1.62.1), en een bereik is geen versie. */
function uitLockfile() {
  const lock = JSON.parse(fs.readFileSync(path.join(WORTEL, 'package-lock.json'), 'utf8'));
  const p = (lock.packages || {})['node_modules/playwright'];
  return p && p.version ? p.version : null;
}

function geinstalleerd() {
  try {
    return JSON.parse(fs.readFileSync(
      path.join(WORTEL, 'node_modules', 'playwright', 'package.json'), 'utf8')).version;
  } catch (e) { return null; }
}

function fase(naam, cmd, args) {
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { cwd: WORTEL, stdio: 'inherit' });
  const sec = (Date.now() - t0) / 1000;
  console.log('[browser] ' + naam + ': ' + sec.toFixed(1) + 's' +
    (r.status ? ' (exitcode ' + r.status + ')' : ''));
  return { naam, seconden: Number(sec.toFixed(1)), code: r.status === null ? -1 : r.status };
}

function main() {
  const gepind = uitLockfile();
  const staat = geinstalleerd();

  /* FAIL-CLOSED, en dat is de hele reden dat dit script bestaat. Staat er een
     andere versie dan de lockfile pint, dan is er ergens weer een installatie
     buiten de lockfile om bijgekomen -- en dan hoort de bouw te zakken en niet
     stilzwijgend een browser te trekken bij een playwright die niemand kent. */
  if (!gepind) {
    console.error('[browser] package-lock.json pint geen playwright. Zonder pin is er niets om tegen te installeren.');
    return 2;
  }
  if (!staat) {
    console.error('[browser] playwright staat niet in node_modules. Draai `npm ci` voor dit script.');
    return 2;
  }
  if (staat !== gepind) {
    console.error('[browser] de lockfile pint playwright ' + gepind + ' maar node_modules draagt ' + staat + '.' +
      '\n  Er installeert iets buiten de lockfile om. Dat is de fout die dit script moet vangen;' +
      '\n  repareer de installatie en niet deze controle.');
    return 2;
  }
  console.log('[browser] playwright ' + gepind + ' (lockfile en node_modules zijn het eens)');

  const fasen = [];
  /* De systeempakketten en de browser apart, want alleen zo is te zien welke
     van de twee de uitschieters van 313 en 434 seconden veroorzaakt. */
  fasen.push(fase('systeempakketten (apt)', 'npx', ['playwright', 'install-deps', 'chromium']));
  fasen.push(fase('browserbinary (download + uitpakken)', 'npx', ['playwright', 'install', 'chromium']));

  const totaal = fasen.reduce((s, f) => s + f.seconden, 0);
  console.log('[browser] totaal: ' + totaal.toFixed(1) + 's');

  const vlag = (process.argv.find(a => a.startsWith('--meting=')) || '').slice(9);
  if (vlag) {
    fs.mkdirSync(path.dirname(path.resolve(WORTEL, vlag)), { recursive: true });
    fs.writeFileSync(path.resolve(WORTEL, vlag), JSON.stringify({
      versie: gepind, op: new Date().toISOString(),
      job: process.env.GITHUB_JOB || null, runner: process.env.RUNNER_NAME || null,
      fasen, totaal: Number(totaal.toFixed(1))
    }, null, 1) + '\n');
  }

  const stuk = fasen.find(f => f.code !== 0);
  return stuk ? stuk.code : 0;
}

process.exit(main());
