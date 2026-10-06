export const CAT_COATS = {
  custom: { label: '照片造型', base: '#f2eee3', dark: '#66584f', patch: '#d97c63', nose: '#c98888', tail: '#66584f' },
  calico: { label: '三花', base: '#f2eee3', dark: '#66584f', patch: '#d97c63', nose: '#c98888', tail: '#66584f' },
  orange: { label: '橘白', base: '#f4ead5', dark: '#c77b3e', patch: '#e59a52', nose: '#c98888', tail: '#b86936' },
  tuxedo: { label: '黑白', base: '#f2eee3', dark: '#323534', patch: '#202221', nose: '#d19a9a', tail: '#292b2a' },
  gray: { label: '灰白', base: '#e8e6e0', dark: '#747a79', patch: '#a4a8a6', nose: '#c78f9a', tail: '#666b6a' },
  black: { label: '黑貓', base: '#4a4b49', dark: '#282a29', patch: '#5b5d5a', nose: '#b97e8c', tail: '#292b2a' },
  cream: { label: '奶油', base: '#f3e1b6', dark: '#c2a170', patch: '#ddbf8b', nose: '#c98888', tail: '#b99262' }
};

export const CAT_PERSONALITIES = {
  affectionate: { label: '黏人', affection: .88, hunger: .52, wander: .22, play: .38, idle: .16, bite: .06, approach: .65 },
  mischievous: { label: '調皮', affection: .42, hunger: .70, wander: .78, play: .82, idle: .12, bite: .18, approach: .46 },
  foodie: { label: '貪吃', affection: .48, hunger: .96, wander: .32, play: .36, idle: .14, bite: .10, approach: .72 },
  lazy: { label: '慵懶', affection: .38, hunger: .44, wander: .10, play: .18, idle: .42, bite: .05, approach: .30 }
};

export function getPersonality(cat){
  return CAT_PERSONALITIES[cat.personality] || CAT_PERSONALITIES.affectionate;
}

export function getCoat(cat){
  return CAT_COATS[cat.coat] || CAT_COATS.calico;
}
