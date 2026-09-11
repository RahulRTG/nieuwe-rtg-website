/* ============================================================================
   RTG Vertegenwoordiging, de HANDELINGEN: voorstellen, aanvaarden, intrekken,
   de eigen grens zetten, en handelen onder een machtiging.

   Afgesplitst van ./index.js op de 10 kB-grens (keuringsregel 13), langs een
   echte naad: daar staat de opslag en wat je mag ZIEN, hier staat wat er
   VERANDERT. Krijgt de gedeelde hulp van index.js mee.

   DE VOLGORDE IS DE BESCHERMING. Voorstellen doet de vertegenwoordiger,
   aanvaarden doet de client, en daartussen zit de simulatie. Wie die volgorde
   omdraait -- de client stelt voor, de vertegenwoordiger aanvaardt -- heeft een
   machtiging gebouwd die je kunt krijgen zonder hem te lezen.

   EN EEN GEWEIGERDE HANDELING LAAT EEN SPOOR NA. Dat is niet vanzelfsprekend:
   de makkelijke vorm geeft een 403 terug en vergeet het. Maar juist een POGING
   buiten het mandaat is wat een client wil zien -- een vertegenwoordiger die
   drie keer iets probeerde wat hij niet mocht, is een gesprek waard. */
'use strict';

const { bestaat, HOEDANIGHEDEN } = require('./bevoegdheden');
const M = require('./machtiging');

module.exports = (h) => {
  const { dossier, dossierKijk, dossiersRuw, vind, publiek, bevoegdhedenVan,
    vastleggen, nu, scho, crypto, keyVanCodenaam, naam, volw, MAX_PER_LID, MAX_LOG,
    jeugdHaal } = h;

  const id = () => 'vm' + crypto.randomBytes(5).toString('hex');

  /* HET SPOOR. Groeit aan, wordt nooit herschreven, en draagt altijd of het
     GELUKT is -- een log met alleen successen is een reclamefolder. */
  function spoor(clientKey, regel) {
    const d = dossier(clientKey);
    d.log.unshift(Object.assign({ id: id(), at: nu() }, regel));
    if (d.log.length > MAX_LOG) d.log.length = MAX_LOG;
  }

  /* ---------- voorstellen: de vertegenwoordiger vraagt ---------- */
  async function voorstel(vertegenwoordigerKey, data) {
    const d = data || {};
    /* `keyVanCodenaam` IS ASYNC EN GEEFT EEN OBJECT. Hier stond hij als een
       synchrone functie die een sleutel teruggaf, en dat was van buiten niet te
       zien: een Promise is waar, dus de 404 voor een onbekend lid vuurde nooit
       en het verzoek liep door naar de 18+-poort met een Promise als sleutel.
       De unittoetsen misten het omdat hun eigen fixture zich hield aan de vorm
       die de code AANNAM in plaats van aan de vorm die de gids heeft -- precies
       de valkuil uit CLAUDE.md over de cap die met verzonnen invoer groen bleef.
       Gevonden door test/vertegenwoordiging.e2e.test.js tegen een echte server. */
    const gevonden = keyVanCodenaam ? await keyVanCodenaam(scho(d.client, 80)) : null;
    const clientKey = gevonden && gevonden.key;
    if (!clientKey) return { status: 404, error: 'Dit lid bestaat niet. Vraag om de codenaam zoals die in RTG staat.' };
    if (clientKey === vertegenwoordigerKey) {
      return { status: 400, error: 'U kunt uzelf niet machtigen; u mag dit alles al zelf.' };
    }
    /* DE JEUGDGRENS. Zie de kop van ./index.js: half bouwen is hier de slechtste
       optie, dus weigert hij met de reden en met wat eraan te doen is. */
    /* HET JEUGDBESTUUR OORDEELT, NIET DIT BESTAND. De regels (wat is bewezen
       minderjarig, is er een bevestigde voogd, mag de voogd ook de
       vertegenwoordiger zijn) staan in ./jeugd.js, want daar horen ze en daar
       zijn ze zonder server te beproeven. */
    let voogdNodig = false;
    if (!volw(clientKey)) {
      const J = jeugdHaal && jeugdHaal();
      const oordeel = J ? J.magNamens(clientKey, vertegenwoordigerKey) : null;
      if (!oordeel || oordeel.error) {
        return oordeel || { status: 403, error: 'RTG kan van dit lid niet vaststellen dat het 18 of ouder is.' };
      }
      voogdNodig = true;
    }
    const v = M.vorm(d, { voogdNodig });
    if (v.error) return { status: 400, error: v.error };

    const doss = dossierKijk(clientKey);
    if (doss.machtigingen.filter(m => M.stand(m) !== 'ingetrokken').length >= MAX_PER_LID) {
      return { status: 409, error: 'Dit lid heeft het maximum aantal machtigingen.' };
    }
    if (doss.machtigingen.some(m => m.vertegenwoordiger === vertegenwoordigerKey && M.stand(m) === 'voorgesteld')) {
      return { status: 409, error: 'Er staat al een voorstel van u open bij dit lid.' };
    }

    const m = Object.assign({ id: id(), client: clientKey, vertegenwoordiger: vertegenwoordigerKey,
      voorgesteldDoor: vertegenwoordigerKey, gemaakt: nu() }, v.machtiging);
    const mis = await vastleggen(() => {
      dossier(clientKey).machtigingen.unshift(m);
      spoor(clientKey, { soort: 'voorgesteld', door: naam(vertegenwoordigerKey), machtigingId: m.id, gelukt: true });
    });
    if (mis) return mis;
    return { status: 200, ok: true, machtiging: publiek(m, false),
      let: voogdNodig
        ? 'Dit is een VOORSTEL, en dit lid is minderjarig: er gaat pas iets open als de jongere ' +
          'EN zijn bevestigde voogd allebei tekenen.'
        : 'Dit is een VOORSTEL. Er gaat niets open tot het lid het zelf aanvaardt.' };
  }

  /* ---------- aanvaarden: alleen de client ---------- */
  async function aanvaard(clientKey, mid) {
    const m = vind(clientKey, mid);
    if (!m) return { status: 404, error: 'Deze machtiging staat niet in uw dossier.' };
    if (m.client !== clientKey) return { status: 403, error: 'Aanvaarden doet de cliënt zelf.' };
    const st = M.stand(m);
    if (st !== 'voorgesteld') return { status: 409, error: 'Deze machtiging is ' + st + '.' };

    /* VERSMALLEN GEBEURT BIJ HET AANVAARDEN EN NIET BIJ HET VRAGEN. Zo staat er
       in de opslag wat er WERKELIJK geldt, en niet wat iemand ooit vroeg. */
    const smal = M.versmalMachtiging(bevoegdhedenVan(clientKey), m);
    if (!smal.bevoegdheden.length) {
      return { status: 409, error: 'Na uw eigen grens blijft er niets van deze machtiging over. ' +
        'Er valt dus niets te aanvaarden.' };
    }
    const mis = await vastleggen(() => {
      m.bevoegdheden = smal.bevoegdheden;
      m.aanvaard = { door: naam(clientKey), at: nu() };
      spoor(clientKey, { soort: 'aanvaard', door: naam(clientKey), machtigingId: m.id, gelukt: true,
        afgevallen: smal.buiten });
    });
    if (mis) return mis;
    return { status: 200, ok: true, machtiging: publiek(m, true), versmalling: smal.buiten.length ? smal.reden : null };
  }

  /* ---------- intrekken: altijd, per direct, door beide kanten ---------- */
  async function intrek(key, mid, reden) {
    /* BEIDE KANTEN MOGEN INTREKKEN. De cliënt vindt hem in zijn eigen dossier;
       de vertegenwoordiger neemt ontslag en zoekt hem via de andere weg. Een
       machtiging die alleen de cliënt kan beëindigen, houdt iemand vast die
       eruit wil. */
    let m = vind(key, mid), clientKey = key;
    if (!m) {
      const J = jeugdHaal && jeugdHaal();
      /* En de VOOGD, want een bestuur dat niet kan stoppen is geen bestuur. Hij
         staat niet in het dossier van de jongere en is ook niet de
         vertegenwoordiger, dus zonder deze weg kan juist de mens die meetekende
         er niets meer aan doen. */
      const gevonden = zoekAlsVertegenwoordiger(key, mid) || (J && J.zoekAlsVoogd ? J.zoekAlsVoogd(key, mid) : null);
      if (!gevonden) return { status: 404, error: 'Deze machtiging bestaat niet.' };
      m = gevonden.m; clientKey = gevonden.clientKey;
    }
    if (m.ingetrokken) return { status: 409, error: 'Deze machtiging is al ingetrokken.' };
    const mis = await vastleggen(() => {
      m.ingetrokken = { door: naam(key), at: nu(), reden: scho(reden, 200) || null };
      spoor(clientKey, { soort: 'ingetrokken', door: naam(key), machtigingId: m.id, gelukt: true });
    });
    if (mis) return mis;
    return { status: 200, ok: true, machtiging: publiek(m, clientKey === key),
      let: 'Ingetrokken per direct. Wat er eerder namens u is gedaan, blijft in uw spoor staan -- ' +
        'intrekken stopt de toekomst en niet het verleden.' };
  }

  function zoekAlsVertegenwoordiger(key, mid) {
    for (const [sleutel, doss] of Object.entries(dossiersRuw())) {
      for (const m of (doss && doss.machtigingen) || []) {
        if (m.id === String(mid || '') && m.vertegenwoordiger === key) {
          return { m, clientKey: sleutel.slice(4) };
        }
      }
    }
    return null;
  }

  /* De eigen grens van de client en het handelen ONDER een machtiging staan in
     ./handelen.js -- zie de kop daar voor de naad. Ze krijgen de gedeelde hulp
     mee plus `spoor` en `zoekAlsVertegenwoordiger`, want die twee horen bij de
     opslag en niet bij een van de twee helften. */
  const gedeeld = Object.assign({}, h, { spoor, id, zoekAlsVertegenwoordiger });
  /* `spoor` gaat mee naar buiten omdat ./jeugd.js hem ook nodig heeft, en
     index.js haalt hem er daarna weer AF voordat de kern naar de routes gaat:
     het spoor schrijven is intern werk, geen route-API. */
  return Object.assign({ voorstel, aanvaard, intrek, spoor, HOEDANIGHEDEN },
    require('./handelen')(gedeeld));
};
