(function(){
  "use strict";

  var $ = function(id){ return document.getElementById(id); };
  var els = {
    home: $("homeView"), setup: $("setupView"), drill: $("drillView"), done: $("doneView"),
    openSettings: $("openSettings"), settingsBack: $("settingsBack"), settingsDone: $("settingsDone"),
    heroSummary: $("heroSummary"), heroSub: $("heroSub"),
    opChips: $("opChips"),
    digAAdd: $("digAAdd"), digBAdd: $("digBAdd"), digValAdd: $("digValAdd"),
    digASub: $("digASub"), digBSub: $("digBSub"), digValSub: $("digValSub"),
    digAMul: $("digAMul"), digBMul: $("digBMul"), digValMul: $("digValMul"),
    digADiv: $("digADiv"), digBDiv: $("digBDiv"), digValDiv: $("digValDiv"),
    cntAdd: $("cntAdd"), cntSub: $("cntSub"), cntMul: $("cntMul"), cntDiv: $("cntDiv"),
    unlimited: $("unlimited"), totalVal: $("totalVal"),
    limitSeg: $("limitSeg"), limitVal: $("limitVal"),
    startBtn: $("startBtn"), hint: $("hintText"),
    progressText: $("progressText"), timerText: $("timerText"),
    progressBar: $("progressBar"), qcard: $("qcard"), qExpr: $("qExpr"), qMark: $("qMark"),
    answer: $("answer"), keypad: $("keypad"),
    skipBtn: $("skipBtn"), submitBtn: $("submitBtn"), quitBtn: $("quitBtn"),
    reviewSeg: $("reviewSeg"), reviewList: $("reviewList"),
    scoreBig: $("scoreBig"), scoreSub: $("scoreSub"),
    kpiAvg: $("kpiAvg"), kpiStreak: $("kpiStreak"), kpiFast: $("kpiFast"), kpiTotal: $("kpiTotal"),
    wrongCard: $("wrongCard"),
    retryWrongBtn: $("retryWrongBtn"), againBtn: $("againBtn"), backBtn: $("backBtn"),
    stats: $("statsView"), statsBtn: $("openStats"),
    carrySeg: $("carrySeg"), carryVal: $("carryVal"),
    divTol: $("divTol"), divTolVal: $("divTolVal"),
    showSeg: $("showSeg"), showVal: $("showVal"),
    showCustom: $("showCustom"), showInput: $("showInput"), adaptShow: $("adaptShow"),
    adaptMin: $("adaptMin"), adaptMinVal: $("adaptMinVal"), adaptMinBox: $("adaptMinBox"),
    showHint: $("showHint"),
    limitCustom: $("limitCustom"), limitInput: $("limitInput"),
    stRange: $("stRange"),
    stAcc: $("stAcc"), stSub: $("stSub"), stTotal: $("stTotal"), stAvg: $("stAvg"),
    stDur: $("stDur"), stDays: $("stDays"), stStreak: $("stStreak"), stWrong: $("stWrong"),
    stSessions: $("stSessions"), stOps: $("stOps"), stCarry: $("stCarry"),
    stTime: $("stTime"), stTimeNote: $("stTimeNote"),
    stLen: $("stLen"), stTrend: $("stTrend"),
    stExport: $("stExport"), stClear: $("stClear"), stBack: $("stBack"),
    themeBtn: $("themeBtn"), toast: $("toast")
  };

  var S = {
    ops: ["+", "−", "×"],
    dg: { "+": {a: 2, b: 2}, "−": {a: 2, b: 2}, "×": {a: 2, b: 2}, "÷": {a: 2, b: 2} },  // 每种运算的 A/B 位数
    cnt: { "+": 10, "−": 10, "×": 10, "÷": 10 },   // 每种运算的题数（0 = 不出该题型）
    unlimited: false,   // 无限模式：忽略题数随机出题
    total: 0,
    limit: 0,
    carry: 0,          // 0 不限 / 1 必须进位借位 / 2 禁止进位借位
    divTol: 0,         // 除法容差（百分比），答案在 ±该值内算对
    showMs: 0,         // 算式显示多久后隐藏（毫秒），0 = 不隐藏
    adaptShow: false,  // 自适应：答对缩短、答错延长
    adaptMin: 100,     // 自适应下限（ms），可自定义
    curShow: 0,        // 本轮当前的显示时长
    hideTimer: null,
    stRange: "all",    // 统计范围 all / 7 / 1
    records: [],       // 每题的作答记录，用于数据分析
    i: 0, ok: 0, bad: 0, streak: 0, maxStreak: 0,
    times: [], wrong: [], log: [], queue: null,
    reviewMode: "all",
    cur: null, locked: true, qid: 0, t0: 0, tick: null, startAt: 0
  };

  var opsOrder = ["+", "−", "×", "÷"];   // 运算符固定顺序
  var ADAPT_BASE = 2000;                  // 自适应兜底基准（显示时长设为「不限」时用）

  // Presentation state stays separate from the question engine.
  var UI = {
    ready: false,
    nav: { home: $("navHome"), setup: $("navSetup"), stats: $("navStats") },
    title: $("pageTitle"), progress: $("runProgress"),
    count: $("homeQuestionCount"), countUnit: $("homeQuestionUnit"),
    digits: $("homeDigits"), limit: $("homeLimit"), show: $("homeShow"),
    total: $("homeTotal"), accuracy: $("homeAccuracy"), average: $("homeAverage"),
    averageUnit: $("homeAverageUnit"), today: $("homeToday"), date: $("todayLabel")
  };

  function saveSettings(){
    if(!UI.ready) return;
    try{
      localStorage.setItem("drill.settings.v1", JSON.stringify({
        ops: S.ops, dg: S.dg, cnt: S.cnt, unlimited: S.unlimited,
        limit: S.limit, carry: S.carry, divTol: S.divTol,
        showMs: S.showMs, adaptShow: S.adaptShow, adaptMin: S.adaptMin
      }));
    }catch(e){}
  }

  function loadSettings(){
    try{
      var prefs = JSON.parse(localStorage.getItem("drill.settings.v1") || "null");
      if(!prefs || typeof prefs !== "object" || Array.isArray(prefs)) return;
      if(Array.isArray(prefs.ops)) S.ops = opsOrder.filter(function(op){ return prefs.ops.indexOf(op) >= 0; });
      opsOrder.forEach(function(op){
        var d = prefs.dg && prefs.dg[op];
        ["a", "b"].forEach(function(which){
          if(d && Number.isInteger(d[which]) && d[which] >= 1 && d[which] <= 6) S.dg[op][which] = d[which];
        });
        var n = prefs.cnt && prefs.cnt[op];
        if(Number.isInteger(n) && n >= 0 && n <= 999) S.cnt[op] = n;
      });
      if(typeof prefs.unlimited === "boolean") S.unlimited = prefs.unlimited;
      if(Number.isFinite(prefs.limit) && (prefs.limit === 0 || prefs.limit >= 1) && prefs.limit <= 600) S.limit = Math.round(prefs.limit * 10) / 10;
      if([0, 1, 2].indexOf(prefs.carry) >= 0) S.carry = prefs.carry;
      if(Number.isFinite(prefs.divTol) && prefs.divTol >= 0 && prefs.divTol <= 20) S.divTol = Math.round(prefs.divTol * 2) / 2;
      if(Number.isInteger(prefs.showMs) && (prefs.showMs === 0 || prefs.showMs >= 50) && prefs.showMs <= 60000) S.showMs = prefs.showMs;
      if(typeof prefs.adaptShow === "boolean") S.adaptShow = prefs.adaptShow && S.showMs > 0;
      if(Number.isInteger(prefs.adaptMin) && prefs.adaptMin >= 20 && prefs.adaptMin <= 1000) S.adaptMin = prefs.adaptMin;
    }catch(e){}
  }

  function syncSelectionA11y(){
    document.querySelectorAll(".chip, .seg button[data-v]").forEach(function(btn){
      btn.setAttribute("aria-pressed", String(btn.classList.contains("on")));
    });
    document.querySelectorAll(".operation-setting").forEach(function(row){
      row.classList.toggle("inactive", S.ops.indexOf(row.getAttribute("data-operation")) < 0);
    });
  }

  function updateNavigation(name){
    document.body.dataset.view = name;
    UI.title.textContent = { home: "练习首页", setup: "练习设置", drill: "专注练习", done: "练习回顾", stats: "数据分析" }[name];
    Object.keys(UI.nav).forEach(function(key){
      var btn = UI.nav[key];
      var selected = key === name || (key === "home" && name === "done");
      btn.classList.toggle("on", selected);
      btn.disabled = name === "drill";
      if(selected) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
  }

  function renderHomeStats(){
    var records = S.records || [], n = records.length, good = 0, sec = 0, today = 0;
    var start = new Date(); start.setHours(0, 0, 0, 0);
    records.forEach(function(r){ good += r.ok; sec += r.sec; if(r.t >= start.getTime()) today++; });
    UI.total.textContent = String(n);
    UI.accuracy.textContent = n ? Math.round(good / n * 100) + "%" : "—";
    UI.average.textContent = n ? (sec / n).toFixed(1) : "—";
    UI.averageUnit.textContent = n ? "秒" : "";
    UI.today.textContent = today ? "今天已练习 " + today + " 题" : "今天还未开始";
  }

  function syncPresetControls(seg, value, custom, input){
    var preset = seg.querySelector('button[data-v="' + value + '"]');
    var selected = preset || seg.querySelector('button[data-v="custom"]');
    pickSeg(seg, selected);
    custom.classList.toggle("show", !preset);
    input.value = value || "";
  }

  function hydrateSettingsControls(){
    els.opChips.querySelectorAll(".chip").forEach(function(btn){
      btn.classList.toggle("on", S.ops.indexOf(btn.getAttribute("data-op")) >= 0);
    });
    digCfg.forEach(function(c){
      els[c[1]].value = S.dg[c[0]].a;
      els[c[2]].value = S.dg[c[0]].b;
      els[c[3]].textContent = "A " + S.dg[c[0]].a + " 位 / B " + S.dg[c[0]].b + " 位";
      setFill(els[c[1]]); setFill(els[c[2]]);
    });
    cntCfg.forEach(function(c){ els[c[1]].value = S.cnt[c[0]]; });
    els.unlimited.checked = S.unlimited;
    els.adaptShow.checked = S.adaptShow;
    els.divTol.value = S.divTol;
    els.divTolVal.textContent = S.divTol ? "±" + S.divTol + "%" : "0%（精确）";
    pickSeg(els.carrySeg, els.carrySeg.querySelector('button[data-v="' + S.carry + '"]'));
    els.carryVal.textContent = ["不限", "必须进位", "禁止进位"][S.carry];
    syncPresetControls(els.limitSeg, S.limit, els.limitCustom, els.limitInput);
    syncPresetControls(els.showSeg, S.showMs, els.showCustom, els.showInput);
    applyLimit(S.limit); applyShow(S.showMs);
    setFill(els.divTol); syncAdaptMin(); syncSelectionA11y();
  }

  function applyTheme(theme, persist){
    document.documentElement.setAttribute("data-theme", theme);
    var label = theme === "light" ? "切换到深色主题" : "切换到浅色主题";
    els.themeBtn.setAttribute("aria-label", label);
    els.themeBtn.title = label;
    document.querySelector('meta[name="theme-color"]').setAttribute("content", theme === "light" ? "#f6f8f4" : "#111a15");
    if(persist){ try{ localStorage.setItem("drill.theme", theme); }catch(e){} }
  }

  function fitEquation(){
    if(!els.drill.classList.contains("active")) return;
    els.qExpr.style.fontSize = "";
    var width = els.qExpr.clientWidth, natural = els.qExpr.scrollWidth;
    if(natural > width && width > 0){
      var size = parseFloat(window.getComputedStyle(els.qExpr).fontSize);
      els.qExpr.style.fontSize = Math.max(16, Math.floor(size * width / natural)) + "px";
    }
  }

  var TEN = BigInt(10);
  function p10(n){ return TEN ** BigInt(n); }
  function rnd(n){ return Math.floor(Math.random() * n); }

  function randBig(n){
    var s = String(1 + rnd(9));
    for(var i = 1; i < n; i++) s += String(rnd(10));
    return BigInt(s);
  }

  // 同 randBig，但保证不等于 1：乘法里出现 a×1 / 1×b 没有练习价值
  function randBigNoOne(n){
    var v;
    do { v = randBig(n); } while(v === BigInt(1));
    return v;
  }

  // 位数上限为 6，范围可直接用 Number 均匀抽样，避免取模造成的大幅偏差。
  function randBetween(lo, hi){
    var range = Number(hi - lo + BigInt(1));
    return range > 0 ? lo + BigInt(rnd(range)) : lo;
  }

  /* ---------------- 出题（A/B 位数独立） ---------------- */
  function tryDiv(dd, bd){
    var loB = p10(bd - 1);
    if(loB < BigInt(2)) loB = BigInt(2);              // 除数不为 1，避免无意义的题
    var hiB = p10(bd) - BigInt(1);
    var cap = (p10(dd) - BigInt(1)) / BigInt(2);      // 让商 >= 2，避免出现 x ÷ x = 1
    if(cap < hiB) hiB = cap;
    var strict = hiB >= loB;
    if(!strict) return null; // 不允许交换 A/B 或突破已选位数
    var b = randBetween(loB, hiB);
    // 随机出小数商：约 5 成概率尝试“商为一位小数”的题（如 72 ÷ 5 = 14.4）
    if(rnd(10) < 5){
      var rd = tryDivDec(dd, b);
      if(rd) return rd;
    }
    var loA = p10(dd - 1);
    var lo = (loA + b - BigInt(1)) / b; // 向上取整；整除边界也属于合法题目
    var hi = (p10(dd) - BigInt(1)) / b;
    if(strict && hi >= BigInt(2) && lo < BigInt(2)) lo = BigInt(2);
    if(hi < lo) return null;
    var q = randBetween(lo, hi);
    return { a: b * q, b: b, ans: q };
  }

  // 出“商为一位小数”的题：a ÷ b = q，q = m / g（g = gcd(b, 10)）。
  // 除数含因子 2 或 5 时商才可能是有限小数；a = m * (b / g) 恒为整数。
  function tryDivDec(dd, b){
    var g = BigInt(1);
    if(b % BigInt(2) === BigInt(0)) g *= BigInt(2);
    if(b % BigInt(5) === BigInt(0)) g *= BigInt(5);
    if(g === BigInt(1)) return null;                 // 与 10 互质 → 商只能是整数
    var step = b / g;                                // 被除数必须是 step 的倍数
    var loA = p10(dd - 1), hiA = p10(dd) - BigInt(1);
    var loM = (loA + step - BigInt(1)) / step;       // 向上取整，保证被除数位数
    var hiM = hiA / step;
    if(loM < BigInt(2) * g) loM = BigInt(2) * g;     // 商 >= 2，避免无意义题
    if(hiM < loM) return null;
    for(var i = 0; i < 20; i++){
      var m = randBetween(loM, hiM);
      if(m % g !== BigInt(0)){                       // 确保商带小数部分（真小数）
        return { a: m * step, b: b, ans: Number(m) / Number(g) };
      }
    }
    return null;                                     // 没抽到合适的 m，退回整数商
  }

  function makeDiv(da, db){
    if(da < db) return null;
    return tryDiv(da, db);
  }

  function digitsOf(n){
    var str = n.toString(), out = [];
    for(var i = str.length - 1; i >= 0; i--) out.push(+str.charAt(i));
    return out;
  }

  // 加法：某一列相加 >= 10 即产生进位
  function addCarry(a, b){
    var A = digitsOf(a), B = digitsOf(b), carry = 0;
    var n = Math.max(A.length, B.length);
    for(var i = 0; i < n; i++){
      var v = (A[i] || 0) + (B[i] || 0) + carry;
      if(v >= 10) return true;
      carry = 0;
    }
    return false;
  }

  // 减法：某一位不够减即产生借位（a >= b）
  function subBorrow(a, b){
    var A = digitsOf(a), B = digitsOf(b);
    for(var i = 0; i < A.length; i++){
      if(A[i] < (B[i] || 0)) return true;
    }
    return false;
  }

  // 乘法：竖式相乘过程中出现进位
  function mulCarry(a, b){
    var A = digitsOf(a), B = digitsOf(b);
    for(var j = 0; j < B.length; j++){
      var d = B[j];
      if(d === 0) continue;
      var carry = 0;
      for(var i = 0; i < A.length; i++){
        var p = A[i] * d + carry;
        carry = Math.floor(p / 10);
        if(carry > 0) return true;
      }
      if(carry > 0) return true;
    }
    return false;
  }

  // 判断一道题是否含进位/借位（除法用「退位」：商的位数少于被除数位数）
  function carryInfo(q){
    if(q.op === "+") return addCarry(q.a, q.b);
    if(q.op === "−") return subBorrow(q.a, q.b);
    if(q.op === "×") return mulCarry(q.a, q.b);
    var qs = q.ans.toString();                 // BigInt: "24"；小数: "14.4"
    var dot = qs.indexOf(".");
    if(dot > -1) qs = qs.slice(0, dot);        // 按商的整数部分位数判断
    return qs.length < q.a.toString().length;
  }

  function carryOk(q){
    if(!S.carry) return true;
    return S.carry === 1 ? carryInfo(q) : !carryInfo(q);
  }

  function genForMode(op){
    if(!isConfigValid(op)) return null;
    var q = null;
    for(var tries = 0; tries < 2000; tries++){
      q = genRawFor(op);
      if(q && carryOk(q)) return q;
    }
    return null;
  }

  function genQuestion(){
    if(!S.ops.length) return null;
    var candidates = S.ops.filter(function(op){ return isConfigValid(op); });
    if(!candidates.length) return null;
    // 先跳过不可能的配置，避免无限模式在无效算子中反复空转。
    for(var i = 0; i < 20; i++){
      var q = genForMode(candidates[rnd(candidates.length)]);
      if(q) return q;
    }
    // 随机选中暂未命中的算子时，逐个尝试，避免低概率配置导致练习中断。
    for(var j = 0; j < candidates.length; j++){
      var fallback = genForMode(candidates[j]);
      if(fallback) return fallback;
    }
    return null;
  }

  function isConfigValid(op){
    var d = S.dg[op];
    if((op === "−" || op === "÷") && d.a < d.b) return false;
    // 商至少为 2 且除数至少为 2，所以商必然少于被除数位数。
    if(op === "÷" && (S.carry === 2 || (S.carry === 1 && d.a === 1 && d.b === 1))) return false;
    if(op === "−" && d.a === 1 && d.b === 1 && S.carry === 1) return false;
    return true;
  }

  function validateQueueOps(list){
    for(var i = 0; i < list.length; i++){
      if(!isConfigValid(list[i])){
        var op = list[i], d = S.dg[op];
        if((op === "−" || op === "÷") && d.a < d.b)
          return op + "：当前规则下 A 位数不能小于 B 位数，请调整位数";
        if(op === "÷") return "÷：当前位数与退位规则无可用题目，请调整设置";
        return "−：两个一位非负数相减不可能借位，请调整规则";
      }
    }
    return "";
  }

  // 按各题型题数预铺整套题，洗牌后逐题生成（保证每套题各类型数量精确）
  function buildQueue(){
    var ops = [], i, j, k;
    for(i = 0; i < opsOrder.length; i++){
      if(S.ops.indexOf(opsOrder[i]) >= 0 && S.cnt[opsOrder[i]] > 0) ops.push(opsOrder[i]);
    }
    var list = [];
    for(i = 0; i < ops.length; i++){
      for(j = 0; j < S.cnt[ops[i]]; j++) list.push(ops[i]);
    }
    if(!list.length) return null;
    for(k = list.length - 1; k > 0; k--){
      var x = rnd(k + 1), t = list[k];
      list[k] = list[x]; list[x] = t;
    }
    var invalid = validateQueueOps(list);
    if(invalid) return { error: invalid };
    var qs = [];
    for(k = 0; k < list.length; k++){
      var q = genForMode(list[k]);
      if(!q) return { error: list[k] + "：当前位数与进位/借位规则无可用题目，请调整设置" };
      qs.push(q);
    }
    return qs;
  }

  // 乘法：按进位要求构造，保证直接命中
  function genMul(da, db, mode){
    var i, t, sa, sb, A, Bq;
    if(mode === 2){                     // 禁止进位：全程小数字 + 竖式校验
      for(t = 0; t < 60; t++){
        // 单位数放宽到 2~9（寄望乘积 <10 时仍不进位），多位才收窄到 2~3 打头
        sa = da === 1 ? String(2 + rnd(8)) : String(2 + rnd(2));
        for(i = 1; i < da; i++) sa += String(rnd(3));
        sb = db === 1 ? String(2 + rnd(8)) : String(2 + rnd(2));
        for(i = 1; i < db; i++) sb += String(rnd(4));
        A = BigInt(sa); Bq = BigInt(sb);
        // 双保险：两位都 >= 2（杜绝 ×1），且竖式确认不进位
        if(A > BigInt(1) && Bq > BigInt(1) && !mulCarry(A, Bq))
          return { a: A, b: Bq, op: "×", ans: A * Bq };
      }
      // 兜底：按位数取全 2 的串（222×22 之类），必然不进位、必然不含 1
      var fa = "2", fb = "2";
      for(i = 1; i < da; i++) fa += "2";
      for(i = 1; i < db; i++) fb += "2";
      A = BigInt(fa); Bq = BigInt(fb);
      return { a: A, b: Bq, op: "×", ans: A * Bq };
    }

    // 必须进位：个位乘积 >= 10
    var pairs = [[2,5],[2,6],[2,7],[2,8],[2,9],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],
                 [4,3],[4,4],[4,5],[4,6],[5,2],[5,3],[5,4],[6,2],[6,3],[7,2],[8,2],[9,2]];
    var pr = pairs[rnd(pairs.length)];
    sa = ""; sb = "";
    for(i = 0; i < da - 1; i++) sa += String(i === 0 ? 1 + rnd(9) : rnd(10));
    sa += String(pr[0]);
    for(i = 0; i < db - 1; i++) sb += String(i === 0 ? 1 + rnd(9) : rnd(10));
    sb += String(pr[1]);
    A = BigInt(sa); Bq = BigInt(sb);
    return { a: A, b: Bq, op: "×", ans: A * Bq };
  }

  function genRaw(){
    var op = S.ops[rnd(S.ops.length)];
    return genRawFor(op);
  }

  // 按指定算子 + 该算子各自的位数出题
  function genRawFor(op){
    var da = S.dg[op].a, db = S.dg[op].b;
    var a, b, ans;

    if(op === "×" && S.carry) return genMul(da, db, S.carry);

    if(op === "+"){
      a = randBig(da); b = randBig(db); ans = a + b;
    } else if(op === "−"){
      a = randBig(da); b = randBig(db);
      if(a < b) return null;              // 不交换 A/B；调用方按所选位数重新抽样
      if(a === b){
        // a == b 不能出 a−a=0：优先把 a 加一；加一会涨位时改把 b 减一，都不许丢位数
        var a2 = a + BigInt(1), b2 = b - BigInt(1);
        if(a2.toString().length === a.toString().length){ a = a2; }
        else if(b2 >= BigInt(1) && b2.toString().length === b.toString().length){ b = b2; }
        else { a = a2; }
      }
      ans = a - b;
    } else if(op === "×"){
      a = randBigNoOne(da); b = randBigNoOne(db); ans = a * b;
    } else {
      var d = makeDiv(da, db);
      a = d.a; b = d.b; ans = d.ans;
    }
    return { a: a, b: b, op: op, ans: ans };
  }

  function exprText(q){ return q.a + " " + q.op + " " + q.b + " ="; }

  /* ---------------- 视图 ---------------- */
  function show(name){
    els.home.classList.toggle("active", name === "home");
    els.setup.classList.toggle("active", name === "setup");
    els.drill.classList.toggle("active", name === "drill");
    els.done.classList.toggle("active", name === "done");
    els.stats.classList.toggle("active", name === "stats");
    updateNavigation(name);
    if(name === "home") renderHomeStats();
    var view = { home: els.home, setup: els.setup, drill: els.drill, done: els.done, stats: els.stats }[name];
    var heading = view.querySelector("[data-view-heading]");
    if(heading) heading.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function toast(msg){
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function(){ els.toast.classList.remove("show"); }, 1400);
  }

  /* ---------------- 流程 ---------------- */
  function startRun(queue){
    if(!S.ops.length && !queue){ toast("请至少选择一个算子"); return; }
    S.i = 0; S.ok = 0; S.bad = 0; S.streak = 0; S.maxStreak = 0;
    S.times = []; S.wrong = [];
    if(queue){
      S.queue = queue;
    } else if(S.unlimited){
      if(!S.ops.some(isConfigValid)){ toast("当前算子与位数、进位规则无可用题目，请调整设置"); return; }
      S.queue = null;                    // 无限模式：随机出题
    } else {
      var qs = buildQueue();             // 按各题型题数铺好整套题
      if(!qs){ toast("请设置各题型题数（至少一种 > 0）"); return; }
      if(qs.error){ toast(qs.error); return; }
      S.queue = qs;
    }
    S.startAt = Date.now();
    S.log = [];
    S.reviewMode = "all";
    // 自适应从基准值重新起算；基准为 0（不限）时自适应不参与
    S.curShow = S.showMs > 0 ? Math.max(adaptFloor(), S.showMs) : 0;
    show("drill");
    nextQuestion();
  }

  function currentTotal(){ return S.queue ? S.queue.length : S.total; }

  function updateProgress(){
    var total = currentTotal();
    els.progressText.textContent = (S.i + 1) + (total ? " / " + total : "");
    var percent = total ? Math.min(100, S.i / total * 100) : 0;
    els.progressBar.style.width = percent + "%";
    UI.progress.setAttribute("aria-valuenow", String(Math.round(percent)));
    UI.progress.setAttribute("aria-valuetext", total ? "已完成 " + S.i + " / " + total + " 题" : "无限模式，已完成 " + S.i + " 题");
  }

  function nextQuestion(){
    var total = currentTotal();
    if(S.queue && S.i >= S.queue.length){ finish(); return; }
    if(!S.queue && total && S.i >= total){ finish(); return; }

    S.locked = false;
    S.qid++;
    var q = S.queue ? S.queue[S.i] : genQuestion();
    if(!q){ toast("当前设置无可用题目，请调整位数或进位规则"); show("home"); S.locked = true; return; }
    S.cur = q;

    els.qcard.classList.remove("good", "bad", "skip");
    els.qMark.textContent = "";
    els.qExpr.classList.remove("hidden");
    els.qExpr.textContent = exprText(q);
    fitEquation();
    els.answer.value = "";
    updateProgress();
    startTimer();
    scheduleHide();
  }

  function startTimer(){
    stopTimer();
    S.t0 = performance.now();
    var limit = S.limit;
    els.timerText.textContent = "0.0s";
    els.timerText.style.color = "";
    S.tick = setInterval(function(){
      var el2 = (performance.now() - S.t0) / 1000;
      if(limit > 0){
        var left = Math.max(0, limit - el2);
        els.timerText.textContent = "剩 " + left.toFixed(1) + "s";
        els.timerText.style.color = left <= 3 ? "var(--bad)" : "";
        if(left <= 0){ resolve(false, null, true); }
      } else {
        els.timerText.textContent = el2.toFixed(1) + "s";
      }
    }, 100);
  }

  function stopTimer(){ if(S.tick){ clearInterval(S.tick); S.tick = null; } }

  // 显示时长到了就把算式藏起来，逼着先记住再算
  // 自适应只有同时设了显示时长才可能生效，统一用这个判断，避免「开关是开、其实没跑」
  function adaptActive(){ return !!(S.adaptShow && S.showMs > 0); }

  // 自适应下限：既要不低于 20ms，也要保证「答对缩短」至少能真正迈出一步。
  // 若下限 >= 基准，答对后 ×0.8 会被下限顶回基准，表现为「开关是开、数字不动」。
  function adaptBase(){ return S.showMs || ADAPT_BASE; }
  function adaptMinMax(){
    var base = adaptBase();
    var oneStep = Math.round(base * 0.8 / 10) * 10;      // 至少给一步 0.8 的空间
    return Math.max(20, Math.min(1000, Math.min(base - 10, Math.max(20, oneStep))));
  }
  function adaptFloor(){ return Math.max(20, Math.min(S.adaptMin, adaptMinMax())); }

  function effectiveShow(){
    if(!S.showMs) return 0;
    if(adaptActive() && S.curShow > 0) return S.curShow;
    return S.showMs;
  }

  function scheduleHide(){
    clearTimeout(S.hideTimer);
    var ms = effectiveShow();
    els.showHint.textContent = ms ? " · " + ms + "ms" : "";
    if(!ms) return;
    var qid = S.qid;
    S.hideTimer = setTimeout(function(){
      if(qid !== S.qid || S.locked) return;
      els.qExpr.textContent = "？ ？ ？";
      els.qExpr.classList.add("hidden");
    }, ms);
  }

  function submit(){
    if(S.locked) return;
    // 后台标签页的 interval 可能被节流，提交时以真实经过时间判定截止。
    if(S.limit > 0 && performance.now() - S.t0 >= S.limit * 1000){
      resolve(false, null, true); return;
    }
    var raw = els.answer.value.trim().replace(/[,\s]/g, "");
    if(raw === ""){ return; }
    if(!/^\d+(\.\d+)?$/.test(raw)){ return; }            // 整数或小数
    var q = S.cur;
    var exact = false, approx = false;
    if(q.op === "÷"){
      // 商可能是小数（如 14.4），统一用数值比较
      var val = parseFloat(raw);
      if(!isFinite(val)) return;
      var ref = Number(q.ans);
      var diff = Math.abs(val - ref);
      exact = diff <= 1e-9;                              // 浮点极小误差视为相等
      if(!exact && S.divTol > 0 && ref > 0){
        if(diff <= ref * (S.divTol / 100)){ exact = true; approx = true; }  // 百分比容差
      }
    } else {
      var bval;
      try{ bval = BigInt(raw); }catch(e){ return; }
      exact = bval === q.ans;
    }
    resolve(exact, raw, false, approx);
  }

  function resolve(correct, userRaw, timeout, approx){
    if(S.locked) return;
    S.locked = true;
    stopTimer();
    clearTimeout(S.hideTimer);

    var used = (performance.now() - S.t0) / 1000;
    S.times.push(used);
    var q = S.cur;

    // 只记录，不反馈；最后在结算页统一公布
    S.log.push({
      expr: exprText(q),
      ans: q.ans.toString(),
      user: userRaw == null ? null : String(userRaw),
      ok: correct,
      approx: !!approx,
      timeout: !!timeout,
      skipped: userRaw === null && !timeout
    });

    if(correct){
      S.ok++; S.streak++;
      if(S.streak > S.maxStreak) S.maxStreak = S.streak;
    } else {
      S.bad++; S.streak = 0;
      S.wrong.push({ expr: exprText(q), ans: q.ans.toString(),
                     user: timeout ? "超时" : (userRaw === null ? "跳过" : userRaw) });
    }

    // 数据分析用的记录
    S.records.push({
      t: Date.now(), op: q.op,
      la: q.a.toString().length, lb: q.b.toString().length,
      ok: correct ? 1 : 0, sec: Math.round(used * 10) / 10,
      carry: carryInfo(q) ? 1 : 0
    });
    if(S.records.length > 2000) S.records.splice(0, S.records.length - 2000);
    saveRecords();

    // 自适应：答对缩短、答错延长（只影响下一题）
    if(adaptActive()){
      var cap = Math.min(10000, Math.max(S.showMs * 2, 3000));
      var floor = adaptFloor();                                   // 下限永远低于基准
      var nx = correct ? S.curShow * 0.8 : S.curShow * 1.3;
      nx = Math.round(nx / 10) * 10;
      S.curShow = Math.max(floor, Math.min(cap, nx));
    }

    // 答题中不显示对错反馈，保持盲测；结算页统一回顾。
    els.qcard.classList.remove("good", "bad", "skip");
    els.qMark.textContent = "";
    var resolvedQid = S.qid;
    setTimeout(function(){
      if(resolvedQid !== S.qid || !els.drill.classList.contains("active")) return;   // 已结束/退出则不再换题
      S.i++;
      nextQuestion();
    }, 1);
  }

  /* ---------------- 作答回顾 ---------------- */
  function setReviewMode(mode, silent){
    S.reviewMode = mode;
    var btns = els.reviewSeg.querySelectorAll("button");
    for(var i = 0; i < btns.length; i++){
      btns[i].classList.toggle("on", btns[i].getAttribute("data-v") === mode);
    }
    syncSelectionA11y();
    if(!silent) renderReview();
  }

  function renderReview(){
    var mode = S.reviewMode || "all";
    var rows = (S.log || []).filter(function(x){ return mode === "all" || !x.ok; });
    if(!rows.length){
      els.reviewList.innerHTML = '<div class="empty-stat">没有记录</div>';
      return;
    }
    var html = '<div class="review-row head"><span>题目</span><span>你的答案</span><span>正确答案</span></div>';
    for(var i = 0; i < rows.length; i++){
      var x = rows[i];
      var user = x.timeout ? "超时" : (x.skipped ? "跳过" : x.user);
      var mark = (x.ok && x.approx) ? "≈" : "";
      html += '<div class="review-row">'
            + '<span class="r-expr">' + x.expr + "</span>"
            + '<span class="r-user ' + (x.ok ? "ok" : "bad") + '">' + mark + user + "</span>"
            + '<span class="r-ans">' + x.ans + "</span>"
            + "</div>";
    }
    els.reviewList.innerHTML = html;
  }

  /* ---------------- 结算 ---------------- */
  function fmtTime(sec){
    if(sec == null || !isFinite(sec)) return "—";
    if(sec < 60) return sec.toFixed(1) + "s";
    var whole = Math.round(sec);
    return Math.floor(whole / 60) + "m" + (whole % 60) + "s";
  }

  function finish(){
    stopTimer();
    clearTimeout(S.hideTimer);
    S.qid++; // 使旧题的隐藏/换题回调失效
    S.locked = true;
    var done = S.ok + S.bad;
    var acc = done ? Math.round(S.ok / done * 100) : 0;
    var avg = S.times.length ? S.times.reduce(function(x, y){ return x + y; }, 0) / S.times.length : null;
    var fast = S.times.length ? S.times.reduce(function(best, sec){ return Math.min(best, sec); }, Infinity) : null;
    var totalSec = (Date.now() - S.startAt) / 1000;

    els.scoreBig.textContent = acc + "%";
    els.scoreSub.textContent = "答对 " + S.ok + " / " + done + " 题";
    els.kpiAvg.textContent = fmtTime(avg);
    els.kpiStreak.textContent = S.maxStreak;
    els.kpiFast.textContent = fmtTime(fast);
    els.kpiTotal.textContent = fmtTime(totalSec);

    if(S.log.length){
      els.wrongCard.style.display = "";
      setReviewMode(S.wrong.length ? "wrong" : "all", true);   // 默认只看错题
      renderReview();
      els.retryWrongBtn.style.display = S.wrong.length ? "" : "none";
    } else {
      els.wrongCard.style.display = "none";
      els.retryWrongBtn.style.display = "none";
    }
    show("done");
  }

  /* ---------------- 设置交互 ---------------- */
  els.opChips.addEventListener("click", function(e){
    var btn = e.target.closest(".chip");
    if(!btn) return;
    var op = btn.getAttribute("data-op");
    var idx = S.ops.indexOf(op);
    if(idx >= 0){ S.ops.splice(idx, 1); btn.classList.remove("on"); }
    else { S.ops.push(op); btn.classList.add("on"); }
    refreshTotal();
    updateHint();
  });

  function digitsText(){
    var sel = [];
    for(var i = 0; i < opsOrder.length; i++){
      if(S.ops.indexOf(opsOrder[i]) >= 0) sel.push(opsOrder[i]);
    }
    if(!sel.length) return "未设位数";
    var same = true, d0 = S.dg[sel[0]];
    for(var j = 1; j < sel.length; j++){
      if(S.dg[sel[j]].a !== d0.a || S.dg[sel[j]].b !== d0.b){ same = false; break; }
    }
    if(same) return "A " + d0.a + " 位 / B " + d0.b + " 位";
    return sel.map(function(op){ return op + S.dg[op].a + "/" + S.dg[op].b; }).join(" ");
  }

  function updateSummary(){
    if(!els.heroSummary) return;
    var ops = opsOrder.filter(function(op){ return S.ops.indexOf(op) >= 0; });
    els.heroSummary.textContent = ops.length ? ops.join(" ") : "未选择算子";
    var bits = [];
    bits.push(S.unlimited ? "无限题" : S.total + " 题");
    bits.push(S.limit ? S.limit + " 秒/题" : "不限时");
    bits.push(S.showMs ? "显示 " + S.showMs + "ms" + (adaptActive() ? "·自适应" : "") : "算式常显");
    if(S.carry === 1) bits.push("必须进位");
    if(S.carry === 2) bits.push("禁止进位");
    els.heroSub.textContent = digitsText() + " · " + bits.join(" · ");
    UI.count.textContent = S.unlimited ? "∞" : String(S.total);
    UI.countUnit.textContent = S.unlimited ? "自由练习" : "题 / 本轮";
    UI.digits.textContent = digitsText();
    UI.limit.textContent = S.limit ? S.limit + " 秒" : "不限时";
    UI.show.textContent = S.showMs ? S.showMs + "ms" + (adaptActive() ? " · 自适应" : "") : "一直显示";
    els.startBtn.disabled = !ops.length || (!S.unlimited && S.total === 0);
    syncSelectionA11y();
    saveSettings();
  }

  function updateHint(){
    if(!S.ops.length){ els.hint.textContent = "请在练习设置中选择至少一种运算。"; updateSummary(); return; }
    var t = "出题规则：" + S.ops.join(" ") + " · " + digitsText();
    if(S.ops.indexOf("÷") >= 0) t += " · 除法可出小数商";
    if(S.ops.indexOf("−") >= 0) t += " · 减法不出现负数";
    if(S.carry === 1) t += " · 每题必定进位/借位";
    if(S.carry === 2) t += " · 每题不含进位/借位";
    if(S.showMs) t += " · 算式 " + S.showMs + " ms 后隐藏";
    if(adaptActive()) t += "（答对缩短、答错延长，下限 " + adaptFloor() + "ms）";
    if(S.divTol > 0 && S.ops.indexOf("÷") >= 0) t += " · 除法容差 ±" + S.divTol + "%";
    els.hint.textContent = t;
    updateSummary();
  }

  function setFill(node){
    var min = +node.min, max = +node.max, v = +node.value;
    node.style.setProperty("--p", (max > min ? (v - min) / (max - min) * 100 : 0) + "%");
  }

  function applyDig(op, which, v, node, label){
    v = Math.max(1, Math.min(6, Math.floor(v)));
    S.dg[op][which] = v;
    label.textContent = "A " + S.dg[op].a + " 位 / B " + S.dg[op].b + " 位";
    setFill(node);
    updateHint();
  }

  var digCfg = [
    ["+", "digAAdd", "digBAdd", "digValAdd"],
    ["−", "digASub", "digBSub", "digValSub"],
    ["×", "digAMul", "digBMul", "digValMul"],
    ["÷", "digADiv", "digBDiv", "digValDiv"]
  ];
  digCfg.forEach(function(c){
    els[c[1]].addEventListener("input", function(){ applyDig(c[0], "a", +els[c[1]].value, els[c[1]], els[c[3]]); });
    els[c[2]].addEventListener("input", function(){ applyDig(c[0], "b", +els[c[2]].value, els[c[2]], els[c[3]]); });
  });

  function pickSeg(seg, btn){
    var btns = seg.querySelectorAll("button");
    for(var i = 0; i < btns.length; i++) btns[i].classList.remove("on");
    btn.classList.add("on");
    syncSelectionA11y();
  }

  function totalFromCnt(){
    if(S.unlimited) return 0;
    var sum = 0;
    for(var i = 0; i < opsOrder.length; i++){
      var op = opsOrder[i];
      if(S.ops.indexOf(op) >= 0) sum += (S.cnt[op] || 0);
    }
    return sum;
  }

  function refreshTotal(){
    S.total = totalFromCnt();
    els.totalVal.textContent = S.unlimited ? "无限" : (S.total ? "合计 " + S.total + " 题" : "合计 0 题");
    updateSummary();
  }

  function applyCnt(op, v){
    if(isNaN(v) || v < 0) v = 0;
    if(v > 999) v = 999;
    S.cnt[op] = Math.floor(v);
    refreshTotal();
  }

  var cntCfg = [["+", "cntAdd"], ["−", "cntSub"], ["×", "cntMul"], ["÷", "cntDiv"]];
  cntCfg.forEach(function(c){
    els[c[1]].addEventListener("input", function(){ applyCnt(c[0], parseInt(els[c[1]].value, 10) || 0); });
  });

  els.unlimited.addEventListener("change", function(){
    S.unlimited = els.unlimited.checked;
    refreshTotal();
  });

  function applyLimit(v){
    if(isNaN(v) || v < 0) v = 0;
    if(v > 600) v = 600;
    if(v > 0 && v < 1) v = 1;
    v = Math.round(v * 10) / 10;
    S.limit = v;
    els.limitVal.textContent = v ? v + " 秒" : "不限时";
    updateSummary();
  }

  els.limitSeg.addEventListener("click", function(e){
    var b = e.target.closest("button[data-v]");
    if(!b) return;
    pickSeg(els.limitSeg, b);
    if(b.getAttribute("data-v") === "custom"){
      els.limitCustom.classList.add("show");
      els.limitInput.focus();
      if(els.limitInput.value !== "") applyLimit(parseFloat(els.limitInput.value));
      return;
    }
    els.limitCustom.classList.remove("show");
    applyLimit(+b.getAttribute("data-v"));
  });

  els.limitInput.addEventListener("input", function(){
    applyLimit(parseFloat(els.limitInput.value) || 0);
  });

  /* ---------------- 内置键盘 ---------------- */
  var pendingClicks = 0, suppressTimer = null;

  function pressKey(key){
    if(!key || S.locked) return false;
    var k = key.getAttribute("data-k");
    var v = els.answer.value;
    if(k === "back"){ els.answer.value = v.slice(0, -1); }
    else if(k === "clear"){ els.answer.value = ""; }
    else if(v.length < 24){
      // 小数点：不能开头、不能重复
      if(k === "." && (v === "" || v.indexOf(".") > -1)) return true;
      els.answer.value = v + k;
    }
    return true;
  }

  // 按下即录入：连点同一个数字也立刻响应，且不会触发双击缩放
  els.keypad.addEventListener("pointerdown", function(e){
    var key = e.target && e.target.closest ? e.target.closest(".key") : null;
    if(!key) return;
    e.preventDefault();          // 阻止默认手势（双击缩放 / 长按选择）
    pressKey(key);
    pendingClicks++;             // 这次按压对应的 click 稍后要忽略
    clearTimeout(suppressTimer);
    suppressTimer = setTimeout(function(){ pendingClicks = 0; }, 1200);
  });

  // 兼容：键盘（Tab + 回车/空格）与不支持 pointer 事件的旧浏览器
  els.keypad.addEventListener("click", function(e){
    if(pendingClicks > 0){       // 已由同一次按压录入，忽略配对 click
      pendingClicks--;
      return;
    }
    pressKey(e.target && e.target.closest ? e.target.closest(".key") : null);
  });

  // Repeated keypad taps stay immediate; page-level pinch zoom remains available.
  els.keypad.addEventListener("dblclick", function(e){ e.preventDefault(); });

  els.startBtn.addEventListener("click", function(){ startRun(null); });
  els.openSettings.addEventListener("click", function(){ show("setup"); });
  els.settingsBack.addEventListener("click", function(){ show("home"); });
  els.settingsDone.addEventListener("click", function(){ show("home"); });
  els.submitBtn.addEventListener("click", submit);
  els.skipBtn.addEventListener("click", function(){ if(!S.locked) resolve(false, null, false); });
  els.quitBtn.addEventListener("click", finish);
  els.againBtn.addEventListener("click", function(){ startRun(null); });
  els.reviewSeg.addEventListener("click", function(e){
    var b = e.target.closest("button[data-v]");
    if(!b) return;
    setReviewMode(b.getAttribute("data-v"));
  });

  els.backBtn.addEventListener("click", function(){ show("home"); });

  els.retryWrongBtn.addEventListener("click", function(){
    var qs = S.wrong.map(function(w){
      var m = w.expr.match(/^(\d+)\s+([+\-−×÷])\s+(\d+)\s*=/);
      if(!m) return null;
      var a = BigInt(m[1]), b = BigInt(m[3]), op = m[2];
      var ans = op === "+" ? a + b : op === "−" ? a - b : op === "×" ? a * b : Number(a) / Number(b);
      return { a: a, b: b, op: op, ans: ans };
    }).filter(Boolean);
    if(!qs.length){ toast("没有可重练的错题"); return; }
    startRun(qs);
  });

  // 物理键盘（桌面端）
  document.addEventListener("keydown", function(e){
    if(!els.drill.classList.contains("active")) return;
    if(S.locked || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    if(["Backspace", "Enter", "Escape", "."].indexOf(e.key) !== -1 || /^[0-9]$/.test(e.key)) e.preventDefault();
    if(e.key >= "0" && e.key <= "9"){
      if(els.answer.value.length < 24) els.answer.value += e.key;
    } else if(e.key === "Backspace"){
      els.answer.value = els.answer.value.slice(0, -1);
    } else if(e.key === "."){
      var v = els.answer.value;
      if(v !== "" && v.indexOf(".") === -1 && v.length < 24) els.answer.value = v + ".";
    } else if(e.key === "Enter"){
      submit();
    } else if(e.key === "Escape"){
      els.answer.value = "";
    }
  });

  els.themeBtn.addEventListener("click", function(){
    var next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    applyTheme(next, true);
  });

  UI.nav.home.addEventListener("click", function(){ if(document.body.dataset.view !== "drill") show("home"); });
  UI.nav.setup.addEventListener("click", function(){ if(document.body.dataset.view !== "drill") show("setup"); });
  UI.nav.stats.addEventListener("click", function(){
    if(document.body.dataset.view === "drill") return;
    renderStats(); show("stats");
  });
  cntCfg.forEach(function(c){
    els[c[1]].addEventListener("blur", function(){ els[c[1]].value = S.cnt[c[0]]; });
  });
  els.limitInput.addEventListener("blur", function(){ els.limitInput.value = S.limit || ""; });
  els.showInput.addEventListener("blur", function(){ els.showInput.value = S.showMs || ""; });
  var resizeFrame = 0;
  window.addEventListener("resize", function(){
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(fitEquation);
  });

  /* ---------------- 数据分析 ---------------- */
  function loadRecords(){
    try{
      var raw = localStorage.getItem("drill.records.v1");
      var parsed = raw ? JSON.parse(raw) : [];
      S.records = Array.isArray(parsed) ? parsed.filter(function(r){
        return r && typeof r === "object"
          && Number.isFinite(r.t) && r.t >= 0 && r.t <= 8640000000000000
          && opsOrder.indexOf(r.op) !== -1
          && Number.isInteger(r.la) && r.la >= 1 && r.la <= 6
          && Number.isInteger(r.lb) && r.lb >= 1 && r.lb <= 6
          && (r.ok === 0 || r.ok === 1)
          && Number.isFinite(r.sec) && r.sec >= 0
          && (r.carry === 0 || r.carry === 1);
      }).slice(-2000) : [];
    }catch(e){ S.records = []; }
  }

  function saveRecords(){
    try{ localStorage.setItem("drill.records.v1", JSON.stringify(S.records)); }catch(e){}
  }

  function dayKey(ts){
    var d = new Date(ts);
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  function fmtClock(ts){
    var d = new Date(ts);
    return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
  }

  function fmtDur(sec){
    if(!sec) return "0s";
    var whole = Math.round(sec);
    if(sec >= 3600) return Math.floor(sec / 3600) + "h" + Math.round((sec % 3600) / 60) + "m";
    if(whole < 60) return whole + "s";
    return Math.floor(whole / 60) + "m" + (whole % 60) + "s";
  }

  function statRow(name, okN, total, avgSec){
    var pctv = total ? Math.round(okN / total * 100) : 0;
    var right = total
      ? pctv + "% · " + total + "题 · " + (avgSec != null ? avgSec.toFixed(1) + "s" : "—")
      : "—";
    return '<div class="stat-row"><span class="nm">' + name + "</span>"
      + '<span class="track"><i class="fill' + (total && pctv < 60 ? " warn" : "") + '" style="width:'
      + (total ? Math.max(3, pctv) : 0) + '%"></i></span>'
      + '<span class="vl">' + right + "</span></div>";
  }

  function distRow(name, cnt, total){
    var pctv = total ? Math.round(cnt / total * 100) : 0;
    return '<div class="stat-row"><span class="nm">' + name + "</span>"
      + '<span class="track"><i class="fill" style="width:' + (total ? Math.max(3, pctv) : 0) + '%"></i></span>'
      + '<span class="vl">' + cnt + " 题 · " + pctv + "%</span></div>";
  }

  function rangeStart(){
    if(S.stRange === "1"){
      var d = new Date(); d.setHours(0, 0, 0, 0);
      return d.getTime();
    }
    if(S.stRange === "7") return Date.now() - 7 * 86400000;
    return 0;
  }

  function renderStats(){
    var from = rangeStart();
    var R = (S.records || []).filter(function(r){ return r.t >= from; });
    R.sort(function(x, y){ return x.t - y.t; });
    var n = R.length;

    var okN = 0, secSum = 0, wrongN = 0, daysSet = {}, bestStreak = 0, curStreak = 0;
    var okSec = 0, okCnt = 0, badSec = 0, badCnt = 0;
    for(var i = 0; i < n; i++){
      var r = R[i];
      if(r.ok){
        okN++; okSec += r.sec || 0; okCnt++;
        curStreak++; if(curStreak > bestStreak) bestStreak = curStreak;
      } else {
        wrongN++; badSec += r.sec || 0; badCnt++;
        curStreak = 0;
      }
      secSum += r.sec || 0;
      daysSet[dayKey(r.t)] = 1;
    }

    els.stAcc.textContent = n ? Math.round(okN / n * 100) + "%" : "—";
    els.stSub.textContent = n
      ? "答对 " + okN + " / " + n + " 题" + (okN === n ? " · 全对！" : " · 错 " + wrongN + " 题")
      : "该范围内还没有练习记录";
    els.stTotal.textContent = n;
    els.stAvg.textContent = n ? fmtTime(secSum / n) : "—";
    els.stDur.textContent = n ? fmtDur(secSum) : "—";
    els.stDays.textContent = Object.keys(daysSet).length;
    els.stStreak.textContent = bestStreak;
    els.stWrong.textContent = wrongN;

    /* 最近 10 次练习（间隔 > 5 分钟算新的一次） */
    var sessions = [], cur = null;
    for(var i2 = 0; i2 < n; i2++){
      if(!cur || R[i2].t - cur.end > 5 * 60000){
        cur = { start: R[i2].t, end: R[i2].t, n: 0, ok: 0 };
        sessions.push(cur);
      }
      cur.end = R[i2].t; cur.n++;
      if(R[i2].ok) cur.ok++;
    }
    var last = sessions.slice(-10), sh = "";
    for(var s2 = 0; s2 < last.length; s2++){
      var ss = last[s2], acc2 = Math.round(ss.ok / ss.n * 100);
      var d2 = new Date(ss.start);
      sh += '<div class="bar" role="listitem" tabindex="0" aria-label="' + ss.n + " 题，正确率 " + acc2 + '%" title="' + (d2.getMonth() + 1) + "/" + d2.getDate() + " " + fmtClock(ss.start)
          + " · " + ss.n + " 题 · 正确率 " + acc2 + '%">'
          + '<i style="height:' + Math.max(4, acc2) + '%"></i>'
          + "<span>" + acc2 + "%</span></div>";
    }
    els.stSessions.innerHTML = sh || '<div class="empty-stat" style="grid-column:1/-1">暂无练习</div>';

    /* 按算子 */
    var ops = ["+", "−", "×", "÷"], ohtml = "";
    for(var k = 0; k < ops.length; k++){
      var o = ops[k], tot = 0, good = 0, secs = 0;
      for(var j = 0; j < n; j++){
        if(R[j].op === o){ tot++; secs += R[j].sec || 0; if(R[j].ok) good++; }
      }
      ohtml += statRow(o, good, tot, tot ? secs / tot : null);
    }
    els.stOps.innerHTML = ohtml;

    /* 进位 / 借位 */
    var c1t = 0, c1o = 0, c1s = 0, c0t = 0, c0o = 0, c0s = 0;
    for(var j2 = 0; j2 < n; j2++){
      if(R[j2].carry){ c1t++; c1s += R[j2].sec || 0; if(R[j2].ok) c1o++; }
      else { c0t++; c0s += R[j2].sec || 0; if(R[j2].ok) c0o++; }
    }
    els.stCarry.innerHTML = statRow("有进位", c1o, c1t, c1t ? c1s / c1t : null)
                          + statRow("无进位", c0o, c0t, c0t ? c0s / c0t : null);

    /* 用时分布 */
    var tb = [0, 0, 0, 0], tlabels = ["2 秒内", "2-5 秒", "5-10 秒", "10 秒以上"];
    for(var j3 = 0; j3 < n; j3++){
      var sec = R[j3].sec || 0;
      var ti = sec < 2 ? 0 : sec < 5 ? 1 : sec < 10 ? 2 : 3;
      tb[ti]++;
    }
    var th = "";
    for(var t2 = 0; t2 < 4; t2++) th += distRow(tlabels[t2], tb[t2], n);
    els.stTime.innerHTML = th;
    els.stTimeNote.textContent = n
      ? "答对平均 " + (okCnt ? (okSec / okCnt).toFixed(1) : "—") + "s"
        + "　|　答错平均 " + (badCnt ? (badSec / badCnt).toFixed(1) : "—") + "s"
        + (badCnt && okCnt && badSec / badCnt > (okSec / okCnt) * 1.2
            ? "　→ 错误题明显更慢，注意熟练度" : "")
      : "";

    /* 难度分桶 */
    var labels = ["≤4 位", "5-8 位", "9-12 位", ">12 位"];
    var bt = [0, 0, 0, 0], bo = [0, 0, 0, 0], bs = [0, 0, 0, 0];
    for(var j4 = 0; j4 < n; j4++){
      var sum = (R[j4].la || 0) + (R[j4].lb || 0);
      var bi = sum <= 4 ? 0 : sum <= 8 ? 1 : sum <= 12 ? 2 : 3;
      bt[bi]++; bs[bi] += R[j4].sec || 0;
      if(R[j4].ok) bo[bi]++;
    }
    var lh = "";
    for(var b2 = 0; b2 < 4; b2++) lh += statRow(labels[b2], bo[b2], bt[b2], bt[b2] ? bs[b2] / bt[b2] : null);
    els.stLen.innerHTML = lh;

    /* 最近 7 天 */
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var series = [], maxN = 1;
    for(var d = 6; d >= 0; d--){
      var dt = new Date(today.getTime() - d * 86400000);
      var key = dayKey(dt.getTime());
      var cnt = 0, cc = 0;
      for(var j5 = 0; j5 < n; j5++){
        if(dayKey(R[j5].t) === key){ cnt++; if(R[j5].ok) cc++; }
      }
      if(cnt > maxN) maxN = cnt;
      series.push({ label: (dt.getMonth() + 1) + "/" + dt.getDate(), cnt: cnt, acc: cnt ? Math.round(cc / cnt * 100) : 0 });
    }
    var wh = "";
    for(var q2 = 0; q2 < series.length; q2++){
      var it = series[q2];
      var hgt = it.cnt ? Math.max(8, Math.round(it.cnt / maxN * 100)) : 3;
      wh += '<div class="bar" role="listitem" tabindex="0" aria-label="' + it.label + "，练习 " + it.cnt + ' 题" title="' + it.label + "：" + it.cnt + " 题"
          + (it.cnt ? "，正确率 " + it.acc + "%" : "") + '">'
          + '<i style="height:' + hgt + "%" + (it.cnt ? "" : ";opacity:.22") + '"></i>'
          + "<span>" + it.label + "</span></div>";
    }
    els.stTrend.innerHTML = wh;
  }

  /* ---------------- 设置 / 统计事件 ---------------- */
  els.carrySeg.addEventListener("click", function(e){
    var b = e.target.closest("button[data-v]");
    if(!b) return;
    var btns = els.carrySeg.querySelectorAll("button");
    for(var i = 0; i < btns.length; i++) btns[i].classList.remove("on");
    b.classList.add("on");
    S.carry = +b.getAttribute("data-v");
    els.carryVal.textContent = ["不限", "必须进位", "禁止进位"][S.carry];
    updateHint();
  });

  function applyShow(v){
    if(isNaN(v) || v < 0) v = 0;
    if(v > 60000) v = 60000;
    if(v > 0 && v < 50) v = 50;
    S.showMs = Math.round(v);
    els.showVal.textContent = S.showMs ? S.showMs + " ms" : "不限";
    // 显示时长回到「不限」时自适应无法运行；同步状态与界面，避免「开关看着是开、其实没跑」
    if(!S.showMs && S.adaptShow){
      S.adaptShow = false;
      if(els.adaptShow) els.adaptShow.checked = false;
    }
    if(S.adaptShow) clampAdaptMin();
    syncAdaptMin();
    updateHint();
  }

  els.divTol.addEventListener("input", function(){
    S.divTol = parseFloat(els.divTol.value);
    els.divTolVal.textContent = S.divTol ? "±" + S.divTol + "%" : "0%（精确）";
    setFill(els.divTol);
    updateHint();
  });

  els.showSeg.addEventListener("click", function(e){
    var b = e.target.closest("button[data-v]");
    if(!b) return;
    pickSeg(els.showSeg, b);
    if(b.getAttribute("data-v") === "custom"){
      els.showCustom.classList.add("show");
      els.showInput.focus();
      if(els.showInput.value !== "") applyShow(parseInt(els.showInput.value, 10));
      return;
    }
    els.showCustom.classList.remove("show");
    applyShow(+b.getAttribute("data-v"));
  });

  els.showInput.addEventListener("input", function(){
    applyShow(parseInt(els.showInput.value, 10) || 0);
  });

  function setShowPreset(v){
    var btns = els.showSeg.querySelectorAll("button");
    for(var i = 0; i < btns.length; i++){
      btns[i].classList.toggle("on", btns[i].getAttribute("data-v") === String(v));
    }
    els.showCustom.classList.remove("show");
    syncSelectionA11y();
  }

  // 下限滑杆的上限跟着基准走：下限永远低于基准，否则「答对缩短」会被下限顶回去
  function adaptMinRange(){ return Math.max(20, adaptMinMax()); }

  function clampAdaptMin(){
    // 只约束到合法区间 [20, 1000]，不跟随基准压缩：
    // S.adaptMin 记的是「用户想要的下限」，实际生效值由 adaptFloor() 按基准截断，
    // 这样把显示时长调短再调回来，用户原来的下限不会丢。
    if(S.adaptMin > 1000) S.adaptMin = 1000;
    if(S.adaptMin < 20) S.adaptMin = 20;
  }

  function syncAdaptMin(){
    var hi = adaptMinRange();                       // 滑杆上限跟随基准
    els.adaptMin.max = hi;
    var shown = Math.min(S.adaptMin, hi);           // 滑杆只能停在生效值上
    els.adaptMin.value = shown;
    els.adaptMinBox.style.display = adaptActive() ? "" : "none";
    els.adaptMinVal.textContent = shown + " ms" + (shown < S.adaptMin ? "（受显示时长限制）" : "");
    setFill(els.adaptMin);
    // 开关与实际是否生效保持一致
    if(els.adaptShow && els.adaptShow.checked !== S.adaptShow) els.adaptShow.checked = S.adaptShow;
  }

  els.adaptMin.addEventListener("input", function(){
    S.adaptMin = +els.adaptMin.value;
    syncAdaptMin();
    updateHint();
  });

  els.adaptShow.addEventListener("change", function(){
    S.adaptShow = els.adaptShow.checked;
    if(S.adaptShow && !S.showMs){        // 没设显示时长时，自适应给个基准
      applyShow(ADAPT_BASE);
      setShowPreset(ADAPT_BASE);
    }
    clampAdaptMin();
    syncAdaptMin();
    updateHint();
  });

  els.stRange.addEventListener("click", function(e){
    var b = e.target.closest("button[data-v]");
    if(!b) return;
    var btns = els.stRange.querySelectorAll("button");
    for(var i = 0; i < btns.length; i++) btns[i].classList.remove("on");
    b.classList.add("on");
    S.stRange = b.getAttribute("data-v");
    syncSelectionA11y();
    renderStats();
  });

  els.statsBtn.addEventListener("click", function(){
    renderStats();
    show("stats");
  });

  els.stBack.addEventListener("click", function(){ show("home"); });

  els.stClear.addEventListener("click", function(){
    if(!S.records.length){ toast("还没有数据"); return; }
    var yes = !window.confirm || window.confirm("确定清空全部练习数据？此操作不可恢复。");
    if(yes){ S.records = []; saveRecords(); renderStats(); toast("数据已清空"); }
  });

  els.stExport.addEventListener("click", function(){
    if(!S.records.length){ toast("还没有数据"); return; }
    var from = rangeStart();
    var records = S.records.filter(function(r){ return r.t >= from; });
    if(!records.length){ toast("当前范围内还没有数据"); return; }
    var rows = [["时间", "算子", "A位数", "B位数", "进位", "是否正确", "用时(秒)"]];
    for(var i = 0; i < records.length; i++){
      var r = records[i];
      rows.push([new Date(r.t).toLocaleString(), r.op, r.la, r.lb,
                 r.carry ? "有" : "无", r.ok ? "对" : "错", r.sec]);
    }
    var csv = "\ufeff" + rows.map(function(x){
      return x.map(function(cell){ return '"' + String(cell).replace(/"/g, '""') + '"'; }).join(",");
    }).join("\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var link = document.createElement("a");
    var url = URL.createObjectURL(blob);
    link.href = url;
    link.download = "math-drill-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    toast("已导出当前范围的 " + records.length + " 条记录");
  });

  /* ---------------- 初始化 ---------------- */
  (function init(){
    applyTheme(document.documentElement.getAttribute("data-theme") || "light", false);
    loadSettings();
    hydrateSettingsControls();
    loadRecords();
    UI.ready = true;
    refreshTotal();
    updateHint();
    renderHomeStats();
    updateNavigation("home");
    var today = new Date();
    UI.date.textContent = today.toLocaleDateString("zh-CN", { month: "long", day: "numeric" })
      + " · " + ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][today.getDay()];
  })();
})();
