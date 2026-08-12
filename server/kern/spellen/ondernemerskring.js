/* DE LOKALE ONDERNEMERSKRING -- wie hier ooit een zaak had.

   Fase D (GAMEHALL.md 12.9). En hij begint bij wat hij NIET is, want de naam
   trekt twee dingen aan die geen van beide mogen.

   ============ HIJ IS GEEN CONTACTENLIJST ============

   ./kring.js beantwoordt de vraag "wie kun je buiten een potje om bereiken", en
   het antwoord is: vrienden, klasgenoten, hetzelfde gezin. Daaronder staat een
   regel die deze laag NIET mag omzeilen: EEN POTJE GEEFT GEEN NIEUW RECHT OM
   IEMAND TE BEREIKEN. De wachtrij koppelt willekeurige spelers, en de RTF-app
   bevat tieners die met opzet onvindbaar zijn in de zoeker.

   Een ondernemerskring die je met je oud-medespelers laat praten, is precies de
   deur die daar dichtzit. Dus: hier staan codenamen en geen mensen. Er is geen
   knop om iemand te bereiken, geen uitnodiging, geen verzoek. Wie iemand wil
   spreken, doet dat langs ./kring.js of niet.

   ============ HIJ IS GEEN RANGLIJST ============

   Geen vermogen, geen omzet, geen aantal, geen volgorde van beste naar minste.
   De lijst staat op de tijd waarin mensen er begonnen -- oudste eerst -- want
   dat is een geschiedenis en geen wedstrijd. VERHAAL.md is er ondubbelzinnig
   over: wat blijft hangen is "weet je nog dat ik als afwasser bij jou begon",
   niet "ik had 480 miljoen".

   ============ WAT HIJ WEL IS ============

   Een naambord. In hoofdstuk 10 loop je na vijftien jaar door de stad en zie je
   wat er staat; ./stadsgeheugen.js is dat gebouw en dit zijn de mensen. Twee
   lagen, twee grenzen, en de tweede is strenger -- want hier STAAT wel een
   persoon in.

   DUS GELDT DE 18+-POORT, per persoon (./grens.js `progressieMag`). Dat is het
   verschil met het stadsgeheugen, dat er woordelijk buiten valt omdat daar geen
   persoon in staat. Onder de grens blijft alles speelbaar; er wordt alleen
   niets van bewaard.

   EN ER KOMT GEEN BEDRAG MEE. Wat bewaard wordt is dat je er was, in welke
   sectoren je zat en of je het aan iemand doorgaf -- feiten over tijd en over
   wat je deed, en dat is de enige permanentie die VERHAAL.md paragraaf 1
   toelaat. */
'use strict';

/* Hoe lang een naam op het bord blijft. In CAMPAGNES en niet in dagen, precies
   zoals het stadsgeheugen slijt: anders vergeet een stad zijn ondernemers
   doordat er even niemand speelde. Ruim, want een naambord dat na een maand
   leeg is, is geen naambord. */
const SLIJTAGE_POTJES = 60;

module.exports = ({ db, save, progressieMag, GEEN_PROGRESSIE }) => {
  const alle = () => {
    if (!db.data.ondernemerskring || typeof db.data.ondernemerskring !== 'object')
      db.data.ondernemerskring = {};
    return db.data.ondernemerskring;
  };
  const schoon = (stad) => String(stad || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  const stadVan = (id) => {
    const s = schoon(id);
    const a = alle();
    if (!a[s]) a[s] = { stad: s, potjes: 0, leden: [] };
    return a[s];
  };
  const mag = (handle) => !!progressieMag(handle);

  /* EEN AFGELOPEN CAMPAGNE BIJSCHRIJVEN. Dezelfde vorm en dezelfde reden als
     `noteerUitslag`, `noteerLoopbaan` en het stadsgeheugen: idempotent, want een
     partij kan maar een keer klaar zijn.

     ELKE SPELER APART DOOR DE POORT. Een volwassene die met een tiener speelde
     komt op het bord; de tiener niet. Dat is de grens per PERSOON en niet per
     potje -- dezelfde lezing als in ./loopbaan.js, en de enige die klopt. */
  function noteerKring(potje, codenaamVan) {
    if (!potje || potje.status !== 'klaar' || potje.kringGenoteerd) return null;
    const stad = schoon(((potje.variant || {}).stad) || '');
    if (!stad) return null;
    const st = potje.staat || {};
    potje.kringGenoteerd = true;
    const s = stadVan(stad);
    s.potjes++;
    const erbij = [];
    for (const h of potje.spelers || []) {
      if (!mag(h)) continue;
      const rij = (st.vestigingen || {})[h] || [];
      const weg = (st.uit || {})[h];
      /* WIE HIER GEEN ZAAK HAD, KOMT NIET OP HET BORD. Niet als straf: een
         ondernemerskring van mensen die nooit iets begonnen is geen kring maar
         een deelnemerslijst, en die hoort bij de uitslag. */
      const overgedragen = weg && weg.naar && weg.overgedragen > 0;
      if (!rij.length && !overgedragen) continue;
      const codenaam = codenaamVan(h);
      const sectoren = [...new Set(rij.map(v => v.sector))].sort();
      const bestaand = s.leden.find(x => x.codenaam === codenaam);
      if (bestaand) {
        bestaand.sinds = Math.min(bestaand.sinds, s.potjes);
        bestaand.laatst = s.potjes;
        bestaand.campagnes++;
        for (const sec of sectoren) if (!bestaand.sectoren.includes(sec)) bestaand.sectoren.push(sec);
        if (overgedragen) bestaand.doorgegeven = true;
      } else {
        s.leden.push({ codenaam, sinds: s.potjes, laatst: s.potjes, campagnes: 1,
          sectoren, doorgegeven: !!overgedragen });
        erbij.push(codenaam);
      }
    }
    save();
    return { stad: s.stad, potjes: s.potjes, erbij, leden: s.leden.length };
  }

  /* HOEVEEL ER NOG VAN OVER IS. Zelfde vorm als het stadsgeheugen: op de klok
     van de STAD. Wie lang niet meer meedeed zakt van het bord -- niet omdat hij
     iets verkeerd deed, maar omdat een naambord met iedereen die er ooit was
     geen naambord meer is. */
  const staatEr = (s, lid) => (s.potjes - (lid.laatst || 0)) < SLIJTAGE_POTJES;

  /* WAT ER OP HET BORD STAAT. Oudste eerst, want dat is een geschiedenis en
     geen wedstrijd. Wie er zelf op staat ziet dat -- de rest is codenaam. */
  function beeld(stad, handle, codenaamVan) {
    const s = alle()[schoon(stad)];
    const ik = handle && mag(handle) ? codenaamVan(handle) : null;
    if (!s) return { stad: schoon(stad), potjes: 0, leden: [], ik: null, uitleg: UITLEG };
    const leden = s.leden.filter(l => staatEr(s, l))
      .sort((a, b) => a.sinds - b.sinds || a.codenaam.localeCompare(b.codenaam))
      .map(l => ({ codenaam: l.codenaam, sectoren: l.sectoren.slice(),
        campagnes: l.campagnes, doorgegeven: !!l.doorgegeven, ik: l.codenaam === ik }));
    return { stad: s.stad, potjes: s.potjes, leden, ik, uitleg: UITLEG };
  }

  /* WIE STOPT, GAAT VAN HET BORD. Zijn eigen kant verdwijnt met hem -- dezelfde
     asymmetrie als in ./loopbaan.js. Wat anderen over een gedeelde campagne
     bewaren staat daar en niet hier. */
  function stoptErmee(codenaam) {
    let weg = 0;
    for (const s of Object.values(alle())) {
      const voor = s.leden.length;
      s.leden = s.leden.filter(l => l.codenaam !== codenaam);
      weg += voor - s.leden.length;
    }
    if (weg) save();
    return { weg };
  }

  const UITLEG = 'Wie hier een zaak had, staat op dit bord. Er staat geen bedrag '
    + 'bij en geen volgorde van beste naar minste: het is een geschiedenis, geen '
    + 'ranglijst. En het is geen contactenlijst -- iemand bereiken kan alleen als '
    + 'je dat buiten het spel om ook al kon.';

  return { noteerKring, beeld, stoptErmee, SLIJTAGE_POTJES, GEEN_PROGRESSIE };
};
module.exports.SLIJTAGE_POTJES = SLIJTAGE_POTJES;
