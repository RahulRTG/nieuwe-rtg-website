/* Rahul Bijles: iedere leerling -- kind of volwassene -- een EIGEN, geduldige
   bijles-AI met geheugen, die op precies het goede niveau werkt en positief
   laat leren. Drie vaste regels, ook in de system-prompt:
   1. begrijpen boven voorzeggen: stap voor stap, eerst een hint, de laatste
      stap zet de leerling zelf;
   2. geen druk: geen scores, geen ranglijsten, nooit vergelijken met anderen;
      inzet telt en fouten zijn leermateriaal;
   3. eerlijk: Rahul is geen school of examenbureau en zegt dat ook.
   Zonder geschikte modelprovider een vast, net zo geduldig regelantwoord. De
   provider komt uit de centrale local-first keten; deze module kent geen merk,
   sleutel of netwerkadres. */

const MAX_BEURTEN = 40;

function systeem(naam, niveau, doelen, taal) {
  return 'Je bent Rahul, de eigen bijles-AI van ' + (naam || 'deze leerling') + '. ' +
    'Niveau van dit moment: ' + (niveau || 'nog onbekend; vraag er rustig naar') + '. ' +
    (taal ? 'De thuistaal van de leerling is "' + taal + '". Antwoord TWEETALIG: eerst in de thuistaal, ' +
      'daarna dezelfde uitleg in eenvoudig Nederlands -- dat is de taal die de leerling erbij leert. ' : '') +
    (doelen && doelen.length ? 'Er wordt gewerkt aan: ' + doelen.slice(0, 5).join(', ') + '. ' : '') +
    'Werk precies op dit niveau: niet te makkelijk, niet te moeilijk. Wees warm en geduldig, ' +
    'leg stap voor stap uit, geef eerst een hint en laat de leerling de laatste stap zelf zetten. ' +
    'Positief leren: benoem wat al goed gaat, behandel fouten als leermateriaal en vergelijk nooit met anderen. ' +
    'Geen scores, geen ranglijsten, geen druk. Schrijf kort en helder Nederlands (max ~110 woorden). ' +
    'Wees eerlijk: je bent geen school of examenbureau; echte diploma’s en examens lopen via de officiële instellingen.';
}

function demoAntwoord(niveau, taal) {
  return 'Fijn dat je het vraagt; dat is precies hoe leren werkt. We pakken dit samen op, stap voor stap' +
    (niveau ? ', op jouw niveau (' + niveau + ')' : '') +
    '. Vertel eerst wat je al weet en waar het precies stokt; dan geef ik je een hint, en de laatste stap zet jij zelf. ' +
    'Elke poging telt, ook de mislukte: daar leer je het meest van.' +
    (taal ? ' En omdat jouw thuistaal (' + taal + ') meedoet: ik leg het uit in je eigen taal en zet er het Nederlands naast, zo leer je beide talen tegelijk.' : '');
}

/* winkel() geeft de opslagmap (per wereld een eigen: leden of gezinnen);
   de motor bewaart daarin per sleutel een gesprek van hooguit MAX_BEURTEN. */
function maakBijles({ winkel, save, schoon, anthropic }) {
  function gesprekVan(sleutel) {
    const w = winkel();
    if (!w[sleutel]) w[sleutel] = { beurten: [], at: null };
    return w[sleutel];
  }

  async function vraag({ sleutel, naam, niveau, doelen, taal, tekst }) {
    const t = schoon(tekst, 600);
    if (!t) return { error: 'Stel eerst je vraag.', status: 400 };
    const g = gesprekVan(sleutel);
    g.beurten.push({ rol: 'user', tekst: t, at: new Date().toISOString() });
    let uit;
    if (anthropic) {
      try {
        const msgs = g.beurten.slice(-13);
        while (msgs.length && msgs[0].rol !== 'user') msgs.shift();
        const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 400,
          system: systeem(naam, niveau, doelen, taal),
          messages: msgs.map(b => ({ role: b.rol === 'user' ? 'user' : 'assistant', content: b.tekst })) });
        uit = { text: (r.content || []).map(b => b.text || '').join('').trim() || demoAntwoord(niveau, taal) };
      } catch (e) { uit = { text: demoAntwoord(niveau, taal), demo: true }; }
    } else {
      uit = { text: demoAntwoord(niveau, taal), demo: true };
    }
    g.beurten.push({ rol: 'rahul', tekst: uit.text, at: new Date().toISOString() });
    if (g.beurten.length > MAX_BEURTEN) g.beurten.splice(0, g.beurten.length - MAX_BEURTEN);
    g.at = new Date().toISOString();
    save();
    return Object.assign({ ok: true, niveau: niveau || null }, uit);
  }

  const gesprek = (sleutel) => ({ ok: true, beurten: gesprekVan(sleutel).beurten.slice(-30) });

  return { vraag, gesprek };
}

module.exports = { maakBijles };
