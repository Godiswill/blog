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
        res.setHeader('Cache-Control', 'no-store');
        // res.setHeader('Cache-Control', ['no-cache', 'no-store', 'must-revalidate']);
        // res.setHeader('Expires', new Date(Date.now() + 30 * 1000).toUTCString());
        // res.setHeader('Last-Modified', stat.ctime.toGMTString());

        fs.createReadStream(filePath).pipe(res);
    },
    'no-cache': (req, res, filePath, stat) => {
        // 强制确认缓存
        // res.setHeader('Cache-Control', 'no-cache');
        strategy['cache'](req, res, filePath, stat, true);
        // fs.createReadStream(filePath).pipe(res);
    },
    'cache': async (req, res, filePath, stat, revalidate) => {
        let ifNoneMatch = req.headers['if-none-match'];
        let ifModifiedSince = req.headers['if-modified-since'];
        let LastModified = stat.ctime.toGMTString();
        let maxAge = 30;

        let etag = await new Promise((resolve, reject) => {
            // 生成文件 hash
            let out = fs.createReadStream(filePath);
            let md5 = crypto.createHash('md5');
            out.on('data', function (data) {
                md5.update(data)
            });
            out.on('end', function () {
                resolve( md5.digest('hex') );
            });
        });
        console.log(etag);
        if (ifNoneMatch) {
            if (ifNoneMatch == etag) {
                console.log('304');
                // res.setHeader('Cache-Control', 'max-age=' + maxAge);
                // res.setHeader('Age', 0);
                res.writeHead('304');
                res.end();
            } else {
                // 设置缓存寿命
                res.setHeader('Cache-Control', 'max-age=' + maxAge);
                res.setHeader('Etag', etag);
                fs.createReadStream(filePath).pipe(res);
            }
        }
        /*else if ( ifModifiedSince ) {
            if (ifModifiedSince == LastModified) {
                res.writeHead('304');
                res.end();
            } else {
                res.setHeader('Last-Modified', stat.ctime.toGMTString());
                fs.createReadStream(filePath).pipe(res);
            }
        }*/
        else {
            // 设置缓存寿命
            // console.log('首次响应！');
            res.setHeader('Cache-Control', 'max-age=' + maxAge);
            res.setHeader('Etag', etag);
            // res.setHeader('Last-Modified', stat.ctime.toGMTString());

            revalidate && res.setHeader('Cache-Control', [
                'max-age=' + maxAge,
                'no-cache'
            ]);
            fs.createReadStream(filePath).pipe(res);
        }
    }

};

http.createServer((req, res) => {
    console.log( new Date().toLocaleTimeString() + '：收到请求')
    let { pathname } = url.parse(req.url, true);
    let filePath = path.join(__dirname, pathname);
    // console.log(filePath);
    fs.stat(filePath, (err, stat) => {
        if (err) {
            res.setHeader('Content-Type', 'text/html');
            res.setHeader('404', 'Not Found');
            res.end('404 Not Found');
        } else {
            res.setHeader('Content-Type', mime.getType(filePath));

            // strategy['no-cache'](req, res, filePath, stat);
            // strategy['no-store'](req, res, filePath, stat);
            strategy['cache'](req, res, filePath, stat);
            // strategy['nothing'](req, res, filePath, stat);
        }
    });
})
.on('clientError', (err, socket) => {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
})
.listen(8080);
