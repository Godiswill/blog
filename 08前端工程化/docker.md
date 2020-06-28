# docker 部署 node 应用实操
[原文链接](https://github.com/Godiswill/blog/issues/26)

## 背景
最近在捯饬一个前端性能上报分析的项目，前端由 `react` 全家桶，打包部署公司有专门的发布系统，这块就没什么顾虑。

前端团队的后端没有什么规范或通用流程，就想自己先技术选型从0到1，决定使用 `egg + mongodb`，后续也许会追加 `nginx + redis + Kafka` 相关配置。

- 问题来了：怎么简化部署配置流程？
- 答： `docker` ！

## 目标
总体目标不外乎几点：简单、快速、安全。
- 简单
1. 一次配置，不同环境均可执行，这也是 `docker` 的优势。
1. 部署简单，可能就几行甚至一行命令行，方便接入 `CI`。
1. 本地开发方便。
- 快速
1. 开发编译热重载要快。
1. 镜像包、部署包等要小，上传下载部署才会快。
1. 快速回滚。
- 安全
1. 源码无泄漏风险。
1. MongoDB 开启安全验证。

## 行动
PS：搜索搜的头秃，以下很多关键知识点收集自 google + github issue + Stack Overflow + docker 官方文档 + 英文博客。英文有障碍真是影响效率。

接下来说说实践中遇到的问题。
### 无 docker
步骤：
1. 下载 node、mongodb等。
1. 配置 node、mongodb等。
1. 启动 egg 开发。

换台电脑或协同其他小伙伴开发时，得把你的动作重复一遍。不同的操作系统和下的不同 node 或 db 版本，都有可能导致系统运行不起来。

你肯定听过这句话：我的电脑上是好的啊。

### 初探 docker
约束不了团队众多软件的安装和版本的控制，要求安装一定范围的 `docker` 还是简单的吧。

例如启动 mongodb 服务
```bash
docker run -p 27017:27017 -v <LocalDirectoryPath>:/data/db --name docker_mongodb -d mongo:4.2.6
```

这里我们启动了一个 mongo 最新稳定版本的 docker 容器。简单说明下：
- `run` 运行镜像，本地没有会自动拉取。
- `-p` 端口映射，本地 27017 映射容器 27017 端口，就可以通过访问本地端口而访问 docker mongo 的服务了。
- `-v` 本地`<LocalDirectoryPath>`映射容器目录`/data/db`，用来持久化数据库，不然容器删除数据也丢失了。
- `--name` 给容器取个名字，匿名容器可以通过 `docker container prune` 删除。
- `-d` 后台运行
- `mongo:4.2.6` docker hub官方镜像:版本

接下来本地启动跟无 docker 效果是一样的。

### egg 镜像化
编写 `Dockerfile` 文件
```bash
# 基于的基础镜像
FROM node:12.16.3

# 踩坑1：注意目录使用前，保证存在
RUN mkdir -p /usr/src/egg

# 注意不要用 cd，需要了解 docker 分层构建的概念，需要改变上下文的 pwd，使用 WORKDIR
WORKDIR /usr/src/egg

# 复制 Dockerfile 同级内容到容器的 /usr/src/egg 目录下
COPY . .

# 安装 npm 包
RUN npm install

# 暴露端口，这里只是声明便于理解维护，实际映射使用需要 -p xxx:7001
EXPOSE 7001

# 启动容器后默认执行的命令行
CMD [ "npm", "run", "start" ]
```

编写 `.dockerignore` 文件
```
node_modules
npm-debug.log
.idea
```
忽略 `node_modules`：
1. 构建时会把目录内容发送给 docker 进程，减少 I/O。
1. 本地操作系统和版本安装的 npm 包未必适合 docker 环境运行，避免冲突。

- 构建
```bash
docker build -t node:egg .
```
- 查看 image
```bash
docker images
```
```
REPOSITORY  TAG  IMAGE ID      CREATED         SIZE
node        egg  ae65b8012120  28 seconds ago  1.12GB
```
- 运行
```bash
docker run -p 7001:7001 -d node:egg
```
- 查看运行容器
```bash
docker ps # 查看运行容器，获取CONTAINER ID，-a 可以查看所有包括停止的容器
```
- 查看容器 log
```bash
docker logs b0d0c3df5eed
```
- 进入容器
```bash
docker exec -it b0d0c3df5eed bash
du -a -d 1 -h # 查看容器目录文件大小
```

踩坑2：在 docker 中运行记得把 `package.json` 中的 `egg-scripts start --daemon` 中的 `--daemon` 删掉。
需要理解前台、后台运行进程的概念，docker 中的 shell 脚本必须以前台方式运行。

### 优化镜像大小
上文看到，可能源代码就几百K，镜像包却超过1G。看看能有哪些优化手段。

- 基础镜像下手

也许你并不需要 docker node 提供完整的例如 bash、git 等工具。只需要基本的 node 运行环境即可，则可以使用 `alpine` 镜像。
```diff
- FROM node:12.16.3
+ FROM node:12.16.3-alpine
```

- npm 包优化
```diff
- RUN npm install
+ # 无关运行的开发依赖包都该归属 devDependencies
+ RUN npm install --production
```

- 打包
```bash
docker build -t node:simplfy .
```

- 效果
```
REPOSITORY  TAG      IMAGE ID      CREATED         SIZE
node        simplfy  8ccafec91d90  28 seconds ago  132MB
```

镜像包从 `1.12G` 降到了 `132MB`，`node_modules` 从 `214MB` 降到了 `44.5M`。

踩坑3：`alpine` 镜像容器不支持 `bash`。

你如果需要 `bash、git` 可以这么做 [issue](https://github.com/nodejs/docker-node/issues/586)
```bash
RUN apk update && apk upgrade && \
    apk add --no-cache bash git openssh
```

或不想臃肿你的镜像 [issue](https://github.com/smebberson/docker-alpine/issues/43)，其实你可以使用 `sh` 
```bash
docker exec -it container_id sh
```

### 你真的需要 egg 镜像吗？
在无 docker 本地开发时，你可以使用 `egg-mongoose` 这样连接数据库
```javascript
`mongodb://127.0.0.1/your-database`
```

使用 docker 后，容器的 `127.0.0.1` 或 `localhost` 与你本地的环境是不通的。

有两种方式连接 docker mongo：
1. 使用可访问的真实IP地址，例如：`mongodb://192.1.2.3/your-database`
1. [docker networks](https://docs.docker.com/network/bridge/) 容器间的的通信。

例如在 `Dockerfile` 中设置真实IP
```
# 设置数据库IP
ENV docker_db=192.1.2.3
```
连接 url
```javascript
`mongodb://${process.env.docker_db}/your-database`
```

对于每一个开发都得不停更换网络IP，对开发不友好。

思考：
1. 如何自动区分本地与 docker 起的环境？
1. 如何隔离本地与 docker 例如 `node_modules` 冲突？
1. 如何既能享受本地环境和工具带来的开发效率，又能快速切入 docker 查看部署效果。

镜像包还面临一个存储问题，不小心发到开源 docker hub 仓库，可能导致源码泄漏。

自建仓库？

大多数教程一上来，必然或大篇章都是 `Dockerfile` 构建镜像。介于以上种种，能不能换种思路，放弃构建 image。

### docker-compose
`docker-compose` 用来编排多容器的启动部署。
#### mongo 配置
- 新建 `docker-compose.yml` 文件。
```yaml
version: "3"

services:
  db:
    image: mongo:4.2.6 # 镜像:版本
    environment:
      - MONGO_INITDB_ROOT_USERNAME=super # 默认开启授权，并创建超管用户 mongo -u godis -p godis@admin --authenticationDatabase admin
      - MONGO_INITDB_ROOT_PASSWORD=xxx # 超管密码，敏感数据也可以使用 `secrets`，不赘述。
      - MONGO_INITDB_DATABASE=admin # *.js 中默认的数据库
    volumes:
      - ./init-mongo.js:/docker-entrypoint-initdb.d/init-mongo.js:ro
      - ./mongo-volume:/data/db
    ports:
      - "27017:27017"
    restart: always
```
简单[说明](https://hub.docker.com/_/mongo)：
- `version: "3"`，不是指你的应用配置版本，而是指 docker 支持的版本，[详情说明](https://docs.docker.com/compose/compose-file/)。
- `MONGO_INITDB_ROOT_USERNAME`、`MONGO_INITDB_ROOT_PASSWORD` 环境变量用来开启授权，docker 自动创建一个数据库超管角色。
- docker mongo 启动容器时会执行 `/docker-entrypoint-initdb.d/` 中的 `*.js` 脚本，例如这里 `init-mongo.js` 来初始化数据库角色。
- `MONGO_INITDB_DATABASE` 数据库就是 `*.js` 中默认的 `db` 对象，这里指向 `admin`。
- `./mongo-volume:/data/db` 映射目录或卷，持久化数据库文件。

- init-mongo.js
```javascript
// https://stackoverflow.com/questions/42912755/how-to-create-a-db-for-mongodb-container-on-start-up
// 分别在 user、staff 数据库上创建访问角色。
// 这里 db 是 MONGO_INITDB_DATABASE 指定的数据库
db.getSiblingDB('user')
  .createUser(
    {
      user: 'user',
      pwd: 'xx',
      roles: [ 'readWrite', 'dbAdmin' ],
    }
  );

db.getSiblingDB('staff')
  .createUser(
    {
      user: 'staff',
      pwd: 'yy',
      roles: [ 'readWrite', 'dbAdmin' ],
    }
  );
```

- 密码配置有点散乱，如何跟应用一块儿存取(docker-compose 设置 `secrets` 文件，node 也读取改文件？)，有点麻烦，读者有更好的方案还望不吝赐教。

#### node 配置
```yaml
services:
  ...
	
  server:
    image: node:12.16.3-alpine
    depends_on:
      - db
    volumes:
      - ./:/usr/src/egg
    environment:
      - NODE_ENV=production
      - docker_db=db
    working_dir: /usr/src/egg
    command: /bin/sh -c "npm i && npm run start" # not works: npm i && npm run start and not support bash
    ports:
      - "7001:7001"

volumes:
  nodemodules:
```
说明：
- `depends_on` 表示依赖的容器，docker 会等待依赖项先启动。
- `volumes` 映射本地目录到容器，这样本地修改了也能影响到容器。
- `environment` 可以在 `process.env` 拿到。
- `working_dir` 设置 `pwd`，不像 `Dockerfile`，不存在是会自动创建。
- `command` 启动容器后执行的命令行。

踩坑4：`command: npm i && npm run start` 不支持 `&&`。`alpine` 镜像不支持 `bash`，`egg-bin dev` 会报错 `Error: Cannot find module '/bin/bash'`。

- 注意：docker node 是如何与 docker mongo 通信的？
```yaml
environment:
  ...
  - docker_db=db # db 就是 services 中定义 mongo 的名称
```

```javascript
`mongodb://${process.env.docker_db}/your-database`
```

大部分教程都是用 `links` 来解决，但官方不推荐并准备废弃。[推荐使用 `networks`](https://docs.docker.com/compose/networking/)。这里并没有配置 `networks`。
这是因为 docker 会默认创建名称为 `projectname_default` 的 `networks`，用来 `docker-compose` 容器间的通信。

- 如何隔离本地与 docker node 映射中 `node_modules`?
```diff
services:
  ...
	
  server:
    image: node:12.16.3-alpine
    depends_on:
      - db
    volumes:
+      - nodemodules:/usr/src/egg/node_modules
      - ./:/usr/src/egg
    environment:
      - NODE_ENV=production
      - docker_db=db
    working_dir: /usr/src/egg
    command: /bin/sh -c "npm i && npm run start" # not works: npm i && npm run start and not support bash
    ports:
      - "7001:7001"

+ volumes:
+   nodemodules:
```
- 在 `docker-compose.yml` 文件目录下文件运行 `docker-compose`。
```bash
docker-compose up -d
```

- 为什么不直接使用匿名卷？
```yaml
volumes:
  - :/usr/src/egg/node_modules
  - ./:/usr/src/egg
```

- 答：如果需要多 `docker-compose` 文件来区分环境，例如开发时，没有必要每次启动时执行一次 `npm i`。

创建 `docker-compose.notinstall.yml` 文件
```yaml
version: "3"

services:
  server:
    environment:
      - NODE_ENV=development # 覆盖
      - NEW_ENV=add # 新增
    command: npm run start # 覆盖
```
- 第二次，你可以执行以下命令，减少 `npm i` 带来的消耗。如果你使用匿名卷，则 `node_modules` 每个容器相互独立无法共享，导致报错。
```bash
docker-compose -f docker-compose.yml -f docker-compose.notinstall.yml up -d
```

更多多文件使用，查看文档 [Share Compose configurations between files and projects](https://docs.docker.com/compose/extends)

最后借助 `package.json scripts` 优化记忆命令行。

## 结果
开发部署问题暂时告一段落，项目还在开发当中，线上运行一段时间后再来分享。水平有限，有错误欢迎指出，有更好的建议也欢迎补充。

## 参考
1. [A Better Way to Develop Node.js with Docker](https://hackernoon.com/a-better-way-to-develop-node-js-with-docker-cd29d3a0093)
1. [Dockerizing a Node.js web app](https://nodejs.org/fr/docs/guides/nodejs-docker-webapp/)
1. [docker_practice](https://docker_practice.gitee.io/zh-cn/compose/compose_file.html)
1. [YAML](https://yaml.org/spec/1.2/spec.html#id2765878)
1. [Managing MongoDB on docker with docker-compose](https://medium.com/faun/managing-mongodb-on-docker-with-docker-compose-26bf8a0bbae3)
1. [mongoosejs](https://mongoosejs.com/docs/connections.html)
1. [docker mongo](https://hub.docker.com/_/mongo)
1. [egg-docker-template](https://github.com/Hansuku/egg-docker-template/blob/master/node/app/database/init.js)
1. [只需简单两步，轻松缩减 Node.js 应用的镜像大小](https://yq.aliyun.com/articles/574267)
1. [Cannot pass any ENV variables from docker to Node process.env](https://stackoverflow.com/questions/59389608/cannot-pass-any-env-variables-from-docker-to-node-process-env)
