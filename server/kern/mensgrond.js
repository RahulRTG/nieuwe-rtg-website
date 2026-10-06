/* DE MENSGRONDEN -- waarom er bij een handeling een mens nodig is, als gesloten lijst.

   DE VRAAG DRAAIT OM. Niet "mag de machine dit?" maar: WAAROM IS HIER EEN MENS NODIG?
   Kan de machine iets veilig, bevoegd, controleerbaar en herstelbaar zelf, dan hoort
   het in beginsel geen mensenwerk te zijn. Maar het antwoord op die vraag mag niet
   elke keer opnieuw ter discussie staan, en daarom is het een GESLOTEN lijst: een
   menselijke stap draagt een van deze gronden, of hij draagt er geen.

   TWEE INVARIANTEN, en ze spiegelen elkaar (AUTONOMIE.md par. 2.9):
     menselijk werk ZONDER geldige grond     = automatiseringsschuld
     automatisering OVER een geldige grond   = overtreding

   DIT IS GEEN GEZAGSLADDER. De treden blijven geen / tonen / klaarzetten / uitvoeren
   (INT-01, scripts/gezagsnoemer.js), en hoe ver de machine gaat blijft van
   kern/stuur/beleid.js en kern/stuur/mandaat.js. Een grond zegt WAAROM er een mens
   staat, niet HOE HOOG hij staat. Wie hier een rangorde in leest, maakt de zesde
   ladder die dit huis vier keer heeft verboden. En BLOCKED (wachten op een externe
   partij) is hier met opzet GEEN grond: dat is een toestand, en die heet in de
   controlplane ONBEKEND of UITSTELLEN (kern/commercie/besluit.js).

   TWEE SOORTEN, en ze worden nooit opgeteld.
     `blijvend`   de grond zit in de AARD van de handeling. Geld dat beweegt blijft
                  geld dat beweegt, hoe goed de machine ook wordt.
     `totBewijs`  de grond is een TEKORT aan bewijs. Hij verdwijnt zodra het bewijs er
                  is -- en precies die verzameling is de weg naar minder handwerk.
   Wie die twee samenvoegt, ziet niet meer welk mensenwerk het product IS (toestemming,
   een relatie, een oordeel) en welk mensenwerk alleen wacht op een meting.

   WAAR DE GRONDEN VANDAAN KOMEN. Niet uit de naam van een route maar uit drie lagen die
   er al zijn en elk een eigen eigenaar hebben: de effecten (kern/isolatie/effecten.js),
   de bodem (kern/frictie/bodem.js) en de paden waar geen mandaat ooit over gaat
   (kern/stuur/mandaat.js NOOIT_AUTONOOM). Deze module verzint dus geen tweede
   classificatie; hij VERTAALT drie bestaande naar een woord. Twee gronden hebben
   vandaag geen enkele bron per route -- fysieke aanwezigheid en wettelijke
   bevoegdheid -- en die staan er dan ook met die reden bij en nooit als nul.

   EN HIJ VOERT NIETS UIT. Geen route, geen opslag, geen oordeel over een mens. Een
   meter (scripts/mensgrond.js) legt hem naast de registers; een scherm dat later een
   menselijke stap toont, leest hier de grond en zijn betekenis uit en verzint er
   geen eigen tekst voor. */
'use strict';

const { GRONDEN, NAMEN, UITKOMSTEN, POORTEN } = require('./mensgrond-lijst');
const { UIT_EFFECT, GEEN_GROND, UIT_BODEM, UIT_DEUR, OORDEEL_OP_NAAM, UIT_NOOIT_AUTONOOM, KANT, kantVan } =
  require('./mensgrond-vertaling');

/* DE GRONDEN VAN EEN HANDELING, uit wat er over haar bekend is. Elke grond draagt WAAR
   hij vandaan kwam, want een grond zonder herkomst is een bewering. Onbekend is geen
   leeg: `effectenBekend: false` zegt dat er misschien een blijvende grond is die hier
   niet te zien is.

   feiten = { pad, rol, kant, effecten: [..] | null, effectgraad, bodemId: string | null,
              herstel: 'bewezen' | 'onomkeerbaar' | 'onbewezen' | 'nvt' }

   `nvt` betekent: er is gemeten dat er niets verandert, dus er valt niets terug te
   draaien. Dat is iets anders dan `bewezen`, en de aanroeper zet hem alleen als de
   meting dat zegt (kern/stuur/gevolg.js: geen-effect-gemeten). */
function grondenVan(feiten) {
  const f = feiten || {};
  const pad = String(f.pad || '');
  const uit = new Map();
  const zet = (grond, herkomst) => {
    if (!GRONDEN[grond]) throw new Error('onbekende mensgrond: ' + grond);
    if (!uit.has(grond)) uit.set(grond, []);
    uit.get(grond).push(herkomst);
  };
  for (const e of (Array.isArray(f.effecten) ? f.effecten : [])) {
    if (UIT_EFFECT[e]) zet(UIT_EFFECT[e], 'effect ' + e);
  }
  if (f.bodemId && UIT_BODEM[f.bodemId]) zet(UIT_BODEM[f.bodemId], 'bodem ' + f.bodemId);
  if (OORDEEL_OP_NAAM.test(pad)) zet('oordeel', 'naam (vermoed)');
  if (f.rol && UIT_DEUR[f.rol]) zet(UIT_DEUR[f.rol], 'deur ' + f.rol);
  for (const r of UIT_NOOIT_AUTONOOM) if (r.patroon.test(pad)) zet(r.grond, 'mandaat.js NOOIT_AUTONOOM');
  /* De eigen keuze van een klant. Hij staat in een EIGEN lijst en niet bij de blijvende
     gronden, en dat is precies goed zo: een mandaat dat een lid zelf afgeeft IS zijn
     toestemming, dus deze grond maakt een handeling binnen een mandaat geen overtreding.
     Hij zegt alleen dat de machine hier nooit ONGEVRAAGD beslist. */
  const zelf = f.kant === 'klant';
  if (f.herstel === 'onomkeerbaar') zet('onomkeerbaar', 'herstel');
  else if (f.herstel !== 'bewezen' && f.herstel !== 'nvt') zet('terugweg-onbewezen', 'herstel');

  const lijst = [...uit.entries()].map(([grond, herkomst]) => ({ grond, soort: GRONDEN[grond].soort, herkomst }));
  return {
    gronden: lijst,
    blijvend: lijst.filter(g => g.soort === 'blijvend').map(g => g.grond),
    totBewijs: lijst.filter(g => g.soort === 'totBewijs').map(g => g.grond),
    zelf,
    kant: f.kant || 'onbekend',
    effectenBekend: Array.isArray(f.effecten),
    /* ZEKER is strenger dan bekend: verklaard of afgeleid uit een meting, nooit een
       vermoeden uit de categorie van een functie. Alleen hierop mag automatiseringsschuld
       rusten -- "hier is geen mens nodig" is een harde uitspraak en verdraagt geen
       zachtere premisse. */
    effectenZeker: Array.isArray(f.effecten) && (f.effectgraad === 'verklaard' || f.effectgraad === 'afgeleid')
  };
}

/* DE INDELING. `machineBereik` betekent: de grammatica (beleid + mandaat) laat deze
   handeling binnen een mandaat ZELFSTANDIG toe. Dat is een latente vraag zolang er
   geen mandaat in productie is (AUTONOMIE.md par. 3), en juist daarom hoort hij nu
   gesteld: een overtreding in de grammatica is goedkoper te repareren dan een in een
   mandaat dat al draait.

   De volgorde van de regels is de volgorde van de zwaarte, en `onbekend` staat er
   met opzet tussen: een conclusie is nooit harder dan haar zachtste premisse.

   EEN LEZING IS EEN EIGEN GEVAL. Staat een route op de leeslijst van het beleid, dan
   beweert het beleid dat hij niets verandert. Dat is pas een overtreding als een
   meting hem ziet SCHRIJVEN (`schrijftGemeten`); zonder meting is het onbekend. Wie
   een niet-bewezen lezing een overtreding noemt, velt een oordeel dat harder is dan
   zijn bewijs -- de eerste ronde van deze meter deed precies dat, op twintig routes. */
function deelIn({ gronden, machineBereik, poorten, niveau, schrijftGemeten }) {
  const g = gronden || grondenVan({});
  const p = poorten || {};
  if (machineBereik && niveau === 'lezen') {
    if (schrijftGemeten) return { uitkomst: 'overtreding', waarom: 'het beleid noemt dit een lezing, en de proef zag hem schrijven' };
    if (p.gevolg !== true) return { uitkomst: 'onbekend', waarom: 'het beleid noemt dit een lezing; niemand heeft gemeten dat hij niets verandert' };
    return { uitkomst: 'machinewerk', waarom: 'een lezing, en gemeten dat hij niets verandert' };
  }
  if (machineBereik) {
    if (g.blijvend.length) return { uitkomst: 'overtreding', waarom: 'blijvende grond: ' + g.blijvend.join(', ') };
    const gezakt = ['gevolg', 'terugweg'].filter(n => p[n] !== true);
    if (gezakt.length) return { uitkomst: 'overtreding', waarom: 'harde poort niet gehaald: ' + gezakt.join(', ') };
    if (!g.effectenBekend) return { uitkomst: 'onbekend', waarom: 'de grammatica laat dit toe, maar niemand weet wat het doet' };
    return { uitkomst: 'machinewerk', waarom: 'binnen de grammatica, zonder grond en met beide harde poorten' };
  }
  if (g.blijvend.length) return { uitkomst: 'geldig', duur: 'blijvend', waarom: g.blijvend.join(', ') };
  if (g.zelf) return { uitkomst: 'geldig', duur: 'blijvend', waarom: 'toestemming: de betrokkene beslist zelf over zijn eigen zaken' };
  if (g.totBewijs.length) {
    /* Zonder bekende effecten kan er nog een blijvende grond onder liggen; dan is de
       duur niet "tot bewijs" maar onbekend. */
    return { uitkomst: 'geldig', duur: g.effectenBekend ? 'totBewijs' : 'onbekend', waarom: g.totBewijs.join(', ') };
  }
  if (!g.effectenBekend || p.gevolg !== true)
    return { uitkomst: 'onbekend', waarom: !g.effectenBekend ? 'de effecten zijn onbekend' : 'het gevolg is niet gemeten' };
  if (!g.effectenZeker)
    return { uitkomst: 'onbekend', waarom: 'geen grond gevonden, maar de effecten zijn alleen vermoed; schuld vraagt zekerheid' };
  if (g.kant !== 'rtg')
    return { uitkomst: 'onbekend', waarom: 'niet vast te stellen wiens mens hier staat; schuld bestaat alleen in RTG\'s eigen werk' };
  return { uitkomst: 'automatiseringsschuld', waarom: 'geen grond, gevolg gemeten, terugweg bewezen' };
}

module.exports = { GRONDEN, NAMEN, KANT, kantVan, UIT_EFFECT, GEEN_GROND, UIT_BODEM, UIT_NOOIT_AUTONOOM, OORDEEL_OP_NAAM, UIT_DEUR,
  UITKOMSTEN, POORTEN, grondenVan, deelIn };
