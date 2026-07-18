/* Spellen (deelmodule): de partij: de weergave per spelsoort (handen en
   rekken van anderen blijven verborgen), de ZETTEN-dispatch, een zet doen
   en opgeven. Krijgt de gedeelde context een keer bij het opstarten vanuit
   kern/spellen.js. */
module.exports = (ctx) => {
  const { db, save, crypto, zijnVrienden, codenaamVan, sseToCustomer, isGeblokkeerd, socialZoek, sociaalRate, volwassen,
    rid, nu, S, SPEL, SOORTEN, TEAMS, wereldFout, leeftijdFout, nudge, schud, beurtDoor, opschonen,
    mejnInit, mejnZet, mejnZetten, mejnGooi, schaakInit, schaakZet, woordInit, woordZet, W_PREMIE,
    pestenInit, pestenZet, damInit, damZet, damZetten, rummiInit, rummiZet, rummiSet,
    magnaatInit, magnaatZet, M_VELDEN, secondenInit, secondenZet, waarheidInit, waarheidZet, proostInit, proostZet } = ctx;
  /* De staat zoals EEN speler hem mag zien (handen en rekken van anderen
     blijven verborgen). Een expliciete map per soort: een nieuw spel zonder
     eigen weergave faalt luid in plaats van stil als Woordduel te renderen. */
  const VIEWS = {
    mejn: (p, st, mij) => ({ pionnen: p.spelers.map(sp => st.pionnen[sp].map(x => x.pos)), dobbel: st.dobbel, mag: st.mag, zetten: p.spelers[p.beurt] === mij && st.mag === 'zet' ? mejnZetten(p, mij) : [] }),
    schaak: (p, st) => ({ bord: st.bord.join(''), aanZet: st.aanZet, laatste: st.zetten[st.zetten.length - 1] || null }),
    woord: (p, st, mij) => ({ bord: st.bord, scores: p.spelers.map(sp => st.scores[sp]), rek: st.rekken[mij], zak: st.zak.length, passes: st.passes }),
    pesten: (p, st, mij) => ({ hand: st.handen[mij], aantallen: p.spelers.map(sp => st.handen[sp].length), open: st.open[st.open.length - 1], kleurKeuze: st.kleurKeuze, pak: st.pak, richting: st.richting, stapel: st.stapel.length }),
    dam: (p, st, mij) => ({ bord: st.bord.join(''), ketting: st.ketting, zetten: p.status === 'bezig' && p.spelers[p.beurt] === mij ? damZetten(p, mij) : [] }),
    rummi: (p, st, mij) => ({ rek: st.rekken[mij], tafel: st.tafel, aantallen: p.spelers.map(sp => st.rekken[sp].length), zak: st.zak.length, eerste: st.eerste[mij], passes: st.passes }),
    magnaat: (p, st) => ({ posities: p.spelers.map(sp => st.posities[sp]), geld: p.spelers.map(sp => st.geld[sp]), failliet: p.spelers.map(sp => !!st.failliet[sp]), cel: p.spelers.map(sp => st.cel[sp] > 0),
      eigenaar: Object.fromEntries(Object.entries(st.eigenaar).map(([v, h]) => [v, p.spelers.indexOf(h)])), // veld -> spelerindex
      huizen: st.huizen, mag: st.mag, koopVeld: st.koopVeld, dobbel: st.dobbel, kaart: st.kaart }),
    seconden: (p, st, mij) => {
      const rader = (p.beurt + 2) % p.spelers.length; // de teamgenoot raadt en mag de kaart niet zien
      return { scores: st.scores, kaart: st.kaart && p.spelers.indexOf(mij) !== rader ? st.kaart : null, tot: st.tot, rader, bezig: !!st.kaart };
    },
    waarheid: (p, st) => ({ punten: p.spelers.map(sp => st.punten[sp]), kaart: st.kaart, wat: st.wat, doel: 8 }),
    proost: (p, st) => ({ kaart: st.kaart, teller: st.teller, totaal: st.totaal })
  };
  function spelStaat(mij, id, metVelden) {
    const p = S().potjes[id];
    if (!p || !p.spelers.includes(mij)) return { status: 404, error: 'Dit potje bestaat niet (meer).' };
    const uit = { id: p.id, soort: p.soort, naam: SOORTEN[p.soort], status: p.status, modus: p.modus, taal: p.taal || 'nl', teams: p.teams.slice(0, p.spelers.length),
      spelers: p.spelers.map(codenaamVan), ik: p.spelers.indexOf(mij), beurt: p.beurt, winnaar: p.winnaar, gelijk: !!p.gelijk };
    if (p.status !== 'wacht' && p.staat && VIEWS[p.soort]) {
      uit.staat = VIEWS[p.soort](p, p.staat, mij);
      // het statische Magnaat-bord reist alleen mee als de client erom vraagt
      // (bij het openen), niet bij elke poll van 2,5 seconde
      if (p.soort === 'magnaat' && metVelden) uit.staat.velden = M_VELDEN;
    }
    return { status: 200, potje: uit };
  }
  const ZETTEN = { mejn: mejnZet, schaak: schaakZet, woord: woordZet, pesten: pestenZet, dam: damZet, rummi: rummiZet, magnaat: magnaatZet, seconden: secondenZet, waarheid: waarheidZet, proost: proostZet };
  function spelZet(mij, id, zet) {
    const p = S().potjes[id];
    if (!p || !p.spelers.includes(mij)) return { status: 404, error: 'Dit potje bestaat niet (meer).' };
    if (p.status !== 'bezig') return { status: 409, error: 'Dit potje loopt niet (meer).' };
    if (!ZETTEN[p.soort]) return { status: 400, error: 'Onbekend spel.' };
    // sommige acties mogen buiten je beurt (Magnaat: bouwen/terugverkopen);
    // dat staat in de speltabel, niet als losse uitzondering in de dispatch
    const beheer = zet && (SPEL[p.soort].buitenBeurt || []).includes(zet.actie);
    if (p.soort !== 'schaak' && !beheer && p.spelers[p.beurt] !== mij) return { status: 409, error: 'De ander is aan zet.' };
    if (p.soort === 'mejn' && zet && zet.actie === 'gooi') return mejnGooi(p, mij);
    return ZETTEN[p.soort](p, mij, zet || {});
  }
  function spelOpgeven(mij, id) {
    const p = S().potjes[id];
    if (!p || !p.spelers.includes(mij)) return { status: 404, error: 'Dit potje bestaat niet (meer).' };
    if (p.status === 'klaar') return { status: 409, error: 'Dit potje is al klaar.' };
    p.status = 'klaar';
    const rest = p.spelers.filter(sp => sp !== mij);
    p.winnaar = rest.length === 1 ? codenaamVan(rest[0]) : rest.map(codenaamVan).join(' & ');
    save();
    rest.forEach(sp => nudge(sp, p));
    return { status: 200, ok: true };
  }
  return { spelStaat, spelZet, spelOpgeven };
};
