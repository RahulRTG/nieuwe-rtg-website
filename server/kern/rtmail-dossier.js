/* RTMAIL (deelmodule): het dossier op een bericht in een GEDEELD postvak.

   kern/rtmail-team.js kon al twee dingen die een gedeelde inbox bruikbaar
   maken: oppakken (dan weet de rest dat jij het doet) en afhandelen. Wat een
   receptie of een support-postvak daarnaast nodig heeft, staat hier: een
   status, een prioriteit, interne notities, een klok met een afspraak, en de
   koppeling aan een klant of ticket.

   VIER KEUZES DIE HIER VASTLIGGEN:

   1. WIE AL GEANTWOORD HEEFT WORDT NIET OPGESLAGEN MAAR AFGELEID. Het staat al
      in de post: elk bericht in dezelfde draad dat VAN het teamadres komt, is
      een antwoord. Een tweede administratie ernaast zou vroeg of laat iets
      anders beweren dan de post zelf, en dan gelooft niemand meer een van
      beide.
   2. DE KLOK STOPT BIJ EEN MENS, niet bij een automatisch bericht. Dezelfde
      regel als bij de tickets in het Werk OS (server/bedrijf/service.js): een
      ontvangstbevestiging is geen antwoord, en een SLA die daarop stopt meet
      hoe snel de robot is.
   3. EEN INTERNE NOTITIE IS INTERN. Hij gaat nooit mee in een antwoord, staat
      nooit in de tekst van een bericht, en draagt altijd wie hem schreef --
      een anonieme notitie in een gedeeld postvak is een beschuldiging zonder
      afzender.
   4. ALLEEN TEAMLEDEN. Elke functie hier vraagt het team op via
      kern/rtmail-team.js en weigert wie er niet in zit. Het dossier is niet
      openbaarder dan het postvak waar het bij hoort. */
const adresLaag = require('./rtmail-adres');

const STATUSSEN = ['nieuw', 'in behandeling', 'wacht op klant', 'afgehandeld'];
const PRIORITEITEN = ['laag', 'normaal', 'hoog', 'urgent'];
const MAX_NOTITIES = 50;

module.exports = ({ db, save, crypto, rtmail, team, sla }) => {
  /* De klok en de norm komen uit kern/rtmail-sla.js. Ze staan daar samen met de
     ontvangstbevestiging, omdat die twee EEN onderwerp zijn: zonder een
     automatisch antwoord in de draad kon de regel "de klok stopt bij een mens"
     nooit misgaan, en dus ook nooit worden getoetst. */
  const { klok, antwoorden, NORM_MINUTEN } = sla;
  const nu = () => new Date().toISOString();
  const kap = (s, n) => String(s == null ? '' : s).replace(/[<>]/g, '').trim().slice(0, n);

  const store = () => {
    if (!db.data.rtmail || !Array.isArray(db.data.rtmail.berichten)) db.data.rtmail = { berichten: [] };
    return db.data.rtmail;
  };

  /* Het team EN het bericht, of een fout met de reden. Deze functie is de
     poort: geen enkele andere functie hier praat met de opslag zonder eerst
     hierlangs te zijn geweest. */
  function poort(sess, teamId, berichtId) {
    const t = team.teamMet(teamId);
    if (!t) return { error: 'Dit team bestaat niet.' };
    if (!team.isLid(t, sess.key)) return { error: 'Je zit niet in dit team.' };
    const m = store().berichten.find(x => x.id === berichtId);
    if (!m) return { error: 'Dit bericht bestaat niet.' };
    if (!adresLaag.zelfdeBus(m.naar, t.adres)) return { error: 'Dit bericht ligt niet in het postvak van dit team.' };
    if (!t.dossiers || typeof t.dossiers !== 'object') t.dossiers = {};
    if (!t.dossiers[m.id]) t.dossiers[m.id] = { status: 'nieuw', prioriteit: 'normaal', notities: [], klantId: null, ticketId: null };
    return { t, m, d: t.dossiers[m.id] };
  }

  const wieBen = (t, key) => ((t.leden || []).find(l => l.key === key) || {}).codenaam || 'een teamlid';

  function dossier(sess, teamId, berichtId) {
    const p = poort(sess, teamId, berichtId);
    if (p.error) return p;
    return { ok: true, berichtId: p.m.id, dossier: publiek(p.t, p.m, p.d), klok: klok(p.t, p.m, p.d) };
  }
  const publiek = (t, m, d) => ({
    status: d.status, prioriteit: d.prioriteit,
    klantId: d.klantId || null, ticketId: d.ticketId || null,
    notities: (d.notities || []).map(n => ({ door: n.door, tekst: n.tekst, at: n.at })),
    opgepakt: t.toegewezen && t.toegewezen[m.id] ? wieBen(t, t.toegewezen[m.id]) : null,
    af: !!(t.afgehandeld && t.afgehandeld[m.id]),
    antwoorden: antwoorden(t, m)
  });

  function zetStatus(sess, teamId, berichtId, status) {
    const p = poort(sess, teamId, berichtId);
    if (p.error) return p;
    if (!STATUSSEN.includes(status)) return { error: 'Kies een status: ' + STATUSSEN.join(', ') + '.' };
    p.d.status = status;
    /* "afgehandeld" is dezelfde waarheid als de afgehandeld-lijst van het team;
       die twee mogen niet uiteenlopen, dus zetten we ze samen. */
    if (!p.t.afgehandeld) p.t.afgehandeld = {};
    if (status === 'afgehandeld') p.t.afgehandeld[p.m.id] = { door: sess.key, at: nu() };
    else delete p.t.afgehandeld[p.m.id];
    save();
    return { ok: true, status, dossier: publiek(p.t, p.m, p.d) };
  }

  function zetPrioriteit(sess, teamId, berichtId, prioriteit) {
    const p = poort(sess, teamId, berichtId);
    if (p.error) return p;
    if (!PRIORITEITEN.includes(prioriteit)) return { error: 'Kies een prioriteit: ' + PRIORITEITEN.join(', ') + '.' };
    p.d.prioriteit = prioriteit;
    save();
    return { ok: true, prioriteit, klok: klok(p.t, p.m, p.d) };
  }

  function notitie(sess, teamId, berichtId, tekst) {
    const p = poort(sess, teamId, berichtId);
    if (p.error) return p;
    const t = kap(tekst, 1000);
    if (!t) return { error: 'Wat wilt u erbij noteren?' };
    if ((p.d.notities || []).length >= MAX_NOTITIES) return { error: 'Er staan al ' + MAX_NOTITIES + ' notities bij dit bericht.' };
    p.d.notities.push({ id: crypto.randomBytes(4).toString('hex'), door: wieBen(p.t, sess.key), tekst: t, at: nu() });
    save();
    return { ok: true, notities: p.d.notities.length,
      let: 'Deze notitie is intern. Hij gaat nooit mee in een antwoord aan de afzender.' };
  }

  /* Koppelen aan een klant of ticket uit het Werk OS. Hier wordt alleen de
     VERWIJZING bewaard -- de klantgegevens blijven staan waar ze horen. */
  function koppel(sess, teamId, berichtId, { klantId, ticketId } = {}) {
    const p = poort(sess, teamId, berichtId);
    if (p.error) return p;
    if (klantId !== undefined) p.d.klantId = kap(klantId, 20) || null;
    if (ticketId !== undefined) p.d.ticketId = kap(ticketId, 20) || null;
    save();
    return { ok: true, klantId: p.d.klantId, ticketId: p.d.ticketId,
      let: 'Dit is een verwijzing; de klantgegevens blijven in het Werk OS staan.' };
  }

  /* Het postvak van een team MET de dossiers erbij -- dat is de lijst waar een
     supportmedewerker naar kijkt: wie doet wat, wat staat er open, en waar
     loopt de klok uit de pas. */
  function overzicht(sess, teamId) {
    const t = team.teamMet(teamId);
    if (!t) return { error: 'Dit team bestaat niet.' };
    if (!team.isLid(t, sess.key)) return { error: 'Je zit niet in dit team.' };
    const rijen = rtmail.postvak(t.adres, { limit: 200 }).map(m => {
      const d = (t.dossiers || {})[m.id] || { status: 'nieuw', prioriteit: 'normaal', notities: [] };
      return { id: m.id, van: m.van, onderwerp: m.onderwerp, at: m.at, vertrouwd: m.vertrouwd,
        status: d.status, prioriteit: d.prioriteit, notities: (d.notities || []).length,
        klantId: d.klantId || null, ticketId: d.ticketId || null,
        opgepakt: t.toegewezen && t.toegewezen[m.id] ? wieBen(t, t.toegewezen[m.id]) : null,
        klok: klok(t, m, d) };
    });
    return { ok: true, team: { id: t.id, naam: t.naam, adres: t.adres }, berichten: rijen,
      open: rijen.filter(r => r.status !== 'afgehandeld').length,
      buitenNorm: rijen.filter(r => r.klok.overschreden && !r.klok.beantwoord).length,
      statussen: STATUSSEN, prioriteiten: PRIORITEITEN, normen: NORM_MINUTEN };
  }

  return { STATUSSEN, PRIORITEITEN, NORM_MINUTEN, dossier, zetStatus, zetPrioriteit,
    notitie, koppel, overzicht };
};
