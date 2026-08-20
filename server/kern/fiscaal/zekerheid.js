/* DE VIER ZEKERHEIDSKLASSEN: wat weet dit huis zeker, en wat niet.

   Tot nu toe droeg elke fiscale uitkomst dezelfde zin: "voorlichting, geen
   bindend fiscaal advies". Dat is veilig en het is bijna nergens waar. Het staat
   onder een btw-aangifte die tot op de cent uit het factuurregister is geteld,
   en onder een zzp-schatting die met vaste tabellen op een verwachte jaarwinst
   rekent. Die twee hebben niets met elkaar gemeen, en ze onder dezelfde
   voorbehoud schuiven doet allebei tekort: het eerste wordt onnodig vaag, het
   tweede onterecht stevig. Een gebruiker die overal hetzelfde voorbehoud leest,
   leest het na een week niet meer.

   Dus vier klassen, en de regel eronder is: automatiseer wat objectief
   automatiseerbaar is, en maak nergens zekerheid waar die niet is.

     bepaald       wet + gegevens leiden eenduidig tot deze uitkomst. Er valt
                   niets te kiezen; twee mensen die het narekenen komen op
                   hetzelfde uit. Dit mag als feit worden gepresenteerd.
     uitlegbaar    er zijn meerdere verdedigbare behandelingen. Wij kiezen er
                   een, we zeggen welke en waarom, en de ondernemer kan er
                   beargumenteerd van afwijken.
     advies        hier hoort een mens met vakkennis naar te kijken. Wij rekenen
                   voor en beslissen niet.
     voorbehouden  dit mag RTG niet zelfstandig doen -- juridisch of procedureel.
                   Geen model, geen knop, geen uitzondering.

   WAT DIT NIET IS: een vrijbrief. `bepaald` betekent niet "gegarandeerd juist",
   het betekent "als de gegevens kloppen, is er over de uitkomst geen discussie".
   Kloppen de gegevens niet, dan is het antwoord fout -- en juist daarvoor is de
   bewijsketen er (./herkomst.js), die laat zien waar het vandaan komt.

   EN WAT `voorbehouden` NIET IS: een tijdelijke stand. Het is geen functie die
   nog gebouwd moet worden maar een grens. Verschuift die grens ooit, dan is dat
   een besluit van een mens en niet van een release. */
'use strict';

/* De klassen, met hun Engelse naam erbij. Die naam is hoe ze zijn benoemd toen
   dit werd afgesproken; de sleutels zijn Nederlands omdat de rest van dit huis
   dat ook is, en twee talen door elkaar in een enum is hoe je later de
   verkeerde te pakken hebt. */
const KLASSEN = {
  bepaald: { term: 'DETERMINISTIC', kop: 'Vastgesteld',
    uitleg: 'Wet en gegevens leiden eenduidig tot deze uitkomst.' },
  uitlegbaar: { term: 'INTERPRETIVE', kop: 'Keuze met onderbouwing',
    uitleg: 'Er zijn meerdere verdedigbare behandelingen; wij kiezen er een en zeggen welke.' },
  advies: { term: 'ADVISORY', kop: 'Vraag een fiscalist',
    uitleg: 'Wij rekenen voor; de beoordeling hoort bij iemand met vakkennis.' },
  voorbehouden: { term: 'PROHIBITED_AUTOMATION', kop: 'Doet RTG niet',
    uitleg: 'Dit mag RTG niet zelfstandig uitvoeren; een mens of een andere partij is aan zet.' }
};

/* HET REGISTER. Elke fiscale uitkomst die dit huis produceert, met zijn klasse
   en de reden. Bewust een LIJST en geen los label per scherm: zodra elk scherm
   zijn eigen voorbehoud verzint, staat er ergens een aangifte onder "indicatie"
   en een schatting onder "vastgesteld", en dan zegt het woord niets meer. */
const REGISTER = {
  'btw.aangifte': { klasse: 'bepaald',
    waarom: 'Geteld uit het factuurregister; elke regel draagt het tarief dat de klant op zijn bon zag. Er wordt niets geschat.',
    mits: 'De aangifte bevat alleen omzet die een factuur kreeg.' },
  'btw.regel': { klasse: 'bepaald',
    waarom: 'De btw op een factuurregel volgt uit het bedrag en het tarief dat erop staat.' },
  'btw.herbouw': { klasse: 'bepaald',
    waarom: 'Opnieuw geteld uit dezelfde bronnen met dezelfde routine; gelijk of niet gelijk is geen oordeel.' },
  'btw.categorie': { klasse: 'uitlegbaar',
    waarom: 'Of een verkoop onder eten, drank, logies of het standaardtarief valt, volgt uit de werkvorm van de zaak en de kaart. Bij samengestelde leveringen is meer dan een behandeling verdedigbaar.',
    keuze: 'Wij volgen kern/fiscaal/tarief.js: ritten vervoer, kamers logies, een kaart eten, de rest standaard; bar-artikelen apart.' },
  'btw.cadeaukaart': { klasse: 'uitlegbaar',
    waarom: 'Bij een meervoudig inwisselbare kaart is het btw-moment de inwisseling en niet de verkoop. Voor kaarten die maar een ding kunnen kopen ligt dat anders.',
    keuze: 'Wij behandelen alle kaarten als meervoudig inwisselbaar.' },
  'btw.indienen': { klasse: 'voorbehouden',
    waarom: 'De ondernemer is de belastingplichtige. RTG legt vast DAT er is ingediend, met welk kenmerk; het verzenden loopt buiten RTG om.' },
  'loon.aangifte': { klasse: 'bepaald',
    waarom: 'Opgemaakt uit EEN definitieve loonrun; het nominatieve deel komt regel voor regel van de loonstroken en er wordt niets opnieuw gerekend.',
    mits: 'Vastleggen dat er is ingediend is iets anders dan verzenden; de verzending loopt via een koppeling buiten deze laag.' },
  'loon.herbouw': { klasse: 'bepaald',
    waarom: 'Opnieuw opgeteld uit dezelfde run met dezelfde routine; gelijk of niet gelijk is geen oordeel.' },
  'boekhouding.maand': { klasse: 'bepaald',
    waarom: 'De btw per tarief komt uit de geboekte transacties, met het tarief van de dag van elke transactie.',
    mits: 'De personeelskosten erin zijn een berekening op de klokuren en het ingestelde uurloon, geen loonrun.' },
  'boekhouding.advies': { klasse: 'advies',
    waarom: 'Genre-adviezen en AI-antwoorden zijn algemene voorlichting op eigen cijfers, geen beoordeling van uw situatie.' },
  'zzp.berekening': { klasse: 'advies',
    waarom: 'Een indicatie op een verwachte jaarwinst, met tabellen per peiljaar. Aftrekposten, afschrijving en persoonlijke omstandigheden zitten er niet in.' },
  'reservering.btw': { klasse: 'bepaald',
    waarom: 'Wat u aan btw in rekening bracht min uw voorbelasting is een optelsom uit uw eigen facturen. Dat geld is nooit van u geweest.' },
  'reservering.winst': { klasse: 'advies',
    waarom: 'Rust op een winst die wij maar gedeeltelijk kennen: alleen wat via RTG is gefactureerd.' },
  'naheffing.vaststellen': { klasse: 'voorbehouden',
    waarom: 'Een besluit met rechtsgevolg. Vier ogen, en wie hem opmaakt stelt hem niet vast.' },
  'naheffing.boete': { klasse: 'voorbehouden',
    waarom: 'Geen enkele stand levert zelf een boete op. Een mens zet een percentage en schrijft erbij waarom.' },
  'toegang.pas': { klasse: 'voorbehouden',
    waarom: 'Lifestyle en Business gaan uitsluitend via menselijke goedkeuring; de AI mag nooit zelf toegang beloven of verlenen.' }
};

/* De klasse van een uitkomst, als een blokje dat mee kan reizen met het
   antwoord. Een onbekende sleutel geeft NIET stilletjes "bepaald" terug: dan
   zou een nieuwe uitkomst die niemand heeft ingedeeld, zichzelf tot feit
   verklaren. Hij valt terug op `advies` -- de voorzichtige kant -- en zegt dat
   hij niet is ingedeeld. */
function zekerheid(sleutel) {
  const r = REGISTER[sleutel];
  if (!r) return Object.assign({ sleutel, klasse: 'advies', ingedeeld: false,
    waarom: 'Deze uitkomst is nog niet ingedeeld; tot dat gebeurt geldt de voorzichtige klasse.' }, KLASSEN.advies);
  return Object.assign({ sleutel, klasse: r.klasse, ingedeeld: true,
    waarom: r.waarom, mits: r.mits || null, keuze: r.keuze || null }, KLASSEN[r.klasse]);
}

/* De zin die onder een uitkomst hoort. Vervangt het vlakke "voorlichting, geen
   bindend fiscaal advies" dat overal onder stond: onder een getelde aangifte is
   die zin onnodig vaag, onder een schatting te stevig. */
function zin(sleutel) {
  const z = zekerheid(sleutel);
  if (z.klasse === 'bepaald') return z.mits
    ? 'Vastgesteld: ' + z.waarom + ' ' + z.mits
    : 'Vastgesteld: ' + z.waarom;
  if (z.klasse === 'uitlegbaar') return 'Hier is meer dan een behandeling verdedigbaar. ' + z.waarom +
    (z.keuze ? ' ' + z.keuze : '');
  if (z.klasse === 'voorbehouden') return z.waarom;
  return z.waarom + ' Raadpleeg voor uw aangifte een fiscalist.';
}

const klassenVan = () => KLASSEN;
const alles = () => Object.keys(REGISTER).map(k => zekerheid(k));

module.exports = { KLASSEN, REGISTER, zekerheid, zin, klassenVan, alles };
