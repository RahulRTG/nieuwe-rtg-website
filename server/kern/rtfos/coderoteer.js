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

   Deze codes staan als tekst op het dossier en niet in de codelevenscyclus;
   roteren is dus een nieuwe code op dezelfde rij. De oude vindt daarna geen
   dossier meer, en de routelaag laat de koppeling van de oude code vervallen. */
'use strict';

module.exports = (ctx, { partners, gemeente, ondernemers }) => {
  const { code, audit, wie, poort, save } = ctx;

  const SOORTEN = {
    partner: { vind: partners.vind, prefix: 'RTFP', recht: ['partner.beoordelen'] },
    gemeente: { vind: gemeente.vind, prefix: 'RTFG', recht: ['stad.beheren', 'municipal_reporting'] },
    ondernemer: { vind: ondernemers.vind, prefix: 'RTFO', recht: ['stad.beheren', 'business_sponsorships'] }
  };

  function roteer(req, soort, id, reden) {
    const s = SOORTEN[soort];
    if (!s) return { status: 400, error: 'Onbekend soort dossier.' };
    const rij = s.vind(id);
    if (!rij) return { status: 404, error: 'Dit dossier staat niet in het register.' };
    const w = wie(req);
    const g = poort(w, rij.stad, ...s.recht);
    if (!g.ok) return g;
    rij.code = code(s.prefix);
    audit(w.key, soort + '.code-geroteerd', rij.naam, String(reden || 'nieuwe code; de vorige is gesloten').slice(0, 200));
    save();
    return { ok: true, code: rij.code,
      melding: 'De vorige code is direct gesloten, ook voor het account dat eraan hing. Geef deze nieuwe code persoonlijk aan een medewerker.' };
  }

  // de huidige code van een dossier, voor de routelaag die de oude koppeling laat vervallen
  const codeVan = (soort, id) => { const s = SOORTEN[soort]; const r = s && s.vind(id); return r ? r.code : null; };

  return { roteer, codeVan };
};
