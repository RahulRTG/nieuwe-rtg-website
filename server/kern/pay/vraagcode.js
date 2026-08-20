/* RTG Pay: DE VRAAGCODE -- "betaal mij 18,50 voor diner", als capability.

   Dit is een handeling voor RTG Link (LINK.md, kern/link/handelingen.js) en hij
   staat met opzet HIER en niet daar: de linklaag weet niet wat geld is. Wat hij
   wel doet, is een mens laten zien wat er gaat gebeuren en hem laten bevestigen;
   wat er dan gebeurt, staat in dit bestand en loopt langs de gewone weg van dit
   domein.

   ER IS MAAR EEN PLEK WAAR GELD BEWEEGT, en dat blijft `stuur` in ./verzoeken.js.
   Deze handeling boekt niets zelf, kent het grootboek niet en heeft geen eigen
   bedraggrenzen: hij vraagt het aan de laag die dat al weet. Een tweede plek met
   eigen grenzen is een tweede waarheid over geld (LAT.md regel 4).

   WAT DIT NIET IS: een betaalverzoek dat blijft staan. Dat bestaat al -- het
   Klompje (verzoekMaak), dat je aan een BEKENDE vriend stuurt en dat wacht tot
   hij betaalt. Deze code is het andere geval: je weet nog niet wie er betaalt,
   want hij staat voor je en scant. Daarom leeft hij twee minuten en niet langer.

   DE POORTEN VAN DIT DOMEIN GELDEN GEWOON. De betaler komt langs `payGate` --
   dezelfde functie waar /api/pay/stuur langs gaat -- want een tweede deur naar
   hetzelfde geld zonder diezelfde poort is een omweg om die poort heen. Dat is
   letterlijk de fout die bij de vorige plak van deze laag boven water kwam.

   EN DE KANT DIE HIJ OP GAAT. De uitgever ONTVANGT; de scanner BETAALT en
   bevestigt op zijn eigen toestel. Dat is LINK.md par. 3.2: een code mag een
   betaling in gang zetten, maar de bevestiging staat bij degene wiens geld het
   is. Een code die geld naar de scanner toe HAALT bestaat hier niet, en dat is
   geen omissie -- dat zou een toonderpapier zijn dat iedereen kan fotograferen. */
'use strict';

const euro = (centen) => '€ ' + (Math.round(Number(centen)) / 100).toFixed(2).replace('.', ',');

module.exports = ({ pay, payGate, schoon }) => ({
  id: 'geld.ontvangen',
  wat: 'Een bedrag betalen',
  uitgever: ['lid'],
  aanvaarder: ['lid'],
  ttlMs: 2 * 60 * 1000,
  eenmalig: true,

  /* Van invoer naar een GEBONDEN opdracht. Wat hier uitkomt ligt vast: het bedrag
     kan daarna niet meer veranderen, ook niet door degene die straks scant. Dat
     is de hele reden dat een capability meer is dan een link met parameters. */
  lees(invoer, uitgever) {
    const centen = Math.round(Number(invoer && invoer.centen));
    if (!Number.isFinite(centen) || centen < pay.MIN_CENTEN || centen > pay.MAX_CENTEN)
      return { status: 400, error: 'Dat bedrag kan niet.' };
    if (!uitgever.codenaam) return { status: 403, error: 'Deze sessie kan geen geld ontvangen.' };
    return { centen, oms: schoon(invoer && invoer.oms, 80) || 'Vraagcode', aanCodenaam: uitgever.codenaam };
  },

  /* Het bedoelingsscherm. Wie er vraagt zet de linklaag erbij (uit de codenaam);
     hier staat alleen wat er gebeurt, waarom, en wat de ander van je te weten
     komt. Geen echte naam, geen saldo, geen geschiedenis. */
  beschrijf(opdracht) {
    return {
      wat: 'Betalen',
      waarom: opdracht.oms,
      velden: [{ naam: 'Bedrag', waarde: euro(opdracht.centen) }],
      gegevens: ['je codenaam', 'het bedrag en de omschrijving']
    };
  },

  /* Uitvoeren: van de scanner naar de uitgever. De idempotentiesleutel komt van
     de linklaag en is aan DEZE code gebonden -- twee keer indrukken op een trage
     verbinding boekt dus een keer. */
  async doe({ opdracht, aanvaarder, sessie, idem }) {
    const poort = payGate ? payGate(sessie) : { ok: true };
    if (!poort.ok) return { status: poort.status || 403, error: poort.error, kyc: true };
    if (!aanvaarder.codenaam) return { status: 403, error: 'Deze sessie kan niet betalen.' };
    const r = await pay.stuur({ van: aanvaarder.codenaam, aanCodenaam: opdracht.aanCodenaam,
      centen: opdracht.centen, oms: opdracht.oms, idem, soort: 'vraagcode' });
    if (r.error) return r;
    return { betaald: opdracht.centen, aan: opdracht.aanCodenaam, saldo: r.saldo, bijgeladen: r.bijgeladen };
  }
});
