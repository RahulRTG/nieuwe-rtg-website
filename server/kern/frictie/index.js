/* KERN-MODULE "frictie": hoeveel weerstand hoort er bij deze handeling?

   Dit is de orkestrator. De rekenarij staat in ./motor.js (verhuisd uit
   kern/command/), de ondergrens in ./bodem.js, en hier worden ze samengevoegd
   tot het ene antwoord dat elke roeper krijgt.

   WAAROM DE NAAM "frictie" EN NIET "risico". Het woord `risico` is in deze boom
   al twee keer bezet met een andere betekenis: scripts/lib/risico.js rekent uit
   welke TOETSEN door een wijziging geraakt worden, en kern/spellen/magnaat/
   risico.js is een spelmechaniek. BEWIJSMACHINE.md heeft die vorm gemeten -- 78
   namen met meer dan een betekenis -- en een derde betekenis erbij zetten is
   precies de fout die daar op de prijskaart staat. Frictie zegt bovendien
   scherper wat er uitkomt: niet hoe erg iets is, maar hoeveel weerstand erbij
   hoort.

   DE REGEL VAN DEZE LAAG, IN EEN ZIN:

       frictie mag omhoog van de omstandigheden, en omlaag van niets.

   De motor mag een handeling zwaarder maken (een groot bedrag, veel objecten,
   een twijfelende machine). Lichter maken mag hij alleen binnen wat de bodem
   toestaat. Zo kan een contextmodel nooit een grens wegnemen die er om een
   juridische of morele reden staat -- en dat is de enige manier waarop
   "vrijwel geen frictie bij laag risico" veilig kan bestaan. */
'use strict';

const { maakRisico, GRONDSLAG, NIVEAUS } = require('./motor');
const { BODEM, ORDE, strengste, bodemVoorPad, bodemVoorActie } = require('./bodem');

/* FAIL-FAST OP EEN ONVOLLEDIGE BODEMREGEL, bij het laden en niet bij gebruik.

   Een bodemregel zonder reden of bron is over een half jaar niet te
   beoordelen, en een regel met een onbekend niveau is erger dan geen regel:
   `strengste()` zou hem met undefined vergelijken en dan wint hij nooit. Dat
   zou stil gebeuren -- de lijst ziet er vol uit en de bodem doet niets. Deze
   controle is de reden dat dat niet kan. */
function keurBodem(regels) {
  for (const r of regels) {
    const waar = 'bodemregel ' + (r.id || '(zonder id)');
    if (!r.id) throw new Error('kern/frictie: een bodemregel zonder id');
    if (!r.pad && !r.actie) throw new Error(waar + ' slaat nergens op: geen pad en geen actie');
    if (!Object.prototype.hasOwnProperty.call(ORDE, r.minimum))
      throw new Error(waar + ' heeft een onbekend minimum: ' + r.minimum);
    if (r.minimum === 'auto') throw new Error(waar + ' zet de bodem op auto; dat is geen bodem maar een vrijbrief');
    if (!r.reden || !r.bron) throw new Error(waar + ' mist een reden of een bron');
    /* Een padregel zonder voorbeeld is niet te beproeven zonder het patroon
       zelf na te bouwen, en een toets die zijn invoer uit het patroon haalt
       meet het patroon niet. Zie de kop van ./bodem.js. */
    if (r.pad && !r.voorbeeld) throw new Error(waar + ' mist een voorbeeldpad');
    if (r.pad && r.voorbeeld && !r.pad.test(r.voorbeeld))
      throw new Error(waar + ': het voorbeeld ' + r.voorbeeld + ' valt niet onder het eigen patroon');
  }
  return true;
}
keurBodem(BODEM);

/* Het strengste van twee niveaus, als publieke naam. `strengste` zit in
   ./bodem.js omdat de ORDE daar woont; hij hoort ook hier te bestaan, want de
   roepers van deze laag kennen alleen de index. */
const strengsteNiveau = strengste;

function maakFrictie({ beleid }) {
  const motor = maakRisico({ beleid });

  /* Beoordeel een handeling, mét de bodem eronder.

     De uitkomst is die van de motor, behalve dat `niveau` nooit onder de bodem
     ligt en dat de opbouw dan een regel meer draagt. Die regel is geen punten
     maar een grens, en staat er daarom met `grens: true` in plaats van met een
     puntenaantal: een bodem die als punten werd opgeteld, zou een handeling
     ook duurder maken in scores waar hij niets over te zeggen heeft. */
  function beoordeel(actie, ctx) {
    const c = ctx || {};
    const uit = motor.beoordeel(actie, c);
    const opPad = c.pad ? bodemVoorPad(c.pad) : null;
    const opActie = bodemVoorActie(actie);
    const regel = !opPad ? opActie
      : (!opActie ? opPad : (ORDE[opPad.minimum] >= ORDE[opActie.minimum] ? opPad : opActie));
    if (!regel) return uit;

    const nieuw = strengsteNiveau(uit.niveau, regel.minimum);
    const verzwaard = nieuw !== uit.niveau;
    return Object.assign({}, uit, {
      niveau: nieuw,
      /* Vier ogen volgt de bodem mee zodra die op `hand` staat: een handeling
         die de machine niet mag doen, hoort niet door een enkel paar ogen te
         glippen omdat de score toevallig laag uitviel. */
      vierOgen: uit.vierOgen || regel.minimum === 'hand',
      bodem: { id: regel.id, minimum: regel.minimum, reden: regel.reden, bron: regel.bron },
      ...(verzwaard ? { waarom: 'de bodem van dit huis: ' + regel.reden } : {}),
      opbouw: uit.opbouw.concat([{ naam: 'bodem ' + regel.id + ': niet onder ' + regel.minimum,
        grens: true, punten: 0 }])
    });
  }

  /* De vertrouwensroute over een stapel. Hij draait op DEZE beoordeel en niet
     op die van de motor, anders zou een geval dat de bodem raakt alsnog in de
     veilige stapel belanden -- en dat is precies het geval waar het om gaat. */
  function routeer(gevallen, actie, basisCtx) {
    const veilig = [], mens = [], hulp = [];
    for (const g of gevallen || []) {
      const ctx = Object.assign({}, basisCtx || {}, (g && g.ctx) || {}, { aantal: 1 });
      const o = beoordeel(actie, ctx);
      const rij = { geval: g, oordeel: o };
      if (o.niveau === NIVEAUS.auto && !o.vierOgen) veilig.push(rij);
      else if (o.niveau === NIVEAUS.assist) hulp.push(rij);
      else mens.push(rij);
    }
    const stapel = beoordeel(actie, Object.assign({}, basisCtx || {}, { aantal: veilig.length }));
    const maxRonde = beleid.getal('herstel.maxPerRonde', 50);
    const teveel = veilig.length > maxRonde;
    return {
      veilig: teveel ? veilig.slice(0, maxRonde) : veilig,
      overgeslagen: teveel ? veilig.length - maxRonde : 0,
      hulp, mens, stapeloordeel: stapel, maxPerRonde: maxRonde
    };
  }

  return { beoordeel, routeer, GRONDSLAG };
}

/* De oude naam blijft bestaan zolang RTG Command hem gebruikt. Hij wijst naar
   DEZELFDE functie -- geen tweede motor, alleen een tweede naam. */
module.exports = { maakFrictie, maakRisico: maakFrictie, GRONDSLAG, NIVEAUS,
  BODEM, strengsteNiveau, bodemVoorPad, bodemVoorActie, keurBodem };
