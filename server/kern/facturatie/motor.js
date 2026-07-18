/* Facturatie (deelmodule): de factuurmotor: de opslag, nummering, het
   standaard btw-tarief per genre, regels verwerken en het tweezijdige
   boeken (op code of codenaam). Krijgt de gedeelde context een keer bij
   het opstarten vanuit kern/facturatie.js. */
module.exports = (ctx) => {
  const { db, save, crypto, findSupplier, keyVanCodenaam, notify, notifySupplier, sseToCustomer, sseToSupplier, factuur, anthropic, schoon,
    SOORTEN, LAAG_BTW_TYPES, nu, scho, rond } = ctx;
  const publiek = (f) => ctx.publiek(f);
  function store() {
    if (!Array.isArray(db.data.facturen)) db.data.facturen = [];
    if (typeof db.data.factuurTeller !== 'number') db.data.factuurTeller = 0;
    return db.data;
  }
  function nummer() {
    const s = store();
    s.factuurTeller += 1;
    return 'RTG-' + new Date().getFullYear() + '-' + String(s.factuurTeller).padStart(6, '0');
  }
  function standaardBtw(supplier) {
    if (!supplier) return 21;
    return LAAG_BTW_TYPES.includes(supplier.type) ? 9 : 21;
  }

  // Reken de regels door: elk stuk is een prijs INCLUSIEF btw.
  function verwerkRegels(regels, btwStandaard) {
    let subtotaal = 0, btwBedrag = 0, totaal = 0;
    const uit = (Array.isArray(regels) ? regels : []).slice(0, 60).map(r => {
      const aantal = Math.max(1, Number(r.aantal) || 1);
      const stuk = rond(r.stuk);
      const btw = Number.isFinite(Number(r.btw)) ? Number(r.btw) : btwStandaard;
      const regelIncl = rond(aantal * stuk);
      const regelExcl = rond(regelIncl / (1 + btw / 100));
      subtotaal += regelExcl; btwBedrag += rond(regelIncl - regelExcl); totaal += regelIncl;
      return { omschrijving: scho(r.omschrijving, 120) || 'Post', aantal, stuk, btw, incl: regelIncl };
    });
    return { regels: uit, subtotaal: rond(subtotaal), btwBedrag: rond(btwBedrag), totaal: rond(totaal) };
  }

  /* De kern: boek EGn transactie -> EGn tweezijdige factuur.
     data: { soort, verkoperCode, verkoperNaam, koper:{key,naam,codenaam,supplierCode},
             regels:[{omschrijving,aantal,stuk,btw}], totaal?, btw?, methode, ref } */
  function boek(data) {
    const s = store();
    const verkoper = data.verkoperCode ? findSupplier(data.verkoperCode) : null;
    const btwStd = data.btw != null ? Number(data.btw) : standaardBtw(verkoper);
    let regels = data.regels;
    if ((!regels || !regels.length) && data.totaal != null) regels = [{ omschrijving: data.omschrijving || 'Transactie', aantal: 1, stuk: data.totaal, btw: btwStd }];
    const v = verwerkRegels(regels, btwStd);
    if (!(v.totaal > 0)) return { error: 'Geen bedrag om te factureren.' };
    const koper = data.koper || {};
    const f = {
      id: 'f' + crypto.randomBytes(5).toString('hex'),
      nummer: nummer(),
      soort: SOORTEN.includes(data.soort) ? data.soort : 'verkoop',
      verkoper: { code: data.verkoperCode || null, naam: scho(data.verkoperNaam || (verkoper && verkoper.name), 80) || 'RTG-partner' },
      koper: {
        key: koper.key || null,
        supplierCode: koper.supplierCode || null,
        naam: scho(koper.naam, 80) || (koper.codenaam ? scho(koper.codenaam, 80) : 'Klant'),
        codenaam: koper.codenaam ? scho(koper.codenaam, 80) : null
      },
      regels: v.regels, subtotaal: v.subtotaal, btwBedrag: v.btwBedrag, totaal: v.totaal,
      methode: scho(data.methode, 20) || null, ref: scho(data.ref, 60) || null,
      at: nu(), datum: nu().slice(0, 10)
    };
    s.facturen.unshift(f);
    s.facturen = s.facturen.slice(0, 100000);
    save();
    // beide partijen seinen: de verkoper en (indien lid) de koper
    if (f.verkoper.code && sseToSupplier) sseToSupplier(f.verkoper.code, 'sync', { scope: 'facturen' });
    if (f.koper.supplierCode && sseToSupplier) sseToSupplier(f.koper.supplierCode, 'sync', { scope: 'facturen' });
    if (f.koper.key) {
      if (sseToCustomer) sseToCustomer(f.koper.key, 'sync', { scope: 'facturen' });
      if (notify) notify(f.koper.key, { icon: '🧾', title: 'Nieuwe factuur', body: f.verkoper.naam + ': € ' + f.totaal.toFixed(2), scope: 'facturen' });
    }
    return { ok: true, factuur: publiek(f) };
  }

  // Async variant die een codenaam naar een lidsleutel oplost.
  async function boekMetCodenaam(data, codenaam) {
    codenaam = scho(codenaam, 80);
    if (codenaam && keyVanCodenaam) {
      try {
        const t = await keyVanCodenaam(codenaam); // { key, tier, codename } of null
        const key = t && t.key;
        data.koper = Object.assign({}, data.koper, key ? { key, codenaam: (t.codename || codenaam) } : { codenaam });
      } catch (e) { data.koper = Object.assign({}, data.koper, { codenaam }); }
    }
    return boek(data);
  }
  return { store, nummer, standaardBtw, verwerkRegels, boek, boekMetCodenaam };
};
