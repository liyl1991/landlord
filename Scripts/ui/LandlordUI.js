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
    //提示次数
    this.promptTimes = 0;
    this.promptList = null;
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
            if(self.roundWinner.name != G.ownPlayer.name){
                self.notCardToPlay();
            }
        }
    });

    // 不出按钮操作
    this.addListener(self.noCardBtn.onClick, self.notCardToPlay, this);
};

// 出牌事件
LandlordUI.prototype.playEvent = function(){
    var self = this,
        type = self.getReadyCardsKind();
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
};

//收回所有牌
LandlordUI.prototype.takeBackCards = function(){
    for (var i = 0; i < G.currentCards.length ; i++) {
        if(G.currentCards[i].getScript('qc.engine.CardUI').isSelected){
            G.currentCards[i].anchoredY = 0;
            G.currentCards[i].getScript('qc.engine.CardUI').isSelected = false;
        }
    }
};

//不出操作
LandlordUI.prototype.notCardToPlay = function(){
    var self = this;
    self.hideBtn();
    //收回所有牌
    self.takeBackCards();
    self.cue.visible = false;
    self.game.add.clone(self.msgPrefab, self.ownCards);
    self.playCard(G.ownPlayer.nextPlayer);
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
                result = ai.play(window.playUI.currentLandlord.cardList.length);
            } else { //跟牌
                result = ai.follow(self.winCard, self.roundWinner.isLandlord, self.roundWinner.cardList.length);
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
            self.winCard = null;
        } else {
            self.noCardBtn.visible = true;
        }
        self.promptTimes = 0;
        //准备要提示的牌
        var ai = new qc.landlord.AILogic(G.ownPlayer);
        self.promptList = ai.prompt(self.winCard);
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
            window.playUI.currentLandlord.score = window.playUI.currentLandlord.score - 2 * rs;
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
