/* Commit-na-regie van een Magnaat-teamkamer: publiceer pas na een geslaagde
   opslagtransactie en houd alle publieke methoden op hetzelfde slotcontract. */
'use strict';

module.exports = H => {
  const { sseToCustomer, staat, tekst, publiek, metActueleStaat,
    maakBinnen, deelnemenBinnen, mijnBinnen, acties } = H;
  function seinNaCommit(kamerId) {
    if (typeof sseToCustomer !== 'function') return;
    const kamer = staat().kamers[tekst(kamerId, 100)];
    if (!kamer) return;
    const data = { scope: 'magnaat-teamkamer', id: kamer.id, revisie: kamer.revisie,
      status: kamer.status, kamer: publiek(kamer, kamer.hostKey, true) };
    for (const d of kamer.deelnemers) {
      try { sseToCustomer(d.key, 'sync', data); } catch (e) {}
    }
  }
  function bevestigNaCommit(uitkomst) {
    const klaar = antwoord => {
      if (antwoord && antwoord.ok && !antwoord.herhaald && antwoord.kamer) seinNaCommit(antwoord.kamer.id);
      return antwoord;
    };
    return uitkomst && typeof uitkomst.then === 'function' ? uitkomst.then(klaar) : klaar(uitkomst);
  }
  const onderSlot = werk => bevestigNaCommit(metActueleStaat(werk));
  const maak = (key, invoer) => onderSlot(() => maakBinnen(key, invoer));
  const deelnemen = (key, code) => onderSlot(() => deelnemenBinnen(key, code));
  const kiesRol = (...args) => onderSlot(() => acties.kiesRol(...args));
  const start = (...args) => onderSlot(() => acties.start(...args));
  const actie = (...args) => onderSlot(() => acties.actie(...args));
  const bedien = (...args) => onderSlot(() => acties.bedien(...args));
  /* Het detail leest onder het slot omdat een SSE eerder kan aankomen dan de
     lokale LISTEN/NOTIFY-cache. De overzichtslijst blijft goedkoop; de SSE
     draagt daarvoor al een veilige samenvatting. */
  const mijn = (key, kamerId) => kamerId
    ? metActueleStaat(() => mijnBinnen(key, kamerId))
    : mijnBinnen(key, null);
  return { maak, deelnemen, kiesRol, start, actie, bedien, mijn };
};
