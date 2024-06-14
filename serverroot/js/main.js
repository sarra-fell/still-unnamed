"use strict";
let canvas,context;
window.onload = init;

/*
    Load important data  !!
*/

const TILE_SIZE = 32;

// State of the world screen meant to be accessible everywhere
var globalWorldData = {
    levelNum: 0,
    sizeMod: 1.4,
    worldX: 80,
    worldY: 20,
    speedMode: false,

    // Counts the minutes elapsed from 0:00 in the day, for now it goes up 1 every second
    currentGameClock: 600,
    timeOfLastUnpause: 0,
    gameClockOfLastPause: 600,
}

let ingameLog = [];

// Measured in in-game seconds. -1 means there is a current dysymbolia event
// it will stay at 0 if one cannot currently happen and it is waiting for the next opportunity to start
let timeUntilDysymbolia = 60;
//hunger: 75, maxHunger: 100,

// The player statistic data, designed to be global
var globalPlayerStatisticData = {
    finishedWaterScene: false,
    finishedFruitScene: false,
    finishedCloudScene: false,
    finishedDungeonScene: false,
    finishedNightScene: false,
    finishedFirstRandomDysymboliaScene: false,
    finishedFivePowerScene: false,
    totalSceneDysymboliaExperienced: 0,
    stepCount: 0,
    enemiesDefeated: 0,
    totalDysymboliaManualTriggers: 0,
    totalKanjiMastery: 0,
    totalPowerGained: 0,
    totalDamageTaken: 0,
}

//var globalMenuTabList = ["Inventory","Abilities","Kanji List","Theory","Settings","Save"];

var globalInputData = {
    inputtingText: false, 
    finishedInputtingText: true, 
    textEntered: "",

    // keyPressed variables only to be changed by input event listeners
    downPressed: false, upPressed: false, leftPressed: false, rightPressed: false,

    // variables set to be true by input event listeners and set back to false after being handled by scene update
    downClicked: false, upClicked: false, zClicked: false, xClicked: false, doubleClicked: false,

    // for player movement. handled by the input layer
    currentDirection: "Down",

    // Changed by the scene when the direction is not to change regardless of input
    currentDirectionFrozen: false,

    mouseDown: false, mouseX: 0, mouseY: 0,

    // Used to know the x and y of the last mousedown, mostly for determining if the mouseup or mouse click occured in the same place as it
    //so that we know whether a button was actually fully clicked or not
    mouseDownX: -1, mouseDownY: -1,
}

function getTextInputStatus(){
    if(globalInputData.inputtingText && globalInputData.finishedInputtingText){
        return "entered";
    } else {
        return "dont know";
    }
}

let currentTooltip = null;
let tooltipBoxes = [];

let particleSystems = [];


// When levels are loaded it will give us (relative) paths of all the images we need for them
var tilesetPaths = [];

// Contains Images of each tileset we need, the index corresponds with the layer that the tileset corrosponbds to
var tilesets = {
    tilesetImages: [],

    // Each element is an object that corresponds to the tileset
    // Those objects contain arrays of information that corresponds to each tile in the tileset
    tilesetTileInfo: [],
};

function loadTilesets(){
    for (let i in tilesetPaths){
        tilesets.tilesetImages.push(new Image());
        tilesets.tilesetImages[i].src = tilesetPaths[i].replace("..","/assets");
    }
}

// Contains all dialogue data directly from the file
var dialogueFileData = {
    andro: {},
    gladius: {},
    lizard: {},
    world: {},
    scenes: {},
    randomDysymbolia: {},
};

var adventureKanjiFileData = [];
var theoryWriteupData = [];
var abilityFileData = [];
var abilityIcons = [];
var enemyFileData = [];
var itemInfo = [];

// Loads the data !!!
let gameJsonDataLoaded = false;
function processGameJsonData(data) {
    const gameData = JSON.parse(data);
    const dialogueData = gameData.dialogue;
    adventureKanjiFileData = gameData.kanji;
    theoryWriteupData = gameData.theory;
    abilityFileData = gameData.abilities;
    enemyFileData = gameData.enemies;
    itemInfo = gameData.items;

    dialogueFileData.scenes = dialogueData.scenes;
    dialogueFileData.world = dialogueData.worldDialogue;
    dialogueFileData.randomDysymbolia = dialogueData.randomDysymbolia;
    dialogueFileData.abilityAcquisition = dialogueData.abilityAcquisition;
    dialogueFileData.gladius = dialogueData.characterDialogue.Gladius;
    dialogueFileData.andro = dialogueData.characterDialogue.Andro;
    dialogueFileData.lizard = dialogueData.characterDialogue.Lizard;

    for(let i=0;i<abilityFileData.length;i++){
        let icon = new Image();
        icon.src = `/assets/temp icons/icon-${i}.png`;
        abilityIcons.push(icon);

        // Link kanji symbols to their index
        let ability = abilityFileData[i];
        for(let i=0;i<ability.specialKanji.length;i++){
            let symbol = ability.specialKanji[i];

            for(let j=0;j<adventureKanjiFileData.length;j++){
                if(symbol === adventureKanjiFileData[j].symbol){
                    ability.specialKanji[i] = j;
                }
            }
        }
    }

    gameJsonDataLoaded = true;
}

// Levels isnt the most amazing word for it technically but it is the terminology that ldtk uses so thats the terms we are using
var levels = [];

// Information on the connections between levels. currently an array of connections that is to be iterated through when looking for the other side of a connection.
var connections = [];

let levelsLoaded = false;
function processLevelData(data) {
    //console.log(data);
    const worldData = JSON.parse(data);
    const levelsData = worldData.levels;

    // Takes the length of the layers and takes off 2 for the entities and collisions layer
    const numTileLayers = worldData.defs.layers.length -2;

    // Load in tileset information
    for (let i=0;i<numTileLayers;i++){
        let tsetData = worldData.defs.tilesets[i];
        tilesetPaths.push(tsetData.relPath);
        tilesets.tilesetTileInfo.push({});

        const amountOfTiles = Math.floor((tsetData.pxWid/tsetData.tileGridSize)) * Math.floor((tsetData.pxHei/tsetData.tileGridSize));
        for (let j=0;j<tsetData.enumTags.length;j++){
            tilesets.tilesetTileInfo[i][tsetData.enumTags[j].enumValueId] = Array(amountOfTiles).fill(false);
            //console.log(tsetData.enumTags[j].enumValueId);
            for (const id of tsetData.enumTags[j].tileIds){
                tilesets.tilesetTileInfo[i][tsetData.enumTags[j].enumValueId][id] = true;
            }
        }
    }

    for (let i=0;i<levelsData.length;i++){
        levels[i] = {
            gridWidth: -1,
            gridHeight: -1,
            entities: [],
            collisions: [],

            // tileLayers is populated with objects with fields:
            // name - layer name
            // tiles - array of tile
            tileLayers: [],
        };
        const levelData = levelsData[i];
        const entityLayerData = levelData.layerInstances[0];
        const collisionLayerData = levelData.layerInstances[levelData.layerInstances.length-1];

        levels[i].collisions = collisionLayerData.intGridCsv;
        levels[i].iid = levelData.iid;
        levels[i].identifier = levelData.identifier;
        levels[i].neighbours = levelData.__neighbours;

        levels[i].gridWidth = collisionLayerData.__cWid;
        levels[i].gridHeight = collisionLayerData.__cHei;
        levels[i].lightSource = levelData.fieldInstances[0].__value;

        for(let j=0;j<numTileLayers;j++){
            let tileLayerData = levelData.layerInstances[j+1];
            let tileLayer = {
                name: tileLayerData.__identifier,
                uid: tileLayerData.__tilesetDefUid,
                tiles: [],
            }
            for (const t of tileLayerData.gridTiles){
                tileLayer.tiles.push({src: t.src, px: t.px, t: t.t});
            }
            levels[i].tileLayers.push(tileLayer);
        }

        for (let j in entityLayerData.entityInstances){
            const e = entityLayerData.entityInstances[j];
            let entityData = {id: e.__identifier, location: e.px, graphicLocation: [e.px[0], e.px[1]], src: [32,0], type: e.__tags[0],width: e.width,height: e.height,bitrate:32,ephemeral:false,visible:true};

            for (let k in e.fieldInstances){
                const field = e.fieldInstances[k];
                if(field.__identifier === "facingDirection"){
                    entityData.src = [32,32*spritesheetOrientationPosition[field.__value]]
                } else if(field.__identifier === "tile"){
                    entityData.src = [field.__value.x,field.__value.y];
                    for(let l=0;l<numTileLayers;l++){
                        // Find the tileset index for the tile
                        if(levels[i].tileLayers[l].uid === field.__value.tilesetUid){
                            entityData.tilesetIndex = l;
                            break;
                        }
                    }
                } else {
                    entityData[field.__identifier] = field.__value;
                }
            }
            if(e.__identifier === "Witch"){
                levels[i].defaultLocation = [e.px[0],e.px[1]];
            }
            if(e.__identifier === "Stairs"){
                connections.push(
                    {
                        connectionId: entityData.connectionId,
                        exitLocation: e.px,
                        exitDirection: entityData.exitDirection,
                        area: levelData.iid,
                    }
                );
            }
            levels[i].entities.push(entityData);
        }
        /*if(levels[i].water.length < 2){
            throw "You have no water and no hot boyfriend";
        }*/
    }
    levelsLoaded = true;

    loadTilesets();
}

var dictionary = {
    entries: {
        戦う: "たたか・う‾ (0) - Intransitive verb 1. to make war (on); to wage war (against); to go to war (with); to fight (with); to do battle (against)​",
        ホーム: "",
        自己紹介: "じこしょ\\うかい (3) - Noun, Intransitive suru verb 1. self-introduction​",
        冒険: "ぼうけん‾ (0) - Noun, Intransitive suru verb 1. adventure; venture",
        始める: "はじ・める‾ (0) - Transitive verb 1. to start; to begin; to commence; to initiate; to originate",
        大好き: "だ\いす・き (1) - Na-Adjective 1. liking very much; loving (something or someone); adoring; being very fond of​"
    }
};
let dictLoaded = false;
function processDict(data) {
    const splitLines = str => str.split(/\r?\n/);
    let splitData = splitLines(data);

    for(let i in splitData){
        const wordData = splitData[i].split('+');
        if(wordData.length === 2){
            dictionary.entries[wordData[0]] = wordData[1];
        }
    }

    dictLoaded = true;
}

function handleGameJsonData() {
    if(this.status == 200) {
        processGameJsonData(this.responseText);
    } else {
        alert("Handling game json data: Status " + this.status + ". We have failed and (chou redacted).");
    }
}

var gameJsonClient = new XMLHttpRequest();
gameJsonClient.onload = handleGameJsonData;
gameJsonClient.open("GET", "assets/game_json_data.json");
gameJsonClient.send();

function handleLevelData() {
    if(this.status == 200) {
        processLevelData(this.responseText);
    } else {
        alert("Handling level data: Status " + this.status + ". We have failed and you have negative hot men");
    }
}

var levelClient = new XMLHttpRequest();
levelClient.onload = handleLevelData;
//levelClient.open("GET", "assets/ldtk/testy2.ldtk");
levelClient.open("GET", "assets/ldtk/testy3.ldtk");
levelClient.send();


function handleDict() {
    if(this.status == 200) {
        processDict(this.responseText);
    } else {
        alert("Handling dict data: Status " + this.status + ". We have failed and you have negative hot men");
    }
}

var dictClient = new XMLHttpRequest();
dictClient.onload = handleDict;
dictClient.open("GET", "assets/collected_dictionary_data.txt");
dictClient.send();

var zenMaruRegular = new FontFace('zenMaruRegular', 'url(assets/ZenMaruGothic-Regular.ttf)');
zenMaruRegular.load().then(function(font){document.fonts.add(font);});

var zenMaruMedium = new FontFace('zenMaruMedium', 'url(assets/ZenMaruGothic-Medium.ttf)');
zenMaruMedium.load().then(function(font){document.fonts.add(font);});

var zenMaruLight = new FontFace('zenMaruLight', 'url(assets/ZenMaruGothic-Light.ttf)');
zenMaruLight.load().then(function(font){document.fonts.add(font);});

var zenMaruBold = new FontFace('zenMaruBold', 'url(assets/ZenMaruGothic-Bold.ttf)');
zenMaruBold.load().then(function(font){document.fonts.add(font);});

var zenMaruBlack = new FontFace('zenMaruBlack', 'url(assets/ZenMaruGothic-Black.ttf)');
zenMaruBlack.load().then(function(font){document.fonts.add(font);});

const characterList = ["witch","andro","gladius","lizard"];

var characterSpritesheets={},characterFaces={},characterBitrates={};
const faceBitrate = 96;

// Key pair for misc images
var miscImages = {};

// Constants to indicate character location in sprite sheets TODO
const PROTAGONIST = 1;
const GLORIA = 0;
const WITCH = 1;
const ANDRO = 2;

// Constants to indicate position of orientation on spritesheets
var spritesheetOrientationPosition = {};
Object.defineProperty( spritesheetOrientationPosition, "Down", {value: 0});
Object.defineProperty( spritesheetOrientationPosition, "Left", {value: 1});
Object.defineProperty( spritesheetOrientationPosition, "Right", {value: 2});
Object.defineProperty( spritesheetOrientationPosition, "Up", {value: 3});


// Simple function that returns true when all images are indicated complete, false otherwise
function areImageAssetsLoaded() {
    for(let i in tilesets.tilesetImages){
        if(!tilesets.tilesetImages[i].complete){
            return false;
        }
    }
    for (const [key, value] of Object.entries(characterSpritesheets)) {
        if(!value.complete){
            return false;
        }
    }
    for (const [key, value] of Object.entries(characterFaces)) {
        if(!value.complete){
            return false;
        }
    }
    return true;
}

/*
    Important variables  !!!!
*/

// Important variables for managing passing time
let fps=0;
let frameCount=1;

// Variables used between frames solely to measure fps
let secondsPassed=0;
let oldTimeStamp=performance.now();

// Variables and constants related to graphics below
let bgColor = "black";
let textColor = "white";
const screenWidth = 1250, screenHeight = 950;

// Complex shapes like this can be created with tools, although it may be better to use an image instead
const heartPath = new Path2D('M24.85,10.126c2.018-4.783,6.628-8.125,11.99-8.125c7.223,0,12.425,6.179,13.079,13.543 c0,0,0.353,1.828-0.424,5.119c-1.058,4.482-3.545,8.464-6.898,11.503L24.85,48L7.402,32.165c-3.353-3.038-5.84-7.021-6.898-11.503 c-0.777-3.291-0.424-5.119-0.424-5.119C0.734,8.179,5.936,2,13.159,2C18.522,2,22.832,5.343,24.85,10.126z');

// Approxmimate base width and height (they are the same) of the heartPath
//to be able to get a good approximization of what scale to use to get the size we want
const heartSize = 48;

// Basically just means movement speed, var name could use improvement?
let movingAnimationDuration = 200;


/*
    Extremely insignificant and puny variables !!
*/

// Turned on for one frame when the logging key is pressed to alert/print some stuff
let isLoggingFrame = false;

let showDevInfo = false;

// Various variables that should be scene variables but havent gotten to changing them yet (maybe not ever)
let love = 0, note = "無";
let name = "nameless", nameRecentlyLearned = false;
let randomColor = Math.random() > 0.5? '#ff8080' : '#0099b0';

/*
    Buttons !!!
*/

let loveButton = {
    x:20, y:screenHeight-50, width:60, height:30,
    neutralColor: '#ed78ed', hoverColor: '#f3a5f3', pressedColor: '#7070db', color: '#ed78ed',
    text: "好き", font: '13px zenMaruRegular', fontSize: 13, jp: true,
    onClick: function() {
        randomColor = Math.random() > 0.5? '#ff80b0' : '#80ffb0';
        love+=1;
        note = "<3";
        localStorage.setItem('love', love.toString());
        if(globalWorldData.sizeMod === 1.4){
            globalWorldData.sizeMod = 1;
        } else {
            globalWorldData.sizeMod = 1.4;
        }
    }
};

window.addEventListener('keydown',function(e) {
    switch (e.key) {
       case 'ArrowLeft': globalInputData.leftPressed=true; if(!globalInputData.currentDirectionFrozen) globalInputData.currentDirection="Left"; break;
       case 'ArrowUp': globalInputData.upPressed=true; globalInputData.upClicked=true; if(!globalInputData.currentDirectionFrozen) globalInputData.currentDirection="Up"; break;
       case 'ArrowRight': globalInputData.rightPressed=true; if(!globalInputData.currentDirectionFrozen) globalInputData.currentDirection="Right"; break;
       case 'ArrowDown': globalInputData.downPressed=true; globalInputData.downClicked=true; if(!globalInputData.currentDirectionFrozen) globalInputData.currentDirection="Down"; break;
       case 'Enter': globalInputData.finishedInputtingText=true; break;
       case 'X': globalInputData.xClicked=true;
       case 'x': globalInputData.xClicked=true;
       case 'Z': globalInputData.zClicked=true;
       case 'z': globalInputData.zClicked=true;
       default: if(!globalInputData.finishedInputtingText){
           switch (e.key) {
              case 'Backspace': if(globalInputData.textEntered.length>0){
                globalInputData.textEntered = globalInputData.textEntered.substring(0,globalInputData.textEntered.length-1);
              } break;
              default: if(e.key.length===1){
                globalInputData.textEntered = globalInputData.textEntered+e.key;
              }
          }
       } break;
   }
},false);

function reassignCurrentDirection(){
    globalInputData.upPressed ? globalInputData.currentDirection="Up" :
    globalInputData.rightPressed ? globalInputData.currentDirection="Right" :
    globalInputData.leftPressed ? globalInputData.currentDirection="Left" :
    globalInputData.downPressed ? globalInputData.currentDirection="Down" : null;
}

window.addEventListener('keyup',function(e) {
    switch (e.key) {
       case 'ArrowLeft': globalInputData.leftPressed=false; if (!globalInputData.currentDirectionFrozen && globalInputData.currentDirection==="Left") reassignCurrentDirection(); break;
       case 'ArrowUp': globalInputData.upPressed=false; if (!globalInputData.currentDirectionFrozen && globalInputData.currentDirection==="Up") reassignCurrentDirection(); break;
       case 'ArrowRight': globalInputData.rightPressed=false; if (!globalInputData.currentDirectionFrozen && globalInputData.currentDirection==="Right") reassignCurrentDirection(); break;
       case 'ArrowDown': globalInputData.downPressed=false; if (!globalInputData.currentDirectionFrozen && globalInputData.currentDirection==="Down") reassignCurrentDirection(); break;
       case '=': isLoggingFrame=true; break;
       case '~': showDevInfo=!showDevInfo; break;

       default: break;
   }
},false);

window.addEventListener('mousemove',function(e) {
    let rect = canvas.getBoundingClientRect();

    // mouse x and y relative to the canvas
    globalInputData.mouseX = Math.floor(e.x - rect.x);
    globalInputData.mouseY = Math.floor(e.y - rect.y);

    //check if was hovered on button so we can change color!
    game.handleMouseHover(globalInputData.mouseX,globalInputData.mouseY);
},false);

window.addEventListener('mousedown',function(e) {
    globalInputData.mouseDown=true;
    let rect = canvas.getBoundingClientRect();

    // mouse x and y relative to the canvas
    globalInputData.mouseX = globalInputData.mouseDownX = Math.floor(e.x - rect.x);
    globalInputData.mouseY = globalInputData.mouseDownY = Math.floor(e.y - rect.y);

    game.handleMouseDown(globalInputData.mouseX,globalInputData.mouseY);
},false);

window.addEventListener('mouseup',function(e) {
    globalInputData.mouseDown=false;

    game.handleMouseUp(e.x,e.y);
},false);

window.addEventListener('click',function(e) {
    let rect = canvas.getBoundingClientRect();

    // Click x and y relative to the canvas
    globalInputData.mouseX = Math.floor(e.x - rect.x);
    globalInputData.mouseY = Math.floor(e.y - rect.y);

    game.handleMouseClick(globalInputData.mouseX,globalInputData.mouseY);
},false);

window.addEventListener('dblclick',function(e) {
    globalInputData.doubleClicked=true;
},false);

// Code stolen and modified from https://fjolt.com/article/html-canvas-how-to-wrap-text
// Japanese text doesnt have spaces so we just split it anywhere, rough but easy solution
const wrapText = function(ctx, text, y, maxWidth, lineHeight, japanese = false) {
    // @description: wrapText wraps HTML canvas text onto a canvas of fixed width
    // @param ctx - the context for the canvas we want to wrap text on
    // @param text - the text we want to wrap.
    // @param y - the Y starting point of the text on the canvas.
    // @param maxWidth - the width at which we want line breaks to begin - i.e. the maximum width of the canvas.
    // @param lineHeight - the height of each line, so we can space them below each other.
    // @returns an array of [ lineText, x, y ] for all lines

    // First, start by splitting all of our text into words, but splitting it into an array split by spaces
    let wordBreak = ' ';
    if(japanese){
        wordBreak = '';
    }
    let words = text.split(wordBreak);
    let line = ''; // This will store the text of the current line
    let testLine = ''; // This will store the text when we add a word, to test if it's too long
    let lineArray = []; // This is an array of lines, which the function will return
    // Lets iterate over each word
    for(var n = 0; n < words.length; n++) {
        // Create a test line, and measure it..
        if(japanese){
            testLine += `${words[n]}`;
        } else {
            testLine += `${words[n]} `;
        }
        let metrics = ctx.measureText(testLine);
        let testWidth = metrics.width;
        // If the width of this test line is more than the max width
        if (words[n] === "\n" || testWidth > maxWidth && n > 0) {
            // Then the line is finished, push the current line into "lineArray"
            lineArray.push([line, y]);
            // Increase the line height, so a new line is started
            y += lineHeight;
            // Update line and test line to use this word as the first word on the next line
            if(japanese){
                line = `${words[n]}`;
                testLine = `${words[n]}`;
            } else {
                line = `${words[n]} `;
                testLine = `${words[n]} `;
            }
        }
        else {
            // If the test line is still less than the max width, then add the word to the current line
            if(japanese){
                line += `${words[n]}`;
            } else {
                line += `${words[n]} `;
            }
        }
        // If we never reach the full max width, then there is only one line.. so push it into the lineArray so we return something
        if(n === words.length - 1) {
            lineArray.push([line, y]);
        }
    }
    // Return the line array
    return lineArray;
}

// Draws the current tooltip
function drawTooltip() {
    let draw = function(titleColor,titleText,bodyText,jp = false,titleShadow=0,shadowColor = "hsl(0, 15%, 0%, 70%)"){
        let wrappedText = wrapText(context, bodyText, globalInputData.mouseY+74, 350, 16, jp);

        const boxX = globalInputData.mouseX+12;
        const boxY = globalInputData.mouseY+12;
        const boxWidth = 250;
        const boxHeight = wrappedText[wrappedText.length-1][1]-globalInputData.mouseY+12;

        let offsetX = 0;
        let offsetY = 0;
        if(boxX+boxWidth > screenWidth){
            offsetX = -boxWidth-24;
        }
        if(boxY+boxHeight > screenHeight){
            offsetY = -boxHeight-24;
        }

        context.fillStyle = 'hsl(0, 0%, 90%)';
        context.beginPath();
        context.roundRect(boxX+offsetX, boxY+offsetY, boxWidth, boxHeight, 5);
        context.fill();


        context.textAlign = 'center';
        context.fillStyle = titleColor;
        context.save();
        context.shadowColor = shadowColor;
        context.shadowBlur = titleShadow;
        context.fillText(titleText, boxX+offsetX+125, boxY+offsetY+32);
        context.restore();
        context.font = '13px Arial';
        context.textAlign = 'start';
        context.fillStyle = 'black';

        wrappedText.forEach(function(item) {
            // item[0] is the text
            // item[1] is the y coordinate to fill the text at
            context.fillText(item[0], globalInputData.mouseX+12+10+offsetX, item[1]+offsetY);
        });
    }

    let tooltipBox = tooltipBoxes[currentTooltip.index];
    if(tooltipBox.type === "dictionary"){
        const word = tooltipBoxes[currentTooltip.index].word;
        context.font = '20px zenMaruRegular';
        draw('black', "Definition of " + word, dictionary.entries[word]);
    } else if (tooltipBox.type === "condition"){
        const condition = tooltipBox.condition;
        context.font = '20px zenMaruBlack';
        if(condition.name === "Dysymbolia"){
            if(timeUntilDysymbolia === 0){
                draw(condition.color,condition.name,"Character sees visions of a distant world. Next imminent.", false, 12);
                return;
            } else if(timeUntilDysymbolia < 0){
                if(condition.golden){
                    draw(condition.color,condition.name,"いい度胸だ。", true, 12, "hsl(280, 100%, 70%, 70%)");
                } else {
                    draw(condition.color,condition.name,"ここが貴方のいるべき場所じゃない。戻ってください。", true, 12);
                }
                return;
            }
        }

        let splitDesc = condition.desc.split("$");
        let parsedDesc = "";
        for(let i in splitDesc){
            if(splitDesc[i] === "timeUntilDysymbolia"){
                parsedDesc = parsedDesc + `${timeUntilDysymbolia}`;
            } else if(splitDesc[i] === "turnsLeft"){
                parsedDesc = parsedDesc + `${condition.turnsLeft}`;
            } else {
                parsedDesc = parsedDesc + splitDesc[i];
            }
        }
        draw(condition.color,condition.name,parsedDesc,false,12);
    } else if (tooltipBox.type === "item"){
        let info = itemInfo[tooltipBox.item];
        let splitDesc = info.desc.split("$");
        let parsedDesc = "";
        for(let i in splitDesc){
            if(splitDesc[i] === "healAmount"){
                parsedDesc = parsedDesc + `${info.effects.healAmount}`;
            } else {
                parsedDesc = parsedDesc + splitDesc[i];
            }
        }
        draw(info.color,info.name,parsedDesc);
    } else if(tooltipBox.type === "kanji list entry"){
        // dont draw shit and the tooltip is just used as a signal that its being hovered over lol
        /*
        let kanji = adventureKanjiFileData[tooltipBox.index];
        let text = kanji.story;
        context.font = '20px Arial';
        draw('black',kanji.symbol + "   " + kanji.keyword,text)*/
    } else if (tooltipBox.type === "kanji"){
        let kanji = adventureKanjiFileData[tooltipBox.index];
        let text = kanji.story;
        context.font = '20px Arial';
        draw('black',kanji.symbol + "   " + kanji.keyword,text)
    }
}

// Updates the current tooltip without waiting for a mouse move event first.
function reapplyTooltip(){
    currentTooltip = null;
    for (let i=0;i<tooltipBoxes.length;i++) {
        let t = tooltipBoxes[i];
        if (globalInputData.mouseX >= t.x &&         // right of the left edge AND
        globalInputData.mouseX <= t.x + t.width &&    // left of the right edge AND
        globalInputData.mouseY >= t.y &&         // below the top AND
        globalInputData.mouseY <= t.y + t.height) {    // above the bottom
            currentTooltip = {timeStamp: performance.now(), index: i};
        }
    }
}

// Useful function for particle generation, returns unit vector of random direction
// Mod and shift are optional arguments that allows the random angles generated to be changed
function randomUnitVector(mod=1,shift=0) {
    let randomAngle = Math.random()*2*Math.PI*mod+shift*Math.PI;
    return [Math.cos(randomAngle),Math.sin(randomAngle),randomAngle];
}

/********************************
*
*    Particle system code !!!
*
*        I have made a bunch of stuff here, some of it useful some of it less useful, but all in a vacuum to improve my programming
*    and hopefully be able to implement better eye candy into my projects. The way we handle draw particle/new particle functions
*    needs to be reworked
*
**************************************/

// Composites a draw function for a particle system, returns a function that draws particles
//when inside a particleSystem object, with the following options:
//
// particleShape: "round" "square"
// distributionShape: "round" "square"

// Particle systems functions, only to be called when inside a particle system!
let drawParticlesTypeZero = function(timeStamp){
    for (let x in this.particles) {
        let p = this.particles[x];

        context.fillStyle = 'hsla('+p.hue+','+p.saturation+'%,'+p.lightness+'%,'+this.startingAlpha*((p.createTime-timeStamp+this.particleLifespan)/this.particleLifespan)+')';
        context.beginPath();
        context.arc(p.x, p.y, p.size, 0, 2 * Math.PI);
        context.fill();
    }
} //Draw particles round

let drawParticlesTypeOne = function(timeStamp){
    for (let x in this.particles) {
        let p = this.particles[x];

        context.fillStyle = 'hsla('+p.hue+','+p.saturation+'%,'+p.lightness+'%,'+(p.createTime-timeStamp+this.particleLifespan)/this.particleLifespan+')';
        //context.beginPath();
        context.fillRect(p.x, p.y, p.size, p.size);
        //context.fill();``
    }
} // Draw particles square

let drawParticlesTypeTwo = function(timeStamp){
    context.save();
    for (let x in this.particles) {
        let p = this.particles[x];
        let size = p.size/heartSize;

        context.fillStyle = 'hsla('+p.hue+','+p.saturation+'%,'+p.lightness+'%,'+(p.createTime-timeStamp+this.particleLifespan)/this.particleLifespan+')';
        context.save();
        context.translate(p.x,p.y);
        context.scale(size,size);
        //context.rotate(p.angle+0.5*Math.PI);
        context.beginPath();
        context.fill(heartPath);
        context.restore();
    }
    context.restore();
} // Draw particles heart

// Particle creation functions, returns a particle object
let newParticleTypeZero = function(timeStamp){
    // If hue is array get a random color from there
    let h=this.hue,s=this.saturation,l=this.lightness;

    let velX = (Math.random()-0.5)*this.particleSpeed*2;
    let velY = (Math.random()-0.5)*this.particleSpeed*2;

    let magnitude = Math.sqrt(velX**2 + velY**2);
    //alert(magnitude);
    let adjustedMagnitude = magnitude/this.particleSpeed;

    // Take the unit vector and multiply it by the acceleration for the proper acceleration vector
    let accX = (velX/magnitude)*this.particleAcceleration*adjustedMagnitude;
    let accY = (velY/magnitude)*this.particleAcceleration*adjustedMagnitude;
    //alert(accX + " " + accY + " " + velX + " " + velY);

    // Get random color from array
    if(typeof this.hue === "object"){
        let randomIndex = Math.floor(Math.random()*this.hue.length);

        h = this.hue[randomIndex];
        s = this.saturation[randomIndex];
        l = this.lightness[randomIndex];
    }
    return {x: this.x, y: this.y, hue: h, saturation: s, lightness: l, size: this.particleSize,
            createTime: timeStamp, destroyTime: timeStamp+this.particleLifespan,
            velX: velX, velY: velY, speed: magnitude,
            accX: accX, accY: accY};
} // Distributes particles in square with random magnitude

let newParticleTypeOne = function(timeStamp){
    let v = randomUnitVector(this.mod, this.shift);
    // If hue is array get a random color from there
    let h=this.hue,s=this.saturation,l=this.lightness;

    // Get random color from array
    if(typeof this.hue === "object"){
        let randomIndex = Math.floor(Math.random()*this.hue.length);

        h = this.hue[randomIndex];
        s = this.saturation[randomIndex];
        l = this.lightness[randomIndex];
    }
    return {x: this.x, y: this.y, hue: h, saturation: s, lightness: l, size: this.particleSize,
            createTime: timeStamp, destroyTime: timeStamp+this.particleLifespan,
            velX: v[0]*this.particleSpeed, velY: v[1]*this.particleSpeed, angle: v[2],
            accX: 0, accY: 0};
} // Distributes particles in circle with uniform magnitude

let newParticleTypeTwo = function(timeStamp){
    let v = randomUnitVector(this.mod, this.shift);
    // If hue is array get a random color from there
    let h=this.hue,s=this.saturation,l=this.lightness;
    let x=this.x,y=this.y;

    // Get random color from array
    if(typeof this.hue === "object"){
        let randomIndex = Math.floor(Math.random()*this.hue.length);

        h = this.hue[randomIndex];
        s = this.saturation[randomIndex];
        l = this.lightness[randomIndex];
    }
    if(this.sourceType === "line"){
        x = Math.random() * (this.x[1]-this.x[0]) + this.x[0];
        y = Math.random() * (this.y[1]-this.y[0]) + this.y[0];
    }
    return {x: x, y: y, hue: h, saturation: s, lightness: l, size: this.particleSize,
            createTime: timeStamp, destroyTime: timeStamp+this.particleLifespan,
            velX: v[0]*this.particleSpeed*Math.random(), velY: v[1]*this.particleSpeed*Math.random(),
            accX: 0, accY: 0};
} // Distributes particles in circle with random magnitude

let newParticleTypeThree = function(timeStamp){
    let v = randomUnitVector(this.mod, this.shift);
    let h=this.hue,s=this.saturation,l=this.lightness;

    // Get random color from array
    if(typeof this.hue === "object"){
        let randomIndex = Math.floor(Math.random()*this.hue.length);

        h = this.hue[randomIndex];
        s = this.saturation[randomIndex];
        l = this.lightness[randomIndex];
    }
    return {x: this.x, y: this.y, hue: h, saturation: s, lightness: l, size: this.particleSize,
            createTime: timeStamp, destroyTime: timeStamp+this.particleLifespan,
            velX: v[0]*this.particleSpeed, velY: v[1]*this.particleSpeed, angle: v[2],
            accX: (Math.random()-0.5)*this.particleSpeed*2, accY: (Math.random()-0.5)*this.particleSpeed*2};
} // Distributes particles in circle with uniform magnitude and random acceleration

let newParticleFunctions = [newParticleTypeZero,newParticleTypeOne,newParticleTypeTwo,newParticleTypeThree];
let drawParticleFunctions = [drawParticlesTypeZero,drawParticlesTypeOne,drawParticlesTypeTwo];

// Takes in an object to be able to make use of named parameters, returns a particle system object
function createParticleSystem(
    {x=-1000, y=-1000, hue=0, saturation=100, lightness=50, startingAlpha=1, particlesPerSec=50, drawParticles=drawParticlesTypeOne,
    newParticle=newParticleTypeZero, temporary=false, specialDrawLocation=false,
    particleSize=7, particleLifespan=1000, mod=1, shift=0, systemLifespan=Infinity, createTime=0,
    gravity=0, particleSpeed=50, particlesLeft=Infinity, particleAcceleration=0,
    sourceType="point"} = {}) {

    if(typeof drawParticles === "number"){
        drawParticles = drawParticleFunctions[drawParticles];
    }
    if(typeof newParticle === "number"){
        newParticle = newParticleFunctions[newParticle];
    }
    let sys = {
        x: x, y: y, sourceType: sourceType, hue: hue, saturation: saturation, lightness: lightness, startingAlpha: startingAlpha,
        particlesPerSec: particlesPerSec, drawParticles: drawParticles, newParticle: newParticle, particleAcceleration: particleAcceleration,
        particleSize: particleSize, particleLifespan: particleLifespan, systemLifespan: systemLifespan, mod: mod, shift: shift,
        createTime: createTime, particles: [], timeOfLastCreate: -1, createNewParticles: true, temporary: temporary,
        particleSpeed: particleSpeed, gravity: gravity, particlesLeft: particlesLeft, specialDrawLocation: specialDrawLocation,
    }

    return sys;
}

let bestParticleSystem = createParticleSystem({
    x: 600, y:500, hue: [0,240,0], saturation: [100,100,100], lightness: [50,50,100],
     particlesPerSec: 10, drawParticles: drawParticlesTypeTwo, newParticle: newParticleTypeThree,
    particleSize: 18, particleLifespan: 1200,
    particles: [], timeOfLastCreate: -1,
});
/*let worstParticleSystem = {
    x: 600, y:600, hue: 0, particlesPerSec: 50, drawParticles: drawParticlesTypeOne, newParticle: newParticleTypeZero,
    particleSize: 7, particleLifespan: 1000,
    particles: [], timeOfLastCreate: -1,
};*/
let worstParticleSystem = createParticleSystem({x: 600, y: 600});
/*let silliestParticleSystem = {
    x: 600, y:700, hue: 290, particlesPerSec: 160, drawParticles: drawParticlesTypeZero, newParticle: newParticleTypeOne,
    particleSize: 3, particleLifespan: 1700,
    particles: [], timeOfLastCreate: -1,
};*/
let silliestParticleSystem = createParticleSystem({
    x: 600, y:700, hue: [60,290], saturation: [100,100], lightness: [60,50],
    particlesPerSec: 160, drawParticles: drawParticlesTypeZero, newParticle: newParticleTypeOne,
    particleSize: 3, particleLifespan: 1700,
});
let wonkiestParticleSystem = createParticleSystem({
    x: 400, y:700, hue: [186,300,0], saturation: [100,100,100], lightness: [70,75,100],
    particlesPerSec: 60, drawParticles: drawParticlesTypeTwo, newParticle: newParticleTypeTwo,
    particleSize: 12, particleLifespan: 3500, mod: 0.1, shift: 1.4, particleSpeed: 250, gravity: 100
});
let playerParticleSystem = createParticleSystem({
    hue: 205, particlesPerSec: 80, drawParticles: drawParticlesTypeOne, newParticle: newParticleTypeOne,
    particleSize: 5, particleLifespan: 1500,
    particles: [], timeOfLastCreate: -1,
});
let evilestParticleSystem = createParticleSystem({
    x: [150,200], y:[700,700], hue: 0, saturation: 0, lightness: 100, startingAlpha: 0.5,
    particlesPerSec: 50, drawParticles: drawParticlesTypeZero, newParticle: newParticleTypeTwo,
    particleSize: 7, particleLifespan: 1000, mod: 0.7, shift: 1.8, particleSpeed: 150, gravity: -200,
    sourceType: "line",
});

let homeParticleSystems = [evilestParticleSystem,bestParticleSystem,worstParticleSystem,silliestParticleSystem,wonkiestParticleSystem,playerParticleSystem];

function updateParticleSystem(sys,fps,timeStamp){
    // Add all the particles we will keep to this array, to avoid using splice to remove particles
    let newArray = [];
    for (let j in sys.particles) {
        let p = sys.particles[j];

        // Only use the particle if it is not going to be destroyed
        if(timeStamp<p.destroyTime){
            p.x += p.velX/fps;
            p.y += p.velY/fps;
            p.velX += p.accX/fps;
            p.velY += p.accY/fps;
            p.velY += sys.gravity/fps;
            newArray.push(p);
        }
    }

    if(sys.createNewParticles){
        // If enough time has elapsed, create particle!
        while (timeStamp-sys.timeOfLastCreate >= 1000/sys.particlesPerSec && sys.particlesLeft > 0) {

            newArray.push(sys.newParticle(timeStamp));
            sys.timeOfLastCreate = sys.timeOfLastCreate + 1000/sys.particlesPerSec;

            //if the timestamp is way too off the current schedule (because the animation was stalled),
            //shift the schedule even though doing so may lead to a slight inaccuracy (200ms chosen arbitirarily)
            if(sys.timeOfLastCreate+200 < timeStamp){
                sys.timeOfLastCreate=timeStamp;
            }

            if(sys.systemLifespan+sys.createTime<=timeStamp){
                sys.createNewParticles = false;
            }
            sys.particlesLeft--;
        }
    }
    if(sys.particlesLeft === 0){
        sys.createNewParticles = false;
    }
    sys.particles = newArray;
}

// Call to initialize the game when no save file is being loaded and the game is to start from the beginning
function initializeNewSaveGame(playerKanjiData,playerTheoryData,playerAbilityData){
    for(let i=0;i<adventureKanjiFileData.length;i++){
        playerKanjiData.push({
            // Index in the file data
            index: i,

            // Contains the full trial history of the kanji
            trialHistory: [],

            enabled: true,

            trialSuccesses: 0,
            trialFailures: 0,

            customStory: null,
            customKeyword: null,

            daysUntilMasteryIncreaseOpportunity: 0,
            masteryStage: 0,

            // Mastery stage can go down after a long vacation but highest mastery stage will be used to calculate mastery score, maybe?
            //highestMasteryStage: 0,

            /**** Internal SRS Variables ****/

            // This will get calculated whenever the game is saved and used to find kanji to trial for the first time in later sessions
            daysUntilNextScheduledTrial: 0,

            // If not null, indicates how long the interval between the last review and the next review this session should be, in seconds
            // Used to find kanji to trial for the second or later time in the session
            reviewStage: null,

            // After a trial, this will go up or down based on the circumstances, and if it gets too high from too many trial failures, the kanji will be identified as leech
            leechScore: 0,
            leechDetectionTriggered: false,

            // If not null, indicates the number of the trial where this kanji was studied last this session
            // How many trials gone by since the last trial is a variable used to determine when it gets trialed
            lastTrialNum: null,
        });
    }

    for(let i=0;i<theoryWriteupData.length;i++){
        playerTheoryData.push({
            unlocked: false,
            conditionsMet: false,
        });
    }

    for(let i=0;i<abilityFileData.length;i++){
        playerAbilityData.acquiredAbilities[abilityFileData[i].name] = false;
    }
}

function saveToLocalStorage(slot){
    try {
        localStorage.setItem("save "+slot,JSON.stringify(game.outputSaveGame()));
        alert("successfully saved... something. hopefully you'll be able to load this");
    }
    catch (err) {
        alert("save failed: "+err);
    }
}

// Takes a kanji from the player's kanjiData and assigns a number indicating the priority of the next trial of it.
// This is where the srs lives
function assignStudyPriority(srsData, kanji, currentDate, noNewKanji = false){
    // Time passed in seconds since the last trial
    let timePassed = Infinity;
    if(kanji.trialHistory.length>0){
        timePassed = Math.abs(kanji.trialHistory[kanji.trialHistory.length-1].dateStamp - currentDate)/1000;
    } else {
        if(noNewKanji){
            return -1000000;
        }
    }

    // Number of trials of other kanji since the last trial of this kanji
    let trialsSinceLastTrial = null;
    if(kanji.lastTrialNum !== null){
        trialsSinceLastTrial = srsData.trialsThisSession - (kanji.lastTrialNum+1);
    }

    if(kanji.reviewStage !== null){
        // Each trial since the last trial counts for 25 seconds of extra time passed, in seconds
        let weightedTimePassed = timePassed + trialsSinceLastTrial*25;

        let ratio = weightedTimePassed/(kanji.reviewStage);

        // Algorithm is subject to change
        return Math.log(ratio*100)*100 + Math.max(ratio-0.75,0)*3000;

    } else if (kanji.daysUntilNextScheduledTrial>0){
        return (-kanji.index/10)*kanji.daysUntilNextScheduledTrial;
    } else {
        return (srsData.trialsSinceLastNewKanji+1)*400 - kanji.index/10 - kanji.trialHistory.length*100;
    }
}

// after completing a trial, this function adds the trial to the kanji and updates all the information of it, if needed
function addTrial(srsData, kanji, succeeded){
    const masteryStageIntervals = [0,1,3,7,21,90,Infinity];

    /*if(typeof kanji === "number"){
        kanji = playerKanjiData[kanji];
    }*/
    kanji.trialHistory.push({
        dateStamp: new Date(),
        success: succeeded,
    });

    kanji.lastTrialNum = srsData.trialsThisSession;
    srsData.trialsThisSession++;
    if(kanji.masteryStage === 0){
        srsData.trialsSinceLastNewKanji = 0;
    } else {
        srsData.trialsSinceLastNewKanji++;
    }

    if(succeeded && kanji.daysUntilMasteryIncreaseOpportunity === 0){
        kanji.masteryStage++;
        kanji.highestMasteryStage = Math.max(kanji.masteryStage,kanji.highestMasteryStage);
        kanji.daysUntilMasteryIncreaseOpportunity = masteryStageIntervals[kanji.masteryStage];
        globalPlayerStatisticData.totalKanjiMastery++;
    }
    if(succeeded){
        kanji.trialSuccesses++;
        if(kanji.reviewStage !== null){
            kanji.reviewStage = kanji.reviewStage*4*kanji.masteryStage;
        } else {
            kanji.reviewStage = 60*60*4;
            kanji.daysUntilNextScheduledTrial = kanji.daysUntilMasteryIncreaseOpportunity;
        }
    } else {
        kanji.trialFailures++;
        if(kanji.reviewStage !== null){
            kanji.reviewStage = kanji.reviewStage*0.75;
        } else {
            // Starts at 20 seconds
            kanji.reviewStage = 20;
        }
    }
}

// Evaluate conditions for listing abilities, unlocking abilities, listing theory pages, or unlocking theory pages.
let evaluateUnlockRequirements = function(playerAbilityData, requirements){
    let unlocked = true;
    for(let i=0;i<requirements.length;i++){
        let r = requirements[i];
        if(r.type === "statistic threshold"){
            r.progress = globalPlayerStatisticData[r.stat];
            if(r.progress < r.number){
                unlocked = false;
            }
        } else if(r.type === "acquired ability"){
            if(playerAbilityData.acquiredAbilities[r.ability]){
                r.progress = 1;
                unlocked = true;
            } else {
                r.progress = 0;
                unlocked = false;
            }
        }
    }
    return unlocked;
}

// Update condition tooltips when condition array is modified
function updateConditionTooltips(playerConditions){
    // Delete existing condition tooltops first
    for(let i = tooltipBoxes.length-1;i>=0;i--){
        if(tooltipBoxes[i].type === "condition"){
            tooltipBoxes.splice(i,1);
        }
    }

    let conditionLine = "Conditions: ";
    let conditionLineNum = 0;
    context.font = '18px zenMaruMedium';
    context.textAlign = 'left';
    for(let i in playerConditions){
        const condition = playerConditions[i];

        if((conditionLine + condition.name).length > "Conditions: Dysymbolia, Hunger, aaa".length){
            conditionLine = "";
            conditionLineNum++;
        }

        tooltipBoxes.push({
            x: globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 20+context.measureText(conditionLine).width,
            y: globalWorldData.worldY+210-18+conditionLineNum*24,
            width: context.measureText(condition.name).width, height: 18,
            type: "condition", condition: condition, spawnTime: 0,
        });
        if(i < playerConditions.length-1){
            conditionLine += condition.name+", ";
        } else {
            conditionLine += condition.name;
        }
    }

    reapplyTooltip();
}

// Registers the tooltip boxes for the player's inventory while optionally adding an item in the highest slot
function updateInventory(playerInventoryData,addItem = "none",addMenuTooltips = false){
    for(let i = tooltipBoxes.length-1;i>=0;i--){
        if(tooltipBoxes[i].type === "item"){
            tooltipBoxes.splice(i,1);
        }
    }

    for(let i=0; i<playerInventoryData.inventory.length; i++){
        let item = playerInventoryData.inventory[i];
        if(item !== "none"){
            if(i<5){
                tooltipBoxes.push({
                    x: globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 28+50*i,
                    y: globalWorldData.worldY+690,
                    width: 45, height: 45,
                    type: "item", item: item, inventoryIndex: i, spawnTime: 0,
                });
            }
            if(addMenuTooltips){
                tooltipBoxes.push({
                    x: globalWorldData.worldY+285+105+67*(i%5),
                    y: globalWorldData.worldY+160 + 67*Math.floor(i/5),
                    width: 60, height: 60,
                    type: "item", item: item, inventoryIndex: i, spawnTime: 0,
                });
            }
        } else if(addItem !== "none"){
            playerInventoryData.inventory[i] = addItem;
            tooltipBoxes.push({
                x: globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 28+50*i,
                y: globalWorldData.worldY+690,
                width: 45, height: 45,
                type: "item", item: addItem, inventoryIndex: i, spawnTime: 0,
            });
            addItem = "none";
        }
    }

    reapplyTooltip();
}

// Will add graphics associated with awarding stuff to the player much later
function awardPlayer(playerInventoryData,award,timeStamp){
    if(typeof award === "object"){
        playerInventoryData.currencyTwo += award.number;

        addIngameLogLine(`Awarded with ${award.number} diamonds!`,180,100,70,1,timeStamp);
    }
}

// Update the player's ability data with the current listed and aquirable abilities
function updatePlayerAbilityList(playerAbilityData){
    let newAbilityList = [];

    for(let i=0;i<abilityFileData.length;i++){
        let a = abilityFileData[i];

        if(evaluateUnlockRequirements(playerAbilityData, a.listRequirements)){
            let unlocked = evaluateUnlockRequirements(playerAbilityData, a.unlockRequirements);
            newAbilityList.push({
                name: a.name,
                jpName: a.jpName,
                unlockRequirements: a.unlockRequirements,
                unlocked: unlocked,
                acquired: playerAbilityData.acquiredAbilities[a.name],
                index: i,
            });
        }
    }
    playerAbilityData.list = newAbilityList;
}

// take Up, Down, Left, or Right, and return a new direction
function moveInDirection(location,degree,direction){
    if(direction === "Down"){
        return [location[0],location[1]+degree];
    } else if (direction === "Up"){
        return [location[0],location[1]-degree];
    } else if (direction === "Right"){
        return [location[0]+degree,location[1]];
    } else if (direction === "Left"){
        return [location[0]-degree,location[1]];
    }
}

function useItem(playerInventoryData,playerCombatData,playerConditions,inventoryIndex,particleSysX,particleSysY){
    let item = playerInventoryData.inventory[inventoryIndex];
    let info = itemInfo[item];

    if(info.name === "Dev Gun"){
        addIngameLogLine(`You feel really cool for having this don't you.`,180,100,70,1.7,performance.now());
        if(movingAnimationDuration === 200){
            movingAnimationDuration = 40;
            globalWorldData.speedMode = true;
        } else {
            movingAnimationDuration = 200;
            globalWorldData.speedMode = false;
        }
    } else {
        for(const eff of info.effectList){
            if(eff === "heal"){
                playerCombatData.hp = Math.min(playerCombatData.maxHp,playerCombatData.hp+info.effects.healAmount);
            } else if (eff === "satiate"){
                // TODO make a full hunger system
                for(let i=playerConditions.length-1;i>=0;i--){
                    if(playerConditions[i].name === "Hunger"){
                        playerConditions.splice(i,1);
                        updateConditionTooltips(playerConditions);
                    }
                }
            }
        }

        particleSystems.push(createParticleSystem({hue:120,saturation:100,lightness:50,x:particleSysX, y:particleSysY, temporary:true, particlesLeft:10, particleSpeed: 200, particleAcceleration: -100, particleLifespan: 2000}));

        playerInventoryData.inventory[inventoryIndex] = "none";
    }
}

// Called when dialogue begins
// Entity index is the index of the entity that is being interacted with in the level
function initializeDialogue(category, scenario, timeStamp, entityIndex = null){
    globalWorldData.gameClockOfLastPause = globalWorldData.currentGameClock;
    globalInputData.currentDirectionFrozen = true;
    return {
        startTime: timeStamp,
        lineStartTime: timeStamp,
        currentLine: 0,
        textLines: dialogueFileData[category][scenario].textLines,
        lineInfo: dialogueFileData[category][scenario].lineInfo,
        cinematic: null,
        entityIndex: entityIndex,
        category: category,
        scenario: scenario,
    };
}
function endDialogue(timeStamp){
    globalInputData.currentDirectionFrozen = false;
    globalWorldData.timeOfLastUnpause = timeStamp;
    return null;
}

// Draws text one word at a time to be able to finely control what is written, designed to be a version of wrapText with much more features,
//  including utilizing and managing its own particle systems
// Uses the dialogue object in the scene to figure out what to write.

// registerTooltopBox is an object with all the tooltip information needed other than x and y
//  and this function will register the box with the missing information filled in
function drawDialogueText(dialogue, x, y, maxWidth, lineHeight, timeStamp, registerTooltipBox = null, preprocessText = null) {
    let d = dialogue;

    // First cuts up the dialogue text
    let words = [];

    if(preprocessText !== null){
        words = preprocessText.split('+');
    } else {
        words = d.textLines[d.currentLine].replace(/playerName/g,"Mari").split(' ');
    }

    let testLine = ''; // This will store the text when we add a word, to test if it's too long
    let lineArray = []; // Array of the individual words, a new array is a new line
    // The words are arrays with text, x, and y and are all to be drawn at the end

    let currentX = x; // x coordinate in which to draw the next word
    let currentY = y; // y coordinate in which to draw the next word

    let textSpeed = d.lineInfo[d.currentLine].textSpeed;
    if(textSpeed === undefined){
        textSpeed = 200;
    }
    let displayNumCharacters = Math.floor((timeStamp-d.lineStartTime)*(textSpeed/1000));
    let currentlyDisplayedCharacters = 0;

    context.textAlign = 'left';

    for(var i = 0; i < words.length; i++) {
        // Create a test line, and measure it..
        testLine += `${words[i]} `;

        let metrics = context.measureText(testLine);
        // If the width of this test line is more than the max width
        if (metrics.width > maxWidth && i > 0) {
            // Then the line is finished, start a new line by increasing the line height, resetting the x value,
            //  and resetting the test line
            currentY += lineHeight;
            currentX = x;
            testLine = `${words[i]} `;
            metrics = context.measureText(testLine)
        }

        lineArray.push([words[i],currentX,currentY]);
        //console.log(lineArray);
        currentX = x + metrics.width;
        /*
        // If we never reach the full max width, then there is only one line.. so push it into the lineArray so we return something
        if(i === words.length - 1) {
            lineArray.push([line, y]);
        }*/
    }
    // Defer certain words until later because of graphics reasons
    let deferredWords = [];

    // Now get around to actually writing the text
    for(const word of lineArray){
        if(currentlyDisplayedCharacters + word[0].length <= displayNumCharacters){
            currentlyDisplayedCharacters += word[0].length;
        } else {
            if(currentlyDisplayedCharacters === displayNumCharacters){
                break;
            } else {
                word[0] = word[0].slice(0, displayNumCharacters - currentlyDisplayedCharacters);
                currentlyDisplayedCharacters += word[0].length;
            }
        }
        if(word[0].includes("hungry")){
            let re = new RegExp(`(hungry)`);
            let splitText = word[0].split(re);
            currentX = word[1];


            for(const text of splitText){
                if(text==="hungry"){
                    context.save();
                    context.fillStyle = "#d66b00";
                    context.fillText(text,currentX,word[2]);
                    //console.log(text,currentX,word[2]);
                    currentX += context.measureText(text).width;
                    context.restore();
                } else {
                    context.fillText(text,currentX,word[2]);
                    currentX += context.measureText(text).width;
                }
            }
            continue;
        } else if(d.cinematic !== null){
            if(d.cinematic.type === "dysymbolia" && d.cinematic.phaseNum < 3){
                if(word[0].includes(d.cinematic.info[0])){
                    let re = new RegExp(`(${d.cinematic.info[0]})`);
                    let splitText = word[0].split(re);
                    currentX = word[1];

                    for(const text of splitText){
                        if(text===d.cinematic.info[0]){
                            deferredWords.push([text,currentX,word[2]]);
                            currentX += context.measureText(text).width;
                        } else {
                            context.fillText(text,currentX,word[2]);
                            currentX += context.measureText(text).width;
                        }
                    }
                    continue;
                }
            }
        }
        if(registerTooltipBox !== null){
            if(!registerTooltipBox.hasOwnProperty("tooltipTargets")){
                if(dictionary.entries.hasOwnProperty(word[0])){
                    // Add tooltip box to scene
                    tooltipBoxes.push({
                        x: word[1]-lineHeight,
                        y: word[2]-lineHeight,
                        width: registerTooltipBox.width*word[0].length,
                        height: registerTooltipBox.height,
                        spawnTime: 0,
                        type: registerTooltipBox.type,
                        index: registerTooltipBox.indexes[i],
                        word: word[0],
                    });
                }
            } else {
                for(let i=0;i<registerTooltipBox.tooltipTargets.length;i++){
                    if(word[0].includes(registerTooltipBox.tooltipTargets[i])){
                        // Add tooltip box to scene
                        tooltipBoxes.push({
                            x: word[1],
                            y: word[2]-lineHeight,
                            width: registerTooltipBox.width*registerTooltipBox.tooltipTargets[i].length,
                            height: registerTooltipBox.height,
                            spawnTime: 0,
                            type: registerTooltipBox.type,
                            index: registerTooltipBox.indexes[i],
                            word: registerTooltipBox.tooltipTargets[i],
                        });
                    }
                }
            } 
        }
        context.fillText(word[0],word[1],word[2]);
    }

    for (const word of deferredWords) {
        let fontSize = Math.floor(16*globalWorldData.sizeMod);
        d.cinematic.particleSystem.x = word[1]+fontSize/2;
        d.cinematic.particleSystem.y = word[2]-fontSize/2;
        d.cinematic.particleSystem.drawParticles(performance.now());

        context.save();
        context.fillStyle = d.cinematic.info[2];
        context.font = `${fontSize}px zenMaruBlack`;
        context.fillText(word[0],word[1],word[2]);
        context.restore();
    }
}

// Draws a tile
function drawTile(type, src, x, y, bitrate = 32, sizeMod = 1){
    context.drawImage(tilesets.tilesetImages[type], src[0], src[1], bitrate, bitrate, x, y, bitrate*sizeMod, bitrate*sizeMod);
}

// Draws a character
function drawCharacter(character, src, x, y, sizeMod){
    context.imageSmoothingEnabled = true;
    let bitrate = characterBitrates[character];
    let size = 32*sizeMod;
    let image = characterSpritesheets[character];
    if(typeof image === "object"){
        context.drawImage(image, src[0]*(bitrate/32), src[1]*(bitrate/32), bitrate, bitrate, x, y, size, size);
    } else {
        console.warn("drawCharacter: Expected object got " + typeof image + ", also you have negative hot men.");
    }
    context.imageSmoothingEnabled = false;
}

function removeFruit(tree){
    if(tree.hasBottomFruit){
        tree.hasBottomFruit = false;
    } else if(tree.hasLeftFruit){
        tree.hasLeftFruit = false;
    } else if(tree.hasRightFruit){
        tree.hasRightFruit = false;
    }
}

function drawItemIcon(itemId,x,y){
    let info = itemInfo[itemId];

    if(info.imageInfo[0] === "tile"){
        drawTile(info.imageInfo[1],info.imageInfo[2],x-(info.imageInfo[3]-1)*16 + info.imageInfo[3]*2 + 4,y-(info.imageInfo[3]-1)*16 + info.imageInfo[3]*2 + 4,32,info.imageInfo[3]);
    } else if(info.imageInfo[0] === "gun"){
        let gun = miscImages.gun;
        let ratio = gun.height/gun.width;
        context.drawImage(miscImages.gun,x+6,y+(45-(32*ratio))/2,32,32*ratio);
    }
}

// Checks if a tile is marked for collision or not. Scene must be adventure 
// checkAdjacent to be set to "up" "left" "right" or "down" or to be left undefined
// - if defined, checks that adjacent tile instead of the one directly indicated by the x and y
// Returns:
// null for no collision, "bounds" for level boundary collision, returns the num of the collision tile if collision tile, or
//returns the reference to the entity object that was collided for entity collision
function isCollidingOnTile(x, y, checkAdjacent = false){
    let lev = levels[globalWorldData.levelNum];
    if(checkAdjacent){
        if(checkAdjacent === "Down"){
            y+=32;
        } else if(checkAdjacent === "Left"){
            x-=32;
        } else if(checkAdjacent === "Right"){
            x+=32;
        } else if(checkAdjacent === "Up"){
            y-=32;
        }
    }
    // First check world bounds
    if (x < 0 || y < 0 || x > (lev.gridWidth-1)*32 || y > (lev.gridHeight-1)*32){
        return "bounds";
    }

    // Currently this local function does not need to exist, but I thought it might have needed to
    const getTileNum = function(x,y){return ((x/32) % lev.gridWidth) + (y/32)*lev.gridWidth;}
    let tileNum = getTileNum(x,y);
    if(tileNum>lev.collisions.length || tileNum<0){
        throw "Something is wrong with tile collision dumb bitch";
    } else if (lev.collisions[tileNum]!==0){
        return lev.collisions[tileNum];
    } else {
        for(let i in lev.entities) {
            if ( lev.entities[i].visible && lev.entities[i].location[0]<=x && lev.entities[i].location[1]<=y &&
                lev.entities[i].location[0]+lev.entities[i].width>x && lev.entities[i].location[1]+lev.entities[i].height>y){

                // Fruit tree only counts if you collide with the bottom half
                if(lev.entities[i].id === "Fruit_Tree"){
                    if (lev.entities[i].location[0]<=x && lev.entities[i].location[1]+32<=y &&
                        lev.entities[i].location[0]+lev.entities[i].width>x && lev.entities[i].location[1]+lev.entities[i].height>y){
                        // ok
                    } else {
                        continue;
                    }
                }
                return {type: "entity",index: i};
            }
        }
    }
    return null;
}

function addIngameLogLine(lineText,h,s,l,durationMultiplier,timeStamp){
    ingameLog.push(
        {
            text: lineText,
            h: h, s: s, l: l,
            durationMultiplier: durationMultiplier,
            timeAdded: timeStamp,
        }
    );
}

// Object that stores information about the game and runs the loop.
// It's a god object but it allows us to hide state from outside functions so the state must be passed around properly
var game = null;

function Game(){

    // **************************************** //
    // PRIVATE members 
    // **************************************** //

    let buttons = [];

    let bgColor = 'rgb(103,131,92)';

    // State of the world screen not included in the global world state
    
    let blur = 0;
    let activeDamage = {
        // If startFrame is positive, there is currently active damage.
        startFrame: -1,

        // Duration of the current damage
        duration: 0,

        // How much the screen was shaken by
        offset: [0,0],

        // Last time the screen was shaken to not shake every single frame
        timeOfLastShake: -1,
    }

    // Player state relevant for graphics in the world screen
    let playerWorldData = {
        location: levels[0].defaultLocation,
        graphicLocation: levels[0].defaultLocation,
        src: [32,0],
        bitrate: 32,
        animation: null,
        name: "Mari", jpName: "マリィ",
        color: "#caa8ff",
    };

    // Player state relevant for combat
    let playerCombatData = {
        level: 1,
        hp: 40, maxHp: 40,
        power: 0, powerSoftcap: 5
    };

    // Player state regarding inventory
    let playerInventoryData = {
        maxInventorySpace: 20,
        currencyOne: 0, currencyTwo: 0,
        inventory: [2,"none","none","none","none", // First 5 items are the hotbar
                    "none","none","none","none","none",
                    "none","none","none","none","none",
                    "none","none","none","none","none"
        ],
    };

    // Player state regarding abilities 
    let playerAbilityData = {
        abilitySlots: 5,

        // Contains listed abilities and data on whether they are unlocked or not
        listedAbilities: [],

        // Dictionary of booleans, is the named ability acquired?
        acquiredAbilities: {},

        // Array of integer indexes for listed abilities
        // The ones that are over the maximum amount of abilities are ignored
        equippedAbilities: [null,null,null,null,null,null,null,null,null,null],

        acquiringAbility: null,

        basicDysymboliaControl: true
    };

    let playerSrsSettingsData = {
        //trialsPerRandomDysymbolia: 8,
        reinforcementIntervalLength: 10,
    };

    let playerKanjiData = [];

    let playerTheoryData = [];

    let playerConditions = [
        {
            name: "Dysymbolia",
            jpName: "ディシンボリア",
            //type: "Curse",
            color: "white",
            golden: false,
            desc: "Character sees visions of a distant world. Next in $timeUntilDysymbolia$, or when ???.",
            particleSystem: null, // Becomes a particle system when one needs to be drawn behind it
        },
        {
            name: "Hunger",
            jpName: "空腹",
            //type: "Standard condition",
            color: "#d66b00",
            desc: "Character is hungry. Healing from most non-food sources is reduced."
        }
    ];

    let menuScene = null;
    let menuData = {
        loadStatement: null,
        selectedAbility: 0,
        selectedKanji: 0,
        selectedWriteup: 0,
        isReadingWriteup: false,
    }

    let dialogue = null;
    let combat = null;
    let handleDraggingObject = undefined;
    let draggingObject = null;
    
    let roomEnemies = [];

    globalWorldData.timeOfLastUnpause = performance.now();
    globalWorldData.gameClockOfLastPause = 600;

    let srsData = {
        trialsSinceLastNewKanji: 0,
        trialsThisSession: 0,
    }

    
    

    // ***************** private functions! ********************

    function updateGame(timeStamp){
        let lev = levels[globalWorldData.levelNum];

        // Update in-game time
        let newTime = (globalWorldData.gameClockOfLastPause+Math.floor((timeStamp-globalWorldData.timeOfLastUnpause)/1000))%1440;
    
        // If a second went by, update everything that needs to be updated by the second
        if(dialogue === null && menuScene === null && combat === null && (newTime > globalWorldData.currentGameClock || (globalWorldData.currentGameClock === 1439 && newTime !== 1439))){
            if(timeUntilDysymbolia > 0){
                timeUntilDysymbolia-=1;
            }
    
            // Begin dysymbolia dialogue!
            else if (playerAbilityData.acquiringAbility !== null){
                dialogue = initializeDialogue("abilityAcquisition",abilityFileData[playerAbilityData.acquiringAbility].name,timeStamp);
            } else if (!globalPlayerStatisticData.finishedFirstRandomDysymboliaScene){
                dialogue = initializeDialogue("randomDysymbolia","first",timeStamp);
                globalPlayerStatisticData.finishedFirstRandomDysymboliaScene = true;
            } else {
                dialogue = initializeDialogue("randomDysymbolia","auto",timeStamp);
            }
            globalWorldData.currentGameClock = newTime;
        }
    
        // Some local fuctions that will be useful for the update phase
    
        // Return a dysymbolia cinematic object which stores state about how it will play out and its current state
        let newDysymboliaCinematic = function(phase, trials, dysymboliaInfo, startTime = timeStamp, trialedKanjiIndexes = [], specialTrials = 0){
            if(dysymboliaInfo.length > 4){
                trialedKanjiIndexes.push(dysymboliaInfo[4]);
            }
            return {
                type: "dysymbolia",
                startTime: startTime,
                phaseStartTime: timeStamp,
                // Phase 0 is the introduction phase where the text line is shown but no input has started yet.
                // Phase 1 starts with the z key and the player is to input their answer
                // Phase 2 is when the answer is inputted and an animation shows the answer.
                // Phase 3 is when the story of the last trial or the whole text line is to be checked before going on to the next trial,
                //or ending when z is pressed. Skipped when the player gets the kanji right and indicates to go straight to the next trial
                // The cinematic ends when the z key is pressed during phase 3
                phaseNum: phase,
    
                // Subject to refactoring but currently:
                // info[0] is the kanji symbol
                // info[1] is an array of corrrect answers that can be given
                // info[2] is the color of the kanji when it is appropiate to color it
                // info[3] is the entire word of the dysymbolia in the dialogue sentence
                info: dysymboliaInfo,
                particleSystem: particleSystems[particleSystems.length-1],
                trialsLeft: trials,
                specialTrialsLeft: specialTrials,
                //trialedKanji: trialedKanji,
                // Indexes are their index in the player kanjidata array
                trialedKanjiIndexes: trialedKanjiIndexes,
    
                // True when the animation finishes
                animationFinished: false,
                finished: false,
                result: null,
    
                // Will apply effects after the animation is finished when this is still false
                tooltipsRegistered: false,
            };
        }
    
        // Changes the area (level) in adventure mode
        // Takes the Iid of the area to be changed to because thats what the level neighbours are identified by
        // Or level name works too
        function changeArea(iid,connectionId = null){
            let initializeArea = function(){
                let lev = levels[globalWorldData.levelNum];
                roomEnemies = [];
                if(connectionId){
                    // Changes the player's location to the exit location of the connected location
                    for(let i=0;i<connections.length;i++){
                        if(connections[i].connectionId === connectionId && connections[i].area === lev.iid){
                            let exitLocation = moveInDirection(connections[i].exitLocation,TILE_SIZE,connections[i].exitDirection);
                            playerWorldData.location = [exitLocation[0],exitLocation[1]];
                            playerWorldData.graphicLocation = [exitLocation[0],exitLocation[1]];
                            playerWorldData.src = [32,spritesheetOrientationPosition[connections[i].exitDirection]*32];
                            globalInputData.currentDirection = connections[i].exitDirection;
                            break;
                        }
                    }
                }
                for(let i=0;i<levels[globalWorldData.levelNum].entities.length;i++){
                    if(lev.entities[i].type === "enemy"){
                        let enemy = lev.entities[i];
                        let enemyInfo = enemyFileData[enemy.fileDataIndex];
                        enemy.hp = enemy.maxHp = enemyInfo.hp;
    
                        roomEnemies.push(enemy);
                    }
                }
            }
            for(let i in levels){
                if(levels[i].iid === iid || levels[i].identifier === iid){
                    globalWorldData.levelNum = i;
                    if(combat){
                        combat = null;
                        globalWorldData.timeOfLastUnpause = timeStamp;
                    }
                    initializeArea();
                    return;
                }
            }
            throw "changeArea: New area not found: " + iid;
        }
    
        // Get the kanji with the highest study priority and return its playerKanjiData entry
        let getNextKanji = function(noNewKanji = false, special = false){
            let currentDate = new Date();
            let highestPriorityIndex = 0;
            if(!special){
                let priority = assignStudyPriority(srsData,playerKanjiData[0],currentDate,noNewKanji);
                let highestPriority = priority;
    
                for(let i=1;i<playerKanjiData.length;i++){
                    priority = assignStudyPriority(srsData,playerKanjiData[i],currentDate,noNewKanji);
                    if(priority>highestPriority){
                        highestPriority = priority;
                        highestPriorityIndex = i;
                    }
                }
            } else {
                let specialKanji = abilityFileData[playerAbilityData.acquiringAbility].specialKanji;
                let priority = assignStudyPriority(srsData,playerKanjiData[specialKanji[0]],currentDate,false);
                let highestPriority = priority;
                highestPriorityIndex = specialKanji[0];
    
                for(let i=1;i<specialKanji.length;i++){
                    priority = assignStudyPriority(srsData,playerKanjiData[specialKanji[i]],currentDate,false);
                    if(priority>highestPriority){
                        highestPriority = priority;
                        highestPriorityIndex = specialKanji[i];
                    }
                }
            }
    
            return playerKanjiData[highestPriorityIndex];
        }
    
        // All enemies in the room get a chance to make one action
        let takeEnemyActions = function(){
            // return one of the 4 directions or "adjacent" if already there
            let routeTowardsPlayer = function(enemyX,enemyY,playerX,playerY){
                return "adjacent";
            }
            let takeCombatAction = function(enemy){
                let enemyInfo = enemyFileData[enemy.fileDataIndex];
    
                let chosenIndex = Math.floor(Math.random()*enemyInfo.aiInfo.pool.length);
                let action = enemyInfo.actions[enemyInfo.aiInfo.pool[chosenIndex]];
    
                combat.currentEnemyAction = {
                    actionInfo: action,
                    startTime: timeStamp,
                };
                combat.enemyActionEffectApplied = false;
            }
            if(combat !== null){
                takeCombatAction(combat.enemy);
                combat.turnCount++;
            } else {
                for(let i=0;i<roomEnemies.length;i++){
                    let enemy = roomEnemies[i];
                    let step = routeTowardsPlayer();
                    if(step === "adjacent"){
                        // initialize combat. we dont use a seperate funciton for this yet.
                        combat = {
                            enemy: enemy,
                            currentEnemyAction: null,
                            currentPlayerAction: null,
                            enemyActionEffectApplied: false,
                            playerActionEffectApplied: false,
                            turnCount: 0,
                            status: "ongoing",
                        }
                        takeCombatAction(roomEnemies[i],i);
                        globalWorldData.gameClockOfLastPause = globalWorldData.currentGameClock;
                        combat.turnCount++;
                    }
                }
            }
        }
    
        let applyUpkeepEffects = function(){
            let newConditions = [];
            let isUpdateNecessary = false;
            let poisonDamageTaken = 0;
            for(let i=0;i<playerConditions.length;i++){
                let condition = playerConditions[i];
                if(condition.name === "Lizard Toxin"){
                    poisonDamageTaken++;
                    condition.turnsLeft--;
                    if(condition.turnsLeft<=0){
                        isUpdateNecessary = true;
                    } else {
                        newConditions.push(condition);
                    }
                } else {
                    newConditions.push(condition);
                }
            }
    
            if(poisonDamageTaken>0){
                playerCombatData.hp-=poisonDamageTaken;
                globalPlayerStatisticData.totalDamageTaken+=poisonDamageTaken;
                addIngameLogLine(`Took ${poisonDamageTaken} poison damage.`,78,100,40,1.5,timeStamp);
            }
    
            if(isUpdateNecessary){
                playerConditions = newConditions;
                updateConditionTooltips(playerConditions);
            }
        }
    
        let applyPlayerActionEffect = function(){
            let enemy = combat.enemy;
    
            let damage = Math.min(2,enemy.hp);
            enemy.hp -= damage;
    
            addIngameLogLine(`Mari stomped the lizard dealing ${damage} damage!`,0,100,100,1.5,timeStamp);
    
            if(enemy.hp<=0){
                addIngameLogLine(`Mari has defeated a Green Lizard!`,130,100,65,0.65,timeStamp);
                enemy.ephemeral = true;
                enemy.visible = false;
                combat.status = "enemy defeated";
            }
    
            applyUpkeepEffects();
    
            combat.playerActionEffectApplied = true;
        }
    
        let applyEnemyActionEffect = function(){
            let enemy = combat.enemy;
            let enemyInfo = enemyFileData[enemy.fileDataIndex];
            let action = combat.currentEnemyAction.actionInfo;
    
            playerCombatData.hp -= action.power;
            globalPlayerStatisticData.totalDamageTaken += action.power;
            addIngameLogLine(action.text.replace("{damage}", action.power),0,90,70,1.5,timeStamp);
    
            if(action.condition !== undefined){
                let newCondition = {
                    name: action.condition.name,
                    color: action.condition.color,
                    desc: action.condition.desc,
                    turnsLeft: action.condition.minDuration + Math.floor(Math.random()*(action.condition.maxDuration+1-action.condition.minDuration)),
                }
                playerConditions.push(newCondition);
                updateConditionTooltips(playerConditions);
            }
    
            activeDamage = {
                // If startFrame is positive, there is currently active damage.
                startFrame: timeStamp,
    
                // Duration of the current damage
                duration: 1,
    
                // How much the screen was shaken by
                offset: [0,0],
    
                // Last time the screen was shaken to not shake every single frame
                timeOfLastShake: -1,
            };
            combat.enemyActionEffectApplied = true;
        }
    
        // Usually called when the player presses a key but can be called for other reasons during a cinematic
        let advanceDialogueState = function(advanceToNextLine = true){
            
            let advanceDysymboliaCinematicState = function(){
                // Phase 0 is the introduction phase where the text line is shown but no input has started yet.
                // Phase 1 starts with the z key and the player is to input their answer. That phase is ignored here.
                // Phase 2 is when the answer is inputted and an animation shows the answer. That phase is ignored here.
                // Phase 3 is when the story of the last trial or the whole text line is to be checked before going on to the next trial,
                //or ending when z is pressed. Skipped when the player gets the kanji right and indicates to go straight to the next trial
                // The cinematic ends when the z key is pressed during phase 3

                // Handle phase 0
                if(dialogue.cinematic.phaseNum === 0){
                    // Begin the inputting phase
                    dialogue.cinematic.phaseNum = 1;
                    dialogue.cinematic.phaseStartTime = timeStamp;
                    globalInputData.inputtingText = true;
                    globalInputData.finishedInputtingText = false;
                    return;
                } 
                
                if (dialogue.cinematic.phaseNum === 3) {
                    if(dialogue.cinematic.trialsLeft < 1 && dialogue.cinematic.specialTrialsLeft < 1){
                        blur = 0;
                        globalInputData.textEntered = "";
                        timeUntilDysymbolia = 60;
                        note = "無";
                        for(let i in playerConditions){
                            if(playerConditions[i].name === "Dysymbolia"){
                                playerConditions[i].golden = false;
                                playerConditions[i].color = `white`;
                                updateConditionTooltips(playerConditions);
                            }
                        }
                        for(let i = tooltipBoxes.length-1;i>=0;i--){
                            if(tooltipBoxes[i].type === "dictionary" || tooltipBoxes[i].type === "kanji"){
                                tooltipBoxes.splice(i,1);
                                //if(currentTooltip !== null && currentTooltip.index === i){
                                    currentTooltip = null;
                                //}
                            }
                        }
                        if(dialogue.scenario.includes("tutorial") || dialogue.category === "randomDysymbolia"){
                            if(globalPlayerStatisticData.totalPowerGained <= 5){
                                dialogue = initializeDialogue("scenes","post dysymbolia "+globalPlayerStatisticData.totalPowerGained,timeStamp);
                            } else {
                                dialogue = endDialogue(timeStamp);
                            }
                        } else if(dialogue.category === "abilityAcquisition"){
                            
                            if(!dialogue.dysymboliaFailed){
                                // Phase 4 where we play the animation acquired cinematic
                                dialogue.cinematic.phaseNum = 4;
                                dialogue.textLines[dialogue.currentLine] = dialogue.scenario;
                                dialogue.cinematic.animationFinished = false;
                                dialogue.cinematic.tooltipsRegistered = false;

                                dialogue.cinematic.phaseStartTime = timeStamp;
                            } else {
                                dialogue.cinematic = null;
                                advanceDialogueState();
                            }
                        } else {
                            dialogue = endDialogue(timeStamp);
                        }
                        return;
                    }

                    // If there are regular trials left, start a regular trial at phase 1
                    if(dialogue.cinematic.trialsLeft > 0){
                        let specialParticleSystem = dialogue.lineInfo[dialogue.currentLine].particleSystem;
                        specialParticleSystem.specialDrawLocation = true;
    
                        particleSystems.push(createParticleSystem(specialParticleSystem));
    
                       timeUntilDysymbolia = -1;
                        let kanjiPlayerInfo = null;
                        if(dialogue.cinematic.specialTrialsLeft>0){
                            kanjiPlayerInfo = getNextKanji(true);
                        } else {
                            kanjiPlayerInfo = getNextKanji();
                        }
                        let kanjiFileInfo = adventureKanjiFileData[kanjiPlayerInfo.index];
                        dialogue.cinematic = newDysymboliaCinematic(1,dialogue.cinematic.trialsLeft,[kanjiFileInfo.symbol,[kanjiFileInfo.keyword.toLowerCase()],"white",kanjiFileInfo.symbol,kanjiPlayerInfo.index],dialogue.cinematic.startTime,dialogue.cinematic.trialedKanjiIndexes,dialogue.cinematic.specialTrialsLeft);
    
                        dialogue.textLines[dialogue.currentLine] = dialogue.textLines[dialogue.currentLine] + " " + kanjiFileInfo.symbol + "...";
                        globalInputData.inputtingText = true;
                        globalInputData.finishedInputtingText = false;
                        globalInputData.textEntered = "";

                        return;
                    }

                    // Do a special trial, which is the only remaining case.
                    for(let i in playerConditions){
                        if(playerConditions[i].name === "Dysymbolia"){
                            playerConditions[i].golden = true;
                            playerConditions[i].color = `hsl(60,100%,65%)`;
                            updateConditionTooltips(playerConditions);
                        }
                    }

                    let specialParticleSystem = dialogue.lineInfo[dialogue.currentLine].specialParticleSystem;
                    specialParticleSystem.specialDrawLocation = true;

                    particleSystems.push(createParticleSystem(specialParticleSystem));

                    timeUntilDysymbolia = -1;
                    let kanjiPlayerInfo = getNextKanji(false,true);
                    let kanjiFileInfo = adventureKanjiFileData[kanjiPlayerInfo.index];
                    dialogue.cinematic = newDysymboliaCinematic(1,dialogue.cinematic.trialsLeft,[kanjiFileInfo.symbol,[kanjiFileInfo.keyword.toLowerCase()],"white",kanjiFileInfo.symbol,kanjiPlayerInfo.index],dialogue.cinematic.startTime,dialogue.cinematic.trialedKanjiIndexes,dialogue.cinematic.specialTrialsLeft);

                    dialogue.textLines[dialogue.currentLine] = dialogue.textLines[dialogue.currentLine] + " " + kanjiFileInfo.symbol + "...";
                    globalInputData.inputtingText = true;
                    globalInputData.finishedInputtingText = false;
                    globalInputData.textEntered = "";
                    dialogue.cinematic.specialTrialsLeft--;
                }

                if (dialogue.cinematic.phaseNum === 5){
                    // Acquire ability!
                    let playerAbilityInfo = playerAbilityData.list[playerAbilityData.acquiringAbility];
                    let abilityInfo = abilityFileData[playerAbilityInfo.index];

                    playerCombatData.power -= abilityInfo.acquisitionPower;
                    playerAbilityInfo.acquired = true;
                    playerAbilityData.acquiredAbilities[abilityInfo.name] = true;
                    playerAbilityData.acquiringAbility = null;
                    game.acquisitionButtonParticleSystem.temporary = true;
                    game.acquisitionButtonParticleSystem.particlesLeft = 0;

                    dialogue.cinematic = null;
                    blur = 0;

                    for(let i = tooltipBoxes.length-1;i>=0;i--){
                        if(tooltipBoxes[i].type === "dictionary" || tooltipBoxes[i].type === "kanji"){
                            tooltipBoxes.splice(i,1);
                            //if(currentTooltip !== null && currentTooltip.index === i){
                                currentTooltip = null;
                            //}
                        }
                    }

                    dialogue.currentLine++; dialogue.currentLine++;
                    advanceDialogueState(false);
                    return;
               }
            } // Advance cinematic state function ends here
    
            let applyConditionalEffect = function(eff,lineInfo){
                if(eff === "end"){
                    dialogue = endDialogue(timeStamp);
                } else if (eff === "continue"){
                    // do nothing lol
                } else if (eff === "altText"){
                    dialogue.textLines[dialogue.currentLine] = lineInfo.altText;
                } else if (eff.includes("jump to")){
                    dialogue.currentLine = parseInt(eff[eff.length-1]);
                    advanceToNextLine = false;
                }
            }
    
            if(dialogue.cinematic !== null){
                // Advance the cinematic state
                advanceDysymboliaCinematicState();
            } else {
                // First, apply effects of the previous player response if there was one
                if(dialogue.lineInfo[dialogue.currentLine].playerResponses){
                    let lineInfo = dialogue.lineInfo[dialogue.currentLine];
                    if(lineInfo && lineInfo.selectedResponse !== undefined){
                        applyConditionalEffect(lineInfo.responseEffects[lineInfo.selectedResponse],lineInfo);
                    }
                    if(dialogue === null){
                        return;
                    }
                }
    
                if(dialogue.textLines.length <= dialogue.currentLine+1){
                    // Finish dialogue if no more line
                    dialogue = endDialogue(timeStamp);
                } else {
                    // Otherwise advance line
                    dialogue.lineStartTime = timeStamp;
    
                    if(dialogue.lineInfo[dialogue.currentLine].takeEnemyTurn !== undefined){
                        takeEnemyActions();
                        dialogue = endDialogue(timeStamp);
                        return;
                    }
    
                    if(advanceToNextLine){
                        dialogue.currentLine++;
                    }
    
                    // Apply effects that are on the new line
                    if(dialogue.lineInfo[dialogue.currentLine].addItem !== undefined){
                        updateInventory(playerInventoryData, dialogue.lineInfo[dialogue.currentLine].addItem);
                        addIngameLogLine("Mari added an item to her inventory!",130,100,70,2,timeStamp);
                    }
                    if(dialogue.lineInfo[dialogue.currentLine].takeFruit !== undefined){
                        updateInventory(playerInventoryData, 0);
                        removeFruit(lev.entities[dialogue.entityIndex]);
                        addIngameLogLine("Mari took a fruit from the tree.",130,100,70,2,timeStamp);
                    }
                    if(dialogue.lineInfo[dialogue.currentLine].areaChange !== undefined){
                        changeArea(dialogue.lineInfo[dialogue.currentLine].areaChange,dialogue.lineInfo[dialogue.currentLine].connectionId);
                    }
                    let lineInfo = dialogue.lineInfo[dialogue.currentLine];
    
                    // Check for a conditional on the new line and evaluate
                    if(lineInfo !== undefined && lineInfo.conditional !== undefined){
                        let conditionalEval = false;
                        if(lineInfo.conditional === "is wary of scene dysymbolia"){
                            if(globalPlayerStatisticData.totalSceneDysymboliaExperienced > 1){
                                conditionalEval = true;
                            }
                        }
                        if(conditionalEval){
                            applyConditionalEffect(lineInfo.conditionalSuccess,lineInfo);
                        } else {
                            applyConditionalEffect(lineInfo.conditionalFail,lineInfo);
                        }
                    }
    
                    // Check for a cinematic on the new line, then start it if there is one
                    // TODO: DRY? For now im waiting for more cases to be able to make a better solution
                    if(lineInfo !== undefined && lineInfo.dysymbolia !== undefined){
                        let specialParticleSystem = lineInfo.particleSystem;
                        specialParticleSystem.specialDrawLocation = true;
    
                        particleSystems.push(createParticleSystem(specialParticleSystem));
                        timeUntilDysymbolia = -1;
    
                        dialogue.cinematic = newDysymboliaCinematic(0,1,lineInfo.dysymbolia);
    
                    } else if (lineInfo !== undefined && lineInfo.randomDysymbolia !== undefined){
                        let specialParticleSystem = dialogue.lineInfo[dialogue.currentLine].particleSystem;
                        specialParticleSystem.specialDrawLocation = true;
    
                        particleSystems.push(createParticleSystem(specialParticleSystem));
    
                        timeUntilDysymbolia = -1;
                        let kanjiPlayerInfo = getNextKanji();
                        let kanjiFileInfo = adventureKanjiFileData[kanjiPlayerInfo.index];
                        dialogue.cinematic = newDysymboliaCinematic(0,5,[kanjiFileInfo.symbol,[kanjiFileInfo.keyword.toLowerCase()],"white",kanjiFileInfo.symbol,kanjiPlayerInfo.index]);
    
                        dialogue.textLines[dialogue.currentLine] = kanjiFileInfo.symbol + "...";
                    } else if (lineInfo !== undefined && lineInfo.abilityAcquisition !== undefined){
                        dialogue.dysymboliaFailed = false;
    
                        let specialParticleSystem = dialogue.lineInfo[dialogue.currentLine].particleSystem;
                        specialParticleSystem.specialDrawLocation = true;
    
                        particleSystems.push(createParticleSystem(specialParticleSystem));
    
                        timeUntilDysymbolia = -1;
                        let kanjiPlayerInfo = getNextKanji();
                        let kanjiFileInfo = adventureKanjiFileData[kanjiPlayerInfo.index];
                        dialogue.cinematic = newDysymboliaCinematic(0,lineInfo.normalTrials,[kanjiFileInfo.symbol,[kanjiFileInfo.keyword.toLowerCase()],"white",kanjiFileInfo.symbol,kanjiPlayerInfo.index],timeStamp,[],lineInfo.specialTrials);
    
                        dialogue.textLines[dialogue.currentLine] = kanjiFileInfo.symbol + "...";
                    }
                }
            }
        }
    
        const updateWorldScreen = function(){
            if(globalInputData.mouseDown && currentTooltip && tooltipBoxes[currentTooltip.index].type === "condition" && tooltipBoxes[currentTooltip.index].condition.name === "Dysymbolia" && playerAbilityData.basicDysymboliaControl){
                if(timeUntilDysymbolia > 0){
                    timeUntilDysymbolia = 0;
                    globalPlayerStatisticData.totalDysymboliaManualTriggers++;
                }
            }
    
            const updateMovementAnimation = function(user,animationInfo){
                // Between 0 and 1 where 0 is the very beginning and 1 is finished
                let animationCompletion = (timeStamp - animationInfo.startTime)/movingAnimationDuration;
    
                if(animationCompletion >= 1){
                    applyUpkeepEffects();
    
                    user.animation = null;
                    user.graphicLocation = [user.location[0],user.location[1]];
                    return;
                }
                if(animationCompletion > 0.25 && animationCompletion < 0.75){
                    user.src = [user.whichFoot*2*32,spritesheetOrientationPosition[animationInfo.direction]*32];
                } else {
                    user.src = [32,spritesheetOrientationPosition[animationInfo.direction]*32];
                }
    
                if(animationInfo.direction === "Up"){
                    user.graphicLocation = [user.location[0],user.location[1]+TILE_SIZE*(1-animationCompletion)];
                } else if(animationInfo.direction === "Left"){
                    user.graphicLocation = [user.location[0]+TILE_SIZE*(1-animationCompletion),user.location[1]];
                } else if(animationInfo.direction === "Right"){
                    user.graphicLocation = [user.location[0]-TILE_SIZE*(1-animationCompletion),user.location[1]];
                } else if(animationInfo.direction === "Down"){
                    user.graphicLocation = [user.location[0],user.location[1]-TILE_SIZE*(1-animationCompletion)];
                }
            }
    
            const updateBasicAttackAnimation = function(user,receiver,timeElapsed){
                if(timeElapsed < 400){
                    let factor = timeElapsed/2000;
                    user.graphicLocation[0] = (user.location[0]+receiver.location[0]*factor)/(1+factor);
                    user.graphicLocation[1] = (user.location[1]+receiver.location[1]*factor)/(1+factor);
                } else if(timeElapsed<600){
                    if(!combat.enemyActionEffectApplied){
                        applyEnemyActionEffect();
                    }
                    let midfactor = 1/5;
                    let midpoint = [(user.location[0]+receiver.location[0]*midfactor)/(1+midfactor),(user.location[1]+receiver.location[1]*midfactor)/(1+midfactor)];
                    let newfactor = (timeElapsed-200)/(300*1.5);
                    user.graphicLocation[0] = (midpoint[0]*(1-newfactor) + receiver.location[0]*newfactor);
                    user.graphicLocation[1] = (midpoint[1]*(1-newfactor) + receiver.location[1]*newfactor);
                } else if(timeElapsed<800){
                    let factor = (timeElapsed-600)/1000;
                    user.graphicLocation[0] = (user.location[0]*factor+receiver.location[0])/(1+factor);
                    user.graphicLocation[1] = (user.location[1]*factor+receiver.location[1])/(1+factor);
                } else if(timeElapsed<1000){
                    let midfactor = 1/5;
                    let midpoint = [(user.location[0]*midfactor+receiver.location[0])/(1+midfactor),(user.location[1]*midfactor+receiver.location[1])/(1+midfactor)];
                    let newfactor = (timeElapsed-800)/(200*1.5);
                    user.graphicLocation[0] = (midpoint[0]*(1-newfactor) + user.location[0]*newfactor);
                    user.graphicLocation[1] = (midpoint[1]*(1-newfactor) + user.location[1]*newfactor);
                } else {
                    user.graphicLocation = [user.location[0],user.location[1]];
                    return "finished";
                }
    
                if(timeElapsed < 150){
                    user.src[0] = user.bitrate;
                } else if(timeElapsed < 425) {
                    user.src[0] = 0;
                } else if(timeElapsed < 575){
                    user.src[0] = user.bitrate;
                } else if(timeElapsed < 875){
                    user.src[0] = user.bitrate*2;
                } else {
                    user.src[0] = user.bitrate;
                }
                return "unfinished";
            }
    
            const initializeAnimation = function(animation,user,info){
                if(animation === "basic movement"){
                    if(user.hasOwnProperty("whichFoot")){
                        user.whichFoot = (user.whichFoot+1)%2;
                    } else {
                        user.whichFoot = 0;
                    }
                    user.animation = {
                        name: "basic movement",
                        startTime: timeStamp,
                        direction: info,
                    }
                }
            }
    
            // Handle dialogue
            if(dialogue !== null){
                // Handle dysymbolia cinematic
                if(dialogue.cinematic !== null && dialogue.cinematic.type === "dysymbolia"){
                    let timeElapsed = timeStamp-dialogue.cinematic.startTime;
                    if(timeElapsed < 2500){
                        blur = timeElapsed/500;
                    } else {
                        blur = 5;
                    }
                    // Handle phase 1
                    if(dialogue.cinematic.phaseNum === 1){
                        if(getTextInputStatus() === "entered"){
                            if(dialogue.cinematic.info[1].includes(globalInputData.textEntered)){
                                dialogue.cinematic.result = "pass";
                                if(dialogue.cinematic.info.length > 4){
                                    addTrial(srsData,playerKanjiData[dialogue.cinematic.info[4]],true);
                                }

                            } else {
                                dialogue.cinematic.result = "fail";
                                if(dialogue.cinematic.info.length > 4){
                                    addTrial(srsData,playerKanjiData[dialogue.cinematic.info[4]],false);
                                    if(dialogue.category === "abilityAcquisition"){
                                        dialogue.dysymboliaFailed = true;
                                    }
                                }
                            }
                            globalInputData.inputtingText = false;
                            dialogue.cinematic.phaseStartTime = timeStamp;
                            dialogue.cinematic.trialsLeft--;
                        }
                    }

                    // Handle phase 2 (wait for animation completion)
                    if(dialogue.cinematic.animationFinished && dialogue.cinematic.phaseNum < 3) {
                        // If animation finished, apply result, then start phase 3
                        dialogue.cinematic.phaseNum = 3;
                        dialogue.cinematic.phaseStartTime = timeStamp;
                        if(dialogue.cinematic.trialsLeft <= 0){
                            playerCombatData.power = Math.min(playerCombatData.powerSoftcap,playerCombatData.power+1);
                            globalPlayerStatisticData.totalPowerGained++;
                        }
                        if(dialogue.cinematic.result === "pass") {
                            // TODO: add option to not auto advance the cinematic state when the player passes by pressing a different key or something
                            // when the player passes, skip the story check phase
                            if(dialogue.cinematic.trialsLeft > 0 || dialogue.cinematic.specialTrialsLeft > 0){
                                advanceDialogueState();
                            }
                        } else {
                            // TODO: make taking damage a function that checks death and stuff lol
                            playerCombatData.hp -= 3;
                            globalPlayerStatisticData.totalDamageTaken += 3;
                            activeDamage = {
                                // If startFrame is positive, there is currently active damage.
                                startFrame: timeStamp,

                                // Duration of the current damage
                                duration: 1,

                                // How much the screen was shaken by
                                offset: [0,0],

                                // Last time the screen was shaken to not shake every single frame
                                timeOfLastShake: -1,
                            };
                        }
                    }

                    // Handle phase 4 (wait for animation completion)
                    else if(dialogue.cinematic.animationFinished && dialogue.cinematic.phaseNum === 4){
                        dialogue.cinematic.phaseNum = 5;
                        dialogue.cinematic.phaseStartTime = timeStamp;
                    }
                }
                // If there isnt a cinematic theres nothing to handle about the dialogue in update phase
            } else {
                // If not in an animation, handle movement
                if(playerWorldData.animation===null){
                    playerWorldData.src = [32,spritesheetOrientationPosition[globalInputData.currentDirection]*32];
    
                    if(globalInputData.currentDirection === "Down" && globalInputData.downPressed){
                        let collision = isCollidingOnTile(playerWorldData.location[0],playerWorldData.location[1],"Down");
                        if(collision===null){
                            playerWorldData.location[1]+=32;
                            initializeAnimation("basic movement",playerWorldData,globalInputData.currentDirection);
                            globalPlayerStatisticData.stepCount++;
                        } else if (collision === "bounds"){
                            for(const n of levels[globalWorldData.levelNum].neighbours){
                                if(n.dir === "s"){
                                    changeArea(n.levelIid);
                                    playerWorldData.location[1]=-32;
                                    break;
                                }
                            }
                        }
                    } else if(globalInputData.currentDirection === "Left" && globalInputData.leftPressed){
                        let collision = isCollidingOnTile(playerWorldData.location[0],playerWorldData.location[1],"Left");
                        if(collision===null){
                            playerWorldData.location[0]-=32;
                            initializeAnimation("basic movement",playerWorldData,globalInputData.currentDirection);
                            globalPlayerStatisticData.stepCount++;
                        } else if (collision === "bounds"){
                            for(const n of levels[globalWorldData.levelNum].neighbours){
                                if(n.dir === "w"){
                                    changeArea(n.levelIid);
                                    playerWorldData.location[0]=18*32;
                                    break;
                                }
                            }
                        }
                    } else if(globalInputData.currentDirection === "Right" && globalInputData.rightPressed){
                        let collision = isCollidingOnTile(playerWorldData.location[0],playerWorldData.location[1],"Right");
                        if(collision===null){
                            playerWorldData.location[0]+=32;
                            initializeAnimation("basic movement",playerWorldData,globalInputData.currentDirection);
                            globalPlayerStatisticData.stepCount++;
                        } else if (collision === "bounds"){
                            for(const n of levels[globalWorldData.levelNum].neighbours){
                                if(n.dir === "e"){
                                    changeArea(n.levelIid);
                                    playerWorldData.location[0]=-32;
                                    break;
                                }
                            }
                        }
                    } else if(globalInputData.currentDirection === "Up" && globalInputData.upPressed){
                        let collision = isCollidingOnTile(playerWorldData.location[0],playerWorldData.location[1],"Up");
                        if(collision===null){
                            playerWorldData.location[1]-=32;
                            initializeAnimation("basic movement",playerWorldData,globalInputData.currentDirection);
                            globalPlayerStatisticData.stepCount++;
                        } else if (collision === "bounds"){
                            for(const n of levels[globalWorldData.levelNum].neighbours){
                                if(n.dir === "n"){
                                    changeArea(n.levelIid);
                                    playerWorldData.location[1]=18*32;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
    
            // Handle combat action and combat animation
            if(combat !== null && combat.currentEnemyAction !== null){
                // Enemy attack animation
                let timeElapsed = (timeStamp - combat.currentEnemyAction.startTime);
                let enemy = combat.enemy;
    
                if(updateBasicAttackAnimation(enemy,playerWorldData,timeElapsed) === "finished"){
                    combat.currentEnemyAction = null;
                    if(!globalPlayerStatisticData.finishedDungeonScene){
                        dialogue = initializeDialogue("scenes","tutorial dungeon scene 2",timeStamp)
                        globalPlayerStatisticData.finishedDungeonScene=true;
                    }
                } else if(timeElapsed > 600 && !combat.enemyActionEffectApplied){
                    applyEnemyActionEffect();
                }
            } else if (combat !== null && combat.currentPlayerAction !== null){
                // Player attack animation
                let timeElapsed = (timeStamp - combat.currentPlayerAction.startTime);
                let enemy = combat.enemy;
    
                if(updateBasicAttackAnimation(playerWorldData, enemy, timeElapsed) === "finished"){
                    if(combat.status === "enemy defeated"){
                        for(let i = lev.entities.length-1;i<=0;i--){
                            if(lev.entities[i] == enemy){
                                lev.entities.splice(i,1);
                            }
                        }
    
                        combat = null;
                    } else {
                        combat.currentPlayerAction = null;
                        takeEnemyActions();
                    }
                } else if(timeElapsed > 600 && !combat.playerActionEffectApplied){
                    applyPlayerActionEffect();
                }
            }
    
            // Handle movement animation
            if(playerWorldData.animation && playerWorldData.animation.name === "basic movement"){
                updateMovementAnimation(playerWorldData,playerWorldData.animation);
            }
    
            // Handle input
            if(globalInputData.xClicked){
                globalInputData.xClicked = false;
            }
            if(globalInputData.zClicked){
                // Handle dialogue update on z press
                if(dialogue !== null){
                    advanceDialogueState();
                } else if(combat !== null && (combat.currentEnemyAction !== null || combat.currentPlayerAction !== null)){
                    // While an action is undergoing do not allow interaction
                    /*combat.currentPlayerAction = {
                        actionInfo: "basic attack",
                        startTime: timeStamp,
                    };
                    combat.playerActionEffectApplied = false;*/
                } else { // If no dialogue, check for object interaction via collision
                    let collision = isCollidingOnTile(playerWorldData.location[0],playerWorldData.location[1],globalInputData.currentDirection);
                    if(collision !== null && typeof collision === "object"){
                        let entity = lev.entities[collision.index];
                        if(entity.id === "Fruit_Tree" && (entity.hasBottomFruit || entity.hasLeftFruit || entity.hasRightFruit)){
                            if(globalPlayerStatisticData.finishedFruitScene){
                                dialogue = initializeDialogue("world","fruit_tree",timeStamp,collision.index);
                            } else {
                                dialogue = initializeDialogue("scenes","tutorial fruit scene",timeStamp,collision.index);
                                globalPlayerStatisticData.finishedFruitScene = true;
                                globalPlayerStatisticData.totalSceneDysymboliaExperienced++;
                            }
                        } else if (entity.id === "Stairs") {
                            if(entity.connectionId === "first" && !globalPlayerStatisticData.finishedDungeonScene){
                                dialogue = initializeDialogue("scenes","tutorial dungeon scene",timeStamp);
                            } else {
                                if(!combat || !combat.currentEnemyAction){
                                    changeArea(entity.areaDestination,entity.connectionId);
                                }
                            }
                        } else if(entity.type === "character"){
                            if(globalInputData.currentDirection === "Down"){
                                entity.src[1] = spritesheetOrientationPosition.Up * 32;
                            } else if (globalInputData.currentDirection === "Right"){
                                entity.src[1] = spritesheetOrientationPosition.Left * 32;
                            } else if (globalInputData.currentDirection === "Left"){
                                entity.src[1] = spritesheetOrientationPosition.Right * 32;
                            } else {
                                entity.src[1] = spritesheetOrientationPosition.Down * 32;
                            }
                            dialogue = initializeDialogue(entity.id.toLowerCase(),"initial",timeStamp,collision.index);
                        } else if(entity.type === "enemy") {
                            combat.currentPlayerAction = {
                                actionInfo: "basic attack",
                                startTime: timeStamp,
                                enemyEntityIndex: collision.index,
                            };
                            combat.playerActionEffectApplied = false;
                        }
                    } else if(collision === 1){
                        if(globalPlayerStatisticData.finishedWaterScene){
                            dialogue = initializeDialogue("world","water",timeStamp);
                        } else {
                            dialogue = initializeDialogue("scenes","tutorial water scene",timeStamp);
                            globalPlayerStatisticData.finishedWaterScene = true;
                            globalPlayerStatisticData.totalSceneDysymboliaExperienced++;
                        }
                    } else if(collision === 7){
                        if(globalPlayerStatisticData.finishedCloudScene){
                            dialogue = initializeDialogue("world","clouds",timeStamp);
                        } else {
                            dialogue = initializeDialogue("scenes","tutorial cloud scene",timeStamp);
                            globalPlayerStatisticData.finishedCloudScene = true;
                            globalPlayerStatisticData.totalSceneDysymboliaExperienced++;
                        }
                    } else if(collision === 8){
                        dialogue = initializeDialogue("world","sunflower",timeStamp);
                    } else if(collision !== null){
                        console.warn("unknown collision type");
                    }
                }
                globalInputData.zClicked = false;
            }
            if(globalInputData.upClicked){
                globalInputData.upClicked=false;
                if(dialogue){
                    let lineData = dialogue.lineInfo[dialogue.currentLine];
                    if(lineData && lineData.selectedResponse !== undefined){
                        lineData.selectedResponse--;
                        if(lineData.selectedResponse < 0){
                            lineData.selectedResponse = lineData.playerResponses.length-1;
                        }
                    }
                }
            }
            if(globalInputData.downClicked){
                globalInputData.downClicked=false;
                if(dialogue){
                    let lineData = dialogue.lineInfo[dialogue.currentLine];
                    if(lineData && lineData.selectedResponse !== undefined){
                        lineData.selectedResponse++;
                        if(lineData.selectedResponse > lineData.playerResponses.length-1){
                            lineData.selectedResponse=0;
                        }
                    }
                }
            }
    
        }; // Update world screen function ends here
    
        const updateMenuScreen = function(){
            if(menuScene === "Kanji List"){
                if(globalInputData.mouseDown && currentTooltip && tooltipBoxes[currentTooltip.index].type === "kanji list entry"){
                    menuData.selectedKanji = tooltipBoxes[currentTooltip.index].index;
                }
            } else if(menuScene === "Theory"){
                if(globalInputData.mouseDown && currentTooltip && !menuData.isReadingWriteup && menuData.selectedWriteup !== tooltipBoxes[currentTooltip.index].index && tooltipBoxes[currentTooltip.index].type === "write-up entry"){
                    menuData.selectedWriteup = tooltipBoxes[currentTooltip.index].index;
                    initializeMenuTab();
                }
            } else if(menuScene === "Abilities"){
                if(globalInputData.mouseDown && currentTooltip && menuData.selectedAbility !== tooltipBoxes[currentTooltip.index].index && tooltipBoxes[currentTooltip.index].type === "ability menu ability"){
                    menuData.selectedAbility = tooltipBoxes[currentTooltip.index].index;
                    initializeMenuTab();
                }
            }
            globalInputData.zClicked = globalInputData.xClicked = false;
        };
    
        if(menuScene !== null){
            updateMenuScreen();
        } else {
            updateWorldScreen();
        }
        if(globalInputData.doubleClicked){
            if(currentTooltip!== null){
                let tooltip = tooltipBoxes[currentTooltip.index];
                if(tooltip.type === "item"){
                    useItem(playerInventoryData,playerCombatData,playerConditions,tooltip.inventoryIndex,tooltip.x + tooltip.width/2,tooltip.y + tooltip.height/2);
                    updateInventory(playerInventoryData,"none",menuScene==="Inventory");
                }
            }
            globalInputData.doubleClicked = false;
        }
    }

    function drawGame(timeStamp){
        // world width and height
        let w = 18*TILE_SIZE;
        let h = 18*TILE_SIZE;
    
        // Apply damage shake
        if(activeDamage.startFrame > 0){
            let ad = activeDamage;
            let secondsLeft = ad.duration - (timeStamp - ad.startFrame)/1000;
            if(secondsLeft <= 0){
                activeDamage = {
                    startFrame: -1,
                    duration: 0,
                    offset: [0,0],
                    timeOfLastShake: -1
                };
            } else {
                if(timeStamp - ad.timeOfLastShake > 30){
                    // Randomize a new offset, -10 to 10 pixels per second
                    ad.offset = [(Math.random()-0.5)*20*secondsLeft,(Math.random()-0.5)*20*secondsLeft];
                    ad.timeOfLastShake = timeStamp;
                }
                context.save();
                context.translate(ad.offset[0],ad.offset[1]);
            }
        }
    
        // Set to false when the right part of the screen is to be used for something else
        let isToDrawStatusBar = true;
    
        const drawWorldScreen = function(){
            let lev = levels[globalWorldData.levelNum];
    
            let cameraCenterLocation;
            if(playerWorldData.animation && playerWorldData.animation.name === "basic movement"){
                cameraCenterLocation = playerWorldData.graphicLocation;
            } else {
                cameraCenterLocation = playerWorldData.location;
            }
    
            let camX;
            let camY;
    
            if(cameraCenterLocation[0] <= w/2) {
                camX = 0;
            } else if(cameraCenterLocation[0] >= lev.gridWidth*TILE_SIZE-(w/2)) {
                camX = lev.gridWidth*TILE_SIZE-w;
            } else {
                camX = cameraCenterLocation[0]-(w/2);
            }
    
            if(cameraCenterLocation[1] <= h/2) {
                camY = 0;
            } else if(cameraCenterLocation[1] >= lev.gridHeight*TILE_SIZE-(h/2)) {
                camY = lev.gridHeight*TILE_SIZE-h;
            } else {
                camY = cameraCenterLocation[1]-(h/2);
            }
            //camX = camX;
            //camY = camY;
    
            // Draw tile layers
    
            // Given absolute x and y of a tile, draw it relative to the camera, but only if it is visible
            const cameraTile = function(type, src, x, y){
                if(x-camX > -33 && x-camX < w && y-camY > -33 && y-camY < h){
                    drawTile(type, src, globalWorldData.worldX+x*globalWorldData.sizeMod-camX*globalWorldData.sizeMod, globalWorldData.worldY+y*globalWorldData.sizeMod-camY*globalWorldData.sizeMod,32,globalWorldData.sizeMod);
                }
            }
            const cameraCharacter = function(character, src, x, y){
                if(x-camX > -33 && x-camX < w && y-camY > -33 && y-camY < h){
                    drawCharacter(character, src, globalWorldData.worldX+x*globalWorldData.sizeMod-camX*globalWorldData.sizeMod, globalWorldData.worldY+y*globalWorldData.sizeMod-camY*globalWorldData.sizeMod,globalWorldData.sizeMod);
                }
            }
    
            let deferredRawTiles = [];
            let deferredTiles = [];
            for (let i=lev.tileLayers.length-1;i>=0;i--) {
                let layer = lev.tileLayers[i];
                if(layer.name === "Grass_Biome_Things_Tiles" || layer.name === "Bridge_Tiles"){
                    for (let t of layer.tiles){
                        if(tilesets.tilesetTileInfo[i].Front[t.t]){
                            deferredRawTiles.push({tilesetNum: i, tile: t});
                        } else {
                            cameraTile(i, t.src, t.px[0], t.px[1],camX,camY);
                        }
                    }
                } else if(layer.name === "Water_Tiles") {
                    for (let t of layer.tiles){
                        cameraTile(i, [32*Math.floor( (timeStamp/400) % 4),0], t.px[0], t.px[1],camX,camY);
                    }
                } else {
                    for (let t of layer.tiles){
                        cameraTile(i, t.src, t.px[0], t.px[1],camX,camY);
                    }
                }
            }
    
            context.font = '20px zenMaruMedium';
            context.fillStyle = 'black';
            let hours = Math.floor(globalWorldData.currentGameClock/60);
            let minutes = Math.floor(globalWorldData.currentGameClock%60);
            if(hours === 0){hours = 24;}
            if(hours>12){
                if(minutes<10){
                    context.fillText(`${hours-12}:0${minutes} PM`,globalWorldData.worldX+15, globalWorldData.worldY+30);
                } else {
                    context.fillText(`${hours-12}:${minutes} PM`,globalWorldData.worldX+15, globalWorldData.worldY+30);
                }
            } else {
                if(minutes<10){
                    context.fillText(`${hours}:0${minutes} AM`,globalWorldData.worldX+15, globalWorldData.worldY+30);
                } else {
                    context.fillText(`${hours}:${minutes} AM`,globalWorldData.worldX+15, globalWorldData.worldY+30);
                }
            }
    
            // Requires the tileset "Grassy_Biome_Things" and draws a fruit tree given the data stored in the entity about it's fruit
            // Returns array of tiles to defer
            function drawFruitTree(tree,tilesetNum,x,y){
                let bitrate = 32;
                let deferredTiles = [];
                if(tree.hasLeftFruit){
                    deferredTiles.push({
                        tilesetNum: tilesetNum,
                        tile: {
                            src: [bitrate*3,0],
                            px: [x,y]
                        }
                    });
                } else {
                    deferredTiles.push({
                        tilesetNum: tilesetNum,
                        tile: {
                            src: [bitrate*1,0],
                            px: [x,y]
                        },
                        raw: false,
                    });
                }
                if(tree.hasRightFruit){
                    deferredTiles.push({
                        tilesetNum: tilesetNum,
                        tile: {
                            src: [bitrate*4,0],
                            px: [x+bitrate,y]
                        },
                        raw: false,
                    });
                } else {
                    deferredTiles.push({
                        tilesetNum: tilesetNum,
                        tile: {
                            src: [bitrate*2,0],
                            px: [x+bitrate,y]
                        },
                        raw: false,
                    });
                }
                if(tree.hasBottomFruit){
                    cameraTile(tilesetNum,[bitrate*3,bitrate],x,y+bitrate,camX,camY);
                    cameraTile(tilesetNum,[bitrate*4,bitrate],x+bitrate,y+bitrate,camX,camY);
                } else {
                    cameraTile(tilesetNum,[bitrate*1,bitrate],x,y+bitrate,camX,camY);
                    cameraTile(tilesetNum,[bitrate*2,bitrate],x+bitrate,y+bitrate,camX,camY);
                }
                return deferredTiles;
            }
            // Requires the tileset "Grassy_Biome_Things" and draws a berry bush given the data stored in the entity about it's berries
            function drawBerryBush(bush,tilesetNum,x,y){
                let bitrate = 32;
                if(bush.hasBerries){
                    cameraTile(tilesetNum,[0,bitrate*3],x,y,camX,camY);
                } else {
                    cameraTile(tilesetNum,[bitrate,bitrate*3],x,y,camX,camY);
                }
            }
    
            if(combat && combat.currentPlayerAction){
    
            } else {
                cameraCharacter("witch",playerWorldData.src,playerWorldData.graphicLocation[0],playerWorldData.graphicLocation[1],camX,camY);
            }
    
            for (let i in lev.entities){
                const e = lev.entities[i];
                if(e.visible){
                    if(e.type === "character"){
                        cameraCharacter(e.id.toLowerCase(),e.src,e.graphicLocation[0]*globalWorldData.sizeMod,e.graphicLocation[1],camX,camY);
                    } else if(e.type === "location"){
                        // do nothing
                    } else if(e.id === "Stairs"){
                        cameraTile(e.tilesetIndex, e.src, e.location[0], e.location[1],camX,camY);
                    } else if(e.id === "Fruit_Tree"){
                        deferredTiles.push(...drawFruitTree(e,0,e.graphicLocation[0],e.graphicLocation[1]));
                    } else if(e.id === "Berry_Bush"){
                        drawBerryBush(e,0,e.graphicLocation[0],e.graphicLocation[1]);
                    } else if(e.type === "enemy"){
                        cameraCharacter(e.id.toLowerCase(),e.src,e.graphicLocation[0],e.graphicLocation[1],48,camX,camY);
                    }
                }
            }
    
            if(combat && combat.currentPlayerAction){
                cameraCharacter("witch",playerWorldData.src,playerWorldData.graphicLocation[0],playerWorldData.graphicLocation[1],camX,camY);
            }
    
            // Draw foreground elements
            for (const dt of deferredRawTiles){
                cameraTile(dt.tilesetNum, dt.tile.src, dt.tile.px[0], dt.tile.px[1],camX,camY);
            }
            for (const dt of deferredTiles){
                cameraTile(dt.tilesetNum, dt.tile.src, dt.tile.px[0], dt.tile.px[1],camX,camY);
            }
    
            // Apply time of day brightness effect
            if(lev.lightSource === "sun"){
                let maximumDarkness = 0.4
                if(hours >= 19 || hours < 5){
                    context.fillStyle = `hsla(0, 0%, 0%, ${maximumDarkness})`;
                } else if(hours >= 7 && hours < 17){
                    context.fillStyle = `hsla(0, 0%, 0%, 0)`;
                } else if(hours < 7){
                    // Sunrise. Starts at 5 AM (game clock 300) finishes at 7 AM (game clock 420)
                    let phase = 0.5 + (globalWorldData.currentGameClock-300)/120
                    let a = ((maximumDarkness/2) * Math.sin(Math.PI*phase))+maximumDarkness/2;
                    context.fillStyle = `hsla(0, 0%, 0%, ${a})`;
                } else if(hours >= 17){
                    // Sunrise. Starts at 5 PM (game clock 1020) finishes at 7 PM (game clock 1140)
                    let phase = 1.5 + (globalWorldData.currentGameClock-300)/120
                    let a = ((maximumDarkness/2) * Math.sin(Math.PI*phase))+maximumDarkness/2;
                    context.fillStyle = `hsla(0, 0%, 0%, ${a})`;
                }
                context.fillRect(globalWorldData.worldX, globalWorldData.worldY, w*globalWorldData.sizeMod, h*globalWorldData.sizeMod);
            }
    
            let applyBlur = function(){
                if (blur > 0) {
                    context.filter = `blur(${blur}px)`;
                    // The canvas can draw itself lol
                    context.drawImage(canvas,
                        globalWorldData.worldX, globalWorldData.worldY, globalWorldData.worldX+18*16*2*globalWorldData.sizeMod, globalWorldData.worldY+18*16*2*globalWorldData.sizeMod,
                        globalWorldData.worldX, globalWorldData.worldY, globalWorldData.worldX+18*16*2*globalWorldData.sizeMod, globalWorldData.worldY+18*16*2*globalWorldData.sizeMod,
                     );
                    context.filter = "none";
                }
            }
    
            // Draw dialogue
            if(dialogue !== null){
    
                context.fillStyle = 'hsl(0, 100%, 0%, 70%)';
                context.save();
                context.shadowColor = "hsl(0, 15%, 0%, 70%)";
                context.shadowBlur = 15;
                context.beginPath();
                context.roundRect(globalWorldData.worldX, globalWorldData.worldY+(h*globalWorldData.sizeMod)-96*globalWorldData.sizeMod, w*globalWorldData.sizeMod, globalWorldData.sizeMod*96);
                context.fill();
                context.restore();
    
                const faceCharacter = dialogue.lineInfo[dialogue.currentLine].face;
                const faceNum = dialogue.lineInfo[dialogue.currentLine].faceNum;
    
                context.fillStyle = textColor;
                let dialogueFontSize = Math.floor(16*globalWorldData.sizeMod);
                context.font = `${dialogueFontSize}px zenMaruRegular`;
    
                if(dialogue.cinematic !== null){
                    if(dialogue.cinematic.type === "dysymbolia" && dialogue.cinematic.phaseNum > 0 && dialogue.cinematic.phaseNum < 3){
                        // draw shaded circle pre-blur
                        context.fillStyle = 'hsl(0, 100%, 0%, 20%)';
                        context.beginPath();
                        context.arc(globalWorldData.worldX + w*globalWorldData.sizeMod/2, globalWorldData.worldY + h*globalWorldData.sizeMod/2 - 10, 160, 0, 2 * Math.PI);
                        context.fill();
                    }
                }
    
                context.fillStyle = textColor;
    
                // Draw differently depending on player vs non-player vs no image
                const drawDialogueForPlayer = function(facesImage){
                    context.drawImage(facesImage, (faceNum%4)*faceBitrate, Math.floor(faceNum/4)*faceBitrate, faceBitrate, faceBitrate, globalWorldData.worldX, globalWorldData.worldY+(h*globalWorldData.sizeMod)-96*globalWorldData.sizeMod, 96*globalWorldData.sizeMod, 96*globalWorldData.sizeMod);
                    applyBlur();
    
                    if(dialogue.cinematic !== null && dialogue.cinematic.type === "dysymbolia" && dialogue.cinematic.trialsLeft < 1 && dialogue.cinematic.phaseNum === 3 && !dialogue.cinematic.tooltipsRegistered){
                        if(dialogue.cinematic.info.length > 4){
                            // TODO: figure out a way to refactor so this step isnt needed i swear
                            let tooltipTargets = [];
                            for(let i=0;i<dialogue.cinematic.trialedKanjiIndexes.length;i++){
                                tooltipTargets.push(adventureKanjiFileData[dialogue.cinematic.trialedKanjiIndexes[i]].symbol);
                            }
                            drawDialogueText(dialogue,(96+18)*globalWorldData.sizeMod+globalWorldData.worldX, (globalWorldData.worldY+h*globalWorldData.sizeMod-72*globalWorldData.sizeMod),(w*globalWorldData.sizeMod-124*globalWorldData.sizeMod),20*globalWorldData.sizeMod,timeStamp,
                                {
                                    width: dialogueFontSize, height: 20*globalWorldData.sizeMod,
                                    type: "kanji", indexes: dialogue.cinematic.trialedKanjiIndexes,
                                    tooltipTargets: tooltipTargets,
                                }
                            );
                            note = "Hover your mouse over the kanji to review.";
                        } else {
                            drawDialogueText(dialogue,(96+18)*globalWorldData.sizeMod+globalWorldData.worldX, (globalWorldData.worldY+h*globalWorldData.sizeMod-72*globalWorldData.sizeMod),(w*globalWorldData.sizeMod-124*globalWorldData.sizeMod),20*globalWorldData.sizeMod,timeStamp,
                                {
                                    width: dialogueFontSize, height: 20*globalWorldData.sizeMod,
                                    type: "dictionary", indexes: [null],
                                    tooltipTargets: [dialogue.cinematic.info[3]],
                                }
                            );
                            note = "Hover your mouse over the Japanese text for more info.";
                        }
    
                        dialogue.cinematic.tooltipsRegistered = true;
                    } else if(dialogue.cinematic !== null && dialogue.cinematic.type === "dysymbolia" && dialogue.cinematic.phaseNum === 5 && dialogue.cinematic.animationFinished && !dialogue.cinematic.tooltipsRegistered){
                        let playerAbilityInfo = playerAbilityData.list[playerAbilityData.acquiringAbility];
                        let abilityInfo = abilityFileData[playerAbilityInfo.index];
                        drawDialogueText(dialogue,(96+18)*globalWorldData.sizeMod+globalWorldData.worldX, (globalWorldData.worldY+h*globalWorldData.sizeMod-72*globalWorldData.sizeMod),(w*globalWorldData.sizeMod-124*globalWorldData.sizeMod),20*globalWorldData.sizeMod,timeStamp,
                                {
                                    width: dialogueFontSize, height: 20*globalWorldData.sizeMod,
                                    type: "dictionary", indexes: [null],
                                    //tooltipTargets: abilityInfo.jpNameWords,
                                },
                                abilityInfo.jpNameWithSeperators
                            );
                        dialogue.cinematic.tooltipsRegistered = true;
                        note = "Hover your mouse over the Japanese text, also this is a wip no judge...";
                    } else {
                        drawDialogueText(dialogue,(96+18)*globalWorldData.sizeMod+globalWorldData.worldX, (globalWorldData.worldY+h*globalWorldData.sizeMod-72*globalWorldData.sizeMod),(w*globalWorldData.sizeMod-124*globalWorldData.sizeMod),20*globalWorldData.sizeMod,timeStamp);
                    }
                };
                const drawDialogueForNonPlayer = function(facesImage){
                    context.save();
                    context.scale(-1,1);
                    context.drawImage(facesImage, (faceNum%4)*faceBitrate, Math.floor(faceNum/4)*faceBitrate, faceBitrate, faceBitrate, -1*(globalWorldData.worldX+w*globalWorldData.sizeMod), globalWorldData.worldY+h*globalWorldData.sizeMod-96*globalWorldData.sizeMod, 96*globalWorldData.sizeMod, 96*globalWorldData.sizeMod);
                    context.restore();
                    applyBlur();
                    drawDialogueText(dialogue,(8+18)*globalWorldData.sizeMod+globalWorldData.worldX,globalWorldData.worldY+h*globalWorldData.sizeMod-72*globalWorldData.sizeMod,w*globalWorldData.sizeMod-144*globalWorldData.sizeMod,20*globalWorldData.sizeMod,timeStamp);
                };
                const drawDialogueForNobody = function(){
                    applyBlur();
                    drawDialogueText(dialogue,(8+18)*globalWorldData.sizeMod+globalWorldData.worldX,globalWorldData.worldY+h*globalWorldData.sizeMod-72*globalWorldData.sizeMod,w*globalWorldData.sizeMod-40*globalWorldData.sizeMod,20*globalWorldData.sizeMod,timeStamp);
                };
                context.imageSmoothingEnabled = true;
                if(faceCharacter==="Gladius"){
                    drawDialogueForNonPlayer(characterFaces.gladius);
                } else if (faceCharacter==="Andro"){
                    drawDialogueForNonPlayer(characterFaces.andro);
                } else if (faceCharacter==="player"){
                    drawDialogueForPlayer(characterFaces.witch);
                } else {
                    drawDialogueForNobody();
                }
                context.imageSmoothingEnabled = false;
    
                const playerResponses = dialogue.lineInfo[dialogue.currentLine].playerResponses;
                if(playerResponses !== undefined){
                    context.fillStyle = 'hsl(0, 100%, 0%, 70%)';
                    context.save();
                    context.shadowColor = "hsl(0, 15%, 0%, 70%)";
                    context.shadowBlur = 15;
                    context.beginPath();
                    context.roundRect(globalWorldData.worldX+w*globalWorldData.sizeMod*0.4, globalWorldData.worldY+(h*globalWorldData.sizeMod)-96*globalWorldData.sizeMod*1.8, w*globalWorldData.sizeMod*0.57, globalWorldData.sizeMod*65, 15);
                    context.fill();
                    context.restore();
    
                    context.fillStyle = textColor;
                    for(let i=0;i<playerResponses.length;i++) {
                        let text = playerResponses[i];
                        if(dialogue.lineInfo[dialogue.currentLine].selectedResponse === i){
                            text = "> " + text;
                        }
                        context.fillText(text, globalWorldData.worldX+w*globalWorldData.sizeMod*0.45,globalWorldData.worldY+(h*globalWorldData.sizeMod)-96*globalWorldData.sizeMod*1.52 + 20*globalWorldData.sizeMod*i);
                    };
                }
    
                // Draw post blur cinematic elements
                if(dialogue.cinematic !== null && dialogue.cinematic.type === "dysymbolia" && dialogue.cinematic.phaseNum > 0){
                    let c = dialogue.cinematic;
                    if(c.result === null){
                        // Draw dysymbolia input elements
                        context.fillStyle = 'hsl(0, 100%, 100%, 80%)';
                        context.font = `${Math.floor(20*globalWorldData.sizeMod)}px zenMaruRegular`;
                        context.textAlign = 'center';
                        context.fillText("Enter keyword:", globalWorldData.worldX + w*globalWorldData.sizeMod/2, globalWorldData.worldY + (h-100)*globalWorldData.sizeMod/2);
    
                        context.fillStyle = "white";
                        context.fillText(globalInputData.textEntered, globalWorldData.worldX + w*globalWorldData.sizeMod/2, globalWorldData.worldY + h*globalWorldData.sizeMod/2);
    
                        context.font = `${Math.floor(20*globalWorldData.sizeMod)}px Arial`;
                        context.fillStyle = "white";
                        context.fillText(c.info[0], globalWorldData.worldX + w*globalWorldData.sizeMod/2, globalWorldData.worldY + (h+100)*globalWorldData.sizeMod/2);
                    } else if (c.phaseNum < 3){
    
                        /******* It is currently phase 2, so handle and draw the animation********/
    
                        context.fillStyle = 'hsl(0, 100%, 100%, 80%)';
                        context.font = `${Math.floor(20*globalWorldData.sizeMod)}px zenMaruRegular`;
                        context.textAlign = 'center';
                        context.fillText("Enter keyword:", globalWorldData.worldX + w*globalWorldData.sizeMod/2, globalWorldData.worldY + (h-100)*globalWorldData.sizeMod/2);
    
                        // Play the animation for dysymbolia text colliding
                        let animationDuration = 300 + 1200 * (!globalWorldData.speedMode);
                        let animationProgress = (timeStamp - c.phaseStartTime)/animationDuration;
                        if (animationProgress >= 1){
                            if(c.result === "pass"){
                                // Green particle system
                                particleSystems.push(createParticleSystem({hue:120,saturation:100,lightness:50,x:globalWorldData.worldX + w*globalWorldData.sizeMod/2, y:globalWorldData.worldY +h*globalWorldData.sizeMod/2, temporary:true, particlesLeft:25, particlesPerSec: 150,particleSpeed: 200, particleAcceleration: -100, particleLifespan: 2000}));
                            } else {
                                // Red particle system
                                particleSystems.push(createParticleSystem({hue:0,saturation:100,lightness:50,x:globalWorldData.worldX + w*globalWorldData.sizeMod/2, y:globalWorldData.worldY +h*globalWorldData.sizeMod/2, temporary:true, particlesLeft:25, particlesPerSec: 150, particleSpeed: 200, particleAcceleration: -100, particleLifespan: 2000}));
                            }
                            c.animationFinished = true;
                        } else if (c.result === "pass") {
                            context.fillStyle = "white";
                            let inputTextWidth = context.measureText(globalInputData.textEntered).width;
                            let xMod = Math.sin((Math.PI/2)*Math.max(1 - animationProgress*2,0.1));
                            let currentX = globalWorldData.worldX + w*globalWorldData.sizeMod/2 - (inputTextWidth/2)*xMod;
                            let yMod = Math.sin((Math.PI/2)*Math.min(2 - animationProgress*2,1));
                            if(xMod === Math.sin((Math.PI/2)*0.1)){
                                // Instead of drawing the input string, draw it as the kanji
                                context.fillText(c.info[0], globalWorldData.worldX + w*globalWorldData.sizeMod/2, globalWorldData.worldY + (h+50 - 50*yMod)*globalWorldData.sizeMod/2);
                            } else {
                                // Draw it the same way as the fail animation
                                for(let i=0;i<globalInputData.textEntered.length;i+=1){
                                    let charWidth = context.measureText(globalInputData.textEntered[i]).width;
                                    context.fillText(globalInputData.textEntered[i], currentX + xMod*charWidth/2, globalWorldData.worldY + (h+50 - 50*yMod)*globalWorldData.sizeMod/2);
                                    currentX += charWidth * xMod;
                                }
                            }
    
                            context.font = `${Math.floor(20*globalWorldData.sizeMod)}px Arial`;
                            context.fillText(c.info[0], globalWorldData.worldX + w*globalWorldData.sizeMod/2, globalWorldData.worldY + (h+50 + 50*yMod)*globalWorldData.sizeMod/2);
                        } else {
                            // Play the fail animation
                            context.fillStyle = "white";
                            let inputTextWidth = context.measureText(globalInputData.textEntered).width;
                            let xMod = Math.sin(Math.PI/2*Math.max(1 - animationProgress*2,0.1));
                            let currentX = globalWorldData.worldX + w*globalWorldData.sizeMod/2 - (inputTextWidth/2)*xMod;
                            let yMod = Math.sin(Math.PI/2*Math.min(2 - animationProgress*2,1));
                            for(let i=0;i<globalInputData.textEntered.length;i+=1){
                                let charWidth = context.measureText(globalInputData.textEntered[i]).width;
                                context.fillText(globalInputData.textEntered[i], currentX + xMod*charWidth/2, globalWorldData.worldY + (h+50 - 50*yMod)*globalWorldData.sizeMod/2);
                                currentX += charWidth * xMod;
                            }
                            context.font = `${Math.floor(20*globalWorldData.sizeMod)}px Arial`;
                            context.fillText(c.info[0], globalWorldData.worldX + w*globalWorldData.sizeMod/2, globalWorldData.worldY + (h+50 + 50*yMod)*globalWorldData.sizeMod/2);
                        }
                    } else if(c.phaseNum < 4 && c.info.length > 4) {
                        /*** It is currently phase 3, so display the story associated with the current kanji ***/
                        let kanjiInfo = adventureKanjiFileData[c.info[4]];
    
                        // Background box
                        context.fillStyle = 'hsl(0, 0%, 10%, 55%)';
                        context.save();
                        context.shadowColor = "hsl(0, 30%, 0%)";
                        context.shadowBlur = 15;
                        context.beginPath();
                        context.roundRect(globalWorldData.worldX+globalWorldData.sizeMod*10, globalWorldData.worldY+globalWorldData.sizeMod*10, (w-20)*globalWorldData.sizeMod, h*globalWorldData.sizeMod*0.25, 30);
                        context.fill();
                        context.restore();
    
                        // Text
                        context.font = `${60*globalWorldData.sizeMod}px Arial`;
                        context.textAlign = 'center';
                        context.fillStyle = 'white';
                        context.fillText(c.info[0], globalWorldData.worldX+globalWorldData.sizeMod*85, globalWorldData.worldY+globalWorldData.sizeMod*80);
    
                        context.font = `${24*globalWorldData.sizeMod}px zenMaruMedium`;
                        context.fillText(kanjiInfo.keyword, globalWorldData.worldX+globalWorldData.sizeMod*85, globalWorldData.worldY+globalWorldData.sizeMod*120);
    
                        context.textAlign = 'left';
                        context.font = `${14*globalWorldData.sizeMod}px zenMaruRegular`;
                        let wrappedText = wrapText(context, kanjiInfo.story, globalWorldData.worldY+globalWorldData.sizeMod*50, w-globalWorldData.sizeMod*160, 16*globalWorldData.sizeMod+1);
                        wrappedText.forEach(function(item) {
                            // item[0] is the text
                            // item[1] is the y coordinate to fill the text at
                            context.fillText(item[0], globalWorldData.worldX+globalWorldData.sizeMod*180, item[1]);
                        });
    
                        // Divider bar
                        context.fillStyle = 'hsl(0, 100%, 100%, 60%)';
                        context.fillRect(globalWorldData.worldX+globalWorldData.sizeMod*160, globalWorldData.worldY+globalWorldData.sizeMod*30, 2, h*globalWorldData.sizeMod*0.25 - globalWorldData.sizeMod*40);
                    } else if(c.phaseNum === 4){
                        /*** It is currently phase 4, so handle and draw the ability acqusition animation ***/
                        context.fillStyle = 'hsl(0, 100%, 100%, 80%)';
                        context.font = `${Math.floor(20*globalWorldData.sizeMod)}px zenMaruRegular`;
                        context.textAlign = 'center';
    
                        let animationDuration = 2000;
                        let animationProgress = (timeStamp - c.phaseStartTime)/animationDuration;
                        
                        let text = ""
                        let xMod = 0;

                        context.fillStyle = "white";

                        if (animationProgress >= 1){
                            particleSystems.push(createParticleSystem({hue:120,saturation:100,lightness:50,x:globalWorldData.worldX + w*globalWorldData.sizeMod/2, y:globalWorldData.worldY +h*globalWorldData.sizeMod/2, temporary:true, particlesLeft:25, particlesPerSec: 150,particleSpeed: 200, particleAcceleration: -100, particleLifespan: 2000}));
                            particleSystems.push(createParticleSystem({hue:0,saturation:100,lightness:50,x:globalWorldData.worldX + w*globalWorldData.sizeMod/2, y:globalWorldData.worldY +h*globalWorldData.sizeMod/2, temporary:true, particlesLeft:25, particlesPerSec: 150, particleSpeed: 200, particleAcceleration: -100, particleLifespan: 2000}));
                            
                            dialogue.textLines[dialogue.currentLine] = playerAbilityData.list[playerAbilityData.acquiringAbility].jpName;
                            c.animationFinished = true;
                        } else if(animationProgress>0.5){
                            xMod = Math.sin((Math.PI/2)*Math.max(animationProgress*2 - 1,0.1));
                            text = playerAbilityData.list[playerAbilityData.acquiringAbility].jpName;
                        } else {
                            xMod = Math.sin((Math.PI/2)*Math.max(1 - animationProgress*2,0.1));
                            text = dialogue.scenario;
                        }
                        
                        let textWidth = context.measureText(text).width;
                        let currentX = globalWorldData.worldX + w*globalWorldData.sizeMod/2 - (textWidth/2)*xMod;

                        for(let i=0;i<text.length;i++){
                            let charWidth = context.measureText(text[i]).width;
                            context.fillText(text[i], currentX + xMod*charWidth/2, globalWorldData.worldY + (h+50)*globalWorldData.sizeMod/2);
                            currentX += charWidth * xMod;
                        }                   
                    }
                } 
            }
    
            // Cover up the sides of the world
            context.beginPath();
            context.strokeStyle = bgColor;
            let lineWidth = 500;
            context.lineWidth = lineWidth;
            context.rect(globalWorldData.worldX-lineWidth/2, globalWorldData.worldY-lineWidth/2, w*globalWorldData.sizeMod+lineWidth, h*globalWorldData.sizeMod+lineWidth);
            context.stroke();
    
            context.font = '16px zenMaruRegular';
            context.fillStyle = textColor;
            context.textAlign = "left";
            context.fillText("Press Z to interact/continue dialogue",globalWorldData.worldX+100, globalWorldData.worldY+40+h*globalWorldData.sizeMod);
    
            if(note !== "無"){
                context.fillStyle = "hsla(61, 100%, 80%, 1)";
                context.font = '20px zenMaruRegular';
                context.fillText(note,globalWorldData.worldX+300, globalWorldData.worldY+70+h*globalWorldData.sizeMod);
            }
        }; // Draw world screen function ends here
    
        const drawMenuScreen = function(){
            // Background box
            context.fillStyle = 'hsl(0, 100%, 0%, 55%)';
            context.beginPath();
            context.roundRect(globalWorldData.worldX, globalWorldData.worldY, w*globalWorldData.sizeMod, h*globalWorldData.sizeMod, 30);
            context.fill();
    
            // Divider bar
            context.fillStyle = 'hsl(0, 100%, 100%, 40%)';
            context.fillRect(globalWorldData.worldX+200, globalWorldData.worldY+65, 2, w*globalWorldData.sizeMod - 140);
    
            // Tab title
            context.fillStyle = 'hsl(0, 100%, 100%, 40%)';
            context.fillRect(globalWorldData.worldX+375, globalWorldData.worldY+105, 240, 2);
    
            context.font = '36px zenMaruRegular';
            context.textAlign = 'center';
            context.fillStyle = 'white';
            context.fillText(menuScene, globalWorldData.worldX+345 + 150, globalWorldData.worldY+80);
    
            // Each menu tab has its local function
            const drawInventoryScreen = function(){
                context.font = '18px zenMaruRegular';
                context.fillText("First 5 items can be used on the inventory hotbar!", globalWorldData.worldX+345 + 150, globalWorldData.worldY+580);
                context.fillText("Double click to use consumables!", globalWorldData.worldX+345 + 150, globalWorldData.worldY+630);
                context.fillText("Crafting coming soon?!????!??!!?", globalWorldData.worldX+345 + 150, globalWorldData.worldY+680);
  
                for(let i=0;i<Math.ceil(playerInventoryData.inventory.length/5);i++){
                    for(let j=0;j<5;j++){
                        context.lineWidth = 2;
                        context.strokeStyle = 'hsla(270, 60%, 75%, 0.6)';
                        context.fillStyle = 'black';
                        context.beginPath();
                        context.roundRect(globalWorldData.worldY+285+105+67*j, globalWorldData.worldY+160 + 67*i, 60, 60, 3);
                        context.fill();
                        context.stroke();
    
                        if(playerInventoryData.inventory[j + i*5] !== "none"){
                            context.save();
                            context.translate(globalWorldData.worldY+285+105+67*j,globalWorldData.worldY+160 + 67*i);
                            context.scale(1.4,1.4);
                            drawItemIcon(playerInventoryData.inventory[j + i*5],-1,-1);
                            context.restore();
                        }
                    }
                }
    
                if(draggingObject){
                    let offsetX = globalInputData.mouseX - draggingObject[2], offsetY = globalInputData.mouseY - draggingObject[3];
    
                    context.save();
                    context.translate(draggingObject[0]+offsetX,draggingObject[1]+offsetY);
                    context.scale(1.4,1.4);
                    drawItemIcon(draggingObject[4],-1,-1);
                    context.restore();
                }
            } // Draw inventory screen function ends here
    
            const drawKanjiScreen = function(){
                context.font = '26px Arial';
                context.textAlign = 'left';
                context.fillStyle = 'white';
    
                let rowAmount = 12;
                for(let i=0;i<Math.ceil(adventureKanjiFileData.length/rowAmount);i++){
                    for(let j=0; j<Math.min(rowAmount,adventureKanjiFileData.length-i*rowAmount);j++){
                        let currentIndex = j + i*rowAmount;
                        let kanjiInfo = playerKanjiData[currentIndex];
                        let masteryStageColors = [
                            'hsla(20, 40%, 50%, 1)',
                            'hsla(120, 40%, 50%, 1)',
                            'hsla(280, 40%, 50%, 1)',
                            'hsla(230, 40%, 50%, 1)',
                            'hsla(355, 60%, 50%, 1)',
                            'hsla(60, 75%, 65%, 1)',
                        ]
    
                        context.lineWidth = 2;
                        let textFill = 'white';
                        // Change colors based on the kanji info
                        if(menuData.selectedKanji === currentIndex){
                            context.strokeStyle = 'hsla(60, 100%, 75%, 1)';
                            if(!playerKanjiData[currentIndex].enabled){
                                textFill = 'hsla(0, 0%, 60%, 1)';
                            }
                        } else if(kanjiInfo.enabled){
                            context.strokeStyle = masteryStageColors[kanjiInfo.masteryStage];
                        } else {
                            context.strokeStyle = 'hsla(0, 0%, 60%, 1)';
                            textFill = 'hsla(0, 0%, 60%, 1)';
                        }
    
                        context.fillStyle = 'black';
                        context.beginPath();
                        context.roundRect(globalWorldData.worldX+240+45*j, globalWorldData.worldY+140 + 45*i, 40, 40, 3);
                        context.fill();
                        context.stroke();
    
                        context.fillStyle = textFill;
                        context.fillText(adventureKanjiFileData[currentIndex].symbol,globalWorldData.worldX+240+45*j + 6,globalWorldData.worldY+140 + 45*i + 30)
                    }
                }
    
                // Draw kanji info on side of screen
                if(menuData.selectedKanji !== null){
                    isToDrawStatusBar = false;
    
                    let kanjiInfo = adventureKanjiFileData[menuData.selectedKanji];
                    let playerKanjiInfo = playerKanjiData[menuData.selectedKanji];
    
                    context.fillStyle = 'hsl(0, 0%, 10%, 55%)';
                    context.save();
                    context.shadowColor = "hsl(0, 30%, 0%)";
                    context.shadowBlur = 15;
                    context.beginPath();
                    context.roundRect(globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30, globalWorldData.worldY, 305, 805, 30);
                    context.fill();
                    context.restore();
    
                    context.font = '120px Arial';
                    context.textAlign = 'center';
                    context.fillStyle = 'white';
                    context.fillText(kanjiInfo.symbol, globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, globalWorldData.worldY+140);
    
                    context.font = '32px zenMaruMedium';
                    context.fillText(kanjiInfo.keyword, globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, globalWorldData.worldY+210);
    
                    context.font = '18px zenMaruRegular';
                    context.textAlign = 'left';
                    let bodyText = kanjiInfo.story;
                    let wrappedText = wrapText(context, bodyText, globalWorldData.worldY+250, 240, 19);
                    wrappedText.forEach(function(item) {
                        // item[0] is the text
                        // item[1] is the y coordinate to fill the text at
                        context.fillText(item[0], globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 35, item[1]);
                    });
    
                    let belowStoryY = globalWorldData.worldY+250 + wrappedText.length*19;
    
                    context.font = '16px zenMaruRegular';
                    context.textAlign = 'center';
                    context.fillText("Successfully captured "+playerKanjiInfo.trialSuccesses+ " times.", globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, belowStoryY+45);
                    context.fillText("Mastery stage "+playerKanjiInfo.masteryStage, globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, belowStoryY+70);
                    if(playerKanjiInfo.daysUntilMasteryIncreaseOpportunity > 0){
                        context.font = '16px zenMaruRegular';
                        context.fillText("Increase mastery in " + playerKanjiInfo.daysUntilMasteryIncreaseOpportunity + " days", globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, belowStoryY+95);
                    } else {
                        context.font = '16px zenMaruBold';
                        context.fillText("Capture to increase mastery!", globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, belowStoryY+95);
                    }
    
    
                    if(!playerKanjiInfo.enabled){
                        context.textAlign = 'center';
                        context.font = '22px zenMaruBlack';
                        context.fillText("Disabled", globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, globalWorldData.worldY+660);
                    }
                }
    
                context.font = '22px zenMaruRegular';
                context.textAlign = 'center';
                context.fillStyle = 'white';
                context.fillText("Total mastery level "+globalPlayerStatisticData.totalKanjiMastery, globalWorldData.worldX+340 + 150, globalWorldData.worldY+h*globalWorldData.sizeMod-30);
            } // Draw kanji screen function ends here
    
            const drawTheoryScreen = function(){
                context.font = '20px ZenMaruRegular';
                context.textAlign = 'left';
    
                if(!menuData.isReadingWriteup){
                    for(let i=0;i<theoryWriteupData.length;i++){
                        let theory = theoryWriteupData[i];
    
                        if(menuData.selectedWriteup === i){
                            context.strokeStyle = 'hsla(60, 100%, 75%, 1)';
                        } else {
                            if(playerTheoryData[i].unlocked){
                                context.strokeStyle = 'hsla(300, 75%, 75%, 1)';
                            } else {
                                context.strokeStyle = 'hsla(0, 0%, 60%, 1)';
                            }
    
                        }
                        context.lineWidth = 2;
                        //context.fillStyle = 'hsla(0, 0%, 30%, 1)';
                        context.fillStyle = 'black';
                        context.beginPath();
                        context.roundRect(globalWorldData.worldX+240, globalWorldData.worldY+140 + 45*i, w-55, 40, 5);
                        context.fill();
                        context.stroke();
    
                        context.fillStyle = 'white';
                        context.fillText(theory.title,globalWorldData.worldX+240 + 15,globalWorldData.worldY+140 + 45*i + 27);
    
                        if(!playerTheoryData[i].unlocked){
                            if(playerTheoryData[i].conditionsMet){
                                context.drawImage(miscImages.checklock,globalWorldData.worldX+240+w-55-35,globalWorldData.worldY+140 + 45*i + 7,21,25);
                            } else {
                                context.drawImage(miscImages.whitelock,globalWorldData.worldX+240+w-55-35,globalWorldData.worldY+140 + 45*i + 7,21,25);
                            }
                        }
                    }
    
                } else {
                    context.font = '18px ZenMaruRegular';
                    let writeupInfo = theoryWriteupData[menuData.selectedWriteup];
                    let wrappedText = wrapText(context, writeupInfo.pages[writeupInfo.currentPage], globalWorldData.worldY+140, w-55, 20);
                    wrappedText.forEach(function(item) {
                        // item[0] is the text
                        // item[1] is the y coordinate to fill the text at
                        context.fillText(item[0], globalWorldData.worldX+240, item[1]);
                    });
    
                    context.font = '22px zenMaruRegular';
                    context.textAlign = 'center';
                    context.fillStyle = 'white';
                    context.fillText("Page "+(writeupInfo.currentPage+1)+"/"+writeupInfo.pages.length, globalWorldData.worldX+(18*TILE_SIZE/2)+215, globalWorldData.worldY+h*globalWorldData.sizeMod-130);
                }
    
                if(menuData.selectedWriteup !== null){
                    isToDrawStatusBar = false;
    
                    let writeupInfo = theoryWriteupData[menuData.selectedWriteup];
    
                    // Right-side box
                    context.fillStyle = 'hsl(0, 0%, 10%, 55%)';
                    context.save();
                    context.shadowColor = "hsl(0, 30%, 0%)";
                    context.shadowBlur = 15;
                    context.beginPath();
                    context.roundRect(globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30, globalWorldData.worldY, 305, 805, 30);
                    context.fill();
                    context.restore();
    
                    let currentY = 50;
    
                    // Write-up title
                    context.font = '32px zenMaruMedium';
                    context.fillStyle = 'white';
                    context.textAlign = 'center';
                    context.fillText("Title", globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, globalWorldData.worldY+currentY);
    
                    context.fillStyle = 'hsl(0, 100%, 100%, 40%)';
                    context.fillRect(globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 80, globalWorldData.worldY+currentY+15, 300-160, 2);
    
                    context.font = '20px zenMaruRegular';
                    context.fillStyle = 'white';
                    let wrappedText = wrapText(context, writeupInfo.title, globalWorldData.worldY+currentY+48, 240, 22);
                    context.textAlign = 'center';
                    wrappedText.forEach(function(item) {
                        // item[0] is the text
                        // item[1] is the y coordinate to fill the text at
                        context.fillText(item[0], globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, item[1]);
                    });
    
                    currentY += wrappedText.length*19+48;
    
                    // Write-up description
                    context.font = '18px zenMaruMedium';
                    context.fillText("Description", globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, globalWorldData.worldY+currentY+35);
    
                    context.fillStyle = 'hsl(0, 100%, 100%, 40%)';
                    context.fillRect(globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 90, globalWorldData.worldY+currentY+35+13, 300-180, 2);
    
                    context.font = '16px zenMaruRegular';
                    context.fillStyle = 'white';
                    context.textAlign = 'center';
                    wrappedText = wrapText(context, writeupInfo.description, globalWorldData.worldY+currentY+35+38, 240, 18);
                    wrappedText.forEach(function(item) {
                        // item[0] is the text
                        // item[1] is the y coordinate to fill the text at
                        context.fillText(item[0], globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, item[1]);
                    });
    
                    currentY += wrappedText.length*18+35+38;
    
                    // Write-up unlock requirements
                    context.font = '17px zenMaruMedium';
                    context.fillText("Unlock Requirements", globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, globalWorldData.worldY+currentY+28);
    
                    context.fillStyle = 'hsl(0, 100%, 100%, 40%)';
                    context.fillRect(globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 90, globalWorldData.worldY+currentY+28+13, 300-180, 2);
    
                    currentY += 28+13;
    
                    context.font = '16px zenMaruRegular';
                    context.fillStyle = 'white';
                    context.textAlign = 'center';
                    for(let i=0; i<writeupInfo.unlockRequirements.length; i++){
                        let r = writeupInfo.unlockRequirements[i];
                        wrappedText = wrapText(context, r.textDescription+` (${r.progress}/${r.number})`, globalWorldData.worldY+currentY+25, 240, 18);
                        wrappedText.forEach(function(item) {
                            // item[0] is the text
                            // item[1] is the y coordinate to fill the text at
                            context.fillText(item[0], globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, item[1]);
                        });
                    }
    
                    currentY += wrappedText.length*18+15;
    
                    // unlock rewards
                    context.font = '17px zenMaruMedium';
                    context.fillText("Unlock Rewards", globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, globalWorldData.worldY+currentY+28);
    
                    context.fillStyle = 'hsl(0, 100%, 100%, 40%)';
                    context.fillRect(globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 90, globalWorldData.worldY+currentY+28+13, 300-180, 2);
    
                    context.font = '16px zenMaruRegular';
                    context.fillStyle = 'white';
                    context.textAlign = 'center';
                    let rewardText = writeupInfo.rewardText;
                    if(playerTheoryData[menuData.selectedWriteup].unlocked){
                        rewardText+= " (Collected)";
                    }
                    wrappedText = wrapText(context, rewardText, globalWorldData.worldY+currentY+28+38, 240, 18);
                    wrappedText.forEach(function(item) {
                        // item[0] is the text
                        // item[1] is the y coordinate to fill the text at
                        context.fillText(item[0], globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, item[1]);
                    });
                }
            } // Draw theory screen function ends here
    
            const drawAbilityScreen = function(){
                context.font = '20px ZenMaruRegular';
                context.textAlign = 'left';
    
                let currentY = 135;
    
                // Draw ability bar
                for(let i=0;i<playerAbilityData.abilitySlots;i++){
                    if(playerAbilityData.equippedAbilities[i] !== null){
                        context.drawImage(abilityIcons[ playerAbilityData.list[playerAbilityData.equippedAbilities[i]].index ],globalWorldData.worldX+247+250-playerAbilityData.abilitySlots*25+50*i,globalWorldData.worldY+currentY,45,45);
    
                        context.lineWidth = 2;
                        context.strokeStyle = 'hsla(0, 30%, 60%, 1)';
                        context.beginPath();
                        context.roundRect(globalWorldData.worldX+247+250-playerAbilityData.abilitySlots*25+50*i, globalWorldData.worldY+currentY, 45, 45, 3);
                        context.stroke();
                    } else {
                        context.lineWidth = 2;
                        context.strokeStyle = 'hsla(0, 30%, 60%, 1)';
                        context.beginPath();
                        context.roundRect(globalWorldData.worldX+247+250-playerAbilityData.abilitySlots*25+50*i, globalWorldData.worldY+currentY, 45, 45, 3);
    
                        context.fillStyle = 'black';
                        context.fill();
                        context.stroke();
                    }
                }
    
                currentY += 65;
    
                context.font = '20px zenMaruRegular';
                context.fillStyle = 'white';
                context.textAlign = 'center';
                context.fillText("Ability List", globalWorldData.worldX+240+250, globalWorldData.worldY+currentY+25);
    
                context.fillStyle = 'hsl(0, 100%, 100%, 40%)';
                context.fillRect(globalWorldData.worldX+240+168, globalWorldData.worldY+currentY+25+15, 300-130, 2);
    
                // Draw ability list
                let rowAmount = 10;
                for(let i=0;i<Math.ceil(playerAbilityData.list.length/rowAmount);i++){
                    let currentRowWidth = Math.min(rowAmount,playerAbilityData.list.length-i*rowAmount);
                    for(let j=0; j<currentRowWidth;j++){
                        let currentIndex = j + i*rowAmount;
    
                        context.drawImage(abilityIcons[playerAbilityData.list[currentIndex].index],globalWorldData.worldX+247+250-currentRowWidth*25+50*j,globalWorldData.worldY+currentY+70+50*i,45,45);
    
                        context.lineWidth = 2;
                        if(menuData.selectedAbility === currentIndex){
                            context.strokeStyle = 'hsla(60, 100%, 75%, 1)';
                        } else {
                            context.strokeStyle = 'hsla(0, 30%, 60%, 1)';
                        }
    
                        context.lineWidth = 2;
                        context.beginPath();
                        context.roundRect(globalWorldData.worldX+247+250-currentRowWidth*25+50*j, globalWorldData.worldY+currentY+70+50*i, 45, 45, 3);
                        context.stroke();
                    }
                }
    
                if(menuData.selectedAbility !== null){
                    // Draw ability information on the right side
                    isToDrawStatusBar = false;
    
                    let playerAbilityInfo = playerAbilityData.list[menuData.selectedAbility];
                    let abilityInfo = abilityFileData[playerAbilityInfo.index];
    
                    // Right-side box
                    context.fillStyle = 'hsl(0, 0%, 10%, 55%)';
                    context.save();
                    context.shadowColor = "hsl(0, 30%, 0%)";
                    context.shadowBlur = 15;
                    context.beginPath();
                    context.roundRect(globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30, globalWorldData.worldY, 305, 805, 30);
                    context.fill();
                    context.restore();
    
                    context.drawImage(abilityIcons[playerAbilityInfo.index],globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150-50,globalWorldData.worldY+25,100,100);
    
    
                    context.font = '24px zenMaruRegular';
                    context.fillStyle = 'white';
                    context.fillText(abilityInfo.name, globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, globalWorldData.worldY+165);
    
                    context.font = '16px zenMaruRegular';
                    context.textAlign = 'left';
    
                    let bodyText = abilityInfo.description;
                    let wrappedText = wrapText(context, bodyText, globalWorldData.worldY+205, 260, 16);
                    wrappedText.forEach(function(item) {
                        // item[0] is the text
                        // item[1] is the y coordinate to fill the text at
                        context.fillText(item[0], globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 25, item[1]);
                    });
    
                    let currentY = globalWorldData.worldY+185 + wrappedText.length*16;
    
                    if(!playerAbilityInfo.acquired){
                        context.textAlign = 'center';
                        context.font = '17px zenMaruMedium';
                        context.fillText("Unlock Requirements", globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, globalWorldData.worldY+currentY+28);
    
                        context.fillStyle = 'hsl(0, 100%, 100%, 40%)';
                        context.fillRect(globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 90, globalWorldData.worldY+currentY+28+13, 300-180, 2);
    
                        currentY += 28+13;
    
                        context.font = '16px zenMaruRegular';
                        context.fillStyle = 'white';
                        context.textAlign = 'center';
                        for(let i=0; i<abilityInfo.unlockRequirements.length; i++){
                            let r = abilityInfo.unlockRequirements[i];
                            wrappedText = wrapText(context, r.textDescription+` (${r.progress}/${r.number})`, globalWorldData.worldY+currentY+25, 240, 18);
                            wrappedText.forEach(function(item) {
                                // item[0] is the text
                                // item[1] is the y coordinate to fill the text at
                                context.fillText(item[0], globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, item[1]);
                            });
                        }
                        currentY += 25+wrappedText.length*18;
                        if(playerAbilityInfo.unlocked){
                            context.font = '19px zenMaruMedium';
                            context.fillStyle = "#d600ba";
                            context.fillText(`${playerCombatData.power}/${abilityInfo.acquisitionPower} power to acquire!`, globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, globalWorldData.worldY+currentY+28);
                        }
                    }
                    if(playerAbilityData.acquiringAbility === playerAbilityInfo.index){
                        game.acquisitionButtonParticleSystem.drawParticles(performance.now());
                    }
                    if(playerAbilityData.acquiredAbilities[playerAbilityInfo.name]){
                        context.textAlign = 'center';
                        context.fillStyle = "white";
                        context.font = '22px zenMaruBlack';
                        context.fillText("Acquired", globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, globalWorldData.worldY+670);
    
                        context.font = '18px zenMaruMedium';
                        context.fillText("Drag to Equip!", globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, globalWorldData.worldY+710);
                    }
                }
    
                if(draggingObject){
                    let offsetX = globalInputData.mouseX - draggingObject[2], offsetY = globalInputData.mouseY - draggingObject[3];
                    context.drawImage(abilityIcons[ playerAbilityData.list[draggingObject[4]].index ],draggingObject[0]+offsetX,draggingObject[1]+offsetY,45,45);
                }
            } // Draw ability screen function ends here

            const drawSaveScreen = function(){
                if(menuData.loadStatement !== null){
                    context.font = '18px zenMaruRegular';
                    context.fillText("Welcome back to the world of unnamed kanji game!", globalWorldData.worldX+345 + 150, globalWorldData.worldY+140);
                    //context.fillText("Double click to use consumables!", globalWorldData.worldX+345 + 150, globalWorldData.worldY+630);
                    //context.fillText("Crafting coming soon?!????!??!!?", globalWorldData.worldX+345 + 150, globalWorldData.worldY+680);
                }
            } // Draw save screen function ends here
    
            if(menuScene === "Inventory"){
                drawInventoryScreen();
            } else if(menuScene === "Kanji List"){
                drawKanjiScreen();
            } else if(menuScene === "Theory"){
                drawTheoryScreen();
            } else if(menuScene === "Abilities"){
                drawAbilityScreen();
            } else if(menuScene === "Save"){
                drawSaveScreen();
            }
        }
    
        if(menuScene !== null){
            drawMenuScreen();
        } else {
            drawWorldScreen();
        }
    
        // Apply damage redness and finish shake
        if(activeDamage.startFrame > 0){
            let ad = activeDamage;
            let secondsLeft = ad.duration - (timeStamp - ad.startFrame)/1000;
            context.fillStyle = `hsla(0, 100%, 50%, ${0.2*secondsLeft})`
            context.fillRect(globalWorldData.worldX,globalWorldData.worldY,w*globalWorldData.sizeMod,h*globalWorldData.sizeMod);
            context.restore();
        }
    
        let logItemsDrawn = 0;
        // Draw the log
        for(let i=ingameLog.length-1;i>=0;i--){
            let logItem = ingameLog[i];
            let timeElapsed = timeStamp - logItem.timeAdded;
            let alpha = Math.min(200 - timeElapsed*logItem.durationMultiplier/30,100);
    
            if(alpha>0){
                context.save();
                context.fillStyle = `hsla(${logItem.h}, ${logItem.s}%, ${logItem.l}%, ${alpha}%)`;
                //context.fillStyle = `hsla(0, 0%, 100%, ${alpha}%)`;
                context.textAlign = 'center';
    
                context.shadowColor = "hsla(0, 30%, 0%, 45%)";
                context.shadowBlur = 12;
    
                let fontSize = Math.floor(16*globalWorldData.sizeMod);
                context.font = `${fontSize}px zenMaruRegular`;
    
                if(menuScene !== null){
                    context.fillText(logItem.text,globalWorldData.worldX+w*globalWorldData.sizeMod/2,globalWorldData.worldY+h*globalWorldData.sizeMod+64*globalWorldData.sizeMod-(fontSize+5)*logItemsDrawn);
                } else if(dialogue){
                    context.fillText(logItem.text,globalWorldData.worldX+w*globalWorldData.sizeMod/2,globalWorldData.worldY+h*globalWorldData.sizeMod-108*globalWorldData.sizeMod-(fontSize+5)*logItemsDrawn);
                } else {
                    context.fillText(logItem.text,globalWorldData.worldX+w*globalWorldData.sizeMod/2,globalWorldData.worldY+h*globalWorldData.sizeMod-32*globalWorldData.sizeMod-(fontSize+5)*logItemsDrawn);
                }
    
                logItemsDrawn++;
    
                context.restore();
            } else {
                break;
            }
            if(logItemsDrawn>4){
                break;
            }
        }
    
        // Draw the right part of the screen
        if(isToDrawStatusBar){
            context.fillStyle = 'hsl(0, 0%, 10%, 55%)';
            context.save();
            context.shadowColor = "hsl(0, 30%, 0%)";
            context.shadowBlur = 15;
            context.beginPath();
            context.roundRect(globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30, globalWorldData.worldY, 305, 805, 30);
            context.fill();
            context.restore();
    
            context.font = '32px zenMaruMedium';
            context.textAlign = 'center';
            context.fillStyle = 'white';
            context.fillText("Status", globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, globalWorldData.worldY+50);
            drawCharacter("witch",[32,0],globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 200,globalWorldData.worldY+122,1.5);
    
            context.font = '20px zenMaruMedium';
            context.fillText("Abilities", globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, globalWorldData.worldY+505);
    
            // Draw ability bar
            for(let i=0;i<playerAbilityData.abilitySlots;i++){
                if(playerAbilityData.equippedAbilities[i] !== null){
                    context.drawImage(abilityIcons[ playerAbilityData.list[playerAbilityData.equippedAbilities[i]].index ],globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 28+50*i,globalWorldData.worldY+535,45,45);
                }
    
                context.lineWidth = 2;
                context.strokeStyle = 'hsla(0, 30%, 60%, 1)';
                context.beginPath();
                context.roundRect(globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 28+50*i, globalWorldData.worldY+535, 45, 45, 3);
                context.stroke();
            }
    
            /*context.font = '15px zenMaruRegular';
            context.fillText("No learned abilities", globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, globalWorldData.worldY+520);*/
    
            context.font = '20px zenMaruMedium';
            context.fillText("Inventory", globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, globalWorldData.worldY+660);
    
            // Draw inventory hotbar
            for(let i=0;i<5;i++){
                context.lineWidth = 2;
                context.strokeStyle = 'hsla(270, 30%, 60%, 1)';
                context.beginPath();
                context.roundRect(globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 28+50*i, globalWorldData.worldY+690, 45, 45, 3);
                context.stroke();
    
                if(playerInventoryData.inventory[i] !== "none"){
                    drawItemIcon(playerInventoryData.inventory[i],globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 28+50*i,globalWorldData.worldY+690);
                }
            }
    
            // Make underlines
            context.fillStyle = 'hsl(0, 100%, 100%, 40%)';
            context.fillRect(globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 80, globalWorldData.worldY+65, 300-160, 2);
            context.fillRect(globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 100, globalWorldData.worldY+520, 300-200, 2);
            context.fillRect(globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 100, globalWorldData.worldY+675, 300-200, 2);
    
            context.font = '24px zenMaruRegular';
            context.textAlign = 'center';
            context.fillStyle = playerWorldData.color;
            context.fillText(playerWorldData.name, globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, globalWorldData.worldY+100);
    
            context.font = '18px zenMaruMedium';
            context.textAlign = 'left';
            context.fillStyle = "White";
            context.fillText("HP: ", globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 20, globalWorldData.worldY+140);
            context.fillText("Power: ", globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 20, globalWorldData.worldY+165);
    
            context.fillStyle = "#40d600";
            context.fillText(playerCombatData.hp+"/"+playerCombatData.maxHp, globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 20+context.measureText("HP: ").width, globalWorldData.worldY+140);
    
            context.fillStyle = "#d600ba";
            context.fillText(playerCombatData.power+"/"+playerCombatData.powerSoftcap, globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 20+context.measureText("Power: ").width, globalWorldData.worldY+165);
    
            // Draw currencies
            context.drawImage(miscImages.gems,globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30+20,globalWorldData.worldY+750,26,26);
            context.drawImage(miscImages.gold,globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30+257,globalWorldData.worldY+750,26,26);
            context.font = '24px Arial';
            context.fillStyle = "#0cf";
            context.fillText(playerInventoryData.currencyTwo, globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30+55, globalWorldData.worldY+772);
            context.fillStyle = "#fff01a";
            context.textAlign = 'right';
            context.fillText(playerInventoryData.currencyOne, globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30+55+190, globalWorldData.worldY+772);
    
            context.textAlign = 'left';
    
            // Draw conditions
            let conditionLine = "Conditions: ";
            let conditionLineNum = 0;
            context.font = '18px zenMaruMedium';
            context.fillStyle = "White";
            context.fillText("Conditions: ", globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 20, globalWorldData.worldY+210);
    
            for(let i in playerConditions){
                const condition = playerConditions[i];
                context.font = '18px zenMaruMedium';
    
                if( (conditionLine + condition.name).length > "Conditions: Dysymbolia, Hunger, aaa".length){
                    conditionLine = "";
                    conditionLineNum++;
                }
    
                let conditionX = globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 20+context.measureText(conditionLine).width;
                let conditionY = globalWorldData.worldY+210+24*conditionLineNum;
    
                // Handle special drawing for the dysymbolia condition
                if(condition.name === "Dysymbolia" && timeUntilDysymbolia < 30){
                    context.font = `18px zenMaruBlack`;
                    if(condition.particleSystem === null){
                        condition.particleSystem = createParticleSystem({
                            x: [conditionX,conditionX+context.measureText(condition.name).width], y:[conditionY,conditionY], hue: 0, saturation: 0, lightness: 100, startingAlpha: 0.005,
                            particlesPerSec: 50, drawParticles: drawParticlesTypeZero, newParticle: newParticleTypeTwo,
                            particleSize: 5, particleLifespan: 450, mod: 1.2, shift: 1.3, particleSpeed: 120, gravity: -300,
                            sourceType: "line", specialDrawLocation: true,
                        });
                        particleSystems.push(condition.particleSystem);
                    }
                    let ps = condition.particleSystem;
                    if(timeUntilDysymbolia > -1){
                        let advancement = (30 - timeUntilDysymbolia)/30;
                        ps.startingAlpha = advancement/1.5;
                        ps.particleLifespan = 250 + 300*advancement;
                        ps.particlesPerSec = 40 + 30*advancement;
                        ps.particleSize = 5 + 5*advancement;
                        ps.particleSpeed = 60 + 200*advancement;
                        ps.lightness = 100;
    
                        condition.color = `hsl(0,0%,${timeUntilDysymbolia*(10/3)}%)`;
                    } else {
                        let advancement = 1;
                        ps.startingAlpha = 1;
                        ps.particleLifespan = 250 + 300*advancement;
                        ps.particlesPerSec = 40 + 30*advancement;
                        ps.particleSize = 5 + 5*advancement;
                        ps.particleSpeed = 60 + 200*advancement;
    
                        ps.lightness = 0;
    
                        if(condition.golden){
                            ps.hue = 280;
                            ps.saturation = 100;
                            ps.lightness = 40;
                        } else {
                            condition.color = `hsl(0,0%,100%)`;
                        }
                    }
                    condition.particleSystem.drawParticles(performance.now());
                }
    
                context.fillStyle = condition.color;
                if(i < playerConditions.length-1){
                    context.fillText(condition.name+", ", conditionX, conditionY);
                    conditionLine += condition.name+", ";
                } else {
                    context.fillText(condition.name, conditionX, conditionY);
                }
            }
    
            // Draw combat info
            if(combat){
                let enemy = combat.enemy;
                let enemyInfo = enemyFileData[enemy.fileDataIndex];
    
                context.fillStyle = 'hsla(0, 0%, 50%, 0.7)';
                context.save();
                context.shadowColor = enemyInfo.color;
                context.shadowBlur = 7;
                context.beginPath();
                context.roundRect(globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 20, globalWorldData.worldY+300, 263, 170, 10);
                context.fill();
                context.restore();
    
                context.font = '20px zenMaruRegular';
                context.textAlign = 'center';
                context.fillStyle = enemyInfo.color;
                context.fillText(enemyInfo.name, globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, globalWorldData.worldY+325);
    
                context.font = '18px zenMaruMedium';
                context.textAlign = 'left';
                context.fillStyle = "White";
                context.fillText("HP: ", globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 45, globalWorldData.worldY+360);
    
                context.fillStyle = "#40d600";
                context.fillText(enemy.hp+"/"+enemy.maxHp, globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 45+context.measureText("HP: ").width, globalWorldData.worldY+360);
            }
        }
    }

    // Initialize the menu tab, also used to update it sometimes...
    function initializeMenuTab(){
        for(let i = tooltipBoxes.length-1;i>=0;i--){
            if(tooltipBoxes[i].type === "item"){
                tooltipBoxes.splice(i,1);
            } else if(tooltipBoxes[i].type === "kanji list entry"){
                tooltipBoxes.splice(i,1);
            } else if(tooltipBoxes[i].type === "ability menu ability") {
                tooltipBoxes.splice(i,1);
            } else if(tooltipBoxes[i].type === "write-up entry") {
                tooltipBoxes.splice(i,1);
            }
        }
        for(let i = buttons.length-1;i>=0;i--){
            if(buttons[i].temporaryMenuButton !== undefined && buttons[i].temporaryMenuButton){
                buttons.splice(i,1);
            }
        }

        handleDraggingObject = undefined;
        draggingObject = null;

        if(menuScene === "Inventory"){
            updateInventory(playerInventoryData,"none",true);

            handleDraggingObject = function(action){
                if(action==="mousedown"){
                    for(let i=0;i<Math.ceil(playerInventoryData.inventory.length/5);i++){
                        for(let j=0;j<5;j++){
                            let box = {
                                x: globalWorldData.worldY+285+105+67*j,
                                y: globalWorldData.worldY+160 + 67*i,
                                width: 60,
                                height: 60
                            };
                            if (globalInputData.mouseX >= box.x && globalInputData.mouseX <= box.x + box.width && globalInputData.mouseY >= box.y && globalInputData.mouseY <= box.y + box.height) {
                                if(playerInventoryData.inventory[j + i*5] !== "none"){
                                    draggingObject = [box.x,box.y,globalInputData.mouseX,globalInputData.mouseY,playerInventoryData.inventory[j + i*5],j + i*5];
                                    playerInventoryData.inventory[j + i*5] = "none";
                                }
                                break;
                            }
                        }
                    }

                } else if(action==="mousemove"){
                    //draggingObject[2] = globalInputData.mouseX;
                    //draggingObject[3] = globalInputData.mouseY;
                } else if(action==="mouseup"){
                    let boxFound = false;
                    for(let i=0;i<Math.ceil(playerInventoryData.inventory.length/5);i++){
                        for(let j=0;j<5;j++){
                            let box = {
                                x: globalWorldData.worldY+285+105+67*j,
                                y: globalWorldData.worldY+160 + 67*i,
                                width: 60,
                                height: 60
                            };
                            if (globalInputData.mouseX >= box.x && globalInputData.mouseX <= box.x + box.width && globalInputData.mouseY >= box.y && globalInputData.mouseY <= box.y + box.height) {
                                boxFound = true;
                                playerInventoryData.inventory[draggingObject[5]] = playerInventoryData.inventory[j + i*5];
                                playerInventoryData.inventory[j + i*5] = draggingObject[4];
                                initializeMenuTab();
                                break;
                            }
                        }
                    }
                    if(!boxFound){
                        playerInventoryData.inventory[draggingObject[5]] = draggingObject[4];
                    }
                    draggingObject = null;
                }
            }
        } else if(menuScene === "Kanji List"){
            let rowAmount = 12;
            for(let i=0;i<Math.ceil(adventureKanjiFileData.length/rowAmount);i++){
                for(let j=0; j<Math.min(rowAmount,adventureKanjiFileData.length-i*rowAmount);j++){
                    tooltipBoxes.push({
                        x: globalWorldData.worldY+295+45*j,
                        y: globalWorldData.worldY+140+45*i,
                        spawnTime: 0,
                        width: 45, height: 45,
                        type: "kanji list entry", index: j + i*rowAmount,
                    });
                }
            }

            buttons.push({
                x:globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+107, y:globalWorldData.worldY+700, width:150, height:30,
                neutralColor: '#b3b3ff', hoverColor: '#e6e6ff', pressedColor: '#ff66ff', color: '#b3b3ff',
                text: "Toggle Enabled Status", font: '13px zenMaruRegular', fontSize: 18, enabled: true, temporaryMenuButton: true,
                onClick: function(){
                    playerKanjiData[menuData.selectedKanji].enabled = !playerKanjiData[menuData.selectedKanji].enabled;
                }
            });
        } else if(menuScene === "Theory"){
            for(let i=0;i<theoryWriteupData.length;i++){
                tooltipBoxes.push({
                    x: globalWorldData.worldX+240,
                    y: globalWorldData.worldY+140 + 45*i,
                    spawnTime: 0,
                    width: 18*TILE_SIZE+1-55, height: 40,
                    type: "write-up entry", index: i,
                });
                if(evaluateUnlockRequirements(playerAbilityData, theoryWriteupData[i].unlockRequirements)){
                    playerTheoryData[i].conditionsMet = true;
                }
            }

            if(menuData.isReadingWriteup){
                let writeupInfo = theoryWriteupData[menuData.selectedWriteup];

                buttons.push({
                    x:globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+132, y:globalWorldData.worldY+700, width:100, height:30,
                    neutralColor: '#b3b3ff', hoverColor: '#e6e6ff', pressedColor: '#ff66ff', color: '#b3b3ff',
                    text: "Stop Reading", font: '13px zenMaruRegular', fontSize: 18, enabled: true, temporaryMenuButton: true,
                    onClick: function(){
                        menuData.isReadingWriteup = false;
                        initializeMenuTab();
                    }
                });

                if(writeupInfo.currentPage > 0){
                    buttons.push({
                        x:globalWorldData.worldX+(18*TILE_SIZE/2)+120, y:globalWorldData.worldY+18*TILE_SIZE*globalWorldData.sizeMod-150, width:35, height:35,
                        neutralColor: '#b3b3ff', hoverColor: '#e6e6ff', pressedColor: '#ff66ff', color: '#b3b3ff', radius:1,
                        text: "<", font: '30px zenMaruRegular', fontSize: 30, enabled: true, temporaryMenuButton: true,
                        onClick: function(){
                            theoryWriteupData[menuData.selectedWriteup].currentPage--;
                            initializeMenuTab();
                        }
                    });
                }

                if(writeupInfo.currentPage < writeupInfo.pages.length-1){
                    buttons.push({
                        x:globalWorldData.worldX+(18*TILE_SIZE/2)+280, y:globalWorldData.worldY+18*TILE_SIZE*globalWorldData.sizeMod-150, width:35, height:35,
                        neutralColor: '#b3b3ff', hoverColor: '#e6e6ff', pressedColor: '#ff66ff', color: '#b3b3ff', radius:1,
                        text: ">", font: '30px zenMaruRegular', fontSize: 30, enabled: true, temporaryMenuButton: true,
                        onClick: function(){
                            theoryWriteupData[menuData.selectedWriteup].currentPage++;
                            initializeMenuTab();
                        }
                    });
                }
            } else {
                if(playerTheoryData[menuData.selectedWriteup].unlocked){
                    buttons.push({
                        x:globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+157, y:globalWorldData.worldY+700, width:50, height:30,
                        neutralColor: '#b3b3ff', hoverColor: '#e6e6ff', pressedColor: '#ff66ff', color: '#b3b3ff',
                        text: "Read", font: '13px zenMaruRegular', fontSize: 18, enabled: true, temporaryMenuButton: true,
                        onClick: function(){
                            menuData.isReadingWriteup = true;
                            initializeMenuTab();
                        }
                    });
                } else if(playerTheoryData[menuData.selectedWriteup].conditionsMet){
                    buttons.push({
                        x:globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+98, y:globalWorldData.worldY+700, width:170, height:30,
                        neutralColor: '#ff6', hoverColor: '#ffffb3', pressedColor: '#66f', color: '#ff6',
                        text: "Unlock and Collect Reward", font: '13px zenMaruRegular', fontSize: 18, enabled: true, temporaryMenuButton: true,
                        onClick: function(){
                            let theoryNum = menuData.selectedWriteup;
                            if(playerTheoryData[theoryNum].conditionsMet){
                                playerTheoryData[theoryNum].unlocked = true;
                                menuData.isReadingWriteup = true;
                                for(let i in theoryWriteupData[theoryNum].unlockRewards){
                                    awardPlayer(playerInventoryData,theoryWriteupData[theoryNum].unlockRewards[i],performance.now());
                                }
                                initializeMenuTab();
                            }
                        }
                    });
                }
            }
        } else if(menuScene === "Abilities"){
            updatePlayerAbilityList(playerAbilityData);
            let playerAbilityList = playerAbilityData.list;

            let rowAmount = 10;
            for(let i=0;i<Math.ceil(playerAbilityList.length/rowAmount);i++){
                let currentRowWidth = Math.min(rowAmount,playerAbilityList.length-i*rowAmount);
                for(let j=0; j<currentRowWidth;j++){
                    tooltipBoxes.push({
                        x: globalWorldData.worldX+247+250-currentRowWidth*25+50*j,
                        y: globalWorldData.worldY+200+70,
                        spawnTime: 0,
                        width: 45, height: 45,
                        type: "ability menu ability", index: j + i*rowAmount,
                    });
                }
            }

            let playerAbilityInfo = playerAbilityList[menuData.selectedAbility];
            let abilityInfo = abilityFileData[playerAbilityInfo.index];
            if(!playerAbilityInfo.acquired && playerAbilityInfo.unlocked && playerCombatData.power >= abilityInfo.acquisitionPower){
                buttons.push({
                    x:globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+123, y:globalWorldData.worldY+700, width:120, height:30,
                    neutralColor: '#ff6', hoverColor: '#ffffb3', pressedColor: '#66f', color: '#ff6',
                    text: "Begin Acquisition", font: '13px zenMaruRegular', abilityIndex: playerAbilityInfo.index, fontSize: 14, enabled: true, temporaryMenuButton: true,
                    onClick: function(){
                        if(this.text === "Begin Acquisition" && playerAbilityData.acquiringAbility === null && dialogue === null){
                            playerAbilityData.acquiringAbility = this.abilityIndex;
                            timeUntilDysymbolia = 0;
                            this.text = "Acquisition Begun!";
                            game.acquisitionButtonParticleSystem = createParticleSystem({
                                x: [this.x,this.x+this.width], y:[this.y,this.y], hue: 280, saturation: 100, lightness: 55, startingAlpha: 0.7,
                                particlesPerSec: 70, drawParticles: drawParticlesTypeZero, newParticle: newParticleTypeTwo,
                                particleSize: 10, particleLifespan: 550, mod: 1.2, shift: 1.3, particleSpeed: 260, gravity: -300,
                                sourceType: "line", specialDrawLocation: true,
                            });
                            particleSystems.push(game.acquisitionButtonParticleSystem);
                        }
                    }
                });
            }

            handleDraggingObject = function(action){
                if(action==="mousedown"){
                    if(currentTooltip && tooltipBoxes[currentTooltip.index].type === "ability menu ability" && playerAbilityData.acquiredAbilities[playerAbilityData.list[tooltipBoxes[currentTooltip.index].index].name]){
                        draggingObject = [tooltipBoxes[currentTooltip.index].x,tooltipBoxes[currentTooltip.index].y,globalInputData.mouseX,globalInputData.mouseY,tooltipBoxes[currentTooltip.index].index];
                    } else {
                        for(let i=0;i<playerAbilityData.abilitySlots;i++){
                            let box = {
                                x: globalWorldData.worldX+247+250-playerAbilityData.abilitySlots*25+50*i,
                                y: globalWorldData.worldY+135,
                                width: 45,
                                height: 45
                            };
                            if (globalInputData.mouseX >= box.x && globalInputData.mouseX <= box.x + box.width && globalInputData.mouseY >= box.y && globalInputData.mouseY <= box.y + box.height) {
                                if(playerAbilityData.equippedAbilities[i] !== null){
                                    draggingObject = [box.x,box.y,globalInputData.mouseX,globalInputData.mouseY,playerAbilityData.equippedAbilities[i]];
                                    playerAbilityData.equippedAbilities[i] = null;
                                }
                                break;
                            }
                        }
                    }

                } else if(action==="mousemove"){
                    //draggingObject[2] = globalInputData.mouseX;
                    //draggingObject[3] = globalInputData.mouseY;
                } else if(action==="mouseup"){
                    for(let i=0;i<playerAbilityData.abilitySlots;i++){
                        let box = {
                            x: globalWorldData.worldX+247+250-playerAbilityData.abilitySlots*25+50*i,
                            y: globalWorldData.worldY+135,
                            width: 45,
                            height: 45
                        };
                        if (globalInputData.mouseX >= box.x && globalInputData.mouseX <= box.x + box.width && globalInputData.mouseY >= box.y && globalInputData.mouseY <= box.y + box.height) {
                            playerAbilityData.equippedAbilities[i] = draggingObject[4];
                            for(let j=0;j<playerAbilityData.equippedAbilities.length;j++){
                                if(j !== i && playerAbilityData.equippedAbilities[j] === draggingObject[4]){
                                    playerAbilityData.equippedAbilities[j] = null;
                                }
                            }
                            break;
                        }
                    }
                    draggingObject = null;
                }
            }

            if(draggingObject === undefined){
                draggingObject = null
            }

        } else if(menuScene === "Save") {
            if(menuData.loadStatement !== null){
                buttons.push({
                    x:globalWorldData.worldX+247+140, y:globalWorldData.worldY+370+300, width:200, height:35,
                    neutralColor: '#b3b3ff', hoverColor: '#e6e6ff', pressedColor: '#ff66ff', color: '#b3b3ff',
                    text: "Close Load Statement", font: '17px zenMaruRegular', fontSize: 17, enabled: true, temporaryMenuButton: true,
                    onClick: function(){
                        menuData.loadStatement = null;
                        initializeMenuTab();
                    }
                });
            } else {
                for(let i=0;i<5;i++){
                    buttons.push({
                        x:globalWorldData.worldX+247+90, y:globalWorldData.worldY+150+i*40, width:310, height:35,
                        neutralColor: '#b3b3ff', hoverColor: '#e6e6ff', pressedColor: '#ff66ff', color: '#b3b3ff',
                        text: "Save Game to Local Storage Slot "+i, font: '17px zenMaruRegular', fontSize: 17, enabled: true, temporaryMenuButton: true,
                        slot: i,
                        onClick: function(){
                            // Only designed to be used during certain states of the game
                            if(dialogue === null || dialogue.cinematic === null){
                                saveToLocalStorage(this.slot);
                                initializeMenuTab();
                            } else {
                                alert("Game is not currently in a savable state. Maybe finish whatever you were doing in the world?")
                            }
                            
                        }
                    });
                    buttons.push({
                        x:globalWorldData.worldX+247+87, y:globalWorldData.worldY+370+i*40, width:320, height:35,
                        neutralColor: '#b3b3ff', hoverColor: '#e6e6ff', pressedColor: '#ff66ff', color: '#b3b3ff',
                        text: "Load Game from Local Storage Slot "+i, font: '17px zenMaruRegular', fontSize: 17, enabled: true, temporaryMenuButton: true,
                        slot: i,
                        onClick: function(){
                            game.loadSaveGame(this.slot);
                            initializeMenuTab();
                        }
                    });
                }
    
            }
           
            updateInventory(playerInventoryData);
        } else {
            updateInventory(playerInventoryData);
        }
    }

    // **************************************** //
    // PRIVILEGED functions
    // **************************************** //

    // The priviledged functions are mostly called by input events or are the game loop

    this.outputSaveGame = function(){
        let saveGame = {
            // version the game was saved in
            version: "negative infinity",
    
            playerWorldData: playerWorldData,
            playerCombatData: playerCombatData,
            playerInventoryData: playerInventoryData,
            playerAbilityData: playerAbilityData,
            playerKanjiData: playerKanjiData,
            playerTheoryData: playerTheoryData,
            playerSrsSettingsData: playerSrsSettingsData,
            playerConditions: playerConditions,

            globalPlayerStatisticData: globalPlayerStatisticData,
    
            clock: globalWorldData.currentGameClock,
            gameClockOfLastPause: globalWorldData.gameClockOfLastPause,
            timeUntilDysymbolia: timeUntilDysymbolia,
    
            dialogue: dialogue,
    
            combat: combat,
    
            levelNum: globalWorldData.levelNum,
            
            date: new Date(),
        }
        return saveGame;
    }

    this.loadSaveGame = function(slot){
        try {
            let save = JSON.parse(localStorage.getItem("save "+slot));

            playerWorldData = save.playerWorldData;
            playerCombatData = save.playerCombatData;
            playerInventoryData = save.playerInventoryData;
            playerAbilityData = save.playerAbilityData;
            playerKanjiData = save.playerKanjiData;
            playerTheoryData = save.playerTheoryData;
            playerSrsSettingsData = save.playerSrsSettingsData;
            playerConditions = save.playerConditions;

            globalPlayerStatisticData = save.globalPlayerStatisticData;
    
            globalWorldData.currentGameClock = save.clock;
            globalWorldData.gameClockOfLastPause = save.gameClockOfLastPause;
            dialogue = save.dialogue;
            combat = save.combat;
            globalWorldData.levelNum = save.levelNum;
            menuData.selectedAbility = 0;
            menuData.selectedWriteup = 0;
            
            timeUntilDysymbolia = save.timeUntilDysymbolia;

            blur = 0;
    
            globalInputData.currentDirectionFrozen = false;

            if(dialogue !== null){
                dialogue.lineStartTime = performance.now();
            }
            
            // Particle systems have to be made again or nullified
            for(let i=0;i<playerConditions.length;i++){
                let condition = playerConditions[i];
                if(condition.name === "Dysymbolia"){
                    condition.particleSystem = null;
                }
            }
    
            if(playerAbilityData.acquiringAbility !== null){
                let buttonDimensions = {x:globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+123, y:globalWorldData.worldY+700, width:120, height:30};
                game.acquisitionButtonParticleSystem = createParticleSystem({
                    x: [buttonDimensions.x,buttonDimensions.x+buttonDimensions.width], y:[buttonDimensions.y,buttonDimensions.y],
                    hue: 280, saturation: 100, lightness: 55, startingAlpha: 0.7,
                    particlesPerSec: 70, drawParticles: drawParticlesTypeZero, newParticle: newParticleTypeTwo,
                    particleSize: 10, particleLifespan: 550, mod: 1.2, shift: 1.3, particleSpeed: 260, gravity: -300,
                    sourceType: "line", specialDrawLocation: true,
                });
                particleSystems.push(game.acquisitionButtonParticleSystem);
            }

            // Restore our date objects
            for(let i=0;i<playerKanjiData.length;i++){
                let kanji = playerKanjiData[i];
    
                for(let j=0;j<kanji.trialHistory.length;j++){
                    kanji.trialHistory[j].dateStamp = new Date(kanji.trialHistory[j].dateStamp);
                }
            }

            // Create the load statement
            menuData.loadStatement = {
                dateDifference: "something",
            };
    
            alert("successfully loaded i think");
        }
        catch (err) {
            alert("save failed: "+err);
        }
    }

    // called on button press. toggles menu and returns "closed menu" or "opened menu"
    this.handleMenuButtonPress = function(){
        if(menuScene === null){
            menuScene = "Inventory";
            globalWorldData.gameClockOfLastPause = globalWorldData.currentGameClock;
            for(let i in buttons){
                let b = buttons[i];

                // If it has the tab property it is a menu tab changing button
                // This has me really raise my eyebrows at the state management of this program lol
                if(b.hasOwnProperty("tab")){
                    b.enabled = true;
                }
            }
            initializeMenuTab();

            return "opened menu";
        } else {
            menuScene = null;
            globalWorldData.timeOfLastUnpause = performance.now();
            for(let i = buttons.length-1;i>=0;i--){
                let b = buttons[i];

                // If it has the tab property it is a menu tab changing button
                if(b.hasOwnProperty("tab")){
                    b.enabled = false;
                }
                if(buttons[i].temporaryMenuButton !== undefined && buttons[i].temporaryMenuButton){
                    buttons.splice(i,1);
                }
            }
            handleDraggingObject = undefined;
            draggingObject = null;
            updateInventory(playerInventoryData);

            return "closed menu";
        }
    };

    this.handleMenuTabButtonPress = function(tab){
        menuScene = tab;
        initializeMenuTab();
    };

    // called when mouse is moved
    this.handleMouseHover = function(mouseX,mouseY){
        for (const b of buttons) {
            if(!globalInputData.mouseDown){
                if (mouseX >= b.x &&         // right of the left edge AND
                mouseX <= b.x + b.width &&    // left of the right edge AND
                mouseY >= b.y &&         // below the top AND
                mouseY <= b.y + b.height) {    // above the bottom
                    b.color = b.hoverColor;
                } else {
                    b.color = b.neutralColor;
                }
            }
        }

        if(currentTooltip === null){
            //check if we hovered over a tooltip
            for (let i=0;i<tooltipBoxes.length;i++) {
                let t = tooltipBoxes[i];
                if (mouseX >= t.x &&         // right of the left edge AND
                mouseX <= t.x + t.width &&    // left of the right edge AND
                mouseY >= t.y &&         // below the top AND
                mouseY <= t.y + t.height) {    // above the bottom
                    currentTooltip = {timeStamp: performance.now(), index: i};
                }
            }
        } else {
            let t = tooltipBoxes[currentTooltip.index];
            //check if we are still hovering
            if (mouseX >= t.x &&         // right of the left edge AND
            mouseX <= t.x + t.width &&    // left of the right edge AND
            mouseY >= t.y &&         // below the top AND
            mouseY <= t.y + t.height) {
                //pass
            } else {
                currentTooltip = null
            }
        }
    
        if(handleDraggingObject !== undefined && draggingObject){
            handleDraggingObject("mousemove");
        }
    }

    this.handleMouseDown = function(mouseX,mouseY){
        //check if was pressed on button so we can change color!
        for (let x in buttons) {
            let b = buttons[x];
            if (mouseX >= b.x &&         // right of the left edge AND
                mouseX <= b.x + b.width &&    // left of the right edge AND
                mouseY >= b.y &&         // below the top AND
                mouseY <= b.y + b.height) {    // above the bottom
                    b.color = b.pressedColor;
                }
        }

        if(handleDraggingObject !== undefined){
            handleDraggingObject("mousedown");
        }
    }

    this.handleMouseUp = function(mouseX,mouseY){
        if(handleDraggingObject !== undefined && draggingObject){
            handleDraggingObject("mouseup");
        }
    }

    this.handleMouseClick = function(mouseX,mouseY){
        for (let x in buttons) {
            let b = buttons[x];
            if(!b.enabled){
                continue;
            }
    
            if (mouseX >= b.x && mouseX <= b.x + b.width && mouseY >= b.y && mouseY <= b.y + b.height) {
                b.color = b.hoverColor;
    
                //only register as a click if when the mouse was pressed down it was also within the button.
                //note that this implementation does not work for a moving button so if that is needed this would need to change
                if (globalInputData.mouseDownX >= b.x &&         // right of the left edge AND
                    globalInputData.mouseDownX <= b.x + b.width &&    // left of the right edge AND
                    globalInputData.mouseDownY >= b.y &&         // below the top AND
                    globalInputData.mouseDownY <= b.y + b.height) {b.onClick();}
            } else {
                b.color = b.neutralColor;
            }
        }
        particleSystems.push(createParticleSystem({x:mouseX, y:mouseY, temporary:true, particlesLeft:6, particleSpeed: 120, particleAcceleration: -150, particleLifespan: 600, particleSize: 5}));
    }

    // Draws, updates, requests animation frames
    this.gameLoop = function(timeStamp){
        // ******************************
        // First phase of game loop is updating the logic of the scene
        // ******************************

        // Calculate the number of seconds passed since the last frame
        secondsPassed = (timeStamp - oldTimeStamp) / 1000;
        oldTimeStamp = timeStamp;

        // Calculate fps
        fps = Math.round(1 / secondsPassed);

        // If too much lag here, skip this frame as the fps count being too low will cause unwanted behavior
        if(fps < 3){
            window.requestAnimationFrame(game.gameLoop);
            console.log("skipping a frame...");
            return;
        }

        // Call the update function for the scene
        updateGame(timeStamp);

        // Update particle systems
        for (let i=particleSystems.length-1;i>=0;i--) {
            let sys = particleSystems[i];

            // Add all the particles we will keep to this array, to avoid using splice to remove particles
            let newArray = [];
            for (let j in sys.particles) {
                let p = sys.particles[j];

                // Only use the particle if it is not going to be destroyed
                if(timeStamp<p.destroyTime){
                    p.x += p.velX/fps;
                    p.y += p.velY/fps;
                    p.velX += p.accX/fps;
                    p.velY += p.accY/fps;
                    p.velY += sys.gravity/fps;
                    newArray.push(p)
                }
            }

            if(sys.createNewParticles){
                // If enough time has elapsed, create particle!
                while (timeStamp-sys.timeOfLastCreate >= 1000/sys.particlesPerSec && sys.particlesLeft > 0) {

                    newArray.push(sys.newParticle(timeStamp));
                    sys.timeOfLastCreate = sys.timeOfLastCreate + 1000/sys.particlesPerSec;

                    //if the timestamp is way too off the current schedule (because the animation was stalled),
                    //shift the schedule even though doing so may lead to a slight inaccuracy (200ms chosen arbitirarily)
                    if(sys.timeOfLastCreate+200 < timeStamp){
                        sys.timeOfLastCreate=timeStamp;
                    }

                    if(sys.systemLifespan+sys.createTime<=timeStamp){
                        sys.createNewParticles = false;
                    }
                    sys.particlesLeft--;
                }
            } else if(sys.particles.length == 0 && sys.temporary){
                // If system is out of particles, destroy it!
                particleSystems.splice(i,1);
                //alert("Murdering system at index " + i + " D:")
            }
            if(sys.particlesLeft === 0){
                sys.createNewParticles = false;
            }
            sys.particles = newArray;
        }

        if(frameCount%(fps*2) === 0){
            worstParticleSystem.createNewParticles = !worstParticleSystem.createNewParticles;
        }

        // ******************************
        // Updating logic finished, next is the drawing phase
        // ******************************

        // Clear canvas
        context.fillStyle = bgColor;
        context.fillRect(-1000, -1000, screenWidth+2000, screenHeight+2000);

        drawGame(timeStamp);

        // Draw the active buttons as it is not specifc to scene
        for (let x in buttons) {
            let b = buttons[x];
            if(!b.enabled){
                continue;
            }
            let text = b.text.replaceAll("=",""); // i use = as a special delimiter, not to be displayed

            context.save();
            context.shadowColor = "hsl(0, 100%, 0%)";
            context.shadowBlur = b.shadow;
            context.fillStyle = b.color;
            context.beginPath();
            context.roundRect(b.x, b.y, b.width, b.height, 28);
            context.fill();
            context.restore();

            context.fillStyle = 'black';
            context.font = b.font;

            if (b.jp) {
                context.fillText(text, b.x+(b.width/2)-(b.fontSize*text.length/2), b.y+(b.height/2)+b.fontSize/4);
            } else {
                context.textAlign = "center";
                context.fillText(text, b.x+(b.width/2), b.y+(b.height/2)+b.fontSize/4);
            }


            context.textAlign = "start";
        }

        let particleCount = 0;

        // Draw particle systems if they are not drawn somewhere else
        for (let x in particleSystems) {
            let sys = particleSystems[x];
            if(!sys.specialDrawLocation){
                sys.drawParticles(timeStamp);
            }

            particleCount+=sys.particles.length;
        }

        // Draw constant elements
        context.fillStyle = textColor;
        if(showDevInfo){
            context.font = '18px Arial';
            context.textAlign = "right";
            context.fillText(note, screenWidth-30, screenHeight-110);

            context.textAlign = "start";
            context.fillText("Partcle Count: "+particleCount, screenWidth-200, screenHeight-80);
            //context.fillText("Kanji Loaded: "+kanjiLoaded, screenWidth-200, screenHeight-140);

            context.font = '20px zenMaruLight';
            context.textAlign = "left";
            context.fillText(`I love you by a factor of ${love}.`, 120, screenHeight-30);
        }

        context.font = '18px Arial';
        context.textAlign = "start";
        context.fillText("FPS: "+fps, screenWidth-200, screenHeight-50);

        context.font = '20px zenMaruLight';
        context.textAlign = "left";

        // Draw tooltip over everything else
        if(currentTooltip !== null){
            if(timeStamp - currentTooltip.timeStamp > tooltipBoxes[currentTooltip.index].spawnTime){
                drawTooltip();
            }
        }

        if(isLoggingFrame){
            let statement = //"Time Stamp: " +timeStamp+ "\n" + "Scene: " +name+ "\n"+ "Number of tooltips: " +tooltipBoxes.length+ "\n";
`Time Stamp: ${timeStamp}
Scene: ${name}
Number of tooltips: ${tooltipBoxes.length}
Player Src: ${playerWorldData.src}
`;
            console.log(statement);
            alert(statement);
            isLoggingFrame=false;
        }

        // Keep requesting new frames
        frameCount++;
        window.requestAnimationFrame(game.gameLoop);
    }

    // Add button that toggles the menu
    buttons.push({
        x:globalWorldData.worldX+18*16*globalWorldData.sizeMod*2 +157, y:globalWorldData.worldY+750, width:50, height:30,
        neutralColor: '#b3b3ff', hoverColor: '#e6e6ff', pressedColor: '#ff66ff', color: '#b3b3ff',
        text: "Menu", font: '13px zenMaruRegular', fontSize: 18,
        onClick: function() {
            let status = game.handleMenuButtonPress();

            if(status === "opened menu"){
                this.text = "Close Menu";
                this.width = 80;
                this.x -= 15;
            } else {
                this.text = "Menu";
                this.width = 50;
                this.x += 15;
            }
        }
    });

    // Add tab buttons in the menu
    for(const [i, tabName] of ["Inventory","Abilities","Kanji List","Theory","Settings","Save"].entries()){
        let onClick = function() {
            game.handleMenuTabButtonPress(this.text);
        };
        let newIngameMenuButton = {
            x:globalWorldData.worldX+20, y:globalWorldData.worldY+65+30+78*i, width:160, height:60, shadow: 12,
            neutralColor: '#b3b3ff', hoverColor: '#e6e6ff', pressedColor: '#ff66ff', color: '#b3b3ff',
            text: tabName, font: '22px zenMaruLight', fontSize: 22, jp: false,
            enabled: false, tab: tabName,
            onClick: onClick,
        }
        buttons.push(newIngameMenuButton);
    }

    // Initialize buttons
    for(let i in buttons){
        let b = buttons[i];

        // Register dictionary lookup tooltip boxes from buttons that are japanese
        if (b.jp){
            let words = b.text.split("=");
            let characterNumber = 0;
            let text = b.text.replaceAll("=",""); // this is to be able to get an accurate length
            for (let i in words){
                let word = words[i];
                if(dictionary.entries.hasOwnProperty(word)){

                    // Add tooltip box to scene
                    tooltipBoxes.push({
                        x:  b.x+(b.width/2)-(b.fontSize*text.length/2)+(b.fontSize*characterNumber),
                        y: b.y+(b.height/2)-b.fontSize+b.fontSize/4,
                        width: b.fontSize*word.length, height: b.fontSize,
                        type: "dictionary", word: word, spawnTime: 1100,
                    });
                }
                characterNumber += word.length;
            }
        }
        if(!b.hasOwnProperty("color")){
            b.color = b.neutralColor;
        }
        if(!b.hasOwnProperty("enabled")){
            b.enabled = true;
        }
        if(!b.hasOwnProperty("shadow")){
            b.shadow = 0;
        }
    }

    // Initialize!
    initializeNewSaveGame(playerKanjiData,playerTheoryData,playerAbilityData);
    dialogue = initializeDialogue("scenes","opening scene",performance.now());
    updateConditionTooltips(playerConditions);
    updateInventory(playerInventoryData);
    globalInputData.xClicked = globalInputData.zClicked = globalInputData.doubleClicked = false;
}


// Loop that waits for assets and starts game
function initialLoadingLoop(timeStamp){
    if(gameJsonDataLoaded && levelsLoaded && areImageAssetsLoaded()){
        game = new Game();

        window.requestAnimationFrame(game.gameLoop);
    } else {
        // circle
        context.fillStyle = randomColor;
        context.beginPath();
        context.arc(600, 600, 10, 0, 2 * Math.PI);
        context.fill();

        // Line
        context.beginPath();
        context.moveTo(500, 500);
        context.lineTo(250, 150);
        context.stroke();

        // triangle
        context.beginPath();
        context.moveTo(300, 200);
        context.lineTo(350, 250);
        context.lineTo(350, 150);
        context.fill();

        // shapes drawn with stroke instead of fill
        context.lineWidth = 5;

        context.beginPath();
        context.arc(400, 100, 50, 0, 2 * Math.PI);
        context.strokeStyle = randomColor;
        context.stroke();

        // to be a full triangle it would have to be 3 lines, it doesnt
        // automatically close it like with fill
        context.beginPath();
        context.moveTo(400, 300);
        context.lineTo(450, 350);
        context.lineTo(350, 150);
        context.stroke();

        context.beginPath();
        context.strokeStyle = '#0099b0';
        context.fillStyle = randomColor;
        context.stroke(heartPath);
        //context.fill(heartPath);

        context.fillStyle = 'hsl(240,100%,50%)';
        context.fillRect(100, 250, 100, 125);

        // and now for what we have all be waiting for: text
        context.fillStyle = 'white';
        context.font = '20px zenMaruRegular';
        context.fillText("Currently loading!", 50, 100);

        window.requestAnimationFrame(initialLoadingLoop);
    }  
}

function init(){
    // Load in images
    for (let i in characterList){
        let c = characterList[i];

        var spritesheet = new Image();
        spritesheet.src = `/assets/3x4charactersheets/${c}_spritesheet.png`;
        var faces = new Image();
        faces.src = `/assets/faces/${c}_faces.png`;

        characterSpritesheets[c] = spritesheet;
        characterFaces[c] = faces;
        if(c === "lizard"){
            characterBitrates[c] = 48;
        } else {
            characterBitrates[c] = 32;
        }
    }

    miscImages.checklock = new Image();
    miscImages.checklock.src = `/assets/some ui/green-checklock.png`;
    miscImages.whitelock = new Image();
    miscImages.whitelock.src = `/assets/some ui/white-lock.png`;
    miscImages.openlock = new Image();
    miscImages.openlock.src = `/assets/some ui/open-lock.png`;
    miscImages.gems = new Image();
    miscImages.gems.src = `/assets/some ui/diamonds.png`;
    miscImages.gold = new Image();
    miscImages.gold.src = `/assets/some ui/gold-coins.png`;
    miscImages.gun = new Image();
    miscImages.gun.src = `/assets/Snoopeth's Guns/1px/33.png`

    // Get a reference to the canvas
    canvas = document.getElementById('canvas');
    context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;

    love = localStorage.getItem('love');
    //name = localStorage.getItem('name');
    love = love===null ? 0 : parseInt(love);
    //name = name===null ? "" : name;

    window.requestAnimationFrame(initialLoadingLoop);
}
