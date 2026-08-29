/* DE SLEUTELBOS VAN DE PROEVEN -- welke rollen kan een instrument aannemen?

   WAAROM DIT BESTAAN. Deze tabel stond in ZES instrumenten, woordelijk gelijk:
   auditproef, idemproef, invoerproef, staatproef, uitvoerproef en waarom.js,
   plus inhoudskaart.js met een eigen aanroepvorm. Elk van die zes kende drie
   rollen -- member, office, supplier -- en daarmee was alles achter een vierde
   deur onbereikbaar voor alle zes tegelijk.

   Dat is precies wat er gebeurde: 156 schrijfroutes achter boardroomAuth en
   techAuth kwamen in elk uitslagbestand terecht als "geen token voor deze rol".
   Zes kopieen van dezelfde beperking, dus zes keer dezelfde blinde vlek, en een
   reparatie op een van de zes zou de andere vijf stil uit de pas laten lopen
   (LAT.md regel 4).

   ------------------------------------------------------------------------
   DE VIJF ROLLEN, EN WAAR ZE VANDAAN KOMEN

     member     een gewoon lid via de demo-inlog
     office     de backoffice op de gedeelde code
     supplier   een partner via de demo-zaak
     boardroom  de kamer van de eigenaar
     techniek   het techniekbord

   DE LAATSTE TWEE ZIJN HETZELFDE TOKEN, en dat is geen bezuiniging maar hoe dit
   huis werkt. `boardroomAuth` laat de eigenaar met zijn eigen accountlogin door
   (kern/kantoor/index.js) en `techAuth` verifieert datzelfde accounttoken
   (routes/techniek.js). Ze staan hier toch als twee namen, want de
   bewakerskaart kent ze als twee rollen en een proef die "boardroom" vraagt
   hoort niet te hoeven weten dat het onder water de eigenaar is.

   ------------------------------------------------------------------------
   WAT ER EERST MOEST GEBEUREN

   Een sleutel uitdelen voor deuren waarachter de schakelkast van het platform
   zit, is gevaarlijk: een proef die willekeurige lijven naar /api/techniek/
   functie stuurt, zet functies uit en meet daarna een half afgebroken platform.
   De verbodslijst in ./routes.js (NIET_AANRAKEN) noemde alleen de
   boardroom-deur naar die kast en niet de techniek-deur. Die lijst is daarom
   EERST afgemaakt, met een reden per pad; pas daarna is deze sleutelbos er
   gekomen. Wie hier een rol bijzet, loopt die lijst opnieuw na.

   GEEN SLEUTEL IS EEN UITKOMST EN GEEN STORING. Krijgt een instrument een rol
   niet aan de praat (geen demo-eigenaar in deze database bijvoorbeeld), dan
   staat die rol niet in de bos en vallen zijn routes gewoon terug op "geen
   token voor deze rol" -- met de reden erbij. Doen alsof is het enige dat niet
   mag: een route zonder sleutel aanroepen geeft 401, en dat als "beproefd"
   tellen is een meting zonder invoer die toch een cijfer geeft (LAT.md regel 3). */
'use strict';

/* De eigenaar van de demo-seed. Uit server/eigenaar.js, want een tweede plek
   met dat adres loopt uiteen zodra iemand RTG_OWNER_EMAIL zet. */
const OWNER_EMAIL = (process.env.RTG_OWNER_EMAIL || 'roellie.i@gmail.com').trim().toLowerCase();
const OWNER_WACHTWOORD = process.env.RTG_OWNER_WACHTWOORD || 'Imran';

/* De volgorde waarin ze worden opgehaald. member/office/supplier eerst, want de
   meeste proeven hebben aan die drie genoeg en een falende eigenaarslogin mag
   ze niet ophouden. */
const ROLLEN = ['member', 'office', 'supplier', 'boardroom', 'techniek', 'kantoor-op-naam'];

/* `post` is de POST-functie van het instrument zelf (elk heeft er al een, met
   zijn eigen basis-URL en foutafhandeling); `officeCode` de backoffice-code van
   de wegwerpserver. `eigen` overschrijft een inlog -- de uitvoerproef logt in
   als een AANVALLER en niet als een gewoon lid, en dat hoort zo te blijven. */
function maakSleutels({ post, officeCode, eigen }) {
  /* LUI EN GEMEMOISEERD.

     Hij wordt pas gehaald als een rol erom vraagt, en dat is na de drie
     onmisbare rollen (ROLLEN staat in die volgorde). Reden: in een database
     zonder demo-eigenaar MISLUKT deze login, en een mislukte inlogpoging is
     geen goede eerste handeling van een meetronde -- er komt een regel in het
     beveiligingslogboek van de server die de proef daarna zelf leest.

     WAT HIER EERST STOND EN NIET KLOPTE. De eerste versie schreef dat de eager
     login "de inlogrem per IP liet aanslaan en daardoor member en supplier
     blokkeerde". Dat was een gok bij een waarneming, geen bevinding: de
     werkelijke oorzaak was dat RTG_DEMO=1 op zichzelf niets meer doet (zie
     lib/wegwerpserver.js), waardoor ALLE demo-inlogs dicht stonden. Een
     mutatieproef op de luiheid liet dat zien -- hij zakte niet. De volgorde
     blijft zoals hij is, maar met de reden die wel klopt. */
  let eigenaarToken = null;
  const haalEigenaar = async () => {
    if (eigenaarToken !== null) return eigenaarToken || null;
    try {
      const r = await post('/api/auth/login', { login: OWNER_EMAIL, password: OWNER_WACHTWOORD, pasApp: 'business' });
      eigenaarToken = (r && r.data && r.data.token) || false;
    } catch (e) { eigenaarToken = false; }
    return eigenaarToken || null;
  };

  const inlog = Object.assign({
    member: async () => (await post('/api/login', { tier: 'rtg' })).data.token,
    office: async () => (await post('/api/office/login', { code: officeCode })).data.token,
    supplier: async () => (await post('/api/supplier/login', { username: 'rahul', password: 'Imran' })).data.token,
    /* Beide via de eigenaar; zie de kop waarom dat twee namen blijven. */
    boardroom: haalEigenaar,
    techniek: haalEigenaar,
    /* De kluispoort vraagt een kantoorsessie OP NAAM. In de proefopstelling is
       de eigenaar het enige lid dat er een heeft; in productie zijn dat er meer.
       Vandaar dezelfde bron en toch een eigen naam: de bewakerskaart kent hem
       als eigen rol, en een proef die 'kantoor-op-naam' vraagt hoort niet te
       hoeven weten wie dat vandaag is. */
    'kantoor-op-naam': haalEigenaar
  }, eigen || {});

  return { inlog, ROLLEN, OWNER_EMAIL };
}

/* Haalt alle rollen op. Geeft terug WAT er gelukt is en wat niet, met de reden --
   het instrument beslist zelf of een ontbrekende rol fataal is. Voor member,
   office en supplier is dat zo (zonder die drie meet een proef bijna niets);
   voor boardroom en techniek niet, want een database zonder demo-eigenaar is
   een geldige database. */
async function haalSleutels(bos) {
  const tokens = {};
  const mislukt = [];
  for (const rol of bos.ROLLEN) {
    if (!bos.inlog[rol]) continue;
    try {
      const t = await bos.inlog[rol]();
      if (t) tokens[rol] = t;
      else mislukt.push({ rol, reden: 'de inlog gaf geen token terug' });
    } catch (e) { mislukt.push({ rol, reden: String(e && e.message || e).slice(0, 120) }); }
  }
  return { tokens, mislukt, gelukt: Object.keys(tokens) };
}

/* De drie zonder welke een proef niets meet. Boardroom en techniek staan er
   bewust NIET bij: die zijn welkom als ze er zijn en geen reden om te stoppen. */
const ONMISBAAR = ['member', 'office', 'supplier'];

module.exports = { maakSleutels, haalSleutels, ROLLEN, ONMISBAAR, OWNER_EMAIL };
