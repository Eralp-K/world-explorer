import {initI18n,getLocale} from './app/i18n.js?v=langs11';
import {initTheme} from './app/theme.js?v=langs11';
import {icon} from './app/ui.js?v=langs11';
import {siteRows as rows,SITE_LOCALES as locales,copyMessages} from './site-translations.js?v=langs11';
const localUrl='http://127.0.0.1:8101/?view=home';
function translatePortal(){const idx=locales.indexOf(getLocale());for(const el of document.querySelectorAll('[data-site]'))el.textContent=rows[el.dataset.site]?.[idx]||rows[el.dataset.site]?.[0]||'';document.getElementById('local-address').setAttribute('aria-label',rows.address[idx]);for(const id of ['open-address'])document.getElementById(id).setAttribute('aria-label',rows.open[idx]);document.querySelector('.portal-empty .arrow').setAttribute('aria-label',rows.open[idx]);}
for(const el of document.querySelectorAll('[data-icon]'))el.innerHTML=icon(el.dataset.icon);
initI18n();initTheme();translatePortal();document.addEventListener('explorer-languagechange',translatePortal);
for(const id of ['open-local','open-address'])document.getElementById(id).onclick=()=>location.assign(localUrl);
document.getElementById('download-source').onclick=()=>location.assign('https://github.com/Eralp-K/world-explorer/archive/refs/heads/main.zip');
const help=document.getElementById('help-dialog');document.querySelectorAll('[data-help]').forEach(b=>b.onclick=()=>help.showModal());document.getElementById('close-help').onclick=()=>help.close();help.addEventListener('click',e=>{if(e.target===help){const r=help.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)help.close();}});
document.getElementById('copy-command').onclick=async()=>{const status=document.getElementById('copy-status');try{await navigator.clipboard.writeText(document.getElementById('setup-command').textContent);status.textContent=copyMessages[locales.indexOf(getLocale())];document.getElementById('copy-command').textContent=status.textContent;}catch{const selection=getSelection(),range=document.createRange();range.selectNodeContents(document.getElementById('setup-command'));selection.removeAllRanges();selection.addRange(range);status.textContent='Ctrl+C';}};
