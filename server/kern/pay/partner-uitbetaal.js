/* RTG Pay, deelbestand "partner-uitbetaal": het saldo van een zaak naar haar
   eigen bank, en de teruggang als de rail de uitbetaling blijft weigeren. Uit
   ./partner.js gehaald (keuringsregel 13): dat bestand gaat over wat er BINNEN
   komt bij een zaak, dit over wat er naar BUITEN gaat -- en dat tweede is een
   eigen capability in de vrijgavepoort (geld.partnerafrekening).

   Krijgt de gedeelde ctx van kern/pay/index.js. */
'use strict';

module.exports = (ctx) => {
  const { rekPartner, saldoVan, metIdem, boek, boekAsync, opdrachten, grootboek, MAX_CENTEN,
    economischeBoekingEenmaal, geldModus, vrijgavePoort } = ctx;
  const boekTerugEenmaal = require('../betaalopdracht/terugboeking');

  /* De partneruitbetaling kent zelf haar grootboek en tegenrekening. */
  opdrachten.registreerTeruggang('pay-uit', async (o) => {
    const terug = await boekTerugEenmaal({ domein: 'pay', grootboek, boek, boekAsync,
      boekEenmaal: economischeBoekingEenmaal, geldModus,
      van: 'extern:uitbetaald', naar: o.bron, centen: o.centen,
      soort: 'terug', oms: 'Uitbetaling niet verstuurd, teruggeboekt', ref: o.ledgerRef });
    return terug;
  });

  /* WAAR HET GELD HEEN GAAT, EN DAT WERD NIET GEVRAAGD. Nagespeeld met de
     echte modules: deze functie maakte de opdracht zonder `bestemming`, en dat
     is precies het veld dat naar de rail gaat (server.js: `iban: o.bestemming`).
     Bij een lege iban reserveert server/betaal.js en verstuurt hij niet, maar
     het saldo was hieronder AL afgeboekt: wallet leeg, opdracht op INGEDIEND,
     geen IBAN genoemd. Nu eerst vragen, dan pas het saldo aanraken. */
  async function partnerUitbetaal({ supplierCode, idem }) {
    const rek = rekPartner(supplierCode);
    const heen = ctx.zaakRekening ? ctx.zaakRekening(supplierCode) : null;
    if (!heen || !heen.iban) {
      return { status: 409,
        error: 'Er staat geen bankrekening voor deze zaak. Zonder rekening zou het saldo van de wallet af gaan zonder ergens aan te komen, en dat gebeurt hier niet.',
        reden: (heen && heen.reden) || 'geen-rekening',
        saldo: saldoVan(rek) };
    }
    /* BESCHIKBAAR EN NIET HET SALDO, en dat is geld-veiligheid en geen detail.
       Wat de zaak zelf apart heeft gezet voor de btw of de loonrun
       (kern/pay/treasury.js) hoort niet mee de deur uit, en een borg die zij bij
       een lid heeft vastgezet evenmin. Stond hier het kale saldo, dan nam de
       eerstvolgende uitbetaling de btw-reservering gewoon mee -- en dan is die
       reservering decoratie. Overgenomen uit main bij de samenvoeging van
       26 augustus 2026; zonder waardelaag is dit exact het oude getal. */
    const nuVrij = ctx.waarde ? ctx.waarde.beschikbaar(rek, saldoVan(rek)) : saldoVan(rek);
    if (nuVrij <= 0) return { status: 400, error: 'Er staat niets beschikbaars om uit te betalen.',
      saldo: saldoVan(rek), beschikbaar: nuVrij };
    /* Een uitbetaling heeft geen parameters buiten de partner zelf (het gaat
       altijd om het saldo), dus de afdruk is de partner. Het bedrag bewust NIET
       meenemen: dat verschilt legitiem per moment. */
    return metIdem(idem ? 'uit:' + supplierCode + ':' + idem : null, 'uit|' + supplierCode, async () => {
      /* Het saldo PAS hier lezen, en begrensd op de boekingsgrens van het
         grootboek. Twee dingen gingen hier mis en ze versterkten elkaar.

         Het saldo werd buiten metIdem gelezen, dus twee gelijktijdige verzoeken
         lazen allebei het volle bedrag -- de afboeking hieronder had toen nog
         niets gedaan.

         En er was geen bovengrens, terwijl het grootboek er wel een heeft
         (MAX_CENTEN). Bij een partnersaldo boven de EUR 5.000 werd de uitbetaling
         dus eerst bij de betaaldienst vastgelegd en daarna de boeking geweigerd
         met "Dat bedrag kan niet". Het saldo bleef staan, de partner kon NOOIT
         uitbetaald krijgen, en elke nieuwe poging legde er weer een vast. Boven
         de grens betalen we in delen uit; wat overblijft, blijft staan. */
      const vrij = ctx.waarde ? ctx.waarde.beschikbaar(rek, saldoVan(rek)) : saldoVan(rek);
      const c = Math.min(vrij, MAX_CENTEN);
      if (c <= 0) return { status: 400, error: 'Er staat niets beschikbaars om uit te betalen.',
        saldo: saldoVan(rek), beschikbaar: vrij };
      /* Eerst afboeken, dan pas uitbetalen -- het stond andersom, dus de
         uitbetaling lag al vast terwijl de boeking nog kon weigeren. */
      const b = await boekAsync({ van: rek, naar: 'extern:uitbetaald', centen: c, soort: 'uitbetaling', oms: 'Uitbetaald naar de bank' });
      if (b.error) return b;

      /* HIER STOND EEN COMPENSATIE, EN DIE WAS GEVAARLIJKER DAN HIJ LEEK. Bij een
         fout van de betaal-naad werd de afboeking teruggedraaid en kreeg de
         partner een 502. Dat klopt alleen als de uitbetaling zeker NIET is
         aangemaakt -- en dat weet je bij een timeout juist niet. Slaagde de
         payout bij de provider terwijl het antwoord verloren ging, dan kreeg de
         partner zijn saldo terug terwijl het geld al onderweg was: twee keer
         hetzelfde bedrag, en het grootboek sloot allebei de keren netjes.

         Daarom nu dezelfde rij als de bank: de opdracht wordt vastgelegd, de
         inzending wordt herhaald met DEZELFDE sleutel (dus een geslaagde eerste
         poging wordt bij de provider geen tweede betaling), en pas als de rail
         hem blijft weigeren komt het geld terug. De partner hoort daarom nu
         "in behandeling" en niet "gelukt" -- dat is wat we werkelijk weten. */
      const op = opdrachten.maak({
        soort: 'pay-uit', rail: 'betaalnaad', centen: c, bron: rek, begunstigde: supplierCode,
        oms: 'RTG Pay uitbetaling', ledgerRef: b.boeking.id, bestemming: heen.iban,
        /* De sleutel hing aan nu(), dus elke poging kreeg er een andere en twee
           klikken waren twee uitbetalingen. Hij hangt nu aan de BOEKING: die is
           er precies een per uitbetaling. */
        idemSleutel: 'pay-uit:' + supplierCode + ':' + (idem || b.boeking.id)
      });
      const na = await opdrachten.dienIn(op);
      /* Uit de OPDRACHT en niet uit `heen`: zo zakt de toets zodra de
         bestemming er niet op meegaat -- de fout die hier zat. */
      return { ok: true, uitbetaald: c, restant: saldoVan(rek), opdrachtId: op.id, opdrachtStatus: na.status,
        naarRekening: na.bestemming ? String(na.bestemming).slice(-4) : null };
    /* De partnerafrekening is een eigen capability; na de herhaling gevraagd. */
    }, { poort: vrijgavePoort ? vrijgavePoort.partnerafrekening : undefined });
  }

  return { partnerUitbetaal };
};
