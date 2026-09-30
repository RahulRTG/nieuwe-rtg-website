/* Het Privekantoor, deelbestand "lus-regels": de regels van de concierge-lus,
   zonder opslag. Zie CONCIERGE.md voor de lus zelf; hier staan alleen de
   beslissingen die een mens niet per geval opnieuw hoort te bedenken.

   Alles in dit bestand is een pure functie: case erin, oordeel eruit. Dat is
   met opzet. De deelnemersweergave, het verval van een aanbod en de doorrekening
   van een vertraging moeten voor een hotelconcierge (CONCIERGE.md par. 1) straks
   precies hetzelfde doen als voor De Rechterhand, en dat kan alleen als ze niet
   aan het levensdossier van een lid vastzitten.

   VIJF REGELS DIE HIER VASTLIGGEN:

   1. EEN AANBOD VERVALT BEREKEND. `aanbodStand()` kijkt naar de klok en niet
      naar een opruimtaak. Een aanbod na zijn tijd is verlopen, ook als niemand
      het heeft weggehaald (CON-09).
   2. EEN DEELNEMER KRIJGT EEN POSITIEVE LIJST VELDEN. `deelnemerBeeld()` bouwt
      een nieuw object uit genoemde velden en kopieert nooit een case om er
      daarna iets uit te halen -- dan passeert elk nieuw veld vanzelf de grens
      (AI-CONTEXT-01, hier voor een partner in plaats van een model) (CON-02).
   3. EEN VERRASSING IS EEN STAND EN GEEN NOTITIE. Zolang hij geldt, weigert
      `magBereiken()` elke ontvanger die de verraste kan zien: het gezin en elk
      gedeeld kanaal. Er is geen uitzondering, ook niet "alleen een herinnering"
      (CON-08).
   4. "ALLES IS GEREGELD" IS EEN UITKOMST EN GEEN TOON. `gastBericht()` zegt het
      alleen als elk onderdeel bevestigd is. Anders zegt het wat er staat en wat
      nog loopt.
   5. EEN VERTRAGING ZET BERICHTEN KLAAR EN VERSTUURT ER GEEN. `gevolgen()`
      rekent uit wie het raakt en schrijft per deelnemer een bericht; versturen
      is een handeling van een mens (CON-06). */
'use strict';

const { min, klok } = require('../avond/klok');

/* ---- 1. het aanbod ------------------------------------------------------ */

function aanbodStand(a, nuMs) {
  if (a.gekozen) return 'gekozen';
  if (a.afgewezen) return 'afgewezen';
  const tot = Date.parse(a.geldigTot || '');
  if (!Number.isFinite(tot)) return 'zonder-termijn';
  return nuMs < tot ? 'vastgehouden' : 'verlopen';
}

const AANBOD_LABEL = {
  vastgehouden: 'Vastgehouden',
  verlopen: 'Verlopen: dit aanbod geldt niet meer',
  gekozen: 'Gekozen',
  afgewezen: 'Niet gekozen',
  'zonder-termijn': 'Aangeboden zonder termijn: vraag na of het nog geldt'
};

/* ---- 2. de deelnemersweergave ------------------------------------------ */

/* De velden die een partner van EEN onderdeel te zien krijgt. Wie hier iets
   bij zet, besluit dat een partner het mag weten; iets dat hier niet staat
   bereikt hem niet, hoe het veld in de case ook heet. */
function deelnemerBeeld(c, code) {
  const onderdelen = (c.onderdelen || []).filter(o => o.deelnemer && o.deelnemer.code === code);
  return onderdelen.map(o => ({
    caseRef: c.id,
    onderdeel: o.id,
    wat: o.wat,
    datum: c.van || '',
    van: o.van || '',
    duurMin: o.duurMin || 0,
    personen: c.personen || null,
    wensen: (c.harde || []).slice(0, 10),
    gelegenheid: c.gelegenheid || '',
    discreet: !!c.verrassing,
    stand: o.stand
  }));
}

/* ---- 3. de verrassing -------------------------------------------------- */

/* Wie mag een bericht over deze case krijgen? `ontvanger.soort` volgt de
   gesloten lijst van kern/ontvanger.js (lid, gezin, mail) plus de twee soorten
   die deze lus zelf kent: een zaak die een onderdeel levert, en een gedeeld
   kanaal (een gezinsagenda, een gedeelde reis). */
function magBereiken(c, ontvanger) {
  const soort = ontvanger && ontvanger.soort;
  if (!c.verrassing) return { ok: true };
  if (soort === 'gezin' || soort === 'gedeeld') {
    return { ok: false, reden: 'Dit is een verrassing. Zolang die geldt gaat er niets naar het gezin of naar een gedeeld kanaal.' };
  }
  return { ok: true };
}

/* ---- 4. wat de gast hoort ---------------------------------------------- */

function gastBericht(c) {
  const o = actief(c);
  if (!o.length) return { alles: false, tekst: 'Wij zijn ermee bezig. U hoeft niets te doen.' };
  const staat = o.filter(x => x.stand === 'bevestigd' || x.stand === 'geleverd');
  const open = o.filter(x => !(x.stand === 'bevestigd' || x.stand === 'geleverd'));
  if (!open.length) {
    return { alles: true, tekst: c.herstel ? 'Wij hebben het programma iets aangepast. Alles is geregeld.' : 'Alles is geregeld.' };
  }
  const namen = l => l.map(x => x.wat).join(', ');
  return { alles: false,
    tekst: (staat.length ? namen(staat) + (staat.length === 1 ? ' staat. ' : ' staan. ') : '') +
      'Nog bezig: ' + namen(open) + '. Wij melden het zodra het vaststaat.' };
}

/* ---- 5. de tijdlijn en wat een vertraging raakt ------------------------ */

/* De onderdelen op de klok, met de afgesproken tijd als ondergrens en de
   vertraging van een onderdeel die doorschuift naar alles erna. Een onderdeel
   dat kapot is telt niet mee: het neemt geen tijd in die er niet meer is. */
function tijdlijn(c) {
  const rijen = [];
  let t = null;
  for (const o of (c.onderdelen || [])) {
    if (o.stand === 'kapot') continue;
    const afgesproken = min(o.van);
    let begin = afgesproken;
    if (t != null) begin = afgesproken == null ? t + (o.reisMin || 0) : Math.max(afgesproken, t + (o.reisMin || 0));
    if (begin == null) continue;
    begin += (o.vertragingMin || 0);
    const eind = begin + (o.duurMin || 0);
    rijen.push({ id: o.id, wat: o.wat, afgesproken: o.van || '', van: klok(begin), tot: klok(eind),
      verschuiving: afgesproken == null ? 0 : begin - afgesproken, deelnemer: o.deelnemer || null });
    t = eind;
  }
  return rijen;
}

function gevolgen(c) {
  const uit = [];
  for (const r of tijdlijn(c)) {
    if (!r.verschuiving || !r.deelnemer) continue;
    uit.push({ onderdeel: r.id, deelnemer: r.deelnemer, oud: r.afgesproken, nieuw: r.van,
      bericht: r.wat + ': nieuwe tijd ' + r.van + ' (was ' + r.afgesproken + ').' });
  }
  return uit;
}

/* ---- 6. afsluiten -------------------------------------------------------- */

/* Een vervangen onderdeel is geschiedenis en geen openstaande belofte. */
const actief = c => (c.onderdelen || []).filter(o => !o.vervangenDoor);

/* Mag deze case op "geregeld"? Alleen als het waar is: er is iets vastgezet,
   alles wat actief is staat bevestigd, en er ligt geen voorstel meer bij het
   lid. Een case buiten de lus valt hier niet onder. */
function afsluitbaar(c) {
  if (c.werkwijze !== 'voorstel') return { ok: true };
  if (c.voorstel) return { ok: false, reden: 'Er ligt nog een voorstel bij het lid.' };
  const a = actief(c);
  if (!a.length) return { ok: false, reden: 'Er is nog niets vastgezet.' };
  const open = a.filter(o => o.stand !== 'bevestigd' && o.stand !== 'geleverd');
  if (open.length) return { ok: false, reden: 'Nog niet bevestigd: ' + open.map(o => o.wat).join(', ') + '.' };
  return { ok: true };
}


function uitkomst(c) {
  const o = actief(c);
  const nagekomen = o.filter(x => x.stand === 'bevestigd' || x.stand === 'geleverd').length;
  // een herstelmoment is een onderdeel dat omviel, niet een regel in de tijdlijn
  const herstel = (c.onderdelen || []).filter(x => x.stand === 'kapot').length;
  const opnieuw = (c.tijdlijn || []).filter(r => r.door === 'lid' && r.soort === 'toelichting' && r.tijdensHerstel).length;
  return {
    beloften: { totaal: o.length, nagekomen, open: o.length - nagekomen },
    herstelmomenten: herstel,
    opnieuwVerteld: c.werkwijze === 'voorstel'
      ? opnieuw
      : { nietGemeten: true, waarom: 'Deze zaak liep niet via de concierge-lus, dus er is geen toelichting per herstel vastgelegd.' },
    nietGemeten: [
      { wat: 'tevredenheid', waarom: 'Wij vragen geen cijfer; een leeg vak wordt gevuld met iemands indruk (SERVICE.md par. 12).' },
      { wat: 'afhandeltijd per medewerker', waarom: 'De meeteenheid is de zaak en nooit de mens (CON-05).' }
    ]
  };
}

module.exports = { aanbodStand, AANBOD_LABEL, deelnemerBeeld, magBereiken, gastBericht, tijdlijn, gevolgen, uitkomst,
  actief, afsluitbaar };
