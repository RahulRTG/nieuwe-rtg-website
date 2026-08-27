/* OORMERKEN: geld dat de houder ZELF opzij zet, en dat blijft staan.

   ./reserve.js kent al een manier om geld vast te zetten, en dit is er bewust
   een tweede -- niet omdat dat handig uitkwam, maar omdat het om twee
   verschillende dingen gaat en ze samenvoegen precies de fout is die je later
   niet meer uit elkaar krijgt:

     reservering  IEMAND ANDERS houdt uw geld vast voor een handeling die nog
                  loopt: een hotel dat een borg vraagt, een taxi die de ritprijs
                  nog niet kent. Die VERVALT, en dat moet ook -- een borg die
                  blijft hangen omdat een partner niets terugmeldde, zet het geld
                  van iemand vast zonder dat iemand kan uitleggen waarom.

     oormerk      U ZELF zet uw eigen geld apart: de btw die u straks moet
                  afdragen, de loonrun van volgende week, een buffer die u niet
                  wilt aanraken. Dat VERVALT NIET, en dat moet ook niet -- een
                  btw-reservering die na een dag vanzelf vrijvalt, is geen
                  reservering maar een dagdroom.

   Zou een oormerk een reservering met een lange looptijd zijn, dan is de vraag
   "waarom staat dit geld vast" niet meer te beantwoorden zonder te weten wie
   hem zette. En dan komt er ooit iemand die de vervaltijd van een borg oprekt
   om een buffer te maken, of een buffer laat verlopen omdat de opruimregel niet
   weet dat het er een was.

   ER BEWEEGT HIER GEEN GELD. Net als de potten in kern/geldbeleid/potten.js is
   dit een voornemen en geen rekening: het grootboek sluit op nul zonder dat deze
   module bestaat. Wat een oormerk doet is één ding -- het telt niet mee als
   beschikbaar. Dat is genoeg, want beschikbaar is het getal waar elke
   bestedings- en uitbetaalvraag tegenaan gaat.

   DE ENIGE HARDE GRENS: een oormerk gaat nooit onder nul en de som ervan mag het
   saldo niet overschrijden. Meer apart zetten dan er staat is een
   boekhoudleugen, en hij zou zich uiten als een rekening die niets meer kan
   betalen zonder dat er iets mis is. */
'use strict';

/* De tijd komt uit de huisklok (server/lib/klok.js) en niet uit het
   besturingssysteem: een vervaldatum of wachttijd die zich van RTG_KLOK niets
   aantrekt, is niet te beproeven. Wie zelf een klok meegeeft, houdt die. */
const { nu: klokNu } = require('../../lib/klok');

const MAX_PER_REKENING = 20;   // meer dan twintig potjes op een rekening is ruis
const MAX_NAAM = 60;

function maakOormerk({ db, save, crypto, nu = klokNu }) {
  const eigen = require('../eigencollectie')({ db, domein: 'kern/waarde/oormerk', bezit: { waardeOormerken: 'kaart' } });
  function bak() {
    return eigen.bak('waardeOormerken');
  }
  function lijst(rek) {
    const b = bak();
    if (!Array.isArray(b[rek])) b[rek] = [];
    return b[rek];
  }
  const zicht = o => ({ id: o.id, naam: o.naam, centen: o.centen, doel: o.doel || null, sinds: o.sinds });

  function oormerken(rek) { const b = bak(); return Array.isArray(b[rek]) ? b[rek].map(zicht) : []; }
  function apart(rek) { const b = bak(); return Array.isArray(b[rek]) ? b[rek].reduce((s, o) => s + o.centen, 0) : 0; }

  /* Bijzetten of afhalen. `centen` is een VERSCHIL en geen nieuwe stand: de
     treasury-regels tellen er per ontvangst een stukje bij, en een absolute
     stand zou dan bij twee gelijktijdige ontvangsten de ene overschrijven met
     de andere. `saldo` komt van de aanroeper (RTG Pay houdt de saldi bij) zodat
     de bovengrens hier te toetsen is zonder dat deze laag saldi gaat bijhouden. */
  function oormerkZet({ rek, naam, centen, doel, saldo }) {
    if (!rek) return { status: 400, error: 'Op welke rekening?' };
    const nm = String(naam || '').trim().slice(0, MAX_NAAM);
    if (!nm) return { status: 400, error: 'Geef het oormerk een naam.' };
    const bij = Math.round(Number(centen));
    if (!Number.isFinite(bij)) return { status: 400, error: 'Dat bedrag kan niet.' };
    const l = lijst(rek);
    let o = l.find(x => x.naam === nm);
    if (!o) {
      if (bij <= 0) return { status: 400, error: 'Een nieuw oormerk vraagt een bedrag boven nul.' };
      if (l.length >= MAX_PER_REKENING) return { status: 400, error: 'Meer dan ' + MAX_PER_REKENING + ' oormerken op een rekening; ruim eerst op.' };
      o = { id: 'OM' + crypto.randomBytes(4).toString('hex').toUpperCase(), naam: nm, centen: 0,
        doel: doel ? String(doel).slice(0, 40) : null, sinds: nu() };
      l.unshift(o);
    }
    const nieuw = o.centen + bij;
    if (nieuw < 0) return { status: 409, error: 'Er staat maar ' + (o.centen / 100).toFixed(2) + ' euro onder dit oormerk.', apart: o.centen };
    if (Number.isFinite(saldo)) {
      const totaalNa = apart(rek) - o.centen + nieuw;
      if (totaalNa > Math.round(saldo)) return { status: 409,
        error: 'Er is niet genoeg saldo om dit apart te zetten.', apart: apart(rek), saldo: Math.round(saldo) };
    }
    o.centen = nieuw;
    if (o.centen === 0) l.splice(l.indexOf(o), 1);   // een leeg oormerk is geen oormerk
    save();
    return { ok: true, oormerk: o.centen ? zicht(o) : null, apart: apart(rek) };
  }

  /* Vrijgeven is de handeling waar het geld weer beschikbaar van wordt -- de
     btw is afgedragen, de loonrun is gedraaid. Met opzet een eigen functie en
     geen oormerkZet met een negatief bedrag: "vrijgeven" is wat de houder doet
     en wat er in een overzicht hoort te staan, en dat woord raak je kwijt als
     het een min-teken wordt. */
  function oormerkVrij({ rek, id }) {
    const l = lijst(rek);
    const i = l.findIndex(x => x.id === String(id || ''));
    if (i < 0) return { status: 404, error: 'Dit oormerk kennen we niet.' };
    const weg = l[i].centen;
    l.splice(i, 1);
    save();
    return { ok: true, vrijgegeven: weg, apart: apart(rek) };
  }

  return { oormerken, apart, oormerkZet, oormerkVrij, MAX_PER_REKENING };
}

module.exports = { maakOormerk, MAX_PER_REKENING };
