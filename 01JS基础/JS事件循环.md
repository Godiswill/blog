# 你真的懂JS事件循环吗
[原文链接](https://github.com/Godiswill/blog/issues/17)

对于浏览器而言，有多个线程协同合作，如下图。具体细节可以参考[一帧剖析](https://github.com/Godiswill/blog/issues/14)。

![anatomy-of-a-frame](https://raw.githubusercontent.com/Godiswill/blog/master/04前端性能优化/anatomy-of-a-frame.jpg)

对于常说的JS单线程引擎也就是指的 `Main Therad`。

![main-thread](https://raw.githubusercontent.com/Godiswill/blog/master/04前端性能优化/main-thread.jpg)

注意以上主线程的每一块未必都会执行，需要看实际情况。
先把 `Parse HTML` -> `Composite` 的过程称为渲染管道流 `Rendering pipeline`。

浏览器内部有一个不停的轮询机制，检查任务队列中是否有任务，有的话就取出交给 `JS引擎` 去执行。

## 任务队列 Tasks Queue
一些常见的 `webapi` 会产生一个 `task` 送入到任务队列中。
- `script` 标签
- `XHR`、`addEventListener` 等事件回调
- `setTimeout` 定时器

每个 `task` 执行在一个轮询中，有自己的上下文环境互不影响。也就是为什么，`script` 标签内的代码崩溃了，不影响接下来的 `script` 代码执行。

- 轮询伪代码如下(原视频中使用`pop`，便于 `JSer` 的世界观改用 `shift`)

```javascript
while(true) {
  task = taskQueue.shift();
  execute(task);
}
```

- 任务队列未必维护在一个队列里，例如 `input event` 、 `setTimeout` 的 `callback` 可能维护在不同的队列中。
代码如果操作 `DOM`，主线程还会执行渲染管道流。伪代码修改如下：

```diff
while(true) {
+  queue = getNextQueue();
-  task = taskQueue.shift();
+  task = queue.shift();
  execute(task);
  
+  if(isRepaintTime()) repaint();
}
```

- 举个例子

```javascript
button.addEventListener('click', e => {
  while(true);
});
```

点击 `button` 参数一个 `task`，当执行该任务时，一直占用主线程卡死，该任务无法退出，导致无法响应用户交互或渲染动态图等。

改换执行以下代码

```javascript
function loop() {
  setTimeout(loop, 0);
}
loop();
```

看似无限循环执行 `loop`，`setTimeout` 每次产生一个 `task`。执行完 `loop` 即退出主线程。使得用户交互事件和渲染能够得以执行。

正因为如此，`setTimeout` 和其他 `webapi` 产生的 `task` 执行依赖任务队列中的顺序。
即使任务队列没有其他任务，也不能做到 `0秒` 运行，轮询取出 `task` 给引擎执行，大约最少 `4.7ms`。

## requestAnimationFrame

- 举个例子，不停移动一个盒子向前1像素

````javascript
function callback() {
  moveBoxForwardOnePixel();
  requestAnimationFrame(callback);
}

callback()
````

换成 `setTimeout`

````diff
function callback() {
  moveBoxForwardOnePixel();
  setTimeout(callback, 0);
}

callback()
````

对比，可以发现 `setTimeout` 移动明显比 `rAF` 移动快很多(3.5倍左右)。
意味着 `setTimeout` 回调过于频繁，这并不是一件好事。

渲染管道流不一定发生在每个 `setTimeout` 产生的 `task` 之间，也可能发生在多个 `setTimeout` 回调之后。
由浏览器决定何时渲染并且尽可能高效，只有值得更新才会渲染，如果没有就不会。

如果浏览器运行在后台，没有显示，浏览器就不会渲染，因为没有意义。大多数情况下页面会以固定频率刷新，
保证 `60FPS` 人眼就感觉很流畅，也就是一帧大约 `16ms`。频率高，人眼看不见无意义，低于人眼能发现卡顿。

在主线程很空闲时，`setTimeout` 回调能每 `4ms` 左右执行一次，留 `2ms` 给渲染管道流，`setTimeout` 一帧内能执行大概 `3.5次`。
`3.5ms * 4 + 2ms = 16ms`。

![setTimeout](https://raw.githubusercontent.com/Godiswill/blog/master/01JS基础/3waste.jpg)

`setTimeout` 调用次数太多 `3-4次`，多于用户能够看到的，也多于浏览器能够显示的，大约3/4是浪费的。
很多老的动画库，用 `setTimeout(animFrame, 1000 / 60)`来优化。

![setTimeout16](https://raw.githubusercontent.com/Godiswill/blog/master/01JS基础/setTimeout16.jpg)

但 `setTimeout` 并不是为动画而生，执行不稳定，会产生飘移或任务过重会推迟渲染管道流。

![broken](https://raw.githubusercontent.com/Godiswill/blog/master/01JS基础/broken.jpg)

`requestAnimationFrame` 正是用来解决这些问题的，使一切整洁有序，每一帧都按时发生。

![happy](https://raw.githubusercontent.com/Godiswill/blog/master/01JS基础/happy.jpg)

推荐使用 `requestAnimationFrame` 包裹动画工作提高性能。它解决这个 `setTimeout` 不确定性与性能浪费的问题，由浏览器来保证在渲染管道流之前执行。

- 一个困惑的问题：以下代码能实现先从 `0px` 移动到 `1000px` 处，再到 `500px` 处吗？

```javascript
button.addEventListener('click', () => {
  box.style.transform = 'translateX(1000px)';
  box.style.transition = 'transform 1s ease-in-out';
  box.style.transform = 'translateX(500px)';
});
```
结果：从 `0px` 移动到 `500px` 处。由于回调任务的代码块是同步执行的，浏览器不在乎中间态。

- 修改如下

```diff
button.addEventListener('click', () => {
  box.style.transform = 'translateX(1000px)';
  box.style.transition = 'transform 1s ease-in-out';
-  box.style.transform = 'translateX(500px)';

+  requestAnimationFrame(() => {
+    box.style.transform = 'translateX(500px)';
+  });
});
```

结果：依然从 `0px` 移动到 `500px` 处。

这是因为在 `addEventListener` 的 `task` 中同步代码修改为 `1000px`。
在渲染管道流中的计算样式执行之前，需要执行 `rAF`，最终的样式为 `500px`。 

- 正确修改，在下一帧的渲染管道流执行之前修改 `500px`。

```diff
button.addEventListener('click', () => {
  box.style.transform = 'translateX(1000px)';
  box.style.transition = 'transform 1s ease-in-out';

  requestAnimationFrame(() => {
-    box.style.transform = 'translateX(500px)';
+    requestAnimationFrame(() => {
+        box.style.transform = 'translateX(500px)';
+    });
  });
});
```

- 不好的方式，但也能达到效果

```javascript
button.addEventListener('click', () => {
  box.style.transform = 'translateX(1000px)';
  box.style.transition = 'transform 1s ease-in-out';
  getComputedStyle(box).transform;
  box.style.transform = 'translateX(500px)';
});
```
`getComputedStyle` 会导致强制重排，渲染管道流提前执行，多余操作损耗性能。

- bad news

`Edge` 和 `Safari` 的 `rAF` 不符合规范，错误的放在渲染管道流之后执行。

## 微任务 Microtasks

`DOMNodeInserted` 初衷被设计用来监听 `DOM` 的改变。
- 例如以下代码，会触发多少次 `DOMNodeInserted`。

```javascript
document.body.addEventListener('DOMNodeInserted', () => {
  console.log('Stuff added to <body>!');
});

for(let i = 0; i < 100; i++) {
  const span = document.createElement('span');
  document.body.appendChild(span);
  span.textContent = 'hello';
}
```
理想 for 循环完毕后，`DOMNodeInserted` 回调执行一次。
结果：执行了 `200` 次。添加 `span` 触发 `100` 次，设置 `textContent` 触发 `100`。
这就让使用 `DOMNodeInserted` 会产生极差的性能负担。
为了解决此等问题，创建了一个新的任务队列叫做微任务 `Microtasks`。

常见微任务

1. [MutationObserver](https://developer.mozilla.org/zh-CN/docs/Web/API/MutationObserver) —— DOM变化事件的观察者。
1. Promise
1. process.nextTick (node 中)

微任务是在一次事件轮询中取出的 `task` 执行完毕，即 `JavaScript` 运行栈(stack)中已经没有可执行的内容了。
浏览器紧接着取出微任务队列中所有的 `microtasks` 来执行。

- 如果用微任务创建一个像之前的 `loop` 会怎样？

```javascript
function loop() {
  Promise.resolve().then(loop);
}

loop();
```
你会发现，它跟之前的 `while` 一样卡死。

现在我们有了3个不同性质的队列

1. task queue
2. rAF queue
3. microtask queue

- task queue 前面已知，事件轮询中取出一个 `task` 执行，如果产生`new task` 入队列。`task` 执行完毕等待下一次轮询取出`next task`。
- microtask queue task 执行完毕后，执行队列中所有 `microtask`，如果产生`new microtask`，入队列，等待执行，直到队列清空。

```diff
while(true) {
  queue = getNextQueue();
  task = queue.shift();
  execute(task);
  
+  while(microtaskQueue.hasTasks()) {
+    doMicrotask();
+  }
	  
  if(isRepaintTime()) repaint();
}
```

- `rAF queue` 每一帧渲染管道流开始之前一次性执行完所有队列中的 `rAF callback`，如果产生`new rAF` 等待下一帧执行。

```diff
while(true) {
  queue = getNextQueue();
  task = queue.shift();
  execute(task);
  
  while(microtaskQueue.hasTasks()) {
      doMicrotask();
  }
  
-  if(isRepaintTime()) repaint();
+  if(isRepaintTime()) {
+    animationTasks = animationQueue.copyTasks();
+    for(task in animationTasks) {
+      doAnimationTask(task);
+    }
+    
+    repaint();
+  }
}
```

- 思考，检验一下自己是否理解了

```javascript
button.addEventListener('click', () => {
  Promise.resolve().then(() => console.log('Microtask 1'));
  console.log('Listener 1');
});

button.addEventListener('click', () => {
  Promise.resolve().then(() => console.log('Microtask 2'));
  console.log('Listener 2');
});
```
点击按钮会是怎么样的顺序呢？

来分析一下，以上代码块为一个 `task 0`。
1. `task 0` 执行完毕后，点击事件 `task queue` 中入队 `task 1`、`task 2`。
1. 用户点击按钮，触发 `click` 事件。取出 `task 1` 执行，`Microtask queue` 入队 `Microtask 1`。
`console` 输出 `Listener 1`。`task 1` 执行完毕。
1. 执行所有的 `microtask`(目前只有 `Microtask 1`)，取出执行，console 输出 `Microtask 1`。
1. 取出 `task 2` 执行，`Microtask queue` 入队 `Microtask 2`。
`console` 输出 `Listener 2`。`task 2` 执行完毕。
1. 执行所有的 `microtask`，取出 `Microtask 2` 执行，console 输出 `Microtask 2`。

答案：`Listener 1` -> `Microtask 1` -> `Listener 2` -> `Microtask 2`

如果你答对了，那么恭喜你，超越了 `87%` 的答题者。

![answer](https://raw.githubusercontent.com/Godiswill/blog/master/01JS基础/answer.jpg)

- 如果是代码触发呢？

```diff
button.addEventListener('click', () => {
  Promise.resolve().then(() => console.log('Microtask 1'));
  console.log('Listener 1');
});

button.addEventListener('click', () => {
  Promise.resolve().then(() => console.log('Microtask 2'));
  console.log('Listener 2');
});

+ button.click();
```

思路一样分析

1. `task 0` 执行到 `button.click()` 等待事件回调执行完毕。
1. 同步执行 `Listener 1`，`Microtask queue` 入队 `Microtask 1`。`console` 输出 `Listener 1`。
1. 同步执行 `Listener 2`，`Microtask queue` 入队 `Microtask 2`。`console` 输出 `Listener 2`。
1. `click` 函数 `return`，结束 `task 0`。
1. 执行所有的 `microtask`，取出 `Microtask 1` 执行，console 输出 `Microtask 1`。
1. 取出 `Microtask 2` 执行，console 输出 `Microtask 2`。

答案：`Listener 1` -> `Listener 2` -> `Microtask 1` -> `Microtask 2`

在做自动化测试时，需要小心，有时会产生和用户交互不一样的结果。

- 最后来点难度的的题

以下代码，用户点击，会阻止`a`链接跳转吗？

```javascript
const nextClick = new Promise(resolve => {
  link.addEventListener('click', resolve, { once: true });
});
nextClick.then(event => {
  event.preventDefault();
  // handle event
});
```

如果是代码点击呢？

```javascript
link.click();
```

暂不揭晓答案，欢迎评论区讨论。

## node

1. 没有脚本解析事件(如，解析 HTML 中的 script)
1. 没有用户交互事件
1. 没有 `rAF` `callback`
1. 没有渲染管道(rendering pipeline)

node 不需要一直轮询有没有任务，清空所有队列就结束。

常见任务队列 `task queue`
1. XHR requests、disk read or write queue(I/O)
1. check queue (setImmediate)
1. timer queue (setTimeout)

常见微任务 `microtask queue`
1. process.nextTick
1. Promise

`process.nextTick` 执行优先级高于 `Promise`。

```javascript
while(tasksAreWaiting()) {
  queue = getNextQueue();
  
  while(queue.hasTasks()) {
    task = queue.shift();
    execute(task);
    
    while(nextTickQueue.hasTasks()) {
      doNextTickTask();
    }
    
    while(promiseQueue.hasTasks()) {
      doPromiseTask();
    }
  }
}
```

## web worker

- 没有 `script tag`
- 没有用户交互
- 不能操作 `DOM`

类似 `node`

## 参考

1. [Further Adventures of the Event Loop - Erin Zimmer@JSConf EU 2018](https://www.bilibili.com/video/av33877569?from=search&seid=6072442856935285178)
1. [In The Loop - Jake Archibald@JSconf 2018](https://www.bilibili.com/video/av58328816?from=search&seid=9664660245862948981)
