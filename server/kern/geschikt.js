/* WAT EEN ZAAK KAN -- de woordenlijst, en waar hij hoort.

   Een lid met een rolstoel, een halal-eis of een prikkelgevoeligheid moet kunnen
   zeggen wat de PLEK moet kunnen. Om dat te laten werken moet een zaak het zelf
   kunnen verklaren, en moeten beide kanten dezelfde woorden gebruiken.

   WAAROM DIT NIET IN kern/vonk/halfweg.js STAAT, waar het eerst wel stond. Deze
   lijst gaat over een HORECAZAAK en niet over daten. Vonk is een van de
   afnemers; morgen is dat ook een gewone reservering, een event of de
   Rechterhand. Zou de lijst in de datingmodule blijven, dan hing de
   leverancierskant aan Vonk -- precies de verkeerde kant op, en de eerste stap
   naar een tweede lijst aan de zaakzijde (LAT.md regel 4).

   DE VERKLARING KOMT VAN DE ZAAK ZELF, EN RTG CONTROLEERT HEM NIET. Dat staat
   hier expliciet omdat het verleidelijk is te doen alsof een vinkje een keuring
   is. Het is een uitspraak van de ondernemer, net zoals `allergens` bij een
   gerecht dat is. Wat RTG wel doet: niets invullen wat niet gezegd is. Een
   onbekende zaak voldoet nergens aan, en dat is de veilige kant op -- zie de kop
   van kern/vonk/halfweg.js voor waarom die default hier andersom ligt dan bij
   voorkeuren over mensen.

   EEN EIS TOEVOEGEN IS EEN REGEL HIERONDER. Het leverancierscherm, de dating-
   filter en de toets lezen alle drie deze lijst. */

const EISEN = [
  { id: 'rolstoel', label: 'rolstoeltoegankelijk',
    uitleg: 'Binnenkomst, tafel en toilet zijn met een rolstoel te gebruiken.' },
  { id: 'prikkelarm', label: 'prikkelarm',
    uitleg: 'Er is een rustige plek mogelijk: gedempt geluid, geen felle verlichting.' },
  { id: 'halal', label: 'halal', uitleg: 'Er is een halal-aanbod.' },
  { id: 'kosher', label: 'kosher', uitleg: 'Er is een kosher-aanbod.' },
  { id: 'vegan', label: 'vegan', uitleg: 'Er is een volwaardig plantaardig aanbod.' },
  { id: 'zonderAlcohol', label: 'zonder alcohol',
    uitleg: 'Een bezoek zonder alcohol is er vanzelfsprekend, met een volwaardige drankkaart.' }
];

const IDS = new Set(EISEN.map(e => e.id));

// wat er van een zaak binnenkomt: alleen bekende woorden, zonder dubbele
const schoonGeschikt = lijst =>
  Array.isArray(lijst) ? EISEN.filter(e => lijst.includes(e.id)).map(e => e.id) : [];

// wat een zaak heeft verklaard; nooit een gok, altijd wat er staat
const geschiktVan = s => (Array.isArray(s && s.geschikt) ? s.geschikt.filter(x => IDS.has(x)) : []);

// voldoet deze zaak aan ALLE gevraagde eisen? Niets verklaard is niet voldoen.
const voldoet = (s, eisen) => (eisen || []).every(e => geschiktVan(s).includes(e));

const lijst = () => EISEN.map(e => ({ ...e }));

module.exports = { EISEN, IDS, schoonGeschikt, geschiktVan, voldoet, lijst };
