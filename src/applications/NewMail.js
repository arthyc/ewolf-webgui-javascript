var NewMail = function(callerID,applicationFrame,options,		
		createRequestObj,handleResponseCategory,
		allowAttachment,sendTo,sendToQuery, sendToMultipleInOneMessage) {
	/****************************************************************************
	 * Members
	  ***************************************************************************/
	var self = this;
	$.extend(this,NEWMAIL_CONSTANTS);	
	var id = self.NEWMAIL_APP_ID_PREFIX + callerID;	
	
	var settings = $.extend({}, self.NEW_MAIL_DAFAULTS, options);
	
	var files = null;
	
	/****************************************************************************
	 * Base class
	  ***************************************************************************/	
	Application.call(this, id ,applicationFrame, settings.TITLE);	
	
	/****************************************************************************
	 * User Interface
	  ***************************************************************************/
	var base = $("<table/>")
		.addClass("newMainTable")
		.appendTo(this.frame);
	
	var queryRaw = $("<tr/>").appendTo(base);
	$("<td/>")
		.addClass("newMailAlt")
		.append(settings.TO+":")
		.appendTo(queryRaw);	
	var userIdCell = $("<td/>").appendTo(queryRaw);
	
	sendToQuery.appendTo(userIdCell);
	
	if(sendTo != null) {
		sendToQuery.addTagByQuery(sendTo,true);
	}
	
	var msgRaw = $("<tr/>").appendTo(base);
	$("<td/>")
		.addClass("newMailAlt")
		.append(settings.CONTENT+":")
		.appendTo(msgRaw);
	
	var height = 350;
	if(allowAttachment) {
		height = 200;
	}
	
	var messageText = $("<div/>")
		.addClass("textarea-div")
		.attr({
		"style" : "min-height:"+height+"px;",
		"contentEditable" : "true"
	});
	
	$("<td/>").append(messageText)
		.appendTo(msgRaw);
	
	if(allowAttachment) {
		var attacheRaw = $("<tr/>").appendTo(base);
		$("<td/>")
			.addClass("newMailAlt")
			.append(settings.ATTACHMENT+":")
			.appendTo(attacheRaw);
		
		var uploaderArea = $("<td/>").appendTo(attacheRaw);
		files = new FilesBox(uploaderArea);
	}

	var btnRaw = $("<tr/>").appendTo(base);
	
	$("<td/>").appendTo(btnRaw);
	var btnBox = $("<td/>").appendTo(btnRaw);
	
	var operations = new FunctionsArea().appendTo(btnBox);
	
	var errorRaw = $("<tr/>").appendTo(base);
	
	$("<td/>").appendTo(errorRaw);
	var errorBox = $("<td/>").appendTo(errorRaw);
	
	var errorMessage = $("<span/>").attr({
		"class": "errorArea"
	}).appendTo(errorBox);
	
	/****************************************************************************
	 * Functionality
	  ***************************************************************************/		
	eWolf.bind("select",function(event,eventID) {
		if(eventID == id) {
			window.setTimeout(function () {
				messageText.focus();
			}, 0);
		}
	});
	
	eWolf.bind("select",function(event,eventId) {
		if(eventId != id) {
			self.destroy();
		}
	});
		
	function showDeleteSuccessfulDialog(event) {
		var diag = $("<div/>").attr({
			"id" : "dialog-confirm",
			"title" : "Resend to all destinations?"
		}).addClass("DialogClass");
		
		$("<p/>").appendTo(diag).append(
				"You are reseding the message after its failed to arraive to some of its destinations.<br>" + 
				"The message already arrived to some of its destinations.");
		$("<p/>").appendTo(diag).append(
				"<b>Do you want to resend the message to these destinations?</b>");
		
		diag.dialog({
			resizable: true,
			modal: true,
			width: 550,
			buttons: {
				"Send only to failed": function() {
					$( this ).dialog( "close" );
					self.send(event,true);
				},
				"Resend to all": function() {
					$( this ).dialog( "close" );
					sendToQuery.tagList.unmarkTags();
					self.send(event,true);
				},
				Cancel: function() {
					$( this ).dialog( "close" );
				}
			}
		});
	}
	
	this.updateSend = function() {
		if(sendToQuery.tagList.tagCount({markedError:false,markedOK:false}) > 0) {
			self.title.hideAll();
			operations.hideAll();
		} else if(sendToQuery.tagList.tagCount({markedError:true})) {
			self.title.showAll();
			operations.showAll();
		} else {			
			eWolf.trigger("needRefresh",[callerID]);
			self.cancel();
		}		
	};
	
	this.send = function (event,resend) {
		if(sendToQuery.isMissingField(true, " * Please select a destination(s).")) {
			return false;
		}
		
		if(!resend) {
			if(sendToQuery.tagList.match({markedOK:true}).count() > 0) {
				showDeleteSuccessfulDialog(event);
				return false;
			}
		}
		
		if(sendToQuery.tagList.match({markedOK:false}).count() <= 0) {
			self.updateSend();
			return false;
		}
			
		sendToQuery.tagList.unmarkTags({markedError:true});		
		self.updateSend();		
		errorMessage.html("");
		
		self.sendToAll();
	};
	
	this.sendToAll = function () {		
		var msg = messageText.html();

		var mailObject = {
				text: msg
		};
		
		if(sendToMultipleInOneMessage) {
			var destVector = [];
			
			sendToQuery.tagList.foreachTag({markedOK:false},function(destId) {
				destVector.push(destId);
			});
			
			self.sendTo(destVector, mailObject);			
		} else {
			sendToQuery.tagList.foreachTag({markedOK:false},function(destId) {
				self.uploadFilesThenSendTo(destId, mailObject);
			});
		}			
	};
	
	this.uploadFilesThenSendTo = function (dest, mailObject) {
		if(allowAttachment && files) {
			files.uploadAllFiles(dest, function(success, uploadedFiles) {
				if(success) {
					mailObject.attachment = uploadedFiles;
					self.sendTo(dest,mailObject);
				} else {
					errorMessage.html("Some of the files failed to upload...<br>Message did not sent.");
					self.title.showAll();
					operations.showAll();
				}
			});			
		} else {
			self.sendTo(dest, mailObject);
		}	
	};
	
	this.sendTo = function(destId,dataObj) {
		var data = JSON.stringify(dataObj);
		
		var responseHandler = new ResponseHandler(handleResponseCategory,[],null);
		
		responseHandler.success(function(data, textStatus, postData) {
			if($.isArray(destId)) {
				$.each(destId, function(i, id) {
					sendToQuery.tagList.markTagOK(id);
				});
			} else {
				sendToQuery.tagList.markTagOK(destId);
			}
		}).error(function(response, textStatus, postData) {
			if( ! $.isArray(destId)) {
				self.appendFailErrorMessage(destId, response.toString());
			}
		}).addResponseArray("userIDsResult",
				// Condition
				function(response, textStatus, postData) {
					return $.isArray(destId) && response.isGeneralError();
				},
				// Success
				function(pos, response, textStatus, postData) {
					var itemID = postData.userIDs[pos];
					var item = sendToQuery.tagList.match({id:itemID});
					
					item.markOK();
				},
				// Error
				function(pos, response, textStatus, postData) {
					var itemID = postData.userIDs[pos];
					
					self.appendFailErrorMessage(itemID, 
							response.toString());		
				}).complete(function() {
					self.updateSend();
				});
		
		eWolf.serverRequest.request(id,
				createRequestObj(destId,data),
				responseHandler.getHandler());
	};
	
	this.appendFailErrorMessage = function (id, result) {
		var errorMsg = "Failed to arrive at destination: " +
										id + " with error: " + result;
		errorMessage.append(errorMsg+"<br>");
		
		//sendToQuery.tagList.markTagError(id,errorMsg);
		sendToQuery.tagList.match(id == "everyone" ? {markedOK:false} : {id:id}).markError(errorMsg);
	};
	
	this.cancel = function() {
		eWolf.selectApp(callerID);
	};
	
	self.title
		.addFunction("Send", this.send)
		.addFunction("Cancel",this.cancel);
	operations
		.addFunction("Send", this.send)
		.addFunction("Cancel", this.cancel);

	return this;
};

var NewMessage = function(id,applicationFrame,sendToID) {
	function createNewMessageRequestObj(to,msg) {
		return {
			sendMessage: {
				userIDs: to,
				message: msg
			}
		  };
	}
	
	NewMail.call(this,id,applicationFrame,{
			TITLE : "New Message"
		},createNewMessageRequestObj,"sendMessage",false,
		sendToID,new FriendsQueryTagList(300), true);
	
	return this;
};

var NewPost = function(id,applicationFrame,wolfpack) {	
	function createNewPostRequestObj(to,content) {
		return {
			post: {
				wolfpackName: to,
				post: content
			}
		  };
	}	
	
	NewMail.call(this,id,applicationFrame,{
			TITLE : "New Post",
			TO : "Post to",
			CONTENT: "Post"
		},createNewPostRequestObj,"post",true,
			wolfpack,new WolfpackQueryTagList(300), false);
	
	return this;
};
