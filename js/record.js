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
        $.ajax({
            url: `/start`,
            async: false
        }).done((start) => {
            this.start = Number(start);
        });
        $.ajax({
            url: `/filename`,
            async: false
        }).done((filename) => {
            this.filename = filename;
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
        $('#recordstart').val(this.start);
        $('#map_mea').val(this.map_mea);
        $('#filename').val(this.filename);
    }

    save(){
        var new_config = {};
        //Retrive from form
        new_config.fc = Number($('#filterfc').val());
        new_config.threshold = Number($('#threshold').val());
        new_config.timewidth = Number($('#timewidth').val());
        new_config.stimduration = Number($('#stimduration').val());
        new_config.start = Number($('#recordstart').val());
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
        if(new_config.start != this.start) $.post(`/start/${new_config.start}`);
        delete new_config.start;
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
        this.val = 0;
        this.jq = $('#data-progress');
        this.total = total;
        this.hide();
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
    constructor(graph, number, mode, solo = false){
        this.graph = graph;
        this.number = number;
        this.mode = mode;
        this.solo = solo;
        this.squarecursor = false;
        this.heatmap = [];
        switch(this.mode){
            case("raw"): this.short = "e"; break;
            case("filtered"): this.short = "f"; break;
            case("raster"): this.short = "r"; break;
            case("heatmap"): this.short = "h"; break;
            case("spectrum"): this.short = "s"; break;
            case("stack"): this.short = "st"; break;
        }
    }

    plot(){
        if(["e","f"].includes(this.short)){
            this.plotSignal();
        }
        else if(this.short == "s"){
            this.plotSpectrum();
        }
        else if(this.short == "r"){
            this.plotRaster();
        }
        else if(this.short == "st"){
            this.plotStack();
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
        $(`#${this.graph}>canvas`).remove();
        d.append(`<canvas width="${w}" height="${h}"></canvas>`);
        var canvas = $(`#${this.graph}>canvas`)[0];
        var ctx = canvas.getContext('2d');

        var f = $.getJSON(`/electrode/${this.short}/${this.number-1}/timeslice/${s}`, (data) => {
            var aw = data.length;
            var atop = Math.max(...data);
            var abot = Math.min(...data);
            var ah = atop - abot;
            var zf = getZoomFrame();

            //Transform context for graph XY
            ctx.transform(1, 0, 0, -1, 0, canvas.height);

            //Data
            ctx.beginPath();
            ctx.moveTo(0,h*(data[0] - abot) / ah);
    
            data.forEach((v,k) => {
                var x = k / aw;
                var y = (v - abot) / ah;
                var zpoint = zoomed(x * w,h*y,w,h,zf);
                ctx.lineTo(zpoint.x,zpoint.y);
            });
            ctx.strokeStyle="#1f77b4";
            ctx.stroke();
            ctx.transform(1, 0, 0, -1, 0, canvas.height);
            progressbar.count();
        
            //Stim Square
            if(!zf.active){
                ctx.fillStyle="rgba(255,0,0,0.5)";
                ctx.fillRect(stimstartpos * w,0,(stimendpos - stimstartpos) * w,h);
            }
        
            //Abscisse
            if(this.solo && !zf.active){
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
                this.cursorCanvas();
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
                    ctx.fillRect(x*w,y*h,1,h/5);
                }
            });
        });
        abordable.push(f);
    }

    plotSpectrum(){
        var s = Number($("#slider").val());
        var k = Math.floor((s+this.xp) * Number(config.samplerate));
        var k1 = Math.floor(Math.min(s+1,s+this.xp+this.wp) * Number(config.samplerate));
        var d = $(`#${this.graph}`);
        var w = d.width();
        var h = d.height();
        d.html(`<canvas width="${w}" height="${h}"></canvas>`);
        var canvas = $(`#${this.graph}>canvas`)[0];
        var ctx = canvas.getContext('2d');
        var f = $.getJSON(`/spectrum/${this.number-1}/slice/${k}/${k1}`, (data) => {
            var aw = data.length;
            var atop = Math.max(...data);
            var abot = Math.min(...data);
            var ah = atop - abot;
    
            ctx.clearRect(0,0,w,h);
    
            ctx.beginPath();
            ctx.moveTo(0,h*(1-(data[0]-abot)/ah));
    
            data.forEach((v,k) => {
                var x = k / aw;
                var y = (v-abot)/ah;
                y = 0.9 * y + 0.05;
                ctx.lineTo(x *w, h*(1-y));
            });
            ctx.strokeStyle="#1f77b4";
            ctx.stroke();
    
            var top_count = Number($('#spectrum-top-freq').val());
            var ti = data.topIndex(top_count);
    
            ti.forEach((n,k) => {
                var v = data[n];
                var x = n / aw;
                var y = (v-abot)/ah;
                //var f = Math.round(n*config.samplerate / data.length / 2);
                console.log(data.length,config.samplerate);
                var f = binIndexToFrequency(n,config.samplerate,data.length * 2);
                ctx.font = "12px Arial";
                ctx.fillStyle="white";
                y = 0.9 * y + 0.05;
                ctx.fillText(f,x *w, h*(1-y));
            });
    
            $(`#${this.graph}`).show();
            document.getElementById(this.graph).scrollIntoView(true);
        });
    }

    plotRaster(){
        var stimstart = config.stimstart;
        var sample_rate = config.samplerate;
        var timewidth = config.timewidth;
        var stimstartpos = stimstart%timewidth / timewidth;
        var stimwidth = $('#stimduration').val() / 1000;
        var stimendpos = (stimstart%timewidth + stimwidth) / timewidth;
        var f = $.getJSON(`/electrode/s/${this.number-1}`, (data) => {
            var d = $(`#${this.graph}`);
            d.attr('data-e',this.number);
            d.data('e',this.number);
            $(`#${this.graph}>canvas`).remove();
            var w = d.width();
            var h = d.height();
            var tw = timewidth;
            var th = Math.round((data.length / sample_rate) / tw);
            var sh = h / th * 0.8;

            //Zoom
            var zf = getZoomFrame();
    
            d.append(`<canvas width="${w}" height="${h}"></canvas>`);
            var canvas = $(`#${this.graph}>canvas`)[0];
            var ctx = canvas.getContext('2d');
            
            //Stim Square
            ctx.fillStyle="#1F1F1F";
            var sstop = zoomed(stimstartpos * w,0,w,h,zf);
            var ssbottom = zoomed(stimendpos * w,h,w,h,zf);
            ctx.fillRect(sstop.x,0,ssbottom.x-sstop.x,h);

            //Graph XY
            ctx.transform(1, 0, 0, -1, 0, canvas.height);
    
            data.forEach((v,k) => {
                if(v > 0){
                    var t = k / sample_rate;
                    var x = t%tw / tw;
                    var y = Math.round(t/tw) / th;
                    ctx.fillStyle=plotColor(x,stimstartpos,stimendpos);
                    var zpoint = zoomed(x * w,y * h,w,h,zf);
                    ctx.fillRect(zpoint.x,zpoint.y,1,sh / (zf.y1 - zf.y0));
                }
            });
            progressbar.count();
        });
        abordable.push(f);
    }

    plotStack(){
        var timewidth = config.timewidth;
        var step = $('#stack-width').val();
        var sample_rate = config.samplerate;
        var f = $.getJSON(`/electrode/s/${this.number-1}`, (data) => {
            var tw = timewidth;
    
            var histo = new Array(Math.round(timewidth / step)+1).fill(0);
    
            data.forEach((v,k) => {
                if(v > 0){
                    var t = k / sample_rate;
                    var x = t%tw / tw;
                    histo[Math.round(x * timewidth / step)] += 1;
                }
            });
            var d = $(`#${this.graph}`);
            d.html('');
            d.show();
            var w = d.width();
            var h = d.height();
        
            d.append(`<canvas width="${w}" height="${h}"></canvas>`);
            var canvas = $(`#${this.graph}>canvas`)[0];
            var ctx = canvas.getContext('2d');
            ctx.fillStyle="#1f77b4";
        
            var sw = w / histo.length;
            var sh = h / Math.max(...histo);
        
            //Graph XY
            ctx.transform(1, 0, 0, -1, 0, canvas.height);
            
            histo.forEach((v,k) => {
                var x = k * sw;
                ctx.fillRect(x,0,sw,sh * v);
            });
        
            document.getElementById(this.graph).scrollIntoView(true);
        });
        abordable.push(f);
    }

    setTrunc(xp,wp){
        this.xp = xp;
        this.wp = wp;
    }

    cursorCanvas(){
        var canvas = $(`#cursor-canvas`)[0];
        var cccb = $('#spectrum-cursor-cb');
        canvas.addEventListener('mousemove', (e)=>{
            var ctx = canvas.getContext('2d');
            ctx.clearRect(0,0,canvas.width,canvas.height);
            if(!cccb.is(':checked')){
                return true;
            }
            ctx.fillStyle="rgba(255, 255, 255, 0.1)";
            var w = $('#spectrum-cursor-width').val()/100;
            ctx.fillRect(e.clientX-20,0,w*canvas.width,canvas.height);
        });
        canvas.addEventListener('contextmenu', (e) => {
            if(!cccb.is(':checked')){
                return true;
            }
            e.preventDefault();
            var xp = e.clientX / canvas.width;
            var wp = $('#spectrum-cursor-width').val()/100;
            var el = new Electrode("g-spectrum-el",this.number,"spectrum");
            el.setTrunc(xp,wp);
            el.plot();
            return false;
        }, false);
    }
}

//Heatmap
var heatmap = Array(256);

function populateHeatmap(){
    $('#microslider').attr("max",config.timewidth * config.samplerate);
    microSliderStimStart();
    loadHM();
}

function loadHM(){
    progressbar.init(256);
    var s = $("#slider").val();
    for(var i = 1; i <= 256;i++){
        var f = $.ajax({
            dataType: 'json',
            type: 'get',
            url: `/electrode/hm/${i-1}/timeslice/${s}`,
            beforeSend: function(jqXHR, settings) {
                jqXHR.electrode = i;
            }
        }).done((data, textStatus, jqXHR)=>{
            heatmap[jqXHR.electrode-1] = data;
            progressbar.count();
            showHM();
        });
        abordable.push(f);
    }
}

function updateMicroSlider(){
    updateMS();
    showHM();
}

function updateMS(){
    var hmms = $('#heatmap-ms');
    var ms = $('#microslider').val();
    var samplerate = config.samplerate;
    var stimstart = config.stimstart;
    var timewidth = config.timewidth;
    var millisec = Number(ms/samplerate*1000).toFixed(2);
    var away = Number((ms/samplerate-stimstart % timewidth)*1000).toFixed(2);
    hmms.val(`${(away<0?"":"+") + away} ms`);
    $('#microslider-output').html(millisec);
    console.log(millisec,timewidth);
    $('#microslider-output').css('left',($('#microslider').width() - 50) * millisec/1000/timewidth);
}

function microSliderStimStart(){
    $('#microslider').val(config.stimstart % config.timewidth * config.samplerate);
    updateMicroSlider();
}

function microSliderUp(){
    var ms = $('#microslider');
    var msv = Number(ms.val());
    ms.val(msv+1);
    updateMicroSlider();
}

function microSliderDown(){
    var ms = $('#microslider');
    var msv = Number(ms.val());
    ms.val(msv-1);
    updateMicroSlider();
}

function showHM(){
    if(!heatmap.includes(undefined)){
        var ms = $('#microslider').val();
        plotHM(ms);
    }
}

function plotHM(ms){
    for(var i = 1; i <= 256;i++){
        var v = heatmap[i-1][ms]*20;
        if(v>255) v=255;
        if(v<-255) v=-255;
        var r = 0;
        var g = 0;
        /*if(v>=0) g = v;
        if(v<0) r = -v;
        $(`#g-heatmap-${i}`).css("background-color",`rgb(${r},${g},0)`);*/
        if(v>=0) g = 255;
        if(v<0) r = 255;
        $(`#g-heatmap-${i}`).css("background-color",`rgba(${r} ${g} 0 / ${Math.abs(v)/255 * 100}%)`);
    }
}

function plotColor(x,start,end){
    //console.log(x,start,end);
    if(x >= start && x < end){
        col="red";
    }
    else{
        col="#1f77b4";
    }
    return col;
}

function binIndexToFrequency(n,samplerate,samplelength){
    return Number(n * samplerate / samplelength).toFixed(1);
}

Array.prototype.topIndex = function(nb){
    var r = [];
    var sp2 = this.slice();
    for(var i = 0; i<nb;i++){
        var max = 0;
        for(var n = 0; n<sp2.length;n++){
            if(sp2[n] > max){
                maxIndex = n;
                max = sp2[n];
            }
        }
        r.push(maxIndex);
        sp2[maxIndex] = 0;
    }
    return r;
}

//Zoom
function getZoomFrame(){
    return JSON.parse($('#zoomframe').val());
}

function setZoomFrame(zf){
    console.log(zf);
    //Order
    var zf2 = {};
    zf2.x0 = Math.min(zf.x0,zf.x1);
    zf2.x1 = Math.max(zf.x0,zf.x1);
    zf2.y0 = Math.min(zf.y0,zf.y1);
    zf2.y1 = Math.max(zf.y0,zf.y1);
    //Activate
    zf2.active = true;
    //Set
    $('#zoomframe').val(JSON.stringify(zf2));
}

function zoomReset(){
    var zf = {x0:0,y0:0,x1:1,y1:1,active:false};
    $('#zoomframe').val(JSON.stringify(zf));
}

function zoomed(x,y,w,h,zf){
    var p = {x: 0, y:0};
    if(!zf.active){
        p.x = x;
        p.y = y;
    }
    else{
        p.x = (x/w - zf.x0) / (zf.x1 - zf.x0) * w;
        p.y = (y/h - zf.y0) / (zf.y1 - zf.y0) * h;
    }
    return p;
}