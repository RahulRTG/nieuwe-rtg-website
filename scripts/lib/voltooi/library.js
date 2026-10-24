/* ============================================================================
   VOLTOOIPROEF: FOUNDATION LIBRARYOS (link:library, /apps/library.html).

   De belofte van het scherm: een maker begint een werk, legt het vast in
   onderdelen met revisies, maakt de afspraak en de rechten voor een solowerk
   vast, maakt een editie die niet meer verandert en geeft hem vrij, leest hem
   met een leesplek, bladwijzer en notitie, en verwerkt inhoudelijke feedback --
   zonder dat feedback stil een bestaande editie verandert.

   DE WERELD. De maker is de ouder van een gezin met een eigen RTG-account (de
   Library draait op de ledensessie); de andere ouder, met een eigen gezin, is de
   kruisproef. Elke schrijfactie draagt een operationId en de verwachte revisie
   van het werk, zoals cmd() in apps/library/app.js dat doet: daarop rust de
   dubbeltik en het afgebroken verzoek.
   ========================================================================== */
'use strict';
const { inloggen } = require('../voltooiwereld');
const { GEZINSWERELD, accountGezin } = require('../voltooigezin');

const CONTEXT = '/api/library/context';
const WORK_LIST = '/api/library/work/list';
const WORK_CREATE = '/api/library/work/create';
const WORK_GET = '/api/library/work/get';
const WORKSPACE = '/api/library/studio/workspace';
const REVISION_ADD = '/api/library/revision/add';
const AGREEMENT_PROPOSE = '/api/library/agreement/propose';
const AGREEMENT_ACCEPT = '/api/library/agreement/accept';
const RIGHTS_GRANT = '/api/library/rights/grant';
const EDITION_CREATE = '/api/library/edition/create';
const EDITION_FREEZE = '/api/library/edition/freeze';
const PREVIEW = '/api/library/publication/preview';
const CONSENT = '/api/library/publication/consent';
const CONFIRM = '/api/library/publication/confirm';
const READER_OPEN = '/api/library/reader/open';
const READER_STATE = '/api/library/reader/state';
const READER_PROGRESS = '/api/library/reader/progress';
const READER_BOOKMARK = '/api/library/reader/bookmark';
const READER_NOTE = '/api/library/reader/note';
const READER_SEARCH = '/api/library/reader/search';
const FEEDBACK_CREATE = '/api/library/feedback/create';
const FEEDBACK_LIST = '/api/library/feedback/list';
const FEEDBACK_DECIDE = '/api/library/feedback/decide';

const tel = (o) => Object.keys(o || {}).length;

async function loop(w, stap) {
  const merk = Date.now().toString(36);
  const maker = await accountGezin(w, 'library', { kind: true });
  const ander = await accountGezin(w, 'andermaker');
  let n = 0;
  const op = (s) => 'voltooi_library_' + (s || 'op') + '_' + merk + '_' + String(++n).padStart(4, '0');
  let tok = maker.token, workId = null, actor = null, nodeId = null, editionId = null;
  const work = async (t) => (await w.post(WORK_GET, { workId }, t || tok)).data || {};
  const cmd = async (pad, data, opId, t) => {
    const rev = ((await work(t)).work || {}).revision;
    return w.post(pad, { operationId: opId || op(), workId, expectedRevision: rev, data }, t || tok);
  };
  let readerRev = 0;
  const lees = async (pad, data, opId) => {
    const r = await w.post(pad, { operationId: opId || op('reader'), workId, editionId, expectedRevision: readerRev, data }, tok);
    if (r.status === 200 && r.data && typeof r.data.revision === 'number') readerRev = r.data.revision;
    return r;
  };
  const TITEL = 'Geschiedenis van De Wilg ' + merk;
  const TEKST = 'In 1953 stond het water tot aan de kerk; dit is wat de buurt zich herinnert. ' + merk;

  /* ---------------- voltooibaar ---------------- */
  await stap('voltooibaar', 'de maker begint een werk en ziet het onder Uw werken', async () => {
    actor = ((await w.post(CONTEXT, {}, tok)).data || {}).actorRef;
    const c = await w.post(WORK_CREATE, { operationId: op('work'), data: { title: TITEL, type: 'local-history', language: 'nl' } }, tok);
    workId = c.data && c.data.workId;
    const l = (((await w.post(WORK_LIST, {}, tok)).data) || {}).works || [];
    return { klopt: !!actor && c.status === 200 && l.some((x) => x.id === workId), ziet: 'maken ' + c.status + ', ' + l.length + ' werk(en) in de lijst' };
  });

  await stap('voltooibaar', 'de maker legt een hoofdstuk vast, en de studio toont het onderdeel met zijn tekst', async () => {
    const r = await cmd(REVISION_ADD, { kind: 'chapter', title: 'Het water', content: TEKST, changeSummary: 'Eerste vastlegging.' });
    nodeId = r.data && r.data.result && r.data.result.nodeId;
    const ws = (((await w.post(WORKSPACE, { workId }, tok)).data) || {}).workspace || {};
    return { klopt: r.status === 200 && (ws.nodes || []).length === 1 && JSON.stringify(ws).includes('In 1953'),
      ziet: 'revisie ' + r.status + ', ' + (ws.nodes || []).length + ' onderdeel in de studio' };
  });

  await stap('voltooibaar', 'de maker legt de solo-afspraak en de rechten vast, maakt een editie, bevriest hem en geeft hem vrij', async () => {
    const a = await cmd(AGREEMENT_PROPOSE, { parties: [actor], governance: 'Solowerk: de maker behoudt rechten; Foundation levert uitsluitend infrastructuur.',
      decisionRule: 'all-listed-approvers', amendmentRule: 'all-current-and-proposed-parties', departureRule: 'successor-agreement',
      editors: [actor], publisher: actor, requiredApprovers: [actor], rightsHolders: [actor] });
    const ag = a.data && a.data.result;
    const acc = await cmd(AGREEMENT_ACCEPT, { agreementId: ag && ag.id, partyRef: actor, termsHash: ag && ag.termsHash });
    const g = await cmd(RIGHTS_GRANT, { grantor: actor, grantee: actor, authorityBasis: { kind: 'rights-holder-declaration',
      statement: 'Ik verklaar bevoegd te zijn om dit solowerk te publiceren.' }, scope: { type: 'work', id: workId }, actions: ['publish'],
      purpose: 'publication', languages: ['nl'], territories: ['WORLD'], startsAt: new Date().toISOString(), endsAt: null, conditions: { attributionRequired: false } });
    const e = await cmd(EDITION_CREATE, { language: 'nl', territory: 'WORLD', changeSummary: 'Eerste editie.' });
    editionId = e.data && e.data.result && e.data.result.id;
    const f = await cmd(EDITION_FREEZE, { editionId });
    const p = (await w.post(PREVIEW, { workId, editionId }, tok)).data || {};
    const c = await cmd(CONSENT, { editionId, snapshotHash: p.snapshotHash, consentDigest: p.consentDigest });
    const p2 = (await w.post(PREVIEW, { workId, editionId }, tok)).data || {};
    const r = await cmd(CONFIRM, { editionId, consentDigest: p2.consentDigest });
    const releases = Object.keys(((await work()).work || {}).releases || {}).length;
    const st = [a, acc, g, e, f, c, r].map((x) => x.status);
    return { klopt: st.every((s) => s === 200) && releases === 1, ziet: 'stappen ' + st.join('/') + ', ' + releases + ' vrijgave' };
  });

  await stap('voltooibaar', 'de maker leest de editie, zoekt erin, en bewaart een leesplek, een bladwijzer en een notitie', async () => {
    const o = await w.post(READER_OPEN, { workId, editionId }, tok);
    readerRev = ((await w.post(READER_STATE, { workId, editionId }, tok)).data || {}).revision || 0;
    const z = (((await w.post(READER_SEARCH, { workId, editionId, query: 'water' }, tok)).data) || {}).matches || [];
    const p = await lees(READER_PROGRESS, { nodeId, fraction: 1 });
    const b = await lees(READER_BOOKMARK, { nodeId, label: 'Het water' });
    const no = await lees(READER_NOTE, { nodeId, content: 'Navragen bij de buurvrouw ' + merk });
    const s = (((await w.post(READER_STATE, { workId, editionId }, tok)).data) || {}).state || {};
    return { klopt: o.status === 200 && z.length >= 1 && [p, b, no].every((x) => x.status === 200) &&
      s.progress && s.progress.fraction === 1 && tel(s.bookmarks) === 1 && tel(s.notes) === 1,
      ziet: 'openen ' + o.status + ', ' + z.length + ' treffer(s), leesplek ' + (s.progress && s.progress.fraction) + ', ' + tel(s.bookmarks) + ' bladwijzer, ' + tel(s.notes) + ' notitie' };
  });

  await stap('voltooibaar', 'feedback op de editie komt bij de maker, die hem aanneemt -- en de vrijgegeven editie verandert niet', async () => {
    const voor = JSON.stringify((((await work()).work || {}).editions || {})[editionId] || {});
    const f = await cmd(FEEDBACK_CREATE, { editionId, nodeId, kind: 'source', message: 'Het jaartal klopt, maar noem de bron.', evidenceRefs: [] });
    const fid = f.data && f.data.result && f.data.result.id;
    const d = await cmd(FEEDBACK_DECIDE, { feedbackId: fid, decision: 'accepted', reason: 'Terecht.' });
    const l = (((await w.post(FEEDBACK_LIST, { workId, editionId }, tok)).data) || {}).feedback || [];
    const na = JSON.stringify((((await work()).work || {}).editions || {})[editionId] || {});
    return { klopt: f.status === 200 && d.status === 200 && l.length === 1 && l[0].status === 'accepted' && voor === na,
      ziet: 'feedback ' + f.status + ', besluit ' + d.status + ', stand ' + (l[0] && l[0].status) + ', editie ' + (voor === na ? 'onveranderd' : 'VERANDERD') };
  });

  /* Bevoegdheid. */
  await stap('bevoegd', 'bevoegdheid: zonder account geen werken, geen nieuw werk en geen studio (401)', async () => {
    const l = await w.post(WORK_LIST, {});
    const c = await w.post(WORK_CREATE, { operationId: op('anon'), data: { title: 'Anoniem', type: 'book', language: 'nl' } });
    const s = await w.post(WORKSPACE, { workId });
    return { klopt: l.status === 401 && c.status === 401 && s.status === 401, ziet: 'lijst ' + l.status + ', maken ' + c.status + ', studio ' + s.status };
  });

  await stap('bevoegd', 'bevoegdheid: een maker uit een ander gezin ziet het werk niet en schrijft er niets in', async () => {
    const g = await w.post(WORK_GET, { workId }, ander.token);
    const s = await w.post(WORKSPACE, { workId }, ander.token);
    const r = await w.post(REVISION_ADD, { operationId: op('vreemd'), workId, expectedRevision: ((await work()).work || {}).revision,
      data: { kind: 'chapter', title: 'Erin', content: 'Van een ander', changeSummary: 'x' } }, ander.token);
    const l = (((await w.post(WORK_LIST, {}, ander.token)).data) || {}).works || [];
    return { klopt: [g.status, s.status, r.status].every((c) => c === 403 || c === 404) && !l.some((x) => x.id === workId) && w.vindInOpslag('Van een ander').length === 0,
      ziet: 'ander: lezen ' + g.status + ', studio ' + s.status + ', schrijven ' + r.status + ', in zijn lijst ' + l.some((x) => x.id === workId) };
  });

  await stap('bevoegd', 'bevoegdheid: het kind van het gezin heeft geen eigen account en opent de Library niet met zijn gezinssessie', async () => {
    const l = await w.post(WORK_LIST, {}, maker.kind.token);
    const g = await w.post(WORK_GET, { workId, code: maker.kind.code, token: maker.kind.token });
    return { klopt: l.status === 401 && g.status === 401, ziet: 'kindertoken ' + l.status + ', code+token ' + g.status };
  });

  /* ---------------- persistent ---------------- */
  await w.herstart();
  await stap('persistent', 'na een nette herstart staan het werk, de vrijgave en de leesplek er nog', async () => {
    const wk = (await work()).work || {};
    const s = (((await w.post(READER_STATE, { workId, editionId }, tok)).data) || {}).state || {};
    return { klopt: wk.title === TITEL && Object.keys(wk.releases || {}).length === 1 && s.progress && s.progress.fraction === 1 && tel(s.notes) === 1,
      ziet: 'werk ' + (wk.title ? 'er' : 'weg') + ', ' + Object.keys(wk.releases || {}).length + ' vrijgave, leesplek ' + (s.progress && s.progress.fraction) };
  });

  await stap('persistent', 'een read-only lezer vindt de tekst van het hoofdstuk en de notitie in de opslag', async () => {
    const t = w.vindInOpslag('In 1953 stond het water'), nt = w.vindInOpslag('Navragen bij de buurvrouw ' + merk);
    return { klopt: t.length > 0 && nt.length > 0, ziet: 'tekst in ' + [...new Set(t.map((p) => p.bestand + (p.sleutel ? ':' + p.sleutel : '')))].join(', ') + ', notitie in ' + nt.length };
  });

  await stap('persistent', 'na de herstart logt de maker opnieuw in en ziet in een nieuwe sessie hetzelfde werk', async () => {
    tok = await inloggen(w, maker);
    const l = (((await w.post(WORK_LIST, {}, tok)).data) || {}).works || [];
    return { klopt: l.some((x) => x.id === workId), ziet: 'nieuwe sessie: ' + l.length + ' werk' };
  });

  /* ---------------- herstelbaar ---------------- */
  await stap('herstelbaar', 'een dubbele tik op Werk beginnen met dezelfde operatie maakt een werk', async () => {
    const lijf = { operationId: op('dubbel'), data: { title: 'Dubbel ' + merk, type: 'book', language: 'nl' } };
    const [a, b] = await w.dubbel(WORK_CREATE, lijf, tok);
    const l = ((((await w.post(WORK_LIST, {}, tok)).data) || {}).works || []).filter((x) => x.title === 'Dubbel ' + merk);
    return { klopt: [a.status, b.status].includes(200) && l.length === 1, ziet: 'tikken ' + a.status + '/' + b.status + ', ' + l.length + ' werk' };
  });

  await stap('herstelbaar', 'een dubbele tik op Nieuwe revisie bewaren legt een revisie vast', async () => {
    const rev = ((await work()).work || {}).revision;
    const lijf = { operationId: op('rev'), workId, expectedRevision: rev, data: { nodeId, title: 'Het water', content: TEKST + ' Bron: kerkarchief.', changeSummary: 'Bron toegevoegd.' } };
    const [a, b] = await w.dubbel(REVISION_ADD, lijf, tok);
    const revs = ((((await work()).work || {}).nodes || {})[nodeId] || {}).revisions || [];
    return { klopt: [a.status, b.status].includes(200) && revs.length === 2, ziet: 'tikken ' + a.status + '/' + b.status + ', ' + revs.length + ' revisies' };
  });

  await stap('herstelbaar', 'een afgebroken bladwijzer en daarna opnieuw met dezelfde operatie: een bladwijzer erbij', async () => {
    const opId = op('half');
    const vr = (await w.post(READER_STATE, { workId, editionId }, tok)).data || {};
    const voor = vr.state || {};
    readerRev = vr.revision;
    const half = await w.afgebroken(READER_BOOKMARK, { operationId: opId, workId, editionId, expectedRevision: readerRev, data: { nodeId, label: 'Halverwege' } }, tok);
    const opnieuw = await w.post(READER_BOOKMARK, { operationId: opId, workId, editionId, expectedRevision: readerRev, data: { nodeId, label: 'Halverwege' } }, tok);
    const na = ((((await w.post(READER_STATE, { workId, editionId }, tok)).data) || {}).state || {});
    const erbij = tel(na.bookmarks) - tel(voor.bookmarks);
    return { klopt: opnieuw.status === 200 && erbij === 1,
      ziet: 'afgebroken (' + (half.afgebroken ? 'client gaf op' : 'status ' + half.status) + '), opnieuw ' + opnieuw.status + ', +' + erbij + ' bladwijzer' };
  });

  await stap('herstelbaar', 'een crash direct na een revisie verliest hem niet, en dezelfde operatie opnieuw verdubbelt hem niet', async () => {
    const rev = ((await work()).work || {}).revision;
    const lijf = { operationId: op('crash'), workId, expectedRevision: rev, data: { kind: 'chapter', title: 'Na de vloed', content: 'Wat er daarna gebeurde. ' + merk, changeSummary: 'Tweede hoofdstuk.' } };
    const r = await w.post(REVISION_ADD, lijf, tok);
    await w.crash();
    const opnieuw = await w.post(REVISION_ADD, lijf, tok);
    const nodes = Object.values(((await work()).work || {}).nodes || {}).filter((x) => JSON.stringify(x).includes('Na de vloed'));
    return { klopt: r.status === 200 && opnieuw.status === 200 && nodes.length === 1,
      ziet: 'revisie ' + r.status + ', na SIGKILL opnieuw ' + opnieuw.status + (opnieuw.data && opnieuw.data.replay ? ' (herhaald)' : '') + ', ' + nodes.length + ' onderdeel' };
  });
}

module.exports = {
  functie: 'link:library',
  ingang: '/apps/library.html',
  persona: 'gezin',
  omgeving: GEZINSWERELD,
  belofte: 'een maker begint een werk, legt het vast in onderdelen met revisies, maakt afspraak en rechten vast, geeft een editie vrij die niet meer verandert, leest hem met leesplek, bladwijzer en notitie, en verwerkt feedback -- een ander of een kind kan er niets mee',
  grens: 'De proef loopt over de routes die het scherm aanroept, niet door het scherm zelf, en als solowerk: samenwerken met een tweede maker (uitnodigen, instemmen), terugtrekken en het onderwijsdeel lopen hier niet mee (dat doet test/library-http.test.js). Er is geen Redis of PostgreSQL in de wereld.',
  loop
};
