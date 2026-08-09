/* HET OPRICHTINGSPROJECT: wat er geregeld moet worden, en waarom.

   De stappen komen uit drie bronnen die elk iets anders weten, en ze staan als
   DATA bij elkaar zodat een nieuwe branche of rechtsvorm geen nieuw codepad
   nodig heeft:

   - de RECHTSVORM (./rechtsvorm.js) levert de juridische stappen. Die stonden
     daar al als `oprichting`, en worden hier gelezen in plaats van overgetypt
     (lat-regel 4);
   - de BRANCHE levert wat alleen voor dat vak geldt: een horecazaak heeft een
     alcoholvergunning nodig en een rijschool een instructeurspas;
   - de SITUATIE levert wat uit het plan zelf volgt: samen ondernemen vraagt
     afspraken op papier, een abonnementsmodel vraagt doorlopende voorwaarden.

   ZONDER RECHTSVORM GEEN LIJST. Dat is geen strengheid maar het enige eerlijke
   antwoord: de helft van de stappen hángt van de rechtsvorm af, en een lijst
   die doet alsof dat niet zo is, laat iemand langs de notaris fietsen. Het
   project geeft dan `stand: 'geen-rechtsvorm'` met de vraag erbij, en niet een
   halve lijst die compleet lijkt.

   EN WAT DIT NIET IS: een juridisch volledige checklist. Dat staat ook in het
   antwoord zelf en niet alleen hier, want het reist mee naar het scherm. Wij
   kennen de gemeente niet, de branchevereniging niet, en de uitzonderingen niet.
   Een lijst die zich voordoet als volledig, is gevaarlijker dan geen lijst:
   wie hem afvinkt, controleert daarna niets meer. Dat is exact dezelfde reden
   waarom er geen knop "verzenden naar de CDT" bestaat. */
'use strict';

const RV = require('./rechtsvorm');

/* Per branche wat er bovenop de rechtsvorm komt. Bewust kort en bewust
   herkenbaar: liever vijf stappen die kloppen dan dertig die suggereren dat
   dit de volledige regelgeving is. */
const PER_BRANCHE = {
  restaurant: ['Alcoholvergunning aanvragen', 'HACCP-plan opstellen', 'Exploitatievergunning bij de gemeente', 'Melding bij de NVWA'],
  bar: ['Alcoholvergunning aanvragen', 'Exploitatievergunning bij de gemeente', 'Geluidsnormen navragen'],
  club: ['Alcoholvergunning aanvragen', 'Exploitatievergunning bij de gemeente', 'Geluids- en sluitingstijden navragen'],
  beachclub: ['Alcoholvergunning aanvragen', 'Vergunning voor het strandseizoen', 'HACCP-plan opstellen'],
  hotel: ['Toeristenbelasting aanmelden bij de gemeente', 'Brandveiligheidsmelding', 'Nachtregister inrichten'],
  vervoer: ['Vergunning voor personenvervoer', 'Chauffeurskaart(en) regelen', 'Boordcomputer of rittenregistratie'],
  charter: ['Vervoersvergunning controleren', 'Verzekering voor passagiers', 'Onderhoudsprogramma vastleggen'],
  care: ['Kwaliteitseisen en registratie navragen', 'VOG voor iedereen die met clienten werkt', 'Klachtenregeling inrichten'],
  tandarts: ['BIG-registratie controleren', 'Praktijkinrichting laten keuren', 'Klachtenregeling inrichten'],
  dierenarts: ['Registratie als dierenarts controleren', 'Praktijkvergunning navragen', 'Medicijnadministratie inrichten'],
  rijschool: ['Instructeurspas (WRM) controleren', 'Aanmelden bij het CBR', 'Lesvoertuig laten keuren'],
  bouw: ['Inschrijving bij een branchekeurmerk overwegen', 'VCA-certificering voor uzelf en uw mensen', 'Aansprakelijkheid voor werk in uitvoering verzekeren'],
  schoonmaak: ['Werken met gevaarlijke stoffen: veiligheidsbladen op orde', 'Aansprakelijkheidsverzekering voor werk bij derden'],
  hovenier: ['Spuitlicentie als u gewasbescherming gebruikt', 'Afvoer van groenafval regelen'],
  autogarage: ['Erkenning voor APK aanvragen', 'Milieuvergunning voor olie en chemicalien', 'Afvalstoffenregistratie inrichten'],
  wasserij: ['Milieumelding voor water en chemicalien', 'Afvoer van afvalwater regelen'],
  retail: ['Openingstijden bij de gemeente navragen', 'Retour- en garantiebeleid opstellen'],
  modehuis: ['Retour- en garantiebeleid opstellen', 'Herkomst en etikettering van kleding controleren'],
  fotograaf: ['Portretrecht en modelcontracten opstellen', 'Auteursrecht in uw voorwaarden regelen'],
  creator: ['Auteursrecht en licenties in uw voorwaarden regelen'],
  verhuizer: ['Vervoersvergunning controleren', 'Transportverzekering afsluiten'],
  vastgoed: ['Vergunning voor bemiddeling navragen', 'Erfpacht- en huurregels controleren'],
  verhuur: ['Borg- en schadevoorwaarden opstellen', 'Verzekering voor het verhuurde regelen'],
  boerderij: ['Registratie bij de RVO', 'Dier- en perceelregistratie inrichten'],
  ithulp: ['Verwerkersovereenkomst opstellen voor klantdata', 'Aansprakelijkheid voor dataverlies verzekeren'],
  kantoorgebouw: ['Brandveiligheidsmelding', 'Huurcontract en servicekosten vastleggen'],
  activiteiten: ['Evenementenvergunning per activiteit navragen', 'Aansprakelijkheid voor deelnemers verzekeren']
};

/* Wat uit het plan zelf volgt. Elke regel noemt zijn eigen voorwaarde, zodat
   een stap nooit verschijnt zonder dat er iets in de intake staat wat hem
   oproept. */
const SITUATIE = [
  { id: 'samen', stap: 'Samenwerkingsafspraken op papier zetten',
    waarom: 'U onderneemt samen. Wie wat inbrengt, wie beslist en wat er gebeurt als iemand eruit stapt, hoort vast te liggen voordat het misgaat.',
    wanneer: (i) => i.persoon.samen === 'team' },
  { id: 'abonnement', stap: 'Doorlopende voorwaarden en opzegtermijn opstellen',
    waarom: 'Bij een abonnement loopt de afspraak door. Zonder heldere opzegtermijn is elke discussie er een zonder grond.',
    wanneer: (i) => i.idee.verkoopmodel === 'abonnement' },
  { id: 'personeel', stap: 'Loonheffingennummer aanvragen en arbozaken regelen',
    waarom: 'Zodra u iemand in dienst neemt, bent u werkgever met de plichten die daarbij horen.',
    wanneer: (i) => i.persoon.samen === 'team' },
  { id: 'buffer', stap: 'Een buffer opbouwen voor de aanloopmaanden',
    waarom: 'U begint zonder startkapitaal. De eerste maanden kosten geld voordat ze het opleveren.',
    wanneer: (i) => !(Number(i.persoon.startkapitaal) > 0) },
  { id: 'prijslijst', stap: 'Prijzen en algemene voorwaarden publiceren',
    waarom: 'Wat u rekent en waarvoor, hoort vast te staan voordat de eerste klant iets anders begrijpt dan u.',
    wanneer: () => true }
];

const sleutel = (bron, tekst) => bron + ':' + String(tekst).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48);

module.exports = ({ save }) => {

  /* De stappen van deze onderneming, uit de drie bronnen. Puur: hij leest
     alleen en schrijft niets. */
  function stappenVan(o) {
    const rv = RV.rechtsvormVan(o.rechtsvorm);
    if (!rv) return null;
    const i = o.intake || { persoon: {}, idee: {} };
    const persoon = i.persoon || {}, idee = i.idee || {};
    const uit = [];

    for (const s of rv.oprichting) {
      uit.push({ id: sleutel('rechtsvorm', s), stap: s, bron: 'rechtsvorm',
        waarom: 'Hoort bij de ' + rv.label.toLowerCase() + '.' });
    }
    for (const s of (PER_BRANCHE[idee.branche] || [])) {
      uit.push({ id: sleutel('branche', s), stap: s, bron: 'branche',
        waarom: 'Geldt specifiek voor deze branche.' });
    }
    for (const s of SITUATIE) {
      if (s.wanneer({ persoon, idee })) {
        uit.push({ id: sleutel('situatie', s.id), stap: s.stap, bron: 'situatie', waarom: s.waarom });
      }
    }
    return uit;
  }

  /* Het project: de stappen met hun stand erbij.

     Het veld heet `stand` en niet `status`. Dat is geen smaak: `status` betekent
     in elke route van dit huis de HTTP-statuscode (`stuur()` leest hem als
     zodanig), en een projectstand van 'geen-rechtsvorm' in dat veld gaf een
     harde 500 op een verzoek dat verder helemaal klopte. Twee betekenissen op
     een veldnaam is een botsing die je pas ziet als hij afgaat. */
  function oprichtingsproject(o) {
    const stappen = stappenVan(o);
    if (!stappen) {
      return { ok: true, stand: 'geen-rechtsvorm', stappen: [], gedaan: 0, totaal: 0,
        vraag: 'Welke rechtsvorm wordt het?',
        uitleg: 'De helft van wat u moet regelen hangt af van de rechtsvorm. Een lijst zonder die keuze zou compleet lijken en het niet zijn.' };
    }
    const gedaan = (o.oprichting && o.oprichting.gedaan) || {};
    const rijen = stappen.map(s => Object.assign({}, s, { klaar: !!gedaan[s.id], at: gedaan[s.id] || null }));
    const n = rijen.filter(r => r.klaar).length;
    return {
      ok: true, stand: n === rijen.length ? 'compleet' : 'bezig',
      stappen: rijen, gedaan: n, totaal: rijen.length,
      /* Zie de kop: dit staat in het ANTWOORD en niet alleen in de code, want
         het reist mee naar elk scherm dat de lijst toont. */
      voorbehoud: 'Dit is een startlijst, geen juridisch volledige checklist. Wij kennen uw gemeente, uw branchevereniging en de uitzonderingen op uw situatie niet. Controleer bij de KvK en uw gemeente wat er voor u nog bij komt.'
    };
  }

  /* Een stap aan- of afvinken. Alleen stappen die in het project van DEZE
     onderneming voorkomen -- een id uit het lichaam is geen bewijs dat de stap
     bestaat, en anders vult iemand zijn lijst met verzinsels. */
  function oprichtingZet(o, id, klaar) {
    const stappen = stappenVan(o);
    if (!stappen) return { status: 409, error: 'Kies eerst een rechtsvorm.' };
    if (!stappen.some(s => s.id === id)) {
      return { status: 404, error: 'Deze stap hoort niet bij deze onderneming.' };
    }
    if (!o.oprichting) o.oprichting = { gedaan: {} };
    if (!o.oprichting.gedaan) o.oprichting.gedaan = {};
    if (klaar === false) delete o.oprichting.gedaan[id];
    else o.oprichting.gedaan[id] = new Date().toISOString();
    save();
    return Object.assign({ ok: true }, oprichtingsproject(o));
  }

  return { OPRICHTING_BRANCHES: Object.keys(PER_BRANCHE), oprichtingsproject, oprichtingZet };
};

module.exports.PER_BRANCHE = PER_BRANCHE;
module.exports.SITUATIE = SITUATIE;
