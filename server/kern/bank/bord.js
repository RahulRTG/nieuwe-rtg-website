/* RTG Bank, deel "bord": wat de bank van zichzelf laat ZIEN -- het afschrift van
   een rekening, de gezondheid en het boardroom-overzicht. Alleen lezen; hier
   beweegt geen geld.

   Het staat apart van kern/bank/index.js omdat de gezondheid twee dingen naast
   elkaar zet die vaak door elkaar worden gehaald. De sluitcontrole zegt of de
   boekingen ONDERLING kloppen. De reconciliatie zegt of wat geboekt is ook
   BUITEN RTG is aangekomen. Een bank kan perfect sluiten zonder dat er een euro
   het huis heeft verlaten -- dat gat is hier een keer echt open geweest.

   Krijgt de gedeelde ctx van kern/bank/index.js, plus sluitcontrole en
   opdrachten (die woont bij de orkestrator, niet in de ctx van de deelbestanden). */
module.exports = ({ grootboek, rekeningen, rekMeta, saldoVan, isExtern, saldi, nu, bankregie, sluitcontrole, opdrachten }) => {

  /* Het afschrift: de boekingen die een rekening raken, nieuwste eerst. */
  function afschrift({ iban, limit = 50, offset = 0 }) {
    const m = rekMeta(iban);
    if (!m) return { status: 404, error: 'De rekening bestaat niet.' };
    const raakt = grootboek().filter(b => b.van === iban || b.naar === iban);
    const regels = raakt.slice(offset, offset + Math.min(200, Math.max(1, limit))).map(b => ({
      id: b.id, af: b.van === iban, centen: b.centen, soort: b.soort, oms: b.oms,
      tegen: b.van === iban ? b.naar : b.van, at: b.at
    }));
    return { ok: true, iban, saldoCenten: saldoVan(iban), aantal: raakt.length, regels };
  }

  function gezondheid() {
    const s = saldi();
    let deposito = 0, krediet = 0;
    for (const [r, c] of Object.entries(s)) { if (isExtern(r)) continue; if (c >= 0) deposito += c; else krediet += -c; }
    const emissie = -saldoVan('extern:emissie');  // wat de eigen bank heeft uitgegeven (positief = in omloop)
    const rekN = Object.keys(rekeningen()).length;
    const rail = opdrachten.openstaand();   // de reconciliatie; zie de kop
    return { status: 200, sluit: sluitcontrole(), depositoCenten: deposito, kredietCenten: krediet,
      inOmloopCenten: emissie, reserveCenten: saldoVan('rtg:reserve'), renteBetaaldCenten: -saldoVan('rtg:rente'),
      foundationCenten: saldoVan('extern:foundation'),
      railOpenCenten: rail.centen, railOpen: rail.aantal, railMislukt: rail.mislukt,
      railZonderTerugboeking: rail.zonderTerugboeking, railOudsteAt: rail.oudsteAt,
      aantalRekeningen: rekN, boekingenVandaag: grootboek().filter(b => nu() - b.at < 86400000).length };
  }
  function overzicht() {
    const g = gezondheid();
    const lijst = Object.values(rekeningen()).sort((a, b) => b.geopend - a.geopend).slice(0, 100)
      .map(m => ({ iban: m.iban, codenaam: m.codenaam, soort: m.soort, naam: m.naam, saldoCenten: saldoVan(m.iban), bevroren: !!m.bevroren, roodLimiet: m.roodLimiet || 0 }));
    return { status: 200, regie: bankregie.bankregieOverzicht(), gezondheid: g, rekeningen: lijst };
  }

  return { afschrift, gezondheid, overzicht };
};
