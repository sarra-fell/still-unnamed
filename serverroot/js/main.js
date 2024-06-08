"use strict";
let canvas,context;
window.onload = init;

/*
    Load important data  !!
*/

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

// Loads the data !!!
let gameJsonDataLoaded = false;
function processGameJsonData(data) {
    const gameData = JSON.parse(data);
    const dialogueData = gameData.dialogue;
    adventureKanjiFileData = gameData.kanji;
    theoryWriteupData = gameData.theory;
    abilityFileData = gameData.abilities;
    enemyFileData = gameData.enemies;

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
            dictionary.entries[wordData[0]] = wordData[1]
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
gameJsonClient.open("GET", "assets/game_json_data.txt");
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
dictClient.open("GET", "assets/compiled_dictionary_data.txt");
dictClient.send();

// Now the item information that we hardcode for now, will be moved to the file soon tm ---- TODO
// Has information for all the items in the game
// Not to be modified
let itemInfo = [
    {
        name: "Love Fruit",
        desc: "A mysterious fruit shaped like a heart. Like everything else on this floating island, it looks too good to be true. Heals $healAmount$ HP when consumed and fills you up somewhat. (Double click to use items!).",
        type: "Consumable",
        color: "red",
        subtypes: ["food"],
        stack: true,
        imageInfo: ["tile",0,[32,64],1.6],
        effectList: ["heal","satiate"],
        effects: {
            healAmount: 15,
            satiation: "normal",
        }
    },
    {
        name: "Love Berries",
        desc: "Some berries you found on the floating island. They don't look like much but they are the best berries you have ever tasted. Heals $healAmount$ HP when consumed and fills you up a little.",
        type: "Consumable",
        color: "red",
        subtypes: ["food"],
        stack: true,
        imageInfo: ["tile",0,[128,96],0.9],
        effectList: ["heal","satiate"],
        effects: {
            healAmount: 10,
            satiation: "small",
        }
    },
    {
        name: "Dev Gun",
        desc: "Reality bends to your will.",
        type: "Special",
        color: "blue",
        subtypes: [],
        imageInfo: ["gun"],
    }
]

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

// The scene is the screen the player is engaging with and the scene object stores information specfic to the scene
// All state in this object is wiped upon scene change, which hopefully someyhwat mitigates that it is basically a god object containing glorified global state

// Update: it was not mitigated it all, not the least reason for which is that adventure is the only scene we actually care about
var scene = {
    name: "home", index: 0, buttons: [], particleSystems: [], timeOfSceneChange: -1,
    inputting: false, finishedInputting: true, textEntered:"",

    // Contains the 'hitboxes' for the areas where tooltips need to appear when hovered
    // Is an array of objects with the following members:
    // x, y, width, height
    // type - "dictionary" for dictionary definitions of words (thats it right now)
    // word - the word thats definition needs to be defined
    tooltipBoxes: [],

    // Contains information about the tooltip box that is being hovered over if one is
    // Becomes an object with property timeStamp (when hovering began) and index (index in tooltipBoxes)
    currentTooltip: null,

    // Functions called in response to user input change this to the name of the scene that needs to be changed to instead of directly calling
    //initializeScene. The reason for this is concurrency safety - otherwise the chance that the scene is changed during the middle of
    //one run of the game loop *may* be non-zero which would cause extremely unpredictable behavior
    //im not sure if that would actually be possible or not but this is to be safe
    switchScene: null,
};

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

let showDevInfo = true;

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
        if(scene.name === "adventure"){
            if(scene.sizeMod === 1.4){
                scene.sizeMod = 1;
            } else {
                scene.sizeMod = 1.4;
            }
        }
    }
};
let clearDataButton = {
    x:screenWidth-100, y:screenHeight-50, width:80, height:30,
    neutralColor: '#b3b3ff', hoverColor: '#e6e6ff', pressedColor: '#ff66ff', color: '#b3b3ff',
    text: "Reset data", font: '13px zenMaruRegular', fontSize: 13,
    onClick: function() {
        localStorage.clear();
        love=0;
        name="";
        alert("No more love :(");
    }
};
let tatakauSceneButton = {
    x:500, y:300, width:100, height:100,
    neutralColor: '#ff3333', hoverColor: '#ff6666', pressedColor: '#cc33ff', color: '#ff3333',
    text: "戦う", font: '24px zenMaruLight', fontSize: 24, jp: true,
    onClick: function() {
        this.color = this.neutralColor;
        scene.switchScene = "tatakau";
    }
};
let cardCreationSceneButton = {
    x:-1000, y:-1000, width:150, height:100,
    neutralColor: '#b3b3ff', hoverColor: '#e6e6ff', pressedColor: '#ff66ff', color: '#b3b3ff',
    text: "カード=作成", font: '24px zenMaruLight', fontSize: 24, jp: true,
    onClick: function() {
        this.color = this.neutralColor;
        scene.switchScene = "card creation";
    }
};
let introductionButton = {
    x:620, y:300, width:150, height:100,
    neutralColor: '#b3b3ff', hoverColor: '#e6e6ff', pressedColor: '#ff66ff', color: '#b3b3ff',
    text: "自己紹介", font: '24px zenMaruLight', fontSize: 24, jp: true,
    onClick: function() {
        scene.inputting = true;
        scene.finishedInputting = false;
    }
};
let nikkaSceneButton = {
    x:500, y:60, width:100, height:100,
    neutralColor: '#fffe15', hoverColor: '#ffff81', pressedColor: '#21f100', color: '#fffe15',
    text: "日課", font: '24px zenMaruLight', fontSize: 28, jp: true,
    onClick: function() {
        this.color = this.neutralColor;
        scene.switchScene = "nikka";
    }
};
let zidaiSensouButton = {
    x:620, y:60, width:150, height:100,
    neutralColor: '#0390fc', hoverColor: '#53b3fc', pressedColor: '#a024ff', color: '#0390fc',
    text: "時代=戦争", font: '24px zenMaruLight', fontSize: 24, jp: true,
    onClick: function() {
        this.color = this.neutralColor;
        scene.switchScene = "zidai sensou";
    }
};
let adventureButton = {
    x:500, y:180, width:270, height:100,
    neutralColor: '#9c79ec', hoverColor: '#bda6f2', pressedColor: '#f0d800', color: '#9c79ec',
    text: "冒険=を=始める", font: '28px zenMaruLight', fontSize: 28, jp: true,
    onClick: function() {
        if(areImageAssetsLoaded()){
            this.color = this.neutralColor;
            scene.switchScene = "adventure";
        } else {
            throw "images arent loaded yet stupid";
        }
    }
};
let backToHomeButton = {
    x:20, y:screenHeight-100, width:60, height:30,
    neutralColor: '#b3b3ff', hoverColor: '#c8c8fa', pressedColor: '#ff66ff', color: '#b3b3ff',
    text: "Back", font: '14px zenMaruMedium', fontSize: 14,
    onClick: function() {
        this.color = this.neutralColor;
        scene.switchScene = "home";
    }
}

/*
    User input section (mouse + keyboard)

     scene.inputting is set to true when input needs to be collected and set false by the same source when
the text is finished being processed

    scene.finishedInputting is set to false at the same time inputting is set to true and set true the moment
the player pressed enter

    scene.textEntered is a string that is modified when inputting and represents the actual entered text
*/

// keyPressed variables only to be changed by input event listeners
let downPressed=false,upPressed=false,leftPressed=false,rightPressed=false;

// variables set to be true by input event listeners and set back to false after being handled by scene update
let downClicked=false,upClicked=false,zClicked=false,xClicked=false,doubleClicked=false;

// for player movement. handled by the input layer
let currentDirection = "Down";

// Changed by the scene when the direction is not to change regardless of input
let currentDirectionFrozen = false;

// Global state for tracking mouse. Global state = good
let mouseDown=false, mouseX=0, mouseY=0;

// Used to know the x and y of the last mousedown, mostly for determining if the mouseup or mouse click occured in the same place as it
//so that we know whether a button was actually fully clicked or not
let mouseDownX=-1, mouseDownY=-1;

window.addEventListener('keydown',function(e) {
    switch (e.key) {
       case 'ArrowLeft': leftPressed=true; if(!currentDirectionFrozen) currentDirection="Left"; break;
       case 'ArrowUp': upPressed=true; upClicked=true; if(!currentDirectionFrozen) currentDirection="Up"; break;
       case 'ArrowRight': rightPressed=true; if(!currentDirectionFrozen) currentDirection="Right"; break;
       case 'ArrowDown': downPressed=true; downClicked=true; if(!currentDirectionFrozen) currentDirection="Down"; break;
       case 'Enter': scene.finishedInputting=true; break;
       case 'X': xClicked=true;
       case 'x': xClicked=true;
       case 'Z': zClicked=true;
       case 'z': zClicked=true;
       default: if(!scene.finishedInputting){
           switch (e.key) {
              case 'Backspace': if(scene.textEntered.length>0){
                  scene.textEntered = scene.textEntered.substring(0,scene.textEntered.length-1);
              } break;
              default: if(e.key.length===1){
                  scene.textEntered = scene.textEntered+e.key;
              }
          }
       } break;
   }
},false);

function reassignCurrentDirection(){
    upPressed ? currentDirection="Up" :
    rightPressed ? currentDirection="Right" :
    leftPressed ? currentDirection="Left" :
    downPressed ? currentDirection="Down" : null;
}

window.addEventListener('keyup',function(e) {
    switch (e.key) {
       case 'ArrowLeft': leftPressed=false; if (!currentDirectionFrozen && currentDirection==="Left") reassignCurrentDirection(); break;
       case 'ArrowUp': upPressed=false; if (!currentDirectionFrozen && currentDirection==="Up") reassignCurrentDirection(); break;
       case 'ArrowRight': rightPressed=false; if (!currentDirectionFrozen && currentDirection==="Right") reassignCurrentDirection(); break;
       case 'ArrowDown': downPressed=false; if (!currentDirectionFrozen && currentDirection==="Down") reassignCurrentDirection(); break;
       case '=': isLoggingFrame=true; break;
       case '~': showDevInfo=!showDevInfo; break;

       default: break;
   }
},false);

window.addEventListener('mousemove',function(e) {
    let rect = canvas.getBoundingClientRect();

    // mouse x and y relative to the canvas
    mouseX = Math.floor(e.x - rect.x);
    mouseY = Math.floor(e.y - rect.y);

    //check if was hovered on button so we can change color!
    for (const b of scene.buttons) {
        if(!mouseDown){
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


    if(scene.currentTooltip === null){
        //check if we hovered over a tooltip
        for (let i=0;i<scene.tooltipBoxes.length;i++) {
            let t = scene.tooltipBoxes[i];
            if (mouseX >= t.x &&         // right of the left edge AND
            mouseX <= t.x + t.width &&    // left of the right edge AND
            mouseY >= t.y &&         // below the top AND
            mouseY <= t.y + t.height) {    // above the bottom
                scene.currentTooltip = {timeStamp: performance.now(), index: i};
            }
        }
    } else {
        let t = scene.tooltipBoxes[scene.currentTooltip.index];
        //check if we are still hovering
        if (mouseX >= t.x &&         // right of the left edge AND
        mouseX <= t.x + t.width &&    // left of the right edge AND
        mouseY >= t.y &&         // below the top AND
        mouseY <= t.y + t.height) {
            //pass
        } else {
            scene.currentTooltip = null
        }
    }

    if(scene.handleDraggingObject !== undefined && scene.draggingObject){
        scene.handleDraggingObject("mousemove");
    }
},false);

window.addEventListener('mousedown',function(e) {
    mouseDown=true;
    let rect = canvas.getBoundingClientRect();

    // mouse x and y relative to the canvas
    mouseX = mouseDownX = Math.floor(e.x - rect.x);
    mouseY = mouseDownY = Math.floor(e.y - rect.y);

    //check if was pressed on button so we can change color!
    for (let x in scene.buttons) {
        let b = scene.buttons[x];
        if (mouseX >= b.x &&         // right of the left edge AND
            mouseX <= b.x + b.width &&    // left of the right edge AND
            mouseY >= b.y &&         // below the top AND
            mouseY <= b.y + b.height) {    // above the bottom
                b.color = b.pressedColor;
            }
    }

    if(scene.handleDraggingObject !== undefined){
        scene.handleDraggingObject("mousedown");
    }

},false);

window.addEventListener('mouseup',function(e) {
    mouseDown=false;

    if(scene.handleDraggingObject !== undefined && scene.draggingObject){
        scene.handleDraggingObject("mouseup");
    }
},false);

window.addEventListener('click',function(e) {
    let rect = canvas.getBoundingClientRect();

    // Click x and y relative to the canvas
    mouseX = Math.floor(e.x - rect.x);
    mouseY = Math.floor(e.y - rect.y);

    for (let x in scene.buttons) {
        let b = scene.buttons[x];
        if(!b.enabled){
            continue;
        }

        if (mouseX >= b.x && mouseX <= b.x + b.width && mouseY >= b.y && mouseY <= b.y + b.height) {
            b.color = b.hoverColor;

            //only register as a click if when the mouse was pressed down it was also within the button.
            //note that this implementation does not work for a moving button so if that is needed this would need to change
            if (mouseDownX >= b.x &&         // right of the left edge AND
                mouseDownX <= b.x + b.width &&    // left of the right edge AND
                mouseDownY >= b.y &&         // below the top AND
                mouseDownY <= b.y + b.height) {b.onClick();}
        } else {
            b.color = b.neutralColor;
        }
    }
    scene.particleSystems.push(createParticleSystem({x:mouseX, y:mouseY, temporary:true, particlesLeft:6, particleSpeed: 120, particleAcceleration: -150, particleLifespan: 600, particleSize: 5}));
},false);

window.addEventListener('dblclick',function(e) {
    doubleClicked=true;
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
        let wrappedText = wrapText(context, bodyText, mouseY+74, 350, 16, jp);

        const boxX = mouseX+12;
        const boxY = mouseY+12;
        const boxWidth = 250;
        const boxHeight = wrappedText[wrappedText.length-1][1]-mouseY+12;

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
            context.fillText(item[0], mouseX+12+10+offsetX, item[1]+offsetY);
        });
    }

    let tooltipBox = scene.tooltipBoxes[scene.currentTooltip.index];
    if(tooltipBox.type === "dictionary"){
        const word = scene.tooltipBoxes[scene.currentTooltip.index].word;
        context.font = '20px zenMaruRegular';
        draw('black', "Definition of " + word, dictionary.entries[word]);
    } else if (tooltipBox.type === "condition"){
        const condition = tooltipBox.condition;
        context.font = '20px zenMaruBlack';
        if(condition.name === "Dysymbolia"){
            if(scene.player.sceneData.timeUntilDysymbolia === 0){
                draw(condition.color,condition.name,"Character sees visions of a distant world. Next imminent.", false, 12);
                return;
            } else if(scene.player.sceneData.timeUntilDysymbolia < 0){
                let trialsLeft = scene.dialogue.cinematic.trialsLeft;
                let specialTrialsLeft = scene.dialogue.cinematic.specialTrialsLeft;
                if(condition.golden){
                    draw(condition.color,condition.name,"いい度胸だ。", true, 12, "hsl(280, 100%, 70%, 70%)");
                } else {
                    if(trialsLeft < 2){
                        draw(condition.color,condition.name,"ここが貴方のいるべき場所じゃない。戻ってください。", true, 12);
                    } else {
                        draw(condition.color,condition.name,trialsLeft + " more left.", true, 12);
                    }
                }
                return;
            }
        }

        let splitDesc = condition.desc.split("$");
        let parsedDesc = "";
        for(let i in splitDesc){
            if(splitDesc[i] === "timeUntilDysymbolia"){
                parsedDesc = parsedDesc + `${scene.player.sceneData.timeUntilDysymbolia}`;
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
    scene.currentTooltip = null;
    for (let i=0;i<scene.tooltipBoxes.length;i++) {
        let t = scene.tooltipBoxes[i];
        if (mouseX >= t.x &&         // right of the left edge AND
        mouseX <= t.x + t.width &&    // left of the right edge AND
        mouseY >= t.y &&         // below the top AND
        mouseY <= t.y + t.height) {    // above the bottom
            scene.currentTooltip = {timeStamp: performance.now(), index: i};
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
    }
    if(sys.particlesLeft === 0){
        sys.createNewParticles = false;
    }
    sys.particles = newArray;
}

/*
    Scene procedures begin here
*/

// Called upon scene change and initializes
function initializeScene(sceneName){
    // First clear the current scene before repopulating it
    scene = {name: sceneName, index: -1, buttons: [], particleSystems: [], timeOfSceneChange: performance.now(),
            inputting: false, finishedInputting: true, textEntered:"", currentTooltip:null, tooltipBoxes:[],
            switchScene: null};

    // Find the scene definition for the scene
    for(let i=0;i<sceneDefinitions.length;i++){
        if(sceneName === sceneDefinitions[i].name){
            scene.index = i;
            scene.buttons = sceneDefinitions[i].buttons;
        }
    }

    scene.tileSize = 32;
    scene.levelNum = 0;
    scene.sizeMod = 1.4;
    scene.blur = 0;
    scene.activeDamage = {
        // If startFrame is positive, there is currently active damage.
        startFrame: -1,

        // Duration of the current damage
        duration: 0,

        // How much the screen was shaken by
        offset: [0,0],

        // Last time the screen was shaken to not shake every single frame
        timeOfLastShake: -1,
    };

    // Stores all player and progress info for adventure (as long as its information that would be worth saving between sessions)
    scene.player = {
        sceneData: {
            location: levels[0].defaultLocation,
            graphicLocation: levels[0].defaultLocation,
            src: [32,0],
            bitrate: 32,
            animation: null,
            name: "Mari", jpName: "マリィ",
            color: "#caa8ff",
            dysymboliaActive: true,

            // Measured in in-game seconds. -1 means there is a current dysymbolia event
            // it will stay at 0 if one cannot currently happen and it is waiting for the next opportunity to start
            timeUntilDysymbolia: 60,
            //hunger: 75, maxHunger: 100,
        },
        combatData: {
            level: 1,
            hp: 40, maxHp: 40,
            power: 0, powerSoftcap: 5
        },
        inventoryData: {
            maxInventorySpace: 20,
            currencyOne: 0, currencyTwo: 0,
            inventory: [2,"none","none","none","none", // First 5 items are the hotbar
                        "none","none","none","none","none",
                        "none","none","none","none","none",
                        "none","none","none","none","none"
            ],
        },
        abilityData: {
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
        },
        statisticData: {
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
        },
        srsSettingsData: {
            //trialsPerRandomDysymbolia: 8,
            reinforcementIntervalLength: 10,
        },
        kanjiData: [],
        theoryData: [],
        conditions: [
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
        ],
    }

    scene.worldX = 80;
    scene.worldY = 20;

    scene.camX = 0;
    scene.camY = 0;

    // The number of characters displayed per second
    scene.defaultTextSpeed = 200;

    // Counts the minutes elapsed from 0:00 in the day, for now it goes up 1 every second
    scene.currentGameClock = 600;

    scene.menuTabList = ["Inventory","Abilities","Kanji List","Theory","Settings","Save"];

    // If non-null, menu is open and menuScene is a string that is one of the above menu scenes
    scene.menuScene = null;
    scene.readingLoadStatement = false;
    scene.loadStatement = null;

    // Object that holds dialogue data
    /* scene.dialogue is null when there is no current dialogue, or an object with these properties:
        startTime (number) time dialogue started
        lineStartTime (number) time the current line started
        currentLine (number of the current index for faces and lines to be displayed)
        faces (array)
        lines (array)
        cinematic (object) when any kind of special scene is playing during a dialogue. when not null the dialogue will not be continued with the z button
    */
    scene.dialogue = null;
    scene.combat = null;
    scene.roomEnemies = [];

    scene.ingameLog = [];

    // Game time is paused during dialogue, dysymbolia, and when menu is opened.
    // THis allows time to be updated appropriately when we have the timestamp and ingame time of the last pause
    scene.timeOfLastUnpause = scene.timeOfSceneChange;
    scene.gameClockOfLastPause = 600;

    scene.trialsSinceLastNewKanji = 0;
    scene.trialsThisSession = 0;

    bgColor = 'rgb(103,131,92)';
    initializeNewSaveGame();
    initializeDialogue("scenes","opening scene",scene.timeOfSceneChange);
    updateConditionTooltips();
    updateInventory();

    // Button for opening in-game menu
    scene.buttons.push({
        x:scene.worldX+18*16*scene.sizeMod*2 +157, y:scene.worldY+750, width:50, height:30,
        neutralColor: '#b3b3ff', hoverColor: '#e6e6ff', pressedColor: '#ff66ff', color: '#b3b3ff',
        text: "Menu", font: '13px zenMaruRegular', fontSize: 18,
        onClick: function() {
            if(scene.menuScene === null){
                scene.menuScene = "Inventory";
                scene.gameClockOfLastPause = scene.currentGameClock;
                for(let i in scene.buttons){
                    let b = scene.buttons[i];

                    // If it has the tab property it is a menu tab changing button
                    // This has me really raise my eyebrows at the state management of this program lol
                    if(b.hasOwnProperty("tab")){
                        b.enabled = true;
                    }
                }
                initializeMenuTab();
                this.text = "Close Menu";
                this.width = 80;
                this.x -= 15;
            } else {
                scene.menuScene = null;
                scene.timeOfLastUnpause = performance.now();
                for(let i = scene.buttons.length-1;i>=0;i--){
                    let b = scene.buttons[i];

                    // If it has the tab property it is a menu tab changing button
                    if(b.hasOwnProperty("tab")){
                        b.enabled = false;
                    }
                    if(scene.buttons[i].temporaryMenuButton !== undefined && scene.buttons[i].temporaryMenuButton){
                        scene.buttons.splice(i,1);
                    }
                }
                scene.handleDraggingObject = undefined;
                scene.draggingObject = null;
                updateInventory();
                this.text = "Menu";
                this.width = 50;
                this.x += 15;
            }
        }
    });

    // Menu buttons
    for(const [i, sceneName] of scene.menuTabList.entries()){
        let onClick;
        if(sceneName === "Kanji List"){
            onClick = function() {
                scene.menuScene = this.tab;
                initializeMenuTab();
            };
        } else {
            onClick = function() {
                scene.menuScene = this.tab;
                initializeMenuTab();
            };
        }
        let newIngameMenuButton = {
            x:scene.worldX+20, y:scene.worldY+65+30+78*i, width:160, height:60, shadow: 12,
            neutralColor: '#b3b3ff', hoverColor: '#e6e6ff', pressedColor: '#ff66ff', color: '#b3b3ff',
            text: scene.menuTabList[i], font: '22px zenMaruLight', fontSize: 22, jp: false, tab: scene.menuTabList[i],
            enabled: false,
            onClick: onClick,
        }
        scene.buttons.push(newIngameMenuButton);
    }

    // Initialize buttons
    for(let i in scene.buttons){
        let b = scene.buttons[i];

        // Register dictionary lookup tooltip boxes from buttons that are japanese
        if (b.jp){
            let words = b.text.split("=");
            let characterNumber = 0;
            let text = b.text.replaceAll("=",""); // this is to be able to get an accurate length
            for (let i in words){
                let word = words[i];
                if(dictionary.entries.hasOwnProperty(word)){

                    // Add tooltip box to scene
                    scene.tooltipBoxes.push({
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
    xClicked = zClicked = doubleClicked = false;
}

/*
    Scene draw + update functions and scene definition array
*/

// Array of all defined scenes
let sceneDefinitions = [];


/********************************* Adventure scene *************************************/

// Contains the kanji data specfic to the current player
//var playerKanjiData = [];

// Contains the theory unlock data of the current player
//var playerTheoryUnlockedData = [];

// Call to initialize the game when no save file is being loaded and the game is to start from the beginning
function initializeNewSaveGame(){
    let playerKanjiData = scene.player.kanjiData;
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

    let playerTheoryData = scene.player.theoryData;
    for(let i=0;i<theoryWriteupData.length;i++){
        playerTheoryData.push({
            unlocked: false,
            conditionsMet: false,
        });
    }

    let playerAbilityData = scene.player.abilityData;
    for(let i=0;i<abilityFileData.length;i++){
        playerAbilityData.acquiredAbilities[abilityFileData[i].name] = false;
    }

    scene.sessionTrials = [];
}

function outputSaveGame(){
    let saveGame = {
        // version the game was saved in
        version: "negative infinity",

        // all the player data because it is all designed to be saved
        player: scene.player,

        clock: scene.currentGameClock,
        gameClockOfLastPause: scene.gameClockOfLastPause,

        dialogue: scene.dialogue,

        combat: scene.combat,

        levelNum: scene.levelNum,
    }
    return saveGame;
}

function loadSaveGame(slot){
    try {
        //alert(localStorage.getItem("save 1"));
        let save = JSON.parse(localStorage.getItem("save "+slot));
        //alert(save);
        scene.player = save.player;
        scene.currentGameClock = save.clock;
        scene.gameClockOfLastPause = save.gameClockOfLastPause;
        scene.dialogue = save.dialogue;
        scene.combat = save.combat;
        scene.levelNum = save.levelNum;
        scene.selectedAbility = 0;
        scene.selectedWriteup = 0;
        scene.readingLoadStatement = true;

        currentDirectionFrozen = false;

        // Particle systems have to be made again or nullified
        for(let i=0;i<scene.player.conditions.length;i++){
            let condition = scene.player.conditions[i];
            if(condition.name === "Dysymbolia"){
                condition.particleSystem = null;
            }
        }

        // Restore our date objects
        for(let i=0;i<scene.player.kanjiData.length;i++){
            let kanji = scene.player.kanjiData[i];

            for(let j=0;j<kanji.trialHistory.length;j++){
                kanji.trialHistory[j].dateStamp = new Date(kanji.trialHistory[j].dateStamp);
            }
        }

        if(scene.player.abilityData.acquiringAbility !== null){
            let buttonDimensions = {x:scene.worldX+18*16*scene.sizeMod*2+123, y:scene.worldY+700, width:120, height:30};
            scene.acquisitionButtonParticleSystem = createParticleSystem({
                x: [buttonDimensions.x,buttonDimensions.x+buttonDimensions.width], y:[buttonDimensions.y,buttonDimensions.y],
                hue: 280, saturation: 100, lightness: 55, startingAlpha: 0.7,
                particlesPerSec: 70, drawParticles: drawParticlesTypeZero, newParticle: newParticleTypeTwo,
                particleSize: 10, particleLifespan: 550, mod: 1.2, shift: 1.3, particleSpeed: 260, gravity: -300,
                sourceType: "line", specialDrawLocation: true,
            });
            scene.particleSystems.push(scene.acquisitionButtonParticleSystem);
        }

        scene.sessionTrials = [];

        alert("successfully loaded i think");
    }
    catch (err) {
        alert("save failed: "+err);
    }
}

function saveToLocalStorage(slot){
    try {
        localStorage.setItem("save "+slot,JSON.stringify(outputSaveGame()));
        alert("successfully saved... something. hopefully you'll be able to load this");
    }
    catch (err) {
        alert("save failed: "+err);
    }
}

// Takes a kanji from the player's kanjiData and assigns a number indicating the priority of the next trial of it.
// This is where the srs lives
function assignStudyPriority(kanji, currentDate, noNewKanji = false){
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
        trialsSinceLastTrial = scene.trialsThisSession - (kanji.lastTrialNum+1);
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
        return (scene.trialsSinceLastNewKanji+1)*400 - kanji.index/10 - kanji.trialHistory.length*100;
    }
}

// after completing a trial, this function adds the trial to the kanji and updates all the information of it, if needed
function addTrial(kanji, succeeded){
    const masteryStageIntervals = [0,1,3,7,21,90,Infinity];

    if(typeof kanji === "number"){
        kanji = scene.player.kanjiData[kanji];
    }
    kanji.trialHistory.push({
        dateStamp: new Date(),
        success: succeeded,
    });

    kanji.lastTrialNum = scene.trialsThisSession;
    scene.trialsThisSession++;
    if(kanji.masteryStage === 0){
        scene.trialsSinceLastNewKanji = 0;
    } else {
        scene.trialsSinceLastNewKanji++;
    }

    if(succeeded && kanji.daysUntilMasteryIncreaseOpportunity === 0){
        kanji.masteryStage++;
        kanji.highestMasteryStage = Math.max(kanji.masteryStage,kanji.highestMasteryStage);
        kanji.daysUntilMasteryIncreaseOpportunity = masteryStageIntervals[kanji.masteryStage];
        scene.player.statisticData.totalKanjiMastery++;
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
let evaluateUnlockRequirements = function(requirements){
    let unlocked = true;
    for(let i=0;i<requirements.length;i++){
        let r = requirements[i];
        if(r.type === "statistic threshold"){
            r.progress = scene.player.statisticData[r.stat];
            if(r.progress < r.number){
                unlocked = false;
            }
        } else if(r.type === "acquired ability"){
            if(scene.player.abilityData.acquiredAbilities[r.ability]){
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
function updateConditionTooltips(){
    // Delete existing condition tooltops first
    for(let i = scene.tooltipBoxes.length-1;i>=0;i--){
        if(scene.tooltipBoxes[i].type === "condition"){
            scene.tooltipBoxes.splice(i,1);
        }
    }

    let conditionLine = "Conditions: ";
    let conditionLineNum = 0;
    let conditionWord = "";
    context.font = '18px zenMaruMedium';
    context.textAlign = 'left';
    for(let i in scene.player.conditions){
        const condition = scene.player.conditions[i];

        if((conditionLine + condition.name).length > "Conditions: Dysymbolia, Hunger, aaa".length){
            conditionLine = "";
            conditionLineNum++;
        }

        scene.tooltipBoxes.push({
            x: scene.worldX+18*16*scene.sizeMod*2+30 + 20+context.measureText(conditionLine).width,
            y: scene.worldY+210-18+conditionLineNum*24,
            width: context.measureText(condition.name).width, height: 18,
            type: "condition", condition: condition, spawnTime: 0,
        });
        if(i < scene.player.conditions.length-1){
            conditionLine += condition.name+", ";
        } else {
            conditionLine += condition.name;
        }
    }

    reapplyTooltip();
}

// Registers the tooltip boxes for the player's inventory while optionally adding an item in the highest slot
function updateInventory(addItem = "none"){
    for(let i = scene.tooltipBoxes.length-1;i>=0;i--){
        if(scene.tooltipBoxes[i].type === "item"){
            scene.tooltipBoxes.splice(i,1);
        }
    }
    let inventoryData = scene.player.inventoryData;
    for(let i=0; i<inventoryData.inventory.length; i++){
        let item = inventoryData.inventory[i];
        if(item !== "none"){
            if(i<5){
                scene.tooltipBoxes.push({
                    x: scene.worldX+18*16*scene.sizeMod*2+30 + 28+50*i,
                    y: scene.worldY+690,
                    width: 45, height: 45,
                    type: "item", item: item, inventoryIndex: i, spawnTime: 0,
                });
            }
            if(scene.menuScene === "Inventory"){
                scene.tooltipBoxes.push({
                    x: scene.worldY+285+105+67*(i%5),
                    y: scene.worldY+160 + 67*Math.floor(i/5),
                    width: 60, height: 60,
                    type: "item", item: item, inventoryIndex: i, spawnTime: 0,
                });
            }
        } else if(addItem !== "none"){
            inventoryData.inventory[i] = addItem;
            scene.tooltipBoxes.push({
                x: scene.worldX+18*16*scene.sizeMod*2+30 + 28+50*i,
                y: scene.worldY+690,
                width: 45, height: 45,
                type: "item", item: addItem, inventoryIndex: i, spawnTime: 0,
            });
            addItem = "none";
        }
    }

    reapplyTooltip();
}

// Will add graphics associated with awarding stuff to the player much later
function awardPlayer(award,timeStamp){
    let inventoryData = scene.player.inventoryData;
    if(typeof award === "object"){
        inventoryData.currencyTwo += award.number;

        addIngameLogLine(`Awarded with ${award.number} diamonds!`,180,100,70,1,timeStamp);
    }
}

// Update the player's ability data with the current listed and aquirable abilities
function updatePlayerAbilityList(){
    let playerAbilityData = scene.player.abilityData;
    let newAbilityList = [];

    for(let i=0;i<abilityFileData.length;i++){
        let a = abilityFileData[i];

        if(evaluateUnlockRequirements(a.listRequirements)){
            let unlocked = evaluateUnlockRequirements(a.unlockRequirements);
            newAbilityList.push({
                name: a.name,
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

// Initialize the menu tab, also used to update it sometimes...
function initializeMenuTab(){
    for(let i = scene.tooltipBoxes.length-1;i>=0;i--){
        if(scene.tooltipBoxes[i].type === "item"){
            scene.tooltipBoxes.splice(i,1);
        } else if(scene.tooltipBoxes[i].type === "kanji list entry"){
            scene.tooltipBoxes.splice(i,1);
        } else if(scene.tooltipBoxes[i].type === "ability menu ability") {
            scene.tooltipBoxes.splice(i,1);
        } else if(scene.tooltipBoxes[i].type === "write-up entry") {
            scene.tooltipBoxes.splice(i,1);
        }
    }
    for(let i = scene.buttons.length-1;i>=0;i--){
        if(scene.buttons[i].temporaryMenuButton !== undefined && scene.buttons[i].temporaryMenuButton){
            scene.buttons.splice(i,1);
        }
    }

    scene.handleDraggingObject = undefined;
    scene.draggingObject = null;

    if(scene.menuScene === "Inventory"){
        updateInventory();

        scene.handleDraggingObject = function(action){
            if(action==="mousedown"){
                for(let i=0;i<Math.ceil(scene.player.inventoryData.inventory.length/5);i++){
                    for(let j=0;j<5;j++){
                        let box = {
                            x: scene.worldY+285+105+67*j,
                            y: scene.worldY+160 + 67*i,
                            width: 60,
                            height: 60
                        };
                        if (mouseX >= box.x && mouseX <= box.x + box.width && mouseY >= box.y && mouseY <= box.y + box.height) {
                            if(scene.player.inventoryData.inventory[j + i*5] !== "none"){
                                scene.draggingObject = [box.x,box.y,mouseX,mouseY,scene.player.inventoryData.inventory[j + i*5],j + i*5];
                                scene.player.inventoryData.inventory[j + i*5] = "none";
                            }
                            break;
                        }
                    }
                }

            } else if(action==="mousemove"){
                //scene.draggingObject[2] = mouseX;
                //scene.draggingObject[3] = mouseY;
            } else if(action==="mouseup"){
                let boxFound = false;
                for(let i=0;i<Math.ceil(scene.player.inventoryData.inventory.length/5);i++){
                    for(let j=0;j<5;j++){
                        let box = {
                            x: scene.worldY+285+105+67*j,
                            y: scene.worldY+160 + 67*i,
                            width: 60,
                            height: 60
                        };
                        if (mouseX >= box.x && mouseX <= box.x + box.width && mouseY >= box.y && mouseY <= box.y + box.height) {
                            boxFound = true;
                            scene.player.inventoryData.inventory[scene.draggingObject[5]] = scene.player.inventoryData.inventory[j + i*5];
                            scene.player.inventoryData.inventory[j + i*5] = scene.draggingObject[4];
                            updateInventory();
                            break;
                        }
                    }
                }
                if(!boxFound){
                    scene.player.inventoryData.inventory[scene.draggingObject[5]] = scene.draggingObject[4];
                }
                scene.draggingObject = null;
            }
        }
    } else if(scene.menuScene === "Kanji List"){
        let rowAmount = 12;
        for(let i=0;i<Math.ceil(adventureKanjiFileData.length/rowAmount);i++){
            for(let j=0; j<Math.min(rowAmount,adventureKanjiFileData.length-i*rowAmount);j++){
                scene.tooltipBoxes.push({
                    x: scene.worldY+295+45*j,
                    y: scene.worldY+140+45*i,
                    spawnTime: 0,
                    width: 45, height: 45,
                    type: "kanji list entry", index: j + i*rowAmount,
                });
            }
        }
        if(!scene.hasOwnProperty("selectedKanji")){
            scene.selectedKanji = 0;
        }

        scene.buttons.push({
            x:scene.worldX+18*16*scene.sizeMod*2+107, y:scene.worldY+700, width:150, height:30,
            neutralColor: '#b3b3ff', hoverColor: '#e6e6ff', pressedColor: '#ff66ff', color: '#b3b3ff',
            text: "Toggle Enabled Status", font: '13px zenMaruRegular', fontSize: 18, enabled: true, temporaryMenuButton: true,
            onClick: function(){
                scene.player.kanjiData[scene.selectedKanji].enabled = !scene.player.kanjiData[scene.selectedKanji].enabled;
            }
        });
    } else if(scene.menuScene === "Theory"){
        let playerTheoryData = scene.player.theoryData;
        for(let i=0;i<theoryWriteupData.length;i++){
            scene.tooltipBoxes.push({
                x: scene.worldX+240,
                y: scene.worldY+140 + 45*i,
                spawnTime: 0,
                width: 18*scene.tileSize+1-55, height: 40,
                type: "write-up entry", index: i,
            });
            if(evaluateUnlockRequirements(theoryWriteupData[i].unlockRequirements)){
                playerTheoryData[i].conditionsMet = true;
            }
        }
        if(!scene.hasOwnProperty("isReadingWriteup")){
            scene.isReadingWriteup = false;
        }
        if(!scene.hasOwnProperty("selectedWriteup")){
            scene.selectedWriteup = 0;
        }

        if(scene.isReadingWriteup){
            let writeupInfo = theoryWriteupData[scene.selectedWriteup];

            scene.buttons.push({
                x:scene.worldX+18*16*scene.sizeMod*2+132, y:scene.worldY+700, width:100, height:30,
                neutralColor: '#b3b3ff', hoverColor: '#e6e6ff', pressedColor: '#ff66ff', color: '#b3b3ff',
                text: "Stop Reading", font: '13px zenMaruRegular', fontSize: 18, enabled: true, temporaryMenuButton: true,
                onClick: function(){
                    scene.isReadingWriteup = false;
                    initializeMenuTab();
                }
            });

            if(writeupInfo.currentPage > 0){
                scene.buttons.push({
                    x:scene.worldX+(18*scene.tileSize/2)+120, y:scene.worldY+18*scene.tileSize*scene.sizeMod-150, width:35, height:35,
                    neutralColor: '#b3b3ff', hoverColor: '#e6e6ff', pressedColor: '#ff66ff', color: '#b3b3ff', radius:1,
                    text: "<", font: '30px zenMaruRegular', fontSize: 30, enabled: true, temporaryMenuButton: true,
                    onClick: function(){
                        theoryWriteupData[scene.selectedWriteup].currentPage--;
                        initializeMenuTab();
                    }
                });
            }

            if(writeupInfo.currentPage < writeupInfo.pages.length-1){
                scene.buttons.push({
                    x:scene.worldX+(18*scene.tileSize/2)+280, y:scene.worldY+18*scene.tileSize*scene.sizeMod-150, width:35, height:35,
                    neutralColor: '#b3b3ff', hoverColor: '#e6e6ff', pressedColor: '#ff66ff', color: '#b3b3ff', radius:1,
                    text: ">", font: '30px zenMaruRegular', fontSize: 30, enabled: true, temporaryMenuButton: true,
                    onClick: function(){
                        theoryWriteupData[scene.selectedWriteup].currentPage++;
                        initializeMenuTab();
                    }
                });
            }
        } else {
            if(playerTheoryData[scene.selectedWriteup].unlocked){
                scene.buttons.push({
                    x:scene.worldX+18*16*scene.sizeMod*2+157, y:scene.worldY+700, width:50, height:30,
                    neutralColor: '#b3b3ff', hoverColor: '#e6e6ff', pressedColor: '#ff66ff', color: '#b3b3ff',
                    text: "Read", font: '13px zenMaruRegular', fontSize: 18, enabled: true, temporaryMenuButton: true,
                    onClick: function(){
                        scene.isReadingWriteup = true;
                        initializeMenuTab();
                    }
                });
            } else if(playerTheoryData[scene.selectedWriteup].conditionsMet){
                scene.buttons.push({
                    x:scene.worldX+18*16*scene.sizeMod*2+98, y:scene.worldY+700, width:170, height:30,
                    neutralColor: '#ff6', hoverColor: '#ffffb3', pressedColor: '#66f', color: '#ff6',
                    text: "Unlock and Collect Reward", font: '13px zenMaruRegular', fontSize: 18, enabled: true, temporaryMenuButton: true,
                    onClick: function(){
                        let theoryNum = scene.selectedWriteup;
                        if(scene.player.theoryData[theoryNum].conditionsMet){
                            scene.player.theoryData[theoryNum].unlocked = true;
                            scene.isReadingWriteup = true;
                            for(let i in theoryWriteupData[theoryNum].unlockRewards){
                                awardPlayer(theoryWriteupData[theoryNum].unlockRewards[i],performance.now());
                            }
                            initializeMenuTab();
                        }
                    }
                });
            }
        }
    } else if(scene.menuScene === "Abilities"){
        updatePlayerAbilityList();
        let playerAbilityList = scene.player.abilityData.list;

        let rowAmount = 10;
        for(let i=0;i<Math.ceil(playerAbilityList.length/rowAmount);i++){
            let currentRowWidth = Math.min(rowAmount,playerAbilityList.length-i*rowAmount);
            for(let j=0; j<currentRowWidth;j++){
                scene.tooltipBoxes.push({
                    x: scene.worldX+247+250-currentRowWidth*25+50*j,
                    y: scene.worldY+200+70,
                    spawnTime: 0,
                    width: 45, height: 45,
                    type: "ability menu ability", index: j + i*rowAmount,
                });
            }
        }
        if(!scene.hasOwnProperty("selectedAbility")){
            scene.selectedAbility = 0;
        }

        let playerAbilityInfo = playerAbilityList[scene.selectedAbility];
        let abilityInfo = abilityFileData[playerAbilityInfo.index];
        if(!playerAbilityInfo.acquired && playerAbilityInfo.unlocked && scene.player.combatData.power >= abilityInfo.acquisitionPower){
            scene.buttons.push({
                x:scene.worldX+18*16*scene.sizeMod*2+123, y:scene.worldY+700, width:120, height:30,
                neutralColor: '#ff6', hoverColor: '#ffffb3', pressedColor: '#66f', color: '#ff6',
                text: "Begin Acquisition", font: '13px zenMaruRegular', abilityIndex: playerAbilityInfo.index, fontSize: 14, enabled: true, temporaryMenuButton: true,
                onClick: function(){
                    if(this.text === "Begin Acquisition" && scene.player.abilityData.acquiringAbility === null && scene.dialogue === null){
                        scene.player.abilityData.acquiringAbility = this.abilityIndex;
                        scene.player.sceneData.timeUntilDysymbolia = 0;
                        this.text = "Acquisition Begun!";
                        scene.acquisitionButtonParticleSystem = createParticleSystem({
                            x: [this.x,this.x+this.width], y:[this.y,this.y], hue: 280, saturation: 100, lightness: 55, startingAlpha: 0.7,
                            particlesPerSec: 70, drawParticles: drawParticlesTypeZero, newParticle: newParticleTypeTwo,
                            particleSize: 10, particleLifespan: 550, mod: 1.2, shift: 1.3, particleSpeed: 260, gravity: -300,
                            sourceType: "line", specialDrawLocation: true,
                        });
                        scene.particleSystems.push(scene.acquisitionButtonParticleSystem);
                    }
                }
            });
        }

        scene.handleDraggingObject = function(action){
            if(action==="mousedown"){
                if(scene.currentTooltip && scene.tooltipBoxes[scene.currentTooltip.index].type === "ability menu ability" && scene.player.abilityData.acquiredAbilities[scene.player.abilityData.list[scene.tooltipBoxes[scene.currentTooltip.index].index].name]){
                    scene.draggingObject = [scene.tooltipBoxes[scene.currentTooltip.index].x,scene.tooltipBoxes[scene.currentTooltip.index].y,mouseX,mouseY,scene.tooltipBoxes[scene.currentTooltip.index].index];
                } else {
                    for(let i=0;i<scene.player.abilityData.abilitySlots;i++){
                        let box = {
                            x: scene.worldX+247+250-scene.player.abilityData.abilitySlots*25+50*i,
                            y: scene.worldY+135,
                            width: 45,
                            height: 45
                        };
                        if (mouseX >= box.x && mouseX <= box.x + box.width && mouseY >= box.y && mouseY <= box.y + box.height) {
                            if(scene.player.abilityData.equippedAbilities[i] !== null){
                                scene.draggingObject = [box.x,box.y,mouseX,mouseY,scene.player.abilityData.equippedAbilities[i]];
                                scene.player.abilityData.equippedAbilities[i] = null;
                            }
                            break;
                        }
                    }
                }

            } else if(action==="mousemove"){
                //scene.draggingObject[2] = mouseX;
                //scene.draggingObject[3] = mouseY;
            } else if(action==="mouseup"){
                for(let i=0;i<scene.player.abilityData.abilitySlots;i++){
                    let box = {
                        x: scene.worldX+247+250-scene.player.abilityData.abilitySlots*25+50*i,
                        y: scene.worldY+135,
                        width: 45,
                        height: 45
                    };
                    if (mouseX >= box.x && mouseX <= box.x + box.width && mouseY >= box.y && mouseY <= box.y + box.height) {
                        scene.player.abilityData.equippedAbilities[i] = scene.draggingObject[4];
                        for(let j=0;j<scene.player.abilityData.equippedAbilities.length;j++){
                            if(j !== i && scene.player.abilityData.equippedAbilities[j] === scene.draggingObject[4]){
                                scene.player.abilityData.equippedAbilities[j] = null;
                            }
                        }
                        break;
                    }
                }
                scene.draggingObject = null;
            }
        }

        if(scene.draggingObject === undefined){
            scene.draggingObject = null
        }

    } else if(scene.menuScene === "Save") {
        for(let i=0;i<5;i++){
            scene.buttons.push({
                x:scene.worldX+247+90, y:scene.worldY+150+i*40, width:310, height:35,
                neutralColor: '#b3b3ff', hoverColor: '#e6e6ff', pressedColor: '#ff66ff', color: '#b3b3ff',
                text: "Save Game to Local Storage Slot "+i, font: '17px zenMaruRegular', fontSize: 17, enabled: true, temporaryMenuButton: true,
                slot: i,
                onClick: function(){
                    // Only designed to be used during certain states of the game
                    if(scene.dialogue === null || scene.dialogue.cinematic === null){
                        saveToLocalStorage(this.slot);
                    } else {
                        alert("Game is not currently in a savable state. Maybe finish whatever you were doing in the world?")
                    }
                }
            });
            scene.buttons.push({
                x:scene.worldX+247+87, y:scene.worldY+370+i*40, width:320, height:35,
                neutralColor: '#b3b3ff', hoverColor: '#e6e6ff', pressedColor: '#ff66ff', color: '#b3b3ff',
                text: "Load Game from Local Storage Slot "+i, font: '17px zenMaruRegular', fontSize: 17, enabled: true, temporaryMenuButton: true,
                slot: i,
                onClick: function(){
                    loadSaveGame(this.slot);
                }
            });
        }

        updateInventory();
    } else {
        updateInventory();
    }
}

function useItem(inventoryIndex,particleSysX,particleSysY){
    let item = scene.player.inventoryData.inventory[inventoryIndex];
    let info = itemInfo[item];

    if(info.name === "Dev Gun"){
        addIngameLogLine(`You feel really cool for having this don't you.`,180,100,70,1.7,performance.now());
        if(movingAnimationDuration === 200){
            movingAnimationDuration = 40;
        } else {
            movingAnimationDuration = 200;
        }
    } else {
        for(const eff of info.effectList){
            if(eff === "heal"){
                scene.player.combatData.hp = Math.min(scene.player.combatData.maxHp,scene.player.combatData.hp+info.effects.healAmount);
            } else if (eff === "satiate"){
                // TODO make a full hunger system
                for(let i=scene.player.conditions.length-1;i>=0;i--){
                    if(scene.player.conditions[i].name === "Hunger"){
                        scene.player.conditions.splice(i,1);
                        updateConditionTooltips();
                    }
                }
            }
        }

        scene.particleSystems.push(createParticleSystem({hue:120,saturation:100,lightness:50,x:particleSysX, y:particleSysY, temporary:true, particlesLeft:10, particleSpeed: 200, particleAcceleration: -100, particleLifespan: 2000}));

        scene.player.inventoryData.inventory[inventoryIndex] = "none";
    }

    updateInventory();
}

// Called when dialogue begins
// Entity index is the index of the entity that is being interacted with in the level
function initializeDialogue(category, scenario, timeStamp, entityIndex = null){
    scene.dialogue = {
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
    scene.gameClockOfLastPause = scene.currentGameClock;
    currentDirectionFrozen = true;
}
function endDialogue(timeStamp){
    currentDirectionFrozen = false;
    scene.dialogue = null;
    scene.timeOfLastUnpause = timeStamp;
}

// Draws text one word at a time to be able to finely control what is written, designed to be a version of wrapText with much more features,
//  including utilizing and managing its own particle systems
// Uses the dialogue object in the scene to figure out what to write.

// registerTooltopBox is an object with all the tooltip information needed other than x and y
//  and this function will register the box with the missing information filled in
function drawDialogueText(x, y, maxWidth, lineHeight, timeStamp, registerTooltipBox = null) {
    let d = scene.dialogue;
    // First cuts up the dialogue text
    let words = d.textLines[d.currentLine].replace(/playerName/g,scene.player.sceneData.name).split(' ');

    let testLine = ''; // This will store the text when we add a word, to test if it's too long
    let lineArray = []; // Array of the individual words, a new array is a new line
    // The words are arrays with text, x, and y and are all to be drawn at the end

    let currentX = x; // x coordinate in which to draw the next word
    let currentY = y; // y coordinate in which to draw the next word

    let textSpeed = d.lineInfo[d.currentLine].textSpeed;
    if(textSpeed === undefined){
        textSpeed = scene.defaultTextSpeed;
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
            for(let i=0;i<registerTooltipBox.tooltipTargets.length;i++){
                if(word[0].includes(registerTooltipBox.tooltipTargets[i])){
                    // Add tooltip box to scene
                    scene.tooltipBoxes.push({
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
        context.fillText(word[0],word[1],word[2]);
    }

    for (const word of deferredWords) {
        let fontSize = Math.floor(16*scene.sizeMod);
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

// Checks if a tile is marked for collision or not. Scene must be adventure scene.
// checkAdjacent to be set to "up" "left" "right" or "down" or to be left undefined
// - if defined, checks that adjacent tile instead of the one directly indicated by the x and y
// Returns:
// null for no collision, "bounds" for level boundary collision, returns the num of the collision tile if collision tile, or
//returns the reference to the entity object that was collided for entity collision
function isCollidingOnTile(x, y, checkAdjacent = false){
    let lev = levels[scene.levelNum];
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
    scene.ingameLog.push(
        {
            text: lineText,
            h: h, s: s, l: l,
            durationMultiplier: durationMultiplier,
            timeAdded: timeStamp,
        }
    );
}

function updateAdventure(timeStamp){
    let lev = levels[scene.levelNum];
    let playerSceneData = scene.player.sceneData;
    // Update in-game time
    let newTime = (scene.gameClockOfLastPause+Math.floor((timeStamp-scene.timeOfLastUnpause)/1000))%1440;

    // If a second went by, update everything that needs to be updated by the second
    if(scene.dialogue === null && scene.menuScene === null && scene.combat === null && (newTime > scene.currentGameClock || (scene.currentGameClock === 1439 && newTime !== 1439))){
        if(playerSceneData.timeUntilDysymbolia > 0){
            playerSceneData.timeUntilDysymbolia-=1;
        }

        // Begin dysymbolia dialogue!
        else if (scene.player.abilityData.acquiringAbility !== null){
            initializeDialogue("abilityAcquisition",abilityFileData[scene.player.abilityData.acquiringAbility].name,timeStamp);
        } else if (!scene.player.statisticData.finishedFirstRandomDysymboliaScene){
            initializeDialogue("randomDysymbolia","first",timeStamp);
            scene.player.statisticData.finishedFirstRandomDysymboliaScene = true;
        } else {
            initializeDialogue("randomDysymbolia","auto",timeStamp);
        }
        scene.currentGameClock = newTime;
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
            particleSystem: scene.particleSystems[scene.particleSystems.length-1],
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
            let lev = levels[scene.levelNum];
            scene.roomEnemies = [];
            if(connectionId){
                // Changes the player's location to the exit location of the connected location
                for(let i=0;i<connections.length;i++){
                    if(connections[i].connectionId === connectionId && connections[i].area === lev.iid){
                        let exitLocation = moveInDirection(connections[i].exitLocation,scene.tileSize,connections[i].exitDirection);
                        scene.player.sceneData.location = [exitLocation[0],exitLocation[1]];
                        scene.player.sceneData.graphicLocation = [exitLocation[0],exitLocation[1]];
                        scene.player.sceneData.src = [32,spritesheetOrientationPosition[connections[i].exitDirection]*32];
                        currentDirection = connections[i].exitDirection;
                        break;
                    }
                }
            }
            for(let i=0;i<levels[scene.levelNum].entities.length;i++){
                if(lev.entities[i].type === "enemy"){
                    let enemy = lev.entities[i];
                    let enemyInfo = enemyFileData[enemy.fileDataIndex];
                    enemy.hp = enemy.maxHp = enemyInfo.hp;

                    scene.roomEnemies.push(enemy);
                }
            }
        }
        for(let i in levels){
            if(levels[i].iid === iid || levels[i].identifier === iid){
                scene.levelNum = i;
                if(scene.combat){
                    scene.combat = null;
                    scene.timeOfLastUnpause = timeStamp;
                }
                initializeArea();
                return;
            }
        }
        throw "changeArea: New area not found: " + iid;
    }

    // Get the kanji with the highest study priority and return its player.kanjiData entry
    let getNextKanji = function(noNewKanji = false, special = false){
        let currentDate = new Date();
        let highestPriorityIndex = 0;
        if(!special){
            let priority = assignStudyPriority(scene.player.kanjiData[0],currentDate,noNewKanji);
            let highestPriority = priority;

            for(let i=1;i<scene.player.kanjiData.length;i++){
                priority = assignStudyPriority(scene.player.kanjiData[i],currentDate,noNewKanji);
                if(priority>highestPriority){
                    highestPriority = priority;
                    highestPriorityIndex = i;
                }
            }
        } else {
            let specialKanji = abilityFileData[scene.player.abilityData.acquiringAbility].specialKanji;
            let priority = assignStudyPriority(scene.player.kanjiData[specialKanji[0]],currentDate,false);
            let highestPriority = priority;
            highestPriorityIndex = specialKanji[0];

            for(let i=1;i<specialKanji.length;i++){
                priority = assignStudyPriority(scene.player.kanjiData[specialKanji[i]],currentDate,false);
                if(priority>highestPriority){
                    highestPriority = priority;
                    highestPriorityIndex = specialKanji[i];
                }
            }
        }

        return scene.player.kanjiData[highestPriorityIndex];
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

            scene.combat.currentEnemyAction = {
                actionInfo: action,
                startTime: timeStamp,
            };
            scene.combat.enemyActionEffectApplied = false;
        }
        if(scene.combat !== null){
            takeCombatAction(scene.combat.enemy);
            scene.combat.turnCount++;
        } else {
            for(let i=0;i<scene.roomEnemies.length;i++){
                let enemy = scene.roomEnemies[i];
                let step = routeTowardsPlayer();
                if(step === "adjacent"){
                    // initialize combat. we dont use a seperate funciton for this yet.
                    scene.combat = {
                        enemy: enemy,
                        currentEnemyAction: null,
                        currentPlayerAction: null,
                        enemyActionEffectApplied: false,
                        playerActionEffectApplied: false,
                        turnCount: 0,
                        status: "ongoing",
                    }
                    takeCombatAction(scene.roomEnemies[i],i);
                    scene.gameClockOfLastPause = scene.currentGameClock;
                    scene.combat.turnCount++;
                }
            }
        }
    }

    let applyUpkeepEffects = function(){
        let newConditions = [];
        let isUpdateNecessary = false;
        let poisonDamageTaken = 0;
        for(let i=0;i<scene.player.conditions.length;i++){
            let condition = scene.player.conditions[i];
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
            scene.player.combatData.hp-=poisonDamageTaken;
            scene.player.statisticData.totalDamageTaken+=poisonDamageTaken;
            addIngameLogLine(`Took ${poisonDamageTaken} poison damage.`,78,100,40,1.5,timeStamp);
        }

        if(isUpdateNecessary){
            scene.player.conditions = newConditions;
            updateConditionTooltips();
        }
    }

    let applyPlayerActionEffect = function(){
        let enemy = scene.combat.enemy;

        let damage = Math.min(2,enemy.hp);
        enemy.hp -= damage;

        addIngameLogLine(`Mari stomped the lizard dealing ${damage} damage!`,0,100,100,1.5,timeStamp);

        if(enemy.hp<=0){
            addIngameLogLine(`Mari has defeated a Green Lizard!`,130,100,65,0.65,timeStamp);
            enemy.ephemeral = true;
            enemy.visible = false;
            scene.combat.status = "enemy defeated";
        }

        applyUpkeepEffects();

        scene.combat.playerActionEffectApplied = true;
    }

    let applyEnemyActionEffect = function(){
        let enemy = scene.combat.enemy;
        let enemyInfo = enemyFileData[enemy.fileDataIndex];
        let action = scene.combat.currentEnemyAction.actionInfo;

        scene.player.combatData.hp -= action.power;
        scene.player.statisticData.totalDamageTaken += action.power;
        addIngameLogLine(action.text.replace("{damage}", action.power),0,90,70,1.5,timeStamp);

        if(action.condition !== undefined){
            let newCondition = {
                name: action.condition.name,
                color: action.condition.color,
                desc: action.condition.desc,
                turnsLeft: action.condition.minDuration + Math.floor(Math.random()*(action.condition.maxDuration+1-action.condition.minDuration)),
            }
            scene.player.conditions.push(newCondition);
            updateConditionTooltips();
        }

        scene.activeDamage = {
            // If startFrame is positive, there is currently active damage.
            startFrame: timeStamp,

            // Duration of the current damage
            duration: 1,

            // How much the screen was shaken by
            offset: [0,0],

            // Last time the screen was shaken to not shake every single frame
            timeOfLastShake: -1,
        };
        scene.combat.enemyActionEffectApplied = true;
    }

    // Usually called when the player presses a key but can be called for other reasons during a cinematic
    let advanceDialogueState = function(advanceToNextLine = true){
        // Advance the cinematic state
        let advanceCinematicState = function(){
            if(scene.dialogue.cinematic.type === "dysymbolia" && scene.dialogue.cinematic.phaseNum === 0){
                // Begin the inputting phase
                scene.dialogue.cinematic.phaseNum = 1;
                scene.dialogue.cinematic.phaseStartTime = timeStamp;
                scene.inputting = true;
                scene.finishedInputting = false;
            } else if (scene.dialogue.cinematic.type === "dysymbolia" && scene.dialogue.cinematic.phaseNum > 2) {
                if(scene.dialogue.cinematic.trialsLeft < 1){
                    if(scene.dialogue.cinematic.specialTrialsLeft < 1){
                        // Finish cinematic and end dialogue
                        scene.blur = 0;
                        scene.textEntered = "";
                        playerSceneData.timeUntilDysymbolia = 60;
                        note = "無";
                        for(let i in scene.player.conditions){
                            if(scene.player.conditions[i].name === "Dysymbolia"){
                                scene.player.conditions[i].golden = false;
                                scene.player.conditions[i].color = `white`;
                                updateConditionTooltips();
                            }
                        }
                        for(let i = scene.tooltipBoxes.length-1;i>=0;i--){
                            if(scene.tooltipBoxes[i].type === "dictionary" || scene.tooltipBoxes[i].type === "kanji"){
                                scene.tooltipBoxes.splice(i,1);
                                //if(scene.currentTooltip !== null && scene.currentTooltip.index === i){
                                    scene.currentTooltip = null;
                                //}
                            }
                        }
                        if(scene.dialogue.scenario.includes("tutorial") || scene.dialogue.category === "randomDysymbolia"){
                            if(scene.player.statisticData.totalPowerGained <= 5){
                                initializeDialogue("scenes","post dysymbolia "+scene.player.statisticData.totalPowerGained,timeStamp);
                            } else {
                                endDialogue(timeStamp);
                            }
                        } else if(scene.dialogue.category === "abilityAcquisition"){
                            scene.dialogue.cinematic = null;
                            if(!scene.dialogue.dysymboliaFailed){
                                // Acquire ability!
                                let playerAbilityInfo = scene.player.abilityData.list[scene.player.abilityData.acquiringAbility];
                                let abilityInfo = abilityFileData[playerAbilityInfo.index]

                                scene.player.combatData.power -= abilityInfo.acquisitionPower;
                                playerAbilityInfo.acquired = true;
                                scene.player.abilityData.acquiredAbilities[abilityInfo.name] = true;
                                scene.player.abilityData.acquiringAbility = null;
                                scene.acquisitionButtonParticleSystem.temporary = true;
                                scene.acquisitionButtonParticleSystem.particlesLeft = 0;

                                scene.dialogue.currentLine++; scene.dialogue.currentLine++;
                                advanceDialogueState(false);
                            } else {
                                advanceDialogueState();
                            }

                            return;
                        } else {
                            endDialogue(timeStamp);
                        }
                    } else {
                        // Do a special trial
                        for(let i in scene.player.conditions){
                            if(scene.player.conditions[i].name === "Dysymbolia"){
                                scene.player.conditions[i].golden = true;
                                scene.player.conditions[i].color = `hsl(60,100%,65%)`;
                                updateConditionTooltips();
                            }
                        }

                        let specialParticleSystem = scene.dialogue.lineInfo[scene.dialogue.currentLine].specialParticleSystem;
                        specialParticleSystem.specialDrawLocation = true;

                        scene.particleSystems.push(createParticleSystem(specialParticleSystem));

                        playerSceneData.timeUntilDysymbolia = -1;
                        let kanjiPlayerInfo = getNextKanji(false,true);
                        let kanjiFileInfo = adventureKanjiFileData[kanjiPlayerInfo.index];
                        scene.dialogue.cinematic = newDysymboliaCinematic(1,scene.dialogue.cinematic.trialsLeft,[kanjiFileInfo.symbol,[kanjiFileInfo.keyword.toLowerCase()],"white",kanjiFileInfo.symbol,kanjiPlayerInfo.index],scene.dialogue.cinematic.startTime,scene.dialogue.cinematic.trialedKanjiIndexes,scene.dialogue.cinematic.specialTrialsLeft);

                        scene.dialogue.textLines[scene.dialogue.currentLine] = scene.dialogue.textLines[scene.dialogue.currentLine] + " " + kanjiFileInfo.symbol + "...";
                        scene.inputting = true;
                        scene.finishedInputting = false;
                        scene.textEntered = "";
                        scene.dialogue.cinematic.specialTrialsLeft--;
                    }
                } else {
                    // Restart the cinematic at phase 1 until we can get through all the trials
                    let specialParticleSystem = scene.dialogue.lineInfo[scene.dialogue.currentLine].particleSystem;
                    specialParticleSystem.specialDrawLocation = true;

                    scene.particleSystems.push(createParticleSystem(specialParticleSystem));

                    playerSceneData.timeUntilDysymbolia = -1;
                    let kanjiPlayerInfo = null;
                    if(scene.dialogue.cinematic.specialTrialsLeft>0){
                        kanjiPlayerInfo = getNextKanji(true);
                    } else {
                        kanjiPlayerInfo = getNextKanji();
                    }
                    let kanjiFileInfo = adventureKanjiFileData[kanjiPlayerInfo.index];
                    scene.dialogue.cinematic = newDysymboliaCinematic(1,scene.dialogue.cinematic.trialsLeft,[kanjiFileInfo.symbol,[kanjiFileInfo.keyword.toLowerCase()],"white",kanjiFileInfo.symbol,kanjiPlayerInfo.index],scene.dialogue.cinematic.startTime,scene.dialogue.cinematic.trialedKanjiIndexes,scene.dialogue.cinematic.specialTrialsLeft);

                    scene.dialogue.textLines[scene.dialogue.currentLine] = scene.dialogue.textLines[scene.dialogue.currentLine] + " " + kanjiFileInfo.symbol + "...";
                    scene.inputting = true;
                    scene.finishedInputting = false;
                    scene.textEntered = "";
                }
            }
        } // Advance cinematic state function ends here

        let applyConditionalEffect = function(eff,lineInfo){
            if(eff === "end"){
                endDialogue(timeStamp);
            } else if (eff === "continue"){
                // do nothing lol
            } else if (eff === "altText"){
                scene.dialogue.textLines[scene.dialogue.currentLine] = lineInfo.altText;
            } else if (eff.includes("jump to")){
                scene.dialogue.currentLine = parseInt(eff[eff.length-1]);
                advanceToNextLine = false;
            }
        }

        if(scene.dialogue.cinematic !== null){
            advanceCinematicState();
        } else {
            // First, apply effects of the previous player response if there was one
            if(scene.dialogue.lineInfo[scene.dialogue.currentLine].playerResponses){
                let lineInfo = scene.dialogue.lineInfo[scene.dialogue.currentLine];
                if(lineInfo && lineInfo.selectedResponse !== undefined){
                    applyConditionalEffect(lineInfo.responseEffects[lineInfo.selectedResponse],lineInfo);
                }
                if(scene.dialogue === null){
                    return;
                }
            }

            if(scene.dialogue.textLines.length <= scene.dialogue.currentLine+1){
                // Finish dialogue if no more line
                endDialogue(timeStamp);
            } else {
                // Otherwise advance line
                scene.dialogue.lineStartTime = timeStamp;

                if(scene.dialogue.lineInfo[scene.dialogue.currentLine].takeEnemyTurn !== undefined){
                    takeEnemyActions();
                    endDialogue(timeStamp);
                    return;
                }

                if(advanceToNextLine){
                    scene.dialogue.currentLine++;
                }

                // Apply effects that are on the new line
                if(scene.dialogue.lineInfo[scene.dialogue.currentLine].addItem !== undefined){
                    updateInventory(scene.dialogue.lineInfo[scene.dialogue.currentLine].addItem);
                    addIngameLogLine("Mari added an item to her inventory!",130,100,70,2,timeStamp);
                }
                if(scene.dialogue.lineInfo[scene.dialogue.currentLine].takeFruit !== undefined){
                    updateInventory(0);
                    removeFruit(lev.entities[scene.dialogue.entityIndex]);
                    addIngameLogLine("Mari took a fruit from the tree.",130,100,70,2,timeStamp);
                }
                if(scene.dialogue.lineInfo[scene.dialogue.currentLine].areaChange !== undefined){
                    changeArea(scene.dialogue.lineInfo[scene.dialogue.currentLine].areaChange,scene.dialogue.lineInfo[scene.dialogue.currentLine].connectionId);
                }
                let lineInfo = scene.dialogue.lineInfo[scene.dialogue.currentLine];

                // Check for a conditional on the new line and evaluate
                if(lineInfo !== undefined && lineInfo.conditional !== undefined){
                    let conditionalEval = false;
                    if(lineInfo.conditional === "is wary of scene dysymbolia"){
                        if(scene.player.statisticData.totalSceneDysymboliaExperienced > 1){
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

                    scene.particleSystems.push(createParticleSystem(specialParticleSystem));
                    playerSceneData.timeUntilDysymbolia = -1;

                    scene.dialogue.cinematic = newDysymboliaCinematic(0,1,lineInfo.dysymbolia);

                } else if (lineInfo !== undefined && lineInfo.randomDysymbolia !== undefined){
                    let specialParticleSystem = scene.dialogue.lineInfo[scene.dialogue.currentLine].particleSystem;
                    specialParticleSystem.specialDrawLocation = true;

                    scene.particleSystems.push(createParticleSystem(specialParticleSystem));

                    playerSceneData.timeUntilDysymbolia = -1;
                    let kanjiPlayerInfo = getNextKanji();
                    let kanjiFileInfo = adventureKanjiFileData[kanjiPlayerInfo.index];
                    scene.dialogue.cinematic = newDysymboliaCinematic(0,5,[kanjiFileInfo.symbol,[kanjiFileInfo.keyword.toLowerCase()],"white",kanjiFileInfo.symbol,kanjiPlayerInfo.index]);

                    scene.dialogue.textLines[scene.dialogue.currentLine] = kanjiFileInfo.symbol + "...";
                } else if (lineInfo !== undefined && lineInfo.abilityAcquisition !== undefined){
                    scene.dialogue.dysymboliaFailed = false;

                    let specialParticleSystem = scene.dialogue.lineInfo[scene.dialogue.currentLine].particleSystem;
                    specialParticleSystem.specialDrawLocation = true;

                    scene.particleSystems.push(createParticleSystem(specialParticleSystem));

                    playerSceneData.timeUntilDysymbolia = -1;
                    let kanjiPlayerInfo = getNextKanji();
                    let kanjiFileInfo = adventureKanjiFileData[kanjiPlayerInfo.index];
                    scene.dialogue.cinematic = newDysymboliaCinematic(0,lineInfo.normalTrials,[kanjiFileInfo.symbol,[kanjiFileInfo.keyword.toLowerCase()],"white",kanjiFileInfo.symbol,kanjiPlayerInfo.index],timeStamp,[],lineInfo.specialTrials);

                    scene.dialogue.textLines[scene.dialogue.currentLine] = kanjiFileInfo.symbol + "...";
                }
            }
        }
    }

    const updateWorldScreen = function(){
        if(mouseDown && scene.currentTooltip && scene.tooltipBoxes[scene.currentTooltip.index].type === "condition" && scene.tooltipBoxes[scene.currentTooltip.index].condition.name === "Dysymbolia" && scene.player.abilityData.basicDysymboliaControl){
            if(playerSceneData.timeUntilDysymbolia > 0){
                playerSceneData.timeUntilDysymbolia = 0;
                scene.player.statisticData.totalDysymboliaManualTriggers++;
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
                user.graphicLocation = [user.location[0],user.location[1]+scene.tileSize*(1-animationCompletion)];
            } else if(animationInfo.direction === "Left"){
                user.graphicLocation = [user.location[0]+scene.tileSize*(1-animationCompletion),user.location[1]];
            } else if(animationInfo.direction === "Right"){
                user.graphicLocation = [user.location[0]-scene.tileSize*(1-animationCompletion),user.location[1]];
            } else if(animationInfo.direction === "Down"){
                user.graphicLocation = [user.location[0],user.location[1]-scene.tileSize*(1-animationCompletion)];
            }
        }

        const updateBasicAttackAnimation = function(user,receiver,timeElapsed){
            if(timeElapsed < 400){
                let factor = timeElapsed/2000;
                user.graphicLocation[0] = (user.location[0]+receiver.location[0]*factor)/(1+factor);
                user.graphicLocation[1] = (user.location[1]+receiver.location[1]*factor)/(1+factor);
            } else if(timeElapsed<600){
                if(!scene.combat.enemyActionEffectApplied){
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
        if(scene.dialogue !== null){
            // Handle cinematic
            if(scene.dialogue.cinematic !== null){
                // Handle scene dysynbolia
                if(scene.dialogue.cinematic.type === "dysymbolia"){
                    let timeElapsed = timeStamp-scene.dialogue.cinematic.startTime;
                    if(timeElapsed < 2500){
                        scene.blur = timeElapsed/500;
                    } else {
                        scene.blur = 5;
                    }
                    // If the inputting phase has began, handle update
                    if(scene.dialogue.cinematic.phaseNum === 1){
                        if(scene.inputting){
                            // If input entered
                            if(scene.finishedInputting){
                                if(scene.dialogue.cinematic.info[1].includes(scene.textEntered)){
                                    scene.dialogue.cinematic.result = "pass";
                                    if(scene.dialogue.cinematic.info.length > 4){
                                        addTrial(scene.dialogue.cinematic.info[4],true);
                                    }

                                } else {
                                    scene.dialogue.cinematic.result = "fail";
                                    if(scene.dialogue.cinematic.info.length > 4){
                                        addTrial(scene.dialogue.cinematic.info[4],false);
                                        if(scene.dialogue.category === "abilityAcquisition"){
                                            scene.dialogue.dysymboliaFailed = true;
                                        }
                                    }
                                }
                                scene.inputting = false;
                                scene.dialogue.cinematic.phaseStartTime = timeStamp;
                                scene.dialogue.cinematic.trialsLeft--;
                            }
                        } else if(scene.dialogue.cinematic.animationFinished && !scene.dialogue.cinematic.phaseNum < 3) {
                            // If animation finished, apply result, then start phase 3
                            scene.dialogue.cinematic.phaseNum = 3;
                            scene.dialogue.cinematic.phaseStartTime = timeStamp;
                            if(scene.dialogue.cinematic.trialsLeft <= 0){
                                scene.player.combatData.power = Math.min(scene.player.combatData.powerSoftcap,scene.player.combatData.power+1);
                                scene.player.statisticData.totalPowerGained++;
                            }
                            if(scene.dialogue.cinematic.result === "pass") {
                                // TODO: add option to not auto advance the cinematic state when the player passes by pressing a different key or something
                                // when the player passes, skip the story check phase
                                if(scene.dialogue.cinematic.trialsLeft > 0){
                                    advanceDialogueState();
                                }
                            } else {
                                // TODO: make taking damage a function that checks death and stuff lol
                                scene.player.combatData.hp -= 3;
                                scene.player.statisticData.totalDamageTaken += 3;
                                scene.activeDamage = {
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
                    }
                }
            }
            // If there isnt a cinematic theres nothing to handle about the dialogue in update phase
        } else {
            // If not in an animation, handle movement
            if(playerSceneData.animation===null){
                playerSceneData.src = [32,spritesheetOrientationPosition[currentDirection]*32];

                if(currentDirection === "Down" && downPressed){
                    let collision = isCollidingOnTile(playerSceneData.location[0],playerSceneData.location[1],"Down");
                    if(collision===null){
                        playerSceneData.location[1]+=32;
                        initializeAnimation("basic movement",playerSceneData,currentDirection);
                        scene.player.statisticData.stepCount++;
                    } else if (collision === "bounds"){
                        for(const n of levels[scene.levelNum].neighbours){
                            if(n.dir === "s"){
                                changeArea(n.levelIid);
                                playerSceneData.location[1]=-32;
                                break;
                            }
                        }
                    }
                } else if(currentDirection === "Left" && leftPressed){
                    let collision = isCollidingOnTile(playerSceneData.location[0],playerSceneData.location[1],"Left");
                    if(collision===null){
                        playerSceneData.location[0]-=32;
                        initializeAnimation("basic movement",playerSceneData,currentDirection);
                        scene.player.statisticData.stepCount++;
                    } else if (collision === "bounds"){
                        for(const n of levels[scene.levelNum].neighbours){
                            if(n.dir === "w"){
                                changeArea(n.levelIid);
                                playerSceneData.location[0]=18*32;
                                break;
                            }
                        }
                    }
                } else if(currentDirection === "Right" && rightPressed){
                    let collision = isCollidingOnTile(playerSceneData.location[0],playerSceneData.location[1],"Right");
                    if(collision===null){
                        playerSceneData.location[0]+=32;
                        initializeAnimation("basic movement",playerSceneData,currentDirection);
                        scene.player.statisticData.stepCount++;
                    } else if (collision === "bounds"){
                        for(const n of levels[scene.levelNum].neighbours){
                            if(n.dir === "e"){
                                changeArea(n.levelIid);
                                playerSceneData.location[0]=-32;
                                break;
                            }
                        }
                    }
                } else if(currentDirection === "Up" && upPressed){
                    let collision = isCollidingOnTile(playerSceneData.location[0],playerSceneData.location[1],"Up");
                    if(collision===null){
                        playerSceneData.location[1]-=32;
                        initializeAnimation("basic movement",playerSceneData,currentDirection);
                        scene.player.statisticData.stepCount++;
                    } else if (collision === "bounds"){
                        for(const n of levels[scene.levelNum].neighbours){
                            if(n.dir === "n"){
                                changeArea(n.levelIid);
                                playerSceneData.location[1]=18*32;
                                break;
                            }
                        }
                    }
                }
            }
        }

        // Handle combat action and combat animation
        if(scene.combat !== null && scene.combat.currentEnemyAction !== null){
            // Enemy attack animation
            let timeElapsed = (timeStamp - scene.combat.currentEnemyAction.startTime);
            let enemy = scene.combat.enemy;

            if(updateBasicAttackAnimation(enemy,playerSceneData,timeElapsed) === "finished"){
                scene.combat.currentEnemyAction = null;
                if(!scene.player.statisticData.finishedDungeonScene){
                    initializeDialogue("scenes","tutorial dungeon scene 2",timeStamp)
                    scene.player.statisticData.finishedDungeonScene=true;
                }
            } else if(timeElapsed > 600 && !scene.combat.enemyActionEffectApplied){
                applyEnemyActionEffect();
            }
        } else if (scene.combat !== null && scene.combat.currentPlayerAction !== null){
            // Player attack animation
            let timeElapsed = (timeStamp - scene.combat.currentPlayerAction.startTime);
            let enemy = scene.combat.enemy;

            if(updateBasicAttackAnimation(playerSceneData, enemy, timeElapsed) === "finished"){
                if(scene.combat.status === "enemy defeated"){
                    for(let i = lev.entities.length-1;i<=0;i--){
                        if(lev.entities[i] == enemy){
                            lev.entities.splice(i,1);
                        }
                    }

                    scene.combat = null;
                } else {
                    scene.combat.currentPlayerAction = null;
                    takeEnemyActions();
                }
            } else if(timeElapsed > 600 && !scene.combat.playerActionEffectApplied){
                applyPlayerActionEffect();
            }
        }

        // Handle movement animation
        if(playerSceneData.animation && playerSceneData.animation.name === "basic movement"){
            updateMovementAnimation(playerSceneData,playerSceneData.animation);
        }

        // Handle input
        if(xClicked){
            xClicked = false;
        }
        if(zClicked){
            // Handle dialogue update on z press
            if(scene.dialogue !== null){
                advanceDialogueState();
            } else if(scene.combat !== null && (scene.combat.currentEnemyAction !== null || scene.combat.currentPlayerAction !== null)){
                // While an action is undergoing do not allow interaction
                /*scene.combat.currentPlayerAction = {
                    actionInfo: "basic attack",
                    startTime: timeStamp,
                };
                scene.combat.playerActionEffectApplied = false;*/
            } else { // If no dialogue, check for object interaction via collision
                let collision = isCollidingOnTile(playerSceneData.location[0],playerSceneData.location[1],currentDirection);
                if(collision !== null && typeof collision === "object"){
                    let entity = lev.entities[collision.index];
                    if(entity.id === "Fruit_Tree" && (entity.hasBottomFruit || entity.hasLeftFruit || entity.hasRightFruit)){
                        if(scene.player.statisticData.finishedFruitScene){
                            initializeDialogue("world","fruit_tree",timeStamp,collision.index);
                        } else {
                            initializeDialogue("scenes","tutorial fruit scene",timeStamp,collision.index);
                            scene.player.statisticData.finishedFruitScene = true;
                            scene.player.statisticData.totalSceneDysymboliaExperienced++;
                        }
                    } else if (entity.id === "Stairs") {
                        if(entity.connectionId === "first" && !scene.player.statisticData.finishedDungeonScene){
                            initializeDialogue("scenes","tutorial dungeon scene",timeStamp);
                        } else {
                            if(!scene.combat || !scene.combat.currentEnemyAction){
                                changeArea(entity.areaDestination,entity.connectionId);
                            }
                        }
                    } else if(entity.type === "character"){
                        if(currentDirection === "Down"){
                            entity.src[1] = spritesheetOrientationPosition.Up * 32;
                        } else if (currentDirection === "Right"){
                            entity.src[1] = spritesheetOrientationPosition.Left * 32;
                        } else if (currentDirection === "Left"){
                            entity.src[1] = spritesheetOrientationPosition.Right * 32;
                        } else {
                            entity.src[1] = spritesheetOrientationPosition.Down * 32;
                        }
                        initializeDialogue(entity.id.toLowerCase(),"initial",timeStamp,collision.index);
                    } else if(entity.type === "enemy") {
                        scene.combat.currentPlayerAction = {
                            actionInfo: "basic attack",
                            startTime: timeStamp,
                            enemyEntityIndex: collision.index,
                        };
                        scene.combat.playerActionEffectApplied = false;
                    }
                } else if(collision === 1){
                    if(scene.player.statisticData.finishedWaterScene){
                        initializeDialogue("world","water",timeStamp);
                    } else {
                        initializeDialogue("scenes","tutorial water scene",timeStamp);
                        scene.player.statisticData.finishedWaterScene = true;
                        scene.player.statisticData.totalSceneDysymboliaExperienced++;
                    }
                } else if(collision === 7){
                    if(scene.player.statisticData.finishedCloudScene){
                        initializeDialogue("world","clouds",timeStamp);
                    } else {
                        initializeDialogue("scenes","tutorial cloud scene",timeStamp);
                        scene.player.statisticData.finishedCloudScene = true;
                        scene.player.statisticData.totalSceneDysymboliaExperienced++;
                    }
                } else if(collision === 8){
                    initializeDialogue("world","sunflower",timeStamp);
                } else if(collision !== null){
                    console.warn("unknown collision type");
                }
            }
            zClicked = false;
        }
        if(upClicked){
            upClicked=false;
            if(scene.dialogue){
                let lineData = scene.dialogue.lineInfo[scene.dialogue.currentLine];
                if(lineData && lineData.selectedResponse !== undefined){
                    lineData.selectedResponse--;
                    if(lineData.selectedResponse < 0){
                        lineData.selectedResponse = lineData.playerResponses.length-1;
                    }
                }
            }
        }
        if(downClicked){
            downClicked=false;
            if(scene.dialogue){
                let lineData = scene.dialogue.lineInfo[scene.dialogue.currentLine];
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
        if(scene.menuScene === "Kanji List"){
            if(mouseDown && scene.currentTooltip && scene.tooltipBoxes[scene.currentTooltip.index].type === "kanji list entry"){
                scene.selectedKanji = scene.tooltipBoxes[scene.currentTooltip.index].index;
            }
        } else if(scene.menuScene === "Theory"){
            if(mouseDown && scene.currentTooltip && !scene.isReadingWriteup && scene.selectedWriteup !== scene.tooltipBoxes[scene.currentTooltip.index].index && scene.tooltipBoxes[scene.currentTooltip.index].type === "write-up entry"){
                scene.selectedWriteup = scene.tooltipBoxes[scene.currentTooltip.index].index;
                initializeMenuTab();
            }
        } else if(scene.menuScene === "Abilities"){
            if(mouseDown && scene.currentTooltip && scene.selectedAbility !== scene.tooltipBoxes[scene.currentTooltip.index].index && scene.tooltipBoxes[scene.currentTooltip.index].type === "ability menu ability"){
                scene.selectedAbility = scene.tooltipBoxes[scene.currentTooltip.index].index;
                initializeMenuTab();
            }
        }
        zClicked = xClicked = false;
    };

    if(scene.menuScene !== null){
        updateMenuScreen();
    } else {
        updateWorldScreen();
    }
    if(doubleClicked){
        if(scene.currentTooltip!== null){
            let tooltip = scene.tooltipBoxes[scene.currentTooltip.index];
            if(tooltip.type === "item"){
                useItem(tooltip.inventoryIndex,tooltip.x + tooltip.width/2,tooltip.y + tooltip.height/2);
            }
        }
        doubleClicked = false;
    }
}

function drawAdventure(timeStamp){
    // world width and height
    let w = 18*scene.tileSize;
    let h = 18*scene.tileSize;

    let playerSceneData = scene.player.sceneData;

    // Apply damage shake
    if(scene.activeDamage.startFrame > 0){
        let ad = scene.activeDamage;
        let secondsLeft = ad.duration - (timeStamp - ad.startFrame)/1000;
        if(secondsLeft <= 0){
            scene.activeDamage = {
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
        let lev = levels[scene.levelNum];

        let cameraCenterLocation;
        if(playerSceneData.animation && playerSceneData.animation.name === "basic movement"){
            cameraCenterLocation = playerSceneData.graphicLocation;
        } else {
            cameraCenterLocation = playerSceneData.location;
        }

        let camX;
        let camY;

        if(cameraCenterLocation[0] <= w/2) {
            camX = 0;
        } else if(cameraCenterLocation[0] >= lev.gridWidth*scene.tileSize-(w/2)) {
            camX = lev.gridWidth*scene.tileSize-w;
        } else {
            camX = cameraCenterLocation[0]-(w/2);
        }

        if(cameraCenterLocation[1] <= h/2) {
            camY = 0;
        } else if(cameraCenterLocation[1] >= lev.gridHeight*scene.tileSize-(h/2)) {
            camY = lev.gridHeight*scene.tileSize-h;
        } else {
            camY = cameraCenterLocation[1]-(h/2);
        }
        scene.camX = camX;
        scene.camY = camY;

        // Draw tile layers

        // Given absolute x and y of a tile, draw it relative to the camera, but only if it is visible
        const cameraTile = function(type, src, x, y){
            if(x-camX > -33 && x-camX < w && y-camY > -33 && y-camY < h){
                drawTile(type, src, scene.worldX+x*scene.sizeMod-camX*scene.sizeMod, scene.worldY+y*scene.sizeMod-camY*scene.sizeMod,32,scene.sizeMod);
            }
        }
        const cameraCharacter = function(character, src, x, y){
            if(x-camX > -33 && x-camX < w && y-camY > -33 && y-camY < h){
                drawCharacter(character, src, scene.worldX+x*scene.sizeMod-camX*scene.sizeMod, scene.worldY+y*scene.sizeMod-camY*scene.sizeMod,scene.sizeMod);
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
        let hours = Math.floor(scene.currentGameClock/60);
        let minutes = Math.floor(scene.currentGameClock%60);
        if(hours === 0){hours = 24;}
        if(hours>12){
            if(minutes<10){
                context.fillText(`${hours-12}:0${minutes} PM`,scene.worldX+15, scene.worldY+30);
            } else {
                context.fillText(`${hours-12}:${minutes} PM`,scene.worldX+15, scene.worldY+30);
            }
        } else {
            if(minutes<10){
                context.fillText(`${hours}:0${minutes} AM`,scene.worldX+15, scene.worldY+30);
            } else {
                context.fillText(`${hours}:${minutes} AM`,scene.worldX+15, scene.worldY+30);
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

        if(scene.combat && scene.combat.currentPlayerAction){

        } else {
            cameraCharacter("witch",playerSceneData.src,playerSceneData.graphicLocation[0],playerSceneData.graphicLocation[1],camX,camY);
        }

        for (let i in lev.entities){
            const e = lev.entities[i];
            if(e.visible){
                if(e.type === "character"){
                    cameraCharacter(e.id.toLowerCase(),e.src,e.graphicLocation[0]*scene.sizeMod,e.graphicLocation[1],camX,camY);
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

        if(scene.combat && scene.combat.currentPlayerAction){
            cameraCharacter("witch",playerSceneData.src,playerSceneData.graphicLocation[0],playerSceneData.graphicLocation[1],camX,camY);
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
                let phase = 0.5 + (scene.currentGameClock-300)/120
                let a = ((maximumDarkness/2) * Math.sin(Math.PI*phase))+maximumDarkness/2;
                context.fillStyle = `hsla(0, 0%, 0%, ${a})`;
            } else if(hours >= 17){
                // Sunrise. Starts at 5 PM (game clock 1020) finishes at 7 PM (game clock 1140)
                let phase = 1.5 + (scene.currentGameClock-300)/120
                let a = ((maximumDarkness/2) * Math.sin(Math.PI*phase))+maximumDarkness/2;
                context.fillStyle = `hsla(0, 0%, 0%, ${a})`;
            }
            context.fillRect(scene.worldX, scene.worldY, w*scene.sizeMod, h*scene.sizeMod);
        }

        let applyBlur = function(){
            if (scene.blur > 0) {
                context.filter = `blur(${scene.blur}px)`;
                // The canvas can draw itself lol
                context.drawImage(canvas,
                    scene.worldX, scene.worldY, scene.worldX+18*16*2*scene.sizeMod, scene.worldY+18*16*2*scene.sizeMod,
                    scene.worldX, scene.worldY, scene.worldX+18*16*2*scene.sizeMod, scene.worldY+18*16*2*scene.sizeMod,
                 );
                context.filter = "none";
            }
        }

        // Draw dialogue
        if(scene.dialogue !== null){

            context.fillStyle = 'hsl(0, 100%, 0%, 70%)';
            context.save();
            context.shadowColor = "hsl(0, 15%, 0%, 70%)";
            context.shadowBlur = 15;
            context.beginPath();
            context.roundRect(scene.worldX, scene.worldY+(h*scene.sizeMod)-96*scene.sizeMod, w*scene.sizeMod, scene.sizeMod*96);
            context.fill();
            context.restore();

            const faceCharacter = scene.dialogue.lineInfo[scene.dialogue.currentLine].face;
            const faceNum = scene.dialogue.lineInfo[scene.dialogue.currentLine].faceNum;

            context.fillStyle = textColor;
            let dialogueFontSize = Math.floor(16*scene.sizeMod);
            context.font = `${dialogueFontSize}px zenMaruRegular`;

            if(scene.dialogue.cinematic !== null){
                if(scene.dialogue.cinematic.type === "dysymbolia" && scene.dialogue.cinematic.phaseNum > 0 && scene.dialogue.cinematic.phaseNum < 3){
                    // draw shaded circle pre-blur
                    context.fillStyle = 'hsl(0, 100%, 0%, 20%)';
                    context.beginPath();
                    context.arc(scene.worldX + w*scene.sizeMod/2, scene.worldY + h*scene.sizeMod/2 - 10, 160, 0, 2 * Math.PI);
                    context.fill();
                }
            }

            context.fillStyle = textColor;

            // Draw differently depending on player vs non-player vs no image
            const drawDialogueForPlayer = function(facesImage){
                context.drawImage(facesImage, (faceNum%4)*faceBitrate, Math.floor(faceNum/4)*faceBitrate, faceBitrate, faceBitrate, scene.worldX, scene.worldY+(h*scene.sizeMod)-96*scene.sizeMod, 96*scene.sizeMod, 96*scene.sizeMod);
                applyBlur();

                if(scene.dialogue.cinematic !== null && scene.dialogue.cinematic.type === "dysymbolia" && scene.dialogue.cinematic.trialsLeft < 1 && scene.dialogue.cinematic.phaseNum === 3 && !scene.dialogue.cinematic.tooltipsRegistered){
                    if(scene.dialogue.cinematic.info.length > 4){
                        // TODO: figure out a way to refactor so this step isnt needed i swear
                        let tooltipTargets = [];
                        for(let i=0;i<scene.dialogue.cinematic.trialedKanjiIndexes.length;i++){
                            tooltipTargets.push(adventureKanjiFileData[scene.dialogue.cinematic.trialedKanjiIndexes[i]].symbol);
                        }
                        drawDialogueText((96+18)*scene.sizeMod+scene.worldX, (scene.worldY+h*scene.sizeMod-72*scene.sizeMod),(w*scene.sizeMod-124*scene.sizeMod),20*scene.sizeMod,timeStamp,
                            {
                                width: dialogueFontSize, height: 20*scene.sizeMod,
                                type: "kanji", indexes: scene.dialogue.cinematic.trialedKanjiIndexes,
                                tooltipTargets: tooltipTargets,
                            }
                        );
                        note = "Hover your mouse over the kanji to review.";
                    } else {
                        drawDialogueText((96+18)*scene.sizeMod+scene.worldX, (scene.worldY+h*scene.sizeMod-72*scene.sizeMod),(w*scene.sizeMod-124*scene.sizeMod),20*scene.sizeMod,timeStamp,
                            {
                                width: dialogueFontSize, height: 20*scene.sizeMod,
                                type: "dictionary", indexes: [null],
                                tooltipTargets: [scene.dialogue.cinematic.info[3]],
                            }
                        );
                        note = "Hover your mouse over the Japanese text for more info.";
                    }

                    scene.dialogue.cinematic.tooltipsRegistered = true;
                } else {
                    drawDialogueText((96+18)*scene.sizeMod+scene.worldX, (scene.worldY+h*scene.sizeMod-72*scene.sizeMod),(w*scene.sizeMod-124*scene.sizeMod),20*scene.sizeMod,timeStamp);
                }
            };
            const drawDialogueForNonPlayer = function(facesImage){
                context.save();
                context.scale(-1,1);
                context.drawImage(facesImage, (faceNum%4)*faceBitrate, Math.floor(faceNum/4)*faceBitrate, faceBitrate, faceBitrate, -1*(scene.worldX+w*scene.sizeMod), scene.worldY+h*scene.sizeMod-96*scene.sizeMod, 96*scene.sizeMod, 96*scene.sizeMod);
                context.restore();
                applyBlur();
                drawDialogueText((8+18)*scene.sizeMod+scene.worldX,scene.worldY+h*scene.sizeMod-72*scene.sizeMod,w*scene.sizeMod-144*scene.sizeMod,20*scene.sizeMod,timeStamp);
            };
            const drawDialogueForNobody = function(){
                applyBlur();
                drawDialogueText((8+18)*scene.sizeMod+scene.worldX,scene.worldY+h*scene.sizeMod-72*scene.sizeMod,w*scene.sizeMod-40*scene.sizeMod,20*scene.sizeMod,timeStamp);
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

            const playerResponses = scene.dialogue.lineInfo[scene.dialogue.currentLine].playerResponses;
            if(playerResponses !== undefined){
                context.fillStyle = 'hsl(0, 100%, 0%, 70%)';
                context.save();
                context.shadowColor = "hsl(0, 15%, 0%, 70%)";
                context.shadowBlur = 15;
                context.beginPath();
                context.roundRect(scene.worldX+w*scene.sizeMod*0.4, scene.worldY+(h*scene.sizeMod)-96*scene.sizeMod*1.8, w*scene.sizeMod*0.57, scene.sizeMod*65, 15);
                context.fill();
                context.restore();

                context.fillStyle = textColor;
                for(let i=0;i<playerResponses.length;i++) {
                    let text = playerResponses[i];
                    if(scene.dialogue.lineInfo[scene.dialogue.currentLine].selectedResponse === i){
                        text = "> " + text;
                    }
                    context.fillText(text, scene.worldX+w*scene.sizeMod*0.45,scene.worldY+(h*scene.sizeMod)-96*scene.sizeMod*1.52 + 20*scene.sizeMod*i);
                };
            }

            // Draw post blur cinematic elements
            if(scene.dialogue.cinematic !== null && scene.dialogue.cinematic.type === "dysymbolia" && scene.dialogue.cinematic.phaseNum > 0){
                let c = scene.dialogue.cinematic;
                if(c.result === null){
                    // Draw dysymbolia input elements
                    context.fillStyle = 'hsl(0, 100%, 100%, 80%)';
                    context.font = `${Math.floor(20*scene.sizeMod)}px zenMaruRegular`;
                    context.textAlign = 'center';
                    context.fillText("Enter keyword:", scene.worldX + w*scene.sizeMod/2, scene.worldY + (h-100)*scene.sizeMod/2);

                    context.fillStyle = "white";
                    context.fillText(scene.textEntered, scene.worldX + w*scene.sizeMod/2, scene.worldY + h*scene.sizeMod/2);

                    context.font = `${Math.floor(20*scene.sizeMod)}px Arial`;
                    context.fillStyle = "white";
                    context.fillText(c.info[0], scene.worldX + w*scene.sizeMod/2, scene.worldY + (h+100)*scene.sizeMod/2);
                } else if (c.phaseNum < 3){

                    /******* It is currently phase 2, so handle and draw the animation********/

                    context.fillStyle = 'hsl(0, 100%, 100%, 80%)';
                    context.font = `${Math.floor(20*scene.sizeMod)}px zenMaruRegular`;
                    context.textAlign = 'center';
                    context.fillText("Enter keyword:", scene.worldX + w*scene.sizeMod/2, scene.worldY + (h-100)*scene.sizeMod/2);

                    // Play the animation for dysymbolia text colliding
                    let animationDuration = 2000;
                    let animationProgress = (timeStamp - c.phaseStartTime)/animationDuration;
                    if (animationProgress >= 1){
                        if(c.result === "pass"){
                            // Green particle system
                            scene.particleSystems.push(createParticleSystem({hue:120,saturation:100,lightness:50,x:scene.worldX + w*scene.sizeMod/2, y:scene.worldY +h*scene.sizeMod/2, temporary:true, particlesLeft:25, particlesPerSec: 150,particleSpeed: 200, particleAcceleration: -100, particleLifespan: 2000}));
                        } else {
                            // Red particle system
                            scene.particleSystems.push(createParticleSystem({hue:0,saturation:100,lightness:50,x:scene.worldX + w*scene.sizeMod/2, y:scene.worldY +h*scene.sizeMod/2, temporary:true, particlesLeft:25, particlesPerSec: 150, particleSpeed: 200, particleAcceleration: -100, particleLifespan: 2000}));
                        }
                        c.animationFinished = true;
                    } else if (c.result === "pass") {
                        context.fillStyle = "white";
                        let inputTextWidth = context.measureText(scene.textEntered).width;
                        let xMod = Math.sin((Math.PI/2)*Math.max(1 - animationProgress*2,0.1));
                        let currentX = scene.worldX + w*scene.sizeMod/2 - (inputTextWidth/2)*xMod;
                        let yMod = Math.sin((Math.PI/2)*Math.min(2 - animationProgress*2,1));
                        if(xMod === Math.sin((Math.PI/2)*0.1)){
                            // Instead of drawing the input string, draw it as the kanji
                            context.fillText(c.info[0], scene.worldX + w*scene.sizeMod/2, scene.worldY + (h+50 - 50*yMod)*scene.sizeMod/2);
                        } else {
                            // Draw it the same way as the fail animation
                            for(let i=0;i<scene.textEntered.length;i+=1){
                                let charWidth = context.measureText(scene.textEntered[i]).width;
                                context.fillText(scene.textEntered[i], currentX + xMod*charWidth/2, scene.worldY + (h+50 - 50*yMod)*scene.sizeMod/2);
                                currentX += charWidth * xMod;
                            }
                        }

                        context.font = `${Math.floor(20*scene.sizeMod)}px Arial`;
                        context.fillText(c.info[0], scene.worldX + w*scene.sizeMod/2, scene.worldY + (h+50 + 50*yMod)*scene.sizeMod/2);
                    } else {
                        // Play the fail animation
                        context.fillStyle = "white";
                        let inputTextWidth = context.measureText(scene.textEntered).width;
                        let xMod = Math.sin(Math.PI/2*Math.max(1 - animationProgress*2,0.1));
                        let currentX = scene.worldX + w*scene.sizeMod/2 - (inputTextWidth/2)*xMod;
                        let yMod = Math.sin(Math.PI/2*Math.min(2 - animationProgress*2,1));
                        for(let i=0;i<scene.textEntered.length;i+=1){
                            let charWidth = context.measureText(scene.textEntered[i]).width;
                            context.fillText(scene.textEntered[i], currentX + xMod*charWidth/2, scene.worldY + (h+50 - 50*yMod)*scene.sizeMod/2);
                            currentX += charWidth * xMod;
                        }
                        context.font = `${Math.floor(20*scene.sizeMod)}px Arial`;
                        context.fillText(c.info[0], scene.worldX + w*scene.sizeMod/2, scene.worldY + (h+50 + 50*yMod)*scene.sizeMod/2);
                    }
                } else if(c.info.length>4){
                    /*** It is currently phase 3, so display the story associated with the current kanji ***/
                    let kanjiInfo = adventureKanjiFileData[c.info[4]];

                    // Background box
                    context.fillStyle = 'hsl(0, 0%, 10%, 55%)';
                    context.save();
                    context.shadowColor = "hsl(0, 30%, 0%)";
                    context.shadowBlur = 15;
                    context.beginPath();
                    context.roundRect(scene.worldX+scene.sizeMod*10, scene.worldY+scene.sizeMod*10, (w-20)*scene.sizeMod, h*scene.sizeMod*0.25, 30);
                    context.fill();
                    context.restore();

                    // Text
                    context.font = `${60*scene.sizeMod}px Arial`;
                    context.textAlign = 'center';
                    context.fillStyle = 'white';
                    context.fillText(c.info[0], scene.worldX+scene.sizeMod*85, scene.worldY+scene.sizeMod*80);

                    context.font = `${24*scene.sizeMod}px zenMaruMedium`;
                    context.fillText(kanjiInfo.keyword, scene.worldX+scene.sizeMod*85, scene.worldY+scene.sizeMod*120);

                    context.textAlign = 'left';
                    context.font = `${14*scene.sizeMod}px zenMaruRegular`;
                    let wrappedText = wrapText(context, kanjiInfo.story, scene.worldY+scene.sizeMod*50, w-scene.sizeMod*160, 16*scene.sizeMod+1);
                    wrappedText.forEach(function(item) {
                        // item[0] is the text
                        // item[1] is the y coordinate to fill the text at
                        context.fillText(item[0], scene.worldX+scene.sizeMod*180, item[1]);
                    });

                    // Divider bar
                    context.fillStyle = 'hsl(0, 100%, 100%, 60%)';
                    context.fillRect(scene.worldX+scene.sizeMod*160, scene.worldY+scene.sizeMod*30, 2, h*scene.sizeMod*0.25 - scene.sizeMod*40);
                }
            }
        }

        // Cover up the sides of the world
        context.beginPath();
        context.strokeStyle = bgColor;
        let lineWidth = 500;
        context.lineWidth = lineWidth;
        context.rect(scene.worldX-lineWidth/2, scene.worldY-lineWidth/2, w*scene.sizeMod+lineWidth, h*scene.sizeMod+lineWidth);
        context.stroke();

        context.font = '16px zenMaruRegular';
        context.fillStyle = textColor;
        context.textAlign = "left";
        context.fillText("Press Z to interact/continue dialogue",scene.worldX+100, scene.worldY+40+h*scene.sizeMod);

        if(note !== "無"){
            context.fillStyle = "hsla(61, 100%, 80%, 1)";
            context.font = '20px zenMaruRegular';
            context.fillText(note,scene.worldX+300, scene.worldY+70+h*scene.sizeMod);
        }
    }; // Draw world screen function ends here

    const drawMenuScreen = function(){
        // Background box
        context.fillStyle = 'hsl(0, 100%, 0%, 55%)';
        context.beginPath();
        context.roundRect(scene.worldX, scene.worldY, w*scene.sizeMod, h*scene.sizeMod, 30);
        context.fill();

        // Divider bar
        context.fillStyle = 'hsl(0, 100%, 100%, 40%)';
        context.fillRect(scene.worldX+200, scene.worldY+65, 2, w*scene.sizeMod - 140);

        // Tab title
        context.fillStyle = 'hsl(0, 100%, 100%, 40%)';
        context.fillRect(scene.worldX+375, scene.worldY+105, 240, 2);

        context.font = '36px zenMaruRegular';
        context.textAlign = 'center';
        context.fillStyle = 'white';
        context.fillText(scene.menuScene, scene.worldX+345 + 150, scene.worldY+80);

        // Each menu tab has its local function
        const drawInventoryScreen = function(){
            context.font = '18px zenMaruRegular';
            context.fillText("First 5 items can be used on the inventory hotbar!", scene.worldX+345 + 150, scene.worldY+580);
            context.fillText("Double click to use consumables!", scene.worldX+345 + 150, scene.worldY+630);
            context.fillText("Crafting coming soon?!????!??!!?", scene.worldX+345 + 150, scene.worldY+680);
            let inventoryData = scene.player.inventoryData;
            for(let i=0;i<Math.ceil(inventoryData.inventory.length/5);i++){
                for(let j=0;j<5;j++){
                    context.lineWidth = 2;
                    context.strokeStyle = 'hsla(270, 60%, 75%, 0.6)';
                    context.fillStyle = 'black';
                    context.beginPath();
                    context.roundRect(scene.worldY+285+105+67*j, scene.worldY+160 + 67*i, 60, 60, 3);
                    context.fill();
                    context.stroke();

                    if(inventoryData.inventory[j + i*5] !== "none"){
                        context.save();
                        context.translate(scene.worldY+285+105+67*j,scene.worldY+160 + 67*i);
                        context.scale(1.4,1.4);
                        drawItemIcon(inventoryData.inventory[j + i*5],-1,-1);
                        context.restore();
                    }
                }
            }

            if(scene.draggingObject){
                let offsetX = mouseX - scene.draggingObject[2], offsetY = mouseY - scene.draggingObject[3];

                context.save();
                context.translate(scene.draggingObject[0]+offsetX,scene.draggingObject[1]+offsetY);
                context.scale(1.4,1.4);
                drawItemIcon(scene.draggingObject[4],-1,-1);
                context.restore();
            }
        } // Draw inventory screen function ends here

        const drawKanjiScreen = function(){
            context.font = '26px Arial';
            context.textAlign = 'left';
            context.fillStyle = 'white';

            let playerKanjiData = scene.player.kanjiData;
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
                    if(scene.selectedKanji === currentIndex){
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
                    context.roundRect(scene.worldX+240+45*j, scene.worldY+140 + 45*i, 40, 40, 3);
                    context.fill();
                    context.stroke();

                    context.fillStyle = textFill;
                    context.fillText(adventureKanjiFileData[currentIndex].symbol,scene.worldX+240+45*j + 6,scene.worldY+140 + 45*i + 30)
                }
            }

            // Draw kanji info on side of screen
            if(scene.selectedKanji !== null){
                isToDrawStatusBar = false;

                let kanjiInfo = adventureKanjiFileData[scene.selectedKanji];
                let playerKanjiInfo = playerKanjiData[scene.selectedKanji];

                context.fillStyle = 'hsl(0, 0%, 10%, 55%)';
                context.save();
                context.shadowColor = "hsl(0, 30%, 0%)";
                context.shadowBlur = 15;
                context.beginPath();
                context.roundRect(scene.worldX+18*16*scene.sizeMod*2+30, scene.worldY, 305, 805, 30);
                context.fill();
                context.restore();

                context.font = '120px Arial';
                context.textAlign = 'center';
                context.fillStyle = 'white';
                context.fillText(kanjiInfo.symbol, scene.worldX+18*16*scene.sizeMod*2+30 + 150, scene.worldY+140);

                context.font = '32px zenMaruMedium';
                context.fillText(kanjiInfo.keyword, scene.worldX+18*16*scene.sizeMod*2+30 + 150, scene.worldY+210);

                context.font = '18px zenMaruRegular';
                context.textAlign = 'left';
                let bodyText = kanjiInfo.story;
                let wrappedText = wrapText(context, bodyText, scene.worldY+250, 240, 19);
                wrappedText.forEach(function(item) {
                    // item[0] is the text
                    // item[1] is the y coordinate to fill the text at
                    context.fillText(item[0], scene.worldX+18*16*scene.sizeMod*2+30 + 35, item[1]);
                });

                let belowStoryY = scene.worldY+250 + wrappedText.length*19;

                context.font = '16px zenMaruRegular';
                context.textAlign = 'center';
                context.fillText("Successfully captured "+playerKanjiInfo.trialSuccesses+ " times.", scene.worldX+18*16*scene.sizeMod*2+30 + 150, belowStoryY+45);
                context.fillText("Mastery stage "+playerKanjiInfo.masteryStage, scene.worldX+18*16*scene.sizeMod*2+30 + 150, belowStoryY+70);
                if(playerKanjiInfo.daysUntilMasteryIncreaseOpportunity > 0){
                    context.font = '16px zenMaruRegular';
                    context.fillText("Increase mastery in " + playerKanjiInfo.daysUntilMasteryIncreaseOpportunity + " days", scene.worldX+18*16*scene.sizeMod*2+30 + 150, belowStoryY+95);
                } else {
                    context.font = '16px zenMaruBold';
                    context.fillText("Capture to increase mastery!", scene.worldX+18*16*scene.sizeMod*2+30 + 150, belowStoryY+95);
                }


                if(!playerKanjiInfo.enabled){
                    context.textAlign = 'center';
                    context.font = '22px zenMaruBlack';
                    context.fillText("Disabled", scene.worldX+18*16*scene.sizeMod*2+30 + 150, scene.worldY+660);
                }
            }

            context.font = '22px zenMaruRegular';
            context.textAlign = 'center';
            context.fillStyle = 'white';
            context.fillText("Total mastery level "+scene.player.statisticData.totalKanjiMastery, scene.worldX+340 + 150, scene.worldY+h*scene.sizeMod-30);
        } // Draw kanji screen function ends here

        const drawTheoryScreen = function(){
            context.font = '20px ZenMaruRegular';
            context.textAlign = 'left';

            let playerTheoryData = scene.player.theoryData;
            if(!scene.isReadingWriteup){
                for(let i=0;i<theoryWriteupData.length;i++){
                    let theory = theoryWriteupData[i];

                    if(scene.selectedWriteup === i){
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
                    context.roundRect(scene.worldX+240, scene.worldY+140 + 45*i, w-55, 40, 5);
                    context.fill();
                    context.stroke();

                    context.fillStyle = 'white';
                    context.fillText(theory.title,scene.worldX+240 + 15,scene.worldY+140 + 45*i + 27);

                    if(!playerTheoryData[i].unlocked){
                        if(playerTheoryData[i].conditionsMet){
                            context.drawImage(miscImages.checklock,scene.worldX+240+w-55-35,scene.worldY+140 + 45*i + 7,21,25);
                        } else {
                            context.drawImage(miscImages.whitelock,scene.worldX+240+w-55-35,scene.worldY+140 + 45*i + 7,21,25);
                        }
                    }
                }

            } else {
                context.font = '18px ZenMaruRegular';
                let writeupInfo = theoryWriteupData[scene.selectedWriteup];
                let wrappedText = wrapText(context, writeupInfo.pages[writeupInfo.currentPage], scene.worldY+140, w-55, 20);
                wrappedText.forEach(function(item) {
                    // item[0] is the text
                    // item[1] is the y coordinate to fill the text at
                    context.fillText(item[0], scene.worldX+240, item[1]);
                });

                context.font = '22px zenMaruRegular';
                context.textAlign = 'center';
                context.fillStyle = 'white';
                context.fillText("Page "+(writeupInfo.currentPage+1)+"/"+writeupInfo.pages.length, scene.worldX+(18*scene.tileSize/2)+215, scene.worldY+h*scene.sizeMod-130);
            }

            if(scene.selectedWriteup !== null){
                isToDrawStatusBar = false;

                let writeupInfo = theoryWriteupData[scene.selectedWriteup];

                // Right-side box
                context.fillStyle = 'hsl(0, 0%, 10%, 55%)';
                context.save();
                context.shadowColor = "hsl(0, 30%, 0%)";
                context.shadowBlur = 15;
                context.beginPath();
                context.roundRect(scene.worldX+18*16*scene.sizeMod*2+30, scene.worldY, 305, 805, 30);
                context.fill();
                context.restore();

                let currentY = 50;

                // Write-up title
                context.font = '32px zenMaruMedium';
                context.fillStyle = 'white';
                context.textAlign = 'center';
                context.fillText("Title", scene.worldX+18*16*scene.sizeMod*2+30 + 150, scene.worldY+currentY);

                context.fillStyle = 'hsl(0, 100%, 100%, 40%)';
                context.fillRect(scene.worldX+18*16*scene.sizeMod*2+30 + 80, scene.worldY+currentY+15, 300-160, 2);

                context.font = '20px zenMaruRegular';
                context.fillStyle = 'white';
                let wrappedText = wrapText(context, writeupInfo.title, scene.worldY+currentY+48, 240, 22);
                context.textAlign = 'center';
                wrappedText.forEach(function(item) {
                    // item[0] is the text
                    // item[1] is the y coordinate to fill the text at
                    context.fillText(item[0], scene.worldX+18*16*scene.sizeMod*2+30 + 150, item[1]);
                });

                currentY += wrappedText.length*19+48;

                // Write-up description
                context.font = '18px zenMaruMedium';
                context.fillText("Description", scene.worldX+18*16*scene.sizeMod*2+30 + 150, scene.worldY+currentY+35);

                context.fillStyle = 'hsl(0, 100%, 100%, 40%)';
                context.fillRect(scene.worldX+18*16*scene.sizeMod*2+30 + 90, scene.worldY+currentY+35+13, 300-180, 2);

                context.font = '16px zenMaruRegular';
                context.fillStyle = 'white';
                context.textAlign = 'center';
                wrappedText = wrapText(context, writeupInfo.description, scene.worldY+currentY+35+38, 240, 18);
                wrappedText.forEach(function(item) {
                    // item[0] is the text
                    // item[1] is the y coordinate to fill the text at
                    context.fillText(item[0], scene.worldX+18*16*scene.sizeMod*2+30 + 150, item[1]);
                });

                currentY += wrappedText.length*18+35+38;

                // Write-up unlock requirements
                context.font = '17px zenMaruMedium';
                context.fillText("Unlock Requirements", scene.worldX+18*16*scene.sizeMod*2+30 + 150, scene.worldY+currentY+28);

                context.fillStyle = 'hsl(0, 100%, 100%, 40%)';
                context.fillRect(scene.worldX+18*16*scene.sizeMod*2+30 + 90, scene.worldY+currentY+28+13, 300-180, 2);

                currentY += 28+13;

                context.font = '16px zenMaruRegular';
                context.fillStyle = 'white';
                context.textAlign = 'center';
                for(let i=0; i<writeupInfo.unlockRequirements.length; i++){
                    let r = writeupInfo.unlockRequirements[i];
                    wrappedText = wrapText(context, r.textDescription+` (${r.progress}/${r.number})`, scene.worldY+currentY+25, 240, 18);
                    wrappedText.forEach(function(item) {
                        // item[0] is the text
                        // item[1] is the y coordinate to fill the text at
                        context.fillText(item[0], scene.worldX+18*16*scene.sizeMod*2+30 + 150, item[1]);
                    });
                }

                currentY += wrappedText.length*18+15;

                // unlock rewards
                context.font = '17px zenMaruMedium';
                context.fillText("Unlock Rewards", scene.worldX+18*16*scene.sizeMod*2+30 + 150, scene.worldY+currentY+28);

                context.fillStyle = 'hsl(0, 100%, 100%, 40%)';
                context.fillRect(scene.worldX+18*16*scene.sizeMod*2+30 + 90, scene.worldY+currentY+28+13, 300-180, 2);

                context.font = '16px zenMaruRegular';
                context.fillStyle = 'white';
                context.textAlign = 'center';
                let rewardText = writeupInfo.rewardText;
                if(playerTheoryData[scene.selectedWriteup].unlocked){
                    rewardText+= " (Collected)";
                }
                wrappedText = wrapText(context, rewardText, scene.worldY+currentY+28+38, 240, 18);
                wrappedText.forEach(function(item) {
                    // item[0] is the text
                    // item[1] is the y coordinate to fill the text at
                    context.fillText(item[0], scene.worldX+18*16*scene.sizeMod*2+30 + 150, item[1]);
                });
            }
        } // Draw theory screen function ends here

        const drawAbilityScreen = function(){
            let playerAbilityData = scene.player.abilityData;

            context.font = '20px ZenMaruRegular';
            context.textAlign = 'left';

            let currentY = 135;

            // Draw ability bar
            for(let i=0;i<playerAbilityData.abilitySlots;i++){
                if(playerAbilityData.equippedAbilities[i] !== null){
                    context.drawImage(abilityIcons[ scene.player.abilityData.list[playerAbilityData.equippedAbilities[i]].index ],scene.worldX+247+250-playerAbilityData.abilitySlots*25+50*i,scene.worldY+currentY,45,45);

                    context.lineWidth = 2;
                    context.strokeStyle = 'hsla(0, 30%, 60%, 1)';
                    context.beginPath();
                    context.roundRect(scene.worldX+247+250-playerAbilityData.abilitySlots*25+50*i, scene.worldY+currentY, 45, 45, 3);
                    context.stroke();
                } else {
                    context.lineWidth = 2;
                    context.strokeStyle = 'hsla(0, 30%, 60%, 1)';
                    context.beginPath();
                    context.roundRect(scene.worldX+247+250-playerAbilityData.abilitySlots*25+50*i, scene.worldY+currentY, 45, 45, 3);

                    context.fillStyle = 'black';
                    context.fill();
                    context.stroke();
                }
            }

            currentY += 65;

            context.font = '20px zenMaruRegular';
            context.fillStyle = 'white';
            context.textAlign = 'center';
            context.fillText("Ability List", scene.worldX+240+250, scene.worldY+currentY+25);

            context.fillStyle = 'hsl(0, 100%, 100%, 40%)';
            context.fillRect(scene.worldX+240+168, scene.worldY+currentY+25+15, 300-130, 2);

            // Draw ability list
            let rowAmount = 10;
            for(let i=0;i<Math.ceil(playerAbilityData.list.length/rowAmount);i++){
                let currentRowWidth = Math.min(rowAmount,playerAbilityData.list.length-i*rowAmount);
                for(let j=0; j<currentRowWidth;j++){
                    let currentIndex = j + i*rowAmount;

                    context.drawImage(abilityIcons[playerAbilityData.list[currentIndex].index],scene.worldX+247+250-currentRowWidth*25+50*j,scene.worldY+currentY+70+50*i,45,45);

                    context.lineWidth = 2;
                    if(scene.selectedAbility === currentIndex){
                        context.strokeStyle = 'hsla(60, 100%, 75%, 1)';
                    } else {
                        context.strokeStyle = 'hsla(0, 30%, 60%, 1)';
                    }

                    context.lineWidth = 2;
                    context.beginPath();
                    context.roundRect(scene.worldX+247+250-currentRowWidth*25+50*j, scene.worldY+currentY+70+50*i, 45, 45, 3);
                    context.stroke();
                }
            }

            if(scene.selectedAbility !== null){
                // Draw ability information on the right side
                isToDrawStatusBar = false;

                let playerAbilityInfo = playerAbilityData.list[scene.selectedAbility];
                let abilityInfo = abilityFileData[playerAbilityInfo.index];

                // Right-side box
                context.fillStyle = 'hsl(0, 0%, 10%, 55%)';
                context.save();
                context.shadowColor = "hsl(0, 30%, 0%)";
                context.shadowBlur = 15;
                context.beginPath();
                context.roundRect(scene.worldX+18*16*scene.sizeMod*2+30, scene.worldY, 305, 805, 30);
                context.fill();
                context.restore();

                context.drawImage(abilityIcons[playerAbilityInfo.index],scene.worldX+18*16*scene.sizeMod*2+30 + 150-50,scene.worldY+25,100,100);


                context.font = '24px zenMaruRegular';
                context.fillStyle = 'white';
                context.fillText(abilityInfo.name, scene.worldX+18*16*scene.sizeMod*2+30 + 150, scene.worldY+165);

                context.font = '16px zenMaruRegular';
                context.textAlign = 'left';

                let bodyText = abilityInfo.description;
                let wrappedText = wrapText(context, bodyText, scene.worldY+205, 260, 16);
                wrappedText.forEach(function(item) {
                    // item[0] is the text
                    // item[1] is the y coordinate to fill the text at
                    context.fillText(item[0], scene.worldX+18*16*scene.sizeMod*2+30 + 25, item[1]);
                });

                let currentY = scene.worldY+185 + wrappedText.length*16;

                if(!playerAbilityInfo.acquired){
                    context.textAlign = 'center';
                    context.font = '17px zenMaruMedium';
                    context.fillText("Unlock Requirements", scene.worldX+18*16*scene.sizeMod*2+30 + 150, scene.worldY+currentY+28);

                    context.fillStyle = 'hsl(0, 100%, 100%, 40%)';
                    context.fillRect(scene.worldX+18*16*scene.sizeMod*2+30 + 90, scene.worldY+currentY+28+13, 300-180, 2);

                    currentY += 28+13;

                    context.font = '16px zenMaruRegular';
                    context.fillStyle = 'white';
                    context.textAlign = 'center';
                    for(let i=0; i<abilityInfo.unlockRequirements.length; i++){
                        let r = abilityInfo.unlockRequirements[i];
                        wrappedText = wrapText(context, r.textDescription+` (${r.progress}/${r.number})`, scene.worldY+currentY+25, 240, 18);
                        wrappedText.forEach(function(item) {
                            // item[0] is the text
                            // item[1] is the y coordinate to fill the text at
                            context.fillText(item[0], scene.worldX+18*16*scene.sizeMod*2+30 + 150, item[1]);
                        });
                    }
                    currentY += 25+wrappedText.length*18;
                    if(playerAbilityInfo.unlocked){
                        context.font = '19px zenMaruMedium';
                        context.fillStyle = "#d600ba";
                        context.fillText(`${scene.player.combatData.power}/${abilityInfo.acquisitionPower} power to acquire!`, scene.worldX+18*16*scene.sizeMod*2+30 + 150, scene.worldY+currentY+28);
                    }
                }
                if(playerAbilityData.acquiringAbility === playerAbilityInfo.index){
                    scene.acquisitionButtonParticleSystem.drawParticles(performance.now());
                }
                if(playerAbilityData.acquiredAbilities[playerAbilityInfo.name]){
                    context.textAlign = 'center';
                    context.fillStyle = "white";
                    context.font = '22px zenMaruBlack';
                    context.fillText("Acquired", scene.worldX+18*16*scene.sizeMod*2+30 + 150, scene.worldY+670);

                    context.font = '18px zenMaruMedium';
                    context.fillText("Drag to Equip!", scene.worldX+18*16*scene.sizeMod*2+30 + 150, scene.worldY+710);
                }
            }

            if(scene.draggingObject){
                let offsetX = mouseX - scene.draggingObject[2], offsetY = mouseY - scene.draggingObject[3];
                context.drawImage(abilityIcons[ playerAbilityData.list[scene.draggingObject[4]].index ],scene.draggingObject[0]+offsetX,scene.draggingObject[1]+offsetY,45,45);
            }
        } // Draw ability screen function ends here

        if(scene.menuScene === "Inventory"){
            drawInventoryScreen();
        } else if(scene.menuScene === "Kanji List"){
            drawKanjiScreen();
        } else if(scene.menuScene === "Theory"){
            drawTheoryScreen();
        } else if(scene.menuScene === "Abilities"){
            drawAbilityScreen();
        }
    }

    if(scene.menuScene !== null){
        drawMenuScreen();
    } else {
        drawWorldScreen();
    }

    // Apply damage redness and finish shake
    if(scene.activeDamage.startFrame > 0){
        let ad = scene.activeDamage;
        let secondsLeft = ad.duration - (timeStamp - ad.startFrame)/1000;
        context.fillStyle = `hsla(0, 100%, 50%, ${0.2*secondsLeft})`
        context.fillRect(scene.worldX,scene.worldY,w*scene.sizeMod,h*scene.sizeMod);
        context.restore();
    }

    let logItemsDrawn = 0;
    // Draw the log
    for(let i=scene.ingameLog.length-1;i>=0;i--){
        let logItem = scene.ingameLog[i];
        let timeElapsed = timeStamp - logItem.timeAdded;
        let alpha = Math.min(200 - timeElapsed*logItem.durationMultiplier/30,100);

        if(alpha>0){
            context.save();
            context.fillStyle = `hsla(${logItem.h}, ${logItem.s}%, ${logItem.l}%, ${alpha}%)`;
            //context.fillStyle = `hsla(0, 0%, 100%, ${alpha}%)`;
            context.textAlign = 'center';

            context.shadowColor = "hsla(0, 30%, 0%, 45%)";
            context.shadowBlur = 12;

            let fontSize = Math.floor(16*scene.sizeMod);
            context.font = `${fontSize}px zenMaruRegular`;

            if(scene.menuScene !== null){
                context.fillText(logItem.text,scene.worldX+w*scene.sizeMod/2,scene.worldY+h*scene.sizeMod+64*scene.sizeMod-(fontSize+5)*logItemsDrawn);
            } else if(scene.dialogue){
                context.fillText(logItem.text,scene.worldX+w*scene.sizeMod/2,scene.worldY+h*scene.sizeMod-108*scene.sizeMod-(fontSize+5)*logItemsDrawn);
            } else {
                context.fillText(logItem.text,scene.worldX+w*scene.sizeMod/2,scene.worldY+h*scene.sizeMod-32*scene.sizeMod-(fontSize+5)*logItemsDrawn);
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
        context.roundRect(scene.worldX+18*16*scene.sizeMod*2+30, scene.worldY, 305, 805, 30);
        context.fill();
        context.restore();

        context.font = '32px zenMaruMedium';
        context.textAlign = 'center';
        context.fillStyle = 'white';
        context.fillText("Status", scene.worldX+18*16*scene.sizeMod*2+30 + 150, scene.worldY+50);
        drawCharacter("witch",[32,0],scene.worldX+18*16*scene.sizeMod*2+30 + 200,scene.worldY+122,1.5);

        context.font = '20px zenMaruMedium';
        context.fillText("Abilities", scene.worldX+18*16*scene.sizeMod*2+30 + 150, scene.worldY+505);

        // Draw ability bar
        for(let i=0;i<scene.player.abilityData.abilitySlots;i++){
            if(scene.player.abilityData.equippedAbilities[i] !== null){
                context.drawImage(abilityIcons[ scene.player.abilityData.list[scene.player.abilityData.equippedAbilities[i]].index ],scene.worldX+18*16*scene.sizeMod*2+30 + 28+50*i,scene.worldY+535,45,45);
            }

            context.lineWidth = 2;
            context.strokeStyle = 'hsla(0, 30%, 60%, 1)';
            context.beginPath();
            context.roundRect(scene.worldX+18*16*scene.sizeMod*2+30 + 28+50*i, scene.worldY+535, 45, 45, 3);
            context.stroke();
        }

        /*context.font = '15px zenMaruRegular';
        context.fillText("No learned abilities", scene.worldX+18*16*scene.sizeMod*2+30 + 150, scene.worldY+520);*/

        context.font = '20px zenMaruMedium';
        context.fillText("Inventory", scene.worldX+18*16*scene.sizeMod*2+30 + 150, scene.worldY+660);

        // Draw inventory hotbar
        for(let i=0;i<5;i++){
            context.lineWidth = 2;
            context.strokeStyle = 'hsla(270, 30%, 60%, 1)';
            context.beginPath();
            context.roundRect(scene.worldX+18*16*scene.sizeMod*2+30 + 28+50*i, scene.worldY+690, 45, 45, 3);
            context.stroke();

            if(scene.player.inventoryData.inventory[i] !== "none"){
                drawItemIcon(scene.player.inventoryData.inventory[i],scene.worldX+18*16*scene.sizeMod*2+30 + 28+50*i,scene.worldY+690);
            }
        }

        // Make underlines
        context.fillStyle = 'hsl(0, 100%, 100%, 40%)';
        context.fillRect(scene.worldX+18*16*scene.sizeMod*2+30 + 80, scene.worldY+65, 300-160, 2);
        context.fillRect(scene.worldX+18*16*scene.sizeMod*2+30 + 100, scene.worldY+520, 300-200, 2);
        context.fillRect(scene.worldX+18*16*scene.sizeMod*2+30 + 100, scene.worldY+675, 300-200, 2);

        context.font = '24px zenMaruRegular';
        context.textAlign = 'center';
        context.fillStyle = scene.player.sceneData.color;
        context.fillText(scene.player.sceneData.name, scene.worldX+18*16*scene.sizeMod*2+30 + 150, scene.worldY+100);

        context.font = '18px zenMaruMedium';
        context.textAlign = 'left';
        context.fillStyle = "White";
        context.fillText("HP: ", scene.worldX+18*16*scene.sizeMod*2+30 + 20, scene.worldY+140);
        context.fillText("Power: ", scene.worldX+18*16*scene.sizeMod*2+30 + 20, scene.worldY+165);

        context.fillStyle = "#40d600";
        context.fillText(scene.player.combatData.hp+"/"+scene.player.combatData.maxHp, scene.worldX+18*16*scene.sizeMod*2+30 + 20+context.measureText("HP: ").width, scene.worldY+140);

        context.fillStyle = "#d600ba";
        context.fillText(scene.player.combatData.power+"/"+scene.player.combatData.powerSoftcap, scene.worldX+18*16*scene.sizeMod*2+30 + 20+context.measureText("Power: ").width, scene.worldY+165);

        // Draw currencies
        context.drawImage(miscImages.gems,scene.worldX+18*16*scene.sizeMod*2+30+20,scene.worldY+750,26,26);
        context.drawImage(miscImages.gold,scene.worldX+18*16*scene.sizeMod*2+30+257,scene.worldY+750,26,26);
        context.font = '24px Arial';
        context.fillStyle = "#0cf";
        context.fillText(scene.player.inventoryData.currencyTwo, scene.worldX+18*16*scene.sizeMod*2+30+55, scene.worldY+772);
        context.fillStyle = "#fff01a";
        context.textAlign = 'right';
        context.fillText(scene.player.inventoryData.currencyOne, scene.worldX+18*16*scene.sizeMod*2+30+55+190, scene.worldY+772);

        context.textAlign = 'left';

        // Draw conditions
        let conditionLine = "Conditions: ";
        let conditionLineNum = 0;
        context.font = '18px zenMaruMedium';
        context.fillStyle = "White";
        context.fillText("Conditions: ", scene.worldX+18*16*scene.sizeMod*2+30 + 20, scene.worldY+210);

        for(let i in scene.player.conditions){
            const condition = scene.player.conditions[i];
            context.font = '18px zenMaruMedium';

            if( (conditionLine + condition.name).length > "Conditions: Dysymbolia, Hunger, aaa".length){
                conditionLine = "";
                conditionLineNum++;
            }

            let conditionX = scene.worldX+18*16*scene.sizeMod*2+30 + 20+context.measureText(conditionLine).width;
            let conditionY = scene.worldY+210+24*conditionLineNum;

            // Handle special drawing for the dysymbolia condition
            if(condition.name === "Dysymbolia" && playerSceneData.timeUntilDysymbolia < 30){
                context.font = `18px zenMaruBlack`;
                if(condition.particleSystem === null){
                    condition.particleSystem = createParticleSystem({
                        x: [conditionX,conditionX+context.measureText(condition.name).width], y:[conditionY,conditionY], hue: 0, saturation: 0, lightness: 100, startingAlpha: 0.005,
                        particlesPerSec: 50, drawParticles: drawParticlesTypeZero, newParticle: newParticleTypeTwo,
                        particleSize: 5, particleLifespan: 450, mod: 1.2, shift: 1.3, particleSpeed: 120, gravity: -300,
                        sourceType: "line", specialDrawLocation: true,
                    });
                    scene.particleSystems.push(condition.particleSystem);
                }
                let ps = condition.particleSystem;
                if(playerSceneData.timeUntilDysymbolia > -1){
                    let advancement = (30 - playerSceneData.timeUntilDysymbolia)/30;
                    ps.startingAlpha = advancement/1.5;
                    ps.particleLifespan = 250 + 300*advancement;
                    ps.particlesPerSec = 40 + 30*advancement;
                    ps.particleSize = 5 + 5*advancement;
                    ps.particleSpeed = 60 + 200*advancement;
                    ps.lightness = 100;

                    condition.color = `hsl(0,0%,${playerSceneData.timeUntilDysymbolia*(10/3)}%)`;
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
            if(i < scene.player.conditions.length-1){
                context.fillText(condition.name+", ", conditionX, conditionY);
                conditionLine += condition.name+", ";
            } else {
                context.fillText(condition.name, conditionX, conditionY);
            }
        }

        // Draw combat info
        if(scene.combat){
            let enemy = scene.combat.enemy;
            let enemyInfo = enemyFileData[enemy.fileDataIndex];

            context.fillStyle = 'hsla(0, 0%, 50%, 0.7)';
            context.save();
            context.shadowColor = enemyInfo.color;
            context.shadowBlur = 7;
            context.beginPath();
            context.roundRect(scene.worldX+18*16*scene.sizeMod*2+30 + 20, scene.worldY+300, 263, 170, 10);
            context.fill();
            context.restore();

            context.font = '20px zenMaruRegular';
            context.textAlign = 'center';
            context.fillStyle = enemyInfo.color;
            context.fillText(enemyInfo.name, scene.worldX+18*16*scene.sizeMod*2+30 + 150, scene.worldY+325);

            context.font = '18px zenMaruMedium';
            context.textAlign = 'left';
            context.fillStyle = "White";
            context.fillText("HP: ", scene.worldX+18*16*scene.sizeMod*2+30 + 45, scene.worldY+360);

            context.fillStyle = "#40d600";
            context.fillText(enemy.hp+"/"+enemy.maxHp, scene.worldX+18*16*scene.sizeMod*2+30 + 45+context.measureText("HP: ").width, scene.worldY+360);
        }
    }
}

sceneDefinitions.push({
    name: "adventure",
    update: updateAdventure,
    draw: drawAdventure,
    buttons: [loveButton],
});

// Loop that requests animation frames for itself, contains update and draw code that is not unique to any scene and everything else really
function gameLoop(timeStamp){
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
        window.requestAnimationFrame(gameLoop);
        console.log("skipping a frame...");
        return;
    }

    // Call the update function for the scene
    //sceneDefinitions[scene.index].update(timeStamp);
    updateAdventure(timeStamp);

    // Update particle systems
    for (let i=scene.particleSystems.length-1;i>=0;i--) {
        let sys = scene.particleSystems[i];

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
            scene.particleSystems.splice(i,1)
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

    // Call the draw function for the scene
    //sceneDefinitions[scene.index].draw(timeStamp);
    drawAdventure(timeStamp);

    // Draw the active buttons as it is not specifc to scene
    for (let x in scene.buttons) {
        let b = scene.buttons[x];
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
    for (let x in scene.particleSystems) {
        let sys = scene.particleSystems[x];
        if(!sys.specialDrawLocation){
            sys.drawParticles(timeStamp);
        }

        particleCount+=sys.particles.length;
    }

    // Draw constant elements
    context.fillStyle = textColor;
    if(showDevInfo && scene.name !== "adventure"){
        context.font = '18px Arial';
        context.textAlign = "right";
        context.fillText(note, screenWidth-30, screenHeight-110);

        context.textAlign = "start";
        context.fillText("Partcle Count: "+particleCount, screenWidth-200, screenHeight-80);
        context.fillText("Kanji Loaded: "+kanjiLoaded, screenWidth-200, screenHeight-140);

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
    if(scene.currentTooltip !== null){
        if(timeStamp - scene.currentTooltip.timeStamp > scene.tooltipBoxes[scene.currentTooltip.index].spawnTime){
            drawTooltip();
        }
    }

    if(isLoggingFrame){
        let statement = //"Time Stamp: " +timeStamp+ "\n" + "Scene: " +scene.name+ "\n"+ "Number of tooltips: " +scene.tooltipBoxes.length+ "\n";
`Time Stamp: ${timeStamp}
Scene: ${scene.name}
Number of tooltips: ${scene.tooltipBoxes.length}
Player Src: ${scene.player.sceneData.src}
`;
        console.log(statement);
        alert(statement);
        isLoggingFrame=false;
    }

    // Keep requesting new frames
    frameCount++;
    window.requestAnimationFrame(gameLoop);
}

function initialLoadingLoop(timeStamp){
    if(gameJsonDataLoaded && levelsLoaded && areImageAssetsLoaded()){
        initializeScene("adventure");
        window.requestAnimationFrame(gameLoop);
    } else {
        // circle
        context.fillStyle = randomColor;
        context.beginPath();
        context.arc(mouseX, mouseY, 10, 0, 2 * Math.PI);
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
    name = localStorage.getItem('name');
    love = love===null ? 0 : parseInt(love);
    name = name===null ? "" : name;

    window.requestAnimationFrame(initialLoadingLoop);
}
