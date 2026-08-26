/* DE EIGEN GELDGRENS: een regel die het lid over zichzelf stelt, en die
   werkelijk WEIGERT.

   ./regels.js kent vier soorten en ze waarschuwen allemaal. Dat is voor die vier
   ook precies goed -- een minimumbuffer die je betaling blokkeert is geen buffer
   maar een blokkade. Maar het lid dat zegt "meer dan 500 euro per maand aan
   horeca wil ik niet uitgeven" vraagt niet om een melding achteraf. Hij vraagt
   om een grens. Een waarschuwing die je kunt wegklikken op het moment dat je
   hem het hardst nodig hebt, is geen grens maar een geheugensteun.

   Daarom weigert deze soort echt, in de waardepoort, vóór de boeking.

   DE SPANNING, en die is niet weg te ontwerpen. Een grens die je meteen kunt
   uitzetten, is een drempel: hij onderbreekt een impuls, meer niet. Een grens
   die je NIET meteen kunt uitzetten, is een echte belofte aan jezelf -- en zet
   iemand die in het buitenland strandt met een daglimiet van honderd euro voor
   een hotel van vierhonderd voor een gesloten deur.

   De keuze hier: **onmiddellijk strenger, met bedenktijd soepeler, en de
   bedenktijd is opt-in.** Een grens verlagen of aanzetten werkt meteen. Een
   grens verhogen of uitzetten werkt ook meteen, TENZIJ het lid er zelf een
   bedenktijd op heeft gezet -- dan gaat de versoepeling pas na die uren in.

   Standaard dus geen bedenktijd. Dat is met opzet de zwakkere stand: RTG is
   geen kansspelaanbieder, en een betaalgrens die iemand laat stranden is erger
   dan een impulsaankoop. Wie de sterkere versie wil, kiest hem, en dan houdt hij
   ook echt. Wat er NIET is, is een noodknop die de bedenktijd overslaat: die zou
   de bedenktijd terugbrengen tot precies wat hij niet mocht zijn.

   VAN WIE IS DIT EEN GRENS? Van de PERSOON, niet van een potje. De dagmax in
   ./regels.js van een werkgeversbudget geldt per positie -- dat is zijn budget.
   Deze grens telt over alles wat het lid heeft samen, want het lid stelt hem
   over zijn eigen uitgaven en niet over een van zijn potjes. Dat verschil staat
   in kern/waarde/policy.js als twee losse velden (dagBesteed en
   dagBestedTotaal), zodat ze niet stilzwijgend hetzelfde gaan betekenen. */
'use strict';

const PERIODEN = ['dag', 'maand'];
const MAX_BEDENKTIJD = 30 * 24;   // uren; langer is geen bedenktijd meer maar een slot

module.exports = (ctx) => {
  const { pak, kijk, save, maakId, bedragVan, MAX_CENTEN } = ctx;
  const MAX_GRENZEN = 10;
  /* De klok van geldbeleid geeft een DATE terug (./index.js), niet
     milliseconden -- ./actielog.js roept er `.toISOString()` op aan. Dit
     bestand rekent met tijdstempels, dus het haalt er hier één keer een getal
     uit. Dat stond er eerst niet, en toen werd `nu() + uren * 3600000` een
     stringplakking: de bedenktijd stond op "Mon Aug 24 2026 ...86400000" en was
     daarmee nooit verstreken. Een grens die nooit vrijkomt is erger dan geen
     grens, want hij is met geen enkele foutmelding te herkennen. */
  const ms = () => new Date(ctx.nu()).getTime();

  function bak(rec) { if (!Array.isArray(rec.grenzen)) rec.grenzen = []; return rec.grenzen; }
  const zicht = g => ({ id: g.id, periode: g.periode, centen: g.centen, venster: g.venster || null,
    genres: g.genres || null, aan: !!g.aan, bedenktijdUren: g.bedenktijdUren || 0,
    wachtTot: g.wachtTot || null, wacht: g.wachtTot ? { centen: g.wachtCenten, aan: g.wachtAan } : null });

  function grenzen(codenaam) { const r = kijk(codenaam); return r ? bak(r).map(zicht) : []; }

  /* Strenger werkt meteen, soepeler kan wachten. "Strenger" is: een lager
     bedrag, of van uit naar aan. Al het andere is soepeler. */
  function isStrenger(oud, centen, aan) {
    if (!oud) return true;                       // een nieuwe grens is per definitie strenger dan geen grens
    if (!oud.aan && aan) return true;
    if (oud.aan && !aan) return false;
    return centen < oud.centen;
  }

  function grensZet(codenaam, g) {
    const rec = pak(codenaam);
    if (!rec) return { status: 400, error: 'Geen codenaam.' };
    g = g && typeof g === 'object' ? g : {};
    const lijst = bak(rec);
    const oud = g.id != null ? lijst.find(x => x.id === String(g.id)) : null;
    if (g.id != null && !oud) return { status: 404, error: 'Deze grens bestaat niet.' };
    const periode = String(g.periode || (oud ? oud.periode : 'maand'));
    if (!PERIODEN.includes(periode)) return { status: 400, error: 'Kies een periode: ' + PERIODEN.join(' of ') + '.' };
    const centen = bedragVan(g.centen != null ? g.centen : (oud ? oud.centen : null));
    if (centen == null || centen < 100) return { status: 400, error: 'Geef een bedrag van minstens een euro in hele centen.' };
    if (centen > MAX_CENTEN) return { status: 400, error: 'Dat bedrag is te hoog.' };
    const venster = g.venster == null ? (oud ? oud.venster : null) : (String(g.venster) || null);
    if (venster && !/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(venster)) return { status: 400, error: 'Een tijdvenster ziet eruit als 06:00-23:00.' };
    const aan = g.aan == null ? (oud ? !!oud.aan : true) : !!g.aan;
    const bedenktijd = Math.min(MAX_BEDENKTIJD, Math.max(0, Math.round(Number(g.bedenktijdUren != null ? g.bedenktijdUren : (oud ? oud.bedenktijdUren : 0)) || 0)));
    if (!oud && lijst.length >= MAX_GRENZEN) return { status: 400, error: 'Meer dan ' + MAX_GRENZEN + ' grenzen is geen beleid meer; ruim eerst op.' };

    if (!oud) {
      const n = { id: maakId('gr'), periode, centen, venster, genres: Array.isArray(g.genres) && g.genres.length ? g.genres.slice(0, 12).map(String) : null,
        aan, bedenktijdUren: bedenktijd, at: ms() };
      lijst.unshift(n); save();
      return { status: 200, ok: true, grens: zicht(n) };
    }

    /* Een versoepeling met bedenktijd wordt GEPARKEERD en niet toegepast. Het
       lid ziet dat er iets klaarstaat en wanneer het ingaat; tot dat moment
       geldt de oude grens onverkort. Een tweede versoepeling overschrijft de
       geparkeerde -- de klok begint dan opnieuw, want anders is de bedenktijd
       met twee kleine stapjes te omzeilen. */
    if (bedenktijd > 0 && !isStrenger(oud, centen, aan)) {
      oud.wachtCenten = centen; oud.wachtAan = aan; oud.wachtTot = ms() + bedenktijd * 3600000;
      oud.bedenktijdUren = bedenktijd;
      save();
      return { status: 200, ok: true, grens: zicht(oud), geparkeerd: true,
        uitleg: 'U heeft hier zelf een bedenktijd op gezet; deze versoepeling gaat later in.' };
    }
    oud.periode = periode; oud.centen = centen; oud.venster = venster; oud.aan = aan;
    oud.bedenktijdUren = bedenktijd;
    if (Array.isArray(g.genres)) oud.genres = g.genres.length ? g.genres.slice(0, 12).map(String) : null;
    oud.wachtTot = null; oud.wachtCenten = null; oud.wachtAan = null;   // strenger wist een geparkeerde versoepeling
    save();
    return { status: 200, ok: true, grens: zicht(oud) };
  }

  /* Weghalen is de sterkste versoepeling die er is, dus hij loopt langs
     dezelfde bedenktijd. Zou dat niet zo zijn, dan is de bedenktijd te omzeilen
     door de grens niet te verhogen maar weg te gooien. */
  function grensWeg(codenaam, id) {
    const rec = pak(codenaam);
    if (!rec) return { status: 400, error: 'Geen codenaam.' };
    const lijst = bak(rec);
    const i = lijst.findIndex(x => x.id === String(id || ''));
    if (i < 0) return { status: 404, error: 'Deze grens bestaat niet.' };
    const g = lijst[i];
    if (g.bedenktijdUren > 0 && g.aan) {
      if (!g.wachtTot) {
        g.wachtAan = false; g.wachtCenten = g.centen; g.wachtTot = ms() + g.bedenktijdUren * 3600000;
        save();
        return { status: 200, ok: true, geparkeerd: true, wachtTot: g.wachtTot,
          uitleg: 'U heeft hier zelf een bedenktijd op gezet; de grens vervalt later.' };
      }
      if (g.wachtTot > ms()) return { status: 409, error: 'De bedenktijd loopt nog.', wachtTot: g.wachtTot };
    }
    lijst.splice(i, 1); save();
    return { status: 200, ok: true };
  }

  /* WAT DE POORT VRAAGT. Geeft het beleid in de vorm die
     kern/waarde/policy.js kent, of null als er niets geldt. Hier wordt ook een
     geparkeerde versoepeling die is afgelopen, alsnog van kracht -- zonder
     achtergrondtaak, want een taak die kan uitvallen is een grens die stil
     blijft hangen. */
  function grensVoor(codenaam, genre) {
    const rec = kijk(codenaam);
    if (!rec) return null;
    let veranderd = false;
    let dag = null, maand = null, venster = null;
    for (const g of bak(rec)) {
      if (g.wachtTot && g.wachtTot <= ms()) {
        g.centen = g.wachtCenten; g.aan = !!g.wachtAan;
        g.wachtTot = null; g.wachtCenten = null; g.wachtAan = null;
        veranderd = true;
      }
      if (!g.aan) continue;
      if (Array.isArray(g.genres) && g.genres.length && !g.genres.includes(genre)) continue;
      if (g.periode === 'dag') dag = dag == null ? g.centen : Math.min(dag, g.centen);
      else maand = maand == null ? g.centen : Math.min(maand, g.centen);
      if (g.venster) venster = g.venster;
    }
    if (veranderd) save();
    if (dag == null && maand == null && !venster) return null;
    return { dagMaxCenten: dag, maandMaxCenten: maand, venster };
  }

  return { grenzen, grensZet, grensWeg, grensVoor, PERIODEN };
};
