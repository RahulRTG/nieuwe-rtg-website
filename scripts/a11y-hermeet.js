/* WIE IETS VINDT, MEET NOG EEN KEER.

   De raakvlakronde deed dit al: een scherm dat binnenkomt met een
   schaal-animatie staat 600ms na load op 99,827%, en dan meet een knop van
   precies 24 pixels er 23,96. Dat is een moment en geen maat.

   De contrast- en structuurronde deed het NIET, en dat maakte de poort
   onbetrouwbaar in plaats van streng. Zo kwam het aan het licht: twee volledige
   scans op dezelfde code gaven twee verschillende uitkomsten. De ene meldde
   `small "KOMPAS"` op /apps/horloge.html in de ZAAK-ronde (1,47:1 op
   rgb(107,107,107)), de andere hetzelfde element op /apps/reizen-veilig.html in
   de INGELOGDE ronde (3,15:1 op rgb(239,239,239)). Ander scherm, andere ronde,
   andere grond. Diezelfde pagina daarna twaalf keer op rij gemeten met precies
   dezelfde keuring en dezelfde 600ms: twaalf keer nul.

   WAT ER GEBEURT. `achtergrond()` klimt omhoog tot een ONDOORZICHTIGE grond.
   Heeft de pagina zijn eigen achtergrond nog niet geverfd -- en dat komt voor
   als er 1300 pagina's achter elkaar door een gedeelde page-instantie gaan --
   dan loopt die klim door tot iets erboven, en wordt er gemeten tegen een grond
   die er een tel later niet meer is. Een gedeelde component die zich vroeg in
   de balk hangt (de Rahul-tab) is daardoor de eerste die het laat zien.

   DIT VERZWAKT DE POORT NIET. Een ECHTE fout meldt zich in de tweede meting
   gewoon weer -- daar verandert de grond niet meer. Gemeten met een blijvend te
   bleke regel (eerste 1, tweede 1) naast een regel die zijn grond alsnog kreeg
   (eerste 1, tweede 0); test/a11y-hermeet.e2e.js houdt allebei vast. Wat het
   weghaalt is de ruis die een poort leert om genegeerd te worden.

   WACHTEN TOT ALLE ANIMATIES UIT ZIJN was de eerste poging in de raakvlakronde
   en die kostte te veel: op de meeste schermen loopt er altijd iets (de
   wereldklok tikt), dus liep bijna elke pagina tegen de tijdgrens en werd de
   ronde drie keer zo traag. Een tweede meting kost alleen iets op de schermen
   die iets vinden, en dat zijn er hopelijk nul.

   EEN PLEK, TWEE RONDEN. Deze routine stond als kopie in de raakvlakronde; de
   contrastronde had hem niet. Een rekensom hoort op een plek te wonen (LAT
   regel 4), zeker als de tweede kopie er nooit gekomen is. */
'use strict';

const STIL_MS = 1500;   // hoe lang we hoogstens op de animaties wachten
const RUST_MS = 300;    // en de tel daarna, zodat de laatste verf droog is

module.exports = async function hermeet(page, bron, vondIets) {
  let res = await page.evaluate(bron);
  if (!vondIets(res)) return res;
  try {
    await page.waitForFunction(
      () => !document.getAnimations || document.getAnimations().every(a => a.playState !== 'running'),
      null, { timeout: STIL_MS });
  } catch (e) { /* een scherm dat blijft bewegen keuren we zoals het staat */ }
  await page.waitForTimeout(RUST_MS);
  // mislukt de tweede meting, dan blijft de eerste staan: nooit stil niets melden
  try { return await page.evaluate(bron); } catch (e) { return res; }
};
