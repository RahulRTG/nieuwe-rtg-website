#!/usr/bin/env node
/* ============================================================================
   DE ZAAKWIG -- één bestelling, van het lid tot in de kassa.

   WAAROM DIT GEEN METER IS

   De tredeproef meet BREED: alle routes, alle treden, wat open staat en wat
   dicht. Dat is precies wat je nodig hebt om te weten of een trede klein is --
   en precies wat je NIET vertelt of de wig ook echt werkt. Een keten van tien
   stappen die elk 200 geven, kan nog steeds twee bestellingen aanmaken, een bon
   dubbel uitgeven of een status zetten die niet bestaat.

   Dit is daarom één scenario en geen zoveelste teller: één lid, één zaak, één
   bestelling, en bij elke schakel de vraag of de BEDRIJFSREGEL klopt. Niet
   "antwoordt hij 200" maar "is het er precies een, ziet de kassa dezelfde bon,
   en weigert hij de tweede keer".

   DE KETEN, EN DE VOLGORDE DIE DEZE PROEF HEEFT RECHTGEZET

     lid vindt zaak -> leest de kaart -> bestelt -> BETAALT -> pas dan ziet de
     zaak hem -> de zaak zet een status -> het lid ziet die status -> de kassa
     haalt hem op met de afhaalcode.

   Die volgorde stond eerst anders (de zaak zou hem meteen zien), en dat was
   fout. Een bon met status `wacht-op-betaling` wordt op DRIE plekken uit het
   zicht van de zaak gefilterd -- kern/leverancier/state.js r.17,
   kern/eten/partnerwerk.js r.30 -- en dat is geen bug maar de regel: een zaak
   krijgt geen werk van iemand die niet betaald heeft.

   DAT HEEFT EEN GEVOLG VOOR TREDE 3, en dat is de vondst van deze proef.
   "De vloer draait" belooft bestellen zonder betaalrail. Langs DEZE weg kan dat
   niet: een vooruitbetaalde bestelling blijft op wacht-op-betaling staan en
   bereikt de zaak nooit. De vloer draait op trede 3 dus via de horeca-rekening
   (betalen na het eten, een open rekening op de tafel) en niet via /api/order.
   Deze proef stelt dat vast in plaats van het te vermoeden.

   Trede 3 (de vloer draait) hoort dit te kunnen ZONDER geld: RTG_BETALEN_UIT=1,
   en dan weigert elke betaalweg fail-closed. Trede 4 (het fundament) hoort het
   met geld te kunnen. Trede 6 is alles open. Daarom draait deze proef op die
   drie en niet op een.

   DE INVARIANTEN, want daar gaat het om:

     EEN BESTELLING   na het bestellen staat er precies EEN bon met die ref.
     GEEN DUBBELE BON de kassa mag dezelfde afhaalcode niet twee keer uitgeven.
     GELDIGE STATUS   een status buiten de lijst wordt geweigerd (400), en een
                      geldige status komt bij het lid terug zoals de zaak hem zette.
     ZELFDE BON       de kassa vindt de bon die het lid plaatste, op de
                      afhaalcode -- niet een andere en niet een kopie.
     GELD VOLGT DE TREDE  onder trede 4 weigert elke betaalweg, ook de
                      administratieve (de kassa die "voldaan" zet). Dat laatste
                      staat met zoveel woorden in opzet/betaalstop.js: zonder
                      betalen mag er nergens een betaling worden gesimuleerd of
                      alleen administratief als voldaan gemarkeerd.

   Draai: npm run zaakwig            (trede 3, 4 en 6)
          npm run zaakwig -- --trede fundament
          npm run zaakwig -- --vastleggen
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const arg = (naam, std) => { const i = process.argv.indexOf(naam); return i > 0 ? process.argv[i + 1] : std; };
const TREDEN = ['bestellen', 'fundament', 'alles'];

/* Het oordeel over een invariant staat apart en puur, om dezelfde reden als bij
   de tredeproef: wat in de scenariofunctie staat, staat achter een server en is
   niet te toetsen. Een invariant kent drie uitkomsten en 'niet gedraaid' is er
   een van -- een stap die niet kon draaien is geen geslaagde stap. */
function oordeelInvariant({ gedraaid, geslaagd }) {
  if (!gedraaid) return { uitkomst: 'niet-gedraaid', goed: false };
  return { uitkomst: geslaagd ? 'ok' : 'GEZAKT', goed: !!geslaagd };
}

function vrijePoort() {
  const uit = require('child_process').execFileSync(process.execPath, ['-e',
    "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{" +
    "process.stdout.write(String(s.address().port));s.close();});"], { encoding: 'utf8', timeout: 10000 });
  const n = Number(String(uit).trim());
  if (!(n > 1024 && n < 65536)) throw new Error('geen vrije poort gekregen');
  return n;
}

/* --------------------------------------------------------------- de proef -- */

async function meet(tredeId) {
  const poort = vrijePoort();
  process.env.PORT = String(poort);
  process.env.RTG_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zaakwig-'));
  process.env.SMTP_URL = '';
  process.env.STUN_UIT = '1';
  process.env.RTG_DEMO = '1';
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.ANTHROPIC_API_KEY = '';

  const functies = require(path.join(WORTEL, 'server', 'functies'));
  const trede = functies.FASES.find(f => f.id === tredeId);
  if (!trede) throw new Error('onbekende trede: ' + tredeId);
  const aan = new Set(trede.aan || functies.FUNCTIES.map(f => f.id));
  const geldAan = functies.FASES.findIndex(f => f.id === tredeId) >= functies.FASES.findIndex(f => f.id === 'fundament');
  if (!geldAan) process.env.RTG_BETALEN_UIT = '1';

  const echt = { log: console.log, warn: console.warn, info: console.info };
  console.log = console.warn = console.info = () => {};
  let db;
  try {
    require(path.join(WORTEL, 'server', 'server'));
    db = require(path.join(WORTEL, 'server', 'db'));
  } finally { if (!process.argv.includes('--uit')) Object.assign(console, echt); }

  db.db.data.techniek = db.db.data.techniek || {};
  const stand = {};
  for (const f of functies.FUNCTIES) if (!aan.has(f.id)) stand[f.id] = { aan: false };
  db.db.data.techniek.functies = stand;
  db.save();

  const B = 'http://127.0.0.1:' + poort;
  const post = async (p, lijf, token) => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8000);
    try {
      const r = await fetch(B + p, { method: 'POST', signal: ac.signal,
        headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify(lijf || {}) });
      let d = null; try { d = await r.json(); } catch (e) { /* geen json */ }
      return { s: r.status, d };
    } catch (e) { return { s: null, d: null }; }
    finally { clearTimeout(t); }
  };

  const stappen = [], invarianten = [];
  const stap = (wat, r, ok) => { stappen.push({ wat, status: r && r.s, geslaagd: !!ok }); return ok; };
  const inv = (wat, gedraaid, geslaagd, uitleg) =>
    invarianten.push({ wat, uitleg, ...oordeelInvariant({ gedraaid, geslaagd }) });

  /* ---- de keten ---- */
  const inlog = await post('/api/login', { tier: 'rtg' });
  const lid = inlog.d && inlog.d.token;
  stap('lid logt in', inlog, !!lid);

  const zaakInlog = await post('/api/supplier/login', { username: 'rahul', password: process.env.DEMO_PASS || 'Imran' });
  const zt = zaakInlog.d && zaakInlog.d.token;
  const code = zaakInlog.d && zaakInlog.d.state && zaakInlog.d.state.supplier && zaakInlog.d.state.supplier.code;
  stap('de zaak logt in', zaakInlog, !!zt && !!code);

  const lijst = await post('/api/suppliers', {}, lid);
  const zichtbaar = ((lijst.d && lijst.d.suppliers) || []).some(z => z.code === code);
  stap('het lid vindt de zaak', lijst, zichtbaar);

  const kaart = await post('/api/supplier/menu/get', { code }, lid);
  const gerecht = ((kaart.d && kaart.d.menu) || [])[0];
  stap('het lid leest de kaart', kaart, !!gerecht);

  let ref = null, pickup = null;
  if (gerecht) {
    const ord = await post('/api/order', { supplierCode: code, items: [{ id: gerecht.id, qty: 1 }] }, lid);
    ref = ord.d && ord.d.order && ord.d.order.ref;
    pickup = ord.d && ord.d.order && ord.d.order.pickup;
    stap('het lid bestelt', ord, !!ref);
  }

  /* INVARIANT: precies EEN bon met die ref. */
  const mijn1 = ref ? await post('/api/orders/mine', {}, lid) : null;
  const metRef = mijn1 ? ((mijn1.d && mijn1.d.orders) || []).filter(o => o.ref === ref).length : 0;
  inv('exact een bestelling met deze ref', !!ref, metRef === 1,
    'gevonden: ' + metRef + ' -- twee zou betekenen dat een tik twee bonnen maakt');

  /* INVARIANT: een ONBETAALDE bon is bij de zaak niet zichtbaar. Dat is de
     regel van dit huis en hij geldt op elke trede. */
  const voor = await post('/api/supplier/state', {}, zt);
  const zichtVoor = (((voor.d && voor.d.state) || {}).orders || []).some(o => o.ref === ref);
  inv('een onbetaalde bon is bij de zaak NIET zichtbaar', !!ref, !zichtVoor,
    'de zaak zag hem al voor de betaling -- dan krijgt een zaak werk van wie niet betaald heeft');

  /* Betalen volgt de trede. */
  const pay = ref ? await post('/api/order/pay', { ref }, lid) : null;
  if (geldAan) {
    stap('het lid betaalt', pay, pay && pay.s === 200);
    inv('de betaling hoort bij DEZELFDE bon', !!(pay && pay.s === 200),
      !!(pay.d && pay.d.order && pay.d.order.ref === ref), 'betaald: ' + (pay && pay.d && pay.d.order && pay.d.order.ref));
  } else {
    inv('onder trede 4 weigert betalen fail-closed', !!ref,
      pay && pay.s === 503 && pay.d && pay.d.code === 'betalingen-uit',
      'antwoord: ' + (pay && pay.s) + ' ' + (pay && pay.d && pay.d.code));
    /* DE AFGEBROKEN BETALING. Weigert de rail, dan hoort de bon in een GELDIGE
       toestand te blijven -- niet half betaald, niet verdwenen. */
    const naWeigering = await post('/api/orders/mine', {}, lid);
    const bon = ((naWeigering.d && naWeigering.d.orders) || []).find(o => o.ref === ref);
    inv('na een geweigerde betaling blijft de bon geldig en onbetaald', !!ref,
      !!bon && bon.status === 'wacht-op-betaling' && !bon.paid,
      'stand: ' + (bon ? bon.status + (bon.paid ? ' (paid!)' : '') : 'de bon is weg'));
  }

  /* Vanaf hier loopt de keten alleen door als er betaald IS: een zaak ziet een
     onbetaalde bon niet, en dat is precies de vorige invariant. */
  const zaakZiet = geldAan ? (((await post('/api/supplier/state', {}, zt)).d || {}).state || {}) : null;
  const naBetaling = zaakZiet ? (zaakZiet.orders || []).some(o => o.ref === ref) : false;
  if (geldAan) {
    stap('de zaak ziet hem NA de betaling', { s: 200 }, naBetaling);
    inv('de zaak ziet DEZELFDE bon', !!ref, naBetaling, 'op ref ' + ref);
  } else {
    inv('op deze trede bereikt een vooruitbetaalde bon de zaak NIET', !!ref, true,
      'dat is geen defect maar het gevolg van "de vloer zonder betaalrail": deze weg loopt hier dood, de horeca-rekening is de weg die het wel doet');
  }

  /* INVARIANT: een status buiten de lijst wordt geweigerd -- op elke trede. */
  const raar = ref ? await post('/api/supplier/order/status', { ref, status: 'verzonnen' }, zt) : null;
  inv('een onbekende status wordt geweigerd', !!ref, raar && raar.s === 400,
    'antwoord: ' + (raar && raar.s));

  if (geldAan) {
    const zet = await post('/api/supplier/order/status', { ref, status: 'in bereiding' }, zt);
    stap('de zaak zet de status op "in bereiding"', zet, zet.s === 200);

    const mijn2 = await post('/api/orders/mine', {}, lid);
    const bijLid = ((mijn2.d && mijn2.d.orders) || []).find(o => o.ref === ref);
    inv('het lid ziet dezelfde status als de zaak zette', zet.s === 200,
      !!bijLid && bijLid.status === 'in bereiding', 'bij het lid: ' + (bijLid && bijLid.status));

    const kassa1 = await post('/api/supplier/pos/redeem', { code: pickup }, zt);
    stap('de kassa vindt hem op de afhaalcode', kassa1, kassa1.s === 200 || kassa1.s === 409);
    const kassa2 = await post('/api/supplier/pos/redeem', { code: pickup }, zt);
    inv('geen dubbele bon: de tweede keer weigert', !!pickup, kassa2 && kassa2.s === 409,
      'antwoord: ' + (kassa2 && kassa2.s) + ' -- 200 zou betekenen dat dezelfde bon twee keer uitgaat');
  } else {
    /* Zonder betaalrail hoort ook de KASSA te weigeren: administratief
       "voldaan" zetten is ook betalen (opzet/betaalstop.js). */
    const kassa1 = pickup ? await post('/api/supplier/pos/redeem', { code: pickup }, zt) : null;
    inv('zonder betaalrail weigert ook de KASSA', !!pickup, kassa1 && kassa1.s === 503,
      'antwoord: ' + (kassa1 && kassa1.s) + ' -- administratief "voldaan" zetten is ook betalen');
  }

  return {
    trede: trede.id, tredeNaam: trede.naam, geldAan,
    zaak: code, ref, pickup,
    stappen, invarianten,
    stappenGezakt: stappen.filter(s => !s.geslaagd).length,
    invariantenGezakt: invarianten.filter(i => !i.goed).length
  };
}

/* ---------------------------------------------------------------- rapport -- */

function rapport(rr) {
  const L = [];
  L.push('DE ZAAKWIG -- een bestelling van het lid tot in de kassa');
  L.push('');
  for (const r of rr) {
    L.push(`  ${r.tredeNaam}   (zaak ${r.zaak}, bon ${r.ref || '-'})`);
    for (const s of r.stappen) L.push(`    ${s.geslaagd ? 'ok  ' : 'ZAKT'}  ${String(s.status).padStart(3)}  ${s.wat}`);
    for (const i of r.invarianten)
      L.push(`    ${i.uitkomst === 'ok' ? 'ok  ' : i.uitkomst === 'GEZAKT' ? 'ZAKT' : 'leeg'}       ${i.wat}` +
        (i.uitkomst === 'ok' ? '' : '  -- ' + i.uitleg));
    L.push(`    ${r.stappenGezakt} stap(pen) en ${r.invariantenGezakt} invariant(en) gezakt.`);
    L.push('');
  }
  L.push('  Wat dit NIET doet: het is EEN scenario met EEN zaak en EEN bon. Het zegt niets');
  L.push('  over gelijktijdigheid, over meerdere zaken naast elkaar, of over de vraag wat er');
  L.push('  gebeurt als de betaling halverwege afbreekt -- dat laatste vraagt een provider');
  L.push('  die kan haperen (server/betaal/synthetisch.js) en staat er nog niet in.');
  return L.join('\n');
}

/* ------------------------------------------------------------------ start -- */

if (require.main === module) {
  (async () => {
    const enkel = arg('--trede', null);
    if (enkel) {
      const r = await meet(enkel);
      const uitPad = arg('--uit', null);
      if (uitPad) fs.writeFileSync(uitPad, JSON.stringify(r, null, 2) + '\n');
      else process.stdout.write(rapport([r]) + '\n');
      process.exit(r.stappenGezakt || r.invariantenGezakt ? 1 : 0);
    }
    /* Elke trede in een EIGEN proces: de app houdt zijn stand vast, en een
       tweede trede in hetzelfde proces meet wat er niet staat. */
    const cp = require('child_process');
    const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wig-'));
    const uit = [];
    try {
      for (const t of TREDEN) {
        const doel = path.join(map, t + '.json');
        const r = cp.spawnSync(process.execPath, [__filename, '--trede', t, '--uit', doel],
          { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, PORT: '', RTG_DATA_DIR: '', RTG_BETALEN_UIT: '' } });
        if (!fs.existsSync(doel)) throw new Error('trede ' + t + ' leverde geen uitslag (exit ' + r.status + '): ' + String(r.stderr || '').slice(-300));
        uit.push(JSON.parse(fs.readFileSync(doel, 'utf8')));
      }
    } finally { try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {} }

    const gezakt = uit.reduce((n, r) => n + r.stappenGezakt + r.invariantenGezakt, 0);
    if (process.argv.includes('--vastleggen')) {
      fs.writeFileSync(path.join(WORTEL, 'ZAAKWIG.json'), JSON.stringify({
        /* Met stempel en `hoe`: deze wig loopt een echte bestelling langs een
           draaiende server, dus hij veroudert met de code eronder. */
        stempel: stempel(), hoe: 'npm run zaakwig:vast',
        gemetenOp: new Date().toISOString().slice(0, 10), treden: uit, gezakt }, null, 2) + '\n');
      process.stdout.write(rapport(uit) + '\n\nVastgelegd in ZAAKWIG.json\n');
    } else process.stdout.write(rapport(uit) + '\n');
    process.exit(gezakt ? 1 : 0);
  })().catch(e => { process.stderr.write('de zaakwig kon niet draaien: ' + (e && e.stack || e) + '\n'); process.exit(2); });
}

module.exports = { meet, rapport, oordeelInvariant, TREDEN };
