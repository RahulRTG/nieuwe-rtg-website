/* DE STILLE SENSOR -- een wachter die stopt, mag niet klinken als een wachter
   die niets ziet.

   WEERBAARHEID.md par. 9 punt 1 en par. 9a stap 2. Het alarm (./alarm.js)
   draagt tien controles en ze lezen allemaal een UITSLAG: is er een doel
   gezakt, is de keten gebroken. Geen van de tien vroeg of de laag die die
   uitslag levert nog draait. Een tikker die stilvalt, een schild dat niet meer
   in de keten hangt of een melding die nergens aankomt, geeft dezelfde groene
   uitslag als een rustige nacht.

   EEN SENSOR STEMPELT ZIJN RONDE, NIET ZIJN VONDST. Een schild dat niets vangt
   leeft gewoon; een schild dat geen verzoek meer ziet terwijl de meting er
   honderd telt, is stil. Daarom vraagt deze module nooit "is er iets gemeld"
   maar "is er gekeken".

   DRIE STANDEN PER SENSOR, en de derde is de belangrijkste:
     levend  -- gestempeld binnen zijn eigen venster;
     stil    -- verwacht, en niet gestempeld (of fouten zonder geslaagde ronde);
     uit     -- bewust niet gestart (./tikkerstand.js in een meetserver of
                toets). Dat is een uitspraak en geen stilte, en het telt dus
                ook niet als levend.
   Een sensor die nooit is aangemeld, staat er niet in: een lijst die zichzelf
   vult met wat er toevallig draait, kan een weggehaalde sensor niet missen.
   Daarom staan de VERWACHTE sensoren hieronder bij naam (VERWACHT).

   WAT DEZE MODULE NIET DOET. Hij zet geen stand en hij blokkeert niets. Een
   ontbrekende hartslag is geen bewijs van een aanval; het kan ook een storing
   zijn (WEERBAARHEID.md par. 9c). De uitkomst is een alarm, en zolang het
   alarmkanaal niet geregeld is staat zelfs dat alarm in de schaduw: hij wordt
   berekend en getoond, maar niet gemeld (`alarmActief()` hieronder, par. 9a). En
   hij kan zijn EIGEN uitval niet zien: als het alarm stopt, ziet alleen de
   externe sonde dat (scripts/sonde.js, `bewaking`). */
'use strict';

/* De verwachte sensoren, met het venster waarbinnen een ronde hoort te komen.
   Drie keer de eigen periode: een gemiste tik is ruis, drie op rij niet. */
const VERWACHT = {
  alarm: { wat: 'het alarm weegt zijn controles', periodeMs: 60000 },
  canary: { wat: 'de uitrol-canary weegt lopende uitrollen', periodeMs: 30000 },
  auditwacht: { wat: 'de auditwacht controleert de journalen', periodeMs: 5 * 60000 },
  wacht: { wat: 'De Wacht meet het verkeer voor bord en lastafworp', periodeMs: 10000 }
};
const VENSTERS = 3;

/* Verkeer zonder schild: zoveel verzoeken in de meting terwijl het schild er
   geen enkele zag. Onder de drempel is het te weinig om iets te zeggen. */
const SCHILD_DREMPEL = 20;

const staat = { sensoren: new Map(), verloren: new Map(), schild: null, noodrem: null };

const nu = () => Date.now();

function sensor(naam) {
  let s = staat.sensoren.get(naam);
  if (!s) { s = { naam, gestart: false, uit: false, laatst: null, rondes: 0, fouten: 0, laatsteFout: null }; staat.sensoren.set(naam, s); }
  return s;
}

/* Aanmelden bij het starten van de lus. `uit` = bewust niet gestart. */
function aangemeld(naam, { uit = false, periodeMs } = {}) {
  const s = sensor(naam);
  s.gestart = !uit; s.uit = !!uit;
  if (periodeMs) s.periodeMs = periodeMs;
  return s;
}

/* Een geslaagde ronde. */
function ronde(naam) {
  const s = sensor(naam);
  s.laatst = nu(); s.rondes += 1;
}

/* Een mislukte ronde. Hij wordt geteld en niet geslikt; de lus zelf breekt
   nooit (./tikker.js). */
function fout(naam, e) {
  const s = sensor(naam);
  s.fouten += 1;
  s.laatsteFout = { op: new Date(nu()).toISOString(), reden: String((e && e.message) || e || 'onbekend').slice(0, 160) };
}

/* Een melding die nergens aankwam, bv. omdat het beveiligingsjournaal nog niet
   (of niet meer) aan het schild hangt (opzet/schildwacht.js). */
function meldingStaat(bron) {
  let v = staat.verloren.get(bron);
  if (!v) { v = { verloren: 0, laatstVerloren: 0, laatstAangekomen: 0 }; staat.verloren.set(bron, v); }
  return v;
}
function verloren(bron) {
  const v = meldingStaat(bron);
  v.verloren += 1; v.laatstVerloren = nu();
}
/* HERSTEL IS EEN NIEUWE GESLAAGDE MELDING, geen gewist alarm. Pas als er na
   de laatste verloren melding weer een aankomt, is de bron terug; de teller
   blijft staan als spoor (WEERBAARHEID.md par. 9e, controleerbare terugkeer). */
function aangekomen(bron) {
  const v = staat.verloren.get(bron);
  if (v) v.laatstAangekomen = nu();
}

/* Het schild ziet ELK verzoek dat binnenkomt (kern/schild.js telt vóór de
   uitzondering voor localhost). Twee tellers: wat het schild zag en wat de
   meting telde. */
function koppelSchild({ schildVerzoeken, metingVerzoeken }) {
  staat.schild = { schildVerzoeken, metingVerzoeken, vorig: null };
}

/* Alleen de weging van het alarm schuift het vergelijkpunt op (`schuif`).
   Een lezing van het bord of de meetroute krijgt het laatste oordeel terug:
   twee lezers die elk een stukje verschil opeten, zien samen nooit de drempel. */
/* De automatische noodrem (server/beveiliging-noodrem.js). Uitzetten mag, met
   de eigenaar en een passkey -- maar dan staat hij hier als "uit", en nooit als
   een levende verdediging. */
function koppelNoodrem(staatAan) { staat.noodrem = staatAan; }

function schildOordeel(schuif) {
  const k = staat.schild;
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

/* Het oordeel per sensor. Leest alleen; met `schuif` schuift hij ook het
   vergelijkpunt van het schild op (alleen de weging van het alarm doet dat). */
function oordeel({ schuif = false } = {}) {
  const t = nu();
  const rijen = [];
  for (const [naam, v] of Object.entries(VERWACHT)) {
    const s = staat.sensoren.get(naam);
    const periode = (s && s.periodeMs) || v.periodeMs;
    const venster = periode * VENSTERS;
    let stand, reden;
    if (!s || (!s.gestart && !s.uit)) { stand = 'stil'; reden = 'verwacht, maar nooit gestart'; }
    else if (s.uit) { stand = 'uit'; reden = 'bewust niet gestart (meetserver of toets)'; }
    else if (s.laatst === null) {
      const sinds = s.gestartOp ? t - s.gestartOp : null;
      stand = sinds !== null && sinds < venster ? 'levend' : 'stil';
      reden = s.fouten ? s.fouten + ' mislukte rondes en nog geen geslaagde' : 'gestart, nog geen ronde';
    } else if (t - s.laatst > venster) {
      stand = 'stil'; reden = 'laatste geslaagde ronde ' + Math.round((t - s.laatst) / 1000) + ' s geleden, venster ' + Math.round(venster / 1000) + ' s';
    } else { stand = 'levend'; reden = s.rondes + ' rondes, laatste ' + Math.round((t - s.laatst) / 1000) + ' s geleden'; }
    rijen.push({ naam, wat: v.wat, stand, reden, laatst: s && s.laatst ? new Date(s.laatst).toISOString() : null,
      fouten: s ? s.fouten : 0, laatsteFout: s ? s.laatsteFout : null });
  }
  const sch = schildOordeel(schuif);
  if (sch) rijen.push({ naam: 'schild', wat: 'het schild ziet het binnenkomende verkeer', stand: sch.stil ? 'stil' : 'levend', reden: sch.reden });
  if (staat.noodrem) {
    let aan; try { aan = !!staat.noodrem(); } catch (e) { aan = null; }
    rijen.push({ naam: 'noodrem', wat: 'de automatische noodrem bij brute force staat paraat',
      stand: aan === null ? 'stil' : aan ? 'levend' : 'uit',
      reden: aan === null ? 'de stand van de noodrem kon niet worden gelezen' : aan ? 'staat aan' : 'uitgezet door de eigenaar' });
  }
  for (const [bron, v] of staat.verloren) {
    const terug = v.laatstAangekomen >= v.laatstVerloren;
    rijen.push({ naam: 'melding:' + bron, wat: 'meldingen van ' + bron + ' komen aan', stand: terug ? 'levend' : 'stil',
      reden: v.verloren + ' meldingen gingen verloren' + (terug ? '; daarna kwam er weer een aan' : '') });
  }
  return rijen;
}

/* ACTIEF OF SCHADUW. Tot het alarmkanaal geregeld is (WEERBAARHEID.md par. 9a
   en 9b) wordt de bevinding berekend en getoond, maar niet als alarm gemeld.
   Wie hem aanzet, zet hem aan voor dit proces; er is geen route die hem zet. */
function alarmActief(env) {
  return String((env || process.env).RTG_SENSORSTILTE_ACTIEF || '') === '1';
}

/* De vorm voor het alarm: null als niets stil is, anders de tekst. */
function bevinding() {
  const stil = oordeel({ schuif: true }).filter(r => r.stand === 'stil');
  return stil.length ? stil.map(r => r.naam + ': ' + r.reden).join('; ') : null;
}

function stand() {
  const rijen = oordeel();
  return { actief: alarmActief(), stil: rijen.filter(r => r.stand === 'stil').map(r => r.naam), sensoren: rijen,
    let: 'een sensor stempelt zijn ronde en niet zijn vondst; "uit" is bewust niet gestart en telt niet als levend. ' +
      'Zijn eigen uitval ziet dit proces niet: dat doet de externe sonde.' };
}

/* Een tikker die is aangemeld krijgt zijn starttijd, zodat "nog geen ronde"
   binnen het eerste venster geen stilte is. */
function gestart(naam, periodeMs) {
  const s = aangemeld(naam, { periodeMs });
  s.gestartOp = nu();
  return s;
}

/* Alleen voor toetsen. */
function _wis() { staat.sensoren.clear(); staat.verloren.clear(); staat.schild = null; staat.noodrem = null; }

module.exports = { VERWACHT, VENSTERS, SCHILD_DREMPEL, aangemeld, gestart, ronde, fout, verloren, aangekomen, koppelSchild, koppelNoodrem,
  oordeel, bevinding, stand, alarmActief, _wis };
