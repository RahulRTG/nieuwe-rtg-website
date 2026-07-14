/* Kern-module "zaak": de eigen mini-boardroom van elke leverancier. Drie delen:
   1. Functies: de zaak zet zijn eigen mogelijkheden aan/uit (bestellen,
      reserveren, bezorgen, mode-bezorging, Salon-marketing, gastchat). Waar er
      al een echte instelling bestaat (ordersOpen, reservationsOpen, bezorg.aan,
      modebezorg.aan) sturen we die aan, zodat de knop ook echt werkt; de rest
      staat in s.functies.
   2. HR: een momentopname van het team (ingeklokt, verlof/ziek, sollicitaties,
      vacatures) uit de bestaande data.
   3. Marketing: een momentopname van De Salon (volgers, posts, lopende deal).

   maakZaak(state) volgt het vaste kern-patroon. */

function maakZaak({ db, save, accounts }) {
  // s.functies: eigen aan/uit-vlaggen die geen bestaande instelling hebben.
  function zf(s, id) { return !(s.functies && s.functies[id] === false); }
  function sf(s, id, v) { if (!s.functies) s.functies = {}; s.functies[id] = v !== false; }

  // De capaciteiten per bedrijfstype. get/set praten met de echte instelling
  // als die bestaat (echt:true), anders met s.functies.
  const CAPS = [
    { id: 'orders', naam: 'Bestellen / orders', types: ['restaurant', 'bar', 'club', 'zzp'], echt: true,
      get: s => !(s.settings && s.settings.ordersOpen === false), set: (s, v) => { s.settings = s.settings || {}; s.settings.ordersOpen = v; } },
    { id: 'reserveren', naam: 'Reserveren', types: ['restaurant', 'bar', 'club'], echt: true,
      get: s => !(s.settings && s.settings.reservationsOpen === false), set: (s, v) => { s.settings = s.settings || {}; s.settings.reservationsOpen = v; } },
    { id: 'bezorgen', naam: 'Bezorgen (ophaal/bezorg)', types: ['restaurant', 'bar', 'club', 'zzp'], echt: true,
      get: s => !!(s.bezorg && s.bezorg.aan), set: (s, v) => { s.bezorg = s.bezorg || { producten: [] }; s.bezorg.aan = v; } },
    { id: 'modebezorg', naam: 'Veilige mode-bezorging', types: ['retail'], echt: true,
      get: s => !!(s.modebezorg && s.modebezorg.aan), set: (s, v) => { s.modebezorg = s.modebezorg || {}; s.modebezorg.aan = v; } },
    { id: 'salon', naam: 'Salon-marketing (posten)', types: '*', echt: false, get: s => zf(s, 'salon'), set: (s, v) => sf(s, 'salon', v) },
    { id: 'gastchat', naam: 'Gastchat', types: ['hotel', 'apartment', 'restaurant', 'bar', 'club'], echt: false, get: s => zf(s, 'gastchat'), set: (s, v) => sf(s, 'gastchat', v) }
  ];
  const OP_ID = Object.fromEntries(CAPS.map(c => [c.id, c]));
  function voorType(s) { return CAPS.filter(c => c.types === '*' || c.types.includes(s.type)); }

  // Staat deze functie aan voor deze zaak? (voor handhaving elders)
  function functieAan(s, id) { const c = OP_ID[id]; return c ? !!c.get(s) : true; }

  function functieLijst(s) {
    return voorType(s).map(c => ({ id: c.id, naam: c.naam, aan: !!c.get(s), echt: !!c.echt }));
  }
  function zet(s, id, aan) {
    const c = OP_ID[id];
    if (!c || !(c.types === '*' || c.types.includes(s.type))) return { status: 400, error: 'Deze functie hoort niet bij dit type zaak.' };
    c.set(s, aan !== false);
    save();
    return { status: 200, ok: true, functies: functieLijst(s) };
  }

  /* ---- HR-momentopname ---- */
  function hr(s) {
    const code = s.code;
    let team = [];
    try { team = accounts.listStaff(code).map(accounts.publicStaff); } catch (e) {}
    const klok = (db.data.klok && db.data.klok[code]) || {};
    const ingeklokt = Object.values(klok).filter(k => k && k.in && !k.uit).length;
    const verlof = ((db.data.verlof && db.data.verlof[code]) || []).filter(v => v.status === 'aangevraagd' || v.status === 'open');
    const sollicitaties = ((db.data.applications && db.data.applications[code]) || []).filter(a => ['nieuw', 'aangevraagd', 'open'].includes(a.status));
    const vacatures = ((db.data.vacatures && db.data.vacatures[code]) || []).filter(v => v.open !== false);
    return {
      teamAantal: team.length, managers: team.filter(t => t.role === 'manager').length,
      ingeklokt, openVerlof: verlof.length, openSollicitaties: sollicitaties.length, openVacatures: vacatures.length,
      team: team.slice(0, 40)
    };
  }

  /* ---- Marketing-momentopname (De Salon) ---- */
  function marketing(s) {
    const posts = (db.data.posts || []).filter(p => p.partnerCode === s.code);
    const laatste = posts[0] || null;
    const deal = posts.find(p => p.deal) || null;
    const poll = posts.find(p => p.poll) || null;
    const salon = s.salon || {};
    return {
      volgers: (salon.volgers || []).length, bioIngevuld: !!(salon.bio && salon.bio.trim().length >= 15),
      fotoIngevuld: !!(salon.foto || (s.photos && s.photos.length)), posts: posts.length,
      laatstePost: laatste ? { text: String(laatste.text || '').slice(0, 80), at: laatste.at } : null,
      lopendeDeal: deal ? { titel: deal.deal.titel, claims: deal.deal.claims } : null,
      lopendePoll: poll ? { totaal: poll.poll.totaal } : null,
      salonActief: functieAan(s, 'salon')
    };
  }

  function board(s) {
    return { functies: functieLijst(s), hr: hr(s), marketing: marketing(s) };
  }

  return { ZAAK_CAPS: CAPS, zaakFunctieAan: functieAan, zaakFunctieLijst: functieLijst, zaakZet: zet, zaakHr: hr, zaakMarketing: marketing, zaakBoard: board };
}

module.exports = { maakZaak };
