/* EEN NIEUWE REGEL LOOPT EERST MEE ZONDER TE BLOKKEREN.

   DE VRAAG DIE NIEMAND KAN BEANTWOORDEN. Vandaag is aan de leverancierspoort een
   abonnementscontrole gehangen (./routepoort.js). Hij is zorgvuldig gebouwd en
   getoetst, en toch weet niemand wat hij morgenochtend om negen uur DOET: hoeveel
   verzoeken raakt hij, van wie, op welke paden. Dat is precies het moment waarop
   een handhavingsregel een storing wordt in plaats van een grens.

   Het antwoord is niet voorzichtiger bouwen. Het antwoord is: laat de regel eerst
   MEELOPEN. Hij oordeelt, hij telt, en hij houdt niemand tegen. Na een week is de
   vraag "wat zou er gebeurd zijn" een getal in plaats van een gevoel.

   DE DRIE STANDEN, EN "SCHADUW" IS DE ENIGE INTERESSANTE:

     UIT          de regel wordt niet eens gewogen
     SCHADUW      de regel oordeelt en telt, en laat IEDEREEN door
     AFDWINGEN    de regel houdt tegen

   WAT DIT ECHT MAAKT: JE KUNT NIET AFDWINGEN WAT NOOIT IN DE SCHADUW HEEFT
   GELOPEN. Zonder die eis is een schaduwstand een vinkje dat niemand aanzet --
   en dan staat hij er wel, en gebruikt niemand hem, en is er een module bij
   waar niemand om vroeg. Met die eis is hij de enige weg naar afdwingen.

   DE UITZONDERING BESTAAT, EN ZIJ IS TELBAAR. Een regel die aantoonbaar niets
   afpakt -- omdat iedereen die hij raakt de capability toch al heeft -- hoeft
   niet te wachten. Zo'n vrijstelling vraagt een REDEN en een naam, en
   `vrijgesteld()` telt ze op. Een uitzondering die je niet kunt tellen, is over
   een jaar de regel.

   EN EEN REGEL DIE IN DE SCHADUW NOG NOOIT IEMAND ZOU HEBBEN TEGENGEHOUDEN, is
   niet "veilig om aan te zetten" -- het is een regel waarvan we niet weten of hij
   werkt. Dat verschil staat apart in de stand, om dezelfde reden dat
   ./zaakabonnement.js zijn terugval telt.

   WAT DIT NIET IS: een tweede autorisatielaag. Deze module oordeelt nergens over.
   Zij krijgt het oordeel van een ANDERE laag binnen -- een bezwaar of null -- en
   beslist alleen of dat oordeel vandaag gevolgen heeft. */
'use strict';

const klok = require('../../lib/klok');

const MODUS = { UIT: 'UIT', SCHADUW: 'SCHADUW', AFDWINGEN: 'AFDWINGEN' };

/* Hoeveel bewijs er nodig is voordat een regel mag bijten. Beide moeten gehaald
   zijn: duizend waarnemingen op een dag zegt niets over de maandafsluiting, en
   een week met drie verzoeken zegt niets over drukte. */
const RIJP = { minWaarnemingen: 200, minDagen: 7 };
const DAG = 86400000;

/* Hoeveel voorbeelden we bewaren van wat de regel zou hebben tegengehouden. Een
   getal zonder voorbeelden is niet te beoordelen ("120 keer" -- van wie? waarop?);
   alle voorbeelden bewaren is een tweede logboek dat niemand opruimt. */
const VOORBEELDEN = 20;

function maakSchaduw({ db, save, nu }) {
  const tijd = nu || klok.nu;

  const eigen = require('../eigencollectie')({ db, domein: 'kern/commercie/schaduw', bezit: { schaduwregels: 'kaart' } });
  function alles() { return eigen.bak('schaduwregels'); }

  function rij(id) {
    const k = String(id || '');
    const R = alles();
    if (!R[k]) R[k] = { id: k, modus: MODUS.SCHADUW, sinds: tijd(), door: null,
      waarnemingen: 0, zouTegenhouden: 0, voorbeelden: [], vrijstelling: null, verloop: [] };
    return R[k];
  }

  /* DE VRAAG VAN DE AANROEPER. Hij heeft zijn eigen oordeel al -- `bezwaar` is
     de reden om tegen te houden, of null als het mag -- en vraagt hier alleen of
     dat oordeel vandaag gevolgen heeft.

     In SCHADUW is het antwoord ALTIJD `door: true`. Dat staat hier structureel en
     niet als afspraak: er is geen tak waarlangs een schaduwregel iets tegenhoudt.
     Zou die er zijn, dan is het geen schaduw maar een regel die soms bijt. */
  function weeg(id, bezwaar, waarneming) {
    const r = rij(id);
    if (r.modus === MODUS.UIT) return { door: true, modus: r.modus, gemeten: false };

    r.waarnemingen += 1;
    if (bezwaar) {
      r.zouTegenhouden += 1;
      const w = waarneming || {};
      r.voorbeelden.unshift({ at: tijd(), reden: String(bezwaar).slice(0, 200),
        wie: w.wie == null ? null : String(w.wie).slice(0, 60),
        wat: w.wat == null ? null : String(w.wat).slice(0, 120) });
      if (r.voorbeelden.length > VOORBEELDEN) r.voorbeelden.length = VOORBEELDEN;
    }
    save();

    if (r.modus === MODUS.SCHADUW) return { door: true, modus: r.modus, gemeten: true, zouTegenhouden: !!bezwaar };
    return { door: !bezwaar, modus: r.modus, gemeten: true, bezwaar: bezwaar || null };
  }

  /* Is deze regel rijp om af te dwingen? Geeft altijd een reden mee: "nog niet"
     zonder te zeggen hoeveel er nog ontbreekt, is een deur zonder klink. */
  function rijp(id) {
    const r = rij(id);
    if (r.vrijstelling) return { ok: true, reden: 'vrijgesteld: ' + r.vrijstelling.reden, vrijgesteld: true };
    const dagen = Math.floor((tijd() - r.sinds) / DAG);
    const tekort = [];
    if (r.waarnemingen < RIJP.minWaarnemingen)
      tekort.push(r.waarnemingen + ' van ' + RIJP.minWaarnemingen + ' waarnemingen');
    if (dagen < RIJP.minDagen) tekort.push(dagen + ' van ' + RIJP.minDagen + ' dagen');
    if (tekort.length) return { ok: false, reden: 'nog niet genoeg meegelopen: ' + tekort.join(', '), dagen };
    return { ok: true, reden: r.waarnemingen + ' waarnemingen over ' + dagen + ' dagen', dagen,
      /* GEEN BLOKKADE, MAAR WEL DE WAARSCHUWING. Een regel die nooit iemand zou
         hebben tegengehouden is niet bewezen veilig -- er is alleen geen bewijs
         dat hij iets doet. De mens die hem aanzet hoort dat te lezen. */
      let: r.zouTegenhouden === 0
        ? 'deze regel zou in de hele schaduwperiode niemand hebben tegengehouden; er is geen bewijs dat hij werkt'
        : null };
  }

  /* DE MODUS ZETTEN. Naar AFDWINGEN kan alleen als de regel rijp is; alle andere
     kanten op mag altijd -- een regel terugzetten naar schaduw is een noodrem en
     hoort nooit tegengehouden te worden. */
  function zetModus(id, modus, door, opties) {
    const m = String(modus || '').toUpperCase();
    if (!MODUS[m]) return { status: 400, error: 'Onbekende stand: ' + modus + '.' };
    const r = rij(id);
    if (m === MODUS.AFDWINGEN && r.modus !== MODUS.AFDWINGEN) {
      const k = rijp(id);
      if (!k.ok) return { status: 409, error: 'Deze regel mag nog niet afdwingen -- ' + k.reden + '.', rijp: k };
    }
    const vorige = r.modus;
    r.modus = m;
    r.door = String(door || '').slice(0, 60) || null;
    /* De teller loopt door bij een stand-wissel, maar de KLOK begint opnieuw als
       een regel terugvalt naar schaduw: dan is er iets veranderd, en dan is de
       week ervoor geen bewijs meer over de week erna. */
    if (m === MODUS.SCHADUW && vorige !== MODUS.SCHADUW) r.sinds = tijd();
    r.verloop.unshift({ at: tijd(), van: vorige, naar: m, door: r.door });
    if (r.verloop.length > 40) r.verloop.length = 40;
    save();
    return { status: 200, ok: true, regel: stand(id) };
  }

  /* VRIJSTELLEN. Voor een regel die aantoonbaar niets afpakt. Vraagt een reden,
     want een vrijstelling zonder reden is een uitgezette regel met een nette
     naam. */
  function stelVrij(id, reden, door) {
    const t = String(reden || '').trim();
    if (t.length < 15)
      return { status: 400, error: 'Een vrijstelling vraagt een reden: waarom pakt deze regel niemand iets af?' };
    const r = rij(id);
    r.vrijstelling = { reden: t.slice(0, 300), door: String(door || '').slice(0, 60) || null, at: tijd() };
    save();
    return { status: 200, ok: true, regel: stand(id) };
  }

  function stand(id) {
    const r = rij(id);
    const k = rijp(id);
    return { id: r.id, modus: r.modus, sinds: r.sinds, door: r.door,
      waarnemingen: r.waarnemingen, zouTegenhouden: r.zouTegenhouden,
      deel: r.waarnemingen ? r.zouTegenhouden / r.waarnemingen : 0,
      voorbeelden: r.voorbeelden.slice(0, 5),
      vrijstelling: r.vrijstelling, rijp: k, verloop: r.verloop.slice(0, 5) };
  }

  function lijst() { return Object.keys(alles()).sort().map(stand); }

  /* De twee getallen die zichtbaar horen te blijven. Een vrijstelling die je niet
     kunt tellen is over een jaar de regel; een schaduwregel die er al maanden
     staat is een besluit dat niemand neemt. */
  function vrijgesteld() {
    return lijst().filter(r => r.vrijstelling)
      .map(r => ({ id: r.id, reden: r.vrijstelling.reden, door: r.vrijstelling.door }));
  }
  function blijftInSchaduw(dagen) {
    const grens = tijd() - Math.max(0, dagen == null ? 30 : dagen) * DAG;
    return lijst().filter(r => r.modus === MODUS.SCHADUW && !r.vrijstelling && r.sinds <= grens)
      .map(r => ({ id: r.id, sinds: r.sinds, waarnemingen: r.waarnemingen, zouTegenhouden: r.zouTegenhouden }));
  }

  /* Een regel aanmelden met een startstand. Bestaat hij al, dan verandert er
     NIETS: een herstart van de server hoort een afgedwongen regel niet terug in
     de schaduw te zetten. */
  function meld(id, startModus) {
    const R = alles();
    const k = String(id || '');
    if (R[k]) return stand(k);
    const r = rij(k);
    const m = String(startModus || MODUS.SCHADUW).toUpperCase();
    if (MODUS[m] && m !== MODUS.AFDWINGEN) r.modus = m;
    save();
    return stand(k);
  }

  return { weeg, rijp, zetModus, stelVrij, stand, lijst, meld, vrijgesteld, blijftInSchaduw, MODUS, RIJP };
}

module.exports = { maakSchaduw, MODUS, RIJP, VOORBEELDEN };
