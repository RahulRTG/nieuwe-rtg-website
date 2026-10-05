/* ============================================================================
   HET VERZOEKFRAME -- van wie is dit werk, en in welke keten (Fase 2, RTG
   Request Frame; besluit B2a: een eigen dunne AsyncLocalStorage).

   WAAROM DIT ER IS. Zeven async-winkels zijn het binnen een verzoek eens
   (CONTEXTDOORGIFTE.json, I3); wat ontbrak is EEN plek die alleen IDENTITEIT
   draagt, met een eigen levenscyclus. Werkstaat (bundel, werkkopie, teller,
   AI-uitvoeringen, handelingsmeting) blijft in zijn eigen winkel.

   EEN LEZER, EN DIE BESLIST NIETS (PR 5): de bus-envelop (kern/envelop.js)
   leest via voorBus() correlatie, oorzaak, actor-codenaam en hoedanigheid, met
   late binding. Verder alleen de schrijvers (opzet/envelop.js, de kostenhaak,
   kern/dienstidentiteit.js) en de montage; test/verzoekframe.test.js zakt
   zodra er een lezer bij komt voordat dat een besluit IS.

   DE VAKKEN
     correlatie    van de server (lib/correlatie.js), nooit een kop
     extern        de X-Request-Id van de client, begrensd; alleen voor logs
     oorzaak       wat dit veroorzaakte (ouderframe, of Rahul via agentteken)
     soort         verzoek | dienst | webhook | overdracht
     actor         { sleutel, codenaam, deur, identiteit, agent } -- EEN keer;
                   `codenaam` alleen uit de sessie die de ledenpoort net keurde,
                   nooit de datasleutel en nooit een opzoeking per verzoek
     hoedanigheid  { naam: null, reden } -- de sessie draagt er geen; NOOIT uit
                   req.body
     drager        { drager, herkomst: sessie | lichaam | dienst | onbekend }
     stand         open -> geidentificeerd -> gesloten

   Na sluiten weigert het frame te schrijven -- nooit een stille "gelukt" (I5).
   Achtergrondwerk erft niet stil: achtergrond() en overdraag() maken een NIEUW
   frame in de nulcontext, met de oorzaak erin.
   ========================================================================== */
'use strict';
const { AsyncLocalStorage } = require('async_hooks');
const correlatie = require('../lib/correlatie');
const envelop = require('../kern/envelop');
const haak = require('../kern/kosten/haak');
const { oorzaakVan } = require('../kern/agentteken');
const { losVanVerzoek } = require('../lib/losvanverzoek');

const winkel = new AsyncLocalStorage();
const SOORTEN = Object.freeze(['verzoek', 'dienst', 'webhook', 'overdracht']);
const GEEN_HOEDANIGHEID = Object.freeze({ naam: null, sinds: null,
  reden: 'de sessie draagt geen hoedanigheid; alleen een aan de sessiesleutel getoetste machtiging kan er een geven' });
const tellers = { geopend: 0, geidentificeerd: 0, herkend: 0, tweedeIdentiteit: 0, naSluiten: 0, overgedragen: 0,
  codenaamGeweigerd: 0 };
const vanReq = new WeakMap();

function nieuw({ soort, correlatie: c, extern, oorzaak } = {}) {
  tellers.geopend++;
  return { correlatie: c || correlatie.nieuw(), extern: extern || null, oorzaak: oorzaak || null,
    soort: SOORTEN.includes(soort) ? soort : 'verzoek', actor: null, hoedanigheid: GEEN_HOEDANIGHEID,
    drager: null, stand: 'open' };
}

const fout = (code, tekst) => Object.assign(new Error(tekst), { code });

function open(opties, fn) { return winkel.run(nieuw(opties), fn); }

/* De HTTP-ingang, direct na het logboek: daar is req.id gezet. */
function middleware() {
  return function verzoekframeMiddleware(req, res, next) {
    /* I11: de oorzaak alleen uit het procesgeheim van agentteken (Rahul die
       intern aanroept), en dan zegt het antwoord hem terug aan die aanroeper. */
    const f = nieuw({ soort: 'verzoek', correlatie: req.id, extern: req.externeId, oorzaak: oorzaakVan(req) });
    if (f.oorzaak && typeof res.setHeader === 'function') res.setHeader('X-RTG-Oorzaak', f.oorzaak);
    vanReq.set(req, f);
    const dicht = () => sluit(f);
    res.on('finish', dicht); res.on('close', dicht);
    return winkel.run(f, next);
  };
}

/* De body-lezer kan de keten breken; zelfde vorm als handeling.hervat(). */
function hervat() {
  return function verzoekframeHervat(req, res, next) {
    const f = vanReq.get(req);
    if (!f || winkel.getStore() === f) return next();
    return winkel.run(f, next);
  };
}

function schrijfbaar(f, wat) {
  if (f.stand === 'gesloten') { tellers.naSluiten++; throw fout('FRAME_GESLOTEN', 'het verzoekframe is gesloten; ' + wat + ' kan niet meer'); }
}

/* WIE HANDELT -- een keer per frame (I13). Een tweede aanroep is een fout. */
function identificeer(actor) {
  const f = winkel.getStore();
  if (!f) return null;
  schrijfbaar(f, 'identificeren');
  if (f.actor) { tellers.tweedeIdentiteit++; throw fout('FRAME_AL_GEIDENTIFICEERD', 'dit frame is al geidentificeerd'); }
  const a = actor || {};
  f.actor = Object.freeze({ sleutel: a.sleutel || null, codenaam: codenaamVan(a.codenaam, a.sleutel), deur: a.deur || null,
    identiteit: a.identiteit || 'onbekend', agent: a.agent || null });
  f.stand = 'geidentificeerd';
  tellers.geidentificeerd++;
  return f.actor;
}

/* Een codenaam gaat op de bus, dus de zeef van de envelop keurt hem hier, EEN
   keer. Een datasleutel (gelijk aan de sleutel, of user-<n>) is geen codenaam. */
function codenaamVan(c, sleutel) {
  if (c == null || c === sleutel || /^user-\d+$/.test(String(c))) return null;
  try { return envelop.keurActor(String(c)); } catch (e) { tellers.codenaamGeweigerd++; return null; }
}

/* De brug vanuit opzet/envelop.zet(), de ENIGE schrijver van de actor. Gooit
   nooit (de envelop gooit nooit), maar zwijgt ook niet: elke weigering telt.

   WAAR DE CODE AFWIJKT VAN HET ONTWERP. Het ontwerp zegt "een tweede keer =
   fout", en dat geldt voor identificeer(). Maar boardroomAuth roept officeAuth
   aan en zet daarna BEWUST een tweede envelop: dezelfde mens, scherper bekeken
   (gezag erbij, kantoor wordt eigenaar). Dat is geen tweede identiteit maar
   dezelfde, herkend. Dus: dezelfde sleutel telt als `herkend` en verandert
   niets; een ANDERE sleutel is de fout waar I13 over gaat. */
function uitEnvelop(env, req) {
  try {
    const f = winkel.getStore();
    if (!f) return;
    const a = (env && env.actor) || {};
    if (f.actor && f.stand !== 'gesloten' && f.actor.sleutel && f.actor.sleutel === (a.id || null)) { tellers.herkend++; return; }
    /* De codenaam alleen van DEZE sessie: de ledenpoort zette req.session vlak
       voor zet(), en de sleutel moet dezelfde zijn. Nooit uit req.body. */
    const s = req && req.session, acc = s && s.account;
    const codenaam = a.soort === 'lid' && acc && s.key && s.key === a.id ? acc.codename : null;
    identificeer({ sleutel: a.id, codenaam, deur: a.soort, identiteit: a.identiteit, agent: a.agent });
  } catch (e) { /* geteld in identificeer/schrijfbaar */ }
}

/* De kostendrager, gezet door de kostenhaak (late binding hieronder). */
const HERKOMST = ['sessie', 'lichaam', 'dienst'];
function zetDrager(d, herkomst) {
  const f = winkel.getStore();
  if (!f) return null;
  schrijfbaar(f, 'een drager zetten');
  if (f.drager) return f.drager;   // de buitenste poort wint; een geneste binnen() is geen nieuwe eigenaar
  f.drager = Object.freeze({ drager: d || 'huis', herkomst: HERKOMST.includes(herkomst) ? herkomst : 'onbekend' });
  return f.drager;
}
haak.zetWaarnemer((d, herkomst) => { try { zetDrager(d, herkomst); } catch (e) {} });

function sluit(f) { if (f && f.stand !== 'gesloten') f.stand = 'gesloten'; }

/* ACHTERGRONDWERK (B6a): in de nulcontext -- geen handeling, AI-sessie of
   kostendrager van wie het startte -- met een NIEUW frame. De oorzaak is het
   open werk dat het startte (een gesloten verzoek is geen oorzaak meer, I4).
   Actor en drager alleen als de opener ze geeft; de drager gaat via de
   kostenhaak, zodat frame en kostenlaag dezelfde eigenaar zien. */
function achtergrond(soort, { actor, drager, herkomst } = {}, fn) {
  const ouder = winkel.getStore();
  const oorzaak = ouder && ouder.stand !== 'gesloten' ? ouder.correlatie : null;
  return losVanVerzoek(() => winkel.run(nieuw({ soort, oorzaak }), () => {
    if (actor) identificeer(actor);
    return drager ? haak.binnen(drager, fn, null, herkomst) : fn();
  }));
}
/* Werk dat bij DIT werk hoort. */
function overdraag(fn, opties) { tellers.overgedragen++; return achtergrond('overdracht', opties, fn); }

/* Wat de bus-envelop uit het frame leest -- en niets meer. Een gesloten frame
   levert niets: werk na afloop erft geen verzoekidentiteit (I4). De oorzaak is
   het werk dat dit frame veroorzaakte, en anders het verzoek zelf. */
function voorBus() {
  const f = winkel.getStore();
  if (!f || f.stand === 'gesloten') return null;
  const h = f.hoedanigheid;
  return { correlatie: f.correlatie, oorzaak: f.oorzaak || f.correlatie, actor: f.actor ? f.actor.codenaam : null,
    hoedanigheid: h && h.naam ? { naam: h.naam, grond: h.grond || null } : null };
}
envelop.zetFrameBron(voorBus);

/* Een bevroren afdruk voor de meter en de toetsen. Geen lezer in server/. */
function huidig() {
  const f = winkel.getStore();
  return f ? Object.freeze(Object.assign({}, f)) : null;
}

module.exports = { middleware, hervat, open, identificeer, uitEnvelop, zetDrager, sluit, overdraag, achtergrond,
  huidig, voorBus, tellers: () => Object.assign({}, tellers), SOORTEN };
