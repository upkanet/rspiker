//Init
$(init);
function init(){
    initGrid();
    updateSlider();
}

//Nav
function tshow(e){
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
    populateGridName(id);
}

//Graphics
function initGrid(){
    initGridName("raw");
    initGridName("filtered");
    initGridName("raster");
}

function initGridName(name){
    var config = getConfig();
    var raw = $(`#${name}`);
    raw.html(`<div class="container-fluid"></div>`);
    var rawc = raw.children().first();
    for(var i = 0; i < 256;i++){
        if(i%16 == 0){
            rawc.append(`<div class="row"></div>`);
            var rawcr = rawc.children().last();
        }
        var el = config.map_mea[i];
        rawcr.append(`<div class="col e-tile"><div id="g-${name}-${el}" data-e="${el}" style="width:100%;height:100%;"></div></div>`);
    }
}

function populateGridName(name){
    var layout = { paper_bgcolor: 'transparent',plot_bgcolor: 'transparent', font: { color: 'white' }, xaxis: {visible: false }, yaxis: {visible: false}, hovermode: false,margin: {l: 0, r: 0, b: 0, t: 0 } };
    var mod = "e";
    switch(name){
        case("raw"): mod = "e"; break;
        case("filtered"): mod = "f"; break;
    }
    dataloaderinit(256);
    for(var i = 0; i < 256;i++){
        plotEdata(`g-${name}-${i}`,mod,i,layout, { displayModeBar: false });
    }
}

/*function raster(timewidth = 2){
    var config = getConfig();
    console.log(config);
    for(var n = 0; n < 256; n++){
        var el = config.map_mea[n];
        $('#raster').append(`<canvas id="raster_${el}" width="70" height="55"></canvas>`);
    }
    for(var n = 0; n < 256; n++){
        plotERaster(n,timewidth);
    }
}*/

function populateRaster(){
    var config = getConfig();
    dataloaderinit(256);
    for(var i = 0; i < 256;i++){
        plotERaster(i, config.timewidth);
    }
}

var layoutBlack = { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: 'white' }, xaxis: {'title': '', ticksuffix:'', spikemode: 'toaxis'}, yaxis: {spikemode: 'toaxis'}, hovermode: 'closest' };

function plotEdata(graph,mod,electrode, layout, plotly_config = {}){
    var s = $("#slider").val();
    $.getJSON(`/electrode/${mod}/${electrode}/timeslice/${s}`, (data) => {
        //console.log(data);
        var sample_rate = 20000;
        var d = {x: data.map((x,index) => index / sample_rate), y: data.map(x => x), type: 'line' };
        layoutBlack.xaxis.title = electrode;
        /*layoutBlack.xaxis.ticksuffix = ticksuffix;*/
        Plotly.newPlot(graph, [d], layout, plotly_config);
        dataloader();
    });
}

function plotERaster(electrode,timewidth){
    $.getJSON(`/electrode/s/${electrode}`, (data) => {
        var d = $(`#g-raster-${electrode}`);
        var sample_rate = 20000;
        var w = d.width();
        var h = d.height();
        var tw = timewidth;
        var th = Math.round((data.length / sample_rate) / tw);
        var sh = h / th * 0.8;

        d.append(`<canvas width="${w}" height="${h}"></canvas>`);
        var canvas = $(`#g-raster-${electrode}>canvas`)[0];
        var ctx = canvas.getContext('2d');
        ctx.fillStyle="#1f77b4";

        data.forEach((v,k) => {
            if(v > 0){
                var t = k / sample_rate;
                var x = t%tw / tw;
                var y = Math.round(t/tw) / th;
                ctx.fillRect(x * w,y * h,1,sh);
            }
        });
        dataloader();
    });
}

function getConfig(){
    var config = 0;
    $.ajax({
        url: '/config',
        async: false
    }).done(function(data){
        config = data;
    });
    return config;
}

