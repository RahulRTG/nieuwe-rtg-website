/* ============================================================================
   DE VERRAADSMOTOR -- de WERELD laten liegen, niet het antwoord.

   WAAROM DIT NAAST DE LIEGPOORT STAAT. server/opzet/liegpoort.js laat een
   endpoint een geldig maar leeg antwoord geven, en meet daarmee of iemand naar
   de inhoud kijkt. Dat is een leugen aan de BOVENKANT. Wat er nooit is gemeten,
   is de onderkant: de database bevestigt een schrijfactie en verliest hem, de
   cache geeft correcte maar oude gegevens, de klok loopt zeventien minuten
   voor, hetzelfde verzoek komt twee keer binnen, gebeurtenis B arriveert voor A.

   Dat zijn de fouten waar bijna geen enkele toets naar kijkt, want een toets
   draait op een machine waar alles het doet. En het zijn precies de fouten die
   in productie geld kosten: een boeking die bevestigd is en niet bestaat, een
   saldo dat uit de cache komt nadat het is uitgegeven.

   DE OPZET IS DIE VAN DE LIEGPOORT, en dat is geen toeval: dat patroon werkt.
   Zonder RTG_VERRAAD doet deze module niets en kost hij niets. Hij staat in de
   gewone keten en niet achter een tweede opstartpad -- een pad dat je niet
   draait, is een pad dat niet werkt. En hij weigert in productie, want een
   database die met opzet schrijfacties weggooit is daar geen proef maar een
   ramp.

   DETERMINISTISCH, EN DAT IS HIER GEEN LUXE. Een verraad dat willekeurig
   toeslaat, geeft een fout die niemand kan navertellen -- en een toets die maar
   soms zakt, wordt binnen een week uitgezet. Daarom een seed: dezelfde seed
   geeft dezelfde reeks beslissingen, dus een gevonden fout is exact opnieuw af
   te spelen met de melding erbij.

   WAT DEZE MOTOR NIET IS. Hij bewijst niet dat het systeem bestand is tegen
   deze wereld; hij maakt de vraag STELBAAR. Wat er dan gebeurt, is een
   bevinding en geen oordeel -- de eerste ronde van zoiets vindt altijd wat, en
   dat hoort in een register te staan dat mag krimpen, niet in een toets die
   morgen rood is.
   ========================================================================== */
'use strict';

const { CATALOGUS } = require('./verraad-catalogus');

const OP_NAAM = new Map(CATALOGUS.map(v => [v.naam, v]));

/* De instelling: `naam` of `naam:kans`, meerdere gescheiden door komma's.
   `schrijf-verloren:0.3` slaat op drie van de tien keer toe. Zonder kans: altijd.

   Een onbekende naam is een FOUT en geen stilte. Een typefout in een
   proefinstelling levert anders een groene ronde op waarin niets is verraden,
   en dat is de gevaarlijkste uitkomst die dit gereedschap kan geven. */
function lees(ruw) {
  const tekst = String(ruw == null ? '' : ruw).trim();
  if (!tekst) return { aan: new Map(), onbekend: [] };
  const aan = new Map(), onbekend = [];
  for (const deel of tekst.split(',').map(s => s.trim()).filter(Boolean)) {
    const [naam, kans] = deel.split(':');
    if (!OP_NAAM.has(naam)) { onbekend.push(naam); continue; }
    const k = kans === undefined ? 1 : Number(kans);
    if (!(k >= 0 && k <= 1)) { onbekend.push(deel + ' (kans buiten 0..1)'); continue; }
    aan.set(naam, k);
  }
  return { aan, onbekend };
}

/* Een eigen, kleine generator in plaats van Math.random(): die is niet te
   seeden, en dan is een gevonden fout niet na te spelen. */
function maakTeller(seed) {
  let s = (Number(seed) || 1) >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const INSTELLING = lees(process.env.RTG_VERRAAD);

if (INSTELLING.onbekend.length) {
  throw new Error('RTG_VERRAAD kent deze niet: ' + INSTELLING.onbekend.join(', ') +
    '. Bekend zijn: ' + CATALOGUS.map(v => v.naam).join(', ') +
    '. Een typefout hier levert een ronde op waarin niets wordt verraden.');
}
if (INSTELLING.aan.size && process.env.NODE_ENV === 'production') {
  throw new Error('RTG_VERRAAD staat aan in productie. Een database die met opzet ' +
    'schrijfacties weggooit is daar geen proef maar een ramp. Zet hem uit.');
}

const volgende = maakTeller(process.env.RTG_VERRAAD_SEED || 20260811);
const geslagen = new Map();

/* Slaat dit verraad NU toe? Vraag hem op het punt waar het ertoe doet.
   Deterministisch bij een vaste seed, en hij houdt bij hoe vaak -- zodat een
   ronde achteraf kan zeggen dat er werkelijk is verraden en niet alleen dat het
   aanstond. Een proef die aanstaat en nooit toeslaat, is een groene ronde die
   niets heeft gemeten. */
function sla(naam) {
  const kans = INSTELLING.aan.get(naam);
  if (kans === undefined) return false;
  if (kans < 1 && volgende() >= kans) return false;
  geslagen.set(naam, (geslagen.get(naam) || 0) + 1);
  return true;
}

const actief = (naam) => INSTELLING.aan.has(naam);
const ietsAan = () => INSTELLING.aan.size > 0;
const telling = () => Object.fromEntries(geslagen);
const ingebouwd = () => CATALOGUS.filter(v => v.waar).length;

const CONTROL = {
  control: 'VERRAADSMOTOR',
  wat: 'het systeem is te beproeven op een wereld die liegt: database, klok, volgorde',
  eigenaar: 'Techniek',
  bewijs: ['test/verraad.test.js', 'test/verraadtelling.test.js'],
  bewijsstuk: './verraad-catalogus.js -- per verraad waar hij is ingebouwd',
  grens: 'de motor MAAKT de vraag stelbaar en beantwoordt hem niet. Dat een verraad ' +
    'is ingebouwd zegt niets over hoe het systeem erop reageert; daarvoor moet een ronde ' +
    'draaien en die uitkomst is een bevinding, geen oordeel.',
  /* DE ZES GETALLEN STAAN IN DE DEKKING, en dat is hier geen opsmuk. Deze motor
     mag nooit alleen "groen" melden: toegediend min waargenomen zijn de blinde
     injecties, en dat verschil is het enige getal dat zegt of er iets is
     geleerd. Ze komen uit VERRAAD.json -- de laatste ronde -- en niet uit deze
     verklaring. */
  dekking: { register: 'VERRAAD.json', beproefd: 'gemeten.verklaard',
    totaal: 'gemeten.inCatalogus', eenheid: 'verraden beproefd in de laatste ronde',
    tellers: { toegediend: 'gemeten.toegediend', waargenomen: 'gemeten.waargenomen',
      invariantschendingen: 'gemeten.invariantschendingen',
      blindeInjecties: 'gemeten.blindeInjecties',
      onherhaalbareRondes: 'gemeten.onherhaalbareRondes' } }
};

module.exports = { CATALOGUS, lees, maakTeller, sla, actief, ietsAan, telling, ingebouwd, CONTROL };
