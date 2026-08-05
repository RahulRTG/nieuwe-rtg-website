/* ============================================================================
   CAMERA EN MICROFOON OP EEN TELEFOON: DE ENIGE WAARSCHUWING DIE DIT VOORKOMT.

   Een browser geeft camera, microfoon en locatie alleen vrij in een BEVEILIGDE
   context: https, of localhost. Een telefoon die deze server op
   http://192.168.x.x aanroept heeft dus geen navigator.mediaDevices -- en dan
   doet geen enkel camerascherm iets. Op de laptop op localhost werkt alles wel,
   dus het lijkt aan het toestel te liggen. Dat is precies de klacht waar deze
   module uit komt: "alle camera's doen het nergens, op mijn telefoon doet niks
   het." test/media.e2e.js meet het op een echt LAN-adres.

   public/shared/media.js zegt dat in de PAGINA, waar de gebruiker staat. Deze
   module zegt het aan de kant waar iemand er iets aan kan doen: wie de server
   start. Met het echte adres erbij, want zonder dat is het advies abstract.

   ALLEEN ALS HET ECHT SPEELT. Praat de app https (RTG_TLS=1), staat ze op
   loopback, of is dit een kind van de poortwachter, dan zwijgt ze. Een
   waarschuwing die in het gewone geval afgaat, leert iedereen hem weg te kijken
   -- dezelfde regel als in opzet/startcontrole.js.
   ========================================================================== */
'use strict';

function lanAdressen(netten) {
  const uit = [];
  for (const naam of Object.keys(netten || {})) {
    for (const n of netten[naam] || []) {
      if (n && n.family === 'IPv4' && !n.internal) uit.push(n.address);
    }
  }
  return uit;
}

/* Zegt terug WAT er gezegd is (of null), zodat een toets dit kan nakijken zonder
   de logregels van een echt opgestarte server te moeten lezen. Twee soorten:

     waarschuwing  http op het netwerk -- daar werkt geen camera
     wegwijzer     https op het netwerk -- hier moet de telefoon heen

   Die tweede hoort erbij. Wie RTG_TLS=1 zet doet dat omdat hij de camera op een
   toestel wil, en dan is het adres van dat toestel het antwoord op de vraag. Het
   zonder erbij zeggen laat iemand zoeken naar iets wat de server al weet. */
module.exports = function veiligAdres({ PORT, HOST, env, netten, log }) {
  env = env || process.env;
  if (env.RTG_SERVER) return null;                                // kind van de poortwachter
  if (HOST && HOST !== '0.0.0.0' && HOST !== '::') return null;   // loopback: geen telefoon in zicht
  let adressen = [];
  try { adressen = lanAdressen(netten || require('os').networkInterfaces()); }
  catch (e) { return null; }
  if (!adressen.length) return null;                              // alleen loopback: het speelt niet

  const veilig = env.RTG_TLS === '1';
  const waar = adressen.map(a => (veilig ? 'https' : 'http') + '://' + a + ':' + PORT).join(', ');
  const regels = veilig ? [
    'Op een telefoon in hetzelfde netwerk: ' + waar + '.',
    'Dat is https, dus camera, microfoon en locatie werken daar. Met een self-signed certificaat ' +
    'moet je op het toestel eenmalig de waarschuwing accepteren.'
  ] : [
    'LET OP: deze server praat http en staat op het netwerk (' + waar + ').',
    'Op een telefoon werken camera, microfoon en locatie daar NIET: buiten https geeft de browser ' +
    'ze niet vrij. Start met RTG_TLS=1 voor https (een self-signed cert is genoeg om het te proberen), ' +
    'of zet er een doorgeefluik met TLS voor. De apps zeggen zelf ook waarom het niet gaat.'
  ];
  const zeg = veilig
    ? ((log && log.info) ? log.info.bind(log) : console.log)
    : ((log && log.warn) ? log.warn.bind(log) : console.warn);
  zeg('[start] ' + regels[0]);
  zeg('        ' + regels[1]);
  return { soort: veilig ? 'wegwijzer' : 'waarschuwing', adressen, regels };
};

module.exports.lanAdressen = lanAdressen;
