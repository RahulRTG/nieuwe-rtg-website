/* Functiecatalogus, deel "domeinen 2": het tweede blok domeinschakelaars.

   Zelfde bedoeling en zelfde regels als ./cat-domeinen.js -- zie de kop daar
   voor het waarom. Opgeknipt omdat een catalogusdeel met alle domeinen erin
   door de 10 KB van keuringsregel 13 ging; die grens staat er niet voor de
   sier, maar omdat een bestand dat je niet meer in een keer kunt lezen ook
   niet meer in een keer wordt nagekeken. */
const { DOELGROEPEN, LEDEN, LEDEN_RTF } = require('./doelgroepen');
const ALLE = DOELGROEPEN.map(d => d.id).filter(d => d !== 'intern');
const LEDEN_GAST = ['rtg', 'lifestyle', 'business', 'gast'];

module.exports = [
  { id: 'dom-rtfkantoor', categorie: 'RTFoundation', naam: 'Het RTF-kantoor', standaard: true, doelgroepen: ['foundation'],
    uitleg: 'Het eigen kantoor van de stichting: kamers, clubs en het onderzoekslab.', paden: ['/api/rtfkantoor'] },
  { id: 'dom-rtfos', categorie: 'RTFoundation', naam: 'Foundation OS', standaard: true, doelgroepen: ['foundation'],
    uitleg: 'Steden, partnerstichtingen, projecten, vrijwilligers, geld, hulpvragen en verantwoording.', paden: ['/api/rtfos'] },
  /* DE VOORDEUR VAN DE BESCHERMZAAK STAAT APART VAN 'dom-rtfos', en dat is geen
     ordening maar een besluit dat zichtbaar hoort te zijn. Achter deze vier
     routes begint een mens ZELF een zaak over geweld of uitbuiting: zonder
     account, zonder BSN, zonder adres. Hij hoort in de kast omdat een deur die
     niemand in de boardroom ziet, ook niet per stad open of dicht kan -- en dat
     is precies hoe hij bedoeld is: alleen open waar een stad de zaak kan
     oppakken.

     WIE HEM UITZET, ZET EEN HULPDEUR DICHT. Dat mag een besluit zijn, maar het
     hoort er een te zijn die iemand met naam neemt. Vandaar deze uitleg en niet
     alleen een regel. */
  { id: 'dom-beschermdeur', categorie: 'RTFoundation', naam: 'Voordeur beschermzaak (zonder account)', standaard: true, doelgroepen: ['foundation'],
    uitleg: 'De eigen ingang naar hulp bij geweld en uitbuiting: eerst "ben je nu veilig", dan pas de rest, en een code ' +
      'die de mens zelf weer kan intrekken. Zonder inlog, want wie hier aanklopt heeft vaak geen account. Uitzetten sluit ' +
      'die deur; de wegwijzer toont dan dat er geen plaats is die dit oppakt.',
    paden: ['/api/bescherming/deur'] },
  { id: 'dom-lab', categorie: 'RTFoundation', naam: 'Het Onderzoekslab', standaard: true, doelgroepen: ['foundation'],
    uitleg: 'Projecten, fases, bevindingen en de kennisbank van het lab.', paden: ['/api/lab'] },
  /* Het Living Lab staat als TWEE schakelaars in de kast, en dat is met opzet.
     De kantoorkant en de bewonerskant zijn hier echt verschillende deuren: de
     eerste zit achter de kantoorinlog, de tweede staat open op een labpas of
     helemaal zonder code. Een lab dat zijn publieke kant even wil sluiten (een
     gemeente die eerst het beleid rond wil hebben, een stad waar het nog niet
     loopt) moet dat kunnen doen zonder het onderzoek zelf plat te leggen --
     en omgekeerd. Eén schakelaar over allebei had die keuze onmogelijk gemaakt. */
  { id: 'dom-livinglab', categorie: 'RTFoundation', naam: 'Het RTF Living Lab', standaard: true, doelgroepen: ['foundation'],
    uitleg: 'De onderzoekscyclus, de ethieklaag, de bewijsmotor, de apparatuur en de pijplijn naar verandering.',
    paden: ['/api/lab2'] },
  { id: 'dom-livinglab-bewoner', categorie: 'RTFoundation', naam: 'Living Lab: de bewonerskant', standaard: true, doelgroepen: ALLE,
    uitleg: 'Meedoen met een labpas, een onderzoeksvraag aandragen, stemmen en het labpaspoort.',
    paden: ['/api/lab2/bewoner', '/api/lab2/mijn'] },
  { id: 'dom-labfonds', categorie: 'RTFoundation', naam: 'Het labfonds', standaard: true, doelgroepen: ['foundation'],
    uitleg: 'De financiering van onderzoeksprojecten.', paden: ['/api/labfonds'] },
  { id: 'dom-samen', categorie: 'RTFoundation', naam: 'Samen (stadsraad)', standaard: true, doelgroepen: ['foundation'],
    uitleg: 'De gezamenlijke uitslagen en besluiten met stadspartners.', paden: ['/api/samen'] },
  { id: 'dom-les', categorie: 'RTFoundation', naam: 'Klaslokaal (lesmaker)', standaard: true, doelgroepen: ['foundation'],
    uitleg: 'De live les: klascode, vragen en antwoorden.', paden: ['/api/les'] },
  { id: 'dom-leerstof', categorie: 'RTFoundation', naam: 'Leerstof', standaard: true, doelgroepen: ['foundation'],
    uitleg: 'Het lesmateriaal achter het onderwijs.', paden: ['/api/leerstof'] },
  { id: 'dom-onderwijs', categorie: 'RTFoundation', naam: 'Onderwijs (paspoort en ladder)', standaard: true, doelgroepen: ['foundation'],
    uitleg: 'Inschrijven, het leerpaspoort en de leerladder.', paden: ['/api/onderwijs'] },

  // ---------- winkel, media en opslag ----------
  { id: 'dom-mall', categorie: 'Winkel en media', naam: 'De Mall', standaard: true, doelgroepen: LEDEN_GAST,
    uitleg: 'De etages en de gids met alle partners.', paden: ['/api/mall'] },
  /* HET DERDENKANAAL STAAT ALS TWEE SCHAKELAARS IN DE KAST, om dezelfde reden
     als het Living Lab hierboven: de winkelkant en de uitgeverskant zijn echt
     verschillende deuren, met verschillende mensen erachter.

     Gaat de WINKEL dicht, dan kan een lid geen app van derden meer openen,
     kopen of machtigen -- maar een uitgever kan wel blijven inzenden en RTG kan
     blijven keuren, zodat er iets klaarstaat als de deur weer open gaat. Gaat
     de UITGEVERSKANT dicht, dan komt er niets meer binnen terwijl alles wat al
     is toegelaten gewoon blijft werken. Een schakelaar over allebei had die
     keuze onmogelijk gemaakt, en juist bij code van een DERDE wil je hem
     hebben: dit is de enige laag in dit huis waar de code niet van ons is.

     Ze staan hier en niet alleen in de aanbouw omdat dit een besluit van de
     boardroom hoort te zijn en geen wijziging in een bestand. Een geldstroom
     zonder noodknop is precies wat het Controleregister eruit hoort te halen --
     en dat deed het ook: deze twee vullen het laatste economie-gat. */
  { id: 'dom-appstore', categorie: 'Winkel en media', naam: 'App Store (apps van derden)', standaard: true, doelgroepen: LEDEN_GAST,
    uitleg: 'De winkelkant van het derdenkanaal: bladeren, installeren, machtigen, kopen en openen in de cel. Zet dit uit en er draait geen enkele app van een derde meer; wat al is toegelaten blijft staan.', paden: ['/api/appstore'] },
  { id: 'dom-appstore-uitgever', categorie: 'Winkel en media', naam: 'App Store: inzenden door uitgevers', standaard: true, doelgroepen: ALLE,
    uitleg: 'De uitgeverskant: een organisatie vraagt een uitgeversplek aan en zendt een app in. Zet dit uit en er komt niets nieuws binnen, terwijl de winkel gewoon doorloopt.', paden: ['/api/appstore/uitgever'] },
  { id: 'dom-bestanden', categorie: 'Winkel en media', naam: 'Bestanden (kluis)', standaard: true, doelgroepen: LEDEN_RTF,
    uitleg: 'De persoonlijke bestandenkluis.', paden: ['/api/bestanden'] },
  { id: 'dom-notities', categorie: 'Winkel en media', naam: 'Notities', standaard: true, doelgroepen: LEDEN_RTF,
    uitleg: 'De notitie-app: losse aantekeningen en lijstjes van een lid.', paden: ['/api/notities'] },
  { id: 'dom-site', categorie: 'Winkel en media', naam: 'Leden-website', standaard: true, doelgroepen: LEDEN,
    uitleg: 'De eigen website die een lid of zaak kan bouwen.', paden: ['/api/site'] },
  /* STANDAARD UIT, en dat is de hele reden dat hij bestaat. Een eigen extern
     domein haalt een site buiten het RTG-web: hij wordt dan leesbaar voor
     iedereen, ook zonder RTG-account. Dat is een besluit van de boardroom en
     niet van een lid, dus deze knop staat uit tot iemand hem bewust omzet. */
  { id: 'dom-eigendomein', categorie: 'Winkel en media', naam: 'Eigen domein (buiten het RTG-web)', standaard: false, doelgroepen: LEDEN,
    uitleg: 'Een eigen adres zoals hotelazur.nl naast hotelazur.rtg. Zet dit aan en een site kan buiten het RTG-web leesbaar worden -- ook voor wie geen lid is.', paden: ['/api/site/domein', '/api/supplier/site/domein'] },
  { id: 'dom-asset', categorie: 'Winkel en media', naam: 'Media-assets', standaard: true, doelgroepen: ALLE,
    uitleg: 'Het uitleveren van geuploade media.', paden: ['/api/asset'] },
  { id: 'dom-home', categorie: 'Winkel en media', naam: 'Home Kit (slim huis)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'De aansturing van apparaten in huis.', paden: ['/api/home'] },

  // ---------- identiteit en veiligheid ----------
  /* De foutmelder hoort hier omdat hij over de gebruiker gaat en niet over een
     dienst: hij stuurt bij een storing de foutmelding, het bestand en de regel
     naar het logboek, zodat een kapot scherm geen raadsel blijft. Uitzetten kan
     -- er wordt dan alleen niets meer gemeld, en verder verandert er niets aan
     wat de app doet. */
  { id: 'dom-foutmelder', categorie: 'Identiteit en veiligheid', naam: 'Storingsmelding uit de browser', standaard: true, doelgroepen: ALLE,
    uitleg: 'Meldt een onafgevangen fout aan het logboek: melding, bestand, regel en pagina. Geen naam, geen codenaam, geen ingetypte tekst.', paden: ['/api/fout'] },
  { id: 'dom-rtgid', categorie: 'Identiteit en veiligheid', naam: 'RTG iD', standaard: true, doelgroepen: ALLE,
    uitleg: 'De digitale identiteit en het delen daarvan.', paden: ['/api/rtgid'] },
  { id: 'dom-veiligheid', categorie: 'Identiteit en veiligheid', naam: 'Veiligheidsdiensten', standaard: true, doelgroepen: LEDEN,
    uitleg: 'De beveiligingskant voor leden en zaken.', paden: ['/api/veiligheid'] },
  { id: 'dom-kmar', categorie: 'Identiteit en veiligheid', naam: 'Grensdiensten (KMar)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'De grens- en documentcontrole bij reizen.', paden: ['/api/kmar'] },
  { id: 'dom-onboarding', categorie: 'Identiteit en veiligheid', naam: 'Onboarding', standaard: true, doelgroepen: ALLE,
    uitleg: 'De eerste stappen na aanmelden: profiel compleet maken.', paden: ['/api/onboarding'] }
];
