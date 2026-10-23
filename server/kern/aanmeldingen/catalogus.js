/* De vaste pasvormen en geautomatiseerde reis van iedere aanmelding. De
   uitvoering woont in ../aanmeldingen.js; deze module bewaart alleen de
   productteksten die door aanvraag, besluit en betaalschema worden gedeeld. */
'use strict';

const PASSEN = {
  rtg: {
    naam: 'RTG Pass', stem: 'je',
    welkom: 'Fijn dat je er bent. Ik loop je aanmelding gewoon met je door; je hoeft nergens op te wachten.',
    open: true
  },
  lifestyle: {
    naam: 'RTG Lifestyle Pass', stem: 'u',
    welkom: 'Dank voor uw interesse in de Lifestyle Pass. Ik bereid alles voor u voor; de toelating zelf beslist een mens.',
    open: false
  },
  'business-lite': {
    naam: 'RTG Business Lite', stem: 'u',
    welkom: 'Dank voor uw aanvraag voor Business Lite. Ik loop de aanmelding met u door en zet uw zaak klaar; de toelating beslist een mens.',
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
  { id: 'onboarding', naam: 'Onboarding', je: 'We hebben je gegevens en je akkoord op de overeenkomst; dat is de onboarding rond.',
    u: 'Wij hebben uw gegevens en uw akkoord op de overeenkomst; daarmee is de onboarding rond.' },
  { id: 'rondleiding', naam: 'Rondleiding', je: 'Ik heb je rondgeleid: reizen, betalen op je codenaam, je eigen AI en De Salon.',
    u: 'Ik heb u rondgeleid: reizen, betalen op uw codenaam, uw eigen AI en De Salon.' },
  { id: 'rtf', naam: 'RTFoundation', je: 'En ik heb je verteld over de RTFoundation: 30% van de bijdragen gaat naar goede doelen.',
    u: 'En ik heb u verteld over de RTFoundation: 30% van de bijdragen gaat naar goede doelen.' },
  { id: 'security', naam: 'Veiligheid', je: 'Veiligheid: je draait op een codenaam, je echte naam ligt apart in de kluis.',
    u: 'Veiligheid: u draait op een codenaam, uw echte naam ligt apart in de kluis.' },
  { id: 'privacy', naam: 'Privacy', je: 'Privacy (AVG): je mag je gegevens altijd inzien, corrigeren en laten wissen.',
    u: 'Privacy (AVG): u mag uw gegevens altijd inzien, corrigeren en laten wissen.' }
];

module.exports = { PASSEN, REIS };
