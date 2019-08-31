let http = require('http');
let url = require('url');
let path = require('path');
let fs = require('fs');
let mime = require('mime');// 非 node 内核包，需 npm install
let crypto = require('crypto');

// 缓存策略
const strategy = {
    'nothing': (req, res, filePath) => {
        fs.createReadStream(filePath).pipe(res);
    },
    'no-store': (req, res, filePath, stat) => {
        // 禁止缓存
        // res.setHeader('Cache-Control', 'no-store');
        // res.setHeader('Cache-Control', ['no-cache', 'no-store', 'must-revalidate']);
        // res.setHeader('Expires', new Date(Date.now() + 30 * 1000).toUTCString());
        res.setHeader('Last-Modified', stat.ctime.toGMTString());

        fs.createReadStream(filePath).pipe(res);
    },
    'no-cache': (req, res, filePath, stat) => {
        // 强制确认缓存
        res.setHeader('Cache-Control', 'no-cache');
        // fs.createReadStream(filePath).pipe(res);
    },
    'cache': (req, res, filePath, stat) => {
        let ifNoneMatch = req.headers['if-none-match'];
        let ifModifiedSince = req.headers['if-modified-since'];
        let LastModified = stat.ctime.toGMTString();

        new Promise((resolve, reject) => {
            let out = fs.createReadStream(filePath);
            let md5 = crypto.createHash('md5');
            out.on('data', function (data) {
                md5.update(data)
            });
            out.on('end', function () {
                let etag = md5.digest('hex');
                // md5算法的特点 1. 相同的输入相同的输出 2.不同的输入不通的输出 3.不能根据输出反推输入 4.任意的输入长度输出长度是相同的
                resolve(etag);
            });
        }).then( etag => {
            if ( ifNoneMatch ) {
                // 一、显然当我们的文件非常大的时候通过下面的方法就行不通来，这时候我们可以用流来解决,可以节约内存
                if (ifNoneMatch == etag) {
                    res.writeHead('304');
                    res.end();
                } else {
                    // 第一次服务器返回的时候，会把文件的内容算出来一个标示发送给客户端
                    //客户端看到 etag 之后，也会把此标识符保存在客户端，下次再访问服务器的时候，发给服务器
                    res.setHeader('Etag', etag);
                    fs.createReadStream(filePath).pipe(res);
                }
    
                // 二、再次请求的时候会问服务器自从上次修改之后有没有改过
                // fs.readFile(filePath,function (err, content) {
                //     let etag = crypto.createHash('md5').update(content).digest('hex');
                //     // md5算法的特点 1. 相同的输入相同的输出 2.不同的输入不通的输出 3.不能根据输出反推输入 4.任意的输入长度输出长度是相同的
                //     if (ifNoneMatch == etag) {
                //         res.writeHead('304');
                //         res.end('')
                //     } else {
                //         return send(req,res,filePath,stat, etag)
                //     }
                // };
                // 但是上面的一方案也不是太好，读一点缓存一点，文件非常大的话需要好长时间，而且我们的 node 不适合 cup 密集型，即不适合来做大量的运算，所以说还有好多其他的算法
                // 三、通过文件的修改时间减去文件的大小
                // let etag = `${stat.ctime}-${stat.size}`; // 这个也不是太好
                // if (ifNoneMatch == etag) {
                //     res.writeHead('304');
                //     res.end('')
                // } else {
                //     return send(req,res,filePath,stat, etag)
                // }
            }
            else if ( ifModifiedSince ) {
                if (ifModifiedSince == LastModified) {
                    res.writeHead('304');
                    res.end();
                } else {
                    // 发给客户端之后，客户端会把此时间保存下来，下次再获取此资源的时候会把这个时间再发给服务器
                    res.setHeader('Last-Modified', stat.ctime.toGMTString());
                    fs.createReadStream(filePath).pipe(res);
                }
            }
            else {
                res.setHeader('Etag', etag);
                // res.setHeader('Last-Modified', stat.ctime.toGMTString());

                fs.createReadStream(filePath).pipe(res);
            }
        });
    }

};

http.createServer((req, res) => {
    let { pathname } = url.parse(req.url, true);
    let filePath = path.join(__dirname, pathname);
    console.log(filePath);
    fs.stat(filePath, (err, stat) => {
        if (err) {
            res.setHeader('Content-Type', 'text/html');
            res.setHeader('404', 'Not Found');
            res.end('404 Not Found');
        } else {
            res.setHeader('Content-Type', mime.getType(filePath));


            // strategy['no-cache'](req, res, filePath, stat);
            // strategy['no-store'](req, res, filePath, stat);
            // strategy['cache'](req, res, filePath, stat);
            strategy['nothing'](req, res, filePath, stat);
        }
    });
})
.on('clientError', (err, socket) => {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
})
.listen(8080);
