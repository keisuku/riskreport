/* excel: 様式の出力、記入済みExcelの読み込み、検証、差分。ファイルは端末の外に送信しない */
(function () {
  const X = (RR.excel = {});
  const COL = { head: 'FF22262B', headText: 'FFFFFFFF', req: 'FFFBE3D6', opt: 'FFEFF2F4', fixed: 'FFE3E2DD', ex: 'FFF7F6F1', id: 'FF8A8F96', line: 'FFB9B7AE' };
  const PROV_HEAD = { _src: '出典', _date: '確認日', _method: '確認方法', _note: '補足' };
  const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
  const border = { top: { style: 'thin', color: { argb: COL.line } }, left: { style: 'thin', color: { argb: COL.line } }, bottom: { style: 'thin', color: { argb: COL.line } }, right: { style: 'thin', color: { argb: COL.line } } };
  const colLetter = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  X.ready = () => typeof ExcelJS !== 'undefined';
  const headOf = (q) => RR.t(q.label) + (RR.unitOf(q) ? `（${RR.unitOf(q)}）` : '') + (q.req ? ' ＊' : '');

  /* 表の列の並び：区分、質問、確認の列 */
  X.tableCols = function (layer) {
    const L = RR.layers[layer]; const cols = [{ id: '_row', head: '区分', w: 8 }];
    RR.qsOf(layer).filter((q) => q.type !== 'image').forEach((q) => cols.push({ id: q.id, q, head: headOf(q), w: q.w || (q.type === 'text' ? 18 : q.type === 'long' ? 40 : q.type === 'select' ? 18 : 13) }));
    const pgs = [{ id: 'row', label: '' }].concat(L.pgs || []);
    for (const pg of pgs) for (const k of ['_src', '_date', '_method']) cols.push({ id: pg.id === 'row' ? k : k + '.' + pg.id, prov: k, pg: pg.id, head: (pg.label ? pg.label + 'の' : (L.pgs ? 'その他の' : '')) + PROV_HEAD[k], w: k === '_src' ? 30 : 12 });
    cols.push({ id: '_note', prov: '_note', head: '補足', w: 30 });
    return cols;
  };
  const ITEM_COLS = [['_qid', '項目ID', 16], ['_label', '項目', 34], ['_answer', '回答', 26], ['_unit', '単位', 8], ['_src', '出典', 28], ['_date', '確認日', 12], ['_method', '確認方法', 12], ['_note', '補足', 28], ['_help', '記入の手引き・記入例', 50]];

  /* ---------- 出力 ---------- */
  X.build = async function (o) {
    const wb = new ExcelJS.Workbook(); wb.creator = 'リスクレポート基盤'; wb.created = new Date();
    const filled = !!o.filled; const quick = o.edition === 'quick';
    const sheets = RR.sheets.filter((s) => !quick || s.quick);
    /* プルダウンの選択肢は隠しシートに置く */
    const lists = wb.addWorksheet('_lists', { state: 'hidden' }); const listRef = {}; let lc = 0;
    const refOfList = (opts) => { const key = opts.join('|'); if (!listRef[key]) { lc++; opts.forEach((v, i) => (lists.getCell(i + 1, lc).value = v)); listRef[key] = `'_lists'!$${colLetter(lc)}$1:$${colLetter(lc)}$${opts.length}`; } return listRef[key]; };
    const methodRef = refOfList(RR.methods);
    let siteIdRef = null;
    const setV = (cell, q, v) => { if (v === undefined || v === null || v === '') return; cell.value = ['num', 'money', 'pct'].includes(q.type) && isFinite(Number(v)) ? Number(v) : String(v); };
    const validate = (cell, q) => {
      const opts = RR.optsOf(q);
      if (opts) cell.dataValidation = { type: 'list', allowBlank: true, formulae: [refOfList(opts)], showErrorMessage: true, errorStyle: 'warning', errorTitle: '選択肢にない値です', error: 'プルダウンから選んでください。' };
      else if (q.type === 'ref' && siteIdRef) cell.dataValidation = { type: 'list', allowBlank: true, formulae: [siteIdRef], showErrorMessage: false };
      else if (['num', 'money', 'pct'].includes(q.type)) { cell.dataValidation = { type: 'decimal', operator: 'between', allowBlank: true, formulae: [-1e12, 1e12], showErrorMessage: true, errorStyle: 'warning', errorTitle: '数値で記入してください', error: '単位は見出しに書いてあります。数字だけを記入してください。' }; cell.numFmt = '#,##0.##'; cell.alignment = { horizontal: 'right', vertical: 'top' }; }
    };
    for (const sh of sheets) {
      const ws = wb.addWorksheet(sh.name, { views: [{ showGridLines: false }] });
      if (sh.guide) { guideSheet(ws, o, quick); continue; }
      let r = 1;
      ws.getCell(r, 1).value = RR.t(sh.name) + '　／　' + (RR.val('co_name') && filled ? RR.val('co_name') : '') ; ws.getCell(r, 1).font = { bold: true, size: 14 }; r++;
      ws.getCell(r, 1).value = `行の単位：${sh.unit}　｜　様式の版：${RR.raw.questions.version}　｜　＊は必須。色の意味は「00 使い方」を参照。灰色の小さな英数字の行（項目ID）は消さないでください。`; ws.getCell(r, 1).font = { size: 9, color: { argb: 'FF5B6067' } }; r += 2;
      const widths = {};
      for (const layer of sh.layers) {
        const L = RR.layers[layer];
        ws.getCell(r, 1).value = '■ ' + RR.t(L.label); ws.getCell(r, 1).font = { bold: true, size: 11 }; r++;
        if (L.kind === 'items') {
          ITEM_COLS.forEach(([id, head, w], i) => { const c = ws.getCell(r, i + 1); c.value = id; c.font = { size: 7, color: { argb: COL.id } }; const h = ws.getCell(r + 1, i + 1); h.value = head; h.font = { bold: true, color: { argb: COL.headText }, size: 10 }; h.fill = fill(COL.head); h.border = border; h.alignment = { vertical: 'middle', wrapText: true }; widths[i + 1] = Math.max(widths[i + 1] || 0, w); });
          ws.getRow(r).height = 10; r += 2;
          for (const q of RR.qsOf(layer)) {
            const it = filled ? RR.case.items[q.id] || {} : {};
            const cells = [q.id, RR.t(q.label) + (q.req ? ' ＊' : ''), null, RR.unitOf(q), it.src || '', it.date || '', it.method || '', it.note || '', [q.help, q.ex !== undefined && q.ex !== '' ? '例：' + q.ex : ''].filter(Boolean).join('　')];
            cells.forEach((v, i) => { const c = ws.getCell(r, i + 1); if (v !== null && v !== '') c.value = v; c.border = border; c.alignment = { vertical: 'top', wrapText: true }; c.fill = fill(i < 2 || i === 3 || i === 8 ? COL.fixed : i === 2 ? (q.req ? COL.req : COL.opt) : COL.opt); if (i === 0) c.font = { size: 8, color: { argb: COL.id } }; if (i === 8) c.font = { size: 9, color: { argb: 'FF5B6067' } }; });
            const a = ws.getCell(r, 3); setV(a, q, it.v); validate(a, q);
            ws.getCell(r, 7).dataValidation = { type: 'list', allowBlank: true, formulae: [methodRef] };
            r++;
          }
          r += 2;
        } else {
          const cols = X.tableCols(layer); const recs = filled ? RR.rows(layer) : [];
          const blank = layer === 'site' || L.onePerSite ? Math.max(0, (o.sites || 0) - recs.length) : 0;
          const prepNames = layer === 'prep' && !recs.length ? RR.risks.map((x) => x.name) : [];
          const nRows = Math.max(recs.length + blank + prepNames.length + 30, 40);
          const idRow = r, headRow = r + 1, exRow = r + 2, first = r + 3;
          cols.forEach((c, i) => {
            const ci = i + 1; widths[ci] = Math.max(widths[ci] || 0, c.w);
            const a = ws.getCell(idRow, ci); a.value = c.id; a.font = { size: 7, color: { argb: COL.id } };
            const h = ws.getCell(headRow, ci); h.value = c.head; h.font = { bold: true, color: { argb: COL.headText }, size: 10 }; h.fill = fill(COL.head); h.border = border; h.alignment = { vertical: 'middle', wrapText: true };
            const e = ws.getCell(exRow, ci); e.fill = fill(COL.ex); e.border = border; e.font = { italic: true, size: 9, color: { argb: 'FF7A7E84' } }; e.alignment = { vertical: 'top', wrapText: true };
            if (c.id === '_row') e.value = '記入例'; else if (c.q && c.q.ex !== undefined && c.q.ex !== '') e.value = c.q.ex; else if (c.prov === '_src') e.value = '（例）固定資産台帳'; else if (c.prov === '_method') e.value = '資料'; else if (c.prov === '_date') e.value = RR.today();
            if (c.q && c.q.help) h.note = c.q.help;
          });
          ws.getRow(idRow).height = 10; ws.getRow(headRow).height = 34;
          if (layer === 'site') { const ci = cols.findIndex((c) => c.id === 'site_id') + 1; siteIdRef = `'${sh.name}'!$${colLetter(ci)}$${first}:$${colLetter(ci)}$${first + 400}`; }
          for (let k = 0; k < nRows; k++) {
            const rec = recs[k]; const rr = first + k;
            cols.forEach((c, i) => {
              const cell = ws.getCell(rr, i + 1); cell.border = border; cell.alignment = { vertical: 'top', wrapText: true };
              if (c.id === '_row') { cell.fill = fill(COL.fixed); return; }
              if (c.q) {
                cell.fill = fill(c.q.type === 'id' ? COL.fixed : c.q.req ? COL.req : COL.opt); validate(cell, c.q);
                if (rec) setV(cell, c.q, rec.f[c.id]);
                else if (k < recs.length + blank) { const n = String(k + 1).padStart(2, '0'); if (c.q.id === 'site_id') cell.value = 'S' + n; if (L.onePerSite && c.q.id === L.siteField) cell.value = 'S' + n; }
                else if (prepNames.length && k < prepNames.length && c.q.id === 'prep_risk') cell.value = prepNames[k];
              } else {
                cell.fill = fill(COL.opt);
                if (c.prov === '_method') cell.dataValidation = { type: 'list', allowBlank: true, formulae: [methodRef] };
                if (rec) { if (c.prov === '_note') { if (rec.note) cell.value = rec.note; } else { const p = (rec.prov || {})[c.pg] || {}; const v = p[c.prov.slice(1)]; if (v) cell.value = v; } }
              }
            });
          }
          r = first + nRows + 2;
          if (sh.layers.length === 1) ws.views = [{ state: 'frozen', ySplit: headRow, xSplit: 2, showGridLines: false }];
        }
      }
      for (const ci in widths) ws.getColumn(Number(ci)).width = widths[ci];
    }
    const buf = await wb.xlsx.writeBuffer();
    return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  };
  function guideSheet(ws, o, quick) {
    ws.getColumn(1).width = 4; ws.getColumn(2).width = 26; ws.getColumn(3).width = 90;
    const rows = [
      ['T', 'リスク診断 ヒアリング様式（' + (quick ? '簡易版' : '網羅版') + '）'],
      ['', `様式の版：${RR.raw.questions.version}　／　出力日：${RR.today()}　／　業種：${o.industry || RR.val('co_industry') || '未選択'}`],
      [], ['H', '記入の手順'],
      ['1', 'シート「01 会社概要」から順に記入します。分からない項目は空欄のままで構いません。空欄は「未記入」として扱い、レポートでは未確認と表示します。'],
      ['2', '拠点・建物・ライン・証券・事故は、1件につき1行です。行が足りなければ、表の下に続けて記入してください。'],
      ['3', '拠点IDは「02 拠点一覧」で決め、ほかのシートではそのIDで拠点を指定します（例：S01）。'],
      ['4', '金額は見出しに書かれた単位（百万円）で、数字だけを記入します。1億2,000万円は 120 です。'],
      ['5', '各行の「出典」「確認日」「確認方法」に、その値の根拠を記入します。確認方法は、現地・資料・聞き取り・未確認から選びます。'],
      ['6', '記入が終わったら、このファイルをそのまま担当者に返送してください。アプリが読み込み、未記入や矛盾を一覧で示します。'],
      [], ['H', '色の意味'],
      ['C' + COL.req, '必須の記入欄（見出しに ＊）'], ['C' + COL.opt, '任意の記入欄、出典・確認の欄'], ['C' + COL.fixed, '変更しない欄（項目ID、項目名、区分）'], ['C' + COL.ex, '記入例（読み込み時は無視されます）'],
      [], ['H', '守っていただきたいこと'],
      ['・', '各表の上にある灰色の小さな英数字の行（項目ID）は、消したり書き換えたりしないでください。列や行の順番は入れ替えても読み込めます。'],
      ['・', 'プルダウンのある欄は、選択肢から選んでください。当てはまらない場合は、最も近いものを選び「補足」に書いてください。'],
      ['・', 'このファイルの内容は、読み込むパソコンの中だけで処理され、外部には送信されません。'],
      [], ['H', 'シートの一覧'],
    ];
    RR.sheets.filter((s) => !s.guide && (!quick || s.quick)).forEach((s) => rows.push(['・', `${s.name}：${s.unit}`]));
    rows.forEach((row, i) => {
      const r = i + 1; if (!row.length) return;
      if (row[0] === 'T') { ws.getCell(r, 2).value = row[1]; ws.getCell(r, 2).font = { bold: true, size: 16 }; }
      else if (row[0] === 'H') { ws.getCell(r, 2).value = row[1]; ws.getCell(r, 2).font = { bold: true, size: 11, color: { argb: COL.headText } }; ws.getCell(r, 2).fill = fill(COL.head); ws.getCell(r, 3).fill = fill(COL.head); }
      else if (row[0][0] === 'C') { ws.getCell(r, 2).fill = fill(row[0].slice(1)); ws.getCell(r, 2).border = border; ws.getCell(r, 3).value = row[1]; }
      else { ws.getCell(r, 2).value = row[0] && row[0] !== '・' ? '手順 ' + row[0] : ''; ws.getCell(r, 3).value = row[1]; ws.getCell(r, 3).alignment = { wrapText: true, vertical: 'top' }; }
    });
  }

  /* ---------- 読み込み ---------- */
  const z2h = (s) => String(s).replace(/[０-９．，－]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[，]/g, ',');
  function cellVal(cell) {
    let v = cell.value; if (v === null || v === undefined) return '';
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === 'object') { if (v.richText) v = v.richText.map((t) => t.text).join(''); else if (v.result !== undefined) v = v.result; else if (v.text !== undefined) v = v.text; else if (v.error) v = ''; else v = String(v); if (v instanceof Date) return v.toISOString().slice(0, 10); }
    return typeof v === 'string' ? v.trim() : v;
  }
  function coerce(q, v, where, issues, sheet) {
    if (v === '' || v === null || v === undefined) return '';
    if (['num', 'money', 'pct'].includes(q.type)) {
      if (typeof v === 'number') return v;
      const n = Number(z2h(v).replace(/[,\s]/g, '').replace(/(百万円|億円|万円|円|%|％|m|km|㎡|か月|日|年|件|台|人|時間)$/, ''));
      if (!isFinite(n) || z2h(v).replace(/[,\s]/g, '') === '') { issues.push({ sev: 'error', kind: '形式違い', sheet, where, qid: q.id, msg: `「${q.label}」は数値で記入してください（記入値：${v}）。この値は読み込んでいません。` }); return ''; }
      if (/億円$/.test(String(v)) && q.type === 'money') return n * 100;
      return n;
    }
    if (q.type === 'date') { const s = z2h(v).replace(/[./年月]/g, '-').replace(/日/g, ''); const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (!m) { issues.push({ sev: 'warn', kind: '形式違い', sheet, where, qid: q.id, msg: `「${q.label}」は 2027-03-31 の形で記入してください（記入値：${v}）。` }); return String(v); } return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`; }
    return String(v).trim();
  }
  X.parse = async function (arrayBuffer) {
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(arrayBuffer);
    const c = RR.emptyCase(); const issues = []; let found = 0; const seenSheets = [];
    /* 業種を先に読んで、業種パックの質問を有効にする */
    const allQ = {}; RR.raw.questions.questions.forEach((q) => (allQ[q.id] = q)); RR.raw.industries.packs.forEach((p) => (p.questions || []).forEach((q) => (allQ[q.id] = q)));
    wb.eachSheet((ws) => {
      if (ws.name === '_lists') return; seenSheets.push(ws.name);
      let mode = null, map = null, layer = null, skip = false;
      ws.eachRow({ includeEmpty: false }, (row, rn) => {
        const vals = []; row.eachCell({ includeEmpty: false }, (cell, cn) => (vals[cn] = cellVal(cell)));
        const flat = vals.filter((v) => v !== '' && v !== undefined);
        if (!flat.length) return;
        if (flat.includes('_qid')) { mode = 'items'; map = {}; vals.forEach((v, i) => { if (typeof v === 'string' && v[0] === '_') map[v] = i; }); skip = true; return; }
        if (flat.includes('_row')) {
          mode = 'table'; map = {}; layer = null; vals.forEach((v, i) => { if (typeof v === 'string' && (v[0] === '_' || allQ[v])) { map[v] = i; if (!layer && allQ[v]) layer = allQ[v].layer; } });
          const unk = flat.filter((v) => typeof v === 'string' && v !== '_row' && v[0] !== '_' && !allQ[v]); if (unk.length) issues.push({ sev: 'warn', kind: '形式違い', sheet: ws.name, where: `${rn}行目`, msg: `知らない項目IDがあります（${unk.slice(0, 5).join('、')}）。その列は読み込んでいません。` });
          skip = true; return;
        }
        if (skip) { skip = false; return; }
        if (typeof flat[0] === 'string' && flat[0].startsWith('■')) { mode = null; return; }
        if (mode === 'items') {
          const qid = vals[map._qid]; const q = allQ[qid]; if (!q) return;
          const where = `${rn}行目`; const v = coerce(q, vals[map._answer], where, issues, ws.name); found++;
          const g = (k) => { const x = vals[map[k]]; return x === undefined ? '' : String(x); };
          c.items[qid] = { v, src: g('_src'), date: g('_date'), method: RR.methods.includes(g('_method')) ? g('_method') : '未確認', note: g('_note') };
          if (g('_method') && !RR.methods.includes(g('_method'))) issues.push({ sev: 'warn', kind: '形式違い', sheet: ws.name, where, qid, msg: `確認方法「${g('_method')}」は選択肢にありません。未確認として扱います。` });
        } else if (mode === 'table' && layer) {
          if (vals[map._row] === '記入例') return;
          const L = RR.raw.questions.layers[layer]; const f = {}; let has = false; const where = `${rn}行目`;
          for (const id in map) { if (id[0] === '_') continue; const q = allQ[id]; const v = coerce(q, vals[map[id]], where, issues, ws.name); if (v !== '') { f[id] = v; if (q.type !== 'id' && q.type !== 'ref') has = true; } }
          if (!has && !(layer === 'hazard' && false)) { if (!(f[L.idField] && layer === 'site')) return; if (Object.keys(f).length <= 1) return; }
          const prov = {}; const pgs = ['row'].concat((L.pgs || []).map((p) => p.id));
          for (const pg of pgs) { const sfx = pg === 'row' ? '' : '.' + pg; const g = (k) => { const x = vals[map[k + sfx]]; return x === undefined ? '' : String(x); }; if (map['_method' + sfx] === undefined && pg !== 'row') continue; prov[pg] = { src: g('_src'), date: g('_date'), method: RR.methods.includes(g('_method')) ? g('_method') : '未確認' }; }
          let id = f[L.idField]; if (!id) { let n = c.rows[layer].length + 1; const ids = new Set(c.rows[layer].map((x) => x.id)); while (ids.has(L.prefix + String(n).padStart(2, '0'))) n++; id = L.prefix + String(n).padStart(2, '0'); f[L.idField] = id; }
          if (c.rows[layer].some((x) => x.id === id)) { issues.push({ sev: 'error', kind: '矛盾', sheet: ws.name, where, qid: L.idField, msg: `ID「${id}」が重複しています。後の行は別のIDを振って読み込みました。` }); id = id + '-' + (c.rows[layer].length + 1); f[L.idField] = id; }
          c.rows[layer].push({ id, f, prov, note: vals[map._note] === undefined ? '' : String(vals[map._note]), _row: rn, _sheet: ws.name }); found++;
        }
      });
    });
    if (!found) issues.push({ sev: 'error', kind: '形式違い', sheet: '—', where: '—', msg: 'このファイルから項目IDを見つけられませんでした。アプリが出力した様式かどうかを確認してください。' });
    c.meta.sheets = seenSheets; c.meta.edition = seenSheets.some((n) => /^0[3-9]|^1[0-3]/.test(n)) ? 'full' : 'quick';
    return { case: c, issues };
  };

  /* ---------- 検証（未記入・形式違い・桁違いの疑い・シート間の矛盾） ---------- */
  X.validate = function (c, parseIssues) {
    const keep = RR.case; const kr = RR.result; RR.case = c; RR.rebuild();
    const out = (parseIssues || []).slice(); const add = (sev, kind, layer, where, qid, msg) => out.push({ sev, kind, sheet: sheetOf(layer), where, qid, msg });
    const sheetOf = (layer) => { const s = RR.sheets.find((x) => (x.layers || []).includes(layer)); return s ? s.name : 'アプリ内'; };
    const n = (v) => (v === '' || v === undefined || v === null ? null : Number(v));
    const quick = c.meta.edition === 'quick'; const inScope = (layer) => { const s = RR.sheets.find((x) => (x.layers || []).includes(layer)); return s && (!quick || s.quick); };
    const rev = n((c.items.co_revenue || {}).v), net = n((c.items.co_netassets || {}).v);
    const check = (q, v, layer, where) => {
      if (v === '' || v === undefined || v === null) { if (q.req && q.type !== 'id') add(layer === 'company' || layer === 'site' ? 'error' : 'warn', '未記入', layer, where, q.id, `必須の「${q.label}」が未記入です。`); return; }
      const opts = RR.optsOf(q); if (opts && !opts.includes(v)) add('warn', '形式違い', layer, where, q.id, `「${q.label}」の値「${v}」は選択肢にありません。評価では既定の扱いになります。`);
      if (q.type === 'pct') { if (v < 0 || v > 100) add('error', '形式違い', layer, where, q.id, `「${q.label}」が ${v}% です。0〜100で記入してください。`); else if (v > 0 && v < 1) add('warn', '桁違いの疑い', layer, where, q.id, `「${q.label}」が ${v}% です。割合（0.${String(v).split('.')[1] || ''}）ではなく%で記入されていますか。`); }
      if (q.type === 'money') { if (v < 0) add('error', '形式違い', layer, where, q.id, `「${q.label}」が負の値です。`); if (v >= 1e6) add('warn', '桁違いの疑い', layer, where, q.id, `「${q.label}」が ${RR.money(v)} です。円単位で記入されていませんか（単位は百万円）。`); }
      if (q.range && typeof v === 'number' && (v < q.range[0] || v > q.range[1])) add('warn', '桁違いの疑い', layer, where, q.id, `「${q.label}」が ${v}${q.unit || ''} です。想定している範囲（${q.range[0]}〜${q.range[1]}）の外です。`);
    };
    for (const q of RR.qs) {
      if (RR.layers[q.layer].appOnly || !inScope(q.layer)) continue;
      if (RR.layers[q.layer].kind === 'items') check(q, (c.items[q.id] || {}).v, q.layer, '項目');
      else for (const r of c.rows[q.layer] || []) check(q, r.f[q.id], q.layer, `${r.id}${r.f[RR.layers[q.layer].nameField] && RR.layers[q.layer].nameField !== q.id ? '（' + r.f[RR.layers[q.layer].nameField] + '）' : ''}`);
    }
    const sites = c.rows.site || []; const ids = new Set(sites.map((s) => s.id));
    if (!sites.length) add('error', '未記入', 'site', '—', null, '拠点が1件も記入されていません。拠点別の評価は行えません。');
    for (const layer in RR.layers) { const L = RR.layers[layer]; if (!L.siteField || L.appOnly) continue; for (const r of c.rows[layer] || []) { const s = r.f[L.siteField]; if (s && !ids.has(s)) add('error', '矛盾', layer, r.id, L.siteField, `拠点ID「${s}」が「拠点一覧」にありません。この行は拠点別の評価に使われません。`); if (!s && RR.qById[L.siteField].req) {} } }
    if (!quick) {
      for (const s of sites) {
        if (!(c.rows.hazard || []).some((h) => h.f.hz_site === s.id)) add('warn', '矛盾', 'hazard', s.id, null, `拠点「${s.f.site_name || s.id}」の自然災害の行がありません。水災・地震は未確認として扱います。`);
        if (!(c.rows.building || []).some((b) => b.f.bld_site === s.id)) add('warn', '矛盾', 'building', s.id, null, `拠点「${s.f.site_name || s.id}」の建物の行がありません。火災は仮定を置いて試算します。`);
      }
      const dup = {}; (c.rows.hazard || []).forEach((h) => { dup[h.f.hz_site] = (dup[h.f.hz_site] || 0) + 1; }); for (const k in dup) if (dup[k] > 1) add('warn', '矛盾', 'hazard', k, null, `拠点「${k}」の自然災害の行が${dup[k]}行あります。最初の行を使います。`);
    }
    const share = sites.reduce((a, s) => a + (n(s.f.site_rev_share) || 0), 0); if (sites.length > 1 && (share < 90 || share > 110)) add('warn', '矛盾', 'site', '全拠点', 'site_rev_share', `売上への寄与の合計が ${RR.n0(share)}% です。国内拠点の合計がおおむね100%になるか確認してください。`);
    const assets = sites.reduce((a, s) => a + (n(s.f.site_val_bld) || 0) + (n(s.f.site_val_eq) || 0) + (n(s.f.site_val_stock) || 0), 0);
    if (rev > 0 && assets > rev * 20) add('warn', '桁違いの疑い', 'site', '全拠点', null, `拠点の資産額の合計（${RR.money(assets)}）が売上高（${RR.money(rev)}）の20倍を超えています。単位を確認してください。`);
    if (rev > 0 && net > rev * 30) add('warn', '桁違いの疑い', 'company', '項目', 'co_netassets', `純資産（${RR.money(net)}）が売上高の30倍を超えています。単位を確認してください。`);
    for (const l of c.rows.line || []) if (rev > 0 && n(l.f.line_revenue) > rev) add('warn', '桁違いの疑い', 'line', l.id, 'line_revenue', `「${l.f.line_name || l.id}」の止まる売上（${RR.money(l.f.line_revenue)}）が全社の売上高を超えています。`);
    const pds = (c.rows.product || []).reduce((a, p) => a + (n(p.f.pd_revenue) || 0), 0); if (rev > 0 && pds > rev * 1.1) add('warn', '矛盾', 'product', '全製品群', 'pd_revenue', `製品群の売上の合計（${RR.money(pds)}）が全社の売上高（${RR.money(rev)}）を超えています。`);
    for (const h of c.rows.hazard || []) if (n(h.f.hz_depth_plan) > n(h.f.hz_depth_max) && n(h.f.hz_depth_max) !== null) add('warn', '矛盾', 'hazard', h.f.hz_site, 'hz_depth_plan', `計画規模の浸水深（${h.f.hz_depth_plan}m）が想定最大規模（${h.f.hz_depth_max}m）より深くなっています。`);
    for (const p of c.rows.policy || []) {
      if (n(p.f.pol_ded) > n(p.f.pol_limit) && n(p.f.pol_limit) !== null) add('warn', '矛盾', 'policy', p.id, 'pol_ded', `免責金額が支払限度額を上回っています。`);
      const tg = String(p.f.pol_sites || '').trim(); if (tg && tg !== '全拠点') for (const s of tg.split(/[,、\s]+/)) if (s && !ids.has(s)) add('error', '矛盾', 'policy', p.id, 'pol_sites', `対象拠点「${s}」が「拠点一覧」にありません。`);
      if (p.f.pol_expiry && /^\d{4}-\d\d-\d\d$/.test(p.f.pol_expiry) && p.f.pol_expiry < RR.today()) add('warn', '矛盾', 'policy', p.id, 'pol_expiry', `満期（${p.f.pol_expiry}）を過ぎています。更改後の証券を確認してください。`);
      if (p.f.pol_type === '企業財産（火災）' && !p.f.pol_flood) add('warn', '未記入', 'policy', p.id, 'pol_flood', '水災の補償の有無が未記入です。水災は保険なしとして試算します。');
    }
    if ((c.items.ov_has || {}).v === 'なし' && (c.rows.overseas || []).length) add('warn', '矛盾', 'overseas', '—', 'ov_has', '海外の拠点・販売が「なし」ですが、海外拠点の行があります。');
    RR.case = keep; RR.rebuild(); RR.result = kr;
    const order = { error: 0, warn: 1, info: 2 }; out.sort((a, b) => order[a.sev] - order[b.sev]);
    return out;
  };

  /* ---------- 差分 ---------- */
  X.diff = function (a, b) {
    const out = []; const show = (v) => (v === undefined || v === null || v === '' ? '（空欄）' : String(v));
    const allQ = {}; RR.raw.questions.questions.forEach((q) => (allQ[q.id] = q)); RR.raw.industries.packs.forEach((p) => (p.questions || []).forEach((q) => (allQ[q.id] = q)));
    const ids = new Set(Object.keys(a.items).concat(Object.keys(b.items)));
    for (const id of ids) { const x = (a.items[id] || {}).v, y = (b.items[id] || {}).v; if (show(x) !== show(y)) out.push({ type: '変更', where: '全社', label: (allQ[id] || { label: id }).label, old: show(x), new: show(y) }); }
    for (const layer in RR.raw.questions.layers) {
      const L = RR.raw.questions.layers[layer]; if (L.kind !== 'table' || L.appOnly) continue;
      const A = a.rows[layer] || [], B = b.rows[layer] || []; const am = {}, bm = {}; A.forEach((r) => (am[r.id] = r)); B.forEach((r) => (bm[r.id] = r));
      for (const r of B) { if (!am[r.id]) { out.push({ type: '追加', where: `${L.label} ${r.id}`, label: r.f[L.nameField] || '', old: '', new: '行を追加' }); continue; } const o = am[r.id]; const ks = new Set(Object.keys(o.f).concat(Object.keys(r.f))); for (const k of ks) if (show(o.f[k]) !== show(r.f[k])) out.push({ type: '変更', where: `${L.label} ${r.id}${r.f[L.nameField] ? '（' + r.f[L.nameField] + '）' : ''}`, label: (allQ[k] || { label: k }).label, old: show(o.f[k]), new: show(r.f[k]) }); }
      for (const r of A) if (!bm[r.id]) out.push({ type: '削除', where: `${L.label} ${r.id}`, label: r.f[L.nameField] || '', old: '行あり', new: '（Excelにない）' });
    }
    return out;
  };
})();
