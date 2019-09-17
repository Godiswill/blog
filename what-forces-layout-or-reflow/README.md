# 什么导致强制布局/重排 What forces layout / reflow

以下所有属性或方法，当在 JS 中读写或调用，都将触发浏览器同步计算样式和布局。也被叫做重排或[布局抖动](http://www.kellegous.com/j/2013/01/26/layout-performance/)，这通常是页面性能瓶颈。

All of the below properties or methods, when requested/called in JavaScript, will trigger the browser to synchronously calculate the style and layout*. This is also called reflow or [layout thrashing](http://www.kellegous.com/j/2013/01/26/layout-performance/), and is common performance bottleneck. 

### 元素 Element

##### 盒模型 Box metrics
* `elem.offsetLeft`, `elem.offsetTop`, `elem.offsetWidth`, `elem.offsetHeight`, `elem.offsetParent`
* `elem.clientLeft`, `elem.clientTop`, `elem.clientWidth`, `elem.clientHeight`
* `elem.getClientRects()`, `elem.getBoundingClientRect()`

##### 滚动相关 Scroll stuff
* `elem.scrollBy()`, `elem.scrollTo()`
* `elem.scrollIntoView()`, `elem.scrollIntoViewIfNeeded()`  
* `elem.scrollWidth`, `elem.scrollHeight`
* `elem.scrollLeft`, `elem.scrollTop` also, setting them


##### 聚焦 Focus
* `elem.focus()`  会造成两次强制布局 can trigger a *double* forced layout ([source](https://cs.chromium.org/chromium/src/third_party/WebKit/Source/core/dom/Element.cpp?q=updateLayoutIgnorePendingStylesheets+-f:out+-f:test&sq=package:chromium&dr=C)&l=2923)

##### 其他 Also…
* `elem.computedRole`, `elem.computedName`  
* `elem.innerText` ([source](https://cs.chromium.org/chromium/src/third_party/WebKit/Source/core/dom/Element.cpp?q=updateLayoutIgnorePendingStylesheets+-f:out+-f:test&sq=package:chromium&dr=C)&l=3440))

### getComputedStyle 

`window.getComputedStyle()` 典型的会造成强制计算样式 will typically force style recalc 

`window.getComputedStyle()` 以下情况将会导致强制布局 will force layout, as well, if any of the following is true: 

1. 该元素是影子树 The element is in a shadow tree
1. 媒体查询(视口相关)，尤其是以下情形 There are media queries (viewport-related ones). Specifically, one of the following: ([source](https://cs.chromium.org/chromium/src/third_party/WebKit/Source/core/css/MediaQueryExp.cpp?type=cs&q=f:MediaQueryExp.cpp+MediaQueryExp::IsViewportDependent&l=192))
  * `min-width`, `min-height`, `max-width`, `max-height`, `width`, `height`
  * `aspect-ratio`, `min-aspect-ratio`, `max-aspect-ratio`
  * `device-pixel-ratio`, `resolution`, `orientation` , `min-device-pixel-ratio`, `max-device-pixel-ratio`
1. 读取以下属性 The property requested is one of the following:  ([source](https://cs.chromium.org/chromium/src/third_party/WebKit/Source/core/css/CSSComputedStyleDeclaration.cpp?dr=C&q=f:CSSComputedStyleDeclaration.cpp+isLayoutDependent&sq=package:chromium))
  * `height`, `width`
  * `top`, `right`, `bottom`, `left`
  * `margin` [`-top`, `-right`, `-bottom`, `-left`, 或简写 or *shorthand*] 仅当 margin 是固定值 only if the margin is fixed.
  * `padding` [`-top`, `-right`, `-bottom`, `-left`, or *shorthand*] 仅当 padding 是固定值 only if the padding is fixed.
  * `transform`, `transform-origin`, `perspective-origin`
  * `translate`, `rotate`, `scale`
  * `grid`, `grid-template`, `grid-template-columns`, `grid-template-rows`
  * `perspective-origin`
  * 以下这些貌似没影响了(自2018.02) These items were previously in the list but appear to not be any longer (as of Feb 2018): `motion-path`, `motion-offset`, `motion-rotation`, `x`, `y`, `rx`, `ry`

### window

* `window.scrollX`, `window.scrollY`
* `window.innerHeight`, `window.innerWidth`
* `window.getMatchedCSSRules()` only forces style


### Forms

* `inputElem.focus()`
* `inputElem.select()`, `textareaElem.select()`

### Mouse events

* `mouseEvt.layerX`, `mouseEvt.layerY`, `mouseEvt.offsetX`, `mouseEvt.offsetY` ([source](https://cs.chromium.org/chromium/src/third_party/WebKit/Source/core/events/MouseEvent.cpp?type=cs&q=f:Mouse+f:cpp+::computeRelativePosition&sq=package:chromium&l=517))

### document

* `doc.scrollingElement` only forces style

### Range

* `range.getClientRects()`, `range.getBoundingClientRect()`

### SVG

* Quite a lot; haven't made an exhaustive list , but [Tony Gentilcore's 2011 Layout Triggering List](http://gent.ilcore.com/2011/03/how-not-to-trigger-layout-in-webkit.html) pointed to a few.


### 内容可编辑 contenteditable
  
* Lots & lots of stuff, …including copying an image to clipboard ([source](https://cs.chromium.org/search/?q=UpdateStyleAndLayoutIgnorePendingStylesheets+file:%5Esrc/third_party/WebKit/Source/core/editing/+package:%5Echromium$&type=cs))
  

## 附录 *Appendix

* 重排的开销产生是由于文档改变导致先前的样式布局无效，典型的像 DOM 元素样式修改、添加删除，甚至添加一些伪类如 :focus 都会导致重排。 Reflow only has a cost if the document has changed and invalidated the style or layout. Typically, this is because the DOM was changed (classes modified, nodes added/removed, even adding a psuedo-class like :focus).
* 在强制布局之前先要执行样式计算，所有强制布局需要执行渲染管道中的两者。样式计算和布局的开销取决于内容的复杂情况，一般两者的开销相比是差不多的。If layout is forced, style must be recalculated first. So forced layout triggers both operations. Their costs are very dependent on the content/situation, but typically both operations are similar in cost.
* 最佳实践？关于更多强制布局的各方面细节可以在文末文章引用部分查看。以下是简要概括。What should you do about all this? Well, the `More on forced layout` section below covers everything in more detail, but the short version is: 
  1. 避免在 for 循环中同时进行会引发布局的操作和操作 DOM。`for` loops that force layout & change the DOM are the worst, avoid them. 
  1. 利用 Chrome 的 Performance 功能查看哪些代码或第三方库引发了强制布局。Use DevTools Timeline to see where this happens. You may be surprised to see how often your app code and library code hits this.
  1. 批量读写DOM(通过 [FastDOM](https://github.com/wilsonpage/fastdom) or a virtual DOM)。在每帧的开始读取会引发布局属性的值(例如会频繁多次调用的 requestAnimationFrame，scroll 回调函数等之前就读取好)，当这些属性的值在最终布局后依然不变。（举个例子：当父元素宽度为100px，for 循环修改所有的子元素宽度为父元素的一半，由于在修改每个子元素的过程中，仍然取父元素的一半 50 px，这个时候就应该在 for 之前读取。如果在 for 循环之中读取，由于你修改了子元素的属性，浏览器无法确定对父元素有没有影响，只能强制重排一次来确定。特别是在循环次数比较多的场景，性能会极差。）Batch your writes & reads to the DOM (via [FastDOM](https://github.com/wilsonpage/fastdom) or a virtual DOM implementation). Read your metrics at the begininng of the frame (very very start of `rAF`, scroll handler, etc), when the numbers are still identical to the last time layout was done. 

<center>
<img src="https://cloud.githubusercontent.com/assets/39191/10144107/9fae0b48-65d0-11e5-8e87-c9a8e999b064.png">
 <i>(PS：Timeline 在最新的版本中已改成 Performance) Timeline trace of The Guardian. Outbrain is forcing layout repeatedly, probably in a loop.</i>
</center>

##### 跨浏览器 Cross-browser 
* 以上数据信息取自 Blink 引擎源代码，所以对大多数浏览器都是真实的。The above data was built by reading the Blink source, so it's true for Chrome, Opera, and most android browsers.
* 2011 WebKit 情况和以上差不多。[Tony Gentilcore's Layout Triggering List](http://gent.ilcore.com/2011/03/how-not-to-trigger-layout-in-webkit.html) was for 2011 WebKit and generally aligns with the above. 
* 现代 WebKit 引擎强制布局行为基本一致。Modern WebKit's instances of forced layout are mostly consistent: [`updateLayoutIgnorePendingStylesheets` - GitHub search - WebKit/WebKit ](https://github.com/WebKit/webkit/search?q=updateLayoutIgnorePendingStylesheets&utf8=%E2%9C%93)
* Gecko 引擎重排操作似乎通过 FrameNeedsReflow。Gecko's reflow appears to be requested via FrameNeedsReflow. Results: [`FrameNeedsReflow` - mozilla-central search](http://lxr.mozilla.org/mozilla-central/search?string=FrameNeedsReflow&find=&findi=%5C.c&filter=%5E%5B%5E%5C0%5D*%24&hitlimit=&tree=mozilla-central)
* 没有IE具体的数据，现代浏览器行为基本遵行规范，行为大体还是一致的，只是在优化方面稍有不同。No concrete data on Edge/IE, but it should fall roughly in line, as the return values for these properties are spec'd. What would differ is the amount of clever optimization.

##### 浏览 Chromium 源代码 Browsing the Chromium source:
* forced layout (and style recalc): [`UpdateStyleAndLayoutIgnorePendingStylesheets` - Chromium Code Search](https://cs.chromium.org/search/?q=UpdateStyleAndLayoutIgnorePendingStylesheets+-f:out+-f:test&type=cs)
* forced style recalc: [`UpdateStyleAndLayoutTreeIgnorePendingStylesheets` - Chromium Code Search](https://cs.chromium.org/search/?q=UpdateStyleAndLayoutTreeIgnorePendingStylesheets++-f:out+-f:test&type=cs)

#### CSS Triggers
[CSS Triggers](http://csstriggers.com/) 是一个重要的资源网站，描述了哪些样式改变会引发渲染管道哪些周期会被执行。以上讲的 JS 操作导致强制重排都会引发渲染管道中的布局、绘制、合成三者同步执行。
[CSS Triggers](http://csstriggers.com/) is a related resource and all about what operations are required to happen in the browser lifecycle as a result of setting/changing a given CSS value. It's a great resource.  The above list, however, are all about what forces the purple/green/darkgreen circles synchronously from JavaScript. 

#### 更多有关强制布局的文章 More on forced layout

* [Avoiding layout thrashing — Web Fundamentals](https://developers.google.com/web/fundamentals/performance/rendering/avoid-large-complex-layouts-and-layout-thrashing?hl=en)
* [Fixing Layout thrashing in the real world | Matt Andrews](https://mattandre.ws/2014/05/really-fixing-layout-thrashing/)
* [Timeline demo: Diagnosing forced synchronous layouts - Google Chrome](https://developer.chrome.com/devtools/docs/demos/too-much-layout)
* [Preventing &apos;layout thrashing&apos; | Wilson Page](http://wilsonpage.co.uk/preventing-layout-thrashing/)
* [wilsonpage/fastdom](https://github.com/wilsonpage/fastdom)
* [Rendering: repaint, reflow/relayout, restyle / Stoyan](http://www.phpied.com/rendering-repaint-reflowrelayout-restyle/)
* [We spent a week making Trello boards load extremely fast. Here’s how we did it. - Fog Creek Blog](http://blog.fogcreek.com/we-spent-a-week-making-trello-boards-load-extremely-fast-heres-how-we-did-it/)
* [Minimizing browser reflow  |  PageSpeed Insights  |  Google Developers](https://developers.google.com/speed/articles/reflow?hl=en)
* [Optimizing Web Content in UIWebViews and Websites on iOS](https://developer.apple.com/videos/wwdc/2012/?id=601)
* [Accelerated Rendering in Chrome](http://www.html5rocks.com/en/tutorials/speed/layers/)
* [web performance for the curious](https://www.igvita.com/slides/2012/web-performance-for-the-curious/)
* [Jank Free](http://jankfree.org/)

-------------
2018.02 修改：代码搜索链接，部分相关元素属性。

Updated slightly Feb 2018. Codesearch links and a few changes to relevant element properties.