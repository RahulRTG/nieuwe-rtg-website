/* DE RAILS VAN DE VRIJGAVEPOORT: welke zonder echt geld zijn, en welke de
   echte providers zijn. Uit ./register.js gehaald (keuringsregel 13); het
   register leest ze hier en geeft ze door. */
'use strict';

/* Rails zonder echt geld. Alleen hierop werkt `sandbox`. De namen zijn die van
   server/betaal.js (`aanbieder()` en AANBIEDER), niet verzonnen. */
const NEPRAILS = Object.freeze(['simulatie', 'magnaat-test', 'stripe-connect-sandbox']);

/* Het gesloten interne grootboek (kern/pay) is geen provider en verplaatst geen
   euro naar of van buiten. Het telt ALLEEN op een aantoonbaar lokale installatie
   als neprail (./lokaal.js): in productie is het interne saldo het tegoed van
   echte mensen, ook al loopt er geen kaart tussen. */
const LOKALE_NEPRAILS = Object.freeze(['intern']);

/* De echte providers. Geen van deze namen mag ooit op een van de twee lijsten
   hierboven komen; ./registerkeur.js zakt als dat gebeurt. */
const ECHTE_PROVIDERS = Object.freeze(['stripe', 'stripe_connect', 'mollie', 'adyen']);

module.exports = { NEPRAILS, LOKALE_NEPRAILS, ECHTE_PROVIDERS };
