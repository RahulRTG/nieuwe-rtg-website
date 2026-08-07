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
  { id: 'dom-lab', categorie: 'RTFoundation', naam: 'Het Onderzoekslab', standaard: true, doelgroepen: ['foundation'],
    uitleg: 'Projecten, fases, bevindingen en de kennisbank van het lab.', paden: ['/api/lab'] },
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
  { id: 'dom-bestanden', categorie: 'Winkel en media', naam: 'Bestanden (kluis)', standaard: true, doelgroepen: LEDEN_RTF,
    uitleg: 'De persoonlijke bestandenkluis.', paden: ['/api/bestanden'] },
  { id: 'dom-notities', categorie: 'Winkel en media', naam: 'Notities', standaard: true, doelgroepen: LEDEN_RTF,
    uitleg: 'De notitie-app: losse aantekeningen en lijstjes van een lid.', paden: ['/api/notities'] },
  { id: 'dom-site', categorie: 'Winkel en media', naam: 'Leden-website', standaard: true, doelgroepen: LEDEN,
    uitleg: 'De eigen website die een lid of zaak kan bouwen.', paden: ['/api/site'] },
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
    uitleg: 'De eerste stappen na aanmelden: profiel compleet maken.', paden: ['/api/onboarding'] },

  // ---------- geld ----------
  { id: 'dom-rekening', categorie: 'Geld', naam: 'RTG Rekening', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Saldo, afschriften en betalingen op de eigen rekeninglaag.', paden: ['/api/bank'] },
  { id: 'dom-wallet', categorie: 'Geld', naam: 'Wallet', standaard: true, doelgroepen: LEDEN_GAST,
    uitleg: 'De wallet van een lid binnen RTG Pay.', paden: ['/api/wallet'] }
];
