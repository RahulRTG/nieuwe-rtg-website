/* Geldgraaf, deelbestand "uitzonderingen": wat de graaf uit zijn eigen
   feiten kan zien, en de vormvaste doorlaat voor wat de beleidslaag vindt.

   Apart van index.js langs de natuurlijke naad: index.js zet de delen aan
   elkaar, dit bestand maakt de teksten en de contractvorm van een
   uitzondering. De twee eigen soorten ('post-duurder' en
   'toezegging-verlopen') komen uit de opdracht (GELD.md fase 1) en doen
   allebei niets -- ze wijzen; elke handeling blijft bij het lid of bij een
   regel die het lid zelf heeft gezet.

   De gegevens-regels volgen de conventie van kern/geldbeleid: rauwe centen
   met de eenheid erbij, want dit is het controlespoor achter de Waarom-knop
   en daar hoort het getal te staan waarmee gerekend is. De lopende zinnen
   (uitleg, verwachting) zijn gewone taal en mogen euro's zeggen; die
   omzetting woont op een plek (hulp.js, euroTekst). */
'use strict';

const { NIVEAUS } = require('../geldbeleid/regels');

const { vandaag, euroTekst, slug, LINK } = require('./hulp');

/* Actie eerst: wat klaarstaat boven wat een voorstel is, boven wat alleen
   kijken vraagt. Het command center toont van boven naar beneden en het lid
   hoort het dringendste bovenaan te zien. */
const RANG = { [NIVEAUS.klaarzetten]: 0, [NIVEAUS.voorstellen]: 1, [NIVEAUS.kijken]: 2 };

/* Wat er ook uit de beleidslaag komt, het verlaat de graaf alleen in de
   contractvorm: de UI bouwt hier blind op, dus een half veld uit een
   regelmodule mag nooit rauw doorlekken. */
function netteUitzondering(u, i) {
  const actie = u && u.actie && u.actie.label
    ? { label: String(u.actie.label).slice(0, 60), link: String(u.actie.link || LINK('overzicht')) }
    : null;
  return {
    id: String((u && u.id) || 'beleid:' + slug(String((u && u.soort) || 'regel') + '-' + String((u && u.titel) || i))),
    soort: String((u && u.soort) || 'beleid'),
    titel: String((u && u.titel) || '').slice(0, 120),
    centen: u && Number.isFinite(u.centen) ? Math.round(u.centen) : null,
    uitleg: String((u && u.uitleg) || ''),
    gegevens: Array.isArray(u && u.gegevens) ? u.gegevens.map(String) : [],
    niveau: u && RANG[u.niveau] !== undefined ? u.niveau : NIVEAUS.kijken,
    actie
  };
}

function eigenUitzonderingen(patronen, feiten) {
  const uit = [];
  const nu = vandaag();
  for (const p of patronen) {
    if (!p.duurder) continue;
    const pct = p.vorigeCenten > 0 ? Math.round(((p.centen - p.vorigeCenten) / p.vorigeCenten) * 100) : 0;
    uit.push({
      id: 'post-duurder:' + slug(p.titel),
      soort: 'post-duurder',
      titel: p.titel + ' is duurder geworden',
      centen: p.centen - p.vorigeCenten,
      uitleg: 'Deze vaste post was ' + euroTekst(p.vorigeCenten) + ' en is nu ' + euroTekst(p.centen) +
        (pct ? ' (' + pct + '% hoger)' : '') + '. De vooruitblik rekent vanaf nu met het nieuwe bedrag.',
      gegevens: [
        'wallet: ' + p.aantal + ' betalingen "' + p.titel + '" met een tussenpoos van ~' + p.interval + ' dagen',
        'wallet: vorige ' + p.vorigeCenten + ' centen, jongste ' + p.centen + ' centen'
      ],
      niveau: NIVEAUS.kijken,
      actie: { label: 'Bekijk in Wallet', link: LINK('wallet') }
    });
  }
  for (const f of feiten) {
    if (f.soort !== 'toezegging' || !f.wanneer || f.wanneer >= nu) continue;
    uit.push({
      id: 'toezegging-verlopen:' + slug(f.titel + '-' + f.wanneer),
      soort: 'toezegging-verlopen',
      titel: 'Toezegging "' + f.titel + '" is over de datum',
      centen: f.centen,
      uitleg: 'De afgesproken datum (' + f.wanneer + ') is voorbij en deze gift staat nog als open toezegging in het Mecenaat. Afronden of verzetten kan daar; de graaf telt het bedrag intussen als komende last mee.',
      gegevens: ['mecenaat: toezegging "' + f.titel + '", ' + (f.centen || 0) + ' centen, datum ' + f.wanneer],
      niveau: NIVEAUS.voorstellen,
      actie: { label: 'Open Mecenaat', link: LINK('mecenaat') }
    });
  }
  return uit;
}

/* De verwachtingszin: gewone taal over de komende dertig dagen, en overal
   "naar verwachting" -- de graaf voorspelt, hij bevestigt niets (huisregel:
   nooit beweren dat een betaling of boeking daadwerkelijk verwerkt is). */
function verwachtingZin(stil, vb) {
  if (stil.includes('wallet')) {
    return 'De wallet is op dit moment niet leesbaar; over de komende 30 dagen valt daarom niets verstandigs te zeggen.';
  }
  const h = vb.d30;
  if (!h.inCenten && !h.uitCenten) {
    return 'Voor de komende 30 dagen ziet de graaf geen vaste lasten, gedateerde toezeggingen of verwacht loon; het saldo blijft naar verwachting rond ' + euroTekst(h.saldoCenten) + '.';
  }
  return 'De komende 30 dagen komt er naar verwachting ' + euroTekst(h.inCenten) +
    ' binnen en gaat er ' + euroTekst(h.uitCenten) + ' uit; einde maand naar verwachting ' +
    euroTekst(vb.eindeMaand.saldoCenten) + ' in de wallet.';
}

module.exports = { RANG, netteUitzondering, eigenUitzonderingen, verwachtingZin };
