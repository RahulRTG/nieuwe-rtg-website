/* DE TWEEDE HANDTEKENING -- de voogd die meetekent onder een machtiging.

   Afgesplitst van ./jeugd-acties.js langs de naad die de kop daar zelf al
   trekt: DRIE PARTIJEN, DRIE HANDELINGEN. Die drie (vragen, de rol aanvaarden,
   en het besluit van een mens van RTG) gaan over WIE de voogd is. Deze vierde
   gaat over iets anders -- over een MACHTIGING, en over de volgorde waarin er
   twee handtekeningen onder komen.

   DE JONGERE TEKENT EERST, en dat is de hele reden dat deze handeling bestaat.
   Een voogd die vooraf kan tekenen, zet de jongere voor een voldongen feit; dat
   is precies het "nooit sturen maar openen" uit LEVEN.md par. 2. De volgorde is
   dus geen validatievolgorde maar de regel zelf. */
'use strict';

module.exports = ({ vastleggen, nu, naam, spoor, zoekAlsVoogd }) => {

  async function voogdTekent(voogdKey, mid) {
    const gevonden = zoekAlsVoogd(voogdKey, mid);
    if (!gevonden) return { status: 404, error: 'U bent niet de bevestigde voogd bij deze machtiging.' };
    const { m, clientKey } = gevonden;
    if (!m.voogdNodig) {
      return { status: 409, error: 'Deze machtiging vraagt geen tweede handtekening.' };
    }
    if (m.ingetrokken) return { status: 409, error: 'Deze machtiging is ingetrokken.' };
    if (!m.aanvaard) {
      return { status: 409, error: 'De jongere heeft zelf nog niet getekend. Zolang dat niet is gebeurd, ' +
        'tekent u niets: anders staat hij voor een voldongen feit.' };
    }
    if (m.voogdAanvaard) return { status: 409, error: 'U heeft hier al voor getekend.' };
    const mis = await vastleggen(() => {
      m.voogdAanvaard = { door: naam(voogdKey), at: nu() };
      spoor(clientKey, { soort: 'voogd-tekent', door: naam(voogdKey), machtigingId: m.id, gelukt: true });
    });
    if (mis) return mis;
    return { status: 200, ok: true,
      let: 'Getekend. Nu staan er twee handtekeningen onder en gaat de machtiging pas lopen.' };
  }

  return { voogdTekent };
};
