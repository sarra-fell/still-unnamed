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
    chatting: false,
    menuScene: null,
    sidebar: "status",
    menuData: {
        loadStatement: null,
        selectedAbility: 0,
        selectedKanji: 0,
        selectedWriteup: 0,
        isReadingWriteup: false,

        // array to change the equipped abilities to after menu is closed
        //newEquippedAbilities: [null,null,null,null,null,null,null,null,null,null],
    },

    // Counts the minutes elapsed from 0:00 in the day, for now it goes up 1 every second
    currentGameClock: 600,
    timeOfLastUnpause: 0,
    gameClockOfLastPause: 600,
}

let ingameLog = [];

// Measured in in-game seconds. -1 means there is a current dysymbolia event
// it will stay at 0 if one cannot currently happen and it is waiting for the next opportunity to start
let timeUntilDysymbolia = 40;

// The player statistic data, designed to be global
var globalPlayerStatisticData = {
    finishedFirstRandomDysymboliaScene: false,

    // key pair for each dialogue in category "scene", contains number of times completed
    sceneCompletion: {},

    totalSceneDysymboliaExperienced: 0,
    stepCount: 0,
    enemiesDefeated: 0,
    totalDysymboliaManualTriggers: 0,
    totalKanjiMastery: 0,
    totalPowerGained: 0,
    totalDamageTaken: 0,
    totalDamageDealt: 0,
    totalLeechDetectionTriggers: 0,
    totalFirstTryKanji: 0,
    highestIndividualMastery: 0,
}

var globalInputData = {
    inputtingText: false, 
    finishedInputtingText: true, 
    textEntered: "",

    // keyPressed variables only to be changed by input event listeners
    downPressed: false, upPressed: false, leftPressed: false, rightPressed: false,

    // variables set to be true by input event listeners and set back to false after being handled by scene update
    downClicked: false, upClicked: false, key1Clicked: false, key2Clicked: false, key3Clicked: false, doubleClicked: false,

    // for player movement. handled by the input layer
    currentDirection: "Down",

    // Changed by the scene when the direction is not to change regardless of input
    currentDirectionFrozen: false,

    mouseDown: false, mouseX: 0, mouseY: 0,

    // Used to know the x and y of the last mousedown, mostly for determining if the mouseup or mouse click occured in the same place as it
    //so that we know whether a button was actually fully clicked or not
    mouseDownX: -1, mouseDownY: -1,
}

var keybinds = [
    'ArrowLeft',
    'ArrowUp',
    'ArrowRight',
    'ArrowDown',
    'c', // confirm, continue
    'x', // cancel, back
    'z', // open chat etc
]

const masteryStageIntervals = [0,1,3,7,21,90,Infinity];
const masteryStageColors = [
    [20,40,50],
    [120,40,50],
    [205,60,55],
    [280,60,55],
    [355,75,55],
    [60,85,65],
];

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
    death: {}
};

var kanjiFileData = [];
var theoryWriteupData = [];
var abilityFileData = [];
var abilityIcons = [];
var enemyFileData = [];
var itemData = [];
var conditionData = [];

// array of booleans corrosponding to item info
var globalItemsDiscovered = [];

// Loads the data !!!
let gameJsonDataLoaded = false;
function processGameJsonData(data) {
    const gameData = JSON.parse(data);
    const dialogueData = gameData.dialogue;
    kanjiFileData = gameData.kanji;
    theoryWriteupData = gameData.theory;
    abilityFileData = gameData.abilities;
    enemyFileData = gameData.enemies;
    itemData = gameData.items;
    conditionData = gameData.conditions;
    globalItemsDiscovered = Array(itemData.length).fill(false);

    dialogueFileData.scenes = dialogueData.scenes;
    dialogueFileData.world = dialogueData.worldDialogue;
    dialogueFileData.randomDysymbolia = dialogueData.randomDysymbolia;
    dialogueFileData.abilityAcquisition = dialogueData.abilityAcquisition;
    dialogueFileData.death = dialogueData.death;
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

            for(let j=0;j<kanjiFileData.length;j++){
                if(symbol === kanjiFileData[j].symbol){
                    ability.specialKanji[i] = j;
                }
            }
        }
    }

    for (let scene in dialogueFileData.scenes){
        globalPlayerStatisticData.sceneCompletion[scene] = 0;
    }

    gameJsonDataLoaded = true;
}

// Levels isnt the most amazing word for it technically but it is the terminology that ldtk uses so thats the terms we are using
var levels = [];

// Clouds
var clouds = [];
var cloudXOffset = 0;
var cloudYOffset = 0;

// Information on the connections between levels. currently an array of connections that is to be iterated through when looking for the other side of a connection.
var connections = [];

let levelsLoaded = false;
function processLevelData(data) {
    //console.log(data);
    const worldData = JSON.parse(data);
    const levelsData = worldData.levels;

    // Takes the length of the layers and takes off 2 for the entities and collisions layer
    const numTileLayers = worldData.defs.layers.length -3;

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
        const collisionLayerData = levelData.layerInstances[levelData.layerInstances.length-2];
        const dungeonRoomsLayerData = levelData.layerInstances[levelData.layerInstances.length-1];

        levels[i].collisions = collisionLayerData.intGridCsv;
        levels[i].iid = levelData.iid;
        levels[i].identifier = levelData.identifier;
        levels[i].neighbours = levelData.__neighbours;
        

        levels[i].gridWidth = collisionLayerData.__cWid;
        levels[i].gridHeight = collisionLayerData.__cHei;
        levels[i].lightSource = levelData.fieldInstances[0].__value;
        levels[i].levelType = levelData.fieldInstances[1].__value;
        if(levels[i].levelType === "dungeon"){
            levels[i].roomsGrid = dungeonRoomsLayerData.intGridCsv;
        }

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

const characterList = ["witch","andro","gladius","lizard","hiddenone_spider"];

var characterSpritesheets={},characterFaces={},characterBitrates={};
const faceBitrate = 96;

// Key pair for misc images
var miscImages = {};

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
    for (const [key, value] of Object.entries(miscImages)) {
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
    if(e.key === keybinds[0]){
        globalInputData.leftPressed=true; 
        if(!globalInputData.currentDirectionFrozen) globalInputData.currentDirection="Left"; return;
    } else if(e.key === keybinds[1]){
        globalInputData.upPressed=true; 
        globalInputData.upClicked=true; 
        if(!globalInputData.currentDirectionFrozen) globalInputData.currentDirection="Up"; return;
    } else if(e.key === keybinds[2]){
        globalInputData.rightPressed=true; 
        if(!globalInputData.currentDirectionFrozen) globalInputData.currentDirection="Right"; return;
    } else if(e.key === keybinds[3]){
        globalInputData.downPressed=true; 
        globalInputData.downClicked=true; 
        if(!globalInputData.currentDirectionFrozen) globalInputData.currentDirection="Down"; return;
    } else if(e.key === keybinds[4]){
        globalInputData.key1Clicked=true;
    } else if(e.key === keybinds[5]){
        globalInputData.key2Clicked=true;
    } else if(e.key === keybinds[6]){
        globalInputData.key3Clicked=true;
    } else if(e.key === 'Enter'){
        globalInputData.finishedInputtingText=true; return;
    }

   if(!globalInputData.finishedInputtingText){
        switch (e.key) {
        case 'Backspace': if(globalInputData.textEntered.length>0){
            globalInputData.textEntered = globalInputData.textEntered.substring(0,globalInputData.textEntered.length-1);
        } break;
        default: if(e.key.length===1){
            globalInputData.textEntered = globalInputData.textEntered+e.key;
        }
    }
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

let berryGachaData = [];

/********************************** UI ELEMENT CODE *************************************/

// This section of the code was made in post after struggling with a UI system that didn't end up scaling up
// It is meant to solve issues where tooltips, graphics, and checking for mouse input are too decoupled not allowing to be able to
//manage them all the information that is supposed to be associated easily at once when a element is to be added, removed, or disabled.

// This system will simply couple together information that before was annoyingly seperated in several different places requiring cleanup of
//objects in multiple arrays when a item is to be added, removed, or modified.

// The button system could also be combined with this one but that isn't why this feature is being made, the button system worked just fine before
//so merging it with this one will be a much lower priority than turning text with tooltips, ability slots, inventory slots, etc, into UI elements to be managed here.

// UI objects will be stored in global arrays:
let globalStatusBarUiElements = [];

let globalMenuTabUiElements = [];

// For all micellanous elements
let globalUIElements = [];

// A UI object will contain:
// A name.
// x, y, width, height. Only rect elements are supported.
// A type. The type will be used to determine what draw function to use if any at all.

// Optional array of particle systems associated with the element. These systems are drawn over the element when the element is also active and visible and are meant to be seperate
//from the global particle system array

// Optional tooltip object associated with the element. These can be set up to be displayed over the element when the element is hovered over. Seperate from
//the other tooltips array, maybe the other tooltips array can be deprecated when ive fully switched over to using this.

// isHoveredOver bool that can be used to check if the element is being hovered over and is automatically checked.
// isPressedOn bool
// wasClicked bool that will remain true for a frame after the mouse was released over the element. There is no click callback so in the case of needing to do something
//when the element is clicked, this should be checked each frame instead of waiting for a callback to be called. There shouldn't be so many elements that a callback is necessary.

//isActive bool, all updating and drawing will be completely disabled when this is false
//isVisible bool, drawing using the draw function will be skipped with this false, this has no purpose if there is no draw function in the first place

// They may also contain any number of arbitrary member variables that can be used for any purpose necessary for storing information with the element.

function createUiElement(name,type,x,y,width,height, particleSystems = [], tooltip = null){
    let newUiElement = {
        name: name,
        type: type,
        x: x,
        y: y,
        width: width,
        height: height,
        
        particleSystems: particleSystems,
        tooltip: tooltip,

        isHoveredOver: false,
        isPressedOn: false,
        wasClicked: false,

        isActive: true,
        isVisible: true
    };

    newUiElement.tooltip.x = x;
    newUiElement.tooltip.y = y;
    newUiElement.tooltip.width = width;
    newUiElement.tooltip.height = height;

    return newUiElement;
}

function drawInventorySlot(uiElement,playerInventoryData){
    context.lineWidth = 2;
    context.fillStyle = 'black';
    context.strokeStyle = 'hsla(270, 30%, 60%, 1)';
    context.beginPath();
    context.roundRect(uiElement.x, uiElement.y, uiElement.width, uiElement.height, 3);
    context.fill();
    context.stroke();

    if(playerInventoryData.inventory[uiElement.slotNum] !== "none"){
        if(uiElement.width !== 45){
            context.save();
            context.translate(uiElement.x,uiElement.y);
            context.scale(uiElement.width/42,uiElement.height/42);
            drawItemIcon(playerInventoryData.inventory[uiElement.slotNum],-1,-1);
            context.restore();
        } else {
            drawItemIcon(playerInventoryData.inventory[uiElement.slotNum],uiElement.x,uiElement.y);
        }
    }
}

function drawAbilitySlot(uiElement,playerAbilityData){
    context.lineWidth = 2;
    context.fillStyle = 'black';
    context.strokeStyle = 'hsla(0, 30%, 60%, 1)';
    context.beginPath();
    context.roundRect(uiElement.x, uiElement.y, uiElement.width, uiElement.height, 3);
    context.fill();
    context.stroke();

    if(playerAbilityData.equippedAbilities[uiElement.slotNum] !== null){
        context.drawImage(abilityIcons[ playerAbilityData.list[playerAbilityData.equippedAbilities[uiElement.slotNum]].index ],uiElement.x+1,uiElement.y+1,uiElement.width-2,uiElement.height-2);
    }
}

// Draws a tooltip
function drawTooltip(tooltip) {
    let draw = function(titleColor,titleText,bodyText,jp = false,titleShadow=0,shadowColor = "hsl(0, 15%, 0%, 70%)"){
        let wrappedText = wrapText(context, bodyText, globalInputData.mouseY+74, 330, 16, jp);

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

    if(tooltip.type === "dictionary"){
        const word = tooltip.word;
        context.font = '20px zenMaruRegular';
        draw('black', "Definition of " + word, dictionary.entries[word]);
    } else if (tooltip.type === "condition"){
        const c = tooltip.condition;
        const cInfo = conditionData[c.id];
        let cColor = c.color;
        if(cColor === undefined){
            cColor = cInfo.color;
        }

        context.font = '20px zenMaruBlack';
        if(cInfo.name === "Dysymbolia"){
            if(timeUntilDysymbolia === 0){
                draw(cColor,cInfo.name,"Character sees visions of a distant world. Next imminent.", false, 12);
                return;
            } else if(timeUntilDysymbolia < 0){
                if(c.golden){
                    draw(cColor,cInfo.name,"いい度胸です。", true, 12, "hsl(280, 100%, 70%, 70%)");
                } else {
                    draw(cColor,cInfo.name,"ここにいてはダメです。戻ってください。", true, 12);
                }
                return;
            }
        }

        let splitDesc = cInfo.desc.split("$");
        let parsedDesc = "";
        for(let i in splitDesc){
            if(splitDesc[i] === "timeUntilDysymbolia"){
                parsedDesc = parsedDesc + `${timeUntilDysymbolia}`;
            } else if(splitDesc[i] === "turnsLeft"){
                parsedDesc = parsedDesc + `${c.turnsLeft}`;
            } else {
                parsedDesc = parsedDesc + splitDesc[i];
            }
        }
        draw(cColor,cInfo.name,parsedDesc,false,12);
    } else if (tooltip.type === "item"){
        let info = itemData[tooltip.item];
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
    } else if(tooltip.type === "kanji list entry"){
        // dont draw shit and the tooltip is just used as a signal that its being hovered over lol
    } else if (tooltip.type === "kanji"){
        let kanji = kanjiFileData[tooltip.index];
        let text = kanji.story;
        context.font = '20px Arial';
       draw('black',kanji.symbol + "   " + kanji.keyword,text)
    } else if(tooltip.type === "ability"){
        let ability = tooltip.ability;
        let abilityInfo = abilityFileData[ability];
        context.font = '18px zenMaruRegular';
        draw('black',abilityInfo.name,abilityInfo.tooltipDescription);
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
            currentTooltip = {timeStamp: performance.now(), info: t};
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
*    needs to be changed at some point
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
    sourceType="point",templateName="none"} = {}) {

    if(templateName ==="whitenfluffy"){
        hue=[0,0];
        saturation=[0,0];
        lightness=[100,85];
        particlesPerSec=30;
        drawParticles=0;
        newParticle=1;
        particleSize=8;
        particleLifespan=700;
    } else if(templateName ==="water"){
        hue=[135];
        saturation=[58];
        lightness=[68];
        particlesPerSec=15;
        drawParticles=0;
        newParticle=1;
        particleSize=6;
        particleLifespan=600;
    }

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

// To be called once per frame
function updateParticleSystems(fps,timeStamp){
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
}


// It is march 2025, and I am working on this project for the first time in quite a few months.

// What I have decided to do first is to work on some menus for the game, especially the main menu and it's submenus
// This is because i have figured out that main menu design is actually quite important for the game and at this point
//I want to use it as a way to get my toes wet again after such a long break from the project.

function mainMenuLoop(timeStamp){

}


// I have put a lot of functions that have to do with the game outside of the Game object, it is not necessary the most logical
//system at first glance but this is how it worked out and it works fine.

// Those functions that need to be passed data that is stored in the game object is below.

// Call to initialize the game when no save file is being loaded and the game is to start from the beginning
function initializeNewSaveGame(playerKanjiData,playerTheoryData,playerAbilityData,playerStatData,playerConditions){
    for(let i=0;i<kanjiFileData.length;i++){

        let kanji = {
            // Index in the file data
            index: i,

            // Contains the last time any trial success or failure was submitted with this kanji, srs trials or not
            lastTrialDate: null,

            // Significant trials are: a trial of a new kanji, a due review trial, any trial that pushes back the review date for whatever reason 
            // Significant trials are not: reinforcement trials, trials before the review due date

            // Non-srs trials can still be a significant trial, for example if the kanji was due for review and it was a success, it will be treated like a successful review.
            // (but if it was not successful it will be ignored)
            lastSignificantTrialDate: null,

            enabled: true,

            trialSuccesses: 0,
            trialFailures: 0,

            successStreak: 0,

            customStory: null,
            customKeyword: null,

            masteryStage: 0,

            // used to calulate new review intervals 
            // (if a new review interval would be smaller than this, it will push it up slightly higher, with a stronger effect the bigger the distance is)
            highestReviewIntervalAchieved: 0,

            // Mastery stage can go down after a long vacation but highest mastery stage will be used to calculate mastery score, maybe?
            //highestMasteryStage: 0,

            /**** Internal SRS Variables ****/

            srsCategory: 0, // 0 is new, 1 is reinforcing, 2 is reviewing
            // stores data that changes in structure depending on its srs category (new, reinforcing, reviewing)
            // new category stores no further data
            // reinforcing category stores: 
            // reviewMultiplier, multiplier on the length of time between reviews based on past performance
            // currentInterval, indicates how long the interval between the last review and the next review this session should be, in seconds.

            // reviewing category stores:
            // currentInterval, indicates how long the interval between the last review and the next review this session should be, in days (with a 2 hour leeway)
            srsCategoryInfo: {},

            // After a trial, this will go up or down based on the circumstances, and if it gets too high from too many trial failures, the kanji will be identified as leech
            leechScore: 0,
            leechDetectionTriggered: false,

            // If kanji was gotten right on the first trial ever, special mechanics may apply
            firstTrySuccess: false,

            // If not null, indicates the number of the trial where this kanji was studied last this session
            // How many trials gone by since the last trial is a variable used to determine when it gets trialed
            lastTrialNum: null,
        };
        playerKanjiData.kanjiList.push(kanji);
        playerKanjiData.newKanji.push(kanji);
    }

    for(let i=0;i<theoryWriteupData.length;i++){
        playerTheoryData.push({
            unlocked: false,
            conditionsMet: false,
            listed: false,
        });
    }

    for(let i=0;i<abilityFileData.length;i++){
        playerAbilityData.acquiredAbilities[abilityFileData[i].name] = false;
    }

    playerKanjiData.newKanji.reverse();

    playerConditions.push({
        id: 0,
        golden: false,
        particleSystem: null, // Becomes a particle system when one needs to be drawn behind it
    });

    //updateHunger(playerStatData,playerConditions,1);
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

// Updates the reviewsDue number and "sorts" the array, not to be called during an active trial or things will be messed up
function updateReviewsDue(playerKanjiData,currentDate){
    playerKanjiData.reviewsDue = 0;
    let dueReviewingKanji = [];
    let undueReviewingKanji = [];
    
    for(let i=0;i<playerKanjiData.reviewingKanji.length;i++){
        let kanji = playerKanjiData.reviewingKanji[i];
        let timePassed = currentDate - kanji.lastSignificantTrialDate;
        let hourInterval = (kanji.srsCategoryInfo.currentInterval * 24)-2;
        if(timePassed > 1000 * 60 * 60 * hourInterval && kanji.enabled){
            playerKanjiData.reviewsDue++;
            dueReviewingKanji.push(kanji);
        } else {
            undueReviewingKanji.push(kanji);
        }
    }
    playerKanjiData.reviewingKanji = undueReviewingKanji.concat(dueReviewingKanji);
}

let reinforcingKanjiScoring = function(kanji, trialsThisSession, currentDate){
    // Time passed in seconds since the last trial
    let timePassed = Math.abs(kanji.lastTrialDate - currentDate)/1000;

    // Number of trials of other kanji since the last trial of this kanji
    let trialsSinceLastTrial = null;
    if(kanji.lastTrialNum !== null){
        trialsSinceLastTrial = trialsThisSession - (kanji.lastTrialNum+1);
    }
    if(!kanji.enabled){
        return -Infinity;
    }

    // Each trial since the last trial counts for 25 seconds of extra time passed, in seconds
    let weightedTimePassed = timePassed + trialsSinceLastTrial*25;
    let ratio = weightedTimePassed/(kanji.srsCategoryInfo.currentInterval);

    // Algorithm is subject to change
    return Math.log(ratio*100)*30 + Math.min(Math.max(ratio-0.75,0),0.25)*4000;
}

let evaluateSrsCategoryPriority = function(playerKanjiData){
    let reinforcingPriority = 0;
    
    if(reinforcingPriority !== 0){
        reinforcingPriority += 10;
    }
    // new, reinforcement, review
    return [
        10, // In the future this could depend on a combination of settings and amount of unknown kanji present in the current dungeon
        reinforcingPriority, // In this future this could depend on settings
        Math.log((playerKanjiData.reviewsDue*10)+1) + playerKanjiData.reviewsDue/20, // In this future this could depend on settings
    ];
}

let getNextKanji = function(playerKanjiData, noNewKanji = false){
    let currentDate = new Date();

    // the priorities of the categories
    // new kanji vs reinforcement vs reviews. Will bias toward doing what has more priority while trying to maintain balance.
    let priorities = [(!noNewKanji)*10,0, playerKanjiData.reviewsDue/2];

    // Evaluate the priority for reinforcement while getting the highest priority kanji
    let highestPriorityReinforcingKanji;
    {
        let highestScore = -Infinity;
        for(let i=0;i<playerKanjiData.reinforcingKanji.length;i++){
            let score = reinforcingKanjiScoring(playerKanjiData.reinforcingKanji[i], playerKanjiData.trialsThisSession, currentDate);
            if(score > highestScore){
                highestScore = score;
                highestPriorityReinforcingKanji = playerKanjiData.reinforcingKanji[i];
            }
            priorities[1] += Math.max(score,0.0001)/1000;
        }
    }

    if(priorities[1] > 1){
        priorities[1]+=10;
    }
    if(priorities[2] !== 0){
        priorities[2]+=20;
    }

    let weights = [1,1,1];
    for(let i=playerKanjiData.recentTrialCategories.length-1;i>=0;i--){
        weights[playerKanjiData.recentTrialCategories[i]] += i;
    }
    let normallizeNumberTuple = function(tuple){
        let max = Math.max(...tuple);
        for(let i=0;i<tuple.length;i++){
            tuple[i] = tuple[i]/max;
        }
    }
    normallizeNumberTuple(priorities); normallizeNumberTuple(weights); 
    let deltas = [priorities[0] - weights[0], priorities[1] - weights[1], priorities[2] - weights[2]];
    if(deltas[2] > deltas[1] && deltas[2] > deltas[0]){
        // Get a reviewing kanji 
        return playerKanjiData.reviewingKanji[playerKanjiData.reviewingKanji.length-1];
    } else if(deltas[1] > deltas[0]){
        // Get the highest priority reinforcing kanji next!
        return highestPriorityReinforcingKanji;
    } else {
       // Get a new kanji next!
       let newk = playerKanjiData.newKanji[playerKanjiData.newKanji.length-1];
       while(!newk.enabled){
           playerKanjiData.newKanji.pop();
           newk = playerKanjiData.newKanji[playerKanjiData.newKanji.length-1];
       }
       return playerKanjiData.newKanji[playerKanjiData.newKanji.length-1];
    }
}

// after completing a trial, this function adds the trial to the kanji and updates all the information of it, if needed
function addTrial(playerKanjiData, kanji, succeeded){
    let currentDate = new Date();

    if(kanji.srsCategory < 3){
        if(playerKanjiData.recentTrialCategories.length===10){
            // Move all elements down 1 and add the new trial
            for(let i=0;i<9;i++){
                playerKanjiData.recentTrialCategories[i] = playerKanjiData.recentTrialCategories[i+1];
            }
            playerKanjiData.recentTrialCategories[9] = kanji.srsCategory;
        } else {
            playerKanjiData.recentTrialCategories.push(kanji.srsCategory);
        }
    }

    kanji.lastTrialNum = playerKanjiData.trialsThisSession;
    playerKanjiData.trialsThisSession++;
    kanji.lastTrialDate = currentDate;

    let increaseMastery = function(){
        kanji.masteryStage++;
        globalPlayerStatisticData.totalKanjiMastery++;
        globalPlayerStatisticData.highestIndividualMastery = Math.max(kanji.masteryStage,globalPlayerStatisticData.highestIndividualMastery);
    }

    if(succeeded){
        if(kanji.masteryStage === 0){
            increaseMastery();
        }
        kanji.trialSuccesses++;
        kanji.successStreak++;
        kanji.leechScore = Math.max(0,kanji.leechScore-7*kanji.successStreak)
        if(kanji.srsCategory === 2){
            kanji.lastSignificantTrialDate = currentDate;
            if(kanji.srsCategoryInfo.currentInterval >= masteryStageIntervals[kanji.masteryStage]){
                increaseMastery();
            }
            kanji.srsCategoryInfo.currentInterval*=3;
            if(kanji.srsCategoryInfo.currentInterval<kanji.highestReviewIntervalAchieved){
                let difference = kanji.highestReviewIntervalAchieved - kanji.srsCategoryInfo.currentInterval;
                kanji.srsCategoryInfo.currentInterval+= difference/10;
            } else {
                kanji.highestReviewIntervalAchieved = kanji.srsCategoryInfo.currentInterval;
            }
        } else if(kanji.srsCategory === 0){
            // New kanji succeeded on first try
            kanji.lastSignificantTrialDate = kanji.lastTrialDate;
            kanji.srsCategory = 3;
            kanji.firstTrySuccess = true;

            playerKanjiData.newKanji.pop();
            globalPlayerStatisticData.totalFirstTryKanji++;
        } else if(kanji.srsCategory === 1 /*&& reinforcingKanjiScoring(kanji,playerKanjiData.trialsThisSession,currentDate) > 0*/){
            kanji.srsCategoryInfo.currentInterval = kanji.srsCategoryInfo.currentInterval*3*kanji.srsCategoryInfo.reviewMultiplier;
        }
        
    } else {
        kanji.trialFailures++;
        kanji.successStreak = 0;
        if(kanji.srsCategory === 2){
            kanji.srsCategory = 1;
            kanji.lastSignificantTrialDate = kanji.lastTrialDate;
            playerKanjiData.reinforcingKanji.push(kanji);
            playerKanjiData.reviewingKanji.pop();

            kanji.srsCategoryInfo = {
                currentInterval: 20,
                reviewMultiplier: 1 + 0.5*kanji.masteryStage,
            }
        } else if(kanji.srsCategory === 0){
            kanji.srsCategory = 1;
            kanji.lastSignificantTrialDate = kanji.lastTrialDate;
            playerKanjiData.reinforcingKanji.push(kanji);
            playerKanjiData.newKanji.pop();

            kanji.srsCategoryInfo = {
                currentInterval: 20,
                reviewMultiplier: 1,
            }
        } else if(kanji.srsCategory === 1){
            kanji.srsCategoryInfo.currentInterval = kanji.srsCategoryInfo.currentInterval*(1/3);
            kanji.leechScore += 30;
            if(kanji.leechScore >= 96){
                kanji.leechDetectionTriggered = true;
                kanji.leechScore = 0;
                globalPlayerStatisticData.totalLeechDetectionTriggers++;
                kanji.enabled = false;
                addIngameLogLine(`Leech detection triggered for kanji `+kanjiFileData[kanji.index].symbol,0,0,100,1,performance.now());
            }
        }
    }
    updateReviewsDue(playerKanjiData,currentDate);
}

// Evaluate conditions for listing abilities, unlocking abilities, listing theory pages, or unlocking theory pages.
let evaluateUnlockRequirements = function(playerAbilityData, playerTheoryData, requirements){
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
            } else {
                r.progress = 0;
                unlocked = false;
            }
        } else if(r.type === "unlocked writeup"){
            if(playerTheoryData[r.writeup].unlocked){
                r.progress = 1;
            } else {
                r.progress = 0;
                unlocked = false;
            }
        } else if(r.type === "item discovery"){
            let numDiscovered = 0;
            for(let i = 0; i<globalItemsDiscovered.length; i++){
                if(!globalItemsDiscovered[i]){
                    continue;
                }
                if(itemData[i].subtypes.includes(r.itemType)){
                    numDiscovered++;
                }
            }
            if(numDiscovered < r.number){
                unlocked = false;
            }
            r.progress = numDiscovered;
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
        const c = playerConditions[i];
        const cName = conditionData[c.id].name;

        if((conditionLine + cName).length > "Conditions: Dysymbolia, Hunger, aaa".length){
            conditionLine = "";
            conditionLineNum++;
        }

        tooltipBoxes.push({
            x: globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 20+context.measureText(conditionLine).width,
            y: globalWorldData.worldY+210-18+conditionLineNum*24,
            width: context.measureText(cName).width, height: 18,
            type: "condition", condition: c, spawnTime: 0,
        });
        if(i < playerConditions.length-1){
            conditionLine += cName+", ";
        } else {
            conditionLine += cName;
        }
    }

    reapplyTooltip();
}

// Registers the tooltip boxes for the player's inventory while optionally adding an item in the highest slot
function updateInventory(playerInventoryData,addItem = "none",addMenuTooltips = false){

    if(addItem !== "none"){
        for(let i=0; i<playerInventoryData.inventory.length; i++){
            if(playerInventoryData.inventory[i] === "none"){
                if(typeof addItem !== "number"){
                    for(let j=0;j<itemData.length;j++){
                        if(addItem === itemData[j].name){
                            addItem = j;
                            break;
                        }
                    }
                }
                if(typeof addItem !== "number"){
                    addItem = 4;
                }
                playerInventoryData.inventory[i] = addItem;
                globalItemsDiscovered[addItem] = true;
                break;
            }
        }
    }
    /*
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
            // First convert item name to item id if needed
            if(typeof addItem !== "number"){
                for(let i=0;i<itemData.length;i++){
                    if(addItem === itemData[i].name){
                        addItem = i;
                        break;
                    }
                }
            }
            if(typeof addItem !== "number"){
                addItem = 4;
            }
            playerInventoryData.inventory[i] = addItem;
            globalItemsDiscovered[addItem] = true;
            tooltipBoxes.push({
                x: globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 28+50*i,
                y: globalWorldData.worldY+690,
                width: 45, height: 45,
                type: "item", item: addItem, inventoryIndex: i, spawnTime: 0,
            });
            addItem = "none";
        }
    }
    */
    //reapplyTooltip();
}

// Returns true if player is dead, otherwise false
function playerTakeDamage(playerStatData,dialogue,damage){
    playerStatData.combatData.hp-=damage;
    globalPlayerStatisticData.totalDamageTaken+=damage;
    if(playerStatData.combatData.hp<=0){
        return true;
    }
    return false;
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

        if(evaluateUnlockRequirements(playerAbilityData, {}, a.listRequirements)){
            let unlocked = evaluateUnlockRequirements(playerAbilityData, {}, a.unlockRequirements);
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

// Maintain the correct order of conditions
function sortPlayerConditions(playerConditions){
    let compFn = function(a,b){
        return a.conditionId - b.conditionId;
    }
    playerConditions.sort(compFn);
}

// Remove all conditions of a certain name and return the number of conditions removed
function removeConditionsByName(playerConditions,conditionName){
    let count = 0;
    for(let i=playerConditions.length-1;i>=0;i--){
        if(conditionData[playerConditions[i].id].name === conditionName){
            playerConditions.splice(i,1);
            count++;
        }
    }
    return count;
}

// Adds condition
function addCondition(playerConditions,conditionInfo){
    let conditionFileInfo = conditionData[conditionInfo.id];
    if(conditionFileInfo.unique){
        removeConditionsByName(playerConditions,conditionFileInfo.name);
    }
    playerConditions.push(conditionInfo);
}

function updateHunger(playerStatData,playerConditions,hungerChange){
    const hungerThreshold = playerStatData.hungerSoftcap - 40;
    const severeHungerThreshold = playerStatData.hungerSoftcap - 20;
    let status = "nothing";
    
    if(hungerChange>0){
        // Increase hunger
        playerStatData.hunger = Math.min(playerStatData.hungerSoftcap,playerStatData.hunger+hungerChange);
        if(playerStatData.hunger > severeHungerThreshold){
            removeConditionsByName(playerConditions,"Hunger");
            addCondition(playerConditions, {id: 1});
            status = "starving";
        } else if(playerStatData.hunger > hungerThreshold){
            addCondition(playerConditions, {id: 2});
            status = "hunger added";
        }
    } else {
        // Decrease hunger
        playerStatData.hunger = Math.max(0,playerStatData.hunger+hungerChange);
        if(playerStatData.hunger < severeHungerThreshold){
            removeConditionsByName(playerConditions,"Starvation");
            if(playerStatData.hunger > hungerThreshold){
                addCondition(playerConditions, {id: 2});
            }
        }
        if(playerStatData.hunger < hungerThreshold){
            removeConditionsByName(playerConditions,"Hunger");
        }

        for(let i=playerConditions.length-1;i>=0;i--){
            if(playerConditions[i].name === "Hunger"){
                playerConditions.splice(i,1);
                updateConditionTooltips(playerConditions);
            }
        }
    }
    sortPlayerConditions(playerConditions);
    updateConditionTooltips(playerConditions);
    return status;
}

function useItem(playerInventoryData,playerStatData,playerConditions,inventoryIndex){
    let playerCombatData = playerStatData.combatData;
    let item = playerInventoryData.inventory[inventoryIndex];
    let info = itemData[item];

    if(info.name === "Dev Gun"){
        addIngameLogLine(`You feel really cool for having this don't you.`,180,100,70,1.7,performance.now());
    } else {
        for(const eff of info.effectList){
            if(eff === "heal"){
                playerCombatData.hp = Math.min(playerCombatData.maxHp,playerCombatData.hp+info.effects.healAmount);
            } else if (eff === "satiate"){
                updateHunger(playerStatData,playerConditions,-50);
            }
        }

        playerInventoryData.inventory[inventoryIndex] = "none";
    }
}

// returns array with 0: success of ability activation, 1: dialogue (null if none)
function activateAbility(playerWorldData,playerAbilityData,playerStatData,ability,timeStamp){
    let abilityInfo = abilityFileData[ability];
    let returnMessage = [false,null];

    if(abilityInfo.name === "Dysymbolia-induced Growth"){
        let collision = isCollidingOnTile(playerWorldData.location[0],playerWorldData.location[1],globalInputData.currentDirection);
        if(collision !== null && typeof collision === "object"){
            let entity = levels[globalWorldData.levelNum].entities[collision.index];
            if(entity.id === "Berry_Bush"){
                returnMessage[1] = initializeDialogue("world","berry_bush_dysymbolia_growth_activation",timeStamp,collision.index);
                returnMessage[0] = true;
            }
        }
    }

    return returnMessage;
}

// Called when dialogue begins
// Entity index is the index of the entity that is being interacted with in the level
function initializeDialogue(category, scenario, timeStamp, entityIndex = null){
    globalWorldData.gameClockOfLastPause = globalWorldData.currentGameClock;
    globalInputData.currentDirectionFrozen = true;
    if(category === "scenes"){
        globalPlayerStatisticData.sceneCompletion[scenario]++;
    }
    return {
        startTime: timeStamp,
        lineStartTime: timeStamp,
        currentLine: -1,
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
    context.drawImage(tilesets.tilesetImages[type], src[0], src[1], bitrate, bitrate, x-1, y-1, bitrate*sizeMod+2, bitrate*sizeMod+2);
}

// Draws a tile
function drawTileWithoutHack(type, src, x, y, bitrate = 32, sizeMod = 1){
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
    let info = itemData[itemId];

    if(info.imageInfo[0] === "tile"){
        drawTile(info.imageInfo[1],info.imageInfo[2],x-(info.imageInfo[3]-1)*16 + info.imageInfo[3]*2 + 4,y-(info.imageInfo[3]-1)*16 + info.imageInfo[3]*2 + 4,32,info.imageInfo[3]);
    } else {
        let image = miscImages[info.imageInfo[0]];
        let ratio = image.height/image.width;
        context.drawImage(image,x+6,y+(45-(32*ratio))/2,32,32*ratio);
    }
}

function getTileNum(lev,x,y){return ((x/32) % lev.gridWidth) + (y/32)*lev.gridWidth;}

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
    
    let tileNum = getTileNum(lev,x,y);
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

// Return a dysymbolia cinematic object which stores state about how it will play out and its current state
let newDysymboliaCinematic = function(timeStamp, phase, trials, dysymboliaInfo, startTime = timeStamp, trialedKanjiIndexes = [], specialTrials = 0){
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

// All enemies in the room get a chance to make one action
let takeEnemyActions = function(playerWorldData, timeStamp, roomEnemies, combat){
    // return one of the 4 directions or "adjacent" if already there
    let enemyPathfinding = function(enemy,targetTile){
        if(enemy.dungeonRoom === playerWorldData.dungeonRoom){
            return "adjacent";
        } else {
            return "different room";
        }
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
            let step = enemyPathfinding(enemy,[0,0]);
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
                };
                takeCombatAction(roomEnemies[i],i);
                globalWorldData.gameClockOfLastPause = globalWorldData.currentGameClock;
                combat.turnCount++;
            }
        }
    }
    return combat;
}

// Updates things that change when player moves; currently it just updates the current dungeon room
function updatePlayerLocation(playerWorldData){
    let lev = levels[globalWorldData.levelNum];
    let tileNum = getTileNum(lev,playerWorldData.location[0],playerWorldData.location[1]);
    if(lev.levelType === "dungeon"){
        playerWorldData.dungeonRoom = lev.roomsGrid[tileNum];
    }
}

// Recalculates all modifiers, call this whenever modifiers are added or removed
function updateModifiers(playerStatData){
    /*{   do this later
                    "statCategory": "resistances",
                    "stat": "curse resistance",
                    "type": "multiplicative",
                    "number": 1.1
                },*/
    // Reset modified stats. TODO: System pending revision
    for(let i=0;i<playerStatData.baseStats.combatBaseStats.length;i++){
        playerStatData.combatData[playerStatData.baseStats.combatBaseStats[i][0]] = playerStatData.baseStats.combatBaseStats[i][1];
    }
    for(let i=0;i<playerStatData.baseStats.generalBaseStats.length;i++){
        playerStatData[playerStatData.baseStats.generalBaseStats[i][0]] = playerStatData.baseStats.generalBaseStats[i][1];
    }

    let multiplicativeModifiers = [];
    for(let i=0;i<playerStatData.statModifiers.length;i++){
        // Apply additive stat multipliers and defer multiplicative ones
        let mod = playerStatData.statModifiers[i];
        if(mod.type === "additive"){
            if(mod.statCategory === "general"){
                playerStatData[mod.stat] += mod.number;
            } else if(mod.statCategory === "combat"){
                playerStatData.combatData[mod.stat] += mod.number;
            }
        } else {
            multiplicativeModifiers.push(mod);
        } 
    }
    for(let i=0;i<multiplicativeModifiers.length;i++){
        let mod = multiplicativeModifiers[i];
        if(mod.statCategory === "general"){
            playerStatData[mod.stat] *= mod.number;
        } else if(mod.statCategory === "combat"){
            playerStatData.combatData[mod.stat] = Math.round(playerStatData.combatData[mod.stat]*mod.number);
        }
    }
};

// Specfically updates the tooltips of the abilities on the status bar, not in the ability menu
function updateAbilityTooltips(playerAbilityData){
    for(let i = tooltipBoxes.length-1;i>=0;i--){
        if(tooltipBoxes[i].type === "status bar ability"){
            tooltipBoxes.splice(i,1);
        }
    }

    for(let i=0;i<playerAbilityData.abilitySlots;i++){
        if(playerAbilityData.equippedAbilities[i] !== null){
            tooltipBoxes.push({
                x: globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 28+50*i,
                y: globalWorldData.worldY+535,
                width: 45, height: 45,
                type: "status bar ability", ability: playerAbilityData.equippedAbilities[i], abilityIndex: i, spawnTime: 0,
            });
        }
    }
}

function unequipAbility(playerConditions,playerAbilityData,playerStatData,slotIndex,abilityIndex){
    let abilityInfo = abilityFileData[playerAbilityData.list[abilityIndex].index];
    playerAbilityData.equippedAbilities[slotIndex] = null;

    // Remove modifiers 
    for(let i=playerStatData.statModifiers.length-1;i>=0;i--){
        if(playerStatData.statModifiers[i].sourceType === "ability" && playerStatData.statModifiers[i].source === abilityIndex){
            playerStatData.statModifiers.splice(i,1);
        }
    }
    updateModifiers(playerStatData);
    

    if(abilityInfo.name === "Suppress Dysymbolia"){
        playerAbilityData.dysymboliaSuppressed = false;
        addCondition(playerConditions,{id: 0});
        sortPlayerConditions(playerConditions);
        updateConditionTooltips(playerConditions);
   }
}

function equipAbility(playerConditions,playerAbilityData,playerStatData,slotIndex,abilityIndex){
    // Check if the ability is already equipped and return before effect application if it is
    for(let j=0;j<playerAbilityData.equippedAbilities.length;j++){
        if(j !== slotIndex && playerAbilityData.equippedAbilities[j] === abilityIndex){
            playerAbilityData.equippedAbilities[j] = playerAbilityData.equippedAbilities[slotIndex];
            playerAbilityData.equippedAbilities[slotIndex] = abilityIndex;
            return;
        }
    }
    // Check if an ability is being unequpped at the same time 
    if(playerAbilityData.equippedAbilities[slotIndex] !== null){
        unequipAbility(playerConditions,playerAbilityData,playerStatData,slotIndex,playerAbilityData.equippedAbilities[slotIndex]);
    }
    playerAbilityData.equippedAbilities[slotIndex] = abilityIndex;

    // Effect code here
    let abilityInfo = abilityFileData[playerAbilityData.list[abilityIndex].index];

    if(abilityInfo.equippedModifiers !== undefined){
        for(let i=0;i<abilityInfo.equippedModifiers.length;i++){
            let mod = abilityInfo.equippedModifiers[i];
            if(mod.stat !== undefined){
                playerStatData.statModifiers.push({
                    statCategory:  mod.statCategory,
                    stat: mod.stat,
                    type: mod.type,
                    number: mod.number,
                    sourceType: "ability",
                    source: abilityIndex
                });
            }
        }
    }
    updateModifiers(playerStatData);
    // Special effect for dysymbolia suppression
    if(abilityInfo.name === "Suppress Dysymbolia"){
        // Red particle system
        particleSystems.push(createParticleSystem({hue:0,saturation:100,lightness:50,x:globalInputData.mouseX, y:globalInputData.mouseY, temporary:true, particlesLeft:40, particleSize:5, particlesPerSec: 4000, particleSpeed: 310, particleAcceleration: -150, particleLifespan: 2100}));
        playerAbilityData.dysymboliaSuppressed = true;
        removeConditionsByName(playerConditions,"Dysymbolia");
        sortPlayerConditions(playerConditions);
        updateConditionTooltips(playerConditions);
   }
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
    let fadeout = null;
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
        dungeonRoom: 0,
        src: [32,0],
        bitrate: 32,
        animation: null,
        name: "Mari", jpName: "マリィ",
        color: "#caa8ff",
    };

    // Player data for keeping track of stats/miscellanous player state that doesnt go into the other categories
    let playerStatData = {
        // stat modifiers contain fields:
        // "stat" - what stat is being modified
        // "sourceType" - currently "ability" or "condition"
        // "source" - what is applying this modifier specfically, name of ability for ability or the number ID of the condition
        // "type" - how it modifies that stat, additive or multiplicative 
        // "number" - degree of modification 
        statModifiers: [],

        // currently for defining a temporarily altered relationship to status conditions, there will probably be other special modifiers
        specialModifiers: [],

        power: 0, powerSoftcap: 5,
        hunger: 57, hungerSoftcap: 100, 
        autoDysymboliaInterval: 40,

        combatData: {
            hp: 40, maxHp: 40,
            attackPower: 2,
            resistances: {}
        },

         // having a base version of a stat implies that it can be changed with a stat modifier
        // a base stat is the version of the stat before appling stat modifiers
        // this means that ways of changing a stat that are not modifiers change the base stat, like ability effects that apply while acquired
        baseStats: {
            combatBaseStats: [
                ["maxHp",40],
                ["attackPower",2]
            ],
            baseResistances: [

            ],
            generalBaseStats: [
                ["autoDysymboliaInterval", 40]
            ]
        }
    }

    // Player state regarding inventory
    let playerInventoryData = {
        maxInventorySpace: 20,
        currencyOne: 0, currencyTwo: 0,
        inventory: ["none","none","none","none","none", // First 5 items are the hotbar
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
        // The ones that are over the current maximum amount of abilities are ignored
        equippedAbilities: [null,null,null,null,null,null,null,null,null,null],

        acquiringAbility: null,

        canManuallyTriggerDysymbolia: false,

        dysymboliaSuppressed: false,
    };

    let playerSrsSettingsData = {
        //trialsPerRandomDysymbolia: 8,
        reinforcementIntervalLength: 10,
    };

    let playerKanjiData = {
        // Main array containing the kanji the player has access to and all of their data in relation to the player. This list is stored in the safe file
        kanjiList: [],

        // The rest of the data is not stored in the save file and is repopulated/reinitialized on load instead

        trialsThisSession: 0,

        // contains max 10 elements with 0,1, or 2, for each category
        recentTrialCategories: [],

        // The below are arrays that share references to the kanji objects in the kanjilist.

        // Kanji that just finished introduction or was answered incorrect and needs to be reinforced
        reinforcingKanji: [],
        reinforcesDue: 0, // Floating point based on an aggregate of urgency (currently unused)

        // Kanji that has been sufficiently reinforced/hasnt been brought up in a while
        reviewingKanji: [],
        reviewsDue: 0, // Simple integer

        // Kanji that hasn't been trialed even once
        newKanji: [],
    };

    let playerTheoryData = [];

    let playerConditions = [
        /*{
            id: 0,
            name: "Dysymbolia",
            jpName: "ディシンボリア",
            //type: "Curse",
            color: "white",
            golden: false,
            desc: "Character sees visions of a distant world. Next in $timeUntilDysymbolia$, or when ???.",
            particleSystem: null, // Becomes a particle system when one needs to be drawn behind it
            unique: true,
        },
        {
            name: "Hunger",
            jpName: "空腹",
            //type: "Standard condition",
            color: "#d66b00",
            desc: "Character is hungry. Healing from most non-food sources is reduced.",
            unique: true,
        }*/
    ];

    /*let globalWorldData.menuScene = null;
    let globalWorldData.menuData = {
        loadStatement: null,
        selectedAbility: 0,
        selectedKanji: 0,
        selectedWriteup: 0,
        isReadingWriteup: false,

        // array to change the equipped abilities to after menu is closed
        //newEquippedAbilities: [null,null,null,null,null,null,null,null,null,null],
    }*/

    let dialogue = null;
    let combat = null;
    let handleDraggingObject = undefined;
    let draggingObject = null;
    
    let roomEnemies = [];

    globalWorldData.timeOfLastUnpause = performance.now();
    globalWorldData.gameClockOfLastPause = 600;

    // ***************** private functions! ********************

    function updateGame(timeStamp){
        let lev = levels[globalWorldData.levelNum];

        // Update in-game time
        let newTime = (globalWorldData.gameClockOfLastPause+Math.floor((timeStamp-globalWorldData.timeOfLastUnpause)/1000))%1440;
    
        // If a second went by, update everything that needs to be updated by the second
        if(dialogue === null && globalWorldData.menuScene === null && combat === null && (newTime > globalWorldData.currentGameClock || (globalWorldData.currentGameClock === 1439 && newTime !== 1439))){
            if(newTime % 9 === 0){
                let hungerStatus = updateHunger(playerStatData,playerConditions,1);
                
                if(hungerStatus === "starving"){
                    if(playerTakeDamage(playerStatData,dialogue,Math.round(playerStatData.combatData.maxHp/25))){
                        dialogue = initializeDialogue("death","standard",timeStamp);
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
                }
                if(hungerStatus === "hunger added" && globalPlayerStatisticData.sceneCompletion["tutorial hunger scene"]===0 && !playerAbilityData.dysymboliaSuppressed && dialogue !== null){
                    dialogue = initializeDialogue("scenes","tutorial hunger scene",timeStamp);
                }
            } 
            if(!playerAbilityData.dysymboliaSuppressed){
                if(timeUntilDysymbolia > 0){
                timeUntilDysymbolia-=1;
            } else if(dialogue === null){
                // Begin dysymbolia dialogue!
                if (playerAbilityData.acquiringAbility !== null){
                    dialogue = initializeDialogue("abilityAcquisition",abilityFileData[playerAbilityData.acquiringAbility].name,timeStamp);
                } else if (!globalPlayerStatisticData.finishedFirstRandomDysymboliaScene){
                    dialogue = initializeDialogue("randomDysymbolia","first",timeStamp);
                    globalPlayerStatisticData.finishedFirstRandomDysymboliaScene = true;
                } else {
                    dialogue = initializeDialogue("randomDysymbolia","auto",timeStamp);
                }
            }
            }
            
    
            globalWorldData.currentGameClock = newTime;
        }
    
        // Some local fuctions that will be useful for the update phase

        // Changes the area (level)
        // Takes the Iid of the area to be changed to because thats what the level neighbours are identified by
        // Or level name works too
        function changeArea(playerWorldData,iid,connectionId = null){
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
                            updatePlayerLocation(playerWorldData);
                            break;
                        }
                    }
                }
                for(let i=0;i<levels[globalWorldData.levelNum].entities.length;i++){
                    if(lev.entities[i].type === "enemy"){
                        let enemy = lev.entities[i];
                        let enemyInfo = enemyFileData[enemy.fileDataIndex];
                        enemy.hp = enemy.maxHp = enemyInfo.hp;

                        if(lev.levelType === "dungeon"){
                            let tileNum = getTileNum(lev,enemy.location[0],enemy.location[1]);
                            enemy.dungeonRoom = lev.roomsGrid[tileNum];
                        }

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

        let applyUpkeepEffects = function(){
            let poisonDamageTaken = 0;

            // First, apply effects
            for(let i=0;i<playerConditions.length;i++){
                let condition = playerConditions[i];
                let conditionFileInfo = conditionData[condition.id];
                if(conditionFileInfo.name === "Lizard Toxin"){
                    poisonDamageTaken++;
                    condition.turnsLeft--;
                    updateHunger(playerStatData,playerConditions,2);
                }
            }
    
            if(poisonDamageTaken>0){
                if(playerTakeDamage(playerStatData,dialogue,poisonDamageTaken)){
                    dialogue = initializeDialogue("death","standard",timeStamp);
                }
                addIngameLogLine(`Took ${poisonDamageTaken} poison damage.`,78,100,40,1.5,timeStamp);
            }

            // Lastly, remove conditions that are ready for removal.
            let newConditions = [];
            let isUpdateNecessary = false;
            for(let i=0;i<playerConditions.length;i++){
                let condition = playerConditions[i];
                let conditionFileInfo = conditionData[condition.id];
                if(condition.turnsLeft<=0){
                    isUpdateNecessary = true;
                } else {
                    newConditions.push(condition);
                }
            }
    
            if(isUpdateNecessary){
                playerConditions = newConditions;
                sortPlayerConditions(playerConditions);
                updateConditionTooltips(playerConditions);
            }
        }
    
        let applyPlayerActionEffect = function(){
            let enemy = combat.enemy;
            let enemyInfo = enemyFileData[enemy.fileDataIndex];
    
            let damage = Math.min(Math.round(playerStatData.combatData.attackPower),enemy.hp);
            enemy.hp -= damage;
            globalPlayerStatisticData.totalDamageDealt+=damage;
            addIngameLogLine(`Mari ${enemyInfo.receivingRegularAttackMessage} dealing ${damage} damage!`,0,100,100,1.5,timeStamp);
    
            if(enemy.hp<=0){
                addIngameLogLine(`Mari has defeated a ${enemyInfo.name}!`,130,100,65,0.65,timeStamp);
                enemy.ephemeral = true;
                enemy.visible = false;
                combat.status = "enemy defeated";
                globalPlayerStatisticData.enemiesDefeated++;
            }
    
            applyUpkeepEffects();
    
            combat.playerActionEffectApplied = true;
        }
    
        let applyEnemyActionEffect = function(){
            let enemy = combat.enemy;
            let enemyInfo = enemyFileData[enemy.fileDataIndex];
            let action = combat.currentEnemyAction.actionInfo;
    
            if(playerTakeDamage(playerStatData,dialogue,action.power)){
                dialogue = initializeDialogue("death","standard",timeStamp);
            }
            addIngameLogLine(action.text.replace("{damage}", action.power),0,90,70,1.5,timeStamp);
    
            if(action.condition !== undefined){
                let newCondition = {
                    id: action.condition.id,
                    turnsLeft: action.condition.minDuration + Math.floor(Math.random()*(action.condition.maxDuration+1-action.condition.minDuration)),
                }
                addCondition(playerConditions,newCondition);
                sortPlayerConditions(playerConditions);
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

            let beginRegularKanjiTrial = function(specialTrialsLeft){
                timeUntilDysymbolia = -1;
                let kanjiPlayerInfo = null;
                if(specialTrialsLeft>0){
                    kanjiPlayerInfo = getNextKanji(playerKanjiData,true);
                } else {
                    kanjiPlayerInfo = getNextKanji(playerKanjiData);
                }
                let kanjiFileInfo = kanjiFileData[kanjiPlayerInfo.index];
                let specialParticleSystem = {
                    hue: [0], saturation: [30], lightness: [80],
                    particlesPerSec: 15, drawParticles: 0, newParticle: 1,
                    particleSize: 4, particleLifespan: 1400, particleSpeed: 20,
                    specialDrawLocation: true,
                };
                
                if(kanjiPlayerInfo.srsCategory===0){
                    specialParticleSystem.hue = [185,300]; 
                    specialParticleSystem.saturation = [80,80];
                    specialParticleSystem.lightness = [75,75];
                    specialParticleSystem.particleLifespan = 1900;
                    specialParticleSystem.particleSize = 3;
                    specialParticleSystem.particlesPerSec = 30;
                } else if(kanjiPlayerInfo.srsCategory===2){
                    let masteryHsla = masteryStageColors[kanjiPlayerInfo.masteryStage];
                    specialParticleSystem.hue = masteryHsla[0]; 
                    specialParticleSystem.saturation = masteryHsla[1];
                    specialParticleSystem.lightness = masteryHsla[2];
                    specialParticleSystem.particleLifespan = 1900;
                    specialParticleSystem.particleSize = 5;
                    specialParticleSystem.particlesPerSec = 12;
                }
                particleSystems.push(createParticleSystem(specialParticleSystem));
                dialogue.cinematic = newDysymboliaCinematic(timeStamp,1,dialogue.cinematic.trialsLeft,[kanjiFileInfo.symbol,[kanjiFileInfo.keyword.toLowerCase()],"white",kanjiFileInfo.symbol,kanjiPlayerInfo.index],dialogue.cinematic.startTime,dialogue.cinematic.trialedKanjiIndexes,dialogue.cinematic.specialTrialsLeft);

                dialogue.textLines[dialogue.currentLine] = dialogue.textLines[dialogue.currentLine] + " " + kanjiFileInfo.symbol + "...";
                globalInputData.inputtingText = true;
                globalInputData.finishedInputtingText = false;
                globalInputData.textEntered = "";

                return;
            }
            
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
                        timeUntilDysymbolia = playerStatData.autoDysymboliaInterval;
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
                                    currentTooltip = null;
                            }
                        }
                        if(dialogue.scenario.includes("tutorial") || dialogue.category === "randomDysymbolia"){
                            if(globalPlayerStatisticData.totalPowerGained <= 5){
                                dialogue = initializeDialogue("scenes","post dysymbolia "+globalPlayerStatisticData.totalPowerGained,timeStamp);
                            } else {
                                dialogue = endDialogue(timeStamp);
                            }
                        } else if(dialogue.category === "abilityAcquisition"){
                            
                            if(dialogue.trialFailureCount === 0){
                                // Phase 4 where we play the animation acquired cinematic
                                dialogue.cinematic.phaseNum = 4;
                                dialogue.textLines[dialogue.currentLine] = dialogue.scenario;
                                dialogue.cinematic.animationFinished = false;
                                dialogue.cinematic.tooltipsRegistered = false;

                                dialogue.cinematic.phaseStartTime = timeStamp;
                            } else {
                                dialogue.cinematic = null;
                                dialogue.trialFailureCount = 0;
                                advanceDialogueState();
                            }
                        } else {
                            //dialogue = endDialogue(timeStamp);
                            dialogue.cinematic = null;
                            advanceDialogueState();
                        }
                        return;
                    }

                    if(dialogue.cinematic.trialsLeft > 0){
                        beginRegularKanjiTrial(dialogue.cinematic.specialTrialsLeft);
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
                    
                    // im sorry future me but too bad
                    let specialKanjiIndex = abilityFileData[playerAbilityData.acquiringAbility].specialKanji.length - dialogue.cinematic.specialTrialsLeft;

                    let kanjiPlayerInfo = playerKanjiData.kanjiList[abilityFileData[playerAbilityData.acquiringAbility].specialKanji[specialKanjiIndex]];
                    let kanjiFileInfo = kanjiFileData[kanjiPlayerInfo.index];
                    dialogue.cinematic = newDysymboliaCinematic(timeStamp,1,dialogue.cinematic.trialsLeft,[kanjiFileInfo.symbol,[kanjiFileInfo.keyword.toLowerCase()],"white",kanjiFileInfo.symbol,kanjiPlayerInfo.index],dialogue.cinematic.startTime,dialogue.cinematic.trialedKanjiIndexes,dialogue.cinematic.specialTrialsLeft);

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

                    playerStatData.power -= abilityInfo.acquisitionPower;
                    playerAbilityInfo.acquired = true;
                    playerAbilityData.acquiredAbilities[abilityInfo.name] = true;
                    playerAbilityData.acquiringAbility = null;
                    game.acquisitionButtonParticleSystem.temporary = true;
                    game.acquisitionButtonParticleSystem.particlesLeft = 0;

                    if(abilityInfo.name === "Basic Dysymbolia Mastery"){
                        playerAbilityData.canManuallyTriggerDysymbolia = true;
                    } else if(abilityInfo.name === "Body Strengthen"){
                        playerStatData.baseStats.combatBaseStats[1][1]+=1;
                        updateModifiers(playerStatData);
                    } else if(abilityInfo.name === "Limit Break"){
                        playerStatData.powerSoftcap+=5;
                    }


                    dialogue.cinematic = null;
                    blur = 0;

                    for(let i = tooltipBoxes.length-1;i>=0;i--){
                        if(tooltipBoxes[i].type === "dictionary" || tooltipBoxes[i].type === "kanji"){
                            tooltipBoxes.splice(i,1);
                            currentTooltip = null;
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
                if(dialogue.currentLine>=0 && dialogue.lineInfo[dialogue.currentLine].playerResponses){
                    let lineInfo = dialogue.lineInfo[dialogue.currentLine];
                    if(lineInfo && lineInfo.selectedResponse !== undefined){
                        applyConditionalEffect(lineInfo.responseEffects[lineInfo.selectedResponse],lineInfo);
                    }
                    if(dialogue === null){
                        return;
                    }
                }
    
                if(advanceToNextLine && dialogue.textLines.length <= dialogue.currentLine+1){
                    // Finish dialogue if no more line
                    dialogue = endDialogue(timeStamp);
                } else {
                    // Otherwise advance line
                    dialogue.lineStartTime = timeStamp;

                    if(advanceToNextLine){
                        dialogue.currentLine++;
                    }
    
                    if(dialogue.lineInfo[dialogue.currentLine].takeEnemyTurn !== undefined){
                        combat = takeEnemyActions(playerWorldData, timeStamp, roomEnemies, combat);
                        dialogue = endDialogue(timeStamp);
                        return;
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
                    if(dialogue.lineInfo[dialogue.currentLine].takeBerries !== undefined){
                        updateInventory(playerInventoryData, lev.entities[dialogue.entityIndex].berries + " Berries");
                        lev.entities[dialogue.entityIndex].berries = null;
                        addIngameLogLine("Mari collected the berries.",130,100,70,2,timeStamp);
                    }
                    if(dialogue.lineInfo[dialogue.currentLine].areaChange !== undefined){
                        changeArea(playerWorldData,dialogue.lineInfo[dialogue.currentLine].areaChange,dialogue.lineInfo[dialogue.currentLine].connectionId);
                    }
                    if(dialogue.lineInfo[dialogue.currentLine].berryGacha !== undefined){
                        let qualityFactor = 1 + (4 - dialogue.trialFailureCount);
                        let randomPool = [];
                        for(let i=0; i<itemData.length;i++ ){
                            let item = itemData[i];
                            if(item.subtypes.includes("berry")){
                                let rarityDifference = qualityFactor - item.gachaRarity;
                                let timesToAddToPool = 0;
                                if(rarityDifference === 5){
                                    timesToAddToPool = 2;
                                } else if(rarityDifference === 4){
                                    timesToAddToPool = 4;
                                } else if(rarityDifference === 3){
                                    timesToAddToPool = 7;
                                } else if(rarityDifference === 2){
                                    timesToAddToPool = 9;
                                } else if(rarityDifference === 1){
                                    timesToAddToPool = 11;
                                } else if(rarityDifference === 0){
                                    timesToAddToPool = 12;
                                } else if(rarityDifference === -1){
                                    timesToAddToPool = 5;
                                } else if(rarityDifference === -2){
                                    timesToAddToPool = 2;
                                } else if(rarityDifference === -3){
                                    timesToAddToPool = 1;
                                }
                                for(let j=0; j<timesToAddToPool;j++){
                                    randomPool.push(i);
                                }
                            }
                        }
                        if(randomPool.length > 0){
                            let result = randomPool[Math.floor(Math.random()*randomPool.length)];
                            lev.entities[dialogue.entityIndex].berries = itemData[result].name.split(" ")[0];
                            addIngameLogLine(`Grew ${lev.entities[dialogue.entityIndex].berries} Berries`,0,100,100,1.5,timeStamp);
                        } else {
                            addIngameLogLine(`Failed to add berry`,0,50,50,1,timeStamp);
                        }
                        
                    }
                    if(dialogue.lineInfo[dialogue.currentLine].fadeout !== undefined){
                        fadeout = {
                            fadeStartTime: timeStamp,
                            duration: dialogue.lineInfo[dialogue.currentLine].fadeout.duration,
                            isSkippable: dialogue.lineInfo[dialogue.currentLine].fadeout.isSkippable
                        }
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
    
                        dialogue.cinematic = newDysymboliaCinematic(timeStamp,0,1,lineInfo.dysymbolia);
    
                    } else if (lineInfo !== undefined && lineInfo.randomDysymbolia !== undefined){
                        dialogue.trialFailureCount = 0;

                        timeUntilDysymbolia = -1;
                        let kanjiPlayerInfo = getNextKanji(playerKanjiData);
                        let kanjiFileInfo = kanjiFileData[kanjiPlayerInfo.index];

                        let specialParticleSystem = {
                            hue: [0], saturation: [30], lightness: [80],
                            particlesPerSec: 15, drawParticles: 0, newParticle: 1,
                            particleSize: 4, particleLifespan: 1400, particleSpeed: 20,
                            specialDrawLocation: true,
                        };
                        
                        if(kanjiPlayerInfo.srsCategory===0){
                            specialParticleSystem.hue = [185,300]; 
                            specialParticleSystem.saturation = [80,80];
                            specialParticleSystem.lightness = [75,75];
                            specialParticleSystem.particleLifespan = 1900;
                            specialParticleSystem.particleSize = 3;
                            specialParticleSystem.particlesPerSec = 30;
                        } else if(kanjiPlayerInfo.srsCategory===2){
                            let masteryHsla = masteryStageColors[kanjiPlayerInfo.masteryStage];
                            specialParticleSystem.hue = masteryHsla[0]; 
                            specialParticleSystem.saturation = masteryHsla[1];
                            specialParticleSystem.lightness = masteryHsla[2];
                            specialParticleSystem.particleLifespan = 1900;
                            specialParticleSystem.particleSize = 5;
                            specialParticleSystem.particlesPerSec = 12;
                        }
                        specialParticleSystem.specialDrawLocation = true;
                        particleSystems.push(createParticleSystem(specialParticleSystem));
                        dialogue.cinematic = newDysymboliaCinematic(timeStamp,0,lineInfo.randomDysymbolia,[kanjiFileInfo.symbol,[kanjiFileInfo.keyword.toLowerCase()],"white",kanjiFileInfo.symbol,kanjiPlayerInfo.index]);
    
                        dialogue.textLines[dialogue.currentLine] = kanjiFileInfo.symbol + "...";
                    } else if (lineInfo !== undefined && lineInfo.abilityAcquisition !== undefined){
                        dialogue.trialFailureCount = 0;
    
                        let specialParticleSystem = dialogue.lineInfo[dialogue.currentLine].particleSystem;
                        specialParticleSystem.specialDrawLocation = true;
    
                        particleSystems.push(createParticleSystem(specialParticleSystem));
    
                        timeUntilDysymbolia = -1;
                        let kanjiPlayerInfo = getNextKanji(playerKanjiData,true);
                        let kanjiFileInfo = kanjiFileData[kanjiPlayerInfo.index];
                        dialogue.cinematic = newDysymboliaCinematic(timeStamp,0,lineInfo.normalTrials,[kanjiFileInfo.symbol,[kanjiFileInfo.keyword.toLowerCase()],"white",kanjiFileInfo.symbol,kanjiPlayerInfo.index],timeStamp,[],lineInfo.specialTrials);
    
                        dialogue.textLines[dialogue.currentLine] = kanjiFileInfo.symbol + "...";
                    }
                }
            }
        }
    
        const updateWorldScreen = function(){
            if(globalInputData.mouseDown && currentTooltip && currentTooltip.info.type === "condition" && currentTooltip.info.condition.id === 0 && playerAbilityData.canManuallyTriggerDysymbolia){
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
                                    addTrial(playerKanjiData,playerKanjiData.kanjiList[dialogue.cinematic.info[4]],true);
                                }

                            } else {
                                dialogue.cinematic.result = "fail";
                                if(dialogue.cinematic.info.length > 4){
                                    addTrial(playerKanjiData,playerKanjiData.kanjiList[dialogue.cinematic.info[4]],false);
                                    dialogue.trialFailureCount++;
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
                        if( (dialogue.cinematic.trialsLeft <= 0 && dialogue.category === "randomDysymbolia") || dialogue.category === "scenes"){
                            playerStatData.power = Math.min(playerStatData.powerSoftcap,playerStatData.power+1);
                            globalPlayerStatisticData.totalPowerGained++;
                        }
                        if(dialogue.cinematic.result === "pass") {
                            // TODO: add option to not auto advance the cinematic state when the player passes by pressing a different key or something
                            // when the player passes, skip the story check phase
                            if(dialogue.cinematic.trialsLeft > 0 || dialogue.cinematic.specialTrialsLeft > 0){
                                advanceDialogueState();
                            }
                        } else {
                            if(playerTakeDamage(playerStatData,dialogue,1)){
                                dialogue = initializeDialogue("death","standard",timeStamp);
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
                        }
                    }

                    // Handle phase 4 (wait for animation completion)
                    else if(dialogue.cinematic.animationFinished && dialogue.cinematic.phaseNum === 4){
                        dialogue.cinematic.phaseNum = 5;
                        dialogue.cinematic.phaseStartTime = timeStamp;
                    }
                }
                if(dialogue.currentLine < 0){
                    advanceDialogueState();
                }
            } else {
                // If not in an animation (like movement), check for movement input
                if(playerWorldData.animation===null){
                    playerWorldData.src = [32,spritesheetOrientationPosition[globalInputData.currentDirection]*32];
    
                    if(globalInputData.currentDirection === "Down" && globalInputData.downPressed){
                        let collision = isCollidingOnTile(playerWorldData.location[0],playerWorldData.location[1],"Down");
                        if(collision===null || collision === 12 || collision === 13 || collision === 14){
                            playerWorldData.location[1]+=32;
                            updatePlayerLocation(playerWorldData);
                            initializeAnimation("basic movement",playerWorldData,globalInputData.currentDirection);
                            globalPlayerStatisticData.stepCount++;
                        } else if (collision === "bounds"){
                            for(const n of levels[globalWorldData.levelNum].neighbours){
                                if(n.dir === "s"){
                                    changeArea(playerWorldData,n.levelIid);
                                    playerWorldData.location[1]=-32;
                                    break;
                                }
                            }
                        }
                    } else if(globalInputData.currentDirection === "Left" && globalInputData.leftPressed){
                        let collision = isCollidingOnTile(playerWorldData.location[0],playerWorldData.location[1],"Left");
                        if(collision===null || collision === 13 || collision === 15 || collision === 12){
                            playerWorldData.location[0]-=32;
                            initializeAnimation("basic movement",playerWorldData,globalInputData.currentDirection);
                            globalPlayerStatisticData.stepCount++;
                        } else if (collision === "bounds"){
                            for(const n of levels[globalWorldData.levelNum].neighbours){
                                if(n.dir === "w"){
                                    changeArea(playerWorldData,n.levelIid);
                                    playerWorldData.location[0]=18*32;
                                    break;
                                }
                            }
                        }
                    } else if(globalInputData.currentDirection === "Right" && globalInputData.rightPressed){
                        let collision = isCollidingOnTile(playerWorldData.location[0],playerWorldData.location[1],"Right");
                        if(collision===null || collision === 14 || collision === 15 || collision === 12){
                            playerWorldData.location[0]+=32;
                            initializeAnimation("basic movement",playerWorldData,globalInputData.currentDirection);
                            globalPlayerStatisticData.stepCount++;
                        } else if (collision === "bounds"){
                            for(const n of levels[globalWorldData.levelNum].neighbours){
                                if(n.dir === "e"){
                                    changeArea(playerWorldData,n.levelIid);
                                    playerWorldData.location[0]=-32;
                                    break;
                                }
                            }
                        }
                    } else if(globalInputData.currentDirection === "Up" && globalInputData.upPressed){
                        let collision = isCollidingOnTile(playerWorldData.location[0],playerWorldData.location[1],"Up");
                        if(collision===null || collision === 15 || collision === 13 || collision === 14){
                            playerWorldData.location[1]-=32;
                            initializeAnimation("basic movement",playerWorldData,globalInputData.currentDirection);
                            globalPlayerStatisticData.stepCount++;
                        } else if (collision === "bounds"){
                            for(const n of levels[globalWorldData.levelNum].neighbours){
                                if(n.dir === "n"){
                                    changeArea(playerWorldData,n.levelIid);
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
                    if(globalPlayerStatisticData.sceneCompletion["tutorial dungeon scene 2"]===0){
                        dialogue = initializeDialogue("scenes","tutorial dungeon scene 2",timeStamp);
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
                        combat = takeEnemyActions(playerWorldData, timeStamp, roomEnemies, combat);
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
            if(globalInputData.key2Clicked){
                globalInputData.key2Clicked = false;
            }
            if(globalInputData.key1Clicked){
                // Handle dialogue update on z press
                if(globalWorldData.chatting){

                } else if(dialogue !== null){
                    if(fadeout!==null && !fadeout.isSkippable){
                        let fadeProgress = (timeStamp - fadeout.fadeStartTime)/fadeout.duration;
                        if(fadeProgress > 1){
                            advanceDialogueState();
                        }
                    } else {
                        advanceDialogueState();
                    }
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
                            if(globalPlayerStatisticData.sceneCompletion["tutorial fruit scene"]){
                                dialogue = initializeDialogue("world","fruit_tree",timeStamp,collision.index);
                            } else if(!playerAbilityData.dysymboliaSuppressed){
                                dialogue = initializeDialogue("scenes","tutorial fruit scene",timeStamp,collision.index);
                                globalPlayerStatisticData.totalSceneDysymboliaExperienced++;
                            }
                        } else if(entity.id === "Berry_Bush"){
                            if(entity.berries !== null){
                                dialogue = initializeDialogue("world","berry_bush_collect",timeStamp,collision.index);
                            } else {
                                dialogue = initializeDialogue("world","berry_bush",timeStamp,collision.index);
                            }

                        } else if (entity.id === "Stairs") {
                            if(entity.connectionId === "first" && globalPlayerStatisticData.sceneCompletion["tutorial dungeon scene"]===0){
                                dialogue = initializeDialogue("scenes","tutorial dungeon scene",timeStamp);
                            } else {
                                if(!combat || !combat.currentEnemyAction){
                                    changeArea(playerWorldData,entity.areaDestination,entity.connectionId);
                                    if(globalPlayerStatisticData.enemiesDefeated === 0 && levels[globalWorldData.levelNum].identifier === "Floating_Island_Dungeon_0" && globalPlayerStatisticData.sceneCompletion["tutorial dungeon scene 3"]===0){
                                        dialogue = initializeDialogue("scenes","tutorial dungeon scene 3",timeStamp);
                                    }
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
                            if(globalInputData.currentDirection === "Down"){
                                entity.src[1] = spritesheetOrientationPosition.Up * 32;
                            } else if (globalInputData.currentDirection === "Right"){
                                entity.src[1] = spritesheetOrientationPosition.Left * 32;
                            } else if (globalInputData.currentDirection === "Left"){
                                entity.src[1] = spritesheetOrientationPosition.Right * 32;
                            } else {
                                entity.src[1] = spritesheetOrientationPosition.Down * 32;
                            }
                            if(combat !== null){
                                combat.currentPlayerAction = {
                                    actionInfo: "basic attack",
                                    startTime: timeStamp,
                                    enemyEntityIndex: collision.index,
                                };
                                combat.playerActionEffectApplied = false;
                            } else {
                                combat = {
                                    enemy: entity,
                                    currentEnemyAction: null,
                                    currentPlayerAction: {
                                        actionInfo: "basic attack",
                                        startTime: timeStamp,
                                        enemyEntityIndex: collision.index,
                                    },
                                    enemyActionEffectApplied: false,
                                    playerActionEffectApplied: false,
                                    turnCount: 0,
                                    status: "ongoing",
                                };
                            }
                        }
                    } else if(collision === 1){
                        if(globalPlayerStatisticData.sceneCompletion["tutorial water scene"]>0 || playerAbilityData.dysymboliaSuppressed){
                            dialogue = initializeDialogue("world","water",timeStamp);
                        } else {
                            dialogue = initializeDialogue("scenes","tutorial water scene",timeStamp);
                            globalPlayerStatisticData.totalSceneDysymboliaExperienced++;
                        }
                    } else if(collision === 7){
                        if(globalPlayerStatisticData.sceneCompletion["tutorial cloud scene"]>0 || playerAbilityData.dysymboliaSuppressed){
                            dialogue = initializeDialogue("world","clouds",timeStamp);
                        } else {
                            dialogue = initializeDialogue("scenes","tutorial cloud scene",timeStamp);
                            globalPlayerStatisticData.totalSceneDysymboliaExperienced++;
                        }
                    } else if(collision === 8){
                        dialogue = initializeDialogue("world","sunflower",timeStamp);
                    } else if(collision !== null){
                        console.warn("unknown collision type");
                    }
                }
                globalInputData.key1Clicked = false;
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

            // Update clouds
            cloudYOffset+=4/fps
            cloudXOffset+=2/fps
            if(cloudYOffset >= 32){
                cloudYOffset -= 32;
                for(let i=0; i<clouds.length;i++){
                    let splicedCloud = clouds[i].splice(0,1)[0];
                    clouds[i].push(splicedCloud);
                }
            }
            if(cloudXOffset >= 32){
                cloudXOffset -= 32;
                let splicedColumn = clouds.splice(0,1)[0];
                clouds.push(splicedColumn);
            }
            
        }; // Update world screen function ends here
    
        const updateMenuScreen = function(){
            if(globalWorldData.menuScene === "Kanji List"){
                if(globalInputData.mouseDown && currentTooltip && currentTooltip.info.type === "kanji list entry"){
                    globalWorldData.menuData.selectedKanji = currentTooltip.info.index;
                }
            } else if(globalWorldData.menuScene === "Theory"){
                if(globalInputData.mouseDown && currentTooltip && !globalWorldData.menuData.isReadingWriteup && globalWorldData.menuData.selectedWriteup !== currentTooltip.info.index && currentTooltip.info.type === "write-up entry"){
                    globalWorldData.menuData.selectedWriteup = currentTooltip.info.index;
                    initializeMenuTab();
                }
            } else if(globalWorldData.menuScene === "Abilities"){
                if(globalInputData.mouseDown && currentTooltip && draggingObject === null && globalWorldData.menuData.selectedAbility !== currentTooltip.info.index && currentTooltip.info.type === "ability menu ability"){
                    globalWorldData.menuData.selectedAbility = currentTooltip.info.index;
                    initializeMenuTab();
                }
            }
            globalInputData.key1Clicked = globalInputData.key2Clicked = false;
        };
    
        if(globalWorldData.menuScene !== null){
            updateMenuScreen();
        } else {
            updateWorldScreen();
        }
        if(globalWorldData.chatting && globalInputData.finishedInputtingText){
            globalWorldData.chatting = false;
            globalInputData.inputtingText = false;
            if(globalInputData.textEntered[0] !== '$'){
                addIngameLogLine(`Mari: ${globalInputData.textEntered}`,0,0,100,1,timeStamp);
            } else {
                // do command 
                let splitCommand = globalInputData.textEntered.split(' ');
                switch (splitCommand[0]) {
                    case '$fast':
                        if(movingAnimationDuration === 200){
                            movingAnimationDuration = 40;
                            globalWorldData.speedMode = true;
                        } else {
                            movingAnimationDuration = 200;
                            globalWorldData.speedMode = false;
                        }
                        break;
                    case '$power':
                        playerStatData.power+=parseInt(splitCommand[1]);
                        break;
                    case '$end':
                        dialogue = endDialogue(timeStamp);
                        timeUntilDysymbolia = playerStatData.autoDysymboliaInterval;
                        break;
                    case '$additem':
                        updateInventory(playerInventoryData, parseInt(splitCommand[1]));
                        break;
                    case '$master':
                        playerAbilityData.canManuallyTriggerDysymbolia = true;
                        break;
                    case '$hunger':
                        updateHunger(playerStatData,playerConditions,Number(splitCommand[1]));
                        break;
                    case '$timewarp':
                        // This command saves the game to slot 1 with all the dates shifted 24 hours behind
                        try {
                            let twentyfourHours = 24 * 60 * 60 * 1000;
                            for(let i=0;i<playerKanjiData.kanjiList.length;i++){
                                let kanji = playerKanjiData.kanjiList[i];
                                if(kanji.lastTrialDate !== null){
                                    kanji.lastTrialDate = new Date(kanji.lastTrialDate-twentyfourHours);
                                }
                                if(kanji.lastSignificantTrialDate !== null){
                                    kanji.lastSignificantTrialDate = new Date(kanji.lastSignificantTrialDate-twentyfourHours);
                                }
                            }
                            let save = game.outputSaveGame();
                            save.date = save.date - twentyfourHours;
                            localStorage.setItem("save 1",JSON.stringify(save));
                            alert("successfully saved a timewarped save to save 1, i hope");
                            break;
                        }
                        catch (err) {
                            alert("timewarp save entirely or partially failed: "+err);
                        }
                    default:
                        addIngameLogLine(`Unknown command`,0,50,50,1,timeStamp);
                        break;
                }
            }
            globalInputData.textEntered = "";
        }
        if(globalInputData.key3Clicked){
            if(globalWorldData.chatting){

            } else if(!globalInputData.inputtingText){
                globalWorldData.chatting = true;
                globalInputData.inputtingText = true;
                globalInputData.finishedInputtingText = false;
                globalInputData.textEntered = "";
            }
            globalInputData.key3Clicked = false;
        }
        if(globalInputData.doubleClicked){
            if(currentTooltip!== null){
                let tooltip = currentTooltip.info;
                if(tooltip.type === "item"){
                    useItem(playerInventoryData,playerStatData,playerConditions,tooltip.inventoryIndex);
                    updateInventory(playerInventoryData,"none",globalWorldData.menuScene==="Inventory");
                    particleSystems.push(createParticleSystem({hue:120,saturation:100,lightness:50,x:tooltip.x + tooltip.width/2, y:tooltip.y + tooltip.height/2, temporary:true, particlesLeft:10, particleSpeed: 200, particleAcceleration: -100, particleLifespan: 2000}));
                }
                if(tooltip.type === "ability"){
                    if(playerAbilityData.equippedAbilities[tooltip.slotNum] !== null){
                        let activationResult = activateAbility(playerWorldData,playerAbilityData,playerStatData,playerAbilityData.equippedAbilities[tooltip.slotNum],timeStamp);
                        if(activationResult[0]){
                            particleSystems.push(createParticleSystem({hue:120,saturation:100,lightness:50,x:tooltip.x + tooltip.width/2, y:tooltip.y + tooltip.height/2, temporary:true, particlesLeft:10, particleSpeed: 200, particleAcceleration: -100, particleLifespan: 2000}));
                        }
                        if(activationResult[1] !== null){
                            dialogue = activationResult[1];
                        }
                    }
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
            const cameraSpecialTile = function(image,src,x,y){
                if(x-camX > -33 && x-camX < w && y-camY > -33 && y-camY < h){
                    //drawTile(type, src, globalWorldData.worldX+x*globalWorldData.sizeMod-camX*globalWorldData.sizeMod, globalWorldData.worldY+y*globalWorldData.sizeMod-camY*globalWorldData.sizeMod,32,globalWorldData.sizeMod);
                    context.drawImage(image, src[0], src[1], 32, 32, globalWorldData.worldX+x*globalWorldData.sizeMod-camX*globalWorldData.sizeMod, globalWorldData.worldY+y*globalWorldData.sizeMod-camY*globalWorldData.sizeMod, 32*globalWorldData.sizeMod, 32*globalWorldData.sizeMod);
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
                } else if(layer.name === "Cloud_Tiles") {
                    for (let t of layer.tiles){
                        cameraTile(i, clouds[t.px[0]/32][t.px[1]/32], t.px[0]-cloudXOffset, t.px[1]-cloudYOffset,camX,camY);
                    }
                    if(lev.identifier === "Floating_Island_0"){
                        //draw south border of clouds
                        for (let j=0; j<clouds[0].length; j++){
                            cameraTile(i, clouds[j][clouds.length-1], j*32-cloudXOffset, (clouds.length-1)*32-cloudYOffset,camX,camY);
                        }
                        // draw west border of clouds
                        for (let j=0; j<clouds.length-1; j++){
                            cameraTile(i, clouds[clouds.length-1][j], (clouds.length-1)*32-cloudXOffset, j*32-cloudYOffset,camX,camY);
                        }
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
                if(bush.berries === null){
                    cameraTile(tilesetNum,[bitrate,bitrate*3],x,y,camX,camY);     
                } else if (bush.berries === "Red"){
                    cameraTile(tilesetNum,[0,bitrate*3],x,y,camX,camY);
                } else if (bush.berries === "Blue"){
                    cameraSpecialTile(miscImages.bbush,[0,0],x,y,camX,camY);
                } else if (bush.berries === "Yellow"){
                    cameraSpecialTile(miscImages.ybush,[0,0],x,y,camX,camY);
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
    
            let applyBlurAndFade = function(){
                
                if (blur > 0) {
                    context.filter = `blur(${blur}px)`;

                    context.drawImage(canvas,
                        globalWorldData.worldX, globalWorldData.worldY, globalWorldData.worldX+18*16*2*globalWorldData.sizeMod, globalWorldData.worldY+18*16*2*globalWorldData.sizeMod,
                        globalWorldData.worldX, globalWorldData.worldY, globalWorldData.worldX+18*16*2*globalWorldData.sizeMod, globalWorldData.worldY+18*16*2*globalWorldData.sizeMod,
                     );

                    context.filter = "none";
                }
                
                if(fadeout !== null){
                    let fadeProgress = (timeStamp - fadeout.fadeStartTime)/fadeout.duration;
                    context.fillStyle = `hsla(0, 0%, 0%, ${fadeProgress})`;
                    context.fillRect(globalWorldData.worldX, globalWorldData.worldY, w*globalWorldData.sizeMod, h*globalWorldData.sizeMod);
                }
            }
    
            // Draw dialogue
            if(dialogue !== null && dialogue.currentLine >= 0){
    
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
    
    
                // Draw differently depending on player vs non-player vs no image
                const drawDialogueForPlayer = function(facesImage){
                    context.drawImage(facesImage, (faceNum%4)*faceBitrate, Math.floor(faceNum/4)*faceBitrate, faceBitrate, faceBitrate, globalWorldData.worldX, globalWorldData.worldY+(h*globalWorldData.sizeMod)-96*globalWorldData.sizeMod, 96*globalWorldData.sizeMod, 96*globalWorldData.sizeMod);
                    applyBlurAndFade();
    
                    if(dialogue.cinematic !== null && dialogue.cinematic.type === "dysymbolia" && dialogue.cinematic.trialsLeft < 1 && dialogue.cinematic.phaseNum === 3 && !dialogue.cinematic.tooltipsRegistered){
                        if(dialogue.cinematic.info.length > 4){
                            // TODO: figure out a way to refactor so this step isnt needed i swear
                            let tooltipTargets = [];
                            for(let i=0;i<dialogue.cinematic.trialedKanjiIndexes.length;i++){
                                tooltipTargets.push(kanjiFileData[dialogue.cinematic.trialedKanjiIndexes[i]].symbol);
                            }
                            context.fillStyle = textColor;
                            drawDialogueText(dialogue,(96+18)*globalWorldData.sizeMod+globalWorldData.worldX, (globalWorldData.worldY+h*globalWorldData.sizeMod-72*globalWorldData.sizeMod),(w*globalWorldData.sizeMod-124*globalWorldData.sizeMod),20*globalWorldData.sizeMod,timeStamp,
                                {
                                    width: dialogueFontSize, height: 20*globalWorldData.sizeMod,
                                    type: "kanji", indexes: dialogue.cinematic.trialedKanjiIndexes,
                                    tooltipTargets: tooltipTargets,
                                }
                            );
                            note = "Hover your mouse over the kanji to review.";
                        } else {
                            context.fillStyle = textColor;
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
                        context.fillStyle = textColor;
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
                        context.fillStyle = textColor;
                        drawDialogueText(dialogue,(96+18)*globalWorldData.sizeMod+globalWorldData.worldX, (globalWorldData.worldY+h*globalWorldData.sizeMod-72*globalWorldData.sizeMod),(w*globalWorldData.sizeMod-124*globalWorldData.sizeMod),20*globalWorldData.sizeMod,timeStamp);
                    }
                };
                const drawDialogueForNonPlayer = function(facesImage){
                    context.save();
                    context.scale(-1,1);
                    context.drawImage(facesImage, (faceNum%4)*faceBitrate, Math.floor(faceNum/4)*faceBitrate, faceBitrate, faceBitrate, -1*(globalWorldData.worldX+w*globalWorldData.sizeMod), globalWorldData.worldY+h*globalWorldData.sizeMod-96*globalWorldData.sizeMod, 96*globalWorldData.sizeMod, 96*globalWorldData.sizeMod);
                    context.restore();
                    applyBlurAndFade();
                    context.fillStyle = textColor;
                    drawDialogueText(dialogue,(8+18)*globalWorldData.sizeMod+globalWorldData.worldX,globalWorldData.worldY+h*globalWorldData.sizeMod-72*globalWorldData.sizeMod,w*globalWorldData.sizeMod-144*globalWorldData.sizeMod,20*globalWorldData.sizeMod,timeStamp);
                };
                const drawDialogueForNobody = function(){
                    applyBlurAndFade();
                    context.fillStyle = textColor;
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
                        if(dialogue.scenario.includes("tutorial")){
                            context.fillText("English meaning:", globalWorldData.worldX + w*globalWorldData.sizeMod/2, globalWorldData.worldY + (h-100)*globalWorldData.sizeMod/2);
                        } else {
                            context.fillText("Enter keyword:", globalWorldData.worldX + w*globalWorldData.sizeMod/2, globalWorldData.worldY + (h-100)*globalWorldData.sizeMod/2);
                        }
    
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
                        if(dialogue.scenario.includes("tutorial")){
                            context.fillText("English meaning:", globalWorldData.worldX + w*globalWorldData.sizeMod/2, globalWorldData.worldY + (h-100)*globalWorldData.sizeMod/2);
                        } else {
                            context.fillText("Enter keyword:", globalWorldData.worldX + w*globalWorldData.sizeMod/2, globalWorldData.worldY + (h-100)*globalWorldData.sizeMod/2);
                        }
    
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
                        let kanjiInfo = kanjiFileData[c.info[4]];
    
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
            //context.fillText("Press Z to interact/continue dialogue",globalWorldData.worldX+100, globalWorldData.worldY+40+h*globalWorldData.sizeMod);
    
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
            context.fillText(globalWorldData.menuScene, globalWorldData.worldX+345 + 150, globalWorldData.worldY+80);
    
            // Each menu tab has its local function
            const drawInventoryScreen = function(){
                context.font = '18px zenMaruRegular';
                context.fillText("First 5 items can be used on the inventory hotbar!", globalWorldData.worldX+345 + 150, globalWorldData.worldY+580);
                context.fillText("Double click to use consumables!", globalWorldData.worldX+345 + 150, globalWorldData.worldY+630);
                context.fillText("Crafting coming soon?!????!??!!?", globalWorldData.worldX+345 + 150, globalWorldData.worldY+680);

                for(let i=0;i<globalMenuTabUiElements.length;i++){
                    let uiElement = globalMenuTabUiElements[i];
                    if(uiElement.type === "inventory slot"){
                        drawInventorySlot(uiElement,playerInventoryData);
                    }
               }
  
               /*
                for(let i=0;i<Math.ceil(playerInventoryData.inventory.length/5);i++){
                    for(let j=0;j<5;j++){
                        context.lineWidth = 2;
                        context.strokeStyle = 'hsla(270, 60%, 75%, 0.6)';
                        context.fillStyle = 'black';
                        context.beginPath();
                        context.roundRect(globalWorldData.worldY+285+105+67*j, globalWorldData.worldY+160 + 67*i, 60, 60, 3);
                        context.fill();
                        context.stroke();
    
                        if(playerInventoryData.inventory[j + i*5] !== "none" && (draggingObject === null || draggingObject.inventoryIndex !== j + i*5)){
                            context.save();
                            context.translate(globalWorldData.worldY+285+105+67*j,globalWorldData.worldY+160 + 67*i);
                            context.scale(1.4,1.4);
                            drawItemIcon(playerInventoryData.inventory[j + i*5],-1,-1);
                            context.restore();
                        }
                    }
                }*/
    
                if(draggingObject){
                    let offsetX = globalInputData.mouseX - draggingObject.clickX, offsetY = globalInputData.mouseY - draggingObject.clickY;
    
                    context.save();
                    context.translate(draggingObject.originalX+offsetX,draggingObject.originalY+offsetY);
                    context.scale(1.4,1.4);
                    drawItemIcon(draggingObject.item,-1,-1);
                    context.restore();
                }
            } // Draw inventory screen function ends here
    
            const drawKanjiScreen = function(){
                context.font = '26px Arial';
                context.textAlign = 'left';
                context.fillStyle = 'white';
    
                let rowAmount = 12;
                for(let i=0;i<Math.ceil(kanjiFileData.length/rowAmount);i++){
                    for(let j=0; j<Math.min(rowAmount,kanjiFileData.length-i*rowAmount);j++){
                        let currentIndex = j + i*rowAmount;
                        let kanjiInfo = playerKanjiData.kanjiList[currentIndex];      
    
                        context.lineWidth = 2;
                        let textFill = 'white';
                        // Change colors based on the kanji info
                        if(globalWorldData.menuData.selectedKanji === currentIndex){
                            context.strokeStyle = 'hsla(60, 100%, 100%, 1)';
                            context.lineWidth = 4;
                            if(!playerKanjiData.kanjiList[currentIndex].enabled){
                                textFill = 'hsla(0, 0%, 60%, 1)';
                            }
                        } else if(kanjiInfo.enabled){
                            let masteryHsla = masteryStageColors[kanjiInfo.masteryStage];
                            context.strokeStyle = `hsla(
                                ${masteryHsla[0]},
                                ${masteryHsla[1]}%,
                                ${masteryHsla[2]}%,
                                1
                            )`;
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
                        context.fillText(kanjiFileData[currentIndex].symbol,globalWorldData.worldX+240+45*j + 6,globalWorldData.worldY+140 + 45*i + 30)
                    }
                }
    
                // Draw kanji info on side of screen
                if(globalWorldData.menuData.selectedKanji !== null){
                    let kanjiInfo = kanjiFileData[globalWorldData.menuData.selectedKanji];
                    let playerKanjiInfo = playerKanjiData.kanjiList[globalWorldData.menuData.selectedKanji];
    
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
                    /*if(playerKanjiInfo.srsCategory === 2 && playerKanjiInfo.srsCategoryInfo.interval > 0){
                        context.font = '16px zenMaruRegular';
                        context.fillText("Increase mastery in " + playerKanjiInfo.daysUntilMasteryIncreaseOpportunity + " days", globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, belowStoryY+95);
                    } else {
                        context.font = '16px zenMaruBold';
                        context.fillText("Capture to increase mastery!", globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, belowStoryY+95);
                    }*/
    
    
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
    
                if(!globalWorldData.menuData.isReadingWriteup){
                    let listPosition = 0;
                    for(let i=0;i<theoryWriteupData.length;i++){
                        if(!playerTheoryData[i].listed){
                            continue;
                        } 

                        let theory = theoryWriteupData[i];                     
                        
                        
                        if(globalWorldData.menuData.selectedWriteup === i){
                            context.lineWidth = 4;
                            context.strokeStyle = 'hsla(60, 100%, 100%, 1)';
                        } else {
                            context.lineWidth = 2;
                            if(playerTheoryData[i].unlocked){
                                context.strokeStyle = 'hsla(300, 75%, 75%, 1)';
                            } else {
                                context.strokeStyle = 'hsla(0, 0%, 60%, 1)';
                            }
    
                        }
                        
                        //context.fillStyle = 'hsla(0, 0%, 30%, 1)';
                        context.fillStyle = 'black';
                        context.beginPath();
                        context.roundRect(globalWorldData.worldX+240, globalWorldData.worldY+140 + 45*listPosition, w-55, 40, 5);
                        context.fill();
                        context.stroke();
    
                        context.fillStyle = 'white';
                        context.fillText(theory.title,globalWorldData.worldX+240 + 15,globalWorldData.worldY+140 + 45*listPosition + 27);
    
                        if(!playerTheoryData[i].unlocked){
                            if(playerTheoryData[i].conditionsMet){
                                context.drawImage(miscImages.checklock,globalWorldData.worldX+240+w-55-35,globalWorldData.worldY+140 + 45*listPosition + 7,21,25);
                            } else {
                                context.drawImage(miscImages.whitelock,globalWorldData.worldX+240+w-55-35,globalWorldData.worldY+140 + 45*listPosition + 7,21,25);
                            }
                        }

                        listPosition++;
                    }
    
                } else {
                    context.font = '18px ZenMaruRegular';
                    let writeupInfo = theoryWriteupData[globalWorldData.menuData.selectedWriteup];
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
    
                if(globalWorldData.menuData.selectedWriteup !== null){
                    let writeupInfo = theoryWriteupData[globalWorldData.menuData.selectedWriteup];
    
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
                        currentY += wrappedText.length*18+15;
                    }
    
                    // unlock rewards
                    context.font = '17px zenMaruMedium';
                    context.fillText("Unlock Rewards", globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, globalWorldData.worldY+currentY+28);
    
                    context.fillStyle = 'hsl(0, 100%, 100%, 40%)';
                    context.fillRect(globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 90, globalWorldData.worldY+currentY+28+13, 300-180, 2);
    
                    context.font = '16px zenMaruRegular';
                    context.fillStyle = 'white';
                    context.textAlign = 'center';
                    let rewardText = writeupInfo.rewardText;
                    if(playerTheoryData[globalWorldData.menuData.selectedWriteup].unlocked){
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
                context.fillStyle = 'white';
                context.font = '18px zenMaruRegular';
                context.textAlign = 'center';

                //context.fillText("Changes to equipped abilities apply after menu is closed ", globalWorldData.worldX+345 + 150, globalWorldData.worldY+680);
                context.font = '20px ZenMaruRegular';
                context.textAlign = 'left';
    
                let currentY = 135;
    
                // Draw ability bar
                /*
                for(let i=0;i<playerAbilityData.abilitySlots;i++){
                    if(playerAbilityData.equippedAbilities[i] !== null && (draggingObject === null || draggingObject.index !== i)){
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
                }*/
                for(let i=0;i<globalMenuTabUiElements.length;i++){
                    let uiElement = globalMenuTabUiElements[i];
                    if(uiElement.type === "ability slot"){
                        drawAbilitySlot(uiElement,playerAbilityData);
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
    
                        if(globalWorldData.menuData.selectedAbility === currentIndex){
                            context.strokeStyle = 'hsla(60, 100%, 100%, 1)';
                            context.lineWidth = 3;
                        } else {
                            context.strokeStyle = 'hsla(0, 30%, 60%, 1)';
                            context.lineWidth = 2;
                        }
    
                        
                        context.beginPath();
                        context.roundRect(globalWorldData.worldX+247+250-currentRowWidth*25+50*j, globalWorldData.worldY+currentY+70+50*i, 45, 45, 3);
                        context.stroke();
                    }
                }
    
                if(globalWorldData.menuData.selectedAbility !== null){
                    // Draw ability information on the right side
                    let playerAbilityInfo = playerAbilityData.list[globalWorldData.menuData.selectedAbility];
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
                            currentY += wrappedText.length*18+5;
                        }
                        currentY += 25;
                        if(playerAbilityInfo.unlocked){
                            context.font = '19px zenMaruMedium';
                            context.fillStyle = "#d600ba";
                            context.fillText(`${playerStatData.power}/${abilityInfo.acquisitionPower} power to acquire!`, globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, globalWorldData.worldY+currentY+28);
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
    
                        if(combat === null){
                            context.font = '18px zenMaruMedium';
                            context.fillText("Drag to Equip!", globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, globalWorldData.worldY+710);
                        } else {
                            context.font = '14px zenMaruMedium';
                            context.fillText("Cannot equip mid-combat.", globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, globalWorldData.worldY+710);
                        }
                        
                    }
                }
    
                if(draggingObject){
                    let offsetX = globalInputData.mouseX - draggingObject.clickX, offsetY = globalInputData.mouseY - draggingObject.clickY;
                    context.drawImage(abilityIcons[ playerAbilityData.list[draggingObject.abilityIndex].index ],draggingObject.originalX+offsetX,draggingObject.originalY+offsetY,45,45);
                }
            } // Draw ability screen function ends here

            const drawSaveScreen = function(){
                if(globalWorldData.menuData.loadStatement !== null){
                    let ls = globalWorldData.menuData.loadStatement;

                    context.font = '18px zenMaruRegular';
                    context.fillText("Welcome back to the world of unnamed kanji game!", globalWorldData.worldX+345 + 150, globalWorldData.worldY+140);
                    context.fillText(`You have been away for ${ls.dayDifference} days, ${ls.hourRemainder} hours, and ${ls.minuteRemainder} minutes.`, globalWorldData.worldX+345 + 150, globalWorldData.worldY+190);
                    context.fillText(`There are ${playerKanjiData.reviewsDue} kanji due for review.`, globalWorldData.worldX+345 + 150, globalWorldData.worldY+220);
                }
            } // Draw save screen function ends here
    
            if(globalWorldData.menuScene === "Inventory"){
                drawInventoryScreen();
            } else if(globalWorldData.menuScene === "Kanji List"){
                drawKanjiScreen();
            } else if(globalWorldData.menuScene === "Theory"){
                drawTheoryScreen();
            } else if(globalWorldData.menuScene === "Abilities"){
                drawAbilityScreen();
            } else if(globalWorldData.menuScene === "Save"){
                drawSaveScreen();
            }
        }
    
        if(globalWorldData.menuScene !== null){
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
    
                if(globalWorldData.menuScene !== null){
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
        if(globalWorldData.sidebar === "status"){
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
            context.font = '20px zenMaruMedium';
            context.fillText("Inventory", globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 150, globalWorldData.worldY+660);
    
            // Draw ui elements
           for(let i=0;i<globalStatusBarUiElements.length;i++){
                let uiElement = globalStatusBarUiElements[i];
                if(uiElement.type === "inventory slot"){
                    drawInventorySlot(uiElement,playerInventoryData);
                } else if(uiElement.type === "ability slot"){
                    drawAbilitySlot(uiElement,playerAbilityData);
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
            context.fillText(playerStatData.combatData.hp+"/"+playerStatData.combatData.maxHp, globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 20+context.measureText("HP: ").width, globalWorldData.worldY+140);
    
            context.fillStyle = "#d600ba";
            context.fillText(playerStatData.power+"/"+playerStatData.powerSoftcap, globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 20+context.measureText("Power: ").width, globalWorldData.worldY+165);
    
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
                const c = playerConditions[i];
                const cInfo = conditionData[c.id];
                let cColor = c.color;
                if(cColor === undefined){
                    cColor = cInfo.color;
                }
                context.font = '18px zenMaruMedium';
    
                if( (conditionLine + cInfo.name).length > "Conditions: Dysymbolia, Hunger, aa".length){
                    conditionLine = "";
                    conditionLineNum++;
                }
    
                let conditionX = globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 20+context.measureText(conditionLine).width;
                let conditionY = globalWorldData.worldY+210+24*conditionLineNum;
    
                // Handle special drawing for the dysymbolia condition
                if(cInfo.name === "Dysymbolia" && timeUntilDysymbolia < playerStatData.autoDysymboliaInterval/2){
                    context.font = `18px zenMaruBlack`;
                    if(c.particleSystem === null){
                        c.particleSystem = createParticleSystem({
                            x: [conditionX,conditionX+context.measureText(cInfo.name).width], y:[conditionY,conditionY], hue: 0, saturation: 0, lightness: 100, startingAlpha: 0.005,
                            particlesPerSec: 50, drawParticles: drawParticlesTypeZero, newParticle: newParticleTypeTwo,
                            particleSize: 5, particleLifespan: 450, mod: 1.2, shift: 1.3, particleSpeed: 120, gravity: -300,
                            sourceType: "line", specialDrawLocation: true,
                        });
                        particleSystems.push(c.particleSystem);
                    }
                    let ps = c.particleSystem;
                    if(timeUntilDysymbolia > -1){
                        let advancement = (playerStatData.autoDysymboliaInterval/2 - timeUntilDysymbolia)/(playerStatData.autoDysymboliaInterval);
                        ps.startingAlpha = advancement/1.5;
                        ps.particleLifespan = 250 + 300*advancement;
                        ps.particlesPerSec = 40 + 70*advancement;
                        ps.particleSize = 6;
                        ps.particleSpeed = 60 + 200*advancement;
                        ps.lightness = 100;
    
                        c.color = `hsl(0,0%,${timeUntilDysymbolia*(playerStatData.autoDysymboliaInterval/18)}%)`;
                    } else {
                        let advancement = 1;
                        ps.startingAlpha = 1;
                        ps.particleLifespan = 250 + 300*advancement;
                        ps.particlesPerSec = 40 + 50*advancement;
                        ps.particleSize = 5 + 4*advancement;
                        ps.particleSpeed = 60 + 200*advancement;
                        ps.lightness = 0;
    
                        if(c.golden){
                            ps.hue = 280;
                            ps.saturation = 100;
                            ps.lightness = 40;
                        } else {
                            c.color = `hsl(0,0%,100%)`;
                        }
                    }
                    c.particleSystem.drawParticles(performance.now());
                }
    
                context.fillStyle = cColor;
                if(i < playerConditions.length-1){
                    context.fillText(cInfo.name+", ", conditionX, conditionY);
                    conditionLine += cInfo.name+", ";
                } else {
                    context.fillText(cInfo.name, conditionX, conditionY);
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

        // Draw chat bar 
        if(globalWorldData.chatting){
            context.fillStyle = 'hsl(0, 100%, 0%, 70%)';
            context.save();
            context.shadowColor = "hsl(0, 15%, 0%, 70%)";
            context.shadowBlur = 15;
            context.beginPath();
            context.roundRect(globalWorldData.worldX, globalWorldData.worldY+(h*globalWorldData.sizeMod)+5*globalWorldData.sizeMod, w*globalWorldData.sizeMod, globalWorldData.sizeMod*30,5);
            context.fill();
            context.restore();

            context.font = `${15*globalWorldData.sizeMod}px zenMaruRegular`;
            context.textAlign = 'left';
            context.fillStyle = "White";
            let text = globalInputData.textEntered;
            if(timeStamp%1500 > 750){
                text+= "_";
            }
            context.fillText(text, globalWorldData.worldX+globalWorldData.sizeMod*10, globalWorldData.worldY+(h*globalWorldData.sizeMod)+25*globalWorldData.sizeMod);
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
        globalWorldData.sidebar = "status";

        if(globalWorldData.menuScene === "Inventory"){
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
                                    draggingObject = {
                                        originalX: box.x,
                                        originalY: box.y,
                                        clickX: globalInputData.mouseX,
                                        clickY: globalInputData.mouseY,
                                        type: "inventory",
                                        item: playerInventoryData.inventory[j + i*5],
                                        inventoryIndex: j + i*5,
                                    }
                                    //draggingObject = [box.x,box.y,globalInputData.mouseX,globalInputData.mouseY,playerInventoryData.inventory[j + i*5],j + i*5];
                                    //playerInventoryData.inventory[j + i*5] = "none";
                                }
                                break;
                            }
                        }
                    }

                } else if(action==="mousemove"){
                    //nothing??
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
                                playerInventoryData.inventory[draggingObject.inventoryIndex] = playerInventoryData.inventory[j + i*5];
                                playerInventoryData.inventory[j + i*5] = draggingObject.item;
                                initializeMenuTab();
                                break;
                            }
                        }
                    }
                    /*if(!boxFound){
                        playerInventoryData.inventory[draggingObject.inventoryIndex] = draggingObject.inventoryIndex;
                    }*/
                    draggingObject = null;
                }
            }
        } else if(globalWorldData.menuScene === "Kanji List"){
            globalWorldData.sidebar = "kanji";
            let rowAmount = 12;
            for(let i=0;i<Math.ceil(kanjiFileData.length/rowAmount);i++){
                for(let j=0; j<Math.min(rowAmount,kanjiFileData.length-i*rowAmount);j++){
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
                    playerKanjiData.kanjiList[globalWorldData.menuData.selectedKanji].enabled = !playerKanjiData.kanjiList[globalWorldData.menuData.selectedKanji].enabled;
                }
            });
        } else if(globalWorldData.menuScene === "Theory"){
            globalWorldData.sidebar = "theory";
            for(let i=0, listedNum=0;i<theoryWriteupData.length;i++){
                if(!theoryWriteupData[i].hasOwnProperty("listRequirements")){
                    playerTheoryData[i].listed = true;
                } else {
                    playerTheoryData[i].listed = evaluateUnlockRequirements(playerAbilityData, playerTheoryData, theoryWriteupData[i].listRequirements);
                }
                if(playerTheoryData[i].listed){
                    tooltipBoxes.push({
                        x: globalWorldData.worldX+240,
                        y: globalWorldData.worldY+140 + 45*listedNum,
                        spawnTime: 0,
                        width: 18*TILE_SIZE+1-55, height: 40,
                        type: "write-up entry", index: i,
                    });
                    listedNum++;
                }
                playerTheoryData[i].conditionsMet = evaluateUnlockRequirements(playerAbilityData, playerTheoryData, theoryWriteupData[i].unlockRequirements);
            }

            if(globalWorldData.menuData.isReadingWriteup){
                let writeupInfo = theoryWriteupData[globalWorldData.menuData.selectedWriteup];

                buttons.push({
                    x:globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+132, y:globalWorldData.worldY+700, width:100, height:30,
                    neutralColor: '#b3b3ff', hoverColor: '#e6e6ff', pressedColor: '#ff66ff', color: '#b3b3ff',
                    text: "Stop Reading", font: '13px zenMaruRegular', fontSize: 18, enabled: true, temporaryMenuButton: true,
                    onClick: function(){
                        globalWorldData.menuData.isReadingWriteup = false;
                        initializeMenuTab();
                    }
                });

                if(writeupInfo.currentPage > 0){
                    buttons.push({
                        x:globalWorldData.worldX+(18*TILE_SIZE/2)+120, y:globalWorldData.worldY+18*TILE_SIZE*globalWorldData.sizeMod-150, width:35, height:35,
                        neutralColor: '#b3b3ff', hoverColor: '#e6e6ff', pressedColor: '#ff66ff', color: '#b3b3ff', radius:1,
                        text: "<", font: '30px zenMaruRegular', fontSize: 30, enabled: true, temporaryMenuButton: true,
                        onClick: function(){
                            theoryWriteupData[globalWorldData.menuData.selectedWriteup].currentPage--;
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
                            theoryWriteupData[globalWorldData.menuData.selectedWriteup].currentPage++;
                            initializeMenuTab();
                        }
                    });
                }
            } else {
                if(playerTheoryData[globalWorldData.menuData.selectedWriteup].unlocked){
                    buttons.push({
                        x:globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+157, y:globalWorldData.worldY+700, width:50, height:30,
                        neutralColor: '#b3b3ff', hoverColor: '#e6e6ff', pressedColor: '#ff66ff', color: '#b3b3ff',
                        text: "Read", font: '13px zenMaruRegular', fontSize: 18, enabled: true, temporaryMenuButton: true,
                        onClick: function(){
                            globalWorldData.menuData.isReadingWriteup = true;
                            initializeMenuTab();
                        }
                    });
                } else if(playerTheoryData[globalWorldData.menuData.selectedWriteup].conditionsMet){
                    buttons.push({
                        x:globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+98, y:globalWorldData.worldY+700, width:170, height:30,
                        neutralColor: '#ff6', hoverColor: '#ffffb3', pressedColor: '#66f', color: '#ff6',
                        text: "Unlock and Collect Reward", font: '13px zenMaruRegular', fontSize: 18, enabled: true, temporaryMenuButton: true,
                        onClick: function(){
                            let theoryNum = globalWorldData.menuData.selectedWriteup;
                            if(playerTheoryData[theoryNum].conditionsMet){
                                playerTheoryData[theoryNum].unlocked = true;
                                globalWorldData.menuData.isReadingWriteup = true;
                                for(let i in theoryWriteupData[theoryNum].unlockRewards){
                                    awardPlayer(playerInventoryData,theoryWriteupData[theoryNum].unlockRewards[i],performance.now());
                                }
                                initializeMenuTab();
                            }
                        }
                    });
                }
            }
        } else if(globalWorldData.menuScene === "Abilities"){
            globalWorldData.sidebar = "ability";
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

            let playerAbilityInfo = playerAbilityList[globalWorldData.menuData.selectedAbility];
            let abilityInfo = abilityFileData[playerAbilityInfo.index];
            if(!playerAbilityInfo.acquired && playerAbilityInfo.unlocked && playerStatData.power >= abilityInfo.acquisitionPower){
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
                    if(currentTooltip && currentTooltip.info.type === "ability menu ability" && playerAbilityData.acquiredAbilities[playerAbilityData.list[currentTooltip.info.index].name]){
                        globalWorldData.menuData.selectedAbility = currentTooltip.info.index;
                        initializeMenuTab();
                        draggingObject = {
                            originalX: currentTooltip.info.x,
                            originalY: currentTooltip.info.y,
                            clickX: globalInputData.mouseX,
                            clickY: globalInputData.mouseY,
                            type: "ability",
                            abilityIndex: currentTooltip.info.index, //todo: finish refactoring this stuff by utilizing the new ui system to make this make more sense
                            source: "ability list"
                        }
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
                                    globalWorldData.menuData.selectedAbility = playerAbilityData.equippedAbilities[i];
                                    initializeMenuTab();
                                    draggingObject = {
                                        originalX: box.x,
                                        originalY: box.y,
                                        clickX: globalInputData.mouseX,
                                        clickY: globalInputData.mouseY,
                                        type: "ability",
                                        index: i,
                                        abilityIndex: playerAbilityData.equippedAbilities[i],
                                        source: "ability bar"
                                    }
                                }
                                break;
                            }
                        }
                    }
                } else if(action==="mousemove"){

                } else if(action==="mouseup"){
                    
                    for(let i=0;i<playerAbilityData.abilitySlots;i++){
                        let box = {
                            x: globalWorldData.worldX+247+250-playerAbilityData.abilitySlots*25+50*i,
                            y: globalWorldData.worldY+135,
                            width: 45,
                            height: 45
                        };
                        if (globalInputData.mouseX >= box.x && globalInputData.mouseX <= box.x + box.width && globalInputData.mouseY >= box.y && globalInputData.mouseY <= box.y + box.height) {
                            if(i !== draggingObject.index){
                                equipAbility(playerConditions,playerAbilityData,playerStatData,i,draggingObject.abilityIndex);
                            }
                            draggingObject = null;
                            return;
                        }
                    }
                    unequipAbility(playerConditions,playerAbilityData,playerStatData,draggingObject.index,draggingObject.abilityIndex);
                    draggingObject = null;
                }
            }

            if(draggingObject === undefined){
                draggingObject = null
            }

        } else if(globalWorldData.menuScene === "Save") {
            if(globalWorldData.menuData.loadStatement !== null){
                buttons.push({
                    x:globalWorldData.worldX+247+140, y:globalWorldData.worldY+370+300, width:200, height:35,
                    neutralColor: '#b3b3ff', hoverColor: '#e6e6ff', pressedColor: '#ff66ff', color: '#b3b3ff',
                    text: "Close Load Statement", font: '17px zenMaruRegular', fontSize: 17, enabled: true, temporaryMenuButton: true,
                    onClick: function(){
                        globalWorldData.menuData.loadStatement = null;
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
            playerStatData: playerStatData,
            playerCombatData: playerStatData.combatData,
            baseStats: playerStatData.baseStats,
            playerInventoryData: playerInventoryData,
            playerAbilityData: playerAbilityData,
            kanjiList: playerKanjiData.kanjiList,
            playerTheoryData: playerTheoryData,
            playerSrsSettingsData: playerSrsSettingsData,
            playerConditions: playerConditions,

            globalPlayerStatisticData: globalPlayerStatisticData,
            globalItemsDiscovered: globalItemsDiscovered,
    
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

            playerKanjiData = {
                trialsThisSession: 0,
                recentTrialCategories: [],

                reinforcingKanji: [],
                reinforcesDue: 0,

                reviewingKanji: [],
                reviewsDue: 0,
        
                newKanji: [],
            };

            playerWorldData = save.playerWorldData;
            playerStatData = save.playerStatData;
            playerStatData.combatData = save.playerCombatData;
            playerStatData.baseStats = save.baseStats;
            playerInventoryData = save.playerInventoryData;
            playerAbilityData = save.playerAbilityData;
            playerKanjiData.kanjiList = save.kanjiList;
            playerTheoryData = save.playerTheoryData;
            playerSrsSettingsData = save.playerSrsSettingsData;
            playerConditions = save.playerConditions;

            globalPlayerStatisticData = save.globalPlayerStatisticData;
            globalItemsDiscovered = save.globalItemsDiscovered,
    
            globalWorldData.currentGameClock = save.clock;
            globalWorldData.gameClockOfLastPause = save.gameClockOfLastPause;
            dialogue = save.dialogue;
            combat = save.combat;
            globalWorldData.levelNum = save.levelNum;
            globalWorldData.menuData.selectedAbility = 0;
            globalWorldData.menuData.selectedWriteup = 0;
            
            timeUntilDysymbolia = save.timeUntilDysymbolia;

            blur = 0;
    
            globalInputData.currentDirectionFrozen = false;

            if(dialogue !== null){
                dialogue.lineStartTime = performance.now();
            }

            updateModifiers(playerStatData);
            
            // Particle systems have to be made again or nullified
            for(let i=0;i<playerConditions.length;i++){
                let condition = playerConditions[i];
                if(conditionData[condition.id].name === "Dysymbolia"){
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

            // Initialize srs session data from kanji list
            let currentDate = new Date();
            
            for(let i=0;i<playerKanjiData.kanjiList.length;i++){
                let kanji = playerKanjiData.kanjiList[i];
    
                // Restore our date objects
                if(kanji.lastTrialDate !== null){
                    kanji.lastTrialDate = new Date(kanji.lastTrialDate);
                }
                if(kanji.lastSignificantTrialDate !== null){
                    kanji.lastSignificantTrialDate = new Date(kanji.lastSignificantTrialDate);
                }

                kanji.lastTrialNum = null;

                if(kanji.srsCategory === 0){
                    // If kanji is a new kanji, dont need to do anything but put it right into the new kanji array
                    playerKanjiData.newKanji.push(kanji);
                } else if(kanji.srsCategory === 1){
                    // If kanji was reinforcing, add it to reviews if at least 22 hours has passed since last significant trial
                    if(kanji.trialSuccesses>0 && kanji.lastSignificantTrialDate!==null && currentDate - kanji.lastSignificantTrialDate > 1000 * 60 * 60 * 22){
                        kanji.srsCategory = 2;
                        kanji.srsCategoryInfo = {
                            currentInterval: 1 + kanji.highestReviewIntervalAchieved/100,
                        }
                        kanji.leechScore = Math.max(0,kanji.leechScore-10);
                        playerKanjiData.reviewingKanji.push(kanji);
                    } else {
                        playerKanjiData.reinforcingKanji.push(kanji);
                    }
                } else if(kanji.srsCategory === 2){
                    playerKanjiData.reviewingKanji.push(kanji);
                }
            }

            updateReviewsDue(playerKanjiData,currentDate);

            // in milliseconds
            let dateDifference = currentDate - new Date(save.date);
            let dayDifference = Math.floor(dateDifference/(1000 * 60 * 60 * 24));
            let hourRemainder = Math.floor(dateDifference%(1000 * 60 * 60 * 24)/(1000 * 60 * 60));
            let minuteRemainder = Math.floor(dateDifference%(1000 * 60 * 60)/(1000 * 60));

            // Create the load statement
            globalWorldData.menuData.loadStatement = {
                dayDifference: dayDifference,
                hourRemainder: hourRemainder,
                minuteRemainder: minuteRemainder,
                reviewsDue: playerKanjiData.reviewsDue,
            };

            // hack?
            playerKanjiData.newKanji.reverse();
    
            alert("successfully loaded i think");
        }
        catch (err) {
            alert("load failed: "+err);
        }
    }

    // called on button press. toggles menu and returns "closed menu" or "opened menu"
    this.handleMenuButtonPress = function(){
        if(globalWorldData.menuScene === null){
            globalWorldData.menuScene = "Inventory";
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
            globalWorldData.menuScene = null;
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
            globalWorldData.sidebar = "status";
            updateInventory(playerInventoryData);

            return "closed menu";
        }
    };

    this.handleMenuTabButtonPress = function(tab){
        globalWorldData.menuScene = tab;
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

        const checkTooltipOfUiElement = function(uiElement){
            if(uiElement.type === "inventory slot"){
                let t = uiElement.tooltip;
                t.item = playerInventoryData.inventory[t.inventoryIndex];

                if (t.item !== "none" &&
                    mouseX >= t.x &&         // right of the left edge AND
                    mouseX <= t.x + t.width &&    // left of the right edge AND
                    mouseY >= t.y &&         // below the top AND
                    mouseY <= t.y + t.height) {    // above the bottom
                        currentTooltip = {timeStamp: performance.now(), info: t};
                }
            } else if(uiElement.type === "ability slot"){
                let t = uiElement.tooltip;
                t.ability = playerAbilityData.equippedAbilities[t.slotNum];

                if (typeof t.ability === "number" &&
                    mouseX >= t.x &&         // right of the left edge AND
                    mouseX <= t.x + t.width &&    // left of the right edge AND
                    mouseY >= t.y &&         // below the top AND
                    mouseY <= t.y + t.height) {    // above the bottom
                        currentTooltip = {timeStamp: performance.now(), info: t};
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
                    currentTooltip = {timeStamp: performance.now(), info: t};
                }
            }
            if(globalWorldData.menuScene === "Inventory"){
                for (let i=0;i<globalMenuTabUiElements.length;i++) {
                    checkTooltipOfUiElement(globalMenuTabUiElements[i]);
                }
            }
            if(globalWorldData.sidebar === "status"){
                for (let i=0;i<globalStatusBarUiElements.length;i++) {
                    checkTooltipOfUiElement(globalStatusBarUiElements[i]);
                }
            }
        } else {
            let t = currentTooltip.info;
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
        updateParticleSystems(fps,timeStamp);

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
            if(timeStamp - currentTooltip.timeStamp > currentTooltip.info.spawnTime){
                drawTooltip(currentTooltip.info);
            }
        }

        if(isLoggingFrame){
            let statement = //"Time Stamp: " +timeStamp+ "\n" + "Scene: " +name+ "\n"+ "Number of tooltips: " +tooltipBoxes.length+ "\n";
`Time Stamp: ${timeStamp}
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

    // Initialize cloud layer
    for(let i=0; i<levels[0].gridHeight+1;i++){
        clouds.push([]);
        for(let j=0; j<levels[0].gridWidth+1;j++){
            // If cloud num is 0 its a blank white cloud, if its 1-4 its one of the 4
            let cloudNum = 0;
            let cloudSrc = [32*4,32*4];
            if(Math.random() > 0.6){
                cloudNum = Math.floor(Math.random()*4+1);
                if(cloudNum === 1){
                    cloudSrc = [32,32*5];
                }
                if(cloudNum === 2){
                    cloudSrc = [64,32*5];
                }
                if(cloudNum === 3){
                    cloudSrc = [32,32*6];
                }
                if(cloudNum === 4){
                    cloudSrc = [64,32*6];
                }
            }

            
            clouds[i].push(cloudSrc);
        }
    }

    // Initialize!
    initializeNewSaveGame(playerKanjiData,playerTheoryData,playerAbilityData,playerStatData,playerConditions);
    dialogue = initializeDialogue("scenes","opening scene",performance.now());
    updateConditionTooltips(playerConditions);
    updateInventory(playerInventoryData);
    globalInputData.key2Clicked = globalInputData.key1Clicked = globalInputData.key3Clicked = globalInputData.doubleClicked = false;

    /******** add Ui elements *********/ 

    // inventory hotbar
    for(let i=0;i<5;i++){
        let uiElement = createUiElement(
            "inventory hotbar slot " + i,
            "inventory slot",
            globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 28+50*i,
            globalWorldData.worldY+690,
            45,
            45,
            [],
            {type: "item", spawnTime: 0, inventoryIndex: i}
        );
        uiElement.slotNum = i;
        globalStatusBarUiElements.push(uiElement);
    }

    // ability hotbar
    for(let i=0;i<5;i++){
        let uiElement = createUiElement(
            "ability hotbar slot " + i,
            "ability slot",
            globalWorldData.worldX+18*16*globalWorldData.sizeMod*2+30 + 28+50*i,
            globalWorldData.worldY+535,
            45,
            45,
            [],
            {type: "ability", spawnTime: 500, slotNum: i}
        );
        uiElement.slotNum = i;
        globalStatusBarUiElements.push(uiElement);
    }

    // menu inventory
    for(let i=0;i<Math.ceil(playerInventoryData.inventory.length/5);i++){
        for(let j=0;j<5;j++){
            let uiElement = createUiElement(
                "menu inventory slot " + i,
                "inventory slot",
                globalWorldData.worldY+285+105+67*j,
                globalWorldData.worldY+160 + 67*i,
                60,
                60,
                [],
                {type: "item", spawnTime: 0, inventoryIndex: j + i*5}
            );
            uiElement.slotNum = j + i*5;
            globalMenuTabUiElements.push(uiElement);
        }
    }

    //menu abilities
    for(let i=0;i<playerAbilityData.abilitySlots;i++){
        let uiElement = createUiElement(
            "menu ability slot " + i,
            "ability slot",
            globalWorldData.worldX+247+250-playerAbilityData.abilitySlots*25+50*i,
            globalWorldData.worldY+135,
            45,
            45,
            [],
            {type: "ability", spawnTime: 0}
        );
        uiElement.slotNum = i;
        globalMenuTabUiElements.push(uiElement);
    }
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
        if(c === "lizard" || c === "hiddenone_spider"){
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
    miscImages.gun.src = `/assets/Snoopeth's Guns/1px/33.png`;
    miscImages.blueberry = new Image();
    miscImages.blueberry.src = `/assets/Sprout Lands 32/bberry.png`;
    miscImages.yellowberry = new Image();
    miscImages.yellowberry.src = `/assets/Sprout Lands 32/yberry.png`;
    miscImages.bbush = new Image();
    miscImages.bbush.src = `/assets/Sprout Lands 32/bbush.png`;
    miscImages.ybush = new Image();
    miscImages.ybush.src = `/assets/Sprout Lands 32/ybush.png`;

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
