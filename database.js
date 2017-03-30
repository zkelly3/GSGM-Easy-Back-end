Promise.slowAll = function(iterable) {
    error = false;
    reason = null;
    iterable = iterable.map((x) =>
      x.catch(err => {
        error = true;
        reason = err;
      }));
    return Promise.all(iterable)
      .then(values => {
        if(error) {
          return Promise.reject(reason);
        }
        else {
          return Promise.resolve(values);
        }
      });
}
var mysql = require('mysql');
var connection = mysql.createConnection({
  host: 'localhost',
  user: 'GSGM',
  password: 'gsgm',
  database: 'GSGM'
});

var db = {
    /* wrap */
    connect: function() {
        return new Promise(function(resolve, reject) {
            connection.connect(function(error) {
                if(error) {
                    console.error('error connecting: '+err.stack);
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    },
    beginTransaction: function(){
        return new Promise(function(resolve, reject) {
            connection.beginTransaction(function(error) {
                if(error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    },
    commit: function(){
        return new Promise(function(resolve, reject) {
            console.log('commit');
            connection.commit(function(error) {
                if(error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    },
    rollback: function(error){
        return new Promise(function(resolve, reject) {
            console.log('rollback');
            connection.rollback(function(err) {
                reject(err);
            });
        });
    },
    query: function(query_str, params){
        return new Promise(function(resolve, reject) {
            connection.query(query_str, params, 
                function(error, results, fields){
                    if(error) {
                        console.error(error);
                        reject(error);
                        return;
                    }
                    resolve(results, fields);
            });
        });
    },
    getGames: function(UID) {
        //return db.query('SELECT name, initSID, last_edit, GID, is_opened FROM game WHERE UID="'+ UID + '";')
        return db.query('SELECT name, initSID, last_edit, GID, is_opened FROM game WHERE UID=? ORDER BY last_edit DESC;', [UID])
            .then(function(results, fields) {
                var info = [];
                for(let i in results) {
                    if(results[i].initSID){
                        info.push(db.getSceneInfo(results[i].initSID)
                            .then(function(res, f) {
                                return {
                                    name: results[i].name,
                                    time: results[i].last_edit,
                                    GID: results[i].GID,
                                    img: res.img,
                                    is_opened: results[i].is_opened
                                };
                            })
                        );
                    }
                    else {
                        info.push(Promise.resolve({
                            name: results[i].name,
                            time: results[i].last_edit,
                            GID: results[i].GID,
                            img: "",
                            is_opened: results[i].is_opened
                        }));
                    }
                }
                return Promise.all(info);
            });
    },
    getGameInfo: function(GID) {
        return db.query('SELECT name, description, is_opened, initSID FROM game WHERE GID=?;', [GID])
            .then(function(results, fields) {
                return {
                    name: results[0].name,
                    description: results[0].description,
                    is_opened: results[0].is_opened,
                    initSID: results[0].initSID
                };
            });
    },
    getGameOwner: function(GID) {
        return db.query('SELECT UID FROM game WHERE GID=?;', [GID])
            .then(function(results, fields) {
                return results[0];
            });
    },
    updateGameInfo: function(GID, info) {
        if(!isNaN(parseInt(info.initSID))){
            return db.query('UPDATE game SET name=?, description=?, is_opened=?, initSID=? WHERE GID=?;', [info.name, info.description, info.is_opened, info.initSID, GID]);
        }
        else {
            return db.query('UPDATE game SET name=?, description=?, is_opened=? WHERE GID=?;', [info.name, info.description, info.is_opened, GID]);
        }
    },
    insertGameInfo: function(UID, info) {
        return db.query('INSERT INTO game(name, description, is_opened, UID) VALUES(?, ?, ?, ?);', [info.name, info.description, info.is_opened, UID]);
    },
    getScenes: function(GID) {
        return db.query('SELECT SID, name, img FROM scene WHERE GID=? ORDER BY SID ASC;', [GID])
            .then(function(results, fields) {
                return results;
            });
    },
    getEditSceneInfo: function(SID) {
        return Promise.all([db.getSceneInfo(SID), db.getItems(SID), db.getSceneMap(SID)])
            .then(function(data) {
                return data;
            });
    },
    updateEditSceneInfo: function(SID, GID, info) {
        return db.beginTransaction()
            .then(function() {
                return Promise.slowAll([db.deleteItems(SID), db.deleteSceneMap(SID), db.updateSceneInfo(SID, info.name, info.bgd_img)]);
            })
            .then(function() {
                return Promise.slowAll([db.insertItems(SID, info.imgs), db.insertSceneMap(SID, info.map)])
                    .then(function() {
                        return db.query('UPDATE game SET last_edit=NOW() WHERE GID=?;', [GID]);
                    });
            })
            .then(function() {return db.commit();}, function(error){return db.rollback(error);});
    },
    insertEditSceneInfo: function(GID, info) {
        return db.beginTransaction()
            .then(function(){
                return db.query('INSERT INTO scene(GID, name, img) VALUES(?, ?, ?);', [GID, info.name, info.bgd_img])
            })
            .then(function(results, fields) {
                return Promise.slowAll([db.insertItems(results.insertId, info.imgs), db.insertSceneMap(results.insertId, info.map)])
                    .then(function() {
                        return db.query('UPDATE game SET last_edit=NOW() WHERE GID=?;', [GID]);
                    });
            })
            .then(function() {return db.commit();}, function(error){return db.rollback(error);});
    },
    getSceneInfo: function(SID) {
        return db.query('SELECT name, img FROM scene WHERE SID=?;', [SID])
            .then(function(results, fields) {
                return results[0];
            });
    },
    updateSceneInfo: function(SID, name, bgd_img){
        return db.query('UPDATE scene SET name=?, img=? WHERE SID=?;', [name, bgd_img, SID]);
    },
    getItems: function(SID) {
        return db.query('SELECT x, y, name, imgurl, AID FROM scene_items WHERE SID=? ORDER BY id ASC;', [SID])
            .then(function(results, fields) {
                return results;
            });
    },
    deleteItems: function(SID) {
        return db.query('DELETE FROM scene_items WHERE SID=?;', [SID]);
    },
    insertItems: function(SID, items) {
        let prevPromise = Promise.resolve();
        for(let i in items){
            prevPromise = prevPromise.then(function() {
                if(items[i].AID){
                    return db.query('INSERT INTO scene_items(SID, type, x, y, AID, imgurl, name) VALUES(?, "image", ?, ?, ?, ?, ?);', [SID, items[i].x, items[i].y, items[i].AID, items[i].src, items[i].name]);
                }
                else{
                    return db.query('INSERT INTO scene_items(SID, type, x, y, imgurl, name) VALUES(?, "image", ?, ?, ?, ?);', [SID, items[i].x, items[i].y, items[i].src, items[i].name]);
                    //return db.query('INSERT INTO scene_items(SID, type, x, y, imgurl, name) VALUES(?, "image", ?, ?, ?, ?);', [SID, items[i].x, items[i].y, items[i].name]);
                }
            });
        }
        return prevPromise;
    },
    getSceneMap: function(SID) {
        return db.query('SELECT name, coords, AID FROM scene_map WHERE SID=?;', [SID])
            .then(function(results, fields) {
                return results;
            });
    },
    deleteSceneMap: function(SID) {
        console.log('delete');
        return db.query('DELETE FROM scene_map WHERE SID=?;', [SID]);
    },
    insertSceneMap: function(SID, map){
        let prevPromise = Promise.resolve();
        for(let i in map){
            prevPromise = prevPromise.then(function() {
                if(map[i].AID){
                    return db.query('INSERT INTO scene_map(SID, name, shape, coords, AID) VALUES(?, ?, "poly", ?, ?);', [SID, map[i].name, map[i].coord, map[i].AID]);
                }
                else{
                    return db.query('INSERT INTO scene_map(SID, name, shape, coords) VALUES(?, ?, "poly", ?);', [SID, map[i].name, map[i].coord]);
                }
            });
        }
        console.log('insert');
        return prevPromise;
    }
}
module.exports = db;
