/* ============================================================================
   DE HORECAWERELD -- een open rekening op een tafel.

   HET PROBLEEM. Zesenveertig horecaroutes stonden op 404, en twintig ervan
   zeggen hetzelfde: "Deze rekening kennen we niet." De rekening is het
   scharnier van dit domein -- bestellen, korting, splitsen, fooi, afrekenen en
   de bon hangen er allemaal aan.

   WAT ER AL WAS. De gastfamilie (scripts/lib/lijfsleutels.js) loopt de
   gastenkant af: de zaak geeft een QR uit, de gast scant hem, de gast schuift
   aan. Bij dat aanschuiven ONTSTAAT er een rekening -- alleen kwam het id
   ervan nergens terecht, want de familie levert alleen `sleutel`.

   Dit is dus geen nieuwe keten maar een OOGST op een bestaande: dezelfde
   stappen, en daarna vragen wie de rekening is. Dat kost twee oproepen en
   levert twintig routes.

   HET VELD HEET `rekeningId`, en dat is uit de bron gelezen
   (server/routes/supplier/horeca/rekening.js, rekVan). Raden had hier niets
   opgeleverd: de gastenkant noemt hetzelfde ding `sleutel` en de zaakkant
   `rekeningId`, en dat zijn twee namen voor twee gezichtspunten op dezelfde
   rekening.

   WAT DIT NIET DOET. Er wordt niets afgerekend en geen bestelling geforceerd.
   De wereld zet een OPEN rekening klaar; wat de proef daarna meet -- doet een
   tweede oproep het werk nog een keer -- blijft onaangeraakt. */
'use strict';

async function zetHorecaKlaar({ post, sleutels, tokens }) {
  const stappen = [];
  const doe = async (naam, pad, lijf, tok) => {
    let a = null;
    try { a = await post(pad, lijf, tok); } catch (e) { a = { status: 0, data: null }; }
    const ok = a && a.status >= 200 && a.status < 300;
    stappen.push({ naam, pad, status: a ? a.status : 0, ok,
      waarom: ok ? null : ((a && a.data && a.data.error) || 'geen antwoord') });
    return ok ? a.data : null;
  };

  const gast = (sleutels || {}).gast || {};
  if (!gast.sleutel || !tokens || !tokens.supplier) {
    return { klaar: false, extra: {}, stappen,
      reden: 'de gastsleutel of de zaaksessie ontbreekt; zonder die twee is er geen rekening te vinden' };
  }

  /* De gast kijkt naar zijn eigen rekening. Dat is een LEESroute en hij geeft
     terug wat de zaak straks onder `rekeningId` moet aanspreken. */
  const mijn = await doe('de rekening van de tafel', '/api/gast/rekening', { sleutel: gast.sleutel }, null);
  const rekeningId = mijn && (mijn.rekeningId || (mijn.rekening && (mijn.rekening.id || mijn.rekening.rekeningId)));

  const extra = {};
  if (rekeningId) extra.rekeningId = rekeningId;
  return { klaar: !!rekeningId, stappen, extra,
    reden: rekeningId ? null : 'de gastenkant gaf geen rekening-id terug; zie stappen' };
}

module.exports = { zetHorecaKlaar };
