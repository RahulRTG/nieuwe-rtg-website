/* RTMAIL (deelmodule): het POSTVAK van een team.

   Afgesplitst van kern/rtmail-team.js toen die over de tien kilobyte ging, en
   op een echte naad: dat bestand gaat over het team als ORGANISATIE (oprichten,
   opheffen, wie er in zit), dit over de post die er ligt. De twee raken elkaar
   maar op een punt -- `teamMet` en `isLid` -- en dat is precies wat hier
   binnenkomt.

   DE REGEL DIE OVER BEIDE BESTANDEN HEEN GELDT: het adres is gedeeld, de hand
   niet. Wie vanuit het team schrijft staat er altijd bij, en daar is geen
   schakelaar voor. Een gedeeld adres zonder naam eronder wordt een masker. */
module.exports = ({ save, rtmail, team }) => {
  const { teamMet, isLid, publiek } = team;
  const nu = () => new Date().toISOString();

  /* Het postvak van een team, met per bericht wie het oppakte en of het af is.
     Alleen leden komen erin -- een gedeeld adres is niet een openbaar adres. */
  function postvak(sess, id, opties) {
    const team = teamMet(id);
    if (!team) return { error: 'Dit team bestaat niet.' };
    if (!isLid(team, sess.key)) return { error: 'Je zit niet in dit team.' };
    const o = opties || {};
    const codenaamVan = (k) => ((team.leden || []).find(l => l.key === k) || {}).codenaam || 'een teamlid';
    const berichten = (rtmail ? rtmail.postvak(team.adres, { limit: 200 }) : []).map(m => ({
      ...m,
      opgepakt: team.toegewezen[m.id] ? codenaamVan(team.toegewezen[m.id]) : null,
      doorMij: team.toegewezen[m.id] === sess.key,
      af: !!team.afgehandeld[m.id]
    })).filter(m => o.alles ? true : !m.af);
    return { ok: true, team: publiek(team, sess.key), berichten,
      open: berichten.filter(m => !m.af).length };
  }

  /* Oppakken: dan weet de rest dat jij het doet. Ongedaan maken kan altijd, en
     een ander kan iets dat al opgepakt is niet stilletjes overnemen. */
  function pak(sess, id, berichtId, aan) {
    const team = teamMet(id);
    if (!team) return { error: 'Dit team bestaat niet.' };
    if (!isLid(team, sess.key)) return { error: 'Je zit niet in dit team.' };
    const b = String(berichtId || '');
    if (!b) return { error: 'Welk bericht?' };
    const nuVan = team.toegewezen[b];
    if (aan === false) {
      if (nuVan && nuVan !== sess.key) return { error: 'Een ander heeft dit opgepakt; vraag het hem.' };
      delete team.toegewezen[b];
    } else {
      if (nuVan && nuVan !== sess.key) return { error: 'Dit is al opgepakt door een ander.' };
      team.toegewezen[b] = sess.key;
    }
    save();
    return { ok: true, opgepakt: !!team.toegewezen[b] };
  }

  function afhandel(sess, id, berichtId, aan) {
    const team = teamMet(id);
    if (!team) return { error: 'Dit team bestaat niet.' };
    if (!isLid(team, sess.key)) return { error: 'Je zit niet in dit team.' };
    const b = String(berichtId || '');
    if (!b) return { error: 'Welk bericht?' };
    if (aan === false) delete team.afgehandeld[b];
    else team.afgehandeld[b] = { door: sess.key, at: nu() };
    save();
    return { ok: true, af: !!team.afgehandeld[b] };
  }

  /* Vanuit het team schrijven. HET ADRES IS GEDEELD, DE HAND NIET: de codenaam
     van wie het schreef gaat mee in de tekst, en daar is geen schakelaar voor. */
  function stuur(sess, id, invoer) {
    const team = teamMet(id);
    if (!team) return { error: 'Dit team bestaat niet.' };
    if (!isLid(team, sess.key)) return { error: 'Je zit niet in dit team.' };
    const v = invoer || {};
    const tekst = String(v.tekst || '').trim();
    if (!tekst) return { error: 'Schrijf eerst iets.' };
    const wie = ((team.leden || []).find(l => l.key === sess.key) || {}).codenaam || 'een teamlid';
    /* ANTWOORDEN OP EEN BERICHT UIT HET TEAMPOSTVAK. Zonder dit begon elk
       teamantwoord een nieuwe draad, en dan loopt de klok van de oorspronkelijke
       vraag door terwijl er al lang geantwoord is (kern/rtmail-dossier.js leidt
       "beantwoord" af uit de draad). Wie een `antwoordOp` meegeeft die NIET in
       dit postvak ligt, krijgt hem niet: anders kon een teamlid een draad van
       een ander postvak binnentrekken. */
    let opId = null, naar = v.naar, onderwerp = v.onderwerp;
    if (v.antwoordOp) {
      const bron = rtmail.postvak(team.adres, { limit: 200 }).find(x => x.id === String(v.antwoordOp));
      if (!bron) return { error: 'Dat bericht ligt niet in het postvak van dit team.' };
      opId = bron.id;
      naar = naar || bron.van;
      onderwerp = onderwerp || (/^re:/i.test(bron.onderwerp) ? bron.onderwerp : 'Re: ' + bron.onderwerp);
    }
    const m = rtmail.stuur({
      van: team.adres, naar,
      onderwerp,
      tekst: tekst + '\n\n-- ' + wie + ', namens ' + team.naam,
      soort: 'team', bron: 'lid', antwoordOp: opId || undefined
    });
    if (m && m.error) return m;
    return { ok: true, bericht: m, namens: wie };
  }

  return { postvak, pak, afhandel, stuur };
};
