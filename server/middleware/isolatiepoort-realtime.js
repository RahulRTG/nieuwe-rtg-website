/* Persoonlijke isolatie op LANG LEVENDE verbindingen.

   Een SSE-handshake is een GET en liep daarom terecht langs de gewone
   leessnelweg. Maar de bevoegdheid van zo'n verbinding leefde daarna onbeperkt
   door: een ingetrokken token of nieuw gezette isolatiestand werd nooit meer
   bekeken. Deze module bindt alleen /api/stream aan dezelfde live stand.

   Iedere payload wordt vlak voor de ene res.write opnieuw gekeurd. Daardoor is
   intrekking effectief vóór de eerstvolgende aflevering; een lokale zetting op
   `isolatie` sluit passende verbindingen bovendien direct. Andere SSE-deuren
   (supplier, office en RTF-gezin) dragen geen RTG-ledensessie en blijven buiten
   deze persoonlijke dragerlaag. */
'use strict';

const poortstand = require('./isolatiepoort-stand');
const { dragersVanSessie, losSessie } = require('../kern/isolatie/sessiedragers');
const intrekSignaal = require('../kern/intreksignaal');

/* Map en geen WeakMap: bij een nieuwe isolatiestand moeten bestaande lokale
   verbindingen direct gevonden en gesloten kunnen worden. Opruimen gebeurt op
   request-close en bij iedere gedwongen sluiting. */
const actief = new Map();

function moetHandhaven() {
  return poortstand.bijtHij() ||
    (process.env.NODE_ENV === 'production' && poortstand.afdwingenUitOmgeving(process.env));
}

function antwoord(reden) {
  return {
    error: reden === 'SESSIE_INGETROKKEN'
      ? 'Deze live-sessie is niet meer geldig.'
      : 'Live-updates zijn gestopt omdat je beveiligingsstand ze niet toestaat.',
    as: 'isolatie', reden
  };
}

function keur({ token, sessie }) {
  try {
    const leiding = intrekSignaal.stand();
    if (process.env.REDIS_URL && (!leiding.gekoppeld || leiding.soort !== 'redis' || !leiding.gereed)) {
      throw new Error('de Redis-intrekkingsleiding is niet aantoonbaar gereed');
    }
    const s = sessie || losSessie(token);
    if (!s) return { toegestaan: false, status: 401, reden: 'SESSIE_INGETROKKEN' };
    const { sleutels } = dragersVanSessie(s, token);
    const laag = poortstand.huidig();
    if (!laag) {
      if (moetHandhaven()) throw new Error('de isolatielaag is niet gemonteerd');
      return { toegestaan: true, sessie: s, sleutels };
    }
    const context = laag.context(sleutels);
    const stand = laag.effectieveStand(context.standen);
    const gesloten = stand.trede === 'isolatie' || stand.tredeOnbepaald === true;
    if (gesloten) {
      poortstand.telling.gewogen++;
      poortstand.telling.zouSluiten++;
      if (!moetHandhaven()) return { toegestaan: true, sessie: s, sleutels, schaduw: true };
      return { toegestaan: false, status: 503, reden: 'ISOLATIE_REALTIME_DICHT', sleutels };
    }
    return { toegestaan: true, sessie: s, sleutels };
  } catch (e) {
    poortstand.noteerOnzeker(e, 'GET /api/stream');
    return { toegestaan: false, status: 503, reden: 'ISOLATIE_ONBEPAALD' };
  }
}

/* Eerst keuren, pas daarna headers schrijven en registreren. */
function registreer({ res, token, sessie }) {
  const uit = keur({ token, sessie });
  if (!uit.toegestaan) return Object.assign(uit, { antwoord: antwoord(uit.reden) });
  actief.set(res, { res, token, vinger: intrekSignaal.vingerVanToken(token),
    sid: uit.sessie && uit.sessie.sid || null, sleutels: uit.sleutels });
  return uit;
}

function vergeet(res) { actief.delete(res); }

function sluit(entry) {
  actief.delete(entry.res);
  try { if (!entry.res.writableEnded) entry.res.end(); } catch (e) {}
}

/* Wordt door de centrale SSE-schrijver én door de heartbeat aangeroepen. De
   sessie wordt bewust opnieuw opgelost: een bij registratie geldige token is
   geen blijvende machtiging. */
function magSchrijven(res) {
  const entry = actief.get(res);
  if (!entry) return true;
  const uit = keur({ token: entry.token });
  if (uit.toegestaan) {
    entry.sleutels = uit.sleutels;
    return true;
  }
  sluit(entry);
  return false;
}

/* De lokale onmiddellijke intrekking bij een nieuwe isolatiestand. Voor een
   andere procesinstantie geldt de herkeuring bij de eerstvolgende aflevering;
   deze functie doet geen onbewezen uitspraak over distributielatentie. */
function sluitDrager(drager, sleutel) {
  if (!sleutel) return 0;
  let aantal = 0;
  for (const entry of [...actief.values()]) {
    if (entry.sleutels && entry.sleutels[drager] === sleutel) {
      sluit(entry); aantal++;
    }
  }
  return aantal;
}

function sluitIntrekking(bericht) {
  let aantal = 0;
  for (const entry of [...actief.values()]) {
    const raak = bericht.soort === 'token' ? entry.vinger === bericht.waarde
      : bericht.soort === 'sessie' && entry.sid === bericht.waarde;
    if (raak) { sluit(entry); aantal++; }
  }
  return aantal;
}

function sluitAlles() {
  const aantal = actief.size;
  for (const entry of [...actief.values()]) sluit(entry);
  return aantal;
}

/* De lokale levering is synchroon. Bij Redis komt hetzelfde bericht uit een
   ander proces hier eventgedreven binnen. Valt de leiding weg, dan blijven er
   op deze instance geen persoonlijke streams open waarvan intrekking mogelijk
   gemist kan worden. */
intrekSignaal.abonneer(sluitIntrekking);
intrekSignaal.bewaakStand(s => {
  if (s.soort === 'redis' && !s.gereed) sluitAlles();
});

function _wis() {
  for (const entry of [...actief.values()]) sluit(entry);
  actief.clear();
}

module.exports = { registreer, vergeet, magSchrijven, sluitDrager, sluitIntrekking,
  sluitAlles, _wis, _keur: keur };
