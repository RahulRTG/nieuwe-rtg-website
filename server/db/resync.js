/* Opslag, deel "resync": hoeveel er opnieuw ingelezen moet worden voordat het
   verkeer weer open mag.

   WAAROM DIT ER IS. De schrijfpoort sluit fail-closed, en dat blijft zo. Maar
   ELKE sluiting deed daarna hetzelfde: `laadAlles()` -- alle rijen uit kv, elke
   collectie ontsleuteld en geparsed. Op 9 september 2026 kostte dat op 100M
   leden 70 keer een volledige herlaadronde, en de dominante oorzaak was niet
   een storing maar de bedoelde sluiting van een achtergrondmutatie. Zolang die
   ronde loopt staat de poort dicht, dus de prijs van een correcte sluiting was
   een platformbrede 503-periode. Dat is de grootste schaalkost die de
   100M-ronde blootlegde, en HERSTEL zakte er als eerste op.

   DE TWEE SOORTEN, en het verschil zit in wat we over onze EIGEN kopie weten:

     ZWAAR   we weten niet meer of ons beeld klopt. Bij het opstarten (we hebben
             nog niets), na een flush- of commitfout, na een verbroken
             verbinding, na een poll- of listen-fout. Dan het volledige
             `laadAlles()` plus de venster-bijvulling.
     LICHT   we weten dat ons beeld klopte tot vlak voor de sluiting. Dat geldt
             voor de achtergrondmutatie: de poort ging dicht omdat WIJ iets
             muteerden buiten een requestcontext, herstelNu committeert dat eerst
             zelf, en daarna hoeven we alleen op te halen wat een ANDER proces
             intussen schreef. Dat is precies `haalNieuwer()`.

   DAT IS GEEN NIEUWE GARANTIE. `haalNieuwer()` is de weg die LISTEN/NOTIFY en de
   poll van twee seconden al continu gebruiken om andermans schrijfacties op te
   pikken -- inclusief grafstenen, drieweg-merge en de sessie-haak. Hij is hier
   niet zwakker dan daar; hij wordt alleen op een tweede moment ingezet.

   WAT NIET VERANDERT: de poort blijft dicht tot de resync klaar is, licht of
   zwaar. Er gaat hier nooit iets open dat anders dicht stond -- alleen korter. */
'use strict';

module.exports = function maakResync({ state, topUp, extern }) {
  /* Bij het opstarten hebben we per definitie niets toegepast: de eerste ronde
     is altijd zwaar. Twijfel valt hier ook altijd naar zwaar, nooit naar licht. */
  let zwaarNodig = true;
  let licht = 0, zwaar = 0;

  const haak = () => (typeof extern === 'function' ? extern() : null);

  return {
    /* Deze oorzaak zegt niets over de juistheid van onze kopie: de volgende
       resync moet alles opnieuw lezen. */
    eisZwaar() { zwaarNodig = true; },
    stand() { return { zwaarNodig, lichteResyncs: licht, zwareResyncs: zwaar }; },

    async voer(p) {
      await p.pool.query('SELECT 1');
      if (zwaarNodig || typeof p.haalNieuwer !== 'function') {
        const alles = await p.laadAlles();
        if (!alles) throw new Error('PostgreSQL bevat geen autoritatieve collecties.');
        state.setRuweData(alles);
        /* De venster-bijvulling uit het grootboek hoort bij een KOUDE start: zij
           dicht het gat tussen de kv-blob en het rij-voor-rij grootboek. Na onze
           eigen achtergrondmutatie is er geen zulk gat, dus die hoort niet op het
           lichte pad. */
        if (typeof topUp === 'function') await topUp();
        zwaar++;
      } else {
        await p.haalNieuwer(state.getRuweData(), haak());
        licht++;
      }
      await p.pool.query('SELECT 1');
      const cb = haak();
      if (cb) cb();
      zwaarNodig = false;
    }
  };
};
