/* De retail-/mode-laag: een breed, slim genre voor modehuizen, merken en winkels.
   Alsof alle grote modehuizen op RTG draaien. Twee kanten:

   MERK/WINKEL-BACKOFFICE (leverancier-app):
   - collecties per seizoen (SS/AW) en artikelen met varianten (maat x kleur x SKU)
   - voorraad per variant, lage-voorraad-signalen en bijbestel-suggesties
   - drops (getimede releases) met een wachtlijst die bij de release afgaat
   - clienteling: per klant maten, voorkeuren, verlanglijst, aankoophistorie en
     stylist-notities (het geheime wapen van elk luxe modehuis)
   - analytics: bestsellers, sell-through per collectie, dagomzet

   WINKELVLOER (personeels-PDA):
   - voorraad opzoeken (scan/zoek: welke maat, welke kleur, waar)
   - een klant erbij pakken (maten, verlanglijst, historie) en op maat adviseren
   - een artikel apart leggen voor een klant, een paskamerverzoek afhandelen
   - mobiele kassa op de vloer (voorraad daalt, de historie groeit)
   - een stylingvoorstel rechtstreeks naar de app van de klant sturen

   De kassa (posSales), de fooi, de reviews, de reisagenda en de leden-favorieten
   uit de bestaande lagen werken hier gewoon op mee. maakRetail(state) volgt het
   vaste kern-patroon. */

const MATEN = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const SEIZOENEN = ['SS', 'AW', 'Pre', 'Resort', 'Capsule'];

function maakRetail({ db, save, crypto, findSupplier, notify, notifySupplier, sseToCustomer, sseToSupplier, sseToOffice, ledenPrijs, gidsHaal, meldWachtlijst }) {
  const id = () => crypto.randomBytes(4).toString('hex');
  const nu = () => new Date().toISOString();
  const vandaag = () => new Date().toISOString().slice(0, 10);
  const rond = n => Math.round(n * 100) / 100;
  const schoon = (v, n) => String(v == null ? '' : v).trim().slice(0, n || 120);

  function isRetail(s) { return s && ((db.data.supplierTypes[s.type] || {}).caps || []).includes('retail'); }
  function artikelVan(s, artikelId) { return (s.artikelen || []).find(a => a.id === artikelId); }
  function variantVan(s, vsku) {
    for (const a of s.artikelen || []) { const v = (a.varianten || []).find(x => x.vsku === vsku); if (v) return { artikel: a, variant: v }; }
    return null;
  }
  function totaleVoorraad(a) { return (a.varianten || []).reduce((n, v) => n + (v.voorraad || 0), 0); }

  /* ---- collecties ---- */
  function zetCollectie(s, body) {
    if (!Array.isArray(s.collecties)) s.collecties = [];
    const actie = String(body.action || 'add');
    if (actie === 'remove') { s.collecties = s.collecties.filter(c => c.id !== body.id); save(); return { ok: true }; }
    const naam = schoon(body.naam, 60);
    if (!naam) return { status: 400, error: 'Geef de collectie een naam.' };
    const seizoen = SEIZOENEN.includes(body.seizoen) ? body.seizoen : 'SS';
    const jaar = Math.min(2100, Math.max(2020, parseInt(body.jaar, 10) || new Date().getFullYear()));
    if (body.id) {
      const c = s.collecties.find(x => x.id === body.id);
      if (c) { c.naam = naam; c.seizoen = seizoen; c.jaar = jaar; c.actief = body.actief !== false; save(); return { ok: true, collectie: c }; }
    }
    const c = { id: id(), naam, seizoen, jaar, actief: body.actief !== false, at: nu() };
    s.collecties.unshift(c);
    save();
    return { ok: true, collectie: c };
  }

  /* ---- artikelen met varianten (maat x kleur x SKU) ---- */
  function normaliseerVarianten(lijst, baseSku) {
    const uit = [];
    for (const v of (Array.isArray(lijst) ? lijst : []).slice(0, 120)) {
      const kleur = schoon(v.kleur, 30) || 'Zwart';
      const maat = schoon(v.maat, 12) || 'M';
      const voorraad = Math.max(0, Math.min(99999, parseInt(v.voorraad, 10) || 0));
      const vsku = schoon(v.vsku, 40) || (baseSku + '-' + kleur.slice(0, 3).toUpperCase() + '-' + maat);
      if (!uit.some(x => x.vsku === vsku)) uit.push({ vsku, kleur, maat, voorraad });
    }
    return uit;
  }
  function zetArtikel(s, body) {
    if (!Array.isArray(s.artikelen)) s.artikelen = [];
    const actie = String(body.action || 'add');
    if (actie === 'remove') { s.artikelen = s.artikelen.filter(a => a.id !== body.id); save(); return { ok: true }; }
    const a = body.artikel || {};
    const naam = schoon(a.naam, 80);
    if (!naam) return { status: 400, error: 'Geef het artikel een naam.' };
    const publiek = Math.max(0, Number(a.publiekePrijs != null ? a.publiekePrijs : a.price) || 0);
    const baseSku = (schoon(a.sku, 30) || (naam.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() + crypto.randomBytes(2).toString('hex'))).toUpperCase();
    const bestaand = body.id ? s.artikelen.find(x => x.id === body.id) : null;
    const artikel = bestaand || { id: id(), at: nu() };
    Object.assign(artikel, {
      sku: baseSku,
      naam,
      collectieId: a.collectieId || (s.collecties && s.collecties[0] && s.collecties[0].id) || null,
      categorie: schoon(a.categorie, 40) || 'Kleding',
      materiaal: schoon(a.materiaal, 60),
      omschrijving: schoon(a.omschrijving, 400),
      foto: typeof a.foto === 'string' && a.foto.length < 500000 ? a.foto : (artikel.foto || null),
      publiekePrijs: publiek,
      price: ledenPrijs(publiek, a.price),
      drop: a.drop && a.drop.datum ? { datum: schoon(a.drop.datum, 10), tijd: schoon(a.drop.tijd, 5) || '10:00', gereleased: !!(bestaand && bestaand.drop && bestaand.drop.gereleased) } : null,
      varianten: normaliseerVarianten(a.varianten, baseSku)
    });
    if (!bestaand) s.artikelen.unshift(artikel);
    s.artikelen = s.artikelen.slice(0, 5000);
    save();
    return { ok: true, artikel };
  }
  // voorraad van een variant bijstellen (ontvangst, correctie, breuk)
  function pasVoorraad(s, vsku, delta, absoluut) {
    const hit = variantVan(s, vsku);
    if (!hit) return { status: 404, error: 'Variant niet gevonden.' };
    if (absoluut != null) hit.variant.voorraad = Math.max(0, Math.min(99999, parseInt(absoluut, 10) || 0));
    else hit.variant.voorraad = Math.max(0, hit.variant.voorraad + (parseInt(delta, 10) || 0));
    save();
    sseToSupplier(s.code, 'sync', { scope: 'retail' });
    return { ok: true, voorraad: hit.variant.voorraad, vsku };
  }

  /* ---- drops: getimede release; de wachtlijst gaat af zodra hij live is ---- */
  function releaseDrop(s, artikelId) {
    const a = artikelVan(s, artikelId);
    if (!a || !a.drop) return { status: 404, error: 'Geen drop op dit artikel.' };
    a.drop.gereleased = true;
    save();
    // iedereen op de wachtlijst voor deze drop krijgt bericht (via de ervaring-laag)
    let bericht = 0;
    while (meldWachtlijst && meldWachtlijst('drop:' + s.code + ':' + a.id)) bericht++;
    sseToSupplier(s.code, 'sync', { scope: 'retail' });
    return { ok: true, bericht };
  }

  /* ---- clienteling: het klantprofiel van een modehuis ---- */
  function klantRec(s, key) {
    if (!s.klanten) s.klanten = {};
    if (!s.klanten[key]) s.klanten[key] = { maten: {}, voorkeuren: '', wishlist: [], notities: [], historie: [], sinds: nu() };
    return s.klanten[key];
  }
  function klantProfiel(s, key) {
    const codenaam = (gidsHaal(key) || {}).codename || null;
    const rec = (s.klanten && s.klanten[key]) || { maten: {}, voorkeuren: '', wishlist: [], notities: [], historie: [] };
    const besteed = (rec.historie || []).reduce((n, h) => n + (h.bedrag || 0), 0);
    return {
      key, codenaam,
      maten: rec.maten || {}, voorkeuren: rec.voorkeuren || '',
      wishlist: (rec.wishlist || []).map(aid => { const a = artikelVan(s, aid); return a ? { id: a.id, naam: a.naam, price: a.price, foto: a.foto } : null; }).filter(Boolean),
      notities: (rec.notities || []).slice(-20),
      historie: (rec.historie || []).slice(-20),
      besteedTotaal: rond(besteed), aankopen: (rec.historie || []).length, sinds: rec.sinds || null
    };
  }
  function zetKlantMaten(s, key, maten, voorkeuren) {
    const rec = klantRec(s, key);
    if (maten && typeof maten === 'object') for (const [k, v] of Object.entries(maten)) rec.maten[schoon(k, 20)] = schoon(v, 12);
    if (voorkeuren != null) rec.voorkeuren = schoon(voorkeuren, 300);
    save();
    return { ok: true };
  }
  function voegKlantnotitie(s, key, tekst, door) {
    const t = schoon(tekst, 300);
    if (!t) return { status: 400, error: 'Lege notitie.' };
    const rec = klantRec(s, key);
    rec.notities.push({ tekst: t, door: schoon(door, 60) || 'Team', at: nu() });
    rec.notities = rec.notities.slice(-40);
    save();
    return { ok: true };
  }

  /* ---- verlanglijst: het lid zet artikelen op zijn wishlist bij dit merk ---- */
  function wishlistToggle(supplierCode, key, artikelId) {
    const s = findSupplier(supplierCode);
    if (!s || !isRetail(s) || !artikelVan(s, artikelId)) return { status: 404, error: 'Artikel niet gevonden.' };
    const rec = klantRec(s, key);
    const i = rec.wishlist.indexOf(artikelId);
    if (i >= 0) rec.wishlist.splice(i, 1);
    else { rec.wishlist.push(artikelId); if (rec.wishlist.length > 300) rec.wishlist.shift(); }
    save();
    if (i < 0) notifySupplier(s.code, { icon: '💛', title: 'Toegevoegd aan verlanglijst', body: ((gidsHaal(key) || {}).codename || 'Een lid') + ' wil "' + artikelVan(s, artikelId).naam + '"' });
    return { ok: true, wishlist: i < 0 };
  }

  /* ---- apart leggen (put aside): een variant reserveren voor een klant ---- */
  function legApart(s, key, vsku, door) {
    const hit = variantVan(s, vsku);
    if (!hit) return { status: 404, error: 'Variant niet gevonden.' };
    if (hit.variant.voorraad < 1) return { status: 409, error: 'Deze maat is niet op voorraad.' };
    hit.variant.voorraad -= 1; // gereserveerd = uit de vrije verkoop
    const rec = {
      id: id(), supplierCode: s.code, supplierName: s.name, key,
      codenaam: (gidsHaal(key) || {}).codename || null,
      vsku, artikelNaam: hit.artikel.naam, kleur: hit.variant.kleur, maat: hit.variant.maat,
      price: hit.artikel.price, status: 'apart', door: schoon(door, 60) || 'Team',
      tot: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), at: nu()
    };
    db.data.retailApart.unshift(rec);
    db.data.retailApart = db.data.retailApart.slice(0, 20000);
    save();
    notify(key, { icon: '🛍', title: s.name, body: '"' + rec.artikelNaam + '" (' + rec.kleur + ', ' + rec.maat + ') ligt voor u apart tot ' + rec.tot + '.', scope: 'orders' });
    sseToCustomer(key, 'sync', { scope: 'retail' });
    sseToSupplier(s.code, 'sync', { scope: 'retail' });
    return { ok: true, apart: rec };
  }
  function mijnApart(key) {
    return (db.data.retailApart || []).filter(r => r.key === key && r.status === 'apart').slice(0, 25);
  }

  /* ---- paskamerverzoek: klant vraagt een maat naar een paskamer ---- */
  function vraagPaskamer(s, key, codenaam, body) {
    const hit = variantVan(s, body.vsku);
    if (!hit) return { status: 404, error: 'Variant niet gevonden.' };
    const rec = {
      id: id(), supplierCode: s.code, key: key || null, codenaam: codenaam || 'Gast',
      vsku: body.vsku, artikelNaam: hit.artikel.naam, kleur: hit.variant.kleur, maat: hit.variant.maat,
      paskamer: schoon(body.paskamer, 12) || null, status: 'gevraagd', at: nu()
    };
    db.data.paskamerVerzoeken.unshift(rec);
    db.data.paskamerVerzoeken = db.data.paskamerVerzoeken.slice(0, 20000);
    save();
    notifySupplier(s.code, { icon: '🚪', title: 'Paskamerverzoek', body: rec.codenaam + ': ' + rec.artikelNaam + ' (' + rec.kleur + ', ' + rec.maat + ')' + (rec.paskamer ? ' → ' + rec.paskamer : '') });
    sseToSupplier(s.code, 'sync', { scope: 'retail' });
    return { ok: true, verzoek: rec };
  }
  function paskamerBreng(s, verzoekId, paskamer, door) {
    const v = (db.data.paskamerVerzoeken || []).find(x => x.id === verzoekId && x.supplierCode === s.code);
    if (!v) return { status: 404, error: 'Verzoek niet gevonden.' };
    v.status = 'gebracht'; v.paskamer = schoon(paskamer, 12) || v.paskamer; v.door = schoon(door, 60) || 'Team';
    save();
    if (v.key) notify(v.key, { icon: '🚪', title: 'Uw maat ligt klaar', body: v.artikelNaam + ' (' + v.maat + ') ligt in ' + (v.paskamer || 'de paskamer') + '.', scope: 'orders' });
    sseToSupplier(s.code, 'sync', { scope: 'retail' });
    return { ok: true };
  }

  /* ---- stylingvoorstel: een stylist stuurt een selectie naar de app van de klant ---- */
  function stuurStyling(s, key, body, van) {
    const ids = (Array.isArray(body.artikelIds) ? body.artikelIds : []).slice(0, 12);
    const items = ids.map(aid => { const a = artikelVan(s, aid); return a ? { id: a.id, naam: a.naam, price: a.price, foto: a.foto } : null; }).filter(Boolean);
    if (!items.length) return { status: 400, error: 'Kies minstens een artikel.' };
    const rec = {
      id: id(), supplierCode: s.code, supplierName: s.name, key,
      van: schoon(van, 60) || 'Uw stylist', titel: schoon(body.titel, 80) || 'Een selectie voor u',
      bericht: schoon(body.bericht, 300), items, gezien: false, at: nu()
    };
    db.data.stylingVoorstellen.unshift(rec);
    db.data.stylingVoorstellen = db.data.stylingVoorstellen.slice(0, 20000);
    save();
    notify(key, { icon: '✨', title: s.name + ' · stylingvoorstel', body: rec.titel + (rec.bericht ? ' · ' + rec.bericht.slice(0, 60) : ''), scope: 'salon' });
    sseToCustomer(key, 'sync', { scope: 'retail' });
    return { ok: true, voorstel: rec };
  }
  function mijnStyling(key) {
    return (db.data.stylingVoorstellen || []).filter(v => v.key === key).slice(0, 20);
  }

  /* ---- mobiele kassa op de vloer: verkoop varianten, voorraad daalt,
     de klanthistorie groeit, en het gaat als posSale mee in kassa/boekhouding ---- */
  function verkoop(s, body, actor) {
    const regels = Array.isArray(body.regels) ? body.regels : [];
    const items = [];
    let totaal = 0;
    for (const r of regels.slice(0, 50)) {
      const hit = variantVan(s, r.vsku);
      if (!hit) continue;
      const aantal = Math.max(1, Math.min(50, parseInt(r.aantal, 10) || 1));
      if (hit.variant.voorraad < aantal) return { status: 409, error: 'Onvoldoende voorraad voor ' + hit.artikel.naam + ' (' + hit.variant.maat + '): nog ' + hit.variant.voorraad + '.' };
      hit.variant.voorraad -= aantal;
      const stuk = hit.artikel.price;
      items.push({ vsku: r.vsku, name: hit.artikel.naam + ' (' + hit.variant.kleur + ', ' + hit.variant.maat + ')', qty: aantal, price: stuk });
      totaal += stuk * aantal;
    }
    if (!items.length) return { status: 400, error: 'Geen geldige artikelen.' };
    totaal = rond(totaal);
    const method = ['pin', 'contant'].includes(body.method) ? body.method : 'pin';
    // als posSale, zodat het Z-rapport, de fooien en de boekhouding meelopen
    const sale = { id: id(), method, total: totaal, items, actor: (actor && actor.name) || 'Team', at: nu(), room: null, retail: true };
    (db.data.posSales[s.code] = db.data.posSales[s.code] || []).unshift(sale);
    db.data.posSales[s.code] = db.data.posSales[s.code].slice(0, 20000);
    // een variant apart voor deze klant afronden (opgehaald) als die erbij hoort
    if (body.klantKey) {
      const rec = klantRec(s, body.klantKey);
      for (const it of items) rec.historie.push({ sku: it.vsku, naam: it.name, bedrag: rond(it.price * it.qty), at: nu() });
      rec.historie = rec.historie.slice(-200);
      for (const it of items) { const ap = (db.data.retailApart || []).find(x => x.key === body.klantKey && x.vsku === it.vsku && x.status === 'apart'); if (ap) ap.status = 'opgehaald'; }
    }
    save();
    sseToSupplier(s.code, 'sync', { scope: 'retail' });
    sseToOffice('sync', { scope: 'orders' });
    return { ok: true, sale };
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

  return {
    isRetail, zetCollectie, zetArtikel, pasVoorraad, releaseDrop,
    klantProfiel, zetKlantMaten, voegKlantnotitie, wishlistToggle,
    legApart, mijnApart, vraagPaskamer, paskamerBreng, stuurStyling, mijnStyling,
    verkoop, voorraadZoek, retailStats, retailState, catalogus
  };
}

module.exports = { RETAIL_MATEN: MATEN, RETAIL_SEIZOENEN: SEIZOENEN, maakRetail };
