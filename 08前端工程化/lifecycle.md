# web生命周期
[原文链接](https://github.com/Godiswill/blog/issues/25)

## 背景
最近做 web 性能采集分析，一直觉得跟用户交互无关的采集都放在 `onLoad` 或 `DOMContentLoaded` 中很不合理。
一番搜索，发现 web 页面也是有生命周期的。一番研究，解决了如何避免干扰用户采集信息的困惑。
W3C 最新的规范 [Page Lifecycle](https://wicg.github.io/page-lifecycle/)，
提供了一系列的生命周期钩子函数，方便开发者能够在不干扰用户交互的情况下监听处理一些操作。

问题：如何利用生命周期优雅的处理上报分析数据，既能保证在某些场景下不漏报，又能尽可能少的干扰用户？

## 概要
应用程序生命周期是现代操作系统管理资源的关键方法。在移动iOS、Android和最新的桌面系统中，
apps 在任何时候都能被 OS 启动或关闭，生命周期使得这些系统 `streamline`（流线型，使增产节约），重新分配资源更加合理高效，极大的优化了用户的体验。

历史上，web 并没有生命周期的概念，导致 web 应用可以一直存活占用系统资源。浏览器打开大量的 Tab 页，
关键系统资源如内存、CPU、电池和网络被过度占用而无法释放，导致系统卡顿。例如老版本的 Chrome 虽然性能
在当时的浏览器单页执行对比中一直是翘楚，但开多了页面，特别吃内存，得益于生命周期，可以合理的回收内存。

而 web 平台长期以来都有与生命周期状态相关的事件，如 `load`、`unload`、`visibilitychange `，
这些事件允许开发者监听生命周期状态的改变。对于移动设备特别是一些低端机型，浏览器需要一种主动回收内存和重新分配内存的方式。

事实上，现在的浏览器已经采取了积极的措施来节省后台标签页的资源，许多浏览器希望做更多的事情来减少它们的资源占用。

问题是开发人员目前没有办法为这些类型的系统启动干预做好准备，甚至无法知道它们正在发生。这意味着浏览器需要保守，否则就有可能破坏网页。

`Page Lifecycle API` 试图通过以下方式解决这些问题：
1. 在web上引入并标准化生命周期状态的概念。
1. 定义新的系统启动状态，允许浏览器限制隐藏或非激活选项卡可使用的资源。
1. 创建新的 APIs 和事件，允许 web 开发人员响应这些新的系统启动状态之间的转换。

该解决方案提供了web开发人员构建对系统干预具有弹性的应用程序所需的可预测性，并允许浏览器更积极地优化系统资源，最终使所有web用户受益。

本文的将介绍新的页面生命周期特性，并探讨它们与所有现有web平台状态和事件的关系。它还将为开发人员在每个状态下应该（和不应该）做的工作类型提供建议和最佳实践。

## 生命周期状态与事件

所有页面生命周期状态都是离散和互斥的，这意味着一个页面一次只能处于一个状态。页面生命周期状态的大多数更改通常都可以通过DOM事件观察到（关于异常，请参见开发人员对每个状态的建议）。

生命周期状态转变以及触发的事件
![page-lifecycle-api-state-event-flow](https://raw.githubusercontent.com/Godiswill/blog/master/08%E5%89%8D%E7%AB%AF%E5%B7%A5%E7%A8%8B%E5%8C%96/page-lifecycle-api-state-event-flow.png)

### 状态
|状态|描述|可能前一个的状态（触发事件）|可能下一个状态（触发事件）|
|--|--|--|--|
|Active|页面可见`document.visibilityState === 'visible'` 并且有 `input` focus|1. passive (focus)|1. passive (blur)|
|Passive|页面可见且没有input 处于 focus|1. active (blur)<br>2. hidden (visibilitychange)|1. active (focus)<br>2. hidden (visibilitychange)|
|Hidden|页面不可见`document.visibilityState === 'hidden'`且不被冻结|1. passive (visibilitychange)|1. passive (the visibilitychange)<br>2. frozen (freeze)<br>3. terminated (pagehide)|
|Frozen|`frozen`状态浏览器会挂起任务队列中可冻结任务的执行，这意味着例如 `JS timer`或`fetch`回调不会执行。正在执行的任务能被完成，但是可执行的操作和运行的时间会被限制。<br><br> 浏览器冻结是为了节约 CPU、内存、电量的消耗。同时使前进后退更加快速，避免从网络重新加载全量页面|1. hidden (freeze)|1. active (resume -> pageshow)<br>2. passive (resume -> pageshow)<br>3. hidden (resume)|
|Terminated|`terminated`状态表示浏览器已卸载页面并回收了资源占用，不会有新的任务执行，已运行的长任务可能会被清除。|1. hidden (pagehide)|无|
|Discarded|`discarded`状态发生在系统资源受限，浏览器会主动卸载页面释放内存等资源用于新进/线程。该状态下任何任务、事件回调或任何类型的JS都无法执行。尽管页面不在了，但浏览器 Tab 页的标签名和 favicon用户仍可见|1. frozen (no events fired)|无|

### 事件
下面描述了与生命周期相关的所有事件，并列出了它们可能转换的状态。

#### focus
- 描述：DOM元素获取焦点
- 前一个可能状态
1. passive
- 当前可能状态
1. active
- 注意：focus 事件并不总触发生命周期状态改变，只有在页面之前并没有聚焦才会发生改变。

#### blur
- 描述：DOM元素失去焦点
- 前一个可能状态
1. active
- 当前可能状态
1. passive
- 注意：blur 事件并不总触发生命周期状态改变，只有在页面不再获取焦点才会发生改变。例如在页面元素之间切换焦点就不会。

#### visibilitychange
- 描述：`document.visibilityState` 值变化。触发场景：
1. 刷新或导航到新页面
1. 切换到新 Tab 页面
1. 关闭 Tab、最小化、或关闭浏览器
1. 移动端切换 app，如按了 Home 键，点击头部通知切换等
- 前一个可能状态
1. passive
1. hidden
- 当前可能状态
1. passive
1. hidden

#### freeze *
- 描述：页面被冻结，任务队列中的可冻结任务都不会执行。
- 前一个可能状态
1. hidden
- 当前可能状态
1. frozen

#### resume *
- 描述：浏览器重启了一个被冻结的页面
- 前一个可能状态
1. frozen
- 当前可能状态
1. active (if followed by the pageshow event)
1. passive (if followed by the pageshow event)
1. hidden

#### pageshow
- 描述：检索页面导航缓存是否存在，存在则从缓存中取出，否则加载一个全新的页面。
如果页面是从导航缓存中取出，则事件属性 `persisted` 为 true，反之为 false。
- 前一个可能状态
1. frozen (此时 resume 事件也会触发)
- 当前可能状态
1. active
1. passive
1. hidden

#### pagehide
- 描述：页面会话是否能够存入导航缓存。如果用户导航到另一个页面，并且浏览器能够将当前页面添加到页面导航缓存以供以后重用
，则事件属性 `persisted` 为true。如果为true，则页面将进入 `frozen` 状态，否则将进入 `terminated` 状态。
- 前一个可能状态
1. hidden
- 当前可能状态
1. frozen (event.persisted is true, freeze event follows)
1. terminated (event.persisted is false, unload event follows)

#### beforeunload
- 描述：当前页面即将被卸载。此时当前页面文档内容仍然可见，关闭页面可以在该阶段取消。
- 前一个可能状态
1. hidden
- 当前可能状态
1. terminated
- 警告：监听 `beforeunload` 事件，仅用来提醒用户有未保存的数据改变，一旦数据保存完成，该监听事件回调应该移除。
不应该无条件地将它添加到页面中，因为这样做在某些情况下会损害性能。

#### unload
- 描述：页面正在被卸载。
- 前一个可能状态
1. hidden
- 当前可能状态
1. terminated
- 警告：不建议监听使用 `unload` 事件，因为它不可靠，在某些情况下可能会影响性能。

* 表示生命周期定义的新事件。

### 新特性
frozen 和 discarded 是系统行为而不是用户主动行为，现代浏览器在标签页不可见事，可能会主动冻结或废弃当前页。
开发人员并不能知道这两者的发生过程。

Chrome 68+ 中提供了freeze、resume 事件，当页面从 hidden 状态转变为冻结和非冻结状态，开发人员可以监听 `document` 得知。
```javascript
document.addEventListener('freeze', (event) => {
  // The page is now frozen.
});

document.addEventListener('resume', (event) => {
  // The page has been unfrozen.
});
```

并且提供了 `document.wasDiscarded` 属性来获取当前加载的页面，之前是否非可见时被废弃过。
```javascript
if (document.wasDiscarded) {
  // Page was previously discarded by the browser while in a hidden tab.
}
```

### 代码观察生命周期状态
获取 `active`、`passive`、 `hidden`
```javascript
const getState = () => {
  if (document.visibilityState === 'hidden') {
    return 'hidden';
  }
  if (document.hasFocus()) {
    return 'active';
  }
  return 'passive';
};
```

像 `frozen` 和 `terminated` 状态需要监听 `freeze`、`pagehide` 事件获取。
```javascript
// Stores the initial state using the `getState()` function (defined above).
let state = getState();

// Accepts a next state and, if there's been a state change, logs the
// change to the console. It also updates the `state` value defined above.
const logStateChange = (nextState) => {
  const prevState = state;
  if (nextState !== prevState) {
    console.log(`State change: ${prevState} >>> ${nextState}`);
    state = nextState;
  }
};

// These lifecycle events can all use the same listener to observe state
// changes (they call the `getState()` function to determine the next state).
['pageshow', 'focus', 'blur', 'visibilitychange', 'resume'].forEach((type) => {
  window.addEventListener(type, () => logStateChange(getState()), {capture: true});
});

// The next two listeners, on the other hand, can determine the next
// state from the event itself.
window.addEventListener('freeze', () => {
  // In the freeze event, the next state is always frozen.
  logStateChange('frozen');
}, {capture: true});

window.addEventListener('pagehide', (event) => {
  if (event.persisted) {
    // If the event's persisted property is `true` the page is about
    // to enter the page navigation cache, which is also in the frozen state.
    logStateChange('frozen');
  } else {
    // If the event's persisted property is not `true` the page is
    // about to be unloaded.
    logStateChange('terminated');
  }
}, {capture: true});
```

上面代码做了三件事：
1. `getState()` 初始化状态
1. 定义 `logStateChange` 函数接收下一个状态，如改变则 console
1. 监听 `捕获阶段` 事件，一次调用 `logStateChange` ，传入状态改变。

注意：上述 console 打印的顺序在不同的浏览器中可能不一致。

- 为什么通过传入第三个参数 `{capture: true}` 且都在 `window` 上监听事件
1. 并不是所有生命周期事件都有相同的 `target`
	1. `pagehide`、`pageshow` 在 `window` 上触发
	1. `visibilitychange`, `freeze`, `resume` 在 `document` 上触发
	1. `focus`、`blur` 在相应的 DOM 元素上触发
1. 大多数事件并不会冒泡，这意味着在冒泡阶段，只通过监听 `window` 无法实现
1. 捕获阶段发生在 target 阶段和冒泡阶段，这意味着捕获阶段事件不会被其他冒泡事件取消

### 跨浏览器兼容
由于生命周期API刚刚被引入，新的事件和DOM api并没有在所有浏览器中实现。此外，所有浏览器实现并不一致。
例如：
1. 一些浏览器切换 Tab 时，不会触发 `blur` 事件，意味着 `active` 状态不经过 `passive` 状态而直接变成了 `hidden`
1. 一些浏览器虽然实现了 `page navigation cache`，`Page Lifecycle API` 把缓存的页面分类为冻结状态，
但是还没有实现`freeze`，`resume` 等最新的 API，虽然非/冻结状态也可以通过 `pageshow`，`pagehide` 事件监听到。
1. IE 10 以及以下版本未实现 `pagehide` 事件
1. `pagehide`、`visibilitychange` 触发顺序[已改变](https://github.com/w3c/page-visibility/issues/39)。
当页面正在被卸载时，如果页面可见，会先触发 `pagehide` 在触发 `visibilitychange`。
最新版本的 Chrome ，无论页面是否可见都会先触发 `visibilitychange` 在触发 `pagehide`。
1. Safari 关闭 Tab 页可能不会触发 `pagehide` 或 `visibilitychange`。需要监听 `beforeunload` 来做兼容，
`beforeunload` 需要在冒泡阶段结束才能知道状态是否变成 `hidden`，因此容易被其他事件取消。

推荐使用[PageLifecycle.js](https://github.com/GoogleChromeLabs/page-lifecycle)，确保跨浏览器的一致性。

### 每个状态的建议
作为开发人员，理解页面生命周期状态并知道如何在代码中观察它们很重要，因为您应该（也不应该）执行的工作类型在很大程度上取决于您的页面处于什么状态。

例如，如果页面处于不可见状态，则向用户显示临时通知显然没有意义。虽然这个例子很明显，但还有一些不太明显的建议值得列举。

|状态|建议|
|--|--|
|Active|该状态是对用户来说最重要的阶段，此时最重要的就是响应用户输入。长时间阻塞主线程的非no-UI任务可以交给`idle`时期或`web worker`处理|
|Passive|该状态下，用户没有与页面交互，但是他们仍然可以看到它。这意味着UI更新和动画应该仍然是平滑的，但是这些更新发生的时间不那么关键。当页面从 `active` 变为 `passive` 时，是存储未保存数据的好时机。|
|Hidden|当 `passive` 转变为 `hidden`，用户很有可能不再与页面交互直到重新加载。<br><br> `hidden` 状态往往是开发人员可以信赖的最后状态，尤其在移动端，例如切换 APP 时`beforeunload`、`pagehide` 和 `unload` 事件都不会触发。<br><br>这意味着，对于开发人员应该把 `hidden` 状态当成是页面会话的最终状态。在此时应该持久化未保存的应用数据，采集上报分析数据。<br><br>同时，你应该停止UI更新，因为用户已经看不到了。也该停止那些用户并不想在后台执行的任务，节省电量等资源。|
|Frozen|在 `frozen` 状态，[任务队列](https://html.spec.whatwg.org/multipage/webappapis.html#task-queue)中[可冻结的任务](https://html.spec.whatwg.org/multipage/webappapis.html#queue-a-task)会被挂起，直到页面解冻(也许永远不会发生，例如页面被废弃`discarded`)。<br><br>此时有必要停止所有的`timer`和关闭连接([IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)、[BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API)、[WebRTC](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)、[Web Socket](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) connections。释放[Web Locks](https://github.com/inexorabletash/web-locks))，不应该影响其他打开的同源页面或影响浏览器把页面存入缓存(page navigation cache)。<br><br>你也应该持久化动态视图信息(例如无限滑动列表的滑动位置)到 [sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage)或IndexedDB via commit()，以便discarded 和 reloaded之后重用。<br><br>当状态重新变回 `hidden` 时您可以重新打开任何关闭的连接，或重新启动最初冻结页面时停止的任何轮询。|
|Terminated|当页面变成 `terminated` 状态，开发人员一般不需要做任何操作。因为用户主动卸载页面时总会在 `terminated` 之前经历 `hidden` 状态(页面刷新和跳转时不一定会触发 `visibilitychange`，少部分浏览器实现了，大部分可能需要 `pagehide` 甚至`beforeunload`或`unload` 来弥补这些场景)，你应该在 `hidden` 状态执行页面会话的结束逻辑(持久化存储、上报分析数据)。<br><br>开发人员必须认识到，在许多情况下（特别是在移动设备上），无法可靠地检测到终止状态，因此依赖终止事件（例如`beforeunload`、`pagehide`和`unload`）可能会丢失数据。|
|Discarded|开发人员无法观察到被废弃的状态。因为通常在系统资源受限下被废弃，在大多数情况下，仅仅为了允许脚本响应`discard`事件而解冻页面是不可能的。因此，没必要从`hidden`更改为`frozen`时做处理，可以在页面加载时检查 `document.wasDiscarded`，来恢复之前被废弃的页面。|

### 避免使用老旧的生命周期API
- unload，不要在现代浏览器中使用
1. 很多开发人员会把 `unload` 事件当做页面结束的信号来保存状态或上报分析数据，但这样做非常不可靠，特别是在移动端。
`unload` 在许多典型的卸载情况下不会触发，例如通过移动设备的选项卡切换、关闭页面或系统切换器切换、关闭APP。
1. 因此，最好依赖 `visibilitychange` 事件来确定页面会话何时结束，并将 `hidden` 状态视为最后保存应用和用户数据的可靠时间。
1. `unload` 会阻止浏览器把页面存入缓存(page navigation cache)，影响浏览器前进后退的快速响应。
1. 在现代浏览器(包括IE11)，推荐使用 `pagehide` 事件代替 `onload` 监测页面卸载(terminated)。`onload` 最多用来兼容IE10。
```javascript
const terminationEvent = 'onpagehide' in self ? 'pagehide' : 'unload';

addEventListener(terminationEvent, (event) => {
  // Note: if the browser is able to cache the page, `event.persisted`
  // is `true`, and the state is frozen rather than terminated.
}, {capture: true});
```

- beforeunload，和 unload 有类似的问题，仅仅用来提醒用户关闭或跳转页面时有未保存的数据，一旦保存立即清除。
```javascript
// bad：无条件使用
addEventListener('beforeunload', (event) => {
  // A function that returns `true` if the page has unsaved changes.
  if (pageHasUnsavedChanges()) {
    event.preventDefault();
    return event.returnValue = 'Are you sure you want to exit?';
  }
}, {capture: true});
```
```javascript
// good
const beforeUnloadListener = (event) => {
  event.preventDefault();
  return event.returnValue = 'Are you sure you want to exit?';
};
const unsavedChanges = [];
/**
 * @param {Symbol|Object} id A unique symbol or object identifying the
 *.    pending state. This ID is required when removing the state later.
 */
function addUnsavedChanges(id) {
  if(unsavedChanges.indexOf(id) > -1) return; // 重复退出
  if (unsavedChanges.length === 0) { // 首次监听
    addEventListener('beforeunload', onbeforeunload);
  }
  unsavedChanges.push(id);
}
/**
 * @param {Symbol|Object} id A unique symbol or object identifying the
 *.    pending state. This ID is required when removing the state later.
 */
function removeUnsavedChanges(id) {
  const idIndex = unsavedChanges.indexOf(id);
  if (idIndex > -1) {
    unsavedChanges.splice(idIndex, 1);
    // If there's no more pending state, remove the event listener.
    if (unsavedChanges.length === 0) {
      removeEventListener('beforeunload', onbeforeunload);
    }
  }
}
```

### FAQs
- 页面不可见(hidden)时有重要的任务在执行，如何阻止页面被冻结(frozen)或废弃(discarded)？

有很多合理的理由在页面不可见(hidden)状态不冻结(frozen)页面，例如APP正在播放音乐。

对于有些场景，浏览器放弃页面也存在风险，例如用户有未提交的输入或开发人员监听了`beforeunload`事件以便提醒用户。

因此，浏览器策略会趋于保守，只有在明确不会影响用户的时候才会放弃页面。例如以下场景不会废弃页面(除非受到设备的资源限制)。
1. Playing audio
1. Using WebRTC
1. Updating the table title or favicon
1. Showing alerts
1. Sending push notifications

注意：对于更新标题或favicon以提醒用户未读通知的页面，建议使用 `service worker`，这将允许Chrome冻结或放弃页面，但仍然显示对选项卡标题或favicon的更改。

- 什么是页面导航缓存(page navigation cache)？

页面导航缓存是一个通用术语，用于优化后退和前进按钮导航，利用缓存快速恢复前后页面。Webkit 称 `Page Cache`，`Firefox` 称 `Back-Forwards Cache` (bfcache)。

冻结是为了节省CPU/电池/内存，而缓存是为了重载时快速恢复，两者配合才能相得益彰。因此，该缓存被视为冻结生命周期状态的一部分。

注意：`beforeunload`、`unload` 会阻止该项优化。

- 为什么生命周期里没有 load、DOMContentLoaded 事件？

页面生命周期状态定义为离散和互斥的。由于页面可以在`active`、`passive` 或 `hidden` 状态下加载，因此单独的加载状态没有意义，
并且由于 `load` 和 `DOMContentLoaded` 事件不表示生命周期状态更改，因此它们与生命周期无关。

- frozen 或 terminated 状态如何使用异步请求

在这两个状态，任务可能被挂起不执行，例如异步请求、基于回调的API等同样不会被执行。以下是一些建议
1. sessionStorage，方法是同步的，且在废弃状态仍然能持久化数据。
1. service worker，在 `terminated`、`discarded` 状态时通过监听`freeze` or `pagehide` 通过 `postMessage()` 用来保存数据。
（受限与设备资源，可能唤起service worker 会加重设备负担）
1. navigator.sendBeacon 函数运行页面关闭时仍然可以发送异步请求。

- 如何查看页面 frozen and discarded 状态？
[chrome://discards](chrome://discards/)

![chrome-discards](https://raw.githubusercontent.com/Godiswill/blog/master/08%E5%89%8D%E7%AB%AF%E5%B7%A5%E7%A8%8B%E5%8C%96/chrome-discards.png)

## 对分析型数据采集时机的启发

兼容性分析
![lifecycle-events-testing](https://raw.githubusercontent.com/Godiswill/blog/master/08%E5%89%8D%E7%AB%AF%E5%B7%A5%E7%A8%8B%E5%8C%96/lifecycle-events-testing.png)

1. 避免在 `load`、`DOMContentLoaded`、`beforeunload`、`unload` 中处理上报采集数据。
1. 监听 `visibilitychange` 在各种切换APP、息屏时处理采集信息。
1. 监听 `pagehide` 收集页面刷新导航跳转场景。
1. 仅仅使用 `beforeunload` 兼容 `Safari` 关闭 Tab 和IE11以下版本的场景。
1. 注意一旦收集信息立即销毁所有采集事件，避免重复上报。

```javascript
function clear(fn) {
  ['visibilitychange', 'pagehide', 'beforeunload']
    .forEach(event => window.removeEventListener(event, fn, true));
}

function collect() {
  const data = { /*  */ };
  const str = JSON.stringify(data);
  if('sendBeacon' in window.navigator) {
    if( window.navigator.sendBeacon(url, str) ) {
      clear(collect);
    } else {
      // 异步发请求失败
    }
  } else {
    // todo 同步 ajax
    clear(collect);
  }
}

const isSafari = typeof safari === 'object' && safari.pushNotification;
const isIE10 = !('onpagehide' in window);

window.addEventListener('visibilitychange', collect, true);
!isIE10 && window.addEventListener('pagehide', collect, true);

if(isSafari || isIE10) {
  window.addEventListener('beforeunload', collect, true);
}
```

## 总结

对于性能有极致追求的开发人员，开发时都应该考虑到页面的生命周期。在不需要的情况下不消耗设备资源对用户来说是非常重要的。

此外越多的开发人员开始使用生命周期 APIs，浏览器处理冻结或废弃不再使用的页面就越安全。
这意味着浏览器将会消耗更少的内存、CPU、电量、网络资源，这都将有利于用户。

## 参考
1. [WebKit Page Cache](https://webkit.org/blog/427/webkit-page-cache-i-the-basics/)
1. [Firefox Back-Forward Cache](https://developer.mozilla.org/en-US/Firefox/Releases/1.5/Using_Firefox_1.5_caching)
1. [Page Lifecycle W3C](https://wicg.github.io/page-lifecycle/)
1. [Page Lifecycle API](https://developers.google.com/web/updates/2018/07/page-lifecycle-api)
1. [Don't lose user and app state, use Page Visibility](https://www.igvita.com/2015/11/20/dont-lose-user-and-app-state-use-page-visibility/)
1. [page-lifecycle](https://github.com/WICG/page-lifecycle)
1. [PageLifecycle.js](https://github.com/GoogleChromeLabs/page-lifecycle)
1. [Lifecycle events with Page Visibility + Beacon API](http://output.jsbin.com/zubiyid/latest/quiet)
1. [Why does visibilitychange fire after pagehide in the unload flow?](https://github.com/w3c/page-visibility/issues/39)
