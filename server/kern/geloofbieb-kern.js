/* De ECHTE, leesbare kern van de Geloof & Wijsheid-Bibliotheek. Geen miljoen
   lege titels meer: elk item hieronder heeft een echte, leesbare tekst die je
   kunt openen en lezen. Alle tradities staan als gelijken naast elkaar -- de
   bibliotheek kiest nooit partij, bekeert nooit en oordeelt nooit.

   De teksten zijn eigen, respectvolle inleidingen en reflecties van de
   RTFoundation op een thema binnen een traditie. Ze vervangen geen heilige
   bronnen; ze nodigen uit om verder te lezen. Een kern om mee te beginnen, en
   uit te breiden -- kwaliteit boven aantal.

   doelgroep: mini (0-5), kind (6-11), tiener (12+), gezin (allen). De
   leeftijdspoort in kern/geloofbieb.js gebruikt deze waarde. */

// [traditie, traditieLabel, thema, doelgroep, titel, tekst]

/* De inhoud staat in geloofbieb-kern/deel1.js en deel2.js. Opgeknipt omdat een
   bestand van 18 KB niet meer prettig te bewerken is; de bibliotheek groeit nog,
   dus er komen delen bij. Hier alleen samenvoegen, zodat de require-paden van de
   rest van het systeem hetzelfde blijven. */
const K = [].concat(
  require('./geloofbieb-kern/deel1'),
  require('./geloofbieb-kern/deel2')
);

module.exports = { KERN: K };
