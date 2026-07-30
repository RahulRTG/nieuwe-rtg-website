/* De persoonlijke naamlaag: een lid mag een vriend in het EIGEN account een
   eigen naam geven (bijvoorbeeld de echte naam). Die naam is een etiket in
   het eigen account -- niet meer dan dat: het systeem blijft op codenamen
   draaien, de kluis wordt niet aangeraakt, en niemand anders ziet het
   etiket ooit. resolveer() is de ene functie waarmee ook Rahul begrijpt
   wie er bedoeld wordt als iemand de eigen naam gebruikt.
   Codenamen zijn gemengd van kast ("Witte Reiger 5764"): we bewaren ze
   zoals ze zijn en vergelijken kast-ongevoelig. */
module.exports = ({ db, save, schoon }) => {

  const bak = () => {
    if (!db.data.eigenNamen) db.data.eigenNamen = {};   // eigen sleutel -> { codenaam: 'Eigen naam' }
    return db.data.eigenNamen;
  };
  const mijn = key => bak()[key] || {};
  const laag = s => String(s == null ? '' : s).trim().toLowerCase();

  // Zet (of wis, bij lege naam) het eigen etiket voor een codenaam.
  function zetNaam(key, codenaamIn, naamIn) {
    const codenaam = String(codenaamIn || '').trim();
    if (!codenaam) return { status: 400, error: 'Voor wie is deze naam?' };
    const naam = schoon(naamIn, 60);
    const b = bak();
    if (!b[key]) b[key] = {};
    // een bestaand etiket voor dezelfde codenaam (andere kast) eerst weg
    for (const c of Object.keys(b[key])) if (laag(c) === laag(codenaam)) delete b[key][c];
    if (naam) b[key][codenaam] = naam;
    // hoogstens 500 etiketten per account: ruim voor een leven aan vrienden
    if (Object.keys(b[key]).length > 500) { delete b[key][codenaam]; return { status: 409, error: 'Te veel eigen namen.' }; }
    save();
    return { ok: true, codenaam, naam: naam || null };
  }

  // De eigen naam voor een codenaam, of null als er geen etiket is.
  function naamVoor(key, codenaam) {
    const k = laag(codenaam);
    for (const [c, n] of Object.entries(mijn(key))) if (laag(c) === k) return n;
    return null;
  }

  // De hele eigen kaart (codenaam -> naam), voor de schermen van dit account.
  function kaartVoor(key) { return { ...mijn(key) }; }

  // Verrijk een lijst met een veld eigenNaam, alleen voor dit account.
  function verrijk(key, lijst, codeVeld) {
    const veld = codeVeld || 'codename';
    const kaart = Object.entries(mijn(key)).map(([c, n]) => [laag(c), n]);
    if (!kaart.length) return lijst || [];
    return (lijst || []).map(x => {
      const k = x && x[veld] ? laag(x[veld]) : null;
      const hit = k && kaart.find(([c]) => c === k);
      return hit ? { ...x, eigenNaam: hit[1] } : x;
    });
  }

  // Alleen op de eigen etiketten: van invoer (of een zin met de eigen naam
  // erin) naar de codenaam zoals het systeem hem kent. Null zonder etiket.
  function aliasNaar(key, invoerIn) {
    const invoer = laag(invoerIn);
    if (!invoer) return null;
    const kaart = mijn(key);
    for (const [code, naam] of Object.entries(kaart))
      if (laag(naam) === invoer) return code;
    let beste = null;
    for (const [code, naam] of Object.entries(kaart)) {
      const n = laag(naam);
      if (n.length >= 3 && new RegExp('(^|[^\\p{L}])' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^\\p{L}]|$)', 'iu').test(invoer))
        if (!beste || naam.length > beste.naam.length) beste = { code, naam };
    }
    return beste ? beste.code : null;
  }

  // Van invoer (eigen naam OF codenaam) naar de codenaam die het systeem
  // kent. Eigen namen winnen; anders was het waarschijnlijk al een codenaam.
  function resolveer(key, invoerIn) {
    const via = aliasNaar(key, invoerIn);
    if (via) return via;
    const c = String(invoerIn || '').trim();
    return c || null;
  }

  return { zetNaam, naamVoor, kaartVoor, verrijk, aliasNaar, resolveer };
};
