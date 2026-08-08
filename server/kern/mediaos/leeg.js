/* Media OS (deelmodule): DE LEGE STAND, EN WAT ER DAN WEL STAAT.

   Een verse installatie is hier écht leeg, en dat is geen defect: alle vier de
   vormen bestaan uit werk van LEDEN. Er staat pas muziek als iemand iets
   uitgeeft, pas video als een kanaal is goedgekeurd en de bytes binnen zijn,
   pas korte video als iemand er een maakt, en pas live als er iemand uitzendt.

   WAT EEN LEEG RASTER FOUT DOET. Het ziet eruit als een app die stuk is, en
   het zegt niet waarom. Twee lezers krijgen hetzelfde beeld terwijl er twee
   verschillende dingen aan de hand zijn: "er is nog niets gemaakt" en "u mag
   er niet bij" (het Podium eist een geverifieerd paspoort). Dat verschil hoort
   op het scherm te staan, met de stap die het opheft.

   WAT HIER NIET KOMT. Geen nepkaarten om het vol te laten lijken, en geen
   uitnodiging om "vast te beginnen" met iets dat niet werkt. Elke stap
   hieronder gaat naar een scherm dat bestaat en waar de handeling echt kan.
   Waar RTG zelf iets kan leveren doet hij dat ook: de vijf uitgegeven stukken
   in de demo-installatie komen uit de eigen klankmotor (server/seed/media.js),
   en dat is de enige vorm die dit huis zonder een lid kan vullen. */
'use strict';

/* Per stand: wat er komt, waarom het er nu niet is, en wat u zelf kunt doen.
   De teksten staan hier en niet in het scherm, omdat de reden soms van de
   GEGEVENS afhangt (een dichte bron zegt iets anders dan een lege bron) en
   die kennis hoort niet in twee talen op twee plekken te bestaan. */
const STANDEN = {
  muziek: {
    titel: 'Hier komt muziek van leden te staan',
    wat: 'Stukken die leden in RTG Klankwerk maken en uitgeven. Een uitgave reist als getallen, niet als bestand: uw eigen toestel rekent hem uit met dezelfde motor waarmee de maker hem hoorde.',
    stappen: [
      { tekst: 'Maak zelf iets in het Klankwerk', pad: '/apps/klankwerk.html' },
      { tekst: 'Kijk in De Zaal wat er is uitgegeven', pad: '/apps/zaal.html' }
    ]
  },
  kijk: {
    titel: 'Hier komen video en live te staan',
    wat: 'Video uit RTG Theater (een kanaal gaat pas open nadat een mens bij het kantoor het heeft goedgekeurd) en livekanalen van het Podium.',
    stappen: [
      { tekst: 'Meld een eigen kanaal aan bij het Theater', pad: '/apps/theater.html' },
      { tekst: 'Bekijk het Podium', pad: '/apps/podium.html' }
    ]
  },
  flow: {
    titel: 'Hier komen korte video’s te staan',
    wat: 'Korte verticale video’s van leden. Het beeld blijft op het toestel van de maker en reist rechtstreeks naar u; RTG heeft die bytes niet. Daarom staat hier alleen iets als er ook iemand is die het uitdeelt.',
    stappen: [
      { tekst: 'Neem er zelf een op in Clips', pad: '/apps/clips.html' }
    ]
  },
  alles: {
    titel: 'Uw mediawereld is nog leeg',
    wat: 'Muziek, video, korte video en live komen hier bij elkaar zodra leden er iets neerzetten -- ook uzelf.',
    stappen: [
      { tekst: 'Maak muziek in het Klankwerk', pad: '/apps/klankwerk.html' },
      { tekst: 'Neem een korte video op in Clips', pad: '/apps/clips.html' },
      { tekst: 'Meld een kanaal aan bij het Theater', pad: '/apps/theater.html' }
    ]
  }
};

/* De uitslag draagt de reden die op DIT moment geldt. Er zijn er drie, en ze
   vragen alle drie iets anders van de lezer:
   - 'niets': er is nog niets gemaakt -> maak zelf iets, of wacht;
   - 'deur': de bron laat u er niet in (18+, paspoort) -> die deur openen;
   - 'ikzelf': u heeft alles weggefilterd -> uw eigen regelaars terugdraaien. */
function legeStand(modusNaam, buiten, weggelaten, vormen) {
  const basis = STANDEN[modusNaam] || STANDEN.alles;
  /* ALLEEN de bronnen die in DEZE stand horen. Zonder dit filter kreeg een lege
     FLOW de reden van het Podium te lezen ("activeer eerst uw paspoort") --
     terwijl live daar helemaal niet in staat. Een scherm dat vriendelijk de
     verkeerde oorzaak noemt, stuurt iemand een deur openen die er niet toe
     doet; dat is erger dan geen reden geven. */
  const hoortErbij = Array.isArray(vormen) ? vormen : Object.keys(STANDEN);
  const dicht = (buiten || []).filter(b => b.reden && hoortErbij.includes(b.vorm));
  const eigen = (weggelaten || []).length;
  let reden = 'niets', waarom = 'Er staat nog niets van andere leden, en van uzelf ook nog niet.';
  if (eigen) {
    reden = 'ikzelf';
    waarom = 'Alles wat hier stond, staat op uw eigen "nooit"-lijst (' + eigen +
      (eigen === 1 ? ' stuk' : ' stukken') + '). Dat kunt u hieronder terugdraaien.';
  } else if (dicht.length) {
    reden = 'deur';
    waarom = dicht.map(b => b.vormNaam + ': ' + b.reden).join(' ');
  }
  return { titel: basis.titel, wat: basis.wat, reden, waarom, stappen: basis.stappen };
}

module.exports = { legeStand, MEDIA_LEEG_STANDEN: STANDEN };
