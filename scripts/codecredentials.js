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
const { zonderCommentaar } = require('./lib/bron');

const PAD = path.join(__dirname, '..', 'CODECREDENTIALS.json');
const ROOT = path.join(__dirname, '..');
const STATUSES = new Set(['migrated', 'closed', 'remaining']);
const CLASSIFICATIES = new Set(['credential', 'money_credential', 'public_identifier',
  'tracking_identifier', 'signed_presentation', 'authenticated_identifier',
  'external_protocol_credential', 'central_session_credential', 'geen_credential']);
/* `geen_credential`: na lezing GEEN identifier of geheim (record-id,
   idempotentiesleutel). Dat haalt hem uit de blokkers, dus nooit goedkoop:
   gesloten, niet blokkerend, met een uitleg die het oordeel naloopt. */
const GEEN_NOTITIE_MIN = 40;
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
  'POST /api/pay/kascode', 'POST /api/pay/kascode/intrek', 'POST /api/supplier/pay/in',
  'POST /api/supplier/pay/vooraf', 'POST /api/supplier/pay/vastleg',
  'POST /api/link/cap/maak', 'POST /api/supplier/link/cap/aanvaard',
  'POST /api/supplier/pos/sale', 'POST /api/supplier/pos/checkout',
  'POST /api/supplier/tafelticket/afrekenen', 'POST /api/supplier/retail/verkoop',
  'POST /api/supplier/ticket/deurverkoop', 'POST /api/festival/verkoop/rond',
  'POST /api/pay/tikcode', 'POST /api/pay/tikcode/intrek', 'POST /api/pay/tik',
  'POST /api/pay/tegoed', 'POST /api/pay/tegoed/koop',
  'POST /api/pay/tegoed/verzilver', 'POST /api/pay/tegoed/terug',
  'POST /api/pay/tegoed/roteer',
  'POST /api/supplier/pay/tegoed', 'POST /api/supplier/pay/tegoed/zet',
  'POST /api/supplier/pay/tegoed/terug', 'POST /api/supplier/pay/tegoed/roteer',
  'POST /api/giftcard/buy', 'POST /api/giftcards/mine', 'POST /api/giftcard/roteer',
  'POST /api/supplier/giftcard/sell', 'POST /api/supplier/giftcard/redeem',
  'POST /api/supplier/giftcard/intrek', 'POST /api/supplier/giftcard/roteer',
  'POST /api/order', 'POST /api/order/pay', 'POST /api/orders/mine',
  'POST /api/bezorg/bestel', 'POST /api/bezorg/volg',
  'POST /api/order/afhaalcode', 'POST /api/order/afhaalcode/intrek',
  'POST /api/supplier/pos/redeem',
  'POST /api/ticket/koop', 'POST /api/tickets/mijn',
  'POST /api/supplier/programma', 'POST /api/supplier/ticket/checkin',
  'POST /api/ticket/toon', 'POST /api/supplier/ticket/toon',
  'POST /api/member/sport/ticket/koop', 'POST /api/sport/scan',
  'POST /api/member/vluchten/boek', 'POST /api/member/vluchten/incheck',
  'POST /api/member/vluchten/mijn', 'POST /api/supplier/lucht/pass',
  'POST /api/lucht/lounge/in',
  'POST /api/mob/kaart/koop', 'POST /api/mob/kaart/mijn',
  'POST /api/mob/abo/koop', 'POST /api/mob/abo/mijn',
  'POST /api/mob/reis/boek', 'POST /api/staff/mob/kaart/controle',
  'POST /api/mob/kaart/toon',
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
  // de gezinsdeur (B18/B19): uitgifte, rotatie, intrekken, stroomticket en verlengen
  'POST /api/foundation/gezin/maak', 'POST /api/foundation/gezin/uitnodiging/accepteer',
  'POST /api/foundation/gezin/code/roteer', 'POST /api/foundation/gezin/code/intrek',
  'GET /api/foundation/gezin/:code/gezinscode', 'POST /api/foundation/gezin/stroom/ticket',
  'GET /api/foundation/gezin/:code/kanaal', 'GET /api/rtf/social/stream',
  'POST /api/foundation/gezin/sessie/verleng', 'POST /api/foundation/gezin/passkey/weg',
  'POST /api/rtf/gezin/passkey',
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
  'POST /api/bedrijf/sleutel/roteer', 'POST /api/bedrijf/sleutel/intrek',
  'POST /api/bedrijf/werkruimte/maak', 'POST /api/bedrijf/werkruimte',
  'POST /api/bedrijf/lid/aanmeld', 'POST /api/bedrijf/lid/besluit',
  'POST /api/bedrijf/leden', 'POST /api/bedrijf/mijn',
  'POST /api/bedrijf/apparaat/zet', 'POST /api/bedrijf/geconsolideerd',
  'POST /api/bedrijf/handeling/plan', 'POST /api/bedrijf/issue/maak',
  'POST /api/bedrijf/storing/koppel', 'POST /api/bedrijf/ticket/maak',
  'POST /api/bedrijf/ticket/reageer', 'POST /api/bedrijf/ticket/sluit',
  'POST /api/bedrijf/ticket/waardeer',
  'POST /api/arrival/request', 'POST /api/arrival/pass',
  'POST /api/arrival/pass/roteer', 'POST /api/arrival/pass/intrek',
  'POST /api/arrival/pulse', 'POST /api/supplier/horeca/arrivals',
  'POST /api/supplier/horeca/arrival/promise',
  /* De classificatieronde van 27 september 2026: de echte, nog onvolwassen
     credentials die de census als ongeclassificeerd vond. Ze staan hier zodat
     hun deur niet stil kan verdwijnen. */
  'POST /api/office/login', 'POST /api/staff', 'POST /api/partnertrips',
  'POST /api/book', 'POST /api/partner', 'POST /api/supplier/horeca/bon/maak',
  'POST /api/supplier/horeca/club/band', 'POST /api/supplier/horeca/bon',
  'POST /api/supplier/horeca/betaal', 'POST /api/gast/betaal',
  'POST /api/link/cap/aanvaard', 'POST /api/link/cap/trek', 'POST /api/ov/code',
  'POST /api/staff/ov/checkin', 'POST /api/mode/bezorg/aanvraag',
  'POST /api/ov/code/intrek', 'POST /api/mode/bezorg/code', 'POST /api/festival/gast/pas/toon',
  'POST /api/rtfos/activiteit/incheckcode', 'POST /api/rtfos/activiteit/inschrijven',
  'POST /api/rtfos/activiteit/afmelden', 'POST /api/mode/bezorg/mijn',
  'POST /api/supplier/mode/bezorg/retour', 'POST /api/festival/gast/passen',
  'POST /api/festival/scan/bundel',
  'POST /api/supplier/mode/bezorg/overhandig', 'POST /api/concern/uitnodigen',
  'POST /api/concern/uitnodigingen', 'POST /api/concern/uitnodiging/accepteer',
  'POST /api/concern/uitnodiging/intrek', 'POST /api/concern/bulk/verstuur',
  'POST /api/festival/pas', 'POST /api/festival/pas/intrek',
  'POST /api/festival/scan', 'POST /api/member/magnaat/teamkamer/maak',
  'POST /api/member/magnaat/teamkamer/deelnemen', 'POST /api/pin/vergeten',
  'POST /api/pin/herstel', 'POST /api/command/apipoort/sleutel',
  'POST /api/command/apipoort/intrekken', 'POST /api/doos/rapport',
  'POST /api/office/doos/sleutel', 'POST /api/office/doos/sleutel/weg',
  'POST /api/supplier/doos/sleutel', 'POST /api/supplier/doos/sleutel/weg',
  'GET /api/doos/kloon', 'POST /api/doos/buurmelding',
  'POST /api/office/partnerkanaal/personeelscode', 'POST /api/office/partnerkanaal/personeelscode/roteer',
  'POST /api/office/partnerkanaal/personeelscode/intrek', 'POST /api/office/partnerkanaal/personeelscodes',
  'POST /api/office/stad/sleutel', 'POST /api/stad/doos/hartslag',
  'POST /api/stad/doos/meting', 'POST /api/techniek/sso',
  'POST /api/techniek/sso/scimsleutel', 'POST /api/techniek/sso/geheim',
  'POST /api/techniek/sso/geheim/overlap/sluit', 'DELETE /api/techniek/sso/scimsleutel/:org',
  'POST /api/member/rtmail/imap/sleutels', 'POST /api/member/rtmail/imap/sleutel',
  'POST /api/member/rtmail/imap/intrekken',
  'POST /api/supplier/rtmail/imap/sleutels',
  'POST /api/supplier/rtmail/imap/sleutel',
  'POST /api/supplier/rtmail/imap/intrekken', 'POST /api/rtfos/activiteit/incheck',
  'POST /api/office/kantoor/uitnodiging',
  'POST /api/office/service/bevestiging/vraag',
  'POST /api/office/service/bevestiging/code', 'POST /api/foundation/les/maak',
  'POST /api/concern/uitnodiging/roteer', 'POST /api/office/kantoor/uitnodiging/intrek',
  'POST /api/member/magnaat/teamkamer/code', 'POST /api/member/magnaat/teamkamer/code/intrek',
  'POST /api/service/bevestiging/toon', 'POST /api/supplier/service/bevestiging/toon',
  'POST /api/foundation/les/join', 'POST /api/foundation/ai',
  'POST /api/foundation/les/code/roteer', 'POST /api/foundation/les/code/intrekken',
  'POST /api/foundation/les/leerling/intrekken', 'POST /api/foundation/les/sluit',
  'POST /api/foundation/les/stroomticket',
  'POST /api/rtf/uitnodiging/accepteer', 'POST /api/rtf/kanaal',
  'POST /api/rtf/toegang', 'POST /api/rtf/bieb', 'POST /api/rtf/bieb/catalogus',
  'POST /api/rtf/bieb/installeer', 'POST /api/rtf/bieb/weg',
  'POST /api/rtf/bieb/mijn', 'POST /api/rtf/beroepen',
  'POST /api/rtf/beroepen/catalogus', 'POST /api/rtf/beroepen/installeer',
  'POST /api/rtf/beroepen/weg', 'POST /api/rtf/beroepen/mijn',
  'POST /api/rtf/geloof', 'POST /api/rtf/geloof/catalogus',
  'POST /api/rtf/geloof/installeer', 'POST /api/rtf/geloof/weg',
  'POST /api/rtf/geloof/mijn', 'POST /api/rtf/geloof/lees',
  'POST /api/rtf/knelpunt', 'POST /api/rtf/apply/chat',
  'POST /api/rtf/apply/chat/send', 'POST /api/rtf/solliciteer',
  'POST /api/rtf/talent/interesse', 'POST /api/rtf/talent/mijn',
  'POST /api/rtf/leren/project-uitnodig', 'POST /api/rtf/leren/sessie-start',
  'POST /api/rtf/leren/taak-zet', 'POST /api/rtf/social/call',
  'POST /api/rtf/social/connect', 'POST /api/rtf/social/dm',
  'POST /api/rtf/social/dm/send', 'POST /api/rtf/social/goedkeuren',
  'POST /api/rtf/social/oudervoeg', 'POST /api/rtf/social/respond',
  'POST /api/rtf/social/snap/send', 'POST /api/rtf/social/unblock',
  'POST /api/supplier/eten/instellingen', 'POST /api/gast/bezorg/checkout',
  'POST /api/supplier/horeca/bon/intrek', 'POST /api/supplier/horeca/bon/roteer', 'POST /api/gast/band'
];
const CONTROLES = ['hash_only_at_rest', 'issuer_doel_scope', 'issued_at_expires_at',
  'max_gebruik_gebruik', 'server_side_intrekken_roteren', 'constant_time_lookup',
  'atomic_claim', 'raw_once'];

/* BRONAFGELEIDE CENSUS: elke letterlijke route in server/ op pad en handlertekst;
   een kandidaat buiten het register is een RELEASEBLOCKER (onbekend is nooit READY). */
const METHODEN = 'get|post|put|patch|delete|head|options|all';
/* `*` en niet `+` na de slash: `app.get('/')` is ook een letterlijke route, en
   met `+` werd hij als onleesbaar geteld (middleware/voordeur.js). */
const ROUTE = new RegExp('\\b(?:app|router)\\.(' + METHODEN + ')\\s*\\(\\s*([\'"`])(\\/[^\'"`$]*)\\2', 'g');
const ROUTE_AANROEP = new RegExp('\\b(?:app|router)\\.(' + METHODEN + ')\\s*\\(', 'g');
const PAD_RISICO = /(?:^|\/)(?:code(?:s|woord)?|sleutel|token|pin|claim|ticket|pas|pass|uitnodig(?:ing)?|kassacode|toegang)(?:$|[\/_-])|koppel\/code|projectie\/:code|vracht\/volg|lab2\/mijn|salon\/deal\/claim/i;
const VELD_RISICO = /(?:req\.body|\bbody|\bb)\s*(?:\.|\[\s*['"])(?:[a-z0-9_]*(?:code|token|sleutel|pin|password|wachtwoord|pas|pass|claim|ticket|key|secret)[a-z0-9_]*)/i;
/* `sleutel` hoort erbij: `x-doos-eigen-sleutel` (kern/stad) is een apparaatsleutel
   in een kop, en zonder dit woord zag de census die route niet eens. */
const KOP_RISICO = /(?:authorization|x-[a-z0-9-]*(?:code|token|key|secret|sleutel)|bearer\s)/i;
/* Ook een route die een geheim in haar antwoord zet is een issuer. */
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

/* DYNAMISCHE ROUTES ZONDER HANDLIJST: `p.pad + '/verstuur'` is hier onleesbaar,
   maar ROUTEBRON.json kent bestand en regel uit de ROUTER (`samengesteld: true`);
   een verouderde regel valt terug op onleesbaar (sleutel bestand:regel). */
function routebronKaart(root) {
  const kaart = new Map();
  let rb = null;
  try { rb = JSON.parse(fs.readFileSync(path.join(root, 'ROUTEBRON.json'), 'utf8')); } catch (e) { return kaart; }
  for (const r of Object.values((rb && rb.perRoute) || {})) {
    if (!r || !r.samengesteld || !r.bestand || !Number.isSafeInteger(r.regel)) continue;
    const m = /^([A-Z]+) (\/\S*)$/.exec(String(r.route || ''));
    if (!m) continue;
    const k = r.bestand + ':' + r.regel;
    if (!kaart.has(k)) kaart.set(k, []);
    kaart.get(k).push({ methode: m[1], pad: m[2] });
  }
  return kaart;
}

/* Wat ook de router niet kent, wordt VERKLAARD met bron en exacte regeltekst;
   een gewijzigde regel verklaart niets meer. */
function aanroepTekst(bron, index) {
  const eind = bron.indexOf('\n', index);
  return bron.slice(bron.lastIndexOf('\n', index) + 1, eind < 0 ? bron.length : eind).trim();
}

function bronCensus(root = ROOT, register = null) {
  const server = path.join(root, 'server');
  const alle = [], onleesbaar = [], verklaardDynamisch = [];
  const kaart = routebronKaart(root);
  const verklaringen = Array.isArray(register && register.dynamische_aanroepen) ? register.dynamische_aanroepen : [];
  let aanroepen = 0, letterlijk = 0, doorRouter = 0;
  for (const bestand of jsBestanden(server).sort()) {
    /* COMMENTAAR IS GEEN CODE (een `app.post(` of "Authorization" in uitleg maakte
       anders een kandidaat); platgeslagen met regelsHeel, zodat regels kloppen. */
    const bron = zonderCommentaar(fs.readFileSync(bestand, 'utf8'), { regelsHeel: true });
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
    letterlijk += leesbarePosities.size;
    const rel = path.relative(root, bestand).replace(/\\/g, '/');
    for (const c of calls) if (!leesbarePosities.has(c.index)) {
      const regel = 1 + bron.slice(0, c.index).split('\n').length - 1;
      const opgelost = kaart.get(rel + ':' + regel);
      if (opgelost) {
        doorRouter++;
        /* Elke route die de router op deze regel vond, krijgt dezelfde keuring
           als een letterlijke: pad plus het handlervenster vanaf deze aanroep. */
        for (const r of opgelost) gevonden.push({ index: c.index, einde: c.index, methode: r.methode,
          pad: r.pad, dynamisch: true });
        continue;
      }
      const tekst = aanroepTekst(bron, c.index);
      const verklaring = verklaringen.find(v => v && v.bron === rel && v.aanroep === tekst);
      if (verklaring) { verklaardDynamisch.push({ bron: rel, regel, aanroep: tekst }); continue; }
      onleesbaar.push({ bron: rel, regel, methode: c.methode,
        reden: 'routepad is dynamisch, een regex of niet-letterlijk en de router kent hem niet op deze regel; ' +
          'verklaar hem in dynamische_aanroepen of maak het pad letterlijk' });
    }
    gevonden.sort((a, b) => a.index - b.index);
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
  return { aanroepen, letterlijk, doorRouter, verklaringen: routes.length, kandidaten, onleesbaar, verklaardDynamisch,
    sha256: crypto.createHash('sha256').update(JSON.stringify(routes)).digest('hex') };
}

/* KORT EN VOORGELEZEN. Een code die een mens hardop voorleest (de bezorgcode
   aan de deur) haalt de 128 bits niet, en een langere code zou het product
   slopen. Zo'n deur mag alleen gemigreerd heten als hij het EERLIJK zegt --
   `entropy_bits` blijft onwaar -- en de compenserende grenzen draagt: nooit
   voor geld, gebonden aan EEN object, een rem met vergrendeling, een plafond
   op het aantal nieuwe codes, en een reden in woorden. */
const KORT_VEREIST = ['een_object_gebonden', 'rem_met_vergrendeling'];
function korteCodeGedragen(d) {
  const k = d && d.korte_code;
  return d.classificatie === 'credential' && d.controls.entropy_bits === false && !!k &&
    KORT_VEREIST.every(x => k[x] === true) && Number.isSafeInteger(k.max_fout) && k.max_fout > 0 &&
    k.max_fout <= 10 && Number.isSafeInteger(k.max_rotatie) && k.max_rotatie > 0 &&
    Number.isFinite(k.bits) && String(k.reden || '').trim().length >= 80;
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

/* `routes` zijn wat de broncensus letterlijk vindt; noemt een deur een
   routermount, dan zijn `effective_routes` de echte externe adressen (en die
   bewaakt REQUIRED_ROUTES): `/school/koppel` heet buiten `/api/foundation/school/koppel`. */
function effectieveRoutes(d) {
  return Array.isArray(d && d.effective_routes) && d.effective_routes.length
    ? d.effective_routes : (d && d.routes) || [];
}

/* De ENIGE weg onder de 128 bit: een verklaarde korte menscode (een mens leest
   hem voor). Alleen met binding, pogingenrem en uitgifte na een handeling van de
   houder, binnen de plafonds van het beleid, en met een onderbouwing. */
function korteMenscode(b, d) {
  const k = d.korte_menscode, c = d.controls || {}, n = x => Number(x);
  return !!(b && k && n(c.entropy_bits) >= 1 && n(k.geldig_seconden) > 0 && n(k.geldig_seconden) <= n(b.max_geldig_seconden) &&
    n(k.max_pogingen_per_code) >= 1 && n(k.max_pogingen_per_code) <= n(b.max_pogingen_per_code) &&
    n(k.max_uitgiften) >= 1 && n(k.max_uitgiften) <= n(b.max_uitgiften) &&
    (b.vereist || []).every(x => c[x] === true) && String(k.waarom || '').trim().length >= n(b.waarom_min_tekens));
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
    if (d.classificatie === 'geen_credential' && (d.status !== 'closed' ||
        d.release_blocker !== false || String(d.notitie || '').trim().length < GEEN_NOTITIE_MIN))
      fouten.push(d.id + ': geen_credential vraagt status closed, geen releaseblokkade en een notitie van minstens ' +
        GEEN_NOTITIE_MIN + ' tekens met het bewijs');
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
    /* CONTRACTVERSIE (Fase 1, Access/Grant): een deur die zegt dat hij op
       bearercode v2 staat, moet dat in zijn eigen bron laten zien -- een
       uitgifte met een expliciete geldigheid en een verklaarde afgeleide
       toegang. Een register dat v2 zegt terwijl de code nog v1 uitgeeft, is
       een geruststelling en geen inventaris. Zonder veld blijft het v1. */
    if (d.contractversie != null) {
      if (d.contractversie !== 1 && d.contractversie !== 2) fouten.push(d.id + ': contractversie is 1 of 2');
      else if (d.contractversie === 2 && !(d.bron || []).some(b => !/bearercode/.test(b) && (() => {
        try { const t = zonderCommentaar(fs.readFileSync(path.join(root, b), 'utf8')); return /geldigheid\s*:/.test(t) && /afgeleid\s*:/.test(t); }
        catch (e) { return false; }
      })())) fouten.push(d.id + ': contractversie 2, maar geen bronbestand geeft een geldigheid en een afgeleide toegang mee');
    }
    if (d.status === 'remaining' && d.release_blocker !== true)
      fouten.push(d.id + ': remaining moet fail-closed een releaseblokkade zijn');
    if (d.status !== 'remaining' && d.release_blocker === true)
      fouten.push(d.id + ': afgeronde deur mag geen releaseblokkade blijven');
    if ((d.classificatie === 'credential' || d.classificatie === 'money_credential') && d.status === 'migrated') {
      if (!d.controls || (Number(d.controls.entropy_bits) < Number(register.beleid.credential_min_entropy_bits) &&
          !korteCodeGedragen(d) && !korteMenscode(register.beleid.korte_menscode, d)))
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
  const census = bronCensus(root, register);
  const verklaringen = Array.isArray(register.dynamische_aanroepen) ? register.dynamische_aanroepen : [];
  for (const v of verklaringen) {
    const id = 'dynamische aanroep ' + (v && v.bron) + ': ' + (v && v.aanroep);
    if (!v || typeof v.bron !== 'string' || typeof v.aanroep !== 'string' || !v.aanroep) fouten.push(id + ': onvolledig');
    else if (!CLASSIFICATIES.has(v.classificatie) || v.classificatie === 'credential' || v.classificatie === 'money_credential')
      fouten.push(id + ': een dynamische credential wordt niet verklaard maar letterlijk gemaakt');
    else if (String(v.notitie || '').trim().length < 40) fouten.push(id + ': notitie zegt niet waarom');
    else if (!census.verklaardDynamisch.some(x => x.bron === v.bron && x.aanroep === v.aanroep))
      fouten.push(id + ': deze aanroep bestaat niet meer -- haal de verklaring weg');
  }
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
    telling.tests > 0 && telling.pass === telling.tests && telling.fail === 0 &&
    telling.cancelled === 0 && telling.skipped === 0 && telling.todo === 0;
  return { geslaagd, telling, tapGelezen: compleet };
}

/* PG-control-tests zijn al per eigen database uitgevoerd door pgtoetsen.js.
   Nogmaals draaien binnen de lokale releaseomgeving gaf zeven SKIP-resultaten.
   Consumeer de oorspronkelijke bytes, met exacte commit en volledige telling;
   de gewone control-tests blijven in hun eigen lokale opslag draaien. */
function pgControlBewijs(root, commit, tests) {
  if (!/^[a-f0-9]{40}$/.test(String(commit || ''))) throw Error('PG-control-bewijs mist de volledige kandidaatcommit.');
  const { bewijs, sha256 } = require('./ci-pg-bewijs').controleer(root, commit);
  const rel = '.release/pg-bewijs.json';
  const controles = tests.map(bestand => {
    const controle = bewijs.controles.find(c => c.bestand === bestand);
    if (!controle) throw Error('PG-control-test ontbreekt: ' + bestand);
    return controle;
  });
  const velden = { tests:'tests', pass:'geslaagd', fail:'mislukt', cancelled:'geannuleerd', skipped:'overgeslagen', todo:'todo' };
  return { status:'PASS', commit, pad:rel, sha256,
    controles, telling:Object.fromEntries(Object.entries(velden).map(([naam,veld]) =>
      [naam,controles.reduce((n,c) => n + c[veld],0)])) };
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
    const pgSet = new Set(require('./lib/pg-toetslijst').TOETSEN);
    const pgTests = uit.bewijs.tests.filter(p => pgSet.has(p));
    const lokaleTests = uit.bewijs.tests.filter(p => !pgSet.has(p));
    const r = cp.spawnSync(process.execPath,
      ['--test', '--test-reporter=tap', '--test-concurrency=1', ...lokaleTests], {
      cwd: ROOT, env: require('./lib/suite-pg').lokaleOmgeving(process.env), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024
    });
    const testOordeel = testBewijsOordeel(r);
    let pg = null;
    if (pgTests.length) {
      try {
        const bron = require('./lib/stempel').exactStempel();
        if (bron.boomVuil) throw Error('PG-control-bewijs vereist een schone kandidaat.');
        pg = pgControlBewijs(ROOT, bron.commit, pgTests);
      } catch (e) { pg = { status:'FAIL', tests:pgTests, fout:String(e.message) }; }
    }
    uit.bewijs.uitgevoerd = true;
    uit.bewijs.status = testOordeel.geslaagd && (!pg || pg.status === 'PASS') ? 'PASS' : 'FAIL';
    uit.bewijs.lokaal = { tests:lokaleTests, ...testOordeel };
    uit.bewijs.postgres = pg;
    uit.bewijs.telling = Object.fromEntries(Object.entries(testOordeel.telling)
      .map(([naam,n]) => [naam, Number.isInteger(n) ? n + (pg?.telling?.[naam] || 0) : null]));
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
  bronCensus, bewijsManifest, controleer, testBewijsOordeel, pgControlBewijs, voerUit };
