'use strict';
/* ============================================================================
   DE LOS-RUNNER -- draait een voltooiscenario in een wereld waar alleen de
   EIGEN functies van de app aan staan, en kijkt of de keten dan nog sluit. De
   AFLEIDING (wat aan, wat uit) is puur en woont in scripts/losproef.js; dit
   bestand is de orkestratie eromheen: een wegwerpwereld opzetten, de stand
   zetten zoals de boardroom hem zet, het scenario draaien en per stap vastleggen
   welke uit-categorie een 503 gaf.

   DE STAND ZETTEN GAAT ZOALS DE BOARDROOM HEM ZET: de eigenaar vraagt een
   functieschakelaar aan (/api/techniek/functie) en keurt hem zelf goed
   (/api/techniek/functie/besluit) -- geen eigen vlag, geen db-schrijf buiten de
   server om. Eerst elke categorie behalve de primaire UIT, daarna elke
   bodem-/ruggengraat-functie weer AAN per id (de laatste schrijver wint, dus een
   id in een net uitgezette categorie komt terug).
   ========================================================================== */
const path = require('path');
const { maakWereld, KANTOORWERELD } = require('./voltooiwereld');
const P = require('../losproef');

async function zetStand(w, token, { uitCats, aanIds }) {
  for (const cat of uitCats) {
    const req = await w.post('/api/techniek/functie', { categorie: cat, aan: false }, token);
    if (req.data && req.data.verzoekId) await w.post('/api/techniek/functie/besluit', { verzoekId: req.data.verzoekId, akkoord: true }, token);
  }
  for (const id of aanIds) {                 // de bodem + ruggengraat weer aan, per id
    const req = await w.post('/api/techniek/functie', { id, aan: true }, token);
    if (req.data && req.data.verzoekId) await w.post('/api/techniek/functie/besluit', { verzoekId: req.data.verzoekId, akkoord: true }, token);
  }
}

async function meetApp(app, sc, ctx) {
  const { fs, WORTEL } = ctx;
  const scenarioBron = fs.readFileSync(path.join(WORTEL, 'scripts', 'lib', 'voltooi', app + '.js'), 'utf8');
  const ruggengraatBron = fs.readFileSync(path.join(WORTEL, 'scripts', 'lib', 'voltooiwereld.js'), 'utf8');
  const { primair, aanIds, uitCats, andereCats, groepen } = P.losAfleiding({ scenarioBron, ruggengraatBron });

  const w = await maakWereld('los-' + app, Object.assign({}, KANTOORWERELD, sc.omgeving));
  const boek = [];
  const stap = async (bewijs, wat, fn) => {
    const voor = w.antwoorden().length;
    const nr = boek.length + 1;
    let uitslag;
    try { const r = await fn(); uitslag = { nr, bewijs, wat, stand: r && r.klopt ? 'gesloten' : 'open', ziet: r && r.ziet }; }
    catch (e) { uitslag = { nr, bewijs, wat, stand: 'stuk', fout: String((e && e.message) || e).slice(0, 220) }; }
    const blok = w.antwoorden().slice(voor).filter((a) => a && a.status === 503);
    if (blok.length) uitslag.leunt = [...new Set(blok.map((a) => (P.catVanRoute(a.pad) || '?') + ' (' + a.pad + ')'))];
    boek.push(uitslag);
  };
  let afgebroken = null;
  try {
    const eig = (await w.post('/api/auth/login', { login: process.env.RTG_OWNER_EMAIL || 'roellie.i@gmail.com',
      password: process.env.DEMO_PASS || 'Imran', pasApp: 'business' })).data;
    if (!eig || !eig.token) throw new Error('geen eigenaarssessie om de stand te zetten');
    await zetStand(w, eig.token, { uitCats, aanIds: [...aanIds] });
    await sc.loop(w, stap);
  } catch (e) { afgebroken = String((e && e.message) || e).slice(0, 220); }
  w.klaar();

  const open = boek.filter((s) => s.stand !== 'gesloten');
  return { app, ingang: sc.ingang, primair, andereCats, groepen, verdict: P.oordeel({ afgebroken, open }),
    afgebroken, open, stappen: boek.length, boek };
}

/* De uitslag bij VOLTOOIPROEF leggen (een bestaand register, geen 22ste laag).
   Waarom daar: deze proef leent zijn scenario's uit VOLTOOIPROEF, en LOS/SAMEN
   is een eigenschap van DAT onderdeel; een losModus-veld hoort naast
   voltooibaar/persistent/herstelbaar. Alleen additief -- de rest van het
   register blijft zoals voltooiproef.js het schreef. */
function vastleggen({ fs, WORTEL }, uit) {
  const pad = path.join(WORTEL, 'VOLTOOIPROEF.json');
  const reg = JSON.parse(fs.readFileSync(pad, 'utf8'));
  reg.apps = reg.apps || {};
  for (const r of uit) {
    const sc = (() => { try { return require(path.join(WORTEL, 'scripts', 'lib', 'voltooi', r.app)); } catch (e) { return null; } })();
    const sleutel = (sc && sc.functie) || ('link:' + r.app);
    const rij = reg.apps[sleutel] || (reg.apps[sleutel] = { scenario: 'scripts/lib/voltooi/' + r.app + '.js' });
    rij.losModus = {
      verdict: r.verdict, eigenCategorie: r.primair || null, raaktOokNuUit: r.andereCats || [],
      afgebroken: r.afgebroken || null, stappen: r.stappen || 0,
      open: (r.open || []).map((s) => ({ bewijs: s.bewijs, wat: s.wat, leunt: s.leunt || null, fout: s.fout || null }))
    };
  }
  reg.losStempel = { op: new Date().toISOString(), instrument: 'scripts/losproef.js',
    uitleg: 'Modus LOS per app (eigenaarsbesluit 19 oktober 2026): draait het voltooiscenario met alleen de eigen categorie van de app plus de per-id-bodem (trede 0 + onboarding-ruggengraat) aan. LEUNT = het scenario raakte een route van een andere app die nu uit staat; lees per open stap of dat de eigen belofte was of een isolatie-stap die een tegenspeler uit een andere app opbouwt (BEWIJSMACHINE.md par. 6a).',
    kern: uit.map((r) => r.app + '=' + r.verdict).join(' ') };
  fs.writeFileSync(pad, JSON.stringify(reg, null, 2) + '\n');
  console.log('\nvastgelegd in VOLTOOIPROEF.json (losModus per app, losStempel)');
}

async function main({ fs, WORTEL }) {
  const argv = process.argv.slice(2);
  const alleen = (argv.find((a) => a.startsWith('--app=')) || '').slice(6);
  const apps = alleen ? alleen.split(',') : P.KERN;
  const uit = [];
  for (const app of apps) {
    let sc; try { sc = require(path.join(WORTEL, 'scripts', 'lib', 'voltooi', app)); }
    catch (e) { uit.push({ app, verdict: 'GEEN_SCENARIO', fout: String((e && e.message) || e) }); continue; }
    try { uit.push(await meetApp(app, sc, { fs, WORTEL })); }
    catch (e) { uit.push({ app, verdict: 'OMGEVALLEN', fout: String((e && e.stack) || e).slice(0, 500) }); }
  }
  for (const r of uit) {
    console.log('\n### ' + r.app + '  ->  ' + r.verdict + (r.primair ? '  (eigen categorie: ' + r.primair + ')' : '  (volledig op de bodem)'));
    if (r.fout) { console.log('   ' + r.fout); continue; }
    if (r.andereCats && r.andereCats.length) console.log('   raakt ook (nu uit): ' + r.andereCats.join(', '));
    if (r.afgebroken) console.log('   AFGEBROKEN bij de opbouw: ' + r.afgebroken);
    for (const s of (r.open || [])) {
      console.log('   ' + s.stand + ': [' + s.bewijs + '] ' + s.wat);
      if (s.leunt) console.log('      leunt op: ' + s.leunt.join('; '));
      if (s.fout) console.log('      fout: ' + s.fout);
      else if (s.ziet) console.log('      zag: ' + s.ziet);
    }
    console.log('   (' + r.stappen + ' stappen, ' + (r.open ? r.open.length : 0) + ' open/stuk)');
  }
  console.log('\nsamenvatting: ' + uit.map((r) => r.app + '=' + r.verdict).join('  '));
  if (argv.includes('--vastleggen')) vastleggen({ fs, WORTEL }, uit);
  process.exitCode = 0;
  return uit;
}

module.exports = { main, meetApp, zetStand };
