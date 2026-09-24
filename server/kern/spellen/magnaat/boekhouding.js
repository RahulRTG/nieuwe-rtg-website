/* Magnaat World: DE TEGENPARTIJEN EN DE WEG NAAR HET GROOTBOEK (ronde A2.2-A2.10).

   MAGNAAT.md, MAGNAAT FINISH: minimaal. Alleen de vijf macro-actoren die nodig
   zijn om de 27 gebeurtenissen van de geldkaart (scripts/lib/magnaatgeldkaart.js)
   sluitend te maken -- geen bankensimulatie, geen huishoudmodel. Ze zijn geen
   sluitposten: elk heeft een betekenis, zodat later te zien is waar geld heen
   ging. En elk heeft een VASTE IDENTITEIT PER WERELD (`world:{id}:macro:bank`),
   zodat een wereld nooit tegen de rekening van een andere boekt.

   BEWEGEN, EN DAT IS DE ENE WEG. Een gemigreerde gebeurtenis roept `beweeg`
   aan: die boekt de overdracht in het grootboek en werkt daarna het saldo in de
   partij (`st.geld`, de Foundation-pot) bij met EXACT hetzelfde aantal centen.
   Dit bestand is dus de enige plek in World die een saldo schrijft; de
   grondwetmeter en de geldkaart laten het daarom buiten hun telling van directe
   mutaties, met die reden erbij. Zodra alle gebeurtenissen gemigreerd zijn
   (A2.10), is `st.geld` voor elke speler exact het saldo van zijn kas. */
'use strict';
const { maakGrootboek, geheugenJournaal, collectieJournaal } = require('../../magnaat-grootboek');
const { WORLD_REGELVERSIE } = require('./centen');

/* De vijf, met wat ze doen. `stad` is de rest van de stadseconomie: verhuurders,
   grond, en de leveranciers en diensten buiten de spelers om. */
const TEGENPARTIJEN = {
  bank: 'verstrekt en ontvangt krediet: lening, aflossing en rente, ook op een negatief saldo',
  huishoudens: 'de klanten en de mensen die er werken: verkoop, loon, werving en afvloeiing',
  aannemer: 'bouwt, breidt uit, herstelt en koopt terug: investering, desinvestering, schade en projecten',
  verzekeraar: 'neemt de premie en betaalt de uitkering',
  stad: 'de rest van de stadseconomie: huur, grond, inkoop, vaste lasten, marketing en onderhoud'
};

/* Wat een gebeurtenis in World economisch IS; dezelfde lijst als de betekenissen
   op de geldkaart (test/magnaat-world-boekhouding.test.js houdt ze gelijk). */
const SOORTEN = Object.fromEntries([
  'OPENING', 'VERKOOP', 'INKOOP', 'LOON', 'VASTE_LASTEN', 'HUUR', 'MARKETING', 'ONDERHOUD',
  'INVESTERING', 'DESINVESTERING', 'WERVING_AFVLOEIING',
  'CONTRACT_VOORUITBETALING', 'CONTRACT_BETALING', 'CONTRACT_BOETE', 'CONTRACT_AFKOOP',
  'RESULTAATDELING', 'AANDELENKOOP', 'VEILING_GUNNING',
  'LENING', 'AFLOSSING', 'RENTE', 'UITWINNING',
  'PREMIE', 'SCHADE', 'UITKERING', 'FOUNDATION_AFDRACHT', 'FOUNDATION_PROJECT'
].map(s => [s, s]));

/* DE IDENTITEITEN. Alles begint met de wereld; een speler heeft een kas en een
   inleg (het eigen vermogen waar de opening tegenover staat), een tegenpartij
   een rekening, en de Foundation-pot zijn twee delen. */
const wereldId = (potje) => 'world:' + potje.id;
const REKENING = {
  kas: (w, h) => w + ':speler:' + h + ':kas',
  inleg: (w, h) => w + ':speler:' + h + ':inleg',
  macro: (w, naam) => {
    if (!TEGENPARTIJEN[naam]) throw new Error('Geen tegenpartij in World: ' + naam + '.');
    return w + ':macro:' + naam;
  },
  foundation: (w, pot) => w + ':rtfoundation:' + pot
};
const HANDVAT = Symbol('boekhouding');
const SOORT_VAN = { kas: 'actief', inleg: 'eigen-vermogen', macro: 'extern', foundation: 'actief' };

/* De projectie van het grootboek in een World-partij. */
const nieuweProjectie = () => ({ boekVolgorde: 0, rekeningen: {}, laatstToegepast: 0,
  totalen: { debet: 0, credit: 0, aantal: 0 }, recent: [], vandaag: null, wachtend: [], integriteit: null });

function maakBoekhouding({ db } = {}) {
  /* Zonder database een eigen journaal in het geheugen per boekhouding, zodat
     twee proefwerelden met hetzelfde potje-id elkaar nooit raken. */
  const opslag = db ? collectieJournaal({ db }) : geheugenJournaal();
  const cache = new Map();

  /* De boekhouding van een partij, gevonden via haar staat: de gebeurtenissen
     zelf krijgen alleen `st` mee, en de wereld staat daarom in `st.wereld`
     (gezet door `koppel`). */
  function voor(st) {
    const w = st.wereld;
    if (!w) throw new Error('Deze partij is niet aan een wereld gekoppeld (boekhouding.koppel).');
    if (!st.boek) st.boek = nieuweProjectie();
    let gb = cache.get(w);
    if (!gb) {
      gb = maakGrootboek({
        wereld: w, opslag, soorten: SOORTEN,
        versies: { regel: WORLD_REGELVERSIE, motor: 'world-1' },
        periode: (p) => ({ nummer: p.maand || 0, datum: 'maand ' + (p.maand || 0) })
      });
      cache.set(w, gb);
    }
    const p = st.boek;
    gb.zorgVorm(p);
    p.maand = st.maand;

    /* EEN OVERDRACHT: `bedrag` eurocenten van de ene rekening naar de andere.
       `van` en `naar` zijn [soort, sleutel] -- ['kas', 'a'], ['macro', 'bank'].
       Het grootboek weigert een bedrag dat geen geheel aantal centen is. */
    function overdracht({ soort, sleutel, van, naar, bedrag, omschrijving, labels }) {
      const code = ([k, x]) => REKENING[k](w, x);
      const regel = ([k, x], kant) => gb.regel(code([k, x]), k === 'macro' ? x : String(x), omschrijving, SOORT_VAN[k], kant, bedrag);
      return gb.metOorzaak(soort, () => gb.boek(p, sleutel || soort + ':' + (p.boekVolgorde + 1), soort, omschrijving,
        [regel(naar, 'debet'), regel(van, 'credit')], labels || []));
    }
    const saldo = (k, x) => ((p.rekeningen[REKENING[k](w, x)] || {}).saldo || 0);
    return {
      wereld: w, overdracht, saldo,
      bevestig: () => gb.bevestig(p),
      verifieer: () => gb.verifieerGrootboek(p),
      gebeurtenissen: (vanaf, tot) => gb.gebeurtenissen(vanaf, tot)
    };
  }

  /* Wat een kant van een overdracht in de partij zelf verandert. */
  function pasToe(st, [k, x], teken, bedrag) {
    if (k === 'kas') st.geld[x] = (st.geld[x] || 0) + teken * bedrag;
    else if (k === 'foundation') st.foundation[x] = (st.foundation[x] || 0) + teken * bedrag;
  }

  /* DE ENE WEG VOOR GELD IN WORLD: boek de overdracht en werk de partij bij met
     precies dat bedrag. Een negatief bedrag draait de richting om (een verlies
     dat een aandeelhouder meedraagt), nul boekt niets. */
  function beweeg(st, { soort, van, naar, bedrag, omschrijving }) {
    if (bedrag === 0) return null;
    if (bedrag < 0) return beweeg(st, { soort, van: naar, naar: van, bedrag: -bedrag, omschrijving });
    const g = voor(st).overdracht({ soort, van, naar, bedrag, omschrijving: omschrijving || soort });
    pasToe(st, van, -1, bedrag);
    pasToe(st, naar, 1, bedrag);
    return g;
  }

  /* KOPPELEN: een partij hoort bij een wereld. Een partij die al geld had voor
     ze aan het grootboek hing (een lopende partij van voor ronde A2.3) krijgt
     een opening met precies wat er nu staat -- geboekt, zonder het saldo zelf
     te veranderen. Zo begint haar grootboek waar ze is, niet bij nul. */
  function koppel(potje) {
    const st = potje.staat;
    st[HANDVAT] = api;
    if (st.wereld) return;
    /* De wereld is `world:{id}`, tenzij daar al een journaal staat: een potje
       wordt opgeruimd maar zijn journaal niet, en een nieuw potje met hetzelfde
       id mag daar niet in verder boeken. Dan `world:{id}:2`, `:3`, enzovoort --
       deterministisch, en voor een gewone partij gewoon `world:{id}`. */
    let w = wereldId(potje);
    for (let n = 2; cache.has(w) || opslag.laatsteVolgnummer(w) > 0; n++) w = wereldId(potje) + ':' + n;
    st.wereld = w;
    const b = voor(st);
    for (const [h, bedrag] of Object.entries(st.geld || {})) {
      if (!bedrag) continue;
      const [van, naar] = bedrag > 0 ? [['inleg', h], ['kas', h]] : [['kas', h], ['inleg', h]];
      b.overdracht({ soort: 'OPENING', sleutel: 'overname:' + h, van, naar, bedrag: Math.abs(bedrag), omschrijving: 'Overname van de kas van voor het grootboek' });
    }
    for (const pot of ['lokaal', 'centraal']) {
      const bedrag = (st.foundation || {})[pot] || 0;
      if (bedrag > 0) b.overdracht({ soort: 'OPENING', sleutel: 'overname:foundation:' + pot, van: ['macro', 'stad'], naar: ['foundation', pot], bedrag, omschrijving: 'Overname van de Foundation-pot' });
    }
  }

  /* DE OPENING VAN EEN NIEUWE PARTIJ (geldkaart G01): elke speler krijgt zijn
     startkapitaal uit zijn eigen inleg. */
  function open(potje, bedrag) {
    koppel(potje);
    const st = potje.staat;
    for (const h of Object.keys(st.geld)) {
      beweeg(st, { soort: 'OPENING', van: ['inleg', h], naar: ['kas', h], bedrag, omschrijving: 'Startkapitaal' });
    }
    voor(st).bevestig();
  }

  const api = { voor, beweeg, koppel, open, bevestig: (st) => (st.wereld ? voor(st).bevestig() : 0) };
  return api;
}

/* DE WEG VANUIT DE MODULES. De gebeurtenissen van World krijgen alleen `st`
   mee; `koppel` hangt de boekhouding van de partij er daarom aan onder een
   symbool. Dat is een handvat voor de looptijd en geen staat: een symbool gaat
   niet mee in JSON, dus er wordt niets van opgeslagen, en een partij die niet
   gekoppeld is kan geen geld bewegen -- ze faalt hard in plaats van stil buiten
   het grootboek om te boeken. */
function beweeg(st, opdracht) {
  const b = st && st[HANDVAT];
  if (!b) throw new Error('Geld bewegen kan alleen in een partij die aan het grootboek hangt (boekhouding.koppel).');
  return b.beweeg(st, opdracht);
}

module.exports = { TEGENPARTIJEN, SOORTEN, REKENING, wereldId, maakBoekhouding, beweeg };
