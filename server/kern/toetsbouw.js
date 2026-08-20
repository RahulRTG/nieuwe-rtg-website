/* RTG School: de Assessment Compiler -- een toets is zelf een meetinstrument.

   Een docent zegt niet "maak dertig vragen" maar: ik wil betrouwbaar meten of
   deze klas deze leerdoelen beheerst. Daarop hoort een systeem te antwoorden
   met wat die toets werkelijk meet -- en soms met "doel E meet je hiermee
   onvoldoende".

   DE COMPILER BOUWT NIET, HIJ KEURT. Er wordt niets automatisch bijgemaakt,
   verwijderd of herschreven. Elke opmerking zegt wat er aan de hand is en wat
   het kost om het te verhelpen; de docent beslist. Dat is niet uit voorzichtig-
   heid: een toets is een besluit over kinderen, en een besluit hoort een
   eigenaar te hebben.

   Wat er wordt nagerekend:

     dekking      -- meet je elk leerdoel met genoeg vragen om iets te zeggen;
     vraagvorm    -- alles meerkeuze meet iets anders dan alles open;
     overlap      -- twee leerdoelen op dezelfde generator meten hetzelfde;
     hoogte       -- staat de stof op het niveau van de klas of ver eronder;
     tijd         -- past dit in een lesuur;
     taalbelasting -- de Fairness Engine hieronder.

   DE FAIRNESS ENGINE. Een natuurkundevraag die vooral leesvaardigheid meet, is
   een kapotte vraag. Wat hier telbaar is: hoe lang de vraag is, hoeveel zinnen,
   en hoeveel lange woorden erin staan. Bij een TAALVAK is dat geen probleem --
   daar is taal het onderwerp -- en bij een zaakvak wel. Die knip komt uit
   ./taalbeleid.js en niet uit een aparte lijst, want anders lopen ze uit elkaar.

   Cultuur is geen fout maar wel een vraag. Een opgave over oliebollen meet voor
   wie hier net is iets anders dan voor wie hier opgroeide. De compiler noemt
   het; hij haalt het er niet uit, want soms is het precies de bedoeling. */
const { isTaalvak } = require('./taalbeleid');

const MIN_PER_DOEL = 3;
const LANG_WOORD = 12;
const VEEL_WOORDEN = 25;
const SECONDEN = { open: 45, meerkeuze: 25 };
const LESUUR = 50 * 60;

/* Woorden die een kind dat hier net is niet hoeft te kennen. Kort en
   herkenbaar; de lijst is met opzet niet uitputtend, want een compleet
   cultuurregister bestaat niet en doen alsof is erger dan een korte lijst. */
const CULTUUR = ['sinterklaas', 'zwarte piet', 'koningsdag', 'oliebollen', 'pepernoten',
  'carnaval', 'elfstedentocht', 'kerstmis', 'pasen', 'suikerfeest', 'ramadan', 'divali'];

const woorden = (t) => String(t || '').match(/[\p{L}]+/gu) || [];
const zinnen = (t) => String(t || '').split(/[.!?]+/).filter(x => x.trim()).length;

/* De taalbelasting van EEN opgave. Geeft null als er niets aan de hand is. */
function taallast(vraag, vak) {
  const w = woorden(vraag);
  const lang = w.filter(x => x.length >= LANG_WOORD).length;
  const cultuur = CULTUUR.filter(c => String(vraag || '').toLowerCase().includes(c));
  const uit = [];
  /* Bij een taalvak is taal het onderwerp: dan is een lange zin geen fout maar
     de opgave. Cultuur wordt wel altijd genoemd, ook bij taal. */
  if (!isTaalvak(vak) && (w.length > VEEL_WOORDEN || zinnen(vraag) > 2 || lang >= 2))
    uit.push({ soort: 'taalbelasting', wat: 'Deze vraag is talig zwaar voor een zaakvak: ' + w.length +
      ' woorden, ' + zinnen(vraag) + ' zin(nen), ' + lang + ' lang(e) woord(en).',
      wat_nu: 'Kort de zin in of splits hem; wie het concept snapt maar traag leest, hoort hier niet op te struikelen.' });
  if (cultuur.length)
    uit.push({ soort: 'cultuur', wat: 'Deze vraag leunt op bekende context: ' + cultuur.join(', ') + '.',
      wat_nu: 'Soms is dat precies de bedoeling. Is het dat niet, kies dan iets dat iedereen kent.' });
  return uit;
}

/* De keuring van een hele toets. `doelen` zijn de leerdoel-objecten,
   `proeven` een handvol echte opgaven per doel-id (uit dezelfde generator als
   de toets zelf gebruikt), zodat er over de werkelijke vragen wordt geoordeeld
   en niet over een aanname. */
function keur(doelen, perDoel, proeven, opties) {
  const o = opties || {};
  const punten = [];
  const perDoelUit = [];
  let seconden = 0;

  const gens = {};
  for (const d of doelen) {
    const vragen = (proeven && proeven[d.id]) || [];
    const meerkeuze = vragen.filter(v => v.opties && v.opties.length).length;
    const vorm = !vragen.length ? 'onbekend' : meerkeuze === vragen.length ? 'meerkeuze' : meerkeuze ? 'gemengd' : 'open';
    seconden += perDoel * (vorm === 'meerkeuze' ? SECONDEN.meerkeuze : SECONDEN.open);

    const eigen = [];
    if (perDoel < MIN_PER_DOEL)
      eigen.push({ soort: 'dekking', wat: 'Met ' + perDoel + ' vraag(en) meet u dit leerdoel onvoldoende.',
        wat_nu: 'Neem er minstens ' + MIN_PER_DOEL + '; onder dat aantal is een uitslag toeval.' });
    const naam = String(d.gen && d.gen.soort || '');
    if (naam) { (gens[naam] = gens[naam] || []).push(d.id); }
    for (const v of vragen.slice(0, 3)) for (const p of taallast(v.v, d.vak)) eigen.push(Object.assign({ doel: d.id }, p));

    perDoelUit.push({ doel: d.id, naam: d.naam, vak: d.vak, vragen: perDoel, vorm,
      meet: perDoel >= MIN_PER_DOEL ? 'genoeg om iets te zeggen' : 'te weinig om iets te zeggen',
      opmerkingen: eigen });
    punten.push(...eigen);
  }

  for (const [gen, ids] of Object.entries(gens))
    if (ids.length > 1) punten.push({ soort: 'overlap',
      wat: 'Deze leerdoelen komen uit dezelfde vraagsoort (' + gen + '): ' + ids.join(', ') + '.',
      wat_nu: 'De toets meet dat deel dubbel en iets anders niet. Vervang er een of aanvaard dat bewust.' });

  const vormen = new Set(perDoelUit.map(x => x.vorm));
  if (vormen.size === 1 && vormen.has('meerkeuze'))
    punten.push({ soort: 'vraagvorm', wat: 'Alles is meerkeuze.',
      wat_nu: 'Meerkeuze meet herkennen; open vragen meten of iemand het zelf kan opschrijven. Meng ze als u het tweede wilt weten.' });

  if (o.fase && doelen.length) {
    const laag = doelen.filter(d => d.groep != null && o.groep != null && d.groep < o.groep - 1);
    if (laag.length === doelen.length)
      punten.push({ soort: 'hoogte', wat: 'Alle leerdoelen liggen onder het niveau van deze klas.',
        wat_nu: 'Dat kan bewust zijn (ophalen), maar deze toets zegt weinig over waar de klas nu staat.' });
  }

  if (seconden > LESUUR)
    punten.push({ soort: 'tijd', wat: 'Naar schatting ' + Math.round(seconden / 60) + ' minuten; een lesuur is 50.',
      wat_nu: 'Haal een leerdoel weg of verlaag het aantal vragen per doel.' });

  return { ok: true, perDoel: perDoelUit, opmerkingen: punten,
    minuten: Math.round(seconden / 60), aantalVragen: doelen.length * perDoel,
    oordeel: punten.length ? 'Er valt iets aan te merken; u beslist.' : 'Op dekking, vorm, overlap, tijd en taal valt er niets aan te merken.',
    uitleg: 'Dit is een keuring en geen bouwer: er wordt niets veranderd aan uw toets. Wat hier niet in staat, is niet nagerekend.' };
}

module.exports = { keur, taallast, MIN_PER_DOEL, CULTUUR, LESUUR };
