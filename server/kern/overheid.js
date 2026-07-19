/* De Overheid: de landelijke laag boven de gemeente (kern/gemeente.js). Waar de
   gemeente lokaal is (meldingen, burgerzaken, vergunningen), regelt deze laag
   het rijk · de dingen die een inwoner of ondernemer met "Den Haag" doet, in
   MijnOverheid-stijl. Zes pijlers, drie soorten gebruikers:
   - Inwoners (leden-app): Berichtenbox, aangifte inkomstenbelasting + toeslagen,
     voertuigregister & rijbewijs (RDW), sociale zekerheid (UWV/SVB), stemmen bij
     een referendum en de rijksbekendmakingen lezen.
   - Ondernemers (leden- en partner-app): inschrijven in het handelsregister (KVK)
     en een uittreksel opvragen.
   - Rijksambtenaren (partner-app, ingelogd als de rijks-partner): toeslagen,
     uitkeringen en bezwaren beoordelen, bekendmakingen plaatsen, een stemming
     openen/sluiten en de uitslag zien.

   Privacy by design: alles draait op codenamen; de echte naam blijft in de kluis
   (accounts.js). Nooit de belofte dat een besluit of betaling al bij de dienst
   verwerkt is · een aanvraag is "ingediend"/"in behandeling" tot een mens beslist.
   De berekeningen (belasting, toeslag) zijn een heldere demo-benadering, geen
   fiscaal advies. Volgt het vaste kern-patroon maakOverheid(state). */

// inkomstenbelasting (demo, twee schijven; peiljaar volgt de klok)
const IB = { schijf: 75000, tarief1: 0.37, tarief2: 0.495, heffingskorting: 3070 };
// toeslagen: eenvoudige, aflopende bedragen op basis van (jaar)inkomen
const TOESLAGEN = {
  zorgtoeslag: { label: 'Zorgtoeslag', max: 130, grens: 40000, af: 0.0032 },
  huurtoeslag: { label: 'Huurtoeslag', max: 380, grens: 34000, af: 0.011 },
  kindgebonden: { label: 'Kindgebonden budget', max: 290, grens: 45000, af: 0.0064 }
};
const UITKERINGEN = {
  ww: 'WW-uitkering', bijstand: 'Bijstand (Participatiewet)',
  aow: 'AOW (ouderdomspensioen)', kinderbijslag: 'Kinderbijslag'
};
const RECHTSVORMEN = { eenmanszaak: 'Eenmanszaak', vof: 'Vennootschap onder firma', bv: 'Besloten vennootschap (bv)', stichting: 'Stichting' };
const RIJBEWIJS_CATS = ['AM', 'A', 'B', 'BE', 'C', 'D'];
// provincie: subsidieregelingen (regionaal), met een maximumbijdrage
const SUBSIDIES = {
  verduurzaming: { label: 'Verduurzaming woning', max: 4000 },
  natuur: { label: 'Natuur & landschap', max: 15000 },
  cultuur: { label: 'Cultuur & erfgoed', max: 8000 },
  innovatie: { label: 'MKB-innovatie', max: 25000 }
};
// waterschap: de jaarlijkse waterschapsbelasting en de meldingen aan het waterschap
const WATERHEFFINGEN = [
  { soort: 'Watersysteemheffing', basis: 120, spreiding: 180 },
  { soort: 'Zuiveringsheffing', basis: 160, spreiding: 90 }
];
const WATERMELD = { verontreiniging: 'Verontreiniging/lozing', wateroverlast: 'Wateroverlast', kade: 'Kade/oever', beschoeiing: 'Beschoeiing/duiker' };
const WATER_STATUS = ['nieuw', 'in behandeling', 'opgelost', 'afgewezen'];

function maakOverheid({ db, save, crypto, anthropic, findSupplier, notify, notifySupplier, sseToSupplier }) {
  const nu = () => new Date().toISOString();
  const jaar = () => new Date().getFullYear();
  const id = () => crypto.randomBytes(4).toString('hex');
  const ref = p => 'RTG-' + p + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);
  const eur = n => Math.round(Number(n) || 0);
  // deterministische ruis per sleutel, zodat demo-cijfers stabiel maar gevarieerd zijn
  function hash(s) { let h = 0x811c9dc5 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }

  function seed() {
    if (!Array.isArray(db.data.suppliers)) return;
    if (!db.data.supplierTypes.rijk)
      db.data.supplierTypes.rijk = { label: 'Rijksoverheid', icon: '\u{1F3E2}', caps: ['rijk'] };
    for (const k of ['rijkBerichten', 'rijkAanslagen', 'rijkToeslagen', 'rijkVoertuigen', 'rijkRijbewijzen',
      'rijkKvk', 'rijkUitkeringen', 'rijkBezwaren', 'rijkStemmen', 'rijkBekend',
      'rijkSubsidies', 'waterAanslagen', 'waterMeldingen'])
      if (!Array.isArray(db.data[k])) db.data[k] = [];
    if (db.data._overheidSeed) return;
    db.data._overheidSeed = true;
    if (!db.data.suppliers.find(s => s.code === 'RIJK')) {
      db.data.suppliers.push({
        code: 'RIJK', name: 'Rijksoverheid', type: 'rijk', city: 'Den Haag',
        loc: { lat: 52.080, lng: 4.313, label: 'Rijksoverheid' }, rate: 0, menu: [], photos: [], rijk: {}
      });
    }
    // een lopend referendum zodat "stemmen" meteen werkt
    if (!db.data.rijkVerkiezing) {
      db.data.rijkVerkiezing = {
        id: id(), titel: 'Raadgevend referendum: een extra snelle veerverbinding naar het vasteland?',
        toelichting: 'Het rijk overweegt mee te investeren in een snellere veerdienst. Wat vind jij?',
        opties: [
          { id: 'voor', label: 'Voor', stemmen: 0 },
          { id: 'tegen', label: 'Tegen', stemmen: 0 },
          { id: 'blanco', label: 'Blanco', stemmen: 0 }
        ], open: true, geopend: nu(), gesloten: null
      };
    }
    db.data.rijkBekend.unshift(
      { id: id(), titel: 'Kennisgeving: peiljaar ' + jaar() + ' vastgesteld', tekst: 'De tarieven inkomstenbelasting en toeslagen voor ' + jaar() + ' zijn bekend. Doe tijdig aangifte via MijnOverheid.', soort: 'belasting', at: nu() },
      { id: id(), titel: 'Digitale identiteit', tekst: 'Inloggen bij de overheid gaat voortaan met je RTG-account en passkey. Je gegevens blijven in de beveiligde kluis.', soort: 'algemeen', at: nu() }
    );
    save();
  }
  function isRijk(s) { return !!(s && s.type === 'rijk'); }
  function deRijk() { seed(); return (db.data.suppliers || []).find(s => s.type === 'rijk') || null; }
  function magBehandelen(s) { return isRijk(s); }

  // een bericht in de Berichtenbox van een inwoner zetten (intern gebruik)
  function bericht(key, van, titel, tekst, soort) {
    db.data.rijkBerichten.unshift({ id: id(), key, van: van || 'Rijksoverheid', titel: schoon(titel, 120), tekst: schoon(tekst, 600), soort: soort || 'algemeen', gelezen: false, at: nu() });
    db.data.rijkBerichten = db.data.rijkBerichten.slice(0, 50000);
  }

  /* ---------- pijler 1: Berichtenbox ---------- */
  function berichten(key) {
    seed();
    return { ok: true, berichten: (db.data.rijkBerichten || []).filter(b => b.key === key).slice(0, 80)
      .map(b => ({ id: b.id, van: b.van, titel: b.titel, tekst: b.tekst, soort: b.soort, gelezen: !!b.gelezen, at: b.at })),
      ongelezen: (db.data.rijkBerichten || []).filter(b => b.key === key && !b.gelezen).length };
  }
  function berichtGelezen(key, bid) {
    const b = (db.data.rijkBerichten || []).find(x => x.id === String(bid || '') && x.key === key);
    if (!b) return { status: 404, error: 'Bericht niet gevonden.' };
    b.gelezen = true; save();
    return { ok: true };
  }

  /* ---------- pijler 2: Belastingdienst ---------- */
  function berekenIB(inkomen, aftrek, ingehouden) {
    const belastbaar = Math.max(0, eur(inkomen) - Math.max(0, eur(aftrek)));
    const belasting = belastbaar <= IB.schijf
      ? belastbaar * IB.tarief1
      : IB.schijf * IB.tarief1 + (belastbaar - IB.schijf) * IB.tarief2;
    const teVoldoen = Math.max(0, belasting - IB.heffingskorting);
    // loonheffing die al is ingehouden; bij niets ingevuld schatten we ~32%
    const alBetaald = ingehouden == null || ingehouden === '' ? Math.round(eur(inkomen) * 0.32) : Math.max(0, eur(ingehouden));
    const saldo = eur(teVoldoen - alBetaald); // >0 = bijbetalen, <0 = teruggaaf
    return { belastbaar, belasting: eur(belasting), heffingskorting: IB.heffingskorting, teVoldoen: eur(teVoldoen), ingehouden: alBetaald, saldo };
  }
  function aangifteDoe(sess, codenaam, data) {
    seed();
    data = data || {};
    const inkomen = eur(data.inkomen);
    if (inkomen <= 0) return { status: 400, error: 'Vul je bruto jaarinkomen in.' };
    if (inkomen > 100000000) return { status: 400, error: 'Dat inkomen is te hoog om te verwerken.' };
    const b = berekenIB(inkomen, data.aftrek, data.ingehouden);
    // één aangifte per jaar; opnieuw indienen overschrijft de vorige
    const j = jaar();
    let a = (db.data.rijkAanslagen || []).find(x => x.key === sess.key && x.jaar === j);
    if (!a) { a = { id: id(), ref: ref('IB'), key: sess.key, codenaam, jaar: j, at: nu() }; db.data.rijkAanslagen.unshift(a); }
    Object.assign(a, { inkomen, aftrek: Math.max(0, eur(data.aftrek)), ...b, betaald: a.betaald || false, ingediend: nu() });
    db.data.rijkAanslagen = db.data.rijkAanslagen.slice(0, 40000);
    bericht(sess.key, 'Belastingdienst', 'Aanslag inkomstenbelasting ' + j,
      a.saldo > 0 ? 'Je moet € ' + a.saldo + ' bijbetalen. Betaal via MijnOverheid.' :
      a.saldo < 0 ? 'Je krijgt € ' + Math.abs(a.saldo) + ' terug.' : 'Je aangifte komt uit op nul: niets te betalen of terug te ontvangen.', 'belasting');
    save();
    return { ok: true, aanslag: publiekeAanslag(a) };
  }
  function publiekeAanslag(a) {
    return { ref: a.ref, jaar: a.jaar, inkomen: a.inkomen, aftrek: a.aftrek, belastbaar: a.belastbaar,
      belasting: a.belasting, heffingskorting: a.heffingskorting, teVoldoen: a.teVoldoen, ingehouden: a.ingehouden,
      saldo: a.saldo, betaald: !!a.betaald, at: a.ingediend || a.at };
  }
  function mijnAanslagen(key) {
    seed();
    return { ok: true, aanslagen: (db.data.rijkAanslagen || []).filter(a => a.key === key).slice(0, 20).map(publiekeAanslag) };
  }
  function aanslagBetaal(key, r) {
    const a = (db.data.rijkAanslagen || []).find(x => x.ref === String(r || '') && x.key === key);
    if (!a) return { status: 404, error: 'Aanslag niet gevonden.' };
    if (a.saldo <= 0) return { status: 409, error: 'Voor deze aanslag hoef je niets te betalen.' };
    if (a.betaald) return { status: 409, error: 'Deze aanslag is al betaald.' };
    a.betaald = true; a.betaaldAt = nu();
    bericht(key, 'Belastingdienst', 'Betaling ontvangen', 'Je betaling van € ' + a.saldo + ' voor de aanslag ' + a.jaar + ' is ontvangen.', 'belasting');
    save();
    return { ok: true, aanslag: publiekeAanslag(a) };
  }
  function toeslagBereken(soort, inkomen) {
    const t = TOESLAGEN[soort]; if (!t) return 0;
    if (eur(inkomen) >= t.grens) return 0;
    return Math.max(0, eur(t.max - eur(inkomen) * t.af));
  }
  function toeslagAanvraag(sess, codenaam, data) {
    seed();
    data = data || {};
    const soort = TOESLAGEN[data.soort] ? data.soort : null;
    if (!soort) return { status: 400, error: 'Kies een geldige toeslag.' };
    const inkomen = eur(data.inkomen);
    if (inkomen < 0) return { status: 400, error: 'Vul je jaarinkomen in.' };
    if ((db.data.rijkToeslagen || []).some(x => x.key === sess.key && x.soort === soort && x.status !== 'gestopt' && x.status !== 'afgewezen'))
      return { status: 409, error: 'Je hebt al een aanvraag voor ' + TOESLAGEN[soort].label + ' lopen.' };
    const maandbedrag = eur(toeslagBereken(soort, inkomen));
    const t = { id: id(), ref: ref('TS'), key: sess.key, codenaam, soort, soortLabel: TOESLAGEN[soort].label,
      inkomen, maandbedrag, status: maandbedrag > 0 ? 'aangevraagd' : 'geen recht', at: nu() };
    db.data.rijkToeslagen.unshift(t);
    db.data.rijkToeslagen = db.data.rijkToeslagen.slice(0, 40000);
    bericht(sess.key, 'Dienst Toeslagen', 'Aanvraag ' + t.soortLabel,
      maandbedrag > 0 ? 'Je aanvraag is ontvangen. Voorlopige berekening: € ' + maandbedrag + ' per maand. Een medewerker beoordeelt hem.'
        : 'Op basis van je inkomen is er geen recht op ' + t.soortLabel + '.', 'toeslag');
    save();
    return { ok: true, toeslag: publiekeToeslag(t) };
  }
  function publiekeToeslag(t) { return { ref: t.ref, soort: t.soort, soortLabel: t.soortLabel, inkomen: t.inkomen, maandbedrag: t.maandbedrag, status: t.status, at: t.at }; }
  function mijnToeslagen(key) { seed(); return { ok: true, toeslagen: (db.data.rijkToeslagen || []).filter(t => t.key === key).slice(0, 30).map(publiekeToeslag) }; }

  /* ---------- pijler 3: RDW (voertuig & rijbewijs) ---------- */
  function voertuigen(key) {
    seed();
    return { ok: true, voertuigen: (db.data.rijkVoertuigen || []).filter(v => v.key === key).slice(0, 60)
      .map(v => ({ id: v.id, kenteken: v.kenteken, merk: v.merk, bouwjaar: v.bouwjaar, apkTot: v.apkTot, geschorst: !!v.geschorst })) };
  }
  function voertuigMeld(sess, data) {
    seed();
    data = data || {};
    const kenteken = schoon(data.kenteken, 12).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (kenteken.length < 4) return { status: 400, error: 'Vul een geldig kenteken in.' };
    if ((db.data.rijkVoertuigen || []).some(v => v.kenteken === kenteken)) return { status: 409, error: 'Dit kenteken staat al geregistreerd.' };
    const merk = schoon(data.merk, 40) || 'Onbekend';
    const h = hash(kenteken);
    const bouwjaar = 2008 + (h % 17);
    const apk = new Date(); apk.setMonth(apk.getMonth() + 6 + (h % 12));
    const v = { id: id(), key: sess.key, kenteken, merk, bouwjaar, apkTot: apk.toISOString().slice(0, 10), geschorst: false, at: nu() };
    db.data.rijkVoertuigen.unshift(v);
    db.data.rijkVoertuigen = db.data.rijkVoertuigen.slice(0, 60000);
    save();
    return { ok: true, voertuig: { id: v.id, kenteken, merk, bouwjaar, apkTot: v.apkTot } };
  }
  function voertuigSchors(key, vid, schors) {
    const v = (db.data.rijkVoertuigen || []).find(x => x.id === String(vid || '') && x.key === key);
    if (!v) return { status: 404, error: 'Voertuig niet gevonden.' };
    v.geschorst = !!schors; save();
    return { ok: true, voertuig: { id: v.id, kenteken: v.kenteken, geschorst: v.geschorst } };
  }
  function rijbewijs(key) {
    seed();
    let r = (db.data.rijkRijbewijzen || []).find(x => x.key === key);
    if (!r) {
      const g = new Date(); g.setFullYear(g.getFullYear() + 5 + (hash(key) % 5));
      r = { key, categorieen: ['B'], geldigTot: g.toISOString().slice(0, 10), at: nu() };
      db.data.rijkRijbewijzen.unshift(r); save();
    }
    return { ok: true, rijbewijs: { categorieen: r.categorieen, geldigTot: r.geldigTot } };
  }
  function rijbewijsVerleng(key) {
    seed();
    let r = (db.data.rijkRijbewijzen || []).find(x => x.key === key);
    if (!r) { rijbewijs(key); r = (db.data.rijkRijbewijzen || []).find(x => x.key === key); }
    const g = new Date(); g.setFullYear(g.getFullYear() + 10);
    r.geldigTot = g.toISOString().slice(0, 10); r.verlengd = nu(); save();
    bericht(key, 'RDW', 'Rijbewijs verlengd', 'Je rijbewijs is verlengd tot ' + r.geldigTot + '. Je haalt het op bij de gemeentebalie.', 'rdw');
    return { ok: true, rijbewijs: { categorieen: r.categorieen, geldigTot: r.geldigTot } };
  }

  /* ---------- pijler 4: KVK ondernemersloket ---------- */
  function kvkInschrijven(houder, data) {
    seed();
    data = data || {};
    const naam = schoon(data.naam, 120);
    if (naam.length < 2) return { status: 400, error: 'Vul een bedrijfsnaam in.' };
    const rechtsvorm = RECHTSVORMEN[data.rechtsvorm] ? data.rechtsvorm : 'eenmanszaak';
    const sleutel = houder.key || houder.supplierCode || 'RTG';
    const bestaand = (db.data.rijkKvk || []).find(k =>
      (houder.key && k.key === houder.key) || (houder.supplierCode && k.supplierCode === houder.supplierCode));
    if (bestaand) return { status: 409, error: 'Er staat al een inschrijving op jouw naam. Vraag een uittreksel op.' };
    const nummer = String(60000000 + (hash(String(sleutel) + naam) % 39999999));
    const k = { id: id(), kvkNummer: nummer, key: houder.key || null, supplierCode: houder.supplierCode || null,
      houder: houder.codenaam || houder.bedrijf || null, naam, rechtsvorm, rechtsvormLabel: RECHTSVORMEN[rechtsvorm],
      sbi: schoon(data.sbi, 8) || '00000', vestiging: schoon(data.vestiging, 80) || 'Eivissa', at: nu() };
    db.data.rijkKvk.unshift(k);
    db.data.rijkKvk = db.data.rijkKvk.slice(0, 60000);
    if (houder.key) bericht(houder.key, 'KVK', 'Ingeschreven in het handelsregister', naam + ' is ingeschreven onder KVK-nummer ' + nummer + '.', 'kvk');
    save();
    return { ok: true, inschrijving: publiekeKvk(k) };
  }
  function publiekeKvk(k) { return { kvkNummer: k.kvkNummer, naam: k.naam, rechtsvorm: k.rechtsvorm, rechtsvormLabel: k.rechtsvormLabel, sbi: k.sbi, vestiging: k.vestiging, at: k.at }; }
  function kvkMijn(houder) {
    seed();
    const list = (db.data.rijkKvk || []).filter(k => (houder.key && k.key === houder.key) || (houder.supplierCode && k.supplierCode === houder.supplierCode));
    return { ok: true, inschrijvingen: list.slice(0, 20).map(publiekeKvk) };
  }

  /* ---------- pijler 5: sociale zekerheid (UWV/SVB) ---------- */
  function uitkeringAanvraag(sess, codenaam, data) {
    seed();
    data = data || {};
    const soort = UITKERINGEN[data.soort] ? data.soort : null;
    if (!soort) return { status: 400, error: 'Kies een geldige regeling.' };
    if ((db.data.rijkUitkeringen || []).some(u => u.key === sess.key && u.soort === soort && ['aangevraagd', 'in behandeling', 'toegekend'].includes(u.status)))
      return { status: 409, error: 'Je hebt al een aanvraag voor ' + UITKERINGEN[soort] + ' lopen.' };
    const u = { id: id(), ref: ref('SZ'), key: sess.key, codenaam, soort, soortLabel: UITKERINGEN[soort],
      toelichting: schoon(data.toelichting, 400) || null, status: 'aangevraagd', at: nu() };
    db.data.rijkUitkeringen.unshift(u);
    db.data.rijkUitkeringen = db.data.rijkUitkeringen.slice(0, 40000);
    bericht(sess.key, soort === 'aow' || soort === 'kinderbijslag' ? 'SVB' : 'UWV', 'Aanvraag ' + u.soortLabel, 'Je aanvraag is ontvangen en wordt beoordeeld.', 'sociaal');
    save();
    return { ok: true, aanvraag: publiekeUitkering(u) };
  }
  function publiekeUitkering(u) { return { ref: u.ref, soort: u.soort, soortLabel: u.soortLabel, status: u.status, at: u.at, besluit: u.besluit || null }; }
  function mijnUitkeringen(key) { seed(); return { ok: true, uitkeringen: (db.data.rijkUitkeringen || []).filter(u => u.key === key).slice(0, 30).map(publiekeUitkering) }; }

  /* ---------- pijler 6: verkiezing/referendum & bekendmakingen ---------- */
  function verkiezing(key) {
    seed();
    const v = db.data.rijkVerkiezing;
    if (!v) return { ok: true, verkiezing: null };
    const alGestemd = key ? (db.data.rijkStemmen || []).some(s => s.verkiezingId === v.id && s.key === key) : false;
    const totaal = v.opties.reduce((s, o) => s + o.stemmen, 0);
    return { ok: true, verkiezing: { id: v.id, titel: v.titel, toelichting: v.toelichting, open: !!v.open,
      opties: v.opties.map(o => ({ id: o.id, label: o.label, stemmen: o.stemmen, pct: totaal ? Math.round(o.stemmen / totaal * 100) : 0 })),
      totaal, alGestemd, gesloten: v.gesloten } };
  }
  function stem(key, keuze) {
    seed();
    const v = db.data.rijkVerkiezing;
    if (!v || !v.open) return { status: 409, error: 'Er is op dit moment geen open stemming.' };
    const o = v.opties.find(x => x.id === String(keuze || ''));
    if (!o) return { status: 400, error: 'Kies een geldige optie.' };
    if ((db.data.rijkStemmen || []).some(s => s.verkiezingId === v.id && s.key === key)) return { status: 409, error: 'Je hebt al gestemd.' };
    o.stemmen++;
    db.data.rijkStemmen.push({ verkiezingId: v.id, key, at: nu() });
    save();
    return { ok: true, ...verkiezing(key) };
  }
  function bekendmakingen() {
    seed();
    return { ok: true, bekendmakingen: (db.data.rijkBekend || []).slice(0, 40).map(b => ({ id: b.id, titel: b.titel, tekst: b.tekst, soort: b.soort, at: b.at })) };
  }
  function bezwaarIndienen(sess, codenaam, data) {
    seed();
    data = data || {};
    const tegen = schoon(data.tegen, 120), reden = schoon(data.reden, 800);
    if (tegen.length < 3 || reden.length < 6) return { status: 400, error: 'Vul in waartegen je bezwaar maakt en waarom.' };
    const b = { id: id(), ref: ref('BZ'), key: sess.key, codenaam, tegen, reden, status: 'ingediend', at: nu() };
    db.data.rijkBezwaren.unshift(b);
    db.data.rijkBezwaren = db.data.rijkBezwaren.slice(0, 40000);
    bericht(sess.key, 'Rijksoverheid', 'Bezwaar ontvangen', 'Je bezwaar tegen "' + tegen + '" is geregistreerd (' + b.ref + ') en wordt behandeld.', 'bezwaar');
    save();
    return { ok: true, bezwaar: { ref: b.ref, tegen, status: b.status, at: b.at } };
  }
  function mijnBezwaren(key) { seed(); return { ok: true, bezwaren: (db.data.rijkBezwaren || []).filter(b => b.key === key).slice(0, 30).map(b => ({ ref: b.ref, tegen: b.tegen, status: b.status, besluit: b.besluit || null, at: b.at })) }; }

  /* ---------- koppelingen met de rest van het ecosysteem ----------
     De overheid staat niet los: een onderneming schrijft zich met één tik in
     bij de KVK (idempotent), en elk voertuig is bij de RDW te controleren
     (dezelfde check die autoverhuur en RTG OV kunnen aanroepen). */
  function kvkVoorSupplier(code) { return (db.data.rijkKvk || []).find(k => k.supplierCode === code) || null; }
  function kvkZorg(supplier) {
    seed();
    if (!supplier || !supplier.code) return { status: 400, error: 'Onbekende onderneming.' };
    const bestaand = kvkVoorSupplier(supplier.code);
    if (bestaand) return { ok: true, inschrijving: publiekeKvk(bestaand), nieuw: false };
    const r = kvkInschrijven({ supplierCode: supplier.code, bedrijf: supplier.name }, { naam: supplier.name, rechtsvorm: 'bv' });
    return r.error ? r : { ok: true, inschrijving: r.inschrijving, nieuw: true };
  }
  function kvkLijst() {
    seed();
    return { ok: true, inschrijvingen: (db.data.rijkKvk || []).slice(0, 300).map(k => ({ ...publiekeKvk(k), houder: k.houder, viaOnderneming: !!k.supplierCode })) };
  }
  // de vloot van RTG (autoverhuur, tweewielers) in het RDW-register zetten, zodat
  // een kenteken-check op een huurauto "bekend" met een APK-datum teruggeeft
  function registreerVloot() {
    seed();
    let n = 0;
    const bestaat = new Set((db.data.rijkVoertuigen || []).map(v => v.kenteken));
    for (const s of (db.data.suppliers || [])) {
      if (s.type !== 'verhuur' && s.type !== 'tweewielers') continue;
      for (const a of (s.autos || [])) {
        const kt = String(a.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (kt.length < 4 || bestaat.has(kt)) continue;
        const h = hash(kt);
        const apk = new Date(); apk.setMonth(apk.getMonth() + 7 + (h % 11));
        db.data.rijkVoertuigen.unshift({ id: id(), key: null, vloot: s.code, kenteken: kt,
          merk: a.name || s.name, bouwjaar: 2018 + (h % 7), apkTot: apk.toISOString().slice(0, 10), geschorst: false, at: nu() });
        bestaat.add(kt); n++;
      }
    }
    if (n) { db.data.rijkVoertuigen = db.data.rijkVoertuigen.slice(0, 60000); save(); }
    return n;
  }
  // RDW-controle op een kenteken; door autoverhuur/OV te hergebruiken vóór verhuur/inzet
  function rdwCheck(kenteken) {
    seed();
    const kt = String(kenteken || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (kt.length < 4) return { status: 400, error: 'Vul een geldig kenteken in.' };
    const v = (db.data.rijkVoertuigen || []).find(x => x.kenteken === kt);
    if (!v) return { ok: true, kenteken: kt, bekend: false };
    const apkGeldig = !v.geschorst && v.apkTot >= new Date().toISOString().slice(0, 10);
    return { ok: true, kenteken: kt, bekend: true, merk: v.merk, bouwjaar: v.bouwjaar, apkTot: v.apkTot, geschorst: !!v.geschorst, apkGeldig };
  }

  /* ---------- pijler 7: provincie (subsidies) ---------- */
  function provincieSubsidies() {
    seed();
    return { ok: true, regelingen: Object.entries(SUBSIDIES).map(([k, v]) => ({ id: k, label: v.label, max: v.max })) };
  }
  function subsidieAanvraag(houder, data) {
    seed();
    data = data || {};
    const regeling = SUBSIDIES[data.regeling] ? data.regeling : null;
    if (!regeling) return { status: 400, error: 'Kies een geldige subsidieregeling.' };
    const project = schoon(data.project, 300);
    if (project.length < 6) return { status: 400, error: 'Omschrijf je project.' };
    const gevraagd = Math.min(SUBSIDIES[regeling].max, Math.max(0, eur(data.bedrag)));
    const s = { id: id(), ref: ref('SB'), key: houder.key || null, supplierCode: houder.supplierCode || null,
      aanvrager: houder.codenaam || houder.bedrijf || null, regeling, regelingLabel: SUBSIDIES[regeling].label,
      project, gevraagd, status: 'aangevraagd', at: nu() };
    db.data.rijkSubsidies.unshift(s);
    db.data.rijkSubsidies = db.data.rijkSubsidies.slice(0, 40000);
    if (houder.key) bericht(houder.key, 'Provincie', 'Subsidieaanvraag ' + s.regelingLabel, 'Je aanvraag (€ ' + gevraagd + ') is ontvangen en wordt beoordeeld.', 'subsidie');
    save();
    return { ok: true, subsidie: publiekeSubsidie(s) };
  }
  function publiekeSubsidie(s) { return { ref: s.ref, regeling: s.regeling, regelingLabel: s.regelingLabel, project: s.project, gevraagd: s.gevraagd, toegekend: s.toegekend || 0, status: s.status, at: s.at }; }
  function mijnSubsidies(houder) {
    seed();
    const list = (db.data.rijkSubsidies || []).filter(s => (houder.key && s.key === houder.key) || (houder.supplierCode && s.supplierCode === houder.supplierCode));
    return { ok: true, subsidies: list.slice(0, 30).map(publiekeSubsidie) };
  }

  /* ---------- pijler 8: waterschap ---------- */
  function ensureWaterAanslagen(key) {
    if (!key) return;
    const j = jaar();
    if ((db.data.waterAanslagen || []).some(a => a.key === key && a.jaar === j)) return;
    const h = hash('water' + String(key) + j);
    WATERHEFFINGEN.forEach((w, i) => {
      const bedrag = w.basis + ((h >>> (i * 5)) % (w.spreiding + 1));
      db.data.waterAanslagen.unshift({ id: id(), ref: ref('WB'), key, soort: w.soort, jaar: j, bedrag, betaald: false, at: nu() });
    });
    db.data.waterAanslagen = db.data.waterAanslagen.slice(0, 40000);
    save();
  }
  function waterschapMijn(key) {
    seed(); ensureWaterAanslagen(key);
    return { ok: true, aanslagen: (db.data.waterAanslagen || []).filter(a => a.key === key)
      .map(a => ({ ref: a.ref, soort: a.soort, jaar: a.jaar, bedrag: a.bedrag, betaald: !!a.betaald })) };
  }
  function waterschapBetaal(key, r) {
    const a = (db.data.waterAanslagen || []).find(x => x.ref === String(r || '') && x.key === key);
    if (!a) return { status: 404, error: 'Aanslag niet gevonden.' };
    if (a.betaald) return { status: 409, error: 'Deze aanslag is al betaald.' };
    a.betaald = true; a.betaaldAt = nu();
    bericht(key, 'Waterschap', 'Betaling ontvangen', 'Je betaling van € ' + a.bedrag + ' (' + a.soort + ') is ontvangen.', 'water');
    save();
    return { ok: true, aanslag: { ref: a.ref, soort: a.soort, jaar: a.jaar, bedrag: a.bedrag, betaald: true } };
  }
  function waterMeld(sess, codenaam, data) {
    seed();
    data = data || {};
    const soort = WATERMELD[data.soort] ? data.soort : 'wateroverlast';
    const tekst = schoon(data.tekst, 500);
    if (tekst.length < 4) return { status: 400, error: 'Omschrijf kort wat er aan de hand is.' };
    const m = { id: id(), ref: ref('WM'), soort, soortLabel: WATERMELD[soort], tekst, locatie: schoon(data.locatie, 120) || null,
      melderKey: sess.key, melder: codenaam, status: 'nieuw', updates: [], at: nu() };
    db.data.waterMeldingen.unshift(m);
    db.data.waterMeldingen = db.data.waterMeldingen.slice(0, 40000);
    save();
    return { ok: true, melding: publiekeWaterMelding(m) };
  }
  function publiekeWaterMelding(m) {
    return { ref: m.ref, soort: m.soort, soortLabel: m.soortLabel, tekst: m.tekst, locatie: m.locatie, status: m.status,
      updates: (m.updates || []).map(u => ({ tekst: u.tekst, at: u.at })), at: m.at };
  }
  function mijnWaterMeldingen(key) {
    return { ok: true, meldingen: (db.data.waterMeldingen || []).filter(m => m.melderKey === key).slice(0, 40).map(publiekeWaterMelding) };
  }

  /* ---------- rijksambtenaren (partner-app) ---------- */
  function regie() {
    seed();
    return { ok: true,
      toeslagenOpen: (db.data.rijkToeslagen || []).filter(t => t.status === 'aangevraagd').length,
      uitkeringenOpen: (db.data.rijkUitkeringen || []).filter(u => ['aangevraagd', 'in behandeling'].includes(u.status)).length,
      bezwarenOpen: (db.data.rijkBezwaren || []).filter(b => ['ingediend', 'in behandeling'].includes(b.status)).length,
      subsidiesOpen: (db.data.rijkSubsidies || []).filter(s => s.status === 'aangevraagd').length,
      waterMeldingenOpen: (db.data.waterMeldingen || []).filter(m => !['opgelost', 'afgewezen'].includes(m.status)).length,
      aangiftenJaar: (db.data.rijkAanslagen || []).filter(a => a.jaar === jaar()).length,
      inschrijvingen: (db.data.rijkKvk || []).length,
      stemmen: db.data.rijkVerkiezing ? (db.data.rijkStemmen || []).filter(s => s.verkiezingId === db.data.rijkVerkiezing.id).length : 0 };
  }
  function subsidiesLijst(filter) {
    seed(); filter = filter || {};
    let list = (db.data.rijkSubsidies || []);
    list = filter.status ? list.filter(s => s.status === filter.status) : list.filter(s => s.status === 'aangevraagd');
    return { ok: true, subsidies: list.slice(0, 200).map(s => ({ ...publiekeSubsidie(s), aanvrager: s.aanvrager })) };
  }
  function subsidieBeslis(actor, r, data) {
    data = data || {};
    const s = (db.data.rijkSubsidies || []).find(x => x.ref === String(r || ''));
    if (!s) return { status: 404, error: 'Aanvraag niet gevonden.' };
    const besluit = ['toegekend', 'afgewezen', 'in behandeling'].includes(data.besluit) ? data.besluit : null;
    if (!besluit) return { status: 400, error: 'Kies een geldig besluit.' };
    s.status = besluit;
    if (besluit === 'toegekend') s.toegekend = Math.min(s.gevraagd, data.bedrag == null ? s.gevraagd : Math.max(0, eur(data.bedrag)));
    s.besluit = { door: actor || 'rijk', at: nu() };
    if (s.key) bericht(s.key, 'Provincie', 'Besluit ' + s.regelingLabel,
      besluit === 'toegekend' ? 'Je subsidie van € ' + s.toegekend + ' is toegekend.' : besluit === 'afgewezen' ? 'Je aanvraag is afgewezen.' : 'Je aanvraag is in behandeling.', 'subsidie');
    save();
    return { ok: true, subsidie: publiekeSubsidie(s) };
  }
  function waterMeldingenLijst(filter) {
    seed(); filter = filter || {};
    let list = (db.data.waterMeldingen || []);
    list = filter.status ? list.filter(m => m.status === filter.status) : list.filter(m => !['opgelost', 'afgewezen'].includes(m.status));
    return { ok: true, meldingen: list.slice(0, 200).map(m => ({ ...publiekeWaterMelding(m), melder: m.melder })) };
  }
  function waterMeldingZet(actor, r, data) {
    data = data || {};
    const m = (db.data.waterMeldingen || []).find(x => x.ref === String(r || ''));
    if (!m) return { status: 404, error: 'Melding niet gevonden.' };
    if (typeof data.status === 'string' && WATER_STATUS.includes(data.status)) m.status = data.status;
    const note = schoon(data.update, 300);
    if (note) m.updates.unshift({ tekst: note, at: nu(), door: actor || 'waterschap' });
    m.updates = (m.updates || []).slice(0, 40);
    save();
    return { ok: true, melding: publiekeWaterMelding(m) };
  }
  function toeslagenLijst(filter) {
    seed(); filter = filter || {};
    let list = (db.data.rijkToeslagen || []);
    list = filter.status ? list.filter(t => t.status === filter.status) : list.filter(t => t.status === 'aangevraagd');
    return { ok: true, toeslagen: list.slice(0, 200).map(t => ({ ...publiekeToeslag(t), aanvrager: t.codenaam })) };
  }
  function toeslagBeslis(actor, r, data) {
    data = data || {};
    const t = (db.data.rijkToeslagen || []).find(x => x.ref === String(r || ''));
    if (!t) return { status: 404, error: 'Aanvraag niet gevonden.' };
    const besluit = ['toegekend', 'afgewezen', 'in behandeling'].includes(data.besluit) ? data.besluit : null;
    if (!besluit) return { status: 400, error: 'Kies een geldig besluit.' };
    t.status = besluit; t.besluit = { door: actor || 'rijk', at: nu() };
    if (t.key) bericht(t.key, 'Dienst Toeslagen', 'Besluit ' + t.soortLabel,
      besluit === 'toegekend' ? 'Je toeslag van € ' + t.maandbedrag + ' per maand is toegekend.' :
      besluit === 'afgewezen' ? 'Je aanvraag is afgewezen.' : 'Je aanvraag is in behandeling genomen.', 'toeslag');
    save();
    return { ok: true, toeslag: publiekeToeslag(t) };
  }
  function uitkeringenLijst(filter) {
    seed(); filter = filter || {};
    let list = (db.data.rijkUitkeringen || []);
    list = filter.status ? list.filter(u => u.status === filter.status) : list.filter(u => ['aangevraagd', 'in behandeling'].includes(u.status));
    return { ok: true, uitkeringen: list.slice(0, 200).map(u => ({ ...publiekeUitkering(u), aanvrager: u.codenaam, toelichting: u.toelichting })) };
  }
  function uitkeringBeslis(actor, r, data) {
    data = data || {};
    const u = (db.data.rijkUitkeringen || []).find(x => x.ref === String(r || ''));
    if (!u) return { status: 404, error: 'Aanvraag niet gevonden.' };
    const besluit = ['toegekend', 'afgewezen', 'in behandeling'].includes(data.besluit) ? data.besluit : null;
    if (!besluit) return { status: 400, error: 'Kies een geldig besluit.' };
    u.status = besluit; u.besluit = { door: actor || 'rijk', motivatie: schoon(data.motivatie, 300) || null, at: nu() };
    if (u.key) bericht(u.key, u.soort === 'aow' || u.soort === 'kinderbijslag' ? 'SVB' : 'UWV', 'Besluit ' + u.soortLabel,
      besluit === 'toegekend' ? 'Je aanvraag is toegekend.' : besluit === 'afgewezen' ? 'Je aanvraag is afgewezen.' : 'Je aanvraag is in behandeling.', 'sociaal');
    save();
    return { ok: true, uitkering: publiekeUitkering(u) };
  }
  function bezwarenLijst(filter) {
    seed(); filter = filter || {};
    let list = (db.data.rijkBezwaren || []);
    list = filter.status ? list.filter(b => b.status === filter.status) : list.filter(b => ['ingediend', 'in behandeling'].includes(b.status));
    return { ok: true, bezwaren: list.slice(0, 200).map(b => ({ ref: b.ref, tegen: b.tegen, reden: b.reden, status: b.status, aanvrager: b.codenaam, at: b.at })) };
  }
  function bezwaarBeslis(actor, r, data) {
    data = data || {};
    const b = (db.data.rijkBezwaren || []).find(x => x.ref === String(r || ''));
    if (!b) return { status: 404, error: 'Bezwaar niet gevonden.' };
    const besluit = ['gegrond', 'ongegrond', 'in behandeling'].includes(data.besluit) ? data.besluit : null;
    if (!besluit) return { status: 400, error: 'Kies een geldig besluit.' };
    b.status = besluit; b.besluit = { door: actor || 'rijk', motivatie: schoon(data.motivatie, 400) || null, at: nu() };
    if (b.key) bericht(b.key, 'Rijksoverheid', 'Beslissing op bezwaar', 'Je bezwaar tegen "' + b.tegen + '" is ' + besluit + ' verklaard.', 'bezwaar');
    save();
    return { ok: true, bezwaar: { ref: b.ref, tegen: b.tegen, status: b.status } };
  }
  function bekendmakingMaak(actor, data) {
    seed(); data = data || {};
    const titel = schoon(data.titel, 120), tekst = schoon(data.tekst, 800);
    if (titel.length < 3 || tekst.length < 3) return { status: 400, error: 'Vul een titel en tekst in.' };
    const soort = ['algemeen', 'belasting', 'rdw', 'sociaal', 'wet'].includes(data.soort) ? data.soort : 'algemeen';
    const b = { id: id(), titel, tekst, soort, door: actor || 'rijk', at: nu() };
    db.data.rijkBekend.unshift(b);
    db.data.rijkBekend = db.data.rijkBekend.slice(0, 500);
    save();
    return { ok: true, bekendmaking: { id: b.id, titel, tekst, soort, at: b.at } };
  }
  function verkiezingSluit(open) {
    seed();
    const v = db.data.rijkVerkiezing;
    if (!v) return { status: 404, error: 'Er is geen stemming.' };
    v.open = !!open; v.gesloten = open ? null : nu();
    save();
    return { ok: true, ...verkiezing(null) };
  }

  /* AI-hulp bij de aangifte: leest een vrije omschrijving en stelt inkomen/aftrek
     voor (Claude, met een deterministische regel-fallback zodat het altijd werkt).
     Doet niets automatisch · het lid vult de aangifte zelf en dient hem in. */
  function regelAangifte(tekst) {
    const t = String(tekst || '');
    const num = re => { const m = t.match(re); return m ? eur(m[1].replace(/[.\s]/g, '')) : 0; };
    const alle = (t.match(/\d[\d.\s]{2,}/g) || []).map(x => eur(x.replace(/[.\s]/g, '')));
    let inkomen = num(/(?:verdien|inkomen|salaris|bruto)[^\d]{0,12}(\d[\d.\s]{2,})/i);
    // aftrek staat vaak vóór of ná het trefwoord ("3200 aftrek" of "aftrek 3200")
    let aftrek = num(/(\d[\d.\s]{2,})[^\d]{0,14}(?:aftrek|hypotheek|zorgkost|gift)/i)
      || num(/(?:aftrek|hypotheek|zorgkosten|gift)[^\d]{0,14}(\d[\d.\s]{2,})/i);
    if (!inkomen && alle.length) inkomen = Math.max.apply(null, alle);
    if (!aftrek && alle.length > 1) aftrek = [...alle].sort((a, b) => b - a)[1];
    return { inkomen, aftrek };
  }
  async function aangifteAdvies(tekst) {
    const val = regelAangifte(tekst);
    if (!anthropic) return { ok: true, ...val, bron: 'regel' };
    try {
      const resp = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 120,
        system: 'Je helpt iemand met een eenvoudige aangifte inkomstenbelasting. Haal uit de tekst het bruto jaarinkomen en de totale aftrekposten in hele euro\'s. Antwoord uitsluitend als JSON: {"inkomen":<getal>,"aftrek":<getal>}.',
        messages: [{ role: 'user', content: String(tekst || '').slice(0, 400) }]
      });
      const m = ((resp.content.find(c => c.type === 'text') || {}).text || '').match(/\{[\s\S]*\}/);
      const j = m ? JSON.parse(m[0]) : {};
      return { ok: true, inkomen: eur(j.inkomen) || val.inkomen, aftrek: eur(j.aftrek) || val.aftrek, bron: 'ai' };
    } catch (e) { return { ok: true, ...val, bron: 'regel' }; }
  }

  return {
    overheid: {
      seed, isRijk, magBehandelen, TOESLAGEN, UITKERINGEN, RECHTSVORMEN, RIJBEWIJS_CATS, IB,
      // inwoners
      berichten, berichtGelezen, berekenIB, aangifteDoe, mijnAanslagen, aanslagBetaal,
      toeslagAanvraag, mijnToeslagen, voertuigen, voertuigMeld, voertuigSchors, rijbewijs, rijbewijsVerleng,
      kvkInschrijven, kvkMijn, uitkeringAanvraag, mijnUitkeringen,
      verkiezing, stem, bekendmakingen, bezwaarIndienen, mijnBezwaren, aangifteAdvies,
      // provincie & waterschap (regionaal)
      provincieSubsidies, subsidieAanvraag, mijnSubsidies,
      waterschapMijn, waterschapBetaal, waterMeld, mijnWaterMeldingen,
      // koppelingen met de rest van het ecosysteem
      kvkVoorSupplier, kvkZorg, kvkLijst, rdwCheck, registreerVloot,
      // ambtenaren
      regie, toeslagenLijst, toeslagBeslis, uitkeringenLijst, uitkeringBeslis,
      bezwarenLijst, bezwaarBeslis, bekendmakingMaak, verkiezingSluit,
      subsidiesLijst, subsidieBeslis, waterMeldingenLijst, waterMeldingZet
    }
  };
}

module.exports = { maakOverheid };
