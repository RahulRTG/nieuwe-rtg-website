/* RTMAIL: de AI-hulp bij een gesprek -- samenvatten, actiepunten, en uitleggen
   waarom iets op phishing lijkt.

   DE REGEL DIE DIT HELE BESTAND VORMT: elke bewering draagt de HERKOMST mee.
   Een samenvatting zonder verwijzing is een tweede versie van de waarheid, en
   die kan de lezer niet nakijken. Alles wat hier terugkomt, noemt het
   bericht-id waar het vandaan komt, zodat het scherm terug kan springen naar de
   oorspronkelijke post. Dat is geen extraatje maar de voorwaarde waaronder een
   samenvatting mag bestaan.

   WAT DEZE LAAG NOOIT DOET, en dat staat hier omdat een AI-laag die het niet
   opschrijft het vroeg of laat toch doet:

     - geen betaling bevestigen of een bedrag goedkeuren;
     - geen contract accepteren of een toezegging namens iemand doen;
     - niets naar buiten sturen;
     - geen bericht verwijderen of verplaatsen;
     - een phishing-waarschuwing nooit onderdrukken omdat de tekst aardig klinkt.

   Deze laag LEEST en VAT SAMEN. Elk gevolg -- antwoorden, betalen, opbergen --
   blijft een handeling van een mens langs de gewone poorten.

   GEEN TAALMODEL NODIG. Wat hier staat is telwerk en patroonherkenning op de
   tekst die er al is. De AI-laag (routes/rtmail.js, anthropic) mag er een
   mooiere zin van maken; valt die weg, dan blijft dit werken. Een hulp die
   alleen bestaat als er een sleutel in de omgeving staat, is geen hulp. */
const adresLaag = require('./rtmail-adres');

/* Woorden die een ACTIE aankondigen. Bewust klein en Nederlands: een lange
   lijst met gokken levert meer valse actiepunten op dan gemiste, en een
   actielijst waar rommel in staat, leest niemand een tweede keer. */
const ACTIE_WOORDEN = ['graag', 'kun je', 'kunt u', 'wil je', 'wilt u', 'verzoek', 'aub', 'a.u.b.',
  'deadline', 'uiterlijk', 'voor ', 'reactie', 'antwoord', 'bevestig', 'akkoord', 'ondertekenen'];
/* Wat een bericht VERDACHT maakt. Elk punt is een uitleg, geen score: "risico
   7,4" zegt een lezer niets, "dit bericht vraagt om een wachtwoord" wel. */
const VERDACHT = [
  { patroon: /wachtwoord|inlog(gegevens)?|pincode|verificatiecode|tweefactor/i,
    uitleg: 'Dit bericht vraagt om inloggegevens. RTG vraagt daar nooit per post om.' },
  { patroon: /iban|rekeningnummer|overmaken|betaal(verzoek|link)?|spoedbetaling/i,
    uitleg: 'Er wordt om een betaling of een rekeningnummer gevraagd. Bel de tegenpartij op een nummer dat u zelf opzoekt.' },
  { patroon: /binnen 24 uur|vandaag nog|direct handelen|anders wordt.*geblokkeerd|laatste waarschuwing/i,
    uitleg: 'Er wordt haast gemaakt. Kunstmatige urgentie is het meest gebruikte drukmiddel bij oplichting.' },
  { patroon: /klik hier|klik op de link|open de bijlage/i,
    uitleg: 'Er wordt aangedrongen op klikken. Bij een niet-geverifieerde afzender zijn links hier sowieso onklikbaar.' }
];
const DATUM_RE = /\b(\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?|\d{4}-\d{2}-\d{2}|(?:maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)|(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december))\b/gi;

module.exports = ({ rtmail, vak }) => {
  const zin = (t) => String(t || '').replace(/\s+/g, ' ').trim();
  const kort = (t, n) => (zin(t).length > n ? zin(t).slice(0, n - 1) + '…' : zin(t));

  /* De samenvatting van EEN gesprek. Geeft per punt het bericht-id mee. Wat
     er niet in staat: een oordeel over wie gelijk heeft, en een voorspelling
     van wat er gaat gebeuren. */
  function samenvatting(berichten, adres) {
    const rijen = (berichten || []).slice().sort((a, b) => String(a.at).localeCompare(String(b.at)));
    if (!rijen.length) return { error: 'Er is niets samen te vatten.' };
    const deelnemers = [...new Set(rijen.flatMap(m => [m.van, m.naar]))];
    const vanMij = rijen.filter(m => adres && adresLaag.zelfdeBus(m.van, adres)).length;
    const punten = rijen.map(m => ({
      bericht: m.id, at: m.at, van: m.van,
      zin: kort(m.onderwerp + ': ' + m.tekst, 160),
      vanMij: !!(adres && adresLaag.zelfdeBus(m.van, adres))
    }));
    const laatste = rijen[rijen.length - 1];
    return {
      ok: true,
      aantal: rijen.length, deelnemers, vanMij, vanAnderen: rijen.length - vanMij,
      begonnen: rijen[0].at, laatste: laatste.at,
      laatsteVan: laatste.van,
      aanZet: adres && adresLaag.zelfdeBus(laatste.van, adres) ? 'de ander' : 'u',
      punten,
      let: 'Elk punt draagt het bericht-id waar het vandaan komt, zodat u kunt terugspringen naar de oorspronkelijke post. Een samenvatting die dat niet doet, is een tweede versie van de waarheid.'
    };
  }

  /* Actiepunten. Alleen zinnen die er ECHT om vragen, met het bericht erbij.
     Een lege lijst is een geldig antwoord: liever niets dan verzonnen werk. */
  function acties(berichten, adres) {
    const uit = [];
    for (const m of berichten || []) {
      if (adres && adresLaag.zelfdeBus(m.van, adres)) continue;   // uw eigen post is geen actie voor u
      for (const s of String(m.tekst || '').split(/(?<=[.!?])\s+|\n+/)) {
        const t = zin(s);
        if (t.length < 8 || t.length > 240) continue;
        const laag = t.toLowerCase();
        if (!ACTIE_WOORDEN.some(w => laag.includes(w))) continue;
        const datums = [...new Set((t.match(DATUM_RE) || []).map(x => x.toLowerCase()))];
        uit.push({ bericht: m.id, van: m.van, at: m.at, zin: kort(t, 200), datums });
        if (uit.length >= 20) return klaar(uit);
      }
    }
    return klaar(uit);
  }
  const klaar = (uit) => ({ ok: true, aantal: uit.length, acties: uit,
    let: uit.length ? 'Dit zijn ZINNEN uit de post, niet een interpretatie ervan. Elk actiepunt verwijst naar het bericht waar het in staat.'
                    : 'Geen enkele zin in deze post vraagt duidelijk om iets. Liever niets dan verzonnen werk.' });

  /* Waarom lijkt dit op phishing? Geeft REDENEN, geen cijfer. En de zwaarste
     reden staat vooraan: een niet-geverifieerde afzender. */
  function risico(m) {
    if (!m) return { error: 'Dat bericht bestaat niet.' };
    const redenen = [];
    if (!m.vertrouwd) redenen.push({ zwaar: true,
      uitleg: 'De afzender is niet geverifieerd. Links zijn daarom onklikbaar en bijlagen bestaan hier niet.' });
    const links = (m.links && m.links.externeLinks) || [];
    if (links.length) redenen.push({ zwaar: !m.vertrouwd,
      uitleg: 'Er staan ' + links.length + ' externe link(s) in.', links: links.slice(0, 8) });
    if (m.links && m.links.gevaarlijk) redenen.push({ zwaar: true,
      uitleg: 'Er staat een link met een gevaarlijk schema in (javascript:, data:, file:). Dat is nooit legitiem in post.' });
    for (const v of VERDACHT) if (v.patroon.test(String(m.tekst || '') + ' ' + String(m.onderwerp || ''))) {
      redenen.push({ zwaar: !m.vertrouwd, uitleg: v.uitleg });
    }
    return { ok: true, bericht: m.id, vertrouwd: !!m.vertrouwd,
      redenen: redenen.sort((a, b) => (b.zwaar ? 1 : 0) - (a.zwaar ? 1 : 0)),
      oordeel: redenen.some(r => r.zwaar) ? 'wees voorzichtig' : (redenen.length ? 'let op' : 'niets bijzonders gevonden'),
      let: 'Dit zijn redenen, geen score. Een cijfer zegt een lezer niets; een reden kan hij zelf nakijken. En let op: "niets gevonden" is geen garantie.' };
  }

  return { samenvatting, acties, risico, ACTIE_WOORDEN, VERDACHT };
};
