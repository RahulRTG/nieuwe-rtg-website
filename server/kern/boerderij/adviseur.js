/* Boerderij (deelmodule): de vaste boerenkennis en de (AI-)adviseur met acties.
   Krijgt de gedeelde context een keer bij het opstarten vanuit kern/boerderij.js. */
module.exports = (ctx) => {
  const { db, save, crypto, findSupplier, anthropic, schoon,
    BTYPES, GEWASSEN, DIEREN,
    isBoer, ensure, voegAanVoorraad, seizoen, SEIZOEN_LABEL, id, nu, vandaag, scho, getal } = ctx;
  const { gewasFase, perceelPubliek, dierPubliek, briefing, stats, overzicht, zetProduct, productVan, markeerInSalon, kiesType, zetPerceel, zaaiPerceel, waterPerceel, oogstPerceel, zetDier, voerDier, opbrengstDier, zetTaak, rondTaak } = ctx;
  const KENNIS = [
    { w: /tomaat|tomaten/, a: 'Tomaten zaai je onder glas februari-april; uitplanten na de laatste nachtvorst. Gelijkmatig water, niet op het blad. Oogst na ongeveer 90 dagen.' },
    { w: /aardappel/, a: 'Pootaardappelen de grond in april-mei. Aanaarden als het loof 20 cm is. Oogsten als het loof afsterft, ongeveer 110 dagen na poten.' },
    { w: /mais|maïs/, a: 'Mais zaai je bij een bodemtemperatuur boven 10 graden (april-mei). Oogst als de kolven vol zijn, ongeveer 150 dagen.' },
    { w: /koe|melk|melkvee/, a: 'Een melkkoe geeft grofweg 25-30 liter per dag en eet ongeveer 22 kg voer. Twee keer per dag melken en voeren, en let op de conditie.' },
    { w: /kip|eieren|pluimvee/, a: 'Een legkip legt gemiddeld 5-6 eieren per week en eet ongeveer 130 gram voer per dag. Zorg voor vers water, licht en schone legnesten.' },
    { w: /water|beregen|droogte/, a: 'Beregen bij warm, droog weer bij voorkeur vroeg in de ochtend of tegen de avond, zodat er minder verdampt. Geef liever een keer flink dan elke dag een beetje.' },
    { w: /bemest|mest|stikstof/, a: 'Bemest op basis van een grondmonster. Deel de stikstofgift; te veel ineens spoelt uit. Bij biologisch werk je met vaste mest en groenbemesters.' },
    { w: /wijn|druif|druiven|wijngaard/, a: 'Druiven snoei je in de winter. Oogsten in de nazomer bij het juiste suikergehalte. Let op meeldauw bij vochtig weer.' }
  ];
  function samenvatting(s) {
    const b = ensure(s); const st = stats(b); const t = b.type ? BTYPES[b.type].label : 'nog niet gekozen';
    return 'Type: ' + t + '. Percelen: ' + st.percelen + ' (' + st.hectare + ' ha, ' + st.teOogsten + ' oogstklaar). Dieren: ' + st.dieren + ' in ' + st.dierGroepen + ' groepen. Open taken: ' + st.openTaken + '.';
  }
  // Ingebouwde opdrachtherkenning: laat de adviseur ook zonder Claude iets DOEN.
  function cannedActie(s, vraag) {
    const q = vraag.toLowerCase();
    let m;
    // "voeg perceel <naam> van <n> ha toe"
    m = q.match(/(?:voeg|maak|nieuw).*perceel\s+"?([a-z0-9 \-]{2,40}?)"?\s*(?:van\s+([\d.,]+)\s*ha)?(?:\s+toe|\s+aan)?$/);
    if (m) { const r = zetPerceel(s, { naam: m[1].trim(), ha: m[2] ? Number(m[2].replace(',', '.')) : 0 }); return r.error ? { antwoord: r.error } : { antwoord: 'Perceel "' + m[1].trim() + '" aangemaakt.' + (m[2] ? ' (' + m[2] + ' ha)' : ''), gedaan: true }; }
    // "zaai <gewas> op <perceelnaam>"
    m = q.match(/za(?:ai|aien|ien)\s+([a-z]+)\s+(?:op|in)\s+"?([a-z0-9 \-]{2,40}?)"?$/);
    if (m) {
      const gewasId = Object.keys(GEWASSEN).find(k => k === m[1] || GEWASSEN[k].label.toLowerCase() === m[1]);
      const b = ensure(s); const p = b.percelen.find(x => x.naam.toLowerCase() === m[2].trim());
      if (!gewasId) return { antwoord: 'Ik ken het gewas "' + m[1] + '" niet.' };
      if (!p) return { antwoord: 'Ik vind geen perceel "' + m[2].trim() + '".' };
      const r = zaaiPerceel(s, p.id, gewasId);
      return r.error ? { antwoord: r.error } : { antwoord: GEWASSEN[gewasId].label + ' gezaaid op ' + p.naam + '. Oogst verwacht rond ' + r.oogstVerwacht + '.', gedaan: true };
    }
    // "oogst <perceelnaam>"
    m = q.match(/oogst\s+(?:perceel\s+)?"?([a-z0-9 \-]{2,40}?)"?$/);
    if (m) { const b = ensure(s); const p = b.percelen.find(x => x.naam.toLowerCase() === m[1].trim()); if (!p) return { antwoord: 'Ik vind geen perceel "' + m[1].trim() + '".' }; const r = oogstPerceel(s, p.id); return r.error ? { antwoord: r.error } : { antwoord: p.naam + ' geoogst: ' + r.opbrengst + ' ' + r.eenheid + '.', gedaan: true }; }
    // "voeg <n> <dier> toe" / "zet <n> koeien"
    m = q.match(/(?:voeg|zet|koop)\s+(\d{1,7})\s+([a-z]+)/);
    if (m) {
      const soortId = Object.keys(DIEREN).find(k => k === m[2] || DIEREN[k].label.toLowerCase() === m[2] || m[2].startsWith(k.slice(0, 4)) || (m[2] === 'koeien' && k === 'melkkoe') || (m[2] === 'kippen' && k === 'legkip') || (m[2] === 'schapen' && k === 'schaap') || (m[2] === 'geiten' && k === 'geit') || (m[2] === 'varkens' && k === 'varken'));
      if (soortId) { const r = zetDier(s, { soort: soortId, aantal: Number(m[1]) }); return r.error ? { antwoord: r.error } : { antwoord: m[1] + ' ' + DIEREN[soortId].label.toLowerCase() + '(en) toegevoegd.', gedaan: true }; }
    }
    // "plan taak: <tekst>" / "herinner me aan <tekst>"
    m = q.match(/(?:plan|voeg|maak).*taak[:\s]+(.{3,120})$/) || q.match(/herinner\s+(?:me\s+)?(?:aan\s+)?(.{3,120})$/);
    if (m) { const r = zetTaak(s, { wat: m[1].trim() }); return r.error ? { antwoord: r.error } : { antwoord: 'Taak op het bord gezet: ' + m[1].trim(), gedaan: true }; }
    return null;
  }
  function cannedAntwoord(s, vraag) {
    const actie = cannedActie(s, vraag);
    if (actie) return actie;
    for (const k of KENNIS) if (k.w.test(vraag.toLowerCase())) return { antwoord: k.a };
    // val terug op een seizoenstip + de eigen situatie
    const br = briefing(s);
    const tip = br.punten.length ? br.punten[0].tekst : 'Alles ziet er rustig uit. ';
    return { antwoord: 'Ik denk met je mee (' + br.seizoenLabel + '). ' + tip + ' Vraag me gerust iets als "zaai tomaat op Kasblok 1", "voeg 20 melkkoeien toe" of "wanneer aardappels poten?".' };
  }
  async function advies(s, vraag, aiAan) {
    vraag = scho(vraag, 500);
    if (!vraag) return { antwoord: 'Stel je vraag of geef een opdracht.' };
    // Opdrachten (die iets DOEN) altijd zelf afhandelen, ook met Claude aan, zodat
    // de mutatie deterministisch en veilig blijft.
    const actie = cannedActie(s, vraag);
    if (actie) return actie;
    if (aiAan && anthropic) {
      try {
        const { RAHUL_LEAD } = require('./rahul');
        const sys = RAHUL_LEAD + 'je bent de ervaren, praktische bedrijfsadviseur van een boer op het RTG-platform. Antwoord kort, concreet en in het Nederlands. Hier is de huidige situatie: ' + samenvatting(s) + ' Geef bruikbaar advies over gewassen, dieren, planning en seizoen.';
        const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 400, system: sys, messages: [{ role: 'user', content: vraag }] });
        const tekst = (r && r.content && r.content[0] && r.content[0].text || '').trim();
        if (tekst) return { antwoord: tekst };
      } catch (e) { /* val terug op de kennisbank */ }
    }
    return cannedAntwoord(s, vraag);
  }

  return { advies };
};
