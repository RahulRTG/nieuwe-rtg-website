/* Een gratis account vraagt vier dingen. Pas als er een DERDE PARTIJ bij komt --
   een zaak, een koerier -- vraagt Rahul de rest, in een gesprek.

   Deze test loopt dat echt door: een vers lid (naam, geboortedatum, e-mail,
   wachtwoord) probeert te bestellen, krijgt geen weigering maar een 428 met wat er
   mist, geeft dat in een gesprek met Rahul, en bestelt daarna gewoon.

   En het omgekeerde wordt net zo hard afgerekend: er wordt NIETS gevraagd wat de
   handeling niet nodig heeft. Een bestelling ter plekke vraagt geen adres.

   Draai los: node --experimental-sqlite --test test/gegevenspoort.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs'); const os = require('os'); const path = require('path');

async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

test('Rahul vraagt pas om je gegevens als er een derde partij bij komt', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gp-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    // een vers lid: de korte aanmelding, dus zonder telefoonnummer en zonder adres
    const email = 'poort@voorbeeld.test';
    const reg = await api(base, '/api/auth/register', {
      name: 'Pia Poort', email, password: 'poortgeheim12', geboortedatum: '1991-02-02', tier: 'rtg', pasApp: 'rtg'
    });
    assert.equal(reg.status, 200, 'aanmelden lukt met vier velden');
    const token = reg.body.token;

    // 1) rondkijken hoeft niets: pas bij een handeling met een derde partij
    const bestellen = await api(base, '/api/gegevens/nodig', { soort: 'bestelling' }, token);
    assert.equal(bestellen.status, 200);
    assert.deepEqual(bestellen.body.ontbreekt.map(x => x.veld), ['telefoon'],
      'een bestelling vraagt alleen een telefoonnummer');

    const bezorging = await api(base, '/api/gegevens/nodig', { soort: 'bezorging' }, token);
    assert.deepEqual(bezorging.body.ontbreekt.map(x => x.veld).sort(), ['adres', 'telefoon'],
      'pas bij een bezorging komt het adres erbij');

    // NIETS vragen wat de handeling niet nodig heeft
    assert.ok(!bestellen.body.ontbreekt.some(x => x.veld === 'adres'),
      'een bestelling ter plekke vraagt GEEN adres');
    assert.ok(!bestellen.body.ontbreekt.some(x => x.veld === 'identiteit'),
      'en al helemaal geen paspoort');

    // 2) bestellen zonder nummer: geen weigering, maar netjes wat er mist
    const order1 = await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [] }, token);
    assert.equal(order1.status, 428, 'de bestelling wacht op wat er nog nodig is');
    assert.ok(Array.isArray(order1.body.ontbreekt) && order1.body.ontbreekt[0].veld === 'telefoon');
    assert.match(order1.body.error, /telefoonnummer/i, 'en zegt in gewone taal wat er mist');

    // 3) Rahul vraagt het in een gesprek
    const start = await api(base, '/api/gegevens/start', { soort: 'bestelling' }, token);
    assert.equal(start.status, 200);
    assert.equal(start.veld === undefined ? start.body.veld : start.veld, 'telefoon');
    assert.match(start.body.tekst, /bereiken|telefoonnummer/i, 'hij vraagt het kort');
    const id = start.body.id;

    // "waarom?" krijgt een eerlijk antwoord en het gesprek loopt door
    const waarom = await api(base, '/api/gegevens/zeg', { id, tekst: 'waarom?' }, token);
    assert.match(waarom.body.tekst, /bereiken/i, 'eerlijk waarom');
    assert.equal(waarom.body.veld, 'telefoon', 'en hij blijft bij dezelfde vraag');

    // onzin wordt niet geslikt
    const kort = await api(base, '/api/gegevens/zeg', { id, tekst: '12' }, token);
    assert.match(kort.body.tekst, /te kort|voluit/i, 'een te kort nummer telt niet');

    const goed = await api(base, '/api/gegevens/zeg', { id, tekst: '0612345678' }, token);
    assert.equal(goed.body.klaar, true, 'daarna is het rond');

    // 4) het nummer staat in de kluis, en de bestelling kan nu gewoon
    const na = await api(base, '/api/gegevens/nodig', { soort: 'bestelling' }, token);
    assert.deepEqual(na.body.ontbreekt, [], 'er mist niets meer voor een bestelling');
    const order2 = await api(base, '/api/order', { supplierCode: 'KIKUNOI', items: [] }, token);
    assert.notEqual(order2.status, 428, 'de bestelling wordt niet meer tegengehouden op gegevens');

    // maar voor een BEZORGING mist het adres nog steeds
    const nogAdres = await api(base, '/api/gegevens/nodig', { soort: 'bezorging' }, token);
    assert.deepEqual(nogAdres.body.ontbreekt.map(x => x.veld), ['adres'],
      'alleen het adres nog, want het nummer is er nu');

    // 5) het adres via hetzelfde gesprek
    const s2 = await api(base, '/api/gegevens/start', { soort: 'bezorging' }, token);
    assert.equal(s2.body.veld, 'adres');
    const raar = await api(base, '/api/gegevens/zeg', { id: s2.body.id, tekst: 'ergens' }, token);
    assert.match(raar.body.tekst, /geen adres|straat/i, 'een half adres telt niet');
    const klaar = await api(base, '/api/gegevens/zeg', { id: s2.body.id, tekst: 'Keizersgracht 123, 1015 CJ Amsterdam' }, token);
    assert.equal(klaar.body.klaar, true);
    const bezorg2 = await api(base, '/api/gegevens/nodig', { soort: 'bezorging' }, token);
    assert.deepEqual(bezorg2.body.ontbreekt, [], 'nu kan de bezorging ook');

    // 6) afbreken mag altijd, en dan gaat het gewoon niet door
    const s3 = await api(base, '/api/gegevens/start', { soort: 'identiteit' }, token);
    assert.equal(s3.body.veld, 'identiteit');
    assert.equal(s3.body.viaVerificatie, true, 'paspoort loopt via de bestaande identiteitscontrole');
    const stop3 = await api(base, '/api/gegevens/zeg', { id: s3.body.id, tekst: 'laat maar' }, token);
    assert.equal(stop3.body.gestopt, true, 'stoppen kan');
    assert.match(stop3.body.tekst, /niet door/i, 'met de eerlijke gevolgtrekking');

    /* 6b) DE POORT STAAT OVERAL WAAR EEN DERDE PARTIJ IS, niet alleen op /api/order.
       Keuringsregel 16 bewaakt dat er geen nieuw pad omheen komt; deze test bewijst
       dat de bestaande paden er ECHT langsgaan -- een regel die alleen in de keuring
       staat is nog geen werkende poort. Een vers lid zonder telefoonnummer krijgt
       overal netjes 428 met wat er mist, en niet stilletjes een geslaagde boeking. */
    const vers = await api(base, '/api/auth/register', {
      name: 'Derde Partij', email: 'derde@voorbeeld.test', password: 'derdegeheim12',
      geboortedatum: '1988-04-04', tier: 'rtg', pasApp: 'rtg'
    });
    const vt = vers.body.token;
    const paden = [
      ['/api/reserveer', { supplierCode: 'KIKUNOI', personen: 2 }],
      ['/api/verblijf', { supplierCode: 'KIKUNOI' }],
      ['/api/bezorg/bestel', { supplierCode: 'KIKUNOI', items: [] }],
      ['/api/ticket/koop', { supplierCode: 'KIKUNOI' }],
      ['/api/huur/boek', { supplierCode: 'KIKUNOI' }],
      ['/api/charter/boek', { supplierCode: 'KIKUNOI' }],
      ['/api/verkoop/proefrit', { supplierCode: 'KIKUNOI' }],
      ['/api/care/boek', {}],
      ['/api/mall/bestel', {}],
      ['/api/reisbureau/boek', {}],
      ['/api/groothandel/bestel', {}],
      ['/api/mode/bezorg/aanvraag', { supplierCode: 'KIKUNOI', items: [] }],
      // en de paden BUITEN routes/member, die er eerst allemaal langs gleden
      ['/api/member/vluchten/boek', { id: 'x' }],
      ['/api/member/sport/ticket/koop', { club: 'FCRTG' }],
      ['/api/thuis/boek', { id: 'x' }],
      ['/api/pakket/koop', { id: 'x' }]
    ];
    for (const [pad, lijf] of paden) {
      const r = await api(base, pad, lijf, vt);
      assert.equal(r.status, 428, pad + ' hoort op de gegevens te wachten (kreeg ' + r.status + ')');
      assert.ok(Array.isArray(r.body.ontbreekt) && r.body.ontbreekt.length,
        pad + ' zegt ook WAT er mist');
    }

    // 7) het gesprek van een ander is niet van jou
    const ander = await api(base, '/api/auth/register', {
      name: 'Ander Lid', email: 'ander@voorbeeld.test', password: 'andergeheim12',
      geboortedatum: '1992-03-03', tier: 'rtg', pasApp: 'rtg'
    });
    const s4 = await api(base, '/api/gegevens/start', { soort: 'bestelling' }, ander.body.token);
    const gestolen = await api(base, '/api/gegevens/zeg', { id: s4.body.id, tekst: '0611111111' }, token);
    assert.equal(gestolen.status, 403, 'je kunt niet in het gesprek van een ander praten');
  } finally { stop(child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }
});

/* En Rahul zelf. Hij doet zijn acties met exact dezelfde functies als de
   app-knoppen, maar hij komt NIET langs de routes -- en daar zit de poort. Dat
   maakte hem de enige die er ongemerkt langs kon: een tafel op naam van een lid
   dat de zaak niet kan bereiken. Deze test rekent dat af aan de voorkant, via
   /api/fluister, precies zoals een lid het zou vragen. */
test('ook Rahul komt niet om de gegevenspoort heen', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gpr-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const reg = await api(base, '/api/auth/register', {
      name: 'Ria Rahul', email: 'rahulpoort@voorbeeld.test', password: 'rahulgeheim12',
      geboortedatum: '1987-07-07', tier: 'rtg', pasApp: 'rtg'
    });
    const token = reg.body.token;
    const zaak = (await api(base, '/api/suppliers', {}, token)).body.suppliers.find(s => s.type === 'restaurant');
    assert.ok(zaak, 'er is een restaurant om bij te reserveren');

    const vraag = 'reserveer bij ' + zaak.name + ' morgen om 20:00 met 2 personen';
    const zonder = await api(base, '/api/fluister', { q: vraag }, token);
    assert.equal(zonder.status, 200);
    assert.match(zonder.body.antwoord, /bereiken|telefoonnummer/i, 'hij vraagt het, in het gesprek zelf');
    assert.doesNotMatch(zonder.body.antwoord, /aangevraagd/i, 'en reserveert dus NIET');
    assert.doesNotMatch(zonder.body.antwoord, /in de app/i, 'en stuurt u niet weg naar een ander scherm');
    const res1 = await api(base, '/api/reserveringen/mijn', {}, token);
    assert.equal((res1.body.reserveringen || []).length, 0, 'er staat echt niets in de boeken');

    /* HIJ VRAAGT HET HIER, DUS HIJ VERWERKT HET HIER. "waarom?" krijgt hetzelfde
       eerlijke antwoord als in de app -- het is dezelfde stappenmachine -- en een
       te kort nummer wordt niet geslikt. */
    const waaromR = await api(base, '/api/fluister', { q: 'waarom?' }, token);
    assert.match(waaromR.body.antwoord, /bereiken/i, 'eerlijk waarom, ook in het gesprek');
    const kortR = await api(base, '/api/fluister', { q: '12' }, token);
    assert.match(kortR.body.antwoord, /te kort|voluit/i, 'onzin wordt ook hier niet geslikt');

    // en dan het echte nummer: hij noteert het EN doet alsnog wat er gevraagd was
    const antwoord = await api(base, '/api/fluister', { q: '0612345678' }, token);
    assert.match(antwoord.body.antwoord, /aangevraagd/i,
      'na het antwoord doet hij de reservering alsnog, zonder dat u het opnieuw hoeft te vragen: ' + antwoord.body.antwoord);
    const res2 = await api(base, '/api/reserveringen/mijn', {}, token);
    assert.equal((res2.body.reserveringen || []).length, 1, 'en hij staat echt in de boeken');

    // het nummer zit in de kluis, dus de volgende keer vraagt hij niets meer
    const na = await api(base, '/api/gegevens/nodig', { soort: 'reservering' }, token);
    assert.deepEqual(na.body.ontbreekt, [], 'eenmaal gegeven is genoeg');

    // en afbreken mag: een tweede lid stopt het gesprek en er gebeurt niets
    const twee = await api(base, '/api/auth/register', {
      name: 'Stop Sara', email: 'stop@voorbeeld.test', password: 'stopgeheim12',
      geboortedatum: '1993-03-03', tier: 'rtg', pasApp: 'rtg'
    });
    const t2 = twee.body.token;
    await api(base, '/api/fluister', { q: vraag }, t2);
    const gestopt = await api(base, '/api/fluister', { q: 'laat maar' }, t2);
    assert.match(gestopt.body.antwoord, /niet door/i, 'stoppen kan, met de eerlijke gevolgtrekking');
    const res3 = await api(base, '/api/reserveringen/mijn', {}, t2);
    assert.equal((res3.body.reserveringen || []).length, 0, 'en dan is er ook niets gereserveerd');
  } finally { stop(child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }
});
