"""
唐卡元素识别可视化 Web 应用 - Flask 后端
功能: 加载 YOLOv8s 模型, 提供图片检测 API
"""
import os
import sys
import base64
import io
import time
import json
import logging
import threading
from pathlib import Path
from functools import wraps

from flask import Flask, render_template, request, jsonify, send_from_directory, abort
from werkzeug.utils import secure_filename
from PIL import Image
import numpy as np

# ============================================================
# 日志配置
# ============================================================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
logger = logging.getLogger(__name__)

# 将项目根目录加入 sys.path, 以便导入 ultralytics
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ultralytics import YOLO

# ============================================================
# 推理线程锁 (确保多请求下使用单例模型的稳定性)
# ============================================================
inference_lock = threading.Lock()

# ============================================================
# 简易速率限制 (基于 IP, 内存存储)
# ============================================================
_rate_limit_store = {}  # {ip: [timestamp, ...]}
RATE_LIMIT_MAX_REQUESTS = 30   # 每个 IP 在时间窗口内最大请求数
RATE_LIMIT_WINDOW_SECONDS = 60  # 时间窗口 (秒)

def rate_limit(f):
    """简易速率限制装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        client_ip = request.remote_addr or 'unknown'
        now = time.time()
        # 清理过期记录
        if client_ip in _rate_limit_store:
            _rate_limit_store[client_ip] = [
                t for t in _rate_limit_store[client_ip]
                if now - t < RATE_LIMIT_WINDOW_SECONDS
            ]
        else:
            _rate_limit_store[client_ip] = []
        # 检查是否超限
        if len(_rate_limit_store[client_ip]) >= RATE_LIMIT_MAX_REQUESTS:
            logger.warning(f"速率限制触发: IP={client_ip}")
            return jsonify({'error': '请求过于频繁，请稍后再试'}), 429
        _rate_limit_store[client_ip].append(now)
        return f(*args, **kwargs)
    return decorated_function

# ============================================================
# Flask 应用初始化
# ============================================================
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 最大上传 16MB

# ============================================================
# 安全响应头
# ============================================================
@app.after_request
def set_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    return response

# ============================================================
# 推理超时 (秒)
# ============================================================
INFERENCE_TIMEOUT = 30

# ============================================================
# 模型加载 (全局单例, 只加载一次)
# ============================================================
MODEL_PATH = PROJECT_ROOT / 'runs' / 'train' / 'yolov8s_gpu' / 'weights' / 'best.pt'
model = None

if not MODEL_PATH.exists():
    logger.error(f"模型文件不存在: {MODEL_PATH}")
    logger.error("请确认模型权重文件已放置到正确位置，或重新训练模型。")
else:
    logger.info(f"正在加载模型: {MODEL_PATH}")
    try:
        model = YOLO(str(MODEL_PATH))
        # 模型预热 (Warmup): 空跑一次, 加速网页端用户的首次点击
        logger.info("正在进行模型预热 (Warmup)...")
        dummy_img = Image.new('RGB', (640, 640), color='black')
        model.predict(source=dummy_img, conf=0.5, verbose=False)
        logger.info("模型加载与预热完成!")
    except Exception as e:
        logger.error(f"模型加载失败: {e}")
        model = None

# ============================================================
# 类别中英文映射 + 分组
# ============================================================
CLASS_NAME_ZH = {
    "Buddha": "佛像", "mandala": "曼陀罗", "nine signs and eight diagrams": "九宫八卦",
    "lotus tower": "莲花塔", "treasure": "宝物", "cloud": "云纹",
    "flower and leaf": "花叶", "ivory": "象牙", "water": "水纹",
    "tree": "树木", "mirror": "镜子", "animals": "动物",
    "wrathful deity": "忿怒尊", "umbrella": "宝伞", "vajra wheel": "金刚轮",
    "rock": "岩石", "fire": "火焰", "stick": "棍杖",
    "scepter": "权杖", "bull": "牛", "pagoda": "宝塔",
    "moon": "月亮", "mountain": "山", "bottle": "宝瓶",
    "conch": "法螺", "bowl": "钵", "horse": "马",
    "ribbon": "丝带", "loong": "龙", "bird": "鸟",
    "building": "建筑", "people": "人物", "Pipa": "琵琶",
    "trident": "三叉戟", "deer": "鹿", "sun": "太阳",
    "wheel of life": "法轮", "fruit": "果实", "Kapala skull cup": "嘎巴拉碗",
    "body organ": "身体器官", "vajra bell": "金刚铃", "crane": "仙鹤",
    "victory banner": "胜利幢", "lion": "狮子", "tiger": "虎",
    "sword": "剑", "elephant": "象", "canopy": "华盖",
    "prayer beads": "念珠", "coral": "珊瑚", "rope": "绳索",
    "vajra": "金刚杵", "arrow": "箭", "bow": "弓",
    "axe": "斧", "symbol of ease": "如意", "horsetail whisk": "拂尘",
    "dog": "犬", "monkey": "猴", "rat": "鼠",
    "peafowl": "孔雀", "Shri Chitipati": "尸陀林主", "spear": "矛",
    "lucky knot": "吉祥结", "pig": "猪", "fish": "鱼",
    "vulture": "秃鹫", "shield": "盾", "chook": "鸡",
    "grain": "谷物", "censer": "香炉", "celestial map": "天象图",
    "sheep": "羊", "boat": "船", "dart": "飞镖",
    "flag": "旗帜", "vajra hammer": "金刚锤", "drum": "鼓",
    "vajra knife": "金刚刀",
}

# 五大类别分组 (用于前端展示)
CATEGORY_GROUPS = {
    "法器宝物": ["vajra", "vajra bell", "vajra wheel", "vajra hammer", "vajra knife",
                 "conch", "bowl", "bottle", "prayer beads", "treasure", "mirror",
                 "Kapala skull cup", "sword", "trident", "arrow", "bow", "axe",
                 "spear", "stick", "scepter", "rope", "dart", "shield", "drum",
                 "canopy", "umbrella", "victory banner", "lucky knot", "censer",
                 "flag", "horsetail whisk", "symbol of ease", "coral", "ivory"],
    "人物造像": ["Buddha", "wrathful deity", "people", "Shri Chitipati", "body organ"],
    "花草植物": ["flower and leaf", "tree", "lotus tower", "fruit", "grain"],
    "神兽动物": ["animals", "lion", "tiger", "elephant", "horse", "deer", "bull",
                 "bird", "crane", "loong", "monkey", "rat", "dog", "peafowl",
                 "pig", "fish", "vulture", "chook", "sheep"],
    "其他纹样": ["cloud", "water", "fire", "rock", "mountain", "sun", "moon",
                 "mandala", "nine signs and eight diagrams", "wheel of life",
                 "ribbon", "building", "pagoda", "Pipa", "boat", "celestial map"],
}

# 为每个类别生成归属分组, 方便快速查询
CLASS_TO_GROUP = {}
for group_name, class_list in CATEGORY_GROUPS.items():
    for cls in class_list:
        CLASS_TO_GROUP[cls] = group_name

# 示例图片目录
EXAMPLES_DIR = Path(__file__).parent / 'examples'

# 示例图片中文名称 (用于前端展示)
EXAMPLE_NAMES = {
    'example_01.jpg': '释迦牟尼佛唐卡',
    'example_02.jpg': '四臂观音唐卡',
    'example_03.jpg': '黄财神唐卡',
    'example_04.jpg': '绿度母唐卡',
    'example_05.jpg': '文殊菩萨唐卡',
    'example_06.jpg': '白度母唐卡',
}

# 大图预处理阈值 (超过此尺寸自动缩放)
MAX_IMAGE_SIZE = 2048

# ============================================================
# 路由定义
# ============================================================

@app.route('/')
def index():
    """渲染首页"""
    return render_template('index.html')


@app.route('/api/detect', methods=['POST'])
@rate_limit
def detect():
    """
    接收图片并执行 YOLO 检测
    支持两种方式:
    1. JSON body 包含 base64 图片: {"image": "data:image/jpeg;base64,..."}
    2. FormData 文件上传: file 字段
    """
    if model is None:
        return jsonify({'error': '模型未加载，请检查服务器日志'}), 503

    try:
        img = None

        # 方式1: Base64 图片 (来自摄像头拍照或示例图片)
        if request.is_json:
            data = request.get_json()
            image_data = data.get('image', '')
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            # 兼容手机端可能丢失的 Base64 Padding
            missing_padding = len(image_data) % 4
            if missing_padding:
                image_data += '=' * (4 - missing_padding)
            img_bytes = base64.b64decode(image_data)
            img = Image.open(io.BytesIO(img_bytes))

        # 方式2: 文件上传
        elif 'file' in request.files:
            file = request.files['file']
            img = Image.open(file.stream)

        if img is None:
            return jsonify({'error': '未接收到图片'}), 400

        # 确保图片为 RGB 模式
        if img.mode != 'RGB':
            img = img.convert('RGB')

        # 大图预处理: 超过 MAX_IMAGE_SIZE 时等比缩放, 减少推理时间
        orig_w, orig_h = img.size
        if max(orig_w, orig_h) > MAX_IMAGE_SIZE:
            scale = MAX_IMAGE_SIZE / max(orig_w, orig_h)
            new_w = int(orig_w * scale)
            new_h = int(orig_h * scale)
            img = img.resize((new_w, new_h), Image.LANCZOS)
            logger.info(f"大图缩放: {orig_w}x{orig_h} → {new_w}x{new_h}")

        # 执行 YOLO 检测 (计时并加锁防冲突, 带超时保护)
        t_start = time.time()
        acquired = inference_lock.acquire(timeout=INFERENCE_TIMEOUT)
        if not acquired:
            return jsonify({'error': '服务器繁忙，请稍后再试'}), 503
        try:
            results = model.predict(source=img, conf=0.10, verbose=False)  # 门槛降为0.1，依靠前端实时过滤
        finally:
            inference_lock.release()
        inference_time = round(time.time() - t_start, 3)  # 秒
        result = results[0]

        # 解析检测结果
        detections = []
        boxes = result.boxes
        if boxes is not None and len(boxes) > 0:
            for i in range(len(boxes)):
                box = boxes[i]
                cls_id = int(box.cls[0])
                cls_name = result.names[cls_id]
                confidence = float(box.conf[0])
                x1, y1, x2, y2 = box.xyxy[0].tolist()

                detections.append({
                    'class_en': cls_name,
                    'class_zh': CLASS_NAME_ZH.get(cls_name, cls_name),
                    'confidence': round(confidence, 3),
                    'bbox': [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
                    'group': CLASS_TO_GROUP.get(cls_name, '其他'),
                })

        # 生成标注后的图片 (Base64)
        annotated_frame = result.plot()  # numpy array (BGR)
        annotated_img = Image.fromarray(annotated_frame[..., ::-1])  # BGR -> RGB

        # 压缩并转 Base64 - 标注图
        buffer = io.BytesIO()
        annotated_img.save(buffer, format='JPEG', quality=85)
        annotated_b64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

        # 按置信度排序
        detections.sort(key=lambda x: x['confidence'], reverse=True)

        # 按分组统计
        group_stats = {}
        for det in detections:
            g = det['group']
            if g not in group_stats:
                group_stats[g] = 0
            group_stats[g] += 1

        return jsonify({
            'success': True,
            'detections': detections,
            'total_count': len(detections),
            'group_stats': group_stats,
            'annotated_image': f'data:image/jpeg;base64,{annotated_b64}',
            # 取消 original_image 返回，避免庞大且冗余的网络传输，前端可直接复用内存图片
            # 'original_image': f'data:image/jpeg;base64,{original_b64}',
            'image_size': {'width': img.width, 'height': img.height},
            'inference_time': inference_time,
        })

    except Exception as e:
        logger.exception(f"检测请求处理失败: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/examples')
def get_examples():
    """返回示例图片列表"""
    examples = []
    if EXAMPLES_DIR.exists():
        for f in sorted(EXAMPLES_DIR.iterdir()):
            if f.suffix.lower() in ('.jpg', '.jpeg', '.png'):
                examples.append({
                    'filename': f.name,
                    'url': f'/api/examples/{f.name}',
                    'name': EXAMPLE_NAMES.get(f.name, f.stem),
                })
    return jsonify({'examples': examples})


@app.route('/api/examples/<filename>')
def serve_example(filename):
    """提供示例图片静态文件"""
    # 防止路径穿越攻击: 确保文件名安全
    safe_name = secure_filename(filename)
    if not safe_name or safe_name != filename:
        abort(400, description='非法文件名')
    # 额外校验: 仅允许图片扩展名
    allowed_ext = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
    if Path(safe_name).suffix.lower() not in allowed_ext:
        abort(400, description='不支持的文件类型')
    return send_from_directory(str(EXAMPLES_DIR), safe_name)


@app.route('/api/class_info')
def class_info():
    """返回类别信息 (中英文映射 + 分组)"""
    return jsonify({
        'class_names': CLASS_NAME_ZH,
        'groups': CATEGORY_GROUPS,
    })


# ============================================================
# 启动
# ============================================================
if __name__ == '__main__':
    logger.info("=" * 50)
    logger.info("  唐卡元素识别系统 - Web 可视化")
    logger.info("  本机访问: http://localhost:5000")
    logger.info("  局域网访问: http://<你的IP>:5000")
    logger.info("=" * 50)
    app.run(host='0.0.0.0', port=5000, debug=False)
