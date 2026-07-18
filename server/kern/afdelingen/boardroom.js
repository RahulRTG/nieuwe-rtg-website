/* Afdelingen (deelmodule): de boardroom: taken per kamer, de kamers zelf,
   functies schakelen, de voorstellen en de platformcijfers. audit en
   paniekRij komen per aanroep uit de bewakingslaag (late binding via de
   context). Krijgt de gedeelde context een keer bij het opstarten vanuit
   kern/afdelingen.js. */
module.exports = (ctx) => {
  const { db, save, crypto, anthropic, ledenGeteld, nu, DAG, lijst, tel, recent, d, AFDELINGEN, KAMER_IDS, functies } = ctx;
  const audit = (wie, wat) => ctx.audit(wie, wat);
  const paniekRij = () => ctx.paniekRij();
  const auditRij = () => ctx.auditRij();
  const wereld = () => ctx.wereld();
  function taken(afd) {
    if (!d().kantoorTaken) d().kantoorTaken = {};
    if (!Array.isArray(d().kantoorTaken[afd])) d().kantoorTaken[afd] = [];
    return d().kantoorTaken[afd];
  }
  function taakMaak(afd, tekst) {
    const t = String(tekst || '').replace(/[<>]/g, '').trim().slice(0, 200);
    if (!t) return { status: 400, error: 'Wat moet er gebeuren?' };
    const rij = taken(afd);
    rij.unshift({ id: crypto.randomBytes(4).toString('hex'), tekst: t, af: false, at: nu() });
    if (rij.length > 100) rij.pop();
    save();
    return { ok: true };
  }
  function taakZet(afd, id, af) {
    const t = taken(afd).find(x => x.id === id);
    if (!t) return { status: 404, error: 'Deze taak staat er niet meer.' };
    t.af = af === true;
    save();
    return { ok: true };
  }

  function kamer(id) {
    const a = AFDELINGEN[id];
    if (!a) return { status: 404, error: 'Deze kamer bestaat niet.' };
    return {
      ok: true, id, naam: a.naam, emoji: a.emoji, missie: a.missie,
      kpis: a.kpis().map(([label, waarde]) => ({ label, waarde })),
      lijsten: a.lijsten(), taken: taken(id).slice(0, 30)
    };
  }
  function kamers() {
    return { ok: true, kamers: KAMER_IDS.map(id => {
      const a = AFDELINGEN[id];
      const open = taken(id).filter(t => !t.af).length;
      return { id, naam: a.naam, emoji: a.emoji, missie: a.missie, kpi: a.kpis()[0], takenOpen: open };
    }) };
  }

  /* ---------- de boardroom ---------- */
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

  /* De verbeterkamer: elke dag verse voorstellen uit de echte cijfers.
     Type 'schakel' heeft een knop die het direct uitvoert; type 'aandacht'
     is een werkpunt voor een kamer; type 'code' gaat naar de ontwikkelstraat. */
  function bouwVoorstellen() {
    const uit = [];
    const cat = functies.catalogus(functiesStand());
    for (const g of cat) for (const f of g.functies) {
      if (f.storing) uit.push({ type: 'aandacht', kamer: 'intern', tekst: 'Functie "' + f.naam + '" meldt een storing; de zekering staat open.' });
    }
    const oudeBestellingen = lijst(d().winkelBestellingen).filter(o => o.status === 'nieuw' && nu() - new Date(o.at).getTime() > 2 * DAG);
    if (oudeBestellingen.length) uit.push({ type: 'aandacht', kamer: 'sales', tekst: oudeBestellingen.length + ' winkelbestelling(en) wachten langer dan twee werkdagen op contact.' });
    const openAanvragen = lijst(d().partnerApplications).filter(a => a.status === 'nieuw');
    if (openAanvragen.length >= 3) uit.push({ type: 'aandacht', kamer: 'sales', tekst: openAanvragen.length + ' partner-aanvragen staan open; plan een beoordeelronde.' });
    const verlofOpen = lijst(d().verlof).filter(v => v.status === 'nieuw' || v.status === 'open').length;
    if (verlofOpen) uit.push({ type: 'aandacht', kamer: 'hr', tekst: verlofOpen + ' verlofaanvraag(en) wachten op een besluit.' });
    if (!recent(d().posts, 'at', 7)) uit.push({ type: 'aandacht', kamer: 'marketing', tekst: 'Geen Salon-posts in de afgelopen week; tijd voor een campagne of aanbieding.' });
    if (!uit.length) uit.push({ type: 'aandacht', kamer: 'boardroom', tekst: 'Alles loopt; geen knelpunten gevonden in de dagronde.' });
    return uit;
  }
  function voorstellen(vers) {
    if (!d().boardroom) d().boardroom = {};
    const b = d().boardroom;
    if (vers || !b.voorstellenAt || nu() - b.voorstellenAt > DAG) {
      b.voorstellen = bouwVoorstellen();
      b.voorstellenAt = nu();
      save();
    }
    return { voorstellen: b.voorstellen || [], at: b.voorstellenAt };
  }
  function boardroom() {
    const cat = functies.catalogus(functiesStand());
    return {
      ok: true,
      kamers: kamers().kamers,
      functies: cat, doelgroepen: functies.DOELGROEPEN,
      koppels: (functies.KOPPELS || []).map(k => ({ a: k.a, b: k.b,
        aNaam: (functies.OP_ID[k.a] || {}).naam, bNaam: (functies.OP_ID[k.b] || {}).naam, uitleg: k.uitleg })),
      genreRegels: genreRegels(),
      genreStandaard: genreStandaard(),
      genres: Object.entries(d().supplierTypes || {}).map(([id, t]) => ({ id, label: t.label, icon: t.icon })),
      functiesUit: cat.reduce((n, g) => n + g.functies.filter(f => !f.aan).length, 0),
      verbeterkamer: voorstellen(false),
      paniek: paniekRij().filter(v => v.status === 'open').slice(0, 20),
      audit: auditRij().slice(0, 12)
    };
  }

  /* ---------- platformbrede statistieken: dezelfde eerlijke cijfers in elke
     kamer, over de hele code en het hele platform heen ---------- */
  function platformStats() {
    const cat = functies.catalogus(functiesStand());
    const alleF = cat.flatMap(g => g.functies);
    return { ok: true, stats: [
      { groep: 'Mensen', items: [
        ['Leden in de gids', ledenGeteld()],
        ['Gezinnen (RTF)', Object.keys((d().foundation || {}).gezinnen || {}).length],
        ['Partners', tel(d().suppliers)],
        ['Actieve sessies', Object.keys(d().sessions || {}).length]
      ] },
      { groep: 'Beweging', items: [
        ['Orders totaal', tel(d().orders)], ['Orders deze week', recent(d().orders, 'at', 7)],
        ['Boekingen', tel(d().boekingen)], ['Ritten', tel(d().rides)],
        ['Salon-posts', tel(d().posts)], ['Kassa-verkopen', tel(d().posSales)]
      ] },
      { groep: 'Geld', items: [
        ['Directe betalingen', tel(d().directBetalingen)], ['Munt-ontvangsten', tel(d().muntOntvangsten)],
        ['Winkelbestellingen', tel(d().winkelBestellingen)], ['Cadeaukaarten', tel(d().giftcards)]
      ] },
      { groep: 'De code zelf', items: [
        ['Functies in de catalogus', alleF.length],
        ['Functies aan', alleF.filter(f => f.aan).length],
        ['Functies met storing', alleF.filter(f => f.storing).length],
        ['Uptime (uren)', Math.round(process.uptime() / 36) / 100],
        ['Geheugen (MB)', Math.round(process.memoryUsage().rss / 1048576)]
      ] },
      { groep: 'Veiligheid', items: [
        ['Audit-regels (24u)', recent(d().kantoorAudit, 'at', 1)],
        ['Sleutel-afketsers (24u)', recent(d().doosAfketsers, 'at', 1)],
        ['Doos-opdrachten open', lijst(d().doosOpdrachten).filter(o => !o.klaar).length],
        ['Bolletjes op rood', wereld().telling.rood]
      ] }
    ] };
  }

  /* ---------- interne chat met snaps, per kamer ---------- */
  return { taken, taakMaak, taakZet, kamer, kamers, functiesStand, schakel, schakelAlles, schakelGenre, bouwVoorstellen, voorstellen, boardroom, platformStats };
};
