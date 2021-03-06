'use strict'

const chai              = require('chai'),
      cfg               = require('config'),
      EmailNotification = require('../EmailNotification.js'),
      gmailModel        = require('gmail-model'),
      should            = require('chai').should();


var gmailParams = {
  clientSecretFile: cfg.auth.clientSecretFile,
  googleScopes:     cfg.auth.scopes,
  name:             cfg.mailbox.name,
  tokenDir:         cfg.auth.tokenFileDir,
  tokenFile:        cfg.auth.tokenFile,
  userId:           cfg.mailbox.userId
}

var processedLabelName  = cfg.appName + '-' + process.env.NODE_ENV + '-processed',
  processedLabelId    = null,
  emailBody           = 'This is some content',
  emailFrom           = cfg.email.from,
  emailFromAddress    = cfg.email.fromAddress,
  emailTo             = cfg.email.to,
  emailSubject        = cfg.email.subject,
  gmailSearchCriteria = 'is:unread newer_than:1d from:"' + emailFromAddress + '" subject:"' + emailSubject + '"';



var en = new EmailNotification({
  gmailSearchCriteria: gmailSearchCriteria,
  processedLabelName: processedLabelName,
  gmail: gmailParams
});


var gmailPackageOpts = {
  name             : gmailParams.name,
  userId           : gmailParams.userId,
  googleScopes     : gmailParams.googleScopes,
  tokenFile        : gmailParams.tokenFile,
  tokenDir         : gmailParams.tokenDir,
  clientSecretFile : gmailParams.clientSecretFile,
  user             : cfg.email.user,
  appSpecificPassword  : cfg.email.password
}

var gmail = new gmailModel(gmailPackageOpts);


var timeout = 20000



/*
 * Pre-tests
 */

before(function (done) {

  this.timeout(timeout);

  gmail.getLabelId ({
    labelName: processedLabelName,
    createIfNotExists: true
  }, function (err, labelId) {
    if (err) throw new Error(err);
    processedLabelId= labelId
    done();
  });
})


/*
 * Post-tests
 */

after(function (done) {

  this.timeout(timeout);

  gmail.deleteLabel ({
    labelId: processedLabelId
  }, function (err) {
    if (err) throw new Error(err);
    done()
  });

});



/*
 * The actual tests
 */

describe('Retrieves the processed label id', function () {

  this.timeout(timeout);


  it('should retrieve the id for a label called ' + processedLabelName, function (done) {
    en.getProcessedLabelId(null, function(err,labelId) {
        labelId.should.equal(processedLabelId);
        done();
    });
  });


});


describe('Receiving a single email notification,', function () {

  this.timeout(timeout);

  var en,
      newMessageId,
      processedLabelId;

  before(function (done) {


    // Create the label
    gmail.getLabelId ({
      labelName: processedLabelName,
      createIfNotExists: true
    }, function (err, labelId) {

      if (err) throw new Error(err);

      processedLabelId = labelId

      // Create a dummy notification
      gmail.sendMessage ({
        from:    emailFrom,
        to:      emailTo,
        subject: emailSubject,
        body:    emailBody
      }, function (err, response) {

        if (err) throw new Error(err);

        newMessageId = response.id

        // Create the email notification object
        en = new EmailNotification({
           gmailSearchCriteria: gmailSearchCriteria,
           retFields: ['id','labelIds','payload(headers)','snippet'],
           format:    'metadata',
           metadataHeaders: 'subject',
           processedLabelName: processedLabelName,
           processedLabelId: processedLabelId,
           gmail: gmailParams
        });

        done();
      });
    });
  });

  it('should recognize the notification email has been received', function (done) {
    en.hasBeenReceived(null, function(err, hasBeenReceived) {
      if (err) throw new Error(err);
      hasBeenReceived.should.equal(true);
      done();
    });
  });

  it('should recognize the email hasn\'t been processed yet', function (done) {
    en.allHaveBeenProcessed(null, function(err, allHaveBeenProcessed) {
      if (err) throw new Error(err);
      allHaveBeenProcessed.should.equal(false);
      done();
    });
  });

  it('should return the messageId', function (done) {
    en.getMessageId(null, function(err, messageId) {
      if (err) throw new Error(err);
      messageId.should.be.a('string');
      done();
    });
  });

  it('should return the message', function (done) {
    en.getMessage(null, function(err, message) {
      if (err) throw new Error(err);
      message.snippet.should.equal(emailBody)
      done();
    });
  });

  it('should use the cache when getting the message a subsequent time');
  it('should refresh the message when the cache is flushed');

  it('should apply the processed label and mark as read', function (done) {
    en.updateLabels({
      applyProcessedLabel: true,
      markAsRead: true
    }, function(err, resps) {

      if (err) throw new Error(err);

      //The batchModify call returns an empty response
      should.not.exist(resps)
      done();
    });
  });

  it('should trash the notification', function (done) {
    en.trash(null, function(err, resps) {

      if (err) throw new Error(err);

      for (var i = 0; i < resps.length; i++) {
        resps[i].labelIds.should.include('TRASH');
      }
      done();
    });
  });

});



describe('Testing a non-received email notification', function () {

  this.timeout(timeout);

  var en,
      processedLabelId;


  before(function (done) {


    // Create the label
    gmail.getLabelId ({
      labelName: processedLabelName,
      createIfNotExists: true
    }, function (err, labelId) {

      if (err) throw new Error(err);

      processedLabelId = labelId

      // Create the email notification object
      en = new EmailNotification({
         gmailSearchCriteria: 'subject:"Dud email that couldn\'t possibly have been received" is:' + processedLabelName,
         processedLabelName: processedLabelName,
         processedLabelId: processedLabelId,
         gmail: gmailParams
      });

      done();
    });
  });

  it('should recognize the notification email has not been received', function (done) {
    en.hasBeenReceived(null, function(err, hasBeenReceived) {
      if (err) throw new Error(err);
      hasBeenReceived.should.equal(false);
      done();
    });
  });

  it('should recognize the email hasn\'t been processed yet', function (done) {
    en.allHaveBeenProcessed(null, function(err, allHaveBeenProcessed) {
      if (err) throw new Error(err);
      allHaveBeenProcessed.should.equal(false);
      done();
    });
  });


});
