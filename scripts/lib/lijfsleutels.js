/* ============================================================================
   DE LIJFSLEUTEL -- een sleutel die in het LICHAAM reist, niet in de kop.

   HET PROBLEEM. scripts/lib/bewakers.js kent een soort deur die hij
   `lichaamssleutel` noemt en waaraan hij bewust GEEN rol hangt, met deze reden:
   "de sleutel staat in het lichaam en niet in de kop, dus rollen kruisen zegt
   hier niets". Dat klopt -- voor de ROLPROEF, die met een verkeerde rol
   aanklopt om scheiding te toetsen. Met een lijfsleutel bestaat "de verkeerde
   rol" niet: je hebt de sleutel of je hebt hem niet.

   Maar de IDEMPROEF kruist niets. Die herhaalt een oproep met de JUISTE sleutel
   en kijkt of de tweede keer werk oplevert. Voor dat instrument is zo'n route
   wel degelijk te beproeven, zodra er een sleutel te maken is. Eén reden, twee
   instrumenten, tegengestelde conclusies -- en zolang er maar één begrip was
   (`rol`), won de strengste en telden honderden routes als instrumenttekort.

   Vandaar dit tweede begrip NAAST rol, en met opzet niet erin: de rolproef mag
   deze deuren niet gaan kruisen, want daar zou hij groen worden op iets wat hij
   niet heeft gemeten.

   WAT EEN FAMILIE IS. Een naam, de paden waar hij over gaat, en een BOUWER die
   de wereld werkelijk aanmaakt en de velden teruggeeft die daarna in elk lijf
   meegaan -- of, bij sommige, NIETS meegeeft en alleen een rol declareert. Dat
   laatste is geen leeg geval: een route zonder middleware waarvan de HANDLER
   een sessie eist, is voor de bewakerskaart niet van een gat te onderscheiden,
   en toch gewoon te openen met het juiste token. Optioneel ook een ROL: sommige deuren vragen allebei -- een
   bestaande sessie in de KOP en een aanwijzing in het LIJF welk object je
   bedoelt. `huisAuth` van de werkplek is daar het voorbeeld van: hij leest de
   boardroom-sessie en daarnaast `bedrijf` uit het lijf, en zonder allebei is
   het 404 of 403. Een familie zonder rol stuurt geen Authorization-kop mee. Geen verzonnen tokens: de bouwer loopt door de echte deur van het
   product, want een sleutel die niet uit de applicatie komt bewijst niets over
   de applicatie.

   EN WAT HIER NIET GEBEURT: er wordt geen omgevingsvlag omgezet om een deur
   open te krijgen. De schoolfixture (/school/school/maak) staat buiten
   NODE_ENV=test met 410 dicht, en die vlag aanzetten zou de hele server een
   andere server maken -- dan meet de proef iets wat het product niet is. Zo'n
   familie hoort langs de ECHTE weg te worden opgebouwd of eerlijk te ontbreken,
   met de reden erbij. */
'use strict';

const fs = require('fs');
const path = require('path');

/* De activatielink uit de outbox van de proefopstelling. Peilt tot de mail er
   ECHT is in plaats van een aantal milliseconden te gokken -- dezelfde les als
   wachtOpBestand() in test/helper.js, en om dezelfde reden: een slaapje is te
   kort op een trage machine en gooit tijd weg op een snelle. */
async function leesActivatie(datamap, msMax) {
  const outbox = path.join(datamap, 'outbox');
  const tot = Date.now() + (msMax || 8000);
  while (Date.now() < tot) {
    let namen = [];
    try { namen = fs.readdirSync(outbox); } catch (e) { namen = []; }
    for (const n of namen) {
      let tekst = '';
      try { tekst = fs.readFileSync(path.join(outbox, n), 'utf8'); } catch (e) { continue; }
      const m = /#activeren=([A-Z0-9]+\.[a-f0-9]{48})/i.exec(tekst);
      if (m) return m[1];
    }
    await new Promise(r => setTimeout(r, 40));
  }
  return null;
}

const FAMILIES = [
  {
    naam: 'werkruimte',
    /* Alle werkPoort-, beheerVan- en lidVan-routes van het Werk OS wonen onder
       dit voorvoegsel; gemeten met scripts/handlerwacht.js. */
    /* /api/tenant/ hangt aan dezelfde sleutel: viaBeheerOfDirectie
       (server/routes/tenant/poort.js) leest `beheerToken` uit het lijf en valt
       anders terug op een lid-token met het recht "werkruimte". Zelfde deur,
       ander voorvoegsel -- dus hier erbij en niet als tweede familie. */
    prefixen: ['/api/bedrijf/', '/api/tenant/'],
    velden: ['beheerToken', 'werkruimte'],
    waarom: 'werkPoort en beheerVan lezen `beheerToken` uit het lijf; de werkruimte ' +
      'ontstaat pas bij het aanmaken en het token wordt daar EEN keer getoond',
    async bouw({ post }) {
      const r = await post('/api/bedrijf/werkruimte/maak',
        { naam: 'Proefwerkruimte', land: 'NL', valuta: 'EUR' }, null);
      const d = r && r.data;
      if (!d || !d.beheerToken) return null;
      return { beheerToken: d.beheerToken, werkruimte: d.werkruimte };
    }
  },
  {
    naam: 'school',
    /* 165 van de 175 schoolroutes wonen onder dit ene voorvoegsel; gemeten met
       scripts/handlerwacht.js over de wachten poort/schoolVan/klasVan/lesVan/
       personeelVan. */
    prefixen: ['/api/foundation/school/'],
    velden: ['schoolCode', 'beheerToken'],
    waarom: 'de schoolpoort (server/school/rollen.js) leest schoolCode plus beheerToken ' +
      'of personeelToken uit het lijf; die ontstaan pas als een registratie is goedgekeurd',
    /* DE ECHTE WEG, EN WAAROM NIET DE KORTE. Er bestaat een snelle deur
       (/api/foundation/school/school/maak) die in een keer een school met een
       beheersleutel maakt -- maar die geeft buiten NODE_ENV=test een 410, en die
       vlag aanzetten zou de hele server een andere server maken: dan meet de
       proef iets wat het product niet is (zie de kop van dit bestand).

       Dus loopt de bouwer de productieweg af, met vier echte oproepen:
         1. de registratie aanvragen (openbaar, achter een rem)
         2. de vijf toelatingscontroles aftekenen -- boardroom, want dat is wie
            het mag; elke controle vraagt een referentie van minstens 3 tekens
         3. het besluit nemen (goedkeuren kan pas als er geen enkele controle
            meer openstaat; magGoedkeuren weigert anders)
         4. activeren met het eenmalige geheim, want pas DAAR komt het
            beheerToken naar buiten.

       EN DAT GEHEIM KOMT NIET UIT HET ANTWOORD. Het besluit geeft alleen de
       schoolcode terug; de activatielink gaat naar het GECONTROLEERDE
       schooladres en nergens anders. Dat is geen omissie maar het ontwerp: wie
       een registratie goedkeurt, hoort de sleutel niet in handen te krijgen.
       De bouwer leest hem daarom uit de outbox van de wegwerpserver -- dezelfde
       weg die test/foundationregistratie.test.js al gebruikt, en dus geen
       tweede manier om aan dezelfde mail te komen (LAT.md regel 4).

       Dat is de enige stap die buiten het HTTP-vlak valt, en dat hoort hier te
       staan in plaats van weggemoffeld: deze familie leunt op de datamap van de
       proefopstelling. Zonder die map is hij niet te bouwen, en dan meldt hij
       zich als mislukt in plaats van een sleutel te verzinnen.

       Loopt een van de stappen stuk, dan komt er geen sleutel. Half doorlopen
       en dan iets invullen zou een sleutel opleveren die het product nooit
       heeft uitgegeven. */
    async bouw({ post, tokens, datamap }) {
      const brin = String(Math.floor(Math.random() * 9000) + 1000) + 'AB';
      const aanvraag = await post('/api/foundation/registratie/aanvragen', {
        type: 'school', naam: 'Proefschool', plaats: 'Proefstad', brin,
        contactNaam: 'Proef Directie', email: 'proefschool@voorbeeld.test', landCode: 'NL',
        bevoegd: true, waarheidsgetrouw: true, privacyAkkoord: true
      }, null);
      const id = aanvraag && aanvraag.data && aanvraag.data.id;
      if (!id) return null;
      if (!tokens || !tokens.boardroom) return null;   // zonder boardroom geen controle
      const eisen = ((aanvraag.data.aanvraag || {}).controles || []).map(c => c.id);
      if (!eisen.length) return null;
      for (const onderdeel of eisen) {
        await post('/api/office/foundation/registratie/controle', {
          id, onderdeel, uitkomst: 'geverifieerd',
          referentie: 'proefopstelling: gecontroleerd voor de idemproef'
        }, tokens.boardroom);
      }
      const besluit = await post('/api/office/foundation/registratie/besluit',
        { id, action: 'goedkeuren' }, tokens.boardroom);
      if (!besluit || !besluit.data || !besluit.data.ok) return null;
      if (!datamap) return null;
      const geheim = await leesActivatie(datamap);
      if (!geheim) return null;
      const act = await post('/api/foundation/school/school/activeren', { activatie: geheim }, null);
      const d = act && act.data;
      if (!d || !d.beheerToken) return null;
      return { schoolCode: d.schoolCode, beheerToken: d.beheerToken };
    }
  },
  {
    naam: 'gezin',
    /* Gemeten met scripts/handlerwacht.js over de wachten familieVan, gezinVan,
       gezinSessie, rtfSpeler, rtfSociaal, profiel, samenSess en sessieVan: 187
       routes, verdeeld over deze twee voorvoegsels. Ze lezen allemaal dezelfde
       twee velden -- de gezinscode en het profieltoken. */
    /* De markt en de hulplijn staan buiten /gezin/ en /rtf/ maar hangen aan
       dezelfde deur: familieVan roept sessieVan aan, en dat is opnieuw de
       gezinscode plus het profieltoken (server/foundation.js). Ze zijn er
       daarom bij gezet in plaats van als eigen familie -- twee families met
       dezelfde sleutel lopen uiteen zodra er iets aan verandert. */
    prefixen: ['/api/foundation/gezin/', '/api/rtf/',
      '/api/foundation/markt/', '/api/foundation/hulp/', '/api/foundation/mail/'],
    velden: ['code', 'token'],
    waarom: 'de RTF-kant draait op een gezinscode plus een profieltoken uit het lijf ' +
      '(server/foundation/sollicitaties.js, verifieerProfiel); een gezin ontstaat aan de ' +
      'openbare deur en geeft die twee daar meteen terug',
    /* Deze deur is met opzet openbaar (een gezin heeft nog geen account) en
       geeft code en token in het antwoord -- anders dan bij de school, waar de
       sleutel naar het gecontroleerde adres gaat. Er is hier dus niets uit een
       outbox te lezen en geen omweg nodig.

       De twee verklaringen gaan mee omdat de route ze buiten NODE_ENV=test
       verplicht stelt. Ze meesturen is geen omzeiling maar precies wat een echt
       gezin ook doet; ze weglaten zou de fixture laten stranden op een 400 en
       daarmee 187 routes ongemeten laten. */
    async bouw({ post }) {
      /* DE VELDNAMEN KOMEN UIT DE ROUTE EN NIET UIT DE VERWACHTING. Hier stond
         `naam` voor de gezinsnaam en `beheerder` voor de persoon; de route leest
         `gezinsnaam` en `naam` (server/foundation/gezin.js). De bouwer kreeg
         netjes "Geef je gezin een naam" terug en meldde zich als mislukt -- maar
         de trechter telde de 187 routes toen al als gedekt, want die keek naar
         de DECLARATIE en niet naar de uitkomst. Zie de kop van dit bestand. */
      const r = await post('/api/foundation/gezin/maak', {
        gezinsnaam: 'Proefgezin', naam: 'Proef Beheerder', pin: '1234',
        bevoegdGezin: true, privacyAkkoord: true
      }, null);
      const d = r && r.data;
      if (!d || !d.code || !d.token) return null;
      return { code: d.code, token: d.token };
    }
  },
  {
    naam: 'werkplek',
    /* 71 routes onder deze twee voorvoegsels, alle achter huisAuth
       (server/routes/werkplek.js). */
    prefixen: ['/api/werkplek/'],
    velden: ['bedrijf'],
    rol: 'boardroom',
    waarom: 'huisAuth leest de boardroom-sessie uit de KOP en daarnaast `bedrijf` uit het ' +
      'LIJF; zonder allebei is het 404 (onbekend bedrijf) of 403 (geen sleutel voor dit huis)',
    /* HIER VALT NIETS TE BOUWEN, en dat is het punt. De twee huizen (rtg en rtf)
       staan vast in server/kern/werkplek.js -- ze worden niet aangemaakt, ze
       BESTAAN. Wat ontbrak was niet een sleutel maar de wetenschap welk veld je
       moet meesturen; de eigenaar mag in beide huizen (magIn geeft true zodra
       `baas`), en de boardroom-sleutel van de proefopstelling IS de eigenaar.

       De bouwer controleert dat ook echt in plaats van het aan te nemen: hij
       klopt een keer aan met het veld erbij. Komt daar geen 2xx uit, dan meldt
       de familie zich als mislukt in plaats van 71 routes als "gedekt" te laten
       tellen terwijl ze allemaal op 403 stuklopen. Dat is dezelfde les als bij
       de gezinsfamilie, die op twee veldnamen strandde terwijl de trechter hem
       al meetelde. */
    async bouw({ post, tokens }) {
      if (!tokens || !tokens.boardroom) return null;
      const r = await post('/api/werkplek/mijn', { bedrijf: 'rtg' }, tokens.boardroom);
      if (!r || r.status < 200 || r.status >= 300) return null;
      return { bedrijf: 'rtg' };
    }
  },
  {
    naam: 'les',
    /* De onderwijskant van de RTFoundation: het digitale schoolbord, de agenda,
       de opgaven en het schrift. Tien routes achter lesVan/docentCheck. */
    /* MET EN ZONDER SLUITENDE STREEP. `/api/foundation/agenda` bestaat als
       route NAAST `/api/foundation/agenda/verwijder`, en een voorvoegsel dat op
       een streep eindigt mist de eerste. Twee routes vielen daardoor stil
       buiten deze familie -- geen foutmelding, ze stonden gewoon in de bak
       "geen sleutel". Een toets loopt dit nu voor elke familie na. */
    prefixen: ['/api/foundation/les/', '/api/foundation/bord/', '/api/foundation/agenda/',
      '/api/foundation/agenda', '/api/foundation/opgave/', '/api/foundation/opgave',
      '/api/foundation/schrift/', '/api/foundation/ai'],
    velden: ['code', 'token'],
    waarom: 'lesVan leest de lescode uit het lijf en docentCheck de docentsleutel via ' +
      'tokenUit(req), die ook het lijfveld `token` accepteert (server/foundation/basis.js)',
    /* Bewust zonder inlog -- een quizbord in de klas -- en dus geeft de deur
       code en sleutel gewoon terug. Wel met de uurgrens per IP die er sinds
       kort op zit (test/foundation-lesrem.test.js); een fixture die er een
       maakt, past ruim binnen die twintig.

       LET OP DE VELDNAMEN: `code` en `token` heten hier hetzelfde als bij het
       gezin, en dat is geen dubbeling maar toeval. De voorvoegsels overlappen
       niet, en de eerste treffer wint -- maar wie hier een pad toevoegt dat ook
       onder /api/foundation/gezin/ of /api/rtf/ valt, krijgt stil de verkeerde
       sleutel. Dat is de reden dat de prefixen expliciet en smal staan. */
    async bouw({ post }) {
      const r = await post('/api/foundation/les/maak', { vak: 'Proefles', naam: 'Proef Begeleider' }, null);
      const d = r && r.data;
      if (!d || !d.code || !d.token) return null;
      return { code: d.code, token: d.token };
    }
  },
  {
    naam: 'gast',
    /* De gastenkant van de horeca: bestellen, de rekening, de pols, verzoeken.
       Zestien routes achter gastAuth, dat `sleutel` uit het lijf leest
       (server/routes/gast.js). */
    prefixen: ['/api/gast/'],
    velden: ['sleutel'],
    waarom: 'gastAuth herkent een TAFELSESSIE aan `sleutel` uit het lijf; die ontstaat pas ' +
      'als iemand aan een tafel aanschuift, en die tafel bestaat pas als de zaak er een QR voor uitgaf',
    /* DRIE ECHTE STAPPEN, en geen ervan is over te slaan:
         1. de zaak geeft een QR uit voor een tafel (supplier)
         2. de gast wisselt die QR-token voor de tafel in (openbaar -- dat is
            wat er gebeurt als je de sticker scant)
         3. de gast schuift aan en krijgt DAAR pas zijn sessiesleutel

       De actor is hier een TAFEL en geen persoon: een gast hoeft zich niet te
       identificeren om te bestellen, en de envelop zegt dat met zoveel woorden
       ('anoniem'). Een fixture die dat overslaat en een sleutel verzint, zou
       precies het ding omzeilen dat deze routes beschermt. */
    async bouw({ post, tokens }) {
      if (!tokens || !tokens.supplier) return null;
      const qr = await post('/api/supplier/horeca/gast/qr', { tafel: 'Proeftafel' }, tokens.supplier);
      const token = qr && qr.data && qr.data.token;
      if (!token) return null;
      const tafel = await post('/api/gast/tafel', { token }, null);
      if (!tafel || tafel.status !== 200) return null;
      const aan = await post('/api/gast/aanschuiven', { token, naam: 'Proefgast' }, null);
      const sleutel = aan && aan.data && aan.data.sleutel;
      if (!sleutel) return null;
      return { sleutel };
    }
  },
  {
    naam: 'doos',
    /* De zaakdoos: het kastje in de zaak dat zijn status, metingen en dagrapport
       meldt op het EIGEN net van de zaak. Vier routes achter doosSleutelOk. */
    prefixen: ['/api/doos/'],
    velden: [],
    koppen: ['x-doos-sleutel'],
    waarom: 'doosSleutelOk vergelijkt de kop x-doos-sleutel tijd-veilig met RTG_DOOS_SLEUTEL ' +
      'uit de omgeving; zonder die omgevingsvariabele bestaat de deur niet (server/routes/doos.js)',
    /* DIT IS DE ENIGE FAMILIE MET EEN KOP IN PLAATS VAN EEN LIJFVELD, en dat
       verschil is geen detail. De sleutel hoort in een kop te reizen; hem in de
       body meesturen zou een weg beproeven die de route niet kent, en dan meet
       de proef iets anders dan het product doet.

       De sleutel komt uit de omgeving van de wegwerpserver. Dat is geen
       omzeiling maar dezelfde soort opstelling als OFFICE_CODE, die de proef al
       zet: zonder RTG_DOOS_SLEUTEL bestaat deze deur helemaal niet, ook niet in
       productie. Staat hij niet gezet, dan meldt de familie zich als mislukt --
       geen verzonnen sleutel, want dan zou 403 als 200 gaan lezen. */
    async bouw({ post, doosSleutel }) {
      if (!doosSleutel) return null;
      /* Aankloppen op een route die WERKELIJK een POST is. De eerste versie
         probeerde /api/doos/status, en dat is een GET -- de proef kreeg 403 en
         de familie meldde zich als mislukt. Dat is precies wat een bouwer hoort
         te doen als hij zijn sleutel niet kan bewijzen, en het was hier de
         verkeerde deur en niet de verkeerde sleutel. */
      const r = await post('/api/doos/update/status', { versie: 'proef', ok: true }, null,
        { 'x-doos-sleutel': doosSleutel });
      if (!r || r.status < 200 || r.status >= 300) return null;
      return { __koppen: { 'x-doos-sleutel': doosSleutel } };
    }
  },
  {
    naam: 'partner',
    /* Drie routes van het partnerkanaal. Ze hebben GEEN middleware -- de
       controle zit in de handler (partnerSessie) -- en eisen daar de
       capability `can_be_partner`. Die zit op de zakelijke treden en niet op
       RTG Pass, dus het gewone lid-token geeft hier 403. Dat is de scheiding
       die werkt, en precies waarom dit een eigen rol is. */
    /* `/api/partner` bestaat als kale route NAAST /api/partner/apply -- de
       toets uit 1m ving dat meteen. */
    prefixen: ['/api/partner/', '/api/partner'],
    velden: [],
    rol: 'member-zakelijk',
    waarom: 'partnerSessie leest de Bearer uit de kop en eist can_be_partner; met tier=business ' +
      'geeft /api/partner/types 200, met lifestyle 403 met de reden erbij',
    async bouw({ post, tokens }) {
      if (!tokens || !tokens['member-zakelijk']) return null;
      const r = await post('/api/partner/types', {}, tokens['member-zakelijk']);
      if (!r || r.status !== 200) return null;
      return {};
    }
  },
  {
    naam: 'codelink',
    /* RTG Link en de codelaag. Allebei op dezelfde functie: wieScant
       (kern/link/wie.js) leest de Bearer uit de kop en herkent daar een lid,
       een zaak, personeel of kantoor in. Geen lijfveld, alleen een sessie --
       en dus was dit voor de bewakerskaart niet van een gat te onderscheiden. */
    prefixen: ['/api/code/', '/api/link/'],
    velden: [],
    rol: 'member',
    waarom: 'wieScant leest de Bearer uit de kop; er is geen middleware, dus de bewakerskaart ' +
      'ziet hier geen laag terwijl er wel degelijk een sessie nodig is',
    async bouw({ post, tokens }) {
      if (!tokens || !tokens.member) return null;
      const r = await post('/api/link/koppelingen', {}, tokens.member);
      if (!r || r.status < 200 || r.status >= 300) return null;
      return {};
    }
  },
  {
    naam: 'arrival',
    /* De gastenkant van Invisible Arrival: twee routes achter arrivalPassAuth,
       dat `pass` uit het lijf leest. */
    prefixen: ['/api/arrival/pass', '/api/arrival/pulse'],
    velden: ['pass'],
    waarom: 'arrivalPassAuth zoekt de Arrival Pass op `pass` uit het lijf; die ontstaat bij ' +
      '/api/arrival/request, dat een aanvraagcode inwisselt voor een reservering',
    /* DE AANVRAAGCODE KIEST DE CLIENT ZELF, en dat is met opzet zo: de server
       bewaart alleen de HASH ervan (arrival-toegang.js). De fixture mag hem dus
       zelf verzinnen -- dat is geen omzeiling maar precies het ontwerp. Wat hij
       niet mag overslaan is de aanvraag zelf: zonder een echte reservering
       bestaat er geen pass om mee te herkennen. */
    async bouw({ post, tokens }) {
      if (!tokens || !tokens.supplier) return null;
      /* DE ZAAKCODE KOMT UIT DE INLOG en niet uit een aparte route: die bestaat
         niet (/api/supplier/mijn geeft 404). Hier opnieuw inloggen is geen
         omweg maar de enige plek waar de code te halen valt -- `state` komt
         alleen bij het aanmelden mee. */
      const inlog = await post('/api/supplier/login', { username: 'rahul', password: 'Imran' }, null);
      const st = inlog && inlog.data && inlog.data.state;
      const code = st && (st.code || (st.supplier && st.supplier.code) || (st.zaak && st.zaak.code));
      if (!code) return null;
      const deel = () => Array.from({ length: 24 }, () =>
        'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
      const requestToken = deel() + '.' + deel();
      const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const r = await post('/api/arrival/request', { requestToken, supplierCode: code,
        datum: morgen, tijd: '19:00', personen: 2, naam: 'Proefgast' }, null);
      const pass = r && r.data && r.data.pass && r.data.pass.accessToken;
      if (!pass) return null;
      return { pass };
    }
  },
  {
    naam: 'toestel',
    /* Een gekoppeld toestel schrijft zijn metingen met een eigen sleutel in de
       kop. Voor WIE er geschreven wordt volgt uit die sleutel en staat niet in
       het verzoek -- dus een toestel kan alleen bij het lid dat hem koppelde. */
    prefixen: ['/api/toestel/'],
    velden: [],
    koppen: ['x-rtg-toestel'],
    waarom: 'toestelVanSleutel leest x-rtg-toestel uit de kop; die sleutel komt EEN keer terug ' +
      'bij het koppelen (/api/toestellen/koppel) en wordt daarna nergens bewaard',
    async bouw({ post, tokens }) {
      if (!tokens || !tokens.member) return null;
      const r = await post('/api/toestellen/koppel', { naam: 'Proeftoestel' }, tokens.member);
      const sleutel = r && r.data && r.data.sleutel;
      if (!sleutel) return null;
      return { __koppen: { 'x-rtg-toestel': sleutel } };
    }
  },
  {
    naam: 'lifestyle',
    /* DE PAS IS DE SLEUTEL, en niet een veld of een sessie.

       Gemeten over de 668 routes in FIXTURE_403: 191 worden geweigerd op een
       PAS, en 168 daarvan wonen in vier takken -- De Rechterhand (69), het
       Privekantoor (67), Rendez-vous (17) en RTG Lifestyle (15). De proef
       logde in met tier=rtg, en dat is de instappas; deze vier zijn
       uitvoering, en daar betaal je juist voor (WERELDEN.md: RTG betaalt voor
       het platform, Lifestyle voor uitvoering).

       Met tier=rtg geeft /api/member/bureau/ai een 403 met "Het Privekantoor
       is onderdeel van de Lifestyle Pass"; met tier=lifestyle een 200. Vooraf
       gemeten en niet aangenomen.

       WAAROM DIT EEN FAMILIE IS EN GEEN BREDERE `member`-ROL. De bewakerskaart
       ziet hier `auth` staan en zegt terecht `member` -- de deur eist een
       ledensessie en verder niets; de PAS-controle zit in de handler. Zou ik
       `member` overal op lifestyle zetten, dan kan de rolproef niet meer zien
       dat een RTG Pass hier buiten hoort te blijven, en dat is precies de
       scheiding die deze 191 routes bewaken. */
    prefixen: ['/api/member/rechterhand/', '/api/member/bureau/',
      '/api/member/rendezvous/', '/api/member/lifestyle/'],
    velden: [],
    rol: 'member-lifestyle',
    waarom: 'deze vier takken weigeren een RTG Pass met zoveel woorden ("onderdeel van de ' +
      'Lifestyle Pass"); de pas is hier de sleutel en de sessie alleen de deur',
    async bouw({ post, tokens }) {
      if (!tokens || !tokens['member-lifestyle']) return null;
      const r = await post('/api/member/bureau/ai', {}, tokens['member-lifestyle']);
      if (!r || r.status < 200 || r.status >= 300) return null;
      return {};
    }
  }
];

/* Bouwt wat er te bouwen valt. Geeft per familie terug of het gelukt is EN
   waarom niet -- een familie die stil ontbreekt, laat honderden routes stil
   ongemeten (LAT.md regel 3). */
async function bouwLijfsleutels(ctx) {
  const gebouwd = [];
  const mislukt = [];
  const velden = new Map();   // prefix -> velden
  for (const f of FAMILIES) {
    let uit = null;
    try { uit = await f.bouw(ctx); } catch (e) { uit = null; }
    if (!uit) { mislukt.push({ naam: f.naam, reden: 'de bouwer kreeg geen sleutel terug' }); continue; }
    /* `koppen` is met opzet een APARTE uitkomst en geen veld in het lijf: een
       apparaatsleutel die in een kop hoort te reizen, in de body meesturen zou
       een andere weg beproeven dan de route werkelijk kent. */
    const koppen = uit.__koppen || null;
    const lijf = Object.assign({}, uit); delete lijf.__koppen;
    gebouwd.push({ naam: f.naam, velden: Object.keys(lijf), rol: f.rol || null, koppen: !!koppen });
    for (const p of f.prefixen) velden.set(p, { velden: lijf, rol: f.rol || null, koppen });
  }
  const vind = (pad) => {
    for (const [p, v] of velden) if (String(pad).startsWith(p)) return v;
    return null;
  };
  const lijfVoor = (pad) => { const v = vind(pad); return v ? v.velden : null; };
  /* Welke rol deze route nodig heeft NAAST het lijf. `null` betekent: geen kop.
     Dat onderscheid hoort expliciet te zijn -- een undefined die toevallig geen
     kop oplevert, is niet te onderscheiden van een vergeten rol. */
  const rolVoor = (pad) => { const v = vind(pad); return v ? v.rol : null; };
  /* Extra koppen voor deze route, of null. Zie de opmerking bij `__koppen`. */
  const koppenVoor = (pad) => { const v = vind(pad); return v ? v.koppen : null; };
  const dekt = (pad) => !!vind(pad);
  return { gebouwd, mislukt, lijfVoor, rolVoor, koppenVoor, dekt, families: FAMILIES.map(f => f.naam) };
}

/* Voor wie alleen wil weten WELKE paden een familie zou dekken, zonder een
   server te starten -- scripts/onbewezen.js gebruikt dit om een route niet als
   instrumenttekort te tellen terwijl er een sleutel voor te maken is. */
function dektPad(pad) {
  return FAMILIES.some(f => f.prefixen.some(p => String(pad).startsWith(p)));
}

/* ============================================================================
   MAG EEN FAMILIE DE ROL VAN DE BEWAKERSKAART OVERSCHRIJVEN?

   Apart en puur, zodat het los te toetsen is -- dezelfde vorm als
   weegHerhaling() in ./idemproef.js, en om dezelfde reden: dit is een OORDEEL
   en geen plumbing.

   De eerste versie liet een familie altijd winnen, en de eerstvolgende meting
   liet zien waarom dat te grof is:

     169  member -> member-lifestyle   de bedoeling: de kaart zegt welke
                                       SESSIE nodig is, de familie welke PAS
                                       die sessie moet dragen
       3  werkplekbaas -> boardroom    gooit de SMALLERE rol weg. Een
                                       boardroom-gebruiker die niet de eigenaar
                                       is, hoort baasAuth niet te passeren; na
                                       deze ruil kan de rolproef dat niet meer
                                       zien
       2  openbaar -> member-zakelijk  roept een BEWUST OPENBARE route aan met
                                       een token. Geen vals groen, maar wel de
                                       verkeerde meting: hij bewijst niet meer
                                       dat de route zonder sleutel opengaat

   Twee grendels dus. Een route die met reden zonder sessie werkt (openbaar,
   omgeving, eigen-poort) wordt nooit opgewaardeerd -- dat is geen zwakkere rol
   maar een andere VRAAG. En een eigenrol uit de bewakerskaart (werkplekbaas,
   scim, kantoor-op-naam) blijft staan: die is smaller dan wat een familie op
   een heel voorvoegsel kan weten.

   Dezelfde regel als in scripts/lib/bewakers.js: de zwakste bewering mag de
   sterkste niet overschrijven. */
const NOOIT_OPWAARDEREN = new Set(['openbaar', 'omgeving', 'eigen-poort',
  'werkplekbaas', 'scim', 'kantoor-op-naam']);

function magOpwaarderen(huidigeRol, familieRol) {
  if (!familieRol || familieRol === huidigeRol) return { mag: false, reden: 'de familie vraagt dezelfde rol' };
  if (NOOIT_OPWAARDEREN.has(huidigeRol)) {
    return { mag: false, reden: '`' + huidigeRol + '` is geen zwakkere rol maar een andere vraag; ' +
      'een familie op een heel voorvoegsel weet niet beter dan de bewakerskaart' };
  }
  return { mag: true, reden: null };
}

module.exports = { FAMILIES, bouwLijfsleutels, dektPad, magOpwaarderen, NOOIT_OPWAARDEREN };
