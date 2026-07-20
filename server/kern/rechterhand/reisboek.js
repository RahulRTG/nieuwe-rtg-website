/* Rechterhand (deelmodule): Reisboek -- een prive-reisdossier per lid. Per reis
   een draaiboek met de legs (heen/terug/tussenstops), de verblijven, de reis-
   documenten (paspoort/visa met geldigheid) en een dag-tot-dag-programma. Het
   overzicht seint welke documenten binnenkort verlopen. Gemount via index.js. */
module.exports = (ctx) => {
  const { save, rid, nu, schoon, isDatum, L } = ctx;
  const LIJSTEN = { legs: 1, verblijven: 1, documenten: 1, programma: 1 };
  const vandaag = () => new Date().toISOString().slice(0, 10);

  function reisVan(l, id) { return l.reizen.find(r => r.id === id); }

  function reisZet(key, b) {
    const naam = schoon(b.naam, 80);
    if (!naam) return { status: 400, error: 'Geef de reis een naam.' };
    const l = L(key);
    const meta = { naam, van: isDatum(b.van) ? b.van : '', tot: isDatum(b.tot) ? b.tot : '',
      bestemming: schoon(b.bestemming, 80), notitie: schoon(b.notitie, 300) };
    if (b.id) { const r = reisVan(l, b.id); if (!r) return { status: 404, error: 'Deze reis staat niet in uw boek.' }; Object.assign(r, meta); save(); return { status: 200, ok: true, reis: r }; }
    if (l.reizen.length >= 100) return { status: 400, error: 'Uw reisboek is vol.' };
    const r = Object.assign({ id: rid(), at: nu(), legs: [], verblijven: [], documenten: [], programma: [] }, meta);
    l.reizen.unshift(r); save();
    return { status: 200, ok: true, reis: r };
  }
  function reisWeg(key, id) { const l = L(key); l.reizen = l.reizen.filter(r => r.id !== id); save(); return { status: 200, ok: true }; }

  function reisItem(key, b) {
    const l = L(key); const r = reisVan(l, b.reisId);
    if (!r) return { status: 404, error: 'Deze reis staat niet in uw boek.' };
    const lijst = LIJSTEN[b.lijst] ? b.lijst : null;
    if (!lijst) return { status: 400, error: 'Onbekend onderdeel.' };
    if (!Array.isArray(r[lijst])) r[lijst] = [];
    if (r[lijst].length >= 80) return { status: 400, error: 'Dit onderdeel is vol.' };
    let it;
    if (lijst === 'legs') { const van = schoon(b.van, 60); if (!van) return { status: 400, error: 'Van waar vertrekt u?' }; it = { id: rid(), van, naar: schoon(b.naar, 60), vervoer: schoon(b.vervoer, 40), datum: isDatum(b.datum) ? b.datum : '', tijd: /^\d{2}:\d{2}$/.test(b.tijd || '') ? b.tijd : '' }; }
    else if (lijst === 'verblijven') { const naam = schoon(b.naam, 80); if (!naam) return { status: 400, error: 'Naam van het verblijf?' }; it = { id: rid(), naam, plaats: schoon(b.plaats, 60), in: isDatum(b.in) ? b.in : '', uit: isDatum(b.uit) ? b.uit : '' }; }
    else if (lijst === 'documenten') { const soort = schoon(b.soort, 40); if (!soort) return { status: 400, error: 'Welk document?' }; it = { id: rid(), soort, houder: schoon(b.houder, 60), geldigTot: isDatum(b.geldigTot) ? b.geldigTot : '' }; }
    else { const tekst = schoon(b.tekst, 200); if (!tekst) return { status: 400, error: 'Wat staat er op het programma?' }; it = { id: rid(), datum: isDatum(b.datum) ? b.datum : '', tekst }; }
    r[lijst].push(it); save();
    return { status: 200, ok: true, item: it };
  }
  function reisItemWeg(key, b) {
    const l = L(key); const r = reisVan(l, b.reisId);
    if (!r || !LIJSTEN[b.lijst] || !Array.isArray(r[b.lijst])) return { status: 404, error: 'Niet gevonden.' };
    r[b.lijst] = r[b.lijst].filter(x => x.id !== b.itemId); save();
    return { status: 200, ok: true };
  }

  function reizen(key) {
    const l = L(key), t = vandaag(), grens = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    const attenties = [];
    for (const r of l.reizen) for (const d of (r.documenten || []))
      if (d.geldigTot && d.geldigTot <= grens) attenties.push({ reis: r.naam, soort: d.soort, houder: d.houder, geldigTot: d.geldigTot, verlopen: d.geldigTot < t });
    const lijst = l.reizen.map(r => {
      const programma = (r.programma || []).slice().sort((a, b) => (a.datum || '').localeCompare(b.datum || ''));
      return Object.assign({}, r, { programma, komend: !!r.van && r.van >= t });
    }).sort((a, b) => (b.van || '').localeCompare(a.van || ''));
    attenties.sort((a, b) => a.geldigTot.localeCompare(b.geldigTot));
    return { status: 200, reizen: lijst, attenties };
  }

  return { reizen, reisZet, reisWeg, reisItem, reisItemWeg };
};
