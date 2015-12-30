// define a user behaviour
var RoomMessage = qc.defineBehaviour('qc.engine.RoomMessage', qc.Behaviour, function() {
    // need this behaviour be scheduled in editor
    //this.runInEditor = true;
}, {
    // fields need to be serialized
});

// Called when the script instance is being loaded.
RoomMessage.prototype.awake = function() {
    var self = this;
    this.game.timer.add(8000, function(){
        self.gameObject.destroy();
    });
};

// Called every frame, if the behaviour is enabled.
//RoomMessage.prototype.update = function() {
//
//};
