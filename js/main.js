//Init
$(init);
function init(){
    filenameTitle();
    config.fillinputs();
    initGrid();
    updateSlider();
    bindButtons();
}

function filenameTitle(){
    $.get(`/filename`,(f) => {
        var a = f.split("\\");
        $('title').append(" - "+a.at(-1));
    })
}

//Nav
function tshow(e){
    var tn = $(e).data('tab');
    show(tn);
    refresh();
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

function open_el(mode,n){
    show(`${mode}_el`);
    $(`#g-${mode}-el`).attr('data-e',n);
    refresh();
}

function refresh(){
    abordable.abortAll();
    progressbar.init(1);
    console.log("refresh");

    //Slider
    var pos = Number($("#slider").val()*config.timewidth).toFixed(1);
    $('#time').val(`${pos} sec`);

    var id = $('.tab-active').first().attr('id');
    if(id == "home"){
        console.log("home");
        return 0;
    }
    else if(id.includes('_el')){
        var mode = id.split('_')[0];
        console.log("Plot Electrode", mode);
        var n = $(`#g-${mode}-el`).attr('data-e');
        var el = new Electrode(`g-${mode}-el`,n,mode,true);
        if(mode == "raw") el.squarecursor = true;
        el.plot();
    }
    else{
        console.log("Collection Populate",id);
        gridcollect.collection[id].populate();
    }
}

//Sliders
function updateSlider(){
    $.getJSON("\duration", (duration) => {
        var s = Math.floor(duration / config.timewidth);
        $("#slider").attr('max',s);
    });
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

//To move

/*var heatmap = Array(256);

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
}*/

//KeyListener
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

//Buttons functions
function bindButtons(){
    $('#slider').change(refresh);
    $('#spike-layer').click(refresh);
    $('#btn-select-el').click(select_el);
    $('#spectrum-cursor-cb').click(refresh);
    $('#btn-full-sample').click(fullFrameSpectrum);
    $('#btn-play-spectrum').click(playSpectrum);
    $('#g-spectrum-el').click(this,hideTarget);
    $('#btn-stack').click(plotStack);
    $(`#g-stack-el`).click(this,hideTarget);
}

function select_el(){
    var mode = $('.tab-active').attr('id');
    var el = prompt("Electrode number");
    if(el != null){
        open_el(mode,el);
    }
}

function fullFrameSpectrum(){
    var number = $(`#g-raw-el`).attr('data-e');
    var el = new Electrode("g-spectrum-el",number,"spectrum");
    el.setTrunc(0,1);
    el.plot();
}


function playSpectrum(){
    var number = $(`#g-raw-el`).attr('data-e');
    var el = new Electrode("g-spectrum-el",number,"spectrum");
    var wp = $('#spectrum-cursor-width').val()/100;
    for(var i = 0;i<=100;i++){
        var xp = Number(i/100);
        setTimeout((a,b,c)=>{ a.setTrunc(b,c); a.plot(); }, i*50, el, xp, wp);
    }
}

function hideTarget(ev){
    $(ev.target).hide();
    document.getElementsByTagName("body")[0].scrollIntoView(true);
}

function plotStack(){
    var number = $(`#g-raster-el`).attr('data-e');
    var el = new Electrode("g-stack-el", number, "stack");
    $(`#g-stack-el`).show();
    el.plot();
}

function infoHM(){
    alert("Green : 10 x std dev beyond average\nBlack : Average\nRed : -10 x std dev beneath average");
}
