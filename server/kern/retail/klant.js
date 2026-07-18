/* Retail (deelmodule): het klantprofiel (maten, notities, wishlist), apart leggen, de paskamer en styling.
   Krijgt de gedeelde context een keer bij het opstarten vanuit kern/retail.js. */
module.exports = (ctx) => {
  const { db, save, crypto, findSupplier, notify, notifySupplier, sseToCustomer, sseToSupplier, sseToOffice,
    ledenPrijs, gidsHaal, meldWachtlijst, MATEN, SEIZOENEN,
    id, nu, vandaag, rond, schoon, isRetail, artikelVan, variantVan, totaleVoorraad } = ctx;
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
  return { klantRec, klantProfiel, zetKlantMaten, voegKlantnotitie, wishlistToggle, legApart, mijnApart, vraagPaskamer, paskamerBreng, stuurStyling, mijnStyling };
};
