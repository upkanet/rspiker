function setBGImg(id){
    var f = document.createElement('input');
    f.style.display='none';
    f.type='file';
    document.querySelector('body').appendChild(f);
    f.click();
    f.addEventListener('change',(e)=>{
        var preview = document.querySelector('#'+id);
        var file    = e.target.files[0];
        var reader  = new FileReader();

        reader.addEventListener("load", function () {
            preview.src = reader.result;
        }, false);

        if (file) {
            reader.readAsDataURL(file);
        }
        document.querySelector('body').removeChild(f);
    });
}

function moveBGImg(id,x,y){
    var img = $('#'+id);
    var l = Number(img.css('left').replace('px',''));
    var t = Number(img.css('top').replace('px',''));
    img.css("left",l + x );
    img.css("top",t + y );
}

var BGImgScale_circuit = 1;
var BGImgScale_mea = 1;
var BGImgRotate_circuit = 0;
var BGImgRotate_mea = 0;

function transformBGImg(id,s,r){
    var img = $('#'+id);
    var pf = 'BGImg';
    var pfs = pf+'Scale_';
    var pfr = pf+'Rotate_';
    window[pfs+id] += s;
    window[pfr+id] += r;
    img.css('transform',`scale(${window[pfs+id]}) rotate(${window[pfr+id]}deg)`);
}

function resetTransformBGImg(id){
    var pf = 'BGImg';
    var pfs = pf+'Scale_';
    var pfr = pf+'Rotate_';
    window[pfs+id] = 1;
    window[pfr+id] = 0;
    transformBGImg(id,0,0);
}

function opacityBGImg(o){
    var imgs = $('.bgimg');
    imgs.each((i,img)=>{
        var img = $(img);
        var op = Number(img.css('opacity'));
        img.css('opacity',Math.min(op+o,1));
    })
}

//KeyListener
document.addEventListener('keydown', logKeyBGImg);
function logKeyBGImg(e){
    if(e.altKey || e.ctrlKey) return 0;
    var k = e.key;
    var mstep = 10;
    var sstep = 0.05;
    var rstep = 1;
    var ostep = 0.05;
    if(k == "q"){
        moveBGImg("circuit",-mstep,0);
    }
    if(k == "z"){
        moveBGImg("circuit",0,-mstep);
    }
    if(k == "d"){
        moveBGImg("circuit",mstep,0);
    }
    if(k == "s"){
        moveBGImg("circuit",0,mstep);
    }
    if(k == "a"){
        transformBGImg("circuit",-sstep,0);
    }
    if(k == "e"){
        transformBGImg("circuit",sstep,0);
    }
    if(k == "w"){
        transformBGImg("circuit",0,-rstep);
    }
    if(k == "c"){
        transformBGImg("circuit",0,rstep);
    }
    if(k == "r"){
        opacityBGImg(ostep);
    }
    if(k == "f"){
        opacityBGImg(-ostep);
    }
    if(e.shiftKey && k == "Q"){
        moveBGImg("mea",-mstep,0);
    }
    if(e.shiftKey && k == "Z"){
        moveBGImg("mea",0,-mstep);
    }
    if(e.shiftKey && k == "D"){
        moveBGImg("mea",mstep,0);
    }
    if(e.shiftKey && k == "S"){
        moveBGImg("mea",0,mstep);
    }
    if(e.shiftKey && k == "A"){
        transformBGImg("mea",-sstep,0);
    }
    if(e.shiftKey && k == "E"){
        transformBGImg("mea",sstep,0);
    }
    if(e.shiftKey && k == "W"){
        transformBGImg("mea",0,-rstep);
    }
    if(e.shiftKey && k == "C"){
        transformBGImg("mea",0,rstep);
    }
}