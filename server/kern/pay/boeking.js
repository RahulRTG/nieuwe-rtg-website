/* DE BOEKING: de enige plek waar geld van de ene rekening naar de andere gaat.

   Afgesplitst van ./index.js, en de snede loopt langs het onderwerp: dit is de
   SCHRIJFWEG van het grootboek, index.js is de MONTAGE van de laag. Het verschil
   is niet cosmetisch. Wie hier iets verandert, verandert wat er met geld
   gebeurt; wie daar iets verandert, verandert welke onderdelen aan elkaar
   hangen. Dat hoort niet in een oogopslag door elkaar te lopen.

   Drie functies, en de volgorde erin is de hele regel:

     pasToe     past een AL-goedgekeurde boeking toe. Geen guard meer -- wie
                hier komt is langs de poort geweest.
     boek       de synchrone guard. Verboden in motor-modus, en luid: stil een
                tweede grootboek naast de motor bijhouden is split-brain, en
                dat is de duurste fout die deze laag kan maken.
     boekAsync  het ENE choke-point voor de cutover naar de Rust-motor.

   DE WAARDEPOORT GAAT IN BEIDE GEVALLEN EERST, ook in motor-modus, en met opzet
   hier in JS: de motor kent de waardeklassen, het beleid en de reserveringen
   niet -- die wonen in de metadata aan deze kant. Precies zoals de bank-guard in
   kern/bank/grootboek.js om dezelfde reden in JS bleef staan. Eerst toetsen,
   dan pas de motor.

   Alles komt binnen; dit bestand leest geen omgeving en houdt geen stand vast. */
'use strict';

module.exports = ({ saldi, saldoVan, grootboek, payBoekingenVoegToe, save, id, schoon, nu, waardePoort,
  betalingenUit, uitFout, geldModus, motorklant, schaduw, MIN_CENTEN, MAX_CENTEN }) => {

  /* Gedeeld door de JS-guard (schaduw-modus) en door de motor-spiegel
     (motor-modus past de door de motor bevestigde regel toe). De cap van 50000
     is een WEERGAVEcap: de saldi blijven de waarheid, het grootboek is de lijst
     die je kunt teruglezen. */
  function pasToe(rij) {
    saldi()[rij.van] = saldoVan(rij.van) - rij.centen;
    saldi()[rij.naar] = saldoVan(rij.naar) + rij.centen;
    grootboek();
    payBoekingenVoegToe(rij);
    save();
  }

  function boek({ van, naar, centen, soort, oms, ref, genre, dagBesteed }) {
    if (betalingenUit) return uitFout();
    if (geldModus === 'motor') {
      const bron = (new Error().stack || '').split('\n')[2] || '';
      throw new Error('pay.boek (synchroon) is niet toegestaan in RTG_MOTOR_GELD=motor; gebruik boekAsync.' + bron);
    }
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c < MIN_CENTEN || c > MAX_CENTEN) return { status: 400, error: 'Dat bedrag kan niet.' };
    if (!van || !naar || van === naar) return { status: 400, error: 'Van en naar kloppen niet.' };
    const dicht = waardePoort({ van, naar, centen: c, soort, genre, dagBesteed });
    if (dicht) return dicht;
    const rij = { id: id('PB'), van, naar, centen: c, soort: soort || 'boeking', oms: schoon(oms, 120), ref: ref || null, at: nu() };
    pasToe(rij);
    schaduw.spiegel(rij); // schaduw-modus: naar de Rust-motor (no-op als uit)
    return { ok: true, boeking: rij };
  }

  /* In schaduw-modus is dit exact de sync-guard, gewoon awaitbaar gemaakt --
     geen gedragsverandering. In motor-modus gaat de boeking geguard naar de
     motor (de autoriteit); pas als die hem bevestigt, spiegelt de JS-engine
     dezelfde regel. Weigert de motor (onvoldoende saldo) of is hij onbereikbaar,
     dan verandert er NIETS aan de JS-saldi. */
  async function boekAsync({ van, naar, centen, soort, oms, ref, genre, dagBesteed }) {
    if (betalingenUit) return uitFout();
    if (geldModus !== 'motor') return boek({ van, naar, centen, soort, oms, ref, genre, dagBesteed });
    const dicht = waardePoort({ van, naar, centen: Math.round(Number(centen)), soort, genre, dagBesteed });
    if (dicht) return dicht;
    const r = await motorklant.boekGuard({ van, naar, centen, soort, oms, ref });
    if (!r || r.error) return { status: (r && r.status) || 502, error: (r && r.error) || 'Motor onbereikbaar.' };
    // Neem de door de motor bevestigde boeking exact over (id, at, bedragen).
    const b = r.boeking;
    const rij = { id: b.id, van: b.van, naar: b.naar, centen: Math.round(Number(b.centen)), soort: b.soort || 'boeking', oms: b.oms || '', ref: b.ref || null, at: b.at || nu() };
    pasToe(rij);
    return { ok: true, boeking: rij };
  }

  return { pasToe, boek, boekAsync };
};
