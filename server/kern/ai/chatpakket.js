/* Het ledengesprek met Rahul als contextpakket (./contextpakket.js).

   De systeemprompt van ./prompt.js komt hier binnen als losse delen, en elk deel
   krijgt een soort. De INDELING GAAT OP HERKOMST en niet op inhoud: een deel is
   karakter omdat het UIT ./karakter komt, taalregel omdat het uit
   ../rahul/taal komt. Wat hier niet herkend wordt, is VERPLICHTE GRONDWET --
   onbekende tekst wordt nooit weggelaten. Dat is de veilige kant: een nieuwe
   regel in prompt.js gaat mee tot iemand hem bewust anders indeelt.

   Wat mag wijken, en waarom:
   - het levensverhaal (karakter vanaf deel 4): Rahul vertelt dat volgens zijn
     eigen regels alleen als iemand ernaar vraagt. De kern (wie hij is, zijn
     eerlijkheid, zijn discretie) blijft altijd staan.
   - de openstaande betalingen: die worden bij krapte INGEKORT tot een zin die
     zegt dat ze er zijn maar niet zijn meegegeven -- nooit weggelaten, want dan
     leest het model "geen betalingen" en dat is onwaar.
   - oude gespreksbeurten, oudste eerst; de laatste vraag van het lid is de
     opdracht en blijft altijd. */
'use strict';
const RAHUL_KARAKTER = require('./karakter');
const { TAALREGELS } = require('../rahul/taal');
const { TWIJFELREGELS } = require('../rahul/twijfel');
const { stelContextSamen } = require('./contextpakket');

const KERN_KARAKTER = 3;
/* Vraagt het lid naar Rahul zelf, dan gaat zijn verhaal mee: dat is precies het
   moment waarop hij het volgens zijn karakter mag delen. */
const OVER_RAHUL = /\b(jezelf|rahul|jouw verhaal|je verhaal|jeugd|familie|ouders|opgegroeid|verleden|wie ben je|over jou|waar kom je|hoe begon|ontstaan|yourself|your story|who are you|childhood|family)\b/i;

function soortVan(tekst, toon, overRahul) {
  const k = RAHUL_KARAKTER.indexOf(tekst);
  if (k >= KERN_KARAKTER) return { soort: 'identiteit', prioriteit: 1, verplicht: overRahul, bron: 'kern/ai/karakter.js' };
  if (k >= 0) return { soort: 'identiteit', verplicht: true, bron: 'kern/ai/karakter.js' };
  if (TAALREGELS.includes(tekst)) return { soort: 'grondwet', verplicht: true, bron: 'kern/rahul/taal.js' };
  if (TWIJFELREGELS.includes(tekst)) return { soort: 'grondwet', verplicht: true, bron: 'kern/rahul/twijfel.js' };
  if (toon.includes(tekst) || tekst.startsWith('Het lid: ')) return { soort: 'identiteit', verplicht: true, bron: 'kern/ai/prompt.js' };
  if (tekst.startsWith('Openstaande betalingen: ')) return { soort: 'feiten', prioriteit: 5, graad: 'gemeten', bron: 'ledendossier',
    magSamenvatten: true, magVervallen: false,
    kort: 'Er staan betalingen open; de details zijn in dit gesprek niet meegegeven. Zeg niet dat er niets openstaat, en verwijs voor de bedragen naar het portaal.' };
  if (tekst.startsWith('Komende reis: ') || tekst.startsWith('Dit lid heeft nog GEEN reis')) return { soort: 'feiten', verplicht: true, graad: 'gemeten', bron: 'ledendossier' };
  if (tekst.startsWith('Je helpt het lid met reisvoorbereiding')) return { soort: 'opdracht', verplicht: true, bron: 'kern/ai/prompt.js' };
  return { soort: 'grondwet', verplicht: true, bron: 'kern/ai/prompt.js' };
}

/* Het gesprek zoals het model het krijgt: alleen lid en Rahul, de laatste
   twaalf beurten, en nooit beginnend bij een antwoord. */
function gesprekVan(convo) {
  const lijst = (convo || [])
    .filter(m => m.from === 'member' || m.from === 'rahul')
    .map(m => ({ role: m.from === 'member' ? 'user' : 'assistant', content: String(m.text).slice(0, 2000) }))
    .slice(-12);
  while (lijst.length && lijst[0].role !== 'user') lijst.shift();
  return lijst;
}

function chatPakket({ delen, convo, venster, antwoord, toon }) {
  const gesprek = gesprekVan(convo);
  const laatste = gesprek.length ? gesprek[gesprek.length - 1] : null;
  const tonen = Object.values(toon || {});
  const overRahul = !!(laatste && laatste.role === 'user' && OVER_RAHUL.test(laatste.content));
  const blokken = (delen || []).filter(Boolean).map((tekst, i) =>
    Object.assign({ id: 'prompt.' + i, tekst }, soortVan(tekst, tonen, overRahul)));
  gesprek.forEach((m, i) => {
    const opdracht = i === gesprek.length - 1 && m.role === 'user';
    blokken.push(opdracht
      ? { id: 'opdracht', soort: 'opdracht', verplicht: true, berichten: [m], bron: 'lid' }
      : { id: 'gesprek.' + i, soort: 'gesprek', prioriteit: i, berichten: [m], bron: 'gesprek' });
  });
  const pak = stelContextSamen({ blokken, venster, antwoord });
  return Object.assign(pak, { laatste: laatste ? laatste.content : '', vraagtAntwoord: !!(laatste && laatste.role === 'user') });
}

module.exports = { chatPakket, gesprekVan, soortVan };
