/* DE STAD ONTHOUDT -- fase C, de Living World en de levende kaart in een.

   Uit de visie, hoofdstuk 10 en 11: je loopt na vijftien jaar door IJmuiden en
   je ziet wat jullie hebben neergezet. Jullie bouwden een bibliotheek, de wijk
   werd veiliger, nieuwe ondernemers kwamen, en:

     "Nieuwe spelers weten niet eens meer dat het ooit een leeg terrein was."

   Dat is de zin die deze laag waarmaakt. Wat een campagne aan de STAD toevoegt
   blijft staan als de campagne voorbij is.

   ================== DE GRONDWET, EN DE ENE REGEL ==================

   VERHAAL.md paragraaf 1 stelt vijf vragen aan alles wat blijft bestaan. Voor
   een stad zijn de antwoorden ongewoon, en dat is precies waarom hij mag
   blijven bestaan waar vermogen dat niet mag:

   WAAR KOMT HET VANDAAN? Uit wat spelers SAMEN bouwden: afgeronde
   Foundation-projecten (magnaat/foundation.js). Niet uit wat iemand verdiende.

   WIE BEZIT HET? NIEMAND, EN DAT IS DE HELE REGEL. Een stad is van niemand, dus
   kan hij niemand rijker maken dan een ander. Iedereen die daarna in die stad
   speelt begint met dezelfde kaart -- de bouwer net zo goed als iemand die er
   nooit eerder was. Zou het anders zijn, dan is een oude speler structureel in
   het voordeel en is elke eerste campagne een verplichte inhaalronde. Dat is de
   grens waar deze laag op staat of valt.

   HOE VERLAAT HET DE WERELD? Het SLIJT. Een project dat door niemand meer wordt
   gebruikt zakt langzaam weg -- in jaren en niet in weken, want een bibliotheek
   die na een maand verdwijnt is geen bibliotheek. En het slijt op de KLOK van
   de stad (het aantal gespeelde campagnes) en niet op de echte kalender, want
   anders verliest een stad zijn geheugen doordat er even niemand speelde.

   WAT BIJ AFWEZIGHEID? Niets. De stad verandert niet doordat jij weg was; hij
   verandert doordat er GESPEELD is. Dat is dezelfde eigenschap als de klok die
   bijrekent in plaats van tikt.

   WAT ALS EEN SPELER STOPT? De stad merkt het niet, en dat is het punt uit
   hoofdstuk 10. Wat hij bouwde blijft staan zonder zijn naam eraan.

   ================== WAAROM HIJ BUITEN DE 18+-POORT VALT ==================

   `./grens.js` zegt: alles wat een prestatie BUITEN het potje bewaart valt
   onder `progressieMag`. En hij noemt drie uitzonderingen met hun reden, waarvan
   de derde hier woordelijk past: de dagtelling valt erbuiten omdat "daar geen
   persoon in staat".

   In een stadsgeheugen staat geen persoon. Geen naam, geen codenaam, geen
   score, geen ranglijst -- alleen wat er GEBOUWD is en in welke buurt. Het is
   dus geen bewaarde prestatie maar gedeelde omgeving, zoals het weer.

   Dat heeft ook een mooie kant: wat een tiener in zijn campagne aan de stad
   toevoegt, blijft voor iedereen staan. Er wordt niets van HEM bewaard, en de
   stad wordt er wel beter van. */
'use strict';

/* Hoeveel campagnes een project meegaat voordat het volledig is weggezakt, als
   er niets meer bij komt. Bewust lang: een bibliotheek die na drie potjes weg is
   was geen bibliotheek maar een tent. */
const SLIJTAGE_POTJES = 40;
/* Wat er hoogstens van EEN soort project blijft staan. Zonder dak stapelt
   dezelfde bibliotheek zich twintig campagnes lang op tot de zone niet meer te
   herkennen is -- dan is de stad geen geheugen maar een sneeuwbal. */
const MAX_PER_SOORT = 3;

const schoonId = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);

module.exports = ({ db, save }) => {
  const alle = () => {
    if (!db.data.stadsgeheugen || typeof db.data.stadsgeheugen !== 'object') db.data.stadsgeheugen = {};
    return db.data.stadsgeheugen;
  };
  const vanStad = (stad) => {
    const l = alle(), id = schoonId(stad);
    if (!id) return null;
    if (!l[id]) l[id] = { stad: id, potjes: 0, projecten: [] };
    return l[id];
  };

  /* WAT EEN NIEUWE CAMPAGNE ERFT. Alleen wat nog niet is weggesleten, en per
     soort hoogstens het dak. Geeft de vorm terug die magnaat/foundation.js
     zelf gebruikt (`gedaan`), zodat de motor er niets nieuws voor hoeft te
     kennen -- hij krijgt gewoon een stad die al wat heeft meegemaakt. */
  function voor(stad) {
    const s = alle()[schoonId(stad)];
    if (!s) return { gedaan: [], potjes: 0 };
    const perSoort = {};
    const gedaan = [];
    for (const p of s.projecten) {
      if (sterkte(s, p) <= 0) continue;
      perSoort[p.id] = (perSoort[p.id] || 0) + 1;
      if (perSoort[p.id] > MAX_PER_SOORT) continue;
      gedaan.push({ id: p.id, zone: p.zone });
    }
    return { gedaan, potjes: s.potjes };
  }

  /* HOEVEEL ER NOG VAN OVER IS. Een project verliest zijn kracht met het aantal
     campagnes dat er sindsdien gespeeld is -- de klok van de STAD, niet die van
     de kalender. */
  const sterkte = (s, p) => 1 - (s.potjes - (p.sinds || 0)) / SLIJTAGE_POTJES;

  /* EEN AFGELOPEN CAMPAGNE BIJSCHRIJVEN. Dezelfde vorm en dezelfde reden als
     `noteerUitslag` en `noteerLoopbaan`: idempotent, want een partij kan maar
     een keer klaar zijn en hij wordt vanuit twee plekken afgesloten.

     ER KOMT GEEN PERSOON MEE, en dat is niet een filter maar de bouw: uit een
     potje wordt alleen `staat.foundation.gedaan` gelezen, en daar staat een
     project-id en een zone in. Geen speler, geen bedrag, geen uitslag. */
  function onthoud(potje) {
    if (!potje || potje.status !== 'klaar' || potje.stadGenoteerd) return null;
    if (potje.soort !== 'magnaat') return null;
    const st = potje.staat || {};
    const stad = (potje.variant || {}).stad || st.stad;
    const s = vanStad(stad);
    if (!s) return null;
    potje.stadGenoteerd = true;
    s.potjes++;
    const nieuw = ((st.foundation || {}).gedaan) || [];
    for (const g of nieuw) s.projecten.push({ id: g.id, zone: g.zone, sinds: s.potjes });
    /* Wat helemaal is weggesleten hoeft niet bewaard te blijven: een lijst die
       alleen maar groeit is een lijst die niemand meer leest. */
    s.projecten = s.projecten.filter(p => sterkte(s, p) > 0);
    save();
    return { stad: s.stad, potjes: s.potjes, erbij: nieuw.length, staand: s.projecten.length };
  }

  /* WAT EEN MENS ZIET: de stad zoals hij nu is, en wat er in staat. Zonder
     namen, want die staan er niet in -- en dat is de zin uit hoofdstuk 10: wie
     het gebouwd heeft is niet meer te zien, alleen DAT het er staat. */
  function beeld(stad) {
    const s = alle()[schoonId(stad)];
    if (!s) return { stad: schoonId(stad), potjes: 0, projecten: [], uitleg: UITLEG };
    const perZone = {};
    for (const p of s.projecten) {
      if (sterkte(s, p) <= 0) continue;
      (perZone[p.zone] = perZone[p.zone] || []).push({ id: p.id,
        sterkte: Math.round(sterkte(s, p) * 100) });
    }
    return { stad: s.stad, potjes: s.potjes, perZone,
      projecten: s.projecten.length, uitleg: UITLEG };
  }

  const UITLEG = 'Wat hier staat is door spelers gebouwd en van niemand. '
    + 'Iedereen die in deze stad speelt begint met dezelfde kaart.';

  /* Een stad vergeten. Alleen met de hand, en het is geen opruiming maar een
     besluit: je gooit de geschiedenis van iedereen weg die er ooit speelde. */
  function vergeet(stad) {
    const id = schoonId(stad);
    if (!alle()[id]) return { weg: false };
    delete alle()[id];
    save();
    return { weg: true };
  }

  return { SLIJTAGE_POTJES, MAX_PER_SOORT, alle, voor, onthoud, beeld, vergeet, sterkte };
};
module.exports.SLIJTAGE_POTJES = SLIJTAGE_POTJES;
module.exports.MAX_PER_SOORT = MAX_PER_SOORT;
