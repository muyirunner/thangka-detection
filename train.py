from ultralytics import YOLO

if __name__ == '__main__':
    # ============================================================
    # 断点恢复训练 - 从上次中断处继续
    # 修复: 关闭 cache=True, 避免系统内存耗尽
    # ============================================================

    # 从上次中断的权重恢复训练 (last.pt 保存了训练状态)
    model = YOLO(r'runs\train\yolov8s_gpu\weights\last.pt')

    # 恢复训练 - resume=True 会自动从上次中断处继续
    results = model.train(
        resume=True,          # 关键参数: 从断点恢复
        cache=False,          # 修复: 关闭缓存, 避免内存溢出
    )
