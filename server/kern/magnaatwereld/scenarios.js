/* Synthetische trainingsscenario's: alleen inhoud, zonder spelerstatus,
   opslag of productiebevoegdheden. */
const SCENARIOS = {
  planning: {
    titel: 'Live operatie',
    briefing: 'Een lid heeft een wijziging in een lopende reis. Houd de keten rustig, controleer afhankelijkheden en communiceer op codenaam.',
    stappen: [
      { vraag: 'Waar begin je?', opties: ['Meteen alles wijzigen', 'Eerst beschikbaarheid en gevolgen controleren', 'Het dossier doorsturen zonder controle'], juist: 1, uitleg: 'Eerst controleren voorkomt dubbele boekingen en onnodige kosten.' },
      { vraag: 'Welke gegevens gebruik je in de werkruimte?', opties: ['Alleen de codenaam en noodzakelijke reisgegevens', 'Een export met alle paspoortgegevens', 'De volledige betaalhistorie'], juist: 0, uitleg: 'Dataminimalisatie geldt ook in een spoedsituatie.' },
      { vraag: 'Wanneer is de operatie klaar?', opties: ['Na de eerste klik', 'Als alleen de partner akkoord is', 'Na bevestiging, controle van de keten en een duidelijke terugkoppeling'], juist: 2, uitleg: 'Een sluitende keten eindigt met controle én communicatie.' }
    ]
  },
  controle: {
    titel: 'Controlekamer',
    briefing: 'Een synthetisch dossier wijkt af van het normale patroon. Onderzoek het signaal zonder een echte betaling of identiteit te raken.',
    stappen: [
      { vraag: 'Wat betekent een afwijkend signaal?', opties: ['Automatisch fraude', 'Een reden om gecontroleerd te onderzoeken', 'Direct blokkeren voor iedereen'], juist: 1, uitleg: 'Een signaal is een onderzoekspunt, geen oordeel.' },
      { vraag: 'Welke actie is in Magnaat toegestaan?', opties: ['Een echte transactie terugboeken', 'Een echte accountkluis openen', 'De trainingskopie markeren en onderbouwen'], juist: 2, uitleg: 'Magnaat blijft altijd buiten productie.' },
      { vraag: 'Wie beslist over een echte vervolgstap?', opties: ['Een bevoegd mens via de bestaande RTG-controle', 'De speler met de hoogste score', 'De Future Engine zelfstandig'], juist: 0, uitleg: 'Geld, identiteit en productie blijven onder menselijke regie.' }
    ]
  },
  gesprek: {
    titel: 'Servicegesprek',
    briefing: 'Een reiziger vraagt hulp via een beveiligd oefengesprek. Los de vraag menselijk op en deel niet meer gegevens dan nodig.',
    stappen: [
      { vraag: 'Wat is de beste eerste reactie?', opties: ['Een korte ontvangstbevestiging en één gerichte vraag', 'Een standaardtekst zonder de vraag te lezen', 'Om alle persoonsgegevens vragen'], juist: 0, uitleg: 'Een gerichte vraag geeft snelheid zonder onnodige gegevens.' },
      { vraag: 'Waar hoort het gesprek?', opties: ['In het beveiligde RTG-kanaal', 'In een openbaar spelersprofiel', 'In de wereldranglijst'], juist: 0, uitleg: 'Service-inhoud hoort niet in publieke speldata.' },
      { vraag: 'Hoe sluit je af?', opties: ['Zonder bevestiging', 'Met oplossing, volgende stap en duidelijk eigenaarschap', 'Door het dossier stil te verwijderen'], juist: 1, uitleg: 'De reiziger moet weten wat geregeld is en wie verder gaat.' }
    ]
  },
  impact: {
    titel: 'Impactmissie',
    briefing: 'De RTFoundation ziet een kans om een groep beter te bereiken. Bouw een kleine proef die meetbaar, eerlijk en lokaal bruikbaar is.',
    stappen: [
      { vraag: 'Wat kies je eerst?', opties: ['Een concreet probleem met een bereikbare doelgroep', 'Een logo', 'Een zo groot mogelijk budget'], juist: 0, uitleg: 'Impact begint bij een duidelijk probleem en de mensen om wie het gaat.' },
      { vraag: 'Welke meting telt het meest?', opties: ['Alleen het aantal kliks', 'Een vooraf gekozen uitkomst voor de doelgroep', 'Hoe vaak het team vergadert'], juist: 1, uitleg: 'Meet het effect dat de doelgroep daadwerkelijk merkt.' },
      { vraag: 'Wat gebeurt na de proef?', opties: ['Altijd wereldwijd uitrollen', 'Resultaten en risico’s laten beoordelen', 'De uitkomst geheimhouden'], juist: 1, uitleg: 'De proef levert bewijs; een mens beslist over het vervolg.' }
    ]
  },
  operatie: {
    titel: 'Werkvloer onder druk',
    briefing: 'Een RTG-partner krijgt tegelijk meer vraag, een roosterprobleem en een kwaliteitsmelding. Breng rust in de operatie.',
    stappen: [
      { vraag: 'Wat pak je eerst vast?', opties: ['De grootste veiligheids- of klantimpact', 'De makkelijkste taak', 'Een willekeurige melding'], juist: 0, uitleg: 'Prioriteren gebeurt op risico en impact.' },
      { vraag: 'Hoe test je de oplossing?', opties: ['Direct bij alle zaken', 'In een afgebakende trainingssituatie met succescriteria', 'Zonder meetpunt'], juist: 1, uitleg: 'Klein en meetbaar testen beperkt schade en levert beter bewijs.' },
      { vraag: 'Wat leg je vast?', opties: ['Besluit, reden, resultaat en eigenaar', 'Alleen de eindscore', 'Niets; het was maar een oefening'], juist: 0, uitleg: 'Een goed logboek maakt leren en verantwoorden mogelijk.' }
    ]
  },
  puzzel: {
    titel: 'Productpuzzel',
    briefing: 'Een gebruiker loopt vast in een RTG-proces. Leg de juiste functie op het juiste moment in de keten.',
    stappen: [
      { vraag: 'Wat is een sterke eerste stap?', opties: ['Het gebruikersdoel vaststellen', 'Meer knoppen toevoegen', 'De fout verbergen'], juist: 0, uitleg: 'Het doel bepaalt welke functie werkelijk nodig is.' },
      { vraag: 'Welke oplossing heeft de voorkeur?', opties: ['De kleinste veilige stap die het probleem oplost', 'De grootste mogelijke verbouwing', 'Een los proces buiten RTG'], juist: 0, uitleg: 'Klein, veilig en geïntegreerd maakt een functie beheersbaar.' },
      { vraag: 'Wanneer is de puzzel geslaagd?', opties: ['Als de knop werkt', 'Als de taak aantoonbaar lukt en de grensgevallen zijn getest', 'Als het scherm mooi is'], juist: 1, uitleg: 'Functionaliteit omvat ook bewijs en grensgevallen.' }
    ]
  }
};

module.exports = SCENARIOS;
