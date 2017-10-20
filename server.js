var fs = require('fs'),
    http = require('http'),
    io = require('socket.io')(server);

var server = http.createServer(
    function(req, res) {
        res.writeHead(200, {
            'Content-type': 'text/html'
        });
        res.end(fs.readFileSync(__dirname + '/client.html'));
    }
).listen(8080,
    function() {
        console.log('Listening at: http://localhost:8080');
    }
);


var nextID = 0;
var idmapping = [];

//////////
// Food //
//////////
var food = [];
function create_food(minx, miny, maxx, maxy, size) {
    var x = Math.floor(Math.random() * (maxx - minx + 1) + minx);
    var y = Math.floor(Math.random() * (maxy - miny + 1) + miny);
    food.push([x, y, size])
}

/////////
//Snake//
/////////
var snakes = [];
function snake(_size, _x, _y, _length) {
    this.size = _size;
    this.length = _length;
    this.headX = _x;
    this.headY = _y;
    this.circles = [];
    this.angle = 0;
    this.speed = 5;

    this.update = function(speed) {
        this.headX -= speed * Math.cos(this.angle);
        this.headY -= speed * Math.sin(this.angle);
        if (this.circles.length >= this.length) {
            this.circles.shift();
        }
        this.circles.push([this.headX, this.headY]);
    };
}

function game() {
    var counter = 0;

    function loop() {
        counter++;
        console.log("loop: " + counter);
        update_snakes();
        check_all_intersect();
        create_food(0, 0, 1000, 1000, 4);


        //send new state
        io.sockets.emit('state', [snakes, food]);
    }
    var fps = 20;
    setInterval(loop, 1000 / fps);
    
    function update_snakes() {
        for (var i = 0; i < snakes.length; i++) {
            if (snakes[i]) {
                snakes[i].update(snakes[i].speed);
            }
        }
    }
}

function check_all_intersect() {
    for (var i = 0; i < snakes.length; i++) {
        if (snakes[i]) {

            //eat food & remove food
            var food_intersects = check_intersect_food(i);
            for (var f = 0; f < food_intersects.length; f++) {
                snakes[i].length += 1;
                snakes[i].size += 1 / snakes[i].length;
                food.splice(food_intersects[f], 1);
            }

            //die if collide with snake
            if (intersect_snakes(i)) {
                spawnFoodOnDeadSnake(i);
                snakes[i] = null;
            }
        }
    }
    
    function intersect(ax, ay, as, bx, by, bs) {
        return (as + bs > Math.sqrt(Math.pow(ax - bx, 2) + Math.pow(ay - by, 2)));
    }
    
    function check_intersect_food(s) {
        var thisSnake = snakes[s];
        var X = thisSnake.circles[thisSnake.circles.length - 1][0];
        var Y = thisSnake.circles[thisSnake.circles.length - 1][1];

        var intersects = [];
        for (var f = 0; f < food.length; f++) {
            if (intersect(X, Y, thisSnake.size, food[f][0], food[f][1], food[f][2])) {
                intersects.push(f);
            }
        }
        return intersects;
    }


    function intersect_snakes(s) {
        var thisSnake = snakes[s];
        var X = thisSnake.circles[thisSnake.circles.length - 1][0];
        var Y = thisSnake.circles[thisSnake.circles.length - 1][1];

        for (var i = 0; i < snakes.length; i++) {
            if (snakes[i] && i != s) {
                for (var c = 0; c < snakes[i].circles.length; c++) {
                    if (intersect(X, Y, thisSnake.size, snakes[i].circles[c][0], snakes[i].circles[c][1], snakes[i].size)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    function spawnFoodOnDeadSnake(dead_snake_i) {
        var dead_snake = snakes[dead_snake_i];
        var cur_circle = dead_snake.circles[0]

        for (var c = 0; c < dead_snake.circles.length; c++) {
            cur_circle = dead_snake.circles[c];
            for (var f = 0; f < dead_snake.size / 4; f++) {
                create_food(cur_circle[0] - dead_snake.size, cur_circle[1] - dead_snake.size, cur_circle[0] + dead_snake.size, cur_circle[1] + dead_snake.size, dead_snake.size / 3);
            }
        }
    }

}

////////////////////
// NETWORK EVENTS //
////////////////////

var g = false;
io.listen(server).on('connection',
    function(socket) {

        idmapping[socket.id] = nextID;
        socket.emit('id', nextID);
        nextID += 1;
        snakes[idmapping[socket.id]] = new snake(10, idmapping[socket.id] * 100, 30, 10);
        if (!g) {
            g = true;
            game();
        }

        socket.on('angle', function(msg) {
            //lag
            setTimeout(function() {
                if (snakes[idmapping[socket.id]]) {
                    console.log('Message Received from ', socket.id, ': ', msg);
                    snakes[idmapping[socket.id]].angle = msg;
                }
            }, 100);
        });

        socket.on('speed', function(msg) {
            //lag
            //setTimeout(function(){
            console.log('speed Received from ', socket.id, ': ', msg);
            snakes[idmapping[socket.id]].speed = msg;
            //}, 100);
        });
    }
);
