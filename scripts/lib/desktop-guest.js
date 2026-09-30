/* Gastlinks hebben een leesvenster zonder OS-frame. De algemene schermronde
   meet de onvolledige link; reisprogramma.e2e.js bewijst publiceren en lezen. */
'use strict';
module.exports = async function guest(page, row, errors) {
  await page.waitForFunction(() => document.querySelector('#vak')?.textContent.includes('Deze link is niet compleet.'));
  await page.evaluate(() => document.fonts.ready);
  row.state = await page.evaluate(() => {
    const main = document.querySelector('main'), rect = main?.getBoundingClientRect();
    return {public:document.body.dataset.publicPlatform, world:document.body.dataset.rtgWorld,
      message:document.querySelector('#vak')?.textContent.trim(), background:getComputedStyle(document.body).backgroundColor,
      shells:document.querySelectorAll('.wd-shell').length, edges:document.querySelectorAll('.rtg-adaptive-bar').length,
      overflow:document.documentElement.scrollWidth>innerWidth+1,
      content:rect&&{x:rect.x,right:rect.right,width:rect.width,height:rect.height}};
  });
  const s=row.state;row.failures=[];
  if(row.http!==200)row.failures.push('http-'+row.http);
  if(s.public!=='travel-guest'||s.world!=='travel')row.failures.push('missing-guest-identity');
  if(s.background!=='rgb(18, 18, 16)')row.failures.push('nonstandard-guest-palette');
  if(s.shells||s.edges)row.failures.push('unexpected-member-navigation');
  if(s.overflow)row.failures.push('horizontal-overflow');
  if(!s.content||s.content.width<250||s.content.height<60||s.content.x<0)row.failures.push('missing-guest-content');
  if(errors.length)row.failures.push('guest-page-error');
};
