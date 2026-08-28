/* Living OS leest bestaande domeinen en bewaart zelf niets. Iedere bron houdt
   zijn eigen waarheid; een mislukte bron blijft zichtbaar als fouttoestand. */
(function (w) {
  'use strict';
  function token() { try { return localStorage.getItem('rtg_member_token'); } catch (e) { return null; } }
  async function post(pad, body) {
    var t = token(), kop = { 'Content-Type': 'application/json' };
    if (t) kop.Authorization = 'Bearer ' + t;
    var r = await fetch(pad, { method: 'POST', headers: kop, body: JSON.stringify(body || {}) });
    var data = await r.json().catch(function () { return {}; });
    if (!r.ok) { var e = new Error(data.error || 'Deze bron antwoordde niet.'); e.status = r.status; throw e; }
    return data;
  }
  function dag(n) { var d = new Date(Date.now() + n * 86400000); return d.toISOString().slice(0, 10); }
  async function bron(naam, pad, body) {
    try { return { naam: naam, ok: true, data: await post(pad, body) }; }
    catch (e) { return { naam: naam, ok: false, status: e.status || 0, error: e.message }; }
  }
  async function laad() {
    if (!token()) return { ingelogd: false, gecontroleerd: new Date().toISOString(), bronnen: [] };
    var specs = [
      ['Privékantoor', '/api/member/bureau/overzicht', {}],
      ['Control Tower', '/api/member/bureau/tower', {}],
      ['Besluiten', '/api/member/bureau/zaken', {}],
      ['Mandaten', '/api/member/bureau/delegatie', {}],
      ['Geld', '/api/geld/cockpit', {}],
      ['Reizen', '/api/reis/wereld', {}],
      ['Agenda', '/api/agenda/bereik', { van: dag(0), tot: dag(90) }],
      ['Veiligheid', '/api/veiligheid/moment', {}]
    ];
    var bronnen = await Promise.all(specs.map(function (s) { return bron(s[0], s[1], s[2]); }));
    if (bronnen.length && bronnen.every(function (b) { return b.status === 401; }))
      return { ingelogd: false, sessieVerlopen: true, gecontroleerd: new Date().toISOString(), bronnen: [] };
    var uit = { ingelogd: true, gecontroleerd: new Date().toISOString(), bronnen: bronnen };
    bronnen.forEach(function (b) { uit[b.naam] = b.ok ? b.data : null; });
    return uit;
  }
  function beslis(id, akkoord) { return post('/api/member/bureau/zaak/beslis', { id: id, akkoord: akkoord === true }); }
  function vraag(q, context) { return post('/api/fluister', { q: q, context: context || { wereld: 'living' } }); }
  w.RTGLivingData = { laad: laad, beslis: beslis, vraag: vraag, token: token };
})(window);
