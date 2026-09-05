/* Een payout-teruggang raakt twee duurzame waarheden: eerst het geldgrootboek,
   daarna de betaalopdracht. Valt de tweede save uit, dan wordt dezelfde
   webhook opnieuw geleverd. De unieke oorspronkelijke ledgerRef maakt de
   compensatie ook aan de grootboekkant idempotent. */
'use strict';
const crypto = require('crypto');

module.exports = async function boekTerugEenmaal({ domein, grootboek, boek, boekAsync,
  boekEenmaal, geldModus, van, naar, centen, soort, oms, ref }) {
  if (typeof grootboek !== 'function')
    return { status: 500, error: 'Het grootboek ontbreekt; een payout-teruggang wordt niet gegokt.' };
  const c = Math.round(Number(centen));
  const d = String(domein || ''), r = String(ref || '');
  /* Alleen een vaste hash gaat naar de permanente sleutelindex. Providerrefs
     mogen spaties, slashes en veel tekens bevatten en kunnen persoonsgegevens
     verraden; geen van beide hoort in een DB-primary-key of statusdump. */
  const sleutel = 'payout-terug:' + crypto.createHash('sha256')
    .update(['v1', d, soort, r].map(x => String(x == null ? '' : x)).join('\u001f'))
    .digest('hex');
  const afdruk = crypto.createHash('sha256')
    .update([d, van, naar, c, soort, r].map(x => String(x == null ? '' : x)).join('\u001f'))
    .digest('hex');
  const args = { van, naar, centen: c, soort, oms, ref };

  /* In cutover-stand is de motor de enige geldwaarheid. Dezelfde economische
     sleutel gaat mee naar zijn duurzame, atomische boekpad; een losse
     opslagclaim hiernaast zou juist een tweede waarheid maken. */
  if (geldModus === 'motor') return boekAsync(Object.assign({}, args, { economischeSleutel: sleutel }));

  if (typeof boekEenmaal === 'function' && typeof boek === 'function' && d && r) {
    try {
      return await boekEenmaal({ sleutel, afdruk,
        identiteit: { domein: d, van, naar, centen: c, soort: String(soort || ''), ref: r },
        collecties: d === 'bank' ? ['bankSaldi', 'bankBoekingen'] : ['paySaldi', 'payBoekingen'] },
      () => boek(args));
    } catch (e) {
      return { status: 503, code: 'ECONOMISCHE_OPSLAG_NIET_BEVESTIGD',
        error: 'De payout-teruggang kon niet duurzaam worden bevestigd; er is niets nieuws geboekt.' };
    }
  }
  if (process.env.NODE_ENV === 'production') {
    return { status: 503, code: 'ECONOMISCHE_OPSLAG_ONTBREEKT',
      error: 'Een duurzame economische opslag is verplicht voor payout-teruggangen.' };
  }
  /* Alleen voor losse ontwikkel-/unitcontexts zonder opslaginjectie. Productie
     komt hierboven nooit langs deze proceslokale compatibiliteitsweg. */
  const bestaand = (grootboek() || []).find(r => r && r.van === van && r.naar === naar &&
    Math.round(Number(r.centen)) === c && r.soort === soort && r.ref === ref);
  if (bestaand) return { ok: true, boeking: bestaand, herhaald: true };
  return boekAsync(args);
};
