/* HET ZORGPROFIEL DAT MEEREIST -- de twee functies die van een LEZING een
   DOORWERKING maken. Losgeknipt van ./gastzorg.js omdat dat bestand daarmee
   over de tienkilobytegrens van keuringsregel 13 ging; de reden dat ze bestaan
   staat hieronder en hoort bij elkaar te blijven.

   Gemeten aanleiding: scripts/doorwerking.js telde veertien plekken die het
   zorgprofiel aan een tweede partij gaven zonder een zaak te noemen (dus geen
   regel in het inzagejournaal), waarvan twaalf het als KOPIE in een bestelling
   of reservering schreven. Elk punt zag er los redelijk uit; samen betekenden
   ze dat een lid nooit kon zien wie zijn allergieen las, en dat intrekken niet
   terugwerkte. */
'use strict';

module.exports = ({ zorgVoor, nu }) => {
  /* zorgMee -- gebruik dit en niet zorgVoor() zodra het antwoord bij een
     TWEEDE partij belandt of in een bestelling wordt bewaard.

     Waarom er twee zijn. `zorgVoor` is het lezen: hij geeft het profiel zoals
     het NU is. `zorgMee` is het meegeven, en dat is iets anders, want een kopie
     in een bestelling gaat een eigen leven leiden. Drie dingen die deze functie
     daarom afdwingt, en die op veertien plekken ontbraken:

       DOEL       er MOET een zaak en een reden bij; zonder zaak geeft hij niets
                  terug. Een kopie zonder ontvanger is geen doorwerking maar een
                  afdruk, en een afdruk is niet in te trekken.
       JOURNAAL   de zaak komt in het inzagejournaal van het lid, zodat het lid
                  kan zien wie zijn allergieen las.
       ACTUALITEIT  de kopie draagt `op` en `bron`, zodat een lezer met
                  zorgActueel() kan zien dat hij naar iets ouds kijkt -- en dat
                  het lid het intussen kan hebben ingetrokken.

     Wat dit NIET repareert: kopieen die al in de database staan. Die dragen geen
     `op` en zorgActueel() zegt dat dan ook. */
  function zorgMee(key, door) {
    if (!door || !door.zaak) return null;
    const p = zorgVoor(key, door);
    if (!p) return null;
    return Object.assign({}, p, { op: nu(), bron: 'zorgprofiel', voor: String(door.zaak).slice(0, 40) });
  }

  /* De PROJECTIE: een bewaarde kopie naast de bron van nu.

     Dit is de kant die de kopie onschadelijk maakt zonder hem weg te gooien. De
     bron wint altijd; de kopie zegt alleen nog wat er stond. Vier uitkomsten,
     en `ingetrokken` is met opzet iets anders dan `leeg`: het eerste is een
     besluit van het lid, het tweede is een profiel dat er nooit was. */
  function zorgActueel(key, bewaard) {
    const nuP = zorgVoor(key);
    if (!bewaard) return { stand: nuP ? 'alleen-nu' : 'geen', zorg: nuP, kopie: null };
    if (!nuP) return { stand: 'ingetrokken', zorg: null, kopie: bewaard,
      uitleg: 'het lid deelt dit niet meer; wat u eerder kreeg is niet meer geldig' };
    const zelfde = JSON.stringify([nuP.allergenen, nuP.dieet, nuP.medisch])
      === JSON.stringify([bewaard.allergenen || [], bewaard.dieet || '', bewaard.medisch || '']);
    return { stand: zelfde ? 'gelijk' : 'gewijzigd', zorg: nuP, kopie: bewaard,
      kopieOp: bewaard.op || null,
      uitleg: zelfde ? null : (bewaard.op
        ? 'het profiel is gewijzigd na ' + bewaard.op + '; houd de bovenste aan'
        : 'de bewaarde kopie draagt geen datum (van voor deze laag); houd de bovenste aan') };
  }

  return { zorgMee, zorgActueel };
};
