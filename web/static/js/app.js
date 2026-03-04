/**
 * 唐卡元素识别系统 - 前端交互逻辑
 * 功能: 双模式展示（交互高亮 / YOLO标注）、Canvas 叠加层、点击弹窗、列表联动
 */

// ============================================================
// DOM 元素引用
// ============================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// 模式切换
const modeCards = $$('.mode-card');
const panels = {
    upload: $('#panel-upload'),
    camera: $('#panel-camera'),
    examples: $('#panel-examples'),
};

// 上传
const uploadZone = $('#upload-zone');
const fileInput = $('#file-input');

// 摄像头
const cameraVideo = $('#camera-video');
const cameraCanvas = $('#camera-canvas');
const btnCapture = $('#btn-capture');

// 示例
const examplesGrid = $('#examples-grid');

// 预览
const previewSection = $('#preview-section');
const previewImage = $('#preview-image');
const btnDetect = $('#btn-detect');
const btnClear = $('#btn-clear');

// 加载
const loadingSection = $('#loading-section');

// 结果
const resultSection = $('#result-section');
const statsBar = $('#stats-bar');
const detectionList = $('#detection-list');
const btnAgain = $('#btn-again');

// 视图切换
const btnViewInteractive = $('#btn-view-interactive');
const btnViewAnnotated = $('#btn-view-annotated');
const interactiveView = $('#interactive-view');
const annotatedView = $('#annotated-view');

// 交互模式
const originalImage = $('#original-image');
const overlayCanvas = $('#overlay-canvas');
const resultImage = $('#result-image');

// 弹窗
const detailModal = $('#detail-modal');
const modalClose = $('#modal-close');
const modalCropImage = $('#modal-crop-image');
const modalNameZh = $('#modal-name-zh');
const modalNameEn = $('#modal-name-en');
const modalGroup = $('#modal-group');
const modalConf = $('#modal-conf');
const modalDesc = $('#modal-desc');

// ============================================================
// 状态管理
// ============================================================
let currentMode = 'upload';
let currentImageData = null;
let cameraStream = null;
let originalDetections = [];  // 从后端获取的完整检测结果 (含低置信度)
let currentDetections = [];   // 当前过滤后的检测结果
let currentImageSize = null;  // 原图尺寸 {width, height}
let activeDetIndex = -1;      // 当前高亮的检测项索引
let currentViewMode = 'interactive'; // 当前视图模式
let isDetecting = false;      // 防重复点击锁

// 置信度滑块
const confSlider = $('#conf-slider');
const confValue = $('#conf-value');

// 为每个类别生成稳定的颜色
const CLASS_COLORS = {};
function getClassColor(className) {
    if (CLASS_COLORS[className]) return CLASS_COLORS[className];
    let hash = 0;
    for (let i = 0; i < className.length; i++) {
        hash = className.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    CLASS_COLORS[className] = `hsl(${h}, 65%, 45%)`;
    return CLASS_COLORS[className];
}

// 类别描述 (用于弹窗中显示)
const CLASS_DESCRIPTIONS = {
    "Buddha": "佛像是唐卡中最核心的主尊形象，通常位于画面中央，以端庄慈悲的面容和特定手印（如施无畏印、降魔印）呈现，象征觉悟与智慧。",
    "wrathful deity": "忿怒尊是藏传佛教中的护法神形象，面容威猛、多臂多首，代表以慈悲之力降伏邪恶，守护佛法。",
    "mandala": "曼陀罗是宇宙的微缩图景，以同心圆和方形结构组成，是冥想修行的重要辅助图案，象征佛国净土。",
    "lotus tower": "莲花塔融合了莲花与宝塔的意象，莲花代表纯净，宝塔象征佛陀法身，二者结合寓意超脱尘世。",
    "treasure": "宝物是唐卡中常见的供养品和装饰元素，包括各类珍宝，象征佛法的珍贵与富足。",
    "cloud": "云纹是唐卡背景中常见的装饰纹样，象征天界、祥瑞和超凡脱俗的境界。",
    "flower and leaf": "花叶纹样是唐卡边框和背景中的重要装饰元素，代表自然的繁荣和生命的美好。",
    "vajra": "金刚杵是密宗法器之首，象征不可摧毁的智慧力量，能断一切烦恼。",
    "vajra bell": "金刚铃与金刚杵配对使用，铃声象征智慧的传播，铃体代表空性。",
    "vajra wheel": "金刚轮又称法轮，象征佛法的传播与弘扬，轮转不息，普度众生。",
    "conch": "法螺是佛教八宝之一，其声响亮清远，象征佛法远播，唤醒众生。",
    "bowl": "钵为僧人乞食所用的器皿，象征清净、简朴的修行生活。",
    "bottle": "宝瓶盛满甘露，象征长寿、财富和吉祥如意。",
    "mirror": "镜子在唐卡中代表智慧与法力，能映照万物真相，破除迷惑。",
    "sword": "剑是文殊菩萨的标志性法器，象征以智慧之剑斩断一切无明。",
    "trident": "三叉戟是湿婆和一些护法神的武器，三叉代表身、语、意三业的净化。",
    "Kapala skull cup": "嘎巴拉碗是由人头骨制成的法器，用于密宗仪式，象征断除我执和对生死的超越。",
    "umbrella": "宝伞是佛教八宝之一，象征保护众生免受烦恼侵害，代表佛法的庇护。",
    "victory banner": "胜利幢象征佛法战胜邪恶和无明，是佛教八宝之一。",
    "prayer beads": "念珠用于念诵佛号和咒语，帮助计数，象征持续不断的修行。",
    "fire": "火焰纹样通常环绕忿怒尊或法器，象征智慧之火，能焚烧一切烦恼。",
    "water": "水纹代表佛法如水般清净、流动，也象征生命之源和心性的平静。",
    "mountain": "山代表须弥山——佛教宇宙观中的世界中心，象征稳固和不可动摇的信仰。",
    "sun": "太阳象征智慧和光明，驱散无明的黑暗，是唐卡中常见的天象符号。",
    "moon": "月亮象征清凉与慈悲，与太阳相对，代表菩提心和方便智。",
    "pagoda": "宝塔供奉佛骨舍利，象征佛陀法身常住，是佛教建筑的经典形式。",
    "lion": "狮子是佛陀的象征之一，代表勇猛无畏，常出现在佛座两侧。",
    "tiger": "虎在藏传佛教中象征力量和勇气，常与龙搭配出现。",
    "elephant": "象象征力量、智慧和稳重，是普贤菩萨的坐骑。",
    "horse": "马在唐卡中常作为神灵的坐骑，也象征精进和速度。",
    "deer": "鹿代表佛陀初转法轮于鹿野苑，常成对出现在法轮两侧。",
    "loong": "龙是藏族文化中的重要吉祥神兽，掌管风雨，象征力量与保护。",
    "crane": "仙鹤象征长寿和高洁，是唐卡中常见的吉祥鸟类。",
    "bird": "鸟类在唐卡中多作为装饰性元素出现，象征自由和灵性。",
    "people": "人物形象可能是供养人、僧侣或信众，反映了唐卡的社会文化背景。",
    "building": "建筑元素包括寺庙、宫殿等，常出现在背景中，构成佛国净土的场景。",
    "wheel of life": "法轮象征佛法的传播与轮回的真理，是佛教最核心的标志。",
    "nine signs and eight diagrams": "九宫八卦融合了汉藏文化元素，用于占卜和风水，是藏族天文历算的重要符号。",
    "coral": "珊瑚是佛教七宝之一，象征祥瑞和长寿，色泽鲜红如同生命力量。",
    "ivory": "象牙是珍贵的供品材料，象征纯洁和高贵。",
    "lucky knot": "吉祥结是佛教八宝之一，无始无终的交错纹样象征因缘和合、永恒。",
    "Shri Chitipati": "尸陀林主是藏传佛教中的护法神，以骷髅形象出现，守护墓地。",
    "Pipa": "琵琶是天王所持法器，象征以音乐之美调和众生，常出现于天王像中。",
    "fruit": "果实象征修行的成果和因果报应的道理。",
    "bull": "牛在藏族文化中地位重要，牦牛是生活的基础，象征力量和牺牲。",
    "ribbon": "丝带和飘带是唐卡中的装饰性元素，增添画面的流动感和华丽感。",
    "rock": "岩石代表坚固和永恒，常作为背景地形元素出现。",
    "tree": "树木象征生命和觉悟菩提树下的觉悟，在佛教中具有特殊意义。",
    "canopy": "华盖象征尊贵和保护，常出现在佛像头顶，代表崇高地位。",
    "body organ": "身体器官在密宗图像中出现，象征对身体执着的超越和空性的修证。",
    "stick": "棍杖是僧侣修行的法器之一，也可能是金刚力士的武器。",
    "scepter": "权杖象征法力和权威，常由护法神或天王持握。",
    "arrow": "箭在藏传佛教中象征离贪和精准的修行方向。",
    "bow": "弓象征善巧方便，弓箭合一代表定慧双修。",
    "rope": "绳索（金刚索）用于束缚邪魔，象征降伏力和约束力。",
    "grain": "谷物象征丰收和供养，代表物质世界的富足。",
    "rat": "鼠是十二生肖之一，在藏族文化中也有特定寓意。",
    "spear": "矛是护法神和战神的武器，象征勇猛和穿透力。",
    "axe": "斧是密宗法器之一，象征斩断烦恼的力量。",
    "symbol of ease": "如意象征心想事成，是中国传统吉祥物融入唐卡的体现。",
    "horsetail whisk": "拂尘象征清静无为，扫除烦恼尘垢。",
    "fish": "双鱼是佛教八宝之一，象征自由和解脱，也代表富裕和繁育。",
    "flag": "旗帜象征佛法的弘扬和胜利。",
};

// ============================================================
// 模式切换
// ============================================================
modeCards.forEach(card => {
    card.addEventListener('click', () => switchMode(card.dataset.mode));
});

function switchMode(mode) {
    currentMode = mode;
    modeCards.forEach(c => c.classList.toggle('active', c.dataset.mode === mode));
    Object.entries(panels).forEach(([key, panel]) => {
        panel.classList.toggle('hidden', key !== mode);
    });
    hidePreview();
    hideResult();
    if (mode === 'camera') startCamera(); else stopCamera();
    if (mode === 'examples') loadExamples();
}

// ============================================================
// 图片上传
// ============================================================
uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleFile(e.target.files[0]);
});

function handleFile(file) {
    if (!file.type.startsWith('image/')) { alert('请选择图片文件 (JPG/PNG)'); return; }
    const reader = new FileReader();
    reader.onload = (e) => { currentImageData = e.target.result; showPreview(currentImageData); };
    reader.readAsDataURL(file);
}

// ============================================================
// 摄像头
// ============================================================
async function startCamera() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } }
        });
        cameraVideo.srcObject = cameraStream;
    } catch (err) {
        console.error('无法访问摄像头:', err);
        alert('无法访问摄像头，请确保已授予权限。\n\n提示: HTTPS 环境才能使用摄像头功能。');
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        cameraStream = null;
        cameraVideo.srcObject = null;
    }
}

btnCapture.addEventListener('click', () => {
    if (!cameraStream) return;
    cameraCanvas.width = cameraVideo.videoWidth;
    cameraCanvas.height = cameraVideo.videoHeight;
    cameraCanvas.getContext('2d').drawImage(cameraVideo, 0, 0);
    currentImageData = cameraCanvas.toDataURL('image/jpeg', 0.9);
    showPreview(currentImageData);
    stopCamera();
});

// ============================================================
// 示例图片
// ============================================================
let examplesLoaded = false;
async function loadExamples() {
    if (examplesLoaded) return;
    try {
        const resp = await fetch('/api/examples');
        const data = await resp.json();
        examplesGrid.innerHTML = '';
        if (data.examples.length === 0) {
            examplesGrid.innerHTML = '<p style="color:#999;text-align:center;grid-column:1/-1;">暂无示例图片</p>';
            return;
        }
        data.examples.forEach(ex => {
            const card = document.createElement('div');
            card.className = 'example-card';
            card.innerHTML = `<img src="${ex.url}" alt="示例唐卡" loading="lazy">`;
            card.addEventListener('click', () => loadExampleForDetection(ex.url));
            examplesGrid.appendChild(card);
        });
        examplesLoaded = true;
    } catch (err) {
        examplesGrid.innerHTML = '<p style="color:#c00;text-align:center;grid-column:1/-1;">加载失败</p>';
    }
}

async function loadExampleForDetection(url) {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const reader = new FileReader();
    reader.onload = (e) => { currentImageData = e.target.result; showPreview(currentImageData); };
    reader.readAsDataURL(blob);
}

// ============================================================
// 预览
// ============================================================
function showPreview(imageData) {
    previewImage.src = imageData;
    previewSection.classList.remove('hidden');
    hideResult();
    previewSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hidePreview() {
    previewSection.classList.add('hidden');
    currentImageData = null;
    fileInput.value = '';
}

btnClear.addEventListener('click', () => {
    hidePreview(); hideResult();
    if (currentMode === 'camera') startCamera();
});

// ============================================================
// 检测请求
// ============================================================
btnDetect.addEventListener('click', runDetection);

async function runDetection() {
    if (!currentImageData || isDetecting) return; // 防重复点击
    isDetecting = true;
    btnDetect.disabled = true;
    btnDetect.style.opacity = '0.6';
    previewSection.classList.add('hidden');
    loadingSection.classList.remove('hidden');
    hideResult();

    try {
        const resp = await fetch('/api/detect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: currentImageData }),
        });
        const data = await resp.json();
        loadingSection.classList.add('hidden');
        if (data.error) { alert('检测失败: ' + data.error); showPreview(currentImageData); return; }
        renderResult(data);
    } catch (err) {
        loadingSection.classList.add('hidden');
        alert('请求失败: ' + err.message);
        showPreview(currentImageData);
    } finally {
        isDetecting = false;
        btnDetect.disabled = false;
        btnDetect.style.opacity = '';
    }
}

// ============================================================
// 视图切换: 交互模式 ←→ 标注模式
// ============================================================
btnViewInteractive.addEventListener('click', () => setViewMode('interactive'));
btnViewAnnotated.addEventListener('click', () => setViewMode('annotated'));

function setViewMode(mode) {
    currentViewMode = mode;
    btnViewInteractive.classList.toggle('active', mode === 'interactive');
    btnViewAnnotated.classList.toggle('active', mode === 'annotated');
    interactiveView.classList.toggle('hidden', mode !== 'interactive');
    annotatedView.classList.toggle('hidden', mode !== 'annotated');
}

// ============================================================
// 置信度实时过滤 (前端滑块)
// ============================================================
confSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    confValue.textContent = `${val}%`;
    filterDetections(val / 100);
});

function filterDetections(threshold) {
    if (originalDetections.length === 0) return;

    // 过滤出高于阈值的项
    currentDetections = originalDetections.filter(det => det.confidence >= threshold);

    // 取消高亮
    activeDetIndex = -1;

    // 重新计算统计信息
    const groupStats = {};
    currentDetections.forEach(det => {
        const g = det.group;
        groupStats[g] = (groupStats[g] || 0) + 1;
    });

    const newData = {
        total_count: currentDetections.length,
        group_stats: groupStats
    };

    // 重新渲染统计、列表和 Canvas
    renderStats(newData);
    renderDetections(currentDetections);
    if (currentViewMode === 'interactive') {
        drawOverlay(-1);
    }
}

// ============================================================
// 结果渲染 (总入口)
// ============================================================
function renderResult(data) {
    originalDetections = data.detections;
    currentImageSize = data.image_size;

    // 应用当前滑块设定的初始过滤
    const initialConfStr = confSlider.value;
    confValue.textContent = `${initialConfStr}%`;
    const initialConf = parseInt(initialConfStr) / 100;

    currentDetections = originalDetections.filter(det => det.confidence >= initialConf);

    // 重新计算统计信息
    const groupStats = {};
    currentDetections.forEach(det => {
        const g = det.group;
        groupStats[g] = (groupStats[g] || 0) + 1;
    });

    const statsData = {
        total_count: currentDetections.length,
        group_stats: groupStats
    };

    resultSection.classList.remove('hidden');

    // 标注模式图片
    resultImage.src = data.annotated_image;

    // 交互模式: 直接使用刚上传/拍摄的 currentImageData, 不再等后端传回庞大的原始图
    originalImage.src = currentImageData;
    originalImage.onload = () => {
        setupOverlayCanvas();
        drawOverlay(-1);  // 初始绘制, 无高亮
    };

    // 统计卡片
    renderStats(statsData);

    // 列表
    renderDetections(currentDetections);

    // 默认显示交互模式
    setViewMode('interactive');

    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderStats(data) {
    let html = `
        <div class="stat-card total">
            <div class="stat-number">${data.total_count}</div>
            <div class="stat-label">检测到的元素</div>
        </div>`;
    const groupOrder = ['法器宝物', '人物造像', '花草植物', '神兽动物', '其他纹样'];
    groupOrder.forEach(group => {
        const count = data.group_stats[group] || 0;
        if (count > 0) {
            html += `<div class="stat-card"><div class="stat-number">${count}</div><div class="stat-label">${group}</div></div>`;
        }
    });
    statsBar.innerHTML = html;
}

// ============================================================
// Canvas 交互层
// ============================================================
function setupOverlayCanvas() {
    const img = originalImage;
    const wrapper = $('#canvas-wrapper');
    // Canvas 的 CSS 尺寸已由 CSS 控制与 img 一致
    // 但 Canvas 内部分辨率需要与原图一致才能精确绘制
    overlayCanvas.width = img.naturalWidth;
    overlayCanvas.height = img.naturalHeight;
}

/**
 * 绘制交互覆盖层
 * @param {number} highlightIndex - 高亮的检测项索引, -1 表示无高亮
 */
function drawOverlay(highlightIndex) {
    const ctx = overlayCanvas.getContext('2d');
    const W = overlayCanvas.width;
    const H = overlayCanvas.height;
    ctx.clearRect(0, 0, W, H);

    if (currentDetections.length === 0) return;

    // 如果有高亮项, 先给非高亮区域加暗色蒙版
    if (highlightIndex >= 0) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, W, H);
    }

    currentDetections.forEach((det, i) => {
        const [x1, y1, x2, y2] = det.bbox;
        const bw = x2 - x1;
        const bh = y2 - y1;
        const color = getClassColor(det.class_en);
        const isHighlighted = (i === highlightIndex);

        if (highlightIndex >= 0 && isHighlighted) {
            // 高亮项: 清除蒙版, 露出原图
            ctx.clearRect(x1, y1, bw, bh);
            // 发光边框
            ctx.strokeStyle = '#D4AF37';
            ctx.lineWidth = 4;
            ctx.shadowColor = '#D4AF37';
            ctx.shadowBlur = 15;
            ctx.strokeRect(x1, y1, bw, bh);
            ctx.shadowBlur = 0;
            // 标签
            drawLabel(ctx, det, x1, y1, '#D4AF37');
        } else if (highlightIndex < 0) {
            // 无高亮时: 所有检测框都显示柔和边框
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.7;
            ctx.strokeRect(x1, y1, bw, bh);
            // 半透明填充
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.08;
            ctx.fillRect(x1, y1, bw, bh);
            ctx.globalAlpha = 1.0;
            // 标签
            drawLabel(ctx, det, x1, y1, color);
        }
        // 如果有高亮但本项不是高亮项, 不绘制（被蒙版覆盖）
    });
}

/**
 * 绘制圆角矩形 (兼容不支持 roundRect 的浏览器)
 */
function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

function drawLabel(ctx, det, x, y, bgColor) {
    const label = `${det.class_zh}`;
    ctx.font = 'bold 16px "Noto Sans SC", sans-serif';
    const metrics = ctx.measureText(label);
    const lw = metrics.width + 12;
    const lh = 24;
    const ly = Math.max(y - lh - 4, 0);

    // 标签背景 (使用兼容性圆角矩形)
    ctx.fillStyle = bgColor;
    ctx.globalAlpha = 0.85;
    roundRectPath(ctx, x, ly, lw, lh, 4);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // 标签文字
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 6, ly + lh / 2);
}

// ============================================================
// Canvas 交互层 (PC & Mobile)
// ============================================================

// 判断是否为触屏设备
const isTouchDevice = () => ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

// Canvas 鼠标悬浮事件 (仅 PC)
overlayCanvas.addEventListener('mousemove', (e) => {
    if (isTouchDevice()) return; // 触屏不响应 hover，防干扰
    const det = hitTest(e);
    const idx = det ? currentDetections.indexOf(det) : -1;
    if (idx !== activeDetIndex) {
        activeDetIndex = idx;
        drawOverlay(idx);
        highlightListItem(idx);
        overlayCanvas.style.cursor = idx >= 0 ? 'pointer' : 'default';
    }
});

overlayCanvas.addEventListener('mouseleave', () => {
    if (isTouchDevice()) return;
    activeDetIndex = -1;
    drawOverlay(-1);
    highlightListItem(-1);
});

// 统一的点击事件 (手机端 tap 也会触发 click)
overlayCanvas.addEventListener('click', (e) => {
    const det = hitTest(e);
    const idx = det ? currentDetections.indexOf(det) : -1;

    if (isTouchDevice()) {
        // 手机端专享交互：
        // 第一次点击产生高亮对比 (满足用户看清暗区的需求)
        // 第二次点击相同的高亮元素才打开详情弹窗
        if (idx >= 0) {
            if (activeDetIndex === idx) {
                // 第二次点击已经高亮的框 -> 弹窗
                openDetailModal(det);
            } else {
                // 第一次点击新的框 -> 只是高亮，并让列表跟着滚动过去
                activeDetIndex = idx;
                drawOverlay(idx);
                highlightListItem(idx);

                // 平滑滚动下方列表到对应的元素项 (提升视觉反馈)
                const listItem = document.querySelector(`.detection-item[data-index="${idx}"]`);
                if (listItem) {
                    listItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        } else {
            // 点击空白处 -> 清除高亮
            activeDetIndex = -1;
            drawOverlay(-1);
            highlightListItem(-1);
        }
    } else {
        // PC端交互：hover 已经做了高亮，点击无脑直接打开弹窗
        if (det) openDetailModal(det);
    }
});


/**
 * 碰撞检测: 判断鼠标位置落在哪个 bbox 内
 */
function hitTest(event) {
    const rect = overlayCanvas.getBoundingClientRect();
    const scaleX = overlayCanvas.width / rect.width;
    const scaleY = overlayCanvas.height / rect.height;
    const mx = (event.clientX - rect.left) * scaleX;
    const my = (event.clientY - rect.top) * scaleY;

    // 优先匹配面积最小的(最精确)
    let bestMatch = null;
    let bestArea = Infinity;
    for (const det of currentDetections) {
        const [x1, y1, x2, y2] = det.bbox;
        if (mx >= x1 && mx <= x2 && my >= y1 && my <= y2) {
            const area = (x2 - x1) * (y2 - y1);
            if (area < bestArea) {
                bestArea = area;
                bestMatch = det;
            }
        }
    }
    return bestMatch;
}

// ============================================================
// 检测列表渲染 (带双向联动)
// ============================================================
function renderDetections(detections) {
    if (detections.length === 0) {
        detectionList.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">🔍</div>
                <p>未检测到唐卡元素</p>
            </div>`;
        return;
    }

    let html = '';
    detections.forEach((det, i) => {
        const color = getClassColor(det.class_en);
        const confPercent = Math.round(det.confidence * 100);
        html += `
            <div class="detection-item" data-index="${i}">
                <div class="det-color" style="background:${color}"></div>
                <div class="det-info">
                    <div class="det-name-zh">${det.class_zh}</div>
                    <div class="det-name-en">${det.class_en}</div>
                </div>
                <span class="det-group-tag">${det.group}</span>
                <div style="text-align:right">
                    <div class="det-confidence">${confPercent}%</div>
                    <div class="det-conf-bar">
                        <div class="det-conf-fill" style="width:${confPercent}%"></div>
                    </div>
                </div>
            </div>`;
    });
    detectionList.innerHTML = html;

    // 绑定列表项的鼠标/点击事件 → 联动 Canvas
    $$('.detection-item').forEach(item => {
        const idx = parseInt(item.dataset.index);

        item.addEventListener('mouseenter', () => {
            activeDetIndex = idx;
            if (currentViewMode === 'interactive') drawOverlay(idx);
            highlightListItem(idx);
        });

        item.addEventListener('mouseleave', () => {
            activeDetIndex = -1;
            if (currentViewMode === 'interactive') drawOverlay(-1);
            highlightListItem(-1);
        });

        item.addEventListener('click', () => {
            openDetailModal(currentDetections[idx]);
        });
    });
}

function highlightListItem(index) {
    $$('.detection-item').forEach((item, i) => {
        item.classList.toggle('highlight', i === index);
    });
}

// ============================================================
// 详情弹窗 Modal
// ============================================================
function openDetailModal(det) {
    // 裁剪原图的对应区域作为放大展示
    const [x1, y1, x2, y2] = det.bbox;
    const cropCanvas = document.createElement('canvas');
    // 放大裁剪区域, 加 padding
    const pad = 20;
    const cx1 = Math.max(0, x1 - pad);
    const cy1 = Math.max(0, y1 - pad);
    const cx2 = Math.min(currentImageSize.width, x2 + pad);
    const cy2 = Math.min(currentImageSize.height, y2 + pad);
    const cw = cx2 - cx1;
    const ch = cy2 - cy1;
    cropCanvas.width = cw;
    cropCanvas.height = ch;
    const ctx = cropCanvas.getContext('2d');
    ctx.drawImage(originalImage, cx1, cy1, cw, ch, 0, 0, cw, ch);
    modalCropImage.src = cropCanvas.toDataURL('image/jpeg', 0.92);

    // 填充信息
    modalNameZh.textContent = det.class_zh;
    modalNameEn.textContent = det.class_en;
    modalGroup.textContent = det.group;
    modalConf.textContent = `置信度 ${Math.round(det.confidence * 100)}%`;
    modalDesc.textContent = CLASS_DESCRIPTIONS[det.class_en] || `${det.class_zh}是唐卡中的重要元素，体现了藏传佛教丰富的艺术与文化内涵。`;

    // 显示弹窗
    detailModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // 防止背景滚动
}

function closeDetailModal() {
    detailModal.classList.add('hidden');
    document.body.style.overflow = '';
}

modalClose.addEventListener('click', closeDetailModal);
detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) closeDetailModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDetailModal();
});

// ============================================================
// 再次检测
// ============================================================
function hideResult() {
    resultSection.classList.add('hidden');
    originalDetections = [];
    currentDetections = [];
    activeDetIndex = -1;
}

btnAgain.addEventListener('click', () => {
    hideResult();
    hidePreview();
    switchMode(currentMode);
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ============================================================
// 初始化
// ============================================================
const btnDownload = $('#btn-download');
if (btnDownload) {
    btnDownload.addEventListener('click', () => {
        if (!resultImage.src) return;

        // 创建一个隐藏的 a 标签触发下载
        const link = document.createElement('a');
        link.href = resultImage.src; // 标注图的 Base64

        // 生成文件名: thangka_detect_当前时间戳.jpg
        const timestamp = new Date().getTime();
        link.download = `thangka_detect_${timestamp}.jpg`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('唐卡元素识别系统已初始化 (双模式版)');
});
