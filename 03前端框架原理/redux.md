# redux 源码分析
[原文链接](https://github.com/Godiswill/blog/issues/23)

## 简介
> Redux 是 JavaScript 状态容器，提供可预测化的状态管理。

### 三大原则
1. 单一数据源，创建一个 Redux store 来以存放应用中所有的 state。应用中应有且仅有一个 store。
1. State 是只读的，唯一改变 state 的方法就是触发 action，action.type 作为逻辑说明。
1. 使用纯函数来执行修改，reducers 来描述 action 如何改变 state tree，reducers 应该是一个纯函数。

### 对比 mobx
- 第一条，一般 redux 以 reducer 为拆分维度，然后 combineReducers 合成一个总 reducer 来创建 store，然后传给 React context，全局访问。
而 mobx 一般对于一个页面或页面级别的组件创建 store，然后在一个总文件中导入，作为一个大对象导出给 context。
- 第二条，redux 把 reducer 生产的 state 闭包在内部，无法直接访问，只能 dispatch action 驱动 reducer 函数来改变 state，逻辑集中在 reducer 内，可预测维护。
而 mobx `@observable state` 可以随意改变，甚至逻辑分散在视图 view 层，例如 `onClick={() => (state.status = 1)}`。虽然官方建议把逻辑封装
在 action 中，例如 `@action updata() {}`，但不是一种强约束。
- 第三条，这里是唯一一个 redux 难以强约束用户的地方，例如 reducer 中 `state.xx = 1; return state`，应该是 `return { ...state, xx: 1}`。
而鉴于 mobx 的机制， mobx 更别说了。

所以常说，mobx 常用中小型应用，redux 更适合大型应用。

## 概览
```
./src
├── applyMiddleware.ts
├── bindActionCreators.ts
├── combineReducers.ts
├── compose.ts
├── createStore.ts
└── index.ts
```
- index.ts，核心的 5 个文件名对应 redux 暴露的关键的 5 个函数。
```javascript
export {
  createStore,
  combineReducers,
  bindActionCreators,
  applyMiddleware,
  compose,
}
```
- createStore，主函数用来创建 redux 实例，利用闭包隐藏数据，暴露接口操作内部数据。使用订阅发布模式，当数据改变时发布通知。
- combineReducers，组合多个 reducer 函数，reducer 就是一个创建、修改重新创建数据的工厂。数据可以交给多个 reducer 小车间创建。
- bindActionCreators，当需要隐藏 dispatch 或 store 时用到，往往是传给下一个组件时，让组件无感知 redux 的存在。
- compose，工具函数
- applyMiddleware，利用 compose 来实现，store.dispatch 传给最后一个中间件函数，前一个中间件函数能调用后一个中间件函数。

## 使用
例子都是摘录来的，不想看的可以跳过。

- createStore
```javascript
import { createStore } from 'redux';

function reducer(state = [], action) {
  switch (action.type) {
    case 'ADD_TODO':
      return state.concat([action.text]);
    default:
      return state
  }
}
// createStore 至少接收一个参数、最多三个。第二个是初始化 state 对象，必须是一个纯对象
let store = createStore(reducer, ['Use Redux']);

store.dispatch({
  type: 'ADD_TODO',
  text: 'Read the docs',
});

console.log(store.getState());
// [ 'Use Redux', 'Read the docs' ]
```

- combineReducers
```javascript
// reducers/todos.js
export default function todos(state = [], action) {
  switch (action.type) {
  case 'ADD_TODO':
    return state.concat([action.text]);
  default:
    return state
  }
}
```

```javascript
// reducers/counter.js
export default function counter(state = 0, action) {
  switch (action.type) {
  case 'INCREMENT':
    return state + 1;
  case 'DECREMENT':
    return state - 1;
  default:
    return state
  }
}
```

```javascript
// reducers/index.js
import { combineReducers } from 'redux';
import todos from './todos';
import counter from './counter';

// 这里 combineReducers 会根据传入的 reducer 名称设置为 state 的属性名
// 可以设置别名 combineReducers({ cnt: counter }); 最终 state = { cnt: 0 }
export default combineReducers({
  todos,
  counter
})
```

```javascript
// App.js
import { createStore } from 'redux';
import reducer from './reducers/index';

let store = createStore(reducer);
console.log(store.getState());
// {
//   counter: 0,
//   todos: []
// }

store.dispatch({
  type: 'ADD_TODO',
  text: 'Use Redux'
});
console.log(store.getState());
// {
//   counter: 0,
//   todos: [ 'Use Redux' ]
// }
```

- bindActionCreators
```javascript
// actionCreators.js
// action 函数
export function addTodo(text) {
  return {
    type: 'ADD_TODO',
    text
  };
}

export function removeTodo(id) {
  return {
    type: 'REMOVE_TODO',
    id
  };
}
// App.js
const bindAction = bindActionCreators({ addTodo, removeTodo }, dispatch);
<Child {...bindAction} />

// Child.js
const {addTodo, removeTodo} = props.bindAction;
addTodo('text'); 
// 相当于 dispatch( addTodo('text') ); 子组件不知道 redux 的存在，却驱动了数据的更新。
```

- applyMiddleware，当有多个参数的时，底层用 compose 来组合。
```javascript
// dispatch 只接收一个纯对象 
function actionCreator( name ) { return { type: 'ActionName', name } }
store.dispatch(
  actionCreator( '张三' )
);

// 但要根据用户id 异步获取姓名怎么办？

// 使用 redux-thunk 支持 dispatch 接收一个函数，
// 把 store 上 dispatch, getState 的控制权传给该函数
import { createStore, combineReducers, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import * as reducers from './reducers';

const reducer = combineReducers(reducers);
// applyMiddleware 为 createStore 注入了 middleware:
const store = createStore(reducer, applyMiddleware(thunk));

function asyncAction(id) {
  return (dispatch, getState) => ajax(id).then(name => dispatch( actionCreator(name) ));
}

// thunk 打破了 dispatch 只能接收纯对象的约定
store.dispatch(
  asyncAction(123)
);
```
## 深入 redux

### createStore
- createStore 概览，典型的发布订阅模式

```javascript
function createStore(reducer, preloadedState, enhancer) {
  // preloadedState、enhancer 不能同为函数，enhancer 为函数时，第四个参数不能为函数
  if (typeof preloadedState === 'function' && typeof enhancer === 'function' || typeof enhancer === 'function' && typeof arguments[3] === 'function') {
    throw new Error('It looks like you are passing several store enhancers to ' + 'createStore(). This is not supported. Instead, compose them ' + 'together to a single function.');
  }
  // preloadedState、enhancer 同为函数时，preloadedState 复制给 enhancer，preloadedState 置为 undefined
  if (typeof preloadedState === 'function' && typeof enhancer === 'undefined') {
    enhancer = preloadedState;
    preloadedState = undefined;
  }
  // 增强函数 enhancer 不为 undefined 时，执行增强函数，这个主要用来实现中间件的连接
  if (typeof enhancer !== 'undefined') {
    if (typeof enhancer !== 'function') {
      throw new Error('Expected the enhancer to be a function.');
    }
    // 增强函数
    return enhancer(createStore)(reducer, preloadedState);
  }
  // reducer 不是函数抛错
  if (typeof reducer !== 'function') {
    throw new Error('Expected the reducer to be a function.');
  }

  let currentReducer = reducer; // 存储当前 reducer，也用于 replaceReducer 替换
  let currentState = preloadedState; // 初始化 state
  let currentListeners = []; // 订阅的回调数组
  let nextListeners = currentListeners; // 避免在发布通知调用用户回调函数时抛错影响了数组
  let isDispatching = false; // 防止在 reducer 中执行，getState、dispatch、subscribe、unsubscribe
  
  // currentListeners 数组浅拷贝，防止 dispatch 阶段执行用户回调抛错
  // 导致 dispatch 中断了，却影响了原来的数组结构 
  function ensureCanMutateNextListeners() {
    if (nextListeners === currentListeners) {
      nextListeners = currentListeners.slice();
    }
  }
  
  // 获取 currentState
  function getState() {}
  
  // 订阅消息，即 listener 入 currentListeners 队列
  function subscribe(listener) {}
  
  // 根据 action.type 执行 reducer 函数，触发 state 更新，让后发布通知即遍历 nextListeners 执行
  function dispatch(action) {}
  
  // 动态更换 reducer，然后根据新的 reducer 初始化一次 state
  function replaceReducer(nextReducer) {}
  
  // 为了支持未来 Observable 新特性，还在提案阶段，不讨论
  // function observable() {}
  
  // type 为一个随机字符串不会和 reducer 中的任何 type 相匹配
  // 如果 reducer 没有默认匹配，则初始化的 state 为 preloadedState
  dispatch({ type: ActionTypes.INIT });
  
  const store = {
    getState,
    subscribe,
    dispatch,
    replaceReducer,
  };
  return store;
}
```
- 解释下 isDispatching 的作用，例如你在 reducer 中尝试以下操作，都会抛错
```javascript
function reducer(state = [], action) {
  // reducer 中执行 getState、dispatch、subscribe、unsubscribe
  action.store && action.store.getState();
  action.store && action.store.dispatch({
    type: 'hello',
    text: 'world',
  });
  action.store && action.store.subscribe(() => {});
  switch (action.type) {
    case 'ADD_TODO':
      return state.concat([action.text]);
    default:
      return state
  }
}
```
- getState
```javascript
function getState() {
  if (isDispatching) {
    throw new Error('reducer 函数中不能执行 getState、dispatch、subscribe、unsubscribe');
  }

  return currentState; // 闭包隐藏内部 state，只能通过暴露 api 获取
}
```

- subscribe
```javascript
function subscribe(listener) {
  if (typeof listener !== 'function') {
    throw new Error('Expected the listener to be a function.');
  }

  if (isDispatching) {
    throw new Error('reducer 函数中不能执行 getState、dispatch、subscribe、unsubscribe');
  }

  let isSubscribed = true; // 注册凭证
  ensureCanMutateNextListeners(); // 确保原回调队列在代码抛错时受到干扰
  
  nextListeners.push(listener); // 发布订阅，必不可少的入队列操作
  
  // 返回取消订阅函数
  return function unsubscribe() {
    if (!isSubscribed) { // 防止 unsubscribe 被多次执行
      return;
    }

    if (isDispatching) {
      throw new Error('reducer 函数中不能执行 getState、dispatch、subscribe、unsubscribe');      
    }

    isSubscribed = false; // 一旦执行 unsubscribe 就注销掉注册凭证
    ensureCanMutateNextListeners();
    // 找到队列中的函数，剔除
    const index = nextListeners.indexOf(listener);
    nextListeners.splice(index, 1);
    currentListeners = null; // currentListeners 会在 dispatch 中恢复
  };
}
```
- dispatch
```javascript
function dispatch(action) {
  if (!isPlainObject(action)) { // 什么是纯对象？1. 字面量定义对象：const obj = {}; 2. const obj = new Object();
    throw new Error('action 必须是个纯对象，异步操作需要自定义中间件');
  }

  if (typeof action.type === 'undefined') {
    throw new Error('必不可少的 type ');
  }

  if (isDispatching) {
    throw new Error('reducer 函数中不能执行 getState、dispatch、subscribe、unsubscribe');
  }

  try { // 防止用户 reducer 抛错
    isDispatching = true; // isDispatching 用来控制 reducer 执行阶段
    currentState = currentReducer(currentState, action);
  } finally {
    isDispatching = false;
  }
  // 发布通知
  const listeners = (currentListeners = nextListeners); // 在 unsubscribe 时 null，这里被恢复
  for (let i = 0; i < listeners.length; i++) {
    const listener = listeners[i];
    listener();
  }

  return action;
}
```
- replaceReducer
```javascript
function replaceReducer(nextReducer) {
  if (typeof nextReducer !== 'function') {
    throw new Error('reducer 必须是个函数');
  }
  currentReducer = nextReducer; // 替换闭包中的 reducer

  // type: ActionTypes.REPLACE 是个独一无二的随机字符
  // 所有 reducer 中，最好有个默认 case
  dispatch({ type: ActionTypes.REPLACE });

  return store;
}
```

到此最重要的 createStore 函数就实现完毕。接下来分析两个辅助函数 bindActionCreators，combineReducers，最后分析实现中间件功能的 compose、applyMiddleware。
### bindActionCreators
```javascript
function bindActionCreators(actionCreators, dispatch) {
  if (typeof actionCreators === 'function') { // actionCreators 可以是单个函数
    return bindActionCreator(actionCreators, dispatch);
  }

  if (typeof actionCreators !== 'object' || actionCreators === null) {
    throw new Error("bindActionCreators 得是个对象或函数");
  }

  let boundActionCreators = {};

  // 也可以是多个函数的导出，例如 export { actionCreators1, actionCreators2, ... }
  for (const key in actionCreators) {
    const actionCreator = actionCreators[key];

    if (typeof actionCreator === 'function') {
      boundActionCreators[key] = bindActionCreator(actionCreator, dispatch);
    }
  }

  return boundActionCreators;
}

// 实际上就是形成闭包对外隐藏 actionCreator, dispatch。
// 返回的函数接受 actionCreator 的参数，然后 dispatch。
function bindActionCreator(actionCreator, dispatch) {
  return function (...args) {
    return dispatch(actionCreator.apply(this, args));
  };
}
```
### combineReducers
```javascript
function combineReducers(reducers) {
  const reducerKeys = Object.keys(reducers);
  const finalReducers = {};
  // reducers 是一个包含多个 reducer 函数的对象
  for (let i = 0; i < reducerKeys.length; i++) {
    const key = reducerKeys[i];

    // 这里会做很多判断，为了简便删了
    // 例如你不能在 reducer 函数里使用 redux 内部自定义的 ActionTypes.INIT
    // reducer 函数默认都应该返回一个非 undefined 的值
    // reducer 函数用户明确知道不需要一个默认值，也应该用 null 代替 undefined
    // 等等
    if (typeof reducers[key] === 'function') {
      finalReducers[key] = reducers[key];
    }
  }
  const finalReducerKeys = Object.keys(finalReducers);

  // 返回的是一个组合后的 reducer 函数
  return function combination(state = {}, action) {
    let hasChanged = false;
    const nextState = {};
    for (let i = 0; i < finalReducerKeys.length; i++) {
      const key = finalReducerKeys[i];
      const reducer = finalReducers[key];
      const previousStateForKey = state[key];
      
      // 遍历执行所有的 reducer
      const nextStateForKey = reducer(previousStateForKey, action);
      
      if (typeof nextStateForKey === 'undefined') {
        throw new Error('reducer 不应该给个 undefined');
      }
      nextState[key] = nextStateForKey;
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
    }
    // 如果其中有一个 reducer 返回的新的 state 有变更，则最终返回一个新的 state
    hasChanged = hasChanged || finalReducerKeys.length !== Object.keys(state).length;

    return hasChanged ? nextState : state
  }
}
```
### compose
- 辅助函数，效果：compose(fn1, fn2, fn3, ...) fn1( fn2( fn3(...) ) ); 即 fn3 函数执行的返回值传给 fn2，接着 fn2 的返回值传给 fn1 执行。
```javascript
function compose(...funcs) {
  if (funcs.length === 0) {
    return arg => arg;
  }
  
  if (funcs.length === 1) {
    return funcs[0];
  }

  return funcs.reduce((a, b) => (...args) => a(b(...args)));
}
```
### applyMiddleware
```javascript
function applyMiddleware(...middlewares) {
  return (createStore) => (reducer, ...args) => {
    const store = createStore(reducer, ...args);
    let dispatch = () => {
      throw new Error('中间件生成函数不能执行 dispatch 操作');
    };

    const middlewareAPI = {
      getState: store.getState,
      dispatch: (action, ...args) => dispatch(action, ...args)
    };

    const chain = middlewares.map(middleware => middleware(middlewareAPI));
    dispatch = compose(...chain)(store.dispatch);

    return {
      ...store,
      dispatch
    };
  }
}
```
### thunk 中间件
```javascript
function createThunkMiddleware(extraArgument) {
  return ({ dispatch, getState }) => (next) => (action) => {
    if (typeof action === 'function') {
      return action(dispatch, getState, extraArgument);
    }

    return next(action);
  };
}

const thunk = createThunkMiddleware();
```
- 我们来串联下，中间件是如何进行的
1. const store = createStore(reducer, preloadedState, enhancer = applyMiddleware(thunk));
1. 当 enhancer 存在时，执行 createStore 其实是执行 enhancer(createStore)(reducer, preloadedState);
1. 所以 applyMiddleware 执行返回的是一个接受 createStore 的函数，返回一个新的 createStore 函数，接收 reducer, preloadedState;
1. 最终返回一个 store 对象，看看中间件是如何接手管辖权的。
	1. 中间件需要是一个接收 store 对象的函数，遍历执行中间件一遍生成 chain 这样每个中间件就能闭包住 store；
	1. 接着在 compose 中执行了一次，最后一个中间件通过 next 参数接收了 store.dispatch，返回了一个接受 action 的函数赋值给 store；
	1. 此时只有一个 thunk 中间件，如果传一个函数的话，控制权就给了用户，通过参数可以拿到 dispatch, getState。如果 action 是对象，此时 next === 内部的 store.dispatch ，就像原来一样。
	1. 如果有多个中间件，那么 `applyMiddleware(a, b)`，a 中的 next 就是 b 中返回的 action => {} 函数，b 中的 next 就是 store.dispatch。这样就串起来了。

- 所以一般中间件的书写的套路是 store => next => action => {};

## 总结
完。
