// define a user behaviour
var Player = qc.landlord.Player = function (n){
    var self = this;
    // 玩家名
    self.name = n ? n : 'Player';
    //是否是地主
    self.isLandlord = false;
    //是否是AI玩家
    self.isAI = true;
    //牌组
    self.cardList = [];
    //下一家
    self.nextPlayer = null;
    //以下属性用于多人对战
    self.uid = null;
    self.deskNo = null;
    self.seatNo = null;
    //是否已经准备
    self.isReady = false;
    //是否已经离开
    self.isLeave = false;
};
Object.defineProperties(Player.prototype, {
    score: {
        get: function(){
            return this._score;
        },
        set: function(v){
            this._score = v;
            var storage = G.game.storage;
            storage.set(this.name, v);
            storage.save();
        }
    }
});
