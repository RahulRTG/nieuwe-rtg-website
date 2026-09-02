/* ============================================================================
   DE DRIE UNIVERSA -- hoe de winkel is ingedeeld, en waarom niet op categorie.

   Een app draagt in zijn manifest een CATEGORIE (sociaal, reizen, eten, media,
   geld, spelen, leven, veiligheid). Dat is wat een app OVER GAAT, en het blijft
   staan: het is de vorm waarop een uitgever zijn app indient en waarop je zoekt.

   Wat een lezer op de voorpagina zoekt is iets anders: wat voor SOORT ding is
   dit, en hoeveel software is het? Drie afdelingen beantwoorden dat, en ze
   worden AFGELEID uit wat er al vaststaat -- niet ingevuld, niet door de
   uitgever gekozen en niet door het kantoor per app gezet:

     Essentials  kleine instrumenten van RTG zelf: geen bord, hooguit een eigen
                 potje. Wat je pakt en weer wegzet.
     Play        alles wat een arena heeft. Dat is geen smaak maar een feit uit
                 het manifest: het bord bestaat of het bestaat niet.
     Makers      software van iemand anders dan RTG. Dit is de afdeling waar het
                 ecosysteem ontstaat, en zij hoort de grootste te worden.

   WAAROM DE AFLEIDING IN DEZE VOLGORDE STAAT. Een app van een derde met een
   arena hoort bij Makers en niet bij Play: waar hij VANDAAN komt is voor een lid
   het belangrijkste onderscheid dat er is -- dat is de hele reden dat de App
   Store een eigen afdeling in de Mall heeft en geen rij in de App-Bibliotheek
   (APPSTORE.md). Zou het andersom staan, dan verdwijnt de herkomst van een app
   zodra hij toevallig een ranglijst heeft.

   ER KOMT ER GEEN VIERDE BIJ ZONDER REDEN. Enterprise, City en Experimental
   staan in SOFTWAREMARKT.md als richting; ze bestaan hier pas als er iets is dat
   erin valt. Een lege afdeling is een belofte, en een belofte zonder inhoud is
   precies wat dit huis niet doet.
   ========================================================================== */
'use strict';

/* De org van RTG zelf. Hij staat hier als LIJST en niet als vlag op een
   uitgever: een uitgever die zichzelf "van RTG" kan noemen, is een uitgever die
   zich in de etalage voor het huis kan uitgeven. */
const EIGEN_ORGS = ['O-LABS', 'O-RTG'];

const UNIVERSA = [
  { sleutel: 'essentials', naam: 'Essentials',
    uitleg: 'Kleine, precieze instrumenten van RTG zelf. Pakken, gebruiken, wegzetten.' },
  { sleutel: 'play', naam: 'Play',
    uitleg: 'Spelen met een eigen arena. Uw score blijft bij dit spel; de ranglijsten van RTG blijven ongemoeid.' },
  { sleutel: 'makers', naam: 'Makers',
    uitleg: 'Software van andere makers, in dezelfde cel als alles hier. Dit is de afdeling die hoort te groeien.' }
];

const isEigen = (org) => EIGEN_ORGS.includes(String(org || '').trim().toUpperCase());

/* De afleiding zelf. `kaart` is wat ./etalage.js maakt; er wordt niets anders
   gelezen dan wat daar al in staat. */
function universumVan(kaart) {
  const org = kaart && kaart.uitgever ? kaart.uitgever.org : null;
  if (!isEigen(org)) return 'makers';
  return kaart && kaart.arena ? 'play' : 'essentials';
}

/* De afdelingen met hun inhoud. Een LEGE afdeling gaat niet mee: een winkel die
   drie kopjes toont waarvan er twee leeg zijn, ziet eruit als een winkel die
   stuk is. */
function indeel(kaarten) {
  const uit = [];
  for (const u of UNIVERSA) {
    const apps = (kaarten || []).filter(k => universumVan(k) === u.sleutel);
    if (apps.length) uit.push(Object.assign({}, u, { apps, aantal: apps.length }));
  }
  return uit;
}

module.exports = { UNIVERSA, universumVan, indeel, isEigen, EIGEN_ORGS };
