/* Kern-module "onboarding": de verplichte intake (paspoort, e-mail, telefoon,
   adres en de overige standaardgegevens) én het verplichte contract dat ELK
   account tekent -- van de gratis gast tot RTG-/RTF-leden en leveranciers.

   Alles staat per SCOPE, zodat dezelfde motor twee dingen bedient:
   - scope 'rtg'  = de platform-brede eisen + het platformcontract (de eigenaar
     beheert die, met of zonder AI).
   - scope '<LEVERANCIERCODE>' = de eigen eisen + het eigen contract van een
     leverancier, school of andere partij, voor hun eigen mensen.

   De eigenaar (of een leverancier voor de eigen scope) kan de vereiste velden en
   de contracttekst aanpassen -- met de hand of met AI in gewone taal. Verandert de
   contracttekst, dan loopt het versienummer op en moet er opnieuw getekend worden
   (het oude handtekening-bewijs blijft staan). Een handtekening is getypte naam +
   akkoord + tijdstempel + een sha-256-vingerafdruk van (versie|tekst|naam|wie). */

// Wie het aangaat. 'guest' = de gratis gast; de pas-tiers reizen dus vragen we
// ook paspoort/geboortedatum/nationaliteit. De eigenaar kan dit met AI verschuiven
// (bijv. paspoort ook voor gasten verplichten).
const ALLE_WIE = ['guest', 'rtg', 'lifestyle', 'business', 'rtf'];
// De pas-tiers reizen dus vragen we ook paspoort/geboortedatum/nationaliteit. RTF
// (foundation-gezinnen, vaak minderjarig) en gasten niet standaard; de eigenaar kan
// dat met AI verschuiven ("maak paspoort ook verplicht voor RTF/gasten").
const PAS_WIE = ['rtg', 'lifestyle', 'business'];
const VELD_TYPES = ['text', 'email', 'tel', 'date', 'land', 'nummer', 'kyc'];

const DEFAULT_CONTRACT = `RTG-lidmaatschaps- en reisovereenkomst

1. Wie u bent. U verklaart dat de gegevens die u opgeeft (naam, e-mailadres, telefoon, adres en, indien gevraagd, uw paspoort- of identiteitsgegevens) juist zijn en van uzelf. RTG mag deze verifieren.

2. De pas is voor reizen. Uw RTG-pas is persoonlijk en bedoeld om via RTG te reizen en van de aangesloten partners gebruik te maken. U geeft uw pas of codenaam niet aan een ander.

3. Privacy (AVG). RTG verwerkt uw gegevens, inclusief paspoortgegevens, alleen om uw lidmaatschap, reizen en veiligheid mogelijk te maken. U kunt uw gegevens inzien, corrigeren en laten verwijderen. Zie de privacyverklaring.

4. Gedrag. U gebruikt het platform eerlijk en respectvol. Misbruik, fraude of het lastigvallen van anderen kan leiden tot schorsing.

5. Rol van RTG. RTG is bemiddelaar tussen u en de partners; overeenkomsten over reizen en diensten komen tot stand met de betreffende partner. Betalingen lopen via de app.

6. Akkoord. Door te tekenen gaat u akkoord met deze overeenkomst, de algemene voorwaarden en de privacyverklaring.`;

function maakOnboarding({ db, save, crypto, accounts, anthropic, schoon }) {
  function nu() { return new Date().toISOString(); }

  function standaardVelden() {
    return [
      { id: 'naam', label: 'Volledige naam', type: 'text', voorWie: [...ALLE_WIE] },
      { id: 'email', label: 'E-mailadres', type: 'email', voorWie: [...ALLE_WIE] },
      { id: 'telefoon', label: 'Telefoonnummer', type: 'tel', voorWie: [...ALLE_WIE] },
      { id: 'adres', label: 'Straat en huisnummer', type: 'text', voorWie: [...ALLE_WIE] },
      { id: 'postcode', label: 'Postcode', type: 'text', voorWie: [...ALLE_WIE] },
      { id: 'woonplaats', label: 'Woonplaats', type: 'text', voorWie: [...ALLE_WIE] },
      { id: 'land', label: 'Land', type: 'land', voorWie: [...ALLE_WIE] },
      { id: 'geboortedatum', label: 'Geboortedatum', type: 'date', voorWie: [...PAS_WIE] },
      { id: 'nationaliteit', label: 'Nationaliteit', type: 'text', voorWie: [...PAS_WIE] },
      { id: 'paspoort', label: 'Voorkant van je paspoort', type: 'kyc', voorWie: [...PAS_WIE] }
    ];
  }
  function standaardScope() {
    return { velden: standaardVelden(), contract: { versie: 1, titel: 'RTG-lidmaatschaps- en reisovereenkomst', tekst: DEFAULT_CONTRACT, bijgewerkt: nu() } };
  }
  // Zorg dat de opslag (en de platform-scope) bestaan; migratie-vrij.
  function store() {
    if (!db.data.onboarding) db.data.onboarding = { scopes: {}, profielen: {} };
    if (!db.data.onboarding.scopes) db.data.onboarding.scopes = {};
    if (!db.data.onboarding.profielen) db.data.onboarding.profielen = {};
    if (!db.data.onboarding.scopes.rtg) db.data.onboarding.scopes.rtg = standaardScope();
    // Migratie: de paspoort-controle vraagt nu expliciet de voorkant van het
    // paspoort. Bestaande scopes met het oude standaardlabel schuiven mee; een
    // eigen aangepast label van de eigenaar laten we staan.
    for (const sc of Object.values(db.data.onboarding.scopes)) {
      const p = sc && sc.velden && sc.velden.find(v => v.id === 'paspoort');
      if (p && p.label === 'Paspoort of ID-kaart') p.label = 'Voorkant van je paspoort';
    }
    return db.data.onboarding;
  }
  // Een scope ophalen; onbekende leverancier-scope krijgt een eigen standaardset
  // (zodat elke leverancier/school de tool meteen kan gebruiken).
  function scopeVan(scope) {
    const s = store();
    if (!s.scopes[scope]) s.scopes[scope] = standaardScope();
    return s.scopes[scope];
  }
  function profielVan(pid) {
    const s = store();
    if (!s.profielen[pid]) s.profielen[pid] = { velden: {}, ondertekend: {} };
    return s.profielen[pid];
  }
  // De sleutel van een profiel: het account, anders de (gast)sessiesleutel.
  function profielId(sess) { return (sess && sess.key) || 'onbekend'; }

  // Wat we al van iemand weten (uit het account/lidstaat) prefillt de intake.
  /* De lees/schrijf-acties voor het lid (status, intake opslaan, paspoort-meta,
     RTG Pay-poort, contract tekenen) draaien als submodule op dezelfde context;
     zie onboarding/lid.js. Ze worden hieronder na het opbouwen van ctx ingehaakt. */

  /* ---------- de config lezen en aanpassen (eigenaar / leverancier) ---------- */

  /* De beheer/AI-laag draait als submodule op een gedeelde context, een
     keer opgebouwd bij het opstarten. */
  const ctx = { db, save, crypto, accounts, anthropic, schoon,
    ALLE_WIE, PAS_WIE, VELD_TYPES, DEFAULT_CONTRACT,
    nu, standaardVelden, standaardScope, store, scopeVan, profielVan, profielId };
  const { publiekeConfig, config, normaliseerVelden, zetConfig, aiPasAan, cannedVoorstel, ondertekenaars } = require('./onboarding/beheer')(ctx);
  // de lid-acties (status, intake, paspoort, RTG Pay-poort, tekenen)
  const { status, klaar, payGate, slaOp, bewaarPaspoort, teken } = require('./onboarding/lid')(ctx);

  return { store, standaardScope, status, klaar, payGate, slaOp, bewaarPaspoort, teken, config, zetConfig, aiPasAan, cannedVoorstel, ondertekenaars,
    ALLE_WIE, PAS_WIE, VELD_TYPES };
}

module.exports = { maakOnboarding, DEFAULT_CONTRACT };
