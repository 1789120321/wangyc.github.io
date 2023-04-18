function BibtexParser() {
    this.pos = 0;
    this.input = "";

    this.entries = {};
    this.comments = [];
    this.strings = {
        JAN: "January",
        FEB: "February",
        MAR: "March",
        APR: "April",
        MAY: "May",
        JUN: "June",
        JUL: "July",
        AUG: "August",
        SEP: "September",
        OCT: "October",
        NOV: "November",
        DEC: "December"
    };
    this.currentKey = "";
    this.currentEntry = "";


    this.setInput = function (t) {
        this.input = t;
    }

    this.getEntries = function () {
        return this.entries;
    }

    this.isWhitespace = function (s) {
        return (s == ' ' || s == '\r' || s == '\t' || s == '\n');
    }

    this.match = function (s) {
        this.skipWhitespace();
        if (this.input.substring(this.pos, this.pos + s.length) == s) {
            this.pos += s.length;
        } else {
            throw "Token mismatch, expected " + s + ", found " + this.input.substring(this.pos);
        }
        this.skipWhitespace();
    }

    this.tryMatch = function (s) {
        this.skipWhitespace();
        if (this.input.substring(this.pos, this.pos + s.length) == s) {
            return true;
        } else {
            return false;
        }
        this.skipWhitespace();
    }

    this.skipWhitespace = function () {
        while (this.isWhitespace(this.input[this.pos])) {
            this.pos++;
        }
        if (this.input[this.pos] == "%") {
            while (this.input[this.pos] != "\n") {
                this.pos++;
            }
            this.skipWhitespace();
        }
    }

    this.value_braces = function () {
        var bracecount = 0;
        this.match("{");
        var start = this.pos;
        while (true) {
            if (this.input[this.pos] == '}' && this.input[this.pos - 1] != '\\') {
                if (bracecount > 0) {
                    bracecount--;
                } else {
                    var end = this.pos;
                    this.match("}");
                    return this.input.substring(start, end);
                }
            } else if (this.input[this.pos] == '{') {
                bracecount++;
            } else if (this.pos == this.input.length - 1) {
                throw "Unterminated value";
            }
            this.pos++;
        }
    }

    this.value_quotes = function () {
        this.match('"');
        var start = this.pos;
        while (true) {
            if (this.input[this.pos] == '"' && this.input[this.pos - 1] != '\\') {
                var end = this.pos;
                this.match('"');
                return this.input.substring(start, end);
            } else if (this.pos == this.input.length - 1) {
                throw "Unterminated value:" + this.input.substring(start);
            }
            this.pos++;
        }
    }

    this.single_value = function () {
        var start = this.pos;
        if (this.tryMatch("{")) {
            return this.value_braces();
        } else if (this.tryMatch('"')) {
            return this.value_quotes();
        } else {
            var k = this.key();
            if (this.strings[k.toUpperCase()]) {
                return this.strings[k];
            } else if (k.match("^[0-9]+$")) {
                return k;
            } else {
                throw "Value expected:" + this.input.substring(start);
            }
        }
    }

    this.value = function () {
        var values = [];
        values.push(this.single_value());
        while (this.tryMatch("#")) {
            this.match("#");
            values.push(this.single_value());
        }
        return values.join("");
    }

    this.key = function () {
        var start = this.pos;
        while (true) {
            if (this.pos == this.input.length) {
                throw "Runaway key";
            }

            if (this.input[this.pos].match("[a-zA-Z0-9_:\\./-]")) {
                this.pos++
            } else {
                return this.input.substring(start, this.pos).toUpperCase();
            }
        }
    }

    this.key_equals_value = function () {
        var key = this.key();
        if (this.tryMatch("=")) {
            this.match("=");
            var val = this.value();
            return [key, val];
        } else {
            throw "... = value expected, equals sign missing:" + this.input.substring(this.pos);
        }
    }

    this.key_value_list = function () {
        var kv = this.key_equals_value();
        this.entries[this.currentEntry][kv[0]] = kv[1];
        while (this.tryMatch(",")) {
            this.match(",");
            // fixes problems with commas at the end of a list
            if (this.tryMatch("}")) {
                break;
            }
            kv = this.key_equals_value();
            this.entries[this.currentEntry][kv[0]] = kv[1];
        }
    }

    this.entry_body = function (d) {
        this.currentEntry = this.key();
        this.entries[this.currentEntry] = {entryType: d.substring(1)};
        this.match(",");
        this.key_value_list();
    }

    this.directive = function () {
        this.match("@");
        return "@" + this.key();
    }

    this.string = function () {
        var kv = this.key_equals_value();
        this.strings[kv[0].toUpperCase()] = kv[1];
    }

    this.preamble = function () {
        this.value();
    }

    this.comment = function () {
        var start = this.pos;
        while (true) {
            if (this.pos == this.input.length) {
                throw "Runaway comment";
            }

            if (this.input[this.pos] != '}') {
                this.pos++
            } else {
                this.comments.push(this.input.substring(start, this.pos));
                return;
            }
        }
    }

    this.entry = function (d) {
        this.entry_body(d);
    }

    this.bibtex = function () {
        while (this.tryMatch("@")) {
            var d = this.directive().toUpperCase();
            this.match("{");
            if (d == "@STRING") {
                this.string();
            } else if (d == "@PREAMBLE") {
                this.preamble();
            } else if (d == "@COMMENT") {
                this.comment();
            } else {
                this.entry(d);
            }
            this.match("}");
        }

        this.entries['@comments'] = this.comments;
    }
}

//Runs the parser
function doParse(input) {
    var b = new BibtexParser()
    b.setInput(input)
    b.bibtex()
    return b.entries
}

// module.exports = doParse
function paperQuery() {
    var sc = document.currentScript;
    var paper = sc.getAttribute("paperName");
    var bib = sc.getAttribute("bib");

    var xhr = new XMLHttpRequest();
    xhr.open('GET', bib, true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4 && xhr.status == 200) {
            var fileContent = xhr.responseText;
            // 在这里使用文件内容
            var paperObject = doParse(fileContent);
            var paperInfo = paperObject[Object.keys(paperObject)[0]];

            paperInfo['AUTHOR'] = paperInfo['AUTHOR'].replace(/\s+/g, ' ').trim();
            // 使用正则表达式替换字符串中的所有"and"为","
            paperInfo['AUTHOR'] = paperInfo['AUTHOR'].replace(/ and/g, ",");
            // 将最后一个","替换回"and"
            paperInfo['AUTHOR'] = paperInfo['AUTHOR'].replace(/,([^,]*)$/, " and$1");

            // 将指定作者加粗
            paperInfo['AUTHOR'] = paperInfo['AUTHOR'].replace(new RegExp("Ming Wen", "g"), "<b>" + "Ming Wen" + "</b>");

            var result = '';
            "<p className=\"paper\"><b>" + paper + bib + "</b></p>";
            if (paperInfo['entryType'] == 'ARTICLE') {
                result = result + "<p className=\"paper\"><b>" + "<a href=" + paperInfo['URL'] + " style=\"color: black;\">" + paperInfo['TITLE'] + "</a></b></p>";

                result = result + "<p className=\"paper\">" + paperInfo['AUTHOR'] + '</p><p className=\"paper\">'
                    + paperInfo['JOURNAL'] + ', ' + paperInfo['YEAR'] + ', ' + paperInfo['VOLUME'] + '(' + paperInfo['NUMBER'] + ')';

                if (paperInfo.hasOwnProperty("PAGES")) {
                    result = result + ': ' + paperInfo["PAGES"];
                }

                result = result + "</p>";
            } else if (paperInfo['entryType'] == 'INPROCEEDINGS') {
                result = result + "<p className=\"paper\"><b>" + "<a href=" + paperInfo['URL'] + " style=\"color: black;\">" + paperInfo['TITLE'] + "</a></b></p>";

                result = result + "<p className=\"paper\">" + paperInfo['AUTHOR'] + '</p><p className=\"paper\"> In '
                    + paperInfo['BOOKTITLE'];

                if (paperInfo.hasOwnProperty("PAGES")) {
                    result = result + ': ' + paperInfo["PAGES"];
                }

                result = result + "</p>";
            }


            // console.log(Object.keys(paperInfo));
            // // if(paperInfo[''])
            // console.log(paperInfo)
            // console.log(paperInfo['TITLE'])

            document.getElementById(bib).innerHTML = result;
        }
    };
    xhr.send();
}

paperQuery();