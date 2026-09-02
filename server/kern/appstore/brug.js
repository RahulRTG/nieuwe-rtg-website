/* ============================================================================
   DE BRUG -- de ENIGE weg van een app van derden naar RTG.

   In de cel heeft een app geen netwerk (de CSP van de celroute zet connect-src
   op 'none') en geen toegang tot het venster erboven (de iframe draait met
   sandbox="allow-scripts" en dus op een naamloze herkomst). Wat overblijft is
   een postMessage naar de celpagina, en die komt hier uit.

   DRIE CONTROLES, IN DEZE VOLGORDE, EN GEEN ERVAN IS OVER TE SLAAN.

     1. IS DIT EEN BESTAANDE METHODE? Zo niet: een fout die de bestaande methodes
        noemt. Niet "onbekend"; een uitgever hoort niet te hoeven raden.
     2. IS DE BIJBEHORENDE MACHTIGING VERLEEND? Niet gevraagd -- VERLEEND. De
        brug leest de lijst van het lid, niet die van het manifest. Dat is
        grens 4, en dit is de enige plek waar hij bestaat.
     3. PAST HET BINNEN DE GRENZEN VAN DIE MACHTIGING? Elke methode draagt zijn
        eigen maten, en die worden hier gerekend en niet vertrouwd.

   WAT HIER NOOIT DOORHEEN KOMT, ONGEACHT WELKE MACHTIGING ER IS VERLEEND: de
   echte naam van een lid, zijn e-mailadres, zijn telefoonnummer, zijn adres en
   zijn geboortedatum. Die staan in de identiteitskluis (accounts.js) en deze
   module heeft er geen verwijzing naartoe -- niet omdat het niet mag, maar zodat
   het niet KAN. Wie het er alsnog bij zou zetten, moet er een require voor
   schrijven, en dat is een regel die opvalt in een diff.
   ========================================================================== */
'use strict';

const fout = require('../platformfout');

const GRENS = {
  opslagSleutels: 32,
  opslagSleutelLengte: 64,
  opslagWaarde: 4096,
  opslagTotaal: 64 * 1024,
  berichtLengte: 240,
  berichtenPerDag: 5,
  bakGrootte: 20,
  roepenPerMinuut: 120
};

function maakBrug(kern) {
  const { S, eigen, nu, boek, arena } = kern;
  const save = kern.save;
  /* De meter. Hij telt aanroepen en weigeringen per app per dag en weet met
     opzet NIET welk lid er aanroept -- deze functie geeft hem alleen de
     appsleutel en de foutcode mee (kern/appstore/meting.js). */
  const meting = require('./meting').maakMeting({ S, save, nu });

  /* De rem staat in het geheugen en niet in de database: een teller die per
     aanroep wordt weggeschreven, maakt van een rem een schrijfstorm. Hij gaat bij
     een herstart verloren, en dat is hier goed -- een herstart is geen aanval. */
  const remmen = new Map();
  function rem(sleutel, max, venster) {
    const t = Date.parse(nu());
    const r = remmen.get(sleutel);
    if (!r || t - r.begin > venster) { remmen.set(sleutel, { begin: t, n: 1 }); return false; }
    r.n += 1;
    if (remmen.size > 20000) remmen.clear();
    return r.n > max;
  }

  const bak = (pot, a, b) => {
    const p = S()[pot];
    if (!p[String(a)] || typeof p[String(a)] !== 'object') p[String(a)] = {};
    const r = p[String(a)];
    if (!r[String(b)]) r[String(b)] = pot === 'bakjes' ? [] : {};
    return r[String(b)];
  };

  /* DE METHODETABEL staat in ./brugmethodes.js. Dat is een naad en geen
     opdeling om de omvang: die tabel is het CONTRACT met een derde -- wat een
     app kan vragen en wat hij dan terugkrijgt -- terwijl de rest van dit bestand
     de POORT is: de rem, de machtigingscontrole, het weigeren en het tellen. Wie
     wil weten wat een app mag, leest een tabel; wie wil weten of hij erdoor
     komt, leest dit. */
  const METHODES = require('./brugmethodes').maakMethodes({ GRENS, bak, nu, save, arena });

  /* DE MUTATIEPOORT, en hij staat hier omdat dit de RAND van het platform is:
     alles in METHODES is publiek aanroepbaar door code van een derde. Een
     methode zonder mutatieklasse laat de server niet starten -- en dat is met
     opzet strenger dan een foutmelding bij het eerste verzoek, want dan zou een
     bouwfout pas opvallen als een lid hem tegenkomt (kern/mutatie.js). */
  require('../mutatie').poort(METHODES, 'de brug van de App Store');

  const namen = Object.keys(METHODES);

  /* De aanroep zelf. `ctx` komt van de route en niet van de app: de app noemt
     alleen een methode en argumenten. Wie hij is, welke app dit is en wat er is
     verleend, wordt hier bepaald uit de sessie. */
  /* Alle uitgangen van roep() lopen langs deze functie, zodat er precies EEN
     plek is waar wordt geteld. Zou er per tak worden geteld, dan is de eerste
     tak die iemand later toevoegt de tak die niet meetelt (LAT-regel 5). */
  function uitkomst(sleutel, r) {
    try { meting.tel(sleutel, r && r.code ? r.code : null); } catch (e) {}
    return r;
  }

  function roep(opdracht) {
    const { key, sleutel, methode, args, codenaam, taal, pas, verleend, vraagt } = opdracht;
    return uitkomst(sleutel, roepKaal({ key, sleutel, methode, args, codenaam, taal, pas, verleend, vraagt }));
  }

  function roepKaal({ key, sleutel, methode, args, codenaam, taal, pas, verleend, vraagt }) {
    const naam = String(methode || '');
    const m = Object.prototype.hasOwnProperty.call(METHODES, naam) ? METHODES[naam] : null;
    if (!m) return fout.maak('RTG_METHODE_ONBEKEND', 'De methode "' + naam + '" bestaat niet. Er zijn er ' + namen.length + ': ' + namen.join(', ') + '.', { methode: naam, methodes: namen });
    const heeft = Array.isArray(verleend) ? verleend : [];
    if (!heeft.includes(m.machtiging)) {
      /* EEN WEIGERING DIE UITLEGT, en dat is geen vriendelijkheid maar
         gereedschap. "403 Forbidden" laat een uitgever raden tussen vier
         oorzaken: vroeg ik het verkeerde, vroeg ik het niet, gaf het lid het
         niet, of trok hij het terug? Elk van die vier heeft een andere
         oplossing, en drie ervan zijn niets waar hij iets aan kan doen.

         Daarom staat er wat er nodig was, wat dit lid WEL heeft gegeven, en waar
         hij het kan veranderen. Dat laatste is het belangrijkste: het lid, niet
         de uitgever, en niet RTG. */
      const gevraagdMaarNietGegeven = Array.isArray(vraagt) && vraagt.includes(m.machtiging);
      return fout.maak(gevraagdMaarNietGegeven ? 'RTG_MACHTIGING_NIET_VERLEEND' : 'RTG_MACHTIGING_NIET_GEVRAAGD',
        'De methode "' + naam + '" vraagt de machtiging "' + m.machtiging + '". '
          + (gevraagdMaarNietGegeven
              ? 'Je app vraagt hem in zijn manifest, maar dit lid heeft hem niet verleend of weer ingetrokken.'
              : 'Je app vraagt hem niet in zijn manifest, dus het lid heeft hem ook nooit kunnen geven.'),
        { methode: naam,
        machtiging: m.machtiging,
        verleend: heeft,
        gevraagd: Array.isArray(vraagt) ? vraagt : null,
        hoe: gevraagdMaarNietGegeven
          ? 'Alleen het lid kan dit aanzetten, in de App Store onder "wat mag deze app". Vraag het niet nog eens via de brug; werk zonder deze machtiging verder.'
          : 'Zet hem in het manifest van een volgende versie, met een doel. Die versie gaat opnieuw langs de keuring, en het lid beslist opnieuw.' });
    }
    if (rem('roep:' + sleutel + ':' + key, GRENS.roepenPerMinuut, 60000)) {
      return fout.maak('RTG_TE_VEEL_AANROEPEN', 'Meer dan ' + GRENS.roepenPerMinuut + ' aanroepen per minuut houdt de brug tegen.', { methode: naam, perMinuut: GRENS.roepenPerMinuut });
    }
    let uit;
    try { uit = m.doe({ key, sleutel, codenaam, taal, pas }, args || {}); }
    catch (e) { return fout.maak('RTG_BRUG_FOUT', 'De brug kon deze aanroep niet uitvoeren.', { methode: naam }); }
    if (uit && uit.fout) return fout.maak('RTG_ARGUMENT_ONGELDIG', uit.fout, { methode: naam });
    return { status: 200, ok: true, uit };
  }

  /* De LEES-kant van de bakjes staat in ./bakjes.js. Dat is de naad die hier al
     als alinea stond: een app SCHRIJFT een bericht via de brug, maar mag nooit
     zien of het gelezen is -- anders is een bericht een baken. */
  const { bakje, bakjeGelezen, bakjes } = require('./bakjes')({ S, save, eigen, bak, GRENS });

  /* De classificatie zelf gaat mee naar buiten, en niet alleen de namen: de SDK,
     de documentatie en een taakloper moeten kunnen LEZEN wat een tweede aanroep
     doet. Stond dat alleen in de definitie hierboven, dan moest ieder van die
     drie het opnieuw afleiden (LAT-regel 4). */
  const mutaties = require('../mutatie').overzicht(METHODES);

  /* WELKE MACHTIGING BIJ WELKE METHODE HOORT, uit de draaiende tabel.

     Dit stond er niet, en dat had een gevolg: ./naslag.js las het door de BRON
     van dit bestand met een regex uit te kammen. Dat werkte tot de tabel
     verhuisde -- en een naslagwerk dat stukgaat op een bestandsverhuizing, leest
     geen code maar tekst. Nu komt het uit hetzelfde object dat ook de aanroepen
     afhandelt, dus het kan niet meer uiteenlopen (LAT-regel 4). */
  const machtigingen = {};
  for (const n of namen) machtigingen[n] = METHODES[n].machtiging;

  return { roep, bakje, bakjeGelezen, bakjes, METHODES: namen, machtigingen, mutaties, GRENS, boek, meting, arena };
}

module.exports = { maakBrug, GRENS };
