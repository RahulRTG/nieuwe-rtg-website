/* Een payout-teruggang raakt twee duurzame waarheden: eerst het geldgrootboek,
   daarna de betaalopdracht. Valt de tweede save uit, dan wordt dezelfde
   webhook opnieuw geleverd. De unieke oorspronkelijke ledgerRef maakt de
   compensatie ook aan de grootboekkant idempotent. */
'use strict';
const crypto = require('crypto');

/* `sleutelSoort` is de soort economische sleutel, en de lijst is gesloten
   (db/economische-identiteit.js, SLEUTEL). Hetzelfde eenmaal-boeken dient ook
   de tegoedbon: geld dat een bon uit de escrow haalt is een herhaalbare
   beweging die bij een retry nooit twee keer mag landen -- precies deze vorm,
   met een eigen voorvoegsel zodat de twee sleutelruimtes nooit botsen. */
const { SLEUTEL } = require('../../db/economische-identiteit');

/* DE JS-KANT VAN EEN BOEKING OP EEN ECONOMISCHE SLEUTEL, ook gebruikt door
   kern/pay/boeking.js voor elke boeking die een sleutel van de aanroeper
   draagt (een oplading op het betaling-id, een betaalverzoek, een Vonk-deel).
   De sleutel en de grootboekprojectie committen in EEN opslagtransactie
   (PostgreSQL of SQLite), dus na een crash is er beide of geen van beide en
   krijgt een herhaling het eerste antwoord terug. `ref` is verplicht: hij is
   de identiteit waarop de afdruk de herhaling van een andere boeking scheidt. */
async function boekOpSleutel({ domein, grootboek, boek, boekAsync, boekEenmaal, sleutel, args }) {
  if (typeof grootboek !== 'function')
    return { status: 500, error: 'Het grootboek ontbreekt; een boeking op een sleutel wordt niet gegokt.' };
  if (!SLEUTEL.test(String(sleutel || '')))
    return { status: 500, error: 'Onbekende soort economische sleutel; er is niets geboekt.' };
  const { van, naar, soort, ref } = args;
  const c = Math.round(Number(args.centen));
  const d = String(domein || ''), r = String(ref == null ? '' : ref);
  const afdruk = crypto.createHash('sha256')
    .update([d, van, naar, c, soort, r].map(x => String(x == null ? '' : x)).join('\u001f'))
    .digest('hex');
  const boekArgs = Object.assign({}, args, { centen: c });
  if (typeof boekEenmaal === 'function' && typeof boek === 'function' && d && r) {
    try {
      return await boekEenmaal({ sleutel, afdruk,
        identiteit: { domein: d, van, naar, centen: c, soort: String(soort || ''), ref: r },
        collecties: d === 'bank' ? ['bankSaldi', 'bankBoekingen'] : ['paySaldi', 'payBoekingen'] },
      () => boek(boekArgs));
    } catch (e) {
      return { status: 503, code: 'ECONOMISCHE_OPSLAG_NIET_BEVESTIGD',
        error: 'De boeking kon niet duurzaam worden bevestigd; er is niets nieuws geboekt.' };
    }
  }
  if (process.env.NODE_ENV === 'production') {
    return { status: 503, code: 'ECONOMISCHE_OPSLAG_ONTBREEKT',
      error: !r ? 'Een boeking op een economische sleutel vraagt een referentie.'
        : 'Een duurzame economische opslag is verplicht voor een boeking op een sleutel.' };
  }
  /* Alleen voor losse ontwikkel-/unitcontexts zonder opslaginjectie. Productie
     komt hierboven nooit langs deze proceslokale compatibiliteitsweg. */
  const bestaand = (grootboek() || []).find(x => x && x.van === van && x.naar === naar &&
    Math.round(Number(x.centen)) === c && x.soort === soort && x.ref === ref);
  if (bestaand) return { ok: true, boeking: bestaand, herhaald: true };
  /* boekAsync zonder sleutel als de aanroeper hem geeft (zo stond het hier),
     anders de synchrone guard: kern/pay/boeking.js geeft alleen `boek` mee,
     want zijn eigen boekAsync zou met dezelfde sleutel hier terugkomen. */
  return typeof boekAsync === 'function' ? boekAsync(boekArgs) : boek(boekArgs);
}

async function boekTerugEenmaal({ domein, grootboek, boek, boekAsync,
  boekEenmaal, geldModus, van, naar, centen, soort, oms, ref, sleutelSoort = 'payout-terug', genre, dagBesteed }) {
  if (typeof grootboek !== 'function')
    return { status: 500, error: 'Het grootboek ontbreekt; een payout-teruggang wordt niet gegokt.' };
  const c = Math.round(Number(centen));
  const d = String(domein || ''), r = String(ref || '');
  /* Alleen een vaste hash gaat naar de permanente sleutelindex. Providerrefs
     mogen spaties, slashes en veel tekens bevatten en kunnen persoonsgegevens
     verraden; geen van beide hoort in een DB-primary-key of statusdump. */
  const sleutel = sleutelSoort + ':' + crypto.createHash('sha256')
    .update(['v1', d, soort, r].map(x => String(x == null ? '' : x)).join('\u001f'))
    .digest('hex');
  if (!SLEUTEL.test(sleutel))
    return { status: 500, error: 'Onbekende soort economische sleutel; er is niets geboekt.' };
  /* De afdruk (de beweging zelf) rekent ./boekOpSleutel hierboven uit.
     Genre en al-besteed reizen alleen mee als de aanroeper ze geeft (de
     kascode, ../pay/kas-boek.js): de waardepoort toetst er het beleid mee.
     Ze staan niet in de afdruk -- ze bepalen of er geboekt mag worden, niet
     welke beweging het is. */
  const args = { van, naar, centen: c, soort, oms, ref };
  if (genre != null) args.genre = genre;
  if (dagBesteed != null) args.dagBesteed = dagBesteed;

  /* In cutover-stand is de motor de enige geldwaarheid. Dezelfde economische
     sleutel gaat mee naar zijn duurzame, atomische boekpad; een losse
     opslagclaim hiernaast zou juist een tweede waarheid maken. */
  if (geldModus === 'motor') return boekAsync(Object.assign({}, args, { economischeSleutel: sleutel }));

  return boekOpSleutel({ domein: d, grootboek, boek, boekAsync, boekEenmaal, sleutel, args });
}

module.exports = boekTerugEenmaal;
module.exports.boekOpSleutel = boekOpSleutel;
