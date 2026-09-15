/* ============================================================================
   DE WEIGERING VAN DE BRUG -- waarom een aanroep er niet door komt.

   DIT IS EEN NAAD EN GEEN OPDELING OM DE OMVANG. ./brug.js is de POORT: de rem,
   de machtigingscontrole, het tellen. Dit bestand is de UITLEG: welk van de drie
   gevallen zich voordoet en wat de aanroeper eraan kan doen. Die twee splitsen
   heeft een reden die verder gaat dan opruimen -- de uitleg is het CONTRACT met
   een derde, en een contract hoort op één plek te staan waar je het kunt
   nalezen zonder de poortlogica te hoeven volgen.

   DRIE GEVALLEN, EN DE UITWEG VERSCHILT PER GEVAL. Dat is het hele punt van dit
   bestand: "403 Forbidden" laat een uitgever raden, en drie van de vier oorzaken
   die hij dan bedenkt zijn dingen waar hij niets aan kan doen.

     NIET_GEVRAAGD   de app vraagt hem niet in zijn manifest
                     -> de uitgever zet hem in een volgende versie
     NIET_VERLEEND   het lid gaf hem niet, of trok hem terug
                     -> alleen het lid kan dit aanzetten
     VERSMALD        het lid GAF hem en mocht hem zelf niet weggeven
                     -> geen van beiden lost dit met een knop op

   DAT DERDE GEVAL IS ER OP 14 SEPTEMBER 2026 BIJ GEKOMEN, met de versmalling
   (kern/namens/versmalling.js). Het viel daarvoor onder het tweede, en dat zegt
   letterlijk "Alleen het lid kan dit aanzetten, in de App Store" -- onwaar voor
   dit geval, want het lid kan daar drukken wat hij wil. Een weigering die de
   verkeerde uitweg noemt, is duurder dan een kale weigering: hij kost de
   uitgever en het lid allebei een ronde.
   ========================================================================== */
'use strict';

const fout = require('../platformfout');

function maakWeigering({ uitleg }) {
  /* Geeft een platformfout terug, of `null` als deze machtiging er gewoon is.
     De volgorde is die van de lijst hierboven omgekeerd: eerst het smalste
     geval, want VERSMALD is ook "niet verleend" en zou anders onder de bredere
     weigering verdwijnen. */
  return function weigerMachtiging({ naam, machtiging, heeft, vraagt, versmald }) {
    if (heeft.includes(machtiging)) return null;

    const eis = versmald && typeof versmald === 'object' ? versmald[machtiging] : null;
    if (eis) {
      return fout.maak('RTG_MACHTIGING_VERSMALD',
        'De methode "' + naam + '" vraagt de machtiging "' + machtiging + '". Dit lid heeft hem ' +
        'aangevinkt, maar mag hem zelf niet weggeven; hij is daarom niet verleend.',
        { methode: naam, machtiging, verleend: heeft, eis,
          waarom: typeof uitleg === 'function' ? uitleg(eis) : null,
          hoe: 'Dit lost het lid niet op met een knop en jij niet met een nieuwe versie. Werk zonder ' +
            'deze machtiging verder; verandert er iets aan de situatie van het lid, dan kan hij hem ' +
            'opnieuw verlenen en werkt hij vanzelf.' });
    }

    /* Daarom staat er wat er nodig was, wat dit lid WEL heeft gegeven, en waar
       hij het kan veranderen. Dat laatste is het belangrijkste: het lid, niet
       de uitgever, en niet RTG. */
    const gevraagdMaarNietGegeven = Array.isArray(vraagt) && vraagt.includes(machtiging);
    return fout.maak(gevraagdMaarNietGegeven ? 'RTG_MACHTIGING_NIET_VERLEEND' : 'RTG_MACHTIGING_NIET_GEVRAAGD',
      'De methode "' + naam + '" vraagt de machtiging "' + machtiging + '". '
        + (gevraagdMaarNietGegeven
            ? 'Je app vraagt hem in zijn manifest, maar dit lid heeft hem niet verleend of weer ingetrokken.'
            : 'Je app vraagt hem niet in zijn manifest, dus het lid heeft hem ook nooit kunnen geven.'),
      { methode: naam,
        machtiging,
        verleend: heeft,
        gevraagd: Array.isArray(vraagt) ? vraagt : null,
        hoe: gevraagdMaarNietGegeven
          ? 'Alleen het lid kan dit aanzetten, in de App Store onder "wat mag deze app". Vraag het niet nog eens via de brug; werk zonder deze machtiging verder.'
          : 'Zet hem in het manifest van een volgende versie, met een doel. Die versie gaat opnieuw langs de keuring, en het lid beslist opnieuw.' });
  };
}

module.exports = { maakWeigering };
