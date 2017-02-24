const bodyParser = require('body-parser');
const express = require('express');
const session = require('express-session');
var moment = require('moment');
const path = require('path');
const db = require('./database');

const app = express();

app.use('/static', express.static(__dirname + '/static'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(session({
    secret: 'pusheen',
    cookie: {}
}));

app.locals.moment = moment;

function auth(req, res, next) {
    if (!req.session.UID) {
        res.redirect('/login');
        return;
    }
    next();
}
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.get('/', auth, function(req, res) {
    db.getGames(req.session.UID)
        .then(function(games) {
            //console.log(games);
            res.render('games', {
                UID: req.session.UID,
                games: games
            });
        });
});
app.get('/login', function(req, res) {
    res.render('login');
});
app.get('/logout', auth, function(req, res) {
    req.session.UID = null;
    res.redirect('/login');
    return;
});
app.get('/e_info/:GID', auth, function(req, res) {
    Promise.all([db.getGameInfo(req.params.GID), db.getScenes(req.params.GID)])
        .then(function(data) {
            //console.log(info);
            res.render('info', {
                GID: req.params.GID,
                isNew: false,
                info: data[0],
                scenes: data[1]
            });
        });
});
app.get('/new_info', auth, function(req, res) {
    res.render('info', {
        GID: null,
        isNew: true,
        info: {}
    });
});
app.get('/scenes/:GID', auth, function(req, res) {
    db.getScenes(req.params.GID)
        .then(function(scenes) {
            for(let i in scenes){
                if(scenes[i].img==null){
                    scenes[i].img = 'http://placehold.it/330x220';
                }
            }
            res.render('scenes', {
                GID: req.params.GID,
                scenes: scenes,
                isNew: false
            });
        });
});
app.get('/new_scene/:GID', auth, function(req, res) {
    res.render('e_scene', {
        GID: req.params.GID,
        scene: {},
        isNew: true
    });
});
app.get('/e_scene/:GID/:SID', auth, function(req, res) {
    db.getEditSceneInfo(req.params.SID)
        .then(function(data) {   
            //console.log(info);
            var scene = {};
            scene.name = data[0].name;
            scene.bgd_img = data[0].img;
            var map = [];
            for(let i in data[2]){
                map.push({
                    coord: data[2][i].coords,
                    name: data[2][i].name,
                    AID: data[2][i].AID
                });
            }
            scene.map = map;
            var imgs = [];
            for(let i in data[1]){
                imgs.push({
                    src: data[1][i].imgurl,
                    x: data[1][i].x,
                    y: data[1][i].y,
                    name: data[1][i].name,
                    AID: data[1][i].AID
                });
            }
            scene.imgs = imgs;
            //console.log(scene);
            res.render('e_scene', {
                GID: req.params.GID,
                SID: req.params.SID,
                isNew: false,
                scene: scene
            });
        });
});

app.post('/login', function(req, res) {
    req.session.UID = req.body.UID;
    if(req.body.stay) req.session.cookie.maxAge = 1000*86400*30;
    res.redirect('/');
});
app.post('/e_info/:GID', auth, function(req, res) {
    //console.log(req.body);
    //console.log(isNaN(parseInt(req.body.initSID)));
    var info = {};
    if(req.body.status==='open') info.is_opened = 1;
    else info.is_opened = 0;
    info.name = req.body.name;
    info.description = req.body.description;
    info.initSID = req.body.initSID;
    db.updateGameInfo(req.params.GID, info)
    .then(function() {
        res.redirect('/');
    });
});
app.post('/new_info/', auth, function(req, res) {
    var info = {};
    if(req.body.status==='open') info.is_opened = 1;
    else info.is_opened = 0;
    info.name = req.body.name;
    info.description = req.body.description;
    db.insertGameInfo(req.session.UID, info)
    .then(function() {
        res.redirect('/');
    });
});
app.post('/e_scene/:GID/:SID', auth, function(req, res) {
    //console.log(req.body);
    var info = wrapSceneInfo(req);
    //console.log(info);
    db.updateEditSceneInfo(req.params.SID, req.params.GID, info)
        .then(function() {
            res.redirect('/scenes/' + req.params.GID);
        });
});
app.post('/new_scene/:GID', auth, function(req, res) {
    var info = wrapSceneInfo(req);
    //console.log(info);
    db.insertEditSceneInfo(req.params.GID, info)
        .then(function() {
            res.redirect('/scenes/' + req.params.GID);
        });
});

function wrapSceneInfo(req){
    var info = {};
    info.name = req.body.name;
    info.bgd_img = req.body.bgd_img;
    info.map = [];
    if(typeof(req.body.coord)==='string' && (req.body.coord!='' || req.body.mapname!='')){
        info.map.push({
            coord: req.body.coord,
            name: req.body.mapname,
            AID: req.body.mapAID
        });
    }
    else if(typeof(req.body.coord)==='object'){
        for(let i in req.body.coord){
            if(req.body.coord[i]!='' || req.body.mapname[i]!=''){    
                info.map.push({
                    coord: req.body.coord[i],
                    name: req.body.mapname[i],
                    AID: req.body.mapAID[i]
                });
            }
        }
    }
    info.imgs = [];
    if(typeof(req.body.src)==='string' && (req.body.src!='' || req.body.x!='' || req.body.y!='' || req.body.imgname!='')){
        info.imgs.push({
            src: req.body.src,
            x: req.body.x,
            y: req.body.y,
            name: req.body.imgname,
            AID: req.body.imgAID
        });
    }
    else if(typeof(req.body.src)==='object'){
        for(let i in req.body.src){
            if(req.body.src[i]!='' || req.body.x[i]!='' || req.body.y[i]!='' || req.body.imgname[i]!=''){    
                info.imgs.push({
                    src: req.body.src[i],
                    x: parseInt(req.body.x[i]),
                    y: parseInt(req.body.y[i]),
                    name: req.body.imgname[i],
                    AID: req.body.imgAID[i]
                });
            }
        }
    }
    return info;
}
db.connect().then(function() {
    app.listen(10001, function(req, res) {
        console.log('listening to 10001!');
    });
});