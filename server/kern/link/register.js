/* RTG Link: HET TYPEREGISTER -- van een gescande tekst naar een SOORT ding.

   LINK.md par. 0: een code zegt wie of wat, nooit wat er mag. Dit bestand doet
   het eerste deel en niets van het tweede: het kent geen enkele bevoegdheid, het
   raakt de database niet aan en het weet niet wie er scant. Het zegt alleen: dit
   is een PERSOON, dit is een PLAATS, dit is een ZAAK, dit is een BETAALCODE.

   TWEE BRONNEN, GEEN DERDE PARSER. De leesbare vormen (rtg:pin:, rtg:tafel:,
   rtg:kas:, rtg:entree:) worden gelezen door public/shared/rtgcode.js -- hetzelfde
   bestand dat de browser gebruikt, hier gewoon binnengehaald. Een tweede parser
   op de server zou binnen een maand van de eerste afwijken (LAT.md regel 4), en
   dan leest de scanner iets anders dan de deur. De gesloten vorm (RTG1....) gaat
   door kern/dyncode.js, want alleen die kan de handtekening controleren.

   HET REGISTER IS DE HELE UITBREIDBAARHEID. Wie een nieuwe soort code toevoegt,
   voegt hier een regel toe -- niet een tweede scanner, niet een tweede deur.

   WAT ER BEWUST NOG NIET STAAT: pas, zegel en deur bestaan als ondertekende
   codesoort (kern/dyncode.js) maar hebben op deze laag nog geen onderwerp. Ze
   staan hier met naam en met `nog: true`, zodat de laag "dit is van ons, maar
   hier doen we er nog niets mee" kan zeggen in plaats van "onbekend". Een code
   van het huis die als vreemd wordt afgedaan, is een fout die je pas ziet als
   iemand belt. */
'use strict';

const RTGCode = require('../../../public/shared/rtgcode');

/* De soorten die deze laag kent, met per soort wat het ONDERWERP is. De teksten
   zijn wat een scherm mag tonen voordat er iets is opgezocht -- ze beschrijven
   het type, nooit de mens erachter. */
const TYPES = {
  persoon:    { wat: 'een mens' },
  plaats:     { wat: 'een plek bij een zaak' },
  zaak:       { wat: 'een zaak' },
  betaalcode: { wat: 'een betaalcode van een lid' }
};

/* Van codesoort naar type. De sleutels links zijn de soorten uit
   public/shared/rtgcode.js EN uit kern/dyncode.js -- die overlappen met opzet:
   `rtg:tafel:` en een ondertekende tafelcode wijzen hetzelfde ding aan, alleen
   de ene ligt op tafel en de andere leeft een minuut. */
const VAN_SOORT = {
  pin: 'persoon',            // de vaste contactpin (leesbaar, blijvend)
  contact: 'persoon',        // de levende contactcode (ondertekend, 60 seconden)
  tafel: 'plaats',
  entree: 'zaak',
  kas: 'betaalcode',
  pas: null, zegel: null, deur: null   // bestaan, maar hebben hier nog geen onderwerp
};

module.exports = ({ dyncodeGeef }) => {

/* De ondertekenaar wordt OPGEHAALD en niet vastgehouden: kern/dyncode.js wordt in
   kernlaag1 gezet en deze laag wordt later gebouwd. Dezelfde late binding als bij
   commDm en dyncodeGeef elders; ontbreekt hij, dan zegt dat het eerlijk in plaats
   van elke ondertekende code stil als vreemd af te doen. */
const dyn = () => (typeof dyncodeGeef === 'function' ? dyncodeGeef() : null);

/* Van tekst naar type. Geeft altijd een object met .type terug (null als we er
   niets van maken), plus .reden voor de laag erboven -- die beslist wat de
   SCANNER te horen krijgt, want daar zit de regel over gelijke antwoorden.

   `mis: true` betekent: dit telt als misser op de deurrem. Een ondertekende code
   die alleen VERLOPEN is, telt dus niet -- de handtekening bewijst dat hij van
   ons kwam, en een lid met een oude QR is geen raadster. Wie zelf een token in
   elkaar zet, komt niet langs de handtekening en telt wel. */
function duidt(tekst) {
  const p = RTGCode.lees(tekst);
  if (p.soort === 'rtg1') {
    const d = dyn();
    if (!d) return { type: null, reden: 'geen-codelaag' };
    const r = d.lees(p.token);
    if (!r.ok) return { type: null, reden: r.reden === 'verlopen' ? 'verlopen' : 'vreemd',
      mis: r.reden !== 'verlopen' };
    return geduid(r.soort, r.code, 'levend', p.token);
  }
  if (p.soort === 'tafel') return geduid('tafel', p.code, 'vast', null, p.tafel);
  if (p.soort === 'kas') return geduid('kas', p.code, 'vast');
  if (p.soort === 'entree') return geduid('entree', p.code, 'vast');
  if (p.soort === 'pin') return geduid('pin', p.pin, 'vast');
  return { type: null, reden: 'geen-rtg-code' };
}

/* Een geduide code. `sleutel` is wat de oplosser van dat type nodig heeft: een
   pin, een zaakcode, een betaalcode -- of, bij de levende contactcode, het hele
   token, want alleen kern/sociaal/pin-live.js kan dat omzetten naar een mens. */
function geduid(soort, code, hoe, token, tafel) {
  const type = VAN_SOORT[soort];
  if (type === undefined) return { type: null, reden: 'vreemd', mis: true };
  if (type === null) return { type: null, reden: 'nog-geen-laag', soort };
  const uit = { type, soort, vorm: hoe, sleutel: soort === 'contact' ? token : code };
  if (tafel !== undefined) uit.tafel = tafel;
  return uit;
}

return { duidt, TYPES, VAN_SOORT };
};
