/* Foundation OS, deel "partners-portaal": de buitenkant van het partnerdossier.

   Twee dingen die bij elkaar horen omdat ze allebei over de GRENS gaan tussen
   RTF en de lokale stichting:

   1. de beoordeling -- wat RTF van de samenwerking vindt. Die staat in het
      dossier en komt nooit in het portaal terug. Een oordeel dat je aan de
      beoordeelde laat zien, wordt vanzelf een oordeel dat je niet meer durft
      op te schrijven;
   2. het portaal zelf -- wat de partner op zijn code te zien krijgt. Dat is
      uitsluitend het eigen dossier, de eigen stad en de eigen projecten. Er is
      hier geen functie die op een code meer dan een partner kan opleveren.

   DRIE DEUREN DIE DICHT ZIJN, MET DRIE VERSCHILLENDE ZINNEN. Beeindigd,
   opgeschort en verlopen zijn niet hetzelfde en horen niet als een gedeelde
   403 te lezen: bij "opgeschort" belt de partner RTF, bij "verlopen" wordt er
   een nieuwe overeenkomst getekend, en bij "beeindigd" is er niets meer te
   bellen. Een gedeelde tekst maakt van die drie een raadsel.

   Afgesplitst uit partners.js op de 10 KB-grens (keuringsregel 13). */

module.exports = (ctx, eigen) => {
  const { rid, schoon, S, audit, wie, poort, save } = ctx;
  const { vind, vindCode, verlopen, partnerBeeld, kantoorBeeld } = eigen;

  /* Beoordelingen en incidenten in de samenwerking. Alleen erbij, nooit eraf:
     een dossier dat leeggemaakt kan worden is geen dossier. Er is dus met opzet
     geen beoordeelWeg(); wie zich vergist, schrijft een correctie. */
  function beoordeel(req, id, b) {
    const p = vind(id);
    if (!p) return { status: 404, error: 'Deze partner staat niet in het register.' };
    const w = wie(req);
    const g = poort(w, p.stad, 'partner.beoordelen');
    if (!g.ok) return g;
    b = b || {};
    const cijfer = Number(b.cijfer);
    const tekst = schoon(b.tekst, 400);
    if (!tekst) return { status: 400, error: 'Wat is uw oordeel?' };
    if (!Array.isArray(p.beoordelingen)) p.beoordelingen = [];
    p.beoordelingen.unshift({ id: rid(), door: w.key, soort: b.incident === true ? 'incident' : 'beoordeling',
      cijfer: Number.isFinite(cijfer) && cijfer >= 1 && cijfer <= 10 ? Math.round(cijfer) : null,
      tekst, at: ctx.nu() });
    if (p.beoordelingen.length > 200) p.beoordelingen.pop();
    audit(w.key, 'partner.beoordeling', p.naam, b.incident === true ? 'incident' : 'oordeel');
    save();
    return { ok: true, partner: kantoorBeeld(p) };
  }

  /* Het portaal op de partnercode. De code IS de geloofsbrief; de remmen
     eromheen staan in server/routes/rtfos/portalen.js, dezelfde twee als bij de
     clubcodes (per bron tegen het afgrazen, per code tegen veel bronnen op een
     code). Zie de uitleg in routes/rtfkantoor/codedeuren.js. */
  function portaal(c) {
    const p = vindCode(c);
    if (!p) return { status: 404, error: 'Deze partnercode kennen we niet. Vraag het RTF-kantoor om de code.' };
    if (p.status === 'beeindigd') return { status: 403, error: 'Deze samenwerking is beeindigd.' };
    if (p.status === 'opgeschort') return { status: 403, error: 'Deze samenwerking staat tijdelijk stil. Neem contact op met het RTF-kantoor.' };
    if (verlopen(p)) return { status: 403, error: 'De looptijd van deze samenwerking is verlopen op ' + p.tot + '. RTF maakt een nieuwe overeenkomst.' };
    const projecten = S().projecten.filter(x => x.partnerId === p.id)
      .map(x => ({ id: x.id, naam: x.naam, status: x.status, doelgroep: x.doelgroep, van: x.van, tot: x.tot }));
    return { ok: true, partner: partnerBeeld(p), projecten };
  }

  return { beoordeel, portaal };
};
