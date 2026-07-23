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

module.exports = ({ db, save, crypto, schoon }) => {
  const nu = () => new Date().toISOString();
  const rid = () => crypto.randomBytes(4).toString('hex');
  const kap = (t, n) => schoon(String(t == null ? '' : t), n || 200);

  function A() { if (!Array.isArray(db.data.aanmeldingen)) db.data.aanmeldingen = []; return db.data.aanmeldingen; }
  const vind = id => A().find(a => a.id === String(id || ''));

  // De geautomatiseerde reis opbouwen in de toon van de pas. Elke stap is meteen
  // 'gedaan': de AI verzorgt hem automatisch. Alleen het besluit blijft open.
  function bouwReis(stem) {
    const t = nu();
    return REIS.map(s => ({ id: s.id, naam: s.naam, tekst: stem === 'u' ? s.u : s.je, auto: true, at: t }));
  }

  function beeld(a) {
    return { id: a.id, pas: a.pas, pasNaam: (PASSEN[a.pas] || {}).naam || a.pas,
      naam: a.naam, contact: a.contact, status: a.status,
      reis: a.reis, welkom: a.welkom, viaUitnodiging: !!a.viaUitnodiging,
      besluit: a.besluit || null, at: a.at, bijgewerkt: a.bijgewerkt };
  }

  /* Een nieuwe aanmelding. De AI verzorgt meteen de hele reis (berichten,
     onboarding-bevestiging, rondleiding, RTF, veiligheid, privacy). De status
     komt op 'in behandeling': klaar voor de menselijke ja of nee. Voor Lifestyle
     en Business wordt NOOIT toegang beloofd of gezet -- de reis is voorbereiding,
     geen toelating. */
  function aanvraag(b) {
    b = b || {};
    const pas = String(b.pas || '');
    const def = PASSEN[pas];
    if (!def) return { status: 400, error: 'Kies een geldige pas (RTG, Lifestyle of Business).' };
    const naam = kap(b.naam, 80);
    if (naam.length < 2) return { status: 400, error: 'Vul de naam van de aanvrager in.' };
    const contact = kap(b.contact, 120);
    const viaUitnodiging = !!b.viaUitnodiging;
    // De poort van het merk: Lifestyle/Business alleen na menselijke goedkeuring
    // of op uitnodiging. De aanvraag zelf mag altijd binnenkomen (de AI belooft
    // niets); alleen beslis() door een mens kent hem later toe.
    const a = { id: rid(), pas, naam, contact, viaUitnodiging,
      welkom: def.welkom, reis: bouwReis(def.stem),
      status: 'in behandeling', besluit: null, at: nu(), bijgewerkt: nu() };
    A().unshift(a);
    if (A().length > 5000) A().pop();
    save();
    return { ok: true, aanmelding: beeld(a) };
  }

  // De wachtrij voor het personeel (optioneel op status gefilterd).
  function lijst(status) {
    let L = A();
    if (status) L = L.filter(a => a.status === String(status));
    return { ok: true, aantal: L.length,
      openstaand: A().filter(a => a.status === 'in behandeling').length,
      aanmeldingen: L.slice(0, 200).map(beeld) };
  }
  function een(id) { const a = vind(id); return a ? { ok: true, aanmelding: beeld(a) } : { status: 404, error: 'Deze aanmelding bestaat niet.' }; }

  /* De ENE menselijke handeling: accepteren of afwijzen. Vereist een naam (wie
     beslist), zodat een besluit nooit anoniem is -- en zodat de AI dit pad niet
     kan nabootsen. Toegang tot Lifestyle/Business ontstaat UITSLUITEND hier. */
  function beslis(id, besluit, door, notitie) {
    const a = vind(id); if (!a) return { status: 404, error: 'Deze aanmelding bestaat niet.' };
    if (a.status !== 'in behandeling') return { status: 409, error: 'Over deze aanmelding is al beslist (' + a.status + ').' };
    if (!['geaccepteerd', 'afgewezen'].includes(besluit)) return { status: 400, error: 'Kies accepteren of afwijzen.' };
    const wie = kap(door, 60);
    if (wie.length < 2) return { status: 400, error: 'Een besluit draagt altijd de naam van de mens die beslist.' };
    a.status = besluit;
    a.besluit = { besluit, door: wie, notitie: kap(notitie, 300), at: nu() };
    a.bijgewerkt = nu();
    save();
    return { ok: true, aanmelding: beeld(a) };
  }

  /* Seam voor de AI-laag: mag deze pas automatisch worden toegekend? Nooit voor
     Lifestyle/Business. Zo kan geen enkele assistent per ongeluk toegang beloven. */
  function magAutomatischToekennen(pas) { return false; }

  return { aanmeldingen: { aanvraag, lijst, een, beslis, magAutomatischToekennen, PASSEN } };
};
