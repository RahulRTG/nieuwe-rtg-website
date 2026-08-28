/* Werkmail: het zakelijke adresboek per zaak boven op RTMAIL. Standaard-
   adressen voor eigenaar en management, rahul@<bedrijf>.rtg dat zelf
   terugschrijft, werkgeversbeheer (aanmaken en afpakken), de buitenpost
   (extern versturen via de outbox) en de buitenpoort die ALLES van buiten
   in de onbetrouwde baan aflevert: links op slot, bijlagen bestaan niet.
   Draai los: node --test test/werkmail.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, manToken, stafToken, domein, eigenaarAdres, eigenaarPubliek, rahulAdres, rosterStaff;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werkmail-'));
let child;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '',
    RTG_MAIL_PUBLIEK_BASIS:'rahultravelgroup.com' } }));
  const roster = await json(await api('/api/supplier/roster', { code: 'ESVEDRA' }));
  rosterStaff = roster.staff;
  const man = roster.staff.find(x => x.role === 'manager');
  const staf = roster.staff.find(x => x.role !== 'manager');
  manToken = (await json(await api('/api/supplier/login', { code: 'ESVEDRA', staffId: man.id, pin: '1234' }))).token;
  stafToken = (await json(await api('/api/supplier/login', { code: 'ESVEDRA', staffId: staf.id, pin: '5678' }))).token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('standaard: ieder teamlid krijgt naam+achternaam op het interne bedrijfsdomein', async () => {
  const d = await json(await api('/api/supplier/werkmail/overzicht', {}, manToken));
  assert.ok(d.domein.endsWith('.rtg'), 'de zaak krijgt een eigen .rtg-domein');
  domein = d.domein;
  eigenaarAdres = 'eigenaar@' + domein;
  eigenaarPubliek = 'eigenaar@' + domein.replace(/\.rtg$/, '') + '.rahultravelgroup.com';
  rahulAdres = 'rahul@' + domein;
  const rollen = Object.fromEntries(d.adressen.map(a => [a.rol, a.adres]));
  assert.equal(rollen.eigenaar, eigenaarAdres, 'de eigenaar heeft standaard een werkmail');
  assert.equal(rollen.rahul, rahulAdres, 'rahul@<bedrijf>.rtg staat klaar');
  assert.ok(d.adressen.some(a => a.rol === 'management'), 'elke manager krijgt standaard een adres');
  const persoonlijk = d.adressen.filter(a => a.persoonlijk);
  assert.equal(persoonlijk.length, rosterStaff.length, 'ieder actief teamlid heeft precies een persoonlijk adres');
  for (const st of rosterStaff) {
    const a = persoonlijk.find(x => x.staffId === st.id);
    assert.ok(a, 'adres voor ' + st.name);
    const verwacht = st.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
    assert.ok(a.adres.startsWith(verwacht + '@') || a.adres.startsWith(verwacht + '-'), a.adres);
    assert.equal(a.publiekAdres, a.adres.replace(/\.rtg$/, '.rahultravelgroup.com'));
  }
  assert.equal(d.internDomein, true, '.rtg wordt eerlijk als interne naamruimte aangeduid');
  assert.equal(d.publiekActief, true);
  assert.equal(d.echteBuitenpost, false, 'zonder SMTP-sleutel gaat extern naar de outbox');
});

test('persoonlijke mailbox: medewerker ziet alleen zichzelf, manager beheert maar leest collega niet', async () => {
  const eigen = await json(await api('/api/supplier/werkmail/overzicht', {}, stafToken));
  assert.equal(eigen.adressen.length, 1, 'medewerker krijgt alleen het eigen adresboekdeel');
  assert.equal(eigen.adressen[0].persoonlijk, true);
  assert.equal(eigen.adressen[0].toegang, true);
  assert.equal((await api('/api/supplier/werkmail/inbox', { adres:eigen.adressen[0].adres }, stafToken)).status, 200);
  assert.equal((await api('/api/supplier/werkmail/inbox', { adres:eigen.adressen[0].adres }, manToken)).status, 403,
    'manager krijgt niet automatisch de persoonlijke inhoud van een collega');
  assert.equal((await api('/api/supplier/werkmail/inbox', { adres:eigenaarAdres }, stafToken)).status, 403,
    'medewerker krijgt ook geen gedeelde managementpost');
});

test('werkgeversbeheer: de manager maakt en pakt af, personeel niet', async () => {
  assert.equal((await api('/api/supplier/werkmail/maak', { lokaal: 'balie', label: 'De balie' }, stafToken)).status, 403, 'personeel beheert niet');
  const m = await json(await api('/api/supplier/werkmail/maak', { lokaal: 'balie', label: 'De balie' }, manToken));
  assert.equal(m.adres.adres, 'balie@' + domein);
  // afpakken: het adres gaat op slot, maar het postvak blijft van de zaak
  const weg = await json(await api('/api/supplier/werkmail/intrek', { adres: 'balie@' + domein, aan: false }, manToken));
  assert.equal(weg.adres.actief, false);
  assert.equal((await api('/api/supplier/werkmail/stuur', { van: 'balie@' + domein, naar: eigenaarAdres, onderwerp: 'x', tekst: 'y' }, manToken)).status, 400, 'een afgepakt adres verstuurt niet meer');
  assert.equal((await api('/api/supplier/werkmail/inbox', { adres: 'balie@' + domein }, manToken)).status, 403, 'ingetrokken betekent meteen geen toegang meer');
  // het huis-adres en Rahul zijn niet af te pakken
  assert.equal((await api('/api/supplier/werkmail/intrek', { adres: rahulAdres, aan: false }, manToken)).status, 400);
  assert.equal((await api('/api/supplier/werkmail/intrek', { adres: eigenaarAdres, aan: false }, manToken)).status, 400);
});

test('rahul@<bedrijf>.rtg schrijft zelf terug, en je mailt nooit namens hem', async () => {
  assert.equal((await api('/api/supplier/werkmail/stuur', { van: rahulAdres, naar: eigenaarAdres, onderwerp: 'x', tekst: 'y' }, manToken)).status, 400, 'niemand mailt als Rahul');
  const r = await json(await api('/api/supplier/werkmail/stuur', { van: eigenaarAdres, naar: rahulAdres, onderwerp: 'Inkoopvraag', tekst: 'Wat vind je van de offerte?' }, manToken));
  assert.equal(r.buiten, false);
  const inbox = await json(await api('/api/supplier/werkmail/inbox', { adres: eigenaarAdres }, manToken));
  const antwoord = inbox.berichten.find(b => b.van === rahulAdres);
  assert.ok(antwoord, 'Rahul antwoordt in het eigen postvak');
  assert.equal(antwoord.vertrouwd, true, 'het antwoord draagt de vertrouwde stempel');
  assert.ok(antwoord.onderwerp.startsWith('Re: Inkoopvraag'));
});

test('naar buiten mailen kan: via de buitenpost naar de outbox', async () => {
  const r = await json(await api('/api/supplier/werkmail/stuur', { van: eigenaarAdres, naar: 'klant@voorbeeld.nl', onderwerp: 'Offerte', tekst: 'In de bijlage... nee dus: gewoon in deze tekst.' }, manToken));
  assert.equal(r.buiten, true, 'een echt e-mailadres gaat via de buitenpost');
  assert.equal(r.echt, false, 'zonder SMTP-sleutel belandt hij in de outbox');
  const verz = await json(await api('/api/supplier/werkmail/verzonden', { adres: eigenaarAdres }, manToken));
  assert.ok(verz.berichten.some(b => b.naar === 'klant@voorbeeld.nl' && b.soort === 'buitenpost'), 'de buitenpost staat in verzonden');
  const outbox = path.join(TMP, 'outbox');
  assert.ok(fs.existsSync(outbox) && fs.readdirSync(outbox).length >= 1, 'de outbox bevat de brief');
  const ruw=fs.readdirSync(outbox).map(x => fs.readFileSync(path.join(outbox, x), 'utf8')).join('\n');
  assert.match(ruw, new RegExp('From: ' + eigenaarPubliek.replace(/\./g, '\\.')),
    'de zichtbare afzender is het persoonlijke publieke alias');
});

test('de buitenpoort: alles van buiten is onbetrouwbaar -- links op slot, geen bijlagen', async () => {
  const r = await api('/api/werkmail/bezorg', { naar: eigenaarAdres, van: 'aanvaller@phish.example', bron: 'systeem',
    onderwerp: 'Dringend: klik hier', tekst: 'Open snel http://phish.example/klik en de bijlage factuur.exe' });
  assert.equal(r.status, 200);
  const inbox = await json(await api('/api/supplier/werkmail/inbox', { adres: eigenaarAdres }, manToken));
  const m = inbox.berichten.find(b => b.van === 'aanvaller@phish.example');
  assert.ok(m, 'de post van buiten komt aan');
  assert.equal(m.vertrouwd, false, 'de bron-claim van de afzender telt NIET: buiten is onbetrouwbaar');
  assert.equal(m.bron, 'extern');
  assert.equal(m.veiligheid.integriteit, 'ongeschonden', 'ook externe post krijgt na de scan een integriteitszegel');
  assert.ok(m.links.externeLinks.some(u => u.includes('phish.example')), 'de link is gemarkeerd (en dus op slot)');
  assert.deepEqual(m.bijlagen, [], 'een bijlage bestaat niet, wat de afzender ook meestuurt');
  assert.equal((await api('/api/werkmail/bezorg', { naar:eigenaarPubliek, van:'klant@buiten.example',
    onderwerp:'Publiek alias', tekst:'Dit kwam via het publieke internetadres.' })).status, 200);
  const naPubliek=await json(await api('/api/supplier/werkmail/inbox', { adres:eigenaarAdres }, manToken));
  assert.ok(naPubliek.berichten.some(b => b.onderwerp === 'Publiek alias'),
    'publieke en interne schrijfwijze openen hetzelfde afgeschermde postvak');
  const rauweMail='From: afzender@voorbeeld.nl\r\nTo: ' + eigenaarPubliek +
    '\r\nSubject: Publieke SMTP-keten\r\nDate: Thu, 20 Aug 2026 10:00:00 +0000\r\n\r\nVeilig ontvangen.';
  assert.equal((await api('/api/mail/binnen', { bericht:rauweMail, ip:'203.0.113.25' })).status, 200);
  const naSmtp=await json(await api('/api/supplier/werkmail/inbox', { adres:eigenaarAdres }, manToken));
  assert.ok(naSmtp.berichten.some(b => b.onderwerp === 'Publieke SMTP-keten'),
    'de echte inkomende mailketen vertaalt het publieke alias naar het interne postvak');
  // en Rahul schrijft nooit automatisch terug naar buiten (geen backscatter)
  const voor = (await json(await api('/api/supplier/werkmail/verzonden', { adres: rahulAdres }, manToken))).berichten.length;
  await api('/api/werkmail/bezorg', { naar: rahulAdres, van: 'spammer@buiten.example', onderwerp: 'hoi', tekst: 'reageer eens' });
  const na = (await json(await api('/api/supplier/werkmail/verzonden', { adres: rahulAdres }, manToken))).berichten.length;
  assert.equal(na, voor, 'geen automatisch antwoord op externe post');
  assert.equal((await api('/api/werkmail/bezorg', { naar: 'niemand@' + domein, van: 'x@y.zz', onderwerp: 'x', tekst: 'y' })).status, 400, 'onbekende adressen bestaan niet voor de poort');
});
