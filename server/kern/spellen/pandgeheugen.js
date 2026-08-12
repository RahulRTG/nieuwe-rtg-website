/* HET PAND ALS PERSONAGE -- wat er op deze plek stond, over campagnes heen.

   De eerste wervel van de geschiedenislaag die het potje OVERLEEFT, en hij zit
   met opzet op het onderwerp met de minste uitzonderingen: een stuk grond.

   Binnen een partij houdt magnaat/kavellog.js bij wat er op een kavel gebeurde.
   Dit bestand vouwt dat aan het eind op tot wat de STAD ervan overhoudt:

     2027-2031  Bakkerij De Haven      (retail)
     2031-2032  leegstand
     2032-2038  Rahul Hospitality      (kantoor)
     2039-2044  North Sea Logistics    (logistiek)
     2044-heden leegstand

   Zodat een speler over twintig jaar kan zeggen "ken je die oude bakkerij bij de
   haven?" en het spel weet welk pand hij bedoelt.

   ================== DE TWEE REGELS ERBOVEN ==================

   1. WAT GEBEURD IS, BLIJFT WAAR. Een periode wordt nooit herschreven. Dat er
      tussen 2032 en 2038 een kantoor stond blijft waar, ook als er nu een
      cultuurhuis staat. Er is geen "actuele" versie die de vorige vervangt --
      dat is het verschil tussen een geschiedenis en een veld.
   2. SYSTEMEN SCHRIJVEN FEITEN, MAGNAAT LEEST GESCHIEDENIS. Dit bestand
      verzint niets. Het leest het log dat de acties zelf schreven en zet het op
      een rij. Wie er zinnen van maakt (../spellen/stadskrant.js) leest wéér.

   ================== WAAROM HIJ MAG BLIJVEN BESTAAN ==================

   VERHAAL.md paragraaf 1 stelt vijf vragen aan alles wat tussen campagnes
   blijft. Voor een pand zijn de antwoorden dezelfde als voor het stadsgeheugen,
   en dat is precies waarom dit het veilige eerste onderwerp is:

   WAAR KOMT HET VANDAAN? Uit wat er gebouwd en gesloten is. Niet uit wat iemand
   verdiende: er staat geen bedrag in.

   WIE BEZIT HET? NIEMAND. Een pandgeschiedenis maakt niemand rijker en niemand
   sterker in een volgende campagne. Wie hem leest heeft er niets aan behalve
   dat hij het weet.

   ER STAAT GEEN PERSOON IN, en dat is de kern. Wat er bewaard wordt is het BORD
   OP DE GEVEL -- de naam van de zaak en zijn sector -- en nooit een speler, een
   codenaam of een eigenaar. Zo onthoudt een stad ook: je loopt langs een pand
   en je ziet "Bakkerij De Haven", niet het handelsregister. Daarom valt deze
   laag buiten de 18+-poort van ./grens.js, om woordelijk dezelfde reden als het
   stadsgeheugen: daar staat geen persoon in.

   WIE er zat is een andere vraag aan een andere laag met een strengere grens
   (./loopbaan.js, ./ondernemerskring.js). Twee lagen, dezelfde ruggengraat.

   HOE VERLAAT HET DE WERELD? Het slijt op de klok van de STAD -- het aantal
   gespeelde campagnes -- en niet op de kalender, want anders vergeet een stad
   zijn gebouwen doordat er even niemand speelde. Ruim, want een pand dat na een
   maand geen verleden meer heeft, heeft nooit een verleden gehad. */
'use strict';

/* Na hoeveel campagnes een periode van het bord zakt. Ruimer dan het
   stadsgeheugen (40) en de ondernemerskring (60): een gebouw staat er langer
   dan een project en veel langer dan een mens er werkt. */
const SLIJTAGE_POTJES = 120;
/* Hoeveel perioden er per kavel bewaard blijven. Een pand met veertig
   voorgangers is geen geschiedenis meer maar een logboek; wat eruit valt is
   altijd het OUDSTE, want het jongste verleden is het verleden dat iemand nog
   herkent. */
const MAX_PERIODEN = 12;

module.exports = ({ db, save }) => {
  const alle = () => {
    if (!db.data.pandgeheugen || typeof db.data.pandgeheugen !== 'object') db.data.pandgeheugen = {};
    return db.data.pandgeheugen;
  };
  const schoon = (stad) => String(stad || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  const stadVan = (id) => {
    const a = alle();
    if (!a[id]) a[id] = { stad: id, potjes: 0, kavels: {} };
    return a[id];
  };

  /* EEN AFGELOPEN CAMPAGNE OPVOUWEN. Dezelfde vorm en dezelfde reden als
     `noteerUitslag`, `noteerLoopbaan` en het stadsgeheugen: idempotent, want een
     partij kan maar een keer klaar zijn en hij wordt vanuit twee kanten
     afgesloten. */
  function onthoud(potje) {
    if (!potje || potje.status !== 'klaar' || potje.pandGenoteerd) return null;
    const stad = schoon(((potje.variant || {}).stad) || '');
    const st = potje.staat || {};
    if (!stad || !(st.kavelLog || []).length) return null;
    potje.pandGenoteerd = true;
    const LOG = require('./magnaat/kavellog');
    const s = stadVan(stad);
    s.potjes++;
    const geraakt = [...new Set(st.kavelLog.map(r => r.kavel))];
    let erbij = 0;
    for (const kavel of geraakt) {
      for (const p of LOG.perioden(st, kavel)) {
        /* ELKE PERIODE HEEFT EEN NAAM, want `open` valt terug op de sectornaam
           als je er geen geeft (magnaat/acties.js). Hier stond een `continue`
           voor het geval van niet; die was dood, en een tak die geen enkele
           toets kan omleggen is een tak die niemand onderhoudt. */
        (s.kavels[kavel] = s.kavels[kavel] || []).push({
          naam: p.naam, sector: p.sector || null,
          vanaf: p.vanaf, tot: p.tot === null ? null : p.tot, sinds: s.potjes
        });
        erbij++;
      }
      const rij = s.kavels[kavel];
      if (rij && rij.length > MAX_PERIODEN) s.kavels[kavel] = rij.slice(-MAX_PERIODEN);
    }
    save();
    return { stad, potjes: s.potjes, kavels: geraakt.length, perioden: erbij };
  }

  const staatEr = (s, p) => (s.potjes - (p.sinds || 0)) < SLIJTAGE_POTJES;

  /* WAT ER OP EEN PLEK STOND, oudste eerst -- want een geschiedenis loopt vooruit
     en niet achteruit. Wie er zat staat er niet bij; zie de kop. */
  function voorKavel(stad, kavel) {
    const s = alle()[schoon(stad)];
    if (!s) return { kavel: String(kavel), potjes: 0, perioden: [] };
    const rij = (s.kavels[String(kavel)] || []).filter(p => staatEr(s, p));
    return { kavel: String(kavel), potjes: s.potjes,
      perioden: rij.map(p => ({ naam: p.naam, sector: p.sector, vanaf: p.vanaf, tot: p.tot })) };
  }

  /* WELKE PLEKKEN EEN VERLEDEN HEBBEN. Voor een stadsbeeld, en om te kunnen
     zeggen hoeveel van de stad al door mensen is beschreven. */
  function beeld(stad) {
    const s = alle()[schoon(stad)];
    if (!s) return { stad: schoon(stad), potjes: 0, kavels: 0, perioden: 0, uitleg: UITLEG };
    let perioden = 0, kavels = 0;
    for (const rij of Object.values(s.kavels)) {
      const staand = rij.filter(p => staatEr(s, p));
      if (staand.length) { kavels++; perioden += staand.length; }
    }
    return { stad: s.stad, potjes: s.potjes, kavels, perioden, uitleg: UITLEG };
  }

  const UITLEG = 'Wat hier stond is door spelers neergezet en van niemand. Er '
    + 'staat een bord op de gevel en geen naam van een eigenaar: wie er zat is '
    + 'een andere vraag aan een andere laag.';

  return { onthoud, voorKavel, beeld, SLIJTAGE_POTJES, MAX_PERIODEN };
};
module.exports.SLIJTAGE_POTJES = SLIJTAGE_POTJES;
module.exports.MAX_PERIODEN = MAX_PERIODEN;
