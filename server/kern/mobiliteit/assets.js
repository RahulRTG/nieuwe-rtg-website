/* Mobility OS (deelmodule): de voertuigen. Een `mobility_asset` is een auto,
   een taxibus, een veerboot of een helikopter -- hetzelfde model, met per
   categorie een uitbreiding uit ./voertuigcatalogus.

   DE HARDE REGEL HIER IS FAIL-CLOSED OP PAPIEREN. Een verplicht document
   zonder geldige einddatum telt als ONGELDIG, niet als "vast wel in orde".
   Dat is dezelfde kant op als de leeftijdsgrens in kern/lidacties/ritten.js,
   en om dezelfde reden: een grens die bij twijfel doorlaat is geen grens. Bij
   vervoer betekent hij bovendien iets concreets -- een taxi zonder geldige
   vergunning die toch een rit krijgt toegewezen, is een overtreding met een
   rit-id eronder.

   De blokkering is daarom niet een vinkje dat iemand zet maar een berekening
   die elke keer opnieuw gedaan wordt. Er is geen veld `geblokkeerd` dat kan
   verjaren; er is een lijst redenen die leeg is of niet. */

const { CATEGORIEEN, ENERGIE, RITSOORTEN } = require('./voertuigcatalogus');

const DAG = 24 * 60 * 60 * 1000;
const BIJNA_OP_DAGEN = 30;                  // zo lang van tevoren waarschuwen

module.exports = (ctx) => {
  const { db, save, id, schoon, nu, modAan } = ctx;

  function ensureAssets() {
    if (!Array.isArray(db.data.mobAssets)) db.data.mobAssets = [];
  }
  const assetsVan = code => { ensureAssets(); return db.data.mobAssets.filter(a => a.vervoerder === code); };
  const assetMet = (code, assetId) => assetsVan(code).find(a => a.id === assetId) || null;

  const datum = v => {
    const s = schoon(v, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const d = new Date(s + 'T12:00:00Z');
    return isNaN(d) ? null : s;
  };

  /* Is dit voertuig nu inzetbaar? Geeft de redenen terug waarom niet, want
     "voertuig niet beschikbaar" laat een wagenparkbeheerder raden welke van de
     vijf papieren het is. `waar` gaat naar het moduleregister: een helikopter
     in een stad waar helicopter_charter uit staat is daar geen voertuig. */
  function assetInzetbaar(a, waar = {}) {
    const cat = CATEGORIEEN[a.categorie];
    const redenen = [];
    if (!cat) return { inzetbaar: false, redenen: ['onbekende voertuigcategorie ' + a.categorie], bijnaOp: [] };
    const m = modAan(cat.module, Object.assign({ vervoerder: a.vervoerder }, waar));
    if (!m.aan) redenen.push(cat.naam + ' is hier niet beschikbaar: ' + m.reden);
    if (a.uitDienst) redenen.push('uit dienst gemeld');
    if (a.onderhoud && a.onderhoud !== 'in orde') redenen.push('onderhoudsstatus: ' + a.onderhoud);

    const bijnaOp = [];
    const vandaag = Date.now();
    for (const p of cat.papieren) {
      const geldig = a.papieren && a.papieren[p];
      // GEEN datum is een reden, geen stilte. Zie de kop van dit bestand.
      if (!geldig) { redenen.push('geen geldigheidsdatum voor ' + p); continue; }
      const tot = new Date(geldig + 'T23:59:59Z').getTime();
      if (tot < vandaag) redenen.push(p + ' is verlopen op ' + geldig);
      else if (tot - vandaag < BIJNA_OP_DAGEN * DAG) bijnaOp.push({ papier: p, tot: geldig, dagen: Math.ceil((tot - vandaag) / DAG) });
    }
    return { inzetbaar: redenen.length === 0, redenen, bijnaOp };
  }

  /* Past dit voertuig bij deze opdracht? Ook hier: redenen, geen booleaan.
     De dispatcher moet kunnen zien waarom zijn bus niet in de lijst stond. */
  function assetGeschikt(a, eisen = {}) {
    const cat = CATEGORIEEN[a.categorie] || {};
    const redenen = [];
    const plaatsen = Number.isFinite(a.plaatsen) ? a.plaatsen : cat.plaatsen || 0;
    const bagage = Number.isFinite(a.bagage) ? a.bagage : cat.bagage || 0;
    if (eisen.reizigers > plaatsen) redenen.push('te weinig plaatsen (' + plaatsen + ' voor ' + eisen.reizigers + ')');
    if (eisen.bagage > bagage) redenen.push('te weinig bagageruimte (' + bagage + ' voor ' + eisen.bagage + ')');
    if (eisen.rolstoel && !(a.rolstoel != null ? a.rolstoel : cat.rolstoel)) redenen.push('niet rolstoeltoegankelijk');
    if (eisen.categorie && eisen.categorie !== a.categorie) redenen.push('andere categorie gevraagd (' + eisen.categorie + ')');
    if (eisen.ritsoort && Array.isArray(a.ritsoorten) && a.ritsoorten.length && !a.ritsoorten.includes(eisen.ritsoort))
      redenen.push('niet toegelaten voor ritsoort ' + eisen.ritsoort);
    if (eisen.gebied && Array.isArray(a.gebieden) && a.gebieden.length && !a.gebieden.includes(eisen.gebied))
      redenen.push('rijdt niet in gebied ' + eisen.gebied);
    /* Energie op de bodem is geen voorkeur maar een harde grens: een wagen met
       8% laadstand haalt een rit van veertig kilometer niet, en die ontdek je
       liever hier dan halverwege de snelweg. */
    if (Number.isFinite(a.energieNiveau) && a.energieNiveau < 15) redenen.push('energieniveau te laag (' + a.energieNiveau + '%)');
    return { geschikt: redenen.length === 0, redenen };
  }

  // aanmaken of bijwerken; een onbekende categorie wordt geweigerd
  function assetZet(vervoerder, body = {}) {
    ensureAssets();
    const cat = CATEGORIEEN[schoon(body.categorie, 20)];
    const bestaand = body.id ? assetMet(vervoerder, schoon(body.id, 40)) : null;
    if (body.id && !bestaand) return { status: 404, error: 'Voertuig niet gevonden.' };
    if (!bestaand && !cat) return { status: 400, error: 'Kies een voertuigcategorie: ' + Object.keys(CATEGORIEEN).join(', ') };
    if (bestaand && body.weg) {
      db.data.mobAssets = db.data.mobAssets.filter(x => x.id !== bestaand.id);
      save();
      return { ok: true, weg: bestaand.id };
    }
    const a = bestaand || { id: id('as'), vervoerder, categorie: schoon(body.categorie, 20), gemaakt: nu(), papieren: {} };
    const c = CATEGORIEEN[a.categorie];
    if (body.naam != null) a.naam = schoon(body.naam, 60);
    if (body.registratie != null) a.registratie = schoon(body.registratie, 20).toUpperCase();
    if (Number.isFinite(body.plaatsen)) a.plaatsen = Math.max(0, Math.min(999, Math.round(body.plaatsen)));
    if (Number.isFinite(body.bagage)) a.bagage = Math.max(0, Math.min(999, Math.round(body.bagage)));
    if (body.rolstoel != null) a.rolstoel = !!body.rolstoel;
    if (body.energie != null && ENERGIE.includes(body.energie)) a.energie = body.energie;
    if (Number.isFinite(body.energieNiveau)) a.energieNiveau = Math.max(0, Math.min(100, Math.round(body.energieNiveau)));
    if (body.onderhoud != null) a.onderhoud = schoon(body.onderhoud, 40);
    if (body.uitDienst != null) a.uitDienst = !!body.uitDienst;
    if (body.bestuurder != null) a.bestuurder = schoon(body.bestuurder, 40) || null;
    if (Array.isArray(body.bemanning)) a.bemanning = body.bemanning.slice(0, 12).map(x => schoon(x, 40));
    if (Array.isArray(body.ritsoorten)) a.ritsoorten = body.ritsoorten.filter(r => RITSOORTEN.includes(r));
    if (Array.isArray(body.gebieden)) a.gebieden = body.gebieden.slice(0, 20).map(x => schoon(x, 40));
    if (Array.isArray(body.kenmerken)) a.kenmerken = body.kenmerken.slice(0, 20).map(x => schoon(x, 40));
    if (body.loc && Number.isFinite(body.loc.lat) && Number.isFinite(body.loc.lng))
      a.loc = { lat: body.loc.lat, lng: body.loc.lng, at: nu() };
    if (body.papieren && typeof body.papieren === 'object') {
      a.papieren = a.papieren || {};
      for (const [p, v] of Object.entries(body.papieren)) {
        const naam = schoon(p, 30);
        if (!naam) continue;
        const d = datum(v);
        if (d) a.papieren[naam] = d; else delete a.papieren[naam];
      }
    }
    a.gewijzigd = nu();
    if (!bestaand) db.data.mobAssets.push(a);
    save();
    return { ok: true, asset: assetBeeld(a), verplichtePapieren: c.papieren };
  }

  function assetBeeld(a, waar) {
    const cat = CATEGORIEEN[a.categorie] || {};
    const st = assetInzetbaar(a, waar);
    return { id: a.id, vervoerder: a.vervoerder, categorie: a.categorie, categorieNaam: cat.naam || a.categorie,
      laag: cat.laag, boeking: cat.boeking, module: cat.module,
      naam: a.naam || cat.naam || a.categorie, registratie: a.registratie || null,
      plaatsen: Number.isFinite(a.plaatsen) ? a.plaatsen : cat.plaatsen || 0,
      bagage: Number.isFinite(a.bagage) ? a.bagage : cat.bagage || 0,
      rolstoel: a.rolstoel != null ? !!a.rolstoel : !!cat.rolstoel,
      energie: a.energie || null, energieNiveau: Number.isFinite(a.energieNiveau) ? a.energieNiveau : null,
      onderhoud: a.onderhoud || 'in orde', uitDienst: !!a.uitDienst,
      bestuurder: a.bestuurder || null, bemanning: a.bemanning || [], bemanningNodig: cat.bemanning || 0,
      ritsoorten: a.ritsoorten || [], gebieden: a.gebieden || [], kenmerken: a.kenmerken || [],
      loc: a.loc || null, papieren: a.papieren || {}, verplichtePapieren: cat.papieren || [],
      inzetbaar: st.inzetbaar, redenen: st.redenen, bijnaOp: st.bijnaOp };
  }

  // de vloot van een vervoerder, met de reden per voertuig dat niet mee mag
  function assetLijst(vervoerder, waar) {
    return { ok: true, assets: assetsVan(vervoerder).map(a => assetBeeld(a, waar)),
      categorieen: Object.entries(CATEGORIEEN).map(([k, c]) =>
        ({ id: k, naam: c.naam, laag: c.laag, boeking: c.boeking, module: c.module, papieren: c.papieren })),
      energie: ENERGIE, ritsoorten: RITSOORTEN };
  }

  return { CATEGORIEEN, ensureAssets, assetsVan, assetMet, assetZet, assetLijst, assetBeeld, assetInzetbaar, assetGeschikt };
};
