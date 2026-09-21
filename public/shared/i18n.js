/* De vertaalkast van de browser: vertaalde interface die een NAVIGATIE overleeft.

   WAAROM DIT EEN EIGEN LAAG IS. De automatische vertaallaag hiernaast hield
   zijn vertalingen in een kale Map in zijn eigen scope, en die is bij elke
   paginawissel weg. Elk van de 313 schermen vroeg de server dus opnieuw de hele
   wereld -- ook de balk, het menu en de knoppen die op ieder scherm hetzelfde
   zeggen. Dat is de reden dat een vertaald huis traag aanvoelde: niet het
   vertalen, maar het opnieuw vertalen van wat we al wisten.

   EEN HUIS, EEN KAST. De sleutelweg (RTGi18n.laadWereldDict) bewaarde zijn
   woordenboek in een TWEEDE opslag, per pad en per aantal sleutels. Dezelfde
   knop op twee schermen werd daardoor twee keer vertaald en twee keer bewaard.
   Daarom staat de kast hier los en niet in een van de twee lagen: beide praten
   met dezelfde voorraad.

   BEGRENSD, want localStorage is klein en gedeeld met de rest van de app. Per
   taal een harde regel- en bytegrens; daarboven valt de oudst ingevoegde regel
   eruit (Map bewaart de invoegvolgorde). Loopt de opslag ondanks alles vol, dan
   snoeit de kast een keer en geeft daarna DIE taal op voor de rest van de
   sessie -- het geheugen blijft werken, alleen de volgende pagina begint weer
   koud. Een volle opslag mag nooit een leeg of half scherm opleveren.

   WAT ER NIET IN GAAT. Alleen interface. De aanroepers hier zijn de twee
   UI-lagen; wat een lid TYPT loopt langs /api/vertaal en komt hier nooit langs.
   Dezelfde grens als server/lib/ui-bronnen.js aan de serverkant trekt. */
(function (w) {
  'use strict';
  if (w.RTGVertaalKast) return;

  /* v2 verbreekt bewust met de oude, gedeeltelijk gevulde taalvoorraad. Juist
     die voorraad liet een Nederlands scherm Duitse knoppen behouden nadat een
     vertaalronde halverwege faalde. */
  var SLEUTEL = 'rtg_tr_v2_';
  var OUD_SLEUTEL = 'rtg_tr_';
  var MAX_REGELS = 4000, MAX_BYTES = 300000;
  var kast = new Map();                 // taal -> Map(bron -> vertaling)
  var vuil = new Set(), opgegeven = new Set(), timer = null;

  function opslag() {
    try { return w.localStorage; } catch (e) { return null; }  // prive-modus gooit al bij het LEZEN
  }
  function van(taal) {
    var m = kast.get(taal);
    if (m) return m;
    m = new Map();
    kast.set(taal, m);
    var s = opslag();
    if (s && taal && taal !== 'nl') {
      try {
        var rauw = JSON.parse(s.getItem(SLEUTEL + taal) || 'null');
        if (rauw) for (var k in rauw) if (typeof rauw[k] === 'string' && rauw[k]) m.set(k, rauw[k]);
      } catch (e) { /* stukke of afgekapte JSON: een lege kast is geen fout */ }
      while (m.size > MAX_REGELS) m.delete(m.keys().next().value);
    }
    return m;
  }
  function zet(taal, bron, vertaling) {
    /* Een regel die gelijk is aan zijn bron is geen vertaling maar een
       mislukking die zich als antwoord voordoet. Hem bewaren zet een storing
       van vandaag vast als het antwoord van morgen -- dezelfde regel als in
       server/lib/vertaalkast.js, aan de andere kant van dezelfde weg. */
    if (!taal || taal === 'nl' || !bron || !vertaling || vertaling === bron) return false;
    var m = van(taal);
    m.delete(bron); m.set(bron, vertaling);
    while (m.size > MAX_REGELS) m.delete(m.keys().next().value);
    if (opgegeven.has(taal)) return true;
    vuil.add(taal);
    if (!timer) timer = setTimeout(bewaarNu, 400);
    return true;
  }
  /* De kasten van alle ANDERE talen van het toestel halen. Alleen aangeroepen
     wanneer de opslag vol zit; het geheugen blijft ongemoeid, dus de pagina die
     nu open staat verliest niets. */
  function andereTalenWeg(s, houd) {
    try {
      var weg = [];
      for (var i = 0; i < s.length; i++) {
        var k = s.key(i);
        if (k && k.indexOf(SLEUTEL) === 0 && k !== SLEUTEL + houd && k !== SLEUTEL + 'opgeruimd') weg.push(k);
      }
      weg.forEach(function (k) { s.removeItem(k); });
      return weg.length > 0;
    } catch (e) { return false; }
  }

  function bewaarNu() {
    timer = null;
    var s = opslag();
    if (!s) return;
    /* Een KOPIE, want de lus verwijdert eruit. En met Array.from en niet met
       slice.call: een Set heeft geen `length`, dus slice geeft daar een lege
       lijst -- de kast schreef dan nooit iets weg zonder een spoor achter te
       laten. Gevonden door test/i18n-auto.test.js, niet door lezen. */
    Array.from(vuil).forEach(function (taal) {
      vuil.delete(taal);
      if (opgegeven.has(taal)) return;
      var m = kast.get(taal);
      if (!m) return;
      /* Drie pogingen bij een volle opslag, in deze volgorde omdat dat de
         goedkoopste ruimte eerst opgeeft. Een mens leest in EEN taal, dus de
         kasten van talen waar hij doorheen klikte zijn dode ruimte -- die gaan
         voor. Pas daarna snijden we in de taal die hij NU leest. Lukt het dan
         nog niet, dan is de ruimte van iemand anders en niet van ons om op te
         eisen: deze taal wordt opgegeven, het geheugen blijft werken en de
         volgende pagina begint weer koud. */
      for (var poging = 0; poging < 3; poging++) {
        if (poging === 1) andereTalenWeg(s, taal);
        if (poging === 2) {
          var helft = Math.floor(m.size / 2);
          while (m.size > helft && m.size) m.delete(m.keys().next().value);
        }
        var uit = {}, bytes = 0, sleutels = [];
        m.forEach(function (v, k) { sleutels.push(k); });
        // van achteren naar voren, zodat het NIEUWSTE de bytegrens overleeft
        for (var i = sleutels.length - 1; i >= 0; i--) {
          var k = sleutels[i], v = m.get(k);
          bytes += k.length + v.length + 6;
          if (bytes > MAX_BYTES) break;
          uit[k] = v;
        }
        try { s.setItem(SLEUTEL + taal, JSON.stringify(uit)); return; }
        catch (e) { if (poging === 2) opgegeven.add(taal); }
      }
    });
  }

  /* De vorige opzet bewaarde per PAD (`rtg_ui_<taal>_<pad>_<n>`), dus stond
     dezelfde knop tientallen keren in de opslag van het toestel. Die ruimte is
     nu van de kast; hem laten staan zou de quota opeten van precies de laag die
     hem vervangt. Een keer opruimen, stil, en nooit meer. */
  (function () {
    var s = opslag();
    if (!s) return;
    try {
      if (s.getItem(SLEUTEL + 'opgeruimd')) return;
      var oud = [];
      for (var i = 0; i < s.length; i++) {
        var k = s.key(i);
        if (k && (k.indexOf('rtg_ui_') === 0 ||
          (k.indexOf(OUD_SLEUTEL) === 0 && k.indexOf(SLEUTEL) !== 0))) oud.push(k);
      }
      oud.forEach(function (k) { s.removeItem(k); });
      s.setItem(SLEUTEL + 'opgeruimd', '1');
    } catch (e) {}
  })();

  /* Een navigatie mag de laatst binnengekomen vertalingen niet opeten: de
     wachtende schrijfronde gaat er bij het verlaten van de pagina alsnog uit.
     `pagehide` is de enige gebeurtenis die op iOS betrouwbaar valt. */
  try {
    w.addEventListener('pagehide', bewaarNu);
    w.addEventListener('visibilitychange', function () {
      if (w.document && w.document.visibilityState === 'hidden') bewaarNu();
    });
  } catch (e) {}

  w.RTGVertaalKast = {
    van: van, zet: zet, bewaarNu: bewaarNu,
    lees: function (taal, bron) { var v = van(taal).get(bron); return v == null ? null : v; },
    stand: function () {
      var perTaal = {};
      kast.forEach(function (m, taal) { perTaal[taal] = m.size; });
      return { opslag: !!opslag(), perTaal: perTaal, opgegeven: Array.from(opgegeven),
        maxRegels: MAX_REGELS, maxBytes: MAX_BYTES };
    }
  };
})(window);
/* DE MEEGELEVERDE TAALSCHIL -- vertaling zonder netwerk.

   WAT DIT OPLOST. De automatische laag hieronder schraapt tekst van het scherm
   en vraagt hem op bij /api/vertaal/ui. Dat werkt goed zolang er verbinding is;
   wie voor het EERST offline binnenkomt, kreeg Nederlands, ook als hij zijn
   taal allang had gekozen. De kast (i18n-00.js) hielp daar niet: die vult zich
   pas door eerder bezoek. Deze laag levert de tekst van de app-schil mee als
   bestand, gebouwd door scripts/taalschil.js en voorgecachet door sw.js.

   DE VOLGORDE IS KAST, DAN SCHIL, DAN NET, en die is niet willekeurig. De kast
   is VERSER (hij bevat wat deze bezoeker werkelijk zag, inclusief schermen
   buiten de schil) en staat daarom voorop. De schil is BREDER bij een koude
   start. Het net is de laatste, want dat is de enige stap die iets kost.

   WAT DEZE LAAG NIET DOET. Hij keurt niets. De keuring staat in
   server/kern/taalkeuring.js en heeft bij het BOUWEN al beslist wat er in het
   bestand mag; alleen `goed` haalt het. Hier nog eens keuren zou een tweede,
   zwakkere kopie van dat oordeel in de browser zetten -- precies de dubbeling
   waar LAT.md regel 4 tegen is.

   EEN ONTBREKENDE SCHIL IS GEEN STORING. Talen buiten de elf hebben geen
   bestand, en dat hoort: zij werken zoals altijd, via het net. Een mislukte
   ophaalpoging wordt daarom ONTHOUDEN en niet herhaald -- anders doet elke
   DOM-wijziging een nieuw verzoek dat toch niets oplevert. */
(function (w, d) {
  if (w.RTGTaalSchil) return;
  var MAP = '/shared/taalschil';
  var LEEG = new Map();
  var geladen = {};   // taal -> Map met de regels
  var bezig = {};     // taal -> lopende belofte
  var mislukt = {};   // taal -> we hebben het geprobeerd, het kwam er niet

  /* De schil staat op dezelfde plek als de andere gedeelde bestanden. Op de
     publieke verhaalpagina's ligt de webroot een paar mappen hoger; die dragen
     daarvoor `rtg-asset-base`, net als i18n-01.js. */
  function basis() {
    var m = d.querySelector && d.querySelector('meta[name="rtg-asset-base"]');
    return String((m && m.getAttribute('content')) || '').replace(/\/+$/, '');
  }

  /* Een taalcode komt uit een keuzelijst, maar hij komt ook uit localStorage en
     uit een URL. Alles wat geen kale code is, wordt hier een pad -- dus eerst
     de vorm afdwingen en pas dan een adres bouwen. */
  function veilig(taal) {
    return /^[a-z]{2,3}$/.test(String(taal || '')) ? String(taal) : null;
  }

  function alsMap(regels) {
    var m = new Map();
    if (!regels || typeof regels !== 'object') return m;
    /* Via Object.keys en een Map, zodat een sleutel als `__proto__` in het
       bestand nooit iets aan een object kan veranderen. */
    Object.keys(regels).forEach(function (k) {
      var v = regels[k];
      if (typeof v === 'string' && v) m.set(k, v);
    });
    return m;
  }

  function van(taal) {
    taal = veilig(taal);
    return (taal && geladen[taal]) || LEEG;
  }

  function laad(taal) {
    taal = veilig(taal);
    if (!taal) return Promise.resolve(LEEG);
    if (geladen[taal]) return Promise.resolve(geladen[taal]);
    if (mislukt[taal]) return Promise.resolve(LEEG);
    if (bezig[taal]) return bezig[taal];
    if (typeof fetch !== 'function') { mislukt[taal] = true; return Promise.resolve(LEEG); }
    bezig[taal] = fetch(basis() + MAP + '/' + taal + '.json', { credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error('schil ' + r.status); return r.json(); })
      .then(function (j) {
        var m = alsMap(j && j.regels);
        geladen[taal] = m;
        delete bezig[taal];
        return m;
      })
      .catch(function () {
        mislukt[taal] = true;
        delete bezig[taal];
        return LEEG;
      });
    return bezig[taal];
  }

  /* Voor de meter en voor een mens die wil weten waar zijn tekst vandaan komt. */
  function stand() {
    var uit = {};
    Object.keys(geladen).forEach(function (t) { uit[t] = geladen[t].size; });
    return { geladen: uit, mislukt: Object.keys(mislukt) };
  }

  w.RTGTaalSchil = { van: van, laad: laad, stand: stand, MAP: MAP };
})(window, document);
/* Generated from server/talen.js. The shared picker remains available before the API responds. */
window.RTGWereldTalen = [
  {
    "code": "nl",
    "naam": "Nederlands",
    "en": "Dutch"
  },
  {
    "code": "en",
    "naam": "English",
    "en": "English"
  },
  {
    "code": "de",
    "naam": "Deutsch",
    "en": "German"
  },
  {
    "code": "fr",
    "naam": "Français",
    "en": "French"
  },
  {
    "code": "es",
    "naam": "Español",
    "en": "Spanish"
  },
  {
    "code": "pt",
    "naam": "Português",
    "en": "Portuguese"
  },
  {
    "code": "it",
    "naam": "Italiano",
    "en": "Italian"
  },
  {
    "code": "ca",
    "naam": "Català",
    "en": "Catalan"
  },
  {
    "code": "gl",
    "naam": "Galego",
    "en": "Galician"
  },
  {
    "code": "eu",
    "naam": "Euskara",
    "en": "Basque"
  },
  {
    "code": "ro",
    "naam": "Română",
    "en": "Romanian"
  },
  {
    "code": "el",
    "naam": "Ελληνικά",
    "en": "Greek"
  },
  {
    "code": "tr",
    "naam": "Türkçe",
    "en": "Turkish"
  },
  {
    "code": "ru",
    "naam": "Русский",
    "en": "Russian"
  },
  {
    "code": "uk",
    "naam": "Українська",
    "en": "Ukrainian"
  },
  {
    "code": "be",
    "naam": "Беларуская",
    "en": "Belarusian"
  },
  {
    "code": "pl",
    "naam": "Polski",
    "en": "Polish"
  },
  {
    "code": "cs",
    "naam": "Čeština",
    "en": "Czech"
  },
  {
    "code": "sk",
    "naam": "Slovenčina",
    "en": "Slovak"
  },
  {
    "code": "hu",
    "naam": "Magyar",
    "en": "Hungarian"
  },
  {
    "code": "bg",
    "naam": "Български",
    "en": "Bulgarian"
  },
  {
    "code": "sr",
    "naam": "Српски",
    "en": "Serbian"
  },
  {
    "code": "hr",
    "naam": "Hrvatski",
    "en": "Croatian"
  },
  {
    "code": "bs",
    "naam": "Bosanski",
    "en": "Bosnian"
  },
  {
    "code": "sl",
    "naam": "Slovenščina",
    "en": "Slovenian"
  },
  {
    "code": "mk",
    "naam": "Македонски",
    "en": "Macedonian"
  },
  {
    "code": "sq",
    "naam": "Shqip",
    "en": "Albanian"
  },
  {
    "code": "lt",
    "naam": "Lietuvių",
    "en": "Lithuanian"
  },
  {
    "code": "lv",
    "naam": "Latviešu",
    "en": "Latvian"
  },
  {
    "code": "et",
    "naam": "Eesti",
    "en": "Estonian"
  },
  {
    "code": "fi",
    "naam": "Suomi",
    "en": "Finnish"
  },
  {
    "code": "sv",
    "naam": "Svenska",
    "en": "Swedish"
  },
  {
    "code": "no",
    "naam": "Norsk",
    "en": "Norwegian"
  },
  {
    "code": "da",
    "naam": "Dansk",
    "en": "Danish"
  },
  {
    "code": "is",
    "naam": "Íslenska",
    "en": "Icelandic"
  },
  {
    "code": "ga",
    "naam": "Gaeilge",
    "en": "Irish"
  },
  {
    "code": "cy",
    "naam": "Cymraeg",
    "en": "Welsh"
  },
  {
    "code": "mt",
    "naam": "Malti",
    "en": "Maltese"
  },
  {
    "code": "lb",
    "naam": "Lëtzebuergesch",
    "en": "Luxembourgish"
  },
  {
    "code": "fy",
    "naam": "Frysk",
    "en": "West Frisian"
  },
  {
    "code": "yi",
    "naam": "ייִדיש",
    "en": "Yiddish"
  },
  {
    "code": "ar",
    "naam": "العربية",
    "en": "Arabic"
  },
  {
    "code": "he",
    "naam": "עברית",
    "en": "Hebrew"
  },
  {
    "code": "fa",
    "naam": "فارسی",
    "en": "Persian"
  },
  {
    "code": "ku",
    "naam": "Kurdî",
    "en": "Kurdish"
  },
  {
    "code": "az",
    "naam": "Azərbaycanca",
    "en": "Azerbaijani"
  },
  {
    "code": "hy",
    "naam": "Հայերեն",
    "en": "Armenian"
  },
  {
    "code": "ka",
    "naam": "ქართული",
    "en": "Georgian"
  },
  {
    "code": "kk",
    "naam": "Қазақша",
    "en": "Kazakh"
  },
  {
    "code": "uz",
    "naam": "Oʻzbekcha",
    "en": "Uzbek"
  },
  {
    "code": "ky",
    "naam": "Кыргызча",
    "en": "Kyrgyz"
  },
  {
    "code": "tg",
    "naam": "Тоҷикӣ",
    "en": "Tajik"
  },
  {
    "code": "tk",
    "naam": "Türkmençe",
    "en": "Turkmen"
  },
  {
    "code": "mn",
    "naam": "Монгол",
    "en": "Mongolian"
  },
  {
    "code": "tt",
    "naam": "Татарча",
    "en": "Tatar"
  },
  {
    "code": "hi",
    "naam": "हिन्दी",
    "en": "Hindi"
  },
  {
    "code": "ur",
    "naam": "اردو",
    "en": "Urdu"
  },
  {
    "code": "bn",
    "naam": "বাংলা",
    "en": "Bengali"
  },
  {
    "code": "pa",
    "naam": "ਪੰਜਾਬੀ",
    "en": "Punjabi"
  },
  {
    "code": "gu",
    "naam": "ગુજરાતી",
    "en": "Gujarati"
  },
  {
    "code": "mr",
    "naam": "मराठी",
    "en": "Marathi"
  },
  {
    "code": "ta",
    "naam": "தமிழ்",
    "en": "Tamil"
  },
  {
    "code": "te",
    "naam": "తెలుగు",
    "en": "Telugu"
  },
  {
    "code": "kn",
    "naam": "ಕನ್ನಡ",
    "en": "Kannada"
  },
  {
    "code": "ml",
    "naam": "മലയാളം",
    "en": "Malayalam"
  },
  {
    "code": "si",
    "naam": "සිංහල",
    "en": "Sinhala"
  },
  {
    "code": "ne",
    "naam": "नेपाली",
    "en": "Nepali"
  },
  {
    "code": "ps",
    "naam": "پښتو",
    "en": "Pashto"
  },
  {
    "code": "sd",
    "naam": "سنڌي",
    "en": "Sindhi"
  },
  {
    "code": "or",
    "naam": "ଓଡ଼ିଆ",
    "en": "Odia"
  },
  {
    "code": "as",
    "naam": "অসমীয়া",
    "en": "Assamese"
  },
  {
    "code": "dv",
    "naam": "ދިވެހި",
    "en": "Dhivehi"
  },
  {
    "code": "bo",
    "naam": "བོད་སྐད་",
    "en": "Tibetan"
  },
  {
    "code": "zh",
    "naam": "中文",
    "en": "Chinese"
  },
  {
    "code": "ja",
    "naam": "日本語",
    "en": "Japanese"
  },
  {
    "code": "ko",
    "naam": "한국어",
    "en": "Korean"
  },
  {
    "code": "th",
    "naam": "ไทย",
    "en": "Thai"
  },
  {
    "code": "vi",
    "naam": "Tiếng Việt",
    "en": "Vietnamese"
  },
  {
    "code": "id",
    "naam": "Bahasa Indonesia",
    "en": "Indonesian"
  },
  {
    "code": "jv",
    "naam": "Basa Jawa",
    "en": "Javanese"
  },
  {
    "code": "su",
    "naam": "Basa Sunda",
    "en": "Sundanese"
  },
  {
    "code": "ms",
    "naam": "Bahasa Melayu",
    "en": "Malay"
  },
  {
    "code": "tl",
    "naam": "Filipino",
    "en": "Filipino"
  },
  {
    "code": "km",
    "naam": "ខ្មែរ",
    "en": "Khmer"
  },
  {
    "code": "lo",
    "naam": "ລາວ",
    "en": "Lao"
  },
  {
    "code": "my",
    "naam": "မြန်မာ",
    "en": "Burmese"
  },
  {
    "code": "ug",
    "naam": "ئۇيغۇرچە",
    "en": "Uyghur"
  },
  {
    "code": "sw",
    "naam": "Kiswahili",
    "en": "Swahili"
  },
  {
    "code": "am",
    "naam": "አማርኛ",
    "en": "Amharic"
  },
  {
    "code": "ti",
    "naam": "ትግርኛ",
    "en": "Tigrinya"
  },
  {
    "code": "om",
    "naam": "Afaan Oromoo",
    "en": "Oromo"
  },
  {
    "code": "so",
    "naam": "Soomaali",
    "en": "Somali"
  },
  {
    "code": "ha",
    "naam": "Hausa",
    "en": "Hausa"
  },
  {
    "code": "yo",
    "naam": "Yorùbá",
    "en": "Yoruba"
  },
  {
    "code": "ig",
    "naam": "Igbo",
    "en": "Igbo"
  },
  {
    "code": "zu",
    "naam": "isiZulu",
    "en": "Zulu"
  },
  {
    "code": "xh",
    "naam": "isiXhosa",
    "en": "Xhosa"
  },
  {
    "code": "af",
    "naam": "Afrikaans",
    "en": "Afrikaans"
  },
  {
    "code": "st",
    "naam": "Sesotho",
    "en": "Sotho"
  },
  {
    "code": "sn",
    "naam": "chiShona",
    "en": "Shona"
  },
  {
    "code": "rw",
    "naam": "Kinyarwanda",
    "en": "Kinyarwanda"
  },
  {
    "code": "mg",
    "naam": "Malagasy",
    "en": "Malagasy"
  },
  {
    "code": "wo",
    "naam": "Wolof",
    "en": "Wolof"
  },
  {
    "code": "ln",
    "naam": "Lingála",
    "en": "Lingala"
  },
  {
    "code": "ny",
    "naam": "Chichewa",
    "en": "Chichewa"
  },
  {
    "code": "lg",
    "naam": "Luganda",
    "en": "Ganda"
  },
  {
    "code": "ht",
    "naam": "Kreyòl ayisyen",
    "en": "Haitian Creole"
  },
  {
    "code": "qu",
    "naam": "Runasimi",
    "en": "Quechua"
  },
  {
    "code": "gn",
    "naam": "Avañeʼẽ",
    "en": "Guarani"
  },
  {
    "code": "ay",
    "naam": "Aymar aru",
    "en": "Aymara"
  },
  {
    "code": "mi",
    "naam": "Te reo Māori",
    "en": "Maori"
  },
  {
    "code": "sm",
    "naam": "Gagana Sāmoa",
    "en": "Samoan"
  },
  {
    "code": "to",
    "naam": "Lea faka-Tonga",
    "en": "Tongan"
  },
  {
    "code": "fj",
    "naam": "Vosa Vakaviti",
    "en": "Fijian"
  }
];
/* Code-controlled shared UI copy. These words never select an action: Edge
   keeps its existing action IDs, handlers and server permissions. */
window.RTGUiBronnen = Object.freeze({
  'Trage verbinding: zuinige stand aan':'Slow connection: data-saving mode is on',
  'Zuinige stand uitzetten':'Turn off data-saving mode',' in de wachtrij':' in the queue',
  'Geen internetverbinding. Zodra je weer online bent gaat het vanzelf verder.':'There is no internet connection. You can continue when you are back online.',
  'Er ging iets mis. Probeer het zo nog eens.':'Something went wrong. Please try again shortly.',
  'Hier':'Here','Heel RTG':'All RTG','Recent bezocht':'Recently visited','Uw ruimte':'Your space',
  'Relevant op deze plek':'Relevant here','Functies op deze plek':'Features for this context',
  'Uw vier werelden':'Your four worlds','Alles van Rahul Travel Group':'Everything from Rahul Travel Group',
  'Alle apps':'All apps','Profiel & veiligheid':'Profile and security','Menuweergave':'Menu view','Menu sluiten':'Close menu',
  'Home':'Home','HOME':'HOME','Menu':'Menu','MENU':'MENU','Werelden':'Worlds','WERELDEN':'WORLDS',
  'Acties':'Actions','ACTIES':'ACTIONS','Terug':'Back','Vooruit':'Forward','Sluiten':'Close',
  'Openen':'Open','Opslaan':'Save','Annuleren':'Cancel','Doorgaan':'Continue','Ga verder':'Continue',
  'Voorgoed verwijderen':'Delete permanently','Document openen':'Open document','Verwijderen':'Delete',
  'Als favoriet bewaren':'Save as a favourite','Uit favorieten verwijderen':'Remove from favourites',
  'Volgende stap':'Next step','Uw werelden':'Your worlds','Context en opties':'Context and options',
  'Veiligheid en status':'Security and status','Open Connect':'Open Connect','Bekijk actuele status':'View current status',
  'Rahul vragen':'Ask Rahul','Praat met Rahul':'Talk to Rahul','Vraag Rahul':'Ask Rahul','Vraag Rahul…':'Ask Rahul…',
  'Gesprek met Rahul':'Conversation with Rahul','Open gesprek met Rahul':'Open conversation with Rahul',
  'Geef Rahul context':'Give Rahul context','Gesprek':'Conversation','Versturen':'Send',
  'Acties van dit scherm':'Actions for this screen','Alle functies':'All features','ALLE FUNCTIES':'ALL FEATURES',
  'Context van deze pagina':'Context for this page','Context van dit scherm':'Context for this screen',
  'Dit scherm':'This screen','Hoofdactie':'Main action','Doen':'Act','Meer acties':'More actions','Meer':'More',
  'Connect openen':'Open Connect','Actuele activiteit':'Current activity','Actueel':'Current',
  'Wat wilt u doen?':'What would you like to do?','VEILIGE VOLGENDE STAP':'SAFE NEXT STEP',
  'Voor deze context zijn geen veilige acties beschikbaar.':'No safe actions are available for this context.',
  'Home, Context, Acties, Connect en Rahul':'Home, Context, Actions, Connect and Rahul',
  'Handelingen van dit scherm':'Actions for this screen','Hoofdnavigatie':'Main navigation',
  'Menu en alle functies':'Menu and all features','Naar home':'Go home','Werelden openen':'Open worlds',
  'Aantal schermen':'Number of screens','Functies van dit scherm':'Features for this screen',
  'Vier RTG werelden':'Four RTG worlds','Functies':'Features','Functies zoeken':'Search features',
  'Geen functie gevonden.':'No matching feature was found.','Werelden en werkbladen':'Worlds and workspaces',
  'Werelden en systeem':'Worlds and system','Slim menu':'Smart menu','Menu openen':'Open menu',
  'Bediening en weergave':'Controls and display','Taal kiezen':'Choose your language',
  'Mijn profiel':'My profile','Zoeken':'Search','Informatiedichtheid':'Information density',
  'Compact':'Compact','Ruim':'Comfortable','Weergavestand':'Display mode','Weergave':'Display',
  'Bediening tonen':'Show controls','Context sluiten':'Close context','Automatisch':'Automatic',
  'Overzicht':'Overview','Focus':'Focus','LIVE SYSTEEMSTATUS':'LIVE SYSTEM STATUS','Status ophalen…':'Loading status…',
  'Lokale controle':'Local check','Beveiligd':'Secure','Niet beveiligd':'Not secure','Netwerk':'Network',
  'Controleren…':'Checking…','Datalaag':'Data layer','Boeken, betalen en goedkeuren blijven menselijke handelingen.':'Booking, payment and approval remain human decisions.',
  'Magnaat Test gereed':'Magnaat Test ready','Systemen gereed':'Systems ready','Controle nodig':'Review needed',
  'Beperkt':'Limited','Gereed':'Ready','Niet gereed':'Not ready','Server niet bereikbaar':'Server unavailable',
  'Onbekend':'Unknown','Wacht op bron':'Waiting for source','niet beschikbaar':'unavailable',
  'Afgeschermde Magnaat-testomgeving. Geen klantdata of productieacties. Boeken, betalen en goedkeuren blijven menselijke handelingen.':'Isolated Magnaat test environment. No customer data or production actions. Booking, payment and approval remain human decisions.',
  'Dag & team':'Day and team','Vandaag':'Today','Morgen':'Tomorrow','Gisteren':'Yesterday',
  'Afdelingen':'Departments','Personeel':'Staff','Agenda':'Calendar','Mijn loon':'My pay',
  'Maken & delen':'Create and share','Presentaties & Office':'Presentations and Office','Bestanden':'Files',
  'Ondernemen':'Business','Onderneming':'Company','Regie':'Control','Plannen':'Planning',
  'Reizen & Veilig':'Travel and safety','Vluchten':'Flights','Verblijven':'Stays','Reisbureau':'Travel agency',
  'Onderweg':'On the move','Navigatie':'Navigation','Openbaar vervoer':'Public transport','Verkeer':'Traffic',
  'Ritstatus':'Ride status','Stad':'City','Residentie':'Residence','Reisboek':'Travel journal',
  'Leefmodel':'Life overview','Voornemen':'Intent','Routes vergelijken':'Compare routes',
  'Beslissingen':'Decisions','Terugkijken':'Review','Uw leven':'Your life','Mijn leven':'My life',
  'RTG Geld':'RTG Money','Wonen':'Home and living','Gezondheid':'Health','RTG Veilig':'RTG Safety',
  'Start & leren':'Start and learn','Leren & Groei':'Learning and growth','Presenteren & Office':'Presentations and Office',
  'Bibliotheek':'Library','Geloofsbibliotheek':'Faith library','Schoolbibliotheek':'School library','Beroepen':'Careers',
  'Overhoren':'Practice questions','Schrijven':'Writing','Projecten':'Projects','Toetsen':'Tests','Presenteren':'Presentations',
  'Klein beginnen':'Start small','De Speeltuin':'The playground','Tellen tot tien':'Count to ten',
  'Ondersteuning':'Support','Instellingen':'Settings','Meldingen':'Notifications','Berichten':'Messages',
  'Profiel':'Profile','Uitloggen':'Sign out','Inloggen':'Sign in','Aanmelden':'Sign up',
  'Alles':'All','Kies uw taal':'Choose your language','Taal':'Language','Hulp':'Help','Zoek':'Search',
  'Zoek op taal of land. RTG onthoudt uw keuze op dit apparaat.':'Search by language or country. RTG remembers your choice on this device.',
  'Taal of land':'Language or country','Bijvoorbeeld Nederlands of Nederland':'For example English or United Kingdom',
  'Spreek uw taal in':'Speak your language','Kiezen':'Choose','Direct kiezen':'Quick choice','Verder':'Continue',
  'Taal niet gevonden. Probeer een andere naam.':'Language not found. Try another name.','Taalkeuze sluiten':'Close language chooser',
  'Alle werelden':'All worlds','Verder ontdekken':'Keep exploring','Licht':'Light','Donker':'Dark',
  'Welkom':'Welcome','Welkom terug':'Welcome back','Opslaan gelukt':'Saved successfully'
});
/* Exact interface templates only. Values, identifiers and user input are never parsed as commands. */
window.RTGUiBronTekst = function(source){
  if(Object.hasOwn(window.RTGUiBronnen,source))return window.RTGUiBronnen[source];
  var count=/^Zoek in (\d+) functies$/.exec(source);
  if(count)return 'Search '+count[1]+' features';
  var world=/^(LIVING OS|TRAVEL OS|WORK OS|RTFOUNDATION) · ALLE FUNCTIES$/.exec(source);
  if(world)return world[1]+' · ALL FEATURES';
  var store=/^(sqlite|postgres|memory|opslag) · (schrijfbaar|alleen-lezen)$/.exec(source);
  if(store)return store[1]+' · '+(store[2]==='schrijfbaar'?'writable':'read only');
};
/* De LEZER van de automatische UI-vertaling voor de volledige RTG-schermfamilie.
   (Het tonen, opvragen en wisselen staat in i18n-00c.js: een IIFE, twee helften.)

   De expliciete data-i18n-sleutels blijven de voorkeursroute: zij geven de
   redactie volledige controle. Deze laag vangt alles op wat nog geen sleutel
   heeft, inclusief tekst die een app later met JavaScript tekent. Hij bewaart
   altijd de oorspronkelijke DOM-waarde, vertaalt in groepen en zet bij een
   taalwissel zonder herladen de juiste bron opnieuw neer.

   Gebruikersinhoud, formulieren, code en expliciet uitgesloten delen gaan
   nooit naar de UI-vertaalroute. Zet `translate="no"`, `data-i18n-ignore` of
   `data-user-content` op een eigen component om dezelfde grens uit te spreken. */
(function (w) {
  'use strict';
  if (w.RTGAutoVertaling) return;

  var RTL = new Set(['ar', 'dv', 'fa', 'he', 'ps', 'sd', 'ug', 'ur', 'yi']);
  var KERN = new Set(['nl','en','de','fr','es','pt','it','pl','ru','uk','tr','ar','fa','he','hi','bn','ur','zh','ja','ko','id','vi','th','sw']);
  var ATTRS = ['placeholder', 'title', 'aria-label', 'aria-description', 'alt'];
  var NEGEER = 'script,style,noscript,template,code,pre,kbd,samp,svg,canvas,textarea,' +
    '[translate="no"],[data-i18n-ignore],[data-user-content],[contenteditable="true"],' +
    '[data-i18n],[data-i18n-html],.chat-bericht,.message-body,.bericht-tekst,.post-body,.review-text';
  var tekstMap = new WeakMap(), attribMap = new WeakMap();
  var tekstStaten = new Set(), attribStaten = new Set();
  var wortels = new Set();
  var taal = 'nl', beurt = 0, timer = null, waarnemer = null;
  var eersteRonde = true;
  var keten = Promise.resolve();
  /* De voorraad vertalingen staat in i18n-00.js, in dezelfde bundel. Ontbreekt
     hij toch, dan werkt deze laag door zonder voorraad -- traag zoals vroeger,
     maar geen enkel scherm valt om op een ontbrekende kast. */
  var KAST = w.RTGVertaalKast || { van: function () { return new Map(); },
    zet: function () { return false; }, stand: function () { return { opslag: false, perTaal: {} }; } };
  /* De meegeleverde schil (i18n-00a.js): wat er offline al klaarstaat. Zelfde
     terugval als de kast -- ontbreekt hij, dan werkt deze laag door via het net. */
  var SCHIL = w.RTGTaalSchil || { van: function () { return new Map(); },
    laad: function () { return Promise.resolve(new Map()); } };
  var oorspronkelijkeRichting = document.documentElement.getAttribute('dir');
  var apiMeta = document.querySelector && document.querySelector('meta[name="rtg-api-base"]');
  var apiBasis = String(apiMeta && apiMeta.getAttribute('content') || '').replace(/\/+$/, '');
  function apiPad(pad) { return apiBasis + pad; }

  function letters(s) { return /[A-Za-zÀ-ÖØ-öø-ÿ\u0100-\uFFFF]/.test(s); }
  function kandidaat(s) {
    s = String(s == null ? '' : s).trim();
    if (s.length < 2 || s.length > 300 || !letters(s)) return false;
    if (/^(?:https?:|mailto:|tel:|data:|blob:|\/[-\w./]+$)/i.test(s)) return false;
    if (/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(s)) return false;
    return true;
  }

  function uitgesloten(el, attribuut) {
    if (!el || el.nodeType !== 1) return true;
    try { if (el.closest(NEGEER)) return true; } catch (e) { return true; }
    if (attribuut === 'placeholder' && el.hasAttribute('data-i18n-ph')) return true;
    if (attribuut === 'title' && el.hasAttribute('data-i18n-title')) return true;
    if (attribuut === 'aria-label' && el.hasAttribute('data-i18n-aria')) return true;
    return false;
  }

  function delen(waarde) {
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(String(waarde || ''));
    return { voor: m[1], bron: m[2], na: m[3] };
  }
  function vernieuwTekst(st, waarde) {
    var d = delen(waarde);
    st.bronVol = waarde; st.bron = d.bron; st.voor = d.voor; st.na = d.na; st.weergave = null;
  }
  function tekstStaat(node) {
    var st = tekstMap.get(node), nu = node.nodeValue || '';
    if (!st) {
      st = { soort: 'tekst', node: node, bronVol: '', bron: '', voor: '', na: '', weergave: null };
      vernieuwTekst(st, nu); tekstMap.set(node, st); tekstStaten.add(st);
    } else if (nu !== st.bronVol && nu !== st.weergave) vernieuwTekst(st, nu);
    return st;
  }
  function attribStaat(el, naam) {
    var perEl = attribMap.get(el);
    if (!perEl) { perEl = {}; attribMap.set(el, perEl); }
    var nu = el.getAttribute(naam) || '', st = perEl[naam];
    if (!st) {
      st = { soort: 'attribuut', el: el, naam: naam, bron: nu, weergave: null };
      perEl[naam] = st; attribStaten.add(st);
    } else if (nu !== st.bron && nu !== st.weergave) { st.bron = nu; st.weergave = null; }
    return st;
  }

  function voeg(groepen, voorraad, st) {
    if (!kandidaat(st.bron)) return;
    var atomair = KERN.has(taal) && taal !== 'nl' && taal !== 'en';
    var known=w.RTGUiBronTekst && w.RTGUiBronTekst(st.bron);
    if(taal==='en' && known!=null) return toon(st,known);
    var uitKast = KAST.van(taal).get(st.bron);
    if (uitKast != null && !atomair) return toon(st, uitKast);
    /* Kast, dan schil, dan net. De kast is verser (hij kent ook schermen buiten
       de schil), de schil is breder bij een koude start, het net kost geld. */
    var uitSchil = SCHIL.van(taal).get(st.bron);
    if (uitSchil != null && !atomair) return toon(st, uitSchil);
    if(!atomair && known!=null) toon(st,known); // Explicit source copy remains usable while a target translation is pending.
    if (!groepen.has(st.bron)) groepen.set(st.bron, new Set());
    groepen.get(st.bron).add(st);
    if (atomair && uitKast != null) voorraad.set(st.bron, uitKast);
    else if (atomair && uitSchil != null) voorraad.set(st.bron, uitSchil);
  }
  function verzamelTekst(root, groepen, voorraad) {
    if (!root) return;
    var bekijk = function (node) {
      if (!node || node.nodeType !== 3 || uitgesloten(node.parentElement)) return;
      voeg(groepen, voorraad, tekstStaat(node));
    };
    if (root.nodeType === 3) bekijk(root);
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) bekijk(node);
  }
  function verzamelAttributen(root, groepen, voorraad) {
    if (!root || (root.nodeType !== 1 && root.nodeType !== 9)) return;
    var els = [];
    if (root.nodeType === 1) els.push(root);
    try { els = els.concat(Array.from(root.querySelectorAll('[' + ATTRS.join('],[') + ']'))); } catch (e) {}
    els.forEach(function (el) {
      ATTRS.forEach(function (naam) {
        if (el.hasAttribute(naam) && !uitgesloten(el, naam)) voeg(groepen, voorraad, attribStaat(el, naam));
      });
      var type = String(el.getAttribute('type') || '').toLowerCase();
      if (el.tagName === 'INPUT' && /^(button|submit|reset)$/.test(type) && el.hasAttribute('value') && !uitgesloten(el, 'value'))
        voeg(groepen, voorraad, attribStaat(el, 'value'));
    });
  }

  /* Hier houdt de LEZER op. Wat hij verzamelde -- welke tekstknopen en welke
     attributen vertaald mogen worden, en met welke oorspronkelijke waarde --
     wordt in i18n-00c.js getoond, hersteld en opgevraagd. Een IIFE, twee
     bestanden: de bundel plakt ze terug aaneen (scripts/bundel.js). */
/* De SCHRIJVER van de automatische vertaallaag: tonen, herstellen, groeperen,
   opvragen en de taalwissel. Dit is de tweede helft van de IIFE die in
   i18n-00b.js opent -- de lezer daar bepaalt WAT vertaald mag worden en waar
   het staat, deze helft doet er iets mee. Ze delen hun toestand, en de bundel
   plakt ze terug aaneen tot een bestand (scripts/bundel.js). */
  function toon(st, vertaling) {
    if (taal === 'nl' || !st || st.bron == null) return;
    vertaling = String(vertaling == null || vertaling === '' ? st.bron : vertaling);
    if (st.soort === 'tekst') {
      if (!st.node.isConnected) return;
      st.weergave = st.voor + vertaling + st.na;
      if (st.node.nodeValue !== st.weergave) st.node.nodeValue = st.weergave;
    } else {
      if (!st.el.isConnected) return;
      st.weergave = vertaling;
      if (st.el.getAttribute(st.naam) !== vertaling) st.el.setAttribute(st.naam, vertaling);
    }
  }

  function herstel() {
    tekstStaten.forEach(function (st) {
      if (!st.node.isConnected) return tekstStaten.delete(st);
      var nu = st.node.nodeValue || '';
      if (st.weergave != null && nu === st.weergave) st.node.nodeValue = st.bronVol;
      else if (nu !== st.bronVol) vernieuwTekst(st, nu);
      st.weergave = null;
    });
    attribStaten.forEach(function (st) {
      if (!st.el.isConnected) return attribStaten.delete(st);
      var nu = st.el.getAttribute(st.naam) || '';
      if (st.weergave != null && nu === st.weergave) st.el.setAttribute(st.naam, st.bron);
      else if (nu !== st.bron) st.bron = nu;
      st.weergave = null;
    });
  }

  function engelseTerugval() {
    herstel();
    /* De sleutelweg valt voor een ontbrekende doelvertaling ook op Engels
       terug. Doe dat hier voor alle geregistreerde losse UI-tekst, zodat de
       twee lagen samen nooit een Nederlands/Engels mengsel maken. */
    tekstStaten.forEach(function (st) {
      var known = w.RTGUiBronTekst && w.RTGUiBronTekst(st.bron);
      if (known != null) toon(st, known);
    });
    attribStaten.forEach(function (st) {
      var known = w.RTGUiBronTekst && w.RTGUiBronTekst(st.bron);
      if (known != null) toon(st, known);
    });
  }

  function groepenVan(bronnen, groepen) {
    var uit = [], nu = [], tekens = 0;
    bronnen.forEach(function (bron) {
      if (nu.length && (nu.length >= 300 || tekens + bron.length > 18000)) {
        uit.push(nu); nu = []; tekens = 0;
      }
      nu.push(bron); tekens += bron.length;
    });
    if (nu.length) uit.push(nu);
    return uit.map(function (regels) { return { regels: regels, doelen: regels.map(function (r) { return groepen.get(r); }) }; });
  }

  function vraag(groep, gekozenTaal, gekozenBeurt) {
    var koppen = { 'Content-Type': 'application/json' };
    return fetch(apiPad('/api/vertaal/ui'), { method: 'POST', headers: koppen,
      body: JSON.stringify({ naar: gekozenTaal, bron: location.pathname, teksten: groep.regels }) })
      .then(function (r) { if (!r.ok) throw new Error('ui-vertaling ' + r.status); return r.json(); })
      .then(function (d) {
        if (!d || d.naar !== gekozenTaal || !Array.isArray(d.teksten) || d.teksten.length !== groep.regels.length ||
          !Array.isArray(d.voltooid) || d.voltooid.length !== groep.regels.length)
          return { volledig: false, waarden: [] };
        var waarden = [];
        groep.regels.forEach(function (bron, i) {
          var vertaling = d.teksten[i] || bron;
          waarden.push(vertaling);
          if (d.voltooid[i] && vertaling !== bron) KAST.zet(gekozenTaal, bron, vertaling);
          if (!groep.atomair && d.voltooid[i] && taal === gekozenTaal && beurt === gekozenBeurt)
            groep.doelen[i].forEach(function (st) { if (st.bron === bron) toon(st, vertaling); });
        });
        return { volledig: d.volledig === true, waarden: waarden, voltooid: d.voltooid };
      });
  }

  function voerUit() {
    timer = null;
    eersteRonde = false;
    if (taal === 'nl') return;
    var groepen = new Map(), voorraad = new Map(), lijst = Array.from(wortels); wortels.clear();
    if (!lijst.length) lijst = [document.documentElement];
    lijst.forEach(function (root) { verzamelTekst(root, groepen, voorraad); verzamelAttributen(root, groepen, voorraad); });
    if (!groepen.size) return;
    var gekozenTaal = taal, gekozenBeurt = beurt;
    var atomair = KERN.has(gekozenTaal) && gekozenTaal !== 'nl' && gekozenTaal !== 'en';
    var ontbrekend = Array.from(groepen.keys()).filter(function (bron) { return !voorraad.has(bron); });
    /* Een volledig bekende ronde kan direct en in één taak op het scherm.
       Daarvoor is geen netwerk of asynchrone modelketen nodig. */
    if (atomair && !ontbrekend.length) {
      groepen.forEach(function (doelen, bron) {
        doelen.forEach(function (st) { if (st.bron === bron) toon(st, voorraad.get(bron)); });
      });
      document.documentElement.setAttribute('data-rtg-taal-volledig', 'true');
      return;
    }
    var batches = groepenVan(ontbrekend, groepen);
    batches.forEach(function (groep) { groep.atomair = atomair; });
    keten = keten.then(async function () {
      var volledig = true;
      for (var i = 0; i < batches.length; i++) {
        if (taal !== gekozenTaal || beurt !== gekozenBeurt) return;
        var antwoord = await vraag(batches[i], gekozenTaal, gekozenBeurt);
        if (!antwoord || !antwoord.volledig) volledig = false;
        if (antwoord && antwoord.waarden) batches[i].regels.forEach(function (bron, j) {
          var waarde = antwoord.waarden[j];
          if (antwoord.voltooid && antwoord.voltooid[j] && waarde) voorraad.set(bron, waarde);
        });
      }
      if (!atomair || taal !== gekozenTaal || beurt !== gekozenBeurt) return;
      volledig = volledig && Array.from(groepen.keys()).every(function (bron) { return voorraad.has(bron); });
      if (!volledig) {
        /* Geen lappendeken: de hele automatische laag blijft in de brontaal.
           Een volgende expliciete keuze mag opnieuw proberen. */
        engelseTerugval();
        document.documentElement.setAttribute('data-rtg-taal-volledig', 'false');
        return;
      }
      groepen.forEach(function (doelen, bron) {
        doelen.forEach(function (st) { if (st.bron === bron) toon(st, voorraad.get(bron)); });
      });
      document.documentElement.setAttribute('data-rtg-taal-volledig', 'true');
    }).catch(function () {
      if (atomair && taal === gekozenTaal && beurt === gekozenBeurt) {
        engelseTerugval();
        document.documentElement.setAttribute('data-rtg-taal-volledig', 'false');
      }
    });
  }
  /* De 80 ms bundelt een uitbarsting van DOM-wijzigingen tot EEN aanvraag. Bij
     een warme kast is er geen aanvraag, en is die wachttijd alleen nog zichtbaar
     Nederlands op een scherm dat we al kunnen vertalen: de EERSTE ronde loopt
     daarom kort zodra de kast van deze taal gevuld is. */
  function plan(root) {
    if (root) wortels.add(root.nodeType === 3 ? root.parentElement : root);
    if (timer || taal === 'nl') return;
    var warm = eersteRonde && KAST.van(taal).size > 0;
    timer = setTimeout(voerUit, warm ? 0 : 80);
  }

  function observeer() {
    if (waarnemer || !document.documentElement) return;
    try {
      waarnemer = new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          if (m.type === 'characterData') plan(m.target);
          else if (m.type === 'attributes') plan(m.target);
          else Array.from(m.addedNodes || []).forEach(plan);
        });
      });
      waarnemer.observe(document.documentElement, { childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: ATTRS.concat(['value']) });
    } catch (e) {}
  }

  function pasToe(nieuweTaal) {
    if (taal !== nieuweTaal) herstel();
    taal = /^[a-z]{2}$/.test(String(nieuweTaal || '')) ? nieuweTaal : 'nl';
    beurt++;
    if (RTL.has(taal)) document.documentElement.setAttribute('dir', 'rtl');
    else if (taal === 'nl' && oorspronkelijkeRichting == null) document.documentElement.removeAttribute('dir');
    else document.documentElement.setAttribute('dir', oorspronkelijkeRichting || 'ltr');
    document.documentElement.setAttribute('data-rtg-taal', taal);
    document.documentElement.removeAttribute('data-rtg-taal-volledig');
    if (taal !== 'nl') {
      KAST.van(taal);   // de kast van deze taal alvast van het toestel halen
      /* En de meegeleverde schil erbij. Die komt van schijf of uit de
         service-worker-cache, dus ook zonder verbinding. Hij landt ASYNCHROON,
         dus na aankomst nog een ronde: anders staat de eerste render er nog in
         het Nederlands terwijl de vertaling al binnen is. `beurt` bewaakt dat
         een late schil van een vorige taal niets meer aanraakt. */
      (function (gekozenTaal, gekozenBeurt) {
        SCHIL.laad(gekozenTaal).then(function (m) {
          if (m && m.size && taal === gekozenTaal && beurt === gekozenBeurt) plan(document.documentElement);
        });
      })(taal, beurt);
    }
    eersteRonde = true;
    observeer();
    if (taal === 'nl') { if (timer) { clearTimeout(timer); timer = null; } wortels.clear(); herstel(); }
    else plan(document.documentElement);
  }

  /* De kast staat er ook naar buiten toe bij, want de sleutelweg in i18n-03.js
     praat met dezelfde voorraad. Twee lagen die hetzelfde woord twee keer laten
     vertalen was precies de dubbeling die deze ronde wegneemt. */
  w.RTGAutoVertaling = {
    apply: pasToe, scan: plan, kandidaat: kandidaat, rtl: RTL, kast: KAST,
    stand: function () { var s = KAST.stand(); s.taal = taal; return s; }
  };
})(window);
/* ============================================================================
   RTG i18n, taalkeuze + automatische detectie voor de website en alle apps.

   Werking:
   - Nederlands is de basistaal: de tekst staat gewoon in de HTML.
   - Andere talen komen uit een woordenboek dat elke pagina zelf meegeeft via
     window.I18N = { en: { 'sleutel': 'vertaling', ... }, ... }.
   - Elementen krijgen data-i18n="sleutel" (tekst), data-i18n-html="sleutel"
     (met opmaak) of data-i18n-ph="sleutel" (placeholder).
   - Bij het eerste bezoek verschijnt een taalkeuze; de taal van het toestel
     (navigator.language) staat voorgeselecteerd. De keuze wordt onthouden.
   - JS-gerenderde schermen kunnen luisteren naar het 'rtglang'-event en
     RTGi18n.t('sleutel', 'standaard') gebruiken.
   ========================================================================== */
(function () {
  if (window.__rtgI18nActief) return;
  window.__rtgI18nActief = true;
  const STORE = 'rtg_lang';
  const apiMeta = document.querySelector('meta[name="rtg-api-base"]');
  const assetMeta = document.querySelector('meta[name="rtg-asset-base"]');
  /* Waar de API woont. Normaal op dezelfde oorsprong -- dat klopt op de
     RTG-server, op localhost en bij een eigen installatie. Maar de publieke
     verhaalpagina's (public/site/) worden OOK van een statische voordeur
     geserveerd, en daar ligt geen API: dan wijzen we naar de app. Een vaste
     meta in die pagina's kan niet, want dan zou een eigen installatie zijn
     vertalingen bij ons ophalen. De lijst staat in server/lib/voordeuren.js;
     test/i18n-auto.test.js zakt zodra deze twee uit elkaar lopen. */
  const STATISCHE_VOORDEUREN = ['https://rahulrtg.github.io', 'https://rahultravelgroup.com', 'https://www.rahultravelgroup.com'];
  const APP_OORSPRONG = 'https://app.rahultravelgroup.com';
  const API_BASIS = String(
    (apiMeta && apiMeta.getAttribute('content')) ||
    (STATISCHE_VOORDEUREN.indexOf(location.origin) >= 0 ? APP_OORSPRONG : '') || ''
  ).replace(/\/+$/, '');
  const ASSET_BASIS = String(assetMeta && assetMeta.getAttribute('content') || '').replace(/\/+$/, '');
  const apiPad = pad => API_BASIS + pad;
  const assetPad = pad => ASSET_BASIS + pad;
  const LANGS = {
    nl: { label: 'Nederlands', native: 'Nederlands' },
    en: { label: 'Engels', native: 'English' }
  };
  const KERN = new Set([
    'nl', 'en', 'de', 'fr', 'es', 'pt', 'it', 'pl', 'ru', 'uk', 'tr',
    'ar', 'fa', 'he', 'hi', 'bn', 'ur', 'zh', 'ja', 'ko', 'id', 'vi', 'th', 'sw'
  ]);
  /* Wereldtalen: de Boardroom bepaalt welke talen aanstaan; de kiezer toont ze
     allemaal. De 24 kerntalen wisselen atomair: een onvolledig woordenboek
     blijft volledig Engels in plaats van meerdere talen op een scherm te mengen. */
  let WERELD = window.RTGWereldTalen || null; // [{code, naam, en}] uit /api/talen
  function supported() { return WERELD ? WERELD.map(t => t.code) : Object.keys(LANGS); }
  const orig = new WeakMap(); // element -> { text, html, ph }

  /* ---------- vlaggen: elke taal krijgt een representatief land ----------
     De 114 talen tonen we als landvlaggen. Een taal is geen land, dus we kiezen
     per taal het land waar hij het meest thuis is; puur als beeld, geen politiek
     statement. Uit de ISO-landcode bouwen we het vlag-emoji (regionale-indicator
     -tekens), dus we bewaren nergens plaatjes. */
  const LAND = {
    nl: 'NL', en: 'GB', de: 'DE', fr: 'FR', es: 'ES', pt: 'PT', it: 'IT', ca: 'ES', gl: 'ES', eu: 'ES',
    ro: 'RO', el: 'GR', tr: 'TR', ru: 'RU', uk: 'UA', be: 'BY', pl: 'PL', cs: 'CZ', sk: 'SK', hu: 'HU',
    bg: 'BG', sr: 'RS', hr: 'HR', bs: 'BA', sl: 'SI', mk: 'MK', sq: 'AL', lt: 'LT', lv: 'LV', et: 'EE',
    fi: 'FI', sv: 'SE', no: 'NO', da: 'DK', is: 'IS', ga: 'IE', cy: 'GB', mt: 'MT', lb: 'LU', fy: 'NL',
    yi: 'IL', ar: 'SA', he: 'IL', fa: 'IR', ku: 'IQ', az: 'AZ', hy: 'AM', ka: 'GE', kk: 'KZ', uz: 'UZ',
    ky: 'KG', tg: 'TJ', tk: 'TM', mn: 'MN', tt: 'RU', hi: 'IN', ur: 'PK', bn: 'BD', pa: 'IN', gu: 'IN',
    mr: 'IN', ta: 'IN', te: 'IN', kn: 'IN', ml: 'IN', si: 'LK', ne: 'NP', ps: 'AF', sd: 'PK', or: 'IN',
    as: 'IN', dv: 'MV', bo: 'CN', zh: 'CN', ja: 'JP', ko: 'KR', th: 'TH', vi: 'VN', id: 'ID', jv: 'ID',
    su: 'ID', ms: 'MY', tl: 'PH', km: 'KH', lo: 'LA', my: 'MM', ug: 'CN', sw: 'KE', am: 'ET', ti: 'ER',
    om: 'ET', so: 'SO', ha: 'NG', yo: 'NG', ig: 'NG', zu: 'ZA', xh: 'ZA', af: 'ZA', st: 'ZA', sn: 'ZW',
    rw: 'RW', mg: 'MG', wo: 'SN', ln: 'CD', ny: 'MW', lg: 'UG', ht: 'HT', qu: 'PE', gn: 'PY', ay: 'BO',
    mi: 'NZ', sm: 'WS', to: 'TO', fj: 'FJ'
  };
  // Geen vlag-emoji's: elke taal draagt haar eigen ISO-code in een ingetogen,
  // goud-omlijnd plaatje - rustiger en volwassener dan een rij vlaggetjes.
  function vlag(code) {
    return '<span class="rtg-lang-code">' + String(code || '').toUpperCase() + '</span>';
  }
  // Kleine, functionele lijntekening voor spraakinvoer.
  const ICOON = {
    mic: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0"/><path d="M12 17v3.5"/></svg>'
  };
  // veelgebruikte land-/taalnamen die Rahul moet herkennen (genormaliseerd:
  // kleine letters, accenten eraf). De rest matcht op de eigen naam + Engelse naam.
  const ALIAS = {
    nederland: 'nl', holland: 'nl', netherlands: 'nl', vlaanderen: 'nl', belgie: 'nl', belgium: 'nl', suriname: 'nl',
    engels: 'en', engeland: 'en', england: 'en', britain: 'en', uk: 'en', amerika: 'en', america: 'en', usa: 'en', australie: 'en', australia: 'en', canada: 'en', ierland: 'en', ireland: 'en',
    duits: 'de', duitsland: 'de', germany: 'de', deutschland: 'de', oostenrijk: 'de', austria: 'de', zwitserland: 'de', switzerland: 'de',
    frans: 'fr', frankrijk: 'fr', france: 'fr',
    spaans: 'es', spanje: 'es', spain: 'es', espana: 'es', mexico: 'es', argentinie: 'es', argentina: 'es', colombia: 'es', chili: 'es', peru: 'es',
    portugees: 'pt', portugal: 'pt', brazilie: 'pt', brazil: 'pt', brasil: 'pt',
    italiaans: 'it', italie: 'it', italy: 'it', italia: 'it',
    griekenland: 'el', greece: 'el',
    turks: 'tr', turkije: 'tr', turkey: 'tr', turkiye: 'tr',
    russisch: 'ru', rusland: 'ru', russia: 'ru', oekraiens: 'uk', oekraine: 'uk', ukraine: 'uk', pools: 'pl', polen: 'pl', poland: 'pl',
    japans: 'ja', japan: 'ja', nippon: 'ja', china: 'zh', chinees: 'zh', chinese: 'zh', mandarijn: 'zh', mandarin: 'zh', taiwan: 'zh',
    koreaans: 'ko', korea: 'ko', hindi: 'hi', india: 'hi', bharat: 'hi', urdu: 'ur', pakistan: 'ur', bengali: 'bn',
    marokko: 'ar', morocco: 'ar', egypte: 'ar', egypt: 'ar', dubai: 'ar', arabisch: 'ar', arabic: 'ar', saoedi: 'ar',
    perzisch: 'fa', iran: 'fa', perzie: 'fa', persia: 'fa', israel: 'he', hebreeuws: 'he', hebrew: 'he',
    indonesisch: 'id', indonesie: 'id', indonesia: 'id', bali: 'id', thais: 'th', thailand: 'th', vietnamees: 'vi', vietnam: 'vi', filipijns: 'tl', filipijnen: 'tl', philippines: 'tl', maleis: 'ms', maleisie: 'ms', malaysia: 'ms',
    zweden: 'sv', sweden: 'sv', noorwegen: 'no', norway: 'no', denemarken: 'da', denmark: 'da', finland: 'fi', ijsland: 'is', iceland: 'is',
    swahili: 'sw', zuidafrika: 'af', kenia: 'sw', kenya: 'sw', tanzania: 'sw', ethiopie: 'am', ethiopia: 'am', nigeria: 'yo'
  };

  function detectDevice(codes) {
    const list = (navigator.languages && navigator.languages.length)
      ? navigator.languages : [navigator.language || 'nl'];
    for (const raw of list) {
      const code = String(raw || '').toLowerCase().slice(0, 2);
      if ((codes || supported()).includes(code)) return code;
    }
    return 'en'; // geen match: standaard Engels
  }

  const RTGi18n = {
    lang: 'nl',
    chosen: false,
    // UI-woordenboek: Nederlands staat in de HTML. Een kerntaal wordt pas
    // zichtbaar als elke Engelse woordenboeksleutel een echte vertaling heeft.
    dict(lang) {
      const all = window.I18N || {};
      if (lang === 'nl') return all.nl || {};
      const en = all.en || {};
      const own = all[lang] || {};
      if (lang !== 'en' && KERN.has(lang)) {
        const compleet = Object.keys(en).every(key => typeof en[key] !== 'string' ||
          (Object.prototype.hasOwnProperty.call(own, key) && typeof own[key] === 'string' && own[key].length > 0));
        if (!compleet) return Object.assign({}, en);
      }
      return Object.assign({}, en, own);
    },
    _usedKeys: new Set(),
    t(key, fallback) {
      this._usedKeys.add(key);
      if (this.lang === 'nl') return fallback != null ? fallback : key;
      const v = this.dict(this.lang)[key];
      if(v!=null)return v;
      const known=window.RTGUiBronTekst && window.RTGUiBronTekst(fallback);
      if(known!=null)return (this.lang!=='en' && window.RTGVertaalKast && window.RTGVertaalKast.lees(this.lang,fallback)) || known;
      return fallback != null ? fallback : key;
    },

    apply(lang) {
      lang = /^[a-z]{2}$/.test(String(lang || '')) ? lang : 'nl';
      this.lang = lang;
      document.documentElement.setAttribute('lang', lang);
      if (lang !== 'nl' && lang !== 'en') this.laadWereldDict(lang);
      const d = this.dict(lang);

      document.querySelectorAll('[data-i18n]').forEach(el => {
        if (!orig.has(el)) orig.set(el, {});
        const o = orig.get(el);
        const key=el.getAttribute('data-i18n');
        if (o.text == null || o.key !== key) { o.text=el.getAttribute('data-i18n-source') || el.textContent; o.key=key; }
        const val = d[el.getAttribute('data-i18n')];
        const policy=window.RTGAccessMeaning;
        if(policy && (key.startsWith('access.') || key.startsWith('onb.'))) {
          const projection=policy.projection(key,o.text,(window.I18N || {}).en && window.I18N.en[key],lang,val);
          el.textContent=projection.text; if(projection.fallback) el.setAttribute('lang',projection.language); else el.removeAttribute('lang');
        } else el.textContent = (val != null && lang !== 'nl') ? val : o.text;
      });

      document.querySelectorAll('[data-i18n-html]').forEach(el => {
        if (!orig.has(el)) orig.set(el, {});
        const o = orig.get(el);
        if (o.html == null) o.html = el.innerHTML;
        const val = d[el.getAttribute('data-i18n-html')];
        el.innerHTML = (val != null && lang !== 'nl') ? val : o.html;
      });

      for (const [binding,attribute] of [['data-i18n-aria','aria-label'],['data-i18n-title','title']]) {
        document.querySelectorAll('['+binding+']').forEach(el=>{
          if(!orig.has(el)) orig.set(el,{});
          const o=orig.get(el); if(o[attribute]==null) o[attribute]=el.getAttribute(attribute) || '';
          const value=d[el.getAttribute(binding)];
          el.setAttribute(attribute,lang!=='nl' && value!=null ? value:o[attribute]);
        });
      }

      document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        if (!orig.has(el)) orig.set(el, {});
        const o = orig.get(el);
        if (o.ph == null) o.ph = el.getAttribute('placeholder') || '';
        const val = d[el.getAttribute('data-i18n-ph')];
        el.setAttribute('placeholder', (val != null && lang !== 'nl') ? val : o.ph);
      });

      // Ook tekst zonder handmatig woordenboeksleuteltje en later door JS
      // getekende interface gaat via de centrale, gebatchte vangnetlaag.
      // Activeer dat vangnet pas na een opgeslagen of expliciete taalkeuze:
      // de voorgeselecteerde toestel-taal mag een Nederlandstalig scherm niet
      // al op de achtergrond half vertalen voordat de bezoeker kiest.
      if (window.RTGAutoVertaling) window.RTGAutoVertaling.apply(this.chosen ? lang : 'nl');

      this.updateSwitch();
      window.dispatchEvent(new CustomEvent('rtglang', { detail: { lang } }));
    },

    set(lang, remember) {
      if (remember !== false) { try { localStorage.setItem(STORE, lang); } catch (e) {} this.chosen = true; }
      const state=this._wereldDict[lang];
      if (state && !state.pending) state.tried.clear();
      this.apply(lang);
    },

    /* Wereldtaal-woordenboeken: voor elke taal buiten nl/en halen we het
       UI-woordenboek van DEZE pagina live vertaald op (/api/vertaal/ui). Zo
       draait elke pagina volledig in elke actieve wereldtaal; zonder AI-sleutel
       valt de server terug op het woordenboek en blijft de Engelse tekst staan
       waar hij het niet weet (nooit een kapot scherm).

       DIT WAS EEN TWEEDE OPSLAG, EN DAT KOSTTE TWEE KEER. De cachesleutel
       droeg het PAD van de pagina, dus "Opslaan" op scherm A en "Opslaan" op
       scherm B waren twee vertalingen: twee keer een modelaanroep, twee keer
       bewaard, en op de tweede pagina toch weer wachten. Het gaat nu langs
       dezelfde kast als de automatische laag (i18n-00.js), en die kent geen
       paden -- alleen taal en bron. Wat er al ligt kost daarmee GEEN aanvraag,
       ook niet de eerste keer dat dit scherm wordt geopend.

       EN HIJ VRAAGT ALLEEN WAT HIJ MIST. Van vierhonderd sleutels zijn er op de
       tweede pagina meestal een handvol nieuw; de rest komt uit de kast. */
    _wereldDict: {},
    async laadWereldDict(lang) {
      if (lang === 'nl' || lang === 'en') return;
      const state = this._wereldDict[lang] || (this._wereldDict[lang] = { pending:false, tried:new Map() });
      if (state.pending) return;
      const en = (window.I18N || {}).en || {};
      const own = (window.I18N || {})[lang] || {};
      const kast = window.RTGVertaalKast;
      const keys = Object.keys(en).filter(k => typeof en[k] === 'string' && en[k].length <= 300 &&
        !(window.RTGAccessMeaning && (k.startsWith('access.') || k.startsWith('onb.')) &&
          ['decision','legal'].includes(window.RTGAccessMeaning.risk(k))) &&
        own[k] == null && state.tried.get(k) !== en[k]);
      if (!keys.length) return;
      // The visible screen is first; every remaining key still has a bounded batch.
      keys.sort((a,b)=>Number(this._usedKeys.has(b))-Number(this._usedKeys.has(a)));
      state.pending = true;
      const out = {}, groups = [];
      let group = [], size = 0;
      keys.forEach(k => {
        const known = kast ? kast.lees(lang,en[k]) : null;
        if (known != null) { out[k]=known; return; }
        if (group.length && (group.length >= 100 || size + en[k].length > 18000)) {
          groups.push(group); group=[]; size=0;
        }
        group.push(k); size+=en[k].length;
      });
      if (group.length) groups.push(group);
      const publish = klaar => {
        window.I18N=window.I18N || {};
        window.I18N[lang]=Object.assign({},window.I18N[lang] || {},out);
        if (this.lang === lang && (!KERN.has(lang) || klaar)) this.apply(lang);
      };
      if (Object.keys(out).length && !KERN.has(lang)) publish(false);
      try {
        for (const batch of groups) {
          if (this.lang !== lang) break;
          const response = await fetch(apiPad('/api/vertaal/ui'), {method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({naar:lang,teksten:batch.map(k=>en[k])})});
          if (!response.ok) throw new Error('UI translation '+response.status);
          const data=await response.json();
          if (!data || data.naar!==lang || !Array.isArray(data.teksten) || data.teksten.length!==batch.length ||
            !Array.isArray(data.voltooid) || data.voltooid.length!==batch.length)
            throw new Error('Incomplete UI translation');
          batch.forEach((k,i)=>{
            state.tried.set(k,en[k]);
            const value=data.teksten[i];
            // Een provider kan een merknaam terecht ongewijzigd laten; daarom
            // bepaalt de server per regel of hij is afgehandeld.
            if(data.voltooid[i] && typeof value==='string' && value) {
              out[k]=value; if(kast && value!==en[k]) kast.zet(lang,en[k],value);
            }
          });
          if (!KERN.has(lang)) publish(false);
        }
      } catch (e) {
        // Keep the complete fallback. An explicit language choice can retry.
      } finally {
        state.pending=false;
        const klaar = Object.assign({}, own, out);
        const compleet = Object.keys(en).every(key => typeof en[key] !== 'string' ||
          (Object.prototype.hasOwnProperty.call(klaar, key) && typeof klaar[key] === 'string' && klaar[key].length > 0));
        if (compleet) publish(true);
      }
    },

    /* ---------- taalkeuze in de RTG-huisstijl ----------
       Een rustige zoekingang, enkele directe keuzes en dezelfde donkere,
       gouden systeemlaag als de rest van de website. */
    zoekTaal(q) {
      const lijst = this._lijst || [];
      const n = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      const qq = n(q);
      if (!qq) return { code: null, set: new Set(lijst.map(t => t.code)) };
      const set = new Set(); let best = null, bestScore = 0;
      const weeg = (code, sc) => { set.add(code); if (sc > bestScore) { bestScore = sc; best = code; } };
      for (const t of lijst) {
        const naam = n(t.naam), en = n(t.en || ''), code = t.code, iso = (LAND[code] || '').toLowerCase();
        let sc = 0;
        if (code === qq) sc = 100;
        else if (naam === qq || en === qq) sc = 92;
        else if (naam.startsWith(qq)) sc = 82;
        else if (en.startsWith(qq)) sc = 74;
        else if (naam.includes(qq)) sc = 60;
        else if (en.includes(qq)) sc = 52;
        else if (iso === qq) sc = 40;
        if (sc > 0) weeg(code, sc);
      }
      // land-/bijnamen: "holland", "japan", "brazilie" -> de juiste taal
      for (const k in ALIAS) {
        if (k === qq || k.includes(qq) || qq.includes(k)) {
          const c = ALIAS[k];
          if (lijst.some(t => t.code === c)) weeg(c, k === qq ? 96 : 66);
        }
      }
      return { code: best, set };
    },
    buildModal(recommended) {
      const oud = document.getElementById('rtg-lang-modal');
      const stondOpen = oud && oud.classList.contains('open');
      if (oud) oud.remove(); // opnieuw opbouwen zodra de wereldtalen binnen zijn
      const scrim = document.createElement('div');
      scrim.id = 'rtg-lang-modal';
      scrim.className = 'rtg-lang-scrim';
      scrim.setAttribute('data-i18n-ignore', '');
      // de matcher kent de HELE wereld (alle 114) als die binnen is; anders de
      // actieve set. De bezoeker kiest door een land of taal te typen of uit te
      // spreken. Daarna verschijnt één duidelijke keuze.
      this._lijst = this._alleTalen || WERELD || Object.keys(LANGS).map(c => ({ code: c, naam: LANGS[c].native, en: LANGS[c].label }));
      this._aanbevolen = recommended || 'en';
      const kanSpreken = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
      const tekst = {
        aria: this.t('language.chooser.aria', 'Kies uw taal'),
        label: this.t('language.chooser.label', 'Taal'),
        titel: this.t('language.chooser.title', 'Kies uw taal'),
        uitleg: this.t('language.chooser.explanation', 'Zoek op taal of land. RTG onthoudt uw keuze op dit apparaat.'),
        veld: this.t('language.chooser.field', 'Taal of land'),
        placeholder: this.t('language.chooser.placeholder', 'Bijvoorbeeld Nederlands of Nederland'),
        spreek: this.t('language.chooser.speak', 'Spreek uw taal in'),
        kies: this.t('language.chooser.choose', 'Kiezen'),
        snel: this.t('language.chooser.quick', 'Direct kiezen'),
        verder: this.t('language.chooser.continue', 'Verder'),
        nietGevonden: this.t('language.chooser.not_found', 'Taal niet gevonden. Probeer een andere naam.'),
        sluit: this.t('language.chooser.close', 'Taalkeuze sluiten')
      };
      const veilig = value => String(value || '').replace(/[&<>\"]/g, teken => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;' })[teken]);
      const snelCodes = [this._aanbevolen, this.lang, 'nl', 'en', 'de', 'fr', 'es', 'ar']
        .filter((code, index, all) => code && all.indexOf(code) === index)
        .filter(code => this._lijst.some(taal => taal.code === code))
        .slice(0, 4);
      const snelleKeuzes = snelCodes.map(code => {
        const taal = this._lijst.find(item => item.code === code) || {};
        return '<button type="button" class="rtg-lang-quick' + (code === this._aanbevolen ? ' is-active' : '') + '" data-lang="' + code + '">' +
          vlag(code) + '<span>' + veilig(taal.naam || taal.en || code) + '</span></button>';
      }).join('');
      scrim.innerHTML =
        '<div class="rtg-lang-card" role="dialog" aria-modal="true" aria-label="' + tekst.aria + '">' +
          '<div class="rtg-lang-head"><span class="rtg-lang-eyebrow">RTG ' + tekst.label + '</span>' +
            '<button type="button" class="rtg-lang-close" aria-label="' + tekst.sluit + '">' +
              '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
            '</button></div>' +
          '<h2>' + tekst.titel + '</h2>' +
          '<p>' + tekst.uitleg + '</p>' +
          '<label class="rtg-lang-label" for="rtg-lang-zoek">' + tekst.veld + '</label>' +
          '<div class="rtg-lang-search">' +
            (kanSpreken ? '<button type="button" id="rtg-lang-mic" aria-label="' + tekst.spreek + '">' + ICOON.mic + '</button>' : '') +
            '<input id="rtg-lang-zoek" autocomplete="off" enterkeyhint="go" ' +
              'aria-label="' + tekst.veld + '" placeholder="' + tekst.placeholder + '">' +
            '<button type="button" id="rtg-lang-submit">' + tekst.kies + '</button>' +
          '</div>' +
          '<button type="button" class="rtg-lang-hint" id="rtg-lang-hint" hidden></button>' +
          (snelleKeuzes ? '<div class="rtg-lang-quick-wrap"><span>' + tekst.snel + '</span><div class="rtg-lang-quick-grid">' + snelleKeuzes + '</div></div>' : '') +
        '</div>';
      document.body.appendChild(scrim);

      const zoek = scrim.querySelector('#rtg-lang-zoek');
      const hint = scrim.querySelector('#rtg-lang-hint');
      const self = this;
      // Toon één passende taalnaam die de bezoeker kan aantikken.
      const stelVoor = () => {
        const res = self.zoekTaal(zoek.value.trim());
        if (!zoek.value.trim() || !res.code) {
          hint.hidden = true; hint.removeAttribute('data-lang');
          hint.disabled = false;
          if (zoek.value.trim()) {
            hint.hidden = false; hint.disabled = true; hint.removeAttribute('data-lang');
            hint.innerHTML = '<span class="rtg-lang-mis">' + tekst.nietGevonden + '</span>';
          }
          return;
        }
        const t = self._lijst.find(x => x.code === res.code) || {};
        hint.hidden = false; hint.disabled = false;
        hint.setAttribute('data-lang', res.code);
        hint.innerHTML = vlag(res.code) +
          '<span class="rtg-lang-sug"><b>' + veilig(t.naam || res.code) + '</b>' +
          '<span class="rtg-lang-go">' + tekst.verder + '</span></span>';
      };
      const kies = (code) => {
        code = code || self.zoekTaal(zoek.value.trim()).code || self._aanbevolen;
        if (code) { self.set(code); self.closeModal(); }
      };
      zoek.addEventListener('input', stelVoor);
      zoek.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); kies(); } });
      scrim.querySelector('#rtg-lang-submit').addEventListener('click', () => kies());
      hint.addEventListener('click', () => kies(hint.getAttribute('data-lang')));
      scrim.querySelectorAll('.rtg-lang-quick').forEach(button => {
        button.addEventListener('click', () => kies(button.getAttribute('data-lang')));
      });
      scrim.querySelector('.rtg-lang-close').addEventListener('click', () => self.closeModal());
      // spreken: de eigen stem invullen en meteen laten herkennen
      const mic = scrim.querySelector('#rtg-lang-mic');
      if (mic) mic.addEventListener('click', () => self._luister(zoek, stelVoor, kies, mic));

      // De keuze mag nooit de pagina gijzelen: klik ernaast = huidige taal houden.
      scrim.addEventListener('click', e => { if (e.target === scrim) { self.set(self.lang); self.closeModal(); } });
      if (!this._escBound) { // een keer, niet per herbouw
        this._escBound = true;
        document.addEventListener('keydown', e => {
          const m = document.getElementById('rtg-lang-modal');
          if (e.key === 'Escape' && m && m.classList.contains('open')) { this.set(this.lang); this.closeModal(); }
        });
      }
      if (stondOpen) scrim.classList.add('open');
    },
    // spreken -> tekst (Web Speech API, geen afhankelijkheden). Lukt het niet,
    // dan gebeurt er gewoon niets bijzonders; typen blijft altijd werken.
    _luister(zoek, stelVoor, kies, mic) {
      const R = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!R) return;
      try {
        const rec = new R();
        rec.lang = (navigator.language || 'en'); rec.interimResults = false; rec.maxAlternatives = 1;
        mic.classList.add('luistert');
        rec.onresult = (ev) => {
          const tekst = (ev.results && ev.results[0] && ev.results[0][0] && ev.results[0][0].transcript) || '';
          if (tekst) { zoek.value = tekst; stelVoor(); const code = this.zoekTaal(tekst).code; if (code) kies(code); }
        };
        rec.onend = () => mic.classList.remove('luistert');
        rec.onerror = () => mic.classList.remove('luistert');
        rec.start();
      } catch (e) { mic.classList.remove('luistert'); }
    },
    openModal() {
      this._taalTerug = document.activeElement;
      const bestaand = document.getElementById('rtg-lang-modal');
      if (bestaand) bestaand.remove();
      this.buildModal(this.chosen ? this.lang : (this._aanbevolen || detectDevice()));
      const m = document.getElementById('rtg-lang-modal'); if (m) m.classList.add('open');
      const z = document.getElementById('rtg-lang-zoek');
      if (z) setTimeout(() => { try { z.focus(); } catch (e) {} }, 80);
    },
    closeModal() {
      const m = document.getElementById('rtg-lang-modal');
      if (m) m.classList.remove('open');
      const terug = this._taalTerug;
      if (terug && typeof terug.focus === 'function') setTimeout(() => { try { terug.focus(); } catch (e) {} }, 0);
    },

    /* ---------- de taalkeuze heropenen ----------
       De taalknop zweefde linksonder op elk scherm, boven op de themakiezer en
       het vraagteken. Taal is een instelling, dus hij staat nu waar de andere
       instellingen staan: in het bedieningspaneel (shared/bediening.js), dat
       openModal() aanroept. Het leden-OS deed dit al met de tegel "Taal". */
    buildSwitch() {
      const self = this;
      document.querySelectorAll('[data-language-picker]').forEach(function (button) {
        if (button.hasAttribute('data-language-picker-ready')) return;
        button.setAttribute('data-language-picker-ready', 'true');
        button.addEventListener('click', function () { self.openModal(); });
      });
    },
    /* updateSwitch bijgewerkt de knop die er niet meer is. Hij zocht nog naar
       #rtg-lang-switch, en dat element staat sinds de verhuizing naar het
       bedieningspaneel op geen enkele pagina meer -- de blindevlek-toets ving
       het. Het paneel leest de taal vers uit bij elke opening (vulTaal in
       shared/bediening.js), dus er valt hier niets bij te werken. De methode
       blijft bestaan omdat applyTranslations() hem aanroept en losse pagina's
       hem kunnen overschrijven; hij doet alleen niets meer. */
    updateSwitch() { /* geen zwevende knop meer; het paneel leest zelf uit */ },

    injectStyles() {
      if (document.getElementById('rtg-i18n-styles')) return;
      const s = document.createElement('style');
      s.id = 'rtg-i18n-styles';
      s.textContent = `
      .rtg-lang-scrim{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;overflow:auto;
        background:rgba(7,7,6,0.76);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
        padding:max(1rem,env(safe-area-inset-top,0px)) max(1rem,env(safe-area-inset-right,0px))
          max(1rem,env(safe-area-inset-bottom,0px)) max(1rem,env(safe-area-inset-left,0px));-webkit-font-smoothing:antialiased;}
      .rtg-lang-scrim.open{display:flex;}
      .rtg-lang-card,.rtg-lang-card *{box-sizing:border-box;}
      .rtg-lang-card{position:relative;isolation:isolate;width:100%;max-width:560px;max-height:min(92vh,760px);overflow:auto;
        display:flex;flex-direction:column;background:linear-gradient(155deg,#191712 0%,#0C0B09 68%);color:#F5F0E7;
        border:1px solid rgba(225,192,122,0.48);border-radius:var(--rtg-radius-system,22px);padding:1.4rem 1.45rem 1.5rem;text-align:left;
        box-shadow:0 32px 90px rgba(0,0,0,0.58),inset 0 1px 0 rgba(255,255,255,0.05);
        font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;animation:rtgLangIn .4s cubic-bezier(.2,.8,.2,1);}
      @keyframes rtgLangIn{from{opacity:0;transform:translateY(16px) scale(.98);}to{opacity:1;transform:none;}}
      .rtg-lang-head{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:0.85rem;}
      .rtg-lang-eyebrow{font-size:0.64rem;font-weight:650;line-height:1;letter-spacing:0.19em;text-transform:uppercase;color:#D8B873;}
      .rtg-lang-close{display:grid;place-items:center;width:2.45rem;height:2.45rem;flex:0 0 auto;padding:0;color:#F5F0E7;
        background:rgba(255,255,255,0.035);border:1px solid rgba(245,240,231,0.2);border-radius:50%;cursor:pointer;}
      .rtg-lang-close:hover{border-color:#D8B873;background:rgba(216,184,115,0.09);}
      .rtg-lang-close:focus-visible,.rtg-lang-search button:focus-visible,.rtg-lang-hint:focus-visible,.rtg-lang-quick:focus-visible{outline:2px solid #F2D99E;outline-offset:3px;}
      .rtg-lang-card h2{font-family:'Bodoni Moda',Georgia,serif;font-weight:500;font-size:clamp(2rem,6vw,3rem);line-height:0.98;
        margin:0;letter-spacing:-0.025em;color:#FAF6EF;}
      .rtg-lang-card>p{max-width:29rem;color:#B9B2A6;font-size:0.86rem;line-height:1.55;margin:0.65rem 0 1.25rem;}
      .rtg-lang-label{display:block;margin-bottom:0.42rem;color:#D8B873;font-size:0.62rem;font-weight:650;letter-spacing:0.14em;text-transform:uppercase;}
      .rtg-lang-search{display:flex;align-items:center;gap:0.4rem;width:100%;min-height:3.55rem;background:rgba(255,255,255,0.035);
        border:1px solid rgba(245,240,231,0.22);border-radius:var(--rtg-radius-content,2px);padding:0.3rem 0.32rem 0.3rem 0.75rem;margin:0 0 0.7rem;
        transition:border-color .18s,background .18s;}
      .rtg-lang-search:focus-within{border-color:#D8B873;background:rgba(216,184,115,0.055);}
      .rtg-lang-search input{flex:1;min-width:0;background:none;border:none;outline:none;color:#F5F3EF;font-family:inherit;font-size:0.88rem;padding:0.7rem 0;}
      .rtg-lang-search input::placeholder{color:#817C74;}
      .rtg-lang-search button{flex:none;min-height:2.8rem;background:#D8B873;color:#17140F;border:1px solid #D8B873;cursor:pointer;
        border-radius:var(--rtg-radius-content,2px);padding:0.65rem 0.9rem;font-family:inherit;font-size:0.73rem;font-weight:700;line-height:1;letter-spacing:0.05em;
        transition:filter .18s,transform .12s,background .18s;}
      .rtg-lang-search button:hover{background:#E8CE95;filter:none;}
      .rtg-lang-search button:active{transform:scale(0.95);}
      #rtg-lang-mic{display:grid;place-items:center;min-width:2.8rem;padding:0;background:rgba(255,255,255,0.045);color:#E9DFCC;
        border-color:rgba(245,240,231,0.17);}
      #rtg-lang-mic.luistert{background:#D8B873;color:#17140F;animation:rtgMic 1.1s ease-in-out infinite;}
      @keyframes rtgMic{0%,100%{box-shadow:0 0 0 0 rgba(216,184,115,0.46);}50%{box-shadow:0 0 0 6px rgba(216,184,115,0);}}
      .rtg-lang-hint{display:flex;align-items:center;gap:0.75rem;width:100%;margin:0 0 0.9rem;background:rgba(216,184,115,0.08);
        border:1px solid rgba(216,184,115,0.62);border-radius:var(--rtg-radius-content,2px);padding:0.75rem 0.85rem;cursor:pointer;text-align:left;
        font-family:inherit;color:#EDE9E2;transition:border-color .16s,background .16s,transform .12s;}
      .rtg-lang-hint:hover{border-color:#F2D99E;background:rgba(216,184,115,0.14);}
      .rtg-lang-hint:active{transform:scale(0.99);}
      .rtg-lang-hint[hidden]{display:none;}
      .rtg-lang-hint:disabled{cursor:default;border-color:rgba(245,240,231,0.16);background:rgba(255,255,255,0.025);}
      .rtg-lang-sug{display:flex;flex-direction:column;line-height:1.2;}
      .rtg-lang-sug b{color:#FAF6EF;font-weight:600;font-size:0.95rem;}
      .rtg-lang-go{margin-top:0.16rem;font-size:0.62rem;letter-spacing:0.09em;text-transform:uppercase;color:#D8B873;}
      .rtg-lang-mis{color:#A8A198;font-size:0.8rem;line-height:1.4;}
      .rtg-lang-quick-wrap{margin-top:0.15rem;padding-top:0.95rem;border-top:1px solid rgba(245,240,231,0.12);}
      .rtg-lang-quick-wrap>span{display:block;margin-bottom:0.55rem;color:#918B82;font-size:0.61rem;font-weight:650;letter-spacing:0.14em;text-transform:uppercase;}
      .rtg-lang-quick-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0.55rem;}
      .rtg-lang-quick{display:flex;align-items:center;gap:0.65rem;min-width:0;min-height:3.55rem;padding:0.65rem 0.75rem;color:#EDE8DF;
        background:rgba(255,255,255,0.025);border:1px solid rgba(245,240,231,0.16);border-radius:var(--rtg-radius-content,2px);font-family:inherit;text-align:left;
        cursor:pointer;transition:border-color .16s,background .16s,transform .12s;}
      .rtg-lang-quick:hover,.rtg-lang-quick.is-active{border-color:#D8B873;background:rgba(216,184,115,0.09);}
      .rtg-lang-quick:active{transform:scale(0.985);}
      .rtg-lang-quick>span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:0.82rem;font-weight:560;white-space:nowrap;}
      .rtg-lang-code{display:inline-grid;place-items:center;min-width:2rem;height:2rem;flex:0 0 auto;font-size:0.58rem;font-weight:750;
        letter-spacing:0.08em;color:#D8B873;border:1px solid rgba(216,184,115,0.46);border-radius:var(--rtg-radius-content,2px);padding:0 0.3rem;text-align:center;}
      [dir="rtl"] .rtg-lang-card,[dir="rtl"] .rtg-lang-hint,[dir="rtl"] .rtg-lang-quick{text-align:right;}
      @media(max-width:600px){
        .rtg-lang-scrim{align-items:flex-end;padding:0.75rem max(0.75rem,env(safe-area-inset-right,0px)) max(0.75rem,env(safe-area-inset-bottom,0px)) max(0.75rem,env(safe-area-inset-left,0px));}
        .rtg-lang-card{max-height:calc(100dvh - 1.5rem);border-radius:var(--rtg-radius-system,22px);padding:1.15rem 1rem 1.05rem;}
        .rtg-lang-card h2{font-size:2.1rem;}
        .rtg-lang-card>p{font-size:0.8rem;margin-bottom:1rem;}
        .rtg-lang-search{min-height:3.3rem;padding-left:0.55rem;}
        .rtg-lang-search input{font-size:0.82rem;}
        .rtg-lang-search button{min-height:2.55rem;padding:0.55rem 0.65rem;}
        #rtg-lang-mic{min-width:2.55rem;}
        .rtg-lang-quick{min-height:3.25rem;padding:0.55rem 0.6rem;}
      }
      .rtg-lang-switch{position:fixed;left:14px;bottom:14px;z-index:9990;display:inline-flex;align-items:center;gap:0.35rem;
        background:rgba(12,12,11,0.82);color:#fff;border:1px solid rgba(255,255,255,0.16);border-radius:0;
        padding:0.42rem 0.8rem;font-family:'Inter',-apple-system,sans-serif;font-size:0.72rem;font-weight:600;
        letter-spacing:0.04em;cursor:pointer;backdrop-filter:blur(8px);box-shadow:0 6px 20px rgba(0,0,0,0.25);
        transition:background .18s;padding-bottom:calc(0.42rem + env(safe-area-inset-bottom,0));}
      .rtg-lang-switch:hover{background:#7F1634;border-color:#7F1634;}
      .rtg-sw-globe{font-size:0.9rem;}
      @media print{.rtg-lang-switch{display:none;}}
      /* Toegankelijkheid: wie in het systeem "beperk beweging" aan heeft, krijgt
         geen animaties of lange overgangen. 0.01ms i.p.v. 0 zodat code die op
         transitionend/animationend wacht gewoon blijft doorlopen. */
      @media (prefers-reduced-motion: reduce){
        *,*::before,*::after{
          animation-duration:.01ms!important;animation-iteration-count:1!important;
          transition-duration:.01ms!important;scroll-behavior:auto!important;
        }
      }
      `;
      document.head.appendChild(s);
    },

    /* De actieve wereldtalen ophalen (Boardroom-schakelaars). Faalt dit (bijv.
       op de noodserver), dan blijven Nederlands en Engels gewoon werken. */
    laadTalen() {
      return fetch(apiPad('/api/talen'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then(r => r.json())
        .then(d => {
          if (Array.isArray(d.talen) && d.talen.length >= 2) {
            WERELD = d.talen; // de actieve set (voor de vertaling)
            // de matcher kent meteen de HELE wereld (alle 114) voor typen/spreken
            this._alleTalen = (Array.isArray(d.alle) && d.alle.length) ? d.alle : d.talen;
            // Dezelfde 24 kerntalen als op www staan vooraan; de overige
            // wereldtalen blijven vindbaar via land- of taalnaam.
            this._alleTalen = this._alleTalen.slice().sort((a, b) =>
              Number(!!b.kern) - Number(!!a.kern));
            this._lijst = this._alleTalen;
            // De site volgt de telefooninstelling: nu de hele wereld bekend is,
            // kiezen we alsnog de toesteltaal (bijv. Duits of Japans), tenzij het
            // lid zelf al een taal heeft gekozen. Engels blijft de terugval.
            if (!this.chosen) {
              const codes = this._alleTalen.map(t => t.code);
              const dev = detectDevice(codes);
              if (dev && dev !== this.lang) this.apply(dev);
              this._aanbevolen = dev;
            }
            const m = document.getElementById('rtg-lang-modal');
            if (!m || !m.classList.contains('open')) this.buildModal(this._aanbevolen || this.lang);
          }
        })
        .catch(() => {});
    },

    init() {
      this.injectStyles();
      let saved = null;
      try { saved = localStorage.getItem(STORE); } catch (e) {}
      // De site volgt standaard de TELEFOON-/toestelinstelling (navigator.language);
      // kan hij die taal (nog) niet, dan Engels als terugval. Er is geen gedwongen
      // taalkeuze: wie wil wisselen opent de kiezer (de wereldbol linksonder) en
      // typt of spreekt zijn taal. Een eerder gemaakte keuze blijft bewaard.
      if (saved && /^[a-z]{2}$/.test(saved)) {
        this.chosen = true;
        this.apply(saved);
      } else {
        this.apply(detectDevice()); // toesteltaal onder nl/en; laadTalen verruimt straks naar alle 114
      }
      this.buildSwitch();
      this.laadTalen();
    }
  };

  window.addEventListener('storage',event=>{
    if(event.key===STORE && /^[a-z]{2}$/.test(event.newValue || '')) { RTGi18n.chosen=true; RTGi18n.set(event.newValue,false); }
  });
  window.RTGi18n = RTGi18n;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RTGi18n.init());
  } else {
    RTGi18n.init();
  }
})();
