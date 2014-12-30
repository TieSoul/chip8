MMU = {
    memory: new Uint8Array(0x1000),
    numsprites: [0xF0, 0x90, 0x90, 0x90, 0xF0,
        0x20, 0x60, 0x20, 0x20, 0x70,
        0xF0, 0x10, 0xF0, 0x80, 0xF0,
        0xF0, 0x10, 0xF0, 0x10, 0xF0,
        0x90, 0x90, 0xF0, 0x10, 0x10,
        0xF0, 0x80, 0xF0, 0x10, 0xF0,
        0xF0, 0x80, 0xF0, 0x90, 0xF0,
        0xF0, 0x10, 0x20, 0x40, 0x40,
        0xF0, 0x90, 0xF0, 0x90, 0xF0,
        0xF0, 0x90, 0xF0, 0x10, 0xF0,
        0xF0, 0x90, 0xF0, 0x90, 0x90,
        0xE0, 0x90, 0xE0, 0x90, 0xE0,
        0xF0, 0x80, 0x80, 0x80, 0xF0,
        0xE0, 0x90, 0x90, 0x90, 0xE0,
        0xF0, 0x80, 0xF0, 0x80, 0xF0,
        0xF0, 0x80, 0xF0, 0x80, 0x80],
    reset: function() {
        for (var i = 0; i < 0x1000; i++)
            MMU.memory[i] = 0x00;
        for (i = 0; i < MMU.numsprites.length; i++) MMU.memory[i] = MMU.numsprites[i];
    },
    rb: function(addr) {
        return MMU.memory[addr];
    },
    wb: function(addr, val) {
        MMU.memory[addr] = val;
    },
    rw: function(addr) {
        return (MMU.memory[addr]<<8) | MMU.memory[addr+1];
    },
    load: function(file) {
        if (file.length > 0x0DFF) throw Error("ROM image is too long!");
        for (var i = 0; i < file.length; i++) MMU.wb(i + 0x200, file[i]);
        console.log(MMU.memory);
    }
};

CPU = {
    pc: 0x200,
    sp: 0x0,
    stack: new Uint16Array(16),
    V: new Uint8Array(16),
    I: 0x0000,
    rflag: false,
    delayt: 0x0,
    soundt: 0x0,
    reset: function() {
        for (var i = 0; i < 16; i++)
            CPU.V[i] = 0x00;
        CPU.pc = 0x200;
        CPU.I = 0x0000;
    },
    frame: function() {
        var opcode = MMU.rw(CPU.pc);
        while (!CPU.rflag) {
            CPU.interp_op(opcode);
            opcode = MMU.rw(CPU.pc);
        }
        GPU.render();
        CPU.rflag = false;

        CPU.interval = setTimeout(CPU.frame, 0.016666666666666666);
    },
    interval: null,
    interp_op: function(opcode) {
        if (CPU.delayt) CPU.delayt--;
        if (CPU.soundt)  {
            if (--CPU.soundt == 0) {
                if (!document.getElementById("beep").paused) document.getElementById("beep").pause();
                document.getElementById("beep").currentTime = 0;
                document.getElementById("beep").play();
            }
        }
        switch(opcode & 0xF000) {
            case 0x0000:
                if (opcode == 0x00E0) {
                    for (var i = 0; i < 64 * 128 * 4; i++) GPU._scrn.data[i] = 255;
                    CPU.rflag = true;
                } else if (opcode == 0x00EE) {
                    CPU.pc = CPU.stack[--CPU.sp];
                }
                break;
            case 0x1000:
                CPU.pc = opcode & 0x0FFF;
                return;
            case 0x2000:
                CPU.stack[CPU.sp++] = CPU.pc;
                CPU.pc = opcode & 0x0FFF;
                return;
            case 0x3000:
                if (CPU.V[(opcode&0x0F00)>>8] == (opcode & 0x00FF)) CPU.pc += 2;
                break;
            case 0x4000:
                if (CPU.V[(opcode&0x0F00)>>8] != (opcode & 0x00FF)) CPU.pc += 2;
                break;
            case 0x5000:
                if (opcode & 0x000F) console.warn("Unknown opcode 0x" + opcode.toString(16));
                else if (CPU.V[(opcode&0x0F00)>>8] == CPU.V[(opcode&0x00F0)>>4]) CPU.pc += 2;
                break;
            case 0x6000:
                CPU.V[(opcode&0x0F00)>>8] = opcode & 0x00FF;
                break;
            case 0x7000:
                CPU.V[(opcode&0x0F00)>>8] += opcode & 0x00FF;
                break;
            case 0x8000:
                switch(opcode&0x000F) {
                    case 0x0000:
                        CPU.V[(opcode&0x0F00)>>8] = CPU.V[(opcode&0x00F0)>>4];
                        break;
                    case 0x0001:
                        CPU.V[(opcode&0x0F00)>>8] |= CPU.V[(opcode&0x00F0)>>4];
                        break;
                    case 0x0002:
                        CPU.V[(opcode&0x0F00)>>8] &= CPU.V[(opcode&0x00F0)>>4];
                        break;
                    case 0x0003:
                        CPU.V[(opcode&0x0F00)>>8] ^= CPU.V[(opcode&0x00F0)>>4];
                        break;
                    case 0x0004:
                        if (CPU.V[(opcode&0x0F00)>>8] + CPU.V[(opcode&0x00F0)>>4] > 255) CPU.V[0xF] = 1;
                        else CPU.V[0xF] = 0;
                        CPU.V[(opcode&0x0F00)>>8] += CPU.V[(opcode&0x00F0)>>4];
                        break;
                    case 0x0005:
                        if (CPU.V[(opcode&0x0F00)>>8] > CPU.V[(opcode&0x00F0)>>4]) CPU.V[0xF] = 1;
                        else CPU.V[0xF] = 0;
                        CPU.V[(opcode&0x0F00)>>8] -= CPU.V[(opcode&0x00F0)>>4];
                        break;
                    case 0x0006:
                        CPU.V[0xF] = (CPU.V[(opcode&0x0F00)>>8]&0x0001);
                        CPU.V[(opcode&0x0F00)>>8] >>= 1;
                        break;
                    case 0x0007:
                        if (CPU.V[(opcode&0x0F00)>>8] <= CPU.V[(opcode&0x00F0)>>4]) CPU.V[0xF] = 1;
                        else CPU.V[0xF] = 0;
                        CPU.V[(opcode&0x0F00)>>8] = CPU.V[(opcode&0x00F0)>>4] - CPU.V[(opcode&0x0F00)>>8];
                        break;
                    case 0x000E:
                        CPU.V[0xF] = (CPU.V[(opcode&0x0F00)>>8]&0x8000)>>15;
                        CPU.V[(opcode&0x0F00)>>8] <<= 1;
                        break;
                    default:
                        console.warn("Unknown opcode 0x" + opcode.toString(16));
                        break;
                }
                break;
            case 0x9000:
                if (opcode & 0x000F) console.warn("Unknown opcode 0x" + opcode.toString(16));
                else if (CPU.V[(opcode&0x0F00)>>8] != CPU.V[(opcode&0x00F0)>>4]) CPU.pc += 2;
                break;
            case 0xA000:
                CPU.I = opcode&0x0FFF;
                break;
            case 0xB000:
                CPU.pc = (opcode & 0x0FFF) + CPU.V[0];
                return;
            case 0xC000:
                CPU.V[(opcode&0x0F00)>>8] = Math.floor(Math.random() * 256) & (opcode&0x00FF);
                break;
            case 0xD000:
                CPU.rflag = true;
                var size = opcode & 0x000F;
                var x = CPU.V[(opcode & 0x0F00)>>8];
                var y = CPU.V[(opcode & 0x00F0)>>4];
                var sprite = [];
                i = CPU.I;
                for (var z = i; i < z + size; i++) {
                    sprite.push(MMU.rb(i));
                }
                GPU.loadsprite(sprite, [x, y]);
                break;
            case 0xE000:
                switch(opcode & 0x00FF) {
                    case 0x009E:
                        if (KEY.keys[CPU.V[(opcode & 0x0F00)>>8]])
                            CPU.pc += 2;
                        break;
                    case 0x00A1:
                        if (KEY.keys[CPU.V[(opcode & 0x0F00)>>8]] == 0)
                            CPU.pc += 2;
                        break;
                    default:
                        console.warn("Unknown opcode 0x" + opcode.toString(16));
                        break;
                }
                break;
            case 0xF000:
                switch(opcode & 0x00FF) {
                    case 0x0007:
                        CPU.V[(opcode&0x0F00)>>8] = CPU.delayt;
                        break;
                    case 0x000A:
                        var done = false;
                        for (i = 0; i < 16; i++)
                            if (KEY.keys[i]) {CPU.V[(opcode&0x0F00)>>8] = i; done = true; }
                        if (!done) return;
                        break;
                    case 0x0015:
                        CPU.delayt = CPU.V[(opcode&0x0F00)>>8];
                        break;
                    case 0x0018:
                        CPU.soundt = CPU.V[(opcode&0x0F00)>>8];
                        break;
                    case 0x001E:
                        CPU.I += CPU.V[(opcode&0x0F00)>>8];
                        break;
                    case 0x0029:
                        CPU.I = CPU.V[(opcode&0x0F00)>>8] * 5;
                        break;
                    case 0x0033:
                        var x = CPU.V[(opcode&0x0F00)>>8];
                        MMU.wb(CPU.I, Math.floor(x / 100));
                        MMU.wb(CPU.I+1, Math.floor((x%100) / 10));
                        MMU.wb(CPU.I+2, x%10);
                        break;
                    case 0x0055:
                        var x = (opcode&0x0F00)>>8;
                        for (var i = 0; i < x; i++) MMU.wb(CPU.I + i, CPU.V[i]);
                        break;
                    case 0x0065:
                        var x = (opcode&0x0F00)>>8;
                        for (var i = 0; i < x; i++) CPU.V[i] = MMU.rb(CPU.I + i);
                        break;
                    default:
                        console.warn("Unknown opcode 0x" + opcode.toString(16));
                        break;
                }
                break;
            default:
                console.warn("Unknown opcode 0x" + opcode.toString(16));
                break;
        }
        CPU.pc += 2;
    },
    run: function() {
        if (CPU.interval) {
            clearTimeout(CPU.interval);
            CPU.interval = null;
            document.getElementById('run').innerHTML = 'Run';
        } else {
            CPU.interval = setTimeout(CPU.frame, 0.016666666666666666);
            document.getElementById('run').innerHTML = 'Pause';
        }
    }
};


GPU = {
    reset: function () {
        var c = document.getElementById('screen');
        if (c && c.getContext) {
            GPU._canvas = c.getContext('2d');
            if (GPU._canvas) {
                if (GPU._canvas.createImageData) GPU._scrn = GPU._canvas.createImageData(128, 64);

                else if (GPU._canvas.getImageData) GPU._scrn = GPU._canvas.getImageData(0, 0, 128, 64);

                else GPU._scrn = {
                        'width': 128,
                        'height': 64,
                        'data': new Array(128 * 64 * 4)
                    };

                // Initialise canvas to white
                for (var i = 0; i < 128 * 64 * 4; i++)
                    GPU._scrn.data[i] = 255;

                GPU._canvas.putImageData(GPU._scrn, 0, 0);
            }
        }
    },
    screen: document.getElementById("screen").getContext("2d"),
    render: function () {
        GPU._canvas.putImageData(GPU._scrn, 0, 0);
    },
    loadsprite: function (sprite, pos) {
        var x = pos[0] + 8;
        var y = pos[1];
        for (var i = 0; i < sprite.length; i++) {
            for (var j = 0; j < 8; j++) {
                var p = (x + 128 * y) * 4;
                if (GPU._scrn.data[p] == 0) CPU.V[0xF] = 1;
                else CPU.V[0xF] = 0;
                GPU._scrn.data[p] ^= 255 * ((sprite[i] >> j) & 1);
                GPU._scrn.data[p + 1] ^= 255 * ((sprite[i] >> j) & 1);
                GPU._scrn.data[p + 2] ^= 255 * ((sprite[i] >> j) & 1);
                x--;
            }
            x = pos[0] + 8;
            y++;
        }
    }
};
KEY = {
    mapping: {
        49: 0x1,
        50: 0x2,
        51: 0x3,
        52: 0xC,
        81: 0x4,
        87: 0x5,
        69: 0x6,
        82: 0xD,
        65: 0x7,
        83: 0x8,
        68: 0x9,
        70: 0xE,
        90: 0xA,
        88: 0x0,
        67: 0xB,
        86: 0xF
    },
    keys: new Uint8Array(0xF),
    keydown: function(evt) {
        if (KEY.mapping[evt.keyCode])
            KEY.keys[KEY.mapping[evt.keyCode]] = 1;
    },
    keyup: function(evt) {
        if (KEY.mapping[evt.keyCode])
            KEY.keys[KEY.mapping[evt.keyCode]] = 0;
    }
};
currentFile = null;
reset = function() {
    MMU.reset();
    GPU.reset();
    CPU.reset();
    if (currentFile) MMU.load(currentFile);
};
reset();
function handleFileSelect(evt) {
    var reader = new FileReader();
    var file = evt.target.files[0];
    reader.onload = function(e) {
        currentFile = new Uint8Array(reader.result);
        reset();
        MMU.load(currentFile);
    };
    reader.readAsArrayBuffer(file);
}
document.getElementById("run").onclick = CPU.run;
document.getElementById("reset").onclick = reset;
document.getElementById("file").addEventListener("change", handleFileSelect, false);
document.getElementById("screen").onkeydown = KEY.keydown;
document.getElementById("screen").onkeyup = KEY.keyup;
