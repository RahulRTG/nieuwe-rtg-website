/* RTG Mall, deelbestand "diensten": het Dienstenplein. De verdieping waar de
   dienstverlenende zaken (services-cap: zzp, privechef, wellness, bouw en wat
   er nog bij komt) hun aanbod aanbieden. Elke zaak is een kraam met haar
   diensten en prijzen; boeken loopt via de bestaande leden-boekroute
   (/api/booking/request), dus op codenaam en met dezelfde betaalregels.
   Krijgt de gedeelde ctx van kern/mall/index.js. */
module.exports = (ctx) => {
  const { db, verborgen } = ctx;

  const heeftDiensten = (s, types) =>
    ((types[s.type] || {}).caps || []).includes('services') && (s.services || []).length > 0;

  function kraam(s, def) {
    const diensten = (s.services || []).map(d => ({
      id: d.id, naam: d.name, uitleg: d.desc || null,
      prijs: Math.max(0, Number(d.price) || 0),
      duurMin: d.duurMin || null, soort: d.soort || 'dienst'
    }));
    const prijzen = diensten.map(d => d.prijs).filter(Boolean);
    return {
      code: s.code, naam: s.name, stad: s.city || null,
      genre: s.type, genreLabel: (def && def.label) || s.type,
      vak: s.vak || null,
      tagline: (s.mall && s.mall.tagline) || null,
      vanaf: prijzen.length ? Math.min(...prijzen) : null,
      diensten
    };
  }

  /* Het plein: alle dienstverleners, gegroepeerd per genre, met hun volledige
     aanbod inline zodat de mall-pagina direct kan tonen en laten boeken. */
  function dienstenplein() {
    const types = db.data.supplierTypes || {};
    const zaken = (db.data.suppliers || []).filter(s => s && !verborgen(s) && heeftDiensten(s, types));
    const perGenre = new Map();
    for (const s of zaken) {
      if (!perGenre.has(s.type)) perGenre.set(s.type, []);
      perGenre.get(s.type).push(kraam(s, types[s.type]));
    }
    const genres = [...perGenre.entries()]
      .map(([type, lijst]) => ({
        type, label: (types[type] || {}).label || type,
        zaken: lijst.sort((a, b) => a.naam.localeCompare(b.naam)),
        aantal: lijst.length
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return { ok: true, genres, aantal: zaken.length };
  }

  ctx.dienstenplein = dienstenplein;
  return { dienstenplein };
};
