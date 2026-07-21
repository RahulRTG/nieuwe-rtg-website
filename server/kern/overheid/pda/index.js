/* Overheid-domein "pda": de Overheids-PDA -- een uitgebreide werktelefoon voor
   AL het personeel van ALLE rijkskantoren. Elke overheidslocatie (rechtbank,
   belastingkantoor, rijkskantoor, gemeentehuis) krijgt dezelfde PDA, met een
   eigen scherm per rol. De PDA werkt samen met de rest van het huis: de
   bode-taken komen rechtstreeks uit de zittingsrol van de rechtbank, en na
   elke zitting staat de zaal automatisch op de schoonmaaklijst.

   Dit is de spil: de locaties en rollen, de staat, de dagtaken-motor en het
   overzicht. Wat waar woont:
     ./vloer   receptie (bezoekers met een badge), security (rondes en
               incidenten) en schoonmaak (de dagtaken per ruimte)
     ./bode    de zittingen van vandaag klaarzetten (rechtbank) en de
               AI-conciërge die per rol meedenkt (de medewerker handelt)
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
  const { db, save, id, seed } = ctx;

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

  // de gedeelde subctx voor de PDA-deelbestanden
  const sub = { ...ctx, P, loc, vandaag, zorgTaken, pdaOverzicht, LOCATIES, ROLLEN, INCIDENT_SOORTEN };
  const api = { pdaOverzicht, PDA_LOCATIES: LOCATIES, PDA_ROLLEN: ROLLEN };
  Object.assign(api, require('./vloer')(sub));
  Object.assign(api, require('./bode')(sub));
  return api;
};
