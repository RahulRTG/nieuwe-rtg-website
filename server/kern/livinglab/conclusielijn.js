/* ============================================================================
   DE GESCHIEDENIS VAN EEN CONCLUSIE -- wat er veranderde, en waardoor.

   EEN CONCLUSIE IS GEEN ZIN IN EEN PDF. Hij begint als aanname, krijgt dragers,
   stijgt, zakt soms weer, en wordt af en toe herzien. Wie alleen de laatste
   stand ziet, ziet niet dat een lab van gedachten is veranderd -- en juist dat
   is wat een onderzoeksinstituut van een mening onderscheidt.

   DRIE REGELS:

   1. HIJ GROEIT AAN. Een regel wordt toegevoegd en nooit aangepast; de laatste
      stand staat bovenaan de conclusie zelf, de weg ernaartoe hier.

   2. ELKE REGEL DRAAGT EEN OORZAAK. Niet "graad gewijzigd" maar: er kwam een
      drager bij, er viel er een weg, een mens tekende, of het plafond zakte
      omdat het bewijs eronder verdween. Zonder oorzaak is een geschiedenis een
      lijst tijdstippen.

   3. GEEN NAMEN VAN DEELNEMERS. Een drager verwijst naar een observatie-id, niet
      naar wie hem deed. Wie zich terugtrekt, verdwijnt uit het dossier -- en dan
      hoort zijn spoor niet in de geschiedenis van een conclusie achter te
      blijven (./terugtrekken.js zou anders niets waard zijn).
   ========================================================================== */
'use strict';

const SOORTEN = ['gemaakt', 'drager-erbij', 'drager-eraf', 'graad-gezet', 'herijkt', 'tekst-herzien'];

/* Voegt een regel toe. `van` en `naar` zijn bewijsgraden waar dat van toepassing
   is; anders blijven ze leeg -- een veld met een verzonnen waarde leest als een
   verandering die er niet was. */
function noteer(c, { soort, van, naar, oorzaak, door, at }) {
  if (!c) return null;
  if (!Array.isArray(c.geschiedenis)) c.geschiedenis = [];
  const regel = { soort: SOORTEN.includes(soort) ? soort : 'graad-gezet',
    van: van || null, naar: naar || null,
    oorzaak: String(oorzaak || '').slice(0, 200) || null,
    door: String(door || '').slice(0, 80) || null, at };
  c.geschiedenis.unshift(regel);
  /* Honderd regels is ruim voor een conclusie die vijf jaar meegaat; wat erboven
     komt is bijna zeker een lus die per ongeluk noteert. */
  if (c.geschiedenis.length > 100) c.geschiedenis.length = 100;
  return regel;
}

/* De versies zoals een lezer ze ziet: elke GRAADverandering is een versie, de
   rest is wat ertoe leidde. Zo leest de geschiedenis als v1, v2, v3 met daarbij
   wat er gebeurde -- en niet als een logboek waarin je zelf moet zoeken. */
function versies(c) {
  const rijen = (c && c.geschiedenis ? c.geschiedenis : []).slice().reverse();
  const uit = [];
  let onderweg = [];
  for (const r of rijen) {
    if (r.soort === 'graad-gezet' || r.soort === 'herijkt') {
      uit.push({ versie: uit.length + 1, graad: r.naar || null, at: r.at, door: r.door,
        waardoor: onderweg.concat([r.oorzaak]).filter(Boolean) });
      onderweg = [];
    } else {
      onderweg.push(r.oorzaak);
    }
  }
  /* Wat er na de laatste graadverandering nog gebeurde, hoort er niet onder te
     vallen: dat is geen versie maar wat er sindsdien is bijgekomen. */
  return { versies: uit, sindsdien: onderweg.filter(Boolean) };
}

module.exports = { noteer, versies, SOORTEN };
