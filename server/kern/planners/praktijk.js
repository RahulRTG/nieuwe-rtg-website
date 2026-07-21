/* Professionele diensten: advocaat, notaris en fiscalist als boekbare
   partner met dossiers en een agenda per adviseur. De AI plant alleen en
   adviseert nooit inhoudelijk. Opslag in db.data.advies[code]. */

const { MAX_LIJST, TIJD, DATUM, maakHulp } = require('../genrehulp');

module.exports = ({ db, save, crypto, schoon }) => {
  const { nu, id, cap, bak } = maakHulp({ db, save, crypto });

  function demoPraktijk() {
    return {
      naam: 'LexNova Advocaten & Notarissen',
      adviseurs: [
        { id: 'a1', naam: 'Mr. Ilse Verbeek', vak: 'advocaat', uurtarief: 285 },
        { id: 'a2', naam: 'Mr. Joan Ferrer', vak: 'notaris', uurtarief: 240 },
        { id: 'a3', naam: 'Drs. Karim El Amrani', vak: 'fiscalist', uurtarief: 210 }
      ],
      dossiers: [], afspraken: [],
      regel: 'De AI plant alleen afspraken en dossiers; inhoudelijk advies komt altijd van de adviseur zelf.'
    };
  }
  const advVan = bak('advies', demoPraktijk);

  function advOverzicht(code) {
    const a = advVan(code);
    return {
      naam: a.naam, adviseurs: a.adviseurs, regel: a.regel,
      dossiers: a.dossiers.slice(0, 30), afspraken: a.afspraken.slice(0, 30),
      kpi: {
        dossiers: a.dossiers.length,
        lopend: a.dossiers.filter(d => d.status === 'lopend').length,
        afspraken: a.afspraken.length
      }
    };
  }
  function dossierMaak(code, b) {
    const a = advVan(code);
    const klant = schoon(b.klant, 60), omschrijving = schoon(b.omschrijving, 160);
    const vak = ['advocaat', 'notaris', 'fiscalist'].includes(b.vak) ? b.vak : null;
    if (!klant || !omschrijving) return { status: 400, error: 'Voor wie is het dossier, en waar gaat het over?' };
    if (!vak) return { status: 400, error: 'Kies advocaat, notaris of fiscalist.' };
    const d = { id: 'D-' + crypto.randomBytes(2).toString('hex').toUpperCase(), klant, vak, omschrijving, status: 'intake', gemaakt: nu() };
    a.dossiers.unshift(d); cap(a.dossiers, MAX_LIJST); save();
    return { ok: true, dossier: d };
  }
  function dossierStatus(code, dId, statusWens) {
    const a = advVan(code);
    const d = a.dossiers.find(x => x.id === String(dId || ''));
    if (!d) return { status: 404, error: 'Dossier niet gevonden.' };
    if (!['lopend', 'afgerond'].includes(statusWens)) return { status: 400, error: 'Kies lopend of afgerond.' };
    d.status = statusWens; save();
    return { ok: true, dossier: d };
  }
  function afspraakBoek(code, b) {
    const a = advVan(code);
    const adviseur = a.adviseurs.find(x => x.id === String(b.adviseurId || ''));
    if (!adviseur) return { status: 404, error: 'Deze adviseur werkt hier niet.' };
    const dossier = a.dossiers.find(x => x.id === String(b.dossierId || ''));
    if (!dossier) return { status: 404, error: 'Koppel de afspraak aan een dossier.' };
    const datum = String(b.datum || '').slice(0, 10), tijd = String(b.tijd || '');
    if (!DATUM.test(datum) || !TIJD.test(tijd)) return { status: 400, error: 'Kies een datum en tijd.' };
    const bezet = a.afspraken.find(x => x.adviseurId === adviseur.id && x.datum === datum && x.tijd === tijd);
    if (bezet) return { status: 409, error: adviseur.naam + ' zit dan al met een client.' };
    const f = { id: id('f'), adviseurId: adviseur.id, adviseur: adviseur.naam, vak: adviseur.vak,
      dossier: dossier.id, klant: dossier.klant, datum, tijd, uurtarief: adviseur.uurtarief, gemaakt: nu() };
    a.afspraken.unshift(f); cap(a.afspraken, MAX_LIJST); save();
    if (dossier.status === 'intake') dossier.status = 'lopend';
    save();
    return { ok: true, afspraak: f };
  }

  return { advies: { overzicht: advOverzicht, dossierMaak, dossierStatus, afspraakBoek } };
};
