/* Boardroom-deel "schakelaar" (kern/afdelingen/boardroom): de functies-motor van
   de schakelkast. Een functie aan/uit (per doelgroep of per genre), de vaste
   PDA-matrix, de uitrolfases als voorinstelling en de grote hendel; plus de
   tegenhangers die na een schakeling automatisch meebewegen. Verbatim
   afgesplitst uit boardroom.js; audit komt via late binding uit de context. */
module.exports = (ctx) => {
  const { save, functies, d } = ctx;
  const audit = (wie, wat) => ctx.audit(wie, wat);

  function functiesStand() { if (!d().techniek) d().techniek = {}; if (!d().techniek.functies) d().techniek.functies = {}; return d().techniek.functies; }

  /* De tegenhangers (KOPPELS in de catalogus): na een schakeling volgt de
     andere kant van dezelfde dienst automatisch. De regel zelf woont in de
     functies-motor (volgKoppels), zodat elke boardroom dezelfde koppeling
     toepast; hier komen alleen de audit en het bewaren bij. */
  function volgKoppels(id, wie) {
    const gevolgd = functies.volgKoppels(id, functiesStand());
    for (const g of gevolgd)
      audit(wie || 'boardroom', 'Tegenhanger ' + g.functie + ' automatisch ' + (g.aan ? 'AAN' : 'UIT') + ' (gekoppeld aan ' + id + ')');
    if (gevolgd.length) save();
    return gevolgd;
  }

  function schakel(id, aan, doelgroep, wie) {
    if (!functies.OP_ID[id]) return { status: 404, error: 'Onbekende functie.' };
    const st = functiesStand();
    if (!st[id]) st[id] = {};
    if (doelgroep) {
      if (!functies.DOELGROEP_IDS.includes(doelgroep)) return { status: 400, error: 'Onbekende doelgroep.' };
      if (!st[id].perDoelgroep) st[id].perDoelgroep = {};
      st[id].perDoelgroep[doelgroep] = aan === true;
    } else {
      st[id].aan = aan === true;
    }
    save();
    audit(wie || 'boardroom', 'Functie ' + id + (doelgroep ? ' voor ' + doelgroep : '') + ' ' + (aan === true ? 'AAN' : 'UIT') + ' gezet');
    const ookGeschakeld = volgKoppels(id, wie);
    return { ok: true, functie: id, aan: aan === true, doelgroep: doelgroep || null, ookGeschakeld };
  }

  /* De leveranciers-regie: een functie per GENRE zaken open of dicht (bijv.
     RTG Eye niet voor horeca). aan=true zet een expliciete uitzondering open;
     dat werkt ook voor genres die volgens de standaard-matrix (alleenGenres in
     de catalogus) normaal dicht staan. */
  function schakelGenre(id, genre, aan, wie) {
    const f = functies.OP_ID[id];
    if (!f) return { status: 404, error: 'Onbekende functie.' };
    if (!d().supplierTypes || !d().supplierTypes[genre]) return { status: 404, error: 'Dit genre bestaat niet.' };
    const st = functiesStand();
    if (!st[id]) st[id] = {};
    st[id].perGenre = st[id].perGenre || {};
    if (aan === true) {
      // terug naar de standaard als die dit genre al kent; anders een uitzondering
      if (Array.isArray(f.alleenGenres) && !f.alleenGenres.includes(genre)) st[id].perGenre[genre] = true;
      else delete st[id].perGenre[genre];
    } else st[id].perGenre[genre] = false;
    save();
    audit(wie || 'boardroom', 'Functie ' + id + ' voor genre ' + genre + ' ' + (aan === true ? 'AAN' : 'UIT') + ' gezet');
    return { ok: true, functie: id, genre, aan: aan === true };
  }
  function genreRegels() {
    const st = functiesStand();
    const uit = [];
    for (const [id, s] of Object.entries(st))
      for (const [genre, aan] of Object.entries(s.perGenre || {})) {
        if (aan === false) uit.push({ functie: id, naam: (functies.OP_ID[id] || {}).naam || id, genre, soort: 'dicht' });
        if (aan === true) uit.push({ functie: id, naam: (functies.OP_ID[id] || {}).naam || id, genre, soort: 'uitzondering' });
      }
    return uit;
  }
  // de vaste PDA-matrix uit de catalogus: welke werk-app hoort bij welke genres
  function genreStandaard() {
    return functies.FUNCTIES.filter(f => Array.isArray(f.alleenGenres))
      .map(f => ({ functie: f.id, naam: f.naam, alleen: f.alleenGenres }));
  }

  /* De uitrolfases: de gefaseerde uitrol als voorinstelling. Eén klik zet de
     hele kast in de stand van die fase (aan wat de fase noemt, dicht wat er
     niet in staat); de interne functies blijven altijd open, net als bij de
     grote hendel. Per-doelgroep fijnregeling blijft staan. */
  function schakelFase(id, wie) {
    const fase = (functies.FASES || []).find(f => f.id === id);
    if (!fase) return { status: 404, error: 'Onbekende fase.' };
    const st = functiesStand();
    let aanN = 0, uitN = 0;
    for (const f of Object.values(functies.OP_ID)) {
      if ((f.doelgroepen || []).includes('intern')) continue;
      if (!st[f.id]) st[f.id] = {};
      const aan = fase.aan === null ? true : fase.aan.includes(f.id);
      st[f.id].aan = aan;
      if (aan) aanN++; else uitN++;
    }
    save();
    audit(wie || 'boardroom', 'Uitrolfase "' + fase.naam + '" gezet: ' + aanN + ' functies aan, ' + uitN + ' dicht');
    return { ok: true, fase: fase.id, naam: fase.naam, aan: aanN, uit: uitN };
  }

  /* De grote hendel: ALLES in een keer beschikbaar zetten of sluiten, voor
     iedereen. De interne functies (doelgroep 'intern': de backoffice zelf)
     blijven buiten schot, anders sluit de boardroom zichzelf buiten en kan
     niemand de hendel nog terugzetten. */
  function schakelAlles(aan, wie) {
    const st = functiesStand();
    let n = 0;
    for (const f of Object.values(functies.OP_ID)) {
      if ((f.doelgroepen || []).includes('intern')) continue;
      if (!st[f.id]) st[f.id] = {};
      st[f.id].aan = aan === true;
      n++;
    }
    save();
    audit(wie || 'boardroom', 'ALLES ' + (aan === true ? 'AAN' : 'UIT') + ': ' + n + ' functies in een keer geschakeld (interne functies uitgezonderd)');
    return { ok: true, aan: aan === true, aantal: n };
  }

  return { functiesStand, volgKoppels, schakel, schakelGenre, genreRegels, genreStandaard, schakelFase, schakelAlles };
};
