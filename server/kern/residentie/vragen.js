/* De Residence, deelbestand "vragen": de vragenmotor van het huis. Geen
   vaste lijst maar een generator: sjablonen x onderwerpen x staarten leveren
   ruim tienduizend verschillende vragen in zes genres -- soms superluchtig,
   soms een lach, soms intiem, soms een traan, soms ongemakkelijk eerlijk en
   soms zakelijk en door en door. totaal() telt de combinaties; de test
   bewaakt de ondergrens van 10.000. */

const toeval = require('../../lib/toeval');   // keuzes op toeval: herhaalbaar met RTG_ZAAD
const G = {
  luchtig: {
    twee: ['Wat kiest u voor altijd: {A} of {B}?',
      'Wat schrapt u uit uw leven als het moet: {A} of {B}?',
      'Waar wordt u blijer van: {A} of {B}?',
      'Wat past beter bij u: {A} of {B}?',
      'Wat gunt u de ander meer: {A} of {B}?'],
    een: ['Wat is uw guilty pleasure als het om {X} gaat?',
      'Wat is het meest overschatte aan {X}?',
      'Verras me: wat weet bijna niemand over u en {X}?'],
    sub: ['koffie', 'thee', 'de bergen', 'de zee', 'ontbijt op bed', 'een lange lunch',
      'de winter', 'de zomer', 'dansen', 'zelf koken', 'oude films', 'nieuwe muziek',
      'vroeg opstaan', 'uitslapen', 'de nachttrein', 'een oldtimer', 'een dik boek',
      'een groot feest', 'kamperen', 'een vijfsterrenhotel', 'zoet', 'hartig',
      'de stad', 'het platteland']
  },
  lach: {
    twee: ['Wat is genanter om op betrapt te worden: {A} of {B}?',
      'Wat verzwijgt u liever op een eerste date: {A} of {B}?'],
    een: ['Wat is het gekste dat u ooit heeft gedaan voor {X}?',
      'Welk verhaal over uzelf en {X} vertelt u altijd op feestjes?',
      'Wanneer ging het bij u volledig mis met {X}?',
      'Welke blunder rond {X} kunt u inmiddels weglachen?',
      'Hoe klinkt de imitatie van uzelf tijdens {X}?',
      'Wat is uw slechtste eigenschap zodra het om {X} gaat?',
      'Welk kinderlijk plezier heeft u nog steeds bij {X}?'],
    sub: ['karaoke', 'een blind date', 'dansen op een bruiloft', 'zelf klussen',
      'een speech geven', 'flirten', 'sporten', 'een selfie maken', 'parkeren',
      'online daten', 'koken voor gasten', 'een ruzie om niets', 'verdwalen',
      'een verjaardagslied', 'te laat komen', 'onderhandelen op een markt',
      'een straf verhaal aan de douane', 'te veel bestellen', 'valsspelen bij een spel',
      'per ongeluk beroemd doen']
  },
  intiem: {
    twee: ['Wat komt bij u dieper binnen: {A} of {B}?'],
    een: ['Wanneer voelde u zich voor het laatst echt gezien, en wat deed {X} daarmee?',
      'Wat betekent {X} voor u, echt?',
      'Welke herinnering aan {X} draagt u overal mee naartoe?',
      'Wat durft u zelden hardop te zeggen over {X}?',
      'Hoe laat u iemand merken dat u om diegene geeft, als het om {X} gaat?',
      'Wat heeft {X} u geleerd over uzelf?',
      'Waar verlangt u naar als u denkt aan {X}?',
      'Wat zou u morgen veranderen aan uw omgang met {X}?'],
    sub: ['uw eerste liefde', 'thuiskomen', 'echte aandacht', 'aanraking', 'stilte samen',
      'een lange omhelzing', 'oogcontact', 'uw ouders', 'oud worden', 'samen wakker worden',
      'vertrouwen geven', 'gemist worden', 'iemand missen', 'een handgeschreven brief',
      'samen dansen', 'vergeven worden', 'gezien worden zonder woorden', 'de ware vinden']
  },
  traan: {
    twee: [],
    een: ['Wat heeft {X} u gekost, en was het dat waard?',
      'Wanneer heeft u voor het laatst gehuild om {X}?',
      'Wat had u willen zeggen over {X}, toen het nog kon?',
      'Welk afscheid rond {X} draagt u nog met u mee?',
      'Wat zou de jongere u niet geloven over {X}?',
      'Waar heeft u vrede mee gesloten als het om {X} gaat, en waarmee nog niet?',
      'Wie mist u het meest als u denkt aan {X}?',
      'Wat was het moeilijkste jaar van uw leven, en welke rol speelde {X} daarin?'],
    sub: ['een gebroken hart', 'uw jeugd', 'een verloren vriendschap', 'een afscheid',
      'een gemiste kans', 'uw grootouders', 'een oud huis', 'een belofte',
      'iemand die er niet meer is', 'een droom die niet doorging', 'vergeven',
      'te laat zijn', 'een brief die nooit verstuurd is', 'loslaten', 'opnieuw beginnen',
      'een lied dat pijn doet']
  },
  ongemakkelijk: {
    twee: ['Wat is erger om toe te geven: {A} of {B}?',
      'Waar liegt u makkelijker over: {A} of {B}?'],
    een: ['Wat is de echte reden dat het misging met {X}?',
      'Wat zou uw ex zeggen over u en {X}?',
      'Waar schaamt u zich stiekem voor als het om {X} gaat?',
      'Welke rode vlag negeert u telkens weer bij {X}?',
      'Wat is uw dubbele standaard rond {X}?',
      'Welk oordeel heeft u over anderen bij {X}, terwijl u het zelf ook doet?',
      'Wat verzwijgt u op een eerste date over {X}?',
      'Wanneer was u zelf de afknapper in het verhaal van {X}?'],
    sub: ['uw laatste relatie', 'jaloezie', 'geld in de liefde', 'appjes terugsturen',
      'exen volgen', 'te snel verliefd worden', 'bindingsangst', 'kritiek krijgen',
      'sorry zeggen', 'uw humeur', 'aandacht nodig hebben', 'vreemde bedgewoontes',
      'uw telefoon aan tafel', 'te veel drinken', 'roddelen', 'complimenten aannemen',
      'de rekening splitsen', 'uw ouders over de vloer']
  },
  zakelijk: {
    twee: ['Wat brengt u verder: {A} of {B}?',
      'Waar investeert u eerder in: {A} of {B}?',
      'Wat zegt meer over iemand: {A} of {B}?'],
    een: ['Wat is uw visie op {X}, in twee zinnen?',
      'Welke fout rond {X} maakt u nooit meer?',
      'Wat was uw beste beslissing rond {X}, en wat leverde die op?',
      'Hoe onderhandelt u over {X} zonder de relatie te schaden?',
      'Wie heeft u het meest geleerd over {X}, en wat precies?',
      'Waar zegt u nee tegen als het om {X} gaat?',
      'Wat is uw plan voor {X} de komende vijf jaar?',
      'Welke gewoonte rond {X} heeft u bewust afgeleerd?'],
    sub: ['geld', 'tijd', 'ambitie', 'leiderschap', 'onderhandelen', 'risico nemen',
      'falen', 'netwerken', 'een eigen zaak', 'werk en prive', 'reputatie',
      'samenwerken', 'lef', 'geduld', 'een tweede kans', 'de lange termijn',
      'afspraken nakomen', 'uw eerste baan', 'een mentor', 'stoppen op tijd',
      'de juiste mensen', 'te vroeg tevreden zijn']
  }
};

const STAARTEN = ['', ' En waarom?', ' Vertel het eens echt.', ' Neem er de tijd voor.'];
const GENRES = Object.keys(G);
const kies = a => toeval.kies(a);

function genereer(genre) {
  const g = G[genre] || G[kies(GENRES)];
  genre = G[genre] ? genre : GENRES.find(n => G[n] === g);
  const tweeKans = g.twee.length && toeval.kans() < g.twee.length / (g.twee.length + g.een.length);
  let tekst;
  if (tweeKans) {
    const a = kies(g.sub); let b = kies(g.sub);
    while (b === a) b = kies(g.sub);
    tekst = kies(g.twee).replace('{A}', a).replace('{B}', b);
  } else {
    tekst = kies(g.een).replace('{X}', kies(g.sub));
  }
  return { tekst: tekst + kies(STAARTEN), genre };
}

/* het aantal verschillende vragen dat de motor kan stellen */
function totaal() {
  let n = 0;
  for (const g of Object.values(G)) {
    const s = g.sub.length;
    n += (g.twee.length * s * (s - 1) + g.een.length * s) * STAARTEN.length;
  }
  return n;
}

module.exports = { genereer, totaal, GENRES };
