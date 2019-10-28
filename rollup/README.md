# rollup 打包实践

### 简介

`rollup` 是一款像 `webpack` 一样的JS代码打包工具。它特别适合类库的维护，有了它你可以把单个复杂庞大的类库拆分成多个文件模块编写，最终打包成符合`UMD`、`AMD`、`ESM`等格式的单个或多个文件。它可以利用最新的ES6+ `modules` 规范，`Tree-Shaking` 不需要的代码，这样你就可以放心的引入你喜欢类库中的某个方法，而不必担心引入整个类库。

### Vue 官方使用

![modules](https://raw.githubusercontent.com/Godiswill/blog/master/rollup/modules.jpg)

![desc](https://raw.githubusercontent.com/Godiswill/blog/master/rollup/desc.jpg)

### JS 模块化演进

- JS历史：没有模块化机制
	
```javaScript
// 全局变量污染、命名冲突
var global = '全局变量';
// 污染命名空间
window.jQuery = {};

// 其他脚本中声明同名变量导致被覆盖
var global = {};
```

- 方案1：IIFE（立即调用函数表达式）
```javascript
// 利用闭包解决大量全局变量污染问题
// 最终导出的少量全局变量
window.jQuery = (function(){
    ...
    return jQuery;
})();
```

- 方案2：node 服务端 CommonJS 规范
```javascript
// import the entire utils object with CommonJS
// 缺陷：同步全量加载
const utils = require( './utils' );
const query = 'Rollup';
// use the ajax method of the utils object
utils.ajax(`https://api.com?search=${query}`).then(cb);

// 导出
module.exports = {
    ...
};
```

- 方案3：浏览器端 AMD 规范

```javascript
define("alpha", ["require", "exports", "beta"], function (require, exports, beta) {
    exports.verb = function() {
        return beta.verb();
        //Or:
        return require("beta").verb();
    }
});
```
著名的AMD两种实现，现在很少看见用了
1. Require.js
1. Sea.js


- 方案4：UMD 通用模块定义规范
```javascript
// Vue.js
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ?
        module.exports = factory() :
            typeof define === 'function' && define.amd ?
                define(factory) : (global.Vue = factory());
}(this, (function () {
    'use strict';

    ...
    return Vue;

})));
```

- 方案5：迟来的ES6标准: import/export

优势：
1. CommonJS 同步获取模块的方式不适合前端
2. AMD 怪异的使用方式和各版本实现上的歧义
3. ESM 统一标准规范形成语言特性
4. 语法层面的静态分析，Tree-Shaking
5. ...

Tree-Shaking
- 更快、更轻、减少复杂度
- 便于rollup、webpack 减少代码膨胀

```javascript
// import the entire utils object with CommonJS
const utils = require( './utils' );
const query = 'Rollup';
// use the ajax method of the utils object
utils.ajax(`https://api.com?search=${query}`).then(cb);

// import the ajax function with an ES6 import statement
import { ajax } from './utils';
const query = 'Rollup';
// call the ajax function
ajax(`https://api.com?search=${query}`).then(cb);
```

### 你有遇到一下问题吗？
- 功能复杂，文件太大了，不想在一个文件里维护，多个文件不想手动合并
- 不想手写符合UMD、AMD...规范包裹的代码
- 想引用其他库某个优秀方法，不想直接拷贝过来或不想引入整个包
- 如何把若干小文件代码同时打包成一个符合不同规范的文件和对应压缩包、sourcemap文件
...

如果你有以上困惑，rollup 统统能满足你。

### 构建你的第一个包

```bash
# 全局安装
$ npm i rollup -g

# 查看帮助
$ rollup -h
```

```bash
# 创建项目目录
$ mkdir -p rollup/src
$ cd rollup
```

新建src/main.js
```javascript
// src/main.js
import foo from './foo.js';
export default function () {
    console.log(foo);
}
```

新建src/foo.js
```javascript
// src/foo.js
export default 'hello world!';
```

命令行打包 `CommonJS`规范， 输出dist/bundle.js
```bash
$ rollup src/main.js -o dist/bundle.js -f cjs
```

dist/bundle.js：
```javascript
'use strict';

var foo = 'hello world!';

function main () {
    console.log(foo);
}

module.exports = main;
```

### 命令行太长手敲太烦？使用配置文件！

在项目根目录下新建 rollup.config.js
```javascript
// rollup.config.js
export default {
    input: 'src/main.js',
    output: {
        file: 'dist/bundle.js',
        format: 'cjs'
    }
};
```

现在只需要输入以下命令即可达到以上效果
```bash
$ rollup -c
```

### 结合 npm 使用 rollup

初始化 package.json
```bash
$ npm init
```

不全局安装，避免全局安装版本不统一，npx 使用 rollup
```bash
$ npm i rollup -D

$ npx rollup -c
```

// 在package.json 中添加
```json
{
    ...
    "scripts": {
        ...
        "build": "rollup --config"
    }
}
```

```bash
$ npm run build
```

### 常见插件使用

- 需要解析json文件？

src/main.js 修改如下
```javascript
// src/main.js
import { version } from '../package.json';

export default function () {
    console.log('version ' + version);
}
```

解析 json 文件需要引入 rollup-plugin-json 包

```bash
$ npm i rollup-plugin-json -D
```

rollup.config.js 修改如下
```javascript
// rollup.config.js
import json from 'rollup-plugin-json';

export default {
    input: 'src/main.js',
    output: {
        file: './dist/bundle.js',
        format: 'cjs'
    },
    plugins: [ json() ]
};
```

最终打包dist/bundle.js，多余的无用json字段被祛除了
```javascript
'use strict';

var version = "1.0.0";

// src/main.js

function main () {
    console.log('version ' + version);
}

module.exports = main;
```

- 需要引入CommonJS规范包？

修改 src/main.js 如下

```javascript
// src/main.js
import { version } from '../package.json';
import answer from 'the-answer';

export default function () {
    console.log('the answer is ' + answer);
    console.log('version ' + version);
}
```

安装依赖测试包 the-answer

```bash
$ npm i the-answer
```

最终打包结果，the-answer 没有打进bundle.js，在node环境可用。

```javascript
'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var answer = _interopDefault(require('the-answer'));

var version = "1.0.0";

// src/main.js

function main () {
    console.log('the answer is ' + answer);
    console.log('version ' + version);
}
```

命令行窗口出现警告

```bash
(!) Unresolved dependencies
https://rollupjs.org/guide/en/#warning-treating-module-as-external-dependency
the-answer (imported by src/main.js)
```

CommonJS包需要 rollup-plugin-node-resolve 插件

```bash
$ npm i rollup-plugin-node-resolve -D
```

修改 rollup.config.js

```javascript
// rollup.config.js
import json from 'rollup-plugin-json';
import resolve from 'rollup-plugin-node-resolve';

export default {
    input: 'src/main.js',
    output: {
        file: './dist/bundle.js',
        format: 'cjs'
    },
    plugins: [
        json(),
        resolve(),
    ]
};
```

打包结果，发现 the-answer 被打进去了

```javascript
'use strict';

var version = "1.0.0";

var index = 42;

// src/main.js

function main () {
    console.log('the answer is ' + index);
    console.log('version ' + version);
}

module.exports = main;
```

- 需要使用最新JS语法，babel 转码？

安装 rollup-plugin-babel

```bash
$ npm i -D rollup-plugin-babel rollup-plugin-node-resolve
```

rollup.config.js 修改如下

```javascript
import babel from 'rollup-plugin-babel';

export default {
    input: 'src/main.js',
    output: {
        file: './dist/bundle.js',
        format: 'cjs'
    },
    plugins: [
        resolve(),
        babel({
            exclude: 'node_modules/**' // only transpile our source code
        })
    ]
};
```

新建babel配置文件 src/.babelrc

```json
{
    "presets": [
        ["@babel/env", {"modules": false}]
    ]
}
```

	// "modules": false 避免在rollup处理之前，被babel转成CommonJS格式

安装babel核心包：`@babel/core` ，`@babel/preset-env`

```bash
$ npm i -D @babel/core @babel/preset-env
```

在 src/main.js 中使用 ES6 的箭头函数

```javascript
// src/main.js
import answer from 'the-answer';

export default () => {
    console.log(`the answer is ${answer}`);
}
```

打包结果

```javascript
'use strict';

var index = 42;

// src/main.js
var main = (function () {
    console.log("the answer is ".concat(index));
});

module.exports = main;
```

- 需要压缩代码？

安装 rollup-plugin-uglify

```bash
$ npm i -D rollup-plugin-uglify
```

修改 rollup.config.js 如下

```javascript
// rollup.config.js
import resolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import { uglify } from "rollup-plugin-uglify";

export default {
    input: 'src/main.js',
    output: {
        file: './dist/bundle.js',
        format: 'cjs'
    },
    plugins: [
        resolve(),
        babel({
            exclude: 'node_modules/**' // only transpile our source code
        }),
        uglify()
    ]
};
```
- 需要 sourcemap ？

rollup 内置支持，但默认关闭

```javascript
// rollup.config.js
import resolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import { uglify } from "rollup-plugin-uglify";

export default {
    input: 'src/main.js',
    output: {
        file: './dist/bundle.js',
        format: 'cjs',
        sourcemap: true, // 开启 sourcemap
    },
    plugins: [
        resolve(),
        babel({
            exclude: 'node_modules/**' // only transpile our source code
        }),
        uglify()
    ]
};
```

- 根据不同文件生成不同包 ？

例如根据主入口文件 src/index.js 生成 UMD、ESM 规范的包文件

```javascript
import babel from 'rollup-plugin-babel';
import { uglify } from "rollup-plugin-uglify";
import { terser } from "rollup-plugin-terser";

export default [{
  input: 'src/index.js',
  output: {
    file: 'dist/traceKit.es.js',
    format: 'esm'
  }
}, {
  input: 'src/index.js',
  output: {
    file: 'dist/traceKit.es.min.js',
    format: 'esm',
    sourcemap: true
  },
  plugins: [
    terser(),
  ]
}, {
  input: 'src/index.js',
  output: {
    file: 'dist/traceKit.js',
    name: 'TraceKit',
    format: 'umd'
  },
  plugins: [
    babel(),
  ]
}, {
  input: 'src/index.js',
  output: {
    file: 'dist/traceKit.min.js',
    name: 'TraceKit',
    format: 'umd',
    sourcemap: true,
    // sourcemapFile: 'traceKit.min.js.map',
  },
  plugins: [
    babel(),
    uglify(),
  ]
}]

```

注意： uglify 不支持 es6，用 rollup-plugin-terser

[官方推荐插件](https://github.com/rollup/awesome)

建议最好都打个ESM包并在 `package.json` 指明，如 Vue。
这样做的好处是便于webpack、rollup 利用最新特性 `Tree-Shaking` 静态解析代码，让你的包更小。
也让大家能更好的向es6+规范过渡。

```json
{
    ...
    "module": "dist/vue.runtime.esm.js",
    ...
}
```

更多特性请移步[官方文档](https://rollupjs.org/guide/en/)

- 不局限于类库，打包你的 app 应用
- 实时监听代码更新打包
- 代码分片
- 根据不同环境配置
- ...