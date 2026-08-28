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

module.exports = function maakMeldingen(deps) {
  const {
    DEMO, GIDS_SEED_TIERS, PERSONAS, accounts, bus, crypto, db, eigenaar, 
    ensureSupplierDefaults, save, sessions, tokenHash, webpush
  } = deps;
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

// notificeer één tier: opslaan, naar open schermen sturen én web-push
function notify(tier, note) {
  const n = { id: crypto.randomBytes(4).toString('hex'), read: false, at: new Date().toISOString(), ...note };
  // meldingsvoorkeuren (kern/ervaring.js): een uitgezette scope wordt niet
  // opgeslagen en niet gepusht; zonder voorkeur staat alles aan
  const vk = (db.data.meldingVoorkeur || {})[tier];
  if (n.scope && vk && vk[n.scope] === false) return n;
  db.data.notifications[tier] = (db.data.notifications[tier] || []);
  db.data.notifications[tier].unshift(n);
  db.data.notifications[tier] = db.data.notifications[tier].slice(0, 40);
  save();
  // een melding gaat over een lid en draagt zijn tekst mee
  bus.publish('sse', { doel: 'tier', match: [tier], event: 'notify', data: n,
    envelop: { classificatie: 'persoonsgegeven' } });
  sendPush(tier, n);
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
