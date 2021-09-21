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

class MEA {
    constructor(mode){
        this.mode = mode;
    }
}

class Electrode {
    constructor(number, mode){
        this.number = number;
        this.mode = mode;
    }
}