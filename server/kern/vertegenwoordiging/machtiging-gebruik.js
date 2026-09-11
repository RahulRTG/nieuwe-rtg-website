/* WAT JE MET EEN MACHTIGING KAN -- de doorsnede en het oordeel per handeling.

   Afgesplitst van ./machtiging.js langs het onderwerp, en het is dezelfde naad
   als bij ./jeugd.js tegenover ./jeugd-acties.js: daar staat wat een machtiging
   IS (zijn vorm, zijn stand, zijn levensduur), hier staat wat je ermee KAN.

   ALLEBEI DE FUNCTIES HIERONDER ZIJN EEN VERSMALLING EN NOOIT EEN VERLENING.
   `versmalMachtiging` is een DOORSNEDE die structureel niets kan toevoegen, en
   `magHandelen` zegt bij twijfel nee. Dat is de grammatica van
   kern/stuur/mandaat.js, letterlijk: een machtiging versmalt bestaand vermogen
   en verleent er nooit.

   Geen db, geen klok van zichzelf -- net als ./machtiging.js, zodat het oordeel
   te beproeven is zonder een server op te starten. */
'use strict';

const { bestaat, BEVOEGDHEDEN } = require('./bevoegdheden');

module.exports = ({ stand }) => {

  /* DE DOORSNEDE. `magClient` is wat de cliënt ZELF heeft; wat daar niet in zit,
     kan een machtiging niet geven. Structureel, niet als vuistregel.

     HIJ HEET `versmalMachtiging` EN NIET `versmal`. Een naam van twee
     lettergrepen die in drie kernmodules staat, zegt niets meer over WAT hij
     versmalt -- en de keuring telt precies dat (`keuringDubbeling`). Zelfde
     remedie als `mandaatGeldig` in kern/stuur/mandaat.js. */
  function versmalMachtiging(magClient, machtiging) {
    const van = Array.isArray(magClient) ? magClient.filter(bestaat) : [];
    const gevraagd = (machtiging && Array.isArray(machtiging.bevoegdheden) ? machtiging.bevoegdheden : []).filter(bestaat);
    const binnen = gevraagd.filter(k => van.includes(k));
    const buiten = gevraagd.filter(k => !van.includes(k));
    return {
      bevoegdheden: binnen, buiten,
      reden: buiten.length
        ? buiten.length + ' van de ' + gevraagd.length + ' gevraagde bevoegdheden vallen af: die heeft u zelf niet. ' +
          'Een machtiging versmalt bestaand vermogen en voegt er nooit iets aan toe.'
        : 'Alle gevraagde bevoegdheden vallen binnen wat u zelf heeft.'
    };
  }

  /* MAG DEZE ENE HANDELING NU? Geeft altijd een reden, en bij twijfel nee. */
  function magHandelen(machtiging, bevoegdheid, ctx) {
    const c = ctx || {};
    const k = String(bevoegdheid || '');
    if (!bestaat(k)) return { mag: false, reden: 'Deze bevoegdheid bestaat niet.' };
    const st = stand(machtiging, c.nu);
    if (st !== 'actief') {
      return { mag: false, stand: st, reden: st === 'voorgesteld'
        ? 'Deze machtiging is nog niet aanvaard; aanvaarden doet de cliënt zelf.'
        : 'Deze machtiging is ' + st + '.' };
    }
    if (!machtiging.bevoegdheden.includes(k)) {
      return { mag: false, stand: st, reden: 'Dit staat niet in de machtiging. Wat er niet in staat, mag niet.' };
    }
    const def = BEVOEGDHEDEN[k];
    if (c.bedragCenten != null) {
      const bedrag = Math.round(Number(c.bedragCenten) || 0);
      if (machtiging.plafondCenten == null) {
        return { mag: false, stand: st, reden: 'Deze machtiging noemt geen plafond, dus er wordt namens u ' +
          'niet over bedragen gesproken.' };
      }
      if (bedrag > machtiging.plafondCenten) {
        return { mag: false, stand: st, reden: 'Dit gaat over het plafond van deze machtiging; daarboven ' +
          'beslist u zelf.' };
      }
    }
    return { mag: true, stand: st, klaarzetten: !!def.klaarzetten,
      reden: def.klaarzetten
        ? 'Binnen de machtiging, en deze bevoegdheid mag alleen KLAARZETTEN -- bevestigen doet de cliënt.'
        : 'Binnen de machtiging.' };
  }

  return { versmalMachtiging, magHandelen };
};
