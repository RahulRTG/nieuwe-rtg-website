/* Magnaat World: DE TEGENPARTIJEN EN DE WEG NAAR HET GROOTBOEK (ronde A2.2).

   MAGNAAT.md, MAGNAAT FINISH: minimaal. Alleen de vijf macro-actoren die nodig
   zijn om de 27 gebeurtenissen van de geldkaart (scripts/lib/magnaatgeldkaart.js)
   sluitend te maken -- geen bankensimulatie, geen huishoudmodel. Ze zijn geen
   sluitposten: elk heeft een betekenis, zodat later te zien is waar geld heen
   ging. En elk heeft een VASTE IDENTITEIT PER WERELD (`world:{id}:macro:bank`),
   zodat een wereld nooit tegen de rekening van een andere boekt.

   Wat hier NIET gebeurt: World gebruikt deze module in A2.2 nog nergens. De
   migratie van de gebeurtenissen zelf is A2.3 t/m A2.9, per categorie. */
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
const SOORT_VAN = { kas: 'actief', inleg: 'eigen-vermogen', macro: 'extern', foundation: 'actief' };

/* De projectie van het grootboek in een World-partij. */
const nieuweProjectie = () => ({ boekVolgorde: 0, rekeningen: {}, laatstToegepast: 0,
  totalen: { debet: 0, credit: 0, aantal: 0 }, recent: [], vandaag: null, wachtend: [], integriteit: null });

function maakBoekhouding({ db } = {}) {
  /* Zonder database een eigen journaal in het geheugen per boekhouding, zodat
     twee proefwerelden met hetzelfde potje-id elkaar nooit raken. */
  const opslag = db ? collectieJournaal({ db }) : geheugenJournaal();
  const cache = new Map();

  function voor(potje) {
    const st = potje.staat;
    const w = wereldId(potje);
    if (!st.boek) st.boek = nieuweProjectie();
    let gb = cache.get(w);
    if (!gb) {
      gb = maakGrootboek({
        wereld: w, opslag, soorten: SOORTEN,
        versies: { regel: WORLD_REGELVERSIE, motor: 'world-1' },
        periode: () => ({ nummer: potje.staat.maand, datum: 'maand ' + potje.staat.maand })
      });
      cache.set(w, gb);
    }
    const p = st.boek;
    gb.zorgVorm(p);

    /* EEN OVERDRACHT: `bedrag` eurocenten van de ene rekening naar de andere.
       `van` en `naar` zijn [soort, sleutel] -- ['kas', 'a'], ['macro', 'bank'].
       Het grootboek weigert een bedrag dat geen geheel aantal centen is. */
    function overdracht({ soort, sleutel, van, naar, bedrag, omschrijving, labels }) {
      const code = ([k, x]) => REKENING[k](w, x);
      const regel = ([k, x], kant) => gb.regel(code([k, x]), k === 'macro' ? x : String(x), omschrijving, SOORT_VAN[k], kant, bedrag);
      return gb.metOorzaak(soort, () => gb.boek(p, sleutel, soort, omschrijving,
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

  return { voor };
}

module.exports = { TEGENPARTIJEN, SOORTEN, REKENING, wereldId, maakBoekhouding };
