// define a user behaviour
var OnlinePlayUI = qc.defineBehaviour('qc.engine.OnlinePlayUI', qc.Behaviour, function() {
    // need this behaviour be scheduled in editor
    //this.runInEditor = true;
    this.own = null;
    this.left = null;
    this.right = null;
    //抢地主计时器
    this.robTimer = null;
    window.onlinePlayUI = this;
}, {
    //底牌区
    hiddenContainer : qc.Serializer.NODE,
    //预制：打牌提示，桌位信息，卡牌，时钟
    msgPrefab: qc.Serializer.PREFAB,
    deskMsgPrefab: qc.Serializer.PREFAB,
    cardPrefab: qc.Serializer.PREFAB,
    clockPrefab: qc.Serializer.PREFAB,
    //准备按钮
    readyBtn: qc.Serializer.NODE,
    //退出按钮
    exitBtn: qc.Serializer.NODE,
    //出牌区域
    myPlayArea: qc.Serializer.NODE,
    leftPlayArea: qc.Serializer.NODE,
    rightPlayArea: qc.Serializer.NODE,
    //玩家信息
    own: qc.Serializer.NODE,
    left: qc.Serializer.NODE,
    right: qc.Serializer.NODE,
    //桌位信息
    deskMsgPanel: qc.Serializer.NODE,
    //分数板块
    scorePanel: qc.Serializer.NODE,
    ratePanel: qc.Serializer.NODE,
    //叫分按钮
    scoreOne : qc.Serializer.NODE,
    scoreTwo : qc.Serializer.NODE,
    scoreThree : qc.Serializer.NODE,
    scoreZero : qc.Serializer.NODE
});

// Called when the script instance is being loaded.
OnlinePlayUI.prototype.awake = function() {
    var self = this;
    self.init();
    //离开按钮
    self.addListener(self.exitBtn.onClick, function(){
        if(confirm('确定离开游戏？')){
            window.onbeforeunload = undefined;
            G.online.exitGame();
            //删除定时器
            if(self.robTimer){
                self.game.timer.remove(self.robTimer);
            }
            if(self.dealTimer){
                self.game.timer.remove(self.dealTimer);
            }
            if(window.olLandlordUI._playTimer){
                window.olLandlordUI.game.timer.remove(window.olLandlordUI._playTimer);
            }
            //切换场景
            self.game.state.load('main', false, function() {
                // 啥都不干
            }, function() {
                console.log('main场景加载完毕。');
            });
        }
    }, self);
    //准备按钮事件
    self.addListener(self.readyBtn.onClick, function(){
        if(G.ownPlayer.isReady){
            self.readyBtn.children[0].text = self.READY;
            G.ownPlayer.isReady = false;
        } else {
            self.readyBtn.children[0].text = self.CANCEL_READY;
            G.ownPlayer.isReady = true;
        }
        G.online.toggleReady(G.ownPlayer.isReady);
    }, self);
    //叫分按钮事件
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
/**
 * 加入房间后的初始化事件
 * @method roomInit
 * @return {[type]} [description]
 */
OnlinePlayUI.prototype.init = function (){
    var self = this;
    if(G.netInitData.desk && G.netInitData.desk.status === G.gameRule.DESK_STATUS_PLAY){//断线重连
        var player = G.netInitData.desk.seats[G.netInitData.ownSeatNo],
            seats = G.netInitData.desk.seats;
        self.readyBtn.visible = false;
        this.own.getScript('qc.engine.OPlayerUI').namePanel.text = G.ownPlayer.name;
        this.own.getScript('qc.engine.OPlayerUI').scorePanel.text = player.score + '';
        this.refreshInfo(G.netInitData.desk.seats);
        //底牌
        G.hiddenCards = G.netInitData.desk.hiddenCards;
        self.showHiddenCards();
        //自己手牌
        G.currentCards = [];
        G.ownPlayer.cardList = player.cardList;
        for (var i = 0; i < player.cardList.length; i++) {
            self.insertOneCard(player.cardList[i]);
        }
        var setInfo = function (lp, rp){
            self.insertCardForOther(self.left.getScript('qc.engine.OPlayerUI').cardContainer, lp.cardList.length);
            self.insertCardForOther(self.right.getScript('qc.engine.OPlayerUI').cardContainer, rp.cardList.length);
            self.own.getScript('qc.engine.OPlayerUI').showPic(seats[G.netInitData.ownSeatNo].isLandlord);
            self.left.getScript('qc.engine.OPlayerUI').showPic(lp.isLandlord);
            self.right.getScript('qc.engine.OPlayerUI').showPic(rp.isLandlord);
            if(G.netInitData.ownSeatNo != G.netInitData.desk.currentPlaySeatNo)
                self.game.add.clone(self.clockPrefab, G.netInitData.desk.currentPlaySeatNo === 'p2' ? self.rightPlayArea : self.leftPlayArea);
        };
        //其他两家手牌
        if(player.seatNo === 'p1'){
            setInfo(seats.p3, seats.p2);
        } else if(player.seatNo === 'p2'){
            setInfo(seats.p1, seats.p3);
        } else {
            setInfo(seats.p2, seats.p1);
        }
        //分数、倍数
        self.scorePanel.text = G.netInitData.desk.currentScore + '';
        self.ratePanel.text = G.netInitData.desk.rate + '';

        //显示牌面最大牌
        if(G.netInitData.desk.winCard){
            window.olLandlordUI.winCard = G.netInitData.desk.winCard;
            window.olLandlordUI.showPlayedCards(
                G.netInitData.desk.winCard,
                G.netInitData.desk.roundWinSeatNo === G.leftPlayer.seatNo ? self.leftPlayArea : self.rightPlayArea,
                G.netInitData.desk.roundWinSeatNo === G.leftPlayer.seatNo ? self.left.getScript('qc.engine.OPlayerUI').cardContainer : self.right.getScript('qc.engine.OPlayerUI').cardContainer,
                true
            );
        }

        //轮到自己出牌显示操作按钮
        if(G.netInitData.ownSeatNo === G.netInitData.desk.currentPlaySeatNo){
            self.game.add.clone(self.clockPrefab,self.myPlayArea);
            //准备要提示的牌
            var ai = new qc.landlord.AILogic(G.ownPlayer);
            window.olLandlordUI.promptList = ai.prompt(G.netInitData.desk.winCard);
            window.olLandlordUI.showPlayBtn(G.netInitData.desk.winCard ? false : true);
            window.olLandlordUI.addPlayTimer();
        }
    } else {
        var player = G.netInitData.seats[G.netInitData.ownSeatNo];
        this.own.getScript('qc.engine.OPlayerUI').namePanel.text = G.ownPlayer.name;
        this.own.getScript('qc.engine.OPlayerUI').scorePanel.text = player.score + '';
        this.refreshInfo(G.netInitData.seats);
    }
};


//更新桌位信息
OnlinePlayUI.prototype.refreshInfo = function (seats){
    var self = this;
    if(G.ownPlayer.seatNo == 'p1'){
        self.setRightInfo(seats.p2);
        self.setLeftInfo(seats.p3);
    } else if(G.ownPlayer.seatNo == 'p2'){
        self.setRightInfo(seats.p3);
        self.setLeftInfo(seats.p1);
    } else if(G.ownPlayer.seatNo == 'p3'){
        self.setRightInfo(seats.p1);
        self.setLeftInfo(seats.p2);
    }
};

//设置左边玩家信息
OnlinePlayUI.prototype.setLeftInfo = function (player){
    var self = this;
    if(player){
        self.left.getScript('qc.engine.OPlayerUI').scorePanel.text = player.score + '';
        if(G.leftPlayer && G.leftPlayer.name == player.name) return;
        G.leftPlayer = new qc.landlord.Player(player.name);
        G.leftPlayer.seatNo = player.seatNo;
        self.left.getScript('qc.engine.OPlayerUI').namePanel.text = G.leftPlayer.name;
        //提示信息，XX进入/离开游戏
        var m = self.game.add.clone(self.deskMsgPrefab, self.deskMsgPanel);
        m.text = G.leftPlayer.name + self.ENTER;
        m.visible = true;
        //准备
        self.playerReady(player);
    } else {
        if(G.leftPlayer){
            self.cleanLeftPlayArea();
            var m = self.game.add.clone(self.deskMsgPrefab, self.deskMsgPanel);
            m.text = G.leftPlayer.name + self.LEAVE;
            m.visible = true;
            self.left.getScript('qc.engine.OPlayerUI').scorePanel.text = '';
        }
        G.leftPlayer = null;
        self.left.getScript('qc.engine.OPlayerUI').namePanel.text = self.WAITING;
    }
};

//设置右边玩家信息
OnlinePlayUI.prototype.setRightInfo = function (player){
    var self = this;
    if(player){
        self.right.getScript('qc.engine.OPlayerUI').scorePanel.text = player.score + '';
        if(G.rightPlayer && G.rightPlayer.name == player.name) return;
        G.rightPlayer = new qc.landlord.Player(player.name);
        G.rightPlayer.seatNo = player.seatNo;
        self.right.getScript('qc.engine.OPlayerUI').namePanel.text = G.rightPlayer.name;
        //提示信息，XX进入/离开游戏
        var m = self.game.add.clone(self.deskMsgPrefab, self.deskMsgPanel);
        m.text = G.rightPlayer.name + self.ENTER;
        m.visible = true;
        //准备
        self.playerReady(player);
    } else {
        if(G.rightPlayer){
            self.cleanRightPlayArea();
            var m = self.game.add.clone(self.deskMsgPrefab, self.deskMsgPanel);
            m.text = G.rightPlayer.name + self.LEAVE;
            m.visible = true;
            self.right.getScript('qc.engine.OPlayerUI').scorePanel.text = '';
        }
        G.rightPlayer = null;
        self.right.getScript('qc.engine.OPlayerUI').namePanel.text = self.WAITING;
    }
};

//清空自己出牌区域
OnlinePlayUI.prototype.cleanMyPlayArea = function(){
    var self = this;
    if(self.myPlayArea.children.length > 0){
        for (var i = 0; i < self.myPlayArea.children.length; i++) {
            self.myPlayArea.children[i].destroy();
        }
    }
};

//清空左边玩家出牌区域
OnlinePlayUI.prototype.cleanLeftPlayArea = function(){
    var self = this;
    if(self.leftPlayArea.children.length > 0){
        for (var i = 0; i < self.leftPlayArea.children.length; i++) {
            self.leftPlayArea.children[i].destroy();
        }
    }
};

//清空右边玩家出牌区域
OnlinePlayUI.prototype.cleanRightPlayArea = function(){
    var self = this;
    if(self.rightPlayArea.children.length > 0){
        for (var i = 0; i < self.rightPlayArea.children.length; i++) {
            self.rightPlayArea.children[i].destroy();
        }
    }
};

/**
 * 其他玩家准备状态改变
 * @method playerReady
 * @param  {[type]}    data [description]
 * @return {[type]}         [description]
 */
OnlinePlayUI.prototype.playerReady = function (data){
    var self = this,
        area = null;
    if(G.leftPlayer && G.leftPlayer.seatNo === data.seatNo){
        area = self.leftPlayArea;
        self.cleanLeftPlayArea();
    } else {
        area = self.rightPlayArea;
        self.cleanRightPlayArea();
    }
    if(data.isReady){
        var m = self.game.add.clone(self.msgPrefab, area);
        m.text = self.READY;
        m.visible = true;
    }
};

//重置桌位信息
OnlinePlayUI.prototype.reset = function(){
    var self = this;
    //隐藏桌面信息
    self.readyBtn.visible = false;
    self.cleanMyPlayArea();
    self.cleanLeftPlayArea();
    self.cleanRightPlayArea();
    self.scorePanel.text = '0';
    self.ratePanel.text = '1';
    window.olLandlordUI.cue.visible = false;
    window.olLandlordUI.winCard = null;
    self.own.getScript('qc.engine.OPlayerUI').headPic.visible = false;
    self.left.getScript('qc.engine.OPlayerUI').headPic.visible = false;
    self.left.getScript('qc.engine.OPlayerUI').namePanel.color = new qc.Color(0xffffa500);
    if(G.leftPlayer.isLeave){
        self.left.getScript('qc.engine.OPlayerUI').namePanel.text = self.WAITING;
        self.left.getScript('qc.engine.OPlayerUI').scorePanel.text = '';
        G.leftPlayer = null;
    }
    self.right.getScript('qc.engine.OPlayerUI').headPic.visible = false;
    self.right.getScript('qc.engine.OPlayerUI').namePanel.color = new qc.Color(0xffffa500);
    if(G.rightPlayer.isLeave){
        self.right.getScript('qc.engine.OPlayerUI').namePanel.text = self.WAITING;
        self.right.getScript('qc.engine.OPlayerUI').scorePanel.text = '';
        G.rightPlayer = null;
    }
    //清空各个玩家的手牌
    for (var i = 0; i < self.hiddenContainer.children.length; i++) {
        self.hiddenContainer.children[i].frame = 'bg.jpg';
    }

    with(self.left.getScript('qc.engine.OPlayerUI')){
        for (var i = cardContainer.children.length - 1; i >= 0; i--) {
            cardContainer.children[i].destroy();
        }
    }
    with(self.right.getScript('qc.engine.OPlayerUI')){
        for (var i = cardContainer.children.length - 1; i >= 0; i--) {
            cardContainer.children[i].destroy();
        }
    }
    if(G.currentCards){
        for (var i = G.currentCards.length - 1; i >= 0; i--) {
            G.currentCards[i].destroy();
        }
    }

    G.currentCards = [];
};

/**
 * 开始游戏
 * @method function
 * @param  {[type]} data [description]
 * @return {[type]}      [description]
 */
OnlinePlayUI.prototype.start = function(data){
    var self = this;
    self.reset();
    //发牌动画
    var idx = 0, toatl = data.cardList.length;
    for (var i = 0; i < self.deskMsgPanel.children.length; i++) {
        self.deskMsgPanel.children[i].destroy();
    }
    var deal = function (){
        //左边电脑玩家发牌
        self.insertCardForOther(self.left.getScript('qc.engine.OPlayerUI').cardContainer);
        //右边电脑玩家发牌
        self.insertCardForOther(self.right.getScript('qc.engine.OPlayerUI').cardContainer);
        //玩家的牌
        self.insertOneCard(data.cardList[idx]);
        if ( ++idx < toatl) {
            self.dealTimer = self.game.timer.add(200, deal);
        } else {
            G.ownPlayer.cardList = data.cardList;
            G.ownPlayer.cardList.sort(G.gameRule.cardSort);
            for (i = 0; i < G.currentCards.length; i++) {
                G.currentCards[i].getScript('qc.engine.CardUI').isSelected = false;
            }
            //进入抢地主阶段
            self.robLandlord(data.firstRob, 0);
        }
    };
    deal();
};

/**
 * 给其他两家添加手牌
 * @method insertCardForOther
 * @param  {object}           area 区域
 * @param  {[type]}           n 数量
 * @return {[type]}                [description]
 */
OnlinePlayUI.prototype.insertCardForOther = function (area, n){
    var self = this;
    n = n ? n : 1;
    for (var i = 0; i < n; i++) {
        var c = self.game.add.clone(self.cardPrefab, area);
        c.visible = true;
        c.interactive = false;
    }
};

/**
 * 给玩家牌组加入一张牌
 * @method insertOneCard
 * @return {[type]}      [description]
 */
OnlinePlayUI.prototype.insertOneCard = function (card){
    var self = this,
        insertIndex = 0;
    if(G.currentCards.length != 0 && G.gameRule.cardSort(card, G.currentCards[0].getScript('qc.engine.CardUI').info) === 1){//比第一张牌小才需要查询
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
    var c = self.game.add.clone(self.cardPrefab, self.own.getScript('qc.engine.OPlayerUI').cardContainer);
    c.getScript('qc.engine.CardUI').show(card, true);
    c.interactive = true;
    self.own.getScript('qc.engine.OPlayerUI').cardContainer.setChildIndex(c, insertIndex);
    G.currentCards.splice(insertIndex, 0, c);
};

/**
 * 叫分抢地主
 * @method function
 * @param  {[type]} seatNo       当前轮到的玩家的座位号
 * @param  {[type]} currentScore 当前分数
 * @param  {[type]} preSeatNo    前一个玩家的叫分
 * @return {[type]}              [description]
 */
OnlinePlayUI.prototype.robLandlord = function(seatNo, currentScore, preSeatNo, preScore){
    var self = this;
    if(G.ownPlayer.seatNo === seatNo){
        self.game.add.clone(self.clockPrefab, self.myPlayArea);
        //添加一个计时器，30秒没有操作叫分，默认选中不叫
        self.robTimer = self.game.timer.add(30000, function (){
            self.playerProvideScore(4);
        });
        //显示叫分按钮
        self.showRobBtns(currentScore === 4 ? 0 : currentScore);
    } else if(G.leftPlayer.seatNo === seatNo){
        self.game.add.clone(self.clockPrefab, self.leftPlayArea);
    } else {
        self.game.add.clone(self.clockPrefab, self.rightPlayArea);
    }
    //如果有前一家的叫分，显示
    if(preSeatNo){
        self.showRobScore(preSeatNo, preScore);
    }
    self.scorePanel.text = '' + currentScore;
};

OnlinePlayUI.prototype.showRobScore = function(seatNo, score){
    var self = this, area = null;
    if(seatNo === G.ownPlayer.seatNo){
        area = self.myPlayArea;
    } else if(seatNo === G.leftPlayer.seatNo){
        area = self.leftPlayArea;
    } else {
        area = self.rightPlayArea;
    }
    for (var i = 0; i < area.children.length; i++) {
        area.children[i].destroy();
    }
    var mesg = self.game.add.clone(self.msgPrefab, area);
    mesg.text =  score < 4 && score > 0 ? (score + '分') : '不叫';
};

//显示叫分按钮
OnlinePlayUI.prototype.showRobBtns = function(currentScore){
    var self = this;
    self.scoreZero.visible = true;
    self.scoreThree.visible = true;
    if(currentScore < 2)
        self.scoreTwo.visible = true;
    if(currentScore < 1)
        self.scoreOne.visible = true;
};

//隐藏叫分按钮
OnlinePlayUI.prototype.hideRobBtns = function(){
    var self = this;
    self.scoreZero.visible = false;
    self.scoreThree.visible = false;
    self.scoreTwo.visible = false;
    self.scoreOne.visible = false;
};

/**
 * 抢地主叫分
 * @method playerProvideScore
 * @param  {[type]}           s 分数
 * @return {[type]}             [description]
 */
OnlinePlayUI.prototype.playerProvideScore = function (s){
    var self = this;
    self.cleanMyPlayArea();
    //删除定时器
    if(self.robTimer){
        self.game.timer.remove(self.robTimer);
    }
    //隐藏操作按钮
    self.hideRobBtns();
    //添加结果
    var mesg = self.game.add.clone(self.msgPrefab, self.myPlayArea);
    mesg.text =  s < 4 ? (s + '分') : '不叫';
    G.online.robLandlord(s);
};

//显示底牌
OnlinePlayUI.prototype.showHiddenCards = function(){
    var self = this;
    for (var i = 0; i < self.hiddenContainer.children.length; i++) {
        self.hiddenContainer.children[i].frame = G.hiddenCards[i].icon;
    }
};

/**
 * 设定哪一家获得了地主
 * @method function
 * @param  {[type]} data [description]
 * @return {[type]}      [description]
 */
OnlinePlayUI.prototype.setLandlord = function(data){
    var self = this;
    if(data.preSeatNo && data.preSeatNo != G.ownPlayer.seatNo){
        self.showRobScore(data.preSeatNo, data.preScore);
    }
    self.scorePanel.text = '' + data.currentScore;
    //延迟显示地主信息，让玩家能看到最后一位玩家的叫分
    self.game.timer.add(1000, function(){
        self.cleanMyPlayArea();
        self.cleanLeftPlayArea();
        self.cleanRightPlayArea();
        G.hiddenCards = data.hiddenCards;
        self.showHiddenCards();
        //展示身份
        if(data.landlordSeatNo === G.ownPlayer.seatNo){
            self.own.getScript('qc.engine.OPlayerUI').showPic(true);
            self.left.getScript('qc.engine.OPlayerUI').showPic(false);
            self.right.getScript('qc.engine.OPlayerUI').showPic(false);
            window.olLandlordUI.showPlayBtn(true);
            //给底牌
            for (i = 0; i < G.hiddenCards.length; i++) {
                self.insertOneCard(G.hiddenCards[i]);
            }
            G.ownPlayer.cardList = G.ownPlayer.cardList.concat(G.hiddenCards);
            G.ownPlayer.cardList.sort(G.gameRule.cardSort);
            //设置所有牌未选中
            for (i = 0; i < G.currentCards.length; i++) {
                G.currentCards[i].getScript('qc.engine.CardUI').isSelected = false;
            }
            //self.game.add.clone(self.clockPrefab, self.myPlayArea);
            window.olLandlordUI.playTurn({nextSeatNo: G.ownPlayer.seatNo});
        } else if(data.landlordSeatNo === G.leftPlayer.seatNo){
            self.own.getScript('qc.engine.OPlayerUI').showPic(false);
            self.left.getScript('qc.engine.OPlayerUI').showPic(true);
            self.right.getScript('qc.engine.OPlayerUI').showPic(false);
            self.game.add.clone(self.clockPrefab, self.leftPlayArea);
            for (i = 0; i < G.hiddenCards.length; i++) {
                var c = self.game.add.clone(self.cardPrefab, self.left.getScript('qc.engine.OPlayerUI').cardContainer);
                c.visible = true;
                c.interactive = false;
            }
        } else {
            self.own.getScript('qc.engine.OPlayerUI').showPic(false);
            self.left.getScript('qc.engine.OPlayerUI').showPic(false);
            self.right.getScript('qc.engine.OPlayerUI').showPic(true);
            self.game.add.clone(self.clockPrefab, self.rightPlayArea);
            for (i = 0; i < G.hiddenCards.length; i++) {
                var c = self.game.add.clone(self.cardPrefab, self.right.getScript('qc.engine.OPlayerUI').cardContainer);
                c.visible = true;
                c.interactive = false;
            }
        }
    });
    //console.info(data.landlordSeatNo + '是地主');
};

/**
 * 显示玩家剩余牌
 */
OnlinePlayUI.prototype.showPlayerCards = function (leftCardList, rightCardList){
    var self = this,
        leftCantainer = self.left.getScript('qc.engine.OPlayerUI').cardContainer,
        rightCantainer = self.right.getScript('qc.engine.OPlayerUI').cardContainer;
    for (var i = 0; i < leftCardList.length; i++) {
        leftCantainer.children[i].frame = leftCardList[i].icon;
    }

    for (i = 0; i < rightCardList.length; i++) {
        rightCantainer.children[i].frame = rightCardList[i].icon;
    }
};

/**
 * 游戏中有强制退出的
 */
OnlinePlayUI.prototype.forceExit = function (data){
    var self = this;
    //清空提示信息
    if(data.status === 2){//抢地主过程退出
        self.reset();
        self.refreshInfo(data.seats);
        self.hideRobBtns();
        self.readyBtn.children[0].text = self.READY;
        self.readyBtn.visible = true;
        G.ownPlayer.isReady = false;
        if(self.robTimer){
            self.game.timer.remove(self.robTimer);
        }
        if(self.dealTimer){
            self.game.timer.remove(self.dealTimer);
        }
    } else if(data.status === 3){//出牌阶段退出
        var player = G.leftPlayer.seatNo === data.exitSeatNo ? G.leftPlayer : G.rightPlayer;
            area = G.leftPlayer.seatNo === data.exitSeatNo ? self.left : self.right;
        area.getScript('qc.engine.OPlayerUI').namePanel.color = new qc.Color(0xff999999);
        // if(window.olLandlordUI._playTimer){
        //     window.olLandlordUI.game.timer.remove(window.olLandlordUI._playTimer);
        // }
        player.isLeave = true;
        //提示信息，XX进入/离开游戏
        var m = self.game.add.clone(self.deskMsgPrefab, self.deskMsgPanel);
        m.text = player.name + self.LEAVE;
        m.visible = true;
    }
};

/**
 * 游戏中有强制退出的
 */
OnlinePlayUI.prototype.playerBack = function (data){
    var self = this;
    if(G.leftPlayer.seatNo === data.seatNo){
        G.leftPlayer.isLeave = false;
        self.left.getScript('qc.engine.OPlayerUI').namePanel.color = new qc.Color(0xffffa500);
    } else if(G.rightPlayer.seatNo === data.seatNo){
        G.rightPlayer.isLeave = false;
        self.right.getScript('qc.engine.OPlayerUI').namePanel.color = new qc.Color(0xffffa500);
    }
    var m = self.game.add.clone(self.deskMsgPrefab, self.deskMsgPanel);
    m.text = data.name + self.BACK;
    m.visible = true;
};

OnlinePlayUI.prototype.WAITING = '等待加入';
OnlinePlayUI.prototype.LEAVE = ' 离开了';
OnlinePlayUI.prototype.BACK = ' 回来了';
OnlinePlayUI.prototype.ENTER = ' 加入了游戏';
OnlinePlayUI.prototype.READY = '准备';
OnlinePlayUI.prototype.CANCEL_READY = '取消准备';
