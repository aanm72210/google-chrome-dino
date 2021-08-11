import { AllocatorCharacterArray, Character, CharacterAllocator, CharacterMeta } from "./character";
import { dino_layout, stone_layout, colors, cloud_layout, pit_layout, bird_layout, cactus_layout, retry_layout } from "./layouts";
import { applyVelocityToPosition, isCollided, Position, Velocity } from "./physics";

const canvas = document.getElementById("board");
const canvas_ctx = canvas.getContext('2d');

const CELL_SIZE = 2;
const ROWS = 300;
let COLUMNS = 1000;
const FLOOR_VELOCITY = new Velocity(0, -7);

if (screen.width < COLUMNS) {
    COLUMNS = screen.width;
    FLOOR_VELOCITY.add(new Velocity(0, 2));
}


const DINO_INITIAL_TRUST = new Velocity(-12, 0);
const ENVIRONMENT_GRAVITY = new Velocity(-0.6, 0);
const DINO_FLOOR_INITIAL_POSITION = new Position(200, 10);
let dino_current_trust = new Velocity(0, 0);
let dino_ready_to_jump = true;
let game_over = null;
let is_first_time = true;
let game_score = null;
let game_hi_score = null;

let harmless_characters_pool = [];
let harmfull_characters_pool = [
    new Character(new CharacterMeta(dino_layout.run, 4, DINO_FLOOR_INITIAL_POSITION.clone(), new Velocity(0, 0)))
];;

let harmless_character_allocator = [
    new CharacterAllocator(
        new AllocatorCharacterArray()
            .add_character(new CharacterMeta([stone_layout.large], 0, new Position(240, COLUMNS), FLOOR_VELOCITY), 0.9)
            .add_character(new CharacterMeta([stone_layout.medium], 0, new Position(243, COLUMNS), FLOOR_VELOCITY), 0.75)
            .add_character(new CharacterMeta([stone_layout.small], 0, new Position(241, COLUMNS), FLOOR_VELOCITY), 0.6)
        , 2, 0
    ),
    new CharacterAllocator(
        new AllocatorCharacterArray()
            .add_character(new CharacterMeta([cloud_layout], 0, new Position(100, COLUMNS), new Velocity(0, -1)), 0.9)
            .add_character(new CharacterMeta([cloud_layout], 0, new Position(135, COLUMNS), new Velocity(0, -1)), 0.85)
            .add_character(new CharacterMeta([cloud_layout], 0, new Position(150, COLUMNS), new Velocity(0, -1)), 0.8)
        , 400, 300
    ),
    new CharacterAllocator(
        new AllocatorCharacterArray()
            .add_character(new CharacterMeta([pit_layout.large], 0, new Position(223, COLUMNS), FLOOR_VELOCITY), 0.97)
            .add_character(new CharacterMeta([pit_layout.up], 0, new Position(227, COLUMNS), FLOOR_VELOCITY), 0.90)
            .add_character(new CharacterMeta([pit_layout.down], 0, new Position(230, COLUMNS), FLOOR_VELOCITY), 0.85)
        , 100, 50
    )
];

let harmfull_character_allocator = [
    new CharacterAllocator(
        new AllocatorCharacterArray()
            .add_character(new CharacterMeta([cactus_layout.small_d1], 0, new Position(201, COLUMNS), FLOOR_VELOCITY), 0.8)
            .add_character(new CharacterMeta([cactus_layout.small_s1], 0, new Position(201, COLUMNS), FLOOR_VELOCITY), 0.7)
            .add_character(new CharacterMeta([cactus_layout.small_s2], 0, new Position(201, COLUMNS), FLOOR_VELOCITY), 0.6)
            .add_character(new CharacterMeta([cactus_layout.medium_d1], 0, new Position(193, COLUMNS), FLOOR_VELOCITY), 0.5)
            .add_character(new CharacterMeta([cactus_layout.medium_s1], 0, new Position(193, COLUMNS), FLOOR_VELOCITY), 0.4)
            .add_character(new CharacterMeta([cactus_layout.medium_s2], 0, new Position(193, COLUMNS), FLOOR_VELOCITY), 0.3)

        , 30, 150
    ),
    new CharacterAllocator(
        new AllocatorCharacterArray()
            .add_character(new CharacterMeta(bird_layout.fly, 0, new Position(170, COLUMNS), FLOOR_VELOCITY.clone().add(new Velocity(0, -1))), 0.98)
            .add_character(new CharacterMeta(bird_layout.fly, 0, new Position(190, COLUMNS), FLOOR_VELOCITY.clone().add(new Velocity(0, -1))), 0.9)
        , 500, 50
    )
]

function initialize() {
    game_over = false;
    game_score = 0;
    game_hi_score = localStorage.getItem("project.github.chrome_dino.high_score") || 0;
    harmfull_characters_pool.splice(1);
    canvas.height = ROWS;
    canvas.width = COLUMNS;

    document.ontouchstart = () => {
        if (game_over && (Date.now() - game_over) > 1000) {
            main();
            return;
        }

        if (dino_ready_to_jump) {
            dino_ready_to_jump = false;
            dino_current_trust = DINO_INITIAL_TRUST.clone();
        }
    };

    document.body.onkeydown = event => {
        // keyCode is depricated
        if (event.keyCode === 32 || event.key === ' ') {
            document.ontouchstart();
        }
    };
}

function paint_layout(character_layout, character_position) {
    for (let j = 0; j < character_layout.length; j++) {
        for (let k = 0; k < character_layout[j].length; k++) {
            if (colors[character_layout[j][k]]) {
                canvas_ctx.fillStyle = colors[character_layout[j][k]];
                let x_pos = character_position[1] + (k * CELL_SIZE);
                let y_pos = character_position[0] + (j * CELL_SIZE);

                canvas_ctx.fillRect(x_pos, y_pos, CELL_SIZE, CELL_SIZE);
            }
        }
    }
}

function event_loop() {
    canvas_ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas_ctx.beginPath();

    // Road
    for (let i = 0; i < canvas.width; i++) {
        canvas_ctx.fillStyle = "black";
        canvas_ctx.fillRect(0, 232, canvas.width, CELL_SIZE * 0.2);
    }

    // score card update
    game_score += 0.10;
    canvas_ctx.font = "20px Arcade";
    canvas_ctx.fillStyle = "#747474";
    canvas_ctx.fillText(`H I     ${Math.floor(game_hi_score).toString().padStart(4, '0').split('').join(" ")}     ${Math.floor(game_score).toString().padStart(4, '0').split('').join(" ")}`, canvas.width - 200, 20);

    // first time
    if (is_first_time) {
        is_first_time = false;
        paint_layout(dino_layout.stand, harmfull_characters_pool[0].get_position().get());
        game_over = Date.now();

        canvas_ctx.textBaseline = 'middle';
        canvas_ctx.textAlign = 'center';
        canvas_ctx.font = "25px Arcade";
        canvas_ctx.fillStyle = "#535353";
        canvas_ctx.fillText("J     U     M     P             T     O             S     T     A     R     T", canvas.width / 2, (canvas.height / 2) - 50);
        return;
    }

    // characters
    // new characters generate
    [[harmless_character_allocator, harmless_characters_pool], [harmfull_character_allocator, harmfull_characters_pool]].forEach(character_allocator_details => {
        for (let i = 0; i < character_allocator_details[0].length; i++) {
            const ALLOCATOR = character_allocator_details[0][i];
            ALLOCATOR.tick();
            const RANDOM_CHARACTER = ALLOCATOR.get_character();
            if (RANDOM_CHARACTER) {
                character_allocator_details[1].push(RANDOM_CHARACTER);
            }
        }
    });

    // characters display
    [harmless_characters_pool, harmfull_characters_pool].forEach((characters_pool, index) => {

        for (let i = characters_pool.length - 1; i >= 0; i--) {
            characters_pool[i].tick();
            let CHARACTER_LAYOUT = characters_pool[i].get_layout();

            // A special case for dino jump. It's leg should be in standing position while jump
            // Yes, this can be done much better but I am lazy :-)
            if (!dino_ready_to_jump && index == 1 && i == 0) {
                CHARACTER_LAYOUT = dino_layout.stand;
            }
            // ******

            const CHARACTER_POSITION = characters_pool[i].get_position().get();

            if (CHARACTER_POSITION[1] < -150) {
                characters_pool.splice(i, 1);
                continue;
            }

            paint_layout(CHARACTER_LAYOUT, CHARACTER_POSITION);
        }
    });


    // harmfull characters collision detection
    let dino_character = harmfull_characters_pool[0];
    let dino_current_position = dino_character.get_position();
    let dino_current_layout = dino_character.get_layout();
    for (let i = harmfull_characters_pool.length - 1; i > 0; i--) {
        const HARMFULL_CHARACTER_POSITION = harmfull_characters_pool[i].get_position();
        const HARMFULL_CHARACTER_LAYOUT = harmfull_characters_pool[i].get_layout();
        if (isCollided(dino_current_position.get()[0], dino_current_position.get()[1], dino_current_layout.length, dino_current_layout[0].length, HARMFULL_CHARACTER_POSITION.get()[0], HARMFULL_CHARACTER_POSITION.get()[1], HARMFULL_CHARACTER_LAYOUT.length, HARMFULL_CHARACTER_LAYOUT[0].length)) {
            canvas_ctx.textBaseline = 'middle';
            canvas_ctx.textAlign = 'center';
            canvas_ctx.font = "25px Arcade";
            canvas_ctx.fillStyle = "#535353";
            canvas_ctx.fillText("G     A     M     E             O     V     E     R", canvas.width / 2, (canvas.height / 2) - 50);
            paint_layout(retry_layout, new Position((canvas.height / 2) - retry_layout.length, (canvas.width / 2) - retry_layout[0].length).get());
            paint_layout(dino_layout.dead, harmfull_characters_pool[0].get_position().get());
            game_over = Date.now();


            if (localStorage.getItem("project.github.chrome_dino.high_score") < game_score) {
                localStorage.setItem("project.github.chrome_dino.high_score", game_score);
            }

            return;
        }
    }

    // dino jump case
    dino_character.set_position(applyVelocityToPosition(dino_character.get_position(), dino_current_trust));

    if (dino_character.get_position().get()[0] > DINO_FLOOR_INITIAL_POSITION.get()[0]) {
        dino_character.set_position(DINO_FLOOR_INITIAL_POSITION.clone());
        dino_ready_to_jump = true;
    }

    dino_current_trust.sub(ENVIRONMENT_GRAVITY);

    requestAnimationFrame(event_loop);
}

function main() {
    initialize();
    event_loop();
}

document.fonts.load('1rem "Arcade"').then(() => {
    main();
});