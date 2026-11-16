/* charts: 4つの図と拠点略図。すべてSVGを文字列で組み立てる。色は「損害の大きさ（--m1〜5）」と「領域（--d-*）」の2系統のみ */
(function () {
  const C = (RR.charts = {});
  const E = RR.esc;
  const tw = (s, size) => { let w = 0; for (const ch of String(s)) w += ch.charCodeAt(0) < 0x2000 ? 0.56 : 1; return w * size; };
  const fit = (s, size, max) => { s = String(s); if (tw(s, size) <= max) return s; let o = ''; for (const ch of s) { if (tw(o + ch + '…', size) > max) break; o += ch; } return o + '…'; };
  const dcol = (d) => `var(--d-${d})`;
  const mcol = (g) => `var(--m${RR.clamp(g, 1, 5)})`;
  C.short = function (m) { if (m === null || m === undefined) return '—'; const a = Math.abs(m); if (a >= 1000) return RR.n0(m / 100) + '億'; if (a >= 100) return RR.n1(m / 100) + '億'; if (a >= 1) return RR.n0(m) + '百万'; if (a > 0) return RR.n0(m * 100) + '万'; return '0'; };

  /* ラベルを左右の余白に並べ、重ならないよう上下にずらす */
  function sideLabels(pts, o) {
    const cap = Math.max(1, Math.floor((o.bottom - o.top) / o.lh) + 1);
    let L = [], R = [];
    if (o.sides === 'right') R = pts.slice(); else { const mid = (o.x0 + o.x1) / 2; pts.forEach((p) => (p.x < mid ? L : R).push(p)); }
    const move = (from, to, pick) => { while (from.length > cap && to.length < cap) { from.sort(pick); to.push(from.pop()); } };
    move(L, R, (a, b) => a.x - b.x); move(R, L, (a, b) => b.x - a.x);
    for (const [arr, side] of [[L, 'L'], [R, 'R']]) {
      arr.sort((a, b) => a.y - b.y || a.x - b.x);
      let prev = -1e9; arr.forEach((p) => { p.side = side; p.ly = Math.max(p.y, prev + o.lh, o.top); prev = p.ly; });
      let next = 1e9; for (let i = arr.length - 1; i >= 0; i--) { arr[i].ly = Math.min(arr[i].ly, next - o.lh, o.bottom); next = arr[i].ly; }
      arr.forEach((p) => { p.ly = Math.max(p.ly, o.top - 4); p.lx = side === 'L' ? o.x0 - o.gap : o.x1 + o.gap; });
    }
    return pts;
  }
  function labelSvg(p, o) {
    const anchor = p.side === 'L' ? 'end' : 'start'; const dir = p.side === 'L' ? -1 : 1;
    const ex = p.lx - dir * 6; /* 引き出し線の端 */
    const ang = Math.atan2(p.ly - p.y, ex - p.x); const sx = p.x + Math.cos(ang) * (p.r + 1.5), sy = p.y + Math.sin(ang) * (p.r + 1.5);
    const name = fit(p.l1, o.fs, o.colW - 4);
    return `<g class="lb" data-key="${E(p.key)}" tabindex="0" role="button" aria-label="${E(p.l1 + ' ' + p.l2)}">
<path class="leader" d="M${sx.toFixed(1)},${sy.toFixed(1)} L${ex.toFixed(1)},${p.ly.toFixed(1)} h${dir * 4}"/>
<g class="lbt"><rect class="lb-hit" x="${p.side === 'L' ? p.lx - o.colW : p.lx}" y="${p.ly - o.lh / 2}" width="${o.colW}" height="${o.lh}"/>
<text class="t-name" x="${p.lx}" y="${(p.ly - 2).toFixed(1)}" text-anchor="${anchor}" font-size="${o.fs}">${p.mark ? `<tspan class="t-mark">${E(p.mark)}</tspan>` : ''}${E(name)}</text>
<text class="t-num" x="${p.lx}" y="${(p.ly + o.fs + 0.5).toFixed(1)}" text-anchor="${anchor}" font-size="${o.fs}">${E(p.l2)}</text></g></g>`;
  }
  const rScale = (v, max, rmin, rmax) => (max > 0 && v > 0 ? rmin + (rmax - rmin) * Math.sqrt(v / max) : rmin);
  function defs() {
    return `<defs><marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0.8 L7,4 L0,7.2 z" class="arr-head"/></marker>
<pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" class="hatch-l"/></pattern></defs>`;
  }
  const stateName = { A: '対策前', B: '保険と備えを考慮した後', C: '提案を実行した後' };
  C.stateName = stateName;

  /* ---------- 図1：総合リスクマップ（影響の大きさ × 頻度） ---------- */
  C.riskMap = function (o) {
    const R = RR.compute(); const L = o.level === undefined ? R.level : o.level; const st = o.state || 'B';
    const W = o.w || 960; const narrow = W < 600; const fs = narrow ? 10.5 : o.fs || 11.5; const lh = fs * 2 + 7;
    let items = (o.items || R.headline).slice();
    const maxN = o.max || (narrow ? 14 : 30);
    items.sort((a, b) => b.state(L)[st].loss - a.state(L)[st].loss || b.loss[L] - a.loss[L]);
    const rest = items.length > maxN ? items.length - maxN : 0; items = items.slice(0, maxN);
    const colW = narrow ? Math.min(150, W * 0.42) : Math.min(210, W * 0.235);
    const mT = 26, mB = 46; const axisW = 34;
    const x0 = (narrow ? 0 : colW + 10) + axisW, x1 = W - colW - 10;
    const pw = x1 - x0; const ph = Math.max(narrow ? 420 : 360, Math.min(o.h || 9999, Math.max(pw * 0.78, (Math.ceil(items.length / (narrow ? 1 : 2)) + 1) * lh)));
    const H = mT + ph + mB; const y0 = mT, y1 = mT + ph;
    const X = (f) => x0 + (RR.freqPos(f) / 5) * pw, Y = (pos) => y1 - (pos / 5) * ph;
    const maxLoss = Math.max(1, ...R.items.map((i) => i.lossA[L]));
    const rmax = narrow ? 17 : 24;
    let s = `<svg class="viz riskmap" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="総合リスクマップ（${stateName[st]}）">${defs()}`;
    /* 地 */
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { const g = Math.min(5, Math.max(1, Math.round((i + 1) * (j + 1) / 5))); s += `<rect x="${x0 + (i * pw) / 5}" y="${y1 - ((j + 1) * ph) / 5}" width="${pw / 5}" height="${ph / 5}" fill="${mcol(g)}" class="cell-wash g${g}"/>`; }
    for (let i = 0; i <= 5; i++) { s += `<line class="grid" x1="${x0 + (i * pw) / 5}" y1="${y0}" x2="${x0 + (i * pw) / 5}" y2="${y1}"/><line class="grid" x1="${x0}" y1="${y0 + (i * ph) / 5}" x2="${x1}" y2="${y0 + (i * ph) / 5}"/>`; }
    const fl = RR.freqLabels(), il = RR.impactLabels();
    for (let i = 0; i < 5; i++) {
      s += `<text class="t-axis" x="${x0 + ((i + 0.5) * pw) / 5}" y="${y1 + 14}" text-anchor="middle">${i + 1}</text><text class="t-axis sub" x="${x0 + ((i + 0.5) * pw) / 5}" y="${y1 + 26}" text-anchor="middle">${narrow ? '' : E(fl[i])}</text>`;
      s += `<text class="t-axis" x="${x0 - 7}" y="${y1 - ((i + 0.5) * ph) / 5 + 4}" text-anchor="end">${i + 1}</text>`;
      if (!narrow) s += `<text class="t-axis sub" x="${x0 + 5}" y="${y1 - ((i + 1) * ph) / 5 + 12}">${E(il[i])}</text>`;
    }
    s += `<text class="t-axis ttl" x="${(x0 + x1) / 2}" y="${H - 5}" text-anchor="middle">頻度 →（右ほど起きやすい）</text>`;
    s += `<text class="t-axis ttl" transform="translate(${x0 - 24},${(y0 + y1) / 2}) rotate(-90)" text-anchor="middle">影響の大きさ →（上ほど重い）</text>`;
    /* 会社の体力の線 */
    const capLine = (v, label, cls) => { if (!(v > 0) || !(R.net > 0)) return ''; const y = Y(RR.impactScore(v, R.net).pos); return `<line class="cap ${cls}" x1="${x0}" y1="${y}" x2="${x1}" y2="${y}"/><text class="t-cap" x="${x1 - 5}" y="${y - 4}" text-anchor="end">${E(label)} ${E(RR.money(v))}</text>`; };
    s += capLine(R.retention, '自己負担できる額', 'ret') + capLine(R.net, '純資産', 'net');
    /* 点 */
    const pts = items.map((it) => {
      const S = it.state(L); const cur = S[st];
      const ratio = R.net > 0 ? (cur.loss / R.net) * 100 : null;
      const p = { key: it.key, it, x: X(cur.freq), y: Y(cur.imp.pos), r: rScale(cur.loss, maxLoss, 4, rmax), l1: it.label.replace('｜', '・'), l2: `${RR.money(cur.loss)}${ratio !== null && ratio >= 1 ? '（純資産の' + RR.n0(ratio) + '%）' : ''}`, mark: it.gap && st !== 'A' ? '▲' : '' };
      if (o.from && S[o.from]) p.fx = X(S[o.from].freq), p.fy = Y(S[o.from].imp.pos), p.fr = rScale(S[o.from].loss, maxLoss, 4, rmax);
      return p;
    });
    sideLabels(pts, { x0: x0 - axisW, x1, top: y0 + fs, bottom: y1 - fs, lh, gap: 12, sides: narrow ? 'right' : 'both' });
    /* 移動の矢印（印刷でも読める） */
    if (o.from) for (const p of pts) { const d = Math.hypot(p.x - p.fx, p.y - p.fy); if (d < 9) continue; const a = Math.atan2(p.y - p.fy, p.x - p.fx); s += `<circle class="ghost" cx="${p.fx.toFixed(1)}" cy="${p.fy.toFixed(1)}" r="${p.fr.toFixed(1)}"/><line class="move" x1="${p.fx.toFixed(1)}" y1="${p.fy.toFixed(1)}" x2="${(p.x - Math.cos(a) * (p.r + 3)).toFixed(1)}" y2="${(p.y - Math.sin(a) * (p.r + 3)).toFixed(1)}" marker-end="url(#arr)"/>`; }
    pts.slice().sort((a, b) => b.r - a.r).forEach((p) => { s += `<g class="pt" data-key="${E(p.key)}" data-x="${p.x.toFixed(1)}" data-y="${p.y.toFixed(1)}" data-r="${p.r.toFixed(1)}"><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.r.toFixed(1)}" fill="${dcol(p.it.domain)}" class="dot"><title>${E(p.l1 + '：' + p.l2)}</title></circle></g>`; });
    pts.forEach((p) => (s += labelSvg(p, { fs, lh, colW })));
    s += `</svg>`;
    const used = [...new Set(items.map((i) => i.domain))];
    const legend = `<div class="viz-legend">${RR.domains.filter((d) => used.includes(d.id)).map((d) => `<span><i style="background:${dcol(d.id)}"></i>${E(d.label)}</span>`).join('')}<span class="lg-note">円の大きさ＝${st === 'A' ? '損害額' : '保険で賄えない額'}（${E(RR.levelShort[L])}）${st !== 'A' ? '　▲＝備えの空白' : ''}${o.from ? `　○→●＝${E(stateName[o.from])}からの移動` : ''}${rest ? `　ほか${rest}件は登録簿に記載` : ''}</span></div>`;
    return { svg: s, legend, count: items.length, rest };
  };

  /* ---------- 図2：備えと損害のマップ（想定最大損害 × 代替手段の段階） ---------- */
  C.prepMap = function (o) {
    const R = RR.compute(); const W = o.w || 960; const narrow = W < 600; const fs = narrow ? 10.5 : 11.5; const lh = fs * 2 + 7;
    let items = (o.items || R.headline).filter((i) => i.loss[2] > 0).sort((a, b) => b.loss[2] - a.loss[2]);
    const maxN = o.max || (narrow ? 14 : 30); const rest = Math.max(0, items.length - maxN); items = items.slice(0, maxN);
    const colW = narrow ? Math.min(150, W * 0.42) : Math.min(210, W * 0.235); const axisW = 50, mT = 26, mB = 46;
    const x0 = (narrow ? 0 : colW + 10) + axisW, x1 = W - colW - 10, pw = x1 - x0;
    const ph = Math.max(narrow ? 420 : 360, Math.max(pw * 0.72, (Math.ceil(items.length / (narrow ? 1 : 2)) + 1) * lh)); const H = mT + ph + mB, y0 = mT, y1 = mT + ph;
    const vals = items.map((i) => i.loss[2]).concat([R.net, R.retention].filter((v) => v > 0));
    let lo = Math.max(1, Math.min(...vals) / 2), hi = Math.max(...vals) * 1.6; lo = Math.pow(10, Math.floor(Math.log10(lo))); hi = Math.pow(10, Math.ceil(Math.log10(hi) * 4) / 4);
    const Y = (v) => y1 - ((Math.log10(Math.max(v, lo)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * ph;
    const X = (it) => { const a = it.prep.alt || 1; const others = [it.prep.prevent, it.prep.recover, it.prep.insure].map((v) => v || 1); const sub = (others.reduce((x, y) => x + y, 0) / 3 - 1) / 3; return x0 + ((a - 1 + 0.14 + sub * 0.72) / 4) * pw; };
    const maxU = Math.max(1, ...items.map((i) => i.uninsured[2]));
    let s = `<svg class="viz prepmap" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="備えと損害のマップ">${defs()}`;
    /* 強調する領域：損害が大きく、代替手段がない */
    const gapCol = RR.c('gap', '代替手段の段階がこの値以下', 0); const yr = R.retention > 0 ? Math.min(y1, Y(R.retention)) : y1;
    s += `<rect class="gapzone" x="${x0}" y="${y0}" width="${(pw * gapCol) / 4}" height="${yr - y0}"/><rect x="${x0}" y="${y0}" width="${(pw * gapCol) / 4}" height="${yr - y0}" fill="url(#hatch)"/>`;
    s += `<text class="t-zone" x="${x0 + 8}" y="${y0 + 16}">損害が大きく、代替手段がない</text>`;
    for (let i = 0; i <= 4; i++) s += `<line class="grid" x1="${x0 + (i * pw) / 4}" y1="${y0}" x2="${x0 + (i * pw) / 4}" y2="${y1}"/>`;
    s += `<line class="grid" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y0}"/><line class="grid" x1="${x0}" y1="${y1}" x2="${x1}" y2="${y1}"/>`;
    for (let e = Math.log10(lo); e <= Math.log10(hi) + 1e-9; e++) { const v = Math.pow(10, e); s += `<line class="grid faint" x1="${x0}" y1="${Y(v)}" x2="${x1}" y2="${Y(v)}"/><text class="t-axis" x="${x0 - 7}" y="${Y(v) + 4}" text-anchor="end">${E(C.short(v))}</text>`; }
    RR.prepLevels.forEach((p, i) => { const t = p.replace(/^\d\s*/, ''); s += `<text class="t-axis" x="${x0 + ((i + 0.5) * pw) / 4}" y="${y1 + 14}" text-anchor="middle">${i + 1}</text><text class="t-axis sub" x="${x0 + ((i + 0.5) * pw) / 4}" y="${y1 + 26}" text-anchor="middle">${E(narrow ? fit(t, 9.5, pw / 4 - 2) : t)}</text>`; });
    s += `<text class="t-axis ttl" x="${(x0 + x1) / 2}" y="${H - 5}" text-anchor="middle">代替手段の段階 →（右ほど備えが進んでいる）</text>`;
    s += `<text class="t-axis ttl" transform="translate(${x0 - 40},${(y0 + y1) / 2}) rotate(-90)" text-anchor="middle">最悪の場合の損害（円・対数目盛）</text>`;
    const capLine = (v, label, cls) => (v > 0 && v >= lo && v <= hi ? `<line class="cap ${cls}" x1="${x0}" y1="${Y(v)}" x2="${x1}" y2="${Y(v)}"/><text class="t-cap" x="${x1 - 5}" y="${Y(v) - 4}" text-anchor="end">${E(label)} ${E(RR.money(v))}</text>` : '');
    s += capLine(R.retention, '自己負担できる額', 'ret') + capLine(R.net, '純資産', 'net');
    const pts = items.map((it) => ({ key: it.key, it, x: X(it), y: Y(it.loss[2]), r: rScale(it.uninsured[2], maxU, 4, narrow ? 15 : 20), l1: it.label.replace('｜', '・'), l2: `${RR.money(it.loss[2])}　代替${it.prep.alt || '未回答'}`, mark: it.gap ? '▲' : '' }));
    sideLabels(pts, { x0: x0 - axisW, x1, top: y0 + fs, bottom: y1 - fs, lh, gap: 12, sides: narrow ? 'right' : 'both' });
    pts.slice().sort((a, b) => b.r - a.r).forEach((p) => { s += `<g class="pt" data-key="${E(p.key)}"><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.r.toFixed(1)}" fill="${dcol(p.it.domain)}" class="dot"><title>${E(p.l1 + '：' + p.l2)}</title></circle></g>`; });
    pts.forEach((p) => (s += labelSvg(p, { fs, lh, colW })));
    s += `</svg>`;
    const used = [...new Set(items.map((i) => i.domain))];
    const legend = `<div class="viz-legend">${RR.domains.filter((d) => used.includes(d.id)).map((d) => `<span><i style="background:${dcol(d.id)}"></i>${E(d.label)}</span>`).join('')}<span class="lg-note">円の大きさ＝保険で賄えない額（最悪の場合）　▲＝備えの空白　列の中の左右＝予防・復旧手順・保険の平均${rest ? `　ほか${rest}件は登録簿に記載` : ''}</span></div>`;
    return { svg: s, legend };
  };

  /* ---------- 図3：拠点 × 災害の一覧図 ---------- */
  C.heatmap = function (o) {
    const R = RR.compute(); const L = o.level === undefined ? R.level : o.level; const W = o.w || 960; const narrow = W < 600;
    const sites = Object.values(R.siteMap).filter((s) => !o.site || s.id === o.site);
    const cols = RR.perils.filter((p) => RR.riskById[p.id]); const acc = R.items.filter((i) => i.scope === 'accumulation' && !o.site);
    const nameW = narrow ? 84 : 190, sumW = narrow ? 0 : 92; const cw = (W - nameW - sumW - 2) / cols.length; const rh = narrow ? 36 : 34, hh = 30; const fsN = narrow ? 10.5 : 13, fsS = narrow ? 8.5 : 9.5;
    const H = hh + (sites.length + acc.length) * rh + (acc.length ? 10 : 0) + 4;
    let s = `<svg class="viz heatmap" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="拠点×災害の一覧図">`;
    cols.forEach((c, j) => (s += `<text class="t-head" x="${nameW + (j + 0.5) * cw}" y="19" text-anchor="middle">${E(c.label)}</text>`));
    if (sumW) s += `<text class="t-head" x="${W - 4}" y="19" text-anchor="end">拠点資産</text>`;
    s += `<line class="rule" x1="0" y1="${hh - 2}" x2="${W}" y2="${hh - 2}"/>`;
    const cell = (it, x, y, w) => {
      if (!it || !(it.loss[2] > 0)) return `<rect class="hm-empty" x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${rh - 2}"/><text class="t-dash" x="${x + w / 2}" y="${y + rh / 2 + 4}" text-anchor="middle">—</text>`;
      const g = it.grade(L); const v = it.loss[L];
      return `<g class="hm" data-key="${E(it.key)}" tabindex="0" role="button"><rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${rh - 2}" fill="${mcol(g)}" class="hm-c"><title>${E(it.label.replace('｜', '・') + '：' + RR.levelShort[L] + ' ' + RR.money(v) + '、等級' + g)}</title></rect><text class="t-cellnum ${g >= 4 ? 'inv' : ''}" x="${x + w / 2}" y="${y + rh / 2 + (narrow ? 1 : 2)}" text-anchor="middle" font-size="${fsN}">${E(C.short(v))}</text><text class="t-cellsub ${g >= 4 ? 'inv' : ''}" x="${x + w / 2}" y="${y + rh - 5}" text-anchor="middle" font-size="${fsS}">等級${g}</text></g>`;
    };
    sites.forEach((sm, i) => {
      const y = hh + i * rh;
      s += `<text class="t-row" x="0" y="${y + rh / 2 + 4}">${E(fit(sm.name, narrow ? 10.5 : 12, nameW - 6))}</text>`;
      cols.forEach((c, j) => (s += cell(sm.perils[c.id], nameW + j * cw, y, cw)));
      if (sumW) s += `<text class="t-num" x="${W - 4}" y="${y + rh / 2 + 4}" text-anchor="end" font-size="12">${E(RR.money(sm.V))}</text>`;
    });
    acc.forEach((it, k) => {
      const y = hh + sites.length * rh + 10 + k * rh; if (k === 0) s += `<line class="rule" x1="0" y1="${y - 5}" x2="${W}" y2="${y - 5}"/>`;
      s += `<text class="t-row" x="0" y="${y + rh / 2 + 4}">${E(fit('集積：' + it.short.replace(' 同時被災', ''), narrow ? 10.5 : 12, nameW - 6))}</text>`;
      const j = cols.findIndex((c) => c.id === (it.id === 'acc_flood' ? 'flood' : 'quake')); const jb = cols.findIndex((c) => c.id === 'bi');
      const a = Math.min(j, jb), b = Math.max(j, jb);
      s += cell(it, nameW + a * cw, y, (b - a + 1) * cw);
    });
    s += `</svg>`;
    const legend = `<div class="viz-legend">${[1, 2, 3, 4, 5].map((g) => `<span><i class="sq" style="background:${mcol(g)}"></i>等級${g}</span>`).join('')}<span class="lg-note">数字＝${E(RR.levelNames[L])}（円）。等級＝純資産に対する比率。集積の行は、災害の損害と事業中断の合計。</span></div>`;
    return { svg: s, legend };
  };

  /* ---------- 図4：損害と保険の対比図 ---------- */
  C.insBars = function (o) {
    const R = RR.compute(); const L = o.level === undefined ? R.level : o.level; const W = o.w || 960; const narrow = W < 600;
    let items = (o.items || R.headline).filter((i) => i.loss[L] > 0).sort((a, b) => b.loss[L] - a.loss[L]);
    const maxN = o.max || 24; const rest = Math.max(0, items.length - maxN); items = items.slice(0, maxN);
    const rh = narrow ? 50 : 40; const numW = narrow ? 0 : 300; const x0 = 0, x1 = W - 4; const top = 22;
    const max = Math.max(1, ...items.map((i) => i.loss[L])); const bw = x1 - x0; const X = (v) => x0 + (Math.min(v, max) / max) * bw;
    const H = top + items.length * rh + 6;
    let s = `<svg class="viz insbars" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="損害と保険の対比図">`;
    s += `<text class="t-axis" x="${x0}" y="12">0</text><text class="t-axis" x="${x1}" y="12" text-anchor="end">${E(RR.money(max))}</text><line class="rule" x1="${x0}" y1="${top - 4}" x2="${x1}" y2="${top - 4}"/>`;
    items.forEach((it, i) => {
      const y = top + i * rh; const loss = it.loss[L], un = it.uninsured[L], rec = loss - un; const lim = it.policies.reduce((a, p) => a + p.limit, 0);
      const by = y + (narrow ? 30 : 20), bh = 10;
      s += `<g class="ib" data-key="${E(it.key)}" tabindex="0" role="button"><rect class="lb-hit" x="0" y="${y}" width="${W}" height="${rh}"/>`;
      s += `<text class="t-name" x="${x0}" y="${y + 13}" font-size="12"><tspan class="t-dom" fill="${dcol(it.domain)}">■</tspan> ${E(fit(it.label.replace('｜', '・'), 12, W - numW - 24))}</text>`;
      const nums = `損害 <tspan class="b">${E(RR.money(loss))}</tspan>　限度額 <tspan class="b">${lim > 0 ? E(RR.money(lim)) : '保険なし'}</tspan>　賄えない額 <tspan class="b hot">${E(RR.money(un))}</tspan>`;
      s += narrow ? `<text class="t-num sm" x="${x0}" y="${y + 26}">${nums}</text>` : `<text class="t-num sm" x="${x1}" y="${y + 13}" text-anchor="end">${nums}</text>`;
      if (rec > 0) s += `<rect class="bar-rec" x="${x0}" y="${by}" width="${Math.max(1, X(rec) - x0 - (un > 0 ? 2 : 0))}" height="${bh}" rx="2"/>`;
      if (un > 0) s += `<rect x="${X(rec)}" y="${by}" width="${Math.max(2, X(loss) - X(rec))}" height="${bh}" rx="2" fill="${mcol(RR.impactScore(un, R.net).g)}" class="bar-un"/>`;
      if (lim > 0) s += lim <= max ? `<line class="limit" x1="${X(lim)}" y1="${by - 4}" x2="${X(lim)}" y2="${by + bh + 4}"/>` : `<path class="limit-over" d="M${x1 - 6},${by - 3} l6,${bh / 2 + 3} l-6,${bh / 2 + 3}"/>`;
      s += `<title>${E(it.label.replace('｜', '・'))}</title></g>`;
    });
    s += `</svg>`;
    const legend = `<div class="viz-legend"><span><i class="sq rec"></i>保険で賄える見込み</span><span><i class="sq" style="background:var(--m4)"></i>保険で賄えない額（色＝純資産に対する等級）</span><span><i class="tick"></i>支払限度額（▷は目盛の外）</span><span class="lg-note">${E(RR.levelNames[L])}での対比。見込みは算式による試算で、補償を約束するものではありません。${rest ? `ほか${rest}件は登録簿に記載。` : ''}</span></div>`;
    return { svg: s, legend };
  };

  /* ---------- 拠点の略図（外部の地図サービスを使わない） ---------- */
  const JP = {
    hokkaido: [[141.7, 45.5], [142.9, 44.6], [144.3, 44.1], [145.3, 44.3], [145.8, 43.4], [144.4, 42.9], [143.3, 42.0], [141.9, 42.6], [141.0, 42.3], [140.9, 41.8], [140.2, 41.4], [139.8, 42.2], [140.4, 43.2], [141.3, 43.2], [141.6, 44.0], [141.7, 45.0]],
    honshu: [[140.9, 41.5], [141.5, 41.4], [141.5, 40.5], [142.0, 39.6], [141.6, 38.9], [141.5, 38.3], [141.0, 38.2], [141.0, 37.0], [140.6, 36.3], [140.9, 35.7], [140.4, 35.2], [139.9, 34.9], [139.8, 35.6], [139.6, 35.2], [139.1, 35.2], [138.85, 34.6], [138.8, 35.1], [138.2, 34.6], [137.0, 34.6], [136.9, 35.0], [136.6, 34.6], [136.9, 34.3], [136.3, 33.9], [135.8, 33.45], [135.1, 33.9], [135.1, 34.3], [135.4, 34.65], [134.9, 34.65], [134.0, 34.6], [133.3, 34.4], [132.5, 34.3], [132.1, 33.9], [131.2, 33.95], [130.9, 33.95], [130.9, 34.4], [131.4, 34.45], [132.1, 34.9], [132.7, 35.4], [133.3, 35.55], [134.2, 35.55], [135.2, 35.75], [135.5, 35.5], [136.0, 35.7], [136.1, 36.2], [136.7, 36.7], [136.7, 37.3], [137.3, 37.5], [137.1, 37.1], [137.0, 36.8], [138.2, 37.2], [139.1, 38.0], [139.8, 38.9], [139.7, 39.9], [140.0, 40.6], [140.3, 41.2], [140.7, 40.9], [141.2, 41.2]],
    shikoku: [[134.6, 34.2], [134.75, 33.8], [134.2, 33.25], [133.5, 33.5], [133.0, 32.75], [132.5, 33.0], [132.0, 33.35], [132.7, 33.9], [132.9, 34.1], [133.6, 34.3], [134.0, 34.35]],
    kyushu: [[130.9, 33.9], [131.7, 33.6], [132.0, 32.9], [131.45, 31.6], [131.0, 31.2], [130.7, 31.0], [130.2, 31.25], [130.2, 32.1], [130.6, 32.8], [130.2, 32.6], [129.8, 32.7], [129.5, 33.35], [130.2, 33.6]],
    okinawa: [[128.3, 26.85], [127.95, 26.45], [127.65, 26.1], [127.75, 26.5]],
  };
  C.siteMap = function (o) {
    const R = RR.compute(); const L = o.level === undefined ? R.level : o.level; const W = o.w || 960; const narrow = W < 600; const peril = o.peril || 'max';
    const sites = Object.values(R.siteMap).filter((s) => isFinite(Number(s.ctx.f.site_lat)) && isFinite(Number(s.ctx.f.site_lon)) && s.ctx.f.site_lat !== '' && s.ctx.f.site_lat !== undefined);
    if (!sites.length) return { svg: '', legend: '', empty: true };
    const fs = narrow ? 10.5 : 11.5, lh = fs * 2 + 7; const colW = narrow ? Math.min(150, W * 0.42) : Math.min(210, W * 0.235);
    const x0 = narrow ? 0 : colW + 10, x1 = W - colW - 10, pw = x1 - x0; const mT = 10;
    const lon0 = 128.6, lon1 = 146.2, lat0 = 30.6, lat1 = 45.8; const k = Math.cos((38 * Math.PI) / 180);
    const sc = Math.min(pw / ((lon1 - lon0) * k), 9999); const ph = Math.max((lat1 - lat0) * sc, (Math.ceil(sites.length / (narrow ? 1 : 2)) + 1) * lh); const sc2 = Math.min(sc, ph / (lat1 - lat0));
    const ox = x0 + (pw - (lon1 - lon0) * k * sc2) / 2; const H = mT + ph + 10;
    const PX = (lon) => ox + (lon - lon0) * k * sc2, PY = (lat) => mT + (lat1 - lat) * sc2;
    let s = `<svg class="viz sitemap" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="拠点の略図">`;
    for (const key in JP) { const pts = JP[key].map(([lo, la]) => (key === 'okinawa' ? [PX(lo + 3.2), PY(la + 4.6)] : [PX(lo), PY(la)])); s += `<path class="land" d="M${pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L')} Z"/>`; }
    s += `<rect class="inset" x="${PX(130.1)}" y="${PY(32.0 + 4.6) + 0}" width="${PX(132.4) - PX(130.1)}" height="${PY(30.2 + 4.6 - 0.2) - PY(32.0 + 4.6)}" visibility="hidden"/>`;
    const val = (sm) => { if (peril === 'max') { let b = null; for (const p in sm.perils) if (!b || sm.perils[p].loss[L] > b.loss[L]) b = sm.perils[p]; return b; } return sm.perils[peril] || null; };
    const maxV = Math.max(1, ...sites.map((sm) => (val(sm) ? val(sm).loss[L] : 0)));
    const pts = sites.map((sm) => { const it = val(sm); const v = it ? it.loss[L] : 0; return { key: it ? it.key : 'site:' + sm.id, sm, it, x: PX(Number(sm.ctx.f.site_lon)), y: PY(Number(sm.ctx.f.site_lat)), r: it && v > 0 ? rScale(v, maxV, 5, narrow ? 12 : 15) : 4, l1: sm.name, l2: it && v > 0 ? `${peril === 'max' ? it.short + ' ' : ''}${RR.money(v)}・等級${it.grade(L)}` : '想定なし' }; });
    sideLabels(pts, { x0, x1, top: mT + fs, bottom: H - 10 - fs, lh, gap: 6, sides: narrow ? 'right' : 'both' });
    pts.forEach((p) => { s += `<g class="pt" data-key="${E(p.key)}"><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.r.toFixed(1)}" fill="${p.it && p.it.loss[L] > 0 ? mcol(p.it.grade(L)) : 'var(--paper)'}" class="dot site"><title>${E(p.l1 + '：' + p.l2)}</title></circle></g>`; });
    pts.forEach((p) => (s += labelSvg(p, { fs, lh, colW })));
    s += `</svg>`;
    const ov = RR.rows('overseas'); const pl = peril === 'max' ? '最大の災害' : (RR.perils.find((p) => p.id === peril) || {}).label;
    const legend = `<div class="viz-legend">${[1, 2, 3, 4, 5].map((g) => `<span><i style="background:${mcol(g)}"></i>等級${g}</span>`).join('')}<span class="lg-note">表示：${E(pl)}（${E(RR.levelShort[L])}）。海岸線は位置関係を示すための略図です。${ov.length ? '海外：' + ov.map((x) => E(x.f.ovs_name + '（' + x.f.ovs_country + '）')).join('、') : ''}</span></div>`;
    return { svg: s, legend };
  };

  /* ---------- 汎用の横棒（ライン別の事業中断など） ---------- */
  C.bars = function (rows, o) {
    const W = o.w || 960; const rh = 30; const max = Math.max(1, ...rows.map((r) => r.v)); const H = rows.length * rh + 4; const nameW = Math.min(300, W * 0.4), numW = 86; const bw = W - nameW - numW - 8;
    let s = `<svg class="viz bars" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${E(o.label || '')}">`;
    rows.forEach((r, i) => { const y = i * rh; s += `<text class="t-name" x="0" y="${y + 19}" font-size="11.5">${E(fit(r.name, 11.5, nameW - 6))}</text><rect x="${nameW}" y="${y + 9}" width="${Math.max(1, (r.v / max) * bw)}" height="12" rx="2" fill="${r.color || 'var(--d-bi)'}"/><text class="t-num" x="${W - 2}" y="${y + 19}" text-anchor="end" font-size="12">${E(RR.money(r.v))}</text>`; });
    return { svg: s + '</svg>', legend: o.note ? `<div class="viz-legend"><span class="lg-note">${E(o.note)}</span></div>` : '' };
  };

  /* ---------- 画面への取り付けと動き（組み上がり／状態の移動の2か所だけ） ---------- */
  const mem = new WeakMap();
  C.mount = function (host, kind, opts, animate) {
    const w = Math.max(300, Math.floor(host.clientWidth || opts.w || 900)); const out = C[kind](Object.assign({}, opts, { w }));
    const prev = mem.get(host); const still = matchMedia('(prefers-reduced-motion: reduce)').matches || !animate || !host.animate;
    host.innerHTML = out.empty ? '<p class="viz-empty">拠点の緯度・経度が未記入のため、略図は表示できません。「データ」画面の拠点一覧に記入すると表示されます。</p>' : `<div class="viz-wrap">${out.svg}</div>${out.legend}`;
    const now = {}; host.querySelectorAll('g.pt').forEach((g) => { const c = g.querySelector('circle'); now[g.dataset.key] = { x: +c.getAttribute('cx'), y: +c.getAttribute('cy'), r: +c.getAttribute('r'), g }; });
    mem.set(host, { kind, pos: now });
    if (still) return out;
    const ease = 'cubic-bezier(.2,.7,.2,1)';
    if (animate === 'build' || !prev || prev.kind !== kind) {
      let i = 0; for (const k in now) { now[k].g.animate([{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 520, delay: 120 + i * 28, easing: ease, fill: 'backwards' }); i++; }
      host.querySelectorAll('g.lb').forEach((g, j) => g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, delay: 420 + j * 28, easing: 'ease-out', fill: 'backwards' }));
      host.querySelectorAll('.cap,.t-cap,.gapzone,.t-zone,.hm,.ib .bar-un,.ib .bar-rec').forEach((e) => e.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 200, fill: 'backwards' }));
    } else if (animate === 'move') {
      for (const k in now) { const p = prev.pos[k], n = now[k]; if (!p) { n.g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500 }); continue; } n.g.animate([{ transform: `translate(${p.x - n.x}px,${p.y - n.y}px) scale(${p.r / n.r})` }, { transform: 'translate(0,0) scale(1)' }], { duration: 900, easing: ease }); }
      host.querySelectorAll('g.lb .leader, .move, .ghost').forEach((e) => e.animate([{ opacity: 0 }, { opacity: 0 }, { opacity: 1 }], { duration: 1100 }));
      host.querySelectorAll('g.lb .lbt').forEach((e) => e.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 700 }));
    }
    return out;
  };
})();
