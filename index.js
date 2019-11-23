require('dotenv').config()
const Telegraf = require('telegraf')
const MongoClient = require('mongodb');
const { BOT_TOKEN } = process.env

const Telegram = require('telegraf/telegram')

const bot = new Telegraf(BOT_TOKEN/*, { telegram: { agent } }*/)
const telegram = new Telegram(BOT_TOKEN)
const Extra = require('telegraf/extra')
const Markup = require('telegraf/markup')

const request = require('request-promise')
const uri = `https://api.wit.ai/speech`
const apikey = 'NEPKUZYUIUQHC5NAWQON5TA4TYOYERUH' // получаем ключ доступа на wit.ai
const cfg = require('./lib/config');
const {ObjectId} = require('mongodb');
const moment = require('moment')

const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const app_port = 80;

app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());
app.engine('html', require('ejs').renderFile);
app.use(express.static('views'));


app.listen(app_port, '0.0.0.0', function () {
    console.log("Web server started on port " + app_port);
});

bot.launch({
  webhook: {
    domain: 'https://419a155d.ngrok.io',
    port: 3000
  }
})

console.log(cfg.params.mongoURL)

const startApp = async () => {
    const client = await MongoClient.connect(cfg.params.mongoURL, cfg.params.mongoOpts)
    const db = client.db('assistant')
    app.locals.db = db;
    console.log(BOT_TOKEN)
    console.log(db.s.namespace)

    bot.start( async ( ctx ) => {
        console.log(ctx.from)
        let user = await db.collection('users').find({id: ctx.from.id}).toArray()
        if(!user.length){
            ctx.from.date = new Date()
            ctx.from.premium = false
            ctx.from.owner = []
            ctx.from.registered = false
            ctx.from.state = null
            ctx.from.importance = null
            user = await db.collection('users').insertOne(ctx.from)
        }
        ctx.session.user = ctx.from
        return ctx.reply('Добро пожаловать, для дальнейшей работы укажите свой номер телефона', Markup
          .keyboard([
            ['Указать номер телефона'],
          ])
          .oneTime()
          .resize()
          .extra()
        )
    })
    
    bot.on('message', async (ctx) => {
        let user = await db.collection('users').find({id: ctx.from.id}).toArray()
        if(!user.length){
            ctx.reply('Пожалуйста, сперва выполните команду /start')
            return
        }else{
            user = user[0]
        }
        if(user.isBot) return
        if(!user.registered){
            if(ctx.message.text.match(/\(?([0-9]{3})\)?([ .-]?)([0-9]{3})\2([0-9]{4})/)){
                user = await db.collection('users').updateOne({id:user.id},{
                    $set:{
                        phone: ctx.message.text,
                        registered: true
                    }
                })
                ctx.reply('Данные успешно обновлены, можете добавлять новые задачи: просто вводите текст или отправляйте голосовые сообщения')
            }else{
                ctx.reply('Неверный формат ввода телефона')
            }
        }else{
            switch(ctx.message.text) {
                case 'Добавить задачу':
                    user.state = 'addTask'
                    await db.collection('users').updateOne({id:user.id},{$set:{state:user.state}})
                    ctx.reply('Напишите или проговорите задачу голосом')
                    return
                    break
                case 'Мои задачи':
                    user.state = null
                    await db.collection('users').updateOne({id:user.id},{$set:{state:user.state}})
                    const tasks = await db.collection('tasks').find({ownerId: user.id}).toArray()
                    if(!tasks.length){
                        ctx.reply('У вас не найдено активных задач')
                        return
                    }else{
                        for(item of tasks){
                            const worker = await db.collection('users').find({id: item.workerId}).toArray()
                            await ctx.replyWithHTML(
`Текст задачи:
<pre>${item.text}</pre>
Дата регистрации: ${moment(item.dateStart).format('DD.MM.YYYY hh:MM')}
Дата исполнения: ${item.dueDate ? item.dueDate : 'не определена'}
Статус: ${item.status ? item.status : 'не определён'}
Исполнитель: ${worker[0] ? worker[0].first_name : ''} ${worker[0] ? worker[0].last_name : ''} ${worker[0] ? worker[0].phone : ''}`                               ,
                                Markup.inlineKeyboard([
                                    Markup.callbackButton('Удалить', JSON.stringify({
                                        act: "delete",
                                        type: "tasks",
                                        id: item._id
                                    })),
                                    ]).extra()
                            )
                        }
                        ctx.reply(`Всего задач ${tasks.length}`)
                        return
                    } 
                    break   
                case 'Мои сотрудники':
                    user.state = null
                    await db.collection('users').updateOne({ id: user.id }, { $set: { state: user.state } })
                    const users = await db.collection('users').find({owner: user.id}).toArray()
                    if(!users.length){
                        ctx.reply('У вас не найдено ни одного сотрудника')
                        return
                    }else{
                        for(item of users){
                            await ctx.replyWithHTML(
`${item.first_name} ${item.last_name}
 ${item.phone}`,
                                Markup.inlineKeyboard([
                                Markup.callbackButton('Удалить', JSON.stringify({
                                    act: "delete",
                                    type: "users",
                                    id: user.id
                                })),
                                ]).extra()
                            )
                        }
                        ctx.reply(`Всего сотрудников ${users.length}`)
                        return
                    } 
                    break     
                case 'Добавить сотрудника':
                    user.state = 'addWorker'
                    await db.collection('users').updateOne({ id: user.id }, { $set: { state: user.state } })
                    ctx.reply('Введите номер телефона сотрудника')
                    return
                    break                                                      
                default:
                    console.log()
                    break
            }

            switch(user.state) {
                case 'addTask':  
                    await db.collection('tasks').insertOne({
                        dateStart: new Date(),
                        dueDate: null,
                        workerId: null,
                        ownerId: user.id,
                        dateStop: null,
                        text: ctx.message.text,
                        comments: [],
                        status: null,
                    })
                    user.state = null
                    await db.collection('users').updateOne({id:user.id},{$set:{state:user.state}})
                    mainKeyboard('Задача успешно добавлена',ctx)
                case 'addWorker':
                    if(!ctx.message.text.match(/\(?([0-9]{3})\)?([ .-]?)([0-9]{3})\2([0-9]{4})/)){
                        ctx.reply('Неверный формат ввода телефона')
                        return
                    }
                    userToAdd = await db.collection('users').find({phone: ctx.message.text}).toArray()
                    if(!userToAdd.length){
                        ctx.reply('Пользователь не найден')
                        return
                    }
                    let owner = user.owner
                    owner.push(userToAdd[0].id)
                    user.state = null
                    await db.collection('users').updateOne({ id: user.id }, { 
                        $set: {
                            owner: owner,
                            state: user.state 
                        } 
                    })
                    mainKeyboard('Сотрудник успешно добавлен', ctx)                   
                default:
                    mainKeyboard('Выберите необходимое действие',ctx)                            
            }
        }
    })
    
    bot.on('callback_query', (ctx) => {
        data = JSON.parse(ctx.callbackQuery.data)
        switch(data.act) {
            case 'delete':
                telegram.deleteMessage(ctx.callbackQuery.message.chat.id, ctx.callbackQuery.message.message_id)
                break
        }
        switch(data.type) {
            case 'users':
                db.collection('users').updateOne({owner: data.id},{
                    $pull: {owner: data.id}
                })     
                break
            case 'tasks':
                db.collection('tasks').remove({_id: ObjectId(data.id)})
                break               
        }
        
        console.log(ctx.callbackQuery)
        // Explicit usage
        //ctx.telegram.answerCbQuery(ctx.callbackQuery.id)
      
        // Using context shortcut
        //ctx.answerCbQuery()
      })

}

function mainKeyboard(msg,ctx){
    return ctx.reply(msg, Markup
        .keyboard([
        ['Мои сотрудники','Добавить сотрудника'],
        ['Мои задачи','Добавить задачу'],
        ])
        .oneTime()
        .resize()
        .extra()
    )
}

startApp()

app.get('/*',function(req,res){
	res.render('index.html');
});

app.post('/', async (req,res) => {
    console.log(req.body.id)
    const db = req.app.locals.db;
    if(req.body.act==='getTasks'){
        const tasks = await db.collection('tasks').find({ownerId: +req.body.id}).toArray()
        console.log(tasks)
        res.end(JSON.stringify(tasks))
    }else if(req.body.act==='getUsers'){
        const tasks = await db.collection('users').find({owner: +req.body.id}).toArray()
        console.log(tasks)
        res.end(JSON.stringify(tasks))
    }else if(req.body.act==='setTask'){
        const updTask = await db.collection('tasks').updateOne({_id: ObjectId(req.body.id)},{
            $set:{
                startAlarm: req.body.startAlarm,
                stopAlarm: req.body.stopAlarm,
                worker: req.body.worker,
                importance: req.body.importance,
            }
        })
        if(updTask.result.ok){
            telegram.sendMessage(req.body.worker, 'Вам назначена новая задача')
        }
        res.end(JSON.stringify({status:true}))
    }     
})


//telegram.sendMessage(385527955, 'asdasdasd')

// var witaiSpeech = require('witai-speech');
// const witai = new witaiSpeech.ASR({token: apikey});

// witai.recognize('./file.oga').then(res => {
//   console.log('res.status', res.status)
//   return res.json();
// }).then((result) => {
//   console.log('result json', result);
// });

// bot.on('message', async (ctx) => {
    
//     if(ctx.message.voice){
//         fileId = ctx.message.voice.file_id
//         const audio = await telegram.getFileLink(fileId)
//         console.log(audio)
//         const response = await request.post({
//             uri,
//             headers: {
//               'Accept': 'audio/x-mpeg-3',
//               'Authorization': `Bearer ` + apikey,
//               'Content-Type': 'audio/mpeg3',
//               'Transfer-Encoding': 'chunked'
//             },
//             body:audio
//           })
//           console.log(JSON.parse(response)._text)
//     }else{
//         //ctx.reply(ctx.from)
//     }

// })



