/* ============================================================================
   SPREIDING -- het trio laten meewerken in plaats van wachten.

   Zonder spreiding neemt precies EEN van de drie servers verkeer aan en staan de
   andere twee stand-by. Dat is een failover-opstelling en geen schaalopstelling:
   de machine heeft meer kernen, Node gebruikt er een voor JavaScript, en twee
   processen staan te niksen. Gemeten (docs/meerkernig.md): twee processen op
   dezelfde opslag halen 12.894 verzoeken per seconde tegen 8.586 voor een, met
   een staart die niet slechter wordt.

   WAT DEZE MODULE DOET is drie dingen uit elkaar houden die tot nu toe een
   ding waren:

     rol 'uit'     stand-by. Schrijft niet, krijgt geen verkeer.
     rol 'volger'  schrijft en krijgt verkeer, maar doet geen leiderswerk.
     rol 'leider'  schrijft, krijgt verkeer, en doet het werk dat per installatie
                   een keer hoort te gebeuren: de backup, de zelfzorgautomaat,
                   het routinewerk van de RTG-AI.

   Zonder spreiding bestaat 'volger' niet en is alles precies zoals het was.

   WAAROM DIT REDIS EIST, EN NIET ZACHT TERUGVALT. Sessies wonen in een Map per
   proces; koppelBus() in kern/sessies.js deelt ze over de bus. Zonder REDIS_URL
   is die bus in-proces, en dan gebeurt dit: het inloggen heeft nog geen token,
   dus dat verzoek gaat naar de leider en de sessie ontstaat daar. Het volgende
   verzoek heeft wel een token, kleeft aan een ANDER proces, en dat proces kent
   de sessie niet -- 401, meteen, voor iedereen. Dat is geen randgeval maar de
   gewone gang van zaken, dus zetten we spreiding dan niet aan. Met de reden
   erbij en niet stil: een stand die je aanzet en die er niet is, is erger dan
   een die weigert.

   DE KLEEFREGEL ZELF staat in ./trio-kleef.js. Deze module zegt alleen WELKE
   servers kandidaat zijn; die zegt welke van die kandidaten dit lid krijgt.

   WAT HIER BEWUST NIET STAAT: verkeer aannemen terwijl er even GEEN leider is.
   De poortwachter wacht op een gezonde leider voordat hij iets doorstuurt, ook
   in spreidingsmodus, ook als er twee kerngezonde volgers klaarstaan. Dat kan
   een paar seconden kosten bij een overname. Het mag zo blijven tot iemand meet
   dat het hindert: een leider die net promoveert heeft ook net zijn data van
   schijf herladen, en verkeer aannemen in het gat daarvoor is precies het soort
   slimmigheid dat een leesbare uitval verandert in een onverklaarbare.
   ========================================================================== */
'use strict';
const kleef = require('./trio-kleef');

const PADEN = {
  leider: '/api/cluster/promote',
  volger: '/api/cluster/promote?leider=0',
  uit: '/api/cluster/demote'
};

function maakSpreiding({ servers, apiCall, log }) {
  const gevraagd = process.env.RTG_SPREIDING === '1';
  const bus = !!process.env.REDIS_URL;
  const aan = gevraagd && bus;
  let gemeld = false;

  /* Een keer zeggen wat de stand is, bij de eerste beslissing en niet bij het
     laden: dan staat het in het logboek na de opstartregels van de servers en
     niet ervoor. */
  function meldEens() {
    if (gemeld) return;
    gemeld = true;
    if (aan) log('spreiding aan: alle gezonde servers nemen verkeer aan, kleefroutering op de sessie');
    else if (gevraagd) log('spreiding GEVRAAGD maar NIET aangezet: zonder REDIS_URL delen de processen geen sessies, ' +
      'dus zou elk verzoek na het inloggen op een 401 uitkomen. Zet REDIS_URL en start opnieuw.');
  }

  /* Een rol zetten en pas onthouden als de server hem bevestigt. Mislukt het
     (server net omgevallen, time-out), dan blijft s.rol staan op wat we zeker
     weten en probeert stemAf() het bij de volgende hartslag opnieuw. */
  async function zetRol(i, rol) {
    const s = servers[i];
    if (!s) return false;
    const r = await apiCall(s.port, PADEN[rol], 'POST');
    const ok = !!(r && r.status === 200);
    if (ok) s.rol = rol;
    return ok;
  }

  /* Wat de OUDE leider moet worden als een ander het roer krijgt. Met spreiding
     blijft hij meewerken als volger -- hem naar stand-by sturen zou een derde
     van de leden laten verhuizen voor niets. Zonder spreiding is het stand-by,
     precies zoals het altijd was. */
  const naLeiderschap = () => (aan ? 'volger' : 'uit');

  /* De rollen gelijktrekken met de werkelijkheid. Draait op elke hartslag, maar
     roept alleen iets aan als er echt iets moet veranderen: een server die al
     volger is, krijgt geen tweede promote. */
  async function stemAf(leiderIdx) {
    meldEens();
    if (!aan) return;
    for (let i = 0; i < servers.length; i++) {
      if (i === leiderIdx) continue;
      const s = servers[i];
      if (!s.child || !s.healthy) continue;
      if (s.rol === 'volger') continue;
      const ok = await zetRol(i, 'volger');
      if (ok) log('server ' + s.nr + ' (poort ' + s.port + ') loopt mee en neemt verkeer aan');
    }
  }

  /* Welke servers mogen dit verzoek krijgen. Minder dan twee kandidaten betekent
     dat er niets te kiezen valt; dan is de terugval van de aanroeper (de leider)
     het goede antwoord en slaan we het rekenwerk over. */
  function kleefDoel(req, terugval) {
    if (!aan) return terugval;
    const kandidaten = [];
    for (let i = 0; i < servers.length; i++) {
      const s = servers[i];
      if (s.child && s.healthy && s.rol !== 'uit') kandidaten.push(i);
    }
    if (kandidaten.length < 2) return terugval;
    const i = kleef.kleefIndex(req, kandidaten);
    return i >= 0 ? i : terugval;
  }

  return { aan: () => aan, gevraagd: () => gevraagd, zetRol, naLeiderschap, stemAf, kleefDoel };
}

module.exports = { maakSpreiding };
