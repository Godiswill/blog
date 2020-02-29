# 源码分析：react hook 最佳实践（上篇）
[原文链接](https://github.com/Godiswill/blog/issues/18)

## 前言
本文从 `mini React` —— `Preact` 源码的角度，分析 `React Hook` 各个 `API` 的优点缺点。
从而理解为什么要用 `hook`，以及如何最佳使用。

## 2条规则
### 为什么？
1. ✅只在最顶层使用 Hook，不要在循环，条件或嵌套函数中调用 Hook；
2. ✅只在 React 函数中调用 Hook，不要在普通的 JavaScript 函数中调用 Hook。

### 源码分析
```javascript
let currentIndex; // 全局索引
let currentComponent; // 当前 hook 所在的组件

function getHookState(index) {
  const hooks =
    currentComponent.__hooks ||
    (currentComponent.__hooks = {_list: [], _pendingEffects: []});

  if (index >= hooks._list.length) {
    hooks._list.push({});
  }
  return hooks._list[index];
}
```

```javascript
// 获取注册的 hook
const hookState = getHookState(currentIndex++);
```
- hook 状态都维护在数组结构中，执行 `hook api` 时，索引 `currentIndex + 1` 依次存入数组。
当组件 `render` 之前，会先调用 `hook render`，重置索引和设置当前组件，hook 注入在 `options` 内。

```javascript
options._render = vnode => {
  currentComponent = vnode._component;
  currentIndex = 0;
  // ...
};
```
- 首先需要知道一点的是，`函数组件` 在每次 `diff` 时，整个函数都会重新执行，
而 `class组件` 只会执行 `this.render`，因此 `hook` 在性能上会有些损耗，
考虑到这一点 `hook` 为那些声明开销很大的数据结构和函数，提供了 `useMemo` 和 `useCallback` 优化。

- `hook` 在每次 `render` 时，取上一次 `hook state` 时，
如果在循环，条件或嵌套函数不确定的分支里执行，就有可能取错数据，导致混乱。

```javascript
function Todo(props) {
  const [a] = useState(1);
  if(props.flag) {
    const [b] = useState(2);
  }
  const [c] = useState(3);
  // ...
}
```

```javascript
<Todo flag={true} />
```

- 此时 `a = 1, b = 2, c = 3`;

```javascript
<Todo flag={false} />
```
- 当条件被改变时，`a = 1, c = 2` 。`c `取错了状态！

第二条嘛，就显而易见了，`hook` 寄生于 `react` 组件和生命周期。

- `Preact hook` 在 `options` 对象上声明了 `_render` -> `diffed` -> `_commit` -> `unmount` 四个钩子，
分别会在对象组件的生命周期前执行，这样侵入性较小。

![preact](https://raw.githubusercontent.com/Godiswill/blog/master/03前端框架原理/preact.jpg)

## useState
### 使用方式
```javascript
// 声明 hook
const [state, setState] = useState(initialState);
// 更新 state
setState(newState);

// 也可以函数式更新
setState(prevState => { // 可以拿到上一次的 state 值
  // 也可以使用 Object.assign
  return {...prevState, ...updatedValues};
});
```

- 惰性初始 state。如果初始化 `state` 值开销很大，可以传入函数，初始化只会执行一次。
```javascript
const [state, setState] = useState(() => {
  const initialState = someExpensiveComputation(props);
  return initialState;
});
```
- 跳过 state 更新。设置相同的值(`Object.is`判断)，不会触发组件更新。
```javascript
const [state, setState] = useState(0);
// ...
// 更新 state 不会触发组件重新渲染
setState(0);
setState(0);
```

### 为什么？
- 坑：依赖 `props.state === 1` 初始化 `hook`，为什么 `props.state === 2` 时，`hook state` 不会变化？
```javascript
function Component(props) {
  const [state, setState] = useState(props.state);
  // ...
}
```

- 惰性初始的原理是什么？
- `hook state` 变更是怎么驱动组件渲染的，为什么说可以当 `class state` 使用？

### 源码分析
- `Preact` 中 `useState` 是使用 `useReducer` 实现的，便于行文，代码会略加修改。

```javascript
function useState(initialState) {
  const hookState = getHookState(currentIndex++);
  if (!hookState._component) {
    hookState._component = currentComponent;

    hookState._value = [
      invokeOrReturn(undefined, initialState),

      action => {
        const nextValue = invokeOrReturn(hookState._value[0], action);
        if (hookState._value[0] !== nextValue) {
          hookState._value[0] = nextValue;
          hookState._component.setState({});
        }
      }
    ];
  }

  return hookState._value;
}
```
```javascript
// 工具函数，用来支持函数式初始和更新
function invokeOrReturn(arg, f) {
  return typeof f === 'function' ? f(arg) : f;
}
```

- 可以看出 `useState` 只会在组件首次 `render` 时初始化一次，以后由返回的函数来更新状态。

1. 坑：初始化(包括传入的函数)只会执行一次，所有不应该依赖 `props` 的值来初始化 `useState`;
1. 优化：可以利用传入函数来性能优化开销较大的初始化操作。

- `hookState._value[0] !== nextValue` 比较新旧值避免不必要的渲染。
- 可以看出，更新操作利用了组件实例的 `this.setState` 函数。这就是为什么 `hook` 可以代替 `class` 的 `this.state` 使用。

## useEffect
### 使用方式

- 例如，常用根据 `query` 参数，首次加载组件只发一次请求内容。

```javascript
function Component(props) {
  const [state, setState] = useState({});
  
  useEffect(() => {
    ajax.then(data => setState(data));
  }, []); // 依赖项
  // ...
}
```

- `useState` 有说到，`props` 初始 `state` 有坑，可以用 `useEffect` 实现。

```javascript
function Component(props) {
  const [state, setState] = useState(props.state);
  
  useEffect(() => {
    setState(props.state);
  }, [props.state]); // props.state 变动赋值给 state
  // ...
}
```
- 清除副作用，例如监听改变浏览器窗口大小，之后清除副作用

```javascript
function WindowWidth(props) {
  const [width, setWidth] = useState(0);

  function onResize() {
    setWidth(window.innerWidth);
  }

	// 只执行一次副作用，组件 unmount 时会被清除
  useEffect(() => {
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return <div>Window width: {width}</div>;
}
```
- 注意：在 `useEffect` 在使用 `state` 时最好把它作为依赖，不然容易产生 `bug`

```javascript
function Component() {
  const [a, setA] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => console.log(a), 100);
    return () => clearInterval(timer)
  }, []);
  return <button onClick={() => setA(a+1)}>{a}</button>
}
```
当你点击按钮 `a+=1` 时，此时 `console.log` 依旧打印 `0`。
这是因为 `useEffect` 的副作用只会在组件首次加载时入 `_pendingEffects` 数组，形成闭包。

修改如下：
```diff
function Component() {
  const [a, setA] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => console.log(a), 100);
    return () => clearInterval(timer)
-  }, []);
+  }, [a]);
  return <button onClick={() => setA(a+1)}>{a}</button>
}
```

这段代码在 `React` 里运行，输出会随点击按钮而变化，而在 `preact` 中，之前定时器未被清除，
说明有 `bug`。-_-||

### 为什么？
- `useEffect` 解决了什么问题

一般发送数据请求 `componentDidMount` 中，之后 `componentWillUnmount` 在相关清理。
这就导致相互无关的逻辑夹杂在 `componentDidMount`，而对应的扫尾工作却分配在 `componentWillUnmount` 中。

有了 `useEffect` ，你可以把相互独立的逻辑写在不同的 `useEffect` 中，他人担心维护时，也不用担心其他代码块里还有清理代码。

- 在组件函数体内执行副作用(改变 DOM、添加订阅、设置定时器、记录日志等)是不被允许的？

每次 `diff` 函数组件会被当做`class` 组件的 `this.render` 函数类似使用，
整体会被执行，在主体里操作副作用是致命的。

- `useEffect` 的机制？

### 源码分析

```javascript
function useEffect(callback, args) {
  const state = getHookState(currentIndex++);
  if (argsChanged(state._args, args)) {
    state._value = callback;
    state._args = args;

    currentComponent.__hooks._pendingEffects.push(state);
  }
}
```
- 工具函数，依赖项为 `undefined` 或依赖项数组中一个值变动，则 `true`
```javascript
function argsChanged(oldArgs, newArgs) {
  return !oldArgs || newArgs.some((arg, index) => arg !== oldArgs[index]);
}
```

- 可以看出副作用的回调函数会在 `_pendingEffects` 数组中维护，代码有两处执行

```javascript
options._render = vnode => {
  currentComponent = vnode._component;
  currentIndex = 0;

  if (currentComponent.__hooks) { // 这里为什么要清理了再执行！！！
    currentComponent.__hooks._pendingEffects.forEach(invokeCleanup);
    currentComponent.__hooks._pendingEffects.forEach(invokeEffect);
    currentComponent.__hooks._pendingEffects = [];
  }
};
```
````javascript
function invokeCleanup(hook) {
  if (hook._cleanup) hook._cleanup();
}

function invokeEffect(hook) {
  const result = hook._value(); // 如果副作用函数有返回函数的，会被当成清理函数保存。
  if (typeof result === 'function') hook._cleanup = result;
}
````
```javascript
options.diffed = vnode => {
  if (oldAfterDiff) oldAfterDiff(vnode);

  const c = vnode._component;
  if (!c) return;

  const hooks = c.__hooks;
  if (hooks) {
    if (hooks._pendingEffects.length) {
      afterPaint(afterPaintEffects.push(c));
    }
  }
};
```
```javascript
function afterPaint(newQueueLength) {
	if (newQueueLength === 1 || prevRaf !== options.requestAnimationFrame) {
		prevRaf = options.requestAnimationFrame;
		(prevRaf || afterNextFrame)(flushAfterPaintEffects);
	}
}
```
```javascript
function flushAfterPaintEffects() {
  afterPaintEffects.some(component => {
    if (component._parentDom) {
      try {
        component.__hooks._pendingEffects.forEach(invokeCleanup);
        component.__hooks._pendingEffects.forEach(invokeEffect);
        component.__hooks._pendingEffects = [];
      } catch (e) {
        options._catchError(e, component._vnode);
        return true;
      }
    }
  });
  afterPaintEffects = [];
}
```

- 我很怀疑，`options._render` 的代码是从 `flushAfterPaintEffects` 不假思索的拷过去。
导致上面讲到的一个 `bug`。

- `afterPaint` 利用 `requestAnimationFrame` 或 `setTimeout` 来达到以下目的

与 componentDidMount、componentDidUpdate 不同的是，在浏览器完成布局与绘制之后，传给 useEffect 的函数会延迟调用，不会在函数中执行阻塞浏览器更新屏幕的操作。

## useMemo
### 使用方式
```javascript
const memoized = useMemo(
  () => expensive(a, b),
  [a, b]
);
```
### 为什么？
- `useMemo` 解决了什么问题

上面反复强调了，函数组件体会被反复执行，如果进行大的开销的会吃性能。
所以 `react` 提供了 `useMemo` 来缓存结果，`useCallback` 来缓存函数。

### 源码分析
```javascript
function useMemo(factory, args) {
  const state = getHookState(currentIndex++);
  if (argsChanged(state._args, args)) {
    state._args = args;
    state._factory = factory;
    return (state._value = factory());
  }

  return state._value;
}
```

- 可以看出，只是把传入的函数根据依赖性执行了一遍把结果报错在内部的 `hook state` 中。

- 记住，所有的 `hook aoi` 都一样，不要在没有传入`state` 作为依赖项的情况下，在传入的函数体中
使用 `state` 的。

## useCallback
### 使用方式
```javascript
const onClick = useCallback(
  () => console.log(a, b),
  [a, b]
);
```
### 为什么？
- `useCallback` 解决了什么问题

上面提到了，用来缓存函数的

- 例如，上面优化监听窗口的例子。

```diff
function WindowWidth(props) {
  const [width, setWidth] = useState(0);

-  function onResize() {
-    setWidth(window.innerWidth);
-  }
  
+  const onResize = useCallback(() => {
+    setWidth(window.innerWidth);
+  }, []);

  useEffect(() => {
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return <div>Window width: {width}</div>;
}
```
上面说过，没有依赖的时，不使要用 `width`，但可以使用 `setWidth`，
函数是引用，闭包变量 `setWidth` 是同一个地址。

### 源码分析
- `useMemo` 的封装
```javascript
function useCallback(callback, args) {
  return useMemo(() => callback, args);
}
```

上篇完。

## 参考
1. [React 文档](https://zh-hans.reactjs.org/docs/hooks-reference.html)
1. [Preact 文档](https://preactjs.com/guide/v10/hooks)
1. [Preact 源码](https://github.com/preactjs/preact)

