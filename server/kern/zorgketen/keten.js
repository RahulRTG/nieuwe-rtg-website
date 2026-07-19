/* De zorgketen, deelbestand "keten": de schakels tussen de spreekkamers en de rest
   van de zorg. De recepten (voorschrijven bij de huisarts/ziekenhuis/specialist,
   afhandelen bij de apotheek), de eerste hulp (SEH: binnenkomst met triagekleur, dan
   in behandeling en opgenomen of naar huis) en de verwijzingen naar de medisch
   specialist of beauty medical. Krijgt de gedeelde ctx van kern/zorgketen/index.js. */
module.exports = (ctx) => {
  const { crypto, save, nu, schoon, bak, soortVan, sehRij, findSupplier,
    VOORSCHRIJVERS, VERWIJZERS, AGENDAS, TRIAGE } = ctx;

  /* ---------- recepten: voorschrijven en uitreiken ---------- */
  function receptMaak(code, b) {
    if (!VOORSCHRIJVERS.includes(soortVan(code))) return { status: 403, error: 'Alleen de huisarts, het ziekenhuis of de specialist schrijft voor.' };
    const apo = findSupplier(b.apotheek);
    if (!apo || apo.type !== 'apotheek') return { status: 404, error: 'Deze apotheek kennen we niet.' };
    const middel = schoon(b.middel, 120);
    if (!middel) return { status: 400, error: 'Welk middel schrijft u voor?' };
    const r = {
      id: crypto.randomBytes(4).toString('hex'), van: code, apotheek: apo.code,
      middel, dosering: schoon(b.dosering, 120), status: 'voorgeschreven', at: nu()
    };
    bak().recepten.unshift(r);
    if (bak().recepten.length > 2000) bak().recepten.pop();
    save();
    return { ok: true, recept: r };
  }
  function receptZet(code, id, status) {
    if (soortVan(code) !== 'apotheek') return { status: 403, error: 'Alleen de apotheek handelt recepten af.' };
    const r = bak().recepten.find(x => x.id === id && x.apotheek === code);
    if (!r) return { status: 404, error: 'Dit recept staat niet bij deze apotheek.' };
    if (!['klaar', 'uitgereikt', 'geweigerd'].includes(status)) return { status: 400, error: 'Kies klaar, uitgereikt of geweigerd.' };
    if (r.status === 'uitgereikt') return { status: 409, error: 'Dit recept is al uitgereikt.' };
    r.status = status;
    save();
    return { ok: true, recept: r };
  }

  /* ---------- de eerste hulp: triagekleuren en de wachtrij ---------- */
  function sehBinnen(code, b) {
    if (soortVan(code) !== 'ziekenhuis') return { status: 403, error: 'Alleen het ziekenhuis heeft een eerste hulp.' };
    const klacht = schoon(b.klacht, 200);
    if (!klacht) return { status: 400, error: 'Waarmee komt de patient binnen?' };
    if (!TRIAGE.includes(b.triage)) return { status: 400, error: 'Kies een triagekleur: rood, oranje, geel, groen of blauw.' };
    const e = { id: crypto.randomBytes(4).toString('hex'), klacht, triage: b.triage, via: schoon(b.via, 40) || 'balie', status: 'wacht', at: nu() };
    sehRij(code).push(e);
    if (sehRij(code).length > 300) sehRij(code).shift();
    save();
    return { ok: true, patient: e };
  }
  function sehZet(code, id, status) {
    if (soortVan(code) !== 'ziekenhuis') return { status: 403, error: 'Alleen het ziekenhuis heeft een eerste hulp.' };
    const e = sehRij(code).find(x => x.id === id);
    if (!e) return { status: 404, error: 'Deze patient staat niet in de rij.' };
    if (!['in-behandeling', 'opgenomen', 'naar-huis'].includes(status)) return { status: 400, error: 'Kies in-behandeling, opgenomen of naar-huis.' };
    e.status = status;
    save();
    return { ok: true, patient: e };
  }

  /* ---------- verwijzingen: van de spreekkamer naar de specialist ---------- */
  function verwijsMaak(code, b) {
    if (!VERWIJZERS.includes(soortVan(code))) return { status: 403, error: 'Alleen de huisarts of het ziekenhuis verwijst door.' };
    const naar = findSupplier(b.naar);
    if (!naar || !AGENDAS.includes(naar.type)) return { status: 404, error: 'Verwijzen kan naar een medisch specialist of een beauty medical-kliniek.' };
    const reden = schoon(b.reden, 200);
    if (!reden) return { status: 400, error: 'Wat is de reden van de verwijzing?' };
    const v = { id: crypto.randomBytes(4).toString('hex'), van: code, naar: naar.code, reden, status: 'nieuw', at: nu() };
    bak().verwijzingen.unshift(v);
    if (bak().verwijzingen.length > 1000) bak().verwijzingen.pop();
    save();
    return { ok: true, verwijzing: v };
  }
  function verwijsZet(code, id, status) {
    const v = bak().verwijzingen.find(x => x.id === id && x.naar === code);
    if (!v) return { status: 404, error: 'Deze verwijzing staat niet in uw inbox.' };
    if (!['gepland', 'gezien', 'terugverwezen'].includes(status)) return { status: 400, error: 'Kies gepland, gezien of terugverwezen.' };
    v.status = status;
    save();
    return { ok: true, verwijzing: v };
  }

  return { receptMaak, receptZet, sehBinnen, sehZet, verwijsMaak, verwijsZet };
};
