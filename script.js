// --- 상수 및 유틸리티 ---
const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

// 한글 문자를 초/중/종성 단계별로 분리
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
        if (jongIdx > 0) {
            steps.push(char);
        }
        return steps;
    }
    return [char]; // 한글이 아니면 그대로 반환
}

// --- 상태 관리 ---
const DEFAULT_STATE = {
    text: "유이타,\n파이팅!",
    fontFamilySelect: "Noto Sans KR",
    fontFamilyCustom: "",
    fontFamily: "Noto Sans KR", 
    fontSize: 48,
    scaleX: 100,
    letterSpacing: 0,
    lineHeight: 1.2,
    isBold: false,
    isItalic: false,
    isUnderline: false,
    isStrikethrough: false,
    writingMode: "horizontal",
    textAlign: "center",
    verticalAlign: "center",
    direction: "forward",
    shapeMode: "none",
    shapeSize: 100,
    shapeRotateSpeed: 0,
    useBackgroundColor: false,
    backgroundColor: "#000000",
    fillColor: "#ffffff",
    strokeColor: "#000000",
    strokeWidth: 4,
    shadowColor: "#000000",
    shadowBlur: 4,
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    fps: 12,
    holdLast: 2000,
    fadeMode: "none",
    fadeOutDuration: 1000,
    canvasWidth: 600,
    canvasHeight: 300,
    audioMode: "overlap"
};

let state = { ...DEFAULT_STATE };
let loadedFonts = new Set();
let animationInterval = null;
let generatedFrames = []; // 완성된 프레임 데이터 배열
let rawTypingFrameCount = 0; // 순수하게 글자가 타이핑되는 횟수 (오디오 생성용)
let currentFrameIndex = 0;
let isPlaying = true;
let isFinished = false;

// 오디오 관련 전역 변수
let audioCtx = null;
let uploadedAudioBuffer = null;
let generatedAudioBlobUrl = null;

// UI 요소 캐싱
const inputs = Object.keys(DEFAULT_STATE).reduce((acc, key) => {
    const el = document.getElementById(`val-${key}`);
    if (el) acc[key] = el;
    return acc;
}, {});

const canvas = document.getElementById('preview-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const statusEl = document.getElementById('preview-status');
const exportOverlay = document.getElementById('export-overlay');

// --- 핵심 로직 ---

function updateStateFromUI() {
    for (const key in inputs) {
        const el = inputs[key];
        if (el.type === 'number') {
            state[key] = parseFloat(el.value);
        } else if (el.type === 'checkbox') {
            state[key] = el.checked;
        } else if (el.type !== 'file') {
            state[key] = el.value;
        }
    }
    
    if (state.fontFamilySelect === 'custom') {
        state.fontFamily = state.fontFamilyCustom || 'sans-serif';
        document.getElementById('custom-font-container').style.display = 'block';
    } else {
        state.fontFamily = state.fontFamilySelect;
        document.getElementById('custom-font-container').style.display = 'none';
    }

    loadFont(state.fontFamilySelect !== 'custom' ? state.fontFamilySelect : null);
    generateTypingFrames();
    playPreview();
}

function updateUIFromState() {
    for (const key in inputs) {
        if (inputs[key]) {
            if (inputs[key].type === 'checkbox') {
                inputs[key].checked = state[key];
            } else {
                inputs[key].value = state[key];
            }
        }
    }
    
    if (state.fontFamilySelect === 'custom') {
        document.getElementById('custom-font-container').style.display = 'block';
        state.fontFamily = state.fontFamilyCustom || 'sans-serif';
    } else {
        document.getElementById('custom-font-container').style.display = 'none';
        state.fontFamily = state.fontFamilySelect;
    }

    loadFont(state.fontFamilySelect !== 'custom' ? state.fontFamilySelect : null);
    generateTypingFrames();
    playPreview();
}

function loadFont(fontFamily) {
    if (!fontFamily || loadedFonts.has(fontFamily)) return;
    const fontId = 'font-' + fontFamily.replace(/\s+/g, '-');
    if (!document.getElementById(fontId)) {
        const link = document.createElement('link');
        link.id = fontId;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, '+')}&display=swap`;
        document.head.appendChild(link);
        loadedFonts.add(fontFamily);
    }
}

// 입력 텍스트를 분석하여 프레임별 상태 데이터 배열(각 글자의 정보 포함) 생성
function generateTypingFrames() {
    let fullText = state.text;
    
    // 텍스트가 비어있을 때 예외 처리
    if (!fullText) {
        generatedFrames = [];
        rawTypingFrameCount = 0;
        return;
    }

    let processText = state.direction === 'backward' ? fullText.split('').reverse().join('') : fullText;
    let framesList = []; 
    let currentChars = [];

    // 1. 프레임별 타이핑 과정 생성
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
        for (let f = 0; f < framesList.length; f++) {
            framesList[f].sort((a, b) => a.origIdx - b.origIdx);
        }
    }

    rawTypingFrameCount = framesList.length; // 오디오 병합 시 사용할 타이핑 횟수

    // 2. 글자별 타이핑 완료 시점 스캔
    let finishFrames = {};
    for (let i = 0; i < processText.length; i++) {
        const origIdx = state.direction === 'backward' ? (processText.length - 1 - i) : i;
        const finalChar = processText[i];
        
        for (let f = 0; f < framesList.length; f++) {
            const item = framesList[f].find(x => x.origIdx === origIdx);
            if (item && item.char === finalChar) {
                finishFrames[origIdx] = f;
                break;
            }
        }
    }

    const fadeFramesCount = Math.max(1, Math.round((state.fadeOutDuration / 1000) * state.fps));
    let finalFrames = [];

    // 3. 각 프레임 객체 생성 및 개별 페이드아웃 투명도 적용
    for (let f = 0; f < framesList.length; f++) {
        let frameData = {
            chars: [],
            isHold: false,
            globalAlpha: 1.0
        };
        
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

    // 4. 모드에 따른 마지막 대기 및 추가 연장 프레임 처리
    if (state.fadeMode === 'global') {
        finalFrames[finalFrames.length - 1].isHold = true;
        if (state.fadeOutDuration > 0) {
            const lastFrameChars = framesList[framesList.length - 1];
            for (let i = 1; i <= fadeFramesCount; i++) {
                finalFrames.push({
                    chars: lastFrameChars.map(c => ({...c, alpha: 1.0})),
                    isHold: false,
                    globalAlpha: Math.max(0, 1.0 - (i / fadeFramesCount))
                });
            }
        }
    } else if (state.fadeMode === 'individual') {
        if (state.fadeOutDuration > 0) {
            const lastFrameChars = framesList[framesList.length - 1];
            for (let i = 1; i <= fadeFramesCount; i++) {
                let frameData = {
                    chars: [],
                    isHold: (i === fadeFramesCount),
                    globalAlpha: 1.0
                };
                const currentF = framesList.length - 1 + i;
                for (let c of lastFrameChars) {
                    const finishedAt = finishFrames[c.origIdx];
                    let alpha = 1.0;
                    if (finishedAt !== undefined && currentF > finishedAt) {
                        const age = currentF - finishedAt;
                        alpha = Math.max(0, 1.0 - (age / fadeFramesCount));
                    }
                    frameData.chars.push({ char: c.char, alpha: alpha, origIdx: c.origIdx });
                }
                finalFrames.push(frameData);
            }
        } else {
            finalFrames[finalFrames.length - 1].isHold = true;
        }
    } else {
        finalFrames[finalFrames.length - 1].isHold = true;
    }

    // --- 5. 도형 모드 시 대기 시간(isHold) 프레임 연속 전개 ---
    // 도형 회전을 자연스럽게 유지하기 위해 하나의 긴 대기 프레임을 여러 개의 정상 프레임으로 분할
    if (state.shapeMode !== 'none' && state.shapeRotateSpeed !== 0) {
        let expandedFrames = [];
        for (let i = 0; i < finalFrames.length; i++) {
            const f = finalFrames[i];
            if (f.isHold) {
                const holdFramesCount = Math.max(1, Math.round((state.holdLast / 1000) * state.fps));
                for (let j = 0; j < holdFramesCount; j++) {
                    expandedFrames.push({
                        chars: f.chars,
                        globalAlpha: f.globalAlpha,
                        isHold: false // 대기 속성을 해제하고 실제 프레임으로 전개
                    });
                }
            } else {
                expandedFrames.push(f);
            }
        }
        finalFrames = expandedFrames;
    }

    generatedFrames = finalFrames;
}

function getShapePoint(mode, size, dist) {
    if (mode === 'circle') {
        const circum = 2 * Math.PI * size;
        const a = (dist / circum) * 2 * Math.PI - Math.PI / 2;
        return { x: Math.cos(a) * size, y: Math.sin(a) * size, rot: a + Math.PI / 2 };
    } else if (mode === 'square') {
        const p = 8 * size;
        const d = dist % p;
        if (d < 2 * size) return { x: -size + d, y: -size, rot: 0 };
        if (d < 4 * size) return { x: size, y: -size + (d - 2*size), rot: Math.PI / 2 };
        if (d < 6 * size) return { x: size - (d - 4*size), y: size, rot: Math.PI };
        return { x: -size, y: size - (d - 6*size), rot: Math.PI * 1.5 };
    } else if (mode === 'triangle') {
        const cos30 = Math.sqrt(3) / 2, sin30 = 0.5;
        const A = { x: 0, y: -size };
        const B = { x: size * cos30, y: size * sin30 };
        const C = { x: -size * cos30, y: size * sin30 };
        const sideLen = Math.sqrt(3) * size;
        const p = 3 * sideLen;
        const d = dist % p;
        
        if (d < sideLen) {
            const t = d / sideLen;
            return { x: A.x + t*(B.x - A.x), y: A.y + t*(B.y - A.y), rot: Math.atan2(B.y - A.y, B.x - A.x) };
        } else if (d < 2 * sideLen) {
            const t = (d - sideLen) / sideLen;
            return { x: B.x + t*(C.x - B.x), y: B.y + t*(C.y - B.y), rot: Math.atan2(C.y - B.y, C.x - B.x) };
        } else {
            const t = (d - 2 * sideLen) / sideLen;
            return { x: C.x + t*(A.x - C.x), y: C.y + t*(A.y - C.y), rot: Math.atan2(A.y - C.y, A.x - C.x) };
        }
    }
    return { x: 0, y: 0, rot: 0 };
}

// 캔버스 렌더링 엔진 
function renderTextToCanvas(targetCtx, frameData, w, h, frameIndex = 0) {
    if (state.useBackgroundColor) {
        targetCtx.fillStyle = state.backgroundColor;
        targetCtx.fillRect(0, 0, w, h);
    } else {
        targetCtx.clearRect(0, 0, w, h);
    }
    targetCtx.save();

    const fontStyle = state.isItalic ? "italic " : "";
    const fontWeight = state.isBold ? "bold " : "";
    targetCtx.font = `${fontStyle}${fontWeight}${state.fontSize}px "${state.fontFamily}", sans-serif`;
    targetCtx.textBaseline = 'top';
    targetCtx.fillStyle = state.fillColor;
    targetCtx.strokeStyle = state.strokeColor;
    targetCtx.lineWidth = state.strokeWidth;
    targetCtx.lineJoin = 'round';

    targetCtx.shadowColor = state.shadowColor;
    targetCtx.shadowBlur = state.shadowBlur;
    targetCtx.shadowOffsetX = state.shadowOffsetX;
    targetCtx.shadowOffsetY = state.shadowOffsetY;

    if (targetCtx.letterSpacing !== undefined) {
        targetCtx.letterSpacing = `${state.letterSpacing}px`;
    }

    // 도형 모드 렌더링
    if (state.shapeMode !== 'none') {
        targetCtx.translate(w / 2, h / 2);
        
        const globalRotation = frameIndex * state.shapeRotateSpeed * (Math.PI / 180);
        targetCtx.rotate(globalRotation);

        targetCtx.textBaseline = 'bottom';
        targetCtx.textAlign = 'center';

        const shapeChars = frameData.chars.filter(c => c.char !== '\n');
        let currentDist = 0;

        for (let i = 0; i < shapeChars.length; i++) {
            const c = shapeChars[i];
            const charWidth = targetCtx.measureText(c.char).width + state.letterSpacing;
            const d = currentDist + charWidth / 2;
            
            const pt = getShapePoint(state.shapeMode, state.shapeSize, d);
            const finalAlpha = frameData.globalAlpha * c.alpha;

            if (finalAlpha > 0) {
                targetCtx.save();
                targetCtx.translate(pt.x, pt.y);
                targetCtx.rotate(pt.rot);
                targetCtx.globalAlpha = finalAlpha;

                if (state.strokeWidth > 0) targetCtx.strokeText(c.char, 0, 0);
                const tempShadow = targetCtx.shadowColor;
                if (state.strokeWidth > 0) targetCtx.shadowColor = 'transparent';
                targetCtx.fillText(c.char, 0, 0);
                
                if (state.isUnderline || state.isStrikethrough) {
                    const thickness = Math.max(1, state.fontSize * 0.06);
                    targetCtx.fillStyle = state.fillColor;
                    if (state.isUnderline) targetCtx.fillRect(-charWidth/2, state.fontSize * 0.1, charWidth, thickness);
                    if (state.isStrikethrough) targetCtx.fillRect(-charWidth/2, -state.fontSize * 0.4, charWidth, thickness);
                }

                targetCtx.shadowColor = tempShadow;
                targetCtx.restore();
            }
            currentDist += charWidth;
        }

        targetCtx.restore();
        return;
    }

    // 일반 쓰기 모드용 줄바꿈 분류
    const lines = [];
    let currentLine = [];
    for (let c of frameData.chars) {
        if (c.char === '\n') {
            lines.push(currentLine);
            currentLine = [];
        } else {
            currentLine.push(c);
        }
    }
    lines.push(currentLine);

    const lineHeightPx = state.fontSize * state.lineHeight;

    if (state.writingMode === 'horizontal') {
        targetCtx.scale(state.scaleX / 100, 1);
        let originalW = w / (state.scaleX / 100);

        const totalHeight = lines.length * lineHeightPx;
        let startY = 10;
        if (state.verticalAlign === 'center') startY = (h - totalHeight) / 2 + (lineHeightPx - state.fontSize)/2;
        if (state.verticalAlign === 'bottom') startY = h - totalHeight - 10;

        lines.forEach((lineChars, index) => {
            const y = startY + (index * lineHeightPx);
            
            let lineWidth = 0;
            for(let c of lineChars) {
                lineWidth += targetCtx.measureText(c.char).width + state.letterSpacing;
            }
            if (lineChars.length > 0) lineWidth -= state.letterSpacing;

            let cx = 0;
            if (state.textAlign === 'left') cx = 10;
            if (state.textAlign === 'center') cx = originalW / 2 - lineWidth / 2;
            if (state.textAlign === 'right') cx = originalW - 10 - lineWidth;

            targetCtx.textAlign = 'left';

            for (let c of lineChars) {
                const finalAlpha = frameData.globalAlpha * c.alpha;
                if (finalAlpha > 0) {
                    targetCtx.globalAlpha = finalAlpha;
                    if (state.strokeWidth > 0) targetCtx.strokeText(c.char, cx, y);
                    const tempShadow = targetCtx.shadowColor;
                    if (state.strokeWidth > 0) targetCtx.shadowColor = 'transparent';
                    targetCtx.fillText(c.char, cx, y);
                    
                    if (state.isUnderline || state.isStrikethrough) {
                        const thickness = Math.max(1, state.fontSize * 0.06);
                        const charRenderWidth = targetCtx.measureText(c.char).width + state.letterSpacing;
                        targetCtx.fillStyle = state.fillColor;
                        if (state.isUnderline) targetCtx.fillRect(cx, y + state.fontSize * 1.05, charRenderWidth, thickness);
                        if (state.isStrikethrough) targetCtx.fillRect(cx, y + state.fontSize * 0.5, charRenderWidth, thickness);
                    }

                    targetCtx.shadowColor = tempShadow;
                }
                cx += targetCtx.measureText(c.char).width + state.letterSpacing;
            }
        });

    } else { // 세로 쓰기
        targetCtx.textAlign = 'center';
        targetCtx.scale(state.scaleX / 100, 1);
        let originalW = w / (state.scaleX / 100);

        const totalWidth = lines.length * lineHeightPx;
        let startX = originalW - 10 - state.fontSize / 2; 
        if (state.textAlign === 'left') startX = 10 + totalWidth - state.fontSize / 2; 
        if (state.textAlign === 'center') startX = (originalW + totalWidth) / 2 - state.fontSize / 2;
        if (state.textAlign === 'right') startX = originalW - 10 - state.fontSize / 2;

        lines.forEach((lineChars, lineIndex) => {
            const currentX = startX - (lineIndex * lineHeightPx);
            const totalLineHeight = lineChars.length * (state.fontSize + state.letterSpacing) - state.letterSpacing;
            
            let startY = 10;
            if (state.verticalAlign === 'center') startY = (h - totalLineHeight) / 2;
            if (state.verticalAlign === 'bottom') startY = h - totalLineHeight - 10;

            for (let charIndex = 0; charIndex < lineChars.length; charIndex++) {
                const c = lineChars[charIndex];
                const y = startY + charIndex * (state.fontSize + state.letterSpacing);
                
                const finalAlpha = frameData.globalAlpha * c.alpha;
                if (finalAlpha > 0) {
                    targetCtx.globalAlpha = finalAlpha;
                    if (state.strokeWidth > 0) targetCtx.strokeText(c.char, currentX, y);
                    const tempShadow = targetCtx.shadowColor;
                    if (state.strokeWidth > 0) targetCtx.shadowColor = 'transparent';
                    targetCtx.fillText(c.char, currentX, y);
                    
                    if (state.isUnderline || state.isStrikethrough) {
                        const thickness = Math.max(1, state.fontSize * 0.06);
                        const charRenderHeight = state.fontSize + state.letterSpacing;
                        targetCtx.fillStyle = state.fillColor;
                        if (state.isUnderline) targetCtx.fillRect(currentX + state.fontSize * 0.55, y, thickness, charRenderHeight);
                        if (state.isStrikethrough) targetCtx.fillRect(currentX - thickness/2, y, thickness, charRenderHeight);
                    }

                    targetCtx.shadowColor = tempShadow;
                }
            }
        });
    }

    targetCtx.restore();
}

function startAnimationLoop() {
    clearTimeout(animationInterval);
    isPlaying = true;
    isFinished = false;

    if (generatedFrames.length === 0) return;
    
    const totalFrames = generatedFrames.length;
    const frameDelayMs = 1000 / state.fps;
    
    function nextFrame() {
        if (!isPlaying) return;

        if (currentFrameIndex < totalFrames) {
            const frameData = generatedFrames[currentFrameIndex];
            renderTextToCanvas(ctx, frameData, canvas.width, canvas.height, currentFrameIndex);
            statusEl.textContent = `프레임: ${currentFrameIndex + 1} / ${totalFrames}`;
            
            let delay = frameDelayMs;
            if (frameData.isHold) delay = state.holdLast;
            
            currentFrameIndex++;
            animationInterval = setTimeout(nextFrame, delay);
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
    canvas.width = state.canvasWidth;
    canvas.height = state.canvasHeight;
    currentFrameIndex = 0;

    if (generatedFrames.length === 0) {
        renderTextToCanvas(ctx, { chars: [], globalAlpha: 1.0 }, canvas.width, canvas.height, 0);
        statusEl.textContent = `프레임: 0 / 0`;
        return;
    }

    startAnimationLoop();
}

function pausePreview() {
    clearTimeout(animationInterval);
    isPlaying = false;
}

function resumePreview() {
    if (isPlaying) return;
    if (isFinished || currentFrameIndex >= generatedFrames.length) {
        playPreview();
    } else {
        startAnimationLoop();
    }
}

function autoSizeCanvas() {
    if (generatedFrames.length === 0) return alert("텍스트가 없습니다.");

    const tempW = 3000;
    const tempH = 3000;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = tempW;
    offCanvas.height = tempH;
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

    const origAlign = state.textAlign;
    const origVAlign = state.verticalAlign;
    const origUseBg = state.useBackgroundColor;
    
    state.textAlign = 'center'; 
    state.verticalAlign = 'center';
    state.useBackgroundColor = false; // 크기 측정을 위해 배경색 임시 해제

    let maxCharsFrame = generatedFrames[0];
    for (let f of generatedFrames) {
        if (f.chars.length > maxCharsFrame.chars.length) {
            maxCharsFrame = f;
        }
    }
    let measureFrame = {
        globalAlpha: 1.0,
        chars: maxCharsFrame.chars.map(c => ({...c, alpha: 1.0})) 
    };
    
    renderTextToCanvas(offCtx, measureFrame, tempW, tempH, 0);
    
    state.textAlign = origAlign;
    state.verticalAlign = origVAlign;
    state.useBackgroundColor = origUseBg; // 배경색 설정 복구

    const imgData = offCtx.getImageData(0, 0, tempW, tempH);
    const data = imgData.data;
    
    let minX = tempW, minY = tempH, maxX = 0, maxY = 0;
    let found = false;

    for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) {
            const pixelIndex = (i - 3) / 4;
            const x = pixelIndex % tempW;
            const y = Math.floor(pixelIndex / tempW);
            
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            found = true;
        }
    }

    if (found) {
        const padding = 60;
        const newW = Math.ceil(maxX - minX + padding);
        const newH = Math.ceil(maxY - minY + padding);

        state.canvasWidth = newW;
        state.canvasHeight = newH;
        inputs['canvasWidth'].value = newW;
        inputs['canvasHeight'].value = newH;
        
        playPreview();
    } else {
        alert("텍스트 영역을 찾을 수 없습니다.");
    }
}

async function exportAPNG() {
    if (generatedFrames.length === 0) return alert("텍스트가 없습니다.");

    exportOverlay.classList.remove('hidden');
    exportOverlay.textContent = 'APNG 렌더링 중입니다... 잠시만 기다려주세요.';
    
    await new Promise(resolve => setTimeout(resolve, 50));

    const w = state.canvasWidth;
    const h = state.canvasHeight;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = w;
    offCanvas.height = h;
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

    let finalFrameData = [];
    let delays = [];

    const frameDelayMs = 1000 / state.fps;
    
    for (let i = 0; i < generatedFrames.length; i++) {
        const frameData = generatedFrames[i];
        renderTextToCanvas(offCtx, frameData, w, h, i);
        const imgData = offCtx.getImageData(0, 0, w, h);
        finalFrameData.push(imgData.data.buffer);
        
        const delay = frameData.isHold ? state.holdLast : frameDelayMs;
        delays.push(delay);
    }

    try {
        const apngBuffer = UPNG.encode(finalFrameData, w, h, 0, delays);
        const blob = new Blob([apngBuffer], { type: 'image/png' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `cocoforia_text_${new Date().getTime()}.png`;
        a.click();
        
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error(error);
        alert("APNG 생성 중 오류가 발생했습니다.");
    } finally {
        exportOverlay.classList.add('hidden');
    }
}

async function exportGIF() {
    if (generatedFrames.length === 0) return alert("텍스트가 없습니다.");

    exportOverlay.classList.remove('hidden');
    exportOverlay.textContent = 'GIF 렌더링 중입니다... 잠시만 기다려주세요.';
    
    await new Promise(resolve => setTimeout(resolve, 50));

    let workerUrl;
    try {
        const res = await fetch('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js');
        const text = await res.text();
        const blob = new Blob([text], {type: 'application/javascript'});
        workerUrl = URL.createObjectURL(blob);
    } catch (e) {
        alert("GIF 렌더링 준비 중 오류가 발생했습니다. 네트워크 상태를 확인하세요.");
        exportOverlay.classList.add('hidden');
        return;
    }

    const w = state.canvasWidth;
    const h = state.canvasHeight;
    
    const gif = new GIF({
        workers: 2,
        quality: 10,
        workerScript: workerUrl,
        width: w,
        height: h,
        transparent: state.useBackgroundColor ? null : 'rgba(0,0,0,0)'
    });

    const offCanvas = document.createElement('canvas');
    offCanvas.width = w;
    offCanvas.height = h;
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

    const frameDelayMs = 1000 / state.fps;

    for (let i = 0; i < generatedFrames.length; i++) {
        const frameData = generatedFrames[i];
        renderTextToCanvas(offCtx, frameData, w, h, i);
        const delay = frameData.isHold ? state.holdLast : frameDelayMs;
        gif.addFrame(offCanvas, { delay: delay, copy: true });
    }

    gif.on('finished', function(blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cocoforia_text_${new Date().getTime()}.gif`;
        a.click();
        URL.revokeObjectURL(url);
        URL.revokeObjectURL(workerUrl);
        exportOverlay.classList.add('hidden');
    });

    gif.render();
}

// --- 오디오 처리 로직 ---

// AudioBuffer를 WAV Blob으로 변환하는 유틸리티 함수
function audioBufferToWav(buffer) {
    let numOfChan = buffer.numberOfChannels,
        length = buffer.length * numOfChan * 2 + 44,
        bufferArray = new ArrayBuffer(length),
        view = new DataView(bufferArray),
        channels = [], i, sample,
        offset = 0,
        pos = 0;

    function setUint16(data) {
        view.setUint16(offset, data, true);
        offset += 2;
    }

    function setUint32(data) {
        view.setUint32(offset, data, true);
        offset += 4;
    }

    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    for(i = 0; i < buffer.numberOfChannels; i++)
        channels.push(buffer.getChannelData(i));

    while(pos < buffer.length) {
        for(i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][pos])); 
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; 
            view.setInt16(offset, sample, true); 
            offset += 2;
        }
        pos++;
    }

    return new Blob([bufferArray], {type: "audio/wav"});
}

document.getElementById('input-audio').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const arrayBuffer = await file.arrayBuffer();
    try {
        uploadedAudioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        alert("효과음이 성공적으로 로드되었습니다.");
        document.getElementById('btn-generate-audio').disabled = false;
    } catch (err) {
        alert("오디오 파일을 디코딩할 수 없습니다. 호환되는 파일을 업로드해주세요.");
    }
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

        // 모드에 따른 총 오디오 길이 및 페이드아웃 시간 설정
        const fadeOutTime = 0.2; // 스마트 모드 페이드아웃 시간(초)
        let totalDuration = typingDuration + holdLastSeconds;


        if (state.audioMode === 'smart') {
            totalDuration = Math.max(totalDuration, typingDuration + fadeOutTime);
        } else {
            totalDuration = Math.max(totalDuration, typingDuration + uploadedAudioBuffer.duration);
        }

        const offlineCtx = new OfflineAudioContext(
            uploadedAudioBuffer.numberOfChannels,
            Math.ceil(totalDuration * uploadedAudioBuffer.sampleRate),
            uploadedAudioBuffer.sampleRate
        );

        // 전체 볼륨 제어 및 강제 페이드아웃을 위한 GainNode
        const globalGain = offlineCtx.createGain();
        globalGain.connect(offlineCtx.destination);

        if (state.audioMode === 'smart') {
            globalGain.gain.setValueAtTime(1.0, 0);
            globalGain.gain.setValueAtTime(1.0, typingDuration);
            // 타이핑이 끝난 직후부터 0.2초 동안 0으로 떨어지며 강제 종료
            globalGain.gain.linearRampToValueAtTime(0.0001, typingDuration + fadeOutTime);
        }

        let nextAllowedTime = 0;

        // 글자(초/중/종성 단위)가 하나씩 생길 때마다 사운드를 스케줄링
        for (let i = 0; i < rawTypingFrameCount; i++) {
            const currentTime = i * frameDelaySeconds;
            
            if (state.audioMode === 'smart') {
                // 스마트 모드: 이전 소리가 겹치려 하면 재생 건너뜀
                if (currentTime < nextAllowedTime) {
                    continue; 
                }
                nextAllowedTime = currentTime + uploadedAudioBuffer.duration;
            }

            const source = offlineCtx.createBufferSource();
            source.buffer = uploadedAudioBuffer;
            source.connect(globalGain);
            source.start(currentTime);
        }

        const renderedBuffer = await offlineCtx.startRendering();
        const wavBlob = audioBufferToWav(renderedBuffer);

        if (generatedAudioBlobUrl) URL.revokeObjectURL(generatedAudioBlobUrl);
        generatedAudioBlobUrl = URL.createObjectURL(wavBlob);

        const audioPreview = document.getElementById('audio-preview');
        audioPreview.src = generatedAudioBlobUrl;
        audioPreview.classList.remove('hidden');

        const btnDownload = document.getElementById('btn-download-audio');
        btnDownload.classList.remove('hidden');
        
    } catch (err) {
        console.error(err);
        alert("효과음 생성 중 오류가 발생했습니다.");
    } finally {
        exportOverlay.classList.add('hidden');
    }
});

document.getElementById('btn-download-audio').addEventListener('click', () => {
    if (!generatedAudioBlobUrl) return;
    const a = document.createElement('a');
    a.href = generatedAudioBlobUrl;
    a.download = `cocoforia_sound_${new Date().getTime()}.wav`;
    a.click();
});

// --- 이벤트 리스너 ---

document.addEventListener('DOMContentLoaded', () => {
    for (const key in inputs) {
        inputs[key].addEventListener('input', updateStateFromUI);
        inputs[key].addEventListener('change', updateStateFromUI);
    }

    document.getElementById('btn-save-local').addEventListener('click', () => {
        localStorage.setItem('cocoforia-apng-settings', JSON.stringify(state));
        alert('로컬에 설정이 저장되었습니다.');
    });

    document.getElementById('btn-load-local').addEventListener('click', () => {
        const data = localStorage.getItem('cocoforia-apng-settings');
        if (data) {
            state = { ...DEFAULT_STATE, ...JSON.parse(data) };
            updateUIFromState();
        } else {
            alert('저장된 로컬 데이터가 없습니다.');
        }
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
        if(confirm('모든 설정을 초기화하시겠습니까?')) {
            state = { ...DEFAULT_STATE };
            updateUIFromState();
        }
    });

    document.getElementById('btn-export-json').addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `text_settings_${new Date().getTime()}.json`;
        a.click();
    });

    document.getElementById('input-import-json').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = JSON.parse(evt.target.result);
                state = { ...DEFAULT_STATE, ...data };
                updateUIFromState();
                e.target.value = '';
            } catch (err) {
                alert('잘못된 JSON 파일입니다.');
            }
        };
        reader.readAsText(file);
    });

    document.getElementById('btn-play-preview').addEventListener('click', playPreview);
    document.getElementById('btn-pause-preview').addEventListener('click', pausePreview);
    document.getElementById('btn-resume-preview').addEventListener('click', resumePreview);
    document.getElementById('btn-auto-size').addEventListener('click', autoSizeCanvas);
    document.getElementById('btn-export-apng').addEventListener('click', exportAPNG);
    document.getElementById('btn-export-gif').addEventListener('click', exportGIF);

    setTimeout(() => updateUIFromState(), 100);
});
