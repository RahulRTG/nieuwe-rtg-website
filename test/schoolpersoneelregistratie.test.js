/* De personeelsdeur van RTF School: alleen de directie nodigt uit, de link
   bewijst toegang tot het persoonlijke schoolmailadres en ieder geheim werkt
   precies een keer. De test kijkt ook naar de levensloop: rollen staan vóór
   toegang vast en intrekken sluit een bestaande sessiesleutel meteen. */
'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const os=require('os');
const path=require('path');
const { startServer }=require('./helper');

const TMP=fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-schoolpersoneel-'));
let BASE, child, D, FATIMA, KARIM;
const api=(pad, body) => fetch(BASE + '/api/foundation' + pad, {
  method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(body || {})
}).then(async r => ({ status:r.status, body:await r.json().catch(() => ({})) }));
const office=(pad, body, token) => fetch(BASE + '/api' + pad, {
  method:'POST', headers:{ 'Content-Type':'application/json', ...(token ? { Authorization:'Bearer ' + token } : {}) },
  body:JSON.stringify(body || {})
}).then(async r => ({ status:r.status, body:await r.json().catch(() => ({})) }));
const wacht=ms => new Promise(resolve => setTimeout(resolve, ms));
function post() {
  const map=path.join(TMP, 'outbox');
  if (!fs.existsSync(map)) return '';
  return fs.readdirSync(map).map(x => fs.readFileSync(path.join(map, x), 'utf8')).join('\n');
}
function laatste(soort) {
  const re=new RegExp('#' + soort + '=([A-Z0-9]{6}\\.[a-f0-9]{48})', 'ig');
  const alle=[...post().matchAll(re)];
  return alle.length ? alle[alle.length - 1][1] : null;
}

/* WACHTEN OP DE MAIL, NIET OP DE KLOK. Hier stond vijf keer `await wacht(80)`:
   de server schrijft de post asynchroon, en tachtig milliseconden was de gok.
   Te kort op een trage machine, en op een snelle weggegooide tijd -- plus vijf
   posten wachtschuld in KLOKWACHT.json. Dit kijkt tot de sleutel er ECHT is. */
async function wachtOpSleutel(soort, anders, opties) {
  const ms=(opties && opties.ms) || 8000;
  const tot=Date.now() + ms;
  while (Date.now() < tot) {
    const s=laatste(soort);
    if (s && s !== anders) return s;
    await new Promise(r => setTimeout(r, 20));
  }
  throw new Error('wachtte ' + ms + 'ms op een #' + soort + '-mail in de outbox, en die kwam niet.');
}

/* EN VOOR DE NEGATIEVE BEWERING een andere vorm, want "er komt niets" wordt niet
   waar door langer te wachten. Dit wacht tot de outbox STIL ligt -- drie
   metingen achter elkaar dezelfde inhoud -- en pas dan mag er iets over de
   afwezigheid worden beweerd. */
async function wachtOpStillePost(opties) {
  const ms=(opties && opties.ms) || 4000;
  const tot=Date.now() + ms;
  let vorig=null, stil=0;
  while (Date.now() < tot) {
    const nu=post();
    stil = nu === vorig ? stil + 1 : 0;
    if (stil >= 3) return;
    vorig=nu;
    await new Promise(r => setTimeout(r, 25));
  }
}

test.before(async () => {
  ({ child, base:BASE }=await startServer({ env:{ RTG_DATA_DIR:TMP, SMTP_URL:'', APP_URL:'https://rtf.test',
    RTG_MAIL_PUBLIEK_BASIS:'rahultravelgroup.com' } }));
  const sch=(await api('/school/school/maak', { naam:'De Veilige School', plaats:'Utrecht' })).body;
  const kantoor=(await office('/office/login', { code:'RTG-OFFICE' })).body.token;
  await office('/office/school/decide', { code:sch.schoolCode, action:'goedkeuren' }, kantoor);
  D={ schoolCode:sch.schoolCode, beheerToken:sch.beheerToken };
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (_) {}
  try { fs.rmSync(TMP, { recursive:true, force:true }); } catch (_) {}
});

test('directie-uitnodiging draagt de rol maar lekt geen activatiegeheim', async () => {
  const r=await api('/school/personeel/uitnodig', Object.assign({
    naam:'Fatima van HR', email:'fatima@veiligeschool.nl', rollen:['hr']
  }, D));
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.uitnodiging.rollen, ['hr']);
  assert.equal(r.body.personeelToken, undefined);
  assert.doesNotMatch(JSON.stringify(r.body), /[a-f0-9]{48}/i, 'het API-antwoord bevat geen linkgeheim');
  const sleutel=await wachtOpSleutel('uitnodiging');
  assert.ok(sleutel, 'de persoonlijke uitnodiging is naar de mail-outbox gestuurd');

  const bekeken=await api('/school/personeel/uitnodiging/bekijk', { uitnodiging:sleutel });
  assert.equal(bekeken.status, 200);
  assert.match(bekeken.body.uitnodiging.email, /^fa\*\*\*@veiligeschool\.nl$/);
  const actief=await api('/school/personeel/uitnodiging/accepteer', { uitnodiging:sleutel });
  assert.equal(actief.status, 200);
  assert.deepEqual(actief.body.medewerker.rollen, ['hr']);
  assert.ok(actief.body.personeelToken);
  assert.match(actief.body.medewerker.rtgMail, /^fatima\.van\.hr@de-veilige-school(?:-\d+)?\.rtg$/);
  FATIMA={ token:actief.body.personeelToken, id:actief.body.medewerker.id,
    adres:actief.body.medewerker.rtgMail };
  assert.equal((await api('/school/personeel/uitnodiging/accepteer', { uitnodiging:sleutel })).status, 404,
    'de uitnodiging kan niet opnieuw worden gebruikt');

  const rechten=await api('/school/mijn-rechten', { schoolCode:D.schoolCode, personeelToken:actief.body.personeelToken });
  assert.deepEqual(rechten.body.rollen, ['hr']);
  assert.ok(rechten.body.rechten.includes('hr'));
});

test('ieder actief personeelslid krijgt een eigen afgeschermd RTG-postvak', async () => {
  const uit=await api('/school/personeel/uitnodig', Object.assign({
    naam:'Karim de Vries', email:'karim@veiligeschool.nl', rollen:['leraar']
  }, D));
  assert.equal(uit.status, 200);
  const sleutel=await wachtOpSleutel('uitnodiging');
  const actief=await api('/school/personeel/uitnodiging/accepteer', { uitnodiging:sleutel });
  assert.equal(actief.status, 200);
  assert.match(actief.body.medewerker.rtgMail, /^karim\.de\.vries@de-veilige-school(?:-\d+)?\.rtg$/);
  KARIM={ token:actief.body.personeelToken, id:actief.body.medewerker.id,
    adres:actief.body.medewerker.rtgMail };

  const overzicht=await api('/school/personeel/mail/overzicht', {
    schoolCode:D.schoolCode, personeelToken:FATIMA.token
  });
  assert.equal(overzicht.status, 200);
  assert.equal(overzicht.body.adres, FATIMA.adres);
  assert.equal(overzicht.body.publiekAdres, FATIMA.adres.replace(/\.rtg$/, '.rahultravelgroup.com'));
  assert.equal(overzicht.body.publiekActief, true);
  assert.equal(overzicht.body.persoonlijk, true);

  const verstuurd=await api('/school/personeel/mail/stuur', {
    schoolCode:D.schoolCode, personeelToken:FATIMA.token, naar:KARIM.adres,
    onderwerp:'Veilig overleg', tekst:'Alleen voor jouw schoolpostvak.'
  });
  assert.equal(verstuurd.status, 200);
  const inbox=await api('/school/personeel/mail/inbox', {
    schoolCode:D.schoolCode, personeelToken:KARIM.token
  });
  assert.equal(inbox.status, 200);
  assert.equal(inbox.body.berichten.length, 1);
  assert.equal(inbox.body.berichten[0].veiligheid.integriteit, 'ongeschonden');
  assert.equal(inbox.body.berichten[0].van, FATIMA.adres);

  const vreemd=await api('/school/personeel/mail/lees', {
    schoolCode:D.schoolCode, personeelToken:FATIMA.token, id:inbox.body.berichten[0].id
  });
  assert.equal(vreemd.status, 404, 'een collega kan een bericht uit het andere persoonlijke postvak niet openen');
  const eigen=await api('/school/personeel/mail/lees', {
    schoolCode:D.schoolCode, personeelToken:KARIM.token, id:inbox.body.berichten[0].id
  });
  assert.equal(eigen.status, 200);
  assert.equal(eigen.body.bericht.tekst, 'Alleen voor jouw schoolpostvak.');
});

/* DE MAP VERZONDEN, en waarom die een eigen toets krijgt.

   Deze route werd door de hele suite nooit aangeraakt: scripts/dekking.js
   telde /school/personeel/mail/verzonden als nooit aangeroepen, terwijl de
   buurroutes (overzicht, inbox, lees, stuur) hierboven wel worden nagelopen.
   Een route zonder toets kan precies de fout maken die hier het zwaarst weegt:
   per ongeluk het postvak IN teruggeven in plaats van de eigen uitgaande post.
   Bij persoonlijke schoolpost is dat verschil het hele punt -- dan zou een
   medewerker onder het kopje "verzonden" de post zien die AAN hem gericht is.

   De toets legt daarom beide kanten vast (bij de afzender staat het bericht er
   wel in, bij de ontvanger niet) en controleert dat dezelfde personeelspoort
   ervoor staat als bij de inbox. */
test('de map verzonden toont de eigen uitgaande post en nooit het postvak in', async () => {
  const mijn=await api('/school/personeel/mail/verzonden', {
    schoolCode:D.schoolCode, personeelToken:FATIMA.token
  });
  assert.equal(mijn.status, 200);
  assert.equal(mijn.body.ok, true);
  assert.equal(mijn.body.adres, FATIMA.adres);
  assert.ok(Array.isArray(mijn.body.berichten), 'verzonden levert een lijst berichten');
  const overleg=mijn.body.berichten.find(m => m.onderwerp === 'Veilig overleg');
  assert.ok(overleg, 'het zojuist verstuurde bericht staat in de eigen map verzonden');
  assert.equal(overleg.van, FATIMA.adres);
  assert.equal(overleg.naar, KARIM.adres);
  assert.equal(overleg.tekst, 'Alleen voor jouw schoolpostvak.');
  assert.ok(mijn.body.berichten.every(m => m.van === FATIMA.adres),
    'de map verzonden bevat uitsluitend post die dit adres zelf verstuurde');

  const vanKarim=await api('/school/personeel/mail/verzonden', {
    schoolCode:D.schoolCode, personeelToken:KARIM.token
  });
  assert.equal(vanKarim.status, 200);
  assert.equal(vanKarim.body.adres, KARIM.adres);
  assert.equal(vanKarim.body.berichten.some(m => m.id === overleg.id), false,
    'ontvangen post hoort niet in de map verzonden van de ontvanger -- dit is niet het postvak in');

  const nep=await api('/school/personeel/mail/verzonden', {
    schoolCode:D.schoolCode, personeelToken:'geen-geldig-token'
  });
  assert.equal(nep.status, 403, 'zonder geldig personeel-token gaat de map verzonden niet open');
  assert.equal(nep.body.berichten, undefined, 'een geweigerde aanvraag lekt geen post');
});

test('latere inlog is neutraal, kort houdbaar en eenmalig', async () => {
  const onbekend=await api('/school/personeel/inloglink', { schoolCode:D.schoolCode, email:'niemand@veiligeschool.nl' });
  const bekend=await api('/school/personeel/inloglink', { schoolCode:D.schoolCode, email:'fatima@veiligeschool.nl' });
  assert.equal(onbekend.status, 200); assert.equal(bekend.status, 200);
  assert.equal(onbekend.body.bericht, bekend.body.bericht, 'het antwoord verraadt niet of het account bestaat');
  const sleutel=await wachtOpSleutel('inloggen');
  assert.ok(sleutel, 'de eenmalige herinlog is naar hetzelfde schoolmailadres gestuurd');
  const open=await api('/school/personeel/inlog/accepteer', { inlog:sleutel });
  assert.equal(open.status, 200);
  assert.deepEqual(open.body.medewerker.rollen, ['hr']);
  assert.equal((await api('/school/personeel/inlog/accepteer', { inlog:sleutel })).status, 403,
    'de inloglink kan niet opnieuw worden gebruikt');

  const ingetrokken=await api('/school/personeel/toegang/intrek', Object.assign({ personeelId:open.body.medewerker.id }, D));
  assert.equal(ingetrokken.status, 200);
  assert.equal((await api('/school/hr/mijn', { schoolCode:D.schoolCode, personeelToken:open.body.personeelToken })).status, 403,
    'intrekken roteert de sleutel en sluit een bestaande sessie meteen');
  assert.equal((await api('/school/personeel/mail/inbox', {
    schoolCode:D.schoolCode, personeelToken:open.body.personeelToken
  })).status, 403, 'intrekken sluit ook het persoonlijke RTG-postvak meteen');
  const naIntrek=await api('/school/personeel/inloglink', { schoolCode:D.schoolCode, email:'fatima@veiligeschool.nl' });
  assert.equal(naIntrek.status, 200);
  await wachtOpStillePost();
  assert.equal(laatste('inloggen'), sleutel, 'een ingetrokken account ontvangt geen nieuwe inloglink');
});

test('directie kan een nog ongebruikte uitnodiging intrekken', async () => {
  const r=await api('/school/personeel/uitnodig', Object.assign({
    naam:'Sam van Administratie', email:'sam@veiligeschool.nl', rollen:['administratie']
  }, D));
  const sleutel=await wachtOpSleutel('uitnodiging');
  assert.equal((await api('/school/personeel/uitnodiging/intrek', Object.assign({ uitnodigingId:r.body.uitnodiging.id }, D))).status, 200);
  assert.equal((await api('/school/personeel/uitnodiging/accepteer', { uitnodiging:sleutel })).status, 404);
});

/* De lijst zelf was nooit beproefd: elke toets hierboven maakt uitnodigingen en
   niemand vroeg ze ooit terug op. Juist die lijst is het scherm waarop de
   directie ziet wie er binnen mag -- en hij staat achter dezelfde deur, toont
   het volledige werkadres (dat is het punt: de directie mag dat weten) en
   draagt nooit het activatiegeheim. */
test('de uitnodigingenlijst staat achter de directiedeur en volgt de levensloop', async () => {
  assert.equal((await api('/school/personeel/uitnodigingen', { schoolCode:D.schoolCode })).status, 403,
    'zonder beheer-token blijft de lijst dicht');
  const verkeerd=await api('/school/personeel/uitnodigingen', { schoolCode:D.schoolCode, beheerToken:'niet-het-token' });
  assert.equal(verkeerd.status, 403);
  assert.match(verkeerd.body.error, /beheer-token/, 'de weigering zegt waarop hij weigert');

  const voor=await api('/school/personeel/uitnodigingen', D);
  assert.equal(voor.status, 200);
  assert.equal(voor.body.ok, true);
  assert.ok(Array.isArray(voor.body.uitnodigingen));

  const gemaakt=await api('/school/personeel/uitnodig', Object.assign({
    naam:'Nora Zorgcoordinator', email:'nora@veiligeschool.nl', rollen:['zorg']
  }, D));
  assert.equal(gemaakt.status, 200);

  const na=await api('/school/personeel/uitnodigingen', D);
  assert.equal(na.status, 200);
  assert.equal(na.body.uitnodigingen.length, voor.body.uitnodigingen.length + 1,
    'de nieuwe uitnodiging staat er echt bij');
  const nora=na.body.uitnodigingen[0];
  assert.equal(nora.id, gemaakt.body.uitnodiging.id, 'de nieuwste staat bovenaan');
  assert.equal(nora.naam, 'Nora Zorgcoordinator');
  assert.equal(nora.email, 'nora@veiligeschool.nl', 'de directie ziet het volledige werkadres, niet de maskering');
  assert.deepEqual(nora.rollen, ['zorg']);
  assert.equal(nora.status, 'open');
  assert.ok(Date.parse(nora.verlooptAt) > Date.now(), 'een open uitnodiging draagt een vervaldatum in de toekomst');
  assert.equal(nora.school.code, D.schoolCode);
  assert.doesNotMatch(JSON.stringify(na.body), /[a-f0-9]{48}/i, 'de lijst draagt geen activatiegeheim');

  assert.equal((await api('/school/personeel/uitnodiging/intrek',
    Object.assign({ uitnodigingId:nora.id }, D))).status, 200);
  const daarna=await api('/school/personeel/uitnodigingen', D);
  assert.equal(daarna.body.uitnodigingen.find(x => x.id === nora.id).status, 'ingetrokken',
    'de lijst toont de toestand van nu en niet die van het moment van uitnodigen');
});
