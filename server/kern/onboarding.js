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

  // De volledige onboarding-status voor deze sessie binnen een scope.
  function status(scope, sess) {
    const sc = scopeVan(scope);
    const tier = (sess && sess.tier) || 'guest';
    const profiel = profielVan(profielId(sess));
    const velden = sc.velden
      .filter(v => (v.voorWie || []).includes(tier))
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
  function publiekeConfig(sc) {
    return { velden: sc.velden.map(v => ({ id: v.id, label: v.label, type: v.type, voorWie: [...(v.voorWie || [])] })),
      contract: { versie: sc.contract.versie, titel: sc.contract.titel, tekst: sc.contract.tekst, bijgewerkt: sc.contract.bijgewerkt } };
  }
  function config(scope) { return publiekeConfig(scopeVan(scope)); }

  // Een voorgestelde config valideren/normaliseren voordat we hem toepassen.
  function normaliseerVelden(lijst) {
    const uit = [];
    const gezien = new Set();
    for (const v of (Array.isArray(lijst) ? lijst : []).slice(0, 40)) {
      if (!v || typeof v !== 'object') continue;
      let id = schoon(String(v.id || v.label || ''), 40).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      if (!id || gezien.has(id)) continue;
      gezien.add(id);
      const type = VELD_TYPES.includes(v.type) ? v.type : 'text';
      let voorWie = Array.isArray(v.voorWie) ? v.voorWie.filter(w => ALLE_WIE.includes(w)) : [...ALLE_WIE];
      if (!voorWie.length) voorWie = [...ALLE_WIE];
      uit.push({ id, label: schoon(String(v.label || id), 60) || id, type, voorWie });
    }
    return uit.length ? uit : null;
  }
  // De config (deels) overschrijven; contracttekst-wijziging = nieuwe versie.
  function zetConfig(scope, voorstel) {
    const sc = scopeVan(scope);
    if (voorstel && voorstel.velden) { const v = normaliseerVelden(voorstel.velden); if (v) sc.velden = v; }
    if (voorstel && voorstel.contract) {
      const c = voorstel.contract;
      if (c.titel != null) sc.contract.titel = schoon(String(c.titel), 100) || sc.contract.titel;
      if (c.tekst != null) {
        const tekst = String(c.tekst).slice(0, 20000);
        if (tekst.trim().length >= 20 && tekst !== sc.contract.tekst) { sc.contract.tekst = tekst; sc.contract.versie += 1; }
      }
    }
    sc.contract.bijgewerkt = nu();
    save();
    return config(scope);
  }

  /* Aanpassen met AI in gewone taal. Met een sleutel stelt Claude een volledige
     nieuwe config voor; zonder sleutel doet een ingebouwde regel-parser het
     eenvoudige werk (veld toevoegen/weghalen, verplichten voor gasten, een regel
     aan het contract toevoegen). We passen het voorstel meteen toe (de eigenaar/
     leverancier is de bevoegde) en geven een uitleg terug. */
  async function aiPasAan(scope, opdracht, aiAan) {
    const sc = scopeVan(scope);
    const huidig = publiekeConfig(sc);
    let voorstel = null, uitleg = '', bron = 'ingebouwd';
    if (anthropic && aiAan !== false) {
      try {
        const sys = 'Je beheert de verplichte intake (vereiste velden) en het contract van een reisplatform. ' +
          'Pas de config aan volgens de opdracht van de beheerder. Veldtypes: ' + VELD_TYPES.join(', ') + '. ' +
          'voorWie is een deelverzameling van ' + ALLE_WIE.join(', ') + ' (guest = gratis gast). ' +
          'Antwoord met een korte uitleg in het Nederlands en DAARNA exact EEN codeblok:\n' +
          '```json\n{"velden":[{"id":"..","label":"..","type":"..","voorWie":["guest","rtg"]}],"contract":{"titel":"..","tekst":".."}}\n```';
        const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 2000, system: sys,
          messages: [{ role: 'user', content: 'Huidige config:\n' + JSON.stringify(huidig) + '\n\nOpdracht: ' + String(opdracht || '') }] });
        const txt = (r && r.content && r.content[0] && r.content[0].text) || '';
        const m = txt.match(/```json\s*([\s\S]*?)```/);
        if (m) { try { voorstel = JSON.parse(m[1]); } catch (e) {} }
        uitleg = txt.replace(/```json[\s\S]*?```/, '').trim();
        bron = 'claude';
      } catch (e) { voorstel = null; }
    }
    if (!voorstel) { const c = cannedVoorstel(sc, String(opdracht || '')); voorstel = c.voorstel; if (!uitleg) uitleg = c.uitleg; }
    zetConfig(scope, voorstel);
    return { ok: true, uitleg: uitleg || 'Aangepast.', bron, config: config(scope) };
  }

  // Ingebouwde regel-parser (zonder AI-sleutel): dekt de meest gevraagde acties.
  function cannedVoorstel(sc, opdracht) {
    const t = opdracht.toLowerCase();
    const velden = sc.velden.map(v => ({ id: v.id, label: v.label, type: v.type, voorWie: [...(v.voorWie || [])] }));
    const contract = { titel: sc.contract.titel, tekst: sc.contract.tekst };
    let uitleg = 'Aangepast op basis van uw instructie.';
    const noemt = (w) => t.includes(w);
    // paspoort (of een genoemd veld) ook voor gasten verplichten
    if ((noemt('paspoort') || noemt('gast')) && (noemt('gast') || noemt('iedereen'))) {
      const p = velden.find(v => v.id === 'paspoort');
      if (p && !p.voorWie.includes('guest')) { p.voorWie.push('guest'); uitleg = 'Paspoort is nu ook voor gratis gasten verplicht.'; }
    }
    // veld verwijderen (een enkele veldnaam)
    let m = t.match(/(?:verwijder|haal weg|schrap|weg met)\s+(?:het\s+veld\s+)?"?([a-z][a-z0-9_]{1,30})"?/);
    if (m) { const doel = m[1].trim(); const i = velden.findIndex(v => v.id === doel || v.label.toLowerCase().includes(doel)); if (i >= 0) { uitleg = 'Veld "' + velden[i].label + '" verwijderd.'; velden.splice(i, 1); } }
    // veld toevoegen (een enkele veldnaam, met of zonder "toe")
    m = t.match(/(?:voeg|vraag|extra)\s+(?:het\s+veld\s+|ook\s+|veld\s+)?"?([a-z][a-z0-9_]{1,30})"?(?:\s+toe)?/);
    if (m) {
      const id = m[1].trim();
      if (id && !velden.some(v => v.id === id)) { velden.push({ id, label: id.charAt(0).toUpperCase() + id.slice(1), type: 'text', voorWie: [...ALLE_WIE] }); uitleg = 'Veld "' + id + '" toegevoegd voor iedereen.'; }
    }
    // een regel aan het contract toevoegen
    m = opdracht.match(/(?:zet in het contract(?: dat)?|voeg aan het contract toe|contractregel)[:\s]+(.{5,300})/i);
    if (m) { contract.tekst = sc.contract.tekst.trimEnd() + '\n\n' + m[1].trim(); uitleg = 'Regel aan het contract toegevoegd (nieuwe versie).'; }
    // contracttitel wijzigen
    m = opdracht.match(/(?:contract)?titel\s+(?:wordt|naar|is)\s+(.{3,80})/i);
    if (m) { contract.titel = m[1].trim(); }
    return { voorstel: { velden, contract }, uitleg };
  }

  // Wie tekende er binnen een scope (voor de leverancier/eigenaar): overzicht.
  function ondertekenaars(scope) {
    const s = store();
    const uit = [];
    for (const [pid, p] of Object.entries(s.profielen)) {
      const o = (p.ondertekend || {})[scope];
      if (o) uit.push({ wie: pid, naam: o.naam, versie: o.versie, at: o.at });
    }
    return uit.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }

  return { store, standaardScope, status, klaar, slaOp, teken, config, zetConfig, aiPasAan, cannedVoorstel, ondertekenaars,
    ALLE_WIE, PAS_WIE, VELD_TYPES };
}

module.exports = { maakOnboarding, DEFAULT_CONTRACT };
