/* HET BETROUWBAARHEIDSNIVEAU: hoe zeker weet RTG dat dit deze mens is?

   Een dienst die om "18 of ouder" vraagt, vraagt eigenlijk twee dingen: het
   feit, en hoe hard dat feit is. Tot nu toe kreeg hij alleen het feit. Het
   verschil tussen "dit lid heeft zelf een geboortedatum ingetypt" en "RTG heeft
   het paspoort gezien en het gezicht ernaast gelegd" bestond wel in de gegevens
   (`user.verified`, `md.faceMatch`), maar had geen naam -- en wat geen naam
   heeft, kan een dienst niet als eis stellen.

   DIT VOEGT NIETS TOE AAN DE INTAKE, en dat is het hele ontwerp. Er wordt niets
   nieuws gevraagd, niets nieuws bewaard en er komt geen tweede keuring. Deze
   module LEEST wat de identiteitslaag al weet en geeft het een naam, zodat een
   dienst kan zeggen "hiervoor wil ik minstens A3" in plaats van zelf te gaan
   raden aan de hand van velden die hij niet hoort te zien.

   DE TREDEN KOMEN UIT DE WERKELIJKHEID EN NIET UIT EEN NORM. Elke trede
   hieronder is een stand die dit huis echt kan onderscheiden; er is met opzet
   geen trede verzonnen waar de code geen bewijs voor heeft. Een niveau dat
   niemand kan halen is erger dan een niveau dat ontbreekt -- dan staat er een
   eis in een lijst waar nooit iets aan voldoet, en gaat iemand hem afzwakken.

   ZUIVER: sleutel- en kluisvrij. Wat er in gaat is wat de identiteitslaag al
   heeft; wat eruit komt is een trede. Wie de gegevens ophaalt, blijft de laag
   die ze bezit. */

'use strict';

/* De treden, van los naar hard. `rang` is de enige volgorde die telt; de
   letters zijn de naam waarmee een dienst hem opschrijft. */
const NIVEAUS = [
  { id: 'A0', rang: 0, naam: 'Geen account',
    uitleg: 'Een gast of demo-persona. Er is geen dossier, dus er valt niets te bevestigen.' },
  { id: 'A1', rang: 1, naam: 'Eigen account',
    uitleg: 'Een echt RTG-account met een eigen inlog. Wat dit lid over zichzelf opgaf, is niet gecontroleerd.' },
  { id: 'A2', rang: 2, naam: 'Bewijs ingediend',
    uitleg: 'Het identiteitsbewijs ligt bij RTG en wordt beoordeeld. Nog niet goedgekeurd.' },
  { id: 'A3', rang: 3, naam: 'Paspoort gecontroleerd',
    uitleg: 'RTG heeft het identiteitsbewijs gezien en goedgekeurd. Geboortedatum en nationaliteit komen daaruit.' },
  { id: 'A4', rang: 4, naam: 'Paspoort en gezicht',
    uitleg: 'Naast het bewijs is de selfie naast het document gelegd: het paspoort hoort aantoonbaar bij deze persoon.' }
];
const OP_ID = new Map(NIVEAUS.map(n => [n.id, n]));

/* De trede van een lid, uit wat de identiteitslaag al weet.

   `account` is er om A0 van A1 te scheiden: zonder eigen account is er geen
   dossier, en dan zegt een verificatiestand niets. Een AFGEWEZEN bewijs valt
   terug op A1 en niet op A0 -- het account bestaat gewoon, alleen het bewijs
   deugde niet, en dat lid mag het opnieuw proberen. */
function niveauVan({ account, verified, faceMatch } = {}) {
  if (!account) return OP_ID.get('A0');
  const v = String(verified || 'unverified');
  if (v === 'verified') return OP_ID.get(faceMatch ? 'A4' : 'A3');
  if (v === 'pending') return OP_ID.get('A2');
  return OP_ID.get('A1');
}

/* Haalt deze trede de gevraagde? Zonder eis haalt alles hem: een dienst die
   niets vraagt, krijgt geen drempel opgelegd die hij niet heeft gesteld.

   Een ONBEKENDE eis haalt het nooit. Dat is met opzet streng: een dienst die
   'A9' of een typefout opschrijft, hoort een dichte deur te vinden en geen
   stilzwijgend doorlaten -- anders is een verkeerd gespelde eis precies zo goed
   als geen eis. */
function voldoet(niveau, minimum) {
  if (!minimum) return true;
  const eis = OP_ID.get(String(minimum));
  if (!eis) return false;
  const heb = OP_ID.get(String(niveau && niveau.id ? niveau.id : niveau));
  return !!heb && heb.rang >= eis.rang;
}

const bestaat = id => OP_ID.has(String(id));

module.exports = { NIVEAUS, niveauVan, voldoet, bestaat };
