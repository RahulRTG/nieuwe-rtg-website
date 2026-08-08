/* RTMAIL (deelmodule): teams -- een postvak dat je samen leest.

   Een receptie, een keuken, een boekhouding zijn geen personen maar FUNCTIES.
   Post daaraan hoort niet in het postvak van wie er toevallig als eerste was.
   Een team is dus een eigen adres (receptie@partner.rtg) dat meerderen samen
   lezen. Elders is dit de betaalde helft -- een gedeelde inbox met toewijzing
   zit achter een zakelijk abonnement of een licentie per stoel; hier hoort het
   er gewoon bij.

   DE REGEL DIE DIT HUIS ERAAN TOEVOEGT: HET ADRES IS GEDEELD, DE HAND NIET.
   Wie vanuit het teamadres schrijft, staat er altijd bij -- niet als
   sierlijkheid, maar omdat een gedeeld adres anders een masker wordt. "De
   receptie zegt dat het geregeld is" is geen antwoord; "Gouden Panter namens de
   receptie" wel. Er is dus geen weg om anoniem vanuit een team te schrijven.

   Wat een gedeeld postvak pas bruikbaar maakt, en hier dus in zit: TOEWIJZEN
   (anders antwoorden twee mensen hetzelfde bericht, of niemand; oppakken kan
   altijd ongedaan) en AFHANDELEN (een team ziet wat open staat, geen eindeloze
   lijst). Wat er NIET in komt: een teller wie het meest afhandelt -- dezelfde
   ranglijst die Genootschap en De Salon al weigerden. */
const adresLaag = require('./rtmail-adres');

module.exports = ({ db, save, crypto, rtmail, findSupplier, CODENAMES }) => {
  const MAX_EIGEN = 10;       // teams die één iemand mag oprichten
  const MAX_TEAMS = 5000;     // bovengrens voor het hele huis
  const MAX_LEDEN = 100;
  const nu = () => new Date().toISOString();
  const rid = () => crypto.randomBytes(5).toString('hex');
  const schoon = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n || 80);

  // Of een linkerdeel al van iemand is (codenaam-vorm, zaakcode, of er ligt al
  // post) -- de toets staat apart in kern/rtmail-vrij.js, met de reden erbij.
  const vrij = require('./rtmail-vrij')({ rtmail, findSupplier, CODENAMES });

  function T() {
    if (!db.data.rtmailTeams || typeof db.data.rtmailTeams !== 'object') db.data.rtmailTeams = { teams: [] };
    const t = db.data.rtmailTeams;
    if (!Array.isArray(t.teams)) t.teams = [];
    return t;
  }

  const teamMet = (id) => T().teams.find(x => x.id === id) || null;
  /* Hetzelfde team, maar opgezocht op ADRES in plaats van op id. Staat hier
     omdat dit bestand de teams bewaart en `zelfdeBus` de regel is die bepaalt
     of twee schrijfwijzen hetzelfde postvak zijn; wie dat elders nabouwt, bouwt
     de tweede waarheid. Nodig voor de SMTP-ontvanger: die moet bij RCPT TO
     kunnen antwoorden of dit adres hier bestaat, en kent alleen het adres. */
  const teamOpAdres = (adres) => T().teams.find(x => adresLaag.zelfdeBus(x.adres, adres)) || null;
  const isLid = (team, key) => !!(team && (team.leden || []).some(l => l.key === key));
  const isEigenaar = (team, key) => !!(team && team.eigenaar === key);

  /* Een team oprichten. Het adres krijgt het domein van de OPRICHTER: een zaak
     maakt een team op partner.rtg, personeel op rahultravelgroup.rtg -- ook hier
     volgt het domein uit wie je bent, je kiest het niet. */
  function maak(sess, invoer) {
    const v = invoer || {};
    const naam = schoon(v.naam, 60);
    if (!naam) return { error: 'Hoe heet het team?' };
    const lokaal = adresLaag.lokaalVan(v.adres || naam);
    if (!lokaal) return { error: 'Dit adres kan niet.' };
    if (adresLaag.GERESERVEERD.includes(lokaal)) return { error: 'Deze naam houdt het huis zelf.' };

    const t = T();
    if (t.teams.length >= MAX_TEAMS) return { error: 'Er zijn te veel teams.' };
    if (t.teams.filter(x => x.eigenaar === sess.key).length >= MAX_EIGEN) {
      return { error: 'Je hebt al ' + MAX_EIGEN + ' teams; hef er eerst een op.' };
    }
    const adres = adresLaag.adresVoor(sess.soort, lokaal);
    if (t.teams.some(x => adresLaag.zelfdeBus(x.adres, adres))) return { error: 'Dit adres bestaat al.' };
    const inGebruik = vrij.bezet(lokaal, adres);
    if (inGebruik) return { error: inGebruik };

    const team = { id: rid(), naam, adres, soort: sess.soort, eigenaar: sess.key,
      leden: [{ key: sess.key, codenaam: sess.codenaam || '', sinds: nu() }],
      toegewezen: {}, afgehandeld: {}, at: nu() };
    t.teams.unshift(team);
    save();
    return { ok: true, team: publiek(team, sess.key) };
  }

  function hef(sess, id) {
    const t = T();
    const i = t.teams.findIndex(x => x.id === id);
    if (i < 0) return { error: 'Dit team bestaat niet.' };
    if (!isEigenaar(t.teams[i], sess.key)) return { error: 'Alleen de eigenaar heft een team op.' };
    t.teams.splice(i, 1);
    save();
    return { ok: true };
  }

  // Iemand erbij of eruit. Alleen de eigenaar; en de eigenaar kan er niet uit,
  // want een team zonder eigenaar is een postvak dat niemand meer kan opruimen.
  function lidZet(sess, id, wieKey, codenaam, erin) {
    const team = teamMet(id);
    if (!team) return { error: 'Dit team bestaat niet.' };
    if (!isEigenaar(team, sess.key)) return { error: 'Alleen de eigenaar beheert de leden.' };
    if (!wieKey) return { error: 'Dit lid ken ik niet.' };
    if (wieKey === team.eigenaar && !erin) return { error: 'De eigenaar kan er niet uit.' };
    const i = (team.leden || []).findIndex(l => l.key === wieKey);
    if (erin && i < 0) {
      if (team.leden.length >= MAX_LEDEN) return { error: 'Dit team is vol.' };
      team.leden.push({ key: wieKey, codenaam: schoon(codenaam, 60), sinds: nu() });
    }
    if (!erin && i >= 0) team.leden.splice(i, 1);
    save();
    return { ok: true, leden: team.leden.length };
  }

  /* Zelf weglopen: de tegenhanger van lidZet. De eigenaar zet je erin, maar
     niemand anders dan jij bepaalt of je erin blijft -- een gedeeld postvak
     lezen is werk, geen cadeau. */
  function verlaat(sess, id) {
    const team = teamMet(id);
    if (!team) return { error: 'Dit team bestaat niet.' };
    if (isEigenaar(team, sess.key)) return { error: 'Je bent de eigenaar; hef het team op of geef het door.' };
    const i = (team.leden || []).findIndex(l => l.key === sess.key);
    if (i < 0) return { error: 'Je zit niet in dit team.' };
    team.leden.splice(i, 1);
    save();
    return { ok: true };
  }

  const publiek = (team, key) => ({
    id: team.id, naam: team.naam, adres: team.adres, soort: team.soort,
    leden: (team.leden || []).map(l => ({ codenaam: l.codenaam || '', sinds: l.sinds, ikZelf: l.key === key })),
    aantalLeden: (team.leden || []).length,
    ikBenEigenaar: isEigenaar(team, key), at: team.at
  });

  const mijne = (key) => T().teams.filter(t => isLid(t, key));
  const mijn = (sess) => ({ ok: true, teams: mijne(sess.key).map(t => publiek(t, sess.key)) });

  return { maak, hef, lidZet, verlaat, mijn, teamMet, teamOpAdres, isLid, publiek };
};
