/* DE LEVENSFASE-AS.

   De derde as naast werkvorm (wat doet zij) en rechtsvorm (wat is zij):
   waar staat deze onderneming in haar leven. Een idee heeft geen debiteuren-
   beheer nodig en een groep met vier vennootschappen wel consolidatie; het is
   dezelfde software, alleen laat zij op elk moment iets anders zien.

   DE FASE WORDT AFGELEID EN NOOIT MET DE HAND GEZET. Dat is dezelfde keuze als
   in kern/werkvormen.js en om dezelfde reden: een opgeslagen fase is een tweede
   waarheid naast de feiten, en die twee lopen uiteen zodra iemand vergeet hem
   bij te werken. Een bedrijf met veertig klanten dat nog op 'idee' staat, is
   erger dan geen fase -- want alles wat erop leunt (welke schermen, welke
   waarschuwingen, welke hulp) is dan ook fout, en niets klaagt.

   DE HOOGSTE BEREIKTE FASE, NIET DE EERSTE DIE ZAKT. Elke fase heeft een eigen
   toets op de feiten en die staan los van elkaar. Wie eerst inschrijft bij de
   KvK en pas daarna zijn plan vastlegt, hoort niet op 'idee' te blijven hangen
   omdat stap twee ontbreekt. Een ladder die bij het eerste gat stopt, meet de
   volgorde van invullen in plaats van de staat van het bedrijf.

   ZONDER FEITEN GEEN OORDEEL. faseVan(null) geeft null en niet 'idee'. Dat is
   lat-regel 3: een meter die zijn invoer niet vindt hoort te zakken, niet stil
   de laagste waarde te geven -- want 'idee' is een geldig antwoord en zou hier
   dus een storing als een uitkomst laten lezen. */
'use strict';

/* De feiten waar elke toets op rust. Dit is de volledige lijst, en hij staat
   hier zodat een nieuwe fase niet stilletjes op een veld gaat leunen dat
   nergens wordt gevuld (dat veld is dan altijd undefined en de fase wordt
   nooit bereikt, zonder dat iets het zegt). ondernemingFeiten() in ./index.js
   vult precies deze sleutels. */
const FEITEN = ['plan', 'ingeschreven', 'klanten', 'personeel', 'vestigingen', 'entiteiten'];

const FASEN = [
  { id: 'idee', label: 'Idee', vraag: 'Wat zou ik willen beginnen?',
    toont: ['intake', 'kansverkenning'],
    bereikt: () => true },
  { id: 'validatie', label: 'Validatie', vraag: 'Klopt dit plan?',
    toont: ['plan', 'simulatie', 'stresstest'],
    bereikt: f => !!f.plan },
  { id: 'oprichting', label: 'Oprichting', vraag: 'Wat moet er geregeld worden?',
    toont: ['oprichtingsproject', 'rechtsvormkeuze'],
    bereikt: f => !!f.ingeschreven },
  { id: 'eersteklant', label: 'Eerste klant', vraag: 'Hoe kom ik aan klant nummer één?',
    toont: ['mall', 'website', 'facturen', 'offertes'],
    bereikt: f => f.klanten >= 1 },
  { id: 'tractie', label: 'Tractie', vraag: 'Komen ze terug?',
    toont: ['crm', 'retentie', 'abonnementen'],
    bereikt: f => f.klanten >= 10 },
  { id: 'werkgever', label: 'Werkgever', vraag: 'Hoe houd ik mijn mensen aan boord?',
    toont: ['payroll', 'hris', 'rooster', 'werving'],
    bereikt: f => f.personeel >= 1 },
  { id: 'vestigingen', label: 'Meerdere vestigingen', vraag: 'Draait elke locatie even goed?',
    toont: ['locatiebeeld', 'voorraad', 'budgetten'],
    bereikt: f => f.vestigingen >= 2 },
  { id: 'groep', label: 'Groep', vraag: 'Waar stuur ik het geheel op?',
    toont: ['consolidatie', 'intercompany', 'treasury', 'directiescherm'],
    bereikt: f => f.entiteiten >= 2 }
];

const FASE_IDS = FASEN.map(f => f.id);

/* Alle fasen die op deze feiten bereikt zijn. */
function bereiktIn(feiten) {
  if (!feiten || typeof feiten !== 'object') return null;
  return FASEN.filter(f => f.bereikt(feiten));
}

/* De fase van de onderneming: de HOOGSTE die bereikt is. Null als er geen
   feiten zijn -- zie de kop. */
function faseVan(feiten) {
  const b = bereiktIn(feiten);
  if (!b || !b.length) return null;
  return b[b.length - 1].id;
}

/* Wat er op deze feiten open staat: alles wat elke bereikte fase toont.
   Een fase verderop die al bereikt is telt gewoon mee -- wie personeel heeft
   krijgt de payroll, ook als hij nog geen tien klanten heeft. */
function ontgrendeld(feiten) {
  const b = bereiktIn(feiten);
  if (!b) return null;
  const uit = new Set();
  for (const f of b) for (const t of f.toont) uit.add(t);
  return [...uit];
}

/* De eerstvolgende mijlpaal: de laagste fase die nog NIET bereikt is, met
   wat er dan zichtbaar wordt. Null als het bedrijf alles heeft gehaald. */
function volgende(feiten) {
  const b = bereiktIn(feiten);
  if (!b) return null;
  const gehaald = new Set(b.map(f => f.id));
  const v = FASEN.find(f => !gehaald.has(f.id));
  return v ? { id: v.id, label: v.label, vraag: v.vraag, toont: v.toont.slice() } : null;
}

/* Het volledige fasebeeld voor een scherm: waar sta ik, wat heb ik gehad,
   wat komt er. Null-doorgeven, zodat de aanroeper de ontbrekende feiten
   niet als een lege onderneming leest. */
function faseBeeld(feiten) {
  const b = bereiktIn(feiten);
  if (!b) return null;
  const gehaald = new Set(b.map(f => f.id));
  return {
    fase: faseVan(feiten),
    ontgrendeld: ontgrendeld(feiten),
    volgende: volgende(feiten),
    ladder: FASEN.map(f => ({ id: f.id, label: f.label, bereikt: gehaald.has(f.id) }))
  };
}

module.exports = { FASEN, FASE_IDS, FEITEN, bereiktIn, faseVan, ontgrendeld, volgende, faseBeeld };
