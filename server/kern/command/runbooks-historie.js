/* DE RONDES TERUGLEZEN -- de samenvatting van een herstelronde, de lijst, en de
   uitslag van de verificatie die er achteraf bij hoort.

   Apart van ./runbooks.js omdat het een andere handeling is: dat bestand VOERT
   een recept uit (kandidaten kiezen, schrijven, terugdraaien), dit leest terug
   wat er is gebeurd. Het is eruit geknipt toen de verificatie erbij kwam en dat
   bestand door de omvangsgrens ging; de naad lag er al.

   DE VERIFICATIE HOORT BIJ DE RONDE en niet ernaast. ./transactie.js schrijft
   hem hier terug zodra hij hem heeft. Een tweede lijst met uitslagen zou op een
   dag iets anders zeggen over dezelfde ronde -- en dan is niet te achterhalen
   welke van de twee de ronde werkelijk beschrijft. */
'use strict';

function maakHistorie({ draaien, save }) {
  function samenvatting(run) {
    return { id: run.id, at: run.at, runbook: run.runbook, naam: run.naam, droog: run.droog,
      door: run.door, reden: run.reden, niveau: run.niveau, score: run.oordeel ? run.oordeel.score : null,
      geraakt: run.geraakt.length, totaalKandidaten: run.totaalKandidaten,
      teruggedraaid: run.teruggedraaid, terugDoor: run.terugDoor || null,
      /* null is hier een UITSLAG en geen leegte: deze ronde is niet langs een
         verificatie gekomen. Dat is precies wat je wil zien bij een oude ronde
         van voor de transactie, of bij een ronde die buiten dat pad om liep. */
      verificatie: run.verificatie || null,
      voorbeelden: run.geraakt.slice(0, 8) };
  }

  const runs = (n) => draaien().slice().reverse().slice(0, n || 25).map(samenvatting);

  const run = (id) => {
    const r = draaien().find(x => x.id === String(id));
    return r ? Object.assign(samenvatting(r), { geraaktVolledig: r.geraakt }) : null;
  };

  function noteerVerificatie(runId, v) {
    const r = draaien().find(x => x.id === String(runId));
    if (!r) return false;
    r.verificatie = v;
    if (save) save();
    return true;
  }

  return { samenvatting, runs, run, noteerVerificatie };
}

module.exports = { maakHistorie };
