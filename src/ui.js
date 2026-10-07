import { addJournal, gainRewards, saveState } from './state.js';
import { CAT_COATS, CAT_PERSONALITIES } from './cats.js';

export function initUI(state, game){
  let multiplayer=null;
  const $=id=>document.getElementById(id);
  const toast=$('toast');
  let toastTimer;
  const notify=(msg)=>{ toast.textContent=msg; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.remove('show'),2600); };
  const refresh=()=>{
    const guildTitle=$('guildTitle');
    if(guildTitle) guildTitle.textContent=state.guild.name||'星光旅團';
    const playerName=$('playerName');
    if(playerName) playerName.textContent=state.player.name||'我';
    $('guildLevel').textContent=state.guild.level; $('gold').textContent=state.guild.gold; $('xp').textContent=state.guild.xp; $('food').textContent=state.food;
    const xpNeed=Math.max(1,(Number(state.guild.level)||1)*150);
    const xpPct=Math.max(0,Math.min(100,(Number(state.guild.xp)||0)/xpNeed*100));
    const xpFill=$('xpFill'); if(xpFill) xpFill.style.width=`${xpPct}%`;
    const active=(state.tasks||[]).filter(t=>t.status==='accepted');
    const open=(state.tasks||[]).filter(t=>t.status==='open');
    const questList=$('hudQuestList'); const questCount=$('questCount');
    if(questList){
      questList.innerHTML='';
      const visible=[...(state.tasks||[])].filter(t=>t.status!=='completed').slice(0,3);
      if(questCount) questCount.textContent=`${visible.length}/3`;
      if(!visible.length){
        const row=document.createElement('div'); row.className='hud-quest-row';
        row.innerHTML=`<div class="hud-quest-check done">✓</div><div class="hud-quest-main"><div class="hud-quest-title">自由探索</div><div class="hud-quest-meta">找找飛飛與呼呼，看看今天會發生什麼</div></div><span class="hud-quest-tag blue">探索</span>`;
        questList.appendChild(row);
      } else {
        visible.forEach((t,i)=>{
          const row=document.createElement('div'); row.className='hud-quest-row';
          const accepted=t.status==='accepted'; const tag=accepted?'進行中':(t.target==='雙人'?'雙人':i===1?'生活':'新委託'); const tagClass=accepted?'':(tag==='雙人'?'blue':'coral');
          row.innerHTML=`<div class="hud-quest-check ${accepted?'done':''}">${accepted?'✓':''}</div><div class="hud-quest-main"><div class="hud-quest-title">${escapeHtml(t.title||'未命名委託')}</div><div class="hud-quest-meta">${escapeHtml(t.desc||'完成後回到委託板回報')}</div></div><span class="hud-quest-tag ${tagClass}">${tag}</span>`;
          questList.appendChild(row);
        });
      }
    }
    const badge=$('taskBadge'); if(badge) badge.textContent=String(active.length+open.length); const remoteCount=Object.values(state.remotePlayers||{}).filter(p=>p?.remote).length; const onlineText=$('onlineCount'); if(onlineText) onlineText.textContent=String(remoteCount+1);
    const avatars=$('onlineAvatars'); if(avatars){ avatars.innerHTML=''; const people=[state.player,...Object.values(state.remotePlayers||{}).filter(p=>p?.remote)].slice(0,2); people.forEach(person=>{ const a=document.createElement('span'); a.className='status-avatar'; a.textContent=(person?.name||'我').slice(0,1); avatars.appendChild(a); }); }
    const mini=document.getElementById('miniMap'); if(mini) drawMiniMap(mini);
    renderTasks(); renderPets(); renderShop(); renderJournal();
  };

  let taskContext='menu';
  const navs=[...document.querySelectorAll('.nav-btn')];
  const panels={tasks:$('panel-tasks'),pets:$('panel-pets'),shop:$('panel-shop'),journal:$('panel-journal'),map:$('panel-map')};
  function closePanels(){ Object.values(panels).forEach(p=>{p.classList.remove('open','workspace-open');}); document.getElementById('app')?.classList.remove('feature-mode'); document.body.classList.remove('workspace-mode'); navs.forEach(b=>b.classList.toggle('active',b.dataset.nav==='world')); }
  function openPanel(name, context='menu'){ closePanels(); if(name==='tasks') taskContext=context; const panel=panels[name]; if(!panel) return; panel.classList.add('open','workspace-open'); document.getElementById('app')?.classList.add('feature-mode'); document.body.classList.add('workspace-mode'); navs.forEach(b=>b.classList.toggle('active',b.dataset.nav===name)); if(name==='tasks') renderTasks(); if(name==='map') renderWorldMap(); }
  document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',()=>{ closePanels(); }));
  navs.forEach(btn=>btn.addEventListener('click',()=>{
    const name=btn.dataset.nav;
    if(name==='world'){ closePanels(); return; }
    if(panels[name]) openPanel(name);
  }));
  $('topJournal')?.addEventListener('click',()=>openPanel('journal'));
  $('topTasks')?.addEventListener('click',()=>openPanel('tasks'));
  $('topMenu')?.addEventListener('click',()=>notify('☰ 更多功能將陸續加入。'));
  $('miniMapWrap')?.addEventListener('click',()=>openPanel('map'));
  $('rpgInteract')?.addEventListener('click',()=>game.interactNearest());
  $('rpgPet')?.addEventListener('click',()=>game.interactNearestCat('pet'));
  $('rpgFeed')?.addEventListener('click',()=>game.interactNearestCat('feed'));
  $('rpgPlay')?.addEventListener('click',()=>game.interactNearestCat('play'));
  function renderWorldMap(){
    const canvas=$('worldMap'); if(!canvas) return; const c=canvas.getContext('2d'); const w=canvas.width,h=canvas.height;
    c.clearRect(0,0,w,h); c.fillStyle='#a9c49f'; c.fillRect(0,0,w,h);
    const sx=w/3600, sy=h/2400;
    c.fillStyle='#7fb6bb'; c.fillRect(0,300*sy,760*sx,(2400-560)*sy);
    const road=(x,y,rw,rh)=>{c.fillStyle='#d9c7a4';c.fillRect(x*sx,y*sy,rw*sx,rh*sy);};
    road(1340,0,170,2400); road(0,1110,3600,150); road(540,620,1100,112); road(980,0,112,860); road(1840,520,112,820);
    c.fillStyle='#d9c9aa'; c.beginPath(); c.ellipse(1800*sx,1200*sy,450*sx,250*sy,0,0,Math.PI*2); c.fill();
    const marker=(x,y,color,label)=>{c.fillStyle=color;c.beginPath();c.arc(x*sx,y*sy,10,0,Math.PI*2);c.fill();c.strokeStyle='rgba(255,255,255,.9)';c.lineWidth=3;c.stroke();c.fillStyle='#26332e';c.font='700 18px system-ui';c.textAlign='left';c.fillText(label,x*sx+14,y*sy+6);};
    marker(1440,1000,'#d59a58','🏰'); marker(1735,1000,'#3d6d58','📜'); marker(1930,980,'#b87955','🏪'); marker(1770,1200,'#4f8fcb','●');
    marker(state.player.x,state.player.y,'#e85f54','你');
    for(const rp of Object.values(state.remotePlayers||{})){if(rp?.remote) marker(rp.x,rp.y,'#5f9ed1','隊友');}
    for(const cat of Object.values(state.cats||{})) marker(cat.x,cat.y,'#f1c86d',cat.id==='fly'?'飛':'呼');
    c.fillStyle='rgba(31,47,40,.78)';c.fillRect(12,12,160,32);c.fillStyle='#fff9ea';c.font='800 15px system-ui';c.fillText('Couple Guild · 世界地圖',24,34);
  }
  function drawMiniMap(canvas){
    const c=canvas.getContext('2d'), w=canvas.width, h=canvas.height, sx=w/3600, sy=h/2400;
    c.clearRect(0,0,w,h); c.fillStyle='#a9c49f'; c.fillRect(0,0,w,h);
    c.fillStyle='#7fb6bb'; c.fillRect(0,300*sy,760*sx,(2400-560)*sy);
    const road=(x,y,rw,rh)=>{c.fillStyle='#d9c7a4';c.fillRect(x*sx,y*sy,rw*sx,rh*sy);};
    road(1340,0,170,2400); road(0,1110,3600,150); road(540,620,1100,112); road(980,0,112,860); road(1840,520,112,820);
    c.fillStyle='#d9c9aa'; c.beginPath(); c.ellipse(1800*sx,1200*sy,450*sx,250*sy,0,0,Math.PI*2); c.fill();
    const dot=(x,y,color,r=4)=>{c.fillStyle=color;c.beginPath();c.arc(x*sx,y*sy,r,0,Math.PI*2);c.fill();};
    dot(1440,1000,'#d59a58',5); dot(1735,1000,'#3d6d58',5); dot(1930,980,'#b87955',5);
    dot(state.player.x,state.player.y,'#e85f54',7);
    for(const rp of Object.values(state.remotePlayers||{})){if(rp?.remote) dot(rp.x,rp.y,'#5f9ed1',6);}
    for(const cat of Object.values(state.cats||{})) dot(cat.x,cat.y,'#f1c86d',4);
    c.strokeStyle='rgba(255,255,255,.85)'; c.lineWidth=2; c.strokeRect(Math.max(0,state.player.x*sx-22),Math.max(0,state.player.y*sy-18),44,36);
  }

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
        accept.disabled=false;
        accept.title=boardMode?'':'請走到世界裡的委託板接受任務';
        accept.onclick=async()=>{ if(!boardMode){notify('📍 請先走到中央廣場的委託板。');return;}
          const acceptedAt=Date.now();
          try{
            const userId=multiplayer?.mp?.user?.id||null;
            if(multiplayer?.mp?.connected && multiplayer.mp.guildId && userId){
              const patch={
                status:'accepted',
                assignee_id:userId,
                metadata:{...(t.remoteRow?.metadata||{}),difficulty:t.difficulty,localTarget:t.target,acceptedAt,acceptedBy:userId}
              };
              const row=await multiplayer.mp.updateTask(t.id,patch);
              if(!row) throw new Error('任務沒有成功寫入共享資料');
              t.remoteRow=row;
              t.assigneeId=row.assignee_id||userId;
              // 通知原發布者，讓另一台手機立即知道有人接下任務。
              if(row.creator_id && row.creator_id!==userId){
                await multiplayer.mp.sendNotification(row.creator_id,'📜 任務已被接受',`${state.player.name||'另一半'} 接下了「${t.title}」。`,'task');
              }
            }
            t.status='accepted'; t.acceptedAt=acceptedAt; t.acceptedBy=userId;
            t.assigneeId=userId;
            addJournal(state,'📜',`接受委託：${t.title}`,'在委託板接下這項生活冒險。'); saveState(state); refresh(); notify('任務已接下！完成後回到委託板回報。');
          }catch(e){notify('⚠️ 任務同步失敗：'+(e?.message||e));}
        };
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
    const completedAt=Date.now();
    (async()=>{
      try{
        if(multiplayer?.mp?.connected && multiplayer.mp.guildId){
          const row=await multiplayer.mp.updateTask(t.id,{status:'completed',completed_at:new Date(completedAt).toISOString(),assignee_id:t.assigneeId||multiplayer.mp.user.id,metadata:{...(t.remoteRow?.metadata||{}),difficulty:t.difficulty,localTarget:t.target,acceptedAt:t.acceptedAt||null,acceptedBy:t.acceptedBy||null,completedBy:multiplayer.mp.user.id}});
          if(!row) throw new Error('任務完成狀態沒有成功同步');
          t.remoteRow=row;
          // 通知原發布者：任務已完成，另一台裝置的通知中心會即時收到。
          const userId=multiplayer.mp.user.id;
          if(row.creator_id && row.creator_id!==userId){
            await multiplayer.mp.sendNotification(row.creator_id,'🎉 任務已完成',`${state.player.name||'另一半'} 已完成「${t.title}」，可以回來查看獎勵。`,'task');
          }
        }
        t.status='completed'; t.completedAt=completedAt; t.completedBy=multiplayer?.mp?.user?.id||null;
        gainRewards(state,t.gold,t.xp); addJournal(state,'🎉',`委託完成：${t.title}`,`獲得 🪙 ${t.gold} 與 ⭐ ${t.xp} XP。`); saveState(state); refresh(); game.addFloater(state.player.x, state.player.y-65, `+${t.gold} Gold`); game.addFloater(state.player.x, state.player.y-92, `+${t.xp} XP`); notify(`🎉 任務完成！ +${t.gold} Gold / +${t.xp} XP`);
      }catch(e){notify('⚠️ 任務回報同步失敗：'+(e?.message||e));}
    })();
  }

  $('newTaskBtn').addEventListener('click',()=>{
    $('taskModal').classList.add('show');
    document.body.classList.add('workspace-modal-open');
    $('taskTitle').focus();
  });
  const closeTaskComposer=()=>{ $('taskModal').classList.remove('show'); document.body.classList.remove('workspace-modal-open'); };
  $('cancelTask').addEventListener('click',closeTaskComposer);
  $('taskModal').addEventListener('click',e=>{if(e.target.id==='taskModal') closeTaskComposer();});
  $('taskForm').addEventListener('submit',e=>{
    e.preventDefault();
    const target=$('taskTarget').value==='self'?'我':'另一半';
    const draft={title:$('taskTitle').value.trim(),desc:$('taskDesc').value.trim(),target,difficulty:Number($('taskDifficulty').value),gold:Number($('taskGold').value)||0,xp:Number($('taskXp').value)||0};
    (async()=>{
      try{
        if(multiplayer?.mp?.connected && multiplayer.mp.guildId){
          const row=await multiplayer.mp.createTask(draft);
          if(row){
            draft.id=row.id; draft.creatorId=row.creator_id; draft.remote=true;
            state.tasks.unshift({...draft,status:row.status||'open'});
          }
        }else{
          state.tasks.unshift({id:'t'+Date.now(),...draft,status:'open'});
        }
        addJournal(state,'📝','發布了一份新委託',`「${draft.title}」已放上公會委託板。`); saveState(state); closeTaskComposer(); e.target.reset(); refresh(); notify('📜 委託已發布！');
      }catch(err){notify('⚠️ 委託發布同步失敗：'+(err?.message||err));}
    })();
  });

  function renderPets(){
    const grid=$('petGrid'); grid.innerHTML='';
    for(const cat of Object.values(state.cats)){
      const hunger=cat.hunger<35?'不太餓':cat.hunger<70?'有點想吃':'很餓了'; const energy=cat.energy<30?'很累':cat.energy<60?'普通':'精神很好';
      const el=document.createElement('div'); el.className='pet-card';
      el.innerHTML=`<div class="pet-avatar" data-coat="${cat.coat}"><img src="/assets/${cat.id}.png" alt="${escapeHtml(cat.name)}" /></div><div class="pet-name">${cat.name}</div><div class="pet-tags"><span class="pill">${CAT_COATS[cat.coat]?.label||'三花'}</span><span class="pill green">${CAT_PERSONALITIES[cat.personality]?.label||'黏人'}</span></div><div class="pet-mood">${cat.mood} · ${hunger} · ${energy}</div><div class="pet-buttons"><button class="secondary" data-a="pet">❤️</button><button class="secondary" data-a="feed">🍖</button><button class="primary" data-a="play">🎾</button><button class="secondary" data-a="settings">⚙️</button></div>`;
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
  return { notify, refresh, openPanel, setMultiplayer:mp=>{multiplayer=mp;} };
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
