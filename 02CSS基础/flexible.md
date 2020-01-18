# lib-flexible 源码分析
[原文链接](https://github.com/Godiswill/blog/issues/13)

比较流行的淘宝解决移动适配库 [lib-flexible](https://github.com/amfe/lib-flexible)

第一版没看。

## 源码分析

- 先设置 `meta`

```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no">
```

- 源码主要做了三件事
1. 设置 `html` 的字体大小即 `rem`
1. 合理调整 `body` 大小，使内容字体大小不受 `html` 字体大小的影响。(一般rem设置的很大，影响内容阅读体验)
1. 检查 `0.5px` 支持，如果支持在 `html` 上添加 `class`

````javascript
(function flexible (window, document) {
  var docEl = document.documentElement 		// html
  var dpr = window.devicePixelRatio || 1  // 设备像素比，可以拿掉，作用不大

  // adjust body font size
  /**
  * 调整 body 的字体大小
  * 设置 html 字体大小只为了开发方便统一用 rem
  * 字体一般不需要等比缩放太大
  * 对于文字内容为主的站点字体直接设为 px
  * 例如很多m站，在pc上看就字体超大
	*/
  function setBodyFontSize () {
    if (document.body) {
      // mac 浏览器 window.devicePixelRatio=2，导致 body 24px 太大了
      // 这个还是看实际需要吧，为了生活简单可以不需要 dpr
      // 例如腾讯新闻移动站直接设置 16px
      // document.body.style.fontSize = (12 * dpr) + 'px'
      document.body.style.fontSize = '16px'
    }
    else {
      document.addEventListener('DOMContentLoaded', setBodyFontSize)
    }
  }
  setBodyFontSize();

  // set 1rem = viewWidth / 10
  /**
  * 一般移动UI设计以 750px 设计为主
  * 那么这里的 1rem=75px
  * 然后要借助各种工具转化
  * 十分不方便，生活简单点
  * 很多站点都把 1rem = 100px
  * 方便写样式
	*/
  function setRemUnit () {
    // var rem = docEl.clientWidth / 10
    var rem = docEl.clientWidth / 7.5
    // 1rem = 100px
    docEl.style.fontSize = rem + 'px'
  }

  setRemUnit()

  // reset rem unit on page resize
  window.addEventListener('resize', setRemUnit)
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      setRemUnit()
    }
  })

  // detect 0.5px supports
  // 1像素问题
  if (dpr >= 2) {
    var fakeBody = document.createElement('body')
    var testElement = document.createElement('div')
    // 设置空 div 边框为 0.5px
    testElement.style.border = '.5px solid transparent'
    fakeBody.appendChild(testElement)
    docEl.appendChild(fakeBody)
    // 如果支持的话 div.offsetHeight 就是上下边框的长度 1px
    if (testElement.offsetHeight === 1) {
      docEl.classList.add('hairlines')
    }
    docEl.removeChild(fakeBody)
  }
}(window, document))
````

## 参考

1. [彻底搞懂移动Web开发中的viewport与跨屏适配](https://mp.weixin.qq.com/s/Qur8JLPdqxm7xIIOjuXmSQ)
1. [使用Flexible实现手淘H5页面的终端适配](https://github.com/amfe/article/issues/17)
1. [设备像素比+图片高清显示+移动适配](http://www.mamicode.com/info-detail-2281018.html)
1. [再聊移动端页面的适配](https://juejin.im/entry/5a9d07ee6fb9a028c149f55b)
1. [如何在Vue项目中使用vw实现移动端适配](https://juejin.im/entry/5aa09c3351882555602077ca)
1. [viewports剖析](https://www.w3cplus.com/css/viewports.html)
1. [各个大厂们的移动端适配方案](https://www.miaoroom.com/code/ued/mobile-scheme.html)
