/* EEN GEZIN AAN EEN GRATIS OUDERACCOUNT, voor elke toets die een gezin nodig heeft.

   Sinds het eigenaarsbesluit van 19 oktober 2026 (AGENTS.md: gebruiken vraagt
   een account) bestaat een anoniem gezin met gezinscode en pincode alleen nog
   in de demo; daarbuiten hangt elk gezin aan het account van een ouder
   (server/foundation/accountplicht.js). Toetsen die een gezin als gebruiker
   nodig hadden, maken het hier langs de echte routes:

     - een gratis account (scripts/lib/gratisaccount.js);
     - met `kind`: de ouder langs de echte keuring (keurLidGoed), want een kind
       toevoegen vraagt een gecontroleerd paspoort. Die keuring vraagt een
       kantoormens op naam, en die bestaat alleen in de demo: een toets met een
       kind start dus met RTG_MAGNAAT_TEST=1 en RTF_GEZIN_ACCOUNTPLICHT=1;
     - het gezin via /api/rtf/eigen-gezin/maak, en de sessie van het kind via
       /api/rtf/eigen-gezin/sessie.

   Geeft { ouder, code, token, profiel, gezin, kind? }. Mislukt een stap, dan
   gooit hij met de reden: een half gezin meet niets. */
'use strict';

const { registreerGratis } = require('../scripts/lib/gratisaccount');
const { keurLidGoed } = require('./helper');

async function gezinAanAccount(base, opties = {}) {
  const post = (pad, body, tok) => fetch(base + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const eis = (r, wat) => { if (r.status !== 200) throw new Error(wat + ': ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 160)); return r.body; };

  const ouder = await registreerGratis(base);
  if (!ouder) throw new Error('geen gratis account');
  if (opties.kind) await keurLidGoed(base, ouder.token, ouder.codenaam);
  const g = eis(await post('/api/rtf/eigen-gezin/maak', { gezinsnaam: opties.gezinsnaam || 'Testgezin',
    naam: opties.naam || 'Ouder', bevoegdGezin: true, privacyAkkoord: true }, ouder.token), 'gezin maken');
  const beheer = eis(await post('/api/rtf/eigen-gezin/sessie', {}, ouder.token), 'sessie van de ouder');
  const uit = { ouder, code: g.code, token: beheer.token, profiel: beheer.profiel, gezin: beheer.gezin };
  if (opties.kind) {
    const k = opties.kind;
    const p = eis(await post('/api/rtf/eigen-gezin/kind', { naam: k.naam || 'Kind',
      geboortedatum: k.geboortedatum || '2015-04-04', kleur: k.kleur }, ouder.token), 'kind toevoegen');
    const s = eis(await post('/api/rtf/eigen-gezin/sessie', { profielId: p.profiel.id }, ouder.token), 'sessie van het kind');
    uit.kind = { token: s.token, profiel: s.profiel };
  }
  return uit;
}

module.exports = { gezinAanAccount };
