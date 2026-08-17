/* Kern-module "vakbewijs": WAT KAN EN MAG DEZE MENS AANTOONBAAR.

   WAAROM DIT ER MOEST KOMEN staat voluit in ./persoonseis.js; kort: de
   bedrijfskant was op orde en de mensenkant niet. Een genre met stand `bewijs`
   hield de zaak tegen tot een medewerker een vergunning had gezien, en liet
   daarna iedereen binnen met dezelfde vier cijfers.

   Dit bestand houdt de FEITEN vast; ./persoonseis.js zegt wat een genre ervan
   verlangt. Die knip is dezelfde als bij de bedrijfskant: het genre-register
   draagt de STAND, de bewijsmodule draagt de EIS.

   DRIE DINGEN DIE HIER BEWUST ZO ZIJN.

   1. EEN INGEDIEND STUK IS GEEN BEWIJS. Zetten legt een BEWERING vast. Pas een
      aftekening met een naam erop draagt een poort -- dezelfde vorm als
      bewijsTeken() bij de aanmeldingen, en om dezelfde reden: een vlag die
      niemand handhaaft is een open deur met een bordje ernaast.

   2. RTG IS GEEN INSPECTIE, OOK HIER NIET. Wij bellen het BIG-register niet en
      doen niet alsof. Vastgelegd wordt dat een mens het stuk heeft gezien, met
      een nummer en twee datums. Doen alsof wij een registratie valideren zou
      schijnzekerheid geven en de aansprakelijkheid verschuiven naar de partij
      die dat niet kan dragen (CONCERN.md, De grenzen).

   3. EEN BEWIJS VERLOOPT, EN DAT IS HET HELE PUNT. De bedrijfskant tekende voor
      eeuwig af: een doorgehaalde BIG-registratie bleef voorgoed "gezien". Hier
      is `tot` daarom geen sierveld -- geldigheid wordt bij ELKE vraag opnieuw
      gerekend, nooit opgeslagen als vlag.

   WAT HIER NIET WOONT. Het document zelf. Een scan of foto gaat naar de
   bestaande identiteitsverificatie (routes/auth/verificatie.js, versleuteld,
   0600) en die wordt hier alleen GELEZEN via de soort `identiteit`. Een tweede
   intake naast de eerste is precies wat kern/gegevenspoort.js verbiedt.

   De concern-kwalificaties zijn hierin opgegaan; waarom, en wat er eenmalig
   verhuist, staat in ./vakbewijs-verhuis.js. */
'use strict';

/* De sleutel zegt WELKE MENS, en uit welke wereld hij komt:
     lid:<accountId>    personeel in het leverancierskanaal; dat heeft altijd een
                        eigen RTG-account (routes/werving.js dwingt dat af)
     concern:<persoon>  de codenaam uit de concernwereld, die geen RTG-account
                        hoeft te hebben -- een bestuurder van buiten bestaat
   Een sleutel zonder wereld weigeren we: 'jan' hoort bij twee verschillende
   mensen, en dat is precies de fout die een kale naam als sleutel maakt. */
function sleutelLid(id) { return id == null ? null : 'lid:' + Number(id); }
function sleutelConcern(persoon) {
  const p = String(persoon == null ? '' : persoon).trim();
  return p ? 'concern:' + p : null;
}
const geldigeSleutel = (s) => typeof s === 'string' && /^(lid:\d+|concern:.+)$/.test(s);

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

module.exports = ({ db, save, schoon, tijdVandaag }) => {
  const vandaag = tijdVandaag || (() => new Date().toISOString().slice(0, 10));
  const nu = () => new Date().toISOString();
  const kap = (t, n) => schoon(String(t == null ? '' : t), n || 80);

  // de eenmalige verhuizing van de concern-kwalificaties: ./vakbewijs-verhuis.js
  const verhuisConcern = require('./vakbewijs-verhuis')({ db, save, vandaag, sleutelConcern });

  function bak() {
    if (!Array.isArray(db.data.vakbewijzen)) db.data.vakbewijzen = [];
    verhuisConcern();
    return db.data.vakbewijzen;
  }

  const vind = (sleutel, wat) => bak().find(v => v.sleutel === sleutel && v.wat === wat) || null;

  /* Is dit bewijs op datum d geldig? Geen opgeslagen vlag maar een berekening,
     elke keer opnieuw. Een `geldig`-veld in de rij zou op de dag van verlopen
     nog steeds true zeggen, en niemand die dat merkt. */
  function geldigOp(v, d) {
    const dag = d || vandaag();
    if (v.ingetrokken) return false;
    if (v.van && v.van > dag) return false;
    if (v.tot && v.tot < dag) return false;
    return true;
  }

  function toon(v, d) {
    return Object.assign({}, v, {
      geldig: geldigOp(v, d),
      verlopen: !!(v.tot && v.tot < (d || vandaag())),
      gezien: !!v.afgetekend
    });
  }

  /* ---- vastleggen ----
     `zet` is een BEWERING en verandert niets aan toegang. Een bestaand bewijs
     opnieuw zetten wist de aftekening: een nieuw nummer of een nieuwe einddatum
     is een ANDER stuk, en dat is niet gezien. Zonder die regel is de aftekening
     met een enkele wijziging over te schrijven naar een stuk dat niemand ooit
     heeft bekeken -- de goedkoopste fraude die er is. */
  function vakbewijsZet(sleutel, body) {
    if (!geldigeSleutel(sleutel)) return { status: 400, error: 'Voor wie is dit vakbewijs?' };
    const b = body || {};
    const wat = kap(b.wat, 60);
    if (!wat) return { status: 400, error: 'Welk stuk legt u vast?' };
    const tot = DATUM.test(String(b.tot || '')) ? String(b.tot) : null;
    const eigenVan = DATUM.test(String(b.van || ''));
    const van = eigenVan ? String(b.van) : vandaag();
    /* Alleen weigeren als BEIDE datums er staan en ze elkaar tegenspreken. Een
       losse einddatum in het verleden legt een AL VERLOPEN stuk vast, en dat
       moet kunnen: zo markeer je een ingetrokken VOG. Als harde afwijzing zette
       dit test/concern.test.js op rood -- de rij bleef dan op de oude einddatum
       staan, en een weigering die de aanroeper negeert is een verlenging. */
    if (tot && eigenVan && tot < van) return { status: 400, error: 'De einddatum ligt voor de begindatum.' };
    const nummer = kap(b.nummer, 60) || null;
    const bestaand = vind(sleutel, wat);
    const anders = !bestaand || bestaand.nummer !== nummer || bestaand.tot !== tot || bestaand.van !== van;
    const v = bestaand || { sleutel, wat, ingediend: nu() };
    v.nummer = nummer;
    v.van = van;
    v.tot = tot;
    v.opent = Array.isArray(b.opent) ? b.opent.slice(0, 12).map(x => kap(x, 60)).filter(Boolean) : (v.opent || []);
    v.toelichting = kap(b.toelichting, 300) || null;
    if (anders) { v.afgetekend = null; v.ingediend = nu(); }
    delete v.ingetrokken;
    if (!bestaand) bak().push(v);
    save();
    return { ok: true, vakbewijs: toon(v),
      uitleg: v.afgetekend ? 'Vastgelegd.'
        : 'Vastgelegd. Dit telt pas mee zodra iemand van RTG het stuk heeft gezien; RTG beoordeelt het niet inhoudelijk.' };
  }

  /* Een mens tekent af. Op een NAAM, want een aftekening zonder naam is geen
     aftekening -- zelfde regel en zelfde zin als bij de bedrijfskant. */
  function vakbewijsTeken(sleutel, wat, door) {
    const v = vind(sleutel, kap(wat, 60));
    if (!v) return { status: 404, error: 'Dit stuk is hier niet ingediend.' };
    if (v.ingetrokken) return { status: 409, error: 'Dit stuk is ingetrokken.' };
    if (v.afgetekend) return { status: 409, error: 'Dit stuk is al afgetekend.' };
    const naam = kap(door, 60);
    if (!naam) return { status: 400, error: 'Wie tekent af? Een aftekening zonder naam is geen aftekening.' };
    v.afgetekend = { door: naam, at: nu() };
    save();
    return { ok: true, vakbewijs: toon(v),
      grens: 'Vastgelegd is dat ' + naam + ' het stuk heeft gezien. RTG is geen inspectie en toetst de inhoud niet.' };
  }

  /* Intrekken. Een stuk verdwijnt NIET uit de lijst: wie het weggooit, gooit ook
     weg dat het er ooit was, en juist dat wil je terugzien als er iets misgaat. */
  function vakbewijsIntrek(sleutel, wat, door, reden) {
    const v = vind(sleutel, kap(wat, 60));
    if (!v) return { status: 404, error: 'Dit stuk is hier niet ingediend.' };
    const naam = kap(door, 60);
    if (!naam) return { status: 400, error: 'Wie trekt dit in?' };
    v.ingetrokken = { door: naam, at: nu(), reden: kap(reden, 200) || null };
    save();
    return { ok: true, vakbewijs: toon(v) };
  }

  const vakbewijzenVan = (sleutel, d) => !geldigeSleutel(sleutel) ? []
    : bak().filter(v => v.sleutel === sleutel).map(v => toon(v, d));

  /* DE VRAAG WAAR ALLES OP UITKOMT: heeft deze mens dit stuk, nu, en telt het?
     `aftekening` zegt of een gezien stuk vereist is; dat besluit hoort bij de
     eis (kern/persoonseis.js) en niet hier, want het verschilt per genre.
     Antwoord altijd MET reden -- een poort die alleen "nee" zegt, leert mensen
     dingen stapelen tot het werkt. */
  function vakbewijsHeeft(sleutel, wat, opties) {
    const o = opties || {};
    const d = o.datum || vandaag();
    if (!geldigeSleutel(sleutel)) return { ok: false, reden: 'geen-persoon' };
    const treffers = bak().filter(v => v.sleutel === sleutel &&
      (v.wat === wat || (v.opent || []).includes(wat)));
    if (!treffers.length) return { ok: false, reden: 'ontbreekt' };
    const geldig = treffers.filter(v => geldigOp(v, d));
    if (!geldig.length) {
      const ingetrokken = treffers.some(v => v.ingetrokken);
      return { ok: false, reden: ingetrokken ? 'ingetrokken' : 'verlopen',
        tot: treffers.map(v => v.tot).filter(Boolean).sort().pop() || null };
    }
    if (o.aftekening !== false) {
      const gezien = geldig.filter(v => v.afgetekend);
      if (!gezien.length) return { ok: false, reden: 'niet-gezien' };
      return { ok: true, vakbewijs: toon(gezien[0], d) };
    }
    return { ok: true, vakbewijs: toon(geldig[0], d) };
  }

  /* Wat er binnen `dagen` verloopt. Zonder een lijst die vooruitkijkt merkt een
     zaak het pas op de ochtend dat er iemand niet meer naar binnen kan. */
  function vakbewijzenVerlopend(sleutels, dagen) {
    const grens = new Date(Date.now() + (Number(dagen) || 60) * 86400000).toISOString().slice(0, 10);
    const d = vandaag();
    const set = Array.isArray(sleutels) ? new Set(sleutels) : null;
    return bak().filter(v => !v.ingetrokken && v.tot && v.tot >= d && v.tot <= grens &&
      (!set || set.has(v.sleutel))).map(v => toon(v, d));
  }

  return { vakbewijsZet, vakbewijsTeken, vakbewijsIntrek, vakbewijzenVan, vakbewijsHeeft,
    vakbewijzenVerlopend, sleutelLid, sleutelConcern, vakbewijsGeldigOp: geldigOp };
};
