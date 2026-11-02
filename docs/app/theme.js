import {t} from './i18n.js?v=langs11';
const symbols = {
  light:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
  dark:'<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/>',
  system:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>'
};
const glyph=mode=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${symbols[mode]}</svg>`;
export function initTheme() {
  const root=document.documentElement, media=matchMedia('(prefers-color-scheme: dark)');
  let choice=root.dataset.themeChoice || 'dark';
  const pickers=[];
  function refresh() {
    const resolved=choice==='system'?(media.matches?'dark':'light'):choice;
    root.dataset.theme=resolved;root.dataset.themeChoice=choice;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',resolved==='dark'?'#172019':'#faf6f0');
    for(const picker of pickers){
      const summary=picker.querySelector('summary');summary.innerHTML=glyph(choice);
      summary.setAttribute('aria-label',`${t('theme')}: ${t('theme'+choice)}`);summary.title=summary.getAttribute('aria-label');
      for(const button of picker.querySelectorAll('button')){
        const mode=button.dataset.themeChoice;button.innerHTML=glyph(mode)+`<span>${t('theme'+mode)}</span>`;
        button.setAttribute('aria-pressed',String(choice===mode));
      }
    }
  }
  for(const host of document.querySelectorAll('[data-theme-picker]')){
    const picker=document.createElement('details');picker.className='theme-picker';picker.dataset.noI18n='';
    const summary=document.createElement('summary'),menu=document.createElement('div');menu.className='theme-menu';
    summary.setAttribute('role','button');summary.setAttribute('aria-expanded','false');
    for(const mode of ['light','dark','system']){
      const button=document.createElement('button');button.type='button';button.dataset.themeChoice=mode;
      button.onclick=()=>{choice=mode;try{localStorage.setItem('explorer-theme',choice);}catch{}refresh();picker.open=false;summary.focus();};menu.append(button);
    }
    picker.append(summary,menu);host.append(picker);pickers.push(picker);
    picker.addEventListener('keydown',e=>{if(e.key==='Escape'){picker.open=false;summary.focus();}});
    picker.addEventListener('toggle',()=>{summary.setAttribute('aria-expanded',String(picker.open));if(picker.open)for(const other of pickers)if(other!==picker)other.open=false;});
  }
  document.addEventListener('click',e=>{for(const picker of pickers)if(!picker.contains(e.target))picker.open=false;});
  document.addEventListener('explorer-languagechange',refresh);
  media.addEventListener('change',()=>{if(choice==='system')refresh();});
  refresh();
}
