/* DE CONTRACTSTAND VAN EEN SESSIE, voor auth() in ./diensten2.js.

   Afgesplitst uit diensten2.js (dat al over de omvanggrens stond) toen A-P1-03
   en de schaduwteller-reparatie erbij kwamen: dit is het oordeel over de
   lopende afspraak per verzoek, en het WEGEN in de schaduw per venster. Gedrag
   en weigerzinnen zijn ongewijzigd verhuisd. */
'use strict';

module.exports = function maakContractstand({ kernVoorAuth, lidpoort }) {
  /* Het venster waarin een eerder oordeel blijft staan, en een dak op de kaart. Een
     kaart die per sleutel groeit en nooit krimpt, is een lek met een nette naam. */
  const CONTRACT_VENSTER = 10 * 60 * 1000;
  const CONTRACT_DAK = 5000;
  const contractGezien = new Map();
  
  function contractStandVoor(sess) {
    if (!sess || !sess.account) return null;   // een demo-persona heeft geen afspraak om te vinden
    const sleutel = sess.key || ('user-' + sess.account.id);
    const nu = require('../lib/klok').nu();
    let oordeel = null;
    try {
      const aanm = kernVoorAuth.aanmeldingen;
      const lees = aanm && aanm.lidAbonnement;
      /* GEEN LAAG = GEEN UITSPRAAK, en met opzet geen oordeel. Is de
         aanmeldingenlaag niet gemount, dan is het antwoord `null` en niet
         "GEEN_CONTRACT" -- dat laatste zou een storing in de bewijslaag als een
         bevinding over het lid laten lezen (CONTROLPLANE.md: ONBEKEND is geen
         WEIGEREN). */
      /* A-P1-03: GEEN LAAG bij een betalende pas is een STORING en geen vrijbrief.
         Hier stond `return null`, en dan liep elk betaald verzoek ongezien door. */
      if (!lees || typeof lees.stand !== 'function') return lidpoort.onbekend(sess.tier, 'de aanmeldingenlaag is niet beschikbaar');
      /* A-P1-03: het OORDEEL wordt bij elk verzoek gerekend (een verlopen contract
         mag geen tien minuten blijven doorwerken); alleen het WEGEN in de schaduw
         blijft per venster. Een gratis lid kost geen opzoeking. */
      if (require('../lib/verraad').sla('contractstand-faalt')) throw new Error('verraad: contractstand-faalt');
      oordeel = lidpoort.beoordeel(sess.tier, lees.stand(sess.account.id), nu);
    } catch (e) {
      /* Een leesfout bij een betalende pas: onbekend, en dus GEEN betaalde
         capability (lidpoort.afgedwongen). Een gratis pas verliest niets. */
      return lidpoort.onbekend(sess.tier, 'de contractstand kon niet worden gelezen');
    }
    /* HET WEGEN IS EEN SCHRIJFACTIE EN STAAT BUITEN HET LEZEN. Het stond in
       dezelfde try als het oordeel, en dan maakte een mislukte schrijfactie van de
       SCHADUWTELLER (`schaduw.weeg` bewaart) een oordeel "de contractstand kon niet
       worden gelezen" -- ONBEKEND, en dus de basislaag voor een betalend lid met
       een kloppende afspraak. Onder een opslagstoring werd zo elk leesverzoek van
       een betalend lid geweigerd (test/operationeel-herstel.test.js: de Saloon
       onder `schrijf-faalt`). Een teller die niet bijgewerkt kon worden, zegt niets
       over de afspraak; hij wordt gemeld en de volgende keer opnieuw geprobeerd
       (geen `contractGezien`). */
    try {
      const eerder = contractGezien.get(sleutel);
      if (!(eerder && nu - eerder.at < CONTRACT_VENSTER) && oordeel.stand !== 'NIET_BETALEND') {
        /* GEEN SLEUTEL MEE. Zie de kop van kern/commercie/lidpoort.js bij `weeg`: een
           identiteit in die teller is een lijst leden van wie de pas mogelijk vervalt,
           zonder bewaartermijn, en het lid kan hem niet kwijt. De sleutel hierboven is
           alleen de geheugenkaart van dit proces en staat nergens op schijf. */
        lidpoort.weeg(kernVoorAuth.handhavingSchaduw, oordeel);
        if (contractGezien.size >= CONTRACT_DAK) contractGezien.clear();
        contractGezien.set(sleutel, { at: nu });
      }
    } catch (e) {
      console.warn('[contractpoort] de schaduwteller kon niet worden bijgewerkt: ' + (e && e.message || e));
    }
    return oordeel;
  }
  return contractStandVoor;
};
