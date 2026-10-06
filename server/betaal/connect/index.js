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
   (./afrekening.js regel 3). Zie het eindverslag voor de exacte plek. */
'use strict';
const { maakOpslag } = require('./opslag');
const { maakConnectAfrekening } = require('./afrekening');
const { maakMelding } = require('./melding');

function maakConnect({ db, save, stripe, vrijgave, boekEffect = null, audit, nu, opslag } = {}) {
  const o = opslag || maakOpslag({ db, save });
  const kern = maakConnectAfrekening({ stripe, vrijgave, opslag: o, boekEffect, audit, nu });
  const melding = maakMelding(Object.assign({}, kern, { opslag: o }));
  return Object.assign({ opslag: o }, kern, melding,
    { lijst: () => ({ afrekeningen: o.alle(), bevindingen: o.bevindingen() }) });
}

let EEN = null;
const HAAK = { boek: null };
function standaard({ db, save, audit, env = process.env } = {}) {
  if (EEN) return EEN;
  if (!db || typeof save !== 'function') throw new Error('Stripe Connect heeft db en save nodig bij de eerste montage.');
  let stripe = null;
  if (env.STRIPE_SECRET_KEY) { try { stripe = require('../../stripe')(env.STRIPE_SECRET_KEY); } catch (e) { stripe = null; } }
  EEN = maakConnect({ db, save, stripe, audit, boekEffect: HAAK });
  return EEN;
}

/* De grootboekkoppeling, achteraf in te hangen door de geldlaag. Een functie
   die `{ sleutel, soort, afrekening, partner, centen, valuta }` krijgt en per
   sleutel hoogstens een effect boekt. */
function koppelGrootboek(boekEffect) {
  if (typeof boekEffect !== 'function') throw new Error('De grootboekkoppeling moet een functie zijn.');
  HAAK.boek = boekEffect;
}

module.exports = { maakConnect, standaard, koppelGrootboek };
