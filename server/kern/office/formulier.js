/* RTG Office, het formulier: de ene officesoort die door ANDEREN wordt
   gebruikt. De eigenaar bouwt vragen (open, keuze of schaal 1-5) en deelt
   het document; wie het kan lezen kan het invullen, en wie het kan
   schrijven ziet de uitslag.

   De inzendingen staan niet in het document zelf (dan zou elke autosave
   van de eigenaar over de antwoorden van anderen heen schrijven) maar in
   een eigen bak per formulier, een inzending per persoon: opnieuw
   insturen vervangt de vorige.

   De anoniem-stand, eerlijk gezegd: bij 'anoniem' ziet de eigenaar nooit
   wie wat antwoordde -- maar de server weet het wel, want zonder te weten
   wie inzond kan "een inzending per persoon" niet bestaan. Die zin hoort
   op het scherm, niet alleen hier. */

const { MAX_INZENDINGEN } = require('./basis');

module.exports = ({ db, save }, basis) => {
  const { nu, docMet, naamVan, magSchrijven, magLezen } = basis;

  function bak() {
    if (!db.data.officeAntwoorden || typeof db.data.officeAntwoorden !== 'object') db.data.officeAntwoorden = {};
    return db.data.officeAntwoorden;
  }
  function pak(did) {
    const d = docMet(did);
    if (!d) return { fout: { status: 404, error: 'Formulier niet gevonden.' } };
    if (d.soort !== 'formulier') return { fout: { status: 400, error: 'Dit document is geen formulier.' } };
    return { d };
  }

  /* ---- invullen: wie mag lezen, mag antwoorden ---- */
  function vul(key, did, data, kring) {
    const { d, fout } = pak(did);
    if (fout) return fout;
    if (!magLezen(d, key, kring)) return { status: 403, error: 'Dit formulier is niet met u gedeeld.' };
    const mijn = bak()[d.id] && bak()[d.id][key];
    // kijk: alleen de eigen stand opvragen (al ingevuld?), zonder in te sturen
    if (data.kijk) return { status: 200, ingevuld: !!mijn, om: mijn ? mijn.om : null };
    const vragen = (d.inhoud && d.inhoud.vragen) || [];
    const bron = Array.isArray(data.antwoorden) ? data.antwoorden : [];
    // per vraag het antwoord in de vorm van die vraag; wat niet past wordt
    // geen gok maar een leeg antwoord
    const antwoorden = vragen.map((v, i) => {
      const a = bron[i];
      // een overgeslagen vraag is GEEN antwoord: zonder deze regel maakt
      // Number(null) er een 0 van, en telt "niets gekozen" als de eerste optie
      if (a == null || a === '') return v.soort === 'open' ? '' : null;
      if (v.soort === 'keuze') {
        const n = Math.round(Number(a));
        return Number.isFinite(n) && n >= 0 && n < (v.opties || []).length ? n : null;
      }
      if (v.soort === 'schaal') {
        const n = Math.round(Number(a));
        return n >= 1 && n <= 5 ? n : null;
      }
      return String(a).slice(0, 500);
    });
    const iets = antwoorden.some((a, i) => vragen[i].soort === 'open' ? String(a).trim() : a != null);
    if (!iets) return { status: 400, error: 'Vul eerst een antwoord in.' };
    const alle = bak();
    if (!alle[d.id]) alle[d.id] = {};
    if (!mijn && Object.keys(alle[d.id]).length >= MAX_INZENDINGEN)
      return { status: 409, error: 'Dit formulier zit vol (' + MAX_INZENDINGEN + ' inzendingen).' };
    alle[d.id][key] = { om: nu(), antwoorden };
    save();
    return { status: 200, ok: true, vervangen: !!mijn, aantal: Object.keys(alle[d.id]).length };
  }

  /* ---- de uitslag: voor wie het formulier beheert (mag schrijven) ---- */
  function uitslag(key, did, kring) {
    const { d, fout } = pak(did);
    if (fout) return fout;
    if (!magSchrijven(d, key, kring)) return { status: 403, error: 'De uitslag is voor wie het formulier beheert.' };
    const inzendingen = Object.entries(bak()[d.id] || {});
    const vragen = (d.inhoud && d.inhoud.vragen) || [];
    const anoniem = (d.inhoud && d.inhoud.wijze) === 'anoniem';
    const per = vragen.map((v, i) => {
      const antw = inzendingen.map(([wie, z]) => ({ wie, a: (z.antwoorden || [])[i] }));
      if (v.soort === 'keuze') {
        const telling = (v.opties || []).map(o => ({ optie: o, aantal: 0 }));
        for (const x of antw) if (x.a != null && telling[x.a]) telling[x.a].aantal++;
        return { tekst: v.tekst, soort: 'keuze', telling };
      }
      if (v.soort === 'schaal') {
        const nrs = antw.map(x => x.a).filter(n => n >= 1 && n <= 5);
        const telling = [1, 2, 3, 4, 5].map(n => nrs.filter(x => x === n).length);
        const gemiddelde = nrs.length
          ? Math.round(nrs.reduce((s, n) => s + n, 0) / nrs.length * 10) / 10 : null;
        return { tekst: v.tekst, soort: 'schaal', gemiddelde, telling };
      }
      return { tekst: v.tekst, soort: 'open',
        teksten: antw.filter(x => String(x.a || '').trim())
          .map(x => anoniem ? { tekst: x.a } : { van: naamVan(x.wie), tekst: x.a }) };
    });
    return { status: 200, wijze: anoniem ? 'anoniem' : 'codenaam', aantal: inzendingen.length,
      vragen: per,
      // bij codenaam ziet de beheerder wie er invulde; bij anoniem bewust niet
      wie: anoniem ? undefined : inzendingen.map(([k, z]) => ({ van: naamVan(k), om: z.om })) };
  }

  return { officeVul: vul, officeUitslag: uitslag };
};
