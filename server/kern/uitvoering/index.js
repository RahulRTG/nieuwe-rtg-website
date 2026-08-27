/* UITVOERENDE MEDIA -- RTG speelt media niet af, RTG voert media uit.

   Een maker publiceert geen bestand maar een PARTITUUR: fragmenten, welke
   daarvan onmisbaar zijn, wat RTG ermee mag doen en wie het mag zien. RTG
   bouwt daar op het moment van vragen één UITVOERING van. De volledige
   redenering staat in UITVOEREND.md.

   DIT IS GEEN TWEEDE MEDIAWERELD. Net als de Media OS bezit deze laag geen
   enkel mediadomein: een fragment draagt een verwijzing en twee getallen, en
   wordt bij het uitvoeren opgelost via dezelfde catalogus met de sessie van de
   kijker. Er komt dus nergens een tweede exemplaar van een clip of een uitgave
   naast het origineel te staan (LAT.md regel 4). Wat deze laag wél bezit is
   precies wat nergens bestond: de partituur en de aanspraak.

   DE VIER BEGRIPPEN, EN DAT ZE ALLE VIER GEMETEN ZIJN. Er is in dit huis al
   een keer gebleken dat een naam stil twee dingen kan gaan betekenen
   (SEMANTIEK.json: 77 namen, 279 betekenissen). Vóór er hier iets heette, is
   elk woord geteld:

     aanspraak   0 treffers -- vrij           wat een kijker mag verlangen
     partituur   0 treffers -- vrij           wat de maker vastlegt
     fragment    geen domeinbetekenis         een bereik in een stuk
     uitvoering  2 treffers, andere domeinen  wat er op dit moment van gemaakt is

   Twee woorden uit de eerste opzet zijn daarop AFGEVALLEN, en dat is geen
   detail: `deel` botste met `deelId()` en `delen` in precies de module die het
   id moet parsen, en `programma` betekent hier al een lijst gebeurtenissen op
   een dag (reisboek, sportclub, clubs). Zie ./fragment.js en ./partituur.js.

   Volgt het vaste kern-patroon: draagt state, praat niet met de buitenwereld,
   en is los te toetsen. */
'use strict';

function maakUitvoering({ db, save, schoon, crypto, catalogus, keyVanCodenaam, pay, codenaamVan, onboarding }) {
  const aanspraak = require('./aanspraak')({ db, save, crypto, schoon });
  const partituur = require('./partituur')({ db, save, schoon, crypto, catalogus });
  const { bouwUitvoering } = require('./uitvoer')({ catalogus, partituur, aanspraak });
  /* De aankoop die een aanspraak laat ontstaan (./aanbod.js). Optioneel: draait
     RTG Pay niet mee, dan is er geen aanbod en zegt de route dat, in plaats van
     een knop te tonen die niets doet. */
  const aanbod = pay ? require('./aanbod')({ partituur, aanspraak, pay, codenaamVan, onboarding }) : null;

  /* WIE MAG EEN AANSPRAAK VERLENEN. Alleen een maker, en alleen voor een code
     die een van zijn EIGEN partituren werkelijk vraagt. Zonder die band zou
     iedereen een aanspraak kunnen uitdelen op de code van een ander -- en dan
     is de aanspraak geen grond meer maar een vlag die iedereen kan zetten,
     precies wat ./aanspraak.js probeert te voorkomen.

     En nooit aan uzelf: wie zijn eigen aanspraken kan maken, heeft er geen. */
  function magVerlenen(sess, code) {
    const c = String(code || '').toLowerCase();
    if (!c) return { ok: false, error: 'Noem de code van de aanspraak.' };
    const heeft = (db.data.partituren || []).some(p => p.key === sess.key && p.aanspraakNodig === c);
    if (!heeft) return { ok: false, error: 'U heeft geen partituur die om de aanspraak "' + c + '" vraagt.' };
    return { ok: true, code: c };
  }
  async function sleutelVan(codenaam) {
    if (!keyVanCodenaam) return null;
    const rij = await keyVanCodenaam(String(codenaam || ''));
    return rij && rij.key ? rij.key : null;
  }
  async function verleen(sess, opdracht) {
    const o = opdracht || {};
    const m = magVerlenen(sess, o.code);
    if (!m.ok) return { status: 403, error: m.error };
    const doel = await sleutelVan(o.codenaam);
    if (!doel) return { status: 404, error: 'Dit lid bestaat niet (of heeft een andere codenaam).' };
    if (doel === sess.key) return { status: 400, error: 'Een aanspraak aan uzelf verlenen kan niet: dan is het geen grond meer.' };
    return aanspraak.verleen(doel, { code: m.code, herkomst: o.herkomst, bron: o.bron, tot: o.tot });
  }
  async function intrek(sess, opdracht) {
    const o = opdracht || {};
    const m = magVerlenen(sess, o.code);
    if (!m.ok) return { status: 403, error: m.error };
    const doel = await sleutelVan(o.codenaam);
    if (!doel) return { status: 404, error: 'Dit lid bestaat niet (of heeft een andere codenaam).' };
    return aanspraak.trekAanspraakIn(doel, o.aanspraakId);
  }

  return {
    uitvoering: {
      partituren: (sess) => partituur.mijne(sess),
      partituurMaak: (sess, o) => partituur.maak(sess, o),
      partituurZet: (sess, o) => partituur.zet(sess, o),
      onderdeel: (sess, o) => partituur.onderdeel(sess, o),
      voerUit: bouwUitvoering,
      bon: (sess, o) => aanbod ? aanbod.bon(sess, (o || {}).partituurId)
        : { status: 503, error: 'De betaallaag draait niet mee; betaalde partituren zijn nu niet te kopen.' },
      koop: (sess, o) => aanbod ? aanbod.koop(sess, o)
        : { status: 503, error: 'De betaallaag draait niet mee; betaalde partituren zijn nu niet te kopen.' },
      aanspraken: (sess) => aanspraak.mijne(sess.key),
      verleen, intrek,
      HERKOMSTEN: aanspraak.HERKOMSTEN, ROLLEN: partituur.ROLLEN
    }
  };
}

module.exports = { maakUitvoering };
