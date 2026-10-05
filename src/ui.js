import { addJournal, gainRewards, saveState } from './state.js';
import { CAT_COATS, CAT_PERSONALITIES } from './cats.js';

export function initUI(state, game){
  const $=id=>document.getElementById(id);
  const toast=$('toast');
  let toastTimer;
  const notify=(msg)=>{ toast.textContent=msg; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.remove('show'),2600); };
  const refresh=()=>{
    $('guildLevel').textContent=state.guild.level; $('gold').textContent=state.guild.gold; $('xp').textContent=state.guild.xp; $('food').textContent=state.food;
    renderTasks(); renderPets(); renderShop(); renderJournal();
  };

  let taskContext='menu';
  const navs=[...document.querySelectorAll('.nav-btn')];
  const panels={tasks:$('panel-tasks'),pets:$('panel-pets'),shop:$('panel-shop'),journal:$('panel-journal')};
  function closePanels(){ Object.values(panels).forEach(p=>p.classList.remove('open')); navs.forEach(b=>b.classList.toggle('active',b.dataset.nav==='world')); }
  function openPanel(name, context='menu'){ closePanels(); if(name==='tasks') taskContext=context; panels[name].classList.add('open'); navs.forEach(b=>b.classList.toggle('active',b.dataset.nav===name)); if(name==='tasks') renderTasks(); }
  navs.forEach(btn=>btn.addEventListener('click',()=> btn.dataset.nav==='world'?closePanels():openPanel(btn.dataset.nav)));
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',closePanels));
  $('quickTask').addEventListener('click',()=>openPanel('tasks','menu')); $('quickPet').addEventListener('click',()=>openPanel('pets'));

  function renderTasks(){
    const list=$('taskList'); list.innerHTML='';
    const boardMode=taskContext==='board';
    const acceptedCount=state.tasks.filter(t=>t.status==='accepted').length;
    const header=document.createElement('div'); header.className='card'; header.style.marginBottom='10px';
    header.innerHTML=boardMode
      ? `<b>📍 委託板模式</b><div class="section-note" style="margin-top:4px">你人在中央廣場的委託板旁，可以接受新任務或回報已完成任務。</div>`
      : `<b>🧭 冒險總覽</b><div class="section-note" style="margin-top:4px">真正的任務流程：到世界裡的委託板接受與回報。這裡可以查看進度。</div>`;
    list.appendChild(header);
    if(!state.tasks.length){ list.innerHTML='<div class="empty">目前沒有委託，去發布第一張吧！</div>'; return; }
    for(const t of state.tasks){
      const el=document.createElement('div'); el.className='card task-card';
      const status=t.status==='completed'?'<span class="pill green">已完成</span>':t.status==='accepted'?'<span class="pill gold">進行中</span>':'<span class="pill">待接受</span>';
      el.innerHTML=`<div><div class="task-title">${escapeHtml(t.title)}</div><div style="font-size:12px;color:#77766e;margin-top:4px">${escapeHtml(t.desc||'')}</div><div class="task-meta"><span class="pill">${'⭐'.repeat(t.difficulty)}</span><span class="pill gold">🪙 ${t.gold}</span><span class="pill">⭐ ${t.xp} XP</span><span class="pill">→ ${escapeHtml(t.target)}</span>${status}</div></div><div class="task-actions"></div>`;
      const actions=el.querySelector('.task-actions');
      if(t.status==='open'){
        const accept=document.createElement('button'); accept.className='primary'; accept.textContent=t.target==='我'?'接下來做':'接受';
        accept.disabled=!boardMode;
        accept.title=boardMode?'':'請走到世界裡的委託板接受任務';
        accept.onclick=()=>{ if(!boardMode){notify('📍 請先走到中央廣場的委託板。');return;} t.status='accepted'; t.acceptedAt=Date.now(); addJournal(state,'📜',`接受委託：${t.title}`,'在委託板接下這項生活冒險。'); saveState(state); refresh(); notify('任務已接下！完成後回到委託板回報。'); };
        actions.appendChild(accept);
      } else if(t.status==='accepted'){
        const done=document.createElement('button'); done.className='primary'; done.textContent=boardMode?'回報完成':'到委託板回報'; done.disabled=!boardMode; done.title=boardMode?'':'請回到中央廣場委託板回報'; done.onclick=()=>{ if(!boardMode){notify('📍 完成任務後，回到委託板才能領取獎勵。');return;} completeTask(t.id); };
        actions.appendChild(done);
      } else { const ok=document.createElement('span'); ok.style.cssText='font-size:22px'; ok.textContent='✅'; actions.appendChild(ok); }
      list.appendChild(el);
    }
  }

  function completeTask(id){
    const t=state.tasks.find(x=>x.id===id); if(!t||t.status==='completed'||t.status!=='accepted') return;
    t.status='completed'; gainRewards(state,t.gold,t.xp); addJournal(state,'🎉',`委託完成：${t.title}`,`獲得 🪙 ${t.gold} 與 ⭐ ${t.xp} XP。`); saveState(state); refresh(); notify(`🎉 任務完成！ +${t.gold} Gold / +${t.xp} XP`);
  }

  $('newTaskBtn').addEventListener('click',()=>{$('taskModal').classList.add('show'); $('taskTitle').focus();});
  $('cancelTask').addEventListener('click',()=>$('taskModal').classList.remove('show'));
  $('taskModal').addEventListener('click',e=>{if(e.target.id==='taskModal') $('taskModal').classList.remove('show');});
  $('taskForm').addEventListener('submit',e=>{
    e.preventDefault();
    const target=$('taskTarget').value;
    state.tasks.unshift({ id:'t'+Date.now(), title:$('taskTitle').value.trim(), desc:$('taskDesc').value.trim(), target:target==='self'?'我':'另一半', difficulty:Number($('taskDifficulty').value), gold:Number($('taskGold').value)||0, xp:Number($('taskXp').value)||0, status:'open' });
    addJournal(state,'📝','發布了一份新委託',`「${$('taskTitle').value.trim()}」已放上公會委託板。`); saveState(state); $('taskModal').classList.remove('show'); e.target.reset(); refresh(); notify('📜 委託已發布！');
  });

  function renderPets(){
    const grid=$('petGrid'); grid.innerHTML='';
    for(const cat of Object.values(state.cats)){
      const hunger=cat.hunger<35?'不太餓':cat.hunger<70?'有點想吃':'很餓了';
      const el=document.createElement('div'); el.className='pet-card';
      el.innerHTML=`<div class="pet-avatar" data-coat="${cat.coat}"><img src="/assets/${cat.id}.png" alt="${escapeHtml(cat.name)}" /></div><div class="pet-name">${cat.name}</div><div class="pet-tags"><span class="pill">${CAT_COATS[cat.coat]?.label||'三花'}</span><span class="pill green">${CAT_PERSONALITIES[cat.personality]?.label||'黏人'}</span></div><div class="pet-mood">${cat.mood} · ${hunger}</div><div class="pet-buttons"><button class="secondary" data-a="pet">❤️</button><button class="secondary" data-a="feed">🍖</button><button class="primary" data-a="play">🎾</button><button class="secondary" data-a="settings">⚙️</button></div>`;
      el.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{ state.selectedPet=cat.id; if(btn.dataset.a==='settings'){ openCatSettings(cat.id); return; } game.interactPet(cat.id,btn.dataset.a); refresh(); });
      grid.appendChild(el);
    }
    $('eventLog').innerHTML=state.petEvents.map(x=>`<div>• ${escapeHtml(x)}</div>`).join('');
  }


  function openCatSettings(id){
    const cat=state.cats[id]; if(!cat) return;
    $('catSettingId').value=id;
    $('catSettingName').textContent=`🐈 ${cat.name}`;
    $('catCoat').value=cat.coat || 'calico';
    $('catPersonality').value=cat.personality || 'affectionate';
    const p=CAT_PERSONALITIES[$('catPersonality').value];
    $('catSettingHint').textContent=`${p.label}：靠近 ${Math.round(p.approach*100)}% · 亂晃 ${Math.round(p.wander*100)}% · 討食傾向 ${Math.round(p.hunger*100)}% · 咬人 ${Math.round(p.bite*100)}%`;
    $('catSettingsModal').classList.add('show');
  }

  $('catPersonality').addEventListener('change',()=>{
    const p=CAT_PERSONALITIES[$('catPersonality').value];
    if(p) $('catSettingHint').textContent=`${p.label}：靠近 ${Math.round(p.approach*100)}% · 亂晃 ${Math.round(p.wander*100)}% · 討食傾向 ${Math.round(p.hunger*100)}% · 咬人 ${Math.round(p.bite*100)}%`;
  });

  $('catSettingsForm').addEventListener('submit',e=>{
    e.preventDefault();
    const id=$('catSettingId').value; const cat=state.cats[id]; if(!cat) return;
    cat.coat=$('catCoat').value; cat.personality=$('catPersonality').value;
    addJournal(state,'🐈','調整貓咪設定',`${cat.name}現在是「${CAT_COATS[cat.coat].label}・${CAT_PERSONALITIES[cat.personality].label}」。`);
    saveState(state); $('catSettingsModal').classList.remove('show'); refresh(); notify(`🐈 ${cat.name}設定完成！`);
  });
  $('cancelCatSettings').onclick=()=>$('catSettingsModal').classList.remove('show');
  $('catSettingsModal').addEventListener('click',e=>{if(e.target.id==='catSettingsModal') $('catSettingsModal').classList.remove('show');});

  function renderShop(){
    const items=[
      {emoji:'🍖',name:'貓罐頭 ×1',price:30,action:()=>buyFood(1)},
      {emoji:'🎾',name:'毛線球',price:120,action:()=>spend(120,'🎾 買了一顆毛線球。')},
      {emoji:'🪴',name:'小盆栽',price:180,action:()=>spend(180,'🪴 公會之家多了一盆小植物。')},
      {emoji:'🍰',name:'下午茶券',price:300,action:()=>spend(300,'🍰 換到一張雙人下午茶券。')}
    ];
    const grid=$('shopGrid'); grid.innerHTML='';
    items.forEach(i=>{ const el=document.createElement('div'); el.className='shop-item'; el.innerHTML=`<div style="font-size:40px">${i.emoji}</div><h3>${i.name}</h3><div class="price">🪙 ${i.price}</div><button class="primary">兌換</button>`; el.querySelector('button').onclick=i.action; grid.appendChild(el); });
  }
  function buyFood(n){ if(state.guild.gold<30*n){notify('Gold 不夠啦！');return;} state.guild.gold-=30*n; state.food+=n; addJournal(state,'🍖','補充貓罐頭',`買了 ${n} 罐，現在共有 ${state.food} 份。`); saveState(state); refresh(); notify('🍖 貓罐頭補充完成！'); }
  function spend(amount,msg){ if(state.guild.gold<amount){notify('Gold 不夠啦！');return;} state.guild.gold-=amount; addJournal(state,'🛍️','商店消費',msg); saveState(state); refresh(); notify(msg); }

  function renderJournal(){
    const box=$('journalList'); box.innerHTML='';
    for(const j of state.journal){ const el=document.createElement('div'); el.className='card journal-item'; el.innerHTML=`<div class="journal-emoji">${j.emoji}</div><div><b>${escapeHtml(j.title)}</b><div style="font-size:10px;color:#888;margin-top:2px">${escapeHtml(j.time)}</div><p>${escapeHtml(j.text)}</p></div>`; box.appendChild(el); }
  }

  let selectedPet=null;
  const petModal=$('petModal');
  window.addEventListener('cg:openPet',e=>{ selectedPet=e.detail; const cat=state.cats[selectedPet]; $('petModalTitle').textContent=`🐈 ${cat.name}`; $('petModalEmoji').innerHTML=`<img src="/assets/${cat.id}.png" alt="${escapeHtml(cat.name)}" />`; $('petModalMood').textContent=cat.mood; petModal.classList.add('show'); });
  $('closePet').onclick=()=>petModal.classList.remove('show'); petModal.addEventListener('click',e=>{if(e.target===petModal) petModal.classList.remove('show');});
  petModal.querySelectorAll('[data-pet-action]').forEach(btn=>btn.onclick=()=>{ game.interactPet(selectedPet,btn.dataset.petAction); const cat=state.cats[selectedPet]; $('petModalMood').textContent=cat.mood; });

  refresh();
  return { notify, refresh, openPanel };
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
