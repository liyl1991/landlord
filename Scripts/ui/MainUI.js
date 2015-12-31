/**
 * 主场景脚本
 * @method defineBehaviour
 */
var MainUI = qc.defineBehaviour('qc.engine.MainUI', qc.Behaviour, function() {
    this.singleBtn = null;
	this.multiBtn = null;
	this.singleScene = null;
}, {
	singleBtn : qc.Serializer.NODE,
	multiBtn: qc.Serializer.NODE,
    enterNameBtn : qc.Serializer.NODE,
	backBtn: qc.Serializer.NODE,
    nameField: qc.Serializer.NODE,
    enterNamePanel: qc.Serializer.NODE,
    message: qc.Serializer.NODE,
	singleScene: qc.Serializer.STRING,
	multiScene: qc.Serializer.STRING
});

// Called when the script instance is being loaded.
MainUI.prototype.awake = function() {
    var self = this;
    //单机按钮事件
	self.addListener(self.singleBtn.onClick, function(){
		self.game.state.load(self.singleScene, false, function() {
            //牌组管理
            G.cardMgr = new qc.landlord.Card();
            //玩家本人
            G.ownPlayer = new qc.landlord.Player('QCPlayer');
            G.ownPlayer.isAI = false;
            var storage = G.game.storage;
            var ownScore = storage.get('QCPlayer');
            G.ownPlayer.score = ownScore ? ownScore : 500;
            //电脑玩家(左)
            G.leftPlayer = new qc.landlord.Player('AI_Left');
            var leftScore = storage.get('AI_Left');
            G.leftPlayer.score = leftScore ? leftScore : 500;
            //电脑玩家(右)
            G.rightPlayer = new qc.landlord.Player('AI_Right');
            var rightScore = storage.get('AI_Right');
            G.rightPlayer.score = rightScore ? rightScore : 500;

            //指定玩家顺序
            G.ownPlayer.nextPlayer = G.rightPlayer;
            G.rightPlayer.nextPlayer = G.leftPlayer;
            G.leftPlayer.nextPlayer = G.ownPlayer;

            //底牌
            G.hiddenCards = [];
            //当前手牌
            G.currentCards = [];
        }, function() {
            console.log(self.singleScene + '场景加载完毕。');
        });
	}, self);

    //多人对战按钮事件
	self.addListener(self.multiBtn.onClick, function(){

        var uid = G.game.storage.get('uid');
        if(uid){
            self.showMessage(self.MSG_WAITING);
            self.enterGame(uid);
        } else {
            var np = self.enterNamePanel.getScript('qc.TweenAlpha');
            np.from = 0;
            np.to = 1;
            np.resetToBeginning();
            self.enterNamePanel.visible = true;
            np.playForward();
        }

	}, self);

    //确认按钮事件
	self.addListener(self.enterNameBtn.onClick, function(){
        var nickname = self.nameField.text.trim();
        if(nickname){
            self.showMessage(self.MSG_WAITING);
            var result = G.online.register(nickname);
            result.then(function(data){
                if(data.uid){
                    G.game.storage.set('uid', data.uid);
                    G.game.storage.save();
                    self.enterGame(data.uid);
                } else if(err === G.online.ERR_EXIST_NAME){
                    self.showMessage(self.MSG_EXIST_NAME);
                }
            }).catch(function(err){
                if(err === G.online.ERR_EXIST_NAME){
                    self.showMessage(self.MSG_EXIST_NAME);
                }
            });
        }
	}, self);

    //返回按钮事件
	self.addListener(self.backBtn.onClick, function(){
        var np = self.enterNamePanel.getScript('qc.TweenAlpha');
        np.from = 1;
        np.to = 0;
        np.resetToBeginning();
        //self.enterNamePanel.visible = true;
        np.playForward();
        np.onFinished.addOnce(function (){
            self.enterNamePanel.visible = false;
        }, self);
        window.onbeforeunload = undefined;
	}, self);
};

MainUI.prototype.enterGame = function(uid) {
    var self = this;
    G.ownPlayer = new qc.landlord.Player(null);
    G.ownPlayer.uid = uid;
    window.onbeforeunload = function (){
        var warning="确认退出游戏?";
        return warning;
    };
    G.online.joinGame(G.ownPlayer.uid).then(function(data){
        var player = data.seats ? data.seats[data.ownSeatNo] : data.desk.seats[data.ownSeatNo];
        G.ownPlayer.deskNo = player.deskNo;
        G.ownPlayer.name = player.name;
        G.ownPlayer.seatNo = data.ownSeatNo;
        G.netInitData = data;
        self.game.state.load(self.multiScene, false, function() {
        }, function() {
            console.log(self.multiScene + '场景加载完毕。');
        });
    });
};

MainUI.prototype.showMessage = function(m) {
    var self = this;
    if(m){
        self.message.text = m;
        self.message.visible = true;
    } else {
        self.message.visible = false;
    }
};

MainUI.prototype.MSG_WAITING = '请稍等';
MainUI.prototype.MSG_EXIST_NAME = '您输入的昵称已被使用，请重试';
