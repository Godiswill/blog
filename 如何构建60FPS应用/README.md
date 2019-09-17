# 如何构建 60FPS 应用

### 单个帧的渲染流程

- 渲染管道流

![render-pipe](./render-pipe.png)

- 浏览器默认样式、外联样式、内联样式与 DOM 属性样式根据优先级解析，确定 DOM 节点最终的样式形成 Render Tree 的过程，称之为 `Recalculate Styles` 。

![recalculate style](./recalculate-style.png)

- 只有可见元素才会出现在渲染树中，主义可见的含义，例如
```CSS
    .style1 { /* 不在最终的渲染树中 */
        display: none;
    }
    /* 一下均实际存在最终的渲染树中 */
    .style2 {
        height: none;
    }
    .style3::before {
        content: '',
        display: block;
    }
    .style4 {
        position: absolute;
        left: 100%;
    }
```

- Render Tree 不包含 head 等不可见的节点

![render tree](./render-tree.png)

- 根据最终的样式信息确认 DOM 元素渲染的位置、形状、大小等信息的过程称为布局 `layout` 或 重排 `reflow` 。

![layout](./layout.png)

- 确定了渲染树的信息后，接着矢量到光栅，打在屏幕上的像素点上。如果用手机拍摄低分辨率的屏幕，能看到明显的网格。

![raster](./raster.png)

- 光栅器执行一系列绘制调用，填充像素，称这一过程为 `Paint`。

![paint](./paint.png)

- 渲染图片时，需要从服务器获取图片字节码，浏览器解码存储于内存中，可能还需调整大小，填充在屏幕像素点上。

![decode](./decode.png)

- 注意，所有的绘制过程未必在一个图层中完成，浏览器可能会创建多个图层。管理过个图层，最终合成一个图层，打印在屏幕上的过程，称之为 `Composite Layers` 。

![decode](./composite-layers.png)



### RAIL 评估模型
![RAIL](./RAIL.png)

1. Response：例如用户点击按钮、勾选框、输入文本等操作，包括网络请求的时间应该控制在 `100ms` 内。超过 100ms 用户会明显的感受到延迟。
2. Animation：人的眼睛都有追踪运动轨迹的能力，对于持续的动画，每秒60帧(即 `60FPS`)用户会觉得画面顺畅，低于此用户会感知动画的卡顿。也就是说每一帧的构建只有 `16ms` 的时间，除去浏览器自身绘制、合成图层等开销，能留给开发者JS执行的时间，大概只有 `10ms`。
3. Idle：在网页资源加载完毕或让用户感知到响应时，有 `50ms` 的空闲时间，开发者可以利用这 50ms 来执行一些不重要的或为用户下一步交互提前准备的任务。每个事件循环执行的任务时长不能超过 `50ms`，通常称超过 50ms 的任务为`长任务`。
4. Load：从网页请求到下载解析显示重要内容且和交互的时间应在 `1s` 内，即关键路径渲染流程应该不超过 `1s`。

这次主要探讨的的主题就是 60FPS Animation。
