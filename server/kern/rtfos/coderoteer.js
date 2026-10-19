/* Foundation OS, deel "coderoteer": een nieuwe code voor de partnerstichting,
   de gemeente en de lokale ondernemer (eigenaarsbesluit 19 oktober 2026).

   Sinds dat besluit opent een code een portaal alleen nog voor het account dat
   er als eerste mee koppelde (kern/codekoppel.js), met een code per
   medewerker. Wie zijn code kwijt is, of wiens code over een schouder werd
   meegelezen, heeft dan een nieuwe nodig -- en de oude moet voor IEDEREEN
   dicht, ook voor het account dat eraan hing. Dat is roteren, en het volgt het
   patroon van de vrijwilliger, de hulpvrager en de donateur
   (vrijwilligerportaal-kantoor.js, deelnemerportaal.js, donateur-kantoor.js):
   een kantoormens op naam, door de poort van de stad met het recht dat ook
   het dossier zelf beheert, met een auditregel. Een lid, een partner of de
   gedeelde kantoorcode roteert niets.

   Deze codes staan als tekst op het dossier en niet in de codelevenscyclus.
   Dit bestand beslist WIE mag en WAT er wisselt; de wissel zelf -- oude code
   dicht, nieuwe erin, auditregel, en daarna de koppeling weg -- loopt atomair
   in een collectietransactie op 'rtfos', de collectie die deze kern bezit
   (kern/codekoppel.js roteer()). */
'use strict';

module.exports = (ctx) => {
  const { code, audit, wie, poort, S } = ctx;

  const SOORTEN = {
    partner: { lijst: 'partners', prefix: 'RTFP', recht: ['partner.beoordelen'] },
    gemeente: { lijst: 'gemeenten', prefix: 'RTFG', recht: ['stad.beheren', 'municipal_reporting'] },
    ondernemer: { lijst: 'ondernemers', prefix: 'RTFO', recht: ['stad.beheren', 'business_sponsorships'] }
  };

  /* Het plan: de poort op de huidige staat, en daarna alleen nog functies die
     in de transactie op de GEKOPIEERDE collectie werken. */
  function plan(req, soort, id, reden) {
    const s = SOORTEN[soort];
    if (!s) return { fout: { status: 400, error: 'Onbekend soort dossier.' } };
    const rij = (S()[s.lijst] || []).find(x => x.id === String(id || ''));
    if (!rij) return { fout: { status: 404, error: 'Dit dossier staat niet in het register.' } };
    const w = wie(req);
    const g = poort(w, rij.stad, ...s.recht);
    if (!g.ok) return { fout: g };
    return {
      vind: (bron) => ((bron && bron[s.lijst]) || []).find(x => x.id === rij.id) || null,
      nieuw: () => code(s.prefix),
      naWissel: (r, bron) => audit(w.key, soort + '.code-geroteerd', r.naam,
        String(reden || 'nieuwe code; de vorige is gesloten').slice(0, 200), bron)
    };
  }

  const koppel = require('../codekoppel')({ db: { data: {} } });
  const MELDING = 'De vorige code is direct gesloten, ook voor het account dat eraan hing. Geef deze nieuwe code persoonlijk aan een medewerker.';
  async function roteer(req, soort, id, reden) {
    const p = plan(req, soort, id, reden);
    if (p.fout) return p.fout;
    const uit = await koppel.roteer(Object.assign({ collectie: 'rtfos', soort }, p));
    return uit ? { ok: true, code: uit.code, melding: MELDING } : { status: 404, error: 'Dit dossier staat niet in het register.' };
  }

  return { plan, roteer };
};
