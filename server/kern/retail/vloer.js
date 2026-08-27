/* Retail (deelmodule): de winkelvloer: verkoop en retour, voorraad zoeken, statistieken en de ledencatalogus.
   Krijgt de gedeelde context een keer bij het opstarten vanuit kern/retail.js. */
module.exports = (ctx) => {
  const { db, save, crypto, findSupplier, notify, notifySupplier, sseToCustomer, sseToSupplier, sseToOffice,
    ledenPrijs, gidsHaal, meldWachtlijst, MATEN, SEIZOENEN,
    id, nu, vandaag, rond, schoon, isRetail, artikelVan, variantVan, totaleVoorraad } = ctx;
  const { klantRec, klantProfiel, wishlistToggle } = ctx;
  /* prijsVan komt uit ./assortiment.js, dat vóór deze laag in de context wordt
     gelegd (zie kern/retail.js). Zo staat de prijs op één plek en rekent de
     kassa hem niet zelf nog eens uit. */
  const { prijsVan } = ctx;
  /* EERST REKENEN, DAN PAS MUTEREN. Dit liep vroeger door elkaar: de voorraad
     ging eraf terwijl de regels werden langsgelopen, en bij de eerste regel
     zonder voorraad keerde de functie terug met een 409 -- met de voorraad van
     de regels ervoor al afgeboekt, zonder bon. Die volgorde is nu onmogelijk:
     prijsVan (./assortiment.js) raakt niets aan, en er wordt hieronder geen
     voorraad aangeraakt zolang er een tekort is. */
  function verkoop(s, body, actor) {
    const berekend = prijsVan(s, body.regels);
    if (berekend.error) return berekend;
    if (berekend.tekort.length) {
      const t = berekend.tekort[0];
      return { status: 409, error: 'Onvoldoende voorraad voor ' + t.naam + ': nog ' + t.vrij + '.', tekort: berekend.tekort };
    }
    if (!berekend.regels.length) return { status: 400, error: 'Geen geldige artikelen.' };

    const items = berekend.regels.map(r => ({ vsku: r.vsku, name: r.naam, qty: r.aantal, price: r.stuk }));
    for (const r of berekend.regels) variantVan(s, r.vsku).variant.voorraad -= r.aantal;
    const totaal = berekend.totaal;
    const method = ['contant', 'rtgpay'].includes(body.method) ? body.method : 'contant';
    // als posSale, zodat het Z-rapport, de fooien en de boekhouding meelopen
    const sale = { id: id(), method, total: totaal, items, actor: (actor && actor.name) || 'Team', at: nu(), room: null, retail: true };
    (db.data.posSales[s.code] = db.data.posSales[s.code] || []).unshift(sale);
    db.data.posSales[s.code] = db.data.posSales[s.code].slice(0, 20000);
    // een variant apart voor deze klant afronden (opgehaald) als die erbij hoort
    if (body.klantKey) {
      const rec = klantRec(s, body.klantKey);
      /* Het regelbedrag komt uit dezelfde berekening als de bon en wordt hier
         niet voor de tweede keer uitgerekend -- anders staat er in de historie
         van een klant een som die uit een andere bron komt dan zijn kassabon. */
      for (const r of berekend.regels) rec.historie.push({ sku: r.vsku, naam: r.naam, bedrag: r.totaal, at: nu() });
      rec.historie = rec.historie.slice(-200);
      for (const it of items) { const ap = (db.data.retailApart || []).find(x => x.key === body.klantKey && x.vsku === it.vsku && x.status === 'apart'); if (ap) ap.status = 'opgehaald'; }
    }
    save();
    sseToSupplier(s.code, 'sync', { scope: 'retail' });
    sseToOffice('sync', { scope: 'orders' });
    return { ok: true, sale };
  }

  /* Ketst de RTG Pay-betaling na de verkoop alsnog af, dan draait de route de
     verkoop hiermee terug: voorraad erbij, bon eruit. De klanthistorie laten
     we staan; die is informatief en heeft geen geldwaarde. */
  function verkoopTerug(s, sale) {
    for (const it of sale.items || []) {
      const hit = variantVan(s, it.vsku);
      if (hit) hit.variant.voorraad += it.qty;
    }
    db.data.posSales[s.code] = (db.data.posSales[s.code] || []).filter(x => x.id !== sale.id);
    save();
  }

  /* ---- voorraad opzoeken (winkelvloer): naam, sku, kleur of maat ---- */
  function voorraadZoek(s, q, drempel) {
    const ql = String(q || '').trim().toLowerCase();
    const laag = drempel != null ? drempel : ((s.settings && s.settings.retailDrempel) || 3);
    const uit = [];
    for (const a of s.artikelen || []) {
      for (const v of a.varianten || []) {
        const hooi = (a.naam + ' ' + a.sku + ' ' + a.categorie + ' ' + v.kleur + ' ' + v.maat + ' ' + v.vsku).toLowerCase();
        if (ql && !hooi.includes(ql)) continue;
        uit.push({ vsku: v.vsku, artikel: a.naam, sku: a.sku, kleur: v.kleur, maat: v.maat, voorraad: v.voorraad, laag: v.voorraad <= laag, price: a.price, foto: a.foto });
      }
    }
    return uit.sort((x, y) => (x.artikel + x.maat).localeCompare(y.artikel + y.maat)).slice(0, 60);
  }

  /* ---- analytics: bestsellers, sell-through per collectie, dagomzet ---- */
  function retailStats(s) {
    const today = vandaag();
    const sales = (db.data.posSales[s.code] || []);
    const dag = sales.filter(x => String(x.at).slice(0, 10) === today);
    const omzetVandaag = rond(dag.reduce((n, x) => n + (x.total || 0), 0));
    // verkocht per artikel (naam) uit de posSales-historie
    const perArtikel = {};
    for (const x of sales) for (const it of (x.items || [])) {
      const naam = String(it.name || '').split(' (')[0];
      perArtikel[naam] = (perArtikel[naam] || 0) + (it.qty || 1);
    }
    const bestsellers = Object.entries(perArtikel).map(([naam, aantal]) => ({ naam, aantal })).sort((a, b) => b.aantal - a.aantal).slice(0, 8);
    // sell-through per collectie: verkocht / (verkocht + huidige voorraad)
    const perColl = {};
    for (const a of s.artikelen || []) {
      const cid = a.collectieId || 'los';
      const voorraad = totaleVoorraad(a);
      const verkocht = perArtikel[a.naam] || 0;
      const c = perColl[cid] = perColl[cid] || { voorraad: 0, verkocht: 0 };
      c.voorraad += voorraad; c.verkocht += verkocht;
    }
    const collnaam = cid => { const c = (s.collecties || []).find(x => x.id === cid); return c ? (c.seizoen + ' ' + c.jaar + ' · ' + c.naam) : 'Losse artikelen'; };
    const sellThrough = Object.entries(perColl).map(([cid, c]) => ({
      collectie: collnaam(cid), verkocht: c.verkocht, voorraad: c.voorraad,
      pct: (c.verkocht + c.voorraad) ? Math.round(c.verkocht / (c.verkocht + c.voorraad) * 100) : 0
    })).sort((a, b) => b.pct - a.pct);
    // lage voorraad en bijbestel-suggesties
    const laag = [];
    for (const a of s.artikelen || []) for (const v of a.varianten || [])
      if (v.voorraad <= ((s.settings && s.settings.retailDrempel) || 3)) laag.push({ artikel: a.naam, kleur: v.kleur, maat: v.maat, voorraad: v.voorraad, vsku: v.vsku });
    return {
      omzetVandaag, bonnenVandaag: dag.length,
      artikelen: (s.artikelen || []).length,
      voorraadTotaal: (s.artikelen || []).reduce((n, a) => n + totaleVoorraad(a), 0),
      bestsellers, sellThrough, laag: laag.slice(0, 30),
      klanten: Object.keys(s.klanten || {}).length
    };
  }

  /* ---- de retail-toestand voor de leverancier-app (backoffice) ---- */
  function retailState(s) {
    return {
      collecties: (s.collecties || []),
      artikelen: (s.artikelen || []).map(a => ({
        id: a.id, sku: a.sku, naam: a.naam, collectieId: a.collectieId, categorie: a.categorie,
        materiaal: a.materiaal, omschrijving: a.omschrijving, foto: a.foto,
        publiekePrijs: a.publiekePrijs, price: a.price, drop: a.drop || null,
        varianten: a.varianten || [], voorraad: totaleVoorraad(a)
      })),
      apart: (db.data.retailApart || []).filter(r => r.supplierCode === s.code && r.status === 'apart').slice(0, 40),
      paskamer: (db.data.paskamerVerzoeken || []).filter(v => v.supplierCode === s.code && v.status === 'gevraagd').slice(0, 40),
      styling: (db.data.stylingVoorstellen || []).filter(v => v.supplierCode === s.code).slice(0, 20),
      klanten: Object.keys(s.klanten || {}).map(k => klantProfiel(s, k)).sort((a, b) => b.besteedTotaal - a.besteedTotaal).slice(0, 60),
      stats: retailStats(s),
      maten: MATEN, seizoenen: SEIZOENEN
    };
  }

  /* ---- de publieke catalogus voor de leden-app ---- */
  function catalogus(s, key, lang) {
    if (!isRetail(s)) return null;
    const rec = (s.klanten && key && s.klanten[key]) || { wishlist: [] };
    const nuMs = Date.now();
    const artikelen = (s.artikelen || []).map(a => {
      const drop = a.drop && !a.drop.gereleased ? { datum: a.drop.datum, tijd: a.drop.tijd, releaseMs: new Date(a.drop.datum + 'T' + (a.drop.tijd || '10:00') + ':00').getTime() } : null;
      return {
        id: a.id, sku: a.sku, naam: a.naam, categorie: a.categorie, materiaal: a.materiaal,
        omschrijving: a.omschrijving, foto: a.foto, price: a.price, publiekePrijs: a.publiekePrijs,
        collectieId: a.collectieId,
        kleuren: [...new Set((a.varianten || []).map(v => v.kleur))],
        maten: [...new Set((a.varianten || []).map(v => v.maat))],
        // per maat/kleur of er voorraad is (voor de paskamer/apart-knop), niet de exacte aantallen
        beschikbaar: (a.varianten || []).filter(v => v.voorraad > 0).map(v => ({ vsku: v.vsku, kleur: v.kleur, maat: v.maat })),
        opWishlist: (rec.wishlist || []).includes(a.id),
        drop: drop && drop.releaseMs > nuMs ? drop : null
      };
    });
    return {
      supplier: { code: s.code, name: s.name, city: s.city },
      collecties: (s.collecties || []).filter(c => c.actief !== false),
      artikelen,
      maten: key ? (rec.maten || {}) : {}
    };
  }

  return { verkoop, verkoopTerug, voorraadZoek, retailStats, retailState, catalogus };
};
