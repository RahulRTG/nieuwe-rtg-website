/* Ledenprojecties van het fonds: bedragen, eigen bijdrage en eigen stem.
   Ontvangt het bestaande fondsbeeld en onderzoeksprojectie; geen save,
   besluit-, doneer- of stemfunctie. Initialisatie blijft bij de fondseigenaar. */
module.exports = (ctx) => {
  const { F, eur, onderzoek } = ctx;
  function locBeeld(l, lidKey) {
    const voorstellen = F().voorstellen.filter(v => v.locId === l.id);
    return {
      id: l.id, naam: l.naam, land: l.land,
      pot: eur(l.pot), opgehaald: eur(l.opgehaald), uitgekeerd: eur(l.uitgekeerd),
      open: voorstellen.filter(v => v.status === 'open').length,
      mijnBijdrage: eur(F().bijdragen.filter(b => b.lidKey === lidKey && b.locId === l.id).reduce((s, b) => s + b.centen, 0))
    };
  }
  function voorstelBeeld(v, lidKey) {
    const voor = (v.stemmen.voor || []).length, tegen = (v.stemmen.tegen || []).length;
    return {
      id: v.id, locId: v.locId, titel: v.titel, doel: v.doel, bedrag: eur(v.centen),
      door: v.doorNaam, status: v.status, voor, tegen,
      mijnStem: (v.stemmen.voor || []).includes(lidKey) ? 'voor' : (v.stemmen.tegen || []).includes(lidKey) ? 'tegen' : null,
      scheids: v.scheids || null, besluit: v.besluit || null, at: v.at,
      /* Welk onderzoek dit voorstel financiert. `null` betekent: dit voorstel
         noemt er geen -- niet dat het er geen kon noemen. */
      onderzoek: onderzoek.beeld(v)
    };
  }

  // het openbare fondsoverzicht voor een lid
  function fonds(lidKey) {
    const f = F();
    const locaties = Object.values(f.locaties).map(l => locBeeld(l, lidKey))
      .sort((a, b) => b.pot - a.pot);
    const voorstellen = f.voorstellen.filter(v => v.status === 'open')
      .slice(0, 100).map(v => voorstelBeeld(v, lidKey));
    return {
      ok: true,
      totaalOpgehaald: eur(Object.values(f.locaties).reduce((s, l) => s + l.opgehaald, 0)),
      totaalPot: eur(Object.values(f.locaties).reduce((s, l) => s + l.pot, 0)),
      mijnBijdrage: eur(f.bijdragen.filter(b => b.lidKey === lidKey).reduce((s, b) => s + b.centen, 0)),
      locaties, voorstellen
    };
  }

  return { locBeeld, voorstelBeeld, fonds };
};
