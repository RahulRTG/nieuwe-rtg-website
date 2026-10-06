/* ============================================================================
   DE MELDINGENLAAG: wie krijgt waarvan bericht, en langs welke weg.

   Hoort bij ./diensten.js. Daar staat de infrastructuur (bus, sse, geo,
   ledengids); hier staat het BELEID -- welke meldingen er zijn, wie ze krijgt,
   en dat een lid ze kan uitzetten.

   Twee regels die hier hun eigen plek hebben: een lid dat een soort melding
   heeft uitgezet krijgt hem ook niet als push, en een verlopen push-abonnement
   (404 of 410) wordt meteen opgeruimd in plaats van eeuwig herhaald.

   De naad is nagemeten met scripts/blokscan.js: dertien namen erdoor, zes
   terug, nul draden.
   ========================================================================== */
'use strict';
const verraad = require('../lib/verraad');

module.exports = function maakMeldingen(deps) {
  const {
    DEMO, GIDS_SEED_TIERS, PERSONAS, accounts, bus, crypto, db, eigenaar,
    ensureSupplierDefaults, save, sessions, tokenHash, webpush, nextSseId
  } = deps;
/* DE PASSEN ZIJN DE ENIGE BROADCAST-DOELEN. Een lid-SLEUTEL ('user-<id>') is in
   productie nooit een van deze waarden; een persoonlijke melding die per ongeluk
   een pas als bestemming kreeg, mag daarom nooit als tier-broadcast de deur uit.
   In DEMO valt de sleutel van een persona wél samen met zijn pas (één persona
   per pas, dus geen cross-member-lek) -- die blijft dus persoonlijk bezorgd. */
const BROADCAST_TIERS = new Set(['rtg', 'lifestyle', 'business', 'guest']);
function initRealtime() {
  /* accounts gaat mee omdat de opruiming van testzaken buiten Magnaat Test ook
     het personeel van die zaken uit de identiteitskluis moet halen. */
  require('../kern/initdata')({ db, save, crypto, sessions, tokenHash, ensureSupplierDefaults, webpush, DEMO, PERSONAS, GIDS_SEED_TIERS, accounts });
}

// stuur een sync-signaal naar één of meer tiers (open schermen herladen data)
function broadcastSync(tiers, scope) {
  // alleen de naam van een scherm: geen inhoud, dus intern en geen persoonsgegeven
  bus.publish('sse', { doel: 'tier', match: [...tiers], event: 'sync', data: { scope },
    envelop: { classificatie: 'intern' } });
}

/* notificeer EEN BESTEMMING: opslaan, naar open schermen sturen én web-push.
   De bestemming is normaal de SLEUTEL van een lid ('user-<id>'); dan is het een
   persoonlijke melding. Een pas als bestemming is in productie geen geldige
   persoonlijke bestemming (zie BROADCAST_TIERS) -- wie werkelijk alle leden van
   een pas wil bereiken, gebruikt notify.broadcast(). */
function notify(dest, note) {
  return meld(dest, note, save);
}
/* EXPLICIETE BROADCAST naar alle leden van een pas. De enige weg waarlangs een
   melding in de gedeelde tier-bak terechtkomt met `broadcast: true`, en dus de
   enige die meldingenVan aan iedereen van die pas toont. Bestaat opzettelijk
   als aparte functie: een broadcast is een BESLUIT, geen bijwerking van een
   verkeerd meegegeven bestemming. */
notify.broadcast = (tier, note) => meld(tier, note, save, { broadcast: true });
/* Alleen voor callers die hun domeinmutatie al zelf hebben bewaard. De gewone
   ingang behoudt de brede save, zodat bestaande impliciete writes niet vervallen. */
notify.alleenMelding = (dest, note) => meld(dest, note,
  () => save.sleutels ? save.sleutels(['notifications']) : save());
function meld(dest, note, bewaar, opties) {
  /* DE TWEEDE HELFT VAN DE CRASHGRENS `na-commit-voor-bericht`, en dat er twee
     helften zijn is zelf de vondst. ./meldaan.js draagt dezelfde injectie; de
     eerste ronde zette hem alleen daar, en op /api/supplier/facturen/maak sloeg
     hij nooit toe -- die route meldt via DEZE schrijver
     (kern/facturatie/motor.js roept `notify(f.koper.key, ...)`).

     Er zijn dus twee wegen naar db.data.notifications, en een injectie in een
     ervan meet de helft terwijl zij de hele grens belooft. Dat de twee wegen
     bestaan is een bekende naad (zie de kop van ./meldaan.js); die samenvoegen
     is een eigen opdracht en geen bijvangst van de crash-as. Tot die er is,
     hangt de haak op ALLEBEI -- liever twee eerlijke seams dan een grens die
     stil de helft mist. */
  if (verraad.sla('sterf-voor-bericht')) {
    try { process.kill(process.pid, 'SIGKILL'); } catch (e) { process.abort(); }
  }
  /* EEN MELDING IS EEN OBJECT ({ title, body, ... }), NOOIT EEN LOSSE TEKST.
     Acht plekken gaven hier een tekst mee; `...note` spreidde die in losse
     letters ({0:'K',1:'l',...}), zodat de melding leeg aankwam -- en een ervan
     schreef in een bak 'kantoor' die geen enkele lezer heeft. Besluit van
     4 oktober 2026: weigeren in plaats van omzetten, zodat elke aanroeper zelf
     kiest of hij op een pas of op een lid meldt (zie ./meldaan.js).
     test/notify-vorm.test.js houdt ook de bron schoon. */
  if (!note || typeof note !== 'object' || Array.isArray(note))
    throw new TypeError('notify() verwacht een melding als object ({ title, body }), geen ' + (Array.isArray(note) ? 'lijst' : typeof note) + '.');
  const n = { id: crypto.randomBytes(4).toString('hex'), read: false, at: new Date().toISOString(), ...note };
  dest = (dest == null) ? dest : String(dest);
  if (!dest) return n;   // geen bestemming: niets om te bewaren of te bezorgen
  // meldingsvoorkeuren (kern/ervaring.js): een uitgezette scope wordt niet
  // opgeslagen en niet gepusht; zonder voorkeur staat alles aan
  const vk = (db.data.meldingVoorkeur || {})[dest];
  if (n.scope && vk && vk[n.scope] === false) return n;

  const naarTier = BROADCAST_TIERS.has(dest);
  const broadcast = !!(opties && opties.broadcast) && naarTier;

  /* FAIL-CLOSED: een pas als bestemming ZONDER expliciete broadcast is in
     productie een persoonlijke melding die per ongeluk naar een pas ging. Hem
     in de gedeelde tier-bak leggen of per tier uitzenden zou hem aan alle leden
     van die pas tonen -- precies de lek die blocker 2 sluit. We bewaren en
     bezorgen hem dan niet (de aanroeper hoort de ledensleutel mee te geven).
     In DEMO valt de sleutel van een persona samen met zijn pas; daar is het wél
     de bedoelde persoon en geen gedeelde bak, dus die weg blijft open. */
  if (naarTier && !broadcast && !DEMO) return n;

  if (broadcast) n.broadcast = true;   // alleen zetten als het er is: geen `broadcast: undefined` in de vorm
  db.data.notifications[dest] = (db.data.notifications[dest] || []);
  db.data.notifications[dest].unshift(n);
  db.data.notifications[dest] = db.data.notifications[dest].slice(0, 40);
  bewaar();

  if (broadcast) {
    // bewuste broadcast naar alle leden van een pas
    bus.publish('sse', { doel: 'tier', match: [dest], event: 'notify', data: n,
      envelop: { classificatie: 'intern' } });
    sendPush(dest, n);
  } else {
    /* PERSOONLIJK: naar precies één sessiesleutel (in demo valt die samen met de
       pas). Zelfde weg als sseToCustomer: doel 'key', met een buffer-id. */
    bus.publish('sse', { doel: 'key', match: dest, event: 'notify', data: n,
      id: nextSseId ? nextSseId() : undefined, envelop: { classificatie: 'persoonsgegeven' } });
    try { sendPush(dest, n); } catch (e) { /* push mag een melding niet tegenhouden */ }
    const m = /^user-(.+)$/.exec(dest);
    if (m) { try { sendPushToUser(m[1], n); } catch (e) {} }
  }
  return n;
}

// push naar één specifiek account (voor persoonlijke meldingen, bijv. van de RTFoundation)
function sendPushToUser(userId, note) {
  if (!webpush || userId == null) return;
  const subs = (db.data.pushSubsUser[userId] || []).slice();
  if (!subs.length) return;
  const payload = JSON.stringify({ title: note.title, body: note.body, icon: '/icon.svg', tag: note.tag });
  for (const sub of subs) {
    webpush.sendNotification(sub, payload).catch(err => {
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        db.data.pushSubsUser[userId] = (db.data.pushSubsUser[userId] || []).filter(s => s.endpoint !== sub.endpoint);
        save();
      }
    });
  }
}

function sendPush(tier, note) {
  if (!webpush) return;
  const subs = db.data.pushSubs[tier] || [];
  const payload = JSON.stringify({ title: note.title, body: note.body, icon: '/icon.svg', tag: note.id });
  for (const sub of subs.slice()) {
    webpush.sendNotification(sub, payload).catch(err => {
      // verlopen/ongeldige subscription opruimen
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        db.data.pushSubs[tier] = (db.data.pushSubs[tier] || []).filter(s => s.endpoint !== sub.endpoint);
        save();
      }
    });
  }
}

/* Beveiligingsmeldingen (inbraakdetectie) voor het technische bord. Een kritieke
   melding gaat meteen naar de eigenaar: web-push op zijn telefoon en een e-mail. */
function eigenaarAccount() {
  // Hetzelfde adres als de boardroom- en kantoorpoort gebruiken (kern/eigenaar.js).
  // Stond hier eerder een eigen voorbeeldadres, waardoor de meldingen bij een
  // ander account uitkwamen dan de poort als eigenaar herkende.
  try { return accounts.findByLogin(eigenaar.eigenaarEmail()); } catch (e) { return null; }
}

  return {
    broadcastSync, eigenaarAccount, initRealtime, notify, sendPush, sendPushToUser
  };
};
