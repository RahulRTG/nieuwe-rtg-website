/* RTFoundation-gasten: de koppeling tussen een RTG-lid (oppas/familie) en een
   gezin, plus de gezinsagenda en de klusjes-met-sterren. Alles wat een
   gekoppelde gast mag lezen (belangrijke info, agenda, locaties) komt hier
   vandaan; meldingen bereiken de gast ook in de RTG-app (inbox + web-push via
   ctx.pushHook). Gemount vanuit foundation.js op de gedeelde context. */
module.exports = (ctx) => {
  const { router, G, eigenVeld, nu, save, rid, schoon, encS, decS,
    familieVan, sessieVan, isGast, locatiePubliek, oppasinfoPubliek } = ctx;

  const TIERNAAM = { rtg: 'RTG Pass', lifestyle: 'Lifestyle Pass', business: 'Business Pass' };
  function gastProfielen(code) {
    const g = G()[String(code || '').toUpperCase()];
    if (!g) return null;
    return { gezinNaam: g.naam, profielen: Object.values(g.profielen).filter(p => p.rol === 'gast').map(p => ({ id: p.id, naam: p.naam, avatar: p.avatar, kleur: p.kleur, gekoppeld: !!p.koppel })) };
  }
  function linkGast({ code, profielId, userId, tier, codenaam }) {
    const g = G()[String(code || '').toUpperCase()];
    if (!g) return { error: 'Dit gezin kennen we niet. Klopt de gezinscode?', status: 404 };
    const p = eigenVeld(g.profielen, profielId);
    if (!p) return { error: 'Dit profiel bestaat niet meer.', status: 404 };
    if (p.rol !== 'gast') return { error: 'Alleen een oppas- of familieprofiel kan aan een RTG-pas gekoppeld worden.', status: 403 };
    p.koppel = { userId, tier, tierNaam: TIERNAAM[tier] || 'RTG Pass', codenaam: codenaam || 'lid', at: nu() };
    save();
    return { ok: true, gezinNaam: g.naam, profielNaam: p.naam, tierNaam: p.koppel.tierNaam };
  }
  function unlinkGast({ userId, code, profielId }) {
    let n = 0;
    for (const g of Object.values(G())) for (const p of Object.values(g.profielen || {})) {
      if (p.koppel && p.koppel.userId === userId && (!code || g.code === String(code).toUpperCase()) && (!profielId || p.id === profielId)) { delete p.koppel; n++; }
    }
    if (n) save();
    return { ok: true, verwijderd: n };
  }
  function gekoppeldeGezinnen(userId) {
    const uit = [];
    for (const g of Object.values(G())) for (const p of Object.values(g.profielen || {})) {
      if (p.koppel && p.koppel.userId === userId) uit.push({ code: g.code, gezinNaam: g.naam, profielId: p.id, profielNaam: p.naam });
    }
    return uit;
  }
  // alles wat een gekoppelde oppas/familie mag lezen, klaar voor de RTG-app:
  // de belangrijke info (allergieen, eten, huisregels, noodnummers), de agenda,
  // en waar iedereen is. Precies de gast-functies van de RTFoundation-app.
  function gastOverzicht(userId) {
    const uit = [];
    for (const g of Object.values(G())) {
      const p = Object.values(g.profielen).find(x => x.koppel && x.koppel.userId === userId);
      if (!p) continue;
      const locaties = Object.values(g.locaties || {}).filter(l => g.profielen[l.pid])
        .sort((a, b) => (b.at || '').localeCompare(a.at || '')).map(l => locatiePubliek(l, p.id));
      uit.push({ code: g.code, gezinNaam: g.naam, profielNaam: p.naam, oppasinfo: oppasinfoPubliek(g), agenda: agendaPubliek(g), locaties });
    }
    return uit;
  }
  // het chat-/belkanaal van een gekoppeld gezin voor de RTG-app: het profieltoken
  // (de gast is dit profiel) + de leden om mee te chatten en te bellen
  function kanaalInfo(userId, code) {
    const g = G()[String(code || '').toUpperCase()];
    if (!g) return null;
    const p = Object.values(g.profielen).find(x => x.koppel && x.koppel.userId === userId);
    if (!p) return null;
    return {
      code: g.code, gezinNaam: g.naam, profielId: p.id, token: p.token,
      leden: Object.values(g.profielen).filter(x => x.id !== p.id).map(x => ({ id: x.id, naam: x.naam, avatar: x.avatar, kleur: x.kleur, rol: x.rol }))
    };
  }
  // de RTG-server hangt hier zijn web-push in, zodat een melding ook op de
  // telefoon van de gekoppelde oppas/familie binnenkomt (ook als de app dicht is).
  // De hook staat op de context, zodat ook de berichtenlaag hem kan gebruiken.
  function setPushHook(fn) { ctx.pushHook = fn; }

  // bezorg een gezinsmelding ook in de RTG-app (inbox + telefoonmelding) van gekoppelde gasten
  function bezorgAanGasten(g, bericht) {
    let accounts; try { accounts = require('./../accounts'); } catch (e) { return; }
    const ontvangers = Object.values(g.profielen).filter(p => p.rol === 'gast' && p.koppel && p.koppel.userId && p.id !== bericht.van && (bericht.naar === 'allen' || bericht.naar === p.id));
    const tekst = decS(bericht.tekst);
    for (const p of ontvangers) {
      try {
        const md = accounts.getMemberState(p.koppel.userId) || {};
        if (!Array.isArray(md.foundationMeldingen)) md.foundationMeldingen = [];
        md.foundationMeldingen.unshift({ id: rid(4), at: nu(), gezin: g.naam, code: g.code, profielNaam: p.naam, van: bericht.vanNaam, tekst, soort: bericht.soort, gelezen: false });
        md.foundationMeldingen = md.foundationMeldingen.slice(0, 40);
        accounts.saveMemberState(p.koppel.userId, md);
      } catch (e) { /* een gekoppelde gast minder bereikt: niet fataal */ }
      if (ctx.pushHook) {
        const kop = bericht.soort === 'hulp' ? '🆘 ' + g.naam : (bericht.soort === 'reis' ? '✈️ ' + g.naam : g.naam);
        try { ctx.pushHook(p.koppel.userId, { title: 'RTFoundation · ' + kop, body: (bericht.vanNaam ? bericht.vanNaam + ': ' : '') + tekst.slice(0, 120), tag: 'rtf-' + bericht.id }); } catch (e) {}
      }
    }
  }

  // een gekoppelde oppas/familie stuurt vanuit de RTG-app een bericht terug naar het gezin
  function berichtVanGast({ userId, code, tekst }) {
    const g = G()[String(code || '').toUpperCase()];
    if (!g) return { error: 'Dit gezin kennen we niet.', status: 404 };
    const p = Object.values(g.profielen).find(x => x.koppel && x.koppel.userId === userId);
    if (!p) return { error: 'Je bent niet (meer) aan dit gezin gekoppeld.', status: 403 };
    const schoonTekst = schoon(tekst, 800);
    if (!schoonTekst) return { error: 'Schrijf een bericht.', status: 400 };
    const b = { id: rid(3), van: p.id, vanNaam: p.naam, vanAvatar: p.avatar, naar: 'allen', soort: 'bericht', tekst: encS(schoonTekst), at: nu(), gelezenDoor: [p.id] };
    if (!g.berichten) g.berichten = [];
    g.berichten.unshift(b); g.berichten = g.berichten.slice(0, 200); save();
    bezorgAanGasten(g, b); // andere gekoppelde gasten krijgen het ook
    return { ok: true };
  }

  /* gezinsagenda: samen plannen. Het gezin voegt toe; iedereen (ook de oppas) mag
     de planning zien, zodat een oppas weet wat er die dag speelt. */
  router.post('/gezin/agenda', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const titel = schoon(req.body.titel, 80);
    if (!titel) return res.status(400).json({ error: 'Waar gaat het agendapunt over?' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.body.datum || '')) return res.status(400).json({ error: 'Kies een datum.' });
    const tijd = /^\d{2}:\d{2}$/.test(req.body.tijd || '') ? req.body.tijd : '';
    const wie = req.body.wie && s.g.profielen[req.body.wie] ? req.body.wie : '';
    if (!s.g.agenda) s.g.agenda = [];
    if (s.g.agenda.length >= 200) return res.status(400).json({ error: 'De agenda is vol. Haal eerst iets weg.' });
    const item = { id: rid(3), titel, datum: req.body.datum, tijd, wie, door: s.p.id, at: nu() };
    s.g.agenda.push(item); save();
    res.json({ ok: true, item });
  });
  router.post('/gezin/agenda/verwijder', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    s.g.agenda = (s.g.agenda || []).filter(a => a.id !== req.body.itemId); save();
    res.json({ ok: true });
  });
  function agendaPubliek(g) {
    const vandaag = new Date().toISOString().slice(0, 10);
    return (g.agenda || [])
      .map(a => ({ id: a.id, titel: a.titel, datum: a.datum, tijd: a.tijd, wie: a.wie, wieNaam: a.wie && g.profielen[a.wie] ? g.profielen[a.wie].naam : '', voorbij: a.datum < vandaag, vandaag: a.datum === vandaag }))
      .sort((a, b) => (a.datum + (a.tijd || '99:99')).localeCompare(b.datum + (b.tijd || '99:99')));
  }
  router.get('/gezin/:code/agenda', (req, res) => {
    const s = sessieVan(req, res); if (!s) return;
    res.json({ agenda: agendaPubliek(s.g), magBewerken: !isGast(s.p) });
  });

  /* klusjes en sterren: kinderen verdienen sterren met klusjes. Een ouder zet ze
     klaar en keurt ze goed; zo leren kinderen verantwoordelijkheid en groeit hun
     sterrensaldo (dat mooi aansluit op het spaarpotje). */
  function magKlus(s) { return ['beheerder', 'ouder'].includes(s.p.rol); }
  router.post('/gezin/klus', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    if (!magKlus(s)) return res.status(403).json({ error: 'Alleen een ouder of de beheerder kan klusjes klaarzetten.' });
    const titel = schoon(req.body.titel, 80);
    if (!titel) return res.status(400).json({ error: 'Wat is het klusje?' });
    const sterren = Math.max(1, Math.min(20, Math.round(Number(req.body.sterren) || 1)));
    const voor = req.body.voor && s.g.profielen[req.body.voor] ? req.body.voor : 'iedereen';
    if (!s.g.klussen) s.g.klussen = [];
    if (s.g.klussen.length >= 100) return res.status(400).json({ error: 'Er staan al veel klusjes. Rond er eerst een paar af.' });
    const k = { id: rid(3), titel, sterren, voor, status: 'open', doorPid: '', at: nu() };
    s.g.klussen.unshift(k); save();
    res.json({ ok: true, klus: k });
  });
  router.post('/gezin/klus/gedaan', (req, res) => {
    const s = sessieVan(req, res); if (!s) return;
    if (isGast(s.p)) return res.status(403).json({ error: 'Een oppas kan geen klusjes afvinken.' });
    const k = (s.g.klussen || []).find(x => x.id === req.body.klusId);
    if (!k) return res.status(404).json({ error: 'Klusje niet gevonden.' });
    if (k.voor !== 'iedereen' && k.voor !== s.p.id) return res.status(403).json({ error: 'Dit klusje is voor iemand anders.' });
    if (k.status === 'goedgekeurd') return res.status(400).json({ error: 'Dit klusje is al afgerond.' });
    k.status = 'gedaan'; k.doorPid = s.p.id; save();
    res.json({ ok: true });
  });
  router.post('/gezin/klus/keur', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    if (!magKlus(s)) return res.status(403).json({ error: 'Alleen een ouder of de beheerder kan een klusje goedkeuren.' });
    const k = (s.g.klussen || []).find(x => x.id === req.body.klusId);
    if (!k) return res.status(404).json({ error: 'Klusje niet gevonden.' });
    if (k.status !== 'gedaan') return res.status(400).json({ error: 'Dit klusje is nog niet gedaan.' });
    if (req.body.goed === false) { k.status = 'open'; k.doorPid = ''; }
    else { k.status = 'goedgekeurd'; if (!s.g.sterren) s.g.sterren = {}; s.g.sterren[k.doorPid] = (s.g.sterren[k.doorPid] || 0) + k.sterren; }
    save();
    res.json({ ok: true });
  });
  router.post('/gezin/klus/verwijder', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    if (!magKlus(s)) return res.status(403).json({ error: 'Alleen een ouder of de beheerder kan dit.' });
    s.g.klussen = (s.g.klussen || []).filter(x => x.id !== req.body.klusId); save();
    res.json({ ok: true });
  });
  router.get('/gezin/:code/klussen', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const naamVan = pid => (s.g.profielen[pid] ? s.g.profielen[pid].naam : '');
    const klussen = (s.g.klussen || []).map(k => ({ id: k.id, titel: k.titel, sterren: k.sterren, voor: k.voor, voorNaam: k.voor === 'iedereen' ? 'iedereen' : naamVan(k.voor), status: k.status, door: k.doorPid ? naamVan(k.doorPid) : '', vanMij: k.doorPid === s.p.id }));
    const sterren = Object.entries(s.g.sterren || {}).filter(([pid]) => s.g.profielen[pid])
      .map(([pid, n]) => ({ pid, naam: s.g.profielen[pid].naam, avatar: s.g.profielen[pid].avatar, kleur: s.g.profielen[pid].kleur, sterren: n }))
      .sort((a, b) => b.sterren - a.sterren);
    res.json({ klussen, sterren, magBeheren: magKlus(s), mijnId: s.p.id });
  });

  return { gastProfielen, linkGast, unlinkGast, gekoppeldeGezinnen, gastOverzicht, kanaalInfo, setPushHook, bezorgAanGasten, berichtVanGast };
};
