/* De werkplek, tweede helft: WIJZIGEN en WEGGOOIEN.

   test/werkplek.test.js loopt de deur langs en maakt in elk bureau iets aan:
   een ontwerp, een artikel, een idee. Wat daar niet gebeurt is het omgekeerde
   gebaar -- een concept aanpassen, een artikel intrekken, een document uit de
   kantoordrive weggooien -- en dat is precies de kant waar een verkeerd
   afgeschermde route pas echt schade doet. Lezen wat van een ander is, is
   naar; het WEGGOOIEN van wat van een ander is, is onherstelbaar.

   Deze ronde loopt dus de hele bewerk- en wiskant van de ontwerptak af, in
   beide huizen, en toetst steeds dezelfde vraag: blijft het andere huis
   ongemoeid? De id's van beide huizen komen uit dezelfde generator en zien er
   identiek uit, dus een route die het huis niet meeneemt zou hier meteen door
   de mand vallen.

   Draai los:
   node --test test/werkplek-wijzigen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
function post(pad, body, token) {
  return fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let eigenaar, medewerker;
// een bureau-actie als de eigenaar, die in beide huizen mag
const bu = (pad, body) => post('/api/werkplek/bureau' + pad, body, eigenaar);
// een kantoordrive-actie als de eigenaar
const drive = (pad, body, token) => post('/api/werkplek/kantoorpakket' + pad, body, token || eigenaar);

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wpw-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const e = await post('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran' });
  assert.equal(e.status, 200, 'het eigenaarsaccount bestaat en logt in');
  eigenaar = e.body.token;
  const t = Date.now().toString().slice(-7);
  const m = await post('/api/auth/register', { name: 'Wijzig Test', email: 'wpw' + t + '@rtg.test',
    phone: '+31612340001', password: 'Wachtwoord123', geboortedatum: '1990-05-20' });
  assert.equal(m.status, 200);
  medewerker = m.body.token;
});
test.after(() => stop(srv && srv.child));

/* Een ontwerp aanmaken en meteen controleren dat het echt gelukt is -- anders
   toetst de rest van de test een niet-bestaand id, en lijkt "404 voor iedereen"
   ten onrechte op een nette afscherming. */
async function ontwerp(bureau, bedrijf, naam) {
  const r = await bu('/' + bureau + '/maak', { bedrijf, naam, brief: 'Een verkenning voor ' + bedrijf + '.' });
  assert.equal(r.status, 200, bureau + '/maak lukt voor ' + bedrijf + ': ' + JSON.stringify(r.body).slice(0, 160));
  return r.body.ontwerp.id;
}

test('1. een concept aanpassen raakt alleen het huis waar het staat', async () => {
  const rtgId = await ontwerp('atelier', 'rtg', 'RTG-lijn eerste blik');
  const rtfId = await ontwerp('atelier', 'rtf', 'Stichtingslijn eerste blik');

  const zet = await bu('/atelier/zet', { bedrijf: 'rtf', id: rtfId,
    naam: 'Stichtingslijn tweede blik', brief: 'Ingetogener, met minder naden.', status: 'concept' });
  assert.equal(zet.status, 200);
  assert.equal(zet.body.ontwerp.naam, 'Stichtingslijn tweede blik', 'de nieuwe naam staat erin');

  const rtg = (await bu('/atelier', { bedrijf: 'rtg' })).body.ontwerpen;
  assert.equal(rtg.find(o => o.id === rtgId).naam, 'RTG-lijn eerste blik',
    'het ontwerp van RTG heeft er niets van gemerkt');

  // en het id van het ene huis bestaat niet in het andere
  const kruis = await bu('/atelier/zet', { bedrijf: 'rtg', id: rtfId, naam: 'Overgenomen' });
  assert.equal(kruis.status, 404, 'een RTF-id is in het atelier van RTG onbekend');
  const naRtf = (await bu('/atelier', { bedrijf: 'rtf' })).body.ontwerpen;
  assert.equal(naRtf.find(o => o.id === rtfId).naam, 'Stichtingslijn tweede blik',
    'en de poging heeft het RTF-ontwerp ook niet stiekem hernoemd');
});

test('2. weggooien blijft binnen het eigen huis', async () => {
  const rtgId = await ontwerp('studio', 'rtg', 'RTG-cabine');
  const rtfId = await ontwerp('studio', 'rtf', 'Stichtingsbusje');

  // het RTF-id vanuit RTG weggooien: de route zegt netjes ok (verwijderen is
  // een filter, geen opzoeken) maar mag aan de OVERKANT niets veranderen --
  // dat is hier de eigenlijke belofte.
  const kruis = await bu('/studio/verwijder', { bedrijf: 'rtg', id: rtfId });
  assert.equal(kruis.status, 200, 'de route klaagt niet over een onbekend id');
  const rtfNa = (await bu('/studio', { bedrijf: 'rtf' })).body.ontwerpen;
  assert.ok(rtfNa.some(o => o.id === rtfId), 'het ontwerp van de stichting staat er gewoon nog');

  // in het eigen huis gooit hij wel echt weg
  assert.equal((await bu('/studio/verwijder', { bedrijf: 'rtf', id: rtfId })).status, 200);
  const rtfNa2 = (await bu('/studio', { bedrijf: 'rtf' })).body.ontwerpen;
  assert.ok(!rtfNa2.some(o => o.id === rtfId), 'nu is het weg bij de stichting');
  const rtgNa = (await bu('/studio', { bedrijf: 'rtg' })).body.ontwerpen;
  assert.ok(rtgNa.some(o => o.id === rtgId), 'en de cabine van RTG staat er nog steeds');
});

test('3. hardware en architect: aanpassen, weggooien en het eigen blad', async () => {
  // hardware: serie + productblad
  const hw = await ontwerp('hardware', 'rtf', 'Clubhuis-bel');
  assert.equal((await bu('/hardware/serie', { bedrijf: 'rtf', naam: 'Clubhuis-serie', seizoen: '2026' })).status, 200);
  assert.equal((await bu('/hardware/zet', { bedrijf: 'rtf', id: hw, collectie: 'Clubhuis-serie' })).status, 200);
  const blad = await bu('/hardware/productblad', { bedrijf: 'rtf', naam: 'Clubhuis-serie' });
  assert.equal(blad.status, 200);
  assert.equal(blad.body.aantal, 1, 'de bel hangt aan de serie');
  // de serie van de stichting bestaat niet bij RTG
  assert.equal((await bu('/hardware/productblad', { bedrijf: 'rtg', naam: 'Clubhuis-serie' })).status, 404,
    'RTG kent de serie van de stichting niet');
  assert.equal((await bu('/hardware/productblad', { bedrijf: 'rtf' })).status, 400, 'zonder naam geen blad');

  // architect: project + portfolio
  const ar = await ontwerp('architect', 'rtf', 'Clubhuis Rotterdam-Zuid');
  assert.equal((await bu('/architect/project', { bedrijf: 'rtf', naam: 'Clubhuizen 2026' })).status, 200);
  assert.equal((await bu('/architect/zet', { bedrijf: 'rtf', id: ar, collectie: 'Clubhuizen 2026' })).status, 200);
  const port = await bu('/architect/portfolio', { bedrijf: 'rtf', naam: 'Clubhuizen 2026' });
  assert.equal(port.status, 200);
  assert.equal(port.body.aantal, 1);
  assert.equal((await bu('/architect/portfolio', { bedrijf: 'rtg', naam: 'Clubhuizen 2026' })).status, 404);

  // studio: programma + lookbook, langs hetzelfde patroon
  const st = await ontwerp('studio', 'rtf', 'Clubbusje');
  assert.equal((await bu('/studio/collectie', { bedrijf: 'rtf', naam: 'Vervoer 2026' })).status, 200);
  assert.equal((await bu('/studio/zet', { bedrijf: 'rtf', id: st, collectie: 'Vervoer 2026' })).status, 200);
  assert.equal((await bu('/studio/lookbook', { bedrijf: 'rtf', naam: 'Vervoer 2026' })).body.aantal, 1);
  assert.equal((await bu('/studio/lookbook', { bedrijf: 'rtg', naam: 'Vervoer 2026' })).status, 404);

  // atelier: collectie + weggooien in het architectenbureau
  assert.equal((await bu('/atelier/collectie', { bedrijf: 'rtf', naam: 'Vrijwilligers 2026' })).status, 200);
  assert.equal((await bu('/architect/verwijder', { bedrijf: 'rtf', id: ar })).status, 200);

  const hwVoorRtg = (await bu('/hardware', { bedrijf: 'rtg' })).body.ontwerpen.length;
  assert.equal((await bu('/hardware/verwijder', { bedrijf: 'rtf', id: hw })).status, 200);
  const hwNa = await bu('/hardware', { bedrijf: 'rtf' });
  assert.equal(hwNa.status, 200);
  assert.ok(!hwNa.body.ontwerpen.some(o => o.id === hw), 'de bel is uit het lab van de stichting');
  assert.equal((await bu('/hardware', { bedrijf: 'rtg' })).body.ontwerpen.length, hwVoorRtg,
    'en het lab van RTG telt nog evenveel als ervoor');

  assert.equal((await bu('/atelier/verwijder', { bedrijf: 'rtf', id: 'bestaatniet' })).status, 200,
    'een onbekend id weggooien is stil -- er valt niets te verklappen');
});

test('4. de AI van elk bureau werkt op het eigen huis en op een bestaand concept', async () => {
  const id = await ontwerp('atelier', 'rtf', 'Vrijwilligersjas');
  const c = await bu('/atelier/concept', { bedrijf: 'rtf', id });
  assert.equal(c.status, 200, 'het concept rolt eruit (zonder API-sleutel uit de eigen bank)');
  const k = await bu('/atelier/kritiek', { bedrijf: 'rtf', id, q: 'Is dit ingetogen genoeg?' });
  assert.equal(k.status, 200);

  // hetzelfde id vanuit RTG bestaat niet, ook niet voor de AI
  assert.equal((await bu('/atelier/concept', { bedrijf: 'rtg', id })).status, 404);
  assert.equal((await bu('/atelier/kritiek', { bedrijf: 'rtg', id, q: 'En nu?' })).status, 404);

  // de andere drie ontwerpbureaus doen precies hetzelfde
  for (const bureau of ['studio', 'hardware', 'architect']) {
    const oid = await ontwerp(bureau, 'rtf', 'AI-proef ' + bureau);
    assert.equal((await bu('/' + bureau + '/concept', { bedrijf: 'rtf', id: oid })).status, 200, bureau + ' denkt mee');
    assert.equal((await bu('/' + bureau + '/kritiek', { bedrijf: 'rtf', id: oid, q: 'Klopt de verhouding?' })).status, 200);
    assert.equal((await bu('/' + bureau + '/concept', { bedrijf: 'rtg', id: oid })).status, 404, bureau + ' van RTG kent het niet');
  }
});

test('5. de redactie: de statusketen, en wat een gepubliceerd artikel beschermt', async () => {
  const maak = await bu('/redactie/artikel/maak', { bedrijf: 'rtf', kop: 'Het lab opent zijn deuren',
    rubriek: 'nieuws', intro: 'Een eerste rondleiding.', tekst: 'Het onderzoekslab laat zien waar het aan werkt.' });
  assert.equal(maak.status, 200);
  const aid = maak.body.artikel.id;

  // aanpassen mag zolang het een concept is
  const zet = await bu('/redactie/artikel/zet', { bedrijf: 'rtf', id: aid, kop: 'Het lab opent zijn deuren wagenwijd' });
  assert.equal(zet.status, 200);
  assert.equal(zet.body.artikel.kop, 'Het lab opent zijn deuren wagenwijd');

  // een onbekende status wordt geweigerd
  assert.equal((await bu('/redactie/artikel/status', { bedrijf: 'rtf', id: aid, status: 'verzonnen' })).status, 400);

  // publiceren, en daarna staat de tekst vast
  const pub = await bu('/redactie/artikel/status', { bedrijf: 'rtf', id: aid, status: 'gepubliceerd' });
  assert.equal(pub.status, 200);
  assert.equal(pub.body.artikel.status, 'gepubliceerd');
  const naPub = await bu('/redactie/artikel/zet', { bedrijf: 'rtf', id: aid, kop: 'Stiekem herschreven' });
  assert.equal(naPub.status, 409, 'een gepubliceerd artikel herschrijf je niet meer');
  assert.match(naPub.body.error, /vervolgstuk/i, 'en de redactie legt uit wat dan wel');

  // een leeg artikel publiceren kan niet
  const leeg = await bu('/redactie/artikel/maak', { bedrijf: 'rtf', kop: 'Nog niets geschreven' });
  assert.equal((await bu('/redactie/artikel/status', { bedrijf: 'rtf', id: leeg.body.artikel.id, status: 'gepubliceerd' })).status, 400,
    'zonder tekst gaat er niets de krant in');
  assert.equal((await bu('/redactie/artikel/verwijder', { bedrijf: 'rtf', id: leeg.body.artikel.id })).status, 200);

  // het artikel van de stichting bestaat niet bij de redactie van RTG
  assert.equal((await bu('/redactie/artikel/zet', { bedrijf: 'rtg', id: aid, kop: 'Overgenomen' })).status, 404);
  assert.equal((await bu('/redactie/artikel/status', { bedrijf: 'rtg', id: aid, status: 'concept' })).status, 404);
  const rtgKrant = (await bu('/redactie', { bedrijf: 'rtg' })).body.artikelen;
  assert.ok(!rtgKrant.some(a => a.id === aid), 'en hij staat ook niet in de krant van RTG');
});

test('6. de drukstraat draait maar een kant op', async () => {
  // een editie heeft minstens een GEPUBLICEERD artikel nodig
  const concept = await bu('/redactie/artikel/maak', { bedrijf: 'rtf', kop: 'Nog in de week',
    tekst: 'Deze staat nog op de schrijftafel.' });
  const cid = concept.body.artikel.id;
  const teVroeg = await bu('/redactie/editie/maak', { bedrijf: 'rtf', titel: 'Te vroege krant', artikelIds: [cid] });
  assert.equal(teVroeg.status, 400, 'een concept haalt de drukkerij niet');
  assert.match(teVroeg.body.error, /GEPUBLICEERD/);

  assert.equal((await bu('/redactie/artikel/status', { bedrijf: 'rtf', id: cid, status: 'gepubliceerd' })).status, 200);
  const ed = await bu('/redactie/editie/maak', { bedrijf: 'rtf', titel: 'Stichtingskrant 1', artikelIds: [cid], oplage: 500 });
  assert.equal(ed.status, 200);
  const eid = ed.body.editie.id;
  assert.equal(ed.body.editie.status, 'samenstellen');

  assert.equal((await bu('/redactie/editie/status', { bedrijf: 'rtf', id: eid, status: 'ter-perse' })).status, 200);
  const terug = await bu('/redactie/editie/status', { bedrijf: 'rtf', id: eid, status: 'samenstellen' });
  assert.equal(terug.status, 409, 'terug naar samenstellen kan niet');
  assert.match(terug.body.error, /achteruit/i);

  const proef = await bu('/redactie/drukproef', { bedrijf: 'rtf', id: eid });
  assert.equal(proef.status, 200);
  assert.match(proef.body.blad, /Nog in de week/, 'het artikel staat echt in de proef');

  // de editie van de stichting is bij RTG onbekend
  assert.equal((await bu('/redactie/drukproef', { bedrijf: 'rtg', id: eid })).status, 404);
  assert.equal((await bu('/redactie/editie/status', { bedrijf: 'rtg', id: eid, status: 'gedrukt' })).status, 404);

  // de tips en de schrijfhulp van de hoofdredacteur horen bij het eigen huis
  assert.equal((await bu('/redactie/nieuwstips', { bedrijf: 'rtf' })).status, 200);
  assert.equal((await bu('/redactie/ai/schrijf', { bedrijf: 'rtf', onderwerp: 'Het nieuwe clubhuis', rubriek: 'nieuws' })).status, 200);
  assert.equal((await bu('/redactie/ai/redactie', { bedrijf: 'rtf', id: cid })).status, 200);
  assert.equal((await bu('/redactie/ai/redactie', { bedrijf: 'rtg', id: cid })).status, 404);
});

test('7. de ideeenkamer: bijwerken, reageren en weggooien per huis', async () => {
  const mk = await bu('/ideeen/maak', { bedrijf: 'rtf', titel: 'Een bank die meegroeit',
    brief: 'Een zitbank die met het clubhuis meebeweegt.', bureaus: ['atelier'] });
  assert.equal(mk.status, 200);
  const iid = mk.body.idee.id;

  const zet = await bu('/ideeen/zet', { bedrijf: 'rtf', id: iid, titel: 'Een bank die meegroeit met de club',
    bureaus: ['atelier', 'architect'] });
  assert.equal(zet.status, 200);
  // de ideeenkamer geeft per bureau een kaartje terug, niet alleen de sleutel
  assert.deepEqual(zet.body.idee.bureaus.map(b => b.id).sort(), ['architect', 'atelier']);

  const re = await bu('/ideeen/reactie', { bedrijf: 'rtf', id: iid, door: 'Architect', tekst: 'De hoogte kan mee met de leeftijd.' });
  assert.equal(re.status, 200);
  assert.equal(re.body.idee.reacties.length, 1);
  assert.equal((await bu('/ideeen/reactie', { bedrijf: 'rtf', id: iid })).status, 400, 'een lege reactie telt niet');

  const uit = await bu('/ideeen/uitwerken', { bedrijf: 'rtf', id: iid });
  assert.equal(uit.status, 200, 'de AI maakt er een brief per bureau van');

  // vanuit RTG bestaat dit idee niet -- niet om te lezen, te wijzigen of te weg te gooien
  assert.equal((await bu('/ideeen/zet', { bedrijf: 'rtg', id: iid, titel: 'Overgenomen' })).status, 404);
  assert.equal((await bu('/ideeen/reactie', { bedrijf: 'rtg', id: iid, tekst: 'Mooi' })).status, 404);
  assert.equal((await bu('/ideeen/uitwerken', { bedrijf: 'rtg', id: iid })).status, 404);
  assert.equal((await bu('/ideeen/verwijder', { bedrijf: 'rtg', id: iid })).status, 200,
    'weggooien is ook hier een stille filter');
  const naKruis = (await bu('/ideeen', { bedrijf: 'rtf' })).body.ideeen;
  assert.ok(naKruis.some(i => i.id === iid), 'maar het idee van de stichting staat er nog');

  assert.equal((await bu('/ideeen/verwijder', { bedrijf: 'rtf', id: iid })).status, 200);
  const na = (await bu('/ideeen', { bedrijf: 'rtf' })).body.ideeen;
  assert.ok(!na.some(i => i.id === iid), 'in het eigen huis gaat hij wel weg');
});

test('8. de kantoordrive van een huis is echt van dat huis', async () => {
  const mk = await drive('/maak', { bedrijf: 'rtf', soort: 'tekst', titel: 'Jaarplan stichting' });
  assert.equal(mk.status, 200, JSON.stringify(mk.body).slice(0, 160));
  const did = mk.body.id;
  assert.ok(did, 'we hebben een document-id');

  const open = await drive('/open', { bedrijf: 'rtf', id: did });
  assert.equal(open.status, 200);
  assert.equal(open.body.titel, 'Jaarplan stichting');

  /* Hetzelfde document via het andere huis. De documenten van beide drives
     liggen in EEN bak; wat ze scheidt is de sleutel van het huis. Het antwoord
     is dus 403 en niet 404: RTG weet dat er iets is, maar komt er niet in. */
  const vreemd = await drive('/open', { bedrijf: 'rtg', id: did });
  assert.equal(vreemd.status, 403, 'de drive van RTG komt niet in het jaarplan van de stichting');
  assert.equal(vreemd.body.inhoud, undefined, 'en er komt geen inhoud mee');

  assert.equal((await drive('/bewaar', { bedrijf: 'rtf', id: did, inhoud: { tekst: 'Eerste opzet van het jaarplan.' } })).status, 200);
  assert.equal((await drive('/bewaar', { bedrijf: 'rtf', id: did, inhoud: { tekst: 'Tweede opzet, korter.' } })).status, 200);
  assert.equal((await drive('/bewaar', { bedrijf: 'rtg', id: did, inhoud: { tekst: 'Overgeschreven door RTG.' } })).status, 403,
    'en schrijven mag RTG er al helemaal niet in');

  const versies = await drive('/versies', { bedrijf: 'rtf', id: did });
  assert.equal(versies.status, 200);
  assert.ok(versies.body.versies.length >= 1, 'er staat minstens een oude stand onder het document');
  assert.equal((await drive('/versies', { bedrijf: 'rtg', id: did })).status, 403,
    'ook de geschiedenis is niet in te zien vanuit het andere huis');

  const terug = await drive('/terug', { bedrijf: 'rtf', id: did, nr: 0 });
  assert.equal(terug.status, 200);
  assert.equal(terug.body.inhoud.tekst, 'Eerste opzet van het jaarplan.', 'de vorige stand staat er weer');
  assert.equal((await drive('/terug', { bedrijf: 'rtg', id: did, nr: 0 })).status, 403);

  assert.equal((await drive('/ster', { bedrijf: 'rtf', id: did, aan: true })).body.ster, true);
  assert.equal((await drive('/ster', { bedrijf: 'rtg', id: did, aan: false })).status, 403);

  const ai = await drive('/ai', { bedrijf: 'rtf', id: did, opdracht: 'samenvatten' });
  assert.equal(ai.status, 200, 'de schrijfhulp werkt op het document van dit huis');
  assert.ok(ai.body.voorstel, 'en levert een voorstel, geen besluit');
  assert.equal((await drive('/ai', { bedrijf: 'rtf', id: did, opdracht: 'verzonnen' })).status, 400);
  assert.equal((await drive('/ai', { bedrijf: 'rtg', id: did, opdracht: 'samenvatten' })).status, 403);

  // de deur van de drive is dezelfde als die van de werkplek
  assert.equal((await drive('/mijn', { bedrijf: 'rtf' }, medewerker)).status, 403, 'zonder sleutel geen map');
  assert.equal((await drive('/open', { bedrijf: 'bestaatniet', id: did })).status, 404);

  // weggooien blijft binnen het huis: eerst vanuit RTG proberen
  assert.equal((await drive('/weg', { bedrijf: 'rtg', id: did })).status, 403,
    'alleen de eigenaar van het document gooit het weg');
  assert.equal((await drive('/open', { bedrijf: 'rtf', id: did })).status, 200,
    'het jaarplan van de stichting staat er dus nog');
  assert.equal((await drive('/weg', { bedrijf: 'rtf', id: did })).status, 200);
  assert.equal((await drive('/open', { bedrijf: 'rtf', id: did })).status, 404, 'nu is het weg');
});

test('9. een formulier in de drive: invullen en de uitslag, per huis', async () => {
  const mk = await drive('/maak', { bedrijf: 'rtf', soort: 'formulier', titel: 'Aanmelding vrijwilligers' });
  assert.equal(mk.status, 200, JSON.stringify(mk.body).slice(0, 160));
  const did = mk.body.id;

  // het lege formulier heeft een open vraag; antwoorden gaan op volgorde mee
  const vul = await drive('/vul', { bedrijf: 'rtf', id: did, antwoorden: ['Ik help graag mee bij het clubhuis.'] });
  assert.equal(vul.status, 200, JSON.stringify(vul.body).slice(0, 160));
  assert.equal(vul.body.aantal, 1);
  assert.equal((await drive('/vul', { bedrijf: 'rtf', id: did, antwoorden: [''] })).status, 400,
    'een leeg formulier insturen telt niet als antwoord');

  const uit = await drive('/uitslag', { bedrijf: 'rtf', id: did });
  assert.equal(uit.status, 200);

  // en ook hier: het andere huis komt er niet bij
  assert.equal((await drive('/vul', { bedrijf: 'rtg', id: did, antwoorden: ['Van RTG'] })).status, 403);
  assert.equal((await drive('/uitslag', { bedrijf: 'rtg', id: did })).status, 403);
  assert.equal((await drive('/vul', { bedrijf: 'rtf' })).status, 404, 'zonder id valt er niets in te vullen');

  // een tekstdocument is geen formulier, en zegt dat ook
  const tekst = await drive('/maak', { bedrijf: 'rtf', soort: 'tekst', titel: 'Geen formulier' });
  assert.equal((await drive('/uitslag', { bedrijf: 'rtf', id: tekst.body.id })).status, 400);
});

test('10. de bezetting en de takenlijst van een huis staan los van het andere', async () => {
  const zet = await post('/api/werkplek/mens', { bedrijf: 'rtf', codenaam: 'Zilveren Kievit 9K3M', functie: 'Clubcoach' }, eigenaar);
  assert.equal(zet.status, 200);
  const persoon = zet.body.mensen.find(m => m.codenaam === 'Zilveren Kievit 9K3M');
  assert.ok(persoon, 'de persoon staat op de lijst -- op codenaam, niet op echte naam');

  const taak = await post('/api/werkplek/taak', { bedrijf: 'rtf', tekst: 'Clubhuis-sleutels tellen' }, eigenaar);
  assert.equal(taak.status, 200);
  const tid = taak.body.taken[0].id;

  // dezelfde id's vanuit RTG: onbekend, en aan de overkant verandert niets
  assert.equal((await post('/api/werkplek/mens-weg', { bedrijf: 'rtg', id: persoon.id }, eigenaar)).status, 404);
  assert.equal((await post('/api/werkplek/taak-zet', { bedrijf: 'rtg', taakId: tid, af: true }, eigenaar)).status, 404);
  const nogSteeds = (await post('/api/werkplek/overzicht', { bedrijf: 'rtf' }, eigenaar)).body;
  assert.ok(nogSteeds.mensen.some(m => m.id === persoon.id), 'de coach staat er nog bij de stichting');
  assert.equal(nogSteeds.taken.find(t => t.id === tid).af, false, 'en de taak staat nog open');

  // in het eigen huis werkt het wel
  const af = await post('/api/werkplek/taak-zet', { bedrijf: 'rtf', taakId: tid, af: true }, eigenaar);
  assert.equal(af.status, 200);
  assert.equal(af.body.taken.find(t => t.id === tid).af, true, 'de taak is afgevinkt');
  assert.equal((await post('/api/werkplek/mens-weg', { bedrijf: 'rtf', id: persoon.id }, eigenaar)).status, 200);
  const leeg = (await post('/api/werkplek/overzicht', { bedrijf: 'rtf' }, eigenaar)).body;
  assert.ok(!leeg.mensen.some(m => m.id === persoon.id), 'de coach is van de lijst');

  // en zonder sleutel komt een medewerker aan geen van beide kanten
  assert.equal((await post('/api/werkplek/mens-weg', { bedrijf: 'rtf', id: 'x' }, medewerker)).status, 403);
  assert.equal((await post('/api/werkplek/taak-zet', { bedrijf: 'rtf', taakId: 'x' }, medewerker)).status, 403);
});
