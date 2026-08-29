/* ============================================================================
   DE WERELD KLAARZETTEN VOOR DE IDEMPOTENTIEPROEF -- en waarom dat geen valsspelen is.

   HET PROBLEEM. Het plausibele lijf (scripts/lib/rolproef.js) is voor alle
   routes hetzelfde, en dat kan niet anders: het weet niet welke IBAN of welke
   codenaam er in DEZE database bestaan. Een route die daardoor 404 geeft, heeft
   geen werk gedaan -- en een route die niets doet, kun je niet betrappen op een
   tweede keer doen. Van de vierenveertig geld- en bankroutes stonden er
   negenendertig op `ongemeten` (TAKEN.md 4.30), en dat is precies de kolom waar
   het het meest toe doet.

   WAT DIT WEL EN NIET IS. Dit zet geen uitkomst klaar en zet geen poort open:
   het maakt een rekening, stort er geld op, geeft een pas uit, zet een vaste
   betaling en laat een tweede lid een klompje sturen -- allemaal langs de gewone
   routes, met de gewone poorten ervoor. Wat er daarna gemeten wordt, is
   onaangeraakt: doet een tweede oproep met dezelfde sleutel het nog een keer?

   EN WAT HET NADRUKKELIJK NIET DOET: de drie kredietroutes forceren. Die geven
   503 met "hiervoor is een vergunning nodig die nog niet is vastgelegd" -- een
   bewuste, eerlijke stop. Een proef die zijn eigen meetobject openbreekt om een
   getal te halen, meet niets meer. Ze blijven ongemeten, en dat hoort.

   WAAROM PER ROUTE, en niet een grotere gedeelde bak. `bank/sepa` noemt zijn
   doel `naarIban`, `pay/verzoek` noemt zijn bedrag `totaalCenten`, `bank/bulk`
   wil `posten[].naarIban` en `bank/pas/uitgeven` wil `soort: 'debit'` terwijl
   `bank/rekening/open` met datzelfde woord een REKENINGsoort bedoelt. Die
   namen kun je niet in een gedeelde bak leggen zonder dat ze elkaar in de weg
   zitten -- `soort` alleen al zou de andere drieduizend routes een ander lijf
   geven. Dus staat het per route, met de veldnamen van die route.

   ALLEEN DEZE PROEF. De rolproef en de invoerproef delen `plausibelLijf`; zou
   de verrijking daar in gaan zitten, dan verschuiven hun registers in dezelfde
   ronde mee en heb je twee grote uitslagen door elkaar.
   ========================================================================== */
'use strict';

/* Een IBAN buiten RTG voor de SEPA-uitgaande route -- het bekende
   voorbeeld-IBAN uit de ISO-documentatie, geen rekening van iemand. */
const BUITEN_IBAN = 'NL91ABNA0417164300';

async function zetWereldKlaar({ post, tokens }) {
  const w = {};
  const stil = async (pad, lijf, tok) => { try { return await post(pad, lijf, tok); } catch (e) { return { status: 0, data: {} }; } };
  const veld = (r, ...pad) => { let v = r && r.data; for (const k of pad) { if (!v) return null; v = v[k]; } return v || null; };

  /* 1. DE BANK AAN. In een verse database staat de leden-bank niet live, en dat
        gaf eenendertig bankroutes een 403. Een schakelaar, geen defect. */
  await stil('/api/office/bank/leden', { aan: true }, tokens.office);

  /* 2. AKKOORD = de eerste rekening, met een echte IBAN. */
  w.iban = veld(await stil('/api/bank/akkoord', {}, tokens.member), 'rekening', 'iban');

  /* 3. EEN TWEEDE LID, want geld sturen vraagt een ontvanger die niet jezelf is,
        en een klompje betalen vraagt iemand die het gestuurd heeft. */
  const ander = (await stil('/api/login', { tier: 'lifestyle' })).data;
  if (ander && ander.token) {
    w.anderToken = ander.token;
    w.iban2 = veld(await stil('/api/bank/akkoord', {}, ander.token), 'rekening', 'iban');
    w.cn2 = veld(await stil('/api/pay/overzicht', {}, ander.token), 'codenaam');
  }
  w.cn1 = veld(await stil('/api/pay/overzicht', {}, tokens.member), 'codenaam');

  /* 4. SALDO. Zonder geld op de rekening geven de wallet-routes 402 en strandt
        elke boeking op "onvoldoende saldo" -- dan is er weer geen werk. */
  if (w.iban) await stil('/api/bank/storten', { iban: w.iban, centen: 500000, route: 'ideal' }, tokens.member);

  /* 5. EEN SPAARREKENING (een spaardoel hoort bij een spaarrekening) en EEN PAS
        (vier pas-routes wachtten op een pas die bestaat). */
  w.spaarIban = veld(await stil('/api/bank/rekening/open', { soort: 'spaar', naam: 'Proefspaarpot' }, tokens.member), 'rekening', 'iban');
  if (w.iban) w.pasId = veld(await stil('/api/bank/pas/uitgeven', { iban: w.iban, soort: 'debit', naam: 'Proefpas' }, tokens.member), 'pas', 'id');

  /* 6. EEN VASTE BETALING, zodat terugkerend/stop iets te stoppen heeft. */
  if (w.iban && w.iban2) {
    w.terugkerendId = veld(await stil('/api/bank/terugkerend/zet',
      { vanIban: w.iban, naarIban: w.iban2, centen: 100, interval: 'maand', oms: 'proefreeks' }, tokens.member), 'terugkerend', 'id');
  }

  /* 7. TWEE KLOMPJES, en dat is met opzet twee. `verzoek/betaal` wil er een die
        AAN mij gericht is (van de ander), `verzoek/intrek` wil er een die VAN
        mij is -- je kunt geen verzoek intrekken dat je zelf moet betalen. Met
        een van de twee bleef de andere route op 404 staan. */
  const eersteId = (r) => { const v = veld(r, 'verzoeken'); return (Array.isArray(v) && v[0] && v[0].id) || veld(r, 'verzoek', 'id'); };
  if (w.anderToken && w.cn1) {
    w.verzoekAanMij = eersteId(await stil('/api/pay/verzoek', { aan: [w.cn1], totaalCenten: 500, oms: 'proefklompje' }, w.anderToken));
  }
  if (w.cn2) {
    w.verzoekVanMij = eersteId(await stil('/api/pay/verzoek', { aan: [w.cn2], totaalCenten: 500, oms: 'proefklompje' }, tokens.member));
  }

  /* 8. EEN KASCODE om te innen (eenmalig bruikbaar; een verrijking, geen garantie). */
  const kas = await stil('/api/pay/kascode', { centen: 100 }, tokens.member);
  w.code = (kas.data && (kas.data.code || (kas.data.kascode && kas.data.kascode.code))) || null;

  /* 9. EEN TIKCODE VAN DE ANDER. `pay/tik` betaalt naar de eigenaar van de code,
        dus die moet van het TWEEDE lid komen -- je eigen tik weigert de kern
        terecht ("Dit is je eigen tik"). Dit is een andere codesoort dan de
        kascode hierboven; met die ene meegestuurd bleef pay/tik op 404 staan. */
  if (w.anderToken) {
    const tik = await stil('/api/pay/tikcode', {}, w.anderToken);
    w.tikcode = (tik.data && tik.data.code) || null;
  }

  /* 10. EEN OPENSTAANDE FACTUUR van het lid zelf, voor `pay/saldo`. Die maken we
         niet: de demostand heeft er een, en we zoeken hem op. Een factuur
         verzinnen zou de proef een eigen boekhouding geven. */
  const staat = await stil('/api/state', {}, tokens.member);
  const facturen = (staat.data && staat.data.state && staat.data.state.invoices) || [];
  const open = facturen.find(f => f && f.status === 'open');
  w.factuurId = (open && open.id) || null;

  return { wereld: w, extra: gedeeldLijf(w), perRoute: geldLijf(w) };
}

/* Wat over ELK lijf heen gaat. Alleen namen die nergens anders iets betekenen:
   een IBAN is een IBAN, een codenaam is een codenaam. `soort` en `id` staan hier
   met opzet NIET -- die zouden drieduizend andere routes een ander lijf geven. */
function gedeeldLijf(w) {
  const uit = {};
  if (w.iban) uit.iban = w.iban;
  if (w.cn2) { uit.aan = w.cn2; uit.codenaam = w.cn2; uit.naarCodenaam = w.cn2; }
  if (w.code) uit.code = w.code;
  return uit;
}

/* De veldnamen per geldroute. Wat hier staat is wat DIE route vraagt -- niet
   meer, en met echte waarden uit de wereld hierboven. Een route die hier niet
   in staat, krijgt gewoon het plausibele lijf. */
function geldLijf(w) {
  const post = (naar) => [{ naarIban: naar, centen: 100, oms: 'proefpost' }];
  const kaart = {
    '/api/bank/overboek': { vanIban: w.iban, naarIban: w.iban2, centen: 100, oms: 'proefboeking' },
    '/api/bank/bulk': { vanIban: w.iban, posten: post(w.iban2), oms: 'proefbatch' },
    '/api/bank/salaris': { vanIban: w.iban, posten: post(w.iban2), oms: 'proefloon' },
    '/api/bank/naar-wallet': { iban: w.iban, centen: 100 },
    '/api/bank/van-wallet': { iban: w.iban, centen: 100 },
    '/api/bank/sepa': { iban: w.iban, naarIban: BUITEN_IBAN, begunstigde: 'Proef Ontvanger', centen: 100, oms: 'proefsepa' },
    '/api/bank/spaardoel': { iban: w.spaarIban, euro: 500 },
    '/api/bank/rekening/open': { soort: 'spaar', naam: 'Nog een proefspaarpot' },
    '/api/bank/pas/uitgeven': { iban: w.iban, soort: 'debit', naam: 'Nog een proefpas' },
    '/api/bank/pas/betaal': { id: w.pasId, centen: 100, oms: 'proefbetaling' },
    '/api/bank/pas/bevries': { id: w.pasId, aan: true },
    '/api/bank/pas/limiet': { id: w.pasId, euro: 500 },
    '/api/bank/pas/sluit': { id: w.pasId },
    '/api/bank/terugkerend/zet': { vanIban: w.iban, naarIban: w.iban2, centen: 100, interval: 'maand', oms: 'proefreeks' },
    '/api/bank/terugkerend/stop': { id: w.terugkerendId },
    '/api/pay/verzoek': { aan: [w.cn2], totaalCenten: 500, oms: 'proefklompje' },
    '/api/pay/verzoek/betaal': { id: w.verzoekAanMij },
    '/api/pay/verzoek/intrek': { id: w.verzoekVanMij },
    '/api/pay/tik': { code: w.tikcode, centen: 100, oms: 'prooftik' },
    '/api/pay/saldo': { invoiceId: w.factuurId }
  };
  /* Een route waarvan de wereld het benodigde stuk NIET heeft opgeleverd, krijgt
     hier niets. Anders zou hij een lijf met `id: null` krijgen en op een andere
     manier stranden dan zonder deze laag -- en dan verschuift de meting zonder
     dat iemand het ziet.

     De controle kijkt ook IN lijsten en posten, en dat is geen overdrijving:
     `pay/verzoek` draagt zijn ontvanger als `aan: [codenaam]` en `bank/bulk`
     zijn tegenrekening als `posten[].naarIban`. Met een platte controle kwam
     `aan: [null]` er ongestraft doorheen -- een lijst is immers geen null. */
  const heel = (v) => {
    if (v === null || v === undefined) return false;
    if (typeof v === 'object') return Object.values(v).every(heel);   // lijsten ook: Object.values geeft de elementen
    return true;
  };
  const uit = {};
  for (const [pad, lijf] of Object.entries(kaart)) if (heel(lijf)) uit[pad] = lijf;
  return uit;
}

module.exports = { zetWereldKlaar, gedeeldLijf, geldLijf, BUITEN_IBAN };
