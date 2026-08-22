/* DE VERDEELSLEUTEL, EN DE STANDEN WAARIN EEN AFDRACHT KAN VERKEREN.

   ../allocatie.js is de administratie: reserveren, betaalbaar stellen,
   afwikkelen, laten vervallen. Dit bestand is het BELEID plus de
   toestandsmachine -- wat er verdeeld wordt en welke stap daarna mag.

   HET BELEID IS GEKOPPELD AAN EEN VERSIE EN NIET AAN EEN GETAL. Een afdracht die
   vorig jaar is gereserveerd, moet vorig jaar zijn regels houden; wie het
   percentage overschrijft, herschrijft daarmee de geschiedenis. Vandaar REGELS
   met de versie als sleutel, en een reservering die zijn versie meedraagt.

   EN ER WORDT IN TIENDUIZENDSTEN VERGELEKEN. `0.20 + 0.10` is in JavaScript
   0.30000000000000004, en een controle die daarop struikelt keurt een kloppende
   verdeling af. Dat is hier echt gebeurd. */
'use strict';

const REGELS = {
  'v1-2026': {
    versie: 'v1-2026',
    vanaf: '2026-01-01',
    totaalDeel: 0.30,
    delen: [
      { id: 'lokaal', deel: 0.20, label: 'Lokale impact',
        waarom: 'blijft in de omgeving van het lid: speeltuin, sporthal, school, cultuur, bibliotheek, mobiliteit' },
      { id: 'foundation', deel: 0.10, label: 'RTFoundation',
        waarom: 'de stichting zelf: onderwijs- en gezinsprogramma\'s over de omgeving heen' }
    ],
    /* De afdracht rekent over het bedrag EX btw. Btw is geen omzet van RTG maar
       geld van de Belastingdienst; 30% daarvan afdragen zou betekenen dat RTG
       een deel van de btw weggeeft en die zelf bijlegt. */
    exBtw: true
  }
};

const HUIDIGE_VERSIE = 'v1-2026';

const STATUS = {
  GERESERVEERD: 'GERESERVEERD',   // berekend en apart gezet
  BETAALBAAR: 'BETAALBAAR',       // bestemming bekend, mag weg
  AFGEWIKKELD: 'AFGEWIKKELD',     // echt overgemaakt
  VERVALLEN: 'VERVALLEN'          // de bron is teruggedraaid (terugbetaling, storno)
};

const OVERGANG = {
  [STATUS.GERESERVEERD]: [STATUS.BETAALBAAR, STATUS.VERVALLEN],
  [STATUS.BETAALBAAR]: [STATUS.AFGEWIKKELD, STATUS.VERVALLEN],
  [STATUS.AFGEWIKKELD]: [],
  [STATUS.VERVALLEN]: []
};

function magOvergaan(van, naar) {
  return Array.isArray(OVERGANG[van]) && OVERGANG[van].includes(naar);
}

function regelVan(versie) { return REGELS[versie] || REGELS[HUIDIGE_VERSIE]; }

/* Klopt een regel met zichzelf? Geeft null als het goed is, anders de zin.

   Waarom dit bestaat: 0.20 + 0.10 is in JavaScript 0.30000000000000004, dus een
   rechtstreekse vergelijking van de som met `totaalDeel` faalt op een regel die
   gewoon klopt. Wie dat een keer tegenkomt en "oplost" door de controle weg te
   halen, verliest de enige bewaking op een verdeling die NIET optelt -- en dan
   draagt RTG 30% af terwijl er maar 25% wordt verdeeld, of andersom.

   Vandaar: vergelijken in tienduizendsten, niet in drijvende komma. */
function regelKlopt(r) {
  if (!r || !Array.isArray(r.delen) || !r.delen.length) return 'de regel heeft geen delen';
  const som = Math.round(r.delen.reduce((s, d) => s + d.deel, 0) * 10000);
  const totaal = Math.round(r.totaalDeel * 10000);
  if (som !== totaal)
    return 'de delen tellen op tot ' + (som / 100) + '% en het totaal is ' + (totaal / 100) + '%';
  for (const d of r.delen) {
    if (!(d.deel > 0)) return 'deel ' + d.id + ' is niet groter dan nul';
    if (!d.waarom) return 'deel ' + d.id + ' zegt niet waar dat geld heen gaat';
  }
  return null;
}

/* De verdeling van een bedrag, volgens een regel. Geeft de delen EN het
   restant -- want de som van afgeronde delen is niet altijd het totaal, en dat
   verschil hoort zichtbaar te zijn in plaats van in de laatste post te
   verdwijnen.

   `bedragCenten` is het bedrag waarover gerekend wordt, al ex btw. Deze functie
   deelt niet door 1,21: wie dat hier zou doen, rekent het nog een keer als de
   aanroeper het al deed. Zie kern/fonds.js, dat de btw-kant kent. */
function verdeel(bedragCenten, versie) {
  const r = regelVan(versie);
  const basis = Math.max(0, Math.round(Number(bedragCenten) || 0));
  const totaal = Math.round(basis * r.totaalDeel);
  const delen = r.delen.map(d => ({ id: d.id, label: d.label, deel: d.deel,
    centen: Math.round(basis * d.deel) }));
  const som = delen.reduce((s, d) => s + d.centen, 0);
  return { regelVersie: r.versie, basisCenten: basis, totaalCenten: totaal, delen,
    /* Het afrondingsverschil, expliciet. Nul in verreweg de meeste gevallen; is
       het dat niet, dan hoort iemand te zien dat de delen niet exact optellen
       in plaats van dat het stil in een post wordt verstopt. */
    afrondingCenten: totaal - som };
}

module.exports = { REGELS, HUIDIGE_VERSIE, STATUS, OVERGANG, magOvergaan, regelVan, regelKlopt, verdeel };
