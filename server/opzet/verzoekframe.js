/* ============================================================================
   HET VERZOEKFRAME -- van wie is dit werk, en in welke keten (Fase 2, RTG
   Request Frame; besluit B2a: een eigen dunne AsyncLocalStorage).

   WAAROM DIT ER IS. Dit huis heeft zeven async-winkels en ze zijn het binnen een
   verzoek eens (CONTEXTDOORGIFTE.json, I3). Wat er ontbrak is EEN plek die
   alleen IDENTITEIT draagt, met een eigen levenscyclus: wie handelt, op wiens
   rekening, met welke correlatie en waardoor veroorzaakt. Werkstaat (bundel,
   werkkopie, effectteller, AI-uitvoeringen, handelingsmeting) blijft in zijn
   eigen winkel; daar hoort het frame met opzet NIET bij.

   IN DE SCHADUW. Het frame wordt geopend en gevuld, maar NIEMAND beslist er nog
   op: er is geen lezer in server/ buiten de twee schrijvers (opzet/envelop.js
   voor de actor, de kostenhaak voor de drager) en de montage. De meter
   (scripts/contextdoorgifte.js, I13 en I14) houdt het naast de bestaande
   contexten; test/verzoekframe.test.js zakt zodra iemand er een besluit op
   neemt voordat dat een besluit IS.

   DE VAKKEN
     correlatie    van de server (lib/correlatie.js), nooit een kop
     extern        de X-Request-Id van de client, begrensd; alleen voor logs
     oorzaak       de correlatie van het werk dat dit veroorzaakte, of null
     soort         verzoek | dienst | webhook | overdracht
     actor         { sleutel, codenaam, deur, identiteit, agent } -- EEN keer,
                   via identificeer(); `codenaam` blijft null tot er een lezer
                   is (een opzoeking in de kluis per verzoek zonder lezer kost
                   iets en levert niets)
     hoedanigheid  { naam: null, reden } -- de sessie draagt er geen. NOOIT uit
                   req.body: identificeer() neemt alleen de envelop, en die zet
                   een poortwachter uit de sessie
     drager        { drager, herkomst } -- de kostendrager, met waar hij
                   vandaan kwam ('sessie' of 'lichaam'); zonder opgave
                   'onbekend', nooit geraden
     stand         open -> geidentificeerd -> gesloten

   DE LEVENSCYCLUS IS EXPLICIET. open (middleware of open()), identificeer, sluit
   (res finish/close). Na sluiten weigert het frame te schrijven: wie dan nog
   identificeert of een drager zet krijgt een fout, en via de envelop een
   zichtbare teller -- nooit een stille "gelukt" (I5). Achtergrondwerk erft niet
   stil: overdraag() maakt een NIEUW frame met de oorzaak erin.
   ========================================================================== */
'use strict';
const { AsyncLocalStorage } = require('async_hooks');
const correlatie = require('../lib/correlatie');

const winkel = new AsyncLocalStorage();
const SOORTEN = Object.freeze(['verzoek', 'dienst', 'webhook', 'overdracht']);
const GEEN_HOEDANIGHEID = Object.freeze({ naam: null, sinds: null,
  reden: 'de sessie draagt geen hoedanigheid; alleen een aan de sessiesleutel getoetste machtiging kan er een geven' });
const tellers = { geopend: 0, geidentificeerd: 0, herkend: 0, tweedeIdentiteit: 0, naSluiten: 0, overgedragen: 0 };
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
    const f = nieuw({ soort: 'verzoek', correlatie: req.id, extern: req.externeId });
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
  f.actor = Object.freeze({ sleutel: a.sleutel || null, codenaam: null, deur: a.deur || null,
    identiteit: a.identiteit || 'onbekend', agent: a.agent || null });
  f.stand = 'geidentificeerd';
  tellers.geidentificeerd++;
  return f.actor;
}

/* De brug vanuit opzet/envelop.zet(), de ENIGE schrijver van de actor. Gooit
   nooit (de envelop gooit nooit), maar zwijgt ook niet: elke weigering telt.

   WAAR DE CODE AFWIJKT VAN HET ONTWERP. Het ontwerp zegt "een tweede keer =
   fout", en dat geldt voor identificeer(). Maar boardroomAuth roept officeAuth
   aan en zet daarna BEWUST een tweede envelop: dezelfde mens, scherper bekeken
   (gezag erbij, kantoor wordt eigenaar). Dat is geen tweede identiteit maar
   dezelfde, herkend. Dus: dezelfde sleutel telt als `herkend` en verandert
   niets; een ANDERE sleutel is de fout waar I13 over gaat. */
function uitEnvelop(env) {
  try {
    const f = winkel.getStore();
    if (!f) return;
    const a = (env && env.actor) || {};
    if (f.actor && f.stand !== 'gesloten' && f.actor.sleutel && f.actor.sleutel === (a.id || null)) { tellers.herkend++; return; }
    identificeer({ sleutel: a.id, deur: a.soort, identiteit: a.identiteit, agent: a.agent });
  } catch (e) { /* geteld in identificeer/schrijfbaar */ }
}

/* De kostendrager, gezet door de kostenhaak (late binding hieronder). */
function zetDrager(d, herkomst) {
  const f = winkel.getStore();
  if (!f) return null;
  schrijfbaar(f, 'een drager zetten');
  if (f.drager) return f.drager;   // de buitenste poort wint; een geneste binnen() is geen nieuwe eigenaar
  f.drager = Object.freeze({ drager: d || 'huis', herkomst: herkomst === 'sessie' || herkomst === 'lichaam' ? herkomst : 'onbekend' });
  return f.drager;
}
require('../kern/kosten/haak').zetWaarnemer((d, herkomst) => { try { zetDrager(d, herkomst); } catch (e) {} });

function sluit(f) { if (f && f.stand !== 'gesloten') f.stand = 'gesloten'; }

/* Achtergrondwerk dat bij dit werk hoort: een NIEUW frame, eigen correlatie,
   de huidige als oorzaak. Actor en drager alleen als de aanroeper ze geeft. */
function overdraag(fn, { actor, drager, herkomst } = {}) {
  const ouder = winkel.getStore();
  const f = nieuw({ soort: 'overdracht', oorzaak: ouder ? ouder.correlatie : null });
  tellers.overgedragen++;
  return winkel.run(f, () => {
    if (actor) identificeer(actor);
    if (drager) zetDrager(drager, herkomst);
    return fn();
  });
}

/* Een bevroren afdruk voor de meter en de toetsen. Geen lezer in server/. */
function huidig() {
  const f = winkel.getStore();
  return f ? Object.freeze(Object.assign({}, f)) : null;
}

module.exports = { middleware, hervat, open, identificeer, uitEnvelop, zetDrager, sluit, overdraag,
  huidig, tellers: () => Object.assign({}, tellers), SOORTEN };
