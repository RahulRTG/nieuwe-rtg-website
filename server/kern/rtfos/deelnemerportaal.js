/* Foundation OS, deel "deelnemerportaal": de mens met de hulpvraag.

   DIT IS HET GEVOELIGSTE SCHERM VAN HET HELE SYSTEEM, en het bestaat om een
   reden die weinig met techniek te maken heeft: wie hulp vraagt, raakt de regie
   kwijt. Er wordt over hem gepraat, een dossier aangelegd, een partner
   gekoppeld -- en hij hoort er niets meer van tot er iemand belt. Dit portaal
   geeft twee dingen terug: WETEN waar het staat, en NEE kunnen zeggen.

   DE TWEE KNOPPEN DIE ERTOE DOEN:

   1. WAAR STAAT HET. De status in gewone taal, en wat er is gedaan. Niet de
      interne notities -- die zijn werkaantekeningen van hulpverleners en lezen
      voor de betrokkene vaak als een oordeel dat niet zo bedoeld was. Wel de
      stappen die OVER HEM gaan: contact, hulpactie, doorverwijzing, nazorg.

   2. TOESTEMMING INTREKKEN. Wie ja zei, mag nee zeggen, en dan stopt het bij de
      eerstvolgende stap die toestemming nodig heeft (casus-keten.js). Dat is
      geen theoretisch recht: het staat hier als knop, want een recht waarvoor
      je moet bellen naar de organisatie die je juist wilde stoppen, is geen
      recht maar een drempel.

   WAT ER NIET IN STAAT, EN WAAROM:
   - GEEN CONTACTGEGEVENS, ook niet die van hemzelf. De code is de sleutel en
     een code wordt meegelezen op een balie, een gedeelde telefoon, een laptop
     van de bibliotheek. Zijn eigen nummer weet hij; het tonen levert hem niets
     en een meelezer alles.
   - GEEN NAMEN VAN HULPVERLENERS. Wie eraan werkt is voor de organisatie; een
     naam in een dossier van iemand die boos is, is een naam die thuis wordt
     opgezocht.
   - GEEN ANDERE DOSSIERS. De code opent er precies een.

   DE CODE VERVALT MET HET DOSSIER. Is de casus afgerond en de bewaartermijn
   voorbij, dan is er niets meer om te tonen -- en dat is het antwoord, niet een
   fout. */

module.exports = (ctx, eigen) => {
  const { nu, schoon, code, S, audit, wie, poort, save } = ctx;
  const { toestemmingWegDirect } = eigen;

  const vindCode = c => S().casussen.find(x => x.code === String(c || '').trim().toUpperCase()) || null;

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

  function beeld(c) {
    const stad = ctx.stadVan(c.stad) || {};
    const partner = c.partnerId ? S().partners.find(p => p.id === c.partnerId) : null;
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
    const rij = vindCode(c);
    if (!rij) return { status: 404, error: 'Deze code kennen we niet. Vraag er een nieuwe aan bij de RTF-afdeling in uw stad.' };
    return { ok: true, hulpvraag: beeld(rij) };
  }

  /* Toestemming intrekken, door de hulpvrager zelf. Dit is dezelfde handeling
     als in casus-keten.js en loopt via dezelfde functie -- niet via een kopie
     met eigen regels (LAT.md regel 4). Het verschil is alleen wie hem in gang
     zet, en dat komt in het auditspoor te staan. */
  function trekIn(c, reden) {
    const rij = vindCode(c);
    if (!rij) return { status: 404, error: 'Deze code kennen we niet.' };
    const r = toestemmingWegDirect(rij, 'deelnemer', schoon(reden, 300));
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
    return { ok: true, hulpvraag: beeld(rij),
      melding: 'Uw toestemming is ingetrokken. Wat er al is gedaan blijft in het dossier staan -- dat wissen zou het ' +
        'onbetrouwbaar maken, ook voor u -- maar er gaat niets meer naar een partner en het werk gaat niet verder. ' +
        'Wilt u het later toch weer, dan kan dat; neem daarvoor contact op met de afdeling.' };
  }

  /* ---------- de kantoorkant: de code uitgeven ----------
     Bewust een aparte handeling met een auditregel: een code uitgeven betekent
     dat iemand van buiten in een dossier kan kijken, en dat hoort een besluit
     te zijn en geen bijvangst van het aanmaken. */
  function codeVoor(req, id) {
    const c = S().casussen.find(x => x.id === String(id || ''));
    if (!c) return { status: 404, error: 'Deze hulpvraag bestaat niet.' };
    const w = wie(req);
    const g = poort(w, c.stad, 'casus.beheren', 'individual_cases');
    if (!g.ok) return g;
    if (!c.code) { c.code = code('RTFD'); save(); }
    audit(w.key, 'casus.code', c.codenaam, 'deelnemerscode getoond');
    return { ok: true, code: c.code,
      melding: 'Geef deze code persoonlijk. Ermee ziet iemand de stand van deze ene hulpvraag ' +
        'en kan hij zijn toestemming intrekken. Er staan geen contactgegevens achter.' };
  }

  return { portaal, trekIn, codeVoor, vindCode, beeld, OPEN_STAPPEN, UITLEG };
};
module.exports.OPEN_STAPPEN = ['contact', 'hulpactie', 'doorverwijzing', 'nazorg'];
