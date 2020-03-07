# 源码分析：react hook 最佳实践
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

1. 坑：初始化(包括传入的函数)只会执行一次，所以不应该依赖 `props` 的值来初始化 `useState`;
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

与 `componentDidMount`、`componentDidUpdate` 不同的是，在浏览器完成布局与绘制之后，传给 useEffect 的函数会延迟调用，不会在函数中执行阻塞浏览器更新屏幕的操作。
（勘误：`React` 中 `useEffect` 能达到这效果，`Preact` 并没有实现）

## useMemo
### 使用方式
```javascript
function Counter () {
  const [count, setCount] = useState(0);
  const [val, setValue] = useState('');
  const expensive = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < count * 100; i++) {
      sum += i;
    }
    return sum
  }, [ count ]); // ✅ 只有 count 变化时，回调函数才会执行

  return (
    <>
      <span>You Clicked {expensive} times</span>
      <button onClick={() => setCount(count + 1)}>Click me</button>
      <input value={val} onChange={event => setValue(event.target.value)} />
    </>
  )
}
```
### 为什么？
- `useMemo` 解决了什么问题

上面反复强调了，函数组件体会被反复执行，如果进行大的开销的会吃性能。
所以 `react` 提供了 `useMemo` 来缓存函数执行返回结果，`useCallback` 来缓存函数。

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

- 可以看出，只是把传入的函数根据依赖性执行了一遍把结果保存在内部的 `hook state` 中。

- 记住，所有的 `hook api` 都一样，不要在没有传入`state` 作为依赖项的情况下，在副租用中
使用 `state`。

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
## useRef
### 使用方式
- 举个例子，点击按钮开启 60 秒倒计时，再次点击停止。
```javascript
function Counter() {
  const [start, setStart] = useState(false);
  const [time, setTime] = useState(60);

  useEffect(() => { // effect 函数，不接受也不返回任何参数
    let interval;
    if (start) {
      interval = setInterval(() => {
        setTime(time - 1); // ❌ time 在 effect 闭包函数里是拿不到准确值的
      }, 1000);
    }
    return () => clearInterval(interval) // clean-up 函数，当前组件被注销时调用
  }, [start]); // 依赖数组，当数组中变量变化时会调用 effect 函数

  return (
    <button onClick={() => setStart(!start)}>{time}</button>
  );
}
```

- 在前面的分析中，由于闭包的原因，取到的 `time` 值不是最新的。
可以用 `time` 的初始值来传给 `useRef`，再来驱动 `time` 的更新。
```diff
function Counter() {
  const [start, setStart] = useState(false);
  const [time, setTime] = useState(60);
+  const currentTime = useRef(time); // 生成一个可变引用
	
  useEffect(() => { // effect 函数，不接受也不返回任何参数
    let interval;
    if (start) {
      interval = setInterval(() => {
+        setTime(currentTime.current--) // currentTime.current 是可变的
-        setTime(time - 1); // ❌ time 在 effect 闭包函数里是拿不到准确值的
      }, 1000);
    }
    return () => clearInterval(interval) // clean-up 函数，当前组件被注销时调用
  }, [start]); // 依赖数组，当数组中变量变化时会调用 effect 函数

  return (
    <button onClick={() => setStart(!start)}>{time}</button>
  );
}
```
- `useRef` 生成一个对象 `currentTime = {current: 60}`，`currentTime` 对象在组件的整个生命周期内保持不变。

- 但这样处理有点多此一举，`setTime` 函数式更新不就好了嘛，`current` 可以用来替代 `interval`，这样外部也能取消倒计时。
```diff
function Counter() {
  const [start, setStart] = useState(false);
  const [time, setTime] = useState(60);
-  const currentTime = useRef(time); // 生成一个可变引用
+  const interval = useRef() // interval 可以在这个作用域里任何地方清除和设置
	
  useEffect(() => { // effect 函数，不接受也不返回任何参数
-    let interval;
    if (start) {
-      interval = setInterval(() => {
+      interval.current = setInterval(() => {
-        setTime(currentTime.current--) // currentTime.current 是可变的
+        setTime(t => t - 1) // ✅ 在 setTime 的回调函数参数里可以拿到对应 state 的最新值
      }, 1000);
    }
-    return () => clearInterval(interval) // clean-up 函数，当前组件被注销时调用
+    return () => clearInterval(interval.current) // clean-up 函数，当前组件被注销时调用
  }, [start]); // 依赖数组，当数组中变量变化时会调用 effect 函数

  return (
    <button onClick={() => setStart(!start)}>{time}</button>
  );
}
```

这样既能消灭 `interval` 变量的反复创建，也能让外部能够清理定时器 `interval.current`。

### 为什么？

- `useRef` 返回的对象在组件的整个生命周期内保持不变，怎么理解？
- 为什么不能改变返回的对象，而是只能改变对象 `current` 属性？

### 源码分析

```javascript
function useRef(initialValue) {
  return useMemo(() => ({ current: initialValue }), []);
}
```

- 内部使用了 `useMemo` 来实现，传入一个生成一个具有 `current` 属性对象的函数，
空数组依赖，所以在整个生命周期该函数只执行一次。
- 直接改变 `useRef` 返回的值，无法改变内部 `hookState._value` 值，只能通过 改变内部 `hookState._value.current` 来影响下次的使用。

## useLayoutEffect
### 使用方式
- 与 `useEffect` 使用方式相同。

### 为什么？
- 与 `useEffect` 区别在哪里？

### 源码分析
- `useEffect` 的回调在 `option.diffed` 阶段，
使用 `requestAnimationFrame` 或 `setTimeout(callback, 100)` 来异步执行，由于作者都认为
`this is not such a big deal` ，所以代码就不贴了，而且只是有一层 `requestAnimationFrame` 也达不到下一帧之前执行的效果。

- `useLayoutEffect` 的回调在 `option._commit` 阶段批量同步处理。

- 在 `React` 中估计使用了 `requestIdleCallback` 或 `requestAnimationFrame` 来进行时间分片，以避免阻塞视觉更新。

- 由于 `react` 自己内部使用了优先级调度，势必会导致某些低优先级会延迟执行，只有你觉得优先级很高，在不管阻塞渲染的情况也要同步执行，
那么你可以用 `useLayoutEffect`。

## useReducer
### 使用方式
- 数字±1与重置
```javascript
const initialState = 0;
const reducer = (state, action) => {
  switch (action) {
    case 'increment': return state + 1;
    case 'decrement': return state - 1;
    case 'reset': return 0;
    default: throw new Error('Unexpected action');
  }
};

function Counter() {
  const [count, dispatch] = useReducer(reducer, initialState);
  return (
    <div>
      {count}
      <button onClick={() => dispatch('increment')}>+1</button>
      <button onClick={() => dispatch('decrement')}>-1</button>
      <button onClick={() => dispatch('reset')}>reset</button>
    </div>
  );
}
```

- 第二个参数可以一个函数，返回 `state` 的初始值；
- 第三个参数可以一个函数，以第二个参数为入参，返回 `state` 的初始值。

### 为什么？
- 什么时候使用 `useReducer` 

state 逻辑较复杂且包含多个子值，下一个 state 依赖于之前的 state。

使用 `reducer` 最好是个纯函数，集中处理逻辑，修改源头方便追溯，避免逻辑分散各处，也能避免不可预知的地方修改了状态，导致 bug 难追溯。



### 源码分析
- 前面说到，`useState` 是 `useReducer` 实现的。
```javascript
function useReducer(reducer, initialState, init) {
  const hookState = getHookState(currentIndex++);
  if (!hookState._component) {
    hookState._component = currentComponent;

    hookState._value = [
      !init ? invokeOrReturn(undefined, initialState) : init(initialState),

      action => {
        const nextValue = reducer(hookState._value[0], action);
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
- 上一次的 `state` 为 `reducer` 的第一个参数，`dispatch` 接受的参数为第二个参数，产生新的 `state`。

## useContext
### 使用方式
- 例如设置全局主题 `theme`
```javascript
// App.js
function App() {
  return <Toolbar theme="dark" />;
}

// Toolbar.js
function Toolbar(props) {
  // 很麻烦，theme 需层层传递所有组件。
  return (
    <div>
      <ThemedButton theme={props.theme} />
    </div>
  );
}

// ThemedButton.js
class ThemedButton extends React.Component {
  render() {
    return <Button theme={this.props.theme} />;
  }
}
```
- 使用 Context
```diff
// context.js
+ const ThemeContext = React.createContext('light');

// App.js
function App() {
-  return <Toolbar theme="dark" />;
+  return (
+    <ThemeContext.Provider value="dark">
+      <Toolbar />
+    </ThemeContext.Provider>
   );
}

// Toolbar.js
function Toolbar(props) {
  return (
    <div>
-      <ThemedButton theme={props.theme} />
+      <ThemedButton />  // 无需传递
    </div>
  );
}

// ThemedButton.js
class ThemedButton extends React.Component {
+  static contextType = ThemeContext;   // 指定 contextType 读取当前的 theme context。
  render() {
-    return <Button theme={this.props.theme} />;
+    return <Button theme={this.context} />; // React 会往上找到最近的 theme Provider，theme 值为 “dark”。
  }
}
```
- 使用 useContext
```diff
// context.js
const ThemeContext = React.createContext('light');

// App.js
function App() {
  return (
    <ThemeContext.Provider value="dark">
      <Toolbar />
    </ThemeContext.Provider>
   );
}

// Toolbar.js
function Toolbar(props) {
  return (
    <div>
      <ThemedButton /> // 无需传递
    </div>
  );
}

// ThemedButton.js
- class ThemedButton extends React.Component {
-   static contextType = ThemeContext;   // 指定 contextType 读取当前的 theme context。
-   render() {
-     return <Button theme={this.context} />; // React 会往上找到最近的 theme Provider，theme 值为 “dark”。
-   }
- }
+ function ThemedButton() {
+   const theme = useContext(ThemeContext);
+ 
+   return <Button theme={theme} />;
+ }
```
- `useContext(MyContext)` 相当于 `class 组件` 中的 `static contextType = MyContext`

- 当组件上层最近的 <MyContext.Provider> 更新时，该 Hook 会触发重渲染，并使用最新传递给 MyContext provider 的 context value 值。即使祖先使用 React.memo 或 shouldComponentUpdate，也会在组件本身使用 useContext 时重新渲染。

可以使用 `React.memo` 或 `useMemo hook` 来[性能优化](https://github.com/facebook/react/issues/15156#issuecomment-474590693)。
### 为什么？
- useContext 怎么拿到 context 的，然后驱动变化？
### 源码分析
- 在当前组件上，拿到 context，订阅当前组件，当 context 发生变化时，发布通知。
```javascript
function useContext(context) {
  const provider = currentComponent.context[context._id];
  if (!provider) return context._defaultValue;
  const state = getHookState(currentIndex++);
  // This is probably not safe to convert to "!"
  if (state._value == null) {
    state._value = true;
    provider.sub(currentComponent);
  }
  return provider.props.value;
}
```
## 自定义 hook
### 使用方式
- 常见的给组件添加防抖功能，例如使用 antd 的 `Select` 或 `Input` 组件，你可能分别对应使用他们来重新组合一个新的组件，把防抖实现在新组件内部。
- 利用自定义 hook 可以更细粒度的来分离组件与防抖的关系。

```javascript
// 防抖 hook
function useDebounce() {
  const time = useRef({lastTime: Date.now()});
  return (callback, ms) => {
    time.current.timer && clearTimeout(time.current.timer);
    time.current.timer = setTimeout(() => {
      const now = Date.now();
      console.log(now - time.current.lastTime);
      time.current.lastTime = now;
      callback();
    }, ms);
  }
}
```
```javascript
function App() {
  const [val, setVal] = useState();
  const inputChange = useDebounce();
  // 可以多次使用
  // const selectChange = useDebounce();
  
  return (
    <>
      <input onChange={
        ({target: {value}}) => {
          inputChange(() => setVal(value), 500)
        }
      }/>{val}
    </>
  );
}
```

## 函数组件 hook 与 class 组件的对比
### 缺点
1. 性能较差，但也只是浏览器解析JS级别的损耗。
### 优势
1. 减少了代码量，相关逻辑更聚合，便于阅读与维护；
1. 不用理解 `class` 和 `this`。`class` 目前还只是语法糖，标准还在更改，没有像传统面向对象的多态、多继承的概念，`this` 理解成本很高；
1. 纯函数有利于例如 `ts` 推导类型，等等。

## 参考
1. [React 文档](https://zh-hans.reactjs.org/docs/hooks-reference.html)
1. [Preact 文档](https://preactjs.com/guide/v10/hooks)
1. [Preact 源码](https://github.com/preactjs/preact)
1. [使用 React Hooks 重构你的小程序](https://aotu.io/notes/2019/07/10/taro-hooks/)

