let nextId=0;
const globe='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg>';
const chevron='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>';
export function mountLanguagePicker(select,onChange) {
  const root=document.createElement('span');root.className='language-control';root.setAttribute('data-no-i18n','');
  const trigger=document.createElement('button');trigger.type='button';trigger.className='language-trigger';trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
  trigger.innerHTML=globe+'<span class="language-current"></span>'+chevron;
  const list=document.createElement('span');list.className='language-menu';list.id='language-menu-'+(++nextId);list.setAttribute('role','listbox');list.hidden=true;trigger.setAttribute('aria-controls',list.id);
  const options=[...select.options].map(option=>{
    const button=document.createElement('button');button.type='button';button.className='language-option';button.setAttribute('role','option');button.tabIndex=-1;button.dataset.value=option.value;button.lang=option.lang;
    const name=document.createElement('span');name.textContent=option.textContent;
    const code=document.createElement('small');code.textContent=option.value==='zh-CN'?'ZH':option.value.toUpperCase();code.setAttribute('aria-hidden','true');
    const check=document.createElement('span');check.className='language-check';check.textContent='✓';check.setAttribute('aria-hidden','true');
    button.append(name,code,check);
    button.onclick=()=>{select.value=option.value;onChange(option.value);close(true);};list.append(button);return button;
  });
  function close(focus=false){list.hidden=true;trigger.setAttribute('aria-expanded','false');if(focus)trigger.focus();}
  function open(focus=false){list.hidden=false;trigger.setAttribute('aria-expanded','true');if(focus)(options.find(o=>o.dataset.value===select.value)||options[0]).focus();}
  trigger.onclick=()=>list.hidden?open():close();
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!list.hidden){event.preventDefault();event.stopPropagation();close(true);return;}
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    event.preventDefault();
    if(list.hidden){open(true);return;}
    const index=options.indexOf(document.activeElement), step=event.key==='ArrowUp'?-1:1;
    const target=event.key==='Home'?0:event.key==='End'?options.length-1:index<0?0:(index+step+options.length)%options.length;
    options[target].focus();
  });
  document.addEventListener('pointerdown',event=>{if(!root.contains(event.target))close();});
  document.addEventListener('focusin',event=>{if(!root.contains(event.target))close();});
  root.append(trigger,list);select.before(root);select.hidden=true;select.tabIndex=-1;select.setAttribute('aria-hidden','true');
  return {sync(value,label){
    select.value=value;const selected=options.find(o=>o.dataset.value===value);
    trigger.querySelector('.language-current').textContent=selected?.firstElementChild.textContent||value;
    trigger.setAttribute('aria-label',label+': '+trigger.querySelector('.language-current').textContent);
    list.setAttribute('aria-label',label);
    options.forEach(option=>option.setAttribute('aria-selected',String(option.dataset.value===value)));
  }};
}
