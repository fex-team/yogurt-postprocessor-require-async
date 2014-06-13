/*
 * fis
 * http://fis.baidu.com/
 */

'use strict';

var ld, rd;

var parser = module.exports = function(content, file, conf){

    var o_ld = ld = conf.left_delimiter || fis.config.get('settings.smarty.left_delimiter') || fis.config.get('settings.template.left_delimiter') || '{%';
    var o_rd = rd = conf.right_delimiter || fis.config.get('settings.smarty.right_delimiter') || fis.config.get('settings.template.right_delimiter') || '%}';

    ld = pregQuote(ld);
    rd = pregQuote(rd);

    var initial = false;
    if (file.extras == undefined) {
        file.extras = {};
        initial = true;
    }
    file.extras.async = [];
    if (file.isHtmlLike) {
        content = parser.parseHtml(content, file, conf);
        if (file.extras.isPage) {
            var reg = new RegExp(ld + 'extends\\s+'), pos;
            if(reg.test(content)){
                pos = content.lastIndexOf(o_ld + '/block' + o_rd);
            } else {
                pos = content.indexOf(o_ld + '/body' + o_rd);
            }
            if(pos > 0){
                var insert = o_ld + "require name='" + file.id + "'" + o_rd;
                content = content.substring(0, pos) + insert + content.substring(pos);
            }
        }
    } else if (file.rExt === '.js') {
        content = parser.parseJs(content, file, conf);
    }
    //
    if (file.extras.async.length == 0) {
        delete file.extras.async;
        if (initial) {
            delete file.extras;
        }
    }
    return content;
};

function pregQuote (str, delimiter) {
    // http://kevin.vanzonneveld.net
    return (str + '').replace(new RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\' + (delimiter || '') + '-]', 'g'), '\\$&');
}


function addAsync(file, value) {
    var hasBrackets = false;
    var values = [];
    value = value.trim().replace(/(^\[|\]$)/g, function(m, v) {
        if (v) {
            hasBrackets = true;
        }
        return '';
    });
    values = value.split(/\s*,\s*/);
    values = values.map(function(v) {
        var info = fis.util.stringQuote(v);
        v = info.rest.trim();
        var uri = fis.uri.getId(v, file.dirname);
        if (file.extras.async.indexOf(uri.id) < 0) {
            file.extras.async.push(uri.id);
        }
        return info.quote + uri.id + info.quote;
    });

    return {
        values: values,
        hasBrackets: hasBrackets
    };
}

//analyse [@require.async id] syntax in comment
function analyseComment(file, comment){
    var reg = /(@require\.async\s+)('[^']+'|"[^"]+"|[^\s;!@#%^&*()]+)/g;
    return comment.replace(reg, function(m, prefix, value){
        addAsync(file, value);
        return '';
    });
}

//require.async(path) to require resource
parser.parseJs = function parseJs(content, file, conf){
    var reg = /"(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*'|(\/\/[^\r\n\f]+|\/\*[\s\S]+?(?:\*\/|$))|\b(require\.async)\s*\(\s*("(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*'|\[[\s\S]*?\])\s*/g;
    return content.replace(reg, function(m, comment, type, value){
        if(type){
            switch (type){
                case 'require.async':
                    var res = addAsync(file, value);
                    if (res.hasBrackets) {
                        m = 'require.async([' + res.values.join(', ') + ']';
                    } else {
                        m = 'require.async(' + res.values.join(', ');
                    }
                    break;
            }
        } else if (comment) {
            m = analyseComment(file, comment);
        }
        return m;
    });
}

//<script|style ...>...</script|style> to analyse as js|css
parser.parseHtml = function parseHtml(content, file, conf){
    var reg = /(<script(?:\s+[\s\S]*?["'\s\w\/]>|\s*>))([\s\S]*?)(?=<\/script>|$)/ig;
    content = content.replace(reg, function(m, $1, $2) {
        if($1){//<script>
            m = $1 + parser.parseJs($2, file, conf);
        }
        return m;
    });
    reg = new RegExp('('+ld+'\\s*script(?:\\s+[\\s\\S]*?["\'\\s\\w\\/]'+rd+'|\\s*'+rd+'))([\\s\\S]*?)(?='+ld+'\\s*endscript\\s*'+rd+'|$)', 'ig');
    return content.replace(reg, function(m, $1, $2) {
        if($1){//<script>
            m = $1 + parser.parseJs($2, file, conf);
        }
        return m;
    });
}


