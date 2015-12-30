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
