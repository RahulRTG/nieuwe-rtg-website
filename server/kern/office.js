/* Kern-module "office": RTG Office, het eigen kantoorpakket. Leden maken
   documenten (een tekstdocument of een rekenblad), bewaren ze op hun account
   (dus op elk toestel terug), en kunnen ze alleen-lezen delen op codenaam.
   De inhoud staat als eenvoudige JSON in de accountdata; RTG rekent en toont,
   maar bewaart geen zwaar bestandsformaat. Bewust klein en privacyvast:
   delen gaat op codenaam, nooit op echte naam.

   maakOffice(state) volgt het vaste kern-patroon. */

const SOORTEN = ['tekst', 'blad'];
const MAX_DOCS = 200;            // per lid
const MAX_BYTES = 500000;        // per document (ruime kantoortekst of een blad)
const MAX_TITEL = 120;

function maakOffice({ db, save, crypto, schoon, codenaamVan, keyVanCodenaam, sseToCustomer }) {
  const id = () => 'doc' + crypto.randomBytes(6).toString('hex');
  const nu = () => new Date().toISOString();

  function lijsten() {
    if (!db.data.officeDocs || typeof db.data.officeDocs !== 'object') db.data.officeDocs = {};
    return db.data.officeDocs;
  }
  const docMet = did => Object.values(lijsten()).find(d => d.id === String(did || '')) || null;
  // de grootte van de inhoud (JSON), zodat een document niet ongelimiteerd groeit
  const grootteVan = inhoud => { try { return Buffer.byteLength(JSON.stringify(inhoud || null)); } catch (e) { return Infinity; } }

  /* ---- de mappenlijst van een lid: eigen documenten + wat met mij is gedeeld ---- */
  function mijn(key) {
    const alle = lijsten();
    const eigen = Object.values(alle).filter(d => d.key === key)
      .sort((a, b) => String(b.gewijzigd).localeCompare(String(a.gewijzigd)));
    const gedeeld = Object.values(alle).filter(d => d.key !== key && (d.gedeeldMet || []).includes(key))
      .sort((a, b) => String(b.gewijzigd).localeCompare(String(a.gewijzigd)));
    const kop = d => ({ id: d.id, soort: d.soort, titel: d.titel, gewijzigd: d.gewijzigd,
      door: codenaamVan(d.key), gedeeld: (d.gedeeldMet || []).length });
    return { status: 200, docs: eigen.map(kop), gedeeld: gedeeld.map(kop), max: MAX_DOCS };
  }

  /* ---- een nieuw document ---- */
  function maak(key, data) {
    const alle = lijsten();
    const soort = SOORTEN.includes(data.soort) ? data.soort : 'tekst';
    if (Object.values(alle).filter(d => d.key === key).length >= MAX_DOCS)
      return { status: 409, error: 'U heeft het maximum van ' + MAX_DOCS + ' documenten; verwijder er eerst een.' };
    const titel = schoon(data.titel, MAX_TITEL) || (soort === 'blad' ? 'Nieuw rekenblad' : 'Nieuw document');
    const leeg = soort === 'blad' ? { cellen: {}, rijen: 20, kolommen: 8 } : { tekst: '' };
    const d = { id: id(), key, soort, titel, inhoud: leeg, gedeeldMet: [], gemaakt: nu(), gewijzigd: nu() };
    alle[d.id] = d;
    save();
    return { status: 200, ok: true, id: d.id, soort, titel };
  }

  /* ---- een document openen (eigenaar of iemand met wie het is gedeeld) ---- */
  function open(key, did) {
    const d = docMet(did);
    if (!d) return { status: 404, error: 'Document niet gevonden.' };
    const ikEigenaar = d.key === key;
    if (!ikEigenaar && !(d.gedeeldMet || []).includes(key)) return { status: 403, error: 'Dit document is niet met u gedeeld.' };
    return { status: 200, id: d.id, soort: d.soort, titel: d.titel, inhoud: d.inhoud,
      magBewerken: ikEigenaar, door: codenaamVan(d.key), gewijzigd: d.gewijzigd,
      gedeeldMet: ikEigenaar ? (d.gedeeldMet || []).map(codenaamVan) : undefined };
  }

  /* ---- bewaren (autosave): alleen de eigenaar; delers lezen mee ---- */
  function bewaar(key, did, data) {
    const d = docMet(did);
    if (!d) return { status: 404, error: 'Document niet gevonden.' };
    if (d.key !== key) return { status: 403, error: 'Alleen de eigenaar kan dit document bewerken.' };
    if (typeof data.titel === 'string') d.titel = schoon(data.titel, MAX_TITEL) || d.titel;
    if (data.inhoud && typeof data.inhoud === 'object') {
      const schoon2 = schoonInhoud(d.soort, data.inhoud);
      if (grootteVan(schoon2) > MAX_BYTES) return { status: 413, error: 'Dit document is te groot; kort het in.' };
      d.inhoud = schoon2;
    }
    d.gewijzigd = nu();
    save();
    // wie meeleest krijgt een seintje dat er iets veranderd is
    for (const mk of d.gedeeldMet || []) { try { sseToCustomer(mk, 'office', { kind: 'gewijzigd', id: d.id }); } catch (e) {} }
    return { status: 200, ok: true, gewijzigd: d.gewijzigd };
  }
  // de inhoud netjes begrenzen per soort (geen vreemde velden, geen enorme cellen)
  function schoonInhoud(soort, inhoud) {
    if (soort === 'blad') {
      const cellen = {};
      const bron = (inhoud.cellen && typeof inhoud.cellen === 'object') ? inhoud.cellen : {};
      let n = 0;
      for (const [ref, waarde] of Object.entries(bron)) {
        if (!/^[A-Z]{1,2}[0-9]{1,3}$/.test(ref) || n++ > 4000) continue;
        cellen[ref] = String(waarde == null ? '' : waarde).slice(0, 400);
      }
      const rijen = Math.min(200, Math.max(1, parseInt(inhoud.rijen, 10) || 20));
      const kolommen = Math.min(26, Math.max(1, parseInt(inhoud.kolommen, 10) || 8));
      return { cellen, rijen, kolommen };
    }
    return { tekst: String(inhoud.tekst || '').slice(0, MAX_BYTES) };
  }

  /* ---- delen (alleen-lezen) op codenaam, en het delen weer intrekken ---- */
  async function deel(key, did, codenaam, aan) {
    const d = docMet(did);
    if (!d) return { status: 404, error: 'Document niet gevonden.' };
    if (d.key !== key) return { status: 403, error: 'Alleen de eigenaar kan delen.' };
    let doelKey = null;
    try { const t = keyVanCodenaam ? await keyVanCodenaam(String(codenaam || '').trim()) : null; doelKey = t && t.key; } catch (e) {}
    if (!doelKey) return { status: 404, error: 'Geen lid gevonden met die codenaam.' };
    if (doelKey === key) return { status: 400, error: 'Uzelf toevoegen hoeft niet.' };
    d.gedeeldMet = (d.gedeeldMet || []).filter(k => k !== doelKey);
    if (aan !== false) {
      if (d.gedeeldMet.length >= 100) return { status: 409, error: 'Dit document is al met veel mensen gedeeld.' };
      d.gedeeldMet.push(doelKey);
      try { sseToCustomer(doelKey, 'office', { kind: 'gedeeld', id: d.id, titel: d.titel, door: codenaamVan(key) }); } catch (e) {}
    }
    d.gewijzigd = nu();
    save();
    return { status: 200, ok: true, gedeeldMet: d.gedeeldMet.map(codenaamVan) };
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

  return { officeMijn: mijn, officeMaak: maak, officeOpen: open, officeBewaar: bewaar,
    officeDeel: deel, officeWeg: weg };
}

module.exports = { maakOffice };
