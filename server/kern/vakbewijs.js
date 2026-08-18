/* Kern-module "vakbewijs": WAT KAN EN MAG DEZE MENS AANTOONBAAR.

   WAAROM DIT ER MOEST KOMEN staat voluit in ./persoonseis.js; kort: de
   bedrijfskant was op orde en de mensenkant niet. Een genre met stand `bewijs`
   hield de zaak tegen tot een medewerker een vergunning had gezien, en liet
   daarna iedereen binnen met dezelfde vier cijfers.

   Dit bestand houdt de FEITEN vast; ./persoonseis.js zegt wat een genre ervan
   verlangt -- dezelfde knip als bij de bedrijfskant.

   DRIE DINGEN DIE HIER BEWUST ZO ZIJN.

   1. EEN INGEDIEND STUK IS GEEN BEWIJS. Zetten legt een BEWERING vast; pas een
      aftekening met een naam erop draagt een poort (./vakbewijs-aftekenen.js).
      Een vlag die niemand handhaaft is een open deur met een bordje ernaast.

   2. RTG IS GEEN INSPECTIE, OOK HIER NIET. Wij bellen het BIG-register niet en
      doen niet alsof. Vastgelegd wordt dat een mens het stuk heeft GEZIEN.
      Doen alsof wij een registratie valideren zou schijnzekerheid geven en de
      aansprakelijkheid verschuiven naar wie dat niet kan dragen (CONCERN.md).

   3. EEN BEWIJS VERLOOPT, EN DAT IS HET HELE PUNT. De bedrijfskant tekende voor
      eeuwig af: een doorgehaalde BIG-registratie bleef voorgoed "gezien". Hier
      is `tot` daarom geen sierveld -- geldigheid wordt bij ELKE vraag opnieuw
      gerekend, nooit opgeslagen als vlag.

   WAAR HET NUMMER WOONT: in de identiteitskluis, niet hier. Zie
   ./vakbewijs-nummer.js.

   WAT HIER NIET WOONT. Het document zelf. Een scan of foto gaat naar de
   bestaande identiteitsverificatie (routes/auth/verificatie.js, versleuteld,
   0600) en die wordt hier alleen GELEZEN via de soort `identiteit`. Een tweede
   intake naast de eerste is precies wat kern/gegevenspoort.js verbiedt.

   De concern-kwalificaties zijn hierin opgegaan; waarom, en wat er eenmalig
   verhuist, staat in ./vakbewijs-verhuis.js. */
'use strict';

/* De sleutel zegt WELKE MENS, en uit welke wereld hij komt:
     lid:<accountId>    personeel in het leverancierskanaal; heeft altijd een
                        eigen RTG-account (routes/werving.js dwingt dat af)
     concern:<persoon>  de codenaam uit de concernwereld, die geen account hoeft
                        te hebben -- een bestuurder van buiten bestaat
   Een sleutel zonder wereld weigeren we: 'jan' hoort bij twee mensen, en dat is
   precies de fout die een kale naam als sleutel maakt. */
function sleutelLid(id) { return id == null ? null : 'lid:' + Number(id); }
function sleutelConcern(persoon) {
  const p = String(persoon == null ? '' : persoon).trim();
  return p ? 'concern:' + p : null;
}
const geldigeSleutel = (s) => typeof s === 'string' && /^(lid:\d+|concern:.+)$/.test(s);

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

module.exports = ({ db, save, schoon, tijdVandaag, accounts }) => {
  const vandaag = tijdVandaag || (() => new Date().toISOString().slice(0, 10));
  const nu = () => new Date().toISOString();
  const kap = (t, n) => schoon(String(t == null ? '' : t), n || 80);

  // de eenmalige verhuizingen (concern-kwalificaties, en de nummers naar de
  // kluis): ./vakbewijs-verhuis.js
  const verhuis = require('./vakbewijs-verhuis')({ db, save, vandaag, sleutelConcern, accounts });

  function bak() {
    if (!Array.isArray(db.data.vakbewijzen)) db.data.vakbewijzen = [];
    verhuis.concern();
    verhuis.nummers();
    return db.data.vakbewijzen;
  }

  /* Waar het NUMMER woont en waarom, staat in ./vakbewijs-nummer.js. Kort: in
     de identiteitskluis en niet hier, want een BIG-registratie staat in een
     openbaar register en zou een codenaam terugvoeren naar een echte naam. */
  const { nummerVan, nummerZet } = require('./vakbewijs-nummer')({ accounts, kap, vind: (s2, w) => vind(s2, w) });

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

  /* De leesbare vorm van een rij. Het NUMMER zit er met opzet niet in: wie het
     nodig heeft vraagt het apart op, en op de kantoorweg gaat daar een reden en
     een journaalregel overheen. Zou toon() hem meesturen, dan lekt hij mee in
     elke lijst die ooit op deze functie wordt gebouwd. */
  function toon(v, d) {
    const uit = Object.assign({}, v, {
      geldig: geldigOp(v, d),
      verlopen: !!(v.tot && v.tot < (d || vandaag())),
      gezien: !!v.afgetekend
    });
    delete uit.nummer;
    return uit;
  }

  /* ---- vastleggen ----
     `zet` is een BEWERING en verandert niets aan toegang. Opnieuw zetten wist de
     aftekening: een nieuw nummer of een nieuwe einddatum is een ANDER stuk, en
     dat is niet gezien. Zonder die regel is de aftekening met een enkele
     wijziging over te schrijven naar een stuk dat niemand ooit heeft bekeken --
     de goedkoopste fraude die er is. */
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
    /* Het OUDE nummer komt uit de kluis (of, voor een concern-rij, uit de rij
       zelf). Dit is een schrijfpad van de mens over zijn eigen stuk, dus geen
       inzage in andermans gegevens en geen journaalregel -- zie mag() in
       server/inzagelog.js, dat zelf-inzage om dezelfde reden overslaat. */
    const oudNummer = bestaand ? nummerVan(sleutel, wat) : null;
    const anders = !bestaand || oudNummer !== nummer || bestaand.tot !== tot || bestaand.van !== van;
    const v = bestaand || { sleutel, wat, ingediend: nu() };
    /* Het nummer gaat NIET in deze rij maar in de kluis. Lukt dat niet (een
       concern-rij, of een opzet zonder accounts), dan valt hij terug op de rij
       -- en dat is dan de enige plek, niet een tweede. */
    if (!nummerZet(sleutel, wat, nummer)) v.nummer = nummer; else delete v.nummer;
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

  /* Aftekenen en intrekken -- de twee handelingen die een MENS VAN RTG met een
     stuk doet -- staan in ./vakbewijs-aftekenen.js. Ze horen bij elkaar en niet
     bij het vastleggen erboven: dat is de aanvrager die iets beweert, dit is
     RTG die er zijn naam onder zet of hem er weer afhaalt. */
  const { vakbewijsTeken, vakbewijsIntrek } =
    require('./vakbewijs-aftekenen')({ vind, toon, nu, kap, save });

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

  /* Wat er binnen `dagen` verloopt. Zonder vooruitkijken merkt een zaak het pas
     op de ochtend dat er iemand niet meer naar binnen kan. */
  function vakbewijzenVerlopend(sleutels, dagen) {
    const grens = new Date(Date.now() + (Number(dagen) || 60) * 86400000).toISOString().slice(0, 10);
    const d = vandaag();
    const set = Array.isArray(sleutels) ? new Set(sleutels) : null;
    return bak().filter(v => !v.ingetrokken && v.tot && v.tot >= d && v.tot <= grens &&
      (!set || set.has(v.sleutel))).map(v => toon(v, d));
  }

  return { vakbewijsZet, vakbewijsTeken, vakbewijsIntrek, vakbewijzenVan, vakbewijsHeeft, vakbewijsNummer: nummerVan,
    vakbewijzenVerlopend, sleutelLid, sleutelConcern, vakbewijsGeldigOp: geldigOp };
};
