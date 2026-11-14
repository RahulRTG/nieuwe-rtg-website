/* De pestgrens beschermt alleen de huidige beurt, niet het account. Een
   trefwoord is een signaal, geen bewezen misbruik en geen grond voor een
   langdurige sanctie. Herhaling en betwisting vragen menselijke beoordeling
   via de bestaande RTG Service. Er wordt hier geen supportzaak verzonnen.

   De poort staat VOOR de gesprekslaag (/api/fluister): poort(key, tekst)
   geeft null (doorlaten) of een antwoord dat het gesprek overneemt.
   Opslag: collectie rahulRespect per sessiesleutel. */

const PEST = ['klootzak', 'sukkel', 'loser', 'idioot', 'achterlijk', 'mongool', 'debiel', 'eikel',
  'hou je bek', 'houd je bek', 'rot op', 'flikker op', 'opzouten',
  'stomme ai', 'domme ai', 'kut ai', 'kutai', 'stuk onbenul', 'waardeloos ding', 'fuck you', 'fu ai',
  'stupid ai', 'shut up', 'useless bot', 'je bent dom', 'je bent stom', 'je bent nutteloos', 'je bent waardeloos', 'ik haat je'];
const WAARSCHUWING = [
  'Dit bericht bevat mogelijk beledigende taal. Ik voer er geen handeling mee uit. Je kunt je vraag opnieuw stellen; je account blijft bereikbaar.',
  'Ik stop ook deze beurt vanwege mogelijk beledigende taal. Je kunt opnieuw je vraag stellen. Je account en lopende zaken blijven bereikbaar.',
  'Deze beurt is gestopt vanwege mogelijk beledigende taal. Dit is geen accountschorsing. Een langdurige maatregel vraagt beoordeling door een mens.'
];
const BEOORDELING = ' Klopt dit niet? Open RTG Service en vraag een medewerker om beoordeling. Er is nog geen melding voor je verstuurd.';

module.exports = ({ db, save }) => {
  const nu = () => Date.now();
  const laag = t => String(t || '').toLowerCase();
  const heeft = (t, lijst) => { const l = laag(t); return lijst.some(w => l.includes(w)); };

  const eigen = require('./eigencollectie')({ db, domein: 'kern/pestgrens', bezit: { rahulRespect: 'kaart' } });

  /* LEZEN MAAKT HIER GEEN RECORD MEER AAN.

     Hier stond `if (!b[key]) b[key] = {...}; return b[key];` -- elke oproep van
     /api/fluister legde dus een regel aan in `rahulRespect`, ook als er
     helemaal niets gebeurde. Twee dingen mis:

     1. EEN GEWEIGERD VERZOEK VERANDERDE DE TOESTAND. Vraag je Rahul iets en de
        route geeft 400 (geen vraag, geen AI-sleutel), dan was er tóch iets
        opgeslagen. Gevonden door de staatproef, die de OPSLAG meet in plaats
        van het antwoord: "geweigerd (status 400) en de toestand veranderde toch".
        Het antwoord kon dat niet laten zien; de opslag wel.

     2. HET BEWAARDE IETS OVER IEDEREEN DIE OOIT IETS VROEG. De collectie heet
        "de teller van de pestgrens" en hoort dus alleen mensen te bevatten bij
        wie er iets te tellen valt. In plaats daarvan groeide hij mee met het
        aantal sessies -- lege records, over leden die niets verkeerd deden.
        Minder bewaren is hier gratis: wie er niet in staat, heeft n = 0.

     Lezen geeft nu een LOSSE momentopname (niet in de bak), en pas wie iets
     wijzigt zet hem er met `bewaar()` in. Zo staat er alleen iets over iemand
     zodra er werkelijk iets is voorgevallen. */
  const LEEG = () => ({ n: 0, wegTot: 0, wachtExcuus: false });
  function S(key) {
    const b = eigen.bak('rahulRespect');
    return b[key] || LEEG();
  }
  /* De tegenhanger: dit is het enige wat schrijft. Elke tak in poort() die de
     stand verandert, roept hem aan -- ook de tak die hem op nul zet, want een
     verzoening hoort zichtbaar te blijven tot de bewaarveger hem opruimt. */
  function bewaar(key, st) {
    eigen.bak('rahulRespect')[key] = st;
    save();
  }

  const isPest = t => heeft(t, PEST);
  /* null = doorlaten. Oude wegTot/wachtExcuus zijn historische gegevens, geen
     menselijke sanctie: ze blokkeren ook na een herstart geen nieuwe beurt.
     Rate limits en andere technische beveiliging blijven elders van kracht. */
  function poort(key, tekst) {
    const st = S(key);
    if (isPest(tekst)) {
      st.n = Math.min(3, Math.max(0, Math.floor(Number(st.n) || 0)) + 1);
      st.laatsteSignaalAt = nu();
      bewaar(key, st);
      return { blok: true, weg: false, bescherming: 'bericht', waarschuwing: st.n,
        beoordelingNodig: st.n >= 3, service: '/apps/service.html',
        antwoord: WAARSCHUWING[st.n - 1] + BEOORDELING };
    }
    return null;
  }

  const stand = key => { const st = S(key); return { n: st.n, weg: false, wachtExcuus: false }; };

  return { pestgrens: { poort, stand } };
};
