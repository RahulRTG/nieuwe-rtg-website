/* DE INVOERBALIE -- fase 2 van REIZEN.md: een reis die u ergens anders boekte,
   toch in RTG krijgen.

   DE COMMERCIELE KERN, in één zin: RTG hoeft de boeking niet te winnen om de
   reisrelatie te winnen. Wie zijn vlucht bij een ander kocht en hem hier
   invoert, heeft alsnog één reis, één tijdlijn en één dossier.

   HET WERKWOORD IS SAMENSTELLEN EN KLAARZETTEN; BEVESTIGEN DOET DE MENS. Wat er
   uit een document komt is een VOORSTEL, geen reisonderdeel. Pas als iemand het
   bevestigt (en desgewenst corrigeert) ontstaat er een onderdeel. Dat is niet
   omslachtigheid: een extractie die zichzelf in uw reisplan zet, zet daar vroeg
   of laat een verkeerde datum in, en dan is het te laat om nog te twijfelen.

   VIER DINGEN DIE HIER VASTLIGGEN.

   1. HET ORIGINEEL BLIJFT, en het blijft van u. Het bestand gaat naar uw eigen
      kluis (RTG Bestanden) en niet naar een tweede, verborgen opslag: daar staat
      al een quotum op, een virusscan, een prullenbak en een verwijderknop. Het
      onderdeel draagt alleen een VERWIJZING. Zo is invoeren geen val -- u kunt
      uw eigen bewijsstuk zien en weggooien (REIZEN.md par. 4.9).
   2. WAT ER GELEZEN IS, STAAT ERBIJ. Elk veld draagt waarde, hoe, zekerheid en
      waaruit. Die extractie wordt hier bewaard en komt NIET van de aanvrager:
      de client stuurt geen zekerheden mee, want een bewijsstuk dat de aanvrager
      zelf invult is geen bewijsstuk (zelfde reden als bij de identiteitskluis).
   3. EEN CORRECTIE OVERSCHRIJFT DE LEZING NIET, hij komt ernaast. Vult iemand
      een datum met de hand in, dan staat er vanaf dan `hoe: 'mens'` bij dat
      veld -- en wat de lezer ervan maakte blijft in `gelezen` staan. Anders is
      achteraf niet meer te zien of een reis op een aanname of op een mens rust.
   4. EEN INGEVOERD ONDERDEEL IS GEEN VERKOCHTE BOEKING (REIZEN.md par. 4.3).
      Het krijgt de herkomst `document`, `beeld` of `handmatig`, en de stand
      `ingelezen` -- of `tecontroleren` zolang er velden onder de drempel staan.
      RTG zegt nergens dat dit bevestigd is; het document zegt dat, en van wie
      dat document is staat erbij.

   WAT DEZE FASE NIET DOET, en dat hoort er zo te staan (LAT-regel 6): hij LEEST
   geen PDF's en geen foto's. Een pdf uitpakken of een schermafdruk lezen vraagt
   OCR of een model; wat hier binnenkomt als bestand wordt bewaard als
   bewijsstuk, en wat er GELEZEN wordt is de tekst die u erbij geeft (een
   doorgestuurde e-mail, een geplakte boardingpass-strook) of een tekstbestand.
   Doen alsof we een pdf lezen en er dan een lege extractie uit halen, zou de
   ergste van de twee zijn. */
'use strict';
const klok = require('../lib/klok');

const lezer = require('./invoer-lezer');

/* Welke velden een mens mag zetten bij het bevestigen. De rest komt uit de
   lezer en is niet van buitenaf te schrijven -- zie punt 2 hierboven. */
const MENSVELDEN = ['soort', 'titel', 'bestemming', 'van_datum', 'tot_datum', 'kenmerk'];
const SOORTEN = ['vlucht', 'verblijf', 'vervoer', 'transfer', 'activiteit', 'tafel', 'evenement', 'spoor'];

module.exports.maakInvoer = ({ db, save, crypto, bestandenUpload, plaatsVind }) => {
  const nu = () => klok.datum().toISOString();
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 120);
  const eigen = require('./eigencollectie')({ db, domein: 'kern/invoer', bezit: { reisInvoer: 'kaart' } });
  const bak = () => eigen.bak('reisInvoer', (b) => { b.voorstellen = []; b.items = []; });
  // een document, een foto of niets: dat bepaalt de herkomst en niets anders
  const herkomstVan = (mime) => !mime ? 'handmatig' : /^image\//.test(mime) ? 'beeld' : 'document';

  /* ---- 1. lezen: een voorstel maken en het origineel wegleggen ---- */
  async function lees(key, body) {
    body = body || {};
    const tekst = String(body.tekst || '').slice(0, 20000);
    let bewijs = null;
    if (body.dataUrl) {
      const naam = schoon(body.naam, 80) || 'reisdocument';
      const r = await bestandenUpload(key, { naam, map: null, dataUrl: body.dataUrl });
      if (r && r.error) return r;                       // quotum, virus, te groot: onveranderd doorgeven
      const mime = (/^data:([\w.+-]+\/[\w.+-]+);base64,/.exec(String(body.dataUrl)) || [])[1] || '';
      bewijs = { bestandId: r.id, naam, mime, bytes: r.bytes };
      /* Een tekstbestand kan de lezer wél zelf openen; een pdf of een foto
         niet. Wat hij niet kan lezen, wordt bewaard en niet geraden. */
      if (/^text\//.test(mime) && !tekst) {
        try { body.tekst = Buffer.from(String(body.dataUrl).split(',')[1], 'base64').toString('utf8').slice(0, 20000); } catch (e) {}
      }
    }
    const bron = String(body.tekst || tekst || '').slice(0, 20000);
    if (!bron.trim() && !bewijs) return { status: 400, error: 'Geef een document of plak de tekst van uw bevestiging.' };

    const gelezen = bron.trim() ? lezer.lees(bron, { plaatsVind }) : null;
    const v = {
      id: 'V-' + crypto.randomBytes(4).toString('hex'),
      key, at: nu(), bewijs,
      hoe: gelezen ? gelezen.hoe : null,
      code: gelezen ? gelezen.code : null,
      velden: gelezen ? gelezen.velden : {},
      onzeker: gelezen ? gelezen.onzeker : [],
      soort: gelezen ? gelezen.soort : null
    };
    const b = bak();
    b.voorstellen.unshift(v);
    b.voorstellen = b.voorstellen.slice(0, 2000);
    save();
    return { ok: true, voorstel: v, drempel: lezer.DREMPEL,
      opmerking: gelezen
        ? 'Dit is wat wij eruit lezen. Kijk het na en vul aan wat ontbreekt; pas als u bevestigt komt het bij uw reizen te staan.'
        : 'Wij konden er niets uit lezen. Het bestand is bewaard als bewijsstuk; vul de gegevens zelf in.' };
  }

  /* VOORLEZEN ZONDER IETS TE BEWAREN. Het kantoor zet een reis klaar voor
     iemand die nog geen lid is; er is dus geen kluis om een origineel in te
     leggen en geen account om een voorstel aan te hangen. Deze weg leest alleen
     -- er blijft niets achter over een mens die nog geen klant is (zie de kop
     van kern/reisuitnodiging.js). */
  const leesVoor = (tekst) => {
    const r = lezer.lees(String(tekst || '').slice(0, 20000), { plaatsVind });
    return r ? { ok: true, gelezen: r, drempel: lezer.DREMPEL }
      : { status: 400, error: 'Hier valt niets uit te lezen. Vul de gegevens met de hand in.' };
  };

  /* ---- 2. bevestigen: pas hier ontstaat een onderdeel ---- */
  function bevestig(key, id, correcties) {
    const b = bak();
    const v = b.voorstellen.find(x => x.id === String(id || '') && x.key === key);
    if (!v) return { status: 404, error: 'Dit voorstel bestaat niet (meer).' };
    if (v.gebruikt) return { status: 409, error: 'Dit voorstel is al bevestigd.' };

    /* De correcties van de mens komen NAAST de lezing te staan, niet eroverheen:
       `gelezen` bewaart wat de lezer ervan maakte. */
    const velden = {};
    for (const [naam, f] of Object.entries(v.velden || {})) velden[naam] = Object.assign({}, f);
    for (const naam of MENSVELDEN) {
      if (!(correcties || {}).hasOwnProperty(naam)) continue;
      const w = schoon(correcties[naam], 120);
      if (!w) { delete velden[naam]; continue; }
      velden[naam] = { waarde: w, zekerheid: 1, hoe: 'mens', uitleg: 'door u ingevuld',
        gelezen: velden[naam] ? velden[naam].waarde : null };
    }

    const w = (n) => (velden[n] || {}).waarde || null;
    const soort = SOORTEN.includes(w('soort')) ? w('soort') : null;
    if (!soort) return { status: 400, error: 'Kies wat voor onderdeel dit is (' + SOORTEN.join(', ') + ').' };
    const titel = w('titel') || w('vlucht') || w('kenmerk');
    if (!titel) return { status: 400, error: 'Geef dit onderdeel een naam, bijvoorbeeld "Hotel Dubai".' };
    const datum = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? s : null;
    const van = datum(w('van_datum'));
    if (!van) return { status: 400, error: 'Zonder datum kan dit onderdeel bij geen enkele reis horen.' };

    const onzeker = Object.keys(velden).filter(n => velden[n].zekerheid < lezer.DREMPEL);
    const item = {
      id: 'I-' + crypto.randomBytes(4).toString('hex'),
      key, soort, titel, bestemming: w('bestemming') || '',
      van, tot: datum(w('tot_datum')), kenmerk: w('kenmerk') || '',
      /* De stand zegt wat het IS: ingelezen uit uw eigen document. Staat er nog
         iets onder de drempel, dan zegt hij dat ook -- en dan vraagt de reis er
         aandacht voor in plaats van hem groen te tonen. */
      status: onzeker.length ? 'tecontroleren' : 'ingelezen',
      herkomst: herkomstVan(v.bewijs && v.bewijs.mime),
      bewijs: v.bewijs, code: v.code, velden, onzeker,
      voorstelId: v.id, at: nu()
    };
    v.gebruikt = item.id;
    b.items.unshift(item);
    b.items = b.items.slice(0, 5000);
    save();
    return { ok: true, onderdeel: item };
  }

  /* De onderdelen zelf -- opvragen, weghalen, doorgeven aan de reiswereld en
     overnemen uit een uitnodiging -- staan in ./invoer-onderdelen.js. Deze
     module is de BALIE (lezen en bevestigen); dat is een andere vraag dan wat er
     met de onderdelen daarna gebeurt. Ze delen dezelfde bak, en die wordt
     doorgegeven in plaats van overgetikt. */
  const { mijn, weg, mijnRegels, neemOver } = require('./invoer-onderdelen')({ bak, save, crypto, nu, schoon });

  return { invoer: { lees, leesVoor, bevestig, mijn, weg, mijnRegels, neemOver, SOORTEN } };
};
