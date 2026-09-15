/* ============================================================================
   DE MIXER -- plekken verdelen zonder scores.

   De horizon verdeelt plekken over vertrouwde en ontdekkende motoren. Elke
   motor krijgt om beurten een plek; er is geen score, sortering of weging.

   ELKE PLEK DRAAGT EEN REDEN. Niet "aanbevolen voor jou" maar "dit staat hier
   omdat u vorige week aan bruggen werkte" of "dit komt van een motor die
   expres iets buiten uw wereld zoekt". Dat is dezelfde regel als bij
   kern/frictie/motor.js: een cijfer zonder opbouw is een orakel. Hier is er
   geen cijfer, dus is de opbouw het enige dat er is.

   EEN MOTOR ZONDER BRON ZEGT DAT HIJ NIET KIJKT. Vier van de acht zijn vandaag
   niet aangesloten, en die staan in het antwoord met de reden erbij in plaats
   van te ontbreken -- KAARTEN.md par. 6: "hier is geen gebied" is niet "hier is
   geen motor". Een lijst die stilletjes korter is, leest als een lijst die
   compleet is.

   EN DE SESSIE KAN OPHOUDEN. `genoeg` is geen foutmelding en geen lege lijst:
   het is een geldige uitkomst die zegt dat er genoeg gezien is om iets te gaan
   doen. Een feed die altijd doorloopt is precies het patroon dat CLAUDE.md
   verbiedt; de paradox van deze laag is dat een geslaagde sessie er een is die
   iemand afsluit. Daarom is het aantal plekken EINDIG en staat het hier, niet
   in een instelling die stilletjes omhoog kan.
   ========================================================================== */
'use strict';

/* Twaalf plekken. Genoeg om iets te vinden, te weinig om in te blijven hangen.
   Dit getal hoort NIET configureerbaar te zijn: een plafond met een knop eraan
   is geen plafond, en de knop staat altijd op hoger. */
const PLEKKEN = 12;

const MOTOREN = [
  { id: 'interesse',   kant: 'vertrouwd', naam: 'Wat u interesseert',
    grond: 'Onderwerpen waarvan u zelf hebt gezegd dat u ze wilt zien.',
    dektNiet: 'Kent alleen wat u hebt aangeklikt. Wat u nooit hebt gezien, kan deze motor niet weten.' },
  { id: 'groei',       kant: 'vertrouwd', naam: 'Waar u mee bezig was',
    grond: 'Sluit aan op iets waar u aan werkte -- uit uw eigen leerdossier, en van niemand anders.',
    dektNiet: 'Zegt niet dat u iets af MOET maken. Een onafgemaakte opdracht is hier geen schuld.' },
  { id: 'lokaal',      kant: 'vertrouwd', naam: 'Dichtbij',
    grond: 'Wat er fysiek in de buurt gebeurt, op een plaats die u zelf opgeeft.',
    dektNiet: 'Leidt uw plaats nergens uit af -- geen IP, geen postcode, geen eerdere reis.' },
  { id: 'menselijk',   kant: 'vertrouwd', naam: 'Van een mens',
    grond: 'Een bijdrage van iemand met weinig bereik maar veel vakkennis. Een vakmens met driehonderd volgers kan honderdduizend mensen iets leren.',
    dektNiet: 'Geen ranglijst van makers, en geen bereik dat te koop is.' },
  { id: 'nieuwsgierig', kant: 'ontdekken', naam: 'Net buiten uw wereld',
    grond: 'Een onderwerp dat grenst aan iets wat u wel kent -- voetbal naar aerodynamica, niet voetbal naar scheikunde.',
    dektNiet: 'Springt nooit ver. Wie uitsluitend voetbal kijkt, krijgt hier geen college scheikunde.' },
  { id: 'brug',        kant: 'ontdekken', naam: 'Iemand die u aanvult',
    grond: 'Niet wie op u lijkt, maar wie iets kan wat u niet kunt -- met gedeelde nieuwsgierigheid als ingang.',
    dektNiet: 'Nooit op leeftijd, afkomst of inkomen, en nooit met een match-percentage.' },
  { id: 'actualiteit', kant: 'ontdekken', naam: 'Wat er nu speelt',
    grond: 'Waar het vandaag in de wereld over gaat.',
    dektNiet: 'Geen nieuwsstroom en geen escalatie naar heftiger. Een onderwerp komt hier een keer langs.' },
  { id: 'toeval',      kant: 'ontdekken', naam: 'Verrassing',
    grond: 'Met opzet iets waar geen enkele andere motor op zou zijn uitgekomen.',
    dektNiet: 'Niet willekeurig: een verrassing die nergens op slaat, is ruis en geen ontdekking.' }
];

const OP_ID = new Map(MOTOREN.map(m => [m.id, m]));

module.exports = ({ bronnen }) => {
  const levend = bronnen && typeof bronnen === 'object' ? bronnen : {};

  /* De stand van de acht, zonder dat er iets gevraagd wordt. Dit is het
     antwoord op "waarom zie ik dit" nog voordat iemand het vraagt, en het is
     ook de eerlijke inventaris: vier motoren bestaan als beschrijving en niet
     als code. */
  function motoren() {
    return MOTOREN.map(m => Object.assign({}, m, {
      aangesloten: typeof levend[m.id] === 'function',
      reden: typeof levend[m.id] === 'function' ? null
        : 'Deze motor is beschreven maar heeft nog geen bron. Hij kijkt dus niet, en dat staat hier in plaats van dat zijn plekken stil naar een andere motor gaan.'
    }));
  }

  /* De plekken verdelen. Geen weging, geen score: een geheel getal per kant en
     daarbinnen om de beurt. `Math.round` en niet `floor`, zodat schuif 100 ook
     werkelijk alle plekken naar de ontdekkende kant stuurt. */
  function verdeel(schuif, kanten) {
    const naarOntdekken = Math.round(PLEKKEN * (Math.max(0, Math.min(100, Number(schuif) || 0)) / 100));
    const uit = { ontdekken: naarOntdekken, vertrouwd: PLEKKEN - naarOntdekken };
    /* Een kant zonder aangesloten motor geeft zijn plekken aan de andere. Zou
       hij ze houden, dan levert schuif 100 een lege lijst op bij een mens die
       juist om ontdekking vroeg -- en dat leest als een storing. */
    for (const k of ['ontdekken', 'vertrouwd']) {
      const ander = k === 'ontdekken' ? 'vertrouwd' : 'ontdekken';
      if (!kanten[k] && uit[k]) { uit[ander] += uit[k]; uit[k] = 0; }
    }
    return uit;
  }

  /* DE MIX. `ctx` gaat ongewijzigd naar de bronnen; deze module leest er niets
     uit. Dat is met opzet -- zo kan de mixer geen voorkeur ontwikkelen voor een
     bepaald soort mens, want hij weet niet welke hij bedient. */
  async function mix(ctx, opties) {
    const o = opties || {};
    const schuif = o.eenmaligOntdekken ? 100 : Number(o.schuif);
    const beschikbaar = MOTOREN.filter(m => typeof levend[m.id] === 'function');
    const kanten = {
      ontdekken: beschikbaar.some(m => m.kant === 'ontdekken'),
      vertrouwd: beschikbaar.some(m => m.kant === 'vertrouwd')
    };
    const plekken = verdeel(schuif, kanten);

    /* Elke motor eerst VRAGEN, daarna pas verdelen. Wie tijdens het verdelen
       vraagt, laat de volgorde van de lus bepalen wie er aan bod komt -- en dan
       is de eerste motor in de lijst stilletjes de belangrijkste. */
    const geoogst = new Map();
    const stil = [];
    await Promise.all(beschikbaar.map(async (m) => {
      let r;
      try { r = await levend[m.id](ctx); }
      catch (e) {
        /* Een kapotte motor is geen lege motor. Hij komt terug in `stil` met
           zijn reden -- LAT-regel 13: een belofte over een spoor is pas een
           regel als het spoor kan weigeren. */
        stil.push({ motor: m.id, reden: 'Deze motor kon niet kijken: ' + String((e && e.message) || e).slice(0, 120) });
        geoogst.set(m.id, []); return;
      }
      const lijst = Array.isArray(r) ? r : [];
      if (!lijst.length) stil.push({ motor: m.id, reden: 'Deze motor keek en vond niets dat hier past.' });
      geoogst.set(m.id, lijst);
    }));

    /* `gezien` komt uit het VERZOEK -- de client zegt wat hij deze sessie al
       heeft gehad, zodat verversen niet hetzelfde oplevert. Hij wordt AFGEKAPT
       op vier keer het aantal plekken: hier stond geen grens, en dan bepaalt de
       aanroeper hoeveel geheugen deze functie gebruikt. Wie meer meestuurt dan
       er ooit getoond kan zijn, stuurt geen sessiegeschiedenis maar iets
       anders. */
    const gekozen = [];
    const gezien = new Set((Array.isArray(o.gezien) ? o.gezien : [])
      .slice(0, PLEKKEN * 4).map(x => String(x).slice(0, 200)));
    for (const kant of ['vertrouwd', 'ontdekken']) {
      const rij = beschikbaar.filter(m => m.kant === kant);
      let over = plekken[kant], ronde = 0;
      while (over > 0 && rij.length) {
        let genomen = 0;
        for (const m of rij) {
          if (over <= 0) break;
          const kandidaten = geoogst.get(m.id) || [];
          const item = kandidaten[ronde];
          if (!item || !item.id || gezien.has(String(item.id))) continue;
          gezien.add(String(item.id));
          gekozen.push({ ontdekking: item, door: m.id, kant,
            waarom: m.grond, dektNiet: m.dektNiet });
          over--; genomen++;
        }
        if (!genomen) break;
        ronde++;
      }
    }

    return {
      plekken: gekozen,
      verdeling: plekken,
      schuif: o.eenmaligOntdekken ? 100 : Math.max(0, Math.min(100, Number(schuif) || 0)),
      eenmalig: !!o.eenmaligOntdekken,
      motoren: motoren(),
      /* Wie niets vond, staat er met de reden. Nooit weggelaten. */
      stil,
      /* EEN GELDIGE UITKOMST, GEEN TEKORT. */
      genoeg: gekozen.length < PLEKKEN
        ? 'Dit is alles wat er nu voor u is. Dat is geen storing -- er wordt hier niets bijgemaakt om de lijst vol te krijgen.'
        : 'Twaalf is hier het maximum per keer. Genoeg gezien om iets te gaan proberen; leg de telefoon gerust weg.'
    };
  }

  return { mix, motoren, verdeel, MOTOREN, PLEKKEN, motor: (id) => OP_ID.get(String(id || '')) || null };
};
