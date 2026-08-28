/* HET GROOTBOEK ZELF: de drie functies die een cent verplaatsen.

   `pasToe` past een AL-goedgekeurde boeking toe op de saldi en de historie (geen
   guard meer). `boek` is de synchrone JS-guard, `boekAsync` het ENE choke-point
   voor de cutover naar de Rust-motor. Ze stonden in ./index.js; dat bestand kwam
   met de uitleg hieronder over de 10 kB-grens van de keuring, en dit is de naad
   die er al lag -- ./kijken.js is de lezende kant van dezelfde laag, dit is de
   schrijvende.

   WAT ER BINNENKOMT is met opzet smal: de twee standen van de collectie, de
   twee bedragen, en de weg naar het transactiegrootboek. Geen routes, geen
   verzoeken, geen kassa. */
'use strict';

module.exports = ({ saldi, grootboek, saldoVan, payBoekingenVoegToe, save, id, schoon, nu,
  betalingenUit, uitFout, schaduw, motorklant, geldModus, MIN_CENTEN, MAX_CENTEN }) => {

  /* DE REGEL GAAT VIA HET TRANSACTIEGROOTBOEK EN NIET MEER VIA unshift+pop
     (TAKEN.md 4.39). Hier stond:

         grootboek().unshift(rij);
         if (grootboek().length > 50000) grootboek().pop();

     Twee dingen zaten daaronder. (1) Het is hetzelfde patroon waarmee boeking
     50.001 verdween: de gepopte regel ging nergens heen -- geen archief, geen
     logregel. (2) In Postgres-stand reed de hele collectie in de TRAGE
     flush-laan (een blob van maximaal 50.000 regels wacht daar achter de grote
     collecties aan), dus bij een harde crash binnen dat venster klopte het saldo
     wel en ontbrak de regel in het overzicht. Geen geldfout -- de saldi zijn de
     waarheid en dit is een weergave -- wel een zichtbare inconsistentie die
     niemand kan uitleggen: "je saldo is tien euro lager en er staat niets".

     Langs `payBoekingenVoegToe` krijgt elke regel meteen een eigen rij in het
     grootboek (db/tx), gaat de staart bij een actief grootboek daarheen en
     anders eerst naar het archief, en vult `vensterTopUp` bij een herstart aan
     wat de blob mist. NIET in de VOORRANG-set van pg/sync.js: die serialiseert
     haar sleutels bij elke overdracht, en een groeiende blob daarin zetten zou
     de geld-laan juist traag maken. Zie de uitleg bij het blok in
     db/tx/collecties.js.

     `grootboek()` staat er nog voor, en dat is nu een TWEEDE slot en niet meer
     het enige. Eerlijk over de volgorde: hij stond hier als de zekerheid dat de
     collectie bestaat, want de tx-index bouwde zijn venster op `db.data[naam] ||
     []` -- en op een verse database is dat een LOSSE array, waar het item wel in
     gaat en waar niemand hem ooit terugvindt. Gemeten: zonder ensure was
     `db.data.payBoekingen` na een toevoeging nog steeds `undefined`.

     Elke aanroeper ontliep dat toevallig (directpay heeft een eigen ensure,
     orders en boekingen bestaan door de seed), en toevallig is geen bescherming:
     de volgende collectie heeft dat toeval niet en de fout maakt geen geluid.
     Daarom zit de reparatie in `txVoegToe` zelf en niet hier -- de oorzaak, niet
     het symptoom. Deze regel blijft staan omdat de leeskant (./kijken.js) hem
     sowieso nodig heeft; hij is nu een tweede slot op een deur die ook echt op
     slot zit. `test/txindex.test.js` houdt het eerste slot vast. */
  function pasToe(rij) {
    saldi()[rij.van] = saldoVan(rij.van) - rij.centen;
    saldi()[rij.naar] = saldoVan(rij.naar) + rij.centen;
    grootboek();
    payBoekingenVoegToe(rij);
    save();
  }

  // De synchrone JS-guard. In motor-modus mag dit NIET: dan is de motor de
  // autoriteit en moet alles via boekAsync. Fail-closed (luid), nooit stil een
  // tweede grootboek naast de motor bijhouden (dat zou split-brain zijn).
  function boek({ van, naar, centen, soort, oms, ref }) {
    if (betalingenUit) return uitFout();
    if (geldModus === 'motor') {
      const bron = (new Error().stack || '').split('\n')[2] || '';
      throw new Error('pay.boek (synchroon) is niet toegestaan in RTG_MOTOR_GELD=motor; gebruik boekAsync.' + bron);
    }
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c < MIN_CENTEN || c > MAX_CENTEN) return { status: 400, error: 'Dat bedrag kan niet.' };
    if (!van || !naar || van === naar) return { status: 400, error: 'Van en naar kloppen niet.' };
    if (!van.startsWith('extern:') && saldoVan(van) < c) return { status: 402, error: 'Onvoldoende saldo.' };
    const rij = { id: id('PB'), van, naar, centen: c, soort: soort || 'boeking', oms: schoon(oms, 120), ref: ref || null, at: nu() };
    pasToe(rij);
    schaduw.spiegel(rij); // schaduw-modus: naar de Rust-motor (no-op als uit)
    return { ok: true, boeking: rij };
  }

  /* De async boeking: het EEN choke-point voor de cutover. In schaduw-modus is
     dit exact de sync-guard (gewoon awaitbaar gemaakt) -- geen gedragsverandering.
     In motor-modus gaat de boeking geguard naar de motor (de autoriteit); pas als
     die hem bevestigt, spiegelt de JS-engine dezelfde regel. Weigert de motor
     (onvoldoende saldo) of is hij onbereikbaar, dan verandert er NIETS aan de
     JS-saldi -- de fout gaat netjes terug naar de caller. */
  async function boekAsync({ van, naar, centen, soort, oms, ref }) {
    if (betalingenUit) return uitFout();
    if (geldModus !== 'motor') return boek({ van, naar, centen, soort, oms, ref });
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
