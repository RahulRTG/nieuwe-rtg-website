/* RTG Office, de documenten zelf: de mappenlijst, nieuw (leeg of vanuit
   een sjabloon), openen met rechten, bewaren met versiegeschiedenis en
   verwijderen door de eigenaar. */

const { SOORTEN, MAX_DOCS, MAX_BYTES, MAX_TITEL, MAX_VERSIES, SJABLONEN } = require('./basis');

module.exports = ({ save, schoon, sseToCustomer }, basis) => {
  const { id, nu, lijsten, docMet, grootteVan, naamVan, magSchrijven, magLezen, schoonInhoud } = basis;

  /* ---- de mappenlijst: eigen documenten + wat met mij is gedeeld ---- */
  function mijn(key, kring) {
    const alle = lijsten();
    const eigen = Object.values(alle).filter(d => d.key === key)
      .sort((a, b) => String(b.gewijzigd).localeCompare(String(a.gewijzigd)));
    const gedeeld = Object.values(alle).filter(d => d.key !== key && magLezen(d, key, kring))
      .sort((a, b) => String(b.gewijzigd).localeCompare(String(a.gewijzigd)));
    const kop = d => ({ id: d.id, soort: d.soort, titel: d.titel, gewijzigd: d.gewijzigd,
      door: naamVan(d.key), gedeeld: (d.gedeeldMet || []).length + (d.bewerkers || []).length });
    return { status: 200, docs: eigen.map(kop), gedeeld: gedeeld.map(kop), max: MAX_DOCS,
      sjablonen: Object.entries(SJABLONEN).map(([k, s]) => ({ id: k, soort: s.soort, titel: s.titel })) };
  }

  /* ---- een nieuw document (leeg of vanuit een sjabloon) ---- */
  function maak(key, data, kring) {
    const alle = lijsten();
    const sjab = SJABLONEN[data.sjabloon] || null;
    const soort = sjab ? sjab.soort : (SOORTEN.includes(data.soort) ? data.soort : 'tekst');
    if (Object.values(alle).filter(d => d.key === key).length >= MAX_DOCS)
      return { status: 409, error: 'U heeft het maximum van ' + MAX_DOCS + ' documenten; verwijder er eerst een.' };
    const titel = schoon(data.titel, MAX_TITEL) || (sjab ? sjab.titel
      : soort === 'blad' ? 'Nieuw rekenblad' : soort === 'presentatie' ? 'Nieuwe presentatie' : 'Nieuw document');
    const leeg = soort === 'blad' ? { cellen: {}, rijen: 20, kolommen: 8 }
      : soort === 'presentatie' ? { dias: [{ titel: 'Titelblad', tekst: '' }] }
      : { tekst: '' };
    const inhoud = sjab ? schoonInhoud(soort, JSON.parse(JSON.stringify(sjab.inhoud))) : leeg;
    const d = { id: id(), key, soort, titel, inhoud, gedeeldMet: [], bewerkers: [], versies: [], gemaakt: nu(), gewijzigd: nu() };
    if (kring) { d.kring = kring; d.kringDeel = null; }
    alle[d.id] = d;
    save();
    return { status: 200, ok: true, id: d.id, soort, titel };
  }

  /* ---- een document openen (eigenaar, meeschrijver of meelezer) ---- */
  function open(key, did, kring) {
    const d = docMet(did);
    if (!d) return { status: 404, error: 'Document niet gevonden.' };
    if (!magLezen(d, key, kring)) return { status: 403, error: 'Dit document is niet met u gedeeld.' };
    const ikEigenaar = d.key === key;
    return { status: 200, id: d.id, soort: d.soort, titel: d.titel, inhoud: d.inhoud,
      magBewerken: magSchrijven(d, key, kring), eigenaar: ikEigenaar, door: naamVan(d.key), gewijzigd: d.gewijzigd,
      versies: (d.versies || []).length, kringDeel: d.kring ? (d.kringDeel || null) : undefined,
      gedeeldMet: ikEigenaar ? (d.gedeeldMet || []).map(naamVan) : undefined,
      bewerkers: ikEigenaar ? (d.bewerkers || []).map(naamVan) : undefined };
  }

  /* ---- bewaren (autosave): eigenaar of meeschrijver; met versiegeschiedenis ---- */
  function bewaar(key, did, data, kring) {
    const d = docMet(did);
    if (!d) return { status: 404, error: 'Document niet gevonden.' };
    if (!magSchrijven(d, key, kring)) return { status: 403, error: 'U heeft geen schrijfrechten op dit document.' };
    if (typeof data.titel === 'string' && d.key === key) d.titel = schoon(data.titel, MAX_TITEL) || d.titel;
    if (data.inhoud && typeof data.inhoud === 'object') {
      const schoon2 = schoonInhoud(d.soort, data.inhoud);
      if (grootteVan(schoon2) > MAX_BYTES) return { status: 413, error: 'Dit document is te groot; kort het in.' };
      // elke echte wijziging bewaart de vorige stand; de cap houdt het klein
      if (!d.versies) d.versies = [];
      if (JSON.stringify(schoon2) !== JSON.stringify(d.inhoud)) {
        d.versies.unshift({ om: d.gewijzigd, door: naamVan(key), inhoud: d.inhoud });
        if (d.versies.length > MAX_VERSIES) d.versies.length = MAX_VERSIES;
      }
      d.inhoud = schoon2;
    }
    d.gewijzigd = nu();
    save();
    // wie meeleest of meeschrijft krijgt een seintje dat er iets veranderd is
    for (const mk of [...(d.gedeeldMet || []), ...(d.bewerkers || []), d.key]) {
      if (mk === key) continue;
      try { sseToCustomer(mk, 'office', { kind: 'gewijzigd', id: d.id }); } catch (e) {}
    }
    return { status: 200, ok: true, gewijzigd: d.gewijzigd };
  }

  /* ---- verwijderen (alleen de eigenaar) ---- */
  function weg(key, did) {
    const d = docMet(did);
    if (!d) return { status: 404, error: 'Document niet gevonden.' };
    if (d.key !== key) return { status: 403, error: 'Alleen de eigenaar kan verwijderen.' };
    delete lijsten()[d.id];
    save();
    return { status: 200, ok: true };
  }

  return { officeMijn: mijn, officeMaak: maak, officeOpen: open, officeBewaar: bewaar, officeWeg: weg };
};
