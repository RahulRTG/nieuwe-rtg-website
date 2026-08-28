/* RTG Festival (deelmodule): het TERREIN als boom van plekken.

   De soortentabel met de drie rollen (telt / poort / voorziening) staat in
   ./soorten.js.

   EEN VORM EN GEEN TWEE (FESTIVAL.md par. 3.1). De verleiding is zone en object
   te scheiden -- een zone heeft bezoekers, een object is een ding. Dat kost
   direct: een mainstage heeft capaciteit, de zone eromheen heeft capaciteit, de
   camping heeft capaciteit. Wie daar twee soorten van maakt, schrijft elke
   telling, elke drempel en elke uitzondering twee keer, en dan lopen ze uit
   elkaar. Dus: EEN vorm `plek`, met een soort en een ouder, zo diep als het
   festival is.

   DE VEILIGE CAPACITEIT STAAT APART, en dat is geen verfijning. De vergunning
   noemt een maximum; de veiligheidsorganisatie noemt een lager getal waarbij je
   al moet ingrijpen. Het verschil tussen die twee IS de tijd die je hebt, en een
   systeem dat er een getal van maakt, gooit die tijd weg. */
'use strict';

const { PLEK_SOORTEN: SOORTEN } = require('./soorten');

const MAX_DIEPTE = 8;

module.exports = (ctx) => {
  const { save, crypto, schoon, editieVind } = ctx;

  const id = () => 'plek' + crypto.randomBytes(4).toString('hex');
  const plekVind = (e, pid) => (e && e.plekken ? e.plekken[String(pid || '')] : null) || null;

  /* HET PAD NAAR BOVEN: van deze plek tot de wortel. Elke capaciteitsregel,
     elke telling en elk recht loopt hierlangs, dus dit is de plek waar een
     kapotte boom zich moet melden in plaats van vast te lopen.

     DE GRENDEL STAAT HIER EN NIET ALLEEN BIJ HET SCHRIJVEN. Bij het schrijven
     wordt een cyclus geweigerd (zie plekZet), maar data kan ook van buiten
     komen -- een herstelde back-up, een migratie, een hand in db.json. Een lus
     zou hier een oneindige while zijn en de hele server ophangen.

     EEN GRENDEL EN NIET TWEE. Hier stond eerst ook een Set van geziene plekken
     naast de dieptegrens. Die vond niets wat de diepte niet al ving -- een lus
     laat `uit` immers even hard groeien als een te diepe boom -- en dode code
     die op een wacht lijkt is erger dan geen wacht, want de volgende vertrouwt
     hem (LAT-regel 4, en zie de kop van kern/objectlaag/eventwereld.js). De
     diepte is de grendel; plekZet bewaakt dat een ECHTE boom er nooit tegenaan
     loopt, zodat een null hier altijd "stuk" betekent en nooit "te diep". */
  function plekPad(e, pid) {
    const uit = [];
    let p = plekVind(e, pid);
    while (p) {
      uit.push(p);
      if (uit.length > MAX_DIEPTE) return null;
      if (!p.ouder) return uit;
      p = plekVind(e, p.ouder);
    }
    /* Hier komen we alleen als de ouderketen doodloopt op een plek die niet
       bestaat (of als pid zelf niet bestaat). Beide keren is de boom niet te
       vertrouwen, en dan is null het enige eerlijke antwoord. */
    return null;
  }

  /* Ligt `pid` in `doelId` -- of IS het die plek? Dit is de vraag die een recht
     stelt: wie een recht heeft op de zone "camping", mag ook op "camping-noord"
     dat erin ligt. Zonder deze regel zou elk recht elke onderliggende plek
     apart moeten noemen, en dan is de boom versiering. */
  function plekIn(e, pid, doelId) {
    const pad = plekPad(e, pid);
    if (!pad) return false;
    return pad.some(p => p.id === String(doelId || ''));
  }

  function plekZet(fid, eid, data) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const d = data || {};
    const naam = schoon(d.naam, 60);
    if (!naam) return { status: 400, error: 'Geef de plek een naam.' };
    const soort = String(d.soort || '');
    /* Een onbekende soort wordt GEWEIGERD en niet stil opgeslagen. De soort
       bepaalt of hier mensen geteld worden; een typefout ("toiletten") zou dus
       een plek maken die er is maar nooit meetelt, en dat is het soort stille
       gat waar LAT-regel 5 over gaat. */
    if (!Object.prototype.hasOwnProperty.call(SOORTEN, soort))
      return { status: 400, error: 'Onbekende soort plek: ' + (soort || '(leeg)') + '.' };
    const rol = SOORTEN[soort];

    const besloten = d.besloten === true;
    /* DE CHANGEOVER hoort bij de PLEK en niet bij de boeking: een mainstage
       heeft een half uur nodig om om te bouwen en een akoestische hoek vijf
       minuten. Zet je hem per set, dan staat dezelfde waarheid bij elke set
       opnieuw en loopt hij bij de eerste wijziging uit de pas. */
    const changeover = d.changeover == null || d.changeover === ''
      ? 0 : Math.max(0, Math.min(240, parseInt(d.changeover, 10) || 0));
    /* DE DOORSTROOM hoort net zo goed bij de plek: hoeveel mensen er per uur
       door deze uitgang of halte kunnen. Het is het enige getal waarmee "hoe
       lang duurt het leeglopen" te rekenen valt, en het is een getal van de
       ORGANISATOR -- wij meten het niet en verzinnen het niet. Staat het er
       niet, dan rekent ./voorspelling.js hier niets uit en zegt dat ook. */
    const doorstroom = d.doorstroom == null || d.doorstroom === ''
      ? 0 : Math.max(0, Math.min(1000000, parseInt(d.doorstroom, 10) || 0));
    const cap = Math.max(0, Math.min(1000000, parseInt(d.capaciteit, 10) || 0));
    let veilig = d.veiligeCapaciteit == null || d.veiligeCapaciteit === ''
      ? cap : Math.max(0, parseInt(d.veiligeCapaciteit, 10) || 0);
    if (veilig > cap) return { status: 400, error: 'De veilige capaciteit kan niet boven de capaciteit liggen.' };

    const ouder = d.ouder ? String(d.ouder) : null;
    if (rol.wortel && ouder) return { status: 400, error: 'Een terrein heeft geen ouder.' };
    if (!rol.wortel && !ouder) return { status: 400, error: 'Deze plek hoort in een terrein of zone te liggen.' };
    if (ouder) {
      const o = plekVind(e, ouder);
      if (!o) return { status: 404, error: 'De plek waar dit in moet liggen, bestaat niet.' };
      /* Een poort heeft niets binnenin: je gaat er doorheen. Zonder deze regel
         kun je een podium in een hek hangen, en dan telt de bezetting van dat
         podium nergens meer mee. */
      if (SOORTEN[o.soort] && SOORTEN[o.soort].poort)
        return { status: 400, error: 'In een poort ligt niets; kies de zone erachter.' };
      /* De diepte wordt HIER afgedwongen en niet pas bij het lezen. Zonder deze
         regel kon iemand een boom van negen lagen bouwen die plekZet netjes
         accepteerde, waarna plekPad hem null noemde en elk recht erop weigerde
         zonder dat er ooit iets was gemeld -- een stille fout (LAT-regel 5). */
      const padOuder = plekPad(e, o.id);
      if (!padOuder) return { status: 409, error: 'Het terrein hangt scheef; herstel eerst de plek erboven.' };
      if (padOuder.length >= MAX_DIEPTE)
        return { status: 400, error: 'Een terrein gaat tot ' + MAX_DIEPTE + ' lagen diep.' };
    }

    if (d.id) {
      const p = plekVind(e, d.id);
      if (!p) return { status: 404, error: 'Deze plek bestaat niet.' };
      /* DE CYCLUSGRENDEL BIJ HET SCHRIJVEN. Zet de nieuwe ouder proefondervin-
         delijk en loop naar boven: komen we onszelf tegen, dan is het een lus.
         Dit moet VOOR het opslaan gebeuren, want daarna is de boom al stuk. */
      if (ouder && (ouder === p.id || plekIn(e, ouder, p.id)))
        return { status: 400, error: 'Een plek kan niet in zichzelf liggen.' };
      Object.assign(p, { naam, soort, ouder, besloten, changeover, doorstroom,
        capaciteit: cap, veiligeCapaciteit: veilig });
      save();
      return { ok: true, plek: p };
    }
    const p = { id: id(), naam, soort, ouder, besloten, changeover, doorstroom,
      capaciteit: cap, veiligeCapaciteit: veilig };
    if (Object.keys(e.plekken).length >= 2000) return { status: 400, error: 'Tot tweeduizend plekken per editie.' };
    e.plekken[p.id] = p;
    save();
    return { ok: true, plek: p };
  }

  function plekWeg(fid, eid, pid) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const p = plekVind(e, pid);
    if (!p) return { status: 404, error: 'Deze plek bestaat niet.' };
    /* Een plek met kinderen weghalen zou die kinderen wezen maken: hun ouder
       wijst dan naar niets, plekPad geeft null, en elk recht erop weigert
       zonder dat iemand snapt waarom. Liever hier weigeren dan daar raden. */
    const kinderen = Object.values(e.plekken).filter(x => x.ouder === p.id);
    if (kinderen.length) return { status: 409, error: 'Haal eerst weg wat hierin ligt (' + kinderen.length + ').' };
    delete e.plekken[p.id];
    save();
    return { ok: true };
  }

  /* De boom, genest, voor een scherm. Plekken waarvan de ouder ontbreekt komen
     als losse wortel terug in plaats van te verdwijnen -- onzichtbaar verloren
     data is erger dan zichtbaar scheve data. */
  function plekBoom(fid, eid) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const alle = Object.values(e.plekken || {});
    const kind = (p) => ({ ...p, rol: SOORTEN[p.soort] || {},
      in: alle.filter(x => x.ouder === p.id).map(kind) });
    const wortels = alle.filter(p => !p.ouder || !e.plekken[p.ouder]);
    return { ok: true, boom: wortels.map(kind) };
  }

  return { plekZet, plekWeg, plekVind, plekPad, plekIn, plekBoom, PLEK_SOORTEN: SOORTEN };
};

