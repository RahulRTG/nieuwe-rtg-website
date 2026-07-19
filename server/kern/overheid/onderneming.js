/* Overheid-domein "onderneming": het KVK-handelsregister (inschrijven, uittreksel,
   de idempotente één-tik-inschrijving voor een onderneming en het ambtenaren-
   overzicht) en de sociale zekerheid van UWV/SVB (WW, bijstand, AOW, kinderbijslag)
   met de behandelkant. Krijgt de gedeelde ctx van kern/overheid/index.js. */
module.exports = (ctx) => {
  const { db, save, nu, id, ref, schoon, hash, seed, bericht, RECHTSVORMEN, UITKERINGEN } = ctx;

  /* ---- KVK ondernemersloket ---- */
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

  /* ---- sociale zekerheid (UWV/SVB) ---- */
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

  return { kvkInschrijven, kvkMijn, kvkVoorSupplier, kvkZorg, kvkLijst,
    uitkeringAanvraag, mijnUitkeringen, uitkeringenLijst, uitkeringBeslis };
};
