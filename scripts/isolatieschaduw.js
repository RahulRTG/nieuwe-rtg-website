#!/usr/bin/env node
/* DE GERICHTE SCHADUWPROEF -- wat zou de isolatiepoort sluiten als hij beet?

   WAAROM DIT SCRIPT BESTAAT. middleware/isolatiepoort.js loopt in de schaduw:
   hij weegt elk schrijvend verzoek en telt wat hij zou tegenhouden, maar houdt
   niets tegen. CONTROLPLANE.md zegt dat dat de enige eerlijke volgorde is -- je
   kunt niet afdwingen wat nooit heeft meegelopen. Alleen: de noemer van die
   schaduwronde is "verzoeken van accounts die een stand dragen", en dat zijn er
   in productie NUL. Deze regel rijpt dus niet vanzelf; wachten op
   productieverkeer is wachten op iets dat niet komt, en een teller die nooit
   vult gaat op den duur als bewijs gelden.

   Vandaar een GERICHTE proef in plaats van geduld: een echte server, een echt
   lid, een echte stand, en echt HTTP-verkeer over de paden die dat lid gebruikt.
   Wat eruit komt is geen schatting maar een telling.

   WAT HIJ NIET DOET, EN DAT IS HET HALVE PUNT. Hij zet niets aan. Hij levert het
   getal waarmee een mens dat besluit kan nemen, en de uitslag zegt met zoveel
   woorden dat zij over DEZE paden gaat en niet over het verkeer van morgen.

   DRAAIEN
     node scripts/isolatieschaduw.js            (tabel)
     node scripts/isolatieschaduw.js --json     (ruwe uitslag)
     node scripts/isolatieschaduw.js --vastleggen

   DE PADEN KOMEN UIT DE ECHTE ROUTELIJST, GEFILTERD DOOR DE ALLOWLIST. Eerst
   stond hier `beleid.LEZEN.member` en dat leek de juiste bron -- het is de lijst
   waarvan een mens heeft gezegd wat een lid ermee mag. Alleen staan daar
   REGEXEN in en geen paden, en een regex als tekenreeks levert een URL als
   /^//api//site//(mijn|haal)$/ op. Die begint niet met /api/, dus de poort woog
   hem terecht niet -- en de proef meldde vier keer nul zonder iets te hebben
   gemeten. Een nulmeting die geen nulmeting is, is het gevaarlijkste wat een
   proef kan opleveren.

   Nu komt de lijst uit scripts/routekaart.js (de routes die de server ECHT
   registreert) en wordt hij door beleid.toegestanePaden(..., 'member') gehaald.
   Twee bronnen die allebei nodig zijn: de routekaart weet wat er bestaat, het
   beleid weet wat een lid ermee mag. */
'use strict';

const path = require('path');
const fs = require('fs');
const WORTEL = path.join(__dirname, '..');
const beleid = require(path.join(WORTEL, 'server/kern/stuur/beleid'));
const { startServer, stop } = require(path.join(WORTEL, 'test/helper'));

const JSON_UIT = process.argv.includes('--json');
const VASTLEGGEN = process.argv.includes('--vastleggen');
const UIT = path.join(WORTEL, 'ISOLATIESCHADUW.json');

/* De standen die een LID zelf kan zetten. `beschermd` en `isolatie` zijn de twee
   die het scherm aanbiedt; `waakzaam` en `beperkt` staan ertussen en horen erbij
   omdat de vraag "wat kost dit mij" per stand een ander antwoord heeft. */
const STANDEN = ['waakzaam', 'beperkt', 'beschermd', 'isolatie'];

function padenVoorLid() {
  const { execFileSync } = require('child_process');
  const kaart = JSON.parse(execFileSync(process.execPath,
    [path.join(WORTEL, 'scripts', 'routekaart.js'), '--json'],
    { cwd: WORTEL, encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024 }));
  /* Alleen echte, aanroepbare paden: geen patroon met een :parameter erin, want
     daar zou de proef een waarde voor moeten VERZINNEN -- en dan meet zij haar
     eigen invulling en niet de poort. Dat is een tekort van de proef en het
     staat in de uitslag. */
  const alle = (kaart.routes || []).map(r => r.pad).filter(p => typeof p === 'string' &&
    p.startsWith('/api/') && !p.includes(':') && !p.includes('*'));
  const toegestaan = beleid.toegestanePaden(alle, 'member');
  return [...new Set(toegestaan)].sort();
}

async function main() {
  /* De eigenaar wordt hier GEZET en niet uit de omgeving gehoopt: de teller staat
     achter de kantoordeur, en een proef die daar niet bij kan levert ONBEKEND.
     Dat is een tekort van de proef en geen uitslag over de poort. */
  const OWNER = 'schaduwproef-eigenaar@x.nl';
  const srv = await startServer({ env: { SMTP_URL: '', RTG_OWNER_EMAIL: OWNER } });
  const roep = (pad, lijf, token, methode) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    return fetch(srv.base + pad, { method: methode || 'POST', headers,
      body: methode === 'GET' ? undefined : JSON.stringify(lijf || {}) })
      .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }))
      .catch(e => ({ status: 0, body: { error: String(e && e.message) } }));
  };

  try {
    const u = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const reg = await roep('/api/auth/register', {
      name: 'Schaduwproef', email: u + '@x.nl',
      phone: '06' + u.replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business'
    });
    const token = reg.body && reg.body.token;
    if (!token) throw new Error('de proef kwam niet binnen als lid: ' + JSON.stringify(reg.body).slice(0, 200));

    const paden = padenVoorLid();
    const rondes = [];

    for (const stand of STANDEN) {
      /* Elke ronde een VERS lid. Standen kunnen alleen omhoog zonder ceremonie,
         dus zou hetzelfde lid alle vier de rondes doen, dan meet ronde twee de
         stand van ronde een mee. Dat is precies de fout die deze laag elders
         verbiedt: een stand die stil blijft staan. */
      const v = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const r2 = await roep('/api/auth/register', {
        name: 'Schaduwproef', email: v + '@x.nl',
        phone: '06' + v.replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
        password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business'
      });
      const tok = r2.body && r2.body.token;
      if (!tok) { rondes.push({ stand, fout: 'geen lid' }); continue; }

      const drager = process.env.RTG_SCHADUW_DRAGER || 'identiteit';
      const zet = await roep('/api/isolatie/mijn/zet', { naar: stand, drager }, tok);
      if (zet.status !== 200) { rondes.push({ stand, fout: 'stand niet gezet: ' + JSON.stringify(zet.body).slice(0, 160) }); continue; }

      /* HET VERKEER. Elk pad een keer, met een leeg lijf. Wat de route van dat
         lijf vindt doet er niet toe: de poort weegt VOOR de router, dus een 400
         uit de route telt net zo goed als een 200. Wat gemeten wordt is of de
         poort hem zou hebben tegengehouden, en dat besluit valt eerder. */
      const voor = await standVanPoort(roep, OWNER);
      for (const p of paden) await roep(p, {}, tok);
      const na = await standVanPoort(roep, OWNER);
      /* EN WELKE PADEN DAT ZIJN, met de reden erbij. De teller zegt HOEVEEL er
         dichtgaan; een mens die moet besluiten of de poort mag bijten, wil weten
         WELKE -- anders is 85 een getal zonder betekenis. De proefroute geeft per
         pad een verklaard besluit en voert niets uit; zij is dus de juiste bron,
         en het is dezelfde besluitlaag die de poort gebruikt. In stukken van
         veertig, want de route kapt op tweehonderd paden af en een stille
         afkapping zou de lijst korter maken dan de werkelijkheid. */
      const gesloten = [];
      for (let i = 0; i < paden.length; i += 40) {
        const deel = paden.slice(i, i + 40);
        const pr = await roep('/api/techniek/isolatie/proef',
          { [drager]: zet.body.uit.sleutel, paden: deel, wereld: 'member' }, _tech);
        for (const b of (pr.body && pr.body.besluiten) || []) {
          if (!b.toegestaan) gesloten.push({ pad: b.pad, waarom: b.uitleg, reden: b.reden });
        }
      }
      rondes.push({ stand, drager, paden: paden.length,
        gewogen: na.gewogen - voor.gewogen, zouSluiten: na.zouSluiten - voor.zouSluiten,
        gesloten });
    }

    const uit = {
      stempel: { op: new Date().toISOString(), node: process.version },
      uitleg: 'Wat middleware/isolatiepoort.js zou sluiten als hij beet. Gemeten met echt ' +
        'HTTP-verkeer van een echt lid met een echte stand, niet geschat.',
      grens: 'Dit gaat over de paden uit de member-allowlist van kern/stuur/beleid.js en over ' +
        'GEEN ander verkeer. Een lid dat een pad gebruikt dat daar niet in staat, is hier niet ' +
        'gemeten -- en dat is iets anders dan "die loopt door".',
      paden: paden.length, rondes
    };
    if (VASTLEGGEN) { fs.writeFileSync(UIT, JSON.stringify(uit, null, 2) + '\n'); console.log('\nVastgelegd in ISOLATIESCHADUW.json'); }
    if (JSON_UIT) console.log(JSON.stringify(uit, null, 2));
    else toon(uit);
  } finally { stop(srv && srv.child); }
}

/* De teller staat achter de kantoordeur. Kan de proef er niet bij, dan is de
   uitslag ONBEKEND en niet nul -- een meting die niet kon draaien is geen
   meting die niets vond. */
let _tech = null;
async function standVanPoort(roep, OWNER) {
  if (!_tech) {
    const inlog = await roep('/api/techniek/inloggen', { login: OWNER, wachtwoord: 'Imran' });
    _tech = (inlog.body && inlog.body.token) || null;
    if (!_tech) throw new Error('de proef kan de teller niet aflezen: geen techniek-inlog. ' +
      'Zonder teller is de uitslag ONBEKEND, en dat is iets anders dan nul.');
  }
  const r = await roep('/api/techniek/isolatie', null, _tech, 'GET');
  const p = r.body && r.body.poort;
  if (!p) throw new Error('het overzicht draagt geen poort-stand; de proef meet dan niets.');
  return p;
}

function toon(uit) {
  console.log('\n=== DE SCHADUWPROEF VAN DE ISOLATIEPOORT ===\n');
  console.log('  ' + uit.paden + ' paden uit de member-allowlist, per stand een vers lid.\n');
  console.log('  stand        gewogen  zou sluiten');
  for (const r of uit.rondes) {
    if (r.fout) { console.log('  ' + r.stand.padEnd(12) + ' -- ' + r.fout); continue; }
    console.log('  ' + r.stand.padEnd(12) + String(r.gewogen).padStart(7) + String(r.zouSluiten).padStart(13));
  }
  console.log('\n  ' + uit.grens + '\n');
}

main().catch(e => { console.error('\n  De schaduwproef is GEZAKT: ' + (e && e.message) + '\n'); process.exit(1); });
