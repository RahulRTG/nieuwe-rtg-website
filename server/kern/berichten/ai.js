/* De drie AI-taken van de Berichten-app: een gesprek samenvatten, een antwoord
   opstellen, en de afspraken eruit halen.

   Twee regels sturen dit bestand:
   1. De AI STELT OP, hij VERSTUURT NOOIT. Een concept komt terug als tekst; er
      gaat pas iets weg als de mens op versturen tikt. Dat is dezelfde drempel
      als bij geld.
   2. Geen AI? Dan een eerlijke melding, geen verzonnen inhoud. tekst() geeft
      null bij een lege of onbereikbare uitwijkketen, en dat wordt hier een
      nette 503 in plaats van een nepsamenvatting.

   De draad komt van buiten binnen (kern/berichten/index.js): alleen de laatste
   berichten, op codenaam, zonder enige verwijzing naar wie iemand echt is. Dat
   is het enige wat het model van een gesprek ziet. */
const { tekst } = require('../../ai');

const TOON = 'Je bent Rahul, de assistent van Rahul Travel Group. Schrijf rustig, ' +
  'zeker en zonder opsmuk. Nooit uitroeptekens, nooit overdrijven. Antwoord in het Nederlands.';
const geenAI = { ok: false, reden: 'De AI is nu niet bereikbaar. Probeer het zo nog eens.' };
// De agenda (kern/agenda.js) weigert alles wat geen geldige datum is; hier
// filteren we daarom hard op vorm in plaats van te hopen dat het model het goed doet.
const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const TIJD = /^\d{2}:\d{2}$/;

module.exports = ({ draad, anthropic }) => {
  const geenDraad = { ok: false, reden: 'Dit gesprek kan ik niet lezen.' };

  async function samenvat(mij, id) {
    const d = draad(mij, id);
    if (!d) return geenDraad;
    const t = await tekst(anthropic, TOON + ' Vat het gesprek samen in maximaal vijf korte zinnen: ' +
      'waar ging het over, wat is besloten, en wat ligt er nog open.', d.regels.join('\n'), { max: 350 });
    return t ? { ok: true, titel: d.titel, samenvatting: t } : geenAI;
  }

  /* Een CONCEPT-antwoord. Komt terug als tekst en gaat nergens heen: de mens
     leest het, past het aan en drukt zelf op versturen. */
  async function concept(mij, id, wens) {
    const d = draad(mij, id);
    if (!d) return geenDraad;
    const opdracht = String(wens || '').slice(0, 300).trim();
    const t = await tekst(anthropic, TOON + ' Schrijf EEN antwoord dat ik als "Ik" kan versturen. ' +
      'Alleen de berichttekst, geen aanhef van jou, geen uitleg eromheen, hooguit vier zinnen.',
    d.regels.join('\n') + (opdracht ? '\n\nWat ik ongeveer wil zeggen: ' + opdracht : ''), { max: 300 });
    return t ? { ok: true, concept: t } : geenAI;
  }

  /* Wat is er eigenlijk afgesproken? De AI krijgt de datum van vandaag mee
     (anders kan hij "morgen" niet uitrekenen) en levert datum en tijd LOS aan.
     Wat niet aan de vorm voldoet, gaat eruit: dan komt de afspraak zonder datum
     in beeld en biedt de app geen agendaknop. Liever geen knop dan een knop die
     op een gegokte datum stukloopt. */
  async function afspraken(mij, id) {
    const d = draad(mij, id);
    if (!d) return geenDraad;
    const vandaag = new Date().toISOString().slice(0, 10);
    const t = await tekst(anthropic, TOON + ' Haal uit het gesprek de concrete afspraken en toezeggingen. ' +
      'Vandaag is ' + vandaag + '. Geef ELKE afspraak op een eigen regel als JSON: ' +
      '{"wat":"...","datum":"JJJJ-MM-DD","tijd":"UU:MM","wie":"ik|de ander"}. ' +
      'Weet je de datum of tijd niet zeker, laat het veld dan LEEG -- nooit gokken. ' +
      'Geen tekst eromheen. Is er niets afgesproken, geef dan niets.',
    d.regels.join('\n'), { max: 500 });
    if (t === null) return geenAI;
    const lijst = [];
    for (const regel of t.split('\n')) {
      const r = regel.trim();
      if (!r.startsWith('{')) continue;
      try {
        const o = JSON.parse(r);
        if (!o || !o.wat) continue;
        lijst.push({ wat: String(o.wat).slice(0, 200),
          datum: DATUM.test(o.datum || '') ? o.datum : '',
          tijd: TIJD.test(o.tijd || '') ? o.tijd : '',
          wie: o.wie === 'ik' ? 'ik' : 'de ander' });
      } catch (e) { /* onleesbare regel: overslaan, niet raden */ }
    }
    return { ok: true, titel: d.titel, afspraken: lijst.slice(0, 20) };
  }

  return { samenvat, concept, afspraken };
};
