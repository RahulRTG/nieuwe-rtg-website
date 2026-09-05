/* Foundation OS, deel "deelnemerportaal": de mens met de hulpvraag.

   Wie hulp vraagt moet weten waar het staat en ook weer nee kunnen zeggen.
   Dit portaal geeft die regie terug zonder het interne dossier te openen.

   DE TWEE KNOPPEN DIE ERTOE DOEN:

   1. WAAR STAAT HET. Status en uitgevoerde stappen, geen interne notities.

   2. TOESTEMMING INTREKKEN. Wie ja zei, mag nee zeggen, en dan stopt het bij de
      eerstvolgende stap die toestemming nodig heeft (casus-keten.js). Dat is
      geen theoretisch recht: het staat hier als knop, want een recht waarvoor
      je moet bellen naar de organisatie die je juist wilde stoppen, is geen
      recht maar een drempel.

   Geen contactgegevens, hulpverlenersnamen of andere dossiers: een code kan
   worden meegelezen en opent precies één geminimaliseerd dossier.

   DE CODE VERVALT MET HET DOSSIER. Is de casus afgerond en de bewaartermijn
   voorbij, dan is er niets meer om te tonen -- en dat is het antwoord, niet een
   fout. */

module.exports = (ctx, eigen) => {
  const { schoon, S, audit, wieIn, poortIn, stadVanIn, save, codelevenscyclus } = ctx;
  const { toestemmingWegDirect } = eigen;

  const DOEL = 'foundation-persoonsportaal';
  const SOORT = 'deelnemer';
  const SCOPE = { lezen: 'deelnemer:lezen', intrekken: 'deelnemer:toestemming-intrekken' };
  const volg = (r, fn) => r && typeof r.then === 'function' ? r.then(fn) : fn(r);

  function vindCode(c, scope) {
    return volg(codelevenscyclus.controleer(c, { doel: DOEL, soort: SOORT, scope }, (staat, toegang) => {
      const bron = staat || S();
      const rij = (bron.casussen || []).find(x =>
        x.id === toegang.onderwerp.id && x.persoonscode_id === toegang.id) || null;
      return rij ? { rij, staat: bron } : null;
    }), t => {
      if (!t.ok) return { fout: { status: t.status, error: t.error } };
      return { rij: t.gebonden.rij, staat: t.gebonden.staat, toegang: t.toegang };
    });
  }
  function metCode(c, scope, werk) {
    return codelevenscyclus.transactie(tx => {
      const staat = tx.staat || S();
      const t = tx.controleer(c, { doel: DOEL, soort: SOORT, scope }, (bron, toegang) =>
        ((bron || staat).casussen || []).find(x =>
          x.id === toegang.onderwerp.id && x.persoonscode_id === toegang.id) || null);
      if (!t.ok) return { status: t.status, error: t.error };
      return werk(staat, t.gebonden, t.toegang);
    });
  }

  const opties = b => ({
    geldig_dagen: b && (b.geldig_dagen || b.geldigDagen),
    max_gebruik: b && (b.max_gebruik || b.maxGebruik)
  });
  const invoer = (w, c, b) => Object.assign({
    prefix: 'RTFD', issuer: w.key, doel: DOEL, scope: Object.values(SCOPE),
    onderwerp: { soort: SOORT, id: c.id }
  }, opties(b));

  function kantoordeurIn(req, id, staat) {
    const c = ((staat && staat.casussen) || []).find(x => x.id === String(id || ''));
    if (!c) return { fout: { status: 404, error: 'Deze hulpvraag bestaat niet.' } };
    const w = wieIn(req, staat);
    const g = poortIn(w, c.stad, 'casus.beheren', 'individual_cases', staat);
    return g.ok ? { c, w } : { fout: g };
  }
  const kantoordeur = (req, id) => kantoordeurIn(req, id, S());

  // De stappen die over de hulpvrager gaan. 'notitie' is werkaantekening en
  // blijft binnen; de rest is wat er met en voor hem is gedaan.
  const OPEN_STAPPEN = ['contact', 'hulpactie', 'doorverwijzing', 'nazorg'];

  // De status in gewone taal. Een keten-woord als "in_uitvoering" zegt een
  // organisatie iets en een mens niets.
  const UITLEG = {
    ontvangen: 'Uw vraag is binnen. Er kijkt iemand naar.',
    intake: 'We zijn met u in gesprek over wat er nodig is.',
    toestemming: 'We hebben vastgelegd waar u toestemming voor geeft.',
    gekoppeld: 'Een lokale organisatie pakt uw vraag op.',
    in_uitvoering: 'Er wordt aan gewerkt.',
    afgerond: 'Dit is afgerond.',
    nazorg: 'Afgerond; we nemen nog een keer contact op om te horen hoe het gaat.',
    afgewezen: 'We konden deze vraag niet oppakken. U hoort van ons waarom.'
  };

  function beeld(c, inStaat) {
    const staat = inStaat || S();
    const stad = stadVanIn(c.stad, staat) || {};
    const partner = c.partnerId ? (staat.partners || []).find(p => p.id === c.partnerId) : null;
    return {
      codenaam: c.codenaam, stad: stad.naam || null, soort: c.soort, vraag: c.vraag,
      status: c.status, uitleg: UITLEG[c.status] || 'Uw vraag staat bij ons in behandeling.',
      // de ORGANISATIE die helpt mag hij weten; de mensen erbinnen niet
      partner: partner ? partner.naam : null,
      toestemming: c.toestemming ? { tekst: c.toestemming.tekst, at: c.toestemming.at } : null,
      ingetrokken: c.ingetrokken ? { at: c.ingetrokken.at } : null,
      stappen: (c.stappen || []).filter(s => OPEN_STAPPEN.includes(s.soort))
        .slice(0, 30).map(s => ({ soort: s.soort, tekst: s.tekst, at: s.at })),
      bewaarTot: c.bewaarTot || null
    };
  }

  function portaal(c) {
    return volg(vindCode(c, SCOPE.lezen), deur => deur.fout
      ? deur.fout : { ok: true, hulpvraag: beeld(deur.rij, deur.staat) });
  }

  /* Toestemming intrekken, door de hulpvrager zelf. Dit is dezelfde handeling
     als in casus-keten.js en loopt via dezelfde functie -- niet via een kopie
     met eigen regels (LAT.md regel 4). Het verschil is alleen wie hem in gang
     zet, en dat komt in het auditspoor te staan. */
  function trekIn(c, reden) {
    return metCode(c, SCOPE.intrekken, (staat, rij) => {
      const r = toestemmingWegDirect(rij, 'deelnemer', schoon(reden, 300), staat);
    /* HIER STOND DEZELFDE CONTROLE NOG EEN KEER ("is er wel toestemming?"), en
       dat was precies een controle te veel: een mutatie die hem weghaalde liet
       geen enkele toets zakken, want de gedeelde functie deed hem ook (LAT.md
       regel 2, uitkomst AFGESLAGEN -- en regel 4, twee plekken met dezelfde
       waarheid). Nu beslist de gedeelde functie, en vertaalt dit portaal alleen
       de zin naar de taal van de hulpvrager: hij leest geen dossiertaal. */
      if (!r.ok) {
        return r.status === 400
          ? { status: 400, error: 'Er staat op dit moment geen toestemming van u vastgelegd. Er wordt dus niets met uw gegevens gedeeld.' }
          : r;
      }
      return { ok: true, hulpvraag: beeld(rij, staat),
        melding: 'Uw toestemming is ingetrokken. Wat er al is gedaan blijft in het dossier staan -- dat wissen zou het ' +
          'onbetrouwbaar maken, ook voor u -- maar er gaat niets meer naar een partner en het werk gaat niet verder. ' +
          'Wilt u het later toch weer, dan kan dat; neem daarvoor contact op met de afdeling.' };
    });
  }

  /* Kantoorkant: uitgifte is een apart, herleidbaar besluit. */
  function codeVoor(req, id, b) {
    const vooraf = kantoordeur(req, id);
    if (vooraf.fout) return vooraf.fout;
    if (vooraf.c.persoonscode_id) {
      return { status: 409, error: 'Er is al een uitgegeven code. Gebruik roteren om een nieuwe code uit te geven en de oude direct te sluiten.' };
    }
    return codelevenscyclus.transactie(tx => {
      const staat = tx.staat || S();
      /* Autoriteit opnieuw uit de vergrendelde tx-staat, nooit uit precheck. */
      const d = kantoordeurIn(req, id, staat);
      if (d.fout) return d.fout;
      const c = d.c;
      if (c.persoonscode_id) return { status: 409, error: 'Er is intussen al een code uitgegeven. Roteer die code.' };
      delete c.code;
      const r = tx.uitgeven(invoer(d.w, c, b));
      if (!r.ok) return r;
      c.persoonscode_id = r.toegang.id;
      audit(d.w.key, 'casus.code-uitgegeven', c.codenaam,
        'rotatie 1; vervalt ' + r.toegang.expires_at, staat);
      return { ok: true, code: r.code, toegang: r.toegang,
        melding: 'Geef deze code persoonlijk. Ermee ziet iemand de stand van deze ene hulpvraag ' +
          'en kan hij zijn toestemming intrekken. Er staan geen contactgegevens achter.' };
    });
  }

  function codeIntrekken(req, id, reden) {
    const vooraf = kantoordeur(req, id);
    if (vooraf.fout) return vooraf.fout;
    return codelevenscyclus.transactie(tx => {
      const staat = tx.staat || S();
      const d = kantoordeurIn(req, id, staat);
      if (d.fout) return d.fout;
      const c = d.c;
      let toegang = null;
      if (c.persoonscode_id) {
        const r = tx.intrekken(c.persoonscode_id, d.w.key, reden);
        if (!r.ok) return r;
        toegang = r.toegang;
      }
      delete c.code;
      audit(d.w.key, 'casus.code-ingetrokken', c.codenaam, String(reden || 'geen reden'), staat);
      return { ok: true, ingetrokken: true, toegang };
    });
  }

  function codeRoteren(req, id, b) {
    const vooraf = kantoordeur(req, id);
    if (vooraf.fout) return vooraf.fout;
    return codelevenscyclus.transactie(tx => {
      const staat = tx.staat || S();
      const d = kantoordeurIn(req, id, staat);
      if (d.fout) return d.fout;
      const c = d.c;
      const r = c.persoonscode_id
        ? tx.roteer(c.persoonscode_id, Object.assign({ prefix: 'RTFD', issuer: d.w.key,
          reden: b && b.reden }, opties(b)))
        : tx.uitgeven(invoer(d.w, c, b));
      if (!r.ok) return r;
      delete c.code;
      c.persoonscode_id = r.toegang.id;
      audit(d.w.key, 'casus.code-geroteerd', c.codenaam, 'rotatie ' + r.toegang.rotatie, staat);
      return { ok: true, code: r.code, toegang: r.toegang,
        melding: 'De vorige code is direct gesloten. Geef deze nieuwe code persoonlijk.' };
    });
  }

  return { portaal, trekIn, codeVoor, codeIntrekken, codeRoteren,
    vindCode, beeld, OPEN_STAPPEN, UITLEG, SCOPE };
};
module.exports.OPEN_STAPPEN = ['contact', 'hulpactie', 'doorverwijzing', 'nazorg'];
