/* Kern-module "levenslijn": EEN lijn door een leven (LEVEN.md par. 1.1).

   Wat dit is, in een zin: een vaste tabel met levensfasen (./fasen.js), echte
   bronnen die daar aanwijzingen voor leveren (./aanwijzingen.js), en een motor
   die daar per fase EEN staat van maakt -- geweest, nu, komt, of nvt.

   Wat dit NIET is, en niet mag worden:

   1. GEEN VOORTGANG. Er bestaat geen "achterlopen" en geen volgorde die af
      moet. Wie geen studie, geen kinderen of geen pensioen heeft, MIST NIETS.
      Fasen zonder aanwijzing krijgen 'nvt' en het scherm laat ze weg; ze staan
      er niet grijs bij als een gemiste stap. Zie de kop van ./fasen.js: dat
      is de regel die de volgende lezer anders vanzelf breekt.
   2. GEEN RANGSCHIKKING. Geen cijfer, geen percentiel, geen teller over hoeveel
      fasen er "af" zijn (LEVEN.md par. 2.4). Wat hier uitkomt is nooit invoer
      voor toegang, prijs, voorrang of aanname.
   3. GEEN HANDELING. Deze laag voert NIETS uit. Er is geen enkele schrijfroute
      die namens de mens handelt, en de niveaus die de cockpit kent zijn
      daarom alleen 'kijken' en 'openen'. Dat is het verschil met GELD.md
      par. 3: RTG Geld mag uitvoeren binnen regels, het Life OS opent alleen.
   4. GEEN TWEEDE OPSLAG. Alles wordt elke keer opnieuw afgeleid uit de apps
      die de waarheid beheren -- dezelfde afspraak als kern/levensgraaf en
      kern/geldgraaf. Deze module heeft geen eigen collectie en schrijft nooit.

   De kern wordt LAAT gelezen (in de functies), zodat de mountvolgorde van de
   kernlagen er niet toe doet. */
'use strict';

const { FASEN, RANG } = require('./fasen');
const { huidigJaar } = require('./hulp');

module.exports = ({ kern }) => {
  const aanwijzingen = require('./aanwijzingen')({ kern });

  /* De staat die EEN aanwijzing oplevert. Een bron mag alleen 'geweest' of
     'nu' zeggen (zie ./hulp.js); 'komt' wordt hier afgeleid, en alleen uit een
     jaartal dat nog moet komen. Dat is de enige eerlijke bron van 'komt': een
     ladder die zegt wat er "normaal" na vwo komt, is geen waarneming maar een
     norm, en die hoort niet op iemands levenslijn. */
  function staatVan(spoor, jaarNu) {
    if (spoor.vanaf !== null && spoor.vanaf > jaarNu) return 'komt';
    return spoor.staat;
  }

  /* Een fase uit zijn aanwijzingen. Geen aanwijzingen is 'nvt', en dat loopt
     langs dezelfde trap als de rest (RANG kent 'nvt' als hoogste), zodat er
     nergens een apart pad bestaat waar per ongeluk een 'komt' uit rolt. */
  function bouwFase(def, eigen, jaarNu) {
    let staat = 'nvt';
    let vanaf = null;
    let sinds = null;
    const gegevens = [];
    for (const s of eigen) {
      const st = staatVan(s, jaarNu);
      if (RANG[st] < RANG[staat]) staat = st;
      if (s.vanaf !== null && (vanaf === null || s.vanaf < vanaf)) vanaf = s.vanaf;
      if (st === 'nu' && s.sinds && (sinds === null || s.sinds < sinds)) sinds = s.sinds;
      const regel = s.bron + ': ' + s.wat;
      if (s.wat && !gegevens.includes(regel)) gegevens.push(regel);
    }
    return {
      id: def.id, naam: def.naam, staat, vanaf,
      toelichting: def.toelichting,
      /* De groepen reizen mee als LENS voor het scherm en zijn hier nooit een
         filter: `fasen` bevat altijd alle tien. Zie de kop van ./fasen.js. */
      groepen: def.groepen.slice(),
      /* Elke bewering met de gebruikte gegevens erbij (LEVEN.md par. 2.10).
         Begrensd, want een fase met dertig regels leest niemand meer na, en
         een uitleg die niemand leest is geen uitleg. */
      gegevens: gegevens.slice(0, 6),
      sinds
    };
  }

  /* WELKE FASE HET SCHERM ALS "NU" AANSPREEKT. Meerdere fasen kunnen tegelijk
     spelen -- studie en werk en een relatie is een heel gewoon leven -- en ze
     staan alle drie in `fasen`. Dit is puur de keuze waarmee de cockpit mag
     groeten, en nadrukkelijk geen oordeel over welke fase "de belangrijkste"
     is.

     De keuze volgt de GEGEVENS en niet de tabel: de fase die het kortst
     geleden begon. Zou hier de tabelvolgorde staan, dan zou "verderop in de
     lijst" stilzwijgend "verder in het leven" gaan betekenen, en dat is de
     norm die deze laag niet heeft. Alleen als geen enkele spelende fase een
     datum kent, valt hij terug op leesvolgorde. */
  function nuVan(fasen) {
    const spelend = fasen.filter(f => f.staat === 'nu');
    if (!spelend.length) return { faseId: null, sinds: null };
    const metDatum = spelend.filter(f => f.sinds);
    const gekozen = metDatum.length
      ? metDatum.reduce((a, b) => (b.sinds > a.sinds ? b : a))
      : spelend[0];
    return { faseId: gekozen.id, sinds: gekozen.sinds || null };
  }

  /* De vijf RTF-groepen als weergavelens (mini/kind/tiener/jong/volw). Ze
     komen uit foundation/gezinshulp.js langs rtf.groepen(), zodat er hier geen
     tweede lijst met leeftijdsgroepen ontstaat (LAT.md regel 4).

     ER WORDT ER GEEN GEKOZEN. Het lid kiest zijn eigen lens; de server leidt
     hem niet af uit een leeftijd. Zou hij dat wel doen, dan bepaalt een
     geboortedatum wat iemand te zien krijgt, en dan is de lens een poort
     (LEVEN.md par. 2.2). */
  function weergaveVan(stil) {
    try {
      const g = kern.rtf.groepen();
      return Array.isArray(g) ? g : [];
    } catch (e) {
      if (!stil.includes('rtf')) stil.push('rtf');
      return [];
    }
  }

  /* De lijn zelf, een keer opgebouwd. lijn() en feiten() delen hem, zodat het
     werk niet twee keer gebeurt en -- belangrijker -- zodat ze nooit een
     verschillend beeld van hetzelfde leven kunnen tonen. */
  function bouw(key) {
    const v = aanwijzingen.verzamel(key);
    const stil = v.stil.slice();
    const jaarNu = huidigJaar();
    const perFase = new Map(FASEN.map(f => [f.id, []]));
    for (const s of v.sporen) {
      if (perFase.has(s.fase)) perFase.get(s.fase).push(s);
    }
    const fasen = FASEN.map(def => bouwFase(def, perFase.get(def.id), jaarNu));
    return { fasen, nu: nuVan(fasen), stil, bronnen: v.bronnen };
  }

  /* ---- de twee uitgangen ---- */

  /* De lijn: het contract van POST /api/leven/lijn, zonder `ok` (dat zet de
     route erbij). Alle tien de fasen komen terug, ook de 'nvt'-fasen: het
     WEGLATEN is een schermkeuze, en een server die alvast snijdt maakt van een
     weergavekeuze een besluit. */
  function lijn(key) {
    const b = bouw(key);
    return { fasen: b.fasen, nu: b.nu, weergave: weergaveVan(b.stil), stil: b.stil, bronnen: b.bronnen };
  }

  /* Een termijn uit de Control Tower, klein gemaakt voor het scherm. De
     levensgraaf heeft de datums al geteld en gesorteerd; hier wordt alleen
     gekozen wat er mee naar buiten gaat. */
  function termijn(r, venster) {
    return {
      id: r.id,
      titel: (r.waarvan ? r.waarvan + ' - ' : '') + r.naam,
      wat: r.wat, wanneer: r.datum, dagen: r.dagen,
      venster, bron: r.bron, zwaar: !!r.zwaar
    };
  }

  /* Wat er NU speelt en wat eraan komt.

     De vier vensters plus achterstallig komen ONGEWIJZIGD uit
     kern/levensgraaf/termijnen.js. Die motor kent ze al, inclusief de regel
     dat een termijn in het EERSTE passende venster valt en niet in alle vier;
     hem hier nabouwen zou een tweede telling opleveren die stil uit de pas
     loopt (LAT.md regel 4).

     `speelt` komt van de andere kant: dat zijn de fasen met staat 'nu'. Samen
     beantwoorden ze de twee vragen van het levens-command-center (LEVEN.md
     par. 1.5): wat speelt er, en wat komt eraan. De derde vraag -- moet ik
     iets doen -- wordt in de cockpit beantwoord en niet hier, want daar horen
     de niveaus 'kijken' en 'openen' bij. */
  function feiten(key) {
    const b = bouw(key);
    const stil = b.stil;
    let tower = null;
    try { tower = kern.levensgraaf.tower(key); }
    catch (e) { if (!stil.includes('levensgraaf')) stil.push('levensgraaf'); }

    const komt = [];
    for (const v of ((tower && tower.vensters) || [])) {
      for (const r of (v.items || [])) komt.push(termijn(r, v.sleutel));
    }
    const achterstallig = (((tower && tower.achterstallig) || [])).map(r => termijn(r, 'achterstallig'));

    const speelt = b.fasen.filter(f => f.staat === 'nu')
      .map(f => ({ id: f.id, naam: f.naam, sinds: f.sinds, gegevens: f.gegevens }));

    return {
      speelt, komt, achterstallig,
      /* Precies de telling van het cockpit-contract. Drie aantallen, en geen
         vierde dat over de mens gaat: hoeveel fasen "af" zijn is geen getal
         dat dit huis berekent (LEVEN.md par. 2.4). */
      telling: { speelt: speelt.length, komt: komt.length, achterstallig: achterstallig.length },
      lijn: { fasen: b.fasen, nu: b.nu },
      stil, bronnen: b.bronnen
    };
  }

  return { levenslijn: { lijn, feiten } };
};
