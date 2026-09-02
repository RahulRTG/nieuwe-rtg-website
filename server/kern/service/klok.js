/* ============================================================================
   DE VIER KLOKKEN VAN EEN SERVICEZAAK.

   WAAROM VIER EN NIET EEN. "Ticket binnen 24 uur beantwoord" is de bekendste
   nep-SLA die er is: hij wordt gehaald door binnen 24 uur "wij kijken ernaar"
   te sturen, en zegt dus niets over of iemand geholpen is. Vier klokken zijn
   niet vier keer zoveel administratie -- ze zijn het verschil tussen meten en
   doen alsof.

     eersteReactie    hoe lang tot RTG inhoudelijk iets terugzei
     menselijkeReactie hoe lang tot een MENS reageerde, gerekend vanaf het
                      moment dat erom werd gevraagd (en niet vanaf het begin)
     hersteltijd      hoe lang tot het probleem echt weg was
     wachtOpMelder    hoe lang de bal bij de melder lag

   DE VIERDE IS DE BELANGRIJKSTE. Zonder hem meet je de melder: een zaak waarin
   RTG binnen twee minuten een vraag stelt en de melder pas de volgende ochtend
   antwoordt, ziet er dan uit als een zaak van veertien uur. Daarom trekt deze
   module de wachttijd AF van de andere drie, en zegt erbij hoeveel dat was.

   DE KLOK LEEST DE TIJDLIJN EN HOUDT ZELF NIETS BIJ. Dat is met opzet: een
   teller die naast de gebeurtenissen meeloopt, gaat er een keer van afwijken,
   en dan is niet te zeggen welke van de twee de waarheid is. Alles hieronder is
   afgeleid uit ./zaak.js en op elk moment opnieuw uit te rekenen. Dezelfde
   redenering als het verlopen van een bijstandssessie (kern/command/bijstand.js:
   een berekende toestand, geen opruimactie).

   EN ER STAAT NOOIT EEN GETAL WAAR ER GEEN IS. Een zaak zonder eerste reactie
   krijgt geen nul en geen streepje, maar `{ nietGemeten: true, waarom: ... }`.
   Een nul die "nog niet gebeurd" betekent, komt in een gemiddelde terecht en
   maakt dat gemiddelde beter naarmate RTG slechter werkt.
   ========================================================================== */
'use strict';

const klok = require('../../lib/klok');
const { STANDEN } = require('./klassen');

const ms = (a, b) => Math.max(0, Date.parse(b) - Date.parse(a));
const minuten = (v) => Math.round(v / 60000);

/* De perioden waarin de bal bij de melder lag. Uit de standwisselingen in de
   tijdlijn: een stand met `klokLoopt: false` die NIET het einde is, is wachten
   op de melder. Loopt de zaak nog en staat hij nu te wachten, dan telt de
   periode door tot nu -- anders zou een zaak die al drie dagen op antwoord
   wacht, dat pas laten zien als er iets gebeurt. */
function wachtperioden(zaak, tot) {
  const uit = [];
  let open = null;
  for (const r of zaak.tijdlijn) {
    if (r.wat !== 'stand') continue;
    const s = STANDEN[r.naar];
    if (!s) continue;
    if (!s.klokLoopt && !s.eind) { if (!open) open = r.at; }
    else if (open) { uit.push([open, r.at]); open = null; }
  }
  if (open) uit.push([open, tot]);
  return uit;
}

/* Hoeveel van een periode viel binnen wachten-op-melder. Nodig omdat de
   aftrek per klok verschilt: een klok die pas halverwege begint (de menselijke
   reactie) mag alleen het wachten binnen ZIJN venster aftrekken. */
function wachtBinnen(perioden, van, tot) {
  let t = 0;
  for (const [a, b] of perioden) {
    const start = Math.max(Date.parse(a), Date.parse(van));
    const eind = Math.min(Date.parse(b), Date.parse(tot));
    if (eind > start) t += eind - start;
  }
  return t;
}

const geen = (waarom) => ({ nietGemeten: true, waarom });

/* Vindt de eerste regel die aan een voorwaarde voldoet; geeft null in plaats
   van undefined, zodat een aanroeper er niet per ongeluk `.at` op leest. */
const eerste = (zaak, fn) => zaak.tijdlijn.find(fn) || null;

function klokken(zaak) {
  const nu = klok.datum().toISOString();
  const eind = zaak.tijdlijn.filter(r => r.wat === 'stand' && STANDEN[r.naar] && STANDEN[r.naar].eind).slice(-1)[0] || null;
  const tot = eind ? eind.at : nu;
  const perioden = wachtperioden(zaak, tot);

  /* 1. EERSTE REACTIE. Inhoudelijk, dus een bericht van RTG -- een
     statuswijziging telt niet. Dat iemand de zaak in behandeling zet zonder
     iets te zeggen, is voor de melder niet te onderscheiden van stilte. */
  const r1 = eerste(zaak, r => r.wat === 'bericht' && r.van !== 'melder');
  const eersteReactie = !r1
    ? geen('RTG heeft nog niets teruggezegd.')
    : { minuten: minuten(ms(zaak.at, r1.at) - wachtBinnen(perioden, zaak.at, r1.at)), door: r1.van, at: r1.at };

  /* 2. MENSELIJKE REACTIE. Vanaf het VERZOEK en niet vanaf het begin -- wie
     tien minuten met Rahul praat en dan om een mens vraagt, heeft niet tien
     minuten op een mens gewacht. Is er niet om gevraagd, dan is deze klok niet
     "0" maar niet van toepassing. */
  const vraag = eerste(zaak, r => r.wat === 'mensGevraagd');
  const mens = vraag ? eerste(zaak, r => r.wat === 'bericht' && r.van === 'mens' && r.at >= vraag.at) : null;
  const menselijkeReactie = !vraag
    ? geen('Er is in deze zaak niet om een mens gevraagd.')
    : (!mens
      ? geen('Er is om een mens gevraagd; die heeft nog niet gereageerd.')
      : { minuten: minuten(ms(vraag.at, mens.at) - wachtBinnen(perioden, vraag.at, mens.at)), at: mens.at });

  /* 3. HERSTELTIJD. Tot het probleem weg was, niet tot het gesprek stopte.
     Alleen `opgelost` telt: `gesloten` is ook een einde, maar bijvoorbeeld na
     intrekken -- en dan is er niets hersteld om te meten. */
  const op = zaak.tijdlijn.filter(r => r.wat === 'stand' && r.naar === 'opgelost').slice(-1)[0] || null;
  const hersteltijd = !op
    ? geen(eind ? 'Deze zaak is gesloten zonder oplossing; er is geen hersteltijd.' : 'Deze zaak loopt nog.')
    : { minuten: minuten(ms(zaak.at, op.at) - wachtBinnen(perioden, zaak.at, op.at)), at: op.at };

  /* 4. WACHT OP MELDER. Geen nietGemeten-tak: nul is hier een echt antwoord
     ("er is nooit op de melder gewacht") en geen ontbrekende meting. */
  const gewacht = wachtBinnen(perioden, zaak.at, tot);

  return {
    eersteReactie, menselijkeReactie, hersteltijd,
    wachtOpMelder: { minuten: minuten(gewacht), perioden: perioden.length },
    /* De doorlooptijd staat er RUW naast: hoeveel tijd er echt voorbijging.
       Zonder dat getal kan een zaak met veel wachttijd er goed uitzien terwijl
       de melder drie dagen bezig was, en dat is precies wat we niet willen
       verbergen door de aftrek. */
    doorlooptijd: { minuten: minuten(ms(zaak.at, tot)), afgerond: !!eind }
  };
}

module.exports = { klokken, wachtperioden, minuten };
