//Init
$(init);
function init(){
    filenameTitle();
    config.fillinputs();
    initGrid();
    updateSlider();
    $(".graph-el-detail").click(function(){
        $(this).hide();
    })
}

function filenameTitle(){
    $.get(`/filename`,(f) => {
        var a = f.split("\\");
        $('title').append(" - "+a.at(-1));
    })
}

//Nav
function tshow(e){
    abordable.abortAll();
    var tn = $(e).data('tab');
    gridcollect.collection[tn].populate();
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
    abordable.abortAll();
    show(`${mod}_el`);
    var layout = { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: 'white' }, xaxis: {'title': n, ticksuffix:'', spikemode: 'toaxis'}, yaxis: {spikemode: 'toaxis'}, hovermode: 'closest' };
    var modurl = "";
    switch(mod){
        case("raw"): modurl = "e"; break;
        case("filtered"): modurl = "f"; break;
        case("raster"): modurl = "r"; break;
        default: break;
    }
    progressbar.init(1);
    if(mod == "raster"){
        plotERaster(`g-${mod}-el`,n, config);
    }
    else{
        plotEdata(`g-${mod}-el`,modurl,n, config);
    }
}

function select_el(){
    var el = prompt("Electrode number");
    var mod = $('.tab-active').attr('id');
    open_el(mod,el);
}

//Slider
function updateSlider(){
    abordable.abortAll();
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
    if(id == "home"){
        return 0;
    }
    else if(id.includes('_el')){
        var mod = id.split('_')[0];
        var g = $(`#g-${mod}-el`);
        var e = g.data('e');
        mod = mod2url(mod);
        g = g[0].id;
        progressbar.init(1);
        plotEdata(g,mod,e,config);
    }
    else{
        gridcollect.collection[id].populate();
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
var gridcollect = new GridCollection();

function initGrid(){
    gridcollect.pushName("raw");
    gridcollect.pushName("filtered");
    gridcollect.pushName("raster");
    gridcollect.pushName("heatmap");
    gridcollect.draw();
}

var heatmap = Array(256);

function populateHeatmap(){
    $('#microslider').attr("max",config.timewidth * config.samplerate);
    setMicroSlider();
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
    hmms.val(`+${millisec} ms (${(away<0?"":"+") + away})`);
}

function setMicroSlider(){
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
        progressbar.count();
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

        $("#g-spectrum-el").show();
        document.getElementById("g-spectrum-el").scrollIntoView(true);
    });
}

function binIndexToFrequency(n,samplerate,samplelength){
    return Number(n * samplerate / samplelength).toFixed(1);
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

function infoHM(){
    alert("Green : 10 x std dev beyond average\nBlack : Average\nRed : -10 x std dev beneath average");
}
