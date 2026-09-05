#!/usr/bin/env node
/* Machineleesbare releasepoort voor alle code-deuren.

   Dit script is met opzet ROOD zolang een echte credential of privacygevoelige
   trackingdeur op `remaining` staat. Een onbekende deur wegfilteren zou van een
   inventaris een geruststelling maken; daarom bewaakt REQUIRED_ROUTES ook de
   concrete deuren uit de productie-audit. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { ROUTES: EENMALIGE_ROUTES } = require('../server/lib/eenmalig-geheim-routes');

const PAD = path.join(__dirname, '..', 'CODECREDENTIALS.json');
const ROOT = path.join(__dirname, '..');
const STATUSES = new Set(['migrated', 'closed', 'remaining']);
const CLASSIFICATIES = new Set(['credential', 'money_credential', 'public_identifier',
  'tracking_identifier', 'signed_presentation', 'authenticated_identifier',
  'external_protocol_credential', 'central_session_credential']);
const REQUIRED_ROUTES = [
  'GET /api/projectie/:code',
  'POST /api/projectie/koppel', 'POST /api/projectie/kijk',
  'POST /api/member/spel/projectie-open', 'POST /api/member/spel/projectie-sluit',
  'POST /api/rtf/spel/projectie-open', 'POST /api/rtf/spel/projectie-sluit',
  'GET /api/zegel/sleutel', 'GET /apps', 'GET /media/:naam',
  'POST /api/code/dyn', 'POST /api/code/scan',
  'POST /api/festival/groep/mee',
  'POST /api/krant/open', 'POST /api/krant/artikel',
  'POST /api/lab2/mijn',
  'POST /api/les/leraar', 'POST /api/les/mee',
  'POST /api/meet/maak', 'POST /api/meet/kom', 'POST /api/meet/code',
  'POST /api/samen/maak', 'POST /api/samen/mee', 'POST /api/samen/code',
  'POST /api/samen/sluit',
  'POST /api/pay/kascode', 'POST /api/supplier/pay/in',
  'POST /api/supplier/pay/vooraf', 'POST /api/supplier/pay/vastleg',
  'POST /api/link/cap/maak', 'POST /api/supplier/link/cap/aanvaard',
  'POST /api/supplier/pos/sale', 'POST /api/supplier/pos/checkout',
  'POST /api/supplier/tafelticket/afrekenen', 'POST /api/supplier/retail/verkoop',
  'POST /api/supplier/ticket/deurverkoop', 'POST /api/festival/verkoop/rond',
  'POST /api/pay/tikcode', 'POST /api/pay/tik',
  'POST /api/pay/tegoed', 'POST /api/pay/tegoed/koop',
  'POST /api/pay/tegoed/verzilver', 'POST /api/pay/tegoed/terug',
  'POST /api/supplier/pay/tegoed', 'POST /api/supplier/pay/tegoed/zet',
  'POST /api/supplier/pay/tegoed/terug',
  'POST /api/giftcard/buy', 'POST /api/giftcards/mine',
  'POST /api/supplier/giftcard/sell', 'POST /api/supplier/giftcard/redeem',
  'POST /api/order', 'POST /api/order/pay', 'POST /api/orders/mine',
  'POST /api/bezorg/bestel', 'POST /api/bezorg/volg',
  'POST /api/supplier/pos/redeem',
  'POST /api/ticket/koop', 'POST /api/tickets/mijn',
  'POST /api/supplier/programma', 'POST /api/supplier/ticket/checkin',
  'POST /api/member/sport/ticket/koop', 'POST /api/sport/scan',
  'POST /api/member/vluchten/boek', 'POST /api/member/vluchten/incheck',
  'POST /api/member/vluchten/mijn', 'POST /api/supplier/lucht/pass',
  'POST /api/lucht/lounge/in',
  'POST /api/mob/kaart/koop', 'POST /api/mob/kaart/mijn',
  'POST /api/mob/abo/koop', 'POST /api/mob/abo/mijn',
  'POST /api/mob/reis/boek', 'POST /api/staff/mob/kaart/controle',
  'POST /api/supplier/horeca/simulatie/maak',
  'POST /api/supplier/horeca/simulatie/voorstellen',
  'POST /api/member/spel/hospitality-koppel',
  'POST /api/member/spel/hospitality-delen',
  'POST /api/rtf/spel/hospitality-koppel',
  'POST /api/rtf/spel/hospitality-delen',
  'POST /api/reis/uitnodiging/open', 'POST /api/reis/uitnodiging/eisop',
  'POST /api/rtf/club/portaal', 'POST /api/rtf/partner/stem',
  'POST /api/rtf/samen/mee',
  'POST /api/member/pin', 'POST /api/member/pin/nieuw',
  'POST /api/member/pin/uit', 'POST /api/member/pin/zoek',
  'POST /api/member/pin/connect', 'POST /api/member/pin/live',
  'POST /api/member/pin/live/kijk', 'POST /api/member/pin/live/verbind',
  'POST /api/rtf/social/pin', 'POST /api/rtf/social/pin/nieuw',
  'POST /api/rtf/social/pin/uit', 'POST /api/rtf/social/pin/zoek',
  'POST /api/rtf/social/pin/connect', 'POST /api/rtf/social/pin/live',
  'POST /api/rtf/social/pin/live/kijk', 'POST /api/rtf/social/pin/live/verbind',
  'POST /api/rtfos/portaal/partner', 'POST /api/rtfos/portaal/gemeente',
  'POST /api/rtfos/portaal/ondernemer',
  'POST /api/rtgid/start', 'POST /api/rtgid/status',
  'POST /api/rtgid/roteer', 'POST /api/rtgid/annuleer',
  'POST /api/rtgid/wie', 'POST /api/rtgid/koppel',
  'POST /api/rtgid/bevestig', 'POST /api/rtgid/weiger',
  'POST /api/salon/deal/claim', 'POST /api/salon/deal/claim/roteer',
  'POST /api/salon/deal/claim/intrek', 'POST /api/supplier/salon/deal/redeem',
  'POST /api/supplier/staff/invite', 'POST /api/supplier/staff/join',
  'POST /api/supplier/apply/decide', 'POST /api/supplier/staff/reset-pin',
  'POST /api/supplier/staff/add', 'POST /api/werving/verbind',
  'POST /api/auth/register',
  'GET /werken/:code',
  'POST /api/supplier/vracht', 'POST /api/supplier/vracht/maak',
  'POST /api/supplier/vracht/volgcode/roteer',
  'POST /api/supplier/vracht/volgcode/intrek', 'POST /api/vracht/volg',
  'POST /api/werkvloer/koppel/code',
  'POST /api/foundation/gezin/inloggen', 'POST /api/foundation/gezin/profiel/kies',
  'POST /api/foundation/school/personeel/inlog/accepteer',
  'POST /api/foundation/school/koppel',
  'POST /api/supplier/bezichtiging/beslis', 'POST /api/vastgoed/keyless',
  'POST /api/appstore/berichten', 'POST /api/appstore/berichten/gelezen',
  'POST /api/appstore/bon', 'POST /api/appstore/brug',
  'POST /api/appstore/context/geef', 'POST /api/appstore/context/klaarzet',
  'POST /api/appstore/dossier', 'POST /api/appstore/installeer',
  'POST /api/appstore/kantoor/intrekken', 'POST /api/appstore/koop',
  'POST /api/appstore/open', 'POST /api/appstore/persoon/dossier',
  'POST /api/appstore/persoon/intrekken', 'POST /api/appstore/tijdlijn',
  'POST /api/appstore/uitgever/dossier', 'POST /api/appstore/uitgever/intrekken',
  'POST /api/appstore/uitgever/voorbeeld', 'POST /api/appstore/verleen',
  'POST /api/appstore/vernietig', 'POST /api/appstore/weg',
  'POST /api/appstore/wis-opslag',
  'POST /api/bedrijf/werkruimte/maak', 'POST /api/bedrijf/werkruimte',
  'POST /api/bedrijf/lid/aanmeld', 'POST /api/bedrijf/lid/besluit',
  'POST /api/bedrijf/leden', 'POST /api/bedrijf/mijn',
  'POST /api/bedrijf/apparaat/zet', 'POST /api/bedrijf/geconsolideerd',
  'POST /api/bedrijf/handeling/plan', 'POST /api/bedrijf/issue/maak',
  'POST /api/bedrijf/storing/koppel', 'POST /api/bedrijf/ticket/maak',
  'POST /api/bedrijf/ticket/reageer', 'POST /api/bedrijf/ticket/sluit',
  'POST /api/bedrijf/ticket/waardeer',
  'POST /api/arrival/request', 'POST /api/arrival/pass',
  'POST /api/arrival/pulse', 'POST /api/supplier/horeca/arrivals',
  'POST /api/supplier/horeca/arrival/promise'
];
const CONTROLES = ['hash_only_at_rest', 'issuer_doel_scope', 'issued_at_expires_at',
  'max_gebruik_gebruik', 'server_side_intrekken_roteren', 'constant_time_lookup',
  'atomic_claim', 'raw_once'];

/* BRONAFGELEIDE CENSUS. REQUIRED_ROUTES bewaakt bekende deuren, maar kan een
   morgen toegevoegde `/api/.../toegangscode` nooit raden. Daarom halen we alle
   letterlijke routeverklaringen uit server/ en markeren we de kandidaten op
   zowel pad als de eerste handlertekst. Een kandidaat die niet in het register
   staat is geen parsefout: hij wordt een expliciete RELEASEBLOCKER met bron en
   reden. Daarmee blijft de poort bruikbaar terwijl de inventaris groeit, maar
   kan onbekend nooit READY betekenen. */
const METHODEN = 'get|post|put|patch|delete|head|options|all';
const ROUTE = new RegExp('\\b(?:app|router)\\.(' + METHODEN + ')\\s*\\(\\s*([\'"`])(\\/[^\'"`$]+)\\2', 'g');
const ROUTE_AANROEP = new RegExp('\\b(?:app|router)\\.(' + METHODEN + ')\\s*\\(', 'g');
const PAD_RISICO = /(?:^|\/)(?:code(?:s|woord)?|sleutel|token|pin|claim|ticket|pas|pass|uitnodig(?:ing)?|kassacode|toegang)(?:$|[\/_-])|koppel\/code|projectie\/:code|vracht\/volg|lab2\/mijn|salon\/deal\/claim/i;
const VELD_RISICO = /(?:req\.body|\bbody|\bb)\s*(?:\.|\[\s*['"])(?:[a-z0-9_]*(?:code|token|sleutel|pin|password|wachtwoord|pas|pass|claim|ticket|key|secret)[a-z0-9_]*)/i;
const KOP_RISICO = /(?:authorization|x-[a-z0-9-]*(?:code|token|key|secret)|bearer\s)/i;
/* Niet alleen wat binnenkomt kan een deur verraden. Een route die een geheim
   maakt of een PIN/token/kassacode in haar antwoord zet is zelf een issuer en
   moet dus ook worden geclassificeerd. */
const UITGIFTE_RISICO = /(?:\bmakePin\s*\(|\bbearer\.maak\s*\(|\brandomBytes\s*\(|\b(?:pin|token|kassacode|secret)\s*:|\.kassacode\b)/i;

function jsBestanden(map) {
  const uit = [];
  for (const naam of fs.readdirSync(map, { withFileTypes: true })) {
    const vol = path.join(map, naam.name);
    if (naam.isDirectory()) uit.push(...jsBestanden(vol));
    else if (naam.isFile() && naam.name.endsWith('.js')) uit.push(vol);
  }
  return uit;
}

function bronCensus(root = ROOT) {
  const server = path.join(root, 'server');
  const alle = [], onleesbaar = [];
  let aanroepen = 0;
  for (const bestand of jsBestanden(server).sort()) {
    const bron = fs.readFileSync(bestand, 'utf8');
    const calls = [];
    ROUTE_AANROEP.lastIndex = 0;
    let call;
    while ((call = ROUTE_AANROEP.exec(bron))) calls.push({ index: call.index,
      methode: call[1].toUpperCase() });
    aanroepen += calls.length;
    const gevonden = [];
    ROUTE.lastIndex = 0;
    let m;
    while ((m = ROUTE.exec(bron))) gevonden.push({ index: m.index, einde: ROUTE.lastIndex,
      methode: m[1].toUpperCase(), pad: m[3] });
    const leesbarePosities = new Set(gevonden.map(x => x.index));
    for (const c of calls) if (!leesbarePosities.has(c.index)) {
      const regel = 1 + bron.slice(0, c.index).split('\n').length - 1;
      onleesbaar.push({ bron: path.relative(root, bestand).replace(/\\/g, '/'),
        regel, methode: c.methode,
        reden: 'routepad is dynamisch, een regex of niet-letterlijk; expliciete classificatie vereist' });
    }
    for (let i = 0; i < gevonden.length; i++) {
      const r = gevonden[i];
      const volgende = calls.find(x => x.index > r.index);
      const tot = Math.min(bron.length, volgende ? volgende.index : r.einde + 1800);
      const handler = bron.slice(r.einde, tot);
      const redenen = [];
      if (PAD_RISICO.test(r.pad)) redenen.push('verdacht pad');
      if (VELD_RISICO.test(handler)) redenen.push('credentialachtig requestveld');
      if (KOP_RISICO.test(handler)) redenen.push('credentialachtige header/bearer');
      if (UITGIFTE_RISICO.test(handler)) redenen.push('credentialachtige uitgifte/response');
      if (EENMALIGE_ROUTES.has(r.methode + ' ' + r.pad))
        redenen.push('antwoord bevat volgens de replaypoort een eenmalig geheim');
      alle.push({ route: r.methode + ' ' + r.pad,
        bron: path.relative(root, bestand).replace(/\\/g, '/'), redenen });
    }
  }
  const perRoute = new Map();
  for (const r of alle) {
    let d = perRoute.get(r.route);
    if (!d) { d = { route: r.route, bron: [], redenen: [] }; perRoute.set(r.route, d); }
    if (!d.bron.includes(r.bron)) d.bron.push(r.bron);
    for (const reden of r.redenen) if (!d.redenen.includes(reden)) d.redenen.push(reden);
  }
  const routes = [...perRoute.values()].sort((a, b) => a.route.localeCompare(b.route));
  const kandidaten = routes.filter(r => r.redenen.length);
  return { aanroepen, verklaringen: routes.length, kandidaten, onleesbaar,
    sha256: crypto.createHash('sha256').update(JSON.stringify(routes)).digest('hex') };
}

function lees(pad = PAD) { return JSON.parse(fs.readFileSync(pad, 'utf8')); }

function bestandHash(root, rel) {
  const inhoud = fs.readFileSync(path.join(root, rel));
  return crypto.createHash('sha256').update(inhoud).digest('hex');
}

/* Een bestandsnaam alleen is geen bewijs. De release legt daarom per
   gemigreerde deur de actuele bron- en testhashes vast; zodra READY mogelijk
   is, draait voerUit precies die testbundel op dezelfde werkboom. */
function bewijsManifest(register, root = ROOT) {
  const perDeur = [];
  for (const d of register.deuren || []) {
    if (!d || d.status !== 'migrated' ||
        !['credential', 'money_credential'].includes(d.classificatie)) continue;
    const bron = (d.bron || []).filter(rel => fs.existsSync(path.join(root, rel)))
      .map(rel => ({ bestand: rel, sha256: bestandHash(root, rel) }));
    const tests = (d.bewijs || []).filter(rel => fs.existsSync(path.join(root, rel)))
      .map(rel => ({ bestand: rel, sha256: bestandHash(root, rel) }));
    const controls = Object.entries(d.controls || {}).filter(([, waarde]) => waarde === true)
      .map(([naam]) => naam).sort();
    const sha256 = crypto.createHash('sha256')
      .update(JSON.stringify({ id: d.id, controls, bron, tests })).digest('hex');
    perDeur.push({ id: d.id, controls, bron, tests, sha256 });
  }
  const tests = [...new Set(perDeur.flatMap(d => d.tests.map(t => t.bestand)))].sort();
  return { formaat: 'rtg-codecredential-bewijs-v1', uitgevoerd: false,
    status: 'NIET_UITGEVOERD', tests,
    sha256: crypto.createHash('sha256').update(JSON.stringify(perDeur)).digest('hex'), perDeur };
}

/* `routes` zijn de letterlijke verklaringen die de broncensus vindt. Een
   Express-router kan daar nog onder een mount hangen. Zodra een deur zo'n
   mount noemt, zijn `effective_routes` de werkelijke externe adressen en dus
   de adressen die REQUIRED_ROUTES bewaakt. Zo kan `/school/koppel` niet per
   ongeluk als publieke waarheid gelden terwijl de echte deur
   `/api/foundation/school/koppel` heet. */
function effectieveRoutes(d) {
  return Array.isArray(d && d.effective_routes) && d.effective_routes.length
    ? d.effective_routes : (d && d.routes) || [];
}

function controleer(register, root = ROOT) {
  const fouten = [];
  if (!register || register.schema !== 1 || !Array.isArray(register.deuren))
    return { fouten: ['CODECREDENTIALS.json heeft geen geldig schema 1'], blockers: [], telling: {} };
  const ids = new Set(), bronRoutes = new Set(), externeRoutes = new Set();
  const telling = { migrated: 0, closed: 0, remaining: 0 };
  for (const d of register.deuren) {
    if (!d || typeof d.id !== 'string' || !d.id) { fouten.push('deur zonder id'); continue; }
    if (ids.has(d.id)) fouten.push('dubbele deur-id: ' + d.id); else ids.add(d.id);
    if (!STATUSES.has(d.status)) fouten.push(d.id + ': onbekende status'); else telling[d.status]++;
    if (!CLASSIFICATIES.has(d.classificatie)) fouten.push(d.id + ': onbekende classificatie');
    if (!Array.isArray(d.routes) || !d.routes.length) fouten.push(d.id + ': routes ontbreken');
    else for (const route of d.routes) bronRoutes.add(route);
    if (d.effective_mount != null) {
      if (!/^\/[A-Za-z0-9/_-]*$/.test(String(d.effective_mount)) ||
          !Array.isArray(d.effective_routes) || d.effective_routes.length !== d.routes.length)
        fouten.push(d.id + ': routermount mist een een-op-een lijst werkelijke routes');
    }
    for (const route of effectieveRoutes(d)) externeRoutes.add(route);
    if (!Array.isArray(d.bron) || !d.bron.length) fouten.push(d.id + ': bron ontbreekt');
    else for (const bron of d.bron) if (!fs.existsSync(path.join(root, bron)))
      fouten.push(d.id + ': bronbestand bestaat niet: ' + bron);
    if (d.status === 'remaining' && d.release_blocker !== true)
      fouten.push(d.id + ': remaining moet fail-closed een releaseblokkade zijn');
    if (d.status !== 'remaining' && d.release_blocker === true)
      fouten.push(d.id + ': afgeronde deur mag geen releaseblokkade blijven');
    if ((d.classificatie === 'credential' || d.classificatie === 'money_credential') && d.status === 'migrated') {
      if (!d.controls || Number(d.controls.entropy_bits) < Number(register.beleid.credential_min_entropy_bits))
        fouten.push(d.id + ': gemigreerde credential mist minimaal 128-bit bewijs');
      for (const c of CONTROLES) if (!d.controls || d.controls[c] !== true)
        fouten.push(d.id + ': gemigreerde credential mist control ' + c);
      if (!Array.isArray(d.bewijs) || !d.bewijs.length)
        fouten.push(d.id + ': gemigreerde credential mist testbewijs');
      else for (const bewijs of d.bewijs) {
        const b = String(bewijs || '');
        if (!/^test\/[A-Za-z0-9_.\/-]+\.js$/.test(b) || !fs.existsSync(path.join(root, b)))
          fouten.push(d.id + ': testbewijs bestaat niet: ' + b);
      }
    }
  }
  for (const route of REQUIRED_ROUTES) if (!externeRoutes.has(route))
    fouten.push('ontbrekende geïnventariseerde werkelijke route: ' + route);
  const blockers = register.deuren.filter(d => d && d.status === 'remaining' && d.release_blocker === true)
    .map(d => ({ id: d.id, classificatie: d.classificatie,
      routes: effectieveRoutes(d), eigenaar: d.eigenaar }));
  const census = bronCensus(root);
  const onbekend = census.kandidaten.filter(k => !bronRoutes.has(k.route));
  for (const k of onbekend) blockers.push({ id: 'unclassified:' + k.route,
    classificatie: 'unclassified', routes: [k.route], eigenaar: 'unassigned',
    bron: k.bron, redenen: k.redenen });
  for (const k of census.onleesbaar) blockers.push({
    id: 'unparsed-route:' + k.bron + ':' + k.regel,
    classificatie: 'unclassified', routes: [k.methode + ' <dynamisch>'],
    eigenaar: 'unassigned', bron: [k.bron], redenen: [k.reden]
  });
  return { fouten, blockers, telling, bewijs: bewijsManifest(register, root),
    census: { aanroepen: census.aanroepen, verklaringen: census.verklaringen,
      kandidaten: census.kandidaten.length,
      geclassificeerd: census.kandidaten.length - onbekend.length,
      unclassified: onbekend, onleesbaar: census.onleesbaar, sha256: census.sha256 } };
}

function tapTelling(tekst, naam) {
  const patroon = new RegExp('^# ' + naam + ' (\\d+)\\s*$', 'm');
  const raak = String(tekst || '').match(patroon);
  return raak ? Number(raak[1]) : null;
}

/* `node --test` geeft ook exit 0 wanneer iedere relevante proef is
   overgeslagen. Voor releasebewijs is dat hetzelfde als niet testen. Gebruik
   daarom de stabiele TAP-totalen en eis expliciet werkelijk uitgevoerd werk,
   nul skips/todo's en nul geannuleerde proeven. */
function testBewijsOordeel(r) {
  const tap = String(r && r.stdout || '') + '\n' + String(r && r.stderr || '');
  const telling = {};
  for (const naam of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'])
    telling[naam] = tapTelling(tap, naam);
  const compleet = Object.values(telling).every(Number.isInteger);
  const geslaagd = !!r && r.status === 0 && !r.error && compleet &&
    telling.tests > 0 && telling.pass > 0 && telling.fail === 0 &&
    telling.cancelled === 0 && telling.skipped === 0 && telling.todo === 0;
  return { geslaagd, telling, tapGelezen: compleet };
}

function voerUit() {
  let register;
  try { register = lees(); }
  catch (e) {
    console.error(JSON.stringify({ status: 'INVALID', fouten: [e.message] }, null, 2));
    process.exitCode = 1; return;
  }
  const uit = controleer(register);
  let status = uit.fouten.length ? 'INVALID' : (uit.blockers.length ? 'BLOCKED' : 'READY');
  if (!uit.fouten.length && (status === 'READY' || process.argv.includes('--bewijs'))) {
    const cp = require('node:child_process');
    const r = cp.spawnSync(process.execPath,
      ['--test', '--test-reporter=tap', '--test-concurrency=1', ...uit.bewijs.tests], {
      cwd: ROOT, env: process.env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024
    });
    const testOordeel = testBewijsOordeel(r);
    uit.bewijs.uitgevoerd = true;
    uit.bewijs.status = testOordeel.geslaagd ? 'PASS' : 'FAIL';
    uit.bewijs.telling = testOordeel.telling;
    uit.bewijs.tapGelezen = testOordeel.tapGelezen;
    if (r.error) uit.bewijs.foutcode = String(r.error.code || 'SPAWN_ERROR');
    if (r.signal) uit.bewijs.signaal = String(r.signal);
    if (Number.isInteger(r.status)) uit.bewijs.exitcode = r.status;
    if (uit.bewijs.status !== 'PASS') {
      uit.blockers.push({ id: 'credential-control-testbewijs', classificatie: 'testbewijs',
        routes: ['CONTROL TESTS'], eigenaar: 'remaining_code_doors' });
      if (status === 'READY') status = 'BLOCKED';
    }
  }
  console.log(JSON.stringify({ status, register: path.basename(PAD), ...uit }, null, 2));
  if (status !== 'READY') process.exitCode = 1;
}

if (require.main === module) voerUit();
module.exports = { PAD, REQUIRED_ROUTES, CONTROLES, lees, effectieveRoutes,
  bronCensus, bewijsManifest, controleer, testBewijsOordeel, voerUit };
