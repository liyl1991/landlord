/**
 * 用户自定义脚本.
 */
(function(window, Object, undefined) {

// 定义本工程的名字空间
qc.landlord = {};

// 用来存放所有的全局数据（函数、变量等）
window.G = qc.landlord.G = {};

// 初始化逻辑
qc.initGame = function(game) {
    game.log.trace('Start the game landlord.');

    // 将game实例的引用记录下来，方便在其他逻辑脚本模块中访问
    G.game = game;
    //牌组管理
    G.cardMgr = new qc.landlord.Card();
    //玩家本人
    G.ownPlayer = new qc.landlord.Player('QCPlayer');
    G.ownPlayer.isAI = false;
    var storage = game.storage;
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
    //游戏规则
    G.gameRule = new qc.landlord.GameRule();
    //AI逻辑
    //G.AILogic = new qc.landlord.AILogic();
};

/**
 * 开始游戏，负责发牌洗牌，抢地主
 */
var PlayUI = qc.defineBehaviour('qc.engine.PlayUI', qc.Behaviour, function() {
    // need this behaviour be scheduled in editor
    this.startBtn = null;
    /**
     * 用于抢地主
     */
    //当前最高分
    this.currentScore = 0;
    //当前次数
    this.round = 0;
    //当前地主
    this.currentLandlord = null;
    window.playUI = this;
}, {
     startBtn : qc.Serializer.NODE,
     ownCardContainer : qc.Serializer.NODE,
     hiddenContainer : qc.Serializer.NODE,
     cardPrefab: qc.Serializer.PREFAB,
     msgPrefab: qc.Serializer.PREFAB,
     scoreOne : qc.Serializer.NODE,
     scoreTwo : qc.Serializer.NODE,
     scoreThree : qc.Serializer.NODE,
     scoreZero : qc.Serializer.NODE,
     scorePanel : qc.Serializer.NODE,
     ratePanel: qc.Serializer.NODE,
     leftPlayerArea : qc.Serializer.NODE,
     rightPlayerArea : qc.Serializer.NODE,
     ownPlayerArea : qc.Serializer.NODE
});

// Called when the script instance is being loaded.
PlayUI.prototype.awake = function() {
    var self = this;
    //指定玩家区域
    self.leftPlayerArea.getScript('qc.engine.PlayerUI').player = G.leftPlayer;
    self.rightPlayerArea.getScript('qc.engine.PlayerUI').player = G.rightPlayer;
    self.ownPlayerArea.getScript('qc.engine.PlayerUI').player = G.ownPlayer;
    self.reDrawScore();
    //事件
    self.addListener(self.startBtn.onClick, self.startGame, self);
    self.addListener(self.scoreOne.onClick, function(){
        self.playerProvideScore(1);
    }, self);
    self.addListener(self.scoreTwo.onClick, function(){
        self.playerProvideScore(2);
    }, self);
    self.addListener(self.scoreThree.onClick, function(){
        self.playerProvideScore(3);
    }, self);
    self.addListener(self.scoreZero.onClick, function(){
        self.playerProvideScore(4);
    }, self);
};

//开始游戏
PlayUI.prototype.startGame = function (){
    var self = this;
    //清空玩家的牌
    for (var i = 0; i < G.currentCards.length ; i++) {
        G.currentCards[i].destroy();
    }
    //清空原牌组
    G.currentCards = [];
    G.hiddenCards = [];
    G.ownPlayer.cardList = [];
    G.leftPlayer.cardList =[];
    G.rightPlayer.cardList = [];
    //还原抢地主数据
    self.currentScore = 0;
    self.round = 0;
    self.currentLandlord = null;
    self.scorePanel.text = '0';
    self.ratePanel.text = '1';
    self.ownPlayerArea.getScript('qc.engine.PlayerUI').headPic.visible = false;
    self.leftPlayerArea.getScript('qc.engine.PlayerUI').headPic.visible = false;
    self.rightPlayerArea.getScript('qc.engine.PlayerUI').headPic.visible = false;
    self.reDraw();
    self.startBtn.visible = false;
    window.landlordUI.roundWinner = null;
    window.landlordUI.hideBtn();
    window.landlordUI.cleanAllPlayArea();
    window.landlordUI.cue.visible = false;
    //还原底牌
    for (i = 0; i < self.hiddenContainer.children.length; i++) {
        self.hiddenContainer.children[i].frame = 'bg.jpg';
    }

    //重新发牌
    self.dealCards();
};

/**
 * 抢地主阶段
 * @method robLandlord
 */
PlayUI.prototype.robLandlord = function (){
    var self = this;
    //随机获取从哪一家开始
    var fb = G.gameRule.random(1,3);
    var firstPlayer = fb === 1 ? G.ownPlayer : (fb == 2 ? G.rightPlayer : G.leftPlayer);
    self.provideScore(firstPlayer);
};

/**
 * 轮换叫分
 * @method robLandlord
 */
PlayUI.prototype.provideScore = function(player){
    var self = this;
    if(player.isAI){//AI玩家随机出分
        self.scoreThree.visible = false;
        self.scoreTwo.visible = false;
        self.scoreOne.visible = false;
        self.scoreZero.visible = false;
        self.game.timer.add(1000, function (){
            var s = (new AILogic(player)).judgeScore();
            var area = player.nextPlayer.isAI ? window.landlordUI.rightCards : window.landlordUI.leftCards;
            if(s < 4 && s > self.currentScore){//小于3分
                console.info(player.name + ":叫" + s);
                self.currentScore = s;
                self.scorePanel.text = s + '';
                self.currentLandlord = player;
                //根据下家是否是AI判断他的出牌区
                for (var i = 0; i < area.children.length; i++) {//清空
                    area.children[i].destroy();
                }
                var mesg = self.game.add.clone(self.msgPrefab, area);
                mesg.text = s + '分';
                if(s === 3){//三分，得地主
                    self.setLandlord(player);
                    return;
                }
            } else {
                var mesg = self.game.add.clone(self.msgPrefab, area);
                mesg.text = '不叫';
                console.info(player.name + "没有叫分抢地主");
            }
            if(++self.round  === 3){//已经三次不再进行
                if(self.currentLandlord){//有叫分的得地主
                    self.setLandlord(self.currentLandlord);
                } else {//没有叫分，重新发牌
                    self.showRestartMesg();
                    self.startGame();
                }
            } else {
                self.provideScore(player.nextPlayer);
            }
        });
    } else {
        self.scoreZero.visible = true;
        self.scoreThree.visible = true;
        if(self.currentScore < 2)
            self.scoreTwo.visible = true;
        if(self.currentScore < 1)
            self.scoreOne.visible = true;
    }
};

/**
 * 玩家给分(抢地主)
 * @method function
 * @return {[type]} [description]
 */
PlayUI.prototype.playerProvideScore = function(score){
    var self = this;
    if(score < 4){//小于3分
        self.currentScore = score;
        self.scorePanel.text = score + '';
        self.currentLandlord = G.ownPlayer;
        var mesg = self.game.add.clone(self.msgPrefab, window.landlordUI.ownCards);
        mesg.text = score + '分';
        if(score === 3){//三分，得地主
            self.setLandlord(G.ownPlayer);
            return;
        }
    } else {
        var mesg = self.game.add.clone(self.msgPrefab, window.landlordUI.ownCards);
        mesg.text = '不叫';
    }
    if(++self.round  === 3){//已经三次不再进行
        if(self.currentLandlord){//有叫分的得地主
            self.setLandlord(self.currentLandlord);
        } else {//没有叫分，重新发牌
            self.showRestartMesg();
            self.startGame();
        }
    } else {
        self.provideScore(G.ownPlayer.nextPlayer);
    }
};

//发牌
PlayUI.prototype.dealCards = function (){
    var self = this,
        cards = G.cardMgr.getNewCards();
    //抽三张底牌

    for (var i = 0; i < 3; i++) {
        G.hiddenCards.push(self.getOneCard(cards));
        //G.hiddenCards.push(cards.splice(0,1)[0]);
    }
    //总牌数
    var total = 17;
    var deal = function (){
        //左边电脑玩家发牌
        card = self.getOneCard(cards);
        G.leftPlayer.cardList.push(card);
        var c = self.game.add.clone(self.cardPrefab, self.leftPlayerArea.getScript('qc.engine.PlayerUI').cardContainer);
        c.visible = true;
        c.interactive = false;
        //c.frame = card.icon;
        //右边电脑玩家发牌
        card = self.getOneCard(cards);
        G.rightPlayer.cardList.push(card);
        c = self.game.add.clone(self.cardPrefab, self.rightPlayerArea.getScript('qc.engine.PlayerUI').cardContainer);
        c.visible = true;
        c.interactive = false;
        c.name = card.icon.split('.')[0];
        //c.frame = card.icon;
        //左边电脑玩家发牌
        //玩家的牌
        card = self.getOneCard(cards);
        G.ownPlayer.cardList.push(card);
        self.insertOneCard(card);
        if ( --total > 0) {
            self.game.timer.add(200, deal);
        } else {
            G.leftPlayer.cardList.sort(self.cardSort);
            G.rightPlayer.cardList.sort(self.cardSort);
            G.ownPlayer.cardList.sort(self.cardSort);
            for (i = 0; i < G.currentCards.length; i++) {
                G.currentCards[i].getScript('qc.engine.CardUI').isSelected = false;
            }
            //进入抢地主阶段
            self.robLandlord();
        }
    };
    deal();
/*
    //造牌
    G.hiddenCards = [
        {icon: 'j1.jpg', type: '0', val: 17},
        {icon: 'j2.jpg', type: '0', val: 16},
        {icon: 't1.jpg', type: '1', val: 14}
    ];
    G.ownPlayer.cardList = [
        {icon: 'k9.jpg', type: '4', val: 9},
        {icon: 'h10.jpg', type: '3', val: 10},
        {icon: 'k11.jpg', type: '4', val: 11},
        {icon: 'h12.jpg', type: '3', val: 12},
        {icon: 'k13.jpg', type: '4', val: 13},
        {icon: 't1.jpg', type: '1', val: 14},
        {icon: 't2.jpg', type: '1', val: 15}

    ];
    for (var k = 0; k < G.ownPlayer.cardList.length; k++) {
        self.insertOneCard(G.ownPlayer.cardList[k]);
    }
    G.rightPlayer.cardList = [
        {icon: 'x4.jpg', type: '2', val: 4},
        {icon: 't5.jpg', type: '1', val: 5},
        {icon: 'x6.jpg', type: '2', val: 6},
        {icon: 't7.jpg', type: '1', val: 7},
        {icon: 't8.jpg', type: '1', val: 8},

        {icon: 't2.jpg', type: '1', val: 15}
    ];
    G.leftPlayer.cardList = [

        {icon: 'x7.jpg', type: '2', val: 7},
        {icon: 'x8.jpg', type: '2', val: 8},
        {icon: 'x9.jpg', type: '2', val: 9},
        {icon: 't5.jpg', type: '1', val: 5},
        {icon: 't6.jpg', type: '1', val: 6},
        {icon: 'h11.jpg', type: '3', val: 11}
    ];
*/
    /*
    {icon: 't3.jpg', type: '1', val: 3},
    {icon: 't4.jpg', type: '1', val: 4},
    {icon: 'x3.jpg', type: '2', val: 3},
    {icon: 't9.jpg', type: '1', val: 9},
    {icon: 'h3.jpg', type: '3', val: 3},
    {icon: 'k3.jpg', type: '4', val: 3},
    {icon: 'h4.jpg', type: '3', val: 4},


    {icon: 't11.jpg', type: '1', val: 11},
    {icon: 'x11.jpg', type: '2', val: 11}

    {icon: 't2.jpg', type: '1', val: 15},

    {icon: 'h9.jpg', type: '3', val: 9},
    {icon: 'k7.jpg', type: '4', val: 7},

    {icon: 'x1.jpg', type: '2', val: 14},
    {icon: 'k12.jpg', type: '4', val: 12},
    {icon: 'x12.jpg', type: '2', val: 12}
    ];


    {icon: 'h1.jpg', type: '3', val: 14},
    {icon: 'h2.jpg', type: '3', val: 15},




    {icon: 'k1.jpg', type: '4', val: 14},
    {icon: 'k2.jpg', type: '4', val: 15},

    {icon: 'k4.jpg', type: '4', val: 4},

    {icon: 'k6.jpg', type: '4', val: 6},

    {icon: 'k8.jpg', type: '4', val: 8},


    G.leftPlayer.cardList.sort(self.cardSort);
    G.rightPlayer.cardList.sort(self.cardSort);
    G.ownPlayer.cardList.sort(self.cardSort);
    self.robLandlord();
    */
};

//抽取牌组中的一张牌
PlayUI.prototype.getOneCard = function (cards){
    var self = this;
    return cards.splice(self.game.math.random(0,cards.length - 1) ,1)[0];
};

/**
 * 卡牌排序
 * @method cardSort
 * @param  {Object} a [description]
 * @param  {Object} b [description]
 * @return 1 : a < b ,-1 a : > b   [description]
 */
PlayUI.prototype.cardSort = function (a, b){
    var va = parseInt(a.val);
    var vb = parseInt(b.val);
    if(va === vb){
        return a.type > b.type ? 1 : -1;
    } else if(va > vb){
        return -1;
    } else {
        return 1;
    }
};
//设置地主
PlayUI.prototype.setLandlord = function(player){
    var self = this;
    self.scorePanel.text = self.currentScore + '';
    self.scoreThree.visible = false;
    self.scoreTwo.visible = false;
    self.scoreOne.visible = false;
    self.scoreZero.visible = false;
    //显示底牌
    var oldHiddenCard = self.hiddenContainer.children;
    for (var i = 0; i < self.hiddenContainer.children.length; i++) {
        self.hiddenContainer.children[i].frame = G.hiddenCards[i].icon;
    }
    //self.startBtn.visible = false;
    //设置地主及农民信息
    G.ownPlayer.isLandlord = false;
    G.leftPlayer.isLandlord = false;
    G.rightPlayer.isLandlord = false;
    player.isLandlord = true;
    self.setAIStation(self.leftPlayerArea, G.leftPlayer.isLandlord);
    self.setAIStation(self.rightPlayerArea, G.rightPlayer.isLandlord);
    self.ownPlayerArea.getScript('qc.engine.PlayerUI').headPic.frame = G.ownPlayer.isLandlord ? 'landlord.jpg' : 'peasant.jpg';
    self.ownPlayerArea.getScript('qc.engine.PlayerUI').headPic.visible = true;
    //把底牌给地主
    player.cardList = player.cardList.concat(G.hiddenCards);
    player.cardList.sort(self.cardSort);
    self.reDraw();
    if(!player.isAI){//不是AI需要重新渲染牌组
        for (i = 0; i < G.hiddenCards.length; i++) {
            self.insertOneCard(G.hiddenCards[i]);
        }
    }
    for (i = 0; i < G.currentCards.length; i++) {
        G.currentCards[i].getScript('qc.engine.CardUI').isSelected = false;
    }
    console.info('本轮地主是' + player.name);
    //由地主开始出牌
    window.landlordUI.cleanAllPlayArea();
    window.landlordUI.playCard(player);
};
/**
 * 给玩家牌组加入一张牌
 * @method insertOneCard
 * @return {[type]}      [description]
 */
PlayUI.prototype.insertOneCard = function (card){
    var self = this,
        insertIndex = 0;
    if(G.currentCards.length != 0 && self.cardSort(card, G.currentCards[0]) === 1){//比第一张牌小才需要查询
        for (var j = 0; j < G.currentCards.length; j++) {//查询新的牌应放置的位置
            var _curr = G.currentCards[j].getScript('qc.engine.CardUI').info,
                _next = null;
            if( j < G.currentCards.length - 1){
                _next = G.currentCards[j + 1].getScript('qc.engine.CardUI').info;
            }
            if(self.cardSort(card, _curr) === 1 && ((_next && self.cardSort(card, _next) === -1) || !_next)){
                insertIndex = j + 1;
                break;
            }
        }
    }
    var c = self.game.add.clone(self.cardPrefab, self.ownCardContainer);
    c.getScript('qc.engine.CardUI').show(card, true);
    self.ownCardContainer.setChildIndex(c, insertIndex);
    G.currentCards.splice(insertIndex, 0, c);
};
/**
 * 显示AI玩家身份头像
 * @property playerNode节点
 * @property flag 是否是地主
 * @method setAIStation
 */
PlayUI.prototype.setAIStation = function (playerNode, flag){
    var node = playerNode.getScript('qc.engine.PlayerUI');
    node.headPic.frame = flag ? 'landlord.jpg' : 'peasant.jpg';
    node.headPic.visible = true;
};
/**
 *
 * 重绘页面信息：电脑卡牌数量
 */
PlayUI.prototype.reDraw = function (){
    var self = this;
    //设置电脑玩家牌数量
    var reDrawDiff = function (container, len){
        var diff = container.children.length - len;//G.leftPlayer.cardList.length;
        if(diff > 0){
            for (var i = 0; i < diff; i++) {
                container.removeChild(container.children[0]);
            }
        } else {
            diff = -diff;
            for (var i = 0; i < diff; i++) {
                var c = self.game.add.clone(self.cardPrefab, container);
                c.visible = true;
                c.interactive = false;
            }
        }
    };
    reDrawDiff(self.leftPlayerArea.getScript('qc.engine.PlayerUI').cardContainer, G.leftPlayer.cardList.length);
    reDrawDiff(self.rightPlayerArea.getScript('qc.engine.PlayerUI').cardContainer, G.rightPlayer.cardList.length);

    //self.rightPlayerArea.getScript('qc.engine.PlayerUI').cardCount.text = G.rightPlayer.cardList.length + '';
};

PlayUI.prototype.reDrawScore = function(){
    var self = this;
    var own = self.ownPlayerArea.getScript('qc.engine.PlayerUI'),
        left = self.leftPlayerArea.getScript('qc.engine.PlayerUI'),
        right = self.rightPlayerArea.getScript('qc.engine.PlayerUI');
    own.playerScore.text = own.player.score + '分';
    left.playerScore.text = left.player.score + '分';
    right.playerScore.text = right.player.score + '分';
};
/**
 * 显示AI牌
 */
PlayUI.prototype.showAICards = function (){
    var self = this,
        leftCantainer = self.leftPlayerArea.getScript('qc.engine.PlayerUI').cardContainer,
        rightCantainer = self.rightPlayerArea.getScript('qc.engine.PlayerUI').cardContainer;
    for (var i = 0; i < leftCantainer.children.length; i++) {
        leftCantainer.children[i].frame = G.leftPlayer.cardList[i].icon;
    }

    for (i = 0; i < rightCantainer.children.length; i++) {
        rightCantainer.children[i].frame = G.rightPlayer.cardList[i].icon;
    }
};
/**
 *
 * 显示重新开始的提示语句
 */
PlayUI.prototype.showRestartMesg = function (){
    var self = this,
        cue = window.landlordUI.cue;
    cue.text = G.gameRule.MSG_NO_ROROB_RESTART;
    cue.visible = true;
    self.game.timer.add(1500, function(){
        cue.visible = false;
    });
};
// Called every frame, if the behaviour is enabled.
//PlayUI.prototype.update = function() {
//
//};

// define a user behaviour
var PlayerUI = qc.defineBehaviour('qc.engine.PlayerUI', qc.Behaviour, function() {
    // need this behaviour be scheduled in editor
    //this.runInEditor = true;
    this.player = null;
}, {
    headPic : qc.Serializer.NODE,
    playerScore : qc.Serializer.NODE,
    cardContainer : qc.Serializer.NODE
});

// Called when the script instance is being loaded.
//PlayerUI.prototype.awake = function() {
//
//};

// Called every frame, if the behaviour is enabled.
//PlayerUI.prototype.update = function() {
//
//};

// 打牌操作
var LandlordUI = qc.defineBehaviour('qc.engine.LandlordUI', qc.Behaviour, function() {
    this.readyCards = [];
    this.noCardBtn = null;
    this.playBtn = null;
    /*
     * 当前桌面牌信息
     *  roundWinner 本轮当前赢牌的玩家
     *  winCard 牌型信息
     */
    this.winCard = null;
    this.roundWinner = null;

    window.landlordUI = this;
}, {
    noCardBtn : qc.Serializer.NODE,
    cue : qc.Serializer.NODE,
    playBtn : qc.Serializer.NODE,
    warnBtn : qc.Serializer.NODE,
    ownCards : qc.Serializer.NODE,
    leftCards : qc.Serializer.NODE,
    rightCards : qc.Serializer.NODE,
    msgPrefab: qc.Serializer.PREFAB,
    cardPrefab: qc.Serializer.PREFAB
});

// Called when the script instance is being loaded.
LandlordUI.prototype.awake = function() {
    var self = this;
    // 出牌按钮操作
    this.addListener(self.playBtn.onClick, function(){
        var type = self.getReadyCardsKind();
        if(type){
            if(type.cardKind === G.gameRule.BOMB || type.cardKind === G.gameRule.KING_BOMB){
                var rate = parseInt(window.playUI.ratePanel.text);
                window.playUI.ratePanel.text = (rate * 2) + '';
            }
            self.winCard = type;
            self.roundWinner = G.ownPlayer;
            self.addOwnCards();
            self.hideBtn();
            if(G.ownPlayer.cardList.length === 0){
                self.judgeWinner(G.ownPlayer);
                return;
            }
            self.playCard(G.ownPlayer.nextPlayer);
        }
    }, this);
    //提示按钮操作
    this.addListener(self.warnBtn.onClick, function(){
        var ai = new qc.landlord.AILogic(G.ownPlayer);
        var result = null;
        if(!self.roundWinner || self.roundWinner.name == G.ownPlayer.name){//如果本轮出牌赢牌是自己：出牌
            self.cleanAllPlayArea();
            result = ai.play();
        } else { //跟牌
            result = ai.follow();
        }
        if(result){
            //收回所有牌
            for (var i = 0; i < G.currentCards.length ; i++) {
                if(G.currentCards[i].getScript('qc.engine.CardUI').isSelected){
                    G.currentCards[i].anchoredY = 0;
                    G.currentCards[i].getScript('qc.engine.CardUI').isSelected = false;
                }
            }
            for (i = 0; i < result.cardList.length; i++) {//选中牌
                for (var j = 0; j < G.currentCards.length; j++) {
                    var card = G.currentCards[j].getScript('qc.engine.CardUI');
                    if(result.cardList[i].val === card.info.val && result.cardList[i].type === card.info.type){
                        G.currentCards[j].anchoredY = -28;
                        card.isSelected = true;
                        break;
                    }
                }
            }
            if(self.getReadyCardsKind()){
                self.playBtn.state = qc.UIState.NORMAL;
            } else {
                self.playBtn.state = qc.UIState.DISABLED;
            }
        }
    });

    // 不出按钮操作
    this.addListener(self.noCardBtn.onClick, function(){
        self.hideBtn();
        //收回所有牌
        for (var i = 0; i < G.currentCards.length ; i++) {
            if(G.currentCards[i].getScript('qc.engine.CardUI').isSelected){
                G.currentCards[i].anchoredY = 0;
                G.currentCards[i].getScript('qc.engine.CardUI').isSelected = false;
            }
        }
        self.cue.visible = false;
        self.game.add.clone(self.msgPrefab, self.ownCards);
        self.playCard(G.ownPlayer.nextPlayer);
    }, this);
};
/**
 * 判断玩家选中的牌是否是正确牌型，出牌需要符合规则，跟牌需要牌型可以大过上家
 * @method getReadyCardsKind
 * @return {Boolean}       [description]
 */
LandlordUI.prototype.getReadyCardsKind = function (){
    var self = this;
    self.readyCards = [];
    for (i = 0; i < G.currentCards.length ; i++) {
        if(G.currentCards[i].getScript('qc.engine.CardUI').isSelected){
            self.readyCards.push(G.currentCards[i].getScript('qc.engine.CardUI').info);
        }
    }
    if(self.readyCards.length === 0){
        return null;
    }

    var type = G.gameRule.typeJudge(self.readyCards);
    if(type){//正确牌型，出牌
        if(self.roundWinner && self.roundWinner.name != G.ownPlayer.name){//跟牌
            return (function (winc, ownc){//判断自己的牌是否合法且应该上家的牌
                //王炸大过任何牌
                //炸弹可大其他牌型
                //同牌型大
                if(ownc.cardKind === G.gameRule.KING_BOMB
                    || (ownc.cardKind === G.gameRule.BOMB && winc.cardKind != G.gameRule.BOMB)
                    || (ownc.cardKind === winc.cardKind && ownc.size === winc.size && ownc.val > winc.val)){
                    return type;
                }
                return null;
            }(self.winCard, type));
        } else {
            return type;
        }
    } else {
        return null;
    }
};

/**
 * 打出玩家的牌
 * @method function
 * @param  {[type]} cards [description]
 * @return {[type]}       [description]
 */
LandlordUI.prototype.addOwnCards = function(){
    var self = this,
        playedIndexs = [];
    self.cleanPlayArea();

    for (i = G.currentCards.length - 1; i >= 0 ; i--) {
        if(G.currentCards[i].getScript('qc.engine.CardUI').isSelected){
            G.currentCards[i].parent = self.ownCards;
            G.currentCards[i].interactive = false;
            self.ownCards.setChildIndex(G.currentCards[i], 0);
            G.currentCards.splice(i, 1);
            G.ownPlayer.cardList.splice(i, 1);
        }
    }
};

/**
 * 清空本人出牌区域
 */
LandlordUI.prototype.cleanPlayArea = function(){
    var own = this.ownCards.children;
    for (var i = 0; i < own.length; i++) {
        own[i].destroy();
    }
};

/**
 * 清空所有出牌区域
 */
LandlordUI.prototype.cleanAllPlayArea = function(){
    this.cleanPlayArea();
    var left = this.leftCards.children,
        right = this.rightCards.children;
    for (var i = 0; i < left.length; i++) {
        left[i].destroy();
    }
    for (i = 0; i < right.length; i++) {
        right[i].destroy();
    }
};
/**
 * 轮换出牌
 * @param  {Player} player 玩家
 */
LandlordUI.prototype.playCard = function (player){
    var self = this;
    if(player.isAI){
        console.info(player.name + '出牌中');
        var ai = new qc.landlord.AILogic(player);
        //ai.info();
        //根据下家是否是AI判断他的出牌区
        var area = player.nextPlayer.isAI ? self.rightCards : self.leftCards;
        for (var i = 0; i < area.children.length; i++) {//清空
            area.children[i].destroy();
        }
        //AI出牌
        self.game.timer.add(1000, function(){
            var result = null;
            if(!self.roundWinner || self.roundWinner.name == player.name){//如果本轮出牌赢牌是自己：出牌
                self.cleanAllPlayArea();
                result = ai.play();
            } else { //跟牌
                result = ai.follow();
            }
            if(result){
                for (i = 0; i < result.cardList.length ; i ++) {//将牌显示到出牌区域上
                    var c = self.game.add.clone(self.cardPrefab, area);
                    c.getScript('qc.engine.CardUI').show(result.cardList[i], false);
                    c.interactive = false;
                    for (var j = 0; j < player.cardList.length; j ++) {//删除手牌信息
                        if(player.cardList[j].val === result.cardList[i].val
                                && player.cardList[j].type === result.cardList[i].type){
                            player.cardList.splice(j, 1);
                            break;
                        }
                    }
                }
                if(result.cardKind === G.gameRule.BOMB || result.cardKind === G.gameRule.KING_BOMB){//出炸弹翻倍
                    var rate = parseInt(window.playUI.ratePanel.text);
                    window.playUI.ratePanel.text = (rate * 2) + '';
                }
                self.roundWinner = player;
                delete result.cardList;
                self.winCard = result;
                window.playUI.reDraw();
            } else {
                self.game.add.clone(self.msgPrefab, area);
            }
            if(player.cardList.length === 0){
                self.judgeWinner(player);
                return;
            }
            //继续下家出牌
            self.playCard(player.nextPlayer);
        });
    }
    else {
        console.info('该你出了');
        if(self.getReadyCardsKind()){
            self.playBtn.state = qc.UIState.NORMAL;
        } else {
            self.playBtn.state = qc.UIState.DISABLED;
        }
        self.playBtn.visible = true;
        self.warnBtn.visible = true;
            self.cleanPlayArea();
        if(!self.roundWinner || self.roundWinner.name == player.name){//如果本轮出牌赢牌是自己：出牌,不显示不出按钮
            //self.cleanAllPlayArea();
        } else {
            self.noCardBtn.visible = true;
        }
        //var ai = new qc.landlord.AILogic(player);
    }
}
/**
 * 隐藏打牌操作按钮
 * @param  {Player} player 玩家
 */
LandlordUI.prototype.hideBtn = function (){
    this.noCardBtn.visible = false;
    this.playBtn.visible = false;
    this.warnBtn.visible = false;
}
//判断胜利
LandlordUI.prototype.judgeWinner = function(winner){
    var self = this;
    self.hideBtn();
    //计算本局基本分
    var rs = parseInt(window.playUI.scorePanel.text) * parseInt(window.playUI.ratePanel.text);
    if(!winner.isAI || (!winner.isLandlord && !G.ownPlayer.isLandlord)){
        self.cue.text = '你赢了';
        if(G.ownPlayer.isLandlord){//玩家地主胜利
            G.ownPlayer.score = G.ownPlayer.score + rs * 2;
            G.leftPlayer.score = G.leftPlayer.score - rs;
            G.rightPlayer.score = G.rightPlayer.score - rs;
        } else if(winner.name == G.ownPlayer.name){//玩家是农民获胜
            G.ownPlayer.score = G.ownPlayer.score + rs;
            if(G.leftPlayer.isLandlord){
                G.leftPlayer.score = G.leftPlayer.score - rs * 2;
                G.rightPlayer.score = G.rightPlayer.score + rs;
            } else {
                G.leftPlayer.score = G.leftPlayer.score + rs;
                G.rightPlayer.score = G.rightPlayer.score - rs * 2;
            }
        } else {//玩家是农民，队友获胜
            G.ownPlayer.score = G.ownPlayer.score + rs;
            winner.score = winner.score + rs;
            G.playUI.currentLandlord.score = G.playUI.currentLandlord.score - 2 * rs;
        }
    } else {
        self.cue.text = '你输了';
        if(G.ownPlayer.isLandlord){//玩家地主输了
            G.ownPlayer.score = G.ownPlayer.score - rs * 2;
            G.leftPlayer.score = G.leftPlayer.score + rs;
            G.rightPlayer.score = G.rightPlayer.score + rs;
       } else {
            G.ownPlayer.score = G.ownPlayer.score - rs;
            if(G.leftPlayer.name === winner.name){//玩家不是地主输
                G.leftPlayer.score = G.leftPlayer.score + rs * 2;
                G.rightPlayer.score = G.rightPlayer.score - rs;
            } else {
                G.leftPlayer.score = G.leftPlayer.score - rs;
                G.rightPlayer.score = G.rightPlayer.score + rs * 2;
            }
        }
    }
    window.playUI.reDrawScore();
    self.cue.visible = true;
    //显示AI剩余手牌
    window.playUI.showAICards();
    //结束显示开始按钮
    window.playUI.startBtn.visible = true;
}
// Called every frame, if the behaviour is enabled.
//LandlordUI.prototype.update = function() {
//
//};

/**
 * 卡牌规则
 */
var CardUI = qc.defineBehaviour('qc.engine.CardUI', qc.Behaviour, function() {
    // need this behaviour be scheduled in editor
    this.isSelected = false;
    this.info = null;
}, {
    // fields need to be serialized
});

/**
  *显示纸牌，
  *@property info 卡牌信息，
  *@property isSelect 是否选中
  */
CardUI.prototype.show = function (info, isSelect){
    var self = this,
        o =self.gameObject;
    o.frame = info.icon;
    o.resetNativeSize();
    o.visible = true;
    self.info = info;
    //if(isSelect){
        //o.anchoredY = -28;
        //self.isSelected = true;
    //}
};

/**
  * 选中纸牌，纸牌上移
  */
CardUI.prototype.onClick = function (){
    var self = this;
    if(self.isSelected){
        this.gameObject.anchoredY = 0;
    } else {
        this.gameObject.anchoredY = -28;
    }
    self.isSelected = !self.isSelected;
    var ui = window.landlordUI;
    if(ui.getReadyCardsKind()){
        ui.playBtn.state = qc.UIState.NORMAL;
    } else {
        ui.playBtn.state = qc.UIState.DISABLED;
    }
};

// Called when the script instance is being loaded.
//CardUI.prototype.awake = function() {
//
//};

// Called every frame, if the behaviour is enabled.
//CardUI.prototype.update = function() {
//
//};

// 实现拖动选牌
var CardlistUI = qc.defineBehaviour('qc.engine.CardlistUI', qc.Behaviour, function() {
    // need this behaviour be scheduled in editor
    //this.runInEditor = true;
}, {
});

CardlistUI.prototype.onDragStart = function (e) {
    this.startX = this.gameObject.toLocal(new qc.Point(e.source.startX, e.source.startY)).x;
};

CardlistUI.prototype.onDrag = function (e){

};

CardlistUI.prototype.onDragEnd = function (e) {
    var self = this,
        endX = this.gameObject.toLocal(new qc.Point(e.source.x, e.source.y)).x;
    if(endX < self.startX){//如果开始比结束大，则是从右边往左拖动，交换起始数据
        var temp = endX;
        endX = self.startX;
        self.startX = temp;
    }
    for (var i = 0; i < this.gameObject.children.length; i++) {
        var card = this.gameObject.children[i],
            cardStartX = card.x,
            cardEndX = self.floatAdd(cardStartX, 30);
        var startDiff = self.floatSub(self.startX, cardStartX),
            endDiff = self.floatSub(cardEndX, endX);
        if((self.startX < cardStartX && endX > cardEndX)
            || (startDiff < 30 && startDiff >= 0)
            || (endDiff < 30 && endDiff >= 0) ){
            card.getScript('qc.engine.CardUI').onClick();
        }
    }
};
//浮点数加
CardlistUI.prototype.floatAdd = function (arg1,arg2){
    var r1,r2,m;
    try{r1=arg1.toString().split(".")[1].length;}catch(e){r1=0;}
    try{r2=arg2.toString().split(".")[1].length;}catch(e){r2=0;}
    m=Math.pow(10,Math.max(r1,r2));
    return (arg1*m+arg2*m)/m;
};
//浮点数减
CardlistUI.prototype.floatSub = function (arg1,arg2){
    var r1,r2,m,n;
    try{r1=arg1.toString().split(".")[1].length;}catch(e){r1=0;}
    try{r2=arg2.toString().split(".")[1].length;}catch(e){r2=0;}
    m=Math.pow(10,Math.max(r1,r2));
    //动态控制精度长度
    n=(r1>=r2)?r1:r2;
    return ((arg1*m-arg2*m)/m).toFixed(n);
};
// Called when the script instance is being loaded.
//CardlistUI.prototype.awake = function() {
//
//};

// Called every frame, if the behaviour is enabled.
//CardlistUI.prototype.update = function() {
//
//};

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
    //上一家
    //self.prePlayer = null;
};
Object.defineProperties(Player.prototype, {
    score: {
        get: function(){
            console.info(this.name,'分数：',this._score);
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

//游戏规则
var GameRule = qc.landlord.GameRule = function() {

};

/**
 * 牌型判断
 * @method function
 * @param  {[type]} cards [description]
 * @return {[type]}       [description]
 */
GameRule.prototype.typeJudge = function(cards){
    var self = this,
        len = cards.length;
    switch (len) {
        case 1:
            return {'cardKind': self.ONE, 'val': cards[0].val, 'size': len};
        case 2:
            if(self.isPairs(cards))
                return {'cardKind': self.PAIRS, 'val': cards[0].val, 'size': len};
            else if (self.isKingBomb(cards))
                return {'cardKind': self.KING_BOMB, 'val': cards[0].val, 'size': len};
            else
                return null;
        case 3:
            if(self.isThree(cards))
                return {'cardKind': self.THREE, 'val': cards[0].val, 'size': len};
            else
                return null;
        case 4:
            if(self.isThreeWithOne(cards)){
                return {'cardKind': self.THREE_WITH_ONE, 'val': self.getMaxVal(cards, 3), 'size': len};
            } else if (self.isBomb(cards)) {
                return {'cardKind': self.BOMB, 'val': cards[0].val, 'size': len};
            }
            return null;
        default:
            if(self.isProgression(cards))
                return {'cardKind': self.PROGRESSION, 'val': cards[0].val, 'size': len};
            else if(self.isProgressionPairs(cards))
                return {'cardKind': self.PROGRESSION_PAIRS, 'val': cards[0].val, 'size': len};
            else if(self.isThreeWithPairs(cards))
                return {'cardKind': self.THREE_WITH_PAIRS, 'val': self.getMaxVal(cards, 3), 'size': len};
            else if(self.isPlane(cards))
                return {'cardKind': self.PLANE, 'val': self.getMaxVal(cards, 3), 'size': len};
            else if(self.isPlaneWithOne(cards))
                return {'cardKind': self.PLANE_WITH_ONE, 'val': self.getMaxVal(cards, 3), 'size': len};
            else if(self.isPlaneWithPairs(cards))
                return {'cardKind': self.PLANE_WITH_PAIRS, 'val': self.getMaxVal(cards, 3), 'size': len};
            else if(self.isFourWithTwo(cards))
                return {'cardKind': self.FOUR_WITH_TWO, 'val': self.getMaxVal(cards, 4), 'size': len};
            else if(self.isFourWithPairs(cards))
                return {'cardKind': self.FOUR_WITH_TWO_PAIRS, 'val': self.getMaxVal(cards, 4), 'size': len};
            else
                return null;

    }

};
//是否是对子
GameRule.prototype.isPairs = function(cards) {
    return cards.length == 2 && cards[0].val === cards[1].val;
};
//是否是三根
GameRule.prototype.isThree = function(cards) {
    return cards.length == 3 && cards[0].val === cards[1].val && cards[1].val === cards[2].val;
};
//是否是三带一
GameRule.prototype.isThreeWithOne = function(cards) {
    if(cards.length != 4) return false;
    var c = this.valCount(cards);
    return c.length === 2 && (c[0].count === 3 || c[1].count === 3);
};
//是否是三带一对
GameRule.prototype.isThreeWithPairs = function(cards) {
    if(cards.length != 5) return false;
    var c = this.valCount(cards);
    return c.length === 2 && (c[0].count === 3 || c[1].count === 3);
};
//是否是顺子
GameRule.prototype.isProgression = function(cards) {
    if(cards.length < 5 || cards[0].val === 15) return false;
    for (var i = 0; i < cards.length; i++) {
        if(i != (cards.length - 1) && (cards[i].val - 1) != cards[i + 1].val){
            return false;
        }
    }
    return true;
};
//是否是连对
GameRule.prototype.isProgressionPairs = function(cards) {
    if(cards.length < 6 || cards.length % 2 != 0 || cards[0].val === 15) return false;
    for (var i = 0; i < cards.length; i += 2) {
        if(i != (cards.length - 2) && (cards[i].val != cards[i + 1].val || (cards[i].val - 1) != cards[i + 2].val)){
            return false;
        }
    }
    return true;
};
//是否是飞机
GameRule.prototype.isPlane = function(cards) {
    if(cards.length < 6 || cards.length % 3 != 0 || cards[0].val === 15) return false;
    for (var i = 0; i < cards.length; i += 3) {
        if(i != (cards.length - 3) && (cards[i].val != cards[i + 1].val || cards[i].val != cards[i + 2].val || (cards[i].val - 1) != cards[i + 3].val)){
            return false;
        }
    }
    return true;
};
//是否是飞机带单
GameRule.prototype.isPlaneWithOne = function(cards) {
    if(cards.length < 8 || cards.length % 4 != 0) return false;
    var c = this.valCount(cards),
        threeList = [],
        threeCount = cards.length / 4;
    for (var i = 0; i < c.length; i++) {
        if(c[i].count == 3){
            threeList.push(c[i]);
        }
    }
    if(threeList.length != threeCount || threeList[0].val === 15){//检测三根数量和不能为2
        return false;
    }
    for (i = 0; i < threeList.length; i++) {//检测三根是否连续
        if(i != threeList.length - 1 && threeList[i].val - 1 != threeList[i + 1].val){
            return false;
        }
    }
    return true;
};
//是否是飞机带对
GameRule.prototype.isPlaneWithPairs = function(cards) {
    if(cards.length < 10 || cards.length % 5 != 0) return false;
    var c = this.valCount(cards),
        threeList = [],
        pairsList = [],
        groupCount = cards.length / 5;
    for (var i = 0; i < c.length; i++) {
        if(c[i].count == 3){
            threeList.push(c[i]);
        }
        else if(c[i].count == 2){
            pairsList.push(c[i]);
        } else {
            return false;
        }
    }
    if(threeList.length != groupCount || pairsList.length != groupCount || threeList[0].val === 15){//检测三根数量和对子数量和不能为2
        return false;
    }
    for (i = 0; i < threeList.length; i++) {//检测三根是否连续
        if(i != threeList.length - 1 && threeList[i].val - 1 != threeList[i + 1].val){
            return false;
        }
    }
    return true;
};
//是否是四带二
GameRule.prototype.isFourWithTwo = function(cards) {
    var c = this.valCount(cards);
    if(cards.length != 6 || c.length > 3) return false;
    for (var i = 0; i < c.length; i++) {
        if(c[i].count === 4)
            return true;
    }
    return false;
};
//是否是四带两个对
GameRule.prototype.isFourWithPairs = function(cards) {
    if(cards.length != 8) return false;
    var c = this.valCount(cards);
    if(c.length != 3) return false;
    for (var i = 0; i < c.length; i++) {
        if(c[i].count != 4 && c[i].count != 2)
            return false;
    }
    return true;
};
//是否是炸弹
GameRule.prototype.isBomb = function(cards) {
    return cards.length === 4 && cards[0].val === cards[1].val && cards[0].val === cards[2].val && cards[0].val === cards[3].val;
};
//是否是王炸
GameRule.prototype.isKingBomb = function(cards) {
    return cards.length === 2 && cards[0].type == '0' && cards[1].type == '0';
};
/**
 * 获取min到max之间的随机整数，min和max值都取得到
 * @param  {number} min - 最小值
 * @param  {number} max - 最大值
 * @return {number}
 */
GameRule.prototype.random = function(min, max) {
	min = min == null ? 0 : min;
	max = max == null ? 1 : max;
	var delta = (max - min) + 1;
	return Math.floor(Math.random() * delta + min);
};

/**
 * 牌统计，统计各个牌有多少张，比如2张A，一张8
 * @param  {list} cards - 要统计的牌
 * @return {object array} val：值，count：数量
 */
GameRule.prototype.valCount = function(cards){
    var result = [];
    var addCount = function(result , v){
        for (var i = 0; i < result.length; i++) {
            if(result[i].val == v){
                result[i].count ++;
                return;
            }
        }
        result.push({'val': v, 'count': 1});
    };
    for (var i = 0; i < cards.length; i++){
        addCount(result, cards[i].val);
    }
    return result;
};
/**
 * 获取指定张数的最大牌值
 * @param  {list} cards - 牌
 * @param  {list} cards - 张数
 * @return 值
 */
GameRule.prototype.getMaxVal = function(cards, n){
    var c = this.valCount(cards);
    var max = 0;
    for (var i = 0; i < c.length; i++) {
        if(c[i].count === n && c[i].val > max){
            max = c[i].val;
        }
    }
    return max;
};
/**
 * 牌型枚举
 */
GameRule.prototype.ONE = 1;
GameRule.prototype.PAIRS = 2;
GameRule.prototype.THREE = 3;
GameRule.prototype.THREE_WITH_ONE = 4;
GameRule.prototype.THREE_WITH_PAIRS = 5;
GameRule.prototype.PROGRESSION = 6;
GameRule.prototype.PROGRESSION_PAIRS = 7;
GameRule.prototype.PLANE = 8;
GameRule.prototype.PLANE_WITH_ONE = 9;
GameRule.prototype.PLANE_WITH_PAIRS = 10;
GameRule.prototype.FOUR_WITH_TWO = 11;
GameRule.prototype.FOUR_WITH_TWO_PAIRS = 12;
GameRule.prototype.BOMB = 13;
GameRule.prototype.KING_BOMB = 14;
/**
 * 错误提示
 */
GameRule.prototype.MSG_NO_SELECT = '请选择要出的牌';
GameRule.prototype.MSG_ERROR_TYPE = '您选择的牌不符合游戏规则';
GameRule.prototype.MSG_NO_ROROB_RESTART = '所有玩家均未叫分，重新发牌';

// define a user behaviour
var Card = qc.landlord.Card = function (){
    this.data = [
        {icon: 'j1.jpg', type: '0', val: 17},
        {icon: 'j2.jpg', type: '0', val: 16},
        {icon: 't1.jpg', type: '1', val: 14},
        {icon: 't2.jpg', type: '1', val: 15},
        {icon: 't3.jpg', type: '1', val: 3},
        {icon: 't4.jpg', type: '1', val: 4},
        {icon: 't5.jpg', type: '1', val: 5},
        {icon: 't6.jpg', type: '1', val: 6},
        {icon: 't7.jpg', type: '1', val: 7},
        {icon: 't8.jpg', type: '1', val: 8},
        {icon: 't9.jpg', type: '1', val: 9},
        {icon: 't10.jpg', type: '1', val: 10},
        {icon: 't11.jpg', type: '1', val: 11},
        {icon: 't12.jpg', type: '1', val: 12},
        {icon: 't13.jpg', type: '1', val: 13},
        {icon: 'x1.jpg', type: '2', val: 14},
        {icon: 'x2.jpg', type: '2', val: 15},
        {icon: 'x3.jpg', type: '2', val: 3},
        {icon: 'x4.jpg', type: '2', val: 4},
        {icon: 'x5.jpg', type: '2', val: 5},
        {icon: 'x6.jpg', type: '2', val: 6},
        {icon: 'x7.jpg', type: '2', val: 7},
        {icon: 'x8.jpg', type: '2', val: 8},
        {icon: 'x9.jpg', type: '2', val: 9},
        {icon: 'x10.jpg', type: '2', val: 10},
        {icon: 'x11.jpg', type: '2', val: 11},
        {icon: 'x12.jpg', type: '2', val: 12},
        {icon: 'x13.jpg', type: '2', val: 13},
        {icon: 'h1.jpg', type: '3', val: 14},
        {icon: 'h2.jpg', type: '3', val: 15},
        {icon: 'h3.jpg', type: '3', val: 3},
        {icon: 'h4.jpg', type: '3', val: 4},
        {icon: 'h5.jpg', type: '3', val: 5},
        {icon: 'h6.jpg', type: '3', val: 6},
        {icon: 'h7.jpg', type: '3', val: 7},
        {icon: 'h8.jpg', type: '3', val: 8},
        {icon: 'h9.jpg', type: '3', val: 9},
        {icon: 'h10.jpg', type: '3', val: 10},
        {icon: 'h11.jpg', type: '3', val: 11},
        {icon: 'h12.jpg', type: '3', val: 12},
        {icon: 'h13.jpg', type: '3', val: 13},
        {icon: 'k1.jpg', type: '4', val: 14},
        {icon: 'k2.jpg', type: '4', val: 15},
        {icon: 'k3.jpg', type: '4', val: 3},
        {icon: 'k4.jpg', type: '4', val: 4},
        {icon: 'k5.jpg', type: '4', val: 5},
        {icon: 'k6.jpg', type: '4', val: 6},
        {icon: 'k7.jpg', type: '4', val: 7},
        {icon: 'k8.jpg', type: '4', val: 8},
        {icon: 'k9.jpg', type: '4', val: 9},
        {icon: 'k10.jpg', type: '4', val: 10},
        {icon: 'k11.jpg', type: '4', val: 11},
        {icon: 'k12.jpg', type: '4', val: 12},
        {icon: 'k13.jpg', type: '4', val: 13}
    ];
};
//拷贝牌组，返回一组新的牌组
Card.prototype.getNewCards = function () {
    return this.data.slice(0);
};

// ai牌型类
var AICardType = qc.landlord.AICardType = function(v, list){
	this.val = v;
    this.cardList = list;
};

// Called when the script instance is being loaded.
//AICardType.prototype.awake = function() {
//
//};

// Called every frame, if the behaviour is enabled.
//AICardType.prototype.update = function() {
//
//};

/**
 * AI逻辑
 *
 */
var AILogic = qc.landlord.AILogic = function (p){
    this.player = p;
    this.cards = p.cardList.slice(0);
    this.analyse();
};

/**
 * 跟牌,AI根据上家牌出牌
 * @method function
 * @return {array} [description]
 */
AILogic.prototype.follow = function() {
    var self = this,
        winc = window.landlordUI.winCard;
    self.log();
    //如果有炸弹，根据牌数量确定是否出
    if(winc.cardKind != G.gameRule.BOMB && winc.cardKind != G.gameRule.KING_BOMB
        && (self._bomb.length > 0 || self._kingBomb.length > 0)){
        var rw = window.landlordUI.roundWinner;
        if((rw.isLandlord && rw.cardList.length < 5)
            || (self.player.isLandlord && (self.player.cardList.length < 5 || (self.player.nextPlayer.cardList.length < 5 || self.player.nextPlayer.nextPlayer.cardList.length < 6))) || self.times() <= 3){
            if(self._bomb.length > 0){
                return self.minCards(self._bomb, G.gameRule.BOMB);
            } else {
                return self.setCardKind(self._kingBomb[0], G.gameRule.KING_BOMB);
            }
        }
    }
    switch (winc.cardKind) {//判断牌型
        case G.gameRule.ONE://单牌
            var one = self.matchCards(self._one, G.gameRule.ONE);
            if(!one){
                if(window.landlordUI.roundWinner.isLandlord || self.player.isLandlord){
                    for (var i = 0; i < self.cards.length; i++) {
                        if(self.cards[i].val <= 15 && self.cards[i].val > winc.val){
                            return {cardList: self.cards.slice(i, i + 1),
                                cardKind: G.gameRule.ONE,
                                size: 1,
                                val: self.cards.slice(i, i + 1)[0].val};
                        }
                    }
                }
                if(self.times <= 1 && self._pairs.length > 0 && self._pairs[0].val > 10){//剩下一对大于10拆牌
                    var c = self.cards.slice(0, 1);
                    if(c[0].val > winc.val){
                        return {cardList: c,
                            cardKind: G.gameRule.ONE,
                            size: 1,
                            val: c[0].val};
                    } else {
                        return null;
                    }
                }
            }
            return one;
        case G.gameRule.PAIRS://对子
            var pairs =  self._pairs.length > 0 ? self.matchCards(self._pairs, G.gameRule.PAIRS) : null;
            if(pairs == null && (window.landlordUI.roundWinner.isLandlord || self.player.isLandlord)){//对手需要拆牌大之
                //从连对中拿对
                if(self._progressionPairs.length > 0){
                    for (var i = self._progressionPairs.length - 1; i >= 0 ; i--) {
                        if(winc.val >= self._progressionPairs[i].val) continue;
                        for (var j =  self._progressionPairs[i].cardList.length - 1 ; j >= 0; j -= 2) {
                            if(self._progressionPairs[i].cardList[j].val > winc.val){
                                var pairsFromPP = self._progressionPairs[i].cardList.splice(j - 1,2);
                                return {cardList: pairsFromPP,
                                        cardKind: G.gameRule.PAIRS,
                                        size: 2,
                                        val: pairsFromPP[0].val};
                            }
                        }
                    }
                } else if(self._three.length > 0){
                    for (var i = self._three.length - 1; i >= 0 ; i--) {
                        if(self._three[i].val > winc.val){
                            return {cardList: self._three[i].cardList.slice(0, 2),
                                    cardKind: G.gameRule.PAIRS,
                                    size: 2,
                                    val: self._three[i].val};
                        }
                    }
                }
            }
            return pairs;
        case G.gameRule.THREE://三根
            if(!window.landlordUI.roundWinner.isLandlord && !self.player.isLandlord){
                return null;
            }
            return self.matchCards(self._three, G.gameRule.THREE);

        case G.gameRule.THREE_WITH_ONE://三带一
            if(!window.landlordUI.roundWinner.isLandlord && !self.player.isLandlord){
                return null;
            }
            var three = self.minCards(self._three, G.gameRule.THREE, winc.val);
            if(three){
                var one = self.minOne(2, three.val);
                if(!one){
                    return null;
                } else {
                    three.cardList.push(one);
                }
                three.cardKind = G.gameRule.THREE_WITH_ONE;
                three.size = 4;
            }
            return three;

        case G.gameRule.THREE_WITH_PAIRS: //三带一对
            if(!window.landlordUI.roundWinner.isLandlord && !self.player.isLandlord){
                return null;
            }
            var three = self.minCards(self._three, G.gameRule.THREE, winc.val);
            if(three){
                var pairs = self.minCards(self._pairs, G.gameRule.PAIRS);
                while (true) {//避免对子三根重叠
                    if(pairs.cardList[0].val === three.val){
                        pairs = self.minCards(self._pairs, G.gameRule.PAIRS, pairs.cardList[0].val);
                    } else {
                        break;
                    }
                }
                if(pairs){
                    three.cardList = three.cardList.concat(pairs.cardList);
                } else {
                    return null;
                }
            }
            return three;

        case G.gameRule.PROGRESSION://顺子
            if(!window.landlordUI.roundWinner.isLandlord && !self.player.isLandlord){
                return null;
            }
            if(self._progression.length > 0){
                for (var i = self._progression.length - 1; i >= 0 ; i--) {//从小值开始判断
                    if(winc.val < self._progression[i].val && winc.size <= self._progression[i].cardList.length){
                        if(winc.size === self._progression[i].cardList.length){
                            return self.setCardKind(self._progression[i], G.gameRule.PROGRESSION);
                        } else {
                            if(self.player.isLandlord || window.landlordUI.roundWinner.isLandlord){
                                var valDiff = self._progression[i].val - winc.val,
                                    sizeDiff = self._progression[i].cardList.length - winc.size;
                                for (var j = 0; j < sizeDiff; j++) {//拆顺
                                    if(valDiff > 1){
                                        self._progression[i].cardList.shift();
                                        valDiff -- ;
                                        continue;
                                    }
                                    self._progression[i].cardList.pop();
                                }
                                return self.setCardKind(self._progression[i], G.gameRule.PROGRESSION);
                            } else {
                                return null;
                            }
                        }
                    }
                }
            }
            return null;

        case G.gameRule.PROGRESSION_PAIRS://连对
            if(!window.landlordUI.roundWinner.isLandlord && !self.player.isLandlord){
                return null;
            }
            if(self._progressionPairs.length > 0){
                for (var i = self._progressionPairs.length - 1; i >= 0 ; i--) {//从小值开始判断
                    if(winc.val < self._progressionPairs[i].val && winc.size <= self._progressionPairs[i].cardList.length){
                        if(winc.size === self._progressionPairs[i].cardList.length){
                            return self.setCardKind(self._progressionPairs[i], G.gameRule.PROGRESSION_PAIRS);
                        } else {
                            if(self.player.isLandlord || window.landlordUI.roundWinner.isLandlord){
                                var valDiff = self._progressionPairs[i].val - winc.val,
                                    sizeDiff = (self._progressionPairs[i].cardList.length - winc.size) / 2;
                                for (var j = 0; j < sizeDiff; j++) {//拆顺
                                    if(valDiff > 1){
                                        self._progressionPairs[i].cardList.shift();
                                        self._progressionPairs[i].cardList.shift();
                                        valDiff -- ;
                                        continue;
                                    }
                                    self._progressionPairs[i].cardList.pop();
                                    self._progressionPairs[i].cardList.pop();
                                }
                                return self.setCardKind(self._progressionPairs[i], G.gameRule.PROGRESSION_PAIRS);
                            } else {
                                return null;
                            }
                        }
                    }
                }
            }
            return null;

        case G.gameRule.PLANE://三顺
            if(!window.landlordUI.roundWinner.isLandlord && !self.player.isLandlord){
                return null;
            }
            return self.minPlane(winc.size);
        case G.gameRule.PLANE_WITH_ONE: //飞机带单
            if(!window.landlordUI.roundWinner.isLandlord && !self.player.isLandlord){
                return null;
            }
            var cnt = winc.size / 4,
                plane = self.minPlane(cnt * 3);
            if(plane){
                var currOneVal = 2;
                for (var i = 0; i < cnt; i++) {
                    var one = self.minOne(currOneVal, plane.val);//拿一张单牌
                    if(one){
                        plane.cardList.push(one);
                        currOneVal = one.val;
                    } else {
                        return null;
                    }
                }
                plane.cardKind = G.gameRule.PLANE_WITH_ONE;
                plane.size = plane.cardList.length;
            }
            return plane;
        case G.gameRule.PLANE_WITH_PAIRS://飞机带对
            if(!window.landlordUI.roundWinner.isLandlord && !self.player.isLandlord){
                return null;
            }
            var cnt = winc.size / 5,
                plane = self.minPlane(cnt * 3);
            if(plane){
                var currPairsVal = 2;
                for (var i = 0; i < cnt; i++) {
                    var pairs = self.minCards(self._pairs, G.gameRule.PAIRS, currPairsVal);//拿一对
                    if(pairs){
                        plane.cardList = plane.cardList.concat(pairs.cardList);
                        currPairsVal = pairs.val;
                    } else {
                        return null;
                    }
                }
                plane.cardKind = G.gameRule.PLANE_WITH_PAIRS;
                plane.size = plane.cardList.length;
            }
            return plane;

        case G.gameRule.BOMB://炸弹
            var rw = window.landlordUI.roundWinner;
            if(!rw.isLandlord && !self.player.isLandlord){//同是农民不压炸弹
                return null;
            }
            var bomb = self.minCards(self._bomb, G.gameRule.BOMB, winc.val);
            if(bomb){
                return bomb;
            } else {
                if(self._kingBomb.length > 0){
                    if((rw.isLandlord && rw.cardList.length < 6)
                        || (self.player.isLandlord && self.player.cardList.length < 6)){
                        return self.setCardKind(self._kingBomb[0], G.gameRule.KING_BOMB);
                    }
                }
                return null;
            }
        case G.gameRule.FOUR_WITH_TWO:
            return self.minCards(self._bomb, G.gameRule.BOMB, winc.val);
        case G.gameRule.FOUR_WITH_TWO_PAIRS:
            return self.minCards(self._bomb, G.gameRule.BOMB, winc.val);
        case G.gameRule.KING_BOMB:
            return null;
        default:
            return null;
    }
};

/**
 * 出牌,默认出包含最小牌的牌
 * @method function
 * @return {array} [description]
 */
AILogic.prototype.play = function() {
    var self = this;
    self.log();
    var cardsWithMin = function (idx){
        var minCard = self.cards[idx];
        //在单根里找
        for (var i = 0; i < self._one.length; i++) {
            if(self._one[i].val === minCard.val){
                return self.minCards(self._one, G.gameRule.ONE);
            }
        }
        //对子里找
        for (i = 0; i < self._pairs.length; i++) {
            if(self._pairs[i].val === minCard.val){
                return self.minCards(self._pairs, G.gameRule.PAIRS);
            }
        }
        //三根里找
        for (i = 0; i < self._three.length; i++) {
            if(self._three[i].val === minCard.val){
                return self.minCards(self._three, G.gameRule.THREE);
            }
        }
        //炸弹里找
        for (i = 0; i < self._bomb.length; i++) {
            if(self._bomb[i].val === minCard.val){
                return self.minCards(self._bomb, G.gameRule.BOMB);
            }
        }
        //三顺里找
        for (i = 0; i < self._plane.length; i++) {
            for (var j = 0; j < self._plane[i].cardList.length; j++) {
                if(self._plane[i].cardList[j].val === minCard.val && self._plane[i].cardList[j].type === minCard.type ){
                    return self.minCards(self._plane, G.gameRule.PLANE);
                }
            }
        }
        //顺子里找
        for (i = 0; i < self._progression.length; i++) {
            for (var j = 0; j < self._progression[i].cardList.length; j++) {
                if(self._progression[i].cardList[j].val === minCard.val && self._progression[i].cardList[j].type === minCard.type ){
                    return self.minCards(self._progression, G.gameRule.PROGRESSION);
                }
            }
        }
        //连对里找
        for (i = 0; i < self._progressionPairs.length; i++) {
            for (var j = 0; j < self._progressionPairs[i].cardList.length; j++) {
                if(self._progressionPairs[i].cardList[j].val === minCard.val && self._progressionPairs[i].cardList[j].type === minCard.type ){
                    return self.minCards(self._progressionPairs, G.gameRule.PROGRESSION_PAIRS);
                }
            }
        }
    };
    for (var i = self.cards.length - 1; i >=0 ; i--) {
        var r = cardsWithMin(i);
        if(r.cardKind === G.gameRule.ONE){
            if(self._plane.length > 0){//三顺
                var plane = self.minCards(self._plane, G.gameRule.PLANE);
                var len = plane.cardList.length / 3;
                var currOneVal = 2;
                for (var i = 0; i < len; i++) {
                    var one = self.minOne(currOneVal, plane.val);//拿一张单牌
                    plane.cardList.push(one);
                    currOneVal = one.val;
                }
                return self.setCardKind( plane, G.gameRule.PLANE_WITH_ONE);
            }
            else if(self._three.length > 0){//三带一
                var three = self.minCards(self._three, G.gameRule.THREE);
                var len = three.cardList.length / 3;
                var one = self.minOne(currOneVal, three.val);//拿一张单牌
                three.cardList.push(one);
                if(three.val < 14)
                    return self.setCardKind( three, G.gameRule.THREE_WITH_ONE);
            }
            if(self.player.isLandlord){//坐庄打法
                if(self.player.isLandlord){//坐庄打法
                    if(self.player.nextPlayer.cardList.length <= 2 || self.player.nextPlayer.nextPlayer.cardList.length <= 2 )
                        return self.playOneAtTheEnd();
                    else
                        return self.minCards(self._one, G.gameRule.ONE);
                }
            } else {//偏家打法
                if(window.playUI.currentLandlord.cardList.length <= 2)
                    return self.playOneAtTheEnd();
                else
                    return self.minCards(self._one, G.gameRule.ONE);
            }
        } else if(r.cardKind === G.gameRule.THREE){
            var three = self.minCards(self._three, G.gameRule.THREE);
            var len = three.cardList.length / 3;
            if(self._one.length >= 0){//单根多带单
                var one = self.minOne(currOneVal, three.val);//拿一张单牌
                three.cardList.push(one);
                return self.setCardKind( three, G.gameRule.THREE_WITH_ONE);
            } else if(self._pairs.length > 0){
                var pairs = self.minCards(self._pairs, G.gameRule.PAIRS, currPairsVal);//拿一对
                three.cardList = three.cardList.concat(pairs.cardList);
                return self.setCardKind( three, G.gameRule.THREE_WITH_PAIRS);
            } else {
                return self.setCardKind( three, G.gameRule.THREE);
            }
        } else if(r.cardKind === G.gameRule.PLANE){
            var plane = self.minCards(self._plane, G.gameRule.PLANE);
            var len = plane.cardList.length / 3;
            if(self._one.length > len && self._pairs.length > len){
                if(self._one.length >= self._pairs.length){//单根多带单
                    var currOneVal = 2;
                    for (var i = 0; i < len; i++) {
                        var one = self.minOne(currOneVal, plane.val);//拿一张单牌
                        plane.cardList.push(one);
                        currOneVal = one.val;
                    }
                    return self.setCardKind( plane, G.gameRule.PLANE_WITH_ONE);
                } else {
                    var currPairsVal = 2;
                    for (var i = 0; i < len; i++) {
                        var pairs = self.minCards(self._pairs, G.gameRule.PAIRS, currPairsVal);//拿一对
                        plane.cardList = plane.cardList.concat(pairs.cardList);
                        currPairsVal = pairs.val;
                    }
                    return self.setCardKind( plane, G.gameRule.PLANE_WITH_PAIRS);
                }
            } else if(self._pairs.length > len){
                var currPairsVal = 2;
                for (var i = 0; i < len; i++) {
                    var pairs = self.minCards(self._pairs, G.gameRule.PAIRS, currPairsVal);//拿一对
                    plane.cardList = plane.cardList.concat(pairs.cardList);
                    currPairsVal = pairs.val;
                }
                return self.setCardKind( plane, G.gameRule.PLANE_WITH_PAIRS);
            } else if(self._one.length > len){
                var currOneVal = 2;
                for (var i = 0; i < len; i++) {
                    var one = self.minOne(currOneVal, plane.val);//拿一张单牌
                    plane.cardList.push(one);
                    currOneVal = one.val;
                }
                return self.setCardKind( plane, G.gameRule.PLANE_WITH_ONE);
            } else {
                return self.setCardKind( plane, G.gameRule.PLANE);
            }
        }else if(r.cardKind === G.gameRule.BOMB && self.times() === 1){
            return r;
        } else if(r.cardKind === G.gameRule.BOMB && self.times() != 1){
            continue;
        } else {
            return r;
        }
    }
};
//出牌将单根放最后出牌
AILogic.prototype.playOneAtTheEnd  = function() {
    var self = this;
    if(self._progression.length > 0){//出顺子
        return self.minCards(self._progression, G.gameRule.PROGRESSION);
    }
    else if(self._plane.length > 0){//三顺
        var plane = self.minCards(self._plane, G.gameRule.PLANE);
        var len = plane.cardList.length / 3;
        if(self._one.length > len && self._pairs.length > len){
            if(self._one.length >= self._pairs.length){//单根多带单
                var currOneVal = 2;
                for (var i = 0; i < len; i++) {
                    var one = self.minOne(currOneVal, plane.val);//拿一张单牌
                    plane.cardList.push(one);
                    currOneVal = one.val;
                }
                return self.setCardKind( plane, G.gameRule.PLANE_WITH_ONE);
            } else {
                var currPairsVal = 2;
                for (var i = 0; i < len; i++) {
                    var pairs = self.minCards(self._pairs, G.gameRule.PAIRS, currPairsVal);//拿一对
                    plane.cardList = plane.cardList.concat(pairs.cardList);
                    currPairsVal = pairs.val;
                }
                return self.setCardKind( plane, G.gameRule.PLANE_WITH_PAIRS);
            }
        } else if(self._pairs.length > len){
            var currPairsVal = 2;
            for (var i = 0; i < len; i++) {
                var pairs = self.minCards(self._pairs, G.gameRule.PAIRS, currPairsVal);//拿一对
                plane.cardList = plane.cardList.concat(pairs.cardList);
                currPairsVal = pairs.val;
            }
            return self.setCardKind( plane, G.gameRule.PLANE_WITH_PAIRS);
        } else if(self._one.length > len){
            var currOneVal = 2;
            for (var i = 0; i < len; i++) {
                var one = self.minOne(currOneVal, plane.val);//拿一张单牌
                plane.cardList.push(one);
                currOneVal = one.val;
            }
            return self.setCardKind( plane, G.gameRule.PLANE_WITH_ONE);
        } else {
            return self.setCardKind( plane, G.gameRule.PLANE);
        }
    }
    else if(self._progressionPairs.length > 0){//出连对
        return self.minCards(self._progressionPairs, G.gameRule.PROGRESSION_PAIRS);
    }
    else if(self._three.length > 0){//三根、三带一、三带对
        var three = self.minCards(self._three, G.gameRule.THREE);
        var len = three.cardList.length / 3;
        if(self._one.length >= 0){//单根多带单
            var one = self.minOne(currOneVal, three.val);//拿一张单牌
            three.cardList.push(one);
            return self.setCardKind( three, G.gameRule.THREE_WITH_ONE);
        } else if(self._pairs.length > 0){
            var pairs = self.minCards(self._pairs, G.gameRule.PAIRS, currPairsVal);//拿一对
            three.cardList = three.cardList.concat(pairs.cardList);
            return self.setCardKind( three, G.gameRule.THREE_WITH_PAIRS);
        } else {
            return self.setCardKind( three, G.gameRule.THREE);
        }
    }
    else if(self._pairs.length > 0){//对子
        if((self.player.isLandlord && (self.player.nextPlayer.cardList.length === 2 || self.player.nextPlayer.nextPlayer.cardList.length === 2))
            || (!self.player.isLandlord && window.playUI.currentLandlord.cardList.length === 2))
            return self.maxCards(self._pairs, G.gameRule.PAIRS);
        else
            return self.minCards(self._pairs, G.gameRule.PAIRS);
    }
    else if(self._one.length > 0 ){//出单牌
        if((self.player.isLandlord && (self.player.nextPlayer.cardList.length <= 2 || self.player.nextPlayer.nextPlayer.cardList.length <= 2))
            || (!self.player.isLandlord && window.playUI.currentLandlord.cardList.length <= 2))
            return self.maxCards(self._one, G.gameRule.ONE);
        else
            return self.minCards(self._one, G.gameRule.ONE);
    } else {//都计算无结果出最小的那张牌
        var one = null;
        if((self.player.isLandlord && (self.player.nextPlayer.cardList.length <= 2 || self.player.nextPlayer.nextPlayer.cardList.length <= 2))
            || (!self.player.isLandlord && window.playUI.currentLandlord.cardList.length <= 2))
            one = self.cards.slice(self.cards.length - 1, self.cards.length);
        else
            one = self.cards.slice(0, 1);
        return {
            size : 1,
            cardKind: G.gameRule.ONE,
            cardList: one,
            val: one[0].val
        };
    }
};
/**
 * 获取指定张数的最小牌值
 * @param  {list} cards - 牌
 * @param  {number} n - 张数
 * @param  {number} n - 需要大过的值
 * @return 值
 */
AILogic.prototype.getMinVal = function(n, v){
    var self = this,
        c = G.gameRule.valCount(self.cards);
    for (var i = c.length - 1; i >= 0; i--) {
        if(c[i].count === n  && c[i].val > v){
            return self.cards.splice(i, 1);
        }
    }
};

/**
 * 牌型分析
 * @method function
 * @return {[type]} [description]
 */
AILogic.prototype.analyse = function(){
    var self = this,
        target = self.cards.slice(0),//拷贝一份牌来分析
        stat = null,//统计信息
        targetWob = null,//除去炸弹之后的牌组
        targetWobt = null,//除去炸弹、三根之后的牌组
        targetWobp = null,//除去炸弹、顺子之后的牌组
        targetWobpp = null;//除去炸弹、连对之后的牌组
    //定义牌型
    self._one = [];
    self._pairs =[];
    self._kingBomb = [];
    self._bomb = [];
    self._three = [];
    self._plane = [];
    self._progression = [];
    self._progressionPairs = [];
    target.sort(self.cardSort);
    //判定王炸
    if(G.gameRule.isKingBomb(target.slice(0,2))){
        self._kingBomb.push(new qc.landlord.AICardType(17, target.splice(0, 2)));
    }
    //判定炸弹
    stat = G.gameRule.valCount(target);
    for (var i = 0; i < stat.length; i++) {
        if(stat[i].count === 4){
            var list = [];
            self.moveItem(target, list, stat[i].val);
            self._bomb.push(new qc.landlord.AICardType(list[0].val, list));
        }
    }
    targetWob = target.slice(0);
    //判定三根，用于判定三顺
    targetWobt = targetWob.slice(0);
    self.judgeThree(targetWobt);
    //判定三顺(飞机不带牌)
    self.judgePlane();

    //把三根加回用于判定顺子
    for (i = 0; i < self._three.length; i++) {
        targetWobt = targetWobt.concat(self._three[i].cardList);
    }
    self._three = [];
    targetWobt.sort(window.playUI.cardSort);
    //判定顺子，先确定五连
    targetWobp = targetWobt.slice(0);
    self.judgeProgression(targetWobp);
    //判断连对
    //targetWobpp = targetWobp.slice(0);
    self.judgeProgressionPairs(targetWobp);
    //判定三根，用于判定三顺
    //targetWobt = targetWob.slice(0);
    self.judgeThree(targetWobp);
    //除去顺子、炸弹、三根后判断对子、单牌
    stat = G.gameRule.valCount(targetWobp);
    for (i = 0; i < stat.length; i++) {
        if(stat[i].count === 1){//单牌
            for (var j = 0; j < targetWobp.length; j++) {
                if(targetWobp[j].val === stat[i].val){
                    self._one.push(new qc.landlord.AICardType(stat[i].val, targetWobp.splice(j,1)));
                }
            }
        } else if(stat[i].count === 2){//对子
            for (var j = 0; j < targetWobp.length; j++) {
                if(targetWobp[j].val === stat[i].val){
                    self._pairs.push(new qc.landlord.AICardType(stat[i].val, targetWobp.splice(j,2)));
                }
            }
        }
    }

};

/**
 * 判断给定牌中的三根
 * @method judgeThree
 */
AILogic.prototype.judgeThree = function (cards){
    var self = this,
        stat = G.gameRule.valCount(cards);
    for (i = 0; i < stat.length; i++) {
        if(stat[i].count === 3){
            var list = [];
            self.moveItem(cards, list, stat[i].val);
            self._three.push(new qc.landlord.AICardType(list[0].val, list));
        }
    }
};

/**
 * 判断给定牌中的飞机
 * @method judgePlane
 */
AILogic.prototype.judgePlane = function (){
    var self = this;
    if(self._three.length > 1){
        var proList = [];
        for (i = 0; i < self._three.length; i++) {//遍历统计结果
            if(self._three[i].val >= 15) continue;//三顺必须小于2
            if(proList.length == 0){
                proList.push({'obj': self._three[i], 'fromIndex': i});
                continue;
            }
            if(proList[proList.length - 1].val - 1 == self._three[i].val){//判定递减
                proList.push({'obj': self._three[i], 'fromIndex': i});
            } else {
                if(proList.length > 1){//已经有三顺，先保存
                    var planeCards = [];
                    for (var j = 0; j < proList.length; j++) {
                        planeCards = planeCards.concat(proList[j].obj.cardList);
                    }
                    self._plane.push(new qc.landlord.AICardType(proList[0].obj.val, planeCards));
                    for (var k = proList.length - 1; k >= 0; k--) {//除去已经被取走的牌
                        self._three.splice(proList[k].fromIndex, 1);
                    }
                }
                //重新计算
                proList = [];
                proList.push({'obj': self._three[i], 'fromIndex': i});
            }
        }
        if(proList.length > 1){//有三顺，保存
            var planeCards = [];
            for (var j = 0; j < proList.length; j++) {
                planeCards = planeCards.concat(proList[j].obj.cardList);
            }
            self._plane.push(new qc.landlord.AICardType(proList[0].obj.val, planeCards));
            for (var k = proList.length - 1; k >= 0; k--) {//除去已经被取走的牌
                self._three.splice(proList[k].fromIndex, 1);
            }
        }
    }
};

/**
 * 判断给定牌中的顺子(五连)
 * @method judgeProgression
 * @param  {[array]}         cards 指定的牌
 */
AILogic.prototype.judgeProgression = function (cards){
    var self = this;

    var saveProgression = function (proList){
        var progression = [];
        for (var j = 0; j < proList.length; j++) {
            progression.push(proList[j].obj);
        }
        self._progression.push(new qc.landlord.AICardType(proList[0].obj.val, progression));
        for (var k = proList.length - 1; k >= 0; k--) {//除去已经被取走的牌
            cards.splice(proList[k].fromIndex, 1);
        }
    };
    //判定顺子
    if(cards.length >= 5){
        var proList = [];
        for (var i = 0; i < cards.length; i++) {
            if(cards[i].val >= 15) continue;//顺子必须小于2
            if(proList.length == 0){
                proList.push({'obj': cards[i], 'fromIndex': i});
                continue;
            }
            if(proList[proList.length - 1].obj.val - 1 === cards[i].val){//判定递减
                proList.push({'obj': cards[i], 'fromIndex': i});
                if(proList.length === 5) break;
            } else if (proList[proList.length - 1].obj.val === cards[i].val) {//相等跳出本轮
                continue;
            } else {
                if(proList.length >= 5){//已经有顺子，先保存
                    //saveProgression(proList);
                    //proList = [];
                    break;
                } else {
                    //重新计算
                    proList = [];
                    proList.push({'obj': cards[i], 'fromIndex': i});
                }
            }
        }
        if(proList.length === 5){//有顺子，保存
            saveProgression(proList);
            self.judgeProgression(cards);//再次判断顺子
        } else {
            self.joinProgression(cards);
        }
    }
};

/**
 * 将顺子与剩下的牌进行拼接，组成更大的顺子
 * @method judgeProgression
 * @param  {[array]}         cards 指定的牌
 */
AILogic.prototype.joinProgression = function (cards){
    var self = this;
    for (var i = 0; i < self._progression.length; i++) {//拼接其他散牌
        for (var j = 0; j < cards.length; j++) {
            if(self._progression[i].val != 14 && self._progression[i].val === cards[j].val - 1){
                self._progression[i].cardList.unshift(cards.splice(j, 1)[0]);
            } else if(cards[j].val === self._progression[i].val - self._progression[i].cardList.length){
                self._progression[i].cardList.push(cards.splice(j, 1)[0]);
            }
        }
    }
    var temp = self._progression.slice(0);
    for (i = 0; i < temp.length; i++) {//连接顺子
        if( i < temp.length - 1 && temp[i].val - temp[i].cardList.length === temp[i + 1].val){
            self._progression[i].cardList = self._progression[i].cardList.concat(self._progression[i + 1].cardList);
            self._progression.splice( ++i, 1);
        }
    }
};

/**
 * 判断给定牌中的连对
 * @method judgeProgressionPairs
 * @param  {[array]}         cards 指定的牌
 */
AILogic.prototype.judgeProgressionPairs = function (cards){
    var self = this;

    var saveProgressionPairs = function (proList){
        var progressionPairs = [];
        for (var i = proList.length - 1; i >= 0; i--) {//除去已经被取走的牌
            for (var j = 0; j < cards.length; j++) {
                if(cards[j].val === proList[i]){
                    progressionPairs = progressionPairs.concat(cards.splice(j, 2));
                    break;
                }
            }
        }
        progressionPairs.sort(window.playUI.cardSort);
        self._progressionPairs.push(new qc.landlord.AICardType(proList[0], progressionPairs));
    };
    //判定连对
    if(cards.length >= 6){
        var proList = [];
        var stat = G.gameRule.valCount(cards);//统计
        for (var i = 0; i < stat.length; i++) {
            if(stat[i].val >= 15){//连对必须小于2
                continue;
            }
            if(proList.length == 0  && stat[i].count >= 2){
                proList.push(stat[i].val);
                continue;
            }
            if(proList[proList.length - 1] - 1 === stat[i].val && stat[i].count >= 2){//判定递减
                proList.push(stat[i].val);
            } else {
                if(proList.length >= 3){//已经有连对，先保存
                    //saveProgressionPairs(proList);
                    //proList = [];
                    break;
                } else {
                    //重新计算
                    proList = [];
                    if(stat[i].count >= 2) proList.push(stat[i].val);
                }
            }
        }
        if(proList.length >= 3){//有顺子，保存
            saveProgressionPairs(proList);
            self.judgeProgressionPairs(cards);
        }
    }
};

/**
 * 将src中对应值的牌数据移到dest中
 */
AILogic.prototype.moveItem = function(src, dest, v){
    for (var i =  src.length - 1; i >= 0; i--) {
        if(src[i].val === v){
            dest.push(src.splice(i, 1)[0]);
        }
    }
};

/**
 * 卡牌比较
 * @method cardSort
 * @param  {Object} a [description]
 * @param  {Object} b [description]
 * @return 1 : a < b ,-1 a : > b   [description]
 */
AILogic.prototype.cardSort = function (a, b){
    var va = parseInt(a.val);
    var vb = parseInt(b.val);
    if(va === vb){
        return a.type > b.type ? 1 : -1;
    } else if(va > vb){
        return -1;
    } else {
        return 1;
    }
};
/**
 * 设置返回牌的类型
 * @method setCardKind
 * @param  {[object]}    obj  对象
 * @param  {[kind]}    kind 牌型
 */
AILogic.prototype.setCardKind = function (obj, kind){
    obj.cardKind = kind;
    obj.size = obj.cardList.length;
    return obj;
};

/**
 * 获取大过当前最大牌的三顺最小值
 * 指定牌张数
 * @return
 */
AILogic.prototype.minPlane = function (len){
    var self = this,
        winc = window.landlordUI.winCard;
    if(self._plane.length > 0){
        for (var i = self._plane.length - 1; i >= 0 ; i--) {//从小值开始判断
            if(winc.val < self._plane[i].val && len <= self._plane[i].cardList.length){
                if(len === self._plane[i].cardList.length){
                    return self.setCardKind(self._plane[i], G.gameRule.PLANE);
                } else {
                    var valDiff = self._plane[i].val - winc.val,
                        sizeDiff = (self._plane[i].cardList.length - len) / 3;
                    for (var j = 0; j < sizeDiff; j++) {//拆顺
                        if(valDiff > 1){
                            for (var k = 0; k < 3; k++) {
                                self._plane[i].cardList.shift();
                            }
                            valDiff -- ;
                            continue;
                        }
                        for (var k = 0; k < 3; k++) {
                            self._plane[i].cardList.pop();
                        }
                    }
                    return self.setCardKind(self._plane[i], G.gameRule.PLANE);
                }
            }
        }
    }
    return null;
};

/**
 * 获取list中大过v的最小的元素
 * @param  {array} list [description]
 * @param  {number} kind    牌型
 * @param  {number} v    要大过的值
 * @return
 */
AILogic.prototype.minCards = function (list, kind, v){
    var self = this;
    v = v ? v : 2;
    if(list.length > 0){
        for (var i = list.length - 1; i >= 0 ; i--) {//从小值开始判断
            if(v < list[i].val){
                return self.setCardKind(list[i], kind);
            }
        }
    }
    return null;
};

/**
 * 获取list对应牌型最大
 * @param  {array} list [description]
 * @param  {number} kind    牌型
 * @param  {number} v    要大过的值
 * @return
 */
AILogic.prototype.maxCards = function (list, kind, v){
    var self = this,
        max = null;
    if(list.length > 0){
        for (var i = 0; i < list.length ; i++) {//从小值开始判断
            if((max && list[i].val > max.val)|| !max){
                max = list[i];
            }
        }
        return v ? (max.val > v ? self.setCardKind(max, kind) : null) : self.setCardKind(max, kind);
    }
    return null;
};

/**
 * 根据自己是否是庄家，来决定出牌，匹配最大或者最小
 * @method function
 * @param  {[array]} list 出牌列表
 * @return {[number]}      牌型
 */
AILogic.prototype.matchCards = function(list,kind) {
    var self = this,
        winc = window.landlordUI.winCard,
        roundWinner = window.landlordUI.roundWinner;
    if(self.player.isLandlord){//坐庄打法
        if(self.player.nextPlayer.cardList.length < 3 || self.player.nextPlayer.nextPlayer.cardList.length < 3 )
            return self.maxCards(list, kind, winc.val);
        else
            return self.minCards(list, kind, winc.val);
    } else {//偏家打法
        if(roundWinner.isLandlord){//地主大时
            if(roundWinner.cardList.length < 3){
                return self.maxCards(list, kind, winc.val);
            } else {
                return self.minCards(list, kind, winc.val);
            }
        } else {
            var c = self.minCards(list, kind, winc.val);
            return c ? (c.val < 14 ? c : null) : null;
        }
    }
};
/**
 * 从对子或者单牌中获取一张牌
 * @param  {array} list [description]
 * @param  {number} v    需要大过的值
 * * @param  {number} notEq    对子中不允许出现的值
 * @return
 */
AILogic.prototype.minOne = function (v, notEq){
    var self = this,
        one = self.minCards(self._one, G.gameRule.ONE, v),
        oneFromPairs = self.offPairs(notEq);
    if(!one){//没有单根，找对
        if(oneFromPairs){
            self.deleteOne(oneFromPairs);
            return oneFromPairs;
        } else {
            return null;
        }
    } else {
        if(one.val > 14){//保留2和大小王
            if(oneFromPairs){
                self.deleteOne(oneFromPairs);
                return oneFromPairs;
            } else
                return null;
        } else {
            return one.cardList[0];
        }
    }
    return null;
};

/**
 * 拆对
 * @param  {number} v 要大过的值
 * @param  {number} notEq 不能等于的值
 * @return {card}    拆出来得到的牌
 */
AILogic.prototype.offPairs = function (v, notEq){
    var self = this,
        pairs = self.minCards(self._pairs, G.gameRule.PAIRS, v);
    if(pairs){
        while (true) {
            if(pairs.cardList[0].val === notEq){
                pairs = self.minCards(self._pairs, G.gameRule.PAIRS, pairs.cardList[0].val);
            } else {
                break;
            }
        }
    }

    return pairs ? pairs.cardList[0] : null;
};
/*
    删掉一张牌并重新分析
 */
AILogic.prototype.deleteOne = function (card){
    for (var i = 0; i < this.cards.length; i++) {
        if(this.cards[i].val === card.val && this.cards[i].type === card.type){
            this.cards.splice(i, 1);
        }
    }
    this.analyse();
};
/**
 * 手牌评分,用于AI根据自己手牌来叫分
 * @method function
 * @return {[nmber]} 所评得分
 */
AILogic.prototype.judgeScore = function() {
    var self = this,
        score = 0;
    score += self._bomb.length * 6;//有炸弹加六分
    if(self._kingBomb.length > 0 ){//王炸8分
        score += 8;
    } else {
        if(self.cards[0].val === 17){
            score += 4;
        } else if(self.cards[0].val === 16){
            score += 3;
        }
    }
    for (var i = 0; i < self.cards.length; i++) {
        if(self.cards[i].val === 15){
            score += 2;
        }
    }
    console.info(self.player.name + "手牌评分：" + score);
    if(score >= 7){
        return 3;
    } else if(score >= 5){
        return 2;
    } else if(score >= 3){
        return 1;
    } else {//4相当于不叫
        return 4;
    }
};

/**
 * 手数，手牌需要打出几次才能打完
 * @method times
 */
AILogic.prototype.times = function (){
    var self = this;
    var t = this._kingBomb.length +
                this._bomb.length +
                this._progression.length +
                this._progressionPairs.length +
                this._one.length +
                this._pairs.length;
    var threeCount = this._three.length;
    if(this._plane.length > 0){
        for (var i = 0; i < this._plane.length; i++) {
            threeCount += this._plane[i].cardList.length / 3;
        }
    }
    if( threeCount - (this._one.length + this._pairs.length) > 0){
        t += threeCount - (this._one.length + this._pairs.length);
    }
    return t;
};

AILogic.prototype.log = function (){
    var self = this;
    console.info('以下显示【' + self.player.name + '】手牌概况，手数：' + self.times() );
    console.info('王炸');
    console.info(self._kingBomb);
    console.info('炸弹');
    console.info(self._bomb);
    console.info('三根');
    console.info(self._three);
    console.info('飞机');
    console.info(self._plane);
    console.info('顺子');
    console.info(self._progression);
    console.info('连对');
    console.info(self._progressionPairs);
    console.info('单牌');
    console.info(self._one);
    console.info('对子');
    console.info(self._pairs);
};


}).call(this, this, Object);
