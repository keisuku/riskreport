/* prompts: 案件データを埋め込んだAI向けプロンプトを作る。数値はAIに変えさせない */
(function () {
  const P = (RR.prompts = {});
  const M = (x) => RR.money(x);
  const rules = () => RR.chapters.rules.map((r, i) => `${i + 1}. ${r}`).join('\n');
  const mask = (s) => { if (!RR.case.settings.mask) return s; const n = RR.val('co_name'); let o = s; if (n) o = o.split(n).join('【対象企業】'); for (const r of RR.rows('partner')) if (r.f.pt_name) o = o.split(r.f.pt_name).join(`【${r.f.pt_type}${r.id}】`); for (const r of RR.rows('policy')) if (r.f.pol_insurer) o = o.split(r.f.pol_insurer).join('【保険会社】'); return o; };
  const lab = (it) => it.label.replace('｜', '・');
  function company() {
    const g = (id) => { const q = RR.qById[id]; const pv = RR.provOf(q); return pv.empty ? '未記入' : RR.fmtVal(q, RR.val(id)) + (pv.method === '未確認' ? '（未確認）' : ''); };
    return `会社名：${RR.val('co_name') || '未記入'}\n業種：${g('co_industry')}\n売上高：${g('co_revenue')}\n純資産：${g('co_netassets')}\n自己負担できる額：${g('co_retention')}\n限界利益率：${g('co_margin')}\n事業構成：${g('co_business')}\n国内拠点：${RR.rows('site').map((s) => `${s.id} ${s.f.site_name}（${s.f.site_addr || '所在地未記入'}、${s.f.site_use || ''}）`).join('／') || '未記入'}`;
  }
  function riskLine(it, L) {
    return `- ${lab(it)}［${RR.domainById[it.domain].label}］損害：${RR.levelShort.map((n, i) => `${n} ${M(it.loss[i])}`).join('、')}／保険で賄えない額（${RR.levelShort[L]}）${M(it.uninsured[L])}／影響の等級 ${it.grade(L)}／頻度の等級 ${it.freqGrade}／備え：予防${it.prep.prevent || '未回答'}・代替${it.prep.alt || '未回答'}・復旧${it.prep.recover || '未回答'}・保険${it.prep.insure || '未回答'}${it.gap ? '／備えの空白' : ''}${it.unconfirmed.length ? `／未確認の入力：${it.unconfirmed.join('、')}` : ''}`;
  }
  function riskDetail(it, L) { return `${riskLine(it, L)}\n  算出根拠：${it.basis[L].join('；')}\n  頻度の根拠：${it.freqBasis.join('；')}\n  保険：${it.ins[L].lines.join('；') || '紐づく証券なし'}`; }
  function layerDump(layer, recs) {
    const L = RR.layers[layer]; const qs = RR.qsOf(layer).filter((q) => q.type !== 'image');
    if (L.kind === 'items') return qs.map((q) => { const pv = RR.provOf(q); return `- ${q.label}：${pv.empty ? '未記入' : RR.fmtVal(q, RR.val(q.id))}［${pv.empty ? '未記入' : pv.method}${pv.src ? '、' + pv.src : ''}］`; }).join('\n');
    return (recs || RR.rows(layer)).map((r) => `- ${r.id}｜` + qs.filter((q) => q.type !== 'id' && r.f[q.id] !== undefined && r.f[q.id] !== '').map((q) => `${q.label}：${RR.fmtVal(q, r.f[q.id])}`).join('、') + `［${Object.keys(r.prov || {}).map((k) => (r.prov[k].method || '未確認') + (r.prov[k].src ? '・' + r.prov[k].src : '')).join('／')}］`).join('\n') || '（記入なし）';
  }
  const head = (role) => `あなたは、企業向けリスクエンジニアリング・レポートの${role}です。法人向け損害保険の代理店が、顧客企業の経営者に提出する報告書を作っています。読み手は保険の専門家ではありません。\n\n# 守るルール\n${rules()}`;
  const chapterData = {
    c1: (R, L) => `## 結論\n${RR.headlineText().main}\n${RR.headlineText().sub}\n\n## 上位10件\n${R.items.slice(0, 10).map((i) => riskLine(i, L)).join('\n')}\n\n## 優先度Aの提案\n${layerDump('proposal', RR.rows('proposal').filter((p) => p.f.pr_priority === 'A'))}`,
    c2: (R) => `## 確認方法の内訳\n${Object.keys(R.conf).map((k) => `${k} ${R.conf[k]}件`).join('、')}\n\n## 拠点\n${layerDump('site')}\n\n## 評価基準\n影響の大きさ：${RR.impactLabels().map((x, i) => `等級${i + 1}＝${x}`).join('、')}\n頻度：${RR.freqLabels().map((x, i) => `等級${i + 1}＝${x}`).join('、')}\n損害の水準：${RR.levelNames.join('／')}`,
    c3: () => `## 会社\n${layerDump('company')}\n\n## 拠点\n${layerDump('site')}\n\n## 工程・ライン\n${layerDump('line')}\n\n## 仕入先・顧客\n${layerDump('partner')}`,
    c4: () => `## 拠点の自然災害の記録\n${layerDump('hazard')}\n\n## 事故歴\n${layerDump('incident')}\n\n業種：${RR.val('co_industry') || '未記入'}\n\n※この章だけは、上のデータに加えて、公的機関・業界団体の公表資料を調べて書いてよい。ただし、すべての統計・法令・事故例に、資料名・発行者・発行年・URLを付けること。出典を示せない内容は書かないこと。`,
    c5: (R, L) => `## リスク登録簿（全${R.items.length}件）\n${R.items.map((i) => riskLine(i, L)).join('\n')}`,
    c7: (R, L) => `## 事業中断のリスク\n${R.items.filter((i) => i.domain === 'bi').map((i) => riskDetail(i, L)).join('\n')}\n\n## 工程・ライン\n${layerDump('line')}\n\n## 仕入先・顧客\n${layerDump('partner')}`,
    c13: (R, L) => `## 備えの棚卸し\n${layerDump('prep')}\n\n## 備えの空白\n${R.gaps.map((i) => riskLine(i, L)).join('\n') || '該当なし'}`,
    c14: (R, L) => `## 証券\n${layerDump('policy')}\n\n## リスクと保険の対比\n${R.headline.map((i) => riskDetail(i, L)).join('\n')}`,
    c15: (R, L) => `## 提案の台帳\n${layerDump('proposal')}\n\n## 提案を実行した場合の変化（上位）\n${R.items.filter((i) => i.hasPlan).slice(0, 12).map((i) => `- ${lab(i)}：賄えない額 ${M(i.uninsured[L])} → ${M(i.uninsuredC[L])}、頻度 ${i.freqB} → ${i.freqC}`).join('\n') || '該当なし'}`,
  };
  const domData = (dom, layers) => (R, L) => `## この領域のリスク\n${R.items.filter((i) => i.domain === dom).map((i) => riskDetail(i, L)).join('\n') || '試算できるリスクなし'}\n\n${layers.map((l) => `## ${RR.layers[l].label}\n${layerDump(l)}`).join('\n\n')}`;
  Object.assign(chapterData, { c8: domData('cyber', ['cyber', 'system']), c9: domData('liab', ['liability', 'product']), c10: domData('people', ['people']), c11: domData('fin', ['finance']), c12: domData('ovs', ['overseasq', 'overseas']) });

  P.list = function () {
    const out = [{ key: 'pre', group: '準備', title: '事前調査（拠点のハザード情報）', paste: false }, { key: 'memo', group: '準備', title: '面談記録の構造化', paste: false }];
    for (const ch of RR.chapters.chapters) if (ch.ai && !ch.perSite) out.push({ key: ch.id, group: '章別の執筆', title: `${ch.no}　${ch.title}`, paste: true });
    for (const s of RR.rows('site')) out.push({ key: 'site:' + s.id, group: '拠点別の執筆（第6章）', title: `${s.id}　${s.f.site_name || ''}`, paste: true });
    out.push({ key: 'proposal', group: '仕上げ', title: '改善提案の起案', paste: false }, { key: 'verify', group: '仕上げ', title: '検証（本文とデータの照合）', paste: false });
    return out;
  };
  P.build = function (key) {
    const R = RR.compute(), L = R.level; let s = '';
    if (key === 'pre') {
      const cols = RR.excel.tableCols('hazard').filter((c) => c.id !== '_row');
      s = `あなたは、企業の拠点の自然災害リスクを公的資料から調べる調査員です。\n\n# 依頼\n下の拠点について、洪水・内水・高潮・津波・土砂災害・地震の情報を、公的機関の資料から集めてください。\n\n# 守るルール\n1. 使ってよい資料は、国・都道府県・市区町村・公的研究機関が公表しているものだけ（例：洪水浸水想定区域図、ハザードマップ、地震動予測地図）。\n2. 値ごとに、資料名・発行者・公表年・URLを「出典」に書く。\n3. 資料で確認できなかった値は空欄にし、推測で埋めない。確認方法は「未確認」とする。\n4. 番地まで分からず、区域の境界に近い場合は、その旨を「補足」に書く。\n5. 想定浸水深は幅（例：0.5〜3.0m未満）で公表されている。上限の値を記入し、幅を「補足」に書く。\n\n# 拠点\n${RR.rows('site').map((x) => `${x.id}　${x.f.site_name}　${x.f.site_addr || '所在地未記入'}${x.f.site_lat ? `（緯度${x.f.site_lat}、経度${x.f.site_lon}）` : ''}`).join('\n') || '（拠点が未記入です）'}\n\n# 返し方\nExcelの「03 自然災害」シートにそのまま貼れるよう、タブ区切りの表で返してください。1行目は下の項目ID、2行目は見出し、3行目以降は1拠点＝1行です。確認方法は「資料」または「未確認」です。\n\n${cols.map((c) => c.id).join('\t')}\n${cols.map((c) => c.head).join('\t')}`;
    } else if (key === 'memo') {
      const qs = RR.qs.filter((q) => RR.layers[q.layer].kind === 'items');
      s = `あなたは、面談の記録を定型の様式に整理する担当者です。\n\n# 依頼\n末尾の面談記録から、下の項目に当てはまる内容を抜き出し、表にしてください。\n\n# 守るルール\n1. 記録に書かれていないことは、空欄のままにする。推測で埋めない。\n2. 選択肢のある項目は、選択肢の文言をそのまま使う。当てはまるものがなければ空欄にし、「補足」に記録の表現を書く。\n3. 金額は百万円単位の数字に直す。直せない場合は空欄にし、「補足」に元の表現を書く。\n4. 「出典」には、発言者の役職と面談日を書く。確認方法は「聞き取り」とする。\n5. どの項目にも入らない重要な発言は、最後に「様式に入らなかった事項」として箇条書きにする。\n\n# 返し方\nタブ区切りで、列は「項目ID／項目／回答／出典／確認方法／補足」。\n\n# 項目\n${qs.map((q) => `${q.id}\t${q.label}${RR.unitOf(q) ? '（' + RR.unitOf(q) + '）' : ''}${RR.optsOf(q) ? '［' + RR.optsOf(q).join('／') + '］' : ''}`).join('\n')}\n\n# 面談記録\n（ここに面談の記録を貼り付けてください）`;
    } else if (key.startsWith('site:')) {
      const id = key.slice(5); const sm = R.siteMap[id]; const ch = RR.chapters.chapters.find((c) => c.perSite);
      s = `${head('執筆者')}\n\n# 依頼\n第${ch.no}章「${ch.title}」のうち、拠点「${sm ? sm.name : id}」の所見を書いてください。\n${ch.ai}\n見出しや箇条書きは使わず、段落だけで書いてください。\n\n# データ\n## 会社\n${company()}\n\n## 拠点\n${layerDump('site', RR.rows('site').filter((x) => x.id === id))}\n\n## 自然災害\n${layerDump('hazard', RR.rows('hazard').filter((x) => x.f.hz_site === id))}\n\n## 建物と防火\n${layerDump('building', RR.rowsOfSite('building', id))}\n\n## 工程・ライン\n${layerDump('line', RR.rowsOfSite('line', id))}\n\n## 損害見積（規則による計算結果。変更しないこと）\n${sm ? Object.values(sm.perils).map((i) => riskDetail(i, L)).join('\n') : ''}\n\n## 現地の所見\n${layerDump('finding', RR.rowsOfSite('finding', id))}\n\n## この拠点の改善提案\n${layerDump('proposal', RR.rows('proposal').filter((x) => x.f.pr_site === id))}`;
    } else if (key === 'proposal') {
      s = `${head('リスクエンジニア')}\n\n# 依頼\n下のデータから、改善提案を起案してください。すでに台帳にある提案と重ならないものを、優先度の高い順に10件まで。\n各提案は「対象拠点（または全社）／対象リスク／提案（30字以内）／内容（120字以内）／優先度（A・B・C）／費用感（100万円未満・100万〜1,000万円・1,000万〜1億円・1億円超）／根拠にしたデータ」の形で書いてください。\n効果の数値（損害が何%減るか等）は書かないでください。効果は担当者が判断して記入します。\n\n# データ\n## 会社\n${company()}\n\n## 備えの空白\n${R.gaps.slice(0, 25).map((i) => riskLine(i, L)).join('\n') || '該当なし'}\n\n## 上位のリスク\n${R.items.slice(0, 15).map((i) => riskDetail(i, L)).join('\n')}\n\n## 現地の所見\n${layerDump('finding')}\n\n## 既存の提案\n${layerDump('proposal')}\n\n## リスク辞書の対策例\n${RR.risks.map((r) => `- ${r.name}：${(r.measures || []).join('、')}`).join('\n')}`;
    } else if (key === 'verify') {
      const texts = Object.keys(RR.case.ai).filter((k) => (RR.case.ai[k] || '').trim()).map((k) => `### ${k}\n${RR.case.ai[k]}`).join('\n\n');
      s = `あなたは、報告書の校閲者です。本文を書いた人とは別の立場で、本文とデータを照合します。\n\n# 依頼\n下の「本文」を「データ」と1文ずつ照合し、次の5種類の問題を表で挙げてください。問題がなければ「問題なし」と書いてください。\n1. 数値の不一致（金額、割合、件数、等級、順位がデータと違う）\n2. データにない事実（データから確認できない記述）\n3. 出典のない統計・法令・事故例\n4. 補償の断定（保険で支払われる、補償されると言い切っている箇所）\n5. 未確認の見落とし（データで未確認・未記入の項目を、確認済みのように書いている箇所）\n\n表の列は「章／本文の該当箇所／問題の種類／データ上の正しい内容／直し方の案」。本文は書き直さないでください。\n\n# データ\n## 会社\n${company()}\n\n## リスク登録簿（規則による計算結果）\n${R.items.map((i) => riskLine(i, L)).join('\n')}\n\n## 未確認・未記入の事項\n${R.unconfList.slice(0, 80).map((u) => `- ${RR.layers[u.q.layer].label}：${u.who}／${u.q.label}（${u.why}）`).join('\n') || 'なし'}\n\n# 本文\n${texts || '（まだAIの文章が貼り付けられていません。「章別の執筆」「拠点別の執筆」で作った文章を貼り付けると、ここに入ります）'}`;
    } else {
      const ch = RR.chapters.chapters.find((c) => c.id === key); if (!ch) return '';
      const data = chapterData[key] ? chapterData[key](R, L) : `## リスク登録簿\n${R.items.map((i) => riskLine(i, L)).join('\n')}`;
      s = `${head('執筆者')}\n\n# 依頼\n第${ch.no}章「${ch.title}」の本文を書いてください。\n${ch.ai}\n図表は報告書に別に載るので、表は作らず、段落だけで書いてください。\n\n# データ（規則による計算結果と回答。数値は変更しないこと）\n## 会社\n${company()}\n\n${data}`;
    }
    return mask(s);
  };
})();
