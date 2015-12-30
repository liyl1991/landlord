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
