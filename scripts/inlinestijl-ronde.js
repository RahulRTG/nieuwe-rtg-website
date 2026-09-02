#!/usr/bin/env node
/* ============================================================================
   DE RONDE: omzetten, bewijzen, en wat niet bewezen kan worden terugdraaien.

   Dit is scripts/inlinestijl-omzet.js en scripts/inlinestijl-proef.js in de
   enige volgorde waarin ze samen iets waard zijn:

     1  meet de pagina zoals hij nu is (berekende stijl per element)
     2  zet de herhaalde inline waarden om naar klassen
     3  meet opnieuw en vergelijk
     4  is er verschil, draai terug en zet opnieuw om ZONDER de klassen die het
        veroorzaakten -- en meet dan nog een keer
     5  blijft er verschil, dan gaat het hele bestand terug

   Stap 4 is de reden dat dit een script is en geen handeling. Bij kantoren.html
   waren 19 van de 49 klassen niet veilig (`body.rtg-stijl textarea` heeft
   specificiteit 0,1,2 en wint van een losse klasse) -- alles terugdraaien om die
   19 zou de 30 die WEL kunnen weggooien, en ze een voor een uitproberen is
   negenenveertig browserrondes per bestand.

   DE HARDE REGEL: een bestand dat niet bewezen gelijk is, gaat terug. Niet
   "waarschijnlijk goed" en niet "ziet er hetzelfde uit" -- 733 elementen maal 46
   eigenschappen, nul verschil, of het staat er niet.

   Draai:  node scripts/inlinestijl-ronde.js                 (alle .html)
           node scripts/inlinestijl-ronde.js apps/kantoren.html apps/office.html
           node scripts/inlinestijl-ronde.js --toon          (alleen de potentie)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const PUB = path.join(WORTEL, 'public');
const argv = process.argv.slice(2);
const TOON = argv.includes('--toon');
const losse = argv.filter(a => !a.startsWith('--'));
const BASIS = process.env.RTG_BASIS || 'http://localhost:3000';

function allePaginas() {
  const uit = [];
  (function loop(m) {
    for (const n of fs.readdirSync(m)) {
      const p = path.join(m, n);
      let st; try { st = fs.statSync(p); } catch (e) { continue; }
      if (st.isDirectory()) { if (n !== 'dist') loop(p); continue; }
      if (n.endsWith('.html')) uit.push('/' + path.relative(PUB, p).split(path.sep).join('/'));
    }
  })(PUB);
  return uit.sort();
}

function draai(cmd, args) {
  return spawnSync(process.execPath, [path.join(__dirname, cmd), ...args],
    { cwd: WORTEL, encoding: 'utf8' });
}

/* Hoeveel er in dit bestand te halen valt, zonder iets aan te raken. */
function potentie(webpad) {
  const r = draai('inlinestijl-omzet.js', ['public' + webpad, '--toon']);
  const m = /attributen die dan verdwijnen : (\d+)/.exec(r.stdout || '');
  return m ? Number(m[1]) : 0;
}

function rondeVoor(webpad) {
  const bestand = path.join(PUB, webpad.slice(1));
  const back = path.join(os.tmpdir(), 'inlinestijl-' + path.basename(webpad) + '.bak');
  const meting = path.join(os.tmpdir(), 'inlinestijl-' + path.basename(webpad) + '.json');
  const schuldig = meting.replace(/\.json$/, '') + '-schuldig.txt';

  const winst = potentie(webpad);
  if (!winst) return { webpad, staat: 'niets te halen', weg: 0 };

  fs.copyFileSync(bestand, back);
  try { fs.unlinkSync(schuldig); } catch (e) {}

  const voor = draai('inlinestijl-proef.js', [webpad, meting]);
  if (voor.status !== 0) {
    return { webpad, staat: 'niet te meten: ' + (voor.stderr || '').trim().split('\n')[0], weg: 0 };
  }

  const zet1 = draai('inlinestijl-omzet.js', ['public' + webpad]);
  if (zet1.status !== 0) { fs.copyFileSync(back, bestand); return { webpad, staat: 'omzetting mislukt', weg: 0 }; }

  let na = draai('inlinestijl-proef.js', [webpad, meting, '--na']);
  let overgeslagen = 0;
  /* EEN RONDE IS NIET GENOEG, en dat bleek pas toen de zeef strenger werd.

     De proef noemt de klassen die op DIT moment een verschil geven. Vallen die
     weg, dan verschuift de cascade en kan er een tweede groep bovenkomen die er
     eerst achter zat -- bij kantoren.html gebeurde dat: 19 afgekeurd, en de
     ronde daarna nog een paar. Een enkele herkansing draaide zo een heel bestand
     terug waar drie rondes het wel hadden gehaald.

     De lijst afgekeurde klassen GROEIT dus over de rondes; hij wordt nooit
     leeggegooid. Vijf rondes is de grens: blijft er dan nog verschil, dan is er
     iets anders aan de hand dan specificiteit en gaat het bestand terug. */
  const afgekeurd = new Set();
  for (let ronde = 0; ronde < 5 && na.status !== 0 && fs.existsSync(schuldig); ronde++) {
    for (const k of fs.readFileSync(schuldig, 'utf8').split(/\s+/).filter(Boolean)) afgekeurd.add(k);
    fs.writeFileSync(schuldig, [...afgekeurd].join('\n') + '\n');
    overgeslagen = afgekeurd.size;
    fs.copyFileSync(back, bestand);
    const zet2 = draai('inlinestijl-omzet.js', ['public' + webpad, '--overslaan', schuldig]);
    if (zet2.status !== 0) { fs.copyFileSync(back, bestand); return { webpad, staat: 'omzetting mislukt', weg: 0, overgeslagen }; }
    /* Alles afgekeurd: dan is er niets meer om te bewijzen. */
    if (!/attributen weg/.test(zet2.stdout || '')) { fs.copyFileSync(back, bestand); return { webpad, staat: 'alles afgekeurd', weg: 0, overgeslagen }; }
    na = draai('inlinestijl-proef.js', [webpad, meting, '--na']);
  }

  if (na.status !== 0) {
    fs.copyFileSync(back, bestand);
    return { webpad, staat: 'ZAKT, teruggedraaid', weg: 0, overgeslagen };
  }
  const m = /(\d+) attributen weg/.exec(
    (overgeslagen ? draai('inlinestijl-omzet.js', ['public' + webpad, '--toon']).stdout : zet1.stdout) || '');
  const bron = fs.readFileSync(bestand, 'utf8');
  const nu = (bron.match(/\sstyle="/g) || []).length;
  const was = (fs.readFileSync(back, 'utf8').match(/\sstyle="/g) || []).length;
  return { webpad, staat: 'bewezen gelijk', weg: was - nu, overgeslagen };
}

const paginas = losse.length ? losse.map(p => (p.startsWith('/') ? p : '/' + p)) : allePaginas();

if (TOON) {
  let tot = 0; const rijen = [];
  for (const p of paginas) { const w = potentie(p); if (w) { rijen.push([p, w]); tot += w; } }
  rijen.sort((a, b) => b[1] - a[1]);
  console.log('\nTE HALEN uit de MARKUP van .html-bestanden: ' + tot + ' attributen over ' + rijen.length + ' bestanden\n');
  for (const [p, w] of rijen.slice(0, 20)) console.log(String(w).padStart(5) + '  ' + p);
  if (rijen.length > 20) console.log('  ... en nog ' + (rijen.length - 20) + ' bestanden');
  process.exit(0);
}

console.log('\nDE RONDE -- ' + paginas.length + ' pagina(s), basis ' + BASIS + '\n');
let weg = 0, gedaan = 0, gezakt = 0, nietTeMeten = 0;
for (const p of paginas) {
  const r = rondeVoor(p);
  if (r.staat === 'niets te halen') continue;
  const merk = r.staat === 'bewezen gelijk' ? 'OK  ' :
    (r.staat.startsWith('niet te meten') || r.staat === 'omzetting mislukt') ? '?   ' : 'TERUG';
  console.log('  ' + merk + ' ' + p.padEnd(44) + r.staat +
    (r.weg ? '  (-' + r.weg + ')' : '') +
    (r.overgeslagen ? '  [' + r.overgeslagen + ' klasse(n) afgekeurd]' : ''));
  if (r.staat === 'bewezen gelijk') { weg += r.weg; gedaan++; }
  else if (r.staat.startsWith('niet te meten') || r.staat === 'omzetting mislukt') nietTeMeten++;
  else gezakt++;
}
console.log('\n  bewezen gelijk : ' + gedaan + ' bestand(en), ' + weg + ' attributen weg');
console.log('  teruggedraaid  : ' + gezakt);
console.log('  niet te meten  : ' + nietTeMeten + '  (een pagina die niet laadt is NIET geslaagd)');
