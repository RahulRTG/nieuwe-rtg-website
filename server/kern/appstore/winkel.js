/* ============================================================================
   DE WINKELKANT -- wat een LID van de App Store ziet, kiest en verleent.

   DE REGEL DIE DIT BESTAND STUURT: VRAGEN EN VERLENEN ZIJN TWEE DINGEN.

   Het manifest van een app VRAAGT machtigingen; het lid VERLEENT ze, stuk voor
   stuk, en kan er later een intrekken zonder de app te verwijderen. Daarom staan
   ze ook apart opgeslagen. Een winkel die installeren en toestemming tot een
   knop maakt, heeft geen toestemming maar een drempel gemaakt.

   TWEE DINGEN DIE HIER MET OPZET NIET GEBEUREN.

   Er staat geen beoordeling, geen sterrensysteem en geen ranglijst. CLAUDE.md
   verbiedt kunstmatige urgentie en ranglijsten buiten het potje; een winkel
   waarin apps elkaar verdringen, is precies zo'n mechaniek. Wat er wel staat is
   wat een app doet, van wie hij is, wat hij vraagt en wanneer hij is gekeurd.

   En er staat geen prijs. Alles in de App Store is voor leden inbegrepen bij de
   pas -- dezelfde regel als de bestaande App-Bibliotheek (kern/appbieb.js). Een
   betaald kanaal voor derden is een besluit van de eigenaar en geen veld dat
   hier vast alvast op nul staat; wat dat besluit inhoudt staat in APPSTORE.md
   onder "de open beslissing".
   ========================================================================== */
'use strict';

const { toonbaar, isMachtiging } = require('./machtigingen');

const MAX_PER_LID = 60;

function maakWinkel(kern) {
  const { S, app, versie, uitgever, publiekV, eigen, nu, boek } = kern;
  const save = kern.save;

  const live = () => Object.values(S().apps).filter(a => a.live && versie(a.live) && versie(a.live).status === 'gepubliceerd');

  /* Wat een lid over een app te zien krijgt VOORDAT hij iets verleent. De
     uitgever staat er met naam bij: een app zonder aanspreekbare partij erachter
     hoort niet in een officiele store. */
  function kaart(a, key) {
    const v = versie(a.live);
    const u = uitgever(a.org);
    const verleend = verleendeVan(key, a.sleutel);
    return {
      sleutel: a.sleutel, naam: v.manifest.naam, uitleg: v.manifest.uitleg,
      categorie: v.manifest.categorie, taal: v.manifest.taal, versie: v.manifest.versie,
      uitgever: u ? { org: u.org, naam: u.naam } : null,
      vraagt: toonbaar(v.manifest.machtigingen),
      gekeurd: v.besluit ? v.besluit.at : v.at,
      grootte: v.maten ? v.maten.totaal : null,
      icoon: v.manifest.icoon ? celPad(a.sleutel, v.hash, v.manifest.icoon) : null,
      bron: 'derden',
      geinstalleerd: !!verleend,
      verleend: verleend ? toonbaar(verleend.machtigingen) : []
    };
  }

  const celPad = (sleutel, hash, pad) => '/appcel/' + sleutel + '/' + hash + '/' + pad;

  function catalogus({ zoek, categorie, pagina, per } = {}, key) {
    const q = String(zoek || '').toLowerCase().trim().slice(0, 60);
    const c = String(categorie || '').trim();
    let alles = live().map(a => kaart(a, key));
    if (c) alles = alles.filter(a => a.categorie === c);
    if (q) alles = alles.filter(a => (a.naam + ' ' + a.uitleg + ' ' + (a.uitgever ? a.uitgever.naam : '')).toLowerCase().includes(q));
    alles.sort((x, y) => (x.naam.toLowerCase() < y.naam.toLowerCase() ? -1 : 1));
    const p = Math.max(1, Math.min(1000, Number(pagina) || 1));
    const n = Math.max(1, Math.min(48, Number(per) || 24));
    return { items: alles.slice((p - 1) * n, (p - 1) * n + n), totaal: alles.length, pagina: p,
      paginas: Math.max(1, Math.ceil(alles.length / n)) };
  }

  /* ------------------------------------------------------ verlenen en intrekken */

  function rijVan(key) {
    const v = S().verleend;
    const k = String(key || '');
    if (!v[k] || typeof v[k] !== 'object') v[k] = {};
    return v[k];
  }
  const verleendeVan = (key, sleutel) => (key ? eigen(rijVan(key), sleutel) : null);

  /* Installeren MET de keuze erbij. `machtigingen` is wat het lid aanvinkt; alles
     wat de app niet vroeg valt weg, en alles wat het lid niet aanvinkte ook. Een
     lege lijst is een geldige keuze: de app werkt dan zonder. */
  function installeer(key, sleutel, gekozen) {
    const a = app(sleutel);
    if (!a || !a.live) return { status: 404, error: 'Deze app staat niet in de App Store.' };
    const v = versie(a.live);
    if (!v || v.status !== 'gepubliceerd') return { status: 404, error: 'Deze app staat niet in de App Store.' };
    const rij = rijVan(key);
    if (!eigen(rij, sleutel) && Object.keys(rij).length >= MAX_PER_LID) {
      return { status: 400, error: 'Je hebt het maximum van ' + MAX_PER_LID + ' apps van derden bereikt; haal er eerst een weg.' };
    }
    const gevraagd = v.manifest.machtigingen;
    const lijst = (Array.isArray(gekozen) ? gekozen : []).map(String)
      .filter(m => isMachtiging(m) && gevraagd.includes(m));
    const uniek = [...new Set(lijst)];
    rij[sleutel] = { machtigingen: uniek, at: nu(), versie: v.id };
    save();
    return { status: 200, ok: true, sleutel, verleend: toonbaar(uniek), vraagt: toonbaar(gevraagd),
      let: uniek.length < gevraagd.length
        ? 'Je hebt ' + uniek.length + ' van de ' + gevraagd.length + ' gevraagde machtigingen verleend. De app werkt; wat hij niet mag, krijgt hij niet.'
        : 'De app heeft wat hij vroeg. Je kunt elke machtiging later los intrekken zonder de app te verwijderen.' };
  }

  /* De machtigingen bijstellen zonder de app te verwijderen. Dit is de reden dat
     verlenen en installeren apart staan. */
  function verleen(key, sleutel, gekozen) {
    const huidig = verleendeVan(key, sleutel);
    if (!huidig) return { status: 404, error: 'Deze app staat niet op je startscherm.' };
    const a = app(sleutel); const v = a && a.live ? versie(a.live) : null;
    const gevraagd = v ? v.manifest.machtigingen : huidig.machtigingen;
    const uniek = [...new Set((Array.isArray(gekozen) ? gekozen : []).map(String).filter(m => isMachtiging(m) && gevraagd.includes(m)))];
    const weg = huidig.machtigingen.filter(m => !uniek.includes(m));
    huidig.machtigingen = uniek; huidig.at = nu();
    save();
    return { status: 200, ok: true, verleend: toonbaar(uniek), ingetrokken: toonbaar(weg) };
  }

  /* Verwijderen haalt de app van je startscherm EN haalt elke machtiging weg. Wat
     de app voor jou had opgeslagen blijft staan -- dat is jouw inhoud, niet die
     van de app -- en is er weer als je hem terugzet. Wie het echt weg wil, gooit
     het weg met wisOpslag; dat staat als eigen handeling in de app-kaart. */
  function verwijder(key, sleutel) {
    const rij = rijVan(key);
    if (!eigen(rij, sleutel)) return { status: 404, error: 'Deze app staat niet op je startscherm.' };
    delete rij[String(sleutel)];
    save();
    return { status: 200, ok: true, aantal: Object.keys(rij).length };
  }

  function wisOpslag(key, sleutel) {
    const bak = eigen(S().opslag, sleutel);
    if (bak && Object.prototype.hasOwnProperty.call(bak, String(key))) { delete bak[String(key)]; save(); }
    const bakjes = eigen(S().bakjes, String(key));
    if (bakjes && Object.prototype.hasOwnProperty.call(bakjes, String(sleutel))) { delete bakjes[String(sleutel)]; save(); }
    return { status: 200, ok: true };
  }

  /* Mijn apps. Een ingetrokken of geschorste app valt hier VANZELF weg: er wordt
     niets opgeruimd bij het intrekken, want opruimen is een tweede plek waar de
     waarheid kan achterlopen (LAT-regel 4). De verlening blijft staan zodat een
     nieuwe versie van dezelfde app niet opnieuw om alles hoeft te vragen. */
  function mijn(key) {
    const rij = rijVan(key);
    const uit = [];
    for (const sleutel of Object.keys(rij)) {
      const a = app(sleutel);
      if (!a || !a.live) continue;
      const v = versie(a.live);
      if (!v || v.status !== 'gepubliceerd') continue;
      uit.push(kaart(a, key));
    }
    return uit.sort((x, y) => (x.naam.toLowerCase() < y.naam.toLowerCase() ? -1 : 1));
  }

  /* Wat de celpagina nodig heeft om een app te openen. Hier en nergens anders
     wordt bepaald WELKE bundel er draait: de celroute leest dit niet uit de URL
     maar controleert hem hiertegen. */
  function open(key, sleutel) {
    const a = app(sleutel);
    if (!a || !a.live) return { status: 404, error: 'Deze app is niet (meer) beschikbaar.' };
    const v = versie(a.live);
    if (!v || v.status !== 'gepubliceerd') return { status: 404, error: 'Deze app is niet (meer) beschikbaar.' };
    const verleend = verleendeVan(key, sleutel);
    if (!verleend) return { status: 403, error: 'Zet deze app eerst in de App Store op je startscherm; dan kies je ook wat hij mag.' };
    const u = uitgever(a.org);
    return { status: 200, ok: true, sleutel, hash: v.hash, start: celPad(sleutel, v.hash, v.manifest.start),
      naam: v.manifest.naam, versie: v.manifest.versie, taal: v.manifest.taal,
      uitgever: u ? { org: u.org, naam: u.naam } : null,
      verleend: toonbaar(verleend.machtigingen), machtigingen: verleend.machtigingen };
  }

  /* De poort van de celroute: mag deze hash van deze app uberhaupt uitgeleverd
     worden? Alleen de LIVE hash van een gepubliceerde app. Een ingetrokken versie
     is daarmee op hetzelfde moment onbereikbaar als hij uit de winkel valt -- dat
     is wat grens 5 in de praktijk betekent. */
  function magCel(sleutel, hash) {
    const a = app(sleutel);
    if (!a || !a.live) return false;
    const v = versie(a.live);
    return !!v && v.status === 'gepubliceerd' && v.hash === String(hash || '');
  }

  return { catalogus, installeer, verleen, verwijder, wisOpslag, mijn, open, magCel, verleendeVan, celPad, MAX_PER_LID };
}

module.exports = { maakWinkel, MAX_PER_LID };
