/*jslint node:true */
'use strict';

var connection = require('./../config/db.js')(100);
var md5 = require('MD5');
var mailer = require('nodemailer');
var mailSettings = require('./../config/mail.js')();

module.exports = function () {
    var transporter = mailer.createTransport(mailSettings);

    var sendMail = function(recipient, token, user, email, title){
        var body = 'Guten Tag,<br/><br/>' + user + ' hat Sie eingeladen, an der Umfrage ' + title + ' teilzunehmen.<br/><br/>Besuchen Sie zur Teilnahme die folgende Seite:<br><a href="http://afs.nunki.uberspace.de/#/participate/'+token+ '">http://afs.nunki.uberspace.de/#/participate/' +token+ '</a>';

        var mailOptions = {
            from: user  + ' via AnFeSys <' + email + '>',// sender address  'Hans Wurst via <AnFeSys@gmail.com>'
            to: recipient, // list of receivers
            subject: 'Einladung zur Umfrage ' + title, // Subject line
            // Text ggf. user Name hinzufügen
            html: body // html body
        };

        // send mail with defined transport object
        transporter.sendMail(mailOptions, function(error, info){
            console.log("send mail");
            if(error){
                console.log(error);
            }else{
                console.log('Message sent: ' + info.response);
            }
        });
    };

    return {
        publishOpen : function(req, res){
            var hash = md5(req.params.id);

            connection.query('INSERT INTO tokens SET surveyId = ?, token = ?, keepAfterUse = ?', [req.params.id ,hash, true], function(err, rows, fields){
                if (err) throw err;
                // console.log(fields);
                res.jsonp(hash);
            });
        },

        publishIndividually : function(req, res){
            console.log('IN METHODE PUBLISH INDIVIDUALLY -- ' + req.params.id);
            // req.params.id -> surveyID
            // Get E-Mails which are assigned to this survey
            connection.query('SELECT * FROM surveys WHERE id = ?', [req.params.id], function(err, rows, fields){
                var survey = rows[0];

                connection.query('SELECT * FROM recipients WHERE surveyID = ?', [req.params.id], function(err, rows, fields){
                    if (err) throw err;
                    console.log(rows.length);

                    if(rows.length === 0){
                        res.jsonp('No Recipients');
                    } else {

                        // for each E-Mail publish one token into the DB
                        for(var i = 0; i < rows.length; i++){
                            // TODO for each E-Mail-Address send an E-Mail to recipient
                            // Create token with surveyID and random Number
                            var hash = md5((Math.random() * req.params.id) + '');
                            var u = req.user.title + ' ' + req.user.firstName + ' ' + req.user.lastName;
                            console.log(rows[i].email + " .. " + hash + " .. " + u);
                            sendMail(rows[i].email, hash, u, req.user.email, survey.title);

                            connection.query('INSERT INTO tokens SET surveyId = ?, token = ?', [req.params.id ,hash], function(err, rows, fields){
                                if (err) throw err;
                            });
                        }
                        res.jsonp(rows);
                    }
            });

            });
        },


        takePart : function(req, res){
            // req.body[0] = token
            // req.body[1] = answers
            // req.body[2] = surveyID
            // req.body[3] = questionID

            for(var i = 0; i < req.body[1].length; i++){
                var v = (req.body[1][i].type === 'Slider') ? req.body[1][i].rate : req.body[1][i].input;
                var answer = {value : v, surveyID : req.body[2], questionID : req.body[1][i].id};
                connection.query('INSERT INTO answers SET ?', [answer], function(err, rows, fields){
                    if (err) throw err;
                });
            }
            connection.query('DELETE FROM tokens WHERE token = ? AND keepAfterUse = ?', [req.body[0], false], function(err, rows, fields){
                if (err) throw err;
                res.jsonp(rows);
            });
        }
    };
};
