/* Payroll OS: DE LOONHEFFING, als tabel in plaats van een percentage.

   WAAROM DIT EEN EIGEN MODULE IS. De motor rekende de loonheffing met EEN vlak
   percentage: grondslag maal tarief. Dat is niet hoe de Nederlandse
   loonbelasting werkt, en het verschil is niet klein -- het zit in de tientallen
   procenten aan de onderkant, want de heffingskortingen zijn juist daar het
   grootst. Een strook die zo is gerekend, klopt niet met wat er van de rekening
   gaat.

   Wat er wel gebeurt, en in welke volgorde (die volgorde IS de regel):

     1. HERLEIDEN NAAR EEN JAARLOON. De tabel is een JAARtabel. Een maandloon
        wordt vermenigvuldigd met het aantal perioden in een jaar, want anders
        valt een maandsalaris altijd in de eerste schijf en betaalt niemand ooit
        het hoge tarief.
     2. BELASTING OVER HET JAARLOON via de schijven -- per schijf alleen het
        deel dat IN die schijf valt.
     3. HEFFINGSKORTINGEN ERAF. Die zijn zelf geen bedrag maar een functie van
        het jaarloon: een vast stuk tot een grens, daarna een afbouw per euro.
        Wie ze als vast bedrag modelleert, geeft iemand met een hoog loon een
        korting die hij niet heeft.
     4. NOOIT ONDER NUL. Meer korting dan belasting levert geen teruggaaf via de
        loonstrook op; dat loopt via de aangifte inkomstenbelasting.
     5. TERUG NAAR DE PERIODE: delen door hetzelfde aantal perioden.

   BIJZONDER TARIEF. Vakantiegeld en een bonus zijn geen loon over deze maand;
   ze worden belast tegen het bijzondere tarief, dat hoort bij het JAARloon van
   vorig jaar. Wie ze bij het periodeloon optelt, herleidt ze mee naar een
   jaarloon en jaagt de hele strook een schijf omhoog. Ze gaan daarom apart.

   WAT HIER GEEN BEDRAGEN STAAN. Geen enkele schijfgrens, geen enkel
   kortingsbedrag. Die komen uit het regelpakket (./regelpakket.js), want alleen
   dan draagt een oude run nog de tabel van toen. Deze module weet hoe je met een
   tabel rekent en verder niets.

   TERUGWAARTS VERENIGBAAR: een pakket met alleen `loonheffing.tarief` (het
   vlakke percentage) blijft precies werken zoals het werkte. De meegeleverde
   ONGECONTROLEERDE jaargang is er zo een; de tabelvorm is er voor de echte. */
'use strict';

const rond = (x) => Math.round(x);

/* De schijven. Elke schijf is { tot, deel }: tot is de bovengrens van de
   schijf in centen (null of ontbrekend = de laatste), deel is het tarief als
   deel van 1. Per schijf telt alleen wat ERIN valt -- dat is het verschil
   tussen een schijventabel en een staffel die het hele bedrag opnieuw belast. */
function overSchijven(jaarloonCenten, schijven) {
  let rest = Math.max(0, jaarloonCenten), onder = 0, som = 0;
  const stappen = [];
  for (const s of schijven) {
    if (rest <= 0) break;
    const boven = (s.tot == null) ? Infinity : s.tot;
    const inDeze = Math.min(rest, boven - onder);
    if (inDeze <= 0) { onder = boven; continue; }
    const centen = rond(inDeze * s.deel);
    som += centen;
    stappen.push({ van: onder, tot: (boven === Infinity ? null : boven), deel: s.deel,
      grondslag: rond(inDeze), centen });
    rest -= inDeze; onder = boven;
  }
  return { centen: som, stappen };
}

/* Een heffingskorting. De vorm volgt de tabel zoals hij echt is opgeschreven:
   een rij stukken, elk met een bovengrens, een vast bedrag en een deel per euro
   boven de ondergrens van dat stuk.

     [{ tot: 2880000, vast: 314400, deel: 0 },              // vlak
      { tot: 7570000, vast: 314400, deel: -0.0651 },        // afbouw
      { tot: null,    vast: 0,      deel: 0 }]              // op

   `deel` is negatief bij afbouw. Dat staat er expliciet in plaats van een vlag
   "afbouw": een tabel die zichzelf leest, is een tabel die je kunt controleren
   tegen het Handboek. */
function kortingUit(jaarloonCenten, stukken) {
  if (!Array.isArray(stukken) || !stukken.length) return null;
  let onder = 0;
  for (const s of stukken) {
    const boven = (s.tot == null) ? Infinity : s.tot;
    if (jaarloonCenten <= boven || boven === Infinity) {
      const basis = Number(s.vast) || 0;
      const deel = Number(s.deel) || 0;
      const bedrag = basis + (jaarloonCenten - onder) * deel;
      return { centen: Math.max(0, rond(bedrag)), stuk: { van: onder,
        tot: (boven === Infinity ? null : boven), vast: basis, deel } };
    }
    onder = boven;
  }
  return { centen: 0, stuk: null };
}

/* Hoeveel loonperioden zitten er in een jaar? Uit het contract, want dat is
   waar de betaling in staat -- maand of vier weken. Het regelpakket mag het
   overrulen (een land met een andere loonperiode), maar niet de client. */
function periodenPerJaar(regelpakket, betaling) {
  const uit = regelpakket && regelpakket.regels && regelpakket.regels.loonheffing;
  if (uit && Number.isFinite(uit.periodenPerJaar)) return uit.periodenPerJaar;
  return betaling === 'vierweken' ? 13 : 12;
}

/* ---------------------------------------------------------------------------
   bereken({ regelpakket, grondslagCenten, bijzonderCenten, betaling })

   grondslagCenten   het REGULIERE loon van deze periode (uren, salaris,
                     toeslagen) -- wat elke periode terugkomt
   bijzonderCenten   wat NIET bij deze periode hoort (vakantiegeld, bonus)
   betaling          'maand' of 'vierweken', uit het contract

   Levert { centen, stappen } waarbij stappen elke tussenstap draagt: het
   herleide jaarloon, elke schijf apart, elke korting apart, en de deling terug
   naar de periode. Dat is vraag 1 van de vier -- waarom is dit bedrag
   berekend -- en zonder die stappen is een loonstrook een bewering. */
function bereken({ regelpakket, grondslagCenten, bijzonderCenten, betaling }) {
  const lh = (regelpakket.regels || {}).loonheffing;
  if (!lh) return null;
  const regulier = Math.max(0, grondslagCenten || 0);
  const bijzonder = Math.max(0, bijzonderCenten || 0);

  /* De vlakke stand. Blijft bestaan omdat een pakket zonder tabel nog steeds
     moet kunnen draaien (een proefrun, een land waar we nog geen tabel voor
     hebben). Hij rekent dan over ALLES, ook het bijzondere deel: zonder tabel
     is er ook geen bijzonder tarief om het anders te doen. */
  if (!Array.isArray(lh.schijven)) {
    if (!Number.isFinite(lh.tarief)) return null;
    const g = regulier + bijzonder;
    return { centen: rond(g * lh.tarief), soort: 'vlak', regel: 'loonheffing.tarief', tarief: lh.tarief,
      stappen: [{ stap: 'loonheffing_vlak', grondslag: g, tarief: lh.tarief,
        centen: rond(g * lh.tarief), uitleg: 'vlak percentage uit het regelpakket -- geen jaartabel' }] };
  }

  const n = periodenPerJaar(regelpakket, betaling);
  const stappen = [];

  /* 1 + 2: herleiden en over de schijven. */
  const jaarloon = regulier * n;
  stappen.push({ stap: 'herleid_jaarloon', uitleg: regulier + ' cent x ' + n + ' perioden', centen: jaarloon });
  const bruto = overSchijven(jaarloon, lh.schijven);
  for (const s of bruto.stappen) stappen.push({ stap: 'schijf', van: s.van, tot: s.tot,
    tarief: s.deel, grondslag: s.grondslag, centen: s.centen });
  stappen.push({ stap: 'belasting_voor_korting', centen: bruto.centen });

  /* 3: de kortingen, elk apart in beeld. */
  let korting = 0;
  const tabellen = lh.heffingskortingen || {};
  for (const naam of Object.keys(tabellen)) {
    const k = kortingUit(jaarloon, tabellen[naam]);
    if (!k) continue;
    korting += k.centen;
    stappen.push({ stap: 'heffingskorting', regel: 'loonheffing.heffingskortingen.' + naam,
      // `k.centen ? -k.centen : 0` en niet `-k.centen`: dat laatste levert bij
      // een korting van nul de waarde -0 op, en "-0" op een loonstrook is geen
      // bedrag maar een typefout die er als een bedrag uitziet
      grondslag: jaarloon, centen: k.centen ? -k.centen : 0,
      uitleg: k.stuk ? ('vast ' + k.stuk.vast + ' + ' + k.stuk.deel + ' per cent boven ' + k.stuk.van) : null });
  }

  /* 4: nooit onder nul. Meer korting dan belasting is geen negatieve
     loonheffing; dat verrekent de Belastingdienst bij de aangifte. */
  const naKorting = Math.max(0, bruto.centen - korting);
  if (bruto.centen - korting < 0) stappen.push({ stap: 'korting_afgekapt',
    uitleg: 'de kortingen zijn hoger dan de belasting; een loonstrook keert geen belasting uit', centen: 0 });

  // 5: terug naar deze periode
  const perPeriode = rond(naKorting / n);
  stappen.push({ stap: 'per_periode', uitleg: naKorting + ' cent / ' + n + ' perioden', centen: perPeriode });

  /* Het bijzondere tarief, apart en met een eigen stap. Ontbreekt het in het
     pakket, dan wordt het bijzondere loon NIET stilletjes onbelast gelaten --
     dat zou een gat in de aangifte zijn. Het valt dan terug op de tabel, met
     die keuze zichtbaar in de stap. */
  let bijzCenten = 0;
  if (bijzonder > 0) {
    if (Number.isFinite(lh.bijzonderTarief)) {
      bijzCenten = rond(bijzonder * lh.bijzonderTarief);
      stappen.push({ stap: 'bijzonder_tarief', regel: 'loonheffing.bijzonderTarief',
        grondslag: bijzonder, tarief: lh.bijzonderTarief, centen: bijzCenten });
    } else {
      /* Terugval: het bijzondere loon meenemen in het jaarloon en het VERSCHIL
         nemen. Zo betaalt het zijn eigen marginale tarief in plaats van het
         gemiddelde, en dat is precies wat het bijzondere tarief benadert. */
      const metBij = overSchijven(jaarloon + bijzonder, lh.schijven);
      bijzCenten = Math.max(0, metBij.centen - bruto.centen);
      stappen.push({ stap: 'bijzonder_zonder_tarief', grondslag: bijzonder, centen: bijzCenten,
        uitleg: 'het regelpakket kent geen bijzonderTarief; gerekend als het marginale tarief over het jaarloon' });
    }
  }

  return { centen: perPeriode + bijzCenten, soort: 'tabel', regel: 'loonheffing.schijven',
    periodenPerJaar: n, stappen };
}

const { keurTabel } = require('./loonheffing-keuring');

module.exports = { bereken, keurTabel, overSchijven, kortingUit, periodenPerJaar };
