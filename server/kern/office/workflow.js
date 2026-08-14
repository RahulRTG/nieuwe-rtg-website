/* De menselijke documentwerkstroom van RTG Office.

   Een status is hier een bevoegdheid en geen kleurlabel. Een schrijver kan
   beoordeling vragen; alleen de eigenaar kan goedkeuren of archiveren. Voor
   de twee beslissingen met gevolg is een expliciete menselijke bevestiging
   verplicht. AI mag voorstellen doen, nooit deze deur bedienen. */
'use strict';

const { FASES } = require('./basis');

module.exports = ({ save, sseToCustomer }, basis) => {
  const { nu, docMet, naamVan, magSchrijven, magLezen, faseVan, schrijfAudit } = basis;

  function zetFase(key, did, data, kring) {
    const d = docMet(did);
    if (!d) return { status: 404, error: 'Document niet gevonden.' };
    if (!magLezen(d, key, kring)) return { status: 403, error: 'Dit document is niet met u gedeeld.' };
    const naar = String((data && data.naar) || '');
    const van = faseVan(d);
    if (!FASES.includes(naar)) return { status: 400, error: 'Kies concept, beoordeling, goedgekeurd of archief.' };
    if (data && data.bron === 'ai') return { status: 403, error: 'AI kan een documentstatus niet wijzigen.' };
    if (naar === van) return { status: 200, ok: true, fase: van, gewijzigd: d.gewijzigd };

    const eigenaar = d.key === key;
    const schrijver = magSchrijven(d, key, kring);
    if (naar === 'beoordeling' && !schrijver)
      return { status: 403, error: 'Alleen een schrijver kan beoordeling vragen.' };
    if (naar === 'goedgekeurd') {
      if (!eigenaar) return { status: 403, error: 'Alleen de eigenaar keurt dit document goed.' };
      if (van !== 'beoordeling') return { status: 409, error: 'Vraag eerst beoordeling aan.' };
      if (!data || data.mens !== true) return { status: 409, error: 'Goedkeuren vraagt een menselijke bevestiging.' };
    }
    if (naar === 'archief') {
      if (!eigenaar) return { status: 403, error: 'Alleen de eigenaar archiveert dit document.' };
      if (!data || data.mens !== true) return { status: 409, error: 'Archiveren vraagt een menselijke bevestiging.' };
    }
    if (naar === 'concept' && van === 'archief' && !eigenaar)
      return { status: 403, error: 'Alleen de eigenaar haalt een document uit het archief.' };
    if (naar === 'concept' && !schrijver)
      return { status: 403, error: 'Alleen een schrijver kan dit document terugzetten naar concept.' };

    d.fase = naar;
    d.laatstDoor = naamVan(key);
    d.gewijzigd = nu();
    schrijfAudit(d, key, naar === 'beoordeling' ? 'beoordeling-gevraagd'
      : naar === 'goedgekeurd' ? 'goedgekeurd'
      : naar === 'archief' ? 'gearchiveerd' : 'concept-heropend', { van, naar });
    save();
    for (const mk of [...(d.gedeeldMet || []), ...(d.bewerkers || []), d.key]) {
      if (mk === key) continue;
      try { sseToCustomer(mk, 'office', { kind: 'status', id: d.id, titel: d.titel, van, naar }); } catch (e) {}
    }
    return { status: 200, ok: true, fase: naar, gewijzigd: d.gewijzigd,
      laatstDoor: d.laatstDoor, actie: (d.audit || [])[0] };
  }

  return { officeFase: zetFase };
};
