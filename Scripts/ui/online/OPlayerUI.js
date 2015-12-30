// define a user behaviour
var OPlayerUI = qc.defineBehaviour('qc.engine.OPlayerUI', qc.Behaviour, function() {
    // need this behaviour be scheduled in editor
    this.namePanel = null;
}, {
    namePanel: qc.Serializer.NODE,
    scorePanel: qc.Serializer.NODE,
    headPic : qc.Serializer.NODE,
    cardContainer : qc.Serializer.NODE
});

/**
 * 显示身份图片
 * @method function
 * @param  {Boolean} isLandlord 是否是地主
 * @return {[type]}             [description]
 */
OPlayerUI.prototype.showPic = function(isLandlord) {
    this.headPic.frame = isLandlord ? this.PIC_LANDLORD : this.PIC_PEASANT;
    this.headPic.visible = true;
};

OPlayerUI.prototype.PIC_LANDLORD = 'landlord.png';
OPlayerUI.prototype.PIC_PEASANT = 'peasant.png';
