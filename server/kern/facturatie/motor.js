/* Facturatie (deelmodule): de factuurmotor: de opslag, nummering, het
   btw-tarief (uit kern/fiscaal/tarief.js, dezelfde bron als de boekhouding
   van de zaak), regels verwerken en het tweezijdige boeken (op code of
   codenaam). Krijgt de gedeelde context een keer bij het opstarten vanuit
   kern/facturatie.js. */
const tijdzone = require('../tijdzone');

module.exports = (ctx) => {
  const { db, save, crypto, findSupplier, keyVanCodenaam, notify, notifySupplier, sseToCustomer, sseToSupplier, factuur, anthropic, schoon,
    SOORTEN, nu, scho, rond } = ctx;
  const publiek = (f) => ctx.publiek(f);
  const factuurSave = () => typeof save.sleutels === 'function'
    ? save.sleutels(['facturen', 'factuurTeller'])
    : save();
  function store() {
    if (!Array.isArray(db.data.facturen)) db.data.facturen = [];
    if (typeof db.data.factuurTeller !== 'number') db.data.factuurTeller = 0;
    return db.data;
  }
  function nummer() {
    const s = store();
    s.factuurTeller += 1;
    return 'RTG-' + tijdzone.jaarIn() + '-' + String(s.factuurTeller).padStart(6, '0');
  }
  /* Het btw-tarief per factuur en per regel woont in ./btw.js (de fiscale laag). */
  const { standaardBtw, verwerkRegels } = require('./btw')({ db, scho });

  /* De kern: boek EGn transactie -> EGn tweezijdige factuur.
     data: { soort, verkoperCode, verkoperNaam, koper:{key,naam,codenaam,supplierCode},
             regels:[{omschrijving,aantal,stuk,btw}], totaal?, btw?, methode, ref } */
  function boek(data) {
    const r = boekStil(data);
    if (r.seinen) r.seinen();
    return r.uit;
  }
  /* Boeken ZONDER de seinen erachter. De seinen (sse, de melding aan de koper,
     het RTMAIL-draaiboek) horen NA de commit: boekVast hieronder roept ze pas
     aan als de opslag de factuur heeft bevestigd. */
  function boekStil(data) {
    const s = store();
    const verkoper = data.verkoperCode ? findSupplier(data.verkoperCode) : null;
    const btwStd = data.btw != null ? Number(data.btw) : standaardBtw(verkoper);
    let regels = data.regels;
    if ((!regels || !regels.length) && data.totaal != null) regels = [{ omschrijving: data.omschrijving || 'Transactie', aantal: 1, stuk: data.totaal, btw: btwStd }];
    /* De verkoper gaat MEE, zodat elke regel zijn eigen tarief krijgt. Gaf de
       aanroeper zelf een `btw` mee, dan telt die: dan is het een bewuste keuze
       van de boekende laag en niet iets om te overrulen. */
    const v = verwerkRegels(regels, btwStd, data.btw != null ? null : verkoper);
    if (!(v.totaal > 0)) return { uit: { error: 'Geen bedrag om te factureren.' } };
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
    factuurSave();
    return { uit: { ok: true, factuur: publiek(f) }, seinen: () => seinNaBoeking(f) };
  }
  function seinNaBoeking(f) {
    // beide partijen seinen: de verkoper en (indien lid) de koper
    if (f.verkoper.code && sseToSupplier) sseToSupplier(f.verkoper.code, 'sync', { scope: 'facturen' });
    if (f.koper.supplierCode && sseToSupplier) sseToSupplier(f.koper.supplierCode, 'sync', { scope: 'facturen' });
    if (f.koper.key) {
      if (sseToCustomer) sseToCustomer(f.koper.key, 'sync', { scope: 'facturen' });
      // De eigen save hierboven omvat de factuur en alle eerdere callerwrites.
      if (notify) (notify.alleenMelding || notify)(f.koper.key, { icon: 'rekening', title: 'Nieuwe factuur', body: f.verkoper.naam + ': € ' + f.totaal.toFixed(2), scope: 'facturen' });
    }
    // facturen-draaiboek: een RTMAIL-seintje naar beide kanten (over de rail)
    try {
      if (ctx.automatisering) ctx.automatisering.factuurGeboekt({ verkoperCode: f.verkoper.code, verkoperNaam: f.verkoper.naam,
        koperCodenaam: f.koper.codenaam, koperZaakCode: f.koper.supplierCode, nummer: f.nummer, totaal: f.totaal });
    } catch (e) {}
  }

  // Async variant die een codenaam naar een lidsleutel oplost.
  async function koperBij(data, codenaam) {
    codenaam = scho(codenaam, 80);
    if (codenaam && keyVanCodenaam) {
      try {
        const t = await keyVanCodenaam(codenaam); // { key, tier, codename } of null
        const key = t && t.key;
        data.koper = Object.assign({}, data.koper, key ? { key, codenaam: (t.codename || codenaam) } : { codenaam });
      } catch (e) { data.koper = Object.assign({}, data.koper, { codenaam }); }
    }
    return data;
  }
  async function boekMetCodenaam(data, codenaam) {
    return boek(await koperBij(data, codenaam));
  }
  /* DE FACTUUR VAN EEN MENS, DUURZAAM (18 oktober 2026). Met de hand gemaakt
     (/api/supplier/facturen/maak) heette hij "gemaakt" terwijl de opslag hem
     nog niet had (SCHRIJFPROEF.json: VALS_SUCCES). Een fiscaal stuk met een
     doorlopend nummer staat er, of bestaat niet. De automatische boekingen
     roepen boek() BINNEN hun eigen handeling aan, die over de commit beslist.
     Eerst de koper opzoeken (wacht op de kluis), dan synchroon in de bundel. */
  /* DE SEINEN NA DE COMMIT, en niet erin. Hier stond `antwoord(() => boek(data))`,
     en boek() meldt de koper en mailt beide kanten VOOR hij terugkeert -- dus
     binnen de duurzame bundel, voor de commit. Faalde die commit (503), dan had
     de koper al een melding en een mail over een factuur die niet bestaat. De
     crashproef zag het als een dood op het meldmoment ZONDER factuur
     (na-commit-voor-bericht, 18 oktober 2026): het bericht kwam voor de commit. */
  async function boekVast(data, codenaam) {
    await koperBij(data, codenaam);
    if (!ctx.vastleggen) return boek(data);
    let seinen = null;
    const r = await ctx.vastleggen.antwoord(() => { const b = boekStil(data); seinen = b.seinen || null; return b.uit; });
    if (r && r.ok && !r.error && seinen) seinen();
    return r;
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
    factuurSave();
    if (sseToSupplier && f.verkoper.code) sseToSupplier(f.verkoper.code, 'sync', { scope: 'facturen' });
    return { status: 200, ok: true, betaald: naar };
  }

  // afboeken idem: de debiteurenlijst slaat een "betaalde" factuur over
  const factuurBetaaldVast = (id, verkoperCode, betaald) => ctx.vastleggen
    ? ctx.vastleggen.antwoord(() => factuurBetaald(id, verkoperCode, betaald))
    : Promise.resolve(factuurBetaald(id, verkoperCode, betaald));

  return { store, nummer, standaardBtw, verwerkRegels, boek, boekMetCodenaam, boekVast, factuurBetaald, factuurBetaaldVast };
};
