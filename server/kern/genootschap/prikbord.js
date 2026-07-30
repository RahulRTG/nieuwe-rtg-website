/* Genootschap (deelmodule): het prikbord. Berichten binnen een groep, met
   reacties en een peiling.

   Het verschil met een tijdlijn: een prikbord is EINDIG en van een plek. Er is
   geen algoritme dat kiest wat je ziet, geen oneindige aanvulling, en geen
   melding die je terughaalt. Je opent het prikbord als je wilt weten wat er
   speelt in dit genootschap, en dan ben je bij.

   Een peiling is bewust simpel: een vraag, hoogstens zes keuzes, een stem per
   lid, en de uitslag is altijd zichtbaar voor de leden. Geen anonieme peilingen
   in een besloten groep -- wie iets vindt in een gezelschap, zegt het daar. */
const { keur } = require('../veilig');

module.exports = ({ db, save, codenaamVan, liveCodename, notify, genootschap }) => {
  const TEKST_MAX = 800;
  const REACTIE_MAX = 300;
  const PER_GROEP = 300;           // begrensd venster per genootschap
  const PAGINA = 20;
  const nu = () => new Date().toISOString();

  const bord = (id) => {
    const g = genootschap.S();
    if (!Array.isArray(g.prikbord[id])) g.prikbord[id] = [];
    return g.prikbord[id];
  };

  function nieuwId(lijst) {
    let id = Date.now();
    while (lijst.some(x => x.id === id)) id++;
    return id;
  }

  const poort = (sess, groepId) => {
    const gr = genootschap.groepMet(groepId);
    if (!gr) return { error: 'Dit genootschap bestaat niet.' };
    if (!genootschap.isLid(gr, sess.key)) return { error: 'Je bent hier geen lid van.' };
    return { gr };
  };

  function plaats(sess, groepId, invoer) {
    const p = poort(sess, groepId);
    if (p.error) return p;
    const v = invoer || {};
    const tekst = String(v.tekst || '').trim().slice(0, TEKST_MAX);
    const keuzes = (Array.isArray(v.keuzes) ? v.keuzes : []).map(x => String(x || '').slice(0, 60).trim()).filter(Boolean).slice(0, 6);
    if (!tekst) return { error: 'Schrijf eerst iets.' };
    const k = keur(tekst); if (!k.ok) return { error: k.reden };
    for (const c of keuzes) { const kc = keur(c); if (!kc.ok) return { error: kc.reden }; }
    if (keuzes.length === 1) return { error: 'Een peiling met een keuze is geen peiling.' };

    const lijst = bord(groepId);
    const bericht = {
      id: nieuwId(lijst), vanKey: sess.key, tekst, at: nu(),
      reacties: [],
      peiling: keuzes.length ? { keuzes, stemmen: {} } : null
    };
    lijst.unshift(bericht);
    if (lijst.length > PER_GROEP) lijst.length = PER_GROEP;
    save();
    // de anderen een seintje, maar alleen de leden en alleen een keer
    try {
      if (notify) for (const l of (p.gr.leden || [])) {
        if (l.key !== sess.key) notify(l.key, 'Nieuw bericht op het prikbord van ' + p.gr.naam);
      }
    } catch (e) {}
    return { ok: true, bericht: publiek(bericht, sess) };
  }

  function weg(sess, groepId, id) {
    const p = poort(sess, groepId);
    if (p.error) return p;
    const lijst = bord(groepId);
    const i = lijst.findIndex(b => String(b.id) === String(id));
    if (i < 0) return { error: 'Dit bericht staat niet op het prikbord.' };
    const eigen = lijst[i].vanKey === sess.key;
    if (!eigen && !genootschap.isBeheer(p.gr, sess.key)) return { error: 'Dat mag je niet.' };
    lijst.splice(i, 1);
    save();
    return { ok: true };
  }

  function reageer(sess, groepId, id, tekst) {
    const p = poort(sess, groepId);
    if (p.error) return p;
    const b = bord(groepId).find(x => String(x.id) === String(id));
    if (!b) return { error: 'Dit bericht staat niet op het prikbord.' };
    const t = String(tekst || '').trim().slice(0, REACTIE_MAX);
    if (!t) return { error: 'Schrijf eerst iets.' };
    const k = keur(t); if (!k.ok) return { error: k.reden };
    if (!Array.isArray(b.reacties)) b.reacties = [];
    b.reacties.push({ id: nieuwId(b.reacties), vanKey: sess.key, tekst: t, at: nu() });
    if (b.reacties.length > 200) b.reacties = b.reacties.slice(-200);
    save();
    return { ok: true };
  }

  function reactieWeg(sess, groepId, id, reactieId) {
    const p = poort(sess, groepId);
    if (p.error) return p;
    const b = bord(groepId).find(x => String(x.id) === String(id));
    if (!b) return { error: 'Dit bericht staat niet op het prikbord.' };
    const i = (b.reacties || []).findIndex(r => String(r.id) === String(reactieId));
    if (i < 0) return { error: 'Deze reactie bestaat niet.' };
    const eigen = b.reacties[i].vanKey === sess.key;
    if (!eigen && !genootschap.isBeheer(p.gr, sess.key)) return { error: 'Dat mag je niet.' };
    b.reacties.splice(i, 1);
    save();
    return { ok: true };
  }

  /* Stemmen op een peiling. Een stem per lid, en je mag hem verzetten: van
     mening veranderen is geen fout. */
  function stem(sess, groepId, id, keuze) {
    const p = poort(sess, groepId);
    if (p.error) return p;
    const b = bord(groepId).find(x => String(x.id) === String(id));
    if (!b || !b.peiling) return { error: 'Hier is geen peiling.' };
    const i = Number(keuze);
    if (!Number.isInteger(i) || i < 0 || i >= b.peiling.keuzes.length) return { error: 'Deze keuze bestaat niet.' };
    b.peiling.stemmen[sess.key] = i;
    save();
    return { ok: true, uitslag: uitslagVan(b.peiling, sess) };
  }

  const uitslagVan = (peiling, sess) => {
    const tel = peiling.keuzes.map(() => 0);
    for (const k of Object.keys(peiling.stemmen || {})) {
      const i = peiling.stemmen[k];
      if (tel[i] !== undefined) tel[i]++;
    }
    return {
      keuzes: peiling.keuzes.map((naam, i) => ({ naam, aantal: tel[i] })),
      totaal: Object.keys(peiling.stemmen || {}).length,
      mijnStem: sess && peiling.stemmen ? (peiling.stemmen[sess.key] === undefined ? null : peiling.stemmen[sess.key]) : null
    };
  };

  const publiek = (b, sess) => ({
    id: b.id, van: codenaamVan(b.vanKey), tekst: b.tekst, at: b.at,
    vanMij: !!(sess && b.vanKey === sess.key),
    reacties: (b.reacties || []).map(r => ({ id: r.id, van: codenaamVan(r.vanKey), tekst: r.tekst, at: r.at,
      vanMij: !!(sess && r.vanKey === sess.key) })),
    peiling: b.peiling ? uitslagVan(b.peiling, sess) : null
  });

  /* Het prikbord lezen, met paginering op `na` net als in De Salon. Onderaan
     staat "je bent bij", niet een scroll die zichzelf aanvult. */
  function lees(sess, groepId, opties) {
    const p = poort(sess, groepId);
    if (p.error) return p;
    const o = opties || {};
    let lijst = bord(groepId);
    const totaal = lijst.length;
    if (o.na != null) {
      const i = lijst.findIndex(b => String(b.id) === String(o.na));
      lijst = i >= 0 ? lijst.slice(i + 1) : lijst;
    }
    const bladzijde = lijst.slice(0, PAGINA);
    return {
      ok: true, groep: genootschap.publiek(p.gr, sess.key),
      berichten: bladzijde.map(b => publiek(b, sess)),
      totaal, meer: lijst.length > bladzijde.length,
      volgende: bladzijde.length ? bladzijde[bladzijde.length - 1].id : null
    };
  }

  // Ruwe tekst van het prikbord, voor de AI-samenvatting (kern/genootschap/ai.js).
  const regels = (groepId, hoeveel) => bord(groepId).slice(0, hoeveel || 60)
    .map(b => codenaamVan(b.vanKey) + ': ' + b.tekst +
      ((b.reacties || []).length ? ' [' + b.reacties.length + ' reacties]' : ''));

  return { plaats, weg, reageer, reactieWeg, stem, lees, publiek, regels, PAGINA };
};
