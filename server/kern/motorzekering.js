/* DE ZEKERING VOOR DE RUST-MOTOR OP HET GELDPAD.

   Afgesplitst uit ./motorverbinding.js, en de naad is echt: dat bestand gaat
   over WAT er naar de motor gaat (een boeking, een saldo-opvraag, met welke
   paden en welke foutteksten), dit gaat over OF er nog iets heen mag. Twee
   vragen die los van elkaar fout kunnen gaan en los van elkaar te toetsen zijn.

   ---------------------------------------------------------------------------
   WAAROM DIT ER MOET ZIJN

   server/kern/magnaat-motorklant.js praat met dezelfde motor en heeft drie
   beschermingen die het geldpad niet had: een foutenteller met afkoelperiode,
   een grens op gelijktijdige verzoeken, en een maximum op de antwoordgrootte.
   Ze ontbraken op het pad waar GELD loopt -- waar ze het hardst nodig zijn.

   Wat er zonder gebeurt als de motor stukgaat: elke boeking wacht zijn volle
   time-out van vijf seconden uit voordat hij faalt. Bij honderd wachtende
   verzoeken zijn dat honderd openstaande verbindingen en honderd keer vijf
   seconden -- de motor is dan al onbereikbaar, maar RTG loopt er zelf ook op
   vast. De zekering maakt van vijf seconden wachten een onmiddellijk antwoord.

   IS EEN ZEKERING VEILIG OP EEN GELDPAD? Ja, en om een precieze reden. De motor
   is het autoritatieve grootboek; de JS-engine spiegelt pas NA zijn bevestiging.
   Een open zekering geeft een fout terug, en op een fout past de aanroeper
   niets toe. Er beweegt dus geen cent -- exact hetzelfde als bij een time-out,
   alleen sneller en zonder de server mee te slepen. De zekering verandert hoe
   snel we falen, niet OF er geld beweegt.

   EN DE VALKUIL, DIE HET BELANGRIJKSTE DEEL IS. Een WEIGERING van de motor is
   geen storing. "Onvoldoende saldo" (402) betekent dat de motor werkt en zijn
   werk doet. Zou zo'n antwoord de foutenteller optikken, dan kan een lid dat
   vijf keer te veel probeert uit te geven de zekering laten doorslaan voor
   IEDEREEN -- een zelfgebouwde storing uit normaal gebruik. Daarom telt alleen
   mee wat een storing IS: een verbinding die niet lukt, een time-out, of een
   5xx. Alles waar de motor zelf een oordeel in geeft (4xx) laat de teller met
   rust en zet hem zelfs terug: hij heeft immers geantwoord.

   De grenzen staan op waarden die passen bij een geldpad en niet bij een
   rekenlaag: vijf fouten (niet drie, want een enkele hik hoort de kassa niet te
   sluiten), tien seconden afkoelen (kort, want geld dat niet kan wachten hoort
   snel opnieuw te mogen proberen) en vierenzestig gelijktijdige boekingen.

   HIER WORDT NOOIT GEGOOID. De aanroeper is een geldpad; die krijgt
   {fout: {error, status}} terug en beslist zelf. Zie ./motorverbinding.js.
   --------------------------------------------------------------------------- */
'use strict';

const getal = (waarde, standaard, min, max) => {
  const n = Number(waarde);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : standaard;
};

module.exports = function maakZekering({ url, koppen, timeoutMs }, opties = {}) {
  const FOUTGRENS = getal(process.env.RTG_MOTOR_GELD_FOUTGRENS, 5, 1, 50);
  const AFKOEL_MS = getal(process.env.RTG_MOTOR_GELD_AFKOEL_MS, 10000, 1000, 300000);
  const MAX_TEGELIJK = getal(process.env.RTG_MOTOR_GELD_MAX_TEGELIJK, 64, 1, 1024);
  const MAX_ANTWOORD = getal(process.env.RTG_MOTOR_GELD_MAX_ANTWOORD, 1048576, 65536, 16777216);
  /* Injecteerbaar, zodat een toets de klok en het netwerk in de hand heeft
     zonder tien seconden te moeten wachten. Zonder opties gewoon de echte. */
  const haal = opties.fetch || ((...a) => globalThis.fetch(...a));
  const klok = opties.nu || Date.now;

  let actief = 0, fouten = 0, openTot = 0, proefBezig = false;

  /* Mag er een verzoek uit? Geeft {halfOpen} als het mag, of {fout} met wat de
     aanroeper moet teruggeven. Nooit een uitzondering. */
  function beginPoging() {
    const nu = klok();
    if (openTot > nu) {
      return { fout: { error: 'Motor tijdelijk uit de route na herhaalde storingen; probeer zo opnieuw.', status: 503 } };
    }
    const halfOpen = openTot !== 0;
    /* Half-open: de afkoeltijd is om en we laten EEN verzoek als proef door.
       Zonder deze grendel stormt de hele wachtrij tegelijk naar een motor die
       misschien nog ligt, en is de zekering na een seconde weer dicht. */
    if (halfOpen && proefBezig) {
      return { fout: { error: 'Motor wordt beproefd na een storing; probeer zo opnieuw.', status: 503 } };
    }
    if (actief >= MAX_TEGELIJK) {
      return { fout: { error: 'Te veel boekingen tegelijk onderweg naar de motor; probeer zo opnieuw.', status: 503 } };
    }
    actief += 1;
    if (halfOpen) proefBezig = true;
    return { halfOpen };
  }
  function eindPoging(halfOpen) { actief -= 1; if (halfOpen) proefBezig = false; }
  /* De motor heeft GEANTWOORD -- ook als dat antwoord een weigering was. Dat is
     geen storing, dus de teller gaat terug naar nul. Zie de uitleg bovenaan. */
  function geantwoord() { fouten = 0; openTot = 0; }
  function gestoord() { fouten += 1; if (fouten >= FOUTGRENS) openTot = klok() + AFKOEL_MS; }

  /* Het antwoord lezen met een dak erop. Een motor die (door een fout of door
     kwaadwilligheid) een antwoord van een gigabyte stuurt, mag het geheugen van
     deze server niet opeten terwijl hij het netjes staat te bufferen. */
  async function leesBegrensd(r) {
    const opgegeven = Number(r.headers && r.headers.get && r.headers.get('content-length'));
    if (Number.isFinite(opgegeven) && opgegeven > MAX_ANTWOORD) {
      if (r.body && r.body.cancel) await r.body.cancel().catch(() => {});
      return { teGroot: true };
    }
    if (!r.body || typeof r.body.getReader !== 'function') {
      const tekst = await r.text().catch(() => '');
      if (Buffer.byteLength(tekst) > MAX_ANTWOORD) return { teGroot: true };
      try { return { body: JSON.parse(tekst) }; } catch (e) { return { body: {} }; }
    }
    const lezer = r.body.getReader();
    const stukken = []; let totaal = 0;
    while (true) {
      const { done, value } = await lezer.read();
      if (done) break;
      totaal += value.byteLength;
      if (totaal > MAX_ANTWOORD) { await lezer.cancel().catch(() => {}); return { teGroot: true }; }
      stukken.push(Buffer.from(value));
    }
    try { return { body: JSON.parse(Buffer.concat(stukken, totaal).toString('utf8')) }; }
    catch (e) { return { body: {} }; }
  }

  const onbereikbaar = (e) => ({
    error: e.name === 'AbortError' ? 'Motor-time-out.' : ('Motor onbereikbaar: ' + e.message),
    status: 502
  });

  /* Een verzoek doen, met de zekering eromheen. Geeft {http, body} of {fout}. */
  async function verstuur(pad, lichaam) {
    const poging = beginPoging();
    if (poging.fout) return { fout: poging.fout };
    const af = new AbortController();
    const t = setTimeout(() => af.abort(), timeoutMs);
    try {
      const r = await haal(url + pad, {
        method: 'POST', headers: koppen(),
        body: JSON.stringify(lichaam || {}), signal: af.signal,
      });
      const gelezen = await leesBegrensd(r);
      if (gelezen.teGroot) {
        gestoord();
        return { fout: { error: 'Motor gaf een te groot antwoord.', status: 502 } };
      }
      /* 5xx is de motor die omvalt: dat telt. 4xx is de motor die OORDEELT
         (onvoldoende saldo, onbekende rekening): dat is werk, geen storing. */
      if (r.status >= 500) gestoord(); else geantwoord();
      return { http: r.status, body: gelezen.body };
    } catch (e) {
      gestoord();
      return { fout: onbereikbaar(e) };
    } finally {
      clearTimeout(t);
      eindPoging(poging.halfOpen);
    }
  }

  /* Voor het techniekbord: een doorgeslagen zekering hoort zichtbaar te zijn en
     niet alleen merkbaar (LAT.md regel 5). */
  function stand() {
    const nu = klok();
    return {
      actief, maxTegelijk: MAX_TEGELIJK, fouten, foutgrens: FOUTGRENS,
      zekering: openTot > nu ? 'open' : (openTot ? 'half-open' : 'gesloten'),
      herstelNaMs: Math.max(0, openTot - nu)
    };
  }

  return { verstuur, stand };
};
