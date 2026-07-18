/* Autoverkoop (deelmodule): de showroom: verkoop aan/uit, auto's beheren
   met foto's, de publieke showroom, aanbevolen auto's en vindAuto. Krijgt
   de gedeelde context een keer bij het opstarten vanuit kern/autoverkoop.js. */
module.exports = (ctx) => {
  const { db, save, crypto, findSupplier, notify, notifySupplier, sseToCustomer, sseToSupplier, sseToOffice, media,
    KETEN_PROEFRIT, KETEN_KOOP, KLAAR, BRANDSTOF,
    deals, isVerkoopBedrijf, ver, magVerkopen, autoNaam, id, nu, schoon, getal } = ctx;
  function zetAan(s, aan) {
    if (!isVerkoopBedrijf(s)) return { status: 409, error: 'Autoverkoop hoort bij een verhuur/autobedrijf.' };
    ver(s).aan = aan !== false; save();
    return { status: 200, ok: true, aan: ver(s).aan };
  }
  async function zetAuto(s, data) {
    if (!isVerkoopBedrijf(s)) return { status: 409, error: 'Autoverkoop hoort bij een verhuur/autobedrijf.' };
    const v = ver(s);
    const merk = schoon(data.merk, 40);
    if (!merk) return { status: 400, error: 'Vul minstens het merk in.' };
    let a = data.id ? v.showroom.find(x => x.id === data.id) : null;
    if (!a) { a = { id: id('AUTO') }; v.showroom.push(a); }
    a.merk = merk;
    a.model = schoon(data.model, 40) || a.model || '';
    a.jaar = getal(data.jaar, 1950, 2100, a.jaar || new Date().getFullYear());
    a.km = getal(data.km, 0, 2e6, a.km || 0);
    a.prijs = getal(data.prijs, 0, 1e7, a.prijs || 0);
    a.brandstof = BRANDSTOF.includes(data.brandstof) ? data.brandstof : (a.brandstof || 'Benzine');
    a.transmissie = schoon(data.transmissie, 20) || a.transmissie || 'Automaat';
    a.kleur = schoon(data.kleur, 30) || a.kleur || '';
    a.vermogenPk = getal(data.vermogenPk, 0, 3000, a.vermogenPk || 0);
    a.opties = Array.isArray(data.opties) ? data.opties.map(o => schoon(o, 40)).filter(Boolean).slice(0, 30) : (a.opties || []);
    a.garantieMnd = getal(data.garantieMnd, 0, 120, a.garantieMnd != null ? a.garantieMnd : 12);
    a.historie = schoon(data.historie, 400) || a.historie || '';
    if (Array.isArray(data.fotos)) {
      // De showroomfoto's naar de mediastore; in db.data alleen /media-verwijzingen.
      // Bestaande verwijzingen (geen data:-URL) blijven zoals ze zijn.
      const uit = [];
      for (const f of data.fotos.slice(0, 8)) {
        if (typeof f !== 'string') continue;
        if (media && media.isRef(f)) { uit.push(f); continue; }
        const ref = media ? await media.bewaarPubliek(f, 900 * 1024) : null;
        if (ref) uit.push(ref);
      }
      a.fotos = uit;
    }
    if (!Array.isArray(a.fotos)) a.fotos = [];
    a.vip = data.vip === true;
    a.status = ['te koop', 'gereserveerd', 'verkocht'].includes(data.status) ? data.status : (a.status || 'te koop');
    save();
    return { status: 200, ok: true, auto: a };
  }
  function verwijderAuto(s, autoId) {
    const v = ver(s);
    const a = v.showroom.find(x => x.id === autoId);
    if (a) a.status = 'verkocht';        // nooit hard weg: lopende deals verwijzen ernaar
    save();
    return { status: 200, ok: true };
  }

  /* ---- de showroom voor leden ---- */
  function publiekeAuto(a, s) {
    return { id: a.id, supplierCode: s.code, supplierNaam: s.name, naam: autoNaam(a), merk: a.merk, model: a.model,
      jaar: a.jaar, km: a.km, prijs: a.prijs, brandstof: a.brandstof, transmissie: a.transmissie, kleur: a.kleur,
      vermogenPk: a.vermogenPk, opties: a.opties, garantieMnd: a.garantieMnd, historie: a.historie,
      fotos: a.fotos, vip: !!a.vip, status: a.status };
  }
  function bedrijven() { return db.data.suppliers.filter(s => magVerkopen(s)); }
  function showroom(opts) {
    opts = opts || {};
    const zoek = String(opts.zoek || '').toLowerCase();
    const uit = [];
    for (const s of bedrijven()) {
      for (const a of ver(s).showroom) {
        if (a.status !== 'te koop') continue;   // gereserveerd/verkocht niet in de vrije showroom
        if (opts.brandstof && a.brandstof !== opts.brandstof) continue;
        if (opts.maxPrijs && a.prijs > Number(opts.maxPrijs)) continue;
        if (zoek && !(autoNaam(a) + ' ' + a.kleur).toLowerCase().includes(zoek)) continue;
        uit.push(publiekeAuto(a, s));
      }
    }
    // VIP eerst, dan nieuwste
    uit.sort((x, y) => (y.vip - x.vip) || (y.jaar - x.jaar) || (x.prijs - y.prijs));
    return uit.slice(0, 200);
  }
  // Slimme aanbevelingen: de exclusieve/nieuwste stukken bovenaan (curated).
  function aanbevolen(key) {
    return showroom({}).filter(a => a.status === 'te koop').slice(0, 6);
  }
  function vindAuto(supplierCode, autoId) {
    const s = findSupplier(supplierCode);
    if (!magVerkopen(s)) return null;
    const a = ver(s).showroom.find(x => x.id === autoId);
    return a ? { s, a } : null;
  }

  /* ---- proefrit ---- */
  return { zetAan, zetAuto, verwijderAuto, publiekeAuto, bedrijven, showroom, aanbevolen, vindAuto };
};
