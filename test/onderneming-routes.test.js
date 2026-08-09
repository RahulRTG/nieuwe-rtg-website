/* Ronde: de DEUREN van het Ondernemers-OS.

   Waarom dit naast alle andere onderneming-toetsen staat: die roepen de kern
   rechtstreeks aan. Dat toetst de regel, maar niet de weg ernaartoe -- en juist
   daar zitten de fouten die een gebruiker merkt: een route die een veld anders
   noemt, een `stuur()` die een projectstand als HTTP-code leest (dat is hier
   een keer echt gebeurd), of een deur die zonder inlog opengaat.

   DRIE BEWERINGEN:

   1. ELKE DEUR IS DICHT ZONDER INLOG. Geen enkel endpoint van dit OS geeft iets
      prijs aan wie geen sessie heeft.
   2. ELKE DEUR VAN EEN ANDER BLIJFT DICHT. Een onderneming van lid A is voor
      lid B niet te lezen en niet te schrijven -- ook niet met het juiste id.
   3. ELKE DEUR ANTWOORDT ZONDER TE BREKEN, in de fase waarin een gebruiker hem
      werkelijk opent. Een idee heeft geen debiteuren; dat mag een leeg antwoord
      geven, maar geen 500.

   Draai los: node --experimental-sqlite --test test/onderneming-routes.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

async function post(base, pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

/* De deuren van dit OS, met per deur het lichaam dat een gebruiker echt stuurt.
   Ze staan als LIJST zodat de drie beweringen hieronder er alle drie overheen
   lopen: een nieuwe route erbij betekent hier een regel erbij, en dan is hij
   meteen op alle drie getoetst. */
const DEUREN = (id) => [
  ['/api/onderneming/mijn', {}],
  ['/api/onderneming/beeld', { id }],
  ['/api/onderneming/intake', { id, idee: { wat: 'Ramen wassen bij bedrijven' } }],
  ['/api/onderneming/verkenning', { id }],
  ['/api/onderneming/dagbeeld', { id }],
  ['/api/onderneming/plan/vastleggen', { id }],
  ['/api/onderneming/rechtsvorm', { id, rechtsvorm: 'eenmanszaak' }],
  ['/api/onderneming/oprichting', { id }],
  /* `deel: true` betekent: deze aanroep wijst binnen de onderneming een DING
     aan dat niet bestaat (een stap, een bestuurder, een belang). Een 404 is dan
     het goede antwoord en geen ontbrekende deur -- dat onderscheid moet deze
     toets maken, anders eist hij dat een verzonnen stap toch bestaat. */
  ['/api/onderneming/oprichting/zet', { id, stap: 'bestaat-niet', klaar: true }, true],
  ['/api/onderneming/ingeschreven', { id, kvk: '12345678' }],
  ['/api/onderneming/aanvraag/stand', { id }],
  ['/api/onderneming/eersteklant', { id }],
  ['/api/onderneming/mallprofiel', { id }],
  ['/api/onderneming/relaties', { id }],
  ['/api/onderneming/relaties/notitie', { id, codenaam: 'Reiger', notitie: 'x' }],
  ['/api/onderneming/debiteuren', { id }],
  ['/api/onderneming/crediteuren', { id }],
  ['/api/onderneming/contracten', { id }],
  ['/api/onderneming/werkruimte', { id, code: 'GEEN' }, true],   // een werkruimte die niet bestaat
  ['/api/onderneming/belasting', { id }],
  ['/api/onderneming/kas', { id }],
  ['/api/onderneming/kas/saldo', { id, bedrag: 1000 }],
  ['/api/onderneming/capaciteit', { id }],
  ['/api/onderneming/werving', { id }],
  ['/api/onderneming/pijplijn', { id }],
  ['/api/onderneming/voorraad', { id }],
  ['/api/onderneming/klussen', { id }],
  ['/api/onderneming/bestuur', { id }],
  ['/api/onderneming/bestuur/zet', { id, codenaam: 'Reiger', rol: 'bestuurder' }],
  /* `bestuurder` en niet `id`: `id` is in dit OS de ONDERNEMING. Dat die twee
     eerst dezelfde naam deelden, kwam hier aan het licht -- een bestuurder
     laten aftreden overschreef de onderneming. */
  ['/api/onderneming/bestuur/af', { id, bestuurder: 'bestaat-niet' }, true],
  ['/api/onderneming/aandeel/zet', { id, codenaam: 'Reiger', percentage: 50 }],
  ['/api/onderneming/aandeel/weg', { id, aandeel: 'bestaat-niet' }, true],
  ['/api/onderneming/toegang', { id }],
  ['/api/onderneming/ontwerp', { id, opdracht: 'ontwerp', vraag: 'Denk mee.' }],
  ['/api/onderneming/ontwerp/opdrachten', { id }]
];

async function lid(base, n) {
  const t = Date.now() + n;
  const r = await post(base, '/api/auth/register', { name: 'Onderneemster ' + n,
    email: 'ond' + t + '@e.test', phone: '06' + String(t).slice(-8),
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' });
  assert.ok(r.body.token, 'registratie geeft een token: ' + JSON.stringify(r.body).slice(0, 200));
  return r.body.token;
}

test('de deuren van het Ondernemers-OS: dicht, van u alleen, en heel', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ond-routes-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const A = await lid(base, 1);
    const B = await lid(base, 2);

    const nieuw = await post(base, '/api/onderneming/nieuw', { naam: 'Glasheldere Ramen' }, A);
    assert.equal(nieuw.status, 200, JSON.stringify(nieuw.body).slice(0, 200));
    const id = nieuw.body.onderneming.id;

    /* ---- 1. dicht zonder inlog ---- */
    for (const [pad, lichaam] of DEUREN(id)) {
      const r = await post(base, pad, lichaam, null);
      assert.ok(r.status === 401 || r.status === 403,
        pad + ' hoort dicht te zijn zonder inlog, gaf ' + r.status);
    }
    const nieuwZonder = await post(base, '/api/onderneming/nieuw', { naam: 'Stiekem' }, null);
    assert.ok(nieuwZonder.status === 401 || nieuwZonder.status === 403);

    /* ---- 2. de onderneming van een ander ----
       Met het JUISTE id, want dat is het geval dat ertoe doet: raden hoeft niet
       als een id ergens uitlekt. Alles behalve de twee deuren die niet over een
       bepaalde onderneming gaan. */
    const eigen = new Set(['/api/onderneming/mijn', '/api/onderneming/ontwerp/opdrachten']);
    for (const [pad, lichaam, deel] of DEUREN(id)) {
      if (eigen.has(pad) || deel) continue;   // die wijzen een onderdeel aan, zie hieronder
      const r = await post(base, pad, lichaam, B);
      assert.equal(r.status, 404,
        pad + ' hoort voor een ander lid niet te bestaan, gaf ' + r.status + ' ' +
        JSON.stringify(r.body).slice(0, 120));
    }
    const vanB = await post(base, '/api/onderneming/mijn', {}, B);
    assert.deepEqual(vanB.body.ondernemingen, [], 'en lid B ziet niets van A');

    /* ---- 3. heel, in de fase waarin een gebruiker ze opent ----
       Een idee heeft geen zaak en dus geen debiteuren. Dat mag een leeg
       antwoord geven; wat het NOOIT mag geven is een 500. Die grens is hier
       echt een keer gesprongen: een projectstand in een veld dat `stuur()` als
       HTTP-code las, gaf een 500 op een verzoek dat verder klopte. */
    for (const [pad, lichaam, deel] of DEUREN(id)) {
      const r = await post(base, pad, lichaam, A);
      assert.ok(r.status < 500, pad + ' brak met ' + r.status + ': ' +
        JSON.stringify(r.body).slice(0, 200));
      if (!deel) {
        assert.notEqual(r.status, 404,
          pad + ' zou voor de eigenaar moeten bestaan, gaf 404');
      } else {
        /* En waar een 404 wél hoort, hoort hij over het DING te gaan en niet
           over de onderneming: anders staat er "deze onderneming staat niet op
           uw naam" op een verzoek van de eigenaar zelf. */
        assert.ok(!/op uw naam/i.test(JSON.stringify(r.body)),
          pad + ' verwart een ontbrekend onderdeel met een ontbrekende onderneming: ' +
          JSON.stringify(r.body).slice(0, 160));
      }
    }

    /* En de publieke voorlichting: de rechtsvormen zijn zonder inlog te lezen,
       want wat een B.V. van een stichting onderscheidt hoort iemand te kunnen
       lezen vóórdat hij een account heeft. */
    const rv = await fetch(base + '/api/onderneming/rechtsvormen');
    assert.equal(rv.status, 200);
    const lijst = await rv.json();
    assert.ok(lijst.rechtsvormen.length > 5);
    assert.ok(lijst.landen.includes('NL'));
    const de = await (await fetch(base + '/api/onderneming/rechtsvormen?land=DE')).json();
    assert.equal(de.ok, true);
    assert.ok(de.rechtsvormen.every(r => r.land === 'DE'));
    const it = await (await fetch(base + '/api/onderneming/rechtsvormen?land=IT')).json();
    assert.equal(it.ok, false, 'een land dat wij niet kennen zegt dat, ook publiek');
  } finally {
    try { child.kill('SIGKILL'); } catch (e) { /* al weg */ }
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* niets */ }
  }
});

/* DE ERNSTIGSTE VAN DEZE RONDE. Koppelen vroeg nergens om bewijs dat de zaak
   van de aanvrager was: er werd alleen gekeken of hij bestaat en nog vrij is.
   Elk ingelogd lid kan codes opvragen (POST /api/suppliers geeft ze), dus wie
   een vrije code vond, koppelde hem aan zijn eigen onderneming en las daarna
   via precies dezelfde eigendomscontrole het klantenboek, de debiteuren, de
   kas, de belasting en het dagbeeld van een ander bedrijf -- en schreef via
   /relaties/notitie zelfs in diens klantenboek. */
test('een vreemde zaak is niet te koppelen, en dus ook niet uit te lezen', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ond-koppel-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const A = await lid(base, 7);

    /* Precies de weg van een aanvaller: de codes zijn gewoon op te vragen. */
    const zaken = await post(base, '/api/suppliers', {}, A);
    const lijst = zaken.body.suppliers || zaken.body.partners || [];
    const code = (lijst.find(z => z && z.code) || {}).code;
    assert.ok(code, 'een ingelogd lid kan zaakcodes opvragen: ' +
      JSON.stringify(zaken.body).slice(0, 160));

    const nieuw = await post(base, '/api/onderneming/nieuw', { naam: 'Stiekem' }, A);
    const id = nieuw.body.onderneming.id;

    const koppel = await post(base, '/api/onderneming/koppel', { id, code }, A);
    assert.equal(koppel.status, 403,
      'koppelen aan een zaak die niet van u is, hoort geweigerd te worden (gaf ' +
      koppel.status + ' ' + JSON.stringify(koppel.body).slice(0, 160) + ')');
    assert.ok(/niet van u/i.test(koppel.body.error || ''));

    /* En de gevolgschade blijft dus uit: het dagbeeld van die zaak is niet te
       lezen en er is niets in haar klantenboek te schrijven. */
    const beeld = await post(base, '/api/onderneming/beeld', { id }, A);
    assert.equal(beeld.body.onderneming.zaak, null, 'er hangt geen zaak aan');
    const notitie = await post(base, '/api/onderneming/relaties/notitie',
      { id, codenaam: 'Reiger', tekst: 'x' }, A);
    assert.equal(notitie.status, 409, 'en schrijven kan al helemaal niet: ' +
      JSON.stringify(notitie.body).slice(0, 120));
  } finally {
    try { child.kill('SIGKILL'); } catch (e) { /* al weg */ }
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* niets */ }
  }
});

/* De kantoordeuren van de rechtsvormwacht en de ondernemersregie. Apart, want
   ze horen achter de KANTOORPOORT en niet achter een lidsessie -- en dat is
   precies wat hier wordt nagetrokken. */
test('de kantoordeuren van de regie en de rechtsvormwacht zitten achter de kantoorpoort', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ond-office-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const A = await lid(base, 3);
    const PADEN = ['/api/office/rechtsvormwacht', '/api/office/rechtsvormwacht/check',
      '/api/office/rechtsvormwacht/zet', '/api/office/ondernemersregie',
      '/api/office/ondernemersregie/provisioning', '/api/office/ondernemersregie/bijdrage'];
    for (const pad of PADEN) {
      const zonder = await post(base, pad, {}, null);
      assert.ok(zonder.status === 401 || zonder.status === 403,
        pad + ' zonder sessie gaf ' + zonder.status);
      /* Een gewoon lid is geen kantoor. Dit is de fout die je pas merkt als
         iemand hem vindt: een deur die open blijkt voor de verkeerde soort
         sessie. */
      const alsLid = await post(base, pad, {}, A);
      assert.ok(alsLid.status === 401 || alsLid.status === 403,
        pad + ' hoort dicht te zijn voor een gewoon lid, gaf ' + alsLid.status);
    }
  } finally {
    try { child.kill('SIGKILL'); } catch (e) { /* al weg */ }
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* niets */ }
  }
});
