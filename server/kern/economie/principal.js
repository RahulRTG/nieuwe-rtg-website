/* DE OPAQUE VERWIJZING NAAR EEN HANDELENDE PARTIJ -- één sessie, één principalRef.

   De eerste harde rand van de Economic Identity Graph: namen en e-mailadressen
   komen nooit in economische feiten of proof-projecties terecht.

   WAAROM HIJ HIER STAAT EN NIET IN ./identiteit.js, waar hij begon. Twee takken
   maakten onafhankelijk een bestand met die naam, en ze gaan over verschillende
   vragen. Dit is "wie doet deze handeling, zonder dat ik weet wie hij is";
   ./identiteit.js is "in welke economische WERELD hoort een drager thuis, en op
   welke grond". Dat tweede register is een laag met een firewall eronder en
   wordt door kern/economie/index.js gemonteerd; deze functie wordt rechtstreeks
   door drie routes aangeroepen. Ze samenvoegen zou een module opleveren die
   twee dingen heet. */
'use strict';

function principalVoorSession(session) {
  const s = session || {};
  if (s.account && s.account.id) return 'acc:' + String(s.account.id);
  if (s.tier && s.tier !== 'guest') return 'sess:' + String(s.tier).toLowerCase();
  return null;
}

module.exports = { principalVoorSession };
