/* DE ISOLATIEMODUS VAN EEN LID -- end-to-end, tegen een draaiende server.

   WAT DEZE TOETS BEWIJST, en de tweede is verreweg de belangrijkste:

   1. een lid kan zichzelf, deze sessie of dit toestel strenger zetten, en dat
      werkt meteen door in wat hij nog mag;
   2. hij kan dat NIET voor iemand anders. De sleutel komt uit de sessie, en er
      is geen pad waarlangs er een uit het verzoek binnenkomt. Zonder die regel
      is "bescherm mij" in werkelijkheid een uitlogknop voor willekeurige leden;
   3. verlagen loopt ook voor een lid langs de ceremonie -- juist bij een lid is
      het scenario dat zij moet vangen (iemand heeft de sessie overgenomen en zet
      de bescherming weer uit) het meest waarschijnlijk;
   4. een lid kan de ceremonie van een ANDER lid niet aftekenen, en krijgt
      daarop hetzelfde antwoord als op een nummer dat niet bestaat -- anders is
      de foutmelding zelf een manier om te ontdekken wie er in isolatie staat;
   5. `huis` en `organisatie` staan niet open voor een lid.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - laagOf() de sleutel uit req.body laten halen  -> 2 ZAKT (RAAK).
   - EIGEN_LAGEN uitbreiden met "huis"             -> 5 ZAKT (RAAK).
   - mijnVerzoek() de eigendomscontrole eruit      -> 4 ZAKT (RAAK).
   - de verlagingscontrole uit zet() in de kern    -> 3 ZAKT (RAAK).

   TOETS 2 VING DIE EERSTE MUTATIE TWEE KEER NIET, en dat hoort hier te staan
   omdat het de reden is dat hij nu is zoals hij is:

   1. hij stuurde een VERZONNEN sleutel mee (`cn-a`). Met het gat open schreef de
      route die netjes weg -- naar een sleutel die niemand is. A bewoog niet, dus
      de toets bleef groen. Nu haalt B de ECHTE sleutel van A op, langs dezelfde
      weg als een aanvaller: uit iets wat het slachtoffer zelf heeft laten zien.
   2. daarna zette A zichzelf meteen op `isolatie`. Elke poging van B ketste toen
      af op de VERLAGINGScontrole in plaats van op de sleutelcontrole -- de toets
      mat de verkeerde grens en bleef opnieuw groen. A staat nu op `beschermd`,
      zodat B moet VERSTRENGEN en de sleutelcontrole de enige is die hem stopt.

   Een toets die een gat niet vindt terwijl hij er precies voor is geschreven, is
   de gevaarlijkste soort: hij geeft dekking zonder te dekken.

   Draai los: node --test test/isolatie-lid.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');

let srv;
function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  return fetch(srv.base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function nieuwLid() {
  const u = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const r = await api('/api/auth/register', {
    name: 'Isolatie Lid', email: u + '@x.nl',
    phone: '06' + u.replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business'
  });
  assert.ok(r.body.token, 'lid geregistreerd: ' + JSON.stringify(r.body).slice(0, 200));
  return r.body.token;
}

test.before(async () => { srv = await startServer({ env: { SMTP_URL: '' } }); });
test.after(() => stop(srv && srv.child));

test('1. een lid zet zijn eigen stand, en dat werkt meteen door', async () => {
  const lid = await nieuwLid();
  const voor = await api('/api/isolatie/mijn', {}, lid);
  assert.equal(voor.status, 200, JSON.stringify(voor.body));
  assert.equal(voor.body.mijn.identiteit, 'normaal');

  const zet = await api('/api/isolatie/mijn/zet',
    { drager: 'identiteit', naar: 'beschermd', reden: 'Ik kreeg een vreemde inlogmelding' }, lid);
  assert.equal(zet.status, 200, JSON.stringify(zet.body));
  assert.equal(zet.body.uit.richting, 'verstrengd');

  const na = await api('/api/isolatie/mijn', {}, lid);
  assert.equal(na.body.mijn.identiteit, 'beschermd');
  assert.equal(na.body.effectief.beschermd, true);

  /* Verstrengen mag zonder ceremonie; nog strenger ook. */
  const strenger = await api('/api/isolatie/mijn/zet',
    { drager: 'identiteit', naar: 'isolatie', reden: 'Het wordt erger, alles dicht' }, lid);
  assert.equal(strenger.status, 200, JSON.stringify(strenger.body));
});

test('2. de sleutel komt uit de sessie: een lid raakt een ander lid niet', async () => {
  const a = await nieuwLid();
  const b = await nieuwLid();

  /* A gaat naar `beschermd` en niet meteen naar `isolatie`. Dat is geen detail:
     `zet` weigert elke VERLAGING, dus als A al op het strengste stond, zou elke
     poging van B afketsen op de verlagingscontrole in plaats van op de
     sleutelcontrole -- en dan meet deze toets de verkeerde grens. B probeert dus
     te VERSTRENGEN, want dat is de weg die openstaat. */
  await api('/api/isolatie/mijn/zet',
    { drager: 'identiteit', naar: 'beschermd', reden: 'Ik vertrouw het niet' }, a);

  /* DE ECHTE SLEUTEL VAN A, EN NIET EEN VERZONNEN STRING.

     De eerste versie van deze toets stuurde `cn-a` mee en zag daarna dat A niet
     bewoog. Hij liet zich niet zakken toen de route de sleutel WEL uit het lijf
     ging halen -- want `cn-a` bestaat niet, dus er gebeurde ook dan niets bij A.
     Een toets die een gat niet vindt terwijl hij er precies voor is geschreven,
     is de gevaarlijkste soort: hij geeft dekking zonder te dekken.

     B moet dus de WERKELIJKE sleutel van A meesturen. A haalt hem hier uit zijn
     eigen ontsluitverzoek -- dat is ook precies hoe een aanvaller eraan zou
     komen: uit iets wat het slachtoffer zelf heeft laten zien. */
  const vA = await api('/api/isolatie/mijn/ontsluiting',
    { drager: 'identiteit', naar: 'normaal', reden: 'Toestel opnieuw geverifieerd' }, a);
  const sleutelVanA = vA.body.verzoek.sleutel;
  assert.ok(sleutelVanA, 'de sleutel van A is bekend: ' + JSON.stringify(vA.body).slice(0, 200));

  /* B stuurt hem mee onder elke naam waaronder een route hem zou kunnen lezen.
     Geen ervan mag ergens landen behalve op de EIGEN laag van B. */
  for (const veld of ['sleutel', 'identiteit', 'key', 'lid', 'codenaam']) {
    const lijf = { drager: 'identiteit', naar: 'isolatie', reden: 'Poging op andermans laag' };
    lijf[veld] = sleutelVanA;
    const r = await api('/api/isolatie/mijn/zet', lijf, b);
    if (r.status === 200) {
      assert.notEqual(r.body.uit.sleutel, sleutelVanA,
        'veld "' + veld + '" landde op de laag van A');
    }
  }

  /* En de proef op de som: de stand van A is niet veranderd, en B heeft alleen
     zijn eigen laag gezet. */
  const naA = await api('/api/isolatie/mijn', {}, a);
  const naB = await api('/api/isolatie/mijn', {}, b);
  assert.equal(naA.body.mijn.identiteit, 'beschermd', 'A is door B niet aangeraakt');
  assert.equal(naB.body.mijn.identiteit, 'isolatie', 'B zette wel zijn eigen laag');
});

test('3. verlagen loopt ook voor een lid langs de ceremonie', async () => {
  const lid = await nieuwLid();
  await api('/api/isolatie/mijn/zet',
    { drager: 'identiteit', naar: 'isolatie', reden: 'Ik vertrouw het niet meer' }, lid);

  const rechtstreeks = await api('/api/isolatie/mijn/zet',
    { drager: 'identiteit', naar: 'normaal', reden: 'Toch maar weer open' }, lid);
  assert.equal(rechtstreeks.status, 409, JSON.stringify(rechtstreeks.body));
  assert.match(rechtstreeks.body.error, /verlaagt de beveiliging/);

  const v = await api('/api/isolatie/mijn/ontsluiting',
    { drager: 'identiteit', naar: 'normaal', reden: 'Nieuw toestel, opnieuw geverifieerd' }, lid);
  assert.equal(v.status, 200, JSON.stringify(v.body));
  const id = v.body.verzoek.id;

  /* Het verzoek verlaagt zelf niets. */
  assert.equal((await api('/api/isolatie/mijn', {}, lid)).body.mijn.identiteit, 'isolatie');

  const teVroeg = await api('/api/isolatie/mijn/ontsluiting/commit', { id }, lid);
  assert.equal(teVroeg.status, 409, JSON.stringify(teVroeg.body));

  for (const soort of v.body.verzoek.vereisten) {
    if (soort === 'reden' || soort === 'wachttijd') continue;
    const r = await api('/api/isolatie/mijn/ontsluiting/stap', { id, soort, bewijs: 'proef' }, lid);
    assert.equal(r.status, 200, soort + ': ' + JSON.stringify(r.body));
  }

  /* De wachttijd van tien minuten is er nog, en die IS de grens. Dat de toets
     hier stopt in plaats van de klok te verzetten, is het punt: een ceremonie
     die een toets kan overslaan, kan een aanvaller ook overslaan. */
  const nogSteeds = await api('/api/isolatie/mijn/ontsluiting/commit', { id }, lid);
  assert.equal(nogSteeds.status, 409);
  assert.match(nogSteeds.body.error, /wachttijd/);
  assert.equal((await api('/api/isolatie/mijn', {}, lid)).body.mijn.identiteit, 'isolatie');
});

test('4. een lid kan de ceremonie van een ander niet aftekenen', async () => {
  const a = await nieuwLid();
  const b = await nieuwLid();
  await api('/api/isolatie/mijn/zet', { drager: 'identiteit', naar: 'isolatie', reden: 'Verdachte inlog' }, a);
  const v = await api('/api/isolatie/mijn/ontsluiting',
    { drager: 'identiteit', naar: 'normaal', reden: 'Toestel opnieuw geverifieerd' }, a);
  const id = v.body.verzoek.id;

  for (const pad of ['/api/isolatie/mijn/ontsluiting/stap', '/api/isolatie/mijn/ontsluiting/commit',
    '/api/isolatie/mijn/ontsluiting/afbreken']) {
    const r = await api(pad, { id, soort: 'passkey', reden: 'poging' }, b);
    assert.equal(r.status, 404, pad + ': ' + JSON.stringify(r.body));
    /* HETZELFDE ANTWOORD ALS OP EEN VERZONNEN NUMMER. Zou dit "geen toegang"
       zeggen en een verzonnen nummer "bestaat niet", dan is het verschil tussen
       die twee een manier om te ontdekken wie er in isolatie staat. */
    const verzonnen = await api(pad, { id: 'deadbeefdeadbeef', soort: 'passkey', reden: 'poging' }, b);
    assert.equal(verzonnen.body.error, r.body.error);
  }
});

test('5. huis en organisatie staan niet open voor een lid', async () => {
  const lid = await nieuwLid();
  for (const drager of ['huis', 'organisatie', 'verzonnen']) {
    const r = await api('/api/isolatie/mijn/zet',
      { drager, naar: 'isolatie', reden: 'Poging op een laag die niet van mij is' }, lid);
    assert.equal(r.status, 403, drager + ': ' + JSON.stringify(r.body));
    assert.match(r.body.error, /uw eigen lagen/);
  }
});

/* ---------------------------------------------------------------------------
   6. WAT EEN TWEEDE AANROEP DOET op de ledenroutes -- gemeten, niet aangenomen.

   Deze toets bestaat omdat server/lib/mutatiecontracten-isolatie.js ernaar
   verwijst. Hij vraagt de route twee keer hetzelfde en kijkt of het ANTWOORD en
   de STAND daarna gelijk zijn. Dat is een zwakkere meting dan de byte-voor-byte
   vergelijking in test/isolatie.test.js -- hier draait een echte server met een
   eigen database die ik niet kan uitlezen -- en het contract zegt dat er dus bij.
   ------------------------------------------------------------------------ */
test('6. een tweede aanroep op de ledenroutes', async () => {
  const lid = await nieuwLid();
  const zet = { drager: 'identiteit', naar: 'beschermd', reden: 'Ik kreeg een vreemde inlogmelding' };
  const een = await api('/api/isolatie/mijn/zet', zet, lid);
  const twee = await api('/api/isolatie/mijn/zet', zet, lid);
  assert.equal(een.status, 200);
  assert.equal(twee.status, 200, 'een herhaling hoort niet te struikelen');
  assert.equal(twee.body.uit.richting, 'ongewijzigd',
    'de tweede aanroep ziet dat de stand al klopt en doet niets');

  /* Een tweede ontsluitVERZOEK is met opzet een tweede verzoek: het weigeren zou
     betekenen dat een vergeten open verzoek de drager voorgoed vastzet. */
  const v1 = await api('/api/isolatie/mijn/ontsluiting',
    { drager: 'identiteit', naar: 'normaal', reden: 'Toestel opnieuw geverifieerd' }, lid);
  const v2 = await api('/api/isolatie/mijn/ontsluiting',
    { drager: 'identiteit', naar: 'normaal', reden: 'Toestel opnieuw geverifieerd' }, lid);
  assert.notEqual(v1.body.verzoek.id, v2.body.verzoek.id);

  /* Dezelfde stap twee keer aftekenen laat de EERSTE aftekening staan. */
  const s1 = await api('/api/isolatie/mijn/ontsluiting/stap',
    { id: v1.body.verzoek.id, soort: 'passkey', bewijs: 'een' }, lid);
  const s2 = await api('/api/isolatie/mijn/ontsluiting/stap',
    { id: v1.body.verzoek.id, soort: 'passkey', bewijs: 'twee' }, lid);
  assert.equal(s2.status, 200);
  assert.deepEqual(s2.body.verzoek.voltooid.passkey, s1.body.verzoek.voltooid.passkey);

  /* Afbreken is hooguit eens: de tweede aanroep wordt geweigerd. */
  const a1 = await api('/api/isolatie/mijn/ontsluiting/afbreken', { id: v2.body.verzoek.id, reden: 'toch niet' }, lid);
  const a2 = await api('/api/isolatie/mijn/ontsluiting/afbreken', { id: v2.body.verzoek.id, reden: 'toch niet' }, lid);
  assert.equal(a1.status, 200);
  assert.equal(a2.status, 409);

  /* En het overzicht verandert niets. */
  const o1 = await api('/api/isolatie/mijn', {}, lid);
  const o2 = await api('/api/isolatie/mijn', {}, lid);
  assert.deepEqual(o1.body.mijn, o2.body.mijn);
});
