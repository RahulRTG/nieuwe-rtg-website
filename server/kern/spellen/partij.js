/* Spellen (deelmodule): de partij: de weergave per spelsoort (handen en
   rekken van anderen blijven verborgen), de ZETTEN-dispatch, een zet doen
   en opgeven. Krijgt de gedeelde context een keer bij het opstarten vanuit
   kern/spellen.js. */
module.exports = (ctx) => {
  const { db, save, crypto, codenaamVan, S, SPEL, SOORTEN, nudge, VIEWS, ZETTEN, STATISCH, noteerUitslag } = ctx;
  /* De weergave per spel (de staat zoals EEN speler hem mag zien: handen en
     rekken van anderen blijven verborgen) staat in het spel zelf en komt via
     het register mee in VIEWS. Een spel zonder eigen weergave komt het
     register niet eens door, dus het kan hier niet stil als iets anders
     gerenderd worden. */
  function spelStaat(mij, id, metVelden) {
    const p = S().potjes[id];
    if (!p || !p.spelers.includes(mij)) return { status: 404, error: 'Dit potje bestaat niet (meer).' };
    const uit = { id: p.id, soort: p.soort, naam: SOORTEN[p.soort], status: p.status, modus: p.modus, taal: p.taal || 'nl', teams: p.teams.slice(0, p.spelers.length),
      spelers: p.spelers.map(codenaamVan), ik: p.spelers.indexOf(mij), beurt: p.beurt, winnaar: p.winnaar, gelijk: !!p.gelijk };
    if (p.status !== 'wacht' && p.staat && VIEWS[p.soort]) {
      uit.staat = VIEWS[p.soort](p, p.staat, mij);
      // data die nooit verandert (het Magnaat-bord) reist alleen mee als de
      // client erom vraagt (bij het openen), niet bij elke poll van 2,5 seconde
      if (metVelden && STATISCH[p.soort]) Object.assign(uit.staat, STATISCH[p.soort](p));
    }
    return { status: 200, potje: uit };
  }
  function spelZet(mij, id, zet) {
    const p = S().potjes[id];
    if (!p || !p.spelers.includes(mij)) return { status: 404, error: 'Dit potje bestaat niet (meer).' };
    if (p.status !== 'bezig') return { status: 409, error: 'Dit potje loopt niet (meer).' };
    if (!ZETTEN[p.soort]) return { status: 400, error: 'Onbekend spel.' };
    /* De beurtbewaking is spel-neutraal en leest alleen de descriptor:
       'buitenBeurt' noemt de acties die niet op je beurt hoeven (Magnaat:
       bouwen/terugverkopen; de duels: iedereen speelt in eigen tempo). Geen
       enkele spelnaam meer in deze laag -- dat was hiervoor wel zo, en dat is
       waarom een nieuw spel er stilletjes verkeerd doorheen kon.

       Er was hier ook een 'eigenBeurt' voor schaken. Die is weg: schaakZet
       houdt potje.beurt zelf bij, dus deze controle gaf daar hetzelfde
       antwoord en de vlag bewaakte niets. Zie de kop van spellen/schaak.js. */
    const beheer = zet && (SPEL[p.soort].buitenBeurt || []).includes(zet.actie);
    if (!beheer && p.spelers[p.beurt] !== mij) return { status: 409, error: 'De ander is aan zet.' };
    const r = ZETTEN[p.soort](p, mij, zet || {});
    /* Een potje kan door de zet zelf klaar raken (mat, laatste kaart, doel
       bereikt). Dat vastleggen hoort HIER en niet in elk spel apart: zestien
       motoren die er elk aan moeten denken is zestien kansen om het te
       vergeten, en dat merk je pas als een uitslag ontbreekt. noteerUitslag is
       idempotent, dus een dubbele aanroep kan geen kwaad. */
    if (p.status === 'klaar') noteerUitslag(p);
    return r;
  }
  function spelOpgeven(mij, id) {
    const p = S().potjes[id];
    if (!p || !p.spelers.includes(mij)) return { status: 404, error: 'Dit potje bestaat niet (meer).' };
    if (p.status === 'klaar') return { status: 409, error: 'Dit potje is al klaar.' };
    p.status = 'klaar';
    const rest = p.spelers.filter(sp => sp !== mij);
    p.winnaar = rest.length === 1 ? codenaamVan(rest[0]) : rest.map(codenaamVan).join(' & ');
    noteerUitslag(p);   // opgeven is ook een uitslag: de rest heeft gewonnen
    save();
    rest.forEach(sp => nudge(sp, p));
    return { status: 200, ok: true };
  }
  return { spelStaat, spelZet, spelOpgeven };
};
