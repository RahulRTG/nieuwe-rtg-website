/* Leden-deel "waardering" (kern/ervaring/leden): reviews (met de zaakreactie),
   favorieten en de fooi-helper. Verbatim afgesplitst uit leden.js. */
module.exports = (ctx) => {
  const { db, save, findSupplier, notify, notifySupplier, sseToSupplier,
    orderMetRef, boekingMetRef, id, nu, rond } = ctx;

  /* ---- 3. reviews ----
     Een review kan pas na een geslaagde afronding, een per dienst. Het
     gemiddelde staat als lopende som in reviewStats: O(1) per opzoeking,
     ook met miljoenen reviews. */
  const REVIEW_OK = {
    order: ['geserveerd', 'bezorgd', 'opgehaald'],
    ride: ['afgerond', 'gearriveerd'],
    boeking: ['afgerond']
  };
  function plaatsReview(sess, codename, body) {
    const soort = String(body.soort || '');
    const ref = String(body.ref || '');
    const score = parseInt(body.score, 10);
    if (!REVIEW_OK[soort]) return { status: 400, error: 'Onbekend soort.' };
    if (!(score >= 1 && score <= 5)) return { status: 400, error: 'Geef 1 tot 5 sterren.' };
    const item = (soort === 'order' ? orderMetRef(ref)
      : soort === 'ride' ? db.data.rides.find(x => x.ref === ref)
      : boekingMetRef(ref));
    if (item && (item.customerKey || item.customerTier) !== sess.key) return { status: 404, error: 'Niet gevonden.' };
    if (!item) return { status: 404, error: 'Niet gevonden.' };
    if (!REVIEW_OK[soort].includes(item.status)) return { status: 409, error: 'Een review kan pas na afronding.' };
    if ((db.data.reviews || []).some(r => r.ref === ref && r.key === sess.key)) return { status: 409, error: 'U heeft deze dienst al beoordeeld.' };
    const rev = {
      id: id(), supplierCode: item.supplierCode, supplierName: item.supplierName,
      soort, ref, key: sess.key, codename, score,
      tekst: String(body.tekst || '').trim().slice(0, 300), at: nu()
    };
    db.data.reviews.unshift(rev);
    db.data.reviews = db.data.reviews.slice(0, 20000);
    const st = db.data.reviewStats[item.supplierCode] = db.data.reviewStats[item.supplierCode] || { som: 0, aantal: 0 };
    st.som += score; st.aantal += 1;
    save();
    notifySupplier(item.supplierCode, { icon: '⭐', title: 'Nieuwe review: ' + score + '/5', body: codename + (rev.tekst ? ': ' + rev.tekst.slice(0, 80) : '') });
    sseToSupplier(item.supplierCode, 'sync', { scope: 'reviews' });
    return { ok: true, review: { score: rev.score, tekst: rev.tekst } };
  }
  function reviewsVoor(code) {
    const c = String(code || '').trim().toUpperCase();
    const recent = (db.data.reviews || []).filter(r => r.supplierCode === c).slice(0, 20)
      .map(r => ({ codename: r.codename, score: r.score, tekst: r.tekst, at: r.at, reactie: r.reactie || null }));
    return { rating: ratingVan(c), reviews: recent };
  }

  /* de zaak reageert op een review: een keer, zichtbaar voor iedereen die de
     reviews bekijkt, en de gast krijgt er een nette melding van */
  function reviewReageer(s, reviewId, tekst) {
    const r = (db.data.reviews || []).find(x => x.id === reviewId && x.supplierCode === s.code);
    if (!r) return { status: 404, error: 'Review niet gevonden.' };
    tekst = String(tekst || '').replace(/[<>]/g, '').trim().slice(0, 400);
    if (!tekst) return { status: 400, error: 'Schrijf eerst een reactie.' };
    r.reactie = { tekst, at: nu() };
    save();
    notify(r.key, { icon: '💬', title: r.supplierName + ' reageerde op uw review', body: tekst.slice(0, 120), scope: 'orders' });
    sseToSupplier(s.code, 'sync', { scope: 'reviews' });
    return { ok: true, review: { id: r.id, reactie: r.reactie } };
  }
  function ratingVan(code) {
    const st = (db.data.reviewStats || {})[code];
    return st && st.aantal ? { score: Math.round((st.som / st.aantal) * 10) / 10, aantal: st.aantal } : null;
  }

  /* ---- 4. favorieten ---- */
  function toggleFavoriet(key, code) {
    const s = findSupplier(code);
    if (!s) return { status: 404, error: 'Partner niet gevonden.' };
    const lijst = db.data.favorieten[key] = db.data.favorieten[key] || [];
    const i = lijst.indexOf(s.code);
    if (i >= 0) lijst.splice(i, 1);
    else { lijst.push(s.code); if (lijst.length > 200) lijst.shift(); }
    save();
    return { ok: true, favoriet: i < 0 };
  }
  function favorietenVan(key) {
    return (db.data.favorieten[key] || []).map(c => { const s = findSupplier(c); return s ? { code: s.code, name: s.name, type: s.type, city: s.city } : null; }).filter(Boolean);
  }
  function isFavoriet(key, code) { return (db.data.favorieten[key] || []).includes(code); }

  /* ---- 5. fooi (helper voor de betaal-endpoints) ---- */
  function fooiUit(body, totaal) {
    const f = Number(body && body.fooi);
    if (!Number.isFinite(f) || f <= 0) return 0;
    return rond(Math.min(f, Math.min(500, totaal))); // nooit meer dan de rekening of 500
  }

  return { plaatsReview, reviewsVoor, ratingVan, reviewReageer,
    toggleFavoriet, favorietenVan, isFavoriet, fooiUit };
};
