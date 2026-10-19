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
