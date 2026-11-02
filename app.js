// 將此網址換成老師部署後的 Google Apps Script 網頁應用程式網址。
const SCORE_ENDPOINT = "https://script.google.com/macros/s/AKfycbz73-EZSw4onCqgX0EkGpzKeUozIxV6ds64A8-kBdGGoZo73xrS_qEZfv5WM7OrLM1Bkg/exec";

const questions = [
  ...Array.from({ length: 20 }, (_, index) => ({ id: `mc-${index + 1}`, type: "mc", source: index + 1, points: 3 })),
  ...Array.from({ length: 4 }, (_, index) => ({ id: `sa-${index + 1}`, type: "sa", source: index + 1, points: 10 })),
];
const questionImage = document.querySelector("#question-image");
const questionNumber = document.querySelector("#question-number");
const pointBadge = document.querySelector("#point-badge");
const feedback = document.querySelector("#feedback");
const scoreElement = document.querySelector("#score");
const answerButtons = [...document.querySelectorAll("[data-answer]")];
const shortAnswer = document.querySelector("#short-answer");
const multipleChoiceArea = document.querySelector("#multiple-choice-area");
const shortAnswerArea = document.querySelector("#short-answer-area");
const questionNav = document.querySelector("#question-nav");
const currentPosition = document.querySelector("#current-position");
const answeredCount = document.querySelector("#answered-count");
const unansweredCount = document.querySelector("#unanswered-count");
const submitButton = document.querySelector("#submit-button");
const resultsPanel = document.querySelector("#results-panel");
const resultScore = document.querySelector("#result-score");
const resultDetail = document.querySelector("#result-detail");
const wrongList = document.querySelector("#wrong-list");
const studentPanel = document.querySelector("#student-panel");
const studentForm = document.querySelector("#student-form");
const examContent = document.querySelector("#exam-content");
const proctoringStatus = document.querySelector("#proctoring-status");
const restartButton = document.querySelector("#restart-button");
let order = [];
let currentIndex = 0;
let responses = {};
let submitted = false;
let student = null;
let examStarted = false;
let lockedForFocusLoss = false;

function assetName(question) { return `assets/${question.type === "mc" ? "mc" : "sa"}/${String(question.source).padStart(2, "0")}.png`; }
function shuffledOrder() {
  const copy = [...questions];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}
function currentQuestion() { return order[currentIndex]; }
function hasResponse(question) { return Boolean((responses[question.id] || "").trim()); }
function renderProgress() {
  const answered = order.filter(hasResponse).length;
  currentPosition.textContent = `第 ${currentIndex + 1} / ${order.length} 題`;
  answeredCount.textContent = `${answered} 題`;
  unansweredCount.textContent = `${order.length - answered} 題`;
  questionNav.replaceChildren(...order.map((question, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = index + 1;
    button.title = `考卷第 ${index + 1} 題（${question.type === "mc" ? "選擇" : "問答"}題）`;
    button.setAttribute("aria-label", button.title);
    if (index === currentIndex) button.classList.add("current");
    if (hasResponse(question)) button.classList.add("done");
    button.addEventListener("click", () => { currentIndex = index; renderQuestion(); });
    return button;
  }));
}
function renderQuestion() {
  const question = currentQuestion();
  const isChoice = question.type === "mc";
  questionNumber.textContent = `第 ${currentIndex + 1} 題 / 共 ${order.length} 題`;
  pointBadge.textContent = `${isChoice ? "選擇題" : "問答題"} · ${question.points} 分`;
  questionImage.src = assetName(question);
  questionImage.alt = `考卷第 ${currentIndex + 1} 題`;
  multipleChoiceArea.hidden = !isChoice;
  shortAnswerArea.hidden = isChoice;
  shortAnswer.value = isChoice ? "" : (responses[question.id] || "");
  answerButtons.forEach((button) => {
    const selected = responses[question.id];
    button.disabled = submitted;
    button.classList.toggle("selected", button.dataset.answer === selected);
    button.setAttribute("aria-pressed", String(button.dataset.answer === selected));
  });
  shortAnswer.disabled = submitted;
  feedback.textContent = submitted ? "已交卷，答案已鎖定。" : (isChoice ? "請選擇 A、B、C 或 D。" : "請輸入問答題答案。");
  feedback.className = "feedback";
  document.querySelector("#previous-button").disabled = currentIndex === 0;
  document.querySelector("#next-button").hidden = currentIndex === order.length - 1;
  renderProgress();
}
function selectAnswer(event) {
  if (submitted) return;
  responses[currentQuestion().id] = event.currentTarget.dataset.answer;
  renderQuestion();
}
function recordShortAnswer() {
  if (submitted || currentQuestion().type !== "sa") return;
  responses[currentQuestion().id] = shortAnswer.value;
  renderProgress();
}
function submitToTeacher(payload) {
  if (!SCORE_ENDPOINT) return;
  const form = document.createElement("form");
  form.method = "POST"; form.action = SCORE_ENDPOINT; form.target = "submit-frame";
  const field = document.createElement("input");
  field.type = "hidden"; field.name = "payload"; field.value = JSON.stringify(payload);
  form.append(field); document.body.append(form); form.submit(); form.remove();
}
function requestMcGrade() {
  if (!SCORE_ENDPOINT) return;
  const choices = order.filter((question) => question.type === "mc")
    .map((question) => ({ id: question.id, answer: responses[question.id] }));
  const script = document.createElement("script");
  script.src = `${SCORE_ENDPOINT}?callback=showMcGrade&answers=${encodeURIComponent(JSON.stringify(choices))}`;
  script.onerror = () => {
    resultDetail.textContent = "作答已送出；選擇題成績請由老師在後台查看。";
  };
  document.body.append(script);
}
window.showMcGrade = (result) => {
  if (!result.ok) return;
  scoreElement.textContent = `${result.score} / 60 分`;
  resultScore.textContent = `${result.score} / 60 分`;
  resultDetail.textContent = `答對 ${result.correct} 題；問答題共 40 分，待老師人工批改後計入總成績。`;
  wrongList.replaceChildren();
  if (!result.wrong.length) {
    const perfect = document.createElement("p");
    perfect.className = "perfect-score";
    perfect.textContent = "選擇題全部答對！";
    wrongList.append(perfect);
    return;
  }
  result.wrong.forEach((item) => {
    const position = order.findIndex((question) => question.id === item.id) + 1;
    const text = document.createElement("p");
    text.className = "wrong-item";
    text.textContent = `考卷第 ${position} 題：你的答案 ${item.selected.toUpperCase()}；正確答案 ${item.correct.toUpperCase()}`;
    wrongList.append(text);
  });
};
function submitExam(forceReason = "") {
  recordShortAnswer();
  const unanswered = order.filter((question) => !hasResponse(question));
  if (!forceReason && unanswered.length) {
    feedback.textContent = `尚有 ${unanswered.length} 題未作答，請從右側題號完成後再交卷。`;
    feedback.className = "feedback error";
    return;
  }
  submitted = true;
  submitToTeacher({
    submittedAt: new Date().toISOString(), name: student.name, studentId: student.studentId,
    proctoring: forceReason ? { status: "自動交卷", reason: forceReason, at: new Date().toISOString() } : { status: "正常交卷" },
    questionOrder: order.map((question, index) => ({ position: index + 1, id: question.id, type: question.type })),
    answers: order.map((question, index) => ({ position: index + 1, id: question.id, answer: responses[question.id] })),
  });
  scoreElement.textContent = forceReason ? "已自動交卷" : "已送出";
  resultScore.textContent = forceReason ? "已自動交卷" : "作答已送出";
  resultDetail.textContent = forceReason
    ? `偵測到${forceReason}，系統已自動交卷；未作答題目不計分。`
    : (SCORE_ENDPOINT ? "選擇題成績計算中…" : "老師後台尚未連線；請先完成後台設定後再提供學生使用。");
  resultsPanel.hidden = false; submitButton.disabled = true; renderQuestion(); requestMcGrade();
}
function lockExamForFocusLoss() {
  if (!examStarted || submitted || lockedForFocusLoss) return;
  lockedForFocusLoss = true;
  submitExam("離開考試頁面");
}
studentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#student-name").value.trim();
  const studentId = document.querySelector("#student-id").value.trim();
  if (!name || !studentId) return;
  student = { name, studentId }; studentPanel.hidden = true; examContent.hidden = false;
  examStarted = true; restartButton.hidden = true;
  proctoringStatus.hidden = false; renderQuestion();
});
answerButtons.forEach((button) => button.addEventListener("click", selectAnswer));
shortAnswer.addEventListener("input", recordShortAnswer);
document.querySelector("#previous-button").addEventListener("click", () => { currentIndex -= 1; renderQuestion(); });
document.querySelector("#next-button").addEventListener("click", () => { currentIndex += 1; renderQuestion(); });
submitButton.addEventListener("click", () => submitExam());
restartButton.addEventListener("click", () => window.location.reload());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) lockExamForFocusLoss();
});
window.addEventListener("blur", () => {
  window.setTimeout(() => {
    if (!document.hasFocus()) lockExamForFocusLoss();
  }, 120);
});
order = shuffledOrder(); renderQuestion();


// 問答題也送往後台初評，並在交卷後合併顯示 100 分制成績。
function requestMcGrade() {
  if (!SCORE_ENDPOINT) return;
  const answers = order.map((question) => ({ id: question.id, answer: responses[question.id] }));
  const script = document.createElement("script");
  script.src = SCORE_ENDPOINT + "?callback=showMcGrade&answers=" + encodeURIComponent(JSON.stringify(answers));
  script.onerror = () => { resultDetail.textContent = "作答已送出；成績請由老師在後台查看。"; };
  document.body.append(script);
}
window.showMcGrade = (result) => {
  if (!result.ok) return;
  const shortScore = Number(result.saScore || 0);
  const total = Number(result.total ?? (Number(result.score || 0) + shortScore));
  scoreElement.textContent = total + " / 100 分";
  resultScore.textContent = total + " / 100 分";
  resultDetail.textContent = "選擇題答對 " + result.correct + " 題（" + result.score + " / 60 分）；問答題關鍵字初評 " + shortScore + " / 40 分。老師可覆核與改分。";
  let list = document.querySelector("#wrong-list");
  if (!list) {
    list = document.createElement("div");
    list.id = "wrong-list";
    list.className = "wrong-list";
    resultsPanel.append(list);
  }
  list.replaceChildren();
  if (!result.wrong.length) {
    const perfect = document.createElement("p");
    perfect.className = "perfect-score";
    perfect.textContent = "選擇題全部答對！";
    list.append(perfect);
    return;
  }
  result.wrong.forEach((item) => {
    const position = order.findIndex((question) => question.id === item.id) + 1;
    const text = document.createElement("p");
    text.className = "wrong-item";
    text.textContent = "考卷第 " + position + " 題：你的答案 " + item.selected.toUpperCase() + "；正確答案 " + item.correct.toUpperCase();
    list.append(text);
  });
};
