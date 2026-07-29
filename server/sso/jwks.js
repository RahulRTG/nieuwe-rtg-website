/* ============================================================================
   De sleutelbos van een identiteitsprovider: ophalen, onthouden, en vernieuwen
   zonder dat een vreemde daarmee onze uitgaande verbindingen kan sturen.

   Providers wisselen hun ondertekensleutels regelmatig (dat hoort). Daarom
   moeten we de bos kunnen verversen. Maar "onbekende kid? dan even opnieuw
   ophalen" is een uitnodiging: wie tokens met steeds een andere verzonnen kid
   aanbiedt, laat onze server bij elke poging een verzoek naar buiten doen. Dat
   is een versterker -- de aanvaller stuurt een klein pakketje, wij doen het
   zware werk, en de provider ziet ONS als de bron.

   Daarom twee kleppen:
     - een gewone houdbaarheid (HOUDBAAR_MS): binnen die tijd niet opnieuw halen;
     - een aparte, veel kortere rem op de "onbekende kid"-verversing
       (VERVERS_RUST_MS): hoogstens een keer per periode, per provider.

   Faalt het verversen, dan houden we de OUDE bos. Een sleutel die gisteren goed
   was, is bijna altijd nog steeds goed; geen bos betekent dat niemand meer kan
   inloggen. Bij twijfel de deur op een kier, niet dicht.
   ========================================================================== */
'use strict';
const { haalJson } = require('./haal');

const HOUDBAAR_MS = 3600000;    // een uur: normale verversing
const VERVERS_RUST_MS = 60000;  // een minuut: rem op de onbekende-kid-verversing

/* Per adres: { bos, gehaald, laatstePoging }. Een gewone Map is genoeg -- het
   zijn er zoveel als er koppelingen zijn, geen bezoekers. */
const kast = new Map();

function maakBos(ophaler) {
  const haal = ophaler || haalJson;

  function geldig(bos) {
    return !!(bos && Array.isArray(bos.keys) && bos.keys.length);
  }

  async function vul(adres, nu) {
    const bos = await haal(adres);
    if (!geldig(bos)) throw new Error('De provider gaf een lege of onbruikbare sleutelbos.');
    kast.set(adres, { bos, gehaald: nu, laatstePoging: nu });
    return bos;
  }

  /* De gewone weg: uit de kast als hij vers genoeg is, anders ophalen. */
  async function bos(adres) {
    const nu = Date.now();
    const staat = kast.get(adres);
    if (staat && nu - staat.gehaald < HOUDBAAR_MS) return staat.bos;
    try { return await vul(adres, nu); }
    catch (e) {
      // liever een oude bos dan geen bos: anders ligt het inloggen plat zodra
      // de provider een minuut hapert
      if (staat) { staat.laatstePoging = nu; return staat.bos; }
      throw e;
    }
  }

  /* De uitzonderingsweg: het token noemt een kid die we niet kennen. Dat KAN
     een verse sleutel zijn -- en kan net zo goed een aanvaller zijn die ons aan
     het werk zet. Vandaar de rust-rem, en het stille "nee" als hij nog geldt. */
  async function ververs(adres) {
    const nu = Date.now();
    const staat = kast.get(adres);
    if (staat && nu - staat.laatstePoging < VERVERS_RUST_MS) return staat.bos;
    if (staat) staat.laatstePoging = nu;
    try { return await vul(adres, nu); }
    catch (e) { if (staat) return staat.bos; throw e; }
  }

  return { bos, ververs };
}

/* Voor tests en voor het opnieuw inlezen van een gewijzigde koppeling. */
function leeg(adres) { if (adres) kast.delete(adres); else kast.clear(); }

module.exports = { maakBos, leeg, HOUDBAAR_MS, VERVERS_RUST_MS };
