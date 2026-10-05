const KEY = 'couple-guild-v0.2.7-state';
const LEGACY_KEYS = ['couple-guild-v0.2.5-state', 'couple-guild-v0.2.4-state', 'couple-guild-v0.2.3-state', 'couple-guild-v0.2.2-state', 'couple-guild-v0.2.1-state', 'couple-guild-v0.1-state'];

const defaultState = {
  guild: { name: '星光旅團', level: 3, xp: 180, gold: 520 },
  player: { name: '我', x: 1770, y: 1280, skin: '#d8a06b', shirt: '#567a67' },
  partner: { name: '另一半', x: 1900, y: 1320, skin: '#c58f63', shirt: '#9c6b58' },
  cats: {
    fly: { id:'fly', name:'飛飛', coat:'custom', personality:'affectionate', x:1830, y:1370, energy:72, hunger:40, mood:'想找人撒嬌', target:null, state:'wander' },
    hu:  { id:'hu', name:'呼呼', coat:'custom', personality:'mischievous', x:1970, y:1270, energy:82, hunger:56, mood:'到處亂晃', target:null, state:'wander' }
  },
  food: 5,
  tasks: [
    { id:'t1', title:'洗碗', desc:'把晚餐後的碗盤處理一下。', target:'我', difficulty:1, gold:80, xp:30, status:'open' },
    { id:'t2', title:'買一杯飲料', desc:'回家路上幫另一半帶喜歡的飲料。', target:'我', difficulty:2, gold:140, xp:50, status:'open' },
    { id:'t3', title:'陪飛飛玩 10 分鐘', desc:'今天留一點時間陪貓玩。', target:'另一半', difficulty:1, gold:60, xp:25, status:'open' },
    { id:'t4', title:'一起散步 30 分鐘', desc:'兩個人一起出門走走。', target:'我們', difficulty:3, gold:220, xp:80, status:'open' }
  ],
  journal: [
    { time:'今天', emoji:'🏰', title:'星光旅團建立', text:'你們的雙人公會開始營運。' },
    { time:'剛剛', emoji:'🐈', title:'飛飛回來了', text:'飛飛在中央廣場找到你。' }
  ],
  petEvents: [
    '飛飛跑去中央廣場晃了一圈。',
    '呼呼正在觀察兩個人誰比較好欺負。'
  ],
  selectedPet: null,
  worldVersion: 4,
};

export function loadState() {
  try {
    const current = localStorage.getItem(KEY);
    const legacyKey = LEGACY_KEYS.find(k => localStorage.getItem(k));
    const raw = current || (legacyKey ? localStorage.getItem(legacyKey) : null);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    const parsedWorldVersion = Number(parsed?.worldVersion || 0);
    const state = merge(defaultState, parsed);
    // V0.2.4 introduces the photo-based cat sprites. Legacy saves get the
    // new reference appearance once; later user-selected coat settings persist.
    if (!current) {
      if (state.cats?.fly) state.cats.fly.coat = 'custom';
      if (state.cats?.hu) state.cats.hu.coat = 'custom';
    }
    // V0.2.6 moves the playable plaza into the center of a larger world so
    // the camera can show a local 16:9 viewport instead of fitting the whole map.
    if (parsedWorldVersion < 2) {
      const dx = 1140, dy = 770;
      for (const actor of [state.player, state.partner, ...(Object.values(state.cats || {}))]) {
        if (!actor) continue;
        actor.x += dx; actor.y += dy;
      }
      state.worldVersion = 2;
    }
    if (state.worldVersion < 4) {
      // V0.2.7 hotfix: the original spawn (1770, 1200) overlaps the plaza
      // collision strip, trapping the player inside an obstacle. Reset only
      // the player/partner spawn when upgrading an older save.
      state.worldVersion = 4;
      state.player.x = 1770;
      state.player.y = 1280;
      state.partner.x = 1900;
      state.partner.y = 1320;
      if (state.cats?.fly) { state.cats.fly.x = 1830; state.cats.fly.y = 1370; }
      if (state.cats?.hu) { state.cats.hu.x = 1970; state.cats.hu.y = 1270; }
    }
    if (state.worldVersion < 3) {
      state.worldVersion = 3;
      state.player.x = clampNum(state.player.x, 90, 3510);
      state.player.y = clampNum(state.player.y, 150, 2250);
    }
    return state;
  } catch { return structuredClone(defaultState); }
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function clampNum(v,min,max){ const n=Number(v); return Number.isFinite(n) ? Math.max(min,Math.min(max,n)) : min; }

function merge(base, override) {
  if (Array.isArray(base)) return Array.isArray(override) ? override : base;
  if (base && typeof base === 'object') {
    const out = {};
    for (const k of Object.keys(base)) out[k] = merge(base[k], override?.[k]);
    if (override) for (const k of Object.keys(override)) if (!(k in out)) out[k] = override[k];
    return out;
  }
  return override ?? base;
}

export function gainRewards(state, gold, xp) {
  state.guild.gold += Number(gold) || 0;
  state.guild.xp += Number(xp) || 0;
  while (state.guild.xp >= state.guild.level * 150) {
    state.guild.xp -= state.guild.level * 150;
    state.guild.level += 1;
  }
}

export function addJournal(state, emoji, title, text) {
  state.journal.unshift({ time:new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'}), emoji, title, text });
  state.journal = state.journal.slice(0, 30);
}

export function addPetEvent(state, message) {
  state.petEvents.unshift(message);
  state.petEvents = state.petEvents.slice(0, 12);
}
