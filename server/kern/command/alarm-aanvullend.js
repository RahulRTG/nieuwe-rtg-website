'use strict';

/* Niet-HTTP-signalen delen de alarmweger, maar niet de SLO-berekening. Deze
   adapter voegt hun bevindingen via dezelfde probeer-grens toe. */
function voegAanvullendeAlarmcontrolesToe(probeer, invoer) {
  const { slo, kwaliteit, d } = invoer;
  probeer('gegevens-kapot', 'Er staan defecten in de gegevens', 'laag', () => {
    if (!kwaliteit) return null;
    const tel = kwaliteit.meet().tel;
    return tel.defecten > d.defectenDrempel
      ? tel.defecten + ' defecten over ' + tel.soorten + ' bevinding(en); de drempel staat op ' +
        d.defectenDrempel : null;
  });
  probeer('capability-gezakt', 'Een capability-SLO is niet gehaald', 'hoog', () => {
    const gezakt = (slo.stand().capabilities || []).filter(x => x.oordeel === 'niet gehaald');
    return gezakt.length ? gezakt.map(x => x.capability).join(', ') +
      ' mist beschikbaarheid of latency' : null;
  });
  probeer('capability-verouderd', 'Capabilitybewijs is verouderd', 'midden', () => {
    const verouderd = (slo.stand().capabilities || []).filter(x =>
      (x.reasons || []).includes('STALE_MEASUREMENTS') && x.availability && x.availability.eligible > 0);
    return verouderd.length ? verouderd.map(x => x.capability).join(', ') +
      ' heeft geen verse meting' : null;
  });
  /* De stille sensor (./sensorstilte.js). In de schaduw tot het alarmkanaal
     geregeld is (WEERBAARHEID.md par. 9a): dan berekend en getoond, niet
     gemeld. Een stille sensor is een alarm, nooit vanzelf een zwaardere stand. */
  probeer('sensor-stil', 'Een beveiligingssensor is stil', 'hoog', () => {
    const stilte = require('./sensorstilte');
    const b = stilte.bevinding();   // ook in de schaduw gewogen, zodat het bord hem toont
    return stilte.alarmActief() ? b : null;
  });
}

module.exports = { voegAanvullendeAlarmcontrolesToe };
