/* Kern-module "lifestyle": De Rechterhand -- de premium suite van de Lifestyle
   Pass (het hoogste dienstenniveau). Vier onderdelen op een prive-dossier per lid:
   het Concierge-bureau (verzoeken met een statusketen + vaste voorkeuren die
   meereizen), het Bezittingenregister (family-office light), Gezondheid & welzijn
   (afspraken + prive-dossier) en het overkoepelende Rechterhand-overzicht met een
   briefing van Rahul in de u-vorm. Rahul belooft nooit een boeking of toegang die
   hij niet zeker kan waarmaken; hij noteert en verwijst eerlijk naar een mens.
   Gedeelde context (db, save, anthropic, liveCodename) vanuit server.js. */
module.exports = ({ db, save, crypto, anthropic, liveCodename }) => {
  const nu = () => new Date().toISOString();
  const rid = () => crypto.randomBytes(4).toString('hex');
  const schoon = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n || 200);
  const vandaag = () => new Date().toISOString().slice(0, 10);
  const isDatum = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));

  function L(key) {
    if (!db.data.lifestyle) db.data.lifestyle = {};
    if (!db.data.lifestyle[key]) db.data.lifestyle[key] = { verzoeken: [], bezittingen: [], afspraken: [], dossier: [], voorkeuren: {} };
    const l = db.data.lifestyle[key];
    for (const veld of ['verzoeken', 'bezittingen', 'afspraken', 'dossier']) if (!Array.isArray(l[veld])) l[veld] = [];
    if (!l.voorkeuren || typeof l.voorkeuren !== 'object') l.voorkeuren = {};
    return l;
  }

  /* ================= Concierge-bureau ================= */
  const CATEGORIEEN = ['reis', 'restaurant', 'evenement', 'cadeau', 'vervoer', 'huishouden', 'overig'];
  function conciergeVraag(key, body) {
    const titel = schoon(body.titel, 100);
    if (!titel) return { status: 400, error: 'Waarmee kunnen wij u van dienst zijn?' };
    const l = L(key);
    if (l.verzoeken.filter(v => v.status !== 'afgerond' && v.status !== 'ingetrokken').length >= 50)
      return { status: 400, error: 'U heeft veel lopende verzoeken. Wij ronden er graag eerst een paar met u af.' };
    const v = { id: rid(), titel, details: schoon(body.details, 800), categorie: CATEGORIEEN.includes(body.categorie) ? body.categorie : 'overig',
      status: 'aangevraagd', at: nu(), updates: [{ status: 'aangevraagd', op: nu(), notitie: 'Uw verzoek is genoteerd. Een van onze mensen neemt het persoonlijk op.' }] };
    l.verzoeken.unshift(v); save();
    return { status: 200, ok: true, verzoek: v };
  }
  function conciergeIntrek(key, id) {
    const l = L(key);
    const v = l.verzoeken.find(x => x.id === id);
    if (!v) return { status: 404, error: 'Dit verzoek vinden wij niet terug.' };
    if (v.status === 'afgerond') return { status: 400, error: 'Dit verzoek is al afgerond.' };
    v.status = 'ingetrokken'; v.updates.push({ status: 'ingetrokken', op: nu(), notitie: 'Op uw verzoek ingetrokken.' }); save();
    return { status: 200, ok: true };
  }
  function voorkeurenZet(key, body) {
    const l = L(key);
    const v = l.voorkeuren;
    for (const veld of ['dieet', 'restaurant', 'hotelkamer', 'stoel', 'chauffeur', 'bloemen', 'overig'])
      if (body[veld] !== undefined) v[veld] = schoon(body[veld], 160);
    save();
    return { status: 200, ok: true, voorkeuren: v };
  }

  /* ================= Bezittingenregister ================= */
  const SOORTEN = ['vastgoed', 'voertuig', 'vaartuig', 'kunst', 'horloge', 'sieraad', 'overig'];
  function bezitZet(key, body) {
    const naam = schoon(body.naam, 100);
    if (!naam) return { status: 400, error: 'Geef het object een naam.' };
    const l = L(key);
    const rec = {
      soort: SOORTEN.includes(body.soort) ? body.soort : 'overig', naam,
      waarde: Math.max(0, Math.min(1e11, Math.round(Number(body.waarde) || 0))),
      verzekeraar: schoon(body.verzekeraar, 80), polis: schoon(body.polis, 60),
      verzekerdTot: isDatum(body.verzekerdTot) ? body.verzekerdTot : '',
      taxatieOp: isDatum(body.taxatieOp) ? body.taxatieOp : '',
      onderhoudOp: isDatum(body.onderhoudOp) ? body.onderhoudOp : '',
      notitie: schoon(body.notitie, 300)
    };
    if (body.id) {
      const b = l.bezittingen.find(x => x.id === body.id);
      if (!b) return { status: 404, error: 'Dit object staat niet in uw register.' };
      Object.assign(b, rec); save();
      return { status: 200, ok: true, bezit: b };
    }
    if (l.bezittingen.length >= 300) return { status: 400, error: 'Uw register is vol.' };
    const b = Object.assign({ id: rid(), at: nu() }, rec);
    l.bezittingen.push(b); save();
    return { status: 200, ok: true, bezit: b };
  }
  function bezitWeg(key, id) {
    const l = L(key);
    l.bezittingen = l.bezittingen.filter(x => x.id !== id); save();
    return { status: 200, ok: true };
  }
  // attentiepunten: wat verloopt of nadert (verzekering, taxatie, onderhoud)
  function attenties(l) {
    const t = vandaag(), grens = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    const uit = [];
    for (const b of l.bezittingen) {
      if (b.verzekerdTot && b.verzekerdTot <= grens) uit.push({ id: b.id, naam: b.naam, soort: 'verzekering', datum: b.verzekerdTot, verlopen: b.verzekerdTot < t });
      if (b.taxatieOp && b.taxatieOp <= grens) uit.push({ id: b.id, naam: b.naam, soort: 'taxatie', datum: b.taxatieOp, verlopen: b.taxatieOp < t });
      if (b.onderhoudOp && b.onderhoudOp <= grens) uit.push({ id: b.id, naam: b.naam, soort: 'onderhoud', datum: b.onderhoudOp, verlopen: b.onderhoudOp < t });
    }
    return uit.sort((a, b) => a.datum.localeCompare(b.datum));
  }
  function bezittingen(key) {
    const l = L(key);
    const lijst = l.bezittingen.slice().sort((a, b) => b.waarde - a.waarde);
    return { status: 200, bezittingen: lijst, totaalWaarde: lijst.reduce((s, b) => s + b.waarde, 0), attenties: attenties(l) };
  }

  /* ================= Gezondheid & welzijn (prive) ================= */
  function gzAfspraak(key, body) {
    const wat = schoon(body.wat, 100);
    if (!wat) return { status: 400, error: 'Wat voor afspraak betreft het?' };
    if (!isDatum(body.datum)) return { status: 400, error: 'Kies een datum.' };
    const l = L(key);
    if (l.afspraken.length >= 200) return { status: 400, error: 'Er staan al veel afspraken.' };
    const a = { id: rid(), wat, datum: body.datum, tijd: /^\d{2}:\d{2}$/.test(body.tijd || '') ? body.tijd : '',
      specialist: schoon(body.specialist, 80), waar: schoon(body.waar, 100), at: nu() };
    l.afspraken.push(a); save();
    return { status: 200, ok: true, afspraak: a };
  }
  function gzAfspraakWeg(key, id) { const l = L(key); l.afspraken = l.afspraken.filter(a => a.id !== id); save(); return { status: 200, ok: true }; }
  function gzDossier(key, body) {
    const titel = schoon(body.titel, 100);
    if (!titel) return { status: 400, error: 'Geef de notitie een titel.' };
    const l = L(key);
    if (l.dossier.length >= 200) l.dossier.shift();
    const n = { id: rid(), titel, tekst: schoon(body.tekst, 2000), at: nu() };
    l.dossier.unshift(n); save();
    return { status: 200, ok: true, notitie: n };
  }
  function gzDossierWeg(key, id) { const l = L(key); l.dossier = l.dossier.filter(n => n.id !== id); save(); return { status: 200, ok: true }; }
  function gezondheid(key) {
    const l = L(key), t = vandaag();
    const afspraken = l.afspraken.map(a => ({ ...a, voorbij: a.datum < t,
      dagenTot: Math.round((new Date(a.datum + 'T12:00') - new Date(t + 'T12:00')) / 86400000) }))
      .sort((a, b) => (a.datum + (a.tijd || '99:99')).localeCompare(b.datum + (b.tijd || '99:99')));
    return { status: 200, afspraken, volgende: afspraken.find(a => !a.voorbij) || null, dossier: l.dossier };
  }

  /* ================= De Rechterhand: overzicht + Rahul-briefing ================= */
  function overzicht(key) {
    const l = L(key), t = vandaag();
    const open = l.verzoeken.filter(v => v.status !== 'afgerond' && v.status !== 'ingetrokken');
    const gz = gezondheid(key);
    const bez = bezittingen(key);
    return {
      status: 200,
      naam: liveCodename ? liveCodename(key) : '',
      verzoekenOpen: open.length,
      laatsteVerzoek: l.verzoeken[0] || null,
      volgendeAfspraak: gz.volgende,
      bezittingen: bez.bezittingen.length, bezittingenWaarde: bez.totaalWaarde,
      attenties: bez.attenties,
      voorkeurenGezet: Object.keys(l.voorkeuren).filter(k => l.voorkeuren[k]).length
    };
  }

  async function lifestyleAI(key, vraag) {
    const q = schoon(vraag, 400);
    const o = overzicht(key);
    const samenvatting = 'Open verzoeken: ' + o.verzoekenOpen +
      (o.volgendeAfspraak ? '. Volgende afspraak: ' + o.volgendeAfspraak.wat + ' op ' + o.volgendeAfspraak.datum : '') +
      (o.attenties.length ? '. Attentiepunten in het register: ' + o.attenties.length : '') + '.';
    if (anthropic && q) {
      try {
        const res = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 320,
          system: require('./rahul').RAHUL_LEAD + 'u bent De Rechterhand van dit Lifestyle Pass-lid: hun persoonlijke chef de bureau. ' +
            'Spreek het lid consequent aan met "u". Voorkomend, discreet en to the point. U regelt en noteert, maar u belooft NOOIT een boeking, ' +
            'tafel, toegang of levertijd die u niet zeker kunt waarmaken: u noteert het verzoek en zegt dat een van onze mensen het persoonlijk oppakt. ' +
            'U verzint geen namen van partners of prijzen. Context (prive): ' + samenvatting,
          messages: [{ role: 'user', content: q }]
        });
        const tekst = res.content && res.content[0] && res.content[0].text;
        if (tekst) return { status: 200, ok: true, antwoord: tekst };
      } catch (e) { /* val terug */ }
    }
    return { status: 200, ok: true, demo: true,
      antwoord: 'Tot uw dienst. ' + samenvatting + ' Zeg mij waarmee ik u kan helpen, dan noteer ik het en pakt een van onze mensen het persoonlijk op. Een boeking bevestig ik pas als die rond is.' };
  }

  return {
    lifestyleOverzicht: overzicht, lifestyleAI,
    conciergeVraag, conciergeIntrek, conciergeVerzoeken: (key) => ({ status: 200, verzoeken: L(key).verzoeken, categorieen: CATEGORIEEN }),
    lifestyleVoorkeuren: (key) => ({ status: 200, voorkeuren: L(key).voorkeuren }), lifestyleVoorkeurenZet: voorkeurenZet,
    bezitZet, bezitWeg, bezittingen, BEZIT_SOORTEN: SOORTEN,
    gzAfspraak, gzAfspraakWeg, gzDossier, gzDossierWeg, gezondheid
  };
};
