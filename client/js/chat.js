function Chat(controls, conn, container) {
    self = this;

    conn.on('chat', processChat);

    var enterPressed = false;

    var chatVisibleTime = 3; // In seconds
    var chatFadeTime = 3;    // In seconds
    var chatOpacity = 0;
    var currentTime = 0;

    self.update = function (dt) {
        if (controls.sample().chat) {
            enterPressed = true;
        } else if (enterPressed) {
            enterPressed = false;
            $("#chat-input").css("visibility", "visible");
            $("#chat-input").focus();
        }

        if ($("#chat-input").is(":focus")) {
            chatOpacity = 1;
            currentTime = chatVisibleTime;
            $("#chat-messages").css("opacity", 1);
        } else {
            if (chatOpacity > 0) {
	            var reduceTime = 0;
	            if (currentTime > 0) {
	                 currentTime -= dt;
	                 if (currentTime < 0) {
	                     reduceTime = -currentTime;
	                 }
	            } else {
	                reduceTime = dt;
	            }
	            chatOpacity -= reduceTime / chatFadeTime;
                chatOpacity = max(chatOpacity, 0);
	            $("#chat-messages").css("opacity", chatOpacity);
            }
        }
    };

    $("#chat-input").keyup(function(event) {
        if (event.which !== 13) return;
        $("#chat-input").css("visibility", "hidden");
        var text = $.trim($("#chat-input").val());
        if (text !== '') {
            conn.queue('chat', {
                Message: $("#chat-input").val(),
            });
        }
        $("#chat-input").val("");
        $("#chat-input").blur();
        container.focus();
    });

    function processChat(payload) {
        $("#chat-messages").append("<div class='chat-message-wrapper'><div class='chat-message'>"
                + payload.ID + ": " + payload.Message
                + "</div></div>");
        $("#chat-messages").scrollTop($("#chat-messages")[0].scrollHeight);
        chatOpacity = 1;
        currentTime = chatVisibleTime;
    }
}