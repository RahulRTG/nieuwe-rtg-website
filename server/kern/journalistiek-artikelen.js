/* Concept en gepubliceerde editie horen bij hetzelfde bronartikel.
   Alleen publiceer vervangt de editie. Interne notities gaan nooit mee. */
'use strict';
const VELDEN = ['titel', 'chapo', 'inhoud', 'rubriek', 'beeld', 'auteur'];
const inhoudVan = a => Object.fromEntries(VELDEN.map(k => [k, a[k] || '']));
function publicatieVan(a) {
  if (!a || a.status !== 'live') return null;
  // Bestaande live artikelen blijven leesbaar zonder opslagmigratie.
  return a.publicatie || { ...inhoudVan(a), bij: a.bij, gepubliceerd: a.gepubliceerd || a.bij, versie: 1 };
}
function kortArtikel(a) {
  return { id: a.id, titel: a.titel, chapo: a.chapo, rubriek: a.rubriek, status: a.status,
    auteur: a.auteur, beeld: a.beeld || '', bij: a.bij, gepubliceerd: a.gepubliceerd || null,
    gelezen: a.gelezen || 0, revisie: a.revisie || 0,
    redactiestand: a.redactiestand || (a.status === 'live' ? 'gepubliceerd' : 'concept'),
    publicatieversie: a.publicatie ? a.publicatie.versie : (a.status === 'live' ? 1 : 0) };
}
function publiekeKop(a) {
  const p = publicatieVan(a);
  return p && { id: a.id, ...inhoudVan(p), inhoud: undefined, status: 'live', bij: p.bij,
    gepubliceerd: p.gepubliceerd, gelezen: a.gelezen || 0, publicatieversie: p.versie };
}
module.exports = ({ ruimte, lees, save, scho, id, nu }) => {
  const vind = (code, artId) => (lees(code)?.artikelen || []).find(a => a.id === scho(artId, 20));
  const ontbreekt = () => ({ error: 'Artikel niet gevonden.', status: 404 });
  function conflict(a, d) {
    return d.revisie !== undefined && d.revisie !== (a.revisie || 0)
      ? { error: 'Dit artikel is ondertussen gewijzigd. Open de actuele versie voordat u verdergaat.', status: 409 } : null;
  }
  function log(a, soort, actor, toelichting) {
    a.historie = [...(a.historie || []), { soort, at: nu(), revisie: a.revisie || 0,
      versie: a.publicatie?.versie || 0, door: scho(actor?.name, 60) || 'Redactie',
      staffId: actor?.staffId || null, toelichting: scho(toelichting, 400) }].slice(-100);
  }
  function bewaarArtikel(code, d = {}, actor) {
    let a = d.id ? vind(code, d.id) : null;
    if (d.id && !a) return ontbreekt();
    const botsing = a && conflict(a, d); if (botsing) return botsing;
    const r = ruimte(code);
    if (!a && r.artikelen.length >= 500) return { error: 'Deze redactie heeft 500 artikelen. Beheer de bestaande artikelen voordat u een nieuw stuk toevoegt.', status: 409 };
    const velden = { titel: scho(d.titel, 160) || 'Zonder titel', chapo: scho(d.chapo, 300),
      inhoud: scho(d.inhoud, 20000), beeld: scho(d.beeld, 400),
      rubriek: r.rubrieken.includes(d.rubriek) ? d.rubriek : r.rubrieken[0] || 'Voorpagina',
      auteur: a?.auteur || scho(actor?.name, 60) || 'Redactie' };
    if (a?.status === 'live' && !a.publicatie) a.publicatie = publicatieVan(a);
    if (!a) { a = { id: id('a'), status: 'concept', gelezen: 0, gemaakt: nu(), revisie: 0 }; r.artikelen.unshift(a); }
    Object.assign(a, velden, { bij: nu(), revisie: (a.revisie || 0) + 1,
      notities: d.notities === undefined ? (a.notities || '') : scho(d.notities, 6000),
      redactiestand: d.naarReview === true ? 'eindredactie' : 'concept' });
    log(a, d.naarReview === true ? 'eindredactie' : 'bewaard', actor);
    save(); return { ok: true, artikel: a };
  }
  function publiceer(code, artId, actor, d = {}) {
    const a = vind(code, artId); if (!a) return ontbreekt();
    const botsing = conflict(a, d); if (botsing) return botsing;
    if (!a.titel || a.titel === 'Zonder titel' || !a.inhoud?.trim())
      return { error: 'Geef een kop en een artikeltekst voordat u publiceert.', status: 400 };
    const oud = a.publicatie || publicatieVan(a);
    const gewijzigd = oud && VELDEN.some(k => (oud[k] || '') !== (a[k] || ''));
    const reden = scho(d.toelichting, 400);
    if (oud && (gewijzigd || a.status !== 'live') && !reden)
      return { error: 'Geef een openbare toelichting bij deze correctie of herpublicatie.', status: 400 };
    if (a.status === 'live' && !gewijzigd) {
      a.redactiestand = 'gepubliceerd'; save(); return { ok: true, artikel: a };
    }
    const at = nu();
    a.publicatie = { ...inhoudVan(a), bij: at, gepubliceerd: oud?.gepubliceerd || at,
      versie: (oud?.versie || 0) + 1, toelichting: reden,
      correcties: [...(oud?.correcties || []), ...(oud ? [{ at, toelichting: reden }] : [])].slice(-100) };
    a.status = 'live'; a.gepubliceerd = a.publicatie.gepubliceerd;
    a.redactiestand = 'gepubliceerd'; a.bij = at; a.revisie = (a.revisie || 0) + 1;
    log(a, oud ? 'herpublicatie' : 'publicatie', actor, reden); save();
    return { ok: true, artikel: a };
  }
  function naarConcept(code, artId, actor, d = {}) {
    const a = vind(code, artId); if (!a) return ontbreekt();
    const botsing = conflict(a, d); if (botsing) return botsing;
    if (a.status === 'live' && !a.publicatie) a.publicatie = publicatieVan(a);
    a.status = 'concept'; a.redactiestand = 'concept'; a.bij = nu(); a.revisie = (a.revisie || 0) + 1;
    log(a, 'ingetrokken', actor); save(); return { ok: true, artikel: a };
  }
  function snel(code, d, actor) {
    // Spoed is een nieuwe publicatie; een bestaand stuk volgt de correctieweg.
    if (d?.id) return { error: 'Gebruik de artikelredactie om bestaand nieuws te corrigeren.', status: 400 };
    if (!scho(d?.titel, 160) || !scho(d?.inhoud, 20000))
      return { error: 'Geef een kop en een artikeltekst voordat u publiceert.', status: 400 };
    const r = bewaarArtikel(code, d, actor);
    return r.error ? r : publiceer(code, r.artikel.id, actor);
  }
  return { bewaarArtikel, publiceer, naarConcept, snel };
};
Object.assign(module.exports, { publicatieVan, kortArtikel, publiekeKop });
