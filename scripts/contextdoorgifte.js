#!/usr/bin/env node
/* ============================================================================
   CONTEXTDOORGIFTE -- loopt de identiteit van een verzoek waar hij hoort, en
   NIET verder?

   WAAROM DIT ER IS. Dit huis heeft zeven AsyncLocalStorage-winkels (handeling,
   envelop-keten, kostenhaak, verzoekcontext, bijeen, effectmeter, ai-context).
   Het onderzoek naar een verzoekframe (Fase 2, RTG Request Frame) mat ze met
   een wegwerpprobe en vond geen tegenspraak BINNEN een verzoek, maar wel drie
   gaten aan de randen: de bus-envelop draagt de verzoekcorrelatie nooit,
   achtergrondtimers erven stil de identiteit van een verzoek dat al klaar is,
   en vier van de zes schrijvende contexten zeggen na sluiten nog "gelukt".
   Deze meter is die probe als blijvend instrument: het frame dat erna komt
   moet tegen DEZE getallen bewijzen dat het iets oplost.

   WAT HIJ MEET -- twaalf invarianten, elk apart en met opzet geen totaalcijfer:

     I1  een envelop die binnen een verzoek ontstaat, draagt diens correlatie
     I2  de correlatie maakt de server; een client-id is alleen `extern`, begrensd
     I3  handeling, ai-context en req.envelop zijn het eens over de correlatie
     I4  achtergrondwerk erft geen verzoekidentiteit (timers na afloop)
     I5  na sluiten zegt geen context stil "gelukt"
     I8  op de bus staat als actor een codenaam en nooit een datasleutel user-<n>
     I9  geen enterWith in server/
     I11 Rahuls interne aanroep (/api/member/doe) draagt het buitenste verzoek
         als oorzaak, en die oorzaak is ondertekend (kern/agentteken.js)
     I12 een bus-abonnee draait niet in de contexten van de publiceerder, op
         beide transporten gelijk (in proces en over Redis)
     I13 elk verzoekframe heeft precies een identiteit (een andere sleutel na
         de eerste is een fout; dezelfde, scherper bekeken, is `herkend`)
     I14 het verzoekframe is op elk auth-punt aanwezig en eens met handeling,
         req.id, extern, req.envelop en de kostendrager
     I10 elke verzoekcontext overleeft de body-lezer (POST op het auth-punt)

   I1, I3, I4 en I10 draaien een ECHTE server (scripts/lib/contextdoorgifte-
   peil.js als preload) en rijden de statische leden- en zaakroutes. I5 draait
   in dit proces tegen de echte modules, I9 leest de bron.

   DE RATEL staat in CONTEXTDOORGIFTE.json onder `ratel` en wordt bewaakt door
   test/contextdoorgifte.test.js. Elke tand heeft een richting: wat vandaag rood
   is (I1, I4, I5) staat op zijn huidige stand en mag alleen de goede kant op.

   ZELFIJKING (LAT.md regel 10). Voordat een getal iets mag zeggen, slaat het
   instrument uit op iets waarvan we weten dat het fout is: in de server een
   nagebootst verzoek met een timer na afloop en een envelop met correlatie, en
   hier een synthetische schrijver die stil slaagt. Ziet de meter die niet, dan
   meldt hij `meterStuk` en eindigt hij met een foutcode.

   WAT HIJ NIET ZIET, en dat hoort erbij: alleen statische paden met een leeg
   of plausibel lijf, alleen de rollen lid en zaak, geen PostgreSQL- en geen
   Redis-stand, en alleen timers via de globale setTimeout/setInterval/
   setImmediate. Een nul over een kleine noemer is een kleine nul; daarom staat
   de noemer naast elk getal en is een lege noemer `niet vast te stellen`.

   Draai:  npm run contextdoorgifte            (alles, ~2600 verzoeken)
           node scripts/contextdoorgifte.js --statisch   (alleen I5, I9 en I12)
           node scripts/contextdoorgifte.js --max=300
           node scripts/contextdoorgifte.js --vastleggen (ratel bijwerken,
                                                 alleen de goede kant op)
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const { AsyncResource } = require('async_hooks');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'CONTEXTDOORGIFTE.json');
const S = (p) => require(path.join(WORTEL, 'server', p));

/* De ratel: per tand een richting. `aandeel` is een breuk en geen aantal, zodat
   een grotere noemer (meer routes) de tand niet laat bewegen. */
/* I4 rateelt op PLEKKEN en niet op het aantal vuringen: hoeveel keer een gedeelde
   spoeltimer vuurt hangt af van tempo en volgorde (15 en 20 op dezelfde commit),
   en een tand die van de klok afhangt bijt willekeurig. Het aantal staat er wel
   bij, in `gemeten`. */
const RICHTING = {
  i1AandeelMetCorrelatie: 'omhoog',
  i2ClientSleutel: 'omlaag',
  i2ExternFout: 'omlaag',
  i3CorrelatieOneens: 'omlaag',
  i4LekPlekken: 'omlaag',
  i5StilNaSluiten: 'omlaag',
  i8ActorSleutel: 'omlaag',
  i9EnterWith: 'omlaag',
  i11ZonderOorzaak: 'omlaag',
  i12AbonneeInVerzoek: 'omlaag',
  i10AuthZonderContext: 'omlaag',
  i13TweedeIdentiteit: 'omlaag',
  i14FrameAfwezig: 'omlaag',
  i14FrameOneens: 'omlaag'
};

/* ---------- I9: enterWith in server/ ---------- */
function telEnterWith(bron) {
  const { zonderCommentaar } = require('./lib/bron');
  return (zonderCommentaar(String(bron)).match(/\.enterWith\s*\(/g) || []).length;
}
function meetI9() {
  let n = 0; const waar = [];
  const loop = (map) => {
    for (const e of fs.readdirSync(map, { withFileTypes: true })) {
      const p = path.join(map, e.name);
      if (e.isDirectory()) { if (e.name !== 'data' && e.name !== 'node_modules') loop(p); continue; }
      if (!e.name.endsWith('.js')) continue;
      const k = telEnterWith(fs.readFileSync(p, 'utf8'));
      if (k) { n += k; waar.push(path.relative(WORTEL, p)); }
    }
  };
  loop(path.join(WORTEL, 'server'));
  return { enterWith: n, waar };
}

/* ---------- I5: schrijven na sluiten ----------
   Een schrijver na sluiten is:
     weigert  -- hij gaf false of gooide, en er veranderde niets
     meldt    -- hij deed het, en een zichtbare teller ging omhoog
     stil     -- hij zei "gelukt" (of niets) en niemand kan het zien
   `naAfloop` is de teller in server/opzet/handeling.js waar een context zo'n
   poging zichtbaar maakt; ontbreekt die, dan telt hij als nul. */
function klasse({ uitkomst, gooide, veranderd, gemeld }) {
  if (gooide || uitkomst === false) return veranderd ? (gemeld ? 'meldt' : 'stil') : 'weigert';
  return gemeld ? 'meldt' : 'stil';
}

function naAfloopTotaal(handeling) {
  if (typeof handeling.naAfloop !== 'function') return 0;
  const t = handeling.naAfloop() || {};
  return Object.values(t).reduce((n, v) => n + (Number(v) || 0), 0);
}

/* Een nagebootst verzoek met alle verzoekcontexten open, gesloten zoals de
   echte middleware dat doet (res 'finish'). Geeft een functie terug die werk
   in de context van dat -- inmiddels gesloten -- verzoek uitvoert. */
function geslotenVerzoek() {
  const handeling = S('opzet/handeling');
  const em = S('effectmeter'), haak = S('kern/kosten/haak'), aic = S('ai-context');
  const req = { id: 'i5-proef', path: '/i5', method: 'POST', ip: '127.0.0.1' };
  const res = new EventEmitter();
  let binnen = null, teller = null;
  em.perVerzoek((t) => {
    teller = t;
    handeling.middleware({ data: () => null, log: () => {} })(req, res, () => {
      aic.inContext({ ip: req.ip, req }, () => {
        haak.binnen(haak.drager('lid', 'i5-proef'), () => { binnen = AsyncResource.bind((fn) => fn()); });
      });
    });
  });
  res.emit('finish');
  return { binnen, teller, req };
}

function proef(handeling, doe) {
  const voor = naAfloopTotaal(handeling);
  let uitkomst, gooide = false, veranderd = false;
  try { const r = doe(); uitkomst = r.uitkomst; veranderd = !!r.veranderd; }
  catch (e) { gooide = true; }
  return klasse({ uitkomst, gooide, veranderd, gemeld: naAfloopTotaal(handeling) > voor });
}

async function meetI5() {
  const handeling = S('opzet/handeling');
  const em = S('effectmeter'), haak = S('kern/kosten/haak'), aic = S('ai-context');
  const vc = S('db/verzoekcontext');
  const uit = {};

  uit.handeling = proef(handeling, () => {
    const { binnen } = geslotenVerzoek();
    return binnen(() => {
      const h = handeling.huidige();
      const n = h ? h.gemeld.length : 0;
      const r = handeling.raakt('proef', 1);
      return { uitkomst: r, veranderd: !!h && h.gemeld.length > n };
    });
  });

  uit.effectmeter = proef(handeling, () => {
    const { binnen, teller } = geslotenVerzoek();
    const n = teller.opslag;
    const r = binnen(() => em.tel('opslag'));
    return { uitkomst: r, veranderd: teller.opslag > n };
  });

  uit['kosten/haak'] = proef(handeling, () => {
    const was = haak.meterStaat();
    if (was) throw new Error('er hangt al een meter aan de kostenhaak; deze proef zet er geen tweede naast');
    const geboekt = [];
    haak.zetMeter((m) => { geboekt.push(m); return true; });
    try {
      const { binnen } = geslotenVerzoek();
      const r = binnen(() => haak.meld('verzoek', 1));
      return { uitkomst: r, veranderd: geboekt.length > 0 };
    } finally { haak.zetMeter(null); }
  });

  uit['ai-context'] = proef(handeling, () => {
    const { binnen } = geslotenVerzoek();
    return binnen(() => {
      const n = aic.uitvoeringen().length;
      const r = aic.noteerUitvoering('proef', 'proef');
      return { uitkomst: r, veranderd: aic.uitvoeringen().length > n };
    });
  });

  uit.verzoekcontext = proef(handeling, () => {
    const ctx = vc.nieuw(null);
    return vc.voer(ctx, () => {
      vc.sluit(ctx);
      const r = vc.noteerSave();
      return { uitkomst: r, veranderd: !!ctx.opslaan };
    });
  });

  /* Het verzoekframe (opzet/verzoekframe.js): na sluiten nog identificeren. */
  uit.verzoekframe = proef(handeling, () => {
    const vf = S('opzet/verzoekframe');
    const req = { id: 'i5-frame', headers: {} }, res = new EventEmitter();
    let binnen = null;
    vf.middleware()(req, res, () => { binnen = AsyncResource.bind((fn) => fn()); });
    res.emit('finish');
    return binnen(() => {
      let r = false;
      try { r = vf.identificeer({ sleutel: 'i5-proef' }); } catch (e) { r = false; }
      return { uitkomst: r, veranderd: !!vf.huidig().actor };
    });
  });

  uit.bijeen = await (async () => {
    const voor = naAfloopTotaal(handeling);
    let na = null;
    const b = S('db/bijeen')({ save: () => {} });   // een gewone bundel; de duurzame weg doet hier niet mee
    await b.bijeen(async () => { na = AsyncResource.bind((fn) => fn()); });
    /* Na de bundel: een schrijver in dezelfde context vraagt of hij mag
       uitstellen. `false` betekent dat save() echt flusht -- geen stille vlag. */
    const r = na(() => b.inBundel());
    return klasse({ uitkomst: r, gooide: false, veranderd: false, gemeld: naAfloopTotaal(handeling) > voor });
  })();

  return uit;
}

/* De ijking van I5: zonder deze twee zegt de klasse-indeling niets. */
function ijkI5() {
  const stil = klasse({ uitkomst: true, gooide: false, veranderd: true, gemeld: false });
  const leeg = klasse({ uitkomst: undefined, gooide: false, veranderd: true, gemeld: false });
  const weigert = klasse({ uitkomst: false, gooide: false, veranderd: false, gemeld: false });
  const meldt = klasse({ uitkomst: true, gooide: false, veranderd: true, gemeld: true });
  return stil === 'stil' && leeg === 'stil' && weigert === 'weigert' && meldt === 'meldt';
}

/* ---------- I11: de oorzaak van een interne agent-aanroep ----------
   Een echte /api/member/doe op een leesroute: de buitenste correlatie (de
   X-Request-Id van het antwoord) moet als `oorzaak` terugkomen uit het frame van
   de binnenste aanroep. Een proef die niet slaagde is niet vast te stellen. */
const I11_PAD = '/api/kantoorpakket/mijn';
function meetI11(p) {
  if (!p || p.status !== 200 || !p.ok || !p.buiten) return null;
  return { proeven: 1, buiten: p.buiten, oorzaak: p.oorzaak || null, zonderOorzaak: p.oorzaak === p.buiten ? 0 : 1 };
}
function ijkI11() {
  const zonder = meetI11({ status: 200, ok: true, buiten: 'a1', oorzaak: null });
  const anders = meetI11({ status: 200, ok: true, buiten: 'a1', oorzaak: 'b2' });
  const goed = meetI11({ status: 200, ok: true, buiten: 'a1', oorzaak: 'a1' });
  return zonder.zonderOorzaak === 1 && anders.zonderOorzaak === 1 && goed.zonderOorzaak === 0
    && meetI11({ status: 403, ok: false }) === null;
}

/* ---------- I12: de bus-abonnee in de nulcontext ----------
   Een OPEN verzoek met frame, handeling, ai-context en kostendrager publiceert;
   de abonnee zegt welke van die vier hij ziet. Twee transporten: de echte
   in-procesbus en de Redis-bus op een makelaar in het geheugen die in de context
   van de PUBLICEERDER aflevert (het strengste geval; een echte socket levert in
   de context van de verbinding af). Per transport: het aantal lekkende winkels. */
function zieVerzoek() {
  const vf = S('opzet/verzoekframe'), handeling = S('opzet/handeling');
  const haak = S('kern/kosten/haak'), aic = S('ai-context');
  return ['frame', 'handeling', 'drager', 'ai'].filter((k, i) =>
    [!!vf.huidig(), !!handeling.huidige(), haak.wieNu() !== haak.HUIS, !!aic.huidig()][i]);
}
function openVerzoek(fn) {
  const vf = S('opzet/verzoekframe'), handeling = S('opzet/handeling');
  const haak = S('kern/kosten/haak'), aic = S('ai-context');
  const req = { id: 'i12-proef', path: '/i12', method: 'POST', ip: '127.0.0.1', headers: {} };
  const res = new EventEmitter();
  vf.middleware()(req, res, () => handeling.middleware({ data: () => null, log: () => {} })(req, res, () =>
    aic.inContext({ ip: req.ip, req }, () => haak.binnen(haak.drager('lid', 'i12-proef'), fn))));
  res.emit('finish');
}
async function meetI12() {
  const uit = {};
  const busPad = require.resolve(path.join(WORTEL, 'server', 'bus')), redisPad = require.resolve(path.join(WORTEL, 'server', 'redis'));
  const proef = (bus) => { let gezien = null;
    bus.subscribe('i12', () => { gezien = zieVerzoek(); });
    openVerzoek(() => bus.publishDirect('i12', { event: 'x', data: {}, envelop: { classificatie: 'intern' } }));
    return gezien; };
  const oudUrl = process.env.REDIS_URL, oudRedis = require.cache[redisPad], oudLog = console.log;
  try {
    delete process.env.REDIS_URL; delete require.cache[busPad];
    uit['in-proces'] = proef(require(busPad).maakBus());
    const makelaar = new EventEmitter();
    require.cache[redisPad] = { id: redisPad, filename: redisPad, loaded: true, exports: { createClient: () => {
      const c = new EventEmitter();
      c.connect = async () => { setImmediate(() => c.emit('ready')); };
      c.publish = (k, t) => { makelaar.emit(k, t); return Promise.resolve(1); };
      c.subscribe = async (k, fn) => { makelaar.on(k, fn); return 1; };
      return c; } } };
    process.env.REDIS_URL = 'redis://i12:6379'; delete require.cache[busPad];
    console.log = () => {};
    const bus = require(busPad).maakBus();
    await new Promise((r, n) => { const t = setTimeout(() => n(new Error('nepredis niet gereed')), 2000);
      bus.onStand(s => { if (s.gereed) { clearTimeout(t); r(); } }); });
    await new Promise(r => setImmediate(r));
    uit.redis = proef(bus);
  } finally {
    console.log = oudLog;
    if (oudUrl === undefined) delete process.env.REDIS_URL; else process.env.REDIS_URL = oudUrl;
    if (oudRedis) require.cache[redisPad] = oudRedis; else delete require.cache[redisPad];
    delete require.cache[busPad];
  }
  /* Een abonnee die niet afgeleverd kreeg, is niet vast te stellen -- geen nul. */
  for (const k of Object.keys(uit)) if (uit[k] === null) throw new Error('I12: de ' + k + '-abonnee kreeg niets');
  return { perTransport: uit, lekkend: Object.values(uit).filter(l => l.length).length };
}
/* De ijking van I12: een abonnee die IN het verzoek draait, moet als lek tellen. */
function ijkI12() {
  let gezien = null;
  openVerzoek(() => { gezien = zieVerzoek(); });
  return !!gezien && gezien.length === 4;
}

/* ---------- I2: wie maakt de correlatie ----------
   Drie proefverzoeken met een zelfgekozen X-Request-Id: twee keer hetzelfde
   korte id en een keer 4000 tekens. Een client-id wordt een SLEUTEL als hij als
   correlatie terugkomt (in het antwoord of in de handeling), en twee verzoeken
   met hetzelfde id die dezelfde correlatie krijgen zijn een botsing. Daarnaast:
   draagt `req.externeId` het id begrensd (kort: gelijk; lang: de eerste 64). */
const I2_KORT = 'I2-zelfgekozen.correlatie';
const I2_LANG = 'I2-' + 'x'.repeat(3997);
const I2_KOPPEN = [I2_KORT, I2_KORT, I2_LANG];
const I2_PAD = '/api/agenda/mijn-lijst';   // een leesroute achter de ledenpoort

function meetI2(proeven, binnen) {
  const geldig = (proeven || []).filter(p => p.status > 0);
  if (geldig.length < I2_KOPPEN.length) return null;          // niet vast te stellen
  const overgenomen = proeven.filter(p => p.antwoordId === p.kop || (p.antwoordId || '').length > 64).length
    + (binnen || []).filter(b => b.kopIsCorrelatie || b.handelingIsKop).length;
  const botsing = proeven[0].antwoordId && proeven[0].antwoordId === proeven[1].antwoordId ? 1 : 0;
  const verwacht = (n) => n === I2_KORT.length ? I2_KORT : I2_LANG.slice(0, 64);
  const b = binnen || [];
  const externFout = b.length >= I2_KOPPEN.length ? b.filter(x => x.extern !== verwacht(x.kopLengte)).length : null;
  return { proeven: proeven.length, serverZag: b.length, overgenomen, botsing, externFout,
    clientSleutel: overgenomen + botsing, antwoordLengtes: proeven.map(p => (p.antwoordId || '').length) };
}

/* De ijking van I2: de oude vorm (kop overgenomen) moet uitslaan, de nieuwe niet. */
function ijkI2() {
  const oud = meetI2(I2_KOPPEN.map(k => ({ kop: k, status: 200, antwoordId: k })),
    I2_KOPPEN.map(k => ({ kopLengte: k.length, kopIsCorrelatie: true, handelingIsKop: true, extern: '(ontbreekt)' })));
  const nieuw = meetI2(I2_KOPPEN.map((k, i) => ({ kop: k, status: 200, antwoordId: 'a1b2c3d4e5f6a7b' + i })),
    I2_KOPPEN.map(k => ({ kopLengte: k.length, kopIsCorrelatie: false, handelingIsKop: false, extern: k.slice(0, 64) })));
  return !!oud && oud.clientSleutel === 7 && oud.externFout === 3 && nieuw.clientSleutel === 0 && nieuw.externFout === 0
    && meetI2([], []) === null;
}

/* ---------- I1, I3, I4, I10: een echte server ---------- */
async function meetServer(max) {
  const { start } = require('./lib/wegwerpserver');
  const { haalSleutels } = require('./lib/proefsleutels');
  const { alleRoutes, verdeelOpRol } = require('./lib/routes');
  const { maakSessiewacht } = require('./lib/sessiewacht');
  const uitPad = path.join(os.tmpdir(), 'rtg-contextdoorgifte-' + process.pid + '.json');
  const server = await start({ naam: 'contextdoorgifte',
    nodeArgs: ['-r', path.join(__dirname, 'lib', 'contextdoorgifte-peil.js')],
    env: { RTG_DEMO: '1', RTG_MAGNAAT_TEST: '1', RTG_DEV_LINKS: '1', CONTEXTDOORGIFTE_UIT: uitPad } });
  const { basis, klaar } = server;
  const roep = async (methode, pad, tok, lijf) => {
    try {
      const r = await fetch(basis + pad, { method: methode, signal: AbortSignal.timeout(10000),
        headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
        ...(methode === 'GET' ? {} : { body: JSON.stringify(lijf || {}) }) });
      await r.arrayBuffer().catch(() => {});
      return r.status;
    } catch (e) { return 0; }
  };
  try {
    const bos = await haalSleutels({ post: async (p, l, t) => {
      const r = await fetch(basis + p, { method: 'POST', headers: { 'Content-Type': 'application/json',
        ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(l || {}) });
      let data = null; try { data = await r.json(); } catch (e) {}
      return { status: r.status, data };
    } });
    const rollen = ['member', 'supplier'].filter(r => bos.tokens[r]);
    if (rollen.length < 2) throw new Error('geen token voor lid en zaak -- dan meet deze ronde een wereld waar niemand binnenkomt');
    const statisch = alleRoutes().filter(r => r.pad.startsWith('/api/') && !/[:*]/.test(r.pad)
      && !r.pad.endsWith('/stream') && (r.methode === 'GET' || r.methode === 'POST'));
    let lijst = verdeelOpRol(statisch, rollen).metRol;
    if (max) lijst = lijst.slice(0, max);
    /* Een uitlogroute zit ertussen; een 401 telt pas als de sessie nog leeft
       (scripts/lib/sessiewacht.js). Anders meet de rest van de ronde niemand. */
    const tok = Object.fromEntries(rollen.map(r => [r, bos.tokenVoor(r)]));
    const methodeVan = new Map();
    const wacht = maakSessiewacht({ post: async (pad, lijf, t) => ({ status: await roep(methodeVan.get(pad), pad, t, lijf) }),
      rollen: Object.fromEntries(rollen.map(r => [r, {
        vers: async () => { try { return await bos.inlog[r](); } catch (e) { return null; } },
        zet: (t) => { tok[r] = t; } }])) });
    const statussen = {};
    let i = 0;
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (i < lijst.length) {
        const r = lijst[i++];
        methodeVan.set(r.pad, r.methode);
        const s = (await wacht.roep(r.pad, {}, r.rol, tok[r.rol])).status;
        statussen[s] = (statussen[s] || 0) + 1;
      }
    }));
    /* I2: de drie proefverzoeken, met een verse ledensessie. */
    const i2 = [];
    for (const kop of I2_KOPPEN) {
      try {
        const r = await fetch(basis + I2_PAD, { method: 'POST', signal: AbortSignal.timeout(10000), body: '{}',
          headers: { 'Content-Type': 'application/json', 'X-Request-Id': kop, Authorization: 'Bearer ' + tok.member } });
        await r.arrayBuffer().catch(() => {});
        i2.push({ kop, status: r.status, antwoordId: r.headers.get('x-request-id') });
      } catch (e) { i2.push({ kop, status: 0, antwoordId: null }); }
    }
    /* I11: een interne aanroep via het stuur van Rahul. */
    let i11 = null;
    try {
      const r = await fetch(basis + '/api/member/doe', { method: 'POST', signal: AbortSignal.timeout(20000),
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok.member },
        body: JSON.stringify({ pad: I11_PAD, body: {} }) });
      const b = await r.json().catch(() => ({}));
      i11 = { status: r.status, ok: !!b.ok, buiten: r.headers.get('x-request-id'), oorzaak: b.oorzaak || null };
    } catch (e) { i11 = { status: 0 }; }
    /* De spoeltimers staan op 1 en 5 seconden; daarna nog een schrijfronde van de peiling. */
    await new Promise(r => setTimeout(r, 8000));
    if (!fs.existsSync(uitPad)) throw new Error('de peiling in de server heeft niets weggeschreven (' + uitPad + ')');
    const R = JSON.parse(fs.readFileSync(uitPad, 'utf8'));   // atomair geschreven; onleesbaar is een fout
    return { R, i2, i11, verzoeken: lijst.length, statussen, rollen, hernieuwd: wacht.hernieuwd(),
      perMethode: lijst.reduce((m, r) => (m[r.methode] = (m[r.methode] || 0) + 1, m), {}) };
  } finally { klaar(); try { fs.rmSync(uitPad, { force: true }); } catch (e) {} }
}

/* Is de peiling in de server geijkt? Elke tak moet zijn bekend-foute geval zien. */
function ijkServer(R) {
  const j = R && R.ijk;
  const fout = [];
  if (!R || !R.ijkKlaar) fout.push('de ijking in de server is niet afgerond' + (R && R.ijkFout ? ': ' + R.ijkFout : ''));
  else {
    if (j.timers.gevuurdNaAfloop < 1 || j.timers.naAfloopMetDrager < 1) fout.push('I4 ziet een timer na afloop niet');
    if (j.envelop.metVerzoekCorrelatie < 1) fout.push('I1 ziet een envelop met verzoekcorrelatie niet');
    if (!(j.envelop.actorSleutel >= 1)) fout.push('I8 ziet een datasleutel op de bus niet');
    if (j.auth.n - j.auth.metHandeling < 1) fout.push('I10 ziet een auth-punt zonder handeling niet');
    if (j.auth.correlatieEens < 1) fout.push('I3 ziet een correlatie die klopt niet');
    if (!(j.auth.frameOneens >= 1)) fout.push('I14 ziet een frame dat het oneens is niet');
    if (!(j.auth.n - j.auth.metFrame >= 1)) fout.push('I14 ziet een auth-punt zonder frame niet');
    if (!R.frameIjk || R.frameIjk.tweedeIdentiteit < 1) fout.push('I13 ziet een tweede identiteit niet');
  }
  return fout;
}

const breuk = (a, b) => b ? Math.round((a / b) * 1000) / 1000 : null;

function samenvatting({ i5, i9, i12, server }) {
  const stilNaSluiten = Object.values(i5).filter(k => k === 'stil').length;
  const g = { i5: { perContext: i5, stilNaSluiten, contexten: Object.keys(i5).length }, i9 };
  if (i12) g.i12 = i12;
  if (server) {
    const m = server.R.meting;
    g.i1 = { binnenVerzoek: m.envelop.binnenVerzoek, metVerzoekCorrelatie: m.envelop.metVerzoekCorrelatie,
      metActor: m.envelop.metActor, actorSleutel: m.envelop.actorSleutel || 0, metSessie: m.envelop.metSessie, kanalen: m.envelop.kanalen,
      aandeelMetCorrelatie: breuk(m.envelop.metVerzoekCorrelatie, m.envelop.binnenVerzoek) };
    g.i2 = meetI2(server.i2, m.i2);
    g.i3 = { authPunten: m.auth.n, eens: m.auth.correlatieEens, oneens: m.auth.correlatieOneens };
    g.i11 = meetI11(server.i11);
    g.i4 = { gezetInVerzoek: m.timers.gezetInVerzoek, gevuurdNaAfloop: m.timers.gevuurdNaAfloop,
      naAfloopMetDrager: m.timers.naAfloopMetDrager, naAfloopMetAiSessie: m.timers.naAfloopMetAiSessie,
      plekken: m.timers.plekken, lekPlekken: Object.keys(m.timers.plekken).length };
    const ft = server.R.frameTellers || {}, fi = server.R.frameIjk || {};
    const na = (k) => (ft[k] || 0) - (fi[k] || 0);   // de ijking telt niet mee
    g.i13 = { geidentificeerd: na('geidentificeerd'), herkend: na('herkend'),
      tweedeIdentiteit: na('tweedeIdentiteit'), naSluiten: na('naSluiten') };
    g.i14 = { authPunten: m.auth.n, metFrame: m.auth.metFrame, eens: m.auth.frameEens,
      oneens: m.auth.frameOneens, waarom: m.auth.frameWaarom };
    g.i10 = { authPunten: m.auth.n, metHandeling: m.auth.metHandeling, metAiContext: m.auth.metAiContext,
      metEffectteller: m.auth.metEffectteller, post: m.auth.post, postMetAlleDrie: m.auth.postMetAlleDrie };
    g.noemer = { verzoeken: server.verzoeken, perMethode: server.perMethode, statussen: server.statussen,
      rollen: server.rollen, sessieHernieuwd: server.hernieuwd };
  }
  return { gemeten: g, tanden: tandenVan(g) };
}

/* De tanden uit een meting -- ook uit de vastgelegde, zodat de toets kan zien
   dat het register zelf niet onder zijn eigen ratel ligt. Een lege noemer geeft
   GEEN tand: niet vast te stellen is geen nul en geen honderd. */
function tandenVan(g) {
  const t = { i5StilNaSluiten: g.i5.stilNaSluiten, i9EnterWith: g.i9.enterWith };
  if (g.i12) t.i12AbonneeInVerzoek = g.i12.lekkend;
  if (g.i11) t.i11ZonderOorzaak = g.i11.zonderOorzaak;
  if (g.i1 && g.i1.binnenVerzoek) t.i1AandeelMetCorrelatie = g.i1.aandeelMetCorrelatie;
  if (g.i1 && g.i1.binnenVerzoek) t.i8ActorSleutel = g.i1.actorSleutel || 0;
  if (g.i2) t.i2ClientSleutel = g.i2.clientSleutel;
  if (g.i2 && g.i2.externFout !== null) t.i2ExternFout = g.i2.externFout;
  if (g.i3 && g.i3.authPunten) t.i3CorrelatieOneens = g.i3.oneens;
  if (g.i10 && g.i10.authPunten) {
    t.i10AuthZonderContext = g.i10.authPunten - Math.min(g.i10.metHandeling, g.i10.metAiContext, g.i10.metEffectteller);
  }
  if (g.i4) t.i4LekPlekken = g.i4.lekPlekken;
  if (g.i13 && g.i13.geidentificeerd) t.i13TweedeIdentiteit = g.i13.tweedeIdentiteit;
  if (g.i14 && g.i14.authPunten) { t.i14FrameAfwezig = g.i14.authPunten - g.i14.metFrame; t.i14FrameOneens = g.i14.oneens; }
  return t;
}

/* Mag `nu` de ratel passeren? Geeft per tand een bevinding, leeg = in orde. */
function vergelijk(ratel, tanden, deel) {
  const fout = [];
  for (const [k, richting] of Object.entries(RICHTING)) {
    if (!(k in (ratel || {}))) continue;
    if (!(k in tanden)) { if (!deel) fout.push(k + ': niet vast te stellen in deze ronde (lege noemer)'); continue; }
    const r = ratel[k], n = tanden[k];
    if (richting === 'omlaag' ? n > r : n < r) fout.push(k + ': ' + n + ' tegen ratel ' + r + ' (mag alleen ' + richting + ')');
  }
  return fout;
}

module.exports = { telEnterWith, meetI9, meetI5, ijkI5, meetI11, ijkI11, meetI12, ijkI12, meetI2, ijkI2, I2_KOPPEN, klasse, vergelijk, samenvatting, tandenVan, ijkServer, RICHTING, DOEL };

if (require.main === module) {
  (async () => {
    const argv = process.argv.slice(2);
    const statisch = argv.includes('--statisch');
    const vast = argv.includes('--vastleggen');
    const max = Number((argv.find(a => a.startsWith('--max=')) || '').slice(6)) || 0;
    if (!ijkI5()) { console.error('meterStuk: de indeling van I5 herkent een stille schrijver niet'); process.exit(2); }
    if (!ijkI2()) { console.error('meterStuk: I2 herkent een overgenomen client-id niet'); process.exit(2); }
    if (!ijkI11()) { console.error('meterStuk: I11 ziet een agent-aanroep zonder oorzaak niet'); process.exit(2); }
    if (!ijkI12()) { console.error('meterStuk: I12 ziet een abonnee in het verzoek niet'); process.exit(2); }
    const i9 = meetI9();
    const i5 = await meetI5();
    const i12 = await meetI12();
    let server = null;
    if (!statisch) {
      server = await meetServer(max);
      const fout = ijkServer(server.R);
      if (fout.length) { console.error('meterStuk: ' + fout.join('; ')); process.exit(2); }
    }
    const { gemeten, tanden } = samenvatting({ i5, i9, i12, server });
    /* Geen register is een eerste ronde; een ONLEESBAAR register is geen lege
       ratel (scripts/stillezing.js) -- dan stopt de meter in plaats van alles
       door te laten. */
    let oud = {};
    if (fs.existsSync(DOEL)) oud = JSON.parse(fs.readFileSync(DOEL, 'utf8'));
    const ratel = Object.assign({}, oud.ratel || {});
    const fout = vergelijk(ratel, tanden, statisch || !!max);
    for (const [k, v] of Object.entries(tanden)) console.log('  ' + k.padEnd(24) + ' ' + v + (k in ratel ? '   (ratel ' + ratel[k] + ', ' + RICHTING[k] + ')' : ''));
    console.log('  I5 per context: ' + Object.entries(i5).map(([k, v]) => k + '=' + v).join(', '));
    console.log('  I12 per transport: ' + Object.entries(i12.perTransport).map(([k, v]) => k + '=' + (v.join('+') || 'nul')).join(', '));
    if (gemeten.i4) for (const [p, n] of Object.entries(gemeten.i4.plekken)) console.log('  I4 lek ' + String(n).padStart(4) + '  ' + p);
    if (fout.length) { console.error('\n  ✗ ' + fout.join('\n  ✗ ')); process.exit(1); }
    if (statisch) return;          // een halve ronde schrijft het register niet
    if (max) { console.log('\n  --max: een deelronde schrijft het register niet'); return; }
    if (vast) for (const [k, v] of Object.entries(tanden)) ratel[k] = v;
    const { stempel } = require('./lib/stempel');
    const uit = {
      stempel: stempel(),
      uitleg: 'Loopt de identiteit van een verzoek door de zeven async-contexten waar hij hoort, en niet verder? Twaalf invarianten uit het Fase 2-onderzoek (RTG Request Frame), elk apart en zonder totaalcijfer. De ratel mag alleen de goede kant op; zie test/contextdoorgifte.test.js.',
      hoe: 'npm run contextdoorgifte',
      grens: 'Alleen statische leden- en zaakroutes die de rolkaart een rol geeft (vandaag allemaal POST, zie noemer.perMethode) met een leeg lijf, geen PostgreSQL- of Redis-stand, alleen timers via de globale timerfuncties. Een lege noemer is niet vast te stellen.',
      richting: RICHTING,
      ratel,
      gemeten
    };
    fs.writeFileSync(DOEL, JSON.stringify(uit, null, 1) + '\n');
    console.log('\n  CONTEXTDOORGIFTE.json geschreven' + (vast ? ' (ratel vastgelegd)' : ''));
  })().catch((e) => { console.error(e && e.stack || e); process.exit(3); });
}
