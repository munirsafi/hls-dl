const GenericParser = require('./generic');
const sax = require('sax');

module.exports = class m3u extends GenericParser {

    constructor(httpLib, hlsstream, options) {
        super(httpLib, hlsstream, options);

        this.parser = sax.parser(false, { lowercase: true });
        this.parser.onopentag = (node) => {
            this._parse(node);
        };
    }


    _write(chunk) {
        let hasNoNewSegments = true;

        this.currentSources = 0, this.completed = 0;
        this.hlsstream.emit('status', 'Parsing through playlist');

        this.parser.write(chunk);

        if (hasNoNewSegments == true || this.live == true) {
            this.refreshAttempts++;
            this._fetchPlaylist();
        } else {
            this.refreshAttempts = 0;
        }
        this.hlsstream.emit('status', 'Playlist parsing complete');
    }


    _parse(node) {
        console.log(node);
    }


};