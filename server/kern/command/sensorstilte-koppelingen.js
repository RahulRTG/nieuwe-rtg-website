/* DE KOPPELINGEN VAN DE STILLE SENSOR -- de lagen die geen eigen tikker hebben.

   Afgesplitst van ./sensorstilte.js langs zijn natuurlijke naad: daar staan de
   tikkers en hun rondes, hier wat van BUITEN de tikkers komt. Drie dingen:
     - het schild naast de meting: verkeer dat de meting telt en het schild niet
       ziet, is een schild dat niet meer in de keten hangt;
     - de automatische noodrem: uitgezet is "uit", nooit een levende verdediging;
     - meldingen die verloren gaan (schild zonder journaal, een journaal dat niet
       kan bewaren) -- en pas een volgende aankomst bewijst de terugkeer. */
'use strict';

/* Verkeer zonder schild: zoveel verzoeken in de meting terwijl het schild er
   geen enkele zag. Onder de drempel is het te weinig om iets te zeggen. */
const SCHILD_DREMPEL = 20;

const koppeling = { verloren: new Map(), schild: null, noodrem: null };

function meldingStaat(bron) {
  let v = koppeling.verloren.get(bron);
  if (!v) { v = { verloren: 0, laatstVerloren: 0, laatstAangekomen: 0 }; koppeling.verloren.set(bron, v); }
  return v;
}
/* Een melding die nergens aankwam, bv. omdat het beveiligingsjournaal nog niet
   (of niet meer) aan het schild hangt (opzet/schildwacht.js). */
function verloren(bron) {
  const v = meldingStaat(bron);
  v.verloren += 1; v.laatstVerloren = Date.now();
}
/* HERSTEL IS EEN NIEUWE GESLAAGDE MELDING, geen gewist alarm. Pas als er na
   de laatste verloren melding weer een aankomt, is de bron terug; de teller
   blijft staan als spoor (WEERBAARHEID.md par. 9e, controleerbare terugkeer). */
function aangekomen(bron) {
  const v = koppeling.verloren.get(bron);
  if (v) v.laatstAangekomen = Date.now();
}

/* Het schild ziet ELK verzoek dat binnenkomt (kern/schild.js telt vóór de
   uitzondering voor localhost). Twee tellers: wat het schild zag en wat de
   meting telde. */
function koppelSchild({ schildVerzoeken, metingVerzoeken }) {
  koppeling.schild = { schildVerzoeken, metingVerzoeken, vorig: null };
}

/* De automatische noodrem (server/beveiliging-noodrem.js). Uitzetten mag, met
   de eigenaar en een passkey -- maar dan staat hij hier als "uit". */
function koppelNoodrem(staatAan) { koppeling.noodrem = staatAan; }

/* Alleen de weging van het alarm schuift het vergelijkpunt op (`schuif`).
   Een lezing van het bord of de meetroute krijgt het laatste oordeel terug:
   twee lezers die elk een stukje verschil opeten, zien samen nooit de drempel. */
function schildOordeel(schuif) {
  const k = koppeling.schild;
  if (!k) return null;
  if (!schuif) return k.laatste || { stil: false, reden: 'nog niet gewogen' };
  let schildTelling, metingTelling;
  try { schildTelling = Number(k.schildVerzoeken()); metingTelling = Number(k.metingVerzoeken()); }
  catch (e) { k.laatste = { stil: true, reden: 'de tellers van schild of meting konden niet worden gelezen: ' + e.message }; return k.laatste; }
  const vorig = k.vorig;
  k.vorig = { s: schildTelling, metingTelling };
  if (!vorig) k.laatste = { stil: false, reden: 'eerste meting, nog geen verschil' };
  else {
    const ds = schildTelling - vorig.s, dm = metingTelling - vorig.metingTelling;
    k.laatste = dm >= SCHILD_DREMPEL && ds === 0
      ? { stil: true, reden: dm + ' verzoeken in de meting sinds de vorige weging, en het schild zag er geen enkele' }
      : { stil: false, reden: 'schild +' + ds + ', meting +' + dm };
  }
  return k.laatste;
}

/* De rijen voor het oordeel van ./sensorstilte.js. */
function rijen(schuif) {
  const uit = [];
  const sch = schildOordeel(schuif);
  if (sch) uit.push({ naam: 'schild', wat: 'het schild ziet het binnenkomende verkeer', stand: sch.stil ? 'stil' : 'levend', reden: sch.reden });
  if (koppeling.noodrem) {
    let aan; try { aan = !!koppeling.noodrem(); } catch (e) { aan = null; }
    uit.push({ naam: 'noodrem', wat: 'de automatische noodrem bij brute force staat paraat',
      stand: aan === null ? 'stil' : aan ? 'levend' : 'uit',
      reden: aan === null ? 'de stand van de noodrem kon niet worden gelezen' : aan ? 'staat aan' : 'uitgezet door de eigenaar' });
  }
  for (const [bron, v] of koppeling.verloren) {
    const terug = v.laatstAangekomen >= v.laatstVerloren;
    uit.push({ naam: 'melding:' + bron, wat: 'meldingen van ' + bron + ' komen aan', stand: terug ? 'levend' : 'stil',
      reden: v.verloren + ' meldingen gingen verloren' + (terug ? '; daarna kwam er weer een aan' : '') });
  }
  return uit;
}

/* Alleen voor toetsen. */
function wis() { koppeling.verloren.clear(); koppeling.schild = null; koppeling.noodrem = null; }

module.exports = { SCHILD_DREMPEL, verloren, aangekomen, koppelSchild, koppelNoodrem, rijen, wis };
