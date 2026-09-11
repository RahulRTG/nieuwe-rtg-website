/* ============================================================================
   HET JEUGDBESTUUR -- wie tekent er mee voor een talent onder de achttien.

   Dit is nummer 7 uit CARRIERE.md par. 6, en het bestaat omdat de weigering die
   het vervangt eerlijk was maar doodliep: "is het lid minderjarig, dan is er een
   ouder of verzorger bij nodig -- dat jeugdbestuur is nog niet gebouwd". In de
   sport en de muziek is dat juist de groep waar het misgaat: een talent van
   zeventien tekent iets wat hij niet leest.

   LEVEN.md PAR. 2 STAAT HIERBOVEN, en dat verandert de vorm. Een kind is geen
   profiel: de jongere houdt zijn EIGEN account, zijn eigen codenaam en zijn
   eigen inzicht. Er komt geen ouderaccount waarin een jongere een rij is. En
   nooit sturen maar openen -- daarom tekent de jongere ZELF mee (regel 2
   hieronder), ook al is het de handtekening van de voogd die juridisch bindt.

   WAAROM DIT NIET OP DE BESTAANDE VOOGDMACHINERIE LEUNT. kern/sociaal heeft
   `voogdWacht` en dat werkt goed, maar het hangt aan RTF-GEZINSPROFIELEN
   (isRtf, profielInfoVanHandle): een kind is daar een profiel binnen een gezin
   en heeft per definitie GEEN eigen account. kern/volwassen.js zegt dat met
   zoveel woorden. Een talent met een eigen RTG-account is een andere vorm, en
   die twee door elkaar halen zou betekenen dat een sporter zijn loopbaan in het
   gezinsdossier van zijn ouders voert. Het WOORD voogdWacht is wel geleend,
   want het is hetzelfde idee.

   VIER REGELS DIE HIER IN CODE STAAN:

   1 EEN VOOGD COMPENSEERT LEEFTIJD, NOOIT ONBEKENDE IDENTITEIT. De weg gaat
     alleen open als RTG het document HEEFT GEZIEN (A3) en de geboortedatum van
     dat document komt (`leeftijdBron === 'paspoort'`). Staat de datum nog zoals
     het lid hem zelf intypte, dan weten we niet eens dat hij minderjarig IS --
     en dan is een voogd aanwijzen een gok met een handtekening eraan.
   2 DRIE PARTIJEN, DRIE HANDELINGEN. De jongere wijst aan (het is zijn account),
     de volwassene aanvaardt de rol (niemand wordt ongevraagd voogd), en een MENS
     van RTG bevestigt na bewijs. Zonder die derde stap kan een zestienjarige
     zijn negentienjarige vriend aanwijzen, en dan tekenen er twee kinderen.
   3 RTG RAADPLEEGT GEEN GEZAGSREGISTER. Wat hier wordt vastgesteld is dat een
     medewerker een stuk heeft gezien -- dezelfde eerlijkheid als bij de
     identiteitsverificatie. Wij valideren niets inhoudelijk en doen niet alsof.
   4 DE VOOGD KAN NIET OOK DE VERTEGENWOORDIGER ZIJN. Dan houdt een hand beide
     handtekeningen vast en is de tweede een formaliteit. Dat is de constructie
     waar dit hele document over gaat.

   Wat dit bestand NIET doet: machtigingen vormen of aanvaarden. Het zegt alleen
   WIE er meetekent en of dat vaststaat. ./acties.js gebruikt dat.
   ========================================================================== */
'use strict';

const { voldoet } = require('../betrouwbaarheid');

const STANDEN = Object.freeze(['gevraagd', 'aanvaard', 'bevestigd', 'afgewezen']);
const MIN_NIVEAU = 'A3';
const MEERDERJARIG = 18;

module.exports = (h) => {
  const { dossier, dossierKijk, dossiersRuw, vastleggen, nu, naam, scho, keyVanCodenaam, volw, lidstand, spoor } = h;

  /* De stand van een jongere, in de vorm die deze laag nodig heeft. Alle drie
     de velden komen uit EEN lezing (kern/betrouwbaarheid.js), zodat er geen
     moment bestaat waarop de leeftijd van de ene lezing bij het niveau van de
     andere staat. */
  function jeugdstand(key) {
    const st = (typeof lidstand === 'function' ? lidstand(String(key || '')) : null) || {};
    const gezien = !!st.account && voldoet(st.niveau, MIN_NIVEAU) && st.leeftijdBron === 'paspoort';
    return {
      account: !!st.account,
      gezien,
      leeftijd: st.leeftijd == null ? null : st.leeftijd,
      bron: st.leeftijdBron || 'opgegeven',
      /* MINDERJARIG IS HIER EEN BEWEZEN TOESTAND EN GEEN VERMOEDEN. `false`
         betekent dus niet "volwassen" maar "niet vastgesteld dat hij het niet
         is" -- vandaar dat de aanroeper altijd ook `gezien` leest. */
      minderjarig: gezien && st.leeftijd != null && st.leeftijd < MEERDERJARIG
    };
  }

  function voogdVan(key) {
    const d = dossierKijk(key);
    const v = d && d.voogd;
    return v && v.stand === 'bevestigd' ? v : null;
  }

  /* Wat de jongere en de voogd te zien krijgen. Ook als er niets staat, want een
     leeg antwoord dat "nog niemand" zegt is iets anders dan een fout. */
  function jeugdbeeld(key) {
    const st = jeugdstand(key);
    const d = dossierKijk(key);
    const v = (d && d.voogd) || null;
    return {
      minderjarig: st.minderjarig, leeftijdGezien: st.gezien, leeftijdBron: st.bron,
      voogd: v ? { wie: v.wie, stand: v.stand, at: v.at, bevestigdDoor: v.bevestigdDoor || null } : null,
      nodig: st.minderjarig && !voogdVan(key)
    };
  }

  /* HET OORDEEL DAT ./acties.js VRAAGT voordat hij een voorstel aanneemt voor
     iemand die de 18+-poort niet haalt. Geeft `{ ok: true }` of een weigering
     met de reden; nooit een kale boolean, want de drie manieren waarop dit
     misgaat vragen elk een ander antwoord van de mens die het leest. */
  function magNamens(clientKey, vertegenwoordigerKey) {
    const st = jeugdstand(clientKey);
    if (!st.minderjarig) {
      return { status: 403, error: 'RTG kan van dit lid niet vaststellen dat het 18 of ouder is, en dan ' +
        'gaat een machtiging niet door. Laat de identiteit verifieren op /apps/verificatie.html; ' +
        'blijkt het lid daarna minderjarig, dan loopt het via het jeugdbestuur.' };
    }
    const voogd = voogdVan(clientKey);
    if (!voogd) {
      return { status: 403, error: 'Dit lid is volgens zijn identiteitsbewijs minderjarig. Er kan pas ' +
        'namens hem gehandeld worden als RTG een voogd heeft bevestigd, en die bevestiging vraagt dat ' +
        'een medewerker een stuk heeft gezien. Het lid wijst zelf iemand aan; wij raadplegen geen ' +
        'gezagsregister.' };
    }
    if (voogd.key === vertegenwoordigerKey) {
      return { status: 409, error: 'U bent de bevestigde voogd van dit lid. Dan kunt u niet ook zijn ' +
        'vertegenwoordiger zijn: de tweede handtekening zou dezelfde hand zijn, en juist die tweede ' +
        'hand is waar het jeugdbestuur voor bestaat.' };
    }
    return { ok: true, voogd };
  }

  /* Een machtiging opzoeken vanaf de kant van de VOOGD. Hij staat niet in het
     dossier van de jongere en is niet de vertegenwoordiger, dus zonder deze weg
     bestaat de machtiging voor hem niet -- ook niet om hem te stoppen. */
  function zoekAlsVoogd(voogdKey, mid) {
    for (const [sleutel, doss] of Object.entries(dossiersRuw())) {
      const v = doss && doss.voogd;
      if (!v || v.key !== voogdKey || v.stand !== 'bevestigd') continue;
      const m = ((doss && doss.machtigingen) || []).find(x => x.id === String(mid || ''));
      if (m) return { m, clientKey: sleutel.replace(/^lid:/, '') };
    }
    return null;
  }

  /* De HANDELINGEN staan in ./jeugd-acties.js -- afgesplitst op de 10 kB-grens
     (keuringsregel 13), en die grens wees hier een echte naad aan in plaats van
     een willekeurige byte: hier staat wat WAAR is (is deze jongere bewezen
     minderjarig, wie is zijn voogd, mag er namens hem gehandeld worden), daar
     staat wat er GEBEURT (vragen, aanvaarden, bevestigen, meetekenen). Dezelfde
     knip als ./acties.js tegenover ./handelen.js. */
  const daden = require('./jeugd-acties')({ dossier, dossierKijk, vastleggen, nu, naam, scho,
    keyVanCodenaam, volw, spoor, jeugdstand, voogdVan, jeugdbeeld, zoekAlsVoogd });
  return Object.assign({ jeugdstand, voogdVan, jeugdbeeld, magNamens, zoekAlsVoogd, STANDEN }, daden);
};
