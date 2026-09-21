/* Alleen de maker wijzigt de gezinsdeling; classificatie begrenst ieder nieuw recht. */
module.exports = ({ save }, { docMet, nu, naamVan, schrijfAudit }) => {
  /* ---- delen met de eigen kring (het RTF-gezin): uit, meelezen of samen schrijven ---- */
  function kringDeel(key, did, stand) {
    const d = docMet(did);
    if (!d) return { status: 404, error: 'Document niet gevonden.' };
    if (d.key !== key) return { status: 403, error: 'Alleen de maker deelt met het gezin.' };
    if (!d.kring) return { status: 400, error: 'Dit document hoort niet bij een gezin.' };
    if (![null, '', 'uit', 'lezen', 'bewerken'].includes(stand)) return { status: 400, error: 'Kies uit, lezen of bewerken.' };
    if ((stand === 'lezen' || stand === 'bewerken') && d.beheer && d.beheer.classificatie === 'strikt')
      return { status: 409, error: 'Een strikt document kan niet worden gedeeld. Pas eerst de classificatie aan.' };
    d.kringDeel = (stand === 'lezen' || stand === 'bewerken') ? stand : null;
    d.gewijzigd = nu();
    d.laatstDoor = naamVan(key);
    schrijfAudit(d, key, d.kringDeel ? 'gedeeld' : 'deling-ingetrokken',
      { rechten: d.kringDeel || 'uit', met: 'gezin' });
    save();
    return { status: 200, ok: true, kringDeel: d.kringDeel, gewijzigd: d.gewijzigd };
  }

  return kringDeel;
};
