/* Métier (deelmodule): Rahul als loopbaancoach. Drie taken, en alle drie volgen
   dezelfde regel als in Berichten en De Salon: de AI stelt voor, de mens
   beslist en verstuurt.

   1. profielKritiek -- Rahul kijkt naar je profiel zoals een werkgever ernaar
      kijkt en zegt eerlijk wat er ontbreekt. Hij vult NIETS zelf in.
   2. brief -- een sollicitatiebrief bij een vacature, in jouw woorden en met
      jouw echte ervaring als grond. Komt terug als tekst; jij verstuurt.
   3. oefengesprek -- Rahul stelt de vragen die een werkgever zou stellen, een
      voor een. Oefenen zonder dat het meekijkt of meetelt.

   Twee dingen die hij nooit doet, en dat staat ook in de opdracht aan het model:
   - hij verzint geen ervaring die niet op het profiel staat (dat zou het lid de
     dag van het gesprek in de problemen brengen);
   - hij belooft nooit toegang tot de Lifestyle of Business Pass, en niet aan een
     baan. Dat is mensenwerk, altijd. */
const { tekst } = require('../../ai');

const TOON = 'Je bent Rahul, de assistent van Rahul Travel Group. Je helpt een lid met zijn ' +
  'beroepsprofiel en sollicitaties. Schrijf rustig, zeker en zonder opsmuk. Geen uitroeptekens, ' +
  'geen verkooppraat, geen vleierij. Antwoord in het Nederlands. ' +
  'Verzin NOOIT ervaring, opleidingen of vaardigheden die niet in de aangeleverde gegevens staan: ' +
  'een lid dat met een verzonnen regel bij een werkgever zit, is slechter af dan met een lege regel. ' +
  'Beloof nooit een baan, en nooit toegang tot een pas of lidmaatschap.';
const geenAI = { ok: false, reden: 'De AI is nu niet bereikbaar. Probeer het zo nog eens.' };

module.exports = ({ anthropic, metier, netwerk }) => {

  const profielTekst = (key) => {
    const p = metier.profielVan(key);
    const bewezen = metier.bewezenRollen(key);
    const regels = [
      'Beroepskop: ' + (p.kop || '(leeg)'),
      'Over: ' + (p.over || '(leeg)'),
      'Plaats: ' + (p.plaats || '(leeg)'),
      'Open voor werk: ' + (p.open ? 'ja' : 'nee'),
      'Vaardigheden: ' + ((p.vaardigheden || []).join(', ') || '(geen)'),
      'Talen: ' + ((p.talen || []).join(', ') || '(geen)'),
      'Door RTG bevestigde rollen: ' + (bewezen.length
        ? bewezen.map(r => r.wat + ' bij ' + r.waar + (r.sinds ? ' sinds ' + String(r.sinds).slice(0, 10) : '')).join('; ')
        : '(geen)'),
      'Zelf opgegeven rollen: ' + ((p.rollen || []).length
        ? (p.rollen || []).map(r => r.wat + ' bij ' + r.waar + (r.van ? ' (' + r.van + (r.tot ? '-' + r.tot : '-nu') + ')' : '')).join('; ')
        : '(geen)')
    ];
    return regels.join('\n');
  };

  /* Wat ziet een werkgever, en wat mist hij? Bewust kritisch: een coach die
     alles goed vindt is geen coach. Maar wel over wat er STAAT, niet over de
     persoon. */
  async function profielKritiek(sess) {
    const p = metier.profielVan(sess.key);
    if (!p.kop && !(p.rollen || []).length && !metier.bewezenRollen(sess.key).length) {
      return { ok: true, kritiek: 'Je profiel is nog leeg. Begin met een beroepskop van een regel, en zet erbij wat je nu doet. De rollen die je binnen RTG hebt gewerkt staan er straks automatisch bij, met de bevestiging van RTG erbij.' };
    }
    const t = await tekst(anthropic, TOON + ' Kijk naar dit beroepsprofiel zoals een werkgever ernaar kijkt. ' +
      'Noem in maximaal zes korte punten wat sterk is en wat ontbreekt of vaag blijft. Wees concreet en eerlijk. ' +
      'Vul niets in en schrijf geen nieuwe profieltekst; benoem alleen wat het lid zelf zou moeten aanvullen.',
    profielTekst(sess.key), { max: 500 });
    return t ? { ok: true, kritiek: t } : geenAI;
  }

  /* Een sollicitatiebrief bij een vacature. De grond is het eigen profiel; wat
     er niet staat, komt er niet in. */
  async function brief(sess, vacature) {
    const v = String(vacature || '').slice(0, 800).trim();
    if (!v) return { ok: false, reden: 'Op welke vacature wil je reageren? Plak de tekst of beschrijf hem kort.' };
    const t = await tekst(anthropic, TOON + ' Schrijf een sollicitatiebrief van maximaal 200 woorden. ' +
      'Gebruik ALLEEN de ervaring uit het profiel hieronder. Noem de codenaam niet en zet er geen naam onder: ' +
      'het lid ondertekent zelf. Sluit af zonder loze beloften.',
    'De vacature:\n' + v + '\n\nHet profiel van het lid:\n' + profielTekst(sess.key), { max: 700 });
    return t ? { ok: true, brief: t } : geenAI;
  }

  /* Oefenen. Rahul stelt EEN vraag per keer en geeft daarna korte feedback op je
     antwoord. Er wordt niets van bewaard en niets van gedeeld: dit is een
     oefenruimte, geen dossier. */
  async function oefengesprek(sess, invoer) {
    const i = invoer || {};
    const rol = String(i.rol || '').slice(0, 120).trim();
    const antwoord = String(i.antwoord || '').slice(0, 1200).trim();
    const vraag = String(i.vraag || '').slice(0, 300).trim();
    if (!rol) return { ok: false, reden: 'Voor welke functie wil je oefenen?' };

    if (!antwoord) {
      const t = await tekst(anthropic, TOON + ' Je oefent een sollicitatiegesprek. Stel EEN eerste vraag ' +
        'die een werkgever voor deze functie echt zou stellen. Alleen de vraag, niets erbij.',
      'Functie: ' + rol + '\n\nHet profiel van het lid:\n' + profielTekst(sess.key), { max: 150 });
      return t ? { ok: true, vraag: t } : geenAI;
    }
    const t = await tekst(anthropic, TOON + ' Je oefent een sollicitatiegesprek. Geef in maximaal drie zinnen ' +
      'feedback op het antwoord: wat werkte, en wat zou je scherper zeggen. Stel daarna EEN volgende vraag. ' +
      'Zet de feedback en de vraag op aparte regels, met de vraag als laatste regel.',
    'Functie: ' + rol + '\nDe vraag was: ' + (vraag || '(onbekend)') + '\nHet antwoord van het lid: ' + antwoord,
    { max: 400 });
    if (!t) return geenAI;
    const regels = t.split('\n').map(r => r.trim()).filter(Boolean);
    return { ok: true, feedback: regels.slice(0, -1).join(' ') || t, vraag: regels.length > 1 ? regels[regels.length - 1] : null };
  }

  return { profielKritiek, brief, oefengesprek, profielTekst };
};
