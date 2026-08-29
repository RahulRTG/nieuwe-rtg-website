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

async function zetWereldKlaar({ post, tokens, datamap }) {
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

  /* ============================================================================
     11. DE WERELDEN MET EEN EIGEN SLEUTEL IN HET LIJF.

     De ronde van 29 augustus 2026 legde per route vast WAT hem tegenhield, en
     toen bleek de grootste post geen raadsel maar een ontbrekend voorwerp. De
     vier zwaarste zinnen, met hun aantal:

        208  "Log opnieuw in bij je gezin."
        122  "Dit gezin kennen we niet. Klopt de gezinscode?"
        105  "Onbekende werkruimte of verkeerd lid-token."
         82  "Dit bedrijf kennen we niet."

     Geen van vieren gaat over idempotentie. Het zijn deuren die om een sleutel
     in het LIJF vragen (scripts/lib/bewakers.js noemt dat een lichaamssleutel),
     en die sleutel bestond in deze wereld gewoon niet. Vierhonderdzeventien
     routes stonden daardoor als ONGEMETEN in het register.

     Dus maken we ze hier: een gezin, een werkruimte met een toegelaten lid, en
     het bestaande werkplek-huis. Echt aangemaakt via de gewone routes -- niet
     in de database gezet, want dan meet de proef straks een toestand die langs
     de eigen deuren van het huis is binnengekomen. */

  /* 11a. EEN GEZIN. `bevoegdGezin` en `privacyAkkoord` zijn buiten NODE_ENV=test
          verplicht, en dat hoort ook: het zijn de twee verklaringen waarmee een
          volwassene zegt dat hij dit gezin mag aanmaken. De proef zet ze dus
          netjes, in plaats van de server in de teststand te zetten om eronderuit
          te komen -- dan zou hij een andere server meten dan er draait. */
  const gez = await stil('/api/foundation/gezin/maak', {
    gezinsnaam: 'Proefgezin', naam: 'Proefbeheerder', pin: '1234',
    bevoegdGezin: true, privacyAkkoord: true
  });
  w.gezinCode = veld(gez, 'code');
  w.gezinToken = veld(gez, 'token');

  /* 11b. EEN WERKRUIMTE MET EEN TOEGELATEN LID. Twee sleutels en met opzet twee:
          `beheerToken` opent de beheerdeur, `lidToken` de ledendeur. Een lid is
          na aanmelden nog 'wacht' en zijn token werkt dan nergens voor -- er moet
          dus eerst een besluit overheen. Zonder die derde oproep waren de 105
          routes achter lidVan() blijven staan. */
  const wr = await stil('/api/bedrijf/werkruimte/maak', { naam: 'Proefwerkruimte' });
  w.werkruimte = veld(wr, 'werkruimte');
  w.beheerToken = veld(wr, 'beheerToken');
  if (w.werkruimte) {
    const lid = await stil('/api/bedrijf/lid/aanmeld', { werkruimte: w.werkruimte, naam: 'Proeflid', functie: 'proef' });
    const lidId = veld(lid, 'lidId');
    w.lidToken = veld(lid, 'lidToken');
    if (lidId && w.beheerToken) {
      await stil('/api/bedrijf/lid/besluit', { werkruimte: w.werkruimte, beheerToken: w.beheerToken, lidId, akkoord: true });
    }
  }

  /* 11c. EEN SCHOOL, EN ALLEEN LANGS DE ECHTE WEG.

          server/school/beheer.js heeft een snelle deur (/school/school/maak) die
          buiten NODE_ENV=test een 410 geeft, met de reden erbij: die zou voor de
          BRIN- en privacycontrole langs een beheersleutel uitgeven. De
          verleiding is om de proefserver dan maar in de teststand te zetten.
          Dat doen we niet -- dan meet de proef een server die op meer plekken
          anders is dan deze ene, en het verschil staat nergens.

          Dus loopt de proef de hele registratiebalie af, precies zoals een
          echte school dat zou doen:

            1. aanvragen        (open achter een rem; een school heeft nog geen account)
            2. per controle-eis een uitkomst vastleggen  -- BOARDROOM
            3. besluit: goedkeuren                        -- BOARDROOM
            4. activeren met het eenmalige geheim         (open, met een rem)

          Stap 2 is de reden dat dit pas nu kan: zonder boardroom-sleutel was er
          geen weg naar goedkeuring, en dus geen school. Het is meteen de eerste
          keer dat deze keten van buiten helemaal is doorlopen.

          EN HET GEHEIM KOMT NIET TERUG OVER DE API -- met opzet. Het besluit
          antwoordt "De persoonlijke activatielink is naar het gecontroleerde
          schooladres gestuurd", en meer niet. De proef leest die link dus uit de
          POSTBUS van het adres dat hij zelf heeft opgegeven: de outbox in zijn
          eigen wegwerpmap (server/mail-outbox.js). Dat is geen omweg om de deur
          heen maar precies wat de echte directeur doet -- zijn mail openen. Wat
          de proef daarbij NIET doet is in de database kijken: het geheim staat
          daar als hash, en die is niet te gebruiken. */
  const brin = '0' + Math.random().toString(36).slice(2, 6).toUpperCase().replace(/[^0-9A-Z]/g, 'X');
  const aanvraag = await stil('/api/foundation/registratie/aanvragen', {
    type: 'school', naam: 'Proefschool', plaats: 'Proefstad', contactNaam: 'Proefdirecteur',
    email: 'proefschool@example.invalid', brin,
    bevoegd: true, waarheidsgetrouw: true, privacyAkkoord: true
  });
  const regId = veld(aanvraag, 'id');
  if (regId && tokens.boardroom) {
    /* Welke eisen er open staan, staat in het antwoord zelf -- niet in een
       lijst hier. Zou die lijst hier staan, dan loopt hij achter zodra er een
       controle bijkomt, en dan slaagt de proef stil niet meer. */
    const eisen = ((aanvraag.data && aanvraag.data.aanvraag && aanvraag.data.aanvraag.controles) || []).map(c => c.id);
    for (const onderdeel of eisen) {
      await stil('/api/office/foundation/registratie/controle', {
        id: regId, onderdeel, uitkomst: 'geverifieerd',
        referentie: 'proefronde idemwereld: synthetische registratie, geen echte instelling'
      }, tokens.boardroom);
    }
    await stil('/api/office/foundation/registratie/besluit',
      { id: regId, action: 'goedkeuren' }, tokens.boardroom);
    const activatie = await uitPostbus(datamap, 'activeren=');
    if (activatie) {
      const act = await stil('/api/foundation/school/school/activeren', { activatie });
      w.schoolCode = veld(act, 'schoolCode');
      w.schoolBeheerToken = veld(act, 'beheerToken');
    }
  }

  return { wereld: w, extra: gedeeldLijf(w), perRoute: geldLijf(w), perVoorvoegsel: voorvoegselLijf(w) };
}

/* De postbus van de wegwerpserver. Zonder SMTP legt server/mail-outbox.js elk
   bericht neer als bestand in <datamap>/outbox; dat is de brievenbus van de
   adressen die deze proef zelf heeft aangemaakt. We zoeken het NIEUWSTE bericht
   met het gevraagde merk erin en halen de waarde eruit.

   De grens: alleen lezen, alleen in de wegwerpmap, en alleen naar een adres dat
   de proef zelf heeft opgegeven. Zou hier ooit een echte datamap onder liggen,
   dan leest dit mee met de post van echte mensen -- vandaar dat de aanroeper de
   map expliciet meegeeft en deze functie er zelf geen kiest. */
async function uitPostbus(datamap, merk) {
  if (!datamap) return null;
  /* WACHTEN OP DE POSTBODE. De route antwoordt voordat het bericht op schijf
     staat -- mailVeilig() wordt niet afgewacht. Een keer kijken vond dus niets,
     en de school bleef stil ongemaakt; dat is precies het soort race dat een
     proef zwijgend zwakker maakt. Vandaar een korte poging-lus met een grens:
     tien keer een vijfde seconde, en daarna eerlijk niets. */
  for (let poging = 0; poging < 10; poging++) {
    const gevonden = zoekInPostbus(datamap, merk);
    if (gevonden) return gevonden;
    await new Promise(r => setTimeout(r, 200));
  }
  return null;
}

function zoekInPostbus(datamap, merk) {
  try {
    const fs = require('fs'); const path = require('path');
    const map = path.join(datamap, 'outbox');
    if (!fs.existsSync(map)) return null;
    const bestanden = fs.readdirSync(map).sort().reverse();
    for (const b of bestanden) {
      const tekst = fs.readFileSync(path.join(map, b), 'utf8');
      const i = tekst.indexOf(merk);
      if (i < 0) continue;
      const rest = tekst.slice(i + merk.length);
      const waarde = rest.split(/[\s'"<>]/)[0];
      if (waarde) { try { return decodeURIComponent(waarde); } catch (e) { return waarde; } }
    }
  } catch (e) { /* geen postbus is geen fout: dan blijft de school ongemaakt */ }
  return null;
}

/* ---------------------------------------------------------------------------
   HET LIJF PER VOORVOEGSEL, en waarom dit geen gedeeld lijf mag zijn.

   `gedeeldLijf` gaat over ELKE route. Daar horen alleen namen in die nergens
   anders iets betekenen. `code` staat er al in als KASCODE, en een gezinscode
   heet ook `code` -- die twee over drieduizend routes heen mengen zou van elke
   betaalroute een gezinsroute maken en andersom.

   Een voorvoegsel is de juiste maat: binnen /api/foundation/ betekent `code`
   onmiskenbaar de gezinscode, en daarbuiten raakt hij niets. `rol` mag er ook
   in: sommige van deze deuren willen niet alleen een sleutel in het lijf maar
   ook een bepaald token in de kop (het werkplek-huis laat alleen de eigenaar
   binnen, via boardroomBaas).
   ------------------------------------------------------------------------- */
function voorvoegselLijf(w) {
  const uit = [];
  if (w.gezinCode && w.gezinToken) {
    /* /api/foundation/ EN /api/school/: de schoolkant hangt aan hetzelfde
       gezinsprofiel (server/school/poorten.js leest gezinVan/profielVan). */
    /* LET OP DE VOLGORDE: de eerste treffer wint, en /api/foundation/school/ is
       een SPECIALER geval van /api/foundation/. Stond de brede regel voorop, dan
       kregen 225 schoolroutes het gezinslijf zonder schoolcode -- en dat is
       precies het soort stille halvering waar dit register voor bestaat.

       De schoolkant hangt onder de foundation-router (server/opzet/poortwachters.js
       mount hem op /api/foundation) en heet dus NIET /api/school. Die aanname
       kostte hier een ronde: de regel matchte nul routes en zei niets. */
    uit.push({ voorvoegsel: '/api/foundation/school/',
      lijf: { code: w.gezinCode, token: w.gezinToken,
        schoolCode: w.schoolCode || undefined, beheerToken: w.schoolBeheerToken || undefined } });
    uit.push({ voorvoegsel: '/api/foundation/', lijf: { code: w.gezinCode, token: w.gezinToken } });

  }
  if (w.werkruimte) {
    uit.push({ voorvoegsel: '/api/bedrijf/',
      lijf: { werkruimte: w.werkruimte, beheerToken: w.beheerToken || undefined, lidToken: w.lidToken || undefined } });
  }
  /* Het werkplek-huis is niet aan te maken: server/kern/werkplek.js kent twee
     vaste codes ('rtg', 'rtf') en geen route die er een derde bij zet. `magIn`
     laat de BAAS overal in, en dat is de eigenaar -- dus de boardroom-sleutel. */
  uit.push({ voorvoegsel: '/api/werkplek/', lijf: { bedrijf: 'rtg' }, rol: 'boardroom' });
  return uit;
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

module.exports = { zetWereldKlaar, gedeeldLijf, geldLijf, voorvoegselLijf, BUITEN_IBAN };
