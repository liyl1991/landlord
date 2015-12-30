
var Online = qc.landlord.Online = function() {
    var self = this;
    self.socket = io.connect('http://192.168.16.191:8081/',{'connect timeout': 10000});
    self.init();
};

Online.prototype.connect = function (){
    // return new Promise(function(resolve, reject){
    //     if(self.socket.connected){
    //         console.info('连接服务器成功');
    //         self.init();
    //         resolve(data);
    //     } else {
    //         reject(data);
    //     }
    // });
};
Online.prototype.ERR_EXIST_NAME = 1;
/**
 * 注册游戏
 * @method register
 * @param  {[type]} nickname 昵称
 */
Online.prototype.register = function (nickname){
    var self = this;
    return new Promise(function(resolve, reject){
        try {
            self.socket.emit('register', {name : nickname});
            //注册结果
            self.socket.on('registerResult', function(data){
                if(data.uid){
                    resolve(data);
                } else {
                    reject(self.ERR_EXIST_NAME);
                }
            });
        } catch (e) {
            console.info(e);
            reject('error');
        }
});
};

/**
 * 加入游戏
 * @method joinGame
 * @param  {[type]} nickname 昵称
 */
Online.prototype.joinGame = function (uid){
    var self = this;
    return new Promise(function(resolve, reject){
        try {
            //加入游戏结果，获取桌位信息
            self.socket.on('joinResult', function(data){
                console.log(data);
                resolve(data);
            });
            self.socket.emit('joinGame', {'uid' : uid});
        } catch (e) {
            console.info(e);
        }
    });
};

//退出游戏
Online.prototype.exitGame = function (){
    try {
        var data = {
            deskNo: G.ownPlayer.deskNo,
            seatNo: G.ownPlayer.seatNo
        };
        this.socket.emit('exitGame', data);
        G.leftPlayer = null;
        G.rightPlayer = null;
    } catch (e) {
        console.info(e);
    }
};
/**
 * 修改自己的准备状态
 * @method toggleReady
 * @param  {[type]}    flag [description]
 * @return {[type]}         [description]
 */
Online.prototype.toggleReady = function (flag){
    var self = this;
    var data = {
            'deskNo': G.ownPlayer.deskNo,
            'seatNo': G.ownPlayer.seatNo,
            'isReady': flag
    };
    self.socket.emit('toggleReady', data);
};

/**
 * 抢地主：发送自己给出的分数
 * @method toggleReady
 * @param  {[type]}    flag [description]
 * @return {[type]}         [description]
 */
Online.prototype.robLandlord = function (robScore){
    var self = this;
    var data = {
            'deskNo': G.ownPlayer.deskNo,
            'seatNo': G.ownPlayer.seatNo,
            'robScore': robScore
    };
    self.socket.emit('robLandlord', data);
};

/**
 * 玩家出牌
 * @method playCard
 * @param  {[type]} info 出牌信息
 * @return {[type]}          [description]
 */
Online.prototype.playCard = function (info){
    var data = {
            'deskNo': G.ownPlayer.deskNo,
            'seatNo': G.ownPlayer.seatNo,
            'cardInfo': info
    };
    this.socket.emit('playCard', data);
};

//初始化，添加socket监听
Online.prototype.init = function(){
    var self = this;

    //桌位信息变更
    self.socket.on('deskUpdate', function(info){
        window.onlinePlayUI.refreshInfo(info);
    });

    //接收玩家准备信息
    self.socket.on('noticeReady', function(data){
        window.onlinePlayUI.playerReady(data);
    });

    //可以开始游戏
    self.socket.on('start', function(data){
        console.info("restart");
        console.info(data);
        window.onlinePlayUI.start(data);
    });

    //抢地主
    self.socket.on('robInfo', function(data){
        window.onlinePlayUI.robLandlord(data.nextSeatNo, data.currentScore, data.preSeatNo, data.preScore);
        console.info(data);
    });

    //轮换出牌
    self.socket.on('play', function(data){
        window.olLandlordUI.playTurn(data);
    });

    //设置地主
    self.socket.on('setLandlord', function(data){
        window.onlinePlayUI.setLandlord(data);
    });

    //游戏结束
    self.socket.on('gameover', function(data){
        console.info('gameover');
        console.info(data);
        window.olLandlordUI.judgeWinner(data);
    });

    //游戏中有强制退出
    self.socket.on('forceExit', function(data){
        console.info('forceExit');
        console.info(data);
        window.onlinePlayUI.forceExit(data);
    });

    //游戏中其他玩家断线重连
    self.socket.on('playerBack', function(data){
        console.info('playerBack');
        window.onlinePlayUI.playerBack(data);
    });
};
