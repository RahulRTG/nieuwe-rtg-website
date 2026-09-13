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
   (./regelwacht.js) legt er zodra een tarief verandert een jaargang op
   (./jaargangen.js) en projecteert de stand van vandaag op de tabel. Twee vaste
   getallen in een andere module lopen daar per definitie op achter -- die
   veranderen alleen als iemand ze met de hand naloopt, en dat is precies wat
   niemand doet.

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
  /* DE CAP VOOR KAMERS HEET `bookings` EN HEEFT NOOIT `rooms` GEHETEN.
     Hier stond `c.includes('rooms')`, en die cap bestaat niet: geen van de 73
     genres draagt hem en kern/werkvormen.js maakt hem nergens aan. De tak was
     dus dood, en 'logies' onbereikbaar -- terwijl de kop van dit bestand
     "kamers -> 'logies'" belooft.

     Wat er in plaats daarvan gebeurde: een hotel viel door naar 'eten' (het
     staat in ETEN_GENRES) en een appartement, villa of wintersportresort naar
     'standaard'. Gemeten op 27 augustus 2026, met de echte genrelijst en de
     echte landentabel:

       appartement NL   21% gerekend, 9% verschuldigd
       villa NL         21% gerekend, 9% verschuldigd
       hotel DE         19% gerekend, 7% verschuldigd
       hotel BE         12% gerekend, 6% verschuldigd

     Een verblijfszaak rekende dus te veel btw over een overnachting, in het
     grootste geval meer dan het dubbele. `s.rooms` bestaat wel -- dat is het
     VELD met de kamers, en daaruit leidt werkvormen.js juist `bookings` af.
     Een veldnaam die als capnaam werd gelezen; gevonden doordat PLATFORM.md
     `rooms` als voorbeeld-cap noemde en test/genrecap.test.js elke genoemde cap
     sindsdien tegen het register houdt. */
  if (c.includes('bookings')) return 'logies';
  if ((s && s.menu && s.menu.length) || ETEN_GENRES.includes(s && s.type)) return 'eten';
  return 'standaard';
}

/* De categorie van EEN artikel. Alleen de kaart wijkt af van de basis: een glas
   wijn in een restaurant is geen eten, en een biertje in een hotelbar is geen
   overnachting.

   DIE TWEEDE TAK IS NIEUW, en hij hoort bij de reparatie hierboven. Zolang
   'logies' onbereikbaar was, kwam een hotel met een kaart altijd op basis
   'eten' uit en deed deze functie haar werk. Zodra een hotel wél 'logies'
   krijgt, zou zonder deze tak ELK artikel op de rekening het logiestarief
   krijgen -- in Nederland een pils van 21% naar 9%. Een reparatie die een
   andere fout maakt is geen reparatie.

   Buiten 'eten' en 'logies' verandert een artikel de categorie nooit: wat aan
   boord van een privejet wordt geschonken volgt het tarief van de vlucht, en
   dat is een fiscale keuze die hier niet stilletjes omgegooid wordt. */
/* DE WERKPLEK VAN DE VERKOCHTE REGEL, EN WAAROM DIE MEE MAG REIZEN.

   Deze functie zocht het gerecht op NAAM in de kaart van VANDAAG. Het bedrag
   van een verkoop staat vast op het moment van verkopen, en het btw-TARIEF
   komt uit de tabel van de transactiedag (`regelbron.tariefOp`) -- maar de
   CATEGORIE werd elke keer opnieuw afgeleid uit de huidige menukaart. Haalde
   een zaak een drankje van de kaart, dan vond deze functie het niet meer, viel
   terug op de basiscategorie van de zaak, en verhuisde de AL VERKOCHTE omzet
   van de drankpot (21%) naar de etenpot (9%).

   Gemeten met scripts/omzetproef.js op 13 september 2026: vier koffies van
   EUR 5 stonden voor de menuwijziging op drank@21% = 20,00 en erna op 0,00.
   De maand van de zaak veranderde dus door een handeling die niets met die
   maand te maken had -- ook als de aangifte er al over was gedaan.

   DE OPLOSSING IS DE REGEL ZELF, EN NIET DEZE FUNCTIE. Wie hier een
   kaart-met-geschiedenis zou bouwen, verplaatst het probleem: de vraag is niet
   "hoe zag de kaart eruit" maar "wat is er verkocht". De bestelregel draagt
   daarom sinds diezelfde dag zijn eigen `station` (kern/lidacties/bestellen.js),
   precies zoals hij zijn eigen `price` draagt, en die wint hier van de kaart.

   WAT HIERMEE NIET IS OPGELOST, en dat hoort er hardop bij: `basisCat` leest
   nog steeds de capaciteiten van de zaak zoals ZIJ VANDAAG zijn. Een zaak die
   van genre verandert, verplaatst daarmee nog altijd haar eigen verleden. Dat
   is zeldzamer en het is een ander besluit; het staat als grens in
   OMZETPROEF.json en niet stilzwijgend hier. */
function catVanItem(s, naam, basis, regel) {
  if (basis !== 'eten' && basis !== 'logies') return basis;
  /* De werkplek die MET de verkoop is vastgelegd gaat voor. `undefined` is hier
     geen 'keuken': een oude regel zonder veld hoort de kaart te blijven lezen,
     anders zou deze reparatie alle historische drankomzet naar eten schuiven --
     precies de fout die zij bestrijdt, dan in een keer voor alles wat er al
     staat. */
  const werkplek = regel && typeof regel.station === 'string' ? regel.station : null;
  if (werkplek) return werkplek === 'bar' ? 'drank' : 'eten';
  const m = ((s && s.menu) || []).find(x => x.name === naam);
  if (!m) return basis;
  return m.station === 'bar' ? 'drank' : 'eten';
}

/* HET PERCENTAGE UIT EEN TARIEVENTABEL: de categorie, anders het
   standaardtarief. Los van `tariefVan` omdat er twee tabellen zijn die
   dezelfde vraag krijgen -- de LOPENDE tabel (hieronder) en een
   TERUGGEREKENDE tabel van een datum in het verleden (kern/fiscaal/
   jaargangen.js, tariefOp). Die terugval op `standaard` twee keer opschrijven
   is twee plekken die dezelfde waarheid vasthouden, en dan rekent de
   herbouw van een oud bedrag ooit net anders dan het bedrag zelf. */
function uitTabel(tarieven, cat) {
  const t = tarieven || {};
  return t[cat] != null ? t[cat] : t.standaard;
}

// Het percentage voor deze zaak, uit de tabel zoals hij NU geldt.
function tariefVan(s, cat) {
  return uitTabel(LANDEN[landVan(s)].tarieven, cat);
}

module.exports = { landVan, basisCat, catVanItem, tariefVan, uitTabel, ETEN_GENRES };
