/* DE EVENTENVELOP: de taal waarin dit huis over gebeurtenissen praat.

   WAAROM DIT BESTAAT. OS.md par. 3: *de bus vervoert, er is geen taal.* Van de
   zeven plekken die zelf een bericht samenstelden (scripts/envelop.js) droeg er
   een een `versie`, een een `id`, en geen enkele iets waarmee je twee
   gebeurtenissen aan elkaar knoopt.

   NEGEN VELDEN, EN GEEN TIENDE. De envelop is met opzet gesloten: hij zegt
   WIE, IN WELKE ROL, WANNEER, WAARDOOR en HOE GEVOELIG, en nooit WAT. Zodra er
   inhoud in een envelop mag, wordt hij binnen een jaar een tweede berichtformaat.

     id             deze gebeurtenis, een keer
     at             wanneer, in ISO
     versie         het formaat van deze envelop (2; een lezer kent 1 en 2)
     kanaal         waarover hij ging
     actor          WIE het veroorzaakte -- een codenaam, nooit een echte naam
     correlatie     de hele keten waar dit bij hoort
     oorzaak        de gebeurtenis die deze direct veroorzaakte
     classificatie  hoe gevoelig de inhoud is (gesloten lijst)
     hoedanigheid   IN WELKE ROL de actor handelde: { naam, grond } (v2)

   HET NEGENDE VELD (besluit B3b, 5 oktober 2026). Een naam en een grond
   (`sessie` of `machtiging:<id>`), en NOOIT de bevoegdheden, het plafond of
   `wat` -- die blijven van kern/vertegenwoordiging/. De envelop zegt "in welke
   rol", niet "mocht dat". Hij komt uit het verzoekframe en nooit uit een
   opgave van de publicerende plek (de bus geeft alleen actor en classificatie
   door), en zolang het frame er geen kent staat er `onbekend` -- nooit stil een
   waarde. De uitrol is LEZERS EERST: hoedanigheidVan() leest een v1-envelop
   (van een proces dat nog niet bij is) als `onbekend`, en een versie die deze
   code niet kent ook, want een veld uit een toekomstig formaat raden is erger
   dan het niet weten.

   DE ACTOR IS EEN CODENAAM. Dat is geen stijlafspraak maar de kern van de
   privacyopzet van dit huis: klantdata draait op codenamen en echte namen wonen
   in de gescheiden identiteitskluis. Een envelop die over de bus gaat -- en met
   REDIS_URL dus over een netwerk en door een geheugendatabase -- is precies de
   plek waar een echte naam ongemerkt naar buiten lekt. maak() weigert daarom
   een actor die eruitziet als een contactgegeven. Dat is een grove zeef en geen
   garantie; hij vangt de fout die iemand per ongeluk maakt (`req.body.email`
   doorgeven), niet iemand die het expres wil.

   ONBEKEND IS EEN UITSLAG. Wie niets over de gevoeligheid (of de rol) zegt,
   krijgt `onbekend` en niet `openbaar`: een leeg vakje krijgt nooit de
   geruststellende waarde. scripts/envelop.js telt hoeveel er zo de bus over gaan.

   DE KETEN LOOPT VANZELF DOOR. Wie binnen de afhandeling van een gebeurtenis
   opnieuw publiceert, krijgt via AsyncLocalStorage dezelfde `correlatie` en als
   `oorzaak` de gebeurtenis die hij afhandelt. Met de hand doorgeven is binnen
   een maand op de helft van de plekken vergeten. */
'use strict';
const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');
const trustContext = require('./bewijsvlak/context');
/* De tijd van de huisklok (RTG_KLOK) en niet van het OS: anders is geen
   tijdproef over de bus te doen (scripts/klok.js telde dit als schuld). */
const { datum } = require('../lib/klok');

const VERSIE = 2;
/* Wat een LEZER aankan. Een v2-proces leest ook v1 (rollende uitrol over Redis). */
const GELEZEN = Object.freeze([1, 2]);

/* De gesloten lijst. Een zesde gevoeligheid komt HIER bij en nergens anders --
   een vrij tekstveld levert "gevoelig-ish" op, en dat is niet te tellen. */
const CLASSIFICATIES = {
  openbaar: 'mag iedereen zien',
  intern: 'binnen RTG, niet naar buiten',
  persoonsgegeven: 'gaat over een herleidbaar mens -- een codenaam telt mee',
  bijzonder: 'gezondheid, geloof, biometrie; AVG artikel 9',
  onbekend: 'niemand heeft het gezegd, en dat is geen synoniem voor openbaar'
};

const keten = new AsyncLocalStorage();

/* Een contactgegeven verkleed als actor. `@` vangt het e-mailadres, de lange
   cijferreeks een telefoonnummer of een BSN. Bewust geen naamdetectie: een
   codenaam mag "Reiziger Zeven" heten, en een zeef die daarop aanslaat wordt
   binnen een week uitgezet. */
const CONTACTGEGEVEN = /@|\+?\d[\d\s.-]{7,}/;

const nieuwId = () => (crypto.randomUUID ? crypto.randomUUID()
  : crypto.randomBytes(16).toString('hex'));

/* De actor nakijken. Gooit, want een echte naam op de bus is geen randgeval dat
   je afrondt maar een fout die in een toets hoort te zakken. De bus vangt hem
   op en laat de gebeurtenis dan ZONDER actor door (met een waarschuwing), want
   een realtime-melding mag geen verzoek omgooien. */
function keurActor(actor) {
  if (actor == null) return null;
  if (typeof actor !== 'string') throw new TypeError('envelop: actor is een codenaam (tekst), geen ' + typeof actor);
  const a = actor.trim();
  if (!a) return null;
  if (a.length > 64) throw new Error('envelop: actor is te lang voor een codenaam (' + a.length + ')');
  if (CONTACTGEGEVEN.test(a)) throw new Error('envelop: actor lijkt een contactgegeven; op de bus hoort een codenaam');
  return a;
}

/* DE HOEDANIGHEID. `onbekend` is een uitslag (zie hierboven) en geen gat. De naam
   is een woord uit een gesloten lijst (kern/vertegenwoordiging/ en de
   deursoorten); hier wordt alleen de VORM gekeurd, want deze laag kent geen
   domein. Alles behalve naam en grond valt er structureel af. */
const ONBEKEND = Object.freeze({ naam: 'onbekend', grond: null });
const NAAM = /^[a-z][a-z0-9-]{0,39}$/;
const GROND = /^(sessie|machtiging:[A-Za-z0-9_-]{1,64})$/;
function keurHoedanigheid(h) {
  if (h == null || (typeof h === 'object' && (h.naam == null || h.naam === 'onbekend'))) return ONBEKEND;
  if (typeof h !== 'object' || Array.isArray(h)) throw new TypeError('envelop: hoedanigheid is { naam, grond }, geen ' + typeof h);
  if (!NAAM.test(String(h.naam))) throw new Error('envelop: hoedanigheid is een naam uit een gesloten lijst, geen vrije tekst');
  const grond = h.grond == null ? null : String(h.grond);
  if (grond !== null && !GROND.test(grond)) throw new Error('envelop: de grond van een hoedanigheid is sessie of machtiging:<id>');
  return Object.freeze({ naam: String(h.naam), grond });
}
const versieBekend = (env) => !!env && GELEZEN.includes(env.versie);
/* DE LEZER. v1, een onbekende versie, een ontbrekend of onleesbaar veld: onbekend. */
function hoedanigheidVan(env) {
  if (!versieBekend(env) || env.versie < 2) return ONBEKEND;
  try { return keurHoedanigheid(env.hoedanigheid); } catch (e) { return ONBEKEND; }
}

/* HET VERZOEKFRAME ALS BRON (Fase 2, PR 5). Binnen een verzoek is er geen ouder
   in de keten, en dan droeg een envelop vroeger geen correlatie en geen actor
   (0 van 68 gemeten, CONTEXTDOORGIFTE.json I1). Late binding, zoals de meter in
   kern/kosten/haak.js: deze laag kent opzet/ niet, opzet/verzoekframe.js hangt
   zich hier zelf in. De bron levert { correlatie, oorzaak, actor, hoedanigheid }
   of null (geen frame, of een gesloten). Een ouder in de keten gaat altijd voor. */
let frameBron = null;
function zetFrameBron(fn) { frameBron = typeof fn === 'function' ? fn : null; }
function frameNu() { try { return frameBron ? frameBron() || null : null; } catch (e) { return null; } }

/* De envelop van de gebeurtenis die op DIT moment wordt afgehandeld. */
const huidige = () => keten.getStore() || null;

/* Een envelop maken. Alles is optioneel behalve het kanaal: wat er niet gezegd
   is, wordt niet verzonnen. */
function maak(opgave) {
  const o = opgave || {};
  const ouder = huidige();
  const trust = trustContext.huidige();
  const fr = ouder ? null : frameNu();
  const classificatie = CLASSIFICATIES[o.classificatie] ? o.classificatie : 'onbekend';
  return Object.freeze({
    id: o.id || nieuwId(),
    at: o.at || datum().toISOString(),
    versie: VERSIE,
    kanaal: o.kanaal || null,
    actor: keurActor(o.actor != null ? o.actor : (ouder ? ouder.actor : (fr ? fr.actor : null))),
    /* De keten: eerst de ouder, anders het verzoekframe. Is er een frame, dan
       beslist ALLEEN het frame, ook als het gesloten is (dan leeg): de
       Trust & Evidence-keten is binnen een verzoek een lezer van datzelfde frame
       (besluit van 6 oktober 2026) en geen tweede bron. Alleen waar geen frame
       is -- een expliciet geopende servicehop -- telt die keten; zonder een van
       beide is deze gebeurtenis zelf het begin. */
    correlatie: o.correlatie || (ouder ? ouder.correlatie : (fr ? fr.correlatie : (trust ? trust.chainId : null))) || null,
    oorzaak: o.oorzaak || (ouder ? ouder.id : (fr ? fr.oorzaak : (trust ? trust.stepId : null))) || null,
    classificatie,
    hoedanigheid: o.hoedanigheid != null ? keurHoedanigheid(o.hoedanigheid)
      : (ouder ? hoedanigheidVan(ouder) : keurHoedanigheid(fr ? fr.hoedanigheid : null))
  });
}

/* Alles wat binnen fn gebeurt, hoort bij deze envelop. */
const tellers = { onbekendeVersie: 0 };
function inKeten(envelop, fn) {
  if (!envelop) return fn();
  /* Een versie die deze code niet kent: de levering gaat voor, maar niet stil. */
  if (!versieBekend(envelop)) tellers.onbekendeVersie++;
  return keten.run(envelop, () => trustContext.inContext(trustContext.uitEvent(envelop), fn));
}

/* De correlatie invullen als hij nog leeg is: de eerste gebeurtenis van een
   keten IS zijn eigen correlatie. Apart gehouden van maak(), omdat maak() geen
   idee heeft of hij de eerste is -- dat weet alleen wie hem verstuurt. */
function alsStart(envelop) {
  if (!envelop || envelop.correlatie) return envelop;
  return Object.freeze(Object.assign({}, envelop, { correlatie: envelop.id }));
}

module.exports = { VERSIE, GELEZEN, CLASSIFICATIES, ONBEKEND, maak, huidige, inKeten, alsStart, keurActor,
  keurHoedanigheid, hoedanigheidVan, versieBekend, zetFrameBron, tellers: () => Object.assign({}, tellers) };
