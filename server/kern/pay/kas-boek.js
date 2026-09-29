/* GELD LANGS EEN KASCODE (kern/pay/kas-boek.js): de boekingen onder een claim,
   elk met een eigen economische sleutel.

   ./samen.js boekt een betaling in delen (een maaltijdbudget, dan de eigen
   wallet) en draait bij een weigering terug. Dat klopt binnen EEN proces, maar
   een crash halverwege, of een tweede instance die dezelfde claim hervat, zou
   de delen nog een keer boeken. Hier daarom drie regels:

   1. DE SAMENSTELLING WORDT BEVROREN in de claim (./kas-claim.js) voordat er
      iets geboekt wordt. Een hervatting boekt DEZELFDE delen, niet een nieuwe
      samenstelling op een saldo dat inmiddels veranderd is.
   2. ELK DEEL HEEFT EEN SLEUTEL `pay-kas:<sha256>` uit claim en volgnummer
      (../betaalopdracht/terugboeking.js). Sleutel en grootboekregel committen
      samen; een herhaling boekt niets nieuws.
   3. TERUGDRAAIEN IS EEN STAND en geen losse lus: eerst legt de claim vast dat
      hij terugdraait (`markeer`), dan pas gaan de tegenboekingen, ook met een
      sleutel. Een hervatting die de terugdraai-stand ziet, boekt nooit meer
      vooruit -- anders zou een deel dat al terugging alsnog meetellen.

   Een 4xx van het grootboek is een weigering; al het andere is "weet niet" en
   laat de claim staan voor een hervatting. */
'use strict';

const boekTerugEenmaal = require('../betaalopdracht/terugboeking');

module.exports = (ctx) => {
  const { grootboek, boek, boekAsync, economischeBoekingEenmaal, geldModus, dagBestedVan } = ctx;
  const weigering = b => !!b && b.status >= 400 && b.status < 500;
  const boekEenmaal = args => boekTerugEenmaal(Object.assign({ domein: 'pay', grootboek, boek, boekAsync,
    boekEenmaal: economischeBoekingEenmaal, geldModus, sleutelSoort: 'pay-kas' }, args));

  async function terugdraaien({ ref, delen, naar, tot }) {
    for (let j = 0; j < tot; j++) {
      const deel = delen[j];
      const b = await boekEenmaal({ van: naar, naar: deel.rek, centen: deel.centen, soort: 'terug',
        oms: 'Deelbetaling teruggedraaid', ref: ref + '/' + j + '/terug' });
      if (!b || b.error) return { weetNiet: b || { status: 503, error: 'Het terugdraaien kreeg geen antwoord.' } };
    }
    return { ok: true };
  }

  /* `claim.terug` is null of { tot, fout }; `markeer(tot, fout)` legt dat in de
     collectie vast en geeft false terug als de claim intussen van een ander is. */
  async function betaalDelen({ ref, delen, naar, genre, oms, soort, terug, markeer }) {
    if (terug) {
      const t = await terugdraaien({ ref, delen, naar, tot: terug.tot });
      return t.weetNiet ? t : { geweigerd: terug.fout };
    }
    const geboekt = [];
    for (let i = 0; i < delen.length; i++) {
      const deel = delen[i];
      const b = await boekEenmaal({ van: deel.rek, naar, centen: deel.centen, soort, oms, ref: ref + '/' + i,
        genre, dagBesteed: typeof dagBestedVan === 'function' ? dagBestedVan(deel.rek) : undefined });
      if (b && b.ok) { geboekt.push({ rek: deel.rek, centen: deel.centen, klasse: deel.klasse || null, boeking: b.boeking.id }); continue; }
      if (!weigering(b)) return { weetNiet: b || { status: 503, error: 'Het grootboek gaf geen antwoord.' } };
      const fout = Object.assign({}, b);   // met de reden: het lid leest hem, de zaak niet (routes/pay-zaak.js)
      if (!(await markeer(i, fout))) return { weetNiet: { status: 409, error: 'De claim veranderde tijdens het boeken.' } };
      const t = await terugdraaien({ ref, delen, naar, tot: i });
      return t.weetNiet ? t : { geweigerd: fout };
    }
    return { ok: true, delen: geboekt };
  }

  return { boekEenmaal, betaalDelen, weigering };
};
