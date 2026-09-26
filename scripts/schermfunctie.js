#!/usr/bin/env node
/* WELKE SCHERMEN DOEN HETZELFDE WERK -- de feitenkant van de consolidatieronde.

   WAAROM DIT ER IS

   De eerste controle op dubbele schermen vergeleek BESTANDEN: geen enkel
   scherm bleek byte voor byte gelijk aan een ander. Dat bewijst weinig. Twee
   totaal anders gebouwde schermen kunnen dezelfde gebruikersbehoefte, dezelfde
   data en dezelfde handelingen afhandelen -- en precies die vorm vond de ronde
   er toch: vandaag.html en life.html zijn allebei "uw dag", en ze delen geen
   regel HTML.

   Dus meet dit register niet de vorm van een scherm maar wat erachter zit:

     scherm -> eigen scripts -> API-paden -> domein -> rol -> schrijft het
            -> in welke wereld hangt het -> wie linkt ernaar

   en legt daarna ieder PAAR schermen naast elkaar op de API-paden die ze
   noemen. Twee schermen die dezelfde routes raken, raken dezelfde data. Dat is
   de kandidatenlijst voor de consolidatie; het OORDEEL erover (exact dubbel,
   functioneel dubbel, gedeeltelijke overlap, zelfde component in een andere
   context, alias) staat in SCHERMEIGENAAR.json, omdat dat een besluit is en geen
   meting (CODE.md: AI mag betekenis voorstellen, alleen een mens of een
   deterministisch systeem stelt waarheid vast).

   WAT HIJ NIET ZIET, EN DAT STAAT ER HARDOP BIJ

   - Een scherm dat zijn werk in localStorage of in de DOM doet, heeft hier geen
     paden. Nul paden is dus "geen serverkant", niet "doet niets". Zo'n scherm
     draagt `zonderServer: true`, en `vandaag.html` is daar het schoolvoorbeeld
     van: een dag zonder bron.
   - Paden komen uit SCHERMROUTES.json (een lexer op stringliteralen). Die zegt
     "noemt", niet "roept aan". Een overlap op een pad dat een scherm alleen
     NOEMT, is een kandidaat en geen bewijs.
   - Gedeelde paden die elk ingelogd scherm noemt (de sessie, meldingen, de
     schil) zeggen niets over het werk van een scherm. Die staan in RUIS en
     tellen niet mee in de overlap; ze staan wel in de feiten per scherm.

   Draaien: npm run schermfunctie -> SCHERMFUNCTIE.json
   Controle: npm run schermfunctie:controle (zakt als het register achterloopt) */
'use strict';
/* Requiren schrijft niets: de toets (test/schermeigenaar.test.js) roept meet()
   aan en krijgt een VERSE meting, zodat een nieuwe dubbeling niet wacht tot
   iemand het register herdraait. Alleen `node scripts/schermfunctie.js` schrijft. */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const PUBLIC = path.join(WORTEL, 'public');
const UIT = path.join(WORTEL, 'SCHERMFUNCTIE.json');
const lees = n => { try { return JSON.parse(fs.readFileSync(path.join(WORTEL, n), 'utf8')); } catch (e) { return null; } };
const rel = p => path.relative(WORTEL, p).split(path.sep).join('/');

/* Paden die zoveel schermen noemen dat ze niets over het werk zeggen. Niet
   geraden: het zijn de sessie-, schil- en meldingspaden die de gedeelde laag in
   public/shared/ al aanroept; een scherm dat ze zelf nog eens noemt, doet
   daarmee geen eigen werk. */
const RUIS = new Set([
  '/api/me', '/api/login', '/api/logout', '/api/session', '/api/notifications',
  '/api/i18n', '/api/health', '/api/csrf', '/api/ai', '/api/chat',
  /* Transport en schil: de realtime-stroom, de ICE-servers voor een gesprek,
     de contactkiezer en de inlog- en rolwissel. Twee schermen die allebei live
     bijwerken of allebei een contact laten kiezen, doen daarmee nog niet
     hetzelfde werk -- de eerste meting zette comm, geld, media en spelen zo
     naast elkaar. */
  '/api/stream?token=', '/api/office/stream?token=', '/api/supplier/stream?token=',
  '/api/ice', '/api/member/connections', '/api/rtf/social/connections',
  '/api/account/start', '/api/supplier/login', '/api/supplier/ai', '/api/office/login',
]);

/* ---------- schermen ---------- */
function htmls(map) {
  const uit = [];
  for (const naam of fs.readdirSync(map, { withFileTypes: true })) {
    const p = path.join(map, naam.name);
    if (naam.isDirectory()) uit.push(...htmls(p));
    else if (naam.name.endsWith('.html')) uit.push(p);
  }
  return uit;
}

function meet() {
const schermroutes = lees('SCHERMROUTES.json');
const schermgedrag = lees('SCHERMGEDRAG.json');
if (!schermroutes) throw new Error('SCHERMROUTES.json ontbreekt: draai eerst npm run schermroutes');

const padenVanBestand = new Map();
for (const r of schermroutes.perScherm || []) {
  padenVanBestand.set(r.bestand, { exact: r.exact || [], voorvoegsels: r.voorvoegsels || [] });
}
const gedragVan = new Map(Object.values((schermgedrag && schermgedrag.perScherm) || {}).map(g => [g.bestand, g]));

/* ---------- wereld: MAPPEN via de gegenereerde wereldlijst ---------- */
const wereldVan = new Map();
{
  const md = fs.readFileSync(path.join(WORTEL, 'WERELDLIJST.md'), 'utf8');
  let wereld = null;
  for (const regel of md.split('\n')) {
    const kop = regel.match(/^## (\S+)/);
    if (kop) { wereld = kop[1]; continue; }
    const rij = regel.match(/^\| ([^|]+) \| `(link|tab|os):([^`]+)` \| `?([^`|]+)`? \|/);
    if (!rij || !wereld) continue;
    const url = rij[4].trim().split(/[?# ]/)[0];
    if (!url.startsWith('/')) continue;
    const bestand = 'public' + url;
    if (!wereldVan.has(bestand)) wereldVan.set(bestand, []);
    wereldVan.get(bestand).push({ wereld, onderdeel: rij[1].trim(), sleutel: rij[2] + ':' + rij[3] });
  }
}

/* ---------- inkomende links ---------- */
function alleBronbestanden() {
  const uit = execSync("git ls-files -- public server", { cwd: WORTEL, maxBuffer: 1 << 26 }).toString().trim().split('\n');
  return uit.filter(f => /\.(html|js|json|mjs)$/.test(f) && fs.existsSync(path.join(WORTEL, f)));
}
const bron = alleBronbestanden().map(f => [f, fs.readFileSync(path.join(WORTEL, f), 'utf8')]);

/* ---------- per scherm ---------- */
const schermen = htmls(PUBLIC).map(rel).sort();

function eigenScriptsVan(bestand, html) {
  return [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(m => m[1])
    .filter(s => !s.startsWith('/shared/') && !/^https?:/.test(s))
    .map(s => s.startsWith('/') ? 'public' + s.split('?')[0] : rel(path.join(path.dirname(path.join(WORTEL, bestand)), s.split('?')[0])));
}
/* Een SCHILSCRIPT is een script dat vijf of meer schermen laden (de schil van
   de RTFoundation, de schil van de ledenapp). Wat daarin staat is werk van de
   schil en niet van het scherm: meegeteld zou het elk RTF-scherm een dubbel van
   elk ander RTF-scherm maken. De paden staan per scherm apart als schilPaden. */
const SCHIL_DREMPEL = 5;
const scriptGebruik = new Map();
for (const b of schermen) for (const s of eigenScriptsVan(b, fs.readFileSync(path.join(WORTEL, b), 'utf8'))) scriptGebruik.set(s, (scriptGebruik.get(s) || 0) + 1);
const schilScripts = new Set([...scriptGebruik].filter(([, n]) => n >= SCHIL_DREMPEL).map(([s]) => s));

/* Een INDEX is een bestand dat meer dan zestig schermen noemt (de sprongindex,
   het heritage-register, de service worker). Die maakt elk scherm "bereikbaar"
   zonder dat een mens er ooit langs komt, dus telt hij niet als inkomende link;
   hij staat wel apart als inIndex. */
const schermUrls = schermen.map(b => '/' + b.replace(/^public\//, ''));
const indexBestanden = new Set(bron.filter(([, t]) => schermUrls.filter(u => t.includes(u)).length > 60).map(([f]) => f));
const perScherm = [];
for (const bestand of schermen) {
  const html = fs.readFileSync(path.join(WORTEL, bestand), 'utf8');
  const url = '/' + bestand.replace(/^public\//, '');
  const titel = ((html.match(/<title>([^<]*)<\/title>/) || [])[1] || '').replace(/&middot;/g, '·').replace(/&amp;/g, '&').trim();
  const h1 = ((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  /* Een alias is een scherm dat de bezoeker METEEN elders heen stuurt: een
     meta-refresh met vertraging 0 of een location.replace op het hoogste
     niveau van een klein bestand. Een login-omleiding middenin een groot
     scherm is dat niet -- vandaar de groottegrens, en die is niet geraden:
     de grootste doorverwijzing is 1,7 KB, het kleinste echte scherm met een
     omleiding 10 KB. */
  const refresh = html.match(/http-equiv="refresh"\s+content="0;\s*url=([^"]+)"/i);
  const alias = refresh && html.length < 4000 ? refresh[1].trim() : null;

  const alleScripts = eigenScriptsVan(bestand, html);
  const eigenScripts = alleScripts.filter(s => !schilScripts.has(s));
  const schil = alleScripts.filter(s => schilScripts.has(s));
  /* Een gebundeld script heeft zijn bron in public/apps/<naam>/; SCHERMROUTES
     telt die delen en niet de bundel, dus die tellen hier ook mee. */
  const delen = [];
  for (const s of eigenScripts) {
    const map = s.replace(/\.js$/, '');
    if (fs.existsSync(path.join(WORTEL, map)) && fs.statSync(path.join(WORTEL, map)).isDirectory()) {
      for (const d of fs.readdirSync(path.join(WORTEL, map))) if (d.endsWith('.js')) delen.push(map + '/' + d);
    }
  }
  const exact = new Set(), voorvoegsels = new Set();
  for (const b of [bestand, ...eigenScripts, ...delen]) {
    const p = padenVanBestand.get(b);
    if (!p) continue;
    p.exact.forEach(x => exact.add(x));
    p.voorvoegsels.forEach(x => voorvoegsels.add(x));
  }
  const werk = [...new Set([...exact, ...voorvoegsels])].filter(p => !RUIS.has(p.replace(/\/$/, ''))).sort();
  const schilPaden = new Set();
  for (const b of schil) {
    const p = padenVanBestand.get(b);
    if (p) [...p.exact, ...p.voorvoegsels].forEach(x => { if (!werk.includes(x)) schilPaden.add(x); });
  }
  const domeinen = [...new Set(werk.map(p => p.split('/').slice(0, 3).join('/')))].sort();

  const naam = path.basename(bestand);
  const inkomend = [];
  let inIndex = 0;
  for (const [f, tekst] of bron) {
    if (f === bestand || alleScripts.includes(f) || delen.includes(f)) continue;
    if (indexBestanden.has(f)) { if (tekst.includes(url)) inIndex++; continue; }
    if (tekst.includes(url) || (f.startsWith(path.dirname(bestand) + '/') && new RegExp('["\'/]' + naam.replace('.', '\\.') + '["\'?#]').test(tekst))) inkomend.push(f);
  }

  const g = gedragVan.get(bestand) || {};
  perScherm.push({
    bestand, url, titel, h1: h1.slice(0, 120),
    soort: alias ? 'alias' : 'scherm',
    aliasNaar: alias,
    wereld: wereldVan.get(bestand) || [],
    rollen: g.rollen || [],
    schrijft: g.schrijft || (werk.length ? 'onbekend' : 'nee'),
    schil,
    paden: werk,
    schilPaden: [...schilPaden].sort(),
    domeinen,
    zonderServer: !alias && werk.length === 0,
    inkomend: inkomend.length,
    inIndex,
    inkomendVan: inkomend.slice(0, 12),
  });
}

/* ---------- overlap ----------
   Per paar schermen: hoeveel werkpaden delen ze. Twee maten, nooit opgeteld:
   jaccard (hoe gelijk zijn ze) en omvatting (hoeveel van het KLEINSTE zit in het
   grootste -- een klein scherm dat helemaal in een groot scherm valt, is de
   klassieke tweede ingang). Een paar komt op de lijst vanaf twee gedeelde paden
   en een omvatting van de helft; onder die grens is een gedeeld pad een
   raakpunt en geen overlap. */
const echt = perScherm.filter(s => s.soort === 'scherm' && s.paden.length);
const overlap = [];
for (let i = 0; i < echt.length; i++) {
  for (let j = i + 1; j < echt.length; j++) {
    const a = new Set(echt[i].paden), b = echt[j].paden;
    const gedeeld = b.filter(p => a.has(p));
    if (gedeeld.length < 2) continue;
    const klein = Math.min(a.size, b.length);
    const omvatting = gedeeld.length / klein;
    const jaccard = gedeeld.length / (a.size + b.length - gedeeld.length);
    if (omvatting < 0.5) continue;
    overlap.push({
      a: echt[i].bestand, b: echt[j].bestand,
      gedeeld: gedeeld.length, jaccard: +jaccard.toFixed(2), omvatting: +omvatting.toFixed(2),
      voorbeeld: gedeeld.slice(0, 6),
    });
  }
}
overlap.sort((x, y) => y.omvatting - x.omvatting || y.gedeeld - x.gedeeld || (x.a + x.b).localeCompare(y.a + y.b));

/* Titelbotsingen: twee schermen met dezelfde naam in het tabblad. Geen bewijs
   van dubbel werk, wel van een naam die een mens op het verkeerde scherm zet. */
const opTitel = new Map();
for (const s of perScherm) if (s.titel && s.soort === 'scherm') {
  if (!opTitel.has(s.titel)) opTitel.set(s.titel, []);
  opTitel.get(s.titel).push(s.bestand);
}
const titelbotsing = [...opTitel].filter(([, l]) => l.length > 1).map(([titel, schermen]) => ({ titel, schermen }));

/* Wereldingangen die op een alias uitkomen: een menu dat naar een
   doorverwijzing wijst, stuurt elke tik langs een omweg en houdt de alias in
   leven die anders kon verdwijnen. */
const menuOpAlias = perScherm.filter(s => s.soort === 'alias' && s.wereld.length)
  .map(s => ({ bestand: s.bestand, naar: s.aliasNaar, ingangen: s.wereld.map(w => w.wereld + ' / ' + w.onderdeel) }));

const commit = (() => { try { return execSync('git rev-parse --short HEAD', { cwd: WORTEL }).toString().trim(); } catch (e) { return null; } })();
return {
  soort: 'schermfunctie',
  uitleg: 'Feiten per scherm (paden, domeinen, rol, wereld, inkomende links, alias) en de paren schermen die dezelfde API-paden raken. ' +
    'Het oordeel over die paren staat in SCHERMEIGENAAR.json; dit register stelt niets vast behalve wat er gemeten is.',
  stempel: { op: new Date().toISOString().slice(0, 10), commit },
  bronnen: { schermroutes: schermroutes.stempel || null, schermgedrag: (schermgedrag && schermgedrag.stempel) || null },
  ruis: [...RUIS].sort(),
  schilScripts: [...schilScripts].sort().map(s => ({ script: s, schermen: scriptGebruik.get(s) })),
  indexBestanden: [...indexBestanden].sort(),
  totaal: {
    schermen: perScherm.length,
    aliassen: perScherm.filter(s => s.soort === 'alias').length,
    zonderServer: perScherm.filter(s => s.zonderServer).length,
    zonderInkomend: perScherm.filter(s => s.soort === 'scherm' && s.inkomend === 0).length,
    overlapParen: overlap.length,
    titelbotsingen: titelbotsing.length,
    menuOpAlias: menuOpAlias.length,
  },
  overlap, titelbotsing, menuOpAlias, perScherm,
};
}
module.exports = { meet, RUIS };
if (require.main === module) {
const register = meet();
/* Het stempel verandert per commit; de controle vergelijkt dus alles behalve dat. */
const zonderStempel = r => JSON.stringify({ ...r, stempel: null, bronnen: null });
if (process.argv.includes('--controle')) {
  const oud = lees('SCHERMFUNCTIE.json');
  if (!oud || zonderStempel(oud) !== zonderStempel(register)) {
    console.error('SCHERMFUNCTIE.json loopt achter op de code. Draai npm run schermfunctie.');
    process.exit(1);
  }
  console.log('SCHERMFUNCTIE.json is bij.');
  process.exit(0);
}
fs.writeFileSync(UIT, JSON.stringify(register, null, 2) + '\n');
const t = register.totaal;
console.log(`${t.schermen} schermen, ${t.aliassen} aliassen, ${t.zonderServer} zonder serverkant, ${t.zonderInkomend} zonder inkomende link, ` +
  `${t.overlapParen} overlapparen, ${t.titelbotsingen} titelbotsingen, ${t.menuOpAlias} menu-ingangen op een alias.`);
}
