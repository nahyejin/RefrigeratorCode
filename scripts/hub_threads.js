/* 쿡매치 만들기 → 스레드 업로드용 탭: 스레드 검토함.
   db 컬렉션 items 를 예약 작업 threads-auto(store/THREADS_AUTOMATION.md)가 채우고, 승인된 것을 올린다. */
(() => {
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const LABEL = { pending: "검토 전", approved: "올리기 대기", posted: "올림", skip: "안 달기", failed: "실패" };
const ORDER = ["pending", "failed", "approved", "posted", "skip"];
const HOW = {
  reply: `<b>답글 검토</b><ol><li>새 댓글이 오면 Claude가 답글 초안을 넣어요.</li><li>고칠 곳을 고치고 「이대로 답글 달기」, 안 달 거면 「안 달기」.</li><li>승인한 답글은 다음 정각 7분에 올라가요.</li></ol>`,
  post: `<b>새 글 검토</b><ol><li>[대괄호]를 실제 이야기로 바꾸고, 직접 찍은 사진을 한 장 올려요.</li><li>「이대로 올리기」를 누르면 아침 7~8시·점심 12~13시·밤 8시~새벽 12시 중 다음 시간에 올라가요.</li><li>올리자마자 「첫 답글」도 같이 달려요.</li></ol>`,
};
let kind = "reply", docs = [], db = null, assets = null, ready = false;
try { kind = localStorage.getItem("tr_kind") || "reply"; } catch (e) {}
const when = t => t ? new Date(t).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

function summary() {
  const n = s => docs.filter(d => d.status === s).length;
  const k = k => docs.filter(d => d.kind === k && d.status === "pending").length;
  $("#tsum").innerHTML = `<span class="pill">검토 전 <b>${n("pending")}</b></span><span class="pill">올리기 대기 <b>${n("approved")}</b></span><span class="pill">올림 <b>${n("posted")}</b></span>`
    + (n("failed") ? `<span class="pill">실패 <b>${n("failed")}</b></span>` : "");
  $('.ttab[data-k="reply"]').textContent = `답글${k("reply") ? " · " + k("reply") : ""}`;
  $('.ttab[data-k="post"]').textContent = `새 글${k("post") ? " · " + k("post") : ""}`;
  const pend = n("pending");
  $('.mtab[data-m="th"]').textContent = `스레드 업로드용${pend ? " · " + pend : ""}`;
}

function card(d) {
  const editable = d.status === "pending" || d.status === "failed";
  const text = d.text ?? d.draft ?? "";
  const head = d.kind === "reply"
    ? `<div class="tmeta"><span>${esc(d.post_first_line)}</span>${d.permalink ? `<a href="${esc(d.permalink)}" target="_blank" rel="noopener">글 보기</a>` : ""}<span>${when(d.timestamp)}</span></div>
       ${d.parent_text ? `<div class="quote">내 답글: ${esc(d.parent_text)}</div>` : ""}
       <div class="comment"><span class="who">@${esc(d.username)}</span> ${esc(d.comment)}</div>`
    : `<div class="tmeta"><span>${esc(d.slot)}</span><span>${esc(d.type)}</span></div>${d.photo_hint ? `<div class="quote">사진: ${esc(d.photo_hint)}</div>` : ""}`;
  const photo = d.kind === "post"
    ? `<div class="photo">${d.image_url ? `<img src="${esc(d.image_url)}" alt="올릴 사진">` : ""}
       ${editable && assets ? `<label for="ph-${d.id}">사진 한 장 (직접 찍은 것)</label><input type="file" accept="image/*" id="ph-${d.id}" data-photo="${d.id}">` : ""}</div>` : "";
  const first = d.kind === "post"
    ? `<div><label for="fr-${d.id}">올리자마자 달 첫 답글</label><textarea id="fr-${d.id}" data-first="${d.id}" ${editable ? "" : "readonly"} style="min-height:56px">${esc(d.first_reply_text ?? d.first_reply ?? "")}</textarea></div>` : "";
  const bracket = editable && /\[[^\]]*\]/.test(text);
  const actions = editable
    ? `<div class="trow"><button class="btn main" type="button" data-go="${d.id}" ${bracket ? "disabled" : ""}>${d.kind === "reply" ? "이대로 답글 달기" : "이대로 올리기"}</button>
       <button class="btn" type="button" data-skip="${d.id}">${d.kind === "reply" ? "안 달기" : "이 글 빼기"}</button></div>`
    : `<div class="trow"><span class="state ${d.status}">${LABEL[d.status]}</span>
       ${d.status === "approved" ? `<span class="feat">${d.kind === "reply" ? "다음 정각 7분에 올라가요" : "다음 올리는 시간에 올라가요"}</span>` : ""}
       ${d.status === "approved" || d.status === "skip" ? `<button class="btn" type="button" data-undo="${d.id}">되돌리기</button>` : ""}
       ${d.posted_link ? `<a href="${esc(d.posted_link)}" target="_blank" rel="noopener">스레드에서 보기</a>` : ""}</div>`;
  return `<article class="tcard ${d.status}">${head}
    <div><label for="tx-${d.id}">${d.kind === "reply" ? "답글 초안" : "본문"}</label>
    <textarea id="tx-${d.id}" data-text="${d.id}" ${editable ? "" : "readonly"} style="min-height:${d.kind === "post" ? 200 : 80}px">${esc(text)}</textarea></div>
    ${d.why ? `<p class="why">${esc(d.why)}</p>` : ""}
    ${bracket ? `<div class="flag">[대괄호] 부분을 실제 이야기로 바꿔야 올릴 수 있어요</div>` : ""}
    ${d.status === "failed" && d.error ? `<div class="flag">올리다 실패: ${esc(d.error)}</div>` : ""}
    ${first}${photo}${actions}</article>`;
}

function render() {
  summary();
  $("#thow").innerHTML = HOW[kind];
  document.querySelectorAll(".ttab").forEach(t => t.setAttribute("aria-pressed", String(t.dataset.k === kind)));
  const el = $("#tlist");
  if (!ready) return;
  if (!db) { el.innerHTML = `<div class="empty">검토함에 연결하지 못했어요. claude.ai에 로그인한 상태로 열어 주세요.</div>`; return; }
  const mine = docs.filter(d => d.kind === kind).sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status)
    || (kind === "post" ? (a.order || 0) - (b.order || 0) : String(b.timestamp || "").localeCompare(String(a.timestamp || ""))));
  if (!mine.length) { el.innerHTML = `<div class="empty">${kind === "reply" ? "답할 새 댓글이 없어요. 새 댓글이 오면 Claude가 답글 초안을 넣어요." : "새 글 초안이 아직 없어요. Claude가 다음 글을 써서 넣어요."}</div>`; return; }
  let html = "", last = "";
  for (const d of mine) { if (d.status !== last) { html += `<h2>${LABEL[d.status]}</h2>`; last = d.status; } html += card(d); }
  el.innerHTML = html;
}

document.querySelectorAll(".ttab").forEach(b => b.addEventListener("click", () => {
  kind = b.dataset.k; try { localStorage.setItem("tr_kind", kind); } catch (e) {} render();
}));
$("#tlist").addEventListener("click", async e => {
  const t = e.target.closest("button"); if (!t || !db) return;
  const id = t.dataset.go || t.dataset.skip || t.dataset.undo; if (!id) return;
  t.disabled = true;
  const patch = {};
  if (t.dataset.go) {
    patch.status = "approved"; patch.approved_at = new Date().toISOString(); patch.error = null;
    patch.text = document.getElementById("tx-" + id).value.trim();
    const fr = document.getElementById("fr-" + id); if (fr) patch.first_reply_text = fr.value.trim();
  } else patch.status = t.dataset.skip ? "skip" : "pending";
  try { await db.collection("items").doc(id).update(patch); }
  catch (err) { t.disabled = false; t.textContent = "저장 못 했어요. 다시 눌러 주세요"; }
});
// 고치는 중인 글은 칸을 떠날 때 저장(다른 기기에서 열어도 이어서)
$("#tlist").addEventListener("change", async e => {
  const el = e.target; if (!db) return;
  const id = el.dataset.text || el.dataset.first || el.dataset.photo; if (!id) return;
  try {
    if (el.dataset.photo && el.files[0] && assets) {
      const a = await assets.upload(el.files[0]);
      await db.collection("items").doc(id).update({ image_asset: a.id, image_url: a.url, image_public: null });
    } else if (el.dataset.text) await db.collection("items").doc(id).update({ text: el.value });
    else await db.collection("items").doc(id).update({ first_reply_text: el.value });
  } catch (err) { /* 승인할 때 다시 저장된다 */ }
});

render();
(async () => {
  try { db = await claude.use("db"); assets = await claude.use("assets"); } catch (e) { db = null; }
  ready = true;
  if (!db) { render(); return; }
  db.collection("items").onSnapshot(snap => {
    docs = snap.docs.map(s => ({ id: s.id, ...s.data() }));
    const a = document.activeElement && document.activeElement.id;
    if (a && /^(tx|fr)-/.test(a)) { summary(); return; } // 입력 중이면 다시 그리지 않음
    render();
  }, () => { db = null; render(); });
})();
})();
