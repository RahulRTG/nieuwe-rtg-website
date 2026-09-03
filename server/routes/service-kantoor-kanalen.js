/* ============================================================================
   DE INGANGEN VAN RTG SERVICE -- werkt elke deur, en hoe hard weten wij dat?

   WAAROM DIT BESTAAT. Twee voorzieningen van deze laag hangen aan INRICHTING en
   niet aan code: post aan `hulp@` komt alleen binnen als de mailprovider die
   kant op wijst en DKIM of DMARC stempelt, en automatisch ondertitelen werkt
   alleen met een lokaal spraakmodel. Allebei falen ze STIL en op de goede
   manier -- een geweigerde zaak met een reden, een knop die niet verschijnt --
   en juist daarom ziet niemand van RTG dat een deur dicht staat. Een weigering
   die alleen de melder leest, is voor het huis geen signaal.

   DE HUISREGEL VAN BESTUUR.md GELDT HIER ONVERKORT: elke bewering draagt een
   BEWIJSGRAAD, en `niet vast te stellen` is een eersteklas uitslag naast in orde
   en storing. Dit bord zegt daarom van elke deur ook wat het NIET weet. Voor de
   post is dat het belangrijkste veld: of er werkelijk iets aankomt hangt af van
   DNS en van een provider, en dat kan deze server niet zien. Wie hier "in orde"
   zou schrijven omdat de code klopt, meet zijn eigen bestand in plaats van de
   werkelijkheid.
   ========================================================================== */
'use strict';

module.exports = (kern, { veilig, balieAuth }) => {
  const { app, officeAuth, servicePost, serviceKlassen, spraaktekst } = kern;

  app.post('/api/office/service/kanalen', officeAuth, balieAuth, (req, res) => veilig(res, () => {
    const kanalen = [];

    /* DE POST. Wat wij zeker weten is dat de ingang gemonteerd is en welk adres
       hij draagt. Wat wij NIET weten is of er post aankomt: dat is DNS en een
       provider, en die staan buiten deze server. */
    const adres = servicePost ? servicePost.hulpAdres() : null;
    kanalen.push({
      id: 'mail', naam: 'Per e-mail', adres,
      graad: adres ? 'gemeten' : 'onbekend',
      stand: adres ? 'ingang staat open' : 'geen ingang',
      wat: adres
        ? 'Post aan dit adres wordt een zaak. De melder wordt via de identiteitskluis teruggevonden, ' +
          'en alleen als DKIM of DMARC de afzender bevestigt.'
        : 'RTG Service draait hier zonder mailingang.',
      nietVastgesteld: [
        'Of dit adres bij de mailprovider daadwerkelijk naar deze server wijst. Dat is DNS, en dat ' +
        'kan deze server niet over zichzelf vaststellen.',
        'Of binnenkomende post een DKIM- of DMARC-stempel krijgt. Zonder stempel opent de ingang ' +
        'niets -- met de reden, maar wel stil voor RTG.'
      ],
      hoeTeMeten: 'Stuur een bericht aan ' + (adres || 'het serviceadres') + ' vanaf een adres dat bij ' +
        'een RTG-account hoort, en kijk of er een zaak op kanaal "mail" verschijnt. Komt hij niet, dan ' +
        'ligt het aan de route ernaartoe of aan de stempel -- niet aan deze laag.'
    });

    /* DE ONDERTITELING. Hier kan de server het wel zelf zien: de netwerkgrens en
       het modelnaam-veld staan in dit proces. */
    const st = spraaktekst ? spraaktekst.beschikbaar() : { beschikbaar: false, reden: 'Niet gemonteerd.' };
    kanalen.push({
      id: 'ondertiteling', naam: 'Automatisch ondertitelen in een gesprek',
      graad: 'gemeten',
      stand: st.beschikbaar ? 'in orde' : 'niet beschikbaar',
      wat: st.beschikbaar
        ? 'Een deelnemer kan zijn eigen stem laten omzetten met het lokale model. Het geluid gaat niet ' +
          'naar een andere partij en wordt niet bewaard.'
        : st.reden,
      /* DIT IS GEEN SCHOONHEIDSFOUT MAAR EEN UITSLUITING, en het bord zegt dat
         in gewone woorden. Zonder deze zin leest een rode regel als een
         ontbrekend extraatje. */
      gevolg: st.beschikbaar ? null
        : 'Wie doof is kan een gesprek hier alleen volgen als de andere deelnemers MEETYPEN. ' +
          'Bij een hulplijn weegt dat het zwaarst: wie niet kan bellen houdt dan geen kanaal over ' +
          'waar de anderen er wel een bij kregen.',
      nietVastgesteld: st.beschikbaar
        ? ['Hoe goed het model verstaat. Dat is niet gemeten en wordt hier niet geraden.']
        : []
    });

    /* DE KANALEN DIE ER MET OPZET NIET ZIJN. Uit dezelfde tabel als het scherm
       van het lid; niet overgetypt, want dan lopen ze uiteen. */
    const nogNiet = Object.entries(serviceKlassen.KANALEN)
      .filter(([, k]) => !k.gebouwd)
      .map(([id, k]) => ({ id, naam: k.naam, waarom: k.waarom }));

    return { ok: true, kanalen, nogNiet,
      let: 'Dit bord zegt wat DEZE server kan vaststellen. Wat er buiten staat -- DNS, een provider, ' +
        'een modelserver die niet draait -- staat per regel onder "niet vastgesteld", en niet als groen.' };
  }));
};
