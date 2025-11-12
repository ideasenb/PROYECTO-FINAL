loadAudio(1);
function loadAudio(valueSong) {
  
  var audio = document.getElementById('soundScreen');

    switch (valueSong) {
        case 1:
            audio.src = './src/sounds/01_game_menu.wav';
        break;
        case 2:
            audio.src = './src/sounds/gameSong.wav';
        break;
        case 3:
            audio.src = './src/sounds/03_game_win.wav';
        break;
        case 4:
            audio.src = './src/sounds/04_game_over.wav';
        break;
    }

    // document.querySelector("audio").play();
}

loadSceen(1);

function loadSceen(screen){
    switch (screen) {
        case 1: // Menu
            changeVisibility('block','none', 'none','none','none');
            loadAudio(1);
        break;
        case 2: // Juego
            changeVisibility('none','block', 'none','none','none');
            loadAudio(2);
        break;
        case 3: // Gano
            changeVisibility('none','none', 'block','none','none');
            loadAudio(3);
        break;
        case 4: // Perdio
            changeVisibility('none','none', 'none','block','none');
            loadAudio(4);
        break;
        case 5: // Pausar
            changeVisibility('none','block', 'none','none','block');
            // loadAudio(4);
        break;
    }
}

function changeVisibility(menu, game, win, lose, pause) {
    document.getElementById("MenuScreen").style.display = menu;
    document.getElementById("gameScreen").style.display = game;
    document.getElementById("WinnerScreen").style.display = win;
    document.getElementById("LoserScreen").style.display = lose;
    document.getElementById("PauseScreen").style.display = pause;
}