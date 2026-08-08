/* RTF Living Lab, deel "apparatuurgebruik": reserveren, uitgifte en innemen.

   ./apparatuur.js ernaast houdt het REGISTER bij -- wat er is, wie erop bevoegd
   is, wanneer het is gekalibreerd, wat eraan stuk is. Dit bestand is de kant die
   dat register gebruikt, en het is de kant waar de poorten dichtgaan.

   VIER POORTEN VOOR EEN RESERVERING, in de volgorde die een gebruiker het meest
   helpt: bestaat het, doet het het, mag jij het, en is het vrij.

   EN DE REDEN DAT DIT BESTAND BESTAAT: de KALIBRATIESTAND wordt IN de
   reservering geschreven, niet erbij opgezocht. Een meting is niets waard zonder
   te weten waarmee hij gedaan is, en een kalibratie die later wordt bijgewerkt
   zou de historie stil herschrijven. Blijkt achteraf dat een ijking ondeugde,
   dan is exact terug te vinden welke experimenten eraan hingen -- en dat kan
   alleen als de stand van TOEN in de rij staat.

   Uitgifte staat los van reservering, want dat zijn verschillende feiten: een
   gereserveerde laptop die nog in de kast ligt, is iets anders dan een laptop
   die iemand mee naar huis nam. */
'use strict';

module.exports = (ctx) => {
  const { nu, rid, schoon, audit, vindStudie, save, apparatuur } = ctx;
  const { vind, pub, magBedienen, kalibratieStand } = apparatuur;
  const dag = d => { const t = String(d || '').trim(); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null; };

  /* ---------- reserveren ----------
     Vier poorten, en de volgorde is de volgorde van de foutmeldingen die een
     gebruiker het meest helpt: bestaat het, doet het het, mag jij het, en is het
     vrij. De kalibratiestand wordt IN de reservering vastgelegd, niet opgezocht
     bij het lezen: die stand kan later veranderen en dan klopt de historie niet
     meer met wat er destijds gold. */
  function reserveer(b, wie) {
    b = b || {};
    const a = vind(b.id); if (!a) return { status: 404, error: 'Dit apparaat bestaat niet.' };
    const s = vindStudie(b.studieId); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    if (s.labId !== a.labId) return { status: 400, error: 'Dit apparaat hoort bij een ander lab.' };
    if (!a.actief) return { status: 409, error: 'Dit apparaat staat uit de roulatie; er staat een storing open.' };
    const van = dag(b.van), tot = dag(b.tot) || dag(b.van);
    if (!van || !tot) return { status: 400, error: 'Van en tot welke dag? (jjjj-mm-dd)' };
    if (tot < van) return { status: 400, error: 'De einddatum ligt voor de begindatum.' };
    const door = schoon(b.door, 80) || schoon(wie, 80);
    if (!door) return { status: 400, error: 'Wie reserveert dit?' };
    const bev = magBedienen(a, door);
    if (!bev) return { status: 403, error: door + ' is niet (meer) bevoegd op ' + a.naam + '. Vraag eerst de veiligheidsinstructie aan.' };
    const botst = a.reserveringen.find(r => !r.weg && r.van <= tot && r.tot >= van);
    if (botst) return { status: 409, error: a.naam + ' is van ' + botst.van + ' tot ' + botst.tot + ' al gereserveerd.' };
    const kal = kalibratieStand(a, van);
    if (!kal.geldig)
      return { status: 409, error: a.naam + ' mag niet gebruikt worden: ' + kal.reden + '. Kalibreer hem eerst; anders zijn de metingen niet te verantwoorden.' };
    const r = { id: rid(), studieId: s.id, apparaatId: a.id, apparaat: a.naam, van, tot, door,
      // de stand ZOALS HIJ NU IS, meegeschreven en niet opgezocht
      kalibratie: { op: a.kalibratie.op, door: a.kalibratie.door, stand: a.kalibratie.stand, geldigTot: kal.tot, nvt: kal.nvt },
      bevoegdTot: bev.tot, at: nu() };
    a.reserveringen.unshift(r);
    s.dossier.reserveringen.unshift(r);
    audit(a.labId, 'app.reserveer', door, s.id, a.naam + ' ' + van + '..' + tot);
    save();
    return { ok: true, reservering: r };
  }

  function reserveringWeg(b, wie) {
    b = b || {};
    const a = vind(b.id); if (!a) return { status: 404, error: 'Dit apparaat bestaat niet.' };
    const r = a.reserveringen.find(x => x.id === String(b.reserveringId || ''));
    if (!r) return { status: 404, error: 'Deze reservering bestaat niet.' };
    r.weg = nu();
    const s = vindStudie(r.studieId);
    if (s) { const q = s.dossier.reserveringen.find(x => x.id === r.id); if (q) q.weg = r.weg; }
    audit(a.labId, 'app.reserveerWeg', wie, r.studieId, r.id);
    save();
    return { ok: true };
  }

  /* Uitgifte: wie heeft het apparaat nu fysiek in handen. Los van de
     reservering, want een gereserveerde laptop die nog in de kast ligt is iets
     anders dan een laptop die iemand mee naar huis nam. */
  function uitgifte(b, wie) {
    b = b || {};
    const a = vind(b.id); if (!a) return { status: 404, error: 'Dit apparaat bestaat niet.' };
    if (b.terug) {
      if (!a.uit) return { status: 409, error: 'Dit apparaat is niet uitgegeven.' };
      audit(a.labId, 'app.terug', wie, a.id, a.uit.aan);
      a.uit = null; save();
      return { ok: true, apparaat: pub(a) };
    }
    const aan = schoon(b.aan, 80);
    if (aan.length < 2) return { status: 400, error: 'Aan wie wordt dit uitgegeven?' };
    if (a.uit) return { status: 409, error: 'Dit apparaat is al uitgegeven aan ' + a.uit.aan + '.' };
    if (!magBedienen(a, aan)) return { status: 403, error: aan + ' is niet bevoegd op ' + a.naam + '.' };
    a.uit = { aan, door: schoon(wie, 80) || 'lab', at: nu() };
    audit(a.labId, 'app.uit', wie, a.id, aan);
    save();
    return { ok: true, apparaat: pub(a) };
  }

  return { reserveer, reserveringWeg, uitgifte };
};
