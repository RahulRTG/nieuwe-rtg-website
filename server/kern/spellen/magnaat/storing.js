/* Magnaat: EEN STORING -- iets dat kapot is en dat zo blijft tot iemand het
   oplost.

   DIT IS GEEN SPELBEGRIP EN DAAROM HEET HET BESTAND NIET `rush-...`. Een
   storing is een FEIT OVER EEN BEDRIJF, net als achterstallig onderhoud: hij
   staat op de vestiging (`v.storingen`), hij werkt door in de maand via posten
   die er al waren, en hij blijft bestaan of er nu iemand speelt of niet. De
   werkvloer (./rush.js) is een van de plekken waar hij ontstaat en wordt
   opgelost -- niet de plek waar hij WOONT.

   DAT ONDERSCHEID DRAAGT WET 4, en dat is de reden dat het zo streng staat.
   VERHAAL.md par. 0f belooft: geen inhaalschuld, geen straf voor afwezigheid.
   Zou een achtergelaten noodoplossing een SCHULD VAN DE SPELER zijn, dan is
   niet spelen ineens duurder dan spelen en is die belofte gebroken. Hij is dus
   een EIGENSCHAP VAN DE ZAAK: wie morgen begint, erft de wereld zoals hij is --
   met een koeling die het niet doet. Dat is geen schuld maar een ochtend.

   Precies zo werkt `v.onderhoud` in ./stap.js al: *onderhoud zakt vanzelf; wie
   het laat zakken bespaart nu en betaalt later*. Een storing is dat mechaniek
   met een naam en een datum erbij.

   DRIE STATEN, EN ELK KOST IETS ANDERS. Dat is de hele economische les van de
   vakkracht: er is geen gratis uitweg, alleen een andere rekening.

     open         er bederft waar. De duurste stand, en de stand waar hij
                  vanzelf in blijft als niemand iets doet.
     workaround   je hebt het opgelost met mankracht -- iemand sjouwt de hele
                  avond. Het bederf stopt grotendeels; het WERK niet, dus de
                  vaste lasten lopen op. En hij houdt niet eeuwig: een
                  noodoplossing valt na een paar maanden terug op `open`.
     uit          je neemt de capaciteit uit bedrijf. Niets bederft meer, maar
                  je kunt minder aan -- dus minder omzet, en een contract dat je
                  getekend hebt komt in de knel.

   Repareren is geen stand maar een HANDELING: de storing verdwijnt en er staat
   een bedrag op de maandrekening. Buiten kantooruren, dus duurder dan gepland
   onderhoud -- dat is waarom uitstellen aantrekkelijk lijkt.

   ALLES LOOPT DOOR POSTEN DIE ER AL WAREN (par. 0f wet 3): derving, vaste
   lasten, capaciteit en onderhoud. Er komt geen regel bij, er komt geen valuta
   bij, en scripts/magnaat-pomp.js hoort er niets van te merken behalve dat er
   minder of meer geld de wereld uit gaat. */
'use strict';

const { onderhoudsnorm } = require('./maat');

/* Hoe lang een noodoplossing het houdt. Niet oneindig, want dan is een
   workaround een gratis reparatie met een andere naam -- en dan is de keuze van
   de vakkracht geen keuze. */
const WORKAROUND_MAANDEN = 4;

const SOORTEN = {
  koeling: {
    naam: 'Koeling B', sector: 'horeca',
    /* Wat elke stand met de maand doet. De getallen zijn FACTOREN op posten die
       ./stap.js al rekent; `1` is "onveranderd" en dus onzichtbaar. */
    /* DE GETALLEN ZIJN GEMETEN EN NIET GERADEN (scripts/magnaat-storing.js).
       De eerste ronde deugde niet: `uit` kostte een volle zaak 28% van zijn
       resultaat om 6% bederf te vermijden, en dan is het nooit een uitweg maar
       een strafknop. Wat er nu staat maakt de vier uitwegen vergelijkbaar
       genoeg dat de SITUATIE beslist welke goed is. */
    open: { derving: 1.90, vast: 1, capaciteit: 1 },
    workaround: { derving: 1.15, vast: 1.05, capaciteit: 1 },
    /* UIT BEDRIJF IS SITUATIONEEL, en dat is met opzet de mooiste van de vier:
       in een zaak die tegen zijn plafond draait kost acht procent capaciteit een
       vermogen, in een rustige zaak kost het niets. Dezelfde knop, een ander
       antwoord -- afhankelijk van hoe vol je zit. */
    /* UIT BEDRIJF ZAKT NOOIT ONDER DE BASIS. Hij stond even op 0,90 -- dan
       bederft er MINDER dan in een gezonde zaak -- en in een rustige zaak leverde
       een kapotte koeling daarmee geld op. Dat is waarde uit het niets in de
       kleinste denkbare vorm: een storing hoort nooit een verbetering te zijn.
       De basisderving gaat over de hele operatie en niet over dit ene apparaat. */
    uit: { derving: 1, vast: 1, capaciteit: 0.92 },
    /* Wat repareren kost, als deel van de maandelijkse onderhoudsnorm van de
       zaak (./stap.js `nodig`). Ruim boven een gewone onderhoudsbeurt, want dit
       is spoed. */
    spoed: 3.5,
    /* En wat het OPLEVERT: de staat van het pand gaat vooruit, want er is
       werkelijk iets gemaakt. Zonder dit is repareren alleen een rekening. */
    herstel: 5
  }
};

/* WELK WERELDVOORVAL WELKE STORING ACHTERLAAT. Dit is de plek waar punt 2 van
   de opdracht binnenkomt, en hij voegt met opzet GEEN nieuw toeval toe: een
   machinebreuk gaat in ./risico.js al deterministisch af, kost al omzet en is
   al in de balans meegewogen. Wat er verandert is dat hij nu iets ACHTERLAAT in
   plaats van alleen een rekening te sturen.

   Zou er een eigen storingskans bijkomen, dan was er een tweede gebeurtenislaag
   naast ./risico.js -- twee plekken waar de wereld stukgaat, die uit elkaar
   gaan lopen. Nu is er een. */
const UIT_RISICO = { machinebreuk: 'koeling' };

const lijst = (v) => (v.storingen = v.storingen || []);
const openstaand = (v) => lijst(v).filter(s => s.staat !== 'weg');
const heeft = (v, soort) => openstaand(v).some(s => s.soort === soort);
const vind = (v, soort) => openstaand(v).find(s => s.soort === soort) || null;

/* Een storing ontstaat. Twee keer dezelfde storing bestaat niet: een koeling
   die al stuk is, gaat niet nog een keer stuk. */
function ontstaat(v, soort, maand) {
  if (!SOORTEN[soort] || heeft(v, soort)) return null;
  const s = { soort, staat: 'open', sinds: maand, sindsStand: maand };
  lijst(v).push(s);
  return s;
}

/* Wat een wereldvoorval bij deze zaak achterlaat, of niets. */
function uitVoorval(v, risico, maand) {
  const soort = UIT_RISICO[risico];
  if (!soort) return null;
  const t = SOORTEN[soort];
  if (!t || (t.sector && t.sector !== v.sector)) return null;
  return ontstaat(v, soort, maand);
}

/* Een stand zetten. `weg` betekent opgelost; hij blijft in de lijst staan zodat
   ./rush-nalaten.js kan zien DAT het gebeurd is, en wordt bij het opruimen
   verwijderd. */
function zet(v, soort, staat, maand) {
  const s = vind(v, soort);
  if (!s) return null;
  s.staat = staat;
  s.sindsStand = maand;
  return s;
}

/* WAT DE MAAND ERVAN MERKT: de drie factoren, opgeteld over alles wat er stuk
   is. Ze VERMENIGVULDIGEN, want twee dingen die allebei kapot zijn maken het
   niet minder erg -- en een zaak zonder storingen krijgt exact 1, 1, 1 en
   rekent dus precies zoals voor deze laag. */
function effect(v) {
  const uit = { derving: 1, vast: 1, capaciteit: 1 };
  for (const s of openstaand(v)) {
    const soort = SOORTEN[s.soort];
    const f = soort && soort[s.staat];
    if (!f) continue;
    uit.derving *= f.derving; uit.vast *= f.vast; uit.capaciteit *= f.capaciteit;
  }
  return uit;
}

/* EEN NOODOPLOSSING HOUDT NIET EEUWIG. Draait op de SPELMAAND en niet op de
   klok, om dezelfde reden als de vacature in ./dienst.js: anders begeeft een
   noodkoeling het terwijl er niemand speelt.

   Geeft terug wat er terugviel, zodat de maand het kan melden. Een workaround
   die stilletjes bezwijkt is een straf die je niet ziet aankomen. */
function verval(v, maand) {
  const terug = [];
  for (const s of openstaand(v))
    if (s.staat === 'workaround' && maand - s.sindsStand >= WORKAROUND_MAANDEN) {
      s.staat = 'open'; s.sindsStand = maand;
      terug.push({ soort: s.soort, naam: (SOORTEN[s.soort] || {}).naam || s.soort });
    }
  return terug;
}

/* Wat er van de opgeloste storingen wordt opgeruimd, nadat de maand ze gezien
   heeft. */
function ruim(v) {
  v.storingen = lijst(v).filter(s => s.staat !== 'weg');
}

/* EEN KEUZE TOEPASSEN, en dit is de enige plek waar dat gebeurt -- of de keuze
   nu van een vakkracht op zijn dienst komt (./rush-acties.js) of van de
   eigenaar op zijn zaakscherm (./storing-acties.js). Een tweede plek zou een
   tweede antwoord zijn op "wat doet repareren", en dan lopen de hoogtes uiteen.

   Geeft terug wat de MAAND ervan moet weten: een spoedbedrag en een
   herstelsprong. Hij zet zelf geen geld en raakt geen kas -- dat doet de maand,
   want daar horen bedragen thuis (par. 0f wet 3). */
function pas(v, soort, optie, maand) {
  const t = SOORTEN[soort];
  const s = vind(v, soort);
  if (!t || !s || !optie) return null;
  if (optie.lost) { zet(v, soort, 'weg', maand); return { spoed: onderhoudsnorm(v) * t.spoed, herstel: t.herstel }; }
  /* MITIGEREN IS GEEN STANDVERANDERING. Een hulpkracht die de waar overzet lost
     niets op; hij redt wat er vanavond in ligt. Morgen ligt er weer wat in, en
     het voorval komt terug. Dat verschil IS de rol. */
  if (optie.staat) { zet(v, soort, optie.staat, maand); return { spoed: 0, herstel: 0 }; }
  return { spoed: 0, herstel: 0 };
}

/* HOE ERG DIT IS, in euro's van DEZE zaak. De grondslag onder de
   geschiedenisdrempel (par. 0f wet 5): een koelstoring in een zaak van veertig
   stoelen is een ander verhaal dan dezelfde storing in een zaak van vier.
   Uitgedrukt als wat een OPEN storing een maand lang extra zou kosten. */
function zwaarte(v, soort, dervingBasis) {
  const t = SOORTEN[soort];
  if (!t) return 0;
  return Math.max(0, dervingBasis * (t.open.derving - 1));
}

module.exports = { SOORTEN, UIT_RISICO, WORKAROUND_MAANDEN, lijst, heeft, vind,
  ontstaat, uitVoorval, zet, pas, effect, verval, ruim, zwaarte, openstaand };
