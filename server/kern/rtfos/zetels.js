/* Foundation OS, deel "zetels": de enige plek waar bevoegdheid wordt uitgedeeld.

   EEN ZETEL IS GEEN VELD IN EEN VERZOEK. De sleutel komt uit een echte inlog
   (basis.js: wie() leunt op boardroomWie, dat een RTG-account of een kantoor-
   sessie met naam verlangt). De gedeelde kantoorcode levert geen sleutel op en
   krijgt dus nooit een zetel. Dat is LAT.md regel 8 toegepast op governance:
   een rol die je meestuurt is geen rol.

   WIE DEELT WELKE ZETEL UIT. Een stadsbestuur mag zijn eigen projectleiders en
   medewerkers aanstellen -- dat is lokaal werk en het zou het landelijke bureau
   tot een doorgeefluik maken. Maar een tweede stadsbestuur aanstellen kan het
   niet: dan zou een zetel zichzelf kunnen vermenigvuldigen tot het landelijke
   toezicht in die stad niets meer voorstelt. Die ene uitzondering is het hele
   verschil tussen federatief en los.

   DE LAATSTE ZETEL BLIJFT STAAN. Een stadsbestuur dat het eigen stadsbestuur
   intrekt, laat een stad achter zonder bestuur; dan kan alleen het landelijke
   bestuur er nog bij, en dat is precies het scenario waarin niemand merkt dat
   er iets stilvalt. */

module.exports = (ctx) => {
  const { nu, rid, schoon, S, audit, wie, rolIn, stadVan, save, ROLLEN } = ctx;

  const vanStad = stadId => S().zetels.filter(z => z.stad === stadId)
    .map(z => ({ id: z.id, key: z.key, naam: z.naam, rol: z.rol }));

  function zetelZet(req, b) {
    const w = wie(req);
    b = b || {};
    const s = stadVan(b.stad);
    if (!s) return { status: 404, error: 'Deze stadsafdeling bestaat niet.' };
    const rol = String(b.rol || '');
    if (!ROLLEN.includes(rol)) return { status: 400, error: 'Kies een rol (' + ROLLEN.join(', ') + ').' };
    const eigen = rolIn(w, s.id);
    if (!(w.landelijk || (eigen === 'stadsbestuur' && rol !== 'stadsbestuur'))) {
      return { status: 403, error: 'Een zetel in het stadsbestuur wordt landelijk toegekend.' };
    }
    const key = schoon(b.key, 80);
    if (!key) return { status: 400, error: 'Van wie is deze zetel? Gebruik de accountsleutel van die persoon.' };
    if (S().zetels.length >= 5000) return { status: 400, error: 'Het zetelregister zit vol.' };
    const bestaand = S().zetels.find(z => z.key === key && z.stad === s.id);
    if (bestaand) {
      if (bestaand.rol === 'stadsbestuur' && !w.landelijk) {
        return { status: 403, error: 'Een zetel in het stadsbestuur wijzigt het landelijke bestuur.' };
      }
      bestaand.rol = rol;
      bestaand.naam = schoon(b.naam, 60) || bestaand.naam;
    } else {
      S().zetels.push({ id: rid(), key, naam: schoon(b.naam, 60) || key, stad: s.id, rol, at: nu() });
    }
    audit(w.key, 'zetel.zet', key, rol + ' in RTF ' + s.naam);
    save();
    return { ok: true, zetels: vanStad(s.id) };
  }

  function zetelWeg(req, zetelId) {
    const w = wie(req);
    const z = S().zetels.find(x => x.id === String(zetelId || ''));
    if (!z) return { status: 404, error: 'Deze zetel bestaat niet.' };
    const eigen = rolIn(w, z.stad);
    if (!(w.landelijk || (eigen === 'stadsbestuur' && z.rol !== 'stadsbestuur'))) {
      return { status: 403, error: 'Een zetel in het stadsbestuur trekt het landelijke bestuur in.' };
    }
    if (z.rol === 'stadsbestuur') {
      const over = S().zetels.filter(x => x.stad === z.stad && x.rol === 'stadsbestuur' && x.id !== z.id).length;
      if (!over && !w.landelijk) {
        return { status: 400, error: 'Dit is het laatste stadsbestuur van deze afdeling. Stel eerst een opvolger aan.' };
      }
    }
    S().zetels = S().zetels.filter(x => x.id !== z.id);
    audit(w.key, 'zetel.weg', z.key, z.rol + ' in stad ' + z.stad);
    save();
    return { ok: true, zetels: vanStad(z.stad) };
  }

  return { zetelZet, zetelWeg, vanStad };
};
