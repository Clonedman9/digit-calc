(function(){
  "use strict";

  var Core = window.DigitCalcCore;

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
    timeTotal: 0, timeCount: 0, fastest: Infinity, wrong: [], log: [], queue: null,
    reviewBuffer: null, reviewLimit: 2000, nextTimer: null, deadlineTimer: null, hideAt: 0,
    reviewMode: "all",
    cur: null, locked: true, qid: 0, t0: 0, tick: null, startClock: 0
  };

  var opsOrder = Core.OPS;   // 运算符固定顺序
  var ADAPT_BASE = 2000;                  // 自适应兜底基准（显示时长设为「不限」时用）

  // Presentation state stays separate from the question engine.
  var UI = {
    ready: false, selectionButtons: Array.from(document.querySelectorAll(".chip, .seg button[data-v]")),
    operationRows: Array.from(document.querySelectorAll(".operation-setting")),
    recordsVersion: 0, statsCache: new Map(), lastStatsRender: null, reviewRows: [], reviewCursor: 0,
    reviewNote: $("reviewNote"),
    nav: { home: $("navHome"), setup: $("navSetup"), stats: $("navStats") },
    title: $("pageTitle"), progress: $("runProgress"),
    count: $("homeQuestionCount"), countUnit: $("homeQuestionUnit"),
    digits: $("homeDigits"), limit: $("homeLimit"), show: $("homeShow"),
    total: $("homeTotal"), accuracy: $("homeAccuracy"), average: $("homeAverage"),
    averageUnit: $("homeAverageUnit"), today: $("homeToday"), date: $("todayLabel")
  };

  var persistence = {
    settingsTimer: null, recordsTimer: null, settingsJSON: null, recordsDirty: false
  };

  function saveSettings(){
    clearTimeout(persistence.settingsTimer);
    persistence.settingsTimer = null;
    if(!UI.ready) return;
    try{
      var value = JSON.stringify({
        ops: S.ops, dg: S.dg, cnt: S.cnt, unlimited: S.unlimited,
        limit: S.limit, carry: S.carry, divTol: S.divTol,
        showMs: S.showMs, adaptShow: S.adaptShow, adaptMin: S.adaptMin
      });
      if(value === persistence.settingsJSON) return;
      localStorage.setItem("drill.settings.v1", value);
      persistence.settingsJSON = value;
    }catch(e){}
  }

  function scheduleSettingsSave(){
    if(!UI.ready) return;
    clearTimeout(persistence.settingsTimer);
    persistence.settingsTimer = setTimeout(saveSettings, 180);
  }

  function scheduleRecordsSave(){
    persistence.recordsDirty = true;
    if(persistence.recordsTimer === null) persistence.recordsTimer = setTimeout(saveRecords, 500);
  }

  function flushPersistence(){
    saveSettings();
    saveRecords();
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
    UI.selectionButtons.forEach(function(btn){
      var value = String(btn.classList.contains("on"));
      if(btn.getAttribute("aria-pressed") !== value) btn.setAttribute("aria-pressed", value);
    });
    UI.operationRows.forEach(function(row){
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

  function markStatsDirty(){
    UI.recordsVersion++;
    UI.statsCache.clear();
    UI.lastStatsRender = null;
  }

  function getStats(range){
    var now = Date.now(), key = UI.recordsVersion + ":" + range + ":" + Core.dayKey(now);
    var cached = UI.statsCache.get(key);
    if(cached && now < cached.expires) return cached.stats;
    var stats = Core.aggregateRecords(S.records, Core.rangeStart(range, now), now);
    var midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
    var expires = midnight.getTime();
    // A rolling seven-day cache expires exactly after its earliest included record ages out.
    if(range === "7" && stats.records.length) expires = Math.min(expires, stats.records[0].t + 7 * 86400000 + 1);
    if(UI.statsCache.size >= 3 && !UI.statsCache.has(key)) UI.statsCache.clear();
    UI.statsCache.set(key, { stats: stats, expires: expires });
    return stats;
  }

  function renderHomeStats(){
    var stats = getStats("all"), today = stats.byDay.get(Core.dayKey(Date.now()));
    UI.total.textContent = String(stats.n);
    UI.accuracy.textContent = stats.n ? Math.round(stats.ok / stats.n * 100) + "%" : "—";
    UI.average.textContent = stats.n ? (stats.sec / stats.n).toFixed(1) : "—";
    UI.averageUnit.textContent = stats.n ? "秒" : "";
    UI.today.textContent = today && today.n ? "今天已练习 " + today.n + " 题" : "今天还未开始";
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
    if(!width) return;
    if(natural > width && width > 0){
      var size = parseFloat(window.getComputedStyle(els.qExpr).fontSize);
      els.qExpr.style.fontSize = Math.max(16, Math.floor(size * width / natural)) + "px";
    }
  }

  /* ---------------- Pure-core adapters ---------------- */
  function carryInfo(q){ return Core.carryInfo(q); }
  function isConfigValid(op){ return Core.isConfigValid(S, op); }
  function genForMode(op){ return Core.generateFor(S, op); }
  function genQuestion(){ return Core.generateQuestion(S); }
  function buildQueue(){ return Core.buildSchedule(S); }

  function exprText(q){ return q.a + " " + q.op + " " + q.b + " ="; }

  /* ---------------- 视图 ---------------- */
  function show(name){
    if(UI.ready && name !== "drill") flushPersistence();
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
    var nextQueue = queue || null;
    if(!queue && S.unlimited){
      if(!S.ops.some(isConfigValid)){ toast("当前算子与位数、进位规则无可用题目，请调整设置"); return; }
    } else if(!queue){
      nextQueue = buildQueue();
      if(!nextQueue){ toast("请设置各题型题数（至少一种 > 0）"); return; }
      if(nextQueue.error){ toast(nextQueue.error); return; }
    }
    stopTimer();
    clearTimeout(S.hideTimer); clearTimeout(S.nextTimer);
    S.qid++;
    S.queue = nextQueue;
    S.i = 0; S.ok = 0; S.bad = 0; S.streak = 0; S.maxStreak = 0;
    S.timeTotal = 0; S.timeCount = 0; S.fastest = Infinity;
    S.wrong = []; S.log = [];
    UI.reviewRows = []; UI.reviewCursor = 0;
    pendingPointerClicks.clear();
    S.reviewLimit = nextQueue ? Math.max(1, nextQueue.length) : Core.RECORD_LIMIT;
    S.reviewBuffer = Core.createRingBuffer(S.reviewLimit);
    S.startClock = performance.now();
    S.reviewMode = "all";
    S.curShow = S.showMs > 0 ? Math.max(adaptFloor(), S.showMs) : 0;
    saveSettings();
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

    S.qid++;
    var item = S.queue && S.queue[S.i];
    var q = item ? (typeof item === "string" ? genForMode(item) : item) : genQuestion();
    if(!q){ S.locked = true; stopTimer(); toast("当前设置无可用题目，请调整位数或进位规则"); show("home"); return; }
    S.cur = q;
    S.locked = false;

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

  function updateTimer(){
    if(S.locked || !els.drill.classList.contains("active")) return;
    var elapsed = (performance.now() - S.t0) / 1000;
    var left = S.limit > 0 ? Math.max(0, S.limit - elapsed) : 0;
    var text = S.limit > 0 ? "剩 " + left.toFixed(1) + "s" : elapsed.toFixed(1) + "s";
    if(els.timerText.textContent !== text) els.timerText.textContent = text;
    els.timerText.style.color = S.limit > 0 && left <= 3 ? "var(--bad)" : "";
    if(S.limit > 0 && left <= 0) resolve(false, null, true);
  }

  function startTimer(){
    stopTimer();
    S.t0 = performance.now();
    updateTimer();
    if(!document.hidden) S.tick = setInterval(updateTimer, 100);
    if(S.limit > 0){
      var qid = S.qid;
      function checkDeadline(){
        S.deadlineTimer = null;
        if(qid !== S.qid || S.locked) return;
        updateTimer();
        if(!S.locked){
          var remaining = S.limit * 1000 - (performance.now() - S.t0);
          S.deadlineTimer = setTimeout(checkDeadline, Math.max(1, Math.ceil(remaining)));
        }
      }
      S.deadlineTimer = setTimeout(checkDeadline, S.limit * 1000);
    }
  }

  function stopTimer(){
    if(S.tick !== null){ clearInterval(S.tick); S.tick = null; }
    if(S.deadlineTimer !== null){ clearTimeout(S.deadlineTimer); S.deadlineTimer = null; }
  }

  function reconcileVisibility(){
    if(document.hidden){
      flushPersistence();
      if(S.tick !== null){ clearInterval(S.tick); S.tick = null; }
      return;
    }
    if(S.locked || !els.drill.classList.contains("active")) return;
    updateTimer();
    if(S.locked) return;
    if(S.hideAt && performance.now() >= S.hideAt && !els.qExpr.classList.contains("hidden")) hideEquation();
    if(S.tick === null) S.tick = setInterval(updateTimer, 100);
  }

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

  function hideEquation(){
    if(S.locked) return;
    els.qExpr.textContent = "？ ？ ？";
    els.qExpr.classList.add("hidden");
  }

  function scheduleHide(){
    clearTimeout(S.hideTimer);
    S.hideTimer = null;
    var ms = effectiveShow();
    S.hideAt = ms ? performance.now() + ms : 0;
    els.showHint.textContent = ms ? " · " + ms + "ms" : "";
    if(!ms) return;
    var qid = S.qid;
    S.hideTimer = setTimeout(function(){
      if(qid === S.qid) hideEquation();
    }, ms);
  }

  function submit(){
    if(S.locked) return;
    if(S.limit > 0 && performance.now() - S.t0 >= S.limit * 1000){
      resolve(false, null, true); return;
    }
    var result = Core.gradeAnswer(S.cur, els.answer.value, S.divTol);
    if(result.valid) resolve(result.correct, result.raw, false, result.approx);
  }

  function resolve(correct, userRaw, timeout, approx){
    if(S.locked) return;
    S.locked = true;
    stopTimer();
    clearTimeout(S.hideTimer);

    var used = Math.max(0, (performance.now() - S.t0) / 1000);
    // Skip and timeout share the same real deadline, even when browser timers are throttled.
    if(S.limit > 0 && used >= S.limit){
      correct = false; userRaw = null; timeout = true; approx = false;
      used = S.limit;
    }
    S.timeTotal += used; S.timeCount++; S.fastest = Math.min(S.fastest, used);
    var q = S.cur;

    // One bounded review copy, with the original question retained for exact retries.
    S.reviewBuffer.push({
      question: q,
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
    }

    // 数据分析用的记录
    S.records.push({
      t: Date.now(), op: q.op,
      la: q.a.toString().length, lb: q.b.toString().length,
      ok: correct ? 1 : 0, sec: Math.round(used * 10) / 10,
      carry: carryInfo(q) ? 1 : 0
    });
    if(S.records.length > Core.RECORD_LIMIT) S.records.shift();
    markStatsDirty();
    scheduleRecordsSave();

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
    S.nextTimer = setTimeout(function(){
      S.nextTimer = null;
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

  function appendReviewRows(){
    var more = els.reviewList.querySelector("[data-review-more]");
    if(more) more.remove();
    var end = Math.min(UI.reviewCursor + 100, UI.reviewRows.length), html = [];
    for(; UI.reviewCursor < end; UI.reviewCursor++){
      var x = UI.reviewRows[UI.reviewCursor];
      var user = x.timeout ? "超时" : (x.skipped ? "跳过" : x.user);
      var mark = x.ok && x.approx ? "≈" : "";
      html.push('<div class="review-row"><span class="r-expr">' + Core.escapeHTML(x.expr)
        + '</span><span class="r-user ' + (x.ok ? "ok" : "bad") + '">' + mark + Core.escapeHTML(user)
        + '</span><span class="r-ans">' + Core.escapeHTML(x.ans) + '</span></div>');
    }
    els.reviewList.insertAdjacentHTML("beforeend", html.join(""));
    if(UI.reviewCursor < UI.reviewRows.length){
      var button = document.createElement("button");
      button.className = "btn ghost review-more";
      button.setAttribute("data-review-more", "");
      button.textContent = "加载更多 · 剩余 " + (UI.reviewRows.length - UI.reviewCursor) + " 题";
      els.reviewList.appendChild(button);
    }
  }

  function renderReview(){
    var mode = S.reviewMode || "all";
    UI.reviewRows = S.log.filter(function(x){ return mode === "all" || !x.ok; });
    UI.reviewCursor = 0;
    els.reviewList.scrollTop = 0;
    UI.reviewNote.hidden = S.timeCount <= S.log.length;
    UI.reviewNote.textContent = UI.reviewNote.hidden ? "" : "已完成 " + S.timeCount + " 题；逐题回顾保留最近 " + S.reviewLimit + " 题。";
    if(!UI.reviewRows.length){
      els.reviewList.innerHTML = '<div class="empty-stat">没有记录</div>';
      return;
    }
    els.reviewList.innerHTML = '<div class="review-row head"><span>题目</span><span>你的答案</span><span>正确答案</span></div>';
    appendReviewRows();
  }

  els.reviewList.addEventListener("click", function(e){
    if(e.target.closest("[data-review-more]")) appendReviewRows();
  });

  /* ---------------- 结算 ---------------- */
  function fmtTime(sec){
    if(sec == null || !isFinite(sec)) return "—";
    if(sec < 60) return sec.toFixed(1) + "s";
    var whole = Math.round(sec);
    return Math.floor(whole / 60) + "m" + (whole % 60) + "s";
  }

  function finish(){
    stopTimer();
    clearTimeout(S.hideTimer); clearTimeout(S.nextTimer);
    S.hideTimer = null; S.nextTimer = null; S.hideAt = 0;
    flushPersistence();
    S.qid++; // 使旧题的隐藏/换题回调失效
    S.locked = true;
    var done = S.ok + S.bad;
    var acc = done ? Math.round(S.ok / done * 100) : 0;
    var avg = S.timeCount ? S.timeTotal / S.timeCount : null;
    var fast = S.timeCount ? S.fastest : null;
    var totalSec = Math.max(0, (performance.now() - S.startClock) / 1000);
    S.log = S.reviewBuffer ? S.reviewBuffer.toArray() : [];
    S.wrong = S.log.filter(function(x){ return !x.ok; }).map(function(x){ return x.question; });

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
    var digits = digitsText();
    els.heroSub.textContent = digits + " · " + bits.join(" · ");
    UI.count.textContent = S.unlimited ? "∞" : String(S.total);
    UI.countUnit.textContent = S.unlimited ? "自由练习" : "题 / 本轮";
    UI.digits.textContent = digits;
    UI.limit.textContent = S.limit ? S.limit + " 秒" : "不限时";
    UI.show.textContent = S.showMs ? S.showMs + "ms" + (adaptActive() ? " · 自适应" : "") : "一直显示";
    els.startBtn.disabled = !ops.length || (!S.unlimited && S.total === 0);
    syncSelectionA11y();
    scheduleSettingsSave();
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

  /* ---------------- Unified keypad and physical keyboard ---------------- */
  var pendingPointerClicks = new Map();
  function pressKey(command){
    if(S.locked) return;
    var value = Core.nextInput(els.answer.value, command);
    if(value !== els.answer.value) els.answer.value = value;
  }

  function onKeypadPointer(e){
    var key = e.target.closest(".key");
    if(!key || e.button !== 0) return;
    e.preventDefault();
    pressKey(key.getAttribute("data-k"));
    var now = performance.now(), pending = pendingPointerClicks.get(key);
    pendingPointerClicks.set(key, { count: pending && now < pending.until ? pending.count + 1 : 1, until: now + 30000 });
  }

  function onKeypadClick(e){
    var key = e.target.closest(".key");
    if(!key) return;
    var pending = pendingPointerClicks.get(key);
    // Native keyboard/assistive-technology clicks have detail=0 and must stay usable.
    if(e.detail > 0 && pending && pending.count && performance.now() < pending.until){
      if(--pending.count === 0) pendingPointerClicks.delete(key);
      return;
    }
    pendingPointerClicks.delete(key);
    pressKey(key.getAttribute("data-k"));
  }

  function onKeypadCancel(e){
    var key = e.target.closest(".key");
    if(key) pendingPointerClicks.delete(key);
  }

  function onDrillKeydown(e){
    if(!els.drill.classList.contains("active") || S.locked || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    var target = e.target;
    // Enter/Space on a focused button should activate that button, not submit a question.
    if(target && target.closest && target.closest("button, a") && (e.key === "Enter" || e.key === " ")) return;
    var command = /^[0-9]$/.test(e.key) || e.key === "." ? e.key
      : ({ Backspace: "back", Escape: "clear" })[e.key];
    if(command){ e.preventDefault(); pressKey(command); }
    else if(e.key === "Enter"){ e.preventDefault(); if(!e.repeat) submit(); }
  }

  els.keypad.addEventListener("pointerdown", onKeypadPointer);
  els.keypad.addEventListener("click", onKeypadClick);
  els.keypad.addEventListener("pointercancel", onKeypadCancel);
  document.addEventListener("keydown", onDrillKeydown);

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
    if(!S.wrong.length){ toast("没有可重练的错题"); return; }
    startRun(S.wrong.slice());
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
    try{ S.records = Core.sanitizeRecords(localStorage.getItem("drill.records.v1")); }
    catch(e){ S.records = []; }
    markStatsDirty();
  }

  function saveRecords(){
    clearTimeout(persistence.recordsTimer);
    persistence.recordsTimer = null;
    if(!persistence.recordsDirty) return;
    try{
      localStorage.setItem("drill.records.v1", JSON.stringify(S.records));
      persistence.recordsDirty = false;
    }catch(e){}
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

  function renderStats(){
    var stats = getStats(S.stRange);
    if(UI.lastStatsRender === stats) return;
    var n = stats.n, good = stats.ok, wrong = stats.wrong;
    els.stAcc.textContent = n ? Math.round(good / n * 100) + "%" : "—";
    els.stSub.textContent = n ? "答对 " + good + " / " + n + " 题" + (good === n ? " · 全对！" : " · 错 " + wrong + " 题") : "该范围内还没有练习记录";
    els.stTotal.textContent = n;
    els.stAvg.textContent = n ? fmtTime(stats.sec / n) : "—";
    els.stDur.textContent = n ? fmtDur(stats.sec) : "—";
    els.stDays.textContent = stats.byDay.size;
    els.stStreak.textContent = stats.bestStreak;
    els.stWrong.textContent = wrong;

    els.stSessions.innerHTML = stats.sessions.map(function(session){
      var acc = Math.round(session.ok / session.n * 100), date = new Date(session.start);
      return '<div class="bar" role="listitem" tabindex="0" aria-label="' + session.n + " 题，正确率 " + acc
        + '%" title="' + (date.getMonth() + 1) + "/" + date.getDate() + " " + fmtClock(session.start)
        + " · " + session.n + " 题 · 正确率 " + acc + '%"><i style="height:' + Math.max(4, acc)
        + '%"></i><span>' + acc + '%</span></div>';
    }).join("") || '<div class="empty-stat" style="grid-column:1/-1">暂无练习</div>';

    function bucketRow(name, bucket){ return statRow(name, bucket.ok, bucket.n, bucket.n ? bucket.sec / bucket.n : null); }
    els.stOps.innerHTML = opsOrder.map(function(op){ return bucketRow(op, stats.byOp[op]); }).join("");
    els.stCarry.innerHTML = bucketRow("有进位", stats.byCarry[1]) + bucketRow("无进位", stats.byCarry[0]);
    els.stTime.innerHTML = ["2 秒内", "2-5 秒", "5-10 秒", "10 秒以上"].map(function(label, i){ return distRow(label, stats.time[i], n); }).join("");
    els.stTimeNote.textContent = n ? "答对平均 " + (good ? (stats.okSec / good).toFixed(1) : "—") + "s　|　答错平均 "
      + (wrong ? (stats.badSec / wrong).toFixed(1) : "—") + "s"
      + (wrong && good && stats.badSec / wrong > stats.okSec / good * 1.2 ? "　→ 错误题明显更慢，注意熟练度" : "") : "";
    els.stLen.innerHTML = ["≤4 位", "5-8 位", "9-12 位", ">12 位"].map(function(label, i){ return bucketRow(label, stats.byLength[i]); }).join("");
    var max = stats.series.reduce(function(best, day){ return Math.max(best, day.cnt); }, 1);
    els.stTrend.innerHTML = stats.series.map(function(day){
      var height = day.cnt ? Math.max(8, Math.round(day.cnt / max * 100)) : 3;
      return '<div class="bar" role="listitem" tabindex="0" aria-label="' + day.label + "，练习 " + day.cnt
        + ' 题" title="' + day.label + "：" + day.cnt + " 题" + (day.cnt ? "，正确率 " + day.acc + "%" : "")
        + '"><i style="height:' + height + "%" + (day.cnt ? "" : ";opacity:.22") + '"></i><span>' + day.label + '</span></div>';
    }).join("");
    UI.lastStatsRender = stats;
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
    if(yes){ S.records = []; persistence.recordsDirty = true; markStatsDirty(); saveRecords(); renderStats(); toast("数据已清空"); }
  });

  els.stExport.addEventListener("click", function(){
    if(!S.records.length){ toast("还没有数据"); return; }
    flushPersistence();
    var records = getStats(S.stRange).records;
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

  document.addEventListener("visibilitychange", reconcileVisibility);
  window.addEventListener("pagehide", flushPersistence);
  els.setup.addEventListener("change", function(){ saveSettings(); });

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
