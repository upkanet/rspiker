//Init
$(init);
function init(){
    initGrid();
    updateSlider();
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
    $.getJSON("\config", function(config){
        $.getJSON("\duration", (duration) => {
            var s = Math.floor(duration / config.timewidth);
            $("#slider").attr('max',s);
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
}

function initGridName(name){
    var config = getConfig();
    var grid = $(`#${name}`);
    grid.append('<div class="el-grid"></div>');
    grid = grid.children().first();
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

        data.forEach((v,k) => {
            var x = k / aw;
            var y = (v - abot) / ah;
            ctx.fillStyle=plotColor(x,stimstartpos,stimendpos);
            ctx.fillRect(x * w,y * h,1,1);
        });
        dataloader();
        plotSpikes(graph, electrode);
    });
    abordable.push(f);
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

function plotEstack(){
    var config = getConfig();
    var timewidth = config.timewidth;
    var electrode = $("#g-raster-el").data('e');
    var step = $('#stack-width').val();
    var f = $.getJSON(`/electrode/s/${electrode-1}`, (data) => {
        var sample_rate = 20000;
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

function getStimstart(){
    var electrode = 127;
    $.ajax({
        url: `/stimstart/${electrode-1}`,
        async: false
    }).done((data) => {
        stimstart = data;
    });
    return Number(stimstart);
}

function getConfig(){
    var config = 0;
    $.ajax({
        url: '/config',
        async: false
    }).done(function(data){
        config = data;
    });
    config.stimstart = getStimstart();
    config.samplerate = getSampleRate();
    return config;
}

