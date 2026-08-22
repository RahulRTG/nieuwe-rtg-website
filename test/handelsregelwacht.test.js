/* Bewijst dat officiele handelsbronnen automatisch gevolgd worden zonder dat
   een webpagina zelfstandig juridische regels kan versoepelen. Een eerste
   lezing is de basis; pas een latere inhoudswijziging heropent bewijzen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const maak = require('../server/kern/handelsregelwacht');

function antwoord(tekst, status, koppen) {
  const h = Object.fromEntries(Object.entries(koppen || {}).map(([k, v]) => [k.toLowerCase(), v]));
  return { ok:(status || 200) < 400, status:status || 200,
    headers:{ get:n => h[String(n).toLowerCase()] || null }, text:async () => tekst };
}

function dossier() {
  return { registratie:{ landCode:'BE' }, activiteiten:{ internationaleHandel:true },
    toelating:{ status:'actueel', eisen:[
      { id:'sancties_vn', label:'VN-sancties', status:'geverifieerd', verplicht:true,
        gecontroleerd:{ door:'boardroom', at:'2026-08-01T00:00:00.000Z', referentie:'VN lijst augustus' } },
      { id:'eori', label:'EORI', status:'geverifieerd', verplicht:true,
        gecontroleerd:{ door:'boardroom', at:'2026-08-01T00:00:00.000Z', referentie:'BE0123' } }
    ] } };
}

test('een gewijzigde officiele sanctiebron opent automatisch alle betrokken hercontroles', async () => {
  const aanvraag = { ...dossier(), status:'nieuw' };
  const leverancier = { ...dossier(), code:'GLOBAL-1', name:'Global Trade' };
  const db = { data:{ partnerApplications:[aanvraag], suppliers:[leverancier] } };
  let inhoud = '<rss><title>UN Sanctions list version one</title><description>' + 'official '.repeat(12) + '</description></rss>';
  let etag = '"v1"', bewaard = 0, tijd = 0;
  const headersGezien = [];
  const wacht = maak({ db, save:() => { bewaard++; },
    nu:() => '2026-08-17T0' + tijd++ + ':00:00.000Z',
    fetchImpl:async (url, opties) => { headersGezien.push(opties.headers); return antwoord(inhoud, 200, { etag }); } });

  const basis = await wacht.check('sancties_vn');
  assert.equal(basis.ok, true);
  assert.equal(wacht.status().gebeurtenissen.length, 0, 'de eerste betrouwbare lezing is alleen een basis');
  assert.equal(aanvraag.toelating.eisen[0].status, 'geverifieerd');

  inhoud = '<rss><title>UN Sanctions list version two with a new entity</title><description>' + 'official '.repeat(12) + '</description></rss>'; etag = '"v2"';
  const gewijzigd = await wacht.check('sancties_vn');
  assert.equal(gewijzigd.ok, true);
  assert.equal(wacht.status().openWijzigingen, 1);
  assert.equal(aanvraag.toelating.eisen[0].status, 'hercontrole_nodig');
  assert.equal(leverancier.toelating.eisen[0].status, 'hercontrole_nodig');
  assert.equal(leverancier.toelating.eisen[1].status, 'geverifieerd', 'een sanctiewijziging raakt EORI niet');
  assert.equal(leverancier.activiteiten.regelHercontrole.bron, 'sancties_vn');
  assert.equal(headersGezien[1]['If-None-Match'], '"v1"');
  assert.ok(bewaard >= 2);

  const g = wacht.status().gebeurtenissen[0];
  assert.equal(wacht.bevestig(g.id, 'user-1', 'Nieuwe vermelding beoordeeld; betrokken bedrijven opnieuw screenen.').ok, true);
  assert.equal(wacht.status().openWijzigingen, 0);
  assert.equal(leverancier.toelating.eisen[0].status, 'hercontrole_nodig',
    'de juridische notitie vervangt de bedrijfshercontrole niet');
});

test('een onherkenbare bron of HTTP-fout laat de geldende controles onaangeroerd', async () => {
  const leverancier = { ...dossier(), code:'GLOBAL-2', name:'Global Two' };
  const db = { data:{ partnerApplications:[], suppliers:[leverancier] } };
  const wacht = maak({ db, save:() => {}, fetchImpl:async () => antwoord('<html>login</html>', 200) });
  const r = await wacht.check('sancties_vn');
  assert.equal(r.ok, false);
  assert.equal(leverancier.toelating.eisen[0].status, 'geverifieerd');
  assert.match(wacht.status().bronnen.find(b => b.id === 'sancties_vn').uitslag, /^fout/);
});

test('een gewijzigde Foundation-bron heropent alleen het bijbehorende bewijs', async () => {
  const aanvraag = { id:'f-1', type:'partnerstichting', naam:'Stichting Samen', status:'nieuw',
    toelating:{ status:'klaar_voor_besluit', eisen:[
      { id:'anbi', label:'ANBI', status:'geverifieerd', verplicht:true,
        gecontroleerd:{ door:'boardroom', at:'2026-08-01T00:00:00.000Z', referentie:'ANBI-register' } },
      { id:'ubo', label:'UBO', status:'geverifieerd', verplicht:true,
        gecontroleerd:{ door:'boardroom', at:'2026-08-01T00:00:00.000Z', referentie:'KVK' } }
    ] } };
  const db = { data:{ partnerApplications:[], suppliers:[], foundationRegistraties:[aanvraag] } };
  let tekst = '<html><h1>ANBI voorwaarden versie een</h1><p>' + 'algemeen nut '.repeat(15) + '</p></html>';
  const wacht = maak({ db, save:() => {}, fetchImpl:async () => antwoord(tekst, 200) });
  await wacht.check('anbi');
  tekst = '<html><h1>ANBI voorwaarden versie twee</h1><p>' + 'algemeen nut '.repeat(15) + '</p></html>';
  await wacht.check('anbi');
  assert.equal(aanvraag.toelating.eisen[0].status, 'hercontrole_nodig');
  assert.equal(aanvraag.toelating.eisen[1].status, 'geverifieerd');
  assert.equal(wacht.status().gebeurtenissen[0].foundationAanvragen, 1);
  assert.equal(wacht.status().getroffenFoundation[0].id, 'f-1');
});
