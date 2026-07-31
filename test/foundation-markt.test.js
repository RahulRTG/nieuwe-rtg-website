/* ============================================================================
   DE MARKTPLAATS VAN DE FOUNDATION -- 4 endpoints.

   detail, verwijder, chat en blokkeer stonden als nooit aangeroepen in de
   waargenomen dekkingsmeting. Plaatsen en de lijst waren wel beproefd; wat
   erna komt niet -- en dat is precies de kant waar twee gezinnen die elkaar
   niet kennen met elkaar in gesprek raken over iets wat ze willen ruilen.

   WAT ER OP HET SPEL STAAT

   - EEN GESPREK IS VAN DE KOPER EN DE VERKOPER. Een derde gezin met een
     geldige inlog hoort er niet bij te kunnen, ook niet met het chat-id.
   - BLOKKEREN MOET ECHT IETS DOEN. Niet "je ziet hem niet meer in de lijst
     maar hij kan je nog steeds bereiken". Dat is het verschil tussen een slot
     en een gordijn, en op een marktplaats waar kinderen meekijken is dat
     verschil het hele punt.
   - EEN ADVERTENTIE IS VAN DE PLAATSER. Weghalen doet hij, niemand anders.
   - EEN KIND MAG KIJKEN, NIET HANDELEN. Maar wel blokkeren: dat is een
     beschermende handeling, geen handelsdaad, en die hoort niet achter een
     volwassene te zitten.

   Draai los: node --experimental-sqlite --test test/foundation-markt.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
let verkoper, koper, derde, adId = null, chatId = null;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-markt-'));

function api(pad, body) {
  return fetch(BASE + '/api/foundation' + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

/* Elk gezin is een eigen marktpartij (code + profiel-id). Het kind is er niet
   voor de sier: de kinderveiligheid van deze module hangt aan het beschermde
   profiel, en die moet je met een echt kind toetsen. */
let t = 0;
async function gezin(naam) {
  const g = (await api('/gezin/maak', { gezinsnaam: naam + (t++), naam: 'Ouder', pin: '1357' })).body;
  const kp = (await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Kind', rol: 'kind' })).body;
  const kt = (await api('/gezin/profiel/kies', { code: g.code, profielId: kp.profiel.id })).body.token;
  const mij = await fetch(BASE + '/api/foundation/gezin/' + g.code + '/mij?token=' + g.token).then(r => r.json());
  return { code: g.code, token: g.token, pid: (mij.profiel || mij).id, kindToken: kt };
}
const zet = (o, G) => Object.assign({ code: G.code, token: G.token }, o);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health' }));
  verkoper = await gezin('De Verkoper');
  koper = await gezin('De Koper');
  derde = await gezin('Het Derde');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een advertentie plaatsen is voor volwassenen; kijken mag het kind wel', async () => {
  const kind = await api('/markt/plaats', { code: verkoper.code, token: verkoper.kindToken,
    titel: 'Mijn oude step', beschrijving: 'Bijna niet gebruikt, staat mooi.', prijs: 20, akkoord: true });
  assert.equal(kind.status, 403, 'een kinderprofiel plaatst niets');
  assert.match(kind.body.error, /kinderveiligheid|volwassenen|Kinderprofielen/i);

  const mk = await api('/markt/plaats', zet({ titel: 'Houten kinderfiets',
    beschrijving: 'Massief beuken, meegegroeid met twee kinderen.', prijs: 45,
    categorie: 'overig', staat: 'gebruikt', akkoord: true }, verkoper));
  assert.equal(mk.status, 200, JSON.stringify(mk.body));
  adId = (mk.body.ad || mk.body).id;
  assert.ok(adId, 'de advertentie heeft een id');

  assert.equal((await api('/markt/plaats', zet({ titel: 'Zonder akkoord', beschrijving: 'Toch maar niet.' }, verkoper))).status, 400,
    'zonder de huisregels te bevestigen kan er niets op');

  // kijken mag het kind wel: dat is de hele afspraak
  assert.equal((await api('/markt/lijst', { code: verkoper.code, token: verkoper.kindToken })).status, 200);
});

test('2. het detail is er voor wie mag kijken, en verdwijnt als de advertentie weg is', async () => {
  const d = await api('/markt/detail', zet({ id: adId }, koper));
  assert.equal(d.status, 200);
  assert.equal(d.body.ad.titel, 'Houten kinderfiets');
  assert.equal((await api('/markt/detail', zet({ id: 'bestaatniet' }, koper))).status, 404);
});

test('3. een gesprek is van de koper en de verkoper, en van niemand anders', async () => {
  const eerste = await api('/markt/reageer', zet({ id: adId, tekst: 'Staat hij er nog? Wij komen uit de buurt.' }, koper));
  assert.equal(eerste.status, 200, JSON.stringify(eerste.body));
  chatId = eerste.body.chat.id || eerste.body.chat.chatId;
  assert.ok(chatId, 'het gesprek heeft een id: ' + JSON.stringify(eerste.body.chat).slice(0, 160));

  assert.equal((await api('/markt/chat', zet({ chatId }, koper))).status, 200, 'de koper opent zijn eigen gesprek');
  assert.equal((await api('/markt/chat', zet({ chatId }, verkoper))).status, 200, 'de verkoper ook');

  /* Een derde gezin met een geldige inlog en het chat-id. Dit is de bewering
     waar het om gaat: het id is geen sleutel. */
  const inbreker = await api('/markt/chat', zet({ chatId }, derde));
  assert.equal(inbreker.status, 403, 'een derde gezin leest niet mee');
  assert.equal((await api('/markt/antwoord', zet({ chatId, tekst: 'Ik neem hem wel' }, derde))).status, 403,
    'en schrijft er al helemaal niet in');
  assert.equal((await api('/markt/chat', zet({ chatId: 'bestaatniet' }, koper))).status, 404);

  // een kind van het kopende gezin mag niet in de handel stappen
  assert.equal((await api('/markt/antwoord', { code: koper.code, token: koper.kindToken, chatId, tekst: 'hoi' })).status, 403,
    'chatten over een koop is voor volwassenen');

  assert.equal((await api('/markt/antwoord', zet({ chatId, tekst: 'Ja hoor, hij staat klaar.' }, verkoper))).status, 200);
  const na = await api('/markt/chat', zet({ chatId }, koper));
  assert.equal(na.body.chat.berichten.length, 2, 'beide kanten staan in hetzelfde gesprek');
});

test('4. blokkeren is een slot, geen gordijn', async () => {
  /* Jezelf blokkeren is geen handeling maar een tikfout, en zou je uit je
     eigen lijst schrijven. */
  assert.equal((await api('/markt/blokkeer', zet({ soort: 'rtf', doelId: koper.code + ':' + koper.pid }, koper))).status, 400,
    'jezelf blokkeren kan niet');
  assert.equal((await api('/markt/blokkeer', zet({ soort: '', doelId: '' }, koper))).status, 400);

  const blok = await api('/markt/blokkeer', zet({ soort: 'rtf', doelId: verkoper.code + ':' + verkoper.pid }, koper));
  assert.equal(blok.status, 200, JSON.stringify(blok.body));

  // uit het zicht: de lijst en het detail
  assert.ok(!(await api('/markt/lijst', zet({}, koper))).body.ads.some(a => a.id === adId),
    'de advertentie is uit de lijst van wie blokkeerde');
  assert.equal((await api('/markt/detail', zet({ id: adId }, koper))).status, 404,
    'en ook rechtstreeks niet meer te openen');

  // maar de verkoper zelf ziet zijn eigen advertentie gewoon
  assert.equal((await api('/markt/detail', zet({ id: adId }, verkoper))).status, 200,
    'de verkoper raakt zijn eigen advertentie niet kwijt door een blokkade van een ander');
  // en een derde partij ziet hem ook nog: een blokkade is persoonlijk
  assert.equal((await api('/markt/detail', zet({ id: adId }, derde))).status, 200, 'een blokkade geldt alleen voor wie hem zette');

  /* EN HET SLOT ZELF -- maar dan de andere kant op, en dat verschil is echt.
     Wie ZELF blokkeert ziet de advertentie niet meer en komt dus bij 404 uit;
     hij botst nooit tegen het slot omdat hij de deur al niet ziet: */
  assert.equal((await api('/markt/reageer', zet({ id: adId, tekst: 'Toch nog een vraag' }, koper))).status, 404,
    'wie zelf blokkeerde ziet de advertentie niet eens meer staan');

  /* Wie GEBLOKKEERD WORDT merkt er niets van in de lijst -- de advertentie
     blijft gewoon staan -- maar bereikt de verkoper niet. Zonder deze bewering
     is blokkeren alleen een filter op je eigen scherm, en dat is precies het
     soort halve maatregel waar mensen op vertrouwen terwijl het niets doet. */
  assert.equal((await api('/markt/blokkeer', zet({ soort: 'rtf', doelId: derde.code + ':' + derde.pid }, verkoper))).status, 200);
  assert.equal((await api('/markt/detail', zet({ id: adId }, derde))).status, 200,
    'de geblokkeerde ziet de advertentie nog: een blokkade verbergt niets voor de ander');
  const bereik = await api('/markt/reageer', zet({ id: adId, tekst: 'Is hij nog te koop?' }, derde));
  assert.equal(bereik.status, 403, 'maar hij bereikt de verkoper niet meer');
  assert.match(bereik.body.error, /niet bereiken/i);

  // een kind mag wel blokkeren: dat is beschermen, geen handel drijven
  assert.equal((await api('/markt/blokkeer', { code: derde.code, token: derde.kindToken,
    soort: 'rtf', doelId: verkoper.code + ':' + verkoper.pid })).status, 200,
    'blokkeren zit niet achter een volwassene: het beschermt juist het kind');
});

test('5. een advertentie haalt weg wie hem plaatste', async () => {
  assert.equal((await api('/markt/verwijder', zet({ id: adId }, derde))).status, 403,
    'een ander gezin haalt jouw advertentie niet weg');
  assert.equal((await api('/markt/verwijder', zet({ id: 'bestaatniet' }, verkoper))).status, 404);

  assert.equal((await api('/markt/verwijder', zet({ id: adId }, verkoper))).status, 200);
  assert.equal((await api('/markt/detail', zet({ id: adId }, derde))).status, 404, 'daarna is hij voor iedereen weg');
  assert.ok(!(await api('/markt/lijst', zet({}, derde))).body.ads.some(a => a.id === adId));
});
