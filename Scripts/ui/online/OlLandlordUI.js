// 打牌操作
var OlLandlordUI = qc.defineBehaviour('qc.engine.OlLandlordUI', qc.Behaviour, function() {
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
    //提示次数
    this.promptTimes = 0;
    this.promptList = null;
    window.olLandlordUI = this;
}, {
    rate: qc.Serializer.NODE,
    //提示
    cue : qc.Serializer.NODE,
    //打牌操作
    noCardBtn : qc.Serializer.NODE,
    playBtn : qc.Serializer.NODE,
    warnBtn : qc.Serializer.NODE,
    //出牌区
    myPlayArea : qc.Serializer.NODE,
    leftPlayArea : qc.Serializer.NODE,
    rightPlayArea : qc.Serializer.NODE,
    //预制
    msgPrefab: qc.Serializer.PREFAB,
    clockPrefab: qc.Serializer.PREFAB,
    cardPrefab: qc.Serializer.PREFAB
});

// Called when the script instance is being loaded.
OlLandlordUI.prototype.awake = function() {
    var self = this, input = self.game.input;

    /** 屏蔽浏览器右击菜单*/
    if (window.Event)
        window.document.captureEvents(Event.MOUSEUP);
    function nocontextmenu(event){
        event.cancelBubble = true;
        event.returnValue = false;
        return false;
    }
    function norightclick(event){
        if (window.Event){
            if (event.which == 2 || event.which == 3)
                return false;
        }
        else
        if (event.button == 2 || event.button == 3){
            event.cancelBubble = true;
            event.returnValue = false;
            return false;
        }
    }
    window.document.oncontextmenu = nocontextmenu; // for IE5+
    window.document.onmousedown = norightclick; // for all others
    /** 屏蔽浏览器右击菜单 end*/
    // 出牌按钮操作
    this.addListener(self.playBtn.onClick, self.playEvent, this);
    this.addListener(input.onPointerDown, function(id, x, y){
        input = self.game.input;
        var pointer = input.getPointer(id);
        if (pointer.isMouse) {
            if (pointer.id === qc.Mouse.BUTTON_RIGHT) {
                if(self.playBtn.visible){
                    self.playEvent();
                }
            }
        }
    }, self);
    //提示按钮操作
    this.addListener(self.warnBtn.onClick, function(){
        if(self.promptList.length > 0){
            var promptIndex = self.promptTimes++ % self.promptList.length;
            self.takeBackCards();
            var list = self.promptList[promptIndex];
            for (var i = 0; i < list.length; i++) {
                for (var j = 0; j < G.currentCards.length ; j++) {
                    with(G.currentCards[j].getScript('qc.engine.CardUI')){
                        if(list[i].val === info.val && list[i].type === info.type){
                            G.currentCards[j].anchoredY = -28;
                            isSelected = true;
                        }
                    }
                }
            }
            if(self.getReadyCardsKind()){
                self.playBtn.state = qc.UIState.NORMAL;
            } else {
                self.playBtn.state = qc.UIState.DISABLED;
            }
        } else {
            if(self.winCard){
                self.notCardToPlay();
            }
        }
    });

    // 不出按钮操作
    this.addListener(self.noCardBtn.onClick, self.notCardToPlay, this);
};

// 出牌事件
OlLandlordUI.prototype.playEvent = function(){
    var self = this,
        type = self.getReadyCardsKind();
    if(type){
        self.winCard = type;
        self.addOwnCards();
        self.hidePlayBtn();
        type.cardList = self.readyCards;
        G.online.playCard(type);
        if(self._playTimer){
            self.game.timer.remove(self._playTimer);
        }
    }
};
//收回所有牌
OlLandlordUI.prototype.takeBackCards = function(){
    for (var i = 0; i < G.currentCards.length ; i++) {
        if(G.currentCards[i].getScript('qc.engine.CardUI').isSelected){
            G.currentCards[i].anchoredY = 0;
            G.currentCards[i].getScript('qc.engine.CardUI').isSelected = false;
        }
    }
};
//不出操作
OlLandlordUI.prototype.notCardToPlay = function(){
    var self =  this;
    self.hidePlayBtn();
    self.takeBackCards();
    self.cleanPlayArea();
    self.game.add.clone(self.msgPrefab, self.myPlayArea);
    G.online.playCard(null);
    if(self._playTimer){
        self.game.timer.remove(self._playTimer);
    }
};

/**
 * 判断玩家选中的牌是否是正确牌型，出牌需要符合规则，跟牌需要牌型可以大过上家
 * @method getReadyCardsKind
 * @return {Boolean}       [description]
 */
OlLandlordUI.prototype.getReadyCardsKind = function (){
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
        if(self.winCard){
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
OlLandlordUI.prototype.addOwnCards = function(){
    var self = this,
        playedIndexs = [];
    self.cleanPlayArea();

    for (i = G.currentCards.length - 1; i >= 0 ; i--) {
        if(G.currentCards[i].getScript('qc.engine.CardUI').isSelected){
            G.currentCards[i].parent = self.myPlayArea;
            G.currentCards[i].interactive = false;
            self.myPlayArea.setChildIndex(G.currentCards[i], 0);
            G.currentCards.splice(i, 1);
            G.ownPlayer.cardList.splice(i, 1);
        }
    }
};

/**
 * 清空本人出牌区域
 */
OlLandlordUI.prototype.cleanPlayArea = function(){
    var own = this.myPlayArea.children;
    for (var i = 0; i < own.length; i++) {
        own[i].destroy();
    }
};

/**
 * 清空所有出牌区域
 */
OlLandlordUI.prototype.cleanAllPlayArea = function(){
    this.cleanPlayArea();
    var left = this.leftPlayArea.children,
        right = this.rightPlayArea.children;
    for (var i = 0; i < left.length; i++) {
        left[i].destroy();
    }
    for (i = 0; i < right.length; i++) {
        right[i].destroy();
    }
};
/**
 * 轮换出牌
 * @param  {Player} data 服务器传过来的数据
 */
OlLandlordUI.prototype.playTurn = function (data){
    var self = this;
    self.winCard = data.winCard;
    if(!data.winCard) self.cleanAllPlayArea();
    if(data.rate){
        self.rate.text = data.rate + '';
    }
    if(data.preSeatNo && data.preSeatNo != G.ownPlayer.seatNo){//渲染上家的出牌情况
        var area = null, list = null;
        if(G.leftPlayer.seatNo === data.preSeatNo){
            window.onlinePlayUI.cleanLeftPlayArea();
            area = self.leftPlayArea;
            list = window.onlinePlayUI.left.getScript('qc.engine.OPlayerUI').cardContainer;
        } else {
            window.onlinePlayUI.cleanRightPlayArea();
            area = self.rightPlayArea;
            list = window.onlinePlayUI.right.getScript('qc.engine.OPlayerUI').cardContainer;
        }
        self.showPlayedCards(data.preCardInfo, area, list);
    }
    if(G.ownPlayer.seatNo === data.nextSeatNo){
        self.cleanPlayArea();
        self.promptTimes = 0;
        self.showPlayBtn(data.winCard ? false : true);
        //准备要提示的牌
        var ai = new qc.landlord.AILogic(G.ownPlayer);
        self.promptList = ai.prompt(self.winCard);
        self.game.add.clone(self.clockPrefab, self.myPlayArea);
        self.addPlayTimer();
    } else if(G.leftPlayer.seatNo === data.nextSeatNo) {
        window.onlinePlayUI.cleanLeftPlayArea();
        self.game.add.clone(self.clockPrefab, self.leftPlayArea);
    } else {
        window.onlinePlayUI.cleanRightPlayArea();
        self.game.add.clone(self.clockPrefab, self.rightPlayArea);
    }
};
/**
 * 添加出牌定时器，如果玩家指定时间内没有出牌，由系统自动出牌
 * @method function
 * @return {[type]} [description]
 */
OlLandlordUI.prototype.addPlayTimer = function(){
    var self = this;
    self._playTimer = self.game.timer.add(30000, function(){
        self.warnBtn.onClick.dispatch(self.warnBtn);
        if(self.playBtn.state === qc.UIState.NORMAL){
            self.playBtn.onClick.dispatch(self.playBtn);
        } else {
            self.notCardToPlay();
        }
    });
};

/**
 * 显示其他玩家打出的牌，
 * @method function
 * @param  {[type]} cardInfo 打出的牌
 * @param  {[type]} area     出牌区
 * @param  {[type]} list     手牌区
 * @param  {boolean} isKeep   出牌手是否继续保持手中的牌数量
 */
OlLandlordUI.prototype.showPlayedCards = function(cardInfo, area, list, isKeep){
    var self = this;
    for (var i = 0; i < area.children.length; i++) {
        area.children[i].destroy();
    }
    if(cardInfo){//有出牌显示牌
        for (i = 0; i < cardInfo.cardList.length; i++) {
            var c = self.game.add.clone(self.cardPrefab, area);
            c.visible = true;
            c.interactive = false;
            c.getScript('qc.engine.CardUI').show(cardInfo.cardList[i], false);
        }
        if(!isKeep)
            for (i = cardInfo.size - 1; i >= 0 ; i--) {
                list.children[i].destroy();
            }
    } else {//没出牌显示‘不出’
        self.game.add.clone(self.msgPrefab, area);
    }
};

/**
 * 显示打牌操作按钮
 * @param  {Boolean} flag 是否是玩家先出，true：不显示不出按钮，false：显示不出按钮
 */
OlLandlordUI.prototype.showPlayBtn = function (flag){
    this.playBtn.visible = true;
    //this.playBtn.state = qc.UIState.DISABLED;
    if(this.getReadyCardsKind()){
        this.playBtn.state = qc.UIState.NORMAL;
    } else {
        this.playBtn.state = qc.UIState.DISABLED;
    }
    this.warnBtn.visible = true;
    if(!flag)
        this.noCardBtn.visible = true;
}

/**
 * 隐藏打牌操作按钮
 */
OlLandlordUI.prototype.hidePlayBtn = function (){
    this.noCardBtn.visible = false;
    this.playBtn.visible = false;
    this.warnBtn.visible = false;
};

//判断胜利
OlLandlordUI.prototype.judgeWinner = function(data){
    var self = this;
    self.hidePlayBtn();
    //更新倍数
    self.rate.text = data.rate + '';
    //显示打出的最后一手牌
    if(data.winnerSeatNo != G.ownPlayer.seatNo){
        self.showPlayedCards(
            data.lastCards,
            data.winnerSeatNo === G.leftPlayer.seatNo ? self.leftPlayArea : self.rightPlayArea,
            data.winnerSeatNo === G.leftPlayer.seatNo ? window.onlinePlayUI.left.getScript('qc.engine.OPlayerUI').cardContainer : window.onlinePlayUI.right.getScript('qc.engine.OPlayerUI').cardContainer
        );
    }
    if(data.winnerSeatNo === G.ownPlayer.seatNo ||
        (data.winnerSeatNo != data.landlordSeatNo && data.landlordSeatNo != G.ownPlayer.seatNo)){
         self.cue.text = '你赢了';
    } else {
        self.cue.text = '你输了';
    }
    self.cue.visible = true;
    //显示其他玩家剩余手牌
    window.onlinePlayUI.showPlayerCards(
            data.seats[G.leftPlayer.seatNo].cardList,
            data.seats[G.rightPlayer.seatNo].cardList
        );
    //更新分数
    window.onlinePlayUI.own.getScript('qc.engine.OPlayerUI').scorePanel.text = data.seats[G.ownPlayer.seatNo].score + '';
    window.onlinePlayUI.refreshInfo(data.seats);
    window.onlinePlayUI.readyBtn.children[0].text = window.onlinePlayUI.READY;
    G.ownPlayer.isReady = false;
    //window.onlinePlayUI.readyBtn.visible = true;

    self._afterGameoverTimer = self.game.timer.add(3000, function(){
        window.onlinePlayUI.reset();
        window.onlinePlayUI.readyBtn.visible = true;
    });
};
/**
 * 游戏结束后清理
 * @method function
 * @return {[type]} [description]
 */
OlLandlordUI.prototype.afterGameover = function(){
    self.cue.visible = false;
};
