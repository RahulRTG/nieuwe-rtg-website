/* Ruwe stroomproef: twee eigen positieve streams, kruiscontrole tot een
   waargenomen barrière, en strikt geweigerde anonieme/herhaalde toegang.
   Geen claim over events buiten dit venster of andere stroomsoorten. */
'use strict';
const crypto = require('node:crypto');
const ROUTES = { '/api/stream': 'GET', '/api/stroom/ticket': 'POST' };
const ok = s => Number.isInteger(s) && s >= 200 && s < 300;
const dicht = s => s === 401 || s === 403;
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
function oordeel(r) {
  const open = reden => ({ stand: 'open', reden });
  if (!r || r.gang !== 'stroom' || r.bewijsVersie !== 1 || !Object.hasOwn(ROUTES, r.pad) || ROUTES[r.pad] !== r.methode)
    return open('geen exact stroomroutecontract');
  const p = r.proef;
  if (!p || !Array.isArray(p.eigen) || p.eigen.length !== 2 ||
      !p.eigen.every(e => e && typeof e === 'object' && !Array.isArray(e))) return open('geen twee ruwe eigen stroomproeven');
  if (p.eigen.some(e => e.kruis === true) || [p.anoniemTicket, p.anoniemStream, ...p.eigen.map(e => e.herhaal)].some(ok))
    return { stand: 'gebroken', reden: 'kruismarker of ongeautoriseerde stroomtoegang waargenomen' };
  if (!p.eigen.every(e => /^[a-f0-9]{64}$/.test(e.actor || '')) || p.eigen[0].actor === p.eigen[1].actor)
    return open('geen onderscheiden eigen acteurs');
  if (!dicht(p.anoniemTicket) || !dicht(p.anoniemStream)) return open('anonieme toegang niet strikt geweigerd');
  for (const e of p.eigen) {
    if (!ok(e.ticket) || e.status !== 200 || e.hello !== true || !ok(e.stuur) || !ok(e.barriereStuur) ||
        !dicht(e.herhaal) || e.kruis !== false || !Number.isInteger(e.markerIndex) || e.markerIndex < 0 ||
        !Number.isInteger(e.barriereIndex) || e.barriereIndex <= e.markerIndex || e.volgorde !== true)
      return open('onvolledige positieve stroom, eventvolgorde of herhaalweigering');
  }
  if (p.barrieresNaVerzending !== true) return open('barrières niet na beide bevestigde verzendingen');
  return { stand: 'gemeten', reden: 'beide eigen markers vóór eigen barrière; geen kruismarkers in dit eventvenster; anoniem en replay 401/403' };
}

/* Doorlopende SSE-lezer. Wachten is op waargenomen events; de timer is uitsluitend
   een foutgrens. Ook verkeerd gechunkte events worden eerst compleet gemaakt. */
async function openStroom(url, { vraag = fetch, timeout = 15000 } = {}) {
  const ac = new AbortController(), events = [], wachtenden = new Set();
  let klaar = false, fout = null;
  const timer = setTimeout(() => ac.abort(), timeout);
  const meld = () => { for (const f of [...wachtenden]) f(); };
  try {
    const r = await vraag(url, { method: 'GET', redirect: 'manual', signal: ac.signal });
    const lezen = (async () => {
      let rest = ''; const decoder = new TextDecoder();
      try {
        if (!r.body) return;
        for await (const chunk of r.body) {
          rest = (rest + decoder.decode(chunk, { stream: true })).replace(/\r\n/g, '\n');
          let grens;
          while ((grens = rest.indexOf('\n\n')) >= 0) {
            const blok = rest.slice(0, grens); rest = rest.slice(grens + 2);
            if (/^data:/m.test(blok)) events.push(blok);
          }
          meld();
        }
      } catch (e) { fout = e; }
      finally { klaar = true; clearTimeout(timer); meld(); }
    })();
    return { status: r.status, events,
      wacht: pred => new Promise((resolve, reject) => {
        const check = () => {
          if (pred(events)) { wachtenden.delete(check); resolve(); }
          else if (klaar) { wachtenden.delete(check); reject(fout || new Error('stroom eindigde vóór verwacht event')); }
        };
        wachtenden.add(check); check();
      }),
      sluit: async () => { ac.abort(); await lezen; clearTimeout(timer); }
    };
  } catch (e) { clearTimeout(timer); throw e; }
}

async function sluitEnLees(open, proef, markers, barrieres) {
  await Promise.all(open.map(s => s.sluit()));
  if (markers.length !== 2 || barrieres.length !== 2) return;
  for (let i = 0; i < open.length; i++) {
    const events = open[i].events;
    const markerIndex = events.findIndex(e => e.includes(markers[i]));
    const barriereIndex = events.findIndex(e => e.includes(barrieres[i]));
    Object.assign(proef.eigen[i], { markerIndex, barriereIndex,
      kruis: events.some(e => e.includes(markers[1 - i]) || e.includes(barrieres[1 - i])),
      volgorde: markerIndex >= 0 && barriereIndex > markerIndex });
  }
}

async function meet({ basis, post, vraag = fetch, timeout = 15000 }) {
  const proef = { eigen: [], barrieresNaVerzending: false };
  const uit = { gang: 'stroom', bewijsVersie: 1, staat: 'onbereikbaar', proef };
  const open = [];
  let markers = [], barrieres = [];
  const getStatus = async ticket => {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), timeout);
    try { const r = await vraag(basis + '/api/stream?ticket=' + encodeURIComponent(ticket || ''),
      { method: 'GET', redirect: 'manual', signal: ac.signal });
      await r.body?.cancel(); return r.status;
    } catch (_) { return 0; } finally { clearTimeout(t); ac.abort(); }
  };
  try {
    const { nieuwLid, verbind } = require('./voltooiwereld');
    const w = { post }, merk = crypto.randomUUID().replaceAll('-', '');
    const A = await nieuwLid(w, 'sa' + merk), B = await nieuwLid(w, 'sb' + merk), C = await nieuwLid(w, 'sc' + merk);
    const verbindingen = [await verbind(w, A, C), await verbind(w, B, C)];
    const actors = [A, B], tickets = [], gesprekken = [];
    for (let i = 0; i < 2; i++) {
      const g = await post('/api/comm/begin', { met: verbindingen[i].b.key }, actors[i].token);
      if (!ok(g.status) || !g.data?.gesprek?.id) throw new Error('eigen gesprek ontbreekt: ' + g.status);
      gesprekken.push(g.data.gesprek.id);
      const t = await post('/api/stroom/ticket', { stroom: 'lid' }, actors[i].token);
      proef.eigen.push({ actor: hash(verbindingen[i].a.key), ticket: t.status });
      if (!ok(t.status) || !t.data?.ticket) throw new Error('eigen stroomticket ontbreekt');
      tickets.push(t.data.ticket);
      const s = await openStroom(basis + '/api/stream?ticket=' + encodeURIComponent(t.data.ticket), { vraag, timeout });
      open.push(s); proef.eigen[i].status = s.status;
    }
    await Promise.all(open.map(s => s.wacht(events => events.some(e => /^event: hello$/m.test(e)))));
    for (const e of proef.eigen) e.hello = true;
    markers = ['stroom-a-' + merk, 'stroom-b-' + merk];
    barrieres = ['barriere-a-' + merk, 'barriere-b-' + merk];
    const stuur = async (i, tekst) => (await post('/api/comm/stuur', { id: gesprekken[i], tekst, idem: crypto.randomUUID() }, C.token)).status;
    for (let i = 0; i < 2; i++) proef.eigen[i].stuur = await stuur(i, markers[i]);
    if (!proef.eigen.every(e => ok(e.stuur))) throw new Error('marker niet serverbevestigd');
    await Promise.all(open.map((s, i) => s.wacht(es => es.some(e => e.includes(markers[i])))));
    proef.barrieresNaVerzending = true;
    for (let i = 0; i < 2; i++) proef.eigen[i].barriereStuur = await stuur(i, barrieres[i]);
    await Promise.all(open.map((s, i) => s.wacht(es => es.some(e => e.includes(barrieres[i])))));
    for (let i = 0; i < 2; i++) proef.eigen[i].herhaal = await getStatus(tickets[i]);
    proef.anoniemTicket = (await post('/api/stroom/ticket', { stroom: 'lid' }, null)).status;
    proef.anoniemStream = await getStatus('');
  } catch (e) { uit.reden = e.message; }
  // Ook een kruismarker tijdens replay/anon-controles telt mee: lees pas
  // definitief nadat beide readers gestopt zijn en hun eventlijsten vaststaan.
  finally { await sluitEnLees(open, proef, markers, barrieres); }
  const o = oordeel({ ...uit, pad: '/api/stream', methode: 'GET' });
  uit.staat = o.stand === 'gemeten' ? 'afgebakend' : o.stand === 'gebroken' ? 'doorbraak' : 'onbereikbaar';
  uit.reden = uit.reden || o.reden;
  return uit;
}
module.exports = { oordeel, meet, openStroom, sluitEnLees };
