/* DE TWEE POORTEN VAN EEN HERSTELTRANSACTIE: wat er vooraf moet kloppen, en wat
   er achteraf werkelijk is gebeurd. De keten eromheen staat in ./transactie.js.

   Ze staan samen in dit bestand omdat ze hetzelfde soort ding zijn -- een reeks
   genoemde controles die elk hun eigen uitslag met een reden dragen -- en apart
   van de keten omdat die iets anders doet: hij bepaalt de VOLGORDE en wat er
   gebeurt als een poort dichtblijft.

   TWEE REGELS DIE BEIDE POORTEN DELEN.

   1. EEN CONTROLE DIE NIET KON DRAAIEN, IS NIET GESLAAGD. Hij komt terug met
      `gecontroleerd: false` en de reden. Hij blokkeert dan ook niets -- maar
      dat staat in de uitslag, zodat niemand hem voor een geslaagde controle
      aanziet.
   2. "GEEN FOUT GEZIEN" IS GEEN UITSLAG. De verificatie kijkt POSITIEF na: staat
      het veld werkelijk op de bedoelde waarde, en is de aanleiding werkelijk
      weg. Raakte de ronde nul objecten, dan is de uitslag `niet van toepassing`
      en uitdrukkelijk niet "geslaagd". */
'use strict';

const { s } = require('./register');

/* ---------- poort 1: mag dit nu, op deze schaal, met deze weg terug? ---------- */
function voorcontrole({ rb, cert, runbooks, gezondheid }) {
  const uit = [];
  const zeg = (naam, goed, waarom, extra) =>
    uit.push(Object.assign({ naam, gecontroleerd: true, goed, waarom }, extra || {}));

  const bevroren = runbooks.BEVROREN.has(rb.veld);
  zeg('veld-niet-bevroren', !bevroren,
    bevroren ? 'het veld "' + rb.veld + '" draagt een identiteit, een bedrag of een recht en is bevroren'
      : 'het veld "' + rb.veld + '" staat niet op de bevroren lijst');

  const wegNodig = cert.terugweg === 'automatisch';
  zeg('terugweg-bestaat', !wegNodig || !!rb.terugDraaibaar,
    !wegNodig ? 'dit certificaat belooft geen automatische weg terug (' + cert.terugweg + ')'
      : rb.terugDraaibaar ? 'het certificaat belooft een automatische weg terug, en dit recept is terug te draaien'
        : 'het certificaat belooft een automatische weg terug, maar dit recept is niet terug te draaien');

  const k = runbooks.kandidaten(rb, Number.MAX_SAFE_INTEGER);
  const grens = cert.maxObjecten;
  zeg('binnen-max-impact', grens == null || k.totaal <= grens,
    grens == null ? 'dit recept heeft geen afgesproken bovengrens; alleen de rondegrens uit het beleid geldt'
      : k.totaal + ' geval(len) tegenover een certificaat voor ten hoogste ' + grens,
    { gemeten: { kandidaten: k.totaal, max: grens } });

  /* Gegevens rechtzetten terwijl het fundament eronder wankelt, is hoe je er een
     tweede storing bij maakt. Deze controle bestaat alleen waar de
     gezondheidskaart er is -- de zaak-kant draait dezelfde recepten zonder. */
  if (!gezondheid) {
    uit.push({ naam: 'fundament-gezond', gecontroleerd: false, goed: null,
      waarom: 'de gezondheidskaart is hier niet beschikbaar, dus deze voorwaarde is niet gecontroleerd; ' +
        'zij houdt daarom ook niets tegen' });
  } else {
    let stand = null;
    try { stand = gezondheid.stand(); } catch (e) { stand = { fout: e.message }; }
    if (!stand || stand.fout) {
      uit.push({ naam: 'fundament-gezond', gecontroleerd: false, goed: null,
        waarom: 'de gezondheidskaart kon niet gelezen worden (' + ((stand && stand.fout) || 'onbekend') + ')' });
    } else {
      const stuk = stand.vermogens
        .filter(v => ['bereikbaar', 'gegevens', 'sporen'].includes(v.id) && v.oordeel === 'storing')
        .map(v => v.naam);
      zeg('fundament-gezond', !stuk.length,
        stuk.length ? 'het fundament heeft een storing: ' + stuk.join(', ') + ' -- gegevens rechtzetten ' +
          'terwijl dat wankelt, maakt er een tweede storing bij'
          : 'bereikbaar, de gegevens en de sporen staan niet op storing');
    }
  }

  const blokkerend = uit.filter(v => v.gecontroleerd && v.goed === false);
  return { stappen: uit, mag: !blokkerend.length, blokkerend,
    nietGecontroleerd: uit.filter(v => !v.gecontroleerd).map(v => v.naam) };
}

/* ---------- poort 2: is het werkelijk gelukt? ---------- */
function verifieer({ rb, cert, geraakt, register, db }) {
  const rijenGeraakt = geraakt || [];
  if (!rijenGeraakt.length) {
    return { goed: null, nietVanToepassing: true, stappen: [],
      waarom: 'deze ronde raakte geen enkel object, dus er valt niets te verifiëren. Dat is ' +
        'uitdrukkelijk geen geslaagde ronde.' };
  }
  const soort = register.OP_TYPE.get(rb.type);
  if (!soort) {
    return { goed: false, stappen: [],
      waarom: 'de soort "' + rb.type + '" bestaat niet meer, dus de uitkomst is niet na te kijken' };
  }
  const rijen = register.rijen(db, soort);
  const vind = (id) => rijen.find(x => x && s(x[soort.sleutel]) === id);
  const stappen = [];
  const wil = new Set(cert.verificaties || ['veld-staat-op-doel']);

  if (wil.has('veld-staat-op-doel')) {
    const mis = [];
    for (const g of rijenGeraakt) {
      const r = vind(g.id);
      if (!r) { mis.push(g.id + ' (bestaat niet meer)'); continue; }
      if (s(r[g.veld]) !== g.naar) mis.push(g.id + ' (staat op "' + s(r[g.veld]) + '", niet op "' + g.naar + '")');
    }
    stappen.push({ naam: 'veld-staat-op-doel', goed: !mis.length,
      gemeten: { nagekeken: rijenGeraakt.length, mis: mis.length },
      waarom: mis.length ? mis.slice(0, 5).join('; ')
        : rijenGeraakt.length + ' object(en) staan werkelijk op de bedoelde waarde' });
  }

  if (wil.has('oorzaak-weg')) {
    const nog = [];
    for (const g of rijenGeraakt) { const r = vind(g.id); if (r && rb.past(r)) nog.push(g.id); }
    stappen.push({ naam: 'oorzaak-weg', goed: !nog.length,
      gemeten: { nagekeken: rijenGeraakt.length, nog: nog.length },
      waarom: nog.length ? nog.length + ' object(en) voldoen nog steeds aan de aanleiding van dit recept'
        : 'geen enkel geraakt object voldoet nog aan de aanleiding' });
  }

  const goed = stappen.every(x => x.goed);
  return { goed, stappen,
    waarom: goed ? 'alle controles zijn positief nagekeken'
      : stappen.filter(x => !x.goed).map(x => x.naam).join(', ') + ' klopt niet' };
}

module.exports = { voorcontrole, verifieer };
