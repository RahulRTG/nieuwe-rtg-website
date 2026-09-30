/* De laatst bekende plek, en het live-venster.

   Dit is het antwoord op "het moet ook werken als mijn telefoon uitvalt".
   De telefoon stuurt zijn positie zolang hij leeft; de SERVER onthoudt de
   laatste. Gaat het toestel daarna uit -- lege batterij, in het water, of
   iemand zet hem uit -- dan heeft de kring nog steeds de plek van het laatste
   levensteken, met de tijd erbij. Dat is precies de plek die je wilt weten.

   Twee dingen bewust NIET:
   - geen spoor. We bewaren de laatste positie, plus een kort spoor van
     maximaal 12 punten binnen een LOPEND live-venster, en allebei gaan ze weg
     zodra het venster sluit of afloopt (NAVIGATIE.md N19: ook de laatste plek
     bestaat alleen binnen een venster; daarbuiten wordt hij niet bewaard). Een permanent locatiearchief van een lid is een
     schat voor wie inbreekt, en dit is een veiligheidsapp, geen volgsysteem.
   - geen delen zonder venster. Buiten een alarm of een lopende wacht ziet
     niemand iets, ook je kring niet. Toestemming heeft hier altijd een
     einddatum, en die staat in het venster zelf. */
module.exports = ({ opslag, save }) => {
  const nu = () => new Date().toISOString();
  const SPOOR_MAX = 12;

  function lijsten() {
    opslag.tak('plek'); opslag.tak('vensters');
    return opslag.wortel();
  }

  const getal = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

  /* Een positie melden. Roept de app elke paar minuten aan zolang er iets
     loopt; ook een enkele melding is genoeg om de kring iets te geven. */
  function plekMelden(handle, body) {
    const V = lijsten();
    const lat = getal(body.lat), lon = getal(body.lon);
    if (lat == null || lon == null || lat < -90 || lat > 90 || lon < -180 || lon > 180)
      return { status: 400, error: 'Ongeldige positie.' };
    const punt = {
      lat: Math.round(lat * 1e5) / 1e5,          // ~1 meter; preciezer hoeft niet
      lon: Math.round(lon * 1e5) / 1e5,
      nauwkeurig: getal(body.nauwkeurig),
      accu: getal(body.accu),                     // batterijstand, als de browser hem geeft
      at: nu()
    };
    /* ZONDER OPEN VENSTER GEEN PLEK (N19). Tot 29 september 2026 werd de
       laatste plek altijd bewaard en nooit weggehaald: een blijvende "waar was
       dit lid het laatst" zonder dat er iets liep. Buiten een venster ziet de
       kring niets, dus is er ook niets om te onthouden. De melding slaagt wel
       (200): het toestel doet niets fout, er valt alleen niets te bewaren. */
    const venster = vensterOpen_(handle);
    if (!venster) { vergeetHandle(V, handle); save(); return { status: 200, ok: true, at: punt.at, bewaard: false }; }
    V.plek[handle] = punt;
    venster.spoor = (venster.spoor || []).concat([punt]).slice(-SPOOR_MAX);
    save();
    return { status: 200, ok: true, at: punt.at, bewaard: true };
  }

  // Venster en plek gaan samen weg: de plek bestond alleen voor dit venster (N19).
  function vergeetHandle(V, handle) { delete V.vensters[handle]; delete V.plek[handle]; }

  function laatstePlek(handle) {
    const V = lijsten();
    return vensterOpen_(handle) ? (V.plek[handle] || null) : null;
  }

  /* Een live-venster openen: vanaf nu tot een vast moment mag de kring
     meekijken. Altijd eindig; wie langer wil, opent hem opnieuw. */
  function vensterOpen(handle, minuten, reden) {
    const V = lijsten();
    const m = Math.max(5, Math.min(720, Number(minuten) || 60));
    V.vensters[handle] = { tot: Date.now() + m * 60000, reden: String(reden || 'wacht').slice(0, 40), spoor: [], van: nu() };
    save();
    return { status: 200, ok: true, tot: new Date(V.vensters[handle].tot).toISOString() };
  }

  function vensterSluit(handle) {
    const V = lijsten();
    // het spoor en de laatste plek gaan mee weg: ze bestonden alleen voor dit venster (N19)
    vergeetHandle(V, handle);
    save();
    return { status: 200, ok: true };
  }

  function vensterOpen_(handle) {
    const V = lijsten();
    const v = V.vensters[handle];
    return v && v.tot > Date.now() ? v : null;
  }

  /* Een venster loopt af zonder dat iemand sluit. De bewaarveger ruimt het
     dan op, met de plek erbij -- en ook een plek zonder venster, van voor N19. */
  function vergeetVerlopen() {
    const V = lijsten();
    let n = 0;
    for (const h of Object.keys(V.plek)) if (!vensterOpen_(h)) { delete V.plek[h]; n++; }
    for (const h of Object.keys(V.vensters)) if (!vensterOpen_(h)) delete V.vensters[h];
    return n;
  }

  /* Wat een kringlid te zien krijgt. `magPlek` komt uit de kring: staat de
     locatie voor dit contact uit, dan krijgt hij het alarm zonder de plek. */
  function plekVoorContact(handle, magPlek) {
    if (!magPlek) return null;
    const p = laatstePlek(handle);
    if (!p) return null;
    const v = vensterOpen_(handle);
    const ouderdomMin = Math.round((Date.now() - new Date(p.at).getTime()) / 60000);
    return {
      lat: p.lat, lon: p.lon, at: p.at, nauwkeurig: p.nauwkeurig, accu: p.accu,
      ouderdomMin,
      // eerlijk label: een kwartier oud is iets anders dan nu
      vers: ouderdomMin <= 5,
      live: !!v,
      spoor: v ? (v.spoor || []).slice(-SPOOR_MAX) : []
    };
  }

  return { plekMelden, laatstePlek, vensterOpen, vensterSluit, vensterActief: vensterOpen_, plekVoorContact, vergeetVerlopen };
};
