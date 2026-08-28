/* De drie taalhulpen van de Berichten-app: een gesprek samenvatten, een antwoord
   opstellen, en de afspraken eruit halen.

   Twee regels sturen dit bestand:
   1. De AI STELT OP, hij VERSTUURT NOOIT. Een concept komt terug als tekst; er
      gaat pas iets weg als de mens op versturen tikt. Dat is dezelfde drempel
      als bij geld.
   2. Selecteren, rekenen en herkenbare datums lezen gebeurt lokaal. Alleen een
      nieuw antwoord schrijven vraagt een model; zonder model volgt een 503.

   De draad komt van buiten binnen (kern/berichten/index.js): alleen de laatste
   berichten, op codenaam, zonder enige verwijzing naar wie iemand echt is. Dat
   is het enige wat het model van een gesprek ziet. */
const { tekst } = require('../../ai-kort');
const { samenvat: lokaalSamenvatten, zinnen } = require('../../lib/lokale-taal');

const TOON = 'Je bent Rahul, de assistent van Rahul Travel Group. Schrijf rustig, ' +
  'zeker en zonder opsmuk. Nooit uitroeptekens, nooit overdrijven. Antwoord in het Nederlands.';
const geenAI = { ok: false, status: 503, reden: 'De AI is nu niet bereikbaar. Probeer het zo nog eens.' };
// De agenda (kern/agenda.js) weigert alles wat geen geldige datum is; hier
// filteren we daarom hard op vorm in plaats van te hopen dat het model het goed doet.
const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const UREN = { een: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7,
  acht: 8, negen: 9, tien: 10, elf: 11, twaalf: 12 };

function iso(d) {
  const jaar = d.getFullYear();
  const maand = String(d.getMonth() + 1).padStart(2, '0');
  const dag = String(d.getDate()).padStart(2, '0');
  return jaar + '-' + maand + '-' + dag;
}

function datumUit(regel, nu) {
  const expliciet = regel.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (expliciet && DATUM.test(expliciet[0])) return expliciet[0];
  const kort = regel.match(/\b(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?\b/);
  if (kort) {
    let jaar = kort[3] ? Number(kort[3]) : nu.getFullYear();
    if (jaar < 100) jaar += 2000;
    const d = new Date(jaar, Number(kort[2]) - 1, Number(kort[1]));
    if (d.getFullYear() === jaar && d.getMonth() === Number(kort[2]) - 1 && d.getDate() === Number(kort[1]))
      return iso(d);
  }
  const laag = regel.toLowerCase();
  const plus = laag.match(/\b(overmorgen|morgen|vandaag)\b/);
  if (plus) {
    const d = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() + ({ vandaag: 0, morgen: 1, overmorgen: 2 })[plus[1]]);
    return iso(d);
  }
  for (let i = 0; i < DAGEN.length; i++) {
    if (!new RegExp('\\b' + DAGEN[i] + '\\b', 'i').test(regel)) continue;
    let afstand = (i - nu.getDay() + 7) % 7;
    if (!afstand || /volgende\s+/i.test(regel)) afstand += 7;
    return iso(new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() + afstand));
  }
  return '';
}

function tijdUit(regel) {
  const digitaal = regel.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (digitaal) return String(Number(digitaal[1])).padStart(2, '0') + ':' + digitaal[2];
  const uur = regel.match(/\b(?:om\s+)?([01]?\d|2[0-3])\s*(?:u(?:ur)?)\b/i);
  if (uur) return String(Number(uur[1])).padStart(2, '0') + ':00';
  const woord = regel.toLowerCase().match(/\bom\s+(een|twee|drie|vier|vijf|zes|zeven|acht|negen|tien|elf|twaalf)\s*(?:uur)?\b/);
  if (woord) {
    let n = UREN[woord[1]];
    const laag = regel.toLowerCase();
    if (/\b(middag|vanmiddag|avond|vanavond)\b/.test(laag) && n < 12) n += 12;
    else if (!/\b(ochtend|vanochtend|nacht|vannacht)\b/.test(laag)) return '';
    return String(n).padStart(2, '0') + ':00';
  }
  return '';
}

module.exports = ({ draad, anthropic }) => {
  const geenDraad = { ok: false, status: 403, reden: 'Dit gesprek kan ik niet lezen.' };

  async function samenvat(mij, id) {
    const d = draad(mij, id);
    if (!d) return geenDraad;
    const t = lokaalSamenvatten(d.regels.join('\n'), { maxZinnen: 5, maxTekens: 900 });
    return { ok: true, titel: d.titel, samenvatting: t || 'Er staat nog niets in dit gesprek.',
      bron: 'lokale-taal', ai: false };
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

  /* Concrete afspraken zijn patroonherkenning, geen schrijfwerk. De parser
     herkent expliciete en relatieve datums en geeft onbekende velden leeg terug.
     Daardoor blijft een agendaknop gebaseerd op controleerbare bronwoorden. */
  async function afspraken(mij, id) {
    const d = draad(mij, id);
    if (!d) return geenDraad;
    const nu = new Date();
    const lijst = [];
    for (const bronregel of d.regels) {
      const vanMij = /^Ik:\s*/i.test(bronregel);
      const schoon = String(bronregel).replace(/^[^:]{1,60}:\s*/, '').trim();
      for (const regel of zinnen(schoon)) {
        const datum = datumUit(regel, nu), tijd = tijdUit(regel);
        const afspraak = /\b(afspreken|afspraak|zullen we|vergadering|bellen|diner|lunchen?|reserveren|komen|zien)\b/i.test(regel);
        if (!afspraak || (!datum && !tijd)) continue;
        lijst.push({ wat: regel.replace(/[.!?]+$/, '').trim().slice(0, 200), datum, tijd,
          wie: vanMij ? 'ik' : 'de ander' });
      }
    }
    return { ok: true, titel: d.titel, afspraken: lijst.slice(0, 20), bron: 'lokale-taal', ai: false };
  }

  return { samenvat, concept, afspraken };
};
