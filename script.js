// --- 상수 및 유틸리티 ---
const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

function decomposeHangul(char) {
    const code = char.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
        const offset = code - 0xAC00;
        const jongIdx = offset % 28;
        const jungIdx = Math.floor((offset - jongIdx) / 28) % 21;
        const choIdx = Math.floor(Math.floor((offset - jongIdx) / 28) / 21);

        const steps = [];
        steps.push(CHO[choIdx]);
        steps.push(String.fromCharCode(0xAC00 + (choIdx * 21 * 28) + (jungIdx * 28)));
        if (jongIdx > 0) steps.push(char);
        return steps;
    }
    return [char];
}
// 글리치용 무작위 유니코드 문자 생성기
function getRandomGlitchChar(currentGlitchState) {
    let ranges = [];
    
    if (currentGlitchState.glitchRangeLatin) ranges.push([0x0021, 0x007E]);
    if (currentGlitchState.glitchRangeKana) ranges.push([0x3041, 0x3096], [0x30A1, 0x30FA]);
    if (currentGlitchState.glitchRangeHangul) ranges.push([0x3131, 0x318E], [0xAC00, 0xD7A3]);
    if (currentGlitchState.glitchRangeSymbols) ranges.push([0x2500, 0x257F], [0x25A0, 0x25FF]);
    
    if (ranges.length === 0) {
        ranges = [[0x0021, 0x007E]]; // 선택된 게 없으면 기본 라틴
    }

    const range = ranges[Math.floor(Math.random() * ranges.length)];
    const code = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
    return String.fromCharCode(code);
}

// --- 상태 관리 ---
let currentTab = 'typing'; // 'typing', 'glitch', or 'credit'

const DEFAULT_STATE = {
    text: "유이타,\n파이팅!", fontFamilySelect: "Noto Sans KR", fontFamilyCustom: "", fontFamily: "Noto Sans KR", 
    fontSize: 48, scaleX: 100, letterSpacing: 0, lineHeight: 1.2, isBold: false, isItalic: false, isUnderline: false, isStrikethrough: false,
    writingMode: "horizontal", textAlign: "center", verticalAlign: "center", direction: "forward",
    shapeMode: "none", shapeSize: 100, shapeRotateSpeed: 0,
    useBackgroundColor: false, backgroundColor: "#000000", fillColor: "#ffffff", strokeColor: "#000000", strokeWidth: 4,
    shadowColor: "#000000", shadowBlur: 4, shadowOffsetX: 2, shadowOffsetY: 2,
    fps: 12, holdLast: 2000, fadeMode: "none", fadeOutDuration: 1000, canvasWidth: 600, canvasHeight: 300, audioMode: "overlap", apngCompress: true
};

const GLITCH_DEFAULT_STATE = {
    text: "SYSTEM ERROR\n오류가 발생했습니다.", fontFamilySelect: "Noto Sans KR", fontFamilyCustom: "", fontFamily: "Noto Sans KR",
    fontSize: 48, scaleX: 100, letterSpacing: 0, lineHeight: 1.2, isBold: true, isItalic: false, isUnderline: false, isStrikethrough: false,
    writingMode: "horizontal", textAlign: "center", verticalAlign: "center",
    useBackgroundColor: false, backgroundColor: "#000000", fillColor: "#ff0033", strokeColor: "#000000", strokeWidth: 2,
    shadowColor: "#ff0033", shadowBlur: 8, shadowOffsetX: 0, shadowOffsetY: 0,
    glitchRangeLatin: true, glitchRangeKana: true, glitchRangeHangul: true, glitchRangeSymbols: true,
    simultaneousMode: false, // 새로 추가된 옵션
    fps: 15, holdLast: 2000, glitchCount: 3, canvasWidth: 600, canvasHeight: 300, apngCompress: true
};

const CREDIT_DEFAULT_STATE = {
    text: "STAFF\n\nGM 가나다\nPL1 라마바\nPL2 사아자\nPL3 차카타\n\n문단별 저장이 가능합니다\n빈 줄을 기준으로 나눌 수 있어요\n\n순번_문장_생성시간 형태로\n저장됩니다",
    fontFamilySelect: "Noto Sans KR", fontFamilyCustom: "", fontFamily: "Noto Sans KR",
    fontSize: 32, lineHeight: 1.5, textAlign: "center", isBold: false,
    useBackgroundColor: false, backgroundColor: "#000000", fillColor: "#ffffff", strokeColor: "#000000", strokeWidth: 2,
    shadowColor: "#000000", shadowBlur: 4, shadowOffsetX: 2, shadowOffsetY: 2,
    fps: 12, totalDuration: 20, splitMode: false, canvasWidth: 720, canvasHeight: 400, silentAudioExtension: 0, apngCompress: true
};

let state = { ...DEFAULT_STATE };
let glitchState = { ...GLITCH_DEFAULT_STATE };
let creditState = { ...CREDIT_DEFAULT_STATE };

let loadedFonts = new Set();
let animationInterval = null;

let generatedFrames = []; // 타이핑 효과용
let glitchGeneratedFrames = []; // 글리치 효과용
let rawTypingFrameCount = 0; 

let creditFramesInfo = { totalFrames: 0, textBlock: "" }; 

let currentFrameIndex = 0;
let isPlaying = true;
let isFinished = false;

let audioCtx = null;
let uploadedAudioBuffer = null;
let generatedAudioBlobUrl = null;

// UI 요소 캐싱
const inputs = Object.keys(DEFAULT_STATE).reduce((acc, key) => {
    const el = document.getElementById(`val-${key}`);
    if (el) acc[key] = el; return acc;
}, {});

const glitchInputs = Object.keys(GLITCH_DEFAULT_STATE).reduce((acc, key) => {
    const el = document.getElementById(`val-glitch-${key}`);
    if (el) acc[key] = el; return acc;
}, {});

const creditInputs = Object.keys(CREDIT_DEFAULT_STATE).reduce((acc, key) => {
    const el = document.getElementById(`val-credit-${key}`);
    if (el) acc[key] = el; return acc;
}, {});

const splitModeRadios = document.querySelectorAll('input[name="val-credit-splitMode"]');

const canvas = document.getElementById('preview-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const statusEl = document.getElementById('preview-status');
const exportOverlay = document.getElementById('export-overlay');

// --- 탭 전환 로직 ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => {
            b.classList.remove('text-white', 'border-[#89b4fa]', 'active');
            b.classList.add('text-gray-400', 'border-transparent');
        });
        e.target.classList.remove('text-gray-400', 'border-transparent');
        e.target.classList.add('text-white', 'border-[#89b4fa]', 'active');
        
        currentTab = e.target.getAttribute('data-target');
        
        document.getElementById('panel-typing').style.display = 'none';
        document.getElementById('panel-glitch').style.display = 'none';
        document.getElementById('panel-credit').style.display = 'none';

        if (currentTab === 'typing') {
            document.getElementById('panel-typing').style.display = 'block';
            canvas.width = state.canvasWidth; canvas.height = state.canvasHeight;
            updateStateFromUI();
        } else if (currentTab === 'glitch') {
            document.getElementById('panel-glitch').style.display = 'block';
            canvas.width = glitchState.canvasWidth; canvas.height = glitchState.canvasHeight;
            updateGlitchStateFromUI();
        } else {
            document.getElementById('panel-credit').style.display = 'block';
            canvas.width = creditState.canvasWidth; canvas.height = creditState.canvasHeight;
            updateCreditStateFromUI();
        }
    });
});

// --- 데이터 동기화 (타자 효과) ---
function updateStateFromUI() {
    if (currentTab !== 'typing') return;
    for (const key in inputs) {
        const el = inputs[key];
        if (el.type === 'number') state[key] = parseFloat(el.value);
        else if (el.type === 'checkbox') state[key] = el.checked;
        else if (el.type !== 'file') state[key] = el.value;
    }
    if (state.fontFamilySelect === 'custom') { state.fontFamily = state.fontFamilyCustom || 'sans-serif'; document.getElementById('custom-font-container').style.display = 'block'; } 
    else { state.fontFamily = state.fontFamilySelect; document.getElementById('custom-font-container').style.display = 'none'; }

    loadFont(state.fontFamilySelect !== 'custom' ? state.fontFamilySelect : null);
    generateTypingFrames();
    playPreview();
}

// --- 데이터 동기화 (글리치 효과) ---
function updateGlitchStateFromUI() {
    if (currentTab !== 'glitch') return;
    for (const key in glitchInputs) {
        const el = glitchInputs[key];
        if (el.type === 'number') glitchState[key] = parseFloat(el.value);
        else if (el.type === 'checkbox') glitchState[key] = el.checked;
        else if (el.type !== 'file') glitchState[key] = el.value;
    }
    if (glitchState.fontFamilySelect === 'custom') { glitchState.fontFamily = glitchState.fontFamilyCustom || 'sans-serif'; document.getElementById('custom-glitch-font-container').style.display = 'block'; } 
    else { glitchState.fontFamily = glitchState.fontFamilySelect; document.getElementById('custom-glitch-font-container').style.display = 'none'; }

    loadFont(glitchState.fontFamilySelect !== 'custom' ? glitchState.fontFamilySelect : null);
    generateGlitchFrames();
    playPreview();
}

// --- 데이터 동기화 (엔딩 크레딧) ---
function updateCreditStateFromUI() {
    if (currentTab !== 'credit') return;
    for (const key in creditInputs) {
        const el = creditInputs[key];
        if (el.type === 'number') creditState[key] = parseFloat(el.value);
        else if (el.type === 'checkbox') creditState[key] = el.checked;
        else if (el.type !== 'file' && el.type !== 'radio') creditState[key] = el.value;
    }
    const checkedRadio = document.querySelector('input[name="val-credit-splitMode"]:checked');
    if (checkedRadio) creditState.splitMode = checkedRadio.value === 'true';
    if (creditState.fontFamilySelect === 'custom') { creditState.fontFamily = creditState.fontFamilyCustom || 'sans-serif'; document.getElementById('custom-credit-font-container').style.display = 'block'; } 
    else { creditState.fontFamily = creditState.fontFamilySelect; document.getElementById('custom-credit-font-container').style.display = 'none'; }

    loadFont(creditState.fontFamilySelect !== 'custom' ? creditState.fontFamilySelect : null);
    generateCreditFrames();
    playPreview();
}

function updateUIFromState() {
    for (const key in inputs) { if (inputs[key]) { if (inputs[key].type === 'checkbox') inputs[key].checked = state[key]; else inputs[key].value = state[key]; } }
    if (state.fontFamilySelect === 'custom') { document.getElementById('custom-font-container').style.display = 'block'; state.fontFamily = state.fontFamilyCustom || 'sans-serif'; } 
    else { document.getElementById('custom-font-container').style.display = 'none'; state.fontFamily = state.fontFamilySelect; }

    for (const key in glitchInputs) { if (glitchInputs[key]) { if (glitchInputs[key].type === 'checkbox') glitchInputs[key].checked = glitchState[key]; else glitchInputs[key].value = glitchState[key]; } }
    if (glitchState.fontFamilySelect === 'custom') { document.getElementById('custom-glitch-font-container').style.display = 'block'; glitchState.fontFamily = glitchState.fontFamilyCustom || 'sans-serif'; } 
    else { document.getElementById('custom-glitch-font-container').style.display = 'none'; glitchState.fontFamily = glitchState.fontFamilySelect; }

    for (const key in creditInputs) { if (creditInputs[key]) { if (creditInputs[key].type === 'checkbox') creditInputs[key].checked = creditState[key]; else creditInputs[key].value = creditState[key]; } }
    splitModeRadios.forEach(radio => { if ((radio.value === 'true') === creditState.splitMode) radio.checked = true; });
    if (creditState.fontFamilySelect === 'custom') { document.getElementById('custom-credit-font-container').style.display = 'block'; creditState.fontFamily = creditState.fontFamilyCustom || 'sans-serif'; } 
    else { document.getElementById('custom-credit-font-container').style.display = 'none'; creditState.fontFamily = creditState.fontFamilySelect; }

    if (currentTab === 'typing') { loadFont(state.fontFamilySelect !== 'custom' ? state.fontFamilySelect : null); generateTypingFrames(); } 
    else if (currentTab === 'glitch') { loadFont(glitchState.fontFamilySelect !== 'custom' ? glitchState.fontFamilySelect : null); generateGlitchFrames(); }
    else { loadFont(creditState.fontFamilySelect !== 'custom' ? creditState.fontFamilySelect : null); generateCreditFrames(); }
    playPreview();
}

function loadFont(fontFamily) {
    if (!fontFamily || loadedFonts.has(fontFamily)) return;
    const fontId = 'font-' + fontFamily.replace(/\s+/g, '-');
    if (!document.getElementById(fontId)) {
        const link = document.createElement('link');
        link.id = fontId; link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, '+')}&display=swap`;
        document.head.appendChild(link);
        loadedFonts.add(fontFamily);
    }
}

// --- 핵심 프레임 생성 로직 (타이핑) ---
function generateTypingFrames() {
    let fullText = state.text;
    if (!fullText) { generatedFrames = []; rawTypingFrameCount = 0; return; }

    let processText = state.direction === 'backward' ? fullText.split('').reverse().join('') : fullText;
    let framesList = []; let currentChars = [];

    for (let i = 0; i < processText.length; i++) {
        const char = processText[i];
        const origIdx = state.direction === 'backward' ? (processText.length - 1 - i) : i;

        if (char === '\n') {
            currentChars.push({ char: char, origIdx });
            framesList.push([...currentChars]);
            continue;
        }

        const steps = decomposeHangul(char);
        for (let j = 0; j < steps.length; j++) {
            framesList.push([...currentChars, { char: steps[j], origIdx }]);
        }
        currentChars.push({ char: char, origIdx });
    }

    if (state.direction === 'backward') {
        for (let f = 0; f < framesList.length; f++) { framesList[f].sort((a, b) => a.origIdx - b.origIdx); }
    }
    rawTypingFrameCount = framesList.length;

    let finishFrames = {};
    for (let i = 0; i < processText.length; i++) {
        const origIdx = state.direction === 'backward' ? (processText.length - 1 - i) : i;
        const finalChar = processText[i];
        for (let f = 0; f < framesList.length; f++) {
            const item = framesList[f].find(x => x.origIdx === origIdx);
            if (item && item.char === finalChar) { finishFrames[origIdx] = f; break; }
        }
    }

    const fadeFramesCount = Math.max(1, Math.round((state.fadeOutDuration / 1000) * state.fps));
    let finalFrames = [];

    for (let f = 0; f < framesList.length; f++) {
        let frameData = { chars: [], isHold: false, globalAlpha: 1.0 };
        for (let c of framesList[f]) {
            let alpha = 1.0;
            if (state.fadeMode === 'individual') {
                const finishedAt = finishFrames[c.origIdx];
                if (finishedAt !== undefined && f > finishedAt) {
                    const age = f - finishedAt;
                    alpha = Math.max(0, 1.0 - (age / fadeFramesCount));
                }
            }
            frameData.chars.push({ char: c.char, alpha: alpha, origIdx: c.origIdx });
        }
        finalFrames.push(frameData);
    }

    if (state.fadeMode === 'global') {
        finalFrames[finalFrames.length - 1].isHold = true;
        if (state.fadeOutDuration > 0) {
            const lastFrameChars = framesList[framesList.length - 1];
            for (let i = 1; i <= fadeFramesCount; i++) {
                finalFrames.push({ chars: lastFrameChars.map(c => ({...c, alpha: 1.0})), isHold: false, globalAlpha: Math.max(0, 1.0 - (i / fadeFramesCount)) });
            }
        }
    } else if (state.fadeMode === 'individual') {
        if (state.fadeOutDuration > 0) {
            const lastFrameChars = framesList[framesList.length - 1];
            for (let i = 1; i <= fadeFramesCount; i++) {
                let frameData = { chars: [], isHold: (i === fadeFramesCount), globalAlpha: 1.0 };
                const currentF = framesList.length - 1 + i;
                for (let c of lastFrameChars) {
                    const finishedAt = finishFrames[c.origIdx]; let alpha = 1.0;
                    if (finishedAt !== undefined && currentF > finishedAt) {
                        const age = currentF - finishedAt; alpha = Math.max(0, 1.0 - (age / fadeFramesCount));
                    }
                    frameData.chars.push({ char: c.char, alpha: alpha, origIdx: c.origIdx });
                }
                finalFrames.push(frameData);
            }
        } else { finalFrames[finalFrames.length - 1].isHold = true; }
    } else { finalFrames[finalFrames.length - 1].isHold = true; }

    if (state.shapeMode !== 'none' && state.shapeRotateSpeed !== 0) {
        let expandedFrames = [];
        for (let i = 0; i < finalFrames.length; i++) {
            const f = finalFrames[i];
            if (f.isHold) {
                const holdFramesCount = Math.max(1, Math.round((state.holdLast / 1000) * state.fps));
                for (let j = 0; j < holdFramesCount; j++) { expandedFrames.push({ chars: f.chars, globalAlpha: f.globalAlpha, isHold: false }); }
            } else { expandedFrames.push(f); }
        }
        finalFrames = expandedFrames;
    }
    generatedFrames = finalFrames;
}

// --- 핵심 프레임 생성 로직 (글리치) ---
function generateGlitchFrames() {
    let fullText = glitchState.text;
    if (!fullText) { glitchGeneratedFrames = []; return; }

    let framesList = [];

    if (glitchState.simultaneousMode) {
        // 새로운 모드: 전체가 한 번에 글리치 형태로 출력되고 앞에서부터 순차적으로 해독됨
        for (let i = 0; i < fullText.length; i++) {
            const actualChar = fullText[i];
            
            if (actualChar === '\n' || actualChar === ' ') continue;

            for (let g = 0; g < glitchState.glitchCount; g++) {
                let frameChars = [];
                for (let j = 0; j < fullText.length; j++) {
                    const charJ = fullText[j];
                    if (charJ === '\n' || charJ === ' ') {
                        frameChars.push({ char: charJ, alpha: 1.0, origIdx: j });
                    } else if (j < i) {
                        // 이미 해독이 끝난 앞글자들
                        frameChars.push({ char: charJ, alpha: 1.0, origIdx: j });
                    } else {
                        // 아직 해독 전이거나 현재 해독중인 글자들
                        frameChars.push({ char: getRandomGlitchChar(glitchState), alpha: 1.0, origIdx: j });
                    }
                }
                framesList.push({ chars: frameChars, isHold: false, globalAlpha: 1.0 });
            }
        }
        
        // 마지막 프레임 (모두 올바른 글자로 완성된 상태)
        let finalChars = [];
        for (let j = 0; j < fullText.length; j++) {
            finalChars.push({ char: fullText[j], alpha: 1.0, origIdx: j });
        }
        framesList.push({ chars: finalChars, isHold: true, globalAlpha: 1.0 });

    } else {
        // 기존 모드: 한 글자씩 글리치로 나타났다가 고정됨
        let currentCorrectChars = [];

        for (let i = 0; i < fullText.length; i++) {
            const actualChar = fullText[i];
            
            if (actualChar === '\n' || actualChar === ' ') {
                currentCorrectChars.push({ char: actualChar, alpha: 1.0, origIdx: i });
                continue;
            }

            for (let g = 0; g < glitchState.glitchCount; g++) {
                let frameChars = [...currentCorrectChars];
                frameChars.push({ char: getRandomGlitchChar(glitchState), alpha: 1.0, origIdx: i });
                framesList.push({ chars: frameChars, isHold: false, globalAlpha: 1.0 });
            }

            currentCorrectChars.push({ char: actualChar, alpha: 1.0, origIdx: i });
            framesList.push({ chars: [...currentCorrectChars], isHold: false, globalAlpha: 1.0 });
        }

        if (framesList.length > 0) {
            framesList[framesList.length - 1].isHold = true;
        }
    }

    glitchGeneratedFrames = framesList;
}

// --- 핵심 프레임 생성 로직 (엔딩 크레딧) ---
function generateCreditFrames() {
    const text = creditState.text;
    if (!text) { creditFramesInfo = { totalFrames: 0, textBlock: "" }; return; }
    const totalFrames = Math.max(2, Math.floor(creditState.totalDuration * creditState.fps));
    creditFramesInfo = { totalFrames: totalFrames, textBlock: text };
}

// --- 캔버스 렌더링 헬퍼 ---
function getShapePoint(mode, size, dist) {
    if (mode === 'circle') {
        const circum = 2 * Math.PI * size; const a = (dist / circum) * 2 * Math.PI - Math.PI / 2;
        return { x: Math.cos(a) * size, y: Math.sin(a) * size, rot: a + Math.PI / 2 };
    } else if (mode === 'square') {
        const p = 8 * size; const d = dist % p;
        if (d < 2 * size) return { x: -size + d, y: -size, rot: 0 };
        if (d < 4 * size) return { x: size, y: -size + (d - 2*size), rot: Math.PI / 2 };
        if (d < 6 * size) return { x: size - (d - 4*size), y: size, rot: Math.PI };
        return { x: -size, y: size - (d - 6*size), rot: Math.PI * 1.5 };
    } else if (mode === 'triangle') {
        const cos30 = Math.sqrt(3) / 2, sin30 = 0.5;
        const A = { x: 0, y: -size }; const B = { x: size * cos30, y: size * sin30 }; const C = { x: -size * cos30, y: size * sin30 };
        const sideLen = Math.sqrt(3) * size; const p = 3 * sideLen; const d = dist % p;
        if (d < sideLen) { const t = d / sideLen; return { x: A.x + t*(B.x - A.x), y: A.y + t*(B.y - A.y), rot: Math.atan2(B.y - A.y, B.x - A.x) }; } 
        else if (d < 2 * sideLen) { const t = (d - sideLen) / sideLen; return { x: B.x + t*(C.x - B.x), y: B.y + t*(C.y - B.y), rot: Math.atan2(C.y - B.y, C.x - B.x) }; } 
        else { const t = (d - 2 * sideLen) / sideLen; return { x: C.x + t*(A.x - C.x), y: C.y + t*(A.y - C.y), rot: Math.atan2(A.y - C.y, A.x - C.x) }; }
    }
    return { x: 0, y: 0, rot: 0 };
}

// 공용 텍스트 렌더링 (타이핑, 글리치 탭에서 데이터만 바꿔서 사용)
function renderTextDataToCanvas(targetCtx, frameData, w, h, currentState, frameIndex = 0) {
    if (currentState.useBackgroundColor) {
        targetCtx.fillStyle = currentState.backgroundColor;
        targetCtx.fillRect(0, 0, w, h);
    } else {
        targetCtx.clearRect(0, 0, w, h);
    }
    targetCtx.save();

    const fontStyle = currentState.isItalic ? "italic " : "";
    const fontWeight = currentState.isBold ? "bold " : "";
    targetCtx.font = `${fontStyle}${fontWeight}${currentState.fontSize}px "${currentState.fontFamily}", sans-serif`;
    targetCtx.textBaseline = 'top';
    targetCtx.fillStyle = currentState.fillColor;
    targetCtx.strokeStyle = currentState.strokeColor;
    targetCtx.lineWidth = currentState.strokeWidth;
    targetCtx.lineJoin = 'round';

    targetCtx.shadowColor = currentState.shadowColor;
    targetCtx.shadowBlur = currentState.shadowBlur;
    targetCtx.shadowOffsetX = currentState.shadowOffsetX;
    targetCtx.shadowOffsetY = currentState.shadowOffsetY;

    if (targetCtx.letterSpacing !== undefined) {
        targetCtx.letterSpacing = `${currentState.letterSpacing}px`;
    }

    if (currentState.shapeMode && currentState.shapeMode !== 'none') {
        targetCtx.translate(w / 2, h / 2);
        const globalRotation = frameIndex * currentState.shapeRotateSpeed * (Math.PI / 180);
        targetCtx.rotate(globalRotation);
        targetCtx.textBaseline = 'bottom';
        targetCtx.textAlign = 'center';

        const shapeChars = frameData.chars.filter(c => c.char !== '\n');
        let currentDist = 0;

        for (let i = 0; i < shapeChars.length; i++) {
            const c = shapeChars[i];
            const charWidth = targetCtx.measureText(c.char).width + currentState.letterSpacing;
            const d = currentDist + charWidth / 2;
            const pt = getShapePoint(currentState.shapeMode, currentState.shapeSize, d);
            const finalAlpha = frameData.globalAlpha * c.alpha;

            if (finalAlpha > 0) {
                targetCtx.save();
                targetCtx.translate(pt.x, pt.y);
                targetCtx.rotate(pt.rot);
                targetCtx.globalAlpha = finalAlpha;

                if (currentState.strokeWidth > 0) targetCtx.strokeText(c.char, 0, 0);
                const tempShadow = targetCtx.shadowColor;
                if (currentState.strokeWidth > 0) targetCtx.shadowColor = 'transparent';
                targetCtx.fillText(c.char, 0, 0);
                
                if (currentState.isUnderline || currentState.isStrikethrough) {
                    const thickness = Math.max(1, currentState.fontSize * 0.06);
                    targetCtx.fillStyle = currentState.fillColor;
                    if (currentState.isUnderline) targetCtx.fillRect(-charWidth/2, currentState.fontSize * 0.1, charWidth, thickness);
                    if (currentState.isStrikethrough) targetCtx.fillRect(-charWidth/2, -currentState.fontSize * 0.4, charWidth, thickness);
                }

                targetCtx.shadowColor = tempShadow;
                targetCtx.restore();
            }
            currentDist += charWidth;
        }
        targetCtx.restore();
        return;
    }

    const lines = [];
    let currentLine = [];
    for (let c of frameData.chars) {
        if (c.char === '\n') { lines.push(currentLine); currentLine = []; }
        else { currentLine.push(c); }
    }
    lines.push(currentLine);

    const lineHeightPx = currentState.fontSize * currentState.lineHeight;

    if (currentState.writingMode === 'horizontal') {
        targetCtx.scale(currentState.scaleX / 100, 1);
        let originalW = w / (currentState.scaleX / 100);

        const totalHeight = lines.length * lineHeightPx;
        let startY = 10;
        if (currentState.verticalAlign === 'center') startY = (h - totalHeight) / 2 + (lineHeightPx - currentState.fontSize)/2;
        if (currentState.verticalAlign === 'bottom') startY = h - totalHeight - 10;

        lines.forEach((lineChars, index) => {
            const y = startY + (index * lineHeightPx);
            let lineWidth = 0;
            for(let c of lineChars) lineWidth += targetCtx.measureText(c.char).width + currentState.letterSpacing;
            if (lineChars.length > 0) lineWidth -= currentState.letterSpacing;

            let cx = 0;
            if (currentState.textAlign === 'left') cx = 10;
            if (currentState.textAlign === 'center') cx = originalW / 2 - lineWidth / 2;
            if (currentState.textAlign === 'right') cx = originalW - 10 - lineWidth;

            targetCtx.textAlign = 'left';

            for (let c of lineChars) {
                const finalAlpha = frameData.globalAlpha * c.alpha;
                if (finalAlpha > 0) {
                    targetCtx.globalAlpha = finalAlpha;
                    if (currentState.strokeWidth > 0) targetCtx.strokeText(c.char, cx, y);
                    const tempShadow = targetCtx.shadowColor;
                    if (currentState.strokeWidth > 0) targetCtx.shadowColor = 'transparent';
                    targetCtx.fillText(c.char, cx, y);
                    
                    if (currentState.isUnderline || currentState.isStrikethrough) {
                        const thickness = Math.max(1, currentState.fontSize * 0.06);
                        const charRenderWidth = targetCtx.measureText(c.char).width + currentState.letterSpacing;
                        targetCtx.fillStyle = currentState.fillColor;
                        if (currentState.isUnderline) targetCtx.fillRect(cx, y + currentState.fontSize * 1.05, charRenderWidth, thickness);
                        if (currentState.isStrikethrough) targetCtx.fillRect(cx, y + currentState.fontSize * 0.5, charRenderWidth, thickness);
                    }
                    targetCtx.shadowColor = tempShadow;
                }
                cx += targetCtx.measureText(c.char).width + currentState.letterSpacing;
            }
        });
    } else {
        targetCtx.textAlign = 'center';
        targetCtx.scale(currentState.scaleX / 100, 1);
        let originalW = w / (currentState.scaleX / 100);

        const totalWidth = lines.length * lineHeightPx;
        let startX = originalW - 10 - currentState.fontSize / 2; 
        if (currentState.textAlign === 'left') startX = 10 + totalWidth - currentState.fontSize / 2; 
        if (currentState.textAlign === 'center') startX = (originalW + totalWidth) / 2 - currentState.fontSize / 2;
        if (currentState.textAlign === 'right') startX = originalW - 10 - currentState.fontSize / 2;

        lines.forEach((lineChars, lineIndex) => {
            const currentX = startX - (lineIndex * lineHeightPx);
            const totalLineHeight = lineChars.length * (currentState.fontSize + currentState.letterSpacing) - currentState.letterSpacing;
            let startY = 10;
            if (currentState.verticalAlign === 'center') startY = (h - totalLineHeight) / 2;
            if (currentState.verticalAlign === 'bottom') startY = h - totalLineHeight - 10;

            for (let charIndex = 0; charIndex < lineChars.length; charIndex++) {
                const c = lineChars[charIndex];
                const y = startY + charIndex * (currentState.fontSize + currentState.letterSpacing);
                const finalAlpha = frameData.globalAlpha * c.alpha;
                
                if (finalAlpha > 0) {
                    targetCtx.globalAlpha = finalAlpha;
                    if (currentState.strokeWidth > 0) targetCtx.strokeText(c.char, currentX, y);
                    const tempShadow = targetCtx.shadowColor;
                    if (currentState.strokeWidth > 0) targetCtx.shadowColor = 'transparent';
                    targetCtx.fillText(c.char, currentX, y);
                    
                    if (currentState.isUnderline || currentState.isStrikethrough) {
                        const thickness = Math.max(1, currentState.fontSize * 0.06);
                        const charRenderHeight = currentState.fontSize + currentState.letterSpacing;
                        targetCtx.fillStyle = currentState.fillColor;
                        if (currentState.isUnderline) targetCtx.fillRect(currentX + currentState.fontSize * 0.55, y, thickness, charRenderHeight);
                        if (currentState.isStrikethrough) targetCtx.fillRect(currentX - thickness/2, y, thickness, charRenderHeight);
                    }
                    targetCtx.shadowColor = tempShadow;
                }
            }
        });
    }
    targetCtx.restore();
}

function renderCreditBlockToCanvas(targetCtx, w, h, frameIndex, totalFrames, textBlock) {
    if (creditState.useBackgroundColor) {
        targetCtx.fillStyle = creditState.backgroundColor;
        targetCtx.fillRect(0, 0, w, h);
    } else {
        targetCtx.clearRect(0, 0, w, h);
    }
    targetCtx.save();

    const fontWeight = creditState.isBold ? "bold " : "";
    targetCtx.font = `${fontWeight}${creditState.fontSize}px "${creditState.fontFamily}", sans-serif`;
    targetCtx.textBaseline = 'top';
    targetCtx.fillStyle = creditState.fillColor;
    targetCtx.strokeStyle = creditState.strokeColor;
    targetCtx.lineWidth = creditState.strokeWidth;
    targetCtx.lineJoin = 'round';
    targetCtx.shadowColor = creditState.shadowColor;
    targetCtx.shadowBlur = creditState.shadowBlur;
    targetCtx.shadowOffsetX = creditState.shadowOffsetX;
    targetCtx.shadowOffsetY = creditState.shadowOffsetY;

    const lines = textBlock.split('\n');
    const lineHeightPx = creditState.fontSize * creditState.lineHeight;
    const totalTextHeight = lines.length * lineHeightPx;

    const startY = h;
    const endY = -totalTextHeight;
    
    const progress = totalFrames > 1 ? frameIndex / (totalFrames - 1) : 1;
    const currentY = startY + (endY - startY) * progress;

    lines.forEach((line, index) => {
        const y = currentY + (index * lineHeightPx);
        let cx = 0;
        const lineWidth = targetCtx.measureText(line).width;
        
        if (creditState.textAlign === 'left') cx = 20;
        else if (creditState.textAlign === 'center') cx = w / 2 - lineWidth / 2;
        else if (creditState.textAlign === 'right') cx = w - 20 - lineWidth;

        if (creditState.strokeWidth > 0) targetCtx.strokeText(line, cx, y);
        const tempShadow = creditState.shadowColor;
        if (creditState.strokeWidth > 0) targetCtx.shadowColor = 'transparent';
        targetCtx.fillText(line, cx, y);
        targetCtx.shadowColor = tempShadow;
    });

    targetCtx.restore();
}

// --- 통합 애니메이션 루프 ---
function startAnimationLoop() {
    clearTimeout(animationInterval);
    isPlaying = true;
    isFinished = false;

    let totalFrames = 0;
    let frameDelayMs = 0;

    if (currentTab === 'typing') {
        if (generatedFrames.length === 0) return;
        totalFrames = generatedFrames.length;
        frameDelayMs = 1000 / state.fps;
    } else if (currentTab === 'glitch') {
        if (glitchGeneratedFrames.length === 0) return;
        totalFrames = glitchGeneratedFrames.length;
        frameDelayMs = 1000 / glitchState.fps;
    } else {
        if (!creditFramesInfo.totalFrames) return;
        totalFrames = creditFramesInfo.totalFrames;
        frameDelayMs = 1000 / creditState.fps;
    }
    
    let estimatedMB = "0.00";
    if (totalFrames > 0) {
        const rawBytes = canvas.width * canvas.height * 4 * totalFrames;
        let isCompressed = true;
        if (currentTab === 'typing') isCompressed = state.apngCompress;
        else if (currentTab === 'glitch') isCompressed = glitchState.apngCompress;
        else if (currentTab === 'credit') isCompressed = creditState.apngCompress;

        const compressRatio = isCompressed ? 0.04 : 0.25; 
        estimatedMB = (rawBytes * compressRatio / (1024 * 1024)).toFixed(2);
    }

    function nextFrame() {
        if (!isPlaying) return;

        if (currentFrameIndex < totalFrames) {
            if (currentTab === 'typing') {
                const frameData = generatedFrames[currentFrameIndex];
                renderTextDataToCanvas(ctx, frameData, canvas.width, canvas.height, state, currentFrameIndex);
                let delay = frameData.isHold ? state.holdLast : frameDelayMs;
                animationInterval = setTimeout(nextFrame, delay);
            } else if (currentTab === 'glitch') {
                const frameData = glitchGeneratedFrames[currentFrameIndex];
                renderTextDataToCanvas(ctx, frameData, canvas.width, canvas.height, glitchState, currentFrameIndex);
                let delay = frameData.isHold ? glitchState.holdLast : frameDelayMs;
                animationInterval = setTimeout(nextFrame, delay);
            } else {
                renderCreditBlockToCanvas(ctx, canvas.width, canvas.height, currentFrameIndex, creditFramesInfo.totalFrames, creditFramesInfo.textBlock);
                animationInterval = setTimeout(nextFrame, frameDelayMs);
            }
            
            statusEl.textContent = `프레임: ${currentFrameIndex + 1} / ${totalFrames} (예상: ~${estimatedMB}MB)`;
            currentFrameIndex++;
        } else {
            isFinished = true;
            animationInterval = setTimeout(() => {
                if (isPlaying) playPreview();
            }, frameDelayMs);
        }
    }
    
    nextFrame();
}

function playPreview() {
    clearTimeout(animationInterval);
    currentFrameIndex = 0;

    if (currentTab === 'typing') {
        canvas.width = state.canvasWidth; canvas.height = state.canvasHeight;
        if (generatedFrames.length === 0) {
            renderTextDataToCanvas(ctx, { chars: [], globalAlpha: 1.0 }, canvas.width, canvas.height, state, 0);
            statusEl.textContent = `프레임: 0 / 0 (예상: ~0.00MB)`;
            return;
        }
    } else if (currentTab === 'glitch') {
        canvas.width = glitchState.canvasWidth; canvas.height = glitchState.canvasHeight;
        if (glitchGeneratedFrames.length === 0) {
            renderTextDataToCanvas(ctx, { chars: [], globalAlpha: 1.0 }, canvas.width, canvas.height, glitchState, 0);
            statusEl.textContent = `프레임: 0 / 0 (예상: ~0.00MB)`;
            return;
        }
    } else {
        canvas.width = creditState.canvasWidth; canvas.height = creditState.canvasHeight;
        if (!creditFramesInfo.totalFrames) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            statusEl.textContent = `프레임: 0 / 0 (예상: ~0.00MB)`;
            return;
        }
    }

    startAnimationLoop();
}

function pausePreview() { clearTimeout(animationInterval); isPlaying = false; }

function resumePreview() {
    if (isPlaying) return;
    let totalFrames = currentTab === 'typing' ? generatedFrames.length : (currentTab === 'glitch' ? glitchGeneratedFrames.length : creditFramesInfo.totalFrames);
    if (isFinished || currentFrameIndex >= totalFrames) playPreview();
    else startAnimationLoop();
}

function autoSizeCanvas() {
    if (currentTab === 'credit') return alert("타자 및 글리치 효과 모드에서만 지원되는 기능입니다.");
    
    const frames = currentTab === 'typing' ? generatedFrames : glitchGeneratedFrames;
    const currentState = currentTab === 'typing' ? state : glitchState;

    if (frames.length === 0) return alert("텍스트가 없습니다.");

    const tempW = 3000, tempH = 3000;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = tempW; offCanvas.height = tempH;
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

    const origAlign = currentState.textAlign, origVAlign = currentState.verticalAlign, origUseBg = currentState.useBackgroundColor;
    currentState.textAlign = 'center'; currentState.verticalAlign = 'center'; currentState.useBackgroundColor = false; 

    let maxCharsFrame = frames[0];
    for (let f of frames) {
        if (f.chars.length > maxCharsFrame.chars.length) maxCharsFrame = f;
    }
    let measureFrame = { globalAlpha: 1.0, chars: maxCharsFrame.chars.map(c => ({...c, alpha: 1.0})) };
    
    renderTextDataToCanvas(offCtx, measureFrame, tempW, tempH, currentState, 0);
    
    currentState.textAlign = origAlign; currentState.verticalAlign = origVAlign; currentState.useBackgroundColor = origUseBg;

    const imgData = offCtx.getImageData(0, 0, tempW, tempH);
    const data = imgData.data;
    let minX = tempW, minY = tempH, maxX = 0, maxY = 0;
    let found = false;

    for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) {
            const pixelIndex = (i - 3) / 4;
            const x = pixelIndex % tempW, y = Math.floor(pixelIndex / tempW);
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
            found = true;
        }
    }

    if (found) {
        const padding = 60;
        currentState.canvasWidth = Math.ceil(maxX - minX + padding);
        currentState.canvasHeight = Math.ceil(maxY - minY + padding);
        
        if (currentTab === 'typing') {
            inputs['canvasWidth'].value = currentState.canvasWidth;
            inputs['canvasHeight'].value = currentState.canvasHeight;
        } else {
            glitchInputs['canvasWidth'].value = currentState.canvasWidth;
            glitchInputs['canvasHeight'].value = currentState.canvasHeight;
        }
        playPreview();
    } else {
        alert("텍스트 영역을 찾을 수 없습니다.");
    }
}

// --- 내보내기 통합 로직 ---
async function exportAPNG() {
    if (currentTab === 'typing' || currentTab === 'glitch') {
        const frames = currentTab === 'typing' ? generatedFrames : glitchGeneratedFrames;
        const currentState = currentTab === 'typing' ? state : glitchState;

        if (frames.length === 0) return alert("텍스트가 없습니다.");
        exportOverlay.classList.remove('hidden');
        exportOverlay.textContent = 'APNG 렌더링 중입니다...';
        await new Promise(resolve => setTimeout(resolve, 50));

        const w = currentState.canvasWidth, h = currentState.canvasHeight;
        const offCanvas = document.createElement('canvas');
        offCanvas.width = w; offCanvas.height = h;
        const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

        let finalFrameData = [], delays = [];
        const frameDelayMs = 1000 / currentState.fps;
        const cnum = currentState.apngCompress ? 256 : 0;
        
        for (let i = 0; i < frames.length; i++) {
            const frameData = frames[i];
            renderTextDataToCanvas(offCtx, frameData, w, h, currentState, i);
            finalFrameData.push(offCtx.getImageData(0, 0, w, h).data.buffer);
            delays.push(frameData.isHold ? currentState.holdLast : frameDelayMs);
        }

        try {
            const apngBuffer = UPNG.encode(finalFrameData, w, h, cnum, delays);
            downloadBlob(new Blob([apngBuffer], { type: 'image/png' }), `${currentTab}_${new Date().getTime()}.png`);
        } catch (e) { alert("APNG 생성 중 오류가 발생했습니다."); } 
        finally { exportOverlay.classList.add('hidden'); }
    } else {
        if (!creditState.text) return alert("텍스트가 없습니다.");
        exportOverlay.classList.remove('hidden');
        
        const blocks = creditState.splitMode ? creditState.text.split(/\n\s*\n/) : [creditState.text];
        const totalChars = blocks.reduce((acc, b) => acc + b.length, 0);
        const w = creditState.canvasWidth, h = creditState.canvasHeight;
        
        for (let bIdx = 0; bIdx < blocks.length; bIdx++) {
            const blockText = blocks[bIdx].trim();
            if (!blockText) continue;

            exportOverlay.textContent = creditState.splitMode ? `APNG 렌더링 중... (${bIdx + 1} / ${blocks.length})` : 'APNG 렌더링 중...';
            await new Promise(resolve => setTimeout(resolve, 50));

            let blockDuration = creditState.totalDuration;
            if (creditState.splitMode && totalChars > 0) {
                blockDuration = creditState.totalDuration * (blockText.length / totalChars);
            }
            
            const framesCount = Math.max(2, Math.floor(blockDuration * creditState.fps));
            const offCanvas = document.createElement('canvas');
            offCanvas.width = w; offCanvas.height = h;
            const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

            let finalFrameData = [], delays = [];
            const frameDelayMs = 1000 / creditState.fps;
            const cnum = creditState.apngCompress ? 256 : 0;

            for (let i = 0; i < framesCount; i++) {
                renderCreditBlockToCanvas(offCtx, w, h, i, framesCount, blockText);
                finalFrameData.push(offCtx.getImageData(0, 0, w, h).data.buffer);
                delays.push(frameDelayMs);
            }

            try {
                const apngBuffer = UPNG.encode(finalFrameData, w, h, cnum, delays);
                const firstLineSnippet = blockText.split('\n')[0].substring(0, 10).replace(/[^a-zA-Z0-9가-힣]/g, '');
                const timestamp = new Date().getTime();
                const fileName = creditState.splitMode ? `${bIdx + 1}_${firstLineSnippet}_${timestamp}.png` : `credit_${timestamp}.png`;
                
                downloadBlob(new Blob([apngBuffer], { type: 'image/png' }), fileName);
                if (creditState.splitMode && bIdx < blocks.length - 1) await new Promise(resolve => setTimeout(resolve, 800)); 
            } catch (e) { alert("APNG 생성 중 오류가 발생했습니다."); }
        }
        exportOverlay.classList.add('hidden');
    }
}

async function exportGIF() {
    let workerUrl;
    try {
        const res = await fetch('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js');
        workerUrl = URL.createObjectURL(new Blob([await res.text()], {type: 'application/javascript'}));
    } catch (e) { return alert("GIF 렌더링 준비 중 오류가 발생했습니다. 네트워크를 확인하세요."); }

    if (currentTab === 'typing' || currentTab === 'glitch') {
        const frames = currentTab === 'typing' ? generatedFrames : glitchGeneratedFrames;
        const currentState = currentTab === 'typing' ? state : glitchState;

        if (frames.length === 0) return alert("텍스트가 없습니다.");
        exportOverlay.classList.remove('hidden');
        exportOverlay.textContent = 'GIF 렌더링 중입니다...';
        await new Promise(resolve => setTimeout(resolve, 50));

        const w = currentState.canvasWidth, h = currentState.canvasHeight;
        const gif = new GIF({ workers: 2, quality: 10, workerScript: workerUrl, width: w, height: h, transparent: currentState.useBackgroundColor ? null : 'rgba(0,0,0,0)' });
        const offCanvas = document.createElement('canvas');
        offCanvas.width = w; offCanvas.height = h;
        const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
        const frameDelayMs = 1000 / currentState.fps;

        for (let i = 0; i < frames.length; i++) {
            const frameData = frames[i];
            renderTextDataToCanvas(offCtx, frameData, w, h, currentState, i);
            gif.addFrame(offCanvas, { delay: frameData.isHold ? currentState.holdLast : frameDelayMs, copy: true });
        }

        gif.on('finished', function(blob) {
            downloadBlob(blob, `${currentTab}_${new Date().getTime()}.gif`);
            URL.revokeObjectURL(workerUrl);
            exportOverlay.classList.add('hidden');
        });
        gif.render();
    } else {
        if (!creditState.text) return alert("텍스트가 없습니다.");
        exportOverlay.classList.remove('hidden');
        
        const blocks = creditState.splitMode ? creditState.text.split(/\n\s*\n/) : [creditState.text];
        const totalChars = blocks.reduce((acc, b) => acc + b.length, 0);
        const w = creditState.canvasWidth, h = creditState.canvasHeight;

        for (let bIdx = 0; bIdx < blocks.length; bIdx++) {
            const blockText = blocks[bIdx].trim();
            if (!blockText) continue;

            exportOverlay.textContent = creditState.splitMode ? `GIF 렌더링 중... (${bIdx + 1} / ${blocks.length})` : 'GIF 렌더링 중...';
            await new Promise(resolve => setTimeout(resolve, 50));

            let blockDuration = creditState.totalDuration;
            if (creditState.splitMode && totalChars > 0) {
                blockDuration = creditState.totalDuration * (blockText.length / totalChars);
            }
            
            const framesCount = Math.max(2, Math.floor(blockDuration * creditState.fps));
            const gif = new GIF({ workers: 2, quality: 10, workerScript: workerUrl, width: w, height: h, transparent: creditState.useBackgroundColor ? null : 'rgba(0,0,0,0)' });
            
            const offCanvas = document.createElement('canvas');
            offCanvas.width = w; offCanvas.height = h;
            const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
            const frameDelayMs = 1000 / creditState.fps;

            for (let i = 0; i < framesCount; i++) {
                renderCreditBlockToCanvas(offCtx, w, h, i, framesCount, blockText);
                gif.addFrame(offCanvas, { delay: frameDelayMs, copy: true });
            }

            const firstLineSnippet = blockText.split('\n')[0].substring(0, 10).replace(/[^a-zA-Z0-9가-힣]/g, '');
            const timestamp = new Date().getTime();
            const fileName = creditState.splitMode ? `${bIdx + 1}_${firstLineSnippet}_${timestamp}.gif` : `credit_${timestamp}.gif`;

            await new Promise((resolve) => {
                gif.on('finished', function(blob) {
                    downloadBlob(blob, fileName);
                    resolve();
                });
                gif.render();
            });
            if (creditState.splitMode && bIdx < blocks.length - 1) await new Promise(resolve => setTimeout(resolve, 800));
        }
        URL.revokeObjectURL(workerUrl);
        exportOverlay.classList.add('hidden');
    }
}

function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// --- 오디오 처리 ---
function audioBufferToWav(buffer) {
    let numOfChan = buffer.numberOfChannels, length = buffer.length * numOfChan * 2 + 44,
        bufferArray = new ArrayBuffer(length), view = new DataView(bufferArray),
        channels = [], i, sample, offset = 0, pos = 0;

    function setUint16(data) { view.setUint16(offset, data, true); offset += 2; }
    function setUint32(data) { view.setUint32(offset, data, true); offset += 4; }

    setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157); setUint32(0x20746d66);
    setUint32(16); setUint16(1); setUint16(numOfChan); setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); setUint16(numOfChan * 2); setUint16(16);
    setUint32(0x61746164); setUint32(length - pos - 4);

    for(i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));

    while(pos < buffer.length) {
        for(i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][pos])); 
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; 
            view.setInt16(offset, sample, true); offset += 2;
        }
        pos++;
    }
    return new Blob([bufferArray], {type: "audio/wav"});
}

document.getElementById('input-audio').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    try {
        uploadedAudioBuffer = await audioCtx.decodeAudioData(await file.arrayBuffer());
        alert("효과음이 성공적으로 로드되었습니다.");
        document.getElementById('btn-generate-audio').disabled = false;
    } catch (err) { alert("오디오 파일을 디코딩할 수 없습니다."); }
});

document.getElementById('btn-generate-audio').addEventListener('click', async () => {
    if (!uploadedAudioBuffer) return alert("먼저 효과음을 업로드해주세요.");
    if (rawTypingFrameCount === 0) return alert("텍스트가 없습니다.");

    exportOverlay.classList.remove('hidden');
    exportOverlay.textContent = '효과음 생성 중입니다...';
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
        const frameDelaySeconds = 1.0 / state.fps;
        const typingDuration = rawTypingFrameCount * frameDelaySeconds;
        const holdLastSeconds = state.holdLast / 1000;
        const fadeOutTime = 0.2;
        let totalDuration = typingDuration + holdLastSeconds;

        if (state.audioMode === 'smart') totalDuration = Math.max(totalDuration, typingDuration + fadeOutTime);
        else totalDuration = Math.max(totalDuration, typingDuration + uploadedAudioBuffer.duration);

        const offlineCtx = new OfflineAudioContext(uploadedAudioBuffer.numberOfChannels, Math.ceil(totalDuration * uploadedAudioBuffer.sampleRate), uploadedAudioBuffer.sampleRate);
        const globalGain = offlineCtx.createGain();
        globalGain.connect(offlineCtx.destination);

        if (state.audioMode === 'smart') {
            globalGain.gain.setValueAtTime(1.0, 0);
            globalGain.gain.setValueAtTime(1.0, typingDuration);
            globalGain.gain.linearRampToValueAtTime(0.0001, typingDuration + fadeOutTime);
        }

        let nextAllowedTime = 0;
        for (let i = 0; i < rawTypingFrameCount; i++) {
            const currentTime = i * frameDelaySeconds;
            if (state.audioMode === 'smart' && currentTime < nextAllowedTime) continue;
            if (state.audioMode === 'smart') nextAllowedTime = currentTime + uploadedAudioBuffer.duration;

            const source = offlineCtx.createBufferSource();
            source.buffer = uploadedAudioBuffer;
            source.connect(globalGain);
            source.start(currentTime);
        }

        const renderedBuffer = await offlineCtx.startRendering();
        if (generatedAudioBlobUrl) URL.revokeObjectURL(generatedAudioBlobUrl);
        generatedAudioBlobUrl = URL.createObjectURL(audioBufferToWav(renderedBuffer));

        const audioPreview = document.getElementById('audio-preview');
        audioPreview.src = generatedAudioBlobUrl;
        audioPreview.classList.remove('hidden');
        document.getElementById('btn-download-audio').classList.remove('hidden');
    } catch (err) { alert("효과음 생성 중 오류가 발생했습니다."); } 
    finally { exportOverlay.classList.add('hidden'); }
});

document.getElementById('btn-download-audio').addEventListener('click', () => {
    if (generatedAudioBlobUrl) downloadBlob(generatedAudioBlobUrl, `sound_${new Date().getTime()}.wav`);
});

document.getElementById('btn-generate-silent-audio').addEventListener('click', async () => {
    if (!creditState.text) return alert("텍스트가 없습니다.");
    exportOverlay.classList.remove('hidden');
    
    const blocks = creditState.splitMode ? creditState.text.split(/\n\s*\n/) : [creditState.text];
    const totalChars = blocks.reduce((acc, b) => acc + b.length, 0);
    const extension = creditState.silentAudioExtension || 0;
    
    for (let bIdx = 0; bIdx < blocks.length; bIdx++) {
        const blockText = blocks[bIdx].trim();
        if (!blockText) continue;

        exportOverlay.textContent = creditState.splitMode ? `무음 오디오 렌더링 중... (${bIdx + 1} / ${blocks.length})` : '무음 오디오 렌더링 중...';
        await new Promise(resolve => setTimeout(resolve, 50));

        let blockDuration = creditState.totalDuration;
        if (creditState.splitMode && totalChars > 0) {
            blockDuration = creditState.totalDuration * (blockText.length / totalChars);
        }
        
        const totalDuration = blockDuration + extension;
        if (totalDuration <= 0) continue;

        try {
            const sampleRate = 44100;
            const offlineCtx = new OfflineAudioContext(1, Math.ceil(totalDuration * sampleRate), sampleRate);
            const renderedBuffer = await offlineCtx.startRendering();
            const wavBlob = audioBufferToWav(renderedBuffer);

            const firstLineSnippet = blockText.split('\n')[0].substring(0, 10).replace(/[^a-zA-Z0-9가-힣]/g, '');
            const timestamp = new Date().getTime();
            const fileName = creditState.splitMode ? `${bIdx + 1}_${firstLineSnippet}_${timestamp}.wav` : `silent_${timestamp}.wav`;
            
            downloadBlob(wavBlob, fileName);
            if (creditState.splitMode && bIdx < blocks.length - 1) await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) { alert("무음 오디오 생성 중 오류가 발생했습니다."); }
    }
    exportOverlay.classList.add('hidden');
});

// --- 초기화 및 이벤트 등록 ---
document.addEventListener('DOMContentLoaded', () => {
    for (const key in inputs) { inputs[key].addEventListener('input', updateStateFromUI); inputs[key].addEventListener('change', updateStateFromUI); }
    for (const key in glitchInputs) { glitchInputs[key].addEventListener('input', updateGlitchStateFromUI); glitchInputs[key].addEventListener('change', updateGlitchStateFromUI); }
    for (const key in creditInputs) { creditInputs[key].addEventListener('input', updateCreditStateFromUI); creditInputs[key].addEventListener('change', updateCreditStateFromUI); }
    splitModeRadios.forEach(radio => radio.addEventListener('change', updateCreditStateFromUI));

    document.getElementById('btn-save-local').addEventListener('click', () => {
        localStorage.setItem('anim-text-settings', JSON.stringify({ typing: state, glitch: glitchState, credit: creditState }));
        alert('로컬에 설정이 저장되었습니다.');
    });

    document.getElementById('btn-load-local').addEventListener('click', () => {
        const data = localStorage.getItem('anim-text-settings');
        if (data) {
            const parsed = JSON.parse(data);
            state = { ...DEFAULT_STATE, ...(parsed.typing || {}) };
            glitchState = { ...GLITCH_DEFAULT_STATE, ...(parsed.glitch || {}) };
            creditState = { ...CREDIT_DEFAULT_STATE, ...(parsed.credit || {}) };
            updateUIFromState();
        } else alert('저장된 로컬 데이터가 없습니다.');
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
        if(confirm('모든 설정을 초기화하시겠습니까?')) {
            state = { ...DEFAULT_STATE };
            glitchState = { ...GLITCH_DEFAULT_STATE };
            creditState = { ...CREDIT_DEFAULT_STATE };
            updateUIFromState();
        }
    });

    document.getElementById('btn-export-json').addEventListener('click', () => {
        const blob = new Blob([JSON.stringify({ typing: state, glitch: glitchState, credit: creditState }, null, 2)], { type: 'application/json' });
        downloadBlob(blob, `settings_${new Date().getTime()}.json`);
    });

    document.getElementById('input-import-json').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = JSON.parse(evt.target.result);
                state = { ...DEFAULT_STATE, ...(data.typing || data) }; 
                glitchState = { ...GLITCH_DEFAULT_STATE, ...(data.glitch || {}) };
                creditState = { ...CREDIT_DEFAULT_STATE, ...(data.credit || {}) };
                updateUIFromState();
                e.target.value = '';
            } catch (err) { alert('잘못된 JSON 파일입니다.'); }
        };
        reader.readAsText(file);
    });

    document.getElementById('btn-play-preview').addEventListener('click', playPreview);
    document.getElementById('btn-pause-preview').addEventListener('click', pausePreview);
    document.getElementById('btn-resume-preview').addEventListener('click', resumePreview);
    
    document.getElementById('btn-auto-size').addEventListener('click', autoSizeCanvas);
    document.getElementById('btn-glitch-auto-size').addEventListener('click', autoSizeCanvas);
    
    document.getElementById('btn-export-apng').addEventListener('click', exportAPNG);
    document.getElementById('btn-export-gif').addEventListener('click', exportGIF);

    setTimeout(() => updateUIFromState(), 100);
});