/* Overheid-domein "pda": de Overheids-PDA -- een uitgebreide werktelefoon voor
   AL het personeel van ALLE rijkskantoren. Elke overheidslocatie (rechtbank,
   belastingkantoor, rijkskantoor, gemeentehuis) krijgt dezelfde PDA, met een
   eigen scherm per rol:
     receptie    bezoekers aanmelden met een badge, en weer uitschrijven
     security    rondes lopen langs alle ruimtes, incidenten melden en sluiten
     schoonmaak  de dagtaken per ruimte, afvinken en extra werk doorgeven
     bode        (rechtbank) de zittingen van vandaag klaarzetten
   De PDA werkt samen met de rest van het huis: de bode-taken komen rechtstreeks
   uit de zittingsrol van de rechtbank (rechtbank.js), en na elke zitting staat
   de zaal automatisch op de schoonmaaklijst. De AI-conciërge denkt mee per rol;
   beslissen en handelen doet de medewerker. Privacy: bezoekers staan op naam
   zoals de balie ze noteert, zonder koppeling aan de kluis.
   Krijgt de gedeelde ctx van kern/overheid/index.js. */

const LOCATIES = {
  rechtbank: { label: 'De Rechtbank', icoon: '⚖️',
    ruimtes: ['Hal en balie', 'Zittingszaal A', 'Zittingszaal B', 'Zittingszaal C', 'Raadkamer', 'Archief'] },
  belastingkantoor: { label: 'Het Belastingkantoor', icoon: '\u{1F3E6}',
    ruimtes: ['Hal en balie', 'Spreekkamer 1', 'Spreekkamer 2', 'Kantoortuin', 'Archief'] },
  rijkskantoor: { label: 'Het Rijkskantoor', icoon: '\u{1F3E2}',
    ruimtes: ['Hal en balie', 'Vergaderzaal Noord', 'Vergaderzaal Zuid', 'Kantoortuin', 'Serverruimte'] },
  gemeentehuis: { label: 'Het Gemeentehuis', icoon: '\u{1F3DB}️',
    ruimtes: ['Hal en balie', 'Loketten', 'Trouwzaal', 'Raadzaal', 'Archief'] }
};
const ROLLEN = {
  receptie: { label: 'Receptie', icoon: '\u{1F6CE}️', wat: 'bezoekers aanmelden en uitschrijven' },
  security: { label: 'Security', icoon: '\u{1F6E1}️', wat: 'rondes lopen en incidenten afhandelen' },
  schoonmaak: { label: 'Schoonmaak', icoon: '\u{1F9F9}', wat: 'de dagtaken per ruimte' },
  bode: { label: 'Bode', icoon: '\u{1F514}', wat: 'zittingszalen klaarzetten (rechtbank)' }
};
const INCIDENT_SOORTEN = ['toegang', 'verdacht', 'agressie', 'ehbo', 'techniek'];

module.exports = (ctx) => {
  const { db, save, anthropic, nu, id, schoon, seed } = ctx;

  function P() {
    seed();
    if (!db.data.overheidPda || typeof db.data.overheidPda !== 'object')
      db.data.overheidPda = { bezoekers: [], incidenten: [], taken: [], rondes: [] };
    const p = db.data.overheidPda;
    for (const k of ['bezoekers', 'incidenten', 'taken', 'rondes']) if (!Array.isArray(p[k])) p[k] = [];
    return p;
  }
  const loc = l => LOCATIES[String(l || '')] ? String(l) : null;
  const vandaag = () => new Date().toISOString().slice(0, 10);

  /* de dagtaken van de schoonmaak: elke ruimte een taak, elke dag opnieuw --
     plus een extra taak voor elke zittingszaal met een zitting vandaag */
  function zorgTaken(l) {
    const p = P(), d = vandaag();
    let nieuw = false;
    if (!p.taken.some(t => t.locatie === l && t.datum === d)) {
      for (const ruimte of LOCATIES[l].ruimtes)
        p.taken.push({ id: id(), locatie: l, datum: d, ruimte, tekst: 'Dagelijkse ronde: ' + ruimte, klaar: null, extra: false });
      p.taken = p.taken.filter(t => t.datum >= new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
      nieuw = true;
    }
    // elke zitting van vandaag zet zijn zaal op de lijst -- ook als de dag al liep
    if (l === 'rechtbank') {
      for (const z of (db.data.rijkZaken || []).filter(z => z.zitting && z.zitting.datum === d)) {
        if (!p.taken.some(t => t.locatie === l && t.datum === d && t.zaakRef === z.ref)) {
          p.taken.push({ id: id(), locatie: l, datum: d, ruimte: z.zitting.zaal, zaakRef: z.ref,
            tekst: 'Na de zitting van ' + z.zitting.tijd + ': ' + z.zitting.zaal + ' opfrissen', klaar: null, extra: true });
          nieuw = true;
        }
      }
    }
    if (nieuw) save();
    return p.taken.filter(t => t.locatie === l && t.datum === d);
  }

  /* ---- het overzicht: wat speelt er op deze locatie ---- */
  function pdaOverzicht(l) {
    l = loc(l);
    if (!l) return { status: 400, error: 'Kies een geldige locatie.' };
    const p = P();
    const taken = zorgTaken(l);
    const rondesVandaag = p.rondes.filter(r => r.locatie === l && r.at.slice(0, 10) === vandaag());
    const zittingen = l === 'rechtbank' ? (db.data.rijkZaken || []).filter(z => z.status === 'gepland' && z.zitting && z.zitting.datum === vandaag()).length : 0;
    return { ok: true, locatie: l, ...LOCATIES[l],
      locaties: Object.entries(LOCATIES).map(([k, v]) => ({ id: k, label: v.label, icoon: v.icoon })),
      rollen: Object.entries(ROLLEN).filter(([k]) => k !== 'bode' || l === 'rechtbank').map(([k, v]) => ({ id: k, ...v })),
      bezoekersBinnen: p.bezoekers.filter(b => b.locatie === l && !b.uit).length,
      incidentenOpen: p.incidenten.filter(i => i.locatie === l && !i.gesloten).length,
      takenOpen: taken.filter(t => !t.klaar).length, takenKlaar: taken.filter(t => t.klaar).length,
      rondesVandaag: rondesVandaag.length, laatsteRonde: rondesVandaag[0] ? rondesVandaag[0].at : null,
      zittingenVandaag: zittingen };
  }

  /* ---- receptie: bezoekers met een badge ---- */
  function pdaBezoekerIn(actor, l, data) {
    l = loc(l); data = data || {};
    if (!l) return { status: 400, error: 'Kies een geldige locatie.' };
    const naam = schoon(data.naam, 60);
    if (naam.length < 2) return { status: 400, error: 'Wie meldt zich aan de balie?' };
    const b = { id: id(), locatie: l, naam, voor: schoon(data.voor, 80) || 'bezoek',
      badge: 'B-' + ctx.crypto.randomBytes(2).toString('hex').toUpperCase(), door: actor || 'receptie', at: nu(), uit: null };
    P().bezoekers.unshift(b);
    db.data.overheidPda.bezoekers = P().bezoekers.slice(0, 20000);
    save();
    return { ok: true, bezoeker: b };
  }
  function pdaBezoekerUit(actor, bid) {
    const b = P().bezoekers.find(x => x.id === String(bid || ''));
    if (!b) return { status: 404, error: 'Bezoeker niet gevonden.' };
    if (b.uit) return { status: 409, error: 'Deze bezoeker is al uitgeschreven.' };
    b.uit = nu(); b.uitDoor = actor || 'receptie';
    save();
    return { ok: true, bezoeker: b };
  }
  function pdaBezoekers(l) {
    l = loc(l);
    if (!l) return { status: 400, error: 'Kies een geldige locatie.' };
    return { ok: true, bezoekers: P().bezoekers.filter(b => b.locatie === l && (!b.uit || b.at.slice(0, 10) === vandaag())).slice(0, 100) };
  }

  /* ---- security: rondes en incidenten ---- */
  function pdaRonde(actor, l, bevinding) {
    l = loc(l);
    if (!l) return { status: 400, error: 'Kies een geldige locatie.' };
    const r = { id: id(), locatie: l, checkpoints: LOCATIES[l].ruimtes.length, door: actor || 'security', at: nu() };
    P().rondes.unshift(r);
    db.data.overheidPda.rondes = P().rondes.slice(0, 5000);
    let incident = null;
    if (bevinding && schoon(bevinding.tekst, 300)) {
      const ir = pdaIncident(actor, l, bevinding);
      if (!ir.error) incident = ir.incident;
    }
    save();
    return { ok: true, ronde: r, incident };
  }
  function pdaIncident(actor, l, data) {
    l = loc(l); data = data || {};
    if (!l) return { status: 400, error: 'Kies een geldige locatie.' };
    const tekst = schoon(data.tekst, 300);
    if (tekst.length < 3) return { status: 400, error: 'Omschrijf wat er speelt.' };
    const i = { id: id(), locatie: l, ruimte: LOCATIES[l].ruimtes.includes(data.ruimte) ? data.ruimte : LOCATIES[l].ruimtes[0],
      soort: INCIDENT_SOORTEN.includes(data.soort) ? data.soort : 'verdacht',
      ernst: Math.min(3, Math.max(1, Math.round(Number(data.ernst) || 1))),
      tekst, door: actor || 'security', at: nu(), gesloten: null };
    P().incidenten.unshift(i);
    db.data.overheidPda.incidenten = P().incidenten.slice(0, 10000);
    save();
    return { ok: true, incident: i };
  }
  function pdaIncidentSluit(actor, iid, oplossing) {
    const i = P().incidenten.find(x => x.id === String(iid || ''));
    if (!i) return { status: 404, error: 'Incident niet gevonden.' };
    if (i.gesloten) return { status: 409, error: 'Dit incident is al gesloten.' };
    i.gesloten = { door: actor || 'security', oplossing: schoon(oplossing, 300) || 'afgehandeld', at: nu() };
    save();
    return { ok: true, incident: i };
  }
  function pdaIncidenten(l) {
    l = loc(l);
    if (!l) return { status: 400, error: 'Kies een geldige locatie.' };
    return { ok: true, soorten: INCIDENT_SOORTEN, incidenten: P().incidenten.filter(i => i.locatie === l).slice(0, 60) };
  }

  /* ---- schoonmaak: de dagtaken per ruimte ---- */
  function pdaTaken(l) {
    l = loc(l);
    if (!l) return { status: 400, error: 'Kies een geldige locatie.' };
    return { ok: true, datum: vandaag(), ruimtes: LOCATIES[l].ruimtes, taken: zorgTaken(l) };
  }
  function pdaTaakKlaar(actor, tid) {
    const t = P().taken.find(x => x.id === String(tid || ''));
    if (!t) return { status: 404, error: 'Taak niet gevonden.' };
    if (t.klaar) return { status: 409, error: 'Deze taak is al afgevinkt.' };
    t.klaar = { door: actor || 'schoonmaak', at: nu() };
    save();
    return { ok: true, taak: t };
  }
  function pdaTaakExtra(actor, l, data) {
    l = loc(l); data = data || {};
    if (!l) return { status: 400, error: 'Kies een geldige locatie.' };
    const tekst = schoon(data.tekst, 200);
    if (tekst.length < 3) return { status: 400, error: 'Omschrijf het extra werk.' };
    const t = { id: id(), locatie: l, datum: vandaag(), ruimte: LOCATIES[l].ruimtes.includes(data.ruimte) ? data.ruimte : LOCATIES[l].ruimtes[0],
      tekst, klaar: null, extra: true, door: actor || 'melder' };
    P().taken.push(t);
    save();
    return { ok: true, taak: t };
  }

  /* ---- bode (rechtbank): de zittingen van vandaag klaarzetten ---- */
  function pdaZittingen() {
    const d = vandaag();
    const rol = (db.data.rijkZaken || []).filter(z => z.status === 'gepland' && z.zitting && z.zitting.datum >= d)
      .sort((a, b) => (a.zitting.datum + a.zitting.tijd).localeCompare(b.zitting.datum + b.zitting.tijd)).slice(0, 40)
      .map(z => ({ ref: z.ref, titel: z.titel, datum: z.zitting.datum, tijd: z.zitting.tijd, zaal: z.zitting.zaal,
        rechter: z.zitting.rechter, klaargezet: !!z.zitting.klaargezet, vandaag: z.zitting.datum === d }));
    return { ok: true, datum: d, zittingen: rol };
  }
  function pdaKlaarzet(actor, zaakRef) {
    const z = (db.data.rijkZaken || []).find(x => x.ref === String(zaakRef || ''));
    if (!z || !z.zitting) return { status: 404, error: 'Zitting niet gevonden.' };
    if (z.zitting.klaargezet) return { status: 409, error: 'Deze zaal staat al klaar.' };
    z.zitting.klaargezet = true; z.zitting.klaargezetDoor = actor || 'bode'; z.zitting.klaargezetAt = nu();
    save();
    return { ok: true, zitting: { ref: z.ref, zaal: z.zitting.zaal, klaargezet: true } };
  }

  /* ---- de AI-conciërge: denkt mee per rol, de medewerker handelt ---- */
  async function pdaAI(l, rol, vraag) {
    l = loc(l);
    if (!l) return { status: 400, error: 'Kies een geldige locatie.' };
    const o = pdaOverzicht(l);
    const beeld = LOCATIES[l].label + ': ' + o.bezoekersBinnen + ' bezoekers binnen, ' + o.incidentenOpen + ' open incidenten, ' +
      o.takenOpen + ' schoonmaaktaken open (' + o.takenKlaar + ' klaar), ' + o.rondesVandaag + ' rondes vandaag' +
      (l === 'rechtbank' ? ', ' + o.zittingenVandaag + ' zittingen op de rol' : '') + '.';
    const r = ROLLEN[String(rol || '')] ? String(rol) : 'receptie';
    const q = schoon(vraag, 400);
    if (anthropic && q) {
      try {
        const resp = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 300,
          system: require('../rahul').RAHUL_LEAD + 'je bent de AI-conciërge op de Overheids-PDA van ' + LOCATIES[l].label +
            ', en je helpt nu een collega van de ' + ROLLEN[r].label.toLowerCase() + ' (' + ROLLEN[r].wat + '). ' +
            'Praktisch en kort; je adviseert alleen, de collega handelt zelf. Bij echt gevaar: eerst 112, dan melden. Huidige beeld: ' + beeld,
          messages: [{ role: 'user', content: q }]
        });
        const tekst = resp.content && resp.content[0] && resp.content[0].text;
        if (tekst) return { ok: true, antwoord: tekst };
      } catch (e) { /* val terug */ }
    }
    return { ok: true, demo: true, antwoord: 'Het beeld: ' + beeld + ' Voor de ' + ROLLEN[r].label.toLowerCase() + ': ' +
      (r === 'security' ? 'loop de ronde langs alle ' + LOCATIES[l].ruimtes.length + ' ruimtes en meld wat afwijkt; bij echt gevaar eerst 112.'
        : r === 'schoonmaak' ? 'begin bij de hal (het visitekaartje) en vink elke ruimte af; extra werk meld je met een tik.'
        : r === 'bode' ? 'zet de zalen van vandaag op volgorde van de rol klaar en meld ze gereed.'
        : 'meld elke bezoeker aan met een badge en schrijf ze bij vertrek uit; zo klopt de lijst altijd.') };
  }

  return { pdaOverzicht, pdaBezoekerIn, pdaBezoekerUit, pdaBezoekers, pdaRonde, pdaIncident, pdaIncidentSluit,
    pdaIncidenten, pdaTaken, pdaTaakKlaar, pdaTaakExtra, pdaZittingen, pdaKlaarzet, pdaAI,
    PDA_LOCATIES: LOCATIES, PDA_ROLLEN: ROLLEN };
};
