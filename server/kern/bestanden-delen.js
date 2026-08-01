/* RTG Bestanden, deel twee: delen op codenaam (samen aan hetzelfde bestand
   werken), de versiegeschiedenis en de prullenbak. De basis (opslag, mappen,
   quotum) staat in ./bestanden.js en geeft zijn helpers hier door. */

/* MIME-types die in een browser uit zichzelf iets kunnen doen. Ze mogen de
   kluis in -- het is de kluis van het lid -- maar komen er als kale bytes weer
   uit, zodat een gedeeld bestand nooit als uitvoerbare pagina opengaat. */
const ACTIEF = /^(text\/html|application\/xhtml\+xml|image\/svg\+xml|text\/xml|application\/xml|.*javascript.*)$/i;
const ONSCHULDIG = (m) => (ACTIEF.test(String(m || '')) ? 'application/octet-stream' : String(m || 'application/octet-stream'));

function maakBestandenDelen(basis) {
  const { save, keyVanCodenaam, codenaamVan, sseToCustomer,
    bord, vind, magErbij, schrijfBytes, leesBytes, wisBytes, wisItem, gebruik, nu,
    QUOTUM, MAX_BESTAND, MAX_VERSIES, scanOk } = basis;

  /* ---- delen op codenaam: de ander kijkt, haalt op en zet nieuwe versies ---- */
  async function deel(key, bid, codenaam, aan) {
    const b = bord(key);
    const it = b.items.find(x => x.id === String(bid || ''));
    if (!it) return { status: 404, error: 'Dat bestand staat niet in uw kluis.' };
    const code = String(codenaam || '').trim();
    if (!code) return { status: 400, error: 'Geef een codenaam op.' };
    if (code === codenaamVan(key)) return { status: 400, error: 'Met uzelf delen hoeft niet; het is al van u.' };
    it.gedeeldMet = it.gedeeldMet || [];
    if (aan === false) {
      it.gedeeldMet = it.gedeeldMet.filter(c => c !== code); save();
      return { gedeeldMet: it.gedeeldMet };
    }
    const doelKey = await keyVanCodenaam(code);
    if (!doelKey) return { status: 404, error: 'Die codenaam kennen we niet.' };
    if (it.gedeeldMet.length >= 25) return { status: 409, error: 'Een bestand deelt u met hooguit 25 mensen.' };
    if (!it.gedeeldMet.includes(code)) it.gedeeldMet.push(code);
    save();
    try { sseToCustomer(doelKey, 'bestanden', { kind: 'gedeeld', naam: it.naam, van: codenaamVan(key) }); } catch (e) {}
    return { gedeeldMet: it.gedeeldMet };
  }

  /* ---- versies: een nieuwe upload op hetzelfde bestand schuift de oude opzij ---- */
  function versieNieuw(key, bid, dataUrl) {
    const v = vind(String(bid || ''));
    if (!v || !magErbij(key, v)) return { status: 404, error: 'Dat bestand staat niet in uw kluis.' };
    const it = v.item;
    if (it.weg) return { status: 409, error: 'Dit bestand staat in de prullenbak; herstel het eerst.' };
    const m = /^data:([\w.+-]+\/[\w.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
    if (!m) return { status: 400, error: 'Dat is geen leesbaar bestand.' };
    let buf; try { buf = Buffer.from(m[2], 'base64'); } catch (e) { return { status: 400, error: 'Dat is geen leesbaar bestand.' }; }
    if (!buf.length) return { status: 400, error: 'Het bestand is leeg.' };
    if (buf.length > MAX_BESTAND) return { status: 413, error: 'Een bestand mag hooguit 15 MB zijn.' };
    // het quotum is van de eigenaar, ook als een gedeelde de versie plaatst
    if (gebruik(v.eigenaar) + buf.length > QUOTUM) return { status: 413, error: 'De kluis van de eigenaar is vol.' };
    // een nieuwe versie is een vers bestand: dezelfde poort als een upload
    const besmet = scanOk ? scanOk(key, dataUrl) : null;
    if (besmet) return besmet;
    it.versies = it.versies || [];
    it.versies.unshift({ ref: it.ref, bytes: it.bytes, op: it.gewijzigd || it.op, door: it.door || null });
    // meer dan MAX_VERSIES bewaren we niet: de oudste valt eraf, inclusief de bytes
    while (it.versies.length > MAX_VERSIES) wisBytes(it.versies.pop().ref);
    it.ref = schrijfBytes(buf); it.bytes = buf.length; it.mime = m[1];
    it.gewijzigd = nu(); it.door = v.eigenaar === key ? null : codenaamVan(key);
    save();
    if (v.eigenaar !== key) {
      try { sseToCustomer(v.eigenaar, 'bestanden', { kind: 'versie', naam: it.naam, door: codenaamVan(key) }); } catch (e) {}
    }
    return { id: it.id, versies: it.versies.length };
  }
  function versies(key, bid) {
    const v = vind(String(bid || ''));
    if (!v || !magErbij(key, v)) return { status: 404, error: 'Dat bestand staat niet in uw kluis.' };
    return { huidig: { bytes: v.item.bytes, op: v.item.gewijzigd, door: v.item.door || null },
      versies: (v.item.versies || []).map((x, i) => ({ n: i, bytes: x.bytes, op: x.op, door: x.door || null })) };
  }
  // Een oude versie terugzetten: de huidige wordt zelf een versie; er raakt niets kwijt.
  function versieTerug(key, bid, n) {
    const v = vind(String(bid || ''));
    if (!v || !magErbij(key, v)) return { status: 404, error: 'Dat bestand staat niet in uw kluis.' };
    const it = v.item;
    const oud = (it.versies || [])[Number(n)];
    if (!oud) return { status: 404, error: 'Die versie bestaat niet.' };
    it.versies.splice(Number(n), 1);
    it.versies.unshift({ ref: it.ref, bytes: it.bytes, op: it.gewijzigd || it.op, door: it.door || null });
    it.ref = oud.ref; it.bytes = oud.bytes; it.gewijzigd = nu(); it.door = oud.door || null;
    save();
    return { ok: true, versies: it.versies.length };
  }

  /* ---- ophalen: de bytes terug als data-URL (na rechten-check) ---- */
  function haal(key, bid, n) {
    const v = vind(String(bid || ''));
    if (!v || !magErbij(key, v)) return { status: 404, error: 'Dat bestand staat niet in uw kluis.' };
    const it = v.item;
    const bron = n == null ? { ref: it.ref, bytes: it.bytes } : (it.versies || [])[Number(n)];
    if (!bron) return { status: 404, error: 'Die versie bestaat niet.' };
    const buf = leesBytes(bron.ref);
    if (!buf) return { status: 410, error: 'De inhoud is niet meer terug te lezen.' };
    /* WAT ER IN MAG, MAG ER NIET ALS ZICHZELF UIT.

       De kluis neemt elk MIME-type aan, en dat hoort ook: het is de kluis van
       het lid, geen fotoalbum -- een contract, een zip, een exportbestand. Maar
       de kluis is ook DEELBAAR (gedeeldMet), en de teruggave is een data-URL
       waar het MIME-type letterlijk uit het verzoek van de uploader in staat.
       Een data:text/html of data:image/svg+xml die een ander opent, draait
       script; dat is dan wel een null-origin, maar het is een gratis stukje
       vertrouwde-omgeving dat we niemand hoeven te geven. De huidige schermen
       zetten het in een <img> of <audio> en dan gebeurt er niets, maar dat is
       een eigenschap van de schermen van vandaag en geen grendel.

       Het bestand blijft dus precies wat het was; alleen het etiket op de
       terugweg wordt onschadelijk gemaakt voor de types die uit zichzelf iets
       kunnen doen. Downloaden en opslaan werkt gewoon. */
    const mime = ONSCHULDIG(it.mime);
    return { naam: it.naam, mime, bytes: buf.length,
      dataUrl: 'data:' + mime + ';base64,' + buf.toString('base64') };
  }

  /* ---- de prullenbak: een zichtbare la met een klok erop, geen zwart gat ---- */
  function weg(key, bid) {
    const eigen = bord(key).items.find(x => x.id === String(bid || ''));
    if (eigen) {
      if (!eigen.weg) { eigen.weg = true; eigen.wegOp = nu(); save(); return { prullenbak: true }; }
      // tweede keer 'weg' vanuit de prullenbak = echt weg, met inhoud en versies
      wisItem(eigen);
      const b = bord(key); b.items = b.items.filter(x => x.id !== eigen.id); save();
      return { weg: true };
    }
    const v = vind(String(bid || ''));                 // gedeeld: alleen uzelf eraf halen
    if (!v || !magErbij(key, v)) return { status: 404, error: 'Dat bestand staat niet in uw kluis.' };
    const code = codenaamVan(key);
    v.item.gedeeldMet = (v.item.gedeeldMet || []).filter(c => c !== code); save();
    return { ok: true };
  }
  function herstel(key, bid) {
    const it = bord(key).items.find(x => x.id === String(bid || ''));
    if (!it || !it.weg) return { status: 404, error: 'Dat bestand staat niet in de prullenbak.' };
    it.weg = false; it.wegOp = null; save();
    return { ok: true };
  }
  function leegPrullenbak(key) {
    const b = bord(key);
    const weggooien = b.items.filter(x => x.weg);
    for (const it of weggooien) wisItem(it);
    b.items = b.items.filter(x => !x.weg); save();
    return { geleegd: weggooien.length };
  }

  return { bestandenDeel: deel, bestandenVersieNieuw: versieNieuw, bestandenVersies: versies,
    bestandenVersieTerug: versieTerug, bestandenHaal: haal, bestandenWeg: weg,
    bestandenHerstel: herstel, bestandenLeegPrullenbak: leegPrullenbak };
}

module.exports = { maakBestandenDelen };
