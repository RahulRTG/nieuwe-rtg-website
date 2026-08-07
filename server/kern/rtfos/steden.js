/* Foundation OS, deel "steden": de organisatieboom en de stadsafdelingen.

   DE BOOM. RTF Internationaal > RTF Nederland > de steden. Die eerste twee zijn
   geen rijen in een tabel maar de vaste ruggengraat van de stichting; ze staan
   hier als constante, want een landelijke laag die je per ongeluk kunt
   verwijderen is geen governance.

   WAT EEN STAD ZELF DOET, EN WAT NOOIT. Een stad heeft een eigen kernteam,
   eigen partners, projecten, budgetten en rapportages. Wat de stad NIET zelf
   doet: zichzelf activeren, zijn eigen goedkeuringslimiet verhogen, een module
   aanzetten of een andere stad bekijken. Dat zijn precies de vier knoppen die
   het landelijke toezicht dragen, en ze staan daarom alle vier achter
   `w.landelijk`.

   DE LIMIET KAN ALLEEN OMLAAG. Een stad mag zijn eigen drempel verlagen (meer
   ogen op minder geld is altijd goed), nooit verhogen. Dat is niet aan een
   waarschuwing opgehangen maar aan een Math.min in basis.js: ook als hier ooit
   een te hoog getal belandt, rekent de goedkeuring met de landelijke bovengrens. */

const STATUS = ['verkend', 'in_oprichting', 'actief', 'geblokkeerd', 'beeindigd'];

module.exports = (ctx) => {
  const { nu, rid, schoon, S, audit, wie, rolIn, bereik, stadVan, limietVan,
    VLAGGEN, ROLLEN, LIMIET, euro } = ctx;
  const save = ctx.save;

  const kort = s => ({ id: s.id, naam: s.naam, land: s.land, status: s.status,
    vlaggen: s.vlaggen || [], sinds: s.sinds });

  function tel(stadId) {
    const s = S();
    return {
      partners: s.partners.filter(p => p.stad === stadId).length,
      projecten: s.projecten.filter(p => p.stad === stadId).length,
      vrijwilligers: s.vrijwilligers.filter(v => v.stad === stadId && v.status === 'actief').length,
      casussen: s.casussen.filter(c => c.stad === stadId && c.status !== 'afgerond').length
    };
  }

  /* De boom zoals het bestuur hem ziet. Wie geen landelijke zetel heeft, ziet
     alleen de takken waar hij zelf op zit -- de boom verraadt anders in een
     oogopslag hoeveel steden er zijn en hoe groot ze zijn, en dat is voor een
     lokale partner geen informatie maar een inkijkje. */
  function boom(req) {
    const w = wie(req);
    const mag = new Set(bereik(w));
    const steden = S().steden.filter(s => mag.has(s.id));
    return { ok: true, landelijk: w.landelijk, ingelogd: !!w.key,
      wortel: { naam: 'RTF Internationaal', laag: 'internationaal' },
      land: { naam: 'RTF Nederland', laag: 'landelijk', steden: steden.length },
      vlaggen: VLAGGEN, rollen: ROLLEN, statussen: STATUS,
      limieten: { projectleider: euro(LIMIET.projectleider), stadsbestuur: euro(LIMIET.stadsbestuur) },
      steden: steden.map(s => Object.assign(kort(s), { rol: rolIn(w, s.id), tellers: tel(s.id) })) };
  }

  function stad(req, id) {
    const w = wie(req);
    const p = ctx.poort(w, id, 'stad.lezen');
    if (!p.ok) return p;
    const s = p.stad;
    return { ok: true, rol: rolIn(w, s.id), stad: Object.assign(kort(s), {
      kernteam: (s.kernteam || []), limieten: {
        projectleider: euro(limietVan(s, 'projectleider')),
        stadsbestuur: euro(limietVan(s, 'stadsbestuur'))
      },
      gemeente: s.gemeente || null, tellers: tel(s.id),
      zetels: S().zetels.filter(z => z.stad === s.id).map(z => ({ id: z.id, key: z.key, naam: z.naam, rol: z.rol }))
    }) };
  }

  /* ---------- de landelijke knoppen ---------- */
  function stadMaak(req, b) {
    const w = wie(req);
    if (!w.landelijk) return { status: 403, error: 'Alleen het landelijke RTF-bestuur opent een stadsafdeling.' };
    b = b || {};
    const naam = schoon(b.naam, 60);
    if (naam.length < 2) return { status: 400, error: 'Welke stad?' };
    if (S().steden.some(s => s.naam.toLowerCase() === naam.toLowerCase())) {
      return { status: 400, error: 'RTF ' + naam + ' bestaat al.' };
    }
    if (S().steden.length >= 500) return { status: 400, error: 'Het stedenregister zit vol.' };
    const s = { id: rid(), naam, land: schoon(b.land, 40) || 'Nederland', status: 'verkend',
      vlaggen: ['city_projects'], kernteam: [], limieten: {}, gemeente: null, sinds: nu() };
    S().steden.push(s);
    audit(w.key, 'stad.maak', 'RTF ' + naam, 'status verkend');
    save();
    return { ok: true, stad: kort(s) };
  }

  function stadStatus(req, id, status) {
    const w = wie(req);
    if (!w.landelijk) return { status: 403, error: 'Een stad activeren of blokkeren doet het landelijke bestuur.' };
    const s = stadVan(id);
    if (!s) return { status: 404, error: 'Deze stadsafdeling bestaat niet.' };
    const st = String(status || '');
    if (!STATUS.includes(st)) return { status: 400, error: 'Kies een geldige status (' + STATUS.join(', ') + ').' };
    const oud = s.status;
    s.status = st;
    audit(w.key, 'stad.status', 'RTF ' + s.naam, oud + ' -> ' + st);
    save();
    return { ok: true, stad: kort(s) };
  }

  function vlagZet(req, id, vlag, aan) {
    const w = wie(req);
    if (!w.landelijk) return { status: 403, error: 'Modules aan- of uitzetten doet het landelijke bestuur.' };
    const s = stadVan(id);
    if (!s) return { status: 404, error: 'Deze stadsafdeling bestaat niet.' };
    const v = String(vlag || '');
    if (!VLAGGEN.includes(v)) return { status: 400, error: 'Deze module kennen we niet.' };
    if (!Array.isArray(s.vlaggen)) s.vlaggen = [];
    const had = s.vlaggen.includes(v);
    if (aan === true && !had) s.vlaggen.push(v);
    if (aan !== true && had) s.vlaggen = s.vlaggen.filter(x => x !== v);
    audit(w.key, 'stad.module', 'RTF ' + s.naam, v + ' ' + (aan === true ? 'aan' : 'uit'));
    save();
    return { ok: true, stad: kort(s) };
  }

  /* De limiet. Hij mag omlaag; een poging omhoog wordt niet stil afgekapt maar
     geweigerd met de reden erbij, anders denkt een stadsbestuur dat het meer
     ruimte heeft dan het heeft (LAT.md regel 5). */
  function limietZet(req, id, rol, bedrag) {
    const w = wie(req);
    const s = stadVan(id);
    if (!s) return { status: 404, error: 'Deze stadsafdeling bestaat niet.' };
    if (!w.landelijk) return { status: 403, error: 'Goedkeuringslimieten stelt het landelijke bestuur vast.' };
    const r = String(rol || '');
    if (!Object.prototype.hasOwnProperty.call(LIMIET, r)) return { status: 400, error: 'Voor deze rol bestaat geen limiet.' };
    const c = ctx.centen(bedrag);
    if (c === null) return { status: 400, error: 'Wat is het bedrag?' };
    if (c > LIMIET[r]) {
      return { status: 400, error: 'De landelijke bovengrens voor ' + r + ' is ' + euro(LIMIET[r]) +
        ' euro. Een stad kan die verlagen, niet verhogen.' };
    }
    if (!s.limieten || typeof s.limieten !== 'object') s.limieten = {};
    s.limieten[r] = c;
    audit(w.key, 'stad.limiet', 'RTF ' + s.naam, r + ' -> ' + euro(c) + ' euro');
    save();
    return { ok: true, limieten: { projectleider: euro(limietVan(s, 'projectleider')), stadsbestuur: euro(limietVan(s, 'stadsbestuur')) } };
  }

  /* De zetels (wie mag wat, in welke stad) staan in ./zetels.js. Dat is een
     eigen onderwerp -- het is de enige plek waar macht wordt uitgedeeld -- en
     dit bestand liep tegen de 10 KB van keuringsregel 13. */
  const zetels = require('./zetels')(ctx);

  function kernteamZet(req, id, namen) {
    const w = wie(req);
    const p = ctx.poort(w, id, 'stad.beheren');
    if (!p.ok) return p;
    p.stad.kernteam = (Array.isArray(namen) ? namen : []).map(n => schoon(n, 60)).filter(Boolean).slice(0, 20);
    audit(w.key, 'stad.kernteam', 'RTF ' + p.stad.naam, p.stad.kernteam.length + ' leden');
    save();
    return { ok: true, kernteam: p.stad.kernteam };
  }

  return { boom, stad, stadMaak, stadStatus, vlagZet, limietZet,
    zetelZet: zetels.zetelZet, zetelWeg: zetels.zetelWeg, kernteamZet, STATUS };
};
module.exports.STATUS = STATUS;
