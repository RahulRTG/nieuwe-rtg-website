/* DE PERIMETER VAN DE RISICOVOLLE ENDPOINTS ZONDER EIGEN TOETS.

   NORM.json telt honderden endpoints die in geen enkel toetsbestand voorkomen.
   Dat getal omlaag duwen is makkelijk en waardeloos; LAT.md zegt hoe het wel
   moet: gerangschikt naar risico, niet naar aantal. Van de 246 endpoints die
   hier zonder toets stonden raken ze alle drie de dingen die er echt toe doen --
   geld, toegang en identiteit -- en die krijgen hier hun eerste contract.

   WAT DIT WEL BEWIJST: geen van deze deuren gaat open voor iemand zonder
   identiteit, en geen van ze valt om. Dat is de ondergrens, en die was tot nu
   toe nergens vastgelegd.

   WAT DIT NIET BEWIJST: of de deur voor de VERKEERDE ingelogde persoon dicht
   blijft. Een lid dat de bankrekening van een ander lid probeert te legen komt
   hier niet langs -- dat is een rollenvraag en die hoort in een eigen ronde.
   Deze toets is de perimeter, niet de rechtenleer. Dat staat hier expliciet,
   zodat niemand hem voor meer aanziet dan hij is.

   WAAROM DE STATUS EXACT WORDT VASTGELEGD EN NIET "IETS BOVEN DE 400".
   Een toets die alleen "niet 2xx" eist, valt in de val van LAT.md regel 9: dan
   telt een 404 als "geweigerd", terwijl een 404 ook betekent dat de route niet
   meer BESTAAT. Hernoem een endpoint en zo'n toets blijft vrolijk groen terwijl
   hij niets meer bewaakt. Door de exacte status te bevriezen wordt elke
   verschuiving zichtbaar: 401 -> 404 betekent dat de route weg is, 403 -> 401
   dat er een andere poort voor hangt, en 4xx -> 2xx dat er een deur openstaat.

   DE 404's ZIJN NAGETROKKEN EN ZIJN ECHTE WEIGERINGEN. Ze komen van gezinVan()
   in server/foundation/gezinshulp.js: een onbekende gezinscode geeft 404 ("Dit
   gezin kennen we niet"), en dat gebeurt vóór er iets van geld of gegevens in
   beweging komt. Verstoppen in plaats van weigeren is daar de bedoeling: het
   bestaan van een gezinscode is zelf een gegeven.

   MUTATIE-BEWIJS: haal de poort weg voor een van deze routes en de bewering
   voor dat pad zakt op zijn exacte status; hernoem een route en hij zakt op
   404. Beide zijn geprobeerd en beide sloegen aan.

   Draai los: node --experimental-sqlite --test test/perimeter-risico.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

/* Pad -> de status die een ANONIEME POST hoort te krijgen. Vastgelegd door ze
   allemaal een keer echt af te kloppen, en daarna bevroren. */
const GELD = [
  ['/api/bank/bulk', 401],
  ['/api/bank/hart', 401],
  ['/api/bank/inzichten', 401],
  ['/api/bank/krediet/aanvraag', 401],
  ['/api/bank/krediet/aflossing', 401],
  ['/api/bank/pas/bevries', 401],
  ['/api/bank/pas/limiet', 401],
  ['/api/bank/pas/uitgeven', 401],
  ['/api/bank/rekening/open', 401],
  ['/api/bank/terugkerend/zet', 401],
  ['/api/bank/van-wallet', 401],
  ['/api/bank/vastelasten', 401],
  ['/api/bank/veeg', 401],
  ['/api/bedrijf/licentie/toewijzen', 403],
  ['/api/bedrijf/licentie/zet', 403],
  ['/api/bedrijf/licenties', 403],
  ['/api/care/betaal', 401],
  ['/api/care/pakket/betaal', 401],
  ['/api/command/operator/recent', 401],
  ['/api/facturen/ai', 401],
  ['/api/foundation/markt/deal/betaal', 404],
  ['/api/foundation/school/bijdrage/betaal', 404],
  ['/api/foundation/school/factuur/boek', 403],
  ['/api/foundation/school/factuur/herinner', 403],
  ['/api/foundation/school/factuur/maak', 403],
  ['/api/foundation/school/kantine/saldo', 403],
  ['/api/lab/kennisbank', 401],
  ['/api/lab2/app/uitgifte', 401],
  ['/api/labfonds/boardroom', 401],
  ['/api/labfonds/locatie/maak', 401],
  ['/api/labfonds/scheidsrechter', 401],
  ['/api/member/rechterhand/attenties/gift', 401],
  ['/api/member/rechterhand/attenties/gift/weg', 401],
  ['/api/member/rechterhand/mecenaat/betaald', 401],
  ['/api/member/rechterhand/mecenaat/gift', 401],
  ['/api/member/rechterhand/mecenaat/gift/weg', 401],
  ['/api/pay/tiks', 401],
  ['/api/supplier/handel/factureren', 401],
  ['/api/supplier/horeca/betaal', 401],
  ['/api/supplier/horeca/club/band/betaal', 401],
  ['/api/supplier/markt/deal/betaal', 401],
  ['/api/supplier/thuis/prijsadvies', 401],
  ['/api/thuis/prijsadvies', 401]
];
const TOEGANG = [
  ['/api/auth/resend', 401],
  ['/api/bedrijf/mijn-rechten', 403],
  ['/api/command/agent/rechten', 401],
  ['/api/command/apipoort/sleutel', 401],
  ['/api/command/recht/geef', 401],
  ['/api/command/recht/introk', 401],
  ['/api/command/recht/nood', 401],
  ['/api/command/rechten', 401],
  ['/api/foundation/school/mijn-rechten', 403],
  ['/api/foundation/school/zorg/sessie', 403],
  ['/api/genootschap/rol', 401],
  ['/api/lab2/app/bevoegd', 401],
  ['/api/lab2/mens/rol', 401],
  ['/api/member/leren/sessie-antwoord', 401],
  ['/api/member/leren/sessie-staat', 401],
  ['/api/member/leren/sessie-start', 401],
  ['/api/member/leren/sessie-zet', 401],
  ['/api/member/leren/sessies', 401],
  ['/api/member/rechterhand/attenties', 401],
  ['/api/member/rechterhand/attenties/relatie', 401],
  ['/api/member/rechterhand/attenties/relatie/weg', 401],
  ['/api/member/rechterhand/cellier/schenk', 401],
  ['/api/member/rechterhand/cellier/weg', 401],
  ['/api/member/rechterhand/cercle', 401],
  ['/api/member/rechterhand/cercle/club', 401],
  ['/api/member/rechterhand/cercle/club/weg', 401],
  ['/api/member/rechterhand/cercle/gast', 401],
  ['/api/member/rechterhand/cercle/gast/terug', 401],
  ['/api/member/rechterhand/cercle/waarheen', 401],
  ['/api/member/rechterhand/entourage', 401],
  ['/api/member/rechterhand/entourage/doc', 401],
  ['/api/member/rechterhand/entourage/doc/weg', 401],
  ['/api/member/rechterhand/entourage/gezelschap', 401],
  ['/api/member/rechterhand/entourage/persoon', 401],
  ['/api/member/rechterhand/entourage/persoon/weg', 401],
  ['/api/member/rechterhand/garderobe', 401],
  ['/api/member/rechterhand/garderobe/stuk', 401],
  ['/api/member/rechterhand/garderobe/stuk/weg', 401],
  ['/api/member/rechterhand/garderobe/vakman', 401],
  ['/api/member/rechterhand/garderobe/vakman/weg', 401],
  ['/api/member/rechterhand/hangar', 401],
  ['/api/member/rechterhand/hangar/toestel', 401],
  ['/api/member/rechterhand/hangar/toestel/weg', 401],
  ['/api/member/rechterhand/hangar/vlucht', 401],
  ['/api/member/rechterhand/hangar/vlucht/weg', 401],
  ['/api/member/rechterhand/logboek', 401],
  ['/api/member/rechterhand/logboek/object', 401],
  ['/api/member/rechterhand/logboek/object/weg', 401],
  ['/api/member/rechterhand/logboek/regel', 401],
  ['/api/member/rechterhand/logboek/regel/weg', 401],
  ['/api/member/rechterhand/maison', 401],
  ['/api/member/rechterhand/maison/log', 401],
  ['/api/member/rechterhand/maison/log/weg', 401],
  ['/api/member/rechterhand/maison/staf', 401],
  ['/api/member/rechterhand/maison/staf/weg', 401],
  ['/api/member/rechterhand/maison/taak', 401],
  ['/api/member/rechterhand/maison/taak/klaar', 401],
  ['/api/member/rechterhand/maison/taak/weg', 401],
  ['/api/member/rechterhand/mecenaat', 401],
  ['/api/member/rechterhand/nalatenschap', 401],
  ['/api/member/rechterhand/nalatenschap/contact', 401],
  ['/api/member/rechterhand/nalatenschap/contact/weg', 401],
  ['/api/member/rechterhand/nalatenschap/doc', 401],
  ['/api/member/rechterhand/nalatenschap/doc/weg', 401],
  ['/api/member/rechterhand/nalatenschap/wens', 401],
  ['/api/member/rechterhand/nalatenschap/wens/weg', 401],
  ['/api/member/rechterhand/reis/item', 401],
  ['/api/member/rechterhand/reis/item/weg', 401],
  ['/api/member/rechterhand/reis/weg', 401],
  ['/api/member/rechterhand/reis/zet', 401],
  ['/api/member/rechterhand/reisboek', 401],
  ['/api/member/rechterhand/table', 401],
  ['/api/member/rechterhand/table/gast', 401],
  ['/api/member/rechterhand/table/gast/weg', 401],
  ['/api/member/rechterhand/table/gast/zet', 401],
  ['/api/member/rechterhand/table/menu', 401],
  ['/api/member/rechterhand/table/menu/weg', 401],
  ['/api/member/rechterhand/table/weg', 401],
  ['/api/member/rechterhand/table/zet', 401],
  ['/api/metier/rol', 401],
  ['/api/metier/rol-weg', 401],
  ['/api/muziek/samen/rol', 401],
  ['/api/overheid/rb/rol', 401],
  ['/api/rtf/leren/sessie-antwoord', 403],
  ['/api/rtf/leren/sessie-staat', 403],
  ['/api/rtf/leren/sessie-start', 403],
  ['/api/rtf/leren/sessie-zet', 403],
  ['/api/rtf/leren/sessies', 403],
  ['/api/rtfos/campagne/sleutel', 401],
  ['/api/scim/v2/ResourceTypes', 404],
  ['/api/scim/v2/Schemas', 404],
  ['/api/scim/v2/ServiceProviderConfig', 404],
  ['/api/scim/v2/Users', 401],
  ['/api/scim/v2/Users/:id', 404],
  ['/api/sleutelwoorden/status', 401],
  ['/api/sleutelwoorden/weg', 401],
  ['/api/techniek/sso/:org', 404],
  ['/api/techniek/sso/scimsleutel/:org', 404]
];
const IDENTITEIT = [
  ['/api/bedrijf/dossier', 403],
  ['/api/bedrijf/leden', 403],
  ['/api/bedrijf/lid/ontkoppel', 403],
  ['/api/boardroom/persoon', 401],
  ['/api/foundation/gezin/:code/agenda', 404],
  ['/api/foundation/gezin/:code/berichten', 404],
  ['/api/foundation/gezin/:code/chat/:metId', 404],
  ['/api/foundation/gezin/:code/chats', 404],
  ['/api/foundation/gezin/:code/dromen', 404],
  ['/api/foundation/gezin/:code/gezondheid', 404],
  ['/api/foundation/gezin/:code/kanaal', 404],
  ['/api/foundation/gezin/:code/keuken', 404],
  ['/api/foundation/gezin/:code/klussen', 404],
  ['/api/foundation/gezin/:code/locaties', 404],
  ['/api/foundation/gezin/:code/mij', 404],
  ['/api/foundation/gezin/:code/ochtend', 404],
  ['/api/foundation/gezin/:code/oppasinfo', 404],
  ['/api/foundation/gezin/:code/spaardoelen', 404],
  ['/api/foundation/gezin/:code/verjaardagen', 404],
  ['/api/foundation/gezin/agenda/verwijder', 404],
  ['/api/foundation/gezin/bel', 404],
  ['/api/foundation/gezin/bericht', 404],
  ['/api/foundation/gezin/bericht/gelezen', 404],
  ['/api/foundation/gezin/chat', 404],
  ['/api/foundation/gezin/droom/behaald', 404],
  ['/api/foundation/gezin/droom/maak', 404],
  ['/api/foundation/gezin/droom/moedig', 404],
  ['/api/foundation/gezin/droom/verwijder', 404],
  ['/api/foundation/gezin/geldschool', 404],
  ['/api/foundation/gezin/geldschool/verzilver', 404],
  ['/api/foundation/gezin/geldschool/weekgeld', 404],
  ['/api/foundation/gezin/gezondheid/afspraak', 404],
  ['/api/foundation/gezin/gezondheid/afspraak/verwijder', 404],
  ['/api/foundation/gezin/gezondheid/medicijn', 404],
  ['/api/foundation/gezin/gezondheid/medicijn/gegeven', 404],
  ['/api/foundation/gezin/gezondheid/medicijn/verwijder', 404],
  ['/api/foundation/gezin/gezondheid/meting', 404],
  ['/api/foundation/gezin/gezondheid/meting/verwijder', 404],
  ['/api/foundation/gezin/keuken/idee', 404],
  ['/api/foundation/gezin/keuken/lijst', 404],
  ['/api/foundation/gezin/keuken/lijst/af', 404],
  ['/api/foundation/gezin/keuken/lijst/opruim', 404],
  ['/api/foundation/gezin/keuken/lijst/verwijder', 404],
  ['/api/foundation/gezin/keuken/menu', 404],
  ['/api/foundation/gezin/keuken/menu/wis', 404],
  ['/api/foundation/gezin/keuken/vast', 404],
  ['/api/foundation/gezin/keuken/vast/verwijder', 404],
  ['/api/foundation/gezin/klus/verwijder', 404],
  ['/api/foundation/gezin/locatie', 404],
  ['/api/foundation/gezin/locatie/stop', 404],
  ['/api/foundation/gezin/ochtend/stap', 404],
  ['/api/foundation/gezin/ochtend/stap/verwijder', 404],
  ['/api/foundation/gezin/ochtend/vink', 404],
  ['/api/foundation/gezin/oppasinfo', 404],
  ['/api/foundation/gezin/profiel/verwijder', 404],
  ['/api/foundation/gezin/profiel/wijzig', 404],
  ['/api/foundation/gezin/sollicitaties', 404],
  ['/api/foundation/gezin/spaardoel/bijdrage', 404],
  ['/api/foundation/gezin/spaardoel/maak', 404],
  ['/api/foundation/gezin/spaardoel/verwijder', 404],
  ['/api/foundation/gezin/verjaardag/persoon/verwijder', 404],
  ['/api/foundation/gezin/verjaardag/potje/bijdrage', 404],
  ['/api/foundation/gezin/verjaardag/potje/doel', 404],
  ['/api/foundation/gezin/verjaardag/wens', 404],
  ['/api/foundation/gezin/verjaardag/wens/claim', 404],
  ['/api/foundation/gezin/verjaardag/wens/verwijder', 404],
  ['/api/foundation/gezin/wissen', 404],
  ['/api/foundation/gezin/wissen/bevestig', 404],
  ['/api/foundation/gezin/wissen/intrekken', 404],
  ['/api/foundation/school/bericht/gezin', 404],
  ['/api/foundation/school/dossier', 403],
  ['/api/foundation/school/dossier/contact', 403],
  ['/api/foundation/school/hr/dossier', 403],
  ['/api/foundation/school/telefoonboom', 403],
  ['/api/foundation/school/telefoonboom/doorgegeven', 404],
  ['/api/foundation/school/telefoonboom/maak', 403],
  ['/api/foundation/school/telefoonboom/mijn', 404],
  ['/api/foundation/school/telefoonboom/nummer', 404],
  ['/api/foundation/school/telefoonboom/start', 403],
  ['/api/lab2/bewoner/paspoort', 404],
  ['/api/lab2/bewoner/paspoort-maak', 404],
  ['/api/member/lifestyle/gezondheid/dossier', 401],
  ['/api/member/lifestyle/gezondheid/dossier/weg', 401],
  ['/api/member/naam/lijst', 401],
  ['/api/member/naam/wie', 401],
  ['/api/member/naam/zet', 401],
  ['/api/member/pulse/profiel', 401],
  ['/api/member/rendezvous/profiel', 401],
  ['/api/member/rendezvous/profiel/zet', 401],
  ['/api/metier/ai/profiel', 401],
  ['/api/metier/lid', 401],
  ['/api/metier/naam-intrekken', 401],
  ['/api/metier/naam-log', 401],
  ['/api/metier/naam-vrij', 401],
  ['/api/rtf/baby/gezin-zet', 403],
  ['/api/rtf/kantoorpakket/gezin', 403],
  ['/api/rtf/leerling/paspoort', 403],
  ['/api/rtf/profielen', 401],
  ['/api/rtf/social/kind/contacten', 403],
  ['/api/rtf/social/kind/verwijder', 403],
  ['/api/staff/fluister/profiel', 401],
  ['/api/supplier/fitclub/lid', 401],
  ['/api/supplier/opvang/kind', 401],
  ['/api/supplier/opvang/kind/ophaal', 401],
  ['/media/:naam', 404]
];

let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-perimeter-'));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

async function anoniem(pad) {
  const r = await fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: '{}' });
  return r.status;
}

async function keurGroep(naam, lijst, verwachtAantal) {
  /* Eerst het AANTAL. Zonder deze regel kan iemand de lijst leegmaken en houdt
     de toets nul beweringen over -- groen, en volstrekt leeg (LAT.md regel 9). */
  assert.equal(lijst.length, verwachtAantal, naam + ': de lijst hoort ' + verwachtAantal + ' endpoints te bevatten');
  const afwijkend = [];
  for (const [pad, verwacht] of lijst) {
    const status = await anoniem(pad);
    assert.ok(!(status >= 200 && status < 300), naam + ': ' + pad + ' liet een ANONIEME aanvrager binnen (' + status + ')');
    assert.ok(status < 500, naam + ': ' + pad + ' viel om op een leeg verzoek (' + status + ') -- een poort hoort te weigeren, niet te breken');
    if (status !== verwacht) afwijkend.push(pad + ': verwacht ' + verwacht + ', kreeg ' + status);
  }
  assert.deepEqual(afwijkend, [], naam + ': de perimeter is verschoven');
}

test('1. de geld-endpoints laten niemand zonder identiteit toe', async () => {
  await keurGroep('GELD', GELD, 43);
});

test('2. de toegang- en rechten-endpoints laten niemand zonder identiteit toe', async () => {
  await keurGroep('TOEGANG', TOEGANG, 98);
});

test('3. de identiteit- en persoonsgegeven-endpoints laten niemand zonder identiteit toe', async () => {
  await keurGroep('IDENTITEIT', IDENTITEIT, 105);
});
