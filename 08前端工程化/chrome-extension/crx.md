# 热更新：Chrome 插件开发提效
[原文](https://github.com/Godiswill/blog/issues/32)
Chrome Manifest V3 + Webpack5 + React18 热更新提升开发效率。

## 解决的问题
开发 Chrome 插件的同学想必都会遇到一个问题：
每次更新代码需要在 `chrome://extensions` 扩展程序中
1. 找到对应的插件点击刷新按钮 
1. 重新点击唤起插件查看效果
   
特别的繁琐，严重影响开发效率。

![reload](https://raw.githubusercontent.com/Godiswill/blog/08%E5%89%8D%E7%AB%AF%E5%B7%A5%E7%A8%8B%E5%8C%96/chrome-extension/01.png)

本文借助 create-react-app reject 后的工程，改造实现：
1. 支持现代 Web 开发一样的体验，React、TS、热更新（react-refresh）等
1. 支持修改 popup 时，实时局部热更新
1. 支持修改 content、background 时，无需手动刷新
1. 支持静态资源 public 目录文件变动自动更新

## 实现过程

```shell
npx create-react-app crx-app --template typescript
```

进入工程目录
```shell
npm run eject
```

### 打包多文件
可能需要输出以下打包文件：
1. main：主入口，create-react-app 项目主文件，可以用来本地网页开发时预览 popup、tab、panel、devtools 等
1. popup、tab、panel、devtools 等输出 html，供 Chrome 插件展示页面
1. content、background 输出 js，用来 Chrome 插件通信


一、 新增 `config/pageConf.js`，开发只需按需配置需要打包的输出的文件，内部自动会处理。
```javascript
module.exports = {
  main: { // 必须需要 main 入口
    entry: 'src/pages/index',
    template: 'public/index.html',
    filename: 'index', // 输出为 index.html，默认主入口
  },
  background: {
    entry: 'src/pages/background/index',
  },
  content: {
    entry: 'src/pages/content/index',
  },
  devtools: {
    entry: 'src/pages/devtools/index',
    template: 'public/index.html',
  },
  newtab: {
    entry: 'src/pages/newtab/index',
    template: 'src/pages/newtab/index.html',
  },
  options: {
    entry: 'src/pages/options/index',
    template: 'src/pages/options/index.html',
  },
  panel: {
    entry: 'src/pages/panel/index',
    template: 'public/index.html',
  },
  popup: {
    entry: 'src/pages/popup/index',
    template: 'public/index.html',
  },
};

```

对应说明
```typescript
type PageConfType = { 
  [key: string]: { // 输出文件名
    entry: string; // webpack.entry 会转化为绝对路径
    template?: string; // 模板 html，存在会被 HtmlWebpackPlugin 处理；没有表示纯 js 不会触发 webapck HMR
    filename?: string; // 输出到 build 中的文件名，默认是 key 的值
  }
}
```

二、修改 `config/paths.js`，处理第一步里的配置路径
```diff
+ /** 改动：多入口配置 */
+ const pages = Object.entries(require('./pageConf'));
+ // production entry
+ const entry = pages.reduce((pre, cur) => {
+   const [name, { entry }] = cur;
+   if(entry) {
+     pre[`${name}`] = resolveModule(resolveApp, entry);
+   }
+   return pre;
+ }, {});
+
+ // HtmlWebpackPlugin 处理 entry
+ const htmlPlugins = pages.reduce((pre, cur) => {
+   const [name, { template, filename }] = cur;
+   template && pre.push({
+     name,
+     filename: filename,
+     template: resolveApp(template),
+   });
+   return pre;
+ }, []);
+ 
+ // 检查必须文件是否存在
+ const requiredFiles = pages.reduce((pre, cur) => {
+   const { entry, template } = cur[1];
+   const entryReal = entry && resolveModule(resolveApp,entry);
+   const templateReal =  template && resolveApp(template);
+   entryReal && !pre.includes(entryReal) && pre.push(entryReal);
+   templateReal && !pre.includes(templateReal) && pre.push(templateReal);
+   return pre;
+ }, []);
```
导出供后续使用

```diff
// config after eject: we're in ./config/
module.exports = {
  ...
+  entry,
+  requiredFiles,
+  htmlPlugins,
};
```
三、修改 `config/webpack.config.js`，配置文件打包输出，固定打包文件名，因为需要在插件 manifest.json 中配置
```diff
- entry: paths.appIndexJs, // 删除默认配置
+ entry: paths.entry, // 换上自定义的 entry
output: {
-  filename: ... // 删除打包输出文件名配置
-  chunkFilename: ...
+  filename: '[name].js', // 固定打包文件名
},

...

plugins: [
  // Generates an `index.html` file with the <script> injected.
-  new HtmlWebpackPlugin(...)
  /** 改动：多页改造 */
+  ...paths.htmlPlugins.map(({ name, template, filename }) => new HtmlWebpackPlugin(
    Object.assign(
      {},
      {
        inject: true,
-        template: paths.appHtml,
+        template: template,
+        filename: `${filename || name}.html`,
+        chunks: [name],
+        cache: false,
      },
      ...
    )
+  )),
  new MiniCssExtractPlugin({
-    filename: 'static/css/[name].[contenthash:8].css',
-    chunkFilename: 'static/css/[name].[contenthash:8].chunk.css',
+    /** 改动：CSS 文件名写死，不需要运行时 CSS */
+    filename: '[name].css',
+    runtime: false,
  }),
]
```
四、修改 `config/webpackDevServer.config.js`，webpack 为了提升开发时效率，默认打包文件存储在内存中。
我们需要把文件打包在硬盘 build 文件夹中，然后在 Chrome 管理扩展程序中加载已解压的 build 目录。
```diff
devMiddleware: {
+  writeToDisk: true,
},
```

### 监听 public 目录
此目录可以放置一些 Chrome 插件需要的配置静态资源，如图标，manifest.json。目录下文件变动时，实时复制到 build 中。

一、修改 scripts/build.js
```diff
// 删除 copy 代码
- copyPublicFolder()
```
二、新增 `yarn add copy-webpack-plugin -D`
三、修改 `config/webpack.config.js`，监听 public 文件改动，复制最新到 build
```diff
plugins: [
+  new CopyPlugin({
+    patterns: [
+      {
+        context: paths.appPublic,
+        from: '**/*',
+        to: path.join(__dirname, '../build'),
+        transform: function (content, path) {
+          if(path.includes('manifest.json')) {
+            return Buffer.from(
+              JSON.stringify({
+                // version: process.env.npm_package_version,
+                // description: process.env.npm_package_description,
+                ...JSON.parse(content.toString()),
+              })
+            );
+          }
+          return content;
+        },
+        // filter: (resourcePath) => {
+        //   console.log(resourcePath);
+        //   return !resourcePath.endsWith('.html');
+        // },
+        globOptions: {
+          dot: true,
+          gitignore: true,
+          ignore: ['**/*.html'], // 过滤 html 文件
+        },
+      },
+    ],
+  }),
]
```

### HRM 热更新配置
由于 Chrome 插件的 CSP 安全问题，不支持例如 content 热更新。
需要修改默认 HRM 配置，手动配置热更新文件，排除 content/background。 

一、修改 `config/webpackDevServer.config.js`
```diff
+ hot: false, 
+ client: false,
- client: ...,
```

二、修改 `scripts/start.js` 中 `checkBrowsers().then` 里的 `entry`
```diff
const config = configFactory('development');
+ /** 改动：手动 HRM，在 crx 中必须带上 hostname、port 否则无法热更新，坑了很久。。。 */
+ const pages = Object.entries(require('../config/pageConf'));
+ pages.forEach((cur) => {
+   const [name, { template }] = cur;
+   const url = config.entry[name];
+   if(url && template) {
+     // https://webpack.js.org/guides/hot-module-replacement/#via-the-nodejs-api
+     config.entry[name] = [
+       'webpack/hot/dev-server.js',
+       `webpack-dev-server/client/index.js?hot=true&live-reload=true&hostname=${HOST}&port=${port}`,
+       url,
+     ];
+   }
+ });
```

三、修改 `config/webpack.config.js`，不允许产生运行时内联代码
```diff
- const shouldInlineRuntimeChunk = process.env.INLINE_RUNTIME_CHUNK !== 'false';

...

plugins: [
  ...
-  isEnvProduction &&
-    shouldInlineRuntimeChunk &&
-    new InlineChunkHtmlPlugin(HtmlWebpackPlugin, [/runtime-.+[.]js/]),
]
```

### CRX content 变更自动加载
- 问题： 
  
上述可知，content 是无法支撑热更新自动加载的，
但 chrome content/background 被修改我们又不希望每次去插件管理界面点击刷新按钮。


- 思路：
1. webpack-dev-sever 提供了 middlewares 中间件能力处理路由请求，创建轻量级 Web 即时通讯技术 SSE(Server Sent Event)
1. webpack-dev-sever 提供了文件变动监听生命周期的钩子 compiler.hooks，监听文件变更、生成
1. webpack-dev-sever 与插件 background 使用 SSE 通信，变更文件后触发插件重新加载
1. 插件 background、content 之间通信，触发 Tab 页 reload

- 解决：

一、修改 `scripts/start.js`，webpack-dev-sever 启动时，新增 `/reload` 请求监听，并新建 SSE
```diff
+ const SSEStream = require('ssestream').default;
+ let sseStream;
const serverConfig = {
  ...createDevServerConfig(proxyConfig, urls.lanUrlForConfig),
  host: HOST,
  port,
+  setupMiddlewares: (middlewares, _devServer) => {
+    if (!_devServer) {
+      throw new Error('webpack-dev-server is not defined');
+    }
+    middlewares.unshift({
+      name: 'handle_content_change',
+      path: '/reload', // 监听路由
+      middleware: (req, res) => {
+        console.log('sse reload');
+        sseStream = new SSEStream(req);
+
+        sseStream.pipe(res);
+        res.on('close', () => {
+          sseStream.unpipe(res);
+        });
+      },
+    });
+
+    return middlewares;
+  }
+};
```
二、在 devServer.startCallback 中新增 hooks 监听 content/background 变化时发送 SSE 消息
```diff
+ let contentOrBackgroundIsChange = false;
+ compiler.hooks.watchRun.tap('WatchRun', (comp) => {
+   if (comp.modifiedFiles) {
+     const changedFiles = Array.from(comp.modifiedFiles, (file) => `\n  ${file}`).join('');
+     console.log('FILES CHANGED:', changedFiles);
+     if(['src/pages/background/', 'src/pages/content/'].some(p => changedFiles.includes(p))) {
+       contentOrBackgroundIsChange = true;
+     }
+   }
+ });
+ 
+ compiler.hooks.done.tap('contentOrBackgroundChangedDone', () => {
+   if(contentOrBackgroundIsChange) {
+     contentOrBackgroundIsChange = false;
+     console.log('--------- 发起 chrome reload 更新 ---------');
+     sseStream?.writeMessage(
+       {
+         event: 'content_changed_reload',
+         data: {
+           action: 'reload extension and refresh current page'
+         }
+       },
+       'utf-8',
+       (err) => {
+         sseStream?.unpipe();
+         if (err) {
+           console.error(err);
+         }
+       },
+     );
+   }
+ });
+ 
+ compiler.hooks.failed.tap('contentOrBackgroundChangeError', () => {
+   contentOrBackgroundIsChange = false;
+ });
```

三、新增 `src/pages/background/index.ts`，监听 SSE，收到文件变更通知，先利用 `chrome.tabs.sendMessage` 给 content 发消息，
刷新当前 Tab 页，然后 `chrome.runtime.reload()` 自动加载插件
```javascript
if (process.env.NODE_ENV === 'development') {
    const eventSource = new EventSource(
        `http://${process.env.REACT_APP__HOST__}:${process.env.REACT_APP__PORT__}/reload/`
    );
    console.log('--- 开始监听更新消息 ---');
    eventSource.addEventListener('content_changed_reload', async ({ data }) => {
        const [tab] = await chrome.tabs.query({
            active: true,
            lastFocusedWindow: true,
        });
        const tabId = tab.id || 0;
        console.log(`tabId is ${tabId}`);
        await chrome.tabs.sendMessage(tabId, {
            type: 'window.location.reload',
        });
        console.log('chrome extension will reload', data);
        chrome.runtime.reload();
    });
}
```

四、新增 `src/pages/content/index.ts`，如果 content 变动且跟当前页 Tab 页有通信，需要刷新当前页。 
同样可以自动化实现，在 content 中监听 background 消息 reload Tab 页。
```javascript
chrome.runtime.onMessage.addListener(
    (
        msg: MessageEventType,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response: string) => void
    ) => {
        console.log('[content.js]. Message received', msg);
        sendResponse('received');
        if (process.env.NODE_ENV === 'development') {
            if (msg.type === 'window.location.reload') {
                console.log('current page will reload.');
                window.location.reload();
            }
        }
    }
);
```

### build zip
懒人自动化最后一步，生产编译后自动 zip 包。

一、新增 `config/scripts/zip.js`
```javascript
const fs = require('fs');
const path = require('path');
const zipFolder = require('zip-folder');

const manifestJson = require('../build/manifest.json');

const SrcFolder = path.join(__dirname, '../build');
const ZipFilePath = path.join(__dirname, '../release');

const makeDestZipDirIfNotExists = () => {
  if (!fs.existsSync(ZipFilePath)) {
    fs.mkdirSync(ZipFilePath);
  }
};

function removeSpace(str, str2) {
  return str?.replace(/\s+/g, str2 || '');
}

const main = () => {
  const { name, version } = manifestJson;
  const zipFilename = path.join(
    ZipFilePath,
    `${removeSpace(name, '_')}-v${removeSpace(version)}.zip`
  );

  makeDestZipDirIfNotExists();

  console.info(`Zipping ${zipFilename}...`);
  zipFolder(SrcFolder, zipFilename, (err) => {
    if (err) {
      return console.err(err);
    }
    console.info('Zip is OK');
  });
};

main();

```
二、修改 package.json
```diff
+ "build": "node scripts/build.js && node scripts/zip.js",
```
 ## 最终效果
![reload](https://raw.githubusercontent.com/Godiswill/blog/08%E5%89%8D%E7%AB%AF%E5%B7%A5%E7%A8%8B%E5%8C%96/chrome-extension/02.png)

太懒了，这里就不搞动态图了，各位看官老爷自行获取代码运行查看效果。

[cra-crx-boilerplate](https://github.com/Godiswill/cra-crx-boilerplate)


