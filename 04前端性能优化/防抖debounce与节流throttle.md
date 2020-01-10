# 防抖debounce 与 节流throttle
[原文链接](https://github.com/Godiswill/blog/issues/12)

## 前言

一般对于监听某些密集型键盘、鼠标、手势事件需要和后端请求交互、修改 `dom` 的，防抖、节流就很有必要了。

## 防抖

常见例如：
- 关键字远程搜索下拉框
- resize

对于这类操作，一般希望拿到用户最终输入的关键字、确定的拖拽大小，然后与服务器交互。
而中间态的值，并不关心，为了减轻服务器压力，避免服务器资源浪费，这时就需要防抖了。

```javascript
//模拟一段ajax请求
function ajax(content) {
  console.log('ajax request ' + content);
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
    timer && clearTimeout(timer);
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
1. 如果输入的很慢，差不多每 `delay 100ms` 执行一次
1. 如果输入的很快，说明用户在连续性输入，则会等到用户差不输入完慢下来了在执行回调

## 节流

对于某些连续性的事件，为了表现平滑过渡，这时的中间态我们也需要关心的。
但减弱密集型事件的频率依旧是性能优化的杀器。

常见例如

- 滚动滑动条时与服务器交互或调整`dom`

```javascript
/**
* 利用闭包保存定时器 `timer`，上次执行时间戳
* 若距离上次执行时间未超过 `delay` 则重置定时器
* 否则立即执行
* @param fn
* @param delay
* @returns {Function}
*/
function throttle(fn, delay) {
  let timer, lastTime;
  return function() {
    const now = new Date().getTime();
    if( lastTime && now - lastTime < delay ) {
      timer && clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, arguments), delay);
      return;
    }
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

## 总结

防抖、节流都是利用闭包来实现内部数据获取与维护。
防抖比较好理解，节流就需要稍微需要思考下。两者还是有区别的。
防抖、节流对于频繁dom事件性能优化是不可或缺的手段。

## 参考

1. [7分钟理解JS的节流、防抖及使用场景](https://juejin.im/post/5b8de829f265da43623c4261)
