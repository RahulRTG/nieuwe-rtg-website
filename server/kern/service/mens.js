/* ============================================================================
   "IK WIL EEN MENS" -- als contract, niet als beleefdheid.

   WAT HIER STOND EN WAAROM HET NIET GOED WAS.

   kern/ai.js zette voor de RTG Pass letterlijk `md.needsConcierge = false`. Dat
   was geen bug: het was de merkregel "RTG Pass = volledig AI-gedreven
   klantcontact", eerlijk uitgevoerd. Maar het gevolg was dat een RTG-lid via
   de chat NOOIT bij een mens uitkwam, terwijl er wel degelijk een mens voor hem
   bestaat -- de ledenbalie helpt elk lid, ook een RTG-lid. Alleen kon hij daar
   niet zelf komen: iemand van het kantoor moest hem toevallig opzoeken.

   Dat is het echte gebrek. Niet dat er geen mens is, maar dat de melder de
   enige is die niet bij hem kan.

   HET ONDERSCHEID DAT DIT BESTAND MAAKT, EN DAT DE MERKREGEL HEEL LAAT:

     DE RECHTERHAND is uitvoering. Iemand doet iets VOOR u -- een tafel boeken,
     een cadeau regelen. Dat is een gekochte dienst en die blijft bij Lifestyle
     en Business. Deze module deelt hem aan niemand anders uit.

     EEN MENS BIJ EEN PROBLEEM is service. Iets werkt niet, en er moet een mens
     naar kijken. Dat is geen product maar een ondergrens, en die geldt voor elk
     lid met een account.

   Twee verschillende dingen die allebei "een mens" heten. Zolang ze op een hoop
   lagen, betekende "de RTG Pass krijgt geen concierge" per ongeluk ook "de RTG
   Pass krijgt geen mens".

   DE NORM, MECHANISCH GESTELD:

     Iedere identiteit waarvoor menselijke hulp bestaat, moet die hulp
     zelfstandig kunnen aanvragen vanuit een kanaal dat zij al heeft.

   `test/servicemens.test.js` houdt dat vast voor elke pas, zodat een volgende
   ronde het niet per ongeluk terugdraait.

   EN DE VIERDE KEER. Wie drie keer om een mens vraagt, krijgt geen vierde
   afwerende dialoog. Dat is hier geen stijlvoorschrift maar een teller: ./zaak.js
   noteert elk verzoek in de tijdlijn, en `afwerenMag()` wordt vanaf drie keer
   `false`. Een AI die daarna alsnog "kan ik het eerst zelf proberen?" zegt, is
   dus niet onbeleefd -- hij overtreedt een regel die te toetsen is.
   ========================================================================== */
'use strict';

const { pasVan } = require('../passen');

/* Per pas: bestaat er een mens, langs welke weg, en hoe heet die weg naar de
   melder toe? De derde kolom is geen sier: "wij zetten u door naar De
   Rechterhand" tegen een RTG-lid is een belofte die niemand kan waarmaken. */
const PER_PAS = {
  gratis: {
    mens: true, team: 'leden', weg: 'ledenbalie',
    heet: 'een medewerker van RTG',
    waarom: 'Ook zonder pas hoort een account waar iets misgaat door een mens te worden bekeken.'
  },
  rtg: {
    mens: true, team: 'leden', weg: 'ledenbalie',
    heet: 'een medewerker van RTG',
    waarom: 'Rahul is de eerste lijn van de RTG Pass. Lost hij het niet op, dan kijkt er een mens naar.'
  },
  lifestyle: {
    mens: true, team: 'concierge', weg: 'concierge',
    heet: 'De Rechterhand',
    waarom: 'De Lifestyle Pass loopt langs een menselijke concierge.'
  },
  business: {
    mens: true, team: 'concierge', weg: 'concierge',
    heet: 'uw vaste contactpersoon',
    waarom: 'De Business Pass loopt langs een menselijke lijn.'
  }
};

/* Een melder ZONDER account. Hier is het eerlijke antwoord "nee", en het staat
   uitgeschreven in plaats van dat het per ongeluk uit een lege tabel volgt:
   er is geen kanaal om iemand terug te bereiken, dus een toezegging zou een
   wachtrij vullen waar niemand ooit uit komt. */
const GEEN_ACCOUNT = {
  mens: false, team: null, weg: null, heet: null,
  waarom: 'Zonder account is er geen kanaal waarop RTG u kan terugvinden. Meld u aan, dan kan het wel.'
};

/* Hoe vaak iemand mag vragen voordat afweren ophoudt te mogen. Drie, want een
   keer kan een misverstand zijn en twee keer kan een herhaling zijn; bij drie
   is het een besluit. */
const AFWEER_GRENS = 3;

/* De kern van dit bestand. `tier` is de sessie-tier ('guest', 'rtg', ...).
   Geeft altijd dezelfde vorm terug, ook bij nee -- een aanroeper die moet
   raden of hij een object of null krijgt, gaat vroeg of laat de nee-tak
   overslaan. */
function overname(tier, { ingelogd = true } = {}) {
  if (!ingelogd) return Object.assign({ pas: null, rechtstreeks: false }, GEEN_ACCOUNT);
  const pas = pasVan(tier);
  const r = PER_PAS[pas] || PER_PAS.rtg;
  return {
    pas,
    mens: r.mens,
    /* Dit veld IS de norm. Het staat los van `mens` omdat de fout die hersteld
       wordt precies daartussen zat: er was een mens, en de melder kon hem niet
       vragen. */
    rechtstreeks: r.mens,
    team: r.team,
    weg: r.weg,
    heet: r.heet,
    waarom: r.waarom
  };
}

/* De intentie. Vier manieren om hetzelfde te vragen leveren hetzelfde op --
   dat was de opdracht, en daarom is dit een lijst en geen model: een melder
   die om een mens vraagt, hoort niet afhankelijk te zijn van of er die dag een
   AI-sleutel is.

   Bewust ruw. Hij mag vals-positief zijn ("ik werk zelf ook met mensen") en dat
   is de goedkoopste fout van de twee: te veel doorzetten kost een medewerker
   een blik, te weinig doorzetten kost een melder zijn vertrouwen. */
const WOORDEN = [
  'een mens', 'echt mens', 'echte persoon', 'een persoon', 'medewerker', 'iemand spreken',
  'iemand van rtg', 'geen ai', 'geen bot', 'geen robot', 'met iemand praten', 'doorverbinden',
  'menselijke', 'human', 'real person', 'agent spreken', 'klantenservice bellen'
];
function vraagtOmMens(tekst) {
  const t = String(tekst || '').toLowerCase().replace(/\s+/g, ' ');
  if (!t) return false;
  return WOORDEN.some(w => t.includes(w));
}

/* Mag de AI hier nog een afwerende beurt tegenover zetten? `verzoeken` is het
   aantal keren dat deze melder er in DEZE zaak om vroeg. */
const afwerenMag = (verzoeken) => Number(verzoeken || 0) < AFWEER_GRENS;

/* Wat de melder te horen krijgt bij een geslaagde overdracht. Staat hier en
   niet in een route, omdat "wij zetten u door" en "wij blijven ondertussen
   kijken" samen een belofte zijn: de tweede helft is wat voorkomt dat de
   overdracht voelt als opnieuw beginnen. */
function belofte(o) {
  if (!o.mens) return o.waarom;
  return 'Natuurlijk. Wij zetten dit door naar ' + o.heet + '. ' +
    'Ondertussen kijkt RTG alvast wat er aan de hand is, zodat u het straks niet opnieuw hoeft uit te leggen.';
}

module.exports = { PER_PAS, GEEN_ACCOUNT, AFWEER_GRENS, overname, vraagtOmMens, afwerenMag, belofte };
