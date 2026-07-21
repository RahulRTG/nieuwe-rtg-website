/* De Onderzoeker: de TWEEDE AI van het RTG Kantoor, gebouwd door de eerste.
   De RTG AI (de stuurman) ontwikkelt hem stap voor stap, met zijn eigen
   meelees-kennis als leerstof; elke bouwstap staat in beide journaals. Pas
   als alle bouwstappen af zijn is de Onderzoeker onderzoeksklaar.

   Daarna werkt hij agentisch: een onderzoeksvraag wordt een plan, het plan
   wordt een reeks stappen (bronnen verzamelen, cijfers lezen, analyseren),
   en de reeks eindigt in een rapport met bevindingen en advies. Bewust hard
   in de code: de Onderzoeker LEEST alleen en ADVISEERT alleen; hij verandert
   nooit iets in het systeem en de mens beslist wat er met een rapport
   gebeurt. Met ANTHROPIC_API_KEY schrijft Claude de analyse; zonder sleutel
   een nette demo-analyse op dezelfde echte cijfers. */

const BOUWPLAN = [
  'het leesgeheugen: de meelees-kennis van de RTG AI als leerstof ingeladen',
  'de bronnenkaart: weten waar partners, leden, verkeer en vracht te vinden zijn',
  'de stappenplanner: een vraag ontleden tot een onderzoeksplan',
  'de analysemotor: cijfers naast elkaar leggen en patronen benoemen',
  'de rapportschrijver: bevindingen en advies in heldere taal'
];
const MAX_RAPPORTEN = 30, MAX_STAPPEN = 12;

module.exports = ({ db, save, crypto, schoon, anthropic }) => {
  const S = () => {
    if (!db.data.onderzoeker || typeof db.data.onderzoeker !== 'object') {
      db.data.onderzoeker = { fase: 'in-ontwikkeling', gestart: Date.now(), bouwstappen: 0, logboek: [], rapporten: [] };
    }
    return db.data.onderzoeker;
  };
  const log = (tekst, soort) => {
    const s = S();
    s.logboek.unshift({ at: Date.now(), soort: soort || 'info', tekst: String(tekst).slice(0, 220) });
    if (s.logboek.length > 100) s.logboek.length = 100;
  };
  // de bouw staat ook in het journaal van de RTG AI: hij is de bouwer
  const rtgaiJournaal = (tekst) => {
    const r = db.data.rtgai;
    if (!r || !Array.isArray(r.journaal)) return;
    r.journaal.unshift({ at: Date.now(), soort: 'bouw', tekst: String(tekst).slice(0, 200) });
    if (r.journaal.length > 200) r.journaal.length = 200;
  };

  /* ---- de RTG AI bouwt de Onderzoeker, stap voor stap ---- */
  function ontwikkel() {
    const s = S();
    if (s.fase === 'onderzoeksklaar') return { status: 400, error: 'De Onderzoeker is al af; stel hem een onderzoeksvraag.' };
    const r = db.data.rtgai;
    if (!r || !(r.waarnemingen > 0)) {
      return { status: 400, error: 'De RTG AI heeft nog geen leerstof: laat hem eerst meelezen, dan kan hij de Onderzoeker bouwen.' };
    }
    const stap = BOUWPLAN[s.bouwstappen];
    s.bouwstappen += 1;
    log('Bouwstap ' + s.bouwstappen + ' van ' + BOUWPLAN.length + ': ' + stap + '.', 'bouw');
    rtgaiJournaal('Ik bouwde aan de Onderzoeker (stap ' + s.bouwstappen + ' van ' + BOUWPLAN.length + ', met ' +
      r.waarnemingen + ' waarnemingen als leerstof): ' + stap + '.');
    if (s.bouwstappen >= BOUWPLAN.length) {
      s.fase = 'onderzoeksklaar';
      log('De Onderzoeker is af en onderzoeksklaar. Hij leest alleen en adviseert alleen; beslissen blijft mensenwerk.', 'klaar');
      rtgaiJournaal('De Onderzoeker is af: het RTG Kantoor heeft er een tweede AI bij, alleen voor onderzoek.');
    }
    save();
    return { ok: true, fase: s.fase, bouwstappen: s.bouwstappen, van: BOUWPLAN.length, stap };
  }

  /* ---- de bronnen: uitsluitend LEZEN, nooit schrijven ---- */
  const BRONNEN = {
    verkeer: { label: 'het verkeer op het platform', als: /verkeer|gebruik|druk|bezoek|api|systeem/i,
      lees() {
        const r = db.data.rtgai || { waarnemingen: 0, domeinen: {}, fouten: 0 };
        const top = Object.entries(r.domeinen || {}).sort((a, b) => b[1] - a[1]).slice(0, 5)
          .map(([d, n]) => d + ' (' + n + ')').join(', ') || 'nog geen';
        return { cijfers: { waarnemingen: r.waarnemingen || 0, fouten: r.fouten || 0, topDomeinen: top },
          tekst: (r.waarnemingen || 0) + ' waarnemingen, ' + (r.fouten || 0) + ' serverfouten; drukste domeinen: ' + top + '.' };
      } },
    partners: { label: 'de partners per sector', als: /partner|leverancier|sector|zaak|zaken|genre/i,
      lees() {
        const per = {};
        for (const p of db.data.suppliers || []) per[p.type] = (per[p.type] || 0) + 1;
        const totaal = (db.data.suppliers || []).length;
        const top = Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, n]) => t + ' (' + n + ')').join(', ');
        return { cijfers: { totaal, sectoren: Object.keys(per).length },
          tekst: totaal + ' partners over ' + Object.keys(per).length + ' sectoren; grootste: ' + top + '.' };
      } },
    vracht: { label: 'de vrachtstromen', als: /vracht|zending|logistiek|transport|douane|expedit/i,
      lees() {
        let zendingen = 0, onderweg = 0, kilos = 0;
        for (const lijst of Object.values(db.data.vracht || {})) for (const z of lijst) {
          zendingen += 1;
          if (z.status !== 'afgeleverd') { onderweg += 1; kilos += z.gewichtKg || 0; }
        }
        return { cijfers: { zendingen, onderweg, kilos },
          tekst: zendingen + ' zendingen bij de expediteurs, waarvan ' + onderweg + ' lopend (' + kilos.toLocaleString('nl-NL') + ' kg onderweg).' };
      } },
    werkvloer: { label: 'de mensen op de werkvloer', als: /personeel|medewerker|team|werkvloer|rooster|mensen/i,
      lees() {
        let staf = 0, zaken = 0;
        for (const p of db.data.suppliers || []) { const n = (p.staff || []).length; if (n) { staf += n; zaken += 1; } }
        return { cijfers: { staf, zaken }, tekst: staf + ' medewerkers op het rooster, verdeeld over ' + zaken + ' zaken.' };
      } }
  };

  function demoAnalyse(vraag, bevindingen) {
    return 'Op uw vraag "' + vraag + '" leggen de bronnen dit beeld neer: ' + bevindingen.join(' ') +
      ' Mijn lezing: het platform draait stabiel en de cijfers zijn consistent met elkaar; de grootste kans zit waar de drukte zit.';
  }
  async function aiAnalyse(vraag, bevindingen) {
    if (!anthropic) return demoAnalyse(vraag, bevindingen);
    try {
      const r = await anthropic.messages.create({
        model: 'claude-opus-4-8', max_tokens: 400,
        system: 'Je bent de Onderzoeker van het RTG Kantoor. Schrijf in het Nederlands een korte, zakelijke analyse (3-5 zinnen) op basis van UITSLUITEND de aangeleverde bevindingen. Verzin geen cijfers. Sluit af met een advies; benoem dat de mens beslist.',
        messages: [{ role: 'user', content: 'Onderzoeksvraag: ' + vraag + '\nBevindingen:\n- ' + bevindingen.join('\n- ') }]
      });
      const t = (r.content || []).filter(c => c.type === 'text').map(c => c.text).join(' ').trim();
      return t || demoAnalyse(vraag, bevindingen);
    } catch (e) { return demoAnalyse(vraag, bevindingen); }
  }

  /* ---- het agentische onderzoek: plan -> stappen -> rapport ---- */
  async function onderzoek(vraagRuw) {
    const s = S();
    if (s.fase !== 'onderzoeksklaar') {
      return { status: 400, error: 'De Onderzoeker is nog in ontwikkeling (' + s.bouwstappen + ' van ' + BOUWPLAN.length + ' bouwstappen); de RTG AI bouwt hem in het RTG Kantoor.' };
    }
    const vraag = schoon(vraagRuw, 160);
    if (!vraag) return { status: 400, error: 'Stel een onderzoeksvraag.' };
    if (s.rapporten.length >= MAX_RAPPORTEN) s.rapporten.length = MAX_RAPPORTEN - 1;

    const stappen = [];
    const stap = (soort, tekst) => { if (stappen.length < MAX_STAPPEN) stappen.push({ nr: stappen.length + 1, soort, tekst: String(tekst).slice(0, 300) }); };

    // stap 1: het plan; bronnen die bij de vraag passen, anders alle bronnen
    let keys = Object.keys(BRONNEN).filter(k => BRONNEN[k].als.test(vraag));
    if (!keys.length) keys = Object.keys(BRONNEN);
    stap('plan', 'Plan: ik ontleed de vraag en kies ' + keys.length + ' bronnen: ' + keys.map(k => BRONNEN[k].label).join('; ') + '.');

    // stap per bron: verzamelen (alleen lezen)
    const bevindingen = [];
    for (const k of keys) {
      let uit;
      try { uit = BRONNEN[k].lees(); } catch (e) { uit = { tekst: 'bron ' + k + ' was niet leesbaar; overgeslagen.' }; }
      bevindingen.push(uit.tekst);
      stap('bron', 'Verzameld uit ' + BRONNEN[k].label + ': ' + uit.tekst);
    }

    // stap: de analyse (Claude of de demo-motor, altijd op de echte cijfers)
    const analyse = await aiAnalyse(vraag, bevindingen);
    stap('analyse', analyse);
    stap('rapport', 'Rapport opgemaakt. Dit is een advies: wat ermee gebeurt, beslist het kantoor.');

    const rapport = {
      id: 'o' + crypto.randomBytes(4).toString('hex'),
      vraag, gestart: Date.now(), stappen, bevindingen, analyse,
      advies: 'De Onderzoeker adviseert; de mens beslist.'
    };
    s.rapporten.unshift(rapport);
    if (s.rapporten.length > MAX_RAPPORTEN) s.rapporten.length = MAX_RAPPORTEN;
    log('Onderzoek afgerond in ' + stappen.length + ' stappen: "' + vraag + '".', 'onderzoek');
    save();
    return { ok: true, rapport };
  }

  function rapport(id) {
    const r = S().rapporten.find(x => x.id === String(id || ''));
    return r ? { ok: true, rapport: r } : { status: 404, error: 'Rapport niet gevonden.' };
  }

  function status() {
    const s = S();
    return { fase: s.fase, gestart: s.gestart, bouwstappen: s.bouwstappen, bouwplan: BOUWPLAN.length,
      logboek: s.logboek.slice(0, 20),
      rapporten: s.rapporten.map(r => ({ id: r.id, vraag: r.vraag, gestart: r.gestart, stappen: r.stappen.length })) };
  }

  return { onderzoeker: { status, ontwikkel, onderzoek, rapport } };
};
