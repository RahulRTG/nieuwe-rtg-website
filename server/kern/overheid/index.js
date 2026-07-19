/* De Overheid: de landelijke laag boven de gemeente (kern/gemeente.js). Waar de
   gemeente lokaal is, regelt deze laag het rijk · de dingen die een inwoner of
   ondernemer met "Den Haag" doet, in MijnOverheid-stijl. Drie soorten gebruikers
   (inwoners, ondernemers, rijksambtenaren) en acht pijlers.

   Privacy by design: alles draait op codenamen; de echte naam blijft in de kluis.
   Nooit de belofte dat een besluit of betaling al bij de dienst verwerkt is · een
   aanvraag is "ingediend"/"in behandeling" tot een mens beslist. De berekeningen
   zijn een heldere demo-benadering, geen fiscaal advies.

   Dit is de orchestrator: maakOverheid bouwt een gedeelde ctx (db + helpers +
   seed + Berichtenbox + constanten) en stelt de domein-slices samen. Elk domein
   woont in een eigen bestand van 5-10 KB:
     belasting.js   Belastingdienst (aangifte IB) + Dienst Toeslagen
     rdw.js         voertuigregister, rijbewijs, vloot- en kentekencheck
     onderneming.js KVK-handelsregister + sociale zekerheid (UWV/SVB)
     regio.js       provincie (subsidies) + waterschap (belasting + meldingen)
     bestuur.js     Berichtenbox-lezers, referendum, bezwaar, bekendmaking, regie */

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
  function magBehandelen(s) { return isRijk(s); }

  // een bericht in de Berichtenbox van een inwoner zetten (gedeeld door de slices)
  function bericht(key, van, titel, tekst, soort) {
    db.data.rijkBerichten.unshift({ id: id(), key, van: van || 'Rijksoverheid', titel: schoon(titel, 120), tekst: schoon(tekst, 600), soort: soort || 'algemeen', gelezen: false, at: nu() });
    db.data.rijkBerichten = db.data.rijkBerichten.slice(0, 50000);
  }
  // pijler 1: Berichtenbox (lezen + gelezen markeren)
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

  const ctx = {
    db, save, crypto, anthropic, findSupplier, notify, notifySupplier, sseToSupplier,
    nu, jaar, id, ref, schoon, eur, hash, seed, bericht,
    IB, TOESLAGEN, UITKERINGEN, RECHTSVORMEN, SUBSIDIES, WATERHEFFINGEN, WATERMELD, WATER_STATUS
  };

  const api = {
    seed, isRijk, magBehandelen, berichten, berichtGelezen,
    TOESLAGEN, UITKERINGEN, RECHTSVORMEN, RIJBEWIJS_CATS, IB
  };
  Object.assign(api,
    require('./belasting')(ctx),
    require('./rdw')(ctx),
    require('./onderneming')(ctx),
    require('./regio')(ctx),
    require('./bestuur')(ctx));
  return { overheid: api };
}

module.exports = { maakOverheid };
