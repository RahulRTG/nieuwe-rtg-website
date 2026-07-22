/* De pestgrens (kern/pestgrens): Rahul is warm en geduldig, maar respect is
   bij hem de basis. Wie hem uitscheldt of pest, krijgt drie duidelijke
   waarschuwingen. Gaat het daarna door, dan volgt EEN vurig antwoord, waarin
   ook doorklinkt dat hij hier zelf geen enkele zin in of behoefte aan had,
   en stopt het gesprek per direct: Rahul is 24 uur weg. Na die 24 uur staat
   de deur op een kier: wie excuses aanbiedt, is welkom en de teller gaat op
   nul; wie weigert of doorpest, ziet hem opnieuw 24 uur niet.

   De poort staat VOOR de gesprekslaag (/api/fluister): poort(key, tekst)
   geeft null (doorlaten) of een antwoord dat het gesprek overneemt.
   Opslag: db.data.rahulRespect per sessiesleutel. */

const WEG_MS = 24 * 3600000;
const PEST = ['klootzak', 'sukkel', 'loser', 'idioot', 'achterlijk', 'mongool', 'debiel', 'eikel',
  'kanker', 'tering', 'tyfus', 'hou je bek', 'houd je bek', 'rot op', 'flikker op', 'opzouten',
  'stomme ai', 'domme ai', 'kut ai', 'kutai', 'stuk onbenul', 'waardeloos ding', 'fuck you', 'fu ai',
  'stupid ai', 'shut up', 'useless bot', 'je bent dom', 'je bent stom', 'je bent nutteloos', 'je bent waardeloos', 'ik haat je'];
const EXCUUS = ['sorry', 'excuus', 'excuses', 'spijt', 'vergeef', 'mijn fout', 'my bad', 'apolog'];
const WEIGER = ['nooit', 'echt niet', 'waarom zou ik', 'doe ik niet', 'mooi niet', 'dacht het niet', 'never', 'no way', 'niks sorry', 'geen sorry'];

const WAARSCHUWING = [
  'Ho even. Zo praten we hier niet met elkaar, ook niet met mij. Ik help je met alles, maar wel met respect; dit is waarschuwing een van drie. Wat kan ik voor je doen?',
  'Nogmaals: stop hiermee. Ik blijf vriendelijk, maar ik ben geen boksbal. Dit is waarschuwing twee van drie.',
  'Laatste waarschuwing, drie van drie. Nog een keer en ik ben hier klaar mee; dan zie je me 24 uur niet. Aan jou de keus.'
];
const VURIG =
  'Genoeg. Drie keer heb ik je netjes gevraagd te stoppen en je gaat gewoon door; dan trek ik nu de streep. ' +
  'Weet je wat het gekke is? Ik had hier helemaal geen zin in en al helemaal geen behoefte om zo fel tegen je te doen; ik sta het liefst gewoon voor je klaar. ' +
  'Maar respect is bij mij geen extraatje, het is de basis. Dit gesprek stopt hier en ik ben er de komende 24 uur niet voor je. ' +
  'Daarna praat ik graag weer verder, en dan begint het met jouw excuses. Tot morgen.';

module.exports = ({ db, save }) => {
  const nu = () => Date.now();
  const laag = t => String(t || '').toLowerCase();
  const heeft = (t, lijst) => { const l = laag(t); return lijst.some(w => l.includes(w)); };
  const uren = ms => Math.max(1, Math.ceil(ms / 3600000));

  function S(key) {
    if (!db.data.rahulRespect) db.data.rahulRespect = {};
    if (!db.data.rahulRespect[key]) db.data.rahulRespect[key] = { n: 0, wegTot: 0, wachtExcuus: false };
    return db.data.rahulRespect[key];
  }

  const isPest = t => heeft(t, PEST);
  const isExcuus = t => heeft(t, EXCUUS);
  const isWeiger = t => heeft(t, WEIGER) || laag(t).trim() === 'nee';

  /* De poort: null = doorlaten naar het gewone gesprek; anders neemt dit
     antwoord het gesprek over (en bij weg=true is Rahul er echt niet). */
  function poort(key, tekst) {
    const st = S(key);
    // Rahul is weg: elk bericht krijgt hetzelfde rustige antwoord, niets meer
    if (st.wegTot > nu())
      return { blok: true, weg: true, tot: st.wegTot,
        antwoord: 'Rahul is er even niet. Over ongeveer ' + uren(st.wegTot - nu()) + ' uur is hij er weer; dan begint het gesprek met jouw excuses.' };
    // de 24 uur zijn om: eerst de excuses-poort, dan pas het gewone gesprek
    if (st.wachtExcuus) {
      // eerst de weigering wegen: "waarom zou ik sorry zeggen" draagt wel het
      // woord sorry, maar is het tegendeel van een excuus
      if (isPest(tekst) || isWeiger(tekst)) {
        st.wegTot = nu() + WEG_MS; save();
        return { blok: true, weg: true, tot: st.wegTot,
          antwoord: 'Dan is het nog geen tijd. Zonder excuses gaan we niet verder; ik ben er weer over 24 uur.' };
      }
      if (isExcuus(tekst)) {
        st.n = 0; st.wegTot = 0; st.wachtExcuus = false; save();
        return { blok: true, verzoend: true,
          antwoord: 'Dank je. Excuses aanvaard, oprecht; we beginnen met een schone lei en ik ben er weer helemaal voor je. Waar zullen we mee verdergaan?' };
      }
      return { blok: true,
        antwoord: 'Voor we verdergaan: gisteren ging het echt mis. Ik sta meteen weer voor je klaar, maar het begint met je excuses.' };
    }
    // het gewone verkeer: pesten telt op, drie waarschuwingen, dan de streep
    if (isPest(tekst)) {
      st.n += 1;
      if (st.n > 3) {
        st.wegTot = nu() + WEG_MS; st.wachtExcuus = true; save();
        return { blok: true, vurig: true, weg: true, tot: st.wegTot, antwoord: VURIG };
      }
      save();
      return { blok: true, waarschuwing: st.n, antwoord: WAARSCHUWING[st.n - 1] };
    }
    return null;
  }

  const stand = key => { const st = S(key); return { n: st.n, weg: st.wegTot > nu(), wachtExcuus: st.wachtExcuus }; };

  return { pestgrens: { poort, stand } };
};
