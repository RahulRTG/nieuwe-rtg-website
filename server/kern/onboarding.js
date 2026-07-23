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
  function bekend(veldId, sess) {
    const acc = sess && sess.account;
    const md = acc && accounts.getMemberState ? (accounts.getMemberState(acc.id) || {}) : {};
    switch (veldId) {
      case 'naam': return acc ? accounts.realNameOf(acc) : null;
      case 'email': return acc ? accounts.emailOf(acc) : null;
      case 'telefoon': return acc ? accounts.phoneOf(acc) : null;
      case 'geboortedatum': return md.geboren || null;
      case 'land': return md.land || null;
      case 'nationaliteit': return md.nationaliteit || null;
      // Demo-sessies zonder account kunnen geen identiteitsbewijs uploaden
      // (de upload eist een echt account); daar telt het veld als voldaan,
      // anders zou de demo eeuwig voor de onboarding-poort blijven staan.
      case 'paspoort': return acc
        ? (['pending', 'approved', 'geverifieerd', 'verified'].includes(acc.verified) ? 'ingediend' : null)
        : 'demo-sessie';
      default: return null;
    }
  }
  function waardeVan(veld, sess, profiel) {
    const eigen = profiel.velden[veld.id];
    if (eigen != null && eigen !== '') return eigen;
    return bekend(veld.id, sess);
  }

  // Het paspoort (KYC-upload) is standaard bij de betaalde passen (Lifestyle,
  // Business). Bij de gratis RTG Pass hoeft niemand een paspoort te laten zien
  // -- behalve wie RTG Pay gebruikt: dan wordt het eenmalig gevraagd. Guests en
  // RTFoundation laten nooit een paspoort zien via deze poort.
  function paspoortVerplicht(tier, profiel) {
    if (tier === 'lifestyle' || tier === 'business') return true;
    if (tier === 'rtg') return !!(profiel && profiel.payGebruikt);
    return false;
  }

  // De volledige onboarding-status voor deze sessie binnen een scope.
  function status(scope, sess) {
    const sc = scopeVan(scope);
    const tier = (sess && sess.tier) || 'guest';
    const profiel = profielVan(profielId(sess));
    const velden = sc.velden
      .filter(v => (v.voorWie || []).includes(tier))
      .filter(v => v.id !== 'paspoort' || paspoortVerplicht(tier, profiel))
      .map(v => {
        const w = waardeVan(v, sess, profiel);
        return { id: v.id, label: v.label, type: v.type, ingevuld: !!(w && String(w).trim()),
          waarde: v.type === 'kyc' ? undefined : (w != null ? String(w) : '') };
      });
    const ontbrekend = velden.filter(v => !v.ingevuld).map(v => v.id);
    const ond = (profiel.ondertekend || {})[scope];
    const getekend = !!(ond && ond.versie === sc.contract.versie);
    return {
      scope, tier,
      velden, ontbrekend,
      contract: { versie: sc.contract.versie, titel: sc.contract.titel, tekst: sc.contract.tekst,
        ondertekend: getekend, ondertekendAt: getekend ? ond.at : null },
      klaar: ontbrekend.length === 0 && getekend
    };
  }
  // Snelle ja/nee: is de onboarding van deze sessie (platform-scope) rond?
  function klaar(sess, scope) { return status(scope || 'rtg', sess).klaar; }

  /* RTG Pay-gebruik door een gratis lid. Vanaf het eerste gebruik is het
     paspoort eenmalig vereist; de betaalde passen hebben dat al bij de
     onboarding gedaan. Geeft {ok:true} als het door mag; anders een nette
     403 met kyc:true, zodat de app het lid naar de paspoort-stap stuurt.
     (Demo-/gastsessies zonder echt account laten we door: die kunnen geen
     identiteitsbewijs uploaden.) */
  function payGate(sess) {
    const tier = (sess && sess.tier) || 'guest';
    if (tier === 'lifestyle' || tier === 'business') return { ok: true };
    if (tier !== 'rtg') return { ok: true };
    const profiel = profielVan(profielId(sess));
    if (!profiel.payGebruikt) { profiel.payGebruikt = true; save(); }
    const acc = sess && sess.account;
    const geverifieerd = acc && ['pending', 'approved', 'geverifieerd', 'verified'].includes(acc.verified);
    if (!acc || geverifieerd) return { ok: true };
    return { ok: false, status: 403, kyc: true,
      error: 'RTG Pay vraagt eenmalig je paspoort. Open de app; Rahul helpt je het te bevestigen.' };
  }

  // De intake-velden opslaan (paspoort loopt via de KYC-upload, niet hier).
  function slaOp(scope, sess, velden) {
    const sc = scopeVan(scope);
    const geldig = new Set(sc.velden.map(v => v.id));
    const p = profielVan(profielId(sess));
    for (const [k, v] of Object.entries(velden || {})) {
      if (!geldig.has(k) || k === 'paspoort') continue;
      p.velden[k] = schoon(String(v == null ? '' : v), 200);
    }
    save();
    return status(scope, sess);
  }

  /* Paspoort-meta (vervaldatum, nummer) uit de MRZ-scan bewaren op het profiel.
     Rahul gebruikt de vervaldatum om een half jaar vooraf te seinen dat het
     paspoort verloopt (zie kern/fluister). Alleen een geldige ISO-datum telt. */
  function bewaarPaspoort(sess, info) {
    info = info || {};
    const p = profielVan(profielId(sess));
    if (!p.paspoort) p.paspoort = {};
    if (info.vervaldatum && /^\d{4}-\d{2}-\d{2}$/.test(String(info.vervaldatum))) p.paspoort.vervaldatum = String(info.vervaldatum);
    if (info.nummer) p.paspoort.nummer = schoon(String(info.nummer), 40);
    p.paspoort.at = nu();
    save();
    return { ok: true, paspoort: { vervaldatum: p.paspoort.vervaldatum || null } };
  }

  // Het contract ondertekenen: getypte naam + akkoord -> bewijs met vingerafdruk.
  function teken(scope, sess, naam, akkoord) {
    if (!akkoord) return { status: 400, error: 'Zet een vinkje dat u akkoord bent met de overeenkomst.' };
    naam = schoon(String(naam || ''), 80);
    if (naam.length < 2) return { status: 400, error: 'Typ uw volledige naam om digitaal te ondertekenen.' };
    const sc = scopeVan(scope);
    const pid = profielId(sess);
    const p = profielVan(pid);
    const hash = crypto.createHash('sha256').update(sc.contract.versie + '|' + sc.contract.tekst + '|' + naam + '|' + pid).digest('hex');
    p.ondertekend[scope] = { versie: sc.contract.versie, naam, at: nu(), hash };
    save();
    return { status: 200, ok: true, ...status(scope, sess) };
  }

  /* ---------- de config lezen en aanpassen (eigenaar / leverancier) ---------- */

  /* De beheer/AI-laag draait als submodule op een gedeelde context, een
     keer opgebouwd bij het opstarten. */
  const ctx = { db, save, crypto, accounts, anthropic, schoon,
    ALLE_WIE, PAS_WIE, VELD_TYPES, DEFAULT_CONTRACT,
    nu, standaardVelden, standaardScope, store, scopeVan, profielVan, profielId };
  const { publiekeConfig, config, normaliseerVelden, zetConfig, aiPasAan, cannedVoorstel, ondertekenaars } = require('./onboarding/beheer')(ctx);

  return { store, standaardScope, status, klaar, payGate, slaOp, bewaarPaspoort, teken, config, zetConfig, aiPasAan, cannedVoorstel, ondertekenaars,
    ALLE_WIE, PAS_WIE, VELD_TYPES };
}

module.exports = { maakOnboarding, DEFAULT_CONTRACT };
