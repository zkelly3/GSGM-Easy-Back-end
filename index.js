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
    if(!req.session.UID){
        res.redirect('/login');
        return;
    }
    next();
}
function gameAuth(req, res, next) {
    GID = req.params.GID;
    db.getGameOwner(GID)
        .then(function(result) {
            if(!result) result = {UID: ""};
            if(result.UID != req.session.UID){
                res.redirect('/');
                return;
            }
            next();
        });
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
app.get('/e_info/:GID', auth, gameAuth, function(req, res) {
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
app.get('/scenes/:GID', auth, gameAuth, function(req, res) {
    req.session.error = false;
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
app.get('/new_scene/:GID', auth, gameAuth, function(req, res) {
    res.render('e_scene', {
        GID: req.params.GID,
        scene: {},
        isNew: true
    });
});
app.get('/e_scene/:GID/:SID', auth, gameAuth, function(req, res) {
    db.getEditSceneInfo(req.params.SID)
        .then(function(data) {   
            var scene = {};
            scene.name = data[0].name;
            scene.bgd_img = data[0].img;
            var map = [];
            for(let i in data[2]){
                var coord;
                if(data[2][i].coords == ""){
                    coord = [];
                }
                else{
                    coord = JSON.parse(data[2][i].coords);
                }
                map.push({
                    coord: JSON.stringify(coord),
                    coordString: coordString(coord),
                    name: data[2][i].name,
                    AID: data[2][i].AID,
                    id: data[2][i].id
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
                    AID: data[1][i].AID,
                    id: data[1][i].id
                });
            }
            scene.imgs = imgs;
            if(!req.session.error){
                req.session.error = false;
            }
            res.render('e_scene', {
                GID: req.params.GID,
                SID: req.params.SID,
                isNew: false,
                error: req.session.error,
                scene: scene
            });
        });
});
app.get('/e_action/:GID/:SID', auth, gameAuth, function(req, res) {
    db.getEditActionInfo(req.params.SID, req.params.GID)
        .then(function(data) {
            var scene = {};
            scene.name = data[0][0].name;
            scene.SID = req.params.SID;
            
            var map = [];
            for(let i in data[0][2]){
                var index = findActIndex(data[0][2][i].AID, data[1]);
                var AID;
                var actions;
                var isSelf;
                if(index>-1){
                    AID = parseInt(data[1][index].AID);
                    actions = JSON.parse(data[1][index].act_data);
                    isSelf = (actions.length==0 || actions[0].type!='use');
                }
                else{
                    AID = 0;
                    actions = [];
                    data[0][2][i].AID = 0;
                    isSelf = true;
                }
                var step2 = {};
                step2.AID = AID;
                step2.actions = actions;
                step2.isSelf = isSelf;
                map.push({
                    id: data[0][2][i].id,
                    name: data[0][2][i].name,
                    step2: step2
                });
            }
            
            var item = [];
            for(let i in data[0][1]){
                var index = findActIndex(data[0][1][i].AID, data[1]);
                var AID;
                var actions;
                var isSelf;
                if(index>-1){
                    AID = parseInt(data[1][index].AID);
                    actions = JSON.parse(data[1][index].act_data);
                    isSelf = (actions.length==0 || actions[0].type!='use');
                }
                else{
                    AID = 0;
                    actions = [];
                    isSelf = true;
                }
                var step2 = {};
                step2.AID = AID;
                step2.actions = actions;
                step2.isSelf = isSelf;
                item.push({
                    id: data[0][1][i].id,
                    name: data[0][1][i].name,
                    step2: step2
                });
            }

            var AID;
            var actions;
            var isSelf;
            var exist = false;
            for(let i in data[1]){
                if(data[1][i].AID == data[0][0].AID){
                    AID = parseInt(data[1][i].AID);
                    actions = JSON.parse(data[1][i].act_data);
                    isSelf = (actions.length==0 || actions[0].type!='use');
                    break;
                }
            }
            if(isNaN(AID) || AID==0){
                AID = 0;
                actions = [];
                isSelf = true;
            }
            
            var init = {};
            var step2 = {}
            step2.AID = AID;
            step2.actions = actions;
            step2.isSelf = isSelf;
            init.step2 = step2;
            
            var scenes = [];
            for(let i in data[2]){
                scenes.push({
                    SID: data[2][i].SID,
                    name: data[2][i].name
                });
            }
            console.log(init);
            console.log(map);
            console.log(item);
            res.render('e_action',{
                GID: req.params.GID,
                scene: scene,
                scenes: scenes,
                init: init,
                map: map,
                item: item
            });
        });
});

app.post('/login', function(req, res) {
    req.session.UID = req.body.UID;
    if(req.body.stay) req.session.cookie.maxAge = 1000*86400*30;
    res.redirect('/');
});
app.post('/e_info/:GID', auth, gameAuth, function(req, res) {
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
app.post('/e_scene/:GID/:SID', auth, gameAuth, function(req, res) {
    var info = wrapSceneInfo(req);
    console.log(info);
    db.updateEditSceneInfo(req.params.SID, req.params.GID, info)
    .then(function() {
            req.session.error = false;
            res.redirect('/scenes/' + req.params.GID);
        }, function(){
            req.session.error = true;
            res.redirect('/e_scene/' + req.params.GID + '/' + req.params.SID);
        });
});
app.post('/new_scene/:GID', auth, gameAuth, function(req, res) {
    var info = wrapSceneInfo(req);
    db.insertEditSceneInfo(req.params.GID, info)
        .then(function() {
            res.redirect('/scenes/' + req.params.GID);
        });
});
app.post('/e_action/:GID/:SID', auth, gameAuth, function(req, res) {
    var data = req.body;
    if(!data.init.step2.actions) data.init.step2.actions = [];
    for(let i in data.map){
        if(!data.map[i].step2.actions) data.map[i].step2.actions = [];
    }
    for(let i in data.item){
        if(!data.item[i].step2.actions) data.item[i].step2.actions = [];
    }
    
    dealifelse(data.init.step2.actions);
    for(let i in data.map){
        dealifelse(data.map[i].step2.actions);
    }
    for(let i in data.item){
        dealifelse(data.item[i].step2.actions);
    }
    
    db.updateEditActionInfo(req.params.SID, data, req.params.GID)
        .then(function(){
            res.send({url:'/scenes/'+req.params.GID});
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
            AID: req.body.mapAID,
            id: req.body.mapid
        });
    }
    else if(typeof(req.body.coord)==='object'){
        for(let i in req.body.coord){
            if(req.body.coord[i]!='' || req.body.mapname[i]!=''){    
                info.map.push({
                    coord: req.body.coord[i],
                    name: req.body.mapname[i],
                    AID: req.body.mapAID[i],
                    id: req.body.mapid[i]
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
            AID: req.body.imgAID,
            id: req.body.imgid
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
                    AID: req.body.imgAID[i],
                    id: req.body.imgid[i]
                });
            }
        }
    }
    return info;
}

function coordString(coord) {
    var result = "";
    for(let i in coord) {
        if(i!=0) result += ',';
        result += coord[i].x + ',' + coord[i].y;
    }
    return result;
}
function findActIndex(AID, actions){
    if(AID==null){
        return -1;
    }
    for(let i in actions){
        if(AID==actions[i].AID){
            return i;
        }
    }
    return -1;
}
function str2Bool(str){
    return str===true || str==='true';
}
function dealifelse(actions){
    for(let i in actions){
        if(actions[i].type=='ifelse'){
            var j = 0;
            while(j<actions[i].cases.length-1){
                var conditions = actions[i].cases[j].cond;
                var k = 0;
                while(k<conditions.length){
                    if(conditions[k].type=="" || conditions[k].value==""){
                        conditions.splice(k, 1);
                    }
                    else{
                        k++;
                    }
                }
                if(conditions.length==0){
                    actions[i].cases.splice(j, 1);
                }
                else{
                    j++;
                }
            }
            if(actions[i].cases.length==1){
                actions[i].cases.splice(0, 0, {
                    cond: [{
                        type: "",
                        value: ""
                    }],
                    act: []
                });
            }
        }
    }
}

db.connect().then(function() {
    app.listen(10001, function(req, res) {
        console.log('listening to 10001!');
    });
});