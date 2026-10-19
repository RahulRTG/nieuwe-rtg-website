/* HET IDOR-OORDEEL, NAGETROKKEN. Een 2xx is een BEVINDING (kan publiek zijn),
   een 401/403/404 is het bewijs van scheiding, en een 400 zegt niets over
   eigenaarschap. En een weigering die een persoonsveld prijsgeeft is zelf een
   lek, ook al is de scheiding op orde. Puur oordeel, los toetsbaar (LAT.md
   regel 10): het instrument eromheen heeft een server nodig, deze regel niet.

   Draai los: node --experimental-sqlite --test test/idor.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { oordeelIdor, verseHerhaalsleutel, idemBotsing } = require('../scripts/lib/idor');

test('een 2xx is een doorbraak-BEVINDING, geen vonnis', () => {
  const o = oordeelIdor(200, '{"ok":true}');
  assert.equal(o.staat, 'doorbraak');
  assert.match(o.reden, /NAKIJKEN/, 'de reden dwingt het handmatig nakijken af');
});

test('401/403/404 is het bewijs van scheiding', () => {
  for (const s of [401, 403, 404]) {
    assert.equal(oordeelIdor(s, '{"error":"niet van jou"}').staat, 'gescheiden', 'status ' + s);
  }
});

test('een 400 zegt niets over eigenaarschap: onbereikbaar', () => {
  assert.equal(oordeelIdor(400, '{"error":"veld ontbreekt"}').staat, 'onbereikbaar');
  assert.equal(oordeelIdor(0, '').staat, 'onbereikbaar', 'een dode verbinding ook');
});

test('het IDOR-register draagt geen ONVERKLAARDE doorbraak', () => {
  /* De uitkomst van de proef, bewaakt: elke doorbraak-kandidaat is ofwel echt
     (staat: doorbraak, en dan hoort er een mens naar te kijken) ofwel met de
     hand afgedaan (staat: nagekeken, met een reden). Wat deze toets hard
     maakt: er staat op dit moment GEEN enkele onverklaarde doorbraak in het
     register. Komt er een bij -- een nieuwe route waar B met A's echte id
     binnenkomt -- dan zakt dit, en dat is precies de bedoeling: een IDOR-lek
     mag nooit stil in een register verdwijnen. */
  const fs = require('fs');
  const path = require('path');
  let reg;
  try { reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'IDOR.json'), 'utf8')); }
  catch (e) { assert.fail('IDOR.json ontbreekt of is onleesbaar; geen isolationbewijs: ' + e.message); }
  const open = Object.entries(reg.perRoute || {}).filter(([, v]) => v.staat === 'doorbraak');
  assert.deepEqual(open.map(([r]) => r), [],
    'er staan ONVERKLAARDE IDOR-doorbraken in IDOR.json: ' + open.map(([r]) => r).join(', ') +
    ' -- kijk ze na en verklaar ze (NAGEKEKEN in scripts/idorproef.js) of repareer het lek');
  assert.ok((reg.gemeten.gescheiden || 0) >= 50,
    'de proef hoort tientallen routes als bewezen-gescheiden te melden, vond ' + reg.gemeten.gescheiden);
});

test('het IDOR-register draagt geen onverklaarde WERKPLEK-doorbraak', () => {
  /* De tweede gang: de objectpoort-routes (/api/werkplek/*), geijkt op de
     eigenaar -- want een weigering voor B bewijst pas iets als de deur voor de
     RECHTMATIGE persoon opengaat. Waar dat lukte, hoort B eruit te blijven. */
  const fs = require('fs');
  const path = require('path');
  let reg;
  try { reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'IDOR.json'), 'utf8')); }
  catch (e) { assert.fail('IDOR.json ontbreekt of is onleesbaar; geen isolationbewijs: ' + e.message); }
  const w = reg.werkplekPerRoute || {};
  const open = Object.entries(w).filter(([, v]) => v.staat === 'doorbraak');
  assert.deepEqual(open.map(([r]) => r), [],
    'lid B kwam binnen op een werkplek waar hij geen toegang toe heeft: ' + open.map(([r]) => r).join(', '));
  assert.ok((reg.gemeten.werkplek || {}).gescheiden >= 10,
    'de werkplek-gang hoort tientallen routes als bewezen-gescheiden te melden, met een open deur ' +
    'als ijking; vond ' + JSON.stringify(reg.gemeten.werkplek));
});

test('het IDOR-register draagt geen onverklaarde ZAAK-doorbraak', () => {
  /* Gang 5: twee zaken (KIKUNOI tegen PONTO) op de leveranciersroutes. Een
     andere zaak die met het object van deze zaak binnenkomt, is een lek tussen
     bedrijven; elke kandidaat hoort nagekeken of gerepareerd. Een register van
     voor gang 5 heeft geen zaakPerRoute en zegt hier dus niets. */
  const fs = require('fs');
  const path = require('path');
  let reg;
  try { reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'IDOR.json'), 'utf8')); }
  catch (e) { assert.fail('IDOR.json ontbreekt of is onleesbaar: ' + e.message); }
  const open = Object.entries(reg.zaakPerRoute || {}).filter(([, v]) => v.staat === 'doorbraak');
  assert.deepEqual(open.map(([r]) => r), [],
    'een andere zaak kwam binnen met het object van deze zaak: ' + open.map(([r]) => r).join(', '));
});

test('de proef overleeft zijn eigen ronde: een 401 van een DODE sessie telt niet', () => {
  /* DE FOUT DIE DIT VASTHOUDT, en hij maakte de uitslag beter dan de waarheid.
     De proef loopt alle member-schrijfroutes langs, en /api/logout hoort daarbij.
     Vanaf dat punt was het token ongeldig, en dan gebeurde er dit: de objectpool
     stopte met vullen (120 velden in plaats van 428), en elke volgende 401 werd
     door oordeelIdor gelezen als "bewezen gescheiden" terwijl er alleen maar geen
     sessie was. Honderden routes stonden als bewijs in een register zonder dat
     iemand iets had geweigerd.

     De reparatie is niet "logout overslaan" maar een 401 niet geloven voordat is
     vastgesteld dat de sessie nog leeft; is hij dood, dan wordt hij vernieuwd en
     gaat de route over. Deze toets houdt vast DAT dat gebeurt: de proef loopt nog
     steeds langs een route die zijn eigen sessie beeindigt, dus hij hoort minstens
     een keer te hebben moeten herstellen. Zakt dit, kijk dan eerst of /api/logout
     nog in de rij zit -- verdwijnt die, dan is nul juist goed en hoort deze toets
     mee te veranderen. */
  const fs = require('fs');
  const path = require('path');
  let reg;
  try { reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'IDOR.json'), 'utf8')); }
  catch (e) { assert.fail('IDOR.json ontbreekt of is onleesbaar; geen isolationbewijs: ' + e.message); }
  assert.ok((reg.gemeten || {}).sessieHernieuwd >= 1,
    'de proef raakt /api/logout aan en hoort zijn sessie te herstellen; gemeten: ' +
    JSON.stringify((reg.gemeten || {}).sessieHernieuwd));
  /* En het gevolg dat ertoe doet: met een levende sessie oogst de pool ruim, en
     dat is wat de meting scherp maakt. Blijft dit getal laag, dan meet de proef
     vooral zijn eigen onbereikbaarheid. */
  assert.ok((reg.gemeten.poolVelden || 0) >= 400,
    'een pool die halverwege stopt met vullen laat de proef vooral onbereikbaar meten; velden: ' +
    reg.gemeten.poolVelden);

  /* EN EEN LAAG DIEPER. Dezelfde gang komt langs /api/privacy/delete, en dat
     wist het account zelf -- een verse sessie helpt daar niet, want er is geen
     lid meer om in te loggen. Gemeten op route 1147 van de 1480: alles daarna
     oogstte niets. De proef vervangt zijn proefpersoon nu, en dat hoort te
     gebeuren; blijft dit nul, kijk dan of privacy/delete nog in de rij zit. */
  /* Sinds /api/privacy/delete een zwaar pad is (kern/identiteit/
     bezitsbewijs.js) komt de proef zonder gebonden toestel niet meer tot het
     wissen: dan is er niets te vervangen. Nul is dan alleen goed als het
     register ZEGT dat de route aan de toesteldeur bleef -- niet als hij stil uit
     de rij verdween, en niet als hij als "gescheiden" telt. */
  const wis = (reg.perRoute || {})['POST /api/privacy/delete'];
  const aanDeToesteldeur = !!wis && wis.staat === 'onbereikbaar' && /bezitsbewijs vereist/.test(wis.reden || '');
  assert.ok((reg.gemeten || {}).subjectVervangen >= 1 || aanDeToesteldeur,
    'de proef wist zijn eigen proefpersoon en hoort hem te vervangen, of het register zegt dat privacy/delete aan de toesteldeur bleef; gemeten: ' +
    JSON.stringify((reg.gemeten || {}).subjectVervangen) + ', privacy/delete: ' + JSON.stringify(wis));
});

test('een weigering aan de toesteldeur is geen scheiding: de eigenaarschapsvraag is niet gesteld', () => {
  const deur = oordeelIdor(403, '{"error":"Deze handeling vraagt een toestel dat zijn sleutel kan aantonen.","bezitsbewijs":"vereist"}');
  assert.equal(deur.staat, 'onbereikbaar', 'een zwaar pad weigert ook het eigen object van B zonder toestel');
  assert.match(deur.reden, /bezitsbewijs vereist/);
  const gebonden = oordeelIdor(401, '{"error":"Deze sessie is aan een sleutel gebonden.","bezitsbewijs":"vereist"}');
  assert.equal(gebonden.staat, 'onbereikbaar');
  const gewoon = oordeelIdor(403, '{"error":"Dit is niet van jou."}');
  assert.equal(gewoon.staat, 'gescheiden', 'een gewone weigering blijft een scheiding');
});

test('de tegenpoging krijgt een EIGEN herhaalsleutel, zodat de idem-laag niet meespreekt', () => {
  /* DE VALS-POSITIEF DIE DIT VASTHOUDT (besluit 19 oktober 2026). De kruisproef
     stuurde de tegenpoging (verzonnen id) met DEZELFDE idem als B's eerste
     poging. De idem-laag gaf dan 409 IDEM_ANDER_VERZOEK -- een botsing met B's
     eigen verzoek -- en de proef las dat als "verzonnen id geweigerd" =
     doorbraak. Tien geldapps stonden zo ten onrechte op DEFECT. De sleutel hoort
     per poging vers te zijn; het id en de rest van het lijf onaangeroerd. */
  const lijf = { idem: 'zelfde-sleutel', zaak: 'Festival', aantal: 1, id: 'A-123' };
  const vers = verseHerhaalsleutel(lijf);
  assert.notEqual(vers.idem, lijf.idem, 'de herhaalsleutel is vernieuwd');
  assert.equal(vers.zaak, 'Festival', 'de rest van het lijf blijft');
  assert.equal(vers.id, 'A-123', 'het id blijft (dat vervangt de kruisproef zelf door een verzonnen id)');
  assert.equal(lijf.idem, 'zelfde-sleutel', 'het origineel wordt niet gemuteerd');
  assert.notEqual(verseHerhaalsleutel(lijf).idem, verseHerhaalsleutel(lijf).idem, 'twee pogingen krijgen twee sleutels');

  assert.equal(verseHerhaalsleutel({ idempotentieSleutel: 'x', a: 1 }).a, 1);
  assert.notEqual(verseHerhaalsleutel({ idempotentieSleutel: 'x' }).idempotentieSleutel, 'x', 'ook idempotentieSleutel');
  assert.deepEqual(verseHerhaalsleutel({ zaak: 'z' }), { zaak: 'z' }, 'een lijf zonder sleutel blijft gelijk');
});

test('een 409 IDEM_ANDER_VERZOEK telt nooit als bewijs van eigendom of scheiding', () => {
  assert.equal(idemBotsing(409, '{"error":"...","code":"IDEM_ANDER_VERZOEK"}'), true);
  assert.equal(idemBotsing(409, '{"error":"al een open rekening"}'), false,
    'een ANDERE 409 (een echte toestandsbotsing) is geen idem-botsing en blijft meetellen');
  assert.equal(idemBotsing(200, '{"code":"IDEM_ANDER_VERZOEK"}'), false, 'alleen bij 409');
  assert.equal(idemBotsing(404, ''), false);
});

test('het IDOR-register draagt geen doorbraak die op een idem-botsing berust', () => {
  /* De vals-positief, bewaakt in de uitslag zelf: geen enkele route mag als
     doorbraak staan met een tegenpoging die 409 was. Een register van voor deze
     reparatie kent het veld `tegenpoging` niet en zegt hier niets. */
  const fs = require('fs');
  const path = require('path');
  let reg;
  try { reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'IDOR.json'), 'utf8')); }
  catch (e) { return; } // geen register: niets te bewaken hier
  for (const bak of ['perRoute', 'zaakPerRoute', 'werkplekPerRoute']) {
    const fout = Object.entries(reg[bak] || {}).filter(([, v]) => v.staat === 'doorbraak' && v.tegenpoging === 409);
    assert.deepEqual(fout.map(([r]) => r), [],
      bak + ': een doorbraak die op een 409-tegenpoging berust is een idem-botsing, geen lek: ' + fout.map(([r]) => r).join(', '));
  }
});

test('een weigering die een persoonsveld lekt is gescheiden EN een lek', () => {
  const lek = oordeelIdor(403, '{"error":"verboden","naam":"Noor de Vries"}');
  assert.equal(lek.staat, 'gescheiden');
  assert.equal(lek.lek, true, 'de naam in de 403 zegt: het object bestaat en zo heet de eigenaar');
  assert.match(lek.reden, /LEKT/);

  const schoon = oordeelIdor(403, '{"error":"U heeft hier geen toegang."}');
  assert.equal(schoon.lek, false, 'een nette weigering zonder persoonsgegeven lekt niets');
});
