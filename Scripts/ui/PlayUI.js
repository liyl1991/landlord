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
    this.dealTimer = null;
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
     ownPlayerArea : qc.Serializer.NODE,
     exitBtn : qc.Serializer.NODE,
     mainScene : qc.Serializer.STRING
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
    self.addListener(self.exitBtn.onClick, function(){
        if(self.dealTimer){
            self.game.timer.remove(self.dealTimer);
            self.dealTimer = null;
        }
        self.game.state.load(self.mainScene, false, function() {
            // 啥都不干
        }, function() {
            console.log(self.mainScene + '场景加载完毕。');
        });
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
        //c.frame = card.icon;
        //左边电脑玩家发牌
        //玩家的牌
        card = self.getOneCard(cards);
        G.ownPlayer.cardList.push(card);
        self.insertOneCard(card);
        if ( --total > 0) {
            self.dealTimer = self.game.timer.add(200, deal);
        } else {
            G.leftPlayer.cardList.sort(G.gameRule.cardSort);
            G.rightPlayer.cardList.sort(G.gameRule.cardSort);
            G.ownPlayer.cardList.sort(G.gameRule.cardSort);
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


    G.leftPlayer.cardList.sort(G.gameRule.cardSort);
    G.rightPlayer.cardList.sort(G.gameRule.cardSort);
    G.ownPlayer.cardList.sort(G.gameRule.cardSort);
    self.robLandlord();
    */
};

//抽取牌组中的一张牌
PlayUI.prototype.getOneCard = function (cards){
    var self = this;
    return cards.splice(self.game.math.random(0,cards.length - 1) ,1)[0];
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
    self.ownPlayerArea.getScript('qc.engine.PlayerUI').headPic.frame = G.ownPlayer.isLandlord ? 'landlord.png' : 'peasant.png';
    self.ownPlayerArea.getScript('qc.engine.PlayerUI').headPic.visible = true;
    //把底牌给地主
    player.cardList = player.cardList.concat(G.hiddenCards);
    player.cardList.sort(G.gameRule.cardSort);
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
    if(G.currentCards.length != 0 && G.gameRule.cardSort(card, G.currentCards[0]) === 1){//比第一张牌小才需要查询
        for (var j = 0; j < G.currentCards.length; j++) {//查询新的牌应放置的位置
            var _curr = G.currentCards[j].getScript('qc.engine.CardUI').info,
                _next = null;
            if( j < G.currentCards.length - 1){
                _next = G.currentCards[j + 1].getScript('qc.engine.CardUI').info;
            }
            if(G.gameRule.cardSort(card, _curr) === 1 && ((_next && G.gameRule.cardSort(card, _next) === -1) || !_next)){
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
    node.headPic.frame = flag ? 'landlord.png' : 'peasant.png';
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
