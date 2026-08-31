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
   tweede oproep het werk nog een keer -- blijft onaangeraakt.

   TWEE KETENS ERBIJ (31 augustus 2026), want de rekening bleek niet de enige
   wortel in dit domein. Van de 67 onbewezen horecaroutes hangen er twaalf aan
   twee andere dingen:

     de WIJK      een deel van de vloer met tafels, plus de OVERDRACHT ervan
                  aan een collega (7 routes: bied, aanvaard, weiger, gezien,
                  neem, trek-in, tafel-terug)
     het EVENT    een offerte met posten, en daarna aanbetaling, kosten en
                  nacalculatie (5 routes)

   Allebei vragen ze iets wat de route zelf noemt: een wijk zonder tafels
   bestaat niet, en "Zet minstens een post op de offerte". Die posten dragen
   `omschrijving`, `aantal` en `prijs` in EURO'S -- uitEuro() rekent ze om, dus
   een bedrag in centen meesturen zou er honderd keer te veel van maken. */
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

  const zaak = async (naam, pad, lijf) => {
    let a = null;
    try { a = await post(pad, lijf, tokens.supplier); } catch (e) { a = null; }
    const ok = a && a.status >= 200 && a.status < 300;
    stappen.push({ naam, pad, status: a ? a.status : 0, ok,
      waarom: ok ? null : ((a && a.data && a.data.error) || 'geen antwoord') });
    return ok ? a.data : null;
  };

  /* DE WIJK. Een deel van de vloer met tafels erop; zonder tafels valt er
     niets over te dragen. De tafelnummers komen uit de zaak zelf zodat de
     wijk over bestaande tafels gaat en niet over verzonnen. */
  const tafels = await zaak('de tafels van de zaak', '/api/supplier/horeca/tafels', {});
  const nummers = ((tafels && (tafels.tafels || tafels.lijst)) || [])
    .map(t => t.nummer || t.id || t.naam).filter(Boolean).slice(0, 3);
  const w = await zaak('een wijk op de vloer', '/api/supplier/horeca/wijk/zet',
    { naam: 'Proefwijk', tafels: nummers.length ? nummers : ['1'] });
  const wijkId = w && (w.wijk ? w.wijk.id : w.wijkId);
  if (wijkId) {
    extra.wijkId = wijkId; extra.wijk = wijkId;
    /* EN DE OVERDRACHT. Vier routes werken op een lopende overdracht
       ("Deze overdracht kennen we niet"), dus die moet er een zijn. Aanbieden
       is genoeg -- aanvaarden doet de collega, en dat is precies wat de proef
       straks meet. */
    const o = await zaak('de wijk aanbieden aan een collega', '/api/supplier/horeca/wijk/bied',
      { wijkId, naarNaam: 'Proefcollega', tafels: nummers.length ? nummers : ['1'] });
    const overdracht = o && o.overdracht && o.overdracht.id;
    if (overdracht) { extra.overdrachtId = overdracht; extra.overdracht = overdracht; }
  }

  /* HET EVENT. De offerte is de wortel; de prijs staat in EURO'S. */
  const ev = await zaak('een eventofferte', '/api/supplier/horeca/event/offerte',
    { naam: 'Proefevent', datum: new Date().toISOString().slice(0, 10), gasten: 20,
      contact: 'Proefcontact', ruimte: 'Zaal',
      posten: [{ omschrijving: 'Diner', aantal: 20, prijs: 45, soort: 'eten' }] });
  const eventId = ev && ev.event && ev.event.id;
  if (eventId) { extra.eventId = eventId; extra.event = eventId; }

  return { klaar: !!rekeningId, stappen, extra,
    reden: rekeningId ? null : 'de gastenkant gaf geen rekening-id terug; zie stappen' };
}

module.exports = { zetHorecaKlaar };
