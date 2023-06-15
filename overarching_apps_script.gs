function startGame(sheetid) {
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var setupsheet = curspreadsheet.getSheetByName('Game setup');
  var numofplayers = setupsheet.getRange("B1").getValue(); // find number of players
  var playsheet = curspreadsheet.getSheetByName('Play area');
  var configsheet = curspreadsheet.getSheetByName('Config');
  var roundcounterloc = configsheet.getRange("B11").getValue().toString(); // Read location of round counter
  playsheet.getRange(roundcounterloc).setValue("1"); // Set current round to 1
  var roundtableloc = configsheet.getRange("B12").getValue().toString(); // Read location of payout table
  playsheet.getRange(roundtableloc).clearContent();// Clear payout table values
  var lastauctionstable = configsheet.getRange("B13").getValue().toString(); // Read location of last auctions table
  playsheet.getRange(lastauctionstable).clearContent();// Clear last auctions table
  var statesheet = curspreadsheet.getSheetByName('Game state');
  statesheet.getDataRange().offset(1, 0).clearContent(); // Clear everything but the first row of statesheet
  statesheet.getRange("CH1").setValue(numofplayers);

  var templatesheet = curspreadsheet.getSheetByName('Template player');
  for(var t=0;t<numofplayers;t++){
    const copysheet = templatesheet.copyTo(curspreadsheet);
    copysheet.setName(setupsheet.getRange(4+t,3).getValue());
    copysheet.getRange('K1').setValue(copysheet.getSheetId());
    copysheet.getRange('B200').setValue(String.fromCharCode(65+t));
    copysheet.showSheet();
  }

  for(var t=0;t<70;t++){
    statesheet.getRange(2,12+t).setValue("D"); // Put all cards in the deck
  }

  for(var t=0;t<numofplayers;t++){
    statesheet.getRange(2,3+t*2).setValue(100); // Give all players 100 starting money
  }

  var num = Math.floor(Math.random() * numofplayers); // Generate a random integer between 0 and numofplayers-1
  var startingplayer = String.fromCharCode(65 + num); // Convert the integer to a letter between A and E (A=65 in ASCII code)
  statesheet.getRange("A2").setValue("1".concat(startingplayer)); // Set the starting state

  var draws = []; // Initialize an empty array to store the draws
  const cardnums = Array.from({length: 70}, (_, i) => i + 1);
  if(numofplayers == 3){
    var totaldraws = 30;
    var cardsperplayer = 10;
  }
  if(numofplayers == 4){
    var totaldraws = 36;
    var cardsperplayer = 9;
  }
  if(numofplayers == 5){
    var totaldraws = 40;
    var cardsperplayer = 8;
  }

  for (let i = 0; i < totaldraws; i++) {
    const randomIndex = Math.floor(Math.random() * cardnums.length);
    draws.push(cardnums.splice(randomIndex, 1)[0]);
  }
  
  // while (i < totaldraws) { // Continue generating draws until you have 40 unique ones
  //   var draw = Math.floor(Math.random() * 70) + 1; // Generate a random number between 1 and 70
    
  //   if (draws.indexOf(draw) === -1) { // Check if the draw is not already in the array
  //     draws.push(draw); // Add the draw to the array if it's unique
  //     i++; // Increment the counter
  //   }
  // }
  var k = 0; // Initialize a counter for filling in the drawn hand cards
  for(var j=0;j<numofplayers;j++){
    for(var l=0;l<cardsperplayer;l++){
      statesheet.getRange(2,11+draws[k]).setValue("H".concat(String.fromCharCode(65+j)));
      k++;
    }
  }
  var textofmessage = "**Game started**! Players: ".concat(setupsheet.getRange('C4').getValue().toString());
  for (var l=1;l<numofplayers;l++){
    textofmessage = textofmessage.concat(", ",setupsheet.getRange(4+l,3).getValue().toString());
  }
  setupsheet.hideSheet();
  playsheet.showSheet();
  templatesheet.hideSheet();
  sendWebhookMessage(textofmessage,sheetid);
}

function doesUserMatchPlayer(username,player,sheetid){
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var setupsheet = curspreadsheet.getSheetByName('Game setup');
  var namingarray = setupsheet.getRange('B4:C8').getValues();
  var usercode = namingarray.filter(function (el){return el[1].toString()==username.toString()})[0][0];
  return (usercode == player)
}

function button1(xinput, user, purpose,sheetid) {
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var configsheet = curspreadsheet.getSheetByName('Config');
  var playsheet = curspreadsheet.getSheetByName('Play area');
  var loc = configsheet.getRange("B1").getValue(); // find button location from config
  var buttonfunction = playsheet.getRange(loc).getValue(); // get button function from smartcel

  if (buttonfunction.toString() == "Submit card"){ // check if function is to start an auction
    if(typeof purpose !== "undefined"){
      if(!(purpose.toString()=="Submit card")){
        throw new Error("Command incorrect!")
      }
    }
    if(typeof xinput === "undefined"){ // get input from popup if not provided
      var ui = SpreadsheetApp.getUi();
      var result = ui.prompt('Enter card number:', ui.ButtonSet.OK_CANCEL);
      if (!(result.getSelectedButton() == ui.Button.OK)) {
        throw new Error("Please press OK after input!")
      }
      var auctioncard = result.getResponseText(); // get response from popup
    } else {
      var auctioncard = xinput.toString();
    }

    var statesheet = curspreadsheet.getSheetByName('Game state');
    var curstate = statesheet.getRange("CF1").getValue().toString(); // find the position of the current state
    var auctioneer = statesheet.getRange(curstate,1).getValue().substr(-1,1);

    if(typeof user !== "undefined"){
      if(!doesUserMatchPlayer(user,auctioneer,sheetid)){
        throw new Error("Not your turn!");
      }
    }
    if(!(Number.isInteger(Number(auctioncard)) && Number(auctioncard) >= 1 && Number(auctioncard)<=70)){
      throw new Error("Invalid card input!")
    }
    if(!(statesheet.getRange(curstate,parseInt(auctioncard)+11).getValue().substring(0,2) == "H".concat(auctioneer))){
      throw new Error("Not your card!")
    }      
    var auctype = findAuctionType(auctioncard.toString(),sheetid);
    if(!isEndRound(parseInt(auctioncard),sheetid)){
      startAuction(parseInt(auctioncard),auctype,sheetid);
    } else {endRound(parseInt(auctioncard),sheetid)}

    // if(playsheet.getRange("B5").getValue().toString() == "Invalid input"){
    //   throw new Error("Invalid input!")
    // }
    // var cardtoauctioninputcell = configsheet.getRange("B10").getValue(); // find card inputcel from config
    // var auctioncard = playsheet.getRange(cardtoauctioninputcell).getValue(); // get number of card to auction
    // playsheet.getRange(cardtoauctioninputcell).clearContent(); // clear number of card to auction from sheet
    // var auctype = findAuctionType(auctioncard.toString());
    // if(!isEndRound(auctioncard)){
    //   startAuction(auctioncard,auctype);
    //   } else {endRound(auctioncard)}
  }

  if (buttonfunction.toString() == "Submit festpreis"){// check if function is to submit festpreis
    if(typeof purpose !== "undefined"){
      if(!(purpose.toString()=="Submit festpreis")){
        throw new Error("Command incorrect!")
      }
    }
    if(typeof xinput === "undefined"){ // get input from popup if not provided
      var ui = SpreadsheetApp.getUi();
      var result = ui.prompt('Enter festpreis:', ui.ButtonSet.OK_CANCEL);
      if (!(result.getSelectedButton() == ui.Button.OK)) {
        throw new Error("Please press OK after input!")
      }
      var festpreis = result.getResponseText(); // get response from popup
    } else {
      var festpreis = xinput.toString();
    }

    var statesheet = curspreadsheet.getSheetByName('Game state');
    var curstate = statesheet.getRange("CF1").getValue().toString(); // find the position of the current state
    var auctioneer = statesheet.getRange(curstate,1).getValue().substr(-1,1);
    if(typeof user !== "undefined"){
      if(!doesUserMatchPlayer(user,auctioneer,sheetid)){
        throw new Error("Not your turn!");
      }
    }

    if(!(Number.isInteger(Number(festpreis)) && Number(festpreis) >= 1)){
      throw new Error("Invalid input!")
    }
    if(parseInt(statesheet.getRange(parseInt(curstate),(auctioneer.charCodeAt(0)-65)*2+3).getValue()) < parseInt(festpreis)){
      throw new Error("Not enough cash!")
    } 
    setFestpreis(parseInt(festpreis),sheetid);

    // var cardtoauctioninputcell = configsheet.getRange("B10").getValue(); // find card inputcel from config
    // var festpreis = playsheet.getRange(cardtoauctioninputcell).getValue(); // get festpreis
    // if(playsheet.getRange("B5").getValue().toString() == "Invalid input"){
    //   throw new Error("Invalid input!")
    // }
    // playsheet.getRange(cardtoauctioninputcell).clearContent(); // clear festpreis from sheet
    // setFestpreis(festpreis);
  }

  if(buttonfunction.toString() == "Buy card"){// check if function is to buy festpreis card
    if(typeof purpose !== "undefined"){
      if(!(purpose.toString()=="Buy card")){
        throw new Error("Command incorrect!")
      }
    }
    var statesheet = curspreadsheet.getSheetByName('Game state');
    var curstate = statesheet.getRange("CF1").getValue().toString(); // find the position of the current state
    var curstatecode = statesheet.getRange("A".concat(curstate)).getValue().toString(); // get current state code
    var buyer = curstatecode.substring(2,3); // get buyer code
    if(typeof user !== "undefined"){
      if(!doesUserMatchPlayer(user,buyer,sheetid)){
        throw new Error("Not your turn!");
      }
    }
    var seller = curstatecode.substring(1,2); // get seller code
    var price = statesheet.getRange(parseInt(curstate),(seller.charCodeAt(0)-65)*2+2).getValue().toString(); // get the festpreis
    if(parseInt(statesheet.getRange(parseInt(curstate),(buyer.charCodeAt(0)-65)*2+3).getValue()) < parseInt(price)){
      throw new Error("Not enough cash!")
    }
    buyCard(seller,buyer,price,sheetid);
  }

  if(buttonfunction.toString().substr(-3,3) == "Bid"){// check if function is to add player A bid
    addBid("A",undefined,undefined,sheetid);
    var statesheet = curspreadsheet.getSheetByName('Game state');
    var curstate = statesheet.getRange("CF1").getValue().toString(); // find the position of the current state
  }

  if(buttonfunction.toString().substr(-11,11) == "second card"){// check if function is to add second card for a double auction
    if(typeof purpose !== "undefined"){
      if(!(purpose.toString()=="Submit second card")){
        throw new Error("Command incorrect!")
      }
    }
    if(typeof xinput === "undefined"){ // get input from popup if not provided
      var ui = SpreadsheetApp.getUi();
      var result = ui.prompt('Enter card number:', ui.ButtonSet.OK_CANCEL);
      if (!(result.getSelectedButton() == ui.Button.OK)) {
        throw new Error("Please press OK after input!")
      }
      var auctioncard = result.getResponseText(); // get response from popup
    } else {
      var auctioncard = xinput.toString();
    }

    var statesheet = curspreadsheet.getSheetByName('Game state');
    var cardsheet = curspreadsheet.getSheetByName('Card details');
    var curstate = statesheet.getRange("CF1").getValue().toString(); // find the position of the current state
    var auctioneer = statesheet.getRange(curstate,1).getValue().substr(-1,1);
    if(typeof user !== "undefined"){
      if(!doesUserMatchPlayer(user,auctioneer,sheetid)){
        throw new Error("Not your turn!");
      }
    }

    if(!(Number.isInteger(Number(auctioncard)) && Number(auctioncard) >= 1 && Number(auctioncard)<=70)){
      throw new Error("Invalid card input!")
    }
    if(!(statesheet.getRange(curstate,parseInt(auctioncard)+11).getValue().substring(0,2) == "H".concat(auctioneer))){
      throw new Error("Not your card!")
    }
    var artistnames = Array(1).fill("X").concat(Array(12).fill("Hoyos"),Array(13).fill("Krumpar"),Array(14).fill("Constable"),Array(15).fill("Wou-Ki"),Array(16).fill("Beksinski"));
    var cardnums = Array.from({length: 70}, (_, i) => i + 1);
    //var teststs = statesheet.getRange("L".concat(curstate,":CC",curstate)).getValues()[0].map(function (el,i){if(el.substring(0,1)=="A"){return (i+1)}}).filter(function(value){return value !== undefined})[0];
    var firstauction = cardnums[statesheet.getRange("L".concat(curstate,":CC",curstate)).getValues()[0].map(function (el,i){if(el.substring(0,1)=="A"){return (i)}}).filter(function(value){return value !== undefined})[0]];
    if(artistnames[parseInt(auctioncard)]!=artistnames[firstauction]){
      throw new Error("Card needs to be from the same artist!")
    } 
    if(cardsheet.getRange('C2:C71').getValues().flat()[parseInt(auctioncard)-1] == "D"){
      throw new Error("Second card cannot be a double auction!")
    }   
    var auctype = findAuctionType(auctioncard.toString(),sheetid);
    if(!isEndRound(parseInt(auctioncard),sheetid)){
      startAuction(parseInt(auctioncard),auctype,sheetid);
    } else {endRound(parseInt(auctioncard),sheetid)}

    // if(playsheet.getRange("B5").getValue().toString() == "Invalid input"){
    //   throw new Error("Invalid input!")
    // }
    // var cardtoauctioninputcell = configsheet.getRange("B10").getValue(); // find card inputcel from config
    // var auctioncard = playsheet.getRange(cardtoauctioninputcell).getValue(); // get number of card to auction
    // playsheet.getRange(cardtoauctioninputcell).clearContent(); // clear number of card to auction from sheet
    // var auctype = findAuctionType(auctioncard.toString());
    // if(!isEndRound(auctioncard)){
    //   startAuction(auctioncard,auctype);
    //   } else {endRound(auctioncard)}
  }

  if(buttonfunction.toString() == "Submit bid"){// check if function is to submit once-around bid
    submitOnceAroundBid(undefined,undefined,sheetid);
  }
}

function button2(user,purpose,sheetid) {
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var configsheet = curspreadsheet.getSheetByName('Config');
  var playsheet = curspreadsheet.getSheetByName('Play area');
  var loc = configsheet.getRange("B2").getValue(); // find button location from config
  var buttonfunction = playsheet.getRange(loc).getValue(); // get button function from smartcel

  if(buttonfunction.toString() == "Pass on card"){//check if function is to pass festpreis card
    if(typeof purpose !== "undefined"){
      if(!(purpose.toString()=="Pass on card")){
        throw new Error("Command incorrect!")
      }
    }
    var statesheet = curspreadsheet.getSheetByName('Game state');
    var curstate = statesheet.getRange("CF1").getValue().toString(); // find the position of the current state
    var curstatecode = statesheet.getRange("A".concat(curstate)).getValue().toString(); // get current state code
    var passer = curstatecode.substring(2,3); // get passer code
    if(typeof user !== "undefined"){
      if(!doesUserMatchPlayer(user,passer,sheetid)){
        throw new Error("Not your turn!");
      }
    }
    var seller = curstatecode.substring(1,2); // get seller code
    var price = statesheet.getRange(parseInt(curstate),(seller.charCodeAt(0)-65)*2+2).getValue().toString(); // get the festpreis
    passFestpreis(seller,passer,price,sheetid);
  }

  if(buttonfunction.toString().substr(-3,3) == "Bid"){// check if function is to add player B bid
    addBid("B",undefined,undefined,sheetid);
    var statesheet = curspreadsheet.getSheetByName('Game state');
    var curstate = statesheet.getRange("CF1").getValue().toString(); // find the position of the current state
  }

  if(buttonfunction.toString() == "Pass"){ // check if function is to pass second card in double auction
    passSecondInDouble(user,sheetid);
  }
}

function button3(sheetid) {
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var configsheet = curspreadsheet.getSheetByName('Config');
  var playsheet = curspreadsheet.getSheetByName('Play area');
  var loc = configsheet.getRange("B3").getValue(); // find button location from config
  var buttonfunction = playsheet.getRange(loc).getValue(); // get button function from smartcel

  if(buttonfunction.toString().substr(-3,3) == "Bid"){// check if function is to add player C bid
    addBid("C",undefined,undefined,sheetid);
    var statesheet = curspreadsheet.getSheetByName('Game state');
    var curstate = statesheet.getRange("CF1").getValue().toString(); // find the position of the current state
  }
}

function button4(sheetid) {
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var configsheet = curspreadsheet.getSheetByName('Config');
  var playsheet = curspreadsheet.getSheetByName('Play area');
  var loc = configsheet.getRange("B4").getValue(); // find button location from config
  var buttonfunction = playsheet.getRange(loc).getValue(); // get button function from smartcel

  if(buttonfunction.toString().substr(-3,3) == "Bid"){// check if function is to add player D bid
    addBid("D",undefined,undefined,sheetid);
    var statesheet = curspreadsheet.getSheetByName('Game state');
    var curstate = statesheet.getRange("CF1").getValue().toString(); // find the position of the current state
  }
}

function button5(sheetid) {
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var configsheet = curspreadsheet.getSheetByName('Config');
  var playsheet = curspreadsheet.getSheetByName('Play area');
  var loc = configsheet.getRange("B5").getValue(); // find button location from config
  var buttonfunction = playsheet.getRange(loc).getValue(); // get button function from smartcel

  if(buttonfunction.toString().substr(-3,3) == "Bid"){// check if function is to add player E bid
    addBid("E",undefined,undefined,sheetid);
    var statesheet = curspreadsheet.getSheetByName('Game state');
    var curstate = statesheet.getRange("CF1").getValue().toString(); // find the position of the current state
  }
}

function button6() {
  //var artistnames = Array(1).fill("X").concat(Array(12).fill("Hoyos"),Array(13).fill("Krumpar"),Array(14).fill("Constable"),Array(15).fill("Wou-Ki"),Array(16).fill("Beksinski"));
  //Logger.log(artistnames);
}

function button7() {

  // SpreadsheetApp.getActive().getSheetByName('Game setup').getRange('F10').setValue(author);

  // var spreadsheet = SpreadsheetApp.getActive();
  // var templatesheet = spreadsheet.getSheetByName('Template player');
  // var copySheet = templatesheet.copyTo(spreadsheet);
  // copySheet.setName("Copy");
  // copySheet.getRange('K1').setValue(copySheet.getSheetId());

  //var ui = SpreadsheetApp.getUi();
  //var result = ui.prompt('Enter a value:', ui.ButtonSet.OK_CANCEL);

  //if (result.getSelectedButton() == ui.Button.OK) {
  //  var value = result.getResponseText();
  //  if(isIntOrX(value,0,true)){
  //    throw new Error("Yes");
  //  } else {
  //    throw new Error("No");
  //  }
    
  //}
}

function startAuction(auctioncard,auctype,sheetid) {
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var setupsheet = curspreadsheet.getSheetByName('Game setup');
  var statesheet = curspreadsheet.getSheetByName('Game state');
  var curstate = statesheet.getRange("CF1").getValue().toString(); // find the position of the current state
  var laststate = statesheet.getRange("A".concat(curstate,":CC",curstate)).getValues(); // pull the entirety of the current state
  var nextstate = (parseInt(curstate)+1).toString();
  statesheet.getRange("A".concat(nextstate,":CC",nextstate)).setValues(laststate); // set the next state as identical to the current one
  var auctioneer = statesheet.getRange("A".concat(curstate)).getValue().toString().substr(-1); // get the auctioneer code
  var numofplayers = statesheet.getRange("CH1").getValue();
  var auctypetext = "";
  var artistnames = Array(1).fill("X").concat(Array(12).fill("Hoyos"),Array(13).fill("Krumpar"),Array(14).fill("Constable"),Array(15).fill("Wou-Ki"),Array(16).fill("Beksinski"));

  if (auctype == "F"){ // Auction type - Fixed
    auctypetext = "**Festpreis";
    statesheet.getRange("A".concat(nextstate)).setValue("3".concat(auctioneer)); // set the correct next state
    var textofmessage = auctypetext.concat(" auction** started by ",setupsheet.getRange(4+(auctioneer.charCodeAt(0)-65),3).getValue().toString(),". Artist is ",artistnames[auctioncard],".");
    sendWebhookMessage(textofmessage,sheetid);
  }

  if (auctype == "L"){ // Auction type - Hidden
    auctypetext = "**Hidden";
    statesheet.getRange("A".concat(nextstate)).setValue("6".concat(auctioneer)); // set the correct next state
    var textofmessage = auctypetext.concat(" auction** started by ",setupsheet.getRange(4+(auctioneer.charCodeAt(0)-65),3).getValue().toString(),". Artist is ",artistnames[auctioncard],".");
    sendWebhookMessage(textofmessage,sheetid);
  }

  if (auctype == "O"){ // Auction type - Open
    auctypetext = "**Open";
    statesheet.getRange("A".concat(nextstate)).setValue("5".concat(auctioneer)); // set the correct next state
    var textofmessage = auctypetext.concat(" auction** started by ",setupsheet.getRange(4+(auctioneer.charCodeAt(0)-65),3).getValue().toString(),". Artist is ",artistnames[auctioncard],".");
    sendWebhookMessage(textofmessage,sheetid);
  }

  if(auctype == "R"){ // Auction type - Once-around
    auctypetext = "**Once-around";
    statesheet.getRange("A".concat(nextstate)).setValue("2".concat(auctioneer,getNextPlayer(auctioneer,numofplayers))); // set the correct next state
    var textofmessage = auctypetext.concat(" auction** started by ",setupsheet.getRange(4+(auctioneer.charCodeAt(0)-65),3).getValue().toString(),". Artist is ",artistnames[auctioncard],". **",setupsheet.getRange(4+(getNextPlayer(auctioneer,numofplayers).charCodeAt(0)-65),3).getValue().toString(),"'s turn** to bid.");
    sendWebhookMessage(textofmessage,sheetid);
  }

  if(auctype == "D"){ // Auction type - Double
    statesheet.getRange("A".concat(nextstate)).setValue("4".concat(auctioneer,auctioneer)); // set the correct next state
    var textofmessage = auctypetext.concat("**Double card** submitted by ",setupsheet.getRange(4+(auctioneer.charCodeAt(0)-65),3).getValue().toString(),". Artist is ",artistnames[auctioncard],".");
    sendWebhookMessage(textofmessage,sheetid);
  }

  statesheet.getRange(nextstate,11+auctioncard).setValue("A"); // set the auction card's state
  sendWebhookImage(auctioncard,sheetid)
}

function findAuctionType(cardnum,sheetid) {
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var sheet = curspreadsheet.getSheetByName('Card details');
  var values = sheet.getRange("A2:C71").getValues();
  for (var i = 0; i < values.length; i++) {
    if (values[i][0] == cardnum) {
      return values[i][2];
    }
  }
  throw new Error("Something went wrong with the card given for auction!");
}

function setFestpreis(festpreis,sheetid){
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var setupsheet = curspreadsheet.getSheetByName('Game setup');
  var statesheet = curspreadsheet.getSheetByName('Game state');
  var curstate = statesheet.getRange("CF1").getValue().toString(); // find the position of the current state
  var laststate = statesheet.getRange("A".concat(curstate,":CC",curstate)).getValues(); // pull the entirety of the current state
  var nextstate = (parseInt(curstate)+1).toString();
  statesheet.getRange("A".concat(nextstate,":CC",nextstate)).setValues(laststate); // set the next state as identical to the current one
  var auctioneer = statesheet.getRange("A".concat(curstate)).getValue().toString().substr(-1); // get the auctioneer code
  var numofplayers = statesheet.getRange("CH1").getValue()
  var nextplayer = getNextPlayer(auctioneer,numofplayers)
  statesheet.getRange("A".concat(nextstate)).setValue("7".concat(auctioneer,nextplayer)); // set the correct next state
  statesheet.getRange(parseInt(curstate)+1,(auctioneer.charCodeAt(0)-65)*2+2).setValue(festpreis); // set the festpreis as the auctioneer's bid

  sendWebhookMessage("**Festpreis set at ".concat(festpreis.toString(),".** ",setupsheet.getRange(4+(nextplayer.charCodeAt(0)-65),3).getValue().toString(),"'s turn to buy or pass."),sheetid);
}

function getNextPlayer(player,numofplayers){
  var asciiCode = player.charCodeAt(0);
  var nextAsciiCode = ((asciiCode - 65 + 1) % numofplayers) + 65;
  return String.fromCharCode(nextAsciiCode);
}

function buyCard(seller, buyer, price,sheetid){
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var setupsheet = curspreadsheet.getSheetByName('Game setup');
  var statesheet = curspreadsheet.getSheetByName('Game state');
  var curstate = statesheet.getRange("CF1").getValue().toString(); // find the position of the current state
  var numofplayers = statesheet.getRange("CH1").getValue().toString(); // get the number of players
  var laststate = statesheet.getRange("A".concat(curstate,":CC",curstate)).getValues(); // pull the entirety of the current state
  var nextstate = (parseInt(curstate)+1).toString();
  statesheet.getRange("A".concat(nextstate,":CC",nextstate)).setValues(laststate); // set the next state as identical to the current one
  var auctionedcards = [];
  for (var i=12; i<82; i++){
    if (statesheet.getRange(parseInt(nextstate),i).getValue().toString() == "A"){
      auctionedcards.push(i-11);
      statesheet.getRange(parseInt(nextstate),i).setValue("O".concat(buyer)); // set all auctioned cards as owned by buyer
    }
  }
  statesheet.getRange(parseInt(nextstate),(buyer.charCodeAt(0)-65)*2+3).setValue(parseInt(statesheet.getRange(parseInt(nextstate),(buyer.charCodeAt(0)-65)*2+3).getValue().toString())-parseInt(price)); // subtract price from buyer's cash
  if(seller !== buyer){
    statesheet.getRange(parseInt(nextstate),(seller.charCodeAt(0)-65)*2+3).setValue(parseInt(statesheet.getRange(parseInt(nextstate),(seller.charCodeAt(0)-65)*2+3).getValue().toString())+parseInt(price)); // add price to seller's cash
  }
  
  for (var j=0;j<5;j++){
    statesheet.getRange(parseInt(nextstate),2+j*2).clearContent(); // remove all bid data
  }

  var nextplayer = getNextPlayer(seller,numofplayers); // calculate next auctioneer
  statesheet.getRange("A".concat(nextstate)).setValue("1".concat(nextplayer)); // set the correct next state
  addAuctionLog(seller, buyer,price,auctionedcards,sheetid);
  sendWebhookMessage("**".concat(setupsheet.getRange(4+(nextplayer.charCodeAt(0)-65),3).getValue().toString(),"'s turn** to pick card for auction."),sheetid)
}

function passFestpreis(seller,passer,price,sheetid){
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var setupsheet = curspreadsheet.getSheetByName('Game setup');
  var statesheet = curspreadsheet.getSheetByName('Game state');
  var numofplayers = statesheet.getRange("CH1").getValue().toString(); // get the number of players
  if(getNextPlayer(passer,numofplayers) == seller){ // seller buys card themselves if everyone else has passed
    buyCard(seller,seller,price,sheetid);
  } else {
    var curstate = statesheet.getRange("CF1").getValue().toString(); // find the position of the current state
    var laststate = statesheet.getRange("A".concat(curstate,":CC",curstate)).getValues(); // pull the entirety of the current state
    var nextstate = (parseInt(curstate)+1).toString();
    statesheet.getRange("A".concat(nextstate,":CC",nextstate)).setValues(laststate); // set the next state as identical to the current one
    var nextplayer = getNextPlayer(passer,numofplayers)
    statesheet.getRange("A".concat(nextstate)).setValue("7".concat(seller,nextplayer)); // set the correct next state
  }
  sendWebhookMessage("**".concat(setupsheet.getRange(4+(nextplayer.charCodeAt(0)-65),3).getValue().toString(),"'s turn** to buy or pass."),sheetid)
}

function passSecondInDouble(user,sheetid){
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var setupsheet = curspreadsheet.getSheetByName('Game setup');
  var statesheet = curspreadsheet.getSheetByName('Game state');
  var numofplayers = statesheet.getRange("CH1").getValue().toString(); // get the number of players
  var curstate = statesheet.getRange("CF1").getValue().toString(); // find the position of the current state
  var curstatecode = statesheet.getRange("A".concat(curstate)).getValue().toString(); // get current state code
  var passer = curstatecode.substring(2,3); // get passer code
  if(typeof user !== "undefined"){
    if(!doesUserMatchPlayer(user,passer,sheetid)){
      throw new Error("Not your turn!");
    }
  }
  var nextplayer = getNextPlayer(passer,numofplayers)
  var auctioneer = curstatecode.substring(1,2); // get auctioneer code
  if(auctioneer == nextplayer){
    buyCard(auctioneer,auctioneer,0,sheetid);
  } else {
    var laststate = statesheet.getRange("A".concat(curstate,":CC",curstate)).getValues(); // pull the entirety of the current state
    var nextstate = (parseInt(curstate)+1).toString();
    statesheet.getRange("A".concat(nextstate,":CC",nextstate)).setValues(laststate); // set the next state as identical to the current one
    statesheet.getRange("A".concat(nextstate)).setValue("4".concat(auctioneer,nextplayer)); // set the correct next state
    sendWebhookMessage("**".concat(setupsheet.getRange(4+(nextplayer.charCodeAt(0)-65),3).getValue().toString(),"'s turn** to choose a second card or pass."),sheetid)
  }
}

function addBid(user, bid, callsource,sheetid){// create a popup for the player to add their bid
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var setupsheet = curspreadsheet.getSheetByName('Game setup');

  if(typeof callsource === "undefined"){ // get input from popup if not provided
    var ui = SpreadsheetApp.getUi();
    var result = ui.prompt('Enter a bid:', ui.ButtonSet.OK_CANCEL);
    if (!(result.getSelectedButton() == ui.Button.OK)) {
      throw new Error("Please press OK after input!")
    }
    var value = result.getResponseText(); // get response from popup
    var player = user;
  } else {
    var value = bid.toString();
    var namingarray = setupsheet.getRange('B4:C8').getValues();
    var player = namingarray.filter(function (el){return el[1].toString()==user.toString()})[0][0];
  }

  var statesheet = curspreadsheet.getSheetByName('Game state');
  var curstate = statesheet.getRange("CF1").getValue().toString(); // find the position of the current state

  if(statesheet.getRange(parseInt(curstate),1).getValue().substring(0,1) == "6"){
    if(!isIntOrX(value,-1,player,false,sheetid)){
      throw new Error("Invalid input: please bid a number between 0 and your cash.")
    }
    sendWebhookMessage("**".concat(setupsheet.getRange(4+(player.charCodeAt(0)-65),3).getValue().toString()," bids** in hidden auction."),sheetid)
    statesheet.getRange(parseInt(curstate),(player.charCodeAt(0)-65)*2+2).setValue(value); // set the bid
    checkHiddenAuctionOver(sheetid);
  }

  if(statesheet.getRange(parseInt(curstate),1).getValue().substring(0,1) == "5"){
    var bids = []; // init an empty array to store past bids
    var strictupperbound = 0;
    for(var i=0;i<5;i++){
      if(!isNaN(parseInt(statesheet.getRange(parseInt(curstate),2+2*i).getValue().toString()))){ // push all numerical bids in the current state to the bids array
        bids.push(parseInt(statesheet.getRange(parseInt(curstate),2+2*i).getValue().toString()));
      }
    }
    if(bids.length > 0){
      strictupperbound = Math.max.apply(null, bids);
    }
    if(!isIntOrX(value,strictupperbound,player,true,sheetid)){
      throw new Error('Invalid input: you need to bid between the highest current bid and your cash or pass with "X".')
    }
    sendWebhookMessage("**".concat(setupsheet.getRange(4+(player.charCodeAt(0)-65),3).getValue().toString()," bids ",value.toString(),"** in open auction."),sheetid)
    statesheet.getRange(parseInt(curstate),(player.charCodeAt(0)-65)*2+2).setValue(value); // set the bid
    checkOpenAuctionOver(sheetid);
  }
}

function isIntOrX(value,strictlowerbound,bidder,includeX,sheetid) {
  var curspreadsheet = SpreadsheetApp.openById(sheetid);

  if (includeX && value === "X") {
    return true;
  } else if (typeof value === "string" && Number.isInteger(Number(value)) && Number(value) > strictlowerbound) {
    var statesheet = curspreadsheet.getSheetByName('Game state');
    var curstate = statesheet.getRange("CF1").getValue().toString(); // find the position of the current state
    var biddercash = parseInt(statesheet.getRange(curstate,(bidder.charCodeAt(0)-65)*2+3).getValue())
    if (Number(value)>biddercash){
      return false;
    } else {
    return true;
    }
  } else {
    return false;
  }
}


function checkHiddenAuctionOver(sheetid){  
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var statesheet = curspreadsheet.getSheetByName('Game state');
  var curstate = statesheet.getRange("CF1").getValue().toString(); // find the position of the current state
  var numofplayers = parseInt(statesheet.getRange("CH1").getValue().toString()); // get number of players
  var auctioneer = statesheet.getRange(parseInt(curstate),1).getValue().toString().substring(1,2);
  var bids = []; // init an empty array to store current bids
  for(var i=0; i<numofplayers;i++){
    if(statesheet.getRange(parseInt(curstate),2+2*((auctioneer.charCodeAt(0)-65+i)%numofplayers)).getValue().toString()!=''){
    bids.push(parseInt(statesheet.getRange(parseInt(curstate),2+2*((auctioneer.charCodeAt(0)-65+i)%numofplayers)).getValue().toString()));
  }}
  if(bids.length == numofplayers){
  buyCard(auctioneer, String.fromCharCode(findMax(bids,auctioneer,numofplayers)+65),Math.max.apply(null,bids),sheetid)
  }
}

function checkOpenAuctionOver(sheetid){
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var statesheet = curspreadsheet.getSheetByName('Game state');
  var curstate = statesheet.getRange("CF1").getValue().toString(); // find the position of the current state
  var numofplayers = parseInt(statesheet.getRange("CH1").getValue().toString()); // get number of players
  var auctioneer = statesheet.getRange(parseInt(curstate),1).getValue().toString().substring(1,2);
  var bidders = []; // init an empty array to store current bidders (as opposed to passers)
  var bids = []; // init an empty array to store current bids
  for(var i=0;i<numofplayers;i++){
    if(!(statesheet.getRange(parseInt(curstate),2+2*i).getValue().toString() === "X")){ // push all bidders to the bidders array
      bidders.push(i)
      if(!isNaN(parseInt(statesheet.getRange(parseInt(curstate),2+2*i).getValue().toString()))){
        bids.push(parseInt(statesheet.getRange(parseInt(curstate),2+2*i).getValue().toString()));
      }
    }
  }
  if(bidders.length == 1){
    buyCard(auctioneer,String.fromCharCode(bidders[0]+65),bids[0],sheetid)
  }
}




function findMax(arr,auctioneer,numofplayers){
   var max = Math.max.apply(null,arr);
   var index = arr.indexOf(max);
   var playerindex = (index+auctioneer.charCodeAt(0)-65)%numofplayers;
   return playerindex;
  }

// function generateString() {
//   var statesheet = SpreadsheetApp.getActive().getSheetByName('Game state');
//   var setupsheet = SpreadsheetApp.getActive().getSheetByName('Game setup');
//   var numofplayers = parseInt(statesheet.getRange("CH1").getValue().toString()); // get number of players
//   var curstate = statesheet.getRange("CF1").getValue().toString(); // find the position of the current state
//   var cashstate = statesheet.getRange("A".concat(curstate,":K",curstate)).getValues(); // pull the entirety of the current state
//   var cashpositions = Array.from({ length: numofplayers }, (_, i) => cashstate[0][2 * i + 2]);
//   var playernames = setupsheet.getRange(4,3,numofplayers,1).getValues().flat();
//   Logger.log(cashpositions);
//   Logger.log(playernames);
//   var arr1 = ["A","B","C","D"];
//   var arr2 = [132,155,140,201];

//   var result = playernames.map((value, index) => {
//     return `${value} (${cashpositions[index]})`;
//   }).sort((a, b) => {
//     var aValue = parseInt(a.match(/\d+/));
//     var bValue = parseInt(b.match(/\d+/));
//     return bValue - aValue;
//   }).join(", ");

//   Logger.log(result);
// }

function endRound(auctioncard,sheetid){
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var statesheet = curspreadsheet.getSheetByName('Game state');
  var setupsheet = curspreadsheet.getSheetByName('Game setup');
  var playsheet = curspreadsheet.getSheetByName('Play area');
  var numofplayers = parseInt(statesheet.getRange("CH1").getValue().toString()); // get number of players
  var curstate = statesheet.getRange("CF1").getValue().toString(); // find the position of the current state
  var laststate = statesheet.getRange("A".concat(curstate,":CC",curstate)).getValues(); // pull the entirety of the current state
  var nextstate = (parseInt(curstate)+1).toString();
  var auctioneer = statesheet.getRange(parseInt(curstate),1).getValue().toString().substr(-1,1);
  statesheet.getRange("A".concat(nextstate,":CC",nextstate)).setValues(laststate); // set the next state as identical to the current one
  statesheet.getRange(parseInt(nextstate), 11+auctioncard).setValue("G");// sets value of round ending card to "O" for card counting purposes. This needs to run before that artistOrder calc below
  var nextplayer = getNextPlayer(auctioneer,numofplayers)
  var topthree = artistOrder(curstate,auctioncard,sheetid);
  var round= playsheet.getRange("J3").getValue();//get round number
  playsheet.getRange(parseInt(round)+3,topthree[0]+11).setValue(30); //places a 30 in top artist column
  if(topthree.length>1){
    playsheet.getRange(parseInt(round)+3,topthree[1]+11).setValue(20);
  }
  if (topthree.length>2){
    playsheet.getRange(parseInt(round)+3,topthree[2]+11).setValue(10);
  }
  payOut(round,topthree,curstate,numofplayers,sheetid);
  dealCards(round,numofplayers,sheetid);
  discardOwnedCards(sheetid);
  if(round.toString()=="4"){
    var cashstate = statesheet.getRange("A".concat(nextstate,":K",nextstate)).getValues(); // pull the entirety of the current state
    var cashpositions = Array.from({ length: numofplayers }, (_, i) => cashstate[0][2 * i + 2]);
    var playernames = setupsheet.getRange(4,3,numofplayers,1).getValues().flat();

    var result = playernames.map((value, index) => {
      return [value,cashpositions[index]];
    }).sort((a, b) => {
      var aValue = a[1];
      var bValue = b[1];
      return bValue - aValue;
    }).map((value) => {return value[0].concat(" (",value[1],")")
    }).join(", ");

    statesheet.getRange("A".concat(nextstate)).setValue("8");
    sendWebhookMessage("Game over!".concat(" ",result,"."),sheetid);
  } else {
    statesheet.getRange("A".concat(nextstate)).setValue("1".concat(nextplayer));
    playsheet.getRange("J3").setValue(parseInt(round)+1); //updates the round counter in cell J3
    sendWebhookMessage("New round started. **".concat(setupsheet.getRange(4+(nextplayer.charCodeAt(0)-65),3).getValue().toString(),"'s turn** to pick a card for auction."),sheetid)
  }
}


function isEndRound(auctioncard,sheetid){
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var statesheet = curspreadsheet.getSheetByName('Game state');
  var auctioncardcount=0
  var curstate = statesheet.getRange("CF1").getValue().toString(); // find the position of the current state
  if(0<auctioncard && auctioncard<13){
    for(i=0;i<12;i++){
      if(statesheet.getRange(parseInt(curstate),12+i).getValue().substring(0,1)=="O"||statesheet.getRange(parseInt(curstate),12+i).getValue().substring(0,1)=="A"){ 
        auctioncardcount++;
      }//I built out these functions below , but I did this first because dumb and im leaving this for now in case im a dummy again
    } 
  } else if(12<auctioncard && auctioncard<26){
    for(i=0;i<13;i++){
      if(statesheet.getRange(parseInt(curstate),24+i).getValue().substring(0,1)=="O"||statesheet.getRange(parseInt(curstate),24+i).getValue().substring(0,1)=="A"){
        auctioncardcount++;
      }
    } 
  } else if (25<auctioncard && auctioncard<40){
    for(i=0;i<14;i++){
      if(statesheet.getRange(parseInt(curstate),37+i).getValue().substring(0,1)=="O"||statesheet.getRange(parseInt(curstate),37+i).getValue().substring(0,1)=="A"){
        auctioncardcount++;
      }
    } 
  } else if (39<auctioncard && auctioncard<55){
    for(i=0;i<15;i++){
      if(statesheet.getRange(parseInt(curstate),51+i).getValue().substring(0,1)=="O"||statesheet.getRange(parseInt(curstate),51+i).getValue().substring(0,1)=="A"){
        auctioncardcount++;
      }
    } 
  } else {
    for(i=0;i<16;i++){
      if(statesheet.getRange(parseInt(curstate),66+i).getValue().substring(0,1)=="O"||statesheet.getRange(parseInt(curstate),66+i).getValue().substring(0,1)=="A"){
        auctioncardcount++;
      }
    } 
  }
  if(auctioncardcount==4){
    return true
  } else {
    return false
  }
}



function countHoyos(curstate,sheetid){
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var statesheet = curspreadsheet.getSheetByName('Game state');
  var cardcount=0;
  for(i=0;i<12;i++){
      if(statesheet.getRange(parseInt(curstate),12+i).getValue().toString().substring(0,1)=="O"||statesheet.getRange(parseInt(curstate),12+i).getValue().toString().substring(0,1)=="A"){
        cardcount++;
      }
    } 
    return cardcount;
}

function countKrump(curstate,sheetid){
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var statesheet = curspreadsheet.getSheetByName('Game state');
  var cardcount=0;
  for(i=0;i<13;i++){
      if(statesheet.getRange(parseInt(curstate),24+i).getValue().toString().substring(0,1)=="O"||statesheet.getRange(parseInt(curstate),24+i).getValue().toString().substring(0,1)=="A"){
        cardcount++;
      }
    }
    return cardcount;
}

function countConst(curstate,sheetid){
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var statesheet = curspreadsheet.getSheetByName('Game state');
  var cardcount=0;
  for(i=0;i<14;i++){
      if(statesheet.getRange(parseInt(curstate),37+i).getValue().toString().substring(0,1)=="O"||statesheet.getRange(parseInt(curstate),37+i).getValue().toString().substring(0,1)=="A"){
        cardcount++;
      }
    }
    return cardcount;
}


function countWou(curstate,sheetid){
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var statesheet = curspreadsheet.getSheetByName('Game state');
  var cardcount=0;
  for(i=0;i<15;i++){
      if(statesheet.getRange(parseInt(curstate),51+i).getValue().toString().substring(0,1)=="O"||statesheet.getRange(parseInt(curstate),51+i).getValue().toString().substring(0,1)=="A"){
        cardcount++;
      }
    }
    return cardcount;
}



function countBadingadoo(curstate,sheetid){
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var statesheet = curspreadsheet.getSheetByName('Game state');
  var cardcount=0;
  for(i=0;i<16;i++){
      if(statesheet.getRange(parseInt(curstate),66+i).getValue().toString().substring(0,1)=="O"||statesheet.getRange(parseInt(curstate),66+i).getValue().toString().substring(0,1)=="A"){
        cardcount++;
      }
    }
    return cardcount;
}



function artistOrder(curstate,auctioncard,sheetid){
  var artisttotals = [countHoyos(curstate,sheetid)+.5,countKrump(curstate,sheetid)+.4,countConst(curstate,sheetid)+.3,countWou(curstate,sheetid)+.2,countBadingadoo(curstate,sheetid)+.1];
  if(0<auctioncard && auctioncard<13){
    artisttotals[0] = 5;
  } else if(12<auctioncard && auctioncard<26){
    artisttotals[1] = 5;
  } else if (25<auctioncard && auctioncard<40){
    artisttotals[2] = 5;
  } else if (39<auctioncard && auctioncard<55){
    artisttotals[3] = 5;
  } else {
    artisttotals[4] = 5;
  }
  let sortedArr = [...artisttotals].sort((a, b) => b - a); // Sort the array in descending order
  let topthree = [artisttotals.indexOf(sortedArr[0]), artisttotals.indexOf(sortedArr[1]), artisttotals.indexOf(sortedArr[2])]; // Get the indexes of the first three elements
  if(artisttotals[topthree[1]]<.6){
    topthree.splice(1,2);
  }
  else if (artisttotals[topthree[2]]<.6){
    topthree.splice(2,1);
  }
return topthree
}

function payOut(round,topthree,curstate,numofplayers,sheetid){
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var statesheet = curspreadsheet.getSheetByName('Game state');
  var playsheet = curspreadsheet.getSheetByName('Play area');
  var payvec = Array(numofplayers).fill(0);
  for(i=0;i<topthree.length;i++){
    var artistvalue = 0;
    for(j=0; j<parseInt(round); j++){
      if(playsheet.getRange(j+4,topthree[i]+11).getValue()!=""){
      artistvalue += parseInt(playsheet.getRange(j+4,topthree[i]+11).getValue());
      }
    }
     var playercards=[];
    for(k=0;k<numofplayers;k++){
      var playerchar = String.fromCharCode(65+k);
      var cardcount =0;
      if(topthree[i]==0){
        for(l=0;l<12;l++){
          if(statesheet.getRange(parseInt(curstate),12+l).getValue().toString()==("O".concat(playerchar))){ 
            cardcount++;
          }
        } 
      } else if(topthree[i]==1){
        for(l=0;l<13;l++){
          if(statesheet.getRange(parseInt(curstate),24+l).getValue().toString()==("O".concat(playerchar))){
            cardcount++;
          }
        } 
      } else if (topthree[i]==2){
        for(l=0;l<14;l++){
          if(statesheet.getRange(parseInt(curstate),37+l).getValue().toString()==("O".concat(playerchar))){
            cardcount++;
          }
        } 
      } else if (topthree[i]==3){
        for(l=0;l<15;l++){
          if(statesheet.getRange(parseInt(curstate),51+l).getValue().toString()==("O".concat(playerchar))){
            cardcount++;
          }
        } 
      } else {
        for(l=0;l<16;l++){
          if(statesheet.getRange(parseInt(curstate),66+l).getValue().toString()==("O".concat(playerchar))){
            cardcount++;
          }
        } 
      } 
    playercards.push(cardcount);
    }
    var artpay = playercards.map(x => x * artistvalue);
   payvec=payvec.map((num, index)=>num+artpay[index]); // javascript can get fucked.  Adds payout for ith artist to payvec
  }
  for(i=0; i<numofplayers; i++){
    statesheet.getRange(parseInt(curstate)+1,2*i+3).setValue(parseInt(statesheet.getRange(parseInt(curstate),2*i+3).getValue())+payvec[i])// adds end of round payments to next game state line
  }
}

function submitOnceAroundBid(bid, user,sheetid){
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var statesheet = curspreadsheet.getSheetByName('Game state');
  var setupsheet = curspreadsheet.getSheetByName('Game setup');
  var curstate = statesheet.getRange("CF1").getValue().toString(); // find the position of the current state
  var curstatecode = statesheet.getRange("A".concat(curstate)).getValue().toString(); // get current state code
  var numofplayers = parseInt(statesheet.getRange("CH1").getValue().toString()); // get number of players
  var bidder = curstatecode.substring(2,3); // get bidder code
  if(typeof user !== "undefined"){
    if(!doesUserMatchPlayer(user,bidder,sheetid)){
      throw new Error("Not your turn!");
    }
  }
  if(typeof bid === "undefined"){ // get input from popup if not provided
    var ui = SpreadsheetApp.getUi();
    var result = ui.prompt('Enter a bid:', ui.ButtonSet.OK_CANCEL);
    if (!(result.getSelectedButton() == ui.Button.OK)) {
      throw new Error("Please press OK after input!")
    }
    var value = result.getResponseText(); // get response from popup
  } else {
    var value = bid.toString();
  }

  var bids = []; // init an empty array to store past bids
  var strictupperbound = 0;
  for(var i=0;i<5;i++){
    if(!isNaN(parseInt(statesheet.getRange(parseInt(curstate),2+2*i).getValue().toString()))){ // push all numerical bids in the current state to the bids array
      bids.push(parseInt(statesheet.getRange(parseInt(curstate),2+2*i).getValue().toString()));
    }
  }
  if(bids.length > 0){
    strictupperbound = Math.max.apply(null, bids);
  }
  if(!isIntOrX(value,strictupperbound,bidder,true,sheetid)){
    throw new Error('Invalid input: you need to bid more than the highest current bid or pass with "X".')
  }
  var laststate = statesheet.getRange("A".concat(curstate,":CC",curstate)).getValues(); // pull the entirety of the current state
  var nextstate = (parseInt(curstate)+1).toString();
  var auctioneer = statesheet.getRange(parseInt(curstate),1).getValue().toString().substr(-2,1);
  if(bidder == auctioneer){
    var allbids = [];
    var allnumbids = [];
    var playerChars = ["A","B","C","D","E"];
    for (var i=0;i<numofplayers;i++){
      if(playerChars[i] == auctioneer){
        allbids.push(value);
        if(!isNaN(parseInt(value))){
          allnumbids.push(parseInt(value));
        }
      } else {
        allbids.push(statesheet.getRange(parseInt(curstate),2+2*i).getValue().toString())
        if(!isNaN(parseInt(statesheet.getRange(parseInt(curstate),2+2*i).getValue().toString()))){
          allnumbids.push(parseInt(statesheet.getRange(parseInt(curstate),2+2*i).getValue().toString()));
        }
      }
    }
    var max = Math.max.apply(null,allnumbids);
    var buyer = allbids.indexOf(max.toString());
    buyCard(auctioneer,String.fromCharCode(buyer+65),max,sheetid);
  } else {
    statesheet.getRange("A".concat(nextstate,":CC",nextstate)).setValues(laststate); // set the next state as identical to the current one
    statesheet.getRange(parseInt(nextstate),(bidder.charCodeAt(0)-65)*2+2).setValue(value); // set new bid
    statesheet.getRange(parseInt(nextstate),1).setValue("2".concat(auctioneer,getNextPlayer(bidder,numofplayers))) // set the next state code
    sendWebhookMessage("**".concat(setupsheet.getRange(4+(bidder.charCodeAt(0)-65),3).getValue().toString()," bids ",value.toString(),"** in a once-around auction. **",setupsheet.getRange(4+(getNextPlayer(bidder,numofplayers).charCodeAt(0)-65),3).getValue().toString(),"'s turn** to bid."),sheetid)
  }

}

function dealCards(round,numofplayers,sheetid){
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var statesheet = curspreadsheet.getSheetByName('Game state');
  var curstate = statesheet.getRange("CF1").getValue().toString(); // find the position of the current state
  var deckcards = [];
  for(var t=0;t<70;t++){
    if(statesheet.getRange(curstate,12+t).getValue().toString()=="D"){
      deckcards.push(t);
    }
  }
  var draws = []; // Initialize an empty array to store the draws
  var i = 0; // Initialize a counter for the number of draws
  if(round.toString() == "4" || round.toString() == "3"){
    return
  }
  if(numofplayers == 3){
    var totaldraws = 18;
    var cardsperplayer = 6;
  }
  if(numofplayers == 4){
    var totaldraws = 16;
    var cardsperplayer = 4;
  }
  if(numofplayers == 5){
    var totaldraws = 15;
    var cardsperplayer = 3;
  }
  
  while (i < totaldraws) { // Continue generating draws until you have 40 unique ones
    var draw = Math.floor(Math.random() * deckcards.length); // Generate a random number between 0 and however many cards are in the deck
    
    if (draws.indexOf(draw) === -1) { // Check if the draw is not already in the array
      draws.push(draw); // Add the draw to the array if it's unique
      i++; // Increment the counter
    }
  }
  var k = 0; // Initialize a counter for filling in the drawn hand cards
  for(var j=0;j<numofplayers;j++){
    for(var l=0;l<cardsperplayer;l++){
      statesheet.getRange(curstate,12+deckcards[draws[k]]).setValue("H".concat(String.fromCharCode(65+j)));
      k++;
    }
  }
}

function discardOwnedCards(sheetid){
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var statesheet = curspreadsheet.getSheetByName('Game state');
  var curstate = statesheet.getRange("CF1").getValue().toString(); // find the position of the current state
  for(var t=0;t<70;t++){
    if(statesheet.getRange(curstate,12+t).getValue().toString().substring(0,1) == "O"||statesheet.getRange(curstate,12+t).getValue().toString().substring(0,1) == "A"){
      statesheet.getRange(curstate,12+t).setValue("G");
    }
  }
}

function addAuctionLog(seller, buyer,price,auctionedcards,sheetid){
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var playsheet = curspreadsheet.getSheetByName('Play area');
  var setupsheet = curspreadsheet.getSheetByName('Game setup');
  var oldlog1 = playsheet.getRange("J10:M10").getValues();
  var oldlog2 = playsheet.getRange("J11:M11").getValues();
  playsheet.getRange("J11:M11").setValues(oldlog1);
  playsheet.getRange("J12:M12").setValues(oldlog2);
  var newsale = [setupsheet.getRange(seller.charCodeAt(0)-61,3).getValue().toString(),setupsheet.getRange(buyer.charCodeAt(0)-61,3).getValue().toString(),price.toString(),"'".concat(auctionedcards.join(' '))]
  playsheet.getRange("J10:M10").setValues([newsale]);
  // playsheet.getRange("K12").setValue(setupsheet.getRange(buyer.charCodeAt(0)-61,3).getValue().toString());
  // playsheet.getRange("L12").setValue(price.toString());
  // playsheet.getRange("M12").setValue("'".concat(auctionedcards.join(' ')));
}

function handpackage(player,sheetid){
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var setupsheet = curspreadsheet.getSheetByName('Game setup');
  var namingarray = setupsheet.getRange('B4:C8').getValues();
  var authorcode = namingarray.filter(function (el){return el[1].toString()==player.toString()})[0][0];

  var statesheet = curspreadsheet.getSheetByName('Game state');
  var curstate = statesheet.getRange("CF1").getValue().toString();
  var cardcoderow = statesheet.getRange("L".concat(curstate,":CC",curstate)).getValues()[0];
  var handcardnums = cardcoderow.map(function (el,i){if(el=="H".concat(authorcode)){return i+1}}).filter(function(value){return value !== undefined});

  var cardsheet = curspreadsheet.getSheetByName('Card details');
  var linksarray = cardsheet.getRange('D2:D71').getValues();
  var links = handcardnums.map(function (el){return linksarray[el-1][0]});
  return [handcardnums,links]
}

function cashpackage(player,sheetid){
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var setupsheet = curspreadsheet.getSheetByName('Game setup');
  var namingarray = setupsheet.getRange('B4:C8').getValues();
  var authorcode = namingarray.filter(function (el){return el[1].toString()==player.toString()})[0][0];

  var statesheet = curspreadsheet.getSheetByName('Game state');
  var curstate = statesheet.getRange("CF1").getValue().toString();
  var cash = parseInt(statesheet.getRange(curstate,(authorcode.charCodeAt(0)-65)*2+3).getValue())

  return cash
}

function sendOwnedTable(sheetid){
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var statesheet = curspreadsheet.getSheetByName('Game state');
  var numofplayers = statesheet.getRange('CH1').getValue().toString();
  var playsheet = curspreadsheet.getSheetByName('Play area');
  return playsheet.getRange(13,10,1+parseInt(numofplayers),6).getValues()
}

function sendRoundTable(sheetid){
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var playsheet = curspreadsheet.getSheetByName('Play area');
  return playsheet.getRange(3,10,5,6).getValues()
}

function sendCurrentState(sheetid){
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var statesheet = curspreadsheet.getSheetByName("Game state");
  var curstate = statesheet.getRange("CF1").getValue().toString();
  return statesheet.getRange(curstate,1).getValue().toString().substring(0,1);
}

function sendWebhookMessage(textofmessage,sheetid) {
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var setupsheet = curspreadsheet.getSheetByName('Game setup');
  var url = setupsheet.getRange('D1').getValue();
  var message = {
    "content": textofmessage // Replace with the message you want to send
  };
  var options = {
    "method": "post",
    "headers": {
      "Content-Type": "application/json"
    },
    "payload": JSON.stringify(message)
  };
  UrlFetchApp.fetch(url, options);
}

function sendWebhookImage(imagenumber,sheetid) {
  var curspreadsheet = SpreadsheetApp.openById(sheetid);
  var setupsheet = curspreadsheet.getSheetByName('Game setup');
  var url = setupsheet.getRange('D1').getValue();
  var cardsheet = curspreadsheet.getSheetByName('Card details');
  var linktoimage = cardsheet.getRange(parseInt(imagenumber)+1,4).getValue().toString();

  var message = {
    "content": "",
    "embeds": [{
      "image": {
        "url": linktoimage
      }
    }], // Replace with the message you want to send
  };
  var options = {
    "method": "post",
    "headers": {
      "Content-Type": "application/json"
    },
    "payload": JSON.stringify(message)
  };
  UrlFetchApp.fetch(url, options);
}
