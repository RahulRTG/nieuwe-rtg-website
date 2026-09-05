/* RTG Bank, deel "grootboek": de boekhoudmotor zelf + de cutover-naad naar de
   Rust-motor. Afgesplitst uit kern/bank/index.js zodat de orkestrator klein blijft.

   De regels van dit grootboek (dezelfde tucht als RTG Pay):
   - elke beweging is een dubbele boeking VAN -> NAAR; de som van alle saldi is
     altijd exact nul; niemand zakt onder zijn bodem (rood-staan-limiet per soort).

   Cutover (RTG_MOTOR_GELD=motor): de Rust-motor wordt de autoritatieve saldi-store.
   Anders dan pay doet de motor een RAUWE apply -- de rijke bank-guard (rekening
   bestaat / bevroren / rood-staan-bodem) leunt op de rekening-metadata die in JS
   woont, dus die guard blijft hier. Daarom: guard in JS, dan rauw naar de motor,
   dan spiegelen. Een serialisatie-slot om alle bank-schrijfacties heen sluit de
   TOCTOU-race waarin twee gelijktijdige boekingen dezelfde verouderde bodem-check
   passeren. Standaard uit (geldModus 'schaduw') -> puur de synchrone JS-guard. */
'use strict';

const { vingerafdruk } = require('../pay/vingerafdruk');

module.exports = (g) => {
  const { MIN_CENTEN, MAX_CENTEN, saldi, grootboek, saldoVan, rekMeta, isExtern,
    bodem, id, schoon, nu, save, d, geldModus, motorklant, bordSeintje } = g;
  const betalingenUit = process.env.RTG_BETALEN_UIT === '1';
  const uitFout = () => ({ status: 503,
    error: 'Betalen staat bewust uitgeschakeld. Er is niets afgeschreven.', code: 'betalingen-uit' });

  /* De grootboek-guard: de VOLLEDIGE regelcontrole (bedrag, bestaan, bevroren,
     bodem/rood-staan). Retourneert een fout-object of null (mag door). Dit is de
     enige plek waar de bank-policy leeft -- in schaduw-modus draait hij synchroon
     vóór het toepassen; in motor-modus draait hij in JS vóór de rauwe apply op de
     motor (die de metadata niet kent). */
  function guardCheck({ van, naar, c }) {
    if (!Number.isFinite(c) || c < MIN_CENTEN || c > MAX_CENTEN) return { status: 400, error: 'Dat bedrag kan niet.' };
    if (!van || !naar || van === naar) return { status: 400, error: 'Van en naar kloppen niet.' };
    if (!isExtern(van)) { const mv = rekMeta(van); if (!mv) return { status: 404, error: 'De rekening bestaat niet.' }; if (mv.bevroren) return { status: 423, error: 'Deze rekening is bevroren.' }; }
    if (!isExtern(naar) && !rekMeta(naar)) return { status: 404, error: 'De tegenrekening bestaat niet.' };
    if (saldoVan(van) - c < bodem(van)) return { status: 402, error: 'Onvoldoende saldo of rood-staan-ruimte.' };
    return null;
  }
  /* Een AL-goedgekeurde boeking toepassen op de saldi + het grootboek (geen guard
     meer). Gedeeld door de sync-guard (boek) en de motor-spiegel (boekMotor). */
  function pasToe(rij) {
    saldi()[rij.van] = saldoVan(rij.van) - rij.centen;
    saldi()[rij.naar] = saldoVan(rij.naar) + rij.centen;
    grootboek().unshift(rij);
    if (grootboek().length > 100000) grootboek().pop();  // weergavecap; de saldi zijn de waarheid
    save();
    bordSeintje();
  }

  /* De synchrone grootboekmotor. Boekt van -> naar, bewaakt de bodem en de dubbele
     boeking. In motor-modus mag dit NIET: dan is de motor het autoritatieve saldi-
     grootboek en moet alles via boekAsync (fail-closed, luid -- nooit stil een
     tweede grootboek naast de motor). */
  function boek({ van, naar, centen, soort, oms, ref }) {
    if (betalingenUit) return uitFout();
    if (geldModus === 'motor') {
      throw new Error('bank.boek (synchroon) is niet toegestaan in RTG_MOTOR_GELD=motor; gebruik boekAsync.');
    }
    const c = Math.round(Number(centen));
    const fout = guardCheck({ van, naar, c });
    if (fout) return fout;
    const rij = { id: id('BB'), van, naar, centen: c, soort: soort || 'boeking', oms: schoon(oms, 140), ref: ref || null, at: nu() };
    pasToe(rij);
    return { ok: true, boeking: rij };
  }

  /* De serialisatie-slot voor de bank-schrijfacties in motor-modus. De guard leest
     de spiegel-saldi en pas ná de motor-bevestiging past hij ze aan; zonder slot
     konden twee gelijktijdige overboekingen van dezelfde rekening allebei dezelfde
     verouderde bodem-check passeren (TOCTOU) en samen door de bodem zakken. Door
     alle bank-schrijfacties door één belofte-keten te trekken ziet elke guard altijd
     de laatst toegepaste stand. */
  let schrijfKeten = Promise.resolve();
  function metSlot(werk) {
    const uit = schrijfKeten.then(werk, werk);
    schrijfKeten = uit.then(() => {}, () => {}); // de keten breekt nooit op een fout
    return uit;
  }
  /* De async boeking: HET choke-point voor de cutover. In schaduw-modus is dit exact
     de sync-guard (gewoon awaitbaar) -- geen gedragsverandering. In motor-modus draait
     de JS-guard (metadata!) eerst; pas als die doorlaat gaat de boeking rauw naar de
     motor (autoriteit voor de saldi). Bevestigt de motor, dan spiegelt JS dezelfde
     regel; weigert of hapert de motor, dan verandert er NIETS aan de spiegel. Alle
     motor-schrijfacties lopen door het slot (geen TOCTOU op de bodem). */
  async function boekAsync(args) {
    if (betalingenUit) return uitFout();
    if (geldModus !== 'motor') return boek(args);
    return metSlot(() => boekMotor(args));
  }
  async function boekMotor({ van, naar, centen, soort, oms, ref, economischeSleutel }) {
    const c = Math.round(Number(centen));
    const fout = guardCheck({ van, naar, c });
    if (fout) return fout;
    const r = await motorklant.bankBoek({ van, naar, centen: c, soort, oms, ref, economischeSleutel });
    if (!r || r.error) return { status: (r && r.status) || 502, error: (r && r.error) || 'Motor onbereikbaar.' };
    const b = r.boeking;
    const rij = { id: b.id, van: b.van, naar: b.naar, centen: Math.round(Number(b.centen)), soort: b.soort || 'boeking', oms: b.oms || '', ref: b.ref || null, at: b.at || nu() };
    if (economischeSleutel) {
      const sv = Math.round(Number(r.saldoVan)), sn = Math.round(Number(r.saldoNaar));
      if (!Number.isFinite(sv) || !Number.isFinite(sn))
        return { status: 502, error: 'Motor bevestigde geen actuele banksaldi; de spiegel blijft ongemoeid.' };
      saldi()[rij.van] = sv; saldi()[rij.naar] = sn;
      if (!grootboek().some(x => x && x.id === rij.id)) {
        grootboek().unshift(rij);
        if (grootboek().length > 100000) grootboek().pop();
      }
      save(); bordSeintje();
      return { ok: true, boeking: rij, herhaald: !!r.herhaald };
    }
    pasToe(rij);
    return { ok: true, boeking: rij };
  }

  /* Herstart-reconcile (cutover): bij het opstarten in motor-modus is de motor de
     autoriteit voor de bank-saldi, dus de JS-spiegel neemt zijn saldi over uit de
     motor-snapshot i.p.v. uit zijn eigen (mogelijk verouderde) snapshot. Zo start de
     spiegel altijd in lockstep, ook na een crash. Vereist RTG_MOTOR_SALDI=1 op de
     motor. No-op buiten motor-modus. */
  async function reconcileVanMotor() {
    if (geldModus !== 'motor') return { ok: true, overgeslagen: true };
    const r = await motorklant.bankSaldiSnapshot();
    if (!r || r.error) return { ok: false, error: (r && r.error) || 'Geen saldi van de motor.' };
    const nieuw = {};
    for (const k in r.saldi) {
      if (!Object.prototype.hasOwnProperty.call(r.saldi, k)) continue;
      const v = Math.round(Number(r.saldi[k]) || 0);
      if (v !== 0) nieuw[k] = v; // nul-saldi laten we weg (schone spiegel)
    }
    d().bankSaldi = nieuw;
    save();
    let som = 0; for (const k in nieuw) som += nieuw[k];
    return { ok: true, rekeningen: Object.keys(nieuw).length, som };
  }

  // de sluitcontrole: som van alle saldi is nul, en niemand zit onder zijn bodem
  function sluitcontrole() {
    let som = 0; const onderBodem = [];
    for (const [rek, c] of Object.entries(saldi())) { som += c; if (c < bodem(rek)) onderBodem.push(rek); }
    return { klopt: som === 0 && !onderBodem.length, som, onderBodem };
  }

  /* Drift-stand voor het statusbord (cutover): vergelijkt de JS-spiegel met de
     Rust-motor -- niet alleen de som maar ook een vingerafdruk over ALLE bank-saldi,
     zodat per-rekening-drift die de som mist er alsnog uitkomt. Alleen op een
     statusbord-poll (nooit in het warme geld-pad); byte-voor-byte gelijk aan de motor. */
  const motorStand = {
    aan: geldModus === 'motor', modus: geldModus,
    stand: async () => {
      const s = sluitcontrole();
      const jsAfdruk = vingerafdruk(saldi());
      if (geldModus !== 'motor') return { modus: geldModus, jsSom: s.som, jsVingerafdruk: jsAfdruk };
      const r = await motorklant.bankSaldiSnapshot();
      if (!r || r.error) return { modus: geldModus, jsSom: s.som, jsVingerafdruk: jsAfdruk, fout: (r && r.error) || 'geen motor-saldi' };
      let motorSom = 0; for (const k in r.saldi) motorSom += Math.round(Number(r.saldi[k]) || 0);
      const motorAfdruk = vingerafdruk(r.saldi);
      return { modus: geldModus, jsSom: s.som, motorSom, gelijk: motorSom === s.som,
        jsVingerafdruk: jsAfdruk, motorVingerafdruk: motorAfdruk, gelijkAlle: jsAfdruk === motorAfdruk };
    },
  };

  return { guardCheck, pasToe, boek, boekAsync, reconcileVanMotor, sluitcontrole, motorStand };
};
