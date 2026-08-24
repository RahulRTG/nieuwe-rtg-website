/* ============================================================================
   DE TRUST STATE -- laag 8, en de gevaarlijkste tegel van de hele laag.

   VERTROUWEN.md par. 3.1 en 3.2 gaan hier allebei over, en ze zijn hier ook
   allebei te overtreden:

     GEEN BEWERING ZONDER BRON. Dit huis heeft in augustus 2026 een schil
     verwijderd die "Enterprise beveiligd / audit gereed" beweerde zonder een
     bron die dat kon dragen. Elk getal hieronder komt uit een BEREKENING over
     de echte opslag; wat niet te berekenen is, staat in `nietGemeten` met de
     reden en niet als een nul.

     GEEN ENKEL CIJFER. Geen securityscore, geen 98/100. Een score middelt een
     catastrofaal pad weg tegen negentig kleine dingen die op orde zijn. Wat
     hier staat is een handvol ABSOLUTE eigenschappen die op nul horen, en een
     getal boven nul is geen slechtere score maar een openstaand punt met een
     naam.

   EN DE GETALLEN STAAN NIET ALLEMAAL OP NUL, want dat is de stand. Wie dit
   groen wil laten lijken, moet de poorten bouwen -- niet de meter bijstellen.
   ========================================================================== */
'use strict';

const R = require('./register');
const bon = require('./bon');
const insluiting = require('./insluiting');

/* Wat deze staat NIET vaststelt, met de reden. Deze lijst hoort te krimpen. */
const NIET_GEMETEN = [
  { wat: 'onbegrensde actoren', reden: 'Het bereik van een actor wordt PER actor berekend (kern/vertrouwen/bereik.js), niet over alle accounts tegelijk; dat zou bij elke opvraging de hele ledenadministratie doorrekenen. Vraag het per account op via de simulatie.' },
  { wat: 'verlopen kritieke bewijzen', reden: 'De bewijsstand is per tenant (kern/tenant/bewijs.js) en heeft dus een organisatie nodig. Een platformbreed getal zou de tenants moeten optellen, en die optelling bestaat niet.' },
  { wat: 'de versheid van de virusdefinities', reden: 'clamd wordt nergens naar zijn definitiedatum gevraagd. Een scanner met oude definities meldt "schoon" precies zoals een verse; zie VERTROUWEN.md par. 6.' }
];

function staat(bak, handelingen) {
  const b = bak || {};
  const keten = bon.controleer(b);
  const groei = insluiting.keurTabel(handelingen || {});
  const zonderPoort = R.SOORTEN.filter(s => s.minstens === 'uitzonderlijk' && !s.poort);
  const gemeten = R.SOORTEN.filter(s => !s.poort);

  return {
    eigenschappen: [
      { wat: 'bevoegdheid die kan groeien', aantal: groei.length,
        bron: 'kern/vertrouwen/insluiting.js over de werkwoordentabel',
        details: groei.map(g => g.reden) },
      { wat: 'gebroken schakels in de bonketen', aantal: (keten.gebroken || []).length,
        bron: 'server/lib/keten.js over de Trust Receipts',
        details: (keten.gebroken || []).map(g => 'schakel ' + g.index + ': ' + g.waarom) },
      { wat: 'ongewogen handelingen die de poort passeerden', aantal: Number(b.ongewogen) || 0,
        bron: 'geteld door de poort zelf, in kern/vertrouwen/index.js',
        details: [] },
      { wat: 'kritieke soorten zonder poort', aantal: zonderPoort.length,
        bron: 'het handelingenregister: soorten met minstens "uitzonderlijk" en geen poort',
        details: zonderPoort.map(s => s.id) },
      { wat: 'soorten die wel worden gemeten maar niet tegengehouden', aantal: gemeten.length,
        bron: 'het handelingenregister: soorten zonder poort',
        details: gemeten.map(s => s.id) }
    ],
    /* De bonketen kan ook AFGEKAPT zijn -- normaal bij een begrensd journaal --
       en dat is iets anders dan gebroken. Wie die twee op een hoop gooit, krijgt
       een alarm bij normaal gedrag en kijkt er daarna niet meer naar. */
    ketenAfgekapt: !!keten.afgekapt,
    nietGemeten: NIET_GEMETEN
  };
}

module.exports = { staat, NIET_GEMETEN };
