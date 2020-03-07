# 防抖debounce 与 节流throttle
[原文链接](https://github.com/Godiswill/blog/issues/12)

## 前言

一般对于监听某些密集型键盘、鼠标、手势事件需要和后端请求交互、修改 `dom` 的，防抖、节流就很有必要了。

## 防抖

### 使用场景
- 关键字远程搜索下拉框
- resize

对于这类操作，一般希望拿到用户最终输入的关键字、确定的拖拽大小，然后与服务器交互。
而中间态的值，并不关心，为了减轻服务器压力，避免服务器资源浪费，这时就需要防抖了。

### 案例
- 输入框防抖

```javascript
// 记录时间
let last = new Date().getTime();
  //模拟一段ajax请求
function ajax(content) {
  const d = new Date().getTime();
  const span = d - last;
  console.log(`${content} 间隔 ${span}ms`);
  last = d;
}

const noActionInput = document.getElementById('noAction');

noActionInput.addEventListener('keyup', function(e) {
  ajax(e.target.value);
});
```

- 未防抖

![未防抖](https://raw.githubusercontent.com/Godiswill/blog/master/04前端性能优化/noDebounce.jpg)

可以看到为太多的中间态发送太多的请求。

```javascript
/**
* 一般利用闭包存储和私有化定时器 `timer`
* 在 `delay` 时间内再次调用则清除未执行的定时器
* 重新定时器
* @param fn
* @param delay
* @returns {Function}
*/
function debounce(fn, delay) {
  let timer = null;
  return function() {
    // 中间态一律清除掉
    timer && clearTimeout(timer);
    // 只需要最终的状态，执行
    timer = setTimeout(() => fn.apply(this, arguments), delay);
  };
}
    
const debounceInput = document.getElementById('debounce');

let debounceAjax = debounce(ajax, 100);

debounceInput.addEventListener('keyup', function(e) {
  debounceAjax(e.target.value);
});
```

- 防抖后

![防抖](https://raw.githubusercontent.com/Godiswill/blog/master/04前端性能优化/debounce.jpg)

可以发现：
1. 如果输入的很慢，差不多每 `delay 100ms` 执行一次；
1. 如果输入的很快，说明用户在连续性输入，则会等到用户差不输入完慢下来了在执行回调。

## 节流
### 使用场景

- 滑动滚动条
- 射击类游戏发射子弹
- 水龙头的水流速

对于某些连续性的事件，为了表现平滑过渡，这时的中间态我们也需要关心的。
但减弱密集型事件的频率依旧是性能优化的杀器。

### 勘误

非常常见的两种错误写法，太流行了，忍不住出来勘误。

```javascript
// 时间戳版
function throttleError1(fn, delay) {
  let lastTime = 0;
  return function () {
    const now = new Date().getTime();
    const space = now - lastTime; // 时间间隔，首次会是很大一个值
    if (space > delay) {
      lastTime = now;
      fn.apply(this, arguments);
    }
  };
}}

// 定时器版
function throttleError2(fn, delay) {
  let timer;
  return function () {
    if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        fn.apply(this, arguments);
      }, delay);
    }
  };
}
```
这两个版本都有的问题，先假设 `delay=100ms`，假设定时器都是按时执行的。
- 时间戳版
1. 由于首次 `now - lastTime === now` 该值很大，首次 0ms 立即执行，用户接在 0-100ms 内执行的交互均无效，假如用户停留在 99ms，则最后一次丢失了。
1. 例如要用滚动条离顶部的高度来设置样式，滚动条在 99ms 从 0 滚动到 100px 处，你没办法处理。

- 定时器版
1. 首次 0ms 不会立即执行有 100ms 延迟，好比开第一枪需要 100ms 后子弹才能出来。

- 聪明的读者，可能想到了，可以结合两者来解决问题。
1. 首次 0ms 立即执行无延迟；
1. 获取最后状态，保证最后一次得到执行。

### 案例

- 滚动滑动条时视觉上连续调整 `dom`

```javascript
/**
* 时间戳来处理首次和间隔执行问题
* 定会器来确保最后一次状态改变得到执行
* @param fn
* @param delay
* @returns {Function}
*/
function throttle(fn, delay) {
  let timer, lastTime;
  return function() {
    const now = new Date().getTime();
    const space = now - lastTime; // 间隔时间
    if( lastTime && space < delay ) { // 为了响应用户最后一次操作
      // 非首次，还未到时间，清除掉计时器，重新计时。
      timer && clearTimeout(timer);
      // 重新设置定时器
      timer = setTimeout(() => {
        lastTime = now; // 不要忘了记录时间
        fn.apply(this, arguments);
      }, delay);
      return;
    }
    // 首次或到时间了
    lastTime = now;
    fn.apply(this, arguments);
  };
}

const throttleAjax = throttle(ajax, 100);

window.addEventListener('scroll', function() {
  const top = document.body.scrollTop || document.documentElement.scrollTop;
  throttleAjax('scrollTop: ' + top);
});
```
- 节流前

回调过于密集

![未节流](https://raw.githubusercontent.com/Godiswill/blog/master/04前端性能优化/noThrottle.jpg)

- 节流后

可以发现，无论你滑的慢还是快都类似于定时触发。

![节流后](https://raw.githubusercontent.com/Godiswill/blog/master/04前端性能优化/throttle.jpg)

- 细心的读者可能会问，假如交互停留在 199ms，定时器在 300ms 段才执行，间隔了约 200ms，定时器延迟应该设置为 `delay - space`。

[throttle-last-delay](https://raw.githubusercontent.com/Godiswill/blog/master/04前端性能优化/throttle-last-delay.jpg)

```diff
/**
* 时间戳来处理首次和间隔执行问题
* 定会器来确保最后一次状态改变得到执行
* @param fn
* @param delay
* @returns {Function}
*/
function throttle(fn, delay) {
  let timer, lastTime;
  return function() {
    const now = new Date().getTime();
    const space = now - lastTime; // 间隔时间
    if( lastTime && space < delay ) { // 为了响应用户最后一次操作
      // 非首次，还未到时间，清除掉计时器，重新计时。
      timer && clearTimeout(timer);
      // 重新设置定时器
      timer = setTimeout(() => {
        lastTime = now; // 不要忘了记录时间
        fn.apply(this, arguments);
-      }, delay);
+      }, delay - space);
      return;
    }
    // 首次或到时间了
    lastTime = now;
    fn.apply(this, arguments);
+    // 当前已执行，清除掉计时器，不清除会有多余的中间执行
+    timer && clearTimeout(timer);
  };
}
```

- 如果忘了最后清除

![throttle-no-cancel](https://raw.githubusercontent.com/Godiswill/blog/master/04前端性能优化/throttle-no-cancel.jpg)

- 最终效果

![throttle-final](https://raw.githubusercontent.com/Godiswill/blog/master/04前端性能优化/throttle-final.jpg)

## 总结

防抖、节流都是利用闭包来实现内部数据获取与维护。
防抖比较好理解，节流就需要稍微需要思考下。两者还是有区别的，就不要一错再错，粘贴传播问题代码啦。
防抖、节流对于频繁dom事件性能优化是不可或缺的手段。

## 参考

1. [7分钟理解JS的节流、防抖及使用场景](https://juejin.im/post/5b8de829f265da43623c4261)
