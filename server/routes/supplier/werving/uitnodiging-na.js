'use strict';
/* WAT ER GEBEURT NA EEN AANMELDING BIJ HET TEAM: de herkomst van het lid, het
   activiteitenlog en het seintje aan de zaak -- en sinds 23 september 2026 het
   DIENSTVERBAND bij de entiteit (ARBEID.md par. 7a, besluit 1). Afgesplitst uit
   ./uitnodiging-claim.js, dat over de claim zelf gaat.

   De brug komt uit kern/concern/aanname.js en wordt pas op het moment van
   aanroepen opgehaald: deze laag wordt gemount voordat elke naam in de kern is
   gezet, en een naam die bij het monteren wordt uitgepakt bevriest als
   undefined. Faalt de brug, dan gaat de aanmelding gewoon door -- een aanname
   die gisteren lukte mag vandaag niet weigeren -- maar de uitslag reist mee in
   het antwoord, met de reden, en valt nooit stil weg. */
module.exports = ctx => {
  const { accounts, logActivity, notifySupplier, kern } = ctx;

  function dienstverband(lid, s, inv) {
    try {
      const brug = kern && kern.dienstverbandUitAanname;
      if (typeof brug !== 'function') return { gemaakt: false, reden: 'RTG Concern is in dit proces niet geladen.' };
      return brug({ zaak: s.code, persoon: 'user-' + lid.id, rol: inv.func || null });
    } catch (e) { return { gemaakt: false, reden: 'Het dienstverband kon niet worden vastgelegd.' }; }
  }

  function neveneffecten(lid, s, naam, inv) {
    try {
      const st = accounts.getMemberState(lid.id) || {};
      if (!st.via) {
        st.via = { soort: 'zaak', code: s.code, naam: s.name, at: new Date().toISOString() };
        accounts.saveMemberState(lid.id, st);
      }
    } catch (e) {}
    logActivity(s.code, { name: naam, role: inv.role },
      naam + ' meldde zich aan als teamlid (RTG-lid)');
    try {
      notifySupplier(s.code, { kind: 'team', text: naam + ' heeft zich aangemeld bij het team.' });
    } catch (e) {}
    return dienstverband(lid, s, inv);
  }

  return { neveneffecten };
};
