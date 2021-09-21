//Init
$(init);
function init(){
    loadConfig();
    initGrid();
    updateSlider();
    $(".graph-el-detail").click(function(){
        $(this).hide();
    })
}

var abordable = [];

//Nav
function tshow(e){
    abortAll();
    var tn = $(e).data('tab');
    if(tn == "raw" || tn == "filtered"){
        populateGridName(tn);
    }
    if(tn == "raster"){
        populateRaster();
    }
    if(tn == "heatmap"){
        populateHeatmap();
    }
    show(tn);
}

function show(tabname){
    $('.nav-link').each((i,e)=>{
        $(e).removeClass('active');
    });
    $(`.nav-link[data-tab='${tabname}']`).addClass('active');
    $('.tab').each((i,e)=>{
        $(e).removeClass('tab-active');
    });
    $(`#${tabname}`).addClass('tab-active');
}

function open_el(mod,n){
    abortAll();
    show(`${mod}_el`);
    var layout = { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: 'white' }, xaxis: {'title': n, ticksuffix:'', spikemode: 'toaxis'}, yaxis: {spikemode: 'toaxis'}, hovermode: 'closest' };
    var modurl = "";
    switch(mod){
        case("raw"): modurl = "e"; break;
        case("filtered"): modurl = "f"; break;
        case("raster"): modurl = "r"; break;
        default: break;
    }
    dataloaderinit(1);
    var config = getConfig();
    if(mod == "raster"){
        plotERaster(`g-${mod}-el`,n, config);
    }
    else{
        plotEdata(`g-${mod}-el`,modurl,n, config);
    }
}

function abortAll(){
    abordable.forEach((e) => {
        e.abort();
    });
    abordable = [];
}

function select_el(){
    var el = prompt("Electrode number");
    var mod = $('.tab-active').attr('id');
    open_el(mod,el);
}

//Loading
var dataloadertotal = 0;
var dataloadercount = 0;

function dataloaderinit(t){
    dataloadercount = 0;
    dataloadertotal = t;
}

function dataloader(){
    dataloadercount++;
    progress(dataloadercount,dataloadertotal);
}

function progress(n,t){
    var d = $('#data-progress');
    if(n == t){
        d.hide();
    }
    else{
        d.show();
        d.css('width',Math.round(n/t * 100) + "%");
    }
}

//Slider
function updateSlider(){
    abortAll();
    heatmap = Array(256);
    $.getJSON("\config", function(config){
        $.getJSON("\duration", (duration) => {
            var s = Math.floor(duration / config.timewidth);
            var sl = $("#slider");
            sl.attr('max',s);
            var pos = Number(sl.val()*config.timewidth).toFixed(1);
            $('#time').val(`${pos} sec`);
            refresh();
        });
    });
}

function refresh(){
    var id = $('.tab-active').first().attr('id');
    if(id.includes('_el')){
        var mod = id.split('_')[0];
        var g = $(`#g-${mod}-el`);
        var e = g.data('e');
        mod = mod2url(mod);
        g = g[0].id;
        dataloaderinit(1);
        var config = getConfig();
        plotEdata(g,mod,e,config);
    }
    else{
        populateGridName(id);
    }
}

function mod2url(modname){
    var modurl = "";
    switch(modname){
        case("raw"): modurl = "e"; break;
        case("filtered"): modurl = "f"; break;
        default: console.log("mod2url : Unknown modname",modname);
    }
    return modurl;
}

//Graphics
function initGrid(){
    initGridName("raw");
    initGridName("filtered");
    initGridName("raster");
    initGridName("heatmap");
}

function initGridName(name){
    var config = getConfig();
    var grid = $(`#${name}`);
    grid.append('<div class="el-grid"></div>');
    grid = grid.children().last();
    for(var i = 0; i < 256;i++){
        var el = config.map_mea[i];
        grid.append(`<div class="col e-tile" onclick="open_el('${name}',${el})"><div id="g-${name}-${el}" data-e="${el}" style="width:100%;height:100%;"></div></div>`);
    }
}

function populateGridName(name){
    var layout = { paper_bgcolor: 'transparent',plot_bgcolor: 'transparent', font: { color: 'white' }, xaxis: {visible: false }, yaxis: {visible: false}, hovermode: false,margin: {l: 0, r: 0, b: 0, t: 0 } };
    var mod = "";
    switch(name){
        case("raw"): mod = "e"; break;
        case("filtered"): mod = "f"; break;
        case("heatmap"): populateHeatmap();
        default: return;
    }
    var config = getConfig();
    dataloaderinit(256);
    for(var i = 1; i <= 256;i++){
        plotEdata(`g-${name}-${i}`,mod,i,config);
    }
}

function populateRaster(){
    var config = getConfig();
    dataloaderinit(256);
    for(var i = 1; i <= 256;i++){
        plotERaster(`g-raster-${i}`,i, config);
    }
}

var heatmap = Array(256);

function populateHeatmap(){
    var config = getConfig();
    $('#microslider').attr("max",config.timewidth * config.samplerate);
    setMicroSlider();
    loadHM();
}

function loadHM(){
    dataloaderinit(256);
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
            dataloader();
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
    var config = getConfig();
    var samplerate = config.samplerate;
    var stimstart = config.stimstart;
    var timewidth = config.timewidth;
    var millisec = Number(ms/samplerate*1000).toFixed(2);
    var away = Number((ms/samplerate-stimstart % timewidth)*1000).toFixed(2);
    hmms.val(`+${millisec} ms (${(away<0?"":"+") + away})`);
}

function setMicroSlider(){
    var config = getConfig();
    $('#microslider').val(config.stimstart % config.timewidth * config.samplerate);
    updateMicroSlider();
}

document.addEventListener('keydown', logKey);

function logKey(e){
    var k = e.key;
    if(k == "ArrowRight"){
        microSliderUp();
    }
    if(k == "ArrowLeft"){
        microSliderDown();
    }
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
        if(v>=0) g = v;
        if(v<0) r = -v;
        $(`#g-heatmap-${i}`).css("background-color",`rgb(${r},${g},0)`);
    }
}

function plotEdata(graph,mod,electrode,config){
    var stimstart = config.stimstart;
    var timewidth = config.timewidth;
    var stimstartpos = stimstart%timewidth / timewidth;
    var stimwidth = $('#stimduration').val() / 1000;
    var stimendpos = (stimstart%timewidth + stimwidth) / timewidth;
    var s = $("#slider").val();
    var f = $.getJSON(`/electrode/${mod}/${electrode-1}/timeslice/${s}`, (data) => {
        var d = $(`#${graph}`);
        d.attr('data-e',electrode);
        d.data('e',electrode);
        d.html('');
        var w = d.width();
        var h = d.height();
        var aw = data.length;
        var atop = Math.max(...data);
        var abot = Math.min(...data);
        var ah = atop - abot;

        d.append(`<canvas width="${w}" height="${h}"></canvas>`);
        var canvas = $(`#${graph}>canvas`)[0];
        var ctx = canvas.getContext('2d');

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

        //Stim Square
        ctx.fillStyle="rgba(255,0,0,0.5)";
        ctx.fillRect(stimstartpos * w,0,(stimendpos - stimstartpos) * w,h);

        //Abscisse
        var isel = (graph.substr(-2) == "el");
        if(isel){
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

        if(graph == "g-raw-el"){
            d.append(`<canvas id="cursor-canvas" width="${d.width()}" height="${d.height()}" class="cursor"></canvas>`);
            cursorCanvas();
        }

        dataloader();
        plotSpikes(graph, electrode);
    });
    abordable.push(f);
}

function cursorCanvas(){
    var canvas = $(`#cursor-canvas`)[0];
    canvas.addEventListener('mousemove', (e)=>{
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,canvas.width,canvas.height);
        if(!$('#spectrum-cursor-cb').is(':checked')){
            return true;
        }
        ctx.fillStyle="rgba(255, 255, 255, 0.1)";
        var w = $('#spectrum-cursor-width').val()/100;
        ctx.fillRect(e.clientX-20,0,w*canvas.width,canvas.height);
    });
    canvas.addEventListener('contextmenu', (e) => {
        if(!$('#spectrum-cursor-cb').is(':checked')){
            return true;
        }
        e.preventDefault();
        var xp = e.clientX / canvas.width;
        var wp = $('#spectrum-cursor-width').val()/100;
        plotEspectrum(xp,wp);
        return false;
    }, false);
}

function plotERaster(graph,electrode,config){
    var stimstart = config.stimstart;
    var sample_rate = config.samplerate;
    var timewidth = config.timewidth;
    var stimstartpos = stimstart%timewidth / timewidth;
    var stimwidth = $('#stimduration').val() / 1000;
    var stimendpos = (stimstart%timewidth + stimwidth) / timewidth;
    var f = $.getJSON(`/electrode/s/${electrode-1}`, (data) => {
        var d = $(`#${graph}`);
        d.attr('data-e',electrode);
        d.data('e',electrode);
        d.html('');
        var w = d.width();
        var h = d.height();
        var tw = timewidth;
        var th = Math.round((data.length / sample_rate) / tw);
        var sh = h / th * 0.8;

        d.append(`<canvas width="${w}" height="${h}"></canvas>`);
        var canvas = $(`#${graph}>canvas`)[0];
        var ctx = canvas.getContext('2d');
        
        //Stim Square
        ctx.fillStyle="#1F1F1F";
        ctx.fillRect(stimstartpos * w,0,(stimendpos - stimstartpos) * w,h);

        data.forEach((v,k) => {
            if(v > 0){
                var t = k / sample_rate;
                var x = t%tw / tw;
                var y = Math.round(t/tw) / th;
                ctx.fillStyle=plotColor(x,stimstartpos,stimendpos);
                ctx.fillRect(x * w,y * h,1,sh);
            }
        });
        dataloader();
    });
    abordable.push(f);
}

function plotSpikes(graph, electrode){
    if(!$('#spike-layer').is(':checked')){
        return 1;
    }
    var s = $("#slider").val();
    var f = $.getJSON(`/electrode/s/${electrode-1}/timeslice/${s}`, (data) => {
        var d = $(`#${graph}`);
        var w = d.width();
        var h = d.height();
        var aw = data.length;

        var canvas = $(`#${graph}>canvas`)[0];
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

function plotEspectrum(xp,wp){
    var electrode = $("#g-raw-el").data('e');
    var s = Number($("#slider").val());
    var config = getConfig();
    var k = Math.floor((s+xp) * Number(config.samplerate));
    var k1 = Math.floor(Math.min(s+1,s+xp+wp) * Number(config.samplerate));
    var d = $(`#g-spectrum-el`);
    var w = d.width();
    var h = d.height();
    d.html(`<canvas width="${w}" height="${h}"></canvas>`);
    var canvas = $(`#g-spectrum-el>canvas`)[0];
    var ctx = canvas.getContext('2d');
    var f = $.getJSON(`/spectrum/${electrode-1}/slice/${k}/${k1}`, (data) => {
        var aw = data.length;
        var atop = Math.max(...data);
        var abot = Math.min(...data);
        var ah = atop - abot;

        ctx.clearRect(0,0,w,h);

        ctx.beginPath();
        ctx.moveTo(0,h*(1-(data[0]-abot)/ah));

        data.forEach((v,k) => {
            var x = k / aw;
            var y = (v-abot)/ah-0.05;
            ctx.lineTo(x *w, h*(1-y));
        });
        ctx.strokeStyle="#1f77b4";
        ctx.stroke();

        var ti = data.topIndex(5);

        ti.forEach((n,k) => {
            var v = data[n];
            var x = n / aw;
            var y = (v-abot)/ah-0.05;
            var f = Math.round(n*config.samplerate / data.length / 2);
            ctx.font = "12px Arial";
            ctx.fillStyle="white";
            ctx.fillText(f,x *w, h*(1-y));
        });

        $("#g-spectrum-el").show();
        document.getElementById("g-spectrum-el").scrollIntoView(true);
    });
}

function playSpectrum(){
    var wp = $('#spectrum-cursor-width').val()/100;
    for(var i = 0;i<=100;i++){
        var xp = Number(i/100);
        setTimeout((a,b)=>{  plotEspectrum(a,b); }, i*50, xp, wp);
    }
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

function plotEstack(){
    var config = getConfig();
    var timewidth = config.timewidth;
    var electrode = $("#g-raster-el").data('e');
    var step = $('#stack-width').val();
    var sample_rate = config.samplerate;
    var f = $.getJSON(`/electrode/s/${electrode-1}`, (data) => {
        var tw = timewidth;

        var histo = new Array(Math.round(timewidth / step)+1).fill(0);

        data.forEach((v,k) => {
            if(v > 0){
                var t = k / sample_rate;
                var x = t%tw / tw;
                histo[Math.round(x * timewidth / step)] += 1;
            }
        });
        plotHistoStack(histo);
    });
    abordable.push(f);
}

function plotHistoStack(histo){
    var d = $(`#g-stack-el`);
    d.html('');
    d.show();
    var w = d.width();
    var h = d.height();

    d.append(`<canvas width="${w}" height="${h}"></canvas>`);
    var canvas = $(`#g-stack-el>canvas`)[0];
    var ctx = canvas.getContext('2d');
    ctx.fillStyle="#1f77b4";

    var sw = w / histo.length;
    var sh = h / Math.max(...histo);

    histo.forEach((v,k) => {
        var x = k * sw;
        ctx.fillRect(x,0,sw,sh * v);
    });

    document.getElementById("g-stack-el").scrollIntoView(true);
}

function getSampleRate(){
    $.ajax({
        url: `/samplerate`,
        async: false
    }).done((data) => {
        samplerate = data;
    });
    return Number(samplerate);
}

function getStimStart(){
    var electrode = 127;
    $.ajax({
        url: `/stimstart/${electrode-1}`,
        async: false
    }).done((data) => {
        stimstart = data;
    });
    return Number(stimstart);
}

function fromServerConfig(){
    var config = {};
    $.ajax({
        dataType: 'json',
        url: '/config',
        async: false
    }).done((data) => {
        config = data;
    });
    config.samplerate = getSampleRate();
    config.stimstart =  getStimStart();
    return config;
}

function loadConfig(){
    var config = fromServerConfig();
    $('#filterfc').val(config.fc);
    $('#threshold').val(config.threshold);
    $('#timewidth').val(config.timewidth);
    $('#stimduration').val(config.stimduration);
    $('#map_mea').val(config.map_mea);
    $('#samplerate').val(config.samplerate);
    $('#stimstart').val(config.stimstart);
}

function getConfig(){
    var config = {};
    config.fc = Number($('#filterfc').val());
    config.threshold = Number($('#threshold').val());
    config.timewidth = Number($('#timewidth').val());
    config.stimduration = Number($('#stimduration').val());
    config.map_mea = $('#map_mea').val().split(",");
    config.samplerate = $('#samplerate').val();
    config.stimstart = $('#stimstart').val();
    return config;
}

function saveConfig(){
    var config = getConfig();
    var oldconfig = fromServerConfig();
    delete config.map_mea;
    delete config.samplerate;
    delete config.stimstart;
    if(config.fc != oldconfig.fc){
        clearCache("f");
        clearCache("s");
        clearCache("hm");
    }
    if(config.threshold != oldconfig.threshold){
        clearCache("s");
    }
    console.log(config);
    $.ajax({
        method: "POST",
        url: `/saveconfig`,
        contentType: "application/json; charset=utf-8",
        data: JSON.stringify(config),
        dataType:"json",
        success: (d) => {
            console.log(d);
        }
      });
}

function clearCache(mod){
    console.log("Clear Cache for",mod);
    $.getJSON(`/clearcache/${mod}`,(d) => {
        console.log(d);
    });
}

