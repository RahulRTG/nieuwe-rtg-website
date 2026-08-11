/* WELK BTW-TARIEF HOORT BIJ DEZE VERKOOP -- op EEN plek.

   Dit stond op twee plekken en die twee waren het oneens.

     kern/fiscaal/index.js  (de maandboekhouding van de zaak) koos een
       categorie (eten/drank/logies/vervoer/jet) en zocht het percentage op in
       de landentabel van de zaak.
     kern/facturatie/motor.js (de factuur die de klant krijgt) had een lijstje
       genres in de kop staan en gaf die 9%, de rest 21% -- ZONDER naar het land
       te kijken.

   Voor een Nederlandse zaak viel dat samen en zag niemand het. Voor Sal de Mar
   op Ibiza niet: die staat op land ES, dus de boekhouding rekende met 10% (het
   Spaanse verlaagde tarief) en de bon van de gast zei 9% (het Nederlandse).
   Twee cijfers over dezelfde maaltijd, en er was geen kant waarvan je wist dat
   hij klopte. De btw-aangifte, die het factuurregister telt, kwam daardoor
   structureel anders uit dan de boekhouding van diezelfde zaak.

   Het was ook niet bij te houden. De landentabel is LEVEND: de Regelwacht
   (./regelwacht.js) legt er een herstart-vaste overlay overheen zodra een
   tarief verandert. Twee vaste getallen in een andere module lopen daar per
   definitie op achter -- die veranderen alleen als iemand ze met de hand
   naloopt, en dat is precies wat niemand doet.

   Dat is LAT.md regel 4: nooit twee plekken die een waarheid vasthouden. Vanaf
   nu vragen ze het allebei hier, en dan KUNNEN ze niet meer uiteenlopen.

   DE CATEGORIE. Wat er in de oude motor stond ('restaurant/bar/hotel/
   groothandel/boerderij krijgen het lage tarief') en wat er in de boekhouding
   stond (alles zonder kamers of ritten is 'eten') zijn hier samengevoegd tot
   een regel:

     ritten          -> 'vervoer', en voor een privejet 'jet'
     kamers          -> 'logies'
     een kaart/genre -> 'eten'      (horeca, agrarisch, groothandel)
     de rest         -> 'standaard'

   Die laatste tak is een verandering ten opzichte van de boekhouding, en het is
   een reparatie: die zette ELKE zaak zonder kamers of ritten op 'eten', dus een
   kledingwinkel rekende het lage tarief over een jas. Het lage tarief is voor
   eten en drinken, niet voor alles wat geen hotel is.

   Bar-artikelen blijven apart: alcohol valt in de meeste landen onder het
   standaardtarief, ook in een restaurant. Dat is wat `catVanItem` doet.

   De percentages zelf staan in ./landen.js en worden per peiljaar bijgewerkt;
   hier staat er niet een. */
'use strict';
const { LANDEN } = require('./landen');

// De genres die op hun kaart eten en drinken verkopen, ook als ze geen
// 'menu' hebben staan (een groothandel of boerderij levert los).
const ETEN_GENRES = ['restaurant', 'bar', 'hotel', 'horeca', 'groothandel', 'boerderij'];

// Het land van de zaak; onbekend of niet in de tabel valt terug op Nederland.
function landVan(s) {
  const code = s && s.settings && s.settings.land;
  return LANDEN[code] ? code : 'NL';
}

/* De basiscategorie van de zaak. `caps` zijn de capaciteiten uit db.capsVan;
   die worden meegegeven omdat deze module de opslag niet kent. */
function basisCat(s, caps) {
  const c = Array.isArray(caps) ? caps : [];
  if (c.includes('rides')) return (s && s.type) === 'jet' ? 'jet' : 'vervoer';
  if (c.includes('rooms')) return 'logies';
  if ((s && s.menu && s.menu.length) || ETEN_GENRES.includes(s && s.type)) return 'eten';
  return 'standaard';
}

/* De categorie van EEN artikel. Alleen de bar wijkt af van de basis: een glas
   wijn in een restaurant is geen eten. Buiten de horeca (basis is niet 'eten')
   verandert een artikel de categorie nooit. */
function catVanItem(s, naam, basis) {
  if (basis !== 'eten') return basis;
  const m = ((s && s.menu) || []).find(x => x.name === naam);
  return m && m.station === 'bar' ? 'drank' : 'eten';
}

// Het percentage: de categorie in de landentabel, anders het standaardtarief.
function tariefVan(s, cat) {
  const t = LANDEN[landVan(s)].tarieven;
  return t[cat] != null ? t[cat] : t.standaard;
}

module.exports = { landVan, basisCat, catVanItem, tariefVan, ETEN_GENRES };
