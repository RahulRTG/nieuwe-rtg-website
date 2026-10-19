/* ============================================================================
   DE GEZINSWERELD VAN DE VOLTOOIPROEF -- de opzet die de scenario's van
   FoundationOS delen (scripts/lib/voltooi/<naam>.js).

   EEN GEZIN HANGT AAN EEN ACCOUNT (eigenaarsbesluit 5 en 19 oktober 2026). De
   proef maakt het daarom zoals een ouder dat doet: een vers lid met een eigen
   RTG-account maakt zijn gezin via Mijn gezin (/api/rtf/eigen-gezin/maak), en
   krijgt de gezinssessie (code + token) terug die het scherm in localStorage
   zet. Een kind komt er pas bij als RTG het paspoort van de ouder heeft gezien
   (geverifieerdLid), langs /api/rtf/eigen-gezin/kind, en zijn sessie opent de
   ouder (/api/rtf/eigen-gezin/sessie). Nergens /gezin/maak met een pincode:
   dat is de anonieme ingang die onder de accountplicht doodloopt.

   GEZINSWERELD zet die accountplicht AAN (RTF_GEZIN_ACCOUNTPLICHT=1, dezelfde
   regel als productie, foundation/accountplicht.js) bovenop de kantoorwereld:
   zonder die vlag kent de testserver nog anonieme gezinnen, en dan bewijst een
   scenario iets over een deur die in productie dicht is.

   EEN OPEN STAD maakt het landelijke bestuur (de eigenaar van de testwereld)
   langs /api/rtfos/stad/maak en /stad/status, de routes van het kantoor. De
   seed kent geen stad, en de buurt-schermen tonen zonder stad alleen "nog
   niets open".
   ========================================================================== */
'use strict';
const { nieuwLid, geverifieerdLid, eigenaarSessie, KANTOORWERELD } = require('./voltooiwereld');

const GEZINSWERELD = Object.assign({ RTF_GEZIN_ACCOUNTPLICHT: '1' }, KANTOORWERELD);

/* `kind`: met een kinderprofiel (dan is de ouder een geverifieerd lid). Geeft
   het lid terug met `gezin` (code + token van de beheerder) en, met kind,
   `kind` (code + token van het kinderprofiel). Gooit met de stap erbij. */
async function accountGezin(w, merk, opties) {
  const o = opties || {};
  const lid = o.kind ? await geverifieerdLid(w, merk) : await nieuwLid(w, merk);
  const g = await w.post('/api/rtf/eigen-gezin/maak', { gezinsnaam: 'Gezin ' + merk, naam: 'Ouder ' + merk,
    bevoegdGezin: true, privacyAkkoord: true }, lid.token);
  if (g.status !== 200 || !g.data || !g.data.token) throw new Error('het gezin maken lukte niet (' + g.status + ': ' + (g.data && g.data.error) + ')');
  lid.gezin = { code: g.data.code, token: g.data.token, profielId: g.data.profiel && g.data.profiel.id };
  if (o.kind) {
    const k = await w.post('/api/rtf/eigen-gezin/kind', { naam: 'Kind ' + merk, geboortedatum: o.geboren || '2016-04-12' }, lid.token);
    const pid = k.data && k.data.profiel && k.data.profiel.id;
    if (k.status !== 200 || !pid) throw new Error('het kind toevoegen lukte niet (' + k.status + ': ' + (k.data && k.data.error) + ')');
    const s = await w.post('/api/rtf/eigen-gezin/sessie', { profielId: pid }, lid.token);
    if (s.status !== 200 || !s.data || !s.data.token) throw new Error('de kindersessie openen lukte niet (' + s.status + ')');
    lid.kind = { code: s.data.code, token: s.data.token, profielId: pid };
  }
  return lid;
}

/* Een RTF-stad met status actief, gemaakt door het landelijke bestuur. */
async function openStad(w, naam) {
  const K = await eigenaarSessie(w);
  const m = await w.post('/api/rtfos/stad/maak', { naam }, K);
  const id = m.data && m.data.stad && m.data.stad.id;
  if (m.status !== 200 || !id) throw new Error('de stad maken lukte niet (' + m.status + ')');
  const s = await w.post('/api/rtfos/stad/status', { id, status: 'actief' }, K);
  if (s.status !== 200) throw new Error('de stad activeren lukte niet (' + s.status + ')');
  return { id, naam, kantoor: K };
}

module.exports = { GEZINSWERELD, accountGezin, openStad };

/* Een ACTIEF project in die stad, langs de keten van het kantoor: idee,
   aanvraag, beoordeling, goedkeuring, actief (kern/rtfos/projecten-besluit.js).
   VIER OGEN: wie indient, keurt niet zelf goed. Een projectleider op naam (een
   lid dat de eigenaar als kantoormens uitnodigde, met een zetel in de stad)
   dient in; het landelijke bestuur keurt goed. */
async function projectleider(w, stad) {
  const lid = await nieuwLid(w, 'pl');
  const me = await w.post('/api/auth/me', {}, lid.token);
  const u = me.data && me.data.user;
  const uit = await w.post('/api/office/kantoor/uitnodiging', { codenaam: u && u.codename }, stad.kantoor);
  if (!uit.data || !uit.data.code) throw new Error('geen kantooruitnodiging (' + uit.status + ')');
  const k = await w.post('/api/account/koppel', { soort: 'kantoor', uitnodiging: uit.data.code }, lid.token);
  if (k.status !== 200) throw new Error('de kantoorrol koppelen lukte niet (' + k.status + ')');
  const s = await w.post('/api/account/start', { rol: 'kantoor' }, lid.token);
  if (!s.data || !s.data.token) throw new Error('de kantoordeur ging niet open (' + s.status + ')');
  const z = await w.post('/api/rtfos/zetel', { stad: stad.id, rol: 'projectleider', key: 'user-' + u.id, naam: 'Projectleider' }, stad.kantoor);
  if (z.status !== 200) throw new Error('de zetel toekennen lukte niet (' + z.status + ': ' + (z.data && z.data.error) + ')');
  return s.data.token;
}

async function actiefProject(w, stad, naam, soort) {
  const P = await projectleider(w, stad);
  const m = await w.post('/api/rtfos/project/maak', { stad: stad.id, naam, soort: soort || 'jongeren', budget: 0 }, P);
  const id = m.data && m.data.project && m.data.project.id;
  if (m.status !== 200 || !id) throw new Error('het project maken lukte niet (' + m.status + ': ' + (m.data && m.data.error) + ')');
  for (const [st, wie] of [['aanvraag', P], ['beoordeling', P], ['goedgekeurd', stad.kantoor], ['actief', P]]) {
    const r = await w.post('/api/rtfos/project/status', { id, status: st }, wie);
    if (r.status !== 200) throw new Error('het project naar ' + st + ' zetten lukte niet (' + r.status + ': ' + (r.data && r.data.error) + ')');
  }
  return { id, naam };
}

module.exports.actiefProject = actiefProject;

/* EEN LES, zoals Leren & Groei hem start (apps/foundation/leren-groei.js): de
   begeleider maakt hem met /les/maak en krijgt de docentensleutel en de
   lescode; een leerling doet mee met /les/join op die lescode. Beide sleutels
   zet het scherm in sessionStorage (rtf_docent, rtf_leerling). */
async function nieuweLes(w, vak, naam) {
  const r = await w.post('/api/foundation/les/maak', { vak, naam, idem: 'voltooi-les-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) });
  if (r.status !== 200 || !r.data || !r.data.token) throw new Error('de les maken lukte niet (' + r.status + ')');
  return { lesId: r.data.lesId, token: r.data.token, lescode: r.data.lescode };
}
async function doeMee(w, lescode, naam) {
  const r = await w.post('/api/foundation/les/join', { lescode, naam });
  if (r.status !== 200 || !r.data || !r.data.token) throw new Error('meedoen met de les lukte niet (' + r.status + ')');
  return { token: r.data.token, studentId: r.data.studentId, lesId: r.data.lesId };
}
/* De leesroutes van de les zijn GET met de sleutel als Bearer, zoals get() in
   bord.html en schrift.html. De wereld kent alleen POST; dit leest zonder dat
   het antwoord in bewijs 8 meetelt. */
async function haal(w, pad, tok) {
  const r = await fetch(w.basis + pad, { headers: tok ? { Authorization: 'Bearer ' + tok } : {} });
  return { status: r.status, data: await r.json().catch(() => null) };
}

module.exports.nieuweLes = nieuweLes;
module.exports.doeMee = doeMee;
module.exports.haal = haal;
