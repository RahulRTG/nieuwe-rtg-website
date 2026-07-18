/* RTFoundation-gasten (deelmodule): de koppeling tussen een RTG-lid en een
   gezin: gastprofielen, koppelen/ontkoppelen, het gastoverzicht, de
   kanaalinfo en de berichten van en naar gasten. agendaPubliek komt per
   aanroep uit de gezinslevenlaag (late binding via de context). Gemount
   vanuit foundation/gasten.js op de gedeelde context. */
module.exports = (ctx) => {
  const { router, G, eigenVeld, nu, save, rid, schoon, encS, decS,
    familieVan, sessieVan, isGast, locatiePubliek, oppasinfoPubliek } = ctx;
  const agendaPubliek = (g) => ctx.agendaPubliek(g);
  const TIERNAAM = { rtg: 'RTG Pass', lifestyle: 'Lifestyle Pass', business: 'Business Pass' };
  function gastProfielen(code) {
    const g = G()[String(code || '').toUpperCase()];
    if (!g) return null;
    return { gezinNaam: g.naam, profielen: Object.values(g.profielen).filter(p => p.rol === 'gast').map(p => ({ id: p.id, naam: p.naam, avatar: p.avatar, kleur: p.kleur, gekoppeld: !!p.koppel })) };
  }
  function linkGast({ code, profielId, userId, tier, codenaam }) {
    const g = G()[String(code || '').toUpperCase()];
    if (!g) return { error: 'Dit gezin kennen we niet. Klopt de gezinscode?', status: 404 };
    const p = eigenVeld(g.profielen, profielId);
    if (!p) return { error: 'Dit profiel bestaat niet meer.', status: 404 };
    if (p.rol !== 'gast') return { error: 'Alleen een oppas- of familieprofiel kan aan een RTG-pas gekoppeld worden.', status: 403 };
    p.koppel = { userId, tier, tierNaam: TIERNAAM[tier] || 'RTG Pass', codenaam: codenaam || 'lid', at: nu() };
    save();
    return { ok: true, gezinNaam: g.naam, profielNaam: p.naam, tierNaam: p.koppel.tierNaam };
  }
  function unlinkGast({ userId, code, profielId }) {
    let n = 0;
    for (const g of Object.values(G())) for (const p of Object.values(g.profielen || {})) {
      if (p.koppel && p.koppel.userId === userId && (!code || g.code === String(code).toUpperCase()) && (!profielId || p.id === profielId)) { delete p.koppel; n++; }
    }
    if (n) save();
    return { ok: true, verwijderd: n };
  }
  function gekoppeldeGezinnen(userId) {
    const uit = [];
    for (const g of Object.values(G())) for (const p of Object.values(g.profielen || {})) {
      if (p.koppel && p.koppel.userId === userId) uit.push({ code: g.code, gezinNaam: g.naam, profielId: p.id, profielNaam: p.naam });
    }
    return uit;
  }
  // alles wat een gekoppelde oppas/familie mag lezen, klaar voor de RTG-app:
  // de belangrijke info (allergieen, eten, huisregels, noodnummers), de agenda,
  // en waar iedereen is. Precies de gast-functies van de RTFoundation-app.
  function gastOverzicht(userId) {
    const uit = [];
    for (const g of Object.values(G())) {
      const p = Object.values(g.profielen).find(x => x.koppel && x.koppel.userId === userId);
      if (!p) continue;
      const locaties = Object.values(g.locaties || {}).filter(l => g.profielen[l.pid])
        .sort((a, b) => (b.at || '').localeCompare(a.at || '')).map(l => locatiePubliek(l, p.id));
      uit.push({ code: g.code, gezinNaam: g.naam, profielNaam: p.naam, oppasinfo: oppasinfoPubliek(g), agenda: agendaPubliek(g), locaties });
    }
    return uit;
  }
  // het chat-/belkanaal van een gekoppeld gezin voor de RTG-app: het profieltoken
  // (de gast is dit profiel) + de leden om mee te chatten en te bellen
  function kanaalInfo(userId, code) {
    const g = G()[String(code || '').toUpperCase()];
    if (!g) return null;
    const p = Object.values(g.profielen).find(x => x.koppel && x.koppel.userId === userId);
    if (!p) return null;
    return {
      code: g.code, gezinNaam: g.naam, profielId: p.id, token: p.token,
      leden: Object.values(g.profielen).filter(x => x.id !== p.id).map(x => ({ id: x.id, naam: x.naam, avatar: x.avatar, kleur: x.kleur, rol: x.rol }))
    };
  }
  // de RTG-server hangt hier zijn web-push in, zodat een melding ook op de
  // telefoon van de gekoppelde oppas/familie binnenkomt (ook als de app dicht is).
  // De hook staat op de context, zodat ook de berichtenlaag hem kan gebruiken.
  function setPushHook(fn) { ctx.pushHook = fn; }

  // bezorg een gezinsmelding ook in de RTG-app (inbox + telefoonmelding) van gekoppelde gasten
  function bezorgAanGasten(g, bericht) {
    let accounts; try { accounts = require('./../../accounts'); } catch (e) { return; }
    const ontvangers = Object.values(g.profielen).filter(p => p.rol === 'gast' && p.koppel && p.koppel.userId && p.id !== bericht.van && (bericht.naar === 'allen' || bericht.naar === p.id));
    const tekst = decS(bericht.tekst);
    for (const p of ontvangers) {
      try {
        const md = accounts.getMemberState(p.koppel.userId) || {};
        if (!Array.isArray(md.foundationMeldingen)) md.foundationMeldingen = [];
        md.foundationMeldingen.unshift({ id: rid(4), at: nu(), gezin: g.naam, code: g.code, profielNaam: p.naam, van: bericht.vanNaam, tekst, soort: bericht.soort, gelezen: false });
        md.foundationMeldingen = md.foundationMeldingen.slice(0, 40);
        accounts.saveMemberState(p.koppel.userId, md);
      } catch (e) { /* een gekoppelde gast minder bereikt: niet fataal */ }
      if (ctx.pushHook) {
        const kop = bericht.soort === 'hulp' ? '🆘 ' + g.naam : (bericht.soort === 'reis' ? '✈️ ' + g.naam : g.naam);
        try { ctx.pushHook(p.koppel.userId, { title: 'RTFoundation · ' + kop, body: (bericht.vanNaam ? bericht.vanNaam + ': ' : '') + tekst.slice(0, 120), tag: 'rtf-' + bericht.id }); } catch (e) {}
      }
    }
  }

  // een gekoppelde oppas/familie stuurt vanuit de RTG-app een bericht terug naar het gezin
  function berichtVanGast({ userId, code, tekst }) {
    const g = G()[String(code || '').toUpperCase()];
    if (!g) return { error: 'Dit gezin kennen we niet.', status: 404 };
    const p = Object.values(g.profielen).find(x => x.koppel && x.koppel.userId === userId);
    if (!p) return { error: 'Je bent niet (meer) aan dit gezin gekoppeld.', status: 403 };
    const schoonTekst = schoon(tekst, 800);
    if (!schoonTekst) return { error: 'Schrijf een bericht.', status: 400 };
    const b = { id: rid(3), van: p.id, vanNaam: p.naam, vanAvatar: p.avatar, naar: 'allen', soort: 'bericht', tekst: encS(schoonTekst), at: nu(), gelezenDoor: [p.id] };
    if (!g.berichten) g.berichten = [];
    g.berichten.unshift(b); g.berichten = g.berichten.slice(0, 200); save();
    bezorgAanGasten(g, b); // andere gekoppelde gasten krijgen het ook
    return { ok: true };
  }
  return { gastProfielen, linkGast, unlinkGast, gekoppeldeGezinnen, gastOverzicht, kanaalInfo, setPushHook, bezorgAanGasten, berichtVanGast };
};
