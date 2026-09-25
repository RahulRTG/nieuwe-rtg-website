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

const DEFINITIES = Object.freeze({
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
    'Zo blijft de brutomarge gemeten en erft hij niet de graad vermoed.')
});

module.exports = { DEFINITIES, BESLOTEN };
