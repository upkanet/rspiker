//Init
$(init);
function init(){
    filenameTitle();
    config.fillinputs();
    initGrid();
    initSliders();
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
    if(id == "home" || id == "config"){
        console.log(id);
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
    else if(id == "heatmap"){
        populateHeatmap();
    }
    else{
        console.log("Collection Populate",id);
        gridcollect.collection[id].populate();
    }
}

//Sliders
function initSliders(){
    $.getJSON("\duration", (duration) => {
        var s = Math.floor(duration / config.timewidth);
        $("#slider").attr('max',s).val(0);
    });
    $('#microslider').attr("max",config.timewidth * config.samplerate).val(0);
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

//Zoom
function zoomReset(){
    $('#zoomscale').val(1);
}

function zoomScale(s){
    $('#zoomscale').val((Number($('#zoomscale').val())+s).toFixed(2));
}

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
    if(k == '0'){
        zoomReset();
        refresh();
    }
}

//Wheel
function zoom(e){
    e.preventDefault();
    zoomScale(0.05*e.deltaY/100);
    refresh();
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
    $('#btn-ms-down').click(microSliderDown);
    $('#btn-ms-up').click(microSliderUp);
    $('#btn-ms-stimstart').click(microSliderStimStart);
    $('#btn-heatmap-info').click(infoHM);
    $('#btn-config-save').click(saveConfig);
    $('#btn-config-reset').click(resetConfig);
    $('#g-raster-el')[0].addEventListener('contextmenu',customStimStart);
    $('#btn-center-record-start').click(centerRecordStart);
    $('#microslider').change(updateMicroSlider);
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

function saveConfig(){
    config.save();
    setTimeout(initSliders,120);
    setTimeout(refresh,150);
}

function resetConfig(){
    config.fromserver();
    config.fillinputs();
}

function customStimStart(e){
    e.preventDefault();
    var x = e.offsetX;
    var w = $('#g-raster-el>canvas')[0].width;
    config.stimstart = x / w * config.timewidth;
    refresh();
}

function centerRecordStart(){
    var tw = config.timewidth;
    var ss = config.stimstart;
    var c = tw / 2;
    $('#recordstart').val(ss-c);
}