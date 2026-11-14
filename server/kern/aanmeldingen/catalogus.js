/* De vaste pasvormen en geautomatiseerde reis van iedere aanmelding. De
   uitvoering woont in ../aanmeldingen.js; deze module bewaart alleen de
   productteksten die door aanvraag, besluit en betaalschema worden gedeeld. */
'use strict';

const PASSEN = {
  rtg: {
    naam: 'RTG Pass', stem: 'je',
    welkom: 'Fijn dat je er bent. Ik loop je aanmelding met je door. Je krijgt de voorwaarden en kosten te zien voordat je akkoord geeft.',
    open: true
  },
  lifestyle: {
    naam: 'RTG Lifestyle Pass', stem: 'u',
    welkom: 'Dank voor uw interesse in de Lifestyle Pass. Ik bereid alles voor u voor; de toelating zelf beslist een mens.',
    open: false
  },
  'business-lite': {
    naam: 'RTG Business Lite', stem: 'u',
    welkom: 'Dank voor uw aanvraag voor Business Lite. Ik loop de aanmelding met u door. U krijgt de voorwaarden en kosten te zien voordat u akkoord geeft.',
    open: true
  },
  business: {
    naam: 'RTG Business Pass', stem: 'u',
    welkom: 'Dank voor uw aanvraag voor de Business Pass. Ik zet de voorbereiding klaar; de toelating beslist een mens.',
    open: false
  }
};

const REIS = [
  { id: 'welkom', naam: 'Welkom', je: 'Welkom bij RTG. Ik ben Rahul en ik begeleid je aanmelding van begin tot eind.',
    u: 'Welkom bij RTG. Ik ben Rahul en ik begeleid uw aanmelding van begin tot eind.' },
  { id: 'onboarding', naam: 'Onboarding', je: 'Je controleert je gegevens en leest en ondertekent zelf de overeenkomst. Deze aanvraag is nog geen akkoord, ondertekening of betaling.',
    u: 'U controleert uw gegevens en leest en ondertekent zelf de overeenkomst. Deze aanvraag is nog geen akkoord, ondertekening of betaling.' },
  { id: 'rondleiding', naam: 'Rondleiding', je: 'Je kunt kennismaken met reizen, betalen op je codenaam, je eigen AI en De Salon. Wat je kunt gebruiken hangt af van je afspraken en toegang.',
    u: 'U kunt kennismaken met reizen, betalen op uw codenaam, uw eigen AI en De Salon. Wat u kunt gebruiken hangt af van uw afspraken en toegang.' },
  { id: 'rtf', naam: 'RTFoundation', je: 'Van de kwalificerende abonnementsomzet exclusief btw en na kortingen en correcties reserveert RTG 30% voor de maatschappelijke afdracht. Een reservering is nog geen uitbetaling.',
    u: 'Van de kwalificerende abonnementsomzet exclusief btw en na kortingen en correcties reserveert RTG 30% voor de maatschappelijke afdracht. Een reservering is nog geen uitbetaling.' },
  { id: 'security', naam: 'Veiligheid', je: 'Veiligheid: je draait op een codenaam, je echte naam ligt apart in de kluis.',
    u: 'Veiligheid: u draait op een codenaam, uw echte naam ligt apart in de kluis.' },
  { id: 'privacy', naam: 'Privacy', je: 'Privacy (AVG): je mag je gegevens altijd inzien, corrigeren en laten wissen.',
    u: 'Privacy (AVG): u mag uw gegevens altijd inzien, corrigeren en laten wissen.' }
];

module.exports = { PASSEN, REIS };
