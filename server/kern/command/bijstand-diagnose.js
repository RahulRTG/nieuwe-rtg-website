/* WAT EEN BIJSTANDSSESSIE TE ZIEN GEEFT -- en, belangrijker, wat er dicht blijft.

   DE REGEL IS STRUCTUUR WEL, INHOUD NIET. Wie een mailmodule repareert, hoeft
   geen mails te kunnen lezen. Wat een monteur nodig heeft is de vorm van het
   probleem: hoeveel werkruimtes, welke levensloopstand, welk contract, welke
   platformvermogens haperen, welk incident er loopt. Dat is allemaal te geven
   zonder één gegeven van een klant aan te raken.

   DRIE LAGEN, EN DE DERDE BESTAAT NIET:

     1. altijd      structuur, tellingen, toestanden, en de platformstand
     2. na akkoord  de NAMEN van werkruimtes en groepen -- inrichting, geen mensen
     3. nooit       de identiteitskluis, persoonsgegevens, berichten, bestanden

   Die derde laag is geen strengheid maar bouw. De echte namen achter een
   codenaam staan in server/accounts.js achter een eigen poort met een verplichte
   reden, een regel in het inzagejournaal en bericht aan de betrokkene; die deur
   loopt niet door deze laag en er is hier geen sleutel voor. Een supportsessie
   die persoonsgegevens kan opvragen, zou die hele opzet omzeilen.

   EN WAT ER NIET IN ZIT, STAAT IN HET ANTWOORD. `nooit` is een lijst met een
   reden per post, net als `nietGemeten` bij een incident. Een diagnose die alleen
   toont wat hij wél heeft, laat de lezer denken dat dat alles is. */
'use strict';

const NOOIT = [
  { wat: 'de echte namen achter de codenamen',
    waarom: 'die staan in de identiteitskluis (server/accounts.js) achter een eigen poort met een verplichte ' +
      'reden, een regel in het inzagejournaal en bericht aan de betrokkene. Die deur loopt niet door een ' +
      'supportsessie, en er is hier geen sleutel voor.' },
  { wat: 'persoonsgegevens van medewerkers of leden',
    waarom: 'dit is een diagnose van een ORGANISATIE en niet van de mensen erin. Wie een personeelsdossier ' +
      'nodig heeft, heeft geen supportsessie nodig maar een grondslag.' },
  { wat: 'de inhoud van berichten, bestanden en documenten',
    waarom: 'voor het herstellen van een koppeling is de vorm genoeg: een toestand, een teller, een ' +
      'foutmelding. De inhoud voegt daar niets aan toe behalve risico.' }
];

const HOOFDSTUKKEN = ['stand', 'inrichting', 'platform'];

function maakDiagnose({ tenant, gezondheid, incident }) {
  /* Lui, om dezelfde reden als in ./bijstand.js. */
  const T = () => (typeof tenant === 'function' ? tenant() : tenant) || {};
  const veilig = (doe, waarom) => {
    try { const w = doe(); return w == null ? { nietTeLezen: waarom } : w; }
    catch (e) { return { nietTeLezen: waarom + ' (' + e.message + ')' }; }
  };

  /* De organisatie zoals RTG hem ALTIJD mag zien: hoeveel, welke stand, welk
     contract. Geen naam van een mens, geen enkele rij uit haar gegevens. */
  /* Zelfde onderscheid als in ./vlootbeeld.js: een organisatie die niet bestaat
     is iets anders dan een register dat niet te lezen is. */
  function stand(org) {
    let t;
    try { t = T().register.haal(org); }
    catch (e) { return { nietTeLezen: 'het tenantregister is niet te lezen (' + e.message + ')' }; }
    if (!t) return { bestaatNiet: 'die organisatie kennen we niet' };
    return {
      org: t.org, naam: t.naam, modus: t.modus, actief: t.actief !== false,
      aantallen: { werkruimtes: (t.werkruimtes || []).length, zaken: (t.zaken || []).length,
        groepen: (t.groepen || []).length },
      levensloop: veilig(() => T().levensloop && T().levensloop.stand(org),
        'deze installatie kent geen levensloop voor deze organisatie'),
      bewijs: veilig(() => T().bewijs && T().bewijs.stand(org),
        'de bewijsstand is niet te lezen')
    };
  }

  /* De inrichting: NAMEN van werkruimtes en groepen. Dit is configuratie en geen
     mens -- en toch staat het achter een akkoord, omdat een groepsnaam ("Directie
     Rotterdam") wel degelijk iets over een organisatie zegt. */
  function inrichting(org, magInhoud) {
    if (!magInhoud) {
      return { dicht: true,
        waarom: 'de namen van werkruimtes en groepen zijn inrichting en geen structuur. Ze gaan pas open ' +
          'met een apart, gemotiveerd verzoek dat de organisatie heeft goedgekeurd.' };
    }
    let t;
    try { t = T().register.haal(org); }
    catch (e) { return { nietTeLezen: 'het tenantregister is niet te lezen (' + e.message + ')' }; }
    if (!t) return { bestaatNiet: 'die organisatie kennen we niet' };
    return { dicht: false,
      werkruimtes: (t.werkruimtes || []).slice(),
      zaken: (t.zaken || []).slice(),
      groepen: (t.groepen || []).map(g => ({ groep: g.groep, rol: g.rol, werkruimte: g.werkruimte })),
      let: 'Ook hier staan geen mensen in. Wie in welke groep zit, is een vraag aan de identiteitslaag en ' +
        'niet aan deze diagnose.' };
  }

  /* Het platform. Dit is GEEN cijfer over deze klant: de meting telt per
     routepatroon en draagt geen tenant, dus een storing bij ons is niet
     hetzelfde als een storing bij hem. Die zin staat in het antwoord. */
  function platform() {
    const g = veilig(() => gezondheid.stand(), 'de gezondheidskaart is niet te lezen');
    if (g.nietTeLezen) return g;
    return {
      oordeel: g.oordeel, tel: g.tel,
      vermogens: g.vermogens.map(v => ({ id: v.id, naam: v.naam, oordeel: v.oordeel, graad: v.graad,
        mens: v.taal ? v.taal.mens : null })),
      incidenten: veilig(() => incident.lijst({ max: 10 }), 'de incidenten zijn niet te lezen'),
      let: 'Dit is de stand van het PLATFORM en niet van deze organisatie. De meting telt per routepatroon ' +
        'en draagt geen tenant; een storing hier is dus geen bewijs dat deze klant er iets van merkte, en ' +
        'groen hier is geen bewijs dat hij niets merkte.'
    };
  }

  /* Eén ingang, zodat het spoor van de klant kan zeggen WAT er is bekeken. Een
     sessie waarin "de medewerker keek rond" staat, is geen zichtbaarheid. */
  function voor(org, o) {
    const opt = o || {};
    const wat = HOOFDSTUKKEN.includes(String(opt.wat)) ? String(opt.wat) : 'stand';
    const uit = { org: String(org), hoofdstuk: wat, hoofdstukken: HOOFDSTUKKEN,
      inhoudOpen: !!opt.inhoud, nooit: NOOIT };
    if (wat === 'stand') { uit.stand = stand(org); uit.watIkKeek = 'de stand van de organisatie'; }
    else if (wat === 'inrichting') { uit.inrichting = inrichting(org, !!opt.inhoud); uit.watIkKeek = 'de inrichting'; }
    else { uit.platform = platform(); uit.watIkKeek = 'de platformstand'; }
    return uit;
  }

  return { voor, stand, inrichting, platform, NOOIT, HOOFDSTUKKEN };
}

module.exports = { maakDiagnose, NOOIT, HOOFDSTUKKEN };
