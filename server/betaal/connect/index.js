/* STRIPE CONNECT VOOR PARTNERAFREKENINGEN -- de montage.

   Een exemplaar per proces, zodat de webhookroute (server/opzet/
   connectwebhook.js) en het kantoor (server/routes/kantoren/connect.js)
   dezelfde sloten en dezelfde opslag zien. Wie het eerst vraagt, levert db en
   save; de tweede krijgt hetzelfde exemplaar.

   De Stripe-client is een EIGEN exemplaar van server/stripe.js op dezelfde
   sleutel als de betaalnaad. Niet de client uit server/betaal.js: die is null
   zodra RTG_BETALEN_UIT staat, en dan zou de veeg ook de STAND van wat al
   onderweg was niet meer kunnen ophalen. Of er iets NIEUWS mag, beslist de
   vrijgavepoort -- en die kijkt naar RTG_BETALEN_UIT (providergezondheid).

   `boekEffect` is de koppeling met het grootboek (kern/pay). Die staat hier op
   null tot de geldlaag hem levert; zonder koppeling weigert iedere aanvraag
   (./afrekening.js regel 3). De geldlaag levert hem bij het opstarten
   (server/opzet/kernlaag4b.js, `koppelGrootboek(maakConnectBoeking(kern.pay))`).

   DUURZAAM. Het standaardexemplaar legt zijn records vast via
   server/lib/duurzaam.js (keuringsregel 47): een afrekening die naar Stripe gaat,
   staat eerst duurzaam op schijf, en een melding krijgt pas 200 als haar stand
   en haar boeking er staan. Zie ./opslag.js `vast()`. */
'use strict';
const { maakOpslag } = require('./opslag');
const { maakConnectAfrekening } = require('./afrekening');
const { maakMelding } = require('./melding');

function maakConnect({ db, save, stripe, vrijgave, boekEffect = null, audit, nu, opslag, vastleggen = null } = {}) {
  const o = opslag || maakOpslag({ db, save, vastleggen });
  const kern = maakConnectAfrekening({ stripe, vrijgave, opslag: o, boekEffect, audit, nu });
  const melding = maakMelding(Object.assign({}, kern, { opslag: o }));
  return Object.assign({ opslag: o }, kern, melding,
    { lijst: () => ({ afrekeningen: o.alle(), bevindingen: o.bevindingen() }) });
}

let EEN = null;
const HAAK = { boek: null };
/* `vrijgave`: alleen voor wie de dienst als EERSTE opbouwt (een toets met een
   eigen poort); standaard het ene exemplaar per proces (server/kern/vrijgave/). */
function standaard({ db, save, audit, env = process.env, vrijgave } = {}) {
  if (EEN) return EEN;
  if (!db || typeof save !== 'function') throw new Error('Stripe Connect heeft db en save nodig bij de eerste montage.');
  let stripe = null;
  if (env.STRIPE_SECRET_KEY) { try { stripe = require('../../stripe')(env.STRIPE_SECRET_KEY); } catch (e) { stripe = null; } }
  const dbm = require('../../db');
  const vastleggen = require('../../lib/duurzaam')({ bijeen: dbm.bijeen, save, inBundel: dbm.inBundel, bron: 'connect-afrekening' });
  EEN = maakConnect({ db, save, stripe, audit, boekEffect: HAAK, vastleggen, vrijgave });
  return EEN;
}

/* De grootboekkoppeling, achteraf in te hangen door de geldlaag. Een functie
   die `{ sleutel, soort, afrekening, partner, centen, valuta }` krijgt en per
   sleutel hoogstens een effect boekt; hij mag een belofte teruggeven en een
   weigering GOOIT (dan gaat er niets naar Stripe). */
function koppelGrootboek(boekEffect) {
  if (typeof boekEffect !== 'function') throw new Error('De grootboekkoppeling moet een functie zijn.');
  HAAK.boek = boekEffect;
}

module.exports = { maakConnect, standaard, koppelGrootboek };
