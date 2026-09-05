/* Mutatiecontracten voor eenmalige credentialuitgifte.

   Deze routes mogen nooit door een generieke antwoordcache worden herhaald:
   het eerste antwoord bevat een kale credential. De domeinkern bindt een
   herhaalsleutel en verzoekafdruk in dezelfde collectietransactie en antwoordt
   bij een retry met conflict, zonder het geheim opnieuw te tonen. */
'use strict';

const CONTRACTEN = {
  'POST /api/samen/maak': {
    mutatieId: 'samen.maak', herkomst: 'mens',
    semantiek: { klasse: 'sleutelVereist' },
    toegang: { klasse: 'AUTHENTICATED' }, stand: 'PROTECTED',
    bewijs: { gemeten: 'test/samen-credential.test.js herhaalt uitgifte met dezelfde sleutel, ' +
      'krijgt 409 zonder code en houdt precies een kamer over', op: '2026-09-05' },
    nagekeken: 'Codex, 2026-09-05: actor, inhoud en idem-hash worden in dezelfde ' +
      'samenKamers-transactie gebonden; zonder sleutel geldt de vijfseconden-dubbeltikgrens.',
    afgetekend: { door: 'Codex, gelezen kern en gerichte lifecycleproef', op: '2026-09-05' }
  },
  'POST /api/samen/code': {
    mutatieId: 'samen.code.roteren', herkomst: 'mens',
    semantiek: { klasse: 'sleutelVereist' },
    toegang: { klasse: 'AUTHENTICATED' }, stand: 'PROTECTED',
    bewijs: { gemeten: 'test/samen-credential.test.js herhaalt een rotatie, krijgt 409 zonder ' +
      'credential en bewijst dat de oude code geweigerd blijft', op: '2026-09-05' },
    nagekeken: 'Codex, 2026-09-05: actor, kamer-id en idem-hash staan transactioneel bij de ' +
      'rotatie; de generieke antwoordcaches zijn expliciet uitgesloten.',
    afgetekend: { door: 'Codex, gelezen kern en gerichte lifecycleproef', op: '2026-09-05' }
  },
  'POST /api/samen/sluit': {
    mutatieId: 'samen.sluit', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' }, stand: 'PROTECTED',
    bewijs: { gemeten: 'test/samen-credential.test.js sluit de kamer, controleert de ' +
      'server-side intrekking en krijgt bij herhaling geen tweede effect', op: '2026-09-05' },
    nagekeken: 'Codex, 2026-09-05: alleen de huidige gastheer kan binnen de collectietransactie ' +
      'gesloten_at en ingetrokken_at zetten; daarna vindt actiefVoor de kamer niet meer.',
    afgetekend: { door: 'Codex, gelezen kern en gerichte lifecycleproef', op: '2026-09-05' }
  },
  'POST /api/meet/maak': {
    mutatieId: 'meet.maak', herkomst: 'mens',
    semantiek: { klasse: 'sleutelVereist' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: {
      gemeten: 'test/meet-credential.test.js herhaalt dezelfde creatie met dezelfde sleutel, ' +
        'verwacht 409 zonder kale code en bewijst dat precies een kamer is opgeslagen',
      op: '2026-09-05'
    },
    nagekeken: 'Codex, 2026-09-05: meetMaak bindt actor, inhoud en idem-hash atomair. ' +
      'Zonder sleutel vangt dezelfde kern een identieke dubbeltik vijf seconden af.',
    afgetekend: {
      door: 'Codex, op grond van gelezen kern plus gerichte lifecycle- en racetoets',
      op: '2026-09-05'
    }
  },
  'POST /api/meet/code': {
    mutatieId: 'meet.code.roteren', herkomst: 'mens',
    semantiek: { klasse: 'sleutelVereist' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: {
      gemeten: 'test/meet-credential.test.js roteert, probeert dezelfde idem-sleutel opnieuw, ' +
        'verwacht 409 zonder kale code en bewijst dat de oude code server-side wordt geweigerd',
      op: '2026-09-05'
    },
    nagekeken: 'Codex, 2026-09-05: meetCode in server/kern/meet.js bindt actor, kamer-id en ' +
      'idem-hash in dezelfde bewerkCollectie-transactie. Zonder sleutel vangt dezelfde kern een ' +
      'dubbeltik vijf seconden af. De generieke caches slaan het antwoord bewust niet op.',
    afgetekend: {
      door: 'Codex, op grond van gelezen kern plus gerichte lifecycle- en racetoets',
      op: '2026-09-05'
    }
  }
};

const AUTH = { klasse: 'AUTHENTICATED' };
const PUBLIEK_REIS = { klasse: 'PUBLIC', waarom: 'de ontvanger heeft vóór het inwisselen nog ' +
  'geen sessie; de 128-bit reiscredential plus de snelheidsrem is hier de deur' };
const PUBLIEK_WERVING = { klasse: 'PUBLIC', waarom: 'een nieuwe medewerker kan nog geen ' +
  'personeelssessie hebben; accountbewijs en de 128-bit uitnodiging worden in de handler gecontroleerd' };
const AFGETEKEND = {
  door: 'Codex, op grond van gelezen credentialkern plus gerichte lifecycle- en racetoets',
  op: '2026-09-05'
};
const gemeten = (mutatieId, klasse, toegang, testbestand, uitspraak) => ({
  mutatieId, herkomst: 'mens', semantiek: { klasse }, toegang, stand: 'PROTECTED',
  bewijs: { gemeten: testbestand + ' ' + uitspraak, op: '2026-09-05' },
  afgetekend: AFGETEKEND
});

/* De routes hieronder werden eerder alleen door een kale meting als onbekend
   beschreven. De lifecycleproeven meten nu precies hun bijzondere contract:
   uitgifte/rotatie is uitsluitend automatisch herhaalbaar met dezelfde
   domeinsleutel; claimroutes zijn ook na een halve commit hervatbaar zonder een
   tweede claim te kunnen maken. */
Object.assign(CONTRACTEN, {
  'POST /api/office/reisbureau/klaarzetten': gemeten('office.reisbureau.klaarzetten',
    'sleutelVereist', AUTH, 'test/reisuitnodiging.test.js',
    'herhaalt dezelfde uitgifte en krijgt 409 zonder de eenmalige link'),
  'POST /api/office/reisbureau/uitnodiging-roteer': gemeten('office.reisbureau.uitnodiging.roteren',
    'sleutelVereist', AUTH, 'test/reisuitnodiging.test.js',
    'herhaalt dezelfde rotatie zonder de link te heronthullen of opnieuw te vervangen'),
  'POST /api/reis/uitnodiging/nodig-uit': gemeten('reis.uitnodiging.nodig-uit',
    'sleutelVereist', AUTH, 'test/reisuitnodiging.e2e.js',
    'bewijst eenmalige uitgifte en hash-only opslag via de echte route'),
  'POST /api/reis/uitnodiging/roteer': gemeten('reis.uitnodiging.roteren',
    'sleutelVereist', AUTH, 'test/reisuitnodiging.test.js',
    'dezelfde domeinkern bindt actor, uitnodiging en herhaalsleutel atomair'),
  'POST /api/reis/uitnodiging/eisop': gemeten('reis.uitnodiging.eisop',
    'idempotent', AUTH, 'test/reisuitnodiging.test.js',
    'bewijst exclusieve claim en hervatbare overdracht op uitnodiging-id'),
  'POST /api/reis/uitnodiging/open': gemeten('reis.uitnodiging.open',
    'idempotent', PUBLIEK_REIS, 'test/reisuitnodiging.test.js',
    'leest alleen het beperkte publieke beeld en consumeert de credential niet'),
  'POST /api/festival/groep': gemeten('festival.groep',
    'sleutelVereist', AUTH, 'test/festival-groep.test.js',
    'herhaalt creatie zonder tweede groep of kale code'),
  'POST /api/festival/groep/code': gemeten('festival.groep.code',
    'sleutelVereist', AUTH, 'test/festival-groep.test.js',
    'roteert atomair en herhaalt de eenmalige code niet'),
  'POST /api/festival/groep/mee': gemeten('festival.groep.mee',
    'idempotent', AUTH, 'test/festival-groep.test.js',
    'boekt bij gelijktijdige laatste claims hoogstens één lid en één gebruik'),
  'POST /api/meet/kom': gemeten('meet.kom',
    'idempotent', AUTH, 'test/meet-credential.test.js',
    'claimt capaciteit en gebruik atomair en voegt hetzelfde lid nooit dubbel toe'),
  'POST /api/samen/mee': gemeten('samen.mee',
    'idempotent', AUTH, 'test/samen-credential.test.js',
    'claimt capaciteit en gebruik atomair en voegt hetzelfde lid nooit dubbel toe'),
  'POST /api/supplier/staff/invite': gemeten('supplier.staff.invite',
    'sleutelVereist', AUTH, 'test/wervingcode-lifecycle.test.js',
    'bindt actor, inhoud en herhaalsleutel atomair en heronthult geen code'),
  'POST /api/supplier/staff/invite/roteer': gemeten('supplier.staff.invite.roteren',
    'sleutelVereist', AUTH, 'test/wervingcode-lifecycle.test.js',
    'herhaalt dezelfde rotatie zonder de personeelscode opnieuw te tonen'),
  'POST /api/supplier/staff/join': gemeten('supplier.staff.join',
    'idempotent', PUBLIEK_WERVING, 'test/wervingcode-lifecycle.test.js',
    'bewijst exclusieve claim en één actieve supplier/member-koppeling'),
  'POST /api/werving/verbind': gemeten('werving.verbind',
    'idempotent', AUTH, 'test/wervingcode-lifecycle.test.js',
    'hervat alleen voor hetzelfde account en laat nooit een tweede claim winnen'),
  'POST /api/werving/kijk': gemeten('werving.kijk',
    'idempotent', PUBLIEK_WERVING, 'test/werving-link.test.js',
    'leest uitsluitend bedrijf, functie en naam en consumeert de uitnodiging niet')
});

module.exports = { CONTRACTEN };
