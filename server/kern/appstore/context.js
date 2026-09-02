/* ============================================================================
   DE CONTEXTBRUG -- RTG geeft een app precies de waarden mee die EEN handeling
   nodig heeft, en niets meer.

   DE GEDACHTE: RTG bepaalt niet wat een app allemaal mag ZIEN, maar wat hij voor
   DEZE handeling minimaal moet KRIJGEN. "184,50 inclusief 21%" gaat naar de
   rekenmachine; "Rome, 4 dagen" naar de paklijst. Geen gespreksgeschiedenis,
   geen profiel, geen sleutel -- twee getallen.

   DIT IS EEN ZEVENDE BEGRIP GEWEEST EN IS DAT NIET GEWORDEN. APPSTORE.md zegt
   dat er geen zevende bijkomt, en een "contextrecht" naast machtiging, manifest
   en keuring zou er een zijn. Het is daarom een EIGENSCHAP VAN DE OPENING: een
   overdracht hoort bij een keer openen, wordt een keer gelezen en verdwijnt.

   VIER REGELS, EN ZE ZIJN ALLE VIER AFDWINGBAAR HIER.

   1. BEVESTIGEN DOET DE MENS, PER HANDELING. Er is geen machtiging waarmee dit
      een keer wordt aangezet en daarna vanzelf gaat. Het lid ziet de waarden op
      het scherm en drukt op "geef door" -- of niet. Dat is de regel uit LIFE.md
      en FABRIC.md: samenstellen en klaarzetten mag, bevestigen is van de mens.

   2. ALLEEN VELDEN UIT EEN GESLOTEN LIJST. Vrije sleutels zouden van deze weg
      een tweede brug maken waarlangs alles kan. Elk veld hieronder is een
      besluit, met een wereld, een vorm en een uitleg die het lid begrijpt.

   3. EEN OVERDRACHT IS EENMALIG EN VERLOOPT. Hij wordt gelezen en is dan weg. Wat
      met een oud webadres nog iets in gang kan zetten, hoort tijdelijk te zijn
      (LINK.md par. 3).

   4. NOOIT EEN IDENTIFICATOR. Geen codenaam, geen sleutel, geen zaakcode -- de
      waarden zijn getallen, datums en plaatsnamen. Wie een app wil laten weten
      WIE er speelt, gebruikt profiel.basis; dat is een machtiging, en die vraagt
      het lid een keer expliciet.

   WAT HIER MET OPZET NIET STAAT: waar de waarden vandaan komen. Deze laag neemt
   ze aan van de aanroeper (een scherm, een taak, Rahul) en toont ze aan het lid.
   Of ze kloppen, ziet het lid zelf -- ze staan er voluit, in zijn taal.
   ========================================================================== */
'use strict';

const crypto = require('crypto');

const GELDIG_MS = 15 * 60 * 1000;   // een kwartier: lang genoeg om te lezen, kort genoeg om te vergeten
const MAX_OPEN = 20;                // per lid; een aanroeper die er meer klaarzet, ruimt de oudste op

/* DE GESLOTEN LIJST. `wereld` is waar het veld vandaan komt (WERELDEN.md),
   `vorm` bepaalt hoe streng hij wordt gelezen, en `uitleg` is wat het lid leest
   naast de waarde. Een veld erbij is een besluit en geen invulveld. */
const VELDEN = {
  bedrag:         { wereld: 'geld',    vorm: 'getal',  label: 'bedrag',           uitleg: 'een bedrag in euro' },
  btwTarief:      { wereld: 'geld',    vorm: 'getal',  label: 'btw-tarief',       uitleg: 'het percentage btw' },
  bestemming:     { wereld: 'reizen',  vorm: 'tekst',  label: 'bestemming',       uitleg: 'de plaats waar u heen gaat', gevoelig: true },
  duurDagen:      { wereld: 'reizen',  vorm: 'getal',  label: 'aantal dagen',     uitleg: 'hoe lang u weg bent' },
  aantalPersonen: { wereld: 'sociaal', vorm: 'getal',  label: 'aantal personen',  uitleg: 'met hoeveel mensen' },
  datum:          { wereld: 'overal',  vorm: 'datum',  label: 'datum',            uitleg: 'de dag waar het over gaat' },
  tot:            { wereld: 'overal',  vorm: 'datum',  label: 'tot en met',       uitleg: 'de laatste dag van het tijdvak' }
};

const DAG = /^\d{4}-\d{2}-\d{2}$/;

/* Leest wat een aanroeper aanbiedt. Geeft { velden } of { fout }. Een onbekend
   veld is een FOUT en wordt niet genegeerd: negeren betekent dat een aanroeper
   denkt iets mee te geven wat nooit aankomt. */
function leesVelden(ruw) {
  if (!ruw || typeof ruw !== 'object' || Array.isArray(ruw)) return { fout: 'Geef een object met velden mee.' };
  const namen = Object.keys(ruw);
  if (!namen.length) return { fout: 'Er zijn geen velden meegegeven. Zonder waarden is er niets over te dragen.' };
  if (namen.length > 6) return { fout: 'Een handeling draagt hooguit zes velden. Meer is geen handeling maar een profiel.' };
  const uit = {};
  for (const n of namen) {
    const v = VELDEN[n];
    if (!v) return { fout: 'Het veld "' + n + '" bestaat niet. Er zijn er ' + Object.keys(VELDEN).length + ': ' + Object.keys(VELDEN).join(', ') + '.' };
    const w = ruw[n];
    if (v.vorm === 'getal') {
      const g = Number(w);
      if (!Number.isFinite(g) || g < 0 || g > 1e9) return { fout: 'Het veld "' + n + '" is een getal van 0 tot 1000000000.' };
      uit[n] = g;
    } else if (v.vorm === 'datum') {
      const d = String(w || '').slice(0, 10);
      if (!DAG.test(d)) return { fout: 'Het veld "' + n + '" is een datum als jjjj-mm-dd.' };
      uit[n] = d;
    } else {
      const t = String(w == null ? '' : w).trim().slice(0, 60);
      if (!t) return { fout: 'Het veld "' + n + '" is leeg.' };
      /* GEEN IDENTIFICATOR. Deze weg draagt getallen, datums en plaatsnamen. Wat
         op een e-mailadres, telefoonnummer of iban lijkt, komt er niet door --
         niet omdat het scherm het niet zou tonen, maar omdat een app van derden
         langs deze weg nooit iets krijgt waarmee hij een mens kan vinden. */
      if (/@|\+?\d{9,}|[A-Z]{2}\d{2}[A-Z0-9]{10,}/i.test(t)) {
        return { fout: 'Het veld "' + n + '" lijkt een contactgegeven of rekeningnummer te bevatten. Deze weg draagt alleen waarden waarmee niemand te vinden is.' };
      }
      uit[n] = t;
    }
  }
  return { velden: uit };
}

/* Hoe een waarde eruitziet voor een mens. Dat gebeurt HIER en niet in het
   scherm: dezelfde waarde wordt op meer dan een plek getoond, en een bedrag dat
   op het ene scherm "184.5" heet en op het andere "184,50" is twee waarheden
   over hetzelfde getal. */
function tekstVan(naam, waarde) {
  if (naam === 'bedrag') return 'EUR ' + Number(waarde).toFixed(2).replace('.', ',');
  if (naam === 'btwTarief') return Number(waarde) + '%';
  if (naam === 'duurDagen') return Number(waarde) + (Number(waarde) === 1 ? ' dag' : ' dagen');
  if (naam === 'aantalPersonen') return Number(waarde) + (Number(waarde) === 1 ? ' persoon' : ' personen');
  return String(waarde);
}

/* Wat het LID te zien krijgt: elk veld met zijn label, zijn uitleg en de waarde
   voluit. Geen samenvatting en geen "en 3 andere gegevens" -- wie bevestigt,
   hoort alles te zien waar hij ja op zegt. */
function toonbaar(velden) {
  return Object.keys(velden || {}).map(n => ({
    veld: n, label: VELDEN[n].label, uitleg: VELDEN[n].uitleg,
    wereld: VELDEN[n].wereld, gevoelig: !!VELDEN[n].gevoelig,
    waarde: velden[n], tekst: tekstVan(n, velden[n])
  }));
}

function maakContext({ S, save, nu }) {
  function pot() {
    const s = S();
    if (!s.overdracht || typeof s.overdracht !== 'object') s.overdracht = {};
    return s.overdracht;
  }
  const verlopen = (o) => Date.parse(nu()) - Date.parse(o.at) > GELDIG_MS;

  /* Opruimen gebeurt bij het aanraken en niet met een timer: een taak die alleen
     bestaat om iets weg te gooien, is een taak die stilvalt zonder dat iemand
     het merkt. */
  function schoon(key) {
    const p = pot();
    const rij = p[String(key)] || {};
    for (const id of Object.keys(rij)) if (verlopen(rij[id]) || rij[id].gelezen) delete rij[id];
    const over = Object.keys(rij).sort((a, b) => (rij[a].at < rij[b].at ? -1 : 1));
    while (over.length > MAX_OPEN) delete rij[over.shift()];
    p[String(key)] = rij;
    return rij;
  }

  /* KLAARZETTEN. Er gebeurt hier niets richting de app: er ligt alleen iets
     klaar dat het lid kan bevestigen. Dat onderscheid is de hele laag. */
  function klaarzet(key, sleutel, ruweVelden) {
    const v = leesVelden(ruweVelden);
    if (v.fout) return { status: 400, error: v.fout };
    const rij = schoon(key);
    const id = crypto.randomBytes(9).toString('hex');
    rij[id] = { id, sleutel: String(sleutel || ''), velden: v.velden, at: nu(), gelezen: false };
    save();
    return { status: 200, ok: true, id, sleutel: rij[id].sleutel, toont: toonbaar(v.velden),
      let: 'Klaargezet. Het lid ziet deze waarden en beslist zelf of ze naar de app gaan; zolang hij dat niet doet, krijgt de app niets.' };
  }

  /* LEZEN OM TE TONEN. Dit verbruikt de overdracht NIET: het lid moet kunnen
     kijken voordat hij beslist. */
  function lees(key, id) {
    const o = schoon(key)[String(id || '')];
    if (!o) return { status: 404, error: 'Er staat niets klaar om door te geven. Misschien is het verlopen of al doorgegeven; het geldt een kwartier en een keer.' };
    return { status: 200, ok: true, id: o.id, sleutel: o.sleutel, toont: toonbaar(o.velden),
      let: 'Dit gaat naar de app zodra u het doorgeeft. De app ziet niet wie u bent en niet waar dit vandaan komt.' };
  }

  /* DOORGEVEN. Een keer, en daarna weg. De aanroeper hiervan is het LID zelf:
     de route hangt aan zijn sessie en aan deze id, en er is geen weg waarlangs
     een app zijn eigen overdracht kan ophalen. */
  function geef(key, id, sleutel) {
    const rij = schoon(key);
    const o = rij[String(id || '')];
    if (!o) return { status: 404, error: 'Er staat niets klaar om door te geven. Misschien is het verlopen of al doorgegeven; het geldt een kwartier en een keer.' };
    if (sleutel && o.sleutel && String(sleutel) !== o.sleutel) {
      return { status: 403, error: 'Deze waarden waren klaargezet voor een andere app.' };
    }
    o.gelezen = true;
    save();
    return { status: 200, ok: true, sleutel: o.sleutel, velden: o.velden, toont: toonbaar(o.velden) };
  }

  return { klaarzet, lees, geef, VELDEN, toonbaar, leesVelden, GELDIG_MS };
}

module.exports = { maakContext, VELDEN, toonbaar, tekstVan, leesVelden, GELDIG_MS };
