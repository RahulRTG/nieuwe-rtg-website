/* Kern-module "aanmeldingen": de aanmelding voor een pas, per pas geheel
   geautomatiseerd -- BEHALVE de beslissing. Alles wat een mens vroeger met de
   hand deed rond een nieuwe aanmelding (de eerste berichten, de onboarding-uitleg,
   de rondleiding door het systeem, de uitleg over de RTFoundation, en de uitleg
   over veiligheid en privacy) verzorgt de AI nu automatisch, in de toon van de
   pas. RTG-personeel doet alleen nog het ENE dat een mens hoort te doen:
   accepteren of afwijzen.

   Harde regel (uit de merkregels): de AI belooft of verleent NOOIT zelf toegang
   tot de Lifestyle- of Business Pass. Die passen komen uitsluitend na menselijke
   goedkeuring. Daarom kent dit systeem maar EEN manier om een aanmelding toe te
   kennen: beslis() met een menselijke naam. Er is geen automatische toekenning.
   RTG Pass mag door iedereen worden aangevraagd (na de AI-intake), maar ook die
   aanvraag legt de app netjes op de stapel; het personeel zet de definitieve
   ja of nee. Opslag: db.data.aanmeldingen. */

const PASSEN = {
  rtg: {
    naam: 'RTG Pass', stem: 'je',
    // "old money": ingetogen, zeker, je-vorm
    welkom: 'Fijn dat je er bent. Ik loop je aanmelding gewoon met je door; je hoeft nergens op te wachten.',
    open: true // voor iedereen aan te vragen (na de intake); mens beslist alsnog
  },
  lifestyle: {
    naam: 'RTG Lifestyle Pass', stem: 'u',
    // "vertrouwde rechterhand": voorkomend, u-vorm
    welkom: 'Dank voor uw interesse in de Lifestyle Pass. Ik bereid alles voor u voor; de toelating zelf beslist een mens.',
    open: false // alleen na menselijke goedkeuring of op uitnodiging
  },
  'business-lite': {
    naam: 'RTG Business Lite', stem: 'u',
    /* Zakelijk en scherp, net als Business -- maar dit is de zzp'er en het
       kleine MKB, dus zonder de toon van een enterprise-relatie. Geen
       accountmanager, wel meteen werkende software. */
    welkom: 'Dank voor uw aanvraag voor Business Lite. Ik loop de aanmelding met u door en zet uw zaak klaar; de toelating beslist een mens.',
    open: true // zakelijk instapniveau: aan te vragen, mens beslist alsnog
  },
  business: {
    naam: 'RTG Business Pass', stem: 'u',
    // "efficiente strategische partner": zakelijk, scherp, u-vorm
    welkom: 'Dank voor uw aanvraag voor de Business Pass. Ik zet de voorbereiding klaar; de toelating beslist een mens.',
    open: false
  }
};

// De vaste, geautomatiseerde reis van elke aanmelding. Elke stap doet de AI zelf;
// alleen de laatste stap (het besluit) is mensenwerk. Teksten in twee toonvarianten
// (je/u), zodat elke pas in de eigen stem spreekt.
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

module.exports = ({ db, save, crypto, schoon, geldPasprijzen, accounts }) => {
  const nu = () => new Date().toISOString();
  const rid = () => crypto.randomBytes(4).toString('hex');
  const kap = (t, n) => schoon(String(t == null ? '' : t), n || 200);
  const eur = c => Math.round(c) / 100;

  function A() { if (!Array.isArray(db.data.aanmeldingen)) db.data.aanmeldingen = []; return db.data.aanmeldingen; }
  function B() { if (!Array.isArray(db.data.lidmaatschapBetalingen)) db.data.lidmaatschapBetalingen = []; return db.data.lidmaatschapBetalingen; }

  /* Het betaalschema (de 12 maandtermijnen met de 30%-foundation-split en het
     kantooroverzicht) draait als submodule op dezelfde context; zie
     aanmeldingen/betaalschema.js. */
  const { startBetalingen, betalingen, verlengLidmaatschap, zegOpLidmaatschap, contracten } = require('./aanmeldingen/betaalschema')({ B, geldPasprijzen, rid, nu, eur, PASSEN, db, save });
  /* De ondernemersintake en de automatische bedrijfsprovisioning na de
     eerste voldane termijn; zie aanmeldingen/bedrijf.js. */
  const bedrijfMod = require('./aanmeldingen/bedrijf')({ db, save, kap, nu, accounts });
  const vind = id => A().find(a => a.id === String(id || ''));

  /* De aanvraagkant staat apart: hoe een aanmelding ONTSTAAT en hoe hij eruit
     ziet. Zie ./aanmeldingen/aanvraag.js. */
  const { bouwReis, beeld, aanvraag, lijst } = require('./aanmeldingen/aanvraag')({
    A, PASSEN, REIS, accounts, bedrijfMod, kap, nu, rid, save });

  function een(id) { const a = vind(id); return a ? { ok: true, aanmelding: beeld(a) } : { status: 404, error: 'Deze aanmelding bestaat niet.' }; }

  /* De ENE menselijke handeling: accepteren of afwijzen. Vereist een naam (wie
     beslist), zodat een besluit nooit anoniem is -- en zodat de AI dit pad niet
     kan nabootsen. Toegang tot Lifestyle/Business ontstaat UITSLUITEND hier. */
  // Het menselijke besluit (accepteren/afwijzen, en het optillen van de pas)
  // staat in ./aanmeldingen/besluit.js; zie de kop daar waarom apart.
  const { beslis } = require('./aanmeldingen/besluit')({ vind, beeld, kap, nu, accounts, save, startBetalingen, PASSEN });

  /* Seam voor de AI-laag: mag deze PAS automatisch worden toegekend? Nooit, voor
     geen enkele pas. Zo kan geen assistent per ongeluk toegang beloven.

     Let op het verschil met de provisioning-knop in kern/onderneming/regie.js:
     die gaat over het klaarzetten van een ZAAK, en dat is operationeel werk.
     Een PAS is toegang tot RTG zelf en blijft mensenwerk, in elke stand van
     die knop. Wie die twee door elkaar haalt, zet de merkregel uit met een
     schuifje dat over iets anders leek te gaan. */
  function magAutomatischToekennen(pas) { return false; }

  /* Een termijn aftekenen als voldaan (administratieve bevestiging door een
     mens, geen betaalclaim); de eerste voldane termijn van een geaccepteerde
     ondernemersaanmelding zet de zaak automatisch klaar. */
  function termijnVoldaan(id, maand, door) {
    const a = vind(id); if (!a) return { status: 404, error: 'Deze aanmelding bestaat niet.' };
    return bedrijfMod.termijnVoldaan(B, a, maand, door);
  }

  /* De zaak klaarzetten OP ID, voor de provisioning-knop van de boardroom
     (kern/onderneming/regie.js, stand 'automatisch'). Hij zoekt de echte
     aanmelding op en geeft die door aan dezelfde provisioning die het
     personeel anders in gang zet: bedrijfMod.provisioneer MUTEERT de
     aanmelding (a.gezaakt) en is daarmee idempotent. Een nagemaakt object
     doorgeven zou die idempotentie stilletjes breken -- dan stond er bij een
     tweede aanroep een tweede zaak. */

  // De zaak klaarzetten: ./aanmeldingen/klaarzetten.js (stond op de NOG-lijst).
  const klaarzetten = require('./aanmeldingen/klaarzetten')({ A, bedrijfMod });

  return { aanmeldingen: Object.assign({ aanvraag, lijst, een, beslis, betalingen, verlengLidmaatschap, zegOpLidmaatschap, contracten,
    termijnVoldaan, magAutomatischToekennen, PASSEN }, klaarzetten) };
};
