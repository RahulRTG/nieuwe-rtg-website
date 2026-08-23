/* RTG Eten voor het lid: drie ingangen, een resultaatcontract, plus de kleine
   relatielaag na levering. */
'use strict';
const { coord } = require('../../kern/util');
const klok = require('../../lib/klok');

module.exports = (kern) => {
  const { app, auth, schoon, foodcourt, buitenshuis, naad, verzoeklaag, horeca,
    findSupplier, haversine, db, save, notifySupplier, sseToSupplier } = kern;
  const ontdek = require('../../kern/eten/ontdekken');
  const orders = require('../../kern/eten/orderbeeld');
  const handleVan = naad.handleVanReq;

  function persoonlijkeSets(req) {
    const favorieten = ((db.data.favorieten || {})[req.session.key] || []).map(String);
    const recent = buitenshuis.mijne(db, handleVan(req), { limiet:40 }).map(x => x.zaakcode);
    return { favorieten, recent:[...new Set(recent)] };
  }

  function resultaat(req, modus) {
    const basis = foodcourt.overzicht();
    const p = persoonlijkeSets(req);
    const b = req.body || {};
    const vrij = modus === 'concierge' ? ontdek.conciergeFilters(schoon(b.vraag, 320), basis.keukens) : {};
    const invoer = Object.assign({}, b.filters || {}, modus === 'zoeken' ? { zoek:schoon(b.zoek, 120) } : {}, vrij);
    const r = ontdek.zoekResultaten({ restaurants:basis.restaurants,
      menuVan:code => kern.gastKaartVanZaak(code), favorieten:p.favorieten, recent:p.recent, invoer });
    const lat = coord(invoer.lat, 90), lng = coord(invoer.lng, 180);
    if (Number.isFinite(lat) && Number.isFinite(lng) && typeof haversine === 'function') {
      r.restaurants = r.restaurants.map(z => {
        const s = findSupplier(z.code), meters = s && s.loc ? haversine({ lat, lng }, s.loc) : null;
        return Object.assign({}, z, { afstandKm:meters == null ? null : Math.round(meters / 100) / 10 });
      }).filter(z => !Number(invoer.maxAfstandKm) || z.afstandKm != null && z.afstandKm <= Number(invoer.maxAfstandKm));
      if (invoer.sorteer === 'afstand') r.restaurants.sort((a,b) => (a.afstandKm == null ? Infinity : a.afstandKm) - (b.afstandKm == null ? Infinity : b.afstandKm));
      r.aantal = r.restaurants.length;
    }
    return Object.assign({ ok:true, modus, keukens:basis.keukens,
      groepen:ontdek.ontdekGroepen(r.restaurants, p.favorieten, p.recent) }, r,
      modus === 'concierge' ? { concierge:{ vraag:schoon(b.vraag, 320), filters:vrij,
        antwoord:r.aantal ? r.aantal + ' passende ' + (r.aantal === 1 ? 'zaak' : 'zaken') + ' gevonden. U kiest en bevestigt altijd zelf.' : 'Ik zie nu geen passende beschikbare zaak. Pas een filter aan of probeer een ruimer moment.',
        waarschuwing:vrij.menselijkeControle ? 'Allergenen zijn gefilterd op kaartinformatie. De zaak controleert uw bestelling altijd nog persoonlijk.' : null } } : {});
  }

  app.post('/api/gast/eten/ontdekken', auth, (req, res) => res.json(resultaat(req, 'ontdekken')));
  app.post('/api/gast/eten/zoeken', auth, (req, res) => res.json(resultaat(req, 'zoeken')));
  app.post('/api/gast/eten/concierge', auth, (req, res) => res.json(resultaat(req, 'concierge')));

  function eigenRekening(req, res) {
    const code = schoon((req.body || {}).zaak, 30);
    const s = findSupplier(code);
    if (!s) { res.status(404).json({ error:'Deze zaak kennen we niet.' }); return null; }
    const rek = horeca.H(code).rekeningen[String((req.body || {}).rekeningId || '')];
    if (!rek || !naad.isVan(rek, handleVan(req))) { res.status(404).json({ error:'Deze bestelling is niet van jou.' }); return null; }
    return { s, rek };
  }

  app.post('/api/gast/eten/probleem', auth, (req, res) => {
    const x = eigenRekening(req, res); if (!x) return;
    const uit = verzoeklaag.vraag(x.s.code, x.rek, (x.rek.deelnemers || [])[0], {
      soort:'hulp', tekst:schoon((req.body || {}).tekst, 140) || 'Er is iets niet goed met deze bestelling.' });
    if (uit.error) return res.status(uit.status || 400).json({ error:uit.error, code:uit.code });
    x.rek.incident = { status:'open', verzoekId:uit.verzoek.id, at:klok.datum().toISOString() };
    save();
    if (sseToSupplier) sseToSupplier(x.s.code, 'sync', { scope:'eten' });
    res.json(uit);
  });

  app.post('/api/gast/eten/beoordeel', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error:'Beoordelen is voor leden.' });
    const x = eigenRekening(req, res); if (!x) return;
    const beeld = orders.projecteerRekening({ zaakcode:x.s.code, zaak:x.s, rekening:x.rek,
      horecaDoos:horeca.H(x.s.code) });
    if (!['geleverd','opgehaald'].includes(beeld.statussen.fulfillment))
      return res.status(409).json({ error:'Beoordelen kan zodra de bestelling is geleverd of opgehaald.' });
    const ref = beeld.id;
    if ((db.data.reviews || []).some(r => r.ref === ref && r.key === req.session.key))
      return res.status(409).json({ error:'Je hebt deze bestelling al beoordeeld.' });
    const score = parseInt((req.body || {}).score, 10);
    if (!(score >= 1 && score <= 5)) return res.status(400).json({ error:'Geef 1 tot 5 sterren.' });
    const rev = { id:'rev-' + kern.crypto.randomBytes(5).toString('hex'), supplierCode:x.s.code,
      supplierName:x.s.name, soort:'eten', ref, key:req.session.key, codename:handleVan(req), score,
      tekst:schoon((req.body || {}).tekst, 300) || '', at:klok.datum().toISOString() };
    db.data.reviews = db.data.reviews || []; db.data.reviews.unshift(rev); db.data.reviews = db.data.reviews.slice(0, 20000);
    db.data.reviewStats = db.data.reviewStats || {};
    const st = db.data.reviewStats[x.s.code] = db.data.reviewStats[x.s.code] || { som:0, aantal:0 };
    st.som += score; st.aantal += 1; save();
    if (notifySupplier) notifySupplier(x.s.code, { icon:'⭐', title:'Nieuwe RTG Eten-review: ' + score + '/5', body:rev.codename + (rev.tekst ? ': ' + rev.tekst.slice(0, 80) : '') });
    if (sseToSupplier) sseToSupplier(x.s.code, 'sync', { scope:'reviews' });
    res.json({ ok:true, review:{ score, tekst:rev.tekst } });
  });
};
