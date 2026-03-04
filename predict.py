from ultralytics import YOLO
import os
import glob
import random

if __name__ == '__main__':
    # 1. 加载模型
    # 指向训练好的最佳权重文件 (yolov8s_gpu - 67类唐卡检测模型)
    model_path = r'runs\train\yolov8s_gpu\weights\best.pt'
    
    if not os.path.exists(model_path):
        print(f"错误：找不到模型文件 {model_path}")
        print("请检查路径，或者确认训练是否成功完成。")
        exit()

    model = YOLO(model_path)

    # 2. 选择测试图片
    # 从验证集中随机选取图片进行测试
    val_images_path = 'dataset/val/images'
    all_images = glob.glob(os.path.join(val_images_path, '*.jpg')) + \
                 glob.glob(os.path.join(val_images_path, '*.png'))
    
    if not all_images:
        print(f"错误：在 {val_images_path} 找不到图片")
        exit()

    # 随机选 3 张，或者您可以指定特定图片路径
    selected_images = random.sample(all_images, min(3, len(all_images)))
    
    print(f"正在对以下图片进行检测: {selected_images}")

    # 3. 开始预测
    # save=True: 保存带有预测框的图片
    # conf=0.25: 置信度阈值，低于此分数的框会被过滤掉
    # project/name: 结果保存路径
    results = model.predict(
        source=selected_images, 
        save=True, 
        conf=0.25, 
        project='runs/detect', 
        name='predict_test',
        exist_ok=True # 允许覆盖同名文件夹
    )

    # 获取实际保存路径
    save_dir = results[0].save_dir
    print(f"\n检测完成！结果已保存在: {save_dir}")
    print("即刻为您打开结果文件夹...")
    
    # 尝试自动打开结果文件夹 (仅限 Windows)
    try:
        os.startfile(save_dir)
    except Exception as e:
        print(f"无法自动打开文件夹，请手动查看: {e}")
