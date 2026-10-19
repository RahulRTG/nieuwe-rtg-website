/* DE OPSLAG VAN RAHULS PROFIEL -- de aanvullingen die de boardroom op zijn
   karakter en verhaal zet (db.data.rahulProfiel), achter EEN deur.

   Er is een schrijver (de boardroom, routes/kantoren/regie.js) en er zijn drie
   lezers: dezelfde route, de bron van kern/rahul.js (gezet in
   opzet/kernlaag7.js) en de ledenprompt (kern/ai/prompt.js). Elk keek zelf in
   db.data en elk koos zijn eigen lege waarde. Het profiel gaat in ELKE
   assistent mee; waar het woont hoort op een plek te staan.

   De ledenprompt leest hem nog zelf, en dat is een open punt: dat bestand raakt
   db.data ook voor de ledeninhoud aan en staat op 24 bytes van de 10 kB-grens,
   dus hem hierheen halen vraagt eerst een naad in dat bestand.

   Bewust geen kern/eigencollectie: dit is geen collectie maar een enkel
   object met drie velden, en de vaste kern van het karakter staat in de code
   (kern/rahul.js, bewaakt door de drift-tests) en niet hier.

   `lees()` maakt niets aan en geeft null als er geen profiel is; `zet()` is de
   enige weg erin en kort de velden niet zelf -- dat doet de route die de
   invoer kent. */
'use strict';

module.exports = function maakRahulProfiel({ db }) {
  if (!db) throw new Error('kern/rahul-profiel: zonder db is er niets om te bewaren');
  return {
    lees: () => (db.data && db.data.rahulProfiel) || null,
    zet: ({ karakter, verhaal, at }) => (db.data.rahulProfiel = { karakter, verhaal, at })
  };
};
