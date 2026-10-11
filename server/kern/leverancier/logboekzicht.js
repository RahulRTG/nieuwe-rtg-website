/* WAT EEN ACTOR UIT HET ZAAKLOGBOEK EN HET KLOKBOEK MAG ONTVANGEN.

   Bestaande grens, eigenaarsbesluit 11 oktober 2026: wie er AANWEZIG is mag
   iedereen in de zaak zien; WANNEER een collega in- of uitklokte alleen een
   manager. En informatie die iemand niet mag ontvangen, verstrekt de server
   hem niet -- verbergen op het scherm is geen grens. Deze module is de ENE plek
   waar dat voor het logboek (db.data.supplierActivity) en de klokregels van
   vandaag wordt beslist; elke route die die bakken uitlevert gaat hierlangs, en
   er komt geen eigen kopie van de regel per route.

   Drie dingen die niet mogen sneuvelen:
   - de lijst klokSOORTEN is GESLOTEN en verklaard: elke soort noemt wie hem
     schrijft. noteerActiviteit() (opzet/leverancierpoort.js) weigert een soort
     die hier niet staat, zodat een nieuwe klokschrijver niet stil buiten de
     filter valt;
   - regels van VOOR het soortveld dragen geen soort. Die worden herkend aan hun
     vaste tekst (OUDE_KLOKTEKST); de herkenning draait ook naast het soortveld,
     dus een regel is een klokregel als EEN van beide het zegt;
   - er wordt gefilterd VOOR het afkappen, en `totaal` telt alleen wat de actor
     mag zien. Anders krijgt een medewerker 40-minus-klokregels terug en leest
     hij het verschil af aan de lengte of de teller. Een regel draagt geen id of
     volgnummer (who, text, at, soort), dus er zijn geen gaten om te lezen.

   Een niet-manager krijgt GEEN klokregels, ook niet zijn eigen: het logboek
   koppelt een regel aan een NAAM, en twee collega's met dezelfde naam zouden
   elkaars tijden krijgen. Zijn eigen uren staan in klokVan (routes/staff). */
'use strict';

const KLOKSOORTEN = Object.freeze({
  'klok-in': 'een medewerker klokte in (routes/staff/dienst-klok.js; kern/beveiliging/pda/patrouille.js, op een post)',
  'klok-uit': 'een medewerker klokte uit (routes/staff/dienst-klok.js)',
  'klok-correctie': 'een manager boekte uren bij voor een collega (routes/staff/collega.js)'
});

// de vaste teksten van de klokschrijvers van voor het soortveld
const OUDE_KLOKTEKST = Object.freeze([/^klokte (?:in|uit)(?: op |$)/, /^boekte een klokcorrectie voor /]);

const isKlokSoort = (soort) => Object.prototype.hasOwnProperty.call(KLOKSOORTEN, soort);

function isKlokregel(regel) {
  // een regel waarvan de vorm onbekend is, kan niets bewijzen: niet uitleveren
  if (!regel || typeof regel !== 'object') return true;
  if (regel.soort != null && isKlokSoort(regel.soort)) return true;
  const tekst = String(regel.text || '');
  return OUDE_KLOKTEKST.some((re) => re.test(tekst));
}

// alleen een manager; zonder actor is er niemand om het aan te geven
const magKlokZien = (actor) => !!(actor && actor.manager === true);

/* Het logboek voor deze actor: de nieuwste `max` regels die hij mag ontvangen,
   en hoeveel dat er in totaal zijn. */
function logboekVoor(lijst, actor, max) {
  const alle = Array.isArray(lijst) ? lijst : [];
  const zicht = magKlokZien(actor) ? alle : alle.filter((r) => !isKlokregel(r));
  const n = Number.isFinite(max) && max >= 0 ? max : 40;
  return { regels: zicht.slice(0, n), totaal: zicht.length };
}

/* De klokregels van vandaag: een manager alles, een ander alleen zijn eigen
   (op staffId en nooit op naam). Wie er binnen is, rekent de aanroeper over het
   HELE boek uit -- dat mag iedereen zien. */
function klokVandaagVoor(entries, actor) {
  const alle = Array.isArray(entries) ? entries : [];
  if (magKlokZien(actor)) return alle;
  if (!actor || actor.staffId == null) return [];
  return alle.filter((e) => e && String(e.staffId) === String(actor.staffId));
}

/* Een rij die de in- en uitkloktijd van een mens draagt onder eigen velden
   (de dienst van een bewaker: inklokAt, uitklokAt). Een manager en de mens zelf
   houden de tijden; een collega krijgt dezelfde rij zonder die velden -- de
   stand (ingeklokt, afgerond) blijft, want wie er is mag iedereen zien. */
function kloktijdenVoor(rij, actor, eigenaarId, velden) {
  if (!rij || typeof rij !== 'object') return rij;
  if (magKlokZien(actor)) return rij;
  if (actor && actor.staffId != null && eigenaarId != null && String(actor.staffId) === String(eigenaarId)) return rij;
  const uit = Object.assign({}, rij);
  for (const v of velden) delete uit[v];
  return uit;
}

/* De twee delen van /api/supplier/state (kern/leverancier/state.js) die hier
   over gaan: wie er binnen is (voor iedereen) met de klokregels van vandaag, en
   de nieuwste 40 logboekregels -- allebei voor DEZE actor. */
function staatDelen(data, code, actor, vandaag) {
  const entries = ((data.klok || {})[code] || []).filter(e => e && String(e.in).slice(0, 10) === vandaag).slice(0, 60);
  return {
    klok: { vandaag: klokVandaagVoor(entries, actor), binnen: [...new Set(entries.filter(e => !e.out).map(e => e.name))] },
    activity: logboekVoor((data.supplierActivity || {})[code], actor, 40).regels
  };
}

module.exports = { staatDelen, KLOKSOORTEN, OUDE_KLOKTEKST, isKlokSoort, isKlokregel, magKlokZien, logboekVoor, klokVandaagVoor, kloktijdenVoor };
