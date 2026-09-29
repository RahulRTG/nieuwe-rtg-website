/* DE DEFINITIES -- wat een bedrijfsmaat BETEKENT, zoals de eigenaar het besloot.

   Genomen op 25 september 2026, per maat gekozen uit uitgeschreven opties met
   wat elke keuze kost. Ze staan hier als gegevens zodat de catalogus erop kan
   citeren (het element `definitie` van een maat) en de projecties in
   ./projecties.js ze letterlijk volgen. Een definitie die verandert, krijgt een
   nieuwe VERSIE: een oude uitkomst blijft dan vergelijkbaar met wat er toen
   gold, en een beslisgeheugen kan zien dat twee getallen iets anders meten.

   De formulering is opgeschreven door Claude op grond van de keuzes van de
   eigenaar; een mens heeft haar nog niet op deze woorden nagelezen. */
'use strict';

const BESLOTEN = '25 september 2026, door de eigenaar';
const d = (versie, regel, waarom) => Object.freeze({ versie, besloten: BESLOTEN, herkomst: 'mens', regel, waarom });
/* De besluiten C8 tot en met C11 (27 september 2026) over het boek van RTG. */
const dC = (c, versie, regel, waarom) => Object.freeze({ versie, besloten: '27 september 2026, door de eigenaar (C' + c + ')',
  herkomst: 'mens', regel, waarom });
/* De besluiten van 28 september 2026 (C12) en later staan in ./definities-later.js. */
const d27 = (versie, regel, waarom) => Object.freeze({ versie, besloten: '27 september 2026, door de eigenaar (C3)',
  herkomst: 'mens', regel, waarom });

const DEFINITIES = Object.freeze(Object.assign({
  nieuwLid: d(1, 'Iemand wordt NIEUW LID op het moment van zijn eerste pas boven gast (rtg, lifestyle of business).',
    'Een gast is geen lid, en een account is geen lidmaatschap.'),
  cohort: d(1, 'Een COHORT is de ISO-week waarin iemand nieuw lid werd.',
    'Een begrip, geen tweede startmoment; onder de groepsgrens toont de poort niets.'),
  activatie: d(1, 'ACTIVATIE is een eerste geslaagde uitkomst binnen 30 dagen na nieuw lid, in welke wereld ook. ' +
    'Geslaagd: een rit die de keten afmaakte (afgerond) of een bestelling die bezorgd of opgehaald werd.',
    'Meet waarde en geen aandacht: geen inlogs, geen klikken.'),
  omzetGefactureerd: d(1, 'Een lidmaatschapstermijn is GEFACTUREERDE omzet in de maand waarin hij vervalt, zonder btw.',
    'De eigenaar koos gefactureerd en ontvangen NAAST elkaar; dit is de eerste van de twee.'),
  omzetOntvangen: d(1, 'Een lidmaatschapstermijn is ONTVANGEN omzet in de maand waarin een mens hem als voldaan aftekende, zonder btw.',
    'Kasbasis: sluit aan op de afdracht aan de RTFoundation en straks op cash en runway.'),
  churn: d(1, 'CHURN is een lid wiens pas naar gast gaat, of wiens contract GEEINDIGD bereikt, geteld in de maand waarin het ingaat. ' +
    'Noemer: leden met een betaalde pas aan het begin van die maand.',
    'Een opzegging is nog geen churn: wie zich bedenkt, is nooit weggegaan.'),
  afwaardering: d(1, 'AFWAARDERING is een stap naar een lagere betaalde pas; dat is geen churn en telt apart.',
    'Anders betekent churn twee dingen.'),
  retentieWaarde: d(1, 'RETENTIE (WAARDE): het aandeel van een cohort met een geslaagde uitkomst tussen dag 30 en dag 60 na nieuw lid.',
    'Behoud als waarde; zelfde uitkomstenlijst als activatie. Het VENSTER (dag 30 tot 60) is een voorstel van Claude en nog niet door de eigenaar bevestigd.'),
  retentieAanwezig: d(1, 'RETENTIE (AANWEZIG): het aandeel van een cohort waarvan de laatste bezoekdag op of na dag 30 na nieuw lid ligt.',
    'De eigenaar koos beide maten; deze leunt op kern/aanwezigheid.js (een dag per lid, 13 maanden). De drempel van 30 dagen is een voorstel van Claude en nog niet bevestigd.'),
  brutomarge: d(1, 'De BRUTOMARGE is ontvangen omzet min de GEMETEN kostensoorten (AI, verzoeken, opslag, berichten, transacties). ' +
    'Stroom en serverhuur (toegerekend, graad vermoed) horen bij de operationele marge.',
    'Zo blijft de brutomarge gemeten en erft hij niet de graad vermoed.'),
  cash: Object.freeze({ versie: 1, besloten: '27 september 2026, door de eigenaar (C4)', herkomst: 'mens',
    regel: 'CASH is het saldo van de rekeningen van RTG aan het eind van de maand, overgetikt van een afschrift met die bron; ' +
      'het geld van verkochte RTG-cadeaubonnen staat ernaast als verplichting en is geen vrij geld.',
    waarom: 'Een runway die op onverdiend geld rust, is te lang.' }),
  aanmeldkanaal: Object.freeze({ versie: 1, besloten: '27 september 2026, door de eigenaar (C6)', herkomst: 'mens',
    regel: 'Het AANMELDKANAAL is het antwoord op een optionele vraag bij het aanmelden, of de campagnecode uit de link; ' +
      'het wordt geteld per maand en nooit bij het account bewaard.',
    waarom: 'Weten waar leden vandaan komen, niet wie.' }),
  klantwaardeLiving: d27(1, 'KLANTWAARDE in LivingOS: een rit die de keten afmaakte of een bestelling die bezorgd of opgehaald werd, in de maand van afronden.',
    'Dezelfde uitkomsten als activatie; een van vier maten naast elkaar, zonder totaal.'),
  klantwaardeTravel: d27(1, 'KLANTWAARDE in TravelOS: een reis die thuis is, gemeld door het lid of het kantoor, in de maand van thuiskomst.',
    'Een bevestiging is een toezegging; pas thuis is de reis geleverd.'),
  klantwaardeWork: d27(1, 'KLANTWAARDE in WorkOS: een loonrun die definitief werd, in de maand van definitief maken; de groep is het aantal zaken.',
    'Het loon is definitief vastgesteld; of het geld ook is overgemaakt, zegt deze maat niet.'),
  klantwaardeFoundation: d27(1, 'KLANTWAARDE in FoundationOS: een hulpvraag die is afgerond met een hulpactie in het dossier, op de dag van afronden.',
    'Telt over gezinnen en nooit per gezin; de RTFoundation blijft haar eigen economische wereld (C1).'),
  operationeleMarge: dC(8, 1, 'De OPERATIONELE MARGE is de brutomarge min stroom en serverhuur (de nota\'s uit de huisrekening) min de vaste lasten ' +
    'van RTG uit het boek van Financiën; alleen als elke post van die maand is ingevuld.',
    'Een half ingevuld boek ziet eruit als een goede maand.'),
  liquiditeit: dC(10, 1, 'De LIQUIDITEIT is het vrije banksaldo aan het eind van de maand min de eigen korte verplichtingen van RTG ' +
    '(crediteuren, belasting, loon, overig); het tegoed van leden staat ernaast en wordt niet afgetrokken.',
    'Keuze van de eigenaar: alleen eigen schulden; het ledentegoed is een los getal.'),
  runway: dC(9, 1, 'De RUNWAY is het vrije banksaldo gedeeld door het maandverbruik, gemiddeld over de laatste drie afgesloten maanden, ' +
    'twee keer naast elkaar: BRUTO (vaste lasten, marketing en platformkosten) en NETTO (bruto min ontvangen omzet). ' +
    'Is het netto verbruik nul of lager, dan is er geen verbruik en geen getal.',
    'Netto zegt hoe lang het duurt; bruto zegt hoe lang het duurt als de omzet wegvalt.'),
  cac: dC(11, 1, 'De CAC per kanaal is de marketinguitgave van een maand voor dat kanaal gedeeld door de nieuwe leden die dat kanaal ' +
    'opgaven in dezelfde maand; onder tien leden geen getal.',
    'Per kanaal, zodat te zien is welk kanaal werkt; \'via iemand die ik ken\' heeft geen uitgave.')
}, require('./definities-later')));

module.exports = { DEFINITIES, BESLOTEN };
