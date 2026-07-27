/* Vakwerk Pro, deel 4: beoordelingen. Na een afgeronde klus geeft het lid
   1 tot 5 sterren met een kort woord; het gemiddelde staat bij de zaak op het
   Dienstenplein. Een beoordeling hoort altijd bij een echte, eigen, afgeronde
   boeking (een per klus) en draait op codenaam -- geen anonieme regen van
   sterren, geen echte namen. */
module.exports = (ctx) => {
  const { db, save, findSupplier, isVak, scho, notifySupplier, boekingenVanZaak } = ctx;
  const nu = () => new Date().toISOString();
  const lijst = () => (Array.isArray(db.data.vakReviews) ? db.data.vakReviews : (db.data.vakReviews = []));

  function scoreVan(code) {
    const eigen = lijst().filter(r => r.supplierCode === code);
    if (!eigen.length) return null;
    const som = eigen.reduce((n, r) => n + r.sterren, 0);
    return { score: Math.round((som / eigen.length) * 10) / 10, aantal: eigen.length };
  }

  function reviewGeef(key, body) {
    const s = findSupplier((body || {}).supplierCode);
    if (!isVak(s)) return { status: 404, error: 'Deze zaak is niet te beoordelen.' };
    const ref = String((body || {}).ref || '');
    const b = (boekingenVanZaak(s.code) || []).find(x => x.ref === ref && x.customerKey === key);
    if (!b) return { status: 404, error: 'Deze boeking is niet van u of bestaat niet.' };
    if (b.status !== 'afgerond') return { status: 409, error: 'Beoordelen kan na een afgeronde klus.' };
    if (lijst().some(r => r.ref === ref)) return { status: 409, error: 'Deze klus is al beoordeeld.' };
    const sterren = Math.round(Number((body || {}).sterren));
    if (!(sterren >= 1 && sterren <= 5)) return { status: 400, error: 'Geef 1 tot 5 sterren.' };
    const r = { supplierCode: s.code, ref, codenaam: b.customerCodename,
      dienst: (b.service && b.service.name) || 'Dienst',
      sterren, tekst: scho((body || {}).tekst, 140) || null, at: nu() };
    lijst().unshift(r);
    db.data.vakReviews = lijst().slice(0, 20000);
    save();
    notifySupplier(s.code, { icon: 'attenties', title: 'Nieuwe beoordeling', body: b.customerCodename + ' gaf ' + sterren + ' van 5' + (r.tekst ? ': ' + r.tekst : '.') });
    return { status: 200, ok: true, score: scoreVan(s.code) };
  }

  // welke afgeronde klussen van dit lid wachten nog op een beoordeling
  function reviewsOpen(key) {
    const types = db.data.supplierTypes || {};
    const klaar = new Set(lijst().map(r => r.ref));
    const uit = [];
    for (const s of (db.data.suppliers || [])) {
      if (!((types[s.type] || {}).caps || []).includes('services')) continue;
      for (const b of (boekingenVanZaak(s.code) || [])) {
        if (b.customerKey !== key || b.status !== 'afgerond' || klaar.has(b.ref)) continue;
        uit.push({ ref: b.ref, supplierCode: s.code, zaak: s.name,
          dienst: (b.service && b.service.name) || 'Dienst', datum: String(b.finishedAt || b.at).slice(0, 10) });
      }
    }
    return { status: 200, open: uit.sort((a, b) => b.datum.localeCompare(a.datum)).slice(0, 5) };
  }

  const reviewsVanZaak = code => ({ score: scoreVan(code),
    recent: lijst().filter(r => r.supplierCode === code).slice(0, 6)
      .map(r => ({ klant: r.codenaam, dienst: r.dienst, sterren: r.sterren, tekst: r.tekst, datum: r.at.slice(0, 10) })) });

  return { scoreVan, reviewGeef, reviewsOpen, reviewsVanZaak };
};
