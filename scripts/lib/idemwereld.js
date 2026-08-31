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

   EN WAT HET NADRUKKELIJK NIET DOET -- twee dingen, en de tweede is er op
   30 augustus 2026 bij gekomen.

   WEL EEN RIJKSOVERHEID, MAAR NIET LANGS DE AANMELDBALIE. Vierenzestig routes
   onder /api/overheid/ antwoorden "Alleen voor het rijk.": `magBehandelen`
   vraagt een leverancier van het genre `rijk`. Dat genre staat in de seed als
   `status: 'intern'`, en die stand betekent letterlijk "dit genre hoort bij de
   wereld zelf en wordt niet door een partner aangevraagd" (seed/genres.js).

   Eerst liet deze proef ze daarom ongemeten, met als reden dat een
   overheidsaccount een IDENTITEIT is en geen voorwerp. Die redenering ging over
   de verkeerde deur. Een intern genre wordt niet AANGEVRAAGD en dus ook niet
   goedgekeurd op een vergunning die een mens heeft gezien -- het wordt door RTG
   zelf aangesloten, en daar bestaat een eigen weg voor:
   /api/office/instelling/aansluiten, achter de boardroom-sleutel. Besluit van de
   eigenaar, 30 augustus 2026: dat genre is van ons, koppel het.

   Dus loopt de proef die weg af, en geen andere. Wat hij NIET doet is een
   aanvraag door de aanmeldbalie duwen of een vergunningcontrole overslaan; die
   deur blijft dicht, en de kredietroutes hieronder blijven dat ook.

   En het oudere geval: de drie kredietroutes forceren. Die geven
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
  /* HET LOGBOEK VAN DE OPBOUW -- want een keten die faalt, faalde tot vandaag
     STIL. `stil()` slikt elke fout in (dat is zijn taak: een wereld die niet
     compleet is, mag de proef niet tegenhouden), en dus leverde een gebroken
     stap gewoon `null` op en liep de opbouw door. Vier keer op een avond is dat
     gebeurd -- de klas, het werkplekdocument, de stadsafdeling en twee keer de
     studie -- en wat het elke keer aanwees was een REGEL DIE ER TOEVALLIG STOND:
     de proef drukt zijn voorvoegsels met hun velden af, en daar ontbrak er dan
     een. Redden door toeval is geen ontwerp.

     Vanaf nu houdt de opbouw bij wat elke oproep deed, en zegt hij achteraf
     welke voorwerpen NIET zijn klaargekomen, met de status en de melding van de
     stap die ze had moeten opleveren. */
  const logboek = [];
  const stil = async (pad, lijf, tok) => {
    let r;
    try { r = await post(pad, lijf, tok); } catch (e) { r = { status: 0, data: { error: e.message } }; }
    logboek.push({ pad, status: r.status, error: (r.data && r.data.error) || null });
    return r;
  };
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

  /* 11d. EEN LERAAR EN EEN KLAS -- de tweede grote post na /api/rtf/.
          54 routes stonden op "Onbekende klas of verkeerd token."; de wereld had
          wel een school maar geen klas, en een klas maakt alleen een GOEDGEKEURDE
          leraar.

          Ook hier de echte weg en niet de snelle. `/school/personeel/aanmeld`
          geeft buiten NODE_ENV=test een 410 met de reden erbij ("vraag de directie
          om een persoonlijke uitnodiging op uw schoolmail"), dus loopt de proef
          precies dat af: de directie nodigt uit, het geheim komt per mail, en de
          medewerker accepteert. Dezelfde postbus als bij de school hierboven --
          de proef opent de mail die hij zelf heeft laten sturen. */
  if (w.schoolCode && w.schoolBeheerToken) {
    await stil('/api/foundation/school/personeel/uitnodig', {
      schoolCode: w.schoolCode, beheerToken: w.schoolBeheerToken,
      naam: 'Proefleraar', email: 'proefleraar@example.invalid', rollen: ['leraar']
    });
    const uitnodiging = await uitPostbus(datamap, 'uitnodiging=');
    if (uitnodiging) {
      const acc = await stil('/api/foundation/school/personeel/uitnodiging/accepteer', { uitnodiging });
      w.personeelToken = veld(acc, 'personeelToken');
    }
    if (w.personeelToken) {
      const klas = await stil('/api/foundation/school/leraar/klas/maak', {
        schoolCode: w.schoolCode, personeelToken: w.personeelToken, naam: 'Proefklas'
      });
      /* De klascode staat op het HOOGSTE niveau van het antwoord ({ok, code,
         naam, fase, trap}) en niet onder `klas`. Die aanname kostte een ronde:
         w.klasCode bleef null, de 54 routes bleven staan, en niets zei er iets
         over -- precies waarom de proef zijn voorvoegsels met hun velden
         afdrukt. */
      w.klasCode = veld(klas, 'code');
    }
  }

  /* 11e. EEN DOCUMENT PER KANTOORPAKKET, en dat is met opzet vier keer.
          51 routes stonden op "Document niet gevonden." De laag eronder is een
          en dezelfde (kern/office/docs.js), maar de DOOS verschilt per kring:
          een lid, het kantoor, een zaak en de werkplek hebben elk hun eigen
          documenten. Een document dat het kantoor aanmaakt, vindt het lid niet
          -- en dat hoort ook zo.

          Dus maakt de proef er een per kring, met het token van die kring, en
          geeft hem alleen door aan routes met datzelfde voorvoegsel. `id` is een
          te algemene naam om in het gedeelde lijf te zetten: dan zouden
          drieduizend andere routes er ineens een krijgen. */
  const doosjes = [
    ['kp', '/api/kantoorpakket/maak', tokens.member],
    ['kpOffice', '/api/office/kantoorpakket/maak', tokens.office],
    ['kpSupplier', '/api/supplier/kantoorpakket/maak', tokens.supplier],
    /* De werkplekkant wil ook weten WELK huis: /api/werkplek/ hangt aan
       kern/werkplek.js met twee vaste codes, en de baas mag overal in. */
    ['kpWerkplek', '/api/werkplek/kantoorpakket/maak', tokens.boardroom, { bedrijf: 'rtg' }]
  ];
  for (const [sleutel, pad, tok, extraLijf] of doosjes) {
    const d = await stil(pad, { titel: 'Proefdocument', ...(extraLijf || {}) }, tok);
    w[sleutel] = veld(d, 'document', 'id') || veld(d, 'id') || veld(d, 'doc', 'id');
  }

  /* 11f. DE RIJKSOVERHEID, langs de weg die daarvoor bestaat.

          Drie stappen, alle drie gewone routes met hun gewone poort ervoor:

            1. aansluiten   /api/office/instelling/aansluiten (boardroom) -- geeft
                            een bedrijfscode en een eenmalige beheer-PIN terug,
                            precies zoals bij een goedgekeurde partneraanvraag.
            2. wie is er    /api/supplier/roster -- de inlogkiezer die elke zaak
                            heeft; hij geeft het personeelsID bij de PIN.
            3. inloggen     /api/supplier/login met code + staffId + pin.

          Stap 2 is nodig omdat het aansluiten wel de PIN teruggeeft maar niet
          het ID waar hij bij hoort, en de personeelslogin allebei wil. Dat is
          geen omweg: het is hetzelfde scherm dat een medewerker ziet.

          De naam draagt met opzet het woord "proef": wie deze instelling in een
          lijst tegenkomt, hoort te zien dat hij van een proefronde is en niet
          van een echte overheidsdienst. */
  if (tokens.boardroom) {
    const inst = await stil('/api/office/instelling/aansluiten', {
      genre: 'rijk', naam: 'Proefrijksdienst (idemproef)', plaats: 'Proefstad', beheerder: 'Proefbeheerder'
    }, tokens.boardroom);
    const code = veld(inst, 'code'), pin = veld(inst, 'pin');
    if (code && pin) {
      const rooster = await stil('/api/supplier/roster', { code });
      const eerste = ((rooster.data && rooster.data.staff) || [])[0];
      if (eerste) {
        const login = await stil('/api/supplier/login', { code, staffId: eerste.id, pin });
        w.rijkToken = veld(login, 'token');
        w.rijkCode = code;
        /* DE SLEUTEL IN DE BOS, want een voorvoegsel geeft hier een ROL door en
           geen lijf, en tokenVoor() leest die rol rechtstreeks uit deze bak
           (scripts/lib/proefsleutels.js). Zonder deze regel wijst
           `rol: 'rijk'` naar een sleutel die niet bestaat en roept de proef de
           64 routes aan met GEEN token -- stiller mis dan met de verkeerde. */
        if (w.rijkToken) tokens.rijk = w.rijkToken;
      }
    }
  }

  /* 11g. GEEN TAXIBEDRIJF -- en waarom die deur toch dicht blijft.

          Eenenvijftig routes onder /api/supplier/mob, /api/staff/mob, /oog, /ov
          en /flits antwoorden "Deze functie is voor dit genre zaken
          uitgeschakeld door RTG." Dat is geen bevoegdheid maar een
          functieschakelaar per genre, en de demozaak van de proef is een hotel.
          Er staat wel een taxibedrijf in de seed (MKKX), maar dat heeft geen
          personeelsinlog: de demo-inlog komt altijd op DEMO_SUPPLIER uit.

          IK HEB DE AANMELDWEG GEBOUWD EN WEER WEGGEHAALD. De redenering was dat
          `taxi` een OPEN genre is en niet in BEWIJS_EISEN staat -- de acht
          genres die pas een zaak krijgen als een mens het papier heeft gezien.
          Dat klopte, en het was toch fout: ik had maar EEN van de twee lijsten
          gelezen. De aanvraagroute vraagt daarnaast om de officiele referenties
          uit `controle.eisenVoor()`, en voor taxi is dat de
          Kiwa-ondernemersvergunning taxivervoer. De proef kreeg gewoon een 400
          met die eis erin.

          Dat is de scherpere regel dan die ik bij de Rijksoverheid formuleerde.
          Niet "identiteit tegenover voorwerp", maar: EEN GENRE DAT BIJ HET
          AANMELDEN OM EEN VERGUNNINGREFERENTIE VRAAGT, IS EEN GENRE WAAR EEN
          MENS IETS HEEFT MOETEN ZIEN. Een proefronde die daar een verzonnen
          vergunningnummer intypt om eenenvijftig regels uit de kolom `ongemeten`
          te halen, verzint bewijs voor een gereguleerd beroep. Ze blijven
          ongemeten, en dat is de eerlijke uitslag.

          Wat hier WEL kan, en hieronder gebeurt: `ov` is een INTERN genre --
          dezelfde stand als `rijk` -- en gaat dus via
          /api/office/instelling/aansluiten en niet langs de aanmeldbalie. Dat
          dekt zeven van de eenenvijftig. De andere vierenveertig hangen aan
          `mob`, `oog` en `flits` en vragen alle drie een taxi- of vervoersgenre;
          die blijven dicht. */

  /* 11h. HET OPENBAAR VERVOER, langs dezelfde interne weg als de Rijksoverheid.

          Zeven routes (/api/staff/ov/*, /api/supplier/ov/overzicht) hangen aan
          de genre-schakelaar. `ov` staat in seed/genres-lijst-a.js als
          `status: 'intern'`, precies zoals `rijk`, dus geldt hier hetzelfde: dit
          genre wordt niet door een partner aangevraagd maar door RTG zelf
          aangesloten, en er komt geen vergunningreferentie aan te pas.

          DIT IS EEN UITBREIDING VAN HET BESLUIT OVER `rijk` naar een tweede
          intern genre, op dezelfde grond en langs dezelfde route. Het staat er
          zo bij zodat het terug te draaien is als de eigenaar dat anders ziet. */
  if (tokens.boardroom) {
    const ov = await stil('/api/office/instelling/aansluiten', {
      genre: 'ov', naam: 'Proefvervoerder (idemproef)', plaats: 'Proefstad', beheerder: 'Proefbeheerder'
    }, tokens.boardroom);
    const ovCode = veld(ov, 'code'), ovPin = veld(ov, 'pin');
    if (ovCode && ovPin) {
      const rooster = await stil('/api/supplier/roster', { code: ovCode });
      const eerste = ((rooster.data && rooster.data.staff) || [])[0];
      if (eerste) {
        const login = await stil('/api/supplier/login', { code: ovCode, staffId: eerste.id, pin: ovPin });
        w.ovToken = veld(login, 'token');
        if (w.ovToken) tokens.ov = w.ovToken;   // zelfde reden als bij `rijk`
      }
    }
  }

  /* 11i. VIJF OBJECTEN VOOR VIJF WERELDEN -- samen 192 routes.

          Na de vier grote deuren bleven er vijf clusters over die elk om
          hetzelfde vroegen: een voorwerp dat op naam van de aanvrager staat.
          Ze zijn stuk voor stuk een maak-route en een veldnaam, en die twee
          verschillen per wereld:

            festival      /api/festival/nieuw          veld `festival`   (zaak)
            entiteit      /api/concern/entiteit/nieuw  veld `entiteit`   (lid)
            onderneming   /api/onderneming/nieuw       veld `id`         (lid)
            onderzoek     /api/lab2/studie/maak        veld `id`         (kantoor)
            stadsafdeling /api/rtfos/stad/maak         veld `id`         (kantoor)

          Let op de laatste drie: ze heten alle drie `id`. Dat is precies waarom
          dit per VOORVOEGSEL gaat en niet in het gedeelde lijf -- `id` daarin
          zetten zou drieduizend andere routes een vreemd voorwerp geven. */
  {
    const fes = await stil('/api/festival/nieuw', { naam: 'Proeffestival' }, tokens.supplier);
    w.festival = veld(fes, 'festival', 'id');

    /* Een entiteit hangt aan een concern, dus die eerst. */
    const con = await stil('/api/concern/nieuw', { naam: 'Proefconcern' }, tokens.member);
    w.concern = veld(con, 'concern', 'id');
    const ent = await stil('/api/concern/entiteit/nieuw',
      { concern: w.concern || undefined, naam: 'Proefentiteit', rechtsvorm: 'bv' }, tokens.member);
    w.entiteit = veld(ent, 'entiteit', 'id');

    const ond = await stil('/api/onderneming/nieuw', { naam: 'Proefonderneming' }, tokens.member);
    w.onderneming = veld(ond, 'onderneming', 'id');

    /* Een studie hangt aan een LAB, en de seed heeft er een actief. Hem
       opzoeken in plaats van een id overtypen: een vaste code hier veroudert
       stil zodra de seed verandert. En `vraagstuk` moet echt tien tekens hebben
       -- met alleen een titel gaf de route 400 en bleef het cluster staan. */
    const labs = await stil('/api/lab2/labs', {}, tokens.office);
    const lab = ((labs.data && (labs.data.labs || labs.data.lijst)) || [])[0];
    if (lab && lab.id) {
      /* `soort: 'software'` en niet iets menselijks: SOORTEN in
         kern/livinglab/kader.js merkt de helft als `menselijk: true`, en een
         onderzoek met mensen erin hangt aan een ethiekstap. Een proefronde die
         zichzelf een gedragsonderzoek toekent, doet meer dan meten. */
      const studie = await stil('/api/lab2/studie/maak', { labId: lab.id, titel: 'Proefonderzoek',
        soort: 'software',
        vraagstuk: 'Een synthetisch vraagstuk voor de idempotentieproef, lang genoeg voor de eis.',
        doel: 'Meten wat een tweede oproep doet.' }, tokens.office);
      w.studie = veld(studie, 'studie', 'id');
    }

    /* Een stadsafdeling openen doet het LANDELIJKE bestuur (magBoardroom), niet
       het kantoor. Met de kantoorsleutel gaf de route 403 en bleef het cluster
       staan -- dezelfde soort vergissing als de klascode: een aanname over wie
       er aan de deur staat, die nergens zei dat hij fout was. */
    const stad = await stil('/api/rtfos/stad/maak', { naam: 'Proefstad' }, tokens.boardroom);
    w.stad = veld(stad, 'stad', 'id');
  }

  /* ---- DE INKOOPKETEN VAN DE AI-AGENT (EXECUTIE.md par. 7) ----------------

     De pilotketen van de execution plane is vier routes lang, en twee ervan
     stonden op `ongemeten`: /agent/voorstel gaf 409 en /agent/beslis 404. Dat
     lag niet aan die routes maar aan de opstelling -- er was geen gekoppelde
     groothandel en geen openstaand voorstel. EXECUTIE.md noemt dit met zoveel
     woorden "de goedkoopste denkbare eerste taak".

     Drie stappen, alle drie langs de gewone routes met hun eigen poorten:
     koppelen (alleen de gemachtigde), de markt lezen voor een echt productId,
     en een voorstel laten ontstaan. Er wordt niets voorgekookt: welke regels de
     AI voorstelt blijft aan de AI, en dat het voorstel in een verse database
     leeg is (te weinig verkoopdata) is de echte uitkomst -- daarom draagt
     /beslis zijn regels mee, wat precies de weg is die een manager ook heeft
     ("akkoord, maar dan deze regels"). */
  const koppel = await stil('/api/supplier/agent/koppel', { groothandelCode: 'MERCABIZA' }, tokens.supplier);
  if (koppel && koppel.status === 200) {
    w.groothandel = 'MERCABIZA';
    const markt = await stil('/api/supplier/inkoop/markt', { groothandelCode: 'MERCABIZA' }, tokens.supplier);
    const gh = ((markt && markt.data && markt.data.groothandels) || [])[0];
    const product = ((gh && gh.producten) || [])[0];
    if (product) w.ghProduct = product.id;
    const voorstel = await stil('/api/supplier/agent/voorstel', {}, tokens.supplier);
    w.agentVoorstel = veld(voorstel, 'voorstel', 'id');
  }

  return { wereld: w, extra: gedeeldLijf(w), perRoute: geldLijf(w), perVoorvoegsel: voorvoegselLijf(w),
    gemist: gemist(w, logboek) };
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
/* WAT DE WERELD HOORT TE HEBBEN, en wat het gekost heeft als het er niet is.

   De lijst staat hier en niet verspreid over de opbouw: zo is er EEN plek waar
   staat wat compleet betekent. Wie een keten toevoegt, zet hem hier ook neer --
   doet hij dat niet, dan valt zijn keten stil uit en is dat precies het gat dat
   deze lijst dicht.

   `via` is de route die het voorwerp had moeten opleveren. Ontbreekt het
   voorwerp, dan wordt in het logboek de LAATSTE oproep naar die route opgezocht
   en komt zijn status en melding mee. Dat is het verschil tussen "de klas
   ontbreekt" en "de klas ontbreekt, want /leraar/klas/maak gaf 403: alleen een
   leraar maakt klassen". */
const VERWACHT = [
  { sleutel: 'iban', wat: 'een bankrekening', via: '/api/bank/akkoord' },
  { sleutel: 'gezinCode', wat: 'een gezin', via: '/api/foundation/gezin/maak' },
  { sleutel: 'werkruimte', wat: 'een werkruimte', via: '/api/bedrijf/werkruimte/maak' },
  { sleutel: 'schoolCode', wat: 'een school', via: '/api/foundation/school/school/activeren' },
  { sleutel: 'personeelToken', wat: 'een leraar', via: '/api/foundation/school/personeel/uitnodiging/accepteer' },
  { sleutel: 'klasCode', wat: 'een klas', via: '/api/foundation/school/leraar/klas/maak' },
  { sleutel: 'kp', wat: 'een document van het lid', via: '/api/kantoorpakket/maak' },
  { sleutel: 'kpOffice', wat: 'een document van het kantoor', via: '/api/office/kantoorpakket/maak' },
  { sleutel: 'kpSupplier', wat: 'een document van de zaak', via: '/api/supplier/kantoorpakket/maak' },
  { sleutel: 'kpWerkplek', wat: 'een document van de werkplek', via: '/api/werkplek/kantoorpakket/maak' },
  { sleutel: 'rijkToken', wat: 'een Rijksoverheid-zaak', via: '/api/office/instelling/aansluiten' },
  { sleutel: 'ovToken', wat: 'een OV-zaak', via: '/api/supplier/login' },
  { sleutel: 'festival', wat: 'een festival', via: '/api/festival/nieuw' },
  /* De pilotketen van EXECUTIE.md par. 7. Drie sleutels, want ze kunnen elk
     apart wegvallen: geen koppeling, een groothandel zonder producten, of een
     voorstel dat niet ontstond. Alle drie horen ze gemeld te worden -- anders
     staan die twee routes weer op `ongemeten` zonder dat iemand ziet waarom. */
  { sleutel: 'groothandel', wat: 'een gekoppelde groothandel', via: '/api/supplier/agent/koppel' },
  { sleutel: 'ghProduct', wat: 'een product van de groothandel', via: '/api/supplier/inkoop/markt' },
  { sleutel: 'agentVoorstel', wat: 'een openstaand inkoopvoorstel', via: '/api/supplier/agent/voorstel' },
  { sleutel: 'entiteit', wat: 'een entiteit', via: '/api/concern/entiteit/nieuw' },
  { sleutel: 'onderneming', wat: 'een onderneming', via: '/api/onderneming/nieuw' },
  { sleutel: 'studie', wat: 'een onderzoek', via: '/api/lab2/studie/maak' },
  { sleutel: 'stad', wat: 'een stadsafdeling', via: '/api/rtfos/stad/maak' }
];

function gemist(w, logboek) {
  const uit = [];
  for (const e of VERWACHT) {
    if (w[e.sleutel]) continue;
    /* De LAATSTE oproep telt: een keten kan een route twee keer aanroepen (een
       poging en een herstelpoging), en dan is de laatste wat er echt gebeurde. */
    let laatste = null;
    for (const r of logboek) if (r.pad === e.via) laatste = r;
    uit.push({ wat: e.wat, via: e.via,
      status: laatste ? laatste.status : null,
      melding: laatste ? laatste.error : 'deze route is nooit aangeroepen -- de keten brak eerder af' });
  }
  return uit;
}

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
    /* `klasCode` erbij: de directie mag met haar beheerToken bij alle klassen
       (server/school/poorten.js klasVan), dus de klascode is het enige dat nog
       ontbrak. Een eigen tokenveld is niet nodig en zou botsen met de gezinssleutel. */
    uit.push({ voorvoegsel: '/api/foundation/school/',
      lijf: { code: w.gezinCode, token: w.gezinToken,
        schoolCode: w.schoolCode || undefined, beheerToken: w.schoolBeheerToken || undefined,
        klasCode: w.klasCode || undefined } });
    uit.push({ voorvoegsel: '/api/foundation/', lijf: { code: w.gezinCode, token: w.gezinToken } });

    /* EN /api/rtf/, DE GROOTSTE POST VAN ALLEMAAL -- 208 routes.

       Hetzelfde gezinsprofiel, een ander adres. server/routes/baby.js en zijn
       buren doen `rtf.verifieerProfiel(req.body.code, req.body.token)` en
       antwoorden anders "Log opnieuw in bij je gezin." Dat was met afstand de
       meest gehoorde zin in het register: 208 van de 3402 geblokkeerde routes,
       en de nummer twee stond op 64.

       Ze stonden er niet omdat de wereld geen gezin had -- dat maakt hij hierboven
       netjes aan -- maar omdat de regel alleen /api/foundation/ noemde. Sterker:
       zonder deze regel kregen ze `code` uit het GEDEELDE lijf, en dat is de
       KASCODE. Een gezinspoort die een kascode voorgeschoteld krijgt, weigert
       terecht.

       Dezelfde soort vergissing als de /api/school/-regel die hierboven wordt
       beschreven: een aanname over waar iets hangt, die nul routes raakte en
       daarover zweeg. Een voorvoegsel dat niets matcht, hoort iets te zeggen --
       zie de telling die scripts/idemproef-route.js hierna afdrukt. */
    uit.push({ voorvoegsel: '/api/rtf/', lijf: { code: w.gezinCode, token: w.gezinToken } });
  }
  if (w.werkruimte) {
    uit.push({ voorvoegsel: '/api/bedrijf/',
      lijf: { werkruimte: w.werkruimte, beheerToken: w.beheerToken || undefined, lidToken: w.lidToken || undefined } });
  }
  /* Het werkplek-huis is niet aan te maken: server/kern/werkplek.js kent twee
     vaste codes ('rtg', 'rtf') en geen route die er een derde bij zet. `magIn`
     laat de BAAS overal in, en dat is de eigenaar -- dus de boardroom-sleutel. */
  uit.push({ voorvoegsel: '/api/werkplek/', lijf: { bedrijf: 'rtg' }, rol: 'boardroom' });

  /* De overheidskant draait op een EIGEN ROL en niet op een eigen lijf: die 64
     routes willen geen extra veld, ze willen een zaak van het genre `rijk`. Het
     voorvoegsel geeft dus de sleutel mee en verder niets. */
  if (w.rijkToken) uit.push({ voorvoegsel: '/api/overheid/', lijf: {}, rol: 'rijk' });

  /* De OV-kant, om dezelfde reden een ROL en geen lijf. Smal gehouden: alleen de
     twee ov-voorvoegsels, want /api/staff/ of /api/supplier/ in zijn geheel zou
     honderden routes van de ene zaak naar de andere verhuizen. */
  if (w.ovToken) {
    uit.push({ voorvoegsel: '/api/staff/ov/', lijf: {}, rol: 'ov' });
    uit.push({ voorvoegsel: '/api/supplier/ov/', lijf: {}, rol: 'ov' });
  }

  /* De kantoorpakketten, elk met het document van HUN kring. Deze staan hier
     onderaan maar zijn SPECIALER dan /api/werkplek/ en /api/supplier/ hierboven,
     dus ze moeten ervoor -- de eerste treffer wint (zie de waarschuwing bij
     /api/foundation/school/). Vandaar unshift en geen push.

     DIT BLOK IS EEN KEER WEGGEWEEST, op 30 augustus 2026: bij het weghalen van
     de taxiketen sneed ik van "de mobiliteitskant" tot "return uit" weg, en dit
     stond daartussen. Gevolg: vier documenten werden nog wel AANGEMAAKT maar
     nergens meer meegegeven, "Document niet gevonden" sprong van 14 terug naar
     64, en ik las die terugval eerst als variatie in de wereldopbouw. Wat hem
     aanwees was de regel die de proef zelf afdrukt -- de voorvoegsels met hun
     velden -- want daar stonden ze ineens niet meer bij. */
  for (const [voorvoegsel, id, rol] of [
    ['/api/kantoorpakket/', w.kp],
    ['/api/office/kantoorpakket/', w.kpOffice],
    ['/api/supplier/kantoorpakket/', w.kpSupplier],
    ['/api/werkplek/kantoorpakket/', w.kpWerkplek, 'boardroom']
  ]) {
    if (id) uit.unshift(rol ? { voorvoegsel, lijf: { id }, rol } : { voorvoegsel, lijf: { id } });
  }

  /* De vijf objectwerelden. Elk voorvoegsel krijgt ALLEEN het veld dat zijn
     eigen poort leest; drie ervan heten `id` en zouden elkaar in een gedeelde
     bak overschrijven. */
  if (w.festival) uit.push({ voorvoegsel: '/api/festival/', lijf: { festival: w.festival } });
  if (w.entiteit) uit.push({ voorvoegsel: '/api/concern/', lijf: { entiteit: w.entiteit,
    concern: w.concern || undefined, onderneming: w.onderneming || undefined } });
  if (w.onderneming) uit.push({ voorvoegsel: '/api/onderneming/', lijf: { id: w.onderneming } });
  if (w.studie) uit.push({ voorvoegsel: '/api/lab2/', lijf: { id: w.studie }, rol: 'office' });
  if (w.stad) uit.push({ voorvoegsel: '/api/rtfos/', lijf: { id: w.stad }, rol: 'boardroom' });
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
    '/api/pay/saldo': { invoiceId: w.factuurId },
    /* De pilotketen. `beslis` krijgt zijn regels mee omdat een voorstel in een
       verse database leeg is; dat is de weg van de manager die de lijst
       aanpast, en niet een omweg om de route. */
    '/api/supplier/agent/koppel': { groothandelCode: w.groothandel },
    '/api/supplier/agent/beslis': { id: w.agentVoorstel, actie: 'akkoord',
      regels: w.ghProduct ? [{ productId: w.ghProduct, aantal: 2 }] : null }
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
