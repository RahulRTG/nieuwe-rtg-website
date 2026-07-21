/* Wereldtalen (server/talen.js).

   Het register van alle talen die RTG kan voeren, met per taal de eigen naam
   (endoniem) en de Engelse naam (voor de vertaal-AI). De RTG Boardroom zet per
   taal een schakelaar aan of uit; alleen actieve talen zijn te kiezen in de
   apps. Nederlands en Engels zijn de basistalen en staan altijd aan.

   Iedereen chat in de eigen taal en de ander leest alles in de zijne: elk
   bericht draagt zijn brontaal (m.lang) en de leespaden vertalen per kijker
   (trChat + translate.js, met een cache per bericht per taal). Dit register
   bepaalt alleen WELKE talen meedoen; het vertalen zelf zit in translate.js. */

const TALEN = [
  // basis (altijd aan)
  { code: 'nl', naam: 'Nederlands', en: 'Dutch' },
  { code: 'en', naam: 'English', en: 'English' },
  // Europa
  { code: 'de', naam: 'Deutsch', en: 'German' },
  { code: 'fr', naam: 'Français', en: 'French' },
  { code: 'es', naam: 'Español', en: 'Spanish' },
  { code: 'pt', naam: 'Português', en: 'Portuguese' },
  { code: 'it', naam: 'Italiano', en: 'Italian' },
  { code: 'ca', naam: 'Català', en: 'Catalan' },
  { code: 'gl', naam: 'Galego', en: 'Galician' },
  { code: 'eu', naam: 'Euskara', en: 'Basque' },
  { code: 'ro', naam: 'Română', en: 'Romanian' },
  { code: 'el', naam: 'Ελληνικά', en: 'Greek' },
  { code: 'tr', naam: 'Türkçe', en: 'Turkish' },
  { code: 'ru', naam: 'Русский', en: 'Russian' },
  { code: 'uk', naam: 'Українська', en: 'Ukrainian' },
  { code: 'be', naam: 'Беларуская', en: 'Belarusian' },
  { code: 'pl', naam: 'Polski', en: 'Polish' },
  { code: 'cs', naam: 'Čeština', en: 'Czech' },
  { code: 'sk', naam: 'Slovenčina', en: 'Slovak' },
  { code: 'hu', naam: 'Magyar', en: 'Hungarian' },
  { code: 'bg', naam: 'Български', en: 'Bulgarian' },
  { code: 'sr', naam: 'Српски', en: 'Serbian' },
  { code: 'hr', naam: 'Hrvatski', en: 'Croatian' },
  { code: 'bs', naam: 'Bosanski', en: 'Bosnian' },
  { code: 'sl', naam: 'Slovenščina', en: 'Slovenian' },
  { code: 'mk', naam: 'Македонски', en: 'Macedonian' },
  { code: 'sq', naam: 'Shqip', en: 'Albanian' },
  { code: 'lt', naam: 'Lietuvių', en: 'Lithuanian' },
  { code: 'lv', naam: 'Latviešu', en: 'Latvian' },
  { code: 'et', naam: 'Eesti', en: 'Estonian' },
  { code: 'fi', naam: 'Suomi', en: 'Finnish' },
  { code: 'sv', naam: 'Svenska', en: 'Swedish' },
  { code: 'no', naam: 'Norsk', en: 'Norwegian' },
  { code: 'da', naam: 'Dansk', en: 'Danish' },
  { code: 'is', naam: 'Íslenska', en: 'Icelandic' },
  { code: 'ga', naam: 'Gaeilge', en: 'Irish' },
  { code: 'cy', naam: 'Cymraeg', en: 'Welsh' },
  { code: 'mt', naam: 'Malti', en: 'Maltese' },
  { code: 'lb', naam: 'Lëtzebuergesch', en: 'Luxembourgish' },
  { code: 'fy', naam: 'Frysk', en: 'West Frisian' },
  { code: 'yi', naam: 'ייִדיש', en: 'Yiddish' },
  // Midden-Oosten & Centraal-Azië
  { code: 'ar', naam: 'العربية', en: 'Arabic' },
  { code: 'he', naam: 'עברית', en: 'Hebrew' },
  { code: 'fa', naam: 'فارسی', en: 'Persian' },
  { code: 'ku', naam: 'Kurdî', en: 'Kurdish' },
  { code: 'az', naam: 'Azərbaycanca', en: 'Azerbaijani' },
  { code: 'hy', naam: 'Հայերեն', en: 'Armenian' },
  { code: 'ka', naam: 'ქართული', en: 'Georgian' },
  { code: 'kk', naam: 'Қазақша', en: 'Kazakh' },
  { code: 'uz', naam: 'Oʻzbekcha', en: 'Uzbek' },
  { code: 'ky', naam: 'Кыргызча', en: 'Kyrgyz' },
  { code: 'tg', naam: 'Тоҷикӣ', en: 'Tajik' },
  { code: 'tk', naam: 'Türkmençe', en: 'Turkmen' },
  { code: 'mn', naam: 'Монгол', en: 'Mongolian' },
  { code: 'tt', naam: 'Татарча', en: 'Tatar' },
  // Zuid-Azië
  { code: 'hi', naam: 'हिन्दी', en: 'Hindi' },
  { code: 'ur', naam: 'اردو', en: 'Urdu' },
  { code: 'bn', naam: 'বাংলা', en: 'Bengali' },
  { code: 'pa', naam: 'ਪੰਜਾਬੀ', en: 'Punjabi' },
  { code: 'gu', naam: 'ગુજરાતી', en: 'Gujarati' },
  { code: 'mr', naam: 'मराठी', en: 'Marathi' },
  { code: 'ta', naam: 'தமிழ்', en: 'Tamil' },
  { code: 'te', naam: 'తెలుగు', en: 'Telugu' },
  { code: 'kn', naam: 'ಕನ್ನಡ', en: 'Kannada' },
  { code: 'ml', naam: 'മലയാളം', en: 'Malayalam' },
  { code: 'si', naam: 'සිංහල', en: 'Sinhala' },
  { code: 'ne', naam: 'नेपाली', en: 'Nepali' },
  { code: 'ps', naam: 'پښتو', en: 'Pashto' },
  { code: 'sd', naam: 'سنڌي', en: 'Sindhi' },
  { code: 'or', naam: 'ଓଡ଼ିଆ', en: 'Odia' },
  { code: 'as', naam: 'অসমীয়া', en: 'Assamese' },
  { code: 'dv', naam: 'ދިވެހި', en: 'Dhivehi' },
  { code: 'bo', naam: 'བོད་སྐད', en: 'Tibetan' },
  // Oost- & Zuidoost-Azië
  { code: 'zh', naam: '中文', en: 'Chinese' },
  { code: 'ja', naam: '日本語', en: 'Japanese' },
  { code: 'ko', naam: '한국어', en: 'Korean' },
  { code: 'th', naam: 'ไทย', en: 'Thai' },
  { code: 'vi', naam: 'Tiếng Việt', en: 'Vietnamese' },
  { code: 'id', naam: 'Bahasa Indonesia', en: 'Indonesian' },
  { code: 'jv', naam: 'Basa Jawa', en: 'Javanese' },
  { code: 'su', naam: 'Basa Sunda', en: 'Sundanese' },
  { code: 'ms', naam: 'Bahasa Melayu', en: 'Malay' },
  { code: 'tl', naam: 'Filipino', en: 'Filipino' },
  { code: 'km', naam: 'ខ្មែរ', en: 'Khmer' },
  { code: 'lo', naam: 'ລາວ', en: 'Lao' },
  { code: 'my', naam: 'မြန်မာ', en: 'Burmese' },
  { code: 'ug', naam: 'ئۇيغۇرچە', en: 'Uyghur' },
  // Afrika
  { code: 'sw', naam: 'Kiswahili', en: 'Swahili' },
  { code: 'am', naam: 'አማርኛ', en: 'Amharic' },
  { code: 'ti', naam: 'ትግርኛ', en: 'Tigrinya' },
  { code: 'om', naam: 'Afaan Oromoo', en: 'Oromo' },
  { code: 'so', naam: 'Soomaali', en: 'Somali' },
  { code: 'ha', naam: 'Hausa', en: 'Hausa' },
  { code: 'yo', naam: 'Yorùbá', en: 'Yoruba' },
  { code: 'ig', naam: 'Igbo', en: 'Igbo' },
  { code: 'zu', naam: 'isiZulu', en: 'Zulu' },
  { code: 'xh', naam: 'isiXhosa', en: 'Xhosa' },
  { code: 'af', naam: 'Afrikaans', en: 'Afrikaans' },
  { code: 'st', naam: 'Sesotho', en: 'Sotho' },
  { code: 'sn', naam: 'chiShona', en: 'Shona' },
  { code: 'rw', naam: 'Kinyarwanda', en: 'Kinyarwanda' },
  { code: 'mg', naam: 'Malagasy', en: 'Malagasy' },
  { code: 'wo', naam: 'Wolof', en: 'Wolof' },
  { code: 'ln', naam: 'Lingála', en: 'Lingala' },
  { code: 'ny', naam: 'Chichewa', en: 'Chichewa' },
  { code: 'lg', naam: 'Luganda', en: 'Ganda' },
  // Amerika & Oceanië
  { code: 'ht', naam: 'Kreyòl ayisyen', en: 'Haitian Creole' },
  { code: 'qu', naam: 'Runasimi', en: 'Quechua' },
  { code: 'gn', naam: 'Avañeʼẽ', en: 'Guarani' },
  { code: 'ay', naam: 'Aymar aru', en: 'Aymara' },
  { code: 'mi', naam: 'Te reo Māori', en: 'Maori' },
  { code: 'sm', naam: 'Gagana Sāmoa', en: 'Samoan' },
  { code: 'to', naam: 'Lea faka-Tonga', en: 'Tongan' },
  { code: 'fj', naam: 'Vosa Vakaviti', en: 'Fijian' }
];

const OP_CODE = new Map(TALEN.map(t => [t.code, t]));
const BASIS = ['nl', 'en']; // altijd aan; kan niet uit

function bestaat(code) { return OP_CODE.has(String(code || '').toLowerCase()); }
function taal(code) { return OP_CODE.get(String(code || '').toLowerCase()) || null; }
function naamEn(code) { const t = taal(code); return t ? t.en : 'English'; }

/* De beheerde laag: welke talen staan aan. Bewaard in db.data.talen.actief. */
function maakTalen({ db, save }) {
  function actieveSet() {
    if (!db.data.talen || !Array.isArray(db.data.talen.actief)) db.data.talen = { actief: BASIS.slice() };
    for (const b of BASIS) if (!db.data.talen.actief.includes(b)) db.data.talen.actief.push(b);
    return db.data.talen.actief;
  }
  function isActief(code) { return actieveSet().includes(String(code || '').toLowerCase()); }
  // volledige lijst met aan/uit-status, voor de Boardroom
  function alle() {
    const set = new Set(actieveSet());
    return TALEN.map(t => ({ code: t.code, naam: t.naam, en: t.en, aan: set.has(t.code), basis: BASIS.includes(t.code) }));
  }
  // alleen de actieve talen, voor de taalkiezers in de apps
  function actieve() {
    const set = new Set(actieveSet());
    return TALEN.filter(t => set.has(t.code)).map(t => ({ code: t.code, naam: t.naam, en: t.en }));
  }
  // schakelaar; de basistalen kunnen niet uit
  function zet(code, aan) {
    code = String(code || '').toLowerCase();
    if (!bestaat(code)) return { error: 'Deze taal kennen we niet.', status: 404 };
    if (!aan && BASIS.includes(code)) return { error: 'Nederlands en Engels zijn de basistalen en blijven altijd aan.', status: 409 };
    const set = actieveSet();
    const i = set.indexOf(code);
    if (aan && i === -1) set.push(code);
    if (!aan && i !== -1) set.splice(i, 1);
    save();
    return { ok: true, code, aan: set.includes(code) };
  }
  /* De taal van een verzoek: elke ACTIEVE taal mag, anders Nederlands. Dit
     vervangt de oude nl/en-klem op alle chat- en vertaalpaden. */
  function taalVan(bodyLang) {
    const code = String(bodyLang || '').toLowerCase();
    return isActief(code) ? code : 'nl';
  }
  return { alle, actieve, isActief, zet, taalVan };
}

module.exports = { TALEN, BASIS, bestaat, taal, naamEn, maakTalen };
