/* De journalen die het ankerblok draagt (./ankerdienst.js), hoe ze als ankerbare
   rij gelezen worden, en hun bewaring. Geknipt uit ankerdienst.js toen het
   API-spoor en het besluitjournaal erbij kwamen (audit P1-3c) en dat bestand
   over de 10 kB van keuringsregel 13 ging. */
'use strict';

/* DE ZEGELKETENS als ankerbare rij (audit P1-3c). Het API-spoor en het
   besluitjournaal van RTG Command (kern/command/journaal.js) staan OUDSTE-EERST
   en dragen `vorig`/`zegel` in plaats van `vorige`/`hash`, zonder volgnummer.
   Het volgnummer komt uit de teller die naast het venster doorloopt
   (`commandJournaalTotaal`): de laatste regel is regel `totaal`. Wie de kop
   afknipt en de teller laat staan, schuift elke regel een plek op en de
   geankerde regel krijgt een andere zegel; wie de teller mee verlaagt, staat
   lager dan het anker. Beide vallen op.

   Let op wat dat betekent na een AVG-wissing: die herzegelt het venster
   (kern/command/journaal.js `wisActor`), dus een anker van daarvoor rekent dan
   af als `herschreven`. Dat is met opzet geen groen: of het die wissing was,
   beoordeelt een mens, en die zet daarna met de hand een nieuw anker
   (/api/office/anker/post). */
function zegelRij(lijst, totaal) {
  const l = Array.isArray(lijst) ? lijst : [];
  const t = Math.max(Number(totaal) || 0, l.length);
  const uit = [];
  for (let i = l.length - 1; i >= 0; i--) {
    const r = l[i];
    uit.push({ nr: t - (l.length - 1 - i), hash: r && r.zegel ? r.zegel : null, at: r && r.at });
  }
  return uit;
}

/* De journalen, met de weg naar hun regels. Elke weg krijgt de DATA van de
   ankerdienst en niet de database: de deur naar de opslag blijft bij
   ./ankerdienst.js. Staat er een journaal bij, dan
   hoort hij HIER erbij -- en de dekking in keten-anker.js CONTROL hoort mee te
   bewegen, want de noemer is het aantal journalen en niet het aantal dat we
   toevallig hebben aangesloten. */
const JOURNALEN = {
  inzageLog: (d) => d.inzageLog || [],
  securityLog: (d) => d.securityLog || [],
  handelingLog: (d) => d.handelingLog || [],
  /* livingLab en de boardroom-journalen staan PER LAB respectievelijk PER LID.
     Een blok met duizend koppen is geen anker maar een tweede database, dus
     nemen we hier de gezamenlijke kop: de hash over alle koppen samen. Verdwijnt
     er in één lid-journaal een regel, dan verandert die gezamenlijke hash. */
  livingLabAudit: (d) => (d.livingLab && d.livingLab.audit) || [],
  apiSpoor: (d) => {
    const a = d.apiSpoor || {};
    return zegelRij(a.commandJournaal, a.commandJournaalTotaal);
  },
  commandJournaal: (d) => zegelRij(d.commandJournaal, d.commandJournaalTotaal)
};

/* DE BEWARING PER JOURNAAL (audit P2-5): een geankerde regel die verdween, is
   alleen in orde als het journaal vol zit of de regel verjaard is
   (lib/keten-anker.js). De getallen komen van de schrijvers:
   inzagelog-bewaring.js, lib/handelingsspoor.js (de dagen uit bewaarbeleid.js),
   kern/identiteit/inlogherkomst.js, kern/livinglab/opslag.js en
   kern/command/journaal.js. */
const BEWARING = {
  inzageLog: { max: 200000, dagen: 730 },
  securityLog: { max: 5000 },
  handelingLog: { max: 50000, dagen: 365 },
  livingLabAudit: { max: 20000 },
  apiSpoor: { max: 5000 },
  commandJournaal: { max: 5000 }
};

module.exports = { JOURNALEN, BEWARING, zegelRij };
