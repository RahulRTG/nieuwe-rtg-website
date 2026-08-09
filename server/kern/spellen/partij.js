/* Spellen (deelmodule): de partij: de weergave per spelsoort (handen en
   rekken van anderen blijven verborgen), de ZETTEN-dispatch, een zet doen
   en opgeven. Krijgt de gedeelde context een keer bij het opstarten vanuit
   kern/spellen.js. */
module.exports = (ctx) => {
  const { db, save, crypto, codenaamVan, nu, S, SPEL, SOORTEN, nudge, VIEWS, ZETTEN, STATISCH, noteerUitslag, noteerZet, zijnVrienden, isGeblokkeerd } = ctx;
  // het toernooi hangt aan dezelfde plek als de uitslag: zo is er geen tweede
  // moment waarop een ronde kan blijven hangen (late binding, zie spellen.js)
  const naPotje = (p) => { noteerUitslag(p); if (ctx.toernooiPotjeKlaar) ctx.toernooiPotjeKlaar(p); };
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
    // het verloop vastleggen, maar alleen van een zet die is GEACCEPTEERD:
    // een replay met afgekeurde zetten erin is geen verloop maar een logboek
    if (!r.error) noteerZet(p, mij, zet || {});
    /* Wanneer er voor het laatst iets GEBEURDE. `at` is het moment van
       aanmaken en zegt niets over of een potje nog leeft; zonder dit stempel
       kan de opschoning een verlaten partij niet van een drukke onderscheiden. */
    if (!r.error) p.zetAt = nu();
    /* Een potje kan door de zet zelf klaar raken (mat, laatste kaart, doel
       bereikt). Dat vastleggen hoort HIER en niet in elk spel apart: zestien
       motoren die er elk aan moeten denken is zestien kansen om het te
       vergeten, en dat merk je pas als een uitslag ontbreekt. noteerUitslag is
       idempotent, dus een dubbele aanroep kan geen kwaad. */
    if (p.status === 'klaar') naPotje(p);
    return r;
  }
  /* MEEKIJKEN. Twee poorten, en ze doen verschillend werk.

     1. MAG DIT SPEL BEKEKEN WORDEN? Dat staat per spel in de descriptor
        (`kijken`) en staat STANDAARD UIT. Niet uit voorzichtigheid maar omdat
        het echt misgaat: de weergave van 30 Seconden verbergt de kaart voor de
        rader door op zijn spelersindex te kijken, en een kijker heeft geen
        index -- die zou de kaart juist wel zien en hem kunnen doorgeven. Een
        nieuw spel is dus niet te bekijken tot iemand die vraag beantwoordt.

     2. MAG JIJ DIT POTJE BEKIJKEN? Je bent vriend van een speler, of je doet
        mee aan hetzelfde toernooi. Blokkades gelden aan beide kanten: wie jou
        heeft geblokkeerd hoeft niet te dulden dat je zijn partij volgt.

     De kijker krijgt dezelfde weergave als een speler, maar aangeroepen ZONDER
     speler. Alles wat aan een persoon hangt (je hand, je rek, je zetten) valt
     daardoor vanzelf weg -- er is geen tweede weergave die apart kan gaan
     afwijken van de echte. */
  function magKijken(mij, p) {
    if (p.spelers.includes(mij)) return 'Je speelt zelf mee in dit potje.';
    if (!SPEL[p.soort] || !SPEL[p.soort].kijken) return 'Bij dit spel kun je niet meekijken.';
    if (p.spelers.some(sp => isGeblokkeerd(mij, sp))) return 'Dit potje is niet beschikbaar.';
    if (p.spelers.some(sp => zijnVrienden(mij, sp))) return null;
    if (p.toernooi && ctx.toernooiHeeftSpeler && ctx.toernooiHeeftSpeler(p.toernooi, mij)) return null;
    return 'Je kunt alleen meekijken bij vrienden, of bij een toernooi waar je zelf aan meedoet.';
  }
  function spelKijk(mij, id) {
    const p = S().potjes[id];
    if (!p) return { status: 404, error: 'Dit potje bestaat niet (meer).' };
    const fout = magKijken(mij, p);
    if (fout) return { status: 403, error: fout };
    const uit = { id: p.id, soort: p.soort, naam: SOORTEN[p.soort], status: p.status, modus: p.modus,
      spelers: p.spelers.map(codenaamVan), beurt: p.beurt,
      aanZet: p.status === 'bezig' ? codenaamVan(p.spelers[p.beurt]) : null,
      winnaar: p.winnaar, gelijk: !!p.gelijk, kijker: true };
    if (p.status !== 'wacht' && p.staat && VIEWS[p.soort]) uit.staat = VIEWS[p.soort](p, p.staat, null);
    return { status: 200, potje: uit };
  }

  function spelOpgeven(mij, id) {
    const p = S().potjes[id];
    if (!p || !p.spelers.includes(mij)) return { status: 404, error: 'Dit potje bestaat niet (meer).' };
    if (p.status === 'klaar') return { status: 409, error: 'Dit potje is al klaar.' };
    p.status = 'klaar';
    const rest = p.spelers.filter(sp => sp !== mij);
    p.winnaar = rest.length === 1 ? codenaamVan(rest[0]) : rest.map(codenaamVan).join(' & ');
    naPotje(p);   // opgeven is ook een uitslag: de rest heeft gewonnen
    save();
    rest.forEach(sp => nudge(sp, p));
    return { status: 200, ok: true };
  }
  return { spelStaat, spelZet, spelOpgeven, spelKijk };
};
