/* Leren-schrijven: schrijfopdrachten per leeftijdsgroep en de vriendelijke
   AI-feedback op een inzending. Krijgt de gedeelde context een keer bij het
   opstarten vanuit kern/leren.js. */
module.exports = (ctx) => {
  const { db, save, crypto, codenaamVan, zijnVrienden, socialZoek, isGeblokkeerd, sociaalRate, sseToCustomer, anthropic, leeftijdInstr,
    rid, nu, schoon, L, schud, opruimen, seintje, norm } = ctx;
  const OPDRACHTEN = {
    mini: ['Vertel samen met papa, mama of je verzorger een verhaaltje over jullie huisdier (of het huisdier dat je zou willen). De grote schrijft, jij verzint.',
      'Verzin samen een liedje over je lievelingseten en schrijf de woorden op.'],
    kind: ['Schrijf een verhaaltje over een dier dat een dag kan praten. Wat zegt het als eerste?',
      'Je vindt een deur in je school die er gisteren nog niet was. Schrijf op wat erachter zit.',
      'Schrijf een brief aan jezelf over tien jaar. Wat wil je later kunnen?',
      'Verzin een nieuw feest voor jouw familie en beschrijf hoe jullie het vieren.',
      'Schrijf een verhaaltje waarin je huisdier (of knuffel) een geheim heeft.',
      'Beschrijf je perfecte dag van wakker worden tot slapen gaan.'],
    tiener: ['Schrijf een kort verhaal dat begint met: "De telefoon ging precies om middernacht."',
      'Overtuig iemand in een brief van iets waar jij echt in gelooft.',
      'Beschrijf een plek waar jij helemaal jezelf bent, zo dat de lezer er ook wil zijn.',
      'Schrijf het verhaal van een dag uit het leven van je schoen.',
      'Interview (op papier) je held: bedenk vijf vragen en de antwoorden.',
      'Schrijf een recensie over de beste of slechtste film die je ooit zag.'],
    jong: ['Schrijf een motivatiebrief voor je droombaan, alsof je hem morgen verstuurt.',
      'Beschrijf het moment waarop je iets voor het eerst alleen deed.',
      'Schrijf een betoog: moet iedereen een jaar tussenjaar nemen? Kies een kant.',
      'Schrijf een brief aan je zestienjarige zelf.',
      'Beschrijf jouw ideale woonplek over vijf jaar, en wat ervoor nodig is.'],
    volw: ['Schrijf op wat je een jonger gezinslid over geld zou willen leren, in gewone taal.',
      'Beschrijf een familietraditie die je wilt doorgeven, en waarom.',
      'Schrijf een brief aan iemand die je lang niet gesproken hebt (versturen hoeft niet).',
      'Beschrijf de dag die je opnieuw zou willen beleven.']
  };
  function schrijfOpdracht(groep, anders) {
    const lijst = OPDRACHTEN[groep] || OPDRACHTEN.kind;
    const dag = Math.floor(Date.now() / 86400000);
    const i = anders ? crypto.randomInt(0, lijst.length) : dag % lijst.length;
    return { status: 200, opdracht: lijst[i] };
  }
  async function schrijfFeedback(mij, { tekst, opdracht, groep, buddy }) {
    tekst = String(tekst || '').slice(0, 6000);
    if (norm(tekst).length < 20) return { status: 400, error: 'Schrijf eerst een stukje; dan lees ik mee.' };
    if (!sociaalRate(mij, 'leren-ai', 30, 3600000)) return { status: 429, error: 'Rustig aan; probeer het over een uurtje weer.' };
    const NAAM = { vrouw: 'Amber', man: 'Fayaz', nonbinair: 'Robin' };
    const naam = NAAM[buddy] || 'Amber';
    if (anthropic) {
      try {
        const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 450,
          system: 'Je heet ' + naam + ' en bent een warme schrijfcoach. Geef eerst een oprecht compliment over iets specifieks, daarna hooguit twee concrete tips. Herschrijf NOOIT de tekst; de schrijver blijft de schrijver. ' + (leeftijdInstr ? leeftijdInstr(groep) : ''),
          messages: [{ role: 'user', content: (opdracht ? 'De opdracht was: ' + schoon(opdracht, 200) + '\n\n' : '') + 'Mijn tekst:\n' + tekst }] });
        const uit = (r.content || []).map(b => b.text || '').join('').trim();
        if (uit) return { status: 200, feedback: uit };
      } catch (e) { /* val terug op de demofeedback */ }
    }
    // demoterugval: een compliment plus eenvoudige, eerlijke tips uit de tekst zelf
    const zinnen = tekst.split(/[.!?]+/).map(z => z.trim()).filter(Boolean);
    const woorden = tekst.split(/\s+/).filter(Boolean);
    const tips = [];
    if (zinnen.some(z => z.split(/\s+/).length > 25)) tips.push('Een paar zinnen zijn heel lang; knip de langste eens in tweeen, dan leest het lekkerder.');
    if (/(^|[.!?]\s+)[a-z]/.test(tekst)) tips.push('Kijk nog even naar de hoofdletters aan het begin van je zinnen.');
    if ((tekst.match(/\ben\b/gi) || []).length > woorden.length / 12) tips.push('Je gebruikt vaak "en"; probeer eens een zin te beginnen met "daarna", "opeens" of "toen".');
    if (tips.length < 2) tips.push('Lees je tekst een keer hardop; waar je struikelt, kan een zin mooier.');
    return { status: 200, demo: true, feedback: 'Wat goed dat je ' + woorden.length + ' woorden hebt geschreven, en je ' +
      (zinnen.length > 4 ? 'bouwt je verhaal echt op in ' + zinnen.length + ' zinnen' : 'begin staat er al') + '. ' +
      'Twee dingen om naar te kijken: ' + tips.slice(0, 2).join(' ') + ' - ' + naam };
  }
  function schrijfBewaar(mij, { opdracht, tekst, feedback }) {
    tekst = String(tekst || '').slice(0, 6000);
    if (!tekst.trim()) return { status: 400, error: 'Er is nog niets om te bewaren.' };
    const s = L().schrijfsels;
    if (!s[mij]) s[mij] = [];
    s[mij].unshift({ id: rid(4), opdracht: schoon(opdracht, 200), tekst, feedback: String(feedback || '').slice(0, 1500), at: nu() });
    s[mij] = s[mij].slice(0, 20);
    save();
    return { status: 200, ok: true };
  }
  function schrijfselsVan(mij) { return { status: 200, schrijfsels: L().schrijfsels[mij] || [] }; }
  return { schrijfOpdracht, schrijfFeedback, schrijfBewaar, schrijfselsVan };
};
