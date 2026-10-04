/* HET ALARM -- want een SLO zonder alarm is een rapportcijfer achteraf.

   SLO.md noemt dit sinds de eerste versie als punt 2 van zijn eigen gaten: de
   cijfers worden gemeten en het foutbudget wordt bijgehouden, maar er gaat
   niemand piepen. Dit is die piep.

   HIJ MEET NIETS ZELF, en dat is de kern. Elke controle hieronder leest een
   laag die er al is: de servicedoelen, de sonde, de canary, de gegevens-
   kwaliteit en de hashketen van het journaal. Een alarm met een eigen meting
   gaat op een dag iets anders zeggen dan het scherm waar het over gaat, en dan
   gelooft niemand meer welk van de twee.

   DE DREMPELS STAAN IN SLO.json EN DE CONTROLES HIER. Dat is een bewuste knip:
   getallen horen in gegevens, maar een regeltaal in een configuratiebestand is
   een tweede implementatie die je niet kunt toetsen. Wie een controle wil
   toevoegen, schrijft code met een toets erbij.

   EN HET BELANGRIJKSTE: HIJ PIEPT OP VERANDERING, NIET ELKE RONDE. Een alarm
   dat elke dertig seconden hetzelfde meldt, leert mensen om het weg te klikken
   -- en dan is de volgende, echte melding ook weg. Er gaat dus een regel in het
   journaal en een sein naar het kantoorbord bij het ONTSTAAN en bij het
   OPLOSSEN, en daartussen niet meer.

   WAT HIER NIET GEBEURT: er gaat geen mail en geen telefoonmelding uit. Dat is
   een kanaalbesluit met een piket eraan vast (punt 4 van datzelfde lijstje in
   SLO.md), en het hoort niet stilzwijgend hier ingebouwd te worden. De
   uitgangen die er zijn, staan in de uitslag. */
'use strict';
const { maakTikker } = require('./tikker');

const ERNST = { hoog: 3, midden: 2, laag: 1 };

/* Stilzetten is een MENSENhandeling, en die trede komt uit de schaal in
   ./risico.js en niet uit een overgetypte tekenreeks -- zie de kop van
   ./alarm-uitgang.js voor waarom dat verschil telt. */
/* De niveaus wonen sinds de samenvoeging #161 in kern/frictie (het
   risicomodel verhuisde van command/risico.js naar frictie/motor.js); de
   naam is dezelfde, de plek niet. */
const { NIVEAUS } = require('../frictie');

function maakAlarm({ opslag, save, journaal, slo, sonde, canary, kwaliteit, norm, sein, foutmelder }) {
  const D = () => {
    const n = (typeof norm === 'function' ? norm() : norm) || {};
    return Object.assign({ budgetRestDeel: 0.25, defectenDrempel: 25, buitenStilUren: 24, stilteMaxUren: 72 },
      n.alarmen || {});
  };

  function vak() {
    return opslag.bak('commandAlarmen');
  }

  // De controles zelf: ./alarm-controles.js. Ze lezen alleen bestaande lagen.
  const controles = require('./alarm-controles')({ slo, sonde, canary, journaal, kwaliteit, instellingen: D });

  const nu = () => new Date().toISOString();

  /* Wegen: wat is er nieuw, wat is er opgelost, en wat loopt er door. Alleen
     het eerste en het tweede gaan de deur uit. */
  function weeg() {
    const staat = vak();
    const gevonden = controles();
    const gezien = new Set(gevonden.map(x => x.id));
    const nieuw = [], opgelost = [];

    for (const g of gevonden) {
      const oud = staat[g.id];
      if (oud && oud.actief) {
        oud.wat = g.wat; oud.laatst = nu();
        continue;
      }
      staat[g.id] = { id: g.id, naam: g.naam, ernst: g.ernst, wat: g.wat, sinds: nu(), laatst: nu(),
        actief: true, stilTot: oud && oud.stilTot ? oud.stilTot : null };
      nieuw.push(staat[g.id]);
    }
    for (const id of Object.keys(staat)) {
      if (gezien.has(id) || !staat[id].actief) continue;
      staat[id].actief = false;
      staat[id].opgelostAt = nu();
      opgelost.push(staat[id]);
    }

    for (const a of nieuw) meld(a, 'aan');
    for (const a of opgelost) meld(a, 'af');
    if (nieuw.length || opgelost.length) save();
    return { nieuw, opgelost, actief: gevonden.length };
  }

  /* De uitgang staat in ./alarm-uitgang.js: drie kanalen, waarvan het derde
     buiten het huis komt. Waarom dat een eigen bestand is, staat in de kop
     daarvan; kort: melden is een ander onderwerp dan wegen. */
  const { meld, buitenStand } = require('./alarm-uitgang')({ journaal, sein, foutmelder });

  /* Stilzetten, met een einde eraan. Een alarm dat voor onbepaalde tijd stil
     kan, is een alarm dat je uitzet en vergeet; daarom een maximum uit de norm
     en een reden die in het journaal komt. */
  function stilzetten(id, uren, door, reden) {
    const d = D();
    const a = vak()[String(id)];
    if (!a) return { error: 'Dat alarm staat er niet.', status: 404 };
    const u = Math.max(1, Math.min(Number(uren || 8), d.stilteMaxUren));
    a.stilTot = new Date(Date.now() + u * 3600000).toISOString();
    save();
    journaal.noteer({ actie: 'alarm stilgezet', actor: door, niveau: NIVEAUS.hand, objectType: 'alarm',
      objectId: a.id, reden: u + ' uur: ' + String(reden || 'geen reden opgegeven') });
    return { alarm: a, tot: a.stilTot, max: d.stilteMaxUren };
  }

  function stand() {
    const r = weeg();
    const staat = vak();
    const buiten = buitenStand();  // een keer, niet vijf keer
    const lijst = Object.keys(staat).map(id => staat[id])
      .sort((a, b) => (ERNST[b.ernst] || 0) - (ERNST[a.ernst] || 0));
    const actief = lijst.filter(a => a.actief);
    return {
      alarmen: lijst, zojuist: { nieuw: r.nieuw.map(a => a.id), opgelost: r.opgelost.map(a => a.id) },
      tel: { actief: actief.length, hoog: actief.filter(a => a.ernst === 'hoog').length,
        stil: actief.filter(a => a.stilTot && Date.parse(a.stilTot) > Date.now()).length },
      drempels: D(),
      /* De uitgangen worden GETELD en niet beloofd. Stond ERR_WEBHOOK_URL leeg,
         dan hoort daar niet stilzwijgend een kanaal in de lijst te staan dat er
         niet is -- een lege url leest anders als bezorging. */
      uitgangen: ['het journaal (elke aan- en afmelding)', 'het kantoorbord via de office-SSE']
        .concat(buiten.actief ? [(buiten.onafhankelijk === true ? 'de externe webhook (ERR_WEBHOOK_URL)'
          : buiten.onafhankelijk === false ? 'storingenontvangst op dezelfde app'
          : 'een webhook zonder bewijs dat hij extern is') + ', alleen op de overgang'] : []),
      // onbekend is geen groen (zie alarm-uitgang.js)
      geenUitgang: buiten.actief && buiten.onafhankelijk === true ? null : buiten.reden,
      let: 'er gaat geen mail en geen telefoonmelding uit. Dat is een kanaalbesluit met een piket ' +
        'eraan vast (SLO.md, punt 4) en hoort niet stilzwijgend hier ingebouwd te worden. En het alarm ' +
        'piept op verandering en niet elke ronde: een melding die elke dertig seconden terugkomt, leert ' +
        'mensen om hem weg te klikken.'
    };
  }

  const tikker = maakTikker(weeg, 60000);   // zie ./tikker.js

  return { weeg, stand, stilzetten, controles, tikker, buitenStand };
}

module.exports = { maakAlarm, ERNST };
