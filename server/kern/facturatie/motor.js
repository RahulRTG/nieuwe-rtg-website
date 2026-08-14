/* Facturatie (deelmodule): de factuurmotor: de opslag, nummering, het
   btw-tarief (uit kern/fiscaal/tarief.js, dezelfde bron als de boekhouding
   van de zaak), regels verwerken en het tweezijdige boeken (op code of
   codenaam). Krijgt de gedeelde context een keer bij het opstarten vanuit
   kern/facturatie.js. */
const REGELSOM = require('../regelsom');

module.exports = (ctx) => {
  const { db, save, crypto, findSupplier, keyVanCodenaam, notify, notifySupplier, sseToCustomer, sseToSupplier, factuur, anthropic, schoon,
    SOORTEN, nu, scho, rond } = ctx;
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
  /* HET TARIEF KOMT UIT DE FISCALE LAAG, niet uit een lijstje hier.
     Hier stond `LAAG_BTW_TYPES.includes(type) ? 9 : 21` -- twee vaste getallen
     die nergens naar het LAND van de zaak keken, terwijl de maandboekhouding
     van diezelfde zaak wel de landentabel gebruikte. Sal de Mar op Ibiza (land
     ES) boekte 10% en factureerde 9%. Zie de kop van kern/fiscaal/tarief.js. */
  const tarief = require('../fiscaal/tarief');
  const capsVan = (s) => { try { return db.capsVan(s); } catch (e) { return []; } };
  function standaardBtw(supplier) {
    if (!supplier) return tarief.tariefVan(null, 'standaard');
    return tarief.tariefVan(supplier, tarief.basisCat(supplier, capsVan(supplier)));
  }
  /* En PER REGEL, want een glas wijn in een restaurant is geen eten. Zonder
     deze stap zou de bon alles op het lage tarief zetten terwijl de boekhouding
     de bar apart telt -- dan lopen ze alsnog uiteen, alleen subtieler. */
  function regelBtw(supplier, omschrijving, basis) {
    return tarief.tariefVan(supplier, tarief.catVanItem(supplier, omschrijving, basis));
  }

  /* Reken de regels door. De som zelf staat in kern/regelsom.js, want de
     offertebouwer rekent hem ook -- en een offerte die anders afrondt dan de
     factuur die eruit voortkomt, is een verschil dat niemand kan uitleggen.
     Reist er een verkoper mee, dan krijgt de som een opzoeker die het tarief
     van elke regel uit de fiscale laag haalt (zie regelBtw hierboven); de
     berekening zelf blijft op die ene plek. */
  const verwerkRegels = (regels, btwStandaard, verkoper) => {
    const basis = verkoper ? tarief.basisCat(verkoper, capsVan(verkoper)) : null;
    const perRegel = basis ? (omschrijving) => regelBtw(verkoper, omschrijving, basis) : null;
    return REGELSOM.verwerkRegels(regels, btwStandaard, scho, perRegel);
  };

  /* De kern: boek EGn transactie -> EGn tweezijdige factuur.
     data: { soort, verkoperCode, verkoperNaam, koper:{key,naam,codenaam,supplierCode},
             regels:[{omschrijving,aantal,stuk,btw}], totaal?, btw?, methode, ref } */
  function boek(data) {
    const s = store();
    const verkoper = data.verkoperCode ? findSupplier(data.verkoperCode) : null;
    const btwStd = data.btw != null ? Number(data.btw) : standaardBtw(verkoper);
    let regels = data.regels;
    if ((!regels || !regels.length) && data.totaal != null) regels = [{ omschrijving: data.omschrijving || 'Transactie', aantal: 1, stuk: data.totaal, btw: btwStd }];
    /* De verkoper gaat MEE, zodat elke regel zijn eigen tarief krijgt. Gaf de
       aanroeper zelf een `btw` mee, dan telt die: dan is het een bewuste keuze
       van de boekende laag en niet iets om te overrulen. */
    const v = verwerkRegels(regels, btwStd, data.btw != null ? null : verkoper);
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
      classificatie: data.classificatie === 'zakelijk' ? 'zakelijk' : 'prive',
      at: nu(), datum: nu().slice(0, 10)
    };
    /* DE BETAALSTATUS. Facturen droegen die niet, dus gold elke factuur
       impliciet als afgedaan en bestond er geen debiteurenlijst.

       De stand wordt NIET geraden waar hij gezegd kan worden: `data.betaald`
       telt, en anders geldt de aanwezigheid van een betaalmethode als bewijs
       -- die wordt alleen gezet als er echt is afgerekend (een bon, een rit).
       Zonder allebei staat de factuur open, met een vervaldatum.

       Let op wat hier NIET gebeurt: bestaande facturen krijgen geen veld en
       tellen elders als betaald (zie kern/onderneming/debiteuren.js). Zou de
       geschiedenis als open gelden, dan stond morgen alles wat ooit is
       gefactureerd op de debiteurenlijst -- een alarm dat niets betekent en
       daarna niet meer gelezen wordt. */
    const termijn = Number(data.betaaltermijn);
    f.betaaltermijn = Number.isFinite(termijn) && termijn > 0 && termijn <= 365 ? Math.round(termijn) : 14;
    f.betaald = data.betaald !== undefined ? !!data.betaald : !!f.methode;
    f.betaaldAt = f.betaald ? nu() : null;
    f.vervaldatum = new Date(Date.parse(f.at) + f.betaaltermijn * 86400000).toISOString().slice(0, 10);
    s.facturen.unshift(f);
    s.facturen = s.facturen.slice(0, 100000);
    save();
    // beide partijen seinen: de verkoper en (indien lid) de koper
    if (f.verkoper.code && sseToSupplier) sseToSupplier(f.verkoper.code, 'sync', { scope: 'facturen' });
    if (f.koper.supplierCode && sseToSupplier) sseToSupplier(f.koper.supplierCode, 'sync', { scope: 'facturen' });
    if (f.koper.key) {
      if (sseToCustomer) sseToCustomer(f.koper.key, 'sync', { scope: 'facturen' });
      if (notify) notify(f.koper.key, { icon: 'rekening', title: 'Nieuwe factuur', body: f.verkoper.naam + ': € ' + f.totaal.toFixed(2), scope: 'facturen' });
    }
    // facturen-draaiboek: een RTMAIL-seintje naar beide kanten (over de rail)
    try {
      if (ctx.automatisering) ctx.automatisering.factuurGeboekt({ verkoperCode: f.verkoper.code, verkoperNaam: f.verkoper.naam,
        koperCodenaam: f.koper.codenaam, koperZaakCode: f.koper.supplierCode, nummer: f.nummer, totaal: f.totaal });
    } catch (e) {}
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
  /* Een openstaande factuur afboeken. Alleen de VERKOPER mag dat, want alleen
     hij weet of het geld binnen is; een koper die zijn eigen factuur op betaald
     zet, is geen betaling maar een bewering. Idempotent, en terugdraaien mag
     ook -- een vergissing hoort herstelbaar te zijn. */
  function factuurBetaald(id, verkoperCode, betaald) {
    const f = store().facturen.find(x => x.id === String(id || ''));
    if (!f) return { status: 404, error: 'Deze factuur bestaat niet.' };
    if (!verkoperCode || f.verkoper.code !== verkoperCode) {
      return { status: 403, error: 'Alleen de verkoper kan een factuur afboeken.' };
    }
    const naar = betaald !== false;
    if (!!f.betaald === naar) return { status: 200, ok: true, betaald: naar, ongewijzigd: true };
    f.betaald = naar;
    f.betaaldAt = naar ? nu() : null;
    save();
    if (sseToSupplier && f.verkoper.code) sseToSupplier(f.verkoper.code, 'sync', { scope: 'facturen' });
    return { status: 200, ok: true, betaald: naar };
  }

  return { store, nummer, standaardBtw, verwerkRegels, boek, boekMetCodenaam, factuurBetaald };
};
