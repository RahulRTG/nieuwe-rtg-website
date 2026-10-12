/* WAT EEN ACTOR VAN DE AFWEZIGHEID, DE MELDINGEN EN DE LIJNBEZETTING VAN ZIJN
   COLLEGA'S MAG ONTVANGEN. Dezelfde regel als ./logboekzicht.js, en met diens
   predicaten (magKlokZien, isEigen): een manager alles, de medewerker zelf het
   zijne op staffId en nooit op naam, een collega alleen wat aanwezigheid is.

   Eigenaarsbesluiten van 11 oktober 2026 (tegenlezing PR #584):
   A1. de keukenlijn: wie NU aan de lijn staat mag iedereen zien, maar niet in
       de volgorde waarin men zich aanmeldde (lijnVoor);
   B1. ziekmeldingen zijn gezondheidsinformatie. Een collega ziet alleen
       "afwezig", zonder soort, reden of datum; de melding en de logregel gaan
       alleen naar een manager en de medewerker zelf. Ook een manager krijgt geen
       medische details: DAT iemand ziek is en sinds wanneer (verlofVoor,
       afwezigheidVoor, meldingenVoor);
   en sollicitatiegegevens horen bij de werving, dus bij de manager.

   Een melding draagt `alleenVoor: { staffId }` (null = alleen managers). Elke
   bak heeft een eigen grens (bewaarMeldingen), zodat een beschermde melding
   geen zichtbare van de lijst drukt -- dezelfde reden als bij het logboek. */
'use strict';
const { magKlokZien, isEigen, aanwezigVoor } = require('./logboekzicht');
const { meldingBeperking } = require('./beschermdesoorten');

const zelfOfManager = (actor, staffId) => magKlokZien(actor) || isEigen(actor, staffId);

/* Een rij over iemands afwezigheid: een manager en de mens zelf de rij, een
   collega alleen de velden in `houd` en dat hij afwezig is. */
function afwezigheidVoor(rij, actor, eigenaarId, houd) {
  if (!rij || typeof rij !== 'object' || zelfOfManager(actor, eigenaarId)) return rij;
  const uit = { afwezig: true };
  for (const v of houd || []) if (rij[v] !== undefined) uit[v] = rij[v];
  return uit;
}

/* De reden van een afwezigheid op een rij (het beveiligingsrooster zet daar de
   verlofsoort in, "Vakantie." of erger): de manager en de mens zelf de tekst,
   een collega alleen `afwezig: true`. */
function afwezigRedenVoor(rij, actor, eigenaarId) {
  if (!rij || typeof rij !== 'object' || !rij.afwezig || zelfOfManager(actor, eigenaarId)) return rij;
  return Object.assign({}, rij, { afwezig: true });
}

/* Over welke periode een actor iemands afwezigheid mag opvragen: de manager en
   de mens zelf de gevraagde, een collega alleen vandaag -- anders leest hij een
   ziekteperiode af aan van tot tot over jaren. Valt vandaag buiten de vraag,
   dan niets (null). */
function periodeVoor(actor, eigenaarId, van, tot, vandaag) {
  if (zelfOfManager(actor, eigenaarId)) return { van, tot };
  return van <= vandaag && tot >= vandaag ? { van: vandaag, tot: vandaag } : null;
}

/* De verlofstroom van de zaak (db.data.verlof). Een manager: alles, zonder
   omschrijving bij ziekte. De medewerker zelf: zijn eigen aanvragen. Een
   collega: alleen wie VANDAAG afwezig is, als { staffId, name, soort:
   'afwezig' } -- geen soort, geen data, geen status, en geen aanvraag die nog
   niet besloten is. */
function verlofVoor(lijst, actor, vandaag) {
  const alle = Array.isArray(lijst) ? lijst : [];
  const zonderReden = (v) => (v && v.soort === 'ziek' && v.reden ? Object.assign({}, v, { reden: '' }) : v);
  if (magKlokZien(actor)) return alle.slice(0, 30).map(zonderReden);
  const vandaagWeg = (v) => v && (v.tot
    ? v.status === 'goedgekeurd' && v.van <= vandaag && v.tot >= vandaag
    : v.status === 'gemeld' && v.van === vandaag);
  const eigen = alle.filter((v) => v && isEigen(actor, v.staffId)).slice(0, 30);
  const anderen = alle.filter((v) => v && !isEigen(actor, v.staffId) && vandaagWeg(v))
    .map((v) => ({ staffId: v.staffId, name: v.name, soort: 'afwezig' }));
  const gezien = new Set();
  return eigen.concat(aanwezigVoor(anderen.filter((v) => !gezien.has(String(v.staffId)) && gezien.add(String(v.staffId))), null));
}

/* De meldingen van de zaak. Een melding met `alleenVoor` gaat naar de managers
   en naar die ene medewerker; een BEPERKTE melding zonder `alleenVoor` (van voor
   dat veld, herkend aan haar titel) alleen naar de managers; de rest naar
   iedereen. Het veld zelf gaat niet mee. */
const beperkt = (n) => !!n && (!!n.alleenVoor || !!meldingBeperking(n));
function meldingVoor(n, actor) {
  if (!beperkt(n)) return true;
  if (magKlokZien(actor)) return true;
  return !!n.alleenVoor && isEigen(actor, n.alleenVoor.staffId);
}
/* De gelezen-vlag van een beperkte melding is per LEZER voor wie geen manager
   is: zou de zieke zijn eigen ziekmelding op gelezen zetten, dan ziet zijn
   manager hem niet meer als nieuw. */
function meldingenVoor(lijst, actor) {
  const manager = magKlokZien(actor);
  return (Array.isArray(lijst) ? lijst : []).filter((n) => meldingVoor(n, actor)).map((n) => {
    if (!beperkt(n)) return n;
    const uit = Object.assign({}, n); delete uit.alleenVoor; delete uit.gelezenDoor;
    if (!manager) uit.read = (n.gelezenDoor || []).includes(String(actor && actor.staffId));
    return uit;
  });
}
function markeerGelezen(n, actor) {
  if (!meldingVoor(n, actor)) return;
  if (!beperkt(n) || magKlokZien(actor)) { n.read = true; return; }
  const wie = String(actor.staffId);
  n.gelezenDoor = (n.gelezenDoor || []).includes(wie) ? n.gelezenDoor : (n.gelezenDoor || []).concat(wie);
}
const MELDINGEN_PER_BAK = 40;
function bewaarMeldingen(lijst) {
  const tel = new Map();
  return (Array.isArray(lijst) ? lijst : []).filter((n) => {
    const bak = beperkt(n) ? 'b:' + (n.alleenVoor && n.alleenVoor.staffId != null ? n.alleenVoor.staffId : '-') : 'g';
    const k = (tel.get(bak) || 0) + 1;
    tel.set(bak, k);
    return k <= MELDINGEN_PER_BAK;
  });
}

// de lijnbezetting per kant: voor een collega op naam, niet in aanmeldvolgorde
function lijnVoor(lijn, actor) {
  if (!lijn || typeof lijn !== 'object' || magKlokZien(actor)) return lijn || {};
  const uit = {};
  for (const [kant, wie] of Object.entries(lijn)) uit[kant] = aanwezigVoor(wie, actor);
  return uit;
}

/* De personeelsdelen van /api/supplier/state (./state.js) voor deze actor.
   EEN ZIEKMELDING GAAT HIER ZONDER OMSCHRIJVING DE DEUR UIT, ook naar de
   manager: dit is de plek waar het gegeven de werkgever bereikt, en oudere
   meldingen kunnen er nog een dragen. Sollicitaties horen bij de werving, en
   elke wervingsroute is managerOnly: een ander krijgt een lege lijst. */
function staatDelen(data, s, actor, vandaag, werkgeverSollicitatie) {
  const per = (bak) => ((data[bak] || {})[s.code]);
  return {
    lijn: lijnVoor(s.lijn, actor),
    verlof: verlofVoor(per('verlof'), actor, vandaag),
    notifications: meldingenVoor(per('supplierNotifications'), actor),
    applications: magKlokZien(actor) ? (per('applications') || []).slice(0, 30).map(werkgeverSollicitatie) : []
  };
}

module.exports = { staatDelen, periodeVoor, afwezigheidVoor, afwezigRedenVoor, verlofVoor, meldingVoor, meldingenVoor, markeerGelezen, bewaarMeldingen, lijnVoor, MELDINGEN_PER_BAK };
