/* Toren 4: RTG Care. Zorg & welzijn: spa's, wellness en klinieken in het
   ecosysteem. Een lid boekt een behandeling bij een behandelaar in een
   tijdslot; de agenda van die behandelaar is de schaarste (een behandeling
   per behandelaar per slot). Betalen loopt via RTG Pay.

   Twee dingen maken deze toren bijzonder, en allebei staan ze in dienst van
   de zorgvolle keten die al door het hele ecosysteem loopt:

   1. Het zorgprofiel reist mee. Allergenen, dieet en aandachtspunten die het
      lid al deelt (met toestemming), gaan automatisch mee naar de behandelaar
      (een aromamassage met een notenallergie hoort de spa te weten).

   2. Veilige, aparte dossierdeling. Voor een kliniek is het gewone
      zorgprofiel niet genoeg: daar deelt het lid apart en uitdrukkelijk een
      intake (medische context) met precies die ene aanbieder, met een
      einddatum, en het lid of de aanbieder kan het altijd stoppen. Precies
      hetzelfde toestemmingsmodel als het live meekijken met de locatie:
      niets zonder een "ja", en niet langer dan nodig.

   Alleen voor leden (geen gasten). */
module.exports = ({ db, save, crypto, schoon, notify, zorgVoor }) => {
  const nu = () => new Date().toISOString();
  const vandaag = () => new Date().toISOString().slice(0, 10);
  const eur = c => '€ ' + (c / 100).toFixed(2).replace('.', ',');
  const INTAKE_DAGEN = 90; // een gedeelde intake vervalt vanzelf na een kwartaal

  const lijsten = () => {
    if (!db.data.careBoekingen) db.data.careBoekingen = [];     // geboekte behandelingen
    if (!db.data.careIntake) db.data.careIntake = [];            // toestemmingen: dossier delen met een aanbieder
    if (!Array.isArray(db.data.careAanbieders) || !db.data.careAanbieders.length) {
      db.data.careAanbieders = [
        {
          id: 'zenith', naam: 'Zenith Spa & Wellness', soort: 'spa', icon: '🧖', waar: 'Talamanca, Ibiza',
          supplierCode: 'ZENITH', // gekoppeld leveranciersaccount voor de aanbieder-agenda
          beschrijving: 'Rustige dagspa aan zee: massages, sauna en gezichtsbehandelingen.',
          behandelaars: [
            { id: 'zb1', naam: 'Nadia Sol', functie: 'Massagetherapeut' },
            { id: 'zb2', naam: 'Bram Veer', functie: 'Huidtherapeut' }
          ],
          behandelingen: [
            { id: 'zt1', naam: 'Aromamassage', soort: 'wellness', duurMin: 60, prijs: 95, behandelaarId: 'zb1', tijden: ['10:00', '12:00', '14:00', '16:00'] },
            { id: 'zt2', naam: 'Hot stone massage', soort: 'wellness', duurMin: 90, prijs: 135, behandelaarId: 'zb1', tijden: ['11:00', '15:00'] },
            { id: 'zt3', naam: 'Gezichtsbehandeling', soort: 'wellness', duurMin: 45, prijs: 80, behandelaarId: 'zb2', tijden: ['10:30', '13:30', '15:30'] }
          ]
        },
        {
          id: 'clara', naam: 'Kliniek Clara Ibiza', soort: 'kliniek', icon: '🩺', waar: 'Vila, Ibiza',
          supplierCode: 'CLARA',
          beschrijving: 'Privékliniek voor consulten, kleine ingrepen en herstelbegeleiding.',
          behandelaars: [
            { id: 'cb1', naam: 'Dr. Elena Ruiz', functie: 'Huisarts' },
            { id: 'cb2', naam: 'Dr. Tomas Blad', functie: 'Fysiotherapeut' }
          ],
          behandelingen: [
            { id: 'ct1', naam: 'Consult huisarts', soort: 'medisch', duurMin: 20, prijs: 65, behandelaarId: 'cb1', tijden: ['09:00', '09:30', '10:00', '11:00'] },
            { id: 'ct2', naam: 'Fysiotherapie', soort: 'medisch', duurMin: 30, prijs: 55, behandelaarId: 'cb2', tijden: ['13:00', '14:00', '16:00'] }
          ]
        }
      ];
      save();
    }
  };

  const aanbiederVan = id => (db.data.careAanbieders || []).find(a => a.id === String(id || ''));
  const behandelingVan = (a, id) => a && (a.behandelingen || []).find(b => b.id === String(id || ''));

  /* ---- de intake: een lid deelt medische context met een aanbieder ----
     Apart van het algemene zorgprofiel: uitdrukkelijk, per aanbieder, met een
     einddatum en altijd te stoppen (door het lid of door de aanbieder). */
  const intakeActief = (key, aanbiederId) => {
    lijsten();
    return db.data.careIntake.find(i => i.key === key && i.aanbiederId === aanbiederId &&
      i.status === 'actief' && i.vervaltOp >= vandaag());
  };

  /* De ledenlaag en de aanbieder/pakketlaag draaien als submodules op een
     gedeelde context, een keer opgebouwd bij het opstarten; de ledenlaag
     gaat eerst de context in omdat de pakketlaag careBoek/careBetaal
     hergebruikt. */
  const ctx = { db, save, crypto, schoon, notify, zorgVoor,
    nu, vandaag, eur, INTAKE_DAGEN, lijsten, aanbiederVan, behandelingVan, intakeActief };
  const deelLeden = require('./care/leden')(ctx);
  Object.assign(ctx, deelLeden);
  const deelZaak = require('./care/zaak')(ctx);
  const { careIntakeDeel, careIntakeStop, careOverzicht, careBoek, careBetaal, careAnnuleer, careMijn, aanbiedersVanSupplier } = deelLeden;
  const { careAgenda, careAfronden, carePakketOverzicht, carePakketBoek, carePakketBetaal, carePakketMijn, boekBehandelingActie } = deelZaak;

  return {
    careOverzicht, careBoek, careBetaal, careAnnuleer, careMijn,
    careIntakeDeel, careIntakeStop, boekBehandelingActie,
    careAgenda, careAfronden, aanbiedersVanSupplier,
    carePakketOverzicht, carePakketBoek, carePakketBetaal, carePakketMijn,
    aanbiederVan
  };
};
