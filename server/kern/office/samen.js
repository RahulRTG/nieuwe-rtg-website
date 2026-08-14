/* RTG Office, enterprise-samenwerking rond ieder document.

   De inhoud blijft in de bestaande editors. Deze laag bewaart alleen wat een
   organisatie eromheen nodig heeft: opmerkingen en acties, classificatie,
   bewaartermijn, herzieningsdatum en kortlevende aanwezigheid. Aanwezigheid
   staat bewust niet in de database en verdwijnt vanzelf; een auditlog is geen
   personeelsvolgsysteem. */
'use strict';

const CLASSIFICATIES = ['intern', 'vertrouwelijk', 'strikt'];
const BEWAARTERMIJNEN = ['geen', '1jaar', '3jaar', '7jaar', 'permanent'];
const MAX_OPMERKINGEN = 200;
const MAX_TAGS = 8;

module.exports = ({ save, schoon, sseToCustomer }, basis) => {
  const { id, nu, docMet, naamVan, magSchrijven, magLezen, schrijfAudit } = basis;
  const aanwezig = new Map();

  const datum = waarde => /^\d{4}-\d{2}-\d{2}$/.test(String(waarde || '')) ? String(waarde) : '';
  const beheerVan = d => {
    const b = d.beheer && typeof d.beheer === 'object' ? d.beheer : {};
    return {
      classificatie: CLASSIFICATIES.includes(b.classificatie) ? b.classificatie : 'intern',
      bewaartermijn: BEWAARTERMIJNEN.includes(b.bewaartermijn) ? b.bewaartermijn : '7jaar',
      herzienOp: datum(b.herzienOp),
      tags: (Array.isArray(b.tags) ? b.tags : []).slice(0, MAX_TAGS)
        .map(x => schoon(String(x || '').trim(), 28)).filter(Boolean)
    };
  };
  const reactiesVan = d => Array.isArray(d.opmerkingen) ? d.opmerkingen : [];
  const publiek = o => ({ id: o.id, door: o.door, tekst: o.tekst, anker: o.anker || '',
    actiehouder: o.actiehouder || '', voor: o.voor || '', gemaakt: o.gemaakt,
    opgelost: !!o.opgelost, opgelostDoor: o.opgelostDoor || '', opgelostOm: o.opgelostOm || '' });
  const deelnemers = d => [...new Set([d.key, ...(d.gedeeldMet || []), ...(d.bewerkers || [])])];
  const meld = (d, key, kind, extra) => {
    for (const mk of deelnemers(d)) {
      if (mk === key) continue;
      try { sseToCustomer(mk, 'office', Object.assign({ kind, id: d.id, titel: d.titel }, extra || {})); } catch (e) {}
    }
  };

  function stand(key, did, kring) {
    const d = docMet(did);
    if (!d) return { status: 404, error: 'Document niet gevonden.' };
    if (!magLezen(d, key, kring)) return { status: 403, error: 'Dit document is niet met u gedeeld.' };
    const grens = Date.now() - 45000;
    const hier = aanwezig.get(d.id) || new Map();
    for (const [client, p] of hier) if (p.om < grens) hier.delete(client);
    if (!hier.size) aanwezig.delete(d.id);
    return { status: 200, beheer: beheerVan(d), eigenaar: d.key === key,
      opmerkingen: reactiesVan(d).slice().reverse().map(o => Object.assign(publiek(o),
        { magBeheren: d.key === key || o.key === key || magSchrijven(d, key, kring) })),
      openActies: reactiesVan(d).filter(o => !o.opgelost).length,
      aanwezig: [...hier.values()].sort((a, b) => b.om - a.om)
        .map(p => ({ naam: p.naam, stand: p.stand, sinds: new Date(p.om).toISOString() })) };
  }

  function hartslag(key, did, data, kring) {
    const d = docMet(did);
    if (!d) return { status: 404, error: 'Document niet gevonden.' };
    if (!magLezen(d, key, kring)) return { status: 403, error: 'Dit document is niet met u gedeeld.' };
    const client = schoon(data && data.client, 64);
    if (!client) return { status: 400, error: 'Dit venster heeft geen geldige sessiesleutel.' };
    const standen = ['bekijkt', 'bewerkt', 'typt', 'presenteert'];
    const standNu = standen.includes(data && data.stand) ? data.stand : 'bekijkt';
    let hier = aanwezig.get(d.id);
    if (!hier) { hier = new Map(); aanwezig.set(d.id, hier); }
    hier.set(client, { naam: naamVan(key), stand: standNu, om: Date.now() });
    return stand(key, did, kring);
  }

  function opmerking(key, did, data, kring) {
    const d = docMet(did);
    if (!d) return { status: 404, error: 'Document niet gevonden.' };
    if (!magLezen(d, key, kring)) return { status: 403, error: 'Dit document is niet met u gedeeld.' };
    if (!d.opmerkingen) d.opmerkingen = [];
    const actie = String((data && data.actie) || 'nieuw');
    if (actie === 'nieuw') {
      const tekst = schoon(data && data.tekst, 1000);
      if (!tekst) return { status: 400, error: 'Schrijf eerst een opmerking.' };
      if (d.opmerkingen.length >= MAX_OPMERKINGEN)
        return { status: 409, error: 'Dit document heeft het maximum aantal opmerkingen. Los eerst oude punten op.' };
      const o = { id: id().replace(/^doc/, 'opm'), key, door: naamVan(key), tekst,
        anker: schoon(data && data.anker, 100), actiehouder: schoon(data && data.actiehouder, 60),
        voor: datum(data && data.voor), gemaakt: nu(), opgelost: false };
      d.opmerkingen.push(o);
      schrijfAudit(d, key, 'opmerking-toegevoegd', { opmerking: o.id, anker: o.anker || undefined });
      save(); meld(d, key, 'opmerking', { door: o.door, anker: o.anker });
      return { status: 200, ok: true, opmerking: publiek(o), openActies: d.opmerkingen.filter(x => !x.opgelost).length };
    }
    const o = d.opmerkingen.find(x => x.id === String(data && data.opmerking || ''));
    if (!o) return { status: 404, error: 'Deze opmerking bestaat niet.' };
    const bevoegd = d.key === key || o.key === key || magSchrijven(d, key, kring);
    if (!bevoegd) return { status: 403, error: 'Alleen de schrijver, eigenaar of een bewerker kan dit punt beheren.' };
    if (actie === 'verwijder') {
      d.opmerkingen = d.opmerkingen.filter(x => x.id !== o.id);
      schrijfAudit(d, key, 'opmerking-verwijderd', { opmerking: o.id });
    } else if (actie === 'oplos' || actie === 'heropen') {
      o.opgelost = actie === 'oplos';
      o.opgelostDoor = o.opgelost ? naamVan(key) : '';
      o.opgelostOm = o.opgelost ? nu() : '';
      schrijfAudit(d, key, o.opgelost ? 'opmerking-opgelost' : 'opmerking-heropend', { opmerking: o.id });
    } else return { status: 400, error: 'Kies nieuw, oplos, heropen of verwijder.' };
    save(); meld(d, key, 'opmerking-status', { opmerking: o.id, opgelost: !!o.opgelost });
    return { status: 200, ok: true, openActies: d.opmerkingen.filter(x => !x.opgelost).length };
  }

  function beheer(key, did, data) {
    const d = docMet(did);
    if (!d) return { status: 404, error: 'Document niet gevonden.' };
    if (d.key !== key) return { status: 403, error: 'Alleen de eigenaar beheert classificatie en bewaartermijn.' };
    const huidig = beheerVan(d);
    const classificatie = CLASSIFICATIES.includes(data && data.classificatie) ? data.classificatie : huidig.classificatie;
    if (classificatie === 'strikt' && ((d.gedeeldMet || []).length || (d.bewerkers || []).length))
      return { status: 409, error: 'Trek bestaande delingen eerst in voordat u dit document als strikt classificeert.' };
    const heeftTags = !!(data && Object.prototype.hasOwnProperty.call(data, 'tags'));
    const tags = !heeftTags ? huidig.tags
      : Array.isArray(data.tags) ? data.tags : String(data.tags || '').split(',');
    d.beheer = { classificatie,
      bewaartermijn: BEWAARTERMIJNEN.includes(data && data.bewaartermijn) ? data.bewaartermijn : huidig.bewaartermijn,
      herzienOp: data && Object.prototype.hasOwnProperty.call(data, 'herzienOp') ? datum(data.herzienOp) : huidig.herzienOp,
      tags: [...new Set(tags.map(x => schoon(String(x || '').trim(), 28)).filter(Boolean))].slice(0, MAX_TAGS) };
    schrijfAudit(d, key, 'documentbeheer-gewijzigd', { classificatie: d.beheer.classificatie,
      bewaartermijn: d.beheer.bewaartermijn, herzienOp: d.beheer.herzienOp || undefined });
    save(); meld(d, key, 'documentbeheer', { classificatie: d.beheer.classificatie });
    return { status: 200, ok: true, beheer: beheerVan(d) };
  }

  return { officeSamen: stand, officeAanwezig: hartslag, officeOpmerking: opmerking, officeBeheer: beheer,
    officeBeheerVan: beheerVan };
};

module.exports.CLASSIFICATIES = CLASSIFICATIES;
module.exports.BEWAARTERMIJNEN = BEWAARTERMIJNEN;
