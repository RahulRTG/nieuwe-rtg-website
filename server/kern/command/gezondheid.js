/* DE GEZONDHEIDSKAART -- niet "wat staat er in de gegevens" maar "doet het het,
   en hoe zeker weten we dat".

   ./puls.js beantwoordt de eerste vraag al. Deze laag doet de tweede, en het
   verschil zit in EEN veld: de bewijsgraad. Een bord dat "Betalen: OK" toont
   zegt niet of dat uit een meting komt, uit een geslaagde proef, of uit het
   uitblijven van klachten. Die drie zijn niet hetzelfde, en het verschil is
   precies wat iemand nodig heeft om te weten of hij naar huis kan.

   VIER GRADEN, EN ZE ZIJN NIET UITWISSELBAAR:

     onbekend  geen bron zegt hier iets over
     vermoed   afgeleid uit gegevens die er toevallig liggen
     gemeten   een teller of scan heeft er in dit venster naar gekeken
     bewezen   een proef heeft het onlangs echt GEDAAN

   EN VERVALLEN BEWIJS IS GEEN BEWIJS. Elke proef heeft een houdbaarheid. Loopt
   die af, dan zakt het vermogen niet naar rood maar naar "moet opnieuw worden
   vastgesteld", met de datum van de vorige proef erbij. Dezelfde regel waarmee
   ./canary.js weigert te wegen als hij zijn nulmeting kwijt is.

   TWEE DINGEN DIE DEZE KAART NOOIT DOET. Hij MEET NIETS ZELF -- elk getal komt
   uit een laag die er al was (./gezondheid-bronnen.js), om dezelfde reden die in
   ./alarm.js staat. En hij zet NIETS OP GROEN OMDAT ER NIETS IS: een vermogen
   zonder bewijs krijgt "niet vast te stellen". Dat is LAT.md regel 3, en het is
   de enige reden dat deze kaart iets waard is.

   De kaart staat in ./vermogens.js, de lezers in ./gezondheid-bronnen.js en
   ./gezondheid-fundament.js, de vier talen in ./gezondheid-taal.js en de
   controleronde in ./gezondheid-proef.js. */
'use strict';

const { VERMOGENS, OP_ID, ketenVan, vermogenVanAlarm } = require('./vermogens');
const { maakBronnen } = require('./gezondheid-bronnen');
const { draaiProef, PROEVEN, vanProef } = require('./gezondheid-proef');
const { taal, NIET } = require('./gezondheid-taal');

const GRAAD = ['onbekend', 'vermoed', 'gemeten', 'bewezen'];
const ERGER = { 'in orde': 1, 'let op': 2, storing: 3 };
const hoger = (a, b) => (GRAAD.indexOf(a) > GRAAD.indexOf(b) ? a : b);

/* De vier omgevingsdingen (de teller, de functiecatalogus, de back-uplezer en
   de datamap) hebben een standaard, zodat de aanroeper ze niet hoeft te kennen.
   Ze blijven WEL injecteerbaar: zonder die haak is deze module alleen met een
   draaiende server te toetsen, en dan wordt hij niet getoetst. */
function maakGezondheid(o) {
  const { db, save, slo, sonde, alarm, kwaliteit, journaal } = o;
  const meting = o.meting || require('../../meting');
  const functies = o.functies || require('../../functies');
  const backup = o.backup || require('../../backupstand');
  const dataDir = o.dataDir || process.env.RTG_DATA_DIR ||
    require('path').join(__dirname, '..', '..', 'data');
  const bronnen = maakBronnen({ meting, functies, slo, sonde, alarm, kwaliteit, journaal, backup, dataDir });

  const vak = () => {
    if (!db.data.commandProeven || typeof db.data.commandProeven !== 'object') db.data.commandProeven = {};
    return db.data.commandProeven;
  };
  const schakelkast = () => ((db.data.techniek || {}).functies) || {};

  /* ---------- het oordeel over een vermogen ---------- */
  function beoordeel(v, snap, staat) {
    const bevindingen = [];
    for (const b of v.bronnen) {
      const lezer = bronnen.LEZERS[b];
      const r = lezer && lezer(v, snap, staat);
      if (r) bevindingen.push(r);
    }
    for (const a of (v.alarmen || [])) { const r = bronnen.vanAlarm(a, snap); if (r) bevindingen.push(r); }
    const p = vanProef(v, vak()[v.id]); if (p) bevindingen.push(p);

    /* Alleen bevindingen MET een oordeel dragen de uitslag. De schakelkast zegt
       iets nuttigs (drie diensten staan bewust uit) zonder iets over gezondheid
       te zeggen -- uit is een keuze, geen storing. */
    const met = bevindingen.filter(b => b.oordeel);
    let graad = met.reduce((g, b) => hoger(g, b.graad), 'onbekend');
    if (v.graadPlafond && GRAAD.indexOf(graad) > GRAAD.indexOf(v.graadPlafond)) graad = v.graadPlafond;
    /* `!w ||` is geen netheid: zonder dat stuk pakt de reduce zijn EERSTE
       element nooit ('in orde' is niet erger dan 'in orde'), en dan stond elk
       gezond vermogen op "niet vast te stellen". Gevonden door de eerste proef. */
    const ergste = met.reduce((w, b) => (!w || ERGER[b.oordeel] > ERGER[w]) ? b.oordeel : w, null);
    /* Twee kanten van dezelfde regel: niets gemeten wordt nooit groen, en een
       gevonden storing wordt nooit stil omdat de graad laag is.

       DE TWEEDE TAK IS EEN VANGNET EN GEEN WERKENDE REGEL, en dat hoort erbij
       te staan. Vandaag draagt geen enkele lezer een oordeel met graad
       `onbekend` -- wie niets heeft gemeten, geeft geen oordeel, en daar staat
       een toets op ("geen enkele bron geeft een oordeel dat zijn graad niet
       draagt"). Deze tak vangt de lezer die dat ooit wél doet. Hij is dus met
       opzet niet door een mutatie te raken; het gat zit een laag lager en is
       daar afgedekt. */
    const oordeel = !ergste ? NIET : (graad === 'onbekend' && ergste === 'in orde') ? NIET : ergste;

    return { id: v.id, naam: v.naam, laag: v.laag, leuntOp: v.leuntOp, waarvoor: v.waarvoor,
      oordeel, graad, bevindingen,
      moetOpnieuw: !!(p && p.moetOpnieuw), vervallen: (p && p.vervallen) || null,
      bewijs: { graad, plafond: v.graadPlafond || null, houdbaarUren: v.proefHoudbaarUren,
        bronnen: bevindingen.map(b => ({ bron: b.bron, graad: b.graad, at: b.at, zegtNiet: b.zegtNiet })),
        drempels: bronnen.D } };
  }

  /* ---------- de hele kaart ---------- */
  function stand() {
    const snap = bronnen.snapshot();
    const staat = schakelkast();
    const per = {};
    const rijen = VERMOGENS.map(v => { const r = beoordeel(v, snap, staat); per[v.id] = r; return r; });

    /* DE DOORWERKING, pas nu: hij heeft alle oordelen nodig. Hij kleurt niets
       rood -- hij noemt het vermogen verderop in de keten dat storing heeft,
       zodat een vermogen dat zelf klopt niet als oorzaak wordt aangezien. */
    for (const r of rijen) {
      r.geraakt = ketenVan(r.id).filter(x => per[x] && per[x].oordeel === 'storing');
      r.taal = taal(OP_ID[r.id], Object.assign({}, r, { geraakt: r.geraakt.map(g => OP_ID[g]) }));
    }

    const storing = rijen.filter(r => r.oordeel === 'storing');
    const letOp = rijen.filter(r => r.oordeel === 'let op');
    const niet = rijen.filter(r => r.oordeel === NIET);
    const m = snap.meting.ok ? snap.meting.waarde : null;

    /* Een alarm dat aan geen vermogen hangt, verdwijnt hier NIET: een alarm dat
       afgaat terwijl de kaart groen staat, is het geval waarvoor zij bestaat. */
    const losseAlarmen = snap.alarm.ok
      ? (snap.alarm.waarde.alarmen || []).filter(a => a.actief && !vermogenVanAlarm(a.id))
        .map(a => ({ id: a.id, naam: a.naam, ernst: a.ernst, wat: a.wat }))
      : [];

    return {
      at: new Date().toISOString(),
      oordeel: storing.length ? 'storing' : letOp.length ? 'let op'
        : niet.length === rijen.length ? NIET : 'in orde',
      tel: { vermogens: rijen.length, storing: storing.length, letOp: letOp.length,
        nietVastTeStellen: niet.length, moetOpnieuw: rijen.filter(r => r.moetOpnieuw).length },
      vermogens: rijen,
      alarmenBuitenDeKaart: losseAlarmen,
      /* WAT DEZE KAART NIET DEKT hoort op het scherm en niet in een voetnoot:
         verkeer dat onder geen enkele functie valt, valt onder geen vermogen. */
      dekking: { venster: m ? m.venster : null,
        buitenDeFunctiecatalogus: m && m.buiten
          ? { verzoeken: m.buiten.verzoeken, fouten5xx: m.buiten.fouten5xx, wat: m.buiten.namen.join(', ') }
          : null },
      graden: GRAAD,
      let: 'Deze kaart meet niets zelf. Elk getal komt uit een laag die er al was, en elke bron draagt ' +
        'erbij wat hij NIET aantoont. Een vermogen zonder bewijs staat op "' + NIET + '" en niet op groen.'
    };
  }

  function vermogen(id) {
    if (!OP_ID[id]) return { error: 'Dat vermogen kennen we niet.', status: 404 };
    return stand().vermogens.find(v => v.id === id);
  }

  /* De uitslag gaat het journaal in, ook als er niets te controleren viel: een
     ronde die niets deed maar als "gecontroleerd" in iemands geheugen blijft
     hangen, is erger dan geen ronde. */
  async function controleer(id, door) {
    const v = OP_ID[id];
    if (!v) return { error: 'Dat vermogen kennen we niet.', status: 404 };
    const uit = await draaiProef(v, { sonde, journaal, kwaliteit, backup, dataDir });
    const rij = { id: v.id, at: new Date().toISOString(), door: door || 'onbekend',
      gedaan: uit.gedaan, nietGedaan: uit.nietGedaan, bevindingen: uit.bevindingen,
      bewijzend: uit.bewijzend, uitslag: uit.uitslag };
    vak()[v.id] = rij;
    save();
    journaal.noteer({ actie: 'gezondheid controleren', actor: rij.door, niveau: 'hand',
      objectType: 'vermogen', objectId: v.id,
      reden: rij.uitslag + (uit.bewijzend ? '' : ' -- geen bewijzende proef beschikbaar') });
    return Object.assign({ vermogen: v.id, naam: v.naam }, rij);
  }

  return { stand, vermogen, controleer, VERMOGENS, PROEVEN, GRAAD, NIET };
}

module.exports = { maakGezondheid, GRAAD, NIET };
