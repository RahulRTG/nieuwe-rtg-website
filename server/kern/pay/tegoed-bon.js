/* DE BON ZELF (kern/pay/tegoed-bon.js): zijn vorm, zijn code, en hoe hij wordt
   opgeborgen. De handelingen -- kopen, verzilveren, terugnemen -- staan in
   ./tegoed.js (de ledenkant) en ./tegoed-zaak.js (de zaakkant); die twee delen
   alles wat hier staat.

   Waarom apart: dit is het stuk dat NIET verschilt tussen een lid en een zaak.
   Zou het in ./tegoed.js blijven staan, dan is dat bestand de eigenaar van de
   bon én van een van de twee kanten, en pakt de andere kant zijn helpers uit een
   broer -- een vorm die er pas op lijkt als je weet waar hij vandaan komt. En
   praktisch: met deze vier functies erbij ging ./tegoed.js over de grens uit
   keuringsregel 13. */
'use strict';

const REK_TEGOED = 'extern:tegoed';
const VERVAL_MS = 365 * 24 * 60 * 60 * 1000;   // een jaar; daarna haalt de koper het terug
const MAX_RIJEN = 20000;

module.exports = ({ d, save, crypto, nu }) => {
  function bonnen() { if (!Array.isArray(d().payTegoed)) d().payTegoed = []; return d().payTegoed; }

  /* De code is DRAGER van waarde: wie hem heeft, kan hem verzilveren. Twaalf
     bytes uit crypto.randomBytes (96 bits) en niet uit een teller of een tijd --
     een code die te raden is, is een wallet die openstaat. In vieren geschreven
     zodat een mens hem kan overtikken; bij het zoeken wordt de opmaak genegeerd. */
  function nieuweCode() {
    const rauw = crypto.randomBytes(12).toString('hex').toUpperCase();
    return rauw.match(/.{1,4}/g).join('-');
  }
  const normaliseer = s => String(s || '').toUpperCase().replace(/[^0-9A-F]/g, '');

  /* Een bon opbergen, met de opruiming erbij. DIE MAG NOOIT EEN OPEN BON
     RAKEN: de bon is de enige plek waar staat dat er geld van iemand in de
     escrow zit, en anders dan bij het grootboek -- waar de saldi de waarheid
     blijven en de rijen alleen weergave zijn -- is hier het weggooien van de
     rij het weggooien van de aanspraak. Een afgeronde bon is geschiedenis en
     mag van achteren af; open en bezig blijven staan, hoe oud ook. */
  function bewaar(t) {
    const rijen = bonnen();
    rijen.unshift(t);
    for (let i = rijen.length - 1; i >= 0 && rijen.length > MAX_RIJEN; i--) {
      if (rijen[i].status !== 'open' && rijen[i].status !== 'bezig') rijen.splice(i, 1);
    }
    save();
  }

  /* Wat er naar buiten gaat. `verlopen` wordt GEREKEND en niet bewaard: een
     bewaarde vlag zou moeten worden bijgewerkt door iets dat langsloopt, en dan
     hangt "is deze bon nog geldig" af van of dat iets heeft gedraaid. */
  const naarBuiten = t => ({
    id: t.id, code: t.code, centen: t.centen, oms: t.oms, status: t.status,
    van: t.van, aan: t.aan || null, at: t.at, vervalt: t.vervalt,
    verlopen: t.status === 'open' && t.vervalt < nu(),
    verzilverdDoor: t.verzilverdDoor || null, verzilverdAt: t.verzilverdAt || null
  });

  return { REK_TEGOED, VERVAL_MS, bonnen, bewaar, nieuweCode, normaliseer, naarBuiten };
};
