/* Bankregie, deel "vergunning": wat er is VASTGELEGD over wat RTG zelf mag, en
   welke partnerrails meedraaien. Bewust naast de drie-standen-knop en niet
   erin: de knop is een BESLUIT (wat willen we clearen), dit is een REGISTRATIE
   (wat is er afgegeven). Wie die twee door elkaar haalt, kan zichzelf een
   vergunning geven door een schakelaar om te zetten.

   Wat hier staat wordt gelezen door kern/bevoegdheid.js, dat er de vraag "mag
   deze handeling" mee beantwoordt. Leeg betekent nee. Krijgt de gedeelde ctx
   van kern/bankregie/index.js. */
'use strict';

const BEV = require('../bevoegdheid');

module.exports = (ctx) => {
  const { d, save } = ctx;

  const vergunning = () => (d().vergunning ? { ...d().vergunning } : null);
  const partnerRails = () => ({ ...d().partnerRails });

  /* De vergunning vastleggen. Dit is een REGISTRATIE en geen besluit: hier komt
     te staan wat er in werkelijkheid is afgegeven, zodat kern/bevoegdheid.js
     ernaar kan kijken. Vandaar dat een lege soort hem juist wist -- "we hebben
     hem niet meer" moet net zo makkelijk vast te leggen zijn als "we hebben hem
     wel", anders blijft een ingetrokken vergunning staan omdat weghalen
     omslachtiger is dan laten staan. */
  function vergunningZet({ soort, nummer, entiteit, landen, tot, wie }) {
    if (!soort) { d().vergunning = null; save(); return { ok: true, vergunning: null, wie: wie || 'boardroom' }; }
    if (!BEV.RANG[soort]) return { status: 400, error: 'Kies ' + BEV.SOORTEN.join(', ') + '.' };
    const ms = tot ? Date.parse(tot) : NaN;
    if (tot && !Number.isFinite(ms)) return { status: 400, error: 'De einddatum is geen geldige datum.' };
    const lijst = Array.isArray(landen) ? landen.map(l => String(l).toUpperCase().slice(0, 2)).filter(Boolean) : [];
    d().vergunning = { soort, nummer: String(nummer || '').slice(0, 60), entiteit: String(entiteit || '').slice(0, 120),
      landen: lijst, tot: Number.isFinite(ms) ? ms : null, at: Date.now() };
    save();
    return { ok: true, vergunning: { ...d().vergunning }, wie: wie || 'boardroom' };
  }
  function partnerRailZet({ rail, aan }) {
    if (!(rail in d().partnerRails)) return { status: 400, error: 'Onbekende partnerrail.' };
    d().partnerRails[rail] = aan === true; save();
    return { ok: true, partnerRails: { ...d().partnerRails } };
  }


  return { vergunning, partnerRails, vergunningZet, partnerRailZet };
};
