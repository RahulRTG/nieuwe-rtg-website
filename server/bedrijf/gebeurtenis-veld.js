/* RTG Werk OS: DE GEWONE WEG naar de gebeurtenislaag.

   ./gebeurtenis.js is de deur met zijn eisen (actor verplicht, reden waar
   "waarom" de vraag is). Dit is het gemak erbovenop: velden zetten EN de
   gebeurtenis vastleggen in EEN aanroep, zodat een schrijver die twee niet uit
   elkaar kan laten lopen.

   ATOMAIR IN DE ZIN DIE HIER TELT. Is er een reden nodig en ontbreekt die, dan
   wordt er NIETS gezet -- ook het veld niet. Zou het veld wel veranderen en
   alleen de gebeurtenis worden geweigerd, dan staat het object in precies de
   toestand die deze hele laag onmogelijk moet maken: gewijzigd zonder
   geschiedenis. Daarom loopt werkVeld() eerst ALLE wijzigingen langs de poort
   voordat hij er een schrijft.

   Afgesplitst omdat gebeurtenis.js over de 10 kB ging; de naad is echt. */
'use strict';

const kern = require('./gebeurtenis');

/* ---- DE GEWONE WEG: velden zetten EN vastleggen ----

   `velden` is een object {veld: nieuweWaarde}. Per gewijzigd veld komt er een
   gebeurtenis met eventType `<objectType>.<veld>`; velden die niet veranderen
   leveren niets op (anders loopt het log vol ruis en wordt "er is iets
   veranderd" betekenisloos).

   ATOMAIR IN DE ZIN DIE HIER TELT: is er een reden nodig en ontbreekt die, dan
   wordt er NIETS gezet. Anders zou het object al veranderd zijn terwijl de
   geschiedenis wordt geweigerd -- en dat is de toestand die deze hele laag
   onmogelijk moet maken. */
function werkVeld(w, objectType, rij, velden, ctx) {
  const c = ctx || {};
  if (!rij || !rij.id) return { status: 500, error: 'Een mutatie zonder object bestaat niet.' };

  const wijzigingen = [];
  for (const [veld, waarde] of Object.entries(velden || {})) {
    const oud = kern.plat(rij[veld]);
    const nieuw = kern.plat(waarde);
    if (nieuw === undefined) continue;          // niet gevolgd type
    if (oud === nieuw) { kern.stand(w)[kern.standSleutel(objectType, rij.id, veld)] = nieuw; continue; }
    wijzigingen.push({ veld, oud, nieuw, waarde });
  }
  if (!wijzigingen.length) return { ok: true, gebeurtenissen: [], gewijzigd: 0 };

  // eerst de poort: alles of niets
  for (const wz of wijzigingen) {
    const et = objectType + '.' + wz.veld;
    if (kern.REDEN_VERPLICHT.has(et) && !String(c.reden || '').trim()) {
      return { status: 400, error: 'Waarom gebeurt dit?',
        uitleg: 'Een wijziging van ' + wz.veld + ' op een ' + objectType + ' hoort een reden te dragen.' };
    }
  }

  const uit = [];
  for (const wz of wijzigingen) {
    rij[wz.veld] = wz.waarde;
    const r = kern.werkMutatie(w, { objectType, objectId: rij.id,
      eventType: objectType + '.' + wz.veld,
      van: { [wz.veld]: wz.oud }, naar: { [wz.veld]: wz.nieuw },
      actor: c.actor, reden: c.reden, bron: c.bron });
    if (r.ok) { uit.push(r.gebeurtenis); kern.stand(w)[kern.standSleutel(objectType, rij.id, wz.veld)] = wz.nieuw; }
    else return r;
  }
  return { ok: true, gebeurtenissen: uit, gewijzigd: uit.length };
}

/* Een gebeurtenis die GEEN veldwijziging is: aangemaakt, gesloten, gekoppeld,
   iemand toegevoegd. Die dragen het verhaal dat een veld-diff niet vertelt --
   "contract C-882 gekoppeld" staat in geen enkel veld van het project. */
function werkFeit(w, objectType, objectId, verb, ctx, gegevens) {
  const c = ctx || {};
  return kern.werkMutatie(w, { objectType, objectId, eventType: objectType + '.' + verb,
    naar: gegevens || null, actor: c.actor, reden: c.reden, bron: c.bron });
}

/* De beginstand van een nieuw object vastleggen, zodat het vangnet hem niet
   later als ongemeten wijziging ziet. Geen gebeurtenis per veld: het object is
   ONTSTAAN, en dat is een gebeurtenis. */
function werkBeginstand(w, objectType, rij, velden) {
  for (const veld of velden || []) {
    const v = kern.plat(rij[veld]);
    if (v !== undefined) kern.stand(w)[kern.standSleutel(objectType, rij.id, veld)] = v;
  }
}


module.exports = { werkVeld, werkFeit, werkBeginstand };
