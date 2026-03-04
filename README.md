# 🎨 唐卡元素智能识别系统

> 基于 **YOLOv8** 深度学习的唐卡（Thangka）元素自动检测与鉴定平台

![Python](https://img.shields.io/badge/Python-3.8+-blue?logo=python&logoColor=white)
![YOLOv8](https://img.shields.io/badge/YOLOv8-Ultralytics-purple?logo=yolo)
![Flask](https://img.shields.io/badge/Flask-2.x-green?logo=flask)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## 📌 项目简介

唐卡是藏族文化中独具特色的绘画艺术形式，蕴含丰富的宗教图像学信息。本项目利用 YOLOv8 目标检测模型，自动识别唐卡画作中的佛像、法器、神兽、纹样等 **79 类** 视觉元素，为藏族文化遗产的数字化保护与学术研究提供技术支持。

### ✨ 核心功能

- 🔍 **79 类唐卡元素识别** — 覆盖人物造像、法器宝物、花草植物、神兽动物、纹样符号五大类
- 📁 **图片上传检测** — 支持拖拽上传，JPG / PNG 格式，最大 16MB
- 📷 **摄像头实时扫描** — 手机 / 电脑摄像头拍照即检
- 🖼️ **示例图片体验** — 内置 6 张精选唐卡样本，开箱即用
- ✨ **双视图展示** — 交互模式（Canvas 高亮悬停）+ 标注模式（YOLO 标注框）
- 🎚️ **置信度实时调节** — 滑块动态过滤，阈值 10%~95%
- 📖 **元素文化解说** — 点击元素弹窗展示局部裁剪、中英文名称及文化背景
- 💾 **结果下载** — 一键保存标注后的检测图片

---

## 🖥️ 界面预览

<p align="center">
  <em>（部署运行后访问 http://localhost:5000 即可查看）</em>
</p>

---

## 📂 目录结构

```text
ultralytics-main/
├── dataset/                  # 📂 唐卡数据集 (训练集 + 验证集 + 标注)
│   ├── train/                # 训练集 (约 711 张图片 + 标注)
│   ├── val/                  # 验证集 (约 178 张图片 + 标注)
│   ├── data.yaml             # 数据集配置文件 (79 类定义)
│   └── classes.txt           # 类别名称列表
├── runs/                     # 📂 训练产出
│   └── train/yolov8s_gpu/    # 核心训练记录
│       ├── weights/          # best.pt / last.pt 模型权重
│       ├── results.csv       # 逐 epoch 训练指标日志
│       ├── confusion_matrix.png
│       ├── BoxF1_curve.png   # F1 曲线
│       └── ...               # PR 曲线、训练批次可视化等
├── weights/pretrained/       # 📂 YOLO 预训练权重 (yolov8s.pt 等)
├── web/                      # 📂 Web 应用
│   ├── app.py                # Flask 后端 (检测 API + 模型加载)
│   ├── templates/index.html  # 前端页面 (藏式美学设计)
│   ├── static/css/style.css  # 样式表 (1200+ 行)
│   ├── static/js/app.js      # 交互逻辑 (800+ 行)
│   └── examples/             # 示例唐卡图片 (6 张)
├── ultralytics/              # 📂 YOLOv8 核心源码库
├── train.py                  # 📄 模型训练脚本 (支持断点续训)
├── predict.py                # 📄 模型推理脚本 (验证集随机采样)
├── requirements.txt          # 📄 Python 依赖清单
└── README.md                 # 📄 项目说明 (本文件)
```

---

## 🚀 快速开始

### 环境要求

| 项目 | 要求 |
|------|------|
| Python | 3.8 及以上 |
| GPU（推荐） | NVIDIA GPU + CUDA 11.8+ |
| 操作系统 | Windows / Linux / macOS |

### 1. 克隆项目

```bash
git clone https://github.com/<your-username>/thangka-detection.git
cd thangka-detection
```

### 2. 安装依赖

```bash
# 建议先创建虚拟环境
python -m venv venv
# Windows
venv\Scripts\activate
# Linux / macOS
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

> **⚠️ 注意：** 如果您有 NVIDIA GPU，建议按照 [PyTorch 官网](https://pytorch.org/get-started/locally/) 安装对应 CUDA 版本的 PyTorch，以获得 GPU 加速推理。

### 3. 运行 Web 界面

```bash
python web/app.py
```

启动后访问：
- 本机：`http://localhost:5000`
- 局域网：`http://<你的IP>:5000`

### 4. 训练模型（可选）

如需使用自己的数据集重新训练：

```bash
python train.py
```

### 5. 命令行推理（可选）

从验证集随机选取图片进行推理测试：

```bash
python predict.py
```

---

## 📊 模型性能

| 指标 | 数值 |
|------|------|
| 模型架构 | YOLOv8s |
| 训练轮次 | 181 epochs |
| 输入分辨率 | 640×640 |
| 检测类别数 | 79 类 |
| mAP@0.5 | **40.3%** |
| mAP@0.5:0.95 | **25.7%** |
| Precision | 55.4% |
| Recall | 40.6% |

**训练超参数：**

| 参数 | 值 |
|------|-----|
| Batch Size | 8 |
| 优化器 | Auto (SGD) |
| 学习率 (lr0) | 0.01 |
| 余弦退火学习率 | ✅ 启用 |
| AMP 混合精度 | ✅ 启用 |
| Mosaic 增强 | ✅ 启用 |
| MixUp 增强 | 0.1 |
| Copy-Paste | 0.1 |

> **💡 说明：** 由于唐卡元素类别多达 79 类且部分类别样本量有限，mAP 数值属于正常范围。在实际使用中，高频元素（如佛像、云纹、花叶等）的识别准确率显著高于平均水平。

---

## 🏷️ 79 类唐卡元素一览

<details>
<summary>点击展开 · 五大分组详情</summary>

### 🙏 人物造像（5 类）
佛像 (Buddha)、忿怒尊 (wrathful deity)、人物 (people)、尸陀林主 (Shri Chitipati)、身体器官 (body organ)

### ⚡ 法器宝物（33 类）
金刚杵 (vajra)、金刚铃 (vajra bell)、金刚轮 (vajra wheel)、金刚锤 (vajra hammer)、金刚刀 (vajra knife)、法螺 (conch)、钵 (bowl)、宝瓶 (bottle)、念珠 (prayer beads)、宝物 (treasure)、镜子 (mirror)、嘎巴拉碗 (Kapala skull cup)、剑 (sword)、三叉戟 (trident)、箭 (arrow)、弓 (bow)、斧 (axe)、矛 (spear)、棍杖 (stick)、权杖 (scepter)、绳索 (rope)、飞镖 (dart)、盾 (shield)、鼓 (drum)、华盖 (canopy)、宝伞 (umbrella)、胜利幢 (victory banner)、吉祥结 (lucky knot)、香炉 (censer)、旗帜 (flag)、拂尘 (horsetail whisk)、如意 (symbol of ease)、珊瑚 (coral)、象牙 (ivory)

### 🌿 花草植物（5 类）
花叶 (flower and leaf)、树木 (tree)、莲花塔 (lotus tower)、果实 (fruit)、谷物 (grain)

### 🐉 神兽动物（19 类）
动物 (animals)、狮子 (lion)、虎 (tiger)、象 (elephant)、马 (horse)、鹿 (deer)、牛 (bull)、鸟 (bird)、仙鹤 (crane)、龙 (loong)、猴 (monkey)、鼠 (rat)、犬 (dog)、孔雀 (peafowl)、猪 (pig)、鱼 (fish)、秃鹫 (vulture)、鸡 (chook)、羊 (sheep)

### 🌀 其他纹样（17 类）
云纹 (cloud)、水纹 (water)、火焰 (fire)、岩石 (rock)、山 (mountain)、太阳 (sun)、月亮 (moon)、曼陀罗 (mandala)、九宫八卦 (nine signs and eight diagrams)、法轮 (wheel of life)、丝带 (ribbon)、建筑 (building)、宝塔 (pagoda)、琵琶 (Pipa)、船 (boat)、天象图 (celestial map)

</details>

---

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 深度学习框架 | PyTorch + Ultralytics YOLOv8 |
| Web 后端 | Flask |
| Web 前端 | HTML5 + CSS3 + Vanilla JavaScript |
| 图像处理 | Pillow (PIL) |
| UI 设计 | 藏式美学（暗红/金色/藏蓝配色）|
| 字体 | Noto Serif SC / Noto Sans SC (Google Fonts) |

---

## 📝 开发规范

- 新增页面请在 `web/` 目录下开发
- 所有 YOLO 调用均通过 `from ultralytics import YOLO` 完成
- **请勿直接修改 `ultralytics/` 源码**，除非需要自定义网络架构
- 后端 API 遵循 RESTful 风格，返回 JSON 格式

---

## 📄 许可证

本项目仅用于学术研究与毕业设计，不用于商业用途。

YOLOv8 核心代码遵循 [AGPL-3.0 License](https://github.com/ultralytics/ultralytics/blob/main/LICENSE)。

---

<p align="center">
  <strong>唐卡元素智能识别系统</strong> · 毕业设计项目<br>
  Powered by YOLOv8 · Flask · HTML5
</p>
