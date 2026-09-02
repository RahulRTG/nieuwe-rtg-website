/* Meldcode, deelbestand "sluiten": een dossier afsluiten en de lijst.

   AFSLUITEN KAN ALLEEN NA STAP 5, en de uitkomst wordt daar AFGELEID uit de
   twee beslissingen van het afwegingskader (./meldcode-afweging.js). Hier wordt
   hij dus overgenomen en niet opnieuw gevraagd: wie hem hier nog een keer mag
   invullen, kan een dossier sluiten met een uitkomst die de afweging eronder
   tegenspreekt.

   EN DE AFWEGING IN WOORDEN BLIJFT. Ook "geen actie" is een besluit, en juist
   dat besluit moet later te lezen zijn -- door de schrijver zelf, door een
   collega, door een inspecteur.

   Afgesplitst uit ./meldcode.js op de 10 KB van keuringsregel 13. */
'use strict';

module.exports = (ctx, eigen) => {
  const { nu, schoon, S, audit, wie, poort, save } = ctx;
  const { vind, beeld, gezet, STAPPEN, UITKOMSTEN } = eigen;

  /* Sluiten: alleen na stap 5, met een uitkomst en een afweging in woorden. */
  function sluit(req, id, b) {
    b = b || {};
    const m = vind(id);
    if (!m) return { status: 404, error: 'Dit meldcode-dossier bestaat niet.' };
    if (m.gesloten) return { status: 400, error: 'Dit dossier is al afgesloten.' };
    const w = wie(req);
    const g = poort(w, m.stad, 'casus.beheren', 'individual_cases');
    if (!g.ok) return g;
    if (!gezet(m, 'beslissen')) {
      return { status: 400, error: 'Stap 5 (beslissen) staat nog niet in dit dossier. Afsluiten voor de beslissing is ' +
        'het dossier sluiten zonder besluit.' };
    }
    /* DE UITKOMST WORDT NIET GEKOZEN MAAR OVERGENOMEN uit stap 5. Wie hem hier
       nog een keer mag invullen, kan een dossier sluiten met een uitkomst die
       de afweging tegenspreekt -- en dat is precies wat er gebeurde toen dit
       een los keuzelijstje was. */
    const uitkomst = m.uitkomst;
    if (!uitkomst) {
      return { status: 400, error: 'Dit dossier draagt geen uitkomst. Die volgt uit de twee beslissingen ' +
        'van stap 5; leg die eerst vast.' };
    }
    const afweging = schoon(b.afweging, 1200);
    if (afweging.length < 20) {
      return { status: 400, error: 'Schrijf de afweging op. Ook "geen actie" is een besluit, en juist dat besluit moet ' +
        'later te lezen zijn -- door u, door een collega, door een inspecteur.' };
    }
    m.uitkomst = uitkomst;
    m.status = 'gesloten';
    m.gesloten = { uitkomst, afweging, door: w.key, at: nu() };
    audit(w.key, 'meldcode.gesloten', m.id, uitkomst);
    save();
    return { ok: true, dossier: beeld(m),
      melding: 'Afgesloten. Het dossier blijft staan -- wissen kan niet, en dat is met opzet.' };
  }

  function lijst(req, stadId) {
    const w = wie(req);
    const g = poort(w, stadId, 'casus.lezen', 'individual_cases');
    if (!g.ok) return g;
    const rijen = S().meldcodes.filter(m => m.stad === g.stad.id)
      .sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return { ok: true, aantal: rijen.length, stappen: STAPPEN, uitkomsten: UITKOMSTEN,
      open: rijen.filter(m => !m.gesloten).length,
      dossiers: rijen.slice(0, 200).map(beeld) };
  }

  return { sluit, lijst };
};
