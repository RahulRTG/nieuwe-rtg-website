/* Rechterhand (deelmodule): Cercle -- uw besloten clubs en lidmaatschappen over de
   hele wereld. Per club de stad, uw lidnummer, sinds wanneer u lid bent, de
   dresscode, met welke clubs er reciprociteit is (waar u als gast terecht kunt) en
   hoeveel gastpassen u nog heeft. Bij uitstek jetset. Gemount via index.js.

   RONDE 5 -- wat elders geld kost, zit hier in de pas. Twee dingen waarvoor u
   elders een conciergedienst betaalt, en die hier gewoon in de app zitten:

   1. RECIPROCITEIT ALS GEGEVENS, NIET ALS TEKSTVELD. Het stond hier als een
      regel vrije tekst, en daar kon niemand iets mee. Het is nu een lijst met
      clubnamen per lidmaatschap, en daarmee kan de app de enige vraag
      beantwoorden die er werkelijk toe doet: "ik ben volgende week in Milaan --
      waar kan ik terecht, en op welk lidmaatschap?" (waarheen).
      Oude records met een tekstregel blijven werken: die wordt bij het lezen op
      komma's en puntkomma's gesplitst. Een veld, een betekenis.
   2. GASTPASSEN MET EEN BOEKHOUDING. Er stond een getal, en dat klopte nooit
      meer zodra u er een had gebruikt. Nu houdt de app bij wie u wanneer heeft
      meegenomen, en het getal loopt vanzelf terug. Vergissing? Terugdraaien kan.

   Wat hier NIET komt: een clubgids die wij zouden "kennen". Wij verzinnen geen
   reciprociteit; wat u invult is wat er staat, en dat zegt de app er ook bij. */
module.exports = (ctx) => {
  const { save, rid, nu, schoon, getal, L } = ctx;

  function C(key) { const l = L(key); if (!Array.isArray(l.cercle)) l.cercle = []; return l.cercle; }
  const jaar = () => new Date().getFullYear();

  /* Van tekstregel naar lijst. Doet dienst als zachte migratie: wat er vroeger
     als "Soho House, Annabel's" stond, leest nu als twee clubs. */
  const alsLijst = (v) => (Array.isArray(v) ? v : String(v || '').split(/[,;]/))
    .map(x => schoon(x, 80)).filter(Boolean).slice(0, 40);

  function crClub(key, b) {
    const naam = schoon(b.naam, 80);
    if (!naam) return { status: 400, error: 'Welke club betreft het?' };
    const clubs = C(key);
    const rec = { naam, stad: schoon(b.stad, 60), lidnummer: schoon(b.lidnummer, 40),
      sinds: Number(b.sinds) >= 1800 && Number(b.sinds) <= jaar() ? Math.round(Number(b.sinds)) : null,
      dresscode: schoon(b.dresscode, 80), reciprociteit: alsLijst(b.reciprociteit),
      gastpassen: getal(b.gastpassen, 999), notitie: schoon(b.notitie, 300) };
    if (b.id) {
      const c = clubs.find(x => x.id === b.id);
      if (!c) return { status: 404, error: 'Deze club staat niet in uw Cercle.' };
      Object.assign(c, rec); save(); return { status: 200, ok: true };
    }
    if (clubs.length >= 300) return { status: 400, error: 'Uw Cercle is vol.' };
    clubs.unshift(Object.assign({ id: rid(), at: nu(), gastlog: [] }, rec)); save();
    return { status: 200, ok: true };
  }
  function crClubWeg(key, id) { const l = L(key); l.cercle = C(key).filter(x => x.id !== id); save(); return { status: 200, ok: true }; }

  /* Een gastpas gebruiken. De boekhouding die een concierge anders voor u doet:
     wie ging er mee, waar, wanneer -- en het saldo loopt terug. */
  function crGast(key, b) {
    const club = C(key).find(x => x.id === b.id);
    if (!club) return { status: 404, error: 'Deze club staat niet in uw Cercle.' };
    if (!Array.isArray(club.gastlog)) club.gastlog = [];
    if ((Number(club.gastpassen) || 0) <= 0) return { status: 400, error: 'U heeft geen gastpassen meer bij deze club.' };
    club.gastpassen = Math.max(0, (Number(club.gastpassen) || 0) - 1);
    club.gastlog.unshift({ id: rid(), at: nu(), wie: schoon(b.wie, 80), stad: schoon(b.stad, 60), notitie: schoon(b.notitie, 200) });
    club.gastlog = club.gastlog.slice(0, 200);
    save();
    return { status: 200, ok: true, gastpassen: club.gastpassen };
  }
  function crGastTerug(key, b) {
    const club = C(key).find(x => x.id === b.id);
    if (!club || !Array.isArray(club.gastlog)) return { status: 404, error: 'Niet gevonden.' };
    const i = club.gastlog.findIndex(g => g.id === b.gastId);
    if (i < 0) return { status: 404, error: 'Deze gastpas staat niet in het logboek.' };
    club.gastlog.splice(i, 1);
    club.gastpassen = (Number(club.gastpassen) || 0) + 1;
    save();
    return { status: 200, ok: true, gastpassen: club.gastpassen };
  }

  /* De vraag waar het echt om gaat: waar kan ik in deze stad terecht, en op
     welk lidmaatschap? Zowel uw eigen clubs in die stad als de clubs waar een
     van uw lidmaatschappen u als gast binnenlaat. */
  function crWaarheen(key, b) {
    const zoek = schoon(b.stad, 60).toLowerCase();
    const clubs = C(key);
    const eigen = clubs.filter(c => !zoek || String(c.stad || '').toLowerCase().includes(zoek))
      .map(c => ({ club: c.naam, stad: c.stad || '', via: 'eigen lidmaatschap',
        lidnummer: c.lidnummer || '', dresscode: c.dresscode || '', gastpassen: Number(c.gastpassen) || 0 }));
    const viaGast = [];
    for (const c of clubs) {
      for (const r of alsLijst(c.reciprociteit)) {
        if (zoek && !r.toLowerCase().includes(zoek)) continue;
        viaGast.push({ club: r, stad: '', via: 'reciprociteit van ' + c.naam, dresscode: c.dresscode || '' });
      }
    }
    return { status: 200, stad: schoon(b.stad, 60), eigen, viaGast,
      bron: 'Alles hierin komt uit wat u zelf heeft ingevuld. RTG houdt geen clubgids bij en belooft niets namens een club; bel vooruit.' };
  }

  function cercle(key) {
    const clubs = C(key).slice()
      .map(c => Object.assign({}, c, { reciprociteit: alsLijst(c.reciprociteit), gastlog: c.gastlog || [] }))
      .sort((a, b) => String(a.stad).localeCompare(String(b.stad)) || String(a.naam).localeCompare(String(b.naam)));
    const steden = new Set(clubs.map(c => (c.stad || '').toLowerCase()).filter(Boolean));
    return { status: 200, clubs, aantal: clubs.length, steden: steden.size,
      gastpassen: clubs.reduce((s, c) => s + (Number(c.gastpassen) || 0), 0),
      gastenDitJaar: clubs.reduce((s, c) => s + (c.gastlog || []).filter(g => String(g.at).slice(0, 4) === String(jaar())).length, 0),
      reciprociteiten: clubs.reduce((s, c) => s + c.reciprociteit.length, 0) };
  }

  return { cercle, crClub, crClubWeg, crGast, crGastTerug, crWaarheen };
};
