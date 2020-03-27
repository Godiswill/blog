# koa 源码分析
[原文链接](https://github.com/Godiswill/blog/issues/22)

## 简介
koa 是由 Express 原班人马打造的，相比 Express 的大而全，koa 致力于成为一个更小、更富有表现力、更健壮的 Web 框架，适合作为 web 服务框架的基石。

koa1 通过组合不同的 generator，可以避免嵌套地狱，并极大地提升错误处理的效率。koa2 使用了最新的 `async await` generator 语法糖，使得开发更高效。

koa 不在内核方法中绑定任何中间件，但确很轻易集成中间件，只需要 use 方法传入一个中间件函数，就能方便获取请求响应等上下文信息和下一个中间件，使得中间件的使用井然有序。

## 概览
koa 源码在 lib 文件下四个文件中，接下来一一介绍每个模块文件的内容。

```
lib/
├── application.js
├── context.js
├── request.js
└── response.js
```

- application.js 导出一个类函数，用来生成koa实例。该类派生 node events，方便错误处理。
1. `use()` 添加订阅中间件，内部使用一个数组维护中间件；
1. `listen()` node http 起一个服务；
1. `callback()` 返回一个 http 服务回调函数 cb。
	1. compose 处理中间件数组，返回一个函数 fnMiddleware。内部 promise 化中间件，递归调用使得中间件拿到上下文 ctx 和下一个中间件 next 并顺序执行；
	1. createContext 在 cb 中接收 http 请求的回调参数 req、res，使得 application实例、context、request、response 能够相互访问 req、res，每次返回一个新的 context；
	1. handleRequest 最终执行 fnMiddleware，中间件无错误后调用私有函数 respond 返回响应。
- context.js 导出一个对象，主要功能有：错误处理、cookie 处理、代理 request.js、response.js 上的属性和方法（例如：访问ctx.url，其实是访问了 request.url，又其实访问了node http req.url）。
- request.js 导出一个对象，封装处理了 node 原生 http 的请求 req ，方便获取设置 req，避免直接与 req 打交道。
- response.js 导出一个对象，封装处理了 node 原生 http 的响应 res ，方便获取设置 res，避免直接与 res 打交道。

## 使用例子
- 起一个简单的服务
```javascript
const Koa = require('koa');
const app = new Koa();

app.listen(3000);
```
其实是以下的语法糖

```javascript
const http = require('http');
const Koa = require('koa');
const app = new Koa();

http.createServer(app.callback()).listen(3000);
```
- 使用中间件处理 node http 请求、响应
```javascript
const Koa = require('koa');
const app = new Koa();

// logger 中间件
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${ctx.method} ${ctx.url} - ${ms}`);
});

// response
app.use(async ctx => {
  ctx.body = 'Hello World';
});

app.listen(3000);
```

logger 中间件 `await next()` 时会暂停下面代码的执行，直到 response 中间件执行完毕。

注意到 response 没有执行 next，此时已没有下一个中间件，但即使执行也不会报错，因为内部处理为一个 Promise.resolve 的 promise。

注意在一个中间件中多次(2次及以上)执行 next() 会报错。

如果 logger 中间件不执行 next，那么 response 中间件不会被执行。也即 `ctx.body` 不会执行，application 中的 handleRequest 默认设置node http res.statusCode = 404，npm statuses 中维护了常用的 code 码文本提示音，例如 `404: Not Found`。

`ctx.body` 其实是调用了 koa response 对象的 body set 方法，赋值给 _body 属性并且根据值设置 http 状态码。最后是在中间件 resolve 后调用 application 中的私有 respond 函数，执行了 node http res.end()。


## 动手实现一个精简的 koa

### 骨架
- application.js 需要起服务，所以需要引入node http模块；需要发布订阅一些消息，所以需要继承node events模块。剩余引入其它三个文件的模块。
```javascript
const http = require('http');
const Emitter = require('events');
const context = require('./context');
const request = require('./request');
const response = require('./response');

class Koa extends Emitter {
  constructor() {
    super();
  }
  
  listen() {}
  
  use() {}
  
  callback() {}
  
  handleRequest() {}
  
  createContext() {}
}

module.exports = Koa;
```
- context.js
```javascript
let proto = {};

module.exports = proto;
```

- request.js
```javascript
const request = {};

module.exports = request;
```
- response.js
```javascript
const response = {};

module.exports = response;
```
### 第一步，接收一个中间功能

- 构造函数，其它三个对象都能被 app 实例访问。
```javascript
constructor() {
  super();
  this.context = Object.create(context);
  this.request = Object.create(request);
  this.response = Object.create(response);
  this.fn = null;
}
```

简单提一下为什么要使用 `Object.create`，例如避免改动 `this.context.x` 而影响 `context.x`
（除非你 `this.context.__proto__.x`，显然没人会刻意这么去做）。
```javascript
if(!Object.create) {
  Object.create = function(proto) {
    function F(){}
    F.prototype = proto;
    return new F;
  }
}
```

- listen，语法糖方便起 http 服务。
```javascript
listen(...args) {
  const server = http.createServer(this.callback());
  return server.listen(...args);
}
```

- use，订阅中间件，暂时只能订阅一个。
```javascript
use(fn) {
  this.fn = fn;
  return this;
}
```

- callback，处理中间件，并且返回一个接收 node http req，res 的回调函数。
每次接收一个 http 请求时，都会使用 koa createContext 根据当前请求环境新建上下文。
```javascript
callback() {
  return (req, res) => {
    const ctx = this.createContext(req, res);
    return this.handleRequest(ctx);
  };
}
```

- handleRequest，执行中间件，和响应 http 请求。
```javascript
handleRequest(ctx) {
  fn(ctx);
  ctx.res.end(ctx.body);
}
```

- createContext，每次处理一个 http 请求都会根据当前请求的 req、res 来更新相关内容。
一系列赋值操作，主要为了新生成得 context、request、response 可以相互访问，且能访问 koa app 实例和 http req、res。

```javascript
createContext(req, res) {
  const context = Object.create(this.context);
  const request = context.request = Object.create(this.request);
  const response = context.response = Object.create(this.response);
  
  context.app = request.app = response.app = this;
  context.req = request.req = response.req = req;
  context.res = request.res = response.res = res;
  
  request.ctx = response.ctx = context;
  request.response = response;
  response.request = request;
  return context;
}
````

- request.js，简单给 koa request 对象添加几个处理 url 的方法
```javascript
const parse = require('parseurl');

const request = {
  get url() {
    return this.req.url;
  },
  get path() {
    return parse(this.req).pathname;
  },
  get query() {
    return parse(this.req).query;
  }
};
```
- response.js，这里只添加一个设置响应 body 的方法
```javascript
const response = {
  get body() {
    return this._body;
  },
  set body(val) {
    this.res.statusCode = 200;
    this._body = val;
  }
};
```

- 主文件 index.js 
```javascript
const Koa = require('./application');
const app = new Koa();

app.use(ctx => {
  console.log(ctx.req.url);
  console.log(ctx.request.req.url);
  console.log(ctx.response.req.url);
  console.log(ctx.request.url);
  console.log(ctx.request.path);
  console.log(ctx.request.query);
  console.log(ctx.url);
  console.log(ctx.path);
  console.log(ctx.query);
  ctx.body = 'hello world';
});

app.listen(3000);
```

- node index.js，console 输出
```
/path?x=1&y=2
/path?x=1&y=2
/path?x=1&y=2
/path?x=1&y=2
/path
x=1&y=2
undefined
undefined
undefined
```

可以看出，可以使用 koa context、request、response 来访问 node req 的属性，也可以直接访问 request 对象上定义的方法。

建议是避免操作 node http 的 req 或 res。

众所周知，koa 是支持 context 实例代理访问 koa request、response 上的方法的。

### 第二步，实现 context 代理
- context.js，代理访问 koa request、response 上的方法

koa 使用了 `__defineSetter__` 和 `__defineGetter__` 来实现，提示这两个方法已被标准废弃，这里使用 `Object.defineProperty` 来实现。

注意 `Object.defineProperty` 只设置 get 方法 `enumerable` 和 `configurable` 默认都是 `false`。
```javascript
function defineGetter(prop, name) {
  Object.defineProperty(proto, name, {
    get() {
      return this[prop][name];
    },
    enumerable: true,
    configurable: true,
  });
}

function defineSetter(prop, name) {
  Object.defineProperty(proto, name, {
    set(val) {
      this[prop][name] = val;
    },
    enumerable: true,
    configurable: true,
  });
}

defineGetter('request', 'url');
defineGetter('request', 'path');
defineGetter('request', 'query');

defineGetter('response', 'body');
defineSetter('response', 'body');
```

- console.log 输出
```
/path?x=1&y=2
/path?x=1&y=2
/path?x=1&y=2
/path?x=1&y=2
/path
x=1&y=2
/path?x=1&y=2
/path
x=1&y=2
```
`ctx.body = 'hello world'` 也不是新添加属性，而是访问 response 上的 body set 方法。

### 第三部，接收多个同步中间件
```diff
constructor() {
-  this.fn = null;
+  this.middleware = [];
}

use(fn) {
-  this.fn = fn;
+  this.middleware.push(fn);
}
```

- 新增 compose，实现洋葱圈模型
```javascript
function compose(middleware) {
  return function (context, next) {
    let index = -1;
    return dispatch(0);
    function dispatch(i) {
      if(i <= index) throw new Error('next() 在中间件中被调用2次以上');
      index = i;
      let fn = middleware[i];
      if(i === middleware.length) fn = next;
      if(!fn) return;
      return fn(context, dispatch.bind(null, i + 1));
    }
  }
}
```

```diff
callback() {
+  const fn = compose(this.middleware); 
  return (req, res) => {
    const ctx = this.createContext(req, res);
-    return this.handleRequest(ctx);
+    return this.handleRequest(ctx, fn);
  };
}

- handleRequest(ctx) {
+ handleRequest(ctx, fnMiddleware) {
- fn(ctx);
+ fnMiddleware(ctx);
  ctx.res.statusCode = 200;
  ctx.res.end(ctx.body);
}
```
- index.js，就能使用多个中间件和 next 了
```javascript
app.use((ctx, next) => {
  console.log(ctx.url);
  next();
});

app.use((ctx, next) => {
  ctx.body = 'hello world';
  next();
});
```

### 第三部，异步洋葱圈模型

- 改造 compose，支持异步
```diff
function compose(middleware) {
  return function (context, next) {
    let index = -1;
    return dispatch(0);
    function dispatch(i) {
-      if(i <= index) throw new Error('next() 在中间件中被调用2次以上');
+      if(i <= index) return Promise.reject(new Error('next() 在中间件中被调用2次以上'));
      index = i;
      let fn = middleware[i];
      if(i === middleware.length) fn = next;
-      if(!fn) return;
+      if(!fn) return Promise.resolve();
-      return fn(context, dispatch.bind(null, i + 1));
+      try {
+        return Promise.resolve(fn(context, dispatch.bind(null, i + 1)));
+      } catch (err) {
+        return Promise.reject(err);
+      }
    }
  }
}
```

```diff
handleRequest(ctx, fnMiddleware) {
-  fnMiddleware(ctx);
-  ctx.res.statusCode = 200;
-  ctx.res.end(ctx.body);
+  fnMiddleware(ctx).then(() => {
+    ctx.res.statusCode = 200;
+    ctx.res.end(ctx.body);
+  });
}
```
- index.js 异步洋葱圈

```javascript
app.use(async (ctx, next) => {
  await new Promise(resolve => {
    setTimeout(() => {
      console.log(ctx.url);
      resolve();
    }, 500);
  });
  next();
});

app.use((ctx, next) => {
  ctx.body = 'hello world';
  next();
});
```

## 完

这样一个简单的 koa 的主要功能就实现了，行文为了简单，很多错误处理等细节都忽略了，这在正式的产品中是大忌，希望小心谨慎。
