/* Magnaat FROM ZERO (V1): DE GETALLEN VAN EEN LEVEN DAT BIJNA BIJ NUL BEGINT.

   Je begint op een maandag met € 64,32, een baan van 24 uur in een keuken, een
   telefoon en een eenvoudige laptop. Loon komt op vrijdag, betalingen hebben
   een dag, en tijd is net zo schaars als geld: wie een extra dienst draait,
   heeft die uren niet voor zijn eigen project (MAGNAAT.md, V1 From Zero).

   Alles hier is een spelregel en geen advies. GELD IS EEN GEHEEL AANTAL
   EUROCENTEN en TIJD EEN GEHEEL AANTAL MINUTEN. Dit bestand kent alleen
   getallen; wat ermee gebeurt staat in ./dag.js en de actiebestanden, en elke
   euro loopt door het grootboek (./boek.js). */
'use strict';

const REGELVERSIE = '2';
const DAG_MS = 180000;             // een speldag duurt drie echte minuten, tenzij je hem zelf afsluit
const MAX_DAGEN_PER_KEER = 120;    // een vangnet, zoals in World
/* HET TEMPO VAN EEN SPEELRONDE. Drie minuten per dag is een leven dat je naast
   je eigen dag speelt; wie de keten in een uur wil doorlopen, zet hem vlotter.
   Wat een dag BETEKENT verandert niet, alleen hoe lang hij echt duurt. */
const TEMPO = { rustig: 180000, vlot: 60000, proef: 20000 };
const DOORSPOELEN_MAX = 14;        // hooguit twee weken ineens, dan kijk je weer
const START_KAS = 6432;            // € 64,32
const PERIODE = 28;                // de huur gaat per vier weken
const DAGNAMEN = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];
const weekdag = (dag) => (dag - 1) % 7;          // dag 1 is een maandag
const dagNaam = (dag) => DAGNAMEN[weekdag(dag)];

const BAAN = {
  werkgever: 'Brasserie De Haven', functie: 'Keukenmedewerker',
  urenPerWeek: 24, dienstdagen: [1, 2, 5],       // dinsdag, woensdag en zaterdag, elk acht uur
  uurloon: 1125,                                 // netto
  loondag: 4,                                    // vrijdag, over de diensten van die week
  extra: { dag: 3, minuten: 420, loon: 14500 }   // de keuken vraagt je elke week of je donderdag kunt
};

/* Vrije tijd per weekdag, in minuten, naast werk, slaap en het gewone leven.
   Op een dienstdag blijft de avond over. */
const VRIJ = [260, 180, 180, 420, 240, 180, 360];

/* Wat het leven kost, en wanneer. Een verplichting met `uitstel` kan een week
   later, tegen de kosten die erbij staan; huur kan dat niet. */
const VERPLICHTINGEN = [
  { id: 'huur', naam: 'Huur van je kamer', leverancier: 'je verhuurder', bedrag: 65000, elke: PERIODE, eerste: 15, uitstel: null },
  { id: 'vast', naam: 'Telefoon en zorgverzekering', leverancier: 'je provider en je verzekeraar', bedrag: 4199, elke: 7, eerste: 3, uitstel: { dagen: 7, kosten: 750 } }
];
const BOODSCHAPPEN = 700;          // per dag; zonder geld eet je goedkoper, je staat niet rood
const SOFTWARE = { naam: 'Pro-abonnement van je werksoftware', bedrag: 4900, elke: PERIODE, uitstel: { dagen: 7, kosten: 0 } };
/* DE SPELREGELS VAN DEZE WERELD, en ze zijn van Oudwijk en niet van een echt
   land. Wanneer je je als onderneming inschrijft, wat dat kost en of er btw op
   een factuur gaat, verschilt per jurisdictie en verandert met de tijd. Magnaat
   doet niet alsof het ergens anders ook zo werkt: elke tekst die zo'n regel
   noemt, noemt hem als regel van Oudwijk. */
const JURISDICTIE = {
  stad: 'Oudwijk',
  register: 'het ondernemersregister van Oudwijk',
  inschrijven: 'In Oudwijk schrijf je je als onderneming in zodra je structureel voor klanten werkt.',
  btw: 'In Oudwijk betaalt een kleine onderneming geen btw over haar omzet.',
  termijn: 'In Oudwijk is een betaaltermijn van 14 dagen gewoon.'
};
const AANMANING = 1500;            // wat een mislukte betaling kost, een keer per achterstand
const KVK = 8225;                  // de inschrijving in het register van Oudwijk

/* Leren maakt je sneller: elke drie uur leren haalt vijf procent van een
   opdracht af, tot een kwart. */
const LEREN = { perStap: 180, korting: 5, max: 25 };

const BETAALTERMIJN = 14;
const HERINNERING_DAGEN = 3;
const LENING = { max: 25000, termijnen: 2 };             // familie, terug van je volgende twee lonen
const VOORFINANCIERING = { deel: 90 };                   // je krijgt nu 90% van wat openstaat; de financier int
const ONDERNEMING = { opdrachten: 2 };                   // na twee betaalde opdrachten ben je structureel bezig
const ZELFSTANDIG = { dagen: 28, factor: 200 };          // je bedrijf brengt twee keer je loon binnen, en bestaat al vier weken

/* HOE ZWAAR HET LEVEN IS (V4). Normaal is het leven zoals het bedoeld is;
   licht geeft wat meer ruimte om te leren, zwaar laat bijna niets over. Wat er
   schuift: waarmee je begint, hoe laat klanten betalen (procent van hun
   gewoonte) en wat je kamer kost (procent). De keten zelf verandert niet. */
const MOEILIJKHEID = {
  licht: { naam: 'Licht', startKas: 25000, laat: 50, huur: 85, uitleg: 'meer om mee te beginnen, klanten betalen eerder, je kamer is goedkoper' },
  normaal: { naam: 'Normaal', startKas: START_KAS, laat: 100, huur: 100, uitleg: 'zoals het bedoeld is' },
  zwaar: { naam: 'Zwaar', startKas: 1500, laat: 150, huur: 110, uitleg: 'bijna niets op de bank, klanten betalen later, je kamer is duurder' }
};
const niveauVan = (st) => MOEILIJKHEID[st.moeilijkheid] || MOEILIJKHEID.normaal;
const verplichtingBedrag = (st, v) => (v.id === 'huur' ? Math.round(v.bedrag * niveauVan(st).huur / 100) : v.bedrag);

const RTG = {
  geld: { naam: 'RTG Geld', waarom: 'je hebt een rekening en een loon' },
  agenda: { naam: 'Agenda', waarom: 'je plant je eerste vrije uren' },
  berichten: { naam: 'Berichten', waarom: 'iemand heeft gezien wat je maakt' },
  offertes: { naam: 'Offertes', waarom: 'je doet je eerste voorstel' },
  facturen: { naam: 'Facturen', waarom: 'je hebt werk geleverd en wilt betaald worden' },
  herinneringen: { naam: 'Betaalherinneringen', waarom: 'een klant betaalt te laat' },
  budget: { naam: 'Budget en betalingen', waarom: 'er is meer te betalen dan er op je rekening staat' },
  zakelijk: { naam: 'RTG Zakelijk', waarom: 'je hebt een onderneming ingeschreven' },
  boekhouding: { naam: 'Boekhouding', waarom: 'je onderneming heeft een resultaat en een balans' },
  personeel: { naam: 'Personeel en planning', waarom: 'je hebt iemand aangenomen' },
  handel: { naam: 'Inkoop en voorraad', waarom: 'je koopt in bij een leverancier' },
  contracten: { naam: 'Contracten', waarom: 'een klant wil vast werk' },
  prognose: { naam: 'Cashflowprognose', waarom: 'je hebt vaste lasten die elke week terugkomen' }
};

module.exports = { REGELVERSIE, DAG_MS, MAX_DAGEN_PER_KEER, TEMPO, DOORSPOELEN_MAX, START_KAS, PERIODE, DAGNAMEN, weekdag, dagNaam, BAAN, VRIJ,
  VERPLICHTINGEN, BOODSCHAPPEN, SOFTWARE, JURISDICTIE, AANMANING, KVK, LEREN, BETAALTERMIJN, HERINNERING_DAGEN, LENING,
  VOORFINANCIERING, ONDERNEMING, ZELFSTANDIG, RTG, MOEILIJKHEID, niveauVan, verplichtingBedrag };
