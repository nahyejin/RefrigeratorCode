(() => {
  const d = (n) => { const t = new Date(); t.setDate(t.getDate()+n); const p=(x)=>String(x).padStart(2,'0'); return `${t.getFullYear()}.${p(t.getMonth()+1)}.${p(t.getDate())}`; };
  let i = 0; const mk = (name, extra={}) => ({ id: `seed-${Date.now()}-${i++}`, name, ...extra });
  const data = {
    frozen: [mk('돼지고기'), mk('닭고기'), mk('만두')],
    fridge: [
      mk('두부', {purchase:d(-5), expiry:d(1)}),
      mk('우유', {purchase:d(-6), expiry:d(2)}),
      mk('달걀', {purchase:d(-12), expiry:d(3)}),
      mk('대파'), mk('양파'), mk('피자치즈'), mk('김치'), mk('버터'),
      mk('애호박'), mk('마늘'), mk('고추장'), mk('된장'),
    ],
    room: [mk('소금'), mk('설탕'), mk('간장'), mk('식용유'), mk('밀가루'), mk('참기름'), mk('후추'), mk('고구마'), mk('감자')],
  };
  localStorage.setItem('myfridge_ingredients', JSON.stringify(data));
  localStorage.setItem('usage_guide_never_show', 'true');
  localStorage.setItem('last_visit_at', new Date().toISOString());
  localStorage.setItem('expiry_push_prompt_seen', 'true');
  localStorage.setItem('home_install_prompt_never_show', 'true');
  localStorage.setItem('welcome_modal_shown', 'true');
  return Object.keys(localStorage).length;
})()
