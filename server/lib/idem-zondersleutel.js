/* WERK ZONDER SLEUTEL, MET DEZELFDE BELOFTE (18 oktober 2026).

   De idem-laag (./idem.js) deed voor werk zonder sleutel `return werk()`: geen
   sleutel, dus geen bundel, dus write-behind -- ook in een laag die `duurzaam`
   had verklaard. De schrijfproef mat dat als VALS_SUCCES op
   /api/bank/rekening/open en /api/bank/pas/uitgeven: het proeflijf droeg geen
   `idem`, de rekening werd met 200 bevestigd en was na de herstart weg.

   De sleutel bepaalt of een HERHALING wordt herkend; hij bepaalt niet of de
   opslag het werk moet bevestigen. Dat laatste heeft de laag al gezegd met
   `duurzaam`, en het geldt dan voor elke aanroep. Dezelfde drie regels als
   ./duurzaam.js: een fout IN het werk blijft een fout, een eigen weigering is
   het ware antwoord (ook als de lege commit faalde), en anders wint het oordeel
   van de opslag: 503, nooit 200. Toets: test/idem-takken.test.js. */
'use strict';

/* Het ene antwoord voor "de opslag bevestigde niet", met en zonder sleutel. */
function nietVastgelegd(naam, e) {
  console.warn('[' + naam + '] niet vastgelegd:', e && e.message);
  return { status: 503, error: 'Dit is niet vastgelegd; probeer het zo nog een keer.' };
}
/* Een sleutel die in het geheugen al een nooit bevestigd antwoord draagt: weg,
   anders krijgt de herhaling dat "ok" als `herhaald` terug. */
function vergeetSleutel(s, a, sleutel) {
  if (!Object.hasOwn(s, sleutel)) return;
  delete s[sleutel]; delete a[sleutel]; s._keys = s._keys.filter(k => k !== sleutel);
}

const VERPLICHT = (waarom) => ({ status: 400, code: 'IDEMPOTENTIESLEUTEL_VERPLICHT',
  error: 'Deze opdracht verplaatst geld en vraagt een idempotentiesleutel. ' +
    'Stuur een `idem` mee en gebruik bij een herhaling dezelfde waarde.', waarom });

/* DE HELE TAK ZONDER SLEUTEL, in de volgorde die telt.

   GEEN SLEUTEL IS GEEN VERZOEK -- op de handelingen die geld verplaatsen.
   `if (!sleutel) return werk()` was ooit de hele regel: stuurt een client geen
   sleutel, dan gebeurt het werk gewoon. Voor het meeste in dit huis is dat de
   juiste afweging, maar de kale ronde van de idemproef mat achttien geldroutes
   waar een woordelijk gelijke herhaling ZONDER sleutel het werk opnieuw deed --
   /api/bank/overboek boekte twee keer, /api/bank/sepa stuurde twee keer het
   huis uit. Een dubbeltik op een trage verbinding is precies dat verzoek, twee
   keer.

   WAAROM HIER EN NIET IN DE HTTP-POORT. Daar heeft het gestaan, en het was
   fout: ./idem-poort.js draait VOOR de bewakers, dus een lid dat de rekening
   van een ander probeerde kreeg 400 in plaats van 404, en twee toetsen die
   juist die eigendomsgrens meten zagen hem niet meer. Hier staat de weigering
   NA de eigenaarscontrole van de aanroeper (zie ../kern/bank/overboeken.js:
   `if (!eigenaar(...)) return 404` staat boven de metIdem-aanroep) en VOOR het
   werk. Dat is de enige plek waar allebei waar is.

   De aanroeper verklaart het (`opties.geld`), met een reden die in de weigering
   terechtkomt. Geen lijst van paden hier: deze laag kent geen routes, en een
   tweede lijst naast de aanroepplek loopt uit elkaar. De sleutelplicht
   (`sleutelPlicht`) doet hetzelfde voor een hele laag, behalve binnen een
   lopende handeling. Daarna de vrijgavepoort voor nieuw werk, en pas dan het
   werk -- in een duurzame laag door dezelfde bundel als met sleutel. */
async function zonderSleutelPad({ opties, werk, bijeen, duurzaam, naam, sleutelPlicht, poortVoorNieuwWerk, inHandeling }) {
  if (opties && opties.geld) return VERPLICHT(String(opties.geld));
  if (typeof sleutelPlicht === 'function' && sleutelPlicht() && !inHandeling())
    return VERPLICHT('elke boeking bij het grootboek draagt een sleutel die een herhaling herkent');
  const dicht = poortVoorNieuwWerk(opties);
  if (dicht) return dicht;
  if (!(bijeen && duurzaam)) return werk();
  return zonderSleutel({ bijeen, naam, werk });
}

async function zonderSleutel({ bijeen, naam, werk }) {
  let r, fout = null;
  try { await bijeen(async () => { try { r = await werk(); } catch (e) { fout = e; } }, { duurzaam: true }); }
  catch (e) {
    if (fout) throw fout;
    if (r && r.error) return r;
    return nietVastgelegd(naam, e);
  }
  if (fout) throw fout;
  return r;
}

module.exports = { zonderSleutelPad, zonderSleutel, nietVastgelegd, vergeetSleutel };
