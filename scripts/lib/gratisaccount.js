/* ============================================================================
   EEN GRATIS ACCOUNT, LANGS DE ECHTE ROUTE -- voor elke meter die "gratis" meet.

   SAMENLEVING.md par. 11.2: `tier === 'guest'` is TWEE mensen. Een bezoeker
   zonder account (de demo-inlog `/api/login` met `tier: 'guest'`, die
   `geenGast()` in server/server.js met opzet weigert) en een RTG Community-lid
   MET account. Wie "gratis" meet met de eerste, meet een bezoeker en noemt
   alles wat achter een ACCOUNT zit "achter betaling" -- dat is precies de
   meetfout die de nulmeting van de universele bodem eerst maakte.

   Dit bestand staat los omdat twee meters hem nodig hebben
   (scripts/onvervreemdbaar.js en lib/doelgroepsessies.js), en een registratie
   die twee keer is opgeschreven levert over een half jaar twee verschillende
   gratis leden op (LAT.md regel 4).

   DRIE DINGEN DIE HIER VASTLIGGEN:

   1. NOOIT EEN NAGEBOUWD TOKEN. Het account komt langs /api/auth/register met
      `tier: 'guest'` (routes/auth/aanmeldcontrole.js: "de gratis gast-laag"),
      en het antwoord moet ook werkelijk een gast-account zijn -- anders null.
   2. DE PASPOORTCONTROLE LOOPT LANGS DE ECHTE KEURING (`keurLidGoed` uit
      test/helper.js: upload, selfie, en een kantoormens op naam die goedkeurt).
      Er wordt geen `verified`-veld in een database gezet.
   3. MISLUKKEN IS NULL, NOOIT EEN HALF ACCOUNT. Wie om een gecontroleerd
      account vraagt en een ongecontroleerd krijgt, meet de paspoortdeur als
      "dicht" -- dezelfde vorm als de meetfout hierboven. De aanroeper beslist
      wat hij met null doet, en hoort dat hardop te melden.
   ========================================================================== */
'use strict';

async function registreerGratis(basis) {
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const r = await fetch(basis + '/api/auth/register', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Proefgenoot', email: 'gr' + u + '@voorbeeld.nl', phone: '06' + u.slice(0, 8),
      password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'guest' }) }).catch(() => null);
  if (!r) return null;
  const j = await r.json().catch(() => null);
  const gebruiker = j && j.state && j.state.user;
  return (j && j.token && gebruiker && gebruiker.tier === 'guest') ? { token: j.token, codenaam: gebruiker.codename } : null;
}

/* Een gratis account waarvan RTG het paspoort heeft gezien. Vraagt een
   wegwerpserver met RTG_DEMO (het kantoor moet kunnen inloggen). */
async function gecontroleerdGratis(basis) {
  const account = await registreerGratis(basis);
  if (!account) return null;
  try { await require('../../test/helper').keurLidGoed(basis, account.token, account.codenaam); }
  catch (e) { return null; }
  return account;
}

module.exports = { registreerGratis, gecontroleerdGratis };
