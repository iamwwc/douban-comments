const cheerio = require('cheerio')
const { promises: fs } = require('fs')
const axios = require('axios').default.create({
    proxy: false,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36',
        'Referer': 'https://book.douban.com/subject/1322455/comments/hot?p=3',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Encoding': 'gzip, deflate, br',
        'Host': 'book.douban.com',
        'X-Requested-With': 'XMLHttpRequest'
    }
})

async function getLine() {
    var rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });

    var continuation;
    var getline = (() => {
        var thenable = {
            then: resolve => {
                continuation = resolve;
            }
        };
        return () => thenable;
    })();

    rl.on('line', line => continuation(line))

    rl.on('close', function () {
        console.debug('console close')
    })
    return await getline()
}

function findNumFromString(s) {
    return s.match(/\d+/g)
}

async function getCommentsCounts(path) {
    let axios = require('axios').default.create({
        proxy: false,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Encoding': 'gzip, deflate, br',
    })

    let res = await axios.get(path)
    let $ = cheerio.load(res.data)
    let html = $("#total-comments")[0].children[0].data
    let count = findNumFromString(html)[0]
    count = Number.parseInt(count)
    if (!Number.isInteger(count)) {
        throw `Count is ${count}, Is not a number`
    }
    return count
}



async function goToReq(target, path) {
    //get total
    let count = await getCommentsCounts(target)
    let loopCount = (count - (count % 20)) / 20 + 1
    if (typeof maxLoopCount !== 'undefined') {
        loopCount = maxLoopCount
    }

    let workers = []
    for (let i = 1; i <= loopCount; ++i) {
        workers.push(new Worker(axios, `${target}?p=${i}`))
    }

    let promises = workers.map(async worker => {
        return await worker.do()
    })

    let allComments = await Promise.all(promises)
    allComments = [].concat(... allComments);
    await fs.writeFile(path, JSON.stringify(allComments))
    console.log(`done: view json file in ${path}`)
}


class Worker {
    constructor(axios, target) {
        this.axios = axios
        this.target = target
    }

    async do() {
        let { data: { content } } = await axios.get(this.target)
        return this.getAllList(content)
    }

    getAllList(content) {
        let $ = cheerio.load(content,{
            decodeEntities: false
        })
        return $("#comments .comment-item .comment").map((index, comment) => {
            let user = {}
            user.name = $(comment).find("h3 .comment-info a").html()
            user.comment = $(comment).find(".comment-content span").html()
            return user
        }).get()
    }
}

; (async () => {
    for (; ;) {
        console.log('Input URL')
        let target = await getLine()
        let defaultPath = "D:\\doubancomments.json"
        console.log(`Input store path(default ${defaultPath})`)
        let path = await getLine()
        if(!path){
            path = defaultPath
        }
        await goToReq(target, path)
    }
})();
