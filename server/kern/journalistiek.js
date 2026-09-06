/* RTG Journalistiek -- de redactie-omgeving voor nieuwsbedrijven (een
   leverancier-genre). Een luxe, efficiente nieuwsredactie: artikelen schrijven
   als concept, met een knop snel nieuws de lucht in, rubrieken beheren, en de
   eigen krantsite volledig in de eigen huisstijl opbouwen uit blokken (dezelfde
   bloktaal als de Website-studio). De gepubliceerde krant is voor iedereen te
   lezen; concepten blijven binnen de redactie.

   Alles per leverancier-code, geschoond en begrensd. Beeld verwijst naar eigen
   RTG-campagne of Salon; we bewaren alleen de verwijzing. */
module.exports = ({ db, save, crypto, schoon, findSupplier, claude }) => {
  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 200));
  const TYPES = ['hero', 'kop', 'tekst', 'knop', 'beeld', 'kolommen', 'galerij', 'citaat', 'ruimte', 'voettekst'];
  const VERSIES = ['telefoon', 'tablet', 'desktop'];
  const nu = () => new Date().toISOString();
  const id = (p) => (p || 'x') + crypto.randomBytes(4).toString('hex');

  const eigen = require('./eigencollectie')({ db, domein: 'kern/journalistiek', bezit: { redacties: 'kaart' } });
  function ruimte(code) {
    const alles = eigen.bak('redacties');
    if (!alles[code]) {
      const s = findSupplier ? findSupplier(code) : null;
      alles[code] = {
        huisstijl: { naam: (s && s.name) || 'Mijn krant', payoff: 'Onafhankelijk nieuws', accent: '#7F1634', thema: 'donker' },
        rubrieken: ['Voorpagina', 'Stad', 'Cultuur', 'Sport', 'Opinie'],
        artikelen: [],
        site: { blokken: [], volgorde: null }
      };
    }
    return alles[code];
  }
  // lezen zonder scheppen (kern/eigencollectie.js): /api/krant/* is publiek,
  // dus een onbekende code mag geen redactie laten ontstaan. Bij afwezigheid
  // NULL en geen verse schil -- wie daarin duwt, schrijft in het niets.
  const lees = code => eigen.kijk('redacties')[code] || null;

  /* ---- blok-schoonmaak (gedeelde bloktaal met de Website-studio); de
     schoonmakers zelf staan in ./journalistiek-blokken.js ---- */
  const { schoonBlok, schoonVolgorde } = require('./journalistiek-blokken').maakBlokSchoon({ scho, id, TYPES, VERSIES });

  /* ---- huisstijl ----
     Was de vierde kopie van de merkvalidatie en negeerde een foute kleur STIL:
     `ok: true` met de oude kleur erin. Leest nu kern/tenant/merkkern.js. */
  function huisstijlBewaar(code, d) {
    const r = ruimte(code);
    const uit = require('./tenant/merkkern').leesMerkvelden(d || {}, r.huisstijl, scho);
    if (uit.error) return { error: uit.error, status: uit.status || 400 };
    if (!uit.merk.naam) uit.merk.naam = 'Mijn krant';   // een krant heeft een kop
    r.huisstijl = uit.merk;
    save(); return { ok: true, huisstijl: r.huisstijl };
  }

  /* ---- rubrieken ---- */
  function rubriekBewaar(code, naam) {
    const n = scho(naam, 40); if (!n) return { error: 'Geef een naam.', status: 400 };
    const r = ruimte(code);
    if (!r.rubrieken.includes(n)) r.rubrieken.unshift(n); r.rubrieken = r.rubrieken.slice(0, 24); save();
    return { ok: true, rubrieken: r.rubrieken };
  }
  function rubriekWeg(code, naam) {
    const r = ruimte(code); r.rubrieken = r.rubrieken.filter(x => x !== naam); save();
    return { ok: true, rubrieken: r.rubrieken };
  }

  /* ---- artikelen ---- */
  const kortArt = a => ({ id: a.id, titel: a.titel, chapo: a.chapo, rubriek: a.rubriek, status: a.status, auteur: a.auteur, beeld: a.beeld || '', bij: a.bij, gelezen: a.gelezen || 0 });
  function schoonArt(r, d, actor) {
    d = d || {};
    const rubriek = r.rubrieken.includes(d.rubriek) ? d.rubriek : (r.rubrieken[0] || 'Voorpagina');
    return {
      titel: scho(d.titel, 160) || 'Zonder titel',
      chapo: scho(d.chapo, 300),
      inhoud: scho(d.inhoud, 20000),
      rubriek,
      beeld: scho(d.beeld, 400),
      auteur: scho((actor && actor.name) || d.auteur, 60) || 'Redactie'
    };
  }
  function bewaarArtikel(code, d, actor) {
    const r = ruimte(code); d = d || {};
    let a = d.id ? r.artikelen.find(x => x.id === scho(d.id, 20)) : null;
    const velden = schoonArt(r, d, actor);
    if (a) { Object.assign(a, velden); a.bij = nu(); }
    else { a = Object.assign({ id: id('a'), status: 'concept', gelezen: 0, gemaakt: nu(), bij: nu() }, velden); r.artikelen.unshift(a); r.artikelen = r.artikelen.slice(0, 500); }
    save(); return { ok: true, artikel: a };
  }
  function publiceer(code, artId, actor) {
    const r = lees(code); const a = r && r.artikelen.find(x => x.id === scho(artId, 20));
    if (!a) return { error: 'Artikel niet gevonden.', status: 404 };
    a.status = 'live'; a.bij = nu(); a.gepubliceerd = nu(); save();
    return { ok: true, artikel: a };
  }
  function naarConcept(code, artId) {
    const r = lees(code); const a = r && r.artikelen.find(x => x.id === scho(artId, 20));
    if (!a) return { error: 'Artikel niet gevonden.', status: 404 };
    a.status = 'concept'; a.bij = nu(); save(); return { ok: true, artikel: a };
  }
  function verwijderArtikel(code, artId) {
    const r = ruimte(code); r.artikelen = r.artikelen.filter(x => x.id !== scho(artId, 20)); save(); return { ok: true };
  }
  // de snelle knop: in een keer schrijven en publiceren
  function snel(code, d, actor) {
    const gemaakt = bewaarArtikel(code, d, actor);
    if (gemaakt.error) return gemaakt;
    return publiceer(code, gemaakt.artikel.id, actor);
  }

  /* ---- de eigen krantsite (blokken) ---- */
  function siteBewaar(code, d) {
    const r = ruimte(code); d = d || {};
    const blokken = (Array.isArray(d.blokken) ? d.blokken : []).slice(0, 60).map(schoonBlok);
    r.site = { blokken, volgorde: schoonVolgorde(d.volgorde, blokken) };
    save(); return { ok: true, site: r.site };
  }

  /* ---- office-overzicht ---- */
  function staat(code) {
    const r = ruimte(code);
    const live = r.artikelen.filter(a => a.status === 'live');
    return {
      huisstijl: r.huisstijl, rubrieken: r.rubrieken,
      tellers: { concept: r.artikelen.length - live.length, live: live.length, gelezen: live.reduce((s, a) => s + (a.gelezen || 0), 0) },
      recent: r.artikelen.slice(0, 12).map(kortArt),
      site: r.site
    };
  }
  function artikelen(code, filter) {
    const r = ruimte(code); filter = filter || {};
    let lijst = r.artikelen;
    if (filter.status) lijst = lijst.filter(a => a.status === filter.status);
    if (filter.rubriek) lijst = lijst.filter(a => a.rubriek === filter.rubriek);
    return { lijst: lijst.slice(0, 200).map(kortArt) };
  }
  function artikelVol(code, artId) {
    const r = lees(code); const a = r && r.artikelen.find(x => x.id === scho(artId, 20));
    return a || null;
  }

  /* De publieke kant -- de krant zoals een bezoeker hem ziet -- woont in
     ./journalistiek-krant.js: andere lezer, andere deur naar de opslag. */
  const publiek = require('./journalistiek-krant')({
    lees, kijk: () => eigen.kijk('redacties'), save, scho, kortArt });

  /* ---- redactie-assistent (regelgestuurd; met sleutel scherper) ---- */
  function chapoVoorstel(inhoud) {
    const t = String(inhoud || '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    const zin = t.split(/(?<=[.!?])\s/)[0] || t;
    return zin.slice(0, 240);
  }
  async function assist(code, d) {
    d = d || {}; const inhoud = String(d.inhoud || ''); const titel = String(d.titel || '');
    const val = { chapo: chapoVoorstel(inhoud), koppen: [] };
    // eenvoudige kop-suggesties zonder sleutel
    const woorden = inhoud.replace(/\s+/g, ' ').trim().split(' ').slice(0, 8).join(' ');
    val.koppen = [titel || woorden, (woorden.slice(0, 60))].filter(Boolean);
    if (!claude || !claude.beschikbaar || !claude.beschikbaar()) return val;
    try {
      const uit = await claude.vraag({
        systeem: 'Je bent een ervaren eindredacteur. Antwoord in het Nederlands, kort en zakelijk, geen opsmuk.',
        prompt: 'Geef voor dit artikel een chapo (max 240 tekens) en drie kop-opties. Titel: "' + titel + '". Tekst: ' + inhoud.slice(0, 3000),
        max: 400
      });
      if (uit) val.ai = String(uit).slice(0, 1200);
    } catch (e) {}
    return val;
  }

  return {
    ruimte, staat, artikelen, artikelVol, bewaarArtikel, publiceer, naarConcept, verwijderArtikel, snel,
    rubriekBewaar, rubriekWeg, huisstijlBewaar, siteBewaar,
    krantGids: publiek.krantGids, krant: publiek.krant, leesArtikel: publiek.leesArtikel,
    assist, TYPES
  };
};
