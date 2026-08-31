/* De settlement-rails onder het fonds.

   Niet langer één 30%-opdracht naar één rekening: iedere formele claim krijgt
   een eigen settlement en betaalopdracht. De opdrachtenrij bewaart de externe
   poging; de Economic Runtime is eigenaar van claim, ledger en bewijs. */
'use strict';

const SOORT = 'economic-settlement';

function maakUitbetaling({ opdrachten, runtime, save, log, lijst, bankGeef, herbereken }) {
  const zoek = settlementId => {
    for (const afdracht of lijst()) {
      const leg = (afdracht.legs || []).find(x => x.settlementId === settlementId);
      if (leg) return { afdracht, leg };
    }
    return null;
  };

  if (opdrachten) {
    opdrachten.registreerTeruggang(SOORT, async o => {
      const gevonden = zoek(o.settlementId || o.ledgerRef);
      if (!gevonden) return { error: 'De settlement bij deze opdracht bestaat niet meer.' };
      const r = await runtime.markSettlementFailed({ settlementId: gevonden.leg.settlementId,
        operationId: o.id, reason: o.laatsteFout || 'de betaalrail heeft de opdracht teruggegeven', retryable: true });
      if (!r || r.error) return r || { error: 'Economic recovery kon niet worden vastgelegd.' };
      gevonden.leg.status = 'te_storten'; gevonden.leg.fout = o.laatsteFout || 'uitbetaling mislukt';
      herbereken(gevonden.afdracht); save();
      if (log && log.warn) log.warn('economic settlement terug naar claimbaar',
        { intentId: gevonden.afdracht.economicIntentId, settlementId: gevonden.leg.settlementId, fout: gevonden.leg.fout });
      return { ok: true };
    });
    opdrachten.registreerAfwikkeling(SOORT, async o => {
      const gevonden = zoek(o.settlementId || o.ledgerRef);
      if (!gevonden) return { error: 'De settlement bij deze opdracht bestaat niet meer.' };
      const r = await runtime.markSettlementConfirmed({ settlementId: gevonden.leg.settlementId,
        operationId: o.id, providerRef: o.settlementRef || o.id, sourceRef: 'provider:payout-rail' });
      if (!r || r.error) return r || { error: 'Economic settlement kon niet worden bevestigd.' };
      gevonden.leg.status = 'gestort'; gevonden.leg.providerRef = o.settlementRef || o.id;
      gevonden.leg.fout = null; herbereken(gevonden.afdracht); save();
      return { ok: true };
    });
  }

  async function verstuurLeg(afdracht, leg, { invoiceId, wie }) {
    /* DE IBAN-EIS HOORT BIJ DE EXTERNE RAIL, EN BIJ DIE ALLEEN.

       Hij stond hier bovenaan en gold dus ook voor de eigen-bankboeking
       hieronder -- terwijl die geen rekeningnummer nodig heeft: een boeking van
       rtg:reserve naar extern:foundation loopt door ons EIGEN grootboek en
       verlaat het huis niet. Zie de kop van ./economie.js voor de andere helft
       van dezelfde reparatie; samen zorgden ze ervoor dat de afdracht in de
       eigen-stand zonder IBAN stil niets deed. */
    if (!leg || !leg.settlementId) return leg;
    const bankAfdracht = bankGeef();
    if (bankAfdracht) {
      try {
        const eigen = await bankAfdracht({ centen: leg.centen, referentie: leg.settlementId,
          oms: 'Sociale afdracht ' + leg.component + ' ' + (invoiceId || ''),
          bestemming: leg.iban, begunstigde: leg.begunstigde, component: leg.component });
        if (eigen && eigen.ok) {
          const providerRef = 'bank:' + ((eigen.boeking && eigen.boeking.id) || leg.settlementId);
          const vast = await runtime.markSettlementConfirmed({ settlementId: leg.settlementId,
            operationId: (eigen.boeking && eigen.boeking.id) || null, providerRef, sourceRef: 'bank:rtg-ledger' });
          if (!vast || vast.error) throw new Error((vast && vast.error) || 'runtime-finalisatie mislukt');
          leg.status = 'gestort'; leg.via = 'eigen-bank'; leg.boekingId = eigen.boeking ? eigen.boeking.id : null;
          leg.providerRef = providerRef; herbereken(afdracht); save(); return leg;
        }
      } catch (e) {
        if (log && log.warn) log.warn('sociale settlement: eigen-bank-boeking mislukt',
          { invoiceId, component: leg.component, fout: e.message });
      }
    }

    /* Vanaf hier gaat het geld naar BUITEN, en dan is een rekeningnummer geen
       detail maar de bestemming zelf. Zonder IBAN blijft de leg staan zoals hij
       stond -- wachtend op de rekening, precies zoals bedoeld. */
    if (!leg.iban) return leg;

    if (opdrachten) {
      const op = opdrachten.maak({
        soort: SOORT, rail: 'betaalnaad', centen: leg.centen, bestemming: leg.iban,
        begunstigde: leg.begunstigde, oms: 'Sociale afdracht ' + leg.component + ' ' + (invoiceId || ''),
        ledgerRef: leg.settlementId, economicIntentId: afdracht.economicIntentId,
        settlementId: leg.settlementId, claimId: leg.claimId,
        idemSleutel: 'economic-settlement:' + leg.settlementId
      });
      leg.opdrachtId = op.id; herbereken(afdracht); save();
      const na = await opdrachten.dienIn(op);
      if (na.status === 'INGEDIEND') {
        await runtime.markSettlementSubmitted({ settlementId: leg.settlementId,
          operationId: op.id, providerRef: na.settlementRef || null });
        leg.status = 'ingepland'; leg.providerRef = na.settlementRef || null;
      } else if (na.status === 'AFGEWIKKELD') {
        /* De finalize-hook hierboven heeft runtime en leg al gesloten. */
        leg.status = na.afwikkelFout ? 'afwikkeling_nodig' : 'gestort';
        leg.providerRef = na.settlementRef || leg.providerRef;
      } else if (na.status === 'MISLUKT' || na.status === 'TERUGGEBOEKT') {
        leg.status = 'te_storten'; leg.fout = na.laatsteFout || 'uitbetaling mislukt';
      } else leg.status = 'gepland';
      herbereken(afdracht); save();
    }
    return leg;
  }

  return { verstuurLeg, SOORT };
}

module.exports = { maakUitbetaling, SOORT };
