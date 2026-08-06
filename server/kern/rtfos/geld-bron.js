/* Foundation OS, deel "geld-bron": de twee bijzondere wegen van een bron.

   BRONNEN ONTSTAAN NORMAAL DOOR IEMAND DIE ZE INVOERT (geld.js: bronMaak). Hier
   staan de twee uitzonderingen, en het zijn allebei plekken waar een belofte
   aan iemand buiten de organisatie in het geding is:

   1. HERBESTEMMEN -- de enige weg waarlangs geoormerkt geld van bestemming
      verandert. Drie sloten, en ze doen alle drie iets anders:
        a. LANDELIJK. Een stad die zijn eigen oormerken kan losmaken, heeft geen
           oormerken maar een suggestie.
        b. DE BELOFTE AAN DE GEVER. Stond de bron op "nooit", dan houdt het hier
           op -- ook voor het landelijke bestuur. Dat is geen bevoegdheidsvraag
           maar een afspraak met iemand buiten de organisatie.
        c. WAT AL BESTEED IS, VERHUIST NIET. Alleen het vrije deel gaat mee; het
           besteedde deel blijft als afgesloten bron achter onder de OUDE
           bestemming, zodat de verantwoording daarover compleet blijft.

   2. DE BRON UIT EEN TOEGEKENDE SUBSIDIE (subsidies.js roept dit aan). Bewust
      geen tweede schrijfweg met eigen regels: hij schrijft in dezelfde lijst,
      in dezelfde vorm, en de poort is al gepasseerd bij het toekennen zelf. Wat
      hij anders doet is de herkomst vastleggen (`uitSubsidie`), zodat
      subsidiegeld nooit als losse donatie in de boeken belandt -- en de
      herbestemming staat er meteen op "met_toestemming", want dat is de
      voorwaarde waaronder het is gegeven.

   Afgesplitst uit geld.js op de 10 KB van keuringsregel 13. */

module.exports = (ctx, eigen) => {
  const { nu, rid, schoon, euro, S, audit, wie, save } = ctx;
  const { vindBron, bronBeeld } = eigen;

  /* Herbestemmen: de enige weg waarlangs geoormerkt geld van bestemming
     verandert. Drie sloten, en ze doen alle drie iets anders.

     1. LANDELIJK. Een stad die zijn eigen oormerken kan losmaken, heeft geen
        oormerken maar een suggestie.
     2. DE BELOFTE AAN DE GEVER. Stond de bron op "nooit", dan houdt het hier
        op -- ook voor het landelijke bestuur. Dat is geen bevoegdheidsvraag
        maar een afspraak met iemand buiten de organisatie.
     3. WAT AL BESTEED IS, VERHUIST NIET. Alleen het vrije deel kan mee; het
        besteedde deel is al verantwoord onder de oude bestemming. */
  function verplaats(req, bronId, naarProject, b) {
    b = b || {};
    const w = wie(req);
    const bron = vindBron(bronId);
    if (!bron) return { status: 404, error: 'Deze bron bestaat niet.' };
    if (!w.landelijk) return { status: 403, error: 'Geoormerkt geld herbestemmen doet uitsluitend het landelijke RTF-bestuur.' };
    if (bron.herbestemming === 'nooit') {
      return { status: 403, error: 'Deze gever heeft herbestemming uitgesloten. Dit geld gaat naar de afgesproken bestemming of terug naar de gever.' };
    }
    if (bron.herbestemming === 'met_toestemming' && b.toestemming !== true) {
      return { status: 400, error: 'Deze bron mag alleen verschuiven met toestemming van de gever. Leg die eerst vast (toestemming: true, met het bewijsstuk erbij).' };
    }
    const reden = schoon(b.reden, 300);
    if (reden.length < 5) return { status: 400, error: 'Waarom verschuift dit geld? Schrijf het op; het komt in het jaarverslag terug.' };
    const naar = naarProject ? String(naarProject) : null;
    if (naar) {
      const p = S().projecten.find(x => x.id === naar);
      if (!p) return { status: 404, error: 'Dat project bestaat niet.' };
      if (p.stad !== bron.stad) return { status: 400, error: 'Dit geld hoort bij een andere stad. Tussen steden verschuiven gaat via een nieuwe bron met de gever erbij.' };
    }
    const besteed = bron.besteed;
    if (besteed > 0) {
      // Het besteedde deel blijft achter als eigen, afgesloten bron: zo blijft
      // de verantwoording over de oude bestemming compleet.
      S().bronnen.push({ id: rid(), stad: bron.stad, projectId: bron.projectId, soort: bron.soort,
        gever: bron.gever, anoniem: bron.anoniem, centen: besteed, besteed,
        herbestemming: 'nooit', kenmerk: (bron.kenmerk || '') + ' (afgesloten deel)',
        door: w.key, at: nu() });
      bron.centen -= besteed;
      bron.besteed = 0;
    }
    const oud = bron.projectId;
    bron.projectId = naar;
    bron.herbestemd = { van: oud, naar, door: w.key, reden, at: nu() };
    audit(w.key, 'bron.herbestemd', bron.id, (oud || 'stadsbreed') + ' -> ' + (naar || 'stadsbreed') + ': ' + reden);
    save();
    return { ok: true, bron: bronBeeld(bron) };
  }

  /* De bron die uit een toegekende subsidie ontstaat. Zie de kop hierboven. */
  function bronUitSubsidie(b) {
    const bron = { id: rid(), stad: b.stad, projectId: b.projectId || null, soort: 'subsidie',
      gever: schoon(b.gever, 120) || 'subsidieverstrekker', anoniem: false,
      centen: Math.max(0, Math.round(Number(b.centen) || 0)), besteed: 0,
      herbestemming: 'met_toestemming', kenmerk: schoon(b.kenmerk, 60),
      uitSubsidie: true, door: b.door || null, at: nu() };
    S().bronnen.push(bron);
    audit(b.door, 'bron.uit-subsidie', bron.kenmerk, euro(bron.centen) + ' euro' +
      (bron.projectId ? ', geoormerkt voor project ' + bron.projectId : ', stadsbreed'));
    save();
    return bron;
  }

  return { verplaats, bronUitSubsidie };
};
