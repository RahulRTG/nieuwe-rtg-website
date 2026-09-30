/* Beveiliging-rooster (deelmodule): EEN DIENST DIE VERVALT, KRIJGT EEN BERICHT.

   Sinds PR #422 dekt een vastgestelde dienst de post niet meer zodra de bewaker
   afwezig is (./planning.js, rooster()). Dat stond in het rooster, en verder
   nergens: een leidinggevende die niet keek, zag niet dat zijn post open lag.
   Deze module hangt aan het verzuimregister (kern/payroll/index.js,
   `verzuim.naMelding`) en meldt het de zaak op het moment dat het gebeurt.

   Drie dingen liggen vast:
   - Het bericht zegt DAT de bewaker afwezig is en WELKE post open ligt, nooit
     waarom. De soort van de melding (ziek, verlof) gaat er met opzet niet in;
     dezelfde lijn als het teamrooster.
   - Er wordt niets geschrapt en niemand automatisch ingepland: herplannen doet
     een mens (de autoplanner of de knop in het rooster).
   - Een melding wordt per dienst EEN keer gemeld (`afwezigGemeld` draagt het id
     van de verzuimregel); dezelfde regel opnieuw vastleggen geeft geen tweede
     bericht, een nieuwe regel wel.

   Een open ziekmelding heeft geen einddatum; dan wordt de komende twee weken
   bekeken -- verder vooruit staat een dienst die de leidinggevende nog ziet
   voordat hij begint. */
'use strict';
const { maakInplanbaar } = require('../../payroll/inplanbaar');

const VOORUIT_DAGEN = 14;
const plusDagen = (d, n) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

module.exports = (ctx) => {
  const { save, findSupplier, notifySupplier, sseToSupplier, vandaag, isBeveiliging, diensten, guardNaam, postVan, shiftVan } = ctx;
  const inplanbaar = maakInplanbaar(ctx.afwezigOp);

  /* Geeft het aantal diensten terug waarover nu een bericht uitging (0 als er
     niets vervalt, of als de zaak geen beveiligingszaak is). */
  function dienstVervalt(code, staffId, melding) {
    const s = findSupplier(code);
    if (!s || !isBeveiliging(s) || !melding || !melding.van) return 0;
    const van = melding.van > vandaag() ? melding.van : vandaag();
    const tot = melding.tot || plusDagen(van, VOORUIT_DAGEN);
    const gid = Number(staffId);
    const geraakt = diensten().filter(d => d.supplierCode === s.code && d.guardId === gid && d.status === 'gepland' &&
      d.datum >= van && d.datum <= tot && d.afwezigGemeld !== melding.id && !inplanbaar(s.code, gid, d.datum).plan);
    if (!geraakt.length) return 0;
    for (const d of geraakt) d.afwezigGemeld = melding.id;
    save();
    const regels = geraakt.sort((a, b) => (a.datum < b.datum ? -1 : 1)).map(d => {
      const p = postVan(s, d.postId); const sh = shiftVan(d.shiftId);
      return (p ? p.naam : 'Post') + ', ' + (sh ? sh.naam : d.shiftId) + ' op ' + d.datum;
    });
    notifySupplier(s.code, { icon: 'schild', title: 'Dienst vervalt',
      body: guardNaam(s, gid) + ' is afwezig. Deze post' + (regels.length > 1 ? 'en liggen' : ' ligt') + ' weer open: ' +
        regels.join('; ') + '. Herplannen doet een mens.' });
    sseToSupplier(s.code, 'sync', { scope: 'beveiliging' });
    return geraakt.length;
  }

  return { dienstVervalt };
};
