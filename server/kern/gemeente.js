/* RTG Gemeente: het civiele systeem voor de hele gemeente, als partner-genre op
   dezelfde motor. Vier pijlers, drie soorten gebruikers:
   - Inwoners (leden-app): meldingen openbare ruimte, afspraken burgerzaken,
     vergunningen aanvragen, afvalkalender, aanslagen en bekendmakingen.
   - Gemeente-medewerkers (partner-app + PDA): meldingen toewijzen en afhandelen,
     afspraken zien, vergunningen beoordelen, bekendmakingen plaatsen.
   - RTG-partners (bedrijven): terras-, evenement- en horecavergunningen.

   Privacy by design: alles draait op codenamen; de echte naam blijft in de
   kluis (accounts.js). Nooit de belofte dat een besluit of betaling al rond is;
   een aanvraag is "ingediend"/"aangevraagd" tot een mens beslist.

   Volgt het vaste kern-patroon maakGemeente(state). */

const CATS = {
  verlichting: 'Straatverlichting', afval: 'Afval & vuil', wegdek: 'Wegdek & stoep',
  groen: 'Groen & bomen', riool: 'Riool & water', overlast: 'Overlast', speeltuin: 'Speeltuin', overig: 'Overig'
};
// welke ploeg een categorie standaard oppakt
const PLOEG = {
  verlichting: 'openbare werken', afval: 'reiniging', wegdek: 'openbare werken', groen: 'groenbeheer',
  riool: 'openbare werken', overlast: 'handhaving', speeltuin: 'openbare werken', overig: 'openbare werken'
};
const MELD_STATUS = ['nieuw', 'in behandeling', 'gepland', 'opgelost', 'afgewezen'];
const BURGERZAKEN = {
  paspoort: { label: 'Paspoort', duurMin: 15, balie: true },
  id: { label: 'Identiteitskaart', duurMin: 15, balie: true },
  rijbewijs: { label: 'Rijbewijs', duurMin: 15, balie: true },
  uittreksel: { label: 'Uittreksel (BRP)', duurMin: 10, balie: true },
  geboorte: { label: 'Geboorteaangifte', duurMin: 20, balie: true },
  verhuizing: { label: 'Verhuizing doorgeven', duurMin: 0, balie: false }
};
const VERGUNNINGEN = {
  bouw: 'Omgevings-/bouwvergunning', evenement: 'Evenementenvergunning', terras: 'Terrasvergunning',
  horeca: 'Horeca-exploitatie', kap: 'Kapvergunning', standplaats: 'Standplaats/markt'
};
const VERG_STATUS = ['ingediend', 'in behandeling', 'verleend', 'geweigerd'];
const FRACTIES = { rest: 'Restafval', gft: 'GFT & etensresten', papier: 'Papier & karton', pmd: 'PMD (plastic/blik/pak)' };
const BALIE_SLOTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:30', '14:00', '14:30', '15:00', '15:30'];

function maakGemeente({ db, save, crypto, anthropic, findSupplier, notify, notifySupplier, sseToSupplier }) {
  const nu = () => new Date().toISOString();
  const vandaag = () => new Date().toISOString().slice(0, 10);
  const isDatum = x => /^\d{4}-\d{2}-\d{2}$/.test(String(x || ''));
  const id = () => crypto.randomBytes(4).toString('hex');
  const ref = p => 'RTG-' + p + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);

  function seed() {
    if (!Array.isArray(db.data.suppliers)) return;
    if (!db.data.supplierTypes.gemeente)
      db.data.supplierTypes.gemeente = { label: 'Gemeente & overheid', icon: '\u{1F3DB}️', caps: ['gemeente', 'location'] };
    if (!Array.isArray(db.data.gemeenteMeldingen)) db.data.gemeenteMeldingen = [];
    if (!Array.isArray(db.data.gemeenteAfspraken)) db.data.gemeenteAfspraken = [];
    if (!Array.isArray(db.data.gemeenteVergunningen)) db.data.gemeenteVergunningen = [];
    if (!Array.isArray(db.data.gemeenteAanslagen)) db.data.gemeenteAanslagen = [];
    if (!Array.isArray(db.data.gemeenteBekend)) db.data.gemeenteBekend = [];
    if (db.data._gemeenteSeed) return;
    db.data._gemeenteSeed = true;
    if (!db.data.suppliers.find(s => s.code === 'GEMEENTE')) {
      db.data.suppliers.push({
        code: 'GEMEENTE', name: 'Gemeente Eivissa', type: 'gemeente', city: 'Ibiza',
        loc: { lat: 38.909, lng: 1.432, label: 'Ajuntament, Vara de Rey, Eivissa' }, rate: 0, menu: [], photos: [],
        gemeente: {
          balie: { open: true, capaciteitPerSlot: 2 },
          afval: { patroon: { rest: 2, gft: 5, papier: 4, pmd: 1 }, biweekPapier: true } // weekdag 0=zo..6=za
        }
      });
    }
    db.data.gemeenteBekend.unshift(
      { id: id(), gemeente: 'GEMEENTE', titel: 'Herinrichting Vara de Rey', tekst: 'De gemeente start met de herinrichting van de boulevard; werkzaamheden tot het najaar.', soort: 'algemeen', at: nu() },
      { id: id(), gemeente: 'GEMEENTE', titel: 'Tijdelijke verkeersmaatregel Marina', tekst: 'Rondom de jachthaven geldt tijdens het weekend een inrijverbod voor gemotoriseerd verkeer.', soort: 'verkeer', at: nu() }
    );
    save();
  }

  function isGemeente(s) { return !!s && s.type === 'gemeente'; }
  function deGemeente() { seed(); return (db.data.suppliers || []).find(s => s.type === 'gemeente') || null; }

  /* ---------- pijler 1: meldingen openbare ruimte ---------- */
  function meld(sess, codenaam, data) {
    seed();
    data = data || {};
    const categorie = CATS[data.categorie] ? data.categorie : 'overig';
    const tekst = schoon(data.tekst, 500);
    if (tekst.length < 4) return { status: 400, error: 'Omschrijf kort wat er aan de hand is.' };
    const g = deGemeente();
    const m = {
      id: id(), ref: ref('M'), gemeente: g ? g.code : 'GEMEENTE',
      categorie, categorieLabel: CATS[categorie], tekst,
      locatie: schoon(data.locatie, 120) || null,
      lat: Number(data.lat) || null, lng: Number(data.lng) || null,
      melderKey: sess.key, melder: codenaam,
      status: 'nieuw', ploeg: PLOEG[categorie], updates: [], at: nu()
    };
    db.data.gemeenteMeldingen.unshift(m);
    db.data.gemeenteMeldingen = db.data.gemeenteMeldingen.slice(0, 20000);
    save();
    if (g && notifySupplier) notifySupplier(g.code, { icon: '\u{1F6A7}', title: 'Nieuwe melding: ' + CATS[categorie], body: codenaam + ': ' + tekst.slice(0, 80) });
    if (g && sseToSupplier) sseToSupplier(g.code, 'sync', { scope: 'gemeente' });
    return { ok: true, melding: publiekeMelding(m) };
  }
  function publiekeMelding(m) {
    return {
      ref: m.ref, categorie: m.categorie, categorieLabel: m.categorieLabel, tekst: m.tekst,
      locatie: m.locatie, status: m.status, ploeg: m.ploeg,
      updates: (m.updates || []).map(u => ({ tekst: u.tekst, at: u.at })), at: m.at
    };
  }
  function mijnMeldingen(key) {
    return (db.data.gemeenteMeldingen || []).filter(m => m.melderKey === key).slice(0, 50).map(publiekeMelding);
  }

  /* ---------- pijler 2: burgerzaken & afspraken ---------- */
  function burgerzakenOverzicht() {
    seed();
    const g = deGemeente();
    return {
      ok: true, open: !g || !g.gemeente || g.gemeente.balie.open !== false,
      soorten: Object.entries(BURGERZAKEN).map(([k, v]) => ({ id: k, label: v.label, opAfspraak: v.balie, duurMin: v.duurMin }))
    };
  }
  function bezetOp(datum, tijd) {
    return (db.data.gemeenteAfspraken || []).filter(a => a.datum === datum && a.tijd === tijd && a.status === 'gepland').length;
  }
  function burgerzakenSlots(soort, datum) {
    seed();
    if (!BURGERZAKEN[soort] || !BURGERZAKEN[soort].balie) return { status: 400, error: 'Kies een balieproduct.' };
    if (!isDatum(datum) || datum < vandaag()) return { status: 400, error: 'Kies een datum vanaf vandaag.' };
    const g = deGemeente();
    const cap = (g && g.gemeente && g.gemeente.balie.capaciteitPerSlot) || 2;
    const nuTijd = new Date().toTimeString().slice(0, 5);
    const slots = BALIE_SLOTS
      .filter(t => datum > vandaag() || t > nuTijd)
      .map(t => ({ tijd: t, vol: bezetOp(datum, t) >= cap }));
    return { ok: true, soort, label: BURGERZAKEN[soort].label, slots };
  }
  function afspraakMaak(sess, codenaam, data) {
    seed();
    data = data || {};
    const soort = data.soort;
    if (!BURGERZAKEN[soort] || !BURGERZAKEN[soort].balie) return { status: 400, error: 'Kies een balieproduct.' };
    if (!isDatum(data.datum) || data.datum < vandaag()) return { status: 400, error: 'Kies een datum vanaf vandaag.' };
    if (!BALIE_SLOTS.includes(String(data.tijd || ''))) return { status: 400, error: 'Kies een geldig tijdslot.' };
    const g = deGemeente();
    const cap = (g && g.gemeente && g.gemeente.balie.capaciteitPerSlot) || 2;
    if (bezetOp(data.datum, data.tijd) >= cap) return { status: 409, error: 'Dit tijdslot is vol. Kies een ander tijdstip.' };
    if ((db.data.gemeenteAfspraken || []).some(a => a.key === sess.key && a.soort === soort && a.status === 'gepland'))
      return { status: 409, error: 'Je hebt al een afspraak voor ' + BURGERZAKEN[soort].label + ' openstaan.' };
    const a = {
      id: id(), ref: ref('A'), gemeente: g ? g.code : 'GEMEENTE', soort, soortLabel: BURGERZAKEN[soort].label,
      datum: data.datum, tijd: data.tijd, key: sess.key, codenaam, notitie: schoon(data.notitie, 200),
      status: 'gepland', at: nu()
    };
    db.data.gemeenteAfspraken.unshift(a);
    db.data.gemeenteAfspraken = db.data.gemeenteAfspraken.slice(0, 20000);
    save();
    if (g && sseToSupplier) sseToSupplier(g.code, 'sync', { scope: 'gemeente' });
    return { ok: true, afspraak: { ref: a.ref, soort, soortLabel: a.soortLabel, datum: a.datum, tijd: a.tijd, status: a.status } };
  }
  function verhuizingDoorgeven(sess, codenaam, data) {
    seed();
    data = data || {};
    const nieuwAdres = schoon(data.nieuwAdres, 160);
    if (nieuwAdres.length < 4) return { status: 400, error: 'Vul je nieuwe adres in.' };
    const g = deGemeente();
    const a = {
      id: id(), ref: ref('V'), gemeente: g ? g.code : 'GEMEENTE', soort: 'verhuizing', soortLabel: BURGERZAKEN.verhuizing.label,
      datum: isDatum(data.datum) ? data.datum : null, tijd: null, key: sess.key, codenaam,
      nieuwAdres, huidigAdres: schoon(data.huidigAdres, 160) || null, aantal: Math.min(12, Math.max(1, parseInt(data.aantal, 10) || 1)),
      status: 'ontvangen', at: nu()
    };
    db.data.gemeenteAfspraken.unshift(a);
    save();
    if (g && sseToSupplier) sseToSupplier(g.code, 'sync', { scope: 'gemeente' });
    return { ok: true, aanvraag: { ref: a.ref, soortLabel: a.soortLabel, nieuwAdres, status: a.status } };
  }
  function mijnAfspraken(key) {
    return (db.data.gemeenteAfspraken || []).filter(a => a.key === key).slice(0, 50)
      .map(a => ({ ref: a.ref, soort: a.soort, soortLabel: a.soortLabel, datum: a.datum, tijd: a.tijd, status: a.status, nieuwAdres: a.nieuwAdres || null }));
  }
  function afspraakAnnuleer(key, r) {
    const a = (db.data.gemeenteAfspraken || []).find(x => x.ref === String(r || '') && x.key === key);
    if (!a) return { status: 404, error: 'Afspraak niet gevonden.' };
    if (!['gepland', 'ontvangen'].includes(a.status)) return { status: 409, error: 'Deze afspraak is al ' + a.status + '.' };
    a.status = 'geannuleerd';
    save();
    return { ok: true };
  }

  /* ---------- pijler 3: vergunningen ---------- */
  function vergunningAanvraag(aanvrager, data) {
    seed();
    data = data || {};
    const soort = VERGUNNINGEN[data.soort] ? data.soort : null;
    if (!soort) return { status: 400, error: 'Kies een geldige vergunningsoort.' };
    const omschrijving = schoon(data.omschrijving, 800);
    if (omschrijving.length < 6) return { status: 400, error: 'Omschrijf je aanvraag.' };
    const g = deGemeente();
    const v = {
      id: id(), ref: ref('G'), gemeente: g ? g.code : 'GEMEENTE', soort, soortLabel: VERGUNNINGEN[soort],
      omschrijving, locatie: schoon(data.locatie, 160) || null,
      aanvragerKey: aanvrager.key || null, aanvrager: aanvrager.codenaam || null,
      supplierCode: aanvrager.supplierCode || null, bedrijf: aanvrager.bedrijf || null,
      status: 'ingediend', voorwaarden: [], besluit: null, bekend: false, at: nu()
    };
    db.data.gemeenteVergunningen.unshift(v);
    db.data.gemeenteVergunningen = db.data.gemeenteVergunningen.slice(0, 20000);
    save();
    if (g && notifySupplier) notifySupplier(g.code, { icon: '\u{1F4DC}', title: 'Vergunningaanvraag: ' + VERGUNNINGEN[soort], body: (v.aanvrager || v.bedrijf || 'aanvrager') + ': ' + omschrijving.slice(0, 80) });
    if (g && sseToSupplier) sseToSupplier(g.code, 'sync', { scope: 'gemeente' });
    return { ok: true, vergunning: publiekeVerg(v) };
  }
  function publiekeVerg(v) {
    return { ref: v.ref, soort: v.soort, soortLabel: v.soortLabel, omschrijving: v.omschrijving, locatie: v.locatie,
      status: v.status, voorwaarden: v.voorwaarden || [], besluit: v.besluit, at: v.at };
  }
  function mijnVergunningen(key) {
    return (db.data.gemeenteVergunningen || []).filter(v => v.aanvragerKey === key).slice(0, 50).map(publiekeVerg);
  }
  function vergunningenVanPartner(code) {
    return (db.data.gemeenteVergunningen || []).filter(v => v.supplierCode === code).slice(0, 50).map(publiekeVerg);
  }

  /* ---------- pijler 4: afval, belasting & bestuur ---------- */
  function afvalVoor(postcode) {
    seed();
    const g = deGemeente();
    const pat = (g && g.gemeente && g.gemeente.afval && g.gemeente.afval.patroon) || { rest: 2, gft: 5, papier: 4, pmd: 1 };
    // de postcode schuift het patroon een paar dagen op, zodat wijken verschillen
    const off = [...String(postcode || '00000')].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % 7;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const uit = {};
    for (const [fr, wd] of Object.entries(pat)) {
      const doel = (wd + off) % 7;
      const data = [];
      for (let i = 0; i < 28 && data.length < 3; i++) {
        const d = new Date(start.getTime() + i * 86400000);
        if (d.getDay() !== doel) continue;
        // papier tweewekelijks
        if (fr === 'papier' && g && g.gemeente.afval.biweekPapier && Math.floor((d - start) / (7 * 86400000)) % 2 === 1) continue;
        data.push(d.toISOString().slice(0, 10));
      }
      uit[fr] = { label: FRACTIES[fr], data };
    }
    return { ok: true, postcode: String(postcode || '').toUpperCase().slice(0, 8) || null, fracties: uit };
  }
  function grofvuilAanvraag(sess, codenaam, data) {
    seed();
    data = data || {};
    const wat = schoon(data.wat, 300);
    if (wat.length < 3) return { status: 400, error: 'Omschrijf wat er opgehaald moet worden.' };
    const g = deGemeente();
    const m = {
      id: id(), ref: ref('M'), gemeente: g ? g.code : 'GEMEENTE', categorie: 'afval', categorieLabel: 'Grofvuil op afspraak',
      tekst: 'Grofvuil: ' + wat, locatie: schoon(data.adres, 160) || null, lat: null, lng: null,
      melderKey: sess.key, melder: codenaam, status: 'gepland', ploeg: 'reiniging',
      updates: [{ tekst: 'Aangevraagd; de reiniging plant een ophaalmoment in.', at: nu(), door: 'systeem' }], at: nu()
    };
    db.data.gemeenteMeldingen.unshift(m);
    save();
    if (g && sseToSupplier) sseToSupplier(g.code, 'sync', { scope: 'gemeente' });
    return { ok: true, aanvraag: publiekeMelding(m) };
  }
  function belastingMijn(key) {
    return (db.data.gemeenteAanslagen || []).filter(a => a.key === key)
      .map(a => ({ id: a.id, soort: a.soort, jaar: a.jaar, bedrag: a.bedrag, betaald: !!a.betaald }));
  }
  function bekendmakingen() {
    seed();
    return { ok: true, bekendmakingen: (db.data.gemeenteBekend || []).slice(0, 40).map(b => ({ id: b.id, titel: b.titel, tekst: b.tekst, soort: b.soort, at: b.at })) };
  }

  /* ---------- gemeente-medewerkers (partner-app + PDA) ---------- */
  function magBehandelen(s) { return isGemeente(s); }
  function regie() {
    seed();
    const M = db.data.gemeenteMeldingen || [], A = db.data.gemeenteAfspraken || [], G = db.data.gemeenteVergunningen || [];
    const open = M.filter(m => !['opgelost', 'afgewezen'].includes(m.status));
    const perPloeg = {};
    for (const m of open) perPloeg[m.ploeg] = (perPloeg[m.ploeg] || 0) + 1;
    return {
      ok: true,
      meldingenOpen: open.length,
      meldingenPerPloeg: perPloeg,
      afsprakenVandaag: A.filter(a => a.datum === vandaag() && a.status === 'gepland').length,
      vergunningenOpen: G.filter(v => ['ingediend', 'in behandeling'].includes(v.status)).length,
      bekendmakingen: (db.data.gemeenteBekend || []).length
    };
  }
  function meldingenLijst(filter) {
    seed();
    filter = filter || {};
    let list = (db.data.gemeenteMeldingen || []);
    if (filter.ploeg) list = list.filter(m => m.ploeg === filter.ploeg);
    if (filter.status) list = list.filter(m => m.status === filter.status);
    else list = list.filter(m => !['opgelost', 'afgewezen'].includes(m.status));
    return { ok: true, meldingen: list.slice(0, 200).map(m => ({ ...publiekeMelding(m), melder: m.melder, ploeg: m.ploeg, lat: m.lat, lng: m.lng })) };
  }
  function meldingZet(actor, r, patch) {
    patch = patch || {};
    const m = (db.data.gemeenteMeldingen || []).find(x => x.ref === String(r || ''));
    if (!m) return { status: 404, error: 'Melding niet gevonden.' };
    if (typeof patch.status === 'string' && MELD_STATUS.includes(patch.status)) m.status = patch.status;
    if (typeof patch.ploeg === 'string' && patch.ploeg) m.ploeg = schoon(patch.ploeg, 40);
    const note = schoon(patch.update, 300);
    if (note) m.updates.unshift({ tekst: note, at: nu(), door: actor || 'gemeente' });
    m.updates = (m.updates || []).slice(0, 40);
    save();
    if (m.melderKey && notify) { /* de melder ziet de status in de app; push blijft licht */ }
    const g = deGemeente(); if (g && sseToSupplier) sseToSupplier(g.code, 'sync', { scope: 'gemeente' });
    return { ok: true, melding: publiekeMelding(m) };
  }
  function afsprakenLijst(datum) {
    seed();
    const d = isDatum(datum) ? datum : vandaag();
    return { ok: true, datum: d, afspraken: (db.data.gemeenteAfspraken || [])
      .filter(a => (a.datum === d || (a.soort === 'verhuizing' && a.status === 'ontvangen')) && a.status !== 'geannuleerd')
      .map(a => ({ ref: a.ref, soort: a.soort, soortLabel: a.soortLabel, tijd: a.tijd, codenaam: a.codenaam, status: a.status, nieuwAdres: a.nieuwAdres || null })) };
  }
  function vergunningenLijst(filter) {
    seed();
    filter = filter || {};
    let list = (db.data.gemeenteVergunningen || []);
    if (filter.status) list = list.filter(v => v.status === filter.status);
    else list = list.filter(v => ['ingediend', 'in behandeling'].includes(v.status));
    return { ok: true, vergunningen: list.slice(0, 200).map(v => ({ ...publiekeVerg(v), aanvrager: v.aanvrager || v.bedrijf || null })) };
  }
  function vergunningBeslis(actor, r, data) {
    data = data || {};
    const v = (db.data.gemeenteVergunningen || []).find(x => x.ref === String(r || ''));
    if (!v) return { status: 404, error: 'Vergunning niet gevonden.' };
    const besluit = data.besluit;
    if (!['verleend', 'geweigerd', 'in behandeling'].includes(besluit)) return { status: 400, error: 'Kies een geldig besluit.' };
    v.status = besluit;
    if (Array.isArray(data.voorwaarden)) v.voorwaarden = data.voorwaarden.map(x => schoon(x, 200)).filter(Boolean).slice(0, 12);
    v.besluit = { door: actor || 'gemeente', motivatie: schoon(data.motivatie, 400) || null, at: nu() };
    save();
    // een verleende vergunning wordt een openbare bekendmaking
    if (besluit === 'verleend' && data.bekend !== false && !v.bekend) {
      v.bekend = true;
      db.data.gemeenteBekend.unshift({ id: id(), gemeente: v.gemeente, titel: 'Verleend: ' + v.soortLabel + (v.locatie ? ' (' + v.locatie + ')' : ''),
        tekst: v.omschrijving.slice(0, 200), soort: 'vergunning', at: nu() });
      save();
    }
    const g = deGemeente(); if (g && sseToSupplier) sseToSupplier(g.code, 'sync', { scope: 'gemeente' });
    return { ok: true, vergunning: publiekeVerg(v) };
  }
  function bekendmakingMaak(actor, data) {
    seed();
    data = data || {};
    const titel = schoon(data.titel, 120), tekst = schoon(data.tekst, 800);
    if (titel.length < 3 || tekst.length < 3) return { status: 400, error: 'Vul een titel en tekst in.' };
    const soort = ['algemeen', 'raad', 'verkeer', 'vergunning'].includes(data.soort) ? data.soort : 'algemeen';
    const b = { id: id(), gemeente: (deGemeente() || {}).code || 'GEMEENTE', titel, tekst, soort, door: actor || 'gemeente', at: nu() };
    db.data.gemeenteBekend.unshift(b);
    db.data.gemeenteBekend = db.data.gemeenteBekend.slice(0, 500);
    save();
    return { ok: true, bekendmaking: { id: b.id, titel, tekst, soort, at: b.at } };
  }

  /* AI-triage voor een melding: stelt categorie en ploeg voor (Claude, met een
     deterministische regel-fallback zodat het altijd werkt). Mens beslist. */
  function regelTriage(tekst) {
    const t = String(tekst || '').toLowerCase();
    const kies = (re, cat) => re.test(t) ? cat : null;
    const cat = kies(/lantaarn|lamp|verlicht|donker|straatlicht/, 'verlichting')
      || kies(/afval|vuil|container|zwerf|prullenbak|stort/, 'afval')
      || kies(/gat|weg|stoep|tegel|asfalt|put/, 'wegdek')
      || kies(/boom|tak|groen|struik|onkruid|gras/, 'groen')
      || kies(/riool|water|stank|verstop|lek/, 'riool')
      || kies(/overlast|lawaai|herrie|geluid|hangjong/, 'overlast')
      || kies(/speeltuin|speel|schommel|wip/, 'speeltuin') || 'overig';
    return { categorie: cat, categorieLabel: CATS[cat], ploeg: PLOEG[cat] };
  }
  async function triage(tekst) {
    const val = regelTriage(tekst);
    if (!anthropic) return { ok: true, ...val, bron: 'regel' };
    try {
      const resp = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 120,
        system: 'Je bent de meldkamer van een gemeente. Kies voor de melding de best passende categorie uit: ' +
          Object.keys(CATS).join(', ') + '. Antwoord uitsluitend als JSON: {"categorie":"<sleutel>"}.',
        messages: [{ role: 'user', content: String(tekst || '').slice(0, 400) }]
      });
      const m = ((resp.content.find(c => c.type === 'text') || {}).text || '').match(/\{[\s\S]*\}/);
      const j = m ? JSON.parse(m[0]) : {};
      const cat = CATS[j.categorie] ? j.categorie : val.categorie;
      return { ok: true, categorie: cat, categorieLabel: CATS[cat], ploeg: PLOEG[cat], bron: 'ai' };
    } catch (e) { return { ok: true, ...val, bron: 'regel' }; }
  }

  return {
    gemeente: {
      seed, isGemeente, magBehandelen, CATS, VERGUNNINGEN, BURGERZAKEN, FRACTIES,
      // inwoners
      meld, mijnMeldingen, burgerzakenOverzicht, burgerzakenSlots, afspraakMaak, verhuizingDoorgeven,
      mijnAfspraken, afspraakAnnuleer, vergunningAanvraag, mijnVergunningen, vergunningenVanPartner,
      afvalVoor, grofvuilAanvraag, belastingMijn, bekendmakingen,
      // medewerkers
      regie, meldingenLijst, meldingZet, afsprakenLijst, vergunningenLijst, vergunningBeslis, bekendmakingMaak, triage
    }
  };
}

module.exports = { maakGemeente };
