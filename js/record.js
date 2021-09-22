function clearCache(mod){
    console.log("Clear Cache for",mod);
    $.getJSON(`/clearcache/${mod}`,(d) => {
        console.log(d);
    });
}

class Config {
    constructor(){
        this.fromserver();
    }

    fromserver(){
        $.ajax({
            dataType: 'json',
            url: '/config',
            async: false
        }).done((data) => {
            this.fc = data.fc;
            this.map_mea = data.map_mea;
            this.stimduration = data.stimduration;
            this.threshold = data.threshold;
            this.timewidth = data.timewidth;
        });
        $.ajax({
            url: `/samplerate`,
            async: false
        }).done((samplerate) => {
            this.samplerate = Number(samplerate);
        });
        var electrode = 127;
        $.ajax({
            url: `/stimstart/${electrode-1}`,
            async: false
        }).done((stimstart) => {
            this.stimstart = Number(stimstart);
        });
    }

    fillinputs(){
        $('#filterfc').val(this.fc);
        $('#threshold').val(this.threshold);
        $('#timewidth').val(this.timewidth);
        $('#stimduration').val(this.stimduration);
        $('#map_mea').val(this.map_mea);
        $('#samplerate').val(this.samplerate);
        $('#stimstart').val(this.stimstart);
        $('#map_mea').val(this.map_mea);
    }

    save(){
        var new_config = {};
        //Retrive from form
        new_config.fc = Number($('#filterfc').val());
        new_config.threshold = Number($('#threshold').val());
        new_config.timewidth = Number($('#timewidth').val());
        new_config.stimduration = Number($('#stimduration').val());
        new_config.map_mea = $('#map_mea').val().split(',').map((v)=>{return Number(v)});

        if(new_config.fc != this.fc){
            clearCache("f");
            clearCache("s");
            clearCache("hm");
        }
        if(new_config.threshold != this.threshold){
            clearCache("s");
        }
        console.log(new_config);
        //Save to server
        $.ajax({
            method: "POST",
            async: false,
            url: `/saveconfig`,
            contentType: "application/json; charset=utf-8",
            data: JSON.stringify(new_config),
            dataType:"json",
            success: (d) => {
                console.log("/saveconfig",d);
            }
          });

        this.fromserver();
    }
}

var config = new Config();
console.log(config);

class Progressbar {
    constructor(){
        this.val = 0;
        this.total = 0;
    }

    init(total){
        this.jq = $('#data-progress');
        this.total = total;
    }

    count(){
        this.val++;
        if(this.val >= this.total){
            this.hide();
            this.reset();
        }
        else{
            this.show();
        }
    }

    reset(){
        this.val = 0;
    }

    show(){
        this.jq.show();
        this.jq.css('width',Math.round(this.val/this.total * 100) + "%");
    }

    hide(){
        this.jq.hide();
    }
}
var progressbar = new Progressbar();

class Abordable {
    constructor(){
        this.functions = [];
    }

    push(f){
        this.functions.push(f);
    }

    abortAll(){
        this.functions.forEach((f) => {
            f.abort();
        });
        this.functions = [];
    }
}
var abordable = new Abordable();

class GridCollection {
    constructor() {
        this.collection = [];
    }

    pushName(name){
        this.push(name, new Grid(name));
    }

    push(name, g){
        this.collection[name] = g;
    }

    draw(){
        for(var g in this.collection){
            if(this.collection.hasOwnProperty(g)){
                this.collection[g].draw();
            }
        }
    }
}

class Grid {
    constructor(mode){
        this.mode = mode;
    }

    draw(){
        var grid = $(`#${this.mode}`);
        grid.append('<div class="el-grid"></div>');
        grid = grid.children().last();
        for(var i = 0; i < 256;i++){
            var el = config.map_mea[i];
            grid.append(`<div class="col e-tile" onclick="open_el('${this.mode}',${el})"><div id="g-${this.mode}-${el}" data-e="${el}" style="width:100%;height:100%;"></div></div>`);
        }
    }

    populate(){
        progressbar.init(256);
        for(var i = 1; i <= 256;i++){
            var el = new Electrode(`g-${this.mode}-${i}`,i,this.mode);
            el.plot();
        }
    }
}

class Electrode {
    constructor(graph, number, mode){
        this.graph = graph;
        this.number = number;
        this.mode = mode;
        this.solo = false;
        this.squarecursor = false;
        switch(this.mode){
            case("raw"): this.short = "e"; break;
            case("filtered"): this.short = "f"; break;
            case("raster"): this.short = "r"; break;
            case("heatmap"): this.short = "h"; break;
        }
    }

    plot(){
        if(["e","f"].includes(this.short)){
            this.plotSignal();
        }
    }

    plotSignal(){
        var stimstart = config.stimstart;
        var timewidth = config.timewidth;
        var stimstartpos = stimstart%timewidth / timewidth;
        var stimwidth = $('#stimduration').val() / 1000;
        var stimendpos = (stimstart%timewidth + stimwidth) / timewidth;
        var s = $("#slider").val();
        var d = $(`#${this.graph}`);
        var w = d.width();
        var h = d.height();
        d.html('');
        d.append(`<canvas width="${w}" height="${h}"></canvas>`);
        var canvas = $(`#${this.graph}>canvas`)[0];
        var ctx = canvas.getContext('2d');

        var f = $.getJSON(`/electrode/${this.short}/${this.number-1}/timeslice/${s}`, (data) => {
            var aw = data.length;
            var atop = Math.max(...data);
            var abot = Math.min(...data);
            var ah = atop - abot;

            //Data
            ctx.beginPath();
            ctx.moveTo(0,h*(1-(data[0] - abot) / ah));
    
            data.forEach((v,k) => {
                var x = k / aw;
                var y = (v - abot) / ah;
                ctx.lineTo(x * w,h*(1-y));
            });
            ctx.strokeStyle="#1f77b4";
            ctx.stroke();
            progressbar.count();
        
            //Stim Square
            ctx.fillStyle="rgba(255,0,0,0.5)";
            ctx.fillRect(stimstartpos * w,0,(stimendpos - stimstartpos) * w,h);
        
            //Abscisse
            if(this.solo){
                ctx.beginPath();
                ctx.moveTo(0,h/2);
                ctx.lineTo(w,h/2);
                ctx.strokeStyle="white";
                ctx.stroke();
                ctx.fillStyle="white";
                ctx.fillRect(0,h/2-10,1,20);
                ctx.fillRect(w/2,h/2-10,1,20);
                ctx.fillRect(w-1,h/2-10,1,20);
                ctx.font = "12px Arial";
                s = Number(s);
                ctx.fillText("seconds",0,h/2+25);
                ctx.fillText(s*timewidth,0,h/2-20);
                ctx.textAlign = 'center';
                ctx.fillText((s+0.5)*timewidth,w/2,h/2-20);
                ctx.textAlign = 'right';
                ctx.fillText((s+1)*timewidth,w,h/2-20);
            }
        
            //Square Cursor
            if(this.squarecursor){
                d.append(`<canvas id="cursor-canvas" width="${d.width()}" height="${d.height()}" class="cursor"></canvas>`);
                cursorCanvas();
            }
        
            //Spikes
            if($('#spike-layer').is(':checked')){
                this.plotSpikes();
            }
        });
        abordable.push(f);
    }

    plotSpikes(){
        var s = $("#slider").val();
        var f = $.getJSON(`/electrode/s/${this.number-1}/timeslice/${s}`, (data) => {
            var d = $(`#${this.graph}`);
            var w = d.width();
            var h = d.height();
            var aw = data.length;
    
            var canvas = $(`#${this.graph}>canvas`)[0];
            var ctx = canvas.getContext('2d');
            ctx.fillStyle="green";
    
            data.forEach((v,k) => {
                if(v > 0){
                    var x = k / aw;
                    var y = 0.5;
                    ctx.fillRect(x * w,y * h,1,h/5);
                }
            });
        });
        abordable.push(f);
    }
}