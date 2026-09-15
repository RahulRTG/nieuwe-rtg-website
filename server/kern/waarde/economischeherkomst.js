/* DE ECONOMISCHE HERKOMST VAN EEN GELDRIJ -- waar kwam deze euro vandaan, aan
   wie komt hij toe, en waar gaat hij heen.

   WAAROM DIT GEEN VELD `herkomst: 'partner'` IS. Dat was de eerste ingeving en
   hij sneuvelt op een voorbeeld van een regel:

     Een klant betaalt EUR 800. Daarvan komt EUR 550 economisch toe aan een
     hotel. RTG INT het hele bedrag en keert die 550 later uit.

   Wie daar alleen `herkomst: 'klant'` van bewaart, kan later niet zeggen van
   wie het geld was. Wie alleen `herkomst: 'partner'` bewaart, kan niet zeggen
   wie het betaald heeft. En wie een van beide uit de ander AFLEIDT, verzint de
   helft. Er zijn dus DRIE vragen en geen een:

     economischeHerkomst   van wie kwam de waarde
     economischeEigenaar   aan wie komt hij economisch toe
     naarWie               waar gaat het geld feitelijk heen

   Ze vallen vaak samen en ze zijn NOOIT hetzelfde veld. In het voorbeeld
   hierboven zijn ze alle drie verschillend, en dat is geen randgeval maar de
   normale vorm van een reis.

   ONBEKEND IS EEN UITKOMST EN NOOIT EEN AANNAME. Dat is de regel waar deze
   module op staat, en hij is asymmetrisch gevaarlijk: een bedrag dat ten
   onrechte op `derde` staat verlaagt de bijdragebasis, een bedrag dat ten
   onrechte op `rtg` staat verhoogt hem. Allebei onzichtbaar, allebei in het
   voordeel van iemand. Deze module RAADT daarom niets:

     - een veld dat niet wordt meegegeven, is ONBEKEND en wordt niet afgeleid;
     - `economischeEigenaar` wordt NOOIT uit `economischeHerkomst` gehaald;
     - een onbekende partijsoort wordt ONBEKEND en niet "waarschijnlijk derde".

   WAAROM `bestemming` HIER NIET STAAT. Dat woord is in dit huis 167 bestanden
   lang een REISbestemming (waar de reiziger heen gaat). Een tweede betekenis
   voor "waar het geld heen gaat" op de centrale naam van een reisbedrijf is de
   VERMOGENS-botsing uit SEMANTIEK.json. Vandaar `naarWie`, dat vrij was.
   `grond` heet wel zo, want kern/waarde/klassen.js gebruikt dat al voor precies
   deze relatie: de rechtvaardiging. Dat is consistentie en geen overbelasting.

   WAT DIT NOG NIET IS. Dit is de PRIMITIEF en niet de migratie. Van de 208
   geldvormen in dit huis dragen er 26 een aantoonbare herkomst (DOORBELASTING.json);
   die 182 andere gaan hier niet vanzelf op over. Wat deze module levert is de
   vorm waarin een geldrij het WEL kan dragen, plus het oordeel of een gegeven
   rij te volgen is. De ratel eromheen (volgbaar alleen omhoog, onbekend alleen
   omlaag) maakt daar een migratiepad van in plaats van een big bang. */
'use strict';

/* De enige waarde die "wij weten het niet" betekent. Een lege string, null en
   undefined worden hier allemaal naartoe genormaliseerd, zodat er maar EEN
   manier is om onwetendheid op te schrijven -- drie manieren zou betekenen dat
   een teller er twee mist. */
const ONBEKEND = 'onbekend';

/* DE PARTIJSOORTEN. Gesloten lijst, want een open lijst laat een typefout als
   nieuwe soort binnen en die telt dan nergens mee.

   `rtg` en `derde` zijn met opzet de enige twee die economisch iets BETEKENEN
   voor een bijdragebasis; de rest zegt wie er aan de andere kant van de tafel
   zat. Een `lid` is bijvoorbeeld nooit een economische eigenaar van omzet -- hij
   is de herkomst ervan. */
const SOORTEN = Object.freeze({
  rtg: 'RTG zelf, of een onderdeel daarvan',
  derde: 'een leverancier, hotel, vervoerder of andere partij buiten RTG',
  lid: 'een particulier lid van RTG',
  gast: 'een niet-lid dat via het partnerkanaal koopt',
  zaak: 'een onderneming met een leverancierscontract',
  overheid: 'een belastingdienst of andere heffende instantie',
  psp: 'een betaaldienstverlener',
  onbekend: 'niet vastgesteld -- een uitkomst en nooit een aanname'
});

const isSoort = (s) => Object.prototype.hasOwnProperty.call(SOORTEN, String(s || ''));

/* Normaliseren naar precies EEN vorm van onwetendheid. Een onbekende soort valt
   hier op `onbekend` en niet op een gok: wie hier `derde` van zou maken omdat
   het "meestal zo is", schrijft een bijdragebasis die niemand kan verdedigen. */
function soort(waarde) {
  const s = String(waarde == null ? '' : waarde).trim().toLowerCase();
  if (!s) return ONBEKEND;
  return isSoort(s) ? s : ONBEKEND;
}

const tekst = (v, max) => {
  const s = String(v == null ? '' : v).trim();
  return s ? s.slice(0, max || 120) : null;
};

/* EEN BEDRAG DAT GEEN GETAL IS, IS ONBEKEND -- EN NIET NUL. Dat staat hierboven
   als regel en het ging er hieronder bijna fout, want `Number()` is daar precies
   de verkeerde weg voor:

     Number(null)   = 0     Number('')   = 0     Number('   ') = 0
     Number([])     = 0     Number(true) = 1     Number([5000]) = 5000

   Vijf van die zes zijn ONWETENDHEID die als een BEDRAG terugkomt, en de zesde
   is een lijst die zich voordoet als een getal. Nul is een bedrag (een regel van
   nul euro bestaat); niets weten is dat niet, en het verschil is precies wat de
   onbekende post moet tellen. `Number.isFinite` vangt dit niet af, want die
   kijkt naar de UITKOMST van de omzetting en die is dan al nul.

   Vandaar dat hier de INVOER wordt beoordeeld en niet de uitkomst: alleen een
   echt getal telt, en een string alleen als er na het trimmen iets overblijft. */
function centenVan(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : null;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  /* null, undefined, booleans, objecten en lijsten: geen van alle een bedrag. */
  return null;
}

/* ---------- de geldrij ----------
   Tien velden, en geen elfde zonder besluit. De vorm is met opzet plat: een
   geldrij die zelf objecten BEZIT is de Asset-fout in het klein, en dit is een
   ETIKET op een bedrag en geen eigenaar van de handeling eromheen. */
function geldrij(o) {
  const b = o || {};
  const centen = centenVan(b.bedragCenten);

  return Object.freeze({
    /* Het bedrag blijft een geheel getal in de KLEINSTE eenheid van zijn
       valuta; wat dat betekent staat in kern/payroll/valuta.js en wordt hier
       niet overgetypt. Een bedrag dat geen getal is, is ONBEKEND -- niet nul,
       want nul is een bedrag en onwetendheid niet (zie centenVan hierboven). */
    bedragCenten: centen,
    valuta: tekst(b.valuta, 3) ? String(b.valuta).toUpperCase().slice(0, 3) : null,

    /* De drie die nooit samenvallen mogen worden. */
    economischeHerkomst: soort(b.economischeHerkomst),
    economischeEigenaar: soort(b.economischeEigenaar),
    naarWie: soort(b.naarWie),

    /* Waarom dit geld beweegt. `grond` in de betekenis van kern/waarde/klassen.js:
       de rechtvaardiging, niet de fiscale grondslag uit kern/fiscaal. */
    grond: tekst(b.grond, 200),

    /* Waar dit vandaan te herleiden is. Een VERWIJZING en nooit een kopie van
       het object -- dezelfde regel die REIZEN.md voor een reisonderdeel trekt. */
    bronObject: tekst(b.bronObject, 80),
    relatie: tekst(b.relatie, 80),
    land: tekst(b.land, 2) ? String(b.land).toUpperCase().slice(0, 2) : null,
    bewijs: tekst(b.bewijs, 200)
  });
}

/* ---------- is deze rij te volgen? ----------
   VOLGBAAR betekent precies een ding: van deze euro is vast te stellen waar hij
   vandaan kwam EN aan wie hij toekomt. Dat zijn de twee die een bijdragebasis
   nodig heeft; `naarWie` mag onbekend zijn zonder dat de basis eronder lijdt
   (geld dat nog niet is uitgekeerd, is nog steeds van iemand).

   Een bedrag moet er ook zijn: een rij zonder bedrag is geen geldrij. */
function volgbaar(rij) {
  if (!rij || rij.bedragCenten == null) return false;
  return rij.economischeHerkomst !== ONBEKEND && rij.economischeEigenaar !== ONBEKEND;
}

/* Waarom niet -- want een nee zonder reden is bij een geschil niets waard. */
function waaromNietVolgbaar(rij) {
  if (!rij) return 'geen rij';
  if (rij.bedragCenten == null) return 'geen bedrag: dit is geen geldrij';
  const mist = [];
  if (rij.economischeHerkomst === ONBEKEND) mist.push('economischeHerkomst');
  if (rij.economischeEigenaar === ONBEKEND) mist.push('economischeEigenaar');
  if (!mist.length) return null;
  return 'onbekend: ' + mist.join(' en ') +
    ' -- en die worden niet geraden, want een fout naar `derde` verlaagt de bijdragebasis ' +
    'en een fout naar `rtg` verhoogt hem';
}

module.exports = { ONBEKEND, SOORTEN, isSoort, soort, geldrij, volgbaar, waaromNietVolgbaar };
