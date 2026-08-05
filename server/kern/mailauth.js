/* DMARC: hoort wat er geslaagd is, bij het domein dat de LEZER ziet?

   Dat is de hele reden dat DMARC bestaat. SPF (./mailspf.js) kijkt naar het
   domein uit de ENVELOPE en DKIM (../dkim.js) naar het domein in de
   handtekening; allebei kunnen ze glansrijk slagen op een domein dat de
   ontvanger nooit te zien krijgt. DMARC legt de verbinding met de zichtbare
   From-kop, en dat heet uitlijning.

   TWEE REGELS, dezelfde als bij SPF:

   1. GEEN ANTWOORD IS GEEN GOEDKEURING. Een domein zonder DMARC-record levert
      'geen' op, een DNS-storing 'tijdelijke fout' -- nooit 'gezakt'. Een
      storing bij ons mag geen post van een ander veroordelen.
   2. WIJ HANDHAVEN NIET, WIJ STEMPELEN. Het beleid (none, quarantine, reject)
      wordt GEMELD, niet uitgevoerd. Wat er met gezakte post gebeurt hoort bij
      een mens of bij de regels van een postvak, niet bij een ontleder. */
'use strict';
const spfLaag = require('./mailspf');

module.exports = ({ dns }) => {
  const { spf, domeinVan, orgDomein } = spfLaag({ dns });
  const txt = async (naam) => {
    const rijen = await dns.resolveTxt(naam);
    return (rijen || []).map(r => (Array.isArray(r) ? r.join('') : String(r)));
  };

  /* DMARC. Leest het beleid van het From-domein (of van het organisatiedomein
     erboven) en bepaalt de UITLIJNING: hoort SPF of DKIM bij het domein dat de
     lezer ziet? Zonder die vraag zegt een geslaagde SPF niets. */
  async function dmarc({ vanKop, spfUitslag, spfDomein, dkimUitslag, dkimDomein }) {
    const from = domeinVan(vanKop);
    if (!from) return { uitslag: 'geen', waarom: 'er is geen From-domein om op na te kijken' };
    let record = null, bron = from;
    for (const kandidaat of [from, orgDomein(from)]) {
      if (!kandidaat || (record && bron !== kandidaat)) break;
      try {
        const rijen = await txt('_dmarc.' + kandidaat);
        const gevonden = (rijen || []).find(r => /^v=DMARC1/i.test(r.trim()));
        if (gevonden) { record = gevonden.trim(); bron = kandidaat; break; }
      } catch (e) {
        if (!/ENOTFOUND|ENODATA|NXDOMAIN/i.test(String(e && e.code || e)))
          return { uitslag: 'tijdelijke fout', waarom: 'het DNS antwoordde niet voor _dmarc.' + kandidaat };
      }
    }
    if (!record) return { uitslag: 'geen', waarom: from + ' publiceert geen DMARC-beleid' };

    const veld = (naam) => (new RegExp('(?:^|;)\\s*' + naam + '\\s*=\\s*([^;]+)', 'i').exec(record) || [])[1];
    const beleid = String(veld('p') || 'none').trim().toLowerCase();
    const strengSpf = String(veld('aspf') || 'r').trim().toLowerCase() === 's';
    const strengDkim = String(veld('adkim') || 'r').trim().toLowerCase() === 's';

    const lijntUit = (d, streng) => {
      if (!d) return false;
      const x = String(d).toLowerCase();
      return streng ? x === from : (x === from || orgDomein(x) === orgDomein(from));
    };
    const spfOk = spfUitslag === 'geslaagd' && lijntUit(spfDomein, strengSpf);
    const dkimOk = dkimUitslag === 'geslaagd' && lijntUit(dkimDomein, strengDkim);

    return {
      uitslag: (spfOk || dkimOk) ? 'geslaagd' : 'gezakt',
      beleid, record, viaDomein: bron,
      uitlijning: { spf: spfOk, dkim: dkimOk, strengSpf, strengDkim },
      waarom: spfOk ? 'SPF slaagt en lijnt uit met het From-domein'
        : dkimOk ? 'DKIM slaagt en lijnt uit met het From-domein'
        : 'noch SPF noch DKIM slaagt op het domein dat de lezer ziet (' + from + ')',
      let: (spfOk || dkimOk) ? null
        : 'Het beleid van dit domein is "' + beleid + '". Deze laag STEMPELT alleen; weigeren of in quarantaine zetten is beleid en hoort bij een mens.'
    };
  }

  return { spf, dmarc, domeinVan, orgDomein };
};
