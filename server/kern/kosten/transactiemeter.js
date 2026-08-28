/* DE TRANSACTIEKOSTEN, EN WAAROM ZE OP HET OPLAADMOMENT LANDEN.

   Een betaalpartner rekent per geslaagde betaling een vast bedrag plus een deel
   van het bedrag. De vraag is bij WELKE handeling die kosten horen, en het
   antwoord staat al in WAARDE.md par. 1: transactiekosten verdwijnen niet, ze
   verhuizen naar het moment dat er geld van BUITEN binnenkomt. Een lid dat zijn
   wallet oplaadt, kost ons een transactie; wat hij daarna met dat saldo doet --
   tien keer een kop koffie -- kost de betaalpartner niets meer. Dat is precies
   het voordeel dat de walletlaag oplevert, en het hoort ook zo geteld te worden.

   Wie het per BOEKING zou tellen, rekent elke interne verschuiving als een
   transactie en komt op een veelvoud uit van wat er ooit betaald is. Dat verschil
   zou de afstemming laten zien -- maar pas nadat er facturen op waren gebaseerd.

   TWEE SOORTEN, WANT EEN TARIEF HEEFT TWEE DELEN. `transactie` telt de
   handeling (het vaste deel), `transactiewaarde` telt de euro's (het variabele
   deel). Een tikkie van vijf euro en een boeking van vijfduizend kosten niet
   hetzelfde, en met een eenheid zou dat wel zo lezen.

   DE CODENAAM MOET NOG VERTAALD WORDEN. De betaallaag werkt op codenamen, deze
   laag op de sessiesleutel waar ook de facturen mee werken. De vertaling loopt
   over de ledengids (keyVanCodenaam) en is asynchroon. Lukt hij niet, dan wordt
   er NIETS gemeld: liever een ontbroken teller dan een transactie op de rekening
   van iemand anders. Het overzicht kan zien dat er niets is; een verkeerd
   toegeschreven transactie ziet er precies zo uit als een goede. */
'use strict';

module.exports = (ctx) => {
  const { meter, keyVanCodenaam } = ctx;

  async function dragerVan(codenaam) {
    if (typeof keyVanCodenaam !== 'function') return null;
    let t = null;
    try { t = await keyVanCodenaam(codenaam); } catch (e) { return null; }
    if (!t || !t.key) return null;
    return { drager: 'lid:' + t.key, pas: t.tier || null };
  }

  /* Meld een geslaagde betaling van buiten. Geeft false in plaats van te gooien:
     dit zit in het pad van een oplading, en een boekhouding die een bijschrijving
     kan laten omvallen is erger dan een ontbroken teller. */
  async function meldTransactie({ codenaam, centen }) {
    const c = Math.round(Number(centen) || 0);
    if (!(c > 0)) return false;
    const t = await dragerVan(codenaam);
    if (!t) return false;
    const opts = { drager: t.drager, pas: t.pas };
    meter.meet(Object.assign({ soort: 'transactie', aantal: 1 }, opts));
    /* In EURO'S en niet in centen: het tarief staat per euro omzet, want zo staat
       het op elk tarievenblad van een betaalpartner. De meter houdt drie
       decimalen, dus een bedrag van 5,37 telt ook echt als 5,37. */
    meter.meet(Object.assign({ soort: 'transactiewaarde', aantal: c / 100 }, opts));
    return true;
  }

  return { meldTransactie, dragerVan };
};
