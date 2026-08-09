/* DE RISICOMOTOR EN DE VERTROUWENSROUTE -- hoeveel controle hoort bij deze
   handeling, en mag de machine hem zelf doen?

   DIT IS DE ONTWERPREGEL VAN DE HELE LAAG, in code. Elke functie in RTG Command
   bestaat op drie niveaus:

     hand    een mens doet het zelf
     assist  de machine bereidt het voor, een mens drukt af
     auto    de machine doet het volledig, binnen beleid

   Welk niveau geldt, is GEEN eigenschap van de knop maar van de handeling plus
   zijn omstandigheden. Dezelfde handeling ("betaling opnieuw proberen") mag
   autonoom bij €12 en nooit autonoom bij €120.000. Daarom rekent deze motor
   het per geval uit en zet geen vaste labels in het scherm.

   WAAROM DE SCORE ZICHTBAAR IS. Een cijfer zonder opbouw is een orakel, en een
   orakel kun je niet tegenspreken. Elke score draagt daarom zijn opbouw: welke
   factor hoeveel punten gaf. Zo kan een mens zien WAAROM iets naar hem is
   gerouteerd, en zo is er iets om over te twisten als de routering niet klopt.

   DE GRENZEN KOMEN UIT HET BELEID, niet uit dit bestand. Wie ze verschuift doet
   dat in het beleidsregister, met vier ogen en een spoor. Stonden ze hier hard
   in de code, dan zou "beleid centraal beheren zonder overal code aan te
   passen" niet waar zijn. */
'use strict';

/* De grondrisico's per soort handeling. Dit is een tabel en geen berekening:
   het verschil tussen "een notitie zetten" en "een identiteit wijzigen" is een
   afspraak, geen formule. De namen zijn de acties die Command kent. */
const GRONDSLAG = {
  'lezen': 0,
  'notitie': 5,
  'zaak toewijzen': 10,
  'melding sluiten': 15,
  'herstel droog': 5,
  'herstel uitvoeren': 35,
  'betaling opnieuw': 40,
  'boeking herstellen': 35,
  'route wijzigen': 30,
  'voertuig uit dienst': 45,
  'klant compenseren': 55,
  'beleid zetten': 70,
  'massamutatie': 80,
  'identiteit wijzigen': 90,
  'toegang verlenen': 85,
  'noodtoegang': 95
};

/* Wat het risico verhoogt bovenop de grondslag. Elke factor apart benoemd,
   zodat de opbouw leesbaar blijft en een factor los aan te passen is. */
function factoren(ctx, beleid) {
  const uit = [];
  const centen = Number(ctx.centen || 0);
  if (centen > 0) {
    const grens = beleid.getal('risico.geldGrensCenten', 2500000);
    if (centen >= grens) uit.push({ naam: 'bedrag boven de geldgrens', punten: 25 });
    else if (centen >= grens / 5) uit.push({ naam: 'noemenswaardig bedrag', punten: 10 });
  }
  const aantal = Number(ctx.aantal || 1);
  if (aantal >= 100) uit.push({ naam: 'raakt ' + aantal + ' objecten', punten: 25 });
  else if (aantal >= 10) uit.push({ naam: 'raakt ' + aantal + ' objecten', punten: 12 });
  if (ctx.klantImpact) uit.push({ naam: 'de klant merkt dit', punten: 15 });
  if (ctx.onomkeerbaar) uit.push({ naam: 'niet terug te draaien', punten: 20 });
  if (ctx.persoonsgegevens) uit.push({ naam: 'raakt persoonsgegevens', punten: 20 });
  if (ctx.buitenKantoortijd) uit.push({ naam: 'buiten kantoortijd', punten: 5 });
  /* Vertrouwen verlaagt, maar nooit tot nul: een agent die zeker weet dat hij
     gelijk heeft is precies de agent die je in de gaten wilt houden. */
  const zeker = Number(ctx.zekerheid == null ? 1 : ctx.zekerheid);
  if (zeker < 0.5) uit.push({ naam: 'de machine twijfelt (' + Math.round(zeker * 100) + '%)', punten: 30 });
  else if (zeker < 0.85) uit.push({ naam: 'matige zekerheid (' + Math.round(zeker * 100) + '%)', punten: 12 });
  else uit.push({ naam: 'hoge zekerheid (' + Math.round(zeker * 100) + '%)', punten: -8 });
  return uit;
}

function maakRisico({ beleid }) {
  /* Beoordeel één handeling. Geeft score, niveau, of vier ogen nodig zijn, en
     de volledige opbouw. */
  function beoordeel(actie, ctx) {
    const naam = String(actie || 'lezen');
    const grond = GRONDSLAG[naam] == null ? 25 : GRONDSLAG[naam];
    const opbouw = [{ naam: 'grondslag: ' + naam, punten: grond }].concat(factoren(ctx || {}, beleid));
    const score = Math.max(0, Math.min(100, opbouw.reduce((n, f) => n + f.punten, 0)));
    const autoGrens = beleid.getal('risico.autoGrens', 30);
    const mensGrens = beleid.getal('risico.mensGrens', 70);
    const herstelAan = beleid.waarde('herstel.autoAan', true) !== false;

    let niveau, waarom;
    if (score >= mensGrens) { niveau = 'hand'; waarom = 'score ' + score + ' ligt op of boven de mensgrens ' + mensGrens; }
    else if (score <= autoGrens && herstelAan) { niveau = 'auto'; waarom = 'score ' + score + ' ligt op of onder de autogrens ' + autoGrens; }
    else if (score <= autoGrens && !herstelAan) { niveau = 'assist'; waarom = 'binnen de autogrens, maar automatisch herstel staat uit in het beleid'; }
    else { niveau = 'assist'; waarom = 'score ' + score + ' ligt tussen de grenzen ' + autoGrens + ' en ' + mensGrens; }

    const vierOgen = score >= mensGrens || naam === 'massamutatie' || naam === 'identiteit wijzigen' ||
      naam === 'toegang verlenen' || Number((ctx || {}).centen || 0) >= beleid.getal('risico.geldGrensCenten', 2500000);

    return { actie: naam, score, niveau, waarom, vierOgen, opbouw,
      grenzen: { auto: autoGrens, mens: mensGrens } };
  }

  /* VERTROUWENSROUTE over een stapel gevallen: wat mag de machine zelf doen, en
     wat gaat naar een mens? Dit is de functie achter "doe de veilige 39 en geef
     mij de twee uitzonderingen". */
  function routeer(gevallen, actie, basisCtx) {
    const veilig = [], mens = [], hulp = [];
    for (const g of gevallen || []) {
      const ctx = Object.assign({}, basisCtx || {}, g.ctx || {}, { aantal: 1 });
      const o = beoordeel(actie, ctx);
      const rij = { geval: g, oordeel: o };
      if (o.niveau === 'auto' && !o.vierOgen) veilig.push(rij);
      else if (o.niveau === 'assist') hulp.push(rij);
      else mens.push(rij);
    }
    /* De hele stapel telt óók als één handeling: vijftig veilige gevallen
       samen zijn een massamutatie, ook als elk geval apart onschuldig is. Dat
       is precies de fout die "elk geval is klein" verbergt. */
    const stapel = beoordeel(actie, Object.assign({}, basisCtx || {}, { aantal: veilig.length }));
    const maxRonde = beleid.getal('herstel.maxPerRonde', 50);
    const teveel = veilig.length > maxRonde;
    return {
      veilig: teveel ? veilig.slice(0, maxRonde) : veilig,
      overgeslagen: teveel ? veilig.length - maxRonde : 0,
      hulp, mens, stapeloordeel: stapel, maxPerRonde: maxRonde
    };
  }

  return { beoordeel, routeer, GRONDSLAG };
}

module.exports = { maakRisico, GRONDSLAG };
