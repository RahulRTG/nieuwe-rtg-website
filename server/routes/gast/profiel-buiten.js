'use strict';

module.exports = ({ kern, zaakVan, horeca, bezorglaag, beleid, schoon }) => {
  const { app, auth } = kern;
  app.post('/api/gast/bezorg/kaart', auth, (req, res) => {
    const s = zaakVan(req, res); if (!s) return;
    const kaart = kern.gastKaartVanZaak(s.code);
    const rs = (kern.db.data.reviewStats || {})[s.code];
    const bezorg = bezorglaag.B(s.code);
    const zones = Array.isArray(bezorg.zones) ? bezorg.zones : [];
    const minimum = (veld) => {
      const waarden = zones.map(z => Number(z && z[veld])).filter(n => Number.isFinite(n) && n > 0);
      return waarden.length ? Math.min(...waarden) : null;
    };
    const fotos = (Array.isArray(s.photos) ? s.photos : []).slice(0, 6);
    if (s.salon && s.salon.foto && !fotos.includes(s.salon.foto) && fotos.length < 6) fotos.push(s.salon.foto);
    const recent = (kern.db.data.reviews || []).filter(r => r.supplierCode === s.code).slice(0, 5)
      .map(r => ({ codenaam: schoon(r.codename, 40), score: Math.max(1, Math.min(5, Number(r.score) || 1)),
        tekst: schoon(r.tekst, 300), at: r.at,
        reactie: r.reactie ? { tekst: schoon(r.reactie.tekst, 400), at: r.reactie.at } : null }));
    res.json({ ok: true, zaak: { code: s.code, naam: s.name, stad: s.city || null,
      bio: s.salon && s.salon.bio ? schoon(s.salon.bio, 200) : null, fotos,
      open: !(s.settings && s.settings.ordersOpen === false),
      rating: rs && rs.aantal ? { score: Math.round((rs.som / rs.aantal) * 10) / 10, aantal: rs.aantal } : null,
      categorieen: [...new Set(kaart.map(m => m.cat).filter(Boolean))].slice(0, 20),
      bezorging: { beschikbaar: zones.length > 0, open: zones.length > 0 && bezorg.open !== false,
        minutenVanaf: minimum('minuten'), kostenVanafCenten: minimum('kostenCenten') ||
          (zones.some(z => Number(z && z.kostenCenten) === 0) ? 0 : null),
        minimumVanafCenten: minimum('minimumCenten'), gratisVanafCenten: minimum('gratisVanafCenten') },
      reviews: recent }, kaart, beleid: beleid.beleidVan(s.code) });
  });
};
