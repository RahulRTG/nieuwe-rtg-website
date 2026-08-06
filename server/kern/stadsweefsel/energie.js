/* RTG Stadsweefsel, deel "energie": van meten naar plannen.

   Het energiedomein van RTG Stad meet kW en zet een regime. Dat is de helft:
   je ziet dat het net zwaar trekt, maar je kunt niet zien WAAR de ruimte zit,
   wie hem gebruikt, en wat je zou kunnen verschuiven. Deze laag rekent per
   voedingsgebied uit hoeveel capaciteit er is, wat eraan hangt, en welke
   maatregelen er zijn -- met de gevolgen erbij.

   DE SCHEIDING DIE ALLES DRAAGT: adviseren is iets anders dan aansturen.

   Een centraal stadsplatform mag niet onbeperkt fysieke installaties schakelen,
   en deze module doet dat dan ook NIET -- hij kan het niet eens: er is geen
   actuator-laag en die komt hier ook niet stiekem binnen via een veld dat
   "opdracht" heet. Wat hier wel gebeurt is een OPDRACHT VASTLEGGEN: een
   voorgenomen maatregel, binnen vooraf vastgelegde grenzen, met een naam, een
   terugvalstand, een vervaltijd en een auditspoor. De installatie zelf hoort
   een eigen lokale veiligheidscontroller te hebben die dit mag weigeren; wat
   dat betreft is dit systeem de vragende partij en niet de baas.

   VIER GRENZEN, HARD IN DE CODE:
   - een maatregel raakt nooit een object met risicoklasse kritiek (niveau 4);
   - dimmen gaat nooit onder de ondergrens (DIM_MIN), want donker is geen
     besparing maar een veiligheidsprobleem;
   - hulpdiensten houden altijd hun gereserveerde marge (RESERVE_PCT);
   - elke opdracht vervalt vanzelf (OPDRACHT_TTL) en valt dan terug op de
     normale stand -- een maatregel die blijft hangen omdat iemand vergat hem
     terug te zetten, is de klassieke manier waarop dit soort systemen schade
     veroorzaakt.

   Krijgt de gedeelde ctx van kern/stadsweefsel/index.js. */
const { schoon } = require('../util');
const { magAutomatisch } = require('./ainiveau');

const UUR = 3600000;
const DIM_MIN = 40;             // procent: hieronder wordt er niet gedimd
const RESERVE_PCT = 10;         // marge die voor hulpdiensten gereserveerd blijft
const OPDRACHT_TTL = 4 * UUR;   // een maatregel vervalt vanzelf
// wat een transformatorstation in dit model aankan, in kW
const CAPACITEIT_KW = 1600;
// wat de dingen die eraan hangen ruwweg trekken (kW), voor het verdeelbeeld
const VERBRUIK_KW = { laadpaal: 22, lantaarn: 0.06, verkeerslicht: 0.4, gemaal: 15, halte: 0.3, sensor: 0.01 };

module.exports = (ctx) => {
  const { d, save, crypto, nu, geo, obj, afh, tr } = ctx;

  const opdrachten = () => { if (!Array.isArray(d().weefselEnergie)) d().weefselEnergie = []; return d().weefselEnergie; };
  const levend = () => opdrachten().filter(o => o.tot > nu() && !o.ingetrokken);

  /* Het beeld per voedingsgebied. Elk transformatorstation is een gebied: wat
     hangt eraan, wat trekt dat bij benadering, en hoeveel ruimte is er nog. De
     gemeten kW uit de Stadsdozen staat ernaast -- twee getallen langs
     verschillende weg, en als ze ver uiteenlopen is DAT de melding. */
  function beeld() {
    obj.zorgObjecten();
    const uit = [];
    for (const t of obj.zoek({ soort: 'transformator' })) {
      const keten = afh.benedenstrooms(t.id).rij.map(x => x.object);
      const perSoort = {};
      let geschat = 0;
      for (const o of keten) {
        if (o.status === 'uit-dienst') continue;
        perSoort[o.soort] = (perSoort[o.soort] || 0) + 1;
        geschat += VERBRUIK_KW[o.soort] || 0;
      }
      const zone = geo.gebied(t.zone);
      const wijk = geo.pad(t.gebied).find(g => g.niveau === 'wijk');
      const reeks = tr.reeks({ sens: 'energie', gebied: wijk ? wijk.id : null, laag: 'uur' });
      const gemeten = reeks.punten.length ? reeks.punten[reeks.punten.length - 1].gem : null;
      const belasting = gemeten != null ? gemeten : geschat;
      const bezet = Math.round(belasting / CAPACITEIT_KW * 1000) / 10;
      uit.push({
        transformator: { id: t.id, naam: t.naam, risico: t.risico },
        gebied: wijk ? wijk.id : t.gebied, gebiedNaam: wijk ? wijk.naam : (zone ? zone.naam : ''),
        capaciteitKw: CAPACITEIT_KW, geschatKw: Math.round(geschat * 10) / 10,
        gemetenKw: gemeten, bezetPct: bezet, ruimteKw: Math.round((CAPACITEIT_KW - belasting) * 10) / 10,
        afnemers: perSoort, congestie: bezet >= (100 - RESERVE_PCT),
        marge: 'de laatste ' + RESERVE_PCT + '% blijft gereserveerd voor hulpdiensten'
      });
    }
    return { status: 200, gebieden: uit, opdrachten: levend().map(publiek),
      grenzen: { dimOndergrens: DIM_MIN, reservePct: RESERVE_PCT, opdrachtVervaltNaUur: OPDRACHT_TTL / UUR },
      let_op: 'Dit platform schakelt zelf niets. Een opdracht is een vastgelegde voorgenomen maatregel; de installatie beslist lokaal.' };
  }

  /* De maatregelen die het systeem KENT. Elke maatregel draagt zijn effect,
     zijn grens en zijn terugvalstand -- dat laatste is het veld dat er in de
     praktijk altijd ontbreekt en dat het verschil maakt tussen een tijdelijke
     ingreep en een sluipende nieuwe normaal. */
  const MAATREGELEN = {
    'laden-uitstellen': { effect: 'gemeentelijke voertuigen laden twee uur later', winstKw: 60, terug: 'laden hervat automatisch', soorten: ['laadpaal'] },
    'verlichting-dimmen': { effect: 'niet-kritieke verlichting naar ' + DIM_MIN + '%', winstKw: 25, terug: 'verlichting terug naar het normale regime', soorten: ['lantaarn'] },
    'batterij-inzetten': { effect: 'gebouwbatterijen leveren tijdens de piek', winstKw: 120, terug: 'batterijen laden weer bij buiten de piek', soorten: [] },
    'bedrijven-waarschuwen': { effect: 'bedrijven krijgen bericht over verwachte netdrukte', winstKw: 0, terug: 'geen; dit is alleen een bericht', soorten: [] }
  };

  /* Het advies. Kijkt naar de bezetting per gebied en stelt maatregelen voor,
     op volgorde van hoe weinig ze kosten. Geen enkele wordt uitgevoerd; dat is
     niveau 2 uit ainiveau.js en dat staat er ook bij. */
  function energieAdvies() {
    const b = beeld();
    const voorstellen = [];
    for (const g of b.gebieden) {
      if (g.bezetPct < 70) continue;
      const zwaar = g.bezetPct >= (100 - RESERVE_PCT);
      for (const [naam, m] of Object.entries(MAATREGELEN)) {
        if (!zwaar && m.winstKw > 60) continue;   // zware middelen alleen bij echte drukte
        voorstellen.push({ gebied: g.gebied, gebiedNaam: g.gebiedNaam, maatregel: naam,
          effect: m.effect, winstKw: m.winstKw, terugvalstand: m.terug,
          waarom: g.gebiedNaam + ' zit op ' + g.bezetPct + '% van zijn capaciteit' });
      }
    }
    return { status: 200, aantal: voorstellen.length, voorstellen,
      maatregelen: MAATREGELEN, niveau: magAutomatisch('energie-advies'),
      let_op: voorstellen.length ? 'Voorstellen. Een mens zet ze door, en dan nog vraagt dit systeem het alleen -- het schakelt niet.'
        : 'Het net heeft ruimte; er is niets voor te stellen.' };
  }

  function publiek(o) {
    return { ...o, verlooptOver: Math.max(0, Math.round((o.tot - nu()) / 60000)) + ' minuten',
      gebiedNaam: geo.gebied(o.gebied) ? geo.gebied(o.gebied).naam : o.gebied };
  }

  /* Een opdracht vastleggen. Vier controles voordat er ook maar iets wordt
     opgeschreven, en de zwaarste is de laatste: raakt de maatregel een object
     dat kritiek is, dan gaat hij niet door -- ook niet met een handtekening,
     want dan hoort het via de eigen procedure van die installatie te lopen en
     niet via een stadsknop. */
  function opdracht({ gebied, maatregel, wie, tweede, redenTekst }) {
    const m = MAATREGELEN[String(maatregel || '')];
    if (!m) return { status: 400, error: 'Kies een maatregel: ' + Object.keys(MAATREGELEN).join(', ') + '.' };
    const g = geo.gebied(gebied);
    if (!g) return { status: 404, error: 'Onbekend gebied.' };
    const naam = schoon(wie, 60);
    if (!naam) return { status: 400, error: 'Wie geeft deze opdracht?' };
    const tweedeNaam = schoon(tweede, 60);
    if (m.winstKw >= 100 && (!tweedeNaam || tweedeNaam === naam))
      return { status: 400, error: 'Een zware maatregel vraagt vier ogen: twee verschillende namen.' };
    const kritiek = obj.zoek({ gebied: g.id }).filter(o => o.risico === 'kritiek' && m.soorten.includes(o.soort));
    if (kritiek.length)
      return { status: 403, error: 'Deze maatregel raakt ' + kritiek.length + ' veiligheidskritiek object(en) (' +
        kritiek.map(o => o.naam).join(', ') + '). Dat loopt via de eigen procedure van die installatie, niet via dit bord.' };
    const bestaat = levend().find(o => o.gebied === g.id && o.maatregel === maatregel);
    if (bestaat) return { status: 400, error: 'Die maatregel loopt hier al tot ' + new Date(bestaat.tot).toISOString().slice(11, 16) + '.' };

    const o = { id: 'EO-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      gebied: g.id, maatregel: String(maatregel), effect: m.effect, winstKw: m.winstKw,
      terugvalstand: m.terug, reden: schoon(redenTekst, 200) || null,
      wie: naam, tweede: tweedeNaam || null, at: nu(), tot: nu() + OPDRACHT_TTL, ingetrokken: false };
    opdrachten().unshift(o);
    if (opdrachten().length > 500) opdrachten().length = 500;
    save();
    return { ok: true, opdracht: publiek(o),
      let_op: 'Vastgelegd, niet geschakeld: de installatie voert dit alleen uit als haar eigen controller het toestaat, en hij vervalt vanzelf.' };
  }

  function intrekken({ id, wie }) {
    const o = opdrachten().find(x => x.id === String(id || ''));
    if (!o) return { status: 404, error: 'Onbekende opdracht.' };
    if (o.ingetrokken) return { status: 400, error: 'Die is al ingetrokken.' };
    o.ingetrokken = true; o.ingetrokkenDoor = schoon(wie, 60) || 'kantoor'; o.ingetrokkenAt = nu();
    save();
    return { ok: true, opdracht: publiek(o), terugvalstand: o.terugvalstand };
  }

  return {
    MAATREGELEN, CAPACITEIT_KW, beeld, levend,
    api: {
      weefselEnergie: beeld,
      weefselEnergieAdvies: energieAdvies,
      weefselEnergieOpdracht: opdracht,
      weefselEnergieIntrek: intrekken
    }
  };
};
