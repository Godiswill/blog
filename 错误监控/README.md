# 错误监控

### 前言

作为一个前端，在开发过程即便十分小心，自测充分，在不同用户复杂的操作下也难免会出现程序员意想不到的问题，给公司或个人带来巨大的损失。
这时一款能够及时上报错误和能够帮助程序员很好的解决错误的前端错误监控系统就必不可少了。
接下来我们就聊聊常见的错误发生与处理。

本文主要围绕以下几点讨论：
1. 常见JS错误类型
2. 常见JS处理错误方式
3. 上报的方式，和上报内容的几点思考

问题：
1. JS、CSS、img等资源加载失败(CDN或图床挂了，无意删了、文件名变了)怎么实时获知？而不是用户告诉你？
2. 如何上报有用的错误信息能够让程序员快速定位错误并修复？而不是上报一些迷惑信息？
3. 在当今无不用压缩丑化代码的工程化中，怎么利用好 SourceMap 文件，处理错误信息？
4. 如何出了问题，不用在让用户帮助你复现？要机型？要操作步骤？
5. 如何更好统计问题的分布(机型设备、浏览器、地理位置、带宽等)，自主根据数据来取舍兼容倾向性？
6. ...

### 常见错误

1. 脚本错误
	- 语法错误
	- 运行时错误
		- 同步错误
		- 异步错误
		- Promise 错误
1. 网络错误
	- 资源加载错误
	- 自定义请求错误

#### 语法错误

例如，英文字符写成中文字符。一般容易在开发时被发现。

![syntaxError](https://raw.githubusercontent.com/Godiswill/blog/master/错误监控/syntaxError.jpg)

语法错误无法被`try` `catch` 处理

```javascript
try {
  const error = 'error'；   // 圆角分号
} catch(e) {
  console.log('我感知不到错误');
}
```

#### 同步错误

JS引擎在执行脚本时，把任务分块压入事件栈，轮询取出执行，每个事件任务都有自己的上下文环境，
在当前上下文环境同步执行的代码发生错误都能被`try` `catch` 捕获，保证后续的同步代码被执行。

```javaScript
try {
  error
} catch(e) {
  console.log(e);
}
```

#### 异步错误
常见的 `setTimeout` 等方法会创建新的事件任务插入事件栈中，待后续执行。
所以`try` `catch` 无法捕获其他上下文的代码错误。

```javascript
try {
  setTimeout(() => {
    error        // 异步错误
  })
} catch(e) {
  console.log('我感知不到错误');
}
```
为了便于分析发生的错误，一般利用 `window.onerror` 事件来监听错误的发生。
它比`try` `catch`的捕获错误信息的能力要强大。

```javascript
/**
 * @param {String}  msg    错误描述
 * @param {String}  url    报错文件
 * @param {Number}  row    行号
 * @param {Number}  col    列号
 * @param {Object}  error  错误Error对象
 */
 window.onerror = function (msg, url, row, col, error) {
  console.log('我知道错误了');
  // return true; // 返回 true 的时候，异常不会向上抛出，控制台不会输出错误
};
```

![windowOnerror](https://raw.githubusercontent.com/Godiswill/blog/master/错误监控/windowOnerror.jpg)

#### window.onerror 注意事项

1. `window.onerror` 可以捕获常见语法、同步、异步错误等错误；
1. `window.onerror` 无法捕获 `Promise` 错误、网络错误；
1. `window.onerror` 应该在所有JS脚本之前被执行，以免遗漏；
1. `window.onerror` 容易被覆盖，在处理回调时应该考虑，被人也在使用该事件监听。

#### 网络错误

由于网络请求异常不会冒泡，应此需要在事件捕获阶段才能获取到。
我们可以利用 `window.addEventListener`。比如代码、图片等重要 `CDN` 资源挂了，能及时获得反馈是极为重要的。

```javascript
window.addEventListener('error', (error) => {
  console.log('404 错误');
  console.log(error);
  // return true; // 中断事件传播
}, true);
```

![addEventListener](https://raw.githubusercontent.com/Godiswill/blog/master/错误监控/addEventListener.jpg)

对于这类资源加载错误，在事件对象中能获得足够的信息，配合短信、钉钉等第一时间通知开发者。

```javascript
window.addEventListener('error', (e) => {
  if (e.target !== window) { // 避免重复上报
    console.log({
    	url: window.location.href, // 引用资源地址
    	srcUrl: e.target.src, // 资源加载出错地址
    })
  }
}, true);
```

#### `window.onerror` 与 `window.addEventListener`

`window.addEventListener` 的好处，不怕回调被覆盖，可以监听多个回调函数，但记得销毁避免内存泄漏与错误。
但无法获取 `window.onerror` 那么丰富的信息。一般只用`window.addEventListener` 来监控资源加载错误。

- 对于网络请求自定义错误，最好是手动上报。

#### Promise 错误

如果你在使用 `promise` 时未 `catch` 的话，那么 `onerror` 也无能为力了。

```javascript
Promise.reject('promise error');
new Promise((resolve, reject) => {
  reject('promise error');
});
new Promise((resolve) => {
  resolve();
}).then(() => {
  throw 'promise error';
});
```

同样你可以利用 `window.onunhandledrejection` 或 `window.addEventListener("unhandledrejection")`来监控错误。
接收一个PromiseError对象，可以解析错误对象中的 `reason` 属性，有点类似 `stack`。

具体兼容处理在 TraceKit.js 可以看到。

#### 上报方式
1. `img` 上报
1. `ajax` 上报

```javascript
function report(errInfo) {
  new Image().src = 'http://your-api-website?data=' + errInfo;
}
```

`ajax` 应使用的类库而已，大同小异。

- 注意：`img` 请求有长度限制，数据太大最好还是用 `ajax.post`。


#### Script error

引用不同域名的脚本，如果没有特殊处理，报错误了，一般浏览器处于安全考虑，不显示具体错误而是 `Script error`.
例如他人别有用心引用你的线上非开源业务代码，你的脚本报错信息当然不想让他知道了。

如果解决自有脚本的跨域报错问题？

- 所有资源切换到统一域名，但是这样就失去了 `CDN` 的优势。
- 在脚本文件的 `HTTP response header` 中设置 `CORS`。
1. `Access-Control-Allow-Origin: You-allow-origin`；
2. script 标签中添加 `crossorigin` 属性，例如 `<script src="http://www.xxx.com/index.js" crossorigin></script>`


响应头和`crossorigin`取值问题

1. `crossorigin="anonymous"`(默认)，`CORS` 不等于 `You-allow-origin`，不能带 `cookie`
1. `crossorigin="use-credentials"`且 `Access-Control-Allow-Credentials: true` ,`CORS` 不能设置为 `*`，能带 `cookie`。
如果 `CORS` 不等于 `You-allow-origin`，浏览器不加载 js。

当你对自由能掌握的资源做好了 `cors` 时，`Script error` 基本可以过滤掉，不上报。

讲了这么多，还有一个非常重要的主题，如何分析我能捕获的错误信息？

#### JavaScript 错误剖析

一个 `JavaScript` 错误通常由一下错误组成

- 错误信息（error message）
- 追溯栈(stack trace)

![error](https://raw.githubusercontent.com/Godiswill/blog/master/错误监控/error.jpg)

![consoleError](https://raw.githubusercontent.com/Godiswill/blog/master/错误监控/consoleError.jpg)

开发者可以通过不同方式来抛出一个JavaScript 错误：

- throw new Error('Problem description.')
- throw Error('Problem description.') <-- equivalent to the first one
- throw 'Problem description.' <-- bad
- throw null <-- even worse

推荐使用第二种，第三四种浏览器无法就以上两种方式生成追溯栈。

如果能解析每行追溯栈中的错误信息，行列在配合 `SourceMap` 不就能定位到每行具体源代码了吗。
问题在于不同浏览器在以上信息给出中，并没有一个通用标准的格式。难点就在于解决兼容性问题。

例如 `window.onerror` 第五个参数 error 对象是2013年加入到 `WHATWG` 规范中的。
早期Safari 和 IE10还没有，Firefox是从14版本加入Error对象的，chrome 也是 2013 年才新加的。

#### 推荐做法

1. `window.onerror`是捕获JS 错误最好的方法，当有一个合法的Error对象和追溯栈时才上报。
也可以避免一些无法干扰的错误，例如插件错误和跨域等一些信息不全的错误。

2. `try catch` 增强，抛出的错误信息较全，可以弥补 `window.onerror` 的不足。但就像先前说过的，
`try catch` 无法捕获异步错误和`promise`错误，也不利用 `V8` 引擎性能优化。

例如腾讯的 [BadJS](https://github.com/BetterJS/badjs-report)，对以下推荐进行了`try catch`包裹

- setTimeout 和 setInterval 
- 事件绑定 
- ajax callback
- define 和 require
- 业务主入口

具体是否需要做到如此细粒度的包裹，还是视情况而定。

#### SourceMap

例如有以下错误追溯栈(stack trace)

```
ReferenceError: thisIsAbug is not defined
    at Object.makeError (http://localhost:7001/public/js/traceKit.min.js:1:9435)
    at http://localhost:7001/public/demo.html:28:12
```

能够解析成一下格式

```json
[
	{
	  "args" : [],
	  "url" : "http://localhost:7001/public/js/traceKit.min.js",
	  "func" : "Object.makeError",
	  "line" : 1,
	  "column" : 9435,
	  "context" : null
	}, 
	{
	  "args" : [],
	  "url" : "http://localhost:7001/public/demo.html",
	  "func" : "?",
	  "line" : 28,
	  "column" : 12,
	  "context" : null
	}
]
```

在有了行列和对应的 `SourceMap` 文件就能解析获取源代码信息了。

![sourceMapDel](https://raw.githubusercontent.com/Godiswill/blog/master/错误监控/sourceDeal.jpg)

解析结果

![sourceMapDel](https://raw.githubusercontent.com/Godiswill/blog/master/错误监控/sourceMap.jpg)

处理代码如下：

```javascript
import { SourceMapConsumer } from 'source-map';

// 必须初始化
SourceMapConsumer.initialize({
  'lib/mappings.wasm': 'https://unpkg.com/source-map@0.7.3/lib/mappings.wasm',
});

/**
 * 根据sourceMap文件解析源代码
 * @param {String} rawSourceMap sourceMap文件
 * @param {Number} line 压缩代码报错行
 * @param {Number} column 压缩代码报错列
 * @param {Number} offset 设置返回临近行数
 * @returns {Promise<{context: string, originLine: number | null, source: string | null}>}
 * context：源码错误行和上下附近的 offset 行，originLine：源码报错行，source：源码文件名
 */
export const sourceMapDeal = async (rawSourceMap, line, column, offset) => {
  // 通过sourceMap库转换为sourceMapConsumer对象
  const consumer = await new SourceMapConsumer(rawSourceMap);
  // 传入要查找的行列数，查找到压缩前的源文件及行列数
  const sm = consumer.originalPositionFor({
    line, // 压缩后的行数
    column, // 压缩后的列数
  });
  // 压缩前的所有源文件列表
  const { sources } = consumer;
  // 根据查到的source，到源文件列表中查找索引位置
  const smIndex = sources.indexOf(sm.source);
  // 到源码列表中查到源代码
  const smContent = consumer.sourcesContent[smIndex];
  // 将源代码串按"行结束标记"拆分为数组形式
  const rawLines = smContent.split(/\r?\n/g);
  let begin = sm.line - offset;
  const end = sm.line + offset + 1;
  begin = begin < 0 ? 0 : begin;
  const context = rawLines.slice(begin, end).join('\n');
  // 记得销毁
  consumer.destroy();
  return {
    context,
    originLine: sm.line + 1, // line 是从 0 开始数，所以 +1
    source: sm.source,
  }
};
```

大家根据 `SourceMap` 文件的格式，就能很好的理解这段代码了。

目前监控系统正在一点点开发当中，做的好用的话，会开源出来。。。

### 参考网站
1. [mozilla/source-map](https://github.com/mozilla/source-map)
1. [前端代码异常监控实战](https://github.com/happylindz/blog/issues/5)
1. [前端异常监控 - BadJS](https://slides.com/loskael/badjs/fullscreen#/)
1. [脚本错误量极致优化-让脚本错误一目了然](https://github.com/joeyguo/blog/issues/14)

