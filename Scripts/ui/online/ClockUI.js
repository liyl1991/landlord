// define a user behaviour
var ClockUI = qc.defineBehaviour('qc.engine.ClockUI', qc.Behaviour, function() {
    // need this behaviour be scheduled in editor
    this.startTime = null;
}, {
    timePanel : qc.Serializer.NODE,
    totalTime : qc.Serializer.NUMBER
});

// Called when the script instance is being loaded.
ClockUI.prototype.awake = function() {
    var self = this;
    self.startTime = (new Date()).getTime();
    //var timer = self.timer = self.game.timer.loop(500, self.updateCounter, self);
    var timer = self.timer = self.game.timer.loop(200, function(){
        var curr = (new Date()).getTime(),
            gone = Math.floor((curr - self.startTime) / 1000),
            r = self.totalTime - gone;
        self.timePanel.text = (r < 0 ? 0 : r) + '';
        if(r < 0){
            self.game.timer.remove(self.timer);
        }
    }, self);

};

// Called every frame, if the behaviour is enabled.
//ClockUI.prototype.update = function() {
//};
