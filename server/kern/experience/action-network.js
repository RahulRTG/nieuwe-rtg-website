'use strict';
module.exports = function actionNetwork({ kern, network }) {
  function prepare({ parameters }) {
    const checked = network.selection(parameters);
    if (checked.error) return checked;
    if (!kern.mall || !kern.mall.mallLijsten || !kern.mall.mallLijsten.samenstellen)
      return { status: 503, error: 'Bewaren is tijdelijk niet beschikbaar.' };
    return { parameters: { title: checked.title, choices: checked.choices },
      policy: { decision: 'ALLOW_WITH_CONFIRMATION', policyId: 'policy:own-network-list', version: 'v1',
        reasonCodes: ['OWN_LIST', 'CURRENT_VISIBLE_OFFERS', 'NO_COMMITMENT'] },
      confirmation: { required: true, text: 'Bewaar ' + checked.choices.length + ' onderdelen in “' + checked.title +
        '”. Dit is een persoonlijke lijst; beschikbaarheid, data en betaling bevestigt u bij de aanbieder.' },
      consequence: { changesDomainTruth: true, changesExperienceState: false,
        createsFinancialCommitment: false, reversible: true, notificationSent: false } };
  }
  function execute({ key, preview }) {
    // Binnen de brokertransactie: ingetrokken zichtbaarheid of gewijzigd aanbod
    // mag nooit via een oude preview alsnog in een nieuwe lijst belanden.
    const checked = network.selection(preview.parameters);
    if (checked.error) return checked;
    const out = kern.mall.mallLijsten.samenstellen(key, { naam: checked.title,
      ids: checked.choices.map(c => c.id) });
    if (out.error) return out;
    return { objectRef: { domain: 'mall', type: 'lijst', id: out.lijst.id },
      result: { list: { id: out.lijst.id, title: out.lijst.naam, count: out.lijst.regels.length },
        destination: '/apps/mijnmall.html', bookingStatus: 'NOT_BOOKED' } };
  }
  return { prepare, execute };
};
